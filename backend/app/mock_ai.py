"""Mock AI classifier — swap-in point for the real Claude Vision analysis.

This mirrors the frontend's `src/lib/mockAnalyze.ts` heuristic so both sides
of the demo behave consistently before the real `/analyze` model is wired up.

To go live, replace `analyze()`'s body with a call to Claude (or another
vision-capable model), e.g. using Anthropic's tool-use / structured output
to force the same Analysis shape defined in schemas.py.
"""

import random

from .schemas import Analysis, ProblemType, Severity

_KEYWORD_MAP: list[tuple[list[str], ProblemType]] = [
    (["زبال", "قمام", "garbage", "trash"], "garbage"),
    (["مياه", "تسريب", "مايه", "water", "leak"], "water_leak"),
    (["عمود", "نور", "كهرب", "light", "lamp"], "broken_light"),
    (["حفر", "طريق", "pothole", "hole"], "pothole"),
    (["حادث", "اصطدام", "accident", "crash"], "accident"),
]

_DEPARTMENTS: dict[ProblemType, str] = {
    "pothole": "إدارة الصيانة والطرق",
    "garbage": "إدارة النظافة",
    "water_leak": "إدارة الصيانة والمرافق",
    "broken_light": "إدارة الكهرباء",
    "accident": "الأمن وإدارة الطوارئ",
    "other": "الإدارة العامة",
}

_SUMMARIES: dict[ProblemType, str] = {
    "pothole": "تم رصد حفرة قد تشكل خطورة على السيارات والمشاة.",
    "garbage": "تم رصد تراكم للقمامة يحتاج إلى إزالة سريعة.",
    "water_leak": "تم رصد تسريب مياه قد يؤثر على البنية التحتية المحيطة.",
    "broken_light": "تم رصد عمود إنارة معطل يؤثر على الرؤية والأمان الليلي.",
    "accident": "تم رصد حادث يتطلب تدخلاً فورياً من فريق الطوارئ.",
    "other": "تم رصد مشكلة تحتاج إلى مراجعة الإدارة المختصة.",
}


def _detect_problem_type(description: str) -> ProblemType:
    text = (description or "").lower()
    for keywords, problem_type in _KEYWORD_MAP:
        if any(keyword in text for keyword in keywords):
            return problem_type
    return "other"


def _detect_severity(problem_type: ProblemType, description: str) -> Severity:
    text = (description or "").lower()
    if problem_type == "accident" or "خطر" in text or "urgent" in text:
        return "critical"
    weighted: list[Severity] = ["low", "medium", "medium", "medium", "high"]
    return random.choice(weighted)


def analyze(description: str) -> Analysis:
    problem_type = _detect_problem_type(description)
    severity = _detect_severity(problem_type, description)
    urgency = ""
    if severity == "critical":
        urgency = " الحالة تصنّف كحرجة وتحتاج استجابة عاجلة."
    elif severity == "high":
        urgency = " الحالة ذات أولوية عالية."

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[problem_type],
        confidence=round(random.uniform(0.72, 0.97), 2),
        summary=_SUMMARIES[problem_type] + urgency,
    )
