-- Booking admin backend access.
-- The Telegram-authenticated Vercel backend uses the service_role/secret key.
-- No privileges are granted to anon or authenticated visitors here.

grant select, insert, update, delete
on table public.booking_slots
to service_role;

grant select
on table public.booking_requests
to service_role;

grant select
on table public.booking_attachments
to service_role;

notify pgrst, 'reload schema';
