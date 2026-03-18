import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import rootConfig from '../../vitest.config';

const packageRoot = import.meta.dirname;
const workspaceRoot = resolve(packageRoot, '../..');

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: ['**/generated/**'],
      coverage: {
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/generated/**'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
    resolve: {
      alias: {
        '@pomofocus/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
        '@pomofocus/core': resolve(workspaceRoot, 'packages/core/src/index.ts'),
        '@pomofocus/data-access': resolve(workspaceRoot, 'packages/data-access/src/index.ts'),
      },
    },
  }),
);
