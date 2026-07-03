#!/usr/bin/env python3
"""Deduplicate staged/hot/cold email queue CSVs.

Only staged.csv is modified. hot.csv rows are expected to remain unread and
are removed from staged when seen again. In unread-only loads, cold.csv rows
should have been marked read, so a staged row matching cold.csv is a process
error. In date-window loads that deliberately include read messages, cold.csv
matches are expected and can be removed with --cold-action remove. Duplicate
staged rows are removed after the hot/cold check.

The primary identity key uses the full surface context. Processed hot/cold rows
may no longer contain the original list-row raw text after a full read, so
hot/cold comparisons also use exact timestamp and date+preview fallbacks.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
from pathlib import Path
from typing import Iterable


def normalize(value: str | None) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value


def normalize_sender(value: str | None) -> str:
    value = normalize(value)
    value = re.sub(r"\s*<[^>]+>\s*", " ", value)
    return normalize(value)


def _normalize_time(hour_text: str | None, minute_text: str | None, ampm: str | None) -> str:
    if not hour_text or not minute_text:
        return ""
    hour = int(hour_text)
    minute = int(minute_text)
    if ampm:
        ampm = ampm.lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
    return f" {hour:02d}:{minute:02d}"


def normalize_received_date(value: str | None) -> str:
    """Normalize Outlook and CSV date displays for identity-key comparison.

    Exact datetimes remain distinct from date-only values; a date-only row is
    provisional and should not collapse duplicate-subject messages that differ
    only by time.
    """

    value = normalize(value)
    value = re.sub(r"^(mon|tue|wed|thu|fri|sat|sun)\s+", "", value)

    match = re.search(
        r"\b(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t]+(\d{1,2}):(\d{2})(?:\s*(am|pm))?)?\b",
        value,
    )
    if match:
        year, month, day, hour, minute, ampm = match.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}{_normalize_time(hour, minute, ampm)}"

    match = re.search(
        r"\b(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?)?\b",
        value,
    )
    if match:
        month, day, year, hour, minute, ampm = match.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}{_normalize_time(hour, minute, ampm)}"

    match = re.search(r"\b(\d{1,2})/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?)?\b", value)
    if match:
        month, day, hour, minute, ampm = match.groups()
        return f"md:{int(month):02d}-{int(day):02d}{_normalize_time(hour, minute, ampm)}"

    return value


def date_part(value: str | None) -> str:
    normalized = normalize_received_date(value)
    match = re.match(r"^(\d{4}-\d{2}-\d{2})(?: \d{2}:\d{2})?$", normalized)
    if match:
        return match.group(1)
    return normalized


def has_exact_time(value: str | None) -> bool:
    return bool(re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$", normalize_received_date(value)))


def preview_from(row: dict[str, str]) -> str:
    context = row.get("email_link_or_context", "")
    match = re.search(r"preview=(.*?)(?:;\s*raw=|$)", context)
    if match:
        return match.group(1)
    return row.get("description", "")


def raw_from(row: dict[str, str]) -> str:
    return " ".join(
        part for part in [row.get("email_link_or_context", ""), row.get("notes", "")] if part
    )


def identity(row: dict[str, str]) -> tuple[str, str, str, str, str]:
    return (
        normalize_sender(row.get("sender")),
        normalize(row.get("subject")),
        normalize_received_date(row.get("received_date")),
        normalize(preview_from(row)),
        normalize(raw_from(row)),
    )


def exact_processed_identity(row: dict[str, str]) -> tuple[str, str, str] | None:
    if not has_exact_time(row.get("received_date")):
        return None
    return (
        normalize_sender(row.get("sender")),
        normalize(row.get("subject")),
        normalize_received_date(row.get("received_date")),
    )


def date_preview_identity(row: dict[str, str]) -> tuple[str, str, str, str]:
    return (
        normalize_sender(row.get("sender")),
        normalize(row.get("subject")),
        date_part(row.get("received_date")),
        normalize(preview_from(row)),
    )


def any_identity(row: dict[str, str], exact_keys: set[tuple[str, str, str]], date_preview_keys: set[tuple[str, str, str, str]]) -> bool:
    exact_key = exact_processed_identity(row)
    if exact_key and exact_key in exact_keys:
        return True
    return date_preview_identity(row) in date_preview_keys


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no header")
        return list(reader.fieldnames), list(reader)


def write_csv(path: Path, fieldnames: Iterable[str], rows: Iterable[dict[str, str]]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(fieldnames))
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emails-dir", default="emails", help="Directory containing staged.csv, hot.csv, and cold.csv")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--cold-action",
        choices=("error", "remove"),
        default="error",
        help="Use error for unread-only loads; use remove for date-window loads that include read messages",
    )
    args = parser.parse_args()

    emails_dir = Path(args.emails_dir)
    staged_path = emails_dir / "staged.csv"
    hot_path = emails_dir / "hot.csv"
    cold_path = emails_dir / "cold.csv"

    staged_fields, staged_rows = read_csv(staged_path)
    hot_fields, hot_rows = read_csv(hot_path)
    cold_fields, cold_rows = read_csv(cold_path)
    if staged_fields != hot_fields or staged_fields != cold_fields:
        raise ValueError("staged.csv, hot.csv, and cold.csv headers must match exactly")

    hot_keys = {identity(row) for row in hot_rows}
    cold_keys = {identity(row) for row in cold_rows}
    hot_exact_keys = {key for row in hot_rows if (key := exact_processed_identity(row))}
    cold_exact_keys = {key for row in cold_rows if (key := exact_processed_identity(row))}
    hot_date_preview_keys = {date_preview_identity(row) for row in hot_rows}
    cold_date_preview_keys = {date_preview_identity(row) for row in cold_rows}
    seen_staged: set[tuple[str, str, str, str, str]] = set()
    kept: list[dict[str, str]] = []
    removed_hot = 0
    removed_cold = 0
    removed_duplicate = 0
    cold_conflicts: list[dict[str, str]] = []

    for row in staged_rows:
        key = identity(row)
        if key in cold_keys or any_identity(row, cold_exact_keys, cold_date_preview_keys):
            if args.cold_action == "remove":
                removed_cold += 1
            else:
                cold_conflicts.append({
                    "message_id": row.get("message_id", ""),
                    "sender": row.get("sender", ""),
                    "subject": row.get("subject", ""),
                    "received_date": row.get("received_date", ""),
                })
            continue
        if key in hot_keys or any_identity(row, hot_exact_keys, hot_date_preview_keys):
            removed_hot += 1
            continue
        if key in seen_staged:
            removed_duplicate += 1
            continue
        seen_staged.add(key)
        kept.append(row)

    if cold_conflicts:
        print(json.dumps({
            "error": "staged rows matched cold.csv; use --cold-action remove only for date-window loads that deliberately include read messages",
            "cold_conflicts": cold_conflicts,
            "cold_action": args.cold_action,
            "staged_before": len(staged_rows),
            "dry_run": args.dry_run,
        }, sort_keys=True))
        return 2

    if not args.dry_run:
        write_csv(staged_path, staged_fields, kept)

    print(json.dumps({
        "staged_before": len(staged_rows),
        "staged_after": len(kept),
        "removed_already_hot": removed_hot,
        "removed_already_cold": removed_cold,
        "removed_duplicate_staged": removed_duplicate,
        "cold_conflicts": 0,
        "cold_action": args.cold_action,
        "dry_run": args.dry_run,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
