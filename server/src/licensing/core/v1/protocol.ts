/**
 * Generated, self-contained snapshot of licensing/protocol/v1/protocol-registry.json.
 *
 * Source registry SHA-256: 7fdd11c595f017ef2937203553e50594e1615b0ff97d922f488e57626a3d714c
 * Frozen package SHA-256:  512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab
 *
 * Runtime verification must never read a caller-selected registry or schema.
 */

import type { CarrierType, Edition, Feature, SignedTokenType, SignerPurpose } from "./types";

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export const PROTOCOL_MANIFEST_SHA256 =
  "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab" as const;
export const PROTOCOL_REGISTRY_SHA256 =
  "7fdd11c595f017ef2937203553e50594e1615b0ff97d922f488e57626a3d714c" as const;
/** Compatibility aliases that make the pinning intent explicit at call sites. */
export const FROZEN_PROTOCOL_MANIFEST_SHA256 = PROTOCOL_MANIFEST_SHA256;
export const FROZEN_PROTOCOL_REGISTRY_SHA256 = PROTOCOL_REGISTRY_SHA256;
export const PROTOCOL_SCHEMA_VERSION = 1 as const;
export const PROTOCOL_VERSION = 1 as const;
export const PRODUCT_ID = "ENTRY_CONTROL_SYSTEM" as const;

export const SECURITY_PROFILE = deepFreeze({
  cbor: {
    profile: "RFC8949_CORE_DETERMINISTIC",
    signedObjectTag: 18,
    signedObjectTagRequired: true,
    payloadMapKeyType: "TEXT",
    payloadMapsClosed: true,
    rejectDuplicateMapKeys: true,
    rejectFloats: true,
    rejectIndefiniteLengthItems: true,
    rejectMalformedUtf8: true,
    rejectNonMinimalEncoding: true,
    rejectNull: true,
    rejectTrailingData: true,
    rejectUnknownFields: true,
  },
  coseSign1: {
    algorithm: "ES256",
    algorithmCoseId: -7,
    curve: "P-256",
    digest: "SHA-256",
    externalAad: "EMPTY_BYTE_STRING",
    payloadMode: "EMBEDDED",
    protectedHeaders: {
      1: -7,
      3: "EXACT_MESSAGE_MEDIA_TYPE",
      4: "SIGNER_KEY_ID_BSTR_32",
    },
    protectedHeadersExact: true,
    signatureBytes: 64,
    signatureEncoding: "IEEE_P1363_R_CONCAT_S",
    unprotectedHeaders: {},
    unprotectedHeadersExact: true,
  },
  ecdsa: {
    lowSRequired: true,
    p256OrderHex: "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
    p256HalfOrderHex: "7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8",
    rBytes: 32,
    rMinimum: 1n,
    rRange: "1..P256_ORDER_MINUS_1",
    sBytes: 32,
    sMinimum: 1n,
    sRange: "1..P256_HALF_ORDER",
  },
  installationPublicKey: {
    algorithmOid: "1.2.840.10045.2.1",
    curveOid: "1.2.840.10045.3.1.7",
    encoding: "RFC5480_SUBJECT_PUBLIC_KEY_INFO_DER",
    pointEncoding: "UNCOMPRESSED",
    spkiDerBytes: 91,
  },
  tpmEvidenceContext: {
    digest: "SHA-256",
    domain: "ENTRY_CONTROL_SYSTEM:LICENSE:TPM_ATTESTATION_CONTEXT:V1",
    encoding: "RFC8949_CORE_DETERMINISTIC_CBOR_ARRAY",
    orderedItems: [
      "domain-tstr",
      "requestId-bstr16",
      "requestNonce-bstr32",
      "installationId-bstr16",
      "deviceKeyId-bstr32",
      "versionIdentitySha256-bstr32",
      "buildIdentitySha256-bstr32",
      "buildManifestSha256-bstr32",
    ],
  },
  crossTypeAcceptance: "REJECT",
  payloadKeyIdMustEqualProtectedKid: true,
} as const);

export const LIMITS = deepFreeze({
  counterMinimum: 0n,
  counterMaximum: 9_223_372_036_854_775_807n,
  denylistMaximumEntries: 4096,
  displayTextMaximumUtf8Bytes: 256,
  featureMinimumItems: 1,
  featureMaximumItems: 23,
  hashBytes: 32,
  identifierBytes: 16,
  keyIdBytes: 32,
  nonceBytes: 32,
  signatureBytes: 64,
  spkiDerBytes: 91,
  trustBundleMaximumDelegations: 64,
  timestampMinimum: 0n,
  timestampMaximum: 253_402_300_799n,
} as const);

export const ISSUER_POLICY_SECONDS = deepFreeze({
  businessTermMaximum: 31_622_400n,
  clockTolerance: 300n,
  entitlementEnvelopeMaximum: 35_424_000n,
  hybridCheckCadence: { minimum: 3_600n, default: 21_600n, maximum: 86_400n },
  hybridLeaseWindow: {
    minimumOperationalRemainingSecondsExclusive: 300n,
    nextCheckAtFormula: "min(serverTime+checkCadenceSeconds,offlineUntil-300)",
    offlineUntilFormula:
      "min(serverTime+parent.offlineAllowanceSeconds,entitlement.notAfter,entitlement.graceUntil)",
    shorteningPolicy: "PARENT_CAP_ONLY",
  },
  hybridOfflineAllowance: {
    minimum: 86_400n,
    default: 604_800n,
    maximum: 2_592_000n,
    minimumAdditionalSecondsBeyondCadence: 300n,
  },
  leaseEnvelopeMaximum: 2_592_000n,
  postTermGrace: { minimum: 0n, default: 259_200n, maximum: 604_800n },
  sameBootTimeRecoveryRoundTripMaximum: 300n,
  warningLead: { minimum: 0n, default: 604_800n, maximum: 2_592_000n },
} as const);

export const SIGNED_OBJECTS = deepFreeze([
  {
    registryOrder: 1,
    tokenType: "activation-request",
    mediaType: "application/vnd.entry-control.activation-request+cbor;v=1",
    schema: "schemas/activation-request.cddl",
    signerPurpose: "INSTALLATION_DEVICE",
    carriers: ["ECSREQ_FILE"],
    maxEncodedBytes: 131_072,
    lifetime: { basis: "notAfter-issuedAt", maximumSeconds: 2_592_000n },
  },
  {
    registryOrder: 2,
    tokenType: "lease-request",
    mediaType: "application/vnd.entry-control.lease-request+cbor;v=1",
    schema: "schemas/lease-request.cddl",
    signerPurpose: "INSTALLATION_DEVICE",
    carriers: ["VENDOR_HTTPS_REQUEST"],
    maxEncodedBytes: 8_192,
    lifetime: { basis: "one-time-vendor-challenge", challengeMaximumSeconds: 300n },
    http: {
      challengeMethod: "POST",
      challengePath: "/v1/licensing/lease-challenges",
      method: "POST",
      path: "/v1/licensing/leases",
    },
  },
  {
    registryOrder: 3,
    tokenType: "key-delegation",
    mediaType: "application/vnd.entry-control.key-delegation+cbor;v=1",
    schema: "schemas/key-delegation.cddl",
    signerPurpose: "PROD_ROOT",
    carriers: ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"],
    maxEncodedBytes: 8_192,
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 158_112_000n },
  },
  {
    registryOrder: 4,
    tokenType: "key-denylist",
    mediaType: "application/vnd.entry-control.key-denylist+cbor;v=1",
    schema: "schemas/key-denylist.cddl",
    signerPurpose: "PROD_ROOT",
    carriers: ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"],
    maxEncodedBytes: 262_144,
    maximumEntries: 4_096,
    lifetime: {
      basis: "notAfter-min(issuedAt,notBefore)",
      importWindowMaximumSeconds: 31_622_400n,
      acceptedStatePersistence: "INDEFINITE_AFTER_ACCEPTANCE",
    },
  },
  {
    registryOrder: 5,
    tokenType: "entitlement",
    mediaType: "application/vnd.entry-control.entitlement+cbor;v=1",
    schema: "schemas/entitlement.cddl",
    signerPurpose: "OFFLINE_ENTITLEMENT",
    carriers: ["ECSLIC_FILE"],
    maxEncodedBytes: 16_384,
    lifetime: {
      basis: "notAfter-min(issuedAt,notBefore)",
      maximumSeconds: 35_424_000n,
      businessTermMaximumSeconds: 31_622_400n,
    },
  },
  {
    registryOrder: 6,
    tokenType: "lease",
    mediaType: "application/vnd.entry-control.lease+cbor;v=1",
    schema: "schemas/lease.cddl",
    signerPurpose: "ONLINE_LEASE",
    carriers: ["VENDOR_HTTPS_RESPONSE"],
    maxEncodedBytes: 16_384,
    httpResponseFor: "/v1/licensing/leases",
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 2_592_000n },
  },
  {
    registryOrder: 7,
    tokenType: "offline-control",
    mediaType: "application/vnd.entry-control.offline-control+cbor;v=1",
    schema: "schemas/offline-control.cddl",
    signerPurpose: "OFFLINE_CONTROL",
    carriers: ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"],
    maxEncodedBytes: 8_192,
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 2_592_000n },
  },
  {
    registryOrder: 8,
    tokenType: "reactivation-authorization",
    mediaType: "application/vnd.entry-control.reactivation-authorization+cbor;v=1",
    schema: "schemas/reactivation-authorization.cddl",
    signerPurpose: "OFFLINE_CONTROL",
    carriers: ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"],
    maxEncodedBytes: 16_384,
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 604_800n },
  },
  {
    registryOrder: 9,
    tokenType: "recovery",
    mediaType: "application/vnd.entry-control.recovery+cbor;v=1",
    schema: "schemas/recovery.cddl",
    signerPurpose: "RECOVERY",
    carriers: ["ECSREC_FILE"],
    maxEncodedBytes: 16_384,
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 86_400n },
  },
  {
    registryOrder: 10,
    tokenType: "time-correction",
    mediaType: "application/vnd.entry-control.time-correction+cbor;v=1",
    schema: "schemas/time-correction.cddl",
    signerPurpose: "RECOVERY",
    carriers: ["ECSREC_FILE"],
    maxEncodedBytes: 8_192,
    lifetime: { basis: "notAfter-min(issuedAt,notBefore)", maximumSeconds: 86_400n },
  },
] as const);

export type SignedObjectContract = (typeof SIGNED_OBJECTS)[number];

export const SIGNED_OBJECT_BY_TYPE = deepFreeze(
  Object.fromEntries(SIGNED_OBJECTS.map((contract) => [contract.tokenType, contract])) as Record<
    SignedTokenType,
    SignedObjectContract
  >,
);

export const SIGNED_TOKEN_TYPES = deepFreeze(
  SIGNED_OBJECTS.map((contract) => contract.tokenType) as readonly SignedTokenType[],
);

export const SIGNER_PURPOSE_BY_TOKEN_TYPE = deepFreeze(
  Object.fromEntries(
    SIGNED_OBJECTS.map((contract) => [contract.tokenType, contract.signerPurpose]),
  ) as Record<SignedTokenType, SignerPurpose>,
);

export const CARRIER_CONTRACTS = deepFreeze([
  {
    carrierType: "lease-challenge",
    mediaType: "application/vnd.entry-control.lease-challenge+cbor;v=1",
    maxEncodedBytes: 4_096,
    schema: "schemas/lease-challenge-carrier.cddl",
  },
  {
    carrierType: "lease-response",
    mediaType: "application/vnd.entry-control.lease-response+cbor;v=1",
    maxEncodedBytes: 524_288,
    schema: "schemas/lease-response-carrier.cddl",
  },
  {
    carrierType: "trust-bundle",
    mediaType: "application/vnd.entry-control.trust-bundle+cbor;v=1",
    maxEncodedBytes: 1_048_576,
    schema: "schemas/trust-bundle-carrier.cddl",
  },
] as const);

export type CarrierContract = (typeof CARRIER_CONTRACTS)[number];

export const CARRIER_BY_TYPE = deepFreeze(
  Object.fromEntries(CARRIER_CONTRACTS.map((contract) => [contract.carrierType, contract])) as Record<
    CarrierType,
    CarrierContract
  >,
);

export const CARRIER_TYPES = deepFreeze(
  CARRIER_CONTRACTS.map((contract) => contract.carrierType) as readonly CarrierType[],
);

export const VENDOR_ENDPOINTS = deepFreeze({
  aliasesAllowed: false,
  pathComparison: "EXACT_ASCII_BYTES",
  pathIncludesAuthority: false,
  pathIncludesQuery: false,
  pathNormalizationAllowed: false,
  zeroRttAllowed: false,
  leaseChallenge: {
    aliases: [],
    method: "POST",
    path: "/v1/licensing/lease-challenges",
    responseCarrierType: "lease-challenge",
    responseMediaType: "application/vnd.entry-control.lease-challenge+cbor;v=1",
    responseSchema: "schemas/lease-challenge-carrier.cddl",
    maxResponseBytes: 4_096,
  },
  leaseIssuance: {
    aliases: [],
    method: "POST",
    path: "/v1/licensing/leases",
    requestTokenType: "lease-request",
    requestMediaType: "application/vnd.entry-control.lease-request+cbor;v=1",
    responseTokenType: "lease",
    responseCarrierType: "lease-response",
    responseMediaType: "application/vnd.entry-control.lease-response+cbor;v=1",
    responseSchema: "schemas/lease-response-carrier.cddl",
    maxResponseBytes: 524_288,
  },
} as const);

export const WORKFLOW_CARRIERS = deepFreeze([
  { id: "ECSCTL_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecsctl", kind: "FILE", tokenTypes: ["offline-control", "reactivation-authorization"] },
  { id: "ECSLIC_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecslic", kind: "FILE", tokenTypes: ["entitlement"] },
  { id: "ECSREC_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecsrec", kind: "FILE", tokenTypes: ["recovery", "time-correction"] },
  { id: "ECSREQ_FILE", direction: "INSTALLATION_TO_VENDOR", extension: ".ecsreq", kind: "FILE", tokenTypes: ["activation-request"] },
  { id: "ECSTRUST_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecstrust", kind: "FILE", tokenTypes: ["key-delegation", "key-denylist"], mediaType: "application/vnd.entry-control.trust-bundle+cbor;v=1", maxEncodedBytes: 1_048_576 },
  { id: "SIGNED_APPLICATION_UPDATE", direction: "VENDOR_TO_INSTALLATION", kind: "SIGNED_UPDATE", tokenTypes: ["key-delegation", "key-denylist"] },
  { id: "VENDOR_HTTPS_REQUEST", direction: "INSTALLATION_TO_VENDOR", kind: "HTTPS_REQUEST", tokenTypes: ["lease-request"], mediaType: "application/vnd.entry-control.lease-request+cbor;v=1" },
  { id: "VENDOR_HTTPS_RESPONSE", direction: "VENDOR_TO_INSTALLATION", kind: "HTTPS_RESPONSE", tokenTypes: ["key-delegation", "key-denylist", "lease", "offline-control", "reactivation-authorization"], mediaType: "application/vnd.entry-control.lease-response+cbor;v=1", maxEncodedBytes: 524_288 },
] as const);

export const SIGNER_PURPOSES = deepFreeze([
  { purpose: "INSTALLATION_DEVICE", authority: "INSTALLATION", maySign: ["activation-request", "lease-request"] },
  { purpose: "OFFLINE_CONTROL", authority: "VENDOR_OFFLINE", maySign: ["offline-control", "reactivation-authorization"] },
  { purpose: "OFFLINE_ENTITLEMENT", authority: "VENDOR_OFFLINE", maySign: ["entitlement"] },
  { purpose: "ONLINE_LEASE", authority: "VENDOR_ONLINE_HSM_KMS", maySign: ["lease"] },
  { purpose: "PROD_ROOT", authority: "VENDOR_OFFLINE_ROOT", maySign: ["key-delegation", "key-denylist"] },
  { purpose: "RECOVERY", authority: "VENDOR_SEPARATE_NORMALLY_OFFLINE", maySign: ["recovery", "time-correction"] },
] as const satisfies readonly Readonly<{
  purpose: SignerPurpose;
  authority: string;
  maySign: readonly SignedTokenType[];
}>[]);

export const FEATURES = deepFreeze([
  "ADMIN_USERS",
  "ATTENDANCE_COMPLIANCE",
  "ATTENDANCE_DAILY",
  "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_REPORTS",
  "AUDIT_LOGS",
  "AUTH",
  "BACKUPS",
  "CUSTOMERS",
  "CUSTOMER_PAYMENTS",
  "DEVICES",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
  "EMPLOYEES",
  "ENTRY_LOGS",
  "EXPENSES",
  "FINANCIAL_REPORTS",
  "INBOX",
  "MEMBERSHIPS",
  "PAYROLL",
  "SOUNDS",
  "STAFF_GROUPS",
] as const satisfies readonly Feature[]);

export const EDITION_ALLOWED_FEATURES = deepFreeze({
  ATTENDANCE: [
    "ADMIN_USERS",
    "ATTENDANCE_COMPLIANCE",
    "ATTENDANCE_DAILY",
    "ATTENDANCE_DASHBOARD",
    "ATTENDANCE_EXPORT",
    "ATTENDANCE_REPORTS",
    "AUDIT_LOGS",
    "AUTH",
    "BACKUPS",
    "DEVICES",
    "DEVICE_DIAGNOSTICS",
    "DOOR_CONTROL",
    "EMPLOYEES",
    "ENTRY_LOGS",
    "INBOX",
    "SOUNDS",
    "STAFF_GROUPS",
  ],
  FULL: FEATURES,
} as const satisfies Record<Edition, readonly Feature[]>);

export const NEVER_LICENSE_ACTIVATABLE_FEATURES = deepFreeze([
  "GENERIC_DEVICE_PUSH",
  "ICLOCK_ADMS",
] as const);

export const FEATURE_POLICY = deepFreeze({
  encoding: "TEXT_ARRAY",
  ordering: "STRICT_ASCII_CODE_POINT",
  rejectDuplicates: true,
  rejectUnknown: true,
  editionDisallowedClaimPolicy: "REJECT_OBJECT",
  effectiveIntersection: [
    "SIGNED_ENTITLEMENT",
    "SELECTED_EDITION",
    "PHYSICALLY_PRESENT_ARTIFACT",
    "SERVER_CODE_READY_REGISTRY",
    "EXTERNAL_OPTIONAL_FLAG",
  ],
} as const);

export const ORDERING_RULES = deepFreeze({
  features: { comparison: "ASCII_CODE_POINT", duplicates: "REJECT" },
  denylistEntries: {
    comparison: "UNSIGNED_BYTE_LEXICOGRAPHIC",
    duplicates: "REJECT",
    sortKey: "delegatedKeyId",
  },
  trustBundleDelegations: {
    comparison: "UNSIGNED_BYTE_LEXICOGRAPHIC",
    duplicates: "REJECT",
    sortKey: "delegatedKeyId",
  },
} as const);

export const REASON_CODES = deepFreeze({
  control: {
    NONE: 0,
    COMMERCIAL: 1,
    CUSTOMER_REQUEST: 2,
    SECURITY: 3,
    POLICY: 4,
    ADMINISTRATIVE: 5,
  },
  keyDenylist: {
    KEY_COMPROMISE: 1,
    KEY_RETIRED: 2,
    KEY_MISISSUANCE: 3,
  },
  recovery: {
    STATE_CORRUPTION: 1,
    ANCHOR_REPAIR: 2,
    KEY_LOSS: 3,
    TPM_RESET: 4,
    HARDWARE_REPLACEMENT: 5,
    OS_REINSTALL: 6,
    TAMPER_REMEDIATED: 7,
  },
  timeCorrection: {
    CLOCK_ROLLBACK: 1,
    CLOCK_FORWARD: 2,
  },
} as const);

export const BUILD_COMPATIBILITY = deepFreeze({
  comparison: "SEMVER_2_PRECEDENCE",
  minimumProductVersionEncoding: "CANONICAL_SEMVER_TEXT",
  minimumProductVersionInclusive: true,
  maximumMajorVersionInclusive: true,
  buildMetadataAffectsPrecedence: false,
  hashClaimEncoding: "BSTR_32",
  exactRequestHashClaims: [
    "versionIdentitySha256",
    "buildIdentitySha256",
    "buildManifestSha256",
  ],
} as const);

export const VALIDITY_POLICY = deepFreeze({
  activationRequest: {
    envelopeStart: "issuedAt",
    futureIssuedAtToleranceSeconds: 300n,
    issuedAtReference: "VENDOR_UTC",
    issuedAtMustPrecedeNotAfter: true,
    referenceMustPrecedeNotAfter: true,
  },
  vendorSignedObject: {
    envelopeStart: "MIN_ISSUED_AT_NOT_BEFORE",
    futureIssuedAtToleranceSeconds: 300n,
    issuedAtReference: "TRUSTED_NOW",
    issuedAtMustPrecedeNotAfter: true,
    notBeforeMustPrecedeNotAfter: true,
    trustedNowMustPrecedeNotAfterAtAdmission: true,
  },
  delegatedToken: {
    issuedAtWithinDelegation: true,
    validityWindowWithinDelegation: true,
  },
  offlineControl: { effectiveAtRelation: "notBefore<=effectiveAt<notAfter" },
  timeCorrection: {
    correctedUtcMustBeAtLeastPreIncidentHighWater: true,
    issuedAtMaximumAboveCorrectedUtcSeconds: 300n,
    issuedAtMustBeAtLeastPreIncidentHighWater: true,
    structuralWindowStillRequired: true,
    suspectWallClockAloneMayReject: false,
  },
  timeRecoveryLease: {
    issuedAtMustEqualServerTime: true,
    validityReference: "SIGNED_SERVER_TIME",
  },
} as const);

export const OFFLINE_CONTROL_ORIGINS = deepFreeze({
  REQUEST_BOUND: { requestBinding: "REQUIRED_CONTROL_ACTIVATION_REQUEST" },
  VENDOR_INITIATED: { requestBinding: "FORBIDDEN" },
} as const);

export const REQUEST_RESPONSE_COMPATIBILITY = deepFreeze([
  { requestTokenType: "activation-request", requestPurpose: "ACTIVATE", requestBoundResponseTokenTypes: ["entitlement"], responseConstraint: "INITIAL_ENTITLEMENT" },
  { requestTokenType: "activation-request", requestPurpose: "RENEW", requestBoundResponseTokenTypes: ["entitlement"], responseConstraint: "CHAINED_RENEWAL_ENTITLEMENT" },
  { requestTokenType: "activation-request", requestPurpose: "CONTROL", requestBoundResponseTokenTypes: ["offline-control"], responseConstraint: "REQUEST_BOUND_MATCHING_CONTROL" },
  { requestTokenType: "activation-request", requestPurpose: "RECOVER", requestBoundResponseTokenTypes: ["recovery"], responseConstraint: "CLEAR_OR_REPAIR_RECOVERY" },
  { requestTokenType: "activation-request", requestPurpose: "REBIND", requestBoundResponseTokenTypes: ["recovery"], responseConstraint: "DEVICE_REBIND_RECOVERY" },
  { requestTokenType: "activation-request", requestPurpose: "REACTIVATE", requestBoundResponseTokenTypes: ["reactivation-authorization", "entitlement"], responseConstraint: "ATOMIC_NEW_LINEAGE_PAIR" },
  { requestTokenType: "activation-request", requestPurpose: "TIME_CORRECT", requestBoundResponseTokenTypes: ["time-correction"], responseConstraint: "OFFLINE_TIME_CORRECTION" },
  { requestTokenType: "lease-request", requestPurpose: "CHECK_IN", requestBoundResponseTokenTypes: ["lease"], transportedAsyncTokenTypes: ["key-delegation", "key-denylist", "offline-control", "reactivation-authorization"], primaryResponseRequired: false, responseConstraint: "ORDINARY_HYBRID_LEASE" },
  { requestTokenType: "lease-request", requestPurpose: "TIME_RECOVERY", requestBoundResponseTokenTypes: ["lease"], transportedAsyncTokenTypes: ["offline-control", "reactivation-authorization"], forbiddenTransportedTokenTypes: ["key-delegation", "key-denylist"], primaryResponseRequired: true, responseConstraint: "SAME_BOOT_TIME_RECOVERY_LEASE" },
] as const);

export function exactMediaType(tokenType: SignedTokenType): string {
  return SIGNED_OBJECT_BY_TYPE[tokenType].mediaType;
}

export function signedObjectContract(tokenType: SignedTokenType): SignedObjectContract {
  return SIGNED_OBJECT_BY_TYPE[tokenType];
}

export function carrierContract(carrierType: CarrierType): CarrierContract {
  return CARRIER_BY_TYPE[carrierType];
}
