import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  MAX_IDENTITY_BYTES,
  VersionIdentityError,
  loadVersionIdentity,
  parseBuildEdition,
  parseVersionIdentity,
} = require("./lib/version-identity.cjs");
const {
  BuildIdentityError,
  createBuildIdentity,
  parseBuildIdentity,
  serializeBuildIdentity,
} = require("./lib/build-identity.cjs");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const canonicalPath = path.join(repositoryRoot, "version.json");
const canonical = loadVersionIdentity(canonicalPath);

function expectFailure(label, operation, code) {
  assert.throws(
    operation,
    (error) => error instanceof VersionIdentityError && error.code === code,
    label
  );
}

assert.deepEqual(canonical.identity, {
  schemaVersion: 1,
  productId: "ENTRY_CONTROL_SYSTEM",
  productVersion: "1.0.0",
  apiVersion: "v1",
  licenseProtocolVersion: 1,
  buildManifestVersion: 1,
  supportedEditions: ["FULL", "ATTENDANCE"],
  nodeVersion: "24.19.0",
});
assert.ok(Object.isFrozen(canonical.identity));
assert.ok(Object.isFrozen(canonical.identity.supportedEditions));
assert.match(canonical.sha256, /^[0-9a-f]{64}$/u);

const fullBuildIdentity = createBuildIdentity(canonical, "FULL");
assert.ok(Object.isFrozen(fullBuildIdentity));
assert.equal(fullBuildIdentity.versionIdentitySha256, canonical.sha256);
assert.deepEqual(
  parseBuildIdentity(serializeBuildIdentity(fullBuildIdentity).text, canonical, "FULL"),
  fullBuildIdentity
);
assert.throws(
  () => parseBuildIdentity(serializeBuildIdentity(fullBuildIdentity).text, canonical, "ATTENDANCE"),
  (error) => error instanceof BuildIdentityError && error.code === "BUILD_EDITION_MISMATCH"
);
assert.throws(
  () => parseBuildIdentity(
    JSON.stringify({ ...fullBuildIdentity, productVersion: "2.0.0" }),
    canonical,
    "FULL"
  ),
  (error) => error instanceof BuildIdentityError && error.code === "BUILD_IDENTITY_MISMATCH"
);
assert.throws(
  () => parseBuildIdentity(
    JSON.stringify({ ...fullBuildIdentity, unexpected: true }),
    canonical,
    "FULL"
  ),
  (error) => error instanceof BuildIdentityError && error.code === "INVALID_BUILD_IDENTITY"
);

const reordered = `{
  "nodeVersion": "24.19.0",
  "supportedEditions": ["FULL", "ATTENDANCE"],
  "buildManifestVersion": 1,
  "licenseProtocolVersion": 1,
  "apiVersion": "v1",
  "productVersion": "1.0.0",
  "productId": "ENTRY_CONTROL_SYSTEM",
  "schemaVersion": 1
}`;
assert.equal(parseVersionIdentity(reordered).sha256, canonical.sha256);
assert.equal(parseVersionIdentity(`  ${reordered}\r\n`).sha256, canonical.sha256);

for (const edition of ["FULL", "ATTENDANCE"]) {
  assert.equal(parseBuildEdition(edition, canonical.identity), edition);
}
for (const edition of [undefined, "", "full", "attendance", "FULL ", " FULL", "ENTERPRISE"]) {
  expectFailure(
    `invalid edition ${JSON.stringify(edition)}`,
    () => parseBuildEdition(edition, canonical.identity),
    "INVALID_EDITION"
  );
}

for (const [label, input, code] of [
  ["empty", "", "EMPTY_FILE"],
  ["BOM", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(reordered)]), "INVALID_ENCODING"],
  ["invalid UTF-8", Buffer.from([0xc3, 0x28]), "INVALID_ENCODING"],
  ["truncated", "{", "INVALID_JSON"],
  ["comment", `${reordered}\n// comment`, "INVALID_JSON"],
  ["trailing JSON", `${reordered}{}`, "INVALID_JSON"],
  ["duplicate key", reordered.replace('"schemaVersion": 1', '"schemaVersion": 1, "schemaVersion": 1'), "INVALID_JSON"],
  ["array root", "[]", "INVALID_SCHEMA"],
  ["null root", "null", "INVALID_SCHEMA"],
]) {
  expectFailure(label, () => parseVersionIdentity(input, label), code);
}

const baseValue = JSON.parse(reordered);
for (const field of Object.keys(baseValue)) {
  const candidate = { ...baseValue };
  delete candidate[field];
  expectFailure(`missing ${field}`, () => parseVersionIdentity(JSON.stringify(candidate)), "INVALID_SCHEMA");
}
expectFailure(
  "unknown field",
  () => parseVersionIdentity(JSON.stringify({ ...baseValue, unexpected: true })),
  "INVALID_SCHEMA"
);

for (const [field, invalidValue, expectedCode] of [
  ["schemaVersion", 2, "UNSUPPORTED_IDENTITY"],
  ["schemaVersion", 1.5, "UNSUPPORTED_IDENTITY"],
  ["productId", "entry-control-system", "UNSUPPORTED_IDENTITY"],
  ["productId", "ENTRY_CONTROL_SYSTEM ", "UNSUPPORTED_IDENTITY"],
  ["productVersion", "v1.0.0", "INVALID_SCHEMA"],
  ["productVersion", "01.0.0", "INVALID_SCHEMA"],
  ["productVersion", "1.0", "INVALID_SCHEMA"],
  ["apiVersion", "v2", "UNSUPPORTED_IDENTITY"],
  ["licenseProtocolVersion", 2, "UNSUPPORTED_IDENTITY"],
  ["buildManifestVersion", 0, "UNSUPPORTED_IDENTITY"],
  ["supportedEditions", ["ATTENDANCE", "FULL"], "INVALID_SCHEMA"],
  ["supportedEditions", ["FULL", "ATTENDANCE", "OTHER"], "INVALID_SCHEMA"],
  ["nodeVersion", "24", "INVALID_SCHEMA"],
]) {
  expectFailure(
    `${field}=${JSON.stringify(invalidValue)}`,
    () => parseVersionIdentity(JSON.stringify({ ...baseValue, [field]: invalidValue })),
    expectedCode
  );
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ecs version identity "));
try {
  const nestedRoot = path.join(temporaryRoot, "path with spaces");
  mkdirSync(nestedRoot);
  const copiedIdentityPath = path.join(nestedRoot, "version.json");
  writeFileSync(copiedIdentityPath, reordered, { encoding: "utf8", flag: "wx" });
  assert.equal(loadVersionIdentity(copiedIdentityPath).sha256, canonical.sha256);
  expectFailure(
    "missing file",
    () => loadVersionIdentity(path.join(nestedRoot, "missing.json")),
    "IDENTITY_READ_FAILED"
  );
  expectFailure("directory instead of file", () => loadVersionIdentity(nestedRoot), "IDENTITY_READ_FAILED");
  const oversizedIdentityPath = path.join(nestedRoot, "oversized.json");
  writeFileSync(oversizedIdentityPath, Buffer.alloc(MAX_IDENTITY_BYTES + 1, 0x20), { flag: "wx" });
  expectFailure("oversized file", () => loadVersionIdentity(oversizedIdentityPath), "FILE_TOO_LARGE");

  const previousCwd = process.cwd();
  const previousPoison = process.env.npm_package_version;
  try {
    process.chdir(nestedRoot);
    process.env.npm_package_version = "999.999.999";
    assert.equal(loadVersionIdentity(canonicalPath).sha256, canonical.sha256);
  } finally {
    process.chdir(previousCwd);
    if (previousPoison === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = previousPoison;
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log(`ok - canonical version identity ${canonical.identity.productVersion} (${canonical.sha256}) is strict and deterministic`);
