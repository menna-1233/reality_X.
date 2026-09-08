# RealityX — Backend

FastAPI backend that ties the frontend, the Supabase database, and the AI
classifier together. It exposes the API the citizen-facing app and the admin
dashboard both consume.

## Stack

- **FastAPI** — HTTP API
- **Supabase (Postgres)** — database, auth, storage (project already provisioned:
  `https://ccvdyifhquvcdixaqpat.supabase.co`)
- **AI classifier** (`app/ollama_ai.py`) — real, free, open-source
  vision+language model served locally via [Ollama](https://ollama.com)
  (e.g. `qwen2.5vl` or `llava`), with a keyword-heuristic fallback
  (`app/mock_ai.py`, same logic as the frontend's old `mockAnalyze.ts`) used
  whenever `AI_BACKEND=mock` or Ollama is unreachable

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
- `AI_BACKEND` — leave as `mock` to use the keyword heuristic (zero setup),
  or set to `ollama` to use a real open-source model (see below).

### Enabling the real AI (Ollama)

1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh` (or see
   https://ollama.com/download for macOS/Windows).
2. Start it: `ollama serve` (usually already running as a service).
3. Pull a multimodal model: `ollama pull qwen2.5vl` (or `ollama pull llava`).
4. In `.env`, set `AI_BACKEND=ollama` (and `OLLAMA_MODEL` if you picked a
   different model).

That's it — `/analyze` and `POST /reports` will now send the report's image
and description to the local model and parse its JSON response into the
same `Analysis` shape the rest of the app already expects. No API key, no
cost. If Ollama is down or returns something unparseable, the backend
automatically falls back to the mock heuristic so a demo never breaks.

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

## Access model: anonymous citizens, admin login

- **Citizens report with zero authentication.** `POST /reports` and all
  `GET` endpoints (feed, incidents) are open — no signup, no login. This is
  intentional: reporting a pothole shouldn't require an account.
- **Admins sign in** with email/password via Supabase Auth (on the
  frontend), and their `profiles.role` must be `admin`.
- **Admin-only endpoints** — changing a report's or incident's status
  (`PATCH /reports/{id}`, `PATCH /incidents/{id}`) and the aggregate
  `GET /stats` — require a valid admin session sent as
  `Authorization: Bearer <supabase-access-token>`. See `app/auth.py`
  (`require_admin` dependency): it verifies the token with Supabase, then
  checks `profiles.role == "admin"`, returning 401/403 otherwise.
- This is enforced in the API layer (since the backend uses the
  service-role key and bypasses RLS); the database's own RLS policies are a
  second line of defense for anything that talks to Supabase directly.

To create an admin: sign a user up (or invite them) in Supabase Auth, then
set their `profiles.role` to `'admin'`.

## Swapping to a different model

`app/ollama_ai.py` talks to Ollama's `/api/generate` endpoint with
`format: "json"`, which works with any model Ollama serves — change
`OLLAMA_MODEL` to try a different one (bigger/smaller, text-only, etc.).
To use a hosted API (Claude, OpenAI, etc.) instead of a local model, replace
the `httpx.post(...)` call in `analyze()` with that provider's client, and
keep the return shape (`Analysis` in `app/schemas.py`) unchanged so nothing
else in the backend, frontend, or dashboard needs to change.
