"""Incident grouping: link similar reports together instead of leaving
them as scattered complaints.

MVP rule: a new report joins an existing OPEN incident of the same
problem_type if it's within RADIUS_METERS and reported within
TIME_WINDOW_HOURS of the incident's last report. Otherwise it starts a
new incident.
"""

import math
from datetime import datetime, timedelta, timezone

from .db import get_client
from .schemas import ProblemType, Severity

RADIUS_METERS = 80
TIME_WINDOW_HOURS = 48

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def find_or_create_incident(
    *,
    community_id: str,
    problem_type: ProblemType,
    severity: Severity,
    department: str | None,
    latitude: float | None,
    longitude: float | None,
) -> str:
    """Returns the incident_id a new report should be attached to."""
    client = get_client()

    candidates = (
        client.table("incidents")
        .select("id, severity, latitude, longitude, report_count, last_reported_at")
        .eq("community_id", community_id)
        .eq("problem_type", problem_type)
        .neq("status", "resolved")
        .execute()
        .data
    )

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=TIME_WINDOW_HOURS)

    for incident in candidates:
        last_reported = datetime.fromisoformat(incident["last_reported_at"])
        if last_reported < cutoff:
            continue
        if latitude is None or longitude is None:
            # No location on either side to compare — group by recency only.
            match = incident["latitude"] is None
        else:
            if incident["latitude"] is None or incident["longitude"] is None:
                match = False
            else:
                distance = _haversine_meters(
                    latitude, longitude, incident["latitude"], incident["longitude"]
                )
                match = distance <= RADIUS_METERS
        if not match:
            continue

        new_severity = incident["severity"]
        if _SEVERITY_RANK[severity] > _SEVERITY_RANK[new_severity]:
            new_severity = severity

        client.table("incidents").update(
            {
                "report_count": incident["report_count"] + 1,
                "last_reported_at": now.isoformat(),
                "severity": new_severity,
            }
        ).eq("id", incident["id"]).execute()
        return incident["id"]

    created = (
        client.table("incidents")
        .insert(
            {
                "community_id": community_id,
                "problem_type": problem_type,
                "severity": severity,
                "department": department,
                "latitude": latitude,
                "longitude": longitude,
                "report_count": 1,
                "first_reported_at": now.isoformat(),
                "last_reported_at": now.isoformat(),
            }
        )
        .execute()
        .data
    )
    return created[0]["id"]
