# Sitewide editorial redesign

## Context

This project is a Next.js 16 + Tailwind CSS v4 SaaS application with three major user-facing surfaces:

- Marketing pages under `src/app/[locale]/(marketing)/`
- Authentication pages under `src/app/[locale]/auth/`
- Protected dashboard pages under `src/app/[locale]/(protected)/`

The codebase already has a solid structural foundation, but the visual language is inconsistent. Marketing pages lean on a generic SaaS hero and card layout, auth pages are utilitarian, and the dashboard uses a standard sidebar-and-cards template. The redesign should unify all three surfaces without changing the framework or rewriting the app.

## Goals

- Establish one premium, editorial-leaning design language across all pages
- Preserve existing information architecture and functionality
- Improve perceived polish through typography, palette, spacing, surfaces, and interaction states
- Reduce template-like UI patterns in the home page, auth pages, and dashboard
- Make shared components expressive enough that the rest of the app benefits automatically

## Direction

### Brand feel

The approved direction is an editorial, high-end product aesthetic:

- warm paper-like backgrounds instead of pure white
- charcoal text instead of hard black
- one restrained moss-green accent instead of multiple saturated accents
- strong display typography paired with calm body text
- subtle texture, tinted shadows, and layered surfaces instead of generic white cards

### Typography

Reuse the existing font stack to keep implementation low-risk:

- `Bricolage Grotesque` for display headlines and emphasized section titles
- `Noto Sans` for interface and body copy
- `Noto Serif` sparingly for editorial callouts or supporting copy
- `Noto Sans Mono` and tabular numerals for numbers, stats, and pricing details

Typography changes should include:

- tighter tracking on large headings
- smaller line-heights on display text
- sentence case labels instead of all-caps everywhere
- narrower body copy measures for improved reading rhythm

### Color system

Unify the palette around a warm neutral base and a single moss-green accent.

Light mode:

- soft paper background
- warm neutral cards and panels
- charcoal foreground
- muted olive-green accent

Dark mode:

- ink-like green-black background
- softened panel contrast instead of pure black
- same accent family preserved across modes

Avoid mixed gray temperatures, rainbow gradients, and generic AI blue/purple aesthetics.

### Surfaces and depth

Define a layered surface system:

- primary surfaces for hero frames, auth cards, and featured dashboard panels
- secondary surfaces for supporting cards and grouped content
- low-emphasis groupings that rely on spacing instead of borders

Use tinted shadows, subtle inner highlights, and very light texture to make the interface feel intentional rather than flat.

### Motion and interaction

Use restrained motion with consistent timing:

- 200ms to 280ms transitions for interactive elements
- hover states with slight lift, glow, or edge highlight
- active states with subtle press feedback
- visible focus rings on buttons, links, and inputs
- skeletons and composed empty states instead of generic spinners or blank screens

## Audit findings

### Marketing

- Home hero uses a familiar centered SaaS layout
- Several sections rely on equal-width grids and generic bordered cards
- Accent usage is inconsistent in showcase and template sections
- Footer reads like a default multi-column link farm
- Section headers rely heavily on uppercase mono labels

### Auth

- Auth shell is visually sparse and detached from the product brand
- Auth card is a plain bordered card with limited hierarchy
- Back navigation feels bolted on rather than designed into the layout
- Inputs and actions are functional but lack premium styling

### Dashboard

- Protected area looks like a separate template from the marketing site
- Sidebar, header, and stat cards rely on default shadcn-style patterns
- Quick actions use multiple bright colors that break the single-accent rule
- Empty states are serviceable but visually thin

## Page-level design

### Marketing pages

- Shift from center-heavy layouts to more editorial asymmetry
- Make the hero left-led with stronger narrative hierarchy
- Redesign stats into a cleaner, publication-like number strip
- Refine feature and showcase sections away from generic equal-card grids where possible
- Keep pricing clear, but emphasize the recommended tier through tone, spacing, and weight rather than height alone
- Simplify the footer into a stronger brand close with fewer competing link groups

### Content pages

Pages like pricing, help, legal, blog, and contact should share a consistent content template:

- strong page head with label, display title, and narrow intro copy
- controlled reading width
- more intentional spacing and typography for lists, tables, metadata, and supporting panels

### Auth pages

- Introduce a richer shell with brand framing and surface depth
- Keep mobile layout single-column and clear
- Use the same palette, typography, and spacing system as marketing
- Improve form, feedback, and navigation presentation without changing logic

### Dashboard

- Keep the existing sidebar architecture, but reduce template feel
- Make the dashboard header lighter and more refined
- Increase hierarchy within statistics, actions, and recent content
- Bring marketing and product surfaces into the same visual family

### System states

Loading, empty, error, and not-found pages should follow the same design language:

- skeletons aligned with real layout structure
- direct, calm error copy
- useful recovery actions
- branded not-found experience

## Component rules

### Buttons

- stronger primary button with calmer accent tone
- refined outline and ghost variants
- more text-link usage for tertiary actions

### Cards

- stop using the same border + white background + small shadow everywhere
- use layered surfaces with different emphasis levels
- let spacing and typography do more of the hierarchy work

### Forms

- quieter resting state
- clearer focus treatment
- direct validation messages
- consistent spacing across labels, help text, and status messaging

### Navigation

- floating/sticky top nav with translucent paper surface when scrolled
- more refined active states
- dashboard sidebar with lighter separation and better sectional rhythm

### Icons and imagery

- reduce dependency on colorful icon metaphors
- prioritize screenshots, texture, and restrained geometry
- keep icons supportive rather than dominant

## Implementation strategy

The redesign should be delivered as a targeted refactor rather than a rewrite.

Priority order:

1. Shared tokens and base styles
2. Shared primitives such as button, input, card, container, and section headers
3. Global shells: navbar, footer, auth layout, dashboard chrome
4. Home page sections and pricing presentation
5. Dashboard summary modules and empty states
6. Verification, cleanup, and follow-up adjustments

## Risks and constraints

- No framework migration
- No changes that break routing, authentication, payments, or existing actions
- Keep modifications reviewable and compatible with Tailwind v4
- Prefer shared component changes over page-specific overrides where possible
- Verify with linting, tests, and a production build before shipping
