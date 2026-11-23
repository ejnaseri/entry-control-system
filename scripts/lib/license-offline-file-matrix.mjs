// TEST_ONLY_DO_NOT_TRUST. Real verification/completion with in-memory file/store adapters.
import assert from "node:assert/strict";

export async function runOfflineFileMatrix({ edition, kind, production, f, scenario, test }) {
  const success = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); return r; };
  const rejected = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.runtimeAuthority, "NONE"); };
  async function setup() {
    const { s, c } = await scenario();
    const { artifact, authorization, entitlement, ...input } = c.input;
    const bytes = { artifact, authorization, entitlement }, reads = [];
    const expected = kind === "REACTIVATION" ? [["authorization", "reactivation-authorization"], ["entitlement", "entitlement"]]
      : [["artifact", kind === "ENTITLEMENT" ? "entitlement" : kind === "CONTROL" ? "offline-control" : kind === "TIME_CORRECTION" ? "time-correction" : "recovery"]];
    let commits = 0;
    const store = { commit: p => { commits++; return s.store.commit(p); }, confirm: p => s.store.confirm(p) };
    const files = { read: async p => { reads.push([p.role, p.type]); assert(p.maxBytes >= bytes[p.role].length); return bytes[p.role]; }, publish: async () => { throw Error("unexpected export"); } };
    const workflow = production.createOfflineFileWorkflowV1({ machine: s.machine, verification: f.verification, store,
      requests: { read: async id => s.requests.get(Buffer.from(id).toString("hex")) }, rebind: s.rebind, requestWorkflow: s.generator, files });
    return { s, c, input, bytes, reads, expected, files, workflow, commits: () => commits,
      apply: (state = s.state) => workflow.applyImport(state, input, f.now) };
  }
  const run = (name, fn) => test(`${edition}/file-matrix/${kind}/${name}`, fn);
  await run("valid-complete-state", async () => {
    const x = await setup(), before = x.s.state;
    const planned = success(await x.workflow.prepareImport(before, x.input, f.now));
    assert.equal(x.commits(), 0); assert.equal(x.s.state, before); x.reads.length = 0;
    assert.equal(success(await x.apply()).decision, "ADAPTER_ACKNOWLEDGED");
    assert.deepEqual(x.reads, x.expected); assert.equal(x.commits(), 1);
    assert.deepEqual(x.s.state, planned.proposal.state); assert.equal(x.s.state.stateGeneration, before.stateGeneration + 1n);
    assert.equal(x.s.state.consumedRequests.length, before.consumedRequests.length + 1);
    assert.equal(x.s.state.receipts.length, before.receipts.length + (kind === "REACTIVATION" ? 2 : 1));
    if (kind === "CONTROL") {
      assert.equal(x.s.state.control.revision, before.control.revision + 1n);
      assert.equal(x.s.machine.project(x.s.state, f.now).state, "SUSPENDED_LOCKED");
    } else if (kind === "RECOVERY" || kind === "REBIND") {
      assert.equal(x.s.state.recoveryRequired, false);
      assert.deepEqual(x.s.state.current.entitlement.hash, before.current.entitlement.hash);
      assert.equal(x.s.state.consumedRecoveries.length, before.consumedRecoveries.length + 1);
      if (kind === "REBIND") assert.deepEqual(x.s.state.device.deviceKeyId, x.s.staged.deviceKeyId);
    } else if (kind === "TIME_CORRECTION") {
      assert.equal(x.s.state.timeIncident, undefined);
      assert.equal(x.s.state.clockHighWater, x.c.payload.correctedUtc);
      assert.deepEqual(x.s.state.current.entitlement.hash, before.current.entitlement.hash);
    } else {
      assert.equal(x.s.machine.project(x.s.state, f.now).state, "ACTIVE");
      if (kind === "REACTIVATION") {
        assert.deepEqual(x.s.state.tombstones, before.tombstones);
        assert.deepEqual(x.s.state.current.entitlement.payload.licenseId, x.c.a.newLicenseId);
        assert.equal(x.s.state.consumedReactivations.length, before.consumedReactivations.length + 1);
      }
    }
  });
  await run("tampered-each-file-no-commit", async () => {
    for (const role of kind === "REACTIVATION" ? ["authorization", "entitlement"] : ["artifact"]) {
      const x = await setup(), before = x.s.state; x.bytes[role] = new Uint8Array(x.bytes[role]); x.bytes[role][x.bytes[role].length - 1] ^= 1;
      rejected(await x.apply()); assert.equal(x.commits(), 0); assert.equal(x.s.state, before);
    }
  });
  await run("read-failure-no-commit", async () => {
    const x = await setup(), before = x.s.state;
    x.files.read = async () => { throw Error("SECRET_CANARY"); };
    const r = await x.apply(); rejected(r, "FILE_INTAKE_FAILED"); assert(!JSON.stringify(r).includes("SECRET_CANARY"));
    assert.equal(x.commits(), 0); assert.equal(x.s.state, before);
  });
  await run("pending-conflict-and-invalid-ack", async () => {
    const x = await setup(), before = x.s.state;
    for (const [receipt, code] of [[{ decision: "PENDING" }, "COMMIT_PENDING"], [{ decision: "CONFLICT" }, "COMMIT_STATE_CONFLICT"],
      [{ decision: "ACKNOWLEDGED", stateGeneration: 0n, stateHash: before.stateHash }, "COMMIT_ACKNOWLEDGEMENT_INVALID"]]) {
      x.s.store.commit = async () => receipt; rejected(await x.apply(), code); assert.equal(x.s.state, before);
    }
  });
  await run("lost-ack-and-explicit-retry", async () => {
    const x = await setup(), commit = x.s.store.commit;
    x.s.store.commit = async p => { await commit(p); throw Error("SECRET_CANARY"); };
    const r = await x.apply(); rejected(r, "COMMIT_OUTCOME_UNKNOWN"); assert(!JSON.stringify(r).includes("SECRET_CANARY"));
    const after = x.s.state; x.s.store.commit = commit;
    const retry = await x.apply();
    // After a successful Rebind the staged key is already current, so provider
    // admission rejects the retry before recovery-token replay verification.
    const singleUse = { RECOVERY: "RECOVERY_TOKEN_REPLAYED", REBIND: "REBIND_DEVICE_UNAVAILABLE", REACTIVATION: "REACTIVATION_AUTHORIZATION_REPLAYED" };
    if (singleUse[kind]) rejected(retry, singleUse[kind]);
    else assert.equal(success(retry).decision, "ADAPTER_CONFIRMED_DUPLICATE");
    assert.equal(x.s.state, after); assert.equal(x.s.writes, 1);
  });
  await run("concurrent-cas-one-winner", async () => {
    const x = await setup(), before = x.s.state;
    const results = await Promise.all([x.apply(before), x.apply(before)]);
    assert.equal(results.filter(r => r.ok).length, 1); assert.equal(x.s.writes, 1);
    rejected(results.find(r => !r.ok), "COMMIT_STATE_CONFLICT");
  });
  await run("wrong-request-no-write", async () => {
    const x = await setup(), before = x.s.state; x.input.requestId = f.bytes("wrong-file-request");
    rejected(await x.apply()); assert.equal(x.commits(), 0); assert.equal(x.s.state, before);
  });
  await run("caller-bytes-rejected-before-read", async () => {
    const x = await setup();
    rejected(await x.workflow.applyImport(x.s.state, { ...x.input, artifact: new Uint8Array([1]) }, f.now), "FILE_INTENT_INVALID");
    assert.equal(x.reads.length, 0); assert.equal(x.commits(), 0);
  });
}
