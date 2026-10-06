-- Fixed operating policy for the public daiso-mcp endpoint.
-- 4 products x up to 10 independent store clusters = 40 requests/run.
-- 48 scheduled runs/day at :00/:30 => worst-case 1,920 inventory requests/day.
-- Inventory budget is capped at 2,200/day, leaving at least 800 calls of the
-- public 3,000 GET/day limit for product/store searches and other traffic.

alter table public.app_settings
  drop constraint if exists app_settings_check_interval_valid,
  drop constraint if exists app_settings_daily_budget_valid,
  drop constraint if exists app_settings_max_requests_valid;

update public.app_settings
set
  check_interval_minutes = 30,
  daily_api_request_budget = 2200,
  max_requests_per_run = 40,
  next_check_at = now();

alter table public.app_settings
  alter column check_interval_minutes set default 30,
  alter column daily_api_request_budget set default 2200,
  alter column max_requests_per_run set default 40;

alter table public.app_settings
  add constraint app_settings_check_interval_valid
    check (check_interval_minutes = 30),
  add constraint app_settings_daily_budget_valid
    check (daily_api_request_budget between 1 and 2200),
  add constraint app_settings_max_requests_valid
    check (max_requests_per_run between 1 and least(40, daily_api_request_budget));

-- Database-level backstop: no user may have more than 10 active stores.
create or replace function private.enforce_active_store_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.enabled and new.archived_at is null then
    select count(*)
      into active_count
    from public.stores
    where owner_id = new.owner_id
      and enabled
      and archived_at is null
      and id is distinct from new.id;

    if active_count >= 10 then
      raise exception '활성 매장은 최대 10개까지 등록할 수 있습니다.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_active_store_limit() from public, anon, authenticated;

drop trigger if exists stores_enforce_active_limit on public.stores;
create trigger stores_enforce_active_limit
before insert or update of enabled, archived_at on public.stores
for each row execute function private.enforce_active_store_limit();
