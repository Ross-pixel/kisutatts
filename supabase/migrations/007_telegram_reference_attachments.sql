-- Send completed private booking references to Telegram as chat attachments.
-- A claim/release pair prevents duplicate sends while allowing retries after failures.

alter table public.booking_requests
  add column if not exists references_notified_at timestamptz;

grant select on table public.booking_attachments to service_role;

create or replace function public.claim_booking_reference_notification(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
begin
  update public.booking_requests br
  set references_notified_at = now(), updated_at = now()
  where br.id = p_request_id
    and br.status in ('pending', 'confirmed')
    and br.references_notified_at is null
    and exists (
      select 1
      from public.booking_attachments ba
      where ba.request_id = br.id
    )
    and not exists (
      select 1
      from public.booking_attachments ba
      where ba.request_id = br.id
        and ba.uploaded_at is null
    );

  v_claimed := found;
  return v_claimed;
end;
$$;

create or replace function public.release_booking_reference_notification(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_requests
  set references_notified_at = null, updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.claim_booking_reference_notification(uuid) from public;
revoke all on function public.claim_booking_reference_notification(uuid) from anon;
revoke all on function public.claim_booking_reference_notification(uuid) from authenticated;
grant execute on function public.claim_booking_reference_notification(uuid) to service_role;

revoke all on function public.release_booking_reference_notification(uuid) from public;
revoke all on function public.release_booking_reference_notification(uuid) from anon;
revoke all on function public.release_booking_reference_notification(uuid) from authenticated;
grant execute on function public.release_booking_reference_notification(uuid) to service_role;

notify pgrst, 'reload schema';
