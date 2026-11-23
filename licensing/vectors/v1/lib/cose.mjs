// TEST_ONLY_DO_NOT_TRUST: COSE_Sign1 fixture helpers and a deliberately scoped
// golden-vector verifier. This is not the LIC-6.2-003 production parser.

import { CborError, CborTag, decodeCanonical, encodeCanonical, mapToObject } from "./cbor.mjs";
import {
  P256_HALF_ORDER,
  P256_ORDER,
  sha256,
  signEs256Rfc6979LowS,
  signatureScalars,
  verifyEs256,
} from "./ecdsa-rfc6979.mjs";

export const PROTOCOL_MANIFEST_SHA256 = "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";

export const TYPE_CONTRACTS = Object.freeze({
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

export function mediaTypeFor(tokenType) {
  if (!TYPE_CONTRACTS[tokenType]) throw new Error(`Unknown signed token type ${tokenType}.`);
  return `application/vnd.entry-control.${tokenType}+cbor;v=1`;
}

export class VectorVerificationError extends Error {
  constructor(stage, code, message) {
    super(message);
    this.name = "VectorVerificationError";
    this.stage = stage;
    this.code = code;
  }
}

function reject(stage, code, message) {
  throw new VectorVerificationError(stage, code, message);
}

function decodeAtProtocolStage(bytes, defaultStage = "CBOR_PARSE") {
  try {
    return decodeCanonical(bytes);
  } catch (error) {
    if (error instanceof CborError) reject(defaultStage, error.code, error.message);
    throw error;
  }
}

function decodeEnvelope(bytes) {
  try {
    return decodeCanonical(bytes, { allowNull: true });
  } catch (error) {
    if (error instanceof CborError) reject("CBOR_PARSE", error.code, error.message);
    throw error;
  }
}

function hashHex(bytes) {
  return sha256(bytes).toString("hex");
}

export function issueTestOnlyCose(tokenType, payload, key) {
  const mediaType = mediaTypeFor(tokenType);
  const protectedBytes = encodeCanonical(new Map([[1, -7], [3, mediaType], [4, key.kid]]));
  const payloadBytes = encodeCanonical(payload);
  const sigStructureBytes = encodeCanonical(["Signature1", protectedBytes, Buffer.alloc(0), payloadBytes]);
  const signature = signEs256Rfc6979LowS(sigStructureBytes, key.privateScalar);
  const coseBytes = encodeCanonical(new CborTag(18, [protectedBytes, new Map(), payloadBytes, signature]));
  return {
    tokenType,
    mediaType,
    protectedBytes,
    payloadBytes,
    sigStructureBytes,
    signature,
    coseBytes,
    protectedSha256: hashHex(protectedBytes),
    payloadSha256: hashHex(payloadBytes),
    sigStructureSha256: hashHex(sigStructureBytes),
    signatureSha256: hashHex(signature),
    coseSha256: hashHex(coseBytes),
  };
}

function exactHeaderKeys(headers) {
  if (!(headers instanceof Map)) reject("COSE_PARSE", "INVALID_PROTECTED_HEADER", "Protected header must decode to a map.");
  const labels = [...headers.keys()];
  for (const expected of [1, 3, 4]) {
    if (!headers.has(expected)) reject("COSE_PARSE", "MISSING_PROTECTED_HEADER", `Missing protected header ${expected}.`);
  }
  if (labels.some((label) => ![1, 3, 4].includes(label)) || labels.length !== 3) {
    reject("COSE_PARSE", "UNKNOWN_PROTECTED_HEADER", "Protected header map is not exact.");
  }
}

export function inspectCose(input) {
  const bytes = Buffer.from(input);
  const outer = decodeEnvelope(bytes);
  if (!(outer instanceof CborTag) || outer.tag !== 18) reject("COSE_PARSE", "WRONG_COSE_TAG", "COSE tag 18 is required.");
  if (!Array.isArray(outer.value) || outer.value.length !== 4) reject("COSE_PARSE", "INVALID_COSE_SHAPE", "COSE_Sign1 must contain four items.");
  const [protectedBytes, unprotected, payloadBytes, signature] = outer.value;
  if (!Buffer.isBuffer(protectedBytes)) reject("COSE_PARSE", "INVALID_PROTECTED_HEADER", "Protected header must be a byte string.");
  if (!(unprotected instanceof Map) || unprotected.size !== 0) reject("COSE_PARSE", "UNPROTECTED_HEADER_NOT_EMPTY", "Unprotected headers must be an empty map.");
  if (payloadBytes === null) reject("COSE_PARSE", "DETACHED_PAYLOAD_FORBIDDEN", "Detached payload is forbidden.");
  if (!Buffer.isBuffer(payloadBytes)) reject("COSE_PARSE", "INVALID_COSE_PAYLOAD", "Embedded payload must be a byte string.");
  if (!Buffer.isBuffer(signature) || signature.length !== 64) reject("SIGNATURE", "INVALID_SIGNATURE_ENCODING", "ES256 signature must be a 64-byte byte string.");
  const headers = decodeAtProtocolStage(protectedBytes, "COSE_PARSE");
  exactHeaderKeys(headers);
  if (headers.get(1) !== -7) reject("COSE_PARSE", "WRONG_ALGORITHM", "Protected alg must be ES256 (-7).");
  if (typeof headers.get(3) !== "string") reject("COSE_PARSE", "WRONG_HEADER_TYPE", "Protected content type must be text.");
  if (!Buffer.isBuffer(headers.get(4))) reject("COSE_PARSE", "WRONG_HEADER_TYPE", "Protected kid must be a byte string.");
  if (headers.get(4).length !== 32) reject("COSE_PARSE", "WRONG_KEY_ID_LENGTH", "Protected kid must be 32 bytes.");
  const payloadMap = decodeAtProtocolStage(payloadBytes);
  if (!(payloadMap instanceof Map)) reject("SCHEMA", "WRONG_FIELD_TYPE", "Signed payload must be a map.");
  const payload = mapToObject(payloadMap);
  const sigStructureBytes = encodeCanonical(["Signature1", protectedBytes, Buffer.alloc(0), payloadBytes]);
  return { bytes, protectedBytes, payloadBytes, signature, headers, payload, sigStructureBytes };
}

export function verifySignedObject(input, expectedType, keyRegistry, options = {}) {
  const contract = TYPE_CONTRACTS[expectedType];
  if (!contract) throw new Error(`Unknown expected type ${expectedType}.`);
  const bytes = Buffer.from(input);
  if (bytes.length > contract.maximumBytes) reject("PRE_DECODE", "OBJECT_TOO_LARGE", "Complete object exceeds its type cap.");
  const inspected = inspectCose(bytes);
  const expectedMedia = mediaTypeFor(expectedType);
  const actualMedia = inspected.headers.get(3);
  if (actualMedia !== expectedMedia) {
    reject("DOMAIN", options.crossType ? "CROSS_TYPE_REJECTED" : "MEDIA_TYPE_MISMATCH", "Protected media type does not match the selected type contract.");
  }
  if (inspected.payload.protocolVersion !== 1) reject("DOMAIN", "PROTOCOL_VERSION_MISMATCH", "Payload protocolVersion must be 1.");
  if (inspected.payload.tokenType !== expectedType) {
    reject("DOMAIN", options.crossType ? "CROSS_TYPE_REJECTED" : "TOKEN_TYPE_MISMATCH", "Payload tokenType does not match the selected type contract.");
  }
  const kid = inspected.headers.get(4);
  if (!Buffer.isBuffer(inspected.payload.keyId) || !inspected.payload.keyId.equals(kid)) reject("DOMAIN", "KEY_ID_MISMATCH", "Payload keyId must match protected kid.");
  const scalars = signatureScalars(inspected.signature);
  if (!scalars) reject("SIGNATURE", "INVALID_SIGNATURE_ENCODING", "Invalid ES256 signature encoding.");
  if (scalars.r <= 0n || scalars.r >= P256_ORDER || scalars.s <= 0n || scalars.s >= P256_ORDER) {
    reject("SIGNATURE", "INVALID_ECDSA_SCALAR", "ES256 scalar is out of range.");
  }
  if (scalars.s > P256_HALF_ORDER) reject("SIGNATURE", "NON_CANONICAL_SIGNATURE", "High-S ES256 signature is forbidden.");
  const key = keyRegistry.get(kid.toString("hex"));
  if (!key) reject("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is unknown.");
  if (!sha256(key.spkiDer).equals(kid)) reject("TRUST", "KEY_ID_COLLISION", "SPKI-derived key ID does not match kid.");
  if (!verifyEs256(inspected.sigStructureBytes, inspected.signature, key.spkiDer)) reject("SIGNATURE", "SIGNATURE_INVALID", "ES256 signature verification failed.");
  // Frozen v1 order authenticates the exact bytes before evaluating trust.
  // This prevents a corrupt signature from being misreported as an
  // environment, purpose, or denylist failure.
  if (key.trustClass === "UNKNOWN") reject("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is unknown.");
  if (key.environment !== "TEST") reject("TRUST", "SIGNING_KEY_ENVIRONMENT_MISMATCH", "Signing key environment does not match TEST vectors.");
  if (key.trustClass === "DENIED") reject("TRUST", "SIGNING_KEY_DENIED", "Signing key is denied.");
  if (key.purpose !== contract.purpose) reject("TRUST", "WRONG_SIGNING_KEY_PURPOSE", "Signing key purpose does not match token type.");
  return {
    decision: "ACCEPT",
    stage: "COMPLETE",
    errorCode: "NONE",
    inputSha256: hashHex(bytes),
    protectedSha256: hashHex(inspected.protectedBytes),
    payloadSha256: hashHex(inspected.payloadBytes),
    sigStructureSha256: hashHex(inspected.sigStructureBytes),
    signerKeyIdHex: kid.toString("hex"),
  };
}

function requireExactTextMap(map, allowed, required) {
  if (!(map instanceof Map)) reject("SCHEMA", "WRONG_FIELD_TYPE", "Carrier must be a map.");
  const value = mapToObject(map);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) reject("SCHEMA", "UNKNOWN_FIELD", "Carrier has an unknown field.");
  if (required.some((key) => !(key in value))) reject("SCHEMA", "MISSING_REQUIRED_FIELD", "Carrier is missing a required field.");
  return value;
}

export function verifyCarrier(input, carrierType, variant, keyRegistry) {
  const bytes = Buffer.from(input);
  const decoded = decodeAtProtocolStage(bytes);
  if (carrierType === "lease-challenge") {
    const value = requireExactTextMap(decoded, ["schemaVersion", "carrierType", "requestNonce", "expiresInSeconds"], ["schemaVersion", "carrierType", "requestNonce", "expiresInSeconds"]);
    if (value.schemaVersion !== 1 || value.carrierType !== "lease-challenge" || !Buffer.isBuffer(value.requestNonce) || value.requestNonce.length !== 32 || value.expiresInSeconds !== 300) {
      reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid lease-challenge carrier.");
    }
  } else if (carrierType === "trust-bundle") {
    const value = requireExactTextMap(decoded, ["schemaVersion", "carrierType", "delegations", "denylist"], ["schemaVersion", "carrierType", "delegations", "denylist"]);
    if (value.schemaVersion !== 1 || value.carrierType !== "trust-bundle" || !Array.isArray(value.delegations) || value.delegations.length < 1 || value.delegations.length > 64 || !Buffer.isBuffer(value.denylist)) {
      reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid trust-bundle carrier.");
    }
    for (const delegation of value.delegations) verifySignedObject(delegation, "key-delegation", keyRegistry);
    verifySignedObject(value.denylist, "key-denylist", keyRegistry);
  } else if (carrierType === "lease-response") {
    const value = requireExactTextMap(decoded, ["schemaVersion", "carrierType", "requestId", "lease", "offlineControl", "reactivationAuthorization", "trustBundle"], ["schemaVersion", "carrierType", "requestId"]);
    if (value.schemaVersion !== 1 || value.carrierType !== "lease-response" || !Buffer.isBuffer(value.requestId) || value.requestId.length !== 16) reject("SCHEMA", "WRONG_FIELD_TYPE", "Invalid lease-response carrier identity.");
    const presence = ["lease", "offlineControl", "reactivationAuthorization"].filter((field) => field in value);
    if (presence.length === 0) reject("SCHEMA", "MISSING_REQUIRED_FIELD", "Lease response requires a primary signed object.");
    if (variant === "WITH_LEASE" && !("lease" in value)) reject("SCHEMA", "MISSING_REQUIRED_FIELD", "WITH_LEASE carrier requires lease.");
    if (variant === "CONTROL_ONLY" && (("lease" in value) || !("offlineControl" in value))) reject("SCHEMA", "WRONG_FIELD_TYPE", "CONTROL_ONLY carrier shape mismatch.");
    if (variant === "REACTIVATION_ONLY" && (("lease" in value) || ("offlineControl" in value) || !("reactivationAuthorization" in value))) reject("SCHEMA", "WRONG_FIELD_TYPE", "REACTIVATION_ONLY carrier shape mismatch.");
    if (value.lease) verifySignedObject(value.lease, "lease", keyRegistry);
    if (value.offlineControl) verifySignedObject(value.offlineControl, "offline-control", keyRegistry);
    if (value.reactivationAuthorization) verifySignedObject(value.reactivationAuthorization, "reactivation-authorization", keyRegistry);
    if (value.trustBundle) verifyCarrier(value.trustBundle, "trust-bundle", "STANDARD", keyRegistry);
  } else {
    throw new Error(`Unknown carrier type ${carrierType}.`);
  }
  return {
    decision: "ACCEPT",
    stage: "COMPLETE",
    errorCode: "NONE",
    inputSha256: hashHex(bytes),
    protectedSha256: "",
    payloadSha256: "",
    sigStructureSha256: "",
    signerKeyIdHex: "",
  };
}

export function rejectResult(error, input) {
  if (!(error instanceof VectorVerificationError)) throw error;
  return {
    decision: "REJECT",
    stage: error.stage,
    errorCode: error.code,
    inputSha256: hashHex(input),
    protectedSha256: "",
    payloadSha256: "",
    sigStructureSha256: "",
    signerKeyIdHex: "",
  };
}
