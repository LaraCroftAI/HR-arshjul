alter table public.wheels add column id uuid not null default gen_random_uuid();
alter table public.wheels add column if not exists created_at timestamptz not null default now();
alter table public.wheels drop constraint wheels_pkey;
alter table public.wheels add primary key (id);
create index if not exists wheels_user_id_idx on public.wheels(user_id);
