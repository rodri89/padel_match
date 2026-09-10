-- Agrega avatar_url al listado de usuarios del super admin, para poder mostrar
-- la foto del jugador cuando la tiene.
--
-- Hay que dropear antes de recrear: `create or replace function` no permite
-- cambiar las columnas de retorno (los parámetros OUT) de una función.
drop function if exists public.list_all_users();

create function public.list_all_users()
returns table (
  id uuid,
  display_name text,
  email text,
  avatar_url text,
  role text,
  city text,
  province text
)
language sql
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.display_name,
    users.email::text,
    profile.avatar_url,
    profile.role,
    profile.city,
    profile.province
  from public.profiles profile
  -- left join a propósito: con un join interno, cualquier perfil sin fila en
  -- auth.users desaparecería del listado en silencio.
  left join auth.users users on users.id = profile.id
  where public.is_super_admin()
  order by profile.display_name asc;
$$;

revoke all on function public.list_all_users() from public;
grant execute on function public.list_all_users() to authenticated;
