import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const serverRoot = path.join(repositoryRoot, "server");
const clientRoot = path.join(repositoryRoot, "client");
const canonical = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
versionContract.assertNodeVersion(canonical.identity);

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath || !existsSync(npmExecPath)) {
  throw new Error("Run Phase 6.1 through npm with the pinned Node runtime so npm_execpath is available.");
}

function nodeStep(label, scriptPath, timeoutMs = 20 * 60 * 1000) {
  return { label, command: process.execPath, args: [scriptPath], cwd: repositoryRoot, timeoutMs };
}

function npmStep(label, cwd, args, timeoutMs = 20 * 60 * 1000) {
  return { label, command: process.execPath, args: [npmExecPath, "run", ...args], cwd, timeoutMs };
}

const steps = [
  nodeStep("Canonical version/build identity unit matrix", path.join(scriptDirectory, "test-version-identity.mjs")),
  npmStep("Server typecheck", serverRoot, ["typecheck"]),
  npmStep("Server complete test build", serverRoot, ["build"]),
  nodeStep("Server/Client canonical identity consumers", path.join(scriptDirectory, "test-version-consumers.mjs")),
  npmStep("Client typecheck", clientRoot, ["typecheck"]),
  npmStep("Client lint", clientRoot, ["lint", "--", "--quiet"]),
  npmStep("Client Auth compatibility matrix", clientRoot, ["test:auth-state-unit"]),
  nodeStep("Independent reproducible Edition artifacts and tamper matrix", path.join(scriptDirectory, "test-build-artifacts.mjs")),
  npmStep("Existing FULL/ATTENDANCE boundary regression", serverRoot, ["test:edition-boundary"], 30 * 60 * 1000),
  npmStep("Existing FULL operations regression", serverRoot, ["test:full-operations-regression"], 30 * 60 * 1000),
];

for (const [index, step] of steps.entries()) {
  process.stdout.write(`\n[phase-6.1 ${index + 1}/${steps.length}] ${step.label}\n`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: process.env,
    shell: false,
    stdio: "inherit",
    timeout: step.timeoutMs,
    windowsHide: true,
  });
  if (result.error) throw new Error(`${step.label} could not complete: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit ${String(result.status)}`;
    throw new Error(`${step.label} failed (${detail}).`);
  }
}

process.stdout.write(
  `\n[phase-6.1] PASS - Node ${process.versions.node}; canonical ${canonical.identity.productVersion}; independent FULL/ATTENDANCE artifacts and existing regressions passed.\n`
);
