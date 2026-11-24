---
title: Marketing library
description: The selected shadcn/Base UI subset and its integration with Studio.
---

Marketing is an independent shadcn/Base UI system for Echo's website. Product remains the default for product prototypes. Both share Echo's cobalt, zinc neutrals, and Geist; Marketing adds display sizes and larger, rounder controls.

## Included

- Button: default, outline, ghost, and link styles; small, default, and large sizes.
- Tabs: segmented and underline lists with associated panels.
- Tooltip: supplemental information in a scoped popup.
- Lucide icons, Geist and Geist Mono, Echo's cobalt and zinc colors, selected spacing, and four display sizes.
- Light and dark modes, declared in `styles/theme.css`.

The theme file is the inventory. Add omitted tokens and components deliberately. Landing-page sections are local prototype composition.

## Source and adaptations

Components derive from the starter’s vendored [shadcn/ui Base UI components](https://ui.shadcn.com/docs/components). Marketing keeps independent runtime files; it does not import Product. The shadcn MIT notice is retained in `LICENSE`.

Button keeps shadcn’s variant pattern and Base UI behavior with 32px, 40px, and 48px controls. Navigation uses plain anchors styled by `buttonVariants`, preserving link semantics. Icons are ordinary children. Tabs use Base UI values and active states, with Marketing’s rounded geometry. Tooltip uses `usePortalContainer()` and omits animation and arrow embellishments.

All styles and popups stay inside Marketing’s theme boundary. Named color aliases remain for prototype composition, alongside shadcn’s semantic roles. The brand values live in [Brand](brand.md).

Dependencies are `@base-ui/react`, `class-variance-authority`, `lucide-react`, `@fontsource-variable/geist`, and `@fontsource-variable/geist-mono`. The shared `cn` utility comes through the platform UI entry. No full upstream catalog or global theme is installed.
