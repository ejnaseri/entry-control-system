import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { parseCoseSign1V1 } from "../core/v1/cose-sign1";
import { isLicenseCoreError } from "../core/v1/errors";
import { signedObjectContract } from "../core/v1/protocol";
import { assertLicenseClockObservationV1, assertLicenseUtcV1 } from "../core/v1/time";
import type { LicenseClockObservationV1, LicenseTimeRequestEvidenceV1 } from "../core/v1/time";
import { createLicenseVerifierV1 } from "../core/v1/verifier";
import type { LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { LicenseModelStateV1, LicenseStateCommandV1, LicenseStateMachineV1, LicenseStateTransitionV1 } from "../core/v1/state-types";
import type { OutstandingRequestSnapshot, SignedTokenType } from "../core/v1/types";
import { snapshotRebindDeviceV1, type OfflineRebindDeviceProviderV1 } from "./rebind-device";

/** Trusted future protected-store adapter, never a browser-supplied snapshot.
 * Reading is not consuming. Atomic request consumption belongs to the eventual
 * complete-state commit together with its journal/receipts/CAS obligations. */
export interface OfflineRequestReaderV1 {
  read(requestId: Uint8Array): Promise<Readonly<{
    encoded: Uint8Array;
    timeEvidence?: LicenseTimeRequestEvidenceV1;
  }> | undefined>;
}

/** Bounded file CONTENT, not a path. The eventual filesystem adapter must prove
 * reparse/hardlink/TOCTOU safety before supplying bytes. There is no Node path
 * fallback here, no durable store and no public HTTP/UI contract. */
export type OfflineImportInputV1 =
  | Readonly<{ kind: "ENTITLEMENT"; artifact: Uint8Array; requestId: Uint8Array; observation?: LicenseClockObservationV1 }>
  | Readonly<{ kind: "CONTROL"; artifact: Uint8Array; requestId?: Uint8Array }>
  | Readonly<{ kind: "RECOVERY"; artifact: Uint8Array; requestId: Uint8Array }>
  | Readonly<{ kind: "REBIND"; artifact: Uint8Array; requestId: Uint8Array }>
  | Readonly<{ kind: "TIME_CORRECTION"; artifact: Uint8Array; requestId: Uint8Array; observation: LicenseClockObservationV1 }>
  | Readonly<{ kind: "REACTIVATION"; authorization: Uint8Array; entitlement: Uint8Array; requestId: Uint8Array }>;

type Proposed = Extract<LicenseStateTransitionV1, { ok: true }>;
export type OfflineImportPlanResultV1 =
  | Readonly<{ ok: true; decision: "PROPOSED" | "IDEMPOTENT"; proposal: Proposed; durable: false; runtimeAuthority: "NONE" }>
  | Readonly<{ ok: true; decision: "MODEL_ALREADY_APPLIED"; state: LicenseModelStateV1; durable: false; runtimeAuthority: "NONE" }>
  | Readonly<{ ok: false; stage: string; errorCode: string; durable: false; runtimeAuthority: "NONE" }>;

class IntakeError extends Error {
  constructor(readonly code: string) { super(code); }
}
const deny = (code: string): never => { throw new IntakeError(code); };
function bounded(bytes: unknown, type: SignedTokenType): Uint8Array {
  if (!(bytes instanceof Uint8Array)) return deny("FILE_BYTES_REQUIRED");
  if (!bytes.length || bytes.length > signedObjectContract(type).maxEncodedBytes) return deny("FILE_SIZE_INVALID");
  return new Uint8Array(bytes);
}
function requestId(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 16) return deny("REQUEST_ID_INVALID");
  return new Uint8Array(value);
}

export function createOfflineImportPlannerV1(configuration: Readonly<{
  machine: LicenseStateMachineV1;
  verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1;
  rebind?: OfflineRebindDeviceProviderV1;
}>) {
  const { machine, requests } = configuration;
  const verifier = createLicenseVerifierV1(configuration.verification);
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: OfflineImportInputV1, trustedNow: bigint): Promise<OfflineImportPlanResultV1> {
      try {
        assertLicenseUtcV1(trustedNow);
        // Prove factory provenance even for read-only duplicate receipts.
        machine.project(state, state.clockHighWater);
        const allowed: Record<OfflineImportInputV1["kind"], readonly string[]> = {
          ENTITLEMENT: ["kind", "artifact", "requestId", "observation"],
          CONTROL: ["kind", "artifact", "requestId"], RECOVERY: ["kind", "artifact", "requestId"],
          REBIND: ["kind", "artifact", "requestId"],
          TIME_CORRECTION: ["kind", "artifact", "requestId", "observation"],
          REACTIVATION: ["kind", "authorization", "entitlement", "requestId"],
        };
        if (!input || !Object.hasOwn(allowed, input.kind)) return deny("OFFLINE_INTENT_UNSUPPORTED");
        if (Object.keys(input).some(key => !allowed[input.kind].includes(key))) return deny("OFFLINE_INPUT_FIELD_FORBIDDEN");
        // Freeze bounded candidate bytes before the first await. Names/extensions
        // cannot select or widen a signature domain; the caller's intent does.
        let command: LicenseStateCommandV1;
        const encoded = input.kind === "REACTIVATION" ? undefined : bounded(input.artifact,
          input.kind === "ENTITLEMENT" ? "entitlement" : input.kind === "CONTROL" ? "offline-control" :
            input.kind === "RECOVERY" || input.kind === "REBIND" ? "recovery" : "time-correction");
        const authorization = input.kind === "REACTIVATION" ? bounded(input.authorization, "reactivation-authorization") : undefined;
        const entitlement = input.kind === "REACTIVATION" ? bounded(input.entitlement, "entitlement") : undefined;
        const id = input.requestId === undefined && input.kind === "CONTROL" ? undefined : requestId(input.requestId);
        const kind = input.kind;
        const newDevice = kind === "REBIND" ? snapshotRebindDeviceV1(configuration.rebind, state.device, configuration.verification.crypto) : undefined;
        let observation: LicenseClockObservationV1 | undefined;
        if ("observation" in input && input.observation !== undefined) {
          assertLicenseClockObservationV1(input.observation);
          observation = immutableDataView({ wallUtc: input.observation.wallUtc,
            bootId: input.observation.bootId, monotonicMs: input.observation.monotonicMs });
        }
        if (kind === "TIME_CORRECTION" && !observation) return deny("RECEIPT_OBSERVATION_REQUIRED");
        const timeDuplicate = kind === "TIME_CORRECTION" && encoded && machine.timeCorrectionReceipt(state, encoded) === "ALREADY_APPLIED";
        let request: OutstandingRequestSnapshot | undefined;
        let timeEvidence: LicenseTimeRequestEvidenceV1 | undefined;
        if (id) {
          let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
          try { stored = await requests.read(new Uint8Array(id)); }
          catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
          if (!stored) return deny("OUTSTANDING_REQUEST_NOT_FOUND");
          const verified = verifier.verifySignedObject({ expectedType: "activation-request",
            encoded: bounded(stored.encoded, "activation-request"), context: { workflow: "ECSREQ_FILE" } });
          if (!verified.ok) return Object.freeze({ ok: false, stage: verified.stage, errorCode: verified.errorCode, durable: false, runtimeAuthority: "NONE" });
          const p = verified.value.payload;
          if (!bytesEqual(p.requestId, id)) return deny("STORED_REQUEST_ID_MISMATCH");
          const purposes = kind === "ENTITLEMENT" ? ["ACTIVATE", "RENEW"] : kind === "CONTROL" ? ["CONTROL"] :
            kind === "RECOVERY" ? ["RECOVER"] : kind === "REBIND" ? ["REBIND"] : kind === "TIME_CORRECTION" ? ["TIME_CORRECT"] : ["REACTIVATE"];
          if (!purposes.includes(p.requestPurpose)) return deny("OFFLINE_REQUEST_PURPOSE_MISMATCH");
          request = immutableDataView({ tokenType: "activation-request", requestPurpose: p.requestPurpose,
            payload: p, requestId: p.requestId, requestNonce: p.requestNonce,
            requestHash: verified.digests.inputSha256, encodedRequest: verified.value.encoded,
            challengeConsumed: false }) as OutstandingRequestSnapshot;
          if (kind === "TIME_CORRECTION" && !timeDuplicate && stored.timeEvidence) {
            const e = stored.timeEvidence;
            assertLicenseClockObservationV1({ wallUtc: 0n, bootId: e.bootId, monotonicMs: e.sentMonotonicMs });
            if (!(e.requestHash instanceof Uint8Array) || e.requestHash.length !== 32) return deny("REQUEST_EVIDENCE_INVALID");
            timeEvidence = immutableDataView({ bootId: e.bootId, sentMonotonicMs: e.sentMonotonicMs, requestHash: e.requestHash });
          }
        }
        if ((kind === "ENTITLEMENT" || kind === "CONTROL" || kind === "TIME_CORRECTION") && encoded) {
          // Correlate even exact historical retries: the core's authenticated
          // receipt shortcut deliberately performs no new request consumption.
          // Parsing here grants no trust; core signature/receipt verification
          // still follows. Never acknowledge one request using another's file.
          const contract = signedObjectContract(kind === "ENTITLEMENT" ? "entitlement" : kind === "CONTROL" ? "offline-control" : "time-correction");
          const p = parseCoseSign1V1(encoded, contract.mediaType, contract.maxEncodedBytes).payload;
          if (p.kind !== "map") return deny("OFFLINE_RESPONSE_REQUEST_MISMATCH");
          if (kind === "CONTROL") {
            const origin = p.entries.find(e => e.key.kind === "text" && e.key.text === "origin")?.value;
            if (origin?.kind === "text" && origin.text === "REQUEST_BOUND" && !request) return deny("OUTSTANDING_REQUEST_REQUIRED");
            if (origin?.kind === "text" && origin.text === "VENDOR_INITIATED" && request) return deny("CONTROL_REQUEST_MISMATCH");
          }
          for (const [name, expected] of request ? [["requestId", request.requestId], ["requestHash", request.requestHash]] as const : []) {
            const field = p.entries.find(e => e.key.kind === "text" && e.key.text === name)?.value;
            if (field?.kind !== "bytes" || !bytesEqual(field.bytes, expected)) return deny("OFFLINE_RESPONSE_REQUEST_MISMATCH");
          }
        }
        if (timeDuplicate) return Object.freeze({ ok: true, decision: "MODEL_ALREADY_APPLIED", state, durable: false, runtimeAuthority: "NONE" });
        switch (kind) {
          case "ENTITLEMENT": command = { kind: "IMPORT_ENTITLEMENT", encoded: encoded!, request: request!, ...(observation ? { observation } : {}) }; break;
          case "CONTROL": command = { kind: "IMPORT_CONTROL", encoded: encoded!, ...(request ? { request } : {}) }; break;
          case "RECOVERY": command = { kind: "RECOVER", encoded: encoded!, request: request! }; break;
          case "REBIND": command = { kind: "RECOVER", encoded: encoded!, request: request!, newDevice: newDevice! }; break;
          case "TIME_CORRECTION": command = { kind: "APPLY_TIME_CORRECTION", encoded: encoded!, request: request!, observation: observation!, ...(timeEvidence ? { evidence: timeEvidence } : {}) }; break;
          case "REACTIVATION": command = { kind: "REACTIVATE", authorization: authorization!, entitlement: entitlement!, request: request! }; break;
        }
        const proposal = machine.transition(state, command, trustedNow);
        if (!proposal.ok) return Object.freeze({ ok: false, stage: proposal.stage, errorCode: proposal.errorCode, durable: false, runtimeAuthority: "NONE" });
        return Object.freeze({ ok: true, decision: proposal.decision, proposal, durable: false, runtimeAuthority: "NONE" });
      } catch (error) {
        return Object.freeze({ ok: false,
          stage: isLicenseCoreError(error) ? error.stage : "WORKFLOW",
          errorCode: error instanceof IntakeError ? error.code : isLicenseCoreError(error) ? error.code : "OFFLINE_PREPARATION_FAILED",
          durable: false, runtimeAuthority: "NONE" });
      }
    },
  });
}
