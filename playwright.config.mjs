import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.mjs",
  timeout: 60000,
  reporter: [["list"]],
  use: {
    ...devices["iPhone 13"],
    baseURL: "http://localhost:4173/",
    serviceWorkers: "block",
    acceptDownloads: true
  },
  projects: [{ name: "webkit-iphone", use: { browserName: "webkit" } }],
  webServer: {
    command: "node tests/servidor.mjs",
    env: { PORT: "4173" },
    url: "http://localhost:4173/index.html",
    reuseExistingServer: false
  }
});
