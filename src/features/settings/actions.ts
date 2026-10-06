"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/features/auth/require-user";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const schema = z
  .object({
    monitoringEnabled: z.enum(["true", "false"]),
    initialNotificationEnabled: z.enum(["true", "false"]),
    quietHoursEnabled: z.enum(["true", "false"]),
    quietHoursStart: timeSchema,
    quietHoursEnd: timeSchema,
  })
  .refine((value) => value.quietHoursStart !== value.quietHoursEnd, {
    message: "방해금지 시작 시간과 종료 시간은 달라야 합니다.",
    path: ["quietHoursEnd"],
  });

export async function updateSettings(formData: FormData) {
  const value = schema.parse({
    monitoringEnabled: formData.get("monitoringEnabled"),
    initialNotificationEnabled: formData.get("initialNotificationEnabled"),
    quietHoursEnabled: formData.get("quietHoursEnabled"),
    quietHoursStart: formData.get("quietHoursStart"),
    quietHoursEnd: formData.get("quietHoursEnd"),
  });

  const { supabase, ownerId } = await requireUser();
  const { error } = await supabase
    .from("app_settings")
    .update({
      monitoring_enabled: value.monitoringEnabled === "true",
      initial_notification_enabled: value.initialNotificationEnabled === "true",
      quiet_hours_enabled: value.quietHoursEnabled === "true",
      quiet_hours_start: value.quietHoursStart,
      quiet_hours_end: value.quietHoursEnd,
      check_interval_minutes: 30,
      daily_api_request_budget: 2200,
      max_requests_per_run: 40,
    })
    .eq("owner_id", ownerId);

  if (error) throw new Error("설정 저장 실패");

  revalidatePath("/settings");
  revalidatePath("/");
}
