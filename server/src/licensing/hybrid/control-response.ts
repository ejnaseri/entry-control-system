import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { parseCoseSign1V1 } from "../core/v1/cose-sign1";
import { sha256 } from "../core/v1/crypto";
import { isLicenseCoreError } from "../core/v1/errors";
import { signedObjectContract, VENDOR_ENDPOINTS } from "../core/v1/protocol";
import { assertLicenseUtcV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";
import { createOfflineControlCompletionV1, type OfflineEntitlementCommitAdapterV1,
  type OfflineEntitlementCompletionResultV1 } from "../offline/entitlement-completion";

/** Already bounded/authenticated HTTPS content; no URL or public HTTP handler.
 * Transport origin/status/media/redirect/0-RTT checks remain adapter obligations. */
export interface HybridControlResponseInputV1 {
  readonly encoded: Uint8Array;
  readonly requestId: Uint8Array;
}
class ControlResponseError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new ControlResponseError(code); };
function bounded(value: unknown, cap: number): Uint8Array {
  if (!(value instanceof Uint8Array) || !value.length || value.length > cap) return deny("CONTROL_RESPONSE_BYTES_INVALID");
  return new Uint8Array(value);
}
type Failure = Extract<OfflineEntitlementCompletionResultV1, { ok: false }>;
const rejected = (r: Readonly<{ stage: string; errorCode: string }>): Failure =>
  Object.freeze({ ok: false, stage: r.stage, errorCode: r.errorCode, commitAttempted: false, durable: false, runtimeAuthority: "NONE" });

/** Control-only dispatch, NOT successful check-in, Lease receipt or renewal.
 * The unsigned carrier cannot bind a Control command to the Lease request.
 * REQUEST_BOUND Control resolves its own independently signed CONTROL request.
 * Only that control command is committed; transport-request consumption/delivery
 * and mixed-carrier transactions remain later coordinator obligations. */
export function createHybridControlResponseWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: OfflineEntitlementCommitAdapterV1;
}>) {
  const { machine, requests } = configuration;
  const verifier = createLicenseVerifierV1(configuration.verification);
  const completion = createOfflineControlCompletionV1(configuration);
  return Object.freeze({
    async apply(state: LicenseModelStateV1, input: HybridControlResponseInputV1, trustedNow: bigint):
      Promise<OfflineEntitlementCompletionResultV1> {
      try {
        assertLicenseUtcV1(trustedNow); machine.project(state, state.clockHighWater);
        if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(k => !["encoded", "requestId"].includes(k))) return deny("CONTROL_RESPONSE_INPUT_INVALID");
        const encoded = bounded(input.encoded, VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes);
        const id = bounded(input.requestId, 16);
        if (id.length !== 16) return deny("CONTROL_RESPONSE_REQUEST_ID_INVALID");
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded });
        if (!parsed.ok) return rejected(parsed);
        const carrier = parsed.value.carrier;
        if (!bytesEqual(carrier.requestId, id)) return deny("CONTROL_RESPONSE_REQUEST_ID_MISMATCH");
        if (!("offlineControl" in carrier) || "lease" in carrier || "trustBundle" in carrier || "reactivationAuthorization" in carrier)
          return deny("CONTROL_RESPONSE_VARIANT_NOT_IMPLEMENTED");
        const control = new Uint8Array(carrier.offlineControl);
        let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
        try { stored = await requests.read(new Uint8Array(id)); }
        catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
        if (!stored) return deny("OUTSTANDING_REQUEST_NOT_FOUND");
        const verified = verifier.verifySignedObject({ expectedType: "lease-request",
          encoded: bounded(stored.encoded, signedObjectContract("lease-request").maxEncodedBytes),
          context: { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: state.device } });
        if (!verified.ok) return rejected(verified);
        const p = verified.value.payload;
        if (!bytesEqual(p.requestId, id)) return deny("STORED_REQUEST_ID_MISMATCH");
        if (p.requestPurpose !== "CHECK_IN") return deny("CONTROL_RESPONSE_CHECK_IN_REQUIRED");
        const pair = [state.current, state.pending].find(v => v && bytesEqual(v.entitlement.payload.tokenId, p.entitlementTokenId));
        if (!pair || pair.entitlement.payload.mode !== "HYBRID_LEASED" || pair.entitlement.payload.generation !== p.entitlementGeneration ||
          !bytesEqual(pair.entitlement.payload.licenseId, p.licenseId) || !bytesEqual(pair.entitlement.payload.activationId, p.activationId))
          return deny("CONTROL_RESPONSE_PARENT_MISMATCH");
        // Old transport context can only dispatch an already authenticated exact
        // control receipt for read-only acknowledgement, never a fresh command.
        const hash = sha256(configuration.verification.crypto, control);
        const duplicate = state.receipts.some(r => r.type === "offline-control" && bytesEqual(r.hash, hash));
        if (!duplicate && (p.stateGeneration !== state.stateGeneration || p.lastLeaseRevision !== state.leaseRevision ||
          p.controlRevision !== state.control.revision || p.controlState !== state.control.state ||
          p.controlEffectiveAt !== state.control.effectiveAt || p.controlReasonCode !== state.control.reasonCode ||
          state.consumedRequests.some(r => bytesEqual(r.id, id) || bytesEqual(r.hash, verified.digests.inputSha256))))
          return deny("CONTROL_RESPONSE_REQUEST_NOT_OUTSTANDING");
        // Untrusted parsing selects only the separate request lookup. The closed
        // Offline planner then verifies the signed command/request and all model
        // rules, including exact historical retries after envelope expiry.
        const contract = signedObjectContract("offline-control");
        const cp = parseCoseSign1V1(control, contract.mediaType, contract.maxEncodedBytes).payload;
        if (cp.kind !== "map") return deny("CONTROL_RESPONSE_PAYLOAD_INVALID");
        const origin = cp.entries.find(e => e.key.kind === "text" && e.key.text === "origin")?.value;
        const controlId = cp.entries.find(e => e.key.kind === "text" && e.key.text === "requestId")?.value;
        const bound = origin?.kind === "text" && origin.text === "REQUEST_BOUND";
        if (bound && (controlId?.kind !== "bytes" || controlId.bytes.length !== 16)) return deny("CONTROL_RESPONSE_CONTROL_ID_INVALID");
        return await completion.apply(state, immutableDataView({ kind: "CONTROL", artifact: control,
          ...(bound && controlId?.kind === "bytes" ? { requestId: controlId.bytes } : {}) }), trustedNow);
      } catch (error) {
        return rejected({ stage: isLicenseCoreError(error) ? error.stage : "WORKFLOW",
          errorCode: error instanceof ControlResponseError ? error.code : isLicenseCoreError(error) ? error.code : "CONTROL_RESPONSE_FAILED" });
      }
    },
  });
}
