# Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web frontend (served by `server.py`) over the existing `planner.py` backend, adding a card-based plan history dashboard, per-day view with all factors, a full edit modal, and a New Plan wizard using the shared `QUESTIONS` list.

**Architecture:** `server.py` is a `ThreadingHTTPServer` subclass that serves `static/` files and routes `/api/*` requests to existing `planner.py` functions. The frontend is vanilla HTML/CSS/JS — no framework, no build step. `planner.py` gains a `QUESTIONS` list and five plan CRUD functions; the CLI is unchanged.

**Tech Stack:** Python stdlib (`http.server`, `json`, `re`, `threading`), SQLite via `planner.py`, vanilla JS (ES6), `pytest` for unit tests, Python `http.client` for API integration tests.

---

## File Structure

```
claude-terminal/
├── planner.py              # modify: add QUESTIONS list + plan CRUD functions
├── server.py               # create: HTTP server + all API routes
├── static/
│   ├── index.html          # create: single-page shell
│   ├── style.css           # create: dark theme
│   └── app.js              # create: all client-side logic
└── tests/
    ├── test_planner.py     # modify: add tests for new planner functions
    └── test_api.py         # create: integration tests for server.py API
```

---

## Task 1: Extend planner.py — QUESTIONS list and plan CRUD

**Files:**
- Modify: `planner.py` (add after `REST_ACTIVITIES` list and after `load_current_plan`)
- Modify: `tests/test_planner.py` (add imports + 7 new tests at bottom)

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `tests/test_planner.py`:

```python
from planner import QUESTIONS, get_all_plans, get_plan_by_id, update_plan_by_id, delete_plan_by_id, restore_plan_by_id


def test_questions_has_8_items():
    assert len(QUESTIONS) == 8
    for q in QUESTIONS:
        assert "key" in q
        assert "question" in q
        assert "why" in q
        assert "type" in q


def test_get_all_plans_empty():
    conn = make_conn()
    init_db(conn)
    assert get_all_plans(conn) == []


def test_get_all_plans_returns_saved_plan():
    conn = make_conn()
    init_db(conn)
    save_profile(conn, SAMPLE_PROFILE)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    save_plan(conn, "2026-04-20", plan)
    plans = get_all_plans(conn)
    assert len(plans) == 1
    assert plans[0]["week_start"] == "2026-04-20"
    assert "gym_days" in plans[0]
    assert "goal" in plans[0]


def test_get_plan_by_id_returns_plan():
    conn = make_conn()
    init_db(conn)
    save_profile(conn, SAMPLE_PROFILE)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    save_plan(conn, "2026-04-20", plan)
    plans = get_all_plans(conn)
    plan_id = plans[0]["id"]
    result = get_plan_by_id(conn, plan_id)
    assert result is not None
    assert "plan" in result
    assert "Mon" in result["plan"]


def test_get_plan_by_id_missing_returns_none():
    conn = make_conn()
    init_db(conn)
    assert get_plan_by_id(conn, 99999) is None


def test_update_plan_by_id():
    conn = make_conn()
    init_db(conn)
    save_profile(conn, SAMPLE_PROFILE)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    save_plan(conn, "2026-04-20", plan)
    plan_id = get_all_plans(conn)[0]["id"]
    plan["Mon"]["exercises"] = [{"name": "Modified", "sets": 1, "reps": "5"}]
    update_plan_by_id(conn, plan_id, plan)
    updated = get_plan_by_id(conn, plan_id)
    assert updated["plan"]["Mon"]["exercises"][0]["name"] == "Modified"


def test_delete_plan_by_id():
    conn = make_conn()
    init_db(conn)
    save_profile(conn, SAMPLE_PROFILE)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    save_plan(conn, "2026-04-20", plan)
    plan_id = get_all_plans(conn)[0]["id"]
    delete_plan_by_id(conn, plan_id)
    assert get_plan_by_id(conn, plan_id) is None
    assert get_all_plans(conn) == []


def test_restore_plan_by_id():
    conn = make_conn()
    init_db(conn)
    save_profile(conn, SAMPLE_PROFILE)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    save_plan(conn, "2020-01-06", plan)
    plan_id = get_all_plans(conn)[0]["id"]
    ok = restore_plan_by_id(conn, plan_id)
    assert ok is True
    current = load_current_plan(conn)
    assert current is not None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 -m pytest tests/test_planner.py -k "questions or get_all_plans or get_plan_by_id or update_plan_by_id or delete_plan_by_id or restore_plan_by_id" -v
```

Expected: `ImportError` — `QUESTIONS`, `get_all_plans`, etc. not yet defined.

- [ ] **Step 3: Add QUESTIONS list to planner.py**

Add this block immediately after the `REST_ACTIVITIES` list (after line 50) in `planner.py`:

```python
QUESTIONS = [
    {
        "key": "goal",
        "question": "What is your fitness goal?",
        "why": "This drives which exercises and meals get recommended for you.",
        "type": "single",
        "options": [
            {"label": "Lose Weight", "value": "lose_weight"},
            {"label": "Build Muscle", "value": "build_muscle"},
            {"label": "Maintain", "value": "maintain"},
            {"label": "Endurance", "value": "endurance"},
        ],
    },
    {
        "key": "gym_days",
        "question": "Which days do you go to the gym?",
        "why": "These days get workout plans assigned. Everything else becomes rest or meal prep.",
        "type": "multi",
        "options": [
            {"label": "Mon", "value": "Mon"},
            {"label": "Tue", "value": "Tue"},
            {"label": "Wed", "value": "Wed"},
            {"label": "Thu", "value": "Thu"},
            {"label": "Fri", "value": "Fri"},
            {"label": "Sat", "value": "Sat"},
            {"label": "Sun", "value": "Sun"},
        ],
    },
    {
        "key": "meal_prep_day",
        "question": "Which day do you do meal prep?",
        "why": "This day gets a prep task list so your meals are ready for the week.",
        "type": "single",
        "options": [
            {"label": "Mon", "value": "Mon"},
            {"label": "Tue", "value": "Tue"},
            {"label": "Wed", "value": "Wed"},
            {"label": "Thu", "value": "Thu"},
            {"label": "Fri", "value": "Fri"},
            {"label": "Sat", "value": "Sat"},
            {"label": "Sun", "value": "Sun"},
        ],
    },
    {
        "key": "fitness_level",
        "question": "What is your fitness level?",
        "why": "Sets your calorie and protein targets and adjusts exercise intensity.",
        "type": "single",
        "options": [
            {"label": "Beginner", "value": "beginner"},
            {"label": "Intermediate", "value": "intermediate"},
            {"label": "Advanced", "value": "advanced"},
        ],
    },
    {
        "key": "equipment",
        "question": "What equipment do you have access to?",
        "why": "Only exercises you can actually do get included in your plan.",
        "type": "multi",
        "options": [
            {"label": "Dumbbells", "value": "dumbbells"},
            {"label": "Barbell", "value": "barbell"},
            {"label": "Cables", "value": "cables"},
            {"label": "Pull-up Bar", "value": "pull-up bar"},
            {"label": "Bodyweight", "value": "bodyweight"},
            {"label": "Resistance Bands", "value": "resistance bands"},
            {"label": "Kettlebells", "value": "kettlebells"},
        ],
    },
    {
        "key": "dietary_preference",
        "question": "Do you have a dietary preference?",
        "why": "Filters out meals that don't match how you eat.",
        "type": "single",
        "options": [
            {"label": "None", "value": "none"},
            {"label": "Vegetarian", "value": "vegetarian"},
            {"label": "Vegan", "value": "vegan"},
            {"label": "Gluten-Free", "value": "gluten-free"},
        ],
    },
    {
        "key": "allergies",
        "question": "Do you have any food allergies?",
        "why": "Ensures AI-generated meals never suggest something you can't eat.",
        "type": "text",
        "placeholder": "e.g. peanuts, dairy — or type none",
    },
    {
        "key": "daily_targets",
        "question": "What are your daily targets?",
        "why": "We'll estimate these based on your goal and level — you can override.",
        "type": "targets",
    },
]
```

- [ ] **Step 4: Add plan CRUD functions to planner.py**

Add these five functions immediately after `load_current_plan` (after line 233) in `planner.py`:

```python
def get_all_plans(conn):
    current_week = get_week_start()
    profile = load_profile(conn)
    rows = conn.execute(
        "SELECT id, week_start, plan_json, created_at FROM weekly_plans ORDER BY week_start DESC"
    ).fetchall()
    result = []
    for row in rows:
        plan = json.loads(row["plan_json"])
        result.append({
            "id": row["id"],
            "week_start": row["week_start"],
            "created_at": row["created_at"],
            "is_current": row["week_start"] == current_week,
            "gym_days": sum(1 for d in plan.values() if d.get("type") == "gym"),
            "goal": profile["goal"] if profile else "unknown",
            "daily_calorie_target": profile["daily_calorie_target"] if profile else 0,
            "protein_target_g": profile["protein_target_g"] if profile else 0,
            "meal_prep_day": profile["meal_prep_day"] if profile else "",
        })
    return result


def get_plan_by_id(conn, plan_id):
    row = conn.execute(
        "SELECT id, week_start, plan_json, created_at FROM weekly_plans WHERE id=?", (plan_id,)
    ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "week_start": row["week_start"],
        "created_at": row["created_at"],
        "is_current": row["week_start"] == get_week_start(),
        "plan": json.loads(row["plan_json"]),
    }


def update_plan_by_id(conn, plan_id, plan):
    conn.execute(
        "UPDATE weekly_plans SET plan_json=? WHERE id=?",
        (json.dumps(plan), plan_id)
    )
    conn.commit()


def delete_plan_by_id(conn, plan_id):
    conn.execute("DELETE FROM weekly_plans WHERE id=?", (plan_id,))
    conn.commit()


def restore_plan_by_id(conn, plan_id):
    row = conn.execute(
        "SELECT plan_json FROM weekly_plans WHERE id=?", (plan_id,)
    ).fetchone()
    if row is None:
        return False
    save_plan(conn, get_week_start(), json.loads(row["plan_json"]))
    return True
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_planner.py -v
```

Expected: all 29 tests PASS (22 existing + 7 new).

- [ ] **Step 6: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add QUESTIONS list and plan CRUD functions to planner"
```

---

## Task 2: Create server.py

**Files:**
- Create: `server.py`

- [ ] **Step 1: Create server.py**

```python
import sys
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import planner

PORT = 8080
STATIC_DIR = Path(__file__).parent / "static"

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class PlannerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/api/questions":
            self._json(200, planner.QUESTIONS)

        elif path == "/api/profile":
            conn = planner.get_db()
            try:
                self._json(200, planner.load_profile(conn) or {})
            finally:
                conn.close()

        elif path == "/api/plans":
            conn = planner.get_db()
            try:
                self._json(200, planner.get_all_plans(conn))
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            conn = planner.get_db()
            try:
                data = planner.get_plan_by_id(conn, plan_id)
                if data is None:
                    self._json(404, {"error": "not found"})
                else:
                    self._json(200, data)
            finally:
                conn.close()

        else:
            self._serve_static(path)

    def do_POST(self):
        path = self.path.split("?")[0]
        body = self._read_body()

        if path == "/api/plans/generate":
            conn = planner.get_db()
            try:
                if body:
                    planner.save_profile(conn, body)
                profile = planner.load_profile(conn)
                if profile is None:
                    self._json(400, {"error": "Profile not configured"})
                    return
                plan = planner.generate_plan(profile, conn)
                self._json(200, {"ok": True, "plan": plan})
            except Exception as e:
                self._json(500, {"error": str(e)})
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+/restore", path):
            plan_id = int(path.split("/")[-2])
            conn = planner.get_db()
            try:
                ok = planner.restore_plan_by_id(conn, plan_id)
                self._json(200 if ok else 404, {"ok": ok})
            finally:
                conn.close()

        else:
            self._json(404, {"error": "not found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        body = self._read_body()

        if path == "/api/profile":
            conn = planner.get_db()
            try:
                planner.save_profile(conn, body)
                self._json(200, {"ok": True})
            except Exception as e:
                self._json(400, {"error": str(e)})
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            conn = planner.get_db()
            try:
                planner.update_plan_by_id(conn, plan_id, body["plan"])
                self._json(200, {"ok": True})
            except Exception as e:
                self._json(400, {"error": str(e)})
            finally:
                conn.close()

        else:
            self._json(404, {"error": "not found"})

    def do_DELETE(self):
        path = self.path.split("?")[0]
        if re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            conn = planner.get_db()
            try:
                planner.delete_plan_by_id(conn, plan_id)
                self._json(200, {"ok": True})
            finally:
                conn.close()
        else:
            self._json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        file_path = STATIC_DIR / path.lstrip("/")
        if not file_path.exists() or not file_path.is_file():
            self.send_response(404)
            self.end_headers()
            return
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css",
            ".js": "application/javascript",
        }
        ct = content_types.get(file_path.suffix, "application/octet-stream")
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # suppress request logging


def make_server(port=PORT):
    return ThreadingHTTPServer(("localhost", port), PlannerHandler)


if __name__ == "__main__":
    os.makedirs(STATIC_DIR, exist_ok=True)
    server = make_server()
    print(f"Planner running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
```

- [ ] **Step 2: Verify server starts without errors**

```bash
cd /Users/ranel/Downloads/claude-terminal
mkdir -p static && echo "<h1>ok</h1>" > static/index.html
python3 server.py &
sleep 1
curl -s http://localhost:8080/ && echo ""
curl -s http://localhost:8080/api/questions | python3 -m json.tool | head -10
kill %1
```

Expected: `<h1>ok</h1>` then JSON array of 8 question objects.

- [ ] **Step 3: Commit**

```bash
git add server.py
git commit -m "feat: add HTTP server with API routes"
```

---

## Task 3: Write API integration tests

**Files:**
- Create: `tests/test_api.py`

- [ ] **Step 1: Write the tests**

Create `tests/test_api.py`:

```python
import sys
import os
import threading
import http.client
import json
import tempfile
import unittest

sys.path.insert(0, ".")
import planner
from server import make_server

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
        cls.server = make_server(port=8181)
        cls.thread = threading.Thread(target=cls.server.serve_forever)
        cls.thread.daemon = True
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        os.close(cls.db_fd)
        os.unlink(cls.db_path)

    def _req(self, method, path, body=None):
        conn = http.client.HTTPConnection("localhost", 8181, timeout=5)
        headers = {"Content-Type": "application/json"} if body is not None else {}
        encoded = json.dumps(body).encode() if body is not None else None
        conn.request(method, path, encoded, headers)
        resp = conn.getresponse()
        data = json.loads(resp.read())
        conn.close()
        return resp.status, data

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
        self.assertIsInstance(data, list)

    def test_06_generate_plan(self):
        status, data = self._req("POST", "/api/plans/generate", {})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertIn("Mon", data["plan"])

    def test_07_list_plans_after_generate(self):
        status, data = self._req("GET", "/api/plans")
        self.assertEqual(status, 200)
        self.assertGreater(len(data), 0)
        plan = data[0]
        self.assertIn("week_start", plan)
        self.assertIn("gym_days", plan)
        self.assertIn("goal", plan)

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
        self.assertIn("error", data)

    def test_10_update_plan(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        _, plan_data = self._req("GET", f"/api/plans/{plan_id}")
        plan = plan_data["plan"]
        # find a gym day and modify its first exercise name
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
        status, data = self._req("POST", f"/api/plans/{plan_id}/restore", {})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])

    def test_12_delete_plan(self):
        # generate a second plan so we can delete without removing the only one
        self._req("POST", "/api/plans/generate", {})
        _, plans_before = self._req("GET", "/api/plans")
        plan_id = plans_before[-1]["id"]
        status, _ = self._req("DELETE", f"/api/plans/{plan_id}")
        self.assertEqual(status, 200)
        _, plans_after = self._req("GET", "/api/plans")
        ids_after = [p["id"] for p in plans_after]
        self.assertNotIn(plan_id, ids_after)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 -m pytest tests/test_api.py -v
```

Expected: all 12 tests PASS. Note: test_06 will print "No ANTHROPIC_API_KEY found" to stdout — that is expected and harmless.

- [ ] **Step 3: Commit**

```bash
git add tests/test_api.py
git commit -m "test: add API integration tests for server.py"
```

---

## Task 4: Create static shell — index.html and style.css

**Files:**
- Create: `static/index.html`
- Create: `static/style.css`

- [ ] **Step 1: Create static/index.html**

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
  </div>

  <div id="plans-tab" class="tab-content active">
    <div id="plans-list"></div>
  </div>

  <div id="new-tab" class="tab-content">
    <div id="wizard"></div>
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

- [ ] **Step 2: Create static/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #0a0a0f;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

/* Tabs */
.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab {
  padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid #333; color: #888; background: transparent;
  transition: all 0.2s;
}
.tab.active { background: #e94560; color: #fff; border-color: #e94560; }
.tab:hover:not(.active) { border-color: #e94560; color: #fff; }
.tab-content { display: none; }
.tab-content.active { display: block; }

/* Plan cards */
.plan-card {
  background: #111827; border: 1px solid #1f2937; border-radius: 10px;
  margin-bottom: 10px; overflow: hidden; transition: border-color 0.2s;
}
.plan-card:hover { border-color: #e94560; }
.plan-card.current { border-color: #4ade80; }
.plan-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px;
}
.plan-title { font-size: 15px; font-weight: 700; }
.plan-meta { font-size: 12px; color: #9ca3af; margin-top: 3px; }
.current-badge {
  background: #052e16; color: #4ade80; font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 10px; margin-left: 8px;
}
.plan-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Buttons */
.btn {
  padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 700;
  border: none; cursor: pointer; transition: opacity 0.15s;
}
.btn:hover { opacity: 0.8; }
.btn-view { background: #0f3460; color: #fff; }
.btn-restore { background: #e94560; color: #fff; }
.btn-edit { background: #1f2937; color: #aaa; }
.btn-delete { background: transparent; color: #e94560; border: 1px solid #e94560; }
.btn-primary { background: #e94560; color: #fff; }
.btn-secondary { background: #1f2937; color: #aaa; }
.btn-add { background: #0f3460; color: #fff; width: 100%; margin-top: 6px; }

/* View expand */
.plan-view {
  border-top: 1px solid #1f2937; padding: 16px;
  display: none;
}
.plan-view.open { display: block; }
.stats-bar {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;
}
.stat-box {
  background: #0f3460; border-radius: 8px; padding: 10px; text-align: center;
}
.stat-val { font-size: 18px; font-weight: 700; color: #e94560; }
.stat-lbl { font-size: 10px; color: #9ca3af; margin-top: 2px; }
.day-tabs-row { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.day-tab {
  padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: 1px solid #1f2937; color: #9ca3af; background: transparent;
  transition: all 0.15s;
}
.day-tab.active { background: #e94560; color: #fff; border-color: #e94560; }
.day-tab:hover:not(.active) { border-color: #e94560; color: #fff; }
.day-content { }

/* Progress bars */
.progress-row { margin-bottom: 8px; }
.progress-label {
  display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af;
  margin-bottom: 3px;
}
.progress-pct { color: #f59e0b; }
.progress-track {
  background: #1f2937; border-radius: 3px; height: 5px; overflow: hidden;
}
.progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.progress-fill.cal { background: #e94560; }
.progress-fill.prot { background: #4ade80; }

/* Day sections */
.section-label {
  font-size: 11px; font-weight: 700; color: #e94560;
  text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 6px;
}
.exercise-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.exercise-sets { font-size: 11px; color: #9ca3af; }
.meal-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.meal-type-lbl { font-size: 11px; color: #9ca3af; width: 70px; flex-shrink: 0; }
.meal-macros { font-size: 11px; color: #4ade80; }
.prep-task { padding: 3px 0; font-size: 13px; }
.prep-task::before { content: "📦 "; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal-overlay.hidden { display: none; }
.modal {
  background: #111827; border: 1px solid #1f2937; border-radius: 12px;
  width: min(640px, 95vw); max-height: 85vh;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 18px 20px 12px; border-bottom: 1px solid #1f2937; flex-shrink: 0;
}
.modal-title { font-size: 16px; font-weight: 700; color: #e94560; }
.modal-subtitle { font-size: 12px; color: #9ca3af; margin-top: 3px; }
.modal-close {
  background: none; border: none; color: #9ca3af; font-size: 20px;
  cursor: pointer; line-height: 1; padding: 0 0 0 12px;
}
.modal-close:hover { color: #fff; }
.modal .day-tabs-row { padding: 12px 20px 0; flex-shrink: 0; }
.modal-body { padding: 12px 20px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 12px 20px; border-top: 1px solid #1f2937;
  display: flex; gap: 8px; flex-shrink: 0;
}

/* Edit form fields */
.field-group { margin-bottom: 14px; }
.field-label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
.field-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.input {
  background: #0a0a0f; border: 1px solid #333; border-radius: 6px;
  padding: 7px 10px; color: #fff; font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: #e94560; }
.input-name { flex: 1; }
.input-num { width: 70px; }
.input-wide { width: 100%; }
.targets-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.del-btn {
  background: none; border: none; color: #e94560; font-size: 16px;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.del-btn:hover { opacity: 0.7; }

/* Wizard */
.wizard-wrap { max-width: 560px; }
.progress-header { margin-bottom: 16px; }
.progress-step-lbl { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
.wizard-card {
  background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 20px;
  margin-bottom: 12px;
}
.wizard-q { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.wizard-why { font-size: 12px; color: #4ade80; font-style: italic; margin-bottom: 14px; }
.choices { display: flex; flex-wrap: wrap; gap: 8px; }
.choice {
  padding: 7px 16px; border-radius: 6px; font-size: 13px; background: #0f3460;
  border: 1px solid #1f2937; cursor: pointer; transition: all 0.15s;
}
.choice.selected { background: #e94560; border-color: #e94560; color: #fff; }
.choice:hover:not(.selected) { border-color: #e94560; }
.wizard-nav { display: flex; gap: 8px; margin-top: 8px; }
.btn-next { background: #e94560; color: #fff; flex: 1; padding: 10px; font-size: 14px; }
.btn-back { background: #1f2937; color: #aaa; padding: 10px 18px; font-size: 14px; }
.summary-list { list-style: none; }
.summary-row {
  display: flex; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid #1f2937; font-size: 13px;
}
.summary-key { color: #9ca3af; }
.summary-val { font-weight: 600; }
.btn-generate {
  background: #e94560; color: #fff; border: none; border-radius: 8px;
  padding: 12px; width: 100%; font-size: 15px; font-weight: 700;
  cursor: pointer; margin-top: 14px;
}

/* Toast */
.toast {
  position: fixed; bottom: 24px; right: 24px; background: #0f3460;
  border: 1px solid #e94560; color: #fff; padding: 10px 18px;
  border-radius: 8px; font-size: 13px; opacity: 0;
  transition: opacity 0.3s; pointer-events: none; z-index: 200;
}
.toast.show { opacity: 1; }
.toast.success { border-color: #4ade80; }
```

- [ ] **Step 3: Start server and verify page loads**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 server.py &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
```

Expected: `200`

Open `http://localhost:8080` in a browser. You should see two tabs ("Saved Plans", "New Plan") and an empty page body — no errors in browser console.

- [ ] **Step 4: Kill test server and commit**

```bash
kill %1 2>/dev/null || true
git add static/index.html static/style.css
git commit -m "feat: add static shell HTML and CSS"
```

---

## Task 5: Implement Saved Plans tab (list + view mode) in app.js

**Files:**
- Create: `static/app.js`

- [ ] **Step 1: Create static/app.js with state, API helpers, and plans list rendering**

```javascript
// ── State ────────────────────────────────────────────────────────────────────
const state = {
  plans: [],
  questions: [],
  profile: {},
  openPlanId: null,    // which plan has view expanded
  viewDay: {},         // planId → active day tab in view mode
  editPlan: null,      // {id, plan: {...}} currently in edit modal
  editDay: "Mon",
  wizardStep: 0,
  wizardAnswers: {},
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (type ? " " + type : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === tab + "-tab"));
  });
});

// ── Render Plans List ─────────────────────────────────────────────────────────
function renderPlans() {
  const container = document.getElementById("plans-list");
  if (!state.plans.length) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No saved plans yet. Use New Plan to generate one.</p>';
    return;
  }
  container.innerHTML = state.plans.map(p => planCardHTML(p)).join("");
  state.plans.forEach(p => bindPlanCard(p));
}

function planCardHTML(p) {
  const isCurrent = p.is_current;
  const badge = isCurrent ? '<span class="current-badge">Current</span>' : "";
  const dateStr = new Date(p.week_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const meta = `${p.gym_days} gym days · ${(p.goal || "").replace("_", " ")} · ${p.daily_calorie_target} kcal · ${p.protein_target_g}g protein`;
  const restoreBtn = !isCurrent ? `<button class="btn btn-restore" data-action="restore" data-id="${p.id}">Restore</button>` : "";
  const deleteBtn = !isCurrent ? `<button class="btn btn-delete" data-action="delete" data-id="${p.id}">Delete</button>` : "";
  return `
    <div class="plan-card${isCurrent ? " current" : ""}" id="card-${p.id}">
      <div class="plan-card-header">
        <div>
          <div class="plan-title">Week of ${dateStr}${badge}</div>
          <div class="plan-meta">${meta}</div>
        </div>
        <div class="plan-actions">
          <button class="btn btn-view" data-action="view" data-id="${p.id}">View ▾</button>
          <button class="btn btn-edit" data-action="edit" data-id="${p.id}">Edit</button>
          ${restoreBtn}
          ${deleteBtn}
        </div>
      </div>
      <div class="plan-view" id="view-${p.id}"></div>
    </div>`;
}

function bindPlanCard(p) {
  document.querySelectorAll(`[data-id="${p.id}"]`).forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "view") toggleView(p.id);
      if (action === "edit") openEdit(p.id);
      if (action === "restore") await restorePlan(p.id);
      if (action === "delete") await deletePlan(p.id);
    });
  });
}

// ── View Mode ─────────────────────────────────────────────────────────────────
async function toggleView(planId) {
  const viewEl = document.getElementById(`view-${planId}`);
  const btn = document.querySelector(`[data-action="view"][data-id="${planId}"]`);
  if (state.openPlanId === planId) {
    viewEl.classList.remove("open");
    btn.textContent = "View ▾";
    state.openPlanId = null;
    return;
  }
  // close previously open
  if (state.openPlanId) {
    document.getElementById(`view-${state.openPlanId}`).classList.remove("open");
    const prev = document.querySelector(`[data-action="view"][data-id="${state.openPlanId}"]`);
    if (prev) prev.textContent = "View ▾";
  }
  state.openPlanId = planId;
  btn.textContent = "Hide ▴";
  const planMeta = state.plans.find(p => p.id === planId);
  const full = await api("GET", `/api/plans/${planId}`);
  if (!state.viewDay[planId]) state.viewDay[planId] = "Mon";
  viewEl.innerHTML = buildViewHTML(planMeta, full, state.viewDay[planId]);
  viewEl.classList.add("open");
  viewEl.querySelectorAll(".day-tab").forEach(t => {
    t.addEventListener("click", () => {
      state.viewDay[planId] = t.dataset.day;
      viewEl.innerHTML = buildViewHTML(planMeta, full, t.dataset.day);
      bindDayTabs(viewEl, planId, full, planMeta);
    });
  });
}

function bindDayTabs(viewEl, planId, full, planMeta) {
  viewEl.querySelectorAll(".day-tab").forEach(t => {
    t.addEventListener("click", () => {
      state.viewDay[planId] = t.dataset.day;
      viewEl.innerHTML = buildViewHTML(planMeta, full, t.dataset.day);
      bindDayTabs(viewEl, planId, full, planMeta);
    });
  });
}

function buildViewHTML(planMeta, full, activeDay) {
  const tabs = DAYS.map(d =>
    `<button class="day-tab${d === activeDay ? " active" : ""}" data-day="${d}">${d}</button>`
  ).join("");
  const dayData = full.plan[activeDay] || {};
  return `
    <div class="stats-bar">
      <div class="stat-box"><div class="stat-val">${planMeta.daily_calorie_target}</div><div class="stat-lbl">Daily kcal target</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.protein_target_g}g</div><div class="stat-lbl">Protein target</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.gym_days}/7</div><div class="stat-lbl">Gym days</div></div>
      <div class="stat-box"><div class="stat-val">${planMeta.meal_prep_day || "–"}</div><div class="stat-lbl">Meal prep day</div></div>
    </div>
    <div class="day-tabs-row">${tabs}</div>
    ${buildDayViewHTML(dayData, planMeta)}`;
}

function buildDayViewHTML(day, planMeta) {
  if (!day.type) return "<p style='color:#9ca3af;font-size:13px;'>No data for this day.</p>";
  const calLogged = Object.values(day.meals || {}).reduce((s, name) => {
    // approximate from plan meta proportionally
    return s + Math.round(planMeta.daily_calorie_target / 4);
  }, 0);
  const protLogged = Object.values(day.meals || {}).reduce((s) => s + Math.round(planMeta.protein_target_g / 4), 0);
  const calPct = Math.min(100, Math.round((calLogged / planMeta.daily_calorie_target) * 100));
  const protPct = Math.min(100, Math.round((protLogged / planMeta.protein_target_g) * 100));

  let activityHTML = "";
  if (day.type === "gym") {
    activityHTML = `
      <div class="section-label">💪 Workout</div>
      ${(day.exercises || []).map(e =>
        `<div class="exercise-row"><span>${e.name}</span><span class="exercise-sets">${e.sets} sets × ${e.reps}</span></div>`
      ).join("")}`;
  } else if (day.type === "rest") {
    activityHTML = `
      <div class="section-label">🧘 Rest Activity</div>
      <div style="font-size:14px;padding:4px 0;">${day.activity || "–"}</div>`;
  } else if (day.type === "meal_prep") {
    activityHTML = `
      <div class="section-label">📦 Meal Prep Tasks</div>
      ${(day.prep_tasks || []).map(t => `<div class="prep-task">${t}</div>`).join("")}`;
  }

  const mealMacros = { breakfast: "450kcal · 30g", lunch: "520kcal · 45g", dinner: "480kcal · 40g", snack: "180kcal · 15g" };
  const mealsHTML = ["breakfast", "lunch", "dinner", "snack"].map(type => {
    const name = (day.meals || {})[type] || "–";
    return `<div class="meal-row">
      <span class="meal-type-lbl">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <span style="flex:1">${name}</span>
      <span class="meal-macros">${mealMacros[type]}</span>
    </div>`;
  }).join("");

  return `
    <div class="progress-row">
      <div class="progress-label"><span>Calories: ${calLogged} / ${planMeta.daily_calorie_target} kcal</span><span class="progress-pct">${calPct}%</span></div>
      <div class="progress-track"><div class="progress-fill cal" style="width:${calPct}%"></div></div>
    </div>
    <div class="progress-row">
      <div class="progress-label"><span>Protein: ${protLogged}g / ${planMeta.protein_target_g}g</span><span class="progress-pct">${protPct}%</span></div>
      <div class="progress-track"><div class="progress-fill prot" style="width:${protPct}%"></div></div>
    </div>
    ${activityHTML}
    <div class="section-label">🍽️ Meals</div>
    ${mealsHTML}`;
}

// ── Restore / Delete ──────────────────────────────────────────────────────────
async function restorePlan(planId) {
  const res = await api("POST", `/api/plans/${planId}/restore`, {});
  if (res.ok) {
    toast("Plan restored as current week!", "success");
    await refreshPlans();
  } else {
    toast("Restore failed");
  }
}

async function deletePlan(planId) {
  const res = await api("DELETE", `/api/plans/${planId}`);
  if (res.ok) {
    toast("Plan deleted");
    await refreshPlans();
  } else {
    toast("Delete failed");
  }
}

async function refreshPlans() {
  state.plans = await api("GET", "/api/plans");
  state.openPlanId = null;
  renderPlans();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  [state.plans, state.questions, state.profile] = await Promise.all([
    api("GET", "/api/plans"),
    api("GET", "/api/questions"),
    api("GET", "/api/profile"),
  ]);
  renderPlans();
  renderWizard();
}

init();
```

- [ ] **Step 2: Start server and verify plans list renders**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 server.py &
sleep 1
```

Open `http://localhost:8080`. If a plan exists in the DB (from earlier CLI usage), it should appear as a card. Click View — the card should expand showing the stats bar, day tabs, and per-day content. Click a different day tab — content should update. Click Hide — card should collapse.

If no plans exist yet, the page should show "No saved plans yet." Generate one with:

```bash
curl -s -X POST http://localhost:8080/api/plans/generate -H "Content-Type: application/json" -d '{}' | python3 -m json.tool | head -5
```

Refresh browser — card should appear.

- [ ] **Step 3: Kill server and commit**

```bash
kill %1 2>/dev/null || true
git add static/app.js
git commit -m "feat: implement saved plans list and view mode"
```

---

## Task 6: Implement Edit modal in app.js

**Files:**
- Modify: `static/app.js` (add edit modal functions before the `init()` call)

- [ ] **Step 1: Add edit modal functions to app.js**

Add the following functions before the `init()` call at the bottom of `static/app.js`:

```javascript
// ── Edit Modal ────────────────────────────────────────────────────────────────
async function openEdit(planId) {
  const full = await api("GET", `/api/plans/${planId}`);
  state.editPlan = { id: planId, plan: JSON.parse(JSON.stringify(full.plan)) };
  state.editDay = "Mon";
  renderModal();
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  state.editPlan = null;
}

function renderModal() {
  if (!state.editPlan) return;
  const tabs = DAYS.map(d =>
    `<button class="day-tab${d === state.editDay ? " active" : ""}" data-day="${d}">${d}</button>`
  ).join("");
  document.getElementById("modal-day-tabs").innerHTML = tabs;
  document.getElementById("modal-day-tabs").querySelectorAll(".day-tab").forEach(t => {
    t.addEventListener("click", () => {
      collectEditDay();
      state.editDay = t.dataset.day;
      renderModal();
    });
  });
  document.getElementById("modal-body").innerHTML = buildEditDayHTML(
    state.editPlan.plan[state.editDay] || {}
  );
  bindEditBody();
}

function buildEditDayHTML(day) {
  const planMeta = state.plans.find(p => p.id === state.editPlan.id) || {};
  const kcal = planMeta.daily_calorie_target || 2000;
  const prot = planMeta.protein_target_g || 150;

  let activityHTML = "";
  if (day.type === "gym") {
    const exRows = (day.exercises || []).map((e, i) => `
      <div class="field-row" data-ex="${i}">
        <input class="input input-name ex-name" value="${e.name}" placeholder="Exercise name">
        <input class="input input-num ex-sets" value="${e.sets}" placeholder="Sets">
        <input class="input input-num ex-reps" value="${e.reps}" placeholder="Reps">
        <button class="del-btn" data-del-ex="${i}">×</button>
      </div>`).join("");
    activityHTML = `
      <div class="field-group">
        <div class="section-label">💪 Exercises</div>
        <div id="ex-list">${exRows}</div>
        <button class="btn btn-add" id="add-ex-btn">+ Add Exercise</button>
      </div>`;
  } else if (day.type === "rest") {
    activityHTML = `
      <div class="field-group">
        <div class="section-label">🧘 Rest Activity</div>
        <input class="input input-wide" id="rest-activity" value="${day.activity || ""}">
      </div>`;
  } else if (day.type === "meal_prep") {
    const taskRows = (day.prep_tasks || []).map((t, i) => `
      <div class="field-row" data-task="${i}">
        <input class="input input-name task-text" value="${t}">
        <button class="del-btn" data-del-task="${i}">×</button>
      </div>`).join("");
    activityHTML = `
      <div class="field-group">
        <div class="section-label">📦 Meal Prep Tasks</div>
        <div id="task-list">${taskRows}</div>
        <button class="btn btn-add" id="add-task-btn">+ Add Task</button>
      </div>`;
  }

  const meals = day.meals || {};
  const mealRows = ["breakfast", "lunch", "dinner", "snack"].map(type => `
    <div class="field-row">
      <span class="meal-type-lbl" style="width:75px;flex-shrink:0;font-size:11px;color:#9ca3af;">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <input class="input input-name meal-name" data-meal="${type}" value="${meals[type] || ""}">
    </div>`).join("");

  return `
    <div class="field-group">
      <div class="section-label">📊 Daily Targets</div>
      <div class="targets-row">
        <div>
          <div class="field-label">Calories (kcal)</div>
          <input class="input input-wide" id="edit-kcal" value="${kcal}">
        </div>
        <div>
          <div class="field-label">Protein (g)</div>
          <input class="input input-wide" id="edit-prot" value="${prot}">
        </div>
      </div>
    </div>
    ${activityHTML}
    <div class="field-group">
      <div class="section-label">🍽️ Meals</div>
      ${mealRows}
    </div>`;
}

function bindEditBody() {
  const day = state.editPlan.plan[state.editDay];

  // Add exercise
  const addExBtn = document.getElementById("add-ex-btn");
  if (addExBtn) {
    addExBtn.addEventListener("click", () => {
      collectEditDay();
      const d = state.editPlan.plan[state.editDay];
      d.exercises.push({ name: "", sets: 3, reps: "10-12" });
      renderModal();
    });
  }

  // Delete exercise
  document.querySelectorAll("[data-del-ex]").forEach(btn => {
    btn.addEventListener("click", () => {
      collectEditDay();
      const i = parseInt(btn.dataset.delEx);
      state.editPlan.plan[state.editDay].exercises.splice(i, 1);
      renderModal();
    });
  });

  // Add prep task
  const addTaskBtn = document.getElementById("add-task-btn");
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", () => {
      collectEditDay();
      state.editPlan.plan[state.editDay].prep_tasks.push("");
      renderModal();
    });
  }

  // Delete prep task
  document.querySelectorAll("[data-del-task]").forEach(btn => {
    btn.addEventListener("click", () => {
      collectEditDay();
      const i = parseInt(btn.dataset.delTask);
      state.editPlan.plan[state.editDay].prep_tasks.splice(i, 1);
      renderModal();
    });
  });
}

function collectEditDay() {
  const day = state.editPlan.plan[state.editDay];
  if (!day) return;

  // meals
  document.querySelectorAll(".meal-name").forEach(input => {
    day.meals[input.dataset.meal] = input.value;
  });

  // exercises
  if (day.type === "gym") {
    const rows = document.querySelectorAll("[data-ex]");
    rows.forEach(row => {
      const i = parseInt(row.dataset.ex);
      if (day.exercises[i]) {
        day.exercises[i].name = row.querySelector(".ex-name").value;
        day.exercises[i].sets = parseInt(row.querySelector(".ex-sets").value) || 3;
        day.exercises[i].reps = row.querySelector(".ex-reps").value;
      }
    });
  }

  // rest activity
  const restInput = document.getElementById("rest-activity");
  if (restInput) day.activity = restInput.value;

  // prep tasks
  if (day.type === "meal_prep") {
    document.querySelectorAll(".task-text").forEach((input, i) => {
      if (day.prep_tasks[i] !== undefined) day.prep_tasks[i] = input.value;
    });
  }
}

async function saveEdit() {
  collectEditDay();
  const res = await api("PUT", `/api/plans/${state.editPlan.id}`, { plan: state.editPlan.plan });
  if (res.ok) {
    toast("Changes saved!", "success");
    closeModal();
    await refreshPlans();
    if (state.openPlanId === state.editPlan?.id) {
      toggleView(state.editPlan.id);
    }
  } else {
    toast("Save failed: " + (res.error || "unknown error"));
  }
}

// Modal button listeners
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-save").addEventListener("click", saveEdit);
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});
```

- [ ] **Step 2: Start server and verify edit modal**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 server.py &
sleep 1
```

Open `http://localhost:8080`. Click Edit on a plan card. Verify:
- Modal opens with day tabs Mon–Sun
- Mon tab shows Daily Targets (kcal + protein inputs), exercises with sets/reps, meals
- Click Sat tab (rest day) — shows Rest Activity text input and meals
- Click Sun tab (meal prep) — shows Meal Prep Tasks rows with add/delete
- Edit a field and click Save Changes — toast shows "Changes saved!"
- Click View on the same card — updated values appear

- [ ] **Step 3: Kill server and commit**

```bash
kill %1 2>/dev/null || true
git add static/app.js
git commit -m "feat: implement edit modal with per-day form for all day types"
```

---

## Task 7: Implement New Plan wizard in app.js

**Files:**
- Modify: `static/app.js` (add wizard functions before the `init()` call)

- [ ] **Step 1: Add wizard functions to app.js**

Add the following before the `init()` call at the bottom of `static/app.js`:

```javascript
// ── New Plan Wizard ───────────────────────────────────────────────────────────
function renderWizard() {
  const qs = state.questions;
  if (!qs.length) return;
  const step = state.wizardStep;
  const container = document.getElementById("wizard");

  if (step >= qs.length) {
    renderWizardSummary();
    return;
  }

  const q = qs[step];
  const pct = Math.round(((step + 1) / qs.length) * 100);
  const current = state.wizardAnswers[q.key];

  let inputHTML = "";
  if (q.type === "single") {
    inputHTML = `<div class="choices">
      ${q.options.map(o =>
        `<div class="choice${current === o.value ? " selected" : ""}" data-val="${o.value}">${o.label}</div>`
      ).join("")}
    </div>`;
  } else if (q.type === "multi") {
    const selected = Array.isArray(current) ? current : (current ? current.split(",") : []);
    inputHTML = `<div class="choices" data-multi>
      ${q.options.map(o =>
        `<div class="choice${selected.includes(o.value) ? " selected" : ""}" data-val="${o.value}">${o.label}</div>`
      ).join("")}
    </div>`;
  } else if (q.type === "text") {
    inputHTML = `<input class="input input-wide" id="wizard-text" value="${current || ""}" placeholder="${q.placeholder || ""}">`;
  } else if (q.type === "targets") {
    const profile = state.profile;
    const kcal = state.wizardAnswers.daily_calorie_target || profile.daily_calorie_target || 2000;
    const prot = state.wizardAnswers.protein_target_g || profile.protein_target_g || 150;
    inputHTML = `
      <div class="targets-row">
        <div>
          <div class="field-label">Daily Calories (kcal)</div>
          <input class="input input-wide" id="wizard-kcal" value="${kcal}">
        </div>
        <div>
          <div class="field-label">Protein Target (g)</div>
          <input class="input input-wide" id="wizard-prot" value="${prot}">
        </div>
      </div>`;
  }

  container.innerHTML = `
    <div class="wizard-wrap">
      <div class="progress-header">
        <div class="progress-step-lbl">Question ${step + 1} of ${qs.length}</div>
        <div class="progress-track"><div class="progress-fill cal" style="width:${pct}%"></div></div>
      </div>
      <div class="wizard-card">
        <div class="wizard-q">${q.question}</div>
        <div class="wizard-why">${q.why}</div>
        ${inputHTML}
      </div>
      <div class="wizard-nav">
        ${step > 0 ? `<button class="btn btn-back" id="wiz-back">← Back</button>` : ""}
        <button class="btn btn-next" id="wiz-next">${step < qs.length - 1 ? "Next →" : "Review →"}</button>
      </div>
    </div>`;

  // Bind choices
  container.querySelectorAll(".choice").forEach(el => {
    el.addEventListener("click", () => {
      const isMulti = !!el.closest("[data-multi]");
      if (!isMulti) {
        el.closest(".choices").querySelectorAll(".choice").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
      } else {
        el.classList.toggle("selected");
      }
    });
  });

  document.getElementById("wiz-next")?.addEventListener("click", () => wizardNext(q));
  document.getElementById("wiz-back")?.addEventListener("click", () => {
    state.wizardStep--;
    renderWizard();
  });
}

function wizardNext(q) {
  // Collect answer for current question
  if (q.type === "single") {
    const sel = document.querySelector(".choice.selected");
    if (!sel) { toast("Please select an option"); return; }
    state.wizardAnswers[q.key] = sel.dataset.val;
  } else if (q.type === "multi") {
    const selected = [...document.querySelectorAll(".choice.selected")].map(el => el.dataset.val);
    if (!selected.length) { toast("Please select at least one option"); return; }
    state.wizardAnswers[q.key] = selected.join(",");
  } else if (q.type === "text") {
    state.wizardAnswers[q.key] = document.getElementById("wizard-text").value.trim() || "none";
  } else if (q.type === "targets") {
    state.wizardAnswers.daily_calorie_target = parseInt(document.getElementById("wizard-kcal").value) || 2000;
    state.wizardAnswers.protein_target_g = parseInt(document.getElementById("wizard-prot").value) || 150;
  }
  state.wizardStep++;
  renderWizard();
}

function renderWizardSummary() {
  const a = state.wizardAnswers;
  const rows = [
    ["Goal", (a.goal || "").replace("_", " ")],
    ["Gym Days", a.gym_days || "–"],
    ["Meal Prep Day", a.meal_prep_day || "–"],
    ["Fitness Level", a.fitness_level || "–"],
    ["Equipment", a.equipment || "–"],
    ["Dietary Preference", a.dietary_preference || "–"],
    ["Allergies", a.allergies || "none"],
    ["Daily Calories", `${a.daily_calorie_target || 2000} kcal`],
    ["Protein Target", `${a.protein_target_g || 150}g`],
  ];

  document.getElementById("wizard").innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-card">
        <div class="wizard-q">Your Plan Summary</div>
        <div class="wizard-why">Review your answers before generating.</div>
        <ul class="summary-list">
          ${rows.map(([k, v]) =>
            `<li class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></li>`
          ).join("")}
        </ul>
      </div>
      <button class="btn btn-generate" id="gen-btn">✨ Generate My Plan</button>
      <button class="btn btn-back" style="margin-top:8px;width:100%;" id="wiz-back-sum">← Go Back</button>
    </div>`;

  document.getElementById("gen-btn").addEventListener("click", generatePlan);
  document.getElementById("wiz-back-sum").addEventListener("click", () => {
    state.wizardStep = state.questions.length - 1;
    renderWizard();
  });
}

async function generatePlan() {
  const a = state.wizardAnswers;
  const gymList = a.gym_days ? a.gym_days.split(",") : [];
  const prepDay = a.meal_prep_day || "";
  const restDays = DAYS.filter(d => !gymList.includes(d) && d !== prepDay).join(",");

  const profile = {
    goal: a.goal || "maintain",
    gym_days: a.gym_days || "Mon,Wed,Fri",
    rest_days: restDays,
    meal_prep_day: a.meal_prep_day || "Sun",
    fitness_level: a.fitness_level || "beginner",
    equipment: a.equipment || "bodyweight",
    dietary_preference: a.dietary_preference || "none",
    allergies: a.allergies || "none",
    daily_calorie_target: a.daily_calorie_target || 2000,
    protein_target_g: a.protein_target_g || 150,
  };

  const btn = document.getElementById("gen-btn");
  btn.textContent = "Generating…";
  btn.disabled = true;

  const res = await api("POST", "/api/plans/generate", profile);
  if (res.ok) {
    toast("Plan generated!", "success");
    state.wizardStep = 0;
    state.wizardAnswers = {};
    // switch to saved plans tab
    document.querySelector('[data-tab="plans"]').click();
    await refreshPlans();
  } else {
    toast("Failed: " + (res.error || "unknown error"));
    btn.textContent = "✨ Generate My Plan";
    btn.disabled = false;
  }
}
```

- [ ] **Step 2: Pre-fill wizard with existing profile answers**

Update the `init()` function at the bottom of `app.js` to pre-fill wizard answers from the saved profile:

Replace:
```javascript
async function init() {
  [state.plans, state.questions, state.profile] = await Promise.all([
    api("GET", "/api/plans"),
    api("GET", "/api/questions"),
    api("GET", "/api/profile"),
  ]);
  renderPlans();
  renderWizard();
}
```

With:
```javascript
async function init() {
  [state.plans, state.questions, state.profile] = await Promise.all([
    api("GET", "/api/plans"),
    api("GET", "/api/questions"),
    api("GET", "/api/profile"),
  ]);
  // Pre-fill wizard from saved profile
  const p = state.profile;
  if (p && p.goal) {
    state.wizardAnswers = {
      goal: p.goal,
      gym_days: p.gym_days || "",
      meal_prep_day: p.meal_prep_day || "",
      fitness_level: p.fitness_level || "",
      equipment: p.equipment || "",
      dietary_preference: p.dietary_preference || "",
      allergies: p.allergies || "",
      daily_calorie_target: p.daily_calorie_target || 2000,
      protein_target_g: p.protein_target_g || 150,
    };
  }
  renderPlans();
  renderWizard();
}
```

- [ ] **Step 3: Start server and verify wizard end-to-end**

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 server.py &
sleep 1
```

Open `http://localhost:8080`. Click "New Plan" tab. Verify:
- Question 1 shows "What is your fitness goal?" with why text and choice buttons
- Choices pre-filled with your saved profile answers (Build Muscle selected)
- Click Next — moves to question 2 (gym days multi-select)
- Click Back — returns to question 1
- Progress bar advances each step
- After question 8, summary screen shows all 8 answers
- Click Generate — button shows "Generating…", then success toast, redirects to Saved Plans tab with new card

- [ ] **Step 4: Run all tests**

```bash
python3 -m pytest tests/test_planner.py tests/test_api.py -v
```

Expected: all tests PASS (29 unit + 12 API = 41 total).

- [ ] **Step 5: Kill server and commit**

```bash
kill %1 2>/dev/null || true
git add static/app.js
git commit -m "feat: implement new plan wizard with profile pre-fill"
```

---

## Final Verification

After all tasks complete, run the full test suite and do a manual smoke test:

```bash
cd /Users/ranel/Downloads/claude-terminal
python3 -m pytest tests/ -v
```

Expected: 41 tests PASS.

```bash
python3 server.py
```

Open `http://localhost:8080` and verify:
1. Saved Plans tab shows all existing plans with View/Edit/Restore/Delete
2. View expands per plan showing stats bar, day tabs, calorie/protein bars, workout/rest/prep, meals with macros
3. Edit modal opens with day tabs, all fields editable, Save works
4. Restore/Delete update the list correctly
5. New Plan tab wizard steps through 8 questions with back/next, summary, and Generate
