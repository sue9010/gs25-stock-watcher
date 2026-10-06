import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/features/auth/require-user";
import { archiveProduct, toggleProduct } from "@/features/products/actions";
import { ProductSearch } from "@/features/products/product-search";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, email } = await requireUser();
  const { data: products } = await supabase.from("products").select("id,item_code,item_name,enabled").is("archived_at", null).order("created_at");

  return (
    <AppShell activeNav="Products" userEmail={email}>
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
          Live product search
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Products</h1>
        <p className="mt-2 text-sm text-slate-400">
          상품명으로 GS25 상품을 검색해 추가합니다. 활성 상품은 모든 활성 매장에서 자동으로 감시됩니다.
        </p>
      </section>
      <ProductSearch />
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4"><h2 className="font-semibold">감시 상품</h2></div>
        <div className="divide-y divide-slate-800">
          {(products ?? []).map((product) => (
            <div key={product.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{product.item_name}</p><p className="text-xs text-slate-500">{product.item_code}</p></div>
              <form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="enabled" value={String(product.enabled)} /><button className="rounded border border-slate-700 px-3 py-1 text-xs">{product.enabled ? "활성" : "비활성"}</button></form>
              <form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><button className="rounded border border-red-500/30 px-3 py-1 text-xs text-red-300">삭제</button></form>
            </div>
          ))}
          {!products?.length ? <p className="px-5 py-8 text-center text-sm text-slate-500">추가된 상품이 없습니다.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
