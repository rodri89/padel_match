create table if not exists public.player_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint player_availability_valid_time check (start_time < end_time),
  constraint player_availability_unique_slot unique (
    user_id,
    day_of_week,
    start_time,
    end_time
  )
);

create table if not exists public.player_match_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  visible_categories smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_match_preferences_categories_valid check (
    visible_categories <@ array[1, 2, 3, 4, 5, 6, 7, 8]::smallint[]
  )
);

alter table public.player_availability enable row level security;
alter table public.player_match_preferences enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_player_match_preferences_updated_at
on public.player_match_preferences;
create trigger set_player_match_preferences_updated_at
before update on public.player_match_preferences
for each row execute function public.set_updated_at();

create policy "users manage own availability"
on public.player_availability for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users read own match preferences"
on public.player_match_preferences for select
to authenticated
using (user_id = auth.uid());

create policy "users insert own match preferences"
on public.player_match_preferences for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own match preferences"
on public.player_match_preferences for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
