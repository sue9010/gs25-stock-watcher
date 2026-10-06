import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";

import { detectStockTransition } from "../_shared/transition.ts";
import { restockMessage, TelegramProvider } from "../_shared/telegram.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const inventoryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    inventory: z.object({
      stores: z.array(
        z.object({
          storeCode: z.string().min(1),
          storeName: z.string().min(1),
          address: z.string().min(1),
          latitude: z.number(),
          longitude: z.number(),
          realStockQuantity: z.number().int().nonnegative(),
          pickupStockQuantity: z.number().int().nonnegative().nullable(),
          deliveryStockQuantity: z.number().int().nonnegative().nullable(),
          isSoldOut: z.boolean(),
          distanceM: z.number().nonnegative(),
        }),
      ),
    }),
  }),
});

type InventoryStore = z.infer<typeof inventoryResponseSchema>["data"]["inventory"]["stores"][number];
type Product = { id: number; item_code: string; item_name: string };
type Store = {
  id: number;
  store_code: string;
  store_name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type QuietHoursSettings = {
  quiet_hours_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  timezone?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function distanceM(a: Store, b: Store) {
  const radiusM = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radiusM * Math.asin(Math.sqrt(value));
}

function clusterStores(stores: Store[]) {
  const clusters: Store[][] = [];
  for (const store of stores) {
    const cluster = clusters.find((candidate) => distanceM(candidate[0], store) <= 800);
    if (cluster) cluster.push(store);
    else clusters.push([store]);
  }
  return clusters;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function currentMinutesInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isQuietHours(settings: QuietHoursSettings, date = new Date()) {
  if (!settings.quiet_hours_enabled) return false;

  const start = timeToMinutes(settings.quiet_hours_start ?? "22:00");
  const end = timeToMinutes(settings.quiet_hours_end ?? "08:00");
  const now = currentMinutesInTimezone(date, settings.timezone ?? "Asia/Seoul");

  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

async function fetchInventory(itemCode: string, latitude: number, longitude: number) {
  const url = new URL(
    "/api/gs25/inventory",
    Deno.env.get("DAISO_API_BASE_URL") ?? "https://mcp.aka.page",
  );
  url.searchParams.set("itemCode", itemCode);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  url.searchParams.set("storeLimit", "50");

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Retryable GS25 inventory API ${response.status}`);
        }
        throw new Error(`GS25 inventory API ${response.status}`);
      }
      const parsed = inventoryResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid GS25 inventory response");
      return parsed.data.data.inventory.stores;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      const retryable =
        message.startsWith("Retryable ") || error instanceof TypeError || error instanceof DOMException;
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GS25 inventory request failed");
}

async function runOwner(
  db: ReturnType<typeof createClient>,
  ownerId: string,
  source: "cron" | "manual",
) {
  const { data: settings, error: settingsError } = await db
    .from("app_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .single();
  if (settingsError) throw settingsError;
  if (!settings.monitoring_enabled && source === "cron") return { skipped: true };

  await db
    .from("check_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: "Stale running check expired before a new run.",
    })
    .eq("owner_id", ownerId)
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 5 * 60_000).toISOString());

  const { data: run, error: runError } = await db
    .from("check_runs")
    .insert({ owner_id: ownerId, source, status: "running" })
    .select("id")
    .single();
  if (runError?.code === "23505") return { skipped: true, reason: "already_running" };
  if (runError) throw runError;

  try {
    const [
      { data: products, error: productsError },
      { data: stores, error: storesError },
    ] = await Promise.all([
      db
        .from("products")
        .select("id,item_code,item_name")
        .eq("owner_id", ownerId)
        .eq("enabled", true)
        .is("archived_at", null)
        .order("id"),
      db
        .from("stores")
        .select("id,store_code,store_name,address,latitude,longitude")
        .eq("owner_id", ownerId)
        .eq("enabled", true)
        .is("archived_at", null)
        .order("id"),
    ]);
    if (productsError) throw productsError;
    if (storesError) throw storesError;

    const activeProducts = (products ?? []) as Product[];
    const activeStores = (stores ?? []) as Store[];
    const storeClusters = clusterStores(activeStores);
    const requestCount = activeProducts.length * storeClusters.length;

    if (requestCount > settings.max_requests_per_run) {
      throw new Error(`요청 수 ${requestCount}회가 실행 한도보다 큽니다.`);
    }

    const { data: recentRuns, error: recentRunsError } = await db
      .from("check_runs")
      .select("requests_made")
      .eq("owner_id", ownerId)
      .eq("status", "succeeded")
      .gte("started_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    if (recentRunsError) throw recentRunsError;

    const recentRequests = (recentRuns ?? []).reduce(
      (sum, recentRun) => sum + recentRun.requests_made,
      0,
    );
    if (recentRequests + requestCount > settings.daily_api_request_budget) {
      throw new Error("24시간 API 요청 예산을 초과합니다.");
    }

    const { data: statuses, error: statusesError } = await db
      .from("stock_status")
      .select("product_id,store_id,quantity")
      .eq("owner_id", ownerId);
    if (statusesError) throw statusesError;

    const previous = new Map(
      (statuses ?? []).map((status) => [
        `${status.product_id}:${status.store_id}`,
        status.quantity,
      ]),
    );

    const { data: destinations, error: destinationsError } = await db
      .from("notification_targets")
      .select("id,type,target_identifier")
      .eq("owner_id", ownerId)
      .eq("enabled", true)
      .is("archived_at", null);
    if (destinationsError) throw destinationsError;

    let checkedStores = 0;

    for (const product of activeProducts) {
      for (const cluster of storeClusters) {
        const inventory = await fetchInventory(
          product.item_code,
          cluster[0].latitude,
          cluster[0].longitude,
        );
        const inventoryByStore = new Map<string, InventoryStore>(
          inventory.map((row) => [row.storeCode, row]),
        );

        for (const store of cluster) {
          const row = inventoryByStore.get(store.store_code);
          if (!row) continue;

          checkedStores += 1;
          const checkedAt = new Date().toISOString();
          const currentQuantity = row.realStockQuantity;
          const statusKey = `${product.id}:${store.id}`;
          const previousQuantity = previous.has(statusKey)
            ? (previous.get(statusKey) ?? null)
            : null;
          const transition = detectStockTransition(
            previousQuantity,
            currentQuantity,
            settings.initial_notification_enabled,
          );

          const { error: statusError } = await db.from("stock_status").upsert(
            {
              owner_id: ownerId,
              product_id: product.id,
              store_id: store.id,
              quantity: currentQuantity,
              pickup_quantity: row.pickupStockQuantity,
              delivery_quantity: row.deliveryStockQuantity,
              is_sold_out: currentQuantity === 0,
              checked_at: checkedAt,
            },
            { onConflict: "product_id,store_id" },
          );
          if (statusError) throw statusError;

          if (transition) {
            const { data: event, error: eventError } = await db
              .from("stock_events")
              .insert({
                owner_id: ownerId,
                product_id: product.id,
                store_id: store.id,
                previous_quantity: previousQuantity,
                current_quantity: currentQuantity,
                event_type: transition.eventType,
              })
              .select("id")
              .single();
            if (eventError) throw eventError;

            const notificationSuppressed = isQuietHours(settings, new Date(checkedAt));

            if (transition.shouldNotify && !notificationSuppressed) {
              let sentCount = 0;

              for (const destination of destinations ?? []) {
                if (destination.type !== "telegram") continue;

                try {
                  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
                  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

                  await new TelegramProvider(token).send(
                    restockMessage(
                      product.item_name,
                      store.store_name,
                      currentQuantity,
                      store.address,
                      checkedAt,
                    ),
                    destination.target_identifier,
                  );

                  const { error: deliveryError } = await db
                    .from("notification_deliveries")
                    .insert({
                      owner_id: ownerId,
                      stock_event_id: event.id,
                      notification_target_id: destination.id,
                      status: "sent",
                      attempt_count: 1,
                      sent_at: checkedAt,
                    });
                  if (deliveryError) throw deliveryError;
                  sentCount += 1;
                } catch (error) {
                  await db.from("notification_deliveries").insert({
                    owner_id: ownerId,
                    stock_event_id: event.id,
                    notification_target_id: destination.id,
                    status: "failed",
                    attempt_count: 1,
                    last_error: error instanceof Error ? error.message : String(error),
                  });
                }
              }

              if (sentCount > 0) {
                const { error: notifiedError } = await db
                  .from("stock_events")
                  .update({ notified: true, notified_at: checkedAt })
                  .eq("id", event.id);
                if (notifiedError) throw notifiedError;
              }
            }
          }

          previous.set(statusKey, currentQuantity);
        }
      }
    }

    const finishedAt = new Date().toISOString();
    await db
      .from("app_settings")
      .update({
        next_check_at: new Date(
          Date.now() + settings.check_interval_minutes * 60_000,
        ).toISOString(),
      })
      .eq("owner_id", ownerId);

    const { error: completionError } = await db
      .from("check_runs")
      .update({
        status: "succeeded",
        finished_at: finishedAt,
        products_checked: activeStores.length > 0 ? activeProducts.length : 0,
        stores_checked: checkedStores,
        requests_made: requestCount,
      })
      .eq("id", run.id);
    if (completionError) throw completionError;

    return {
      runId: run.id,
      products: activeStores.length > 0 ? activeProducts.length : 0,
      stores: checkedStores,
      requests: requestCount,
    };
  } catch (error) {
    await db
      .from("check_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", run.id);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Missing Supabase runtime configuration" }, 500);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const cronSecret = request.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    const isCron = Boolean(
      cronSecret && expectedCronSecret && cronSecret === expectedCronSecret,
    );

    let ownerIds: string[];

    if (isCron) {
      const { data, error } = await db
        .from("app_settings")
        .select("owner_id")
        .eq("monitoring_enabled", true)
        .lte("next_check_at", new Date().toISOString());
      if (error) throw error;
      ownerIds = (data ?? []).map((setting) => setting.owner_id);
    } else {
      const accessToken = request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (!accessToken) return json({ error: "Unauthorized" }, 401);

      const auth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false },
      });
      const { data, error } = await auth.auth.getUser(accessToken);
      if (error || !data.user) return json({ error: "Unauthorized" }, 401);
      ownerIds = [data.user.id];
    }

    const results = [];
    for (const ownerId of ownerIds) {
      try {
        results.push({
          ownerId,
          result: await runOwner(db, ownerId, isCron ? "cron" : "manual"),
        });
      } catch (error) {
        results.push({
          ownerId,
          error: error instanceof Error ? error.message : "Check failed",
        });
      }
    }

    const failed = results.some((result) => "error" in result);
    return json({ ok: !failed, results }, failed ? 500 : 200);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Check failed" },
      500,
    );
  }
});
