-- whoami: diagnostisk funktion. Returnerar nuvarande inloggad användare + admin-status.
create or replace function public.whoami()
returns json
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  uid uuid := auth.uid();
  is_a boolean := public.is_admin();
begin
  return json_build_object(
    'user_id', uid,
    'is_admin', is_a,
    'admin_count', (select count(*) from public.admins)
  );
end $$;

-- Lista alla tillåtna mejl. Kräver admin (kontroll inuti).
create or replace function public.admin_list_emails()
returns table (email text, invited_at timestamptz, notes text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Endast administratörer kan se listan' using errcode = 'P0001';
  end if;
  return query
    select ae.email, ae.invited_at, ae.notes
    from public.allowed_emails ae
    order by ae.invited_at desc;
end $$;

-- Lägg till mejl. Kräver admin.
create or replace function public.admin_add_email(p_email text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Endast administratörer kan lägga till mejl' using errcode = 'P0001';
  end if;
  if p_email is null or trim(p_email) = '' then
    raise exception 'E-postadress saknas' using errcode = 'P0001';
  end if;
  insert into public.allowed_emails (email, invited_by, notes)
  values (lower(trim(p_email)), auth.uid(), nullif(trim(coalesce(p_notes,'')), ''));
end $$;

-- Ta bort mejl. Kräver admin.
create or replace function public.admin_remove_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Endast administratörer kan ta bort mejl' using errcode = 'P0001';
  end if;
  delete from public.allowed_emails where email = lower(trim(p_email));
end $$;

grant execute on function public.whoami() to authenticated, anon;
grant execute on function public.admin_list_emails() to authenticated;
grant execute on function public.admin_add_email(text, text) to authenticated;
grant execute on function public.admin_remove_email(text) to authenticated;
