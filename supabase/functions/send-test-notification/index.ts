import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";

import { TelegramProvider } from "../_shared/telegram.ts";

const requestSchema = z.object({ targetId: z.number().int().positive() });

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return new Response("Server configuration missing", { status: 500 });

  const auth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
  const { data, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !data.user) return new Response("Unauthorized", { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: target, error: targetError } = await db.from("notification_targets")
    .select("type,target_identifier")
    .eq("id", parsed.data.targetId)
    .eq("owner_id", data.user.id)
    .eq("enabled", true)
    .is("archived_at", null)
    .single();
  if (targetError || !target || target.type !== "telegram") return new Response("Not found", { status: 404 });

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) return new Response("Telegram secret missing", { status: 503 });

  try {
    await new TelegramProvider(botToken).send(
      "<b>[GS25 Stock Watcher]</b>\n\n테스트 알림이 정상적으로 전송되었습니다.",
      target.target_identifier,
    );
    return Response.json({ ok: true });
  } catch {
    return new Response("Telegram send failed", { status: 502 });
  }
});
