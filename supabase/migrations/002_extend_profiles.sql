alter table public.profiles
  add column if not exists province text,
  add column if not exists city text,
  add column if not exists sex text check (sex in ('masculino', 'femenino')),
  add column if not exists player_position text check (player_position in ('drive', 'reves', 'ambos')),
  add column if not exists category smallint check (category between 1 and 8),
  add column if not exists phone text,
  add column if not exists dni text,
  add column if not exists birth_date date,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update set public = excluded.public;

create policy "profile photos are readable"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-photos');

create policy "users insert own profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own profile photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own profile photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
