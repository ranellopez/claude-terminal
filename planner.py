import anthropic
import json
import random
import os
import sys
from datetime import date, timedelta, datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

_db_url = os.getenv("DATABASE_URL", "sqlite:///planner.db")
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(_db_url)
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
    custom = conn.execute(text("SELECT data_json FROM custom_items WHERE item_type='meal'")).fetchall()
    return MEALS + [json.loads(r.data_json) for r in custom]


def get_all_exercises(conn):
    custom = conn.execute(text("SELECT data_json FROM custom_items WHERE item_type='exercise'")).fetchall()
    return EXERCISES + [json.loads(r.data_json) for r in custom]


def save_profile(conn, profile):
    conn.execute(text("DELETE FROM profile"))
    conn.execute(text("""
        INSERT INTO profile (goal, gym_days, rest_days, meal_prep_day, fitness_level,
            equipment, dietary_preference, allergies, daily_calorie_target, protein_target_g)
        VALUES (:goal, :gym_days, :rest_days, :meal_prep_day, :fitness_level,
            :equipment, :dietary_preference, :allergies, :daily_calorie_target, :protein_target_g)
    """), profile)
    conn.commit()


def load_profile(conn):
    row = conn.execute(text("SELECT * FROM profile LIMIT 1")).fetchone()
    if row is None:
        return None
    return dict(row._mapping)


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


def edit_profile_menu(conn):
    print("\nRe-running profile wizard...")
    profile = profile_wizard(conn)
    regen = input("Regenerate this week's plan with new profile? (y/n): ").strip().lower()
    if regen == "y":
        generate_plan(profile, conn)
        print("Plan regenerated.")


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
    conn.execute(text("""
        INSERT INTO weekly_plans (week_start, plan_json, created_at)
        VALUES (:week_start, :plan_json, :created_at)
        ON CONFLICT(week_start) DO UPDATE SET plan_json=EXCLUDED.plan_json, created_at=EXCLUDED.created_at
    """), {"week_start": week_start, "plan_json": json.dumps(plan), "created_at": datetime.now(timezone.utc).isoformat()})
    conn.commit()


def load_current_plan(conn):
    week_start = get_week_start()
    row = conn.execute(text("SELECT plan_json FROM weekly_plans WHERE week_start=:week_start"), {"week_start": week_start}).fetchone()
    if row is None:
        return None
    return json.loads(row.plan_json)


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


def update_plan_by_id(conn, plan_id, plan):
    result = conn.execute(text(
        "UPDATE weekly_plans SET plan_json=:plan_json WHERE id=:plan_id"
    ), {"plan_json": json.dumps(plan), "plan_id": plan_id})
    conn.commit()
    return result.rowcount > 0


def delete_plan_by_id(conn, plan_id):
    result = conn.execute(text("DELETE FROM weekly_plans WHERE id=:plan_id"), {"plan_id": plan_id})
    conn.commit()
    return result.rowcount > 0


def restore_plan_by_id(conn, plan_id):
    row = conn.execute(text("SELECT plan_json FROM weekly_plans WHERE id=:plan_id"), {"plan_id": plan_id}).fetchone()
    if row is None:
        return False
    save_plan(conn, get_week_start(), json.loads(row.plan_json))
    return True


def delete_check_off(conn, check_off_id):
    result = conn.execute(text("DELETE FROM check_offs WHERE id=:id"), {"id": check_off_id})
    conn.commit()
    return result.rowcount > 0


def list_custom_items(conn):
    rows = conn.execute(text("SELECT id, item_type, data_json FROM custom_items")).fetchall()
    return [{"id": r.id, "item_type": r.item_type, "data": json.loads(r.data_json)} for r in rows]


def delete_custom_item(conn, item_id):
    result = conn.execute(text("DELETE FROM custom_items WHERE id=:id"), {"id": item_id})
    conn.commit()
    return result.rowcount > 0


def ask_claude(prompt):
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        system="You are a fitness and nutrition expert. Always respond with valid JSON when asked.",
    )
    return response.content[0].text


def chat_with_claude(messages, system_prompt):
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
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


def get_week_start():
    today = date.today()
    return (today - timedelta(days=today.weekday())).isoformat()


def get_db():
    return engine.connect()


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


def load_check_offs(conn, week_start):
    rows = conn.execute(text("SELECT * FROM check_offs WHERE week_start=:week_start"), {"week_start": week_start}).fetchall()
    return [dict(r._mapping) for r in rows]


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
    conn.execute(text("""
        INSERT INTO check_offs (week_start, day, item_type, item_name, done, nutrition_feedback)
        VALUES (:week_start, :day, 'meal_check', :item_name, 1, :feedback)
    """), {"week_start": week_start, "day": date.today().strftime("%a"), "item_name": food_desc[:100], "feedback": feedback})
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


def add_custom_item(conn, item_type, data):
    conn.execute(text("INSERT INTO custom_items (item_type, data_json) VALUES (:item_type, :data_json)"),
                 {"item_type": item_type, "data_json": json.dumps(data)})
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


def main():
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY not set. AI features will be unavailable.")
        print("  Set it with: export ANTHROPIC_API_KEY=your_key\n")

    with get_db() as conn:
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
                sys.exit(0)
            else:
                print("Invalid choice, enter 1-8.")


if __name__ == "__main__":
    main()
