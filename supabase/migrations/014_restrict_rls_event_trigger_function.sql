-- Prevent API roles from invoking the SECURITY DEFINER event-trigger function directly.
-- The database event trigger itself continues to execute it for DDL events.

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;
