# Backend: FastAPI Migration + Missing Endpoints

**Date:** 2026-04-28
**Status:** Approved

---

## Overview

Migrate `server.py` from Python's stdlib `http.server` to FastAPI with `uvicorn` as the dev server. Add six missing API endpoints covering check-offs, custom items, and the meal checker. `planner.py` remains unchanged — it is the business logic and DB layer.

---

## Architecture

```
server.py          ← FastAPI app (replaces BaseHTTPRequestHandler)
planner.py         ← unchanged (business logic, DB, AI)
static/            ← served via FastAPI's StaticFiles mount
requirements.txt   ← adds fastapi, uvicorn[standard]
```

All existing 9 routes carry over with identical behaviour, rewritten as FastAPI route decorators. No logic moves out of `planner.py`.

### DB Dependency

A single `Depends` function opens and closes a DB connection per request:

```python
def get_db():
    conn = planner.get_db()
    try:
        yield conn
    finally:
        conn.close()
```

### Static Files

Served via:

```python
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### Error Handling

All error responses use `HTTPException(status_code=..., detail=...)` — replaces the current manual `_json(404, {...})` pattern. FastAPI serialises these automatically.

---

## Pydantic Request Models

Defined at the top of `server.py`. Validate all incoming request bodies — replaces manual `json.loads` with no validation.

```python
class ProfileIn(BaseModel):
    goal: str
    gym_days: str
    rest_days: str
    meal_prep_day: str
    fitness_level: str
    equipment: str
    dietary_preference: str
    allergies: str
    daily_calorie_target: int
    protein_target_g: int

class CheckOffIn(BaseModel):
    week_start: str
    day: str
    item_type: str
    item_name: str

class CustomItemIn(BaseModel):
    item_type: str   # "meal" or "exercise"
    data: dict

class MealCheckIn(BaseModel):
    food_desc: str
```

All responses return plain `dict` or `list` — FastAPI serialises automatically.

---

## API Endpoints

### Existing (carried over unchanged)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/questions` | Profile wizard question definitions |
| GET | `/api/profile` | Load stored profile |
| PUT | `/api/profile` | Save profile |
| GET | `/api/plans` | List all saved plans |
| GET | `/api/plans/{id}` | Full plan data for one week |
| POST | `/api/plans/generate` | Generate new plan from profile |
| PUT | `/api/plans/{id}` | Save edited plan data |
| POST | `/api/plans/{id}/restore` | Set plan as current week |
| DELETE | `/api/plans/{id}` | Delete a saved plan |

### New: Check-offs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/check-offs` | Load check-offs for a week (`?week_start=YYYY-MM-DD`) |
| POST | `/api/check-offs` | Mark an item done |
| DELETE | `/api/check-offs/{id}` | Unmark an item (undo) |

`POST` body uses `CheckOffIn`. The `check_offs` table already has an `id` column — `DELETE` uses it directly.

### New: Custom Items

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/custom-items` | List all custom meals and exercises |
| POST | `/api/custom-items` | Add a custom meal or exercise |
| DELETE | `/api/custom-items/{id}` | Remove a custom item |

`POST` body uses `CustomItemIn`. Delegates to `planner.add_custom_item(conn, item_type, data)`.

### New: Meal Checker

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/meal-check` | Log what you ate, get AI feedback |

Body: `MealCheckIn`. Calls `planner.check_meal(profile, food_desc, conn)`. Returns `{ "feedback": str }`. Meal check history is stored in the `check_offs` table via the existing function — no separate history endpoint needed.

---

## Dev Server

Add to `requirements.txt`:

```
fastapi
uvicorn[standard]
```

Run with:

```
uvicorn server:app --reload --host localhost --port 8080
```

`--reload` watches for file changes and restarts automatically. Auto-generated interactive API docs available at `http://localhost:8080/docs` during development.

---

## Out of Scope

- Export endpoints (markdown/JSON) — frontend has no download UI; stays CLI-only
- Async AI generation with 202+polling — not requested; plan generation stays synchronous
- Changes to `planner.py` — no logic moves; it remains the single source of truth for all business logic and DB access
