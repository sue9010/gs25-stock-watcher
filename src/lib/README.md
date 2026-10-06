# Shared libraries

- `supabase/`: Phase 3에서 browser/server client와 인증 갱신을 추가한다.
- `gs25/`: Phase 4~5에서 서버 전용 HTTP client와 Zod schema를 추가한다.
- `notifications/`: Phase 7에서 provider interface와 Telegram adapter를 추가한다.
- `inventory/`: Phase 8에서 순수 transition 및 clustering 로직을 추가한다.

서버 secret을 읽는 모듈은 Client Component에서 import할 수 없도록 `server-only` 경계를 적용한다.
