# FitProof Nonprofit Loss Lead Discovery

Internal FitProof ETL for finding U.S. nonprofits with $10M-$100M in annual revenue that operated at a loss for the two most recent available filings. The first export intentionally contains nonprofit names only, with EIN and financial details retained in PostgreSQL for later internal enrichment.

This is not a public-facing UI.

## What It Does

- Uses ProPublica Nonprofit Explorer API as the MVP source.
- Supports IRS TEOS/Form 990 bulk-derived data as a secondary validation/backfill source.
- Stores organizations, filings, lead scores, and export runs in PostgreSQL.
- Calculates surplus/deficit as `total_revenue - total_expenses`.
- Qualifies organizations where:
  - latest revenue is at least `$10M`
  - latest revenue is at most `$100M`
  - latest two available filings both show negative surplus/deficit
- Prioritizes organizations that moved from profitable to unprofitable over the available five-year window.
- Exports CSV files named `fitproof_nonprofit_loss_leads_YYYY-MM-DD.csv`.

Form 990 data often lags by 12-24 months, so the most recent available filing may not be the current calendar year.

## Files

- `requirements.txt`: Python dependencies.
- `.env.example`: Environment variable template.
- `sql/schema.sql`: PostgreSQL tables.
- `src/config.py`: Environment/config loading.
- `src/db.py`: PostgreSQL connection and upserts.
- `src/propublica_client.py`: ProPublica API discovery and filing normalization.
- `src/irs_client.py`: IRS bulk/local-file validation scaffold.
- `src/scoring.py`: Eligibility and priority scoring.
- `src/export.py`: CSV export.
- `src/main.py`: Command-line ETL runner.

## Database Tables

- `organizations`
- `filings`
- `lead_scores`
- `export_runs`

## Local Setup

Create a Python environment:

```bash
cd "/Users/seancahill/Documents/New project"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a local `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
DATABASE_URL=postgresql://fitproof:your_password@localhost:5432/fitproof_leads
```

Initialize the database:

```bash
python src/main.py --init-db
```

Run the ProPublica MVP ETL:

```bash
python src/main.py --source propublica --limit 1000
```

Export qualifying nonprofit names only:

```bash
python src/main.py --export names-only
```

Export the internal full version:

```bash
python src/main.py --export full
```

## Discovery Inputs

ProPublica works well for organization lookup and search, but it is not a complete bulk feed of every U.S. nonprofit. The MVP discovers candidates using:

- `LEAD_DISCOVERY_SEARCH_TERMS`
- `LEAD_DISCOVERY_SEED_EINS`
- `LEAD_DISCOVERY_SEED_EIN_FILE`

For broader coverage, add a seed EIN file from IRS bulk indexes or targeted nonprofit categories, then run the ETL against those EINs.

Example:

```bash
LEAD_DISCOVERY_SEED_EIN_FILE=/var/www/fitproof-operational-capacity-assessment/data/seed-eins.txt
```

## IRS Bulk Validation

IRS TEOS/Form 990 bulk data can be used as a secondary validation source by setting:

```bash
IRS_BULK_LOCAL_PATH=/path/to/irs_990_extract.csv
```

The local IRS file may be CSV or JSONL. Expected fields can include:

- `ein`
- `filing_year` or `tax_prd_yr`
- `total_revenue` or `totrevenue`
- `total_expenses` or `totfuncexpns`
- `assets` or `totassetsend`
- `liabilities` or `totliabend`
- `filing_url` or `object_url`

If IRS data is unavailable, the pipeline continues with ProPublica data and logs the gap.

## Priority Scoring

Base eligibility:

- latest revenue >= `$10,000,000`
- latest revenue <= `$100,000,000`
- latest two filings have `net_surplus_deficit < 0`

Priority score:

- `+30` if five years ago was profitable and latest year is unprofitable
- `+20` if deficit grew year over year
- `+15` if expenses grew faster than revenue
- `+15` if revenue declined over five years
- `+10` if liabilities increased
- `+10` if assets declined

Results sort by priority score descending.

## DigitalOcean Droplet Setup

Enter the Droplet:

```bash
ssh root@143.244.161.7
```

Go to the app folder:

```bash
cd /var/www/fitproof-operational-capacity-assessment
```

Install PostgreSQL if it is not already installed:

```bash
apt update
apt install -y postgresql postgresql-contrib python3-venv
```

Create the database and user:

```bash
sudo -u postgres psql
```

Inside PostgreSQL:

```sql
CREATE DATABASE fitproof_leads;
CREATE USER fitproof WITH PASSWORD 'replace-this-password';
GRANT ALL PRIVILEGES ON DATABASE fitproof_leads TO fitproof;
\q
```

Create the Python environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create the environment file:

```bash
cp .env.example .env
nano .env
```

Set:

```bash
DATABASE_URL=postgresql://fitproof:replace-this-password@localhost:5432/fitproof_leads
```

Initialize the schema and run:

```bash
source .venv/bin/activate
python src/main.py --init-db
python src/main.py --source propublica --limit 1000
python src/main.py --export names-only
```

Go back to your Mac:

```bash
exit
```

## Nightly Cron

Enter the Droplet:

```bash
ssh root@143.244.161.7
```

Open cron:

```bash
crontab -e
```

Add this nightly job:

```cron
15 2 * * * cd /var/www/fitproof-operational-capacity-assessment && . .venv/bin/activate && python src/main.py --source propublica --limit 1000 >> /var/log/fitproof-lead-discovery.log 2>&1 && python src/main.py --export names-only >> /var/log/fitproof-lead-discovery.log 2>&1
```

Go back to your Mac:

```bash
exit
```

## Notes

- Missing filings are handled gracefully.
- Organizations are deduplicated by EIN.
- API failures are logged and retried.
- The ETL is resumable because organizations, filings, and scores are upserted.
- Credentials and database URLs belong in `.env`; never commit `.env`.
