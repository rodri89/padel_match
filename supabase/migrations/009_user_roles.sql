alter table public.profiles
  add column if not exists role text not null default 'usuario_comun';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_valid check (
      role in ('super_admin', 'admin_complejo', 'usuario_admin', 'usuario_comun')
    );
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "super admins update profiles" on public.profiles;

create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = public.current_user_role()
);

create policy "super admins update profiles"
on public.profiles for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
