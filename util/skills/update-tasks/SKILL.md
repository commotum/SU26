---
name: update-tasks
description: Reconcile SU26 course tasks across overview.md, Canvas live todo surfaces, Canvas index outputs, weekly checklist files, and active todo tracking. Use when Codex needs to audit, update, repair, or explain what belongs in tasks/weeks/*.md, tasks/todo.md, or tasks/task_log.csv; when checking missing Canvas assignments; when comparing weekly lists against Canvas; or when doing the daily Canvas task check without running the full scraper.
---

# Update Tasks

## Purpose

Use this skill to decide what should be on the SU26 task lists and to update them without losing the user's personal checklist state.

The core mistake to avoid: do not rely on one Canvas output. Use `overview.md` as the expectation model, then verify each expected category against all available Canvas surfaces.

## Workspace Files

Default paths:

- `/Users/jake/Developer/SU26/overview.md`: expectation model for courses, categories, weights, weekly load, and exam schedule.
- `/Users/jake/Developer/SU26/tasks/weeks/`: personal weekly checklists.
- `/Users/jake/Developer/SU26/tasks/todo.md`: active task surface.
- `/Users/jake/Developer/SU26/tasks/task_log.csv`: durable task log.
- `/Users/jake/Developer/SU26/canvas/indexer/output/`: indexed Canvas outputs.
- `/Users/jake/Developer/SU26/canvas/archive/`: archived Canvas page captures.

Treat `tasks/weeks/*.md` as user-owned personal records. Edit them only when the user explicitly asks. Preserve checkbox states unless the user explicitly asks to mark items complete/incomplete.

## Source Priority

Use these sources together, not as a strict replacement chain:

1. `overview.md`: expected categories and rough counts. If it says a category exists, actively look for that category.
2. Live Canvas daily todo, preferably the Better Canvas todo surface, when the user asks for a current check or daily update.
3. `canvas/indexer/output/due_dates.csv`: hard due-date rows.
4. `canvas/indexer/output/tasks.csv`: all extracted tasks, including no-due/manual-review/access-deferred rows.
5. `canvas/indexer/output/next_actions.csv` and `missing_or_suspicious.csv`: items that need manual review.
6. Course maps and reports under `canvas/indexer/output/reports/`.
7. Syllabus, assignment-list, gradebook, module, and discussion pages under `canvas/archive/.../markdown` and `text`.
8. Instructor emails or task records only as supporting evidence; do not let them override current Canvas without noting the conflict.

Never treat `due_dates.csv` as complete by itself. It misses no-due tasks, blocked/external tool pages, access-denied details, syllabus-only due rows, and category expectations from `overview.md`.

## Expectation Model

Read `overview.md` before auditing. For each course, create an expected category checklist:

- MTH-252: exams, Achieve homework, WHW, Discussion Reflections, Reading Quizzes.
- MTH-253: unit quizzes/final, Achieve web homework, written homework, discussion boards.
- PH 212: quizzes/final, homework, lab discussions/prep, lab reports, lab surveys/check-ins, participation, pre-lecture questions.

For each week under review, compare actual weekly list content against these categories. A category with no found items is not automatically empty; it is a search failure until checked against Canvas course maps, syllabus summaries, modules, and manual-review rows.

## Live Canvas Daily Check

When the user wants the current Canvas check and does not ask to run the scraper:

1. Use the logged-in browser/Chrome state when available.
2. Open Canvas dashboard or course pages as needed.
3. Inspect the Better Canvas todo surface first. Candidate selectors include `bettercanvas-todo-list`, `.bettercanvas-todo-list`, and elements/classes containing both `bettercanvas` and `todo`.
4. Capture each visible item with course, title, due/open text, link URL, points if visible, and completion/availability state if visible.
5. Cross-check visible live items against weekly lists and `tasks/todo.md`.
6. If the Better Canvas element is absent, report that and fall back to Canvas native To Do, Calendar/Syllabus, course assignments, and local indexed outputs.

Do not run the full Canvas scraper unless the user explicitly asks for a scrape.

## Audit Workflow

1. Read `overview.md`.
2. Read the target weekly files and active task files.
3. Determine the date range from the weekly file titles or the user's requested scope.
4. Build a candidate ledger from every relevant source. Include:
   - course
   - category from `overview.md`
   - title
   - due date/time or no-due status
   - points/weight when known
   - source file/URL
   - confidence: confirmed, inferred, live-only, no-due, access-deferred, or uncertain
5. Deduplicate by normalized course + title + Canvas object URL/id. Keep alternate surfaces as evidence rather than separate checklist items.
6. Compare the ledger to the existing weekly/task files.
7. Separate findings into:
   - missing entries
   - present but wrong date/time/title/category
   - duplicates
   - uncertain/manual-review items
   - future weeks missing entirely
8. If updating files, patch only the requested targets.

## Editing Rules

- Use `apply_patch` for manual edits.
- Preserve existing checkbox state exactly.
- New weekly checklist entries default to `- [ ]`.
- Do not mark anything complete/incomplete unless the user explicitly asks.
- Do not remove or rewrite unrelated personal notes.
- Maintain the existing course headings and category organization unless the user asks to reorganize.
- Add a category heading only when needed by a missing item.
- Sort items within each course/category by due date/time. Put undated items after dated items unless course context makes a different placement clearly better.
- Use exact dates when known. If a date/time is inferred, either verify it or label it as inferred/uncertain in the report.
- When an existing date is wrong and the user asked not to change dates, report the mismatch instead of editing it.
- When a Canvas item is access-denied or an external tool, search modules/course maps/syllabus for instructions before deciding it is irrelevant.

## Verification

Before final response:

1. Run `git diff --check` on edited files.
2. Re-read the edited sections.
3. Count category-specific expectations when relevant. For example, PH 212 weekly pre-lecture/participation should be checked against the lecture calendar and any known cancellations.
4. Confirm no checkbox state changed unless explicitly requested.
5. Report files updated and any residual uncertain items.

## Reporting

Be explicit about source coverage:

- Say whether live Canvas/Better Canvas was checked.
- Say which local Canvas outputs were used.
- Say which weekly/task files were changed.
- List unresolved conflicts or uncertain items separately.
- If a task was missed because one source did not contain it, name the missing source and the source that did contain it.
