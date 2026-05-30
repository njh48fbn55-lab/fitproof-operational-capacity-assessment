from __future__ import annotations

import logging
import time
from decimal import Decimal
from typing import Any

import requests
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from config import Settings, normalize_ein


logger = logging.getLogger(__name__)


class ProPublicaClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": settings.user_agent, "Accept": "application/json"})
        self._last_request_at = 0.0

    def discover_eins(self, limit: int, exclude_eins: set[str] | None = None) -> list[str]:
        found: list[str] = []
        seen: set[str] = set(exclude_eins or set())

        for ein in self.settings.seed_eins + self._seed_eins_from_file():
            normalized = normalize_ein(ein)
            if normalized and normalized not in seen:
                seen.add(normalized)
                found.append(normalized)
                if len(found) >= limit:
                    return found

        for term in self.settings.search_terms:
            if len(found) >= limit:
                break
            for organization in self.search(term):
                normalized = normalize_ein(organization.get("ein"))
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    found.append(normalized)
                    if len(found) >= limit:
                        break

        return found[:limit]

    def search(self, query: str) -> list[dict[str, Any]]:
        logger.info("Searching ProPublica Nonprofit Explorer", extra={"query": query})
        results: list[dict[str, Any]] = []
        page = 0
        while True:
            data = self._get("/search.json", params={"q": query, "page": page})
            organizations = data.get("organizations") or []
            results.extend(organizations)
            num_pages = int(data.get("num_pages") or 0)
            if page >= num_pages or not organizations:
                break
            page += 1
        return results

    def get_financial_history(self, ein: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        normalized_ein = normalize_ein(ein)
        if not normalized_ein:
            raise ValueError(f"Invalid EIN: {ein}")

        data = self._get(f"/organizations/{normalized_ein}.json")
        organization = data.get("organization") or {}
        filings = data.get("filings_with_data") or data.get("filings") or []
        org = self._normalize_organization(normalized_ein, organization)
        normalized_filings = [self._normalize_filing(normalized_ein, filing) for filing in filings]
        return org, [filing for filing in normalized_filings if filing["filing_year"] is not None]

    def _seed_eins_from_file(self) -> list[str]:
        if not self.settings.seed_ein_file:
            return []
        try:
            with open(self.settings.seed_ein_file, "r", encoding="utf-8") as handle:
                return [line.strip() for line in handle if line.strip()]
        except FileNotFoundError:
            logger.warning("Seed EIN file not found", extra={"path": self.settings.seed_ein_file})
            return []

    def _normalize_organization(self, ein: str, organization: dict[str, Any]) -> dict[str, Any]:
        return {
            "ein": ein,
            "name": organization.get("name") or organization.get("organization_name") or f"EIN {ein}",
            "state": organization.get("state") or organization.get("address_state"),
            "city": organization.get("city") or organization.get("address_city"),
            "ntee_category": organization.get("ntee_code") or organization.get("ntee_category"),
            "source_url": organization.get("propublica_url") or f"https://projects.propublica.org/nonprofits/organizations/{ein}",
        }

    def _normalize_filing(self, ein: str, filing: dict[str, Any]) -> dict[str, Any]:
        revenue = money(first_value(filing, ["totrevenue", "total_revenue", "revenue", "totalrevenue"]))
        expenses = money(first_value(filing, ["totfuncexpns", "totexpenses", "total_expenses", "expenses", "totexpns"]))
        net = None
        if revenue is not None and expenses is not None:
            net = revenue - expenses

        filing_url = first_value(filing, ["pdf_url", "html_url", "filing_url", "object_url"])
        year = int_or_none(first_value(filing, ["tax_prd_yr", "tax_prd", "filing_year", "year"]))
        if year and year > 9999:
            year = int(str(year)[:4])

        return {
            "ein": ein,
            "filing_year": year,
            "source": "propublica",
            "total_revenue": revenue,
            "total_expenses": expenses,
            "net_surplus_deficit": net,
            "assets": money(first_value(filing, ["totassetsend", "total_assets", "assets"])),
            "liabilities": money(first_value(filing, ["totliabend", "total_liabilities", "liabilities"])),
            "source_url": f"https://projects.propublica.org/nonprofits/organizations/{ein}",
            "filing_url": filing_url,
            "raw_payload": filing,
        }

    @retry(
        retry=retry_if_exception_type((requests.RequestException, RuntimeError)),
        wait=wait_exponential(multiplier=1, min=1, max=20),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self._rate_limit()
        url = f"{self.settings.propublica_base_url}{path}"
        try:
            response = self.session.get(url, params=params, timeout=self.settings.http_timeout_seconds)
            if response.status_code >= 500 or response.status_code == 429:
                raise RuntimeError(f"ProPublica transient error {response.status_code}: {response.text[:200]}")
            if response.status_code >= 400:
                logger.warning("ProPublica request failed", extra={"url": url, "status_code": response.status_code})
                response.raise_for_status()
            return response.json()
        except Exception:
            logger.exception("ProPublica API failure", extra={"url": url, "params": params})
            raise

    def _rate_limit(self) -> None:
        if self.settings.requests_per_second <= 0:
            return
        min_interval = 1 / self.settings.requests_per_second
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self._last_request_at = time.monotonic()


def first_value(payload: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return None


def money(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except Exception:
        return None


def int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(str(value)[:4])
    except Exception:
        return None
