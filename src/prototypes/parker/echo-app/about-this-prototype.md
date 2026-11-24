---
studioId: 5b9z6sp9580ks01r
title: About this prototype
description: A short tour of the Echo app, from engineering handoff to early explorations.
toc: true
---

Welcome! This prototype is an example of how you can bring a product idea to life in Design Studio. It shows Echo, a made-up tool that gathers customer feedback in one inbox and ties each request to the account behind it.

The working screens sit alongside the thinking behind them. These files are called **artifacts**. Together, they help you explore an experience, explain your decisions, and give your team a clearer picture of what you want to build.

## Take a short tour

### 1. Start with the handoff

[Eng handoff](eng-handoff.excalidraw) brings the key screens, states, and engineering notes together on one canvas. It gives you an overview of the proposed experience and the details that need attention during implementation.

Open a screen from its preview header to try it yourself. The previews stay connected to the original screens, so changes to a screen also appear on the canvas.

![Eng handoff canvas with screens, states, and engineering notes](eng-handoff.excalidraw)

### 2. Try the experience

Open [Overview](app/overview.tsx), then choose **Open issues** to explore the [Feedback inbox](app/feedback-inbox.tsx). Add feedback, open an item in [Feedback detail](app/feedback-detail.tsx), and try changing its status or adding a note.

This is sample data, so you can experiment freely. Reloading the page resets it.

![Feedback inbox screen](app/feedback-inbox.tsx)

### 3. Look at the details

The **States** folder lets you jump straight to moments that are easy to miss in a walkthrough. Explore an [empty inbox](states/inbox/empty.tsx), a [form with a validation error](states/inbox/validation-error.tsx), or a [delete confirmation](states/inbox/delete-confirmation.tsx).

Having these moments available separately makes it easier to compare options and discuss how the product should respond.

![Validation error](states/inbox/validation-error.tsx)

### 4. Explore the thinking behind it

The **Discovery** folder holds the earlier work behind the proposal. [Project context](discovery/project-context.md) explains the problem, the intended audience, and the decisions and questions that shaped this example.

The [Feedback flow](discovery/feedback-flow.mermaid) maps the experience, while [Breadboard](discovery/breadboard.excalidraw) brings the flow and early sketches together. The [Lo-fi inbox](discovery/lofi-inbox.tsx) presents the working screen as a wireframe, helping you focus on layout before visual polish.

![Feedback review flow](discovery/feedback-flow.mermaid)

## Make it your own

This prototype uses the **Product** system for its components and visual style. Its sibling, [Echo website](/prototypes/2h7mkxzppqfjv1xv/artifacts/1hz1pr0jff6c71bh), is the same product's marketing site, built with the **Marketing** system. The two share Echo's brand, the way an in-house team's product and website would.

Work with your agent to try a change, such as adding a due date or exploring a different inbox layout. Share what you want to improve and point your agent to Project context so it understands the idea behind the request. You can review the result here and guide the next change.

You own the files behind every artifact. You can ask your agent to update them or use **Edit source** in an artifact’s menu to inspect and edit them directly.

When you’re ready to explore your own idea, create a prototype from the **Prototypes** page. Visit the [Manual](/documentation/manual) if you want to learn more.
