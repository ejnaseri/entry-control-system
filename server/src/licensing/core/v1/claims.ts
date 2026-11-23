import { bytesEqual, compareBytes } from "./bytes";
import {
  type LicenseCryptoV1,
  assertSpkiMatchesKid,
  isCanonicalP256Spki,
  sha256,
} from "./crypto";
import { failLicenseCore } from "./errors";
import {
  EDITION_ALLOWED_FEATURES,
  ISSUER_POLICY_SECONDS,
  REQUEST_RESPONSE_COMPATIBILITY,
  SECURITY_PROFILE,
} from "./protocol";
import { encodeDeterministicCborV1 } from "./strict-cbor";
import { isProductVersionCompatible, parseCanonicalSemVer } from "./semver";
import type {
  ActivationRequestPayload,
  DelegationTrustSnapshot,
  EntitlementPayload,
  Feature,
  KeyDelegationPayload,
  KeyDenylistPayload,
  LeasePayload,
  LicensingStateSnapshot,
  OfflineControlPayload,
  OutstandingRequestSnapshot,
  ReactivationAuthorizationPayload,
  RecoveryPayload,
  SignedPayloadByType,
  SignedTokenType,
  TimeCorrectionPayload,
  VerificationContext,
} from "./types";

function mutable(value: Readonly<Uint8Array>): Uint8Array {
  return new Uint8Array(value);
}

function sameBytes(left: Readonly<Uint8Array>, right: Readonly<Uint8Array>): boolean {
  return bytesEqual(mutable(left), mutable(right));
}

function requireSameBytes(
  left: Readonly<Uint8Array>,
  right: Readonly<Uint8Array>,
  code: string,
  message: string,
): void {
  if (!sameBytes(left, right)) failLicenseCore("CLAIMS", code, message);
}

function optionalBytesEqual(
  left: Readonly<Uint8Array> | undefined,
  right: Readonly<Uint8Array> | undefined,
): boolean {
  return left === undefined || right === undefined
    ? left === right
    : sameBytes(left, right);
}

function sameControlTuple(
  left: Readonly<{
    controlRevision: bigint;
    controlState: string;
    controlEffectiveAt: bigint;
    controlReasonCode: bigint;
  }>,
  right: Readonly<{
    controlRevision: bigint;
    controlState: string;
    controlEffectiveAt: bigint;
    controlReasonCode: bigint;
  }>,
): boolean {
  return left.controlRevision === right.controlRevision &&
    left.controlState === right.controlState &&
    left.controlEffectiveAt === right.controlEffectiveAt &&
    left.controlReasonCode === right.controlReasonCode;
}

function requireSameCounter(
  left: bigint,
  right: bigint,
  code: string,
  message: string,
): void {
  if (left !== right) failLicenseCore("CLAIMS", code, message);
}

function minimum(values: readonly bigint[]): bigint {
  const first = values[0];
  if (first === undefined) throw new TypeError("minimum requires at least one value.");
  return values.slice(1).reduce((result, value) => (value < result ? value : result), first);
}

function hasVendorWindow(payload: object): payload is {
  readonly issuedAt: bigint;
  readonly notBefore: bigint;
  readonly notAfter: bigint;
} {
  return "issuedAt" in payload && "notBefore" in payload && "notAfter" in payload;
}

function envelopeCode(type: SignedTokenType): string {
  switch (type) {
    case "key-delegation":
      return "DELEGATION_LIFETIME_TOO_LONG";
    case "key-denylist":
      return "DENYLIST_LIFETIME_TOO_LONG";
    case "entitlement":
      return "ENTITLEMENT_ENVELOPE_TOO_LONG";
    case "lease":
      return "LEASE_ENVELOPE_TOO_LONG";
    case "offline-control":
      return "CONTROL_ENVELOPE_TOO_LONG";
    case "reactivation-authorization":
      return "REACTIVATION_LIFETIME_TOO_LONG";
    case "recovery":
      return "RECOVERY_LIFETIME_TOO_LONG";
    case "time-correction":
      return "TIME_CORRECTION_LIFETIME_TOO_LONG";
    default:
      return "TOKEN_LIFETIME_TOO_LONG";
  }
}

function lifetimeMaximum(type: SignedTokenType): bigint | undefined {
  switch (type) {
    case "activation-request":
      return 2_592_000n;
    case "key-delegation":
      return 158_112_000n;
    case "key-denylist":
      return 31_622_400n;
    case "entitlement":
      return 35_424_000n;
    case "lease":
    case "offline-control":
      return 2_592_000n;
    case "reactivation-authorization":
      return 604_800n;
    case "recovery":
    case "time-correction":
      return 86_400n;
    case "lease-request":
      return undefined;
  }
}

function assertGenericTimeClaims<T extends SignedTokenType>(
  type: T,
  payload: SignedPayloadByType[T],
  context: VerificationContext,
): boolean {
  if (type === "activation-request") {
    const request = payload as SignedPayloadByType["activation-request"];
    if (request.issuedAt >= request.notAfter) {
      failLicenseCore("CLAIMS", "TOKEN_TIME_ORDER_INVALID", "Request issuedAt must precede notAfter.");
    }
    if (request.notAfter - request.issuedAt > 2_592_000n) {
      failLicenseCore("CLAIMS", "REQUEST_LIFETIME_TOO_LONG", "Activation request exceeds 30 days.");
    }
    if (context.vendorUtc !== undefined) {
      if (request.issuedAt > context.vendorUtc + ISSUER_POLICY_SECONDS.clockTolerance) {
        failLicenseCore(
          "CLAIMS",
          "ISSUED_AT_TOO_FAR_IN_FUTURE",
          "Activation request issuedAt is beyond Vendor UTC tolerance.",
        );
      }
      if (context.vendorUtc >= request.notAfter) {
        failLicenseCore("CLAIMS", "ACTIVATION_REQUEST_EXPIRED", "Activation request has expired.");
      }
    }
    return false;
  }
  if (type === "lease-request") return false;
  if (type === "entitlement") {
    const entitlement = payload as SignedPayloadByType["entitlement"];
    if (
      entitlement.termEndsAt === 253_402_300_799n ||
      entitlement.notAfter === 253_402_300_799n
    ) {
      failLicenseCore(
        "CLAIMS",
        "PERPETUAL_ENTITLEMENT_FORBIDDEN",
        "Perpetual/sentinel entitlement times are forbidden.",
      );
    }
  }
  if (!hasVendorWindow(payload)) throw new TypeError(`Missing Vendor validity window for ${type}.`);
  if (payload.notBefore >= payload.notAfter || payload.issuedAt >= payload.notAfter) {
    failLicenseCore(
      "CLAIMS",
      "TOKEN_TIME_ORDER_INVALID",
      "Vendor token validity fields do not form a half-open finite interval.",
    );
  }
  const maximum = lifetimeMaximum(type);
  const envelopeStart = payload.issuedAt < payload.notBefore ? payload.issuedAt : payload.notBefore;
  if (maximum !== undefined && payload.notAfter - envelopeStart > maximum) {
    failLicenseCore("CLAIMS", envelopeCode(type), "Vendor token envelope exceeds its v1 maximum.");
  }

  // Time Correction and same-boot Time Recovery have their own signed time
  // references; suspect wall-clock time alone must not reject them.
  const timeRecoveryLease =
    type === "lease" && context.request?.requestPurpose === "TIME_RECOVERY";
  const signedReference =
    type === "time-correction"
      ? (payload as SignedPayloadByType["time-correction"]).correctedUtc
      : timeRecoveryLease
        ? (payload as SignedPayloadByType["lease"]).serverTime
        : undefined;
  const admissionTime = signedReference ?? context.trustedNow;
  if (admissionTime !== undefined) {
    if (payload.issuedAt > admissionTime + ISSUER_POLICY_SECONDS.clockTolerance) {
      failLicenseCore(
        "CLAIMS",
        type === "time-correction"
          ? "TIME_CORRECTION_ISSUED_AT_AFTER_CORRECTED_TOLERANCE"
          : "ISSUED_AT_TOO_FAR_IN_FUTURE",
        "Vendor token issuedAt is beyond trusted-time tolerance.",
      );
    }
    if (admissionTime >= payload.notAfter) {
      failLicenseCore("CLAIMS", "TOKEN_EXPIRED_AT_ADMISSION", "Vendor token is expired.");
    }
  }
  return admissionTime !== undefined && admissionTime < payload.notBefore;
}

function assertEditionFeatures(edition: "FULL" | "ATTENDANCE", features: readonly Feature[]): void {
  const allowed: readonly string[] = EDITION_ALLOWED_FEATURES[edition];
  if (features.some((feature) => !allowed.includes(feature))) {
    failLicenseCore(
      "CLAIMS",
      "EDITION_FEATURE_MISMATCH",
      "Signed feature set is not allowed for the selected Edition.",
    );
  }
}

function assertBuildBinding<T extends SignedTokenType>(
  payload: SignedPayloadByType[T],
  context: VerificationContext,
): void {
  const build = context.build;
  if (!build) return;
  if ("edition" in payload && payload.edition !== build.edition) {
    failLicenseCore("CLAIMS", "EDITION_MISMATCH", "Signed Edition does not match the selected build.");
  }
  for (const field of [
    "versionIdentitySha256",
    "buildIdentitySha256",
    "buildManifestSha256",
  ] as const) {
    if (field in payload) {
      const signedHash = (payload as unknown as Record<typeof field, Readonly<Uint8Array>>)[field];
      if (sameBytes(signedHash, build[field])) continue;
      failLicenseCore("CLAIMS", "BUILD_BINDING_MISMATCH", `Build binding ${field} does not match.`);
    }
  }
  if (payload.tokenType === "entitlement") {
    let compatible = false;
    try {
      compatible = isProductVersionCompatible(
        build.productVersion,
        payload.minimumProductVersion,
        payload.maximumMajorVersion,
      );
    } catch {
      failLicenseCore(
        "CLAIMS",
        "BUILD_COMPATIBILITY_RANGE_INVALID",
        "Entitlement version range is not canonical.",
      );
    }
    if (!compatible) {
      failLicenseCore("CLAIMS", "BUILD_BINDING_MISMATCH", "Product version is outside License range.");
    }
  }
}

function assertPreviousRebindBinding(
  oldDeviceKeyId: Readonly<Uint8Array>,
  installationId: Readonly<Uint8Array>,
  context: VerificationContext,
  code: string,
): void {
  const previous = context.previousDevice ?? context.parent;
  if (!previous) return;
  requireSameBytes(oldDeviceKeyId, previous.deviceKeyId, code, "Rebind old key does not match the sealed previous binding.");
  requireSameBytes(installationId, previous.installationId, code, "Rebind previous binding belongs to another installation.");
}

function assertDeviceBinding<T extends SignedTokenType>(
  payload: SignedPayloadByType[T],
  context: VerificationContext,
): void {
  const device = context.device;
  if (!device) return;
  if ("installationId" in payload) {
    requireSameBytes(payload.installationId, device.installationId, "INSTALLATION_MISMATCH", "Installation id mismatch.");
  }
  const rebindRequest =
    payload.tokenType === "activation-request" && payload.requestPurpose === "REBIND";
  if ("deviceKeyId" in payload) {
    requireSameBytes(payload.deviceKeyId, device.deviceKeyId, "DEVICE_KEY_ID_MISMATCH", "Device key id mismatch.");
  }
  if (rebindRequest) {
    assertPreviousRebindBinding(
      payload.oldDeviceKeyId,
      payload.installationId,
      context,
      "DEVICE_KEY_ID_MISMATCH",
    );
    if (payload.bindingKind !== device.assurance) {
      failLicenseCore("CLAIMS", "DEVICE_ASSURANCE_MISMATCH", "Rebind request assurance differs from the local new binding.");
    }
  }
  if (payload.tokenType === "recovery" && payload.allowedTransition === "REBIND_DEVICE") {
    requireSameBytes(payload.newDeviceKeyId, device.deviceKeyId, "DEVICE_KEY_ID_MISMATCH", "Recovery new key does not match the local installation.");
    if (payload.newAssurance !== device.assurance) {
      failLicenseCore("CLAIMS", "DEVICE_ASSURANCE_MISMATCH", "Recovery assurance differs from the local new binding.");
    }
  }
  if ("assurance" in payload && payload.assurance !== device.assurance) {
    failLicenseCore("CLAIMS", "DEVICE_ASSURANCE_MISMATCH", "Device assurance mismatch.");
  }
  if (payload.tokenType === "lease" || payload.tokenType === "lease-request") {
    const signedOverride = payload.bindingRecoveryTokenId;
    const activeOverride = device.bindingRecoveryTokenId;
    if (activeOverride !== undefined && signedOverride === undefined) {
      failLicenseCore("CLAIMS", "REBIND_CHAIN_MISSING", "Binding Recovery reference mismatch.");
    }
    if (activeOverride === undefined && signedOverride !== undefined) {
      failLicenseCore("CLAIMS", "REBIND_CHAIN_UNEXPECTED", "Unexpected Binding Recovery reference.");
    }
    if (!optionalBytesEqual(signedOverride, activeOverride)) {
      failLicenseCore("CLAIMS", "REBIND_CHAIN_MISSING", "Binding Recovery reference mismatch.");
    }
  }
}

function requestHashCode(tokenType: SignedTokenType): string {
  switch (tokenType) {
    case "lease":
      return "LEASE_REQUEST_MISMATCH";
    case "offline-control":
      return "CONTROL_REQUEST_MISMATCH";
    case "reactivation-authorization":
      return "REACTIVATION_REQUEST_MISMATCH";
    case "recovery":
      return "RECOVERY_REQUEST_MISMATCH";
    case "time-correction":
      return "TIME_CORRECTION_REQUEST_MISMATCH";
    default:
      return "REQUEST_BINDING_MISMATCH";
  }
}

function assertOutstandingRequestIntegrity<T extends SignedTokenType>(input: Readonly<{
  payload: SignedPayloadByType[T];
  request: OutstandingRequestSnapshot | undefined;
  inputHash: Readonly<Uint8Array>;
  crypto: LicenseCryptoV1;
}>): void {
  const { request } = input;
  if (!request) return;
  const code = requestHashCode(input.payload.tokenType);
  const requestPayload = request.payload;
  if (
    request.tokenType !== requestPayload.tokenType ||
    request.requestPurpose !== requestPayload.requestPurpose
  ) {
    failLicenseCore("CLAIMS", code, "Outstanding request metadata is internally inconsistent.");
  }
  requireSameBytes(request.requestId, requestPayload.requestId, code, "Outstanding request id mismatch.");
  requireSameBytes(request.requestNonce, requestPayload.requestNonce, code, "Outstanding request nonce mismatch.");
  const encodedHash = sha256(input.crypto, mutable(request.encodedRequest));
  requireSameBytes(encodedHash, request.requestHash, code, "Outstanding request bytes do not match its hash.");

  if (input.payload.tokenType === "activation-request" || input.payload.tokenType === "lease-request") {
    if (
      input.payload.tokenType !== request.tokenType ||
      input.payload.requestPurpose !== request.requestPurpose
    ) {
      failLicenseCore("CLAIMS", code, "Current request type or purpose differs from its snapshot.");
    }
    requireSameBytes(input.payload.requestId, request.requestId, code, "Current request id mismatch.");
    requireSameBytes(input.payload.requestNonce, request.requestNonce, code, "Current request nonce mismatch.");
    requireSameBytes(input.inputHash, request.requestHash, code, "Current signed request bytes differ from its snapshot.");
  }
}

function assertResponseIdentity(
  payload: Exclude<
    SignedPayloadByType[SignedTokenType],
    SignedPayloadByType["activation-request"] | SignedPayloadByType["lease-request"]
  >,
  request: OutstandingRequestSnapshot,
): void {
  const requestPayload = request.payload;
  const code = requestHashCode(payload.tokenType);

  if (request.tokenType !== requestPayload.tokenType || request.requestPurpose !== requestPayload.requestPurpose) {
    failLicenseCore("CLAIMS", code, "Outstanding request metadata is internally inconsistent.");
  }
  requireSameBytes(request.requestId, requestPayload.requestId, code, "Outstanding request id mismatch.");
  requireSameBytes(request.requestNonce, requestPayload.requestNonce, code, "Outstanding request nonce mismatch.");

  if ("edition" in payload && payload.edition !== requestPayload.edition) {
    failLicenseCore("CLAIMS", code, "Response Edition differs from its request.");
  }
  if ("installationId" in payload) {
    requireSameBytes(payload.installationId, requestPayload.installationId, code, "Response installation mismatch.");
  }
  if ("deviceKeyId" in payload) {
    requireSameBytes(payload.deviceKeyId, requestPayload.deviceKeyId, code, "Response device-key mismatch.");
  }
  if (
    payload.tokenType === "entitlement" &&
    requestPayload.tokenType === "activation-request" &&
    payload.assurance !== requestPayload.bindingKind
  ) {
    failLicenseCore("CLAIMS", code, "Entitlement assurance differs from its activation request.");
  }
}

function assertRequestBinding<T extends SignedTokenType>(
  payload: SignedPayloadByType[T],
  context: VerificationContext,
): void {
  const request = context.request;
  if (!request || payload.tokenType === "activation-request" || payload.tokenType === "lease-request") return;
  const relation = REQUEST_RESPONSE_COMPATIBILITY.find(
    (entry) =>
      entry.requestTokenType === request.tokenType && entry.requestPurpose === request.requestPurpose,
  );
  const allowed = relation?.requestBoundResponseTokenTypes as readonly string[] | undefined;
  if (!allowed?.includes(payload.tokenType)) {
    failLicenseCore(
      "CLAIMS",
      "RESPONSE_TYPE_FORBIDDEN_FOR_REQUEST_PURPOSE",
      "Response type is not allowed for the request purpose.",
    );
  }

  if (payload.tokenType === "lease") {
    requireSameBytes(payload.leaseRequestId, request.requestId, "LEASE_REQUEST_MISMATCH", "Lease request id mismatch.");
    requireSameBytes(payload.leaseRequestHash, request.requestHash, "LEASE_REQUEST_MISMATCH", "Lease request hash mismatch.");
  } else if ("requestId" in payload && "requestHash" in payload) {
    const code =
      payload.tokenType === "offline-control"
        ? "CONTROL_REQUEST_MISMATCH"
        : payload.tokenType === "reactivation-authorization"
          ? "REACTIVATION_REQUEST_MISMATCH"
          : payload.tokenType === "recovery"
            ? "RECOVERY_REQUEST_MISMATCH"
            : payload.tokenType === "time-correction"
              ? "TIME_CORRECTION_REQUEST_MISMATCH"
              : "REQUEST_BINDING_MISMATCH";
    requireSameBytes(payload.requestId, request.requestId, code, "Response request id mismatch.");
    requireSameBytes(payload.requestHash, request.requestHash, code, "Response request hash mismatch.");
  }

  const response = payload as Exclude<
    SignedPayloadByType[SignedTokenType],
    SignedPayloadByType["activation-request"] | SignedPayloadByType["lease-request"]
  >;
  assertResponseIdentity(response, request);
  const requestPayload = request.payload;

  if (payload.tokenType === "entitlement" && requestPayload.tokenType === "activation-request") {
    const code = "REQUEST_BINDING_MISMATCH";
    if (requestPayload.requestPurpose === "ACTIVATE") {
      if (payload.generation !== 1n || "previousTokenId" in payload || "reactivationAuthorizationId" in payload) {
        failLicenseCore("CLAIMS", code, "Initial Entitlement lineage does not match ACTIVATE.");
      }
    } else if (requestPayload.requestPurpose === "RENEW") {
      if (
        payload.generation !== requestPayload.entitlementGeneration + 1n ||
        !("previousTokenId" in payload) ||
        !sameBytes(payload.previousTokenId, requestPayload.entitlementTokenId) ||
        !sameBytes(payload.licenseId, requestPayload.licenseId) ||
        !sameBytes(payload.activationId, requestPayload.activationId)
      ) {
        failLicenseCore("CLAIMS", code, "Renewal Entitlement lineage does not match RENEW.");
      }
    } else if (requestPayload.requestPurpose === "REACTIVATE") {
      if (payload.generation !== 1n || !("reactivationAuthorizationId" in payload)) {
        failLicenseCore(
          "CLAIMS",
          "REACTIVATION_AUTHORIZATION_REQUIRED",
          "Reactivated Entitlement requires its authorization reference.",
        );
      }
    }
  } else if (payload.tokenType === "lease" && requestPayload.tokenType === "lease-request") {
    const code = "LEASE_REQUEST_MISMATCH";
    for (const pair of [
      [payload.licenseId, requestPayload.licenseId],
      [payload.activationId, requestPayload.activationId],
      [payload.entitlementTokenId, requestPayload.entitlementTokenId],
      [payload.versionIdentitySha256, requestPayload.versionIdentitySha256],
      [payload.buildIdentitySha256, requestPayload.buildIdentitySha256],
      [payload.buildManifestSha256, requestPayload.buildManifestSha256],
    ] as const) {
      requireSameBytes(pair[0], pair[1], code, "Lease does not bind its exact Lease request.");
    }
    const controlIsOlder = payload.controlRevision < requestPayload.controlRevision;
    const equalControlDiffers =
      payload.controlRevision === requestPayload.controlRevision &&
      !sameControlTuple(payload, requestPayload);
    if (
      payload.entitlementGeneration !== requestPayload.entitlementGeneration ||
      payload.leaseRevision <= requestPayload.lastLeaseRevision ||
      controlIsOlder ||
      equalControlDiffers ||
      !optionalBytesEqual(payload.bindingRecoveryTokenId, requestPayload.bindingRecoveryTokenId)
    ) {
      failLicenseCore("CLAIMS", code, "Lease counters or Control tuple do not match its request.");
    }
    if (requestPayload.requestPurpose === "TIME_RECOVERY") {
      const elapsed = request.sameBootElapsedSeconds;
      if (typeof elapsed !== "bigint" || elapsed < 0n || elapsed > 300n) {
        failLicenseCore(
          "STATE",
          "TIME_RECOVERY_ROUND_TRIP_INVALID",
          "Time Recovery requires same-boot monotonic evidence within 300 seconds.",
        );
      }
      const sealedHighWater = context.state?.clockHighWater ?? requestPayload.preIncidentClockHighWater;
      if (
        payload.serverTime < requestPayload.preIncidentClockHighWater ||
        payload.serverTime < sealedHighWater
      ) {
        failLicenseCore(
          "CLAIMS",
          "TIME_RECOVERY_BELOW_HIGH_WATER",
          "Time Recovery serverTime is below the sealed pre-incident high-water.",
        );
      }
    }
  } else if (payload.tokenType === "offline-control" && requestPayload.tokenType === "activation-request") {
    if (
      requestPayload.requestPurpose !== "CONTROL" ||
      payload.origin !== "REQUEST_BOUND" ||
      !sameBytes(payload.licenseId, requestPayload.licenseId) ||
      !sameBytes(payload.activationId, requestPayload.activationId) ||
      payload.action !== requestPayload.controlAction ||
      payload.effectiveAt !== requestPayload.controlEffectiveAt ||
      payload.reasonCode !== requestPayload.controlReasonCode ||
      payload.controlRevision <= requestPayload.controlRevision
    ) {
      failLicenseCore("CLAIMS", "CONTROL_REQUEST_MISMATCH", "Control does not match its request.");
    }
  } else if (payload.tokenType === "reactivation-authorization" && requestPayload.tokenType === "activation-request") {
    if (requestPayload.requestPurpose !== "REACTIVATE") {
      failLicenseCore("CLAIMS", "REACTIVATION_REQUEST_MISMATCH", "Reactivation purpose mismatch.");
    }
    if (
      !sameBytes(payload.revokedLicenseId, requestPayload.revokedLicenseId) ||
      !sameBytes(payload.revokedActivationId, requestPayload.revokedActivationId) ||
      !sameBytes(payload.finalRevokeTokenHash, requestPayload.finalRevokeTokenHash) ||
      payload.finalControlRevision !== requestPayload.finalControlRevision
    ) {
      failLicenseCore("CLAIMS", "REVOKED_LINEAGE_MISMATCH", "Reactivation final Revoke binding mismatch.");
    }
    if (
      !sameBytes(payload.incidentId, requestPayload.incidentId) ||
      !sameBytes(payload.incidentNonce, requestPayload.incidentNonce)
    ) {
      failLicenseCore("CLAIMS", "REACTIVATION_REQUEST_MISMATCH", "Reactivation incident mismatch.");
    }
  } else if (payload.tokenType === "recovery" && requestPayload.tokenType === "activation-request") {
    const rebind = requestPayload.requestPurpose === "REBIND";
    const recover = requestPayload.requestPurpose === "RECOVER";
    if (!rebind && !recover) {
      failLicenseCore("CLAIMS", "RECOVERY_REQUEST_MISMATCH", "Recovery purpose mismatch.");
    }
    if (
      !sameBytes(payload.licenseId, requestPayload.licenseId) ||
      !sameBytes(payload.activationId, requestPayload.activationId) ||
      !sameBytes(payload.incidentId, requestPayload.incidentId) ||
      !sameBytes(payload.incidentNonce, requestPayload.incidentNonce) ||
      payload.expectedStateGeneration !== requestPayload.stateGeneration ||
      payload.newStateGeneration !== requestPayload.stateGeneration + 1n ||
      !sameBytes(payload.entitlementTokenId, requestPayload.entitlementTokenId) ||
      !sameBytes(payload.entitlementTokenHash, requestPayload.entitlementTokenHash) ||
      payload.entitlementGeneration !== requestPayload.entitlementGeneration ||
      payload.controlRevision !== requestPayload.controlRevision
    ) {
      failLicenseCore("CLAIMS", "RECOVERY_INCIDENT_MISMATCH", "Recovery state/incident mismatch.");
    }
    if (
      (recover && !["CLEAR_TAMPER", "REPAIR_SECURE_STATE"].includes(payload.allowedTransition)) ||
      (rebind &&
        (payload.allowedTransition !== "REBIND_DEVICE" ||
          !sameBytes(payload.oldDeviceKeyId, requestPayload.oldDeviceKeyId) ||
          !sameBytes(payload.newDeviceKeyId, requestPayload.deviceKeyId) ||
          payload.newAssurance !== requestPayload.bindingKind))
    ) {
      failLicenseCore("CLAIMS", "RECOVERY_REQUEST_MISMATCH", "Recovery transition mismatch.");
    }
  } else if (payload.tokenType === "time-correction" && requestPayload.tokenType === "activation-request") {
    if (
      requestPayload.requestPurpose !== "TIME_CORRECT" ||
      !sameBytes(payload.licenseId, requestPayload.licenseId) ||
      !sameBytes(payload.activationId, requestPayload.activationId) ||
      !sameBytes(payload.incidentId, requestPayload.incidentId) ||
      !sameBytes(payload.incidentNonce, requestPayload.incidentNonce) ||
      payload.preIncidentClockHighWater !== requestPayload.preIncidentClockHighWater ||
      payload.expectedStateGeneration !== requestPayload.stateGeneration ||
      payload.newStateGeneration !== requestPayload.stateGeneration + 1n ||
      payload.timeCorrectionRevision !== requestPayload.timeCorrectionRevision + 1n
    ) {
      failLicenseCore("CLAIMS", "TIME_CORRECTION_INCIDENT_MISMATCH", "Time Correction incident mismatch.");
    }
  }
}

function assertActivationClaims(
  payload: ActivationRequestPayload,
  crypto: LicenseCryptoV1,
): void {
  assertSpkiMatchesKid(crypto, mutable(payload.devicePublicKey), mutable(payload.deviceKeyId), {
    stage: "CLAIMS",
    code: "DEVICE_KEY_ID_MISMATCH",
  });
  requireSameBytes(payload.keyId, payload.deviceKeyId, "DEVICE_KEY_ID_MISMATCH", "Request signer and device key differ.");
  if (payload.bindingKind === "TPM_ATTESTED") {
    const context = encodeDeterministicCborV1([
      SECURITY_PROFILE.tpmEvidenceContext.domain,
      mutable(payload.requestId),
      mutable(payload.requestNonce),
      mutable(payload.installationId),
      mutable(payload.deviceKeyId),
      mutable(payload.versionIdentitySha256),
      mutable(payload.buildIdentitySha256),
      mutable(payload.buildManifestSha256),
    ]);
    if (!sameBytes(sha256(crypto, context), payload.tpmEvidence.contextHash)) {
      failLicenseCore("CLAIMS", "TPM_CONTEXT_MISMATCH", "TPM evidence context hash mismatch.");
    }
  }
}

function assertDelegationClaims(
  payload: KeyDelegationPayload,
  crypto: LicenseCryptoV1,
): void {
  if (!isCanonicalP256Spki(mutable(payload.delegatedPublicKey))) {
    failLicenseCore("CLAIMS", "NON_CANONICAL_SPKI", "Delegated SPKI is not canonical P-256 DER.");
  }
  assertSpkiMatchesKid(crypto, mutable(payload.delegatedPublicKey), mutable(payload.delegatedKeyId), {
    stage: "CLAIMS",
    code: "DELEGATED_KEY_ID_MISMATCH",
  });
}

function assertDenylistClaims(payload: KeyDenylistPayload): void {
  let previous: Readonly<Uint8Array> | undefined;
  for (const entry of payload.deniedKeys) {
    if (previous && compareBytes(mutable(previous), mutable(entry.delegatedKeyId)) >= 0) {
      failLicenseCore(
        "CLAIMS",
        "DENYLIST_ENTRY_ORDER_INVALID",
        "Denied keys are not in strict unsigned-byte order.",
      );
    }
    previous = entry.delegatedKeyId;
  }
}

function assertEntitlementClaims(payload: EntitlementPayload, context: VerificationContext): void {
  if (
    payload.notBefore > payload.termStartsAt ||
    payload.termStartsAt >= payload.termEndsAt ||
    payload.termEndsAt > payload.graceUntil ||
    payload.warningStartsAt < payload.termStartsAt ||
    payload.graceUntil > payload.notAfter
  ) {
    failLicenseCore("CLAIMS", "ENTITLEMENT_TIME_ORDER", "Entitlement time order is invalid.");
  }
  if (payload.termEndsAt - payload.termStartsAt > ISSUER_POLICY_SECONDS.businessTermMaximum) {
    failLicenseCore("CLAIMS", "TERM_TOO_LONG", "Entitlement term exceeds the finite maximum.");
  }
  if (payload.warningStartsAt !== payload.termEndsAt - payload.warningLeadSeconds) {
    failLicenseCore("CLAIMS", "WARNING_POLICY_MISMATCH", "warningStartsAt formula mismatch.");
  }
  if (payload.graceUntil !== payload.termEndsAt + payload.graceSeconds) {
    failLicenseCore("CLAIMS", "GRACE_POLICY_MISMATCH", "graceUntil formula mismatch.");
  }
  if (payload.mode === "HYBRID_LEASED") {
    if (payload.offlineAllowanceSeconds < payload.checkCadenceSeconds + payload.clockToleranceSeconds) {
      failLicenseCore("CLAIMS", "HYBRID_POLICY_MARGIN", "Hybrid policy has no retry margin.");
    }
  }
  assertEditionFeatures(payload.edition, payload.features);
  const minimumVersion = parseCanonicalSemVer(payload.minimumProductVersion);
  if (minimumVersion.major > payload.maximumMajorVersion) {
    failLicenseCore(
      "CLAIMS",
      "BUILD_COMPATIBILITY_RANGE_INVALID",
      "minimumProductVersion major exceeds maximumMajorVersion.",
    );
  }
  if (payload.generation === 1n && context.request?.requestPurpose === "REACTIVATE") {
    if (!("reactivationAuthorizationId" in payload)) {
      failLicenseCore(
        "CLAIMS",
        "REACTIVATION_AUTHORIZATION_REQUIRED",
        "Reactivated first generation requires its one-time authorization.",
      );
    }
  }
}

function assertLeaseClaims(payload: LeasePayload, context: VerificationContext): void {
  const timeRecovery = context.request?.requestPurpose === "TIME_RECOVERY";
  if (payload.issuedAt !== payload.serverTime) {
    failLicenseCore(
      "CLAIMS",
      timeRecovery ? "TIME_RECOVERY_ISSUED_AT_SERVER_TIME_MISMATCH" : "LEASE_TIME_ORDER",
      "Lease issuedAt must equal signed serverTime.",
    );
  }
  if (
    payload.serverTime < payload.notBefore ||
    payload.offlineUntil > payload.notAfter ||
    payload.offlineUntil <= payload.serverTime
  ) {
    failLicenseCore("CLAIMS", "LEASE_TIME_ORDER", "Lease offline window is invalid.");
  }
  if (payload.offlineUntil - payload.serverTime <= 300n) {
    failLicenseCore(
      "CLAIMS",
      "LEASE_OPERATIONAL_WINDOW_TOO_SHORT",
      "Lease must retain more than the tolerance window.",
    );
  }
  assertEditionFeatures(payload.edition, payload.features);
  const parent = context.parent;
  if (parent) {
    if (!sameBytes(payload.entitlementTokenId, parent.tokenId) || payload.entitlementGeneration !== parent.generation) {
      failLicenseCore("CLAIMS", "LEASE_PARENT_MISMATCH", "Lease parent token/generation mismatch.");
    }
    const directlyBound = payload.bindingRecoveryTokenId === undefined;
    if (
      payload.edition !== parent.edition ||
      !sameBytes(payload.licenseId, parent.licenseId) ||
      !sameBytes(payload.activationId, parent.activationId) ||
      !sameBytes(payload.installationId, parent.installationId) ||
      (directlyBound && !sameBytes(payload.deviceKeyId, parent.deviceKeyId)) ||
      (directlyBound && payload.assurance !== parent.assurance)
    ) {
      failLicenseCore("CLAIMS", "LEASE_PARENT_MISMATCH", "Lease widens or changes parent identity.");
    }
    if (payload.features.some((feature) => !parent.features.includes(feature))) {
      failLicenseCore("CLAIMS", "LEASE_FEATURES_WIDEN_PARENT", "Lease feature set widens parent.");
    }
    if (parent.mode !== "HYBRID_LEASED" || parent.offlineAllowanceSeconds === undefined) {
      failLicenseCore("CLAIMS", "LEASE_PARENT_MISMATCH", "Lease requires a Hybrid parent.");
    }
    if (payload.notAfter > parent.notAfter || payload.offlineUntil > parent.notAfter || payload.offlineUntil > parent.graceUntil) {
      failLicenseCore("CLAIMS", "LEASE_OUTLIVES_PARENT", "Lease outlives its Entitlement parent.");
    }
    if (payload.offlineUntil > payload.serverTime + parent.offlineAllowanceSeconds) {
      failLicenseCore("CLAIMS", "LEASE_ALLOWANCE_TOO_LONG", "Lease exceeds the parent offline allowance.");
    }
    const expectedOfflineUntil = minimum([
      payload.serverTime + parent.offlineAllowanceSeconds,
      parent.notAfter,
      parent.graceUntil,
    ]);
    if (payload.offlineUntil !== expectedOfflineUntil) {
      failLicenseCore(
        "CLAIMS",
        "LEASE_OFFLINE_UNTIL_FORMULA_MISMATCH",
        "Lease offlineUntil is not the exact parent-capped formula.",
      );
    }
  }
}

function assertOfflineControlClaims(payload: OfflineControlPayload): void {
  if (payload.effectiveAt < payload.notBefore || payload.effectiveAt >= payload.notAfter) {
    failLicenseCore(
      "CLAIMS",
      "CONTROL_EFFECTIVE_TIME_INVALID",
      "Control effectiveAt must be inside its half-open validity window.",
    );
  }
}

function assertReactivationClaims(payload: ReactivationAuthorizationPayload): void {
  if (
    sameBytes(payload.newLicenseId, payload.revokedLicenseId) ||
    sameBytes(payload.newActivationId, payload.revokedActivationId)
  ) {
    failLicenseCore("CLAIMS", "NEW_LINEAGE_REQUIRED", "Reactivation must create a new lineage.");
  }
  assertEditionFeatures(payload.edition, payload.maximumFeatures);
}

function assertRecoveryClaims(payload: RecoveryPayload, context: VerificationContext): void {
  if (payload.newStateGeneration !== payload.expectedStateGeneration + 1n) {
    failLicenseCore("CLAIMS", "STATE_GENERATION_MISMATCH", "Recovery state generation must advance once.");
  }
  assertEditionFeatures(payload.edition, payload.maximumFeatures);
  if (context.parent) {
    if (
      payload.edition !== context.parent.edition ||
      !sameBytes(payload.licenseId, context.parent.licenseId) ||
      !sameBytes(payload.activationId, context.parent.activationId) ||
      !sameBytes(payload.installationId, context.parent.installationId) ||
      !sameBytes(payload.entitlementTokenId, context.parent.tokenId) ||
      !sameBytes(payload.entitlementTokenHash, context.parent.tokenHash) ||
      payload.entitlementGeneration !== context.parent.generation
    ) {
      failLicenseCore("CLAIMS", "RECOVERY_INCIDENT_MISMATCH", "Recovery parent snapshot mismatch.");
    }
    if (payload.maximumFeatures.some((feature) => !context.parent?.features.includes(feature))) {
      failLicenseCore("CLAIMS", "RECOVERY_FEATURES_WIDENED", "Recovery widens current Features.");
    }
  }
  if (payload.allowedTransition === "REBIND_DEVICE") {
    assertPreviousRebindBinding(payload.oldDeviceKeyId, payload.installationId, context, "RECOVERY_INCIDENT_MISMATCH");
  }
  const state = context.state;
  if (state) {
    if (
      payload.expectedStateGeneration !== state.stateGeneration ||
      payload.entitlementGeneration !== state.entitlementGeneration ||
      payload.controlRevision !== state.controlRevision ||
      (state.activeIncidentId !== undefined && !sameBytes(payload.incidentId, state.activeIncidentId)) ||
      (state.activeIncidentNonce !== undefined && !sameBytes(payload.incidentNonce, state.activeIncidentNonce))
    ) {
      failLicenseCore("CLAIMS", "RECOVERY_INCIDENT_MISMATCH", "Recovery state snapshot mismatch.");
    }
    if (state.terminallyRevoked) {
      failLicenseCore("STATE", "TERMINAL_REVOCATION", "Recovery cannot revive a revoked lineage.");
    }
  }
}

function assertTimeCorrectionClaims(payload: TimeCorrectionPayload, context: VerificationContext): void {
  if (payload.newStateGeneration !== payload.expectedStateGeneration + 1n) {
    failLicenseCore("CLAIMS", "STATE_GENERATION_MISMATCH", "Time Correction state must advance once.");
  }
  if (
    payload.issuedAt < payload.preIncidentClockHighWater ||
    payload.correctedUtc < payload.preIncidentClockHighWater
  ) {
    failLicenseCore(
      "CLAIMS",
      "TIME_CORRECTION_BELOW_HIGH_WATER",
      "Time Correction cannot move below the pre-incident high-water.",
    );
  }
  if (payload.issuedAt > payload.correctedUtc + 300n) {
    failLicenseCore(
      "CLAIMS",
      "TIME_CORRECTION_ISSUED_AT_AFTER_CORRECTED_TOLERANCE",
      "Time Correction issuedAt exceeds corrected UTC tolerance.",
    );
  }
  const state = context.state;
  if (state) {
    if (payload.timeCorrectionRevision !== state.timeCorrectionRevision + 1n) {
      failLicenseCore(
        "STATE",
        "TIME_CORRECTION_REVISION_MISMATCH",
        "Time Correction revision must advance exactly once.",
      );
    }
    if (
      payload.expectedStateGeneration !== state.stateGeneration ||
      payload.preIncidentClockHighWater !== state.clockHighWater ||
      (state.activeIncidentId !== undefined && !sameBytes(payload.incidentId, state.activeIncidentId)) ||
      (state.activeIncidentNonce !== undefined && !sameBytes(payload.incidentNonce, state.activeIncidentNonce))
    ) {
      failLicenseCore("CLAIMS", "TIME_CORRECTION_INCIDENT_MISMATCH", "Incident state mismatch.");
    }
  }
}

function acceptedTokenHash(
  state: LicensingStateSnapshot,
  tokenId: Readonly<Uint8Array>,
): Readonly<Uint8Array> | undefined {
  return state.acceptedTokenIds?.find((entry) => sameBytes(entry.tokenId, tokenId))?.tokenHash;
}

function assertStatePreflight<T extends SignedTokenType>(
  payload: SignedPayloadByType[T],
  context: VerificationContext,
  inputHash: Readonly<Uint8Array>,
): void {
  const state = context.state;
  if (!state) return;
  if ("tokenId" in payload) {
    const acceptedHash = acceptedTokenHash(state, payload.tokenId);
    if (acceptedHash && !sameBytes(acceptedHash, inputHash)) {
      failLicenseCore("STATE", "TOKEN_ID_COLLISION", "Token id was accepted for different bytes.");
    }
  }
  if (payload.tokenType === "lease") {
    if (payload.leaseRevision < state.leaseRevision) {
      failLicenseCore("STATE", "LEASE_REVISION_ROLLBACK", "Lease revision is below high-water.");
    }
    if (payload.leaseRevision === state.leaseRevision && !acceptedTokenHash(state, payload.tokenId)) {
      failLicenseCore("STATE", "LEASE_REVISION_COLLISION", "Lease revision was reused.");
    }
    if (payload.controlRevision < state.controlRevision) {
      failLicenseCore("STATE", "CONTROL_REVISION_ROLLBACK", "Lease control revision is stale.");
    }
    if (
      payload.controlRevision === state.controlRevision &&
      !sameControlTuple(payload, state)
    ) {
      failLicenseCore("STATE", "CONTROL_REVISION_COLLISION", "Lease changed the sealed Control tuple at equal revision.");
    }
  }
  if (payload.tokenType === "offline-control") {
    if (payload.controlRevision < state.controlRevision) {
      failLicenseCore("STATE", "CONTROL_REVISION_ROLLBACK", "Control revision is below high-water.");
    }
    if (payload.controlRevision === state.controlRevision && !acceptedTokenHash(state, payload.tokenId)) {
      failLicenseCore("STATE", "CONTROL_REVISION_COLLISION", "Control revision was reused.");
    }
    if (state.terminallyRevoked && payload.action === "UNSUSPEND") {
      failLicenseCore("STATE", "TERMINAL_REVOCATION", "A revoked lineage cannot be unsuspended.");
    }
  }
  if (payload.tokenType === "recovery" && acceptedTokenHash(state, payload.tokenId)) {
    failLicenseCore("STATE", "RECOVERY_TOKEN_REPLAYED", "Recovery token is already consumed.");
  }
  if (payload.tokenType === "time-correction" && acceptedTokenHash(state, payload.tokenId)) {
    failLicenseCore("STATE", "TIME_CORRECTION_REPLAYED", "Time Correction token is already consumed.");
  }
}

function assertDelegationCeiling<T extends SignedTokenType>(
  type: T,
  payload: SignedPayloadByType[T],
  delegation: DelegationTrustSnapshot | undefined,
): void {
  if (!delegation || !hasVendorWindow(payload)) return;
  const envelopeStart = payload.issuedAt < payload.notBefore ? payload.issuedAt : payload.notBefore;
  if (payload.notAfter - envelopeStart > delegation.maxTokenLifetimeSeconds) {
    failLicenseCore("TRUST", "TOKEN_OUTSIDE_DELEGATION_VALIDITY", "Token exceeds delegated lifetime ceiling.");
  }
  if (
    type === "entitlement" &&
    delegation.maxBusinessTermSeconds !== undefined &&
    (payload as EntitlementPayload).termEndsAt - (payload as EntitlementPayload).termStartsAt >
      delegation.maxBusinessTermSeconds
  ) {
    failLicenseCore("CLAIMS", "TERM_TOO_LONG", "Entitlement exceeds delegated business-term ceiling.");
  }
}

export interface ClaimValidationResultV1 {
  readonly staged: boolean;
  readonly authorization: "PREFLIGHT_ONLY";
}

/** Validate intrinsic and caller-supplied contextual claims without mutation. */
export function validateClaimsV1<T extends SignedTokenType>(input: Readonly<{
  type: T;
  payload: SignedPayloadByType[T];
  context: VerificationContext;
  crypto: LicenseCryptoV1;
  inputHash: Readonly<Uint8Array>;
  delegation?: DelegationTrustSnapshot;
}>): ClaimValidationResultV1 {
  const staged = assertGenericTimeClaims(input.type, input.payload, input.context);
  assertBuildBinding(input.payload, input.context);
  assertDeviceBinding(input.payload, input.context);
  assertOutstandingRequestIntegrity({
    payload: input.payload,
    request: input.context.request,
    inputHash: input.inputHash,
    crypto: input.crypto,
  });
  assertRequestBinding(input.payload, input.context);
  assertDelegationCeiling(input.type, input.payload, input.delegation);

  switch (input.type) {
    case "activation-request":
      assertActivationClaims(input.payload as ActivationRequestPayload, input.crypto);
      break;
    case "key-delegation":
      assertDelegationClaims(input.payload as KeyDelegationPayload, input.crypto);
      break;
    case "key-denylist":
      assertDenylistClaims(input.payload as KeyDenylistPayload);
      break;
    case "entitlement":
      assertEntitlementClaims(input.payload as EntitlementPayload, input.context);
      break;
    case "lease":
      assertLeaseClaims(input.payload as LeasePayload, input.context);
      break;
    case "offline-control":
      assertOfflineControlClaims(input.payload as OfflineControlPayload);
      break;
    case "reactivation-authorization":
      assertReactivationClaims(input.payload as ReactivationAuthorizationPayload);
      break;
    case "recovery":
      assertRecoveryClaims(input.payload as RecoveryPayload, input.context);
      break;
    case "time-correction":
      assertTimeCorrectionClaims(input.payload as TimeCorrectionPayload, input.context);
      break;
    case "lease-request": {
      const request = input.context.request;
      if (request) {
        if (request.challengeConsumed) {
          failLicenseCore("STATE", "CHALLENGE_REPLAYED", "Lease challenge was already consumed.");
        }
        if (
          request.challengeExpiresAt !== undefined &&
          input.context.trustedNow !== undefined &&
          input.context.trustedNow >= request.challengeExpiresAt
        ) {
          failLicenseCore("STATE", "CHALLENGE_EXPIRED", "Lease challenge has expired.");
        }
      }
      break;
    }
  }
  assertStatePreflight(input.payload, input.context, input.inputHash);
  return Object.freeze({ staged, authorization: "PREFLIGHT_ONLY" });
}
