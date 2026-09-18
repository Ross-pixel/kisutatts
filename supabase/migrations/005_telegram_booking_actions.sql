-- KISU.TATTS BOOKING SYSTEM
-- Atomic booking confirmation / rejection actions used by Telegram and admin UI.

create or replace function public.confirm_booking_request(p_request_id uuid)
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
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request_status = 'confirmed' and v_slot_status = 'booked' then
    return 'confirmed';
  end if;

  if v_request_status <> 'pending' or v_slot_status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  update public.booking_requests
  set status = 'confirmed', updated_at = now()
  where id = p_request_id;

  update public.booking_slots
  set status = 'booked', updated_at = now()
  where id = v_slot_id;

  return 'confirmed';
end;
$$;

create or replace function public.reject_booking_request(p_request_id uuid)
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
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_request_status = 'rejected' and v_slot_status = 'available' then
    return 'rejected';
  end if;

  if v_request_status <> 'pending' or v_slot_status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  update public.booking_requests
  set status = 'rejected', updated_at = now()
  where id = p_request_id;

  update public.booking_slots
  set status = 'available', updated_at = now()
  where id = v_slot_id;

  return 'rejected';
end;
$$;

revoke all on function public.confirm_booking_request(uuid) from public;
revoke all on function public.confirm_booking_request(uuid) from anon;
revoke all on function public.confirm_booking_request(uuid) from authenticated;
grant execute on function public.confirm_booking_request(uuid) to service_role;

revoke all on function public.reject_booking_request(uuid) from public;
revoke all on function public.reject_booking_request(uuid) from anon;
revoke all on function public.reject_booking_request(uuid) from authenticated;
grant execute on function public.reject_booking_request(uuid) to service_role;
