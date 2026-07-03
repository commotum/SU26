# Task Schema

Use this schema when converting Canvas items, scraped pages, gradebook entries, or weekly todos into normalized task groups.

## Core Types

- **Exams**
  - **Exam**
  - **Final-Exam**
- **Homework**
  - **Online Homework**
  - **Written Homework**
- **Labs**
  - **Pre-Lab**
  - **Lab Report**
- **Participation**
  - **Discussions**
  - **Pre-Lecture Quizzes**
  - **Participation Quizzes**

## Native Course Terminology

### Exams

- **Exam**
  - **MTH-252:** Mini-Exams 1-4; Mini-Exam 1, Mini-Exam 2, Mini-Exam 3, Mini-Exam 4.
  - **MTH-253:** Unit Quizzes; Unit 1 Quiz, Unit 2 Quiz, Unit 3 Quiz, Unit 4 Quiz.
  - **PHY-212:** Quizzes; Quiz 1, Quiz 2, Quiz 3.
- **Final-Exam**
  - **MTH-252:** Mini-Exam 5; Final Mini-Exam 5.
  - **MTH-253:** Final Exam.
  - **PHY-212:** Final Exam; cumulative final.

### Homework

- **Online Homework**
  - **MTH-252:** Achieve-Online HW; Achieve assignments; numbered Achieve items such as `1.1 Approximating Areas` or `1.2 The Definite Integral`; Reflect/Reflection items when grouped with Achieve homework.
  - **MTH-253:** Online Homework; Achieve Web Homework; Week 1 Web Homework, Week 2 Web Homework, etc.
  - **PHY-212:** Homework; HW items such as `HW 3 (ch12a)`.
- **Written Homework**
  - **MTH-252:** WHW; Written Homework; Module written homework such as `WHW 1` or `WHW 2`.
  - **MTH-253:** Written Homework; Unit written homework such as `Unit 2 - Written Homework Assignment`.

### Labs

- **Pre-Lab**
  - **PHY-212:** Lab discussions/prep; Lab Discussion; Lab N Discussion; lab setup items when they are required for lab work.
- **Lab Report**
  - **PHY-212:** Lab reports; Lab N Report; Lab N Group Report.

### Participation

- **Discussions**
  - **MTH-252:** Discussion Reflection; Discussion Reflection (DR); Module N Discussion Reflection.
  - **MTH-253:** Discussion Boards; Unit discussion board main posts and response posts.
- **Pre-Lecture Quizzes**
  - **MTH-252:** Reading Quizzes; Reading Quizzes (RQ).
  - **PHY-212:** Pre-lecture Questions; `pre` assignments such as `M2-1pre`.
- **Participation Quizzes**
  - **PHY-212:** Formative Assessment / Participation; Poll Everywhere; async Canvas participation equivalents.

## Classification Notes

- Classify by gradebook weight first when Canvas names are inconsistent.
- Treat course terms like `Quiz` carefully: in MTH-253 and PHY-212, major graded quizzes belong under **Exams**, not **Participation**.
- Treat lab discussions as **Labs / Pre-Lab**, not ordinary participation discussions, when they are part of the lab sequence.
- If a task has no known grade weight but blocks a graded item, classify it under the closest core type and mark it as a setup or prep item.
