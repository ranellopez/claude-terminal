# Meal Prep, Gym Plan & Rest Day Scheduler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file Python CLI tool (`planner.py`) that generates, tracks, and exports a personalized weekly meal prep, gym, and rest day schedule using Claude AI and a local SQLite database.

**Architecture:** All logic lives in `planner.py` as top-level functions grouped by concern (DB, profile, content, plan generation, display, check-offs, meal checker, export, main menu). An in-memory SQLite connection is opened once at startup and passed to all DB functions. Claude API is called through a single `ask_claude(prompt)` wrapper.

**Tech Stack:** Python 3.10+, `anthropic` SDK, `sqlite3` (stdlib), `json`, `random`, `datetime`, `os`

---

## File Structure

```
planner.py           # entire application (~500 lines)
tests/
  test_planner.py    # pytest unit tests for all pure/DB functions
requirements.txt     # anthropic>=0.40.0, pytest
.gitignore           # planner.db, plan_*.md, plan_*.json, __pycache__, .env
README.md            # setup instructions + smoke test checklist
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `planner.py`
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `README.md`
- Create: `tests/__init__.py`
- Create: `tests/test_planner.py`

- [ ] **Step 1: Create `requirements.txt`**

```
anthropic>=0.40.0
pytest
```

- [ ] **Step 2: Create `.gitignore`**

```
planner.db
plan_*.md
plan_*.json
__pycache__/
*.pyc
.env
.superpowers/
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Meal Prep, Gym Plan & Rest Day Scheduler

## Setup

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key_here
python planner.py
```

## Smoke Test Checklist

- [ ] First run triggers profile wizard (8 questions)
- [ ] Profile saves and persists across restarts
- [ ] Plan generates without error (with and without API key)
- [ ] Week view displays all 7 days
- [ ] Check-off marks item done and persists
- [ ] Meal checker returns verdict and saves feedback
- [ ] Export produces valid `.md` and `.json` files
- [ ] Edit profile updates DB and offers to regenerate plan
- [ ] Add custom meal appears in next generated plan
```

- [ ] **Step 4: Create `planner.py` with imports, constants skeleton, and main guard**

```python
import anthropic
import sqlite3
import json
import random
import os
import sys
from datetime import date, timedelta

DB_PATH = "planner.db"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

MEALS = []       # populated in Task 3
EXERCISES = []   # populated in Task 3
REST_ACTIVITIES = []  # populated in Task 3


def main():
    print("Planner starting...")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Create `tests/__init__.py`** (empty file)

- [ ] **Step 6: Create `tests/test_planner.py` with import setup**

```python
import sys
import sqlite3
sys.path.insert(0, ".")
import pytest
from planner import init_db
```

- [ ] **Step 7: Install dependencies**

```bash
pip install -r requirements.txt
```

- [ ] **Step 8: Verify planner runs**

```bash
python planner.py
```
Expected: `Planner starting...`

- [ ] **Step 9: Commit**

```bash
git add planner.py requirements.txt .gitignore README.md tests/__init__.py tests/test_planner.py
git commit -m "feat: scaffold planner project with deps and test setup"
```

---

## Task 2: Database Schema and Helpers

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/test_planner.py`:

```python
from planner import init_db, get_week_start
from datetime import date, timedelta


def make_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    return conn


def test_init_db_creates_tables():
    conn = make_conn()
    init_db(conn)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert "profile" in tables
    assert "weekly_plans" in tables
    assert "check_offs" in tables
    assert "custom_items" in tables


def test_get_week_start_is_monday():
    ws = get_week_start()
    d = date.fromisoformat(ws)
    assert d.weekday() == 0  # Monday == 0
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py -v
```
Expected: `ImportError` or `AttributeError` — `init_db` and `get_week_start` not yet defined.

- [ ] **Step 3: Implement `init_db` and `get_week_start` in `planner.py`**

```python
def get_week_start():
    today = date.today()
    return (today - timedelta(days=today.weekday())).isoformat()


def init_db(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY,
            goal TEXT,
            gym_days TEXT,
            rest_days TEXT,
            meal_prep_day TEXT,
            fitness_level TEXT,
            equipment TEXT,
            dietary_preference TEXT,
            allergies TEXT,
            daily_calorie_target INTEGER,
            protein_target_g INTEGER
        );
        CREATE TABLE IF NOT EXISTS weekly_plans (
            id INTEGER PRIMARY KEY,
            week_start TEXT UNIQUE,
            plan_json TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS check_offs (
            id INTEGER PRIMARY KEY,
            week_start TEXT,
            day TEXT,
            item_type TEXT,
            item_name TEXT,
            done INTEGER DEFAULT 0,
            nutrition_feedback TEXT
        );
        CREATE TABLE IF NOT EXISTS custom_items (
            id INTEGER PRIMARY KEY,
            item_type TEXT,
            data_json TEXT
        );
    """)
    conn.commit()


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add DB schema init and week start helper"
```

---

## Task 3: Built-in Content Library and Filtering

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import filter_meals, filter_exercises, sample_meals, MEALS, EXERCISES


def test_filter_meals_by_goal():
    profile = {"goal": "build_muscle", "dietary_preference": "none"}
    results = filter_meals(MEALS, profile)
    assert len(results) > 0
    for m in results:
        assert "build_muscle" in m["goal"]


def test_filter_meals_by_dietary():
    profile = {"goal": "maintain", "dietary_preference": "vegan"}
    results = filter_meals(MEALS, profile)
    for m in results:
        assert "vegan" in m["dietary"]


def test_filter_exercises_by_goal_and_equipment():
    profile = {"goal": "build_muscle", "equipment": "dumbbells,bodyweight"}
    results = filter_exercises(EXERCISES, profile)
    assert len(results) > 0
    for e in results:
        assert "build_muscle" in e["goal"]
        user_equip = [eq.strip() for eq in profile["equipment"].split(",")]
        assert any(eq in user_equip for eq in e["equipment"])


def test_sample_meals_returns_all_types():
    profile = {"goal": "build_muscle", "dietary_preference": "none"}
    meals = filter_meals(MEALS, profile)
    sampled = sample_meals(meals)
    assert "breakfast" in sampled
    assert "lunch" in sampled
    assert "dinner" in sampled
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_filter_meals_by_goal -v
```
Expected: FAIL — functions not defined, MEALS empty.

- [ ] **Step 3: Populate `MEALS`, `EXERCISES`, `REST_ACTIVITIES` and implement filter functions**

Replace the empty lists and add functions in `planner.py`:

```python
MEALS = [
    {"name": "Grilled chicken + brown rice", "goal": ["build_muscle", "maintain"], "dietary": ["none", "gluten-free"], "meal_type": "lunch", "protein_g": 45, "calories": 520},
    {"name": "Oatmeal + banana + protein shake", "goal": ["build_muscle", "endurance", "lose_weight"], "dietary": ["none", "vegetarian", "vegan"], "meal_type": "breakfast", "protein_g": 30, "calories": 450},
    {"name": "Salmon + quinoa + broccoli", "goal": ["build_muscle", "lose_weight", "endurance"], "dietary": ["none", "gluten-free"], "meal_type": "dinner", "protein_g": 40, "calories": 480},
    {"name": "Greek yogurt + berries", "goal": ["build_muscle", "maintain", "lose_weight"], "dietary": ["none", "vegetarian", "gluten-free"], "meal_type": "snack", "protein_g": 15, "calories": 180},
    {"name": "Egg white omelette + spinach", "goal": ["lose_weight", "build_muscle"], "dietary": ["none", "vegetarian", "gluten-free"], "meal_type": "breakfast", "protein_g": 25, "calories": 200},
    {"name": "Tuna salad wrap", "goal": ["lose_weight", "maintain"], "dietary": ["none"], "meal_type": "lunch", "protein_g": 35, "calories": 380},
    {"name": "Lentil soup + whole grain bread", "goal": ["maintain", "endurance"], "dietary": ["none", "vegetarian", "vegan"], "meal_type": "dinner", "protein_g": 20, "calories": 420},
    {"name": "Tofu stir-fry + rice", "goal": ["maintain", "lose_weight"], "dietary": ["none", "vegetarian", "vegan", "gluten-free"], "meal_type": "dinner", "protein_g": 22, "calories": 400},
    {"name": "Protein smoothie", "goal": ["build_muscle", "endurance"], "dietary": ["none", "vegetarian"], "meal_type": "snack", "protein_g": 30, "calories": 300},
    {"name": "Turkey + sweet potato", "goal": ["build_muscle", "lose_weight"], "dietary": ["none", "gluten-free"], "meal_type": "dinner", "protein_g": 42, "calories": 500},
    {"name": "Avocado toast + eggs", "goal": ["maintain", "endurance"], "dietary": ["none", "vegetarian"], "meal_type": "breakfast", "protein_g": 20, "calories": 380},
    {"name": "Chickpea salad", "goal": ["lose_weight", "maintain"], "dietary": ["none", "vegetarian", "vegan", "gluten-free"], "meal_type": "lunch", "protein_g": 18, "calories": 320},
]

EXERCISES = [
    {"name": "Barbell squat", "goal": ["build_muscle", "endurance"], "equipment": ["barbell"], "muscle_group": "legs", "sets": 4, "reps": "6-8"},
    {"name": "Push-ups", "goal": ["build_muscle", "maintain", "endurance", "lose_weight"], "equipment": ["bodyweight"], "muscle_group": "chest", "sets": 3, "reps": "15-20"},
    {"name": "Dumbbell bench press", "goal": ["build_muscle"], "equipment": ["dumbbells"], "muscle_group": "chest", "sets": 4, "reps": "8-10"},
    {"name": "Pull-ups", "goal": ["build_muscle", "endurance"], "equipment": ["pull-up bar", "bodyweight"], "muscle_group": "back", "sets": 3, "reps": "8-12"},
    {"name": "Dumbbell rows", "goal": ["build_muscle", "maintain"], "equipment": ["dumbbells"], "muscle_group": "back", "sets": 3, "reps": "10-12"},
    {"name": "Deadlift", "goal": ["build_muscle", "endurance"], "equipment": ["barbell"], "muscle_group": "full_body", "sets": 4, "reps": "5-6"},
    {"name": "Bodyweight lunges", "goal": ["lose_weight", "maintain", "endurance"], "equipment": ["bodyweight"], "muscle_group": "legs", "sets": 3, "reps": "12 each leg"},
    {"name": "Dumbbell shoulder press", "goal": ["build_muscle", "maintain"], "equipment": ["dumbbells"], "muscle_group": "shoulders", "sets": 3, "reps": "10-12"},
    {"name": "Plank", "goal": ["lose_weight", "maintain", "endurance", "build_muscle"], "equipment": ["bodyweight"], "muscle_group": "core", "sets": 3, "reps": "30-60s"},
    {"name": "Jumping jacks", "goal": ["lose_weight", "endurance"], "equipment": ["bodyweight"], "muscle_group": "full_body", "sets": 3, "reps": "30"},
    {"name": "Dumbbell bicep curls", "goal": ["build_muscle", "maintain"], "equipment": ["dumbbells"], "muscle_group": "arms", "sets": 3, "reps": "10-12"},
    {"name": "Tricep dips", "goal": ["build_muscle", "maintain"], "equipment": ["bodyweight"], "muscle_group": "arms", "sets": 3, "reps": "12-15"},
]

REST_ACTIVITIES = [
    "20-minute walk",
    "Yoga (30 min)",
    "Foam rolling (15 min)",
    "Full body stretch (20 min)",
    "Meditation (10 min)",
    "Light cycling (20 min)",
    "Swimming (easy pace, 20 min)",
]


def filter_meals(meals, profile):
    goal = profile["goal"]
    diet = profile["dietary_preference"]
    filtered = [m for m in meals if goal in m["goal"] and (diet == "none" or diet in m["dietary"])]
    return filtered if filtered else meals  # fallback to all if no match


def filter_exercises(exercises, profile):
    goal = profile["goal"]
    user_equip = [e.strip().lower() for e in profile["equipment"].split(",")]
    filtered = [
        ex for ex in exercises
        if goal in ex["goal"] and any(eq.lower() in user_equip for eq in ex["equipment"])
    ]
    return filtered if filtered else exercises  # fallback to all if no match


def sample_meals(meals):
    by_type = {}
    for meal_type in ["breakfast", "lunch", "dinner", "snack"]:
        typed = [m for m in meals if m["meal_type"] == meal_type]
        by_type[meal_type] = random.choice(typed)["name"] if typed else "No option available"
    return by_type


def get_all_meals(conn):
    custom = conn.execute("SELECT data_json FROM custom_items WHERE item_type='meal'").fetchall()
    return MEALS + [json.loads(r["data_json"]) for r in custom]


def get_all_exercises(conn):
    custom = conn.execute("SELECT data_json FROM custom_items WHERE item_type='exercise'").fetchall()
    return EXERCISES + [json.loads(r["data_json"]) for r in custom]
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add built-in content library and filtering"
```

---

## Task 4: Profile CRUD

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import save_profile, load_profile


def test_load_profile_returns_none_when_empty():
    conn = make_conn()
    init_db(conn)
    assert load_profile(conn) is None


def test_save_and_load_profile_roundtrip():
    conn = make_conn()
    init_db(conn)
    profile = {
        "goal": "build_muscle",
        "gym_days": "Mon,Wed,Fri",
        "rest_days": "Tue,Thu,Sat,Sun",
        "meal_prep_day": "Sun",
        "fitness_level": "intermediate",
        "equipment": "dumbbells,barbell",
        "dietary_preference": "none",
        "allergies": "peanuts",
        "daily_calorie_target": 2500,
        "protein_target_g": 180,
    }
    save_profile(conn, profile)
    loaded = load_profile(conn)
    assert loaded["goal"] == "build_muscle"
    assert loaded["gym_days"] == "Mon,Wed,Fri"
    assert loaded["daily_calorie_target"] == 2500
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_load_profile_returns_none_when_empty tests/test_planner.py::test_save_and_load_profile_roundtrip -v
```
Expected: FAIL

- [ ] **Step 3: Implement `save_profile` and `load_profile`**

```python
def save_profile(conn, profile):
    conn.execute("DELETE FROM profile")
    conn.execute("""
        INSERT INTO profile (goal, gym_days, rest_days, meal_prep_day, fitness_level,
            equipment, dietary_preference, allergies, daily_calorie_target, protein_target_g)
        VALUES (:goal, :gym_days, :rest_days, :meal_prep_day, :fitness_level,
            :equipment, :dietary_preference, :allergies, :daily_calorie_target, :protein_target_g)
    """, profile)
    conn.commit()


def load_profile(conn):
    row = conn.execute("SELECT * FROM profile LIMIT 1").fetchone()
    if row is None:
        return None
    return dict(row)
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add profile save/load"
```

---

## Task 5: Profile Wizard

**Files:**
- Modify: `planner.py`

- [ ] **Step 1: Implement `profile_wizard` and `edit_profile_menu`**

No unit test for wizard (relies on `input()`). Add to `planner.py`:

```python
def profile_wizard(conn):
    print("\n=== Profile Setup ===\n")

    print("What is your fitness goal?")
    print("  1. Lose weight\n  2. Build muscle\n  3. Maintain\n  4. Endurance")
    goal_map = {"1": "lose_weight", "2": "build_muscle", "3": "maintain", "4": "endurance"}
    goal = goal_map.get(input("Enter 1-4: ").strip(), "maintain")

    gym_days = input("Gym days (comma-separated, e.g. Mon,Wed,Fri): ").strip() or "Mon,Wed,Fri"
    rest_days = input("Rest days (comma-separated, e.g. Tue,Thu,Sat,Sun): ").strip() or "Tue,Thu,Sat,Sun"
    meal_prep_day = input("Meal prep day (e.g. Sun): ").strip() or "Sun"

    print("Fitness level?")
    print("  1. Beginner\n  2. Intermediate\n  3. Advanced")
    level_map = {"1": "beginner", "2": "intermediate", "3": "advanced"}
    fitness_level = level_map.get(input("Enter 1-3: ").strip(), "beginner")

    equipment = input("Equipment available (comma-separated, e.g. dumbbells,barbell,bodyweight): ").strip() or "bodyweight"

    print("Dietary preference?")
    print("  1. None\n  2. Vegetarian\n  3. Vegan\n  4. Gluten-free")
    diet_map = {"1": "none", "2": "vegetarian", "3": "vegan", "4": "gluten-free"}
    dietary_preference = diet_map.get(input("Enter 1-4: ").strip(), "none")

    allergies = input("Any allergies? (or press Enter to skip): ").strip() or "none"

    print("\nEstimating your calorie and protein targets...")
    calorie_target, protein_target = estimate_targets(goal, fitness_level)
    print(f"  Estimated daily calories: {calorie_target} kcal")
    print(f"  Estimated daily protein:  {protein_target}g")
    override = input("Accept these targets? (y/n): ").strip().lower()
    if override == "n":
        calorie_target = int(input("Enter your daily calorie target: ").strip())
        protein_target = int(input("Enter your daily protein target (g): ").strip())

    profile = {
        "goal": goal,
        "gym_days": gym_days,
        "rest_days": rest_days,
        "meal_prep_day": meal_prep_day,
        "fitness_level": fitness_level,
        "equipment": equipment,
        "dietary_preference": dietary_preference,
        "allergies": allergies,
        "daily_calorie_target": calorie_target,
        "protein_target_g": protein_target,
    }
    save_profile(conn, profile)
    print("\nProfile saved!\n")
    return profile


def estimate_targets(goal, fitness_level):
    targets = {
        ("lose_weight", "beginner"): (1600, 120),
        ("lose_weight", "intermediate"): (1800, 140),
        ("lose_weight", "advanced"): (2000, 160),
        ("build_muscle", "beginner"): (2500, 160),
        ("build_muscle", "intermediate"): (2800, 180),
        ("build_muscle", "advanced"): (3200, 200),
        ("maintain", "beginner"): (2000, 130),
        ("maintain", "intermediate"): (2200, 150),
        ("maintain", "advanced"): (2500, 160),
        ("endurance", "beginner"): (2200, 140),
        ("endurance", "intermediate"): (2500, 160),
        ("endurance", "advanced"): (2800, 170),
    }
    return targets.get((goal, fitness_level), (2000, 150))


def edit_profile_menu(conn):
    print("\nRe-running profile wizard...")
    profile = profile_wizard(conn)
    regen = input("Regenerate this week's plan with new profile? (y/n): ").strip().lower()
    if regen == "y":
        generate_plan(profile, conn)
        print("Plan regenerated.")
```

- [ ] **Step 2: Verify wizard runs manually**

```bash
python -c "
import sqlite3, sys
sys.path.insert(0, '.')
from planner import get_db, profile_wizard
conn = get_db()
profile_wizard(conn)
conn.close()
"
```
Expected: Wizard prompts appear, profile saves without error.

- [ ] **Step 3: Commit**

```bash
git add planner.py
git commit -m "feat: add profile wizard and target estimation"
```

---

## Task 6: Library-Based Plan Generation

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import generate_plan_library, save_plan, load_current_plan, get_week_start, DAYS


SAMPLE_PROFILE = {
    "goal": "build_muscle",
    "gym_days": "Mon,Wed,Fri",
    "rest_days": "Tue,Thu,Sun",
    "meal_prep_day": "Sat",
    "fitness_level": "intermediate",
    "equipment": "dumbbells,bodyweight",
    "dietary_preference": "none",
    "allergies": "none",
    "daily_calorie_target": 2800,
    "protein_target_g": 180,
}


def test_generate_plan_library_has_all_days():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    for day in DAYS:
        assert day in plan
        assert "type" in plan[day]
        assert "meals" in plan[day]


def test_generate_plan_library_gym_days_have_exercises():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    for day in ["Mon", "Wed", "Fri"]:
        assert plan[day]["type"] == "gym"
        assert len(plan[day]["exercises"]) > 0


def test_save_and_load_plan_roundtrip():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    week_start = get_week_start()
    save_plan(conn, week_start, plan)
    loaded = load_current_plan(conn)
    assert loaded is not None
    for day in DAYS:
        assert day in loaded
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_generate_plan_library_has_all_days -v
```
Expected: FAIL

- [ ] **Step 3: Implement plan generation and save/load**

```python
def generate_plan_library(profile, conn):
    gym_days = [d.strip() for d in profile["gym_days"].split(",")]
    meal_prep_day = profile["meal_prep_day"].strip()
    all_meals = get_all_meals(conn)
    all_exercises = get_all_exercises(conn)
    filtered_meals = filter_meals(all_meals, profile)
    filtered_exercises = filter_exercises(all_exercises, profile)

    plan = {}
    for day in DAYS:
        meals = sample_meals(filtered_meals)
        if day in gym_days:
            exercises = random.sample(filtered_exercises, min(4, len(filtered_exercises)))
            plan[day] = {
                "type": "gym",
                "exercises": [{"name": e["name"], "sets": e["sets"], "reps": e["reps"]} for e in exercises],
                "meals": meals,
            }
        elif day == meal_prep_day:
            prep_items = random.sample(filtered_meals, min(5, len(filtered_meals)))
            plan[day] = {
                "type": "meal_prep",
                "prep_tasks": [m["name"] for m in prep_items],
                "meals": meals,
            }
        else:
            plan[day] = {
                "type": "rest",
                "activity": random.choice(REST_ACTIVITIES),
                "meals": meals,
            }
    return plan


def save_plan(conn, week_start, plan):
    conn.execute("""
        INSERT INTO weekly_plans (week_start, plan_json, created_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(week_start) DO UPDATE SET plan_json=excluded.plan_json, created_at=excluded.created_at
    """, (week_start, json.dumps(plan)))
    conn.commit()


def load_current_plan(conn):
    week_start = get_week_start()
    row = conn.execute("SELECT plan_json FROM weekly_plans WHERE week_start=?", (week_start,)).fetchone()
    if row is None:
        return None
    return json.loads(row["plan_json"])
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add library-based plan generation and plan save/load"
```

---

## Task 7: Claude API Wrapper and AI-Enhanced Plan Generation

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from unittest.mock import patch, MagicMock
from planner import ask_claude, generate_plan


def test_ask_claude_calls_api():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="test response")]
    with patch("anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = mock_response
        result = ask_claude("hello")
    assert result == "test response"


def test_generate_plan_falls_back_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    conn = make_conn()
    init_db(conn)
    plan = generate_plan(SAMPLE_PROFILE, conn)
    for day in DAYS:
        assert day in plan
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_ask_claude_calls_api tests/test_planner.py::test_generate_plan_falls_back_without_api_key -v
```
Expected: FAIL

- [ ] **Step 3: Implement `ask_claude`, `enhance_plan_with_ai`, and `generate_plan`**

```python
def ask_claude(prompt):
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        system="You are a fitness and nutrition expert. Always respond with valid JSON when asked.",
    )
    return response.content[0].text


def enhance_plan_with_ai(profile, plan):
    prompt = f"""You are a fitness and nutrition expert. Improve this weekly plan for someone with:
- Goal: {profile['goal']}
- Fitness level: {profile['fitness_level']}
- Equipment: {profile['equipment']}
- Dietary preference: {profile['dietary_preference']}
- Allergies: {profile['allergies']}
- Daily calorie target: {profile['daily_calorie_target']} kcal
- Daily protein target: {profile['protein_target_g']}g

Add variety to meals and ensure exercise progressions match the goal.
Return ONLY valid JSON with exactly the same structure as the input. Do not add new keys.

Current plan:
{json.dumps(plan, indent=2)}"""

    try:
        raw = ask_claude(prompt)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except Exception:
        return plan  # fall back to library plan if AI fails


def generate_plan(profile, conn):
    plan = generate_plan_library(profile, conn)
    if os.getenv("ANTHROPIC_API_KEY"):
        print("Enhancing plan with AI...")
        plan = enhance_plan_with_ai(profile, plan)
    else:
        print("No ANTHROPIC_API_KEY found — using built-in library only.")
    week_start = get_week_start()
    save_plan(conn, week_start, plan)
    print("Plan saved.")
    return plan
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add Claude API wrapper and AI-enhanced plan generation"
```

---

## Task 8: Week View Display

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import format_week_view, generate_plan_library


def test_format_week_view_contains_all_days():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    output = format_week_view(plan, [])
    for day in DAYS:
        assert day in output


def test_format_week_view_shows_gym_type():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    output = format_week_view(plan, [])
    assert "GYM" in output or "gym" in output.lower()
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_format_week_view_contains_all_days -v
```
Expected: FAIL

- [ ] **Step 3: Implement `format_week_view` and `display_week`**

```python
def format_week_view(plan, check_offs):
    done_set = {(c["day"], c["item_type"], c["item_name"]) for c in check_offs if c["done"]}
    lines = [f"\n{'='*60}", f"  WEEKLY PLAN — Week of {get_week_start()}", f"{'='*60}"]
    for day in DAYS:
        if day not in plan:
            continue
        entry = plan[day]
        day_type = entry["type"].upper()
        lines.append(f"\n{day} [{day_type}]")
        lines.append("-" * 40)
        if entry["type"] == "gym":
            lines.append("  WORKOUT:")
            for ex in entry["exercises"]:
                marker = "[x]" if (day, "exercise", ex["name"]) in done_set else "[ ]"
                lines.append(f"    {marker} {ex['name']} — {ex['sets']} sets x {ex['reps']}")
        elif entry["type"] == "meal_prep":
            lines.append("  PREP TASKS:")
            for task in entry["prep_tasks"]:
                marker = "[x]" if (day, "meal", task) in done_set else "[ ]"
                lines.append(f"    {marker} Prep: {task}")
        else:
            activity = entry["activity"]
            marker = "[x]" if (day, "rest_activity", activity) in done_set else "[ ]"
            lines.append(f"  REST ACTIVITY: {marker} {activity}")
        lines.append("  MEALS:")
        for meal_type in ["breakfast", "lunch", "dinner", "snack"]:
            name = entry["meals"].get(meal_type, "—")
            marker = "[x]" if (day, "meal", name) in done_set else "[ ]"
            lines.append(f"    {marker} {meal_type.capitalize()}: {name}")
    lines.append(f"\n{'='*60}\n")
    return "\n".join(lines)


def display_week(conn):
    plan = load_current_plan(conn)
    if plan is None:
        print("No plan for this week. Generate one first (option 3).")
        return
    week_start = get_week_start()
    check_offs = load_check_offs(conn, week_start)
    print(format_week_view(plan, check_offs))
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add week view display"
```

---

## Task 9: Check-Off System

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import load_check_offs, mark_done


def test_load_check_offs_empty():
    conn = make_conn()
    init_db(conn)
    result = load_check_offs(conn, "2026-04-20")
    assert result == []


def test_mark_done_persists():
    conn = make_conn()
    init_db(conn)
    mark_done(conn, "2026-04-20", "Mon", "exercise", "Push-ups")
    check_offs = load_check_offs(conn, "2026-04-20")
    assert len(check_offs) == 1
    assert check_offs[0]["done"] == 1
    assert check_offs[0]["item_name"] == "Push-ups"


def test_mark_done_idempotent():
    conn = make_conn()
    init_db(conn)
    mark_done(conn, "2026-04-20", "Mon", "exercise", "Push-ups")
    mark_done(conn, "2026-04-20", "Mon", "exercise", "Push-ups")
    check_offs = load_check_offs(conn, "2026-04-20")
    assert len(check_offs) == 1
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_load_check_offs_empty -v
```
Expected: FAIL

- [ ] **Step 3: Implement check-off functions**

```python
def load_check_offs(conn, week_start):
    rows = conn.execute(
        "SELECT * FROM check_offs WHERE week_start=?", (week_start,)
    ).fetchall()
    return [dict(r) for r in rows]


def mark_done(conn, week_start, day, item_type, item_name):
    existing = conn.execute(
        "SELECT id FROM check_offs WHERE week_start=? AND day=? AND item_type=? AND item_name=?",
        (week_start, day, item_type, item_name)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE check_offs SET done=1 WHERE id=?", (existing["id"],)
        )
    else:
        conn.execute(
            "INSERT INTO check_offs (week_start, day, item_type, item_name, done) VALUES (?,?,?,?,1)",
            (week_start, day, item_type, item_name)
        )
    conn.commit()


def check_off_menu(conn):
    plan = load_current_plan(conn)
    if plan is None:
        print("No plan this week. Generate one first.")
        return
    week_start = get_week_start()
    print("\nWhich day? (Mon/Tue/Wed/Thu/Fri/Sat/Sun): ", end="")
    day = input().strip().capitalize()[:3]
    if day not in plan:
        print("Invalid day.")
        return
    entry = plan[day]
    items = []
    if entry["type"] == "gym":
        for ex in entry["exercises"]:
            items.append(("exercise", ex["name"]))
    elif entry["type"] == "meal_prep":
        for task in entry["prep_tasks"]:
            items.append(("meal", task))
    else:
        items.append(("rest_activity", entry["activity"]))
    for meal_type in ["breakfast", "lunch", "dinner", "snack"]:
        name = entry["meals"].get(meal_type)
        if name:
            items.append(("meal", name))
    print(f"\nItems for {day}:")
    for i, (itype, name) in enumerate(items, 1):
        print(f"  {i}. [{itype}] {name}")
    choices = input("Enter numbers to mark done (comma-separated): ").strip()
    for c in choices.split(","):
        try:
            idx = int(c.strip()) - 1
            itype, name = items[idx]
            mark_done(conn, week_start, day, itype, name)
            print(f"  Marked done: {name}")
        except (ValueError, IndexError):
            print(f"  Invalid choice: {c.strip()}")
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add check-off system"
```

---

## Task 10: Meal Checker

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import check_meal


def test_check_meal_saves_feedback(monkeypatch):
    conn = make_conn()
    init_db(conn)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    with patch("planner.ask_claude") as mock_ask:
        mock_ask.return_value = "Verdict: on track. Estimated 520 kcal, 45g protein. Good protein source. Consider adding vegetables. Try a side salad next meal."
        result = check_meal(SAMPLE_PROFILE, "grilled chicken and rice", conn)
    assert "on track" in result.lower() or "verdict" in result.lower()
    week_start = get_week_start()
    rows = conn.execute("SELECT * FROM check_offs WHERE item_type='meal_check'").fetchall()
    assert len(rows) == 1
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pytest tests/test_planner.py::test_check_meal_saves_feedback -v
```
Expected: FAIL

- [ ] **Step 3: Implement `check_meal` and `meal_checker_menu`**

```python
def check_meal(profile, food_desc, conn):
    prompt = f"""You are a nutrition expert. Analyze this meal for someone with:
- Fitness goal: {profile['goal']}
- Daily calorie target: {profile['daily_calorie_target']} kcal
- Daily protein target: {profile['protein_target_g']}g
- Dietary preference: {profile['dietary_preference']}
- Allergies: {profile['allergies']}

Meal logged: {food_desc}

Respond in under 150 words covering:
1. Verdict: "on track", "off track", or "partial"
2. Estimated calories and protein
3. What was good about this choice
4. What could be improved
5. One actionable suggestion for the next meal"""

    try:
        feedback = ask_claude(prompt)
    except Exception as e:
        feedback = f"AI unavailable: {e}"

    week_start = get_week_start()
    conn.execute("""
        INSERT INTO check_offs (week_start, day, item_type, item_name, done, nutrition_feedback)
        VALUES (?, ?, 'meal_check', ?, 1, ?)
    """, (week_start, date.today().strftime("%a"), food_desc[:100], feedback))
    conn.commit()
    return feedback


def meal_checker_menu(conn):
    profile = load_profile(conn)
    if profile is None:
        print("Set up your profile first.")
        return
    print("\n=== Meal Checker ===")
    food_desc = input("What did you eat? Describe or list items: ").strip()
    if not food_desc:
        return
    print("\nAnalyzing...")
    result = check_meal(profile, food_desc, conn)
    print(f"\n{result}\n")
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add meal checker with Claude analysis"
```

---

## Task 11: Export

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
from planner import export_markdown, export_json
import json as json_lib


def test_export_markdown_contains_days():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    md = export_markdown(plan, "2026-04-20", [])
    for day in DAYS:
        assert day in md
    assert "# Weekly Plan" in md


def test_export_json_is_valid():
    conn = make_conn()
    init_db(conn)
    plan = generate_plan_library(SAMPLE_PROFILE, conn)
    result = export_json(plan, "2026-04-20")
    parsed = json_lib.loads(result)
    assert "week_start" in parsed
    assert "plan" in parsed
    for day in DAYS:
        assert day in parsed["plan"]
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pytest tests/test_planner.py::test_export_markdown_contains_days -v
```
Expected: FAIL

- [ ] **Step 3: Implement export functions**

```python
def export_markdown(plan, week_start, check_offs):
    done_set = {(c["day"], c["item_type"], c["item_name"]) for c in check_offs if c["done"]}
    lines = [f"# Weekly Plan — {week_start}\n"]
    for day in DAYS:
        if day not in plan:
            continue
        entry = plan[day]
        lines.append(f"## {day} ({entry['type'].upper()})\n")
        if entry["type"] == "gym":
            lines.append("### Workout")
            for ex in entry["exercises"]:
                done = "~~" if (day, "exercise", ex["name"]) in done_set else ""
                end = "~~" if done else ""
                lines.append(f"- {done}{ex['name']} — {ex['sets']} sets x {ex['reps']}{end}")
        elif entry["type"] == "meal_prep":
            lines.append("### Prep Tasks")
            for task in entry["prep_tasks"]:
                lines.append(f"- {task}")
        else:
            lines.append(f"**Rest Activity:** {entry['activity']}\n")
        lines.append("\n### Meals")
        for meal_type in ["breakfast", "lunch", "dinner", "snack"]:
            name = entry["meals"].get(meal_type, "—")
            lines.append(f"- **{meal_type.capitalize()}:** {name}")
        lines.append("")
    return "\n".join(lines)


def export_json(plan, week_start):
    return json.dumps({"week_start": week_start, "plan": plan}, indent=2)


def export_menu(conn):
    plan = load_current_plan(conn)
    if plan is None:
        print("No plan this week. Generate one first.")
        return
    week_start = get_week_start()
    check_offs = load_check_offs(conn, week_start)
    print("\nExport format:")
    print("  1. Markdown (.md)")
    print("  2. JSON (.json)")
    print("  3. Both")
    choice = input("Enter 1-3: ").strip()
    if choice in ("1", "3"):
        fname = f"plan_{week_start}.md"
        with open(fname, "w") as f:
            f.write(export_markdown(plan, week_start, check_offs))
        print(f"Saved: {fname}")
    if choice in ("2", "3"):
        fname = f"plan_{week_start}.json"
        with open(fname, "w") as f:
            f.write(export_json(plan, week_start))
        print(f"Saved: {fname}")
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add markdown and JSON export"
```

---

## Task 12: Custom Items and Main Menu

**Files:**
- Modify: `planner.py`
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Write failing test for custom items**

```python
from planner import add_custom_item, get_all_meals


def test_add_and_retrieve_custom_meal():
    conn = make_conn()
    init_db(conn)
    custom = {"name": "My Special Bowl", "goal": ["build_muscle"], "dietary": ["none"], "meal_type": "lunch", "protein_g": 40, "calories": 600}
    add_custom_item(conn, "meal", custom)
    all_meals = get_all_meals(conn)
    names = [m["name"] for m in all_meals]
    assert "My Special Bowl" in names
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pytest tests/test_planner.py::test_add_and_retrieve_custom_meal -v
```
Expected: FAIL

- [ ] **Step 3: Implement `add_custom_item` and `add_custom_menu`**

```python
def add_custom_item(conn, item_type, data):
    conn.execute(
        "INSERT INTO custom_items (item_type, data_json) VALUES (?, ?)",
        (item_type, json.dumps(data))
    )
    conn.commit()


def add_custom_menu(conn):
    print("\nAdd custom item:")
    print("  1. Meal\n  2. Exercise")
    choice = input("Enter 1 or 2: ").strip()
    if choice == "1":
        name = input("Meal name: ").strip()
        meal_type = input("Type (breakfast/lunch/dinner/snack): ").strip()
        protein = int(input("Protein (g): ").strip() or "0")
        calories = int(input("Calories: ").strip() or "0")
        profile = load_profile(conn)
        goal = [profile["goal"]] if profile else ["maintain"]
        diet = [profile["dietary_preference"]] if profile else ["none"]
        item = {"name": name, "goal": goal, "dietary": diet, "meal_type": meal_type, "protein_g": protein, "calories": calories}
        add_custom_item(conn, "meal", item)
        print(f"Added meal: {name}")
    elif choice == "2":
        name = input("Exercise name: ").strip()
        muscle_group = input("Muscle group: ").strip()
        sets = int(input("Sets: ").strip() or "3")
        reps = input("Reps (e.g. 10-12): ").strip()
        equipment = input("Equipment needed (comma-separated): ").strip() or "bodyweight"
        profile = load_profile(conn)
        goal = [profile["goal"]] if profile else ["maintain"]
        item = {"name": name, "goal": goal, "equipment": [e.strip() for e in equipment.split(",")], "muscle_group": muscle_group, "sets": sets, "reps": reps}
        add_custom_item(conn, "exercise", item)
        print(f"Added exercise: {name}")
```

- [ ] **Step 4: Implement `main()` to wire up the full menu**

```python
def main():
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY not set. AI features will be unavailable.")
        print("  Set it with: export ANTHROPIC_API_KEY=your_key\n")

    conn = get_db()

    profile = load_profile(conn)
    if profile is None:
        print("Welcome! Let's set up your profile first.\n")
        profile = profile_wizard(conn)
        print("Generating your first weekly plan...\n")
        generate_plan(profile, conn)

    while True:
        print("\n=== PLANNER MENU ===")
        print("1. View this week's plan")
        print("2. Check off items")
        print("3. Generate new plan for this week")
        print("4. Add custom meal or exercise")
        print("5. Meal checker — log what you ate")
        print("6. Export plan (markdown / JSON)")
        print("7. Edit profile")
        print("8. Quit")
        choice = input("\nEnter 1-8: ").strip()

        if choice == "1":
            display_week(conn)
        elif choice == "2":
            check_off_menu(conn)
        elif choice == "3":
            profile = load_profile(conn)
            generate_plan(profile, conn)
            display_week(conn)
        elif choice == "4":
            add_custom_menu(conn)
        elif choice == "5":
            meal_checker_menu(conn)
        elif choice == "6":
            export_menu(conn)
        elif choice == "7":
            edit_profile_menu(conn)
        elif choice == "8":
            print("Goodbye!")
            conn.close()
            sys.exit(0)
        else:
            print("Invalid choice, enter 1-8.")
```

- [ ] **Step 5: Run all tests to confirm pass**

```bash
pytest tests/test_planner.py -v
```
Expected: all tests PASS

- [ ] **Step 6: Run the full app manually**

```bash
python planner.py
```
Expected: Profile wizard on first run, main menu on subsequent runs.

- [ ] **Step 7: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: add custom items and wire up main menu — planner complete"
```

---

## Task 13: GitHub Repository Setup

**Files:**
- None (git remote operations)

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create meal-gym-planner --public --description "CLI tool to schedule meal prep, gym workouts, and rest day activities" --source=. --remote=origin
```

- [ ] **Step 2: Push all commits**

```bash
git push -u origin main
```

- [ ] **Step 3: Verify on GitHub**

```bash
gh repo view --web
```
Expected: GitHub page opens showing all files and commit history.

---

## Spec Coverage Verification

| Spec Requirement | Task |
|---|---|
| Single-file CLI (`planner.py`) | Task 1 |
| SQLite `profile`, `weekly_plans`, `check_offs` tables | Task 2 |
| `custom_items` table | Task 12 |
| `get_week_start` = Monday | Task 2 |
| Built-in meals, exercises, rest activities | Task 3 |
| Filter by goal + dietary + equipment | Task 3 |
| Profile wizard (8 questions) | Task 5 |
| Calorie + protein target estimation | Task 5 |
| Library-based plan generation | Task 6 |
| Claude API wrapper with fallback | Task 7 |
| AI-enhanced plan generation | Task 7 |
| Week view (gym/meal_prep/rest) | Task 8 |
| Check-off system | Task 9 |
| Meal checker (Claude analysis + DB save) | Task 10 |
| Export markdown + JSON | Task 11 |
| Add custom meal/exercise | Task 12 |
| Edit profile + optional regenerate | Task 5 (edit_profile_menu) |
| Main menu (8 options) | Task 12 |
| Missing API key error handling | Task 7 + Task 12 (`main`) |
| GitHub repo | Task 13 |
