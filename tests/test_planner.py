import sys
import sqlite3
from datetime import date, timedelta
sys.path.insert(0, ".")
import pytest
from planner import init_db, get_week_start, filter_meals, filter_exercises, sample_meals, MEALS, EXERCISES, save_profile, load_profile


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
