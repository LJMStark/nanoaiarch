# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` for Next.js App Router routes, with locales under `src/app/[locale]/`.
- `src/actions/` for server actions that mutate data.
- `src/ai/`, `src/payment/`, `src/credits/` for domain features.
- `src/components/`, `src/hooks/`, `src/stores/`, `src/lib/` for shared UI, hooks, state, and utilities.
- `src/db/` for Drizzle schema and migrations.
- `src/i18n/` and `messages/` for localization; `content/` for docs/blog MDX.
- `public/` for static assets and `scripts/` for maintenance tasks.
- `src/test/` for Vitest setup and helpers.

## Build, Test, and Development Commands
Use `pnpm` (not npm/yarn).
- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: create a production build.
- `pnpm start`: run the production server.
- `pnpm lint` / `pnpm format`: run Biome linting and formatting.
- `pnpm test`, `pnpm test:ui`, `pnpm test:coverage`: run Vitest in CLI, UI, or coverage mode.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`: manage Drizzle migrations and inspect data.
- `pnpm content`: rebuild MDX content; `pnpm email`: preview email templates.

## Coding Style & Naming Conventions
- TypeScript + Next.js App Router; prefer server actions for mutations in `src/actions/`.
- Biome enforces 2-space indentation, single quotes, semicolons, and import ordering.
- Use the `@/` alias for `src/` imports.
- Prefer `function` declarations for named functions and explicit return types on public APIs.

## Testing Guidelines
- Vitest + React Testing Library with jsdom.
- Tests live in `src/**/__tests__/*.test.ts(x)`; setup in `src/test/setup.ts`.
- Keep tests deterministic and focused on behavior.

## Commit & Pull Request Guidelines
- Follow the commit style in history: `feat: ...`, `fix: ...`, `refactor: ...`, `chore: ...`.
- Keep commits small and explain the "why".
- PRs should include a short summary, linked issues, test output, and UI screenshots or recordings when UI changes.

## Security & Configuration Tips
- Copy `env.example` to `.env.local` and set required values (e.g., `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `DUOMI_API_KEY`, `NEXT_PUBLIC_APP_URL`).
- Never commit secrets or production credentials.
