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
Decision: do, calendar, waiting, reference, archive, delete, unsubscribe, rule.
Next action:
Linked task: TASK-0001 or none.
Deadline:
Notes:
```
