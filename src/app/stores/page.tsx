import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/features/auth/require-user";
import { archiveStore, toggleStore } from "@/features/stores/actions";
import { StoreSearch } from "@/features/stores/store-search";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const { supabase, email } = await requireUser();
  const { data: stores } = await supabase.from("stores").select("id,store_code,store_name,address,enabled").is("archived_at", null).order("created_at");

  return (
    <AppShell activeNav="Stores" userEmail={email}>
      <section>
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-emerald-400">Stores</p>
        <h1 className="mt-2 text-2xl font-semibold">감시 매장</h1>
        <p className="mt-2 text-sm text-slate-400">
          매장을 추가하면 모든 활성 상품이 해당 매장에서 자동으로 감시됩니다.
        </p>
      </section>
      <StoreSearch />
      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="divide-y divide-slate-800">
          {(stores ?? []).map((store) => (
            <div key={store.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p>GS25 {store.store_name}</p>
                <p className="truncate text-xs text-slate-500">{store.address} · {store.store_code}</p>
              </div>
              <form action={toggleStore}>
                <input type="hidden" name="id" value={store.id} />
                <input type="hidden" name="enabled" value={String(store.enabled)} />
                <button className="rounded border border-slate-700 px-3 py-1 text-xs">{store.enabled ? "활성" : "비활성"}</button>
              </form>
              <form action={archiveStore}>
                <input type="hidden" name="id" value={store.id} />
                <button className="rounded border border-red-500/30 px-3 py-1 text-xs text-red-300">삭제</button>
              </form>
            </div>
          ))}
          {!stores?.length ? <p className="p-8 text-center text-sm text-slate-500">추가된 매장이 없습니다.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
