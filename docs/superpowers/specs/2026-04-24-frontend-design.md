# Web Frontend Design — Meal & Gym Planner

## Overview

A single-page web frontend served by a lightweight Python HTTP server that exposes `planner.py`'s functionality through a JSON API. The UI is vanilla HTML/CSS/JS — no framework, no build step.

---

## Architecture

### Server

- `server.py` — Python `http.server` subclass, serves `static/` files and handles `/api/*` routes
- Runs on `localhost:8080`
- All API handlers call the same functions already in `planner.py` (imported as a module)
- No authentication — local-only tool

### Frontend

- `static/index.html` — single page, all UI
- `static/style.css` — dark theme styles (extracted from mockup)
- `static/app.js` — all client-side logic (fetch calls, DOM manipulation, state)

### planner.py changes

- Wrap DB-touching functions so they can be called from `server.py` without launching the CLI
- No new logic — only surface existing functions through the API layer

---

## Pages / Views

The frontend is a single page with two tabs.

### Saved Plans Tab

- Lists all saved weekly plans from the `weekly_plans` DB table
- Current plan has a green "Current" badge
- Each plan card shows: week start date, gym days count, goal, daily kcal, protein target
- Actions per card: **View**, **Edit**, **Restore** (non-current only), **Delete** (non-current only)

**View mode** (expands inline below the card):
- Stats bar: daily kcal target, protein target, gym days count, meal prep day
- Day tabs: Mon–Sun
- Per day:
  - Calorie progress bar (logged / target kcal, percentage)
  - Protein progress bar (logged / target g, percentage)
  - Gym days: WORKOUT section — exercise rows with sets × reps
  - Rest days: REST ACTIVITY section — activity name
  - Meal prep day: MEAL PREP TASKS section — task list with quantities
  - All days: MEALS section — breakfast/lunch/dinner/snack with kcal and protein per meal

**Edit modal** (opens as overlay):
- Day tabs: Mon–Sun
- Per day (gym):
  - Daily Targets: calories (kcal input) + protein (g input)
  - Exercises: rows of [name | sets | reps | × delete], + Add Exercise button
  - Meals: rows of [meal name | kcal | protein] for breakfast/lunch/dinner/snack
- Per day (rest):
  - Daily Targets: calories + protein inputs
  - Rest Activity: single text input
  - Meals: same as above
- Per day (meal prep):
  - Daily Targets: calories + protein inputs
  - Meal Prep Tasks: rows of [task text | × delete], + Add Task button
  - Meals: same as above
- Save Changes / Cancel buttons

### New Plan Tab

- One-question-at-a-time wizard, same 8 questions as the CLI profile wizard
- Progress bar (question N of 8)
- Back / Next navigation
- Questions pre-filled with the stored profile if one exists
- Each question shows an explanation of why it matters (italic green text)
- Final screen: summary of all answers before generating
- Generate button calls `/api/plans/generate` and redirects to Saved Plans tab

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/plans` | List all saved plans (id, week_start, metadata) |
| GET | `/api/plans/:id` | Full plan data for one week (all 7 days) |
| POST | `/api/plans/generate` | Generate new plan from profile answers |
| PUT | `/api/plans/:id` | Save edited plan data |
| POST | `/api/plans/:id/restore` | Set plan as current week |
| DELETE | `/api/plans/:id` | Delete a saved plan |
| GET | `/api/profile` | Load stored profile |
| PUT | `/api/profile` | Save profile |

---

## Data Flow

```
User action (click View / Edit / Save)
  → app.js fetch call to /api/*
  → server.py routes to planner.py function
  → planner.py reads/writes SQLite (planner.db)
  → JSON response
  → app.js updates DOM
```

No page reloads. All state lives in `app.js` memory for the current session; persistence is SQLite.

---

## Shared Question Engine

The 8 wizard questions are defined once in `planner.py` as a `QUESTIONS` list. Each entry has:
- `key` — profile field name
- `question` — display text
- `why` — explanation shown in italic below the question
- `type` — `single`, `multi`, or `text`
- `options` — list of choices (for single/multi)

`server.py` exposes these at `GET /api/questions` so `app.js` renders them dynamically. The CLI wizard also reads from this same list.

---

## Error Handling

- API errors return `{"error": "message"}` with an appropriate HTTP status
- Frontend shows a toast notification for errors (red) and successes (green)
- If `planner.db` doesn't exist, `server.py` calls `init_db()` on startup
- Generate endpoint returns a 202 with a job token if AI enhancement is slow; frontend polls `/api/plans/status/:token`

---

## Testing

- `tests/test_api.py` — integration tests using Python's `http.client` against a live test server with an in-memory DB
- Cover: list plans, get plan, generate plan (mocked AI), edit plan, restore plan, delete plan, load/save profile
- Existing `tests/test_planner.py` unit tests remain unchanged

---

## File Structure

```
claude-terminal/
├── planner.py          # existing — add module-safe entry point
├── server.py           # new — HTTP server + API routes
├── static/
│   ├── index.html      # new — single page app
│   ├── style.css       # new — dark theme
│   └── app.js          # new — all client JS
└── tests/
    └── test_api.py     # new — API integration tests
```
