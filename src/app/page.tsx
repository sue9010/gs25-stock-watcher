import { AppShell } from "@/components/app-shell";
import { checkNow } from "@/features/inventory/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const architecture = [
  ["Web", "Next.js 16 · Vercel"],
  ["Data", "Supabase PostgreSQL · RLS"],
  ["Worker", "Supabase Edge Functions · Cron"],
  ["Source", "daiso-mcp GS25 HTTP API"],
  ["Notify", "Telegram adapter"],
] as const;

const kstFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatKst(value: string | undefined) {
  return value ? kstFormatter.format(new Date(value)) : "아직 실행되지 않음";
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const [settings, products, stores, inStock, lastRun, inStockRows, recentRestocks] = await Promise.all([
    supabase
      .from("app_settings")
      .select("monitoring_enabled, check_interval_minutes, next_check_at")
      .maybeSingle(),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .is("archived_at", null),
    supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true)
      .is("archived_at", null),
    supabase
      .from("stock_status")
      .select(
        "product_id,products!inner(enabled,archived_at),stores!inner(enabled,archived_at)",
        { count: "exact", head: true },
      )
      .gt("quantity", 0)
      .eq("products.enabled", true)
      .is("products.archived_at", null)
      .eq("stores.enabled", true)
      .is("stores.archived_at", null),
    supabase
      .from("check_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("stock_status")
      .select(
        "quantity,checked_at,products!inner(item_name,enabled,archived_at),stores!inner(store_name,address,enabled,archived_at)",
      )
      .gt("quantity", 0)
      .eq("products.enabled", true)
      .is("products.archived_at", null)
      .eq("stores.enabled", true)
      .is("stores.archived_at", null)
      .order("checked_at", { ascending: false })
      .limit(10),
    supabase
      .from("stock_events")
      .select("id,current_quantity,created_at,products(item_name),stores(store_name)")
      .eq("event_type", "restocked")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const queryError = [settings, products, stores, inStock, lastRun, inStockRows, recentRestocks].find(
    (result) => result.error,
  )?.error;

  const monitoringEnabled = settings.data?.monitoring_enabled ?? false;
  const activeProductCount = products.count ?? 0;
  const activeStoreCount = stores.count ?? 0;
  const watchCombinationCount = activeProductCount * activeStoreCount;
  const metrics = [
    { label: "모니터링", value: monitoringEnabled ? "ON" : "OFF" },
    { label: "활성 상품", value: String(activeProductCount) },
    { label: "활성 매장", value: String(activeStoreCount) },
    { label: "감시 조합", value: String(watchCombinationCount) },
  ] as const;

  const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : "사용자";
  const inventoryRows = (inStockRows.data ?? []) as unknown as Array<{
    quantity: number;
    checked_at: string;
    products: { item_name: string } | null;
    stores: { store_name: string; address: string } | null;
  }>;
  const restockRows = (recentRestocks.data ?? []) as unknown as Array<{
    id: number;
    current_quantity: number;
    created_at: string;
    products: { item_name: string } | null;
    stores: { store_name: string } | null;
  }>;

  return (
    <AppShell activeNav="Dashboard" userEmail={email}>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Live operations
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              GS25 재고 모니터링 대시보드
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              활성 상품과 활성 매장의 모든 조합을 자동으로 감시하고, 현재 재고와 최근 입고 이벤트를 한 곳에서 확인합니다.
            </p>
          </div>
          <form action={checkNow}><button type="submit" className="h-10 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950">지금 조회</button></form>
        </div>
      </section>

      <section aria-label="모니터링 요약" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-200">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold text-slate-100">운영 연결 상태</h2>
            <p className="mt-1 text-xs text-slate-500">운영 구성요소의 연결 상태입니다.</p>
          </div>
          <div className="divide-y divide-slate-800">
            {architecture.map(([label, value], index) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold text-slate-400">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="truncate text-sm font-medium text-slate-200">{value}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  연결됨
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-slate-100">현재 상태</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            재고 보유 조합 {inStock.count ?? 0}개 · 조회 주기 {settings.data?.check_interval_minutes ?? 10}분
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            마지막 조회: {formatKst(lastRun.data?.started_at)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            다음 예상 조회: {monitoringEnabled ? formatKst(settings.data?.next_check_at) : "모니터링 OFF"}
          </p>
          {queryError ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
              Dashboard 데이터를 불러오지 못했습니다: {queryError.message}
            </p>
          ) : null}
          <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Safety baseline</p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
              <li>• Service role key는 browser에 전달하지 않음</li>
              <li>• Telegram token은 Supabase Secret에만 저장</li>
              <li>• 외부 응답을 검증한 뒤 상태에 반영</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-slate-100">현재 재고가 있는 조합</h2>
          <div className="mt-3 space-y-2">
            {inventoryRows.map((row) => (
              <div key={`${row.products?.item_name}:${row.stores?.store_name}`} className="rounded-lg border border-slate-800 p-3 text-sm">
                <p className="font-medium text-slate-200">{row.products?.item_name}</p>
                <p className="mt-1 text-slate-400">GS25 {row.stores?.store_name} · {row.quantity}개</p>
                <p className="mt-1 truncate text-xs text-slate-600">{row.stores?.address}</p>
              </div>
            ))}
            {!inventoryRows.length ? <p className="text-sm text-slate-500">현재 확인된 재고가 없습니다.</p> : null}
          </div>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-slate-100">최근 입고 이벤트</h2>
          <div className="mt-3 space-y-2">
            {restockRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                <p className="font-medium text-slate-200">{row.products?.item_name}</p>
                <p className="mt-1 text-slate-400">GS25 {row.stores?.store_name} · {row.current_quantity}개</p>
                <p className="mt-1 text-xs text-slate-600">{formatKst(row.created_at)}</p>
              </div>
            ))}
            {!restockRows.length ? <p className="text-sm text-slate-500">최근 입고 이벤트가 없습니다.</p> : null}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
