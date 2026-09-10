create or replace function public.list_all_users()
returns table (
  id uuid,
  display_name text,
  email text,
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
