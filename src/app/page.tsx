import { AppShell } from "@/components/app-shell";
import { MonitoringDashboard } from "@/features/dashboard/monitoring-dashboard";
import { checkNow } from "@/features/inventory/actions";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Product = {
  id: number;
  item_name: string;
};

type Store = {
  id: number;
  store_name: string;
  latitude: number;
  longitude: number;
};

type StockStatus = {
  product_id: number;
  store_id: number;
  quantity: number;
};

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const [productsResult, storesResult, statusesResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,item_name")
      .eq("enabled", true)
      .is("archived_at", null)
      .order("item_name"),
    supabase
      .from("stores")
      .select("id,store_name,latitude,longitude")
      .eq("enabled", true)
      .is("archived_at", null)
      .order("store_name"),
    supabase
      .from("stock_status")
      .select("product_id,store_id,quantity"),
  ]);

  const queryError = productsResult.error ?? storesResult.error ?? statusesResult.error;
  const products = (productsResult.data ?? []) as Product[];
  const stores = (storesResult.data ?? []) as Store[];
  const statuses = (statusesResult.data ?? []) as StockStatus[];

  const statusByCombination = new Map(
    statuses.map((status) => [`${status.product_id}:${status.store_id}`, status]),
  );

  const monitoringProducts = products.map((product) => ({
    ...product,
    stores: stores.map((store) => {
      const status = statusByCombination.get(`${product.id}:${store.id}`) ?? null;

      return {
        ...store,
        quantity: status?.quantity ?? null,
      };
    }),
  }));

  const email =
    typeof claimsData.claims.email === "string" ? claimsData.claims.email : "사용자";

  return (
    <AppShell activeNav="Dashboard" userEmail={email}>
      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Monitoring
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
            GS25 재고 모니터링
          </h1>
        </div>

        <form action={checkNow}>
          <button
            type="submit"
            className="h-9 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            지금 조회
          </button>
        </form>
      </section>

      {queryError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
        >
          데이터를 불러오지 못했습니다: {queryError.message}
        </p>
      ) : (
        <MonitoringDashboard products={monitoringProducts} />
      )}
    </AppShell>
  );
}
