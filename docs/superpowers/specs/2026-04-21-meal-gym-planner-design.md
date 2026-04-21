# Meal Prep, Gym Plan & Rest Day Scheduler — Design Spec

**Date:** 2026-04-21
**Status:** Approved

---

## Overview

A single-file Python CLI tool (`planner.py`) that helps the user schedule and track meal prep, gym workouts, and rest day activities. It combines a built-in content library, Claude AI-generated suggestions, and user-defined entries into a personalized weekly plan. Progress is tracked in a local SQLite database. A meal checker feature analyzes logged food against the user's fitness goal.

---

## Architecture

Single script: `planner.py`

All logic lives in one file with clearly named functions grouped by concern. No external framework. Dependencies: `anthropic` (Claude API), `sqlite3` (stdlib), `json`, `datetime`, `os`.

Entry point: `python planner.py` → main menu

### Function Groups

- **Profile** — first-run wizard, profile read/write
- **Plan generation** — build weekly schedule from library + Claude API
- **Interactive** — main menu, day view, check-off
- **Meal checker** — log food, call Claude, store feedback
- **Export** — write markdown and JSON plan files
- **DB** — schema init, all read/write helpers
- **Claude** — single `ask_claude(prompt)` wrapper for all API calls

---

## Data Model

SQLite database: `planner.db` (created in current directory on first run). "Current week" is always the Monday-to-Sunday week containing today's date.

### `profile` table (one row)

| Column | Type | Notes |
|---|---|---|
| `goal` | TEXT | `lose_weight`, `build_muscle`, `maintain`, `endurance` |
| `gym_days` | TEXT | Comma-separated, e.g. `"Mon,Wed,Fri"` |
| `rest_days` | TEXT | Comma-separated, e.g. `"Tue,Thu,Sun"` |
| `meal_prep_day` | TEXT | e.g. `"Sun"` |
| `fitness_level` | TEXT | `beginner`, `intermediate`, `advanced` |
| `equipment` | TEXT | e.g. `"dumbbells,barbell,pull-up bar"` |
| `dietary_preference` | TEXT | `none`, `vegetarian`, `vegan`, `gluten-free` |
| `allergies` | TEXT | Free text |
| `daily_calorie_target` | INTEGER | User-set or Claude-estimated during setup |
| `protein_target_g` | INTEGER | User-set or Claude-estimated during setup |

### `weekly_plans` table

| Column | Type | Notes |
|---|---|---|
| `week_start` | TEXT | ISO date, e.g. `"2026-04-20"` |
| `plan_json` | TEXT | Full 7-day plan as JSON blob |
| `created_at` | TEXT | ISO datetime |

### `check_offs` table

| Column | Type | Notes |
|---|---|---|
| `week_start` | TEXT | ISO date |
| `day` | TEXT | e.g. `"Mon"` |
| `item_type` | TEXT | `meal`, `exercise`, `rest_activity` |
| `item_name` | TEXT | Name of the item |
| `done` | INTEGER | 0 or 1 |
| `nutrition_feedback` | TEXT | Claude's meal checker verdict (nullable) |

---

## User Flows

### First Run

1. Detect missing profile → trigger profile wizard
2. Wizard asks 8 questions one at a time (goal, gym days, rest days, meal prep day, fitness level, equipment, dietary preference, allergies)
3. Claude estimates calorie and protein targets based on goal and fitness level
4. Save profile to DB
5. Generate first weekly plan
6. Show main menu

### Main Menu

```
1. View this week's plan
2. Check off items (meals / exercises / rest activities)
3. Generate new plan for this week
4. Add custom meal or exercise
5. Meal checker — log what you ate
6. Export plan (markdown / JSON)
7. Edit profile
8. Quit
```

### Plan Generation

1. Load profile from DB
2. Pull matching items from built-in library (filtered by goal, equipment, dietary preference)
3. Call Claude to fill gaps, add variety, and generate a 7-day structured schedule
4. Assemble schedule: gym days → workout + meals, meal prep day → prep task list, rest days → recovery activities
5. Save to `weekly_plans` table
6. Display week view

### Week View

Tabular display of all 7 days:
- **Gym day:** workout name + exercise list + meals for the day
- **Meal prep day:** list of meals to prep + estimated prep time
- **Rest day:** suggested recovery activity (walk, stretch, foam roll, etc.)

### Meal Checker

1. User selects option 5 from main menu
2. Prompted: "What did you eat? (describe or list items)"
3. Free-text input sent to Claude with user's goal, calorie target, and protein target as context
4. Claude returns: verdict (on track / off track / partial), estimated calories/protein, what was good, what was off, one actionable suggestion
5. Result displayed in terminal
6. Stored in `check_offs` with `nutrition_feedback` populated

### Export

- Writes `plan_YYYY-MM-DD.md` — human-readable markdown with full week laid out
- Writes `plan_YYYY-MM-DD.json` — structured JSON for external use
- Both saved to current directory

---

## Built-in Content Library

Hardcoded in `planner.py` as Python dicts/lists, filtered at plan generation time.

**Meals** — tagged with: `goal[]`, `dietary[]`, `meal_type` (breakfast/lunch/dinner/snack)
- Example: `{"name": "Grilled chicken + rice", "goal": ["build_muscle"], "dietary": ["none"], "protein_g": 45, "calories": 520}`

**Exercises** — tagged with: `goal[]`, `equipment[]`, `muscle_group`
- Example: `{"name": "Barbell squat", "goal": ["build_muscle", "endurance"], "equipment": ["barbell"], "sets": 4, "reps": "6-8"}`

**Rest activities** — simple list (walk, yoga, foam rolling, stretching, meditation)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing `ANTHROPIC_API_KEY` | Print setup instructions and exit |
| Claude API failure | Fall back to built-in library only; notify user |
| No profile found | Auto-trigger profile wizard |
| No plan for current week | Prompt to generate one |
| Unknown food in meal checker | Claude flags low-confidence estimate |
| SQLite error | Print error + path to `planner.db` for manual recovery |

---

## Testing

No automated test suite. Manual smoke test checklist in `README.md`:

- [ ] First run triggers profile wizard
- [ ] Profile saves correctly to DB
- [ ] Plan generates without error (with and without API key)
- [ ] Week view displays all 7 days correctly
- [ ] Check-off marks item as done and persists
- [ ] Meal checker returns verdict and stores feedback
- [ ] Export produces valid `.md` and `.json` files
- [ ] Edit profile updates DB and offers to regenerate plan

---

## Files

```
planner.py        # entire application
planner.db        # created on first run (gitignored)
plan_*.md         # exported plans (gitignored)
plan_*.json       # exported plans (gitignored)
README.md         # setup instructions + smoke test checklist
.gitignore        # excludes planner.db, plan_*.md, plan_*.json
```

---

## Out of Scope

- Barcode scanning or nutrition API integration
- Mobile or web interface
- Multi-user support
- Calorie/macro tracking over time (only current-week check-offs stored)
