import { z } from "zod";

export const inventoryStoreSchema = z.object({
  storeCode: z.string().min(1), storeName: z.string().min(1), address: z.string().min(1),
  latitude: z.number(), longitude: z.number(), realStockQuantity: z.number().int().nonnegative(),
  pickupStockQuantity: z.number().int().nonnegative().nullable(), deliveryStockQuantity: z.number().int().nonnegative().nullable(),
  isSoldOut: z.boolean(), distanceM: z.number().nonnegative(),
});
const responseSchema = z.object({ success: z.literal(true), data: z.object({ inventory: z.object({ stores: z.array(inventoryStoreSchema) }) }) });
export type InventoryStore = z.infer<typeof inventoryStoreSchema>;

export async function fetchGs25Inventory(itemCode: string, latitude: number, longitude: number, storeLimit = 50) {
  const url = new URL("/api/gs25/inventory", process.env.DAISO_API_BASE_URL ?? "https://mcp.aka.page");
  url.searchParams.set("itemCode", itemCode); url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude)); url.searchParams.set("storeLimit", String(storeLimit));
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt)); continue; }
        throw new Error(`GS25 inventory API ${response.status}`);
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Invalid GS25 inventory response");
      return parsed.data.data.inventory.stores;
    } catch (error) { lastError = error; if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt)); }
  }
  throw lastError instanceof Error ? lastError : new Error("GS25 inventory request failed");
}
