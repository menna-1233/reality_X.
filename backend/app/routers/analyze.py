from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from ..ollama_ai import analyze as run_ai
from ..schemas import Analysis

router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=Analysis)
async def analyze_report(
    description: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
) -> Analysis:
    """Classify a reported issue.

    Backed by an open-source model served locally through Ollama (see
    app/ollama_ai.py) when `AI_BACKEND=ollama`, with the image included so
    the model can classify from the photo itself, not just the text.
    Falls back to a keyword heuristic (app/mock_ai.py) if Ollama is
    unavailable or `AI_BACKEND=mock`.
    """
    image_bytes = await image.read() if image else None
    return run_ai(description, image_bytes)
