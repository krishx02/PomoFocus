// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. With pnpm, packages inside .pnpm need to resolve their own deps.
// disableHierarchicalLookup breaks this, so we leave it off (default: false).
// The nodeModulesPaths above are still preferred for resolution order.

// 4. Exclude test files from Metro bundling (Expo Router treats all files in app/ as routes)
config.resolver.blockList = [/.*\.test\.[jt]sx?$/];

// 5. Resolve .ts/.tsx source files in workspace packages (imports use .js extensions per ESM)
config.resolver.sourceExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs', 'mjs'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Rewrite .js imports to .ts/.tsx for workspace packages
  if (moduleName.endsWith('.js') && !moduleName.includes('node_modules')) {
    for (const ext of ['.ts', '.tsx']) {
      const rewritten = moduleName.replace(/\.js$/, ext);
      try {
        return context.resolveRequest(context, rewritten, platform);
      } catch {
        // Try next extension
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 4. Use a separate cache for web to avoid conflicts with mobile
config.cacheStores = [
  new FileStore({
    root: path.join(projectRoot, 'node_modules', '.cache', 'metro'),
  }),
];

module.exports = config;
