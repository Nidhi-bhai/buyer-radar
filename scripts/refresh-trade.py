#!/usr/bin/env python3
"""Pull UN Comtrade public-preview import totals and store them unchanged.

The preview API does not send Access-Control-Allow-Origin, so a GitHub Pages
site cannot call it from the browser. This script saves the response BuyerRadar
is allowed to quote: reporter, period, HS code, and primaryValue as returned.

No values are summed across HS editions. If a reporter appears twice, the
higher HS edition is kept.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "trade-snapshots.json"

# HS codes cited by data/catalog. Descriptions are checked after download.
CODES = [
    "121190",
    "091030",
    "090111",
    "090121",
    "090210",
    "090240",
    "180100",
    "180500",
    "080132",
    "151319",
    "150920",
    "100630",
    "040900",
    "090411",
    "090421",
    "090510",
    "120740",
    "330112",
    "330129",
    "060311",
    "030617",
    "854143",
    "850760",
    "610910",
    "420221",
    "691200",
    "940360",
    "400122",
    "151190",
    "080440",
    "080390",
    "091012",
    "090831",
    "100850",
    "730630",
    "848180",
    "401519",
    "871200",
    "220421",
    "520100",
]

EDITION_RANK = {"H0": 0, "H1": 1, "H2": 2, "H3": 3, "H4": 4, "H5": 5, "H6": 6}
YEARS = ["2024", "2023"]
DOCS = "https://uncomtrade.org/docs/un-comtrade-api/"


def fetch(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "BuyerRadar/1.0 (static snapshot; +https://github.com/Nidhi-bhai/buyer-radar)",
        },
    )
    delay = 2.0
    last_error = None
    for _ in range(5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                raw = response.read().decode("utf-8")
            return json.loads(raw, parse_float=str)
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code == 429:
                time.sleep(delay)
                delay *= 2
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"Comtrade request failed for {url}: {last_error}")


def as_text(value):
    if value is None:
        return None
    return str(value)


def prefer(current: dict, candidate: dict) -> dict:
    current_rank = EDITION_RANK.get(current.get("classificationCode"), -1)
    candidate_rank = EDITION_RANK.get(candidate.get("classificationCode"), -1)
    if candidate_rank != current_rank:
        return candidate if candidate_rank > current_rank else current
    if candidate.get("isOriginalClassification") and not current.get("isOriginalClassification"):
        return candidate
    return current


def slim(row: dict) -> dict:
    return {
        "reporterCode": row.get("reporterCode"),
        "reporterISO": row.get("reporterISO"),
        "reporterDesc": row.get("reporterDesc"),
        "primaryValue": as_text(row.get("primaryValue")),
        "cifvalue": as_text(row.get("cifvalue")),
        "qty": as_text(row.get("qty")),
        "qtyUnitAbbr": row.get("qtyUnitAbbr"),
        "netWgt": as_text(row.get("netWgt")),
        "isQtyEstimated": bool(row.get("isQtyEstimated")),
        "classificationCode": row.get("classificationCode"),
        "flowCode": row.get("flowCode"),
        "flowDesc": row.get("flowDesc"),
        "partnerCode": row.get("partnerCode"),
        "partnerDesc": row.get("partnerDesc"),
        "cmdCode": row.get("cmdCode"),
        "cmdDesc": row.get("cmdDesc"),
        "period": str(row.get("period")),
        "isAggregate": bool(row.get("isAggregate")),
        "isOriginalClassification": bool(row.get("isOriginalClassification")),
    }


def query_url(code: str, year: str) -> str:
    return (
        "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
        f"?flowCode=M&period={year}&partnerCode=0&cmdCode={code}"
        "&maxRecords=500&includeDesc=true"
    )


def pull_code(code: str) -> dict:
    chosen = None
    for year in YEARS:
        url = query_url(code, year)
        payload = fetch(url)
        rows = payload.get("data") or []
        count = payload.get("count")
        print(f"  {code} {year}: count={count} rows={len(rows)}", flush=True)
        series = collapse(code, year, url, payload, rows)
        if chosen is None or series["reporterCount"] > chosen["reporterCount"]:
            chosen = series
        # 2024 is preferred once it has a full-looking reporter set.
        if year == "2024" and series["reporterCount"] >= 80:
            break
        time.sleep(1.2)
    return chosen


def collapse(code: str, year: str, url: str, payload: dict, rows: list) -> dict:
    by_reporter = {}
    duplicate_reporters = 0
    cmd_desc = None
    for row in rows:
        if row.get("flowCode") not in (None, "M"):
            continue
        if str(row.get("cmdCode")) != code:
            continue
        desc = row.get("reporterDesc")
        if not desc or desc == "World":
            continue
        if row.get("reporterCode") in (0, "0", None):
            continue
        if cmd_desc is None and row.get("cmdDesc"):
            cmd_desc = row.get("cmdDesc")
        key = str(row.get("reporterCode"))
        item = slim(row)
        if key in by_reporter:
            duplicate_reporters += 1
            by_reporter[key] = prefer(by_reporter[key], item)
        else:
            by_reporter[key] = item
    reporters = list(by_reporter.values())
    reporters.sort(key=lambda item: numeric(item.get("primaryValue")), reverse=True)
    api_count = payload.get("count")
    return {
        "cmdCode": code,
        "cmdDesc": cmd_desc,
        "period": year,
        "flowCode": "M",
        "flowDesc": "Import",
        "partnerCode": 0,
        "partnerDesc": "World",
        "freqCode": "A",
        "queryUrl": url,
        "apiCount": api_count,
        "rowsReturned": len(rows),
        "reporterCount": len(reporters),
        "duplicateReportersCollapsed": duplicate_reporters,
        "complete": api_count == len(rows) and len(rows) < 500,
        "reporters": reporters,
    }


def numeric(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return -1.0
    if number != number:
        return -1.0
    return number


def main() -> int:
    series = {}
    for index, code in enumerate(CODES):
        print(f"[{index + 1}/{len(CODES)}] HS {code}", flush=True)
        series[code] = pull_code(code)
        time.sleep(1.2)
    document = {
        "source": "UN Comtrade public preview API",
        "documentation": DOCS,
        "database": "https://comtradeplus.un.org/",
        "retrieved": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "note": (
            "Figures are the public preview response for annual merchandise imports "
            "(flowCode M) from partner World (partnerCode 0). primaryValue is stored "
            "as the JSON literal returned by the API. BuyerRadar does not estimate, "
            "scale, or sum values. If a reporter was published under more than one HS "
            "edition, only the later edition is kept. The preview API does not send "
            "CORS headers, so the static site reads this file instead of calling "
            "Comtrade from the browser. Re-run scripts/refresh-trade.py to refresh."
        ),
        "series": series,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
