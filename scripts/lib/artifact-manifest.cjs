"use strict";

const { createHash } = require("node:crypto");
const { closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync } = require("node:fs");
const path = require("node:path");
const {
  MAX_IDENTITY_BYTES,
  assertSha256,
  canonicalizeJson,
  deepFreeze,
  parseBuildEdition,
  parseStrictJson,
  readFileBounded,
  sha256Hex,
} = require("./version-identity.cjs");
const {
  parseBuildIdentity,
  serializeBuildIdentity,
} = require("./build-identity.cjs");

const MANIFEST_FILE = "build-manifest.json";
const MANIFEST_HASH_FILE = "build-manifest.sha256";
const BUILD_IDENTITY_FILE = "build-identity.json";
const VERSION_IDENTITY_FILE = "version.json";
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MANIFEST_FIELDS = Object.freeze([
  "apiVersion",
  "buildIdentitySha256",
  "edition",
  "files",
  "licenseProtocolVersion",
  "manifestVersion",
  "nodeVersion",
  "productId",
  "productVersion",
  "versionIdentitySha256",
]);
const FILE_FIELDS = Object.freeze(["path", "sha256", "size"]);

class ArtifactManifestError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "ArtifactManifestError";
    this.code = code;
  }
}

function expectExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ArtifactManifestError("INVALID_MANIFEST", `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new ArtifactManifestError(
      "INVALID_MANIFEST",
      `${label} fields differ from the manifest schema.`
    );
  }
}

function validateRelativePath(value, label) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 512
    || value.includes("\\")
    || value.includes(":")
    || value.startsWith("/")
    || value !== value.normalize("NFC")
  ) {
    throw new ArtifactManifestError("INVALID_ARTIFACT_PATH", `${label} is not a canonical relative path.`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new ArtifactManifestError("INVALID_ARTIFACT_PATH", `${label} contains a forbidden path segment.`);
  }
  return value;
}

function listArtifactFiles(rootPath) {
  const root = path.resolve(rootPath);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      validateRelativePath(relativePath, `artifact path ${JSON.stringify(relativePath)}`);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new ArtifactManifestError("ARTIFACT_LINK_FORBIDDEN", `Artifact links are forbidden: ${relativePath}.`);
      }
      if (stats.isDirectory()) visit(absolutePath);
      else if (stats.isFile()) files.push({ absolutePath, relativePath, size: stats.size });
      else throw new ArtifactManifestError("INVALID_ARTIFACT_ENTRY", `Unsupported artifact entry: ${relativePath}.`);
    }
  };
  visit(root);
  const caseFolded = new Set();
  for (const file of files) {
    const folded = file.relativePath.toLocaleLowerCase("en-US");
    if (caseFolded.has(folded)) {
      throw new ArtifactManifestError(
        "WINDOWS_PATH_COLLISION",
        `Artifact contains a Windows case-insensitive path collision at ${file.relativePath}.`
      );
    }
    caseFolded.add(folded);
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

function closedWorldFiles(rootPath) {
  return listArtifactFiles(rootPath).filter(
    ({ relativePath }) => relativePath !== MANIFEST_FILE && relativePath !== MANIFEST_HASH_FILE
  );
}

function hashFile(filePath, expectedSize) {
  let descriptor;
  try {
    descriptor = openSync(filePath, "r");
    const before = fstatSync(descriptor);
    if (!before.isFile()) {
      throw new ArtifactManifestError("INVALID_ARTIFACT_ENTRY", `Artifact file is not regular: ${filePath}.`);
    }
    if (expectedSize !== undefined && before.size !== expectedSize) {
      throw new ArtifactManifestError("ARTIFACT_CLOSURE_MISMATCH", `Artifact file size changed at ${filePath}.`);
    }
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      digest.update(buffer.subarray(0, count));
      total += count;
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new ArtifactManifestError("ARTIFACT_FILE_CHANGED", `Artifact file changed while hashing: ${filePath}.`);
    }
    return digest.digest("hex");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function createArtifactManifest(rootPath, parsedVersionIdentity, buildIdentity) {
  const serializedBuildIdentity = serializeBuildIdentity(buildIdentity);
  const files = closedWorldFiles(rootPath).map(({ absolutePath, relativePath, size }) => deepFreeze({
    path: relativePath,
    size,
    sha256: hashFile(absolutePath, size),
  }));
  return deepFreeze({
    manifestVersion: parsedVersionIdentity.identity.buildManifestVersion,
    productId: parsedVersionIdentity.identity.productId,
    productVersion: parsedVersionIdentity.identity.productVersion,
    apiVersion: parsedVersionIdentity.identity.apiVersion,
    licenseProtocolVersion: parsedVersionIdentity.identity.licenseProtocolVersion,
    nodeVersion: parsedVersionIdentity.identity.nodeVersion,
    versionIdentitySha256: parsedVersionIdentity.sha256,
    buildIdentitySha256: serializedBuildIdentity.sha256,
    edition: buildIdentity.edition,
    files,
  });
}

function serializeArtifactManifest(manifest) {
  const canonicalJson = canonicalizeJson(manifest);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  return Object.freeze({ canonicalJson, text, sha256: sha256Hex(Buffer.from(text, "utf8")) });
}

function parseArtifactManifest(input, parsedVersionIdentity, expectedEdition, label = MANIFEST_FILE) {
  let value;
  try {
    value = parseStrictJson(input, label, MAX_MANIFEST_BYTES);
  } catch (error) {
    throw new ArtifactManifestError("INVALID_MANIFEST", `${label} is not a valid strict manifest.`, { cause: error });
  }
  expectExactKeys(value, MANIFEST_FIELDS, label);
  const expectedScalars = {
    manifestVersion: parsedVersionIdentity.identity.buildManifestVersion,
    productId: parsedVersionIdentity.identity.productId,
    productVersion: parsedVersionIdentity.identity.productVersion,
    apiVersion: parsedVersionIdentity.identity.apiVersion,
    licenseProtocolVersion: parsedVersionIdentity.identity.licenseProtocolVersion,
    nodeVersion: parsedVersionIdentity.identity.nodeVersion,
    versionIdentitySha256: parsedVersionIdentity.sha256,
  };
  for (const [field, expected] of Object.entries(expectedScalars)) {
    if (value[field] !== expected) {
      throw new ArtifactManifestError("MANIFEST_IDENTITY_MISMATCH", `${label}.${field} does not match version.json.`);
    }
  }
  const edition = parseBuildEdition(value.edition, parsedVersionIdentity.identity, `${label}.edition`);
  if (edition !== expectedEdition) {
    throw new ArtifactManifestError(
      "MANIFEST_EDITION_MISMATCH",
      `${label} edition ${edition} does not match expected ${expectedEdition}.`
    );
  }
  assertSha256(value.buildIdentitySha256, `${label}.buildIdentitySha256`);
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new ArtifactManifestError("INVALID_MANIFEST", `${label}.files must be a non-empty array.`);
  }
  let previousPath = "";
  const exactPaths = new Set();
  const caseFoldedPaths = new Set();
  const files = value.files.map((entry, index) => {
    expectExactKeys(entry, FILE_FIELDS, `${label}.files[${index}]`);
    const relativePath = validateRelativePath(entry.path, `${label}.files[${index}].path`);
    if (relativePath === MANIFEST_FILE || relativePath === MANIFEST_HASH_FILE) {
      throw new ArtifactManifestError("MANIFEST_SELF_REFERENCE", `${relativePath} cannot appear in its own file closure.`);
    }
    if (previousPath && previousPath.localeCompare(relativePath, "en") >= 0) {
      throw new ArtifactManifestError("UNSORTED_MANIFEST", `${label}.files must be strictly sorted by path.`);
    }
    previousPath = relativePath;
    if (exactPaths.has(relativePath)) {
      throw new ArtifactManifestError("DUPLICATE_ARTIFACT_PATH", `Duplicate artifact path: ${relativePath}.`);
    }
    exactPaths.add(relativePath);
    const folded = relativePath.toLocaleLowerCase("en-US");
    if (caseFoldedPaths.has(folded)) {
      throw new ArtifactManifestError("WINDOWS_PATH_COLLISION", `Windows path collision: ${relativePath}.`);
    }
    caseFoldedPaths.add(folded);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new ArtifactManifestError("INVALID_MANIFEST", `${relativePath} has an invalid size.`);
    }
    const digest = assertSha256(entry.sha256, `${relativePath}.sha256`);
    return deepFreeze({ path: relativePath, size: entry.size, sha256: digest });
  });
  return deepFreeze({ ...expectedScalars, buildIdentitySha256: value.buildIdentitySha256, edition, files });
}

function verifyArtifact(rootPath, parsedVersionIdentity, expectedEdition) {
  const root = path.resolve(rootPath);
  const manifestPath = path.join(root, MANIFEST_FILE);
  const hashPath = path.join(root, MANIFEST_HASH_FILE);
  let manifestBytes;
  let sidecarBytes;
  let buildIdentityBytes;
  try {
    manifestBytes = readFileBounded(manifestPath, manifestPath, MAX_MANIFEST_BYTES);
    sidecarBytes = readFileBounded(hashPath, hashPath, 256);
    buildIdentityBytes = readFileBounded(
      path.join(root, BUILD_IDENTITY_FILE),
      path.join(root, BUILD_IDENTITY_FILE),
      MAX_IDENTITY_BYTES
    );
  } catch (error) {
    throw new ArtifactManifestError("ARTIFACT_CONTROL_READ_FAILED", "Artifact control file cannot be read safely.", {
      cause: error,
    });
  }
  const actualManifestSha256 = sha256Hex(manifestBytes);
  const sidecar = sidecarBytes.toString("utf8");
  const expectedSidecar = `${actualManifestSha256}  ${MANIFEST_FILE}\n`;
  if (sidecar !== expectedSidecar) {
    throw new ArtifactManifestError("MANIFEST_HASH_MISMATCH", `${MANIFEST_HASH_FILE} does not match ${MANIFEST_FILE}.`);
  }
  const manifest = parseArtifactManifest(manifestBytes, parsedVersionIdentity, expectedEdition, manifestPath);

  const artifactVersionIdentity = require("./version-identity.cjs").loadVersionIdentity(path.join(root, VERSION_IDENTITY_FILE));
  if (artifactVersionIdentity.sha256 !== parsedVersionIdentity.sha256) {
    throw new ArtifactManifestError("VERSION_IDENTITY_MISMATCH", "Artifact version.json differs from the trusted canonical identity.");
  }
  const buildIdentity = parseBuildIdentity(
    buildIdentityBytes,
    parsedVersionIdentity,
    expectedEdition,
    path.join(root, BUILD_IDENTITY_FILE)
  );
  if (serializeBuildIdentity(buildIdentity).sha256 !== manifest.buildIdentitySha256) {
    throw new ArtifactManifestError("BUILD_IDENTITY_HASH_MISMATCH", "build-identity.json does not match the manifest identity digest.");
  }

  const actualFiles = closedWorldFiles(root);
  if (actualFiles.length !== manifest.files.length) {
    throw new ArtifactManifestError(
      "ARTIFACT_CLOSURE_MISMATCH",
      `Artifact contains ${actualFiles.length} files but the manifest lists ${manifest.files.length}.`
    );
  }
  for (let index = 0; index < manifest.files.length; index += 1) {
    const expected = manifest.files[index];
    const actual = actualFiles[index];
    if (actual.relativePath !== expected.path || actual.size !== expected.size) {
      throw new ArtifactManifestError("ARTIFACT_CLOSURE_MISMATCH", `Artifact file closure differs at ${expected.path}.`);
    }
    if (hashFile(actual.absolutePath, actual.size) !== expected.sha256) {
      throw new ArtifactManifestError("ARTIFACT_HASH_MISMATCH", `Artifact file hash differs at ${expected.path}.`);
    }
  }
  return deepFreeze({
    root,
    edition: buildIdentity.edition,
    buildIdentity,
    manifest,
    manifestSha256: actualManifestSha256,
  });
}

module.exports = Object.freeze({
  ArtifactManifestError,
  BUILD_IDENTITY_FILE,
  MANIFEST_FILE,
  MANIFEST_HASH_FILE,
  VERSION_IDENTITY_FILE,
  createArtifactManifest,
  listArtifactFiles,
  parseArtifactManifest,
  serializeArtifactManifest,
  verifyArtifact,
});
