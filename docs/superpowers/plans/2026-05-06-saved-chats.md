# Saved GymBot Chats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist GymBot conversations in Postgres, display them in a sidebar inside GymBotTab, and let users continue, rename, or delete past sessions.

**Architecture:** New `chat_sessions` table (Alembic migration 002). Five CRUD endpoints in `server.py` following existing SQLAlchemy Core + `text()` patterns. Static frontend (`static/app.js` + `static/style.css`) extended to render a sidebar alongside the chat panel, auto-save after every message exchange, and support click-to-resume, inline rename, and delete.

**Tech Stack:** Python/FastAPI, SQLAlchemy Core, Alembic, vanilla JS, CSS

---

## File Map

| File | Change |
|---|---|
| `alembic/versions/002_chat_sessions.py` | CREATE — migration adding `chat_sessions` table |
| `tests/conftest.py` | MODIFY — add `chat_sessions` to `_create_tables` |
| `server.py` | MODIFY — add `datetime` import, 2 Pydantic models, 5 endpoints |
| `tests/test_api.py` | MODIFY — add `TestChatsAPI` test class |
| `static/style.css` | MODIFY — add sidebar CSS classes |
| `static/app.js` | MODIFY — add state fields, restructure `renderChat()`, add session functions |

---

## Task 1: DB migration and test fixture

**Files:**
- Create: `alembic/versions/002_chat_sessions.py`
- Modify: `tests/conftest.py`

- [ ] **Step 1: Create the migration file**

```python
# alembic/versions/002_chat_sessions.py
"""add chat_sessions table

Revision ID: 002
Revises: 001
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.Text()),
        sa.Column("messages_json", sa.Text(), server_default="[]"),
        sa.Column("is_ready", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.Text()),
        sa.Column("updated_at", sa.Text()),
    )


def downgrade():
    op.drop_table("chat_sessions")
```

- [ ] **Step 2: Add `chat_sessions` to the test fixture**

In `tests/conftest.py`, add inside `_create_tables`, after the `custom_items` execute and before `c.commit()`:

```python
        c.execute(text("""CREATE TABLE chat_sessions (
            id INTEGER PRIMARY KEY, title TEXT,
            messages_json TEXT DEFAULT '[]',
            is_ready INTEGER DEFAULT 0,
            created_at TEXT, updated_at TEXT)"""))
```

- [ ] **Step 3: Run the migration**

```bash
cd /Users/ranel/Developer/claude-terminal
alembic upgrade head
```

Expected: `Running upgrade 001 -> 002, add chat_sessions table`

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/002_chat_sessions.py tests/conftest.py
git commit -m "feat: add chat_sessions migration and test fixture"
```

---

## Task 2: Backend endpoints (TDD)

**Files:**
- Modify: `tests/test_api.py`
- Modify: `server.py`

- [ ] **Step 1: Write the failing tests**

Append this class to `tests/test_api.py`:

```python
class TestChatsAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        _create_tables(test_engine)
        planner.engine = test_engine
        cls.client = TestClient(app)
        cls.chat_id = None

    @classmethod
    def tearDownClass(cls):
        planner.engine.dispose()

    def _req(self, method, path, body=None):
        fn = getattr(self.client, method.lower())
        return fn(path, json=body) if body is not None else fn(path)

    def test_01_create_chat(self):
        resp = self._req("POST", "/api/chats", {
            "title": "Test Chat",
            "messages": [{"role": "assistant", "content": "Hello!"}],
            "is_ready": False,
        })
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("id", data)
        self.assertEqual(data["title"], "Test Chat")
        TestChatsAPI.chat_id = data["id"]

    def test_02_list_chats(self):
        resp = self._req("GET", "/api/chats")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)
        chat = next((c for c in data if c["id"] == self.chat_id), None)
        self.assertIsNotNone(chat)
        self.assertEqual(chat["preview"], "Hello!")

    def test_03_get_chat(self):
        resp = self._req("GET", f"/api/chats/{self.chat_id}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["messages"][0]["content"], "Hello!")
        self.assertFalse(data["is_ready"])

    def test_04_update_chat_title(self):
        resp = self._req("PUT", f"/api/chats/{self.chat_id}", {"title": "Renamed"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["ok"])
        self.assertEqual(self._req("GET", f"/api/chats/{self.chat_id}").json()["title"], "Renamed")

    def test_05_update_messages_and_ready(self):
        msgs = [
            {"role": "assistant", "content": "Hello!"},
            {"role": "user", "content": "Build muscle"},
            {"role": "assistant", "content": "Great choice!"},
        ]
        resp = self._req("PUT", f"/api/chats/{self.chat_id}", {"messages": msgs, "is_ready": True})
        self.assertEqual(resp.status_code, 200)
        data = self._req("GET", f"/api/chats/{self.chat_id}").json()
        self.assertEqual(len(data["messages"]), 3)
        self.assertTrue(data["is_ready"])

    def test_06_delete_chat(self):
        resp = self._req("DELETE", f"/api/chats/{self.chat_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["ok"])
        self.assertEqual(self._req("GET", f"/api/chats/{self.chat_id}").status_code, 404)

    def test_07_delete_nonexistent_returns_404(self):
        self.assertEqual(self._req("DELETE", "/api/chats/99999").status_code, 404)
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/ranel/Developer/claude-terminal
python -m pytest tests/test_api.py::TestChatsAPI -v
```

Expected: FAIL — `404 Not Found` or `405 Method Not Allowed` for all chat routes

- [ ] **Step 3: Add `datetime` import to `server.py`**

In `server.py`, change line 1's import block — add after `from pydantic import BaseModel`:

```python
from datetime import datetime, timezone
```

- [ ] **Step 4: Add Pydantic models to `server.py`**

In `server.py`, add after the `ChatIn` model (after line 70):

```python
class ChatSessionIn(BaseModel):
    title: str
    messages: List[ChatMessageIn] = []
    is_ready: bool = False


class ChatSessionUpdateIn(BaseModel):
    title: Optional[str] = None
    messages: Optional[List[ChatMessageIn]] = None
    is_ready: Optional[bool] = None
```

- [ ] **Step 5: Add the 5 endpoints to `server.py`**

Insert after `post_chat_generate` (after line 303) and before the `# --- Static files` comment:

```python
# --- Saved chat sessions ---

@app.get("/api/chats")
def list_chats(conn=Depends(get_db)):
    rows = conn.execute(
        text("SELECT id, title, created_at, messages_json FROM chat_sessions ORDER BY created_at DESC")
    ).fetchall()
    result = []
    for row in rows:
        msgs = _json.loads(row.messages_json or "[]")
        preview = next((m["content"][:80] for m in msgs if m["role"] == "assistant"), "")
        result.append({"id": row.id, "title": row.title, "created_at": row.created_at, "preview": preview})
    return result


@app.post("/api/chats", status_code=201)
def create_chat(body: ChatSessionIn, conn=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    result = conn.execute(
        text("INSERT INTO chat_sessions (title, messages_json, is_ready, created_at, updated_at) "
             "VALUES (:title, :msgs, :is_ready, :now, :now)"),
        {"title": body.title, "msgs": _json.dumps([m.model_dump() for m in body.messages]),
         "is_ready": int(body.is_ready), "now": now},
    )
    conn.commit()
    return {"id": result.lastrowid, "title": body.title, "created_at": now}


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: int, conn=Depends(get_db)):
    row = conn.execute(text("SELECT * FROM chat_sessions WHERE id = :id"), {"id": chat_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {
        "id": row.id, "title": row.title,
        "messages": _json.loads(row.messages_json or "[]"),
        "is_ready": bool(row.is_ready),
        "created_at": row.created_at, "updated_at": row.updated_at,
    }


@app.put("/api/chats/{chat_id}")
def update_chat(chat_id: int, body: ChatSessionUpdateIn, conn=Depends(get_db)):
    row = conn.execute(text("SELECT * FROM chat_sessions WHERE id = :id"), {"id": chat_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Chat not found")
    title = body.title if body.title is not None else row.title
    msgs = (_json.dumps([m.model_dump() for m in body.messages])
            if body.messages is not None else row.messages_json)
    is_ready = int(body.is_ready) if body.is_ready is not None else row.is_ready
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        text("UPDATE chat_sessions SET title=:title, messages_json=:msgs, "
             "is_ready=:is_ready, updated_at=:now WHERE id=:id"),
        {"title": title, "msgs": msgs, "is_ready": is_ready, "now": now, "id": chat_id},
    )
    conn.commit()
    return {"ok": True}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int, conn=Depends(get_db)):
    result = conn.execute(text("DELETE FROM chat_sessions WHERE id = :id"), {"id": chat_id})
    conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"ok": True}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
cd /Users/ranel/Developer/claude-terminal
python -m pytest tests/test_api.py::TestChatsAPI -v
```

Expected: 7 tests PASS

- [ ] **Step 7: Run full test suite**

```bash
python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add saved chat sessions API endpoints"
```

---

## Task 3: Sidebar CSS

**Files:**
- Modify: `static/style.css`

- [ ] **Step 1: Add sidebar CSS**

Append to the end of `static/style.css`:

```css
/* Chat sidebar layout */
.chat-layout {
  display: flex;
  height: 70vh;
  min-height: 400px;
  max-width: 800px;
}
.chat-layout .chat-wrap {
  max-width: none;
  border-radius: 0 12px 12px 0;
  border-left: none;
  flex: 1;
}
.chat-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #0a0a0f;
  border: 1px solid #1f2937;
  border-right: none;
  border-radius: 12px 0 0 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-session-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.chat-session-item {
  padding: 8px 10px;
  cursor: pointer;
  border-left: 2px solid transparent;
  position: relative;
}
.chat-session-item:hover { background: #111827; }
.chat-session-item.active {
  border-left-color: #c0f000;
  background: rgba(192, 240, 0, 0.07);
}
.chat-session-title {
  font-size: 11px;
  font-weight: 700;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 18px;
}
.chat-session-date { font-size: 10px; color: #4b5563; margin-top: 2px; }
.chat-session-delete {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #ef4444;
  font-size: 14px;
  display: none;
  padding: 0 4px;
  cursor: pointer;
  line-height: 1;
}
.chat-session-item:hover .chat-session-delete { display: block; }
.chat-session-title-input {
  font-size: 11px;
  font-weight: 700;
  width: calc(100% - 18px);
  background: #1f2937;
  border: 1px solid #c0f000;
  color: #e5e7eb;
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add static/style.css
git commit -m "feat: add GymBot sidebar CSS"
```

---

## Task 4: State fields + restructured `renderChat()`

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Add state fields**

In `static/app.js`, add two fields to the `state` object after `chatLoading`:

```javascript
  chatSessions: [],           // [{id, title, created_at, preview}]
  activeChatSessionId: null,  // int | null — currently loaded session
```

- [ ] **Step 2: Replace `renderChat()` with the sidebar-aware version**

Replace the entire `renderChat` function (lines 622–710 in `static/app.js`) with:

```javascript
function renderChat() {
  const el = document.getElementById("gymbot");
  if (!el) return;

  const sessionsHTML = state.chatSessions.map(s => {
    const isActive = s.id === state.activeChatSessionId;
    const dateStr = s.created_at
      ? new Date(s.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "";
    return `
      <div class="chat-session-item${isActive ? " active" : ""}" data-session-id="${s.id}">
        <div class="chat-session-title" data-rename-id="${s.id}">${esc(s.title)}</div>
        <div class="chat-session-date">${esc(dateStr)}</div>
        <button class="chat-session-delete" data-delete-id="${s.id}">×</button>
      </div>`;
  }).join("");

  const messagesHTML = state.chatMessages.map(m => {
    if (m.role === "assistant") {
      return `
        <div class="chat-bubble-wrap-bot">
          <div class="chat-mini-avatar">🤖</div>
          <div>
            <div class="chat-sender">GymBot</div>
            <div class="chat-bubble-bot">${esc(m.content)}</div>
          </div>
        </div>`;
    }
    return `
      <div class="chat-bubble-wrap-user">
        <div>
          <div class="chat-sender" style="text-align:right">You</div>
          <div class="chat-bubble-user">${esc(m.content)}</div>
        </div>
      </div>`;
  }).join("");

  const typingHTML = state.chatLoading ? `
    <div class="chat-bubble-wrap-bot">
      <div class="chat-mini-avatar">🤖</div>
      <div>
        <div class="chat-sender">GymBot</div>
        <div class="chat-bubble-bot chat-typing">GymBot is thinking…</div>
      </div>
    </div>` : "";

  const generateHTML = (state.chatReady && !state.chatLoading)
    ? `<button class="chat-generate-btn" id="chat-gen-btn">Generate my plan ✨</button>` : "";

  const inputDisabled = state.chatLoading || state.chatReady ? "disabled" : "";

  el.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar">
        <button class="btn btn-primary" id="chat-new-btn"
          style="margin:10px;font-size:11px;padding:7px 10px;width:calc(100% - 20px)">+ New chat</button>
        <div class="chat-session-list" id="chat-session-list">${sessionsHTML}</div>
      </div>
      <div class="chat-wrap">
        <div class="chat-header">
          <div class="chat-avatar">🤖</div>
          <div style="flex:1">
            <div class="chat-name">GymBot</div>
            <div class="chat-status">● Ready to build your plan</div>
          </div>
        </div>
        <div class="chat-messages" id="chat-messages-list">
          ${messagesHTML}${typingHTML}${generateHTML}
        </div>
        <div class="chat-input-row">
          <input class="input" id="chat-input" placeholder="Message GymBot…"
            style="flex:1;border-radius:20px;padding:9px 16px" ${inputDisabled}>
          <button class="chat-send-btn" id="chat-send-btn" ${inputDisabled}>↑</button>
        </div>
      </div>
    </div>`;

  const msgList = document.getElementById("chat-messages-list");
  if (msgList) msgList.scrollTop = msgList.scrollHeight;

  // Bind send
  const sendBtn = document.getElementById("chat-send-btn");
  const input = document.getElementById("chat-input");
  if (sendBtn && input) {
    const doSend = () => {
      const text = input.value.trim();
      if (!text || state.chatLoading || state.chatReady) return;
      input.value = "";
      sendMessage(text);
    };
    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }

  document.getElementById("chat-new-btn")?.addEventListener("click", resetChat);
  document.getElementById("chat-gen-btn")?.addEventListener("click", generateFromChat);

  // Session item: click to load
  document.querySelectorAll(".chat-session-item").forEach(item => {
    item.addEventListener("click", e => {
      if (e.target.closest(".chat-session-delete")) return;
      const id = parseInt(item.dataset.sessionId);
      if (id !== state.activeChatSessionId) loadChatSession(id);
    });
  });

  // Delete buttons
  document.querySelectorAll(".chat-session-delete").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      deleteChatSession(parseInt(btn.dataset.deleteId));
    });
  });

  // Inline rename: double-click title
  document.querySelectorAll(".chat-session-title[data-rename-id]").forEach(titleEl => {
    titleEl.addEventListener("dblclick", () => {
      const id = parseInt(titleEl.dataset.renameId);
      const currentTitle = titleEl.textContent;
      const inp = document.createElement("input");
      inp.className = "chat-session-title-input";
      inp.value = currentTitle;
      titleEl.replaceWith(inp);
      inp.focus();
      inp.select();
      const save = async () => {
        const newTitle = inp.value.trim() || currentTitle;
        await api("PUT", `/api/chats/${id}`, { title: newTitle });
        const s = state.chatSessions.find(s => s.id === id);
        if (s) s.title = newTitle;
        renderChat();
      };
      inp.addEventListener("blur", save);
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); save(); }
        if (e.key === "Escape") renderChat();
      });
    });
  });

  if (state.chatMessages.length === 0 && !state.chatLoading && state.activeChatSessionId === null) {
    if (state.chatSessions.length > 0) {
      loadChatSession(state.chatSessions[0].id);
    } else {
      initChat();
    }
  }
}
```

- [ ] **Step 3: Add `loadSessions()` and `loadChatSession()` functions**

Add after the new `renderChat` function:

```javascript
async function loadSessions() {
  const sessions = await api("GET", "/api/chats");
  state.chatSessions = Array.isArray(sessions) ? sessions : [];
}

async function loadChatSession(id) {
  const session = await api("GET", `/api/chats/${id}`);
  if (session.id) {
    state.chatMessages = session.messages || [];
    state.chatReady = session.is_ready || false;
    state.chatLoading = false;
    state.activeChatSessionId = id;
    renderChat();
  }
}
```

- [ ] **Step 4: Update the tab click handler to load sessions**

In `static/app.js`, find the tab click handler:
```javascript
    if (tab === "chat") renderChat();
```

Replace it with:
```javascript
    if (tab === "chat") loadSessions().then(() => renderChat());
```

- [ ] **Step 5: Commit**

```bash
git add static/app.js
git commit -m "feat: add GymBot sidebar layout and session rendering"
```

---

## Task 5: Auto-save (initChat, sendMessage, resetChat, generateFromChat)

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Replace `initChat()`**

Replace the existing `initChat` function with:

```javascript
async function initChat() {
  state.chatLoading = true;
  renderChat();
  const res = await api("POST", "/api/chat", { messages: [], profile: state.profile });
  if (res.message) {
    state.chatMessages.push({ role: "assistant", content: res.message });
  } else {
    state.chatMessages.push({ role: "assistant", content: "GymBot is unavailable. Check your ANTHROPIC_API_KEY." });
  }
  const now = new Date();
  const title = `Chat — ${now.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  const sessionRes = await api("POST", "/api/chats", { title, messages: state.chatMessages });
  if (sessionRes.id) {
    state.activeChatSessionId = sessionRes.id;
    await loadSessions();
  }
  state.chatLoading = false;
  renderChat();
}
```

- [ ] **Step 2: Replace `sendMessage()`**

Replace the existing `sendMessage` function with:

```javascript
async function sendMessage(text) {
  state.chatMessages.push({ role: "user", content: text });
  state.chatLoading = true;
  renderChat();
  const res = await api("POST", "/api/chat", { messages: state.chatMessages, profile: state.profile });
  if (res.message) {
    state.chatMessages.push({ role: "assistant", content: res.message });
    if (res.ready) state.chatReady = true;
  } else {
    state.chatMessages.push({ role: "assistant", content: "Something went wrong. Please try again." });
  }
  if (state.activeChatSessionId) {
    await api("PUT", `/api/chats/${state.activeChatSessionId}`, {
      messages: state.chatMessages,
      is_ready: state.chatReady,
    });
  }
  state.chatLoading = false;
  renderChat();
}
```

- [ ] **Step 3: Replace `resetChat()`**

Replace the existing `resetChat` function with:

```javascript
function resetChat() {
  state.chatMessages = [];
  state.chatReady = false;
  state.chatLoading = false;
  state.activeChatSessionId = null;
  renderChat();
}
```

- [ ] **Step 4: Update `generateFromChat()` to clear the active session**

In the existing `generateFromChat` function, find:
```javascript
    state.chatMessages = [];
    state.chatReady = false;
    state.chatLoading = false;
```

Add `state.activeChatSessionId = null;` immediately after those three lines:
```javascript
    state.chatMessages = [];
    state.chatReady = false;
    state.chatLoading = false;
    state.activeChatSessionId = null;
```

- [ ] **Step 5: Smoke test — verify auto-save works**

1. Start the backend: `uvicorn server:app --reload --port 8000`
2. Open `http://localhost:8000` in a browser
3. Click the GymBot tab
4. Expected: greeting appears, sidebar shows one session with today's date
5. Send a message
6. Expected: session updates in the sidebar (preview visible)
7. Run `curl -s http://localhost:8000/api/chats | python3 -m json.tool`
8. Expected: one chat session with messages array in the response

- [ ] **Step 6: Commit**

```bash
git add static/app.js
git commit -m "feat: auto-save GymBot messages to chat sessions"
```

---

## Task 6: Delete session function + smoke test

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Add `deleteChatSession()` function**

Add after `loadChatSession()`:

```javascript
async function deleteChatSession(id) {
  await api("DELETE", `/api/chats/${id}`);
  state.chatSessions = state.chatSessions.filter(s => s.id !== id);
  if (state.activeChatSessionId === id) {
    state.chatMessages = [];
    state.chatReady = false;
    state.chatLoading = false;
    state.activeChatSessionId = null;
    if (state.chatSessions.length > 0) {
      await loadChatSession(state.chatSessions[0].id);
      return;
    }
  }
  renderChat();
}
```

- [ ] **Step 2: Smoke test — verify sidebar interactions**

1. Start the server and open `http://localhost:8000`
2. Click GymBot tab — one session appears in the sidebar
3. Click "+ New chat" — sends a new greeting, new session appears in sidebar, previous session still listed
4. Click the previous session in the sidebar — its messages load in the chat panel
5. Double-click a session title — turns into an input, type a new name, press Enter — title updates in sidebar
6. Hover a session — × button appears; click it — session removed from sidebar; if it was active, chat clears or next session loads
7. Send a message in any session — session persists after page refresh (open `http://localhost:8000` again, click GymBot tab, sessions still listed)

- [ ] **Step 3: Commit**

```bash
git add static/app.js
git commit -m "feat: add delete for GymBot chat sessions"
```
