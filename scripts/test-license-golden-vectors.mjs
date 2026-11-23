import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { TEST_ONLY_KEYS } from "../licensing/vectors/v1/test-only/keys.mjs";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const vectorRoot = path.join(repositoryRoot, "licensing", "vectors", "v1");
const protocolRoot = path.join(repositoryRoot, "licensing", "protocol", "v1");
const dotnetRoot = path.join(vectorRoot, "dotnet");
const generatorPath = path.join(vectorRoot, "generate-vectors.mjs");
const nodeVerifierPath = path.join(vectorRoot, "verify-vectors.mjs");
const vectorManifestName = "vector-manifest.json";
const vectorManifestSidecarName = "vector-manifest.sha256";
const expectedProtocolManifestSha256 = "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";
const expectedVectorManifestSha256 = "565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e";
const expectedNodeVersion = "24.19.0";
const expectedDotnetSdkVersion = "10.0.400";
const maximumTextBytes = 16 * 1024 * 1024;
const maximumScannedFileBytes = 64 * 1024 * 1024;
const p256Order = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const prepareManifest = process.argv.slice(2).includes("--prepare-manifest");
const expectedSignedPositiveIds = Object.freeze([
  "pos-activation-activate-full",
  "pos-activation-activate-tpm",
  "pos-activation-control",
  "pos-activation-reactivate",
  "pos-activation-rebind",
  "pos-activation-recover",
  "pos-activation-renew",
  "pos-activation-time-correct",
  "pos-control-request-unsuspend",
  "pos-control-vendor-revoke",
  "pos-control-vendor-suspend",
  "pos-delegation-offline-control",
  "pos-delegation-offline-entitlement",
  "pos-delegation-online-lease",
  "pos-delegation-recovery",
  "pos-denylist-revision-1",
  "pos-denylist-revision-2",
  "pos-entitlement-initial-full",
  "pos-entitlement-initial-hybrid",
  "pos-entitlement-initial-offline",
  "pos-entitlement-reactivated",
  "pos-entitlement-renewal",
  "pos-lease-full",
  "pos-lease-initial-control",
  "pos-lease-positive-control",
  "pos-lease-rebind-reference",
  "pos-lease-request-check-in",
  "pos-lease-request-check-in-full",
  "pos-lease-request-check-in-rebind",
  "pos-lease-request-time-recovery",
  "pos-reactivation-authorization",
  "pos-recovery-clear-tamper",
  "pos-recovery-rebind-device",
  "pos-recovery-repair-state",
  "pos-time-correction",
].sort());
const expectedCarrierPositiveIds = Object.freeze([
  "pos-carrier-lease-challenge",
  "pos-carrier-lease-response-complete",
  "pos-carrier-lease-response-control-only",
  "pos-carrier-lease-response-reactivation-only",
  "pos-carrier-lease-response-time-recovery",
  "pos-carrier-trust-bundle",
].sort());
const expectedFullScenarioIds = Object.freeze([
  "pos-activation-activate-full",
  "pos-entitlement-initial-full",
  "pos-lease-full",
  "pos-lease-request-check-in-full",
].sort());
const expectedTestOnlyKeySpecifications = Object.freeze([
  ["TEST_ONLY_INSTALLATION_DEVICE_PRIMARY", "INSTALLATION_DEVICE", "TEST", "TRUSTED"],
  ["TEST_ONLY_INSTALLATION_DEVICE_REBIND", "INSTALLATION_DEVICE", "TEST", "TRUSTED"],
  ["TEST_ONLY_INSTALLATION_DEVICE_WRONG_ENV", "INSTALLATION_DEVICE", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_OFFLINE_CONTROL_DENIED", "OFFLINE_CONTROL", "TEST", "DENIED"],
  ["TEST_ONLY_OFFLINE_CONTROL_PRIMARY", "OFFLINE_CONTROL", "TEST", "TRUSTED"],
  ["TEST_ONLY_OFFLINE_CONTROL_WRONG_ENV", "OFFLINE_CONTROL", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED", "OFFLINE_ENTITLEMENT", "TEST", "DENIED"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY", "OFFLINE_ENTITLEMENT", "TEST", "TRUSTED"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_WRONG_ENV", "OFFLINE_ENTITLEMENT", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_ONLINE_LEASE_DENIED", "ONLINE_LEASE", "TEST", "DENIED"],
  ["TEST_ONLY_ONLINE_LEASE_PRIMARY", "ONLINE_LEASE", "TEST", "TRUSTED"],
  ["TEST_ONLY_ONLINE_LEASE_WRONG_ENV", "ONLINE_LEASE", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_PROD_ROOT_PRIMARY", "PROD_ROOT", "TEST", "TRUSTED"],
  ["TEST_ONLY_PROD_ROOT_WRONG_ENV", "PROD_ROOT", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_RECOVERY_DENIED", "RECOVERY", "TEST", "DENIED"],
  ["TEST_ONLY_RECOVERY_PRIMARY", "RECOVERY", "TEST", "TRUSTED"],
  ["TEST_ONLY_RECOVERY_WRONG_ENV", "RECOVERY", "DEVELOPMENT", "WRONG_ENVIRONMENT"],
  ["TEST_ONLY_UNKNOWN_SIGNER", "UNKNOWN", "TEST", "UNKNOWN"],
]);
const requiredCriticalNegativeIds = Object.freeze([
  "neg-activation-object-too-large",
  "neg-cose-array-extra",
  "neg-denied-signer",
  "neg-detached-payload",
  "neg-duplicate-payload-key",
  "neg-high-s",
  "neg-indefinite-payload-map",
  "neg-kid-31-bytes",
  "neg-kid-text",
  "neg-malformed-utf8",
  "neg-missing-alg",
  "neg-missing-content-type",
  "neg-missing-kid",
  "neg-missing-tag",
  "neg-non-minimal-integer",
  "neg-non-minimal-length",
  "neg-out-of-order-payload-map",
  "neg-payload-bit-flip",
  "neg-payload-kid-mismatch",
  "neg-payload-not-bstr",
  "neg-protected-extra",
  "neg-protected-not-bstr",
  "neg-protocol-version-zero",
  "neg-r-out-of-range",
  "neg-r-zero",
  "neg-s-out-of-range",
  "neg-s-zero",
  "neg-signature-63-bytes",
  "neg-signature-bit-flip",
  "neg-signature-before-denied",
  "neg-signature-before-wrong-environment",
  "neg-signature-before-wrong-purpose",
  "neg-signature-text",
  "neg-token-type-mismatch",
  "neg-trailing-data",
  "neg-unknown-signer",
  "neg-unprotected-nonempty",
  "neg-wrong-alg",
  "neg-wrong-content-type",
  "neg-wrong-environment",
  "neg-wrong-purpose-signer",
  "neg-wrong-tag",
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  assert(
    actualKeys.length === expectedKeys.length
      && actualKeys.every((key, index) => key === expectedKeys[index]),
    `${label} fields differ; expected ${expectedKeys.join(", ")}; received ${actualKeys.join(", ")}.`
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactStringSet(actual, expected, label) {
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  assert(
    actualValues.length === expectedValues.length
      && actualValues.every((value, index) => value === expectedValues[index]),
    `${label} differs; expected ${expectedValues.join(", ")}; received ${actualValues.join(", ")}.`
  );
}

function jsonDeepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => jsonDeepEqual(value, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && jsonDeepEqual(left[key], right[key]));
  }
  return false;
}

function canonicalRelativePath(value, label) {
  assert(
    typeof value === "string"
      && value.length > 0
      && value.length <= 512
      && value === value.normalize("NFC")
      && !value.includes("\\")
      && !value.includes(":")
      && !value.startsWith("/"),
    `${label} is not a canonical relative path.`
  );
  assert(
    value.split("/").every((segment) => (
      segment.length > 0
      && segment.length <= 255
      && segment !== "."
      && segment !== ".."
      && !/[\u0000-\u001f\u007f]/u.test(segment)
      && !/[. ]$/u.test(segment)
      && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment)
    )),
    `${label} contains a forbidden path segment.`
  );
  return value;
}

function readStrictJson(filePath, label, maximumBytes = maximumTextBytes) {
  const bytes = versionContract.readFileBounded(filePath, label, maximumBytes);
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${label} has a UTF-8 BOM.`);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  assert(!text.includes("\r"), `${label} must use LF line endings.`);
  assert(text.endsWith("\n") && !text.endsWith("\n\n"), `${label} must end with exactly one LF.`);
  assert(!/[ \t]+$/mu.test(text), `${label} contains trailing whitespace.`);
  return {
    bytes,
    text,
    value: versionContract.parseStrictJson(bytes, label, maximumBytes),
  };
}

function listFiles(root, options = {}) {
  const { rejectBuildOutputs = false } = options;
  assert(existsSync(root), `Required directory is missing: ${root}.`);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const stats = lstatSync(absolutePath);
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      canonicalRelativePath(relativePath, `package path ${JSON.stringify(relativePath)}`);
      assert(!stats.isSymbolicLink(), `Links are forbidden in the vector package: ${relativePath}.`);
      if (stats.isDirectory()) {
        if (rejectBuildOutputs && (entry.name === "bin" || entry.name === "obj")) {
          fail(`Generated .NET directory is forbidden in the vector package: ${relativePath}.`);
        }
        visit(absolutePath);
      } else if (stats.isFile()) {
        files.push({ absolutePath, relativePath, size: stats.size });
      } else {
        fail(`Unsupported filesystem entry in vector package: ${relativePath}.`);
      }
    }
  };
  visit(root);
  files.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  const caseFoldedPaths = new Set();
  for (const file of files) {
    const folded = file.relativePath.toLocaleLowerCase("en-US");
    assert(!caseFoldedPaths.has(folded), `Windows case-insensitive path collision: ${file.relativePath}.`);
    caseFoldedPaths.add(folded);
  }
  return files;
}

function runCommand(label, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 240_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  assert(result.status === 0, `${label} exited with status ${result.status ?? "unknown"}.`);
  return (result.stdout ?? "").trim();
}

function runCommandExpectFailure(label, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
  });
  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  assert(result.status !== 0, `${label} unexpectedly succeeded.`);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (options.expectedPattern) {
    assert(options.expectedPattern.test(output), `${label} failed for the wrong reason: ${output.trim()}`);
  }
  return output;
}

function narrowBaseEnvironment(overrides = {}) {
  const environment = {};
  for (const key of [
    "APPDATA",
    "ComSpec",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "OS",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "ProgramData",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ]) {
    if (process.env[key]) environment[key] = process.env[key];
  }
  return { ...environment, ...overrides };
}

function cleanNodeChildEnvironment(temporaryRoot) {
  return narrowBaseEnvironment({
    PATH: [path.dirname(process.execPath), path.join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(path.delimiter),
    TEMP: temporaryRoot,
    TMP: temporaryRoot,
  });
}

function resolveFirstExecutable(commandName) {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${commandName}${extension}`);
      if (existsSync(candidate)) {
        const stats = lstatSync(candidate);
        if (stats.isFile() && !stats.isSymbolicLink()) return path.resolve(candidate);
      }
    }
  }
  fail(`Required executable is unavailable on PATH: ${commandName}.`);
}

function assertNoDotnetInjectionEnvironment() {
  const forbiddenExact = new Set([
    "COREHOST_TRACE",
    "COREHOST_TRACEFILE",
    "DOTNET_ADDITIONAL_DEPS",
    "DOTNET_BUNDLE_EXTRACT_BASE_DIR",
    "DOTNET_CLI_HOME",
    "DOTNET_HOST_PATH",
    "DOTNET_ROLL_FORWARD",
    "DOTNET_ROLL_FORWARD_TO_PRERELEASE",
    "DOTNET_SHARED_STORE",
    "DOTNET_STARTUP_HOOKS",
    "MSBuildSDKsPath",
    "NUGET_HTTP_CACHE_PATH",
    "NUGET_PACKAGES",
    "NUGET_PLUGINS_CACHE_PATH",
    "NUGET_PLUGIN_PATHS",
  ].map((value) => value.toLocaleUpperCase("en-US")));
  const ignoredAndReplacedDotnetRoots = new Set(["DOTNET_ROOT", "DOTNET_ROOT_X64", "DOTNET_ROOT_X86"]);
  const forbidden = Object.keys(process.env).filter((name) => {
    const upper = name.toLocaleUpperCase("en-US");
    return forbiddenExact.has(upper)
      || upper.startsWith("MSBUILD")
      || upper.startsWith("NUGET_")
      || (upper.startsWith("DOTNET_") && !ignoredAndReplacedDotnetRoots.has(upper));
  });
  assert(forbidden.length === 0, `Refusing inherited .NET/MSBuild/NuGet injection controls: ${forbidden.sort().join(", ")}.`);
}

function createDotnetEnvironment(dotnetExecutable, temporaryRoot) {
  const dotnetCliHome = path.join(temporaryRoot, "dotnet-cli-home");
  const nugetPackages = path.join(temporaryRoot, "nuget-packages");
  const nugetHttpCache = path.join(temporaryRoot, "nuget-http-cache");
  const nugetPluginsCache = path.join(temporaryRoot, "nuget-plugins-cache");
  const processTemp = path.join(temporaryRoot, "dotnet-temp");
  for (const directory of [dotnetCliHome, nugetPackages, nugetHttpCache, nugetPluginsCache, processTemp]) {
    mkdirSync(directory, { recursive: true });
  }
  return narrowBaseEnvironment({
    PATH: [path.dirname(dotnetExecutable), path.join(process.env.SystemRoot ?? "C:\\Windows", "System32")].join(path.delimiter),
    TEMP: processTemp,
    TMP: processTemp,
    DOTNET_CLI_HOME: dotnetCliHome,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_CLI_DO_NOT_USE_MSBUILD_SERVER: "1",
    DOTNET_MULTILEVEL_LOOKUP: "0",
    DOTNET_NOLOGO: "1",
    DOTNET_ROOT: path.dirname(dotnetExecutable),
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    MSBUILDUSESERVER: "0",
    NUGET_HTTP_CACHE_PATH: nugetHttpCache,
    NUGET_PACKAGES: nugetPackages,
    NUGET_PLUGINS_CACHE_PATH: nugetPluginsCache,
  });
}

function validateIndependentNodeModuleGraph() {
  const verifierModulesRoot = path.join(vectorRoot, "node-verifier");
  const allowedFiles = [
    nodeVerifierPath,
    path.join(verifierModulesRoot, "cose-verifier.mjs"),
    path.join(verifierModulesRoot, "errors.mjs"),
    path.join(verifierModulesRoot, "strict-cbor.mjs"),
    path.join(verifierModulesRoot, "strict-json.mjs"),
  ].map((value) => path.resolve(value));
  const allowedFileSet = new Set(allowedFiles.map((value) => value.toLocaleLowerCase("en-US")));
  const allowedBuiltins = new Set(["node:crypto", "node:fs", "node:path", "node:url"]);
  const visited = new Set();
  const pending = [path.resolve(nodeVerifierPath)];

  while (pending.length > 0) {
    const modulePath = pending.pop();
    const foldedModulePath = modulePath.toLocaleLowerCase("en-US");
    if (visited.has(foldedModulePath)) continue;
    assert(allowedFileSet.has(foldedModulePath), `Node verifier module is outside the explicit allowlist: ${modulePath}.`);
    const stats = lstatSync(modulePath);
    assert(stats.isFile() && !stats.isSymbolicLink(), `Node verifier module must be a regular non-link file: ${modulePath}.`);
    const sourceBytes = versionContract.readFileBounded(modulePath, `Node verifier module ${modulePath}`, 1024 * 1024);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
    assert(!/\brequire\s*\(/u.test(source) && !/\bcreateRequire\b/u.test(source), `Node verifier module may not use CommonJS loading: ${modulePath}.`);
    assert(!/\bimport\s*\(\s*(?!["'])/u.test(source), `Node verifier module contains a non-literal dynamic import: ${modulePath}.`);
    const specifiers = [];
    for (const expression of [
      /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/gu,
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    ]) {
      for (const match of source.matchAll(expression)) specifiers.push(match[1]);
    }
    for (const specifier of specifiers) {
      assert(!/(?:test-only|rfc6979|build-vectors|(?:^|\/)lib\/(?:cose|ecdsa))/iu.test(specifier), `Node verifier imports issuer/private/signing code: ${specifier}.`);
      if (specifier.startsWith("node:")) {
        assert(allowedBuiltins.has(specifier), `Node verifier builtin import is outside the allowlist: ${specifier}.`);
        continue;
      }
      assert(specifier.startsWith("./") || specifier.startsWith("../"), `Node verifier may not import packages or bare modules: ${specifier}.`);
      const resolved = path.resolve(path.dirname(modulePath), specifier);
      assert(path.extname(resolved) === ".mjs", `Node verifier local import must name an explicit .mjs file: ${specifier}.`);
      assert(allowedFileSet.has(resolved.toLocaleLowerCase("en-US")), `Node verifier local import escapes its exact consumer graph: ${specifier}.`);
      pending.push(resolved);
    }
    visited.add(foldedModulePath);
  }
  exactStringSet(visited, allowedFileSet, "Reachable independent Node verifier module graph");
  return visited.size;
}

function validateTestKeySourceContract() {
  const actual = Object.values(TEST_ONLY_KEYS).sort((left, right) => left.id.localeCompare(right.id, "en"));
  assert(actual.length === 18, `Expected exactly 18 test-only key specifications; received ${actual.length}.`);
  const expected = [...expectedTestOnlyKeySpecifications].sort((left, right) => left[0].localeCompare(right[0], "en"));
  for (let index = 0; index < expected.length; index += 1) {
    const key = actual[index];
    const [id, purpose, environment, trustClass] = expected[index];
    assert(
      key.id === id && key.purpose === purpose && key.environment === environment && key.trustClass === trustClass,
      `Test-only key specification drifted at ${id}.`
    );
    assert(
      typeof key.privateScalar === "bigint" && key.privateScalar > 0n && key.privateScalar < p256Order,
      `Test-only private scalar is outside the exact P-256 group order: ${key.id}.`
    );
    assert(Buffer.isBuffer(key.spkiDer) && key.spkiDer.length === 91, `Test-only SPKI must be exact 91-byte P-256 DER: ${key.id}.`);
    assert(Buffer.isBuffer(key.kid) && key.kid.length === 32 && sha256(key.spkiDer) === key.kid.toString("hex"), `Test-only SPKI/kid binding drifted: ${key.id}.`);
  }
}

function validateDotnetProjectProvenance() {
  assertNoDotnetInjectionEnvironment();
  const expectedFiles = [
    "CarrierVerifier.cs",
    "CoseVerifier.cs",
    "CoverageValidator.cs",
    "EntryControl.GoldenVectors.csproj",
    "global.json",
    "JsonContract.cs",
    "Program.cs",
    "README.md",
    "StrictCbor.cs",
  ].sort();
  exactStringSet(listFiles(dotnetRoot, { rejectBuildOutputs: true }).map((file) => file.relativePath), expectedFiles, ".NET verifier source inventory");

  const globalJson = readStrictJson(path.join(dotnetRoot, "global.json"), ".NET global.json", 16 * 1024).value;
  exactKeys(globalJson, ["sdk"], ".NET global.json");
  exactKeys(globalJson.sdk, ["allowPrerelease", "rollForward", "version"], ".NET global.json sdk");
  assert(
    globalJson.sdk.version === expectedDotnetSdkVersion
      && globalJson.sdk.rollForward === "disable"
      && globalJson.sdk.allowPrerelease === false,
    ".NET SDK pin must be exact, stable, and disable roll-forward."
  );

  const projectFiles = listFiles(dotnetRoot).filter((file) => /\.(?:csproj|props|targets)$/iu.test(file.relativePath));
  assert(projectFiles.length === 1 && projectFiles[0].relativePath === "EntryControl.GoldenVectors.csproj", ".NET verifier may contain only its one pinned SDK project file.");
  const projectText = readFileSync(projectFiles[0].absolutePath, "utf8");
  assert(!/<\s*PackageReference\b/iu.test(projectText), ".NET verifier must have zero PackageReference dependencies.");
  assert(/<Project\s+Sdk="Microsoft\.NET\.Sdk">/u.test(projectText), ".NET verifier must use the exact Microsoft.NET.Sdk.");
  assert(/<TargetFramework>net10\.0<\/TargetFramework>/u.test(projectText), ".NET verifier must target exact net10.0.");

  const forbiddenAncestorNames = new Set([
    "directory.build.props",
    "directory.build.rsp",
    "directory.build.targets",
    "directory.packages.props",
    "msbuild.rsp",
    "nuget.config",
  ]);
  let current = path.resolve(dotnetRoot);
  for (;;) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      assert(!forbiddenAncestorNames.has(entry.name.toLocaleLowerCase("en-US")), `Forbidden inherited .NET build configuration: ${path.join(current, entry.name)}.`);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function validateGitTrackability(files) {
  const result = spawnSync("git", [
    "-c",
    "core.quotepath=false",
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "licensing/vectors/v1",
    "licensing/protocol/v1/corpus/malformed-cases.json",
    "licensing/protocol/v1/corpus/cross-type-cases.json",
  ], { cwd: repositoryRoot, encoding: null, windowsHide: true });
  if (result.error) fail(`Git trackability check could not start: ${result.error.message}`);
  assert(result.status === 0, `Git trackability check failed with status ${result.status ?? "unknown"}.`);
  const eligible = new Set(result.stdout.toString("utf8").split("\0").filter(Boolean));
  const required = files.map((file) => path.relative(repositoryRoot, file.absolutePath).replaceAll("\\", "/"));
  required.push(
    "licensing/protocol/v1/corpus/malformed-cases.json",
    "licensing/protocol/v1/corpus/cross-type-cases.json"
  );
  for (const relativePath of required) {
    assert(eligible.has(relativePath), `Golden Vector closure/coverage source is ignored or not Git-trackable: ${relativePath}.`);
  }
  return required.length;
}

function validateRuntimeAndProtocolPin() {
  const argumentsReceived = process.argv.slice(2);
  assert(
    argumentsReceived.length === (prepareManifest ? 1 : 0)
      && argumentsReceived.every((argument) => argument === "--prepare-manifest"),
    "Usage: node scripts/test-license-golden-vectors.mjs [--prepare-manifest]"
  );
  const canonicalVersion = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
  versionContract.assertNodeVersion(canonicalVersion.identity);
  assert(process.versions.node === expectedNodeVersion, `Golden-vector gate requires Node ${expectedNodeVersion}; received ${process.versions.node}.`);
  assert(canonicalVersion.identity.licenseProtocolVersion === 1, "Golden-vector gate is scoped only to protocol v1.");
  listFiles(vectorRoot, { rejectBuildOutputs: true });
  validateTestKeySourceContract();
  validateIndependentNodeModuleGraph();
  validateDotnetProjectProvenance();

  const protocolManifestBytes = readFileSync(path.join(protocolRoot, "protocol-manifest.json"));
  assert(
    sha256(protocolManifestBytes) === expectedProtocolManifestSha256,
    "Frozen protocol manifest drifted from the repository-external LIC-6.2-001 pin."
  );
  assert(
    readFileSync(path.join(protocolRoot, "protocol-manifest.sha256"), "utf8") === `${expectedProtocolManifestSha256}\n`,
    "Frozen protocol manifest sidecar drifted from the LIC-6.2-001 pin."
  );

  const rootPackage = readStrictJson(path.join(repositoryRoot, "package.json"), "package.json", 1024 * 1024).value;
  assert(
    rootPackage.scripts?.["test:license-golden-vectors"] === "node scripts/test-license-golden-vectors.mjs",
    "Root golden-vector test script is not registered exactly."
  );
  const attributes = readFileSync(path.join(repositoryRoot, ".gitattributes"), "utf8").split(/\r?\n/u);
  for (const requiredRule of [
    "/licensing/vectors/v1/** text eol=lf",
    "/licensing/vectors/v1/**/*.cbor binary",
    "/licensing/vectors/v1/**/*.der binary",
    "/licensing/vectors/v1/**/*.pk8 binary",
  ]) {
    assert(attributes.includes(requiredRule), `.gitattributes is missing exact Golden Vector rule: ${requiredRule}.`);
  }
}

function isRegeneratedPath(relativePath) {
  return relativePath === "vectors-index.json"
    || relativePath.startsWith("coverage/")
    || relativePath.startsWith("fixtures/")
    || relativePath.startsWith("keys/")
    || relativePath === "reports/vendor-verdict.json";
}

function compareRegeneratedPackage(regeneratedRoot) {
  const regeneratedFiles = listFiles(regeneratedRoot);
  assert(regeneratedFiles.length > 0, "Vendor issuer produced an empty Golden Vector package.");
  for (const file of regeneratedFiles) {
    assert(isRegeneratedPath(file.relativePath), `Vendor issuer produced an unexpected path: ${file.relativePath}.`);
  }
  const committedGeneratedFiles = listFiles(vectorRoot, { rejectBuildOutputs: true }).filter((file) => isRegeneratedPath(file.relativePath));
  assert(
    regeneratedFiles.length === committedGeneratedFiles.length,
    `Regenerated file count ${regeneratedFiles.length} differs from committed generated file count ${committedGeneratedFiles.length}.`
  );
  for (let index = 0; index < committedGeneratedFiles.length; index += 1) {
    const committed = committedGeneratedFiles[index];
    const regenerated = regeneratedFiles[index];
    assert(committed.relativePath === regenerated.relativePath, `Regenerated inventory mismatch at ${committed.relativePath}/${regenerated.relativePath}.`);
    const committedBytes = readFileSync(committed.absolutePath);
    const regeneratedBytes = readFileSync(regenerated.absolutePath);
    assert(
      committedBytes.equals(regeneratedBytes),
      `Vendor regeneration is not byte-identical for ${committed.relativePath}.`
    );
  }
  return regeneratedFiles.length;
}

function mirrorFrozenProtocolCorpora(vectorsRoot) {
  const corpusRoot = path.resolve(vectorsRoot, "..", "..", "protocol", "v1", "corpus");
  assert(!existsSync(corpusRoot), `Protocol corpus mirror already exists: ${corpusRoot}.`);
  mkdirSync(corpusRoot, { recursive: true });
  for (const fileName of ["malformed-cases.json", "cross-type-cases.json"]) {
    writeFileSync(
      path.join(corpusRoot, fileName),
      readFileSync(path.join(protocolRoot, "corpus", fileName)),
      { flag: "wx" }
    );
  }
}

function cloneProbePackage(sourceRoot, probesRoot, name) {
  const target = path.join(probesRoot, name, "licensing", "vectors", "v1");
  assert(!existsSync(target), `Probe package path already exists: ${target}.`);
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(sourceRoot, target, { recursive: true, errorOnExist: true, force: false, dereference: false });
  mirrorFrozenProtocolCorpora(target);
  return target;
}

function rewriteProbeIndex(packageRoot, mutate) {
  const indexPath = path.join(packageRoot, "vectors-index.json");
  const index = readStrictJson(indexPath, "probe vectors-index.json").value;
  mutate(index);
  writeFileSync(indexPath, Buffer.from(`${JSON.stringify(index, null, 2)}\n`, "utf8"), { flag: "w" });
  return index;
}

function assertGeneratorAttackGuards(probesRoot, nodeEnvironment) {
  const source = readFileSync(generatorPath, "utf8");
  assert(/writeFileSync\([^;]+\{\s*flag:\s*["']wx["']\s*\}\s*\)/su.test(source), "Generator artifact writes must use exclusive wx creation.");
  assert(!/writeFileSync\([^;]+\{\s*flag:\s*["']w["']\s*\}/su.test(source), "Generator may not contain overwrite-mode artifact writes.");

  runCommandExpectFailure("Generator repository-output attack", process.execPath, [generatorPath, "--output", repositoryRoot], {
    env: nodeEnvironment,
    expectedPattern: /outside|repository|package tree/iu,
  });

  const nonempty = path.join(probesRoot, "generator-nonempty");
  mkdirSync(nonempty);
  const sentinelPath = path.join(nonempty, "sentinel.txt");
  const sentinel = Buffer.from("DO_NOT_OVERWRITE\n", "ascii");
  writeFileSync(sentinelPath, sentinel, { flag: "wx" });
  runCommandExpectFailure("Generator non-empty/no-overwrite attack", process.execPath, [generatorPath, "--output", nonempty], {
    env: nodeEnvironment,
    expectedPattern: /fresh|empty/iu,
  });
  assert(readFileSync(sentinelPath).equals(sentinel) && readdirSync(nonempty).length === 1, "Generator altered a non-empty output after rejecting it.");

  const fileOutput = path.join(probesRoot, "generator-file-output");
  writeFileSync(fileOutput, sentinel, { flag: "wx" });
  runCommandExpectFailure("Generator regular-file output attack", process.execPath, [generatorPath, "--output", fileOutput], {
    env: nodeEnvironment,
    expectedPattern: /regular directory|directory/iu,
  });
  assert(readFileSync(fileOutput).equals(sentinel), "Generator altered a regular-file output target.");

  const junctionTarget = path.join(probesRoot, "generator-junction-target");
  const junctionPath = path.join(probesRoot, "generator-junction");
  mkdirSync(junctionTarget);
  symlinkSync(junctionTarget, junctionPath, "junction");
  try {
    runCommandExpectFailure("Generator junction output attack", process.execPath, [generatorPath, "--output", junctionPath], {
      env: nodeEnvironment,
      expectedPattern: /link|reparse/iu,
    });
    assert(readdirSync(junctionTarget).length === 0, "Generator wrote through a rejected junction output.");
  } finally {
    if (existsSync(junctionPath)) unlinkSync(junctionPath);
  }
}

function dotnetVerifierDll(dotnetArtifactsRoot) {
  const candidates = listFiles(dotnetArtifactsRoot)
    .filter((file) => path.basename(file.absolutePath).toLocaleLowerCase("en-US") === "entrycontrol.goldenvectors.dll")
    .filter((file) => existsSync(path.join(path.dirname(file.absolutePath), "EntryControl.GoldenVectors.runtimeconfig.json")));
  assert(candidates.length === 1, `Expected one runnable .NET verifier DLL; received ${candidates.map((file) => file.relativePath).join(", ")}.`);
  return candidates[0].absolutePath;
}

function assertVerifierRejectsPackage(label, packageRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, expectedPattern) {
  const nodeReport = path.join(probesRoot, `${label}-node-report.json`);
  const dotnetReport = path.join(probesRoot, `${label}-dotnet-report.json`);
  runCommandExpectFailure(`${label} (Node)`, process.execPath, [nodeVerifierPath, "--vectors", packageRoot, "--report", nodeReport], {
    env: nodeEnvironment,
    expectedPattern,
  });
  assert(!existsSync(nodeReport), `${label} Node verifier wrote a report for a rejected package.`);
  runCommandExpectFailure(`${label} (.NET)`, dotnetExecutable, [verifierDll, "--vectors", packageRoot, "--report", dotnetReport], {
    cwd: dotnetRoot,
    env: dotnetEnvironment,
    expectedPattern,
  });
  assert(!existsSync(dotnetReport), `${label} .NET verifier wrote a report for a rejected package.`);
}

function windowsNamespaceAliases(absolutePath) {
  assert(process.platform === "win32", "Windows namespace aliases are Windows-only test inputs.");
  const parsed = path.win32.parse(absolutePath);
  const match = /^([a-z]):\\$/iu.exec(parsed.root);
  assert(match, `Windows namespace probe requires a local drive path: ${absolutePath}.`);
  const tail = absolutePath.slice(parsed.root.length);
  return [
    ["extended", `\\\\?\\${absolutePath}`],
    ["UNC-admin-share", `\\\\localhost\\${match[1]}$\\${tail}`],
  ];
}

function assertVerifierPathAttackGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment) {
  if (process.platform === "win32") {
    for (const [aliasKind, aliasRoot] of windowsNamespaceAliases(regeneratedRoot)) {
      assertVerifierRejectsPackage(`${aliasKind}-vector-root attack`, aliasRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /VECTORS|PATH|canonical|drive|namespace|UNC/iu);
    }
  }

  const traversal = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-traversal");
  const traversalIndex = readStrictJson(path.join(traversal, "vectors-index.json"), "traversal index").value;
  const traversalEntry = traversalIndex.positive.find((entry) => entry.kind === "SIGNED_OBJECT");
  const traversalSource = path.join(traversal, ...traversalEntry.path.split("/"));
  const traversalOutside = path.join(path.dirname(traversal), "verifier-traversal-outside.cbor");
  writeFileSync(traversalOutside, readFileSync(traversalSource), { flag: "wx" });
  rewriteProbeIndex(traversal, (index) => {
    index.positive.find((entry) => entry.id === traversalEntry.id).path = "../verifier-traversal-outside.cbor";
  });
  assertVerifierRejectsPackage("path-traversal attack", traversal, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /PATH|relative|canonical/iu);

  const backslash = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-backslash");
  rewriteProbeIndex(backslash, (index) => {
    const entry = index.positive.find((candidate) => candidate.kind === "SIGNED_OBJECT");
    entry.path = entry.path.replaceAll("/", "\\");
  });
  assertVerifierRejectsPackage("backslash-path attack", backslash, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /PATH|relative|canonical/iu);

  const ads = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-ads");
  rewriteProbeIndex(ads, (index) => {
    const entry = index.positive.find((candidate) => candidate.kind === "SIGNED_OBJECT");
    const ordinaryPath = path.join(ads, ...entry.path.split("/"));
    const adsPath = `${ordinaryPath}:ecs-license-probe`;
    writeFileSync(adsPath, readFileSync(ordinaryPath), { flag: "wx" });
    entry.path = `${entry.path}:ecs-license-probe`;
  });
  assertVerifierRejectsPackage("colon-ADS path attack", ads, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /PATH|relative|canonical|colon|ADS/iu);

  const caseCollision = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-case-collision");
  rewriteProbeIndex(caseCollision, (index) => {
    const matching = index.positive.filter((entry) => entry.kind === "SIGNED_OBJECT" && entry.tokenType === "activation-request");
    assert(matching.length >= 2, "Case-collision probe requires two same-type signed positives.");
    const first = matching[0];
    const secondIndex = index.positive.findIndex((entry) => entry.id === matching[1].id);
    index.positive[secondIndex] = { ...first, id: matching[1].id, path: first.path.toLocaleUpperCase("en-US") };
  });
  assertVerifierRejectsPackage("case-insensitive path-collision attack", caseCollision, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /PATH|COLLISION/iu);

  const oversizedIndex = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-oversized-index");
  writeFileSync(path.join(oversizedIndex, "vectors-index.json"), Buffer.alloc((4 * 1024 * 1024) + 1, 0x20), { flag: "w" });
  assertVerifierRejectsPackage("oversized-index pre-read attack", oversizedIndex, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /INDEX_(?:READ|SIZE|LENGTH)|index.*(?:bound|large|size)/iu);

  const oversizedBlob = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-oversized-blob");
  const oversizedBlobIndex = readStrictJson(path.join(oversizedBlob, "vectors-index.json"), "oversized-blob index").value;
  const oversizedBlobEntry = oversizedBlobIndex.positive.find((entry) => entry.kind === "SIGNED_OBJECT");
  appendFileSync(path.join(oversizedBlob, ...oversizedBlobEntry.path.split("/")), Buffer.alloc(maximumTextBytes, 0));
  assertVerifierRejectsPackage("oversized-blob pre-read attack", oversizedBlob, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /(?:POSITIVE|BLOB)_(?:READ|FILE|SIZE)|bounded regular|file size|outside.*bound/iu);

  const irregularIndex = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-irregular-index");
  const irregularIndexPath = path.join(irregularIndex, "vectors-index.json");
  rmSync(irregularIndexPath);
  mkdirSync(irregularIndexPath);
  assertVerifierRejectsPackage("non-regular-index attack", irregularIndex, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /INDEX_(?:READ|FILE)|regular/iu);

  const linkedTarget = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-linked-target");
  const linkedRoot = path.join(probesRoot, "verifier-linked-root");
  symlinkSync(linkedTarget, linkedRoot, "junction");
  try {
    assertVerifierRejectsPackage("linked-vector-root attack", linkedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /LINK|REPARSE|VECTORS_PATH|PACKAGE_PATH/iu);
  } finally {
    if (existsSync(linkedRoot)) unlinkSync(linkedRoot);
  }

  const linkedBlob = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-linked-blob");
  const linkedPositiveDirectory = path.join(linkedBlob, "fixtures", "positive");
  const linkedPositiveTarget = path.join(path.dirname(linkedBlob), "linked-positive-target");
  renameSync(linkedPositiveDirectory, linkedPositiveTarget);
  symlinkSync(linkedPositiveTarget, linkedPositiveDirectory, "junction");
  try {
    assertVerifierRejectsPackage("linked-blob-parent attack", linkedBlob, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /LINK|REPARSE|POSITIVE_(?:READ|PATH)|traverses.*link/iu);
  } finally {
    if (existsSync(linkedPositiveDirectory)) unlinkSync(linkedPositiveDirectory);
  }
}

function assertVerifierStrictJsonGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment) {
  const duplicate = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-json-duplicate");
  const duplicateIndexPath = path.join(duplicate, "vectors-index.json");
  const canonical = readFileSync(duplicateIndexPath, "utf8");
  const duplicated = canonical.replace('  "schemaVersion": 1,', '  "schemaVersion": 1,\n  "schemaVersion": 1,');
  assert(duplicated !== canonical, "Strict-JSON duplicate-key probe could not mutate the index.");
  writeFileSync(duplicateIndexPath, Buffer.from(duplicated, "utf8"), { flag: "w" });
  assertVerifierRejectsPackage("duplicate-index-key attack", duplicate, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /JSON|DUPLICATE/iu);

  const bom = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-json-bom");
  const bomIndexPath = path.join(bom, "vectors-index.json");
  writeFileSync(bomIndexPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readFileSync(bomIndexPath)]), { flag: "w" });
  assertVerifierRejectsPackage("index-BOM attack", bom, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /JSON|BOM|UTF/iu);

  const noncanonical = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-json-noncanonical");
  const noncanonicalIndexPath = path.join(noncanonical, "vectors-index.json");
  const indexValue = readStrictJson(noncanonicalIndexPath, "noncanonical probe source").value;
  writeFileSync(noncanonicalIndexPath, Buffer.from(`${JSON.stringify(indexValue)}\n`, "utf8"), { flag: "w" });
  assertVerifierRejectsPackage("noncanonical-index-format attack", noncanonical, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /JSON|CANONICAL|format/iu);

  const invalidUtf8 = cloneProbePackage(regeneratedRoot, probesRoot, "verifier-json-invalid-utf8");
  const invalidUtf8IndexPath = path.join(invalidUtf8, "vectors-index.json");
  const invalidUtf8Bytes = readFileSync(invalidUtf8IndexPath);
  const insertion = invalidUtf8Bytes.indexOf(Buffer.from("ENTRY_CONTROL_GOLDEN_VECTORS_V1", "ascii"));
  assert(insertion >= 0, "Strict-JSON invalid-UTF-8 probe could not locate its mutation point.");
  invalidUtf8Bytes[insertion] = 0xff;
  writeFileSync(invalidUtf8IndexPath, invalidUtf8Bytes, { flag: "w" });
  assertVerifierRejectsPackage("invalid-UTF-8 index attack", invalidUtf8, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment, /JSON|UTF/iu);
}

function assertVerifierReportGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment) {
  for (const [runtime, executable, prefixArgs, environment] of [
    ["Node", process.execPath, [nodeVerifierPath], nodeEnvironment],
    [".NET", dotnetExecutable, [verifierDll], dotnetEnvironment],
  ]) {
    const runtimeSlug = runtime.toLocaleLowerCase("en-US").replace(".", "");
    const insideReport = path.join(regeneratedRoot, "reports", `forbidden-${runtimeSlug}.json`);
    runCommandExpectFailure(`${runtime} report-inside-package attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", insideReport], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|package|vector/iu,
    });
    assert(!existsSync(insideReport), `${runtime} verifier wrote a report inside the consumed package.`);

    if (process.platform === "win32") {
      const namespaceTarget = path.join(regeneratedRoot, "reports", `namespace-${runtimeSlug}.json`);
      for (const [aliasKind, aliasReport] of windowsNamespaceAliases(namespaceTarget)) {
        runCommandExpectFailure(`${runtime} ${aliasKind} report-inside-package attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", aliasReport], {
          cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
          env: environment,
          expectedPattern: /REPORT|PATH|canonical|drive|namespace|UNC/iu,
        });
        assert(!existsSync(namespaceTarget) && !existsSync(aliasReport), `${runtime} verifier wrote inside the package through a ${aliasKind} path alias.`);
      }
    }

    const existingReport = path.join(probesRoot, `existing-${runtimeSlug}.json`);
    const sentinel = Buffer.from("DO_NOT_OVERWRITE\n", "ascii");
    writeFileSync(existingReport, sentinel, { flag: "wx" });
    runCommandExpectFailure(`${runtime} report no-overwrite attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", existingReport], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|exist|overwrite/iu,
    });
    assert(readFileSync(existingReport).equals(sentinel), `${runtime} verifier overwrote an existing report.`);

    const directoryReport = path.join(probesRoot, `existing-report-directory-${runtimeSlug}`);
    mkdirSync(directoryReport);
    runCommandExpectFailure(`${runtime} directory-as-report attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", directoryReport], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|exist|directory|regular|PATH/iu,
    });
    assert(lstatSync(directoryReport).isDirectory() && readdirSync(directoryReport).length === 0, `${runtime} verifier mutated a directory report target.`);

    const regularParent = path.join(probesRoot, `report-file-parent-${runtimeSlug}.txt`);
    const childOfRegularFile = path.join(regularParent, "verdict.json");
    writeFileSync(regularParent, sentinel, { flag: "wx" });
    runCommandExpectFailure(`${runtime} regular-file report-parent attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", childOfRegularFile], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|directory|regular|PATH/iu,
    });
    assert(readFileSync(regularParent).equals(sentinel) && !existsSync(childOfRegularFile), `${runtime} verifier mutated a regular-file report parent.`);

    const adsHost = path.join(probesRoot, `report-ads-host-${runtimeSlug}.txt`);
    const adsReport = `${adsHost}:hidden-verdict`;
    writeFileSync(adsHost, sentinel, { flag: "wx" });
    runCommandExpectFailure(`${runtime} report ADS attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", adsReport], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|ADS|alias|device|canonical|PATH/iu,
    });
    assert(readFileSync(adsHost).equals(sentinel), `${runtime} verifier changed the ADS host file.`);
    assert(!existsSync(adsReport), `${runtime} verifier created a hidden report alternate data stream.`);

    const reservedReport = path.join(probesRoot, `NUL.${runtimeSlug}-verdict.json`);
    runCommandExpectFailure(`${runtime} reserved-device report attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", reservedReport], {
      cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
      env: environment,
      expectedPattern: /REPORT|alias|device|canonical|PATH/iu,
    });
    assert(!existsSync(reservedReport), `${runtime} verifier created a report through a reserved device alias.`);

    for (const [aliasKind, suffix] of [["trailing-dot", "."], ["trailing-space", " "]]) {
      const canonicalReport = path.join(probesRoot, `report-${aliasKind}-${runtimeSlug}.json`);
      const aliasReport = `${canonicalReport}${suffix}`;
      runCommandExpectFailure(`${runtime} ${aliasKind} report attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", aliasReport], {
        cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
        env: environment,
        expectedPattern: /REPORT|alias|device|canonical|PATH/iu,
      });
      assert(!existsSync(aliasReport) && !existsSync(canonicalReport), `${runtime} verifier created a report through a ${aliasKind} alias.`);
    }

    const linkedTarget = path.join(probesRoot, `report-link-target-${runtimeSlug}`);
    const linkedParent = path.join(probesRoot, `report-link-${runtimeSlug}`);
    mkdirSync(linkedTarget);
    symlinkSync(linkedTarget, linkedParent, "junction");
    try {
      const linkedReport = path.join(linkedParent, "verdict.json");
      runCommandExpectFailure(`${runtime} linked-report-parent attack`, executable, [...prefixArgs, "--vectors", regeneratedRoot, "--report", linkedReport], {
        cwd: runtime === ".NET" ? dotnetRoot : repositoryRoot,
        env: environment,
        expectedPattern: /REPORT|LINK|REPARSE/iu,
      });
      assert(readdirSync(linkedTarget).length === 0, `${runtime} verifier wrote through a linked report parent.`);
    } finally {
      if (existsSync(linkedParent)) unlinkSync(linkedParent);
    }
  }
}

function validateCompactReport(filePath, label) {
  const { bytes, text, value } = readStrictJson(filePath, label, 1024 * 1024);
  assert(bytes.every((byte) => byte <= 0x7f), `${label} must contain compact ASCII JSON only.`);
  assert(text === `${JSON.stringify(value)}\n`, `${label} must be compact JSON with one final LF.`);
  return { bytes, value };
}

function validateIndexedBlob(root, entry, label, seenPaths) {
  const relativePath = canonicalRelativePath(entry.path, `${label}.path`);
  const folded = relativePath.toLocaleLowerCase("en-US");
  assert(!seenPaths.has(folded), `${label}.path collides case-insensitively with ${seenPaths.get(folded)}.`);
  seenPaths.set(folded, relativePath);
  assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= maximumTextBytes, `${label}.bytes is outside the package bound.`);
  assert(/^[0-9a-f]{64}$/u.test(entry.sha256), `${label}.sha256 is invalid.`);
  const absolutePath = path.join(root, ...relativePath.split("/"));
  const stats = lstatSync(absolutePath);
  assert(stats.isFile() && !stats.isSymbolicLink(), `${label}.path must resolve to a regular non-link file.`);
  assert(stats.size === entry.bytes, `${label}.bytes differs from the indexed file size.`);
  assert(sha256(readFileSync(absolutePath)) === entry.sha256, `${label}.sha256 differs from the indexed file.`);
}

function exactScenarioCounts(records, selector, expected, label) {
  const actual = new Map();
  for (const record of records) {
    const key = selector(record);
    actual.set(key, (actual.get(key) ?? 0) + 1);
  }
  exactStringSet(actual.keys(), Object.keys(expected), `${label} keys`);
  for (const [key, count] of Object.entries(expected)) {
    assert(actual.get(key) === count, `${label} ${key} expected ${count}; received ${actual.get(key) ?? 0}.`);
  }
}

function validateVectorCoverage(regeneratedRoot) {
  const index = readStrictJson(path.join(regeneratedRoot, "vectors-index.json"), "regenerated vectors-index.json").value;
  exactKeys(index, [
    "criticalNegative",
    "descriptorCorpora",
    "keyDerivation",
    "keys",
    "nonProductionOnly",
    "positive",
    "protocolManifestSha256",
    "protocolVersion",
    "reportKind",
    "schemaVersion",
  ], "vectors-index.json");
  assert(index.schemaVersion === 1 && index.protocolVersion === 1, "Golden Vector index versions must remain 1.");
  assert(index.reportKind === "ENTRY_CONTROL_GOLDEN_VECTORS_V1", "Golden Vector report kind drifted.");
  assert(index.protocolManifestSha256 === expectedProtocolManifestSha256, "Golden Vector index protocol pin drifted.");
  assert(index.nonProductionOnly === true, "Golden Vector index must declare nonProductionOnly=true.");
  assert(
    index.keyDerivation === "ENTRY_CONTROL_SYSTEM:TEST_ONLY_DO_NOT_TRUST:GOLDEN_VECTOR_KEY:V1:<KEY_ID>",
    "Golden Vector index must carry the exact conspicuous test-only key derivation marker."
  );
  assert(Array.isArray(index.positive), "vectors-index.json positive must be an array.");
  assert(Array.isArray(index.criticalNegative), "vectors-index.json criticalNegative must be an array.");
  assert(index.descriptorCorpora && typeof index.descriptorCorpora === "object", "vectors-index.json descriptorCorpora is missing.");
  assert(Array.isArray(index.keys), "vectors-index.json keys must be an array.");

  const sourceKeys = new Map(Object.values(TEST_ONLY_KEYS).map((key) => [key.id, key]));
  const seenPaths = new Map();
  assert(index.keys.length === 18, `Expected exactly 18 indexed test public keys; received ${index.keys.length}.`);
  const indexedKeyIds = [];
  let previousKeyId = null;
  for (let keyIndex = 0; keyIndex < index.keys.length; keyIndex += 1) {
    const record = index.keys[keyIndex];
    exactKeys(record, ["environment", "keyId", "kidHex", "purpose", "spkiPath", "spkiSha256", "trustClass"], `keys[${keyIndex}]`);
    assert(typeof record.keyId === "string" && sourceKeys.has(record.keyId), `keys[${keyIndex}].keyId is unknown.`);
    assert(previousKeyId === null || previousKeyId < record.keyId, "Golden Vector keys must be strictly ordinal-sorted.");
    previousKeyId = record.keyId;
    indexedKeyIds.push(record.keyId);
    const sourceKey = sourceKeys.get(record.keyId);
    assert(
      record.purpose === sourceKey.purpose
        && record.environment === sourceKey.environment
        && record.trustClass === sourceKey.trustClass,
      `Indexed test-key classification drifted for ${record.keyId}.`
    );
    assert(/^[0-9a-f]{64}$/u.test(record.kidHex) && record.kidHex === record.spkiSha256, `Indexed SPKI/kid digest drifted for ${record.keyId}.`);
    const spkiRelativePath = canonicalRelativePath(record.spkiPath, `${record.keyId}.spkiPath`);
    const foldedSpkiPath = spkiRelativePath.toLocaleLowerCase("en-US");
    assert(!seenPaths.has(foldedSpkiPath), `${record.keyId}.spkiPath collides case-insensitively with ${seenPaths.get(foldedSpkiPath)}.`);
    seenPaths.set(foldedSpkiPath, spkiRelativePath);
    const spkiPath = path.join(regeneratedRoot, ...spkiRelativePath.split("/"));
    const stats = lstatSync(spkiPath);
    assert(stats.isFile() && !stats.isSymbolicLink() && stats.size === 91, `Indexed SPKI must be a regular 91-byte P-256 file for ${record.keyId}.`);
    const spkiBytes = readFileSync(spkiPath);
    assert(spkiBytes.equals(sourceKey.spkiDer) && sha256(spkiBytes) === record.kidHex, `Indexed SPKI bytes drifted for ${record.keyId}.`);
  }
  exactStringSet(indexedKeyIds, sourceKeys.keys(), "Indexed test-only key IDs");

  const seenIds = new Set();
  let previousPositiveId = null;
  for (let positiveIndex = 0; positiveIndex < index.positive.length; positiveIndex += 1) {
    const entry = index.positive[positiveIndex];
    exactKeys(entry, [
      "bytes", "carrierType", "expected", "id", "kind", "mediaType", "path", "payloadSha256",
      "protectedSha256", "sha256", "signatureSha256", "signerKeyId", "signerKeyIdHex",
      "sigStructureSha256", "tokenType", "variant",
    ], `positive[${positiveIndex}]`);
    assert(typeof entry.id === "string" && /^pos-[a-z0-9-]+$/u.test(entry.id) && !seenIds.has(entry.id), `positive[${positiveIndex}].id is invalid or duplicate.`);
    assert(previousPositiveId === null || previousPositiveId < entry.id, "Golden Vector positives must be strictly ordinal-sorted.");
    previousPositiveId = entry.id;
    seenIds.add(entry.id);
    exactKeys(entry.expected, ["decision", "errorCode", "stage"], `${entry.id}.expected`);
    assert(
      entry.expected.decision === "ACCEPT" && entry.expected.stage === "COMPLETE" && entry.expected.errorCode === "NONE",
      `${entry.id} must carry the exact positive expectation.`
    );
    assert(typeof entry.variant === "string" && entry.variant.length > 0, `${entry.id}.variant is required.`);
    validateIndexedBlob(regeneratedRoot, entry, entry.id, seenPaths);
    if (entry.kind === "SIGNED_OBJECT") {
      assert(typeof entry.tokenType === "string" && entry.carrierType === null, `${entry.id} signed-object type metadata drifted.`);
      assert(entry.mediaType === `application/vnd.entry-control.${entry.tokenType}+cbor;v=1`, `${entry.id} signed media type drifted.`);
      assert(sourceKeys.has(entry.signerKeyId), `${entry.id} signerKeyId is not indexed.`);
      assert(sourceKeys.get(entry.signerKeyId).kid.toString("hex") === entry.signerKeyIdHex, `${entry.id} signer kid does not match its SPKI.`);
      for (const field of ["protectedSha256", "payloadSha256", "sigStructureSha256", "signatureSha256", "signerKeyIdHex"]) {
        assert(/^[0-9a-f]{64}$/u.test(entry[field]), `${entry.id}.${field} is invalid.`);
      }
    } else if (entry.kind === "CARRIER") {
      assert(entry.tokenType === null && typeof entry.carrierType === "string", `${entry.id} carrier type metadata drifted.`);
      assert(entry.mediaType === `application/vnd.entry-control.${entry.carrierType}+cbor;v=1`, `${entry.id} carrier media type drifted.`);
      assert(entry.signerKeyId === null && entry.signerKeyIdHex === "", `${entry.id} carrier signer metadata must be empty.`);
      for (const field of ["protectedSha256", "payloadSha256", "sigStructureSha256", "signatureSha256"]) {
        assert(entry[field] === "", `${entry.id}.${field} must be empty for a carrier.`);
      }
    } else fail(`${entry.id}.kind must be SIGNED_OBJECT or CARRIER.`);
  }

  const signedPositives = index.positive.filter((entry) => entry.kind === "SIGNED_OBJECT");
  const carrierPositives = index.positive.filter((entry) => entry.kind === "CARRIER");
  const signedPositiveCount = signedPositives.length;
  const carrierPositiveCount = carrierPositives.length;
  assert(
    signedPositiveCount + carrierPositiveCount === index.positive.length,
    "Every positive vector kind must be exactly SIGNED_OBJECT or CARRIER."
  );
  const binaryNegativeCount = index.criticalNegative.length;
  const malformedCount = index.descriptorCorpora.malformedExpandedCount;
  const crossTypeCount = index.descriptorCorpora.crossTypeCount;
  assert(signedPositiveCount === 35, `Expected 35 signed positives; received ${signedPositiveCount}.`);
  assert(carrierPositiveCount === 6, `Expected 6 carrier positives; received ${carrierPositiveCount}.`);
  assert(binaryNegativeCount === 42, `Expected 42 critical binary negatives; received ${binaryNegativeCount}.`);
  assert(malformedCount === 744, `Expected 744 expanded malformed records; received ${malformedCount}.`);
  assert(crossTypeCount === 90, `Expected 90 cross-type records; received ${crossTypeCount}.`);
  exactStringSet(signedPositives.map((entry) => entry.id), expectedSignedPositiveIds, "Signed-positive ID set");
  exactStringSet(carrierPositives.map((entry) => entry.id), expectedCarrierPositiveIds, "Carrier-positive ID set");
  exactScenarioCounts(signedPositives, (entry) => entry.tokenType, {
    "activation-request": 8,
    "entitlement": 5,
    "key-delegation": 4,
    "key-denylist": 2,
    "lease": 4,
    "lease-request": 4,
    "offline-control": 3,
    "reactivation-authorization": 1,
    "recovery": 3,
    "time-correction": 1,
  }, "Signed-positive scenario distribution");
  exactScenarioCounts(carrierPositives, (entry) => entry.carrierType, {
    "lease-challenge": 1,
    "lease-response": 4,
    "trust-bundle": 1,
  }, "Carrier-positive scenario distribution");
  const fullRecords = signedPositives.filter((entry) => entry.id.endsWith("-full") || entry.variant.includes("FULL"));
  exactStringSet(fullRecords.map((entry) => entry.id), expectedFullScenarioIds, "FULL Edition scenario set");
  const fullContract = new Map([
    ["pos-activation-activate-full", ["activation-request", "ACTIVATE_FULL_SOFTWARE_BOUND"]],
    ["pos-entitlement-initial-full", ["entitlement", "GENERATION_1_FULL"]],
    ["pos-lease-full", ["lease", "ACTIVE_FULL"]],
    ["pos-lease-request-check-in-full", ["lease-request", "CHECK_IN_FULL"]],
  ]);
  for (const record of fullRecords) {
    const [tokenType, variant] = fullContract.get(record.id);
    assert(record.tokenType === tokenType && record.variant === variant, `${record.id} FULL Edition scenario metadata drifted.`);
  }

  let previousNegativeId = null;
  const negativeByDescriptorType = new Map();
  const negativeById = new Map();
  for (let negativeIndex = 0; negativeIndex < index.criticalNegative.length; negativeIndex += 1) {
    const entry = index.criticalNegative[negativeIndex];
    exactKeys(entry, [
      "basePositiveId", "bytes", "expected", "id", "mediaType", "path", "sha256", "signerKeyId",
      "signerKeyIdHex", "sourceDescriptorId", "tokenType",
    ], `criticalNegative[${negativeIndex}]`);
    assert(typeof entry.id === "string" && /^neg-[a-z0-9-]+$/u.test(entry.id) && !seenIds.has(entry.id), `criticalNegative[${negativeIndex}].id is invalid or duplicate.`);
    assert(previousNegativeId === null || previousNegativeId < entry.id, "Golden Vector negatives must be strictly ordinal-sorted.");
    previousNegativeId = entry.id;
    seenIds.add(entry.id);
    assert(typeof entry.sourceDescriptorId === "string" && /^MAL_[A-Z0-9_]+$/u.test(entry.sourceDescriptorId), `${entry.id}.sourceDescriptorId is invalid.`);
    assert(typeof entry.tokenType === "string" && entry.mediaType === `application/vnd.entry-control.${entry.tokenType}+cbor;v=1`, `${entry.id} token/media metadata drifted.`);
    assert(typeof entry.basePositiveId === "string", `${entry.id}.basePositiveId is invalid.`);
    const base = signedPositives.find((record) => record.id === entry.basePositiveId);
    assert(base && base.tokenType === entry.tokenType, `${entry.id} does not bind a signed positive of its source type.`);
    assert(sourceKeys.has(entry.signerKeyId) && sourceKeys.get(entry.signerKeyId).kid.toString("hex") === entry.signerKeyIdHex, `${entry.id} signer metadata does not bind an indexed SPKI.`);
    exactKeys(entry.expected, ["decision", "errorCode", "stage"], `${entry.id}.expected`);
    assert(entry.expected.decision === "REJECT" && entry.expected.stage !== "" && entry.expected.errorCode !== "", `${entry.id} must carry an actionable rejection expectation.`);
    validateIndexedBlob(regeneratedRoot, entry, entry.id, seenPaths);
    const pair = `${entry.sourceDescriptorId}\0${entry.tokenType}`;
    assert(!negativeByDescriptorType.has(pair), `${entry.id} duplicates binary coverage pair ${entry.sourceDescriptorId}/${entry.tokenType}.`);
    negativeByDescriptorType.set(pair, entry);
    negativeById.set(entry.id, entry);
  }
  const actualCriticalNegativeIds = index.criticalNegative.map((entry) => entry?.id).sort();
  exactStringSet(actualCriticalNegativeIds, requiredCriticalNegativeIds, "Critical binary-negative ID set");

  exactKeys(index.descriptorCorpora, [
    "crossTypeCount", "crossTypePath", "crossTypeSha256", "malformedExpandedCount", "malformedPath", "malformedSha256",
  ], "descriptorCorpora");
  const malformedRelativePath = canonicalRelativePath(index.descriptorCorpora.malformedPath, "descriptorCorpora.malformedPath");
  const crossRelativePath = canonicalRelativePath(index.descriptorCorpora.crossTypePath, "descriptorCorpora.crossTypePath");
  for (const relativePath of [malformedRelativePath, crossRelativePath]) {
    const folded = relativePath.toLocaleLowerCase("en-US");
    assert(!seenPaths.has(folded), `Descriptor coverage path collides case-insensitively with ${seenPaths.get(folded)}.`);
    seenPaths.set(folded, relativePath);
  }
  const malformedCoverageFile = readStrictJson(path.join(regeneratedRoot, ...malformedRelativePath.split("/")), "malformed-expanded coverage");
  const crossCoverageFile = readStrictJson(path.join(regeneratedRoot, ...crossRelativePath.split("/")), "cross-type coverage");
  assert(sha256(malformedCoverageFile.bytes) === index.descriptorCorpora.malformedSha256, "Malformed coverage hash does not bind the indexed bytes.");
  assert(sha256(crossCoverageFile.bytes) === index.descriptorCorpora.crossTypeSha256, "Cross-type coverage hash does not bind the indexed bytes.");

  const malformedCoverage = malformedCoverageFile.value;
  const crossCoverage = crossCoverageFile.value;
  exactKeys(malformedCoverage, [
    "coverageKind", "expectedRecordCount", "nonProductionOnly", "protocolVersion", "records", "schemaVersion",
    "sourceDescriptorCount", "sourcePath", "sourceSha256",
  ], "malformed coverage");
  exactKeys(crossCoverage, [
    "coverageKind", "expectedRecordCount", "nonProductionOnly", "protocolVersion", "records", "schemaVersion",
    "sourcePath", "sourceSha256",
  ], "cross-type coverage");
  assert(
    malformedCoverage.schemaVersion === 1
      && malformedCoverage.protocolVersion === 1
      && malformedCoverage.coverageKind === "MALFORMED_EXPANDED"
      && malformedCoverage.nonProductionOnly === true
      && malformedCoverage.expectedRecordCount === 744
      && Array.isArray(malformedCoverage.records)
      && malformedCoverage.records.length === 744,
    "Malformed expanded coverage envelope drifted."
  );
  assert(
    crossCoverage.schemaVersion === 1
      && crossCoverage.protocolVersion === 1
      && crossCoverage.coverageKind === "CROSS_TYPE"
      && crossCoverage.nonProductionOnly === true
      && crossCoverage.expectedRecordCount === 90
      && Array.isArray(crossCoverage.records)
      && crossCoverage.records.length === 90,
    "Cross-type coverage envelope drifted."
  );
  assert(malformedCoverage.sourcePath === "../../protocol/v1/corpus/malformed-cases.json", "Malformed coverage sourcePath drifted.");
  assert(crossCoverage.sourcePath === "../../protocol/v1/corpus/cross-type-cases.json", "Cross-type coverage sourcePath drifted.");
  const malformedSource = readStrictJson(path.join(protocolRoot, "corpus", "malformed-cases.json"), "frozen malformed source corpus");
  const crossSource = readStrictJson(path.join(protocolRoot, "corpus", "cross-type-cases.json"), "frozen cross-type source corpus");
  assert(sha256(malformedSource.bytes) === malformedCoverage.sourceSha256, "Malformed coverage sourceSha256 does not bind the frozen source corpus.");
  assert(sha256(crossSource.bytes) === crossCoverage.sourceSha256, "Cross-type coverage sourceSha256 does not bind the frozen source corpus.");
  assert(Array.isArray(malformedSource.value.cases) && malformedCoverage.sourceDescriptorCount === malformedSource.value.cases.length, "Malformed source descriptor count drifted.");
  assert(Array.isArray(crossSource.value.cases) && crossSource.value.cases.length === 90, "Cross-type source descriptor count drifted.");

  const malformedDescriptorById = new Map(malformedSource.value.cases.map((descriptor) => [descriptor.id, descriptor]));
  assert(malformedDescriptorById.size === malformedSource.value.cases.length, "Frozen malformed source contains duplicate descriptor IDs.");
  const expectedMalformedIds = malformedSource.value.cases.flatMap((descriptor) => descriptor.types.map((tokenType) => `${descriptor.id}::${tokenType}`));
  const binaryLinks = new Set();
  const malformedIds = new Set();
  let deferredMalformedCount = 0;
  for (let recordIndex = 0; recordIndex < malformedCoverage.records.length; recordIndex += 1) {
    const record = malformedCoverage.records[recordIndex];
    exactKeys(record, [
      "baseCosePath", "baseCoseSha256", "basePositiveId", "binaryExecution", "binaryNegativeId",
      "coverageStatus", "descriptorId", "expected", "id", "mutation", "tokenType",
    ], `malformed records[${recordIndex}]`);
    const descriptor = malformedDescriptorById.get(record.descriptorId);
    assert(descriptor && descriptor.types.includes(record.tokenType) && !malformedIds.has(record.id), `${record.id} does not join a unique malformed source descriptor/type.`);
    malformedIds.add(record.id);
    assert(record.id === `${descriptor.id}::${record.tokenType}`, `${record.id} malformed expansion ID drifted.`);
    assert(record.id === expectedMalformedIds[recordIndex], `${record.id} malformed expansion order drifted from the frozen source.`);
    assert(record.coverageStatus === "FROZEN" && jsonDeepEqual(record.mutation, descriptor.mutation) && jsonDeepEqual(record.expected, descriptor.expected), `${record.id} malformed source semantics drifted.`);
    const base = signedPositives.find((entry) => entry.id === record.basePositiveId);
    assert(base && base.tokenType === record.tokenType && base.path === record.baseCosePath && base.sha256 === record.baseCoseSha256, `${record.id} malformed base fixture link drifted.`);
    const negative = negativeByDescriptorType.get(`${record.descriptorId}\0${record.tokenType}`);
    if (negative) {
      assert(record.binaryExecution === "BINARY_FIXTURE" && record.binaryNegativeId === negative.id, `${record.id} must link its exact binary fixture.`);
      assert(!binaryLinks.has(negative.id), `${negative.id} is linked from more than one malformed expansion.`);
      binaryLinks.add(negative.id);
    } else {
      assert(record.binaryExecution === "DEFERRED_TO_LIC_6_2_003" && record.binaryNegativeId === null, `${record.id} must be explicitly deferred to LIC-6.2-003.`);
      deferredMalformedCount += 1;
    }
  }
  exactStringSet(
    malformedIds,
    expectedMalformedIds,
    "Malformed expansion exact source ID join"
  );
  exactStringSet(binaryLinks, negativeById.keys(), "Malformed-to-binary-negative exact join");
  assert(deferredMalformedCount === 702, `Expected exactly 702 malformed expansions deferred to LIC-6.2-003; received ${deferredMalformedCount}.`);

  const crossDescriptorById = new Map(crossSource.value.cases.map((descriptor) => [descriptor.id, descriptor]));
  assert(crossDescriptorById.size === crossSource.value.cases.length, "Frozen cross-type source contains duplicate descriptor IDs.");
  const crossIds = new Set();
  for (let recordIndex = 0; recordIndex < crossCoverage.records.length; recordIndex += 1) {
    const record = crossCoverage.records[recordIndex];
    exactKeys(record, [
      "baseCosePath", "baseCoseSha256", "basePositiveId", "coverageStatus", "expected", "id", "mutation",
      "sourceMediaType", "sourceType", "targetMediaType", "targetType",
    ], `cross-type records[${recordIndex}]`);
    const descriptor = crossDescriptorById.get(record.id);
    assert(descriptor && !crossIds.has(record.id), `${record.id} does not join a unique cross-type source descriptor.`);
    assert(record.id === crossSource.value.cases[recordIndex].id, `${record.id} cross-type record order drifted from the frozen source.`);
    crossIds.add(record.id);
    assert(
      record.coverageStatus === "FROZEN"
        && record.sourceType === descriptor.sourceType
        && record.targetType === descriptor.targetType
        && record.sourceMediaType === descriptor.sourceMediaType
        && record.targetMediaType === descriptor.targetMediaType
        && jsonDeepEqual(record.mutation, descriptor.mutation)
        && jsonDeepEqual(record.expected, descriptor.expected),
      `${record.id} cross-type source semantics drifted.`
    );
    const base = signedPositives.find((entry) => entry.id === record.basePositiveId);
    assert(base && base.tokenType === record.sourceType && base.mediaType === record.sourceMediaType && base.path === record.baseCosePath && base.sha256 === record.baseCoseSha256, `${record.id} cross-type base fixture link drifted.`);
  }
  exactStringSet(crossIds, crossDescriptorById.keys(), "Cross-type exact source join");
  return {
    binaryNegativeCount,
    carrierPositiveCount,
    crossCoverage,
    crossIds,
    crossTypeCount,
    deferredMalformedCount,
    index,
    malformedCount,
    signedPositiveCount,
  };
}

function validateVerdictReport(report, coverage, regeneratedRoot, label) {
  exactKeys(report, [
    "binaryNegativeCount",
    "coverage",
    "crossTypeCount",
    "executed",
    "executedCrossTypeCount",
    "indexSha256",
    "malformedDeferredCount",
    "malformedExpandedCount",
    "positiveCount",
    "protocolManifestSha256",
    "reportKind",
    "schemaVersion",
  ], label);
  assert(
    report.schemaVersion === 1
      && report.reportKind === "ENTRY_CONTROL_GOLDEN_VECTORS_V1"
      && report.protocolManifestSha256 === expectedProtocolManifestSha256,
    `${label} identity drifted.`
  );
  assert(report.indexSha256 === sha256(readFileSync(path.join(regeneratedRoot, "vectors-index.json"))), `${label} indexSha256 does not bind the consumed index bytes.`);
  assert(report.positiveCount === 41, `${label} must report exactly 41 executed positives.`);
  assert(report.binaryNegativeCount === 42, `${label} must report exactly 42 executed binary negatives.`);
  assert(report.malformedExpandedCount === 744, `${label} malformed expansion count drifted.`);
  assert(report.malformedDeferredCount === 702, `${label} must report exactly 702 malformed expansions deferred to LIC-6.2-003.`);
  assert(report.crossTypeCount === 90, `${label} cross-type corpus count drifted.`);
  assert(report.executedCrossTypeCount === 90, `${label} must report all 90 cross-type cases as actually executed.`);
  assert(Array.isArray(report.executed) && report.executed.length === 173, `${label} must contain exactly 173 executed verdict records.`);
  exactKeys(report.coverage, ["crossTypeSha256", "malformedExpandedSha256"], `${label}.coverage`);
  assert(
    report.coverage.malformedExpandedSha256 === coverage.index.descriptorCorpora.malformedSha256
      && report.coverage.crossTypeSha256 === coverage.index.descriptorCorpora.crossTypeSha256,
    `${label} coverage digests do not bind the indexed corpora.`
  );

  const expected = new Map();
  for (const record of coverage.index.positive) {
    expected.set(record.id, {
      decision: "ACCEPT",
      stage: "COMPLETE",
      errorCode: "NONE",
      inputSha256: record.sha256,
      protectedSha256: record.kind === "SIGNED_OBJECT" ? record.protectedSha256 : "",
      payloadSha256: record.kind === "SIGNED_OBJECT" ? record.payloadSha256 : "",
      sigStructureSha256: record.kind === "SIGNED_OBJECT" ? record.sigStructureSha256 : "",
      signerKeyIdHex: record.kind === "SIGNED_OBJECT" ? record.signerKeyIdHex : "",
    });
  }
  for (const record of coverage.index.criticalNegative) {
    expected.set(record.id, {
      decision: record.expected.decision,
      stage: record.expected.stage,
      errorCode: record.expected.errorCode,
      inputSha256: record.sha256,
      protectedSha256: "",
      payloadSha256: "",
      sigStructureSha256: "",
      signerKeyIdHex: "",
    });
  }
  for (const record of coverage.crossCoverage.records) {
    expected.set(record.id, {
      decision: record.expected.decision,
      stage: record.expected.stage,
      errorCode: record.expected.errorCode,
      inputSha256: record.baseCoseSha256,
      protectedSha256: "",
      payloadSha256: "",
      sigStructureSha256: "",
      signerKeyIdHex: "",
    });
  }
  assert(expected.size === 173, `${label} dynamic expected execution set must contain 173 unique IDs.`);

  const actualIds = new Set();
  let previousId = null;
  for (let index = 0; index < report.executed.length; index += 1) {
    const record = report.executed[index];
    exactKeys(record, [
      "decision", "errorCode", "id", "inputSha256", "payloadSha256", "protectedSha256",
      "signerKeyIdHex", "sigStructureSha256", "stage",
    ], `${label}.executed[${index}]`);
    assert(typeof record.id === "string" && !actualIds.has(record.id), `${label} contains a duplicate/invalid execution ID.`);
    assert(previousId === null || previousId < record.id, `${label} execution IDs must be strict ordinal-sorted.`);
    previousId = record.id;
    actualIds.add(record.id);
    const expectedRecord = expected.get(record.id);
    assert(expectedRecord && jsonDeepEqual(record, { id: record.id, ...expectedRecord }), `${label} execution record does not exactly join its indexed/corpus case: ${record.id}.`);
  }
  exactStringSet(actualIds, expected.keys(), `${label} dynamic executed ID set`);
}

function containsBytes(haystack, needle) {
  return needle.length > 0 && haystack.indexOf(needle) !== -1;
}

function collectSensitiveTestMaterial(regeneratedRoot) {
  const keyFiles = listFiles(path.join(regeneratedRoot, "keys"));
  assert(keyFiles.length > 0, "Golden Vector package contains no test keys.");
  const rawNeedles = [];
  const textNeedles = new Set([
    "test_only_",
    "test_only_do_not_trust",
    "nonproductiononly",
    "non-production golden vector",
    "licensing/vectors/v1",
    "licensing\\vectors\\v1",
  ]);
  for (const file of keyFiles) {
    const bytes = readFileSync(file.absolutePath);
    if (bytes.length >= 16) rawNeedles.push({ bytes, label: file.relativePath });
    const digest = sha256(bytes);
    textNeedles.add(digest);
    textNeedles.add(bytes.toString("base64").toLocaleLowerCase("en-US"));
    textNeedles.add(bytes.toString("base64url").toLocaleLowerCase("en-US"));
    if (/private|pkcs8|pk8|secret/iu.test(file.relativePath)) {
      textNeedles.add(bytes.toString("hex"));
    }
  }
  for (const key of Object.values(TEST_ONLY_KEYS)) {
    assert(typeof key.privateScalar === "bigint" && key.privateScalar > 0n && key.privateScalar < p256Order, `Test-only private scalar is outside the exact P-256 group order: ${key.id}.`);
    const privateScalarBytes = Buffer.from(key.privateScalar.toString(16).padStart(64, "0"), "hex");
    rawNeedles.push({ bytes: privateScalarBytes, label: `${key.id} private scalar` });
    textNeedles.add(key.id.toLocaleLowerCase("en-US"));
    textNeedles.add(privateScalarBytes.toString("hex"));
    textNeedles.add(privateScalarBytes.toString("base64").toLocaleLowerCase("en-US"));
    textNeedles.add(privateScalarBytes.toString("base64url").toLocaleLowerCase("en-US"));
  }
  const index = readStrictJson(path.join(regeneratedRoot, "vectors-index.json"), "vectors-index.json").value;
  const visit = (value, parentKey = "") => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, parentKey);
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) visit(child, key);
    } else if (
      typeof value === "string"
      && /^[0-9a-f]{64}$/iu.test(value)
      && /key|kid|fingerprint/iu.test(parentKey)
    ) {
      textNeedles.add(value.toLocaleLowerCase("en-US"));
    }
  };
  visit(index);
  return { rawNeedles, textNeedles: [...textNeedles].filter((value) => value.length >= 12) };
}

function listProductionFiles() {
  const roots = [
    "server/src",
    "server/prisma",
    "client/src",
    "client/public",
    "client/scripts",
    "server/dist",
    "client/dist",
    "release/FULL",
    "release/ATTENDANCE",
  ];
  const files = [];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(repositoryRoot, ...relativeRoot.split("/"));
    if (!existsSync(absoluteRoot)) continue;
    for (const file of listFiles(absoluteRoot)) {
      files.push({
        absolutePath: file.absolutePath,
        relativePath: `${relativeRoot}/${file.relativePath}`,
        size: file.size,
      });
    }
  }
  for (const relativePath of [
    "server/.env.example",
    "server/package.json",
    "server/package-lock.json",
    "server/prisma.config.ts",
    "server/tsconfig.json",
    "server/tsconfig.runtime.json",
    "client/.env.example",
    "client/eslint.config.js",
    "client/index.html",
    "client/package.json",
    "client/package-lock.json",
    "client/postcss.config.js",
    "client/tailwind.config.js",
    "client/tsconfig.app.json",
    "client/tsconfig.json",
    "client/tsconfig.node.json",
    "client/vite.config.ts",
  ]) {
    const absolutePath = path.join(repositoryRoot, ...relativePath.split("/"));
    if (existsSync(absolutePath)) files.push({ absolutePath, relativePath, size: lstatSync(absolutePath).size });
  }
  return files;
}

function validateProductionIsolation(regeneratedRoot) {
  const { rawNeedles, textNeedles } = collectSensitiveTestMaterial(regeneratedRoot);
  const files = listProductionFiles();
  assert(files.length > 0, "No production source/artifact files were available for the test-key isolation scan.");
  for (const file of files) {
    assert(file.size <= maximumScannedFileBytes, `Production isolation scan refuses oversized file ${file.relativePath}.`);
    const bytes = readFileSync(file.absolutePath);
    for (const needle of rawNeedles) {
      assert(!containsBytes(bytes, needle.bytes), `Test key bytes leaked into production file ${file.relativePath} (${needle.label}).`);
    }
    const searchableText = bytes.toString("utf8").toLocaleLowerCase("en-US");
    for (const needle of textNeedles) {
      assert(!searchableText.includes(needle), `Test marker/key fingerprint leaked into production file ${file.relativePath}.`);
    }
  }
  return files.length;
}

function manifestClosureFiles() {
  return listFiles(vectorRoot, { rejectBuildOutputs: true }).filter(
    ({ relativePath }) => relativePath !== vectorManifestName && relativePath !== vectorManifestSidecarName
  );
}

function createManifestValue() {
  const closure = manifestClosureFiles();
  for (const file of closure) {
    assert(file.size <= maximumScannedFileBytes, `Vector manifest refuses oversized closure file ${file.relativePath}.`);
  }
  validateGitTrackability(closure);
  return {
    schemaVersion: 1,
    manifestVersion: 1,
    packageKind: "NON_PRODUCTION_GOLDEN_VECTORS",
    productId: "ENTRY_CONTROL_SYSTEM",
    protocolVersion: 1,
    protocolManifestSha256: expectedProtocolManifestSha256,
    files: closure.map((file) => ({
      path: file.relativePath,
      sha256: sha256(readFileSync(file.absolutePath)),
      size: file.size,
    })),
  };
}

function replaceFromTemporary(targetPath, bytes) {
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  assert(!existsSync(temporaryPath), `Manifest temporary path already exists: ${temporaryPath}.`);
  writeFileSync(temporaryPath, bytes, { flag: "wx" });
  try {
    renameSync(temporaryPath, targetPath);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
  }
}

function prepareVectorManifest() {
  const manifest = createManifestValue();
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const digest = sha256(manifestBytes);
  replaceFromTemporary(path.join(vectorRoot, vectorManifestName), manifestBytes);
  replaceFromTemporary(path.join(vectorRoot, vectorManifestSidecarName), Buffer.from(`${digest}\n`, "ascii"));
  return { closureCount: manifest.files.length, digest };
}

function validateVectorManifest() {
  const manifestPath = path.join(vectorRoot, vectorManifestName);
  const sidecarPath = path.join(vectorRoot, vectorManifestSidecarName);
  assert(
    existsSync(manifestPath) && existsSync(sidecarPath),
    `Golden Vector closure is missing ${vectorManifestName} and/or ${vectorManifestSidecarName}; run the focused gate once with --prepare-manifest, pin the printed digest in ${path.relative(repositoryRoot, fileURLToPath(import.meta.url))}, then rerun without that option.`
  );
  const { bytes, text, value: manifest } = readStrictJson(manifestPath, vectorManifestName, 4 * 1024 * 1024);
  assert(text === `${JSON.stringify(manifest, null, 2)}\n`, "Vector manifest must use canonical pretty JSON formatting.");
  exactKeys(manifest, [
    "files",
    "manifestVersion",
    "packageKind",
    "productId",
    "protocolManifestSha256",
    "protocolVersion",
    "schemaVersion",
  ], "vector manifest");
  assert(manifest.schemaVersion === 1 && manifest.manifestVersion === 1, "Vector manifest version must remain 1.");
  assert(manifest.packageKind === "NON_PRODUCTION_GOLDEN_VECTORS", "Vector manifest packageKind drifted.");
  assert(manifest.productId === "ENTRY_CONTROL_SYSTEM" && manifest.protocolVersion === 1, "Vector manifest identity drifted.");
  assert(manifest.protocolManifestSha256 === expectedProtocolManifestSha256, "Vector manifest protocol pin drifted.");
  const closure = manifestClosureFiles();
  for (const file of closure) {
    assert(file.size <= maximumScannedFileBytes, `Vector manifest refuses oversized closure file ${file.relativePath}.`);
  }
  validateGitTrackability(closure);
  assert(Array.isArray(manifest.files) && manifest.files.length === closure.length, "Vector manifest closure count drifted.");
  for (let index = 0; index < closure.length; index += 1) {
    const entry = manifest.files[index];
    exactKeys(entry, ["path", "sha256", "size"], `vector manifest files[${index}]`);
    canonicalRelativePath(entry.path, `vector manifest files[${index}].path`);
    const actual = closure[index];
    assert(entry.path === actual.relativePath, `Vector manifest path mismatch at index ${index}.`);
    assert(entry.size === actual.size, `Vector manifest size mismatch for ${entry.path}.`);
    assert(/^[0-9a-f]{64}$/u.test(entry.sha256), `Vector manifest digest is invalid for ${entry.path}.`);
    assert(entry.sha256 === sha256(readFileSync(actual.absolutePath)), `Vector manifest digest mismatch for ${entry.path}.`);
  }
  const digest = sha256(bytes);
  assert(
    readFileSync(sidecarPath, "utf8") === `${digest}\n`,
    "Vector manifest sidecar does not match vector-manifest.json."
  );
  assert(
    expectedVectorManifestSha256 !== "__VECTOR_MANIFEST_SHA256_PENDING__",
    `Vector external digest pin is pending; replace __VECTOR_MANIFEST_SHA256_PENDING__ in scripts/test-license-golden-vectors.mjs with ${digest}, then rerun.`
  );
  assert(digest === expectedVectorManifestSha256, "Vector manifest drifted from the repository-external LIC-6.2-002 digest pin.");
  return { closureCount: closure.length, digest };
}

let temporaryWorkspace;
try {
  validateRuntimeAndProtocolPin();
  process.stdout.write(`ok - exact Node ${expectedNodeVersion}, isolated verifier module graph, 18 bounded P-256 test keys, frozen protocol pin, and closed .NET source provenance\n`);

  temporaryWorkspace = mkdtempSync(path.join(tmpdir(), "ecs-license-vectors-"));
  const regeneratedRoot = path.join(temporaryWorkspace, "regenerated-tree", "licensing", "vectors", "v1");
  const reportRoot = path.join(temporaryWorkspace, "reports");
  const probesRoot = path.join(temporaryWorkspace, "attack-probes");
  const dotnetArtifactsRoot = path.join(temporaryWorkspace, "dotnet-artifacts");
  mkdirSync(regeneratedRoot, { recursive: true });
  mirrorFrozenProtocolCorpora(regeneratedRoot);
  mkdirSync(reportRoot, { recursive: true });
  mkdirSync(probesRoot, { recursive: true });
  mkdirSync(dotnetArtifactsRoot, { recursive: true });
  const nodeEnvironment = cleanNodeChildEnvironment(temporaryWorkspace);
  const dotnetExecutable = resolveFirstExecutable("dotnet");
  const dotnetEnvironment = createDotnetEnvironment(dotnetExecutable, temporaryWorkspace);

  runCommand("Frozen protocol v1 regression", process.execPath, [path.join(scriptDirectory, "test-license-protocol-v1.mjs")], { env: nodeEnvironment });
  assertGeneratorAttackGuards(probesRoot, nodeEnvironment);
  process.stdout.write("ok - generator rejects repository, non-empty, regular-file, and junction outputs and uses exclusive no-overwrite writes\n");

  runCommand("Vendor fixture regeneration", process.execPath, [generatorPath, "--output", regeneratedRoot], { env: nodeEnvironment });
  const regeneratedFileCount = compareRegeneratedPackage(regeneratedRoot);
  process.stdout.write(`ok - Vendor issuer regenerated ${regeneratedFileCount} committed files byte-identically in a disposable directory\n`);

  const counts = validateVectorCoverage(regeneratedRoot);
  process.stdout.write(`ok - exact ${counts.signedPositiveCount} signed + ${counts.carrierPositiveCount} carrier positives (including FULL), ${counts.binaryNegativeCount} binary negatives, ${counts.malformedCount - counts.deferredMalformedCount} binary-linked + ${counts.deferredMalformedCount} deferred malformed expansions, and ${counts.crossTypeCount} exact cross-type joins\n`);

  const nodeReportPath = path.join(reportRoot, "node-verdict.json");
  const dotnetReportPath = path.join(reportRoot, "dotnet-verdict.json");
  runCommand("Node Golden Vector verifier", process.execPath, [
    nodeVerifierPath,
    "--vectors",
    regeneratedRoot,
    "--report",
    nodeReportPath,
  ], { env: nodeEnvironment });

  const dotnetVersion = runCommand("Scoped .NET SDK version check", dotnetExecutable, ["--version"], {
    cwd: dotnetRoot,
    env: dotnetEnvironment,
  });
  assert(dotnetVersion === expectedDotnetSdkVersion, `Golden-vector gate requires scoped .NET SDK ${expectedDotnetSdkVersion}; received ${dotnetVersion}.`);
  const nugetConfigPath = path.join(temporaryWorkspace, "NuGet.Config");
  writeFileSync(
    nugetConfigPath,
    Buffer.from("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<configuration>\n  <packageSources>\n    <clear />\n  </packageSources>\n</configuration>\n", "utf8"),
    { flag: "wx" }
  );
  runCommand("Dependency-free .NET restore", dotnetExecutable, [
    "restore",
    path.join(dotnetRoot, "EntryControl.GoldenVectors.csproj"),
    "--artifacts-path",
    dotnetArtifactsRoot,
    "--configfile",
    nugetConfigPath,
    "--force",
    "--no-cache",
  ], {
    cwd: dotnetRoot,
    env: dotnetEnvironment,
    timeout: 300_000,
  });
  runCommand(".NET Golden Vector verifier", dotnetExecutable, [
    "run",
    "--project",
    path.join(dotnetRoot, "EntryControl.GoldenVectors.csproj"),
    "--configuration",
    "Release",
    "--artifacts-path",
    dotnetArtifactsRoot,
    "--no-restore",
    "--",
    "--vectors",
    regeneratedRoot,
    "--report",
    dotnetReportPath,
  ], {
    cwd: dotnetRoot,
    env: dotnetEnvironment,
    timeout: 300_000,
  });
  const verifierDll = dotnetVerifierDll(dotnetArtifactsRoot);

  assertVerifierPathAttackGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment);
  assertVerifierStrictJsonGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment);
  assertVerifierReportGuards(regeneratedRoot, probesRoot, nodeEnvironment, dotnetExecutable, verifierDll, dotnetEnvironment);
  process.stdout.write("ok - both verifiers enforce strict canonical JSON; reject traversal, namespace/UNC aliases, backslash, ADS, case-collision, oversized, irregular and linked package inputs; report targets reject directory/file-parent/namespace/UNC/ADS/device/dot-space aliases and remain outside-package, non-link and no-overwrite\n");

  const vendorReport = validateCompactReport(path.join(regeneratedRoot, "reports", "vendor-verdict.json"), "Vendor issuer verdict");
  const nodeReport = validateCompactReport(nodeReportPath, "Node verifier verdict");
  const dotnetReport = validateCompactReport(dotnetReportPath, ".NET verifier verdict");
  validateVerdictReport(vendorReport.value, counts, regeneratedRoot, "Vendor issuer verdict");
  validateVerdictReport(nodeReport.value, counts, regeneratedRoot, "Node verifier verdict");
  validateVerdictReport(dotnetReport.value, counts, regeneratedRoot, ".NET verifier verdict");
  assert(vendorReport.bytes.equals(nodeReport.bytes), "Vendor issuer and Node verifier verdict bytes differ.");
  assert(vendorReport.bytes.equals(dotnetReport.bytes), "Vendor issuer and .NET verifier verdict bytes differ.");
  for (const reportName of ["vendor-verdict.json", "node-verdict.json", "dotnet-verdict.json"]) {
    const committedReportPath = path.join(vectorRoot, "reports", reportName);
    assert(existsSync(committedReportPath), `Committed cross-runtime report is missing: reports/${reportName}.`);
    assert(
      readFileSync(committedReportPath).equals(vendorReport.bytes),
      `Committed reports/${reportName} differs from the freshly executed byte-identical verdict.`
    );
  }
  process.stdout.write(`ok - Vendor, Node and .NET ${expectedDotnetSdkVersion} emitted byte-identical 173-record reports (41 positive + 42 binary negative + 90 actually executed cross-type)\n`);

  const scannedFileCount = validateProductionIsolation(regeneratedRoot);
  process.stdout.write(`ok - ${scannedFileCount} production source/artifact files contain no test markers, key bytes, fingerprints or vector imports\n`);

  if (prepareManifest) {
    const closure = prepareVectorManifest();
    process.stdout.write(`\n[license-golden-vectors] PREPARED - closed ${closure.closureCount} files; pin ${closure.digest} and rerun without --prepare-manifest.\n`);
  } else {
    const closure = validateVectorManifest();
    process.stdout.write(`\n[license-golden-vectors] PASS - Node ${process.versions.node}; .NET SDK ${expectedDotnetSdkVersion}; ${closure.closureCount}-file vector package ${closure.digest}.\n`);
  }
} finally {
  if (temporaryWorkspace) {
    const resolvedTemporaryWorkspace = path.resolve(temporaryWorkspace);
    const resolvedTemporaryRoot = path.resolve(tmpdir());
    assert(
      resolvedTemporaryWorkspace.startsWith(`${resolvedTemporaryRoot}${path.sep}`)
        && path.basename(resolvedTemporaryWorkspace).startsWith("ecs-license-vectors-"),
      `Refusing to clean an unexpected temporary path: ${resolvedTemporaryWorkspace}.`
    );
    rmSync(resolvedTemporaryWorkspace, { recursive: true, force: true });
  }
}
