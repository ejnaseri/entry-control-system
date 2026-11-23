// TEST_ONLY_DO_NOT_TRUST
// Fresh deterministic signed inputs for LIC-6.2-004 model tests. Import this
// helper only after the production-module graph isolation check. No issuer or
// publicly derivable test key from licensing/vectors may enter production.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inspectCose, issueTestOnlyCose } from "../../licensing/vectors/v1/lib/cose.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";

const vectorRoot = new URL("../../licensing/vectors/v1/", import.meta.url);
const DEFAULT_NOW = 1_800_001_000n;
const DEFAULT_SIGNERS = Object.freeze({
  "activation-request": "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY",
  "lease-request": "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY",
  "key-delegation": "TEST_ONLY_PROD_ROOT_PRIMARY",
  "key-denylist": "TEST_ONLY_PROD_ROOT_PRIMARY",
  entitlement: "TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY",
  lease: "TEST_ONLY_ONLINE_LEASE_PRIMARY",
  "offline-control": "TEST_ONLY_OFFLINE_CONTROL_PRIMARY",
  "reactivation-authorization": "TEST_ONLY_OFFLINE_CONTROL_PRIMARY",
  recovery: "TEST_ONLY_RECOVERY_PRIMARY",
  "time-correction": "TEST_ONLY_RECOVERY_PRIMARY",
});

export const cloneLicenseFixture = (value) => structuredClone(value);
export const hashLicenseFixture = (encoded) => new Uint8Array(createHash("sha256").update(encoded).digest());
export const licenseFixtureBytes = (label, length = 16) => {
  assert(Number.isInteger(length) && length > 0 && length <= 32, "Fixture byte length must be 1..32.");
  return hashLicenseFixture(Buffer.from(`TEST_ONLY_LIC004:${label}`, "utf8")).slice(0, length);
};
const equal = (left, right) => Buffer.from(left).equals(Buffer.from(right));
const digestHex = (value) => Buffer.from(hashLicenseFixture(value)).toString("hex");

function accepted(result, label) {
  assert(result?.ok, `${label}: ${result?.stage}/${result?.errorCode}`);
  assert.equal(result.stage, "COMPLETE", label);
  assert.equal(result.value.authorization, "PREFLIGHT_ONLY", label);
  assert.equal(result.authoritativeStateChanged, false, label);
  assert.equal(result.requestConsumed, false, label);
  return result;
}

/**
 * Supply already-loaded production exports: { core, nodeCryptoV1 }. The helper
 * never compiles or loads a state-machine implementation, and never substitutes
 * a permissive crypto/verifier double. Its trust snapshots come from actual
 * Root-signed golden Delegations verified by that production core.
 */
export function createLicenseStateFixtures(production, { edition = "ATTENDANCE" } = {}) {
  assert(["FULL", "ATTENDANCE"].includes(edition), "Fixture Edition must be explicit.");
  const { core, nodeCryptoV1 } = production;
  assert.equal(typeof core.createLicenseVerifierV1, "function");
  assert.equal(typeof core.validateDelegationUpdateV1, "function");
  assert.equal(typeof nodeCryptoV1.verifyEs256P1363, "function");
  const index = JSON.parse(readFileSync(new URL("vectors-index.json", vectorRoot), "utf8"));
  const vectors = new Map(index.positive.map((item) => [item.id, item]));
  const fixtureBytes = (id) => {
    const vector = vectors.get(id);
    assert(vector?.kind === "SIGNED_OBJECT", `${id}: signed fixture missing.`);
    assert(/^fixtures\/positive\/[a-z0-9-]+\.cbor$/u.test(vector.path), `${id}: unsafe fixture path.`);
    const encoded = new Uint8Array(readFileSync(new URL(vector.path, vectorRoot)));
    assert.equal(digestHex(encoded), vector.sha256, `${id}: golden bytes changed.`);
    return { vector, encoded };
  };
  const registration = (id) => {
    const key = TEST_ONLY_KEYS[id];
    assert(key, `${id}: unknown test key.`);
    return {
      kid: new Uint8Array(key.kid), spkiDer: new Uint8Array(key.spkiDer),
      purpose: key.purpose, environment: key.environment,
    };
  };
  const roots = [registration("TEST_ONLY_PROD_ROOT_PRIMARY")];
  const trustedKeys = [
    registration("TEST_ONLY_INSTALLATION_DEVICE_PRIMARY"),
    registration("TEST_ONLY_INSTALLATION_DEVICE_REBIND"),
  ];
  const bootstrap = core.createLicenseVerifierV1({ crypto: nodeCryptoV1, environment: "TEST", roots });
  const verifiedDelegations = index.positive.filter((item) => item.tokenType === "key-delegation").map((item) => {
    const { encoded } = fixtureBytes(item.id);
    const before = digestHex(encoded);
    const result = accepted(bootstrap.verifySignedObject({ expectedType: "key-delegation", encoded }), item.id);
    assert.equal(digestHex(encoded), before, `${item.id}: bootstrap mutated input.`);
    assert(equal(result.digests.inputSha256, hashLicenseFixture(encoded)), `${item.id}: incorrect digest.`);
    return result;
  }).sort((left, right) => Number(left.value.payload.delegationSerial - right.value.payload.delegationSerial));
  assert.equal(verifiedDelegations.length, 4, "Four purpose-separated Delegations are required.");
  const delegations = [];
  for (const [position, result] of verifiedDelegations.entries()) {
    assert.equal(result.value.payload.delegationSerial, BigInt(position + 1), "Bootstrap serial order changed.");
    delegations.push(core.validateDelegationUpdateV1({
      crypto: nodeCryptoV1, payload: result.value.payload, tokenHash: result.digests.inputSha256,
      rootKid: result.signerKeyId, current: [...delegations],
    }));
  }
  const verification = { crypto: nodeCryptoV1, environment: "TEST", roots, trustedKeys, delegations };
  const verifier = core.createLicenseVerifierV1(verification);
  const payload = (id) => {
    const { vector, encoded } = fixtureBytes(id);
    const result = accepted(verifier.verifySignedObject({ expectedType: vector.tokenType, encoded }), id);
    return cloneLicenseFixture(result.value.payload);
  };
  const activationTemplate = payload(edition === "FULL" ? "pos-activation-activate-full" : "pos-activation-activate-tpm");
  const build = {
    productVersion: "1.0.0", edition,
    versionIdentitySha256: new Uint8Array(activationTemplate.versionIdentitySha256),
    buildIdentitySha256: new Uint8Array(activationTemplate.buildIdentitySha256),
    buildManifestSha256: new Uint8Array(activationTemplate.buildManifestSha256),
  };
  const deviceForKey = (keyId = "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY", {
    installationId = activationTemplate.installationId, assurance = "SOFTWARE_BOUND", bindingRecoveryTokenId,
  } = {}) => {
    const key = TEST_ONLY_KEYS[keyId];
    assert(key, `Unknown fixture device key ${keyId}.`);
    return {
      installationId: new Uint8Array(installationId), deviceKeyId: new Uint8Array(key.kid),
      devicePublicKey: new Uint8Array(key.spkiDer), assurance,
      ...(bindingRecoveryTokenId ? { bindingRecoveryTokenId: new Uint8Array(bindingRecoveryTokenId) } : {}),
    };
  };
  const device = deviceForKey();

  // This intentionally does not pre-validate the supplied payload: model tests
  // must be able to sign malformed/counterexample inputs and prove rejection.
  // Explicit signer selection also supports wrong-purpose and wrong-key tests.
  const sign = (type, value, signerId) => {
    let selected = signerId;
    if (!selected && ["activation-request", "lease-request"].includes(type)) {
      selected = Object.values(TEST_ONLY_KEYS).find((key) =>
        value.keyId instanceof Uint8Array && equal(key.kid, value.keyId))?.id;
    }
    selected ??= DEFAULT_SIGNERS[type];
    const key = TEST_ONLY_KEYS[selected];
    assert(key, `No fixture signer for ${type}/${selected}.`);
    return new Uint8Array(issueTestOnlyCose(type, cloneLicenseFixture(value), key).coseBytes);
  };
  const requestSnapshot = (encoded, {
    challengeConsumed = false, challengeExpiresAt, sameBootElapsedSeconds, context,
  } = {}) => {
    const type = inspectCose(encoded).payload.tokenType;
    assert(["activation-request", "lease-request"].includes(type), "Snapshot requires an actual signed request.");
    const result = accepted(verifier.verifySignedObject({ expectedType: type, encoded: new Uint8Array(encoded),
      ...(context ? { context } : {}) }), "request snapshot");
    const value = cloneLicenseFixture(result.value.payload);
    return {
      tokenType: type, requestPurpose: value.requestPurpose, payload: value,
      requestId: new Uint8Array(value.requestId), requestHash: hashLicenseFixture(encoded),
      requestNonce: new Uint8Array(value.requestNonce), encodedRequest: new Uint8Array(encoded), challengeConsumed,
      ...(challengeExpiresAt !== undefined ? { challengeExpiresAt } : {}),
      ...(sameBootElapsedSeconds !== undefined ? { sameBootElapsedSeconds } : {}),
    };
  };
  const initialActivation = ({
    mode = "OFFLINE_BOUND", now = DEFAULT_NOW, label = `initial-${edition}-${mode}`,
    termStartsAt = now, termSeconds = 2_678_400n, warningLeadSeconds = 604_800n, graceSeconds = 259_200n,
    features, notBefore = now, notAfter,
  } = {}) => {
    assert(["OFFLINE_BOUND", "HYBRID_LEASED"].includes(mode), "Unknown fixture License mode.");
    assert.equal(typeof now, "bigint", "Fixture trusted time must be BigInt.");
    const requestPayload = cloneLicenseFixture(activationTemplate);
    delete requestPayload.tpmEvidence;
    Object.assign(requestPayload, {
      requestId: licenseFixtureBytes(`${label}:request`), requestNonce: licenseFixtureBytes(`${label}:nonce`, 32),
      edition, issuedAt: now, notAfter: now + 86_400n, bindingKind: device.assurance,
      deviceKeyId: new Uint8Array(device.deviceKeyId), keyId: new Uint8Array(device.deviceKeyId),
      devicePublicKey: new Uint8Array(device.devicePublicKey), installationId: new Uint8Array(device.installationId),
      stateGeneration: 0n, entitlementGeneration: 0n, leaseRevision: 0n, timeCorrectionRevision: 0n,
      controlRevision: 0n, controlState: "OPERATIONAL",
    });
    const encodedRequest = sign("activation-request", requestPayload);
    const request = requestSnapshot(encodedRequest);
    const entitlementPayload = payload(edition === "FULL" ? "pos-entitlement-initial-full"
      : mode === "HYBRID_LEASED" ? "pos-entitlement-initial-hybrid" : "pos-entitlement-initial-offline");
    Object.assign(entitlementPayload, {
      tokenId: licenseFixtureBytes(`${label}:entitlement`), licenseId: licenseFixtureBytes(`${label}:license`),
      activationId: licenseFixtureBytes(`${label}:activation`), generation: 1n, mode, edition,
      installationId: new Uint8Array(device.installationId), deviceKeyId: new Uint8Array(device.deviceKeyId),
      assurance: device.assurance, requestId: new Uint8Array(request.requestId), requestHash: new Uint8Array(request.requestHash),
      issuedAt: now, notBefore, termStartsAt, termEndsAt: termStartsAt + termSeconds,
      warningLeadSeconds, warningStartsAt: termStartsAt + termSeconds - warningLeadSeconds,
      graceSeconds, graceUntil: termStartsAt + termSeconds + graceSeconds,
      notAfter: notAfter ?? termStartsAt + termSeconds + graceSeconds + 86_400n,
      ...(features ? { features: [...features] } : {}),
    });
    delete entitlementPayload.previousTokenId;
    delete entitlementPayload.reactivationAuthorizationId;
    if (mode === "HYBRID_LEASED") {
      entitlementPayload.checkCadenceSeconds = 21_600n;
      entitlementPayload.offlineAllowanceSeconds = 604_800n;
      entitlementPayload.timeRecoveryRttSeconds = 300n;
    } else {
      for (const field of ["checkCadenceSeconds", "offlineAllowanceSeconds", "timeRecoveryRttSeconds"]) delete entitlementPayload[field];
    }
    const encoded = sign("entitlement", entitlementPayload);
    // A fixture cannot silently start from an invalid preflight relationship.
    // Negative tests may clone/mutate/sign these returned payloads afterwards.
    accepted(verifier.verifySignedObject({ expectedType: "entitlement", encoded,
      context: { trustedNow: now, build, device, request } }), `${label} activation`);
    return {
      now, requestPayload, entitlementPayload, encodedRequest, encoded, request,
      command: { kind: "IMPORT_ENTITLEMENT", encoded: new Uint8Array(encoded), request: cloneLicenseFixture(request) },
    };
  };
  return Object.freeze({
    verification, build, device, configuration: { verification, build, device }, verifier,
    payload, sign, requestSnapshot, initialActivation, deviceForKey,
    clone: cloneLicenseFixture, hash: hashLicenseFixture, bytes: licenseFixtureBytes,
    vectorIndexPath: fileURLToPath(new URL("vectors-index.json", vectorRoot)), now: DEFAULT_NOW,
  });
}
