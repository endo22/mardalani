import { defineConfig, devices } from "@playwright/test";

/**
 * Temporary / optional config for production smoke.
 * Does not start a local webServer; points at the live URL.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  outputDir: "test-results-prod",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://mardalani.vercel.app",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
