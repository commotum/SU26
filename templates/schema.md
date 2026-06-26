# Summer Term Schema

Description: Stable field definitions for the task and email tracking files.

## Shared Rules

- Every item has an ID, title, and description.
- The title is a short label for scanning.
- The description is one sentence that explains why the item exists.
- Markdown files are the working interface.
- CSV files are the structured history and sorting layer.
- Add a Markdown detail block only when the title and description are not enough.

## Task IDs

Use `TASK-0001`, `TASK-0002`, and so on.

## Email IDs

Use `EMAIL-0001`, `EMAIL-0002`, and so on.

## Task Status Values

`todo`, `doing`, `waiting`, `deferred`, `completed`, `cancelled`

## Task Responsibility Values

`user`, `codex`, `shared`, `external`

## Email Status Values

`needs_review`, `actionable`, `waiting`, `reference`, `archived`, `deleted`, `noise`

## Priority Values

`P0`, `P1`, `P2`, `P3`

## Urgency Buckets

`today`, `this_week`, `upcoming`, `waiting`, `someday`
