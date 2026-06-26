# Canvas Full-Capture Strategy

Explored against the active OSU Canvas courses on 2026-06-26.

## Finding

The best approach is a Canvas-aware rendered crawler, with Canvas API support as an optional structured-data layer. A generic scraper is not enough, and the previous pilot was only a surface index.

## What The Exploration Showed

- Top-level rendered pages are rich enough to crawl:
  - Modules pages contain complete module rows in the rendered DOM.
  - Grades pages contain gradebook rows and due dates.
  - Assignments pages matter when exposed, especially PHY-212.
  - Syllabus pages expose useful Course Summary due-date rows.
  - Discussions and Quizzes pages expose useful lists where enabled.
- Hidden endpoints often redirect:
  - MTH-252 and MTH-253 `/assignments` redirect to course home.
  - MTH-252 and PHY-212 `/quizzes` redirect to course home.
  - `/pages`, `/files`, and `/users` often redirect when hidden from course navigation, except PHY-212 People.
- Direct Canvas API URLs opened in the current Chrome-control surface are blocked with `net::ERR_BLOCKED_BY_CLIENT`.
  - This does not prove the API is unusable in a standalone authenticated crawler, but it means the crawler must not depend on direct browser navigation to `/api/v1/...`.
- Module item links are the critical recursion layer:
  - Canvas Page module items resolve to `/pages/...?...module_item_id=...` and contain page text plus Previous/Next links.
  - Attachment module items resolve to `/files/<id>?module_item_id=...` and expose direct download links like `/files/<id>/download?download_frd=1`.
  - Quiz items expose due date, availability, points, attempts, instructions, prerequisites, and sometimes Take Quiz links.
  - Assignment items expose due date, availability, points, prerequisites, rubric/template markup, and Previous/Next links.
  - Discussion items expose prompt text, replies, authors, and discussion controls.
  - External URL items can leave Canvas entirely and need domain-aware handling.
  - External Tool items may show only a launch/new-window page unless the tool iframe or new window is explicitly followed.

## Recommended Crawler Architecture

1. Course seed
   - Start from known course ids and course home URLs.
   - Record course navigation links and which common endpoints redirect.

2. Surface crawl
   - Visit and save these surfaces when accessible:
     - home
     - modules
     - assignments
     - grades
     - announcements
     - syllabus
     - discussions
     - quizzes
     - files/pages/people only if accessible

3. Module item crawl
   - Extract every module item URL from the Modules page.
   - Visit every module item URL.
   - Save the resolved URL because Canvas often redirects module item links to page/file/quiz/assignment/discussion URLs.
   - Preserve Previous/Next links but avoid infinite navigation loops by URL/content hash.

4. List item crawl
   - Extract links from Assignments, Grades, Syllabus Course Summary, Discussions, Announcements, and Quizzes.
   - Visit any Canvas-local item URL not already captured.
   - Keep source-surface evidence so duplicates are useful.

5. File capture
   - On `/files/<id>` pages, save:
     - preview HTML
     - canvadoc iframe URL metadata
     - direct download URL
     - downloaded file bytes, when explicitly enabled
   - Store files under `downloads/<course>/<file_id>-<name>`.

6. External capture
   - Classify external domains before following:
     - OpenStax/textbook: save page and direct PDF link.
     - YouTube/media: save title/URL/transcript if available.
     - Gradescope/Achieve/Pearson/Proctorio/Zoom: save launch page metadata and mark as external-tool requiring special handler.
   - Do not assume external tool iframe contents are captured unless verified.

7. Evidence preservation
   - For every visited page save:
     - raw HTML
     - extracted visible text
     - extracted full textContent
     - link inventory
     - iframe/embed inventory
     - form/button inventory
     - screenshot
     - JSON metadata
   - Do classification only after this raw evidence is saved.

## Artifact Layout

```text
canvas/archive/<run-id>/
  crawl_manifest.csv
  pages.csv
  links.csv
  iframes.csv
  downloads.csv
  raw_html/
  markdown/
  text/
  screenshots/
  metadata/
  downloads/
  normalized/
    tasks.csv
    task_evidence.csv
    prerequisites.csv
    review_queue.csv
    upcoming_actions.csv
```

## Capture Record Schema

Each page record should include:

- `page_id`
- `course_code`
- `course_id`
- `source_surface`
- `requested_url`
- `resolved_url`
- `canvas_object_type`
- `canvas_object_id`
- `title`
- `captured_at`
- `html_path`
- `markdown_path`
- `text_path`
- `screenshot_path`
- `metadata_path`
- `html_sha256`
- `text_sha256`
- `redirected`
- `requires_external_handler`
- `capture_warnings`

## Why This Beats The Pilot

- No truncation.
- Every module item gets visited, not just the module list row.
- Files get direct download URLs and optional byte-level capture.
- Quiz/assignment pages expose prerequisites and instructions that list views miss.
- Discussions can contain important instructor answers and student questions.
- The final navigator can cite exact evidence instead of trusting summaries.

## Remaining Decisions

- Whether to use a Canvas API token. If available, API should be used for structured module/assignment/page/file metadata, but rendered Playwright capture still remains necessary.
- Whether to download all files immediately or only record download URLs until explicitly requested.
- Whether to capture student discussion replies in full or only instructor/authored prompt plus metadata.
- How aggressively to follow external domains.
