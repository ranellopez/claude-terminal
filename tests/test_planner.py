import sys
import sqlite3
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
sys.path.insert(0, ".")
import pytest
from planner import init_db, get_week_start, filter_meals, filter_exercises, sample_meals, MEALS, EXERCISES, save_profile, load_profile, generate_plan_library, save_plan, load_current_plan, ask_claude, generate_plan, DAYS, format_week_view, load_check_offs, mark_done, check_meal


def make_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    return conn


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


# Task 8: Week View Display

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


# Task 9: Check-Off System

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


# Task 10: Meal Checker

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
