from typing import Optional

from fastapi import APIRouter

from ..db import get_client
from ..schemas import StatsOut
from ..settings import settings

router = APIRouter(tags=["stats"])


@router.get("/stats", response_model=StatsOut)
async def get_stats(community_id: Optional[str] = None) -> StatsOut:
    client = get_client()
    cid = community_id or settings.default_community_id

    reports = (
        client.table("reports")
        .select("severity, problem_type")
        .eq("community_id", cid)
        .execute()
        .data
    )
    open_incidents = (
        client.table("incidents")
        .select("id", count="exact")
        .eq("community_id", cid)
        .neq("status", "resolved")
        .execute()
    )

    by_severity: dict[str, int] = {}
    by_problem_type: dict[str, int] = {}
    for row in reports:
        by_severity[row["severity"]] = by_severity.get(row["severity"], 0) + 1
        by_problem_type[row["problem_type"]] = (
            by_problem_type.get(row["problem_type"], 0) + 1
        )

    return StatsOut(
        total_reports=len(reports),
        open_incidents=open_incidents.count or 0,
        by_severity=by_severity,
        by_problem_type=by_problem_type,
    )
