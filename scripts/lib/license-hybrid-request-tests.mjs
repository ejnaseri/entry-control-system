// TEST_ONLY_DO_NOT_TRUST. Real core/signatures with in-memory Vendor/ledger doubles.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS, P256_ORDER } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseHybridRequestTests(production) {
  const ids = [], failures = [], key = TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY;
  const hex = b => Buffer.from(b).toString("hex");
  const dump = x => JSON.stringify(x, (_, v) => typeof v === "bigint" ? `${v}n` : v instanceof Uint8Array ? [...v] : v);
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert(!("bytes" in r)); };
  const test = async (id, fn) => { ids.push(id); try { await fn(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition }), core = production.core;
    const challenge = (nonce, extra = {}) => core.encodeDeterministicCborV1(new Map(Object.entries({
      schemaVersion: 1n, carrierType: "lease-challenge", requestNonce: nonce, expiresInSeconds: 300n, ...extra,
    })));
    function setup({ mode = "HYBRID_LEASED", active = false, noPublicKey = false } = {}) {
      const device = { ...f.device }; if (noPublicKey) delete device.devicePublicKey;
      const machine = core.createLicenseStateMachineV1({ ...f.configuration, device });
      const s = { machine, state: machine.initial(), entropy: 0, challenges: 0, signs: 0, writes: 0, records: new Map(), clockReads: 0 };
      s.advance = command => { s.state = ok(machine.transition(s.state, command, f.now)).state; };
      s.advance(f.initialActivation({ mode }).command);
      s.lease = () => {
        const p = (s.state.pending ?? s.state.current).entitlement.payload;
        const r = f.payload("pos-lease-request-check-in"), d = s.state.device, b = s.state.build, c = s.state.control;
        Object.assign(r, { edition, requestId: f.bytes("seed-lease-request"), requestNonce: f.bytes("seed-lease-nonce", 32),
          stateGeneration: s.state.stateGeneration, licenseId: p.licenseId, activationId: p.activationId,
          entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, keyId: d.deviceKeyId,
          deviceKeyId: d.deviceKeyId, installationId: d.installationId, lastLeaseRevision: s.state.leaseRevision,
          versionIdentitySha256: b.versionIdentitySha256, buildIdentitySha256: b.buildIdentitySha256, buildManifestSha256: b.buildManifestSha256,
          controlRevision: c.revision, controlState: c.state, controlEffectiveAt: c.effectiveAt, controlReasonCode: c.reasonCode,
          ...(d.bindingRecoveryTokenId ? { bindingRecoveryTokenId: d.bindingRecoveryTokenId } : {}) });
        const request = f.requestSnapshot(f.sign("lease-request", r));
        const l = f.payload("pos-lease-initial-control");
        Object.assign(l, { edition, tokenId: f.bytes("seed-lease"), licenseId: p.licenseId, activationId: p.activationId,
          installationId: d.installationId, deviceKeyId: d.deviceKeyId, assurance: d.assurance, features: p.features,
          entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, leaseRequestId: request.requestId, leaseRequestHash: request.requestHash,
          leaseRevision: s.state.leaseRevision + 1n, issuedAt: f.now, notBefore: f.now, serverTime: f.now,
          notAfter: f.now + p.offlineAllowanceSeconds, offlineUntil: f.now + p.offlineAllowanceSeconds,
          controlRevision: c.revision, controlState: c.state, controlEffectiveAt: c.effectiveAt, controlReasonCode: c.reasonCode,
          ...(d.bindingRecoveryTokenId ? { bindingRecoveryTokenId: d.bindingRecoveryTokenId } : {}) });
        return { kind: "IMPORT_LEASE", encoded: f.sign("lease", l), request, parentTokenId: p.tokenId };
      };
      if (active && mode === "HYBRID_LEASED") s.advance(s.lease());
      s.observation = { wallUtc: f.now + 90000n, bootId: f.bytes("hybrid-boot"), monotonicMs: 1000n };
      s.time = { observe: () => { s.clockReads++; return s.observation; } };
      s.openIncident = () => {
        const incident = { id: f.bytes("time-incident"), nonce: f.bytes("time-nonce", 32), reason: "CLOCK_FORWARD_JUMP" };
        s.advance({ kind: "OBSERVE_TIME", observation: { ...s.observation, wallUtc: f.now }, incident });
        s.advance({ kind: "BEGIN_TIME_RECOVERY", observation: s.observation, incident });
      };
      s.challenge = { acquire: async input => {
        s.challenges++;
        assert.deepEqual(input, { method: "POST", path: "/v1/licensing/lease-challenges",
          responseMediaType: "application/vnd.entry-control.lease-challenge+cbor;v=1", maxResponseBytes: 4096, zeroRttAllowed: false });
        return challenge(f.bytes(`vendor-nonce-${s.challenges}`, 32));
      } };
      s.installation = { randomBytes: n => { assert.equal(n, 16); return f.bytes(`request-${++s.entropy}`); },
        signInstallation: async ({ deviceKeyId, sigStructure }) => {
          s.signs++; assert.deepEqual(deviceKeyId, new Uint8Array(key.kid));
          return new Uint8Array(signEs256Rfc6979LowS(sigStructure, key.privateScalar));
        } };
      s.registration = { register: async p => {
        s.writes++;
        if (p.expectedStateGeneration !== s.state.stateGeneration || hex(p.expectedStateHash) !== hex(s.state.stateHash)) return undefined;
        const old = s.records.get(hex(p.requestId));
        if (old && dump(old) !== dump(p)) return undefined;
        if ([...s.records.values()].some(v => hex(v.requestNonce) === hex(p.requestNonce) && hex(v.requestHash) !== hex(p.requestHash))) return undefined;
        if (!old) s.records.set(hex(p.requestId), p);
        return { decision: old ? "EXACT_RETRY" : "REGISTERED", requestId: p.requestId, requestHash: p.requestHash };
      } };
      s.make = () => production.createHybridRequestWorkflowV1({ machine, verification: f.verification,
        installation: s.installation, challenge: s.challenge, registration: s.registration, time: s.time });
      s.workflow = s.make();
      s.input = { purpose: "CHECK_IN", target: active || mode === "OFFLINE_BOUND" ? "CURRENT" : "PENDING" };
      return s;
    }
    const prepare = async s => ok(await s.workflow.prepare(s.state, s.input)).plan;
    const decode = (s, encoded) => ok(f.verifier.verifySignedObject({ expectedType: "lease-request", encoded,
      context: { workflow: "VENDOR_HTTPS_REQUEST", build: s.state.build, device: s.state.device } })).value.payload;

    await test(`${edition}/initial-pending-signed-request-register-before-release`, async () => {
      const s = setup(), before = dump(s.state), p = await prepare(s);
      assert.equal(s.writes, 0); const out = ok(await s.workflow.release(p)), r = decode(s, out.bytes);
      assert.equal(s.writes, 1); assert.equal(out.path, "/v1/licensing/leases"); assert.equal(out.method, "POST");
      assert.equal(out.mediaType, "application/vnd.entry-control.lease-request+cbor;v=1");
      assert.equal(r.edition, edition); assert.deepEqual(r.entitlementTokenId, s.state.pending.entitlement.payload.tokenId);
      assert.equal(r.stateGeneration, s.state.stateGeneration); assert.equal(r.entitlementGeneration, p.parentGeneration);
      assert.deepEqual(r.requestNonce, f.bytes("vendor-nonce-1", 32)); assert.equal(r.httpPath, out.path);
      assert.equal(hex(p.requestHash), hex(f.hash(out.bytes))); assert.equal(dump(s.state), before);
      assert.equal(out.durable, false); assert.equal(out.runtimeAuthority, "NONE"); assert.equal(s.clockReads, 0);
    });
    await test(`${edition}/current-parent-and-high-water`, async () => {
      const s = setup({ active: true }), r = decode(s, (await prepare(s)).encoded);
      assert.equal(r.lastLeaseRevision, s.state.leaseRevision); assert.deepEqual(r.entitlementTokenId, s.state.current.entitlement.payload.tokenId);
      for (const [field, value] of Object.entries({ controlRevision: s.state.control.revision, controlState: s.state.control.state,
        controlEffectiveAt: s.state.control.effectiveAt, controlReasonCode: s.state.control.reasonCode })) assert.equal(r[field], value);
    });
    await test(`${edition}/current-and-pending-renewal-remain-distinct`, async () => {
      const s = setup({ active: true }), base = s.state.current.entitlement.payload;
      const generator = production.createOfflineRequestWorkflowV1({ machine: s.machine, verification: f.verification,
        installation: { ...s.installation, randomBytes: n => f.bytes(`renew-request-${++s.entropy}`, n) }, registration: s.registration });
      const requestPlan = ok(await generator.prepare(s.state, { purpose: "RENEW", issuedAt: f.now, notAfter: f.now + 86400n })).plan;
      const request = f.requestSnapshot(requestPlan.encoded);
      const payload = { ...f.clone(base), tokenId: f.bytes("pending-successor"), generation: base.generation + 1n,
        previousTokenId: base.tokenId, requestId: request.requestId, requestHash: request.requestHash,
        issuedAt: f.now, termStartsAt: f.now + 120n, termEndsAt: base.termEndsAt + 86400n,
        graceUntil: base.graceUntil + 86400n, notAfter: base.notAfter + 86400n, warningStartsAt: base.warningStartsAt + 86400n };
      s.advance({ kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", payload), request });
      const before = dump(s.state);
      const a = ok(await s.workflow.prepare(s.state, { purpose: "CHECK_IN", target: "CURRENT" })).plan;
      const b = ok(await s.workflow.prepare(s.state, { purpose: "CHECK_IN", target: "PENDING" })).plan;
      assert.deepEqual(decode(s, a.encoded).entitlementTokenId, base.tokenId);
      assert.deepEqual(decode(s, b.encoded).entitlementTokenId, payload.tokenId);
      assert.equal(a.parentGeneration, 1n); assert.equal(b.parentGeneration, 2n);
      ok(await s.workflow.release(a)); ok(await s.workflow.release(b)); assert.equal(dump(s.state), before);
    });
    await test(`${edition}/missing-device-public-key-before-io`, async () => {
      const s = setup({ noPublicKey: true });
      no(await s.workflow.prepare(s.state, s.input), "REQUEST_ADAPTER_BYTES_INVALID"); assert.equal(s.challenges, 0); assert.equal(s.signs, 0);
    });
    await test(`${edition}/empty-offline-missing-target-before-io`, async () => {
      const s = setup(); no(await s.workflow.prepare(s.machine.initial(), s.input), "HYBRID_PARENT_REQUIRED");
      no(await s.workflow.prepare(s.state, { purpose: "CHECK_IN", target: "CURRENT" }), "HYBRID_PARENT_REQUIRED");
      const offline = setup({ mode: "OFFLINE_BOUND" }); no(await offline.workflow.prepare(offline.state, offline.input), "HYBRID_MODE_REQUIRED");
      assert.equal(s.challenges + offline.challenges, 0);
    });
    await test(`${edition}/closed-input-before-io`, async () => {
      const s = setup();
      for (const input of [null, { purpose: "RENEW" }, { purpose: "CHECK_IN", target: "AUTO" },
        ...["url", "requestNonce", "edition", "stateGeneration", "trustedNow", "encoded", "timeEvidence"].map(k => ({ ...s.input, [k]: 1 }))])
        no(await s.workflow.prepare(s.state, input));
      assert.equal(s.challenges, 0); assert.equal(s.signs, 0);
    });
    await test(`${edition}/state-and-plan-provenance`, async () => {
      const s = setup(); no(await s.workflow.prepare({ ...s.state }, s.input), "UNTRUSTED_MODEL_STATE"); assert.equal(s.challenges, 0);
      const p = await prepare(s); no(await s.workflow.release({ ...p }), "UNTRUSTED_REQUEST_PLAN");
      no(await s.make().release(p), "UNTRUSTED_REQUEST_PLAN"); assert.equal(s.writes, 0);
    });
    await test(`${edition}/challenge-network-failure-is-neutral-and-redacted`, async () => {
      const s = setup(), before = dump(s.state); s.challenge.acquire = async () => { throw Error("SECRET_CANARY"); };
      const r = await s.workflow.prepare(s.state, s.input); no(r, "CHALLENGE_UNAVAILABLE");
      assert(!dump(r).includes("SECRET_CANARY")); assert.equal(s.signs, 0); assert.equal(dump(s.state), before);
    });
    await test(`${edition}/challenge-bounds-and-type`, async () => {
      const s = setup(); for (const value of [new Uint8Array(), new Uint8Array(4097), "unsafe", null]) {
        s.challenge.acquire = async () => value; no(await s.workflow.prepare(s.state, s.input), "CHALLENGE_BYTES_INVALID");
      } assert.equal(s.signs, 0);
    });
    await test(`${edition}/challenge-schema-expiry-nonce-trailing`, async () => {
      const s = setup(), valid = challenge(f.bytes("n", 32));
      for (const value of [challenge(f.bytes("n", 16)), challenge(f.bytes("n", 32), { expiresInSeconds: 301n }),
        challenge(f.bytes("n", 32), { serverTime: f.now }), new Uint8Array([...valid, 0])]) {
        s.challenge.acquire = async () => value; no(await s.workflow.prepare(s.state, s.input));
      } assert.equal(s.signs, 0);
    });
    await test(`${edition}/input-mutation-during-challenge`, async () => {
      const s = setup(), input = { ...s.input }, original = s.challenge.acquire;
      s.challenge.acquire = async request => { input.target = "CURRENT"; input.purpose = "TIME_RECOVERY"; return original(request); };
      const p = ok(await s.workflow.prepare(s.state, input)).plan; assert.equal(decode(s, p.encoded).requestPurpose, "CHECK_IN");
      assert.deepEqual(p.parentTokenId, s.state.pending.entitlement.payload.tokenId);
    });
    await test(`${edition}/challenge-and-signer-buffer-mutation`, async () => {
      const s = setup(), received = challenge(f.bytes("stable", 32)), original = s.installation.signInstallation;
      s.challenge.acquire = async () => received;
      s.installation.signInstallation = async input => { const sig = await original(input); received.fill(0); input.sigStructure.fill(0); input.deviceKeyId.fill(0); return sig; };
      assert.deepEqual(decode(s, (await prepare(s)).encoded).requestNonce, f.bytes("stable", 32));
    });
    await test(`${edition}/entropy-size-consumed-id-and-redaction`, async () => {
      const s = setup(); s.installation.randomBytes = () => new Uint8Array(17); no(await s.workflow.prepare(s.state, s.input), "REQUEST_ADAPTER_BYTES_INVALID");
      s.installation.randomBytes = () => s.state.consumedRequests[0].id; no(await s.workflow.prepare(s.state, s.input), "REQUEST_ID_ALREADY_CONSUMED");
      s.installation.randomBytes = () => { throw Error("SECRET_CANARY"); };
      const r = await s.workflow.prepare(s.state, s.input); no(r); assert(!dump(r).includes("SECRET_CANARY")); assert.equal(s.signs, 0);
    });
    await test(`${edition}/wrong-key-and-malformed-signatures`, async () => {
      const s = setup(); s.installation.signInstallation = async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_REBIND.privateScalar));
      no(await s.workflow.prepare(s.state, s.input), "SIGNATURE_INVALID");
      s.installation.signInstallation = async () => new Uint8Array(64); no(await s.workflow.prepare(s.state, s.input), "INSTALLATION_SIGNATURE_INVALID");
      s.installation.signInstallation = async () => new Uint8Array(65); no(await s.workflow.prepare(s.state, s.input), "INSTALLATION_SIGNING_FAILED");
      assert.equal(s.writes, 0);
    });
    await test(`${edition}/high-s-normalization`, async () => {
      const s = setup(), original = s.installation.signInstallation;
      s.installation.signInstallation = async input => { const sig = await original(input), scalar = BigInt(`0x${hex(sig.subarray(32))}`);
        sig.set(Buffer.from((P256_ORDER - scalar).toString(16).padStart(64, "0"), "hex"), 32); return sig; };
      decode(s, (await prepare(s)).encoded);
    });
    await test(`${edition}/exact-release-retry-and-plan-copy-isolation`, async () => {
      const s = setup(), p = await prepare(s), a = ok(await s.workflow.release(p)), original = new Uint8Array(a.bytes);
      a.bytes.fill(0); p.encoded.fill(0); p.requestHash.fill(0); p.requestNonce.fill(0);
      const b = ok(await s.workflow.release(p)); assert.equal(b.decision, "EXACT_RETRY"); assert.deepEqual(b.bytes, original);
      assert.equal(s.challenges, 1); assert.equal(s.signs, 1); assert.equal(s.records.size, 1);
    });
    await test(`${edition}/registration-conflict-mismatched-receipt-no-release`, async () => {
      const s = setup(), p = await prepare(s); s.registration.register = async () => undefined;
      no(await s.workflow.release(p), "REQUEST_REGISTRATION_CONFLICT");
      for (const receipt of [{ decision: "UNKNOWN", requestId: p.requestId, requestHash: p.requestHash },
        { decision: "REGISTERED", requestId: f.bytes("other"), requestHash: p.requestHash },
        { decision: "REGISTERED", requestId: p.requestId, requestHash: f.bytes("other", 32) }]) {
        s.registration.register = async () => receipt; no(await s.workflow.release(p), "REQUEST_REGISTRATION_RECEIPT_INVALID");
      }
    });
    await test(`${edition}/lost-registration-ack-exact-retry`, async () => {
      const s = setup(), p = await prepare(s), register = s.registration.register;
      s.registration.register = async plan => { await register(plan); throw Error("SECRET_CANARY"); };
      const r = await s.workflow.release(p); no(r, "REQUEST_REGISTRATION_OUTCOME_UNKNOWN"); assert(!dump(r).includes("SECRET_CANARY"));
      s.registration.register = register; assert.equal(ok(await s.workflow.release(p)).decision, "EXACT_RETRY"); assert.equal(s.records.size, 1);
    });
    await test(`${edition}/state-change-during-signing-refuses-registration`, async () => {
      const s = setup(), original = s.installation.signInstallation;
      s.installation.signInstallation = async input => { s.advance({ kind: "NETWORK", unavailable: true }); return original(input); };
      no(await s.workflow.release(await prepare(s)), "REQUEST_REGISTRATION_CONFLICT"); assert.equal(s.records.size, 0);
    });
    await test(`${edition}/request-id-and-concurrent-nonce-collision`, async () => {
      const s = setup(), p = await prepare(s); ok(await s.workflow.release(p));
      s.installation.randomBytes = () => p.requestId;
      no(await s.workflow.release(await prepare(s)), "REQUEST_REGISTRATION_CONFLICT"); assert.equal(s.records.size, 1);
      const t = setup(); t.challenge.acquire = async () => challenge(f.bytes("same-nonce", 32));
      const [a, b] = await Promise.all([prepare(t), prepare(t)]), results = await Promise.all([t.workflow.release(a), t.workflow.release(b)]);
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(t.records.size, 1);
    });
    await test(`${edition}/time-recovery-model-derived-original-evidence`, async () => {
      const s = setup({ active: true }); s.openIncident(); s.input = { purpose: "TIME_RECOVERY" };
      const before = dump(s.state), p = await prepare(s), r = decode(s, p.encoded);
      assert.equal(r.requestPurpose, "TIME_RECOVERY"); assert.deepEqual(r.incidentId, s.state.timeIncident.id);
      assert.deepEqual(r.incidentNonce, s.state.timeIncident.nonce); assert.equal(r.preIncidentClockHighWater, s.state.timeIncident.preIncidentClockHighWater);
      assert.deepEqual(p.timeEvidence.requestHash, p.requestHash); assert.equal(p.timeEvidence.sentMonotonicMs, 1000n);
      s.observation.monotonicMs = 999999n; ok(await s.workflow.release(p)); ok(await s.workflow.release(p));
      assert.equal(p.timeEvidence.sentMonotonicMs, 1000n); assert.equal(s.clockReads, 1); assert.equal(dump(s.state), before);
    });
    await test(`${edition}/time-recovery-missing-incident-or-forbidden-claims`, async () => {
      const s = setup({ active: true }); no(await s.workflow.prepare(s.state, { purpose: "TIME_RECOVERY" }), "TIME_INCIDENT_REQUIRED");
      no(await s.workflow.prepare(s.state, { purpose: "TIME_RECOVERY", target: "PENDING" }), "REQUEST_INPUT_FIELD_FORBIDDEN");
      assert.equal(s.challenges, 0);
    });
    await test(`${edition}/time-recovery-boot-tick-and-provider-failures`, async () => {
      const s = setup({ active: true }); s.openIncident(); s.input = { purpose: "TIME_RECOVERY" };
      const initial = structuredClone(s.observation);
      for (const observation of [{ ...initial, monotonicMs: 999n }, { ...initial, bootId: f.bytes("wrong-boot") }]) {
        s.observation = observation; no(await s.workflow.prepare(s.state, s.input), "TIME_EVIDENCE_REQUIRES_FRESH_INCIDENT");
      }
      s.time.observe = () => { throw Error("SECRET_CANARY"); }; const r = await s.workflow.prepare(s.state, s.input);
      no(r, "TIME_EVIDENCE_UNAVAILABLE"); assert(!dump(r).includes("SECRET_CANARY")); assert.equal(s.challenges, 0);
    });
    await test(`${edition}/time-evidence-copied-before-challenge-await`, async () => {
      const s = setup({ active: true }); s.openIncident(); s.input = { purpose: "TIME_RECOVERY" };
      const original = s.challenge.acquire, boot = new Uint8Array(s.observation.bootId);
      s.challenge.acquire = async req => { s.observation.bootId.fill(0); s.observation.monotonicMs = 8000n; return original(req); };
      const p = await prepare(s); assert.deepEqual(p.timeEvidence.bootId, boot); assert.equal(p.timeEvidence.sentMonotonicMs, 1000n);
    });
    await test(`${edition}/binding-recovery-reference-from-model`, async () => {
      const s = setup({ active: true });
      s.advance({ kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes("rebind-incident"), nonce: f.bytes("rebind-nonce", 32), reason: "KEY_LOSS" } });
      const old = s.state, nextDevice = f.deviceForKey("TEST_ONLY_INSTALLATION_DEVICE_REBIND");
      const nextKey = TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_REBIND;
      const signer = async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure, nextKey.privateScalar));
      const generator = production.createOfflineRequestWorkflowV1({ machine: s.machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`rebind-request-${++s.entropy}`, n), signInstallation: signer },
        rebind: { readStagedDevice: () => nextDevice }, registration: s.registration });
      const plan = ok(await generator.prepare(old, { purpose: "REBIND", issuedAt: f.now, notAfter: f.now + 86400n })).plan;
      const request = f.requestSnapshot(plan.encoded), parent = old.current.entitlement;
      const recovery = f.payload("pos-recovery-rebind-device");
      Object.assign(recovery, { tokenId: f.bytes("rebind-token"), edition, installationId: old.device.installationId,
        licenseId: parent.payload.licenseId, activationId: parent.payload.activationId, entitlementTokenId: parent.payload.tokenId,
        entitlementTokenHash: parent.hash, entitlementGeneration: parent.payload.generation,
        requestId: plan.requestId, requestHash: plan.requestHash, incidentId: old.incident.id, incidentNonce: old.incident.nonce,
        expectedStateGeneration: old.stateGeneration, newStateGeneration: old.stateGeneration + 1n,
        controlRevision: old.control.revision, maximumFeatures: parent.payload.features, oldDeviceKeyId: old.device.deviceKeyId,
        newDeviceKeyId: nextDevice.deviceKeyId, newAssurance: nextDevice.assurance,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 3600n });
      s.advance({ kind: "RECOVER", encoded: f.sign("recovery", recovery), request, newDevice: nextDevice });
      s.installation.signInstallation = signer;
      const p = await prepare(s), r = decode(s, p.encoded);
      assert.deepEqual(r.bindingRecoveryTokenId, s.state.device.bindingRecoveryTokenId);
      assert.deepEqual(r.deviceKeyId, nextDevice.deviceKeyId); assert.deepEqual(s.state.current.entitlement.hash, parent.hash);
    });
    await test(`${edition}/network-and-storage-restrictions-preserved`, async () => {
      const s = setup({ active: true }); s.advance({ kind: "NETWORK", unavailable: true });
      s.advance({ kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes("storage"), nonce: f.bytes("storage-nonce", 32), reason: "DISK_FAILURE" } });
      const before = dump(s.state); ok(await s.workflow.release(await prepare(s))); assert.equal(dump(s.state), before);
      assert.equal(s.state.recoveryRequired, true); assert.equal(s.state.networkUnavailable, true);
    });
  }
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
