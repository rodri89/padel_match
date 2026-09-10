drop policy if exists "users read open or related matches" on public.matches;
drop policy if exists "users read open matches" on public.matches;
drop policy if exists "users read visible matches" on public.matches;

create policy "authenticated users read matches"
on public.matches for select
to authenticated
using (true);
