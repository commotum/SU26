# 5-RECURSE

## Status

Complete as of 2026-06-26.

## Objective

Create the recursive improvement loop that turns cross-check findings into deterministic follow-up manifests without immediately changing browser state, retrying Canvas, or downloading files.

## Implementation

- Added optional input root `/Users/jake/Developer/SU26/canvas/indexer/input`.
- Added `/Users/jake/Developer/SU26/canvas/indexer/input/review_overrides.csv` as the feedback/override template.
- Added `applyReviewOverrides()` so future CSV decisions can adjust existing classified items, tasks, and review rows on rerun.
- Added `buildRecursiveOutputs()` to convert suspicious rows into review states and follow-up manifests.
- Added explicit review states:
  - `needs_rule`
  - `needs_retry`
  - `needs_download`
  - `needs_manual_decision`
  - `resolved`
- Kept all retry/download outputs as `queued_not_executed`; Stage 5 does not perform live Canvas retries or file downloads.

## Outputs

- `/Users/jake/Developer/SU26/canvas/indexer/output/review_state_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/retry_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/download_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/rule_improvement_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/manual_review_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/applied_review_overrides.csv`

## Results

- `review_state_manifest.csv`: 689 rows, matching every row in `missing_or_suspicious.csv`.
- Review state counts:
  - `needs_rule`: 198
  - `needs_manual_decision`: 271
  - `needs_retry`: 83
  - `needs_download`: 137
- `retry_manifest.csv`: 48 unique retry URLs.
- `download_manifest.csv`: 102 download targets.
- `rule_improvement_manifest.csv`: 14 rule-improvement buckets.
- `manual_review_manifest.csv`: 271 manual-review rows.
- `applied_review_overrides.csv`: 0 applied rows because `review_overrides.csv` currently has headers only.

## Notable Findings

- Both timed-out PHY-212 URLs are present in `retry_manifest.csv`:
  - `https://canvas.oregonstate.edu/courses/2053526/assignments/10556974`
  - `https://canvas.oregonstate.edu/courses/2053526/discussion_topics/11563804`
- Canvas placeholder URLs containing `$CANVAS_COURSE_REFERENCE$` are not emitted as retry targets; they are routed to `needs_rule`.
- The download manifest has all 102 normalized downloads with `execute_status=queued_not_executed`.
- The retry manifest has all rows marked `execute_status=queued_not_executed`.

## Verification

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` passed.
- Verified every `missing_or_suspicious.csv` row has a `review_state_manifest.csv` row.
- Verified every `downloads_normalized.csv` row has a `download_manifest.csv` row.
- Verified both timed-out PHY-212 warning URLs are present in `retry_manifest.csv`.
- Verified there are 0 placeholder `$CANVAS_COURSE_REFERENCE$` URLs in `retry_manifest.csv`.

## Next Stage Inputs

- Stage 6 should generate human-facing course maps and next-action views from:
  - `tasks.csv`
  - `task_evidence.csv`
  - `crosscheck_grades_tasks.csv`
  - `review_state_manifest.csv`
  - `retry_manifest.csv`
  - `download_manifest.csv`
  - `rule_improvement_manifest.csv`
- The first high-value reports should be:
  - `course_map.md` per course.
  - `next_actions.csv`.
  - `blocked_review.md`.
  - `upcoming_due_dates.csv`.
  - `required_prep.csv`.
  - `critical_setup.csv`.
