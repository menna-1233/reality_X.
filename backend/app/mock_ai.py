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
    (["حريق", "نار", "fire", "burn"], "accident"),
    (["حادث", "اصطدام", "accident", "crash"], "accident"),
]

# Deterministic baseline severity per problem type. This is the ranking the
# AI's decision must respect — e.g. a fire ("accident") must never come out
# less severe than a burst pipe ("water_leak"). Keyword hits in the
# description can only escalate this baseline, never override it downward,
# and severity is never chosen at random.
_BASE_SEVERITY: dict[ProblemType, Severity] = {
    "pothole": "medium",
    "garbage": "low",
    "water_leak": "medium",
    "broken_light": "low",
    "accident": "critical",
    "other": "medium",
}

_SEVERITY_ORDER: list[Severity] = ["low", "medium", "high", "critical"]

_ESCALATION_KEYWORDS = ["خطر", "عاجل", "شديد", "urgent", "danger", "severe"]


def _escalate(severity: Severity, steps: int = 1) -> Severity:
    index = min(_SEVERITY_ORDER.index(severity) + steps, len(_SEVERITY_ORDER) - 1)
    return _SEVERITY_ORDER[index]

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
    severity = _BASE_SEVERITY[problem_type]
    if any(keyword in text for keyword in _ESCALATION_KEYWORDS):
        severity = _escalate(severity)
    return severity


def analyze(description: str) -> Analysis:
    problem_type = _detect_problem_type(description)
    severity = _detect_severity(problem_type, description)
    urgency = ""
    if severity == "critical":
        urgency = " الحالة تصنّف كحرجة وتحتاج استجابة عاجلة."
    elif severity == "high":
        urgency = " الحالة ذات أولوية عالية."

    # No description means the classification relied on the type baseline
    # only, with nothing to corroborate it — report that as lower
    # confidence rather than pretending the guess is as solid as a
    # described report, so low-confidence "other" reports get routed to
    # general review instead of a specific department by mistake.
    has_description = bool((description or "").strip())
    confidence = round(
        random.uniform(0.82, 0.97) if has_description else random.uniform(0.55, 0.72),
        2,
    )

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[problem_type],
        confidence=confidence,
        summary=_SUMMARIES[problem_type] + urgency,
    )
