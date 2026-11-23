// TEST_ONLY_DO_NOT_TRUST: signed adversarial transition sequences for LIC004.
// Production exports must already be loaded and isolated before importing this.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";

const OWNED_TYPES = new Set(["entitlement", "lease", "offline-control", "reactivation-authorization", "recovery"]);
const EXPECTED_DESCRIPTOR_IDS = [
  ...[...OWNED_TYPES].map((type) => `MAL_COMMON_TOKEN_ID_REUSED_DIFFERENT_BYTES::${type}`),
  "MAL_ENTITLEMENT_WRONG_PREDECESSOR::entitlement",
  "MAL_LEASE_REVISION_ROLLBACK::lease",
  "MAL_LEASE_REVISION_REUSE_DIFFERENT_TOKEN::lease",
  "MAL_LEASE_CONTROL_REVISION_LOWER::lease",
  "MAL_LEASE_CONTROL_REVISION_EQUAL_DIFFERENT_TUPLE::lease",
  "MAL_OFFLINE_CONTROL_REVISION_ROLLBACK::offline-control",
  "MAL_OFFLINE_CONTROL_REVISION_REUSE_DIFFERENT_ACTION::offline-control",
  "MAL_OFFLINE_CONTROL_UNSUSPEND_REVOKED::offline-control",
  "MAL_REACTIVATION_AUTHORIZATION_ENTITLEMENT_WIDENS_FEATURES::reactivation-authorization",
  "MAL_REACTIVATION_AUTHORIZATION_HALF_PAIR_PROMOTION::reactivation-authorization",
  "MAL_REACTIVATION_AUTHORIZATION_AUTHORIZATION_REPLAY::reactivation-authorization",
  "MAL_RECOVERY_TARGETS_REVOKED_LINEAGE::recovery",
  "MAL_RECOVERY_TOKEN_REPLAY::recovery",
].sort();
const equal = (left, right) => Buffer.from(left).equals(Buffer.from(right));
const snapshot = (value) => JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? `${item}n` : item instanceof Uint8Array ? [...item] : item);
const minimum = (...values) => values.reduce((lowest, value) => value < lowest ? value : lowest);

export function runLicenseStateSecurityTests(production) {
  const f = createLicenseStateFixtures(production);
  assert.equal(typeof production.core.createLicenseStateMachineV1, "function");
  const coverage = JSON.parse(readFileSync(new URL("../../licensing/vectors/v1/coverage/malformed-expanded.json", import.meta.url), "utf8"));
  const descriptors = coverage.records.filter((item) => item.expected.stage === "STATE" && OWNED_TYPES.has(item.tokenType));
  assert.equal(descriptors.length, 18, "LIC004 must execute exactly 18 frozen STATE descriptors.");
  assert.deepEqual(descriptors.map((item) => item.id).sort(), EXPECTED_DESCRIPTOR_IDS, "LIC004 descriptor ownership drifted.");
  const failures = [], descriptorIds = [];
  let attempted = 0, passed = 0, sequence = 0;
  const label = (name) => `${name}:${sequence++}`;
  const head = (state) => state.pending ?? state.current;
  const run = (id, body) => {
    attempted += 1;
    try { body(); passed += 1; }
    catch (error) { failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const advance = (scene, command, name = command.kind, now = scene.now) => {
    const before = snapshot(scene.state), commandBefore = snapshot(command), prior = scene.state;
    const result = scene.machine.transition(prior, command, now);
    assert.equal(snapshot(prior), before, `${name}: mutated input state.`);
    assert.equal(snapshot(command), commandBefore, `${name}: mutated command.`);
    assert.equal(result.ok, true, `${name}: ${result.stage}/${result.errorCode}`);
    assert.equal(result.authoritativeStateChanged, false, name);
    assert.equal(result.requestConsumed, false, name);
    assert.equal(result.expectedPreviousGeneration, prior.stateGeneration, name);
    assert(equal(result.expectedPreviousHash, prior.stateHash), `${name}: missing compare-and-swap hash.`);
    assert.equal(result.state.stateGeneration, prior.stateGeneration + (result.decision === "PROPOSED" ? 1n : 0n), name);
    assert.equal(scene.machine.project(result.state, now).runtimeAuthority, "NONE", name);
    scene.state = result.state;
    scene.now = now;
    return result;
  };
  const reject = (scene, command, code, stage = "STATE") => {
    const before = snapshot(scene.state), commandBefore = snapshot(command), prior = scene.state;
    const result = scene.machine.transition(prior, command, scene.now);
    assert.equal(result.ok, false, `${code}: candidate unexpectedly accepted.`);
    assert.equal(result.stage, stage, `${code}: wrong rejection stage (${result.errorCode}).`);
    assert.equal(result.errorCode, code, `${code}: incorrect rejection diagnostic.`);
    assert.strictEqual(result.state, prior, `${code}: rejection replaced the model state.`);
    assert.equal(result.authoritativeStateChanged, false, code);
    assert.equal(result.requestConsumed, false, code);
    assert.equal(snapshot(prior), before, `${code}: rejection mutated state.`);
    assert.equal(snapshot(command), commandBefore, `${code}: rejection mutated command.`);
  };
  const signedValid = (type, encoded) => {
    const result = f.verifier.verifySignedObject({ expectedType: type, encoded });
    assert(result.ok, `Candidate setup must be independently signature-valid: ${type} ${result.stage}/${result.errorCode}`);
    assert.equal(result.value.authorization, "PREFLIGHT_ONLY");
  };
  const signedCommand = (type, value, extra = {}) => ({
    payload: value, encoded: f.sign(type, value), ...extra,
  });
  const requestCommon = (scene, value, name, device = scene.state.device) => {
    const s = scene.state;
    delete value.tpmEvidence;
    Object.assign(value, {
      keyId: device.deviceKeyId, deviceKeyId: device.deviceKeyId, devicePublicKey: device.devicePublicKey,
      installationId: device.installationId, bindingKind: device.assurance, edition: s.build.edition,
      issuedAt: scene.now, notAfter: scene.now + 86_400n,
      requestId: f.bytes(`${name}:request`), requestNonce: f.bytes(`${name}:nonce`, 32),
      stateGeneration: s.stateGeneration, entitlementGeneration: s.entitlementGeneration,
      leaseRevision: s.leaseRevision, timeCorrectionRevision: s.timeCorrectionRevision,
      controlRevision: s.control.revision, controlState: s.control.state,
      versionIdentitySha256: s.build.versionIdentitySha256, buildIdentitySha256: s.build.buildIdentitySha256,
      buildManifestSha256: s.build.buildManifestSha256,
    });
    return value;
  };
  const requestFor = (type, payload, device) => {
    const encoded = f.sign(type, payload);
    return f.requestSnapshot(encoded, device ? { context: { device } } : {});
  };
  function control(scene, options = {}) {
    const s = scene.state, current = head(s).entitlement.payload, name = label("control");
    const value = f.payload("pos-control-vendor-suspend");
    const action = options.action ?? "SUSPEND";
    Object.assign(value, {
      tokenId: f.bytes(name), licenseId: current.licenseId, activationId: current.activationId,
      issuedAt: scene.now, notBefore: scene.now, notAfter: scene.now + 86_400n,
      controlRevision: s.control.revision + 1n, action, effectiveAt: scene.now,
      reasonCode: action === "REVOKE" ? 3n : action === "UNSUSPEND" ? 2n : 1n, ...options,
    });
    const item = signedCommand("offline-control", value);
    return { ...item, command: { kind: "IMPORT_CONTROL", encoded: item.encoded } };
  }
  function lease(scene, options = {}) {
    const s = scene.state, pair = options.pair ?? head(s), p = pair.entitlement.payload, name = label("lease");
    const direct = equal(s.device.deviceKeyId, p.deviceKeyId);
    const device = f.clone(s.device);
    if (direct) delete device.bindingRecoveryTokenId;
    const requestPayload = f.payload("pos-lease-request-check-in");
    Object.assign(requestPayload, {
      requestId: f.bytes(`${name}:request`), requestNonce: f.bytes(`${name}:nonce`, 32),
      keyId: device.deviceKeyId, deviceKeyId: device.deviceKeyId, installationId: device.installationId,
      edition: s.build.edition, licenseId: p.licenseId, activationId: p.activationId,
      entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, stateGeneration: s.stateGeneration,
      lastLeaseRevision: s.leaseRevision, controlRevision: s.control.revision, controlState: s.control.state,
      controlEffectiveAt: s.control.effectiveAt, controlReasonCode: s.control.reasonCode,
      versionIdentitySha256: s.build.versionIdentitySha256, buildIdentitySha256: s.build.buildIdentitySha256,
      buildManifestSha256: s.build.buildManifestSha256,
    });
    if (device.bindingRecoveryTokenId) requestPayload.bindingRecoveryTokenId = device.bindingRecoveryTokenId;
    else delete requestPayload.bindingRecoveryTokenId;
    const request = requestFor("lease-request", requestPayload, device);
    const value = f.payload("pos-lease-initial-control");
    Object.assign(value, {
      tokenId: f.bytes(name), edition: s.build.edition, installationId: device.installationId,
      deviceKeyId: device.deviceKeyId, assurance: device.assurance, licenseId: p.licenseId, activationId: p.activationId,
      entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, features: [...p.features],
      issuedAt: scene.now, serverTime: scene.now, notBefore: scene.now,
      offlineUntil: minimum(scene.now + p.offlineAllowanceSeconds, p.notAfter, p.graceUntil),
      notAfter: minimum(scene.now + p.offlineAllowanceSeconds, p.notAfter, p.graceUntil),
      leaseRevision: s.leaseRevision + 1n, controlRevision: s.control.revision, controlState: s.control.state,
      controlEffectiveAt: s.control.effectiveAt, controlReasonCode: s.control.reasonCode,
      leaseRequestId: request.requestId, leaseRequestHash: request.requestHash,
      versionIdentitySha256: s.build.versionIdentitySha256, buildIdentitySha256: s.build.buildIdentitySha256,
      buildManifestSha256: s.build.buildManifestSha256,
    });
    if (device.bindingRecoveryTokenId) value.bindingRecoveryTokenId = device.bindingRecoveryTokenId;
    else delete value.bindingRecoveryTokenId;
    const { pair: _pair, ...mutations } = options;
    Object.assign(value, mutations);
    const item = signedCommand("lease", value);
    return { ...item, request, command: { kind: "IMPORT_LEASE", encoded: item.encoded, request, parentTokenId: p.tokenId } };
  }
  function fresh(mode = "OFFLINE_BOUND") {
    const machine = production.core.createLicenseStateMachineV1(f.configuration);
    const scene = { machine, state: machine.initial(), now: f.now };
    const activation = f.initialActivation({ mode, label: label("activation") });
    advance(scene, activation.command, "initial activation");
    scene.activation = activation;
    if (mode === "HYBRID_LEASED") {
      scene.firstLease = lease(scene);
      advance(scene, scene.firstLease.command, "initial exact Hybrid pair");
    }
    assert.equal(machine.project(scene.state, scene.now).state, "ACTIVE");
    return scene;
  }
  function renewal(scene) {
    const prior = head(scene.state).entitlement.payload, name = label("renewal");
    const requestPayload = requestCommon(scene, f.payload("pos-activation-renew"), name);
    Object.assign(requestPayload, {
      licenseId: prior.licenseId, activationId: prior.activationId, entitlementTokenId: prior.tokenId,
      entitlementGeneration: prior.generation,
    });
    const request = requestFor("activation-request", requestPayload);
    const value = f.clone(prior);
    Object.assign(value, { tokenId: f.bytes(name), generation: prior.generation + 1n, previousTokenId: prior.tokenId,
      requestId: request.requestId, requestHash: request.requestHash, issuedAt: scene.now,
      deviceKeyId: scene.state.device.deviceKeyId, assurance: scene.state.device.assurance,
      termEndsAt: prior.termEndsAt + 86_400n, warningStartsAt: prior.warningStartsAt + 86_400n,
      graceUntil: prior.graceUntil + 86_400n, notAfter: prior.notAfter + 86_400n,
    });
    const item = signedCommand("entitlement", value);
    return { ...item, request, command: { kind: "IMPORT_ENTITLEMENT", encoded: item.encoded, request } };
  }
  function openIncident(scene, tamper = true) {
    const current = scene.state, name = label("incident");
    const command = {
      kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes(name), nonce: f.bytes(`${name}:nonce`, 32), reason: tamper ? "STATE_ROLLBACK" : "STORAGE_UNAVAILABLE" },
      ...(tamper ? { evidence: ["SEALED_PROGRAMDATA", "SEALED_REGISTRY"].map((protectionDomain) => ({
        protectionDomain, observedGeneration: current.stateGeneration - 1n, protectedHighWater: current.stateGeneration,
      })) } : {}),
    };
    advance(scene, command, "open scoped integrity incident");
    assert.equal(scene.machine.project(scene.state, scene.now).state, tamper ? "TAMPER_LOCKED" : "RECOVERY_REQUIRED");
    return command;
  }
  function recovery(scene, transition = "CLEAR_TAMPER", newDevice, target = scene.state.current) {
    const s = scene.state, pair = target, p = pair.entitlement.payload, name = label("recovery");
    assert(s.incident, "Recovery needs a transition-created incident.");
    const rebind = transition === "REBIND_DEVICE";
    const requestPayload = requestCommon(scene, f.payload(rebind ? "pos-activation-rebind" : "pos-activation-recover"), name, newDevice ?? s.device);
    Object.assign(requestPayload, {
      licenseId: p.licenseId, activationId: p.activationId, entitlementTokenId: p.tokenId,
      entitlementTokenHash: pair.entitlement.hash, entitlementGeneration: p.generation,
      incidentId: s.incident.id, incidentNonce: s.incident.nonce, stateHash: s.stateHash,
    });
    if (rebind) requestPayload.oldDeviceKeyId = s.device.deviceKeyId;
    const request = requestFor("activation-request", requestPayload);
    const value = f.payload(rebind ? "pos-recovery-rebind-device" : transition === "CLEAR_TAMPER" ? "pos-recovery-clear-tamper" : "pos-recovery-repair-state");
    Object.assign(value, {
      tokenId: f.bytes(name), edition: s.build.edition, installationId: s.device.installationId,
      licenseId: p.licenseId, activationId: p.activationId, entitlementTokenId: p.tokenId,
      entitlementTokenHash: pair.entitlement.hash, entitlementGeneration: p.generation,
      requestId: request.requestId, requestHash: request.requestHash, incidentId: s.incident.id, incidentNonce: s.incident.nonce,
      expectedStateGeneration: s.stateGeneration, newStateGeneration: s.stateGeneration + 1n,
      controlRevision: s.control.revision, allowedTransition: transition, maximumFeatures: [...p.features],
      issuedAt: scene.now, notBefore: scene.now, notAfter: scene.now + 3_600n,
      ...(rebind ? { oldDeviceKeyId: s.device.deviceKeyId, newDeviceKeyId: newDevice.deviceKeyId, newAssurance: newDevice.assurance } : {}),
    });
    const item = signedCommand("recovery", value);
    return { ...item, request, command: { kind: "RECOVER", encoded: item.encoded, request, ...(newDevice ? { newDevice } : {}) } };
  }
  function revokedScene(mode = "OFFLINE_BOUND") {
    const scene = fresh(mode);
    scene.revoke = control(scene, { action: "REVOKE" });
    advance(scene, scene.revoke.command, "terminal Revoke");
    assert.equal(scene.state.tombstones.length, 1);
    const name = label("reactivation-incident");
    advance(scene, { kind: "BEGIN_REACTIVATION", incident: { id: f.bytes(name), nonce: f.bytes(`${name}:nonce`, 32), reason: "COMMERCIAL_REACTIVATION" } });
    assert.equal(scene.machine.project(scene.state, scene.now).state, "REVOKED_LOCKED");
    return scene;
  }
  function reactivation(scene) {
    const s = scene.state, old = head(s).entitlement.payload, tombstone = s.tombstones[0], name = label("reactivation");
    const requestPayload = requestCommon(scene, f.payload("pos-activation-reactivate"), name);
    Object.assign(requestPayload, { revokedLicenseId: old.licenseId, revokedActivationId: old.activationId,
      finalRevokeTokenHash: tombstone.finalRevokeTokenHash, finalControlRevision: tombstone.finalControlRevision,
      incidentId: s.incident.id, incidentNonce: s.incident.nonce,
      revokedLineageTombstoneId: tombstone.id, revokedLineageTombstoneHash: tombstone.hash,
    });
    const request = requestFor("activation-request", requestPayload);
    const authorizationPayload = f.payload("pos-reactivation-authorization");
    Object.assign(authorizationPayload, {
      tokenId: f.bytes(`${name}:authorization`), edition: s.build.edition, installationId: s.device.installationId,
      deviceKeyId: s.device.deviceKeyId, requestId: request.requestId, requestHash: request.requestHash,
      revokedLicenseId: old.licenseId, revokedActivationId: old.activationId,
      finalRevokeTokenHash: tombstone.finalRevokeTokenHash, finalControlRevision: tombstone.finalControlRevision,
      incidentId: s.incident.id, incidentNonce: s.incident.nonce,
      newLicenseId: f.bytes(`${name}:license`), newActivationId: f.bytes(`${name}:activation`),
      maximumFeatures: [...old.features], issuedAt: scene.now, notBefore: scene.now, notAfter: scene.now + 86_400n,
    });
    const entitlementPayload = f.clone(old);
    delete entitlementPayload.previousTokenId;
    Object.assign(entitlementPayload, {
      tokenId: f.bytes(`${name}:entitlement`), generation: 1n, licenseId: authorizationPayload.newLicenseId,
      activationId: authorizationPayload.newActivationId, requestId: request.requestId, requestHash: request.requestHash,
      reactivationAuthorizationId: authorizationPayload.tokenId, issuedAt: scene.now, notBefore: scene.now,
    });
    const authorization = f.sign("reactivation-authorization", authorizationPayload);
    const entitlement = f.sign("entitlement", entitlementPayload);
    return { authorizationPayload, entitlementPayload, authorization, entitlement, request,
      command: { kind: "REACTIVATE", authorization, entitlement, request } };
  }
  function collisionSetup(type) {
    if (type === "reactivation-authorization") {
      const scene = revokedScene(), item = reactivation(scene);
      advance(scene, item.command, "valid atomic Reactivation");
      return { scene, value: item.authorizationPayload, command: item.command, field: "authorization" };
    }
    const scene = fresh(type === "lease" ? "HYBRID_LEASED" : "OFFLINE_BOUND");
    if (type === "entitlement") return { scene, value: scene.activation.entitlementPayload, command: scene.activation.command, field: "encoded" };
    if (type === "lease") return { scene, value: scene.firstLease.payload, command: scene.firstLease.command, field: "encoded" };
    const item = type === "recovery" ? (openIncident(scene), recovery(scene)) : control(scene);
    advance(scene, item.command, `accept ${type} before collision`);
    return { scene, value: item.payload, command: item.command, field: "encoded" };
  }
  function executeDescriptor(record) {
    const { tokenType: type, mutation } = record;
    if (mutation.operation === "reuseAcceptedTokenIdWithDifferentPayload") {
      const { scene, value, command, field } = collisionSetup(type), changed = f.clone(value);
      changed.notAfter += type === "lease" ? 1n : -1n;
      const encoded = f.sign(type, changed);
      signedValid(type, encoded);
      reject(scene, { ...command, [field]: encoded }, record.expected.errorCode, record.expected.stage);
      return;
    }
    if (record.descriptorId === "MAL_ENTITLEMENT_WRONG_PREDECESSOR") {
      const scene = fresh(), item = renewal(scene);
      item.payload.previousTokenId = f.bytes("unknown-predecessor");
      const encoded = f.sign("entitlement", item.payload);
      signedValid("entitlement", encoded);
      reject(scene, { ...item.command, encoded }, record.expected.errorCode);
      return;
    }
    if (type === "lease") {
      const scene = fresh("HYBRID_LEASED");
      advance(scene, lease(scene).command, "raise Lease high-water");
      if (record.descriptorId.includes("CONTROL_REVISION")) advance(scene, control(scene, { controlRevision: 2n }).command, "raise Control high-water");
      const mutations = record.descriptorId === "MAL_LEASE_REVISION_ROLLBACK" ? { leaseRevision: scene.state.leaseRevision - 1n }
        : record.descriptorId === "MAL_LEASE_REVISION_REUSE_DIFFERENT_TOKEN" ? { leaseRevision: scene.state.leaseRevision }
        : record.descriptorId === "MAL_LEASE_CONTROL_REVISION_LOWER" ? { controlRevision: scene.state.control.revision - 1n }
        : { controlReasonCode: 2n };
      const item = lease(scene, mutations);
      signedValid("lease", item.encoded);
      reject(scene, item.command, record.expected.errorCode);
      return;
    }
    if (type === "offline-control") {
      const scene = fresh();
      const terminal = record.descriptorId === "MAL_OFFLINE_CONTROL_UNSUSPEND_REVOKED";
      advance(scene, control(scene, { controlRevision: 2n, action: terminal ? "REVOKE" : "SUSPEND" }).command, "accept initial Control");
      const item = control(scene, terminal ? { action: "UNSUSPEND" }
        : record.descriptorId === "MAL_OFFLINE_CONTROL_REVISION_ROLLBACK" ? { controlRevision: 1n }
        : { controlRevision: 2n, action: "UNSUSPEND" });
      signedValid(type, item.encoded);
      reject(scene, item.command, record.expected.errorCode);
      return;
    }
    if (type === "reactivation-authorization") {
      const scene = revokedScene(), item = reactivation(scene);
      if (mutation.operation === "attemptPromotionWithoutBothArtifacts") {
        reject(scene, { kind: "REACTIVATE", authorization: item.authorization, request: item.request }, record.expected.errorCode);
        reject(scene, { kind: "REACTIVATE", entitlement: item.entitlement, request: item.request }, record.expected.errorCode);
      } else if (mutation.operation === "reuseConsumedAuthorization") {
        advance(scene, item.command, "accept paired Reactivation");
        reject(scene, item.command, record.expected.errorCode);
      } else {
        assert.equal(mutation.operation, "pairWithEntitlementAboveMaximumFeatures");
        item.authorizationPayload.maximumFeatures = item.entitlementPayload.features.slice(1);
        const authorization = f.sign(type, item.authorizationPayload);
        signedValid(type, authorization);
        reject(scene, { ...item.command, authorization }, record.expected.errorCode);
      }
      return;
    }
    if (type === "recovery") {
      const scene = fresh();
      openIncident(scene);
      if (mutation.operation === "applyRecoveryToTerminalLineage") advance(scene, control(scene, { action: "REVOKE" }).command, "Revoke incident lineage");
      else assert.equal(mutation.operation, "reuseConsumedRecoveryToken");
      const item = recovery(scene);
      signedValid(type, item.encoded);
      if (mutation.operation === "reuseConsumedRecoveryToken") advance(scene, item.command, "consume Recovery token");
      reject(scene, item.command, record.expected.errorCode);
      return;
    }
    assert.fail(`No executable LIC004 scenario for ${record.id}.`);
  }
  for (const record of descriptors) {
    descriptorIds.push(record.id);
    run(record.id, () => {
      assert.deepEqual(record.expected, { decision: "REJECT", stage: "STATE", errorCode: record.expected.errorCode,
        authoritativeStateChanged: false, requestConsumed: false });
      executeDescriptor(record);
    });
  }

  run("LIC-STATE-BAD-CANDIDATE-DOES-NOT-LATCH", () => {
    const scene = fresh(), item = renewal(scene), changed = new Uint8Array(item.encoded);
    changed[changed.length - 1] ^= 1;
    reject(scene, { ...item.command, encoded: changed }, "SIGNATURE_INVALID", "SIGNATURE");
    assert.equal(scene.state.tamperLatched, false);
    assert.equal(scene.state.recoveryRequired, false);
    assert.equal(scene.machine.project(scene.state, scene.now).state, "ACTIVE");
  });
  run("LIC-RECOVERY-REPAIR-AMBIGUOUS-STATE", () => {
    const scene = fresh();
    openIncident(scene, false);
    const item = recovery(scene, "REPAIR_SECURE_STATE");
    advance(scene, item.command);
    assert.equal(scene.state.incident, undefined);
    assert.equal(scene.state.recoveryRequired, false);
    assert.equal(scene.machine.project(scene.state, scene.now).state, "ACTIVE");
  });
  run("LIC-RECOVERY-INDEPENDENT-LOCKS-REQUIRE-SCOPED-REPAIR", () => {
    const scene = fresh(), incidentCommand = openIncident(scene, false), observed = scene.state.stateGeneration;
    advance(scene, { ...incidentCommand, evidence: ["SEALED_PROGRAMDATA", "SEALED_REGISTRY"].map(protectionDomain => ({
      protectionDomain, observedGeneration: observed - 1n, protectedHighWater: observed,
    })) });
    assert(scene.state.tamperLatched && scene.state.recoveryRequired);
    advance(scene, recovery(scene).command, "clear corroborated tamper only");
    assert.equal(scene.state.tamperLatched, false);
    assert.equal(scene.state.recoveryRequired, true);
    assert(scene.state.incident);
    advance(scene, recovery(scene, "REPAIR_SECURE_STATE").command, "repair remaining storage restriction");
    assert.equal(scene.machine.project(scene.state, scene.now).state, "ACTIVE");
  });
  run("LIC-RECOVERY-REBIND-A-B-C-PRESERVES-ENTITLEMENT", () => {
    const scene = fresh("HYBRID_LEASED"), originalHash = scene.state.current.entitlement.hash;
    for (const key of ["TEST_ONLY_INSTALLATION_DEVICE_REBIND", "TEST_ONLY_UNKNOWN_SIGNER"]) {
      openIncident(scene, false);
      const nextDevice = f.deviceForKey(key), item = recovery(scene, "REBIND_DEVICE", nextDevice);
      advance(scene, item.command, `rebind to ${key}`);
      assert(equal(scene.state.device.deviceKeyId, nextDevice.deviceKeyId));
      assert(equal(scene.state.device.bindingRecoveryTokenId, item.payload.tokenId));
      assert(equal(scene.state.current.entitlement.hash, originalHash), "Rebind mutated the original signed Entitlement.");
      advance(scene, lease(scene).command, "Lease follows the durable binding override");
      assert.equal(scene.machine.project(scene.state, scene.now).state, "ACTIVE");
    }
    const next = renewal(scene);
    advance(scene, next.command, "directly bound successor is pending");
    advance(scene, lease(scene).command, "promote directly bound successor pair");
    assert.equal(scene.state.device.bindingRecoveryTokenId, undefined, "Direct successor failed to retire the override.");
  });
  run("LIC-STATE-REACTIVATION-ATOMICITY-AND-TOMBSTONES", () => {
    const scene = revokedScene(), old = f.clone(scene.state.tombstones[0]), before = scene.state, item = reactivation(scene);
    const result = advance(scene, item.command);
    assert.equal(result.decision, "PROPOSED");
    assert.equal(scene.state.stateGeneration, before.stateGeneration + 1n);
    assert.equal(scene.state.consumedReactivations.length, before.consumedReactivations.length + 1);
    assert.equal(scene.state.consumedRequests.length, before.consumedRequests.length + 1);
    assert.equal(scene.state.receipts.length, before.receipts.length + 2);
    assert.equal(snapshot(scene.state.tombstones[0]), snapshot(old));
    assert.equal(scene.machine.project(scene.state, scene.now).state, "ACTIVE");
    reject(scene, scene.activation.command, "TERMINAL_REVOCATION");
    reject(scene, scene.revoke.command, "TERMINAL_REVOCATION");
    assert.equal(scene.machine.project(before, scene.now).state, "REVOKED_LOCKED", "Old transaction view was mutated by the new-lineage proposal.");
  });
  run("LIC-STATE-CONCURRENT-RENEWAL-PROPOSALS-AND-REQUEST-REPLAY", () => {
    const scene = fresh(), base = scene.state, left = renewal(scene), right = renewal(scene);
    const first = advance(scene, left.command);
    const competitor = scene.machine.transition(base, right.command, scene.now);
    assert(competitor.ok && competitor.decision === "PROPOSED");
    assert(equal(first.expectedPreviousHash, competitor.expectedPreviousHash), "Concurrent proposals lost the same compare-and-swap prerequisite.");
    assert(first.commitObligations.includes("COMPARE_PREVIOUS_GENERATION_AND_HASH"));
    reject(scene, right.command, "ENTITLEMENT_GENERATION_ROLLBACK");
    const retry = advance(scene, left.command, "byte-identical same-token retry");
    assert.equal(retry.decision, "IDEMPOTENT");
    assert.strictEqual(retry.state, first.state);
    const next = renewal(scene);
    reject(scene, { ...next.command, request: left.request }, "REQUEST_ALREADY_CONSUMED");
  });
  run("LIC-RECOVERY-CURRENT-WITH-PENDING-SUCCESSOR", () => {
    const scene=fresh("HYBRID_LEASED"),active=scene.state.current;
    advance(scene,renewal(scene).command,"stage successor without Lease");
    const pending=scene.state.pending;assert(pending);openIncident(scene,false);
    const wrong=recovery(scene,"REPAIR_SECURE_STATE",undefined,pending);
    reject(scene,wrong.command,"RECOVERY_INCIDENT_MISMATCH","CLAIMS");
    advance(scene,recovery(scene,"REPAIR_SECURE_STATE").command,"repair current while preserving pending high-water");
    assert.equal(snapshot(scene.state.current),snapshot(active));
    assert.equal(snapshot(scene.state.pending),snapshot(pending));assert.equal(scene.state.entitlementGeneration,2n);
    assert.equal(scene.machine.project(scene.state,scene.now).state,"ACTIVE");
  });
  run("LIC-REACTIVATION-HYBRID-COMPLETE-ELIGIBLE-SET", () => {
    const scene=revokedScene("HYBRID_LEASED"),before=scene.state,item=reactivation(scene);
    reject(scene,item.command,"REACTIVATION_PAIR_INCOMPLETE");
    const initialControl={...scene.state.control,revision:0n,state:"OPERATIONAL",effectiveAt:0n,reasonCode:0n};
    // This construction is only issuer input for a signed Lease, never submitted
    // as trusted model state. All transitions still use factory-issued states.
    const issuerScene={...scene,state:{...scene.state,current:undefined,pending:{entitlement:{payload:item.entitlementPayload}},
      entitlementGeneration:1n,leaseRevision:0n,timeCorrectionRevision:0n,control:initialControl}};
    const future=lease({...issuerScene,now:scene.now+120n});
    reject(scene,{...item.command,lease:future.encoded,leaseRequest:future.request},"REACTIVATION_PAIR_INCOMPLETE");
    const current=lease(issuerScene);
    const futureEnt={...item.entitlementPayload,termStartsAt:scene.now+120n};
    reject(scene,{...item.command,entitlement:f.sign("entitlement",futureEnt),lease:current.encoded,leaseRequest:current.request},"REACTIVATION_NOT_YET_EFFECTIVE");
    advance(scene,{...item.command,lease:current.encoded,leaseRequest:current.request},"atomic eligible Hybrid Reactivation");
    assert.equal(scene.state.stateGeneration,before.stateGeneration+1n);
    assert.equal(scene.state.consumedRequests.length,before.consumedRequests.length+2);
    assert.equal(scene.state.consumedReactivations.length,before.consumedReactivations.length+1);
    assert.equal(snapshot(scene.state.tombstones),snapshot(before.tombstones));
    assert.equal(scene.machine.project(scene.state,scene.now).state,"ACTIVE");
    reject(scene,scene.firstLease.command,"TERMINAL_REVOCATION");
  });
  run("LIC-REACTIVATION-INTRA-TRANSACTION-TOKEN-ID-COLLISION", () => {
    const scene=revokedScene(),item=reactivation(scene);
    const colliding={...item.entitlementPayload,tokenId:item.authorizationPayload.tokenId};
    const entitlement=f.sign("entitlement",colliding);signedValid("entitlement",entitlement);
    reject(scene,{...item.command,entitlement},"TOKEN_ID_COLLISION");
  });
  assert.equal(descriptorIds.length, 18);
  assert.equal(new Set(descriptorIds).size, 18, "No descriptor may execute twice or silently disappear.");
  assert.equal(attempted, 27, "LIC004 security scenario count changed without updating coverage.");
  return Object.freeze({ passed, attempted, descriptorIds: Object.freeze(descriptorIds), failures: Object.freeze(failures) });
}
