from __future__ import annotations

import argparse
import logging

from config import load_settings
from db import connect, fetch_filings, init_schema, upsert_filing, upsert_lead_score, upsert_organization
from export import export_leads
from irs_client import IRSClient
from propublica_client import ProPublicaClient
from scoring import score_lead


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("fitproof.lead_discovery")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FitProof internal nonprofit loss lead-discovery ETL")
    parser.add_argument("--source", choices=["propublica", "irs"], help="Primary source to run for this ETL pass.")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum EINs to process.")
    parser.add_argument("--export", choices=["names-only", "full"], help="Export qualifying leads to CSV.")
    parser.add_argument("--init-db", action="store_true", help="Create or update database tables before running.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()

    if args.init_db:
        logger.info("Initializing database schema")
        init_schema(settings)

    with connect(settings) as conn:
        if args.export:
            file_path = export_leads(conn, settings, args.export)
            logger.info("Export complete", extra={"file_path": str(file_path)})
            return

        if not args.source:
            logger.info("No ETL source selected. Use --source propublica to run lead discovery.")
            return

        if args.source == "irs":
            logger.info("IRS-only discovery is not enabled yet. Configure seed EINs and run --source propublica for MVP discovery.")
            return

        process_propublica(conn, settings, args.limit)


def process_propublica(conn, settings, limit: int) -> None:
    propublica = ProPublicaClient(settings)
    irs = IRSClient(settings)
    eins = propublica.discover_eins(limit)
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


if __name__ == "__main__":
    main()
