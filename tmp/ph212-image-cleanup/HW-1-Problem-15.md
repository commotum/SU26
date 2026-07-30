# Matching Angular Acceleration to a Position Graph

## Table of Contents

- [Introduction](#introduction)
- [Reading Curvature As Acceleration](#reading-curvature-as-acceleration)
- [Using Turning Points As Sign Checks](#using-turning-points-as-sign-checks)
- [Finding Inflection Points](#finding-inflection-points)
- [Choosing The Matching Graph](#choosing-the-matching-graph)
- [Avoiding Slope And Height Traps](#avoiding-slope-and-height-traps)

## Prerequisites

- Angular position is written as $\theta_z(t)$
- Angular velocity is the slope of angular position: $\omega_z(t)=\dfrac{d\theta_z}{dt}$
- Angular acceleration is the slope of angular velocity: $\alpha_z(t)=\dfrac{d^2\theta_z}{dt^2}$
- A graph that is concave up has positive second derivative
- A graph that is concave down has negative second derivative

---

<a id="introduction"></a>
## Introduction

The problem gives a graph of angular position $\theta_z(t)$ and asks for the matching angular acceleration graph over the same time interval.

![Angular position graph for Problem 15](../Source/Images/angular-position-vs-time.png)

The recognition cue is the phrase **angular acceleration** paired with a graph of **angular position**. Since acceleration is the second derivative of position, the move is to read the concavity of the position graph:

$$
\text{concave up} \Longrightarrow \alpha_z(t)>0
$$

$$
\text{concave down} \Longrightarrow \alpha_z(t)<0.
$$

Equivalently, watch the slope of $\theta_z(t)$:

- if the slope is increasing, $\alpha_z(t)>0$
- if the slope is decreasing, $\alpha_z(t)<0$
- if the concavity changes, $\alpha_z(t)$ crosses $0$

---

<a id="reading-curvature-as-acceleration"></a>
## Reading Curvature As Acceleration

**Example:** On an interval, $\theta_z(t)$ is decreasing, but the graph bends upward as it approaches a low point. Is $\alpha_z(t)$ positive or negative on that interval?

**Explanation**

The graph is decreasing, so the slope of $\theta_z(t)$ is negative. But the slope is becoming less negative as the graph bends toward a low point.

That means the slope is increasing:

$$
\text{more negative slope} \to \text{less negative slope} \to 0.
$$

An increasing slope means

$$
\alpha_z(t)>0.
$$

The sign of acceleration comes from how the slope changes, not from whether the position graph is rising or falling.

```quiz
type: radio
id: q-1
shuffle: true
content: |-
  On an interval, $\theta_z(t)$ is increasing, but the graph is flattening out. What is the sign of $\alpha_z(t)$ on that interval?
options:
- id: a
  content: |-
    Positive, because $\theta_z(t)$ is increasing.
- id: b
  content: |-
    Negative, because the slope is decreasing.
  correct: true
- id: c
  content: |-
    Zero, because the graph is not crossing the time axis.
- id: d
  content: |-
    Positive, because angular position is above its earlier values.
```

---

<a id="using-turning-points-as-sign-checks"></a>
## Using Turning Points As Sign Checks

**Example:** A smooth graph of $\theta_z(t)$ has a local minimum at $t=1$. What sign should $\alpha_z(t)$ have near that low point?

**Explanation**

At a local minimum, the slope of $\theta_z(t)$ changes from negative to zero to positive.

That is an increase in slope:

$$
- \to 0 \to +.
$$

So near a smooth local minimum, the position graph is concave up and

$$
\alpha_z(t)>0.
$$

At a smooth local maximum, the slope changes from positive to zero to negative, so the slope is decreasing and $\alpha_z(t)<0$.

```quiz
type: radio
id: q-2
shuffle: true
content: |-
  A smooth graph of $\theta_z(t)$ has a local maximum at $t=3$. What should be true about $\alpha_z(t)$ near that high point?
options:
- id: a
  content: |-
    $\alpha_z(t)>0$, because the position value is high.
- id: b
  content: |-
    $\alpha_z(t)=0$, because the slope of $\theta_z(t)$ is zero exactly at the top.
- id: c
  content: |-
    $\alpha_z(t)<0$, because the slope changes from positive to negative.
  correct: true
- id: d
  content: |-
    $\alpha_z(t)>0$, because the graph is above the horizontal axis.
```

---

<a id="finding-inflection-points"></a>
## Finding Inflection Points

**Example:** A graph of $\theta_z(t)$ changes from concave up to concave down at $t=1.5$. What happens to $\alpha_z(t)$ at that time?

**Explanation**

Angular acceleration is the second derivative:

$$
\alpha_z(t)=\frac{d^2\theta_z}{dt^2}.
$$

The second derivative is positive where $\theta_z(t)$ is concave up and negative where $\theta_z(t)$ is concave down. When the concavity changes from up to down, the acceleration changes sign from positive to negative.

So the acceleration graph should cross the zero line near $t=1.5$.

```quiz
type: radio
id: q-3
shuffle: true
content: |-
  A graph of $\theta_z(t)$ changes from concave down to concave up near $t=2.4$. What should the matching $\alpha_z(t)$ graph do near $t=2.4$?
options:
- id: a
  content: |-
    Cross from negative to positive.
  correct: true
- id: b
  content: |-
    Cross from positive to negative.
- id: c
  content: |-
    Stay positive because angular position is increasing.
- id: d
  content: |-
    Stay zero because the position graph is smooth.
```

---

<a id="choosing-the-matching-graph"></a>
## Choosing The Matching Graph

**Example:** For the homework graph, decide which acceleration option matches the angular position graph.

**Explanation**

Use the main landmarks of the position graph:

- near the first low point, the position graph is concave up, so $\alpha_z(t)$ should be positive
- near the high point around the middle, the position graph is concave down, so $\alpha_z(t)$ should be negative
- near the next low point, the position graph is concave up again, so $\alpha_z(t)$ should be positive
- after the graph rises steeply near the end, it begins bending downward, so $\alpha_z(t)$ should become negative

The matching acceleration graph must alternate signs with the concavity pattern of the position graph. It is not enough for the graph to be above or below zero at the same times as $\theta_z(t)$.

A useful scan is:

| Feature in $\theta_z(t)$ | What it says about $\alpha_z(t)$ |
| --- | --- |
| first low point | $\alpha_z(t)>0$ nearby |
| middle high point | $\alpha_z(t)<0$ nearby |
| second low point | $\alpha_z(t)>0$ nearby |
| final bend downward | $\alpha_z(t)<0$ near the end |

Option A matches this sign pattern. The other options either stay mostly positive, oscillate too often, or put the positive and negative regions in the wrong places.

```quiz
type: radio
id: q-4
shuffle: true
content: |-
  The plot below shows $\theta_z(t)$ over a $5$ second interval. Which option shows the matching angular acceleration $\alpha_z(t)$ over the same interval?

  ![Angular position graph](../Source/Images/angular-position-vs-time.png)
options:
- id: a
  content: |-
    ![Option A](../Source/Images/problem-15-angular-acceleration-option-a.png)
  correct: true
- id: b
  content: |-
    ![Option B](../Source/Images/problem-15-angular-acceleration-positive-curve.png)
- id: c
  content: |-
    ![Option C](../Source/Images/problem-15-angular-acceleration-positive-curve.png)
- id: d
  content: |-
    ![Option D](../Source/Images/problem-15-angular-acceleration-option-d.png)
- id: e
  content: |-
    ![Option E](../Source/Images/problem-15-angular-acceleration-option-e.png)
```

---

<a id="avoiding-slope-and-height-traps"></a>
## Avoiding Slope And Height Traps

**Example:** Suppose $\theta_z(t)$ is positive and increasing, but its slope is getting smaller. What is the sign of $\alpha_z(t)$?

**Explanation**

The positive height of the graph only tells us $\theta_z(t)>0$.

The upward motion only tells us $\omega_z(t)>0$.

Acceleration depends on whether $\omega_z(t)$ is increasing or decreasing. If the slope of $\theta_z(t)$ is getting smaller, then $\omega_z(t)$ is decreasing, so

$$
\alpha_z(t)<0.
$$

For a graph-matching problem, test each option against curvature:

1. local minima in $\theta_z(t)$ should line up with positive $\alpha_z(t)$
2. local maxima in $\theta_z(t)$ should line up with negative $\alpha_z(t)$
3. inflection points in $\theta_z(t)$ should line up with zero crossings in $\alpha_z(t)$

```quiz
type: radio
id: q-5
shuffle: true
content: |-
  Which statement gives the correct rule for matching $\theta_z(t)$ to $\alpha_z(t)$?
options:
- id: a
  content: |-
    Use the height of $\theta_z(t)$: above zero means positive acceleration and below zero means negative acceleration.
- id: b
  content: |-
    Use the slope of $\theta_z(t)$: rising means positive acceleration and falling means negative acceleration.
- id: c
  content: |-
    Use the concavity of $\theta_z(t)$: concave up means positive acceleration and concave down means negative acceleration.
  correct: true
- id: d
  content: |-
    Use the turning points of $\theta_z(t)$: every maximum and minimum means acceleration is zero.
```

---

## Summary

To match an angular-position graph to an angular-acceleration graph, read the concavity of $\theta_z(t)$.

Concave up means the slope of $\theta_z(t)$ is increasing, so $\alpha_z(t)>0$. Concave down means the slope is decreasing, so $\alpha_z(t)<0$. When the concavity changes, the acceleration graph should cross zero.

The main trap is using position height or velocity sign instead of concavity. Acceleration is the second derivative of position, so the matching graph follows how the slope changes.
