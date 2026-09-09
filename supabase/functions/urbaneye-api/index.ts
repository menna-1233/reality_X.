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

// ---------------- real vision AI (Groq multimodal) ----------------
//
// The mock above only reads the description text — that's why a photo of
// a fire with the wrong words in the description got classified as
// "water leak". This calls Groq's free multimodal API with the actual
// photo bytes so the model sees what the citizen submitted.
//
// Falls back to the mock on any failure (no key, quota exceeded, timeout,
// bad JSON) so the app never breaks — but if you see a mock-shaped
// summary in production, that's the tell that this path failed.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
// llama-4-scout supports vision, is on Groq's free tier, and is fast enough
// for a live report flow. Override via env if you want to try maverick etc.
const GROQ_VISION_MODEL =
  Deno.env.get("GROQ_VISION_MODEL") ?? "meta-llama/llama-4-scout-17b-16e-instruct";

const PROBLEM_TYPES: ProblemType[] = [
  "pothole", "garbage", "water_leak", "broken_light", "accident", "other",
];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

const VISION_SYSTEM_PROMPT: Record<Language, string> = {
  ar: `أنت نظام تصنيف بلاغات مشاكل مدينة (Smart City).

الصورة المرفقة هي المصدر الوحيد المعتمد للتصنيف. وصف المواطن معلومة
مساعدة بس (زي "المشكلة دي بقالها 3 أيام") ومش المرجع في تحديد نوع
المشكلة — افترض إن الوصف ممكن يكون غلط أو مضلل، وحدد المشكلة من اللي
شايفه في الصورة بالظبط. لو الوصف بيناقض الصورة، اعتمد على الصورة تمامًا.

ارجع JSON فقط بدون أي نص إضافي، بالحقول دي بالترتيب ده:

{
  "photo_observation": "<جملتين بالعربية بتوصف اللي شايفه فعلياً في الصورة — ايه الأجسام والمشهد. اكتب ده الأول قبل أي حاجة، بناءً على الصورة نفسها بس>",
  "matches_description": <true لو نوع المشكلة الظاهرة في الصورة من نفس فئة اللي بيوصفها المواطن، false بس لما تكون فئتين مختلفتين خالص. لو الوصف فاضي، ارجع true>,
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <رقم عشري بين 0 و 1>,
  "summary": "<ملخص قصير بالعربية عن الحالة بناءً على الصورة>"
}

problem_type لازم يطابق اللي في photo_observation، مش اللي في وصف المواطن.`,
  en: `You are a Smart City issue-report classifier.

The attached photo is the ONLY authoritative source for classification.
The citizen's written description is auxiliary context only (details
like "this has been leaking for 3 days") and is NOT the reference for
identifying the problem type — assume the description may be wrong or
misleading, and classify strictly by what you actually see in the
photo. If the description contradicts the photo, disregard the
description entirely.

Return JSON only, no extra text, with these fields in this order:

{
  "photo_observation": "<one or two sentences describing what you actually see in the photo — objects, setting, condition. Write this FIRST, based on the image alone>",
  "matches_description": <true if the problem type shown in the photo is the same category the citizen is describing, false ONLY when the categories are clearly different. If the description is empty, return true>,
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <decimal 0-1>,
  "summary": "<short summary in English of the condition based on the photo>"
}

problem_type MUST match what you described in photo_observation, NOT what
the citizen's description says.`,
};

const MISMATCH_PREFIX: Record<Language, string> = {
  ar: "⚠️ الصورة لا تطابق وصف المواطن — التصنيف مبني على الصورة. ",
  en: "⚠️ Photo does not match the citizen's description — classified from the photo. ",
};

// deno-lint-ignore no-explicit-any
function parseVisionJson(raw: string, description: string, language: Language): Analysis {
  let text = raw.trim();
  // strip ```json fences if the model wraps output
  if (text.startsWith("```")) {
    const inner = text.split("```")[1] ?? "";
    text = inner.replace(/^json\s*/i, "").trim();
  }
  const data = JSON.parse(text) as Record<string, any>;

  let problemType = data.problem_type as ProblemType;
  if (!PROBLEM_TYPES.includes(problemType)) problemType = "other";

  let severity = data.severity as Severity;
  if (!SEVERITIES.includes(severity)) severity = "medium";

  let confidence = Number(data.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.75;
  confidence = Math.max(0, Math.min(1, confidence));

  let summary = typeof data.summary === "string" && data.summary.trim()
    ? data.summary
    : SUMMARIES[language][problemType];

  const hasDescription = Boolean((description || "").trim());
  if (hasDescription && data.matches_description === false) {
    // The model saw a photo-vs-description conflict — cap confidence and
    // surface the discrepancy in the summary so admins spot it.
    confidence = Math.min(confidence, 0.55);
    if (!summary.startsWith("⚠️")) summary = MISMATCH_PREFIX[language] + summary;
  }

  return {
    problem_type: problemType,
    severity,
    department: DEPARTMENTS[language][problemType],
    confidence: Math.round(confidence * 100) / 100,
    summary,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function runVisionAi(
  description: string,
  imageBytes: Uint8Array,
  imageMime: string,
  language: Language,
): Promise<Analysis> {
  if (!GROQ_API_KEY) {
    console.warn("GROQ_API_KEY not set — falling back to mock AI");
    return runMockAi(description, language);
  }

  try {
    const dataUrl = `data:${imageMime || "image/jpeg"};base64,${bytesToBase64(imageBytes)}`;
    const userPrefix = language === "ar" ? "وصف المواطن (معلومة مساعدة، ممكن تكون مش دقيقة):"
                                          : "Citizen's description (auxiliary context, may be inaccurate):";
    const noDesc = language === "ar" ? "بدون وصف" : "no description";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_SYSTEM_PROMPT[language] + "\n\n" +
                                    `${userPrefix} "${description || noDesc}"` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    const body = await res.json();
    const raw: string = body?.choices?.[0]?.message?.content ?? "";
    if (!raw) throw new Error("Groq returned empty content");
    return parseVisionJson(raw, description, language);
  } catch (err) {
    console.error("Groq vision analysis failed, falling back to mock:", err);
    return runMockAi(description, language);
  }
}

function parseLanguage(value: FormDataEntryValue | null): Language {
  return value === "en" ? "en" : "ar";
}

// ---------------- forward geocoding ----------------
//
// The report form sends coordinates whenever it has them (from "use my
// location"), but a citizen can also just type an address by hand with no
// coordinates at all. Without this, that report could never be placed on
// the dashboard map. Best-effort: resolves the typed text to coordinates
// via OSM's free Nominatim geocoder when none were supplied; on any
// failure (no match, network error, timeout) the report is still created
// with location_text alone, same as before this existed.
async function geocodeAddress(query: string): Promise<[number, number] | null> {
  try {
    // Commas confuse Nominatim's free-form query parser more often than
    // they help (e.g. "طريق القاهرة, الاسكندرية الزراعى، طوخ" matches
    // nothing, but the same text with commas stripped matches cleanly).
    const cleaned = query.replace(/[,،]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return null;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(cleaned)}`,
      {
        // Nominatim's usage policy requires an identifying User-Agent.
        headers: { "User-Agent": "UrbanEyeAI/1.0 (Supabase Edge Function)" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = Number(results[0].lat);
    const lon = Number(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lat, lon];
  } catch {
    return null;
  }
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

  // Subject stays pure ASCII on purpose — denomailer's RFC 2047 encoder
  // (config/mail/encoding.ts: quotedPrintableEncodeInline) reuses the
  // *body* quoted-printable folder, which inserts a literal "=\r\n" soft
  // line-break every ~74 chars. That's valid inside a MIME body but not
  // inside a single header encoded-word — Arabic text easily exceeds 74
  // encoded chars, so the Subject header ends up with a bare CRLF in it,
  // corrupting the whole message (Gmail then renders raw MIME source
  // instead of the email). Non-ASCII text is fine in the body, which uses
  // proper body-level QP folding — just never in the Subject.
  const departmentEn = DEPARTMENTS.en[(report.problem_type as ProblemType) ?? "other"] ?? "General Administration";
  const subject = `UrbanEye AI - New Report: ${departmentEn} (severity: ${report.severity ?? "unknown"})`;

  // Everything below — including the client's own close() — is one
  // failure domain: denomailer throws its own secondary error out of
  // close() when send() never got as far as opening a connection (e.g. a
  // rejected recipient), so close() must never be allowed to escape and
  // clobber the original, more useful error.
  try {
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
        subject,
        content: buildEmailBody(report),
      });
      console.log(`Department email sent to ${toEmail} for report ${report.id}`);
    } finally {
      // denomailer's close() isn't reliably a Promise (sometimes throws
      // synchronously, sometimes returns undefined) — a plain try/catch
      // around the await handles both, unlike chaining .catch() onto it.
      try {
        await smtp.close();
      } catch {
        // cleanup failure here never matters to the caller
      }
    }
  } catch (err) {
    console.error("Failed to send department notification email:", err);
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
      const image = form.get("image") as File | null;
      if (image) {
        const bytes = new Uint8Array(await image.arrayBuffer());
        return json(await runVisionAi(description, bytes, image.type || "image/jpeg", language));
      }
      // No image on /analyze — classify from description alone, mock-style.
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
        const description = String(form.get("description") ?? "").trim();
        if (!description) return json({ detail: "description is required" }, 422);
        const locationText = String(form.get("location_text") ?? "").trim();
        const latRaw = form.get("latitude");
        const lngRaw = form.get("longitude");
        let latitude = latRaw != null && latRaw !== "" ? Number(latRaw) : null;
        let longitude = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : null;
        // Location is either coordinates (from "use my location") or typed
        // text — the citizen must supply one or the other, not neither.
        if (latitude == null && longitude == null && !locationText) {
          return json({ detail: "location is required" }, 422);
        }
        // No coordinates yet means the citizen typed an address by hand
        // (not "use my location") — best-effort resolve it so this report
        // can still be placed on the dashboard map. Never blocks creation
        // if it fails; the report just keeps location_text alone.
        if (latitude == null && longitude == null && locationText) {
          const geocoded = await geocodeAddress(locationText);
          if (geocoded) [latitude, longitude] = geocoded;
        }
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

        // Real vision AI: the model sees the photo bytes and classifies from
        // what's actually shown. Falls back to the text-only mock if the
        // Groq call fails or GROQ_API_KEY isn't configured — but a
        // mock-shaped result in production is the signal that vision failed.
        const analysis = await runVisionAi(
          description,
          bytes,
          image.type || "image/jpeg",
          language,
        );

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
        // blocks/fails the request if SMTP is unset or unreachable —
        // sendDepartmentNotification already catches internally, but the
        // report the citizen submitted must be saved either way, so this
        // is caught again at the call site as a second line of defense.
        try {
          await sendDepartmentNotification(inserted);
        } catch (err) {
          console.error("Department email step failed unexpectedly:", err);
        }

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
