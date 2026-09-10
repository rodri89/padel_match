create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  device_id text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('match', 'complex', 'direct')),
  context_id uuid,
  last_message_text text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_thread_participants (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_message_reads (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_thread_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_reads enable row level security;

create or replace function public.is_thread_participant(target_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_thread_participants
    where thread_id = target_thread_id
      and user_id = auth.uid()
  );
$$;

create policy "profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users manage own push tokens"
on public.push_tokens for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "participants read own threads"
on public.chat_threads for select
to authenticated
using (public.is_thread_participant(id));

create policy "authenticated users create threads"
on public.chat_threads for insert
to authenticated
with check (true);

create policy "participants update own threads"
on public.chat_threads for update
to authenticated
using (public.is_thread_participant(id));

create policy "participants read participants"
on public.chat_thread_participants for select
to authenticated
using (public.is_thread_participant(thread_id));

create policy "authenticated users create participants"
on public.chat_thread_participants for insert
to authenticated
with check (true);

create policy "participants read messages"
on public.chat_messages for select
to authenticated
using (public.is_thread_participant(thread_id));

create policy "participants insert messages"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_thread_participant(thread_id)
);

create policy "participants read receipts"
on public.chat_message_reads for select
to authenticated
using (public.is_thread_participant((select thread_id from public.chat_messages where id = message_id)));

create policy "users mark own reads"
on public.chat_message_reads for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.email, 'Usuario')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.update_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set
    last_message_text = new.text,
    last_message_at = new.created_at,
    updated_at = new.created_at
  where id = new.thread_id;

  insert into public.chat_message_reads (message_id, user_id)
  values (new.id, new.sender_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_chat_message_created on public.chat_messages;
create trigger on_chat_message_created
after insert on public.chat_messages
for each row execute function public.update_thread_from_message();

create or replace function public.create_direct_thread(
  other_user_id uuid,
  other_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_display_name text;
  new_thread_id uuid;
begin
  select display_name into current_display_name
  from public.profiles
  where id = auth.uid();

  insert into public.chat_threads (context_type)
  values ('direct')
  returning id into new_thread_id;

  insert into public.chat_thread_participants (thread_id, user_id, display_name)
  values
    (new_thread_id, auth.uid(), coalesce(current_display_name, 'Usuario')),
    (new_thread_id, other_user_id, other_display_name);

  return new_thread_id;
end;
$$;

create or replace function public.create_chat_thread(
  input_context_type text,
  input_context_id uuid,
  input_participants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_display_name text;
  new_thread_id uuid;
  participant record;
begin
  if input_context_type not in ('match', 'complex', 'direct') then
    raise exception 'Invalid chat context type';
  end if;

  select display_name into current_display_name
  from public.profiles
  where id = auth.uid();

  insert into public.chat_threads (context_type, context_id)
  values (input_context_type, input_context_id)
  returning id into new_thread_id;

  for participant in select key, value from jsonb_each_text(input_participants)
  loop
    insert into public.chat_thread_participants (thread_id, user_id, display_name)
    values (new_thread_id, participant.key::uuid, participant.value)
    on conflict do nothing;
  end loop;

  insert into public.chat_thread_participants (thread_id, user_id, display_name)
  values (new_thread_id, auth.uid(), coalesce(current_display_name, 'Usuario'))
  on conflict do nothing;

  return new_thread_id;
end;
$$;
