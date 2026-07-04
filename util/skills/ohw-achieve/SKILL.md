---
name: ohw-achieve
description: Extract Achieve online homework assignments into study-vault Markdown. Use when the user asks to fill an OHW markdown file from a Canvas/Macmillan Achieve assignment, especially for MTH-252 or MTH-253 Achieve homework, preserving the same numbers, variables, givens, equations, intervals, tables, graph data, and requested tasks while rewriting proprietary prompt wording in simple study-guide language.
---

# OHW-Achieve

## Purpose

Use this skill to turn a Canvas/Macmillan Achieve online homework assignment into a local Obsidian-style study file, usually under:

`/Users/jake/Developer/study/vault/<COURSE>/M-<MODULE>/OHW-<MODULE>/OHW-<MODULE>.md`

The output should follow the existing OpenStax/WHW markdown style while avoiding verbatim reproduction of proprietary Achieve prose.

## Inputs

The user may provide any of:

- a Canvas assignment URL
- a Canvas scrape markdown path
- an assignment name, such as `Achieve - 1.1 Approximating Areas`
- a course/module/OHW number, such as `MTH-252 M-1 OHW-1`
- a target study-vault file path

If the target file is omitted, infer it from the course and module:

- MTH-252 module 1 -> `/Users/jake/Developer/study/vault/252/M-1/OHW-1/OHW-1.md`
- MTH-253 module 2 -> `/Users/jake/Developer/study/vault/253/M-2/OHW-2/OHW-2.md`

If the skeleton does not exist, inspect the nearby study-vault structure and use the `skeleton` skill if a new assignment skeleton is needed. For Achieve OHW, create one `## Problem N` section per Achieve question, not per page or screen.

## Source Discovery

Start from local Canvas scrape data when available:

1. Search the newest `canvas/archive/**/markdown` files for the assignment title, Canvas assignment id, module item id, or section title.
2. Read the best Canvas `.md` page to capture due date, points, external-tool link context, and assignment title.
3. If the Canvas page is only an external-tool wrapper, use Chrome with the existing logged-in session to launch Achieve.

Use Chrome for Achieve content because the local Canvas scrape usually captures only the Canvas wrapper, not the Macmillan question bodies.

## Chrome Workflow

When using Chrome:

1. Read and follow the `chrome:control-chrome` skill before browser actions.
2. Open the Canvas assignment URL.
3. Click the unique `Load Achieve ... in a new window` button.
4. Claim the Integration Hub or Achieve tab.
5. Capture every question by using Achieve's question navigation.
6. Save scratch DOM snapshots under `/Users/jake/Developer/SU26/tmp/achieve-<assignment-slug>/`.
7. Do not enter answers, select choices, open AI Tutor, submit, reset, or otherwise change assignment state.

If a normal click is blocked by icon overlays, use a forced click only for navigation controls that are already confirmed unique and visible. Prefer direct `Q<N>` navigation buttons over next/previous controls when they are less ambiguous.

## Extraction Rules

For each question, capture:

- question number and total question count
- formulas, variables, constants, intervals, units, and answer labels
- requested approximation type, such as left endpoint, right endpoint, upper sum, lower sum, or Riemann sum
- rounding and exactness requirements
- tables and multiple-choice/multiple-select options
- graph data exposed in text, alt text, accessibility labels, Desmos labels, or visible DOM
- media-only review pages, keeping them as numbered entries when they occupy an Achieve question slot

Do not preserve Achieve solved-state details such as checked correct answers, disabled choices, scores, or `Solved` labels unless the user explicitly asks for solutions or answer review.

## Proprietary Prompt Rewriting

Preserve the math and task. Rewrite the prose.

Keep exactly:

- numbers and parameters
- variables and function names
- equations and expressions
- intervals and subinterval counts
- units
- tables
- graph coordinates and piecewise definitions
- multiple-choice option meanings
- answer targets, such as `A_{\text{left}}=`, `R_5=`, or `\sum_{i=1}^{4}v(t_i)\Delta t_i=`

Rewrite:

- sentence structure
- introductory phrasing
- explanatory wording
- layout, when a clearer study format helps

Use simple homework language. Avoid ornate, newfangled, or redundant phrasing. Include important vocabulary when it is part of the concept, such as `domain`, `left-endpoint`, `right-endpoint`, `upper sum`, `lower sum`, `Riemann sum`, `subinterval`, `displacement`, and `units`.

Good:

```md
Find $\frac{d s}{d t}$.
```

Good:

```md
Use logarithmic differentiation to find $y^{\prime}$. Assume the domain is restricted so the logarithms are defined.
```

Avoid:

```md
Find the derivative with respect to $t$; the derivative is taken with respect to $t$.
```

## Markdown Style

Preserve the generated top sections:

```md
## Prerequisites

...

## Lessons

...
```

Use one separator before every problem:

```md
---
## Problem 1
```

Formatting rules:

- Use normal Markdown prose for word problems.
- Use display math blocks for equations, formulas, tables, and answer targets.
- Use Markdown tables for table data.
- For multiple-choice or multiple-select questions, list the choices as bullets.
- For media review entries, include the figure/video title, setup, and any visible values needed for later review.
- Do not add answers or solution steps unless the user explicitly asks.

## Graph And Media Handling

Canvas/Achieve pages often hide important information in graph labels, alt text, SVG/canvas accessibility nodes, videos, and interactive widgets.

For graph or media questions:

- inspect the DOM snapshot around `Question content`
- inspect image alt text and Desmos/button labels
- include exact graph coordinates, function definitions, intervals, and piecewise values when exposed
- if the visual is not reconstructible from text, take a screenshot or note that the graph must be reviewed in Achieve
- do not invent graph values that are not visible in DOM, alt text, or the screenshot

For piecewise graphs, convert the graph into explicit intervals when the labels expose them:

```md
$$
v(t)=25 \quad \text{on } 4\leq t\leq 10
$$
```

## Verification

After editing the target markdown, verify:

- the number of `## Problem` sections matches the Achieve question count
- no `PLACEHOLDER` text remains
- the Achieve numbering is preserved, including media-only entries
- every table, unit, interval, rounding instruction, and answer target is present
- multiple-choice options are present but solved-state/checked-state is omitted
- graph/media content was either converted into explicit givens or flagged as requiring live review
- `Prerequisites` and `Lessons` sections were preserved

## Output

Report briefly:

- Canvas/Achieve source used
- target markdown path
- question count
- whether any questions were media-only or graph-dependent
- any missing, locked, or not-reconstructible content
