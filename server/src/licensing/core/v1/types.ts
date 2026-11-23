/**
 * Portable, data-only types for the frozen Licensing protocol v1.
 *
 * This module deliberately has no Node.js dependency.  Byte arrays crossing a
 * trust boundary must be copied by the producer; every public aggregate below
 * exposes them through readonly properties.
 */

export type VerificationStage =
  | "PRE_DECODE"
  | "CBOR_PARSE"
  | "COSE_PARSE"
  | "DOMAIN"
  | "SCHEMA"
  | "SIGNATURE"
  | "TRUST"
  | "CLAIMS"
  | "STATE";

export type VerificationErrorCode = string;

export interface CborNode {
  readonly encoded: Uint8Array;
}

export interface CborUnsigned extends CborNode {
  readonly kind: "unsigned";
  readonly integer: bigint;
}

export interface CborNegative extends CborNode {
  readonly kind: "negative";
  /** The already-decoded negative value (for example, -7n). */
  readonly integer: bigint;
}

export interface CborBytes extends CborNode {
  readonly kind: "bytes";
  readonly bytes: Uint8Array;
}

export interface CborText extends CborNode {
  readonly kind: "text";
  readonly text: string;
}

export interface CborBoolean extends CborNode {
  readonly kind: "boolean";
  readonly boolean: boolean;
}

/**
 * Null is never accepted by a v1 schema.  It remains representable so a
 * strict decoder can preserve the frozen SCHEMA/NULL_FIELD_FORBIDDEN error.
 */
export interface CborNull extends CborNode {
  readonly kind: "null";
}

export interface CborArray extends CborNode {
  readonly kind: "array";
  readonly items: readonly CborValue[];
}

export interface CborMapEntry {
  readonly key: CborValue;
  readonly value: CborValue;
}

export interface CborMap extends CborNode {
  readonly kind: "map";
  readonly entries: readonly CborMapEntry[];
}

export interface CborTag extends CborNode {
  readonly kind: "tag";
  readonly tag: bigint;
  readonly item: CborValue;
}

export type CborValue =
  | CborUnsigned
  | CborNegative
  | CborBytes
  | CborText
  | CborBoolean
  | CborNull
  | CborArray
  | CborMap
  | CborTag;

export type ProtocolInteger = bigint;
export type ProtocolBytes = Readonly<Uint8Array>;
export type OpaqueId = ProtocolBytes;
export type KeyId = ProtocolBytes;
export type Sha256 = ProtocolBytes;
export type Nonce256 = ProtocolBytes;
export type UtcSecond = ProtocolInteger;
export type Counter = ProtocolInteger;

export type NormalizedCborValue =
  | ProtocolInteger
  | string
  | boolean
  | ProtocolBytes
  | readonly NormalizedCborValue[]
  | ProtocolRecord;

export type ProtocolRecord = Readonly<{
  [key: string]: NormalizedCborValue;
}>;

export type SchemaFailureReporter = (
  stage: VerificationStage,
  code: VerificationErrorCode,
  path?: string,
) => never;

export type SignedTokenType =
  | "activation-request"
  | "lease-request"
  | "key-delegation"
  | "key-denylist"
  | "entitlement"
  | "lease"
  | "offline-control"
  | "reactivation-authorization"
  | "recovery"
  | "time-correction";

export type CarrierType = "lease-challenge" | "lease-response" | "trust-bundle";

export type ProductId = "ENTRY_CONTROL_SYSTEM";
export type Edition = "FULL" | "ATTENDANCE";
export type Assurance = "TPM_ATTESTED" | "SOFTWARE_BOUND";
export type Environment = "PRODUCTION" | "DEVELOPMENT" | "TEST";
export type SignerPurpose =
  | "INSTALLATION_DEVICE"
  | "OFFLINE_CONTROL"
  | "OFFLINE_ENTITLEMENT"
  | "ONLINE_LEASE"
  | "PROD_ROOT"
  | "RECOVERY";

export type Feature =
  | "ADMIN_USERS"
  | "ATTENDANCE_COMPLIANCE"
  | "ATTENDANCE_DAILY"
  | "ATTENDANCE_DASHBOARD"
  | "ATTENDANCE_EXPORT"
  | "ATTENDANCE_REPORTS"
  | "AUDIT_LOGS"
  | "AUTH"
  | "BACKUPS"
  | "CUSTOMERS"
  | "CUSTOMER_PAYMENTS"
  | "DEVICES"
  | "DEVICE_DIAGNOSTICS"
  | "DOOR_CONTROL"
  | "EMPLOYEES"
  | "ENTRY_LOGS"
  | "EXPENSES"
  | "FINANCIAL_REPORTS"
  | "INBOX"
  | "MEMBERSHIPS"
  | "PAYROLL"
  | "SOUNDS"
  | "STAFF_GROUPS";

export type ControlState = "OPERATIONAL" | "SUSPENDED" | "REVOKED";
export type LeaseControlState = Exclude<ControlState, "REVOKED">;
export type ControlAction = "SUSPEND" | "UNSUSPEND" | "REVOKE";

export interface TpmEvidence {
  readonly schemaVersion: 1n;
  readonly format: "WINDOWS_CNG_TPM_KEY_ATTESTATION_V1";
  readonly contextHash: Sha256;
  readonly evidence: ProtocolBytes;
}

export type ActivationBinding =
  | Readonly<{
      bindingKind: "SOFTWARE_BOUND";
    }>
  | Readonly<{
      bindingKind: "TPM_ATTESTED";
      tpmEvidence: TpmEvidence;
    }>;

export type CurrentControlSnapshot =
  | Readonly<{
      controlRevision: 0n;
      controlState: "OPERATIONAL";
    }>
  | Readonly<{
      controlRevision: Counter;
      controlState: ControlState;
    }>;

export type CurrentControlTuple =
  | Readonly<{
      controlRevision: 0n;
      controlState: "OPERATIONAL";
      controlEffectiveAt: 0n;
      controlReasonCode: 0n;
    }>
  | Readonly<{
      controlRevision: Counter;
      controlState: ControlState;
      controlEffectiveAt: UtcSecond;
      controlReasonCode: Counter;
    }>;

export type LeaseControlTuple =
  | Readonly<{
      controlRevision: 0n;
      controlState: "OPERATIONAL";
      controlEffectiveAt: 0n;
      controlReasonCode: 0n;
    }>
  | Readonly<{
      controlRevision: Counter;
      controlState: LeaseControlState;
      controlEffectiveAt: UtcSecond;
      controlReasonCode: Counter;
    }>;

interface ActivationRequestCommonFields {
  readonly protocolVersion: 1n;
  readonly tokenType: "activation-request";
  readonly requestId: OpaqueId;
  readonly requestNonce: Nonce256;
  readonly keyId: KeyId;
  readonly issuedAt: UtcSecond;
  readonly notAfter: UtcSecond;
  readonly productId: ProductId;
  readonly edition: Edition;
  readonly installationId: OpaqueId;
  readonly devicePublicKey: ProtocolBytes;
  readonly deviceKeyId: KeyId;
  readonly versionIdentitySha256: Sha256;
  readonly buildIdentitySha256: Sha256;
  readonly buildManifestSha256: Sha256;
  readonly stateGeneration: Counter;
  readonly entitlementGeneration: Counter;
  readonly leaseRevision: Counter;
  readonly timeCorrectionRevision: Counter;
}

export type ActivationRequestPayload = Readonly<ActivationRequestCommonFields> &
  CurrentControlSnapshot &
  ActivationBinding &
  (
    | Readonly<{ requestPurpose: "ACTIVATE" }>
    | Readonly<{
        requestPurpose: "RENEW";
        licenseId: OpaqueId;
        activationId: OpaqueId;
        entitlementTokenId: OpaqueId;
      }>
    | Readonly<{
        requestPurpose: "CONTROL";
        licenseId: OpaqueId;
        activationId: OpaqueId;
        controlAction: ControlAction;
        controlEffectiveAt: UtcSecond;
        controlReasonCode: Counter;
      }>
    | Readonly<{
        requestPurpose: "RECOVER";
        licenseId: OpaqueId;
        activationId: OpaqueId;
        incidentId: OpaqueId;
        incidentNonce: Nonce256;
        stateHash: Sha256;
        entitlementTokenId: OpaqueId;
        entitlementTokenHash: Sha256;
      }>
    | Readonly<{
        requestPurpose: "REBIND";
        licenseId: OpaqueId;
        activationId: OpaqueId;
        incidentId: OpaqueId;
        incidentNonce: Nonce256;
        stateHash: Sha256;
        entitlementTokenId: OpaqueId;
        entitlementTokenHash: Sha256;
        oldDeviceKeyId: KeyId;
      }>
    | Readonly<{
        requestPurpose: "REACTIVATE";
        revokedLicenseId: OpaqueId;
        revokedActivationId: OpaqueId;
        finalRevokeTokenHash: Sha256;
        finalControlRevision: Counter;
        incidentId: OpaqueId;
        incidentNonce: Nonce256;
        revokedLineageTombstoneId: OpaqueId;
        revokedLineageTombstoneHash: Sha256;
      }>
    | Readonly<{
        requestPurpose: "TIME_CORRECT";
        licenseId: OpaqueId;
        activationId: OpaqueId;
        incidentId: OpaqueId;
        incidentNonce: Nonce256;
        preIncidentClockHighWater: UtcSecond;
      }>
  );

interface LeaseRequestCommonFields {
  readonly protocolVersion: 1n;
  readonly tokenType: "lease-request";
  readonly requestId: OpaqueId;
  readonly requestNonce: Nonce256;
  readonly keyId: KeyId;
  readonly httpMethod: "POST";
  readonly httpPath: "/v1/licensing/leases";
  readonly productId: ProductId;
  readonly edition: Edition;
  readonly licenseId: OpaqueId;
  readonly activationId: OpaqueId;
  readonly installationId: OpaqueId;
  readonly deviceKeyId: KeyId;
  readonly entitlementTokenId: OpaqueId;
  readonly entitlementGeneration: Counter;
  readonly lastLeaseRevision: Counter;
  readonly stateGeneration: Counter;
  readonly versionIdentitySha256: Sha256;
  readonly buildIdentitySha256: Sha256;
  readonly buildManifestSha256: Sha256;
  readonly bindingRecoveryTokenId?: OpaqueId;
}

export type LeaseRequestPayload = Readonly<LeaseRequestCommonFields> &
  CurrentControlTuple &
  (
    | Readonly<{ requestPurpose: "CHECK_IN" }>
    | Readonly<{
        requestPurpose: "TIME_RECOVERY";
        incidentId: OpaqueId;
        incidentNonce: Nonce256;
        preIncidentClockHighWater: UtcSecond;
      }>
  );

interface VendorSignedCommon<T extends SignedTokenType> {
  readonly protocolVersion: 1n;
  readonly tokenType: T;
  readonly tokenId: OpaqueId;
  readonly keyId: KeyId;
  readonly issuedAt: UtcSecond;
  readonly notBefore: UtcSecond;
  readonly notAfter: UtcSecond;
  readonly productId: ProductId;
}

export type DelegationPurposeLimits =
  | Readonly<{
      purpose: "OFFLINE_ENTITLEMENT";
      maxTokenLifetimeSeconds: Counter;
      maxBusinessTermSeconds: Counter;
    }>
  | Readonly<{
      purpose: "ONLINE_LEASE" | "OFFLINE_CONTROL" | "RECOVERY";
      maxTokenLifetimeSeconds: Counter;
    }>;

export type KeyDelegationPayload = VendorSignedCommon<"key-delegation"> &
  Readonly<{
    environment: Environment;
    delegatedPublicKey: ProtocolBytes;
    delegatedKeyId: KeyId;
    delegationSerial: Counter;
  }> &
  DelegationPurposeLimits;

export interface DeniedKeyEntry {
  readonly delegatedKeyId: KeyId;
  readonly effectiveAt: UtcSecond;
  readonly reasonCode: 1n | 2n | 3n;
}

export type DenylistLineage =
  | Readonly<{ denylistRevision: 1n }>
  | Readonly<{
      denylistRevision: Counter;
      previousDenylistTokenId: OpaqueId;
      previousDenylistHash: Sha256;
    }>;

export type KeyDenylistPayload = VendorSignedCommon<"key-denylist"> &
  Readonly<{
    environment: Environment;
    deniedKeys: readonly DeniedKeyEntry[];
  }> &
  DenylistLineage;

export type EntitlementLineage =
  | Readonly<{
      generation: 1n;
      reactivationAuthorizationId?: OpaqueId;
    }>
  | Readonly<{
      generation: Counter;
      previousTokenId: OpaqueId;
    }>;

export type EntitlementMode =
  | Readonly<{ mode: "OFFLINE_BOUND" }>
  | Readonly<{
      mode: "HYBRID_LEASED";
      checkCadenceSeconds: Counter;
      offlineAllowanceSeconds: Counter;
      timeRecoveryRttSeconds: 300n;
    }>;

export type EntitlementPayload = VendorSignedCommon<"entitlement"> &
  Readonly<{
    edition: Edition;
    customerId: OpaqueId;
    customerDisplayName?: string;
    licenseId: OpaqueId;
    activationId: OpaqueId;
    installationId: OpaqueId;
    deviceKeyId: KeyId;
    features: readonly Feature[];
    assurance: Assurance;
    termStartsAt: UtcSecond;
    termEndsAt: UtcSecond;
    warningLeadSeconds: Counter;
    warningStartsAt: UtcSecond;
    graceSeconds: Counter;
    graceUntil: UtcSecond;
    clockToleranceSeconds: 300n;
    minimumProductVersion: string;
    maximumMajorVersion: Counter;
    requestId: OpaqueId;
    requestHash: Sha256;
  }> &
  EntitlementLineage &
  EntitlementMode;

export type LeasePayload = VendorSignedCommon<"lease"> &
  Readonly<{
    edition: Edition;
    licenseId: OpaqueId;
    activationId: OpaqueId;
    installationId: OpaqueId;
    deviceKeyId: KeyId;
    mode: "HYBRID_LEASED";
    assurance: Assurance;
    features: readonly Feature[];
    entitlementTokenId: OpaqueId;
    entitlementGeneration: Counter;
    leaseRevision: Counter;
    serverTime: UtcSecond;
    offlineUntil: UtcSecond;
    leaseRequestId: OpaqueId;
    leaseRequestHash: Sha256;
    versionIdentitySha256: Sha256;
    buildIdentitySha256: Sha256;
    buildManifestSha256: Sha256;
    bindingRecoveryTokenId?: OpaqueId;
  }> &
  LeaseControlTuple;

export type OfflineControlOrigin =
  | Readonly<{ origin: "VENDOR_INITIATED" }>
  | Readonly<{
      origin: "REQUEST_BOUND";
      requestId: OpaqueId;
      requestHash: Sha256;
    }>;

export type OfflineControlPayload = VendorSignedCommon<"offline-control"> &
  Readonly<{
    edition: Edition;
    licenseId: OpaqueId;
    activationId: OpaqueId;
    controlRevision: Counter;
    action: ControlAction;
    effectiveAt: UtcSecond;
    reasonCode: Counter;
  }> &
  OfflineControlOrigin;

export type ReactivationAuthorizationPayload = VendorSignedCommon<"reactivation-authorization"> &
  Readonly<{
    edition: Edition;
    revokedLicenseId: OpaqueId;
    revokedActivationId: OpaqueId;
    finalRevokeTokenHash: Sha256;
    finalControlRevision: Counter;
    incidentId: OpaqueId;
    incidentNonce: Nonce256;
    requestId: OpaqueId;
    requestHash: Sha256;
    installationId: OpaqueId;
    deviceKeyId: KeyId;
    newLicenseId: OpaqueId;
    newActivationId: OpaqueId;
    maximumFeatures: readonly Feature[];
  }>;

export type RecoveryTransition =
  | Readonly<{ allowedTransition: "CLEAR_TAMPER" | "REPAIR_SECURE_STATE" }>
  | Readonly<{
      allowedTransition: "REBIND_DEVICE";
      oldDeviceKeyId: KeyId;
      newDeviceKeyId: KeyId;
      newAssurance: Assurance;
    }>;

export type RecoveryPayload = VendorSignedCommon<"recovery"> &
  Readonly<{
    edition: Edition;
    licenseId: OpaqueId;
    activationId: OpaqueId;
    installationId: OpaqueId;
    incidentId: OpaqueId;
    incidentNonce: Nonce256;
    requestId: OpaqueId;
    requestHash: Sha256;
    expectedStateGeneration: Counter;
    newStateGeneration: Counter;
    entitlementTokenId: OpaqueId;
    entitlementTokenHash: Sha256;
    entitlementGeneration: Counter;
    controlRevision: Counter;
    reasonCode: Counter;
    maximumFeatures: readonly Feature[];
  }> &
  RecoveryTransition;

export type TimeCorrectionPayload = VendorSignedCommon<"time-correction"> &
  Readonly<{
    edition: Edition;
    licenseId: OpaqueId;
    activationId: OpaqueId;
    installationId: OpaqueId;
    deviceKeyId: KeyId;
    incidentId: OpaqueId;
    incidentNonce: Nonce256;
    requestId: OpaqueId;
    requestHash: Sha256;
    expectedStateGeneration: Counter;
    newStateGeneration: Counter;
    timeCorrectionRevision: Counter;
    preIncidentClockHighWater: UtcSecond;
    correctedUtc: UtcSecond;
    reasonCode: 1n | 2n;
  }>;

export interface SignedPayloadByType {
  readonly "activation-request": ActivationRequestPayload;
  readonly "lease-request": LeaseRequestPayload;
  readonly "key-delegation": KeyDelegationPayload;
  readonly "key-denylist": KeyDenylistPayload;
  readonly entitlement: EntitlementPayload;
  readonly lease: LeasePayload;
  readonly "offline-control": OfflineControlPayload;
  readonly "reactivation-authorization": ReactivationAuthorizationPayload;
  readonly recovery: RecoveryPayload;
  readonly "time-correction": TimeCorrectionPayload;
}

export type SignedPayload = SignedPayloadByType[SignedTokenType];

export interface LeaseChallengeCarrier {
  readonly schemaVersion: 1n;
  readonly carrierType: "lease-challenge";
  readonly requestNonce: Nonce256;
  readonly expiresInSeconds: 300n;
}

export interface TrustBundleCarrier {
  readonly schemaVersion: 1n;
  readonly carrierType: "trust-bundle";
  readonly delegations: readonly ProtocolBytes[];
  readonly denylist: ProtocolBytes;
}

interface LeaseResponseCarrierCommon {
  readonly schemaVersion: 1n;
  readonly carrierType: "lease-response";
  readonly requestId: OpaqueId;
  readonly trustBundle?: ProtocolBytes;
}

export type LeaseResponseCarrier = LeaseResponseCarrierCommon &
  (
    | Readonly<{
        lease: ProtocolBytes;
        offlineControl?: ProtocolBytes;
        reactivationAuthorization?: ProtocolBytes;
      }>
    | Readonly<{
        offlineControl: ProtocolBytes;
        reactivationAuthorization?: ProtocolBytes;
      }>
    | Readonly<{
        reactivationAuthorization: ProtocolBytes;
      }>
  );

export interface CarrierByType {
  readonly "lease-challenge": LeaseChallengeCarrier;
  readonly "lease-response": LeaseResponseCarrier;
  readonly "trust-bundle": TrustBundleCarrier;
}

export interface ValidatedSignedPayload<T extends SignedTokenType> {
  readonly tokenType: T;
  /** A recursively immutable, string-keyed representation of the CBOR map. */
  readonly decoded: ProtocolRecord;
  /** The same data narrowed to the exact v1 domain union. */
  readonly payload: SignedPayloadByType[T];
}

export interface ValidatedCarrier<T extends CarrierType> {
  readonly carrierType: T;
  readonly decoded: ProtocolRecord;
  readonly carrier: CarrierByType[T];
  readonly variant: T extends "lease-response"
    ? "WITH_LEASE" | "CONTROL_ONLY" | "REACTIVATION_ONLY"
    : "STANDARD";
}

export interface RootAnchor {
  readonly kid: KeyId;
  readonly spkiDer: ProtocolBytes;
  readonly purpose: "PROD_ROOT";
  readonly environment: Environment;
}

export interface DelegationTrustSnapshot {
  readonly tokenId: OpaqueId;
  readonly tokenHash: Sha256;
  readonly rootKid: KeyId;
  readonly delegatedKeyId: KeyId;
  readonly spkiDer: ProtocolBytes;
  readonly purpose: Exclude<SignerPurpose, "PROD_ROOT" | "INSTALLATION_DEVICE">;
  readonly environment: Environment;
  readonly delegationSerial: Counter;
  readonly issuedAt: UtcSecond;
  readonly notBefore: UtcSecond;
  readonly notAfter: UtcSecond;
  readonly maxTokenLifetimeSeconds: Counter;
  readonly maxBusinessTermSeconds?: Counter;
}

export interface DeniedKeyTrustSnapshot {
  readonly delegatedKeyId: KeyId;
  readonly effectiveAt: UtcSecond;
  readonly reasonCode: 1n | 2n | 3n;
}

export interface DenylistTrustSnapshot {
  readonly revision: Counter;
  readonly tokenId: OpaqueId;
  readonly tokenHash: Sha256;
  readonly deniedKeys: readonly DeniedKeyTrustSnapshot[];
}

export interface TrustedKey {
  readonly kid: KeyId;
  readonly spkiDer: ProtocolBytes;
  readonly purpose: Exclude<SignerPurpose, "PROD_ROOT">;
  readonly environment: Environment;
}

export interface TrustSnapshot {
  readonly environment: Environment;
  readonly roots: readonly RootAnchor[];
  readonly trustedKeys: readonly TrustedKey[];
  readonly delegations: readonly DelegationTrustSnapshot[];
  readonly denylist?: DenylistTrustSnapshot;
}

export interface BuildBindingSnapshot {
  readonly productVersion: string;
  readonly edition: Edition;
  readonly versionIdentitySha256: Sha256;
  readonly buildIdentitySha256: Sha256;
  readonly buildManifestSha256: Sha256;
  readonly physicallyPresentFeatures?: readonly Feature[];
  readonly codeReadyFeatures?: readonly Feature[];
  readonly externallyEnabledFeatures?: readonly Feature[];
}

export interface DeviceBindingSnapshot {
  /** Local installation identity; during Rebind this is the new key. */
  readonly installationId: OpaqueId;
  readonly deviceKeyId: KeyId;
  readonly devicePublicKey?: ProtocolBytes;
  readonly assurance: Assurance;
  readonly bindingRecoveryTokenId?: OpaqueId;
}

export interface ParentEntitlementSnapshot {
  readonly tokenId: OpaqueId;
  readonly tokenHash: Sha256;
  readonly generation: Counter;
  readonly edition: Edition;
  readonly licenseId: OpaqueId;
  readonly activationId: OpaqueId;
  readonly installationId: OpaqueId;
  readonly deviceKeyId: KeyId;
  readonly assurance: Assurance;
  readonly mode: "OFFLINE_BOUND" | "HYBRID_LEASED";
  readonly features: readonly Feature[];
  readonly notAfter: UtcSecond;
  readonly graceUntil: UtcSecond;
  readonly checkCadenceSeconds?: Counter;
  readonly offlineAllowanceSeconds?: Counter;
}

interface OutstandingRequestSnapshotCommon {
  readonly requestId: OpaqueId;
  readonly requestHash: Sha256;
  readonly requestNonce: Nonce256;
  readonly encodedRequest: ProtocolBytes;
  readonly challengeExpiresAt?: UtcSecond;
  readonly challengeConsumed: boolean;
  readonly sameBootElapsedSeconds?: Counter;
}

export type ActivationRequestPurpose = ActivationRequestPayload["requestPurpose"];
export type LeaseRequestPurpose = LeaseRequestPayload["requestPurpose"];
type OutstandingRequestPurpose = ActivationRequestPurpose | LeaseRequestPurpose;

type RequestPayloadForPurpose<Purpose extends OutstandingRequestPurpose> =
  Purpose extends LeaseRequestPurpose
    ? LeaseRequestPayload & Readonly<{
        tokenType: "lease-request";
        requestPurpose: Purpose;
      }>
    : ActivationRequestPayload & Readonly<{
        tokenType: "activation-request";
        requestPurpose: Purpose;
      }>;

/**
 * A persisted request snapshot whose token type and purpose are correlated with
 * the exact validated payload branch.  Keeping these fields as an uncorrelated
 * string/union would let callers construct internally impossible snapshots.
 */
export type OutstandingRequestSnapshot = {
  [Purpose in OutstandingRequestPurpose]: Readonly<
    OutstandingRequestSnapshotCommon & {
      tokenType: RequestPayloadForPurpose<Purpose>["tokenType"];
      requestPurpose: Purpose;
      payload: RequestPayloadForPurpose<Purpose>;
    }
  >;
}[OutstandingRequestPurpose];

export interface LicensingStateSnapshot {
  readonly stateGeneration: Counter;
  readonly entitlementGeneration: Counter;
  readonly leaseRevision: Counter;
  readonly controlRevision: Counter;
  readonly controlState: ControlState;
  readonly controlEffectiveAt: UtcSecond;
  readonly controlReasonCode: Counter;
  readonly timeCorrectionRevision: Counter;
  readonly clockHighWater: UtcSecond;
  readonly activeIncidentId?: OpaqueId;
  readonly activeIncidentNonce?: Nonce256;
  readonly terminallyRevoked: boolean;
  readonly acceptedTokenIds?: readonly Readonly<{
    tokenId: OpaqueId;
    tokenHash: Sha256;
  }>[];
}

export type VerificationWorkflow =
  | "ECSREQ_FILE"
  | "ECSLIC_FILE"
  | "ECSCTL_FILE"
  | "ECSREC_FILE"
  | "ECSTRUST_FILE"
  | "SIGNED_APPLICATION_UPDATE"
  | "VENDOR_HTTPS_REQUEST"
  | "VENDOR_HTTPS_RESPONSE";

export interface VerificationContext {
  readonly expectedTokenType: SignedTokenType;
  readonly workflow: VerificationWorkflow;
  readonly trust: TrustSnapshot;
  readonly trustedNow?: UtcSecond;
  readonly vendorUtc?: UtcSecond;
  readonly build?: BuildBindingSnapshot;
  readonly device?: DeviceBindingSnapshot;
  /** Sealed active binding before Rebind, including an earlier durable override.
   * If absent, the parent Entitlement supplies the original binding. */
  readonly previousDevice?: DeviceBindingSnapshot;
  readonly parent?: ParentEntitlementSnapshot;
  readonly request?: OutstandingRequestSnapshot;
  readonly state?: LicensingStateSnapshot;
}

export interface VerificationDigests {
  readonly inputSha256: Sha256;
  readonly protectedSha256?: Sha256;
  readonly payloadSha256?: Sha256;
  readonly sigStructureSha256?: Sha256;
  readonly signatureSha256?: Sha256;
}

export interface VerificationSuccess<T> {
  readonly ok: true;
  readonly decision: "ACCEPT";
  readonly stage: "COMPLETE";
  readonly value: T;
  readonly digests: VerificationDigests;
  readonly signerKeyId?: KeyId;
  readonly authoritativeStateChanged: false;
  readonly requestConsumed: false;
}

export interface VerificationFailure {
  readonly ok: false;
  readonly decision: "REJECT";
  readonly stage: VerificationStage;
  readonly errorCode: VerificationErrorCode;
  readonly path?: string;
  readonly digests?: Partial<VerificationDigests>;
  readonly authoritativeStateChanged: false;
  readonly requestConsumed: false;
}

/** Verification is immutable preflight only; admission and persistence are later work. */
export type VerificationResult<T> = VerificationSuccess<T> | VerificationFailure;
