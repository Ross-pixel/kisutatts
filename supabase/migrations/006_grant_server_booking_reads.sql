-- Allow the backend service role to read booking data for Telegram notifications and admin tooling.
-- RLS remains enabled; service_role/secret-key backend access is intentionally privileged.

grant select on table public.booking_requests to service_role;
grant select on table public.booking_slots to service_role;

-- Keep PostgREST schema cache in sync after privilege changes.
notify pgrst, 'reload schema';
