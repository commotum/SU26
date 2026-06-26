# Recursive Canvas Indexer

Shorthand: `canvas-indexer`

## Big Picture Objective

Build a recursive-improvement Canvas indexer that turns the completed Canvas crawl archive into a verified, course-by-course action map. The output should let Jake see every graded task, required ungraded task, critical setup task, prerequisite/prep item, and relevant reference item without manually fighting Canvas organization.

The indexer must cross-check Modules, Assignments, Grades, Discussions, Quizzes, Files, and captured linked pages. It should preserve uncertainty instead of hiding it, then use review queues and follow-up passes to improve the map.

## Non-Negotiable Constraints

- Do not treat the raw crawl as the final task map.
- Every extracted task or requirement must cite one or more source page IDs and URLs.
- Preserve the difference between graded work, required ungraded work, prep work, reference material, boilerplate, and blocked/broken pages.
- Do not discard Canvas pages merely because they look like policy or boilerplate; classify them and keep evidence.
- Do not mark a course complete unless Modules, Assignments, Grades, and captured detail pages have been cross-checked.
- Do not claim a file/PDF has been read unless the binary was downloaded and parsed or the Canvas file landing page contains enough text to justify the claim.
- Do not hide capture failures. Timeouts, unauthorized pages, redirects, external-tool pages, and missing content must remain visible in a review queue.
- Prefer offline processing of the completed archive before doing more browser crawling.

## Current Facts

- Completed crawl archive: `/Users/jake/Developer/SU26/canvas/archive/full-fixed-2026-06-26T21-00-04-500Z`.
- Crawl summary: 584 captured URLs, 22,916 links, 1,314 iframes, 102 download links, `queued_remaining: 0`.
- Crawl did not hit its `max_pages: 900` guardrail.
- Page counts by course: MTH-252 311, MTH-253 128, PHY-212 145.
- Page object counts: assignment 145, page 126, quiz 100, module_item 85, discussion 54, file 52, plus course/section surfaces.
- Source kinds: surface 24, linked_detail 323, module_item 217, assignment_detail 20.
- 95 captured pages require or involve external handlers.
- 238 captured pages redirected.
- Two PHY-212 URLs timed out and are recorded in `warnings.json`.
- 102 downloadable files/PDF links are indexed in `downloads.csv`, but file binaries were not downloaded.
- Existing prototype index files live in `/Users/jake/Developer/SU26/canvas/index`, but they were based on the earlier pilot and not the completed full archive.
- Crawler code lives at `/Users/jake/Developer/SU26/canvas/crawler/canvas_full_capture.mjs`.
- Stage 1 readout script now lives at `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs`.
- Stage 1 readout outputs now live under `/Users/jake/Developer/SU26/canvas/indexer/output`.
- Stage 1 generated 3 course readout rows, 584 page inventory rows, 59 source-type count rows, and 390 capture issue rows.
- Capture issue breakdown from Stage 1: 2 capture failures, 238 redirects, 95 external-tool pages, 20 page-not-found pages, and 35 unauthorized pages.
- Stage 2 normalized graph outputs now exist under `/Users/jake/Developer/SU26/canvas/indexer/output`.
- Stage 2 generated 3 courses, 47 modules, 375 module items, 490 canvas objects, 584 object-page mappings, 1,061 object evidence rows, and 102 normalized downloads.
- Module item capture status from Stage 2: 295 captured destination pages, 17 structural/no-href rows, and 63 external unvisited rows.
- Stage 2 preserved 238 redirected captured pages in `object_pages.csv`.

## Assumptions

- The completed archive is the best initial source of truth for offline indexing.
- Module order and module item context are the best backbone for course organization when available.
- Assignments/Grades pages are cross-check surfaces, not replacements for Modules.
- Some Canvas pages expose useful task details only in hidden/screenreader text, metadata JSON, links, iframes, or redirected detail pages.
- A practical first classifier can be heuristic and evidence-heavy, then improve recursively from review results.

## Success Metrics

- Produce normalized CSV outputs from the completed archive, not hand-written summaries.
- Each task row has stable IDs, course code, title, category, status, due/availability information when present, source page IDs, source URLs, and confidence.
- Cross-check outputs identify items found in Modules but missing from Assignments/Grades, items in Assignments/Grades but missing from Modules, blocked/unauthorized/time-out items, and external-tool items.
- Review queue includes ambiguous, noisy, blocked, duplicate, and low-confidence items.
- A human can open a final course map and know what to do next without browsing Canvas.
- Verification commands prove the indexer reads the archive, writes expected CSVs, preserves warnings, and cites evidence for every task.

## Verification Requirements

- Run the indexer from a clean command against the completed archive.
- Confirm output CSV row counts and required columns.
- Confirm no task rows are missing evidence pointers.
- Confirm warnings from the crawl are represented in the review output.
- Confirm all three courses appear in course-level outputs.
- Spot-check at least one page per major object type: module item, assignment, quiz, discussion, file, grade surface, and module surface.

## Stages

### 1-READOUT

Status: complete as of 2026-06-26.

#### Big Picture Objective

Create the first-stage facts and guardrails for the indexer, then build a minimal offline readout that inventories the completed crawl archive into normalized tables.

#### Detailed Implementation Plan

- Create `goal-1/1-READOUT.md` and record current archive facts.
- Create `canvas/indexer/` with a script that reads the full archive offline.
- Parse `pages.csv`, `links.csv`, `downloads.csv`, `iframes.csv`, `warnings.json`, and per-page metadata JSON.
- Generate first-pass normalized outputs under `canvas/indexer/output/`.
- Include at least `course_readout.csv`, `page_inventory.csv`, `capture_issues.csv`, and `source_type_counts.csv`.

#### Completion Requirements

- Stage file records implementation, tests, and results.
- Script runs without network or browser access.
- Outputs include all three courses.
- Outputs preserve the two timed-out PHY-212 URLs.
- `0-plan.md` is updated with any changed facts.

Completion evidence:

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` produced readout outputs.
- `course_readout.csv` includes MTH-252, MTH-253, and PHY-212.
- `page_inventory.csv` includes 584 rows.
- `capture_issues.csv` includes both timed-out PHY-212 URLs.

### 2-NORMALIZE

Status: complete as of 2026-06-26.

#### Big Picture Objective

Build a stable course graph: course -> module -> module item -> destination page/file/assignment/quiz/discussion/evidence.

#### Detailed Implementation Plan

- Extract module item rows from module metadata and module-item captures.
- Assign stable IDs to module groups, module items, Canvas objects, download links, and evidence blocks.
- Deduplicate redirected pages and repeated linked detail pages without losing evidence.
- Produce `courses.csv`, `modules.csv`, `module_items.csv`, `canvas_objects.csv`, `object_evidence.csv`, and `downloads_normalized.csv`.

#### Completion Requirements

- Module item rows cite the module source page and destination page when available.
- Duplicate/redirect relationships are represented explicitly.
- Files/PDFs remain classified as indexed-not-read unless downloaded and parsed.
- Counts reconcile against `pages.csv` and metadata JSON.

Completion evidence:

- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` generated Stage 2 outputs.
- `module_items.csv` has 375 rows, reconciling exactly to Modules metadata.
- `object_pages.csv` has 584 rows, reconciling exactly to captured pages.
- `object_evidence.csv` has 1,061 rows: 584 page captures, 375 module item listings, and 102 download links.
- `downloads_normalized.csv` has 102 rows with `read_status=indexed_not_read`.
- Verification found 0 missing source page IDs, 0 missing destination object IDs, 0 invalid evidence object IDs, and 0 bad download statuses.

### 3-CLASSIFY

#### Big Picture Objective

Classify captured objects into actionable and non-actionable categories with evidence and confidence.

#### Detailed Implementation Plan

- Implement deterministic classifiers for obvious categories: graded assignment, quiz, discussion, file, lecture video, reading, practice, setup, syllabus/admin, policy/boilerplate, blocked, external-tool, reference.
- Extract due dates, availability windows, points, estimated time, module names, and requirement language from visible text, full text, metadata, and links.
- Emit `classified_items.csv`, `tasks.csv`, `task_evidence.csv`, and `review_queue.csv`.
- Keep multi-label classification where one item is both required and external-tool-backed, or both prep and graded.

#### Completion Requirements

- Every task row has at least one source page ID and URL.
- Low-confidence or conflicting items enter `review_queue.csv`.
- Classifier rules are documented in code or schema output.
- Spot checks confirm no obvious graded quiz/assignment is dropped.

### 4-CROSSCHECK

#### Big Picture Objective

Compare Modules, Assignments, Grades, and detail pages to detect omissions and inconsistencies.

#### Detailed Implementation Plan

- Build per-course joins between module items, assignment/detail captures, grade rows, quiz pages, discussion pages, and downloads.
- Emit `crosscheck_modules_assignments.csv`, `crosscheck_grades_tasks.csv`, and `missing_or_suspicious.csv`.
- Flag hidden assignments, grade-only tasks, module-only tasks, unauthorized pages, timeouts, and external-tool items.

#### Completion Requirements

- Each course has cross-check rows.
- Every warning from the crawl appears in a cross-check or review output.
- Cross-checks include counts and examples for human review.

### 5-RECURSE

#### Big Picture Objective

Create the recursive improvement loop that turns review findings into better rules or targeted recrawls.

#### Detailed Implementation Plan

- Define review states: `needs_rule`, `needs_retry`, `needs_download`, `needs_manual_decision`, `resolved`.
- Add a feedback input CSV that can override or confirm classifications.
- Make indexer reruns deterministic and preserve prior decisions.
- Prepare targeted retry/download manifests for the two timed-out PHY-212 URLs and the indexed PDFs/files.

#### Completion Requirements

- Rerunning with the same inputs produces stable outputs.
- Review overrides can change classifications without editing source captures.
- Retry/download manifests are generated but not executed without explicit approval.

### 6-REPORT

#### Big Picture Objective

Produce the human-facing course maps and next-action views.

#### Detailed Implementation Plan

- Generate `course_map.md` per course.
- Generate `next_actions.csv`, `upcoming_due_dates.csv`, `required_prep.csv`, `critical_setup.csv`, and `blocked_review.md`.
- Sort actions by course, module order, due date, and urgency.
- Link every action back to local markdown/metadata and original Canvas URL.

#### Completion Requirements

- All three course reports are generated.
- Reports separate required work from boilerplate and reference material.
- Each action has evidence links and confidence.
- Remaining uncertainty is explicit and reviewable.
