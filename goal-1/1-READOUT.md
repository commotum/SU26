# 1-READOUT

## Current Facts

- Completed crawl archive: `/Users/jake/Developer/SU26/canvas/archive/full-fixed-2026-06-26T21-00-04-500Z`.
- Crawl summary reports 584 captured URLs, 22,916 links, 1,314 iframes, 102 download links, 2 warnings, and `queued_remaining: 0`.
- Page counts by course: MTH-252 311, MTH-253 128, PHY-212 145.
- Major object types include assignment, quiz, page, module item, discussion, file, module, grades, and course surfaces.
- Existing pilot index files in `canvas/index` predate the full crawl and should not be treated as authoritative.

## Updated Assumptions

- Offline archive processing is enough for the first readout stage.
- The two timed-out PHY-212 URLs should be preserved as capture issues.
- The indexer should write new outputs under `canvas/indexer/output` to avoid confusing them with the earlier pilot.
- Downloaded file/PDF parsing is out of scope for this first stage.

## Big Picture Objective

- Build the first offline readout of the completed Canvas archive and establish the output layout for recursive indexing.

## Detailed Implementation Plan

- Create `canvas/indexer/`.
- Add a dependency-free script that reads the completed archive.
- Parse top-level CSVs and JSON files.
- Read per-page metadata enough to produce inventory counts and issue rows.
- Write normalized first-stage CSVs to `canvas/indexer/output/`.
- Verify that all courses and warnings are represented.

## No-Cheating Checks

- Script must read from the completed `full-fixed` archive, not from the earlier pilot outputs.
- Script must not use browser or network access.
- Capture warnings must be included in generated outputs.
- Course/task outputs must include source page IDs or URLs where applicable.

## Completion Requirements

- `canvas/indexer/index_canvas_archive.mjs` exists and runs with `node`.
- Output folder contains `course_readout.csv`, `page_inventory.csv`, `source_type_counts.csv`, and `capture_issues.csv`.
- Verification confirms all three courses appear.
- Verification confirms the two PHY-212 timed-out URLs appear in capture issues.
- Stage results are recorded here.

## Stage Results

- Created `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs`.
- Created `/Users/jake/Developer/SU26/canvas/indexer/output`.
- Generated:
  - `course_readout.csv` with 3 course rows.
  - `page_inventory.csv` with 584 page rows.
  - `source_type_counts.csv` with 59 grouped rows.
  - `capture_issues.csv` with 390 issue rows.
  - `readout_summary.json`.
- Verification commands run:
  - `node --check canvas/indexer/index_canvas_archive.mjs` passed.
  - `node canvas/indexer/index_canvas_archive.mjs` completed and reported 584 pages, 3 courses, and 390 capture issues.
  - CSV verification confirmed required outputs and columns.
  - `rg -n "10556974|11563804|capture_failed" canvas/indexer/output/capture_issues.csv` confirmed both timed-out PHY-212 URLs are preserved.
- Issue breakdown:
  - 2 `capture_failed`.
  - 238 `redirected`.
  - 95 `external_tool`.
  - 20 `page_not_found`.
  - 35 `unauthorized`.
- What changed for `0-plan.md`:
  - Stage 1 is complete.
  - Stage 2 should build the normalized course graph from the readout outputs plus original archive metadata.
  - The issue queue is nontrivial and should be used as a first-class input to later stages, not treated as noise.
