drop policy if exists "users read visible matches" on public.matches;

create policy "users read open matches"
on public.matches for select
to authenticated
using (
  creator_id = auth.uid()
  or status = 'open'
);
