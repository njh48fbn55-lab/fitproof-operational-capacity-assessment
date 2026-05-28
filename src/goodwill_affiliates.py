from __future__ import annotations

import csv
import logging
import re
from datetime import date
from decimal import Decimal
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import requests

from config import Settings, normalize_ein
from db import insert_export_run, ranked_goodwill_affiliates, upsert_filing, upsert_goodwill_affiliate, upsert_organization
from email_delivery import send_export_email
from irs_client import IRSClient
from propublica_client import ProPublicaClient


logger = logging.getLogger(__name__)

GOODWILL_SEARCH_TERMS = [
    "Goodwill Industries",
    "Goodwill of",
    "Goodwill Easterseals",
    "Easterseals Goodwill",
    "Goodwill Industries of",
]

CSV_COLUMNS = [
    "rank",
    "nonprofit_name",
    "ein",
    "city",
    "state",
    "latest_filing_year",
    "latest_revenue",
    "latest_expenses",
    "surplus_deficit",
    "total_assets",
    "total_liabilities",
    "source_url",
]


def run_goodwill_affiliates(conn, settings: Settings, include_international: bool = False, min_revenue: Decimal | None = None, export: bool = False, full_export: bool = False) -> Path | None:
    propublica = ProPublicaClient(settings)
    irs = IRSClient(settings)
    candidates = discover_goodwill_candidates(propublica, settings)
    logger.info("Discovered Goodwill candidates", extra={"count": len(candidates)})

    affiliates: list[dict[str, Any]] = []
    seen_eins: set[str] = set()

    for candidate in candidates:
        ein = normalize_ein(candidate.get("ein"))
        name = organization_name(candidate)
        if not ein or ein in seen_eins:
            continue
        if should_exclude_candidate(name, include_international):
            continue

        seen_eins.add(ein)
        try:
            organization, propublica_filings = propublica.get_financial_history(ein)
            for filing in propublica_filings:
                upsert_filing(conn, filing)
            irs_filings = irs.lookup_filings(ein)
            for filing in irs_filings:
                upsert_filing(conn, filing)
            upsert_organization(conn, organization)

            latest = latest_filing(propublica_filings + irs_filings)
            if not latest:
                logger.info("Skipping Goodwill candidate with no usable filing", extra={"ein": ein, "name": name})
                continue

            affiliate = build_affiliate(candidate, organization, latest)
            if min_revenue is not None and (affiliate["latest_revenue"] is None or Decimal(str(affiliate["latest_revenue"])) < min_revenue):
                continue
            affiliates.append(affiliate)
        except Exception:
            logger.exception("Failed to process Goodwill candidate", extra={"ein": ein, "name": name})

    for affiliate in dedupe_near_names(affiliates):
        upsert_goodwill_affiliate(conn, affiliate)
    conn.commit()

    if export:
        return export_goodwill_affiliates(conn, settings, min_revenue=min_revenue, include_medium=full_export)
    return None


def discover_goodwill_candidates(propublica: ProPublicaClient, settings: Settings) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    seen: set[str] = set()

    search_terms = GOODWILL_SEARCH_TERMS + goodwill_locator_search_terms(settings)
    for term in search_terms:
        for organization in propublica.search(term):
            ein = normalize_ein(organization.get("ein"))
            name = organization_name(organization)
            if not ein or ein in seen:
                continue
            if not is_goodwill_name(name):
                continue
            seen.add(ein)
            candidates.append(organization)

    return candidates


def goodwill_locator_search_terms(settings: Settings) -> list[str]:
    """Use Goodwill.org as discovery context when available.

    The locator is territory/location oriented, not EIN-level financial truth. We
    only use extracted Goodwill names as extra ProPublica search terms.
    """

    url = "https://www.goodwill.org/locator/"
    try:
        response = requests.get(url, headers={"User-Agent": settings.user_agent}, timeout=settings.http_timeout_seconds)
        if not response.ok:
            return []
        names = set(re.findall(r"(Goodwill(?: Industries)?(?: of| Easterseals| [A-Z][A-Za-z&.,' -]{3,80}))", response.text))
        return sorted(name.strip() for name in names if is_goodwill_name(name))[:100]
    except Exception:
        logger.info("Goodwill locator discovery unavailable; continuing with ProPublica search terms")
        return []


def build_affiliate(candidate: dict[str, Any], organization: dict[str, Any], latest: dict[str, Any]) -> dict[str, Any]:
    legal_name = organization.get("name") or organization_name(candidate)
    return {
        "ein": organization.get("ein") or normalize_ein(candidate.get("ein")),
        "legal_name": legal_name,
        "common_name": common_name(legal_name),
        "city": organization.get("city") or candidate.get("city") or candidate.get("address_city"),
        "state": organization.get("state") or candidate.get("state") or candidate.get("address_state"),
        "latest_filing_year": latest.get("filing_year"),
        "latest_revenue": latest.get("total_revenue"),
        "latest_expenses": latest.get("total_expenses"),
        "latest_surplus_deficit": latest.get("net_surplus_deficit"),
        "total_assets": latest.get("assets"),
        "total_liabilities": latest.get("liabilities"),
        "source": latest.get("source") or "propublica",
        "source_url": organization.get("source_url") or latest.get("source_url"),
        "irs_filing_url": latest.get("filing_url"),
        "confidence_score": confidence_score(legal_name),
    }


def latest_filing(filings: list[dict[str, Any]]) -> dict[str, Any] | None:
    usable = [filing for filing in filings if filing.get("filing_year") and filing.get("total_revenue") is not None]
    if not usable:
        return None
    return sorted(usable, key=lambda item: int(item["filing_year"]), reverse=True)[0]


def export_goodwill_affiliates(conn, settings: Settings, min_revenue: Decimal | None = None, include_medium: bool = False) -> Path:
    rows = ranked_goodwill_affiliates(conn, min_revenue=min_revenue, include_medium=include_medium)
    settings.export_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.export_dir / f"goodwill_affiliates_ranked_by_revenue_{date.today().isoformat()}.csv"

    with file_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow({
                "rank": index,
                "nonprofit_name": row.get("nonprofit_name"),
                "ein": row.get("ein"),
                "city": row.get("city"),
                "state": row.get("state"),
                "latest_filing_year": row.get("latest_filing_year"),
                "latest_revenue": row.get("latest_revenue"),
                "latest_expenses": row.get("latest_expenses"),
                "surplus_deficit": row.get("surplus_deficit"),
                "total_assets": row.get("total_assets"),
                "total_liabilities": row.get("total_liabilities"),
                "source_url": row.get("source_url"),
            })

    insert_export_run(conn, "goodwill-affiliates-full" if include_medium else "goodwill-affiliates", file_path, len(rows))
    conn.commit()
    send_export_email(settings, file_path, "goodwill-affiliates-full" if include_medium else "goodwill-affiliates", len(rows))
    return file_path


def dedupe_near_names(affiliates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    for affiliate in sorted(affiliates, key=lambda item: int(item.get("latest_filing_year") or 0), reverse=True):
        normalized = normalized_name(affiliate.get("legal_name") or "")
        duplicate_index = next(
            (
                index
                for index, existing in enumerate(deduped)
                if SequenceMatcher(None, normalized, normalized_name(existing.get("legal_name") or "")).ratio() >= 0.94
            ),
            None,
        )
        if duplicate_index is None:
            deduped.append(affiliate)
            continue
        if int(affiliate.get("latest_filing_year") or 0) > int(deduped[duplicate_index].get("latest_filing_year") or 0):
            deduped[duplicate_index] = affiliate
    return deduped


def organization_name(organization: dict[str, Any]) -> str:
    return str(organization.get("name") or organization.get("organization_name") or organization.get("legal_name") or "").strip()


def common_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.title()).strip()


def normalized_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


def is_goodwill_name(name: str) -> bool:
    lowered = name.lower()
    return any(term.lower() in lowered for term in GOODWILL_SEARCH_TERMS)


def should_exclude_candidate(name: str, include_international: bool) -> bool:
    lowered = name.lower()
    if not include_international and "goodwill industries international" in lowered:
        return True
    return any(term in lowered for term in ["foundation", "thrift store", "donation center", "retail store", "outlet", "branch"])


def confidence_score(name: str) -> str:
    lowered = name.lower().strip()
    if any(term in lowered for term in ["foundation", "thrift store", "donation center", "retail store", "outlet", "branch"]):
        return "low"
    high_patterns = [
        "goodwill industries",
        "goodwill of",
        "goodwill easterseals",
        "easterseals goodwill",
    ]
    if any(lowered.startswith(pattern) for pattern in high_patterns):
        return "high"
    if "goodwill" in lowered:
        return "medium"
    return "low"
