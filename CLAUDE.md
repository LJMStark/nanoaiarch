# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build production bundle (runs type check and fumadocs-mdx)
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter and auto-fix issues
- `pnpm lint:fix` - Run Biome with unsafe fixes
- `pnpm format` - Format code with Biome

### Database Operations (Drizzle ORM)
- `pnpm db:generate` - Generate migration files from schema changes
- `pnpm db:migrate` - Apply pending migrations to database
- `pnpm db:push` - Sync schema directly to DB (development only, skips migrations)
- `pnpm db:studio` - Open Drizzle Studio for database management

### Testing (Vitest)
- `pnpm test` - Run tests in watch mode
- `pnpm test:ui` - Run tests with Vitest UI
- `pnpm test:coverage` - Generate coverage report
- Tests located in `src/**/__tests__/*.test.ts(x)`

### Content & Email
- `pnpm content` - Process MDX content collections (fumadocs)
- `pnpm email` - Start email template dev server on port 3333

### Utilities
- `pnpm list-users` - List all users (script)
- `pnpm list-contacts` - List newsletter contacts (script)

## Project Architecture

This is a Next.js 15 full-stack SaaS application built on the **MkSaaS** template, optimized for rapid AI product development.

### Core Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Better Auth (email/password, Google, GitHub)
- **Payments**: Stripe (subscriptions + one-time)
- **UI**: Radix UI + TailwindCSS
- **State**: Zustand with persistence
- **i18n**: next-intl (English/Chinese)
- **Content**: Fumadocs (docs) + MDX (blog)
- **Quality**: Biome (linting/formatting), Vitest (testing)

### Key Architectural Patterns

#### 1. AI Image Generation System (`src/ai/image/`)

The centerpiece feature with a sophisticated multi-layer architecture:

**Provider Layer** (`lib/provider-config.ts`)
- Supports Duomi API (Gemini 3 Pro model)
- Configurable image quality: 1K/2K/4K
- Credits-based consumption (0.14/generation)

**State Management** (Zustand stores)
- `conversation-store.ts` - Message history with persistence
- `project-store.ts` - Project config and draft state
- Both use localStorage with error handling and migration support

**Components Architecture**
- `ArchPlayground.tsx` - Main playground page
- `ConversationLayout.tsx` - Project-based conversation UI
- `ConversationInput.tsx` - Input with multi-image upload
- `MessageItem.tsx` - Message display with retry/download/share
- `GenerationSettings.tsx` - Quality/ratio controls
- `ReferenceImagesPreview.tsx` - Image preview component

**Data Flow**
```
User Input → ConversationInput → Server Action (addUserMessage)
          → Generate Image → Duomi API → Poll for result
          → Server Action (updateAssistantMessage) → Update Store → UI Update
```

**Recovery System** (`hooks/use-generation-recovery.ts`)
- Detects interrupted generations on mount
- Auto-recovers generating state from localStorage
- Prevents orphaned "generating" states

#### 2. Server Actions Pattern (`src/actions/`)

All data mutations use Next.js Server Actions with this pattern:

```typescript
export async function actionName(params) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  // 2. Validation (Zod schemas recommended)
  const validated = schema.parse(params);

  // 3. Database operation
  const db = await getDb();
  const result = await db.insert(...);

  // 4. Return typed response
  return { success: true, data: result };
}
```

**Key Server Actions**:
- `src/actions/project-message.ts` - Message CRUD for conversations
- `src/actions/image-project.ts` - Project management
- `src/actions/check-payment-completion.ts` - Payment verification

#### 3. Database Schema (`src/db/schema.ts`)

**Core Tables**:
- `user` - User accounts with Better Auth integration
- `session` - Session management with IP/user-agent tracking
- `account` - OAuth provider linkage
- `payment` - Stripe payments with invoice deduplication
- `credit_transaction` - Credit system transactions
- `imageProject` - AI image generation projects
- `projectMessage` - Conversation messages with generation metadata

**Indexing Strategy**:
- All foreign keys indexed
- User role, customer ID indexed
- Payment status, scene, type indexed
- Project user ID indexed for fast queries

#### 4. Authentication Flow (`src/lib/auth.ts`)

**Better Auth Configuration**:
- Session cookie caching (1 hour)
- 7-day session expiration
- Email verification required
- Automatic welcome email + credit distribution
- Social providers: Google, GitHub
- Admin plugin for user banning

**Locale Handling**:
- Reads `NEXT_LOCALE` cookie for user language
- Injects locale into email verification URLs
- Supports callback URL localization

#### 5. Internationalization (`src/i18n/`)

**Structure**:
- `routing.ts` - Define supported locales (en, zh)
- `request.ts` - Server-side locale detection
- `messages/en.json` - English translations
- `messages/zh.json` - Chinese translations

**Usage Pattern**:
```typescript
// Server Component
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('PageName');

// Client Component
import { useTranslations } from 'next-intl';
const t = useTranslations('PageName');
```

#### 6. Payment System (`src/payment/`)

**Credit System** (`src/credits/`):
- Free monthly credits (auto-renewal)
- Registration gift credits (one-time)
- Pay-per-use credit packages
- Transaction logging with credit_transaction table

**Stripe Integration**:
- Webhook handlers for invoice.paid, subscription events
- Customer portal for subscription management
- Three tiers: Free, Pro (monthly/yearly), Lifetime
- Scene-based payment tracking (subscription/credit/lifetime)

### Directory Structure Philosophy

```
src/
├── app/              # Next.js routes (internationalized with [locale])
├── actions/          # Server actions (data mutations)
├── ai/               # AI features (image generation)
│   └── image/
│       ├── components/   # UI components
│       ├── hooks/        # React hooks
│       ├── lib/          # Business logic
│       └── config/       # Configuration
├── components/       # Shared UI components
├── db/              # Database schema and migrations
├── stores/          # Zustand state management
├── lib/             # Utility functions
├── hooks/           # Global React hooks
├── config/          # App configuration
├── i18n/            # Internationalization
├── mail/            # Email templates
├── payment/         # Payment integration
└── credits/         # Credit system logic
```

### Code Style & Conventions

**TypeScript**:
- Use `function` keyword for named functions (not arrow functions)
- Explicit return types for public functions
- Path aliases: `@/*` maps to `src/*`

**Comments**:
- Code comments in English
- UI text in messages/locales (English + Chinese)
- JSDoc for public APIs

**State Management**:
- Zustand for client state (with persistence if needed)
- Server state via Server Actions
- No React Context for global state

**Error Handling**:
- Server Actions return `{ success: boolean, error?: string, data?: T }`
- Client errors use `error.tsx` boundaries
- 404s use `not-found.tsx`

**Imports**:
- Group imports: external → internal → relative
- Use Biome auto-sort

### Testing Strategy

**Current Coverage**:
- Server Actions: `src/actions/__tests__/`
- Components: `src/ai/image/components/conversation/__tests__/`
- Vitest + React Testing Library + jsdom

**Test Pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

### Environment Configuration

**Required Variables** (see `env.example`):
- `DATABASE_URL` - PostgreSQL connection
- `BETTER_AUTH_SECRET` - Auth encryption key
- `STRIPE_SECRET_KEY` - Stripe API key
- `DUOMI_API_KEY` - AI image generation API
- `NEXT_PUBLIC_APP_URL` - Application base URL

**Image Upload**:
- Max body size: 10MB (configured in `next.config.ts`)
- Image optimization can be disabled via `DISABLE_IMAGE_OPTIMIZATION=true`

### Performance Considerations

**Next.js 15 Optimizations**:
- Server Components by default
- Client components marked with `'use client'`
- Dynamic imports for heavy components
- Image optimization with remote patterns whitelist

**Database**:
- Connection pooling via Drizzle
- Indexed foreign keys and common queries
- Avoid N+1 with proper joins

**State**:
- Zustand slices prevent unnecessary re-renders
- Persist only critical state (not full message history)
- Use `useCallback`/`useMemo` for expensive computations

### Common Development Workflows

**Adding a New Server Action**:
1. Create in `src/actions/[feature].ts`
2. Add auth check + validation
3. Perform DB operation
4. Return typed response
5. Import and use in components

**Adding a New Database Table**:
1. Define in `src/db/schema.ts`
2. Run `pnpm db:generate` (creates migration)
3. Run `pnpm db:migrate` (applies migration)
4. Update TypeScript types if needed

**Adding a New Route**:
1. Create in `src/app/[locale]/[route]/page.tsx`
2. Add translations in `messages/en.json` and `messages/zh.json`
3. Use `getTranslations()` for server components or `useTranslations()` for client

**Debugging Image Generation**:
1. Check `conversation-store` in localStorage
2. Verify `isGenerating` and `generatingMessageId` state
3. Check Server Action logs for API errors
4. Inspect `projectMessage` table for stuck messages
5. Use generation recovery hook to reset state

### Important Notes

- Package manager is **pnpm** (not npm/yarn)
- Database is PostgreSQL (Drizzle ORM adapter)
- Biome handles both linting and formatting (no ESLint/Prettier)
- Server Actions have 10MB body size limit
- Image generation uses polling (not streaming)
- All routes are internationalized with `[locale]` segment
- Better Auth handles session management (no NextAuth)
- Stripe webhooks require proper endpoint configuration

### Useful Resources

- Documentation: https://mksaas.com/docs
- Discord: https://mksaas.link/discord
- GitHub: https://github.com/MkSaaSHQ/mksaas-template
