import { z } from "zod";

const upstreamProductSchema = z.object({
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  imageUrl: z.string().optional().default(""),
});

const upstreamResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    keyword: z.string(),
    count: z.number().int().nonnegative(),
    products: z.array(upstreamProductSchema),
  }),
  meta: z
    .object({
      total: z.number().int().nonnegative(),
      pageSize: z.number().int().positive(),
    })
    .optional(),
});

export const productSearchQuerySchema = z.object({
  keyword: z.string().trim().min(2).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export type Gs25Product = {
  itemCode: string;
  itemName: string;
  imageUrl: string;
};

export class Gs25ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "Gs25ApiError";
  }
}

const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const maxRetries = 2;

function getRetryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1_000, 2_000);
  }

  return 250 * 2 ** attempt;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function searchGs25Products(keyword: string, limit: number): Promise<Gs25Product[]> {
  const baseUrl = process.env.DAISO_API_BASE_URL ?? "https://mcp.aka.page";
  const url = new URL("/api/gs25/products", baseUrl);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("limit", String(limit));

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      if (attempt < maxRetries) {
        await wait(250 * 2 ** attempt);
        continue;
      }

      throw new Gs25ApiError(
        error instanceof Error ? error.message : "GS25 상품 검색 요청에 실패했습니다.",
        503,
      );
    }

    if (!response.ok) {
      if (retryableStatuses.has(response.status) && attempt < maxRetries) {
        await wait(getRetryDelay(response, attempt));
        continue;
      }

      throw new Gs25ApiError("GS25 상품 검색 API가 오류를 반환했습니다.", response.status);
    }

    const parsed = upstreamResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      throw new Gs25ApiError("GS25 상품 검색 응답 형식이 올바르지 않습니다.", 502);
    }

    return parsed.data.data.products.map(({ itemCode, itemName, imageUrl }) => ({
      itemCode,
      itemName,
      imageUrl,
    }));
  }

  throw new Gs25ApiError("GS25 상품 검색 요청에 실패했습니다.", 503);
}
