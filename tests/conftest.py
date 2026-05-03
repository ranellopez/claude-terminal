from sqlalchemy import text, create_engine
from sqlalchemy.pool import StaticPool


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


def create_test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_tables(engine)
    return engine
