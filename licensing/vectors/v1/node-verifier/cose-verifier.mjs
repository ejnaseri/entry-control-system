// Independent Node COSE/ES256 consumer. This module intentionally imports no
// issuer, fixture builder, deterministic signer, or TEST_ONLY private material.

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { NodeVectorFailure, reject } from "./errors.mjs";
import {
  StrictCborError,
  bytesValue,
  findIntegerKey,
  findTextKey,
  integerValue,
  parseStrictCbor,
  textMapObject,
  textValue,
} from "./strict-cbor.mjs";

export const FROZEN_PROTOCOL_MANIFEST_SHA256 = "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";
export const SIGNED_TYPE_CONTRACTS = Object.freeze({
  "activation-request": { purpose: "INSTALLATION_DEVICE", maximumBytes: 131072 },
  "lease-request": { purpose: "INSTALLATION_DEVICE", maximumBytes: 8192 },
  "key-delegation": { purpose: "PROD_ROOT", maximumBytes: 8192 },
  "key-denylist": { purpose: "PROD_ROOT", maximumBytes: 262144 },
  entitlement: { purpose: "OFFLINE_ENTITLEMENT", maximumBytes: 16384 },
  lease: { purpose: "ONLINE_LEASE", maximumBytes: 16384 },
  "offline-control": { purpose: "OFFLINE_CONTROL", maximumBytes: 8192 },
  "reactivation-authorization": { purpose: "OFFLINE_CONTROL", maximumBytes: 16384 },
  recovery: { purpose: "RECOVERY", maximumBytes: 16384 },
  "time-correction": { purpose: "RECOVERY", maximumBytes: 8192 },
});
const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
const P256_HALF_ORDER = BigInt("0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8");
const P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d03010703420004", "hex");

export function exactMediaType(tokenType) {
  if (!SIGNED_TYPE_CONTRACTS[tokenType]) throw new Error(`Unknown signed type ${tokenType}.`);
  return `application/vnd.entry-control.${tokenType}+cbor;v=1`;
}

export function independentSha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

function decodeAtStage(bytes, stage, options) {
  try {
    return parseStrictCbor(bytes, options);
  } catch (error) {
    if (error instanceof StrictCborError) reject(stage, error.code, error.message);
    throw error;
  }
}

function head(major, input) {
  const value = BigInt(input);
  if (value < 24n) return Buffer.from([(major << 5) | Number(value)]);
  let width;
  let additional;
  if (value <= 0xffn) [width, additional] = [1, 24];
  else if (value <= 0xffffn) [width, additional] = [2, 25];
  else if (value <= 0xffffffffn) [width, additional] = [4, 26];
  else [width, additional] = [8, 27];
  const encoded = Buffer.alloc(width);
  let remaining = value;
  for (let index = width - 1; index >= 0; index -= 1) {
    encoded[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return Buffer.concat([Buffer.from([(major << 5) | additional]), encoded]);
}

function bstr(bytes) {
  return Buffer.concat([head(2, bytes.length), bytes]);
}

function buildSigStructure(protectedBytes, payloadBytes) {
  const signature1 = Buffer.from("Signature1", "ascii");
  return Buffer.concat([Buffer.from([0x84]), head(3, signature1.length), signature1, bstr(protectedBytes), Buffer.from([0x40]), bstr(payloadBytes)]);
}

function requireExactProtectedHeaders(headers) {
  if (!headers || headers.kind !== "map") reject("COSE_PARSE", "INVALID_PROTECTED_HEADER", "Protected headers must decode to a map.");
  const labels = headers.entries.map((entry) => {
    if (entry.key.kind !== "unsigned") reject("COSE_PARSE", "UNKNOWN_PROTECTED_HEADER", "Protected header label must be unsigned integer.");
    return Number(entry.key.integer);
  });
  for (const expected of [1, 3, 4]) if (!labels.includes(expected)) reject("COSE_PARSE", "MISSING_PROTECTED_HEADER", `Missing protected header ${expected}.`);
  if (labels.length !== 3 || labels.some((label) => ![1, 3, 4].includes(label))) reject("COSE_PARSE", "UNKNOWN_PROTECTED_HEADER", "Protected header map is not exact.");
}

function inspectSignedObject(input) {
  const bytes = Buffer.from(input);
  const root = decodeAtStage(bytes, "CBOR_PARSE", { allowNull: true });
  if (root.kind !== "tag" || root.tag !== 18n) reject("COSE_PARSE", "WRONG_COSE_TAG", "COSE tag 18 is required.");
  const cose = root.item;
  if (!cose || cose.kind !== "array" || cose.items.length !== 4) reject("COSE_PARSE", "INVALID_COSE_SHAPE", "COSE_Sign1 requires four items.");
  let protectedBytes;
  try {
    protectedBytes = bytesValue(cose.items[0], "INVALID_PROTECTED_HEADER");
  } catch (error) {
    if (error instanceof StrictCborError) reject("COSE_PARSE", "INVALID_PROTECTED_HEADER", error.message);
    throw error;
  }
  if (cose.items[1].kind !== "map" || cose.items[1].entries.length !== 0) reject("COSE_PARSE", "UNPROTECTED_HEADER_NOT_EMPTY", "Unprotected header map must be empty.");
  if (cose.items[2].kind === "null") reject("COSE_PARSE", "DETACHED_PAYLOAD_FORBIDDEN", "Detached payload is forbidden.");
  if (cose.items[2].kind !== "bytes") reject("COSE_PARSE", "INVALID_COSE_PAYLOAD", "Embedded payload must be a byte string.");
  const payloadBytes = cose.items[2].bytes;
  if (cose.items[3].kind !== "bytes" || cose.items[3].bytes.length !== 64) reject("SIGNATURE", "INVALID_SIGNATURE_ENCODING", "ES256 signature must be a 64-byte byte string.");
  const signature = cose.items[3].bytes;
  const protectedHeaders = decodeAtStage(protectedBytes, "COSE_PARSE");
  requireExactProtectedHeaders(protectedHeaders);
  let algorithm;
  try {
    algorithm = integerValue(findIntegerKey(protectedHeaders, 1), "WRONG_ALGORITHM");
  } catch (error) {
    if (error instanceof StrictCborError) reject("COSE_PARSE", "WRONG_ALGORITHM", error.message);
    throw error;
  }
  if (algorithm !== -7) reject("COSE_PARSE", "WRONG_ALGORITHM", "Protected alg must be -7.");
  let mediaType;
  try {
    mediaType = textValue(findIntegerKey(protectedHeaders, 3), "WRONG_HEADER_TYPE");
  } catch (error) {
    if (error instanceof StrictCborError) reject("COSE_PARSE", "WRONG_HEADER_TYPE", error.message);
    throw error;
  }
  let kid;
  try {
    kid = bytesValue(findIntegerKey(protectedHeaders, 4), "WRONG_HEADER_TYPE");
  } catch (error) {
    if (error instanceof StrictCborError) reject("COSE_PARSE", "WRONG_HEADER_TYPE", error.message);
    throw error;
  }
  if (kid.length !== 32) reject("COSE_PARSE", "WRONG_KEY_ID_LENGTH", "Protected kid must be 32 bytes.");
  const payloadMap = decodeAtStage(payloadBytes, "CBOR_PARSE");
  if (payloadMap.kind !== "map") reject("SCHEMA", "WRONG_FIELD_TYPE", "Signed payload must be a map.");
  return {
    bytes,
    protectedBytes,
    payloadBytes,
    signature,
    protectedHeaders,
    payloadMap,
    mediaType,
    kid,
    sigStructureBytes: buildSigStructure(protectedBytes, payloadBytes),
  };
}

function scalar(bytes) {
  return BigInt(`0x${bytes.toString("hex") || "0"}`);
}

export function independentlyVerifySignedObject(input, expectedType, keyRegistry, options = {}) {
  const contract = SIGNED_TYPE_CONTRACTS[expectedType];
  if (!contract) throw new Error(`Unknown expected signed type ${expectedType}.`);
  const bytes = Buffer.from(input);
  if (bytes.length > contract.maximumBytes) reject("PRE_DECODE", "OBJECT_TOO_LARGE", "Complete signed object exceeds its type cap.");
  const inspected = inspectSignedObject(bytes);
  if (inspected.mediaType !== exactMediaType(expectedType)) reject("DOMAIN", options.crossType ? "CROSS_TYPE_REJECTED" : "MEDIA_TYPE_MISMATCH", "Protected media type does not match selected contract.");
  let protocolVersion;
  try {
    protocolVersion = integerValue(findTextKey(inspected.payloadMap, "protocolVersion"), "PROTOCOL_VERSION_MISMATCH");
  } catch (error) {
    if (error instanceof StrictCborError) reject("DOMAIN", "PROTOCOL_VERSION_MISMATCH", error.message);
    throw error;
  }
  if (protocolVersion !== 1) reject("DOMAIN", "PROTOCOL_VERSION_MISMATCH", "Payload protocolVersion must be 1.");
  let tokenType;
  try {
    tokenType = textValue(findTextKey(inspected.payloadMap, "tokenType"), "TOKEN_TYPE_MISMATCH");
  } catch (error) {
    if (error instanceof StrictCborError) reject("DOMAIN", options.crossType ? "CROSS_TYPE_REJECTED" : "TOKEN_TYPE_MISMATCH", error.message);
    throw error;
  }
  if (tokenType !== expectedType) reject("DOMAIN", options.crossType ? "CROSS_TYPE_REJECTED" : "TOKEN_TYPE_MISMATCH", "Payload tokenType does not match selected contract.");
  let payloadKid;
  try {
    payloadKid = bytesValue(findTextKey(inspected.payloadMap, "keyId"), "KEY_ID_MISMATCH");
  } catch (error) {
    if (error instanceof StrictCborError) reject("DOMAIN", "KEY_ID_MISMATCH", error.message);
    throw error;
  }
  if (payloadKid.length !== 32 || !payloadKid.equals(inspected.kid)) reject("DOMAIN", "KEY_ID_MISMATCH", "Payload keyId does not match protected kid.");
  const r = scalar(inspected.signature.subarray(0, 32));
  const s = scalar(inspected.signature.subarray(32));
  if (r <= 0n || r >= P256_ORDER || s <= 0n || s >= P256_ORDER) reject("SIGNATURE", "INVALID_ECDSA_SCALAR", "ES256 scalar is outside P-256 range.");
  if (s > P256_HALF_ORDER) reject("SIGNATURE", "NON_CANONICAL_SIGNATURE", "High-S ES256 signature is forbidden.");
  const kidHex = inspected.kid.toString("hex");
  const key = keyRegistry.get(kidHex);
  if (!key) reject("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is unknown.");
  if (key.spkiDer.length !== 91 || !key.spkiDer.subarray(0, P256_SPKI_PREFIX.length).equals(P256_SPKI_PREFIX)) reject("TRUST", "KEY_ID_COLLISION", "Signing SPKI is not canonical P-256 DER.");
  if (independentSha256Hex(key.spkiDer) !== kidHex) reject("TRUST", "KEY_ID_COLLISION", "SPKI-derived kid mismatch.");
  let publicKey;
  try {
    publicKey = createPublicKey({ key: key.spkiDer, format: "der", type: "spki" });
  } catch {
    reject("TRUST", "KEY_ID_COLLISION", "Signing SPKI cannot be imported.");
  }
  if (!cryptoVerify("sha256", inspected.sigStructureBytes, { key: publicKey, dsaEncoding: "ieee-p1363" }, inspected.signature)) reject("SIGNATURE", "SIGNATURE_INVALID", "ES256 signature verification failed.");
  if (key.trustClass === "UNKNOWN") reject("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is unknown.");
  if (key.environment !== "TEST") reject("TRUST", "SIGNING_KEY_ENVIRONMENT_MISMATCH", "Signing key environment is not TEST.");
  if (key.trustClass === "DENIED") reject("TRUST", "SIGNING_KEY_DENIED", "Signing key is denied.");
  if (key.purpose !== contract.purpose) reject("TRUST", "WRONG_SIGNING_KEY_PURPOSE", "Signing key purpose does not match object type.");
  return {
    decision: "ACCEPT",
    stage: "COMPLETE",
    errorCode: "NONE",
    inputSha256: independentSha256Hex(bytes),
    protectedSha256: independentSha256Hex(inspected.protectedBytes),
    payloadSha256: independentSha256Hex(inspected.payloadBytes),
    sigStructureSha256: independentSha256Hex(inspected.sigStructureBytes),
    signatureSha256: independentSha256Hex(inspected.signature),
    signerKeyIdHex: kidHex,
    decodedPayloadMap: inspected.payloadMap,
  };
}

function exactCarrierMap(root, allowed, required, code) {
  const value = textMapObject(root, code);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) reject("SCHEMA", "UNKNOWN_FIELD", "Carrier includes unknown field.");
  if (required.some((key) => !(key in value))) reject("SCHEMA", "MISSING_REQUIRED_FIELD", "Carrier is missing required field.");
  return value;
}

function carrierInteger(value, code) {
  try {
    return integerValue(value, code);
  } catch (error) {
    if (error instanceof StrictCborError) reject("SCHEMA", code, error.message);
    throw error;
  }
}

function carrierText(value, code) {
  try {
    return textValue(value, code);
  } catch (error) {
    if (error instanceof StrictCborError) reject("SCHEMA", code, error.message);
    throw error;
  }
}

function carrierBytes(value, code) {
  try {
    return bytesValue(value, code);
  } catch (error) {
    if (error instanceof StrictCborError) reject("SCHEMA", code, error.message);
    throw error;
  }
}

function contextFixture(context, id) {
  const value = context.fixtureBytesById?.get(id);
  if (!Buffer.isBuffer(value)) reject("SCHEMA", "WRONG_FIELD_TYPE", `Carrier scenario is missing fixture ${id}.`);
  return value;
}

function contextSigned(context, id) {
  const value = context.signedResultsById?.get(id);
  if (!value?.decodedPayloadMap) reject("SCHEMA", "WRONG_FIELD_TYPE", `Carrier scenario is missing verified signed fixture ${id}.`);
  return value;
}

function payloadBytes(result, field) {
  try {
    return bytesValue(findTextKey(result.decodedPayloadMap, field), "WRONG_FIELD_TYPE");
  } catch (error) {
    if (error instanceof StrictCborError) reject("SCHEMA", "WRONG_FIELD_TYPE", error.message);
    throw error;
  }
}

function payloadInteger(result, field) {
  try {
    return integerValue(findTextKey(result.decodedPayloadMap, field), "WRONG_FIELD_TYPE");
  } catch (error) {
    if (error instanceof StrictCborError) reject("SCHEMA", "WRONG_FIELD_TYPE", error.message);
    throw error;
  }
}

function requireSameBytes(actual, expected, message) {
  if (!actual.equals(expected)) reject("SCHEMA", "WRONG_FIELD_TYPE", message);
}

export function independentlyVerifyCarrier(input, carrierType, variant, keyRegistry, context = {}) {
  const bytes = Buffer.from(input);
  const maximum = carrierType === "lease-challenge" ? 4096 : carrierType === "trust-bundle" ? 1048576 : 524288;
  if (bytes.length > maximum) reject("PRE_DECODE", "OBJECT_TOO_LARGE", "Carrier exceeds type cap.");
  const root = decodeAtStage(bytes, "CBOR_PARSE");
  if (carrierType === "lease-challenge") {
    if (context.recordId !== "pos-carrier-lease-challenge" || variant !== "STANDARD") reject("SCHEMA", "WRONG_FIELD_TYPE", "Lease challenge scenario identity mismatch.");
    const value = exactCarrierMap(root, ["schemaVersion", "carrierType", "requestNonce", "expiresInSeconds"], ["schemaVersion", "carrierType", "requestNonce", "expiresInSeconds"], "WRONG_FIELD_TYPE");
    if (carrierInteger(value.schemaVersion, "WRONG_FIELD_TYPE") !== 1 || carrierText(value.carrierType, "WRONG_FIELD_TYPE") !== "lease-challenge" || carrierBytes(value.requestNonce, "WRONG_FIELD_TYPE").length !== 32 || carrierInteger(value.expiresInSeconds, "WRONG_FIELD_TYPE") !== 300) reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid lease-challenge carrier.");
    requireSameBytes(carrierBytes(value.requestNonce, "WRONG_FIELD_TYPE"), payloadBytes(contextSigned(context, "pos-lease-request-check-in"), "requestNonce"), "Lease challenge nonce is not bound to the ordinary CHECK_IN request.");
  } else if (carrierType === "trust-bundle") {
    if (context.recordId !== "pos-carrier-trust-bundle" || variant !== "STANDARD") reject("SCHEMA", "WRONG_FIELD_TYPE", "Trust bundle scenario identity mismatch.");
    const value = exactCarrierMap(root, ["schemaVersion", "carrierType", "delegations", "denylist"], ["schemaVersion", "carrierType", "delegations", "denylist"], "WRONG_FIELD_TYPE");
    if (carrierInteger(value.schemaVersion, "WRONG_FIELD_TYPE") !== 1 || carrierText(value.carrierType, "WRONG_FIELD_TYPE") !== "trust-bundle" || value.delegations.kind !== "array" || value.delegations.items.length !== 4) reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid trust-bundle carrier.");
    const expectedDelegations = ["pos-delegation-recovery", "pos-delegation-offline-control", "pos-delegation-online-lease", "pos-delegation-offline-entitlement"];
    let previousDelegatedKeyId;
    const delegatedKeyIds = new Set();
    for (let index = 0; index < value.delegations.items.length; index += 1) {
      const delegationBytes = carrierBytes(value.delegations.items[index], "WRONG_FIELD_TYPE");
      requireSameBytes(delegationBytes, contextFixture(context, expectedDelegations[index]), "Trust bundle delegation bytes/order differ from the pinned scenario.");
      const delegation = independentlyVerifySignedObject(delegationBytes, "key-delegation", keyRegistry);
      const delegatedKeyId = payloadBytes(delegation, "delegatedKeyId");
      const delegatedKeyHex = delegatedKeyId.toString("hex");
      if (delegatedKeyIds.has(delegatedKeyHex) || (previousDelegatedKeyId && Buffer.compare(previousDelegatedKeyId, delegatedKeyId) >= 0)) reject("SCHEMA", "WRONG_FIELD_TYPE", "Trust bundle delegatedKeyId values are not unique strict raw-byte order.");
      delegatedKeyIds.add(delegatedKeyHex);
      previousDelegatedKeyId = delegatedKeyId;
    }
    const denylistBytes = carrierBytes(value.denylist, "WRONG_FIELD_TYPE");
    requireSameBytes(denylistBytes, contextFixture(context, "pos-denylist-revision-2"), "Trust bundle denylist is not the pinned revision-2 fixture.");
    const denylist = independentlyVerifySignedObject(denylistBytes, "key-denylist", keyRegistry);
    if (payloadInteger(denylist, "denylistRevision") !== 2) reject("SCHEMA", "WRONG_FIELD_TYPE", "Trust bundle denylist revision is not 2.");
  } else if (carrierType === "lease-response") {
    const scenarios = {
      "pos-carrier-lease-response-complete": {
        variant: "WITH_LEASE",
        fields: ["schemaVersion", "carrierType", "requestId", "lease", "offlineControl", "reactivationAuthorization", "trustBundle"],
        requestId: "pos-lease-request-check-in",
        embedded: { lease: "pos-lease-initial-control", offlineControl: "pos-control-vendor-suspend", reactivationAuthorization: "pos-reactivation-authorization", trustBundle: "pos-carrier-trust-bundle" },
      },
      "pos-carrier-lease-response-control-only": {
        variant: "CONTROL_ONLY",
        fields: ["schemaVersion", "carrierType", "requestId", "offlineControl"],
        requestId: "pos-lease-request-check-in",
        embedded: { offlineControl: "pos-control-vendor-suspend" },
      },
      "pos-carrier-lease-response-reactivation-only": {
        variant: "REACTIVATION_ONLY",
        fields: ["schemaVersion", "carrierType", "requestId", "reactivationAuthorization"],
        requestId: "pos-lease-request-check-in",
        embedded: { reactivationAuthorization: "pos-reactivation-authorization" },
      },
      "pos-carrier-lease-response-time-recovery": {
        variant: "WITH_LEASE",
        fields: ["schemaVersion", "carrierType", "requestId", "lease"],
        requestId: "pos-lease-request-time-recovery",
        embedded: { lease: "pos-lease-positive-control" },
      },
    };
    const scenario = scenarios[context.recordId];
    if (!scenario || variant !== scenario.variant) reject("SCHEMA", "WRONG_FIELD_TYPE", "Lease response scenario identity/variant mismatch.");
    const value = exactCarrierMap(root, scenario.fields, scenario.fields, "WRONG_FIELD_TYPE");
    if (carrierInteger(value.schemaVersion, "WRONG_FIELD_TYPE") !== 1 || carrierText(value.carrierType, "WRONG_FIELD_TYPE") !== "lease-response" || carrierBytes(value.requestId, "WRONG_FIELD_TYPE").length !== 16) reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid lease-response identity.");
    const request = contextSigned(context, scenario.requestId);
    requireSameBytes(carrierBytes(value.requestId, "WRONG_FIELD_TYPE"), payloadBytes(request, "requestId"), "Lease response requestId is not bound to its request fixture.");
    for (const [field, expectedId] of Object.entries(scenario.embedded)) requireSameBytes(carrierBytes(value[field], "WRONG_FIELD_TYPE"), contextFixture(context, expectedId), `Lease response ${field} is not the pinned embedded fixture.`);
    if (value.lease) {
      const lease = independentlyVerifySignedObject(carrierBytes(value.lease, "WRONG_FIELD_TYPE"), "lease", keyRegistry);
      requireSameBytes(payloadBytes(lease, "leaseRequestId"), carrierBytes(value.requestId, "WRONG_FIELD_TYPE"), "Embedded Lease leaseRequestId differs from the outer requestId.");
      requireSameBytes(payloadBytes(lease, "leaseRequestHash"), Buffer.from(request.inputSha256, "hex"), "Embedded Lease leaseRequestHash differs from the exact request COSE bytes.");
    }
    if (value.offlineControl) independentlyVerifySignedObject(carrierBytes(value.offlineControl, "WRONG_FIELD_TYPE"), "offline-control", keyRegistry);
    if (value.reactivationAuthorization) independentlyVerifySignedObject(carrierBytes(value.reactivationAuthorization, "WRONG_FIELD_TYPE"), "reactivation-authorization", keyRegistry);
    if (value.trustBundle) independentlyVerifyCarrier(carrierBytes(value.trustBundle, "WRONG_FIELD_TYPE"), "trust-bundle", "STANDARD", keyRegistry, { ...context, recordId: "pos-carrier-trust-bundle" });
  } else throw new Error(`Unknown carrier type ${carrierType}.`);
  return {
    decision: "ACCEPT",
    stage: "COMPLETE",
    errorCode: "NONE",
    inputSha256: independentSha256Hex(bytes),
    protectedSha256: "",
    payloadSha256: "",
    sigStructureSha256: "",
    signerKeyIdHex: "",
  };
}

export function independentRejectResult(error, input) {
  if (!(error instanceof NodeVectorFailure)) throw error;
  return {
    decision: "REJECT",
    stage: error.stage,
    errorCode: error.code,
    inputSha256: independentSha256Hex(input),
    protectedSha256: "",
    payloadSha256: "",
    sigStructureSha256: "",
    signerKeyIdHex: "",
  };
}
