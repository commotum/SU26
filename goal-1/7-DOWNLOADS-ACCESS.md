# 7-DOWNLOADS-ACCESS

## Status

Complete for this pass as of 2026-06-26.

## Objective

Bring already downloaded Canvas files into the repo, parse what can be parsed, and investigate unauthorized/failed Canvas pages so unresolved items are not all treated as generic blockers.

## Implementation

- Added `/Users/jake/Developer/SU26/canvas/indexer/ingest_downloaded_files.py`.
- Added `/Users/jake/Developer/SU26/canvas/indexer/investigate_access_issues.py`.
- Updated `/Users/jake/Developer/SU26/canvas/indexer/index_canvas_archive.mjs` to ingest parsed download text as object evidence.
- Added explicit statuses for downloaded files that produced empty text and need OCR/vision extraction.
- Added `/Users/jake/Developer/SU26/canvas/indexer/input/download_text_overrides.csv` for reproducible visual/OCR text overrides.
- Added Chrome-assisted file downloading through Canvas file preview pages, copying completed downloads into the repo.
- Used live Chrome retries for the 18 access rows that could not be resolved offline.

## Download Results

- Download manifest rows: 102.
- Repo-local unique files: 33.
- Parsed unique files: 33.
- Fully parsed manifest rows: 98.
- Downloaded but OCR/vision needed: 0 rows.
- Still not downloaded: 4 rows, covering 2 unique old-course MTH 252 links:
  - `IVP-Wksht1.pdf`, `https://canvas.oregonstate.edu/courses/1918585/files/99187575/download?download_frd=1`
  - `IVP-Wksht2.pdf`, `https://canvas.oregonstate.edu/courses/1918585/files/99187581/download?download_frd=1`
- The old-course links appear inside the current MTH 252 `Mini-Exam 2 - Retake` assignment under `Practice Problems` for OpenStax V1 section 4.10 Antiderivatives. The required retake template file itself downloaded and parsed successfully.
- Browser download batch result: 28 of 30 queued unique files downloaded into the repo; the 2 failures are the old-course unauthorized links above.
- Machine/vision OCR overrides now cover:
  - `PHY-212` `M1-00.pdf`
  - `PHY-212` `M1-01.pdf`
  - `MTH-252` `Lecture-2.3-2.4.pdf`
  - `MTH-252` `Lecture-3.1-3.2.pdf`

Repo outputs:

- `/Users/jake/Developer/SU26/canvas/indexer/output/downloaded_files_manifest.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/parsed_downloads.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/download_execution_status.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/download_batch_plan.json`
- `/Users/jake/Developer/SU26/canvas/indexer/output/download_browser_batch_status.json`
- `/Users/jake/Developer/SU26/canvas/indexer/output/download_browser_batch_status.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/downloaded_files/`
- `/Users/jake/Developer/SU26/canvas/indexer/output/parsed_files/`
- `/Users/jake/Developer/SU26/canvas/indexer/output/ocr_images/`

## Access Results

- Access investigation rows: 37.
- Live retried rows: 18.
- Internal Canvas question URLs resolved through already captured parent quizzes: 19.
- Expected Access Denied before item release, based on the source module page or Lab 2 announcement/context: 16.
- Explicit future lock found live: 1, `Lab Collaboration Contract`.
- Previously timed-out discussion captured live: 1, `Lab 1 Discussion - Lab Group 22`.
- Still access-denied and worth retry/manual follow-up: 0.
- `Lab 2 Group Report` is now classified as expected future access denial. Live Chrome still showed Access Denied, but the current course context says Lab 2 group reports begin next week after groups are formed.

Repo outputs:

- `/Users/jake/Developer/SU26/canvas/indexer/output/unauthorized_investigation.csv`
- `/Users/jake/Developer/SU26/canvas/indexer/output/live_access_retry.csv`

## Rate-Limit Assessment

The failures do not look like Canvas rate limiting. Live retries completed; the two timeout rows loaded with real Canvas content or lock text; the remaining failures were specific `Access Denied` pages. The source module page explicitly says some PHY pre-lecture/participation items show Access Denied before they open.

## Verification

- `python3 -m py_compile canvas/indexer/ingest_downloaded_files.py` passed.
- `python3 -m py_compile canvas/indexer/investigate_access_issues.py` passed.
- `node --check canvas/indexer/index_canvas_archive.mjs` passed.
- `node canvas/indexer/index_canvas_archive.mjs` passed after parsed-download integration, browser downloads, OCR overrides, and access-resolution cleanup.
- Live access retry wrote 18 rows to `live_access_retry.csv`.
- Final `retry_manifest.csv` has 0 URLs.
- Final download counts:
  - `downloaded_and_parsed`: 98 manifest rows.
  - `queued_not_executed`: 4 manifest rows, all old-course unauthorized worksheet links.
- Final recursive counts:
  - `review_state_manifest`: 386.
  - `retry_manifest`: 0.
  - `rule_improvement_manifest`: 3.
  - `manual_review_manifest`: 336.
