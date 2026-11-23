import { bytesEqual, immutableDataView, unsignedBigIntToFixedBytes, unsignedBytesToBigInt } from "../core/v1/bytes";
import { P256_HALF_ORDER_V1, P256_ORDER_V1 } from "../core/v1/cose-sign1";
import { isLicenseCoreError } from "../core/v1/errors";
import { PRODUCT_ID, VENDOR_ENDPOINTS, signedObjectContract } from "../core/v1/protocol";
import { encodeDeterministicCborV1 as encode, type DeterministicCborValueV1 } from "../core/v1/strict-cbor";
import { assertLicenseClockObservationV1, type LicenseClockObservationV1, type LicenseTimeRequestEvidenceV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OutstandingRequestSnapshot, ParentEntitlementSnapshot } from "../core/v1/types";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";

export type HybridRequestInputV1 =
  | Readonly<{ purpose: "CHECK_IN"; target: "CURRENT" | "PENDING" }>
  | Readonly<{ purpose: "CHECK_IN"; target: "REACTIVATION"; authorization: Uint8Array;
      entitlement: Uint8Array; reactivationRequestId: Uint8Array; trustedNow: bigint }>
  | Readonly<{ purpose: "TIME_RECOVERY" }>;

/** Trusted transport must authenticate the configured Vendor HTTPS origin, reject
 * redirects/aliases/wrong status/media, disable 0-RTT and bound reads before return.
 * This portable seam neither opens HTTPS nor proves those physical obligations. */
export interface HybridChallengeProviderV1 {
  acquire(input: Readonly<{ method: "POST"; path: "/v1/licensing/lease-challenges";
    responseMediaType: string; maxResponseBytes: number; zeroRttAllowed: false }>): Promise<Uint8Array>;
}
export interface HybridInstallationSignerV1 {
  randomBytes(length: 16): Uint8Array;
  signInstallation(input: Readonly<{ deviceKeyId: Uint8Array; sigStructure: Uint8Array }>): Promise<Uint8Array>;
}
export interface HybridRequestPlanV1 {
  readonly encoded: Uint8Array;
  readonly requestId: Uint8Array;
  readonly requestNonce: Uint8Array;
  readonly requestHash: Uint8Array;
  readonly purpose: "CHECK_IN" | "TIME_RECOVERY";
  readonly parentTokenId: Uint8Array;
  readonly parentGeneration: bigint;
  readonly expectedStateGeneration: bigint;
  readonly expectedStateHash: Uint8Array;
  readonly timeEvidence?: LicenseTimeRequestEvidenceV1;
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}
/** Complete protected ledger/CAS/journal obligations, not a concrete Store.
 * Reserve ID AND nonce; flush exact bytes/evidence before acknowledgement.
 * EXACT_RETRY is byte/evidence-identical, never just a matching request ID. */
export interface HybridRequestRegistrationV1 {
  register(plan: HybridRequestPlanV1): Promise<Readonly<{
    decision: "REGISTERED" | "EXACT_RETRY"; requestId: Uint8Array; requestHash: Uint8Array;
  }> | undefined>;
}
type Failure = Readonly<{ ok: false; stage: string; errorCode: string; durable: false; runtimeAuthority: "NONE" }>;
class RequestError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new RequestError(code); };
function failure(error: unknown): Failure {
  return Object.freeze({ ok: false, stage: isLicenseCoreError(error) ? error.stage : "WORKFLOW",
    errorCode: error instanceof RequestError ? error.code : isLicenseCoreError(error) ? error.code : "HYBRID_REQUEST_PREPARATION_FAILED",
    durable: false, runtimeAuthority: "NONE" });
}
function bytes(value: unknown, length: number): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== length) return deny("REQUEST_ADAPTER_BYTES_INVALID");
  return new Uint8Array(value);
}

export function createHybridRequestWorkflowV1(configuration: Readonly<{
  requests?: OfflineRequestReaderV1;
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  installation: HybridInstallationSignerV1; challenge: HybridChallengeProviderV1;
  registration: HybridRequestRegistrationV1;
  time?: Readonly<{ observe(): LicenseClockObservationV1 }>;
}>) {
  const { machine, installation, challenge, registration, time } = configuration;
  const verifier = createLicenseVerifierV1(configuration.verification);
  const plans = new WeakSet<object>();
  const contract = signedObjectContract("lease-request");
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: HybridRequestInputV1): Promise<Readonly<{ ok: true; plan: HybridRequestPlanV1 }> | Failure> {
      try {
        machine.project(state, state.clockHighWater); // Factory provenance before adapter calls.
        if (!input || typeof input !== "object" || Array.isArray(input)) return deny("REQUEST_INPUT_INVALID");
        const { purpose } = input;
        if (purpose !== "CHECK_IN" && purpose !== "TIME_RECOVERY") return deny("REQUEST_PURPOSE_UNSUPPORTED");
        const reactivating = purpose === "CHECK_IN" && input.target === "REACTIVATION";
        const allowed = reactivating ? ["purpose", "target", "authorization", "entitlement", "reactivationRequestId", "trustedNow"] : purpose === "CHECK_IN" ? ["purpose", "target"] : ["purpose"];
        if (Object.keys(input).some(k => !allowed.includes(k))) return deny("REQUEST_INPUT_FIELD_FORBIDDEN");
        const target = purpose === "CHECK_IN" ? (input as Extract<HybridRequestInputV1, { purpose: "CHECK_IN" }>).target : "CURRENT";
        if (target !== "CURRENT" && target !== "PENDING" && target !== "REACTIVATION") return deny("REQUEST_TARGET_INVALID");
        let parent: Pick<ParentEntitlementSnapshot, "mode" | "tokenId" | "generation" | "licenseId" | "activationId"> | undefined =
          (target === "CURRENT" ? state.current : state.pending)?.entitlement.payload;
        if (input.purpose === "CHECK_IN" && input.target === "REACTIVATION") {
          const boundedArtifact = (v: Uint8Array) => {
            if (!(v instanceof Uint8Array) || !v.length || v.length > 16384) return deny("REACTIVATION_TARGET_BYTES_INVALID");
            return new Uint8Array(v);
          };
          const authorization = boundedArtifact(input.authorization), entitlement = boundedArtifact(input.entitlement);
          const id = bytes(input.reactivationRequestId, 16), at = input.trustedNow;
          let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
          try { stored = await configuration.requests?.read(id); } catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
          if (!stored) return deny("REACTIVATION_REQUEST_NOT_FOUND");
          if (!(stored.encoded instanceof Uint8Array) || !stored.encoded.length || stored.encoded.length > signedObjectContract("activation-request").maxEncodedBytes) return deny("STORED_REQUEST_BYTES_INVALID");
          const checked = verifier.verifySignedObject({ expectedType: "activation-request", encoded: new Uint8Array(stored.encoded), context: { workflow: "ECSREQ_FILE" } });
          if (!checked.ok) return failureFromVerification(checked);
          const p = checked.value.payload;
          if (p.requestPurpose !== "REACTIVATE" || !bytesEqual(p.requestId, id)) return deny("REACTIVATION_REQUEST_MISMATCH");
          const request = immutableDataView({ tokenType: "activation-request", requestPurpose: p.requestPurpose, payload: p,
            requestId: p.requestId, requestNonce: p.requestNonce, requestHash: checked.digests.inputSha256,
            encodedRequest: checked.value.encoded, challengeConsumed: false }) as OutstandingRequestSnapshot;
          parent = machine.reactivationTarget(state, { authorization, entitlement, request }, at);
        }
        if (!parent) return deny("HYBRID_PARENT_REQUIRED");
        if (parent.mode !== "HYBRID_LEASED") return deny("HYBRID_MODE_REQUIRED");
        // Reactivation's verified new Entitlement binds directly to the current
        // installation key; the core retires any previous binding override.
        const { bindingRecoveryTokenId: _retired, ...directDevice } = state.device;
        const d: typeof state.device = immutableDataView({ ...(reactivating ? directDevice : state.device), devicePublicKey: bytes(state.device.devicePublicKey, 91) });
        const b = state.build, control = reactivating ? { revision: 0n, state: "OPERATIONAL", effectiveAt: 0n, reasonCode: 0n } : state.control;
        let observation: LicenseClockObservationV1 | undefined;
        if (purpose === "TIME_RECOVERY") {
          if (!state.timeIncident) return deny("TIME_INCIDENT_REQUIRED");
          try {
            const current = time?.observe();
            if (!current) return deny("TIME_EVIDENCE_UNAVAILABLE");
            assertLicenseClockObservationV1(current);
            observation = immutableDataView(current);
          } catch { return deny("TIME_EVIDENCE_UNAVAILABLE"); }
          if (!bytesEqual(observation.bootId, state.timeIncident.bootId) || observation.monotonicMs < state.timeIncident.monotonicMs)
            return deny("TIME_EVIDENCE_REQUIRES_FRESH_INCIDENT");
        }
        let received: Uint8Array;
        try { received = await challenge.acquire(Object.freeze({ method: "POST", path: "/v1/licensing/lease-challenges",
          responseMediaType: VENDOR_ENDPOINTS.leaseChallenge.responseMediaType,
          maxResponseBytes: VENDOR_ENDPOINTS.leaseChallenge.maxResponseBytes, zeroRttAllowed: false })); }
        catch { return deny("CHALLENGE_UNAVAILABLE"); }
        if (!(received instanceof Uint8Array) || received.length < 1 || received.length > VENDOR_ENDPOINTS.leaseChallenge.maxResponseBytes)
          return deny("CHALLENGE_BYTES_INVALID");
        const parsed = verifier.parseCarrier({ carrierType: "lease-challenge", encoded: new Uint8Array(received) });
        if (!parsed.ok) return failureFromVerification(parsed);
        const nonce = bytes(parsed.value.carrier.requestNonce, 32);
        const id = bytes(installation.randomBytes(16), 16);
        if (state.consumedRequests.some(r => bytesEqual(r.id, id))) return deny("REQUEST_ID_ALREADY_CONSUMED");
        const fields: Record<string, DeterministicCborValueV1> = {
          protocolVersion: 1n, tokenType: "lease-request", requestPurpose: purpose,
          requestId: id, requestNonce: nonce, keyId: d.deviceKeyId,
          httpMethod: "POST", httpPath: VENDOR_ENDPOINTS.leaseIssuance.path,
          productId: PRODUCT_ID, edition: b.edition, licenseId: parent.licenseId, activationId: parent.activationId,
          installationId: d.installationId, deviceKeyId: d.deviceKeyId,
          entitlementTokenId: parent.tokenId, entitlementGeneration: parent.generation,
          lastLeaseRevision: reactivating ? 0n : state.leaseRevision, stateGeneration: state.stateGeneration,
          controlRevision: control.revision, controlState: control.state,
          controlEffectiveAt: control.effectiveAt, controlReasonCode: control.reasonCode,
          versionIdentitySha256: b.versionIdentitySha256, buildIdentitySha256: b.buildIdentitySha256,
          buildManifestSha256: b.buildManifestSha256,
          ...(d.bindingRecoveryTokenId ? { bindingRecoveryTokenId: d.bindingRecoveryTokenId } : {}),
          ...(purpose === "TIME_RECOVERY" && state.timeIncident ? { incidentId: state.timeIncident.id,
            incidentNonce: state.timeIncident.nonce, preIncidentClockHighWater: state.timeIncident.preIncidentClockHighWater } : {}),
        };
        const payload = encode(new Map(Object.entries(fields)));
        const headers = encode(new Map<DeterministicCborValueV1, DeterministicCborValueV1>([
          [1n, -7n], [3n, contract.mediaType], [4n, d.deviceKeyId],
        ]));
        const structure = encode(["Signature1", headers, new Uint8Array(), payload]);
        let signature: Uint8Array;
        try { signature = bytes(await installation.signInstallation({ deviceKeyId: bytes(d.deviceKeyId, 32), sigStructure: new Uint8Array(structure) }), 64); }
        catch { return deny("INSTALLATION_SIGNING_FAILED"); }
        const r = unsignedBytesToBigInt(signature.subarray(0, 32)), s = unsignedBytesToBigInt(signature.subarray(32));
        if (r === 0n || r >= P256_ORDER_V1 || s === 0n || s >= P256_ORDER_V1) return deny("INSTALLATION_SIGNATURE_INVALID");
        if (s > P256_HALF_ORDER_V1) signature.set(unsignedBigIntToFixedBytes(P256_ORDER_V1 - s, 32), 32);
        const encoded = encode({ kind: "tag", tag: 18n, value: [headers, new Map(), payload, signature] });
        const checked = verifier.verifySignedObject({ expectedType: "lease-request", encoded,
          context: { workflow: "VENDOR_HTTPS_REQUEST", build: b, device: d } });
        if (!checked.ok) return failureFromVerification(checked);
        const plan: HybridRequestPlanV1 = immutableDataView({ encoded, requestId: id, requestNonce: nonce,
          requestHash: checked.digests.inputSha256, purpose, parentTokenId: parent.tokenId, parentGeneration: parent.generation,
          expectedStateGeneration: state.stateGeneration, expectedStateHash: state.stateHash,
          ...(observation ? { timeEvidence: { bootId: observation.bootId, sentMonotonicMs: observation.monotonicMs,
            requestHash: checked.digests.inputSha256 } } : {}), durable: false, runtimeAuthority: "NONE" });
        plans.add(plan);
        return Object.freeze({ ok: true, plan });
      } catch (error) { return failure(error); }
    },
    async release(plan: HybridRequestPlanV1): Promise<Readonly<{ ok: true; method: "POST"; path: "/v1/licensing/leases";
      mediaType: string; bytes: Uint8Array; decision: "REGISTERED" | "EXACT_RETRY"; durable: false; runtimeAuthority: "NONE" }> | Failure> {
      try {
        if (!plans.has(plan)) return deny("UNTRUSTED_REQUEST_PLAN");
        let receipt: Awaited<ReturnType<HybridRequestRegistrationV1["register"]>>;
        try { receipt = await registration.register(plan); }
        catch { return deny("REQUEST_REGISTRATION_OUTCOME_UNKNOWN"); }
        if (!receipt) return deny("REQUEST_REGISTRATION_CONFLICT");
        const { decision, requestId, requestHash } = receipt;
        if (!["REGISTERED", "EXACT_RETRY"].includes(decision) ||
          !bytesEqual(bytes(requestId, 16), plan.requestId) || !bytesEqual(bytes(requestHash, 32), plan.requestHash))
          return deny("REQUEST_REGISTRATION_RECEIPT_INVALID");
        return immutableDataView({ ok: true, method: "POST", path: "/v1/licensing/leases", mediaType: contract.mediaType,
          bytes: plan.encoded, decision, durable: false, runtimeAuthority: "NONE" });
      } catch (error) { return failure(error); }
    },
  });
}
function failureFromVerification(result: Readonly<{ stage: string; errorCode: string }>): Failure {
  return Object.freeze({ ok: false, stage: result.stage, errorCode: result.errorCode, durable: false, runtimeAuthority: "NONE" });
}
