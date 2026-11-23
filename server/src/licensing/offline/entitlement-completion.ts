import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import type { LicenseModelStateV1, LicenseStateMachineV1, LicenseStateTransitionV1 } from "../core/v1/state-types";
import type { LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import { createOfflineImportPlannerV1, type OfflineImportInputV1, type OfflineRequestReaderV1 } from "./import-plan";
import type { OfflineRebindDeviceProviderV1 } from "./rebind-device";

type Proposal = Extract<LicenseStateTransitionV1, { ok: true }>;

/** Trusted future protected-store transaction, NOT a database write facade.
 * Compare expectedPreviousGeneration AND hash. A PROPOSED result must stage the
 * entire state (including request consumption and receipts), journal/outbox,
 * independent anchors and all commitObligations as ONE outcome. Restrictions
 * must remain fail-closed until their reconciliation obligations are satisfied.
 * IDEMPOTENT confirms the current generation/hash read-only, with zero writes.
 * Do not acknowledge partial, unflushed, unreconciled or uncertain outcomes.
 * Consumed request bytes must remain available to the historical request reader
 * for exact retries; that read never makes a consumed request outstanding again.
 */
export interface OfflineEntitlementCommitAdapterV1 {
  /** Read-only: compare current protected generation/hash; never write/repair. */
  confirm?(snapshot: Readonly<{ stateGeneration: bigint; stateHash: Uint8Array }>): Promise<
    Readonly<{ decision: "ACKNOWLEDGED"; stateGeneration: bigint; stateHash: Uint8Array }> | Readonly<{ decision: "CONFLICT" | "PENDING" }>
  >;
  commit(proposal: Proposal): Promise<
    | Readonly<{ decision: "ACKNOWLEDGED"; stateGeneration: bigint; stateHash: Uint8Array }>
    | Readonly<{ decision: "CONFLICT" | "PENDING" }>
  >;
}

export type OfflineEntitlementCompletionResultV1 =
  | Readonly<{ ok: true; decision: "ADAPTER_ACKNOWLEDGED" | "ADAPTER_CONFIRMED_DUPLICATE";
      stateGeneration: bigint; stateHash: Uint8Array; durable: false; runtimeAuthority: "NONE" }>
  | Readonly<{ ok: false; stage: string; errorCode: string; commitAttempted: boolean;
      durable: false; runtimeAuthority: "NONE" }>;

/** Portable completion contract only. An adapter acknowledgement is not real
 * Windows durability, user-visible activation or permission to run the app.
 * The caller obtains a trusted store snapshot for each attempt. Never retry a
 * stale proposal automatically, roll back an uncertain commit or delete files.
 */
type CompletionConfiguration = Readonly<{
  machine: LicenseStateMachineV1;
  verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1;
  store: OfflineEntitlementCommitAdapterV1;
  rebind?: OfflineRebindDeviceProviderV1;
}>;

type CompletionInputs = {
  ENTITLEMENT: Extract<OfflineImportInputV1, { kind: "ENTITLEMENT" }>;
  CONTROL: Extract<OfflineImportInputV1, { kind: "CONTROL" }>;
  RECOVERY: Extract<OfflineImportInputV1, { kind: "RECOVERY" }>;
  REBIND: Extract<OfflineImportInputV1, { kind: "REBIND" }>;
  TIME_CORRECTION: Extract<OfflineImportInputV1, { kind: "TIME_CORRECTION" }>;
  REACTIVATION: Extract<OfflineImportInputV1, { kind: "REACTIVATION" }>;
};

function createCompletion<K extends keyof CompletionInputs>(configuration: CompletionConfiguration, kind: K) {
  const planner = createOfflineImportPlannerV1(configuration);
  const store = configuration.store;
  const failure = (errorCode: string, commitAttempted: boolean, stage = "WORKFLOW"): OfflineEntitlementCompletionResultV1 =>
    Object.freeze({ ok: false, stage, errorCode, commitAttempted, durable: false, runtimeAuthority: "NONE" });
  return Object.freeze({
    async apply(state: LicenseModelStateV1,
      input: CompletionInputs[K], trustedNow: bigint,
    ): Promise<OfflineEntitlementCompletionResultV1> {
      if (!input || input.kind !== kind) return failure(`${kind}_COMPLETION_ONLY`, false);
      // The planner snapshots bounded input synchronously before its first await.
      const planned = await planner.prepare(state, input, trustedNow);
      if (!planned.ok) return failure(planned.errorCode, false, planned.stage);
      if (planned.decision === "MODEL_ALREADY_APPLIED") {
        if (kind !== "TIME_CORRECTION" || !store.confirm) return failure("READ_ONLY_CONFIRMATION_REQUIRED", false);
        let receipt: Awaited<ReturnType<NonNullable<OfflineEntitlementCommitAdapterV1["confirm"]>>>;
        try { receipt = await store.confirm(immutableDataView({ stateGeneration: state.stateGeneration, stateHash: state.stateHash })); }
        catch { return failure("READ_ONLY_CONFIRMATION_UNAVAILABLE", false); }
        if (receipt?.decision === "CONFLICT") return failure("COMMIT_STATE_CONFLICT", false);
        if (receipt?.decision === "PENDING") return failure("COMMIT_PENDING", false);
        if (receipt?.decision !== "ACKNOWLEDGED" || receipt.stateGeneration !== state.stateGeneration ||
          !(receipt.stateHash instanceof Uint8Array) || !bytesEqual(receipt.stateHash, state.stateHash)) return failure("COMMIT_ACKNOWLEDGEMENT_INVALID", false);
        return immutableDataView({ ok: true, decision: "ADAPTER_CONFIRMED_DUPLICATE", stateGeneration: state.stateGeneration,
          stateHash: state.stateHash, durable: false, runtimeAuthority: "NONE" });
      }
      const proposal = planned.proposal;
      let receipt: Awaited<ReturnType<OfflineEntitlementCommitAdapterV1["commit"]>>;
      try { receipt = await store.commit(proposal); }
      catch {
        // The write may have completed before the acknowledgement was lost.
        // Report uncertainty, not "unchanged" and never compensate/rollback.
        return failure("COMMIT_OUTCOME_UNKNOWN", true);
      }
      if (receipt?.decision === "CONFLICT") return failure("COMMIT_STATE_CONFLICT", true);
      if (receipt?.decision === "PENDING") return failure("COMMIT_PENDING", true);
      if (receipt?.decision !== "ACKNOWLEDGED" || receipt.stateGeneration !== proposal.state.stateGeneration ||
        !(receipt.stateHash instanceof Uint8Array) || receipt.stateHash.length !== 32 ||
        !bytesEqual(receipt.stateHash, proposal.state.stateHash)) return failure("COMMIT_ACKNOWLEDGEMENT_INVALID", true);
      return immutableDataView({ ok: true,
        decision: proposal.decision === "IDEMPOTENT" ? "ADAPTER_CONFIRMED_DUPLICATE" : "ADAPTER_ACKNOWLEDGED",
        stateGeneration: proposal.state.stateGeneration, stateHash: proposal.state.stateHash,
        durable: false, runtimeAuthority: "NONE" });
    },
  });
}

export function createOfflineEntitlementCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "ENTITLEMENT");
}

/** Same transaction obligations, but a closed CONTROL-only surface. A pending
 * restrictive transition must never be reported as effective by this adapter. */
export function createOfflineControlCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "CONTROL");
}

/** RECOVER only: strict core one-use rejection remains intact. A lost commit
 * acknowledgement needs reconciliation, never replay application or rollback. */
export function createOfflineRecoveryCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "RECOVERY");
}

/** Staged local key comes only from the trusted provider, never import fields. */
export function createOfflineRebindCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "REBIND");
}

export function createOfflineTimeCorrectionCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "TIME_CORRECTION");
}

/** Complete offline pair only. Hybrid cannot activate without its exact Lease. */
export function createOfflineReactivationCompletionV1(configuration: CompletionConfiguration) {
  return createCompletion(configuration, "REACTIVATION");
}
