-- One row per user. Each row holds the full wheel state as JSON.
create table if not exists public.wheels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lock the table down — only the owning user can touch their row.
alter table public.wheels enable row level security;

create policy "Users can read their own wheel"
  on public.wheels for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wheel"
  on public.wheels for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wheel"
  on public.wheels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own wheel"
  on public.wheels for delete
  using (auth.uid() = user_id);

-- Auto-bump updated_at on every change.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists wheels_touch_updated_at on public.wheels;
create trigger wheels_touch_updated_at
  before update on public.wheels
  for each row execute function public.touch_updated_at();
