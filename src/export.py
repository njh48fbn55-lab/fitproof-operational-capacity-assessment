from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from typing import Any

from config import Settings
from db import insert_export_run, qualifying_leads
from email_delivery import send_export_email


NAMES_ONLY_COLUMNS = ["nonprofit_name"]
FULL_COLUMNS = ["nonprofit_name", "ein", "state", "latest_revenue", "latest_expenses", "latest_deficit", "priority_score"]


def export_leads(conn, settings: Settings, export_type: str) -> Path:
    rows = qualifying_leads(conn)
    settings.export_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.export_dir / f"fitproof_nonprofit_loss_leads_{date.today().isoformat()}.csv"
    columns = NAMES_ONLY_COLUMNS if export_type == "names-only" else FULL_COLUMNS

    with file_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column) for column in columns})

    insert_export_run(conn, export_type, file_path, len(rows))
    conn.commit()
    send_export_email(settings, file_path, export_type, len(rows))
    return file_path
