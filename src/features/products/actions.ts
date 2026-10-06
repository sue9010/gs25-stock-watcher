"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/features/auth/require-user";

const productSchema = z.object({
  itemCode: z.string().trim().min(1).max(64),
  itemName: z.string().trim().min(1).max(200),
});

const idSchema = z.coerce.number().int().positive();

export async function addProduct(formData: FormData) {
  const input = productSchema.parse({
    itemCode: formData.get("itemCode"),
    itemName: formData.get("itemName"),
  });
  const { supabase, ownerId } = await requireUser();
  const { error } = await supabase.from("products").upsert(
    { owner_id: ownerId, item_code: input.itemCode, item_name: input.itemName, enabled: true, archived_at: null },
    { onConflict: "owner_id,item_code" },
  );
  if (error) throw new Error("상품을 추가하지 못했습니다.");
  revalidatePath("/products");
}

export async function toggleProduct(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  const { supabase, ownerId } = await requireUser();
  const { error } = await supabase.from("products").update({ enabled: !enabled }).eq("id", id).eq("owner_id", ownerId);
  if (error) throw new Error("상품 상태를 변경하지 못했습니다.");
  revalidatePath("/products");
}

export async function archiveProduct(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, ownerId } = await requireUser();
  const { error } = await supabase.from("products").update({ enabled: false, archived_at: new Date().toISOString() }).eq("id", id).eq("owner_id", ownerId);
  if (error) throw new Error("상품을 삭제하지 못했습니다.");
  revalidatePath("/products");
}
