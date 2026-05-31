import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/validations.ts',
        'src/lib/proxy-path.ts',
        'src/lib/safe-redirect.ts',
        'src/lib/session-cookie.ts',
        'src/lib/verify-access-token.ts',
        'src/middleware.ts',
        'src/contexts/auth-context.tsx',
      ],
      thresholds: {
        lines: 75,
        branches: 65,
      },
    },
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
      ['src/**/*.spec.tsx', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
