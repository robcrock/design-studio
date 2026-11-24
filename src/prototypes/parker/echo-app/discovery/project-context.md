---
studioId: 9jmjq17bwtce5tq6
title: Project Context
description: The problem, working assumptions, and explorations behind Echo's feedback inbox.
toc: true
---

## The problem

Customer feedback is scattered across email, chat, interviews, surveys, and support tickets. The team needs one place to capture it, see which accounts are asking and what they're worth, and track what happens next.

## Who it's for

- **Sam, product lead:** triage new feedback and decide what goes on the roadmap.
- **Support leads and account managers:** capture feedback quickly, wherever they hear it.
- **Designers:** find patterns worth exploring.

## Working assumptions

- Items move through **New, Triaged, Planned, and Resolved**.
- Status and priority help the team decide what to address.
- Notes stay with the feedback item so its history stays together.
- Every item belongs to an account, so revenue can inform priority.

## Open questions

- Where should filtering live?
- When should customers hear back?
- How long should resolved feedback remain visible?

## Explore the idea

The feedback flow models the review cycle. Its source is shared with the Breadboard canvas.

![Feedback review flow](feedback-flow.mermaid)

The low-fidelity inbox lets us discuss layout while keeping the screen's behavior.

![Lo-fi inbox](lofi-inbox.tsx)

Breadboard compares the live diagram with an independent, editable sketch. Open the canvas to rearrange or annotate it.

![Breadboard exploration](breadboard.excalidraw)
