import { defineConfig } from '@playwright/test';
import type { Engine } from './e2e/harness';

// Browsers drive the built extension in .output/, so build before testing:
// `pnpm test:e2e` does both.
export default defineConfig<{ engine: Engine }>({
  testDir: 'e2e',
  timeout: 60_000,
  // Each test launches its own browser with the extension installed
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{platform}/{arg}{ext}',
  expect: {
    toMatchSnapshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    { name: 'chromium', use: { engine: 'chromium' } },
    { name: 'firefox', use: { engine: 'firefox' } },
  ],
});
