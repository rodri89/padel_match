drop policy if exists "users read open matches" on public.matches;

create policy "users read open or related matches"
on public.matches for select
to authenticated
using (
  creator_id = auth.uid()
  or status = 'open'
  or exists (
    select 1
    from public.match_requests request
    where request.match_id = matches.id
      and request.requester_id = auth.uid()
      and request.status in ('pending', 'confirmed')
  )
);
