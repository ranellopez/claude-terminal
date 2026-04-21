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


def main():
    print("Planner starting...")


if __name__ == "__main__":
    main()
