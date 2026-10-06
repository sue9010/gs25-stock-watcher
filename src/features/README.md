# Feature modules

기능 구현은 다음 경계로 나눈다.

- `products`: GS25 상품 검색, 추가, 활성화, 보관 삭제
- `stores`: GS25 매장 검색, 추가, 활성화, 보관 삭제
- `notifications`: Telegram 목적지와 테스트 전송
- `inventory`: 활성 상품 × 활성 매장 자동 감시, 현재 상태, 변화 판정, 수동 조회
- `history`: stock events와 check runs 조회
- `settings`: 모니터링 상태, 조회 주기, 호출량 예측

별도의 watch-target feature는 두지 않는다. 감시 조합은 저장하지 않고 실행 시 활성 Products × 활성 Stores로 계산한다.

각 기능은 UI, validation, server action 또는 query를 가까이 두되 Supabase/GS25/알림 provider 구현은 `src/lib`에 둔다.
