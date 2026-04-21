import anthropic
import sqlite3
import json
import random
import os
import sys
from datetime import date, timedelta

DB_PATH = "planner.db"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

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
