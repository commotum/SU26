# 6-REPORT

## Status

Complete as of 2026-06-26.

## Objective

Produce human-facing course maps and next-action views from the indexed Canvas archive so Jake can start from organized local files instead of manually navigating Canvas.

## Implementation

- Added `buildReportOutputs()` to `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs`.
- Generated machine-readable action CSVs from `tasks.csv`, cross-check outputs, and recursive review state.
- Generated per-course Markdown maps organized by Canvas module order.
- Generated a blocked-review Markdown report from retry, rule-improvement, and manual-review manifests.
- Added a navigation-surface classifier cleanup before final reporting so Grades, Assignments, Discussions, and course home/index pages are retained as evidence but excluded from task/action rows.

## Outputs

- `/Users/jake/Developer/SU26/canvas/indexer/output/next_actions.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/due_dates.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/upcoming_due_dates.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/past_due_or_completed.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/required_prep.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/critical_setup.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_maps_index.md`
- `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_map_mth-252.md`
- `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_map_mth-253.md`
- `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_map_phy-212.md`
- `/Users/jake/Developer/SU26/canvas/indexer/output/reports/blocked_review.md`

## Results

- `next_actions.csv`: 365 rows, matching `tasks.csv`.
- `due_dates.csv`: 67 rows.
- `upcoming_due_dates.csv`: 63 rows.
- `past_due_or_completed.csv`: 4 rows.
- `required_prep.csv`: 121 rows.
- `critical_setup.csv`: 65 rows.
- Course maps generated: 3.
- `tasks.csv` now contains 0 Canvas navigation-surface tasks.

## Verification

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` passed.
- Verified `next_actions.csv` row count matches `tasks.csv`.
- Verified `due_dates.csv` reconciles exactly to `upcoming_due_dates.csv` plus `past_due_or_completed.csv`.
- Verified all three course map Markdown files exist and start with titles.
- Verified `blocked_review.md` exists and starts with a title.
- Verified no tasks remain with object types `course_page`, `grades`, `assignments`, `modules`, `quizzes`, `discussions`, `files`, or `people`.
- `git diff --check -- goal-1 canvas/indexer` passed before final documentation cleanup; rerun after final docs before closing.

## Current Front Door

Start with `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_maps_index.md`.

Use `/Users/jake/Developer/SU26/canvas/indexer/output/next_actions.csv` for the sortable action table, and `/Users/jake/Developer/SU26/canvas/indexer/output/reports/blocked_review.md` for unresolved crawl/classification/download work.
