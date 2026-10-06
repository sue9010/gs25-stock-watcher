"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/features/auth/require-user";

const MAX_ACTIVE_STORES = 10;

const schema = z.object({
  storeCode: z.string().min(1),
  storeName: z.string().min(1),
  address: z.string().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
});

async function assertStoreSlotAvailable(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  ownerId: string,
  excludeId?: number,
) {
  let query = supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("enabled", true)
    .is("archived_at", null);

  if (excludeId) query = query.neq("id", excludeId);

  const { count, error } = await query;
  if (error) throw new Error("활성 매장 수 확인 실패");
  if ((count ?? 0) >= MAX_ACTIVE_STORES) {
    throw new Error("활성 매장은 최대 10개까지 등록할 수 있습니다.");
  }
}

export async function addStore(formData: FormData) {
  const value = schema.parse(Object.fromEntries(formData));
  const { supabase, ownerId } = await requireUser();

  const { data: existing, error: existingError } = await supabase
    .from("stores")
    .select("id,enabled,archived_at")
    .eq("owner_id", ownerId)
    .eq("store_code", value.storeCode)
    .maybeSingle();
  if (existingError) throw new Error("매장 확인 실패");

  if (!existing || !existing.enabled || existing.archived_at) {
    await assertStoreSlotAvailable(supabase, ownerId, existing?.id);
  }

  const { error } = await supabase.from("stores").upsert(
    {
      owner_id: ownerId,
      store_code: value.storeCode,
      store_name: value.storeName,
      address: value.address,
      latitude: value.latitude,
      longitude: value.longitude,
      enabled: true,
      archived_at: null,
    },
    { onConflict: "owner_id,store_code" },
  );
  if (error) throw new Error(error.message.includes("최대 10개") ? error.message : "매장 추가 실패");

  revalidatePath("/stores");
  revalidatePath("/");
}

export async function toggleStore(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  const { supabase, ownerId } = await requireUser();

  if (!enabled) await assertStoreSlotAvailable(supabase, ownerId, id);

  const { error } = await supabase
    .from("stores")
    .update({ enabled: !enabled })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message.includes("최대 10개") ? error.message : "매장 상태 변경 실패");

  revalidatePath("/stores");
  revalidatePath("/");
}

export async function archiveStore(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const { supabase, ownerId } = await requireUser();
  const { error } = await supabase
    .from("stores")
    .update({ enabled: false, archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw new Error("매장 삭제 실패");

  revalidatePath("/stores");
  revalidatePath("/");
}
