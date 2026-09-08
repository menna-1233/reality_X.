// UrbanEye AI API — Supabase Edge Function
//
// Port of backend/app/* (FastAPI) to a single Deno edge function, since no
// external host was running the FastAPI service. Mirrors the same routes,
// mock-AI heuristic, incident grouping and notification logic.

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_COMMUNITY_ID =
  Deno.env.get("DEFAULT_COMMUNITY_ID") ?? "e0d54643-b957-4057-a814-e909bdb5cf88";
const NOTIFY_REPORT_COUNT_THRESHOLD = Number(
  Deno.env.get("NOTIFY_REPORT_COUNT_THRESHOLD") ?? "3",
);

const BUCKET = "report-images";
const FN_PREFIX = "/urbaneye-api"; // matches the function's URL path

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------------- mock AI (port of app/mock_ai.py) ----------------

type ProblemType = "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other";
type Severity = "low" | "medium" | "high" | "critical";

const KEYWORD_MAP: [string[], ProblemType][] = [
  [["زبال", "قمام", "garbage", "trash"], "garbage"],
  [["مياه", "تسريب", "مايه", "water", "leak"], "water_leak"],
  [["عمود", "نور", "كهرب", "light", "lamp"], "broken_light"],
  [["حفر", "طريق", "pothole", "hole"], "pothole"],
  [["حريق", "نار", "fire", "burn"], "accident"],
  [["حادث", "اصطدام", "accident", "crash"], "accident"],
];

const BASE_SEVERITY: Record<ProblemType, Severity> = {
  pothole: "medium",
  garbage: "low",
  water_leak: "medium",
  broken_light: "low",
  accident: "critical",
  other: "medium",
};

const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];
const ESCALATION_KEYWORDS = ["خطر", "عاجل", "شديد", "urgent", "danger", "severe"];

type Language = "ar" | "en";

const DEPARTMENTS: Record<Language, Record<ProblemType, string>> = {
  ar: {
    pothole: "إدارة الصيانة والطرق",
    garbage: "إدارة النظافة",
    water_leak: "إدارة الصيانة والمرافق",
    broken_light: "إدارة الكهرباء",
    accident: "الأمن وإدارة الطوارئ",
    other: "الإدارة العامة",
  },
  en: {
    pothole: "Roads & Maintenance Department",
    garbage: "Sanitation Department",
    water_leak: "Maintenance & Utilities Department",
    broken_light: "Electrical Department",
    accident: "Security & Emergency Response",
    other: "General Administration",
  },
};

const SUMMARIES: Record<Language, Record<ProblemType, string>> = {
  ar: {
    pothole: "تم رصد حفرة قد تشكل خطورة على السيارات والمشاة.",
    garbage: "تم رصد تراكم للقمامة يحتاج إلى إزالة سريعة.",
    water_leak: "تم رصد تسريب مياه قد يؤثر على البنية التحتية المحيطة.",
    broken_light: "تم رصد عمود إنارة معطل يؤثر على الرؤية والأمان الليلي.",
    accident: "تم رصد حادث يتطلب تدخلاً فورياً من فريق الطوارئ.",
    other: "تم رصد مشكلة تحتاج إلى مراجعة الإدارة المختصة.",
  },
  en: {
    pothole: "A pothole was detected that may pose a risk to vehicles and pedestrians.",
    garbage: "Garbage buildup was detected that needs prompt removal.",
    water_leak: "A water leak was detected that may affect the surrounding infrastructure.",
    broken_light: "A broken streetlight was detected, affecting visibility and nighttime safety.",
    accident: "An accident was detected that requires immediate response from the emergency team.",
    other: "An issue was detected that needs review by the relevant department.",
  },
};

const URGENCY_SUFFIX: Record<Language, Record<"critical" | "high", string>> = {
  ar: {
    critical: " الحالة تصنّف كحرجة وتحتاج استجابة عاجلة.",
    high: " الحالة ذات أولوية عالية.",
  },
  en: {
    critical: " This is classified as critical and needs an urgent response.",
    high: " This is high priority.",
  },
};

function escalate(severity: Severity, steps = 1): Severity {
  const idx = Math.min(SEVERITY_ORDER.indexOf(severity) + steps, SEVERITY_ORDER.length - 1);
  return SEVERITY_ORDER[idx];
}

function detectProblemType(description: string): ProblemType {
  const text = (description || "").toLowerCase();
  for (const [keywords, type] of KEYWORD_MAP) {
    if (keywords.some((k) => text.includes(k))) return type;
  }
  return "other";
}

function detectSeverity(problemType: ProblemType, description: string, hasDescription: boolean): Severity {
  const text = (description || "").toLowerCase();
  let severity = BASE_SEVERITY[problemType];
  if (ESCALATION_KEYWORDS.some((k) => text.includes(k))) severity = escalate(severity);
  // No description AND no keyword match ("other") means we have nothing at
  // all to go on — the photo could be a fire, same as it could be litter.
  // Defaulting that unknown case to "medium" quietly buries it in the
  // normal queue, so treat "no signal" as "needs urgent human review"
  // instead of guessing it's harmless.
  if (!hasDescription && problemType === "other") severity = escalate(severity, 2);
  return severity;
}

interface Analysis {
  problem_type: ProblemType;
  severity: Severity;
  department: string;
  confidence: number;
  summary: string;
}

function runMockAi(description: string, language: Language = "ar"): Analysis {
  const problemType = detectProblemType(description);
  const hasDescription = Boolean((description || "").trim());
  const severity = detectSeverity(problemType, description, hasDescription);
  let urgency = "";
  if (severity === "critical") urgency = URGENCY_SUFFIX[language].critical;
  else if (severity === "high") urgency = URGENCY_SUFFIX[language].high;

  const confidence = Math.round(
    (hasDescription ? 0.82 + Math.random() * 0.15 : 0.55 + Math.random() * 0.17) * 100,
  ) / 100;

  return {
    problem_type: problemType,
    severity,
    department: DEPARTMENTS[language][problemType],
    confidence,
    summary: SUMMARIES[language][problemType] + urgency,
  };
}

function parseLanguage(value: FormDataEntryValue | null): Language {
  return value === "en" ? "en" : "ar";
}

// ---------------- incident grouping (port of app/incidents.py) ----------------

const RADIUS_METERS = 80;
const TIME_WINDOW_HOURS = 48;
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

async function findOrCreateIncident(opts: {
  communityId: string;
  problemType: ProblemType;
  severity: Severity;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
}): Promise<string> {
  const { communityId, problemType, severity, department, latitude, longitude } = opts;

  const { data: candidates, error } = await client
    .from("incidents")
    .select("id, severity, latitude, longitude, report_count, last_reported_at")
    .eq("community_id", communityId)
    .eq("problem_type", problemType)
    .neq("status", "resolved");
  if (error) throw error;

  const now = new Date();
  const cutoff = new Date(now.getTime() - TIME_WINDOW_HOURS * 3600 * 1000);

  for (const incident of candidates ?? []) {
    const lastReported = new Date(incident.last_reported_at);
    if (lastReported < cutoff) continue;

    let match: boolean;
    if (latitude == null || longitude == null) {
      match = incident.latitude == null;
    } else if (incident.latitude == null || incident.longitude == null) {
      match = false;
    } else {
      const distance = haversineMeters(latitude, longitude, incident.latitude, incident.longitude);
      match = distance <= RADIUS_METERS;
    }
    if (!match) continue;

    let newSeverity = incident.severity as Severity;
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[newSeverity]) newSeverity = severity;

    const { error: updateError } = await client
      .from("incidents")
      .update({
        report_count: incident.report_count + 1,
        last_reported_at: now.toISOString(),
        severity: newSeverity,
      })
      .eq("id", incident.id);
    if (updateError) throw updateError;
    return incident.id;
  }

  const { data: created, error: insertError } = await client
    .from("incidents")
    .insert({
      community_id: communityId,
      problem_type: problemType,
      severity,
      department,
      latitude,
      longitude,
      report_count: 1,
      first_reported_at: now.toISOString(),
      last_reported_at: now.toISOString(),
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return created.id;
}

// ---------------- notifications (port of app/notifications.py) ----------------

async function maybeNotify(opts: {
  communityId: string;
  incidentId: string;
  problemType: ProblemType;
  severity: Severity;
  reportCount: number;
}): Promise<void> {
  const { communityId, incidentId, problemType, severity, reportCount } = opts;
  const shouldNotify =
    severity === "critical" || reportCount === NOTIFY_REPORT_COUNT_THRESHOLD;
  if (!shouldNotify) return;

  const message =
    severity === "critical"
      ? `⚠️ بلاغ حرج: تم رصد مشكلة (${problemType}) تحتاج تدخلاً فورياً.`
      : `تنبيه: ${reportCount} بلاغات مستقلة عن نفس المشكلة (${problemType}) في محيطك — الإدارة تمت إفادتها.`;

  await client.from("notifications").insert({
    community_id: communityId,
    incident_id: incidentId,
    message,
    severity,
  });
}

// ---------------- department email (port of app/email_service.py) ----------------
//
// Emails the department responsible for a report's problem_type the moment
// the report is created, via Gmail SMTP. Never throws — a broken/unconfigured
// mailer must never break report creation. Configure via Supabase Edge
// Function secrets (`supabase secrets set ...`), not via backend/.env or
// Replit Secrets — this function has its own separate secret store. See
// supabase/functions/urbaneye-api/README.md.

const SMTP_ENABLED = (Deno.env.get("SMTP_ENABLED") ?? "false") === "true";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USE_SSL = (Deno.env.get("SMTP_USE_SSL") ?? "true") === "true";
const SMTP_EMAIL = Deno.env.get("SMTP_EMAIL") ?? "";
const SMTP_APP_PASSWORD = Deno.env.get("SMTP_APP_PASSWORD") ?? "";
const TEST_RECIPIENT_EMAIL = Deno.env.get("TEST_RECIPIENT_EMAIL") ?? "";

const DEFAULT_DEPARTMENT_EMAILS: Record<ProblemType, string> = {
  pothole: "maintenance-test@example.com",
  garbage: "cleaning-test@example.com",
  water_leak: "maintenance-test@example.com",
  broken_light: "electricity-test@example.com",
  accident: "security-test@example.com",
  other: "general-test@example.com",
};

function departmentEmails(): Record<string, string> {
  const raw = Deno.env.get("DEPARTMENT_EMAILS");
  if (!raw) return DEFAULT_DEPARTMENT_EMAILS;
  try {
    return { ...DEFAULT_DEPARTMENT_EMAILS, ...JSON.parse(raw) };
  } catch {
    console.warn("DEPARTMENT_EMAILS is not valid JSON, using defaults");
    return DEFAULT_DEPARTMENT_EMAILS;
  }
}

// A configured test recipient overrides real department routing, so every
// notification lands in one inbox you can actually check.
function recipientFor(problemType: string): string {
  if (TEST_RECIPIENT_EMAIL) return TEST_RECIPIENT_EMAIL;
  return departmentEmails()[problemType] ?? DEFAULT_DEPARTMENT_EMAILS.other;
}

const EMAIL_SEVERITY_AR: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

// deno-lint-ignore no-explicit-any
function buildEmailBody(report: any): string {
  const severityAr = EMAIL_SEVERITY_AR[report.severity ?? ""] ?? report.severity ?? "";
  return `بلاغ جديد يحتاج مراجعة من إدارتكم

الإدارة المسؤولة: ${report.department ?? "غير محدد"}
درجة الخطورة: ${severityAr}
الوصف المرسل من المواطن: ${report.description ?? "بدون وصف"}
الموقع: ${report.location_text ?? "غير محدد"}
ملخص الذكاء الاصطناعي: ${report.ai_summary ?? ""}

رابط صورة البلاغ: ${report.image_url ?? ""}
رقم البلاغ: ${report.id ?? ""}

---
تم الإرسال تلقائياً بواسطة نظام UrbanEye AI
`;
}

// deno-lint-ignore no-explicit-any
async function sendDepartmentNotification(report: any): Promise<void> {
  if (!SMTP_ENABLED) {
    console.log("SMTP_ENABLED=false, skipping department email");
    return;
  }

  const toEmail = recipientFor(report.problem_type ?? "other");

  if (!SMTP_EMAIL || !SMTP_APP_PASSWORD) {
    console.log(
      `[DRY RUN - no SMTP credentials] Would email ${toEmail}:\n${buildEmailBody(report)}`,
    );
    return;
  }

  const severityAr = EMAIL_SEVERITY_AR[report.severity ?? ""] ?? "";
  const smtp = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: SMTP_USE_SSL,
      auth: { username: SMTP_EMAIL, password: SMTP_APP_PASSWORD },
    },
  });

  try {
    await smtp.send({
      from: `UrbanEye AI <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: `بلاغ جديد - ${report.department ?? "إدارة عامة"} (خطورة: ${severityAr})`,
      content: buildEmailBody(report),
    });
    console.log(`Department email sent to ${toEmail} for report ${report.id}`);
  } catch (err) {
    console.error("Failed to send department notification email:", err);
  } finally {
    await smtp.close();
  }
}

// ---------------- Excel export (port of backend/app/excel_export.py) ----------------

const EXCEL_HEADERS = [
  "رقم البلاغ",
  "تاريخ البلاغ",
  "نوع المشكلة",
  "درجة الخطورة",
  "الإدارة المسؤولة",
  "الوصف",
  "الموقع",
  "ملخص AI",
  "نسبة الثقة",
  "الحالة",
  "رابط الصورة",
];

const PROBLEM_TYPE_AR: Record<string, string> = {
  pothole: "حفرة",
  garbage: "قمامة",
  water_leak: "تسريب مياه",
  broken_light: "إنارة معطلة",
  accident: "حادث",
  other: "أخرى",
};

const SEVERITY_AR_MAP: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const STATUS_AR: Record<string, string> = {
  open: "مفتوح",
  in_progress: "قيد المعالجة",
  resolved: "تم الحل",
  closed: "مغلق",
};

// deno-lint-ignore no-explicit-any
function buildReportsExcel(reports: any[]): Uint8Array {
  const rows = [
    EXCEL_HEADERS,
    ...reports.map((r) => [
      String(r.id ?? "").slice(0, 8),
      String(r.created_at ?? "").slice(0, 19).replace("T", " "),
      PROBLEM_TYPE_AR[r.problem_type] ?? r.problem_type ?? "",
      SEVERITY_AR_MAP[r.severity] ?? r.severity ?? "",
      r.department ?? "",
      r.description ?? "",
      r.location_text ?? "",
      r.ai_summary ?? "",
      r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "",
      STATUS_AR[r.status] ?? r.status ?? "",
      r.image_url ?? "",
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [12, 18, 14, 12, 24, 35, 20, 35, 10, 14, 40].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "البلاغات");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

// ---------------- HTTP routing ----------------

function stripPrefix(pathname: string): string {
  if (pathname.startsWith(FN_PREFIX)) return pathname.slice(FN_PREFIX.length) || "/";
  return pathname;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const path = stripPrefix(url.pathname);
  const parts = path.split("/").filter(Boolean); // e.g. ["reports", "<id>"]

  try {
    if (path === "/health") {
      return json({ status: "ok" });
    }

    if (path === "/analyze" && req.method === "POST") {
      const form = await req.formData();
      const description = String(form.get("description") ?? "");
      const language = parseLanguage(form.get("language"));
      return json(runMockAi(description, language));
    }

    if (parts[0] === "reports") {
      if (parts.length === 3 && parts[1] === "export" && parts[2] === "excel" && req.method === "GET") {
        const communityId = url.searchParams.get("community_id") || DEFAULT_COMMUNITY_ID;
        const status = url.searchParams.get("status");
        const severity = url.searchParams.get("severity");
        let query = client
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })
          .eq("community_id", communityId);
        if (status) query = query.eq("status", status);
        if (severity) query = query.eq("severity", severity);
        const { data, error } = await query;
        if (error) throw error;

        const excelBytes = buildReportsExcel(data ?? []);
        return new Response(excelBytes, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": "attachment; filename=urbaneye_reports.xlsx",
          },
        });
      }

      if (parts.length === 1 && req.method === "POST") {
        const form = await req.formData();
        const image = form.get("image") as File | null;
        if (!image) return json({ detail: "image is required" }, 422);
        const description = String(form.get("description") ?? "");
        const locationText = String(form.get("location_text") ?? "");
        const latRaw = form.get("latitude");
        const lngRaw = form.get("longitude");
        const latitude = latRaw != null && latRaw !== "" ? Number(latRaw) : null;
        const longitude = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : null;
        const communityId = String(form.get("community_id") ?? "") || DEFAULT_COMMUNITY_ID;
        const language = parseLanguage(form.get("language"));

        const ext = (image.name || "photo.jpg").split(".").pop();
        const path_ = `${communityId}/${crypto.randomUUID()}.${ext}`;
        const bytes = new Uint8Array(await image.arrayBuffer());
        const { error: uploadError } = await client.storage
          .from(BUCKET)
          .upload(path_, bytes, { contentType: image.type || "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path_);
        const imageUrl = pub.publicUrl;

        const analysis = runMockAi(description, language);

        const incidentId = await findOrCreateIncident({
          communityId,
          problemType: analysis.problem_type,
          severity: analysis.severity,
          department: analysis.department,
          latitude,
          longitude,
        });

        const { data: inserted, error: insertError } = await client
          .from("reports")
          .insert({
            community_id: communityId,
            incident_id: incidentId,
            image_url: imageUrl,
            description,
            latitude,
            longitude,
            location_text: locationText,
            problem_type: analysis.problem_type,
            severity: analysis.severity,
            department: analysis.department,
            confidence: analysis.confidence,
            ai_summary: analysis.summary,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        // Email the department responsible for this problem type. Never
        // blocks/fails the request if SMTP is unset or unreachable.
        await sendDepartmentNotification(inserted);

        const { data: incident } = await client
          .from("incidents")
          .select("report_count")
          .eq("id", incidentId)
          .single();

        await maybeNotify({
          communityId,
          incidentId,
          problemType: analysis.problem_type,
          severity: analysis.severity,
          reportCount: incident?.report_count ?? 1,
        });

        return json(inserted, 201);
      }

      if (parts.length === 1 && req.method === "GET") {
        const communityId = url.searchParams.get("community_id") || DEFAULT_COMMUNITY_ID;
        const status = url.searchParams.get("status");
        const severity = url.searchParams.get("severity");
        let query = client
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })
          .eq("community_id", communityId);
        if (status) query = query.eq("status", status);
        if (severity) query = query.eq("severity", severity);
        const { data, error } = await query;
        if (error) throw error;
        return json(data);
      }

      if (parts.length === 2 && req.method === "GET") {
        const { data, error } = await client
          .from("reports")
          .select("*")
          .eq("id", parts[1]);
        if (error) throw error;
        if (!data || data.length === 0) return json({ detail: "Report not found" }, 404);
        return json(data[0]);
      }

      if (parts.length === 2 && req.method === "PATCH") {
        const body = await req.json();
        const { data, error } = await client
          .from("reports")
          .update({ status: body.status })
          .eq("id", parts[1])
          .select();
        if (error) throw error;
        if (!data || data.length === 0) return json({ detail: "Report not found" }, 404);
        return json(data[0]);
      }
    }

    if (parts[0] === "incidents") {
      if (parts.length === 1 && req.method === "GET") {
        const communityId = url.searchParams.get("community_id") || DEFAULT_COMMUNITY_ID;
        const status = url.searchParams.get("status");
        let query = client
          .from("incidents")
          .select("*")
          .order("last_reported_at", { ascending: false })
          .eq("community_id", communityId);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) throw error;
        return json(data);
      }

      if (parts.length === 2 && req.method === "GET") {
        const { data, error } = await client
          .from("incidents")
          .select("*")
          .eq("id", parts[1]);
        if (error) throw error;
        if (!data || data.length === 0) return json({ detail: "Incident not found" }, 404);
        return json(data[0]);
      }

      if (parts.length === 3 && parts[2] === "reports" && req.method === "GET") {
        const { data, error } = await client
          .from("reports")
          .select("*")
          .eq("incident_id", parts[1])
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      if (parts.length === 2 && req.method === "PATCH") {
        const body = await req.json();
        const { data, error } = await client
          .from("incidents")
          .update({ status: body.status })
          .eq("id", parts[1])
          .select();
        if (error) throw error;
        if (!data || data.length === 0) return json({ detail: "Incident not found" }, 404);
        return json(data[0]);
      }
    }

    if (path === "/stats" && req.method === "GET") {
      const communityId = url.searchParams.get("community_id") || DEFAULT_COMMUNITY_ID;
      const { data: reports, error } = await client
        .from("reports")
        .select("severity, problem_type")
        .eq("community_id", communityId);
      if (error) throw error;

      const { count, error: countError } = await client
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("community_id", communityId)
        .neq("status", "resolved");
      if (countError) throw countError;

      const bySeverity: Record<string, number> = {};
      const byProblemType: Record<string, number> = {};
      for (const row of reports ?? []) {
        bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
        byProblemType[row.problem_type] = (byProblemType[row.problem_type] ?? 0) + 1;
      }

      return json({
        total_reports: (reports ?? []).length,
        open_incidents: count ?? 0,
        by_severity: bySeverity,
        by_problem_type: byProblemType,
      });
    }

    return json({ detail: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ detail: String(err instanceof Error ? err.message : err) }, 500);
  }
});
