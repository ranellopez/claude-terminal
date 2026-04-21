# Meal Prep, Gym Plan & Rest Day Scheduler

## Setup

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your_key_here
python planner.py
```

## Smoke Test Checklist

- [ ] First run triggers profile wizard (8 questions)
- [ ] Profile saves and persists across restarts
- [ ] Plan generates without error (with and without API key)
- [ ] Week view displays all 7 days
- [ ] Check-off marks item done and persists
- [ ] Meal checker returns verdict and saves feedback
- [ ] Export produces valid `.md` and `.json` files
- [ ] Edit profile updates DB and offers to regenerate plan
- [ ] Add custom meal appears in next generated plan
