import { defineConfig, devices } from "@playwright/test";

const playwrightPortSource = process.env.PLAYWRIGHT_PORT ?? "5173";
const playwrightPort = Number(playwrightPortSource);

if (!Number.isInteger(playwrightPort) || playwrightPort <= 0 || playwrightPort > 65_535) {
  throw new Error(`PLAYWRIGHT_PORT must be a valid TCP port, received: ${playwrightPortSource}`);
}

const reuseExistingServerSource = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER;
if (
  reuseExistingServerSource !== undefined &&
  reuseExistingServerSource !== "0" &&
  reuseExistingServerSource !== "1"
) {
  throw new Error("PLAYWRIGHT_REUSE_EXISTING_SERVER must be 0 or 1 when provided.");
}

const playwrightOrigin = `http://127.0.0.1:${playwrightPort}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? playwrightOrigin,
    acceptDownloads: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `${npmCommand} run dev -- --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
    url: playwrightOrigin,
    reuseExistingServer: reuseExistingServerSource === undefined ? true : reuseExistingServerSource === "1",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
  ],
});
