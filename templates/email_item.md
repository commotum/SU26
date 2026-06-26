# Email Item Template

Description: Reusable format for readable email triage in `emails/emails.md` and structured rows in `emails/email_triage.csv`.

## Short Email

```md
- EMAIL-0001 | YYYY-MM-DD | Title - short description
```

## Detailed Email

```md
- EMAIL-0001 | YYYY-MM-DD | Title - short description
  - Details: [EMAIL-0001](#email-0001)

### EMAIL-0001 - Subject

Title: Short human-readable message title.
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

## CSV Schema

`message_id,title,description,triaged_date,received_date,sender,subject,course_or_area,category,priority,status,decision,next_action,deadline,task_id,email_link_or_context,notes`
