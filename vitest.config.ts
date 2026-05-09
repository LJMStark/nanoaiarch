import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest globs across the repo by default; we keep e2e/ for Playwright
    // so vitest must not pick those .spec files up.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.*',
        '.next/',
        'content/',
      ],
      // Floor thresholds — set just below the Week 1.7 baseline (statements
      // 55.44% / branches 43.39% / lines 56.13%). The intent is to ratchet:
      // every PR must hold or improve coverage, so the bar climbs naturally
      // as Week 3.4 (Testcontainers) and Week 3.6 (Playwright) land.
      // Bump these numbers each time coverage genuinely improves.
      thresholds: {
        statements: 55,
        branches: 43,
        functions: 50,
        lines: 55,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
