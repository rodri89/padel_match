-- Migration 014: Groups
-- Tablas y políticas para la funcionalidad de grupos

-- 1. Tabla de grupos
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  province text,
  city text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabla de miembros del grupo
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 3. Habilitar Row Level Security
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- 4. Función helper para verificar membresía (bypass RLS para evitar recursión)
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- 5. Políticas para groups (usando funciones security definer)
create policy "groups are readable by members"
on public.groups for select
to authenticated
using (public.is_group_member(id));

create policy "authenticated users can create groups"
on public.groups for insert
to authenticated
with check (created_by = auth.uid());

create policy "group admins can update group"
on public.groups for update
to authenticated
using (public.is_group_admin(id));

-- 6. Políticas para group_members (usando funciones security definer)
create policy "members can read group members"
on public.group_members for select
to authenticated
using (public.is_group_member(group_id));

create policy "users can join groups"
on public.group_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "admins can remove members"
on public.group_members for delete
to authenticated
using (public.is_group_admin(group_id));

-- 7. Función: crear grupo y asignar admin en un solo paso (security definer, bypass RLS)
create or replace function public.create_group(
  group_name text,
  group_province text default null,
  group_city text default null,
  group_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
begin
  insert into public.groups (name, avatar_url, province, city, created_by)
  values (group_name, group_avatar_url, group_province, group_city, auth.uid())
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (new_group_id, auth.uid(), 'admin');

  return new_group_id;
end;
$$;