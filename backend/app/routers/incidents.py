from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_admin
from ..db import get_client
from ..schemas import IncidentOut, IncidentUpdate, ReportOut
from ..settings import settings

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentOut])
async def list_incidents(
    community_id: Optional[str] = None, status: Optional[str] = None
) -> list[IncidentOut]:
    client = get_client()
    query = client.table("incidents").select("*").order("last_reported_at", desc=True)
    query = query.eq("community_id", community_id or settings.default_community_id)
    if status:
        query = query.eq("status", status)
    rows = query.execute().data
    return [IncidentOut(**row) for row in rows]


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(incident_id: str) -> IncidentOut:
    client = get_client()
    rows = client.table("incidents").select("*").eq("id", incident_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentOut(**rows[0])


@router.get("/{incident_id}/reports", response_model=list[ReportOut])
async def get_incident_reports(incident_id: str) -> list[ReportOut]:
    client = get_client()
    rows = (
        client.table("reports")
        .select("*")
        .eq("incident_id", incident_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return [ReportOut(**row) for row in rows]


@router.patch(
    "/{incident_id}", response_model=IncidentOut, dependencies=[Depends(require_admin)]
)
async def update_incident(incident_id: str, update: IncidentUpdate) -> IncidentOut:
    client = get_client()
    rows = (
        client.table("incidents")
        .update({"status": update.status})
        .eq("id", incident_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentOut(**rows[0])
