// Test-only contextual verification. Loaded only after production graph isolation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodeCanonical, encodeCanonical } from "../../licensing/vectors/v1/lib/cbor.mjs";
import { issueTestOnlyCose } from "../../licensing/vectors/v1/lib/cose.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest();
const equal = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const clone = (value) => structuredClone(value);
const snapshot = (value) => JSON.stringify(value, (_, item) =>
  typeof item === "bigint" ? `${item}n` : item instanceof Uint8Array ? [...item] : item);

function corruptSignature(encoded) {
  const envelope = decodeCanonical(encoded);
  const signature = Buffer.from(envelope.value[3]);
  signature[63] ^= 1;
  envelope.value[3] = signature;
  return Buffer.from(encodeCanonical(envelope));
}

export function executeContextVerificationRegressions(input) {
  const { verifier, golden } = input;
  assert.equal(typeof verifier.verifyCarrier, "function");
  const signed = golden.index.positive.filter((vector) => vector.kind === "SIGNED_OBJECT").map((vector) => {
    const encoded = Buffer.from(golden.readData(vector.path));
    const result = verifier.verifySignedObject({ expectedType: vector.tokenType, encoded });
    assert(result.ok, `${vector.id} setup failed: ${result.stage}/${result.errorCode}`);
    return { vector, encoded, payload: result.value.payload };
  });
  const carriers = golden.index.positive.filter((vector) => vector.kind === "CARRIER").map((vector) => ({
    vector, encoded: Buffer.from(golden.readData(vector.path)),
  }));
  const get = (id) => {
    const item = carriers.find((entry) => entry.vector.id === id);
    assert(item, id);
    return item;
  };
  const requestContext = (encoded) => {
    const carrier = decodeCanonical(encoded);
    const source = signed.find((entry) => entry.vector.tokenType === "lease-request" &&
      equal(entry.payload.requestId, carrier.get("requestId")));
    assert(source, "Carrier requires its matching signed request.");
    const requestPayload = source.payload;
    const entitlement = signed.find((entry) => entry.vector.tokenType === "entitlement" &&
      equal(entry.payload.tokenId, requestPayload.entitlementTokenId));
    assert(entitlement, "Carrier requires its matching parent.");
    const parentPayload = entitlement.payload;
    const deviceKey = input.trustConfiguration.trustedKeys.find((entry) => equal(entry.kid, requestPayload.deviceKeyId));
    assert(deviceKey, "Carrier requires the registered installation key.");
    const lease = signed.find((entry) => entry.vector.tokenType === "lease" &&
      equal(entry.payload.leaseRequestId, requestPayload.requestId));
    const recovery = requestPayload.requestPurpose === "TIME_RECOVERY";
    return {
      build: {
        productVersion: "1.0.0", edition: requestPayload.edition,
        versionIdentitySha256: requestPayload.versionIdentitySha256,
        buildIdentitySha256: requestPayload.buildIdentitySha256,
        buildManifestSha256: requestPayload.buildManifestSha256,
      },
      device: {
        installationId: requestPayload.installationId, deviceKeyId: requestPayload.deviceKeyId,
        devicePublicKey: deviceKey.spkiDer, assurance: lease?.payload.assurance ?? parentPayload.assurance,
        ...(requestPayload.bindingRecoveryTokenId ? { bindingRecoveryTokenId: requestPayload.bindingRecoveryTokenId } : {}),
      },
      parent: {
        tokenId: parentPayload.tokenId, tokenHash: hash(entitlement.encoded), generation: parentPayload.generation,
        edition: parentPayload.edition, licenseId: parentPayload.licenseId, activationId: parentPayload.activationId,
        installationId: parentPayload.installationId, deviceKeyId: parentPayload.deviceKeyId,
        assurance: parentPayload.assurance, mode: parentPayload.mode, features: parentPayload.features,
        notAfter: parentPayload.notAfter, graceUntil: parentPayload.graceUntil,
        checkCadenceSeconds: parentPayload.checkCadenceSeconds, offlineAllowanceSeconds: parentPayload.offlineAllowanceSeconds,
      },
      request: {
        tokenType: "lease-request", requestPurpose: requestPayload.requestPurpose, payload: requestPayload,
        requestId: requestPayload.requestId, requestHash: hash(source.encoded), requestNonce: requestPayload.requestNonce,
        encodedRequest: source.encoded, challengeConsumed: false,
        ...(recovery ? { sameBootElapsedSeconds: 1n } : {}),
      },
      state: {
        stateGeneration: requestPayload.stateGeneration, entitlementGeneration: requestPayload.entitlementGeneration,
        leaseRevision: requestPayload.lastLeaseRevision, controlRevision: requestPayload.controlRevision,
        controlState: requestPayload.controlState, controlEffectiveAt: requestPayload.controlEffectiveAt,
        controlReasonCode: requestPayload.controlReasonCode, timeCorrectionRevision: 0n,
        clockHighWater: requestPayload.preIncidentClockHighWater ?? 0n, terminallyRevoked: false,
        ...(recovery ? { activeIncidentId: requestPayload.incidentId, activeIncidentNonce: requestPayload.incidentNonce } : {}),
      },
      ...(!recovery ? { trustedNow: lease?.payload.serverTime ?? 1_800_000_300n } : {}),
    };
  };
  const complete = get("pos-carrier-lease-response-complete");
  const time = get("pos-carrier-lease-response-time-recovery");
  const trust = get("pos-carrier-trust-bundle");
  const baseContext = requestContext(complete.encoded);
  const timeContext = requestContext(time.encoded);
  const cases = [];
  const add = (id, request, expected, method = "verifyCarrier") => cases.push({ id, request, expected, method });
  const response = (encoded, context = baseContext) => ({ carrierType: "lease-response", encoded, context });
  const mutateCarrier = (encoded, mutate) => {
    const value = decodeCanonical(encoded);
    mutate(value);
    return Buffer.from(encodeCanonical(value));
  };
  const changedContext = (context, mutate) => { const value = clone(context); mutate(value); return value; };

  for (const carrier of carriers) {
    const type = carrier.vector.carrierType;
    const request = { carrierType: type, encoded: carrier.encoded,
      ...(type === "lease-response" ? { context: requestContext(carrier.encoded) } : {}),
      ...(type === "trust-bundle" ? { trustedNow: baseContext.trustedNow } : {}),
    };
    add(`LIC-CRYPTO-CARRIER-${carrier.vector.id}`, request);
    add(`LIC-CRYPTO-TRANSPORT-${carrier.vector.id}`, { carrierType: type, encoded: carrier.encoded }, undefined, "parseCarrier");
  }
  add("LIC-CRYPTO-CARRIER-CONTEXT-ABSENT", response(complete.encoded, undefined), "CARRIER_CONTEXT_REQUIRED");
  // Explicit deletion avoids response()'s baseline default argument.
  delete cases.at(-1).request.context;
  for (const field of ["request", "build", "device", "parent", "state"]) {
    add(`LIC-CRYPTO-CARRIER-MISSING-${field}`, response(complete.encoded,
      changedContext(baseContext, (value) => { delete value[field]; })), "CARRIER_CONTEXT_REQUIRED");
  }
  add("LIC-CRYPTO-CARRIER-MISSING-SPKI", response(complete.encoded,
    changedContext(baseContext, (value) => { delete value.device.devicePublicKey; })), "CARRIER_CONTEXT_REQUIRED");
  for (const bad of [undefined, -1n, 1, "1", 253_402_300_800n]) {
    add(`LIC-CRYPTO-CARRIER-BAD-NOW-${typeof bad}-${String(bad)}`, response(complete.encoded,
      changedContext(baseContext, (value) => { value.trustedNow = bad; })), "CARRIER_CONTEXT_INVALID");
    add(`LIC-CRYPTO-TRUST-BAD-NOW-${typeof bad}-${String(bad)}`, { carrierType: "trust-bundle", encoded: trust.encoded, trustedNow: bad }, "CARRIER_CONTEXT_INVALID");
  }
  add("LIC-CRYPTO-CARRIER-WRONG-DISCRIMINANT", response(complete.encoded,
    changedContext(baseContext, (value) => { value.request.requestPurpose = "ACTIVATE"; })), "CARRIER_CONTEXT_INVALID");
  add("LIC-CRYPTO-CARRIER-SPOOFED-RECOVERY", response(complete.encoded,
    changedContext(baseContext, (value) => { value.request.requestPurpose = "TIME_RECOVERY"; delete value.trustedNow; })), "REQUEST_SNAPSHOT_INVALID");
  add("LIC-CRYPTO-CARRIER-OUTER-REQUEST", response(mutateCarrier(complete.encoded, (value) => {
    const id = Buffer.from(value.get("requestId")); id[0] ^= 1; value.set("requestId", id);
  })), "LEASE_REQUEST_MISMATCH");
  add("LIC-CRYPTO-CARRIER-REQUEST-HASH", response(complete.encoded,
    changedContext(baseContext, (value) => { value.request.requestHash[0] ^= 1; })), "REQUEST_SNAPSHOT_INVALID");
  add("LIC-CRYPTO-CARRIER-REQUEST-SIGNATURE", response(complete.encoded,
    changedContext(baseContext, (value) => { value.request.encodedRequest = corruptSignature(value.request.encodedRequest); })), "REQUEST_SNAPSHOT_INVALID");
  add("LIC-CRYPTO-CARRIER-WRONG-BUILD", response(complete.encoded,
    changedContext(baseContext, (value) => { value.build.buildManifestSha256[0] ^= 1; })), "REQUEST_SNAPSHOT_INVALID");
  add("LIC-CRYPTO-CARRIER-WRONG-DEVICE", response(complete.encoded,
    changedContext(baseContext, (value) => { value.device.deviceKeyId[0] ^= 1; })), "REQUEST_SNAPSHOT_INVALID");
  add("LIC-CRYPTO-CARRIER-WRONG-PARENT", response(complete.encoded,
    changedContext(baseContext, (value) => { value.parent.tokenId[0] ^= 1; })), "LEASE_PARENT_MISMATCH");
  for (const [id, field] of [["pos-carrier-lease-response-complete", "lease"],
    ["pos-carrier-lease-response-control-only", "offlineControl"],
    ["pos-carrier-lease-response-reactivation-only", "reactivationAuthorization"]]) {
    const base = get(id);
    add(`LIC-CRYPTO-CARRIER-SIGNATURE-${field}`, response(mutateCarrier(base.encoded,
      (value) => { value.set(field, corruptSignature(value.get(field))); }), requestContext(base.encoded)), "SIGNATURE_INVALID");
  }
  for (const field of ["delegations", "denylist"]) {
    const encoded = mutateCarrier(trust.encoded, (value) => {
      if (field === "delegations") { const values = [...value.get(field)]; values[0] = corruptSignature(values[0]); value.set(field, values); }
      else value.set(field, corruptSignature(value.get(field)));
    });
    add(`LIC-CRYPTO-TRUST-SIGNATURE-${field}`, { carrierType: "trust-bundle", encoded, trustedNow: baseContext.trustedNow }, "SIGNATURE_INVALID");
    add(`LIC-CRYPTO-NESTED-TRUST-SIGNATURE-${field}`, response(mutateCarrier(complete.encoded,
      (value) => { value.set("trustBundle", encoded); })), "SIGNATURE_INVALID");
  }
  add("LIC-CRYPTO-TRUST-DUPLICATE-KEY", { carrierType: "trust-bundle", trustedNow: baseContext.trustedNow,
    encoded: mutateCarrier(trust.encoded, (value) => { const values = value.get("delegations"); value.set("delegations", [values[0], values[0]]); }),
  }, "SET_NOT_CANONICAL");
  add("LIC-CRYPTO-TIME-RECOVERY-WALL-CLOCK", response(time.encoded,
    changedContext(timeContext, (value) => { value.trustedNow = 1n; })), "CARRIER_CONTEXT_INVALID");
  add("LIC-CRYPTO-TIME-RECOVERY-NO-LEASE", response(mutateCarrier(time.encoded, (value) => {
    value.delete("lease"); value.set("offlineControl", decodeCanonical(get("pos-carrier-lease-response-control-only").encoded).get("offlineControl"));
  }), timeContext), "TIME_RECOVERY_PRIMARY_LEASE_REQUIRED");
  add("LIC-CRYPTO-TIME-RECOVERY-TRUST-UPDATE", response(mutateCarrier(time.encoded,
    (value) => { value.set("trustBundle", trust.encoded); }), timeContext), "TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN");
  for (const [label, elapsed, expected] of [
    ["ZERO", 0n], ["MAX", 300n], ["NEGATIVE", -1n, "TIME_RECOVERY_ROUND_TRIP_INVALID"],
    ["OVER-MAX", 301n, "TIME_RECOVERY_ROUND_TRIP_INVALID"], ["MISSING", undefined, "TIME_RECOVERY_ROUND_TRIP_INVALID"],
    ["NUMBER", 1, "TIME_RECOVERY_ROUND_TRIP_INVALID"], ["STRING", "1", "TIME_RECOVERY_ROUND_TRIP_INVALID"],
    ["NAN", NaN, "TIME_RECOVERY_ROUND_TRIP_INVALID"],
  ]) {
    add(`LIC-CRYPTO-TIME-RECOVERY-ELAPSED-${label}`, response(time.encoded,
      changedContext(timeContext, (value) => { value.request.sameBootElapsedSeconds = elapsed; })), expected);
  }
  add("LIC-CRYPTO-PARSE-NO-PURPOSE-AUTHORITY", { carrierType: "lease-response", encoded: complete.encoded, requestPurpose: "CHECK_IN" }, "CARRIER_CONTEXT_INVALID", "parseCarrier");
  const badLeaseTransport = mutateCarrier(complete.encoded, (value) => { value.set("lease", corruptSignature(value.get("lease"))); });
  add("LIC-CRYPTO-PARSE-DOES-NOT-VERIFY-SIGNATURE", { carrierType: "lease-response", encoded: badLeaseTransport }, undefined, "parseCarrier");

  const rebindRequest = signed.find((item) => item.vector.id === "pos-activation-rebind");
  const rebindRecovery = signed.find((item) => item.vector.id === "pos-recovery-rebind-device");
  const rebindParent = signed.find((item) => item.vector.tokenType === "entitlement" &&
    equal(item.payload.tokenId, rebindRequest.payload.entitlementTokenId));
  assert(rebindParent, "Rebind parent fixture missing.");
  const parentSnapshot = {
    ...clone(rebindParent.payload), tokenHash: hash(rebindParent.encoded),
  };
  const newDevice = {
    installationId: rebindRequest.payload.installationId, deviceKeyId: rebindRequest.payload.deviceKeyId,
    devicePublicKey: rebindRequest.payload.devicePublicKey, assurance: rebindRequest.payload.bindingKind,
  };
  const oldKey = input.trustConfiguration.trustedKeys.find((item) => equal(item.kid, rebindRequest.payload.oldDeviceKeyId));
  assert(oldKey, "Rebind old key fixture missing.");
  const oldDevice = {
    installationId: rebindRequest.payload.installationId, deviceKeyId: oldKey.kid,
    devicePublicKey: oldKey.spkiDer, assurance: rebindParent.payload.assurance,
  };
  const outstanding = (item) => ({
    tokenType: item.payload.tokenType, requestPurpose: item.payload.requestPurpose,
    requestId: item.payload.requestId, requestHash: hash(item.encoded), requestNonce: item.payload.requestNonce,
    encodedRequest: item.encoded, payload: item.payload, challengeConsumed: false,
  });
  const rebindContext = {
    device: newDevice, parent: parentSnapshot, request: outstanding(rebindRequest),
    trustedNow: rebindRecovery.payload.issuedAt,
  };
  const directRebind = (context) => ({ expectedType: "activation-request", encoded: rebindRequest.encoded, context });
  const recoveryRebind = (context) => ({ expectedType: "recovery", encoded: rebindRecovery.encoded, context });
  add("LIC-CRYPTO-REBIND-LOCAL-NEW-KEY", directRebind({ device: newDevice, parent: parentSnapshot }), undefined, "verifySignedObject");
  add("LIC-CRYPTO-REBIND-OLD-IS-NOT-LOCAL-NEW", directRebind({ device: oldDevice, parent: parentSnapshot }), "DEVICE_KEY_ID_MISMATCH", "verifySignedObject");
  add("LIC-CRYPTO-REBIND-BOUND-RECOVERY", recoveryRebind(rebindContext), undefined, "verifySignedObject");
  add("LIC-CRYPTO-REBIND-RECOVERY-OLD-LOCAL-KEY", recoveryRebind({ ...rebindContext, device: oldDevice }), "REQUEST_SNAPSHOT_INVALID", "verifySignedObject");
  add("LIC-CRYPTO-REBIND-NEW-ASSURANCE", recoveryRebind({ ...rebindContext,
    device: { ...newDevice, assurance: newDevice.assurance === "SOFTWARE_BOUND" ? "TPM_ATTESTED" : "SOFTWARE_BOUND" },
  }), "REQUEST_SNAPSHOT_INVALID", "verifySignedObject");
  const wrongPrevious = { ...oldDevice, deviceKeyId: newDevice.deviceKeyId };
  add("LIC-CRYPTO-REBIND-PREVIOUS-BINDING", recoveryRebind({ ...rebindContext, previousDevice: wrongPrevious }), "REQUEST_SNAPSHOT_INVALID", "verifySignedObject");

  // A -> B -> C: the unchanged parent still names A, while sealed active binding is B.
  const thirdKey = TEST_ONLY_KEYS.TEST_ONLY_UNKNOWN_SIGNER;
  const chainPayload = clone(rebindRequest.payload);
  chainPayload.requestId[0] ^= 1;
  chainPayload.requestNonce[0] ^= 1;
  chainPayload.deviceKeyId = thirdKey.kid;
  chainPayload.keyId = thirdKey.kid;
  chainPayload.devicePublicKey = thirdKey.spkiDer;
  chainPayload.bindingKind = "SOFTWARE_BOUND";
  chainPayload.oldDeviceKeyId = newDevice.deviceKeyId;
  chainPayload.stateGeneration += 1n;
  const chainRequest = { payload: chainPayload, encoded: Buffer.from(issueTestOnlyCose("activation-request", chainPayload, thirdKey).coseBytes) };
  const chainRecoveryPayload = clone(rebindRecovery.payload);
  chainRecoveryPayload.tokenId[0] ^= 1;
  chainRecoveryPayload.oldDeviceKeyId = newDevice.deviceKeyId;
  chainRecoveryPayload.newDeviceKeyId = thirdKey.kid;
  chainRecoveryPayload.newAssurance = "SOFTWARE_BOUND";
  chainRecoveryPayload.requestId = chainPayload.requestId;
  chainRecoveryPayload.requestHash = hash(chainRequest.encoded);
  chainRecoveryPayload.expectedStateGeneration = chainPayload.stateGeneration;
  chainRecoveryPayload.newStateGeneration = chainPayload.stateGeneration + 1n;
  const chainRecoveryBytes = Buffer.from(issueTestOnlyCose("recovery", chainRecoveryPayload,
    TEST_ONLY_KEYS[rebindRecovery.vector.signerKeyId]).coseBytes);
  const chainContext = {
    ...rebindContext, request: outstanding(chainRequest),
    device: { ...newDevice, deviceKeyId: thirdKey.kid, devicePublicKey: thirdKey.spkiDer, assurance: "SOFTWARE_BOUND" },
    previousDevice: { ...newDevice, bindingRecoveryTokenId: rebindRecovery.payload.tokenId },
  };
  add("LIC-CRYPTO-REBIND-CHAIN-A-B-C", { expectedType: "recovery", encoded: chainRecoveryBytes, context: chainContext }, undefined, "verifySignedObject");
  add("LIC-CRYPTO-REBIND-CHAIN-STALE-A", { expectedType: "recovery", encoded: chainRecoveryBytes,
    context: { ...chainContext, previousDevice: oldDevice },
  }, "REQUEST_SNAPSHOT_INVALID", "verifySignedObject");

  assert.equal(cases.length, 66, "Carrier/context regression coverage drifted.");
  const failures = [];
  let passed = 0;
  for (const item of cases) {
    try {
      const request = clone(item.request);
      const before = snapshot(request);
      const trustBefore = snapshot(input.trustConfiguration);
      const result = verifier[item.method](request);
      assert.equal(snapshot(request), before, `${item.id} changed caller input`);
      assert.equal(snapshot(input.trustConfiguration), trustBefore, `${item.id} changed trust`);
      assert.equal(result.authoritativeStateChanged, false);
      assert.equal(result.requestConsumed, false);
      if (item.expected) {
        assert.equal(result.ok, false, `${item.id} unexpectedly accepted`);
        assert.equal(result.errorCode, item.expected, `${item.id} returned ${result.stage}/${result.errorCode}`);
      } else {
        assert.equal(result.ok, true, `${item.id} returned ${result.stage}/${result.errorCode}`);
        if (item.method === "verifySignedObject") {
          assert.equal(result.value.authorization, "PREFLIGHT_ONLY");
          assert(Object.isFrozen(result) && Object.isFrozen(result.value) && Object.isFrozen(result.value.payload));
          const original = snapshot(result);
          result.value.encoded.fill(0);
          result.digests.inputSha256.fill(0);
          assert.equal(snapshot(result), original, `${item.id} exposes mutable signed result bytes`);
          passed += 1;
          continue;
        }
        assert.equal(result.value.authority, "NONE_TRANSPORT_ONLY");
        assert.equal(result.value.embeddedVerification, item.method === "parseCarrier" || request.carrierType === "lease-challenge"
          ? "NOT_PERFORMED" : "SIGNATURE_TRUST_PREFLIGHT");
        assert(Object.isFrozen(result) && Object.isFrozen(result.value) && Object.isFrozen(result.value.carrier));
        const original = snapshot(result);
        result.value.encoded.fill(0);
        result.digests.inputSha256.fill(0);
        if (result.value.carrier.lease) result.value.carrier.lease.fill(0);
        if (result.value.carrier.delegations) result.value.carrier.delegations[0].fill(0);
        assert.equal(snapshot(result), original, `${item.id} exposes mutable result bytes`);
      }
      passed += 1;
    } catch (error) {
      failures.push(`${item.id}: ${error.message}`);
    }
  }
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return Object.freeze({ attempted: cases.length, passed, failures: Object.freeze(failures) });
}
