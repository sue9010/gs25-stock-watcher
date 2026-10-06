import { AppShell } from "@/components/app-shell";
import { checkNow } from "@/features/inventory/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const kstFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

type Product = {
  id: number;
  item_code: string;
  item_name: string;
};

type Store = {
  id: number;
  store_code: string;
  store_name: string;
  address: string;
};

type StockStatus = {
  product_id: number;
  store_id: number;
  quantity: number;
  checked_at: string;
};

function formatKst(value: string | null | undefined) {
  return value ? kstFormatter.format(new Date(value)) : "아직 조회되지 않음";
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const [productsResult, storesResult, statusesResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,item_code,item_name")
      .eq("enabled", true)
      .is("archived_at", null)
      .order("item_name"),
    supabase
      .from("stores")
      .select("id,store_code,store_name,address")
      .eq("enabled", true)
      .is("archived_at", null)
      .order("store_name"),
    supabase
      .from("stock_status")
      .select("product_id,store_id,quantity,checked_at"),
  ]);

  const queryError = productsResult.error ?? storesResult.error ?? statusesResult.error;
  const products = (productsResult.data ?? []) as Product[];
  const stores = (storesResult.data ?? []) as Store[];
  const statuses = (statusesResult.data ?? []) as StockStatus[];

  const statusByCombination = new Map(
    statuses.map((status) => [`${status.product_id}:${status.store_id}`, status]),
  );

  const monitoringRows = products.flatMap((product) =>
    stores.map((store) => ({
      product,
      store,
      status: statusByCombination.get(`${product.id}:${store.id}`) ?? null,
    })),
  );

  const email =
    typeof claimsData.claims.email === "string" ? claimsData.claims.email : "사용자";

  return (
    <AppShell activeNav="Dashboard" userEmail={email}>
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Monitoring
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            GS25 재고 모니터링
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            활성 상품과 활성 매장의 모든 조합을 자동으로 조회합니다.
          </p>
        </div>

        <form action={checkNow}>
          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 sm:w-auto"
          >
            지금 조회
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-1 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-100">모니터링 중인 재고</h2>
            <p className="mt-1 text-xs text-slate-500">
              상품 {products.length}개 × 매장 {stores.length}개 · 총 {monitoringRows.length}개 조합
            </p>
          </div>
        </div>

        {queryError ? (
          <p
            role="alert"
            className="m-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
          >
            데이터를 불러오지 못했습니다: {queryError.message}
          </p>
        ) : null}

        {!queryError && monitoringRows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-300">모니터링 중인 조합이 없습니다.</p>
            <p className="mt-1 text-xs text-slate-500">
              Products와 Stores에 각각 활성 항목을 추가하면 자동으로 표시됩니다.
            </p>
          </div>
        ) : null}

        {!queryError && monitoringRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">상품</th>
                  <th className="px-5 py-3 font-medium">매장</th>
                  <th className="px-5 py-3 font-medium">마지막 재고</th>
                  <th className="px-5 py-3 font-medium">마지막 조회</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {monitoringRows.map(({ product, store, status }) => (
                  <tr key={`${product.id}:${store.id}`} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-100">{product.item_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.item_code}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-200">GS25 {store.store_name}</p>
                      <p className="mt-1 max-w-md text-xs text-slate-500">{store.address}</p>
                    </td>
                    <td className="px-5 py-4">
                      {status ? (
                        <span
                          className={`inline-flex min-w-16 justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
                            status.quantity > 0
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          {status.quantity}개
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">미조회</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-400">
                      {formatKst(status?.checked_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
