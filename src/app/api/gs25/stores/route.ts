import { NextResponse, type NextRequest } from "next/server";
import { searchGs25Stores, storeSearchQuerySchema } from "@/lib/gs25/stores";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const url = new URL(request.url); const query = storeSearchQuerySchema.safeParse({ keyword: url.searchParams.get("keyword"), limit: url.searchParams.get("limit") ?? 10 });
  if (!query.success) return NextResponse.json({ error: "검색어를 2자 이상 입력해주세요." }, { status: 400 });
  try { return NextResponse.json({ stores: await searchGs25Stores(query.data.keyword, query.data.limit) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "매장 검색에 실패했습니다." }, { status: 502 }); }
}
