# Recursive Canvas Indexer Loop

Use this loop for every stage of `goal-1`.

## Execution Loop

1. Sync current state with actual files and tests.
2. Update `0-plan.md` with current facts before starting the next stage.
3. Select the first incomplete stage.
4. Create or refresh `goal-1/[INDEX]-[SHORTHAND].md` from the stage template.
5. Implement only that stage.
6. Add verification and no-cheating checks.
7. Run focused tests, full verification, and whitespace/diff checks appropriate to the repo.
8. Record results in the stage file.
9. Fold results back into `0-plan.md`.
10. Continue, stop with meaningful progress, or document a precise obstruction.

## Invariants

- Do not narrow the user's objective without saying so.
- Do not mark a stage complete without evidence.
- Do not use tests or green checks as evidence unless they cover the requirement.
- Prefer small, low-complexity stages that narrow uncertainty.
- Preserve the distinction between implementation, verifier, diagnostic, and fallback paths.
- Do not claim a Canvas item is irrelevant until it has been classified with evidence.
- Do not claim a course is complete until Modules, Assignments, Grades, and detail pages have been cross-checked.
- Do not claim a PDF/file is read unless it has been downloaded and parsed or its Canvas file page contains enough text to support the claim.

## Stage File Template

```markdown
# [INDEX]-[SHORTHAND]

## Current Facts

- Facts from current code, tests, docs, and previous stage results.

## Updated Assumptions

- Assumptions that still look valid.
- Assumptions that changed.
- Assumptions that need tests before being trusted.

## Big Picture Objective

- Restate the stage objective, adjusted for current facts.

## Detailed Implementation Plan

- Concrete code/doc/test changes for this stage.
- Files expected to change.
- New tests or commands required.

## No-Cheating Checks

- Explicit checks proving the implementation does not route through forbidden fallback paths.

## Completion Requirements

- Requirement-by-requirement checks.
- Required test commands.
- Documentation updates required.

## Stage Results

- Fill in at the end of the stage.
- Include tests run and outcomes.
- Include what was learned.
- Include what should change in `0-plan.md` before the next stage.
```

