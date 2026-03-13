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
      include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
    },
    resolve: {
      alias: {
        '@pomofocus/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
        '@pomofocus/core': resolve(workspaceRoot, 'packages/core/src/index.ts'),
        '@pomofocus/analytics': resolve(workspaceRoot, 'packages/analytics/src/index.ts'),
        '@pomofocus/data-access': resolve(workspaceRoot, 'packages/data-access/src/index.ts'),
        '@pomofocus/state': resolve(workspaceRoot, 'packages/state/src/index.ts'),
        '@pomofocus/ui': resolve(workspaceRoot, 'packages/ui/src/index.ts'),
      },
    },
  }),
);
