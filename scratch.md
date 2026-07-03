  1. Approximating Areas With the Left Riemann Sum
  2. Approximating Areas With the Right Riemann Sum
  3. Left and Right Riemann Sums in Sigma Notation
  4. Defining Definite Integrals Using Left and Right Riemann Sums
  5. Sigma Notation
  6. Properties of Finite Series

- Introduction to Sequences 2271
  - Graphs of General Quadratic Functions 84
  - Areas of Rectangles and Squares 1352
  - Increasing and Decreasing Functions 1628
  - Describing Function Composition 3817
  - Limits at Infinity from Graphs 1873




24    Introduction to Sequences                                        2271
26    Describing Function Composition                                  3817
27    Areas of Rectangles and Squares                                  1352
31    Graphs of General Quadratic Functions                              84
31    Increasing and Decreasing Functions                              1628

28    Sigma Notation                                                    673
32    Properties of Finite Series                                      3958
32    Approximating Areas With the Left Riemann Sum                     477
32    Approximating Areas With the Right Riemann Sum                   1281
33    Left and Right Riemann Sums in Sigma Notation                    1042
38    Limits at Infinity from Graphs                                   1873
39    Defining Definite Integrals Using Left and Right Riemann Sums    1086




Hmm, we probably need a new script then just for this. I think it is globally unique.

Write a script that when given a course-code (ie MF1, MF2, MF3, CA1, CA2, DEQ, PS1, PS2, etc), creates a new folder in "/Users/jake/Developer/study/MA" with the following target structure:

1. the table of contents (TOC.md) built from the course map (/Users/jake/Developer/MA/DATA/Course-Maps) and placed in its own "0. Table of Contents" folder (like "/Users/jake/Developer/study/Old/Continuous-Time-Signal-Processing/0. Table of Contents/TOC.md")
2. indexed unit folders containing indexed module folders (named and indexed to match the course map structure and unit and module names)
3. a "Lessons" folder per module with the .md files for each of that module's lessons (named and indexed to match the course map structure and lesson names)
4. a "Source" folder per module with the source folders for each of that module's lessons (most importantly the images in the lesson in an images folder, but also the source html and json so we can correct any .md errors we notice by referring to the source material)
5. a "Home.md" page per course sitting in that courses root folder (like /Users/jake/Developer/study/Old/Continuous-Time-Signal-Processing/Home.md)