# GymBot AI Chat — Design Spec

**Date:** 2026-04-29
**Status:** Approved

---

## Overview

A third tab — "💬 GymBot" — that lets users create a new weekly plan through a natural conversation with an AI fitness coach called GymBot. The user chats freely; GymBot gathers what it needs, then offers to generate the plan. The output is an identical saved weekly plan to the one produced by the step-by-step wizard.

---

## Architecture

Stateless multi-turn chat. The frontend holds the full conversation history as an array of `{role, content}` message objects. Every user message sends the full history and the stored profile to the backend. The backend makes a single Claude API call and returns the response. No server-side session state, no new DB tables.

**Two new endpoints in `server.py`:**

### `POST /api/chat`

```
Body:    { messages: [{role: "user"|"assistant", content: str}, ...], profile: dict }
Returns: { message: str, ready: bool }
```

Calls `planner.chat_with_claude(messages, system_prompt)` with GymBot's persona and the user's stored profile baked into the system prompt. Claude always responds with valid JSON `{"message": "...", "ready": false|true}`. When `ready` is `true`, GymBot has gathered enough information to build a complete plan.

### `POST /api/chat/generate`

```
Body:    { messages: [{role, content}, ...], profile: dict }
Returns: { ok: bool, plan: dict }
```

Sends the full conversation to Claude with a second system prompt instructing it to extract a complete profile JSON from the conversation (filling any gaps from the stored profile). Then calls the existing `planner.generate_plan(profile, conn)` — no new plan generation logic.

**New function in `planner.py`:**

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

Multi-turn version of the existing `ask_claude`. `planner.py` is otherwise unchanged.

---

## GymBot Personality & System Prompt

GymBot is a friendly, direct fitness coach. Its system prompt (injected into every `/api/chat` call) includes:

- The user's stored profile (goal, gym days, equipment, dietary preference, allergies, calorie/protein targets)
- Instructions to reference the profile naturally in the opening message
- Instructions to ask follow-up questions **one at a time** — never fire multiple questions in one message
- Instructions to gather: goal, gym days, meal prep day, fitness level, equipment, dietary restrictions, calorie/protein targets
- Instructions to always respond with valid JSON: `{"message": "...", "ready": false}`
- When it has all the information it needs, set `ready: true` and invite the user to generate

**Opening behaviour:** When the GymBot tab is first opened, the frontend automatically sends an empty message array to `/api/chat` (with the stored profile) to get GymBot's opening greeting. GymBot references the existing profile — e.g. *"Hey! I'm GymBot 💪 I can see you've been training to build muscle with dumbbells. Want to keep that going, or mix things up?"*

---

## Frontend

### HTML (`static/index.html`)

Add a third tab button and tab content panel:

```html
<button class="tab" data-tab="chat">💬 GymBot</button>
<div id="chat-tab" class="tab-content">
  <div id="gymbot"></div>
</div>
```

### JavaScript (`static/app.js`)

New state:

```javascript
chatMessages: [],   // [{role, content}, ...]
chatReady: false,   // true when GymBot signals ready
chatLoading: false, // true while waiting for API response
```

New functions:
- `renderChat()` — renders the full chat UI into `#gymbot` (header, message bubbles, input)
- `sendMessage(text)` — appends user message, calls `/api/chat`, appends GymBot response, re-renders; if `ready: true` sets `chatReady = true` and shows the generate button
- `generateFromChat()` — calls `/api/chat/generate`, on success saves plan, switches to Saved Plans tab, resets chat state
- `resetChat()` — clears `chatMessages`, `chatReady`, re-triggers opening greeting (bound to "New chat" button)

Tab click listener calls `renderChat()` when `data-tab="chat"` is clicked (same pattern as `renderWizard()`). Opening greeting fires automatically on first render if `chatMessages` is empty.

### CSS (`static/style.css`)

New classes:
- `.chat-wrap` — max-width container matching existing `.wizard-wrap`
- `.chat-header` — GymBot avatar, name, "● Ready", "New chat" button
- `.chat-messages` — scrollable message area
- `.chat-bubble-bot` — left-aligned bubble (dark background)
- `.chat-bubble-user` — right-aligned bubble (blue background)
- `.chat-avatar` — 28×28 red circle with 🤖
- `.chat-input-row` — fixed bottom input + send button

---

## UI Flow

1. User clicks "💬 GymBot" tab
2. `renderChat()` fires, shows chat UI, GymBot sends opening greeting (auto-fetched)
3. User types, back-and-forth conversation
4. GymBot says *"I've got everything — ready to generate your plan? 🚀"* and "Generate my plan ✨" button appears below the bubble
5. User clicks button → spinner → plan saved → auto-switch to Saved Plans tab → success toast
6. "New chat" button resets the conversation

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `ANTHROPIC_API_KEY` not set | Inline error in chat area: "GymBot is unavailable — set ANTHROPIC_API_KEY to use this feature." No input shown. |
| Claude API call fails mid-chat | Toast error, conversation history preserved, user can retry |
| Plan generation fails after confirmation | Toast error, "Generate my plan ✨" button re-enabled |
| Claude returns malformed JSON | Server falls back to treating raw text as the message, `ready: false` |

---

## Testing

Two new tests in `tests/test_api.py`:

- **`test_23_post_chat`** — POST `/api/chat` with a sample conversation and stored profile, mock `planner.chat_with_claude` to return `'{"message": "What equipment do you have?", "ready": false}'`, assert 200, assert `message` and `ready` keys present
- **`test_24_post_chat_generate`** — POST `/api/chat/generate` with a conversation, mock `planner.chat_with_claude` to return a valid profile JSON and mock `planner.enhance_plan_with_ai` to pass through, assert 200 and plan saved

---

## Files Changed

| File | Change |
|---|---|
| `planner.py` | Add `chat_with_claude(messages, system_prompt)` |
| `server.py` | Add `POST /api/chat`, `POST /api/chat/generate`, `ChatMessageIn` and `ChatIn` Pydantic models |
| `static/index.html` | Add third tab + chat tab content div |
| `static/app.js` | Add chat state, `renderChat`, `sendMessage`, `generateFromChat`, `resetChat` |
| `static/style.css` | Add chat bubble and layout styles |

---

## Out of Scope

- Conversation persistence across page loads
- Chat history saved to DB
- Streaming responses (Claude API streaming)
- GymBot answering general fitness questions outside of plan creation
