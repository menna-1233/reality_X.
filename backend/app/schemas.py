from typing import Literal, Optional

from pydantic import BaseModel

ProblemType = Literal[
    "pothole", "garbage", "water_leak", "broken_light", "accident", "other"
]
Severity = Literal["low", "medium", "high", "critical"]
ReportStatus = Literal["open", "in_progress", "resolved"]


class Analysis(BaseModel):
    problem_type: ProblemType
    severity: Severity
    department: str
    confidence: float
    summary: str


class ReportOut(BaseModel):
    id: str
    community_id: str
    incident_id: Optional[str] = None
    image_url: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_text: Optional[str] = None
    problem_type: ProblemType
    severity: Severity
    department: Optional[str] = None
    confidence: Optional[float] = None
    ai_summary: Optional[str] = None
    status: ReportStatus
    created_at: str


class IncidentOut(BaseModel):
    id: str
    community_id: str
    problem_type: ProblemType
    severity: Severity
    status: ReportStatus
    department: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    report_count: int
    first_reported_at: str
    last_reported_at: str


class IncidentUpdate(BaseModel):
    status: ReportStatus


class StatsOut(BaseModel):
    total_reports: int
    open_incidents: int
    by_severity: dict[str, int]
    by_problem_type: dict[str, int]
