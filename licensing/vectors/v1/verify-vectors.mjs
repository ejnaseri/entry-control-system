#!/usr/bin/env node
// Independent Node consumer for LIC-6.2-002. Its import graph is deliberately
// isolated from the Vendor issuer, fixture builder, RFC6979 signer and private
// TEST_ONLY key derivation.

import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FROZEN_PROTOCOL_MANIFEST_SHA256,
  SIGNED_TYPE_CONTRACTS,
  exactMediaType,
  independentRejectResult,
  independentSha256Hex,
  independentlyVerifyCarrier,
  independentlyVerifySignedObject,
} from "./node-verifier/cose-verifier.mjs";
import { NodeVectorFailure } from "./node-verifier/errors.mjs";
import { runIndependentCborOrderingSelfTest } from "./node-verifier/strict-cbor.mjs";
import { jsonDeepEqual, parseStrictPrettyJson } from "./node-verifier/strict-json.mjs";

const packageSourceRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageSourceRoot, "..", "..", "..");
const REPORT_KIND = "ENTRY_CONTROL_GOLDEN_VECTORS_V1";
const signedTypes = Object.freeze(Object.keys(SIGNED_TYPE_CONTRACTS));
const basePositiveByType = Object.freeze({
  "activation-request": "pos-activation-activate-tpm",
  "lease-request": "pos-lease-request-check-in",
  "key-delegation": "pos-delegation-offline-entitlement",
  "key-denylist": "pos-denylist-revision-1",
  entitlement: "pos-entitlement-initial-offline",
  lease: "pos-lease-initial-control",
  "offline-control": "pos-control-vendor-suspend",
  "reactivation-authorization": "pos-reactivation-authorization",
  recovery: "pos-recovery-clear-tamper",
  "time-correction": "pos-time-correction",
});
const malformedSourceRelative = "../../protocol/v1/corpus/malformed-cases.json";
const crossSourceRelative = "../../protocol/v1/corpus/cross-type-cases.json";
const positiveVariantById = Object.freeze({
  "pos-activation-activate-full": "ACTIVATE_FULL_SOFTWARE_BOUND",
  "pos-activation-activate-tpm": "ACTIVATE_TPM_ATTESTED",
  "pos-activation-control": "CONTROL_NON_INITIAL",
  "pos-activation-reactivate": "REACTIVATE",
  "pos-activation-rebind": "REBIND_NEW_DEVICE_PROOF",
  "pos-activation-recover": "RECOVER",
  "pos-activation-renew": "RENEW_SOFTWARE_BOUND",
  "pos-activation-time-correct": "TIME_CORRECT",
  "pos-carrier-lease-challenge": "STANDARD",
  "pos-carrier-lease-response-complete": "WITH_LEASE",
  "pos-carrier-lease-response-control-only": "CONTROL_ONLY",
  "pos-carrier-lease-response-reactivation-only": "REACTIVATION_ONLY",
  "pos-carrier-lease-response-time-recovery": "WITH_LEASE",
  "pos-carrier-trust-bundle": "STANDARD",
  "pos-control-request-unsuspend": "REQUEST_BOUND_UNSUSPEND",
  "pos-control-vendor-revoke": "VENDOR_INITIATED_REVOKE",
  "pos-control-vendor-suspend": "VENDOR_INITIATED_SUSPEND",
  "pos-delegation-offline-control": "OFFLINE_CONTROL",
  "pos-delegation-offline-entitlement": "OFFLINE_ENTITLEMENT",
  "pos-delegation-online-lease": "ONLINE_LEASE",
  "pos-delegation-recovery": "RECOVERY",
  "pos-denylist-revision-1": "REVISION_1",
  "pos-denylist-revision-2": "REVISION_2_WITH_PREDECESSOR",
  "pos-entitlement-initial-full": "GENERATION_1_FULL",
  "pos-entitlement-initial-hybrid": "GENERATION_1_HYBRID",
  "pos-entitlement-initial-offline": "GENERATION_1_OFFLINE",
  "pos-entitlement-reactivated": "GENERATION_1_REACTIVATED",
  "pos-entitlement-renewal": "GENERATION_2_RENEWAL",
  "pos-lease-full": "ACTIVE_FULL",
  "pos-lease-initial-control": "INITIAL_CONTROL_TUPLE",
  "pos-lease-positive-control": "POSITIVE_SUSPENDED_CONTROL_TUPLE",
  "pos-lease-rebind-reference": "ACTIVE_REBIND_REFERENCE",
  "pos-lease-request-check-in": "CHECK_IN",
  "pos-lease-request-check-in-full": "CHECK_IN_FULL",
  "pos-lease-request-check-in-rebind": "CHECK_IN_WITH_REBIND_REFERENCE",
  "pos-lease-request-time-recovery": "TIME_RECOVERY",
  "pos-reactivation-authorization": "TERMINAL_LINEAGE_REPLACEMENT",
  "pos-recovery-clear-tamper": "CLEAR_TAMPER",
  "pos-recovery-rebind-device": "REBIND_DEVICE",
  "pos-recovery-repair-state": "REPAIR_SECURE_STATE",
  "pos-time-correction": "OFFLINE_TIME_CORRECTION",
});
const negativeSignerOverrideById = Object.freeze({
  "neg-denied-signer": "TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED",
  "neg-signature-before-denied": "TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED",
  "neg-signature-before-wrong-environment": "TEST_ONLY_RECOVERY_WRONG_ENV",
  "neg-signature-before-wrong-purpose": "TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY",
  "neg-unknown-signer": "TEST_ONLY_UNKNOWN_SIGNER",
  "neg-wrong-environment": "TEST_ONLY_RECOVERY_WRONG_ENV",
  "neg-wrong-purpose-signer": "TEST_ONLY_ONLINE_LEASE_PRIMARY",
});
const TEST_ONLY_KEY_DERIVATION = "ENTRY_CONTROL_SYSTEM:TEST_ONLY_DO_NOT_TRUST:GOLDEN_VECTOR_KEY:V1:<KEY_ID>";
const expectedKeyMetadata = Object.freeze([
  ["TEST_ONLY_INSTALLATION_DEVICE_PRIMARY", "INSTALLATION_DEVICE", "TEST", "TRUSTED", "ef9fce3f9d262700ed4b60613ff2934ac45a42c23515f299eb53cf736451b4f2", "keys/test-only-installation-device-primary.spki.der"],
  ["TEST_ONLY_INSTALLATION_DEVICE_REBIND", "INSTALLATION_DEVICE", "TEST", "TRUSTED", "f0aebcce6bc4ab356184ca15bad68e04d731a11717bdeb0cf4988e752b536831", "keys/test-only-installation-device-rebind.spki.der"],
  ["TEST_ONLY_INSTALLATION_DEVICE_WRONG_ENV", "INSTALLATION_DEVICE", "DEVELOPMENT", "WRONG_ENVIRONMENT", "234325dfdc63d4c2443b448a264b64a907d806943cd2fe51f5e5a24a9645de6e", "keys/test-only-installation-device-wrong-env.spki.der"],
  ["TEST_ONLY_OFFLINE_CONTROL_DENIED", "OFFLINE_CONTROL", "TEST", "DENIED", "db360932782c99c15cc4bac0e58405cce3177b5c5a8cfbc14059c2a550879ca7", "keys/test-only-offline-control-denied.spki.der"],
  ["TEST_ONLY_OFFLINE_CONTROL_PRIMARY", "OFFLINE_CONTROL", "TEST", "TRUSTED", "35b837f91f24f52e936f60fbb6a2867c4cfd3fc304eb5528a089b82894eacec5", "keys/test-only-offline-control-primary.spki.der"],
  ["TEST_ONLY_OFFLINE_CONTROL_WRONG_ENV", "OFFLINE_CONTROL", "DEVELOPMENT", "WRONG_ENVIRONMENT", "472107d496fad7d7c62696007ce4bd15804dc01474f1e0e15d1d99cec09c919f", "keys/test-only-offline-control-wrong-env.spki.der"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED", "OFFLINE_ENTITLEMENT", "TEST", "DENIED", "8c3d78979c8234f3c25dac0f4a90c4ca58c5968342fba6a7d1ee214c8967d39f", "keys/test-only-offline-entitlement-denied.spki.der"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY", "OFFLINE_ENTITLEMENT", "TEST", "TRUSTED", "d96b73d9ac38d266561cb341db6fac515a1c2770738f403e40e6c18bf2524390", "keys/test-only-offline-entitlement-primary.spki.der"],
  ["TEST_ONLY_OFFLINE_ENTITLEMENT_WRONG_ENV", "OFFLINE_ENTITLEMENT", "DEVELOPMENT", "WRONG_ENVIRONMENT", "1f1b21e26d138bad00a23c002cf3bbbacf5a57c4ff47779645eaa089285f8168", "keys/test-only-offline-entitlement-wrong-env.spki.der"],
  ["TEST_ONLY_ONLINE_LEASE_DENIED", "ONLINE_LEASE", "TEST", "DENIED", "f68bf6ef3be988a755b6554afa58c16e5b30ade98cd011b37b8a0c5d140927ab", "keys/test-only-online-lease-denied.spki.der"],
  ["TEST_ONLY_ONLINE_LEASE_PRIMARY", "ONLINE_LEASE", "TEST", "TRUSTED", "a791a86a7fb134124e650ca721371956be8c10c62c61586039e401af66472901", "keys/test-only-online-lease-primary.spki.der"],
  ["TEST_ONLY_ONLINE_LEASE_WRONG_ENV", "ONLINE_LEASE", "DEVELOPMENT", "WRONG_ENVIRONMENT", "e46f8ad2a8b1f242c7dd0fcbcaf29ca002eafc6c1f7445dd2addcea816d6d323", "keys/test-only-online-lease-wrong-env.spki.der"],
  ["TEST_ONLY_PROD_ROOT_PRIMARY", "PROD_ROOT", "TEST", "TRUSTED", "b7031d52e0c9ce893d72da28d80826840604bbb02fee27eaeef220b045c0c913", "keys/test-only-prod-root-primary.spki.der"],
  ["TEST_ONLY_PROD_ROOT_WRONG_ENV", "PROD_ROOT", "DEVELOPMENT", "WRONG_ENVIRONMENT", "a1de343295e68f7afd00cff7b0312d28beec2a0e222d41f40be5e079da97763a", "keys/test-only-prod-root-wrong-env.spki.der"],
  ["TEST_ONLY_RECOVERY_DENIED", "RECOVERY", "TEST", "DENIED", "1cadb092a565d1590b1129357176952d47aadae3d7d01a7f68ba65fa92492c9d", "keys/test-only-recovery-denied.spki.der"],
  ["TEST_ONLY_RECOVERY_PRIMARY", "RECOVERY", "TEST", "TRUSTED", "0f19208a68826aef5342a18e1a2afef8d7016eee3a7faff8c119900de9d1ac71", "keys/test-only-recovery-primary.spki.der"],
  ["TEST_ONLY_RECOVERY_WRONG_ENV", "RECOVERY", "DEVELOPMENT", "WRONG_ENVIRONMENT", "71364084d288d9247970532568062d0b85d79b17f92d06e629a47ac0c98b56b8", "keys/test-only-recovery-wrong-env.spki.der"],
  ["TEST_ONLY_UNKNOWN_SIGNER", "UNKNOWN", "TEST", "UNKNOWN", "514bad918a390bde4b41598dc5e2ed959f96a8bd983c8e5b55c2f5cf99aa1464", "keys/test-only-unknown-signer.spki.der"],
].map(([keyId, purpose, environment, trustClass, kidHex, spkiPath]) => Object.freeze({ keyId, purpose, environment, trustClass, kidHex, spkiPath })));
const expectedKeyById = new Map(expectedKeyMetadata.map((record) => [record.keyId, record]));
const carrierContractById = Object.freeze({
  "pos-carrier-lease-challenge": ["lease-challenge", "STANDARD"],
  "pos-carrier-lease-response-complete": ["lease-response", "WITH_LEASE"],
  "pos-carrier-lease-response-control-only": ["lease-response", "CONTROL_ONLY"],
  "pos-carrier-lease-response-reactivation-only": ["lease-response", "REACTIVATION_ONLY"],
  "pos-carrier-lease-response-time-recovery": ["lease-response", "WITH_LEASE"],
  "pos-carrier-trust-bundle": ["trust-bundle", "STANDARD"],
});
const primarySignerByType = Object.freeze({
  "activation-request": "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY",
  "lease-request": "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY",
  "key-delegation": "TEST_ONLY_PROD_ROOT_PRIMARY",
  "key-denylist": "TEST_ONLY_PROD_ROOT_PRIMARY",
  entitlement: "TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY",
  lease: "TEST_ONLY_ONLINE_LEASE_PRIMARY",
  "offline-control": "TEST_ONLY_OFFLINE_CONTROL_PRIMARY",
  "reactivation-authorization": "TEST_ONLY_OFFLINE_CONTROL_PRIMARY",
  recovery: "TEST_ONLY_RECOVERY_PRIMARY",
  "time-correction": "TEST_ONLY_RECOVERY_PRIMARY",
});

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(actual.length === expected.length && actual.every((key, index) => key === expected[index]), `${label} fields differ.`);
}

function reportEntry(id, actual) {
  return {
    id,
    decision: actual.decision,
    stage: actual.stage,
    errorCode: actual.errorCode,
    inputSha256: actual.inputSha256,
    protectedSha256: actual.protectedSha256,
    payloadSha256: actual.payloadSha256,
    sigStructureSha256: actual.sigStructureSha256,
    signerKeyIdHex: actual.signerKeyIdHex,
  };
}

function expectedPositiveSignerId(record) {
  if (["pos-activation-rebind", "pos-lease-request-check-in-rebind"].includes(record.id)) return "TEST_ONLY_INSTALLATION_DEVICE_REBIND";
  return primarySignerByType[record.tokenType];
}

function carrierMediaType(carrierType) {
  return `application/vnd.entry-control.${carrierType}+cbor;v=1`;
}

function canonicalCliPath(value, label) {
  if (!path.isAbsolute(value)) fail(`${label} requires an absolute path.`);
  if (process.platform === "win32" && !/^[a-z]:[\\/]/iu.test(value)) {
    fail(`${label} requires a canonical local drive path; UNC and extended/device namespaces are forbidden.`);
  }
  return path.resolve(value);
}

function parseArguments(args) {
  let vectors;
  let report;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value) fail(`Missing value for ${flag ?? "argument"}.`);
    if (flag === "--vectors" && vectors === undefined) vectors = canonicalCliPath(value, flag);
    else if (flag === "--report" && report === undefined) report = canonicalCliPath(value, flag);
    else fail(`Unknown or duplicate argument ${flag}.`);
  }
  if (!vectors) fail("Usage: verify-vectors.mjs --vectors <absolute-package-root> [--report <absolute-output>]");
  return { vectors, report };
}

function safeRelativePath(value, label) {
  assert(typeof value === "string" && value.length > 0 && value.length <= 300, `${label} path is invalid.`);
  assert(!value.includes("\\") && !value.includes(":") && !value.startsWith("/"), `${label} path is not canonical.`);
  assert(/^[a-z0-9][a-z0-9._/-]*$/.test(value), `${label} path is not canonical lowercase ASCII.`);
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  assert(value.split("/").every((segment) => segment && segment !== "." && segment !== ".." && !segment.endsWith(".") && !segment.endsWith(" ") && !reserved.test(segment)), `${label} path escapes package or uses a Windows alias/device name.`);
  return value;
}

function insideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function createReadRoot(rootPath, label) {
  const absolute = path.resolve(rootPath);
  const stats = lstatSync(absolute);
  assert(stats.isDirectory() && !stats.isSymbolicLink(), `${label} must be a real non-link directory.`);
  const real = realpathSync.native(absolute);
  assert(path.resolve(absolute).toLowerCase() === path.resolve(real).toLowerCase(), `${label} must not traverse a link/reparse point.`);
  return { absolute: real, real, label };
}

function resolvePackageRegularFile(root, relativePath, label) {
  const relative = safeRelativePath(relativePath, label);
  const segments = relative.split("/");
  let current = root.absolute;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stats = lstatSync(current);
    assert(!stats.isSymbolicLink(), `${label} traverses a link/reparse point.`);
    if (index < segments.length - 1) assert(stats.isDirectory(), `${label} parent component is not a directory.`);
    else assert(stats.isFile(), `${label} must be a regular file.`);
  }
  const real = realpathSync.native(current);
  assert(insideRoot(root.real, real), `${label} real path escapes ${root.label}.`);
  return current;
}

function readBoundedRegularFile(filePath, label, maximumBytes) {
  assert(Number.isSafeInteger(maximumBytes) && maximumBytes > 0, `${label} read bound is invalid.`);
  const before = lstatSync(filePath);
  assert(before.isFile() && !before.isSymbolicLink() && before.size > 0 && before.size <= maximumBytes, `${label} is not a bounded regular non-link file.`);
  const descriptor = openSync(filePath, "r");
  try {
    const opened = fstatSync(descriptor);
    assert(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size && opened.size <= maximumBytes, `${label} changed before bounded read.`);
    const bytes = readFileSync(descriptor);
    const afterRead = fstatSync(descriptor);
    assert(afterRead.dev === opened.dev && afterRead.ino === opened.ino && afterRead.size === opened.size && bytes.length === opened.size && bytes.length <= maximumBytes, `${label} changed during bounded read.`);
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}

function readPackageFile(root, relativePath, label, maximumBytes) {
  return readBoundedRegularFile(resolvePackageRegularFile(root, relativePath, label), label, maximumBytes);
}

function readIndexedFile(vectorsRoot, record, label, maximumBytes = 16 * 1024 * 1024) {
  const relative = safeRelativePath(record.path, `${label}.path`);
  const bytes = readPackageFile(vectorsRoot, relative, label, maximumBytes);
  assert(Number.isSafeInteger(record.bytes) && record.bytes === bytes.length, `${label} indexed byte length mismatch.`);
  assert(typeof record.sha256 === "string" && record.sha256 === independentSha256Hex(bytes), `${label} indexed SHA-256 mismatch.`);
  return bytes;
}

function loadStrictPackageJson(root, relativePath, label, maximumBytes) {
  const bytes = readPackageFile(root, relativePath, label, maximumBytes);
  return { bytes, value: parseStrictPrettyJson(bytes, label, maximumBytes) };
}

function validateNonLinkDirectoryChain(directoryPath, label) {
  const absolute = path.resolve(directoryPath);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  const rootStats = lstatSync(current);
  assert(rootStats.isDirectory() && !rootStats.isSymbolicLink(), `${label} filesystem root is not a real directory.`);
  const remainder = absolute.slice(parsed.root.length);
  for (const segment of remainder.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stats = lstatSync(current);
    assert(stats.isDirectory() && !stats.isSymbolicLink(), `${label} traverses a link/reparse point or non-directory.`);
  }
  const real = realpathSync.native(absolute);
  assert(path.resolve(absolute).toLowerCase() === path.resolve(real).toLowerCase(), `${label} traverses a link/reparse point.`);
  return real;
}

function writeReportCreateNew(reportPath, reportBytes, vectorsRoot) {
  const absolute = path.resolve(reportPath);
  const basename = path.basename(absolute);
  const pathTail = absolute.slice(path.parse(absolute).root.length);
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  assert(path.isAbsolute(reportPath) && basename.length > 0 && !pathTail.includes(":") && !basename.includes("\\") && !basename.includes("/") && !basename.endsWith(".") && !basename.endsWith(" ") && !reserved.test(basename), "Report path is not canonical or uses a Windows ADS/alias/device name.");
  assert(!insideRoot(vectorsRoot.absolute, absolute), "Report output must be outside the vector package root.");
  const parentReal = validateNonLinkDirectoryChain(path.dirname(absolute), "Report parent");
  assert(!insideRoot(vectorsRoot.real, parentReal), "Report output parent must be outside the vector package root.");
  assert(lstatSync(absolute, { throwIfNoEntry: false }) === undefined, "Report output already exists; create-new output is required.");
  writeFileSync(absolute, reportBytes, { flag: "wx", mode: 0o600 });
  const created = lstatSync(absolute);
  assert(created.isFile() && !created.isSymbolicLink() && created.size === reportBytes.length, "Created report is not the expected regular non-link file.");
}

function loadKeys(index, vectorsRoot) {
  assert(Array.isArray(index.keys) && index.keys.length === 18, "Index must contain exactly 18 isolated TEST_ONLY keys.");
  const byKid = new Map();
  const byId = new Map();
  const paths = new Set();
  for (let indexPosition = 0; indexPosition < index.keys.length; indexPosition += 1) {
    const record = index.keys[indexPosition];
    exactKeys(record, ["keyId", "purpose", "environment", "trustClass", "kidHex", "spkiPath", "spkiSha256"], `key ${record.keyId}`);
    assert(typeof record.keyId === "string" && record.keyId.startsWith("TEST_ONLY_") && !byId.has(record.keyId), "Key ID is missing TEST_ONLY isolation or duplicated.");
    assert(["TEST", "DEVELOPMENT"].includes(record.environment), `Invalid environment on ${record.keyId}.`);
    assert(["TRUSTED", "DENIED", "WRONG_ENVIRONMENT", "UNKNOWN"].includes(record.trustClass), `Invalid trust class on ${record.keyId}.`);
    assert(["PROD_ROOT", "INSTALLATION_DEVICE", "OFFLINE_ENTITLEMENT", "ONLINE_LEASE", "OFFLINE_CONTROL", "RECOVERY", "UNKNOWN"].includes(record.purpose), `Invalid purpose on ${record.keyId}.`);
    const pinned = expectedKeyMetadata[indexPosition];
    assert(pinned && expectedKeyById.get(record.keyId) === pinned, `Unexpected key/order ${record.keyId}.`);
    assert(record.keyId === pinned.keyId && record.purpose === pinned.purpose && record.environment === pinned.environment && record.trustClass === pinned.trustClass && record.kidHex === pinned.kidHex && record.spkiPath === pinned.spkiPath, `${record.keyId} differs from the independent TEST_ONLY trust registry.`);
    const spkiPath = safeRelativePath(record.spkiPath, `${record.keyId}.spkiPath`);
    assert(spkiPath.startsWith("keys/") && spkiPath.endsWith(".spki.der") && !paths.has(spkiPath), `Invalid or duplicate SPKI path on ${record.keyId}.`);
    paths.add(spkiPath);
    const spkiDer = readPackageFile(vectorsRoot, spkiPath, `${record.keyId} SPKI`, 91);
    assert(spkiDer.length === 91 && record.spkiSha256 === independentSha256Hex(spkiDer), `${record.keyId} SPKI length/hash mismatch.`);
    assert(record.kidHex === record.spkiSha256 && !byKid.has(record.kidHex), `${record.keyId} kid binding is invalid or duplicated.`);
    const key = { ...record, spkiDer };
    byKid.set(record.kidHex, key);
    byId.set(record.keyId, key);
  }
  assert(byId.size === expectedKeyMetadata.length && expectedKeyMetadata.every((record) => byId.has(record.keyId)), "TEST_ONLY key registry is incomplete.");
  return { byKid, byId };
}

function validateExpected(record, decision) {
  exactKeys(record.expected, ["decision", "stage", "errorCode"], `${record.id}.expected`);
  assert(record.expected.decision === decision, `${record.id} expected decision mismatch.`);
  assert(typeof record.expected.stage === "string" && record.expected.stage.length > 0, `${record.id} expected stage missing.`);
  assert(typeof record.expected.errorCode === "string" && record.expected.errorCode.length > 0, `${record.id} expected error code missing.`);
}

function validateBase(record, tokenType, positiveById, label) {
  const expectedBaseId = basePositiveByType[tokenType];
  assert(record.basePositiveId === expectedBaseId, `${label} basePositiveId mismatch.`);
  const base = positiveById.get(expectedBaseId);
  assert(base && base.record.kind === "SIGNED_OBJECT" && base.record.tokenType === tokenType, `${label} base type mismatch.`);
  assert(base.record.mediaType === exactMediaType(tokenType), `${label} base media type mismatch.`);
  assert(record.baseCosePath === base.record.path && record.baseCoseSha256 === base.record.sha256, `${label} base path/hash mismatch.`);
  return base;
}

function validateProtocolCorpora(protocolMalformed, protocolCross) {
  const malformed = protocolMalformed.value;
  const cross = protocolCross.value;
  exactKeys(malformed, ["schemaVersion", "corpusKind", "protocolVersion", "signedTypes", "expectedCaseCount", "cases"], "source malformed corpus");
  exactKeys(cross, ["schemaVersion", "corpusKind", "protocolVersion", "signedTypeCount", "expectedOrderedPairCount", "signedTypes", "cases"], "source cross-type corpus");
  assert(malformed.schemaVersion === 1 && malformed.protocolVersion === 1 && malformed.corpusKind === "descriptor-based-negative-corpus" && malformed.expectedCaseCount === 224 && Array.isArray(malformed.signedTypes) && Array.isArray(malformed.cases), "Source malformed corpus envelope mismatch.");
  assert(cross.schemaVersion === 1 && cross.protocolVersion === 1 && cross.corpusKind === "ordered-cross-type-negative-corpus" && cross.signedTypeCount === 10 && cross.expectedOrderedPairCount === 90 && Array.isArray(cross.signedTypes) && Array.isArray(cross.cases), "Source cross-type corpus envelope mismatch.");
  assert(malformed.signedTypes.length === signedTypes.length && cross.signedTypes.length === signedTypes.length, "Source signed-type registry count mismatch.");
  for (let index = 0; index < signedTypes.length; index += 1) {
    const tokenType = signedTypes[index];
    const malformedType = malformed.signedTypes[index];
    const crossType = cross.signedTypes[index];
    exactKeys(malformedType, ["name", "mediaType", "maximumCoseBytes"], `source malformed signedTypes[${index}]`);
    exactKeys(crossType, ["name", "mediaType"], `source cross signedTypes[${index}]`);
    assert(malformedType.name === tokenType && malformedType.mediaType === exactMediaType(tokenType) && malformedType.maximumCoseBytes === SIGNED_TYPE_CONTRACTS[tokenType].maximumBytes, `Source malformed signed type ${tokenType} differs from the independent contract.`);
    assert(crossType.name === tokenType && crossType.mediaType === exactMediaType(tokenType), `Source cross signed type ${tokenType} differs from the independent contract.`);
  }
  const malformedIds = new Set();
  for (const source of malformed.cases) {
    exactKeys(source, ["id", "types", "category", "mutation", "expected"], `source malformed ${source.id}`);
    exactKeys(source.expected, ["decision", "stage", "errorCode", "authoritativeStateChanged", "requestConsumed"], `source malformed ${source.id}.expected`);
    assert(typeof source.id === "string" && source.id.length > 0 && !malformedIds.has(source.id), `Source malformed ID ${source.id} is invalid or duplicated.`);
    assert(Array.isArray(source.types) && source.types.length > 0 && new Set(source.types).size === source.types.length && source.types.every((type) => signedTypes.includes(type)), `${source.id} has invalid or duplicate signed types.`);
    assert(typeof source.category === "string" && source.category.length > 0 && source.mutation && typeof source.mutation === "object" && !Array.isArray(source.mutation), `${source.id} mutation/category is invalid.`);
    assert(source.expected.decision === "REJECT" && typeof source.expected.stage === "string" && typeof source.expected.errorCode === "string" && source.expected.authoritativeStateChanged === false && source.expected.requestConsumed === false, `${source.id} expected result is invalid.`);
    malformedIds.add(source.id);
  }
  const crossIds = new Set();
  for (const source of cross.cases) {
    exactKeys(source, ["id", "sourceType", "sourceMediaType", "targetType", "targetMediaType", "mutation", "expected"], `source cross ${source.id}`);
    exactKeys(source.expected, ["decision", "stage", "errorCode", "authoritativeStateChanged", "requestConsumed"], `source cross ${source.id}.expected`);
    assert(typeof source.id === "string" && source.id.length > 0 && !crossIds.has(source.id), `Source cross ID ${source.id} is invalid or duplicated.`);
    assert(signedTypes.includes(source.sourceType) && signedTypes.includes(source.targetType) && source.sourceType !== source.targetType, `${source.id} has invalid source/target types.`);
    assert(source.sourceMediaType === exactMediaType(source.sourceType) && source.targetMediaType === exactMediaType(source.targetType), `${source.id} source/target media mismatch.`);
    assert(source.mutation && typeof source.mutation === "object" && !Array.isArray(source.mutation), `${source.id} mutation is invalid.`);
    assert(source.expected.decision === "REJECT" && source.expected.stage === "DOMAIN" && source.expected.errorCode === "CROSS_TYPE_REJECTED" && source.expected.authoritativeStateChanged === false && source.expected.requestConsumed === false, `${source.id} expected result is invalid.`);
    crossIds.add(source.id);
  }
  assert(malformed.cases.length === 224 && malformedIds.size === 224 && cross.cases.length === 90 && crossIds.size === 90, "Source corpus cardinality mismatch.");
}

function validateCoverage(index, vectorsRoot, repositoryReadRoot, positiveById, criticalById, keys) {
  exactKeys(index.descriptorCorpora, ["malformedPath", "malformedSha256", "malformedExpandedCount", "crossTypePath", "crossTypeSha256", "crossTypeCount"], "descriptorCorpora");
  const descriptor = index.descriptorCorpora;
  assert(descriptor.malformedExpandedCount === 744 && descriptor.crossTypeCount === 90, "Index coverage counts are not 744/90.");
  assert(descriptor.malformedPath === "coverage/malformed-expanded.json" && descriptor.crossTypePath === "coverage/cross-type.json", "Index coverage paths are not exact.");
  const malformedPath = safeRelativePath(descriptor.malformedPath, "malformedPath");
  const crossPath = safeRelativePath(descriptor.crossTypePath, "crossTypePath");
  const malformed = loadStrictPackageJson(vectorsRoot, malformedPath, "malformed-expanded.json", 16 * 1024 * 1024);
  const cross = loadStrictPackageJson(vectorsRoot, crossPath, "cross-type.json", 4 * 1024 * 1024);
  assert(independentSha256Hex(malformed.bytes) === descriptor.malformedSha256, "Malformed coverage hash mismatch.");
  assert(independentSha256Hex(cross.bytes) === descriptor.crossTypeSha256, "Cross-type coverage hash mismatch.");

  const protocolMalformed = loadStrictPackageJson(repositoryReadRoot, "licensing/protocol/v1/corpus/malformed-cases.json", "source malformed-cases.json", 16 * 1024 * 1024);
  const protocolCross = loadStrictPackageJson(repositoryReadRoot, "licensing/protocol/v1/corpus/cross-type-cases.json", "source cross-type-cases.json", 4 * 1024 * 1024);
  validateProtocolCorpora(protocolMalformed, protocolCross);
  const malformedValue = malformed.value;
  exactKeys(malformedValue, ["schemaVersion", "protocolVersion", "coverageKind", "nonProductionOnly", "sourcePath", "sourceSha256", "sourceDescriptorCount", "expectedRecordCount", "records"], "malformed coverage envelope");
  assert(malformedValue.schemaVersion === 1 && malformedValue.protocolVersion === 1 && malformedValue.coverageKind === "MALFORMED_EXPANDED" && malformedValue.nonProductionOnly === true, "Malformed coverage envelope mismatch.");
  assert(malformedValue.sourcePath === malformedSourceRelative && malformedValue.sourceSha256 === independentSha256Hex(protocolMalformed.bytes), "Malformed source path/hash pin mismatch.");
  assert(malformedValue.sourceDescriptorCount === 224 && protocolMalformed.value.expectedCaseCount === 224 && protocolMalformed.value.cases.length === 224, "Malformed source descriptor count mismatch.");
  assert(malformedValue.expectedRecordCount === 744 && Array.isArray(malformedValue.records) && malformedValue.records.length === 744, "Malformed expansion count mismatch.");

  const sourceDescriptorById = new Map();
  for (const source of protocolMalformed.value.cases) {
    assert(!sourceDescriptorById.has(source.id), `Duplicate source malformed descriptor ${source.id}.`);
    sourceDescriptorById.set(source.id, source);
  }
  const criticalByPair = new Map();
  for (const [id, critical] of criticalById) {
    exactKeys(critical.record, ["id", "sourceDescriptorId", "basePositiveId", "tokenType", "mediaType", "signerKeyId", "signerKeyIdHex", "path", "bytes", "sha256", "expected"], `critical ${id}`);
    const source = sourceDescriptorById.get(critical.record.sourceDescriptorId);
    assert(source && source.types.includes(critical.record.tokenType), `${id} does not join to a source descriptor/type.`);
    const pair = `${critical.record.sourceDescriptorId}\0${critical.record.tokenType}`;
    assert(!criticalByPair.has(pair), `Multiple critical binaries claim ${pair}.`);
    criticalByPair.set(pair, critical);
    assert(critical.record.basePositiveId === basePositiveByType[critical.record.tokenType], `${id} critical base mismatch.`);
    assert(critical.record.mediaType === exactMediaType(critical.record.tokenType), `${id} critical media mismatch.`);
    assert(critical.record.expected.decision === source.expected.decision && critical.record.expected.stage === source.expected.stage && critical.record.expected.errorCode === source.expected.errorCode, `${id} critical expected result diverges from source descriptor.`);
    const declaredKey = keys.byId.get(critical.record.signerKeyId);
    assert(declaredKey && declaredKey.kidHex === critical.record.signerKeyIdHex, `${id} declared signer metadata mismatch.`);
    const baseSignerId = positiveById.get(critical.record.basePositiveId)?.record.signerKeyId;
    const expectedSignerId = negativeSignerOverrideById[id] ?? baseSignerId;
    assert(expectedSignerId && critical.record.signerKeyId === expectedSignerId, `${id} signerKeyId differs from its independently pinned binary scenario.`);
  }

  let malformedCursor = 0;
  const linkedCriticalIds = new Set();
  for (const source of protocolMalformed.value.cases) {
    for (const tokenType of source.types) {
      const record = malformedValue.records[malformedCursor++];
      const label = `malformed record ${malformedCursor - 1}`;
      exactKeys(record, ["id", "descriptorId", "tokenType", "basePositiveId", "baseCosePath", "baseCoseSha256", "mutation", "expected", "coverageStatus", "binaryExecution", "binaryNegativeId"], label);
      assert(record.id === `${source.id}::${tokenType}` && record.descriptorId === source.id && record.tokenType === tokenType, `${label} identity/order mismatch.`);
      validateBase(record, tokenType, positiveById, label);
      assert(jsonDeepEqual(record.mutation, source.mutation) && jsonDeepEqual(record.expected, source.expected), `${label} mutation/expected mismatch.`);
      assert(record.coverageStatus === "FROZEN", `${label} is not FROZEN.`);
      const critical = criticalByPair.get(`${source.id}\0${tokenType}`);
      if (critical) {
        assert(record.binaryExecution === "BINARY_FIXTURE" && record.binaryNegativeId === critical.record.id, `${label} binary link mismatch.`);
        assert(!linkedCriticalIds.has(critical.record.id), `${label} duplicates binary link ${critical.record.id}.`);
        linkedCriticalIds.add(critical.record.id);
      } else {
        assert(record.binaryExecution === "DEFERRED_TO_LIC_6_2_003" && record.binaryNegativeId === null, `${label} fabricated binary link.`);
      }
    }
  }
  assert(malformedCursor === 744 && linkedCriticalIds.size === criticalById.size, "Malformed exact join omitted or fabricated a record/binary link.");
  const malformedDeferredCount = malformedValue.records.filter((record) => record.binaryExecution === "DEFERRED_TO_LIC_6_2_003").length;
  assert(malformedDeferredCount === 702, `Expected 702 deferred malformed records, received ${malformedDeferredCount}.`);

  const crossValue = cross.value;
  exactKeys(crossValue, ["schemaVersion", "protocolVersion", "coverageKind", "nonProductionOnly", "sourcePath", "sourceSha256", "expectedRecordCount", "records"], "cross-type coverage envelope");
  assert(crossValue.schemaVersion === 1 && crossValue.protocolVersion === 1 && crossValue.coverageKind === "CROSS_TYPE" && crossValue.nonProductionOnly === true, "Cross-type coverage envelope mismatch.");
  assert(crossValue.sourcePath === crossSourceRelative && crossValue.sourceSha256 === independentSha256Hex(protocolCross.bytes), "Cross-type source path/hash pin mismatch.");
  assert(crossValue.expectedRecordCount === 90 && protocolCross.value.expectedOrderedPairCount === 90 && crossValue.records.length === 90 && protocolCross.value.cases.length === 90, "Cross-type count mismatch.");

  const crossExecuted = [];
  const crossIds = new Set();
  const crossPairs = new Set();
  for (let index = 0; index < protocolCross.value.cases.length; index += 1) {
    const source = protocolCross.value.cases[index];
    const record = crossValue.records[index];
    const label = `cross-type record ${index}`;
    exactKeys(record, ["id", "sourceType", "targetType", "basePositiveId", "baseCosePath", "baseCoseSha256", "sourceMediaType", "targetMediaType", "mutation", "expected", "coverageStatus"], label);
    assert(record.id === source.id && record.sourceType === source.sourceType && record.targetType === source.targetType && record.sourceMediaType === source.sourceMediaType && record.targetMediaType === source.targetMediaType, `${label} identity/order/type/media mismatch.`);
    assert(record.sourceMediaType === exactMediaType(record.sourceType) && record.targetMediaType === exactMediaType(record.targetType), `${label} media registry mismatch.`);
    const base = validateBase(record, record.sourceType, positiveById, label);
    assert(jsonDeepEqual(record.mutation, source.mutation) && jsonDeepEqual(record.expected, source.expected), `${label} mutation/expected mismatch.`);
    assert(record.coverageStatus === "FROZEN", `${label} is not FROZEN.`);
    const pair = `${record.sourceType}\0${record.targetType}`;
    assert(!crossIds.has(record.id) && !crossPairs.has(pair), `${label} is duplicated.`);
    crossIds.add(record.id);
    crossPairs.add(pair);
    let actual;
    try {
      independentlyVerifySignedObject(base.bytes, record.targetType, keys.byKid, { crossType: true });
      fail(`${record.id} cross-type vector was accepted.`);
    } catch (error) {
      if (!(error instanceof NodeVectorFailure)) throw error;
      actual = independentRejectResult(error, base.bytes);
    }
    assert(actual.decision === record.expected.decision && actual.stage === record.expected.stage && actual.errorCode === record.expected.errorCode, `${record.id} executed cross-type verdict mismatch.`);
    assert(actual.inputSha256 === base.record.sha256, `${record.id} did not execute the indexed source bytes.`);
    crossExecuted.push(reportEntry(record.id, actual));
  }
  for (const source of signedTypes) for (const target of signedTypes) if (source !== target) assert(crossPairs.has(`${source}\0${target}`), `Missing cross-type pair ${source}->${target}.`);
  assert(crossIds.size === 90 && crossPairs.size === 90 && crossExecuted.length === 90, "Cross-type exact join/execution is incomplete.");
  return {
    malformedExpandedCount: 744,
    crossTypeCount: 90,
    malformedExpandedSha256: descriptor.malformedSha256,
    crossTypeSha256: descriptor.crossTypeSha256,
    crossExecuted,
    malformedDeferredCount,
    executedCrossTypeCount: crossExecuted.length,
  };
}

function canonicalReportBytes(index, indexSha256, executed, coverage) {
  const ordered = [...executed].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  assert(ordered.length === 173, `Expected 173 executed results, received ${ordered.length}.`);
  assert(new Set(ordered.map((record) => record.id)).size === ordered.length, "Executed report IDs are duplicated.");
  for (const record of ordered) exactKeys(record, ["id", "decision", "stage", "errorCode", "inputSha256", "protectedSha256", "payloadSha256", "sigStructureSha256", "signerKeyIdHex"], `executed ${record.id}`);
  const report = {
    schemaVersion: 1,
    reportKind: REPORT_KIND,
    protocolManifestSha256: FROZEN_PROTOCOL_MANIFEST_SHA256,
    indexSha256,
    positiveCount: index.positive.length,
    binaryNegativeCount: index.criticalNegative.length,
    malformedExpandedCount: coverage.malformedExpandedCount,
    crossTypeCount: coverage.crossTypeCount,
    malformedDeferredCount: coverage.malformedDeferredCount,
    executedCrossTypeCount: coverage.executedCrossTypeCount,
    executed: ordered,
    coverage: {
      malformedExpandedSha256: coverage.malformedExpandedSha256,
      crossTypeSha256: coverage.crossTypeSha256,
    },
  };
  return Buffer.from(`${JSON.stringify(report)}\n`, "ascii");
}

function run(vectorsRoot, repositoryReadRoot) {
  runIndependentCborOrderingSelfTest();
  const indexDocument = loadStrictPackageJson(vectorsRoot, "vectors-index.json", "vectors-index.json", 4 * 1024 * 1024);
  const index = indexDocument.value;
  exactKeys(index, ["schemaVersion", "protocolVersion", "reportKind", "nonProductionOnly", "protocolManifestSha256", "keyDerivation", "keys", "positive", "criticalNegative", "descriptorCorpora"], "vectors index");
  assert(index.schemaVersion === 1 && index.protocolVersion === 1 && index.reportKind === REPORT_KIND && index.nonProductionOnly === true, "Index metadata mismatch.");
  assert(index.protocolManifestSha256 === FROZEN_PROTOCOL_MANIFEST_SHA256, "Protocol manifest pin mismatch.");
  assert(index.keyDerivation === TEST_ONLY_KEY_DERIVATION, "Index TEST_ONLY key derivation marker mismatch.");
  assert(Array.isArray(index.positive) && index.positive.length === 41, "Expected exactly 41 positives.");
  assert(Array.isArray(index.criticalNegative) && index.criticalNegative.length === 42, "Expected exactly 42 critical binary negatives.");
  const keys = loadKeys(index, vectorsRoot);
  const executed = [];
  const positiveById = new Map();
  const positiveInputs = [];
  const fixtureBytesById = new Map();
  const signedResultsById = new Map();
  let signedCount = 0;
  let carrierCount = 0;
  const expectedPositiveIds = Object.keys(positiveVariantById);
  assert(expectedPositiveIds.length === 41, "Independent positive scenario registry must contain 41 IDs.");
  for (let positiveIndex = 0; positiveIndex < index.positive.length; positiveIndex += 1) {
    const record = index.positive[positiveIndex];
    exactKeys(record, ["id", "kind", "tokenType", "carrierType", "variant", "mediaType", "path", "bytes", "sha256", "protectedSha256", "payloadSha256", "sigStructureSha256", "signatureSha256", "signerKeyId", "signerKeyIdHex", "expected"], `positive ${record.id}`);
    assert(typeof record.id === "string" && !fixtureBytesById.has(record.id), `Duplicate positive ID ${record.id}.`);
    assert(record.id === expectedPositiveIds[positiveIndex], `${record.id} positive ID/order differs from the independent scenario registry.`);
    assert(record.path === `fixtures/positive/${record.id}.cbor`, `${record.id} positive path is not exact.`);
    assert(record.variant === positiveVariantById[record.id], `${record.id} positive variant differs from the independent scenario registry.`);
    validateExpected(record, "ACCEPT");
    const bytes = readIndexedFile(vectorsRoot, record, record.id);
    fixtureBytesById.set(record.id, bytes);
    positiveInputs.push({ record, bytes });
  }
  for (const { record, bytes } of positiveInputs.filter((input) => input.record.kind === "SIGNED_OBJECT")) {
    signedCount += 1;
    assert(signedTypes.includes(record.tokenType) && record.carrierType === null && record.mediaType === exactMediaType(record.tokenType), `${record.id} signed type/media mismatch.`);
    assert(record.signerKeyId === expectedPositiveSignerId(record), `${record.id} signerKeyId differs from the independent scenario registry.`);
    const declaredKey = keys.byId.get(record.signerKeyId);
    assert(declaredKey && declaredKey.kidHex === record.signerKeyIdHex, `${record.id} declared signer mismatch.`);
    const actual = independentlyVerifySignedObject(bytes, record.tokenType, keys.byKid);
    assert(record.protectedSha256 === actual.protectedSha256 && record.payloadSha256 === actual.payloadSha256 && record.sigStructureSha256 === actual.sigStructureSha256 && record.signatureSha256 === actual.signatureSha256 && record.signerKeyIdHex === actual.signerKeyIdHex, `${record.id} component/signature hashes drifted.`);
    assert(actual.decision === record.expected.decision && actual.stage === record.expected.stage && actual.errorCode === record.expected.errorCode, `${record.id} positive verdict mismatch.`);
    const runtime = { record, bytes, actual };
    positiveById.set(record.id, runtime);
    signedResultsById.set(record.id, actual);
    executed.push(reportEntry(record.id, actual));
  }
  for (const { record, bytes } of positiveInputs.filter((input) => input.record.kind === "CARRIER")) {
    carrierCount += 1;
    const carrierContract = carrierContractById[record.id];
    assert(carrierContract && record.carrierType === carrierContract[0] && record.variant === carrierContract[1], `${record.id} carrier contract mismatch.`);
    assert(record.tokenType === null && record.mediaType === carrierMediaType(record.carrierType) && record.signerKeyId === null && record.signerKeyIdHex === "", `${record.id} carrier metadata mismatch.`);
    assert(record.protectedSha256 === "" && record.payloadSha256 === "" && record.sigStructureSha256 === "" && record.signatureSha256 === "", `${record.id} carrier component hashes must be empty.`);
    const actual = independentlyVerifyCarrier(bytes, record.carrierType, record.variant, keys.byKid, { recordId: record.id, fixtureBytesById, signedResultsById });
    assert(actual.decision === record.expected.decision && actual.stage === record.expected.stage && actual.errorCode === record.expected.errorCode, `${record.id} positive verdict mismatch.`);
    positiveById.set(record.id, { record, bytes, actual });
    executed.push(reportEntry(record.id, actual));
  }
  assert(positiveInputs.every((input) => ["SIGNED_OBJECT", "CARRIER"].includes(input.record.kind)), "Positive registry contains an unknown kind.");
  assert(signedCount === 35 && carrierCount === 6 && positiveById.size === expectedPositiveIds.length, "Positive signed/carrier registry is incomplete.");

  const criticalById = new Map();
  let previousCriticalId = "";
  for (const record of index.criticalNegative) {
    exactKeys(record, ["id", "sourceDescriptorId", "basePositiveId", "tokenType", "mediaType", "signerKeyId", "signerKeyIdHex", "path", "bytes", "sha256", "expected"], `critical ${record.id}`);
    assert(typeof record.id === "string" && !criticalById.has(record.id) && !positiveById.has(record.id), `Duplicate negative ID ${record.id}.`);
    assert(previousCriticalId === "" || previousCriticalId < record.id, `Critical negative ${record.id} is not in exact ASCII ID order.`);
    previousCriticalId = record.id;
    assert(record.path === `fixtures/negative/${record.id}.cbor`, `${record.id} negative path is not exact.`);
    validateExpected(record, "REJECT");
    assert(signedTypes.includes(record.tokenType), `${record.id} has unknown negative type.`);
    const bytes = readIndexedFile(vectorsRoot, record, record.id);
    let actual;
    try {
      independentlyVerifySignedObject(bytes, record.tokenType, keys.byKid);
      fail(`${record.id} critical negative was accepted.`);
    } catch (error) {
      if (!(error instanceof NodeVectorFailure)) throw error;
      actual = independentRejectResult(error, bytes);
    }
    assert(actual.stage === record.expected.stage && actual.errorCode === record.expected.errorCode, `${record.id} expected ${record.expected.stage}/${record.expected.errorCode}, got ${actual.stage}/${actual.errorCode}.`);
    criticalById.set(record.id, { record, bytes, actual });
    executed.push(reportEntry(record.id, actual));
  }
  assert(Object.keys(negativeSignerOverrideById).every((id) => criticalById.has(id)), "Pinned negative signer scenarios are incomplete.");
  const coverage = validateCoverage(index, vectorsRoot, repositoryReadRoot, positiveById, criticalById, keys);
  executed.push(...coverage.crossExecuted);
  return canonicalReportBytes(index, independentSha256Hex(indexDocument.bytes), executed, coverage);
}

try {
  const options = parseArguments(process.argv.slice(2));
  const vectorsRoot = createReadRoot(options.vectors, "vectors root");
  const repositoryReadRoot = createReadRoot(repositoryRoot, "repository root");
  const reportBytes = run(vectorsRoot, repositoryReadRoot);
  if (options.report) writeReportCreateNew(options.report, reportBytes, vectorsRoot);
  else process.stdout.write(reportBytes);
  console.error("ok - Node verifier PASS: executed 173 records (41 positives = 35 signed + 6 carriers; 42 critical binary negatives; 90 cross-type rejects) and exact-joined all 744 malformed records (42 binary + 702 deferred)");
} catch (error) {
  console.error(`not ok - ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
