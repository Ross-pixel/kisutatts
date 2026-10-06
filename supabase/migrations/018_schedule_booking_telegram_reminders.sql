create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'booking_reminder_cron_key'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'booking_reminder_cron_key',
      'Internal key used by Supabase Cron to call the kisu.tatts reminder endpoint'
    );
  end if;
end
$$;

create or replace function public.verify_booking_reminder_cron_key(p_key text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select coalesce(
    exists (
      select 1
      from vault.decrypted_secrets
      where name = 'booking_reminder_cron_key'
        and decrypted_secret = p_key
    ),
    false
  );
$$;

revoke all on function public.verify_booking_reminder_cron_key(text) from public, anon, authenticated;
grant execute on function public.verify_booking_reminder_cron_key(text) to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid
  into v_jobid
  from cron.job
  where jobname = 'booking-telegram-reminders'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end
$$;

select cron.schedule(
  'booking-telegram-reminders',
  '*/30 * * * *',
  $cron$
    select net.http_get(
      url := 'https://kisutatts.vercel.app/api/cron/booking-reminders',
      headers := jsonb_build_object(
        'x-kisu-reminder-key',
        (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'booking_reminder_cron_key'
          limit 1
        )
      ),
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
