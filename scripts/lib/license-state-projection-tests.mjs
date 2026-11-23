import assert from "node:assert/strict";

const OPERATIONAL = new Set([
  "POST_EXPIRY_GRACE",
  "OFFLINE_GRACE",
  "EXPIRING",
  "ACTIVE",
]);

const bytes = (length, fill) => new Uint8Array(length).fill(fill);
const clone = (value) => structuredClone(value);
const snapshot = (value) => JSON.stringify(value, (_, item) =>
  typeof item === "bigint"
    ? `${item}n`
    : item instanceof Uint8Array
      ? [...item]
      : item);

const IDS = Object.freeze({
  license: bytes(16, 1),
  activation: bytes(16, 2),
  installation: bytes(16, 3),
  device: bytes(32, 4),
  recovery: bytes(16, 5),
  entitlement: bytes(16, 6),
  lease: bytes(16, 7),
  request: bytes(16, 8),
  requestHash: bytes(32, 9),
  tokenHash: bytes(32, 10),
  version: bytes(32, 11),
  build: bytes(32, 12),
  manifest: bytes(32, 13),
});

function entitlement(mode) {
  const common = {
    protocolVersion: 1n,
    tokenType: "entitlement",
    tokenId: clone(IDS.entitlement),
    keyId: bytes(32, 14),
    issuedAt: 90n,
    notBefore: 100n,
    notAfter: 230n,
    productId: "ENTRY_CONTROL_SYSTEM",
    edition: "ATTENDANCE",
    customerId: bytes(16, 15),
    licenseId: clone(IDS.license),
    activationId: clone(IDS.activation),
    installationId: clone(IDS.installation),
    deviceKeyId: clone(IDS.device),
    features: ["AUTH", "BACKUPS", "DEVICES", "EMPLOYEES"],
    assurance: "SOFTWARE_BOUND",
    termStartsAt: 110n,
    termEndsAt: 200n,
    warningLeadSeconds: 20n,
    warningStartsAt: 180n,
    graceSeconds: 20n,
    graceUntil: 220n,
    clockToleranceSeconds: 300n,
    minimumProductVersion: "1.0.0",
    maximumMajorVersion: 1n,
    requestId: clone(IDS.request),
    requestHash: clone(IDS.requestHash),
    generation: 1n,
  };
  return mode === "HYBRID_LEASED"
    ? {
        ...common,
        mode,
        checkCadenceSeconds: 60n,
        offlineAllowanceSeconds: 100n,
        timeRecoveryRttSeconds: 300n,
      }
    : { ...common, mode: "OFFLINE_BOUND" };
}

function lease(parent) {
  return {
    protocolVersion: 1n,
    tokenType: "lease",
    tokenId: clone(IDS.lease),
    keyId: bytes(32, 16),
    issuedAt: 105n,
    notBefore: 110n,
    notAfter: 215n,
    productId: "ENTRY_CONTROL_SYSTEM",
    edition: parent.edition,
    licenseId: clone(parent.licenseId),
    activationId: clone(parent.activationId),
    installationId: clone(parent.installationId),
    deviceKeyId: clone(parent.deviceKeyId),
    mode: "HYBRID_LEASED",
    assurance: parent.assurance,
    features: ["AUTH", "DEVICES", "EMPLOYEES"],
    entitlementTokenId: clone(parent.tokenId),
    entitlementGeneration: parent.generation,
    leaseRevision: 1n,
    serverTime: 110n,
    offlineUntil: 210n,
    leaseRequestId: clone(IDS.request),
    leaseRequestHash: clone(IDS.requestHash),
    versionIdentitySha256: clone(IDS.version),
    buildIdentitySha256: clone(IDS.build),
    buildManifestSha256: clone(IDS.manifest),
    controlRevision: 0n,
    controlState: "OPERATIONAL",
    controlEffectiveAt: 0n,
    controlReasonCode: 0n,
  };
}

function token(type, payload, hashFill) {
  return {
    type,
    payload,
    encoded: bytes(8, hashFill + 20),
    hash: bytes(32, hashFill),
  };
}

function control(revision, state, effectiveAt, fill = Number(revision) + 30) {
  return {
    revision,
    state,
    effectiveAt,
    reasonCode: revision,
    tokenId: bytes(16, fill),
    tokenHash: bytes(32, fill),
  };
}

function fixture(mode = "OFFLINE_BOUND") {
  const parent = entitlement(mode);
  const pair = {
    entitlement: token("entitlement", parent, 10),
    ...(mode === "HYBRID_LEASED"
      ? { lease: token("lease", lease(parent), 11) }
      : {}),
  };
  return {
    modelVersion: 1n,
    stateGeneration: 7n,
    stateHash: bytes(32, 17),
    previousStateHash: bytes(32, 18),
    build: {
      productVersion: "1.2.3",
      edition: "ATTENDANCE",
      versionIdentitySha256: clone(IDS.version),
      buildIdentitySha256: clone(IDS.build),
      buildManifestSha256: clone(IDS.manifest),
      physicallyPresentFeatures: ["AUTH", "BACKUPS", "EMPLOYEES"],
      codeReadyFeatures: ["AUTH", "DEVICES", "EMPLOYEES"],
      externallyEnabledFeatures: ["AUTH", "EMPLOYEES"],
    },
    device: {
      installationId: clone(IDS.installation),
      deviceKeyId: clone(IDS.device),
      assurance: "SOFTWARE_BOUND",
    },
    clockHighWater: 0n,
    highestProductVersion: "1.2.0",
    current: pair,
    entitlementGeneration: 1n,
    leaseRevision: mode === "HYBRID_LEASED" ? 1n : 0n,
    timeCorrectionRevision: 0n,
    control: control(0n, "OPERATIONAL", 0n, 30),
    controlHistory: [],
    tombstones: [],
    receipts: [],
    consumedRequests: [],
    consumedRecoveries: [],
    consumedReactivations: [],
    tamperLatched: false,
    recoveryRequired: false,
    networkUnavailable: false,
  };
}

function changed(mode, update) {
  const state = fixture(mode);
  update(state);
  return state;
}

/**
 * Focused, test-only executor for the production projection seam. The caller
 * supplies the directly imported projectLicenseStateV1 function from the
 * compiled internal module; this file imports no production or vector graph.
 */
export function executeLicenseStateProjectionTests(input) {
  const project = input?.projectLicenseStateV1;
  assert.equal(typeof project, "function", "projectLicenseStateV1 is required");

  const cases = [];
  const add = (id, state, now, expected, features) => {
    cases.push({ id, state, now, expected, features });
  };

  add("LIC-STATE-UNLICENSED-INITIAL", changed("OFFLINE_BOUND", (s) => {
    delete s.current;
  }), 150n, "UNLICENSED", []);
  add("LIC-STATE-PENDING-NEVER-AUTHORITY", changed("OFFLINE_BOUND", (s) => {
    s.pending = s.current;
    delete s.current;
  }), 150n, "UNLICENSED", []);
  add("LIC-STATE-PENDING-SUCCESSOR-DOES-NOT-DISTURB-CURRENT", changed("OFFLINE_BOUND", (s) => {
    s.pending = clone(s.current);
    s.pending.entitlement.payload.notBefore = 190n;
    s.pending.entitlement.payload.termStartsAt = 190n;
    s.pending.entitlement.payload.features = ["PAYROLL"];
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-PENDING-CURRENT-LEASE-DOES-NOT-DISTURB-ACTIVE-PAIR", changed("HYBRID_LEASED", (s) => {
    s.pendingCurrentLease = clone(s.current.lease);
    s.pendingCurrentLease.payload.notBefore = 190n;
    s.pendingCurrentLease.payload.offlineUntil = 195n;
    s.pendingCurrentLease.payload.features = [];
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-EFFECTIVE-START-MAX-NOT-BEFORE-TERM", fixture(), 109n, "UNLICENSED", []);
  add("LIC-STATE-EFFECTIVE-START-HALF-OPEN", fixture(), 110n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-WARNING-HALF-OPEN", fixture(), 180n, "EXPIRING", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-TERM-END-HALF-OPEN", fixture(), 200n, "POST_EXPIRY_GRACE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-GRACE-END-HALF-OPEN", fixture(), 220n, "EXPIRED_LOCKED", []);

  add("LIC-HYBRID-EXACT-PAIR-ACTIVE", fixture("HYBRID_LEASED"), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-NETWORK-UNAVAILABLE-OFFLINE-GRACE", changed("HYBRID_LEASED", (s) => {
    s.networkUnavailable = true;
  }), 150n, "OFFLINE_GRACE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-OFFLINE-FACT-DOES-NOT-AFFECT-OFFLINE-BOUND", changed("OFFLINE_BOUND", (s) => {
    s.networkUnavailable = true;
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-POST-EXPIRY-PRIORITY-OVER-OFFLINE-WARNING", changed("HYBRID_LEASED", (s) => {
    s.networkUnavailable = true;
  }), 200n, "POST_EXPIRY_GRACE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-OFFLINE-UNTIL-HALF-OPEN", fixture("HYBRID_LEASED"), 210n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-LEASE-NOT-AFTER-EARLIEST-END", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.notAfter = 190n;
  }), 190n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-PARENT-GRACE-HAS-HIGHER-EXPIRED-PRIORITY", fixture("HYBRID_LEASED"), 220n, "EXPIRED_LOCKED", []);
  add("LIC-HYBRID-MISSING-LEASE-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    delete s.current.lease;
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-OLD-PARENT-LEASE-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.entitlementTokenId[0] ^= 1;
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-WRONG-GENERATION-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.entitlementGeneration += 1n;
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-WRONG-LINEAGE-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.activationId[0] ^= 1;
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-WIDENED-LEASE-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.features.push("PAYROLL");
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-LEASE-BEFORE-NOT-BEFORE-NEVER-AUTHORIZES", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.notBefore = 160n;
  }), 150n, "LEASE_EXPIRED_LOCKED", []);

  add("LIC-HYBRID-RECOVERY-BINDING-EXACT", changed("HYBRID_LEASED", (s) => {
    s.device.deviceKeyId = bytes(32, 41);
    s.device.bindingRecoveryTokenId = clone(IDS.recovery);
    s.current.lease.payload.deviceKeyId = bytes(32, 41);
    s.current.lease.payload.bindingRecoveryTokenId = clone(IDS.recovery);
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-HYBRID-RECOVERY-BINDING-REFERENCE-REQUIRED", changed("HYBRID_LEASED", (s) => {
    s.device.deviceKeyId = bytes(32, 41);
    s.device.bindingRecoveryTokenId = clone(IDS.recovery);
    s.current.lease.payload.deviceKeyId = bytes(32, 41);
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-HYBRID-UNEXPECTED-RECOVERY-REFERENCE-REJECTED", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.bindingRecoveryTokenId = clone(IDS.recovery);
  }), 150n, "LEASE_EXPIRED_LOCKED", []);
  add("LIC-STATE-OFFLINE-RECOVERY-BINDING-KEEPS-SIGNED-PARENT", changed("OFFLINE_BOUND", (s) => {
    s.device.deviceKeyId = bytes(32, 41);
    s.device.bindingRecoveryTokenId = clone(IDS.recovery);
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-DEVICE-BINDING-MISMATCH-REQUIRES-RECOVERY", changed("OFFLINE_BOUND", (s) => {
    s.device.deviceKeyId[0] ^= 1;
  }), 150n, "RECOVERY_REQUIRED", []);
  add("LIC-STATE-INSTALLATION-BINDING-MISMATCH-REQUIRES-RECOVERY", changed("OFFLINE_BOUND", (s) => {
    s.device.installationId[0] ^= 1;
  }), 150n, "RECOVERY_REQUIRED", []);
  add("LIC-STATE-BINDING-RECOVERY-PRIORITY-OVER-INCOMPATIBILITY", changed("OFFLINE_BOUND", (s) => {
    s.device.deviceKeyId[0] ^= 1;
    s.build.edition = "FULL";
  }), 150n, "RECOVERY_REQUIRED", []);

  add("LIC-FEATURE-EXACT-FIVE-WAY-INTERSECTION", fixture(), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-FEATURE-EXTERNAL-ABSENT-IS-IDENTITY", changed("OFFLINE_BOUND", (s) => {
    delete s.build.externallyEnabledFeatures;
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-FEATURE-EXTERNAL-EMPTY-IS-DENY-ALL", changed("OFFLINE_BOUND", (s) => {
    s.build.externallyEnabledFeatures = [];
  }), 150n, "ACTIVE", []);
  add("LIC-FEATURE-PHYSICAL-INVENTORY-ABSENT-IS-DENY-ALL", changed("OFFLINE_BOUND", (s) => {
    delete s.build.physicallyPresentFeatures;
  }), 150n, "ACTIVE", []);
  add("LIC-FEATURE-CODE-READINESS-ABSENT-IS-DENY-ALL", changed("OFFLINE_BOUND", (s) => {
    delete s.build.codeReadyFeatures;
  }), 150n, "ACTIVE", []);
  add("LIC-FEATURE-HYBRID-LEASE-RESTRICTS-PARENT", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.features = ["AUTH"];
  }), 150n, "ACTIVE", ["AUTH"]);

  add("LIC-COMPAT-EDITION-MUST-MATCH-BUILD", changed("OFFLINE_BOUND", (s) => {
    s.build.edition = "FULL";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-PRODUCT-BELOW-MINIMUM", changed("OFFLINE_BOUND", (s) => {
    s.build.productVersion = "0.9.9";
    s.highestProductVersion = "0.9.9";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-PRODUCT-ABOVE-MAXIMUM-MAJOR", changed("OFFLINE_BOUND", (s) => {
    s.build.productVersion = "2.0.0";
    s.highestProductVersion = "2.0.0";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-PRERELEASE-PRECEDES-RELEASE-MINIMUM", changed("OFFLINE_BOUND", (s) => {
    s.build.productVersion = "1.0.0-rc.1";
    s.highestProductVersion = "1.0.0-rc.1";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-INVALID-SEMVER-FAILS-CLOSED", changed("OFFLINE_BOUND", (s) => {
    s.highestProductVersion = "01.2.3";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-BUILD-METADATA-IGNORED-IN-PRECEDENCE", changed("OFFLINE_BOUND", (s) => {
    s.build.productVersion = "1.2.3+installed";
    s.highestProductVersion = "1.2.3+sealed";
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-COMPAT-PRODUCT-ROLLBACK-BELOW-HIGH-WATER", changed("OFFLINE_BOUND", (s) => {
    s.highestProductVersion = "1.3.0";
  }), 150n, "INCOMPATIBLE_LOCKED", []);
  add("LIC-COMPAT-HYBRID-LEASE-BUILD-MUST-MATCH", changed("HYBRID_LEASED", (s) => {
    s.current.lease.payload.buildManifestSha256[0] ^= 1;
  }), 150n, "INCOMPATIBLE_LOCKED", []);

  add("LIC-STATE-TAMPER-HIGHEST-PRIORITY", changed("OFFLINE_BOUND", (s) => {
    s.tamperLatched = true;
    s.recoveryRequired = true;
    s.build.edition = "FULL";
    s.control = control(2n, "REVOKED", 100n);
  }), 220n, "TAMPER_LOCKED", []);
  add("LIC-STATE-MATURED-REVOKE-TERMINAL-ACROSS-HIGHER-SUSPEND", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n), control(1n, "REVOKED", 120n)];
    s.control = control(2n, "SUSPENDED", 130n);
  }), 150n, "REVOKED_LOCKED", []);
  add("LIC-STATE-FUTURE-REVOKE-DOES-NOT-HIDE-CURRENT-FACT", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = control(1n, "REVOKED", 160n);
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-FUTURE-REVOKE-MATURES-AT-BOUNDARY", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = control(1n, "REVOKED", 160n);
  }), 160n, "REVOKED_LOCKED", []);
  add("LIC-STATE-FUTURE-SOURCE-CANNOT-REVOKE-EARLY", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = { ...control(1n, "REVOKED", 120n), notBefore: 160n };
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-SOURCE-REVOKE-MATURES-AT-NOT-BEFORE", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = { ...control(1n, "REVOKED", 120n), notBefore: 160n };
  }), 160n, "REVOKED_LOCKED", []);
  add("LIC-STATE-FUTURE-SUSPEND-DOES-NOT-HIDE-CURRENT-FACT", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = control(1n, "SUSPENDED", 160n);
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-SUSPEND-MATURES-AT-BOUNDARY", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n)];
    s.control = control(1n, "SUSPENDED", 160n);
  }), 160n, "SUSPENDED_LOCKED", []);
  add("LIC-STATE-HIGHER-MATURED-UNSUSPEND-REOPENS", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n), control(1n, "SUSPENDED", 120n)];
    s.control = control(2n, "OPERATIONAL", 130n);
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-FUTURE-SOURCE-LEASE-CANNOT-UNSUSPEND-EARLY", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n), control(1n, "SUSPENDED", 120n)];
    s.control = { ...control(2n, "OPERATIONAL", 120n), notBefore: 160n };
  }), 150n, "SUSPENDED_LOCKED", []);
  add("LIC-STATE-SOURCE-LEASE-UNSUSPEND-MATURES-AT-NOT-BEFORE", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [control(0n, "OPERATIONAL", 0n), control(1n, "SUSPENDED", 120n)];
    s.control = { ...control(2n, "OPERATIONAL", 120n), notBefore: 160n };
  }), 160n, "ACTIVE", ["AUTH", "EMPLOYEES"]);
  add("LIC-STATE-NO-MATURED-CONTROL-FACT-FAILS-CLOSED", changed("OFFLINE_BOUND", (s) => {
    s.controlHistory = [];
    s.control = control(1n, "SUSPENDED", 160n);
  }), 150n, "RECOVERY_REQUIRED", []);
  add("LIC-STATE-RECOVERY-PRIORITY-OVER-INCOMPATIBILITY", changed("OFFLINE_BOUND", (s) => {
    s.recoveryRequired = true;
    s.build.edition = "FULL";
  }), 150n, "RECOVERY_REQUIRED", []);
  add("LIC-STATE-SUSPEND-PRIORITY-OVER-RECOVERY", changed("OFFLINE_BOUND", (s) => {
    s.recoveryRequired = true;
    s.control = control(1n, "SUSPENDED", 100n);
  }), 150n, "SUSPENDED_LOCKED", []);

  add("LIC-STATE-CURRENT-LINEAGE-TOMBSTONE-IS-TERMINAL", changed("OFFLINE_BOUND", (s) => {
    s.tombstones = [{
      licenseId: clone(IDS.license),
      activationId: clone(IDS.activation),
      finalControlRevision: 1n,
      finalRevokeTokenHash: bytes(32, 50),
    }];
  }), 150n, "REVOKED_LOCKED", []);
  add("LIC-STATE-OLD-LINEAGE-TOMBSTONE-DOES-NOT-LOCK-REACTIVATION", changed("OFFLINE_BOUND", (s) => {
    s.tombstones = [{
      licenseId: bytes(16, 51),
      activationId: bytes(16, 52),
      finalControlRevision: 1n,
      finalRevokeTokenHash: bytes(32, 53),
    }];
  }), 150n, "ACTIVE", ["AUTH", "EMPLOYEES"]);

  const failures = [];
  let passed = 0;
  for (const item of cases) {
    try {
      const inputState = clone(item.state);
      const before = snapshot(inputState);
      const result = project(inputState, item.now);
      assert.equal(snapshot(inputState), before, `${item.id} changed caller state`);
      assert.equal(result.state, item.expected, `${item.id} projected ${result.state}`);
      assert.equal(result.operational, OPERATIONAL.has(item.expected), `${item.id} operational mismatch`);
      assert.equal(result.runtimeAuthority, "NONE", `${item.id} granted runtime authority`);
      assert.equal(result.stateGeneration, inputState.stateGeneration, `${item.id} generation mismatch`);
      assert.deepEqual([...result.features], item.features, `${item.id} feature intersection mismatch`);
      assert(Object.isFrozen(result), `${item.id} result is mutable`);
      assert(Object.isFrozen(result.features), `${item.id} feature list is mutable`);
      const resultBeforeMutation = snapshot(result);
      assert.throws(() => result.features.push("PAYROLL"), TypeError, `${item.id} accepted feature mutation`);
      assert.equal(snapshot(result), resultBeforeMutation, `${item.id} result changed after mutation attempt`);
      assert.equal(snapshot(project(inputState, item.now)), resultBeforeMutation, `${item.id} is not deterministic`);
      passed += 1;
    } catch (error) {
      failures.push(`${item.id}: ${error.message}`);
    }
  }

  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length, "projection case IDs must be unique");
  return Object.freeze({
    attempted: cases.length,
    passed,
    failures: Object.freeze(failures),
  });
}
