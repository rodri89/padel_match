create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_display_name text not null,
  city text not null,
  province text,
  complex_name text not null,
  match_date date not null,
  start_time time not null,
  missing_players smallint not null check (missing_players >= 0),
  target_categories smallint[] not null,
  status text not null default 'open' check (status in ('open', 'full', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_target_categories_valid check (
    target_categories <@ array[1, 2, 3, 4, 5, 6, 7, 8]::smallint[]
  )
);

create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_display_name text not null,
  chat_thread_id uuid references public.chat_threads(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'rejected', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_requests_unique_requester unique (match_id, requester_id)
);

alter table public.matches enable row level security;
alter table public.match_requests enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_match_requests_updated_at on public.match_requests;
create trigger set_match_requests_updated_at
before update on public.match_requests
for each row execute function public.set_updated_at();

create policy "users insert own matches"
on public.matches for insert
to authenticated
with check (
  creator_id = auth.uid()
  and missing_players > 0
  and status = 'open'
);

create policy "users read visible matches"
on public.matches for select
to authenticated
using (
  creator_id = auth.uid()
  or (
    status = 'open'
    and creator_id <> auth.uid()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.city = matches.city
        and coalesce(profile.province, '') = coalesce(matches.province, '')
    )
    and exists (
      select 1
      from public.player_match_preferences preference
      where preference.user_id = auth.uid()
        and preference.visible_categories && matches.target_categories
    )
    and exists (
      select 1
      from public.player_availability availability
      where availability.user_id = auth.uid()
        and availability.day_of_week = extract(isodow from matches.match_date)::smallint
        and availability.start_time <= matches.start_time
        and availability.end_time >= matches.start_time
    )
  )
);

create policy "users update own matches"
on public.matches for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "users insert own match requests"
on public.match_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and exists (
    select 1
    from public.matches match
    where match.id = match_requests.match_id
      and match.status = 'open'
      and match.creator_id <> auth.uid()
  )
);

create policy "users read related match requests"
on public.match_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.matches match
    where match.id = match_requests.match_id
      and match.creator_id = auth.uid()
  )
);

create policy "users update related match requests"
on public.match_requests for update
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.matches match
    where match.id = match_requests.match_id
      and match.creator_id = auth.uid()
  )
)
with check (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.matches match
    where match.id = match_requests.match_id
      and match.creator_id = auth.uid()
  )
);

create or replace function public.confirm_match_request(input_request_id uuid)
returns table (
  chat_thread_id uuid,
  match_id uuid,
  requester_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.match_requests;
  target_match public.matches;
  next_missing_players smallint;
begin
  select * into target_request
  from public.match_requests
  where id = input_request_id
  for update;

  if target_request.id is null then
    raise exception 'Match request not found';
  end if;

  select * into target_match
  from public.matches
  where id = target_request.match_id
  for update;

  if target_match.creator_id <> auth.uid() then
    raise exception 'Only match creator can confirm requests';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'Only pending requests can be confirmed';
  end if;

  next_missing_players := greatest(target_match.missing_players - 1, 0);

  update public.match_requests
  set status = 'confirmed'
  where id = input_request_id;

  update public.matches
  set
    missing_players = next_missing_players,
    status = case when next_missing_players = 0 then 'full' else status end
  where id = target_match.id;

  return query
  select
    target_request.chat_thread_id,
    target_request.match_id,
    target_request.requester_display_name;
end;
$$;

create or replace function public.reject_match_request(input_request_id uuid)
returns table (
  chat_thread_id uuid,
  match_id uuid,
  requester_display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.match_requests;
  target_match public.matches;
begin
  select * into target_request
  from public.match_requests
  where id = input_request_id
  for update;

  if target_request.id is null then
    raise exception 'Match request not found';
  end if;

  select * into target_match
  from public.matches
  where id = target_request.match_id;

  if target_match.creator_id <> auth.uid() then
    raise exception 'Only match creator can reject requests';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'Only pending requests can be rejected';
  end if;

  update public.match_requests
  set status = 'rejected'
  where id = input_request_id;

  return query
  select
    target_request.chat_thread_id,
    target_request.match_id,
    target_request.requester_display_name;
end;
$$;
