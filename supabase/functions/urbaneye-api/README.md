# urbaneye-api (Supabase Edge Function)

Deno port of `backend/app/*` (FastAPI), deployed as a Supabase Edge Function
because no external host was running the FastAPI service, which left the
production frontend unable to submit reports ("حدث خطأ أثناء إرسال البلاغ").

Mirrors the same routes, request/response shapes, mock-AI heuristic,
incident-grouping and notification logic as the FastAPI backend — see that
app's source for the canonical behavior; keep both in sync if either changes.

Deployed at:
`https://ccvdyifhquvcdixaqpat.supabase.co/functions/v1/urbaneye-api`

Redeploy after edits with the Supabase MCP `deploy_edge_function` tool (or
`supabase functions deploy urbaneye-api` via the CLI), `verify_jwt: false`.

Env vars (set as Supabase project secrets):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — provided automatically by the
  Supabase platform for edge functions.
- `DEFAULT_COMMUNITY_ID` — defaults to the hackathon-seed community if unset.
- `NOTIFY_REPORT_COUNT_THRESHOLD` — defaults to `3`.
