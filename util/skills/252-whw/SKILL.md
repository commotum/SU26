---
name: 252-whw
description: Create and populate MTH-252 Written Homework skeletons from Canvas assignment markdown and OpenStax Calculus Volume 2 exercises. Use when the user asks to build or fill a 252 WHW assignment by reading the Canvas WHW page, counting assigned textbook problems, invoking the study vault skeleton skill in the correct MTH-252 module folder, and extracting exact OpenStax problem text, tables, and images into the new skeleton.
---

# 252-WHW

## Purpose

Use this skill to turn an MTH-252 Canvas Written Homework assignment into a filled Obsidian homework folder under:

`/Users/jake/Developer/study/vault/252/M-<MODULE>/WHW-<MODULE>/`

The workflow is:

1. Find and read the Canvas `.md` assignment page.
2. Extract the assigned OpenStax section/problem list and count the individual textbook problems.
3. Use the `skeleton` skill to create the WHW folder in the matching `M-<MODULE>` folder.
4. Extract exact OpenStax problem content into the new skeleton, including shared directions, tables, and images.

## Inputs

The user may provide any of:

- assignment name, such as `WHW-3`, `Module 3 Written Homework`, or `MTH-252 WHW 3`
- a Canvas markdown path
- a module number
- a request like “do the next WHW”

If paths are omitted:

- Infer the module number from `WHW-<N>` or `Module <N>`.
- Search `canvas/archive/**/markdown` for `mth-252`, `module-<N>`, and `written-homework-whw-<N>`.
- Prefer the newest `full-refresh-*` Canvas `linked-detail` markdown. Fall back to module-item markdown only if no linked-detail page exists.
- Target skeleton path is `/Users/jake/Developer/study/vault/252/M-<N>/WHW-<N>/WHW-<N>.md`.

## Canvas Extraction

Read the Canvas assignment markdown before creating or editing anything. Capture:

- due/availability context if relevant
- final submission page count, when stated, as formatting context only
- exact section/problem numbers and the individual assigned problem count
- instructor restrictions, such as “only compute `R_4`, not `L_4`”
- whether the source is OpenStax or an attachment

Use the number of assigned textbook problems as the skeleton problem count. Do not use the final PDF page count as the skeleton count unless it also matches the number of assigned textbook problems. If Canvas groups multiple textbook problems onto one submitted page, still create one skeleton `## Problem N` section per textbook problem and preserve the page grouping as context inside the relevant problem labels if useful. If Canvas does not expose a problem list, report that it is hidden/locked instead of inventing a count.

## Skeleton Creation

This skill depends on the study vault `skeleton` skill:

`/Users/jake/Developer/study/util/skills/skeleton/SKILL.md`

Before creating a skeleton, read that skill. Then run the skeleton CLI from `/Users/jake/Developer/study` with the MTH-252 module folder as the target:

```bash
python3 util/create_skeleton.py vault/252/M-<N> WHW-<N> <TEXTBOOK_PROBLEM_COUNT> --create-course
```

Rules:

- Create the skeleton before OpenStax extraction.
- Do not overwrite an existing WHW skeleton unless the user explicitly asks.
- If the folder already exists, inspect it and either continue filling the existing skeleton or report the conflict.
- The expected generated markdown is `/Users/jake/Developer/study/vault/252/M-<N>/WHW-<N>/WHW-<N>.md`.
- The study vault is outside the SU26 repo root, so writes to `/Users/jake/Developer/study/...` usually require escalated filesystem access.

## OpenStax Extraction

Use Chrome when the user asks for browser/OpenStax navigation or when OpenStax content/images must be verified live.

OpenStax Calculus Volume 2 section URLs usually follow:

- Section 1.1: `https://openstax.org/books/calculus-volume-2/pages/1-1-approximating-areas`
- Section 1.2: `https://openstax.org/books/calculus-volume-2/pages/1-2-the-definite-integral`

For other sections, navigate from the OpenStax table of contents or derive one focused URL and verify the section title before extracting.

For each assigned exercise:

- Capture the exact problem statement.
- Capture any shared direction immediately above the exercise group.
- Check for `img`, `figure`, `picture`, and `table` content.
- If the problem text is only a number, inspect nearby DOM/image/figure content; it likely depends on a graph or table.
- Transcribe tables as Markdown tables.
- Download any required images into the assignment source image folder.

## Image Handling

For images, save under:

`/Users/jake/Developer/study/vault/252/M-<N>/WHW-<N>/Source/WHW-<N>/Images/`

Use descriptive lowercase filenames:

`whw-2-problem-3-1-2-72.webp`

Use relative Markdown links from the skeleton file:

```md
![](<Source/WHW-2/Images/whw-2-problem-3-1-2-72.webp>)
```

After download, verify:

- file exists
- file size is nonzero
- `file <path>` reports an actual image format

## Markdown Style

Preserve the generated top sections exactly:

```md
## Prerequisites

...

## Lessons

...
```

Then fill each problem section with this style:

```md
---
## Problem 1

Section 1.1, Problem 13:

$$
\text { Compute } R_4 \text { for } g(x)=\cos(\pi x) \text { on } [0,1] \text {. }
$$
```

Rules:

- Put `Section X.Y, Problem N:` as plain Markdown above the prompt.
- Do not include the section/problem label inside the display math block.
- For short symbolic prompts, use display math with `\text { ... }` around prose.
- For longer word prompts, use normal Markdown prose and separate display math blocks for formulas.
- Preserve instructor restrictions from Canvas.
- Use one `---` separator before every `## Problem N`.
- Keep exactly one problem section per assigned textbook problem.
- Do not add solutions unless the user explicitly asks.

## Verification

After editing, read the skeleton back and verify:

- problem section count matches the individual assigned textbook problem count
- problem numbers match Canvas
- shared OpenStax directions were included where needed
- images/tables are present where OpenStax requires them
- Markdown image links point to existing local files
- `Prerequisites` and `Lessons` sections were preserved

## Output

Report briefly:

- Canvas markdown source used
- skeleton command/path created or reused
- assigned problem list
- images downloaded, if any
- any hidden/locked/missing Canvas or OpenStax content
