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
    # profile — singleton table; clear and re-insert
    dst.execute(text("DELETE FROM profile"))
    rows = src.execute("SELECT * FROM profile").fetchall()
    for row in rows:
        dst.execute(text("""
            INSERT INTO profile (goal, gym_days, rest_days, meal_prep_day, fitness_level,
                equipment, dietary_preference, allergies, daily_calorie_target, protein_target_g)
            VALUES (:goal, :gym_days, :rest_days, :meal_prep_day, :fitness_level,
                :equipment, :dietary_preference, :allergies, :daily_calorie_target, :protein_target_g)
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
