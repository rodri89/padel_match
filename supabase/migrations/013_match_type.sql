alter table public.matches
  add column if not exists match_type text not null default 'libre';

do $$
begin
  alter table public.matches
    add constraint matches_match_type_valid check (
      match_type in ('damas', 'libre', 'mixto')
    );
exception
  when duplicate_object then null;
end;
$$;
