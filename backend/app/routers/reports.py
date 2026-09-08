import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ..auth import require_admin
from ..db import get_client
from ..email_service import send_department_notification
from ..excel_export import build_reports_excel
from ..incidents import find_or_create_incident
from ..ollama_ai import analyze as run_ai
from ..notifications import maybe_notify
from ..schemas import ReportOut, ReportStatusUpdate
from ..settings import settings

router = APIRouter(prefix="/reports", tags=["reports"])

BUCKET = "report-images"


@router.post("", response_model=ReportOut)
async def create_report(
    image: UploadFile = File(...),
    description: str = Form(default=""),
    location_text: str = Form(default=""),
    latitude: Optional[float] = Form(default=None),
    longitude: Optional[float] = Form(default=None),
    community_id: Optional[str] = Form(default=None),
) -> ReportOut:
    client = get_client()
    community_id = community_id or settings.default_community_id

    # 1. Store the image
    contents = await image.read()
    ext = (image.filename or "photo.jpg").split(".")[-1]
    path = f"{community_id}/{uuid.uuid4()}.{ext}"
    client.storage.from_(BUCKET).upload(
        path, contents, {"content-type": image.content_type or "image/jpeg"}
    )
    image_url = client.storage.from_(BUCKET).get_public_url(path)

    # 2. Analyze — real open-source model via Ollama (app/ollama_ai.py) when
    #    AI_BACKEND=ollama, else the keyword-heuristic mock as a fallback.
    analysis = run_ai(description, contents)

    # 3. Group into an incident
    incident_id = find_or_create_incident(
        community_id=community_id,
        problem_type=analysis.problem_type,
        severity=analysis.severity,
        department=analysis.department,
        latitude=latitude,
        longitude=longitude,
    )

    # 4. Persist the report
    inserted = (
        client.table("reports")
        .insert(
            {
                "community_id": community_id,
                "incident_id": incident_id,
                "image_url": image_url,
                "description": description,
                "latitude": latitude,
                "longitude": longitude,
                "location_text": location_text,
                "problem_type": analysis.problem_type,
                "severity": analysis.severity,
                "department": analysis.department,
                "confidence": analysis.confidence,
                "ai_summary": analysis.summary,
            }
        )
        .execute()
        .data
    )
    report = inserted[0]

    # 5. Email the department responsible for this problem type (e.g. water
    #    leaks -> maintenance, garbage -> cleaning). Never blocks/fails the
    #    request if SMTP is unset or unreachable.
    send_department_notification(report)

    # 6. Notify residents if this crosses a severity/volume threshold
    incident = (
        client.table("incidents")
        .select("report_count")
        .eq("id", incident_id)
        .single()
        .execute()
        .data
    )
    maybe_notify(
        community_id=community_id,
        incident_id=incident_id,
        problem_type=analysis.problem_type,
        severity=analysis.severity,
        report_count=incident["report_count"],
    )

    return ReportOut(**report)


@router.get("", response_model=list[ReportOut])
async def list_reports(
    community_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
) -> list[ReportOut]:
    client = get_client()
    query = client.table("reports").select("*").order("created_at", desc=True)
    query = query.eq("community_id", community_id or settings.default_community_id)
    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)
    rows = query.execute().data
    return [ReportOut(**row) for row in rows]


@router.get("/export/excel")
async def export_reports_excel(
    community_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
) -> StreamingResponse:
    """Download all matching reports as an .xlsx spreadsheet.

    Same filters as GET /reports (community_id, status, severity).
    """
    client = get_client()
    query = client.table("reports").select("*").order("created_at", desc=True)
    query = query.eq("community_id", community_id or settings.default_community_id)
    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)
    rows = query.execute().data

    excel_bytes = build_reports_excel(rows)
    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=urbaneye_reports.xlsx"},
    )


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: str) -> ReportOut:
    client = get_client()
    rows = client.table("reports").select("*").eq("id", report_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut(**rows[0])


@router.patch(
    "/{report_id}", response_model=ReportOut, dependencies=[Depends(require_admin)]
)
async def update_report_status(report_id: str, update: ReportStatusUpdate) -> ReportOut:
    client = get_client()
    rows = (
        client.table("reports")
        .update({"status": update.status})
        .eq("id", report_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut(**rows[0])
