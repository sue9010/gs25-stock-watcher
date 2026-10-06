import { z } from "zod";

const storeSchema = z.object({
  storeCode: z.string().min(1), storeName: z.string().min(1), address: z.string().min(1),
  latitude: z.number(), longitude: z.number(), distanceM: z.number().nonnegative(),
});
const responseSchema = z.object({ success: z.literal(true), data: z.object({ stores: z.array(storeSchema) }) });
export const storeSearchQuerySchema = z.object({ keyword: z.string().trim().min(2).max(50), limit: z.coerce.number().int().min(1).max(20).default(10) });
export type Gs25Store = z.infer<typeof storeSchema>;

export async function searchGs25Stores(keyword: string, limit: number) {
  const url = new URL("/api/gs25/stores", process.env.DAISO_API_BASE_URL ?? "https://mcp.aka.page");
  url.searchParams.set("keyword", keyword); url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`GS25 store API ${response.status}`);
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Invalid GS25 store response");
  return parsed.data.data.stores;
}
