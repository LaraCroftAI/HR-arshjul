-- anon ärver EXECUTE från PUBLIC. Att bara återkalla från anon lämnar alltså
-- rättigheten kvar. Rätt ordning: ta bort PUBLIC:s grant först, ge sedan
-- tillbaka till authenticated som faktiskt behöver den.
revoke all on function public.admin_list_emails() from public, anon;
revoke all on function public.admin_add_email(text, text) from public, anon;
revoke all on function public.admin_remove_email(text) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.whoami() from public, anon;
revoke all on function public.retention_status() from public, anon;
revoke all on function public.retention_renew() from public, anon;

grant execute on function public.admin_list_emails() to authenticated;
grant execute on function public.admin_add_email(text, text) to authenticated;
grant execute on function public.admin_remove_email(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.whoami() to authenticated;
grant execute on function public.retention_status() to authenticated;
grant execute on function public.retention_renew() to authenticated;
