import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/features/auth/require-user";

const formatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const productId = typeof filters.product === "string" ? filters.product : "";
  const storeId = typeof filters.store === "string" ? filters.store : "";
  const eventType = typeof filters.eventType === "string" ? filters.eventType : "";
  const dateFrom = typeof filters.dateFrom === "string" ? filters.dateFrom : "";
  const dateTo = typeof filters.dateTo === "string" ? filters.dateTo : "";
  const { supabase, email } = await requireUser();

  let eventsQuery = supabase
    .from("stock_events")
    .select("id,event_type,previous_quantity,current_quantity,notified,created_at,products(item_name),stores(store_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (/^\d+$/.test(productId)) eventsQuery = eventsQuery.eq("product_id", Number(productId));
  if (/^\d+$/.test(storeId)) eventsQuery = eventsQuery.eq("store_id", Number(storeId));
  if (["initial", "restocked", "changed", "sold_out"].includes(eventType)) eventsQuery = eventsQuery.eq("event_type", eventType);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) eventsQuery = eventsQuery.gte("created_at", `${dateFrom}T00:00:00+09:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) eventsQuery = eventsQuery.lt("created_at", `${dateTo}T23:59:59.999+09:00`);

  const [events, runs, products, stores] = await Promise.all([
    eventsQuery,
    supabase.from("check_runs").select("id,source,status,started_at,products_checked,stores_checked,requests_made,error_message").order("started_at", { ascending: false }).limit(100),
    supabase.from("products").select("id,item_name").is("archived_at", null).order("item_name"),
    supabase.from("stores").select("id,store_name").is("archived_at", null).order("store_name"),
  ]);
  const eventRows = (events.data ?? []) as unknown as Array<{
    id: number;
    event_type: string;
    previous_quantity: number | null;
    current_quantity: number;
    created_at: string;
    products: { item_name: string } | null;
    stores: { store_name: string } | null;
  }>;

  return (
    <AppShell activeNav="History" userEmail={email}>
      <section><h1 className="text-2xl font-semibold">History</h1></section>
      <form className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 md:grid-cols-5">
        <select name="product" defaultValue={productId} className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm">
          <option value="">모든 상품</option>
          {products.data?.map((product) => <option key={product.id} value={product.id}>{product.item_name}</option>)}
        </select>
        <select name="store" defaultValue={storeId} className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm">
          <option value="">모든 매장</option>
          {stores.data?.map((store) => <option key={store.id} value={store.id}>{store.store_name}</option>)}
        </select>
        <select name="eventType" defaultValue={eventType} className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm">
          <option value="">모든 이벤트</option>
          <option value="initial">initial</option><option value="restocked">restocked</option>
          <option value="changed">changed</option><option value="sold_out">sold_out</option>
        </select>
        <div className="grid grid-cols-2 gap-2"><input aria-label="시작일" name="dateFrom" type="date" defaultValue={dateFrom} className="h-10 min-w-0 rounded border border-slate-700 bg-slate-950 px-2 text-xs"/><input aria-label="종료일" name="dateTo" type="date" defaultValue={dateTo} className="h-10 min-w-0 rounded border border-slate-700 bg-slate-950 px-2 text-xs"/></div>
        <button className="h-10 rounded bg-emerald-400 px-4 text-sm font-semibold text-slate-950">필터 적용</button>
      </form>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="font-semibold">재고 변화</h2>
        <div className="mt-3 space-y-2">
          {eventRows.map((event) => <div key={event.id} className="grid gap-1 rounded border border-slate-800 p-3 text-sm sm:grid-cols-[1fr_auto_auto]"><p>{event.products?.item_name} · GS25 {event.stores?.store_name}</p><p>{event.previous_quantity ?? "-"} → {event.current_quantity} ({event.event_type})</p><p className="text-slate-500">{formatter.format(new Date(event.created_at))}</p></div>)}
          {!eventRows.length ? <p className="text-sm text-slate-500">조건에 맞는 이력이 없습니다.</p> : null}
        </div>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="font-semibold">조회 실행</h2>
        <div className="mt-3 space-y-2">
          {(runs.data ?? []).map((run) => <div key={run.id} className="flex flex-wrap gap-3 rounded border border-slate-800 p-3 text-sm"><span>{run.status}</span><span>{run.source}</span><span>상품 {run.products_checked}</span><span>매장 {run.stores_checked}</span><span>요청 {run.requests_made}</span><span className="text-slate-500">{formatter.format(new Date(run.started_at))}</span>{run.error_message ? <span className="text-red-300">{run.error_message}</span> : null}</div>)}
          {!runs.data?.length ? <p className="text-sm text-slate-500">실행 이력이 없습니다.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
