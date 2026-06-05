-- 1) A SECURITY DEFINER helper that checks admin status without going through RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 2) Replace the admins-table SELECT policy with one that lets each user
--    read just their own row. (No recursion: it filters by user_id directly.)
drop policy if exists "Admins can read admins" on public.admins;

create policy "Users can read their own admin row"
  on public.admins for select
  using (auth.uid() = user_id);

-- 3) Replace the allowed_emails policies so they call is_admin() instead of
--    referencing admins directly inside an RLS expression.
drop policy if exists "Admins can read allowed emails"   on public.allowed_emails;
drop policy if exists "Admins can insert allowed emails" on public.allowed_emails;
drop policy if exists "Admins can update allowed emails" on public.allowed_emails;
drop policy if exists "Admins can delete allowed emails" on public.allowed_emails;

create policy "Admins can read allowed emails"
  on public.allowed_emails for select
  using (public.is_admin());

create policy "Admins can insert allowed emails"
  on public.allowed_emails for insert
  with check (public.is_admin());

create policy "Admins can update allowed emails"
  on public.allowed_emails for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete allowed emails"
  on public.allowed_emails for delete
  using (public.is_admin());
