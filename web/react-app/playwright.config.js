// End-to-end tests run against the production bundle in ./build.
// Run `npm run build` first, then `npm run test:e2e`.
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // System Chrome by default, so no browser download is needed.
    // Set PW_CHANNEL=chromium to use Playwright's own build instead.
    channel: process.env.PW_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'node e2e/serve.js',
    url: `http://127.0.0.1:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
  },
});
