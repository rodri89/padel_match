# Supabase + Firebase Push Setup

## Supabase

1. Create a Supabase project.
2. Copy the project URL and anon public key.
3. Set them in `src/config/supabase.ts`:

```ts
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-public-key';
```

4. Run the SQL migration in `supabase/migrations/001_initial_padelmatch.sql`.
5. Enable Realtime for:
   - `chat_threads`
   - `chat_thread_participants`
   - `chat_messages`
   - `chat_message_reads`

## Firebase Push

Firebase remains configured only for push notifications:

- Android: `android/app/google-services.json`
- iOS: `ios/PadelMatch/GoogleService-Info.plist`

The mobile app registers FCM tokens in the Supabase `push_tokens` table.

## Push Edge Function

Use `supabase/functions/send-chat-push/index.ts` as a starting point. It should
be deployed with Firebase service account environment variables.

### Deployed slugs

The functions were originally created from the Supabase dashboard, which
assigned random slugs (`super-responder`, `clever-function`, …). Most of that
has been normalised: the CLI deploys a function under its **folder name**, and
there is no flag to deploy a folder under a different slug, so the old random
slugs made the functions effectively undeployable from the CLI.

| Source folder (this repo)  | Deployed slug              | Triggered by                              |
| -------------------------- | -------------------------- | ----------------------------------------- |
| `send-chat-push`           | `send-chat-push`           | DB webhook on `chat_messages` (see below) |
| `send-match-created-push`  | `send-match-created-push`  | `matchService.ts`                         |
| `send-match-request-push`  | `send-match-request-push`  | `matchService.ts`                         |
| `create-complex-admin`     | `dynamic-api`              | `complexService.ts` — still a legacy slug |

Deploy with the folder name:

```bash
supabase functions deploy send-match-request-push --use-api
```

**`send-chat-push` is triggered by a Database Webhook**, not by the client: the
trigger `send-push-on-new-message` on `public.chat_messages` (AFTER INSERT FOR
EACH ROW). It is a normal Postgres trigger calling
`supabase_functions.http_request(...)`, so its target URL lives in the database
and is changed with a migration, not from the dashboard — see
`supabase/migrations/019_repoint_chat_push_webhook.sql`, which rewrites the URL
over `pg_get_triggerdef()` so the embedded service-role header is preserved
without ever writing it into a file. Verify the current target with:

```sql
select tgname, pg_get_triggerdef(oid) from pg_trigger
where not tgisinternal and pg_get_triggerdef(oid) ilike '%http_request%';
```

The legacy slugs `super-responder`, `clever-function` and `smooth-responder`
still exist in the project but nothing references them any more; they can be
deleted from the dashboard.

If you rename `create-complex-admin`'s slug, update its reference in
`src/services/complexService.ts` and this table.

Required secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Manual Test Checklist

1. Register a user from the app.
2. Confirm a row exists in `profiles`.
3. Confirm FCM token appears in `push_tokens`.
4. Create a demo chat.
5. Send a message.
6. Confirm `chat_threads.last_message_text` updates.
7. Confirm another participant receives realtime updates.
8. Trigger/send a push with `data.threadId` and verify the app opens the chat.
