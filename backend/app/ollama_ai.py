"""Real AI classifier backed by a local, open-source model served through Ollama.

Replaces the keyword heuristic in `app/mock_ai.py` with an actual vision+
language model call. Ollama (https://ollama.com) runs the model locally —
no API key, no cost — and exposes a plain HTTP API on `localhost:11434` by
default.

Recommended model: a multimodal one so the image itself drives the
classification instead of just the description text, e.g.:

    ollama pull qwen2.5vl
    # or: ollama pull llava

If the Ollama server is unreachable, times out, or returns something that
doesn't parse into a valid `Analysis`, we fall back to the mock heuristic so
the rest of the app (incident grouping, notifications, dashboard) keeps
working during the demo.
"""

import base64
import json
import logging

import httpx

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

_PROMPT_TEMPLATE: dict[Language, str] = {
    "ar": """أنت نظام تصنيف بلاغات مشاكل مدينة (Smart City).

الصورة المرفقة هي المصدر الوحيد المعتمد للتصنيف. وصف المواطن معلومة مساعدة
بس (زي "المشكلة دي بقالها 3 أيام") ومش المرجع في تحديد نوع المشكلة —
افترض إن الوصف ممكن يكون غلط أو مضلل، وحدد المشكلة من اللي شايفه في الصورة
بالظبط. لو الوصف بيناقض الصورة، اعتمد على الصورة تمامًا.

ارجع **JSON فقط** بدون أي نص إضافي، بالحقول دي **بالترتيب ده**:

{{
  "photo_observation": "<جملتين بالعربية بتوصف اللي شايفه فعلياً في الصورة
    — ايه الأجسام والمشهد. اكتب ده الأول قبل أي حاجة، وبناءً على الصورة
    نفسها بس، من غير ما تبص على الوصف اللي تحت>",
  "matches_description": <true لو نوع المشكلة الظاهرة في الصورة من نفس فئة
    اللي بيوصفها المواطن (مثلاً: صورة حفرة + وصف يذكر حفرة/طريق = true،
    حتى لو التفاصيل مش متطابقة بالظبط). false بس لما تكون فئتين مختلفتين
    خالص (مثلاً: صورة حفرة + وصف نار/زبالة/تسريب مياه). لو الوصف فاضي أو
    مش واضح، ارجع true>,
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <رقم عشري بين 0 و 1 — عالي لو الصورة واضحة، منخفض لو مش
    واضحة أو matches_description=false>,
  "summary": "<ملخص قصير بالعربية عن الحالة بناءً على الصورة. لو الوصف
    بيتعارض مع الصورة، وضّح ده في الملخص>"
}}

problem_type لازم يطابق اللي في photo_observation، مش اللي في وصف المواطن.

وصف المواطن (معلومة مساعدة، ممكن تكون مش دقيقة): "{description}"
""",
    "en": """You are a Smart City issue-report classifier.

The attached photo is the ONLY authoritative source for classification. The
citizen's written description is auxiliary context only (details like "this
has been leaking for 3 days") and is NOT the reference for identifying the
problem type — assume the description may be wrong or misleading, and
classify strictly by what you actually see in the photo. If the description
contradicts the photo, disregard the description entirely.

Return **JSON only**, no extra text, with these fields **in this order**:

{{
  "photo_observation": "<one or two sentences describing what you actually see
    in the photo — objects, setting, condition. Write this FIRST, before
    anything else, based on the image alone, without looking at the
    description below>",
  "matches_description": <true if the problem type shown in the photo is the
    same category the citizen is describing (e.g. photo of a pothole +
    description mentioning pothole/road damage = true, even if exact details
    differ). Set false ONLY when the categories are clearly different
    (e.g. photo of a pothole + description of fire/garbage/water leak). If
    the description is empty or unclear, return true>,
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <decimal 0-1 — high if photo is clear, low if unclear or
    matches_description=false>,
  "summary": "<short summary in English of the condition based on the photo.
    If the description contradicts the photo, note that in the summary>"
}}

problem_type MUST match what you described in photo_observation, NOT what the
citizen's description says.

Citizen's description (auxiliary context, may be inaccurate): "{description}"
""",
}

_NO_DESCRIPTION: dict[Language, str] = {"ar": "بدون وصف", "en": "no description"}
_FALLBACK_SUMMARY: dict[Language, str] = {
    "ar": "تم تحليل البلاغ بواسطة الذكاء الاصطناعي.",
    "en": "The report was analyzed by AI.",
}


def _build_payload(description: str, image_bytes: bytes | None, language: Language) -> dict:
    payload: dict = {
        "model": settings.ollama_model,
        "prompt": _PROMPT_TEMPLATE[language].format(
            description=description or _NO_DESCRIPTION[language]
        ),
        "stream": False,
        "format": "json",
    }
    if image_bytes:
        payload["images"] = [base64.b64encode(image_bytes).decode("ascii")]
    return payload


_MISMATCH_PREFIX: dict[Language, str] = {
    "ar": "⚠️ الصورة لا تطابق وصف المواطن — التصنيف مبني على الصورة. ",
    "en": "⚠️ Photo does not match the citizen's description — classified from the photo. ",
}


def _parse_response(raw_text: str, language: Language, has_description: bool) -> Analysis:
    data = json.loads(raw_text)

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

    summary = data.get("summary") or _FALLBACK_SUMMARY[language]

    # If a description was provided AND the model flagged the photo as not
    # matching it, cap confidence (we know at least one signal is unreliable)
    # and prepend a note to the summary so admins can see at a glance that
    # this report wasn't a straightforward match. Skip when there's no
    # description — the model has nothing to compare against there.
    if has_description and data.get("matches_description") is False:
        confidence = min(confidence, 0.55)
        if not summary.startswith("⚠️"):
            summary = _MISMATCH_PREFIX[language] + summary

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[language][problem_type],
        confidence=round(confidence, 2),
        summary=summary,
    )


def analyze(description: str, image_bytes: bytes | None = None, language: Language = "ar") -> Analysis:
    """Classify a report using a local open-source model via Ollama.

    Falls back to the keyword-heuristic mock on any failure (server down,
    bad JSON, timeout) so a broken/unreachable Ollama install never breaks
    the demo.
    """
    if not settings.ai_backend == "ollama":
        return run_mock_ai(description, language)

    try:
        response = httpx.post(
            f"{settings.ollama_base_url}/api/generate",
            json=_build_payload(description, image_bytes, language),
            timeout=settings.ollama_timeout_seconds,
        )
        response.raise_for_status()
        raw_text = response.json()["response"]
        return _parse_response(
            raw_text, language, has_description=bool((description or "").strip())
        )
    except Exception:  # noqa: BLE001 - any failure should degrade gracefully
        logger.exception("Ollama analysis failed, falling back to mock AI")
        return run_mock_ai(description, language)
