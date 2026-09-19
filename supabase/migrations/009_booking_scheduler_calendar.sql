-- KISU.TATTS BOOKING SYSTEM
-- Calendar scheduler: preserve requested time, track actual scheduled time,
-- prevent slot overlaps, and let Eva safely move/resize active bookings.

alter table public.booking_requests
  add column if not exists requested_starts_at timestamptz,
  add column if not exists requested_ends_at timestamptz,
  add column if not exists scheduled_starts_at timestamptz,
  add column if not exists scheduled_ends_at timestamptz;

update public.booking_requests r
set requested_starts_at = coalesce(r.requested_starts_at, s.starts_at),
    requested_ends_at = coalesce(r.requested_ends_at, s.ends_at),
    scheduled_starts_at = coalesce(r.scheduled_starts_at, s.starts_at),
    scheduled_ends_at = coalesce(r.scheduled_ends_at, s.ends_at)
from public.booking_slots s
where s.id = r.slot_id
  and (r.requested_starts_at is null
    or r.requested_ends_at is null
    or r.scheduled_starts_at is null
    or r.scheduled_ends_at is null);

alter table public.booking_requests
  alter column requested_starts_at set not null,
  alter column requested_ends_at set not null,
  alter column scheduled_starts_at set not null,
  alter column scheduled_ends_at set not null;

alter table public.booking_requests
  drop constraint if exists booking_requests_requested_range_check,
  drop constraint if exists booking_requests_scheduled_range_check;

alter table public.booking_requests
  add constraint booking_requests_requested_range_check
    check (requested_ends_at > requested_starts_at),
  add constraint booking_requests_scheduled_range_check
    check (scheduled_ends_at > scheduled_starts_at);

-- Historical rejected/cancelled requests may keep their time snapshots even if an unused slot is removed later.
alter table public.booking_requests alter column slot_id drop not null;
alter table public.booking_requests drop constraint if exists booking_requests_slot_id_fkey;
alter table public.booking_requests
  add constraint booking_requests_slot_id_fkey
  foreign key (slot_id) references public.booking_slots(id) on delete set null;

-- Calendar slots may touch, but may never overlap. This is the final concurrency guard.
alter table public.booking_slots
  drop constraint if exists booking_slots_no_overlap;
alter table public.booking_slots
  add constraint booking_slots_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&);

-- Snapshot requested/scheduled time when the client submits a booking.
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
    scheduled_ends_at
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
    v_ends_at
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.create_booking_request(uuid, text, text, text, text) from public;
revoke all on function public.create_booking_request(uuid, text, text, text, text) from anon;
revoke all on function public.create_booking_request(uuid, text, text, text, text) from authenticated;
grant execute on function public.create_booking_request(uuid, text, text, text, text) to service_role;

-- Move/resize one active booking atomically. Available windows that are consumed are split;
-- time released from the old booking becomes available again. Busy/blocked overlaps are rejected.
create or replace function public.adjust_booking_request_schedule(
  p_request_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot_id uuid;
  v_request_status public.booking_request_status;
  v_slot_status public.booking_slot_status;
  v_old_start timestamptz;
  v_old_end timestamptz;
  v_note text;
  v_other record;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'INVALID_SCHEDULE_RANGE' using errcode = 'P0001';
  end if;

  select r.slot_id, r.status, s.status, s.starts_at, s.ends_at, s.note
  into v_slot_id, v_request_status, v_slot_status, v_old_start, v_old_end, v_note
  from public.booking_requests r
  join public.booking_slots s on s.id = r.slot_id
  where r.id = p_request_id
  for update of r, s;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request_status not in ('pending', 'confirmed') then
    raise exception 'REQUEST_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if (v_request_status = 'pending' and v_slot_status <> 'pending')
     or (v_request_status = 'confirmed' and v_slot_status <> 'booked') then
    raise exception 'REQUEST_SLOT_MISMATCH' using errcode = 'P0001';
  end if;

  for v_other in
    select id, starts_at, ends_at, status, note
    from public.booking_slots
    where id <> v_slot_id
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    order by starts_at
    for update
  loop
    if v_other.status <> 'available' then
      raise exception 'SCHEDULE_CONFLICT' using errcode = 'P0001';
    end if;
  end loop;

  for v_other in
    select id, starts_at, ends_at, status, note
    from public.booking_slots
    where id <> v_slot_id
      and status = 'available'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    order by starts_at
    for update
  loop
    delete from public.booking_slots where id = v_other.id;

    if v_other.starts_at < p_starts_at then
      insert into public.booking_slots (starts_at, ends_at, status, note)
      values (v_other.starts_at, p_starts_at, 'available', v_other.note);
    end if;

    if v_other.ends_at > p_ends_at then
      insert into public.booking_slots (starts_at, ends_at, status, note)
      values (p_ends_at, v_other.ends_at, 'available', v_other.note);
    end if;
  end loop;

  update public.booking_slots
  set starts_at = p_starts_at,
      ends_at = p_ends_at,
      updated_at = now()
  where id = v_slot_id;

  update public.booking_requests
  set scheduled_starts_at = p_starts_at,
      scheduled_ends_at = p_ends_at,
      updated_at = now()
  where id = p_request_id;

  if p_ends_at <= v_old_start or p_starts_at >= v_old_end then
    insert into public.booking_slots (starts_at, ends_at, status, note)
    values (v_old_start, v_old_end, 'available', v_note);
  else
    if p_starts_at > v_old_start then
      insert into public.booking_slots (starts_at, ends_at, status, note)
      values (v_old_start, least(p_starts_at, v_old_end), 'available', v_note);
    end if;

    if p_ends_at < v_old_end then
      insert into public.booking_slots (starts_at, ends_at, status, note)
      values (greatest(p_ends_at, v_old_start), v_old_end, 'available', v_note);
    end if;
  end if;

  return 'scheduled';
end;
$$;

revoke all on function public.adjust_booking_request_schedule(uuid, timestamptz, timestamptz) from public;
revoke all on function public.adjust_booking_request_schedule(uuid, timestamptz, timestamptz) from anon;
revoke all on function public.adjust_booking_request_schedule(uuid, timestamptz, timestamptz) from authenticated;
grant execute on function public.adjust_booking_request_schedule(uuid, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
