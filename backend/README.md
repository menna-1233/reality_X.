# UrbanEye AI — Backend

FastAPI backend that ties the frontend, the Supabase database, and the AI
classifier together. It exposes the API the citizen-facing app and the admin
dashboard both consume.

## Stack

- **FastAPI** — HTTP API
- **Supabase (Postgres)** — database, auth, storage (project already provisioned:
  `https://ccvdyifhquvcdixaqpat.supabase.co`)
- **Mock AI** (`app/mock_ai.py`) — keyword-heuristic classifier, same logic as
  the frontend's `mockAnalyze.ts`, until the real Claude Vision integration
  replaces it (see comment in that file for the swap-in code)

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then fill in `.env`:
- `SUPABASE_SERVICE_ROLE_KEY` — grab it from the Supabase dashboard
  → this project → Project Settings → API → `service_role` secret key.
  **Never commit this or expose it to the frontend.**

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

Docs at `http://localhost:8000/docs` (Swagger UI, auto-generated).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/reports` | Submit a report (image + description + location) → runs AI analysis → groups into an incident → persists |
| GET | `/reports` | List reports (filter by `community_id`, `status`, `severity`) |
| GET | `/reports/{id}` | One report |
| GET | `/incidents` | List incidents (grouped reports) |
| GET | `/incidents/{id}` | One incident |
| GET | `/incidents/{id}/reports` | All reports under one incident |
| PATCH | `/incidents/{id}` | Update incident status (admin/dashboard use) |
| GET | `/stats` | Aggregate counts for the dashboard |
| POST | `/analyze` | Run the classifier directly (used internally by `/reports`, also handy for testing) |
| GET | `/health` | Liveness check |

## Data model

- `communities` — a compound/university/city
- `profiles` — app users, linked to `auth.users`, scoped to a community
- `reports` — one citizen report, always linked to an `incident`
- `incidents` — reports grouped by problem type + geographic proximity (80m)
  + recency (48h window) — see `app/incidents.py`
- `notifications` — rows written when a report is `critical` or an incident
  crosses a report-count threshold — see `app/notifications.py`

Row Level Security is enabled on every table (community-scoped reads/writes);
the backend itself uses the `service_role` key and therefore bypasses RLS —
it is the trusted boundary that enforces access rules in application code.

## Swapping in the real AI

Replace the body of `analyze()` in `app/mock_ai.py` (or the `/analyze` route
directly) with a call to Claude Vision using the uploaded image bytes. Keep
the return shape (`Analysis` in `app/schemas.py`) unchanged so nothing else
in the backend, frontend, or dashboard needs to change.
