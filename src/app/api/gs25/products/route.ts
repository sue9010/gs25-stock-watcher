import { NextResponse, type NextRequest } from "next/server";

import { searchProductsThroughEdge } from "@/lib/gs25/edge-search";
import { productSearchQuerySchema } from "@/lib/gs25/products";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const [{ data }, { data: sessionData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getSession(),
  ]);

  if (!data?.claims || !sessionData.session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = productSearchQuerySchema.safeParse({
    keyword: url.searchParams.get("keyword"),
    limit: url.searchParams.get("limit") ?? 20,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "검색어는 2자 이상 50자 이하로 입력해주세요." },
      { status: 400 },
    );
  }

  try {
    const products = await searchProductsThroughEdge(
      query.data.keyword,
      query.data.limit,
      sessionData.session.access_token,
    );

    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "GS25 상품 검색을 완료하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
