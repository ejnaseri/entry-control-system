"use strict";

const { createHash } = require("node:crypto");
const { closeSync, fstatSync, openSync, readSync } = require("node:fs");

const MAX_IDENTITY_BYTES = 16 * 1024;
const EXPECTED_FIELDS = Object.freeze([
  "apiVersion",
  "buildManifestVersion",
  "licenseProtocolVersion",
  "nodeVersion",
  "productId",
  "productVersion",
  "schemaVersion",
  "supportedEditions",
]);
const SUPPORTED_EDITIONS = Object.freeze(["FULL", "ATTENDANCE"]);
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

class VersionIdentityError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "VersionIdentityError";
    this.code = code;
  }
}

class StrictJsonParser {
  constructor(source, label) {
    this.source = source;
    this.label = label;
    this.index = 0;
  }

  fail(message) {
    throw new VersionIdentityError(
      "INVALID_JSON",
      `${this.label} is not strict JSON at character ${this.index}: ${message}`
    );
  }

  peek() {
    return this.source[this.index];
  }

  skipWhitespace() {
    while (/\s/u.test(this.peek() ?? "") && /[\u0009\u000a\u000d\u0020]/u.test(this.peek() ?? "")) {
      this.index += 1;
    }
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.source.length) this.fail("trailing data is forbidden");
    return value;
  }

  parseValue(depth) {
    if (depth > 32) this.fail("nesting is too deep");
    const token = this.peek();
    if (token === "{") return this.parseObject(depth + 1);
    if (token === "[") return this.parseArray(depth + 1);
    if (token === "\"") return this.parseString();
    if (token === "t") return this.parseLiteral("true", true);
    if (token === "f") return this.parseLiteral("false", false);
    if (token === "n") return this.parseLiteral("null", null);
    if (token === "-" || (token !== undefined && token >= "0" && token <= "9")) return this.parseNumber();
    this.fail("expected a JSON value");
  }

  parseObject(depth) {
    this.index += 1;
    this.skipWhitespace();
    const result = Object.create(null);
    const keys = new Set();
    if (this.peek() === "}") {
      this.index += 1;
      return result;
    }
    while (this.index < this.source.length) {
      if (this.peek() !== "\"") this.fail("object keys must be strings");
      const key = this.parseString();
      if (keys.has(key)) this.fail(`duplicate object key ${JSON.stringify(key)} is forbidden`);
      keys.add(key);
      this.skipWhitespace();
      if (this.peek() !== ":") this.fail("expected ':' after object key");
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue(depth);
      this.skipWhitespace();
      if (this.peek() === "}") {
        this.index += 1;
        return result;
      }
      if (this.peek() !== ",") this.fail("expected ',' or '}' in object");
      this.index += 1;
      this.skipWhitespace();
    }
    this.fail("unterminated object");
  }

  parseArray(depth) {
    this.index += 1;
    this.skipWhitespace();
    const result = [];
    if (this.peek() === "]") {
      this.index += 1;
      return result;
    }
    while (this.index < this.source.length) {
      result.push(this.parseValue(depth));
      this.skipWhitespace();
      if (this.peek() === "]") {
        this.index += 1;
        return result;
      }
      if (this.peek() !== ",") this.fail("expected ',' or ']' in array");
      this.index += 1;
      this.skipWhitespace();
    }
    this.fail("unterminated array");
  }

  parseString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      const character = this.source[this.index];
      if (!escaped && character === "\"") {
        this.index += 1;
        const token = this.source.slice(start, this.index);
        let value;
        try {
          value = JSON.parse(token);
        } catch (error) {
          this.fail(`invalid string escape (${error instanceof Error ? error.message : String(error)})`);
        }
        for (let offset = 0; offset < value.length; offset += 1) {
          const unit = value.charCodeAt(offset);
          if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(offset + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) this.fail("unpaired UTF-16 surrogate is forbidden");
            offset += 1;
          } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            this.fail("unpaired UTF-16 surrogate is forbidden");
          }
        }
        return value;
      }
      if (!escaped && code < 0x20) this.fail("unescaped control character in string");
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
      this.index += 1;
    }
    this.fail("unterminated string");
  }

  parseNumber() {
    const remainder = this.source.slice(this.index);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(remainder);
    if (!match) this.fail("invalid number");
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.fail("non-finite number is forbidden");
    return value;
  }

  parseLiteral(token, value) {
    if (!this.source.startsWith(token, this.index)) this.fail(`invalid literal; expected ${token}`);
    this.index += token.length;
    return value;
  }
}

function decodeUtf8Strict(input, label, maxBytes = MAX_IDENTITY_BYTES) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (bytes.length === 0) throw new VersionIdentityError("EMPTY_FILE", `${label} is empty.`);
  if (bytes.length > maxBytes) {
    throw new VersionIdentityError("FILE_TOO_LARGE", `${label} exceeds ${maxBytes} bytes.`);
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new VersionIdentityError("INVALID_ENCODING", `${label} must not contain a UTF-8 BOM.`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new VersionIdentityError("INVALID_ENCODING", `${label} must contain valid UTF-8.`, { cause: error });
  }
}

function parseStrictJson(input, label = "JSON document", maxBytes = MAX_IDENTITY_BYTES) {
  const source = decodeUtf8Strict(input, label, maxBytes);
  return new StrictJsonParser(source, label).parse();
}

function readFileBounded(filePath, label = filePath, maxBytes = MAX_IDENTITY_BYTES) {
  let descriptor;
  try {
    descriptor = openSync(filePath, "r");
    const before = fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`${label} is not a regular file.`);
    if (!Number.isSafeInteger(before.size) || before.size > maxBytes) {
      throw new VersionIdentityError("FILE_TOO_LARGE", `${label} exceeds ${maxBytes} bytes.`);
    }
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(descriptor, bytes, offset, bytes.length - offset, null);
      if (count === 0) {
        throw new VersionIdentityError("FILE_CHANGED", `${label} changed while it was being read.`);
      }
      offset += count;
    }
    const extra = Buffer.allocUnsafe(1);
    if (readSync(descriptor, extra, 0, 1, null) !== 0) {
      throw new VersionIdentityError("FILE_CHANGED", `${label} changed while it was being read.`);
    }
    const after = fstatSync(descriptor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new VersionIdentityError("FILE_CHANGED", `${label} changed while it was being read.`);
    }
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalizeJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new VersionIdentityError("INVALID_CANONICAL_VALUE", "Cannot canonicalize a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(",")}}`;
  }
  throw new VersionIdentityError("INVALID_CANONICAL_VALUE", `Cannot canonicalize ${typeof value}.`);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function expectExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new VersionIdentityError(
      "INVALID_SCHEMA",
      `${label} must contain exactly these fields: ${wanted.join(", ")}; received: ${actual.join(", ") || "(none)"}.`
    );
  }
}

function expectInteger(value, expected, field) {
  if (!Number.isSafeInteger(value) || value !== expected) {
    throw new VersionIdentityError("UNSUPPORTED_IDENTITY", `${field} must be the supported value ${expected}.`);
  }
}

function expectExactString(value, expected, field) {
  if (typeof value !== "string" || value !== expected) {
    throw new VersionIdentityError("UNSUPPORTED_IDENTITY", `${field} must be exactly ${JSON.stringify(expected)}.`);
  }
}

function validateSemver(value, field) {
  if (typeof value !== "string" || value.length > 64 || !SEMVER_PATTERN.test(value)) {
    throw new VersionIdentityError("INVALID_SCHEMA", `${field} must be a canonical SemVer string.`);
  }
}

function parseVersionIdentityValue(value, label = "version identity") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new VersionIdentityError("INVALID_SCHEMA", `${label} root must be an object.`);
  }
  expectExactKeys(value, EXPECTED_FIELDS, label);
  expectInteger(value.schemaVersion, 1, "schemaVersion");
  expectExactString(value.productId, "ENTRY_CONTROL_SYSTEM", "productId");
  validateSemver(value.productVersion, "productVersion");
  expectExactString(value.apiVersion, "v1", "apiVersion");
  expectInteger(value.licenseProtocolVersion, 1, "licenseProtocolVersion");
  expectInteger(value.buildManifestVersion, 1, "buildManifestVersion");
  validateSemver(value.nodeVersion, "nodeVersion");
  if (
    !Array.isArray(value.supportedEditions)
    || value.supportedEditions.length !== SUPPORTED_EDITIONS.length
    || value.supportedEditions.some((edition, index) => edition !== SUPPORTED_EDITIONS[index])
  ) {
    throw new VersionIdentityError(
      "INVALID_SCHEMA",
      `supportedEditions must be exactly ${JSON.stringify(SUPPORTED_EDITIONS)} in canonical order.`
    );
  }
  return deepFreeze({
    schemaVersion: value.schemaVersion,
    productId: value.productId,
    productVersion: value.productVersion,
    apiVersion: value.apiVersion,
    licenseProtocolVersion: value.licenseProtocolVersion,
    buildManifestVersion: value.buildManifestVersion,
    supportedEditions: [...value.supportedEditions],
    nodeVersion: value.nodeVersion,
  });
}

function parseVersionIdentity(input, label = "version identity") {
  const parsed = parseStrictJson(input, label);
  const identity = parseVersionIdentityValue(parsed, label);
  const canonicalJson = canonicalizeJson(identity);
  return deepFreeze({ identity, canonicalJson, sha256: sha256Hex(canonicalJson) });
}

function loadVersionIdentity(filePath) {
  let bytes;
  try {
    bytes = readFileBounded(filePath, filePath, MAX_IDENTITY_BYTES);
  } catch (error) {
    if (error instanceof VersionIdentityError) throw error;
    throw new VersionIdentityError(
      "IDENTITY_READ_FAILED",
      `Cannot read canonical version identity at ${filePath}.`,
      { cause: error }
    );
  }
  return parseVersionIdentity(bytes, filePath);
}

function parseBuildEdition(value, identity, label = "build edition") {
  if (typeof value !== "string" || !identity.supportedEditions.includes(value)) {
    throw new VersionIdentityError(
      "INVALID_EDITION",
      `${label} must be one of ${identity.supportedEditions.join(" or ")} with exact casing; received ${JSON.stringify(value)}.`
    );
  }
  return value;
}

function assertSha256(value, field = "sha256") {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new VersionIdentityError("INVALID_SCHEMA", `${field} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

function assertNodeVersion(identity, actualVersion = process.versions.node) {
  if (actualVersion !== identity.nodeVersion) {
    throw new VersionIdentityError(
      "NODE_VERSION_MISMATCH",
      `This release gate requires Node ${identity.nodeVersion}; current Node is ${actualVersion}.`
    );
  }
}

module.exports = Object.freeze({
  MAX_IDENTITY_BYTES,
  SEMVER_PATTERN,
  SHA256_PATTERN,
  SUPPORTED_EDITIONS,
  VersionIdentityError,
  assertNodeVersion,
  assertSha256,
  canonicalizeJson,
  deepFreeze,
  loadVersionIdentity,
  parseBuildEdition,
  readFileBounded,
  parseStrictJson,
  parseVersionIdentity,
  parseVersionIdentityValue,
  sha256Hex,
});
