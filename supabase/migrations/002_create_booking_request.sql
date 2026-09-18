-- KISU.TATTS BOOKING SYSTEM
-- Atomic booking request creation

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
begin
  update public.booking_slots
  set status = 'pending', updated_at = now()
  where id = p_slot_id
    and status = 'available'
    and starts_at > now();

  if not found then
    raise exception 'SLOT_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    slot_id,
    name,
    contact,
    idea,
    budget,
    status
  ) values (
    p_slot_id,
    trim(p_name),
    trim(p_contact),
    trim(p_idea),
    nullif(trim(p_budget), ''),
    'pending'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all
on function public.create_booking_request(uuid, text, text, text, text)
from public;

revoke all
on function public.create_booking_request(uuid, text, text, text, text)
from anon;

revoke all
on function public.create_booking_request(uuid, text, text, text, text)
from authenticated;

grant execute
on function public.create_booking_request(uuid, text, text, text, text)
to service_role;
