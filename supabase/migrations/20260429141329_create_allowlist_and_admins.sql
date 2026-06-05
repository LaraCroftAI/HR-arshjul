-- Admins: a small table of user IDs with full access to the allowlist.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Admins can see who's admin (so the UI can render).
create policy "Admins can read admins"
  on public.admins for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Bootstrap: make Lara's accounts admin.
insert into public.admins (user_id) values
  ('84daa799-b334-4c32-b678-9d823010821f'),
  ('48d50fc9-dacb-4a5b-818d-237b7f105d4d')
on conflict (user_id) do nothing;

-- Allowed emails: who is allowed to sign up.
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  notes text
);

alter table public.allowed_emails enable row level security;

create policy "Admins can read allowed emails"
  on public.allowed_emails for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "Admins can insert allowed emails"
  on public.allowed_emails for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "Admins can update allowed emails"
  on public.allowed_emails for update
  using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "Admins can delete allowed emails"
  on public.allowed_emails for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Bootstrap the existing users into the allowlist so they keep working.
insert into public.allowed_emails (email, invited_by) values
  ('eva.klevas@klevasconsulting.com', '84daa799-b334-4c32-b678-9d823010821f'),
  ('klevas.ai@outlook.com',           '84daa799-b334-4c32-b678-9d823010821f')
on conflict (email) do nothing;

-- Trigger that blocks signups for emails that are not on the allowlist.
create or replace function public.enforce_invite_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Den här e-postadressen är inte inbjuden. Be administratören att lägga till dig.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists enforce_invite_allowlist_trigger on auth.users;
create trigger enforce_invite_allowlist_trigger
  before insert on auth.users
  for each row execute function public.enforce_invite_allowlist();
