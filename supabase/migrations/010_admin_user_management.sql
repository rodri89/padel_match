create or replace function public.search_common_users(search_text text)
returns table (
  id uuid,
  display_name text,
  phone text,
  dni text,
  city text,
  province text,
  role text
)
language sql
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.display_name,
    profile.phone,
    profile.dni,
    profile.city,
    profile.province,
    profile.role
  from public.profiles profile
  where public.is_super_admin()
    and profile.role = 'usuario_comun'
    and (
      length(trim(search_text)) = 0
      or profile.display_name ilike '%' || trim(search_text) || '%'
      or coalesce(profile.phone, '') ilike '%' || trim(search_text) || '%'
      or coalesce(profile.dni, '') ilike '%' || trim(search_text) || '%'
    )
  order by profile.display_name asc
  limit 25;
$$;

create or replace function public.promote_user_to_complex_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can promote users';
  end if;

  update public.profiles
  set role = 'admin_complejo'
  where id = target_user_id
    and role = 'usuario_comun';

  if not found then
    raise exception 'Common user not found';
  end if;
end;
$$;
