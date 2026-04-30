import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'scripts/',
        'apps/docs/',
      ],
    },
    setupFiles: [],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@ssas/core': path.resolve(__dirname, 'packages/core/src'),
      '@ssas/database': path.resolve(__dirname, 'packages/database/src'),
      '@ssas/storage': path.resolve(__dirname, 'packages/storage/src'),
      '@ssas/analytics': path.resolve(__dirname, 'packages/analytics/src'),
      '@ssas/alerting': path.resolve(__dirname, 'packages/alerting/src'),
      '@ssas/auth': path.resolve(__dirname, 'packages/auth/src'),
      '@ssas/ingest': path.resolve(__dirname, 'packages/ingest/src'),
      '@ssas/cdp': path.resolve(__dirname, 'packages/cdp/src'),
    },
  },
});
