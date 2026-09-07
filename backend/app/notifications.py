"""Resident-facing alerts.

MVP: writes a row to `notifications` (which a real push/SMS/email sender
would later pick up and deliver) whenever a report is critical, or an
incident accumulates enough independent reports to matter.
"""

from .db import get_client
from .schemas import ProblemType, Severity
from .settings import settings


def maybe_notify(
    *,
    community_id: str,
    incident_id: str,
    problem_type: ProblemType,
    severity: Severity,
    report_count: int,
) -> bool:
    should_notify = severity == "critical" or (
        report_count == settings.notify_report_count_threshold
    )
    if not should_notify:
        return False

    if severity == "critical":
        message = f"⚠️ بلاغ حرج: تم رصد مشكلة ({problem_type}) تحتاج تدخلاً فورياً."
    else:
        message = (
            f"تنبيه: {report_count} بلاغات مستقلة عن نفس المشكلة ({problem_type}) "
            "في محيطك — الإدارة تمت إفادتها."
        )

    get_client().table("notifications").insert(
        {
            "community_id": community_id,
            "incident_id": incident_id,
            "message": message,
            "severity": severity,
        }
    ).execute()
    return True
