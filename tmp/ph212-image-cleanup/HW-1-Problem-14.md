# Matching Angular Velocity to an Angular Position Graph

## Table of Contents

- [Introduction](#introduction)
- [Read Velocity as Slope](#read-velocity-as-slope)
- [Mark Where Velocity Is Zero](#mark-where-velocity-is-zero)
- [Match the Sign Pattern](#match-the-sign-pattern)
- [Use Steepness to Choose the Best Graph](#use-steepness-to-choose-the-best-graph)
- [Match the Homework Graph](#match-the-homework-graph)

## Prerequisites

- Angular velocity is the derivative of angular position
- A positive slope means a graph is increasing
- A negative slope means a graph is decreasing
- A horizontal tangent has slope $0$
- A local maximum or local minimum has a horizontal tangent

---

<a id="introduction"></a>
## Introduction

When a problem gives a graph of angular position $\theta(t)$ and asks for angular velocity, read the velocity from the slope of the position graph:

$$
\omega_z(t)=\frac{d\theta}{dt}.
$$

The recognition cue is a graph of position over time paired with possible graphs of $\dfrac{d\theta}{dt}$. The reusable move is to match the velocity graph to the sign, zeroes, and relative size of the slope of $\theta(t)$.

A good matching order is:

1. Mark every smooth peak and valley of $\theta(t)$. The velocity must be $0$ there.
2. Between those times, decide whether $\theta(t)$ is increasing or decreasing. That sets the sign of velocity.
3. Compare steep and gentle parts of $\theta(t)$. That sets the relative size of velocity.

The main trap is reading the height of $\theta(t)$ instead of its slope. A point above the horizontal axis does not automatically mean positive velocity. Velocity is positive only where the position graph is rising.

---

<a id="read-velocity-as-slope"></a>
## Read Velocity as Slope

**Example:** A position graph slopes downward from $t=0$ to $t=1$, then slopes upward from $t=1$ to $t=2$. What happens to the velocity sign?

**Explanation**

Angular velocity is the slope of angular position.

From $t=0$ to $t=1$, the graph is decreasing, so the slope is negative:

$$
\frac{d\theta}{dt}<0.
$$

From $t=1$ to $t=2$, the graph is increasing, so the slope is positive:

$$
\frac{d\theta}{dt}>0.
$$

So the velocity graph should be below the time axis first, then above the time axis.

```quiz
type: radio
id: q-1
shuffle: true
content: |-
  A graph of $\theta(t)$ is increasing on an interval. What must be true about $\dfrac{d\theta}{dt}$ on that interval?
options:
- id: a
  content: |-
    It is positive.
  correct: true
- id: b
  content: |-
    It is negative.
- id: c
  content: |-
    It is zero for the whole interval.
- id: d
  content: |-
    It has the same value as $\theta(t)$.
```

---

<a id="mark-where-velocity-is-zero"></a>
## Mark Where Velocity Is Zero

**Example:** A smooth position graph has a local minimum at $t=0.8$ and a local maximum at $t=2.5$. Where should the velocity graph cross or touch the time axis?

**Explanation**

At a smooth local maximum or local minimum, the tangent line is horizontal. A horizontal tangent has slope $0$.

So

$$
\frac{d\theta}{dt}=0
$$

at both turning points:

$$
t=0.8 \quad \text{and} \quad t=2.5.
$$

Those are the times where the velocity graph should be on the horizontal axis.

```quiz
type: radio
id: q-2
shuffle: true
content: |-
  A smooth graph of $\theta(t)$ reaches a local maximum at $t=3$. What value should $\dfrac{d\theta}{dt}$ have at $t=3$?
options:
- id: a
  content: |-
    A positive value
- id: b
  content: |-
    A negative value
- id: c
  content: |-
    $0$
  correct: true
- id: d
  content: |-
    The same value as $\theta(3)$
```

---

<a id="match-the-sign-pattern"></a>
## Match the Sign Pattern

**Example:** A smooth position graph decreases, then increases, then decreases, then increases. What is the sign pattern for its velocity?

**Explanation**

Translate each interval from position behavior to velocity sign:

$$
\begin{array}{c|c|c}
\text{Position graph} & \text{Slope} & \text{Velocity sign} \\
\hline
\text{decreasing} & \text{negative} & \dfrac{d\theta}{dt}<0 \\
\text{increasing} & \text{positive} & \dfrac{d\theta}{dt}>0 \\
\text{decreasing} & \text{negative} & \dfrac{d\theta}{dt}<0 \\
\text{increasing} & \text{positive} & \dfrac{d\theta}{dt}>0
\end{array}
$$

So the velocity graph should go below, above, below, above the time axis.

```quiz
type: radio
id: q-3
shuffle: true
content: |-
  A graph of $\theta(t)$ increases, then decreases, then increases. Which sign pattern should $\dfrac{d\theta}{dt}$ have?
options:
- id: a
  content: |-
    Positive, negative, positive
  correct: true
- id: b
  content: |-
    Negative, positive, negative
- id: c
  content: |-
    Positive for the whole interval
- id: d
  content: |-
    Zero wherever $\theta(t)$ is above the axis
```

---

<a id="use-steepness-to-choose-the-best-graph"></a>
## Use Steepness to Choose the Best Graph

**Example:** Two answer choices have the right sign pattern. One has a large positive velocity where $\theta(t)$ rises gently, and the other has a large positive velocity where $\theta(t)$ rises steeply. Which one matches better?

**Explanation**

The size of velocity comes from steepness.

A gentle rise means a small positive slope, so $\dfrac{d\theta}{dt}$ should be positive but close to $0$.

A steep rise means a large positive slope, so $\dfrac{d\theta}{dt}$ should be farther above the time axis.

Use this after checking the sign pattern and the zeroes. Sign and zeroes usually eliminate the biggest mistakes; steepness chooses between graphs that are otherwise close.

```quiz
type: radio
id: q-4
shuffle: true
content: |-
  On one interval, $\theta(t)$ is increasing very steeply. On another interval, it is increasing only gently. Where should $\dfrac{d\theta}{dt}$ be larger?
options:
- id: a
  content: |-
    On the steeply increasing interval
  correct: true
- id: b
  content: |-
    On the gently increasing interval
- id: c
  content: |-
    At the point where $\theta(t)$ is highest
- id: d
  content: |-
    Wherever $\theta(t)$ is closest to $0$
```

---

<a id="match-the-homework-graph"></a>
## Match the Homework Graph

**Example:** Match the angular velocity graph to this angular position graph.

![](<../Source/Images/angular-position-vs-time.png>)

**Explanation**

Track the slope of the blue position graph, starting with the turning points.

$$
\begin{array}{c|c|c}
\text{Part of the position graph} & \theta(t)\text{ behavior} & \dfrac{d\theta}{dt}\text{ sign} \\
\hline
\text{start to first valley} & \text{decreasing} & \text{negative} \\
\text{first valley to first peak} & \text{increasing} & \text{positive} \\
\text{first peak to second valley} & \text{decreasing} & \text{negative} \\
\text{second valley to }5\text{ s} & \text{increasing} & \text{positive}
\end{array}
$$

The velocity must also be $0$ at each smooth valley or peak of $\theta(t)$. Those zeroes should line up with the turning points of the position graph, not with the times when $\theta(t)$ crosses the horizontal axis.

This rules out option B because it stays positive even when the position graph is decreasing. It rules out option C because it is positive early and negative near the end, the opposite of the needed slope signs. It rules out option D because it has extra sign changes that do not come from turning points of the position graph.

Option A starts negative, crosses $0$ at the turning points, becomes negative between the peak and the second valley, and becomes large positive during the steep final rise. So option A matches.

```quiz
type: radio
id: q-5
shuffle: true
content: |-
  The plot below shows the $z$-component of the angular position of an object over a $5$ second time interval. Select the option which shows the $z$-component of the object's corresponding angular velocity over that same interval.

  ![](<../Source/Images/angular-position-vs-time.png>)
options:
- id: a
  content: |-
    ![](<../Source/Images/problem-14-angular-velocity-option-a.png>)
  correct: true
- id: b
  content: |-
    ![](<../Source/Images/problem-14-angular-velocity-option-b.png>)
- id: c
  content: |-
    ![](<../Source/Images/problem-14-angular-velocity-option-c.png>)
- id: d
  content: |-
    ![](<../Source/Images/problem-14-angular-velocity-option-d.png>)
```

---

## Summary

To match angular velocity to angular position, read $\dfrac{d\theta}{dt}$ as the slope of $\theta(t)$.

Use this checklist:

- Increasing $\theta(t)$ means positive velocity
- Decreasing $\theta(t)$ means negative velocity
- Local maxima and local minima of $\theta(t)$ give velocity $0$
- Steeper position graphs give larger velocity magnitudes

Do not choose a velocity graph by copying the height of $\theta(t)$. Match the slope behavior instead.
