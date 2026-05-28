from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from config import ROOT_DIR, Settings


def connect(settings: Settings):
    return psycopg.connect(settings.database_url, row_factory=dict_row)


def init_schema(settings: Settings) -> None:
    schema_path = ROOT_DIR / "sql" / "schema.sql"
    with connect(settings) as conn:
        with conn.cursor() as cur:
            cur.execute(schema_path.read_text())
        conn.commit()


def upsert_organization(conn, organization: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO organizations (ein, name, state, ntee_category, source_url, date_pulled, updated_at)
            VALUES (%(ein)s, %(name)s, %(state)s, %(ntee_category)s, %(source_url)s, NOW(), NOW())
            ON CONFLICT (ein) DO UPDATE SET
              name = EXCLUDED.name,
              state = COALESCE(EXCLUDED.state, organizations.state),
              ntee_category = COALESCE(EXCLUDED.ntee_category, organizations.ntee_category),
              source_url = COALESCE(EXCLUDED.source_url, organizations.source_url),
              date_pulled = NOW(),
              updated_at = NOW()
            """,
            organization,
        )


def upsert_filing(conn, filing: dict[str, Any]) -> None:
    payload = dict(filing)
    payload["raw_payload"] = Jsonb(payload.get("raw_payload") or {})
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO filings (
              ein, filing_year, source, total_revenue, total_expenses, net_surplus_deficit,
              assets, liabilities, source_url, filing_url, date_pulled, raw_payload, updated_at
            )
            VALUES (
              %(ein)s, %(filing_year)s, %(source)s, %(total_revenue)s, %(total_expenses)s,
              %(net_surplus_deficit)s, %(assets)s, %(liabilities)s, %(source_url)s,
              %(filing_url)s, NOW(), %(raw_payload)s, NOW()
            )
            ON CONFLICT (ein, filing_year, source) DO UPDATE SET
              total_revenue = EXCLUDED.total_revenue,
              total_expenses = EXCLUDED.total_expenses,
              net_surplus_deficit = EXCLUDED.net_surplus_deficit,
              assets = EXCLUDED.assets,
              liabilities = EXCLUDED.liabilities,
              source_url = EXCLUDED.source_url,
              filing_url = EXCLUDED.filing_url,
              date_pulled = NOW(),
              raw_payload = EXCLUDED.raw_payload,
              updated_at = NOW()
            """,
            payload,
        )


def fetch_filings(conn, ein: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM filings
            WHERE ein = %s
            ORDER BY filing_year DESC
            """,
            (ein,),
        )
        return list(cur.fetchall())


def upsert_lead_score(conn, score: dict[str, Any]) -> None:
    payload = dict(score)
    payload["score_details"] = Jsonb(payload.get("score_details") or {})
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO lead_scores (
              ein, latest_filing_year, latest_revenue, latest_expenses, latest_deficit,
              priority_score, qualifies, eligibility_reason, score_details, scored_at
            )
            VALUES (
              %(ein)s, %(latest_filing_year)s, %(latest_revenue)s, %(latest_expenses)s,
              %(latest_deficit)s, %(priority_score)s, %(qualifies)s, %(eligibility_reason)s,
              %(score_details)s, NOW()
            )
            ON CONFLICT (ein) DO UPDATE SET
              latest_filing_year = EXCLUDED.latest_filing_year,
              latest_revenue = EXCLUDED.latest_revenue,
              latest_expenses = EXCLUDED.latest_expenses,
              latest_deficit = EXCLUDED.latest_deficit,
              priority_score = EXCLUDED.priority_score,
              qualifies = EXCLUDED.qualifies,
              eligibility_reason = EXCLUDED.eligibility_reason,
              score_details = EXCLUDED.score_details,
              scored_at = NOW()
            """,
            payload,
        )


def qualifying_leads(conn) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              o.name AS nonprofit_name,
              o.ein,
              o.state,
              ls.latest_revenue,
              ls.latest_expenses,
              ls.latest_deficit,
              ls.priority_score
            FROM lead_scores ls
            JOIN organizations o ON o.ein = ls.ein
            WHERE ls.qualifies = TRUE
            ORDER BY ls.priority_score DESC, ls.latest_deficit ASC NULLS LAST, o.name ASC
            """
        )
        return list(cur.fetchall())


def insert_export_run(conn, export_type: str, file_path: Path, row_count: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO export_runs (export_type, file_path, row_count)
            VALUES (%s, %s, %s)
            """,
            (export_type, str(file_path), row_count),
        )


def upsert_goodwill_affiliate(conn, affiliate: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO goodwill_affiliates (
              ein, legal_name, common_name, city, state, latest_filing_year,
              latest_revenue, latest_expenses, latest_surplus_deficit,
              total_assets, total_liabilities, source, source_url,
              irs_filing_url, confidence_score, pulled_at
            )
            VALUES (
              %(ein)s, %(legal_name)s, %(common_name)s, %(city)s, %(state)s,
              %(latest_filing_year)s, %(latest_revenue)s, %(latest_expenses)s,
              %(latest_surplus_deficit)s, %(total_assets)s, %(total_liabilities)s,
              %(source)s, %(source_url)s, %(irs_filing_url)s, %(confidence_score)s, NOW()
            )
            ON CONFLICT (ein) DO UPDATE SET
              legal_name = EXCLUDED.legal_name,
              common_name = EXCLUDED.common_name,
              city = COALESCE(EXCLUDED.city, goodwill_affiliates.city),
              state = COALESCE(EXCLUDED.state, goodwill_affiliates.state),
              latest_filing_year = EXCLUDED.latest_filing_year,
              latest_revenue = EXCLUDED.latest_revenue,
              latest_expenses = EXCLUDED.latest_expenses,
              latest_surplus_deficit = EXCLUDED.latest_surplus_deficit,
              total_assets = EXCLUDED.total_assets,
              total_liabilities = EXCLUDED.total_liabilities,
              source = EXCLUDED.source,
              source_url = EXCLUDED.source_url,
              irs_filing_url = COALESCE(EXCLUDED.irs_filing_url, goodwill_affiliates.irs_filing_url),
              confidence_score = EXCLUDED.confidence_score,
              pulled_at = NOW()
            """,
            affiliate,
        )


def ranked_goodwill_affiliates(conn, min_revenue=None, include_medium: bool = False) -> list[dict[str, Any]]:
    confidence_filter = ("high", "medium") if include_medium else ("high",)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              legal_name AS nonprofit_name,
              ein,
              city,
              state,
              latest_filing_year,
              latest_revenue,
              latest_expenses,
              latest_surplus_deficit AS surplus_deficit,
              total_assets,
              total_liabilities,
              source_url,
              confidence_score
            FROM goodwill_affiliates
            WHERE confidence_score = ANY(%s)
              AND (%s::numeric IS NULL OR latest_revenue >= %s::numeric)
            ORDER BY latest_revenue DESC NULLS LAST, legal_name ASC
            """,
            (list(confidence_filter), min_revenue, min_revenue),
        )
        return list(cur.fetchall())
