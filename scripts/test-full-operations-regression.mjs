import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionIdentityContract = require("./lib/version-identity.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
versionIdentityContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
const serverRoot = path.join(repositoryRoot, "server");
const clientRoot = path.join(repositoryRoot, "client");
const npmExecPath = process.env.npm_execpath;

if (!npmExecPath || !existsSync(npmExecPath)) {
  throw new Error("Run the FULL operations regression through: npm run test:full-operations-regression");
}

const ownedEnvironmentKeys = new Set([
  "APP_EDITION",
  "APP_TIMEZONE",
  "CLIENT_ORIGIN",
  "LOG_LEVEL",
  "NODE_ENV",
  "PORT",
  "SHADOW_DATABASE_URL",
  "TZ",
]);
const ownedEnvironmentPrefixes = [
  "APP_FEATURE_",
  "ATTENDANCE_",
  "DOTENV_CONFIG_",
  "PLAYWRIGHT_",
  "VITE_",
  "ZKTECO_",
];

function sanitizedEnvironment() {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    const normalized = key.toUpperCase();
    if (
      ownedEnvironmentKeys.has(normalized)
      || ownedEnvironmentPrefixes.some((prefix) => normalized.startsWith(prefix))
    ) {
      delete environment[key];
    }
  }
  return environment;
}

const serverEnvironment = {
  ...sanitizedEnvironment(),
  APP_EDITION: "FULL",
  APP_TIMEZONE: "Asia/Kabul",
  ATTENDANCE_POLICY: "TIME_CLOCK",
  ATTENDANCE_AUTO_CHECKOUT_ENABLED: "1",
  NODE_ENV: "test",
  TZ: "UTC",
};

const clientEnvironment = {
  ...sanitizedEnvironment(),
  ECS_BUILD_EDITION: "FULL",
  VITE_API_URL: "http://127.0.0.1:1",
  VITE_APP_EDITION: "FULL",
};

function npmStep(label, workingDirectory, args, environment, timeoutMs = 10 * 60 * 1000) {
  return {
    label,
    command: process.execPath,
    args: [npmExecPath, "run", ...args],
    workingDirectory,
    environment,
    timeoutMs,
  };
}

function compiledServerTest(label, relativePath, args = [], timeoutMs = 15 * 60 * 1000) {
  return {
    label,
    command: process.execPath,
    args: [path.join(serverRoot, "dist", ...relativePath.split("/")), ...args],
    workingDirectory: serverRoot,
    environment: serverEnvironment,
    timeoutMs,
  };
}

function runStep(step, index, total) {
  process.stdout.write(`\n[full-operations ${index}/${total}] ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.workingDirectory,
    env: step.environment,
    shell: false,
    stdio: "inherit",
    timeout: step.timeoutMs,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`${step.label} could not complete: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit ${String(result.status)}`;
    throw new Error(`${step.label} failed (${detail})`);
  }
}

function findAvailableLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate an isolated Playwright port"));
        return;
      }
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const steps = [
  npmStep("Server typecheck", serverRoot, ["typecheck"], serverEnvironment),
  npmStep("Server build (once)", serverRoot, ["build"], serverEnvironment),
  compiledServerTest("FULL HTTP route inventory", "routes/http-route-registry.api.test.js"),
  compiledServerTest("FULL role and effective-permission preservation", "modules/auth/auth.permissions.test.js"),
  compiledServerTest("Customer/Membership/Payment lifecycle", "modules/members/member.service.test.js"),
  compiledServerTest("FULL Dashboard permissions", "modules/dashboard/dashboard-permissions.api.test.js"),
  compiledServerTest("FULL Attendance reports and exports", "modules/reports-attendance/reports-attendance.service.test.js"),
  compiledServerTest("Cashflow report", "modules/reports-cashflow/reports-cashflow.service.test.js"),
  compiledServerTest("Debt-aging report", "modules/reports-debt-aging/debt-aging.logic.test.js"),
  compiledServerTest("Report export health", "modules/reports/report-export-health.test.js"),
  compiledServerTest("Backup service", "modules/backups/backup.service.test.js"),
  compiledServerTest("Backup hardening", "modules/backups/backup-hardening.test.js"),
  compiledServerTest("Backup role/API matrix", "modules/backups/backup.api.integration.test.js"),
  compiledServerTest("Membership mutation and payment PostgreSQL workflow", "modules/members/membership-audit.api.integration.test.js"),
  compiledServerTest("Membership-plan PostgreSQL workflow", "modules/membership-plans/plan-audit.api.integration.test.js"),
  compiledServerTest("Staff-group PostgreSQL workflow", "modules/staff-groups/staff-group-audit.api.integration.test.js"),
  compiledServerTest("Expense PostgreSQL workflow", "modules/expenses/expenses.api.integration.test.js"),
  compiledServerTest("Payroll PostgreSQL workflow", "modules/payroll/payroll.integration.test.js"),
  compiledServerTest("FULL report/export PostgreSQL workflow", "modules/membership-report/membership-report-audit.api.integration.test.js"),
  compiledServerTest("Sound settings PostgreSQL workflow", "modules/sounds/sounds-audit.api.integration.test.js"),
  compiledServerTest("Backup failure/restart PostgreSQL workflow", "modules/backups/backup.workflow.integration.runner.js", [], 20 * 60 * 1000),
  compiledServerTest("Real pg_dump/pg_restore FULL compatibility", "modules/backups/attendance-restore-isolation.integration.runner.js", ["--full-regression"], 20 * 60 * 1000),
  npmStep("Client typecheck", clientRoot, ["typecheck"], clientEnvironment),
  npmStep("Client lint", clientRoot, ["lint", "--", "--quiet"], clientEnvironment),
  npmStep("FULL client production build", clientRoot, ["build"], clientEnvironment),
  npmStep("FULL/ATTENDANCE artifact isolation", clientRoot, ["test:route-build-boundary:scan"], clientEnvironment),
];

const reportPort = await findAvailableLoopbackPort();
const auditPort = await findAvailableLoopbackPort();
steps.push(
  npmStep(
    "FULL localized report downloads",
    clientRoot,
    ["test:report-downloads"],
    {
      ...clientEnvironment,
      PLAYWRIGHT_PORT: String(reportPort),
      PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
    },
    20 * 60 * 1000
  ),
  npmStep(
    "FULL Audit viewer",
    clientRoot,
    ["test:audit-logs"],
    {
      ...clientEnvironment,
      PLAYWRIGHT_PORT: String(auditPort),
      PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
    },
    20 * 60 * 1000
  )
);

for (const [index, step] of steps.entries()) {
  runStep(step, index + 1, steps.length);
}

process.stdout.write(
  "\n[full-operations] PASS - FULL routes, roles, Customer/Membership/Payment/Payroll/Expense workflows, reports/exports, Backup failure handling, and real FULL restore compatibility are intact.\n"
);
