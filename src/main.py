from __future__ import annotations

import argparse
import logging
from datetime import datetime, timezone
from decimal import Decimal

from config import load_settings
from db import connect, fetch_filings, fetch_scored_eins, init_schema, upsert_filing, upsert_lead_score, upsert_organization
from export import export_leads
from goodwill_affiliates import run_goodwill_affiliates
from irs_client import IRSClient
from propublica_client import ProPublicaClient
from scoring import score_lead


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("fitproof.lead_discovery")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FitProof internal nonprofit loss lead-discovery ETL")
    parser.add_argument("--source", choices=["propublica", "irs"], help="Primary source to run for this ETL pass.")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum EINs to process.")
    parser.add_argument("--export", nargs="?", const="names-only", choices=["names-only", "full"], help="Export qualifying leads to CSV. Use --export full for internal columns or medium-confidence Goodwill review rows.")
    parser.add_argument("--daily-loss-export", action="store_true", help="Run discovery, score leads, export the CSV, and email it in one command.")
    parser.add_argument("--init-db", action="store_true", help="Create or update database tables before running.")
    parser.add_argument("--goodwill-affiliates", action="store_true", help="Build or export the Goodwill affiliate revenue ranking.")
    parser.add_argument("--include-international", action="store_true", help="Include Goodwill Industries International in Goodwill affiliate ranking.")
    parser.add_argument("--min-revenue", type=Decimal, help="Minimum latest revenue for Goodwill affiliate ranking.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()

    if args.init_db or args.daily_loss_export:
        logger.info("Initializing database schema")
        init_schema(settings)

    with connect(settings) as conn:
        if args.daily_loss_export:
            run_daily_loss_export(conn, settings, args)
            return

        if args.goodwill_affiliates:
            file_path = run_goodwill_affiliates(
                conn,
                settings,
                include_international=args.include_international,
                min_revenue=args.min_revenue,
                export=args.export is not None,
                full_export=args.export == "full",
            )
            if file_path:
                logger.info("Goodwill affiliate export complete", extra={"file_path": str(file_path)})
            else:
                logger.info("Goodwill affiliate ranking updated")
            return

        if args.export:
            file_path = export_leads(conn, settings, args.export)
            logger.info("Export complete", extra={"file_path": str(file_path)})
            return

        if not args.source:
            logger.info("No ETL source selected. Use --source propublica to run lead discovery.")
            return

        if args.source == "irs":
            process_irs(conn, settings, args.limit)
            return

        process_propublica(conn, settings, args.limit)


def run_daily_loss_export(conn, settings, args: argparse.Namespace) -> None:
    source = args.source or "propublica"
    export_type = args.export or "names-only"
    run_started_at = datetime.now(timezone.utc)

    try:
        if source == "irs":
            process_irs(conn, settings, args.limit, skip_existing=True)
        else:
            process_propublica(conn, settings, args.limit, skip_existing=True)
    except Exception:
        conn.rollback()
        logger.exception("Daily discovery step failed; exporting existing qualifying leads from database")

    file_path = export_leads(conn, settings, export_type, scored_since=run_started_at)
    logger.info("Daily nonprofit loss export complete", extra={"file_path": str(file_path), "export_type": export_type})


def process_propublica(conn, settings, limit: int, skip_existing: bool = False) -> None:
    propublica = ProPublicaClient(settings)
    irs = IRSClient(settings)
    exclude_eins = fetch_scored_eins(conn) if skip_existing else set()
    if exclude_eins:
        logger.info("Skipping EINs that were already scored", extra={"count": len(exclude_eins)})
    eins = propublica.discover_eins(limit, exclude_eins=exclude_eins)
    logger.info("Discovered EIN candidates", extra={"count": len(eins)})

    for index, ein in enumerate(eins, start=1):
        try:
            logger.info("Processing EIN", extra={"ein": ein, "index": index, "total": len(eins)})
            organization, propublica_filings = propublica.get_financial_history(ein)
            upsert_organization(conn, organization)

            for filing in propublica_filings:
                upsert_filing(conn, filing)

            for filing in irs.lookup_filings(ein):
                upsert_filing(conn, filing)

            filings = fetch_filings(conn, ein)
            score = score_lead(ein, filings)
            upsert_lead_score(conn, score)
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("Failed to process EIN", extra={"ein": ein})


def process_irs(conn, settings, limit: int, skip_existing: bool = False) -> None:
    irs = IRSClient(settings)
    exclude_eins = fetch_scored_eins(conn) if skip_existing else set()
    if exclude_eins:
        logger.info("Skipping IRS EINs that were already scored", extra={"count": len(exclude_eins)})
    records_by_ein = irs.load_local_records(limit, exclude_eins=exclude_eins)
    if not records_by_ein:
        logger.warning("No IRS records loaded. Set IRS_BULK_LOCAL_PATH or use --source propublica.")
        return

    logger.info("Loaded IRS EIN candidates", extra={"count": len(records_by_ein)})
    for index, (ein, payload) in enumerate(records_by_ein.items(), start=1):
        try:
            logger.info("Processing IRS EIN", extra={"ein": ein, "index": index, "total": len(records_by_ein)})
            upsert_organization(conn, payload["organization"])
            for filing in payload["filings"]:
                upsert_filing(conn, filing)
            filings = fetch_filings(conn, ein)
            score = score_lead(ein, filings)
            upsert_lead_score(conn, score)
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("Failed to process IRS EIN", extra={"ein": ein})


if __name__ == "__main__":
    main()
