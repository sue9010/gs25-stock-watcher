alter table public.app_settings
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time without time zone not null default '22:00',
  add column if not exists quiet_hours_end time without time zone not null default '08:00';

alter table public.app_settings
  drop constraint if exists app_settings_quiet_hours_valid;

alter table public.app_settings
  add constraint app_settings_quiet_hours_valid
  check (quiet_hours_start <> quiet_hours_end);
