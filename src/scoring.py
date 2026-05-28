from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


MIN_REVENUE = Decimal("10000000")
MAX_REVENUE = Decimal("100000000")


def score_lead(ein: str, filings: list[dict[str, Any]]) -> dict[str, Any]:
    usable = [
        filing
        for filing in filings
        if filing.get("filing_year") is not None
        and filing.get("total_revenue") is not None
        and filing.get("total_expenses") is not None
        and filing.get("net_surplus_deficit") is not None
    ]
    usable.sort(key=lambda item: int(item["filing_year"]), reverse=True)

    if len(usable) < 2:
        return empty_score(ein, "Fewer than two usable filings were available.")

    latest = usable[0]
    previous = usable[1]
    latest_revenue = Decimal(str(latest["total_revenue"]))
    latest_expenses = Decimal(str(latest["total_expenses"]))
    latest_deficit = Decimal(str(latest["net_surplus_deficit"]))
    previous_deficit = Decimal(str(previous["net_surplus_deficit"]))

    eligible = (
        latest_revenue >= MIN_REVENUE
        and latest_revenue <= MAX_REVENUE
        and latest_deficit < 0
        and previous_deficit < 0
    )

    if not eligible:
        return {
            **base_score(ein, latest),
            "priority_score": 0,
            "qualifies": False,
            "eligibility_reason": "Latest revenue is outside range or latest two filings are not both deficits.",
            "score_details": {"latest": serializable(latest), "previous": serializable(previous)},
        }

    five_year = usable[:5]
    oldest = five_year[-1]
    score = 0
    reasons: list[str] = []

    if Decimal(str(oldest.get("net_surplus_deficit") or 0)) > 0 and latest_deficit < 0:
        score += 30
        reasons.append("Moved from profitable to unprofitable over available five-year window.")

    if latest_deficit < previous_deficit:
        score += 20
        reasons.append("Deficit grew year over year.")

    if growth_rate(latest_expenses, previous.get("total_expenses")) > growth_rate(latest_revenue, previous.get("total_revenue")):
        score += 15
        reasons.append("Expenses grew faster than revenue.")

    if latest_revenue < Decimal(str(oldest.get("total_revenue") or latest_revenue)):
        score += 15
        reasons.append("Revenue declined over available five-year window.")

    if latest.get("liabilities") is not None and oldest.get("liabilities") is not None and Decimal(str(latest["liabilities"])) > Decimal(str(oldest["liabilities"])):
        score += 10
        reasons.append("Liabilities increased over available five-year window.")

    if latest.get("assets") is not None and oldest.get("assets") is not None and Decimal(str(latest["assets"])) < Decimal(str(oldest["assets"])):
        score += 10
        reasons.append("Assets declined over available five-year window.")

    return {
        **base_score(ein, latest),
        "priority_score": score,
        "qualifies": True,
        "eligibility_reason": "Qualified: revenue between $10M and $100M and latest two filings show deficits.",
        "score_details": {
            "reasons": reasons,
            "filing_years_used": [item["filing_year"] for item in five_year],
            "latest": serializable(latest),
            "previous": serializable(previous),
        },
    }


def base_score(ein: str, latest: dict[str, Any]) -> dict[str, Any]:
    return {
        "ein": ein,
        "latest_filing_year": latest.get("filing_year"),
        "latest_revenue": latest.get("total_revenue"),
        "latest_expenses": latest.get("total_expenses"),
        "latest_deficit": latest.get("net_surplus_deficit"),
    }


def empty_score(ein: str, reason: str) -> dict[str, Any]:
    return {
        "ein": ein,
        "latest_filing_year": None,
        "latest_revenue": None,
        "latest_expenses": None,
        "latest_deficit": None,
        "priority_score": 0,
        "qualifies": False,
        "eligibility_reason": reason,
        "score_details": {},
    }


def growth_rate(current: Decimal, previous: Any) -> Decimal:
    if previous in (None, "", 0, Decimal("0")):
        return Decimal("0")
    previous_decimal = Decimal(str(previous))
    if previous_decimal == 0:
        return Decimal("0")
    return (current - previous_decimal) / abs(previous_decimal)


def serializable(payload: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in payload.items():
        result[key] = json_safe(value)
    return result


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value
