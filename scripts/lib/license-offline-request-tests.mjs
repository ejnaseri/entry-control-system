// TEST_ONLY_DO_NOT_TRUST. Protected-store and installation-provider doubles only.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS, P256_ORDER } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineRequestTests(production) {
  const ids = [], failures = [];
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  const dump = v => JSON.stringify(v, (_, x) => typeof x === "bigint" ? `${x}n` : x instanceof Uint8Array ? [...x] : x);
  const key = TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY;
  const accept = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const reject = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.durable, false); assert(!("bytes" in r)); };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup(assurance = "SOFTWARE_BOUND") {
      const machine = production.core.createLicenseStateMachineV1({ ...f.configuration, device: f.deviceForKey(undefined, { assurance }) });
      const s = { machine, state: machine.initial(), counter: 0, signs: 0, writes: 0, records: new Map() };
      s.installation = {
        randomBytes: length => f.bytes(`request-${++s.counter}`, length),
        signInstallation: async ({ deviceKeyId, sigStructure }) => {
          s.signs++; assert.deepEqual(deviceKeyId, new Uint8Array(key.kid));
          return new Uint8Array(signEs256Rfc6979LowS(sigStructure, key.privateScalar));
        },
      };
      s.registration = { register: async plan => {
        s.writes++;
        if (plan.expectedStateGeneration !== s.state.stateGeneration || !Buffer.from(plan.expectedStateHash).equals(Buffer.from(s.state.stateHash))) return undefined;
        const id = Buffer.from(plan.requestId).toString("hex"), old = s.records.get(id);
        if (old && !Buffer.from(old.requestHash).equals(Buffer.from(plan.requestHash))) return undefined;
        if ([...s.records.values()].some(r => Buffer.from(r.requestNonce).equals(Buffer.from(plan.requestNonce)) && !Buffer.from(r.requestHash).equals(Buffer.from(plan.requestHash)))) return undefined;
        if (!old) s.records.set(id, plan);
        return { decision: old ? "EXACT_RETRY" : "REGISTERED", requestId: plan.requestId, requestHash: plan.requestHash };
      } };
      s.make = () => production.createOfflineRequestWorkflowV1({ machine, verification: f.verification, installation: s.installation, registration: s.registration });
      s.workflow = s.make();
      s.input = { purpose: "ACTIVATE", issuedAt: f.now, notAfter: f.now + 86400n };
      return s;
    }
    const prepare = async s => accept(await s.workflow.prepare(s.state, s.input)).plan;
    const decoded = bytes => accept(f.verifier.verifySignedObject({ expectedType: "activation-request", encoded: bytes })).value.payload;
    await test(`${edition}/signed-activation-register-before-export`, async () => {
      const s = setup(), before = dump(s.state), plan = await prepare(s); assert.equal(s.writes, 0);
      const out = accept(await s.workflow.export(plan)), p = decoded(out.bytes);
      assert.equal(s.writes, 1); assert.equal(out.durable, false); assert.equal(out.runtimeAuthority, "NONE");
      assert.match(out.filename, /^Entry-Control-[0-9a-f]{32}\.ecsreq$/); assert.equal(p.edition, edition);
      assert.equal(p.requestPurpose, "ACTIVATE"); assert.equal(p.stateGeneration, 0n);
      assert.deepEqual(p.deviceKeyId, f.device.deviceKeyId); assert.deepEqual(p.buildManifestSha256, f.build.buildManifestSha256);
      assert.equal(dump(s.state), before);
      assert.deepEqual(plan.requestHash, production.nodeCryptoV1.sha256(out.bytes));
    });
    await test(`${edition}/repeat-export-exact-bytes-no-resign`, async () => {
      const s = setup(), p = await prepare(s), a = accept(await s.workflow.export(p)), b = accept(await s.workflow.export(p));
      assert.deepEqual(a.bytes, b.bytes); assert.equal(b.decision, "EXACT_RETRY"); assert.equal(s.signs, 1);
      a.bytes.fill(0); p.encoded.fill(0); assert.deepEqual(accept(await s.workflow.export(p)).bytes, b.bytes);
    });
    await test(`${edition}/unique-id-and-nonce-no-identity-rotation`, async () => {
      const s = setup(), a = await prepare(s), b = await prepare(s);
      assert.notDeepEqual(a.requestId, b.requestId); assert.notDeepEqual(a.requestNonce, b.requestNonce);
      assert.deepEqual(decoded(a.encoded).devicePublicKey, decoded(b.encoded).devicePublicKey);
    });
    await test(`${edition}/closed-purpose-and-input`, async () => {
      const s = setup(); reject(await s.workflow.prepare(s.state, { ...s.input, purpose: "UNKNOWN" }), "REQUEST_PURPOSE_UNSUPPORTED");
      for (const field of ["path", "edition", "licenseId", "deviceKeyId", "features", "stateGeneration"]) {
        reject(await s.workflow.prepare(s.state, { ...s.input, [field]: "unsafe" }), "REQUEST_INPUT_FIELD_FORBIDDEN");
      }
      assert.equal(s.signs, 0);
    });
    await test(`${edition}/finite-explicit-window-before-sign`, async () => {
      const s = setup(); for (const end of [f.now, f.now - 1n, f.now + 2592001n, 999999999999n, 1.5]) {
        reject(await s.workflow.prepare(s.state, { ...s.input, notAfter: end }));
      } assert.equal(s.signs, 0);
      accept(await s.workflow.prepare(s.state, { ...s.input, notAfter: f.now + 2592000n }));
    });
    await test(`${edition}/unproven-state-and-plan-rejected`, async () => {
      const s = setup(); reject(await s.workflow.prepare({ ...s.state }, s.input), "UNTRUSTED_MODEL_STATE");
      const p = await prepare(s); reject(await s.workflow.export({ ...p }), "UNTRUSTED_REQUEST_PLAN");
      reject(await s.make().export(p), "UNTRUSTED_REQUEST_PLAN"); assert.equal(s.writes, 0);
    });
    await test(`${edition}/entropy-size-and-failure-neutral`, async () => {
      const s = setup(); s.installation.randomBytes = () => new Uint8Array(17);
      reject(await s.workflow.prepare(s.state, s.input), "REQUEST_ADAPTER_BYTES_INVALID"); assert.equal(s.signs, 0);
      s.installation.randomBytes = () => { throw Error("SECRET_CANARY"); };
      const r = await s.workflow.prepare(s.state, s.input); reject(r); assert(!dump(r).includes("SECRET_CANARY"));
    });
    await test(`${edition}/signature-failure-and-wrong-key-no-registration`, async () => {
      const s = setup(); s.installation.signInstallation = async () => { throw Error("SECRET_CANARY"); };
      const r = await s.workflow.prepare(s.state, s.input); reject(r, "INSTALLATION_SIGNING_FAILED"); assert(!dump(r).includes("SECRET_CANARY"));
      s.installation.signInstallation = async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_REBIND.privateScalar));
      reject(await s.workflow.prepare(s.state, s.input), "SIGNATURE_INVALID"); assert.equal(s.writes, 0);
    });
    await test(`${edition}/high-s-provider-normalized-and-verified`, async () => {
      const s = setup(), original = s.installation.signInstallation;
      s.installation.signInstallation = async input => {
        const sig = await original(input), scalar = BigInt(`0x${Buffer.from(sig.subarray(32)).toString("hex")}`);
        sig.set(Buffer.from((P256_ORDER - scalar).toString(16).padStart(64, "0"), "hex"), 32); return sig;
      }; decoded((await prepare(s)).encoded);
    });
    await test(`${edition}/signer-cannot-mutate-candidate`, async () => {
      const s = setup(), original = s.installation.signInstallation;
      s.installation.signInstallation = async input => { const signature = await original(input); input.sigStructure.fill(0); input.deviceKeyId.fill(0); return signature; };
      decoded((await prepare(s)).encoded);
    });
    await test(`${edition}/registration-failure-no-export`, async () => {
      const s = setup(), p = await prepare(s);
      s.registration.register = async () => { throw Error("SECRET_CANARY"); };
      const r = await s.workflow.export(p); reject(r, "REQUEST_REGISTRATION_UNAVAILABLE"); assert(!dump(r).includes("SECRET_CANARY"));
      s.registration.register = async () => undefined; reject(await s.workflow.export(p), "REQUEST_REGISTRATION_CONFLICT");
      s.registration.register = async () => ({ decision: "REGISTERED", requestId: p.requestId, requestHash: new Uint8Array(32) });
      reject(await s.workflow.export(p), "REQUEST_REGISTRATION_RECEIPT_INVALID");
    });
    await test(`${edition}/state-changed-during-signing-cas-refuses-export`, async () => {
      const s = setup(), p = await prepare(s), a = f.initialActivation();
      s.state = accept(s.machine.transition(s.state, a.command, f.now)).state;
      reject(await s.workflow.export(p), "REQUEST_REGISTRATION_CONFLICT"); assert.equal(s.records.size, 0);
    });
    await test(`${edition}/id-or-nonce-collision-not-overwrite`, async () => {
      const s = setup(), p = await prepare(s); accept(await s.workflow.export(p));
      s.installation.randomBytes = n => n === 16 ? p.requestId : f.bytes("different-nonce", 32);
      reject(await s.workflow.export(await prepare(s)), "REQUEST_REGISTRATION_CONFLICT");
      s.installation.randomBytes = n => n === 16 ? f.bytes("different-id") : p.requestNonce;
      reject(await s.workflow.export(await prepare(s)), "REQUEST_REGISTRATION_CONFLICT"); assert.equal(s.records.size, 1);
    });
    await test(`${edition}/tpm-missing-or-failed-never-downgrades`, async () => {
      const s = setup("TPM_ATTESTED"); reject(await s.workflow.prepare(s.state, s.input), "TPM_ATTESTATION_UNAVAILABLE");
      s.installation.attestTpm = async () => { throw Error("SECRET_CANARY"); };
      reject(await s.workflow.prepare(s.state, s.input), "TPM_ATTESTATION_UNAVAILABLE"); assert.equal(s.signs, 0);
      s.installation.attestTpm = async () => new Uint8Array(65537);
      reject(await s.workflow.prepare(s.state, s.input), "TPM_EVIDENCE_SIZE_INVALID");
    });
    await test(`${edition}/tpm-context-is-exact-protocol-binding-only`, async () => {
      const s = setup("TPM_ATTESTED"); let context;
      s.installation.attestTpm = async hash => { context = new Uint8Array(hash); hash.fill(0); return new Uint8Array([1, 2, 3]); };
      const p = decoded((await prepare(s)).encoded); assert.equal(p.bindingKind, "TPM_ATTESTED");
      assert.deepEqual(p.tpmEvidence.contextHash, context); // Dummy evidence is NOT hardware attestation proof.
    });
    await test(`${edition}/renewal-derived-from-current-lineage`, async () => {
      const s = setup(); s.input.purpose = "RENEW";
      reject(await s.workflow.prepare(s.state, s.input), "RENEWAL_REQUIRES_LINEAGE");
      s.state = accept(s.machine.transition(s.state, f.initialActivation().command, f.now)).state;
      const p = decoded((await prepare(s)).encoded), parent = s.state.current.entitlement.payload;
      assert.deepEqual(p.entitlementTokenId, parent.tokenId); assert.deepEqual(p.licenseId, parent.licenseId);
      assert.equal(p.entitlementGeneration, s.state.entitlementGeneration); assert.equal(p.stateGeneration, s.state.stateGeneration);
      reject(await s.workflow.prepare(s.state, { ...s.input, purpose: "ACTIVATE" }), "ACTIVATION_REQUIRES_EMPTY_LINEAGE");
    });
    await test(`${edition}/generated-request-response-roundtrip-and-replay`, async () => {
      const s = setup(), plan = await prepare(s); accept(await s.workflow.export(plan));
      const artifact = f.initialActivation().entitlementPayload;
      artifact.requestId = plan.requestId; artifact.requestHash = plan.requestHash;
      const command = { kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", artifact), request: f.requestSnapshot(plan.encoded) };
      const first = accept(s.machine.transition(s.state, command, f.now));
      assert.equal(s.machine.project(first.state, f.now).state, "ACTIVE");
      assert.equal(accept(s.machine.transition(first.state, command, f.now)).decision, "IDEMPOTENT");
      artifact.tokenId = f.bytes("reused-request-different-response");
      assert.equal(s.machine.transition(first.state, { ...command, encoded: f.sign("entitlement", artifact) }, f.now).ok, false);
      artifact.requestHash = new Uint8Array(32);
      assert.equal(s.machine.transition(s.state, { ...command, encoded: f.sign("entitlement", artifact) }, f.now).ok, false);
    });
    await test(`${edition}/renewal-uses-highest-pending-predecessor`, async () => {
      const s = setup(), initial = f.initialActivation({ notBefore: f.now + 86400n, termStartsAt: f.now + 86400n });
      s.state = accept(s.machine.transition(s.state, initial.command, f.now)).state;
      assert(s.state.pending); assert(!s.state.current); s.input.purpose = "RENEW";
      const p = decoded((await prepare(s)).encoded);
      assert.deepEqual(p.entitlementTokenId, s.state.pending.entitlement.payload.tokenId);
      assert.equal(p.entitlementGeneration, 1n);
    });
    await test(`${edition}/concurrent-exact-export-single-record`, async () => {
      const s = setup(), p = await prepare(s), out = await Promise.all([s.workflow.export(p), s.workflow.export(p)]);
      out.forEach(accept); assert.equal(s.records.size, 1);
      assert.deepEqual(out.map(r => r.decision).sort(), ["EXACT_RETRY", "REGISTERED"]);
    });
    await test(`${edition}/consumed-id-refused-before-signing`, async () => {
      const s = setup(), a = f.initialActivation(); s.state = accept(s.machine.transition(s.state, a.command, f.now)).state;
      s.input.purpose = "RENEW"; s.installation.randomBytes = n => n === 16 ? a.request.requestId : f.bytes("nonce", 32);
      reject(await s.workflow.prepare(s.state, s.input), "REQUEST_ID_ALREADY_CONSUMED"); assert.equal(s.signs, 0);
    });
    await test(`${edition}/malformed-provider-signature-refused`, async () => {
      const s = setup(); s.installation.signInstallation = async () => new Uint8Array(64);
      reject(await s.workflow.prepare(s.state, s.input), "INSTALLATION_SIGNATURE_INVALID");
      s.installation.signInstallation = async () => new Uint8Array(65);
      reject(await s.workflow.prepare(s.state, s.input), "INSTALLATION_SIGNING_FAILED");
    });
    await test(`${edition}/async-input-mutation-cannot-change-request`, async () => {
      const s = setup(), original = s.installation.signInstallation; let release;
      s.installation.signInstallation = input => new Promise(resolve => { release = async () => resolve(await original(input)); });
      const pending = s.workflow.prepare(s.state, s.input);
      s.input.purpose = "RENEW"; s.input.notAfter = 0n; await release();
      const p = decoded(accept(await pending).plan.encoded); assert.equal(p.requestPurpose, "ACTIVATE"); assert.equal(p.notAfter, f.now + 86400n);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
