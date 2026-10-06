create unique index check_runs_owner_running_key
  on public.check_runs (owner_id)
  where status = 'running';
