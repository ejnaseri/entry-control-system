import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const buildIdentityContract = require("./lib/build-identity.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const serverRoot = path.join(repositoryRoot, "server");
const clientRoot = path.join(repositoryRoot, "client");
const canonical = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));

for (const packagePath of [path.join(serverRoot, "package.json"), path.join(clientRoot, "package.json")]) {
  const packageDocument = JSON.parse(readFileSync(packagePath, "utf8"));
  assert.equal(
    packageDocument.version,
    canonical.identity.productVersion,
    `${packagePath} must mirror canonical productVersion`
  );
}

const identitySources = [
  path.join(serverRoot, "src", "app.ts"),
  path.join(clientRoot, "vite.config.ts"),
  path.join(clientRoot, "src", "config", "clientBuildIdentity.ts"),
  path.join(repositoryRoot, "scripts", "test-edition-boundary.mjs"),
  path.join(repositoryRoot, "scripts", "test-full-operations-regression.mjs"),
  path.join(clientRoot, "scripts", "test-route-build-boundary.mjs"),
];
for (const sourcePath of identitySources) {
  const source = readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("VITE_APP_VERSION"), false, `${sourcePath} still consumes VITE_APP_VERSION`);
  if (sourcePath.endsWith("app.ts") || sourcePath.endsWith("clientBuildIdentity.ts") || sourcePath.endsWith("vite.config.ts")) {
    assert.equal(source.includes('"1.0.0"'), false, `${sourcePath} still hardcodes the Product Version`);
  }
}

const fullIdentity = buildIdentityContract.createBuildIdentity(canonical, "FULL");
assert.equal(fullIdentity.productVersion, canonical.identity.productVersion);
assert.equal(fullIdentity.versionIdentitySha256, canonical.sha256);

const compiledBuildIdentityModule = path.join(serverRoot, "dist", "config", "build-identity.js");
assert.ok(existsSync(compiledBuildIdentityModule), "Server build must run before consumer tests");
const productionProbe = `
  const contract = require(${JSON.stringify(compiledBuildIdentityModule)});
  contract.resolveServerBuildIdentity("FULL", {
    nodeEnv: "production",
    rawRuntimeEdition: "FULL",
    actualNodeVersion: ${JSON.stringify(canonical.identity.nodeVersion)}
  });
`;
const productionResult = spawnSync(process.execPath, ["-e", productionProbe], {
  cwd: serverRoot,
  env: process.env,
  encoding: "utf8",
  shell: false,
  timeout: 10_000,
  windowsHide: true,
});
assert.notEqual(productionResult.status, 0, "Unpackaged production Server must fail closed");
assert.match(productionResult.stderr, /build-identity\.json|build:full|build:attendance/u);

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ecs identity mismatch "));
try {
  const viteEntry = path.join(clientRoot, "node_modules", "vite", "bin", "vite.js");
  const unnamedOutput = path.join(temporaryRoot, "unnamed-client-output");
  const unnamedEnvironment = {
    ...process.env,
    VITE_APP_EDITION: "FULL",
  };
  delete unnamedEnvironment.ECS_BUILD_EDITION;
  const unnamed = spawnSync(
    process.execPath,
    [viteEntry, "build", "--outDir", unnamedOutput, "--emptyOutDir"],
    {
      cwd: clientRoot,
      env: unnamedEnvironment,
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      windowsHide: true,
    }
  );
  assert.notEqual(unnamed.status, 0, "Standalone Client production build must fail without ECS_BUILD_EDITION");
  assert.match(`${unnamed.stdout}\n${unnamed.stderr}`, /root build:full or build:attendance/u);
  assert.equal(existsSync(unnamedOutput), false, "An unnamed Client build must not emit output");

  const mismatchOutput = path.join(temporaryRoot, "client-output");
  const mismatch = spawnSync(
    process.execPath,
    [viteEntry, "build", "--outDir", mismatchOutput, "--emptyOutDir"],
    {
      cwd: clientRoot,
      env: {
        ...process.env,
        ECS_BUILD_EDITION: "ATTENDANCE",
        VITE_APP_EDITION: "FULL",
        VITE_APP_VERSION: "999.999.999",
      },
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      windowsHide: true,
    }
  );
  assert.notEqual(mismatch.status, 0, "Conflicting Client Edition sources must fail");
  assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /Build Edition mismatch/u);
  assert.equal(existsSync(mismatchOutput), false, "A failed identity check must not emit a Client artifact");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("ok - Server, Client, package metadata and runners consume canonical identity without version fallback");
