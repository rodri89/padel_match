create table if not exists public.complex_posts (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  image_url text not null,
  description text not null check (char_length(trim(description)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists complex_posts_complex_id_idx
on public.complex_posts (complex_id);

create index if not exists complex_posts_created_at_idx
on public.complex_posts (created_at desc);

alter table public.complex_posts enable row level security;

drop trigger if exists update_complex_posts_updated_at on public.complex_posts;
create trigger update_complex_posts_updated_at
before update on public.complex_posts
for each row execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public)
values ('complex-posts', 'complex-posts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authenticated users read complex posts" on public.complex_posts;
drop policy if exists "complex admins insert own complex posts" on public.complex_posts;
drop policy if exists "complex admins update own complex posts" on public.complex_posts;
drop policy if exists "complex admins delete own complex posts" on public.complex_posts;

create policy "authenticated users read complex posts"
on public.complex_posts for select
to authenticated
using (is_active = true or admin_id = auth.uid() or public.is_super_admin());

create policy "complex admins insert own complex posts"
on public.complex_posts for insert
to authenticated
with check (
  admin_id = auth.uid()
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.complex_admins complex_admin
      where complex_admin.complex_id = complex_posts.complex_id
        and complex_admin.user_id = auth.uid()
    )
  )
);

create policy "complex admins update own complex posts"
on public.complex_posts for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.complex_admins complex_admin
    where complex_admin.complex_id = complex_posts.complex_id
      and complex_admin.user_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.complex_admins complex_admin
    where complex_admin.complex_id = complex_posts.complex_id
      and complex_admin.user_id = auth.uid()
  )
);

create policy "complex admins delete own complex posts"
on public.complex_posts for delete
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.complex_admins complex_admin
    where complex_admin.complex_id = complex_posts.complex_id
      and complex_admin.user_id = auth.uid()
  )
);

drop policy if exists "authenticated users read complex posts images" on storage.objects;
drop policy if exists "complex admins insert complex posts images" on storage.objects;
drop policy if exists "complex admins update complex posts images" on storage.objects;
drop policy if exists "complex admins delete complex posts images" on storage.objects;

create policy "authenticated users read complex posts images"
on storage.objects for select
to authenticated
using (bucket_id = 'complex-posts');

create policy "complex admins insert complex posts images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'complex-posts'
  and public.current_user_role() in ('super_admin', 'admin_complejo')
);

create policy "complex admins update complex posts images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'complex-posts'
  and public.current_user_role() in ('super_admin', 'admin_complejo')
)
with check (
  bucket_id = 'complex-posts'
  and public.current_user_role() in ('super_admin', 'admin_complejo')
);

create policy "complex admins delete complex posts images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'complex-posts'
  and public.current_user_role() in ('super_admin', 'admin_complejo')
);
