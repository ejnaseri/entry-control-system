import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { parseCoseSign1V1 } from "../core/v1/cose-sign1";
import { isLicenseCoreError } from "../core/v1/errors";
import { VENDOR_ENDPOINTS, signedObjectContract } from "../core/v1/protocol";
import { assertLicenseUtcV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import type { OutstandingRequestSnapshot } from "../core/v1/types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";
import type { OfflineEntitlementCommitAdapterV1 } from "../offline/entitlement-completion";
import type { HybridLeaseResponsePlanV1 } from "./lease-response";

export interface HybridReactivationResponseInputV1 {
  readonly encoded: Uint8Array;
  /** Separate signed artifact: frozen lease-response has no Entitlement slot. */
  readonly entitlement: Uint8Array;
  readonly requestId: Uint8Array;
}
class ReactivationError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new ReactivationError(code); };
const failure = (errorCode: string, commitAttempted = false, stage = "WORKFLOW") =>
  Object.freeze({ ok: false as const, errorCode, stage, commitAttempted, durable: false as const, runtimeAuthority: "NONE" as const });
function bounded(v: unknown, cap: number): Uint8Array {
  if (!(v instanceof Uint8Array) || !v.length || v.length > cap) return deny("REACTIVATION_BYTES_INVALID");
  return new Uint8Array(v);
}
/** Three signed artifacts, two independently bound archived requests, one core
 * transition and one complete-state CAS. No half activation or replay bypass.
 * Native file/network readers, protected durability and runtime admission remain
 * adapter obligations. Trust and TIME_RECOVERY variants are closed. Optional
 * request-bound Control is reduced with the new Lease before the one CAS. */
export function createHybridReactivationResponseWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: OfflineEntitlementCommitAdapterV1;
}>) {
  const { machine, requests, store } = configuration;
  const verifier = createLicenseVerifierV1(configuration.verification), plans = new WeakSet<HybridLeaseResponsePlanV1>();
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: HybridReactivationResponseInputV1, trustedNow: bigint) {
      try {
        machine.assertOwnsState(state); assertLicenseUtcV1(trustedNow);
        if (state.timeIncident) return deny("TIME_RECOVERY_REACTIVATION_TARGET_FORBIDDEN");
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["encoded", "entitlement", "requestId"].includes(k))) return deny("REACTIVATION_INPUT_INVALID");
        const encoded = bounded(input.encoded, VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes), entitlement = bounded(input.entitlement, signedObjectContract("entitlement").maxEncodedBytes);
        const id = bounded(input.requestId, 16); if (id.length !== 16) return deny("REACTIVATION_REQUEST_ID_INVALID");
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded });
        if (!parsed.ok) return failure(parsed.errorCode, false, parsed.stage);
        const c = parsed.value.carrier;
        if (!("lease" in c) || !c.reactivationAuthorization || c.trustBundle) return deny("REACTIVATION_VARIANT_NOT_IMPLEMENTED");
        if (!bytesEqual(c.requestId, id)) return deny("REACTIVATION_REQUEST_ID_MISMATCH");
        const authorization = new Uint8Array(c.reactivationAuthorization), lease = new Uint8Array(c.lease);
        // Parse only to locate the protected request; the core authenticates the
        // authorization under its own trust and time context before any proposal.
        const contract = signedObjectContract("reactivation-authorization");
        const auth = parseCoseSign1V1(authorization, contract.mediaType, contract.maxEncodedBytes).payload;
        if (auth.kind !== "map") return deny("REACTIVATION_REQUEST_ID_INVALID");
        const activationId = auth.entries.find(e => e.key.kind === "text" && e.key.text === "requestId")?.value;
        if (activationId?.kind !== "bytes" || activationId.bytes.length !== 16) return deny("REACTIVATION_REQUEST_ID_INVALID");
        // REACTIVATE verifies the new Entitlement against the current key and
        // retires the old lineage's override before verifying the new Lease.
        const { bindingRecoveryTokenId: _retired, ...directDevice } = state.device;
        const read = async (requestId: Uint8Array, type: "activation-request" | "lease-request", purpose: "REACTIVATE" | "CHECK_IN" | "CONTROL") => {
          let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
          try { stored = await requests.read(new Uint8Array(requestId)); } catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
          if (!stored) return deny("OUTSTANDING_REQUEST_NOT_FOUND");
          const checked = verifier.verifySignedObject({ expectedType: type, encoded: bounded(stored.encoded, signedObjectContract(type).maxEncodedBytes),
            context: type === "lease-request" ? { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: directDevice } : { workflow: "ECSREQ_FILE" } });
          if (!checked.ok) return deny(checked.errorCode);
          const p = checked.value.payload;
          if (!bytesEqual(p.requestId, requestId) || p.requestPurpose !== purpose) return deny("REACTIVATION_REQUEST_MISMATCH");
          return immutableDataView({ tokenType: type, requestPurpose: p.requestPurpose, payload: p,
            requestId: p.requestId, requestNonce: p.requestNonce, requestHash: checked.digests.inputSha256,
            encodedRequest: checked.value.encoded, challengeConsumed: false }) as OutstandingRequestSnapshot;
        };
        const request = await read(new Uint8Array(activationId.bytes), "activation-request", "REACTIVATE");
        const leaseRequest = await read(id, "lease-request", "CHECK_IN");
        let control: Uint8Array | undefined, controlRequest: OutstandingRequestSnapshot | undefined;
        if (c.offlineControl) {
          control = new Uint8Array(c.offlineControl);
          const payload = parseCoseSign1V1(control, signedObjectContract("offline-control").mediaType,
            signedObjectContract("offline-control").maxEncodedBytes).payload;
          if (payload.kind !== "map") return deny("CONTROL_PAYLOAD_INVALID");
          const field = (name: string) => payload.entries.find(e => e.key.kind === "text" && e.key.text === name)?.value;
          const origin = field("origin"), controlId = field("requestId"), controlHash = field("requestHash");
          if (origin?.kind === "text" && origin.text === "REQUEST_BOUND") {
            if (controlId?.kind !== "bytes" || controlId.bytes.length !== 16 || controlHash?.kind !== "bytes" || controlHash.bytes.length !== 32)
              return deny("CONTROL_REQUEST_BINDING_INVALID");
            controlRequest = await read(new Uint8Array(controlId.bytes), "activation-request", "CONTROL");
            if (!bytesEqual(controlRequest.requestHash, controlHash.bytes)) return deny("CONTROL_REQUEST_BINDING_MISMATCH");
          }
        }
        const proposal = machine.transition(state, { kind: "REACTIVATE", authorization, entitlement, request, lease, leaseRequest,
          ...(control ? { control } : {}), ...(controlRequest ? { controlRequest } : {}) }, trustedNow);
        if (!proposal.ok) return failure(proposal.errorCode, false, proposal.stage);
        const plan: HybridLeaseResponsePlanV1 = Object.freeze({ proposal, durable: false, runtimeAuthority: "NONE" });
        plans.add(plan); return Object.freeze({ ok: true as const, plan });
      } catch (e) { return failure(e instanceof ReactivationError ? e.code : isLicenseCoreError(e) ? e.code : "REACTIVATION_PREPARATION_FAILED", false, isLicenseCoreError(e) ? e.stage : "WORKFLOW"); }
    },
    async complete(plan: HybridLeaseResponsePlanV1) {
      if (!plans.has(plan)) return failure("UNTRUSTED_REACTIVATION_PLAN");
      try {
        const receipt = await store.commit(plan.proposal), { decision, ...ack } = receipt ?? {};
        if (decision === "CONFLICT") return failure("COMMIT_STATE_CONFLICT", true);
        if (decision === "PENDING") return failure("COMMIT_PENDING", true);
        const target = plan.proposal.state;
        if (decision !== "ACKNOWLEDGED" || !("stateGeneration" in ack) || ack.stateGeneration !== target.stateGeneration ||
          !(ack.stateHash instanceof Uint8Array) || !bytesEqual(ack.stateHash, target.stateHash)) return failure("COMMIT_ACKNOWLEDGEMENT_INVALID", true);
        return immutableDataView({ ok: true as const, decision: "ADAPTER_ACKNOWLEDGED", stateGeneration: target.stateGeneration,
          stateHash: target.stateHash, durable: false as const, runtimeAuthority: "NONE" as const });
      } catch { return failure("COMMIT_OUTCOME_UNKNOWN", true); }
    },
  });
}
