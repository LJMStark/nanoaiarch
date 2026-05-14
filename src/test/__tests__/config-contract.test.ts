import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '../../..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('configuration contract', () => {
  it('uses NEXT_PUBLIC_BASE_URL in CI and Playwright config', () => {
    const workflow = readRepoFile('.github/workflows/test.yml');
    const playwright = readRepoFile('playwright.config.ts');
    const testEnv = readRepoFile('src/test/env.ts');
    const deprecatedBaseUrlEnv = `NEXT_PUBLIC_${'APP_URL'}`;

    expect(workflow).toContain('NEXT_PUBLIC_BASE_URL');
    expect(playwright).toContain('NEXT_PUBLIC_BASE_URL');
    expect(testEnv).toContain('NEXT_PUBLIC_BASE_URL');
    expect(`${workflow}\n${playwright}\n${testEnv}`).not.toContain(
      deprecatedBaseUrlEnv
    );
  });

  it('does not keep a Vercel deployment cron config', () => {
    expect(() => readRepoFile('vercel.json')).toThrow();
  });
});
