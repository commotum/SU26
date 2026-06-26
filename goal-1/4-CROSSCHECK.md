# 4-CROSSCHECK

## Status

Complete as of 2026-06-26.

## Objective

Compare Modules, Assignments, Grades, captured detail pages, downloads, and review output so course organization gaps remain visible instead of getting buried in the raw crawl.

## Implementation

- Added `buildCrosscheckOutputs()` to `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs`.
- Generated a module-centered cross-check table from all normalized module items.
- Generated an Assignments/Grades surface cross-check table from `assignment_surface_row` and `grade_surface_row` evidence.
- Generated a suspicious/missing queue that includes module gaps, surface-only tasks, capture issues, unread downloads, review queue rows, tasks outside modules, and graded tasks missing due text.
- Generated `crosscheck_summary.csv` with counts and examples by course, source table, category, and status.
- Added Stage 4 counts to `readout_summary.json` and the command-line return summary.

## Outputs

- `/Users/jake/Developer/SU26/canvas/indexer/output/crosscheck_modules_assignments.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/crosscheck_grades_tasks.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/missing_or_suspicious.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/crosscheck_summary.csv`

## Results

- `crosscheck_modules_assignments.csv`: 375 rows.
  - MTH-252: 274
  - MTH-253: 63
  - PHY-212: 38
- Module cross-check status counts:
  - `module_item_has_task`: 244
  - `module_item_reference_only`: 42
  - `module_item_external_unvisited`: 63
  - `module_item_structural`: 17
  - `module_item_important_reference`: 7
  - `module_item_task_candidate_without_task`: 1
  - `module_item_blocked`: 1
- `crosscheck_grades_tasks.csv`: 67 rows.
  - MTH-252: 40
  - MTH-253: 15
  - PHY-212: 12
- Assignments/Grades surface status counts:
  - `grades_surface_task_in_modules`: 55
  - `assignments_surface_task_not_in_modules`: 6
  - `grades_surface_task_not_in_modules`: 6
- `missing_or_suspicious.csv`: 689 rows.
  - MTH-252: 391
  - MTH-253: 136
  - PHY-212: 162
- Suspicious category counts:
  - `review_queue`: 231
  - `capture_issue`: 152
  - `download_not_read`: 102
  - `module_crosscheck`: 82
  - `task_without_module`: 60
  - `graded_task_missing_due`: 50
  - `assignments_surface_crosscheck`: 6
  - `grades_surface_crosscheck`: 6
- `crosscheck_summary.csv`: 72 rows.

## Notable Findings

- PHY-212 has 6 Assignment surface tasks and 6 Grade surface tasks that are task rows but not represented in Modules.
- The PHY-212 `Lab Partner Values Survey` module item is a quiz task but its captured page appears unauthorized, so it remains blocked.
- The PHY-212 `General Discussion & FAQs` module item is task-like by text signals but currently excluded from `tasks.csv` because it also matched admin/policy signals; it is flagged for review.
- The two timed-out PHY-212 URLs are present in `missing_or_suspicious.csv` as `capture_failed` rows and also in review output:
  - `https://canvas.oregonstate.edu/courses/2053526/assignments/10556974`
  - `https://canvas.oregonstate.edu/courses/2053526/discussion_topics/11563804`

## Verification

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` passed.
- Verified every `module_items.csv` row has one `crosscheck_modules_assignments.csv` row.
- Verified every Assignments/Grades evidence row has one `crosscheck_grades_tasks.csv` row.
- Verified all three courses appear in module, surface, and suspicious cross-check outputs.
- Verified both `warnings.json` capture failures are present in `missing_or_suspicious.csv`.
- `git diff --check -- goal-1 canvas/indexer` passed.

## Next Stage Inputs

- Stage 5 should use `missing_or_suspicious.csv` and `crosscheck_summary.csv` to generate deterministic retry/download/review manifests.
- The first recursive improvements should target:
  - PHY-212 surface-only tasks not in Modules.
  - The unauthorized `Lab Partner Values Survey` quiz page.
  - The two timed-out PHY-212 URLs.
  - Downloaded files/PDFs that are currently only indexed as links.
  - Admin/policy collisions where task-like course pages are filtered out of `tasks.csv`.
