import { defineConfig } from '@playwright/test'

// Runs the site straight from index.html in the installed Microsoft Edge (no browser download needed).
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    channel: 'msedge',
    viewport: { width: 1280, height: 900 },
  },
})
