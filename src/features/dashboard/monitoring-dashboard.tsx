"use client";

import { useMemo, useState } from "react";

type StoreStatus = {
  id: number;
  store_name: string;
  latitude: number;
  longitude: number;
  quantity: number | null;
};

type ProductMonitoring = {
  id: number;
  item_name: string;
  stores: StoreStatus[];
};

type MonitoringDashboardProps = {
  products: ProductMonitoring[];
};

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

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(
    allStores[0]?.id ?? null,
  );

  const selectedStore =
    allStores.find((store) => store.id === selectedStoreId) ?? allStores[0] ?? null;

  if (products.length === 0 || allStores.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-12 text-center">
        <p className="text-sm font-medium text-slate-300">모니터링 중인 항목이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid content-start gap-4 md:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <h2 className="mb-4 font-semibold text-slate-100">{product.item_name}</h2>

            <div className="space-y-1.5">
              {product.stores.map((store) => {
                const isSelected = selectedStore?.id === store.id;
                const isOutOfStock = store.quantity === 0;
                const hasStock = store.quantity !== null && store.quantity > 0;

                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedStoreId(store.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isSelected
                        ? "bg-emerald-400/10"
                        : "hover:bg-slate-800/70"
                    }`}
                  >
                    <span
                      className={`truncate text-sm ${
                        isOutOfStock
                          ? "text-slate-600"
                          : isSelected
                            ? "font-medium text-emerald-300"
                            : "text-slate-300"
                      }`}
                    >
                      GS25 {store.store_name}
                    </span>

                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        hasStock
                          ? "text-emerald-300"
                          : isOutOfStock
                            ? "text-slate-600"
                            : "text-slate-500"
                      }`}
                    >
                      {store.quantity === null ? "미조회" : `${store.quantity}개`}
                    </span>
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
            <h2 className="font-semibold text-slate-100">
              {selectedStore ? `GS25 ${selectedStore.store_name}` : "매장 위치"}
            </h2>
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
