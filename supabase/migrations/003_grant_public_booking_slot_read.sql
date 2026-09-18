-- Allow anonymous visitors to read only rows permitted by the existing RLS policy.
grant select on table public.booking_slots to anon;

-- Keep PostgREST schema cache in sync after privilege changes.
notify pgrst, 'reload schema';
