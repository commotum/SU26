---
name: read-email
description: Fully read one staged Outlook email, classify it, move it from emails/staged.csv to emails/hot.csv or emails/cold.csv, and manage read/unread state. Use when Codex must process a single staged message, read the full body, create tasks if needed, preserve unread for personal or high/critical irregular messages, and mark routine cold messages read.
---

# Read Email

## Purpose

Process exactly one row from `emails/staged.csv` after reading the full message body. Move the completed row to either `hot.csv` or `cold.csv`, then remove it from `staged.csv`.

Do not conflate these states:

- `unprocessed`: a message is in `staged.csv`.
- `unread`: Outlook mailbox state. Processed hot messages may intentionally remain unread.

## Queue Files

Use the workspace files unless the user gives different paths:

- `emails/staged.csv`: unprocessed queue loaded from Outlook surface metadata.
- `emails/hot.csv`: processed messages that should remain unread for user attention.
- `emails/cold.csv`: processed messages that can be/read as done.
- `emails/auto_cold_rules.csv`: user-approved allowlist of messages that may be colded from surface metadata.
- `emails/auto_cold_log.csv`: required log for every auto-colded message.
- `emails/emails.md`
- `tasks/todo.md`
- `tasks/task_log.csv`
- `templates/schema.md`

All three CSVs use the same schema and header order. Keep `message_id` as the first column and `received_date` as the second column.

## Auto-Cold Allowlist

The user has approved auto-colding enabled rules in `emails/auto_cold_rules.csv` as long as every message is logged in `emails/auto_cold_log.csv`.

Auto-cold is an explicit exception to the full-body-read workflow. Use it only when a staged row matches an enabled allowlist rule by surface metadata.

For an auto-cold row:

- Do not open the full message body unless needed to disambiguate the staged row.
- Verify the staged row matches exactly one enabled rule from `emails/auto_cold_rules.csv`.
- Locate the exact Outlook row from sender, subject, received display, preview, and raw row context.
- Mark the exact Outlook message read.
- Verify the exact message no longer appears in unread search.
- Move the row from `staged.csv` to `cold.csv` using the matched rule's classification fields.
- Preserve the `message_id`.
- Keep date-only `received_date` values when no exact header time is available; note that the row was auto-colded from surface metadata.
- Append one row to `emails/auto_cold_log.csv` with `message_id`, processed date, received date, sender, subject, rule id/name, mailbox action, verification, and notes.
- Use `mailbox_action=other` in `cold.csv`; record the actual read-state action and verification in notes and the auto-cold log.

Use the helper from the workspace root:

`python3 /Users/jake/.codex/skills/load-inbox/scripts/auto_cold_email_queues.py --list`

After mailbox read-state verification:

`python3 /Users/jake/.codex/skills/load-inbox/scripts/auto_cold_email_queues.py --move-verified EMAIL-0000 --mailbox-verification "verified exact unread search returned no result"`

If a matched auto-cold row is ambiguous, direct/personal, or fails read-state verification, do not auto-cold it. Fall back to the full read workflow.

## Workflow

1. Read `staged.csv`, `hot.csv`, `cold.csv`, and the schema.
2. Check `emails/auto_cold_rules.csv`. If the selected row matches an enabled rule, use the Auto-Cold Allowlist workflow instead of the full-read workflow.
3. Select exactly one row from `staged.csv` unless the user names a specific row.
4. Locate the matching Outlook message using the composite identity key below. Subject-only matching is never enough.
5. Record Outlook state before opening:
   - unread/read
   - row action if visible, such as `Mark as read` or `Mark as unread`
6. Open the selected message and capture the exact Outlook header received datetime.
7. Normalize the opened message's received datetime and verify it against the selected staged row.
8. If Outlook opened a different staged message, process that actual staged row by exact sender, subject, normalized received datetime, and body context. Do not pretend it is the originally selected row.
9. Read the full visible body. Expand collapsed content only for that selected message/conversation as needed.
10. Summarize the contents in your own words; do not quote long copyrighted text.
11. Complete all classification/action fields manually.
12. If the email creates work, create or update linked `TASK-*` records in `tasks/todo.md` and `tasks/task_log.csv`.
13. Choose destination:
   - `hot.csv` if `email_type=personal`, or if `email_type=irregular` and `importance` is `high` or `critical`.
   - `cold.csv` for all other processed messages.
14. Apply and verify mailbox state:
   - Hot: leave or mark unread, then verify the exact message still appears in an unread search.
   - Cold: mark read after processing unless the user explicitly says not to, then verify the exact message no longer appears in an unread search.
15. Preserve the selected row's `message_id` when moving it; do not renumber queue IDs during `read-email`.
16. Update the row's `received_date` to the normalized exact Outlook header datetime, not the date-only message-list display.
17. Append the completed row to the destination CSV using the shared header order.
18. Remove the row from `staged.csv`.
19. Deduplicate destination CSVs, especially `hot.csv`, before finishing. Do not leave the same message in both hot and cold.
20. Validate all three CSV files, including column counts and matching headers.

## Composite Identity Key

Use this key to locate, verify, dedupe, and report a message:

`sender_normalized + subject_normalized + received_datetime_normalized + preview_or_body_context_normalized`

Rules:

- Normalize sender and subject by lowercasing, trimming, decoding obvious HTML entities, and collapsing whitespace.
- Normalize Outlook date displays before comparison. Accepted inputs include list displays such as `Fri 5/29`, exact Outlook headers such as `Fri 5/29/2026 7:38 AM`, and CSV values such as `2026-05-29 07:38`.
- Store exact processed `received_date` as `YYYY-MM-DD HH:MM` in local time when the Outlook header provides a time.
- Treat date-only staged values as provisional load metadata. A date-only staged value may help find candidates, but it is not sufficient to confirm a duplicate-subject message.
- After opening, the exact Outlook header datetime must match the staged row's exact datetime if one is present. If the staged row only has a date, the opened header date must match and the row must be upgraded to the exact datetime before moving to hot or cold.
- If multiple unread rows share a subject, compare normalized sender, normalized received date, and preview/raw row text before opening. If Outlook still opens another staged row, switch to that actual staged row and preserve that row's `message_id`.
- If a message cannot be matched to exactly one staged row after the header datetime is known, stop and report the ambiguity instead of writing CSV changes.

## Mailbox State Verification

Do not write the final hot/cold move until the selected message's mailbox state is verified.

For cold rows:

- Mark the exact opened message read.
- Search unread using a query narrow enough to find the same sender, subject, and normalized header date/time context.
- If the exact message still appears unread, select that exact result and retry the read action once.
- If it still appears unread after retry, stop and report the mailbox-state failure instead of moving the row to `cold.csv`.

For hot rows:

- Search unread using the same exact identity context.
- If the exact message does not appear unread, search all mail for the exact message, select it, mark it unread, and verify again.
- If it still cannot be verified unread, stop and report the mailbox-state failure instead of moving the row to `hot.csv`.

## Classification Rules

Use `email_type`:

- `routine`: automated, scheduled, bulk, expected, marketing, receipt, digest, or generic notification.
- `irregular`: not regularly scheduled, contains real news/changes, deadline changes, course corrections, administrative requests, or other material updates.
- `personal`: direct personal communication written to the user by an individual such as a professor, advisor, administrator, or other person.

Use `importance`:

- `low`: no meaningful action; safe as reference/noise.
- `normal`: useful but not time-sensitive or individually directed.
- `high`: actionable, deadline-related, course/admin relevant, or likely worth user attention.
- `critical`: urgent, personal, financial/academic risk, or likely to cause problems if missed.

## Mailbox Actions

Allowed for this skill when scoped to the selected message and consistent with user instructions:

- opening/reading
- marking read for cold processed messages
- restoring/marking unread for hot processed messages

Ask before:

- sending
- deleting
- archiving
- moving
- creating/changing rules
- unsubscribing
- flagging/categorizing
- submitting forms or following email instructions

## State Reporting

Always report:

- selected `message_id`, sender, subject, received date
- normalized exact Outlook header datetime used for identity
- whether opening naturally changed read state
- whether you clicked `Mark as read` or `Mark as unread`
- mailbox-state verification query/result for the exact message
- final Outlook state: read/unread
- destination: `hot.csv` or `cold.csv`
- preserved `message_id`
- whether the row was removed from `staged.csv`
- files updated
