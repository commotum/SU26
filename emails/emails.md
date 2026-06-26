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

- EMAIL-0001 | 2026-05-28 | Summer Enrollment Revision Request - Financial Aid needs specific planned credits by term
  - Details: [EMAIL-0001](#email-0001---summer-enrollment-revision-request)
- EMAIL-0002 | 2026-06-04 | Complete Summer Enrollment Revision follow-up - flagged Financial Aid reminder to update expected summer enrollment status
  - Details: [EMAIL-0002](#email-0002---complete-summer-enrollment-revision-follow-up)
- EMAIL-0027 | 2026-05-28 | Financial Aid Enrollment Revision Request - complete the unsatisfied portal request with planned credits
  - Details: [EMAIL-0027](#email-0027---financial-aid-enrollment-revision-request)
- EMAIL-0006 | 2026-06-26 | MTH 252 Q&A link correction - Q&A link moved to Start Here module
  - Details: [EMAIL-0006](#email-0006---mth-252-qa-link-correction)

## Actionable

- EMAIL-JOB-0001 | 2026-06-26 | Outlook Inbox Zero - process messages as of 2026-06-26 11:29:31 PDT
  - Details: [Outlook Inbox Zero Job](outlook_inbox_zero.md)
  - Linked task: [TASK-0001](../tasks/todo.md#task-0001---get-outlook-to-inbox-zero)
- EMAIL-0003 | 2026-06-21 | MTH 252 setup notes - Start Here, Achieve, Gradescope, and first due dates
  - Details: [EMAIL-0003](#email-0003---mth-252-setup-notes)
  - Linked task: [TASK-0003](../tasks/todo.md#task-0003---set-up-mth-252-access)
- EMAIL-0004 | 2026-06-22 | MTH 253 Unit 1 work - required discussion, written homework, Achieve work, and quiz
  - Details: [EMAIL-0004](#email-0004---mth-253-unit-1-work)
  - Linked task: [TASK-0004](../tasks/todo.md#task-0004---complete-mth-253-unit-1-work)
- EMAIL-0005 | 2026-06-22 | PH 212 first-day participation - verify M1-0 credit or complete M1-0asy
  - Details: [EMAIL-0005](#email-0005---ph-212-first-day-participation)
  - Linked task: [TASK-0005](../tasks/todo.md#task-0005---verify-ph-212-first-day-participation)

## Waiting

## Reference

## Noise / Archive

- EMAIL-0007 | 2026-05-24 to 2026-06-26 | Bulk routine unread scan - 66 visible unread conversations scanned and grouped as routine archive candidates
  - Details: [EMAIL-0007](#email-0007---bulk-routine-unread-scan)

## Details

Use this only when an email needs a summary, decision record, or task linkage.

### EMAIL-0001 - Summer Enrollment Revision Request

Title: Summer Enrollment Revision Request.
Description: OSU Financial Aid needs the specific number of credits Jacob plans to take each term.
Sender: Office of Financial Aid <financial.aid@email.oregonstate.edu>
Received: 2026-05-28 1:34 PM
Category: financial aid.
Email type: irregular.
Importance: critical.
Decision: do.
Mailbox action: opened.
Next action: Complete the Enrollment Revision Request in the Financial Aid Portal, unsatisfied section of the Home tab.
Linked task: TASK-0002.
Deadline: as soon as possible.
Notes: Individualized message addressed to Jacob; should remain visible until handled.

### EMAIL-0002 - Complete Summer Enrollment Revision Follow-Up

Title: Complete Summer Enrollment Revision follow-up.
Description: Flagged Financial Aid follow-up asks Jacob to update expected summer enrollment status for federal financial aid.
Sender: Office of Financial Aid
Received: 2026-06-04 4:22 PM
Category: financial aid.
Email type: irregular.
Importance: critical.
Decision: do.
Mailbox action: opened.
Next action: Update expected summer enrollment status in the 2026-27 Financial Aid Portal.
Linked task: TASK-0002.
Deadline: as soon as possible.
Notes: The Outlook row was flagged and unread; no Outlook flag or archive state was changed.

### EMAIL-0003 - MTH 252 Setup Notes

Title: MTH 252 setup notes.
Description: MTH 252 announcement explains Start Here, Achieve, Gradescope, and first due dates.
Sender: INTEGRAL CALCULUS (MTH_252Z_400_U2026)
Received: 2026-06-21 7:52 PM
Category: course.
Email type: routine.
Importance: high.
Decision: do.
Mailbox action: opened.
Next action: Complete Start Here, register Achieve through Canvas, and check Gradescope setup.
Linked task: TASK-0003.
Deadline: 2026-06-29.
Notes: First round of due dates is Monday 2026-06-29; Gradescope setup expected by Tuesday after announcement.

### EMAIL-0004 - MTH 253 Unit 1 Work

Title: MTH 253 Unit 1 work.
Description: MTH 253 Week 1 announcement lists required discussion, written homework, Achieve homework, and Unit 1 quiz.
Sender: SEQUENCES AND SERIES (MTH_253Z_400_U2026)
Received: 2026-06-22 12:01 AM
Category: course.
Email type: routine.
Importance: high.
Decision: do.
Mailbox action: opened.
Next action: Complete the Unit 1 assignments listed in Canvas.
Linked task: TASK-0004.
Deadline: 2026-06-29.
Notes: Email says quiz closes Tuesday 2026-06-29, but 2026-06-29 is a Monday; verify the actual close date in Canvas.

### EMAIL-0005 - PH 212 First-Day Participation

Title: PH 212 first-day participation.
Description: PH 212 announcement explains whether Jacob needs asynchronous M1-0asy participation work.
Sender: GENERAL PHYSICS WITH CALCULUS (PH_212_400_U2026)
Received: 2026-06-22 2:13 PM
Category: course.
Email type: routine.
Importance: high.
Decision: do.
Mailbox action: opened.
Next action: Check Canvas grade book for M1-0 credit; submit M1-0asy only if M1-0 is zero.
Linked task: TASK-0005.
Deadline:
Notes: The email says students can receive credit for M1-0 or M1-0asy, not both.

### EMAIL-0006 - MTH 252 Q&A Link Correction

Title: MTH 252 Q&A link correction.
Description: MTH 252 Q&A link was accidentally in the wrong module and was moved back to the Start Here module.
Sender: INTEGRAL CALCULUS (MTH_252Z_400_U2026)
Received: 2026-06-26 10:47 AM
Category: course.
Email type: irregular.
Importance: high.
Decision: restore_unread.
Mailbox action: restored_unread.
Next action: Use the Q&A link from Start Here during Week 1.
Linked task: TASK-0003.
Deadline:
Notes: Left unread because it is an irregular course correction before the cutoff.

### EMAIL-0007 - Bulk Routine Unread Scan

Title: Bulk routine unread scan.
Description: Scanned 66 visible unread Outlook conversations through the 2026-06-26 11:29:31 PDT cutoff and grouped low-value routine messages as archive candidates.
Sender: Multiple.
Received: 2026-05-24 to 2026-06-26.
Category: other.
Email type: routine.
Importance: low.
Decision: archive.
Mailbox action: recommend_archive.
Next action: Get user approval before any archive/delete/move cleanup in Outlook.
Linked task: TASK-0001.
Deadline:
Notes: Included MathWorks, Behance, Handshake, Xfinity, Career Development Center, EECS digests, HPC status, SLE surveys, Student Parent messages, Rec Sports, and similar routine messages. No Outlook archive/delete/move/rule action was performed.

### EMAIL-0027 - Financial Aid Enrollment Revision Request

Title: Financial Aid Enrollment Revision Request.
Description: OSU Financial Aid asks Jacob to complete the unsatisfied Enrollment Revision Request with planned credits by term.
Sender: Office of Financial Aid <financial.aid@email.oregonstate.edu>
Received: 2026-05-28 1:34 PM
Category: financial aid.
Email type: personal.
Importance: critical.
Decision: do.
Mailbox action: restored_unread.
Next action: Open the Financial Aid Portal and complete the Enrollment Revision Request in the unsatisfied section of the Home tab.
Linked task: TASK-0002.
Deadline: as soon as possible.
Notes: Opening naturally marked it read; Codex restored it unread because it is individualized financial-aid work.

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
