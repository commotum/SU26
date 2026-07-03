---
name: load-inbox
description: Load recent Outlook Inbox messages into emails/staged.csv using only surface metadata, including both read and unread messages when a bounded date-window import is requested. Use when Codex needs to inventory unprocessed messages from the saved import checkpoint or a requested start date, distinguish unprocessed staged rows from Outlook read/unread state, compare against hot/cold/staged CSV state, and leave judgment fields empty for read-email.
---

# Load Inbox

## Purpose

Inventory recent Outlook Inbox messages without making content-level judgments. This skill loads one surface-metadata row per unprocessed message into `emails/staged.csv`.

Do not treat Outlook `read/unread` as the same thing as `unprocessed`.

- `unprocessed`: a message exists in `staged.csv` and has not been fully read.
- `unread`: Outlook mailbox state used for visibility. Some processed `hot.csv` messages intentionally remain unread for the user.
- `read`: Outlook mailbox state only. A read Inbox message may still be unprocessed if it has not been captured in `hot.csv`, `cold.csv`, or `staged.csv`.

## Queue Files

Use these workspace files unless the user gives different paths:

- `emails/staged.csv`: surface-loaded messages waiting for a full read.
- `emails/hot.csv`: fully read messages that should remain unread for user attention.
- `emails/cold.csv`: fully read messages that do not need to remain unread and can be/read as processed.
- `emails/import_state.csv`: checkpoint state for the latest fully processed Inbox day.
- `emails/auto_cold_rules.csv`: user-approved allowlist for messages that may be colded from surface metadata.
- `emails/auto_cold_log.csv`: required log of every auto-colded message.
- `templates/schema.md`

All three CSVs use the same header. Keep `message_id` as the first column and `received_date` as the second column. Store exact received datetimes as `YYYY-MM-DD HH:MM` when Outlook exposes a time; otherwise store the normalized date-only value as provisional surface metadata for `read-email` to upgrade after opening.

## Source Scope

Default to a bounded date-window Inbox import, not a complete mailbox history. For the SU26 workspace, when the user gives no explicit lower bound, read `emails/import_state.csv` first and use the day after `latest_fully_processed_date` as the inclusive start date. If the state file is missing or has no checkpoint, use the SU26 start-of-term fallback `2026-06-14`.

`latest_fully_processed_date` is a local calendar day, not a message timestamp. It means every Inbox message received on or before 23:59:59 America/Los_Angeles on that date has already been loaded, deduped, fully processed, and removed from `staged.csv`.

Do not use today's date as `latest_fully_processed_date` during a same-day run. New Inbox messages can still arrive later on the same calendar day. The normal next checkpoint after a successful run is yesterday's local date, unless the user explicitly closes an older bounded historical range.

If the user gives an explicit start date, audit date, or unread-only scope, use the user-provided scope instead of the checkpoint. Do not overwrite or advance `emails/import_state.csv` during `load-inbox`; only `do-email` should advance it after all staged rows are processed successfully.

In date-window mode:

- Include both read and unread messages that hit the Inbox on or after the start date.
- Do not use `isread:no` as the source query.
- Use Outlook search, date filters, or careful Inbox scrolling to collect every Inbox result in the date window.
- Do not import the complete email history; stop when the visible results are older than the start date.
- Record each row's Outlook state as read or unread in `notes`.

If the user explicitly requests an unread-only pass, it is acceptable to use Outlook search `isread:no`; in that mode, a match in `cold.csv` remains a hard process error.

Stage every candidate in the source scope first. Do not skip candidates during browser collection just because they look like hot/cold/staged duplicates.

After staging, run `scripts/dedupe_email_queues.py` to compare `staged.csv` against `hot.csv`, `cold.csv`, and itself. For date-window imports that include read messages, run it with `--cold-action remove`; already-cold rows are expected duplicates and should be removed after staging. For unread-only imports, use the default cold behavior; a `cold.csv` match is a hard process error because cold items should have been marked read and should not reappear in an unread-only load.

The dedupe script uses the full composite identity key first. When comparing staged rows to already-processed `hot.csv` or `cold.csv` rows, it may also use exact timestamp and date+preview fallbacks, because processed rows often contain full-read notes rather than the original message-list raw text.

After dedupe, run `scripts/auto_cold_email_queues.py --list` to identify staged rows that match enabled rules in `emails/auto_cold_rules.csv`. Do not move those rows or change Outlook state during `load-inbox`; report the auto-cold candidates for the next auto-cold/read pass.

## Queue Order And IDs

- `staged.csv` is the work queue and must be sorted oldest-to-newest by `received_date`.
- Outlook search results are usually newest-first; reverse or sort collected rows before finalizing `staged.csv`.
- Use temporary ids during browser collection if needed, but assign final `EMAIL-*` ids only after dedupe and chronological sorting.
- Final staged ids must not collide with ids already present in `staged.csv`, `hot.csv`, or `cold.csv`, because `read-email` preserves `message_id` when moving rows and the queue helpers reject cross-file collisions.
- For a completely empty three-file queue, `EMAIL-0001` is the oldest queue row and the largest id is the newest queue row. When `hot.csv` or `cold.csv` already contain ids, use the next unused `EMAIL-*` values while assigning them in staged chronological order.
- If processed `hot.csv` or `cold.csv` rows already have linked tasks or notes, do not renumber them unless explicitly repairing queue indexing; when renumbering processed rows, update every task/email reference in the same turn.

## Composite Identity Key

Use this identity key for candidate comparison and deduplication:

`sender_normalized + subject_normalized + received_datetime_normalized + preview_normalized + raw_outlook_row_text_or_aria_label`

Rules:

- Normalize whitespace and obvious HTML entities before comparison.
- Normalize Outlook date displays before comparison. Accepted inputs include list displays such as `Fri 5/29`, exact Outlook headers such as `Fri 5/29/2026 7:38 AM`, and CSV values such as `2026-05-29 07:38`.
- Use exact datetimes when available. Treat date-only values as provisional, not equivalent to an exact datetime for duplicate-subject messages.
- Preserve the raw Outlook row text or `aria-label` in `email_link_or_context` or `notes` even after normalization.
- Treat two rows with the same sender, subject, and date as distinct when the exact time, preview, or raw row text differs.
- Do not derive final `EMAIL-*` ordering from Outlook's newest-first collection order. Final staged order comes from chronological queue position after dedupe and sorting; the numeric starting point is only adjusted when needed to avoid collisions with existing queue ids.

## Outlook Collection Guidance

Use Chrome Outlook only when authorized. Reading message-list previews is allowed. Do not open message bodies.

Outlook Web facts to account for:

- The search input may appear as `aria-label="Search"` or `aria-label="Search for email, meetings, files and more."`.
- Outlook lists are virtualized; large scroll jumps can skip rows.
- Collect with small overlapping scroll steps.
- For date-window imports, verify coverage by comparing at least two collection passes or by confirming the newest-to-oldest result set reaches past the inclusive start date with no gaps visible in the overlapping scrolls.
- For unread-only imports, run at least two passes or otherwise verify the result against the unread badge/count when using `isread:no`.
- Preserve raw row text or `aria-label` in `email_link_or_context` or `notes` for later lookup.

## Auto-Cold Candidates

The user has approved the enabled rules in `emails/auto_cold_rules.csv` to be auto-colded as long as each processed message is logged in `emails/auto_cold_log.csv`.

`load-inbox` only identifies these candidates. It must not mark read or move rows. The read/auto-cold pass must verify mailbox state, move verified rows to `cold.csv`, and append the log entry.

Use:

`python3 /Users/jake/.codex/skills/load-inbox/scripts/auto_cold_email_queues.py --list`

Report the candidate count and rule ids/names with the load summary.

## Workflow

1. Read `staged.csv`, `hot.csv`, `cold.csv`, `emails/import_state.csv` if present, and the schema.
2. Determine the source scope:
   - Default/current-term import: Inbox messages received on or after the effective checkpoint start date. Use the day after `emails/import_state.csv` `latest_fully_processed_date`; if no checkpoint exists, use inclusive start date `2026-06-14`.
   - Explicit bounded import: Inbox messages received on or after the user-requested start date; this overrides the checkpoint for that run.
   - Explicit unread-only import: unread Inbox messages only, usually with `isread:no`.
3. Query or navigate Outlook for every candidate in scope.
4. Collect surface metadata only:
   - sender
   - subject
   - displayed received date/time, normalized to `YYYY-MM-DD HH:MM` when a time is available
   - preview/snippet
   - attachment indicator if visible
   - Outlook unread/read state
   - raw row text or aria-label
5. Append every collected candidate to `staged.csv`; do not pre-skip suspected duplicates.
6. Treat any ids used during collection as temporary until dedupe and chronological sorting are complete.
7. Populate only surface/load fields:
   - `message_id`
   - `title` from subject or sender/subject
   - `description` from preview/snippet only
   - `triaged_date`
   - `received_date` from normalized Outlook display date/time; if Outlook only exposes a date, keep date-only and note that it is provisional
   - `sender`
   - `subject`
   - `status=needs_review`
   - `mailbox_action=none`
   - `email_link_or_context` with search context and/or raw row text
   - `notes` with Outlook state and collection notes
8. Leave these staged columns blank because `read-email` must fill them after reading the full body:
   - `course_or_area`
   - `category`
   - `email_type`
   - `importance`
   - `priority`
   - `decision`
   - `next_action`
   - `deadline`
   - `task_id`
9. Run the bundled dedupe script from the workspace root.

   For date-window imports that include read messages:

   `python3 /Users/jake/.codex/skills/load-inbox/scripts/dedupe_email_queues.py --emails-dir emails --cold-action remove`

   For explicit unread-only imports:

   `python3 /Users/jake/.codex/skills/load-inbox/scripts/dedupe_email_queues.py --emails-dir emails`

10. Run the auto-cold candidate listing:

   `python3 /Users/jake/.codex/skills/load-inbox/scripts/auto_cold_email_queues.py --list`

11. Normalize all three queue headers to keep `received_date` second, sort `staged.csv` oldest-to-newest by normalized received datetime/date, then assign final non-colliding `EMAIL-*` ids in chronological queue position.
12. Validate CSV column counts and verify the first staged row is the oldest unprocessed message.
13. Do not mark read/unread, archive, delete, move, flag, categorize, create rules, unsubscribe, or send.

## Output

Report:

- source scope used, including whether read messages were included and the inclusive start date for date-window imports
- checkpoint state read from `emails/import_state.csv`, if any, and the effective start date derived from it
- number of candidates collected
- number appended to `staged.csv` before dedupe
- dedupe script results: removed already-hot rows, removed already-cold rows when `--cold-action remove` was used, removed duplicate staged rows, final staged count
- final staged order: first and last staged `message_id`, `received_date`, and subject
- auto-cold candidate count by rule id/name
- any cold conflict error; stop and report it instead of continuing if one occurs during an unread-only import
- whether source coverage was verified: for date-window imports, confirm coverage reached older than the start date; for unread-only imports, reconcile with Outlook's unread count or report the discrepancy
- whether any mailbox state was changed; this should be `none`
