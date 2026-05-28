CREATE TABLE IF NOT EXISTS organizations (
  ein TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT,
  ntee_category TEXT,
  source_url TEXT,
  date_pulled TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS filings (
  id BIGSERIAL PRIMARY KEY,
  ein TEXT NOT NULL REFERENCES organizations(ein) ON DELETE CASCADE,
  filing_year INTEGER NOT NULL,
  source TEXT NOT NULL,
  total_revenue NUMERIC,
  total_expenses NUMERIC,
  net_surplus_deficit NUMERIC,
  assets NUMERIC,
  liabilities NUMERIC,
  source_url TEXT,
  filing_url TEXT,
  date_pulled TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ein, filing_year, source)
);

CREATE INDEX IF NOT EXISTS filings_ein_year_idx ON filings (ein, filing_year DESC);
CREATE INDEX IF NOT EXISTS filings_revenue_idx ON filings (total_revenue);

CREATE TABLE IF NOT EXISTS lead_scores (
  ein TEXT PRIMARY KEY REFERENCES organizations(ein) ON DELETE CASCADE,
  latest_filing_year INTEGER,
  latest_revenue NUMERIC,
  latest_expenses NUMERIC,
  latest_deficit NUMERIC,
  priority_score INTEGER NOT NULL DEFAULT 0,
  qualifies BOOLEAN NOT NULL DEFAULT FALSE,
  eligibility_reason TEXT,
  score_details JSONB,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_scores_qualifies_score_idx ON lead_scores (qualifies, priority_score DESC);

CREATE TABLE IF NOT EXISTS export_runs (
  id BIGSERIAL PRIMARY KEY,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goodwill_affiliates (
  ein TEXT PRIMARY KEY,
  legal_name TEXT,
  common_name TEXT,
  city TEXT,
  state TEXT,
  latest_filing_year INTEGER,
  latest_revenue NUMERIC,
  latest_expenses NUMERIC,
  latest_surplus_deficit NUMERIC,
  total_assets NUMERIC,
  total_liabilities NUMERIC,
  source TEXT,
  source_url TEXT,
  irs_filing_url TEXT,
  confidence_score TEXT,
  pulled_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goodwill_affiliates_revenue_idx ON goodwill_affiliates (latest_revenue DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS goodwill_affiliates_confidence_idx ON goodwill_affiliates (confidence_score);
