"""Department email notifications, sent via Gmail SMTP.

Each report's AI analysis assigns a `department` (e.g. "إدارة الصيانة
والطرق"). This module maps the report's `problem_type` to a department
email address and sends a notification the moment a report is created —
so the responsible team is alerted immediately, without checking a
dashboard.

Setup (Gmail, for real production sending):
    1. Enable 2-Step Verification on the Gmail account.
    2. Create an App Password: https://myaccount.google.com/apppasswords
    3. Set in backend/.env:
        SMTP_ENABLED=true
        SMTP_EMAIL=your_email@gmail.com
        SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx   (16-char app password)

Setup (Ethereal, for testing without a real mailbox):
    Ethereal (https://ethereal.email) gives you a disposable SMTP inbox —
    emails "sent" through it never leave Ethereal, but you can log in at
    ethereal.email/messages with the same user/pass and read them.
        SMTP_ENABLED=true
        SMTP_HOST=smtp.ethereal.email
        SMTP_PORT=587
        SMTP_USE_SSL=false
        SMTP_EMAIL=<ethereal user>
        SMTP_APP_PASSWORD=<ethereal pass>

If SMTP is disabled or misconfigured, notifications are silently
skipped — this must never break report creation.
"""

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .schemas import ProblemType
from .settings import settings

logger = logging.getLogger(__name__)

# Default department inboxes, keyed by problem_type. Override per-deployment
# with DEPARTMENT_EMAILS in .env (JSON object), e.g.:
#   DEPARTMENT_EMAILS={"pothole": "roads@city.gov", "garbage": "clean@city.gov"}
_DEFAULT_DEPARTMENT_EMAILS: dict[ProblemType, str] = {
    "pothole": "maintenance-test@example.com",
    "garbage": "cleaning-test@example.com",
    "water_leak": "maintenance-test@example.com",
    "broken_light": "electricity-test@example.com",
    "accident": "security-test@example.com",
    "other": "general-test@example.com",
}


def _department_emails() -> dict[str, str]:
    if not settings.department_emails:
        return _DEFAULT_DEPARTMENT_EMAILS
    try:
        overrides = json.loads(settings.department_emails)
        return {**_DEFAULT_DEPARTMENT_EMAILS, **overrides}
    except (json.JSONDecodeError, TypeError):
        logger.warning("DEPARTMENT_EMAILS is not valid JSON, using defaults")
        return _DEFAULT_DEPARTMENT_EMAILS


def _recipient_for(problem_type: str) -> str:
    # A configured test recipient overrides real department routing, so every
    # notification lands in one inbox you can actually check (e.g. an
    # Ethereal test inbox, or your own email) while trying the feature out.
    if settings.test_recipient_email:
        return settings.test_recipient_email
    return _department_emails().get(problem_type, _DEFAULT_DEPARTMENT_EMAILS["other"])


_SEVERITY_AR = {"low": "منخفضة", "medium": "متوسطة", "high": "عالية", "critical": "حرجة"}


def _build_email_body(report: dict) -> str:
    severity_ar = _SEVERITY_AR.get(report.get("severity", ""), report.get("severity", ""))
    return f"""بلاغ جديد يحتاج مراجعة من إدارتكم

الإدارة المسؤولة: {report.get('department') or 'غير محدد'}
درجة الخطورة: {severity_ar}
الوصف المرسل من المواطن: {report.get('description') or 'بدون وصف'}
الموقع: {report.get('location_text') or 'غير محدد'}
ملخص الذكاء الاصطناعي: {report.get('ai_summary') or ''}

رابط صورة البلاغ: {report.get('image_url') or ''}
رقم البلاغ: {report.get('id') or ''}

---
تم الإرسال تلقائياً بواسطة نظام UrbanEye AI
"""


def send_department_notification(report: dict) -> bool:
    """Email the department responsible for `report`'s problem type.

    Returns True if the email was sent, False if skipped or failed.
    Never raises — a broken/unconfigured mailer must never break report
    creation.
    """
    if not settings.smtp_enabled:
        logger.info("SMTP_ENABLED=false, skipping department email")
        return False

    to_email = _recipient_for(report.get("problem_type", "other"))

    if not settings.smtp_email or not settings.smtp_app_password:
        # Dry-run mode: no real Gmail account configured yet. Print the
        # email that *would* be sent so the routing logic can be verified
        # end-to-end before wiring up real SMTP credentials.
        logger.info(
            "[DRY RUN - no SMTP credentials] Would email %s:\n%s",
            to_email,
            _build_email_body(report),
        )
        return False

    try:
        msg = MIMEMultipart()
        # Display name shown to the recipient. The technical sending address
        # still has to be a real, authenticated mailbox (Gmail/SES/etc.) --
        # this just makes it *read* as coming from the app, not a person.
        msg["From"] = f"UrbanEye AI <{settings.smtp_email}>"
        msg["To"] = to_email
        msg["Subject"] = (
            f"بلاغ جديد - {report.get('department') or 'إدارة عامة'} "
            f"(خطورة: {_SEVERITY_AR.get(report.get('severity', ''), '')})"
        )
        msg.attach(MIMEText(_build_email_body(report), "plain", "utf-8"))

        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
                server.login(settings.smtp_email, settings.smtp_app_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_email, settings.smtp_app_password)
                server.send_message(msg)

        logger.info("Department email sent to %s for report %s", to_email, report.get("id"))
        return True
    except Exception:  # noqa: BLE001 - a mail failure must never break the request
        logger.exception("Failed to send department notification email")
        return False
