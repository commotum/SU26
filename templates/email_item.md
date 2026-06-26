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
Email type: routine, irregular, or personal.
Importance: low, normal, high, or critical.
Decision: do, calendar, waiting, reference, archive, delete, unsubscribe, rule, restore_unread.
Mailbox action: none, opened, restored_unread, recommend_archive, recommend_delete, recommend_rule, other.
Next action:
Linked task: TASK-0001 or none.
Deadline:
Notes:
```

## CSV Schema

`message_id,title,description,triaged_date,received_date,sender,subject,course_or_area,category,email_type,importance,priority,status,decision,mailbox_action,next_action,deadline,task_id,email_link_or_context,notes`
