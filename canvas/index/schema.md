# Canvas Index Prototype Schema

This folder is a repo-local prototype for a paranoid Canvas course indexer.

## Files

- `courses.csv`: one row per Canvas course.
- `pages.csv`: one row per captured Canvas page/surface.
- `tasks.csv`: one row per actionable or potentially actionable item.
- `task_evidence.csv`: one row per source observation supporting a task.
- `review_queue.csv`: one row per uncertain, suspicious, or unmatched item.
- `raw/pilot.json`: raw structured extraction from the current pilot run.

## Surfaces

- `home`
- `modules`
- `assignments`
- `grades`
- `announcements`
- `syllabus`
- `discussions`
- `quizzes`

## Task Importance

- `required_graded`: appears graded or gradebook-backed.
- `required_ungraded_blocker`: required to proceed but not clearly graded.
- `prerequisite`: learning material, reading, lecture, setup, or instruction needed before a graded task.
- `useful_reference`: logistics or support info worth preserving.
- `optional`: explicitly optional and not needed for another task.
- `boilerplate_low_value`: generic policy/liability material with no identified task dependency.
- `unknown`: not safe to discard.

## Review Rules

- Every gradebook item should match a task or review row.
- Every assignment-page item should match a task or review row.
- Every module item with type Assignment, Quiz, Discussion Topic, External Tool, or must-view behavior should be classified.
- Every due date should attach to a task or review row.
- Mismatches between Modules, Assignments, and Grades are evidence, not errors to hide.
