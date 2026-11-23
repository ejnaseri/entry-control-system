"use strict";

const {
  assertSha256,
  canonicalizeJson,
  deepFreeze,
  parseBuildEdition,
  parseStrictJson,
  sha256Hex,
} = require("./version-identity.cjs");

const BUILD_IDENTITY_FIELDS = Object.freeze([
  "apiVersion",
  "buildManifestVersion",
  "edition",
  "licenseProtocolVersion",
  "nodeVersion",
  "productId",
  "productVersion",
  "schemaVersion",
  "versionIdentitySha256",
]);

class BuildIdentityError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "BuildIdentityError";
    this.code = code;
  }
}

function expectExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new BuildIdentityError(
      "INVALID_BUILD_IDENTITY",
      `${label} must contain exactly these fields: ${wanted.join(", ")}; received: ${actual.join(", ") || "(none)"}.`
    );
  }
}

function createBuildIdentity(parsedVersionIdentity, editionSource) {
  const { identity, sha256 } = parsedVersionIdentity;
  const edition = parseBuildEdition(editionSource, identity);
  return deepFreeze({
    schemaVersion: identity.schemaVersion,
    productId: identity.productId,
    productVersion: identity.productVersion,
    apiVersion: identity.apiVersion,
    licenseProtocolVersion: identity.licenseProtocolVersion,
    buildManifestVersion: identity.buildManifestVersion,
    nodeVersion: identity.nodeVersion,
    versionIdentitySha256: sha256,
    edition,
  });
}

function assertBuildIdentityMatchesVersion(value, parsedVersionIdentity, expectedEdition, label = "build identity") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BuildIdentityError("INVALID_BUILD_IDENTITY", `${label} root must be an object.`);
  }
  expectExactKeys(value, BUILD_IDENTITY_FIELDS, label);
  const expected = createBuildIdentity(parsedVersionIdentity, expectedEdition ?? value.edition);
  for (const field of BUILD_IDENTITY_FIELDS) {
    if (field === "edition") continue;
    if (value[field] !== expected[field]) {
      throw new BuildIdentityError(
        "BUILD_IDENTITY_MISMATCH",
        `${label} ${field} does not match canonical version.json.`
      );
    }
  }
  assertSha256(value.versionIdentitySha256, `${label}.versionIdentitySha256`);
  const edition = parseBuildEdition(value.edition, parsedVersionIdentity.identity, `${label}.edition`);
  if (expectedEdition !== undefined && edition !== expectedEdition) {
    throw new BuildIdentityError(
      "BUILD_EDITION_MISMATCH",
      `${label} edition ${edition} does not match expected edition ${expectedEdition}.`
    );
  }
  return deepFreeze({ ...expected, edition });
}

function parseBuildIdentity(input, parsedVersionIdentity, expectedEdition, label = "build identity") {
  let parsed;
  try {
    parsed = parseStrictJson(input, label);
  } catch (error) {
    throw new BuildIdentityError("INVALID_BUILD_IDENTITY", `${label} is invalid.`, { cause: error });
  }
  return assertBuildIdentityMatchesVersion(parsed, parsedVersionIdentity, expectedEdition, label);
}

function serializeBuildIdentity(identity) {
  const canonical = canonicalizeJson(identity);
  return Object.freeze({ canonicalJson: canonical, sha256: sha256Hex(canonical), text: `${JSON.stringify(identity, null, 2)}\n` });
}

module.exports = Object.freeze({
  BUILD_IDENTITY_FIELDS,
  BuildIdentityError,
  assertBuildIdentityMatchesVersion,
  createBuildIdentity,
  parseBuildIdentity,
  serializeBuildIdentity,
});
