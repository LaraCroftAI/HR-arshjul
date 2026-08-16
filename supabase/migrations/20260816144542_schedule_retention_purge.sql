-- Schemalagd gallring. Kör en gång per dygn; retention_purge() raderar bara
-- konton som passerat expires_at + 30 dagars respit, max 50 per körning.
--
-- Pausa jobbet:      select cron.unschedule('retention-purge');
-- Se schemat:        select * from cron.job;
-- Se körhistorik:    select * from cron.job_run_details order by start_time desc limit 20;
create extension if not exists pg_cron;

-- Ta bort ett ev. tidigare jobb med samma namn så migreringen går att köra om.
select cron.unschedule('retention-purge')
where exists (select 1 from cron.job where jobname = 'retention-purge');

select cron.schedule(
  'retention-purge',
  '17 3 * * *',                          -- 03:17 UTC varje natt
  $$select public.retention_purge();$$
);
