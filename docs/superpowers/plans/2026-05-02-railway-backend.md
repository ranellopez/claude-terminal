# Railway Backend Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the FastAPI backend from SQLite to SQLAlchemy Core + Postgres and deploy it to Railway with auto-deploy on push to `main`.

**Architecture:** SQLAlchemy Core (sync) wraps all DB access in `planner.py`, using a `DATABASE_URL` env var that points to SQLite locally and Railway Postgres in production. Alembic manages schema migrations and runs automatically on each Railway deploy. The frontend is not deployed to Railway.

**Tech Stack:** FastAPI, SQLAlchemy Core (sync), psycopg2-binary, Alembic, python-dotenv, Railway

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `requirements.txt` | Modify | Add sqlalchemy, alembic, psycopg2-binary, python-dotenv |
| `.env.example` | Create | Document required env vars |
| `alembic.ini` | Create | Alembic config (URL overridden by env.py) |
| `alembic/env.py` | Create | Read DATABASE_URL from env |
| `alembic/versions/001_initial.py` | Create | Create all 4 tables |
| `planner.py` | Modify | Replace sqlite3 with SQLAlchemy Core |
| `server.py` | Modify | Tighten CORS to FRONTEND_URL |
| `railway.toml` | Create | Railway start command + alembic pre-start |
| `scripts/migrate_sqlite_to_postgres.py` | Create | One-time data migration from planner.db |
| `tests/test_planner.py` | Modify | Update fixture from sqlite3 to SQLAlchemy |
| `tests/test_api.py` | Modify | Patch engine instead of DB_PATH |

---

## Task 1: Update requirements.txt and add .env.example

**Files:**
- Modify: `requirements.txt`
- Create: `.env.example`

- [ ] **Step 1: Update requirements.txt**

Replace the full contents of `requirements.txt` with:

```
anthropic>=0.40.0
pytest
fastapi
uvicorn[standard]
httpx
sqlalchemy>=2.0
alembic
psycopg2-binary
python-dotenv
```

- [ ] **Step 2: Create .env.example**

Create `/.env.example`:

```
DATABASE_URL=sqlite:///planner.db
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Install new dependencies**

```bash
pip install sqlalchemy alembic psycopg2-binary python-dotenv
```

Expected: packages install without errors.

- [ ] **Step 4: Commit**

```bash
git add requirements.txt .env.example
git commit -m "chore: add sqlalchemy, alembic, psycopg2-binary, python-dotenv"
```

---

## Task 2: Set up Alembic

**Files:**
- Create: `alembic.ini`
- Create: `alembic/env.py`
- Create: `alembic/versions/001_initial.py`

- [ ] **Step 1: Initialize Alembic**

```bash
alembic init alembic
```

Expected: creates `alembic.ini` and `alembic/` directory with `env.py`, `script.py.mako`, and `versions/`.

- [ ] **Step 2: Configure alembic/env.py to read DATABASE_URL**

Replace the full contents of `alembic/env.py` with:

```python
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config
fileConfig(config.config_file_name)

db_url = os.getenv("DATABASE_URL", "sqlite:///planner.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline():
    context.configure(url=db_url, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Write the initial migration**

Create `alembic/versions/001_initial.py`:

```python
"""initial tables

Revision ID: 001
Revises:
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goal", sa.Text()),
        sa.Column("gym_days", sa.Text()),
        sa.Column("rest_days", sa.Text()),
        sa.Column("meal_prep_day", sa.Text()),
        sa.Column("fitness_level", sa.Text()),
        sa.Column("equipment", sa.Text()),
        sa.Column("dietary_preference", sa.Text()),
        sa.Column("allergies", sa.Text()),
        sa.Column("daily_calorie_target", sa.Integer()),
        sa.Column("protein_target_g", sa.Integer()),
    )
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("week_start", sa.Text(), nullable=False, unique=True),
        sa.Column("plan_json", sa.Text()),
        sa.Column("created_at", sa.Text()),
    )
    op.create_table(
        "check_offs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("week_start", sa.Text()),
        sa.Column("day", sa.Text()),
        sa.Column("item_type", sa.Text()),
        sa.Column("item_name", sa.Text()),
        sa.Column("done", sa.Integer(), server_default="0"),
        sa.Column("nutrition_feedback", sa.Text()),
    )
    op.create_table(
        "custom_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_type", sa.Text()),
        sa.Column("data_json", sa.Text()),
    )


def downgrade():
    op.drop_table("custom_items")
    op.drop_table("check_offs")
    op.drop_table("weekly_plans")
    op.drop_table("profile")
```

- [ ] **Step 4: Run migration locally to verify it applies**

```bash
alembic upgrade head
```

Expected: `Running upgrade  -> 001, initial tables` with no errors.

- [ ] **Step 5: Commit**

```bash
git add alembic.ini alembic/
git commit -m "feat: add alembic with initial 4-table migration"
```

---

## Task 3: Update tests/test_planner.py — new SQLAlchemy fixture

Do this BEFORE touching planner.py so the tests fail first (TDD red step).

**Files:**
- Modify: `tests/test_planner.py`

- [ ] **Step 1: Replace make_conn() and fixture setup**

At the top of `tests/test_planner.py`, replace:

```python
import sys
import sqlite3
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
sys.path.insert(0, ".")
import pytest
import json as json_lib
from planner import init_db, get_week_start, filter_meals, filter_exercises, sample_meals, MEALS, EXERCISES, save_profile, load_profile, generate_plan_library, save_plan, load_current_plan, ask_claude, generate_plan, DAYS, format_week_view, load_check_offs, mark_done, check_meal, export_markdown, export_json, add_custom_item, get_all_meals, QUESTIONS, get_all_plans, get_plan_by_id, update_plan_by_id, delete_plan_by_id, restore_plan_by_id


def make_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    return conn
```

with:

```python
import sys
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
sys.path.insert(0, ".")
import pytest
import json as json_lib
from sqlalchemy import create_engine, text
from planner import get_week_start, filter_meals, filter_exercises, sample_meals, MEALS, EXERCISES, save_profile, load_profile, generate_plan_library, save_plan, load_current_plan, ask_claude, generate_plan, DAYS, format_week_view, load_check_offs, mark_done, check_meal, export_markdown, export_json, add_custom_item, get_all_meals, QUESTIONS, get_all_plans, get_plan_by_id, update_plan_by_id, delete_plan_by_id, restore_plan_by_id


def _create_tables(engine):
    with engine.connect() as c:
        c.execute(text("""CREATE TABLE profile (
            id INTEGER PRIMARY KEY, goal TEXT, gym_days TEXT, rest_days TEXT,
            meal_prep_day TEXT, fitness_level TEXT, equipment TEXT,
            dietary_preference TEXT, allergies TEXT,
            daily_calorie_target INTEGER, protein_target_g INTEGER)"""))
        c.execute(text("""CREATE TABLE weekly_plans (
            id INTEGER PRIMARY KEY, week_start TEXT UNIQUE,
            plan_json TEXT, created_at TEXT)"""))
        c.execute(text("""CREATE TABLE check_offs (
            id INTEGER PRIMARY KEY, week_start TEXT, day TEXT,
            item_type TEXT, item_name TEXT, done INTEGER DEFAULT 0,
            nutrition_feedback TEXT)"""))
        c.execute(text("""CREATE TABLE custom_items (
            id INTEGER PRIMARY KEY, item_type TEXT, data_json TEXT)"""))
        c.commit()


@pytest.fixture
def conn():
    engine = create_engine("sqlite:///:memory:")
    _create_tables(engine)
    with engine.connect() as c:
        yield c
```

- [ ] **Step 2: Replace test_init_db_creates_tables**

Replace:

```python
def test_init_db_creates_tables():
    conn = make_conn()
    init_db(conn)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert "profile" in tables
    assert "weekly_plans" in tables
    assert "check_offs" in tables
    assert "custom_items" in tables
```

with:

```python
def test_tables_exist(conn):
    tables = {r.name for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    assert "profile" in tables
    assert "weekly_plans" in tables
    assert "check_offs" in tables
    assert "custom_items" in tables
```

- [ ] **Step 3: Update all test functions to use the conn fixture instead of make_conn()/init_db()**

Every test that currently starts with:
```python
conn = make_conn()
init_db(conn)
```
must be updated to accept `conn` as a pytest fixture parameter instead. For example:

```python
# BEFORE
def test_load_profile_returns_none_when_empty():
    conn = make_conn()
    init_db(conn)
    assert load_profile(conn) is None

# AFTER
def test_load_profile_returns_none_when_empty(conn):
    assert load_profile(conn) is None
```

Apply this pattern to ALL tests that call `make_conn()` and `init_db()`:
- `test_load_profile_returns_none_when_empty`
- `test_save_and_load_profile_roundtrip`
- `test_generate_plan_library_has_all_days`
- `test_generate_plan_library_gym_days_have_exercises`
- `test_save_and_load_plan_roundtrip`
- `test_generate_plan_falls_back_without_api_key`
- `test_format_week_view_contains_all_days`
- `test_format_week_view_shows_gym_type`
- `test_load_check_offs_empty`
- `test_mark_done_persists`
- `test_mark_done_idempotent`
- `test_check_meal_saves_feedback`
- `test_export_markdown_contains_days`
- `test_export_json_is_valid`
- `test_add_and_retrieve_custom_meal`
- `test_get_all_plans_empty`
- `test_get_all_plans_returns_saved_plan`
- `test_get_plan_by_id_returns_plan`
- `test_get_plan_by_id_missing_returns_none`
- `test_update_plan_by_id`
- `test_delete_plan_by_id`
- `test_restore_plan_by_id`
- `test_update_plan_by_id_missing_returns_false`
- `test_delete_plan_by_id_missing_returns_false`
- `test_delete_check_off`
- `test_list_custom_items`
- `test_delete_custom_item`

- [ ] **Step 4: Update test_delete_check_off to use SQLAlchemy**

Replace:

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
```

with:

```python
def test_delete_check_off(conn):
    mark_done(conn, "2026-04-21", "Mon", "exercise", "Push-ups")
    row = conn.execute(text("SELECT id FROM check_offs WHERE week_start='2026-04-21'")).fetchone()
    assert row is not None
    from planner import delete_check_off
    ok = delete_check_off(conn, row.id)
    assert ok is True
    gone = conn.execute(text("SELECT * FROM check_offs WHERE id=:id"), {"id": row.id}).fetchone()
    assert gone is None
```

- [ ] **Step 5: Update test_check_meal_saves_feedback to use SQLAlchemy**

Replace:

```python
def test_check_meal_saves_feedback(monkeypatch):
    conn = make_conn()
    init_db(conn)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    with patch("planner.ask_claude") as mock_ask:
        mock_ask.return_value = "Verdict: on track. Estimated 520 kcal, 45g protein. Good protein source. Consider adding vegetables. Try a side salad next meal."
        result = check_meal(SAMPLE_PROFILE, "grilled chicken and rice", conn)
    assert "on track" in result.lower() or "verdict" in result.lower()
    rows = conn.execute("SELECT * FROM check_offs WHERE item_type='meal_check'").fetchall()
    assert len(rows) == 1
```

with:

```python
def test_check_meal_saves_feedback(conn, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    with patch("planner.ask_claude") as mock_ask:
        mock_ask.return_value = "Verdict: on track. Estimated 520 kcal, 45g protein. Good protein source. Consider adding vegetables. Try a side salad next meal."
        result = check_meal(SAMPLE_PROFILE, "grilled chicken and rice", conn)
    assert "on track" in result.lower() or "verdict" in result.lower()
    rows = conn.execute(text("SELECT * FROM check_offs WHERE item_type='meal_check'")).fetchall()
    assert len(rows) == 1
```

- [ ] **Step 6: Run tests to verify they FAIL (red step)**

```bash
pytest tests/test_planner.py -v 2>&1 | head -30
```

Expected: multiple failures — `ImportError` for `init_db` and type errors since planner.py still uses sqlite3. This confirms TDD red step.

---

## Task 4: Update planner.py — engine, imports, get_db()

**Files:**
- Modify: `planner.py`

- [ ] **Step 1: Replace sqlite3 imports with SQLAlchemy at the top of planner.py**

Replace:

```python
import anthropic
import sqlite3
import json
import random
import os
import sys
from datetime import date, timedelta

DB_PATH = "planner.db"
```

with:

```python
import anthropic
import json
import random
import os
import sys
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

_db_url = os.getenv("DATABASE_URL", "sqlite:///planner.db")
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(_db_url)
```

- [ ] **Step 2: Remove init_db() and replace get_db()**

Remove the entire `init_db()` function (lines 482–518 in the original file).

Replace:

```python
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn
```

with:

```python
def get_db():
    return engine.connect()
```

- [ ] **Step 3: Run tests to verify progress — only DB-interaction tests should still fail**

```bash
pytest tests/test_planner.py -v -k "not profile and not plan and not check and not meal and not custom" 2>&1 | head -20
```

Expected: pure-logic tests (`test_get_week_start_is_monday`, `test_filter_meals_*`, `test_filter_exercises_*`, `test_sample_meals_*`) pass. DB tests still fail.

---

## Task 5: Migrate profile functions in planner.py

**Files:**
- Modify: `planner.py`

- [ ] **Step 1: Replace save_profile()**

Replace:

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
```

with:

```python
def save_profile(conn, profile):
    conn.execute(text("DELETE FROM profile"))
    conn.execute(text("""
        INSERT INTO profile (goal, gym_days, rest_days, meal_prep_day, fitness_level,
            equipment, dietary_preference, allergies, daily_calorie_target, protein_target_g)
        VALUES (:goal, :gym_days, :rest_days, :meal_prep_day, :fitness_level,
            :equipment, :dietary_preference, :allergies, :daily_calorie_target, :protein_target_g)
    """), profile)
    conn.commit()
```

- [ ] **Step 2: Replace load_profile()**

Replace:

```python
def load_profile(conn):
    row = conn.execute("SELECT * FROM profile LIMIT 1").fetchone()
    if row is None:
        return None
    return dict(row)
```

with:

```python
def load_profile(conn):
    row = conn.execute(text("SELECT * FROM profile LIMIT 1")).fetchone()
    if row is None:
        return None
    return dict(row._mapping)
```

- [ ] **Step 3: Run profile tests**

```bash
pytest tests/test_planner.py -v -k "profile" 2>&1
```

Expected: `test_load_profile_returns_none_when_empty` and `test_save_and_load_profile_roundtrip` PASS.

---

## Task 6: Migrate plan functions in planner.py

**Files:**
- Modify: `planner.py`

- [ ] **Step 1: Replace get_all_meals() and get_all_exercises()**

Replace:

```python
def get_all_meals(conn):
    custom = conn.execute("SELECT data_json FROM custom_items WHERE item_type='meal'").fetchall()
    return MEALS + [json.loads(r["data_json"]) for r in custom]


def get_all_exercises(conn):
    custom = conn.execute("SELECT data_json FROM custom_items WHERE item_type='exercise'").fetchall()
    return EXERCISES + [json.loads(r["data_json"]) for r in custom]
```

with:

```python
def get_all_meals(conn):
    custom = conn.execute(text("SELECT data_json FROM custom_items WHERE item_type='meal'")).fetchall()
    return MEALS + [json.loads(r.data_json) for r in custom]


def get_all_exercises(conn):
    custom = conn.execute(text("SELECT data_json FROM custom_items WHERE item_type='exercise'")).fetchall()
    return EXERCISES + [json.loads(r.data_json) for r in custom]
```

- [ ] **Step 2: Replace save_plan()**

Replace:

```python
def save_plan(conn, week_start, plan):
    conn.execute("""
        INSERT INTO weekly_plans (week_start, plan_json, created_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(week_start) DO UPDATE SET plan_json=excluded.plan_json, created_at=excluded.created_at
    """, (week_start, json.dumps(plan)))
    conn.commit()
```

with:

```python
def save_plan(conn, week_start, plan):
    conn.execute(text("""
        INSERT INTO weekly_plans (week_start, plan_json, created_at)
        VALUES (:week_start, :plan_json, :created_at)
        ON CONFLICT(week_start) DO UPDATE SET plan_json=EXCLUDED.plan_json, created_at=EXCLUDED.created_at
    """), {"week_start": week_start, "plan_json": json.dumps(plan), "created_at": datetime.utcnow().isoformat()})
    conn.commit()
```

- [ ] **Step 3: Replace load_current_plan()**

Replace:

```python
def load_current_plan(conn):
    week_start = get_week_start()
    row = conn.execute("SELECT plan_json FROM weekly_plans WHERE week_start=?", (week_start,)).fetchone()
    if row is None:
        return None
    return json.loads(row["plan_json"])
```

with:

```python
def load_current_plan(conn):
    week_start = get_week_start()
    row = conn.execute(text("SELECT plan_json FROM weekly_plans WHERE week_start=:week_start"), {"week_start": week_start}).fetchone()
    if row is None:
        return None
    return json.loads(row.plan_json)
```

- [ ] **Step 4: Replace get_all_plans()**

Replace:

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
```

with:

```python
def get_all_plans(conn):
    current_week = get_week_start()
    profile = load_profile(conn)
    rows = conn.execute(text(
        "SELECT id, week_start, plan_json, created_at FROM weekly_plans ORDER BY week_start DESC"
    )).fetchall()
    result = []
    for row in rows:
        plan = json.loads(row.plan_json)
        result.append({
            "id": row.id,
            "week_start": row.week_start,
            "created_at": row.created_at,
            "is_current": row.week_start == current_week,
            "gym_days": sum(1 for d in plan.values() if d.get("type") == "gym"),
            "goal": profile["goal"] if profile else "unknown",
            "daily_calorie_target": profile["daily_calorie_target"] if profile else 0,
            "protein_target_g": profile["protein_target_g"] if profile else 0,
            "meal_prep_day": profile["meal_prep_day"] if profile else "",
        })
    return result
```

- [ ] **Step 5: Replace get_plan_by_id()**

Replace:

```python
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
```

with:

```python
def get_plan_by_id(conn, plan_id):
    row = conn.execute(text(
        "SELECT id, week_start, plan_json, created_at FROM weekly_plans WHERE id=:plan_id"
    ), {"plan_id": plan_id}).fetchone()
    if row is None:
        return None
    return {
        "id": row.id,
        "week_start": row.week_start,
        "created_at": row.created_at,
        "is_current": row.week_start == get_week_start(),
        "plan": json.loads(row.plan_json),
    }
```

- [ ] **Step 6: Replace update_plan_by_id()**

Replace:

```python
def update_plan_by_id(conn, plan_id, plan):
    result = conn.execute(
        "UPDATE weekly_plans SET plan_json=? WHERE id=?",
        (json.dumps(plan), plan_id)
    )
    conn.commit()
    return result.rowcount > 0
```

with:

```python
def update_plan_by_id(conn, plan_id, plan):
    result = conn.execute(text(
        "UPDATE weekly_plans SET plan_json=:plan_json WHERE id=:plan_id"
    ), {"plan_json": json.dumps(plan), "plan_id": plan_id})
    conn.commit()
    return result.rowcount > 0
```

- [ ] **Step 7: Replace delete_plan_by_id()**

Replace:

```python
def delete_plan_by_id(conn, plan_id):
    result = conn.execute("DELETE FROM weekly_plans WHERE id=?", (plan_id,))
    conn.commit()
    return result.rowcount > 0
```

with:

```python
def delete_plan_by_id(conn, plan_id):
    result = conn.execute(text("DELETE FROM weekly_plans WHERE id=:plan_id"), {"plan_id": plan_id})
    conn.commit()
    return result.rowcount > 0
```

- [ ] **Step 8: Replace restore_plan_by_id()**

Replace:

```python
def restore_plan_by_id(conn, plan_id):
    row = conn.execute(
        "SELECT plan_json FROM weekly_plans WHERE id=?", (plan_id,)
    ).fetchone()
    if row is None:
        return False
    save_plan(conn, get_week_start(), json.loads(row["plan_json"]))
    return True
```

with:

```python
def restore_plan_by_id(conn, plan_id):
    row = conn.execute(text("SELECT plan_json FROM weekly_plans WHERE id=:plan_id"), {"plan_id": plan_id}).fetchone()
    if row is None:
        return False
    save_plan(conn, get_week_start(), json.loads(row.plan_json))
    return True
```

- [ ] **Step 9: Run plan tests**

```bash
pytest tests/test_planner.py -v -k "plan or generate" 2>&1
```

Expected: all plan-related tests PASS.

---

## Task 7: Migrate check-off, custom item, and meal-check functions in planner.py

**Files:**
- Modify: `planner.py`

- [ ] **Step 1: Replace load_check_offs()**

Replace:

```python
def load_check_offs(conn, week_start):
    rows = conn.execute(
        "SELECT * FROM check_offs WHERE week_start=?", (week_start,)
    ).fetchall()
    return [dict(r) for r in rows]
```

with:

```python
def load_check_offs(conn, week_start):
    rows = conn.execute(text("SELECT * FROM check_offs WHERE week_start=:week_start"), {"week_start": week_start}).fetchall()
    return [dict(r._mapping) for r in rows]
```

- [ ] **Step 2: Replace mark_done()**

Replace:

```python
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
```

with:

```python
def mark_done(conn, week_start, day, item_type, item_name):
    existing = conn.execute(text(
        "SELECT id FROM check_offs WHERE week_start=:week_start AND day=:day AND item_type=:item_type AND item_name=:item_name"
    ), {"week_start": week_start, "day": day, "item_type": item_type, "item_name": item_name}).fetchone()
    if existing:
        conn.execute(text("UPDATE check_offs SET done=1 WHERE id=:id"), {"id": existing.id})
    else:
        conn.execute(text(
            "INSERT INTO check_offs (week_start, day, item_type, item_name, done) VALUES (:week_start, :day, :item_type, :item_name, 1)"
        ), {"week_start": week_start, "day": day, "item_type": item_type, "item_name": item_name})
    conn.commit()
```

- [ ] **Step 3: Replace delete_check_off()**

Replace:

```python
def delete_check_off(conn, check_off_id):
    result = conn.execute("DELETE FROM check_offs WHERE id=?", (check_off_id,))
    conn.commit()
    return result.rowcount > 0
```

with:

```python
def delete_check_off(conn, check_off_id):
    result = conn.execute(text("DELETE FROM check_offs WHERE id=:id"), {"id": check_off_id})
    conn.commit()
    return result.rowcount > 0
```

- [ ] **Step 4: Replace list_custom_items()**

Replace:

```python
def list_custom_items(conn):
    rows = conn.execute(
        "SELECT id, item_type, data_json FROM custom_items"
    ).fetchall()
    return [
        {"id": r["id"], "item_type": r["item_type"], "data": json.loads(r["data_json"])}
        for r in rows
    ]
```

with:

```python
def list_custom_items(conn):
    rows = conn.execute(text("SELECT id, item_type, data_json FROM custom_items")).fetchall()
    return [{"id": r.id, "item_type": r.item_type, "data": json.loads(r.data_json)} for r in rows]
```

- [ ] **Step 5: Replace add_custom_item()**

Replace:

```python
def add_custom_item(conn, item_type, data):
    conn.execute(
        "INSERT INTO custom_items (item_type, data_json) VALUES (?, ?)",
        (item_type, json.dumps(data))
    )
    conn.commit()
```

with:

```python
def add_custom_item(conn, item_type, data):
    conn.execute(text("INSERT INTO custom_items (item_type, data_json) VALUES (:item_type, :data_json)"),
                 {"item_type": item_type, "data_json": json.dumps(data)})
    conn.commit()
```

- [ ] **Step 6: Replace delete_custom_item()**

Replace:

```python
def delete_custom_item(conn, item_id):
    result = conn.execute("DELETE FROM custom_items WHERE id=?", (item_id,))
    conn.commit()
    return result.rowcount > 0
```

with:

```python
def delete_custom_item(conn, item_id):
    result = conn.execute(text("DELETE FROM custom_items WHERE id=:id"), {"id": item_id})
    conn.commit()
    return result.rowcount > 0
```

- [ ] **Step 7: Replace the inline SQL in check_meal()**

Replace:

```python
    conn.execute("""
        INSERT INTO check_offs (week_start, day, item_type, item_name, done, nutrition_feedback)
        VALUES (?, ?, 'meal_check', ?, 1, ?)
    """, (week_start, date.today().strftime("%a"), food_desc[:100], feedback))
    conn.commit()
```

with:

```python
    conn.execute(text("""
        INSERT INTO check_offs (week_start, day, item_type, item_name, done, nutrition_feedback)
        VALUES (:week_start, :day, 'meal_check', :item_name, 1, :feedback)
    """), {"week_start": week_start, "day": date.today().strftime("%a"), "item_name": food_desc[:100], "feedback": feedback})
    conn.commit()
```

- [ ] **Step 8: Run the full test_planner.py suite**

```bash
pytest tests/test_planner.py -v 2>&1
```

Expected: all tests PASS (green).

- [ ] **Step 9: Commit**

```bash
git add planner.py tests/test_planner.py
git commit -m "feat: migrate planner.py from sqlite3 to SQLAlchemy Core"
```

---

## Task 8: Update tests/test_api.py — patch engine instead of DB_PATH

**Files:**
- Modify: `tests/test_api.py`

- [ ] **Step 1: Replace the import block and setUpClass/tearDownClass**

Replace:

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
```

with:

```python
import sys
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

sys.path.insert(0, ".")
import planner
from server import app


def _create_tables(engine):
    with engine.connect() as c:
        c.execute(text("""CREATE TABLE profile (
            id INTEGER PRIMARY KEY, goal TEXT, gym_days TEXT, rest_days TEXT,
            meal_prep_day TEXT, fitness_level TEXT, equipment TEXT,
            dietary_preference TEXT, allergies TEXT,
            daily_calorie_target INTEGER, protein_target_g INTEGER)"""))
        c.execute(text("""CREATE TABLE weekly_plans (
            id INTEGER PRIMARY KEY, week_start TEXT UNIQUE,
            plan_json TEXT, created_at TEXT)"""))
        c.execute(text("""CREATE TABLE check_offs (
            id INTEGER PRIMARY KEY, week_start TEXT, day TEXT,
            item_type TEXT, item_name TEXT, done INTEGER DEFAULT 0,
            nutrition_feedback TEXT)"""))
        c.execute(text("""CREATE TABLE custom_items (
            id INTEGER PRIMARY KEY, item_type TEXT, data_json TEXT)"""))
        c.commit()
```

Replace `setUpClass` and `tearDownClass`:

```python
    @classmethod
    def setUpClass(cls):
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix=".db")
        planner.DB_PATH = cls.db_path  # must precede TestClient(app) — get_db reads DB_PATH at request time
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        planner.DB_PATH = "planner.db"
        os.close(cls.db_fd)
        os.unlink(cls.db_path)
```

with:

```python
    @classmethod
    def setUpClass(cls):
        test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        _create_tables(test_engine)
        planner.engine = test_engine
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        planner.engine.dispose()
```

- [ ] **Step 2: Update test_22_post_meal_check_no_profile to use SQLAlchemy**

Replace:

```python
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

with:

```python
    def test_22_post_meal_check_no_profile(self):
        with planner.engine.connect() as conn:
            conn.execute(text("DELETE FROM profile"))
            conn.commit()
        status, _ = self._req("POST", "/api/meal-check", {"food_desc": "pizza"})
        self.assertEqual(status, 400)
        self._req("PUT", "/api/profile", SAMPLE_PROFILE)
```

Also add `from sqlalchemy import text` inside the test method or at the top of the file — it's already imported at the module level in Step 1.

- [ ] **Step 3: Remove unused tempfile import**

Remove `import tempfile` from the imports since it's no longer used.

- [ ] **Step 4: Run the API test suite**

```bash
pytest tests/test_api.py -v 2>&1
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v 2>&1
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/test_api.py
git commit -m "test: update API tests to patch SQLAlchemy engine instead of DB_PATH"
```

---

## Task 9: Update server.py — tighten CORS

**Files:**
- Modify: `server.py`

- [ ] **Step 1: Update CORS in server.py**

Replace:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

with:

```python
_frontend_url = os.getenv("FRONTEND_URL")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url] if _frontend_url else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Also add `import os` at the top of server.py if not already present (it isn't — add it after the existing imports).

- [ ] **Step 4: Run full test suite to verify no regressions**

```bash
pytest tests/ -v 2>&1
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server.py
git commit -m "feat: restrict CORS to FRONTEND_URL env var in production"
```

---

## Task 10: Add railway.toml

**Files:**
- Create: `railway.toml`

- [ ] **Step 1: Create railway.toml**

Create `railway.toml` in the repo root:

```toml
[deploy]
startCommand = "alembic upgrade head && uvicorn server:app --host 0.0.0.0 --port $PORT"
```

- [ ] **Step 2: Verify local start command works**

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Expected: server starts, visit `http://localhost:8000` — the app loads.

Stop the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add railway.toml
git commit -m "feat: add railway.toml with alembic + uvicorn start command"
```

---

## Task 11: Write data migration script

**Files:**
- Create: `scripts/migrate_sqlite_to_postgres.py`

- [ ] **Step 1: Create scripts/ directory and migration script**

```bash
mkdir -p scripts
```

Create `scripts/migrate_sqlite_to_postgres.py`:

```python
"""One-time script: copy all data from local planner.db to Railway Postgres.

Usage:
    DATABASE_URL=postgresql://... python scripts/migrate_sqlite_to_postgres.py
    
    Or with a custom sqlite path:
    SQLITE_PATH=path/to/planner.db DATABASE_URL=postgresql://... python scripts/migrate_sqlite_to_postgres.py
"""
import os
import sqlite3
import sys
from sqlalchemy import create_engine, text

SQLITE_PATH = os.getenv("SQLITE_PATH", "planner.db")
POSTGRES_URL = os.getenv("DATABASE_URL")

if not POSTGRES_URL:
    sys.exit("Error: DATABASE_URL not set. Get it from Railway dashboard > your Postgres service > Connect.")

if not os.path.exists(SQLITE_PATH):
    sys.exit(f"Error: SQLite file not found at {SQLITE_PATH}")

if POSTGRES_URL.startswith("postgres://"):
    POSTGRES_URL = POSTGRES_URL.replace("postgres://", "postgresql://", 1)

src = sqlite3.connect(SQLITE_PATH)
src.row_factory = sqlite3.Row
pg = create_engine(POSTGRES_URL)

with pg.connect() as dst:
    # profile
    rows = src.execute("SELECT * FROM profile").fetchall()
    for row in rows:
        dst.execute(text("""
            INSERT INTO profile (goal, gym_days, rest_days, meal_prep_day, fitness_level,
                equipment, dietary_preference, allergies, daily_calorie_target, protein_target_g)
            VALUES (:goal, :gym_days, :rest_days, :meal_prep_day, :fitness_level,
                :equipment, :dietary_preference, :allergies, :daily_calorie_target, :protein_target_g)
            ON CONFLICT DO NOTHING
        """), dict(row))
    print(f"profile: {len(rows)} row(s) migrated")

    # weekly_plans
    rows = src.execute("SELECT week_start, plan_json, created_at FROM weekly_plans").fetchall()
    for row in rows:
        dst.execute(text("""
            INSERT INTO weekly_plans (week_start, plan_json, created_at)
            VALUES (:week_start, :plan_json, :created_at)
            ON CONFLICT(week_start) DO NOTHING
        """), dict(row))
    print(f"weekly_plans: {len(rows)} row(s) migrated")

    # check_offs
    rows = src.execute("SELECT week_start, day, item_type, item_name, done, nutrition_feedback FROM check_offs").fetchall()
    for row in rows:
        dst.execute(text("""
            INSERT INTO check_offs (week_start, day, item_type, item_name, done, nutrition_feedback)
            VALUES (:week_start, :day, :item_type, :item_name, :done, :nutrition_feedback)
        """), dict(row))
    print(f"check_offs: {len(rows)} row(s) migrated")

    # custom_items
    rows = src.execute("SELECT item_type, data_json FROM custom_items").fetchall()
    for row in rows:
        dst.execute(text("""
            INSERT INTO custom_items (item_type, data_json) VALUES (:item_type, :data_json)
        """), dict(row))
    print(f"custom_items: {len(rows)} row(s) migrated")

    dst.commit()

src.close()
print("\nMigration complete.")
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate_sqlite_to_postgres.py
git commit -m "feat: add one-time sqlite-to-postgres data migration script"
```

---

## Task 12: Deploy to Railway

These steps are done in the Railway dashboard and terminal — no code changes.

- [ ] **Step 1: Push the branch to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create Railway project and connect repo**

1. Go to railway.app and create a new project
2. Choose "Deploy from GitHub repo" → select `ranellopez/claude-terminal`
3. Railway will detect Python and start building

- [ ] **Step 3: Add Postgres plugin**

In Railway dashboard: click "+ New" → "Database" → "Add PostgreSQL"

Railway automatically sets `DATABASE_URL` in your service's environment.

- [ ] **Step 4: Set environment variables**

In Railway dashboard → your FastAPI service → "Variables":

```
ANTHROPIC_API_KEY=<your key from your local environment>
FRONTEND_URL=<URL of wherever your frontend is deployed, if known>
```

- [ ] **Step 5: Verify deploy succeeds**

Watch the deploy logs in Railway. Expected output includes:
```
Running upgrade  -> 001, initial tables
INFO:     Started server process
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:<PORT>
```

- [ ] **Step 6: Run the data migration**

Get the Postgres connection URL from Railway dashboard → Postgres service → "Connect" → copy the `DATABASE_URL`.

```bash
DATABASE_URL="postgresql://..." python scripts/migrate_sqlite_to_postgres.py
```

Expected:
```
profile: 1 row(s) migrated
weekly_plans: N row(s) migrated
check_offs: N row(s) migrated
custom_items: N row(s) migrated

Migration complete.
```

- [ ] **Step 7: Smoke-test the live API**

Replace `<railway-url>` with your Railway-provided domain (visible in the Railway dashboard):

```bash
curl https://<railway-url>/api/profile
curl https://<railway-url>/api/plans
```

Expected: JSON responses matching your migrated data.
