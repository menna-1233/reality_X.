"""Cloud AI classifier backed by Groq's free inference API.

Groq runs open-source models (Llama, Mixtral, …) on LPU hardware — very
fast, and has a generous free tier (no credit card required to start).
Sign up at https://console.groq.com, create an API key, and set:

    AI_BACKEND=groq
    GROQ_API_KEY=gsk_...

Recommended model: ``llama-3.3-70b-versatile`` — large context, strong
Arabic support, free on Groq's hosted tier.

Falls back to the keyword-heuristic mock on any failure (missing key,
quota exceeded, network error) so the demo never breaks.
"""

import json
import logging

from .mock_ai import Language, analyze as run_mock_ai
from .schemas import Analysis, ProblemType, Severity
from .settings import settings

logger = logging.getLogger(__name__)

_PROBLEM_TYPES: list[ProblemType] = [
    "pothole",
    "garbage",
    "water_leak",
    "broken_light",
    "accident",
    "other",
]
_SEVERITIES: list[Severity] = ["low", "medium", "high", "critical"]

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

_SYSTEM_PROMPT: dict[Language, str] = {
    "ar": """أنت نظام تصنيف بلاغات مشاكل مدينة ذكية (Smart City).
حلّل وصف المشكلة المرسلة من المواطن وارجع JSON فقط بدون أي نص إضافي بالشكل التالي:

{
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <رقم عشري بين 0 و 1>,
  "summary": "<ملخص قصير بالعربية عن المشكلة>"
}

اختر problem_type الأقرب للمشكلة. ارجع JSON فقط.""",
    "en": """You are a smart-city issue-report classifier.
Analyze the citizen's description of the problem and return JSON only, with no
extra text, in exactly this shape:

{
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <decimal number between 0 and 1>,
  "summary": "<short summary in English of the issue>"
}

Pick the problem_type closest to the issue. Return JSON only.""",
}


def _parse_response(raw_text: str, language: Language) -> Analysis:
    # Strip markdown code fences if the model wraps output in ```json ... ```
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    data = json.loads(text)

    problem_type = data.get("problem_type")
    if problem_type not in _PROBLEM_TYPES:
        problem_type = "other"

    severity = data.get("severity")
    if severity not in _SEVERITIES:
        severity = "medium"

    confidence = data.get("confidence", 0.75)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.75

    fallback_summary = (
        "تم تحليل البلاغ بواسطة الذكاء الاصطناعي."
        if language == "ar"
        else "The report was analyzed by AI."
    )
    summary = data.get("summary") or fallback_summary

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[language][problem_type],
        confidence=round(confidence, 2),
        summary=summary,
    )


def analyze(description: str, image_bytes: bytes | None = None, language: Language = "ar") -> Analysis:
    """Classify a report using Groq's free cloud inference API.

    Falls back to the keyword-heuristic mock on any failure.
    """
    if not settings.groq_api_key:
        logger.warning("GROQ_API_KEY not set — falling back to mock AI")
        return run_mock_ai(description, language)

    try:
        from groq import Groq  # imported lazily so missing package → fallback

        client = Groq(api_key=settings.groq_api_key)
        user_prefix = "وصف المواطن" if language == "ar" else "Citizen's description"
        no_description = "بدون وصف" if language == "ar" else "no description"
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT[language]},
                {
                    "role": "user",
                    "content": f"{user_prefix}: {description or no_description}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=256,
        )
        raw_text = response.choices[0].message.content or ""
        return _parse_response(raw_text, language)
    except Exception:  # noqa: BLE001
        logger.exception("Groq analysis failed, falling back to mock AI")
        return run_mock_ai(description, language)
