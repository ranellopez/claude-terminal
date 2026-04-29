import os
import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))
import planner

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# --- Static files (must be last) ---
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
