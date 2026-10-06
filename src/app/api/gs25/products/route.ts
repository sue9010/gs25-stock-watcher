import { NextResponse, type NextRequest } from "next/server";

import {
  Gs25ApiError,
  productSearchQuerySchema,
  searchGs25Products,
} from "@/lib/gs25/products";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
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
    const products = await searchGs25Products(query.data.keyword, query.data.limit);

    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status = error instanceof Gs25ApiError && error.status === 429 ? 429 : 502;

    return NextResponse.json(
      { error: "GS25 상품 검색을 완료하지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status },
    );
  }
}
