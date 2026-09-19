-- KISU.TATTS BOOKING SYSTEM
-- Clear reusable calendar windows from one Helsinki calendar day without touching client bookings.

create or replace function public.clear_booking_day(p_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_date is null then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;

  delete from public.booking_slots
  where status in ('available', 'blocked')
    and (starts_at at time zone 'Europe/Helsinki')::date = p_date;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.clear_booking_day(date) from public;
revoke all on function public.clear_booking_day(date) from anon;
revoke all on function public.clear_booking_day(date) from authenticated;
grant execute on function public.clear_booking_day(date) to service_role;

notify pgrst, 'reload schema';
