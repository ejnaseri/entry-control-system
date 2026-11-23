import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { isLicenseCoreError } from "../core/v1/errors";
import { signedObjectContract, VENDOR_ENDPOINTS } from "../core/v1/protocol";
import { encodeDeterministicCborV1 } from "../core/v1/strict-cbor";
import { assertLicenseUtcV1 } from "../core/v1/time";
import { assertTrustSnapshotIntegrity } from "../core/v1/trust";
import type { OutstandingRequestSnapshot, TrustSnapshot } from "../core/v1/types";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";
import { createHybridReactivationResponseWorkflowV1, type HybridReactivationResponseInputV1 } from "./reactivation-response";
import { hashLicenseTrustSnapshotV1, type HybridTrustPlanV1 } from "./trust-response";
import type { HybridLeaseResponsePlanV1 } from "./lease-response";
import { prepareLicenseTrustUpdateV1 } from "../core/v1/trust-update";

export interface HybridTrustedReactivationPlanV1 {
  readonly trust: HybridTrustPlanV1;
  readonly license: HybridLeaseResponsePlanV1;
  readonly encodedResponse: Uint8Array;
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}
export interface HybridTrustedReactivationStoreV1 {
  commit(plan: HybridTrustedReactivationPlanV1): Promise<Readonly<{ decision: "CONFLICT" | "PENDING" }> |
    Readonly<{ decision: "ACKNOWLEDGED"; trustHash: Uint8Array; stateGeneration: bigint; stateHash: Uint8Array }>>;
}
const failed = (errorCode: string, commitAttempted = false, stage = "WORKFLOW") =>
  Object.freeze({ ok: false as const, errorCode, stage, commitAttempted, durable: false as const, runtimeAuthority: "NONE" as const });
const bytes = (value: unknown, cap: number, code: string): Uint8Array => {
  if (!(value instanceof Uint8Array) || !value.length || value.length > cap) throw new Error(code);
  return new Uint8Array(value);
};

/** Reactivation plus ordinary CHECK_IN Trust and optional Control. The frozen
 * carrier keeps Entitlement separate. Trust is staged first; all authorization,
 * entitlement, Lease and Control checks are then repeated with that staged trust,
 * and the adapter receives one combined CAS plan. */
export function createHybridTrustedReactivationResponseWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: HybridTrustedReactivationStoreV1;
}>) {
  const { machine, requests, store } = configuration;
  const { crypto, ...trustConfiguration } = configuration.verification;
  const verification = { ...immutableDataView(trustConfiguration), crypto };
  const verifier = createLicenseVerifierV1(verification);
  const base: TrustSnapshot = immutableDataView({ environment: verification.environment, roots: verification.roots ?? [],
    trustedKeys: verification.trustedKeys ?? [], delegations: verification.delegations ?? [],
    ...(verification.denylist ? { denylist: verification.denylist } : {}) });
  assertTrustSnapshotIntegrity(crypto, base, base.environment);
  const expectedTrustHash = hashLicenseTrustSnapshotV1(crypto, base);
  const noSeparateCommit = { commit: async (): Promise<never> => { throw new Error("SEPARATE_COMMIT_FORBIDDEN"); } };
  const plans = new WeakMap<HybridTrustedReactivationPlanV1, LicenseStateMachineV1>();
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: HybridReactivationResponseInputV1, trustedNow: bigint) {
      try {
        machine.assertOwnsState(state); assertLicenseUtcV1(trustedNow);
        if (state.timeIncident) return failed("TIME_RECOVERY_REACTIVATION_TARGET_FORBIDDEN");
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["encoded", "entitlement", "requestId"].includes(k))) return failed("TRUSTED_REACTIVATION_INPUT_INVALID");
        const encoded = bytes(input.encoded, VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes, "TRUSTED_REACTIVATION_BYTES_INVALID");
        const entitlement = bytes(input.entitlement, signedObjectContract("entitlement").maxEncodedBytes, "TRUSTED_REACTIVATION_BYTES_INVALID");
        const id = bytes(input.requestId, 16, "TRUSTED_REACTIVATION_REQUEST_ID_INVALID"); if (id.length !== 16) return failed("TRUSTED_REACTIVATION_REQUEST_ID_INVALID");
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded });
        if (!parsed.ok) return failed(parsed.errorCode, false, parsed.stage);
        const carrier = parsed.value.carrier;
        if (!("lease" in carrier) || !carrier.reactivationAuthorization || !carrier.trustBundle || !bytesEqual(carrier.requestId, id)) return failed("TRUSTED_REACTIVATION_VARIANT_NOT_IMPLEMENTED");
        const records = new Map<string, Awaited<ReturnType<OfflineRequestReaderV1["read"]>>>();
        const reader: OfflineRequestReaderV1 = { read: async requestId => {
          const key = Array.from(requestId).join(","); if (records.has(key)) return records.get(key);
          const record = await requests.read(new Uint8Array(requestId));
          if (record && (!(record.encoded instanceof Uint8Array) || !record.encoded.length || record.encoded.length > signedObjectContract("activation-request").maxEncodedBytes)) throw new Error("REQUEST_BYTES_INVALID");
          const copy = record ? immutableDataView({ encoded: new Uint8Array(record.encoded), ...(record.timeEvidence ? { timeEvidence: record.timeEvidence } : {}) }) : undefined;
          records.set(key, copy); return copy;
        } };
        // Validate the new target against the current revoked lineage before using
        // it only to correlate the staged Trust-side CHECK_IN request.
        const auth = verifier.verifySignedObject({ expectedType: "reactivation-authorization", encoded: new Uint8Array(carrier.reactivationAuthorization), context: { trustedNow } });
        if (!auth.ok) return failed(auth.errorCode, false, auth.stage);
        const activationId = auth.value.payload.requestId;
        const activation = await reader.read(activationId); if (!activation) return failed("OUTSTANDING_REQUEST_NOT_FOUND");
        const checkedActivation = verifier.verifySignedObject({ expectedType: "activation-request", encoded: bytes(activation.encoded, signedObjectContract("activation-request").maxEncodedBytes, "REQUEST_BYTES_INVALID"), context: { workflow: "ECSREQ_FILE" } });
        if (!checkedActivation.ok) return failed(checkedActivation.errorCode, false, checkedActivation.stage);
        const target = machine.reactivationTarget(state, { authorization: new Uint8Array(carrier.reactivationAuthorization), entitlement,
          request: immutableDataView({ tokenType: "activation-request", requestPurpose: checkedActivation.value.payload.requestPurpose, payload: checkedActivation.value.payload, requestId: checkedActivation.value.payload.requestId, requestNonce: checkedActivation.value.payload.requestNonce, requestHash: checkedActivation.digests.inputSha256, encodedRequest: checkedActivation.value.encoded, challengeConsumed: false }) as OutstandingRequestSnapshot }, trustedNow);
        const leaseRecord = await reader.read(id); if (!leaseRecord) return failed("OUTSTANDING_REQUEST_NOT_FOUND");
        const checkedLease = verifier.verifySignedObject({ expectedType: "lease-request", encoded: bytes(leaseRecord.encoded, signedObjectContract("lease-request").maxEncodedBytes, "REQUEST_BYTES_INVALID"), context: { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: state.device } });
        if (!checkedLease.ok) return failed(checkedLease.errorCode, false, checkedLease.stage);
        const request = checkedLease.value.payload;
        if (request.requestPurpose !== "CHECK_IN" || !bytesEqual(request.requestId, id) || !bytesEqual(request.entitlementTokenId, target.tokenId) || request.entitlementGeneration !== target.generation || !bytesEqual(request.licenseId, target.licenseId) || !bytesEqual(request.activationId, target.activationId)) return failed("TRUSTED_REACTIVATION_REQUEST_MISMATCH");
        const reference = state.clock ? state.clockHighWater : trustedNow;
        const trust = prepareLicenseTrustUpdateV1({ ...base, crypto }, new Uint8Array(carrier.trustBundle), reference);
        const proposedTrustHash = hashLicenseTrustSnapshotV1(crypto, trust);
        const trustPlan: HybridTrustPlanV1 = immutableDataView({ trust, expectedTrustHash, proposedTrustHash,
          expectedStateGeneration: state.stateGeneration, expectedStateHash: state.stateHash, encodedBundle: new Uint8Array(carrier.trustBundle),
          decision: bytesEqual(expectedTrustHash, proposedTrustHash) ? "EXACT_RETRY" : "UPDATE", durable: false, runtimeAuthority: "NONE" });
        const staged = machine.stageTrust(state, trustPlan.encodedBundle, trustedNow);
        const stripped = encodeDeterministicCborV1(new Map<string, bigint | string | Uint8Array>([["schemaVersion", 1n], ["carrierType", "lease-response"], ["requestId", id], ["lease", new Uint8Array(carrier.lease)], ["reactivationAuthorization", new Uint8Array(carrier.reactivationAuthorization)], ...(carrier.offlineControl ? [["offlineControl", new Uint8Array(carrier.offlineControl)] as [string, Uint8Array]] : [])]));
        const response = createHybridReactivationResponseWorkflowV1({ machine: staged.machine, verification: { ...staged.trust, crypto }, requests: reader, store: noSeparateCommit });
        const license = await response.prepare(state, { encoded: stripped, entitlement, requestId: id }, trustedNow);
        if (!license.ok) return license;
        staged.machine.project(license.plan.proposal.state, license.plan.proposal.state.clockHighWater);
        const plan: HybridTrustedReactivationPlanV1 = Object.freeze({ trust: trustPlan, license: license.plan, get encodedResponse() { return new Uint8Array(encoded); }, durable: false, runtimeAuthority: "NONE" });
        plans.set(plan, staged.machine); return Object.freeze({ ok: true as const, plan });
      } catch (e) { return failed(isLicenseCoreError(e) ? e.code : e instanceof Error ? e.message : "TRUSTED_REACTIVATION_PREPARATION_FAILED", false, isLicenseCoreError(e) ? e.stage : "WORKFLOW"); }
    },
    async complete(plan: HybridTrustedReactivationPlanV1) {
      const staged = plans.get(plan); if (!staged) return failed("UNTRUSTED_TRUSTED_REACTIVATION_PLAN");
      try {
        const receipt = await store.commit(plan), { decision, ...ack } = receipt ?? {};
        if (decision === "CONFLICT") return failed("TRUSTED_REACTIVATION_CONFLICT", true);
        if (decision === "PENDING") return failed("TRUSTED_REACTIVATION_PENDING", true);
        const state = plan.license.proposal.state;
        if (decision !== "ACKNOWLEDGED" || !("trustHash" in ack) || !(ack.trustHash instanceof Uint8Array) || !bytesEqual(ack.trustHash, plan.trust.proposedTrustHash) || !("stateGeneration" in ack) || ack.stateGeneration !== state.stateGeneration || !("stateHash" in ack) || !(ack.stateHash instanceof Uint8Array) || !bytesEqual(ack.stateHash, state.stateHash)) return failed("TRUSTED_REACTIVATION_ACKNOWLEDGEMENT_INVALID", true);
        return Object.freeze({ ok: true as const, decision: "TRUSTED_REACTIVATION_ADAPTER_ACKNOWLEDGED" as const, machine: staged, state, trust: plan.trust.trust, durable: false as const, runtimeAuthority: "NONE" as const });
      } catch { return failed("TRUSTED_REACTIVATION_OUTCOME_UNKNOWN", true); }
    },
  });
}
