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


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{parsed.scheme}://{parsed.netloc}{path}{query}"


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


def resolution_from_live_and_source(
    offline_status: str,
    live_row: dict[str, str] | None,
    source_page_text: str,
    source_link_texts: str,
) -> tuple[str, str, str]:
    live_status = live_row.get("live_status", "") if live_row else ""
    live_text = live_row.get("text_sample", "") if live_row else ""
    source_text = f"{source_page_text} {source_link_texts}".lower()

    if offline_status == "internal_canvas_question_url":
        return (
            "resolved_internal_question_link",
            "Question URL is an internal Canvas edit/detail link; parent quiz content was already captured.",
            "No action needed for the question URL itself.",
        )
    if live_status == "locked_by_date_or_availability" and "locked until" in live_text.lower():
        locked_match = re.search(r"locked until ([^.]+?)(?:\\.| previous| next|$)", live_text, re.I)
        locked_text = clean_text(locked_match.group(1)) if locked_match else "a future availability date"
        return (
            "locked_until_future_date",
            f"Live Canvas page explicitly says it is locked until {locked_text}.",
            "Retry after the unlock time if the item is still relevant.",
        )
    if live_status == "captured_student_content" or (
        live_status == "locked_by_date_or_availability" and "access denied" not in live_text.lower() and "locked until" not in live_text.lower()
    ):
        return (
            "resolved_live_content_captured",
            "Live Chrome retry exposed readable student-facing content.",
            "Use live_access_retry.csv text as evidence; no access blocker remains.",
        )
    if live_status == "access_denied" and "access denied" in source_text and "before it is open" in source_text:
        return (
            "expected_access_denied_until_released",
            "The source module page explicitly says items may show Access Denied before they open.",
            "Track from syllabus/assignment dates and retry near the expected open window.",
        )
    if live_status == "access_denied" and source_link_texts:
        return (
            "linked_item_still_access_denied",
            "The link is present on a course content page, but live Canvas still shows generic Access Denied.",
            "Keep as a real linked blocker; retry later or find the equivalent assignment/grade surface row.",
        )
    if live_status == "access_denied":
        return (
            "access_denied_unexplained",
            "Live Chrome still shows generic Access Denied and no source explanation was found.",
            "Keep as a live retry/manual review item.",
        )
    if live_status:
        return (
            f"live_{live_status}",
            live_row.get("live_reason", ""),
            "Review the live retry row.",
        )
    return (
        offline_status,
        "No live retry result was available for this row.",
        "Use offline classification and retry live if it still matters.",
    )


def investigate(args: argparse.Namespace) -> None:
    output_root = Path(args.output_root).expanduser().resolve()
    archive_root = Path(args.archive_root).expanduser().resolve()
    issues = read_csv(output_root / "capture_issues.csv")
    objects = read_csv(output_root / "canvas_objects.csv")
    tasks = read_csv(output_root / "tasks.csv")
    module_items = read_csv(output_root / "module_items.csv")
    page_inventory = read_csv(output_root / "page_inventory.csv")
    link_rows = read_csv(archive_root / "links.csv")
    live_rows = read_csv(output_root / "live_access_retry.csv")

    objects_by_canvas = build_index(objects, "course_code", "object_type", "canvas_object_id")
    tasks_by_object = build_index(tasks, "object_id")
    module_by_object = build_index(module_items, "destination_object_id")
    page_by_id = {row.get("page_id", ""): row for row in page_inventory}
    links_by_href: dict[str, list[dict[str, str]]] = defaultdict(list)
    for link_row in link_rows:
        href = clean_text(link_row.get("href"))
        if href:
            links_by_href[normalize_url(href)].append(link_row)
    live_by_investigation_id = {row.get("investigation_id", ""): row for row in live_rows}

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
        source_links = links_by_href.get(normalize_url(url), [])
        source_page_ids = csv_join(row.get("page_id") for row in source_links)
        source_link_texts = csv_join(row.get("text") for row in source_links)
        source_page_titles = csv_join(page_by_id.get(row.get("page_id", ""), {}).get("title", "") for row in source_links)
        source_page_text_chunks = []
        for source_link in source_links[:5]:
            page = page_by_id.get(source_link.get("page_id", ""), {})
            markdown_path = clean_text(page.get("markdown_path"))
            if not markdown_path:
                continue
            absolute_markdown_path = archive_root / markdown_path
            if absolute_markdown_path.exists():
                source_page_text_chunks.append(absolute_markdown_path.read_text(encoding="utf-8", errors="replace")[:20000])
        source_page_text = "\n".join(source_page_text_chunks)
        live_row = live_by_investigation_id.get(f"access-{index:04d}")
        resolution_status, resolution_reason, final_action = resolution_from_live_and_source(
            status,
            live_row,
            source_page_text,
            source_link_texts,
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
            "source_page_ids": source_page_ids,
            "source_page_titles": source_page_titles,
            "source_link_texts": source_link_texts,
            "live_status": live_row.get("live_status", "") if live_row else "",
            "live_text_sample": live_row.get("text_sample", "") if live_row else "",
            "investigation_status": status,
            "likely_reason": likely_reason,
            "needs_live_retry": needs_live_retry,
            "confidence": confidence,
            "recommended_action": recommended_action,
            "resolution_status": resolution_status,
            "resolution_reason": resolution_reason,
            "final_action": final_action,
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
            "source_page_ids",
            "source_page_titles",
            "source_link_texts",
            "live_status",
            "live_text_sample",
            "investigation_status",
            "likely_reason",
            "needs_live_retry",
            "confidence",
            "recommended_action",
            "resolution_status",
            "resolution_reason",
            "final_action",
        ],
    )
    print(f"Wrote {len(rows)} access investigation row(s) to {output_root / 'unauthorized_investigation.csv'}")


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[2]
    output_root = repo_root / "canvas" / "indexer" / "output"
    archive_root = repo_root / "canvas" / "archive" / "full-fixed-2026-06-26T21-00-04-500Z"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", default=str(output_root))
    parser.add_argument("--archive-root", default=str(archive_root))
    return parser.parse_args()


if __name__ == "__main__":
    investigate(parse_args())
