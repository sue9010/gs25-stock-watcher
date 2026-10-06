# GS25 API verification baseline

검증일: 2026-10-06 KST

## 확인한 공식 자료

- Repository: <https://github.com/hmmhmmhm/daiso-mcp>
- API prompt: <https://mcp.aka.page/prompt>
- Full OpenAPI: <https://mcp.aka.page/openapi-full.json>
- Base URL: `https://mcp.aka.page`

CLI 내부 구현은 다음 HTTP route를 사용하며, 애플리케이션에서도 CLI subprocess 대신 이 HTTP API를 사용한다.

- `GET /api/gs25/products?keyword={keyword}&limit={limit}`
- `GET /api/gs25/stores?keyword={keyword}&limit={limit}`
- `GET /api/gs25/inventory?itemCode={itemCode}&lat={lat}&lng={lng}&storeLimit={limit}`

## Live product search result

`keyword=민음사&limit=20` 호출에서 다음 4개가 반환됐다.

| itemCode | itemName |
| --- | --- |
| `8809844305003` | 민음사)깨찰빵(솔티밀크) |
| `8809844305034` | 민음사)모카번(커스타드) |
| `8809844305027` | 민음사)모카번(우유크림) |
| `8809844305010` | 민음사)깨찰빵(커스타드) |

이 값은 검증 fixture일 뿐 seed나 하드코딩된 최종 상품 목록으로 사용하지 않는다.

## Live store and inventory shape

강남 매장 검색과 민음사 상품 inventory 호출에서 다음 필드를 실제 확인했다.

- `storeCode`, `storeName`, `address`
- `latitude`, `longitude`, `distanceM`
- `realStockQuantity`, `pickupStockQuantity`, `deliveryStockQuantity`
- `isSoldOut`

한 inventory 요청이 주변 여러 매장을 반환하므로 product × store별 개별 호출은 하지 않는다.

## Important observations

- itemCode만 사용한 inventory 응답에서 `product.name`이 `null`일 수 있다. 알림의 상품명은 DB에 저장한 검색 결과를 사용한다.
- store search가 반환하는 stock 필드는 내부 fallback용 상품 기준일 수 있으므로 감시 상품의 `stock_status`에 저장하지 않는다.
- 현재 upstream 구현은 itemCode 재고 조회 시 좌표와 약 1km 반경을 사용하고 공개 HTTP inventory 응답은 2분 edge cache를 적용한다.
- HTTP 200이어도 `success`, nested object, 수량과 매장 코드를 runtime schema로 검증한다.
- 실제 재고는 시시각각 변하므로 Phase 5에서 같은 시각의 CLI와 HTTP를 `storeCode` 기준으로 다시 비교해야 한다.

## Execution-phase verification commands

PowerShell:

```powershell
npx daiso gs25-products "민음사" --limit 20 --json
npx daiso gs25-inventory "민음사)깨찰빵(솔티밀크)" --storeKeyword "강남" --storeLimit 10 --json
```

직접 HTTP 확인은 상품명 대신 검색 결과의 `itemCode`를 inventory route에 전달한다. URL은 코드에서 `URL`/`URLSearchParams`로 구성하고 문자열 연결로 만들지 않는다.
