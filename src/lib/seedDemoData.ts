import { addReport, listReports, setReportStatus } from "./storage";
import type { Report } from "../types";

type DemoReport = Omit<Report, "events">;

function svgPlaceholder(bg: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='${bg}'/><text x='200' y='160' font-size='28' font-family='Cairo,Arial' fill='white' text-anchor='middle'>${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

const now = Date.now();

const DEMO: DemoReport[] = [
  {
    id: "demo-1",
    imageDataUrl: svgPlaceholder("#dc2626", "تسريب"),
    description: "تسريب مياه غزير جنب المدخل الرئيسي",
    location: "30.05970, 31.23150",
    createdAt: new Date(now - 20 * 60000).toISOString(),
    analysis: {
      problemType: "water_leak",
      severity: "critical",
      department: "إدارة الصيانة والمرافق",
      confidence: 0.91,
      summary: "تسريب مياه غزير قد يؤدي لتلف الأرضيات، يتطلب تدخل فوري.",
    },
    status: "in_progress",
  },
  {
    id: "demo-2",
    imageDataUrl: svgPlaceholder("#ea580c", "حفرة"),
    description: "حفرة كبيرة في الطريق قدام عمارة 5",
    location: "30.06210, 31.22870",
    createdAt: new Date(now - 90 * 60000).toISOString(),
    analysis: {
      problemType: "pothole",
      severity: "high",
      department: "إدارة الصيانة والطرق",
      confidence: 0.87,
      summary: "حفرة عميقة قد تسبب أضرارًا للسيارات.",
    },
    status: "open",
  },
  {
    id: "demo-3",
    imageDataUrl: svgPlaceholder("#eab308", "زبالة"),
    description: "تراكم زبالة جنب الجراچ",
    location: "30.05800, 31.23480",
    createdAt: new Date(now - 5 * 3600000).toISOString(),
    analysis: {
      problemType: "garbage",
      severity: "medium",
      department: "إدارة النظافة",
      confidence: 0.78,
      summary: "تراكم قمامة يحتاج جدولة جمع إضافية.",
    },
    status: "open",
  },
  {
    id: "demo-4",
    imageDataUrl: svgPlaceholder("#22c55e", "إنارة"),
    description: "عمود نور بايظ من يومين",
    location: "عمارة 3 - الشارع الجانبي",
    createdAt: new Date(now - 26 * 3600000).toISOString(),
    analysis: {
      problemType: "broken_light",
      severity: "low",
      department: "إدارة الكهرباء",
      confidence: 0.95,
      summary: "عمود إنارة لا يعمل، لا يشكل خطورة عاجلة.",
    },
    status: "resolved",
  },
  {
    id: "demo-5",
    imageDataUrl: svgPlaceholder("#dc2626", "حادث"),
    description: "حادث تصادم عند بوابة الخروج",
    location: "30.06050, 31.23020",
    createdAt: new Date(now - 3 * 60000).toISOString(),
    analysis: {
      problemType: "accident",
      severity: "critical",
      department: "الأمن وإدارة الطوارئ",
      confidence: 0.94,
      summary: "حادث يتطلب تدخلاً فوريًا من فريق الطوارئ.",
    },
    status: "open",
  },
  {
    id: "demo-6",
    imageDataUrl: svgPlaceholder("#f97316", "حفرة"),
    description: "حفرة صغيرة قرب الملاعب",
    location: "بدون إحداثيات - جنب الملعب",
    createdAt: new Date(now - 2 * 24 * 3600000).toISOString(),
    analysis: {
      problemType: "pothole",
      severity: "medium",
      department: "إدارة الصيانة والطرق",
      confidence: 0.7,
      summary: "حفرة متوسطة الحجم.",
    },
    status: "closed",
  },
  {
    // same real-world leak as demo-1, reported independently by a second resident
    // a few minutes later, a couple of meters off — should auto-group into one incident.
    id: "demo-7",
    imageDataUrl: svgPlaceholder("#dc2626", "تسريب"),
    description: "مياه بتسيل جنب البوابة من ساعة تقريبًا",
    location: "30.05955, 31.23180",
    createdAt: new Date(now - 12 * 60000).toISOString(),
    analysis: {
      problemType: "water_leak",
      severity: "high",
      department: "إدارة الصيانة والمرافق",
      confidence: 0.83,
      summary: "بلاغ إضافي عن نفس منطقة التسريب.",
    },
    status: "open",
  },
];

/** Dev-only convenience: seeds a handful of demo reports so the feed/dashboard aren't empty on first run. */
export function seedDemoDataIfEmpty(): void {
  if (!import.meta.env.DEV) return;
  if (listReports().length > 0) return;
  for (const report of DEMO) {
    addReport(report);
    if (report.status !== "open") setReportStatus(report.id, report.status);
  }
}
