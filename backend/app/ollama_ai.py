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

from .mock_ai import analyze as run_mock_ai
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

_DEPARTMENTS: dict[ProblemType, str] = {
    "pothole": "إدارة الصيانة والطرق",
    "garbage": "إدارة النظافة",
    "water_leak": "إدارة الصيانة والمرافق",
    "broken_light": "إدارة الكهرباء",
    "accident": "الأمن وإدارة الطوارئ",
    "other": "الإدارة العامة",
}

_PROMPT_TEMPLATE = """أنت نظام تصنيف بلاغات مشاكل مدينة (Smart City). حلّل الصورة المرفقة
(لو موجودة) والوصف المكتوب من المواطن، وارجع **JSON فقط** بدون أي نص أو شرح إضافي،
بالشكل التالي بالضبط:

{{
  "problem_type": "pothole" | "garbage" | "water_leak" | "broken_light" | "accident" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": <رقم عشري بين 0 و 1>,
  "summary": "<ملخص قصير بالعربية عن الحالة وخطورتها>"
}}

وصف المواطن للمشكلة: "{description}"
"""


def _build_payload(description: str, image_bytes: bytes | None) -> dict:
    payload: dict = {
        "model": settings.ollama_model,
        "prompt": _PROMPT_TEMPLATE.format(description=description or "بدون وصف"),
        "stream": False,
        "format": "json",
    }
    if image_bytes:
        payload["images"] = [base64.b64encode(image_bytes).decode("ascii")]
    return payload


def _parse_response(raw_text: str) -> Analysis:
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

    summary = data.get("summary") or "تم تحليل البلاغ بواسطة الذكاء الاصطناعي."

    return Analysis(
        problem_type=problem_type,
        severity=severity,
        department=_DEPARTMENTS[problem_type],
        confidence=round(confidence, 2),
        summary=summary,
    )


def analyze(description: str, image_bytes: bytes | None = None) -> Analysis:
    """Classify a report using a local open-source model via Ollama.

    Falls back to the keyword-heuristic mock on any failure (server down,
    bad JSON, timeout) so a broken/unreachable Ollama install never breaks
    the demo.
    """
    if not settings.ai_backend == "ollama":
        return run_mock_ai(description)

    try:
        response = httpx.post(
            f"{settings.ollama_base_url}/api/generate",
            json=_build_payload(description, image_bytes),
            timeout=settings.ollama_timeout_seconds,
        )
        response.raise_for_status()
        raw_text = response.json()["response"]
        return _parse_response(raw_text)
    except Exception:  # noqa: BLE001 - any failure should degrade gracefully
        logger.exception("Ollama analysis failed, falling back to mock AI")
        return run_mock_ai(description)
