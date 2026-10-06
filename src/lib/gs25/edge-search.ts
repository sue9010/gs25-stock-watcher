import { z } from "zod";

import type { Gs25Product } from "@/lib/gs25/products";
import type { Gs25Store } from "@/lib/gs25/stores";
import { getSupabasePublicEnv } from "@/lib/supabase/config";

const productsSchema = z.object({ products: z.array(z.object({
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  imageUrl: z.string(),
})) });
const storesSchema = z.object({ stores: z.array(z.object({
  storeCode: z.string().min(1),
  storeName: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  distanceM: z.number().nonnegative(),
})) });

async function invokeSearch(body: object, accessToken: string) {
  const { url, publishableKey } = getSupabasePublicEnv();
  return fetch(`${url}/functions/v1/gs25-search`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
}

export async function searchProductsThroughEdge(keyword: string, limit: number, accessToken: string): Promise<Gs25Product[]> {
  const response = await invokeSearch({ kind: "products", keyword, limit }, accessToken);
  if (!response.ok) throw new Error(`GS25 Edge search ${response.status}`);
  const parsed = productsSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Invalid GS25 Edge product response");
  return parsed.data.products;
}

export async function searchStoresThroughEdge(keyword: string, limit: number, accessToken: string): Promise<Gs25Store[]> {
  const response = await invokeSearch({ kind: "stores", keyword, limit }, accessToken);
  if (!response.ok) throw new Error(`GS25 Edge search ${response.status}`);
  const parsed = storesSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Invalid GS25 Edge store response");
  return parsed.data.stores;
}
