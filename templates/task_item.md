# Task Item Template

Description: Reusable format for active tasks in `tasks/todo.md` and detailed task records in `tasks/task_log.csv`.

## Short Task

```md
- [ ] TASK-0001 | P1 | Course/Area | Short title - next action by YYYY-MM-DD
```

## Detailed Task

```md
- [ ] TASK-0001 | P1 | Course/Area | Short title - next action by YYYY-MM-DD
  - Details: [TASK-0001](#task-0001)

### TASK-0001 - Short Title

Title: Short human-readable task title.
Description: One or two sentences explaining the task.
Source: Email, Canvas, syllabus, instructor, self-created, or other.
Context: Link, message summary, assignment page, or note.
Next action:
Deadline:
Acceptance: What done means.
Blockers: Anything preventing completion.
Notes:
```

## CSV Schema

`task_id,title,description,created_date,updated_date,completed_date,status,priority,urgency_bucket,course_or_area,source,source_context,next_action,deadline,estimated_minutes,waiting_on,email_id,email_context,acceptance,notes`
