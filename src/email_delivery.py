from __future__ import annotations

import base64
import logging
from pathlib import Path

import requests

from config import Settings


logger = logging.getLogger(__name__)


def send_export_email(settings: Settings, file_path: Path, export_type: str, row_count: int) -> bool:
    if not settings.resend_api_key:
        logger.warning("Lead export email skipped because RESEND_API_KEY is not configured")
        return False

    attachment_content = base64.b64encode(file_path.read_bytes()).decode("ascii")
    subject = f"FitProof Nonprofit Loss Leads Export: {file_path.name}"
    body = (
        f"Your FitProof nonprofit loss lead export is attached.\n\n"
        f"Export type: {export_type}\n"
        f"Rows: {row_count}\n"
        f"File: {file_path.name}\n\n"
        "This is an internal FitProof lead-discovery export."
    )

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.lead_export_email_from,
            "to": [settings.lead_export_email_to],
            "subject": subject,
            "text": body,
            "attachments": [
                {
                    "filename": file_path.name,
                    "content": attachment_content,
                }
            ],
        },
        timeout=settings.http_timeout_seconds,
    )

    if response.status_code >= 400:
        logger.error(
            "Lead export email failed",
            extra={"status_code": response.status_code, "response": response.text[:500]},
        )
        return False

    logger.info("Lead export email sent", extra={"to": settings.lead_export_email_to, "file": str(file_path)})
    return True
