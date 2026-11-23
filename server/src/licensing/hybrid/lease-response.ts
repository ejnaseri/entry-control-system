import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { parseCoseSign1V1 } from "../core/v1/cose-sign1";
import { isLicenseCoreError } from "../core/v1/errors";
import { signedObjectContract, VENDOR_ENDPOINTS } from "../core/v1/protocol";
import { assertLicenseClockObservationV1, assertLicenseUtcV1 } from "../core/v1/time";
import type { LicenseClockObservationV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1, LicenseStateTransitionV1 } from "../core/v1/state-types";
import type { OutstandingRequestSnapshot } from "../core/v1/types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";
import type { OfflineEntitlementCommitAdapterV1 } from "../offline/entitlement-completion";

/** Trusted HTTPS intake supplies bounded content after checking configured Vendor
 * origin, status, exact media type and redirect/0-RTT policy. No network is opened.
 * observation is trusted local receipt evidence, never a field from the response. */
export interface HybridLeaseResponseInputV1 {
  readonly encoded: Uint8Array;
  readonly requestId: Uint8Array;
  readonly observation?: LicenseClockObservationV1;
}
type Proposal = Extract<LicenseStateTransitionV1, { ok: true }>;
export interface HybridLeaseResponsePlanV1 {
  readonly proposal: Proposal;
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}
type Failure = Readonly<{ ok: false; stage: string; errorCode: string; commitAttempted: boolean;
  durable: false; runtimeAuthority: "NONE" }>;
class ResponseError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new ResponseError(code); };
function bounded(value: unknown, cap: number): Uint8Array {
  if (!(value instanceof Uint8Array) || !value.length || value.length > cap) return deny("RESPONSE_ADAPTER_BYTES_INVALID");
  return new Uint8Array(value);
}
function failure(error: unknown, commitAttempted = false): Failure {
  return Object.freeze({ ok: false, stage: isLicenseCoreError(error) ? error.stage : "WORKFLOW",
    errorCode: error instanceof ResponseError ? error.code : isLicenseCoreError(error) ? error.code : "HYBRID_RESPONSE_FAILED",
    commitAttempted, durable: false, runtimeAuthority: "NONE" });
}
const rejected = (r: Readonly<{ stage: string; errorCode: string }>): Failure =>
  Object.freeze({ ok: false, stage: r.stage, errorCode: r.errorCode, commitAttempted: false, durable: false, runtimeAuthority: "NONE" });

/** Primary Lease only. Unsupported sidecars are rejected together, never ignored
 * or partially committed. Reader retains exact protected historical requests;
 * store has the same complete-state CAS/journal/anchor obligations as Offline.
 * Acknowledgement is adapter evidence only, not physical durability or admission. */
type Configuration = Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: OfflineEntitlementCommitAdapterV1;
}>;
function createResponseWorkflow(configuration: Configuration, combined: boolean) {
  const { machine, requests, store } = configuration;
  const verifier = createLicenseVerifierV1(configuration.verification);
  const plans = new WeakSet<object>();
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: HybridLeaseResponseInputV1, trustedNow: bigint):
      Promise<Readonly<{ ok: true; plan: HybridLeaseResponsePlanV1 }> | Failure> {
      try {
        assertLicenseUtcV1(trustedNow);
        machine.assertOwnsState(state);
        if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(k => !["encoded", "requestId", "observation"].includes(k))) return deny("RESPONSE_INPUT_INVALID");
        const encoded = bounded(input.encoded, VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes);
        const id = bounded(input.requestId, 16);
        if (id.length !== 16) return deny("RESPONSE_REQUEST_ID_INVALID");
        let observation: LicenseClockObservationV1 | undefined;
        if (input.observation !== undefined) {
          assertLicenseClockObservationV1(input.observation);
          observation = immutableDataView({ wallUtc: input.observation.wallUtc, bootId: input.observation.bootId,
            monotonicMs: input.observation.monotonicMs });
        }
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded });
        if (!parsed.ok) return rejected(parsed);
        const carrier = parsed.value.carrier;
        if (!bytesEqual(carrier.requestId, id)) return deny("RESPONSE_REQUEST_ID_MISMATCH");
        if (!("lease" in carrier) || ("offlineControl" in carrier) !== combined || "reactivationAuthorization" in carrier || "trustBundle" in carrier)
          return deny("RESPONSE_VARIANT_NOT_IMPLEMENTED");
        const lease = new Uint8Array(carrier.lease);
        const control = "offlineControl" in carrier ? new Uint8Array(carrier.offlineControl!) : undefined;
        let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
        try { stored = await requests.read(new Uint8Array(id)); }
        catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
        if (!stored) return deny("OUTSTANDING_REQUEST_NOT_FOUND");
        const requestBytes = bounded(stored.encoded, signedObjectContract("lease-request").maxEncodedBytes);
        const verified = verifier.verifySignedObject({ expectedType: "lease-request", encoded: requestBytes,
          context: { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: state.device } });
        if (!verified.ok) return rejected(verified);
        const p = verified.value.payload;
        if (!bytesEqual(p.requestId, id)) return deny("STORED_REQUEST_ID_MISMATCH");
        const request = immutableDataView({ tokenType: "lease-request", requestPurpose: p.requestPurpose, payload: p,
          requestId: p.requestId, requestNonce: p.requestNonce, requestHash: verified.digests.inputSha256,
          encodedRequest: verified.value.encoded, challengeConsumed: false }) as OutstandingRequestSnapshot;
        // Correlate before the model's authenticated historical-receipt shortcut.
        // Parsing alone is not trust: model verification follows for every new Lease.
        const contract = signedObjectContract("lease");
        const payload = parseCoseSign1V1(lease, contract.mediaType, contract.maxEncodedBytes).payload;
        if (payload.kind !== "map") return deny("RESPONSE_REQUEST_BINDING_MISMATCH");
        for (const [name, expected] of [["leaseRequestId", id], ["leaseRequestHash", request.requestHash]] as const) {
          const value = payload.entries.find(e => e.key.kind === "text" && e.key.text === name)?.value;
          if (value?.kind !== "bytes" || !bytesEqual(value.bytes, expected)) return deny("RESPONSE_REQUEST_BINDING_MISMATCH");
        }
        if (p.requestPurpose === "TIME_RECOVERY" && !observation) return deny("RECEIPT_OBSERVATION_REQUIRED");
        const evidence = stored.timeEvidence ? immutableDataView(stored.timeEvidence) : undefined;
        let controlRequest: OutstandingRequestSnapshot | undefined;
        if (control) {
          const contract = signedObjectContract("offline-control");
          const payload = parseCoseSign1V1(control, contract.mediaType, contract.maxEncodedBytes).payload;
          if (payload.kind !== "map") return deny("CONTROL_PAYLOAD_INVALID");
          const field = (name: string) => payload.entries.find(e => e.key.kind === "text" && e.key.text === name)?.value;
          const origin = field("origin"), controlId = field("requestId"), controlHash = field("requestHash");
          if (origin?.kind === "text" && origin.text === "REQUEST_BOUND") {
            if (controlId?.kind !== "bytes" || controlId.bytes.length !== 16 || controlHash?.kind !== "bytes" || controlHash.bytes.length !== 32)
              return deny("CONTROL_REQUEST_BINDING_INVALID");
            let record: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
            try { record = await requests.read(new Uint8Array(controlId.bytes)); }
            catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
            if (!record) return deny("CONTROL_REQUEST_NOT_FOUND");
            const checked = verifier.verifySignedObject({ expectedType: "activation-request",
              encoded: bounded(record.encoded, signedObjectContract("activation-request").maxEncodedBytes), context: { workflow: "ECSREQ_FILE" } });
            if (!checked.ok) return rejected(checked);
            const cp = checked.value.payload;
            if (cp.requestPurpose !== "CONTROL" || !bytesEqual(cp.requestId, controlId.bytes) || !bytesEqual(checked.digests.inputSha256, controlHash.bytes))
              return deny("CONTROL_REQUEST_BINDING_MISMATCH");
            controlRequest = immutableDataView({ tokenType: "activation-request", requestPurpose: cp.requestPurpose, payload: cp,
              requestId: cp.requestId, requestNonce: cp.requestNonce, requestHash: checked.digests.inputSha256,
              encodedRequest: checked.value.encoded, challengeConsumed: false }) as OutstandingRequestSnapshot;
          }
        }
        const leaseCommand = p.requestPurpose === "CHECK_IN"
          ? { kind: "IMPORT_LEASE" as const, encoded: lease, request, parentTokenId: p.entitlementTokenId, ...(observation ? { observation } : {}) }
          : { kind: "RECOVER_ONLINE_TIME" as const, encoded: lease, request, observation: observation!, ...(evidence ? { evidence } : {}) };
        const proposal = machine.transition(state, control ? { kind: "IMPORT_LEASE_CONTROL", lease: leaseCommand, control,
          ...(controlRequest ? { controlRequest } : {}) } : leaseCommand, trustedNow);
        if (!proposal.ok) return rejected(proposal);
        // Keep the factory-owned state object intact; cloning it loses provenance.
        const plan: HybridLeaseResponsePlanV1 = Object.freeze({ proposal, durable: false, runtimeAuthority: "NONE" });
        plans.add(plan);
        return Object.freeze({ ok: true, plan });
      } catch (error) { return failure(error); }
    },
    async complete(plan: HybridLeaseResponsePlanV1): Promise<Readonly<{ ok: true;
      decision: "ADAPTER_ACKNOWLEDGED" | "ADAPTER_CONFIRMED_DUPLICATE"; stateGeneration: bigint;
      stateHash: Uint8Array; durable: false; runtimeAuthority: "NONE" }> | Failure> {
      if (!plans.has(plan)) return failure(new ResponseError("UNTRUSTED_RESPONSE_PLAN"));
      let attempted = false;
      try {
        attempted = true;
        let receipt: Awaited<ReturnType<OfflineEntitlementCommitAdapterV1["commit"]>>;
        try { receipt = await store.commit(plan.proposal); }
        catch { return failure(new ResponseError("COMMIT_OUTCOME_UNKNOWN"), true); }
        const { decision, ...ack } = receipt ?? {};
        if (decision === "CONFLICT") return deny("COMMIT_STATE_CONFLICT");
        if (decision === "PENDING") return deny("COMMIT_PENDING");
        const target = plan.proposal.state;
        if (decision !== "ACKNOWLEDGED" || !("stateGeneration" in ack) || !("stateHash" in ack) ||
          ack.stateGeneration !== target.stateGeneration || !(ack.stateHash instanceof Uint8Array) ||
          !bytesEqual(ack.stateHash, target.stateHash)) return deny("COMMIT_ACKNOWLEDGEMENT_INVALID");
        return immutableDataView({ ok: true,
          decision: plan.proposal.decision === "IDEMPOTENT" ? "ADAPTER_CONFIRMED_DUPLICATE" : "ADAPTER_ACKNOWLEDGED",
          stateGeneration: target.stateGeneration, stateHash: target.stateHash, durable: false, runtimeAuthority: "NONE" });
      } catch (error) { return failure(error, attempted); }
    },
  });
}

export function createHybridLeaseResponseWorkflowV1(configuration: Configuration) {
  return createResponseWorkflow(configuration, false);
}

/** Exactly Lease + Offline Control. Both share one proposed state/generation and
 * one complete-state Store call; no sequential single-artifact commits. */
export function createHybridCombinedResponseWorkflowV1(configuration: Configuration) {
  return createResponseWorkflow(configuration, true);
}
