# Backend Contract for Chat and Push

> Deprecated: this Firebase/HTTP backend contract was replaced by the Supabase
> architecture in `docs/supabase-firebase-setup.md`. Firebase is now used only
> for FCM push delivery.

The backend remains the source of truth for users, authentication, matches,
complexes, permissions, and business history. Firebase is used only for realtime
messages and push delivery.

## Auth Session

Login and register endpoints should return:

```json
{
  "token": "backend-jwt-or-session-token",
  "userId": "backend-user-id",
  "displayName": "User Name"
}
```

The app stores these values locally and uses `token` as a bearer token for API
requests.

## Device Registration

Register a push token after login:

```http
POST /mobile/devices/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "backend-user-id",
  "fcmToken": "firebase-cloud-messaging-token",
  "platform": "android"
}
```

Unregister the token on logout:

```http
POST /mobile/devices/unregister
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "backend-user-id",
  "fcmToken": "firebase-cloud-messaging-token",
  "platform": "android"
}
```

## Chat Threads

The backend should authorize or create chat threads based on business rules:

```http
POST /chats/threads
Authorization: Bearer <token>
Content-Type: application/json

{
  "participantIds": ["user-1", "user-2"],
  "participantNames": {
    "user-1": "User One",
    "user-2": "User Two"
  },
  "contextType": "match",
  "contextId": "match-123"
}
```

Response:

```json
{
  "threadId": "firestore-thread-id"
}
```

The backend can create the corresponding Firestore document with Firebase Admin
SDK, or it can approve the request and return an existing thread id.

## Firestore Shape

`chatThreads/{threadId}`:

```json
{
  "participantIds": ["user-1", "user-2"],
  "participantNames": {
    "user-1": "User One",
    "user-2": "User Two"
  },
  "contextType": "match",
  "contextId": "match-123",
  "lastMessageText": "Nos vemos en la cancha",
  "lastMessageAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`chatThreads/{threadId}/messages/{messageId}`:

```json
{
  "senderId": "user-1",
  "senderName": "User One",
  "text": "Nos vemos en la cancha",
  "createdAt": "serverTimestamp",
  "readBy": ["user-1"]
}
```

## Push Payload

When the backend sends a push for a chat message, include `threadId` so the app
can deep-link into the chat room:

```json
{
  "notification": {
    "title": "Nuevo mensaje",
    "body": "Nos vemos en la cancha"
  },
  "data": {
    "threadId": "firestore-thread-id",
    "type": "chat_message"
  }
}
```

## Firebase Files

This repository is ready for Firebase, but native config files are still
required:

- Android: `android/app/google-services.json`
- iOS: `ios/GoogleService-Info.plist`

After adding iOS config, run `bundle exec pod install` inside `ios/`.
