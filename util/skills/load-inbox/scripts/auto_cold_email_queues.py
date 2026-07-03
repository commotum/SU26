#!/usr/bin/env python3
"""List or move staged messages that match approved auto-cold rules."""

from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import date
from pathlib import Path


LOG_FIELDS = [
    "message_id",
    "processed_date",
    "received_date",
    "sender",
    "subject",
    "rule_id",
    "rule_name",
    "mailbox_action",
    "mailbox_verification",
    "notes",
]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"{path} has no header")
        return list(reader.fieldnames), list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def append_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    existing_fields: list[str] | None = None
    if path.exists():
        with path.open(newline="") as f:
            existing_fields = csv.DictReader(f).fieldnames
    if existing_fields and existing_fields != fields:
        raise ValueError(f"{path} header does not match expected auto-cold log header")
    with path.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        if not existing_fields:
            writer.writeheader()
        writer.writerows(rows)


def enabled_rules(path: Path) -> list[dict[str, str]]:
    _, rows = read_csv(path)
    return [row for row in rows if row.get("enabled", "").strip().lower() == "true"]


def field_matches(pattern: str, value: str) -> bool:
    pattern = pattern.strip()
    if not pattern:
        return True
    return re.search(pattern, value or "", re.IGNORECASE) is not None


def matching_rule(row: dict[str, str], rules: list[dict[str, str]]) -> dict[str, str] | None:
    for rule in rules:
        if not field_matches(rule.get("sender_regex", ""), row.get("sender", "")):
            continue
        if not field_matches(rule.get("subject_regex", ""), row.get("subject", "")):
            continue
        if not field_matches(rule.get("description_regex", ""), row.get("description", "")):
            continue
        return rule
    return None


def validate_queues(fields: list[str], staged: list[dict[str, str]], hot: list[dict[str, str]], cold: list[dict[str, str]]) -> None:
    seen_by_file: dict[str, set[str]] = {}
    locations: dict[str, list[str]] = {}
    for name, rows in [("staged", staged), ("hot", hot), ("cold", cold)]:
        seen_by_file[name] = set()
        for row in rows:
            if list(row.keys()) != fields:
                raise ValueError(f"{name}.csv row has unexpected columns")
            message_id = row.get("message_id", "")
            if message_id in seen_by_file[name]:
                raise ValueError(f"duplicate message_id in {name}.csv: {message_id}")
            seen_by_file[name].add(message_id)
            locations.setdefault(message_id, []).append(name)
    collisions = {key: value for key, value in locations.items() if len(value) > 1}
    if collisions:
        raise ValueError(f"cross-file duplicate message_id values: {collisions}")


def move_verified(
    staged: list[dict[str, str]],
    cold: list[dict[str, str]],
    rules: list[dict[str, str]],
    verified_ids: set[str],
    mailbox_verification: str,
) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    kept: list[dict[str, str]] = []
    moved: list[dict[str, str]] = []
    log_rows: list[dict[str, str]] = []
    today = date.today().isoformat()

    for row in staged:
        if row.get("message_id") not in verified_ids:
            kept.append(row)
            continue

        rule = matching_rule(row, rules)
        if not rule:
            raise ValueError(f"{row.get('message_id')} was requested for auto-cold but does not match an enabled rule")

        completed = row.copy()
        completed.update(
            {
                "triaged_date": today,
                "course_or_area": rule.get("course_or_area", ""),
                "category": rule.get("category", "other"),
                "email_type": rule.get("email_type", "routine"),
                "importance": rule.get("importance", "low"),
                "priority": rule.get("priority", "P3"),
                "status": rule.get("status", "noise"),
                "decision": f"{rule.get('decision', 'Auto-cold approved message')} Rule: {rule.get('rule_id')}.",
                "mailbox_action": "other",
                "next_action": "None.",
                "deadline": "",
                "task_id": "",
                "notes": " ".join(
                    part
                    for part in [
                        completed.get("notes", ""),
                        f"Auto-colded by {rule.get('rule_id')} ({rule.get('name')}) using surface metadata under user-approved allowlist.",
                        f"Mailbox verification: {mailbox_verification}",
                    ]
                    if part
                ),
            }
        )
        cold.append(completed)
        moved.append(completed)
        log_rows.append(
            {
                "message_id": completed.get("message_id", ""),
                "processed_date": today,
                "received_date": completed.get("received_date", ""),
                "sender": completed.get("sender", ""),
                "subject": completed.get("subject", ""),
                "rule_id": rule.get("rule_id", ""),
                "rule_name": rule.get("name", ""),
                "mailbox_action": "marked_read",
                "mailbox_verification": mailbox_verification,
                "notes": "Auto-colded from staged surface metadata; no full body read.",
            }
        )

    missing = sorted(verified_ids - {row.get("message_id") for row in moved})
    if missing:
        raise ValueError(f"verified ids not found in staged.csv: {missing}")

    return kept, cold, log_rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emails-dir", default="emails")
    parser.add_argument("--rules", default="emails/auto_cold_rules.csv")
    parser.add_argument("--log", default="emails/auto_cold_log.csv")
    parser.add_argument("--list", action="store_true", help="List staged rows matching enabled auto-cold rules")
    parser.add_argument("--move-verified", nargs="*", default=None, help="Move these verified staged message IDs to cold.csv")
    parser.add_argument("--mailbox-verification", default="", help="Short note describing mailbox read-state verification")
    args = parser.parse_args()

    emails_dir = Path(args.emails_dir)
    staged_path = emails_dir / "staged.csv"
    hot_path = emails_dir / "hot.csv"
    cold_path = emails_dir / "cold.csv"
    rules_path = Path(args.rules)
    log_path = Path(args.log)

    fields, staged = read_csv(staged_path)
    hot_fields, hot = read_csv(hot_path)
    cold_fields, cold = read_csv(cold_path)
    if fields != hot_fields or fields != cold_fields:
        raise ValueError("staged.csv, hot.csv, and cold.csv headers must match exactly")

    rules = enabled_rules(rules_path)
    matches = []
    for row in staged:
        rule = matching_rule(row, rules)
        if rule:
            matches.append(
                {
                    "message_id": row.get("message_id", ""),
                    "received_date": row.get("received_date", ""),
                    "sender": row.get("sender", ""),
                    "subject": row.get("subject", ""),
                    "rule_id": rule.get("rule_id", ""),
                    "rule_name": rule.get("name", ""),
                }
            )

    if args.move_verified is not None:
        verified_ids = set(args.move_verified)
        if not verified_ids:
            raise ValueError("--move-verified requires at least one message_id")
        if not args.mailbox_verification.strip():
            raise ValueError("--mailbox-verification is required when moving rows")
        staged, cold, log_rows = move_verified(staged, cold, rules, verified_ids, args.mailbox_verification.strip())
        validate_queues(fields, staged, hot, cold)
        write_csv(staged_path, fields, staged)
        write_csv(cold_path, fields, cold)
        append_csv(log_path, LOG_FIELDS, log_rows)
        print(json.dumps({"moved": len(log_rows), "message_ids": sorted(verified_ids)}, sort_keys=True))
        return 0

    print(json.dumps({"matches": matches, "match_count": len(matches)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
