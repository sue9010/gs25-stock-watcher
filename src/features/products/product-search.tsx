"use client";

import { type FormEvent, useState } from "react";

import type { Gs25Product } from "@/lib/gs25/products";
import { addProduct } from "@/features/products/actions";

type SearchResponse = {
  products?: Gs25Product[];
  error?: string;
};

export function ProductSearch() {
  const [products, setProducts] = useState<Gs25Product[]>([]);
  const [message, setMessage] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const keyword = String(formData.get("keyword") ?? "").trim();

    if (keyword.length < 2) {
      setMessage("검색어를 2자 이상 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setMessage(undefined);

    try {
      const params = new URLSearchParams({ keyword, limit: "20" });
      const response = await fetch(`/api/gs25/products?${params}`, { cache: "no-store" });
      const body = (await response.json()) as SearchResponse;

      if (!response.ok || !body.products) {
        throw new Error(body.error ?? "상품 검색에 실패했습니다.");
      }

      setProducts(body.products);
      setHasSearched(true);
    } catch (error) {
      setProducts([]);
      setHasSearched(true);
      setMessage(error instanceof Error ? error.message : "상품 검색에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 p-5">
        <h2 className="font-semibold text-slate-100">GS25 상품 검색</h2>
        <p className="mt-1 text-xs text-slate-500">
          daiso-mcp HTTP API에서 실시간으로 검색합니다. 검색 결과는 아직 DB에 저장되지 않습니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="product-keyword">
            GS25 상품 검색어
          </label>
          <input
            id="product-keyword"
            name="keyword"
            type="search"
            minLength={2}
            maxLength={50}
            placeholder="예: 민음사"
            required
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? "검색 중..." : "검색"}
          </button>
        </form>
        {message ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {message}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-950/60 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">상품명</th>
              <th className="px-5 py-3 font-medium">상품코드</th>
              <th className="px-5 py-3 text-right font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.map((product) => (
              <tr key={product.itemCode}>
                <td className="px-5 py-3.5 font-medium text-slate-200">{product.itemName}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{product.itemCode}</td>
                <td className="px-5 py-3.5 text-right">
                  <form action={addProduct}>
                    <input type="hidden" name="itemCode" value={product.itemCode} />
                    <input type="hidden" name="itemName" value={product.itemName} />
                    <button type="submit" className="rounded-md border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10">
                      Add
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {hasSearched && products.length === 0 && !message ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : null}
            {!hasSearched ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-600">
                  검색어를 입력하면 GS25 상품이 여기에 표시됩니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
