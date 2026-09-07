from fastapi import APIRouter, Form

from ..mock_ai import analyze as run_mock_ai
from ..schemas import Analysis

router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=Analysis)
async def analyze_report(description: str = Form(default="")) -> Analysis:
    """Classify a reported issue.

    ⚠️ Currently backed by a keyword heuristic (see app/mock_ai.py) — this is
    the swap-in point for a real Claude Vision call once the image itself
    should drive the classification instead of just the description text.
    """
    return run_mock_ai(description)
