# 3-CLASSIFY

## Current Facts

- Stage 1 and Stage 2 are complete and verified.
- Normalized graph outputs exist in `/Users/jake/Developer/SU26/canvas/indexer/output`.
- The graph has 3 courses, 47 modules, 375 module items, 490 canvas objects, 584 object-page mappings, 1,061 evidence rows, and 102 normalized downloads.
- Module item capture statuses are 295 `captured`, 17 `structural_no_href`, and 63 `external_unvisited`.
- Capture issues include redirects, external-tool pages, page-not-found pages, unauthorized pages, and two PHY-212 capture failures.

## Updated Assumptions

- A deterministic first classifier is acceptable if it preserves evidence and sends ambiguous/blocked cases to review.
- Graded tasks can be initially inferred from Canvas object type, title signals, and captured assignment/quiz/discussion detail pages.
- Required ungraded/prep/reference/admin distinctions should be multi-label, not mutually exclusive.
- Classifier output should be rerunnable from the same archive and normalized graph with stable task IDs.

## Big Picture Objective

- Classify captured and module-listed Canvas objects into actionable task categories, prep/reference categories, and review states with evidence pointers.

## Detailed Implementation Plan

- Extend `canvas/indexer/index_canvas_archive.mjs`.
- Add deterministic rule-based classification functions.
- Emit:
  - `classified_items.csv`
  - `tasks.csv`
  - `task_evidence.csv`
  - `review_queue.csv`
  - `classification_rules.csv`
- Extract due/availability/points/time hints from captured page text where available.
- Make every task cite source evidence.
- Route low-confidence, blocked, external, unauthorized, page-not-found, not-downloaded, and structural/no-href cases to review.

## No-Cheating Checks

- Do not classify a PDF/download as read.
- Do not drop blocked or unauthorized objects.
- Do not produce task rows without evidence.
- Do not use a single label when multiple labels are supported by the evidence.
- Do not call the classifier final; this is the first deterministic pass for recursive improvement.

## Completion Requirements

- Script passes `node --check`.
- Script runs offline with `node canvas/indexer/index_canvas_archive.mjs`.
- `classified_items.csv`, `tasks.csv`, `task_evidence.csv`, `review_queue.csv`, and `classification_rules.csv` exist.
- Every task row has at least one task evidence row.
- Every task evidence row points to a known task and known object/evidence source.
- Review queue includes external/blocked/download-not-read classes.
- All three courses appear in classified/task outputs where applicable.
- Stage results are recorded here and folded into `0-plan.md`.

## Stage Results

- Pending.

