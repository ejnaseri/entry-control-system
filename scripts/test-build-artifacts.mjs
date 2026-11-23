import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const artifactContract = require("./lib/artifact-manifest.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const parsedVersionIdentity = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
versionContract.assertNodeVersion(parsedVersionIdentity.identity);

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ecs phase 6.1 artifacts "));
const builds = Object.freeze({
  fullA: path.join(temporaryRoot, "full-a"),
  fullB: path.join(temporaryRoot, "full-b"),
  attendanceA: path.join(temporaryRoot, "attendance-a"),
  attendanceB: path.join(temporaryRoot, "attendance-b"),
});

function runBuild(label, edition, output) {
  process.stdout.write(`\n[artifact-repro] ${label}\n`);
  const result = spawnSync(
    process.execPath,
    [path.join(scriptDirectory, "build-edition.mjs"), "--edition", edition, "--output", output],
    {
      cwd: path.join(temporaryRoot, "path with no repository cwd"),
      env: {
        ...process.env,
        APP_EDITION: edition === "FULL" ? "ATTENDANCE" : "FULL",
        ECS_BUILD_EDITION: "POISONED",
        LANG: "poisoned-locale",
        LC_ALL: "poisoned-locale",
        npm_config_user_agent: "poisoned-package-environment",
        TZ: "Pacific/Kiritimati",
        VITE_APP_EDITION: edition === "FULL" ? "ATTENDANCE" : "FULL",
        VITE_APP_VERSION: "999.999.999",
        npm_package_version: "999.999.999",
      },
      shell: false,
      stdio: "inherit",
      timeout: 10 * 60 * 1000,
      windowsHide: true,
    }
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${label} failed`);
}

function rejectedArguments(argumentsList, environmentPatch = {}) {
  return spawnSync(
    process.execPath,
    [path.join(scriptDirectory, "build-edition.mjs"), ...argumentsList],
    {
      cwd: repositoryRoot,
      env: { ...process.env, ...environmentPatch },
      encoding: "utf8",
      shell: false,
      timeout: 10_000,
      windowsHide: true,
    }
  );
}

function rejectedBuild(edition, output, environmentPatch = {}) {
  return rejectedArguments(["--edition", edition, "--output", output], environmentPatch);
}

function manifestBytes(root) {
  return readFileSync(path.join(root, artifactContract.MANIFEST_FILE));
}

function sidecarBytes(root) {
  return readFileSync(path.join(root, artifactContract.MANIFEST_HASH_FILE));
}

function verify(root, edition) {
  return artifactContract.verifyArtifact(root, parsedVersionIdentity, edition);
}

function probePackagedServer(root, runtimeEdition, rawRuntimeEdition, actualNodeVersion = process.versions.node) {
  const modulePath = path.join(root, "server", "dist", "config", "build-identity.js");
  const probe = `
    const contract = require(${JSON.stringify(modulePath)});
    const result = contract.resolveServerBuildIdentity(${JSON.stringify(runtimeEdition)}, {
      nodeEnv: "production",
      rawRuntimeEdition: ${rawRuntimeEdition === undefined ? "undefined" : JSON.stringify(rawRuntimeEdition)},
      actualNodeVersion: ${JSON.stringify(actualNodeVersion)}
    });
    process.stdout.write(JSON.stringify(result));
  `;
  return spawnSync(process.execPath, ["-e", probe], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    encoding: "utf8",
    shell: false,
    timeout: 10_000,
    windowsHide: true,
  });
}

function rewriteManifest(root, transform) {
  const manifestPath = path.join(root, artifactContract.MANIFEST_FILE);
  const sidecarPath = path.join(root, artifactContract.MANIFEST_HASH_FILE);
  const originalManifest = readFileSync(manifestPath);
  const originalSidecar = readFileSync(sidecarPath);
  const value = JSON.parse(originalManifest.toString("utf8"));
  transform(value);
  const nextManifest = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  writeFileSync(manifestPath, nextManifest);
  writeFileSync(
    sidecarPath,
    `${versionContract.sha256Hex(nextManifest)}  ${artifactContract.MANIFEST_FILE}\n`,
    "utf8"
  );
  return () => {
    writeFileSync(manifestPath, originalManifest);
    writeFileSync(sidecarPath, originalSidecar);
  };
}

try {
  // The builder must resolve every source from its own location, not from cwd.
  mkdirSync(path.join(temporaryRoot, "path with no repository cwd"));

  const existingCustomOutput = path.join(temporaryRoot, "existing-custom-output");
  mkdirSync(existingCustomOutput);
  const existingSentinel = path.join(existingCustomOutput, "must-survive.txt");
  writeFileSync(existingSentinel, "preserve", { encoding: "utf8", flag: "wx" });
  const existingOutputResult = rejectedBuild("FULL", existingCustomOutput);
  assert.notEqual(existingOutputResult.status, 0, "A custom build must not replace an existing directory");
  assert.equal(readFileSync(existingSentinel, "utf8"), "preserve");

  const repositoryOutput = path.join(repositoryRoot, "server", "phase-6-1-unsafe-output");
  assert.equal(existsSync(repositoryOutput), false, "Unsafe-output test path unexpectedly exists");
  const repositoryOutputResult = rejectedBuild("FULL", repositoryOutput);
  assert.notEqual(repositoryOutputResult.status, 0, "A custom build must not write into source directories");
  assert.equal(existsSync(repositoryOutput), false, "Rejected repository output created files");

  const crossEditionOutput = path.join(repositoryRoot, "release", "FULL");
  const crossEditionIdentity = path.join(crossEditionOutput, "build-identity.json");
  const crossEditionIdentityBefore = existsSync(crossEditionIdentity)
    ? readFileSync(crossEditionIdentity)
    : null;
  const crossEditionResult = rejectedBuild("ATTENDANCE", crossEditionOutput);
  assert.notEqual(crossEditionResult.status, 0, "A build must reject the other Edition's owned output path");
  assert.match(
    `${crossEditionResult.stdout ?? ""}\n${crossEditionResult.stderr ?? ""}`,
    /outside the requested Edition path/u,
    "The cross-Edition output must be rejected by path policy before building"
  );
  assert.equal(
    existsSync(crossEditionIdentity),
    crossEditionIdentityBefore !== null,
    "A rejected cross-Edition output changed the existing artifact"
  );
  if (crossEditionIdentityBefore !== null) {
    assert.deepEqual(
      readFileSync(crossEditionIdentity),
      crossEditionIdentityBefore,
      "A rejected cross-Edition output modified the existing artifact identity"
    );
  }

  const missingOutputValueResult = rejectedArguments(["--edition", "FULL", "--output"]);
  assert.notEqual(missingOutputValueResult.status, 0, "A value-less --output must be rejected");
  assert.match(
    `${missingOutputValueResult.stdout ?? ""}\n${missingOutputValueResult.stderr ?? ""}`,
    /--output requires a value/u,
    "A value-less --output must fail in argument parsing before selecting the official output"
  );
  if (crossEditionIdentityBefore !== null) {
    assert.deepEqual(
      readFileSync(crossEditionIdentity),
      crossEditionIdentityBefore,
      "A value-less --output modified the official FULL artifact"
    );
  }

  for (const duplicateArguments of [
    ["--edition", "FULL", "--edition", "ATTENDANCE"],
    ["--edition", "FULL", "--output", path.join(temporaryRoot, "duplicate-a"), "--output", path.join(temporaryRoot, "duplicate-b")],
  ]) {
    const duplicateResult = rejectedArguments(duplicateArguments);
    assert.notEqual(duplicateResult.status, 0, "Duplicate release-build arguments must be rejected");
    assert.match(
      `${duplicateResult.stdout ?? ""}\n${duplicateResult.stderr ?? ""}`,
      /Duplicate build argument/u,
      "Duplicate release-build arguments must fail during argument parsing"
    );
  }

  const nestedReleaseOutput = path.join(repositoryRoot, "release", "FULL", "phase-6-1-nested-output");
  assert.equal(existsSync(nestedReleaseOutput), false, "Nested release-output test path unexpectedly exists");
  const nestedReleaseResult = rejectedBuild("FULL", nestedReleaseOutput);
  assert.notEqual(nestedReleaseResult.status, 0, "A build must reject output nested inside an Edition artifact");
  assert.match(
    `${nestedReleaseResult.stdout ?? ""}\n${nestedReleaseResult.stderr ?? ""}`,
    /outside the requested Edition path/u,
    "The nested artifact output must be rejected by path policy before building"
  );
  assert.equal(existsSync(nestedReleaseOutput), false, "Rejected nested artifact output created files");

  const linkedOutputTarget = path.join(temporaryRoot, "junction-target");
  const linkedOutputParent = path.join(temporaryRoot, "junction-parent");
  mkdirSync(linkedOutputTarget);
  symlinkSync(linkedOutputTarget, linkedOutputParent, process.platform === "win32" ? "junction" : "dir");
  const linkedOutput = path.join(linkedOutputParent, "artifact");
  const linkedOutputResult = rejectedBuild("FULL", linkedOutput);
  assert.notEqual(linkedOutputResult.status, 0, "A build must reject a linked output ancestor");
  assert.equal(existsSync(path.join(linkedOutputTarget, "artifact")), false, "Linked output ancestor was followed");
  rmSync(linkedOutputParent, { recursive: true, force: true });

  const nodeInjectionOutput = path.join(temporaryRoot, "node-injection-output");
  const nodeInjectionResult = rejectedBuild("FULL", nodeInjectionOutput, { NODE_OPTIONS: "--trace-warnings" });
  assert.notEqual(nodeInjectionResult.status, 0, "A release build must reject NODE_OPTIONS injection");
  assert.equal(existsSync(nodeInjectionOutput), false, "Rejected NODE_OPTIONS build created output");

  for (const [variableName, variableValue] of [
    ["NODE_V8_COVERAGE", path.join(temporaryRoot, "safe-v8-coverage")],
    ["NODE_COMPILE_CACHE", path.join(temporaryRoot, "safe-compile-cache")],
    ["NODE_COMPILE_CACHE_PORTABLE", "1"],
    ["NODE_ICU_DATA", path.join(temporaryRoot, "safe-icu-data")],
  ]) {
    const controlledNodeOutput = path.join(temporaryRoot, `node-control-${variableName.toLowerCase()}`);
    const controlledNodeResult = rejectedBuild("FULL", controlledNodeOutput, { [variableName]: variableValue });
    assert.notEqual(controlledNodeResult.status, 0, `A release build must reject ${variableName}`);
    assert.match(
      `${controlledNodeResult.stdout ?? ""}\n${controlledNodeResult.stderr ?? ""}`,
      new RegExp(`${variableName} must be unset`, "u"),
      `${variableName} must be rejected by the release launcher`
    );
    assert.equal(existsSync(controlledNodeOutput), false, `Rejected ${variableName} build created output`);
  }

  runBuild("FULL clean build A", "FULL", builds.fullA);
  runBuild("FULL clean build B", "FULL", builds.fullB);
  runBuild("ATTENDANCE clean build A", "ATTENDANCE", builds.attendanceA);
  runBuild("ATTENDANCE clean build B", "ATTENDANCE", builds.attendanceB);

  const fullA = verify(builds.fullA, "FULL");
  const fullB = verify(builds.fullB, "FULL");
  const attendanceA = verify(builds.attendanceA, "ATTENDANCE");
  const attendanceB = verify(builds.attendanceB, "ATTENDANCE");
  assert.deepEqual(manifestBytes(builds.fullA), manifestBytes(builds.fullB), "FULL manifests are not reproducible");
  assert.deepEqual(sidecarBytes(builds.fullA), sidecarBytes(builds.fullB), "FULL manifest hashes differ");
  assert.deepEqual(
    manifestBytes(builds.attendanceA),
    manifestBytes(builds.attendanceB),
    "ATTENDANCE manifests are not reproducible"
  );
  assert.deepEqual(
    sidecarBytes(builds.attendanceA),
    sidecarBytes(builds.attendanceB),
    "ATTENDANCE manifest hashes differ"
  );
  assert.notEqual(fullA.manifestSha256, attendanceA.manifestSha256, "Edition manifests must be distinct");
  assert.equal(fullA.manifestSha256, fullB.manifestSha256);
  assert.equal(attendanceA.manifestSha256, attendanceB.manifestSha256);

  const fullServerProbe = probePackagedServer(builds.fullA, "FULL", "FULL");
  assert.equal(fullServerProbe.status, 0, fullServerProbe.stderr);
  assert.equal(JSON.parse(fullServerProbe.stdout).edition, "FULL");
  const attendanceServerProbe = probePackagedServer(builds.attendanceA, "ATTENDANCE", "ATTENDANCE");
  assert.equal(attendanceServerProbe.status, 0, attendanceServerProbe.stderr);
  assert.equal(JSON.parse(attendanceServerProbe.stdout).edition, "ATTENDANCE");
  assert.notEqual(probePackagedServer(builds.fullA, "FULL", undefined).status, 0, "Missing APP_EDITION must fail");
  assert.notEqual(
    probePackagedServer(builds.fullA, "ATTENDANCE", "ATTENDANCE").status,
    0,
    "Cross-Edition packaged startup must fail"
  );
  assert.notEqual(
    probePackagedServer(builds.fullA, "FULL", "FULL", "24.19.1").status,
    0,
    "Packaged startup under an unpinned Node version must fail"
  );
  const fullBuildIdentityPath = path.join(builds.fullA, artifactContract.BUILD_IDENTITY_FILE);
  const originalFullBuildIdentity = readFileSync(fullBuildIdentityPath);
  writeFileSync(fullBuildIdentityPath, Buffer.alloc(versionContract.MAX_IDENTITY_BYTES + 1, 0x20));
  const oversizedBuildIdentityProbe = probePackagedServer(builds.fullA, "FULL", "FULL");
  assert.notEqual(oversizedBuildIdentityProbe.status, 0, "Oversized packaged build identity must fail startup");
  assert.match(oversizedBuildIdentityProbe.stderr, /exceeds 16384 bytes/u);
  writeFileSync(fullBuildIdentityPath, originalFullBuildIdentity);

  const routeBoundary = spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, "client", "scripts", "test-route-build-boundary.mjs"),
      "--full-dir",
      path.join(builds.fullA, "client"),
      "--attendance-dir",
      path.join(builds.attendanceA, "client"),
    ],
    {
      cwd: repositoryRoot,
      env: process.env,
      encoding: "utf8",
      shell: false,
      timeout: 60_000,
      windowsHide: true,
    }
  );
  assert.equal(routeBoundary.status, 0, routeBoundary.stderr || routeBoundary.stdout);
  process.stdout.write(routeBoundary.stdout);

  assert.throws(() => verify(builds.fullA, "ATTENDANCE"), /edition|Edition/u);
  assert.throws(() => verify(builds.attendanceA, "FULL"), /edition|Edition/u);

  const extraPath = path.join(builds.fullA, "unlisted-stale-file.txt");
  writeFileSync(extraPath, "stale", { encoding: "utf8", flag: "wx" });
  assert.throws(() => verify(builds.fullA, "FULL"), /contains|closure|manifest/u);
  unlinkSync(extraPath);
  verify(builds.fullA, "FULL");

  const linkTarget = path.join(temporaryRoot, "link-target");
  const artifactLink = path.join(builds.fullA, "linked-directory");
  mkdirSync(linkTarget);
  symlinkSync(linkTarget, artifactLink, process.platform === "win32" ? "junction" : "dir");
  assert.throws(
    () => verify(builds.fullA, "FULL"),
    (error) => error?.code === "ARTIFACT_LINK_FORBIDDEN"
  );
  rmSync(artifactLink, { recursive: true, force: true });
  verify(builds.fullA, "FULL");

  const serverEntry = path.join(builds.fullA, "server", "dist", "index.js");
  const originalServerEntry = readFileSync(serverEntry);
  appendFileSync(serverEntry, "\n// tampered\n", "utf8");
  assert.throws(() => verify(builds.fullA, "FULL"), /hash|closure/u);
  writeFileSync(serverEntry, originalServerEntry);
  verify(builds.fullA, "FULL");

  const hashPath = path.join(builds.fullA, artifactContract.MANIFEST_HASH_FILE);
  const originalHash = readFileSync(hashPath);
  writeFileSync(hashPath, `${"0".repeat(64)}  ${artifactContract.MANIFEST_FILE}\n`, "utf8");
  assert.throws(
    () => verify(builds.fullA, "FULL"),
    (error) => error?.code === "MANIFEST_HASH_MISMATCH"
  );
  writeFileSync(hashPath, originalHash);

  let restoreManifest = rewriteManifest(builds.fullA, (manifest) => {
    manifest.edition = "ATTENDANCE";
  });
  assert.throws(() => verify(builds.fullA, "FULL"), /edition/u);
  restoreManifest();

  restoreManifest = rewriteManifest(builds.fullA, (manifest) => {
    manifest.files[0].path = "../escape";
  });
  assert.throws(() => verify(builds.fullA, "FULL"), /path/u);
  restoreManifest();

  restoreManifest = rewriteManifest(builds.fullA, (manifest) => {
    manifest.files.splice(1, 0, { ...manifest.files[0], path: manifest.files[0].path.toUpperCase() });
  });
  assert.throws(
    () => verify(builds.fullA, "FULL"),
    (error) => error?.code === "WINDOWS_PATH_COLLISION"
  );
  restoreManifest();

  writeFileSync(
    fullBuildIdentityPath,
    readFileSync(path.join(builds.attendanceA, artifactContract.BUILD_IDENTITY_FILE))
  );
  assert.throws(() => verify(builds.fullA, "FULL"), /edition|Edition/u);
  writeFileSync(fullBuildIdentityPath, originalFullBuildIdentity);
  verify(builds.fullA, "FULL");

  process.stdout.write(
    `\n[artifact-repro] PASS FULL=${fullA.manifestSha256} ATTENDANCE=${attendanceA.manifestSha256}\n`
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
