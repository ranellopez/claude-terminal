# GymBot AI Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "💬 GymBot" third tab where users have a natural conversation with an AI fitness coach that gathers their preferences and generates a saved weekly plan.

**Architecture:** Stateless multi-turn chat — the frontend holds the full `[{role, content}]` conversation history and sends it on every request. Two new FastAPI endpoints (`POST /api/chat`, `POST /api/chat/generate`) handle Claude API calls. `planner.py` gets one new function (`chat_with_claude`). Frontend adds a third tab with chat bubble UI, auto-triggered opening greeting, and a "Generate my plan ✨" button that appears when GymBot signals readiness.

**Tech Stack:** Python, FastAPI, Anthropic SDK (existing), Pydantic, vanilla JS/HTML/CSS

---

## File Map

| File | Change |
|------|--------|
| `planner.py` | Add `chat_with_claude(messages, system_prompt)` after `ask_claude` |
| `server.py` | Add `import json as _json`, `List` to typing import, `ChatMessageIn`/`ChatIn` Pydantic models, `GYMBOT_SYSTEM_PROMPT`, `GYMBOT_EXTRACT_PROMPT` constants, `POST /api/chat`, `POST /api/chat/generate` endpoints |
| `static/index.html` | Add third tab button + `<div id="chat-tab">` + `<div id="gymbot">` |
| `static/style.css` | Add chat bubble styles (`.chat-wrap`, `.chat-header`, `.chat-avatar`, `.chat-messages`, `.chat-bubble-bot`, `.chat-bubble-user`, `.chat-sender`, `.chat-generate-btn`, `.chat-input-row`, `.chat-send-btn`, `.chat-typing`) |
| `static/app.js` | Add `chatMessages`, `chatReady`, `chatLoading` to state; add `renderChat`, `initChat`, `sendMessage`, `generateFromChat`, `resetChat`; update tab click listener |
| `tests/test_api.py` | Add `test_23_post_chat`, `test_24_post_chat_generate` |

---

### Task 1: Add `chat_with_claude` to planner.py (TDD)

**Files:**
- Modify: `planner.py` (after `ask_claude`, around line 426)
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing test at the end of tests/test_planner.py**

```python
def test_chat_with_claude_calls_api_with_messages():
    from planner import chat_with_claude
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"message": "What is your goal?", "ready": false}')]
    with patch("anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        mock_client.messages.create.return_value = mock_response
        result = chat_with_claude(
            [{"role": "user", "content": "Hi"}],
            "You are GymBot"
        )
    assert result == '{"message": "What is your goal?", "ready": false}'
    call_kwargs = mock_client.messages.create.call_args[1]
    assert call_kwargs["system"] == "You are GymBot"
    assert call_kwargs["messages"] == [{"role": "user", "content": "Hi"}]
```

- [ ] **Step 2: Run to confirm it fails**

Run: `python3 -m pytest tests/test_planner.py::test_chat_with_claude_calls_api_with_messages -v`
Expected: FAIL — `ImportError: cannot import name 'chat_with_claude'`

- [ ] **Step 3: Add function to planner.py after `ask_claude` (around line 426)**

```python
def chat_with_claude(messages, system_prompt):
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text
```

- [ ] **Step 4: Run to confirm it passes**

Run: `python3 -m pytest tests/test_planner.py::test_chat_with_claude_calls_api_with_messages -v`
Expected: PASS

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `python3 -m pytest tests/test_planner.py -v`
Expected: all tests pass (38 total)

- [ ] **Step 6: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add chat_with_claude multi-turn function to planner"
```

---

### Task 2: Add `/api/chat` endpoint (TDD)

**Files:**
- Modify: `server.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Write failing test — add after `test_22_post_meal_check_no_profile` in tests/test_api.py**

```python
    def test_23_post_chat(self):
        with patch("planner.chat_with_claude", return_value='{"message": "What is your fitness goal?", "ready": false}'):
            status, data = self._req("POST", "/api/chat", {
                "messages": [{"role": "user", "content": "Hi"}],
                "profile": SAMPLE_PROFILE,
            })
        self.assertEqual(status, 200)
        self.assertIn("message", data)
        self.assertIn("ready", data)
        self.assertIsInstance(data["message"], str)
        self.assertIsInstance(data["ready"], bool)
        self.assertFalse(data["ready"])

    def test_23b_post_chat_ready(self):
        with patch("planner.chat_with_claude", return_value='{"message": "I have everything, ready to generate!", "ready": true}'):
            status, data = self._req("POST", "/api/chat", {
                "messages": [{"role": "user", "content": "No dairy, Sunday prep"}],
                "profile": SAMPLE_PROFILE,
            })
        self.assertEqual(status, 200)
        self.assertTrue(data["ready"])
```

- [ ] **Step 2: Run to confirm they fail**

Run: `python3 -m pytest tests/test_api.py::TestPlannerAPI::test_23_post_chat tests/test_api.py::TestPlannerAPI::test_23b_post_chat_ready -v`
Expected: FAIL — 404 Not Found

- [ ] **Step 3: Add imports, constants, Pydantic models, and endpoint to server.py**

Add `import json as _json` and `List` to the existing typing import at the top of server.py:

```python
import json as _json
from typing import Optional, List
```

Add after the existing Pydantic models (after `MealCheckIn`):

```python
class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    messages: List[ChatMessageIn]
    profile: dict = {}
```

Add after the existing constants (after the `MealCheckIn` class, before the `get_db` function):

```python
GYMBOT_SYSTEM_PROMPT = """You are GymBot, a friendly and direct AI fitness coach. Your job is to have a natural conversation to gather the user's preferences, then offer to generate their weekly fitness and meal plan.

Current user profile:
{profile_summary}

Rules:
- Reference the user's existing profile naturally — acknowledge what you already know
- Ask follow-up questions ONE AT A TIME — never ask multiple questions in a single message
- Gather all of the following if not already known: fitness goal, gym days (which specific days), meal prep day, fitness level (beginner/intermediate/advanced), available equipment, dietary preference, food allergies, daily calorie target, daily protein target
- Keep responses concise and encouraging
- When you have gathered enough information for a complete 7-day plan, set ready to true

CRITICAL: Always respond with ONLY valid JSON — no preamble, no markdown:
{{"message": "your conversational response here", "ready": false}}

When ready to generate:
{{"message": "Perfect — I've got everything I need! [brief summary]. Ready to generate your plan? 🚀", "ready": true}}"""

GYMBOT_EXTRACT_PROMPT = """Extract a complete fitness profile from the conversation. Fill any missing fields using the base profile provided. Return ONLY valid JSON with no other text.

Base profile:
{base_profile}

Required output format (all fields mandatory):
{{
  "goal": "lose_weight|build_muscle|maintain|endurance",
  "gym_days": "Mon,Wed,Fri",
  "rest_days": "Tue,Thu,Sat,Sun",
  "meal_prep_day": "Sun",
  "fitness_level": "beginner|intermediate|advanced",
  "equipment": "dumbbells,barbell",
  "dietary_preference": "none|vegetarian|vegan|gluten-free",
  "allergies": "none",
  "daily_calorie_target": 2800,
  "protein_target_g": 180
}}"""
```

Add the `/api/chat` endpoint after the meal-check endpoint and before the static `app.mount` line:

```python
# --- GymBot chat ---

@app.post("/api/chat")
def post_chat(body: ChatIn):
    profile_summary = ", ".join(
        f"{k}: {v}" for k, v in body.profile.items() if v and k != "id"
    ) or "No profile set yet"
    system = GYMBOT_SYSTEM_PROMPT.format(profile_summary=profile_summary)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    if not messages:
        messages = [{"role": "user", "content": "Hello"}]
        system += "\n\nThe user just opened GymBot. Greet them warmly, introduce yourself, and reference their existing profile if they have one. Ask your first question."

    try:
        raw = planner.chat_with_claude(messages, system)
        try:
            parsed = _json.loads(raw)
            return {"message": parsed.get("message", raw), "ready": bool(parsed.get("ready", False))}
        except (_json.JSONDecodeError, ValueError):
            return {"message": raw, "ready": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: Run to confirm tests pass**

Run: `python3 -m pytest tests/test_api.py::TestPlannerAPI::test_23_post_chat tests/test_api.py::TestPlannerAPI::test_23b_post_chat_ready -v`
Expected: PASS — both green

- [ ] **Step 5: Run full test suite**

Run: `python3 -m pytest tests/ -v`
Expected: all 59 tests pass

- [ ] **Step 6: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add POST /api/chat endpoint for GymBot conversation"
```

---

### Task 3: Add `/api/chat/generate` endpoint (TDD)

**Files:**
- Modify: `server.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Write failing test — add after `test_23b_post_chat_ready` in tests/test_api.py**

```python
    def test_24_post_chat_generate(self):
        import json as _json
        conversation = [
            {"role": "assistant", "content": "Hey! I'm GymBot 💪"},
            {"role": "user", "content": "I want to build muscle, 5 days a week with dumbbells, intermediate level"},
            {"role": "assistant", "content": "Great! Which days work for you?"},
            {"role": "user", "content": "Mon through Fri, meal prep on Sunday, no dairy"},
        ]
        extracted = _json.dumps({
            "goal": "build_muscle",
            "gym_days": "Mon,Tue,Wed,Thu,Fri",
            "rest_days": "Sat,Sun",
            "meal_prep_day": "Sun",
            "fitness_level": "intermediate",
            "equipment": "dumbbells",
            "dietary_preference": "none",
            "allergies": "dairy",
            "daily_calorie_target": 2800,
            "protein_target_g": 180,
        })
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
             patch("planner.chat_with_claude", return_value=extracted), \
             patch("planner.enhance_plan_with_ai", side_effect=lambda p, plan: plan):
            status, data = self._req("POST", "/api/chat/generate", {
                "messages": conversation,
                "profile": SAMPLE_PROFILE,
            })
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertIn("Mon", data["plan"])
```

- [ ] **Step 2: Run to confirm it fails**

Run: `python3 -m pytest tests/test_api.py::TestPlannerAPI::test_24_post_chat_generate -v`
Expected: FAIL — 404 Not Found

- [ ] **Step 3: Add the `/api/chat/generate` endpoint to server.py**

Add directly after the `post_chat` function (still before `app.mount`):

```python
@app.post("/api/chat/generate")
def post_chat_generate(body: ChatIn, conn=Depends(get_db)):
    base_profile = _json.dumps(body.profile, indent=2)
    system = GYMBOT_EXTRACT_PROMPT.format(base_profile=base_profile)
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    messages.append({"role": "user", "content": "Extract the complete profile from our conversation above."})

    try:
        raw = planner.chat_with_claude(messages, system)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        profile = _json.loads(raw[start:end])
    except Exception:
        profile = body.profile

    if not profile:
        raise HTTPException(status_code=400, detail="Could not extract profile from conversation")

    plan = planner.generate_plan(profile, conn)
    return {"ok": True, "plan": plan}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `python3 -m pytest tests/test_api.py::TestPlannerAPI::test_24_post_chat_generate -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `python3 -m pytest tests/ -v`
Expected: all 61 tests pass

- [ ] **Step 6: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add POST /api/chat/generate endpoint for GymBot plan generation"
```

---

### Task 4: Add GymBot tab to index.html

**Files:**
- Modify: `static/index.html`

- [ ] **Step 1: Add the third tab button and content panel to index.html**

In `static/index.html`, update the `.tabs` div and add the new tab panel. The file should look like this after the change:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planner</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="toast" class="toast"></div>

  <div class="tabs">
    <button class="tab active" data-tab="plans">📋 Saved Plans</button>
    <button class="tab" data-tab="new">✨ New Plan</button>
    <button class="tab" data-tab="chat">💬 GymBot</button>
  </div>

  <div id="plans-tab" class="tab-content active">
    <div id="plans-list"></div>
  </div>

  <div id="new-tab" class="tab-content">
    <div id="wizard"></div>
  </div>

  <div id="chat-tab" class="tab-content">
    <div id="gymbot"></div>
  </div>

  <!-- Edit modal -->
  <div id="modal-overlay" class="modal-overlay hidden">
    <div id="modal" class="modal">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">Edit Plan</h2>
          <p class="modal-subtitle">Edit exercises, meals, and caloric info for each day</p>
        </div>
        <button class="modal-close" id="modal-close">×</button>
      </div>
      <div id="modal-day-tabs" class="day-tabs-row"></div>
      <div id="modal-body" class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="modal-save">Save Changes</button>
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the server still imports cleanly**

Run: `python3 -c "from server import app; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add static/index.html
git commit -m "feat: add GymBot third tab to index.html"
```

---

### Task 5: Add chat UI styles to style.css

**Files:**
- Modify: `static/style.css`

- [ ] **Step 1: Append these styles at the end of static/style.css**

```css
/* GymBot chat */
.chat-wrap {
  max-width: 600px;
  display: flex;
  flex-direction: column;
  height: 70vh;
  min-height: 400px;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 12px;
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #0a0a0f;
  border-bottom: 1px solid #1f2937;
  flex-shrink: 0;
}
.chat-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e94560;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.chat-name { font-weight: 700; font-size: 15px; }
.chat-status { font-size: 11px; color: #4ade80; }
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chat-bubble-wrap-bot { display: flex; gap: 8px; align-items: flex-start; }
.chat-bubble-wrap-user { display: flex; justify-content: flex-end; }
.chat-mini-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e94560;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}
.chat-sender {
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 4px;
  font-weight: 600;
}
.chat-bubble-bot {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  border-top-left-radius: 3px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 80%;
}
.chat-bubble-user {
  background: #0f3460;
  border: 1px solid #1e4080;
  border-radius: 12px;
  border-top-right-radius: 3px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 75%;
}
.chat-typing { color: #9ca3af; font-style: italic; }
.chat-generate-btn {
  margin-top: 8px;
  background: #e94560;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.15s;
}
.chat-generate-btn:hover { opacity: 0.85; }
.chat-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-input-row {
  border-top: 1px solid #1f2937;
  padding: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  background: #0a0a0f;
}
.chat-send-btn {
  background: #e94560;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.chat-send-btn:hover { opacity: 0.85; }
.chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Verify the file has no syntax errors by opening the app**

Open `http://localhost:8080` in browser. No visual regressions on Saved Plans tab.

- [ ] **Step 3: Commit**

```bash
git add static/style.css
git commit -m "feat: add GymBot chat UI styles"
```

---

### Task 6: Add GymBot JavaScript to app.js

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Add chat state fields to the `state` object at the top of app.js**

Find the `state` object (lines 1-12) and add three new fields:

```javascript
const state = {
  plans: [],
  questions: [],
  profile: {},
  openPlanId: null,
  viewDay: {},
  editPlan: null,
  editDay: "Mon",
  wizardStep: 0,
  wizardAnswers: {},
  chatMessages: [],    // [{role: "user"|"assistant", content: str}]
  chatReady: false,    // true when GymBot signals ready to generate
  chatLoading: false,  // true while waiting for API response
};
```

- [ ] **Step 2: Update the tab click listener to call `renderChat()` when chat tab is clicked**

Find the tab click listener (around line 52) and add `if (tab === "chat") renderChat();`:

```javascript
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === tab + "-tab"));
    if (tab === "new") renderWizard();
    if (tab === "chat") renderChat();
  });
});
```

- [ ] **Step 3: Add all GymBot functions to app.js**

Add the following block immediately after the `generateFromWizard` function (before the `// Modal button listeners` comment):

```javascript
// ── GymBot Chat ───────────────────────────────────────────────────────────────
function renderChat() {
  const el = document.getElementById("gymbot");
  if (!el) return;

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

  const generateHTML = (state.chatReady && !state.chatLoading) ? `
    <button class="chat-generate-btn" id="chat-gen-btn">Generate my plan ✨</button>` : "";

  const inputDisabled = state.chatLoading || state.chatReady ? "disabled" : "";

  el.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-header">
        <div class="chat-avatar">🤖</div>
        <div style="flex:1">
          <div class="chat-name">GymBot</div>
          <div class="chat-status">● Ready to build your plan</div>
        </div>
        <button class="btn btn-secondary" id="chat-reset-btn" style="font-size:11px">New chat</button>
      </div>
      <div class="chat-messages" id="chat-messages-list">
        ${messagesHTML}
        ${typingHTML}
        ${generateHTML}
      </div>
      <div class="chat-input-row">
        <input class="input" id="chat-input" placeholder="Message GymBot…"
          style="flex:1;border-radius:20px;padding:9px 16px" ${inputDisabled}>
        <button class="chat-send-btn" id="chat-send-btn" ${inputDisabled}>↑</button>
      </div>
    </div>`;

  // Auto-scroll to bottom
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

  // Bind reset
  const resetBtn = document.getElementById("chat-reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetChat);

  // Bind generate
  const genBtn = document.getElementById("chat-gen-btn");
  if (genBtn) genBtn.addEventListener("click", generateFromChat);

  // Trigger opening greeting if chat is empty and not already loading
  if (state.chatMessages.length === 0 && !state.chatLoading) initChat();
}

async function initChat() {
  state.chatLoading = true;
  renderChat();
  const res = await api("POST", "/api/chat", { messages: [], profile: state.profile });
  if (res.message) {
    state.chatMessages.push({ role: "assistant", content: res.message });
  } else {
    state.chatMessages.push({ role: "assistant", content: "GymBot is unavailable. Check your ANTHROPIC_API_KEY." });
  }
  state.chatLoading = false;
  renderChat();
}

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
  state.chatLoading = false;
  renderChat();
}

async function generateFromChat() {
  const genBtn = document.getElementById("chat-gen-btn");
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = "Generating…"; }
  const res = await api("POST", "/api/chat/generate", { messages: state.chatMessages, profile: state.profile });
  if (res.ok) {
    toast("Plan generated!", "success");
    resetChat();
    document.querySelector('[data-tab="plans"]').click();
    await refreshPlans();
  } else {
    toast("Generation failed: " + (res.detail || res.error || "unknown"));
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = "Generate my plan ✨"; }
  }
}

function resetChat() {
  state.chatMessages = [];
  state.chatReady = false;
  state.chatLoading = false;
  renderChat();
}
```

- [ ] **Step 4: Verify the app loads without errors**

Run: `python3 -c "from server import app; print('ok')"`
Expected: `ok`

Open `http://localhost:8080`, open browser console — no JS errors. Saved Plans tab still shows plans correctly.

- [ ] **Step 5: Test the GymBot tab manually**

1. Click "💬 GymBot" tab — GymBot greeting should appear (requires `ANTHROPIC_API_KEY` set)
2. If no API key: input area should still render (greeting will show unavailable message from API 500)
3. Type a message and press Enter or click ↑ — user bubble appears, GymBot responds
4. Click "New chat" — conversation resets and new greeting loads
5. When GymBot eventually says it's ready, "Generate my plan ✨" button appears; clicking it creates a plan and switches to Saved Plans tab

- [ ] **Step 6: Run full test suite**

Run: `python3 -m pytest tests/ -v`
Expected: all 61 tests pass (chat JS is not tested at the test_api level — the API endpoints are covered by Tasks 2 and 3)

- [ ] **Step 7: Commit**

```bash
git add static/app.js
git commit -m "feat: implement GymBot chat UI — renderChat, sendMessage, generateFromChat"
```

---

### Task 7: Push to GitHub

- [ ] **Step 1: Confirm all tests pass one final time**

Run: `python3 -m pytest tests/ -v`
Expected: all 61 tests pass

- [ ] **Step 2: Push**

```bash
git push origin main
```
