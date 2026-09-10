-- Publicaciones creadas por cualquier usuario y mostradas en el inicio.
-- Dos tipos: 'texto' (solo descripción) y 'venta' (foto + artículo + precio opcional).

create table if not exists public.user_posts (
  id uuid primary key default gen_random_uuid(),
  -- Apunta a profiles y no a auth.users para que PostgREST pueda resolver el
  -- embed `profiles!inner(...)` desde el cliente; profiles.id ya referencia
  -- auth.users(id) on delete cascade.
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('texto', 'venta')),
  description text not null check (char_length(trim(description)) > 0),
  image_url text,
  item_name text,
  price numeric(12, 2) check (price is null or price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_posts_sale_requires_image check (kind <> 'venta' or image_url is not null)
);

create index if not exists user_posts_author_id_idx
on public.user_posts (author_id);

create index if not exists user_posts_created_at_idx
on public.user_posts (created_at desc);

alter table public.user_posts enable row level security;

drop trigger if exists update_user_posts_updated_at on public.user_posts;
create trigger update_user_posts_updated_at
before update on public.user_posts
for each row execute function public.update_updated_at_column();

drop policy if exists "authenticated users read user posts" on public.user_posts;
drop policy if exists "users insert own posts" on public.user_posts;
drop policy if exists "authors update own posts" on public.user_posts;

create policy "authenticated users read user posts"
on public.user_posts for select
to authenticated
using (is_active = true or author_id = auth.uid() or public.is_super_admin());

create policy "users insert own posts"
on public.user_posts for insert
to authenticated
with check (author_id = auth.uid());

-- El borrado es lógico (is_active = false), por eso alcanza con update.
create policy "authors update own posts"
on public.user_posts for update
to authenticated
using (author_id = auth.uid() or public.is_super_admin())
with check (author_id = auth.uid() or public.is_super_admin());

insert into storage.buckets (id, name, public)
values ('user-posts', 'user-posts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "user posts images are readable" on storage.objects;
drop policy if exists "users insert own user posts images" on storage.objects;
drop policy if exists "users update own user posts images" on storage.objects;
drop policy if exists "users delete own user posts images" on storage.objects;

-- A diferencia de complex-posts, acá publica cualquier usuario, así que el
-- permiso va por carpeta propia (igual que profile-photos) y no por rol.
create policy "user posts images are readable"
on storage.objects for select
to authenticated
using (bucket_id = 'user-posts');

create policy "users insert own user posts images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'user-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own user posts images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'user-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own user posts images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'user-posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- create_chat_thread y create_direct_thread siempre insertan un hilo nuevo, así
-- que tocar "Chatear" dos veces sobre una publicación crearía conversaciones
-- duplicadas. Esta función reutiliza el chat directo que ya exista entre los dos.
create or replace function public.get_or_create_direct_thread(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_display_name text;
  existing_thread_id uuid;
  new_thread_id uuid;
  other_display_name text;
begin
  if other_user_id is null or other_user_id = auth.uid() then
    raise exception 'No se puede abrir un chat con vos mismo.';
  end if;

  select thread.id into existing_thread_id
  from public.chat_threads thread
  join public.chat_thread_participants me
    on me.thread_id = thread.id and me.user_id = auth.uid()
  join public.chat_thread_participants other
    on other.thread_id = thread.id and other.user_id = other_user_id
  where thread.context_type = 'direct'
    and (
      select count(*)
      from public.chat_thread_participants participant
      where participant.thread_id = thread.id
    ) = 2
  order by thread.created_at
  limit 1;

  if existing_thread_id is not null then
    return existing_thread_id;
  end if;

  select display_name into current_display_name
  from public.profiles
  where id = auth.uid();

  select display_name into other_display_name
  from public.profiles
  where id = other_user_id;

  insert into public.chat_threads (context_type)
  values ('direct')
  returning id into new_thread_id;

  insert into public.chat_thread_participants (thread_id, user_id, display_name)
  values
    (new_thread_id, auth.uid(), coalesce(current_display_name, 'Usuario')),
    (new_thread_id, other_user_id, coalesce(other_display_name, 'Usuario'))
  on conflict do nothing;

  return new_thread_id;
end;
$$;

grant execute on function public.get_or_create_direct_thread(uuid) to authenticated;
