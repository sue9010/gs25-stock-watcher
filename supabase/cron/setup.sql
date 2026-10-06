create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'gs25-stock-check';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

-- Fixed schedule: every hour at :00 and :30.
-- pg_cron uses UTC, but minute 00/30 is identical in Asia/Seoul.
select cron.schedule(
  'gs25-stock-check',
  '0,30 * * * *',
  $job$
    select net.http_post(
      url := 'https://zbopnlzsqlmxlrknyugu.supabase.co/functions/v1/check-stock',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'gs25_cron_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
