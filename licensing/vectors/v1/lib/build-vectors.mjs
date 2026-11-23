// TEST_ONLY_DO_NOT_TRUST: deterministic golden-vector fixture issuer.

import { readFileSync } from "node:fs";
import path from "node:path";
import { CborTag, decodeCanonical, encodeCanonical, mapToObject } from "./cbor.mjs";
import {
  PROTOCOL_MANIFEST_SHA256,
  TYPE_CONTRACTS,
  issueTestOnlyCose,
  mediaTypeFor,
  verifySignedObject,
} from "./cose.mjs";
import { P256_ORDER, sha256 } from "./ecdsa-rfc6979.mjs";
import { TEST_ONLY_KEYS, testOnlyKey } from "../test-only/keys.mjs";

const BASE_TIME = 1800000000;
const DEVICE_PRIMARY = "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY";
const DEVICE_REBIND = "TEST_ONLY_INSTALLATION_DEVICE_REBIND";
const ROOT = "TEST_ONLY_PROD_ROOT_PRIMARY";
const ENTITLEMENT = "TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY";
const LEASE = "TEST_ONLY_ONLINE_LEASE_PRIMARY";
const CONTROL = "TEST_ONLY_OFFLINE_CONTROL_PRIMARY";
const RECOVERY = "TEST_ONLY_RECOVERY_PRIMARY";
const ALL_FEATURES = [
  "ADMIN_USERS", "ATTENDANCE_COMPLIANCE", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "CUSTOMERS",
  "CUSTOMER_PAYMENTS", "DEVICES", "DEVICE_DIAGNOSTICS", "DOOR_CONTROL", "EMPLOYEES",
  "ENTRY_LOGS", "EXPENSES", "FINANCIAL_REPORTS", "INBOX", "MEMBERSHIPS", "PAYROLL",
  "SOUNDS", "STAFF_GROUPS",
];
const ATTENDANCE_FEATURES = ["ATTENDANCE_DAILY", "ATTENDANCE_REPORTS", "AUTH", "EMPLOYEES"];

function hash(input) {
  return sha256(Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"));
}

function hashHex(input) {
  return hash(input).toString("hex");
}

function opaque(label) {
  return hash(`ENTRY_CONTROL_SYSTEM:TEST_ONLY:OPAQUE:V1:${label}`).subarray(0, 16);
}

function digest(label) {
  return hash(`ENTRY_CONTROL_SYSTEM:TEST_ONLY:DIGEST:V1:${label}`);
}

function nonce(label) {
  return hash(`ENTRY_CONTROL_SYSTEM:TEST_ONLY:NONCE:V1:${label}`);
}

function cloneValue(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

function jsonBytes(value, compact = false) {
  return Buffer.from(`${JSON.stringify(value, null, compact ? 0 : 2)}\n`, "ascii");
}

function keyFileName(id) {
  return `${id.toLowerCase().replaceAll("_", "-")}.spki.der`;
}

function fixturePath(kind, id) {
  return `fixtures/${kind}/${id}.cbor`;
}

function commonHashClaims() {
  return {
    versionIdentitySha256: digest("VERSION_IDENTITY"),
    buildIdentitySha256: digest("BUILD_IDENTITY"),
    buildManifestSha256: digest("BUILD_MANIFEST"),
  };
}

function controlTuple(revision = 0, state = "OPERATIONAL", effectiveAt = 0, reasonCode = 0) {
  return { controlRevision: revision, controlState: state, controlEffectiveAt: effectiveAt, controlReasonCode: reasonCode };
}

function activationCommon(id, keyId = DEVICE_PRIMARY, options = {}) {
  const key = testOnlyKey(keyId);
  const common = {
    protocolVersion: 1,
    tokenType: "activation-request",
    requestId: opaque(`${id}:REQUEST`),
    requestNonce: nonce(`${id}:REQUEST`),
    keyId: key.kid,
    issuedAt: BASE_TIME,
    notAfter: BASE_TIME + 3600,
    productId: "ENTRY_CONTROL_SYSTEM",
    edition: options.edition ?? "ATTENDANCE",
    installationId: opaque("INSTALLATION_PRIMARY"),
    devicePublicKey: key.spkiDer,
    deviceKeyId: key.kid,
    ...commonHashClaims(),
    stateGeneration: options.stateGeneration ?? 5,
    entitlementGeneration: options.entitlementGeneration ?? 2,
    leaseRevision: options.leaseRevision ?? 7,
    ...(options.nonInitialControl ? { controlRevision: 3, controlState: "SUSPENDED" } : { controlRevision: 0, controlState: "OPERATIONAL" }),
    timeCorrectionRevision: options.timeCorrectionRevision ?? 2,
    bindingKind: options.bindingKind ?? "SOFTWARE_BOUND",
  };
  if (common.bindingKind === "TPM_ATTESTED") {
    const contextBytes = encodeCanonical([
      "ENTRY_CONTROL_SYSTEM:LICENSE:TPM_ATTESTATION_CONTEXT:V1",
      common.requestId,
      common.requestNonce,
      common.installationId,
      common.deviceKeyId,
      common.versionIdentitySha256,
      common.buildIdentitySha256,
      common.buildManifestSha256,
    ]);
    common.tpmEvidence = {
      schemaVersion: 1,
      format: "WINDOWS_CNG_TPM_KEY_ATTESTATION_V1",
      contextHash: hash(contextBytes),
      evidence: digest("SYNTHETIC_TPM_EVIDENCE"),
    };
  }
  return common;
}

function leaseRequestCommon(id, keyId = DEVICE_PRIMARY, options = {}) {
  const key = testOnlyKey(keyId);
  return {
    protocolVersion: 1,
    tokenType: "lease-request",
    requestId: opaque(`${id}:REQUEST`),
    requestNonce: nonce(`${id}:REQUEST`),
    keyId: key.kid,
    httpMethod: "POST",
    httpPath: "/v1/licensing/leases",
    productId: "ENTRY_CONTROL_SYSTEM",
    edition: options.edition ?? "ATTENDANCE",
    licenseId: options.licenseId ?? opaque("LICENSE_PRIMARY"),
    activationId: options.activationId ?? opaque("ACTIVATION_PRIMARY"),
    installationId: opaque("INSTALLATION_PRIMARY"),
    deviceKeyId: key.kid,
    entitlementTokenId: options.entitlementTokenId ?? opaque("ENTITLEMENT_HYBRID:TOKEN"),
    entitlementGeneration: 1,
    lastLeaseRevision: options.lastLeaseRevision ?? 4,
    ...(options.nonInitialControl ? controlTuple(2, "SUSPENDED", BASE_TIME - 30, 1) : controlTuple()),
    stateGeneration: 5,
    ...commonHashClaims(),
    ...(options.bindingRecoveryTokenId ? { bindingRecoveryTokenId: options.bindingRecoveryTokenId } : {}),
  };
}

function vendorCommon(tokenType, id, keyId, duration = 86400) {
  const key = testOnlyKey(keyId);
  return {
    protocolVersion: 1,
    tokenType,
    tokenId: opaque(`${id}:TOKEN`),
    keyId: key.kid,
    issuedAt: BASE_TIME + 10,
    notBefore: BASE_TIME,
    notAfter: BASE_TIME + duration,
    productId: "ENTRY_CONTROL_SYSTEM",
  };
}

function replaceMapValue(map, key, value) {
  const output = new Map(map);
  output.set(key, value);
  return output;
}

function removeMapValue(map, key) {
  const output = new Map(map);
  output.delete(key);
  return output;
}

function coseParts(issued) {
  return [issued.protectedBytes, new Map(), issued.payloadBytes, issued.signature];
}

function encodeCoseParts(parts, tag = 18) {
  return encodeCanonical(new CborTag(tag, parts));
}

export function buildVectorArtifacts(repositoryRoot) {
  const artifacts = new Map();
  const signed = [];
  const carriers = [];
  const negatives = [];
  const signedById = new Map();
  const firstByType = new Map();

  for (const key of Object.values(TEST_ONLY_KEYS).sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    artifacts.set(`keys/${keyFileName(key.id)}`, key.spkiDer);
  }

  function addSigned(id, tokenType, variant, payload, keyId) {
    const key = testOnlyKey(keyId);
    const issued = issueTestOnlyCose(tokenType, payload, key);
    const outputPath = fixturePath("positive", id);
    artifacts.set(outputPath, issued.coseBytes);
    const record = {
      id,
      kind: "SIGNED_OBJECT",
      tokenType,
      carrierType: null,
      variant,
      mediaType: issued.mediaType,
      path: outputPath,
      bytes: issued.coseBytes.length,
      sha256: issued.coseSha256,
      protectedSha256: issued.protectedSha256,
      payloadSha256: issued.payloadSha256,
      sigStructureSha256: issued.sigStructureSha256,
      signatureSha256: issued.signatureSha256,
      signerKeyId: key.id,
      signerKeyIdHex: key.kid.toString("hex"),
      expected: { decision: "ACCEPT", stage: "COMPLETE", errorCode: "NONE" },
    };
    signed.push(record);
    signedById.set(id, { record, payload, key, issued });
    if (!firstByType.has(tokenType)) firstByType.set(tokenType, id);
    return signedById.get(id);
  }

  const termEnds = BASE_TIME + 2678400;
  const entitlementBase = (id, mode, deviceKeyId = testOnlyKey(DEVICE_PRIMARY).kid, assurance = "SOFTWARE_BOUND", options = {}) => ({
    ...vendorCommon("entitlement", id, ENTITLEMENT, 3024000),
    edition: options.edition ?? "ATTENDANCE",
    customerId: opaque("CUSTOMER_PRIMARY"),
    licenseId: opaque(mode === "REACTIVATED" ? "LICENSE_NEW" : "LICENSE_PRIMARY"),
    activationId: opaque(mode === "REACTIVATED" ? "ACTIVATION_NEW" : "ACTIVATION_PRIMARY"),
    installationId: opaque("INSTALLATION_PRIMARY"),
    deviceKeyId,
    features: options.features ?? ATTENDANCE_FEATURES,
    assurance,
    termStartsAt: BASE_TIME,
    termEndsAt: termEnds,
    warningLeadSeconds: 604800,
    warningStartsAt: termEnds - 604800,
    graceSeconds: 259200,
    graceUntil: termEnds + 259200,
    clockToleranceSeconds: 300,
    minimumProductVersion: "1.0.0",
    maximumMajorVersion: 1,
  });

  // 7 activation-request purpose branches. ACTIVATE covers TPM_ATTESTED; the
  // remaining branches cover SOFTWARE_BOUND and a non-initial Control snapshot.
  const activationActivate = activationCommon("ACTIVATE_TPM", DEVICE_PRIMARY, { bindingKind: "TPM_ATTESTED", stateGeneration: 0, entitlementGeneration: 0, leaseRevision: 0, timeCorrectionRevision: 0 });
  addSigned("pos-activation-activate-tpm", "activation-request", "ACTIVATE_TPM_ATTESTED", { ...activationActivate, requestPurpose: "ACTIVATE" }, DEVICE_PRIMARY);
  const activateRequest = signedById.get("pos-activation-activate-tpm");
  const activationFull = activationCommon("ACTIVATE_FULL_SOFTWARE", DEVICE_PRIMARY, { edition: "FULL", stateGeneration: 0, entitlementGeneration: 0, leaseRevision: 0, timeCorrectionRevision: 0 });
  addSigned("pos-activation-activate-full", "activation-request", "ACTIVATE_FULL_SOFTWARE_BOUND", { ...activationFull, requestPurpose: "ACTIVATE" }, DEVICE_PRIMARY);
  const activateFullRequest = signedById.get("pos-activation-activate-full");
  const initialEntitlementPreviewPayload = {
    ...entitlementBase("ENTITLEMENT_INITIAL_OFFLINE", "OFFLINE", testOnlyKey(DEVICE_PRIMARY).kid, "TPM_ATTESTED"),
    customerDisplayName: "TEST ONLY CUSTOMER",
    generation: 1,
    mode: "OFFLINE_BOUND",
    requestId: activateRequest.payload.requestId,
    requestHash: hash(activateRequest.issued.coseBytes),
  };
  const initialEntitlementPreview = issueTestOnlyCose("entitlement", initialEntitlementPreviewPayload, testOnlyKey(ENTITLEMENT));
  const currentEntitlementTokenId = initialEntitlementPreviewPayload.tokenId;
  const currentEntitlementTokenHash = hash(initialEntitlementPreview.coseBytes);
  addSigned("pos-activation-renew", "activation-request", "RENEW_SOFTWARE_BOUND", {
    ...activationCommon("RENEW", DEVICE_PRIMARY, { entitlementGeneration: 1 }), requestPurpose: "RENEW", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), entitlementTokenId: currentEntitlementTokenId,
  }, DEVICE_PRIMARY);
  addSigned("pos-activation-control", "activation-request", "CONTROL_NON_INITIAL", {
    ...activationCommon("CONTROL", DEVICE_PRIMARY, { nonInitialControl: true }), requestPurpose: "CONTROL", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), controlAction: "UNSUSPEND", controlEffectiveAt: BASE_TIME + 120, controlReasonCode: 2,
  }, DEVICE_PRIMARY);
  addSigned("pos-activation-recover", "activation-request", "RECOVER", {
    ...activationCommon("RECOVER", DEVICE_PRIMARY, { entitlementGeneration: 1, nonInitialControl: true }), requestPurpose: "RECOVER", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), incidentId: opaque("INCIDENT_RECOVER"), incidentNonce: nonce("INCIDENT_RECOVER"), stateHash: digest("STATE_RECOVER"), entitlementTokenId: currentEntitlementTokenId, entitlementTokenHash: currentEntitlementTokenHash,
  }, DEVICE_PRIMARY);
  addSigned("pos-activation-rebind", "activation-request", "REBIND_NEW_DEVICE_PROOF", {
    ...activationCommon("REBIND", DEVICE_REBIND, { entitlementGeneration: 1, nonInitialControl: true }), requestPurpose: "REBIND", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), incidentId: opaque("INCIDENT_REBIND"), incidentNonce: nonce("INCIDENT_REBIND"), stateHash: digest("STATE_REBIND"), entitlementTokenId: currentEntitlementTokenId, entitlementTokenHash: currentEntitlementTokenHash, oldDeviceKeyId: testOnlyKey(DEVICE_PRIMARY).kid,
  }, DEVICE_REBIND);
  addSigned("pos-activation-reactivate", "activation-request", "REACTIVATE", {
    ...activationCommon("REACTIVATE"), controlRevision: 9, controlState: "REVOKED", requestPurpose: "REACTIVATE", revokedLicenseId: opaque("LICENSE_REVOKED"), revokedActivationId: opaque("ACTIVATION_REVOKED"), finalRevokeTokenHash: digest("FINAL_REVOKE"), finalControlRevision: 9, incidentId: opaque("INCIDENT_REACTIVATE"), incidentNonce: nonce("INCIDENT_REACTIVATE"), revokedLineageTombstoneId: opaque("TOMBSTONE_REVOKED"), revokedLineageTombstoneHash: digest("TOMBSTONE_REVOKED"),
  }, DEVICE_PRIMARY);
  addSigned("pos-activation-time-correct", "activation-request", "TIME_CORRECT", {
    ...activationCommon("TIME_CORRECT"), requestPurpose: "TIME_CORRECT", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), incidentId: opaque("INCIDENT_TIME"), incidentNonce: nonce("INCIDENT_TIME"), preIncidentClockHighWater: BASE_TIME - 60,
  }, DEVICE_PRIMARY);

  // 3 lease-request conditional branches.
  addSigned("pos-lease-request-check-in", "lease-request", "CHECK_IN", { ...leaseRequestCommon("CHECK_IN"), requestPurpose: "CHECK_IN" }, DEVICE_PRIMARY);
  // Added after the FULL Entitlement is issued below; the variable is declared
  // here only for the ordinary request ordering and the FULL pair is built in
  // the Lease section where its parent token is available.
  // This is the durable tokenId of pos-recovery-rebind-device.  Keep the
  // reference derived from the exact vendorCommon identifier so request,
  // lease, and Recovery cannot silently drift apart.
  const rebindReference = opaque("RECOVERY_REBIND:TOKEN");
  addSigned("pos-lease-request-check-in-rebind", "lease-request", "CHECK_IN_WITH_REBIND_REFERENCE", { ...leaseRequestCommon("CHECK_IN_REBIND", DEVICE_REBIND, { bindingRecoveryTokenId: rebindReference }), requestPurpose: "CHECK_IN" }, DEVICE_REBIND);
  addSigned("pos-lease-request-time-recovery", "lease-request", "TIME_RECOVERY", {
    ...leaseRequestCommon("TIME_RECOVERY", DEVICE_PRIMARY, { nonInitialControl: true }), requestPurpose: "TIME_RECOVERY", incidentId: opaque("INCIDENT_TIME_ONLINE"), incidentNonce: nonce("INCIDENT_TIME_ONLINE"), preIncidentClockHighWater: BASE_TIME - 60,
  }, DEVICE_PRIMARY);

  // 4 exact Delegation purpose branches.
  const delegationIds = [];
  for (const [purpose, delegatedKeyId, maximum, businessMaximum] of [
    ["OFFLINE_ENTITLEMENT", ENTITLEMENT, 35424000, 31622400],
    ["ONLINE_LEASE", LEASE, 2592000, null],
    ["OFFLINE_CONTROL", CONTROL, 2592000, null],
    ["RECOVERY", RECOVERY, 86400, null],
  ]) {
    const id = `pos-delegation-${purpose.toLowerCase().replaceAll("_", "-")}`;
    const delegated = testOnlyKey(delegatedKeyId);
    const payload = {
      ...vendorCommon("key-delegation", id, ROOT, 158112000),
      environment: "TEST",
      delegatedPublicKey: delegated.spkiDer,
      delegatedKeyId: delegated.kid,
      delegationSerial: delegationIds.length + 1,
      purpose,
      maxTokenLifetimeSeconds: maximum,
      ...(businessMaximum ? { maxBusinessTermSeconds: businessMaximum } : {}),
    };
    addSigned(id, "key-delegation", purpose, payload, ROOT);
    delegationIds.push(id);
  }

  // 2 Denylist revision union branches.
  const denylistV1 = addSigned("pos-denylist-revision-1", "key-denylist", "REVISION_1", {
    ...vendorCommon("key-denylist", "DENYLIST_V1", ROOT, 31622400), environment: "TEST", denylistRevision: 1, deniedKeys: [],
  }, ROOT);
  const deniedEntries = ["TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED", "TEST_ONLY_ONLINE_LEASE_DENIED", "TEST_ONLY_OFFLINE_CONTROL_DENIED", "TEST_ONLY_RECOVERY_DENIED"]
    .map((id, index) => ({ delegatedKeyId: testOnlyKey(id).kid, effectiveAt: BASE_TIME + 100 + index, reasonCode: (index % 3) + 1 }))
    .sort((a, b) => Buffer.compare(a.delegatedKeyId, b.delegatedKeyId));
  addSigned("pos-denylist-revision-2", "key-denylist", "REVISION_2_WITH_PREDECESSOR", {
    ...vendorCommon("key-denylist", "DENYLIST_V2", ROOT, 31622400), environment: "TEST", denylistRevision: 2, previousDenylistTokenId: denylistV1.payload.tokenId, previousDenylistHash: hash(denylistV1.issued.coseBytes), deniedKeys: deniedEntries,
  }, ROOT);

  // 4 Entitlement generation/mode branches.
  const initialOffline = addSigned("pos-entitlement-initial-offline", "entitlement", "GENERATION_1_OFFLINE", initialEntitlementPreviewPayload, ENTITLEMENT);
  if (!initialOffline.issued.coseBytes.equals(initialEntitlementPreview.coseBytes)) throw new Error("Initial Entitlement preview/regeneration drifted.");
  const initialFull = addSigned("pos-entitlement-initial-full", "entitlement", "GENERATION_1_FULL", {
    ...entitlementBase("ENTITLEMENT_INITIAL_FULL", "OFFLINE", testOnlyKey(DEVICE_PRIMARY).kid, "SOFTWARE_BOUND", { edition: "FULL", features: ALL_FEATURES }),
    generation: 1,
    mode: "HYBRID_LEASED",
    checkCadenceSeconds: 21600,
    offlineAllowanceSeconds: 604800,
    timeRecoveryRttSeconds: 300,
    requestId: activateFullRequest.payload.requestId,
    requestHash: hash(activateFullRequest.issued.coseBytes),
  }, ENTITLEMENT);
  addSigned("pos-entitlement-initial-hybrid", "entitlement", "GENERATION_1_HYBRID", {
    ...entitlementBase("ENTITLEMENT_HYBRID", "HYBRID", testOnlyKey(DEVICE_PRIMARY).kid, "TPM_ATTESTED"), generation: 1, mode: "HYBRID_LEASED", checkCadenceSeconds: 21600, offlineAllowanceSeconds: 604800, timeRecoveryRttSeconds: 300, requestId: activateRequest.payload.requestId, requestHash: hash(activateRequest.issued.coseBytes),
  }, ENTITLEMENT);
  const reactivationId = opaque("REACTIVATION_AUTHORIZATION:TOKEN");
  const reactivateRequest = signedById.get("pos-activation-reactivate");
  addSigned("pos-entitlement-reactivated", "entitlement", "GENERATION_1_REACTIVATED", {
    ...entitlementBase("ENTITLEMENT_REACTIVATED", "REACTIVATED"), generation: 1, reactivationAuthorizationId: reactivationId, mode: "HYBRID_LEASED", checkCadenceSeconds: 21600, offlineAllowanceSeconds: 604800, timeRecoveryRttSeconds: 300, requestId: reactivateRequest.payload.requestId, requestHash: hash(reactivateRequest.issued.coseBytes),
  }, ENTITLEMENT);
  const renewRequest = signedById.get("pos-activation-renew");
  addSigned("pos-entitlement-renewal", "entitlement", "GENERATION_2_RENEWAL", {
    ...entitlementBase("ENTITLEMENT_RENEWAL", "OFFLINE", testOnlyKey(DEVICE_PRIMARY).kid, "SOFTWARE_BOUND"), generation: 2, previousTokenId: initialOffline.payload.tokenId, mode: "OFFLINE_BOUND", requestId: renewRequest.payload.requestId, requestHash: hash(renewRequest.issued.coseBytes),
  }, ENTITLEMENT);

  // 3 Lease Control/optional-Rebind branches.
  const hybridParentId = opaque("ENTITLEMENT_HYBRID:TOKEN");
  addSigned("pos-lease-request-check-in-full", "lease-request", "CHECK_IN_FULL", {
    ...leaseRequestCommon("CHECK_IN_FULL", DEVICE_PRIMARY, {
      edition: "FULL",
      entitlementTokenId: initialFull.payload.tokenId,
    }),
    requestPurpose: "CHECK_IN",
  }, DEVICE_PRIMARY);
  const leaseBase = (id, requestFixtureId, revision, tuple, options = {}) => {
    const request = signedById.get(requestFixtureId);
    const serverTime = BASE_TIME + 1000 + revision;
    return {
      ...vendorCommon("lease", id, LEASE, 608400), issuedAt: serverTime, edition: request.payload.edition, licenseId: request.payload.licenseId, activationId: request.payload.activationId, installationId: opaque("INSTALLATION_PRIMARY"), deviceKeyId: request.payload.deviceKeyId, mode: "HYBRID_LEASED", assurance: options.assurance ?? (request.payload.deviceKeyId.equals(testOnlyKey(DEVICE_PRIMARY).kid) ? "TPM_ATTESTED" : "SOFTWARE_BOUND"), features: options.features ?? ATTENDANCE_FEATURES, entitlementTokenId: options.entitlementTokenId ?? hybridParentId, entitlementGeneration: 1, leaseRevision: revision, serverTime, offlineUntil: serverTime + 604800, ...tuple, leaseRequestId: request.payload.requestId, leaseRequestHash: hash(request.issued.coseBytes), ...commonHashClaims(), ...(options.bindingRecoveryTokenId ? { bindingRecoveryTokenId: options.bindingRecoveryTokenId } : {}),
    };
  };
  addSigned("pos-lease-initial-control", "lease", "INITIAL_CONTROL_TUPLE", leaseBase("LEASE_INITIAL", "pos-lease-request-check-in", 5, controlTuple()), LEASE);
  addSigned("pos-lease-positive-control", "lease", "POSITIVE_SUSPENDED_CONTROL_TUPLE", leaseBase("LEASE_SUSPENDED", "pos-lease-request-time-recovery", 6, controlTuple(2, "SUSPENDED", BASE_TIME - 30, 1)), LEASE);
  addSigned("pos-lease-rebind-reference", "lease", "ACTIVE_REBIND_REFERENCE", leaseBase("LEASE_REBIND", "pos-lease-request-check-in-rebind", 7, controlTuple(), { bindingRecoveryTokenId: rebindReference }), LEASE);
  const fullLease = addSigned("pos-lease-full", "lease", "ACTIVE_FULL", leaseBase("LEASE_FULL", "pos-lease-request-check-in-full", 8, controlTuple(), { entitlementTokenId: initialFull.payload.tokenId, assurance: initialFull.payload.assurance, features: ALL_FEATURES }), LEASE);

  // 3 Offline Control actions while covering both origin union branches.
  const controlBase = (id) => ({ ...vendorCommon("offline-control", id, CONTROL, 86400), edition: "ATTENDANCE", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY") });
  addSigned("pos-control-vendor-suspend", "offline-control", "VENDOR_INITIATED_SUSPEND", { ...controlBase("CONTROL_VENDOR_SUSPEND"), origin: "VENDOR_INITIATED", controlRevision: 4, action: "SUSPEND", effectiveAt: BASE_TIME + 100, reasonCode: 1 }, CONTROL);
  const controlRequest = signedById.get("pos-activation-control");
  addSigned("pos-control-request-unsuspend", "offline-control", "REQUEST_BOUND_UNSUSPEND", { ...controlBase("CONTROL_REQUEST_UNSUSPEND"), origin: "REQUEST_BOUND", requestId: controlRequest.payload.requestId, requestHash: hash(controlRequest.issued.coseBytes), controlRevision: 5, action: "UNSUSPEND", effectiveAt: controlRequest.payload.controlEffectiveAt, reasonCode: controlRequest.payload.controlReasonCode }, CONTROL);
  addSigned("pos-control-vendor-revoke", "offline-control", "VENDOR_INITIATED_REVOKE", { ...controlBase("CONTROL_VENDOR_REVOKE"), origin: "VENDOR_INITIATED", controlRevision: 9, action: "REVOKE", effectiveAt: BASE_TIME + 200, reasonCode: 3 }, CONTROL);

  // 1 Reactivation Authorization.
  addSigned("pos-reactivation-authorization", "reactivation-authorization", "TERMINAL_LINEAGE_REPLACEMENT", {
    ...vendorCommon("reactivation-authorization", "REACTIVATION_AUTHORIZATION", CONTROL, 604800), tokenId: reactivationId, edition: "ATTENDANCE", revokedLicenseId: opaque("LICENSE_REVOKED"), revokedActivationId: opaque("ACTIVATION_REVOKED"), finalRevokeTokenHash: digest("FINAL_REVOKE"), finalControlRevision: 9, incidentId: reactivateRequest.payload.incidentId, incidentNonce: reactivateRequest.payload.incidentNonce, requestId: reactivateRequest.payload.requestId, requestHash: hash(reactivateRequest.issued.coseBytes), installationId: opaque("INSTALLATION_PRIMARY"), deviceKeyId: testOnlyKey(DEVICE_PRIMARY).kid, newLicenseId: opaque("LICENSE_NEW"), newActivationId: opaque("ACTIVATION_NEW"), maximumFeatures: ATTENDANCE_FEATURES,
  }, CONTROL);

  // 3 Recovery transition union branches.
  const recoveryBase = (id, requestFixtureId) => {
    const request = signedById.get(requestFixtureId);
    return { ...vendorCommon("recovery", id, RECOVERY, 86400), edition: "ATTENDANCE", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), installationId: opaque("INSTALLATION_PRIMARY"), incidentId: request.payload.incidentId, incidentNonce: request.payload.incidentNonce, requestId: request.payload.requestId, requestHash: hash(request.issued.coseBytes), expectedStateGeneration: 5, newStateGeneration: 6, entitlementTokenId: currentEntitlementTokenId, entitlementTokenHash: currentEntitlementTokenHash, entitlementGeneration: 1, controlRevision: 3, maximumFeatures: ATTENDANCE_FEATURES };
  };
  addSigned("pos-recovery-clear-tamper", "recovery", "CLEAR_TAMPER", { ...recoveryBase("RECOVERY_CLEAR", "pos-activation-recover"), allowedTransition: "CLEAR_TAMPER", reasonCode: 7 }, RECOVERY);
  addSigned("pos-recovery-repair-state", "recovery", "REPAIR_SECURE_STATE", { ...recoveryBase("RECOVERY_REPAIR", "pos-activation-recover"), allowedTransition: "REPAIR_SECURE_STATE", reasonCode: 2 }, RECOVERY);
  addSigned("pos-recovery-rebind-device", "recovery", "REBIND_DEVICE", { ...recoveryBase("RECOVERY_REBIND", "pos-activation-rebind"), allowedTransition: "REBIND_DEVICE", oldDeviceKeyId: testOnlyKey(DEVICE_PRIMARY).kid, newDeviceKeyId: testOnlyKey(DEVICE_REBIND).kid, newAssurance: "SOFTWARE_BOUND", reasonCode: 5 }, RECOVERY);

  // 1 Time Correction.
  const timeRequest = signedById.get("pos-activation-time-correct");
  addSigned("pos-time-correction", "time-correction", "OFFLINE_TIME_CORRECTION", {
    ...vendorCommon("time-correction", "TIME_CORRECTION", RECOVERY, 86400), edition: "ATTENDANCE", licenseId: opaque("LICENSE_PRIMARY"), activationId: opaque("ACTIVATION_PRIMARY"), installationId: opaque("INSTALLATION_PRIMARY"), deviceKeyId: testOnlyKey(DEVICE_PRIMARY).kid, incidentId: timeRequest.payload.incidentId, incidentNonce: timeRequest.payload.incidentNonce, requestId: timeRequest.payload.requestId, requestHash: hash(timeRequest.issued.coseBytes), expectedStateGeneration: 5, newStateGeneration: 6, timeCorrectionRevision: 3, preIncidentClockHighWater: BASE_TIME - 60, correctedUtc: BASE_TIME + 20, reasonCode: 1,
  }, RECOVERY);

  if (signed.length !== 35) throw new Error(`Expected 35 signed positives, built ${signed.length}.`);

  function addCarrier(id, carrierType, variant, mediaType, value) {
    const bytes = encodeCanonical(value);
    const outputPath = fixturePath("positive", id);
    artifacts.set(outputPath, bytes);
    const record = {
      id, kind: "CARRIER", tokenType: null, carrierType, variant, mediaType, path: outputPath,
      bytes: bytes.length, sha256: hashHex(bytes), protectedSha256: "", payloadSha256: "", sigStructureSha256: "", signatureSha256: "", signerKeyId: null, signerKeyIdHex: "",
      expected: { decision: "ACCEPT", stage: "COMPLETE", errorCode: "NONE" },
    };
    carriers.push(record);
    return { record, bytes };
  }

  const sortedDelegationIds = [...delegationIds].sort((left, right) => Buffer.compare(
    signedById.get(left).payload.delegatedKeyId,
    signedById.get(right).payload.delegatedKeyId,
  ));
  const trustCarrierValue = {
    schemaVersion: 1, carrierType: "trust-bundle", delegations: sortedDelegationIds.map((id) => signedById.get(id).issued.coseBytes), denylist: signedById.get("pos-denylist-revision-2").issued.coseBytes,
  };
  const trustCarrierBytes = encodeCanonical(trustCarrierValue);
  const leaseChallengeCarrier = addCarrier("pos-carrier-lease-challenge", "lease-challenge", "STANDARD", "application/vnd.entry-control.lease-challenge+cbor;v=1", { schemaVersion: 1, carrierType: "lease-challenge", requestNonce: signedById.get("pos-lease-request-check-in").payload.requestNonce, expiresInSeconds: 300 });
  addCarrier("pos-carrier-trust-bundle", "trust-bundle", "STANDARD", "application/vnd.entry-control.trust-bundle+cbor;v=1", trustCarrierValue);
  const leaseRequestId = signedById.get("pos-lease-request-check-in").payload.requestId;
  const timeRecoveryRequestId = signedById.get("pos-lease-request-time-recovery").payload.requestId;
  const timeRecoveryCarrier = addCarrier("pos-carrier-lease-response-time-recovery", "lease-response", "WITH_LEASE", "application/vnd.entry-control.lease-response+cbor;v=1", { schemaVersion: 1, carrierType: "lease-response", requestId: timeRecoveryRequestId, lease: signedById.get("pos-lease-positive-control").issued.coseBytes });
  addCarrier("pos-carrier-lease-response-control-only", "lease-response", "CONTROL_ONLY", "application/vnd.entry-control.lease-response+cbor;v=1", { schemaVersion: 1, carrierType: "lease-response", requestId: leaseRequestId, offlineControl: signedById.get("pos-control-vendor-suspend").issued.coseBytes });
  addCarrier("pos-carrier-lease-response-reactivation-only", "lease-response", "REACTIVATION_ONLY", "application/vnd.entry-control.lease-response+cbor;v=1", { schemaVersion: 1, carrierType: "lease-response", requestId: leaseRequestId, reactivationAuthorization: signedById.get("pos-reactivation-authorization").issued.coseBytes });
  const completeCarrier = addCarrier("pos-carrier-lease-response-complete", "lease-response", "WITH_LEASE", "application/vnd.entry-control.lease-response+cbor;v=1", { schemaVersion: 1, carrierType: "lease-response", requestId: leaseRequestId, lease: signedById.get("pos-lease-initial-control").issued.coseBytes, offlineControl: signedById.get("pos-control-vendor-suspend").issued.coseBytes, reactivationAuthorization: signedById.get("pos-reactivation-authorization").issued.coseBytes, trustBundle: trustCarrierBytes });
  if (carriers.length !== 6) throw new Error(`Expected 6 carrier positives, built ${carriers.length}.`);

  function semanticAssert(condition, message) {
    if (!condition) throw new Error(`Golden-vector semantic link failed: ${message}.`);
  }
  semanticAssert(activationActivate.stateGeneration === 0 && activationActivate.entitlementGeneration === 0 && activationActivate.leaseRevision === 0 && activationActivate.timeCorrectionRevision === 0, "ACTIVATE must carry fresh zero counters");
  semanticAssert(initialOffline.payload.generation === 1 && initialOffline.payload.assurance === "TPM_ATTESTED", "initial Entitlement must match ACTIVATE generation and TPM assurance");
  semanticAssert(activationFull.edition === "FULL" && activationFull.stateGeneration === 0 && activationFull.entitlementGeneration === 0 && activationFull.leaseRevision === 0 && activationFull.timeCorrectionRevision === 0, "FULL ACTIVATE must carry a fresh Software-bound snapshot");
  semanticAssert(initialFull.payload.edition === "FULL" && initialFull.payload.requestId.equals(activateFullRequest.payload.requestId) && initialFull.payload.requestHash.equals(hash(activateFullRequest.issued.coseBytes)) && initialFull.payload.features.length === ALL_FEATURES.length && initialFull.payload.features.every((feature, index) => feature === ALL_FEATURES[index]), "FULL Entitlement must bind the FULL request and exact Edition feature set");
  const fullLeaseRequest = signedById.get("pos-lease-request-check-in-full");
  semanticAssert(fullLeaseRequest.payload.edition === "FULL" && fullLeaseRequest.payload.entitlementTokenId.equals(initialFull.payload.tokenId), "FULL Lease request must bind the FULL Entitlement");
  semanticAssert(fullLease.payload.edition === "FULL" && fullLease.payload.entitlementTokenId.equals(initialFull.payload.tokenId) && fullLease.payload.assurance === initialFull.payload.assurance && fullLease.payload.leaseRequestHash.equals(hash(fullLeaseRequest.issued.coseBytes)) && fullLease.payload.features.length === ALL_FEATURES.length && fullLease.payload.features.every((feature, index) => feature === ALL_FEATURES[index]), "FULL Lease must bind its request, parent, assurance, Edition, and exact FULL feature set");
  semanticAssert(reactivateRequest.payload.controlState === "REVOKED" && reactivateRequest.payload.controlRevision === reactivateRequest.payload.finalControlRevision, "REACTIVATE must retain the terminal Revoke snapshot");
  semanticAssert(renewRequest.payload.entitlementGeneration === 1 && signedById.get("pos-entitlement-renewal").payload.generation === 2, "RENEW must link generation 1 to generation 2");
  semanticAssert(signedById.get("pos-entitlement-renewal").payload.assurance === renewRequest.payload.bindingKind, "RENEW successor must not upgrade assurance beyond request evidence");
  for (const leaseId of ["pos-lease-initial-control", "pos-lease-positive-control", "pos-lease-rebind-reference", "pos-lease-full"]) {
    const payload = signedById.get(leaseId).payload;
    semanticAssert(payload.issuedAt === payload.serverTime, `${leaseId} issuedAt must equal serverTime`);
    const request = ["pos-lease-request-check-in", "pos-lease-request-time-recovery", "pos-lease-request-check-in-rebind", "pos-lease-request-check-in-full"]
      .map((id) => signedById.get(id))
      .find((candidate) => candidate.payload.requestId.equals(payload.leaseRequestId));
    semanticAssert(request && payload.leaseRequestHash.equals(hash(request.issued.coseBytes)), `${leaseId} must hash its exact Lease request`);
    semanticAssert(payload.deviceKeyId.equals(request.payload.deviceKeyId) && payload.controlRevision === request.payload.controlRevision && payload.controlState === request.payload.controlState && payload.controlEffectiveAt === request.payload.controlEffectiveAt && payload.controlReasonCode === request.payload.controlReasonCode, `${leaseId} must match request device and Control tuple`);
    semanticAssert(payload.versionIdentitySha256.equals(request.payload.versionIdentitySha256) && payload.buildIdentitySha256.equals(request.payload.buildIdentitySha256) && payload.buildManifestSha256.equals(request.payload.buildManifestSha256), `${leaseId} must match request Build hashes`);
    semanticAssert(payload.offlineUntil === payload.serverTime + 604800 && payload.offlineUntil <= payload.notAfter, `${leaseId} must use the exact parent allowance formula`);
  }
  for (const [requestId, recoveryId] of [["pos-activation-recover", "pos-recovery-clear-tamper"], ["pos-activation-recover", "pos-recovery-repair-state"], ["pos-activation-rebind", "pos-recovery-rebind-device"]]) {
    const request = signedById.get(requestId).payload;
    const response = signedById.get(recoveryId).payload;
    semanticAssert(request.entitlementGeneration === response.entitlementGeneration && request.controlRevision === response.controlRevision && request.stateGeneration === response.expectedStateGeneration, `${recoveryId} must match its request state snapshot`);
    semanticAssert(request.entitlementTokenId.equals(initialOffline.payload.tokenId) && request.entitlementTokenHash.equals(hash(initialOffline.issued.coseBytes)) && response.entitlementTokenId.equals(request.entitlementTokenId) && response.entitlementTokenHash.equals(request.entitlementTokenHash), `${recoveryId} must bind the exact current Entitlement bytes`);
  }
  const rebindRecovery = signedById.get("pos-recovery-rebind-device").payload;
  const rebindLeaseRequest = signedById.get("pos-lease-request-check-in-rebind").payload;
  const rebindLease = signedById.get("pos-lease-rebind-reference").payload;
  semanticAssert(
    rebindLeaseRequest.bindingRecoveryTokenId.equals(rebindRecovery.tokenId)
      && rebindLease.bindingRecoveryTokenId.equals(rebindRecovery.tokenId),
    "Rebind Lease request and Lease must reference the exact durable Rebind Recovery tokenId",
  );
  const decodedTimeRecoveryCarrier = mapToObject(decodeCanonical(timeRecoveryCarrier.bytes));
  semanticAssert(!("trustBundle" in decodedTimeRecoveryCarrier) && decodedTimeRecoveryCarrier.requestId.equals(timeRecoveryRequestId), "TIME_RECOVERY carrier must contain its Lease and no trust update");
  const decodedCompleteCarrier = mapToObject(decodeCanonical(completeCarrier.bytes));
  semanticAssert(decodedCompleteCarrier.requestId.equals(leaseRequestId) && Buffer.isBuffer(decodedCompleteCarrier.trustBundle), "complete CHECK_IN carrier must bind the ordinary request and may carry trust");
  const decodedLeaseChallenge = mapToObject(decodeCanonical(leaseChallengeCarrier.bytes));
  semanticAssert(decodedLeaseChallenge.requestNonce.equals(signedById.get("pos-lease-request-check-in").payload.requestNonce), "Lease challenge nonce must be consumed by the ordinary CHECK_IN request");

  function addNegative(id, descriptorId, basePositiveId, bytes, stage, errorCode, overrides = {}) {
    const base = signedById.get(basePositiveId);
    const outputPath = fixturePath("negative", id);
    artifacts.set(outputPath, bytes);
    negatives.push({
      id, sourceDescriptorId: descriptorId, basePositiveId, tokenType: overrides.tokenType ?? base.record.tokenType,
      mediaType: overrides.mediaType ?? base.record.mediaType, signerKeyId: overrides.signerKeyId ?? base.record.signerKeyId,
      signerKeyIdHex: overrides.signerKeyIdHex ?? base.record.signerKeyIdHex, path: outputPath, bytes: bytes.length, sha256: hashHex(bytes),
      expected: { decision: "REJECT", stage, errorCode },
    });
  }

  const baseId = "pos-activation-activate-tpm";
  const base = signedById.get(baseId);
  const parts = coseParts(base.issued);
  const outer = decodeCanonical(base.issued.coseBytes);
  const headers = decodeCanonical(base.issued.protectedBytes);
  const payloadMap = decodeCanonical(base.issued.payloadBytes);
  addNegative("neg-trailing-data", "MAL_COMMON_TRAILING_DATA", baseId, Buffer.concat([base.issued.coseBytes, Buffer.from([0])]), "CBOR_PARSE", "TRAILING_DATA");
  const duplicatePayload = Buffer.concat([
    Buffer.from([0xa2]),
    encodeCanonical("protocolVersion"), encodeCanonical(1),
    encodeCanonical("protocolVersion"), encodeCanonical(1),
  ]);
  addNegative("neg-duplicate-payload-key", "MAL_COMMON_DUPLICATE_PAYLOAD_KEY", baseId, encodeCoseParts([parts[0], parts[1], duplicatePayload, parts[3]]), "CBOR_PARSE", "DUPLICATE_MAP_KEY");
  const outOfOrderPayload = Buffer.concat([
    Buffer.from([0xa2]),
    encodeCanonical("protocolVersion"), encodeCanonical(1),
    encodeCanonical("tokenType"), encodeCanonical("activation-request"),
  ]);
  addNegative("neg-out-of-order-payload-map", "MAL_COMMON_UNSORTED_MAP_KEYS", baseId, encodeCoseParts([parts[0], parts[1], outOfOrderPayload, parts[3]]), "CBOR_PARSE", "NON_CANONICAL_CBOR");
  const nonMinimalIntegerPayload = Buffer.concat([Buffer.from([0xa1]), encodeCanonical("protocolVersion"), Buffer.from([0x18, 0x01])]);
  addNegative("neg-non-minimal-integer", "MAL_COMMON_NON_MINIMAL_INTEGER", baseId, encodeCoseParts([parts[0], parts[1], nonMinimalIntegerPayload, parts[3]]), "CBOR_PARSE", "NON_CANONICAL_CBOR");
  const nonMinimalLengthPayload = Buffer.concat([Buffer.from([0xb8, 0x01]), encodeCanonical("protocolVersion"), encodeCanonical(1)]);
  addNegative("neg-non-minimal-length", "MAL_COMMON_NON_MINIMAL_LENGTH", baseId, encodeCoseParts([parts[0], parts[1], nonMinimalLengthPayload, parts[3]]), "CBOR_PARSE", "NON_CANONICAL_CBOR");
  addNegative("neg-indefinite-payload-map", "MAL_COMMON_INDEFINITE_PAYLOAD_MAP", baseId, encodeCoseParts([parts[0], parts[1], Buffer.from([0xbf, 0xff]), parts[3]]), "CBOR_PARSE", "INDEFINITE_LENGTH");
  addNegative("neg-malformed-utf8", "MAL_COMMON_MALFORMED_UTF8", baseId, encodeCoseParts([parts[0], parts[1], Buffer.from([0xa1, 0x61, 0xff, 0x00]), parts[3]]), "CBOR_PARSE", "MALFORMED_UTF8");
  addNegative("neg-activation-object-too-large", "MAL_ACTIVATION_REQUEST_OVERSIZE", baseId, Buffer.alloc(131073, 0), "PRE_DECODE", "OBJECT_TOO_LARGE");
  addNegative("neg-missing-tag", "MAL_COMMON_MISSING_TAG_18", baseId, encodeCanonical(outer.value), "COSE_PARSE", "WRONG_COSE_TAG");
  addNegative("neg-wrong-tag", "MAL_COMMON_UNEXPECTED_OUTER_TAG", baseId, encodeCoseParts(parts, 98), "COSE_PARSE", "WRONG_COSE_TAG");
  addNegative("neg-cose-array-extra", "MAL_COMMON_COSE_ARRAY_EXTRA_ITEM", baseId, encodeCoseParts([...parts, 0]), "COSE_PARSE", "INVALID_COSE_SHAPE");
  addNegative("neg-detached-payload", "MAL_COMMON_DETACHED_PAYLOAD", baseId, encodeCoseParts([parts[0], parts[1], null, parts[3]]), "COSE_PARSE", "DETACHED_PAYLOAD_FORBIDDEN");
  addNegative("neg-payload-not-bstr", "MAL_COMMON_PAYLOAD_NOT_BSTR", baseId, encodeCoseParts([parts[0], parts[1], payloadMap, parts[3]]), "COSE_PARSE", "INVALID_COSE_PAYLOAD");
  addNegative("neg-protected-not-bstr", "MAL_COMMON_PROTECTED_NOT_BSTR", baseId, encodeCoseParts([headers, parts[1], parts[2], parts[3]]), "COSE_PARSE", "INVALID_PROTECTED_HEADER");
  addNegative("neg-protected-extra", "MAL_COMMON_PROTECTED_EXTRA_HEADER", baseId, encodeCoseParts([encodeCanonical(new Map([...headers, [99, 0]])), parts[1], parts[2], parts[3]]), "COSE_PARSE", "UNKNOWN_PROTECTED_HEADER");
  addNegative("neg-unprotected-nonempty", "MAL_COMMON_UNPROTECTED_NONEMPTY", baseId, encodeCoseParts([parts[0], new Map([[4, Buffer.alloc(32)]]), parts[2], parts[3]]), "COSE_PARSE", "UNPROTECTED_HEADER_NOT_EMPTY");
  addNegative("neg-missing-alg", "MAL_COMMON_MISSING_ALG", baseId, encodeCoseParts([encodeCanonical(removeMapValue(headers, 1)), parts[1], parts[2], parts[3]]), "COSE_PARSE", "MISSING_PROTECTED_HEADER");
  addNegative("neg-wrong-alg", "MAL_COMMON_ALG_NOT_ES256", baseId, encodeCoseParts([encodeCanonical(replaceMapValue(headers, 1, -8)), parts[1], parts[2], parts[3]]), "COSE_PARSE", "WRONG_ALGORITHM");
  addNegative("neg-missing-content-type", "MAL_COMMON_MISSING_CTYP", baseId, encodeCoseParts([encodeCanonical(removeMapValue(headers, 3)), parts[1], parts[2], parts[3]]), "COSE_PARSE", "MISSING_PROTECTED_HEADER");
  addNegative("neg-wrong-content-type", "MAL_COMMON_WRONG_CTYP", baseId, encodeCoseParts([encodeCanonical(replaceMapValue(headers, 3, mediaTypeFor("lease-request"))), parts[1], parts[2], parts[3]]), "DOMAIN", "MEDIA_TYPE_MISMATCH");
  addNegative("neg-missing-kid", "MAL_COMMON_MISSING_KID", baseId, encodeCoseParts([encodeCanonical(removeMapValue(headers, 4)), parts[1], parts[2], parts[3]]), "COSE_PARSE", "MISSING_PROTECTED_HEADER");
  addNegative("neg-kid-text", "MAL_COMMON_KID_WRONG_TYPE", baseId, encodeCoseParts([encodeCanonical(replaceMapValue(headers, 4, "TEST_ONLY_KID")), parts[1], parts[2], parts[3]]), "COSE_PARSE", "WRONG_HEADER_TYPE");
  addNegative("neg-kid-31-bytes", "MAL_COMMON_KID_WRONG_LENGTH", baseId, encodeCoseParts([encodeCanonical(replaceMapValue(headers, 4, base.key.kid.subarray(0, 31))), parts[1], parts[2], parts[3]]), "COSE_PARSE", "WRONG_KEY_ID_LENGTH");
  addNegative("neg-payload-kid-mismatch", "MAL_COMMON_KID_PAYLOAD_KEYID_MISMATCH", baseId, encodeCoseParts([parts[0], parts[1], encodeCanonical(replaceMapValue(payloadMap, "keyId", testOnlyKey(DEVICE_REBIND).kid)), parts[3]]), "DOMAIN", "KEY_ID_MISMATCH");
  addNegative("neg-token-type-mismatch", "MAL_COMMON_TOKEN_TYPE_MISMATCH", baseId, encodeCoseParts([parts[0], parts[1], encodeCanonical(replaceMapValue(payloadMap, "tokenType", "lease-request")), parts[3]]), "DOMAIN", "TOKEN_TYPE_MISMATCH");
  addNegative("neg-protocol-version-zero", "MAL_COMMON_PROTOCOL_VERSION_ZERO", baseId, encodeCoseParts([parts[0], parts[1], encodeCanonical(replaceMapValue(payloadMap, "protocolVersion", 0)), parts[3]]), "DOMAIN", "PROTOCOL_VERSION_MISMATCH");
  addNegative("neg-signature-text", "MAL_COMMON_SIGNATURE_NOT_BSTR", baseId, encodeCoseParts([parts[0], parts[1], parts[2], "not-a-signature"]), "SIGNATURE", "INVALID_SIGNATURE_ENCODING");
  addNegative("neg-signature-63-bytes", "MAL_COMMON_SIGNATURE_63_BYTES", baseId, encodeCoseParts([parts[0], parts[1], parts[2], parts[3].subarray(0, 63)]), "SIGNATURE", "INVALID_SIGNATURE_ENCODING");
  addNegative("neg-r-zero", "MAL_COMMON_R_ZERO", baseId, encodeCoseParts([parts[0], parts[1], parts[2], Buffer.concat([Buffer.alloc(32), parts[3].subarray(32)])]), "SIGNATURE", "INVALID_ECDSA_SCALAR");
  addNegative("neg-s-zero", "MAL_COMMON_S_ZERO", baseId, encodeCoseParts([parts[0], parts[1], parts[2], Buffer.concat([parts[3].subarray(0, 32), Buffer.alloc(32)])]), "SIGNATURE", "INVALID_ECDSA_SCALAR");
  const orderBytes = Buffer.from(P256_ORDER.toString(16).padStart(64, "0"), "hex");
  addNegative("neg-r-out-of-range", "MAL_COMMON_R_OUT_OF_RANGE", baseId, encodeCoseParts([parts[0], parts[1], parts[2], Buffer.concat([orderBytes, parts[3].subarray(32)])]), "SIGNATURE", "INVALID_ECDSA_SCALAR");
  addNegative("neg-s-out-of-range", "MAL_COMMON_S_OUT_OF_RANGE", baseId, encodeCoseParts([parts[0], parts[1], parts[2], Buffer.concat([parts[3].subarray(0, 32), orderBytes])]), "SIGNATURE", "INVALID_ECDSA_SCALAR");
  const lowS = BigInt(`0x${parts[3].subarray(32).toString("hex")}`);
  const highS = Buffer.from((P256_ORDER - lowS).toString(16).padStart(64, "0"), "hex");
  addNegative("neg-high-s", "MAL_COMMON_HIGH_S", baseId, encodeCoseParts([parts[0], parts[1], parts[2], Buffer.concat([parts[3].subarray(0, 32), highS])]), "SIGNATURE", "NON_CANONICAL_SIGNATURE");
  const nonceBytes = Buffer.from(payloadMap.get("requestNonce"));
  nonceBytes[0] ^= 1;
  addNegative("neg-payload-bit-flip", "MAL_COMMON_PAYLOAD_ONE_BIT_FLIP", baseId, encodeCoseParts([parts[0], parts[1], encodeCanonical(replaceMapValue(payloadMap, "requestNonce", nonceBytes)), parts[3]]), "SIGNATURE", "SIGNATURE_INVALID");
  const changedSignature = Buffer.from(parts[3]);
  changedSignature[0] ^= 1;
  addNegative("neg-signature-bit-flip", "MAL_COMMON_SIGNATURE_ONE_BIT_FLIP", baseId, encodeCoseParts([parts[0], parts[1], parts[2], changedSignature]), "SIGNATURE", "SIGNATURE_INVALID");

  function addTrustNegative(id, descriptorId, sourceId, signerId, stage, errorCode) {
    const source = signedById.get(sourceId);
    const signer = testOnlyKey(signerId);
    const payload = cloneValue(source.payload);
    payload.keyId = signer.kid;
    const issued = issueTestOnlyCose(source.record.tokenType, payload, signer);
    const isolatedCryptographicRegistry = new Map([[signer.kid.toString("hex"), {
      ...signer,
      environment: "TEST",
      trustClass: "TRUSTED",
      purpose: TYPE_CONTRACTS[source.record.tokenType].purpose,
    }]]);
    const cryptographicVerdict = verifySignedObject(issued.coseBytes, source.record.tokenType, isolatedCryptographicRegistry);
    if (cryptographicVerdict.decision !== "ACCEPT") throw new Error(`${id} is not cryptographically valid before its intended trust failure.`);
    addNegative(id, descriptorId, sourceId, issued.coseBytes, stage, errorCode, { signerKeyId: signer.id, signerKeyIdHex: signer.kid.toString("hex") });
  }
  addTrustNegative("neg-unknown-signer", "MAL_COMMON_UNKNOWN_SIGNER", "pos-entitlement-initial-offline", "TEST_ONLY_UNKNOWN_SIGNER", "SIGNATURE", "UNKNOWN_SIGNING_KEY");
  addTrustNegative("neg-wrong-purpose-signer", "MAL_COMMON_WRONG_PURPOSE_SIGNER", "pos-entitlement-initial-offline", LEASE, "TRUST", "WRONG_SIGNING_KEY_PURPOSE");
  addTrustNegative("neg-denied-signer", "MAL_COMMON_DENIED_SIGNER", "pos-entitlement-initial-offline", "TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED", "TRUST", "SIGNING_KEY_DENIED");
  addTrustNegative("neg-wrong-environment", "MAL_COMMON_WRONG_ENVIRONMENT", "pos-recovery-clear-tamper", "TEST_ONLY_RECOVERY_WRONG_ENV", "TRUST", "SIGNING_KEY_ENVIRONMENT_MISMATCH");

  function addSignatureBeforeTrustNegative(id, sourceId, signerId) {
    const source = signedById.get(sourceId);
    const signer = testOnlyKey(signerId);
    const payload = cloneValue(source.payload);
    payload.keyId = signer.kid;
    const issued = issueTestOnlyCose(source.record.tokenType, payload, signer);
    const signature = Buffer.from(issued.signature);
    signature[0] ^= 1;
    const corrupted = encodeCoseParts([issued.protectedBytes, new Map(), issued.payloadBytes, signature]);
    addNegative(id, "MAL_COMMON_SIGNATURE_ONE_BIT_FLIP", sourceId, corrupted, "SIGNATURE", "SIGNATURE_INVALID", {
      signerKeyId: signer.id,
      signerKeyIdHex: signer.kid.toString("hex"),
    });
  }
  addSignatureBeforeTrustNegative("neg-signature-before-denied", "pos-entitlement-initial-offline", "TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED");
  addSignatureBeforeTrustNegative("neg-signature-before-wrong-environment", "pos-recovery-clear-tamper", "TEST_ONLY_RECOVERY_WRONG_ENV");
  addSignatureBeforeTrustNegative("neg-signature-before-wrong-purpose", "pos-control-vendor-suspend", ENTITLEMENT);
  if (negatives.length !== 42) throw new Error(`Expected 42 critical binary negatives, built ${negatives.length}.`);

  const malformedSourcePath = path.join(repositoryRoot, "licensing", "protocol", "v1", "corpus", "malformed-cases.json");
  const crossSourcePath = path.join(repositoryRoot, "licensing", "protocol", "v1", "corpus", "cross-type-cases.json");
  const protocolRegistryPath = path.join(repositoryRoot, "licensing", "protocol", "v1", "protocol-registry.json");
  const malformedSourceBytes = readFileSync(malformedSourcePath);
  const crossSourceBytes = readFileSync(crossSourcePath);
  const protocolRegistry = JSON.parse(readFileSync(protocolRegistryPath, "utf8"));
  const malformedSource = JSON.parse(malformedSourceBytes.toString("utf8"));
  const crossSource = JSON.parse(crossSourceBytes.toString("utf8"));
  const fullAllowedFeatures = protocolRegistry.features?.editionAllowed?.FULL;
  if (!Array.isArray(fullAllowedFeatures) || fullAllowedFeatures.length !== ALL_FEATURES.length || !fullAllowedFeatures.every((feature, index) => feature === ALL_FEATURES[index])) {
    throw new Error("FULL Golden Vector features drifted from the frozen protocol registry.");
  }
  const criticalByDescriptorAndType = new Map(negatives.map((record) => [`${record.sourceDescriptorId}\0${record.tokenType}`, record]));
  if (criticalByDescriptorAndType.size !== negatives.length) throw new Error("Critical binary negatives must have unique descriptor/type links.");
  const malformedRecords = malformedSource.cases.flatMap((descriptor) => descriptor.types.map((tokenType) => {
    const basePositiveId = firstByType.get(tokenType);
    const baseRecord = signedById.get(basePositiveId).record;
    const binary = criticalByDescriptorAndType.get(`${descriptor.id}\0${tokenType}`);
    return {
      id: `${descriptor.id}::${tokenType}`,
      descriptorId: descriptor.id,
      tokenType,
      basePositiveId,
      baseCosePath: baseRecord.path,
      baseCoseSha256: baseRecord.sha256,
      mutation: descriptor.mutation,
      expected: descriptor.expected,
      coverageStatus: "FROZEN",
      binaryExecution: binary ? "BINARY_FIXTURE" : "DEFERRED_TO_LIC_6_2_003",
      binaryNegativeId: binary?.id ?? null,
    };
  }));
  if (malformedRecords.length !== 744) throw new Error(`Expected 744 malformed expansions, built ${malformedRecords.length}.`);
  const binaryLinkedCount = malformedRecords.filter((record) => record.binaryExecution === "BINARY_FIXTURE").length;
  const deferredMalformedCount = malformedRecords.filter((record) => record.binaryExecution === "DEFERRED_TO_LIC_6_2_003").length;
  if (binaryLinkedCount !== 42 || deferredMalformedCount !== 702) throw new Error(`Expected 42 binary-linked and 702 deferred malformed expansions; built ${binaryLinkedCount}/${deferredMalformedCount}.`);
  const malformedCoverage = {
    schemaVersion: 1,
    protocolVersion: 1,
    coverageKind: "MALFORMED_EXPANDED",
    nonProductionOnly: true,
    sourcePath: "../../protocol/v1/corpus/malformed-cases.json",
    sourceSha256: hashHex(malformedSourceBytes),
    sourceDescriptorCount: malformedSource.cases.length,
    expectedRecordCount: 744,
    records: malformedRecords,
  };
  const malformedCoverageBytes = jsonBytes(malformedCoverage);
  artifacts.set("coverage/malformed-expanded.json", malformedCoverageBytes);

  const crossRecords = crossSource.cases.map((descriptor) => {
    const basePositiveId = firstByType.get(descriptor.sourceType);
    const baseRecord = signedById.get(basePositiveId).record;
    return {
      id: descriptor.id,
      sourceType: descriptor.sourceType,
      targetType: descriptor.targetType,
      basePositiveId,
      baseCosePath: baseRecord.path,
      baseCoseSha256: baseRecord.sha256,
      sourceMediaType: descriptor.sourceMediaType,
      targetMediaType: descriptor.targetMediaType,
      mutation: descriptor.mutation,
      expected: descriptor.expected,
      coverageStatus: "FROZEN",
    };
  });
  if (crossRecords.length !== 90) throw new Error(`Expected 90 cross-type records, built ${crossRecords.length}.`);
  const crossCoverage = {
    schemaVersion: 1,
    protocolVersion: 1,
    coverageKind: "CROSS_TYPE",
    nonProductionOnly: true,
    sourcePath: "../../protocol/v1/corpus/cross-type-cases.json",
    sourceSha256: hashHex(crossSourceBytes),
    expectedRecordCount: 90,
    records: crossRecords,
  };
  const crossCoverageBytes = jsonBytes(crossCoverage);
  artifacts.set("coverage/cross-type.json", crossCoverageBytes);

  const keys = Object.values(TEST_ONLY_KEYS).sort((a, b) => a.id.localeCompare(b.id, "en")).map((key) => ({
    keyId: key.id,
    purpose: key.purpose,
    environment: key.environment,
    trustClass: key.trustClass,
    kidHex: key.kid.toString("hex"),
    spkiPath: `keys/${keyFileName(key.id)}`,
    spkiSha256: hashHex(key.spkiDer),
  }));
  const index = {
    schemaVersion: 1,
    protocolVersion: 1,
    reportKind: "ENTRY_CONTROL_GOLDEN_VECTORS_V1",
    nonProductionOnly: true,
    protocolManifestSha256: PROTOCOL_MANIFEST_SHA256,
    keyDerivation: "ENTRY_CONTROL_SYSTEM:TEST_ONLY_DO_NOT_TRUST:GOLDEN_VECTOR_KEY:V1:<KEY_ID>",
    keys,
    positive: [...signed, ...carriers].sort((a, b) => a.id.localeCompare(b.id, "en")),
    criticalNegative: negatives.sort((a, b) => a.id.localeCompare(b.id, "en")),
    descriptorCorpora: {
      malformedPath: "coverage/malformed-expanded.json",
      malformedSha256: hashHex(malformedCoverageBytes),
      malformedExpandedCount: 744,
      crossTypePath: "coverage/cross-type.json",
      crossTypeSha256: hashHex(crossCoverageBytes),
      crossTypeCount: 90,
    },
  };
  const indexBytes = jsonBytes(index);
  artifacts.set("vectors-index.json", indexBytes);
  const executed = [
    ...index.positive.map((record) => ({
      id: record.id,
      decision: record.expected.decision,
      stage: record.expected.stage,
      errorCode: record.expected.errorCode,
      inputSha256: record.sha256,
      protectedSha256: record.kind === "SIGNED_OBJECT" ? record.protectedSha256 : "",
      payloadSha256: record.kind === "SIGNED_OBJECT" ? record.payloadSha256 : "",
      sigStructureSha256: record.kind === "SIGNED_OBJECT" ? record.sigStructureSha256 : "",
      signerKeyIdHex: record.kind === "SIGNED_OBJECT" ? record.signerKeyIdHex : "",
    })),
    ...index.criticalNegative.map((record) => ({
      id: record.id,
      decision: record.expected.decision,
      stage: record.expected.stage,
      errorCode: record.expected.errorCode,
      inputSha256: record.sha256,
      protectedSha256: "",
      payloadSha256: "",
      sigStructureSha256: "",
      signerKeyIdHex: "",
    })),
    ...crossRecords.map((record) => ({
      id: record.id,
      decision: record.expected.decision,
      stage: record.expected.stage,
      errorCode: record.expected.errorCode,
      inputSha256: record.baseCoseSha256,
      protectedSha256: "",
      payloadSha256: "",
      sigStructureSha256: "",
      signerKeyIdHex: "",
    })),
  ].sort((left, right) => left.id.localeCompare(right.id, "en"));
  const vendorReport = {
    schemaVersion: 1,
    reportKind: "ENTRY_CONTROL_GOLDEN_VECTORS_V1",
    protocolManifestSha256: PROTOCOL_MANIFEST_SHA256,
    indexSha256: hashHex(indexBytes),
    positiveCount: index.positive.length,
    binaryNegativeCount: index.criticalNegative.length,
    malformedExpandedCount: 744,
    crossTypeCount: 90,
    malformedDeferredCount: deferredMalformedCount,
    executedCrossTypeCount: 90,
    executed,
    coverage: {
      malformedExpandedSha256: index.descriptorCorpora.malformedSha256,
      crossTypeSha256: index.descriptorCorpora.crossTypeSha256,
    },
  };
  artifacts.set("reports/vendor-verdict.json", jsonBytes(vendorReport, true));
  return { artifacts, index, indexBytes };
}

export function assertCborOrderingSelfTest() {
  const encoded = encodeCanonical(new Map([["", 0], [24, 0]]));
  const expected = Buffer.from("a21818006000", "hex");
  if (!encoded.equals(expected)) throw new Error(`RFC 8949 raw-byte map ordering self-test failed: ${encoded.toString("hex")}.`);
  const decoded = decodeCanonical(encoded);
  if (!(decoded instanceof Map) || [...decoded.keys()][0] !== 24 || [...decoded.keys()][1] !== "") throw new Error("RFC 8949 raw-byte map decode ordering self-test failed.");
}

export function expectedSignedCounts() {
  return Object.fromEntries(Object.keys(TYPE_CONTRACTS).map((tokenType) => [tokenType, 0]));
}
