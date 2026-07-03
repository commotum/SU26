# Mathematical Foundations Navigation Guide

This guide describes how to navigate the local Math Academy Mathematical Foundations data in `/Users/jake/Developer/MA`.

## Quick Local Access

From this repo:

```sh
cd /Users/jake/Developer/MA
```

Useful local commands:

```sh
ls /Users/jake/Developer/MA/DATA
find /Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations -maxdepth 3 -type f | sort
```

## Main Local Roots

- `/Users/jake/Developer/MA`
  - Main local Math Academy repository/data workspace.
- `/Users/jake/Developer/MA/DATA`
  - Global extracted data tables and shared course-map copies.
- `/Users/jake/Developer/MA/DATA/Lessons`
  - Global lesson folder. Contains about 2,964 numbered lesson directories.
- `/Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations`
  - Canonical course folders for Mathematical Foundations I, II, and III.

## Project-Local Combined Outputs

Path: `/Users/jake/Developer/SU26/Mathematical-Foundations`

These files are derived from the local `/Users/jake/Developer/MA` source data for the three Mathematical Foundations courses.

- `topics.csv`
  - Header: `course,topic-id,topic-number,topic-name`
  - 1,034 lines total. Combines MF1, MF2, and MF3 course-specific `Topics.csv` files with a `course` column.
- `prerequisites.csv`
  - Header: `topic,requires`
  - 2,216 lines total. Contains global prerequisite rows for the topics in `topics.csv`.
- `units.csv`
  - Header: `unit-id,unit-code,unit-name`
  - 43 lines total. Uses global `/Users/jake/Developer/MA/DATA/Units.csv` rows for units used by MF1, MF2, and MF3.
- `modules.csv`
  - Header: `module-id,module-code,module-name`
  - 151 lines total. Uses global `/Users/jake/Developer/MA/DATA/Modules.csv` rows for modules used by MF1, MF2, and MF3.

## Global DATA Atlas

Path: `/Users/jake/Developer/MA/DATA`

Core CSVs:

- `Catalog.csv`
  - Header: `topic-id,topic-code,topic-name`
  - About 7,556 lines.
- `Courses.csv`
  - Header: `course-code,course-id,course-name`
  - About 33 lines.
- `Units.csv`
  - Header: `unit-id,unit-code,unit-name`
  - About 316 lines.
- `Modules.csv`
  - Header: `module-id,module-code,module-name`
  - About 1,123 lines.
- `Topics.csv`
  - Header: `topic-id,topic-name`
  - About 2,972 lines.
- `Prerequisites.csv`
  - Header: `topic,requires`
  - About 6,561 lines.

Lesson-level tables:

- `Lesson-Data/Key-Prerequisites.csv`
  - Header: `topic-id,step-id,requires`
  - About 9,168 lines.
- `Lesson-Data/Questions.csv`
  - Header: `topic-id,step-id,question-id,question-type,answer-cardinality`
  - About 19,647 lines.
- `Lesson-Data/Steps.csv`
  - Header: `topic-id,step-id,step-name,step-type`
  - About 15,653 lines.

Shared course-map copies:

- `Course-Maps/Mathematical-Foundations-I.md`
- `Course-Maps/Mathematical-Foundations-II.md`
- `Course-Maps/Mathematical-Foundations-III.md`

## Mathematical Foundations Course Folders

Base path:

```sh
cd /Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations
```

The three canonical folders are:

- `Mathematical-Foundations-I`
- `Mathematical-Foundations-II`
- `Mathematical-Foundations-III`

Each course folder has the same basic shape:

- `Course-Map-Mathematical-Foundations-*.md`
  - Human-readable course map.
- `GRAPH-Mathematical-Foundations-*`
  - Course-specific graph tables.
- `LESSONS`
  - Course-specific lesson-step/question/prerequisite tables.
- `SOURCE-Mathematical-Foundations-*`
  - Raw source files used to build the course data.

## MF I Atlas

Path:

```sh
/Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations/Mathematical-Foundations-I
```

Key files:

- `Course-Map-Mathematical-Foundations-I.md`
  - About 580 lines.
- `GRAPH-Mathematical-Foundations-I/Units.csv`
  - About 14 lines.
- `GRAPH-Mathematical-Foundations-I/Modules.csv`
  - About 46 lines.
- `GRAPH-Mathematical-Foundations-I/Topics.csv`
  - About 354 lines.
- `GRAPH-Mathematical-Foundations-I/Prerequisites.csv`
  - About 612 lines.
- `LESSONS/Key-Prerequisites.csv`
  - About 1,004 lines.
- `LESSONS/Questions.csv`
  - About 2,451 lines.
- `LESSONS/Steps.csv`
  - About 1,781 lines.
- `SOURCE-Mathematical-Foundations-I/Info-Mathematical-Foundations-I.json`
- `SOURCE-Mathematical-Foundations-I/Overview-Mathematical-Foundations-I.html`
- `SOURCE-Mathematical-Foundations-I/TOC-Mathematical-Foundations-I.html`
- `SOURCE-Mathematical-Foundations-I/Graph-Mathematical-Foundations-I.html`

## MF II Atlas

Path:

```sh
/Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations/Mathematical-Foundations-II
```

Key files:

- `Course-Map-Mathematical-Foundations-II.md`
  - About 612 lines.
- `GRAPH-Mathematical-Foundations-II/Units.csv`
  - About 15 lines.
- `GRAPH-Mathematical-Foundations-II/Modules.csv`
  - About 53 lines.
- `GRAPH-Mathematical-Foundations-II/Topics.csv`
  - About 358 lines.
- `GRAPH-Mathematical-Foundations-II/Prerequisites.csv`
  - About 537 lines.
- `LESSONS/Key-Prerequisites.csv`
  - About 1,058 lines.
- `LESSONS/Questions.csv`
  - About 2,461 lines.
- `LESSONS/Steps.csv`
  - About 1,859 lines.
- `SOURCE-Mathematical-Foundations-II/Info-Mathematical-Foundations-II.json`
- `SOURCE-Mathematical-Foundations-II/Overview-Mathematical-Foundations-II.html`
- `SOURCE-Mathematical-Foundations-II/TOC-Mathematical-Foundations-II.html`
- `SOURCE-Mathematical-Foundations-II/Graph-Mathematical-Foundations-II.html`

## MF III Atlas

Path:

```sh
/Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations/Mathematical-Foundations-III
```

Key files:

- `Course-Map-Mathematical-Foundations-III.md`
  - About 590 lines.
- `GRAPH-Mathematical-Foundations-III/Units.csv`
  - About 16 lines.
- `GRAPH-Mathematical-Foundations-III/Modules.csv`
  - About 54 lines.
- `GRAPH-Mathematical-Foundations-III/Topics.csv`
  - About 324 lines.
- `GRAPH-Mathematical-Foundations-III/Prerequisites.csv`
  - About 423 lines.
- `LESSONS/Key-Prerequisites.csv`
  - About 1,022 lines.
- `LESSONS/Questions.csv`
  - About 2,086 lines.
- `LESSONS/Steps.csv`
  - About 1,636 lines.
- `SOURCE-Mathematical-Foundations-III/Info-Mathematical-Foundations-III.json`
- `SOURCE-Mathematical-Foundations-III/Overview-Mathematical-Foundations-III.html`
- `SOURCE-Mathematical-Foundations-III/TOC-Mathematical-Foundations-III.html`
- `SOURCE-Mathematical-Foundations-III/Graph-Mathematical-Foundations-III.html`

## How To Read The Tables

- `Units.csv`
  - Course-level units.
- `Modules.csv`
  - Modules inside those units.
- `Topics.csv`
  - Topics/lessons in the course graph.
- `Prerequisites.csv`
  - Topic-to-topic prerequisite edges for the course graph.
- `LESSONS/Steps.csv`
  - Step-level lesson sequence for topics in that course.
- `LESSONS/Questions.csv`
  - Question metadata by topic and step.
- `LESSONS/Key-Prerequisites.csv`
  - Step-level prerequisite requirements.

## Common Navigation Commands

List the three MF course maps:

```sh
find /Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations -maxdepth 2 -name 'Course-Map-*.md' -print | sort
```

Open MF I graph files:

```sh
ls /Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations/Mathematical-Foundations-I/GRAPH-Mathematical-Foundations-I
```

Check global lesson folders:

```sh
find /Users/jake/Developer/MA/DATA/Lessons -maxdepth 1 -mindepth 1 -type d | wc -l
find /Users/jake/Developer/MA/DATA/Lessons -maxdepth 1 -mindepth 1 -type d | sort | head
```

Inspect CSV headers:

```sh
head -n 1 /Users/jake/Developer/MA/DATA/Prerequisites.csv
head -n 1 /Users/jake/Developer/MA/COURSES/Math-Academy/Mathematical-Foundations/Mathematical-Foundations-I/GRAPH-Mathematical-Foundations-I/Topics.csv
```
