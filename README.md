# GS25 Stock Watcher

GS25 상품 재고를 주기적으로 확인하고 `0 → 양수` 입고 전환에서 Telegram 알림을 보내는 개인용 웹 애플리케이션이다. 관리 UI는 Vercel, 데이터·인증·상시 작업은 Supabase에 배치해 로컬 PC가 꺼져 있어도 동작하도록 설계한다.

현재 상태: **Phase 12 — production 배포 및 Telegram credential 연결 단계**

## Stack

- Next.js 16.3.8, React 19.3, TypeScript, App Router
- Tailwind CSS 4.3
- Vercel
- Supabase PostgreSQL, Auth, Edge Functions, Cron
- daiso-mcp GS25 HTTP API
- Telegram Bot API with provider abstraction

의존성은 exact version과 lockfile로 고정한다. Phase를 진행할 때 외부 서비스의 현재 문서를 다시 확인한다.

## Local development

Windows 11 PowerShell 기준:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000`에서 확인한다.

검사 명령:

```powershell
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

`npm audit fix --force`는 Next.js, ESLint, TypeScript의 호환 버전을 강제로 바꿀 수 있으므로 실행하지 않는다. 감사 결과는 운영 의존성과 개발 도구 의존성을 구분해 검토하고, 버전 변경은 `package.json`에서 명시적으로 수행한다.

## Environment policy

- `.env.local`, `.env`, `supabase/functions/.env`는 Git에서 제외한다.
- `NEXT_PUBLIC_SUPABASE_URL`과 publishable key만 browser에 노출할 수 있다.
- Supabase service/secret key와 `TELEGRAM_BOT_TOKEN`은 `NEXT_PUBLIC_` 접두사를 사용하지 않는다.
- production Telegram token은 Supabase Dashboard의 Edge Function Secrets에 설정한다.
- 기존 로컬 `.env.local`은 자동으로 덮어쓰지 않는다.

## Architecture

전체 흐름과 보안 경계는 [docs/architecture.md](docs/architecture.md), 데이터 관계와 쓰기 권한은 [docs/data-model.md](docs/data-model.md), 실제 GS25 HTTP 검증 근거는 [docs/gs25-api-verification.md](docs/gs25-api-verification.md)에 기록한다.

주요 원칙:

- 초대된 사용자만 로그인하며 각 사용자의 상품·매장·알림·이력은 RLS로 분리한다.
- 상품과 매장은 검색 결과에서 추가하고 삭제는 이력을 보존하는 archive 방식으로 처리한다.
- 재고는 매장별 개별 요청 대신 상품 × 위치 cluster 단위로 조회한다.
- 최초 재고는 `initial`만 기록하고 기본적으로 알림을 보내지 않는다.
- Cron과 수동 조회 모두 실행 이력을 남기고 동시 중복 실행을 차단한다.
- Telegram은 provider interface 뒤에 두어 Slack adapter를 추가할 수 있게 한다.

## Source layout

```text
src/
  app/                    # App Router pages, route handlers, server actions
  components/             # shared UI
  features/               # products, stores, watch targets, notifications, history
  lib/                    # Supabase, GS25, notifications, inventory domain
  types/                  # generated DB and application types
supabase/
  migrations/
  functions/
    _shared/
    check-stock/
    send-test-notification/
docs/
```

## Delivery phases

1. 프로젝트 구조와 architecture
2. Supabase schema와 migration
3. Next.js 연결과 authentication
4. GS25 상품 검색과 CLI 비교
5. GS25 inventory와 실제 재고 비교
6. Products, Stores, Watch Targets CRUD
7. Telegram provider와 test notification
8. stock comparison과 restock event
9. Supabase Edge Function
10. Supabase Cron
11. Dashboard, History, Settings
12. Vercel 배포와 production smoke test

외부 API나 production 연결은 실제 확인 없이 완료로 표시하지 않는다.

## Production operations

Supabase Cron과 Edge Function 설정:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure_supabase_cron.ps1
npx supabase functions deploy check-stock send-test-notification --project-ref zbopnlzsqlmxlrknyugu --no-verify-jwt --use-api
```

Telegram bot token 설정은 token을 파일이나 DB 테이블에 저장하지 않는 대화형 스크립트를 사용한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure_supabase_secrets.ps1
```

그 다음 웹 UI의 Notifications에서 bot과 대화한 `chat_id`를 추가하고 `Test`를 실행한다.

Vercel production 환경변수 동기화 및 배포:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync_vercel_env.ps1
vercel --prod --yes
```

로컬 Supabase용 Docker는 사용하지 않는다.
