import sys
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import planner

PORT = 8080
STATIC_DIR = Path(__file__).parent / "static"


class PlannerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/api/questions":
            self._json(200, planner.QUESTIONS)

        elif path == "/api/profile":
            conn = planner.get_db()
            try:
                self._json(200, planner.load_profile(conn) or {})
            finally:
                conn.close()

        elif path == "/api/plans":
            conn = planner.get_db()
            try:
                self._json(200, planner.get_all_plans(conn))
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            conn = planner.get_db()
            try:
                data = planner.get_plan_by_id(conn, plan_id)
                if data is None:
                    self._json(404, {"error": "not found"})
                else:
                    self._json(200, data)
            finally:
                conn.close()

        else:
            self._serve_static(path)

    def do_POST(self):
        path = self.path.split("?")[0]
        body = self._read_body()
        if body is None:
            return

        if path == "/api/plans/generate":
            conn = planner.get_db()
            try:
                if body:
                    planner.save_profile(conn, body)
                profile = planner.load_profile(conn)
                if profile is None:
                    self._json(400, {"error": "Profile not configured"})
                    return
                plan = planner.generate_plan(profile, conn)
                self._json(200, {"ok": True, "plan": plan})
            except Exception as e:
                self._json(500, {"error": str(e)})
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+/restore", path):
            plan_id = int(path.split("/")[-2])
            conn = planner.get_db()
            try:
                ok = planner.restore_plan_by_id(conn, plan_id)
                self._json(200 if ok else 404, {"ok": ok})
            finally:
                conn.close()

        else:
            self._json(404, {"error": "not found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        body = self._read_body()
        if body is None:
            return

        if path == "/api/profile":
            conn = planner.get_db()
            try:
                planner.save_profile(conn, body)
                self._json(200, {"ok": True})
            except Exception as e:
                self._json(400, {"error": str(e)})
            finally:
                conn.close()

        elif re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            if "plan" not in body:
                self._json(400, {"error": "missing 'plan' key in request body"})
                return
            conn = planner.get_db()
            try:
                ok = planner.update_plan_by_id(conn, plan_id, body["plan"])
                self._json(200 if ok else 404, {"ok": ok})
            except Exception as e:
                self._json(400, {"error": str(e)})
            finally:
                conn.close()

        else:
            self._json(404, {"error": "not found"})

    def do_DELETE(self):
        path = self.path.split("?")[0]
        if re.fullmatch(r"/api/plans/\d+", path):
            plan_id = int(path.split("/")[-1])
            conn = planner.get_db()
            try:
                ok = planner.delete_plan_by_id(conn, plan_id)
                self._json(200 if ok else 404, {"ok": ok})
            finally:
                conn.close()
        else:
            self._json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            self._json(400, {"error": "invalid JSON"})
            return None

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        file_path = STATIC_DIR / path.lstrip("/")
        if not file_path.resolve().is_relative_to(STATIC_DIR.resolve()):
            self.send_response(403)
            self.end_headers()
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_response(404)
            self.end_headers()
            return
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css",
            ".js": "application/javascript",
        }
        ct = content_types.get(file_path.suffix, "application/octet-stream")
        try:
            body = file_path.read_bytes()
        except OSError:
            self.send_response(500)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # suppress request logging


def make_server(port=PORT):
    return ThreadingHTTPServer(("localhost", port), PlannerHandler)


if __name__ == "__main__":
    os.makedirs(STATIC_DIR, exist_ok=True)
    server = make_server()
    print(f"Planner running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
