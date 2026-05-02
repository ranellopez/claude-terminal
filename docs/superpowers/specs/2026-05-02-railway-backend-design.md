# Railway Backend Deployment Design

**Date:** 2026-05-02  
**Status:** Approved

## Overview

Deploy the existing FastAPI backend to Railway, migrating from SQLite to Railway-managed Postgres. The frontend is deployed separately and is out of scope for this design.

## Architecture

Two services in one Railway project:

- **Postgres service** — Railway-managed. Railway automatically provisions a `DATABASE_URL` env var.
- **FastAPI service** — Python app deployed from `github.com/ranellopez/claude-terminal`, connected to the `main` branch. Railway auto-deploys on every push.

Railway connects directly to the GitHub repo — no manual deploys.

## Database Layer (SQLAlchemy Core)

Replace `sqlite3` in `planner.py` with SQLAlchemy Core:

- A single `engine` created from `DATABASE_URL` env var, falling back to the local SQLite path for development.
- All existing functions (`load_profile`, `save_profile`, `generate_plan`, etc.) keep the same signatures — only their internals change.
- `server.py`'s `get_db()` dependency yields a SQLAlchemy connection instead of a sqlite3 connection. Everything above it stays the same.
- **Alembic** manages the schema. Existing `CREATE TABLE IF NOT EXISTS` statements are replaced by Alembic migration files. `alembic upgrade head` runs automatically as a pre-start command on each deploy.

### Data Migration

A one-time script (`scripts/migrate_sqlite_to_postgres.py`) reads all rows from the local `planner.db` and inserts them into Railway Postgres. Run once from local machine after first deploy, pointing at the Railway `DATABASE_URL`.

## Environment Variables

| Variable | Source |
|---|---|
| `DATABASE_URL` | Set automatically by Railway Postgres plugin |
| `ANTHROPIC_API_KEY` | Set manually in Railway dashboard |
| `FRONTEND_URL` | Set manually in Railway dashboard (used for CORS) |

Locally, a `.env` file (git-ignored) holds all three. `python-dotenv` loads it automatically so no manual `export` is needed.

## Deployment Config

- `railway.toml` in the repo root defines:
  - **Build:** standard Python build
  - **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
  - **Pre-start:** `alembic upgrade head`

## CORS

`server.py` currently allows `*`. In production, restrict to the value of `FRONTEND_URL` env var. Falls back to `*` if `FRONTEND_URL` is not set (safe for local dev).

## Dependencies Added

- `sqlalchemy`
- `alembic`
- `psycopg2-binary`
- `python-dotenv`

## Files Changed

| File | Change |
|---|---|
| `planner.py` | Replace sqlite3 with SQLAlchemy Core engine + connections |
| `server.py` | Update `get_db()` dependency; tighten CORS to `FRONTEND_URL` |
| `requirements.txt` | Add new dependencies |
| `railway.toml` | New file — Railway service config |
| `alembic.ini` + `alembic/` | New — schema migration setup |
| `scripts/migrate_sqlite_to_postgres.py` | New — one-time data migration |
| `.env.example` | New — documents required env vars |
| `.gitignore` | Ensure `.env` is ignored |
