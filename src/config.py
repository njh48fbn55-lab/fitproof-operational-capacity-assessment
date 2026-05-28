from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]


def _csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    propublica_base_url: str
    irs_bulk_local_path: str | None
    irs_bulk_index_url: str | None
    search_terms: list[str]
    seed_eins: list[str]
    seed_ein_file: str | None
    export_dir: Path
    requests_per_second: float
    http_timeout_seconds: int
    http_retry_attempts: int
    user_agent: str
    resend_api_key: str | None
    lead_export_email_to: str
    lead_export_email_from: str


def load_settings() -> Settings:
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required. Add it to .env or .env.local.")

    return Settings(
        database_url=database_url,
        propublica_base_url=os.getenv("PROPUBLICA_BASE_URL", "https://projects.propublica.org/nonprofits/api/v2").rstrip("/"),
        irs_bulk_local_path=os.getenv("IRS_BULK_LOCAL_PATH") or None,
        irs_bulk_index_url=os.getenv("IRS_BULK_INDEX_URL") or None,
        search_terms=_csv(os.getenv("LEAD_DISCOVERY_SEARCH_TERMS")),
        seed_eins=_csv(os.getenv("LEAD_DISCOVERY_SEED_EINS")),
        seed_ein_file=os.getenv("LEAD_DISCOVERY_SEED_EIN_FILE") or None,
        export_dir=ROOT_DIR / os.getenv("EXPORT_DIR", "exports"),
        requests_per_second=float(os.getenv("REQUESTS_PER_SECOND", "2")),
        http_timeout_seconds=int(os.getenv("HTTP_TIMEOUT_SECONDS", "30")),
        http_retry_attempts=int(os.getenv("HTTP_RETRY_ATTEMPTS", "3")),
        user_agent=os.getenv("FITPROOF_USER_AGENT", "FitProofLeadDiscovery/0.1"),
        resend_api_key=os.getenv("RESEND_API_KEY") or None,
        lead_export_email_to=os.getenv("LEAD_EXPORT_EMAIL_TO") or os.getenv("ASSESSMENT_NOTIFICATION_EMAIL") or "sean@fit-proof.com",
        lead_export_email_from=os.getenv("LEAD_EXPORT_EMAIL_FROM") or os.getenv("ASSESSMENT_NOTIFICATION_FROM") or "FitProof Leads <assessments@fit-proof.com>",
    )


def normalize_ein(ein: str | int | None) -> str | None:
    if ein is None:
        return None
    digits = "".join(ch for ch in str(ein) if ch.isdigit())
    return digits.zfill(9) if digits else None
