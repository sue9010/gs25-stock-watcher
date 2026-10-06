import { NextResponse, type NextRequest } from "next/server";
import { searchStoresThroughEdge } from "@/lib/gs25/edge-search";
import { storeSearchQuerySchema } from "@/lib/gs25/stores";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient(); const [{ data }, { data: sessionData }] = await Promise.all([supabase.auth.getClaims(), supabase.auth.getSession()]);
  if (!data?.claims || !sessionData.session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const url = new URL(request.url); const query = storeSearchQuerySchema.safeParse({ keyword: url.searchParams.get("keyword"), limit: url.searchParams.get("limit") ?? 10 });
  if (!query.success) return NextResponse.json({ error: "검색어를 2자 이상 입력해주세요." }, { status: 400 });
  try { return NextResponse.json({ stores: await searchStoresThroughEdge(query.data.keyword, query.data.limit, sessionData.session.access_token) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "매장 검색에 실패했습니다." }, { status: 502 }); }
}
