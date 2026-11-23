import type {
  BuildBindingSnapshot, ControlState, DeviceBindingSnapshot, EntitlementPayload,
  LeasePayload, OpaqueId, OutstandingRequestSnapshot, Sha256, SignedPayloadByType, TrustSnapshot, ParentEntitlementSnapshot,
} from "./types";
import type { LicenseVerifierConfigurationV1 } from "./verifier";
import type { LicenseClockAnchorV1, LicenseClockObservationV1, LicenseTimeIncidentV1, LicenseTimeRequestEvidenceV1 } from "./time";

/** Pure model only. A proposal never proves a durable write or runtime admission. */
export type LicenseEffectiveStateV1 =
  | "TAMPER_LOCKED" | "REVOKED_LOCKED" | "SUSPENDED_LOCKED"
  | "RECOVERY_REQUIRED" | "INCOMPATIBLE_LOCKED" | "LEASE_EXPIRED_LOCKED"
  | "EXPIRED_LOCKED" | "POST_EXPIRY_GRACE" | "OFFLINE_GRACE"
  | "EXPIRING" | "ACTIVE" | "UNLICENSED";

export type StateTokenTypeV1 = "entitlement" | "lease" | "offline-control"
  | "reactivation-authorization" | "recovery" | "time-correction";

export interface StateTokenV1<T extends StateTokenTypeV1> {
  readonly type: T;
  readonly payload: SignedPayloadByType[T];
  readonly encoded: Uint8Array;
  readonly hash: Sha256;
}

export interface LicensePairV1 {
  readonly entitlement: StateTokenV1<"entitlement">;
  readonly lease?: StateTokenV1<"lease">;
}

export interface LicenseControlFactV1 {
  readonly revision: bigint;
  readonly state: ControlState;
  readonly effectiveAt: bigint;
  /** Source-envelope staging never rewrites the signed Control effective tuple. */
  readonly notBefore?: bigint;
  readonly reasonCode: bigint;
  readonly tokenId: OpaqueId;
  readonly tokenHash: Sha256;
}

export interface LicenseIncidentV1 {
  readonly id: OpaqueId;
  readonly nonce: Sha256;
  readonly reason: string;
}

export interface LicenseTombstoneV1 {
  readonly id: OpaqueId;
  readonly hash: Sha256;
  readonly licenseId: OpaqueId;
  readonly activationId: OpaqueId;
  readonly finalControlRevision: bigint;
  readonly finalRevokeTokenHash: Sha256;
}

export interface LicenseModelStateV1 {
  readonly modelVersion: 1n;
  readonly stateGeneration: bigint;
  readonly stateHash: Sha256;
  readonly previousStateHash: Sha256;
  readonly build: BuildBindingSnapshot;
  readonly device: DeviceBindingSnapshot;
  readonly clockHighWater: bigint;
  /** Operational calendar only; cannot establish the signed correction floor. */
  readonly observedUtc?: bigint | undefined;
  readonly clock?: LicenseClockAnchorV1 | undefined;
  readonly timeIncident?: LicenseTimeIncidentV1 | undefined;
  readonly highestProductVersion: string;
  readonly current?: LicensePairV1 | undefined;
  readonly pending?: LicensePairV1 | undefined;
  readonly pendingCurrentLease?: StateTokenV1<"lease"> | undefined;
  readonly entitlementGeneration: bigint;
  readonly leaseRevision: bigint;
  readonly timeCorrectionRevision: bigint;
  /** Accepted high-water, including scheduled transitions; facts survive token expiry. */
  readonly control: LicenseControlFactV1;
  readonly controlHistory: readonly LicenseControlFactV1[];
  readonly tombstones: readonly LicenseTombstoneV1[];
  readonly receipts: readonly Readonly<{ type: StateTokenTypeV1; tokenId: OpaqueId; hash: Sha256;
    licenseId?: OpaqueId; activationId?: OpaqueId }>[];
  readonly consumedRequests: readonly Readonly<{ id: OpaqueId; hash: Sha256 }>[];
  readonly consumedRecoveries: readonly OpaqueId[];
  readonly consumedReactivations: readonly OpaqueId[];
  readonly incident?: LicenseIncidentV1 | undefined;
  readonly tamperLatched: boolean;
  readonly recoveryRequired: boolean;
  readonly networkUnavailable: boolean;
}

/** Evidence is supplied by a trusted adapter; this model cannot authenticate Windows anchors. */
export interface IndependentRollbackEvidenceV1 {
  readonly protectionDomain: "TPM" | "SEALED_PROGRAMDATA" | "SEALED_REGISTRY";
  readonly observedGeneration: bigint;
  readonly protectedHighWater: bigint;
}

export type LicenseStateCommandV1 =
  | Readonly<{ kind: "IMPORT_LEASE_CONTROL";
      lease: Extract<LicenseStateCommandV1, { kind: "IMPORT_LEASE" | "RECOVER_ONLINE_TIME" }>;
      control: Uint8Array; controlRequest?: OutstandingRequestSnapshot }>
  | Readonly<{ kind: "OBSERVE_TIME"; observation: LicenseClockObservationV1; incident: LicenseIncidentV1 }>
  | Readonly<{ kind: "BEGIN_TIME_RECOVERY"; observation: LicenseClockObservationV1; incident: LicenseIncidentV1 }>
  | Readonly<{ kind: "APPLY_TIME_CORRECTION"; encoded: Uint8Array; request: OutstandingRequestSnapshot;
      observation: LicenseClockObservationV1; evidence?: LicenseTimeRequestEvidenceV1 }>
  | Readonly<{ kind: "RECOVER_ONLINE_TIME"; encoded: Uint8Array; request: OutstandingRequestSnapshot;
      observation: LicenseClockObservationV1; evidence?: LicenseTimeRequestEvidenceV1 }>
  | Readonly<{ kind: "IMPORT_ENTITLEMENT"; encoded: Uint8Array; request: OutstandingRequestSnapshot; observation?: LicenseClockObservationV1 }>
  | Readonly<{ kind: "IMPORT_LEASE"; encoded: Uint8Array; request: OutstandingRequestSnapshot; parentTokenId: OpaqueId; observation?: LicenseClockObservationV1 }>
  | Readonly<{ kind: "IMPORT_CONTROL"; encoded: Uint8Array; request?: OutstandingRequestSnapshot }>
  | Readonly<{ kind: "RECOVER"; encoded: Uint8Array; request: OutstandingRequestSnapshot; newDevice?: DeviceBindingSnapshot }>
  | Readonly<{ kind: "REACTIVATE"; authorization?: Uint8Array; entitlement?: Uint8Array; request: OutstandingRequestSnapshot;
      lease?: Uint8Array; leaseRequest?: OutstandingRequestSnapshot;
      control?: Uint8Array; controlRequest?: OutstandingRequestSnapshot }>
  | Readonly<{ kind: "REEVALUATE" }>
  | Readonly<{ kind: "NETWORK"; unavailable: boolean }>
  | Readonly<{ kind: "BEGIN_REACTIVATION"; incident: LicenseIncidentV1 }>
  | Readonly<{
      kind: "INTEGRITY_INCIDENT";
      incident: LicenseIncidentV1;
      evidence?: readonly IndependentRollbackEvidenceV1[];
    }>;

export interface LicenseStateProjectionV1 {
  readonly state: LicenseEffectiveStateV1;
  readonly operational: boolean;
  readonly stateGeneration: bigint;
  /** Always NONE: only later secure-store/coordinator work may grant runtime authority. */
  readonly runtimeAuthority: "NONE";
  readonly features: readonly string[];
}

export type LicenseStateTransitionV1 =
  | Readonly<{
      ok: false; stage: string; errorCode: string;
      state: LicenseModelStateV1; authoritativeStateChanged: false; requestConsumed: false;
    }>
  | Readonly<{
      ok: true; decision: "PROPOSED" | "IDEMPOTENT";
      state: LicenseModelStateV1;
      expectedPreviousGeneration: bigint;
      expectedPreviousHash: Sha256;
      authoritativeStateChanged: false; requestConsumed: false;
      /** All facts/consumptions in state must be committed together by a later adapter. */
      commitObligations: readonly string[];
    }>;

export interface LicenseStateMachineConfigurationV1 {
  readonly verification: LicenseVerifierConfigurationV1;
  readonly build: BuildBindingSnapshot;
  readonly device: DeviceBindingSnapshot;
}

export interface LicenseStateMachineV1 {
  /** Verify the two-artifact pair for a new Hybrid CHECK_IN target without publishing
   * intermediate state, consumption or authority. Completion still requires its Lease. */
  reactivationTarget(state: LicenseModelStateV1, input: Readonly<{ authorization: Uint8Array;
    entitlement: Uint8Array; request: OutstandingRequestSnapshot }>, trustedNow: bigint): ParentEntitlementSnapshot;
  /** Provenance only; does not evaluate whether retained grants may operate. */
  assertOwnsState(state: LicenseModelStateV1): void;
  /** Stage a Root-verified cumulative trust branch. No commit, generation change or runtime switch.
   * Branch projections/transitions enforce updated trust on retained authorizing tokens. */
  stageTrust(state: LicenseModelStateV1, encodedBundle: Uint8Array, trustedNow: bigint):
    Readonly<{ machine: LicenseStateMachineV1; state: LicenseModelStateV1; trust: TrustSnapshot }>;
  initial(): LicenseModelStateV1;
  transition(state: LicenseModelStateV1, command: LicenseStateCommandV1, trustedNow: bigint): LicenseStateTransitionV1;
  project(state: LicenseModelStateV1, trustedNow: bigint): LicenseStateProjectionV1;
  /** Read-only duplicate acknowledgement, never a mutation/admission result. */
  timeCorrectionReceipt(state: LicenseModelStateV1, encoded: Uint8Array): "ALREADY_APPLIED" | "NOT_APPLIED";
}

export type StateEntitlementV1 = EntitlementPayload;
export type StateLeaseV1 = LeasePayload;
