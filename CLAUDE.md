# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RealityX — a citizen-reporting app. Citizens submit a photo + description + location of a
real-world problem (pothole, garbage, water leak, broken streetlight, etc.); an AI classifier
determines the problem type, severity, and responsible department. Similar nearby/recent reports
are auto-grouped into a single "Incident" so admins act on one clear picture instead of scattered
complaints. Built for a Smart City hackathon, split across five tracks: backend/API, frontend,
integration/testing, admin dashboard, presentation.

Two independent halves live in this repo:
- `src/` — React/TypeScript frontend (Vite)
- `backend/` — FastAPI backend (Python)

They talk over HTTP; there is also a Supabase Edge Function (`supabase/functions/urbaneye-api`)
that the frontend falls back to in production if `VITE_API_BASE_URL` isn't set.

## Commands

### Frontend (repo root)
```bash
npm install
cp .env.example .env      # point VITE_API_BASE_URL at the backend (default http://localhost:8000)
npm run dev                # start Vite dev server
npm run build               # tsc -b && vite build
npm run lint                 # oxlint
npm run preview               # preview production build
```
There is no test suite in this repo currently.

### Backend (`backend/`)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in SUPABASE_SERVICE_ROLE_KEY from the Supabase dashboard
uvicorn app.main:app --reload --port 8000
```
API docs (Swagger UI) at `http://localhost:8000/docs` once running.

The frontend has no mock/localStorage fallback — it depends on the backend being up. Run the
backend first, or the app's screens will stay empty (intentional: no fake demo data).

## Architecture

### Frontend (`src/`)
- `types.ts` — core domain types: `Report`, `Analysis`, `Severity`, `ProblemType`.
- `lib/api.ts` — the only place that talks to the backend (fetch + response mapping).
- `lib/storage.ts` — thin wrapper over `api.ts` (`listReports` / `getReport` / `addReport` /
  `setReportStatus`); pages should go through this, not `api.ts` directly.
- `lib/incidents.ts` — groups reports into incidents client-side using the `incidentId` the
  backend already assigned.
- `lib/geo.ts` — parses the `"lat, lng"` text used in the location field.
- `lib/supabaseClient.ts` / `lib/adminAuth.ts` / `lib/useAdminSession.ts` — Supabase Auth for
  admin email/password login only; citizens never authenticate.
- `pages/ReportPage.tsx` (`/`) — new report submission (photo + description + location); backend
  runs AI analysis and returns the result synchronously.
- `pages/FeedPage.tsx` (`/feed`) — list of all reports, public.
- `pages/ReportDetailPage.tsx` (`/reports/:id`) — one report + other reports in the same incident.
- `pages/DashboardPage.tsx` (`/dashboard`) and `pages/FindingsPage.tsx` (`/findings`) — admin-only
  (map/stats/activity, and kanban/table with status changes), gated by `components/RequireAdmin.tsx`.
- `pages/AdminLoginPage.tsx` (`/admin/login`) — Supabase Auth email/password login; redirects back
  to the originally requested admin page after success.
- `i18n/` — react-i18next setup; `LanguageSwitcher.tsx` toggles locale.

### Backend (`backend/app/`)
- `main.py` — FastAPI app entrypoint, mounts routers.
- `routers/` — `analyze.py`, `reports.py`, `incidents.py`, `stats.py` — one module per resource.
- `db.py` — Supabase client (uses the `service_role` key, so it bypasses RLS — the backend itself
  is the trusted boundary enforcing access rules in application code).
- `incidents.py` — groups reports into incidents by problem type + geographic proximity (80m) +
  recency (48h window).
- `auth.py` — `require_admin` dependency: verifies a `Authorization: Bearer <supabase-access-token>`
  against Supabase, then checks `profiles.role == "admin"`; used on admin-only endpoints.
- `ollama_ai.py` — real AI classifier via a locally-served Ollama vision+language model
  (`qwen2.5vl` or `llava`); talks to Ollama's `/api/generate` with `format: "json"`.
- `mock_ai.py` — keyword-heuristic fallback (same logic as the frontend's old `mockAnalyze.ts`),
  used when `AI_BACKEND=mock` or when Ollama/Groq is unreachable so a demo never breaks.
- `groq_ai.py` — alternative cloud inference backend (`AI_BACKEND=groq`, needs `GROQ_API_KEY`).
- `notifications.py` — writes notification rows when a report is `critical` or an incident
  crosses `NOTIFY_REPORT_COUNT_THRESHOLD` report count.
- `email_service.py` — routes email notifications per problem type to a responsible department
  (SMTP, configurable via `DEPARTMENT_EMAILS` / `TEST_RECIPIENT_EMAIL`).
- `schemas.py` — `Analysis` and other Pydantic response shapes; any new AI backend must return
  this same shape so nothing else in the stack needs to change.
- `excel_export.py` — exports report/incident data to Excel.

Swapping the AI backend for a hosted API (Claude, OpenAI, etc.): replace the `httpx.post(...)`
call in `ollama_ai.py`'s `analyze()`, keeping the `Analysis` return shape unchanged.

### Data model (Supabase/Postgres)
- `communities` — a compound/university/city.
- `profiles` — app users, linked to `auth.users`, scoped to a community, `role` column
  distinguishes admins.
- `reports` — one citizen report, always linked to an `incident`.
- `incidents` — reports grouped by problem type + geographic proximity + recency.
- `notifications` — rows written on critical reports / threshold-crossing incidents.

Row Level Security is enabled on every table (community-scoped reads/writes); it's a second line
of defense — the backend itself uses the service-role key and bypasses RLS, so access control is
actually enforced in `app/auth.py` / the router layer.

## Access model

- **Citizens**: zero authentication. `POST /reports` and all `GET` endpoints (`/reports`,
  `/incidents`, `/analyze`) are fully open. `/`, `/feed`, `/reports/:id` are public frontend routes.
- **Admins**: sign in with email/password via Supabase Auth; `profiles.role` must be `'admin'`.
  Admin-only endpoints — `PATCH /reports/{id}`, `PATCH /incidents/{id}`, `GET /stats` — require a
  valid admin bearer token and are rejected (401/403) otherwise, even if called directly.
  `/dashboard` and `/findings` are gated client-side by `RequireAdmin`.
- To create an admin: sign up a user in Supabase Auth, then set that user's `profiles.role` to
  `'admin'`.

## Key endpoints (backend)

| Method | Path | Purpose |
|---|---|---|
| POST | `/reports` | Submit a report (image + description + location) → AI analysis → group into incident → persist |
| GET | `/reports` | List reports (filter by `community_id`, `status`, `severity`) |
| GET | `/reports/{id}` | One report |
| GET | `/incidents` | List incidents |
| GET | `/incidents/{id}` | One incident |
| GET | `/incidents/{id}/reports` | All reports under one incident |
| PATCH | `/incidents/{id}` | Update incident status (admin only) |
| GET | `/stats` | Aggregate counts for dashboard (admin only) |
| POST | `/analyze` | Run the classifier directly |
| GET | `/health` | Liveness check |
