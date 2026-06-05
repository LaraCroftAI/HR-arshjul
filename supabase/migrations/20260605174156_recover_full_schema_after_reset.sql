-- ============================================================
-- Återställning efter att pausat gratisprojekt kom tillbaka tomt (2026-06-05).
-- Idempotent replay av hela schemat i sitt slutgiltiga skick.
-- Bootstrap-inserts med gamla user-ID utelämnade (FK skulle annars fela om
-- auth.users vore tom). Seedar allowlisten med invited_by = NULL.
-- ============================================================

-- ===== wheels (slutgiltig form: flera hjul per användare) =====
create table if not exists public.wheels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wheels_user_id_idx on public.wheels(user_id);
alter table public.wheels enable row level security;

drop policy if exists "Users can read their own wheel" on public.wheels;
create policy "Users can read their own wheel"
  on public.wheels for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own wheel" on public.wheels;
create policy "Users can insert their own wheel"
  on public.wheels for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own wheel" on public.wheels;
create policy "Users can update their own wheel"
  on public.wheels for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own wheel" on public.wheels;
create policy "Users can delete their own wheel"
  on public.wheels for delete using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists wheels_touch_updated_at on public.wheels;
create trigger wheels_touch_updated_at
  before update on public.wheels
  for each row execute function public.touch_updated_at();

-- ===== admins =====
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "Users can read their own admin row" on public.admins;
create policy "Users can read their own admin row"
  on public.admins for select using (auth.uid() = user_id);

-- ===== allowed_emails =====
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  notes text
);
alter table public.allowed_emails enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated, anon;

drop policy if exists "Admins can read allowed emails" on public.allowed_emails;
create policy "Admins can read allowed emails"
  on public.allowed_emails for select using (public.is_admin());
drop policy if exists "Admins can insert allowed emails" on public.allowed_emails;
create policy "Admins can insert allowed emails"
  on public.allowed_emails for insert with check (public.is_admin());
drop policy if exists "Admins can update allowed emails" on public.allowed_emails;
create policy "Admins can update allowed emails"
  on public.allowed_emails for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete allowed emails" on public.allowed_emails;
create policy "Admins can delete allowed emails"
  on public.allowed_emails for delete using (public.is_admin());

-- ===== allowlist-enforcement på nya konton =====
create or replace function public.enforce_invite_allowlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'Den här e-postadressen är inte inbjuden. Be administratören att lägga till dig.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists enforce_invite_allowlist_trigger on auth.users;
create trigger enforce_invite_allowlist_trigger
  before insert on auth.users
  for each row execute function public.enforce_invite_allowlist();

-- ===== admin-RPC:er =====
create or replace function public.whoami()
returns json language plpgsql security definer set search_path = '' stable as $$
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

create or replace function public.admin_list_emails()
returns table (email text, invited_at timestamptz, notes text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Endast administratörer kan se listan' using errcode = 'P0001';
  end if;
  return query
    select ae.email, ae.invited_at, ae.notes
    from public.allowed_emails ae
    order by ae.invited_at desc;
end $$;

create or replace function public.admin_add_email(p_email text, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
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

create or replace function public.admin_remove_email(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
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

-- ===== seed allowlist (invited_by NULL eftersom gamla user-ID kan saknas) =====
insert into public.allowed_emails (email, invited_by, notes) values
  ('klevas.ai@outlook.com',           null, 'återställd efter projektreset 2026-06-05'),
  ('eva.klevas@klevasconsulting.com', null, 'återställd efter projektreset 2026-06-05'),
  ('eva.klevas@cantargia.com',        null, 'tillagd 2026-06-05')
on conflict (email) do nothing;
