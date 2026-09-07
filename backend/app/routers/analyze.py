from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import Analysis
from ..settings import settings

router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=Analysis)
async def analyze_report(
    description: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
) -> Analysis:
    """Classify a reported issue.

    Backend is selected via ``AI_BACKEND`` environment variable:

    * ``mock``   — keyword heuristic, always works, no setup (default)
    * ``ollama`` — local open-source model via Ollama (needs Ollama running)
    * ``groq``   — free cloud inference via Groq API (needs ``GROQ_API_KEY``)

    Any backend that is unreachable or misconfigured falls back to mock
    automatically, so the app never breaks.
    """
    image_bytes = await image.read() if image else None
    backend = settings.ai_backend.lower()

    if backend == "groq":
        from ..groq_ai import analyze
        return analyze(description)

    if backend == "ollama":
        from ..ollama_ai import analyze
        return analyze(description, image_bytes)

    # Default: mock keyword heuristic
    from ..mock_ai import analyze
    return analyze(description)
