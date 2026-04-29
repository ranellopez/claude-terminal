import sys
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

sys.path.insert(0, ".")
import planner
from server import app

SAMPLE_PROFILE = {
    "goal": "build_muscle",
    "gym_days": "Mon,Tue,Wed,Thu,Fri,Sun",
    "rest_days": "Sat",
    "meal_prep_day": "Sun",
    "fitness_level": "intermediate",
    "equipment": "dumbbells,barbell,bodyweight",
    "dietary_preference": "none",
    "allergies": "peanuts",
    "daily_calorie_target": 2800,
    "protein_target_g": 180,
}


class TestPlannerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_fd, cls.db_path = tempfile.mkstemp(suffix=".db")
        planner.DB_PATH = cls.db_path
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        planner.DB_PATH = "planner.db"
        os.close(cls.db_fd)
        os.unlink(cls.db_path)

    def _req(self, method, path, body=None, params=None):
        fn = getattr(self.client, method.lower())
        kwargs = {}
        if body is not None:
            kwargs["json"] = body
        if params is not None:
            kwargs["params"] = params
        resp = fn(path, **kwargs)
        return resp.status_code, resp.json()

    def test_01_get_questions_returns_8(self):
        status, data = self._req("GET", "/api/questions")
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 8)
        self.assertIn("key", data[0])
        self.assertIn("why", data[0])

    def test_02_get_profile_empty(self):
        status, data = self._req("GET", "/api/profile")
        self.assertEqual(status, 200)
        self.assertEqual(data, {})

    def test_03_save_profile(self):
        status, _ = self._req("PUT", "/api/profile", SAMPLE_PROFILE)
        self.assertEqual(status, 200)

    def test_04_load_profile(self):
        status, data = self._req("GET", "/api/profile")
        self.assertEqual(status, 200)
        self.assertEqual(data["goal"], "build_muscle")
        self.assertEqual(data["protein_target_g"], 180)

    def test_05_list_plans_empty(self):
        status, data = self._req("GET", "/api/plans")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_06_generate_plan(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
             patch("planner.enhance_plan_with_ai", side_effect=lambda p, plan: plan):
            status, data = self._req("POST", "/api/plans/generate")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertIn("Mon", data["plan"])

    def test_07_list_plans_after_generate(self):
        status, data = self._req("GET", "/api/plans")
        self.assertEqual(status, 200)
        self.assertGreater(len(data), 0)
        self.assertIn("week_start", data[0])
        self.assertIn("gym_days", data[0])
        self.assertIn("goal", data[0])

    def test_08_get_plan_by_id(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        status, data = self._req("GET", f"/api/plans/{plan_id}")
        self.assertEqual(status, 200)
        self.assertIn("plan", data)
        self.assertIn("Mon", data["plan"])

    def test_09_get_plan_missing(self):
        status, data = self._req("GET", "/api/plans/99999")
        self.assertEqual(status, 404)

    def test_10_update_plan(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        _, plan_data = self._req("GET", f"/api/plans/{plan_id}")
        plan = plan_data["plan"]
        for day, entry in plan.items():
            if entry["type"] == "gym":
                plan[day]["exercises"][0]["name"] = "Test Exercise"
                break
        status, _ = self._req("PUT", f"/api/plans/{plan_id}", {"plan": plan})
        self.assertEqual(status, 200)
        _, updated = self._req("GET", f"/api/plans/{plan_id}")
        gym_days = [d for d, e in updated["plan"].items() if e["type"] == "gym"]
        self.assertEqual(updated["plan"][gym_days[0]]["exercises"][0]["name"], "Test Exercise")

    def test_11_restore_plan(self):
        _, plans = self._req("GET", "/api/plans")
        plan_id = plans[0]["id"]
        status, data = self._req("POST", f"/api/plans/{plan_id}/restore")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        _, updated_plans = self._req("GET", "/api/plans")
        current = [p for p in updated_plans if p["is_current"]]
        self.assertTrue(len(current) > 0)

    def test_12_delete_plan(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"}), \
             patch("planner.enhance_plan_with_ai", side_effect=lambda p, plan: plan):
            self._req("POST", "/api/plans/generate")
        _, plans_before = self._req("GET", "/api/plans")
        plan_id = plans_before[-1]["id"]
        status, _ = self._req("DELETE", f"/api/plans/{plan_id}")
        self.assertEqual(status, 200)
        _, plans_after = self._req("GET", "/api/plans")
        self.assertNotIn(plan_id, [p["id"] for p in plans_after])


if __name__ == "__main__":
    unittest.main()
