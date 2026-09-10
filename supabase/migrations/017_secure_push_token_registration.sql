-- fcm_token is globally unique, so when two different users log in on the
-- same physical device (same FCM token), a direct upsert from the client
-- fails the "users manage own push tokens" RLS policy (the existing row is
-- still owned by the previous user). This RPC runs as security definer so it
-- can safely reassign the token row to the current user, while always
-- hardcoding user_id = auth.uid() so a caller can never register a token
-- under someone else's account.

create or replace function public.register_push_token(
  p_fcm_token text,
  p_platform text,
  p_device_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens
  where fcm_token = p_fcm_token
    and user_id <> auth.uid();

  insert into public.push_tokens (user_id, fcm_token, platform, device_id, last_seen_at, revoked_at)
  values (auth.uid(), p_fcm_token, p_platform, p_device_id, now(), null)
  on conflict (fcm_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_id = excluded.device_id,
    last_seen_at = excluded.last_seen_at,
    revoked_at = excluded.revoked_at;
end;
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;
