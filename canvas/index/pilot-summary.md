# Canvas Index Pilot Summary

Captured: 2026-06-26

## Outputs

- `courses.csv`: 3 courses
- `pages.csv`: 24 Canvas surfaces
- `tasks.csv`: 394 normalized task/content candidates
- `task_evidence.csv`: 532 evidence rows
- `review_queue.csv`: 197 review rows
- `next_actions.csv`: 108 due-date-backed graded items, including past items
- `upcoming_actions.csv`: 98 due-date-backed graded items due on or after 2026-06-26
- `raw/pilot.json`: full structured extraction
- `pages/*.md`: captured page markdown snapshots

## What Worked

- The cross-surface join works for the math courses: graded items from Grades match module items.
- PHY-212 correctly shows the opposite pattern: many actionable items are in Assignments/Grades but not Modules.
- Redirected/unavailable surfaces are captured instead of silently ignored.
- Grade-page due dates are now parsed into the action CSVs.

## Current Weak Spots

- `required_ungraded_blocker` is too noisy. Canvas "must view" rows include genuine setup tasks, support resources, optional videos, and boilerplate.
- MTH-252 review noise is dominated by extra content videos and support/resource module items.
- The pilot does not yet perform screenshot/vision verification.
- The pilot does not yet read individual module item pages recursively.
- The pilot does not yet normalize prerequisite relationships such as "watch lecture/read section before quiz."

## Next Classifiers

- `must_view_cleanup`: split must-view rows into blocker, prerequisite, reference, optional, and boilerplate.
- `resource_vs_task`: distinguish course resources from tasks with consequences.
- `external_tool_classifier`: classify Achieve, Gradescope, Pearson, Proctorio, Zoom, and generic external links.
- `prerequisite_linker`: connect learning-material pages/videos/readings to downstream quizzes/homework.
- `date_window_filter`: produce action lists up to a selected cutoff date.
- `vision_verifier`: compare screenshot-visible text against extracted markdown for pages with complex layout.
