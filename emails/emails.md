# Emails

Use this file for readable triage notes, summaries, and decisions. Keep structured fields in `email_triage.csv`.

## Page Info

- Title: Emails
- Description: Readable email triage surface for message titles, short summaries, decisions, and links to tasks created from messages.

## Item Format

Short email item:

```md
- EMAIL-0001 | YYYY-MM-DD | Title - short description
```

Email with details:

```md
- EMAIL-0001 | YYYY-MM-DD | Title - short description
  - Details: [EMAIL-0001](#email-0001)
```

## Needs Review

## Actionable

- EMAIL-JOB-0001 | 2026-06-26 | Outlook Inbox Zero - process messages as of 2026-06-26 11:29:31 PDT
  - Details: [Outlook Inbox Zero Job](outlook_inbox_zero.md)
  - Linked task: [TASK-0001](../tasks/todo.md#task-0001---get-outlook-to-inbox-zero)

## Waiting

## Reference

## Noise / Archive

## Details

Use this only when an email needs a summary, decision record, or task linkage.

```md
### EMAIL-0001 - Subject

Title: Short human-readable title.
Description: One sentence summary of the message.
Sender:
Received:
Category: course, admin, billing, financial aid, promo, receipt, reference, other.
Email type: routine, irregular, or personal.
Importance: low, normal, high, or critical.
Decision: do, calendar, waiting, reference, archive, delete, unsubscribe, rule, restore_unread.
Mailbox action: none, opened, restored_unread, recommend_archive, recommend_delete, recommend_rule, other.
Next action:
Linked task: TASK-0001 or none.
Deadline:
Notes:
```
