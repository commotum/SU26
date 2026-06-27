# 8-CLASSIFIER-IMMEDIATE

## Status

Complete for this pass as of 2026-06-26.

## Objective

Use the remaining rule-improvement manifest to remove deterministic classifier noise, rerun the indexer, and create an immediate schoolwork report from course maps, hard due dates, parsed course files, and captured announcements.

## Implementation

- Updated `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs` so generic Q&A/FAQ discussions are reference-only rather than graded discussion tasks.
- Prevented Canvas syllabus pseudo-assignment pages from becoming graded tasks.
- Removed duplicate low-confidence review rows when an object already has a more specific review reason such as external surface, blocked page, or download status.
- Adjusted module cross-checking so reference-only discussion boards are not task candidates.
- Updated course-map download reporting to distinguish parsed downloads from downloads needing action.
- Added the immediate schoolwork report and CSV:
  - `/Users/jake/Developer/SU26/canvas/indexer/output/reports/immediate_schoolwork.md`
  - `/Users/jake/Developer/SU26/canvas/indexer/output/immediate_schoolwork.csv`
- Added the immediate report to `/Users/jake/Developer/SU26/canvas/indexer/output/reports/course_maps_index.md`.

## Results

- `review_queue.csv`: 67 rows after cleanup.
- `retry_manifest.csv`: 0 rows.
- `rule_improvement_manifest.csv`: 3 rows, all `graded_task_missing_due` groups.
- `immediate_schoolwork.csv`: 22 rows:
  - 7 hard due-date rows.
  - 10 missing-due but required-looking rows.
  - 4 past/possibly-completed verification rows.
  - 1 future-access follow-up row.

## Remaining Known Limits

- The remaining rule-improvement groups are real missing-due metadata gaps, not obvious classifier false positives:
  - `MTH-252`: reading quizzes and selected discussion reflections have relative calendar context but no clean Canvas due text in the captured task detail.
  - `MTH-253`: required discussion boards, unit quizzes, and the final exam have schedule context but no clean due text in captured task detail.
  - `PHY-212`: several module-listing dates appear as bare dates such as `Jun 27`, `Jun 29`, or `Jul 4`; the primary due parser does not silently convert those to hard due dates.

## Verification

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` passed.
- `immediate_schoolwork.csv` parsed as 22 CSV rows with the expected buckets.
