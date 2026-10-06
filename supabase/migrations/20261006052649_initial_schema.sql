create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.stock_event_type as enum (
  'initial',
  'restocked',
  'changed',
  'sold_out'
);

create type public.check_run_status as enum (
  'running',
  'succeeded',
  'partial',
  'failed',
  'skipped'
);

create type public.check_run_source as enum (
  'cron',
  'manual'
);

create type public.notification_delivery_status as enum (
  'pending',
  'sent',
  'failed'
);

create table public.products (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  item_code text not null,
  item_name text not null,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_owner_item_code_key unique (owner_id, item_code),
  constraint products_id_owner_key unique (id, owner_id),
  constraint products_item_code_valid check (
    item_code <> '' and item_code = btrim(item_code)
  ),
  constraint products_item_name_valid check (
    item_name <> '' and item_name = btrim(item_name)
  )
);

create table public.stores (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  store_code text not null,
  store_name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_owner_store_code_key unique (owner_id, store_code),
  constraint stores_id_owner_key unique (id, owner_id),
  constraint stores_store_code_valid check (
    store_code <> '' and store_code = btrim(store_code)
  ),
  constraint stores_store_name_valid check (
    store_name <> '' and store_name = btrim(store_name)
  ),
  constraint stores_address_valid check (
    address <> '' and address = btrim(address)
  ),
  constraint stores_latitude_valid check (latitude between -90 and 90),
  constraint stores_longitude_valid check (longitude between -180 and 180)
);

create table public.watch_targets (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null,
  store_id bigint not null,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_targets_product_owner_fkey
    foreign key (product_id, owner_id)
    references public.products (id, owner_id),
  constraint watch_targets_store_owner_fkey
    foreign key (store_id, owner_id)
    references public.stores (id, owner_id),
  constraint watch_targets_product_store_key unique (product_id, store_id),
  constraint watch_targets_id_owner_key unique (id, owner_id)
);

create table public.notification_targets (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  name text not null,
  target_identifier text not null,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_targets_owner_destination_key
    unique (owner_id, type, target_identifier),
  constraint notification_targets_id_owner_key unique (id, owner_id),
  constraint notification_targets_type_valid check (
    type = lower(type) and type in ('telegram', 'slack')
  ),
  constraint notification_targets_name_valid check (
    name <> '' and name = btrim(name)
  ),
  constraint notification_targets_identifier_valid check (
    target_identifier <> '' and target_identifier = btrim(target_identifier)
  )
);

create table public.stock_status (
  owner_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null,
  store_id bigint not null,
  quantity integer not null,
  pickup_quantity integer,
  delivery_quantity integer,
  is_sold_out boolean not null,
  checked_at timestamptz not null,
  primary key (product_id, store_id),
  constraint stock_status_product_owner_fkey
    foreign key (product_id, owner_id)
    references public.products (id, owner_id),
  constraint stock_status_store_owner_fkey
    foreign key (store_id, owner_id)
    references public.stores (id, owner_id),
  constraint stock_status_quantity_valid check (quantity >= 0),
  constraint stock_status_pickup_quantity_valid check (
    pickup_quantity is null or pickup_quantity >= 0
  ),
  constraint stock_status_delivery_quantity_valid check (
    delivery_quantity is null or delivery_quantity >= 0
  ),
  constraint stock_status_sold_out_consistent check (
    is_sold_out = (quantity = 0)
  )
);

create table public.stock_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null,
  store_id bigint not null,
  previous_quantity integer,
  current_quantity integer not null,
  event_type public.stock_event_type not null,
  notified boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stock_events_product_owner_fkey
    foreign key (product_id, owner_id)
    references public.products (id, owner_id),
  constraint stock_events_store_owner_fkey
    foreign key (store_id, owner_id)
    references public.stores (id, owner_id),
  constraint stock_events_id_owner_key unique (id, owner_id),
  constraint stock_events_previous_quantity_valid check (
    previous_quantity is null or previous_quantity >= 0
  ),
  constraint stock_events_current_quantity_valid check (current_quantity >= 0),
  constraint stock_events_transition_valid check (
    (event_type = 'initial' and previous_quantity is null)
    or (event_type = 'restocked' and previous_quantity = 0 and current_quantity > 0)
    or (event_type = 'sold_out' and previous_quantity > 0 and current_quantity = 0)
    or (
      event_type = 'changed'
      and previous_quantity > 0
      and current_quantity > 0
      and previous_quantity <> current_quantity
    )
  ),
  constraint stock_events_notification_consistent check (
    (not notified and notified_at is null)
    or (notified and notified_at is not null)
  )
);

create table public.check_runs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  source public.check_run_source not null,
  status public.check_run_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  products_checked integer not null default 0,
  stores_checked integer not null default 0,
  requests_made integer not null default 0,
  error_message text,
  constraint check_runs_counts_valid check (
    products_checked >= 0 and stores_checked >= 0 and requests_made >= 0
  ),
  constraint check_runs_finished_at_valid check (
    (status = 'running' and finished_at is null)
    or (status <> 'running' and finished_at is not null)
  ),
  constraint check_runs_time_order_valid check (
    finished_at is null or finished_at >= started_at
  )
);

create table public.app_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  monitoring_enabled boolean not null default true,
  check_interval_minutes integer not null default 10,
  initial_notification_enabled boolean not null default false,
  timezone text not null default 'Asia/Seoul',
  daily_api_request_budget integer not null default 2400,
  max_requests_per_run integer not null default 12,
  next_check_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_check_interval_valid check (
    check_interval_minutes between 1 and 1440
  ),
  constraint app_settings_timezone_valid check (
    timezone <> '' and timezone = btrim(timezone)
  ),
  constraint app_settings_daily_budget_valid check (
    daily_api_request_budget between 1 and 3000
  ),
  constraint app_settings_max_requests_valid check (
    max_requests_per_run between 1 and daily_api_request_budget
  )
);

create table public.notification_deliveries (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  stock_event_id bigint not null,
  notification_target_id bigint not null,
  status public.notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_event_owner_fkey
    foreign key (stock_event_id, owner_id)
    references public.stock_events (id, owner_id),
  constraint notification_deliveries_target_owner_fkey
    foreign key (notification_target_id, owner_id)
    references public.notification_targets (id, owner_id),
  constraint notification_deliveries_event_target_key
    unique (stock_event_id, notification_target_id),
  constraint notification_deliveries_attempt_count_valid check (attempt_count >= 0),
  constraint notification_deliveries_sent_at_valid check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index products_owner_active_idx
  on public.products (owner_id, item_name)
  where archived_at is null;

create index stores_owner_active_idx
  on public.stores (owner_id, store_name)
  where archived_at is null;

create index watch_targets_owner_active_idx
  on public.watch_targets (owner_id, product_id, store_id)
  where archived_at is null and enabled;

create index watch_targets_owner_id_idx
  on public.watch_targets (owner_id);

create index watch_targets_store_id_idx
  on public.watch_targets (store_id);

create index notification_targets_owner_active_idx
  on public.notification_targets (owner_id, type)
  where archived_at is null and enabled;

create index stock_status_owner_in_stock_idx
  on public.stock_status (owner_id, checked_at desc)
  where quantity > 0;

create index stock_status_owner_id_idx
  on public.stock_status (owner_id);

create index stock_status_store_id_idx
  on public.stock_status (store_id);

create index stock_events_owner_created_idx
  on public.stock_events (owner_id, created_at desc);

create index stock_events_owner_type_created_idx
  on public.stock_events (owner_id, event_type, created_at desc);

create index stock_events_product_id_idx
  on public.stock_events (product_id);

create index stock_events_store_id_idx
  on public.stock_events (store_id);

create index check_runs_owner_started_idx
  on public.check_runs (owner_id, started_at desc);

create index notification_deliveries_owner_status_created_idx
  on public.notification_deliveries (owner_id, status, created_at);

create index notification_deliveries_target_id_idx
  on public.notification_deliveries (notification_target_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger products_set_updated_at
before update on public.products
for each row execute function private.set_updated_at();

create trigger stores_set_updated_at
before update on public.stores
for each row execute function private.set_updated_at();

create trigger watch_targets_set_updated_at
before update on public.watch_targets
for each row execute function private.set_updated_at();

create trigger notification_targets_set_updated_at
before update on public.notification_targets
for each row execute function private.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function private.set_updated_at();

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.watch_targets enable row level security;
alter table public.notification_targets enable row level security;
alter table public.stock_status enable row level security;
alter table public.stock_events enable row level security;
alter table public.check_runs enable row level security;
alter table public.app_settings enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update on table
  public.products,
  public.stores,
  public.watch_targets,
  public.notification_targets,
  public.app_settings
to authenticated;

grant select on table
  public.stock_status,
  public.stock_events,
  public.check_runs,
  public.notification_deliveries
to authenticated;

grant usage on sequence
  public.products_id_seq,
  public.stores_id_seq,
  public.watch_targets_id_seq,
  public.notification_targets_id_seq
to authenticated;

create policy products_select_own
on public.products for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy products_insert_own
on public.products for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy products_update_own
on public.products for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy stores_select_own
on public.stores for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy stores_insert_own
on public.stores for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy stores_update_own
on public.stores for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy watch_targets_select_own
on public.watch_targets for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy watch_targets_insert_own
on public.watch_targets for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy watch_targets_update_own
on public.watch_targets for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy notification_targets_select_own
on public.notification_targets for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy notification_targets_insert_own
on public.notification_targets for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy notification_targets_update_own
on public.notification_targets for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy app_settings_select_own
on public.app_settings for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy app_settings_insert_own
on public.app_settings for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy app_settings_update_own
on public.app_settings for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy stock_status_select_own
on public.stock_status for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy stock_events_select_own
on public.stock_events for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy check_runs_select_own
on public.check_runs for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy notification_deliveries_select_own
on public.notification_deliveries for select
to authenticated
using ((select auth.uid()) = owner_id);
