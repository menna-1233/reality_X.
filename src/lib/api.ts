import i18n from "../i18n/config";
import { parseLatLng } from "./geo";
import { getAdminAccessToken } from "./adminAuth";
import type { Analysis, Report, ReportEvent, ReportStatus } from "../types";

/**
 * Talks to the real UrbanEye backend (see /backend). This replaces the old
 * localStorage-backed `storage.ts` + client-side `mockAnalyze.ts` — the AI
 * classification and incident grouping now happen server-side.
 */

// Falls back to the deployed Supabase Edge Function (see supabase/functions/urbaneye-api)
// so the production build works even without VITE_API_BASE_URL set — override it for
// local development against `uvicorn app.main:app` (see backend/README.md).
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  "https://ccvdyifhquvcdixaqpat.supabase.co/functions/v1/urbaneye-api"
).replace(/\/$/, "");

// ---- wire shapes coming back from FastAPI (snake_case) ----

interface ApiAnalysisFields {
  problem_type: Analysis["problemType"];
  severity: Analysis["severity"];
  department: string | null;
  confidence: number | string | null;
  ai_summary: string | null;
}

interface ApiReport extends ApiAnalysisFields {
  id: string;
  community_id: string;
  incident_id: string | null;
  image_url: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_text: string | null;
  status: ReportStatus;
  created_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`UrbanEye API ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function formatLocation(latitude: number | null, longitude: number | null, locationText: string | null): string {
  if (latitude != null && longitude != null) {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
  return locationText ?? "";
}

/**
 * The backend doesn't keep a per-report event log (unlike the old localStorage
 * mock) — we synthesize the two events we can always infer from the row itself.
 * A real "status_changed" timestamp would need an events table server-side.
 */
function synthesizeEvents(report: ApiReport): ReportEvent[] {
  const events: ReportEvent[] = [
    { at: report.created_at, kind: "created" },
    { at: report.created_at, kind: "analyzed" },
  ];
  if (report.status !== "open") {
    events.push({ at: report.created_at, kind: "status_changed" });
  }
  return events;
}

function toFrontendReport(api: ApiReport): Report {
  return {
    id: api.id,
    imageDataUrl: api.image_url,
    description: api.description ?? "",
    location: formatLocation(api.latitude, api.longitude, api.location_text),
    createdAt: api.created_at,
    status: api.status,
    events: synthesizeEvents(api),
    incidentId: api.incident_id,
    analysis: {
      problemType: api.problem_type,
      severity: api.severity,
      department: api.department ?? "",
      confidence: Number(api.confidence ?? 0),
      summary: api.ai_summary ?? "",
    },
  };
}

export async function apiListReports(): Promise<Report[]> {
  const rows = await request<ApiReport[]>("/reports");
  return rows.map(toFrontendReport);
}

export async function apiGetReport(id: string): Promise<Report | undefined> {
  try {
    const row = await request<ApiReport>(`/reports/${id}`);
    return toFrontendReport(row);
  } catch {
    return undefined;
  }
}

export interface SubmitReportInput {
  imageFile: File;
  description: string;
  location: string;
}

export async function apiCreateReport({
  imageFile,
  description,
  location,
}: SubmitReportInput): Promise<Report> {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("description", description);
  // Tells the backend's AI analysis (department/summary text) which language
  // to respond in — see supabase/functions/urbaneye-api/index.ts.
  form.append("language", i18n.language === "en" ? "en" : "ar");

  const latLng = parseLatLng(location);
  if (latLng) {
    form.append("latitude", String(latLng[0]));
    form.append("longitude", String(latLng[1]));
  } else {
    form.append("location_text", location);
  }

  const row = await request<ApiReport>("/reports", { method: "POST", body: form });
  return toFrontendReport(row);
}

/**
 * Downloads all reports as an .xlsx spreadsheet and triggers a browser
 * save-as. Backed by GET /reports/export/excel (see backend/app/excel_export.py).
 */
export async function apiExportReportsExcel(): Promise<void> {
  const res = await fetch(`${API_BASE}/reports/export/excel`);
  if (!res.ok) {
    throw new Error(`Failed to export reports (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "urbaneye_reports.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Admin-only: changing a report's status requires a signed-in admin session. */
export async function apiSetReportStatus(id: string, status: ReportStatus): Promise<Report> {
  const token = await getAdminAccessToken();
  if (!token) throw new Error("Admin sign-in required to change a report's status.");

  const row = await request<ApiReport>(`/reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  return toFrontendReport(row);
}
