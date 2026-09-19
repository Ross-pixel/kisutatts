-- KISU.TATTS BOOKING SYSTEM
-- Reusable day templates and cancellation of confirmed bookings.

create table if not exists public.booking_day_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists booking_day_templates_name_ci_key
  on public.booking_day_templates (lower(name));

create table if not exists public.booking_day_template_slots (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.booking_day_templates(id) on delete cascade,
  start_time time without time zone not null,
  end_time time without time zone not null,
  status public.booking_slot_status not null,
  note text,
  created_at timestamptz not null default now(),
  constraint booking_day_template_slots_time_check check (end_time > start_time),
  constraint booking_day_template_slots_status_check check (
    status in ('available'::public.booking_slot_status, 'blocked'::public.booking_slot_status)
  )
);

alter table public.booking_day_templates enable row level security;
alter table public.booking_day_template_slots enable row level security;

revoke all on table public.booking_day_templates from public, anon, authenticated;
revoke all on table public.booking_day_template_slots from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_day_templates to service_role;
grant select, insert, update, delete on table public.booking_day_template_slots to service_role;

create or replace function public.save_booking_day_template(
  p_name text,
  p_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_id uuid;
  v_count integer;
begin
  if p_date is null or char_length(trim(coalesce(p_name, ''))) < 1 or char_length(trim(p_name)) > 100 then
    raise exception 'INVALID_TEMPLATE' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.booking_slots s
  where (s.starts_at at time zone 'Europe/Helsinki')::date = p_date
    and (s.ends_at at time zone 'Europe/Helsinki')::date = p_date
    and s.status in ('available', 'blocked');

  if v_count = 0 then
    raise exception 'TEMPLATE_EMPTY' using errcode = 'P0001';
  end if;

  insert into public.booking_day_templates (name, source_date)
  values (trim(p_name), p_date)
  returning id into v_template_id;

  insert into public.booking_day_template_slots (
    template_id,
    start_time,
    end_time,
    status,
    note
  )
  select
    v_template_id,
    (s.starts_at at time zone 'Europe/Helsinki')::time,
    (s.ends_at at time zone 'Europe/Helsinki')::time,
    s.status,
    s.note
  from public.booking_slots s
  where (s.starts_at at time zone 'Europe/Helsinki')::date = p_date
    and (s.ends_at at time zone 'Europe/Helsinki')::date = p_date
    and s.status in ('available', 'blocked')
  order by s.starts_at;

  return v_template_id;
exception
  when unique_violation then
    raise exception 'TEMPLATE_NAME_EXISTS' using errcode = 'P0001';
end;
$$;

create or replace function public.apply_booking_day_template(
  p_template_id uuid,
  p_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_start timestamptz;
  v_end timestamptz;
  v_count integer := 0;
begin
  if p_template_id is null or p_date is null then
    raise exception 'INVALID_TEMPLATE' using errcode = 'P0001';
  end if;

  if p_date < (now() at time zone 'Europe/Helsinki')::date then
    raise exception 'PAST_DATE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.booking_day_templates where id = p_template_id) then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0001';
  end if;

  for v_item in
    select start_time, end_time, status, note
    from public.booking_day_template_slots
    where template_id = p_template_id
    order by start_time
  loop
    v_start := (p_date + v_item.start_time) at time zone 'Europe/Helsinki';
    v_end := (p_date + v_item.end_time) at time zone 'Europe/Helsinki';

    if exists (
      select 1
      from public.booking_slots s
      where tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(v_start, v_end, '[)')
    ) then
      raise exception 'TEMPLATE_CONFLICT' using errcode = 'P0001';
    end if;

    insert into public.booking_slots (starts_at, ends_at, status, note)
    values (v_start, v_end, v_item.status, v_item.note);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'TEMPLATE_EMPTY' using errcode = 'P0001';
  end if;

  return v_count;
end;
$$;

create or replace function public.cancel_booking_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot_id uuid;
  v_request_status public.booking_request_status;
  v_slot_status public.booking_slot_status;
begin
  select r.slot_id, r.status, s.status
  into v_slot_id, v_request_status, v_slot_status
  from public.booking_requests r
  join public.booking_slots s on s.id = r.slot_id
  where r.id = p_request_id
  for update of r, s;

  if not found then
    if exists (
      select 1 from public.booking_requests
      where id = p_request_id and status = 'cancelled'
    ) then
      return 'cancelled';
    end if;
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request_status <> 'confirmed' or v_slot_status <> 'booked' then
    raise exception 'REQUEST_NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  update public.booking_requests
  set status = 'cancelled',
      slot_id = null,
      updated_at = now()
  where id = p_request_id;

  update public.booking_slots
  set status = 'available',
      updated_at = now()
  where id = v_slot_id;

  return 'cancelled';
end;
$$;

revoke all on function public.save_booking_day_template(text, date) from public, anon, authenticated;
revoke all on function public.apply_booking_day_template(uuid, date) from public, anon, authenticated;
revoke all on function public.cancel_booking_request(uuid) from public, anon, authenticated;
grant execute on function public.save_booking_day_template(text, date) to service_role;
grant execute on function public.apply_booking_day_template(uuid, date) to service_role;
grant execute on function public.cancel_booking_request(uuid) to service_role;

notify pgrst, 'reload schema';
