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
        'messages/',
      ],
      // Floor thresholds — keep them just below the measured baseline and
      // ratchet upward only after coverage genuinely improves.
      thresholds: {
        statements: 52,
        branches: 40,
        functions: 50,
        lines: 52,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
