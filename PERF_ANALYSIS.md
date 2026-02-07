# Performance Analysis Report

**Project**: MKsaas Nano
**Analysis Date**: 2026-02-07
**Analyst**: Performance Engineer Agent

---

## Executive Summary

This analysis identifies performance bottlenecks in the Next.js 15 SaaS application, focusing on frontend loading, image handling, client-side rendering, and data fetching strategies.

---

## 1. Critical Performance Issues

### 1.1 Excessive Client-Side Rendering (HIGH PRIORITY)

**Location**: `/Users/demon/MKsaas/nano/src/ai/image/components/`

**Finding**: 37 out of 37 components in the image generation feature use `'use client'` directive.

**Impact**:
- All components are bundled into client JavaScript
- No Server Component benefits (streaming, reduced JS payload)
- Increased Time to Interactive (TTI)
- Larger initial bundle size

**Affected Files**:
- `ArchPlayground.tsx` - Main playground (397 lines)
- `ConversationLayout.tsx` - Layout wrapper
- `MessageItem.tsx` - Message display
- All bento grid components
- All form controls

**Recommendation**:
1. Convert static display components to Server Components
2. Use composition pattern: Server Component wrapper with Client Component islands
3. Move data fetching to Server Components where possible

---

### 1.2 Heavy Animation Library Usage (HIGH PRIORITY)

**Finding**: 67 occurrences of `framer-motion`/`motion/react` across 65 files.

**Impact**:
- Framer Motion adds ~30-50KB to bundle (gzipped)
- Animation calculations on main thread
- Potential layout thrashing during animations

**Affected Areas**:
- `ArchPlayground.tsx` - Uses AnimatePresence, motion components
- All bento card components
- Multiple UI components in `components/magicui/`
- `components/animate-ui/` directory

**Recommendation**:
1. Use CSS animations for simple transitions
2. Lazy load framer-motion for non-critical animations
3. Consider lighter alternatives (CSS `@keyframes`, Web Animations API)
4. Use `will-change` CSS property for animated elements

---

### 1.3 Large Dependency Bundle (MEDIUM-HIGH PRIORITY)

**Location**: `/Users/demon/MKsaas/nano/package.json`

**Finding**: 118 production dependencies, many are heavy:

| Package | Estimated Size | Usage |
|---------|---------------|-------|
| `framer-motion` + `motion` | ~50KB gzip | Animations |
| `recharts` | ~45KB gzip | Charts |
| `@tabler/icons-react` | ~20KB+ | Icons |
| `lucide-react` | ~15KB+ | Icons |
| `react-syntax-highlighter` | ~30KB+ | Code display |
| `shiki` | ~25KB+ | Syntax highlighting |
| `swiper` | ~25KB | Carousel |
| Multiple AI SDK packages | Variable | AI features |

**Duplicate Functionality**:
- Two icon libraries: `@tabler/icons-react` AND `lucide-react`
- Two animation libraries: `framer-motion` AND `motion`
- Two syntax highlighters: `react-syntax-highlighter` AND `shiki`

**Recommendation**:
1. Consolidate to single icon library (prefer `lucide-react` - tree-shakeable)
2. Remove duplicate animation library
3. Use dynamic imports for heavy components
4. Analyze bundle with `@next/bundle-analyzer`

---

### 1.4 Image Loading Strategy Issues (MEDIUM PRIORITY)

**Location**: `/Users/demon/MKsaas/nano/src/ai/image/components/conversation/MessageItem.tsx`

**Finding**: Images use Next.js Image component but with suboptimal configuration.

**Issues**:
1. Fixed dimensions (512x512) regardless of actual image size
2. No `priority` prop for above-the-fold images
3. No `placeholder="blur"` for better perceived performance
4. Preview dialog loads full-size image without optimization

**Code Example** (lines 385-391):
```tsx
<Image
  src={getImageSrc(message.outputImage)}
  alt={t('canvas.generatedImageAlt')}
  width={512}
  height={512}
  className="w-full h-auto"
/>
```

**Recommendation**:
1. Add `priority` for first visible image
2. Implement blur placeholder for generated images
3. Use `sizes` prop for responsive images
4. Consider lazy loading for images below fold

---

### 1.5 Data Fetching Waterfall (MEDIUM PRIORITY)

**Location**: `/Users/demon/MKsaas/nano/src/ai/image/components/conversation/ConversationLayout.tsx`

**Finding**: Sequential data fetching creates waterfall:

```
1. Load projects (useEffect)
   ↓ wait
2. Auto-select first project (useEffect depends on projects)
   ↓ wait
3. Load messages (useEffect depends on currentProjectId)
```

**Impact**:
- 3 sequential network requests
- Increased Time to First Meaningful Paint
- Poor perceived performance

**Recommendation**:
1. Use React Query or SWR for parallel data fetching
2. Implement optimistic UI updates
3. Consider Server Components for initial data load
4. Use `Promise.all` for independent requests

---

### 1.6 Zustand Store Persistence Overhead (LOW-MEDIUM PRIORITY)

**Location**:
- `/Users/demon/MKsaas/nano/src/stores/project-store.ts`
- `/Users/demon/MKsaas/nano/src/stores/conversation-store.ts`

**Finding**: Both stores use localStorage persistence with custom storage handlers.

**Issues**:
1. Synchronous localStorage operations block main thread
2. JSON serialization/deserialization on every state change
3. Hydration mismatch potential between server and client

**Recommendation**:
1. Use `IndexedDB` for larger data (via `idb-keyval`)
2. Debounce persistence writes
3. Only persist critical state (already partially implemented)

---

## 2. Next.js Configuration Analysis

**Location**: `/Users/demon/MKsaas/nano/next.config.ts`

### Positive Findings:
- Console removal in production enabled
- Server Actions body size limit configured (10MB)
- Remote image patterns properly configured

### Missing Optimizations:

1. **No Bundle Analyzer**
```typescript
// Add to next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
```

2. **No Compression Configuration**
```typescript
// Consider adding
compress: true,
```

3. **No Module Transpilation for Heavy Packages**
```typescript
// Consider for problematic packages
transpilePackages: ['framer-motion'],
```

4. **Image Optimization Disabled Conditionally**
```typescript
unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true'
```
This is good for cost control but should be monitored.

---

## 3. Missing Performance Features

### 3.1 No Code Splitting for Routes
- Heavy components loaded eagerly
- No `next/dynamic` usage for large components

### 3.2 Limited Suspense Usage
- Only 3 files use `Suspense` boundaries
- No streaming for slow data fetches

### 3.3 No Prefetching Strategy
- No `<Link prefetch>` optimization
- No route prefetching for common navigation paths

### 3.4 No Service Worker / PWA
- No offline support
- No asset caching strategy

---

## 4. Optimization Recommendations (Priority Order)

### P0 - Critical (Immediate Impact)

| # | Issue | Action | Estimated Impact |
|---|-------|--------|------------------|
| 1 | Client-side rendering | Convert 10+ components to Server Components | -30% JS bundle |
| 2 | Duplicate dependencies | Remove duplicate icon/animation libs | -50KB bundle |
| 3 | Data fetching waterfall | Parallel fetch with React Query | -500ms TTFMP |

### P1 - High Priority (This Sprint)

| # | Issue | Action | Estimated Impact |
|---|-------|--------|------------------|
| 4 | Heavy animations | CSS animations for simple transitions | -30KB bundle |
| 5 | Image optimization | Add priority, blur, sizes props | Better LCP |
| 6 | Bundle analysis | Add @next/bundle-analyzer | Visibility |

### P2 - Medium Priority (Next Sprint)

| # | Issue | Action | Estimated Impact |
|---|-------|--------|------------------|
| 7 | Code splitting | Dynamic imports for heavy components | -20% initial load |
| 8 | Suspense boundaries | Add streaming for slow fetches | Better UX |
| 9 | Store persistence | Debounce + IndexedDB | Smoother UI |

### P3 - Low Priority (Backlog)

| # | Issue | Action | Estimated Impact |
|---|-------|--------|------------------|
| 10 | PWA support | Add service worker | Offline support |
| 11 | Route prefetching | Optimize Link components | Faster navigation |
| 12 | CDN optimization | Configure edge caching | Global performance |

---

## 5. Metrics to Track

### Core Web Vitals Targets

| Metric | Current (Est.) | Target | Tool |
|--------|---------------|--------|------|
| LCP | >2.5s | <2.5s | Lighthouse |
| FID | >100ms | <100ms | Web Vitals |
| CLS | Unknown | <0.1 | Lighthouse |
| TTI | >4s | <3s | Lighthouse |
| Bundle Size | Unknown | <200KB gzip | Bundle Analyzer |

### Recommended Monitoring

1. **Vercel Analytics** - Already installed (`@vercel/analytics`)
2. **Speed Insights** - Already installed (`@vercel/speed-insights`)
3. **OpenPanel** - Already installed (`@openpanel/nextjs`)

---

## 6. Quick Wins (Can Implement Today)

1. **Add bundle analyzer** to package.json:
```json
"analyze": "ANALYZE=true next build"
```

2. **Add priority to first image** in MessageItem.tsx:
```tsx
<Image priority={isFirst} ... />
```

3. **Remove unused icon library** - Pick one (lucide-react recommended)

4. **Add Suspense boundary** to ConversationLayout for loading states

---

## Appendix: Files Analyzed

- `/Users/demon/MKsaas/nano/next.config.ts`
- `/Users/demon/MKsaas/nano/package.json`
- `/Users/demon/MKsaas/nano/src/ai/image/components/` (37 files)
- `/Users/demon/MKsaas/nano/src/stores/project-store.ts`
- `/Users/demon/MKsaas/nano/src/stores/conversation-store.ts`
- `/Users/demon/MKsaas/nano/src/actions/project-message.ts`

---

*Report generated by Performance Engineer Agent*
