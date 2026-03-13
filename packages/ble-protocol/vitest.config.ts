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
    },
    resolve: {
      alias: {
        '@pomofocus/ble-protocol': resolve(workspaceRoot, 'packages/ble-protocol/src/index.ts'),
      },
    },
  }),
);
