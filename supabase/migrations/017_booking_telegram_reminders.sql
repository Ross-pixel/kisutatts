create table if not exists public.booking_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('tomorrow', 'two_hours')),
  reminder_key text not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (request_id, reminder_kind, reminder_key)
);

alter table public.booking_reminder_deliveries enable row level security;

revoke all on table public.booking_reminder_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_reminder_deliveries to service_role;

create or replace function public.claim_booking_reminder(
  p_request_id uuid,
  p_kind text,
  p_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.booking_reminder_deliveries%rowtype;
begin
  if p_kind not in ('tomorrow', 'two_hours') then
    raise exception 'INVALID_REMINDER_KIND';
  end if;

  if not exists (
    select 1
    from public.booking_requests
    where id = p_request_id
      and status = 'confirmed'
  ) then
    return false;
  end if;

  insert into public.booking_reminder_deliveries (
    request_id,
    reminder_kind,
    reminder_key
  )
  values (
    p_request_id,
    p_kind,
    p_key
  )
  on conflict (request_id, reminder_kind, reminder_key) do nothing;

  if found then
    return true;
  end if;

  select *
  into v_existing
  from public.booking_reminder_deliveries
  where request_id = p_request_id
    and reminder_kind = p_kind
    and reminder_key = p_key
  for update;

  if v_existing.sent_at is not null then
    return false;
  end if;

  if v_existing.claimed_at <= now() - interval '20 minutes' then
    update public.booking_reminder_deliveries
    set claimed_at = now(),
        last_error = null
    where id = v_existing.id;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.mark_booking_reminder_sent(
  p_request_id uuid,
  p_kind text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.booking_reminder_deliveries
  set sent_at = now(),
      last_error = null
  where request_id = p_request_id
    and reminder_kind = p_kind
    and reminder_key = p_key;
end;
$$;

create or replace function public.release_booking_reminder(
  p_request_id uuid,
  p_kind text,
  p_key text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.booking_reminder_deliveries
  where request_id = p_request_id
    and reminder_kind = p_kind
    and reminder_key = p_key
    and sent_at is null;
end;
$$;

revoke all on function public.claim_booking_reminder(uuid, text, text) from public, anon, authenticated;
revoke all on function public.mark_booking_reminder_sent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_booking_reminder(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.claim_booking_reminder(uuid, text, text) to service_role;
grant execute on function public.mark_booking_reminder_sent(uuid, text, text) to service_role;
grant execute on function public.release_booking_reminder(uuid, text, text, text) to service_role;
