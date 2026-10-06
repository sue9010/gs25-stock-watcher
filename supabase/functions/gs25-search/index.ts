import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { z } from "npm:zod@4.6.5";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("products"), keyword: z.string().trim().min(2).max(50), limit: z.number().int().min(1).max(20) }),
  z.object({ kind: z.literal("stores"), keyword: z.string().trim().min(2).max(50), limit: z.number().int().min(1).max(20) }),
]);
const productResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ products: z.array(z.object({
    itemCode: z.string().min(1),
    itemName: z.string().min(1),
    imageUrl: z.string().optional().default(""),
  })) }),
});
const storeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ stores: z.array(z.object({
    storeCode: z.string().min(1),
    storeName: z.string().min(1),
    address: z.string().min(1),
    latitude: z.number(),
    longitude: z.number(),
    distanceM: z.number().nonnegative(),
  })) }),
});

async function fetchWithRetry(url: URL) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) throw new Error(`GS25 API ${response.status}`);
      throw new Error(`Retryable GS25 API ${response.status}`);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      const retryable = message.startsWith("Retryable ") || error instanceof TypeError || error instanceof DOMException;
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("GS25 API request failed");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return new Response("Unauthorized", { status: 401 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return new Response("Server configuration missing", { status: 500 });
  const auth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const upstreamUrl = new URL(
      parsed.data.kind === "products" ? "/api/gs25/products" : "/api/gs25/stores",
      Deno.env.get("DAISO_API_BASE_URL") ?? "https://mcp.aka.page",
    );
    upstreamUrl.searchParams.set("keyword", parsed.data.keyword);
    upstreamUrl.searchParams.set("limit", String(parsed.data.limit));
    const upstream = await fetchWithRetry(upstreamUrl);
    const body = await upstream.json();
    if (parsed.data.kind === "products") {
      const validated = productResponseSchema.safeParse(body);
      if (!validated.success) throw new Error("Invalid GS25 products response");
      return Response.json({ products: validated.data.data.products });
    }
    const validated = storeResponseSchema.safeParse(body);
    if (!validated.success) throw new Error("Invalid GS25 stores response");
    return Response.json({ stores: validated.data.data.stores });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "GS25 search failed" }, { status: 502 });
  }
});
