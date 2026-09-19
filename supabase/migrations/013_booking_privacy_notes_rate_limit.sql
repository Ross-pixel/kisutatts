-- KISU.TATTS BOOKING SYSTEM
-- Production hardening: privacy acknowledgement, admin notes, completed appointments,
-- server-side rate limiting, and guarded retention deletion.

alter table public.booking_requests
  add column if not exists admin_note text,
  add column if not exists completed_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_notice_version text;

alter table public.booking_requests
  drop constraint if exists booking_requests_admin_note_length;

alter table public.booking_requests
  add constraint booking_requests_admin_note_length
  check (admin_note is null or char_length(admin_note) <= 2000);

create index if not exists booking_requests_completed_at_idx
  on public.booking_requests(completed_at desc)
  where completed_at is not null;

create table if not exists public.booking_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

create index if not exists booking_rate_limits_updated_at_idx
  on public.booking_rate_limits(updated_at);

alter table public.booking_rate_limits enable row level security;
revoke all on table public.booking_rate_limits from public, anon, authenticated;

create or replace function public.consume_booking_rate_limit(
  p_key_hash text,
  p_limit integer default 6,
  p_window_minutes integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if char_length(trim(coalesce(p_key_hash, ''))) < 16
     or p_limit < 1
     or p_window_minutes < 1
     or p_window_minutes > 1440 then
    raise exception 'INVALID_RATE_LIMIT' using errcode = 'P0001';
  end if;

  delete from public.booking_rate_limits
  where updated_at < now() - interval '2 days';

  insert into public.booking_rate_limits (
    key_hash,
    window_started_at,
    attempts,
    updated_at
  ) values (
    trim(p_key_hash),
    now(),
    1,
    now()
  )
  on conflict (key_hash) do update
  set window_started_at = case
        when public.booking_rate_limits.window_started_at <= now() - make_interval(mins => p_window_minutes)
          then now()
        else public.booking_rate_limits.window_started_at
      end,
      attempts = case
        when public.booking_rate_limits.window_started_at <= now() - make_interval(mins => p_window_minutes)
          then 1
        else public.booking_rate_limits.attempts + 1
      end,
      updated_at = now()
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

create or replace function public.create_booking_request(
  p_slot_id uuid,
  p_name text,
  p_contact text,
  p_idea text,
  p_budget text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  update public.booking_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id
    and status = 'available'
    and starts_at > now()
  returning starts_at, ends_at into v_starts_at, v_ends_at;

  if not found then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    slot_id,
    name,
    contact,
    idea,
    budget,
    status,
    requested_starts_at,
    requested_ends_at,
    scheduled_starts_at,
    scheduled_ends_at,
    privacy_accepted_at,
    privacy_notice_version
  ) values (
    p_slot_id,
    trim(p_name),
    trim(p_contact),
    trim(p_idea),
    nullif(trim(p_budget), ''),
    'pending',
    v_starts_at,
    v_ends_at,
    v_starts_at,
    v_ends_at,
    now(),
    '2026-09-20'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.complete_booking_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_status public.booking_request_status;
  v_slot_status public.booking_slot_status;
begin
  select r.status, s.status
  into v_request_status, v_slot_status
  from public.booking_requests r
  join public.booking_slots s on s.id = r.slot_id
  where r.id = p_request_id
  for update of r, s;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request_status = 'completed' and v_slot_status = 'booked' then
    return 'completed';
  end if;

  if v_request_status <> 'confirmed' or v_slot_status <> 'booked' then
    raise exception 'REQUEST_NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  update public.booking_requests
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_request_id;

  return 'completed';
end;
$$;

create or replace function public.update_booking_admin_note(
  p_request_id uuid,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'ADMIN_NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  update public.booking_requests
  set admin_note = v_note,
      updated_at = now()
  where id = p_request_id;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  return coalesce(v_note, '');
end;
$$;

-- Called only after the server has removed private Storage objects through the Storage API.
create or replace function public.purge_booking_request_after_retention(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.booking_request_status;
  v_updated_at timestamptz;
  v_scheduled_ends_at timestamptz;
begin
  select status, updated_at, scheduled_ends_at
  into v_status, v_updated_at, v_scheduled_ends_at
  from public.booking_requests
  where id = p_request_id
  for update;

  if not found then
    return false;
  end if;

  if (v_status in ('rejected', 'cancelled') and v_updated_at <= now() - interval '180 days')
     or (v_status = 'completed' and v_scheduled_ends_at <= now() - interval '365 days') then
    delete from public.booking_requests where id = p_request_id;
    return true;
  end if;

  raise exception 'RETENTION_NOT_DUE' using errcode = 'P0001';
end;
$$;

revoke all on function public.consume_booking_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_booking_request(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_booking_request(uuid) from public, anon, authenticated;
revoke all on function public.update_booking_admin_note(uuid, text) from public, anon, authenticated;
revoke all on function public.purge_booking_request_after_retention(uuid) from public, anon, authenticated;

grant execute on function public.consume_booking_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_booking_request(uuid, text, text, text, text) to service_role;
grant execute on function public.complete_booking_request(uuid) to service_role;
grant execute on function public.update_booking_admin_note(uuid, text) to service_role;
grant execute on function public.purge_booking_request_after_retention(uuid) to service_role;

notify pgrst, 'reload schema';
