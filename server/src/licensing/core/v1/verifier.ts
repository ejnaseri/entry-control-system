import { bytesEqual, compareBytes, copyBytes, immutableDataView } from "./bytes";
import { validateClaimsV1 } from "./claims";
import { assertSpkiMatchesKid, type LicenseCryptoV1, sha256 } from "./crypto";
import { failLicenseCore, isLicenseCoreError } from "./errors";
import { carrierContract, signedObjectContract } from "./protocol";
import {
  decodeStrictCborV1,
  type StrictCborMapNodeV1,
  type StrictCborNodeV1,
} from "./strict-cbor";
import { parseCoseSign1V1 } from "./cose-sign1";
import {
  SchemaValidationError,
  validateCarrier,
  validateSignedPayload,
} from "./schemas";
import {
  assertSigningTrust,
  resolveSigningKey,
  type ResolvedSigningKeyV1,
} from "./trust";
import type {
  BuildBindingSnapshot,
  CarrierByType,
  CarrierType,
  DeviceBindingSnapshot,
  Environment,
  LeaseRequestPayload,
  LicensingStateSnapshot,
  OutstandingRequestSnapshot,
  ParentEntitlementSnapshot,
  ProtocolBytes,
  RootAnchor,
  SignedPayloadByType,
  SignedTokenType,
  TrustSnapshot,
  TrustedKey,
  UtcSecond,
  ValidatedCarrier,
  VerificationContext,
  VerificationDigests,
  VerificationFailure,
  VerificationResult,
} from "./types";

export interface LicenseVerifierConfigurationV1 {
  readonly crypto: LicenseCryptoV1;
  readonly environment: Environment;
  readonly roots?: readonly RootAnchor[];
  readonly trustedKeys?: readonly TrustedKey[];
  readonly delegations?: TrustSnapshot["delegations"];
  readonly denylist?: TrustSnapshot["denylist"];
}

export type SignedVerificationContextV1 = Partial<
  Omit<VerificationContext, "expectedTokenType" | "workflow" | "trust">
> &
  Readonly<{
    workflow?: VerificationContext["workflow"];
  }>;

export interface VerifySignedObjectRequestV1<T extends SignedTokenType> {
  /** Caller-selected contract. Dispatch from untrusted token data is forbidden. */
  readonly expectedType: T;
  readonly encoded: Uint8Array;
  readonly context?: SignedVerificationContextV1;
  /** Test/dispatch gates use one stable diagnostic for all ordered type pairs. */
  readonly crossType?: boolean;
}

export interface ValidatedLicenseArtifactV1<T extends SignedTokenType> {
  readonly type: T;
  readonly payload: SignedPayloadByType[T];
  readonly decoded: Readonly<Record<string, unknown>>;
  readonly encoded: Uint8Array;
  readonly staged: boolean;
  /** This core never changes effective authority by itself. */
  readonly authorization: "PREFLIGHT_ONLY";
}

export interface ParseCarrierRequestV1<T extends CarrierType> {
  readonly carrierType: T;
  readonly encoded: Uint8Array;
  /**
   * Parsing is transport-only. Embedded signed objects are deliberately not
   * trusted or request-bound by this operation.
   */
  readonly requestPurpose?: never;
}

type LeaseRequestSnapshotV1<Purpose extends LeaseRequestPayload["requestPurpose"]> = Readonly<
  Extract<
    OutstandingRequestSnapshot,
    { tokenType: "lease-request"; requestPurpose: Purpose }
  >
>;

type ResponseDeviceSnapshotV1 = Readonly<
  DeviceBindingSnapshot & { devicePublicKey: ProtocolBytes }
>;

interface LeaseResponseVerificationBindingsV1 {
  readonly build: BuildBindingSnapshot;
  readonly device: ResponseDeviceSnapshotV1;
  readonly parent: ParentEntitlementSnapshot;
  readonly state: LicensingStateSnapshot;
}

export type LeaseResponseVerificationContextV1 =
  | Readonly<
      LeaseResponseVerificationBindingsV1 & {
        request: LeaseRequestSnapshotV1<"CHECK_IN">;
        trustedNow: UtcSecond;
      }
    >
  | Readonly<
      LeaseResponseVerificationBindingsV1 & {
        request: LeaseRequestSnapshotV1<"TIME_RECOVERY"> &
          Readonly<{ sameBootElapsedSeconds: bigint }>;
        trustedNow?: never;
      }
    >;

export type VerifyCarrierRequestV1<T extends CarrierType> = Extract<
  | Readonly<{
      carrierType: "lease-challenge";
      encoded: Uint8Array;
    }>
  | Readonly<{
      carrierType: "trust-bundle";
      encoded: Uint8Array;
      trustedNow: UtcSecond;
    }>
  | Readonly<{
      carrierType: "lease-response";
      encoded: Uint8Array;
      context: LeaseResponseVerificationContextV1;
    }>,
  { carrierType: T }
>;

export interface NonAuthoritativeCarrierV1<T extends CarrierType> {
  readonly carrierType: T;
  readonly carrier: CarrierByType[T];
  readonly decoded: Readonly<Record<string, unknown>>;
  readonly variant: ValidatedCarrier<T>["variant"];
  readonly encoded: Uint8Array;
  readonly embeddedVerification: "NOT_PERFORMED" | "SIGNATURE_TRUST_PREFLIGHT";
  readonly authority: "NONE_TRANSPORT_ONLY";
}

export interface LicenseVerifierV1 {
  verifySignedObject<T extends SignedTokenType>(
    request: VerifySignedObjectRequestV1<T>,
  ): VerificationResult<ValidatedLicenseArtifactV1<T>>;
  parseCarrier<T extends CarrierType>(
    request: ParseCarrierRequestV1<T>,
  ): VerificationResult<NonAuthoritativeCarrierV1<T>>;
  verifyCarrier<T extends CarrierType>(
    request: VerifyCarrierRequestV1<T>,
  ): VerificationResult<NonAuthoritativeCarrierV1<T>>;
}

type MutableDigestsV1 = {
  -readonly [K in keyof VerificationDigests]?: VerificationDigests[K];
};

function mutable(value: Readonly<Uint8Array>): Uint8Array {
  return new Uint8Array(value);
}

function defaultWorkflow(type: SignedTokenType): VerificationContext["workflow"] {
  switch (type) {
    case "activation-request":
      return "ECSREQ_FILE";
    case "lease-request":
      return "VENDOR_HTTPS_REQUEST";
    case "key-delegation":
    case "key-denylist":
      return "SIGNED_APPLICATION_UPDATE";
    case "entitlement":
      return "ECSLIC_FILE";
    case "lease":
      return "VENDOR_HTTPS_RESPONSE";
    case "offline-control":
    case "reactivation-authorization":
      return "ECSCTL_FILE";
    case "recovery":
    case "time-correction":
      return "ECSREC_FILE";
  }
}

function makeTrust(configuration: LicenseVerifierConfigurationV1): TrustSnapshot {
  return immutableDataView({
    environment: configuration.environment,
    roots: [...(configuration.roots ?? [])],
    trustedKeys: [...(configuration.trustedKeys ?? [])],
    delegations: [...(configuration.delegations ?? [])],
    ...(configuration.denylist ? { denylist: configuration.denylist } : {}),
  });
}

function makeContext<T extends SignedTokenType>(
  configuration: LicenseVerifierConfigurationV1,
  type: T,
  supplied: SignedVerificationContextV1 | undefined,
): VerificationContext {
  return Object.freeze({
    expectedTokenType: type,
    workflow: supplied?.workflow ?? defaultWorkflow(type),
    trust: makeTrust(configuration),
    ...(supplied?.trustedNow !== undefined ? { trustedNow: supplied.trustedNow } : {}),
    ...(supplied?.vendorUtc !== undefined ? { vendorUtc: supplied.vendorUtc } : {}),
    ...(supplied?.build ? { build: immutableDataView(supplied.build) } : {}),
    ...(supplied?.device ? { device: immutableDataView(supplied.device) } : {}),
    ...(supplied?.previousDevice ? { previousDevice: immutableDataView(supplied.previousDevice) } : {}),
    ...(supplied?.parent ? { parent: immutableDataView(supplied.parent) } : {}),
    ...(supplied?.request ? { request: immutableDataView(supplied.request) } : {}),
    ...(supplied?.state ? { state: immutableDataView(supplied.state) } : {}),
  });
}

function assertWorkflow(type: SignedTokenType, workflow: VerificationContext["workflow"]): void {
  const allowed: Readonly<Record<SignedTokenType, readonly VerificationContext["workflow"][]>> = {
    "activation-request": ["ECSREQ_FILE"],
    "lease-request": ["VENDOR_HTTPS_REQUEST"],
    "key-delegation": ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"],
    "key-denylist": ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"],
    entitlement: ["ECSLIC_FILE"],
    lease: ["VENDOR_HTTPS_RESPONSE"],
    "offline-control": ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"],
    "reactivation-authorization": ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"],
    recovery: ["ECSREC_FILE"],
    "time-correction": ["ECSREC_FILE"],
  };
  if (!allowed[type].includes(workflow)) {
    failLicenseCore("DOMAIN", "WORKFLOW_MISMATCH", "Object type is not allowed in this workflow.");
  }
}

function asSchemaMap(node: StrictCborNodeV1): StrictCborMapNodeV1 {
  if (node.kind !== "map") {
    failLicenseCore("SCHEMA", "WRONG_FIELD_TYPE", "Signed payload must be a CBOR map.");
  }
  return node;
}

function payloadKeyId(payload: Readonly<Record<string, unknown>>): Uint8Array {
  const value = payload["keyId"];
  if (!(value instanceof Uint8Array)) {
    failLicenseCore("DOMAIN", "KEY_ID_MISMATCH", "Payload keyId is missing or invalid.");
  }
  return value;
}

function resolvedDeviceKey<T extends SignedTokenType>(input: Readonly<{
  configuration: LicenseVerifierConfigurationV1;
  type: T;
  payload: SignedPayloadByType[T];
  context: VerificationContext;
  kid: Uint8Array;
}>): ResolvedSigningKeyV1 {
  if (input.type === "activation-request") {
    const request = input.payload as SignedPayloadByType["activation-request"];
    return {
      kid: copyBytes(input.kid),
      spkiDer: copyBytes(mutable(request.devicePublicKey)),
      purpose: "INSTALLATION_DEVICE",
      environment: input.configuration.environment,
    };
  }
  if (
    input.type === "lease-request" &&
    input.context.device?.devicePublicKey !== undefined &&
    bytesEqual(mutable(input.context.device.deviceKeyId), input.kid)
  ) {
    return {
      kid: copyBytes(input.kid),
      spkiDer: copyBytes(mutable(input.context.device.devicePublicKey)),
      purpose: "INSTALLATION_DEVICE",
      environment: input.configuration.environment,
    };
  }
  return resolveSigningKey(
    input.configuration.crypto,
    input.context.trust,
    input.kid,
    input.configuration.environment,
  );
}

function trustReferenceTime<T extends SignedTokenType>(
  type: T,
  payload: SignedPayloadByType[T],
  context: VerificationContext,
): bigint | undefined {
  if (type === "time-correction") {
    return (payload as SignedPayloadByType["time-correction"]).correctedUtc;
  }
  if (type === "lease" && context.request?.requestPurpose === "TIME_RECOVERY") {
    return (payload as SignedPayloadByType["lease"]).serverTime;
  }
  return context.trustedNow ?? context.vendorUtc;
}

function errorResult(
  error: unknown,
  digests: Partial<VerificationDigests>,
  crossType = false,
): VerificationFailure {
  if (isLicenseCoreError(error)) {
    const domainCrossType =
      crossType && error.stage === "DOMAIN" &&
      ["MEDIA_TYPE_MISMATCH", "TOKEN_TYPE_MISMATCH"].includes(error.code);
    return immutableDataView({
      ok: false,
      decision: "REJECT",
      stage: error.stage,
      errorCode: domainCrossType ? "CROSS_TYPE_REJECTED" : error.code,
      digests: Object.freeze({ ...digests }),
      authoritativeStateChanged: false,
      requestConsumed: false,
    });
  }
  if (error instanceof SchemaValidationError) {
    const domainCrossType =
      crossType && error.stage === "DOMAIN" &&
      ["MEDIA_TYPE_MISMATCH", "TOKEN_TYPE_MISMATCH"].includes(error.code);
    return immutableDataView({
      ok: false,
      decision: "REJECT",
      stage: error.stage,
      errorCode: domainCrossType ? "CROSS_TYPE_REJECTED" : error.code,
      ...(error.path ? { path: error.path } : {}),
      digests: Object.freeze({ ...digests }),
      authoritativeStateChanged: false,
      requestConsumed: false,
    });
  }
  throw error;
}

function protocolValuesEqual(left: unknown, right: unknown): boolean {
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    return left instanceof Uint8Array && right instanceof Uint8Array && bytesEqual(left, right);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => protocolValuesEqual(item, right[index]));
  }
  if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Readonly<Record<string, unknown>>;
    const rightRecord = right as Readonly<Record<string, unknown>>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key, index) =>
        key === rightKeys[index] && protocolValuesEqual(leftRecord[key], rightRecord[key]),
      );
  }
  return left === right;
}

function assertOutstandingRequestSnapshot(
  configuration: LicenseVerifierConfigurationV1,
  context: VerificationContext,
): void {
  const snapshot = context.request;
  if (!snapshot) return;
  const result = verifySigned(configuration, {
    expectedType: snapshot.tokenType,
    encoded: mutable(snapshot.encodedRequest),
    context: {
      workflow: defaultWorkflow(snapshot.tokenType),
      ...(context.trustedNow !== undefined ? { trustedNow: context.trustedNow } : {}),
      ...(context.vendorUtc !== undefined ? { vendorUtc: context.vendorUtc } : {}),
      ...(context.build ? { build: context.build } : {}),
      ...(context.device ? { device: context.device } : {}),
      ...(context.previousDevice ? { previousDevice: context.previousDevice } : {}),
      ...(context.parent ? { parent: context.parent } : {}),
      ...(context.state ? { state: context.state } : {}),
    },
  });
  const encodedHash = sha256(configuration.crypto, mutable(snapshot.encodedRequest));
  if (
    !result.ok ||
    !protocolValuesEqual(result.value.payload, snapshot.payload) ||
    snapshot.tokenType !== snapshot.payload.tokenType ||
    snapshot.requestPurpose !== snapshot.payload.requestPurpose ||
    !bytesEqual(mutable(snapshot.requestId), mutable(snapshot.payload.requestId)) ||
    !bytesEqual(mutable(snapshot.requestNonce), mutable(snapshot.payload.requestNonce)) ||
    !bytesEqual(mutable(snapshot.requestHash), encodedHash)
  ) {
    failLicenseCore(
      "CLAIMS",
      "REQUEST_SNAPSHOT_INVALID",
      "Outstanding request bytes and validated payload snapshot do not match.",
    );
  }
}

function verifySigned<T extends SignedTokenType>(
  configuration: LicenseVerifierConfigurationV1,
  request: VerifySignedObjectRequestV1<T>,
): VerificationResult<ValidatedLicenseArtifactV1<T>> {
  if (!(request.encoded instanceof Uint8Array)) throw new TypeError("encoded must be Uint8Array.");
  const digests: MutableDigestsV1 = {};
  try {
    const contract = signedObjectContract(request.expectedType);
    if (request.encoded.byteLength > contract.maxEncodedBytes) {
      failLicenseCore(
        "PRE_DECODE",
        "OBJECT_TOO_LARGE",
        `Signed object exceeds its ${contract.maxEncodedBytes}-byte limit.`,
      );
    }
    const inputBytes = copyBytes(request.encoded);
    digests.inputSha256 = sha256(configuration.crypto, inputBytes);
    const parsed = parseCoseSign1V1(inputBytes, contract.mediaType, contract.maxEncodedBytes);
    digests.protectedSha256 = sha256(configuration.crypto, parsed.raw.protected);
    digests.payloadSha256 = sha256(configuration.crypto, parsed.raw.payload);
    digests.sigStructureSha256 = sha256(configuration.crypto, parsed.raw.sigStructure);
    digests.signatureSha256 = sha256(configuration.crypto, parsed.raw.signature);

    const validated = validateSignedPayload(request.expectedType, asSchemaMap(parsed.payload));
    const decoded = validated.decoded as Readonly<Record<string, unknown>>;
    if (!bytesEqual(payloadKeyId(decoded), parsed.headers.kid)) {
      failLicenseCore("DOMAIN", "KEY_ID_MISMATCH", "Payload keyId does not equal protected kid.");
    }

    const context = makeContext(configuration, request.expectedType, request.context);
    assertWorkflow(request.expectedType, context.workflow);
    const key = resolvedDeviceKey({
      configuration,
      type: request.expectedType,
      payload: validated.payload,
      context,
      kid: parsed.headers.kid,
    });

    let signatureValid = false;
    try {
      signatureValid = configuration.crypto.verifyEs256P1363({
        spkiDer: copyBytes(key.spkiDer),
        signedBytes: copyBytes(parsed.raw.sigStructure),
        signature: copyBytes(parsed.raw.signature),
      });
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      failLicenseCore("SIGNATURE", "SIGNATURE_INVALID", "ES256 signature verification failed.");
    }

    if (
      request.expectedType === "lease-request" &&
      context.device?.devicePublicKey !== undefined
    ) {
      assertSpkiMatchesKid(
        configuration.crypto,
        mutable(context.device.devicePublicKey),
        parsed.headers.kid,
        { stage: "CLAIMS", code: "DEVICE_KEY_ID_MISMATCH" },
      );
    }

    assertSigningTrust(
      key,
      contract.signerPurpose,
      configuration.environment,
      validated.payload,
      trustReferenceTime(request.expectedType, validated.payload, context),
    );
    assertOutstandingRequestSnapshot(configuration, context);
    const claimResult = validateClaimsV1({
      type: request.expectedType,
      payload: validated.payload,
      context,
      crypto: configuration.crypto,
      inputHash: digests.inputSha256,
      ...(key.delegation ? { delegation: key.delegation } : {}),
    });
    const artifact: ValidatedLicenseArtifactV1<T> = immutableDataView({
      type: request.expectedType,
      payload: validated.payload,
      decoded,
      encoded: copyBytes(inputBytes),
      staged: claimResult.staged,
      authorization: "PREFLIGHT_ONLY",
    });
    return immutableDataView({
      ok: true,
      decision: "ACCEPT",
      stage: "COMPLETE",
      value: artifact,
      digests: Object.freeze(digests as VerificationDigests),
      signerKeyId: copyBytes(parsed.headers.kid),
      authoritativeStateChanged: false,
      requestConsumed: false,
    });
  } catch (error) {
    return errorResult(error, digests, request.crossType === true);
  }
}

function carrierBytesField(
  decoded: Readonly<Record<string, unknown>>,
  field: string,
): Uint8Array | undefined {
  const value = decoded[field];
  return value instanceof Uint8Array ? value : undefined;
}

function verifyEmbeddedSigned<T extends SignedTokenType>(
  configuration: LicenseVerifierConfigurationV1,
  encoded: Uint8Array,
  type: T,
  context: SignedVerificationContextV1,
): ValidatedLicenseArtifactV1<T> {
  const result = verifySigned(configuration, {
    expectedType: type,
    encoded,
    context: {
      ...context,
      workflow: "VENDOR_HTTPS_RESPONSE",
    },
  });
  if (!result.ok) {
    failLicenseCore(result.stage, result.errorCode, `Embedded ${type} object is invalid.`);
  }
  return result.value;
}

function inspectTrustBundleEmbedded(
  configuration: LicenseVerifierConfigurationV1,
  validated: ValidatedCarrier<"trust-bundle">,
  trustedNow: UtcSecond,
): void {
  let previousKid: Uint8Array | undefined;
  for (const encoded of validated.carrier.delegations) {
    const artifact = verifyEmbeddedSigned(
      configuration,
      mutable(encoded),
      "key-delegation",
      { trustedNow },
    );
    const kid = mutable(artifact.payload.delegatedKeyId);
    if (previousKid && compareBytes(previousKid, kid) >= 0) {
      failLicenseCore(
        "SCHEMA",
        "SET_NOT_CANONICAL",
        "Trust-bundle delegations must be unique delegated-key order.",
      );
    }
    previousKid = kid;
  }
  const denylist = mutable(validated.carrier.denylist);
  verifyEmbeddedSigned(configuration, denylist, "key-denylist", { trustedNow });
}

type CarrierVerificationModeV1 =
  | Readonly<{ kind: "TRANSPORT_ONLY" }>
  | Readonly<{ kind: "TRUST_BUNDLE"; trustedNow: UtcSecond }>
  | Readonly<{
      kind: "LEASE_RESPONSE";
      context: LeaseResponseVerificationContextV1;
    }>;

function requireTrustedUtc(value: unknown, message: string): UtcSecond {
  if (typeof value !== "bigint" || value < 0n || value > 253_402_300_799n) {
    failLicenseCore("CLAIMS", "CARRIER_CONTEXT_INVALID", message);
  }
  return value;
}

function validatedLeaseResponseContext(
  configuration: LicenseVerifierConfigurationV1,
  supplied: LeaseResponseVerificationContextV1,
): VerificationContext {
  if (
    !supplied ||
    typeof supplied !== "object" ||
    !supplied.request ||
    supplied.request.tokenType !== "lease-request" ||
    !supplied.build ||
    !supplied.device ||
    !supplied.device.devicePublicKey ||
    !supplied.parent ||
    !supplied.state
  ) {
    failLicenseCore(
      "CLAIMS",
      "CARRIER_CONTEXT_REQUIRED",
      "Lease-response verification requires request, Build, device, parent and state snapshots.",
    );
  }
  const purpose = supplied.request.requestPurpose;
  if (purpose !== "CHECK_IN" && purpose !== "TIME_RECOVERY") {
    failLicenseCore("CLAIMS", "CARRIER_CONTEXT_INVALID", "Lease-response request purpose is invalid.");
  }
  if (purpose === "CHECK_IN") {
    requireTrustedUtc(supplied.trustedNow, "Ordinary Lease response requires trusted time.");
  } else if (supplied.trustedNow !== undefined) {
    failLicenseCore(
      "CLAIMS",
      "CARRIER_CONTEXT_INVALID",
      "Time Recovery must derive admission time from its signed Lease.",
    );
  }
  const context = makeContext(configuration, "lease", {
    workflow: "VENDOR_HTTPS_RESPONSE",
    ...(purpose === "CHECK_IN" ? { trustedNow: supplied.trustedNow } : {}),
    build: supplied.build,
    device: supplied.device,
    parent: supplied.parent,
    request: supplied.request,
    state: supplied.state,
  });
  assertOutstandingRequestSnapshot(configuration, context);
  return context;
}

function inspectLeaseResponseEmbedded(
  configuration: LicenseVerifierConfigurationV1,
  validated: ValidatedCarrier<"lease-response">,
  supplied: LeaseResponseVerificationContextV1,
): void {
  const context = validatedLeaseResponseContext(configuration, supplied);
  const request = context.request;
  if (!request || request.tokenType !== "lease-request") {
    failLicenseCore("CLAIMS", "CARRIER_CONTEXT_REQUIRED", "Verified Lease request is required.");
  }
  if (!bytesEqual(mutable(validated.carrier.requestId), mutable(request.requestId))) {
    failLicenseCore("CLAIMS", "LEASE_REQUEST_MISMATCH", "Carrier request id does not match its request.");
  }

  const decoded = validated.decoded as Readonly<Record<string, unknown>>;
  const lease = carrierBytesField(decoded, "lease");
  const control = carrierBytesField(decoded, "offlineControl");
  const reactivation = carrierBytesField(decoded, "reactivationAuthorization");
  const trustBundle = carrierBytesField(decoded, "trustBundle");
  const timeRecovery = request.requestPurpose === "TIME_RECOVERY";

  if (timeRecovery && !lease) {
    failLicenseCore(
      "CLAIMS",
      "TIME_RECOVERY_PRIMARY_LEASE_REQUIRED",
      "Time Recovery response requires a primary Lease.",
    );
  }
  if (timeRecovery && trustBundle) {
    failLicenseCore(
      "CLAIMS",
      "TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN",
      "Time Recovery response cannot carry trust updates.",
    );
  }

  const leaseArtifact = lease
    ? verifyEmbeddedSigned(configuration, lease, "lease", {
        ...(context.trustedNow !== undefined ? { trustedNow: context.trustedNow } : {}),
        ...(context.build ? { build: context.build } : {}),
        ...(context.device ? { device: context.device } : {}),
        ...(context.parent ? { parent: context.parent } : {}),
        request,
        ...(context.state ? { state: context.state } : {}),
      })
    : undefined;
  const responseReference = timeRecovery
    ? leaseArtifact?.payload.serverTime
    : context.trustedNow;
  if (responseReference === undefined) {
    failLicenseCore("CLAIMS", "CARRIER_CONTEXT_REQUIRED", "Carrier admission reference is missing.");
  }

  // Sidecars are asynchronous objects, not responses to the current Lease
  // request.  Never attach that request snapshot to their verification.
  const sidecarContext: SignedVerificationContextV1 = {
    trustedNow: responseReference,
    ...(context.device ? { device: context.device } : {}),
    ...(context.parent ? { parent: context.parent } : {}),
    ...(context.state ? { state: context.state } : {}),
  };
  if (control) verifyEmbeddedSigned(configuration, control, "offline-control", sidecarContext);
  if (reactivation) {
    verifyEmbeddedSigned(
      configuration,
      reactivation,
      "reactivation-authorization",
      sidecarContext,
    );
  }
  if (trustBundle) {
    const root = decodeStrictCborV1(trustBundle, carrierContract("trust-bundle").maxEncodedBytes);
    const nested = validateCarrier("trust-bundle", asSchemaMap(root));
    inspectTrustBundleEmbedded(configuration, nested, responseReference);
  }
}

function parseCarrierInternal<T extends CarrierType>(
  configuration: LicenseVerifierConfigurationV1,
  request: Readonly<{ carrierType: T; encoded: Uint8Array }>,
  verification: CarrierVerificationModeV1,
): VerificationResult<NonAuthoritativeCarrierV1<T>> {
  if (!(request.encoded instanceof Uint8Array)) throw new TypeError("encoded must be Uint8Array.");
  const digests: MutableDigestsV1 = {};
  try {
    if (verification.kind === "TRANSPORT_ONLY" && "requestPurpose" in request) {
      failLicenseCore(
        "CLAIMS",
        "CARRIER_CONTEXT_INVALID",
        "Carrier purpose cannot be supplied without a verified request context.",
      );
    }
    const contract = carrierContract(request.carrierType);
    if (request.encoded.byteLength > contract.maxEncodedBytes) {
      failLicenseCore(
        "PRE_DECODE",
        "OBJECT_TOO_LARGE",
        `Carrier exceeds its ${contract.maxEncodedBytes}-byte limit.`,
      );
    }
    const encoded = copyBytes(request.encoded);
    digests.inputSha256 = sha256(configuration.crypto, encoded);
    const root = decodeStrictCborV1(encoded, contract.maxEncodedBytes);
    const map = asSchemaMap(root);
    const validated = validateCarrier(request.carrierType, map);
    const decoded = validated.decoded as Readonly<Record<string, unknown>>;

    if (verification.kind === "TRUST_BUNDLE") {
      if (request.carrierType !== "trust-bundle") {
        failLicenseCore("CLAIMS", "CARRIER_CONTEXT_INVALID", "Trust context was used for another carrier type.");
      }
      inspectTrustBundleEmbedded(
        configuration,
        validated as ValidatedCarrier<"trust-bundle">,
        requireTrustedUtc(verification.trustedNow, "Trust-bundle verification requires trusted time."),
      );
    } else if (verification.kind === "LEASE_RESPONSE") {
      if (request.carrierType !== "lease-response") {
        failLicenseCore("CLAIMS", "CARRIER_CONTEXT_INVALID", "Lease context was used for another carrier type.");
      }
      inspectLeaseResponseEmbedded(
        configuration,
        validated as ValidatedCarrier<"lease-response">,
        verification.context,
      );
    }

    const value: NonAuthoritativeCarrierV1<T> = immutableDataView({
      carrierType: request.carrierType,
      carrier: validated.carrier,
      decoded,
      variant: validated.variant,
      encoded: copyBytes(encoded),
      embeddedVerification: verification.kind === "TRANSPORT_ONLY"
        ? "NOT_PERFORMED"
        : "SIGNATURE_TRUST_PREFLIGHT",
      authority: "NONE_TRANSPORT_ONLY",
    });
    return immutableDataView({
      ok: true,
      decision: "ACCEPT",
      stage: "COMPLETE",
      value,
      digests: Object.freeze(digests as VerificationDigests),
      authoritativeStateChanged: false,
      requestConsumed: false,
    });
  } catch (error) {
    return errorResult(error, digests);
  }
}

function verifyCarrierInternal<T extends CarrierType>(
  configuration: LicenseVerifierConfigurationV1,
  request: VerifyCarrierRequestV1<T>,
): VerificationResult<NonAuthoritativeCarrierV1<T>> {
  if (request.carrierType === "trust-bundle") {
    const typed = request as VerifyCarrierRequestV1<"trust-bundle">;
    return parseCarrierInternal(configuration, typed, {
      kind: "TRUST_BUNDLE",
      trustedNow: typed.trustedNow,
    }) as VerificationResult<NonAuthoritativeCarrierV1<T>>;
  }
  if (request.carrierType === "lease-response") {
    const typed = request as VerifyCarrierRequestV1<"lease-response">;
    return parseCarrierInternal(configuration, typed, {
      kind: "LEASE_RESPONSE",
      context: typed.context,
    }) as VerificationResult<NonAuthoritativeCarrierV1<T>>;
  }
  const typed = request as VerifyCarrierRequestV1<"lease-challenge">;
  return parseCarrierInternal(configuration, typed, { kind: "TRANSPORT_ONLY" }) as
    VerificationResult<NonAuthoritativeCarrierV1<T>>;
}

export function createLicenseVerifierV1(
  configuration: LicenseVerifierConfigurationV1,
): LicenseVerifierV1 {
  if (!configuration || typeof configuration !== "object") {
    throw new TypeError("License verifier configuration is required.");
  }
  if (!configuration.crypto || typeof configuration.crypto.sha256 !== "function" ||
      typeof configuration.crypto.verifyEs256P1363 !== "function") {
    throw new TypeError("A complete LicenseCryptoV1 adapter is required.");
  }
  if (!["PRODUCTION", "DEVELOPMENT", "TEST"].includes(configuration.environment)) {
    throw new TypeError("A frozen Licensing environment is required.");
  }

  const frozenConfiguration: LicenseVerifierConfigurationV1 = Object.freeze({
    crypto: configuration.crypto,
    environment: configuration.environment,
    roots: immutableDataView([...(configuration.roots ?? [])]),
    trustedKeys: immutableDataView([...(configuration.trustedKeys ?? [])]),
    delegations: immutableDataView([...(configuration.delegations ?? [])]),
    ...(configuration.denylist ? { denylist: immutableDataView(configuration.denylist) } : {}),
  });
  return Object.freeze({
    verifySignedObject: <T extends SignedTokenType>(request: VerifySignedObjectRequestV1<T>) =>
      verifySigned(frozenConfiguration, request),
    parseCarrier: <T extends CarrierType>(request: ParseCarrierRequestV1<T>) =>
      parseCarrierInternal(frozenConfiguration, request, { kind: "TRANSPORT_ONLY" }),
    verifyCarrier: <T extends CarrierType>(request: VerifyCarrierRequestV1<T>) =>
      verifyCarrierInternal(frozenConfiguration, request),
  });
}
