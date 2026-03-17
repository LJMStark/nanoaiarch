# Sitewide editorial redesign implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a sitewide editorial redesign that unifies marketing, auth, and dashboard surfaces without changing product behavior.

**Architecture:** Update the shared design system first, then restyle the main shells and highest-traffic screens so the rest of the app inherits the new visual language through common primitives and layout components. Keep functionality stable by limiting structural changes to presentation and validating with lint, tests, and a production build.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, next-intl, shadcn/ui primitives, Vitest

---

### Task 1: Create the design foundation

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/components/layout/container.tsx`
- Test: `pnpm lint`

**Step 1: Update the token palette and base styles**

- Replace the current bright-neutral token set with warm paper neutrals and moss-green accents
- Add global body, selection, typography, scroll, and texture rules
- Introduce reusable surface utility classes for premium cards and panels

**Step 2: Update viewport theme colors**

- Align the locale layout viewport colors with the new light and dark palettes

**Step 3: Tighten container behavior**

- Increase the default container width and adjust horizontal padding expectations for large layouts

**Step 4: Verify the shared layer compiles**

Run: `pnpm lint`

Expected: no CSS or TypeScript errors from the global system changes

**Step 5: Commit**

```bash
git add src/styles/globals.css src/app/[locale]/layout.tsx src/components/layout/container.tsx
git commit -m "refactor: establish editorial design tokens"
```

### Task 2: Redesign shared primitives

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/layout/header-section.tsx`
- Test: `pnpm lint`

**Step 1: Restyle button variants**

- Make primary buttons denser and more polished
- Refine outline, ghost, and link variants to match the new palette and motion language

**Step 2: Restyle inputs and shared card surfaces**

- Improve focus rings, border tone, height, and background treatment
- Introduce more premium card defaults while allowing specific components to opt out

**Step 3: Rework section headers**

- Replace uppercase mono-heavy defaults with editorial hierarchy and controlled text widths

**Step 4: Verify type safety and class merging**

Run: `pnpm lint`

Expected: no formatting or type issues in shared primitives

**Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/card.tsx src/components/layout/header-section.tsx
git commit -m "refactor: upgrade shared editorial primitives"
```

### Task 3: Redesign global marketing chrome

**Files:**
- Modify: `src/components/layout/navbar.tsx`
- Modify: `src/components/layout/footer.tsx`
- Modify: `src/app/[locale]/(marketing)/layout.tsx`
- Modify: `src/config/footer-config.tsx`
- Test: `pnpm lint`

**Step 1: Upgrade navbar presentation**

- Give the sticky header a translucent paper surface on scroll
- Improve active-state clarity and action grouping
- Bring logo, brand, auth actions, theme toggle, and locale switcher into one cleaner system

**Step 2: Simplify and elevate the footer**

- Reduce the link-farm feel
- Emphasize brand close, legal links, and social actions in a calmer layout

**Step 3: Keep marketing shell semantics intact**

- Preserve the existing navbar/main/footer structure while improving spacing and rhythm

**Step 4: Verify navigation components**

Run: `pnpm lint`

Expected: no client component or Tailwind issues

**Step 5: Commit**

```bash
git add src/components/layout/navbar.tsx src/components/layout/footer.tsx src/app/[locale]/(marketing)/layout.tsx src/config/footer-config.tsx
git commit -m "feat: redesign marketing shell"
```

### Task 4: Redesign the home page sections

**Files:**
- Modify: `src/components/blocks/hero/hero.tsx`
- Modify: `src/components/blocks/stats/stats.tsx`
- Modify: `src/components/blocks/template-showcase/template-showcase.tsx`
- Modify: `src/components/blocks/showcase/showcase.tsx`
- Modify: `src/components/blocks/pricing/pricing.tsx`
- Modify: `src/components/blocks/faqs/faqs.tsx`
- Modify: `src/components/pricing/subscription-style-pricing.tsx`
- Test: `pnpm lint`

**Step 1: Recompose the hero**

- Move from centered SaaS hero to editorial split layout
- Keep existing translation keys and CTA destinations
- Reframe the screenshot with stronger depth and supporting notes

**Step 2: Restyle section modules**

- Convert stats into a cleaner editorial strip
- Tone down multi-color showcase accents
- Upgrade the template carousel framing and supporting labels
- Improve pricing section head and tab switcher styling
- Replace the FAQ shell with a more premium container and spacing rhythm

**Step 3: Verify the home page path**

Run: `pnpm lint`

Expected: no issues in marketing blocks and motion components

**Step 4: Commit**

```bash
git add src/components/blocks/hero/hero.tsx src/components/blocks/stats/stats.tsx src/components/blocks/template-showcase/template-showcase.tsx src/components/blocks/showcase/showcase.tsx src/components/blocks/pricing/pricing.tsx src/components/blocks/faqs/faqs.tsx src/components/pricing/subscription-style-pricing.tsx
git commit -m "feat: redesign home page sections"
```

### Task 5: Redesign auth shell and form experience

**Files:**
- Modify: `src/app/[locale]/auth/layout.tsx`
- Modify: `src/components/auth/auth-card.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/shared/back-button-small.tsx`
- Test: `pnpm lint`

**Step 1: Upgrade auth page shell**

- Add background depth and a more intentional frame
- Integrate the back action into the layout rather than leaving it floating alone

**Step 2: Restyle auth card and login form**

- Improve logo placement, supporting copy, form spacing, and action emphasis
- Preserve all existing auth behavior, callback handling, captcha validation, and social login flow

**Step 3: Verify auth components**

Run: `pnpm lint`

Expected: no issues in client form components or links

**Step 4: Commit**

```bash
git add src/app/[locale]/auth/layout.tsx src/components/auth/auth-card.tsx src/components/auth/login-form.tsx src/components/shared/back-button-small.tsx
git commit -m "feat: redesign auth experience"
```

### Task 6: Redesign dashboard chrome and summary modules

**Files:**
- Modify: `src/app/[locale]/(protected)/layout.tsx`
- Modify: `src/components/ui/sidebar.tsx`
- Modify: `src/components/dashboard/dashboard-sidebar.tsx`
- Modify: `src/components/dashboard/dashboard-header.tsx`
- Modify: `src/components/dashboard/stats-cards.tsx`
- Modify: `src/components/dashboard/quick-actions.tsx`
- Modify: `src/components/dashboard/recent-generations.tsx`
- Test: `pnpm lint`

**Step 1: Upgrade the dashboard frame**

- Keep the sidebar architecture intact
- Refine sidebar width, inset surface, edge treatment, and collapse feel

**Step 2: Redesign dashboard modules**

- Improve stat card hierarchy and typography
- Replace rainbow quick-action styling with a single-accent editorial system
- Strengthen recent history cards, empty states, and action overlays
- Lighten the dashboard header while preserving existing controls

**Step 3: Verify dashboard component safety**

Run: `pnpm lint`

Expected: no issues across protected layout and UI sidebar components

**Step 4: Commit**

```bash
git add src/app/[locale]/(protected)/layout.tsx src/components/ui/sidebar.tsx src/components/dashboard/dashboard-sidebar.tsx src/components/dashboard/dashboard-header.tsx src/components/dashboard/stats-cards.tsx src/components/dashboard/quick-actions.tsx src/components/dashboard/recent-generations.tsx
git commit -m "feat: redesign dashboard shell and summaries"
```

### Task 7: Review and verify before push

**Files:**
- Review: `git diff --stat`
- Test: `pnpm lint`
- Test: `pnpm test -- --runInBand`
- Test: `pnpm build`

**Step 1: Run lint and tests**

Run: `pnpm lint`

Expected: PASS

Run: `pnpm test -- --runInBand`

Expected: PASS

**Step 2: Run a production build**

Run: `pnpm build`

Expected: PASS and no new runtime or route errors

**Step 3: Self-review the diff**

Run: `git diff --stat`

Expected: shared system files, key shells, and primary pages updated without unrelated churn

**Step 4: Commit and push**

```bash
git add .
git commit -m "feat: ship sitewide editorial redesign"
git push -u origin codex/sitewide-editorial-redesign
```
