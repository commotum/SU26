# 2-NORMALIZE

## Current Facts

- Stage 1 is complete and verified.
- The authoritative archive remains `/Users/jake/Developer/SU26/canvas/archive/full-fixed-2026-06-26T21-00-04-500Z`.
- The three Modules surface metadata files contain `module_items` arrays:
  - MTH-252 Modules page has 274 module item rows.
  - MTH-253 Modules page has 63 module item rows.
  - PHY-212 Modules page has 38 module item rows.
- Module item captures resolve from `/modules/items/<id>` to concrete Canvas pages such as quizzes, assignments, pages, files, or discussions, often with `module_item_id=<id>` in the URL.
- Some module rows are external URLs or subheaders that do not have a Canvas destination page.
- Grade rows and assignment rows exist in metadata and will be cross-check inputs later, not the module backbone for this stage.

## Updated Assumptions

- Module order should come from first appearance in the Modules page metadata.
- Module item order should come from item `index` in the source Modules page metadata.
- A module item can be matched to a captured destination page by exact requested URL or by resolved URL `module_item_id`.
- Downloads should stay `indexed_not_read` until a later stage downloads and parses binaries.
- Redirected duplicate pages should be represented through object/evidence rows rather than deleted.

## Big Picture Objective

- Build a stable normalized course graph: course -> module -> module item -> Canvas object/download/evidence.

## Detailed Implementation Plan

- Extend `canvas/indexer/index_canvas_archive.mjs`.
- Add normalized outputs:
  - `courses.csv`
  - `modules.csv`
  - `module_items.csv`
  - `canvas_objects.csv`
  - `object_evidence.csv`
  - `downloads_normalized.csv`
- Preserve all Stage 1 outputs.
- Verify module item counts reconcile to metadata.
- Verify module item destination evidence exists where Canvas destination pages were captured.
- Verify downloads are explicitly marked `indexed_not_read`.

## No-Cheating Checks

- Do not infer module membership from title matching when module metadata gives explicit item rows.
- Do not delete duplicate or redirected pages; preserve them as evidence.
- Do not treat external URLs or PDFs/files as read.
- Do not claim unvisited module rows have destination page evidence.

## Completion Requirements

- Script passes `node --check`.
- Script runs offline with `node canvas/indexer/index_canvas_archive.mjs`.
- Generated `modules.csv` has module rows for all three courses.
- Generated `module_items.csv` has 375 module item rows.
- Every module item row cites a module source page ID.
- Captured module item rows have destination page IDs when exact/archive evidence exists.
- Generated `canvas_objects.csv` includes all captured pages and unvisited module targets.
- Generated `object_evidence.csv` includes module item, page capture, and download evidence.
- Generated `downloads_normalized.csv` has 102 rows with `read_status=indexed_not_read`.
- Stage results are recorded here and folded into `0-plan.md`.

## Stage Results

- Extended `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs` to build normalized graph outputs while preserving Stage 1 outputs.
- Generated:
  - `courses.csv` with 3 rows.
  - `modules.csv` with 47 rows.
  - `module_items.csv` with 375 rows.
  - `canvas_objects.csv` with 490 rows.
  - `object_pages.csv` with 584 rows.
  - `object_evidence.csv` with 1,061 rows.
  - `downloads_normalized.csv` with 102 rows.
- Module item counts reconcile exactly to Modules metadata:
  - MTH-252: 274.
  - MTH-253: 63.
  - PHY-212: 38.
- Module item destination status:
  - 295 `captured`.
  - 17 `structural_no_href`.
  - 63 `external_unvisited`.
- Evidence rows by type:
  - 584 `page_capture`.
  - 375 `module_item_listing`.
  - 102 `download_link`.
- Verification commands run:
  - `node --check canvas/indexer/index_canvas_archive.mjs` passed.
  - `node canvas/indexer/index_canvas_archive.mjs` completed and reported normalized graph counts.
  - Reconciliation script confirmed 375 metadata module items equals 375 module item output rows.
  - Reconciliation script confirmed 584 captured pages equals 584 object-page rows.
  - Reconciliation script confirmed 0 missing source page IDs, 0 missing destination object IDs, 0 captured module items without destination pages, 0 invalid evidence object IDs, 0 invalid object-page mappings, and 0 downloads missing `indexed_not_read`.
  - `git diff --check -- goal-1 canvas/indexer` passed.
- What changed for `0-plan.md`:
  - Stage 2 is complete.
  - Stage 3 can classify against `module_items.csv`, `canvas_objects.csv`, `object_pages.csv`, `object_evidence.csv`, `downloads_normalized.csv`, and original metadata/markdown.
  - The classifier should treat `external_unvisited`, `structural_no_href`, redirects, unauthorized pages, and indexed-not-read downloads as first-class review/classification states.
