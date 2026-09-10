create table if not exists public.complexes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  instagram_url text,
  facebook_url text,
  logo_url text,
  address text not null,
  city text not null,
  province text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complex_admins (
  complex_id uuid not null references public.complexes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (complex_id, user_id)
);

create index if not exists complexes_city_province_idx
on public.complexes (province, city);

create index if not exists complex_admins_user_id_idx
on public.complex_admins (user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.complexes enable row level security;
alter table public.complex_admins enable row level security;

drop trigger if exists update_complexes_updated_at on public.complexes;
create trigger update_complexes_updated_at
before update on public.complexes
for each row execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public)
values ('complex-logos', 'complex-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authenticated users read complexes" on public.complexes;
drop policy if exists "super admins insert complexes" on public.complexes;
drop policy if exists "super admins update complexes" on public.complexes;
drop policy if exists "super admins delete complexes" on public.complexes;

create policy "authenticated users read complexes"
on public.complexes for select
to authenticated
using (true);

create policy "super admins insert complexes"
on public.complexes for insert
to authenticated
with check (public.is_super_admin());

create policy "super admins update complexes"
on public.complexes for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.complex_admins complex_admin
    where complex_admin.complex_id = complexes.id
      and complex_admin.user_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.complex_admins complex_admin
    where complex_admin.complex_id = complexes.id
      and complex_admin.user_id = auth.uid()
  )
);

create policy "super admins delete complexes"
on public.complexes for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "complex admins read own links" on public.complex_admins;
drop policy if exists "super admins manage complex admins" on public.complex_admins;

create policy "complex admins read own links"
on public.complex_admins for select
to authenticated
using (public.is_super_admin() or user_id = auth.uid());

create policy "super admins manage complex admins"
on public.complex_admins for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "authenticated users read complex logos" on storage.objects;
drop policy if exists "super admins insert complex logos" on storage.objects;
drop policy if exists "super admins update complex logos" on storage.objects;
drop policy if exists "super admins delete complex logos" on storage.objects;

create policy "authenticated users read complex logos"
on storage.objects for select
to authenticated
using (bucket_id = 'complex-logos');

create policy "super admins insert complex logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'complex-logos' and public.is_super_admin());

create policy "super admins update complex logos"
on storage.objects for update
to authenticated
using (bucket_id = 'complex-logos' and public.is_super_admin())
with check (bucket_id = 'complex-logos' and public.is_super_admin());

create policy "super admins delete complex logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'complex-logos' and public.is_super_admin());
