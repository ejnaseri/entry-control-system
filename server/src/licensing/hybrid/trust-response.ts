import { prepareLicenseTrustUpdateV1 } from "../core/v1/trust-update";
import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { sha256 } from "../core/v1/crypto";
import type { LicenseCryptoV1 } from "../core/v1/crypto";
import { isLicenseCoreError } from "../core/v1/errors";
import { VENDOR_ENDPOINTS, signedObjectContract } from "../core/v1/protocol";
import { encodeDeterministicCborV1, type DeterministicCborValueV1 } from "../core/v1/strict-cbor";
import { assertLicenseUtcV1 } from "../core/v1/time";
import { assertTrustSnapshotIntegrity } from "../core/v1/trust";
import type { TrustSnapshot } from "../core/v1/types";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import type { OfflineRequestReaderV1 } from "../offline/import-plan";

export interface HybridTrustPlanV1 {
  readonly trust: TrustSnapshot;
  readonly expectedTrustHash: Uint8Array;
  readonly proposedTrustHash: Uint8Array;
  readonly expectedStateGeneration: bigint;
  readonly expectedStateHash: Uint8Array;
  readonly encodedBundle: Uint8Array;
  readonly decision: "UPDATE" | "EXACT_RETRY";
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}
/** Trust-only protected transaction. Compare BOTH trust hash and License state
 * generation/hash; retain exact signed artifacts and all prior trust/deny facts.
 * Stage journal/anchors, flush and reconcile restrictions before acknowledgement.
 * EXACT_RETRY is read-only. A live verifier swap/License revalidation is a separate
 * coordinator obligation; this adapter cannot report successful check-in. */
export interface HybridTrustCommitAdapterV1 {
  commit(plan: HybridTrustPlanV1): Promise<Readonly<{ decision: "ACKNOWLEDGED"; trustHash: Uint8Array }> |
    Readonly<{ decision: "CONFLICT" | "PENDING" }>>;
}
class TrustError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new TrustError(code); };
function bounded(v: unknown, max: number): Uint8Array {
  if (!(v instanceof Uint8Array) || !v.length || v.length > max) return deny("TRUST_BYTES_INVALID");
  return new Uint8Array(v);
}
function encodable(value: unknown): DeterministicCborValueV1 {
  if (value instanceof Uint8Array || typeof value === "bigint" || typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(encodable);
  if (value && typeof value === "object") return new Map(Object.entries(value).filter(([,v]) => v !== undefined).map(([k,v]) => [k,encodable(v)]));
  return deny("TRUST_SNAPSHOT_INVALID");
}
const failure = (errorCode: string, commitAttempted = false, stage = "WORKFLOW") =>
  Object.freeze({ ok: false as const, errorCode, stage, commitAttempted, durable: false as const, runtimeAuthority: "NONE" as const });

export function hashLicenseTrustSnapshotV1(crypto: LicenseCryptoV1, trust: TrustSnapshot): Uint8Array {
  return sha256(crypto, encodeDeterministicCborV1(["ENTRY_CONTROL_SYSTEM:TRUST_CAS:V1", encodable(trust)]));
}

/** Independently Root-authorized trust-sidecar dispatch, NOT complete response
 * validation. Companion Lease/Control/Reactivation objects grant no authority here.
 * No HTTP, Root addition, private key, model mutation or live verifier switch. */
export function createHybridTrustResponseWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1; verification: LicenseVerifierConfigurationV1;
  requests: OfflineRequestReaderV1; store: HybridTrustCommitAdapterV1;
}>) {
  const { machine, requests, store } = configuration, crypto = configuration.verification.crypto;
  const base: TrustSnapshot = immutableDataView({ environment: configuration.verification.environment,
    roots: configuration.verification.roots ?? [], trustedKeys: configuration.verification.trustedKeys ?? [],
    delegations: configuration.verification.delegations ?? [],
    ...(configuration.verification.denylist ? { denylist: configuration.verification.denylist } : {}) });
  assertTrustSnapshotIntegrity(crypto, base, base.environment);
  const verifier = createLicenseVerifierV1({ ...base, crypto });
  const digest = (trust: TrustSnapshot) => hashLicenseTrustSnapshotV1(crypto, trust);
  const expectedTrustHash = digest(base), plans = new WeakSet<object>();
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: Readonly<{ encoded: Uint8Array; requestId: Uint8Array }>, trustedNow: bigint) {
      try {
        assertLicenseUtcV1(trustedNow); machine.project(state, state.clockHighWater);
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["encoded", "requestId"].includes(k))) return deny("TRUST_INPUT_INVALID");
        const encoded = bounded(input.encoded, VENDOR_ENDPOINTS.leaseIssuance.maxResponseBytes), id = bounded(input.requestId, 16);
        if (id.length !== 16) return deny("TRUST_REQUEST_ID_INVALID");
        const parsed = verifier.parseCarrier({ carrierType: "lease-response", encoded });
        if (!parsed.ok) return failure(parsed.errorCode, false, parsed.stage);
        if (!bytesEqual(parsed.value.carrier.requestId, id)) return deny("TRUST_REQUEST_ID_MISMATCH");
        if (!parsed.value.carrier.trustBundle) return deny("TRUST_BUNDLE_REQUIRED");
        const bundle = new Uint8Array(parsed.value.carrier.trustBundle);
        let stored: Awaited<ReturnType<OfflineRequestReaderV1["read"]>>;
        try { stored = await requests.read(new Uint8Array(id)); } catch { return deny("REQUEST_STORE_UNAVAILABLE"); }
        if (!stored) return deny("OUTSTANDING_REQUEST_NOT_FOUND");
        const request = verifier.verifySignedObject({ expectedType: "lease-request", encoded: bounded(stored.encoded, signedObjectContract("lease-request").maxEncodedBytes),
          context: { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: state.device } });
        if (!request.ok) return failure(request.errorCode, false, request.stage);
        const rp = request.value.payload;
        if (!bytesEqual(rp.requestId, id)) return deny("STORED_REQUEST_ID_MISMATCH");
        if (rp.requestPurpose !== "CHECK_IN" || state.timeIncident) return deny("TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN");
        if (rp.stateGeneration !== state.stateGeneration) return deny("TRUST_REQUEST_STATE_MISMATCH");
        const parent = [state.current, state.pending].find(v => v && bytesEqual(v.entitlement.payload.tokenId, rp.entitlementTokenId))?.entitlement.payload;
        if (!parent || parent.mode !== "HYBRID_LEASED" || parent.generation !== rp.entitlementGeneration ||
          !bytesEqual(parent.licenseId, rp.licenseId) || !bytesEqual(parent.activationId, rp.activationId)) return deny("TRUST_REQUEST_PARENT_MISMATCH");
        if (trustedNow < state.clockHighWater) return deny("TRUST_TIME_BELOW_HIGH_WATER");
        const reference = state.clock ? state.clockHighWater : trustedNow;
        const trust = prepareLicenseTrustUpdateV1({ ...base, crypto }, bundle, reference);
        const proposedTrustHash = digest(trust);
        const plan: HybridTrustPlanV1 = immutableDataView({ trust, expectedTrustHash, proposedTrustHash,
          expectedStateGeneration: state.stateGeneration, expectedStateHash: state.stateHash, encodedBundle: bundle,
          decision: bytesEqual(expectedTrustHash, proposedTrustHash) ? "EXACT_RETRY" : "UPDATE", durable: false, runtimeAuthority: "NONE" });
        plans.add(plan); return Object.freeze({ ok: true as const, plan });
      } catch (e) { return failure(e instanceof TrustError ? e.code : isLicenseCoreError(e) ? e.code : "TRUST_PREPARATION_FAILED", false, isLicenseCoreError(e) ? e.stage : "WORKFLOW"); }
    },
    async complete(plan: HybridTrustPlanV1) {
      if (!plans.has(plan)) return failure("UNTRUSTED_TRUST_PLAN");
      try {
        const receipt = await store.commit(plan);
        if (receipt?.decision === "PENDING") return failure("TRUST_COMMIT_PENDING", true);
        if (receipt?.decision === "CONFLICT") return failure("TRUST_COMMIT_CONFLICT", true);
        if (receipt?.decision !== "ACKNOWLEDGED" || !(receipt.trustHash instanceof Uint8Array) || !bytesEqual(receipt.trustHash, plan.proposedTrustHash))
          return failure("TRUST_ACKNOWLEDGEMENT_INVALID", true);
        return Object.freeze({ ok: true as const, decision: "TRUST_ADAPTER_ACKNOWLEDGED" as const, requestConsumed: false as const,
          durable: false as const, runtimeAuthority: "NONE" as const });
      } catch { return failure("TRUST_COMMIT_OUTCOME_UNKNOWN", true); }
    },
  });
}
