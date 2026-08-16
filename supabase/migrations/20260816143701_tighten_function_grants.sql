-- Trigger-funktioner ska inte gå att anropa som RPC. De kastar visserligen
-- fel utanför trigger-sammanhang, men de har inget i det publika API:t att göra.
revoke all on function public.handle_new_user_retention() from public, anon, authenticated;
revoke all on function public.enforce_invite_allowlist() from public, anon, authenticated;

-- admin_*-funktionerna kollar redan is_admin() internt och kastar undantag för
-- alla andra. Att dessutom ta bort anons EXECUTE är fördjupat försvar: en
-- utloggad besökare ska inte ens nå fram till kontrollen.
--
-- OBS: den här migreringen räckte INTE — anon ärver EXECUTE från PUBLIC, som
-- fortfarande hade sin grant kvar. Se nästa migrering.
revoke all on function public.admin_list_emails() from anon;
revoke all on function public.admin_add_email(text, text) from anon;
revoke all on function public.admin_remove_email(text) from anon;
revoke all on function public.is_admin() from anon;
revoke all on function public.whoami() from anon;

-- Inloggade behöver dessa och behåller dem.
grant execute on function public.admin_list_emails() to authenticated;
grant execute on function public.admin_add_email(text, text) to authenticated;
grant execute on function public.admin_remove_email(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.whoami() to authenticated;
