import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import rootConfig from '../../vitest.config';

const appRoot = import.meta.dirname;
const workspaceRoot = resolve(appRoot, '../..');

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'app/**/*.test.ts', 'app/**/*.test.tsx'],
    },
    resolve: {
      alias: {
        '@pomofocus/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
        '@pomofocus/core': resolve(workspaceRoot, 'packages/core/src/index.ts'),
        '@pomofocus/state': resolve(workspaceRoot, 'packages/state/src/index.ts'),
        '@pomofocus/ui': resolve(workspaceRoot, 'packages/ui/src/index.ts'),
      },
    },
  }),
);
