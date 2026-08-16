-- Gallringstid med aktiv förlängning.
--
-- Varje konto har ett utgångsdatum 24 månader fram. Klockan nollställs BARA när
-- användaren själv trycker på "förläng" — inte av inloggning eller sparande.
-- Det aktiva valet är hela poängen med funktionen.
--
-- Tillstånd som härleds ur expires_at (inget schemalagt jobb behövs för dem):
--   active   > 60 dagar kvar        inget visas
--   warning  <= 60 dagar kvar       banner med förläng-knapp
--   locked   efter expires_at       hjulen är läsbara men inte redigerbara
--   purge    30 dagar efter det     kontot raderas av retention_purge()

create table if not exists public.retention (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  renewed_at  timestamptz,
  renew_count integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.retention is
  'Gallringstid per konto. expires_at flyttas fram enbart av retention_renew().';

alter table public.retention enable row level security;

-- Användaren får läsa sin egen rad; admin får läsa alla. Ingen får skriva
-- direkt — förlängning går via retention_renew() (SECURITY DEFINER).
drop policy if exists retention_select_own on public.retention;
create policy retention_select_own on public.retention
  for select using (auth.uid() = user_id);

drop policy if exists retention_select_admin on public.retention;
create policy retention_select_admin on public.retention
  for select using (public.is_admin());

-- Spår av vad som gallrats. Innehåller medvetet ingen e-post — raderat ska
-- vara raderat; kvar blir bara att en radering skett och hur många hjul den rörde.
create table if not exists public.retention_purge_log (
  id           bigserial primary key,
  user_id      uuid not null,
  wheels_count integer not null default 0,
  expired_at   timestamptz,
  purged_at    timestamptz not null default now()
);

alter table public.retention_purge_log enable row level security;

drop policy if exists retention_purge_log_admin on public.retention_purge_log;
create policy retention_purge_log_admin on public.retention_purge_log
  for select using (public.is_admin());

-- Nya konton får en rad automatiskt.
create or replace function public.handle_new_user_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.retention (user_id, expires_at)
  values (new.id, now() + interval '24 months')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_retention on auth.users;
create trigger on_auth_user_created_retention
  after insert on auth.users
  for each row execute function public.handle_new_user_retention();

-- Status för den inloggade användaren. Skapar raden om den saknas, så att
-- konton som fanns före den här migreringen inte hamnar utanför.
create or replace function public.retention_status()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.retention%rowtype;
  warn_days  constant integer := 60;
  grace_days constant integer := 30;
begin
  if uid is null then
    raise exception 'Inte inloggad';
  end if;

  select * into r from public.retention where user_id = uid;
  if not found then
    insert into public.retention (user_id, expires_at)
    values (uid, now() + interval '24 months')
    on conflict (user_id) do nothing;
    select * into r from public.retention where user_id = uid;
  end if;

  return json_build_object(
    'expires_at',  r.expires_at,
    'delete_at',   r.expires_at + make_interval(days => grace_days),
    'renewed_at',  r.renewed_at,
    'renew_count', r.renew_count,
    'days_left',   floor(extract(epoch from (r.expires_at - now())) / 86400)::integer,
    'warn_days',   warn_days,
    'grace_days',  grace_days,
    'state', case
      when now() >= r.expires_at + make_interval(days => grace_days) then 'purge'
      when now() >= r.expires_at                                     then 'locked'
      when now() >= r.expires_at - make_interval(days => warn_days)  then 'warning'
      else 'active'
    end
  );
end;
$$;

-- Förlängning. Tillåten när som helst, även efter utgång — det är just så en
-- låst användare räddar sina hjul.
create or replace function public.retention_renew()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.retention%rowtype;
begin
  if uid is null then
    raise exception 'Inte inloggad';
  end if;

  insert into public.retention (user_id, expires_at, renewed_at, renew_count)
  values (uid, now() + interval '24 months', now(), 1)
  on conflict (user_id) do update
    set expires_at  = now() + interval '24 months',
        renewed_at  = now(),
        renew_count = public.retention.renew_count + 1
  returning * into r;

  return json_build_object(
    'expires_at',  r.expires_at,
    'renew_count', r.renew_count
  );
end;
$$;

-- Gallringen. Körs av schemalagt jobb, aldrig av en inloggad användare.
-- Taket på 50 rader per körning är en säkerhetsventil: skulle ett datumfel
-- göra att allt ser utgånget ut hinner man upptäcka det innan allt är borta.
create or replace function public.retention_purge()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  doomed uuid[];
  n integer := 0;
begin
  select array_agg(user_id) into doomed
  from (
    select user_id
    from public.retention
    where expires_at is not null
      and expires_at + interval '30 days' <= now()
    order by expires_at
    limit 50
  ) s;

  if doomed is null or array_length(doomed, 1) is null then
    return 0;
  end if;

  insert into public.retention_purge_log (user_id, wheels_count, expired_at)
  select r.user_id,
         (select count(*) from public.wheels w where w.user_id = r.user_id),
         r.expires_at
  from public.retention r
  where r.user_id = any(doomed);

  -- Raderar kontot; wheels, admins och retention följer med via ON DELETE CASCADE.
  delete from auth.users where id = any(doomed);
  get diagnostics n = row_count;

  return n;
end;
$$;

-- Rättigheter. `revoke ... from public` räcker inte — authenticated har egna
-- grants som måste namnges explicit.
revoke all on function public.retention_purge() from public, anon, authenticated;

revoke all on function public.retention_status() from public, anon;
revoke all on function public.retention_renew() from public, anon;
grant execute on function public.retention_status() to authenticated;
grant execute on function public.retention_renew() to authenticated;

-- Befintliga konton får sin tid räknad från när kontot skapades.
insert into public.retention (user_id, expires_at)
select u.id, u.created_at + interval '24 months'
from auth.users u
on conflict (user_id) do nothing;
