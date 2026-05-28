from __future__ import annotations

import csv
import json
import logging
from decimal import Decimal
from pathlib import Path
from typing import Any

import requests

from config import Settings, normalize_ein


logger = logging.getLogger(__name__)


class IRSClient:
    """Secondary validation/backfill client for IRS TEOS/Form 990 bulk-derived data.

    IRS bulk files are large and periodically updated. For droplet stability, this
    MVP supports either a local CSV/JSONL file or a configured index URL. The ETL
    treats IRS values as validation/backfill and keeps ProPublica as the first MVP
    retrieval path.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    def lookup_filings(self, ein: str) -> list[dict[str, Any]]:
        normalized = normalize_ein(ein)
        if not normalized:
            return []
        if self.settings.irs_bulk_local_path:
            return self._lookup_local_file(normalized, Path(self.settings.irs_bulk_local_path))
        if self.settings.irs_bulk_index_url:
            logger.info("IRS bulk index URL configured; direct object lookup is not enabled in MVP", extra={"ein": normalized})
        return []

    def _lookup_local_file(self, ein: str, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            logger.warning("IRS local bulk file not found", extra={"path": str(path)})
            return []

        if path.suffix.lower() == ".jsonl":
            return self._lookup_jsonl(ein, path)
        return self._lookup_csv(ein, path)

    def _lookup_jsonl(self, ein: str, path: Path) -> list[dict[str, Any]]:
        filings: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if normalize_ein(row.get("ein")) == ein:
                    filings.append(normalize_irs_row(ein, row))
        return filings

    def _lookup_csv(self, ein: str, path: Path) -> list[dict[str, Any]]:
        filings: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if normalize_ein(row.get("ein") or row.get("EIN")) == ein:
                    filings.append(normalize_irs_row(ein, row))
        return filings


def normalize_irs_row(ein: str, row: dict[str, Any]) -> dict[str, Any]:
    revenue = decimal_value(row.get("total_revenue") or row.get("totrevenue"))
    expenses = decimal_value(row.get("total_expenses") or row.get("totfuncexpns") or row.get("totexpenses"))
    return {
        "ein": ein,
        "filing_year": int_value(row.get("filing_year") or row.get("tax_prd_yr") or row.get("tax_year")),
        "source": "irs_bulk",
        "total_revenue": revenue,
        "total_expenses": expenses,
        "net_surplus_deficit": revenue - expenses if revenue is not None and expenses is not None else None,
        "assets": decimal_value(row.get("assets") or row.get("totassetsend")),
        "liabilities": decimal_value(row.get("liabilities") or row.get("totliabend")),
        "source_url": row.get("source_url") or "IRS TEOS/Form 990 bulk data",
        "filing_url": row.get("filing_url") or row.get("object_url"),
        "raw_payload": row,
    }


def decimal_value(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except Exception:
        return None


def int_value(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(str(value)[:4])
        return parsed if parsed > 1900 else None
    except Exception:
        return None
