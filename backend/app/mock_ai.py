"""Mock AI classifier — swap-in point for the real Claude Vision analysis.

This mirrors the frontend's `src/lib/mockAnalyze.ts` heuristic so both sides
of the demo behave consistently before the real `/analyze` model is wired up.

To go live, replace `analyze()`'s body with a call to Claude (or another
vision-capable model), e.g. using Anthropic's tool-use / structured output
to force the same Analysis shape defined in schemas.py.
"""

import random
from typing import Literal

from .schemas import Analysis, ProblemType, Severity

Language = Literal["ar", "en"]

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

_DEPARTMENTS: dict[Language, dict[ProblemType, str]] = {
    "ar": {
        "pothole": "إدارة الصيانة والطرق",
        "garbage": "إدارة النظافة",
        "water_leak": "إدارة الصيانة والمرافق",
        "broken_light": "إدارة الكهرباء",
        "accident": "الأمن وإدارة الطوارئ",
        "other": "الإدارة العامة",
    },
    "en": {
        "pothole": "Roads & Maintenance Department",
        "garbage": "Sanitation Department",
        "water_leak": "Maintenance & Utilities Department",
        "broken_light": "Electrical Department",
        "accident": "Security & Emergency Response",
        "other": "General Administration",
    },
}

_SUMMARIES: dict[Language, dict[ProblemType, str]] = {
    "ar": {
        "pothole": "تم رصد حفرة قد تشكل خطورة على السيارات والمشاة.",
        "garbage": "تم رصد تراكم للقمامة يحتاج إلى إزالة سريعة.",
        "water_leak": "تم رصد تسريب مياه قد يؤثر على البنية التحتية المحيطة.",
        "broken_light": "تم رصد عمود إنارة معطل يؤثر على الرؤية والأمان الليلي.",
        "accident": "تم رصد حادث يتطلب تدخلاً فورياً من فريق الطوارئ.",
        "other": "تم رصد مشكلة تحتاج إلى مراجعة الإدارة المختصة.",
    },
    "en": {
        "pothole": "A pothole was detected that may pose a risk to vehicles and pedestrians.",
        "garbage": "Garbage buildup was detected that needs prompt removal.",
        "water_leak": "A water leak was detected that may affect the surrounding infrastructure.",
        "broken_light": "A broken streetlight was detected, affecting visibility and nighttime safety.",
        "accident": "An accident was detected that requires immediate response from the emergency team.",
        "other": "An issue was detected that needs review by the relevant department.",
    },
}

_URGENCY_SUFFIX: dict[Language, dict[str, str]] = {
    "ar": {
        "critical": " الحالة تصنّف كحرجة وتحتاج استجابة عاجلة.",
        "high": " الحالة ذات أولوية عالية.",
    },
    "en": {
        "critical": " This is classified as critical and needs an urgent response.",
        "high": " This is high priority.",
    },
}


def _detect_problem_type(description: str) -> ProblemType:
    text = (description or "").lower()
    for keywords, problem_type in _KEYWORD_MAP:
        if any(keyword in text for keyword in keywords):
            return problem_type
    return "other"


def _detect_severity(problem_type: ProblemType, description: str, has_description: bool) -> Severity:
    text = (description or "").lower()
    severity = _BASE_SEVERITY[problem_type]
    if any(keyword in text for keyword in _ESCALATION_KEYWORDS):
        severity = _escalate(severity)
    # A report with no description AND no keyword match ("other") means we
    # have nothing at all to go on — the photo could be a fire, same as it
    # could be litter. Defaulting that unknown case to "medium" quietly
    # buries it in the normal queue, so treat "no signal" as "needs urgent
    # human review" instead of guessing it's harmless.
    if not has_description and problem_type == "other":
        severity = _escalate(severity, steps=2)
    return severity


def analyze(description: str, language: Language = "ar") -> Analysis:
    problem_type = _detect_problem_type(description)
    has_description = bool((description or "").strip())
    severity = _detect_severity(problem_type, description, has_description)
    urgency = ""
    if severity == "critical":
        urgency = _URGENCY_SUFFIX[language]["critical"]
    elif severity == "high":
        urgency = _URGENCY_SUFFIX[language]["high"]

    # No description means the classification relied on the type baseline
    # only, with nothing to corroborate it — report that as lower
    # confidence rather than pretending the guess is as solid as a
    # described report, so low-confidence "other" reports get routed to
    # general review instead of a specific department by mistake.
    confidence = round(
        random.uniform(0.82, 0.97) if has_description else random.uniform(0.55, 0.72),
        2,
    )

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[language][problem_type],
        confidence=confidence,
        summary=_SUMMARIES[language][problem_type] + urgency,
    )
