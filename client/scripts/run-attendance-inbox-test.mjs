import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(scriptDirectory, "..");
const playwrightCli = path.join(clientDirectory, "node_modules", "@playwright", "test", "cli.js");
const result = spawnSync(
  process.execPath,
  [playwrightCli, "test", "tests/attendance-inbox.spec.ts", "--workers=1"],
  {
    cwd: clientDirectory,
    env: {
      ...process.env,
      VITE_APP_EDITION: "ATTENDANCE",
      ECS_ATTENDANCE_INBOX_UI_TEST: "1",
    },
    stdio: "inherit",
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
