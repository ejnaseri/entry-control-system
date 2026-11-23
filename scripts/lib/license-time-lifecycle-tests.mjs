// TEST_ONLY_DO_NOT_TRUST. Signed fixtures are never production dependencies.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";

export function runLicenseTimeLifecycleTests(production) {
  const failures = [], ids = [];
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition }), now = f.now, day = 86400n;
    let serial = 0;
    const label = () => `${edition}-time-life-${serial++}`;
    const incident = () => { const l = label(); return { id: f.bytes(l), nonce: f.bytes(`${l}-nonce`, 32), reason: "CLOCK_FORWARD_JUMP" }; };
    const test = (name, run) => { const id = `${edition}/${name}`; ids.push(id); try { run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
    const apply = (s, command, at = now) => {
      const before = s.state, r = s.machine.transition(before, command, at);
      assert(r.ok, `${r.stage}/${r.errorCode}`); assert.equal(r.authoritativeStateChanged, false);
      s.state = r.state; return r;
    };
    const effective = s => s.machine.project(s.state, s.state.clockHighWater).state;
    const receipt = (s, wallUtc = s.state.observedUtc ?? now, tick = s.tick + 1000n) => ({ wallUtc, bootId: s.boot, monotonicMs: tick });
    const observe = (s, wallUtc, reboot = true, tick = 1000n) => {
      if (reboot) s.boot = f.bytes(label());
      s.tick = tick;
      apply(s, { kind: "OBSERVE_TIME", observation: receipt(s, wallUtc, tick), incident: incident() });
    };
    function lease(s, pair = s.state.pending ?? s.state.current, at = now, extra = {}) {
      const state = s.state, p = pair.entitlement.payload, l = label(), rp = f.payload("pos-lease-request-check-in");
      Object.assign(rp, { edition, requestId: f.bytes(`${l}-request`), requestNonce: f.bytes(`${l}-nonce`, 32),
        licenseId: p.licenseId, activationId: p.activationId, installationId: state.device.installationId,
        keyId: state.device.deviceKeyId, deviceKeyId: state.device.deviceKeyId, stateGeneration: state.stateGeneration,
        entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, lastLeaseRevision: state.leaseRevision,
        controlRevision: state.control.revision, controlState: state.control.state, controlEffectiveAt: state.control.effectiveAt,
        controlReasonCode: state.control.reasonCode, versionIdentitySha256: state.build.versionIdentitySha256,
        buildIdentitySha256: state.build.buildIdentitySha256, buildManifestSha256: state.build.buildManifestSha256 });
      const request = f.requestSnapshot(f.sign("lease-request", rp)), lp = f.payload("pos-lease-initial-control");
      const end = [at + p.offlineAllowanceSeconds, p.notAfter, p.graceUntil].reduce((a, b) => a < b ? a : b);
      Object.assign(lp, { edition, tokenId: f.bytes(l), licenseId: p.licenseId, activationId: p.activationId,
        installationId: state.device.installationId, deviceKeyId: state.device.deviceKeyId, assurance: state.device.assurance,
        entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, features: [...p.features],
        issuedAt: at, serverTime: at, notBefore: at, notAfter: end, offlineUntil: end,
        leaseRequestId: request.requestId, leaseRequestHash: request.requestHash, leaseRevision: state.leaseRevision + 1n,
        controlRevision: state.control.revision, controlState: state.control.state, controlEffectiveAt: state.control.effectiveAt,
        controlReasonCode: state.control.reasonCode, versionIdentitySha256: state.build.versionIdentitySha256,
        buildIdentitySha256: state.build.buildIdentitySha256, buildManifestSha256: state.build.buildManifestSha256 });
      return { kind: "IMPORT_LEASE", encoded: f.sign("lease", lp), request, parentTokenId: p.tokenId, ...extra };
    }
    function fresh(mode = "OFFLINE_BOUND") {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: machine.initial(), boot: f.bytes(label()), tick: 1000n };
      apply(s, f.initialActivation({ mode, label: label() }).command);
      if (mode === "HYBRID_LEASED") apply(s, lease(s));
      observe(s, now, false); return s;
    }
    function renew(s, at = now, start = now + day, extra = {}, changes = {}) {
      const state = s.state, p = (state.pending ?? state.current).entitlement.payload, l = label(), rp = f.payload("pos-activation-renew");
      delete rp.tpmEvidence;
      Object.assign(rp, { edition, requestId: f.bytes(`${l}-request`), requestNonce: f.bytes(`${l}-nonce`, 32),
        licenseId: p.licenseId, activationId: p.activationId, installationId: state.device.installationId,
        keyId: state.device.deviceKeyId, deviceKeyId: state.device.deviceKeyId, devicePublicKey: state.device.devicePublicKey,
        bindingKind: state.device.assurance, stateGeneration: state.stateGeneration, entitlementTokenId: p.tokenId,
        entitlementGeneration: p.generation, leaseRevision: state.leaseRevision, controlRevision: state.control.revision,
        controlState: state.control.state, timeCorrectionRevision: state.timeCorrectionRevision,
        issuedAt: at, notAfter: at + day, versionIdentitySha256: state.build.versionIdentitySha256,
        buildIdentitySha256: state.build.buildIdentitySha256, buildManifestSha256: state.build.buildManifestSha256 });
      const request = f.requestSnapshot(f.sign("activation-request", rp));
      const payload = { ...f.clone(p), tokenId: f.bytes(l), generation: p.generation + 1n, previousTokenId: p.tokenId,
        requestId: request.requestId, requestHash: request.requestHash, issuedAt: at, notBefore: start, termStartsAt: start,
        termEndsAt: p.termEndsAt + 3n * day, graceUntil: p.graceUntil + 3n * day,
        notAfter: p.notAfter + 3n * day, warningStartsAt: p.warningStartsAt + 3n * day, ...changes };
      return { kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", payload), request, ...extra };
    }
    function control(s, action, at) {
      const p = s.state.current.entitlement.payload, c = f.payload("pos-control-vendor-suspend");
      Object.assign(c, { edition, tokenId: f.bytes(label()), licenseId: p.licenseId, activationId: p.activationId,
        issuedAt: now, notBefore: now, notAfter: now + 7n * day, effectiveAt: at,
        controlRevision: s.state.control.revision + 1n, action, reasonCode: 1n });
      apply(s, { kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", c) });
    }
    function correct(s, utc, elapsedAfterIncident = 1000n) {
      s.tick += 1000n;
      apply(s, { kind: "BEGIN_TIME_RECOVERY", observation: receipt(s, s.state.observedUtc, s.tick), incident: incident() });
      const state = s.state, p = state.current.entitlement.payload, i = state.timeIncident, l = label();
      const rp = f.payload("pos-activation-time-correct"); delete rp.tpmEvidence;
      Object.assign(rp, { edition, requestId: f.bytes(`${l}-request`), requestNonce: f.bytes(`${l}-nonce`, 32),
        licenseId: p.licenseId, activationId: p.activationId, installationId: state.device.installationId,
        deviceKeyId: state.device.deviceKeyId, keyId: state.device.deviceKeyId, devicePublicKey: state.device.devicePublicKey,
        bindingKind: state.device.assurance, stateGeneration: state.stateGeneration, entitlementGeneration: state.entitlementGeneration,
        leaseRevision: state.leaseRevision, controlRevision: state.control.revision, controlState: state.control.state,
        timeCorrectionRevision: state.timeCorrectionRevision, incidentId: i.id, incidentNonce: i.nonce,
        preIncidentClockHighWater: i.preIncidentClockHighWater, issuedAt: utc, notAfter: utc + day,
        versionIdentitySha256: state.build.versionIdentitySha256, buildIdentitySha256: state.build.buildIdentitySha256,
        buildManifestSha256: state.build.buildManifestSha256 });
      const request = f.requestSnapshot(f.sign("activation-request", rp)), payload = f.payload("pos-time-correction");
      Object.assign(payload, { edition, tokenId: f.bytes(l), licenseId: p.licenseId, activationId: p.activationId,
        installationId: state.device.installationId, deviceKeyId: state.device.deviceKeyId,
        requestId: request.requestId, requestHash: request.requestHash, incidentId: i.id, incidentNonce: i.nonce,
        expectedStateGeneration: state.stateGeneration, newStateGeneration: state.stateGeneration + 1n,
        timeCorrectionRevision: state.timeCorrectionRevision + 1n, preIncidentClockHighWater: i.preIncidentClockHighWater,
        issuedAt: utc, correctedUtc: utc, notBefore: utc, notAfter: utc + 3600n });
      apply(s, { kind: "APPLY_TIME_CORRECTION", encoded: f.sign("time-correction", payload), request,
        observation: receipt(s, s.state.observedUtc, s.tick + elapsedAfterIncident), evidence: { bootId: s.boot, sentMonotonicMs: s.tick, requestHash: request.requestHash } });
      s.tick += elapsedAfterIncident;
    }

    test("ordinary-now-cannot-launder-floor", () => {
      const s = fresh(); observe(s, now + 2n * day);
      apply(s, { kind: "REEVALUATE" }, now + 500n * day);
      assert.equal(s.state.clockHighWater, now); assert.equal(effective(s), "ACTIVE");
      assert.equal(s.machine.project(s.state, now + 500n * day).state, "ACTIVE");
    });
    test("small-wall-steps-do-not-ratchet-floor", () => {
      const s = fresh(); observe(s, now + 299n, false, 1000n); assert.equal(s.state.clockHighWater, now);
      observe(s, now + 598n, false, 1000n); assert.equal(effective(s), "RECOVERY_REQUIRED");
    });
    test("future-renewal-retains-current-until-signed-time", () => {
      const s = fresh(); apply(s, renew(s)); observe(s, now + 2n * day);
      assert.equal(s.state.current.entitlement.payload.generation, 1n); assert(s.state.pending);
      correct(s, now + 2n * day); assert.equal(s.state.current.entitlement.payload.generation, 2n); assert.equal(effective(s), "ACTIVE");
    });
    test("fresh-offline-renewal-corroborates-at-receipt", () => {
      const s = fresh(); observe(s, now + 2n * day);
      apply(s, renew(s, now + 2n * day, now + day, { observation: receipt(s, now + 2n * day, 5000n) }));
      assert.equal(s.state.clockHighWater, now + 2n * day); assert.equal(s.state.current.entitlement.payload.generation, 2n);
      observe(s, now + 2n * day + 1n, false, 6000n); assert.equal(s.state.clockHighWater, now + 2n * day + 1n);
    });
    test("signed-import-without-receipt-cannot-advance-floor", () => {
      const s = fresh(); observe(s, now + 2n * day); apply(s, renew(s, now + 2n * day));
      assert.equal(s.state.clockHighWater, now); assert.equal(s.state.current.entitlement.payload.generation, 1n);
    });
    test("provisional-lapse-cannot-waive-no-shortening", () => {
      const s = fresh(), p = s.state.current.entitlement.payload;
      observe(s, p.graceUntil + day);
      const before = s.state, c = renew(s, now, now, {}, { features: [...p.features].slice(0, -1) });
      const r = s.machine.transition(before, c, now);
      assert.equal(r.ok, false); assert.equal(r.errorCode, "ENTITLEMENT_AUTHORIZATION_SHORTENED");
      assert.equal(r.state, before);
    });
    test("fresh-signed-lapsed-renewal-can-prove-real-lapse", () => {
      const s = fresh(), at = s.state.current.entitlement.payload.graceUntil + day;
      observe(s, at);
      apply(s, renew(s, at, at, { observation: receipt(s, at) }, {
        termEndsAt: at + 7n * day, warningStartsAt: at, graceSeconds: 0n,
        graceUntil: at + 7n * day, notAfter: at + 8n * day,
      }));
      assert.equal(s.state.current.entitlement.payload.generation, 2n);
      assert.equal(effective(s), "EXPIRING"); assert.equal(s.state.clockHighWater, at);
    });
    test("scheduled-revoke-is-provisional-before-floor", () => {
      const s = fresh(); control(s, "REVOKE", now + day); observe(s, now + 2n * day);
      assert.equal(s.state.tombstones.length, 0); assert.equal(effective(s), "RECOVERY_REQUIRED");
      correct(s, now + 10n); assert.equal(effective(s), "ACTIVE"); assert.equal(s.state.tombstones.length, 0);
    });
    test("scheduled-revoke-matures-only-after-signed-time", () => {
      const s = fresh(); control(s, "REVOKE", now + day); observe(s, now + 2n * day);
      correct(s, now + 2n * day); assert.equal(effective(s), "REVOKED_LOCKED"); assert.equal(s.state.tombstones.length, 1);
    });
    test("scheduled-unsuspend-needs-corroboration", () => {
      const s = fresh(); control(s, "SUSPEND", now); control(s, "UNSUSPEND", now + day); observe(s, now + 2n * day);
      assert.equal(effective(s), "SUSPENDED_LOCKED"); correct(s, now + 2n * day); assert.equal(effective(s), "ACTIVE");
    });
    test("provisional-suspend-can-be-time-repaired", () => {
      const s = fresh(); control(s, "SUSPEND", now + day); observe(s, now + 2n * day);
      assert.equal(effective(s), "SUSPENDED_LOCKED"); correct(s, now + 10n); assert.equal(effective(s), "ACTIVE");
    });
    test("ordinary-signed-lease-corroborates-at-receipt", () => {
      const s = fresh("HYBRID_LEASED"); observe(s, now + 2n * day);
      apply(s, lease(s, s.state.current, now + 2n * day, { observation: receipt(s, now + 2n * day, 5000n) }));
      assert.equal(s.state.clockHighWater, now + 2n * day); assert.equal(effective(s), "ACTIVE");
    });
    test("future-hybrid-pair-retains-predecessor-until-proof", () => {
      const s = fresh("HYBRID_LEASED"); apply(s, renew(s)); observe(s, now + 2n * day);
      apply(s, lease(s, s.state.pending, now + 2n * day));
      assert.equal(s.state.current.entitlement.payload.generation, 1n); assert(s.state.pending.lease);
      correct(s, now + 2n * day);
      assert.equal(s.state.current.entitlement.payload.generation, 2n); assert.equal(effective(s), "ACTIVE");
    });
    test("fractional-floor-survives-new-boot", () => {
      const s = fresh(); observe(s, now, false, 1750n); assert.equal(s.state.clockHighWater, now);
      observe(s, now + day, true, 1000n); observe(s, now + day, false, 1250n);
      assert.equal(s.state.clockHighWater, now + 1n);
    });
    test("repair-preserves-justified-elapsed-floor", () => {
      const s = fresh();
      correct(s, now + 10n, 51000n);
      assert.equal(s.state.clockHighWater, now + 52n);
      assert.equal(s.state.observedUtc, now + 52n);
    });
    test("newboot-incident-preserves-waiting-elapsed", () => {
      const s = fresh(); s.boot = f.bytes(label()); s.tick = 0n;
      correct(s, now + 1n, 600000n);
      assert.equal(s.state.clockHighWater, now + 600n);
    });
    test("invalid-receipt-command-is-neutral", () => {
      const s = fresh(); observe(s, now + 2n * day);
      const before = s.state, c = renew(s, now + 2n * day, now + day, { observation: receipt(s, now + 2n * day, 999n) });
      const r = s.machine.transition(before, c, now); assert.equal(r.ok, false); assert.equal(r.state, before);
    });
    test("forged-or-legacy-state-has-no-provenance", () => {
      const s = fresh(), r = s.machine.transition({ ...s.state }, { kind: "REEVALUATE" }, now);
      assert.equal(r.ok, false); assert.equal(r.errorCode, "UNTRUSTED_MODEL_STATE");
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
