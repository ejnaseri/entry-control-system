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
  throw new Error("Run the edition boundary through: npm run test:edition-boundary");
}

const ownedEnvironmentKeys = new Set([
  "APP_EDITION",
  "APP_TIMEZONE",
  "CLIENT_ORIGIN",
  "DATABASE_URL",
  "LOG_LEVEL",
  "NODE_ENV",
  "PORT",
  "SHADOW_DATABASE_URL",
  "TZ",
]);

const ownedEnvironmentPrefixes = [
  "APP_FEATURE_",
  "ATTENDANCE_",
  "ATLASGYM_",
  "AUTH_",
  "DOOR_",
  "DOTENV_CONFIG_",
  "PLAYWRIGHT_",
  "VITE_",
  "ZKTECO_",
];

function sanitizedEnvironment() {
  const environment = { ...process.env };

  for (const key of Object.keys(environment)) {
    const normalizedKey = key.toUpperCase();
    if (
      ownedEnvironmentKeys.has(normalizedKey) ||
      ownedEnvironmentPrefixes.some((prefix) => normalizedKey.startsWith(prefix))
    ) {
      delete environment[key];
    }
  }

  return environment;
}

const missingDotenvPath = path.join(
  repositoryRoot,
  `.edition-boundary-missing-${process.pid}-${Date.now()}.env`
);

if (existsSync(missingDotenvPath)) {
  throw new Error(`Refusing to use an existing dotenv isolation path: ${missingDotenvPath}`);
}

const serverEnvironment = {
  ...sanitizedEnvironment(),
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://edition_boundary:edition_boundary@127.0.0.1:1/edition_boundary",
  DOTENV_CONFIG_PATH: missingDotenvPath,
  DOTENV_CONFIG_QUIET: "true",
};

const clientEnvironment = {
  ...sanitizedEnvironment(),
  ECS_BUILD_EDITION: "FULL",
  VITE_API_URL: "http://127.0.0.1:1",
  VITE_APP_EDITION: "FULL",
};

function npmStep(label, workingDirectory, args, environment, timeoutMs = 300_000) {
  return {
    label,
    command: process.execPath,
    args: [npmExecPath, "run", ...args],
    workingDirectory,
    environment,
    timeoutMs,
  };
}

function compiledServerTest(label, relativePath) {
  return {
    label,
    command: process.execPath,
    args: [path.join(serverRoot, "dist", ...relativePath.split("/"))],
    workingDirectory: serverRoot,
    environment: serverEnvironment,
    timeoutMs: 240_000,
  };
}

function runStep(step, index, total) {
  process.stdout.write(`\n[edition-boundary ${index}/${total}] ${step.label}\n`);

  const result = spawnSync(step.command, step.args, {
    cwd: step.workingDirectory,
    env: step.environment,
    shell: false,
    stdio: "inherit",
    timeout: step.timeoutMs,
    windowsHide: true,
  });

  if (result.error) {
    process.stderr.write(
      `[edition-boundary] ${step.label} could not complete: ${result.error.message}\n`
    );
    return false;
  }

  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit ${String(result.status)}`;
    process.stderr.write(`[edition-boundary] ${step.label} failed (${detail}).\n`);
    return false;
  }

  return true;
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
        reject(new Error("Could not allocate an isolated Playwright port."));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

const steps = [
  npmStep("Server typecheck", serverRoot, ["typecheck"], serverEnvironment),
  npmStep("Server build (once)", serverRoot, ["build"], serverEnvironment),
  compiledServerTest("Edition config and startup admission", "config/edition-config.test.js"),
  compiledServerTest("Capability matrix and code readiness", "config/capabilities.test.js"),
  compiledServerTest("Employee Staff-only service boundary", "modules/employees/employee.service.test.js"),
  compiledServerTest("Employee HTTP permission and route boundary", "modules/employees/employee.api.test.js"),
  compiledServerTest("Legacy FULL Member service preservation", "modules/members/member.service.test.js"),
  compiledServerTest("Device Staff-only service boundary", "modules/devices/device.staff-boundary.test.js"),
  compiledServerTest("Device HTTP and physical-module boundary", "modules/devices/device.api.test.js"),
  compiledServerTest("Legacy FULL K40 and Device preservation", "modules/devices/zktecoK40.service.test.js"),
  compiledServerTest("Attendance calculation regression", "modules/attendance/attendance.logic.test.js"),
  compiledServerTest("Attendance auto-checkout default-off boundary", "modules/inbox/inbox.jobs.test.js"),
  compiledServerTest("Attendance strict Staff service boundary", "modules/attendance/attendance.staff-boundary.test.js"),
  compiledServerTest("Attendance HTTP permission and Edition scope", "modules/attendance/attendance.api.test.js"),
  compiledServerTest("Attendance semantics and Daily/Report reconciliation", "modules/attendance/attendance.semantics.test.js"),
  compiledServerTest("Legacy FULL Attendance report preservation", "modules/reports-attendance/reports-attendance.service.test.js"),
  compiledServerTest("Attendance report and compliance Staff boundary", "modules/reports-attendance/reports-attendance.staff-boundary.test.js"),
  compiledServerTest("Attendance Report read and dedicated export boundary", "modules/reports-attendance/attendance-report.test.js"),
  compiledServerTest("Attendance Dashboard Staff-only service and HTTP boundary", "modules/dashboard/attendance-dashboard.test.js"),
  compiledServerTest("Legacy FULL Dashboard permission preservation", "modules/dashboard/dashboard-permissions.api.test.js"),
  compiledServerTest("Effective permission intersection", "modules/auth/auth.permissions.test.js"),
  compiledServerTest("Public identity and Auth contract", "modules/auth/auth.contract.api.test.js"),
  compiledServerTest("Attendance admin role mapping and schemas", "modules/admin-users/admin-user.edition.test.js"),
  compiledServerTest("Audit Log historical Edition and redaction boundary", "modules/audit-logs/audit-log.edition.test.js"),
  compiledServerTest("Backup ZIP and external-process hardening", "modules/backups/backup-hardening.test.js"),
  compiledServerTest("HTTP registration and disabled-route boundary", "routes/http-route-registry.api.test.js"),
  compiledServerTest("Startup consumer boundary", "bootstrap.test.js"),
  npmStep("Client Auth normalization", clientRoot, ["test:auth-state-unit"], clientEnvironment),
  npmStep("Client Route Manifest and redirect boundary", clientRoot, ["test:route-manifest"], clientEnvironment),
  npmStep("Client product branding contract", clientRoot, ["test:product-brand"], clientEnvironment),
  npmStep("Client typecheck", clientRoot, ["typecheck"], clientEnvironment),
  npmStep("Client lint", clientRoot, ["lint", "--", "--quiet"], clientEnvironment),
  npmStep("Client production build (once)", clientRoot, ["build"], clientEnvironment),
  npmStep("Client FULL/ATTENDANCE route build isolation", clientRoot, ["test:route-build-boundary:scan"], clientEnvironment),
];

const totalSteps = steps.length + 2;

for (const [index, step] of steps.entries()) {
  if (!runStep(step, index + 1, totalSteps)) {
    process.exitCode = 1;
    process.exit();
  }
}

const playwrightPort = await findAvailableLoopbackPort();
const componentEnvironment = {
  ...clientEnvironment,
  PLAYWRIGHT_PORT: String(playwrightPort),
  PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
};
const componentStep = npmStep(
  "Client Auth and Route guard component matrix",
  clientRoot,
  ["test:edition-components"],
  componentEnvironment,
  900_000
);

if (!runStep(componentStep, steps.length + 1, totalSteps)) {
  process.exitCode = 1;
  process.exit();
}

const attendancePlaywrightPort = await findAvailableLoopbackPort();
const attendancePhaseEnvironment = {
  ...clientEnvironment,
  ECS_BUILD_EDITION: "ATTENDANCE",
  PLAYWRIGHT_PORT: String(attendancePlaywrightPort),
  PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
  VITE_APP_EDITION: "ATTENDANCE",
};
const attendancePhaseStep = npmStep(
  "Client Attendance real-app routes, audited branded exports, timecard, language, and theme gate",
  clientRoot,
  ["test:attendance-real-app"],
  attendancePhaseEnvironment,
  600_000
);

if (!runStep(attendancePhaseStep, steps.length + 2, totalSteps)) {
  process.exitCode = 1;
  process.exit();
}

process.stdout.write(
  "\n[edition-boundary] PASS - FULL and ATTENDANCE boundaries, including Backup hardening/promotion, historical Audit isolation, redaction, attributed export audits, Entry Control branding, and three-language Attendance exports, are intact.\n"
);
