// TEST_ONLY_DO_NOT_TRUST
// Runtime mutation executor for the frozen Licensing v1 descriptor corpus.
// This module is dynamically imported only after the production-module graph
// isolation check has completed.

import { createHash, generateKeyPairSync } from "node:crypto";
import {
  CborTag,
  decodeCanonical,
  encodeCanonical,
} from "../../licensing/vectors/v1/lib/cbor.mjs";
import {
  inspectCose,
  issueTestOnlyCose,
  mediaTypeFor,
} from "../../licensing/vectors/v1/lib/cose.mjs";
import {
  P256_ORDER,
} from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";
import {
  TEST_ONLY_KEYS,
} from "../../licensing/vectors/v1/test-only/keys.mjs";
import { runLic003ClaimsRecord } from "./license-core-claims-executor.mjs";

const LIC003_STATE_TYPES = new Set(["key-delegation", "key-denylist"]);
const TEXT_TYPES = [
  "activation-request",
  "lease-request",
  "key-delegation",
  "key-denylist",
  "entitlement",
  "lease",
  "offline-control",
  "reactivation-authorization",
  "recovery",
  "time-correction",
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytes(label, length) {
  return Buffer.from(createHash("sha256").update(label, "utf8").digest().subarray(0, length));
}

function differentBytes(value, label = "different") {
  const output = Buffer.from(value);
  assert(output.length > 0, "Cannot alter an empty byte string.");
  output[output.length - 1] ^= bytes(label, 1)[0] || 1;
  return output;
}

function clone(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [clone(key), clone(item)]));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function display(value) {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint"
        ? `${item}n`
        : item instanceof Uint8Array
          ? Buffer.from(item).toString("hex")
          : item,
    );
  } catch {
    return String(value);
  }
}

function captured(operation) {
  try {
    operation();
    return { ok: true };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      typeof error.stage === "string" &&
      typeof error.code === "string"
    ) {
      return { ok: false, stage: error.stage, errorCode: error.code };
    }
    throw error;
  }
}

function assertThrown(record, operation) {
  const result = captured(operation);
  assert(!result.ok, `${record.id} did not reject at its production seam.`);
  assert(
    result.stage === record.expected.stage && result.errorCode === record.expected.errorCode,
    `${record.id} rejected as ${display(result)}; expected ${record.expected.stage}/${record.expected.errorCode}.`,
  );
}

function assertVerifierReject(record, result) {
  assert(result && result.ok === false, `${record.id} unexpectedly accepted: ${display(result)}.`);
  assert(
    result.stage === record.expected.stage && result.errorCode === record.expected.errorCode,
    `${record.id} rejected as ${result.stage}/${result.errorCode}; expected ${record.expected.stage}/${record.expected.errorCode}.`,
  );
  assert(result.authoritativeStateChanged === false, `${record.id} reported a state mutation.`);
  assert(result.requestConsumed === false, `${record.id} reported request consumption.`);
}

function descriptorOwnedByLic003(record) {
  return record.binaryExecution !== "BINARY_FIXTURE" &&
    (record.expected.stage !== "STATE" || LIC003_STATE_TYPES.has(record.tokenType));
}

function positiveMap(golden) {
  return new Map(golden.index.positive.map((vector) => [vector.id, vector]));
}

function effectivePositiveId(record) {
  const id = record.id;
  if (id.includes("TPM_EVIDENCE_ON_SOFTWARE")) return "pos-activation-activate-full";
  if (id.includes("PURPOSE_FIELDS_MISSING")) return "pos-activation-reactivate";
  if (id.includes("PURPOSE_FIELDS_LEAK")) return "pos-activation-activate-tpm";
  if (
    record.tokenType === "activation-request" &&
    (id.includes("CONTROL_ACTION_INVALID") || id.includes("CONTROL_ACTION_MISSING") || id.includes("CONTROL_REASON_ZERO"))
  ) {
    return "pos-activation-control";
  }
  if (id.includes("LEASE_REQUEST_TIME_RECOVERY_INCIDENT_MISSING")) {
    return "pos-lease-request-time-recovery";
  }
  if (id.includes("OFFLINE_CONTROL_REQUEST_BOUND")) return "pos-control-request-unsuspend";
  if (
    id.includes("ENTITLEMENT_HYBRID_POLICY_MISSING") ||
    id.includes("ENTITLEMENT_CADENCE_OUT_OF_RANGE") ||
    id.includes("ENTITLEMENT_ALLOWANCE_OUT_OF_RANGE")
  ) return "pos-entitlement-initial-hybrid";
  if (id.includes("ENTITLEMENT_REACTIVATION_REFERENCE_MISSING")) return "pos-entitlement-reactivated";
  if (id.includes("LEASE_REBIND_REFERENCE_MISSING")) return "pos-lease-rebind-reference";
  if (id.includes("LEASE_REQUEST_ACTIVE_REBIND")) return "pos-lease-request-check-in-rebind";
  if (
    id.includes("KEY_DENYLIST_PREDECESSOR") ||
    id.includes("EMPTY_OPTIONAL::key-denylist") ||
    id.includes("NULL_OPTIONAL::key-denylist") ||
    id.includes("DUPLICATE_SET_MEMBER::key-denylist")
  ) {
    return "pos-denylist-revision-2";
  }
  if (id.includes("RECOVERY_REBIND") || id.includes("EMPTY_OPTIONAL::recovery") || id.includes("NULL_OPTIONAL::recovery")) {
    return "pos-recovery-rebind-device";
  }
  if (id.includes("EMPTY_OPTIONAL::lease-request") || id.includes("NULL_OPTIONAL::lease-request")) {
    return "pos-lease-request-check-in-rebind";
  }
  if (id.includes("EMPTY_OPTIONAL::lease") || id.includes("NULL_OPTIONAL::lease")) return "pos-lease-rebind-reference";
  if (id.includes("EMPTY_OPTIONAL::offline-control") || id.includes("NULL_OPTIONAL::offline-control")) {
    return "pos-control-request-unsuspend";
  }
  return record.basePositiveId;
}

function baseVector(record, golden, positives) {
  const vector = positives.get(effectivePositiveId(record));
  assert(vector?.kind === "SIGNED_OBJECT", `${record.id} has no usable signed positive base.`);
  const encoded = Buffer.from(golden.readData(vector.path));
  assert(sha256(encoded) === vector.sha256, `${record.id} base vector bytes drifted.`);
  return { vector, encoded, inspected: inspectCose(encoded) };
}

function mapValue(container, field) {
  return container instanceof Map ? container.get(field) : container[field];
}

function setMapValue(container, field, value) {
  if (container instanceof Map) container.set(field, value);
  else container[field] = value;
}

function deleteMapValue(container, field) {
  if (container instanceof Map) container.delete(field);
  else delete container[field];
}

function nestedContainer(root, path) {
  const segments = path.split(".");
  let current = root;
  for (const segment of segments) current = mapValue(current, segment);
  assert(current && typeof current === "object", `Missing nested mutation target ${path}.`);
  return current;
}

function selectedCounterField(type) {
  return {
    "activation-request": "stateGeneration",
    "lease-request": "stateGeneration",
    "key-delegation": "delegationSerial",
    "key-denylist": "denylistRevision",
    entitlement: "warningLeadSeconds",
    lease: "leaseRevision",
    "offline-control": "controlRevision",
    "reactivation-authorization": "finalControlRevision",
    recovery: "expectedStateGeneration",
    "time-correction": "timeCorrectionRevision",
  }[type];
}

function selectedHashField(payload, type) {
  const preferred = {
    "activation-request": "versionIdentitySha256",
    "lease-request": "buildManifestSha256",
    "key-delegation": "delegatedKeyId",
    "key-denylist": "keyId",
    entitlement: "deviceKeyId",
    lease: "buildManifestSha256",
    "offline-control": "keyId",
    "reactivation-authorization": "finalRevokeTokenHash",
    recovery: "entitlementTokenHash",
    "time-correction": "deviceKeyId",
  }[type];
  assert(Buffer.from(payload[preferred]).length === 32, `No 32-byte hash field for ${type}.`);
  return preferred;
}

function selectedOpaqueIdField(type) {
  return type === "activation-request" || type === "lease-request" ? "requestId" : "tokenId";
}

function selectedTimestampField(payload) {
  for (const field of ["issuedAt", "notBefore", "controlEffectiveAt", "termStartsAt", "serverTime"]) {
    if (field in payload) return field;
  }
  fail("No timestamp field exists in payload.");
}

let p384Spki;
function p384PublicSpki() {
  if (!p384Spki) {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
    p384Spki = publicKey.export({ format: "der", type: "spki" });
  }
  return Buffer.from(p384Spki);
}

function conditionalTarget(record) {
  const descriptor = record.mutation.targetByType?.[record.tokenType];
  return descriptor?.path;
}

function mutateSchemaPayload(record, payload, fixtures) {
  const mutation = record.mutation;
  switch (mutation.operation) {
    case "addConditionalField":
      payload.tpmEvidence = clone(fixtures.tpm.tpmEvidence);
      break;
    case "addFieldsFromDifferentPurpose":
      for (const field of [
        "revokedLicenseId",
        "revokedActivationId",
        "finalRevokeTokenHash",
        "finalControlRevision",
        "incidentId",
        "incidentNonce",
        "revokedLineageTombstoneId",
        "revokedLineageTombstoneHash",
      ]) payload[field] = clone(fixtures.reactivate[field]);
      break;
    case "addForbiddenConditionalFields":
      payload.requestId = bytes(`${record.id}:request`, 16);
      payload.requestHash = bytes(`${record.id}:hash`, 32);
      break;
    case "addHybridPolicyFieldsToOfflineMode":
      for (const field of ["checkCadenceSeconds", "offlineAllowanceSeconds", "timeRecoveryRttSeconds"]) {
        payload[field] = clone(fixtures.hybrid[field]);
      }
      break;
    case "addNestedField":
      setMapValue(nestedContainer(payload, mutation.path), mutation.field, 0n);
      break;
    case "addPayloadField":
      payload[mutation.field] = mutation.valueDescriptor === "uint-zero"
        ? 0n
        : mutation.field === "requestHash"
          ? bytes(`${record.id}:hash`, 32)
          : 0n;
      break;
    case "addRebindFieldsToNonRebind":
      for (const field of ["oldDeviceKeyId", "newDeviceKeyId", "newAssurance"]) {
        payload[field] = clone(fixtures.rebindRecovery[field]);
      }
      break;
    case "duplicateSetMember": {
      const path = mutation.targetPathByType[record.tokenType];
      const values = payload[path];
      assert(Array.isArray(values) && values.length > 0, `${record.id} needs a non-empty set.`);
      values.push(clone(values[0]));
      break;
    }
    case "removeConditionalFields":
      for (const field of mutation.fields) delete payload[field];
      break;
    case "removeConditionalField":
      delete payload[mutation.field];
      break;
    case "removeHybridPolicyFields":
      for (const field of ["checkCadenceSeconds", "offlineAllowanceSeconds", "timeRecoveryRttSeconds"]) delete payload[field];
      break;
    case "removePayloadField":
      delete payload[mutation.field];
      break;
    case "removePurposeConditionalFields":
      if (mutation.requestPurpose === "REACTIVATE") {
        for (const field of [
          "revokedLicenseId",
          "revokedActivationId",
          "finalRevokeTokenHash",
          "finalControlRevision",
          "incidentId",
          "incidentNonce",
          "revokedLineageTombstoneId",
          "revokedLineageTombstoneHash",
        ]) delete payload[field];
      } else if (mutation.requestPurpose === "TIME_RECOVERY") {
        for (const field of ["incidentId", "incidentNonce", "preIncidentClockHighWater"]) delete payload[field];
      } else {
        delete payload.licenseId;
      }
      break;
    case "removeRebindConditionalFields":
      for (const field of ["oldDeviceKeyId", "newDeviceKeyId", "newAssurance"]) delete payload[field];
      break;
    case "replaceConditionalField":
    case "replaceControlTupleField":
    case "replaceCurrentControlSnapshotField":
      payload[mutation.field] = mutation.value;
      break;
    case "replaceCounter":
      payload[selectedCounterField(record.tokenType)] = mutation.valueDescriptor
        ? 9_223_372_036_854_775_808n
        : BigInt(mutation.value);
      break;
    case "replaceDelegatedPublicKey":
      payload.delegatedPublicKey = p384PublicSpki();
      break;
    case "replaceHashLength": {
      const field = selectedHashField(payload, record.tokenType);
      payload[field] = Buffer.from(payload[field]).subarray(0, mutation.actualBytes);
      break;
    }
    case "replaceNonceLength":
      payload.requestNonce = Buffer.from(payload.requestNonce).subarray(0, mutation.actualBytes);
      break;
    case "replaceOpaqueIdLength": {
      const field = selectedOpaqueIdField(record.tokenType);
      payload[field] = Buffer.from(payload[field]).subarray(0, mutation.actualBytes);
      break;
    }
    case "replacePayloadField":
      if ("value" in mutation) payload[mutation.field] = mutation.value;
      else if (mutation.valueDescriptor === "map-instead-of-array") payload[mutation.field] = new Map();
      else if (mutation.valueDescriptor === "text") payload[mutation.field] = "not-a-counter";
      else if (mutation.valueDescriptor === "negative-integer") payload[mutation.field] = -1n;
      else if (mutation.valueDescriptor?.startsWith("text-instead")) payload[mutation.field] = "wrong-type";
      else fail(`Unhandled schema replacement descriptor ${mutation.valueDescriptor}.`);
      break;
    case "replaceTimestamp":
      payload[selectedTimestampField(payload)] = BigInt(mutation.value);
      break;
    case "reverseCanonicalSetOrder": {
      const path = mutation.targetPathByType[record.tokenType];
      const values = payload[path];
      assert(Array.isArray(values) && values.length > 1, `${record.id} needs at least two set members.`);
      values.reverse();
      break;
    }
    case "setDeniedKeyCount": {
      payload.deniedKeys = Array.from({ length: mutation.actual }, (_item, index) => {
        const kid = Buffer.alloc(32);
        kid.writeUInt32BE(index, 28);
        return new Map([
          ["delegatedKeyId", kid],
          ["effectiveAt", payload.issuedAt],
          ["reasonCode", 1n],
        ]);
      });
      break;
    }
    case "setOptionalOrConditionalFieldEmpty": {
      const path = conditionalTarget(record);
      assert(path, `${record.id} has no empty-value target.`);
      if (mutation.targetByType[record.tokenType].emptyValue === "empty-map") payload[path] = new Map();
      else if (mutation.targetByType[record.tokenType].emptyValue === "zero-length-tstr") payload[path] = "";
      else payload[path] = Buffer.alloc(0);
      break;
    }
    case "setOptionalOrConditionalFieldNull": {
      const path = conditionalTarget(record);
      assert(path, `${record.id} has no null target.`);
      payload[path] = null;
      break;
    }
    case "setPayloadField":
      payload[mutation.field] = typeof mutation.value === "number" ? BigInt(mutation.value) : mutation.value;
      break;
    case "setPurposeLimitAboveV1Ceiling":
      payload.maxTokenLifetimeSeconds = 35_424_001n;
      break;
    default:
      fail(`Unhandled SCHEMA mutation ${mutation.operation}.`);
  }
}

function runSchemaRecord(record, state) {
  const { production, golden, positives } = state;
  const base = baseVector(record, golden, positives);
  const payload = clone(base.inspected.payload);
  mutateSchemaPayload(record, payload, state.fixtures);
  const encoded = new Uint8Array(encodeCanonical(payload));
  const before = sha256(encoded);
  assertThrown(record, () => {
    const node = production.core.decodeStrictCborV1(encoded, 4 * 1024 * 1024, { allowNull: true });
    production.core.validateSignedPayload(record.tokenType, node);
  });
  assert(sha256(encoded) === before, `${record.id} schema seam mutated its input.`);
}

function rawCborMutation(operation) {
  switch (operation) {
    case "appendTrailingByte": return Buffer.from([0x00, 0x00]);
    case "duplicatePayloadMapKey": return Buffer.from([0xa2, 0x61, 0x61, 0x00, 0x61, 0x61, 0x01]);
    case "duplicateProtectedHeaderLabel": return Buffer.from([0xa2, 0x01, 0x00, 0x01, 0x01]);
    case "encodeIndefiniteByteString": return Buffer.from([0x5f, 0x40, 0xff]);
    case "encodeIndefiniteNestedArray": return Buffer.from([0x9f, 0xff]);
    case "encodeIndefinitePayloadMap": return Buffer.from([0xbf, 0xff]);
    case "encodeNonMinimalInteger": return Buffer.from([0x18, 0x00]);
    case "encodeNonMinimalLength": return Buffer.from([0x58, 0x00]);
    case "injectMalformedUtf8": return Buffer.from([0x61, 0xff]);
    case "reorderMapKeysAgainstCoreDeterministicOrder": return Buffer.from([0xa2, 0x61, 0x62, 0x00, 0x61, 0x61, 0x00]);
    case "replaceTimestampWithFloat": return Buffer.from([0xf9, 0x00, 0x00]);
    case "tagPayloadClaim": return Buffer.from([0xc1, 0x00]);
    default: fail(`Unhandled CBOR mutation ${operation}.`);
  }
}

function runCborRecord(record, production) {
  const encoded = new Uint8Array(rawCborMutation(record.mutation.operation));
  assertThrown(record, () => production.core.decodeStrictCborV1(encoded, encoded.byteLength));
}

function mutateCose(record, encoded) {
  const decoded = decodeCanonical(encoded, { allowNull: true });
  assert(decoded instanceof CborTag && Array.isArray(decoded.value), `${record.id} base is not COSE_Sign1.`);
  const outer = new CborTag(decoded.tag, clone(decoded.value));
  let tag = outer.tag;
  let tagged = true;
  const parts = outer.value;
  const mutation = record.mutation;
  const protectedMap = () => clone(decodeCanonical(parts[0]));
  const replaceProtected = (map) => { parts[0] = encodeCanonical(map); };
  switch (mutation.operation) {
    case "addProtectedHeader": {
      const map = protectedMap();
      map.set(mutation.label, 0n);
      replaceProtected(map);
      break;
    }
    case "addUnprotectedHeader":
      parts[1].set(mutation.label, Buffer.alloc(0));
      break;
    case "appendCoseArrayItem":
      parts.push(0n);
      break;
    case "removeOuterTag":
      tagged = false;
      break;
    case "removeProtectedHeader": {
      const map = protectedMap();
      map.delete(mutation.label);
      replaceProtected(map);
      break;
    }
    case "replaceKidLength": {
      const map = protectedMap();
      map.set(4, Buffer.from(map.get(4)).subarray(0, mutation.actualBytes));
      replaceProtected(map);
      break;
    }
    case "replaceOuterTag":
      tag = mutation.actualTag;
      break;
    case "replaceProtectedHeader": {
      const map = protectedMap();
      map.set(
        mutation.label,
        "value" in mutation ? mutation.value : mutation.valueDescriptor === "text" ? "wrong" : "none",
      );
      replaceProtected(map);
      break;
    }
    case "setCosePayloadNil":
      parts[2] = null;
      break;
    case "setCosePayloadToMap":
      parts[2] = decodeCanonical(parts[2]);
      break;
    case "setProtectedHeaderToMap":
      parts[0] = protectedMap();
      break;
    default:
      fail(`Unhandled COSE mutation ${mutation.operation}.`);
  }
  return Buffer.from(encodeCanonical(tagged ? new CborTag(tag, parts) : parts));
}

function runCoseRecord(record, state) {
  const base = baseVector(record, state.golden, state.positives);
  const encoded = mutateCose(record, base.encoded);
  assertVerifierReject(record, state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded: new Uint8Array(encoded),
  }));
}

function issuePayload(record, payload, state, signerId) {
  const base = baseVector(record, state.golden, state.positives);
  const keyId = signerId ?? base.vector.signerKeyId;
  const key = TEST_ONLY_KEYS[keyId];
  assert(key, `${record.id} has no test-only signer ${keyId}.`);
  return Buffer.from(issueTestOnlyCose(record.tokenType, payload, key).coseBytes);
}

function runDomainRecord(record, state) {
  const base = baseVector(record, state.golden, state.positives);
  let encoded;
  if (record.mutation.operation === "replaceProtectedContentTypeWithDifferentRegisteredType") {
    const other = TEXT_TYPES[(TEXT_TYPES.indexOf(record.tokenType) + 1) % TEXT_TYPES.length];
    const decoded = decodeCanonical(base.encoded, { allowNull: true });
    const outer = new CborTag(decoded.tag, clone(decoded.value));
    const map = clone(decodeCanonical(outer.value[0]));
    map.set(3, mediaTypeFor(other));
    outer.value[0] = encodeCanonical(map);
    encoded = Buffer.from(encodeCanonical(outer));
  } else {
    const payload = clone(base.inspected.payload);
    if (record.mutation.operation === "makeKidAndPayloadKeyIdDiffer") {
      payload.keyId = differentBytes(payload.keyId, record.id);
    } else if (record.mutation.operation === "replaceTokenTypeWithDifferentRegisteredType") {
      payload.tokenType = TEXT_TYPES[(TEXT_TYPES.indexOf(record.tokenType) + 1) % TEXT_TYPES.length];
    } else if (record.mutation.operation === "replacePayloadField") {
      payload[record.mutation.field] = BigInt(record.mutation.value);
    } else {
      fail(`Unhandled DOMAIN mutation ${record.mutation.operation}.`);
    }
    encoded = issuePayload(record, payload, state);
  }
  assertVerifierReject(record, state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded: new Uint8Array(encoded),
  }));
}

function mutateSignature(record, encoded) {
  const decoded = decodeCanonical(encoded, { allowNull: true });
  const outer = new CborTag(decoded.tag, clone(decoded.value));
  const parts = outer.value;
  const mutation = record.mutation;
  switch (mutation.operation) {
    case "flipOnePayloadBitWithoutResigning": {
      const payload = clone(inspectCose(encoded).payload);
      const field = record.tokenType.includes("request") ? "requestId" : "tokenId";
      payload[field] = differentBytes(payload[field], record.id);
      parts[2] = encodeCanonical(payload);
      break;
    }
    case "flipOneSignatureBit":
      parts[3] = differentBytes(parts[3], record.id);
      break;
    case "replaceSignatureLength": {
      const current = Buffer.from(parts[3]);
      parts[3] = mutation.actualBytes < current.length
        ? current.subarray(0, mutation.actualBytes)
        : Buffer.concat([current, Buffer.alloc(mutation.actualBytes - current.length)]);
      break;
    }
    case "replaceSignature":
      parts[3] = "not-a-signature";
      break;
    case "replaceWithMathematicallyValidHighS": {
      const signature = Buffer.from(parts[3]);
      const s = BigInt(`0x${signature.subarray(32).toString("hex")}`);
      const highS = P256_ORDER - s;
      signature.set(Buffer.from(highS.toString(16).padStart(64, "0"), "hex"), 32);
      parts[3] = signature;
      break;
    }
    case "setEcdsaComponent": {
      const signature = Buffer.from(parts[3]);
      const value = mutation.valueDescriptor === "p256-order" ? P256_ORDER : BigInt(mutation.value);
      const component = Buffer.from(value.toString(16).padStart(64, "0"), "hex");
      signature.set(component, mutation.component === "R" ? 0 : 32);
      parts[3] = signature;
      break;
    }
    default:
      fail(`Unhandled SIGNATURE mutation ${mutation.operation}.`);
  }
  return Buffer.from(encodeCanonical(outer));
}

function runSignatureRecord(record, state) {
  if (record.mutation.operation === "signWithUnknownTestKey") {
    const base = baseVector(record, state.golden, state.positives);
    const payload = clone(base.inspected.payload);
    payload.keyId = Buffer.from(TEST_ONLY_KEYS.TEST_ONLY_UNKNOWN_SIGNER.kid);
    const encoded = issuePayload(record, payload, state, "TEST_ONLY_UNKNOWN_SIGNER");
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
    }));
    return;
  }
  const base = baseVector(record, state.golden, state.positives);
  const encoded = mutateSignature(record, base.encoded);
  assertVerifierReject(record, state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded: new Uint8Array(encoded),
  }));
}

function primarySignerForPurpose(purpose, environment = "TEST", denied = false) {
  const suffix = denied ? "DENIED" : environment === "TEST" ? "PRIMARY" : "WRONG_ENV";
  const prefix = {
    PROD_ROOT: "TEST_ONLY_PROD_ROOT",
    INSTALLATION_DEVICE: "TEST_ONLY_INSTALLATION_DEVICE",
    OFFLINE_ENTITLEMENT: "TEST_ONLY_OFFLINE_ENTITLEMENT",
    ONLINE_LEASE: "TEST_ONLY_ONLINE_LEASE",
    OFFLINE_CONTROL: "TEST_ONLY_OFFLINE_CONTROL",
    RECOVERY: "TEST_ONLY_RECOVERY",
  }[purpose];
  const id = `${prefix}_${suffix}`;
  assert(TEST_ONLY_KEYS[id], `Missing test signer ${id}.`);
  return id;
}

function contractPurpose(type) {
  return {
    "activation-request": "INSTALLATION_DEVICE",
    "lease-request": "INSTALLATION_DEVICE",
    "key-delegation": "PROD_ROOT",
    "key-denylist": "PROD_ROOT",
    entitlement: "OFFLINE_ENTITLEMENT",
    lease: "ONLINE_LEASE",
    "offline-control": "OFFLINE_CONTROL",
    "reactivation-authorization": "OFFLINE_CONTROL",
    recovery: "RECOVERY",
    "time-correction": "RECOVERY",
  }[type];
}

function wrongPurposeSigner(type) {
  const expected = contractPurpose(type);
  return primarySignerForPurpose(
    ["INSTALLATION_DEVICE", "PROD_ROOT"].includes(expected)
      ? "OFFLINE_ENTITLEMENT"
      : expected === "OFFLINE_ENTITLEMENT"
        ? "ONLINE_LEASE"
        : expected === "ONLINE_LEASE"
          ? "OFFLINE_ENTITLEMENT"
          : expected === "OFFLINE_CONTROL"
            ? "ONLINE_LEASE"
            : "OFFLINE_CONTROL",
  );
}

function issueWithSigner(record, state, signerId, mutate = () => {}) {
  const base = baseVector(record, state.golden, state.positives);
  const payload = clone(base.inspected.payload);
  const signer = TEST_ONLY_KEYS[signerId];
  payload.keyId = Buffer.from(signer.kid);
  if (record.tokenType === "lease-request") payload.deviceKeyId = Buffer.from(signer.kid);
  mutate(payload);
  return Buffer.from(issueTestOnlyCose(record.tokenType, payload, signer).coseBytes);
}

function verifierWithTrust(state, overrides = {}) {
  const trust = state.trustConfiguration;
  return state.production.core.createLicenseVerifierV1({
    crypto: state.production.nodeCryptoV1,
    environment: "TEST",
    roots: overrides.roots ?? trust.roots,
    trustedKeys: overrides.trustedKeys ?? trust.trustedKeys,
    delegations: overrides.delegations ?? trust.delegations,
    denylist: overrides.denylist ?? trust.denylist,
  });
}

function runTrustRecord(record, state) {
  const operation = record.mutation.operation;
  if (operation === "signWithValidWrongPurposeTestKey") {
    const encoded = issueWithSigner(record, state, wrongPurposeSigner(record.tokenType));
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
    }));
    return;
  }

  if (operation === "signWithDeniedTestKey") {
    const signerId = primarySignerForPurpose(contractPurpose(record.tokenType), "TEST", true);
    const signer = TEST_ONLY_KEYS[signerId];
    const denial = state.trustConfiguration.denylist?.deniedKeys.find((entry) =>
      Buffer.from(entry.delegatedKeyId).equals(Buffer.from(signer.kid)),
    );
    assert(denial, `${record.id} has no accepted denial for ${signerId}.`);
    const encoded = issueWithSigner(record, state, signerId, (payload) => {
      if (record.tokenType === "time-correction") payload.correctedUtc = denial.effectiveAt;
    });
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
    }));
    return;
  }

  if (operation === "signWithDifferentEnvironmentTestKey") {
    const signerId = primarySignerForPurpose(contractPurpose(record.tokenType), "DEVELOPMENT");
    const encoded = issueWithSigner(record, state, signerId);
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
    }));
    return;
  }

  if (operation === "registerDifferentSpkiForExistingKeyId") {
    const base = baseVector(record, state.golden, state.positives);
    const signerKid = Buffer.from(base.inspected.headers.get(4));
    const badSpki = Buffer.from(TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_REBIND.spkiDer);
    const purpose = contractPurpose(record.tokenType);
    const sameKid = (entry) => Buffer.from(entry.kid).equals(signerKid);
    let roots = [...state.trustConfiguration.roots];
    let trustedKeys = [...state.trustConfiguration.trustedKeys];
    if (purpose === "PROD_ROOT") {
      roots = roots.map((entry) => sameKid(entry) ? { ...entry, spkiDer: badSpki } : entry);
    } else if (purpose === "INSTALLATION_DEVICE") {
      trustedKeys = trustedKeys.map((entry) => sameKid(entry) ? { ...entry, spkiDer: badSpki } : entry);
    } else {
      trustedKeys.push({
        kid: signerKid,
        spkiDer: badSpki,
        purpose,
        environment: "TEST",
      });
    }
    const collisionVerifier = verifierWithTrust(state, { roots, trustedKeys });
    assertVerifierReject(record, collisionVerifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(base.encoded),
    }));
    return;
  }

  if (operation === "setTokenValidityOutsideAcceptedDelegation") {
    const base = baseVector(record, state.golden, state.positives);
    const payload = clone(base.inspected.payload);
    const delegation = state.trustConfiguration.delegations.find((item) =>
      Buffer.from(item.delegatedKeyId).equals(Buffer.from(base.inspected.headers.get(4))),
    );
    assert(delegation, `${record.id} has no accepted Delegation.`);
    payload.notBefore = delegation.notBefore - 1n;
    const encoded = issuePayload(record, payload, state);
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
    }));
    return;
  }

  if (operation === "verifyUnderExpiredDelegation") {
    const base = baseVector(record, state.golden, state.positives);
    const delegation = state.trustConfiguration.delegations.find((item) =>
      Buffer.from(item.delegatedKeyId).equals(Buffer.from(base.inspected.headers.get(4))),
    );
    assert(delegation, `${record.id} has no accepted Delegation.`);
    let encoded = base.encoded;
    const context = { trustedNow: delegation.notAfter };
    if (record.tokenType === "time-correction") {
      const payload = clone(base.inspected.payload);
      payload.correctedUtc = delegation.notAfter;
      encoded = issuePayload(record, payload, state);
    }
    assertVerifierReject(record, state.verifier.verifySignedObject({
      expectedType: record.tokenType,
      encoded: new Uint8Array(encoded),
      context,
    }));
    return;
  }

  fail(`Unhandled TRUST mutation ${operation}.`);
}

function runPreDecodeRecord(record, state) {
  const encoded = new Uint8Array(record.mutation.actualBytes);
  assertVerifierReject(record, state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded,
  }));
}

function protocolFingerprint(value) {
  return sha256(encodeCanonical(clone(value)));
}

function assertStateInputsUnchanged(label, snapshots) {
  for (const snapshot of snapshots) {
    assert(
      protocolFingerprint(snapshot.value) === snapshot.before,
      `${label} mutated ${snapshot.name}.`,
    );
  }
}

function watchStateInputs(values) {
  return Object.entries(values).map(([name, value]) => ({
    name,
    value,
    before: protocolFingerprint(value),
  }));
}

function verifyStateSetup(state, record, encoded, context, label) {
  const input = new Uint8Array(encoded);
  const before = sha256(input);
  const contextWatch = context ? watchStateInputs({ context }) : [];
  const result = state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded: input,
    ...(context ? { context } : {}),
  });
  assert(sha256(input) === before, `${record.id} ${label} verification mutated its input.`);
  assertStateInputsUnchanged(`${record.id} ${label} verification`, contextWatch);
  assert(result?.ok === true, `${record.id} ${label} did not pass production verification: ${display(result)}.`);
  assert(result.decision === "ACCEPT" && result.stage === "COMPLETE", `${record.id} ${label} was not COMPLETE/ACCEPT.`);
  assert(result.authoritativeStateChanged === false, `${record.id} ${label} reported a state mutation.`);
  assert(result.requestConsumed === false, `${record.id} ${label} reported request consumption.`);
  assert(result.value?.authorization === "PREFLIGHT_ONLY", `${record.id} ${label} escaped preflight authorization.`);
  assert(
    Buffer.from(result.digests.inputSha256).toString("hex") === before,
    `${record.id} ${label} returned the wrong input digest.`,
  );
  return result;
}

function positiveStateSetup(state, record, positiveId, label = positiveId) {
  const vector = state.positives.get(positiveId);
  assert(
    vector?.kind === "SIGNED_OBJECT" && vector.tokenType === record.tokenType,
    `${record.id} cannot use ${positiveId} as a ${record.tokenType} setup.`,
  );
  const encoded = Buffer.from(state.golden.readData(vector.path));
  assert(sha256(encoded) === vector.sha256, `${record.id} ${positiveId} bytes drifted.`);
  const result = verifyStateSetup(state, record, encoded, undefined, label);
  return { vector, encoded, result };
}

function validateDelegationStateSetup(state, record, artifact, current, label) {
  const watched = watchStateInputs({
    payload: artifact.result.value.payload,
    tokenHash: artifact.result.digests.inputSha256,
    rootKid: artifact.result.signerKeyId,
    current,
  });
  const snapshot = state.production.core.validateDelegationUpdateV1({
    crypto: state.production.nodeCryptoV1,
    payload: artifact.result.value.payload,
    tokenHash: artifact.result.digests.inputSha256,
    rootKid: artifact.result.signerKeyId,
    current,
  });
  assert(snapshot?.delegationSerial === artifact.result.value.payload.delegationSerial, `${record.id} ${label} did not accept its Delegation.`);
  assertStateInputsUnchanged(`${record.id} ${label}`, watched);
  return snapshot;
}

function validateDenylistStateSetup(state, record, artifact, current, label) {
  const watched = watchStateInputs({
    payload: artifact.result.value.payload,
    tokenHash: artifact.result.digests.inputSha256,
    ...(current ? { current } : {}),
  });
  const snapshot = state.production.core.validateDenylistUpdateV1({
    payload: artifact.result.value.payload,
    tokenHash: artifact.result.digests.inputSha256,
    importedAt: artifact.result.value.payload.issuedAt,
    ...(current ? { current } : {}),
  });
  assert(snapshot?.revision === artifact.result.value.payload.denylistRevision, `${record.id} ${label} did not accept its Denylist.`);
  assertStateInputsUnchanged(`${record.id} ${label}`, watched);
  return snapshot;
}

function issueStateCandidate(state, record, payload, label) {
  const encoded = issuePayload(record, payload, state);
  return {
    encoded,
    result: verifyStateSetup(state, record, encoded, undefined, label),
  };
}

function delegationStateChain(state, record) {
  const base = positiveStateSetup(
    state,
    record,
    "pos-delegation-offline-entitlement",
    "unmodified Delegation setup",
  );
  const first = validateDelegationStateSetup(state, record, base, Object.freeze([]), "initial Delegation setup");
  return { base, first };
}

function denylistStateChain(state, record) {
  const revisionOne = positiveStateSetup(
    state,
    record,
    "pos-denylist-revision-1",
    "unmodified Denylist revision 1 setup",
  );
  const first = validateDenylistStateSetup(state, record, revisionOne, undefined, "Denylist revision 1 setup");
  const revisionTwo = positiveStateSetup(
    state,
    record,
    "pos-denylist-revision-2",
    "unmodified Denylist revision 2 setup",
  );
  const second = validateDenylistStateSetup(state, record, revisionTwo, first, "Denylist revision 2 setup");
  return { revisionOne, first, revisionTwo, second };
}

function differentReasonCode(value) {
  const numeric = BigInt(value);
  return numeric === 1n ? 2n : 1n;
}

function deniedKeyId(entry) {
  return Buffer.from(mapValue(entry, "delegatedKeyId"));
}

function sortedDeniedKeys(entries) {
  return entries.sort((left, right) => Buffer.compare(deniedKeyId(left), deniedKeyId(right)));
}

function higherDenylistSetup(state, record, chain) {
  const payload = clone(chain.revisionTwo.result.value.payload);
  payload.tokenId = bytes(`${record.id}:valid-higher-denylist`, 16);
  payload.denylistRevision = chain.second.revision + 1n;
  payload.previousDenylistTokenId = clone(chain.second.tokenId);
  payload.previousDenylistHash = clone(chain.second.tokenHash);
  const extraKid = bytes(`${record.id}:new-denied-key`, 32);
  assert(
    !payload.deniedKeys.some((entry) => deniedKeyId(entry).equals(extraKid)),
    `${record.id} generated a duplicate Denylist setup key.`,
  );
  payload.deniedKeys = sortedDeniedKeys([
    ...payload.deniedKeys.map(clone),
    {
      delegatedKeyId: extraKid,
      effectiveAt: payload.issuedAt,
      reasonCode: 1n,
    },
  ]);
  const artifact = issueStateCandidate(state, record, payload, "valid strict-superset Denylist setup");
  const snapshot = validateDenylistStateSetup(
    state,
    record,
    artifact,
    chain.second,
    "valid strict-superset Denylist update",
  );
  return { artifact, snapshot, extraKid };
}

function stateSnapshotWithAcceptedToken(tokenId, tokenHash) {
  return {
    stateGeneration: 0n,
    entitlementGeneration: 0n,
    leaseRevision: 0n,
    controlRevision: 0n,
    controlState: "OPERATIONAL",
    controlEffectiveAt: 0n,
    controlReasonCode: 0n,
    timeCorrectionRevision: 0n,
    clockHighWater: 0n,
    terminallyRevoked: false,
    acceptedTokenIds: [{ tokenId: clone(tokenId), tokenHash: clone(tokenHash) }],
  };
}

function runTokenIdCollisionStateRecord(record, state) {
  const positiveId = record.tokenType === "key-delegation"
    ? "pos-delegation-offline-entitlement"
    : "pos-denylist-revision-1";
  const setup = positiveStateSetup(state, record, positiveId, "unmodified token-id setup");
  const payload = clone(setup.result.value.payload);
  payload.notAfter -= 1n;
  const candidate = issueStateCandidate(state, record, payload, "token-id collision candidate preflight");
  assert(
    Buffer.from(candidate.result.value.payload.tokenId).equals(Buffer.from(setup.result.value.payload.tokenId)),
    `${record.id} did not retain the accepted token id.`,
  );
  assert(
    !Buffer.from(candidate.result.digests.inputSha256).equals(Buffer.from(setup.result.digests.inputSha256)),
    `${record.id} candidate bytes did not change.`,
  );
  const licensingState = stateSnapshotWithAcceptedToken(
    setup.result.value.payload.tokenId,
    setup.result.digests.inputSha256,
  );
  verifyStateSetup(
    state,
    record,
    setup.encoded,
    { state: licensingState },
    "idempotent accepted-token setup",
  );
  const watched = watchStateInputs({ licensingState });
  const encoded = new Uint8Array(candidate.encoded);
  const inputBefore = sha256(encoded);
  const result = state.verifier.verifySignedObject({
    expectedType: record.tokenType,
    encoded,
    context: { state: licensingState },
  });
  assert(sha256(encoded) === inputBefore, `${record.id} token-id collision verification mutated its input.`);
  assertStateInputsUnchanged(`${record.id} token-id collision verification`, watched);
  assertVerifierReject(record, result);
}

function runDelegationStateRecord(record, state) {
  const chain = delegationStateChain(state, record);
  if (record.mutation.operation === "reuseAcceptedTokenIdWithDifferentPayload") {
    runTokenIdCollisionStateRecord(record, state);
    return;
  }
  if (record.mutation.operation === "reuseDelegationSerialWithDifferentToken") {
    const payload = clone(chain.base.result.value.payload);
    payload.tokenId = bytes(`${record.id}:different-token`, 16);
    const candidate = issueStateCandidate(state, record, payload, "same-serial different-token candidate");
    assert(candidate.result.value.payload.delegationSerial === chain.first.delegationSerial, `${record.id} did not reuse the accepted serial.`);
    assert(
      !Buffer.from(candidate.result.digests.inputSha256).equals(Buffer.from(chain.first.tokenHash)),
      `${record.id} did not produce different signed bytes.`,
    );
    const current = [chain.first];
    const watched = watchStateInputs({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      rootKid: candidate.result.signerKeyId,
      current,
    });
    assertThrown(record, () => state.production.core.validateDelegationUpdateV1({
      crypto: state.production.nodeCryptoV1,
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      rootKid: candidate.result.signerKeyId,
      current,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }
  if (record.mutation.operation === "setDelegationSerialBelowHighWater") {
    const higherPayload = clone(chain.base.result.value.payload);
    higherPayload.tokenId = bytes(`${record.id}:higher-setup`, 16);
    higherPayload.delegationSerial = chain.first.delegationSerial + 1n;
    const higher = issueStateCandidate(state, record, higherPayload, "higher-serial Delegation setup");
    const highWater = validateDelegationStateSetup(
      state,
      record,
      higher,
      [chain.first],
      "higher-serial Delegation update",
    );
    const payload = clone(higher.result.value.payload);
    payload.tokenId = bytes(`${record.id}:rollback-candidate`, 16);
    payload.delegationSerial = highWater.delegationSerial - 1n;
    const candidate = issueStateCandidate(state, record, payload, "below-high-water Delegation candidate");
    assert(candidate.result.value.payload.delegationSerial < highWater.delegationSerial, `${record.id} serial is not below high-water.`);
    const current = [chain.first, highWater];
    const watched = watchStateInputs({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      rootKid: candidate.result.signerKeyId,
      current,
    });
    assertThrown(record, () => state.production.core.validateDelegationUpdateV1({
      crypto: state.production.nodeCryptoV1,
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      rootKid: candidate.result.signerKeyId,
      current,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }
  fail(`Unhandled Delegation STATE mutation ${record.mutation.operation}.`);
}

function runDenylistStateRecord(record, state) {
  if (record.mutation.operation === "reuseAcceptedTokenIdWithDifferentPayload") {
    runTokenIdCollisionStateRecord(record, state);
    return;
  }
  const chain = denylistStateChain(state, record);

  if (record.mutation.operation === "setDenylistRevisionBelowHighWater") {
    assert(chain.revisionOne.result.value.payload.denylistRevision < chain.second.revision, `${record.id} setup is not below high-water.`);
    const watched = watchStateInputs({
      payload: chain.revisionOne.result.value.payload,
      tokenHash: chain.revisionOne.result.digests.inputSha256,
      current: chain.second,
    });
    assertThrown(record, () => state.production.core.validateDenylistUpdateV1({
      payload: chain.revisionOne.result.value.payload,
      tokenHash: chain.revisionOne.result.digests.inputSha256,
      importedAt: chain.revisionOne.result.value.payload.issuedAt,
      current: chain.second,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }

  if (record.mutation.operation === "reuseDenylistRevisionWithDifferentToken") {
    const payload = clone(chain.revisionOne.result.value.payload);
    payload.tokenId = bytes(`${record.id}:different-token`, 16);
    const candidate = issueStateCandidate(state, record, payload, "same-revision different-token candidate");
    assert(candidate.result.value.payload.denylistRevision === chain.first.revision, `${record.id} did not reuse the accepted revision.`);
    assert(
      !Buffer.from(candidate.result.digests.inputSha256).equals(Buffer.from(chain.first.tokenHash)),
      `${record.id} did not produce different signed bytes.`,
    );
    const watched = watchStateInputs({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      current: chain.first,
    });
    assertThrown(record, () => state.production.core.validateDenylistUpdateV1({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      importedAt: candidate.result.value.payload.issuedAt,
      current: chain.first,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }

  if (record.mutation.operation === "replacePayloadField") {
    assert(record.mutation.field === "previousDenylistHash", `${record.id} targets an unexpected predecessor field.`);
    const payload = clone(chain.revisionTwo.result.value.payload);
    payload.previousDenylistHash = differentBytes(payload.previousDenylistHash, record.id);
    const candidate = issueStateCandidate(state, record, payload, "wrong-predecessor Denylist candidate");
    const watched = watchStateInputs({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      current: chain.first,
    });
    assertThrown(record, () => state.production.core.validateDenylistUpdateV1({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      importedAt: candidate.result.value.payload.issuedAt,
      current: chain.first,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }

  if (record.mutation.operation === "attemptToDropPersistedDenialsWhenEnvelopeExpires") {
    const persistedSetup = clone(chain.second);
    const setupWatch = watchStateInputs({ accepted: chain.second, persisted: persistedSetup });
    const acceptedProjection = state.production.core.validateDenylistPersistenceV1({
      accepted: chain.second,
      persisted: persistedSetup,
    });
    assert(acceptedProjection.deniedKeys.length === chain.second.deniedKeys.length, `${record.id} valid persistence setup was not accepted.`);
    assertStateInputsUnchanged(`${record.id} valid persistence setup`, setupWatch);
    const persisted = clone(chain.second);
    persisted.deniedKeys = persisted.deniedKeys.slice(1);
    assert(persisted.deniedKeys.length < chain.second.deniedKeys.length, `${record.id} did not drop a persisted denial.`);
    const watched = watchStateInputs({ accepted: chain.second, persisted });
    assertThrown(record, () => state.production.core.validateDenylistPersistenceV1({
      accepted: chain.second,
      persisted,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }

  if ([
    "removePreviouslyDeniedKey",
    "changePreviouslyAcceptedDenyEntry",
    "replaceAcceptedDenylistWithNonSupersetAtHigherRevision",
  ].includes(record.mutation.operation)) {
    const higher = higherDenylistSetup(state, record, chain);
    let payload;
    if (record.mutation.operation === "replaceAcceptedDenylistWithNonSupersetAtHigherRevision") {
      payload = clone(chain.revisionTwo.result.value.payload);
      payload.tokenId = clone(higher.artifact.result.value.payload.tokenId);
      payload.denylistRevision = higher.artifact.result.value.payload.denylistRevision;
      payload.previousDenylistTokenId = clone(chain.second.tokenId);
      payload.previousDenylistHash = clone(chain.second.tokenHash);
    } else {
      payload = clone(higher.artifact.result.value.payload);
      const acceptedKid = Buffer.from(chain.second.deniedKeys[0].delegatedKeyId);
      const index = payload.deniedKeys.findIndex((entry) => deniedKeyId(entry).equals(acceptedKid));
      assert(index >= 0, `${record.id} valid setup omitted the selected accepted denial.`);
      if (record.mutation.operation === "removePreviouslyDeniedKey") {
        payload.deniedKeys.splice(index, 1);
      } else {
        payload.deniedKeys[index].reasonCode = differentReasonCode(payload.deniedKeys[index].reasonCode);
      }
    }
    const candidate = issueStateCandidate(state, record, payload, "mutated higher-revision Denylist candidate");
    const watched = watchStateInputs({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      current: chain.second,
    });
    assertThrown(record, () => state.production.core.validateDenylistUpdateV1({
      payload: candidate.result.value.payload,
      tokenHash: candidate.result.digests.inputSha256,
      importedAt: candidate.result.value.payload.issuedAt,
      current: chain.second,
    }));
    assertStateInputsUnchanged(record.id, watched);
    return;
  }

  fail(`Unhandled Denylist STATE mutation ${record.mutation.operation}.`);
}

function runStateRecord(record, state) {
  assert(record.expected.authoritativeStateChanged === false, `${record.id} permits an authoritative mutation.`);
  assert(record.expected.requestConsumed === false, `${record.id} permits request consumption.`);
  if (record.tokenType === "key-delegation") {
    runDelegationStateRecord(record, state);
    return;
  }
  if (record.tokenType === "key-denylist") {
    runDenylistStateRecord(record, state);
    return;
  }
  fail(`${record.id} is not a LIC-6.2-003 STATE descriptor.`);
}

function loadFixtures(golden, positives) {
  const payload = (id) => {
    const vector = positives.get(id);
    assert(vector, `Missing fixture ${id}.`);
    return clone(inspectCose(golden.readData(vector.path)).payload);
  };
  return Object.freeze({
    tpm: payload("pos-activation-activate-tpm"),
    reactivate: payload("pos-activation-reactivate"),
    hybrid: payload("pos-entitlement-initial-hybrid"),
    rebindRecovery: payload("pos-recovery-rebind-device"),
  });
}

export async function executeLic003DescriptorCorpus(input) {
  const positives = positiveMap(input.golden);
  const state = {
    ...input,
    positives,
    fixtures: loadFixtures(input.golden, positives),
  };
  const records = input.golden.malformed.records.filter(descriptorOwnedByLic003);
  assert(records.length === 676, `LIC-6.2-003 descriptor ownership drifted to ${records.length}.`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "LIC-6.2-003 descriptor IDs must be unique.");
  const failures = [];
  const counts = Object.fromEntries([
    "PRE_DECODE",
    "CBOR_PARSE",
    "COSE_PARSE",
    "DOMAIN",
    "SCHEMA",
    "SIGNATURE",
    "TRUST",
    "CLAIMS",
    "STATE",
  ].map((stage) => [stage, { attempted: 0, passed: 0 }]));

  for (const record of records) {
    counts[record.expected.stage].attempted += 1;
    try {
      switch (record.expected.stage) {
        case "PRE_DECODE": runPreDecodeRecord(record, state); break;
        case "CBOR_PARSE": runCborRecord(record, input.production); break;
        case "COSE_PARSE": runCoseRecord(record, state); break;
        case "DOMAIN": runDomainRecord(record, state); break;
        case "SCHEMA": runSchemaRecord(record, state); break;
        case "SIGNATURE": runSignatureRecord(record, state); break;
        case "TRUST": runTrustRecord(record, state); break;
        case "CLAIMS": runLic003ClaimsRecord(record, state); break;
        case "STATE": runStateRecord(record, state); break;
        default:
          fail(`Unknown descriptor stage ${record.expected.stage}.`);
      }
      counts[record.expected.stage].passed += 1;
    } catch (error) {
      failures.push(`${record.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return Object.freeze({
    records: records.length,
    counts,
    failures: Object.freeze(failures),
  });
}

// Activation establishes possession of an embedded installation key. It does
// not assert Vendor registry membership or grant an Entitlement. These cases
// preserve that distinction alongside the governed signer-applicability erratum.
export function executeActivationProofOfPossessionRegressions(input) {
  const positives = positiveMap(input.golden);
  const vector = positives.get("pos-activation-activate-full");
  assert(vector?.tokenType === "activation-request", "Activation PoP regression fixture is missing.");
  const baseEncoded = Buffer.from(input.golden.readData(vector.path));
  assert(sha256(baseEncoded) === vector.sha256, "Activation PoP regression fixture drifted.");
  const basePayload = inspectCose(baseEncoded).payload;
  assert(basePayload.bindingKind === "SOFTWARE_BOUND", "Activation PoP regression requires a software-bound fixture.");
  const primary = TEST_ONLY_KEYS[vector.signerKeyId];
  const other = TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_REBIND;
  const emptyTrustVerifier = input.production.core.createLicenseVerifierV1({
    crypto: input.production.nodeCryptoV1,
    environment: "TEST",
    roots: [],
    trustedKeys: [],
    delegations: [],
  });
  const issue = (mutate, key = primary) => {
    const payload = clone(basePayload);
    mutate(payload);
    return Buffer.from(issueTestOnlyCose("activation-request", payload, key).coseBytes);
  };
  const selfContainedRequest = (key) => issue((payload) => {
    payload.keyId = Buffer.from(key.kid);
    payload.deviceKeyId = Buffer.from(key.kid);
    payload.devicePublicKey = Buffer.from(key.spkiDer);
  }, key);
  const trustWatch = watchStateInputs({ trustConfiguration: input.trustConfiguration });
  const collidingKeys = [{
    kid: Buffer.from(primary.kid),
    spkiDer: Buffer.from(other.spkiDer),
    purpose: "INSTALLATION_DEVICE",
    environment: "TEST",
  }];
  const collisionWatch = watchStateInputs({ collidingKeys });
  const collisionVerifier = input.production.core.createLicenseVerifierV1({
    crypto: input.production.nodeCryptoV1,
    environment: "TEST",
    roots: [],
    trustedKeys: collidingKeys,
    delegations: [],
  });
  const protectedKidMismatch = decodeCanonical(baseEncoded);
  const protectedHeaders = clone(decodeCanonical(protectedKidMismatch.value[0]));
  protectedHeaders.set(4, Buffer.from(other.kid));
  protectedKidMismatch.value[0] = encodeCanonical(protectedHeaders);
  const cases = [
    { id: "LIC-CRYPTO-ACTIVATION-POP-NO-REGISTRY", encoded: baseEncoded, verifier: emptyTrustVerifier },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-UNKNOWN-KEY",
      encoded: selfContainedRequest(TEST_ONLY_KEYS.TEST_ONLY_UNKNOWN_SIGNER),
      verifier: input.verifier,
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-REGISTRY-PURPOSE-IS-NOT-DEVICE-AUTHORITY",
      encoded: selfContainedRequest(TEST_ONLY_KEYS.TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY),
      verifier: input.verifier,
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-REGISTRY-ENVIRONMENT-IS-NOT-DEVICE-AUTHORITY",
      encoded: selfContainedRequest(TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_WRONG_ENV),
      verifier: input.verifier,
    },
    { id: "LIC-CRYPTO-ACTIVATION-POP-EMBEDDED-SPKI", encoded: baseEncoded, verifier: collisionVerifier },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-DEVICE-ID",
      encoded: issue((payload) => { payload.deviceKeyId = Buffer.from(other.kid); }),
      expected: { stage: "CLAIMS", errorCode: "DEVICE_KEY_ID_MISMATCH" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-PROTECTED-KID",
      encoded: Buffer.from(encodeCanonical(protectedKidMismatch)),
      expected: { stage: "DOMAIN", errorCode: "KEY_ID_MISMATCH" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-SPKI",
      encoded: issue((payload) => { payload.devicePublicKey = Buffer.from(other.spkiDer); }),
      expected: { stage: "SIGNATURE", errorCode: "SIGNATURE_INVALID" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-FORGED-SPKI-HASH",
      encoded: issue((payload) => {
        payload.keyId = Buffer.from(other.kid);
        payload.deviceKeyId = Buffer.from(other.kid);
      }, { ...primary, kid: other.kid }),
      expected: { stage: "CLAIMS", errorCode: "DEVICE_KEY_ID_MISMATCH" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-PAYLOAD",
      encoded: mutateSignature({
        id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-PAYLOAD",
        tokenType: "activation-request",
        mutation: { operation: "flipOnePayloadBitWithoutResigning" },
      }, baseEncoded),
      expected: { stage: "SIGNATURE", errorCode: "SIGNATURE_INVALID" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-SIGNATURE",
      encoded: mutateSignature({
        id: "LIC-CRYPTO-ACTIVATION-POP-ALTERED-SIGNATURE",
        mutation: { operation: "flipOneSignatureBit" },
      }, baseEncoded),
      expected: { stage: "SIGNATURE", errorCode: "SIGNATURE_INVALID" },
    },
    {
      id: "LIC-CRYPTO-ACTIVATION-POP-CANNOT-AUTHORIZE-ENTITLEMENT",
      encoded: selfContainedRequest(TEST_ONLY_KEYS.TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY),
      expectedType: "entitlement",
      expected: { stage: "DOMAIN", errorCode: "MEDIA_TYPE_MISMATCH" },
    },
  ];
  assert(cases.length === 12, "Activation PoP regression coverage drifted.");
  const failures = [];
  let passed = 0;
  for (const item of cases) {
    try {
      const encoded = new Uint8Array(item.encoded);
      const before = sha256(encoded);
      const result = (item.verifier ?? emptyTrustVerifier).verifySignedObject({
        expectedType: item.expectedType ?? "activation-request",
        encoded,
      });
      assert(sha256(encoded) === before, `${item.id} mutated the candidate bytes.`);
      if (item.expected) {
        assertVerifierReject(item, result);
      } else {
        assert(result?.ok === true, `${item.id} failed possession preflight: ${display(result)}.`);
        assert(result.decision === "ACCEPT" && result.stage === "COMPLETE", `${item.id} was not COMPLETE/ACCEPT.`);
        assert(result.value?.authorization === "PREFLIGHT_ONLY", `${item.id} escaped preflight authorization.`);
        assert(result.authoritativeStateChanged === false && result.requestConsumed === false, `${item.id} changed state or consumed a request.`);
        assert(Buffer.from(result.digests.inputSha256).toString("hex") === before, `${item.id} returned the wrong input digest.`);
      }
      assertStateInputsUnchanged(item.id, trustWatch);
      assertStateInputsUnchanged(item.id, collisionWatch);
      passed += 1;
    } catch (error) {
      failures.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return Object.freeze({ attempted: cases.length, passed, failures: Object.freeze(failures) });
}
