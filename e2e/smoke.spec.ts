import { expect, test } from '@playwright/test';

/**
 * Smoke tests — Week 3.6.
 *
 * Verify every public route the app exposes boots, returns 200 OK, and has
 * no JS console errors. This catches the "the whole app is on fire" class
 * of regression that unit tests can't see (middleware, i18n bootstrapping,
 * client/server boundary mistakes, etc.).
 *
 * Pages covered:
 *   /            — marketing home
 *   /pricing     — 4-column membership table (Week 1.6 redesign)
 *   /privacy     — legal SSG
 *   /terms       — legal SSG
 *   /cookie      — legal SSG
 *   /blog        — SEO content list
 *   /blog/[slug] — SEO content detail
 *   /about
 *   /contact
 *   /auth/login  — auth entry
 *   /auth/register
 *   /sitemap.xml
 *   /robots.txt
 *
 * Excluded for now (need real auth or external services):
 *   /(protected)/* — needs a logged-in session
 *   /ai/image     — needs Gemini API key + auth
 *   /api/*        — exercised via unit/integration tests, not E2E
 */

const PUBLIC_ROUTES: Array<{ path: string; expects: RegExp }> = [
  // Home: should render the brand title somewhere.
  { path: '/', expects: /Arch AI|建筑|MkSaaS/i },
  // Pricing: 4 tiers (非会员 + 黄金/铂金/钻石).
  { path: '/pricing', expects: /会员|套餐|订阅/i },
  { path: '/privacy', expects: /privacy|隐私/i },
  { path: '/terms', expects: /terms|条款/i },
  { path: '/cookie', expects: /Cookie|政策/i },
  { path: '/blog', expects: /博客|文章/i },
  {
    path: '/blog/ai-rendering-wins-clients',
    expects: /建筑师|效果图|客户/i,
  },
  { path: '/about', expects: /关于我们|Arch AI/i },
  { path: '/contact', expects: /联系我们|邮箱/i },
  { path: '/auth/login', expects: /邮箱|登录|password/i },
  { path: '/auth/register', expects: /注册|register|邮箱/i },
];

for (const { path, expects } of PUBLIC_ROUTES) {
  test(`${path} renders without console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    const response = await page.goto(path);
    expect(response, `expected response for ${path}`).not.toBeNull();
    expect(response?.status(), `${path} status`).toBeLessThan(400);

    // Wait for the body to render so client hydration completes — without
    // this the test races the framework and gets false positives on errors
    // that show up after first paint.
    await expect(page.locator('body')).toBeVisible();

    await expect(page.getByText(expects).first()).toBeVisible({
      timeout: 10_000,
    });

    // Filter known-noisy warnings that aren't real errors. Keep this list
    // narrow so it stays meaningful.
    const significantErrors = consoleErrors.filter(
      (msg) =>
        // React DevTools download prompt
        !msg.includes('Download the React DevTools') &&
        // Service-worker registration noise on localhost
        !msg.includes('ServiceWorker registration')
    );
    expect(
      significantErrors,
      `console errors on ${path}:\n${significantErrors.join('\n')}`
    ).toHaveLength(0);
  });
}

test('pricing page shows the three paid tiers', async ({ page }) => {
  await page.goto('/pricing');
  // Tier names are i18n-driven (CreditPricing.Card.tiers.*); we assert on
  // their rendered Chinese form because that's the only locale shipping.
  await expect(page.getByText('黄金会员').first()).toBeVisible();
  await expect(page.getByText('铂金会员').first()).toBeVisible();
  await expect(page.getByText('钻石会员').first()).toBeVisible();
});

test('sitemap and robots expose public SEO metadata without removed routes', async ({
  request,
}) => {
  const [sitemapResponse, robotsResponse] = await Promise.all([
    request.get('/sitemap.xml'),
    request.get('/robots.txt'),
  ]);

  expect(sitemapResponse.status()).toBe(200);
  expect(robotsResponse.status()).toBe(200);

  const sitemapXml = await sitemapResponse.text();
  expect(sitemapXml).toContain('/blog/ai-rendering-wins-clients');
  expect(sitemapXml).not.toContain('/waitlist');
  expect(sitemapXml).not.toContain('/changelog');

  const robotsTxt = await robotsResponse.text();
  expect(robotsTxt).toContain('Sitemap:');
  expect(robotsTxt).toContain('/sitemap.xml');
});

test('removed marketing routes return 404', async ({ request }) => {
  await Promise.all(
    ['/waitlist', '/changelog'].map(async (path) => {
      const response = await request.get(path);
      expect(response.status(), `${path} status`).toBe(404);
    })
  );
});

test('protected routes redirect anonymous users to login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fdashboard/);
  await expect(page.getByText(/欢迎回来|登录/).first()).toBeVisible();
});

test('cron route rejects missing auth and advertises supported schemes', async ({
  request,
}) => {
  const response = await request.get('/api/cron/lease-sweep');

  expect(response.status()).toBe(401);
  const authenticateHeader = response.headers()['www-authenticate'] ?? '';
  expect(authenticateHeader).toContain('Bearer');
  expect(authenticateHeader).toContain('Basic');
});
