-- Make sure inloggade användare faktiskt får anropa is_admin() via PostgREST.
grant execute on function public.is_admin() to authenticated, anon;
