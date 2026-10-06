import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/features/auth/require-user";
import { updateSettings } from "@/features/settings/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, email } = await requireUser();
  const { data } = await supabase
    .from("app_settings")
    .select(
      "monitoring_enabled,initial_notification_enabled,check_interval_minutes,daily_api_request_budget,max_requests_per_run,timezone,quiet_hours_enabled,quiet_hours_start,quiet_hours_end",
    )
    .single();

  return (
    <AppShell activeNav="Settings" userEmail={email}>
      <section>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </section>

      <form action={updateSettings} className="max-w-xl space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-sm">
          모니터링
          <select
            name="monitoringEnabled"
            defaultValue={String(data?.monitoring_enabled ?? false)}
            className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
          >
            <option value="true">ON</option>
            <option value="false">OFF</option>
          </select>
        </label>

        <label className="block text-sm">
          조회 주기(분)
          <input
            name="checkIntervalMinutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={data?.check_interval_minutes ?? 10}
            className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
          />
        </label>

        <label className="block text-sm">
          초기 재고 알림
          <select
            name="initialNotificationEnabled"
            defaultValue={String(data?.initial_notification_enabled ?? false)}
            className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
          >
            <option value="false">OFF (권장)</option>
            <option value="true">ON</option>
          </select>
          <span className="mt-2 block text-xs text-slate-500">
            OFF이면 최초 조회는 initial 이벤트만 기록하고 알림을 보내지 않습니다.
          </span>
        </label>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <label className="block text-sm">
            방해금지 시간
            <select
              name="quietHoursEnabled"
              defaultValue={String(data?.quiet_hours_enabled ?? false)}
              className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
            >
              <option value="false">OFF</option>
              <option value="true">ON</option>
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block text-sm">
              시작
              <input
                name="quietHoursStart"
                type="time"
                defaultValue={(data?.quiet_hours_start ?? "22:00").slice(0, 5)}
                className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
              />
            </label>
            <label className="block text-sm">
              종료
              <input
                name="quietHoursEnd"
                type="time"
                defaultValue={(data?.quiet_hours_end ?? "08:00").slice(0, 5)}
                className="mt-2 h-10 w-full rounded border border-slate-700 bg-slate-950 px-3"
              />
            </label>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            방해금지 시간에도 재고 조회와 이벤트 기록은 계속됩니다. 다만 Telegram 알림은 보내지 않으며,
            종료 후에 밀린 알림을 다시 보내지도 않습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <p>Timezone: {data?.timezone ?? "Asia/Seoul"}</p>
          <p>24시간 API 예산: {data?.daily_api_request_budget ?? 2400}</p>
          <p>실행당 최대 요청: {data?.max_requests_per_run ?? 12}</p>
        </div>

        <button className="rounded bg-emerald-400 px-5 py-2 font-semibold text-slate-950">저장</button>
      </form>
    </AppShell>
  );
}
