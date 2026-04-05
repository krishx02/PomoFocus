import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import rootConfig from '../../vitest.config';

const packageRoot = import.meta.dirname;
const workspaceRoot = resolve(packageRoot, '../..');

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
    resolve: {
      alias: {
        'react-native': resolve(packageRoot, 'node_modules/react-native-web'),
        '@pomofocus/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
        '@pomofocus/ui': resolve(workspaceRoot, 'packages/ui/src/index.ts'),
        'react-native': 'react-native-web',
      },
    },
  }),
);
