from __future__ import annotations

import csv
import logging
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests

from config import ROOT_DIR, Settings, normalize_ein


logger = logging.getLogger(__name__)

DEFAULT_NTEE_PREFIXES = (
    "E",  # Health
    "F",  # Mental health and crisis intervention
    "G",  # Disease, disorders, medical disciplines
    "I",  # Crime and legal-related
    "J",  # Employment
    "K",  # Food, agriculture, nutrition
    "L",  # Housing and shelter
    "M",  # Public safety, disaster preparedness
    "P",  # Human services
    "S",  # Community improvement
    "T",  # Philanthropy / nonprofit infrastructure
)


@dataclass(frozen=True)
class SeedBuildResult:
    ein_file: Path
    detail_file: Path
    row_count: int
    source_count: int


class CsvLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attrs_map = dict(attrs)
        href = attrs_map.get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.links.append((self._href, " ".join(self._text).strip()))
            self._href = None
            self._text = []


def build_irs_eo_bmf_seed_list(
    settings: Settings,
    limit: int,
    min_revenue: int,
    max_revenue: int,
    ntee_prefixes: tuple[str, ...] = DEFAULT_NTEE_PREFIXES,
    regions: tuple[str, ...] = ("region 1", "region 2", "region 3"),
) -> SeedBuildResult:
    output_dir = ROOT_DIR / "seeds"
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()
    ein_file = output_dir / f"irs-eo-bmf-seed-eins-{stamp}.txt"
    detail_file = output_dir / f"irs-eo-bmf-seed-details-{stamp}.csv"

    source_urls = discover_eo_bmf_csv_urls(settings, regions=regions)
    logger.info("Discovered IRS EO BMF source files", extra={"count": len(source_urls), "regions": regions})

    seen: set[str] = set()
    details: list[dict[str, Any]] = []

    for url in source_urls:
        if len(details) >= limit:
            break
        logger.info("Downloading IRS EO BMF source", extra={"url": url})
        for row in iter_csv_url(settings, url):
            if len(details) >= limit:
                break
            if not row_matches_target(row, min_revenue, max_revenue, ntee_prefixes):
                continue
            ein = normalize_ein(value_for(row, "EIN"))
            if not ein or ein in seen:
                continue
            seen.add(ein)
            details.append(normalize_seed_row(ein, row, url))

    with ein_file.open("w", encoding="utf-8") as handle:
        for row in details:
            handle.write(f"{row['ein']}\n")

    columns = [
        "ein",
        "name",
        "city",
        "state",
        "subsection",
        "ntee_code",
        "income_amount",
        "revenue_amount",
        "asset_amount",
        "source_url",
    ]
    with detail_file.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in details:
            writer.writerow({column: row.get(column) for column in columns})

    logger.info("IRS EO BMF seed list built", extra={"ein_file": str(ein_file), "rows": len(details)})
    return SeedBuildResult(ein_file=ein_file, detail_file=detail_file, row_count=len(details), source_count=len(source_urls))


def discover_eo_bmf_csv_urls(settings: Settings, regions: tuple[str, ...]) -> list[str]:
    response = requests.get(
        settings.irs_eo_bmf_url,
        headers={"User-Agent": settings.user_agent},
        timeout=settings.http_timeout_seconds,
    )
    response.raise_for_status()

    parser = CsvLinkParser()
    parser.feed(response.text)

    requested = tuple(item.lower().strip() for item in regions)
    urls: list[str] = []
    for href, text in parser.links:
        label = text.lower()
        href_lower = href.lower()
        if ".csv" not in href_lower and "csv" not in label:
            continue
        if requested and not any(region in label for region in requested):
            continue
        urls.append(urljoin(settings.irs_eo_bmf_url, href))

    if not urls:
        raise RuntimeError("No IRS EO BMF CSV links were found for the requested regions.")
    return urls


def iter_csv_url(settings: Settings, url: str):
    with requests.get(
        url,
        headers={"User-Agent": settings.user_agent},
        timeout=settings.http_timeout_seconds,
        stream=True,
    ) as response:
        response.raise_for_status()
        lines = response.iter_lines(decode_unicode=True)
        reader = csv.DictReader(line for line in lines if line)
        yield from reader


def row_matches_target(row: dict[str, Any], min_revenue: int, max_revenue: int, ntee_prefixes: tuple[str, ...]) -> bool:
    subsection = value_for(row, "SUBSECTION")
    if subsection and subsection.zfill(2) != "03":
        return False

    revenue = int_value(value_for(row, "REVENUE_AMT") or value_for(row, "INCOME_AMT"))
    if revenue is None or revenue < min_revenue or revenue > max_revenue:
        return False

    ntee = (value_for(row, "NTEE_CD") or "").upper()
    if ntee_prefixes and ntee and not ntee.startswith(ntee_prefixes):
        return False

    return True


def normalize_seed_row(ein: str, row: dict[str, Any], source_url: str) -> dict[str, Any]:
    return {
        "ein": ein,
        "name": value_for(row, "NAME"),
        "city": value_for(row, "CITY"),
        "state": value_for(row, "STATE"),
        "subsection": value_for(row, "SUBSECTION"),
        "ntee_code": value_for(row, "NTEE_CD"),
        "income_amount": value_for(row, "INCOME_AMT"),
        "revenue_amount": value_for(row, "REVENUE_AMT"),
        "asset_amount": value_for(row, "ASSET_AMT"),
        "source_url": source_url,
    }


def value_for(row: dict[str, Any], key: str) -> str:
    for candidate in (key, key.lower(), key.title()):
        value = row.get(candidate)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def int_value(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except Exception:
        return None
