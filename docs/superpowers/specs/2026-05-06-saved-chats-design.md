# Saved GymBot Chats — Design Spec

**Date:** 2026-05-06  
**Goal:** Persist GymBot conversations so users can return to, rename, continue, or delete previous chat sessions.

---

## Overview

GymBot currently has no persistence — every chat is stateless. This spec adds a sidebar-based chat history to GymBotTab: sessions are auto-saved to the backend DB as messages are exchanged, listed in a left sidebar, and users can rename or delete them at any time. Resuming a past session restores the full message history and allows continued conversation.

---

## Data Model

One new table: `chat_sessions`, added via an Alembic migration.

| column | type | notes |
|---|---|---|
| `id` | Integer PK | auto-increment |
| `title` | Text | user-editable, defaults to `"Chat — {date}"` |
| `messages_json` | Text | JSON-serialised array of `{role, content}` objects |
| `is_ready` | Integer | 0 or 1 — whether GymBot reached the "ready to generate" state |
| `created_at` | Text | ISO timestamp, set on creation |
| `updated_at` | Text | ISO timestamp, updated on every save |

Messages are stored as a JSON blob in the session row — consistent with how `weekly_plans` stores `plan_json`, and sufficient for a single-user app.

---

## API

Five new endpoints in `server.py`:

| method | path | purpose |
|---|---|---|
| `GET` | `/api/chats` | List all sessions sorted newest first. Returns `id`, `title`, `created_at`, and the first assistant message as a preview string. |
| `POST` | `/api/chats` | Create a new session. Body: `{ title, messages }`. Returns `{ id, title, created_at }`. |
| `GET` | `/api/chats/:id` | Fetch a full session including all messages. Returns `{ id, title, messages, created_at, updated_at }`. |
| `PUT` | `/api/chats/:id` | Update title and/or messages. Body: `{ title?, messages? }`. Returns `{ ok: true }`. |
| `DELETE` | `/api/chats/:id` | Delete a session permanently. Returns `{ ok: true }`. |

All five endpoints follow the same SQLAlchemy + `Depends(get_db)` pattern already used by existing routes.

---

## Auto-Save Flow

1. User opens GymBot → greeting is fetched from `/api/chat` → immediately `POST /api/chats` to create a new session containing the greeting message. The returned session `id` is held in component state.
2. User sends a message → reply received → `PUT /api/chats/:id` with the full updated messages array.
3. The session ID persists in component state for the lifetime of the active chat. Starting a new chat resets it (creates a fresh session on next greeting).

Auto-saves are fire-and-forget — no loading state shown to the user.

---

## Frontend — GymBotTab

### Layout

GymBotTab splits into two panels:

```
┌─────────────────┬──────────────────────────────────────┐
│  SIDEBAR 200px  │           CHAT PANEL                 │
│                 │                                      │
│  [+ New chat]   │  🤖 GymBot  ● Ready    [New chat]   │
│                 │                                      │
│  ● Today 9:41   │  Bot: Hey! Ready to build...         │
│    Strength..   │                                      │
│                 │  You: I want to focus on strength    │
│  May 4, 3:12    │                                      │
│    Endurance..  │  Bot: Great! How many days...        │
│                 │                                      │
│  May 2, 11:00   │  [Message GymBot…]  [↑]             │
└─────────────────┴──────────────────────────────────────┘
```

### Sidebar behaviour

- Sessions listed newest first.
- Each row shows: editable title + relative date. Delete button (×) visible on hover.
- Active session is highlighted with the accent colour (`--accent` green border/background).
- "New chat" button at the top creates a new session and resets the chat panel.
- On mount, the sidebar fetches all sessions via `GET /api/chats`. If at least one session exists, the newest is loaded automatically. Otherwise a new session is created when the first greeting arrives.

### Inline rename

- Clicking a session title turns it into an `<input>`. Pressing Enter or blurring saves via `PUT /api/chats/:id` with the new title.
- Default title format: `"Chat — May 6, 9:41am"`.

### Delete

- Clicking × on a session row calls `DELETE /api/chats/:id`.
- If the deleted session was active, the next newest session is loaded, or a new chat is started if none remain.

### Chat panel

- Visually unchanged from current GymBot.
- Resuming a past session restores the full message history and allows continued conversation (user can keep sending messages; replies are saved normally).
- The "Generate my plan ✨" button still works on resumed sessions — `ready` state is restored from the session's `is_ready` field. When the backend returns `ready: true`, `PUT /api/chats/:id` is called with `is_ready: true` to persist it.

---

## New API Functions (`lib/api.ts`)

```typescript
listChats()                          // GET /api/chats
createChat(title, messages)          // POST /api/chats
getChat(id)                          // GET /api/chats/:id
updateChat(id, patch)                // PUT /api/chats/:id  { title?, messages?, is_ready? }
deleteChat(id)                       // DELETE /api/chats/:id
```

---

## Testing

- Backend: unit tests for all five endpoints (create, list, get, update, delete) using the existing `TestClient` + in-memory SQLite fixture pattern.
- Frontend: Jest + React Testing Library tests for GymBotTab covering: sidebar renders sessions, clicking a session loads it, new chat button resets state, inline rename saves, delete removes and switches to next session.

---

## Out of Scope

- Multi-user / authentication — single-user app, no auth needed.
- Search / filter within chat history.
- Export of chat sessions.
- Pagination of the session list (acceptable to load all for a single-user app).
