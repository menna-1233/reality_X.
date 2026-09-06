import type { Analysis, ProblemType, Severity } from "../types";

/**
 * ⚠️ MOCK AI — swap-in point for the real service.
 *
 * In production this should be replaced with a real call, e.g.:
 *
 *   const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analyze`, {
 *     method: "POST",
 *     body: formData, // { image, description, location }
 *   });
 *   return (await res.json()) as Analysis;
 *
 * For the hackathon demo we simulate the AI's classification with a simple
 * keyword heuristic on the description text, plus a random-but-plausible
 * severity, so the rest of the app (feed, incident grouping, dashboard) can
 * be built and demoed end-to-end before the real AI service is ready.
 */

const KEYWORD_MAP: { keywords: string[]; type: ProblemType }[] = [
  { keywords: ["زبال", "قمام", "garbage", "trash"], type: "garbage" },
  { keywords: ["مياه", "تسريب", "مايه", "water", "leak"], type: "water_leak" },
  { keywords: ["عمود", "نور", "كهرب", "light", "lamp"], type: "broken_light" },
  { keywords: ["حفر", "طريق", "pothole", "hole"], type: "pothole" },
  { keywords: ["حادث", "اصطدام", "accident", "crash"], type: "accident" },
];

const DEPARTMENTS: Record<ProblemType, string> = {
  pothole: "إدارة الصيانة والطرق",
  garbage: "إدارة النظافة",
  water_leak: "إدارة الصيانة والمرافق",
  broken_light: "إدارة الكهرباء",
  accident: "الأمن وإدارة الطوارئ",
  other: "الإدارة العامة",
};

function detectProblemType(description: string): ProblemType {
  const text = description.toLowerCase();
  for (const { keywords, type } of KEYWORD_MAP) {
    if (keywords.some((k) => text.includes(k))) return type;
  }
  return "other";
}

function detectSeverity(problemType: ProblemType, description: string): Severity {
  const text = description.toLowerCase();
  if (problemType === "accident" || text.includes("خطر") || text.includes("urgent")) {
    return "critical";
  }
  const weighted: Severity[] = ["low", "medium", "medium", "medium", "high"];
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function buildSummary(problemType: ProblemType, severity: Severity): string {
  const base: Record<ProblemType, string> = {
    pothole: "تم رصد حفرة قد تشكل خطورة على السيارات والمشاة.",
    garbage: "تم رصد تراكم للقمامة يحتاج إلى إزالة سريعة.",
    water_leak: "تم رصد تسريب مياه قد يؤثر على البنية التحتية المحيطة.",
    broken_light: "تم رصد عمود إنارة معطل يؤثر على الرؤية والأمان الليلي.",
    accident: "تم رصد حادث يتطلب تدخلاً فورياً من فريق الطوارئ.",
    other: "تم رصد مشكلة تحتاج إلى مراجعة الإدارة المختصة.",
  };
  const urgency =
    severity === "critical"
      ? " الحالة تصنّف كحرجة وتحتاج استجابة عاجلة."
      : severity === "high"
      ? " الحالة ذات أولوية عالية."
      : "";
  return base[problemType] + urgency;
}

export async function mockAnalyze(description: string): Promise<Analysis> {
  // simulate network/inference latency
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const problemType = detectProblemType(description);
  const severity = detectSeverity(problemType, description);

  return {
    problemType,
    severity,
    department: DEPARTMENTS[problemType],
    confidence: Math.round((0.72 + Math.random() * 0.25) * 100) / 100,
    summary: buildSummary(problemType, severity),
  };
}
