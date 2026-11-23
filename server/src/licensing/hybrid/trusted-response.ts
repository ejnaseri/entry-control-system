import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { isLicenseCoreError } from "../core/v1/errors";
import { signedObjectContract, VENDOR_ENDPOINTS } from "../core/v1/protocol";
import { encodeDeterministicCborV1 } from "../core/v1/strict-cbor";
import { assertLicenseClockObservationV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";
import { createHybridTrustResponseWorkflowV1, hashLicenseTrustSnapshotV1, type HybridTrustPlanV1 } from "./trust-response";
import { createHybridCombinedResponseWorkflowV1, createHybridLeaseResponseWorkflowV1,
  type HybridLeaseResponseInputV1, type HybridLeaseResponsePlanV1 } from "./lease-response";

export interface HybridTrustedResponsePlanV1 {
  readonly trust: HybridTrustPlanV1;
  readonly license: HybridLeaseResponsePlanV1;
  readonly encodedResponse: Uint8Array;
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}
/** One transaction, never sequential calls to the trust-only/License adapters.
 * Compare both trust and License CAS baselines; persist signed trust artifacts,
 * complete state/receipts, journal and anchors together. Reconcile restrictive
 * effects and retire the previous verifier/model before reporting effectiveness.
 * Pending/unknown outcomes require protected read-back, not blind replay. */
export interface HybridTrustedResponseStoreV1 {
  commit(plan: HybridTrustedResponsePlanV1): Promise<Readonly<{ decision: "CONFLICT" | "PENDING" }> |
    Readonly<{ decision: "ACKNOWLEDGED"; trustHash: Uint8Array; stateGeneration: bigint; stateHash: Uint8Array }>>;
}
const failed = (errorCode: string, commitAttempted = false, stage = "WORKFLOW") =>
  Object.freeze({ ok: false as const, errorCode, stage, commitAttempted, durable: false as const, runtimeAuthority: "NONE" as const });

/** Ordinary CHECK_IN Lease + trust, optionally with independently signed Control.
 * The staged model is published only with a complete adapter acknowledgement.
 * This is a portable handoff; it cannot switch any real runtime or prove durability. */
export function createHybridTrustedResponseWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: HybridTrustedResponseStoreV1;
}>) {
  const { machine, requests, store } = configuration;
  const { crypto, ...trustConfiguration } = configuration.verification;
  const verification = { ...immutableDataView(trustConfiguration), crypto };
  const verifier = createLicenseVerifierV1(verification);
  const noSeparateCommit = { commit: async (): Promise<never> => { throw new Error("SEPARATE_COMMIT_FORBIDDEN"); } };
  const plans = new WeakMap<HybridTrustedResponsePlanV1, LicenseStateMachineV1>();
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: HybridLeaseResponseInputV1, trustedNow: bigint) {
      try {
        if (!input || typeof input !== "object" || Object.keys(input).some(k => !["encoded", "requestId", "observation"].includes(k)) ||
          !(input.encoded instanceof Uint8Array) || !input.encoded.length || input.encoded.length > VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes ||
          !(input.requestId instanceof Uint8Array) || input.requestId.length !== 16) return failed("TRUSTED_RESPONSE_INPUT_INVALID");
        if (input.observation !== undefined) assertLicenseClockObservationV1(input.observation);
        const safe = immutableDataView(input);
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded: safe.encoded });
        if (!parsed.ok) return failed(parsed.errorCode, false, parsed.stage);
        const c = parsed.value.carrier;
        if (!("lease" in c) || !c.trustBundle || c.reactivationAuthorization) return failed("TRUSTED_RESPONSE_VARIANT_NOT_IMPLEMENTED");
        const records = new Map<string, Awaited<ReturnType<OfflineRequestReaderV1["read"]>>>();
        const reader: OfflineRequestReaderV1 = { read: async id => {
          const key = Array.from(id).join(",");
          if (records.has(key)) return records.get(key);
          const record = await requests.read(new Uint8Array(id));
          if (record && (!(record.encoded instanceof Uint8Array) || !record.encoded.length ||
            record.encoded.length > signedObjectContract("activation-request").maxEncodedBytes)) throw new Error("REQUEST_BYTES_INVALID");
          const copy = record ? immutableDataView({ encoded: record.encoded, ...(record.timeEvidence ? { timeEvidence: record.timeEvidence } : {}) }) : undefined;
          records.set(key, copy); return copy;
        } };
        const trustWorkflow = createHybridTrustResponseWorkflowV1({ machine, verification, requests: reader, store: noSeparateCommit });
        const update = await trustWorkflow.prepare(state, { encoded: safe.encoded, requestId: safe.requestId }, trustedNow);
        if (!update.ok) return update;
        const staged = machine.stageTrust(state, update.plan.encodedBundle, trustedNow);
        if (!bytesEqual(hashLicenseTrustSnapshotV1(crypto, staged.trust), update.plan.proposedTrustHash)) return failed("TRUST_MODEL_CONFIGURATION_MISMATCH");
        const nextVerification = { ...staged.trust, crypto };
        const nextVerifier = createLicenseVerifierV1(nextVerification);
        let reference = state.clock ? state.clockHighWater : trustedNow;
        // Recheck even historical receipts: an old acknowledgement cannot bypass
        // a newly denied signer. Full request/parent/control semantics follow below.
        for (const [expectedType, encoded] of [["lease", c.lease], ["offline-control", c.offlineControl]] as const) {
          if (!encoded) continue;
          const checked = nextVerifier.verifySignedObject({ expectedType, encoded: new Uint8Array(encoded), context: { trustedNow: reference } });
          if (!checked.ok) return failed(checked.errorCode, false, checked.stage);
          if ("serverTime" in checked.value.payload) reference = checked.value.payload.serverTime;
        }
        const encoded = encodeDeterministicCborV1(new Map<string, bigint | string | Uint8Array>([
          ["schemaVersion", 1n], ["carrierType", "lease-response"], ["requestId", new Uint8Array(c.requestId)],
          ["lease", new Uint8Array(c.lease)], ...(c.offlineControl ? [["offlineControl", new Uint8Array(c.offlineControl)] as [string, Uint8Array]] : []),
        ]));
        const factory = c.offlineControl ? createHybridCombinedResponseWorkflowV1 : createHybridLeaseResponseWorkflowV1;
        const response = factory({ machine: staged.machine, verification: nextVerification, requests: reader, store: noSeparateCommit });
        const license = await response.prepare(state, { encoded, requestId: safe.requestId,
          ...(safe.observation ? { observation: safe.observation } : {}) }, trustedNow);
        if (!license.ok) return license;
        staged.machine.project(license.plan.proposal.state, license.plan.proposal.state.clockHighWater);
        // Preserve the factory-owned state; immutableDataView would destroy its provenance.
        const plan: HybridTrustedResponsePlanV1 = Object.freeze({ trust: update.plan, license: license.plan,
          get encodedResponse() { return new Uint8Array(safe.encoded); }, durable: false, runtimeAuthority: "NONE" });
        plans.set(plan, staged.machine);
        return Object.freeze({ ok: true as const, plan });
      } catch (e) { return failed(isLicenseCoreError(e) ? e.code : "TRUSTED_RESPONSE_PREPARATION_FAILED", false, isLicenseCoreError(e) ? e.stage : "WORKFLOW"); }
    },
    async complete(plan: HybridTrustedResponsePlanV1) {
      const staged = plans.get(plan);
      if (!staged) return failed("UNTRUSTED_RESPONSE_PLAN");
      try {
        const receipt = await store.commit(plan);
        const { decision, ...ack } = receipt ?? {};
        if (decision === "CONFLICT") return failed("TRUSTED_RESPONSE_CONFLICT", true);
        if (decision === "PENDING") return failed("TRUSTED_RESPONSE_PENDING", true);
        const state = plan.license.proposal.state;
        if (decision !== "ACKNOWLEDGED" || !("trustHash" in ack) || !(ack.trustHash instanceof Uint8Array) ||
          !bytesEqual(ack.trustHash, plan.trust.proposedTrustHash) || ack.stateGeneration !== state.stateGeneration ||
          !(ack.stateHash instanceof Uint8Array) || !bytesEqual(ack.stateHash, state.stateHash)) return failed("TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID", true);
        return Object.freeze({ ok: true as const, decision: "TRUSTED_RESPONSE_ADAPTER_ACKNOWLEDGED" as const,
          machine: staged, state, trust: plan.trust.trust, durable: false as const, runtimeAuthority: "NONE" as const });
      } catch { return failed("TRUSTED_RESPONSE_OUTCOME_UNKNOWN", true); }
    },
  });
}
