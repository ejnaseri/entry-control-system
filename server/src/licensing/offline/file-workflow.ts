import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { sha256 } from "../core/v1/crypto";
import { signedObjectContract } from "../core/v1/protocol";
import { assertLicenseUtcV1, assertLicenseClockObservationV1 } from "../core/v1/time";
import type { LicenseModelStateV1 } from "../core/v1/state-types";
import type { SignedTokenType } from "../core/v1/types";
import { createOfflineImportPlannerV1, type OfflineImportInputV1 } from "./import-plan";
import type { createOfflineRequestWorkflowV1, OfflineRequestPlanV1 } from "./request";
import { createOfflineEntitlementCompletionV1, createOfflineControlCompletionV1, createOfflineRecoveryCompletionV1,
  createOfflineRebindCompletionV1, createOfflineTimeCorrectionCompletionV1, createOfflineReactivationCompletionV1,
  type OfflineEntitlementCommitAdapterV1 } from "./entitlement-completion";

type WithoutBytes<T> = T extends unknown ? Omit<T, "artifact" | "authorization" | "entitlement"> : never;
export type OfflineFileImportInputV1 = WithoutBytes<OfflineImportInputV1>;

/** Trusted selected-file session, not a path/extension supplied to this module.
 * The future native reader must validate the open regular-file identity, reject
 * links/swaps/modification and enforce maxBytes DURING reading, before returning.
 * A returned byte array is not proof those physical obligations were performed. */
export interface OfflineFileAdaptersV1 {
  read(input: Readonly<{ role: "artifact" | "authorization" | "entitlement"; type: SignedTokenType; maxBytes: number }>): Promise<Uint8Array>;
  /** Publish exact bytes safely without overwriting unrelated data. A throw may
   * follow publication; retain registration and reconcile, never roll it back. */
  publish(input: Readonly<{ bytes: Uint8Array; filename: string; mediaType: string; requestHash: Uint8Array }>): Promise<
    Readonly<{ decision: "PUBLISHED"; byteLength: number; requestHash: Uint8Array }>
  >;
}
const failure = (errorCode: string) => Object.freeze({ ok: false as const, stage: "WORKFLOW", errorCode,
  durable: false as const, runtimeAuthority: "NONE" as const });

export function createOfflineFileWorkflowV1(configuration: Parameters<typeof createOfflineImportPlannerV1>[0] & Readonly<{
  files: OfflineFileAdaptersV1;
  requestWorkflow: ReturnType<typeof createOfflineRequestWorkflowV1>;
  store?: OfflineEntitlementCommitAdapterV1;
}>) {
  const planner = createOfflineImportPlannerV1(configuration), { files, machine, requestWorkflow } = configuration;
  const completion = configuration.store ? (() => {
    const c = { ...configuration, store: configuration.store! };
    return { ENTITLEMENT: createOfflineEntitlementCompletionV1(c), CONTROL: createOfflineControlCompletionV1(c),
      RECOVERY: createOfflineRecoveryCompletionV1(c), REBIND: createOfflineRebindCompletionV1(c),
      TIME_CORRECTION: createOfflineTimeCorrectionCompletionV1(c), REACTIVATION: createOfflineReactivationCompletionV1(c) };
  })() : undefined;
  const allowed = {
    ENTITLEMENT: ["kind", "requestId", "observation"], CONTROL: ["kind", "requestId"],
    RECOVERY: ["kind", "requestId"], REBIND: ["kind", "requestId"],
    TIME_CORRECTION: ["kind", "requestId", "observation"], REACTIVATION: ["kind", "requestId"],
  } as const;
  async function read(role: "artifact" | "authorization" | "entitlement", type: SignedTokenType) {
    const maxBytes = signedObjectContract(type).maxEncodedBytes;
    const bytes = await files.read(Object.freeze({ role, type, maxBytes }));
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maxBytes) throw Error("invalid intake");
    return new Uint8Array(bytes);
  }
    async function importFile(state: LicenseModelStateV1, input: OfflineFileImportInputV1, trustedNow: bigint, complete: boolean) {
      if (complete && !completion) return failure("FILE_COMPLETION_UNAVAILABLE");
      let metadata: OfflineFileImportInputV1;
      try {
        machine.project(state, state.clockHighWater); assertLicenseUtcV1(trustedNow);
        if (!input || !Object.hasOwn(allowed, input.kind) || Object.keys(input).some(k => !(allowed[input.kind] as readonly string[]).includes(k)))
          return failure("FILE_INTENT_INVALID");
        if (input.requestId !== undefined || input.kind !== "CONTROL") {
          if (!(input.requestId instanceof Uint8Array) || input.requestId.length !== 16) return failure("REQUEST_ID_INVALID");
        }
        if ("observation" in input && input.observation !== undefined) assertLicenseClockObservationV1(input.observation);
        if (input.kind === "TIME_CORRECTION" && !input.observation) return failure("RECEIPT_OBSERVATION_REQUIRED");
        metadata = immutableDataView(input);
      } catch { return failure("FILE_CONTEXT_INVALID"); }
      let content: OfflineImportInputV1;
      try {
        if (metadata.kind === "REACTIVATION") {
          const authorization = await read("authorization", "reactivation-authorization");
          const entitlement = await read("entitlement", "entitlement");
          content = { ...metadata, authorization, entitlement };
        } else {
          const type = metadata.kind === "ENTITLEMENT" ? "entitlement" : metadata.kind === "CONTROL" ? "offline-control" :
            metadata.kind === "TIME_CORRECTION" ? "time-correction" : "recovery";
          content = { ...metadata, artifact: await read("artifact", type) };
        }
      } catch { return failure("FILE_INTAKE_FAILED"); }
      if (!complete || !completion) return planner.prepare(state, content, trustedNow);
      // These closed factories verify this exact byte snapshot then commit once.
      // Never reopen the selected file or accept a caller-provided proposal.
      switch (content.kind) {
        case "ENTITLEMENT": return completion.ENTITLEMENT.apply(state, content, trustedNow);
        case "CONTROL": return completion.CONTROL.apply(state, content, trustedNow);
        case "RECOVERY": return completion.RECOVERY.apply(state, content, trustedNow);
        case "REBIND": return completion.REBIND.apply(state, content, trustedNow);
        case "TIME_CORRECTION": return completion.TIME_CORRECTION.apply(state, content, trustedNow);
        case "REACTIVATION": return completion.REACTIVATION.apply(state, content, trustedNow);
      }
    }
  return Object.freeze({
    prepareImport: (state: LicenseModelStateV1, input: OfflineFileImportInputV1, trustedNow: bigint) => importFile(state, input, trustedNow, false),
    applyImport: (state: LicenseModelStateV1, input: OfflineFileImportInputV1, trustedNow: bigint) => importFile(state, input, trustedNow, true),
    async exportRequest(plan: OfflineRequestPlanV1) {
      const exported = await requestWorkflow.export(plan);
      if (!exported.ok) return exported;
      const bytes = new Uint8Array(exported.bytes), hash = sha256(configuration.verification.crypto, bytes);
      let receipt: Awaited<ReturnType<OfflineFileAdaptersV1["publish"]>>;
      try { receipt = await files.publish(immutableDataView({ bytes, filename: exported.filename, mediaType: exported.mediaType, requestHash: hash })); }
      catch { return failure("FILE_PUBLICATION_OUTCOME_UNKNOWN"); }
      if (receipt?.decision !== "PUBLISHED" || receipt.byteLength !== bytes.length ||
        !(receipt.requestHash instanceof Uint8Array) || !bytesEqual(receipt.requestHash, hash)) return failure("FILE_PUBLICATION_ACK_INVALID");
      return Object.freeze({ ok: true as const, decision: "ADAPTER_PUBLISHED" as const, durable: false as const, runtimeAuthority: "NONE" as const });
    },
  });
}
