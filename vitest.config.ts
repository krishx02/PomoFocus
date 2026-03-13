import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
  resolve: {
    alias: {
      '@pomofocus/types': resolve(root, 'packages/types/src/index.ts'),
      '@pomofocus/core': resolve(root, 'packages/core/src/index.ts'),
      '@pomofocus/analytics': resolve(root, 'packages/analytics/src/index.ts'),
      '@pomofocus/data-access': resolve(root, 'packages/data-access/src/index.ts'),
      '@pomofocus/state': resolve(root, 'packages/state/src/index.ts'),
      '@pomofocus/ui': resolve(root, 'packages/ui/src/index.ts'),
      '@pomofocus/ble-protocol': resolve(root, 'packages/ble-protocol/src/index.ts'),
    },
  },
});
