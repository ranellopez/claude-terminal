import sys
import sqlite3
from datetime import date, timedelta
sys.path.insert(0, ".")
import pytest
from planner import init_db, get_week_start


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
