"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

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

type KakaoLatLng = object;

type KakaoMap = {
  setCenter: (position: KakaoLatLng) => void;
  setLevel: (level: number) => void;
};

type KakaoMarker = {
  setPosition: (position: KakaoLatLng) => void;
  setMap: (map: KakaoMap) => void;
};

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: {
    position: KakaoLatLng;
    map?: KakaoMap;
  }) => KakaoMarker;
};

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsApi;
    };
  }
}

const kakaoAppKey = process.env.NEXT_KAKAO_MAP_APP_KEY ?? "";

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
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerRef = useRef<KakaoMarker | null>(null);

  const selectedStore =
    allStores.find((store) => store.id === selectedStoreId) ?? allStores[0] ?? null;

  function initializeMap() {
    if (!selectedStore || !mapContainerRef.current || !window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      if (!mapContainerRef.current || !window.kakao?.maps) return;

      const position = new window.kakao.maps.LatLng(
        selectedStore.latitude,
        selectedStore.longitude,
      );

      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center: position,
        level: 4,
      });

      const marker = new window.kakao.maps.Marker({
        position,
        map,
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);
    });
  }

  useEffect(() => {
    if (!mapReady || !selectedStore || !window.kakao?.maps || !mapRef.current) return;

    const position = new window.kakao.maps.LatLng(
      selectedStore.latitude,
      selectedStore.longitude,
    );

    mapRef.current.setCenter(position);
    mapRef.current.setLevel(4);
    markerRef.current?.setPosition(position);
    markerRef.current?.setMap(mapRef.current);
  }, [mapReady, selectedStore]);

  if (products.length === 0 || allStores.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">모니터링 중인 항목이 없습니다.</p>
      </section>
    );
  }

  return (
    <>
      {kakaoAppKey ? (
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoAppKey}&autoload=false`}
          strategy="afterInteractive"
          onLoad={initializeMap}
        />
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <h2 className="mb-2.5 text-sm font-semibold text-slate-100">
                {product.item_name}
              </h2>

              <div className="flex flex-wrap gap-1.5">
                {product.stores.map((store) => {
                  const selected = selectedStore?.id === store.id;
                  const outOfStock = store.quantity === 0;
                  const hasStock = store.quantity !== null && store.quantity > 0;

                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => setSelectedStoreId(store.id)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
                        selected
                          ? "border-emerald-400/40 bg-emerald-400/10"
                          : outOfStock
                            ? "border-slate-800 bg-slate-950/30 hover:border-slate-700"
                            : "border-slate-700 bg-slate-950/50 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={
                          outOfStock
                            ? "text-slate-600"
                            : selected
                              ? "text-emerald-300"
                              : "text-slate-300"
                        }
                      >
                        {store.store_name}
                      </span>

                      <span
                        className={`font-semibold ${
                          hasStock
                            ? "text-emerald-300"
                            : outOfStock
                              ? "text-slate-600"
                              : "text-slate-500"
                        }`}
                      >
                        {store.quantity === null ? "-" : store.quantity}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <aside className="xl:sticky xl:top-3 xl:self-start">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex h-11 items-center border-b border-slate-800 px-4">
              <h2 className="truncate text-sm font-semibold text-slate-100">
                {selectedStore?.store_name ?? "매장 위치"}
              </h2>
            </div>

            {!kakaoAppKey ? (
              <div className="flex h-[340px] items-center justify-center px-6 text-center text-xs leading-5 text-slate-500">
                NEXT_KAKAO_MAP_APP_KEY를 설정하면 카카오맵이 표시됩니다.
              </div>
            ) : (
              <div
                ref={mapContainerRef}
                className="h-[340px] w-full bg-slate-950"
                aria-label={`${selectedStore?.store_name ?? "선택 매장"} 지도`}
              />
            )}
          </div>
        </aside>
      </section>
    </>
  );
}
