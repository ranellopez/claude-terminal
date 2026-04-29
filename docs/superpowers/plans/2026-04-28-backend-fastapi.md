# Backend: FastAPI Migration + Missing Endpoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `server.py` from stdlib `http.server` to FastAPI with `uvicorn --reload`, and add six new API endpoints covering check-offs, custom items, and meal checker.

**Architecture:** FastAPI app in `server.py` replaces `BaseHTTPRequestHandler`. `planner.py` gains three small DB helper functions required by the new endpoints. `tests/test_api.py` is rewritten to use FastAPI's `TestClient` (no thread, no real port).

**Tech Stack:** Python, FastAPI, uvicorn[standard], httpx (TestClient), Pydantic, SQLite (via planner.py — unchanged)

---

## File Map

| File | Change |
|------|--------|
| `requirements.txt` | Add `fastapi`, `uvicorn[standard]`, `httpx` |
| `planner.py` | Add `delete_check_off`, `list_custom_items`, `delete_custom_item` |
| `server.py` | Full rewrite — FastAPI app, Pydantic models, DB Depends |
| `tests/test_api.py` | Full rewrite — TestClient replaces threading + http.client |

---

### Task 1: Update requirements.txt

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Replace requirements.txt**

```
anthropic>=0.40.0
pytest
fastapi
uvicorn[standard]
httpx
```

- [ ] **Step 2: Install**

Run: `pip install -r requirements.txt`
Expected: packages install without error

- [ ] **Step 3: Verify imports**

Run: `python -c "import fastapi, uvicorn, httpx; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add requirements.txt
git commit -m "deps: add fastapi, uvicorn, httpx"
```

---

### Task 2: Add three helper functions to planner.py

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write three failing tests at the end of tests/test_planner.py**

Add after the last test in `tests/test_planner.py`:

```python
def test_delete_check_off():
    conn = make_conn()
    init_db(conn)
    mark_done(conn, "2026-04-21", "Mon", "exercise", "Push-ups")
    row = conn.execute("SELECT id FROM check_offs WHERE week_start='2026-04-21'").fetchone()
    assert row is not None
    from planner import delete_check_off
    ok = delete_check_off(conn, row["id"])
    assert ok is True
    gone = conn.execute("SELECT * FROM check_offs WHERE id=?", (row["id"],)).fetchone()
    assert gone is None


def test_list_custom_items():
    conn = make_conn()
    init_db(conn)
    from planner import list_custom_items
    add_custom_item(conn, "meal", {
        "name": "My Bowl",
        "meal_type": "lunch",
        "goal": ["maintain"],
        "dietary": ["none"],
        "protein_g": 20,
        "calories": 300,
    })
    items = list_custom_items(conn)
    assert len(items) == 1
    assert items[0]["item_type"] == "meal"
    assert items[0]["data"]["name"] == "My Bowl"
    assert "id" in items[0]


def test_delete_custom_item():
    conn = make_conn()
    init_db(conn)
    from planner import list_custom_items, delete_custom_item
    add_custom_item(conn, "exercise", {
        "name": "Delete Me",
        "goal": ["maintain"],
        "equipment": ["bodyweight"],
        "muscle_group": "core",
        "sets": 3,
        "reps": "10",
    })
    items = list_custom_items(conn)
    item_id = items[0]["id"]
    ok = delete_custom_item(conn, item_id)
    assert ok is True
    assert list_custom_items(conn) == []
```

- [ ] **Step 2: Run to confirm failure**

Run: `pytest tests/test_planner.py::test_delete_check_off tests/test_planner.py::test_list_custom_items tests/test_planner.py::test_delete_custom_item -v`
Expected: FAIL — `ImportError: cannot import name 'delete_check_off'`

- [ ] **Step 3: Add the three functions to planner.py**

Add after `restore_plan_by_id` (around line 393 in planner.py):

```python
def delete_check_off(conn, check_off_id):
    result = conn.execute("DELETE FROM check_offs WHERE id=?", (check_off_id,))
    conn.commit()
    return result.rowcount > 0


def list_custom_items(conn):
    rows = conn.execute(
        "SELECT id, item_type, data_json FROM custom_items"
    ).fetchall()
    return [
        {"id": r["id"], "item_type": r["item_type"], "data": json.loads(r["data_json"])}
        for r in rows
    ]


def delete_custom_item(conn, item_id):
    result = conn.execute("DELETE FROM custom_items WHERE id=?", (item_id,))
    conn.commit()
    return result.rowcount > 0
```

- [ ] **Step 4: Run new tests to confirm they pass**

Run: `pytest tests/test_planner.py::test_delete_check_off tests/test_planner.py::test_list_custom_items tests/test_planner.py::test_delete_custom_item -v`
Expected: PASS — all three green

- [ ] **Step 5: Run full test_planner.py to confirm no regressions**

Run: `pytest tests/test_planner.py -v`
Expected: all existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add delete_check_off, list_custom_items, delete_custom_item to planner"
```

---

### Task 3: Rewrite server.py as FastAPI app (existing 9 endpoints)

**Files:**
- Modify: `server.py`

- [ ] **Step 1: Replace server.py entirely**

```python
import os
import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))
import planner

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Planner API")


# --- Pydantic models ---

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


class PlanUpdateIn(BaseModel):
    plan: dict


class CheckOffIn(BaseModel):
    week_start: str
    day: str
    item_type: str
    item_name: str


class CustomItemIn(BaseModel):
    item_type: str
    data: dict


class MealCheckIn(BaseModel):
    food_desc: str


# --- DB dependency ---

def get_db():
    conn = planner.get_db()
    try:
        yield conn
    finally:
        conn.close()


# --- Profile ---

@app.get("/api/questions")
def get_questions():
    return planner.QUESTIONS


@app.get("/api/profile")
def get_profile(conn=Depends(get_db)):
    return planner.load_profile(conn) or {}


@app.put("/api/profile")
def put_profile(body: ProfileIn, conn=Depends(get_db)):
    planner.save_profile(conn, body.model_dump())
    return {"ok": True}


# --- Plans ---

@app.post("/api/plans/generate")
def generate_plan(body: Optional[ProfileIn] = None, conn=Depends(get_db)):
    if body:
        planner.save_profile(conn, body.model_dump())
    profile = planner.load_profile(conn)
    if profile is None:
        raise HTTPException(status_code=400, detail="Profile not configured")
    plan = planner.generate_plan(profile, conn)
    return {"ok": True, "plan": plan}


@app.get("/api/plans")
def list_plans(conn=Depends(get_db)):
    return planner.get_all_plans(conn)


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: int, conn=Depends(get_db)):
    data = planner.get_plan_by_id(conn, plan_id)
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data


@app.put("/api/plans/{plan_id}")
def update_plan(plan_id: int, body: PlanUpdateIn, conn=Depends(get_db)):
    ok = planner.update_plan_by_id(conn, plan_id, body.plan)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.post("/api/plans/{plan_id}/restore")
def restore_plan(plan_id: int, conn=Depends(get_db)):
    ok = planner.restore_plan_by_id(conn, plan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.delete("/api/plans/{plan_id}")
def delete_plan(plan_id: int, conn=Depends(get_db)):
    ok = planner.delete_plan_by_id(conn, plan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


# --- Static files (must be last) ---
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
```

- [ ] **Step 2: Verify the app imports cleanly**

Run: `python -c "from server import app; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Start the dev server and confirm it runs**

Run: `uvicorn server:app --reload --host localhost --port 8080`
Expected: `INFO:     Application startup complete.` — stop with Ctrl+C

- [ ] **Step 4: Confirm API docs load**

While the server is running, open `http://localhost:8080/docs` in a browser.
Expected: FastAPI Swagger UI showing 9 endpoints

- [ ] **Step 5: Commit**

```bash
git add server.py
git commit -m "feat: migrate server.py to FastAPI with existing 9 endpoints"
```

---

### Task 4: Rewrite tests/test_api.py to use FastAPI TestClient

**Files:**
- Modify: `tests/test_api.py`

Note: Two test calls change signature vs the original:
- `test_06` no longer sends `{}` (sends no body — profile already saved in test_03)
- `test_11` no longer sends `{}` (restore has no body parameter)

- [ ] **Step 1: Replace tests/test_api.py entirely**

```python
import sys
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

sys.path.insert(0, ".")
import planner
from server import app

SAMPLE_PROFILE = {
    "goal": "build_muscle",
    "gym_days": "Mon,Tue,Wed,Thu,Fri,Sun",
    "rest_days": "Sat",
    "meal_prep_day": "Sun",
    "fitness_level": "intermediate",
    "equipment": "dumbbells,barbell,bodyweight",
    "dietary_preference": "none",
    "allergies": "peanuts",
    "daily_calorie_target": 2800,
    "protein_target_g": 180,
}


class TestPlannerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix=".db")
        planner.DB_PATH = cls.db_path
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        planner.DB_PATH = "planner.db"
        os.close(cls.db_fd)
        os.unlink(cls.db_path)

    def _req(self, method, path, body=None, params=None):
        fn = getattr(self.client, method.lower())
        kwargs = {}
        if body is not None:
            kwargs["json"] = body
        if params is not None:
            kwargs["params"] = params
        resp = fn(path, **kwargs)
        return resp.status_code, resp.json()

    def test_01_get_questions_returns_8(self):
        status, data = self._req("GET", "/api/questions")
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 8)
        self.assertIn("key", data[0])
        self.assertIn("why", data[0])

    def test_02_get_profile_empty(self):
        status, data = self._req("GET", "/api/profile")
        self.assertEqual(status, 200)
        self.assertEqual(data, {})

    def test_03_save_profile(self):
        status, _ = self._req("PUT", "/api/profile", SAMPLE_PROFILE)
        self.assertEqual(status, 200)

    def test_04_load_profile(self):
        status, data = self._req("GET", "/api/profile")
        self.assertEqual(status, 200)
        self.assertEqual(data["goal"], "build_muscle")
        self.assertEqual(data["protein_target_g"], 180)

    def test_05_list_plans_empty(self):
        status, data = self._req("GET", "/api/plans")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_06_generate_plan(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
             patch("planner.enhance_plan_with_ai", side_effect=lambda p, plan: plan):
            status, data = self._req("POST", "/api/plans/generate")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertIn("Mon", data["plan"])

    def test_07_list_plans_after_generate(self):
        status, data = self._req("GET", "/api/plans")
        self.assertEqual(status, 200)
        self.assertGreater(len(data), 0)
        self.assertIn("week_start", data[0])
        self.assertIn("gym_days", data[0])
        self.assertIn("goal", data[0])

    def test_08_get_plan_by_id(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        status, data = self._req("GET", f"/api/plans/{plan_id}")
        self.assertEqual(status, 200)
        self.assertIn("plan", data)
        self.assertIn("Mon", data["plan"])

    def test_09_get_plan_missing(self):
        status, data = self._req("GET", "/api/plans/99999")
        self.assertEqual(status, 404)

    def test_10_update_plan(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        _, plan_data = self._req("GET", f"/api/plans/{plan_id}")
        plan = plan_data["plan"]
        for day, entry in plan.items():
            if entry["type"] == "gym":
                plan[day]["exercises"][0]["name"] = "Test Exercise"
                break
        status, _ = self._req("PUT", f"/api/plans/{plan_id}", {"plan": plan})
        self.assertEqual(status, 200)
        _, updated = self._req("GET", f"/api/plans/{plan_id}")
        gym_days = [d for d, e in updated["plan"].items() if e["type"] == "gym"]
        self.assertEqual(updated["plan"][gym_days[0]]["exercises"][0]["name"], "Test Exercise")

    def test_11_restore_plan(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        status, data = self._req("POST", f"/api/plans/{plan_id}/restore")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        _, updated_plans = self._req("GET", "/api/plans")
        current = [p for p in updated_plans if p["is_current"]]
        self.assertTrue(len(current) > 0)

    def test_12_delete_plan(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
             patch("planner.enhance_plan_with_ai", side_effect=lambda p, plan: plan):
            self._req("POST", "/api/plans/generate")
        _, plans_before = self._req("GET", "/api/plans")
        plan_id = plans_before[-1]["id"]
        status, _ = self._req("DELETE", f"/api/plans/{plan_id}")
        self.assertEqual(status, 200)
        _, plans_after = self._req("GET", "/api/plans")
        self.assertNotIn(plan_id, [p["id"] for p in plans_after])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the existing 12 tests**

Run: `pytest tests/test_api.py -v`
Expected: all 12 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_api.py
git commit -m "test: rewrite test_api.py to use FastAPI TestClient"
```

---

### Task 5: Add check-off endpoints (TDD)

**Files:**
- Modify: `tests/test_api.py`
- Modify: `server.py`

- [ ] **Step 1: Add four failing tests to the TestPlannerAPI class in tests/test_api.py**

Add after `test_12_delete_plan`:

```python
    def test_13_get_check_offs_empty(self):
        status, data = self._req("GET", "/api/check-offs", params={"week_start": "2020-01-01"})
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_14_post_check_off(self):
        status, data = self._req("POST", "/api/check-offs", {
            "week_start": "2026-04-21",
            "day": "Mon",
            "item_type": "exercise",
            "item_name": "Push-ups",
        })
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])

    def test_15_get_check_offs_after_post(self):
        status, data = self._req("GET", "/api/check-offs", params={"week_start": "2026-04-21"})
        self.assertEqual(status, 200)
        names = [c["item_name"] for c in data]
        self.assertIn("Push-ups", names)

    def test_16_delete_check_off(self):
        self._req("POST", "/api/check-offs", {
            "week_start": "2026-04-21",
            "day": "Tue",
            "item_type": "exercise",
            "item_name": "Squats",
        })
        _, check_offs = self._req("GET", "/api/check-offs", params={"week_start": "2026-04-21"})
        target = next(c for c in check_offs if c["item_name"] == "Squats")
        status, data = self._req("DELETE", f"/api/check-offs/{target['id']}")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        _, remaining = self._req("GET", "/api/check-offs", params={"week_start": "2026-04-21"})
        self.assertNotIn("Squats", [c["item_name"] for c in remaining])
```

- [ ] **Step 2: Run new tests to confirm they fail**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_13_get_check_offs_empty tests/test_api.py::TestPlannerAPI::test_14_post_check_off tests/test_api.py::TestPlannerAPI::test_15_get_check_offs_after_post tests/test_api.py::TestPlannerAPI::test_16_delete_check_off -v`
Expected: FAIL — 404 Not Found (routes don't exist yet)

- [ ] **Step 3: Add check-off routes to server.py**

Add after the `delete_plan` route and before the `app.mount` line at the bottom of `server.py`:

```python
# --- Check-offs ---

@app.get("/api/check-offs")
def get_check_offs(week_start: str, conn=Depends(get_db)):
    return planner.load_check_offs(conn, week_start)


@app.post("/api/check-offs")
def post_check_off(body: CheckOffIn, conn=Depends(get_db)):
    planner.mark_done(conn, body.week_start, body.day, body.item_type, body.item_name)
    return {"ok": True}


@app.delete("/api/check-offs/{check_off_id}")
def delete_check_off(check_off_id: int, conn=Depends(get_db)):
    ok = planner.delete_check_off(conn, check_off_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}
```

- [ ] **Step 4: Run new tests to confirm they pass**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_13_get_check_offs_empty tests/test_api.py::TestPlannerAPI::test_14_post_check_off tests/test_api.py::TestPlannerAPI::test_15_get_check_offs_after_post tests/test_api.py::TestPlannerAPI::test_16_delete_check_off -v`
Expected: PASS — all four green

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `pytest tests/test_api.py -v`
Expected: all 16 tests pass

- [ ] **Step 6: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add check-off endpoints GET/POST/DELETE /api/check-offs"
```

---

### Task 6: Add custom items endpoints (TDD)

**Files:**
- Modify: `tests/test_api.py`
- Modify: `server.py`

- [ ] **Step 1: Add four failing tests to the TestPlannerAPI class in tests/test_api.py**

Add after `test_16_delete_check_off`:

```python
    def test_17_get_custom_items_empty(self):
        status, data = self._req("GET", "/api/custom-items")
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)

    def test_18_post_custom_meal(self):
        status, data = self._req("POST", "/api/custom-items", {
            "item_type": "meal",
            "data": {
                "name": "Test Bowl",
                "meal_type": "lunch",
                "goal": ["maintain"],
                "dietary": ["none"],
                "protein_g": 20,
                "calories": 300,
            },
        })
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])

    def test_19_get_custom_items_after_post(self):
        status, data = self._req("GET", "/api/custom-items")
        self.assertEqual(status, 200)
        names = [i["data"]["name"] for i in data]
        self.assertIn("Test Bowl", names)

    def test_20_delete_custom_item(self):
        self._req("POST", "/api/custom-items", {
            "item_type": "exercise",
            "data": {
                "name": "Delete Me",
                "goal": ["maintain"],
                "equipment": ["bodyweight"],
                "muscle_group": "core",
                "sets": 3,
                "reps": "10",
            },
        })
        _, items = self._req("GET", "/api/custom-items")
        target = next(i for i in items if i["data"]["name"] == "Delete Me")
        status, data = self._req("DELETE", f"/api/custom-items/{target['id']}")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        _, items_after = self._req("GET", "/api/custom-items")
        self.assertNotIn("Delete Me", [i["data"]["name"] for i in items_after])
```

- [ ] **Step 2: Run new tests to confirm they fail**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_17_get_custom_items_empty tests/test_api.py::TestPlannerAPI::test_18_post_custom_meal tests/test_api.py::TestPlannerAPI::test_19_get_custom_items_after_post tests/test_api.py::TestPlannerAPI::test_20_delete_custom_item -v`
Expected: FAIL — 404 Not Found

- [ ] **Step 3: Add custom items routes to server.py**

Add after the `delete_check_off` route and before the `app.mount` line:

```python
# --- Custom items ---

@app.get("/api/custom-items")
def get_custom_items(conn=Depends(get_db)):
    return planner.list_custom_items(conn)


@app.post("/api/custom-items")
def post_custom_item(body: CustomItemIn, conn=Depends(get_db)):
    planner.add_custom_item(conn, body.item_type, body.data)
    return {"ok": True}


@app.delete("/api/custom-items/{item_id}")
def delete_custom_item(item_id: int, conn=Depends(get_db)):
    ok = planner.delete_custom_item(conn, item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}
```

- [ ] **Step 4: Run new tests to confirm they pass**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_17_get_custom_items_empty tests/test_api.py::TestPlannerAPI::test_18_post_custom_meal tests/test_api.py::TestPlannerAPI::test_19_get_custom_items_after_post tests/test_api.py::TestPlannerAPI::test_20_delete_custom_item -v`
Expected: PASS — all four green

- [ ] **Step 5: Run full test suite**

Run: `pytest tests/test_api.py -v`
Expected: all 20 tests pass

- [ ] **Step 6: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add custom items endpoints GET/POST/DELETE /api/custom-items"
```

---

### Task 7: Add meal checker endpoint (TDD)

**Files:**
- Modify: `tests/test_api.py`
- Modify: `server.py`

- [ ] **Step 1: Add two failing tests to the TestPlannerAPI class in tests/test_api.py**

Add after `test_20_delete_custom_item`:

```python
    def test_21_post_meal_check(self):
        with patch("planner.ask_claude", return_value="Verdict: on track. ~520 kcal, 45g protein. Great protein source. Add more vegetables. Try a side salad next."):
            status, data = self._req("POST", "/api/meal-check", {"food_desc": "chicken breast and brown rice"})
        self.assertEqual(status, 200)
        self.assertIn("feedback", data)
        self.assertIsInstance(data["feedback"], str)
        self.assertTrue(len(data["feedback"]) > 0)

    def test_22_post_meal_check_no_profile(self):
        import sqlite3 as _sqlite3
        conn = _sqlite3.connect(planner.DB_PATH)
        conn.execute("DELETE FROM profile")
        conn.commit()
        conn.close()
        status, _ = self._req("POST", "/api/meal-check", {"food_desc": "pizza"})
        self.assertEqual(status, 400)
        # restore profile for any tests that follow
        self._req("PUT", "/api/profile", SAMPLE_PROFILE)
```

- [ ] **Step 2: Run new tests to confirm they fail**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_21_post_meal_check tests/test_api.py::TestPlannerAPI::test_22_post_meal_check_no_profile -v`
Expected: FAIL — 404 Not Found

- [ ] **Step 3: Add meal checker route to server.py**

Add after the `delete_custom_item` route and before the `app.mount` line:

```python
# --- Meal checker ---

@app.post("/api/meal-check")
def post_meal_check(body: MealCheckIn, conn=Depends(get_db)):
    profile = planner.load_profile(conn)
    if profile is None:
        raise HTTPException(status_code=400, detail="Profile not configured")
    feedback = planner.check_meal(profile, body.food_desc, conn)
    return {"feedback": feedback}
```

- [ ] **Step 4: Run new tests to confirm they pass**

Run: `pytest tests/test_api.py::TestPlannerAPI::test_21_post_meal_check tests/test_api.py::TestPlannerAPI::test_22_post_meal_check_no_profile -v`
Expected: PASS — both green

- [ ] **Step 5: Run the entire test suite**

Run: `pytest tests/ -v`
Expected: all tests in both `test_planner.py` and `test_api.py` pass

- [ ] **Step 6: Start dev server and verify docs show all 15 endpoints**

Run: `uvicorn server:app --reload --host localhost --port 8080`
Open `http://localhost:8080/docs` — confirm all 15 routes appear

- [ ] **Step 7: Commit**

```bash
git add server.py tests/test_api.py
git commit -m "feat: add meal checker endpoint POST /api/meal-check"
```
