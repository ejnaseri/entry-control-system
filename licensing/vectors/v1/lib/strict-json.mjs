// TEST_ONLY_DO_NOT_TRUST: strict duplicate-key rejecting JSON loader shared by
// the Node golden-vector consumer only.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const libraryDirectory = path.dirname(fileURLToPath(import.meta.url));
const versionContract = require(path.resolve(libraryDirectory, "..", "..", "..", "..", "scripts", "lib", "version-identity.cjs"));

export function parseStrictPrettyJson(bytes, label, maximumBytes = 16 * 1024 * 1024) {
  const input = Buffer.from(bytes);
  const value = versionContract.parseStrictJson(input, label, maximumBytes);
  const expected = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "ascii");
  if (!expected.equals(input)) throw new Error(`${label} is not canonical pretty ASCII JSON with one final LF.`);
  return value;
}
