#!/usr/bin/env python3
"""Classify Canvas access-denied and failed-capture rows for follow-up."""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def csv_join(values) -> str:
    return "|".join(sorted({clean_text(value) for value in values if clean_text(value)}))


def parse_canvas_url(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    path = parsed.path
    out = {
        "canvas_object_type": "",
        "canvas_object_id": "",
        "parent_object_type": "",
        "parent_object_id": "",
        "child_id": "",
    }
    quiz_question = re.search(r"/quizzes/(\d+)/questions/(\d+)", path)
    if quiz_question:
        out.update({
            "canvas_object_type": "quiz_question",
            "canvas_object_id": quiz_question.group(2),
            "parent_object_type": "quiz",
            "parent_object_id": quiz_question.group(1),
            "child_id": quiz_question.group(2),
        })
        return out
    for object_type, pattern in [
        ("assignment", r"/assignments/(\d+)"),
        ("quiz", r"/quizzes/(\d+)"),
        ("discussion", r"/discussion_topics/(\d+)"),
        ("file", r"/files/(\d+)"),
    ]:
        match = re.search(pattern, path)
        if match:
            out.update({"canvas_object_type": object_type, "canvas_object_id": match.group(1)})
            return out
    return out


def build_index(rows: list[dict[str, str]], *columns: str) -> dict[tuple[str, ...], list[dict[str, str]]]:
    index: dict[tuple[str, ...], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        key = tuple(clean_text(row.get(column)) for column in columns)
        if all(key):
            index[key].append(row)
    return index


def object_key(course_code: str, object_type: str, object_id: str) -> tuple[str, str, str]:
    return clean_text(course_code), clean_text(object_type), clean_text(object_id)


def status_for_issue(
    issue: dict[str, str],
    parsed_url: dict[str, str],
    related_objects: list[dict[str, str]],
    parent_objects: list[dict[str, str]],
    task_rows: list[dict[str, str]],
    module_rows: list[dict[str, str]],
) -> tuple[str, str, str, str, str]:
    issue_type = issue.get("issue_type", "")
    object_type = parsed_url["canvas_object_type"]
    parent_type = parsed_url["parent_object_type"]

    if issue_type == "capture_failed":
        return (
            "live_retry_required",
            "The crawler timed out before any content was captured.",
            "Retry in Chrome/Playwright and capture visible text.",
            "yes",
            "high",
        )

    if object_type == "quiz_question" and parent_type == "quiz":
        captured_parent = [row for row in parent_objects if row.get("title") and row.get("title") != "Unauthorized"]
        if captured_parent:
            return (
                "internal_canvas_question_url",
                "Question-level Canvas URL came from a captured quiz page; the student-facing parent quiz is already captured.",
                "No separate retry needed unless parent quiz content is incomplete.",
                "no",
                "high",
            )
        return (
            "question_url_parent_needs_retry",
            "Question-level Canvas URL was blocked and no readable parent quiz capture was found.",
            "Retry parent quiz first, then decide whether question URLs matter.",
            "yes",
            "medium",
        )

    if task_rows or module_rows:
        return (
            "student_facing_blocked_item",
            "The blocked URL matches a task/module row, so it may affect coursework.",
            "Retry live and inspect whether Canvas shows a lock date, prerequisite, or true access denial.",
            "yes",
            "high",
        )

    if related_objects:
        return (
            "blocked_linked_detail_without_module",
            "The URL was captured only as a linked detail and does not currently map to a module item.",
            "Retry live once; if still denied and absent from modules/grades, treat as hidden/instructor-only.",
            "yes",
            "medium",
        )

    return (
        "unmapped_access_issue",
        "No module, task, or object context was found in the offline index.",
        "Retry live and classify from the visible Canvas message.",
        "yes",
        "medium",
    )


def investigate(args: argparse.Namespace) -> None:
    output_root = Path(args.output_root).expanduser().resolve()
    issues = read_csv(output_root / "capture_issues.csv")
    objects = read_csv(output_root / "canvas_objects.csv")
    tasks = read_csv(output_root / "tasks.csv")
    module_items = read_csv(output_root / "module_items.csv")

    objects_by_canvas = build_index(objects, "course_code", "object_type", "canvas_object_id")
    tasks_by_object = build_index(tasks, "object_id")
    module_by_object = build_index(module_items, "destination_object_id")

    rows: list[dict[str, object]] = []
    for index, issue in enumerate(
        [row for row in issues if row.get("issue_type") in {"unauthorized", "capture_failed"}],
        start=1,
    ):
        url = clean_text(issue.get("requested_url") or issue.get("resolved_url"))
        parsed_url = parse_canvas_url(url)
        course_code = clean_text(issue.get("course_code"))

        related_objects = objects_by_canvas.get(
            object_key(course_code, parsed_url["canvas_object_type"], parsed_url["canvas_object_id"]),
            [],
        )
        parent_objects = objects_by_canvas.get(
            object_key(course_code, parsed_url["parent_object_type"], parsed_url["parent_object_id"]),
            [],
        )
        candidate_objects = parent_objects if parsed_url["parent_object_type"] else related_objects
        task_rows = []
        module_rows = []
        for canvas_object in candidate_objects or related_objects:
            task_rows.extend(tasks_by_object.get((canvas_object.get("object_id", ""),), []))
            module_rows.extend(module_by_object.get((canvas_object.get("object_id", ""),), []))

        status, likely_reason, recommended_action, needs_live_retry, confidence = status_for_issue(
            issue,
            parsed_url,
            related_objects,
            parent_objects,
            task_rows,
            module_rows,
        )

        rows.append({
            "investigation_id": f"access-{index:04d}",
            "course_id": issue.get("course_id", ""),
            "course_code": course_code,
            "issue_type": issue.get("issue_type", ""),
            "page_id": issue.get("page_id", ""),
            "captured_title": issue.get("title", ""),
            "url": url,
            "canvas_object_type": parsed_url["canvas_object_type"],
            "canvas_object_id": parsed_url["canvas_object_id"],
            "parent_object_type": parsed_url["parent_object_type"],
            "parent_object_id": parsed_url["parent_object_id"],
            "matched_object_ids": csv_join(row.get("object_id") for row in related_objects),
            "matched_object_titles": csv_join(row.get("title") for row in related_objects),
            "parent_object_ids": csv_join(row.get("object_id") for row in parent_objects),
            "parent_object_titles": csv_join(row.get("title") for row in parent_objects),
            "task_ids": csv_join(row.get("task_id") for row in task_rows),
            "task_titles": csv_join(row.get("title") for row in task_rows),
            "due_texts": csv_join(row.get("due_text") for row in task_rows),
            "available_texts": csv_join(row.get("available_text") for row in task_rows),
            "module_item_ids": csv_join(row.get("module_item_id") for row in module_rows),
            "module_titles": csv_join(row.get("module_title") for row in module_rows),
            "investigation_status": status,
            "likely_reason": likely_reason,
            "needs_live_retry": needs_live_retry,
            "confidence": confidence,
            "recommended_action": recommended_action,
        })

    write_csv(
        output_root / "unauthorized_investigation.csv",
        rows,
        [
            "investigation_id",
            "course_id",
            "course_code",
            "issue_type",
            "page_id",
            "captured_title",
            "url",
            "canvas_object_type",
            "canvas_object_id",
            "parent_object_type",
            "parent_object_id",
            "matched_object_ids",
            "matched_object_titles",
            "parent_object_ids",
            "parent_object_titles",
            "task_ids",
            "task_titles",
            "due_texts",
            "available_texts",
            "module_item_ids",
            "module_titles",
            "investigation_status",
            "likely_reason",
            "needs_live_retry",
            "confidence",
            "recommended_action",
        ],
    )
    print(f"Wrote {len(rows)} access investigation row(s) to {output_root / 'unauthorized_investigation.csv'}")


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[2]
    output_root = repo_root / "canvas" / "indexer" / "output"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", default=str(output_root))
    return parser.parse_args()


if __name__ == "__main__":
    investigate(parse_args())
