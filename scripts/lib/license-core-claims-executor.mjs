// TEST_ONLY_DO_NOT_TRUST
// Materializes LIC-6.2-003 CLAIMS descriptors only after the production
// licensing graph has passed its isolation scan.

import { createHash } from "node:crypto";
import { decodeCanonical, encodeCanonical } from "../../licensing/vectors/v1/lib/cbor.mjs";
import { inspectCose, issueTestOnlyCose } from "../../licensing/vectors/v1/lib/cose.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";

const PERPETUAL_SENTINEL = 253_402_300_799n;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
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

function digest(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function digestHex(bytes) {
  return digest(bytes).toString("hex");
}

function sameBytes(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function integer(value) {
  return BigInt(value);
}

function differentBytes(value, label) {
  const output = Buffer.from(value);
  assert(output.length > 0, `${label} cannot alter an empty byte string.`);
  output[output.length - 1] ^= digest(Buffer.from(label, "utf8"))[0] || 1;
  return output;
}

function stable(value) {
  if (value instanceof Uint8Array) return `b:${Buffer.from(value).toString("hex")}`;
  if (typeof value === "bigint") return `i:${value}`;
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function snapshot(value) {
  return JSON.stringify(stable(value));
}

function assertRejected(record, result) {
  assert(result?.ok === false, `${record.id} unexpectedly accepted.`);
  assert(
    result.stage === record.expected.stage && result.errorCode === record.expected.errorCode,
    `${record.id} rejected as ${result.stage}/${result.errorCode}; expected ${record.expected.stage}/${record.expected.errorCode}.`,
  );
  assert(result.authoritativeStateChanged === false, `${record.id} reported authoritative state mutation.`);
  assert(result.requestConsumed === false, `${record.id} reported request consumption.`);
}

function assertAccepted(label, result) {
  assert(result?.ok === true, `${label} setup rejected as ${result?.stage}/${result?.errorCode}.`);
  assert(result.authoritativeStateChanged === false, `${label} setup reported authoritative state mutation.`);
  assert(result.requestConsumed === false, `${label} setup reported request consumption.`);
  assert(result.value?.authorization === "PREFLIGHT_ONLY", `${label} setup escaped preflight authority.`);
  return result.value;
}

function verifyAccepted(state, label, type, encoded, context) {
  const inputBefore = digestHex(encoded);
  const contextBefore = context === undefined ? undefined : snapshot(context);
  const result = state.verifier.verifySignedObject({
    expectedType: type,
    encoded: new Uint8Array(encoded),
    ...(context ? { context } : {}),
  });
  assert(digestHex(encoded) === inputBefore, `${label} setup input was mutated.`);
  if (context !== undefined) assert(snapshot(context) === contextBefore, `${label} setup context was mutated.`);
  return assertAccepted(label, result);
}

function verifyRejected(state, record, encoded, context) {
  verifyRejectedAs(state, record, record.tokenType, encoded, context);
}

function verifyRejectedAs(state, record, expectedType, encoded, context) {
  const inputBefore = digestHex(encoded);
  const contextBefore = context === undefined ? undefined : snapshot(context);
  const result = state.verifier.verifySignedObject({
    expectedType,
    encoded: new Uint8Array(encoded),
    ...(context ? { context } : {}),
  });
  assert(digestHex(encoded) === inputBefore, `${record.id} input was mutated.`);
  if (context !== undefined) assert(snapshot(context) === contextBefore, `${record.id} context was mutated.`);
  assertRejected(record, result);
}

function positive(state, id) {
  const vector = state.positives.get(id);
  assert(vector, `Missing positive fixture ${id}.`);
  const encoded = Buffer.from(state.golden.readData(vector.path));
  assert(digestHex(encoded) === vector.sha256, `${id} bytes drifted from the pinned index.`);
  return { vector, encoded, payload: clone(inspectCose(encoded).payload) };
}

function issue(type, payload, signerKeyId) {
  const signer = TEST_ONLY_KEYS[signerKeyId];
  assert(signer, `Missing TEST_ONLY signer ${signerKeyId}.`);
  return Buffer.from(issueTestOnlyCose(type, payload, signer).coseBytes);
}

function claimsPositiveId(record) {
  if (record.id.includes("ENTITLEMENT_NO_RETRY_MARGIN")) return "pos-entitlement-initial-hybrid";
  if (record.id.includes("ENTITLEMENT_REACTIVATION_REFERENCE_MISSING")) return "pos-entitlement-reactivated";
  if (record.id.includes("LEASE_REBIND_REFERENCE_MISSING")) return "pos-lease-rebind-reference";
  if (record.id.includes("OFFLINE_CONTROL_REQUEST_HASH_MISMATCH")) return "pos-control-request-unsuspend";
  if (record.id.includes("LEASE_REQUEST_ACTIVE_REBIND")) return "pos-lease-request-check-in-rebind";
  if (record.id.includes("KEY_DENYLIST_ENTRY_UNSIGNED_BYTE_ORDER")) return "pos-denylist-revision-2";
  if (record.id.includes("TIME_RECOVERY_LEASE_ISSUED_AT")) return "pos-lease-positive-control";
  return record.basePositiveId;
}

function requestResponseFields(payload) {
  if (payload.tokenType === "lease") {
    return { requestId: payload.leaseRequestId, requestHash: payload.leaseRequestHash };
  }
  return { requestId: payload.requestId, requestHash: payload.requestHash };
}

function matchingRequest(state, responsePayload) {
  const target = requestResponseFields(responsePayload);
  assert(target.requestId instanceof Uint8Array && target.requestHash instanceof Uint8Array, "Response has no request binding.");
  for (const vector of state.golden.index.positive) {
    if (!vector.kind || vector.kind !== "SIGNED_OBJECT") continue;
    if (!vector.tokenType || !["activation-request", "lease-request"].includes(vector.tokenType)) continue;
    const candidate = positive(state, vector.id);
    if (!sameBytes(candidate.payload.requestId, target.requestId)) continue;
    if (!sameBytes(digest(candidate.encoded), target.requestHash)) continue;
    const artifact = verifyAccepted(state, `${vector.id} request`, vector.tokenType, candidate.encoded);
    const requestPayload = artifact.payload;
    return {
      tokenType: vector.tokenType,
      requestPurpose: requestPayload.requestPurpose,
      requestId: Buffer.from(requestPayload.requestId),
      requestHash: digest(candidate.encoded),
      requestNonce: Buffer.from(requestPayload.requestNonce),
      encodedRequest: Buffer.from(candidate.encoded),
      payload: clone(requestPayload),
      challengeConsumed: false,
      ...(requestPayload.requestPurpose === "TIME_RECOVERY" ? { sameBootElapsedSeconds: 1n } : {}),
    };
  }
  fail(`No exact positive request matches ${responsePayload.tokenType}.`);
}

function matchingEntitlement(state, payload) {
  assert(payload.entitlementTokenId instanceof Uint8Array, `${payload.tokenType} has no Entitlement reference.`);
  for (const vector of state.golden.index.positive) {
    if (vector.kind !== "SIGNED_OBJECT" || vector.tokenType !== "entitlement") continue;
    const candidate = positive(state, vector.id);
    if (!sameBytes(candidate.payload.tokenId, payload.entitlementTokenId)) continue;
    const artifact = verifyAccepted(state, `${vector.id} parent`, "entitlement", candidate.encoded);
    return entitlementSnapshot(artifact.payload, candidate.encoded);
  }
  fail(`No exact positive Entitlement matches ${payload.tokenType}.`);
}

function entitlementSnapshot(payload, encoded) {
  return {
    tokenId: Buffer.from(payload.tokenId),
    tokenHash: digest(encoded),
    generation: payload.generation,
    edition: payload.edition,
    licenseId: Buffer.from(payload.licenseId),
    activationId: Buffer.from(payload.activationId),
    installationId: Buffer.from(payload.installationId),
    deviceKeyId: Buffer.from(payload.deviceKeyId),
    assurance: payload.assurance,
    mode: payload.mode,
    features: [...payload.features],
    notAfter: payload.notAfter,
    graceUntil: payload.graceUntil,
    ...(payload.checkCadenceSeconds !== undefined ? { checkCadenceSeconds: payload.checkCadenceSeconds } : {}),
    ...(payload.offlineAllowanceSeconds !== undefined ? { offlineAllowanceSeconds: payload.offlineAllowanceSeconds } : {}),
  };
}

function buildSnapshot(payload) {
  const zero = Buffer.alloc(32);
  return {
    productVersion: "1.0.0",
    edition: payload.edition ?? "ATTENDANCE",
    versionIdentitySha256: Buffer.from(payload.versionIdentitySha256 ?? zero),
    buildIdentitySha256: Buffer.from(payload.buildIdentitySha256 ?? zero),
    buildManifestSha256: Buffer.from(payload.buildManifestSha256 ?? zero),
  };
}

function deviceSnapshot(payload, bindingRecoveryTokenId = payload.bindingRecoveryTokenId) {
  return {
    installationId: Buffer.from(payload.installationId),
    deviceKeyId: Buffer.from(payload.deviceKeyId),
    assurance: payload.assurance ?? payload.bindingKind ?? "TPM_ATTESTED",
    ...(bindingRecoveryTokenId !== undefined ? { bindingRecoveryTokenId: Buffer.from(bindingRecoveryTokenId) } : {}),
  };
}

function contextFor(record, state, payload) {
  const id = record.id;
  const operation = record.mutation.operation;
  if (id.includes("LEASE_REQUEST_BUILD_MANIFEST_HASH_MISMATCH") || id.includes("RECOVERY_WRONG_EDITION")) {
    return { build: buildSnapshot(payload) };
  }
  if (
    id.includes("LEASE_PARENT_") ||
    id.includes("LEASE_OFFLINE_UNTIL_AFTER_PARENT") ||
    id.includes("LEASE_OFFLINE_ALLOWANCE_EXCEEDED") ||
    id.includes("LEASE_FEATURE_WIDENING") ||
    id.includes("LEASE_OFFLINE_UNTIL_BELOW_EXACT") ||
    id.includes("RECOVERY_FEATURE_WIDENING")
  ) {
    return { parent: matchingEntitlement(state, payload) };
  }
  if (
    id.includes("LEASE_REQUEST_HASH_MISMATCH") ||
    id.includes("OFFLINE_CONTROL_REQUEST_HASH_MISMATCH") ||
    id.includes("REACTIVATION_AUTHORIZATION_FINAL_") ||
    id.includes("REACTIVATION_AUTHORIZATION_REQUEST_HASH") ||
    id.includes("RECOVERY_INCIDENT_MISMATCH") ||
    id.includes("RECOVERY_REQUEST_HASH_MISMATCH") ||
    id.includes("TIME_CORRECTION_INCIDENT_MISMATCH") ||
    id.includes("TIME_CORRECTION_REQUEST_HASH_MISMATCH") ||
    id.includes("TIME_RECOVERY_LEASE_ISSUED_AT") ||
    id.includes("ENTITLEMENT_REACTIVATION_REFERENCE_MISSING")
  ) {
    return { request: matchingRequest(state, payload) };
  }
  if (id.includes("LEASE_REBIND_REFERENCE_MISSING")) {
    return { device: deviceSnapshot(payload, payload.bindingRecoveryTokenId) };
  }
  if (id.includes("LEASE_REQUEST_ACTIVE_REBIND")) {
    return { device: deviceSnapshot(payload, payload.bindingRecoveryTokenId) };
  }
  if (id.includes("LEASE_REQUEST_UNEXPECTED_REBIND")) {
    return { device: deviceSnapshot(payload, undefined) };
  }
  if (operation === "setIssuedAtBeyondTrustedFutureTolerance") {
    return payload.tokenType === "activation-request"
      ? { vendorUtc: integer(payload.issuedAt) }
      : { trustedNow: integer(payload.issuedAt) };
  }
  return undefined;
}

function makeShortValidatedParent(state, leasePayload) {
  const source = positive(state, "pos-entitlement-initial-hybrid");
  assert(sameBytes(source.payload.tokenId, leasePayload.entitlementTokenId), "Short parent token id does not match Lease.");
  const payload = clone(source.payload);
  payload.termStartsAt = leasePayload.notBefore;
  payload.termEndsAt = leasePayload.offlineUntil;
  payload.warningLeadSeconds = 86_400n;
  payload.warningStartsAt = integer(payload.termEndsAt) - integer(payload.warningLeadSeconds);
  payload.graceUntil = leasePayload.notAfter;
  payload.graceSeconds = integer(payload.graceUntil) - integer(payload.termEndsAt);
  payload.notBefore = leasePayload.notBefore;
  payload.issuedAt = leasePayload.notBefore;
  payload.notAfter = leasePayload.notAfter;
  const encoded = issue("entitlement", payload, source.vector.signerKeyId);
  const artifact = verifyAccepted(state, "short-lived parent", "entitlement", encoded);
  return entitlementSnapshot(artifact.payload, encoded);
}

function equivalentNonCanonicalSpki(spki) {
  const input = Buffer.from(spki);
  assert(input[0] === 0x30 && input[1] < 0x80 && input.length === input[1] + 2, "Unexpected canonical SPKI fixture.");
  return Buffer.concat([Buffer.from([0x30, 0x81, input[1]]), input.subarray(2)]);
}

function addAllowedFeatureNotPresent(payload) {
  const candidates = [
    "ATTENDANCE_EXPORT",
    "ATTENDANCE_DASHBOARD",
    "ATTENDANCE_COMPLIANCE",
    "AUDIT_LOGS",
    "BACKUPS",
  ];
  const feature = candidates.find((item) => !payload.features.includes(item));
  assert(feature, "No permitted feature is available for widening.");
  payload.features.push(feature);
  payload.features.sort();
}

function mutatePayload(record, payload, context) {
  const mutation = record.mutation;
  switch (mutation.operation) {
    case "makeDeviceKeyIdDifferFromSpkiHash":
      payload.deviceKeyId = differentBytes(payload.deviceKeyId, record.id);
      break;
    case "setEnvelopeLifetime": {
      const start = payload.notBefore === undefined || payload.issuedAt < payload.notBefore
        ? payload.issuedAt
        : payload.notBefore;
      payload.notAfter = integer(start) + BigInt(mutation.actualSeconds);
      break;
    }
    case "replaceNestedHash":
      payload.tpmEvidence.set(
        "contextHash",
        differentBytes(payload.tpmEvidence.get("contextHash"), record.id),
      );
      break;
    case "replacePayloadField":
      if (mutation.valueDescriptor === "different-uint") payload[mutation.field] = integer(payload[mutation.field]) + 1n;
      else if (mutation.valueDescriptor === "other-edition") payload[mutation.field] = payload[mutation.field] === "FULL" ? "ATTENDANCE" : "FULL";
      else payload[mutation.field] = differentBytes(payload[mutation.field], record.id);
      break;
    case "makeDelegatedKeyIdDifferFromSpkiHash":
      payload.delegatedKeyId = differentBytes(payload.delegatedKeyId, record.id);
      break;
    case "replaceDelegatedPublicKey":
      payload.delegatedPublicKey = equivalentNonCanonicalSpki(payload.delegatedPublicKey);
      break;
    case "setPerpetualSentinel":
      payload.termEndsAt = PERPETUAL_SENTINEL;
      break;
    case "setBusinessTermDuration":
      payload.termEndsAt = integer(payload.termStartsAt) + BigInt(mutation.actualSeconds);
      payload.warningStartsAt = integer(payload.termEndsAt) - integer(payload.warningLeadSeconds);
      payload.graceUntil = integer(payload.termEndsAt) + integer(payload.graceSeconds);
      payload.notAfter = integer(payload.graceUntil) + 86_400n;
      break;
    case "violateEntitlementTimeOrder":
      payload.termStartsAt = payload.termEndsAt;
      break;
    case "makeWarningStartInconsistentWithLead":
      payload.warningStartsAt = integer(payload.warningStartsAt) + 1n;
      break;
    case "makeGraceUntilInconsistentWithGrace":
      payload.graceUntil = integer(payload.graceUntil) + 1n;
      break;
    case "setHybridPolicyCombination":
      payload.checkCadenceSeconds = BigInt(mutation.checkCadenceSeconds);
      payload.offlineAllowanceSeconds = BigInt(mutation.offlineAllowanceSeconds);
      payload.timeRecoveryRttSeconds = 300n;
      break;
    case "removeConditionalField":
      delete payload[mutation.field];
      break;
    case "violateLeaseTimeOrder":
      payload.offlineUntil = integer(payload.notAfter) + 1n;
      break;
    case "setOfflineUntilAfterParentNotAfter":
      payload.offlineUntil = integer(context.parent.notAfter) + 1n;
      payload.notAfter = integer(payload.offlineUntil) + 1n;
      break;
    case "setOfflineUntilBeyondParentAllowance":
      payload.offlineUntil = integer(payload.serverTime) + integer(context.parent.offlineAllowanceSeconds) + 1n;
      break;
    case "addFeatureNotInParent":
      addAllowedFeatureNotPresent(payload);
      break;
    case "setEffectiveAtOutsideEnvelope":
      payload.effectiveAt = mutation.position === "before-notBefore" ? integer(payload.notBefore) - 1n : payload.notAfter;
      break;
    case "setNewLineageEqualToRevokedLineage":
      payload.newLicenseId = Buffer.from(payload.revokedLicenseId);
      break;
    case "setNewStateGenerationNotExpectedPlusOne":
      payload.newStateGeneration = payload.expectedStateGeneration;
      break;
    case "setMaximumFeaturesAboveCurrent": {
      const candidates = ["ATTENDANCE_EXPORT", "ATTENDANCE_DASHBOARD", "AUDIT_LOGS", "BACKUPS"];
      const feature = candidates.find((item) => !payload.maximumFeatures.includes(item));
      assert(feature, "No permitted Recovery feature is available for widening.");
      payload.maximumFeatures.push(feature);
      payload.maximumFeatures.sort();
      break;
    }
    case "setNotBeforeGreaterThanOrEqualToNotAfter":
      payload.notBefore = payload.notAfter;
      break;
    case "setIssuedAtGreaterThanOrEqualToNotAfter":
      payload.issuedAt = payload.notAfter;
      break;
    case "orderDeniedKeysAgainstUnsignedByteLexicographicOrder":
      assert(payload.deniedKeys.length > 1, "Denylist ordering mutation needs two entries.");
      payload.deniedKeys.reverse();
      break;
    case "setMinimumProductVersionMajorAboveMaximumMajorVersion":
      payload.minimumProductVersion = `${integer(payload.maximumMajorVersion) + 1n}.0.0`;
      break;
    case "addEditionDisallowedFeature":
      payload.features.push(mutation.feature);
      payload.features.sort();
      break;
    case "setIssuedAtBeyondTrustedFutureTolerance":
      payload.issuedAt = integer(payload.issuedAt) + BigInt(mutation.actualFutureOffsetSeconds);
      break;
    case "setOfflineUntilBelowExactFormula":
      payload.offlineUntil = integer(payload.offlineUntil) - 1n;
      break;
    case "setOperationalRemainingWindow":
      payload.offlineUntil = integer(payload.serverTime) + BigInt(mutation.actualRemainingSeconds);
      break;
    case "setTimeCorrectionIssuedAtAboveCorrectedUtcTolerance":
      payload.issuedAt = integer(payload.correctedUtc) + BigInt(mutation.actualOffsetSeconds);
      break;
    case "setTimeRecoveryLeaseIssuedAtDifferentFromServerTime":
      payload.issuedAt = integer(payload.serverTime) + 1n;
      break;
    case "setPayloadFieldBelowSealedHighWater":
      break;
    case "addConditionalField":
      payload[mutation.field] = digest(Buffer.from(record.id, "utf8")).subarray(0, 16);
      break;
    default:
      fail(`Unhandled CLAIMS mutation ${mutation.operation}.`);
  }
}

function prepareSignedScenario(record, state) {
  const base = positive(state, claimsPositiveId(record));
  let baselinePayload = clone(base.payload);
  let baselineEncoded = Buffer.from(base.encoded);

  if (record.mutation.operation === "setPayloadFieldBelowSealedHighWater") {
    if (record.mutation.field === "issuedAt") {
      baselinePayload.preIncidentClockHighWater = baselinePayload.issuedAt;
    } else {
      baselinePayload.issuedAt = baselinePayload.correctedUtc;
      baselinePayload.preIncidentClockHighWater = baselinePayload.correctedUtc;
    }
    baselineEncoded = issue(record.tokenType, baselinePayload, base.vector.signerKeyId);
  }

  let context = contextFor(record, state, baselinePayload);
  if (record.mutation.operation === "setOfflineUntilAfterParentNotAfter") {
    context = { parent: makeShortValidatedParent(state, baselinePayload) };
  }
  verifyAccepted(state, `${record.id} baseline`, record.tokenType, baselineEncoded, context);
  return { base, baselinePayload, baselineEncoded, context };
}

function runContextMutation(record, state) {
  const base = positive(state, claimsPositiveId(record));
  const payload = base.payload;
  if (record.mutation.operation === "setActivationRequestAdmissionReferenceAtNotAfter") {
    verifyAccepted(state, `${record.id} baseline`, record.tokenType, base.encoded, { vendorUtc: integer(payload.notAfter) - 1n });
    verifyRejected(state, record, base.encoded, { vendorUtc: integer(payload.notAfter) });
    return;
  }
  if (record.mutation.operation === "setOrdinaryAdmissionTrustedNowAtNotAfter") {
    verifyAccepted(state, `${record.id} baseline`, record.tokenType, base.encoded, { trustedNow: integer(payload.notAfter) - 1n });
    verifyRejected(state, record, base.encoded, { trustedNow: integer(payload.notAfter) });
    return;
  }
  fail(`Unhandled CLAIMS context mutation ${record.mutation.operation}.`);
}

function runDenylistExpiredImport(record, state) {
  const base = positive(state, claimsPositiveId(record));
  const artifact = verifyAccepted(state, `${record.id} signed baseline`, "key-denylist", base.encoded);
  const tokenHash = digest(base.encoded);
  const accepted = state.production.core.validateDenylistUpdateV1({
    payload: artifact.payload,
    tokenHash: Buffer.from(tokenHash),
    importedAt: integer(artifact.payload.notAfter) - 1n,
  });
  assert(accepted.revision === artifact.payload.denylistRevision, `${record.id} baseline import did not accept.`);
  const payloadBefore = snapshot(artifact.payload);
  const hashBefore = digestHex(tokenHash);
  let caught;
  try {
    state.production.core.validateDenylistUpdateV1({
      payload: artifact.payload,
      tokenHash: Buffer.from(tokenHash),
      importedAt: artifact.payload.notAfter,
    });
  } catch (error) {
    caught = error;
  }
  assert(caught?.stage === record.expected.stage && caught?.code === record.expected.errorCode,
    `${record.id} import rejected as ${caught?.stage}/${caught?.code}.`);
  assert(snapshot(artifact.payload) === payloadBefore, `${record.id} import mutated its payload.`);
  assert(digestHex(tokenHash) === hashBefore, `${record.id} import mutated its hash.`);
}

function runForbiddenResponsePair(record, state) {
  const request = positive(state, "pos-activation-control");
  const response = positive(state, "pos-entitlement-initial-offline");
  const requestArtifact = verifyAccepted(state, `${record.id} request`, "activation-request", request.encoded);
  verifyAccepted(state, `${record.id} independent response`, "entitlement", response.encoded);
  const requestPayload = requestArtifact.payload;
  const requestSnapshot = {
    tokenType: "activation-request",
    requestPurpose: requestPayload.requestPurpose,
    requestId: Buffer.from(requestPayload.requestId),
    requestHash: digest(request.encoded),
    requestNonce: Buffer.from(requestPayload.requestNonce),
    encodedRequest: Buffer.from(request.encoded),
    payload: clone(requestPayload),
    challengeConsumed: false,
  };
  const responsePayload = clone(response.payload);
  responsePayload.requestId = Buffer.from(requestPayload.requestId);
  responsePayload.requestHash = digest(request.encoded);
  responsePayload.edition = requestPayload.edition;
  responsePayload.installationId = Buffer.from(requestPayload.installationId);
  responsePayload.deviceKeyId = Buffer.from(requestPayload.deviceKeyId);
  responsePayload.assurance = requestPayload.bindingKind;
  const encoded = issue("entitlement", responsePayload, response.vector.signerKeyId);
  verifyRejectedAs(state, record, "entitlement", encoded, { request: requestSnapshot });
}

function carrierVector(state, id) {
  const vector = state.positives.get(id);
  assert(vector?.kind === "CARRIER", `Missing carrier fixture ${id}.`);
  const encoded = Buffer.from(state.golden.readData(vector.path));
  assert(digestHex(encoded) === vector.sha256, `${id} carrier bytes drifted.`);
  return { vector, encoded };
}

function timeRecoveryCarrierContext(state) {
  const lease = positive(state, "pos-lease-positive-control");
  const request = matchingRequest(state, lease.payload);
  assert(request.requestPurpose === "TIME_RECOVERY", "Carrier setup did not resolve a Time Recovery request.");
  const parent = matchingEntitlement(state, lease.payload);
  const trustedDevice = state.trustConfiguration.trustedKeys.find((entry) =>
    sameBytes(entry.kid, lease.payload.deviceKeyId),
  );
  assert(trustedDevice, "Carrier setup has no trusted installation-device SPKI.");
  return {
    build: buildSnapshot(lease.payload),
    device: {
      ...deviceSnapshot(lease.payload),
      devicePublicKey: Buffer.from(trustedDevice.spkiDer),
    },
    parent,
    request,
    state: {
      stateGeneration: integer(request.payload.stateGeneration),
      entitlementGeneration: integer(request.payload.entitlementGeneration),
      leaseRevision: integer(request.payload.lastLeaseRevision),
      controlRevision: integer(request.payload.controlRevision),
      controlState: request.payload.controlState,
      controlEffectiveAt: integer(request.payload.controlEffectiveAt),
      controlReasonCode: integer(request.payload.controlReasonCode),
      timeCorrectionRevision: 0n,
      clockHighWater: integer(request.payload.preIncidentClockHighWater),
      activeIncidentId: Buffer.from(request.payload.incidentId),
      activeIncidentNonce: Buffer.from(request.payload.incidentNonce),
      terminallyRevoked: false,
    },
  };
}

function parseCarrierAccepted(state, label, encoded, context) {
  const before = digestHex(encoded);
  const contextBefore = snapshot(context);
  const result = state.verifier.verifyCarrier({
    carrierType: "lease-response",
    encoded: new Uint8Array(encoded),
    context,
  });
  assert(digestHex(encoded) === before, `${label} carrier input was mutated.`);
  assert(snapshot(context) === contextBefore, `${label} carrier context was mutated.`);
  assert(result?.ok === true, `${label} carrier setup rejected as ${result?.stage}/${result?.errorCode}.`);
  assert(result.value?.authority === "NONE_TRANSPORT_ONLY", `${label} carrier gained authority.`);
}

function parseCarrierRejected(state, record, encoded, context) {
  const before = digestHex(encoded);
  const contextBefore = snapshot(context);
  const result = state.verifier.verifyCarrier({
    carrierType: "lease-response",
    encoded: new Uint8Array(encoded),
    context,
  });
  assert(digestHex(encoded) === before, `${record.id} carrier input was mutated.`);
  assert(snapshot(context) === contextBefore, `${record.id} carrier context was mutated.`);
  assertRejected(record, result);
}

function runCarrierClaims(record, state) {
  const valid = carrierVector(state, "pos-carrier-lease-response-time-recovery");
  const context = timeRecoveryCarrierContext(state);
  parseCarrierAccepted(state, `${record.id} baseline`, valid.encoded, context);
  if (record.mutation.operation === "pairTimeRecoveryRequestWithControlOnlyLeaseResponseCarrier") {
    const mutated = carrierVector(state, "pos-carrier-lease-response-control-only");
    const carrier = clone(decodeCanonical(mutated.encoded));
    assert(carrier instanceof Map, `${record.id} carrier is not a CBOR map.`);
    carrier.set("requestId", Buffer.from(context.request.requestId));
    parseCarrierRejected(state, record, Buffer.from(encodeCanonical(carrier)), context);
    return;
  }
  if (record.mutation.operation === "addForbiddenTrustBundleToTimeRecoveryLeaseResponse") {
    const carrier = clone(decodeCanonical(valid.encoded));
    assert(carrier instanceof Map, `${record.id} carrier is not a CBOR map.`);
    carrier.set("trustBundle", carrierVector(state, "pos-carrier-trust-bundle").encoded);
    parseCarrierRejected(state, record, Buffer.from(encodeCanonical(carrier)), context);
    return;
  }
  fail(`Unhandled carrier CLAIMS mutation ${record.mutation.operation}.`);
}

export function runLic003ClaimsRecord(record, state) {
  if (record.mutation.operation === "importAfterNotAfter") {
    runDenylistExpiredImport(record, state);
    return;
  }
  if (record.mutation.operation === "pairRequestWithResponseForbiddenByPurposeMatrix") {
    runForbiddenResponsePair(record, state);
    return;
  }
  if (
    record.mutation.operation === "pairTimeRecoveryRequestWithControlOnlyLeaseResponseCarrier" ||
    record.mutation.operation === "addForbiddenTrustBundleToTimeRecoveryLeaseResponse"
  ) {
    runCarrierClaims(record, state);
    return;
  }
  if (
    record.mutation.operation === "setActivationRequestAdmissionReferenceAtNotAfter" ||
    record.mutation.operation === "setOrdinaryAdmissionTrustedNowAtNotAfter"
  ) {
    runContextMutation(record, state);
    return;
  }

  const scenario = prepareSignedScenario(record, state);
  const payload = clone(scenario.baselinePayload);
  mutatePayload(record, payload, scenario.context);
  if (record.mutation.operation === "setPayloadFieldBelowSealedHighWater") {
    payload[record.mutation.field] = integer(payload.preIncidentClockHighWater) - 1n;
  }
  const encoded = issue(record.tokenType, payload, scenario.base.vector.signerKeyId);
  verifyRejected(state, record, encoded, scenario.context);
}
