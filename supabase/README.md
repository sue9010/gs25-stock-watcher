# Supabase workspace

이 폴더는 Supabase CLI 2.119.0으로 관리한다.

- `migrations/`: schema, RLS, constraint, index, internal RPC, Cron migration
- `functions/check-stock/`: 정기/수동 재고 조회 worker
- `functions/send-test-notification/`: 사용자 인증 기반 Telegram 테스트
- `functions/_shared/`: GS25 client, stock transition, notification providers

Migration 파일명은 직접 만들지 않고 설치된 Supabase CLI의 `migration new` 명령으로 생성한다. 실제 프로젝트 연결 전에는 migration을 원격 DB에 적용하지 않는다.

이 프로젝트에서는 로컬 Supabase stack을 필수로 사용하지 않는다. 실제 적용 검증은 연결된 원격 개발 프로젝트에서 수행한다.

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

`config.toml`은 새 public table의 자동 Data API 노출을 끈다. 필요한 table privilege는 migration에서 `authenticated` role에 명시적으로 부여하며, 모든 public table은 RLS로 사용자 소유권을 다시 제한한다.

## Production secrets and Cron

`scripts/configure_supabase_cron.ps1`은 Cron 인증용 난수를 Edge Secret과 Vault에 저장하고 `gs25-stock-check` 작업까지 설정한다. Cron은 매분 함수를 호출하고 각 사용자의 `check_interval_minutes`와 `next_check_at`이 실제 실행 주기를 결정한다.

Telegram bot을 만든 뒤 PowerShell에서 `scripts/configure_supabase_secrets.ps1`을 실행하면 token을 화면이나 파일에 남기지 않고 Edge Function Secret에 설정한다.
