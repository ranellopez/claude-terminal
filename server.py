import os
import sys
import json as _json
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))
import planner

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Planner API")

_frontend_url = os.getenv("FRONTEND_URL")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_url] if _frontend_url else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic models ---

class ProfileIn(BaseModel):
    goal: str
    gym_days: str
    rest_days: str
    meal_prep_day: str
    fitness_level: str
    equipment: str
    dietary_preference: str
    allergies: str
    daily_calorie_target: int
    protein_target_g: int


class PlanUpdateIn(BaseModel):
    plan: dict


class CheckOffIn(BaseModel):
    week_start: str
    day: str
    item_type: str
    item_name: str


class CustomItemIn(BaseModel):
    item_type: str
    data: dict


class MealCheckIn(BaseModel):
    food_desc: str


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    messages: List[ChatMessageIn]
    profile: dict = {}


GYMBOT_SYSTEM_PROMPT = """You are GymBot, a friendly and direct AI fitness coach. Your job is to have a natural conversation to gather the user's preferences, then offer to generate their weekly fitness and meal plan.

Current user profile:
{profile_summary}

Rules:
- Reference the user's existing profile naturally — acknowledge what you already know
- Ask follow-up questions ONE AT A TIME — never ask multiple questions in a single message
- Gather all of the following if not already known: fitness goal, gym days (which specific days), meal prep day, fitness level (beginner/intermediate/advanced), available equipment, dietary preference, food allergies, daily calorie target, daily protein target
- Keep responses concise and encouraging
- When you have gathered enough information for a complete 7-day plan, set ready to true

CRITICAL: Always respond with ONLY valid JSON — no preamble, no markdown:
{{"message": "your conversational response here", "ready": false}}

When ready to generate:
{{"message": "Perfect — I've got everything I need! [brief summary]. Ready to generate your plan? 🚀", "ready": true}}"""

GYMBOT_EXTRACT_PROMPT = """Extract a complete fitness profile from the conversation. Fill any missing fields using the base profile provided. Return ONLY valid JSON with no other text.

Base profile:
{base_profile}

Required output format (all fields mandatory):
{{
  "goal": "lose_weight|build_muscle|maintain|endurance",
  "gym_days": "Mon,Wed,Fri",
  "rest_days": "Tue,Thu,Sat,Sun",
  "meal_prep_day": "Sun",
  "fitness_level": "beginner|intermediate|advanced",
  "equipment": "dumbbells,barbell",
  "dietary_preference": "none|vegetarian|vegan|gluten-free",
  "allergies": "none",
  "daily_calorie_target": 2800,
  "protein_target_g": 180
}}"""


# --- DB dependency ---

def get_db():
    conn = planner.get_db()
    try:
        yield conn
    finally:
        conn.close()


# --- Profile ---

@app.get("/api/questions")
def get_questions():
    return planner.QUESTIONS


@app.get("/api/profile")
def get_profile(conn=Depends(get_db)):
    return planner.load_profile(conn) or {}


@app.put("/api/profile")
def put_profile(body: ProfileIn, conn=Depends(get_db)):
    planner.save_profile(conn, body.model_dump())
    return {"ok": True}


# --- Plans ---

@app.post("/api/plans/generate")
def generate_plan(body: Optional[ProfileIn] = None, conn=Depends(get_db)):
    if body:
        planner.save_profile(conn, body.model_dump())
    profile = planner.load_profile(conn)
    if profile is None:
        raise HTTPException(status_code=400, detail="Profile not configured")
    plan = planner.generate_plan(profile, conn)
    return {"ok": True, "plan": plan}


@app.get("/api/plans")
def list_plans(conn=Depends(get_db)):
    return planner.get_all_plans(conn)


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: int, conn=Depends(get_db)):
    data = planner.get_plan_by_id(conn, plan_id)
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return data


@app.put("/api/plans/{plan_id}")
def update_plan(plan_id: int, body: PlanUpdateIn, conn=Depends(get_db)):
    ok = planner.update_plan_by_id(conn, plan_id, body.plan)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.post("/api/plans/{plan_id}/restore")
def restore_plan(plan_id: int, conn=Depends(get_db)):
    ok = planner.restore_plan_by_id(conn, plan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.delete("/api/plans/{plan_id}")
def delete_plan(plan_id: int, conn=Depends(get_db)):
    ok = planner.delete_plan_by_id(conn, plan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


# --- Check-offs ---

@app.get("/api/check-offs")
def get_check_offs(week_start: str, conn=Depends(get_db)):
    return planner.load_check_offs(conn, week_start)


@app.post("/api/check-offs")
def post_check_off(body: CheckOffIn, conn=Depends(get_db)):
    planner.mark_done(conn, body.week_start, body.day, body.item_type, body.item_name)
    return {"ok": True}


@app.delete("/api/check-offs/{check_off_id}")
def delete_check_off(check_off_id: int, conn=Depends(get_db)):
    ok = planner.delete_check_off(conn, check_off_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


# --- Custom items ---

@app.get("/api/custom-items")
def get_custom_items(conn=Depends(get_db)):
    return planner.list_custom_items(conn)


@app.post("/api/custom-items")
def post_custom_item(body: CustomItemIn, conn=Depends(get_db)):
    planner.add_custom_item(conn, body.item_type, body.data)
    return {"ok": True}


@app.delete("/api/custom-items/{item_id}")
def delete_custom_item(item_id: int, conn=Depends(get_db)):
    ok = planner.delete_custom_item(conn, item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


# --- Meal checker ---

@app.post("/api/meal-check")
def post_meal_check(body: MealCheckIn, conn=Depends(get_db)):
    profile = planner.load_profile(conn)
    if profile is None:
        raise HTTPException(status_code=400, detail="Profile not configured")
    feedback = planner.check_meal(profile, body.food_desc, conn)
    return {"feedback": feedback}


# --- GymBot chat ---

@app.post("/api/chat")
def post_chat(body: ChatIn):
    profile_summary = ", ".join(
        f"{k}: {v}" for k, v in body.profile.items() if v and k != "id"
    ) or "No profile set yet"
    system = GYMBOT_SYSTEM_PROMPT.format(profile_summary=profile_summary)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    if not messages:
        messages = [{"role": "user", "content": "Hello"}]
        system += "\n\nThe user just opened GymBot. Greet them warmly, introduce yourself, and reference their existing profile if they have one. Ask your first question."

    try:
        raw = planner.chat_with_claude(messages, system)
        try:
            parsed = _json.loads(raw)
            return {"message": parsed.get("message", raw), "ready": bool(parsed.get("ready", False))}
        except (_json.JSONDecodeError, ValueError):
            return {"message": raw, "ready": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/generate")
def post_chat_generate(body: ChatIn, conn=Depends(get_db)):
    base_profile = _json.dumps(body.profile, indent=2)
    system = GYMBOT_EXTRACT_PROMPT.format(base_profile=base_profile)
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    messages.append({"role": "user", "content": "Extract the complete profile from our conversation above."})

    _required = {"goal", "gym_days", "rest_days", "meal_prep_day", "fitness_level",
                 "equipment", "dietary_preference", "allergies", "daily_calorie_target", "protein_target_g"}
    try:
        raw = planner.chat_with_claude(messages, system)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        parsed = _json.loads(raw[start:end])
        if not parsed.keys() >= _required:
            raise ValueError("incomplete extraction")
        profile = parsed
    except Exception:
        profile = body.profile

    if not profile:
        raise HTTPException(status_code=400, detail="Could not extract profile from conversation")

    plan = planner.generate_plan(profile, conn)
    return {"ok": True, "plan": plan}


# --- Static files (must be last) ---
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
