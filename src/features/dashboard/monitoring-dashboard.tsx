"use client";

import { useMemo, useState } from "react";

type StoreStatus = {
  id: number;
  store_code: string;
  store_name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity: number | null;
  checkedAt: string | null;
};

type ProductMonitoring = {
  id: number;
  item_code: string;
  item_name: string;
  stores: StoreStatus[];
};

type MonitoringDashboardProps = {
  products: ProductMonitoring[];
};

const kstFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

function formatCheckedAt(value: string | null) {
  return value ? kstFormatter.format(new Date(value)) : "미조회";
}

function mapUrl(store: StoreStatus) {
  const latDelta = 0.006;
  const lngDelta = 0.008;
  const left = store.longitude - lngDelta;
  const bottom = store.latitude - latDelta;
  const right = store.longitude + lngDelta;
  const top = store.latitude + latDelta;
  const bbox = encodeURIComponent(`${left},${bottom},${right},${top}`);
  const marker = encodeURIComponent(`${store.latitude},${store.longitude}`);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

export function MonitoringDashboard({ products }: MonitoringDashboardProps) {
  const allStores = useMemo(() => {
    const byId = new Map<number, StoreStatus>();
    for (const product of products) {
      for (const store of product.stores) {
        if (!byId.has(store.id)) byId.set(store.id, store);
      }
    }
    return Array.from(byId.values());
  }, [products]);

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(allStores[0]?.id ?? null);
  const selectedStore =
    allStores.find((store) => store.id === selectedStoreId) ?? allStores[0] ?? null;

  if (products.length === 0 || allStores.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-12 text-center">
        <p className="text-sm font-medium text-slate-300">모니터링 중인 항목이 없습니다.</p>
        <p className="mt-1 text-xs text-slate-500">
          Products와 Stores에 활성 항목을 추가하면 자동으로 표시됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        {products.map((product) => (
          <article
            key={product.id}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
          >
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-slate-100">{product.item_name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{product.item_code}</p>
                </div>
                <p className="text-xs text-slate-500">매장 {product.stores.length}곳</p>
              </div>
            </div>

            <div className="grid gap-2 p-4 sm:grid-cols-2 2xl:grid-cols-3">
              {product.stores.map((store) => {
                const isSelected = selectedStore?.id === store.id;
                const hasStock = store.quantity !== null && store.quantity > 0;
                const isOutOfStock = store.quantity === 0;

                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-400/5"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`truncate text-sm font-medium ${
                          isOutOfStock ? "text-slate-500" : "text-slate-200"
                        }`}
                      >
                        GS25 {store.store_name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          hasStock
                            ? "bg-emerald-500/10 text-emerald-300"
                            : isOutOfStock
                              ? "bg-slate-800 text-slate-500"
                              : "bg-slate-800/70 text-slate-600"
                        }`}
                      >
                        {store.quantity === null ? "미조회" : `${store.quantity}개`}
                      </span>
                    </div>
                    <p
                      className={`mt-2 truncate text-xs ${
                        isOutOfStock ? "text-slate-700" : "text-slate-500"
                      }`}
                    >
                      {store.address}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      마지막 조회 {formatCheckedAt(store.checkedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Store map
            </p>
            <h2 className="mt-1 font-semibold text-slate-100">
              {selectedStore ? `GS25 ${selectedStore.store_name}` : "매장 위치"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selectedStore?.address ?? "왼쪽에서 매장을 선택하세요."}
            </p>
          </div>

          {selectedStore ? (
            <iframe
              key={selectedStore.id}
              title={`GS25 ${selectedStore.store_name} 위치`}
              src={mapUrl(selectedStore)}
              className="h-[430px] w-full border-0 bg-slate-950"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-[430px] items-center justify-center text-sm text-slate-600">
              표시할 매장이 없습니다.
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
