from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from dataclasses import replace
from datetime import datetime, timezone
from decimal import Decimal

from config import ROOT_DIR, load_settings
from db import connect, fetch_filings, fetch_scored_eins, init_schema, upsert_filing, upsert_lead_score, upsert_organization
from export import export_leads
from goodwill_affiliates import run_goodwill_affiliates
from irs_client import IRSClient
from propublica_client import ProPublicaClient
from scoring import score_lead
from seed_list import DEFAULT_NTEE_PREFIXES, build_irs_eo_bmf_seed_list


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("fitproof.lead_discovery")


@dataclass
class DiscoveryStats:
    source: str
    candidates: int = 0
    skipped_existing: int = 0
    processed: int = 0
    failed: int = 0
    seed_file: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="FitProof internal nonprofit loss lead-discovery ETL")
    parser.add_argument("--source", choices=["propublica", "irs"], help="Primary source to run for this ETL pass.")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum EINs to process.")
    parser.add_argument("--export", nargs="?", const="names-only", choices=["names-only", "full"], help="Export qualifying leads to CSV. Use --export full for internal columns or medium-confidence Goodwill review rows.")
    parser.add_argument("--daily-loss-export", action="store_true", help="Run discovery, score leads, export the CSV, and email it in one command.")
    parser.add_argument("--daily-export-all-on-empty", action="store_true", help="When no newly qualified leads are found, export all currently qualified leads instead of an empty CSV.")
    parser.add_argument("--init-db", action="store_true", help="Create or update database tables before running.")
    parser.add_argument("--goodwill-affiliates", action="store_true", help="Build or export the Goodwill affiliate revenue ranking.")
    parser.add_argument("--include-international", action="store_true", help="Include Goodwill Industries International in Goodwill affiliate ranking.")
    parser.add_argument("--min-revenue", type=Decimal, help="Minimum latest revenue for Goodwill affiliate ranking.")
    parser.add_argument("--build-irs-seed-list", action="store_true", help="Download IRS EO BMF data and build a target EIN seed file.")
    parser.add_argument("--seed-limit", type=int, default=50000, help="Maximum EINs to write to the IRS seed list.")
    parser.add_argument("--seed-min-revenue", type=int, default=10000000, help="Minimum EO BMF revenue/income for seed list candidates.")
    parser.add_argument("--seed-max-revenue", type=int, default=100000000, help="Maximum EO BMF revenue/income for seed list candidates.")
    parser.add_argument("--seed-regions", default="region 1,region 2,region 3", help="Comma-separated IRS EO BMF regions to download. Default excludes international/other.")
    parser.add_argument("--seed-ntee-prefixes", default=",".join(DEFAULT_NTEE_PREFIXES), help="Comma-separated NTEE prefixes to include. Empty means all NTEE codes.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()

    if args.build_irs_seed_list:
        regions = tuple(item.strip().lower() for item in args.seed_regions.split(",") if item.strip())
        ntee_prefixes = tuple(item.strip().upper() for item in args.seed_ntee_prefixes.split(",") if item.strip())
        result = build_irs_eo_bmf_seed_list(
            settings,
            limit=args.seed_limit,
            min_revenue=args.seed_min_revenue,
            max_revenue=args.seed_max_revenue,
            ntee_prefixes=ntee_prefixes,
            regions=regions,
        )
        logger.info(
            "IRS seed list complete",
            extra={"ein_file": str(result.ein_file), "detail_file": str(result.detail_file), "rows": result.row_count},
        )
        return

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
    stats = DiscoveryStats(source=source)

    try:
        if source == "irs":
            stats = process_irs(conn, settings, args.limit, skip_existing=True)
        else:
            if should_build_daily_seed_file(settings):
                seed_file = latest_generated_seed_file()
                if not seed_file:
                    seed_result = build_irs_eo_bmf_seed_list(
                        settings,
                        limit=max(args.limit, args.seed_limit),
                        min_revenue=args.seed_min_revenue,
                        max_revenue=args.seed_max_revenue,
                        ntee_prefixes=tuple(item.strip().upper() for item in args.seed_ntee_prefixes.split(",") if item.strip()),
                        regions=tuple(item.strip().lower() for item in args.seed_regions.split(",") if item.strip()),
                    )
                    seed_file = seed_result.ein_file
                    logger.info("Daily discovery generated IRS EO BMF seed list", extra={"seed_file": str(seed_file), "rows": seed_result.row_count})
                settings = replace(settings, seed_ein_file=str(seed_file))
                logger.info("Daily discovery using IRS EO BMF seed list", extra={"seed_file": str(seed_file)})
            stats = process_propublica(conn, settings, args.limit, skip_existing=True)
    except Exception:
        conn.rollback()
        logger.exception("Daily discovery step failed; exporting existing qualifying leads from database")

    file_path = export_leads(
        conn,
        settings,
        export_type,
        scored_since=run_started_at,
        fallback_to_all=args.daily_export_all_on_empty,
        run_summary=stats.__dict__,
    )
    logger.info("Daily nonprofit loss export complete", extra={"file_path": str(file_path), "export_type": export_type})


def should_build_daily_seed_file(settings) -> bool:
    return settings.auto_build_seed_list and not settings.seed_eins and not settings.seed_ein_file


def latest_generated_seed_file():
    seed_dir = ROOT_DIR / "seeds"
    return max(seed_dir.glob("irs-eo-bmf-seed-eins-*.txt"), default=None)


def process_propublica(conn, settings, limit: int, skip_existing: bool = False) -> DiscoveryStats:
    propublica = ProPublicaClient(settings)
    irs = IRSClient(settings)
    exclude_eins = fetch_scored_eins(conn) if skip_existing else set()
    stats = DiscoveryStats(source="propublica", skipped_existing=len(exclude_eins), seed_file=settings.seed_ein_file)
    if exclude_eins:
        logger.info("Skipping EINs that were already scored", extra={"count": len(exclude_eins)})
    eins = propublica.discover_eins(limit, exclude_eins=exclude_eins)
    stats.candidates = len(eins)
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
            stats.processed += 1
        except Exception:
            conn.rollback()
            stats.failed += 1
            logger.exception("Failed to process EIN", extra={"ein": ein})
    return stats


def process_irs(conn, settings, limit: int, skip_existing: bool = False) -> DiscoveryStats:
    irs = IRSClient(settings)
    exclude_eins = fetch_scored_eins(conn) if skip_existing else set()
    stats = DiscoveryStats(source="irs", skipped_existing=len(exclude_eins))
    if exclude_eins:
        logger.info("Skipping IRS EINs that were already scored", extra={"count": len(exclude_eins)})
    records_by_ein = irs.load_local_records(limit, exclude_eins=exclude_eins)
    if not records_by_ein:
        logger.warning("No IRS records loaded. Set IRS_BULK_LOCAL_PATH or use --source propublica.")
        return stats

    stats.candidates = len(records_by_ein)
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
            stats.processed += 1
        except Exception:
            conn.rollback()
            stats.failed += 1
            logger.exception("Failed to process IRS EIN", extra={"ein": ein})
    return stats


if __name__ == "__main__":
    main()
