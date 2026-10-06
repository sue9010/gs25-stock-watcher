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

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
          <p className="font-medium text-emerald-300">자동 조회: 매시 정각 / 30분</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            조회 주기는 30분으로 고정됩니다. 수동 “지금 조회”를 실행해도 다음 정각/30분 자동 조회 일정은 밀리지 않습니다.
          </p>
        </div>

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
            방해금지 시간에도 조회와 이벤트 기록은 계속되지만 Telegram 알림은 보내지 않습니다.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 p-4">
          <p className="text-sm font-medium">공개 API 안전 제한</p>
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-500">
            <li>• 활성 매장: 최대 10개</li>
            <li>• 실행당 재고 API 요청: 최대 {data?.max_requests_per_run ?? 40}회</li>
            <li>• 재고조회 24시간 예산: 최대 {data?.daily_api_request_budget ?? 2200}회</li>
            <li>• 상품 4개 × 매장 10개가 모두 별도 cluster인 최악의 경우: 40회/실행</li>
            <li>• 30분 주기 48회/일 × 40회 = 최대 1,920회/일</li>
            <li>• daiso-mcp 공개 GET API 전체 한도 3,000회/일 중 검색 등 다른 호출을 위한 여유를 남깁니다.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-600">Timezone: {data?.timezone ?? "Asia/Seoul"}</p>
        </div>

        <button className="rounded bg-emerald-400 px-5 py-2 font-semibold text-slate-950">저장</button>
      </form>
    </AppShell>
  );
}
