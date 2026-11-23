import { ISSUER_POLICY_SECONDS, LIMITS, PRODUCT_ID } from "../protocol";
import type {
  CborMap,
  CborValue,
  KeyDenylistPayload,
  SchemaFailureReporter,
  SignedPayloadByType,
  SignedTokenType,
  ValidatedSignedPayload,
} from "../types";
import {
  assertExactFields,
  field,
  joinPath,
  normalizeTextRecord,
  optionalField,
  reject,
  requireArray,
  requireBytes,
  requireCounter,
  requireDisplayText,
  requireEdition,
  requireExactUnsigned,
  requireHash,
  requireMap,
  requireNonce,
  requireOpaqueId,
  requireP256Spki,
  requirePositiveCounter,
  requireSemVerText,
  requireTextEnum,
  requireTextLiteral,
  requireTimestamp,
  textMap,
  throwSchemaFailure,
  validateControlSnapshot,
  validateControlTuple,
  validateDomain,
  validateFeatureArray,
  validateVendorCommon,
} from "./common";

const DOMAIN_FIELDS = ["protocolVersion", "tokenType"] as const;
const VENDOR_COMMON_FIELDS = [
  ...DOMAIN_FIELDS,
  "tokenId",
  "keyId",
  "issuedAt",
  "notBefore",
  "notAfter",
  "productId",
] as const;

function result<T extends SignedTokenType>(
  tokenType: T,
  map: CborMap,
): ValidatedSignedPayload<T> {
  const decoded = normalizeTextRecord(map);
  return Object.freeze({
    tokenType,
    decoded,
    payload: decoded as unknown as SignedPayloadByType[T],
  });
}

function fieldsFor(
  map: CborMap,
  tokenType: SignedTokenType,
  fail: SchemaFailureReporter,
): ReadonlyMap<string, CborValue> {
  const fields = textMap(map, fail, tokenType);
  validateDomain(fields, tokenType, fail, tokenType);
  return fields;
}

function validateCommonRequestFields(
  fields: ReadonlyMap<string, CborValue>,
  fail: SchemaFailureReporter,
  path: string,
): void {
  requireOpaqueId(field(fields, "requestId", fail, path), fail, joinPath(path, "requestId"));
  requireNonce(field(fields, "requestNonce", fail, path), fail, joinPath(path, "requestNonce"));
  requireHash(field(fields, "keyId", fail, path), fail, joinPath(path, "keyId"));
  requireTextLiteral(field(fields, "productId", fail, path), PRODUCT_ID, fail, joinPath(path, "productId"));
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  requireOpaqueId(field(fields, "installationId", fail, path), fail, joinPath(path, "installationId"));
  requireHash(field(fields, "deviceKeyId", fail, path), fail, joinPath(path, "deviceKeyId"));
  requireHash(field(fields, "versionIdentitySha256", fail, path), fail, joinPath(path, "versionIdentitySha256"));
  requireHash(field(fields, "buildIdentitySha256", fail, path), fail, joinPath(path, "buildIdentitySha256"));
  requireHash(field(fields, "buildManifestSha256", fail, path), fail, joinPath(path, "buildManifestSha256"));
}

const ACTIVATION_COMMON_FIELDS = [
  ...DOMAIN_FIELDS,
  "requestId",
  "requestNonce",
  "keyId",
  "issuedAt",
  "notAfter",
  "productId",
  "edition",
  "installationId",
  "devicePublicKey",
  "deviceKeyId",
  "versionIdentitySha256",
  "buildIdentitySha256",
  "buildManifestSha256",
  "stateGeneration",
  "entitlementGeneration",
  "leaseRevision",
  "controlRevision",
  "controlState",
  "timeCorrectionRevision",
  "bindingKind",
  "requestPurpose",
] as const;

const ACTIVATION_FIELDS_BY_PURPOSE = {
  ACTIVATE: [],
  RENEW: ["licenseId", "activationId", "entitlementTokenId"],
  CONTROL: ["licenseId", "activationId", "controlAction", "controlEffectiveAt", "controlReasonCode"],
  RECOVER: ["licenseId", "activationId", "incidentId", "incidentNonce", "stateHash", "entitlementTokenId", "entitlementTokenHash"],
  REBIND: ["licenseId", "activationId", "incidentId", "incidentNonce", "stateHash", "entitlementTokenId", "entitlementTokenHash", "oldDeviceKeyId"],
  REACTIVATE: ["revokedLicenseId", "revokedActivationId", "finalRevokeTokenHash", "finalControlRevision", "incidentId", "incidentNonce", "revokedLineageTombstoneId", "revokedLineageTombstoneHash"],
  TIME_CORRECT: ["licenseId", "activationId", "incidentId", "incidentNonce", "preIncidentClockHighWater"],
} as const;

type ActivationPurpose = keyof typeof ACTIVATION_FIELDS_BY_PURPOSE;

const ALL_ACTIVATION_PURPOSE_FIELDS = Object.freeze(
  [...new Set(Object.values(ACTIVATION_FIELDS_BY_PURPOSE).flat())],
);

function validateTpmEvidence(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): void {
  const map = requireMap(value, fail, path);
  if (map.entries.length === 0) reject(fail, "SCHEMA", "EMPTY_OPTIONAL_FIELD", path);
  const fields = textMap(map, fail, path);
  const required = ["schemaVersion", "format", "contextHash", "evidence"] as const;
  assertExactFields(fields, required, [], fail, path);
  requireExactUnsigned(field(fields, "schemaVersion", fail, path), 1n, fail, joinPath(path, "schemaVersion"));
  requireTextLiteral(
    field(fields, "format", fail, path),
    "WINDOWS_CNG_TPM_KEY_ATTESTATION_V1",
    fail,
    joinPath(path, "format"),
  );
  requireHash(field(fields, "contextHash", fail, path), fail, joinPath(path, "contextHash"));
  requireBytes(field(fields, "evidence", fail, path), 1, 65_536, fail, joinPath(path, "evidence"));
}

export function validateActivationRequestPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"activation-request"> {
  const path = "activation-request";
  const fields = fieldsFor(map, "activation-request", fail);
  const purpose = requireTextEnum(
    field(fields, "requestPurpose", fail, path),
    Object.keys(ACTIVATION_FIELDS_BY_PURPOSE) as ActivationPurpose[],
    fail,
    joinPath(path, "requestPurpose"),
  );
  const purposeFields = ACTIVATION_FIELDS_BY_PURPOSE[purpose];
  const permittedPurposeFields = new Set<string>(purposeFields);
  for (const name of ALL_ACTIVATION_PURPOSE_FIELDS) {
    if (fields.has(name) && !permittedPurposeFields.has(name)) {
      reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, name));
    }
  }
  for (const name of purposeFields) {
    if (!fields.has(name)) {
      const code = purpose === "CONTROL" && name === "controlAction"
        ? "CONTROL_ACTION_REQUIRED"
        : "CONDITIONAL_FIELDS_MISSING";
      reject(fail, "SCHEMA", code, joinPath(path, name));
    }
  }

  const bindingKind = requireTextEnum(
    field(fields, "bindingKind", fail, path),
    ["SOFTWARE_BOUND", "TPM_ATTESTED"],
    fail,
    joinPath(path, "bindingKind"),
  );
  const tpmEvidence = optionalField(fields, "tpmEvidence");
  if (bindingKind === "TPM_ATTESTED" && tpmEvidence === undefined) {
    reject(fail, "SCHEMA", "TPM_EVIDENCE_REQUIRED", joinPath(path, "tpmEvidence"));
  }
  if (bindingKind === "SOFTWARE_BOUND" && tpmEvidence !== undefined) {
    reject(fail, "SCHEMA", "TPM_EVIDENCE_FORBIDDEN", joinPath(path, "tpmEvidence"));
  }

  assertExactFields(
    fields,
    [...ACTIVATION_COMMON_FIELDS, ...purposeFields],
    bindingKind === "TPM_ATTESTED" ? ["tpmEvidence"] : [],
    fail,
    path,
  );
  validateCommonRequestFields(fields, fail, path);
  requireTimestamp(field(fields, "issuedAt", fail, path), fail, joinPath(path, "issuedAt"));
  requireTimestamp(field(fields, "notAfter", fail, path), fail, joinPath(path, "notAfter"));
  requireP256Spki(field(fields, "devicePublicKey", fail, path), fail, joinPath(path, "devicePublicKey"));
  requireCounter(field(fields, "stateGeneration", fail, path), fail, joinPath(path, "stateGeneration"));
  requireCounter(field(fields, "entitlementGeneration", fail, path), fail, joinPath(path, "entitlementGeneration"));
  requireCounter(field(fields, "leaseRevision", fail, path), fail, joinPath(path, "leaseRevision"));
  requireCounter(field(fields, "timeCorrectionRevision", fail, path), fail, joinPath(path, "timeCorrectionRevision"));
  validateControlSnapshot(fields, fail, path);
  if (tpmEvidence !== undefined) validateTpmEvidence(tpmEvidence, fail, joinPath(path, "tpmEvidence"));

  const ids = [
    "licenseId", "activationId", "entitlementTokenId", "incidentId", "revokedLicenseId",
    "revokedActivationId", "revokedLineageTombstoneId",
  ] as const;
  for (const name of ids) {
    const value = optionalField(fields, name);
    if (value !== undefined) requireOpaqueId(value, fail, joinPath(path, name));
  }
  const hashes = [
    "stateHash", "entitlementTokenHash", "finalRevokeTokenHash", "revokedLineageTombstoneHash",
    "oldDeviceKeyId",
  ] as const;
  for (const name of hashes) {
    const value = optionalField(fields, name);
    if (value !== undefined) requireHash(value, fail, joinPath(path, name));
  }
  const incidentNonce = optionalField(fields, "incidentNonce");
  if (incidentNonce !== undefined) requireNonce(incidentNonce, fail, joinPath(path, "incidentNonce"));
  const finalRevision = optionalField(fields, "finalControlRevision");
  if (finalRevision !== undefined) requirePositiveCounter(finalRevision, fail, joinPath(path, "finalControlRevision"));
  const preIncident = optionalField(fields, "preIncidentClockHighWater");
  if (preIncident !== undefined) requireTimestamp(preIncident, fail, joinPath(path, "preIncidentClockHighWater"));
  const controlEffectiveAt = optionalField(fields, "controlEffectiveAt");
  if (controlEffectiveAt !== undefined) requireTimestamp(controlEffectiveAt, fail, joinPath(path, "controlEffectiveAt"));
  const controlAction = optionalField(fields, "controlAction");
  if (controlAction !== undefined) {
    requireTextEnum(
      controlAction,
      ["SUSPEND", "UNSUSPEND", "REVOKE"],
      fail,
      joinPath(path, "controlAction"),
      "CONTROL_ACTION_INVALID",
    );
  }
  const controlReason = optionalField(fields, "controlReasonCode");
  if (controlReason !== undefined) {
    const reason = requireCounter(controlReason, fail, joinPath(path, "controlReasonCode"));
    if (reason < 1n || reason > 5n) {
      reject(fail, "SCHEMA", "CONTROL_REASON_CODE_INVALID", joinPath(path, "controlReasonCode"));
    }
  }
  return result("activation-request", map);
}

const LEASE_REQUEST_COMMON_FIELDS = [
  ...DOMAIN_FIELDS,
  "requestId",
  "requestNonce",
  "keyId",
  "httpMethod",
  "httpPath",
  "productId",
  "edition",
  "licenseId",
  "activationId",
  "installationId",
  "deviceKeyId",
  "entitlementTokenId",
  "entitlementGeneration",
  "lastLeaseRevision",
  "controlRevision",
  "controlState",
  "controlEffectiveAt",
  "controlReasonCode",
  "stateGeneration",
  "versionIdentitySha256",
  "buildIdentitySha256",
  "buildManifestSha256",
  "requestPurpose",
] as const;

export function validateLeaseRequestPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"lease-request"> {
  const path = "lease-request";
  const fields = fieldsFor(map, "lease-request", fail);
  const purpose = requireTextEnum(
    field(fields, "requestPurpose", fail, path),
    ["CHECK_IN", "TIME_RECOVERY"],
    fail,
    joinPath(path, "requestPurpose"),
  );
  const recoveryFields = ["incidentId", "incidentNonce", "preIncidentClockHighWater"] as const;
  if (purpose === "TIME_RECOVERY") {
    for (const name of recoveryFields) {
      if (!fields.has(name)) reject(fail, "SCHEMA", "TIME_RECOVERY_BINDING_MISSING", joinPath(path, name));
    }
  } else {
    for (const name of recoveryFields) {
      if (fields.has(name)) reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, name));
    }
  }
  assertExactFields(
    fields,
    purpose === "TIME_RECOVERY" ? [...LEASE_REQUEST_COMMON_FIELDS, ...recoveryFields] : LEASE_REQUEST_COMMON_FIELDS,
    ["bindingRecoveryTokenId"],
    fail,
    path,
  );
  validateCommonRequestFields(fields, fail, path);
  requireTextLiteral(
    field(fields, "httpMethod", fail, path),
    "POST",
    fail,
    joinPath(path, "httpMethod"),
    "HTTP_METHOD_MISMATCH",
  );
  requireTextLiteral(
    field(fields, "httpPath", fail, path),
    "/v1/licensing/leases",
    fail,
    joinPath(path, "httpPath"),
    "HTTP_PATH_MISMATCH",
  );
  for (const name of ["licenseId", "activationId", "entitlementTokenId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requirePositiveCounter(field(fields, "entitlementGeneration", fail, path), fail, joinPath(path, "entitlementGeneration"));
  requireCounter(field(fields, "lastLeaseRevision", fail, path), fail, joinPath(path, "lastLeaseRevision"));
  requireCounter(field(fields, "stateGeneration", fail, path), fail, joinPath(path, "stateGeneration"));
  validateControlTuple(fields, fail, path, true);
  const bindingRecovery = optionalField(fields, "bindingRecoveryTokenId");
  if (bindingRecovery !== undefined) requireOpaqueId(bindingRecovery, fail, joinPath(path, "bindingRecoveryTokenId"), true);
  if (purpose === "TIME_RECOVERY") {
    requireOpaqueId(field(fields, "incidentId", fail, path), fail, joinPath(path, "incidentId"));
    requireNonce(field(fields, "incidentNonce", fail, path), fail, joinPath(path, "incidentNonce"));
    requireTimestamp(field(fields, "preIncidentClockHighWater", fail, path), fail, joinPath(path, "preIncidentClockHighWater"));
  }
  return result("lease-request", map);
}

export function validateKeyDelegationPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"key-delegation"> {
  const path = "key-delegation";
  const fields = fieldsFor(map, "key-delegation", fail);
  const purpose = requireTextEnum(
    field(fields, "purpose", fail, path),
    ["OFFLINE_ENTITLEMENT", "ONLINE_LEASE", "OFFLINE_CONTROL", "RECOVERY"],
    fail,
    joinPath(path, "purpose"),
  );
  const entitlementPurpose = purpose === "OFFLINE_ENTITLEMENT";
  if (entitlementPurpose && !fields.has("maxBusinessTermSeconds")) {
    reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_MISSING", joinPath(path, "maxBusinessTermSeconds"));
  }
  if (!entitlementPurpose && fields.has("maxBusinessTermSeconds")) {
    reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, "maxBusinessTermSeconds"));
  }
  assertExactFields(
    fields,
    [
      ...VENDOR_COMMON_FIELDS,
      "environment",
      "delegatedPublicKey",
      "delegatedKeyId",
      "delegationSerial",
      "purpose",
      "maxTokenLifetimeSeconds",
      ...(entitlementPurpose ? ["maxBusinessTermSeconds"] : []),
    ],
    [],
    fail,
    path,
  );
  validateVendorCommon(fields, fail, path);
  requireTextEnum(field(fields, "environment", fail, path), ["PRODUCTION", "DEVELOPMENT", "TEST"], fail, joinPath(path, "environment"));
  requireP256Spki(field(fields, "delegatedPublicKey", fail, path), fail, joinPath(path, "delegatedPublicKey"));
  requireHash(field(fields, "delegatedKeyId", fail, path), fail, joinPath(path, "delegatedKeyId"));
  requirePositiveCounter(field(fields, "delegationSerial", fail, path), fail, joinPath(path, "delegationSerial"));
  const maxLifetime = requirePositiveCounter(field(fields, "maxTokenLifetimeSeconds", fail, path), fail, joinPath(path, "maxTokenLifetimeSeconds"));
  const ceiling = purpose === "OFFLINE_ENTITLEMENT"
    ? 35_424_000n
    : purpose === "RECOVERY"
      ? 86_400n
      : 2_592_000n;
  if (maxLifetime > ceiling) reject(fail, "SCHEMA", "DELEGATION_SCOPE_TOO_WIDE", joinPath(path, "maxTokenLifetimeSeconds"));
  if (entitlementPurpose) {
    const business = requirePositiveCounter(field(fields, "maxBusinessTermSeconds", fail, path), fail, joinPath(path, "maxBusinessTermSeconds"));
    if (business > ISSUER_POLICY_SECONDS.businessTermMaximum) {
      reject(fail, "SCHEMA", "DELEGATION_SCOPE_TOO_WIDE", joinPath(path, "maxBusinessTermSeconds"));
    }
  }
  return result("key-delegation", map);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function validateDeniedKeys(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): void {
  const array = requireArray(value, fail, path);
  if (array.items.length > LIMITS.denylistMaximumEntries) {
    reject(fail, "SCHEMA", "DENYLIST_ENTRY_LIMIT", path);
  }
  const seen: Uint8Array[] = [];
  for (let index = 0; index < array.items.length; index += 1) {
    const item = array.items[index];
    if (item === undefined) throw new Error("Unreachable denylist index.");
    const itemPath = `${path}[${index}]`;
    const entryMap = requireMap(item, fail, itemPath);
    const entry = textMap(entryMap, fail, itemPath);
    assertExactFields(entry, ["delegatedKeyId", "effectiveAt", "reasonCode"], [], fail, itemPath);
    const delegatedKeyId = requireHash(field(entry, "delegatedKeyId", fail, itemPath), fail, joinPath(itemPath, "delegatedKeyId"));
    if (seen.some((prior) => bytesEqual(prior, delegatedKeyId))) {
      reject(fail, "SCHEMA", "DUPLICATE_SET_MEMBER", joinPath(itemPath, "delegatedKeyId"));
    }
    seen.push(delegatedKeyId);
    requireTimestamp(field(entry, "effectiveAt", fail, itemPath), fail, joinPath(itemPath, "effectiveAt"));
    const reason = requireCounter(field(entry, "reasonCode", fail, itemPath), fail, joinPath(itemPath, "reasonCode"));
    if (reason < 1n || reason > 3n) reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", joinPath(itemPath, "reasonCode"));
  }
}

export function validateKeyDenylistPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"key-denylist"> {
  const path = "key-denylist";
  const fields = fieldsFor(map, "key-denylist", fail);
  const revision = requirePositiveCounter(field(fields, "denylistRevision", fail, path), fail, joinPath(path, "denylistRevision"));
  const predecessorFields = ["previousDenylistTokenId", "previousDenylistHash"] as const;
  if (revision === 1n) {
    for (const name of predecessorFields) {
      if (fields.has(name)) reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, name));
    }
  } else {
    for (const name of predecessorFields) {
      if (!fields.has(name)) reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_MISSING", joinPath(path, name));
    }
  }
  assertExactFields(
    fields,
    [...VENDOR_COMMON_FIELDS, "environment", "denylistRevision", ...(revision === 1n ? [] : predecessorFields), "deniedKeys"],
    [],
    fail,
    path,
  );
  validateVendorCommon(fields, fail, path);
  requireTextEnum(field(fields, "environment", fail, path), ["PRODUCTION", "DEVELOPMENT", "TEST"], fail, joinPath(path, "environment"));
  if (revision !== 1n) {
    requireOpaqueId(field(fields, "previousDenylistTokenId", fail, path), fail, joinPath(path, "previousDenylistTokenId"), true);
    requireHash(field(fields, "previousDenylistHash", fail, path), fail, joinPath(path, "previousDenylistHash"));
  }
  validateDeniedKeys(field(fields, "deniedKeys", fail, path), fail, joinPath(path, "deniedKeys"));
  return result("key-denylist", map);
}

const ENTITLEMENT_FIXED_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "customerId",
  "licenseId",
  "activationId",
  "installationId",
  "deviceKeyId",
  "generation",
  "mode",
  "features",
  "assurance",
  "termStartsAt",
  "termEndsAt",
  "warningLeadSeconds",
  "warningStartsAt",
  "graceSeconds",
  "graceUntil",
  "clockToleranceSeconds",
  "minimumProductVersion",
  "maximumMajorVersion",
  "requestId",
  "requestHash",
] as const;

export function validateEntitlementPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"entitlement"> {
  const path = "entitlement";
  const fields = fieldsFor(map, "entitlement", fail);
  const generation = requirePositiveCounter(field(fields, "generation", fail, path), fail, joinPath(path, "generation"));
  if (generation === 1n && fields.has("previousTokenId")) {
    reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, "previousTokenId"));
  }
  if (generation > 1n && !fields.has("previousTokenId")) {
    reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_MISSING", joinPath(path, "previousTokenId"));
  }
  if (generation > 1n && fields.has("reactivationAuthorizationId")) {
    reject(fail, "SCHEMA", "CONDITIONAL_FIELDS_FORBIDDEN", joinPath(path, "reactivationAuthorizationId"));
  }
  const mode = requireTextEnum(
    field(fields, "mode", fail, path),
    ["OFFLINE_BOUND", "HYBRID_LEASED"],
    fail,
    joinPath(path, "mode"),
  );
  const hybridFields = ["checkCadenceSeconds", "offlineAllowanceSeconds", "timeRecoveryRttSeconds"] as const;
  if (mode === "HYBRID_LEASED") {
    for (const name of hybridFields) {
      if (!fields.has(name)) reject(fail, "SCHEMA", "HYBRID_POLICY_REQUIRED", joinPath(path, name));
    }
  } else {
    for (const name of hybridFields) {
      if (fields.has(name)) reject(fail, "SCHEMA", "HYBRID_POLICY_FORBIDDEN", joinPath(path, name));
    }
  }
  const lineageRequired = generation > 1n ? ["previousTokenId"] : [];
  const lineageOptional = generation === 1n ? ["reactivationAuthorizationId"] : [];
  assertExactFields(
    fields,
    [...ENTITLEMENT_FIXED_FIELDS, ...lineageRequired, ...(mode === "HYBRID_LEASED" ? hybridFields : [])],
    ["customerDisplayName", ...lineageOptional],
    fail,
    path,
  );
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  for (const name of ["customerId", "licenseId", "activationId", "installationId", "requestId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requireHash(field(fields, "deviceKeyId", fail, path), fail, joinPath(path, "deviceKeyId"));
  requireHash(field(fields, "requestHash", fail, path), fail, joinPath(path, "requestHash"));
  const display = optionalField(fields, "customerDisplayName");
  if (display !== undefined) requireDisplayText(display, fail, joinPath(path, "customerDisplayName"));
  const previous = optionalField(fields, "previousTokenId");
  if (previous !== undefined) requireOpaqueId(previous, fail, joinPath(path, "previousTokenId"), true);
  const reactivation = optionalField(fields, "reactivationAuthorizationId");
  if (reactivation !== undefined) requireOpaqueId(reactivation, fail, joinPath(path, "reactivationAuthorizationId"), true);
  validateFeatureArray(field(fields, "features", fail, path), fail, joinPath(path, "features"));
  requireTextEnum(field(fields, "assurance", fail, path), ["TPM_ATTESTED", "SOFTWARE_BOUND"], fail, joinPath(path, "assurance"));
  for (const name of ["termStartsAt", "termEndsAt", "warningStartsAt", "graceUntil"] as const) {
    requireTimestamp(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  const warning = requireCounter(field(fields, "warningLeadSeconds", fail, path), fail, joinPath(path, "warningLeadSeconds"));
  if (warning > ISSUER_POLICY_SECONDS.warningLead.maximum) {
    reject(fail, "SCHEMA", "WARNING_POLICY_OUT_OF_RANGE", joinPath(path, "warningLeadSeconds"));
  }
  const grace = requireCounter(field(fields, "graceSeconds", fail, path), fail, joinPath(path, "graceSeconds"));
  if (grace > ISSUER_POLICY_SECONDS.postTermGrace.maximum) {
    reject(fail, "SCHEMA", "GRACE_POLICY_OUT_OF_RANGE", joinPath(path, "graceSeconds"));
  }
  requireExactUnsigned(field(fields, "clockToleranceSeconds", fail, path), 300n, fail, joinPath(path, "clockToleranceSeconds"));
  requireSemVerText(field(fields, "minimumProductVersion", fail, path), fail, joinPath(path, "minimumProductVersion"));
  requireCounter(field(fields, "maximumMajorVersion", fail, path), fail, joinPath(path, "maximumMajorVersion"));
  if (mode === "HYBRID_LEASED") {
    const cadence = requireCounter(field(fields, "checkCadenceSeconds", fail, path), fail, joinPath(path, "checkCadenceSeconds"));
    if (cadence < ISSUER_POLICY_SECONDS.hybridCheckCadence.minimum || cadence > ISSUER_POLICY_SECONDS.hybridCheckCadence.maximum) {
      reject(fail, "SCHEMA", "CADENCE_POLICY_OUT_OF_RANGE", joinPath(path, "checkCadenceSeconds"));
    }
    const allowance = requireCounter(field(fields, "offlineAllowanceSeconds", fail, path), fail, joinPath(path, "offlineAllowanceSeconds"));
    if (allowance < ISSUER_POLICY_SECONDS.hybridOfflineAllowance.minimum || allowance > ISSUER_POLICY_SECONDS.hybridOfflineAllowance.maximum) {
      reject(fail, "SCHEMA", "ALLOWANCE_POLICY_OUT_OF_RANGE", joinPath(path, "offlineAllowanceSeconds"));
    }
    requireExactUnsigned(field(fields, "timeRecoveryRttSeconds", fail, path), 300n, fail, joinPath(path, "timeRecoveryRttSeconds"));
  }
  return result("entitlement", map);
}

const LEASE_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "licenseId",
  "activationId",
  "installationId",
  "deviceKeyId",
  "mode",
  "assurance",
  "features",
  "entitlementTokenId",
  "entitlementGeneration",
  "leaseRevision",
  "serverTime",
  "offlineUntil",
  "controlRevision",
  "controlState",
  "controlEffectiveAt",
  "controlReasonCode",
  "leaseRequestId",
  "leaseRequestHash",
  "versionIdentitySha256",
  "buildIdentitySha256",
  "buildManifestSha256",
] as const;

export function validateLeasePayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"lease"> {
  const path = "lease";
  const fields = fieldsFor(map, "lease", fail);
  assertExactFields(fields, LEASE_FIELDS, ["bindingRecoveryTokenId"], fail, path);
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  for (const name of ["licenseId", "activationId", "installationId", "entitlementTokenId", "leaseRequestId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  for (const name of ["deviceKeyId", "leaseRequestHash", "versionIdentitySha256", "buildIdentitySha256", "buildManifestSha256"] as const) {
    requireHash(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requireTextLiteral(field(fields, "mode", fail, path), "HYBRID_LEASED", fail, joinPath(path, "mode"));
  requireTextEnum(field(fields, "assurance", fail, path), ["TPM_ATTESTED", "SOFTWARE_BOUND"], fail, joinPath(path, "assurance"));
  validateFeatureArray(field(fields, "features", fail, path), fail, joinPath(path, "features"));
  requirePositiveCounter(field(fields, "entitlementGeneration", fail, path), fail, joinPath(path, "entitlementGeneration"));
  requirePositiveCounter(field(fields, "leaseRevision", fail, path), fail, joinPath(path, "leaseRevision"));
  requireTimestamp(field(fields, "serverTime", fail, path), fail, joinPath(path, "serverTime"));
  requireTimestamp(field(fields, "offlineUntil", fail, path), fail, joinPath(path, "offlineUntil"));
  validateControlTuple(fields, fail, path, false);
  const bindingRecovery = optionalField(fields, "bindingRecoveryTokenId");
  if (bindingRecovery !== undefined) requireOpaqueId(bindingRecovery, fail, joinPath(path, "bindingRecoveryTokenId"), true);
  return result("lease", map);
}

const OFFLINE_CONTROL_FIXED_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "licenseId",
  "activationId",
  "origin",
  "controlRevision",
  "action",
  "effectiveAt",
  "reasonCode",
] as const;

export function validateOfflineControlPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"offline-control"> {
  const path = "offline-control";
  const fields = fieldsFor(map, "offline-control", fail);
  const origin = requireTextEnum(
    field(fields, "origin", fail, path),
    ["VENDOR_INITIATED", "REQUEST_BOUND"],
    fail,
    joinPath(path, "origin"),
  );
  const requestFields = ["requestId", "requestHash"] as const;
  if (origin === "REQUEST_BOUND") {
    for (const name of requestFields) {
      if (!fields.has(name)) reject(fail, "SCHEMA", "CONTROL_REQUEST_BINDING_REQUIRED", joinPath(path, name));
    }
  } else {
    for (const name of requestFields) {
      if (fields.has(name)) reject(fail, "SCHEMA", "CONTROL_REQUEST_BINDING_FORBIDDEN", joinPath(path, name));
    }
  }
  assertExactFields(
    fields,
    [...OFFLINE_CONTROL_FIXED_FIELDS, ...(origin === "REQUEST_BOUND" ? requestFields : [])],
    [],
    fail,
    path,
  );
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  requireOpaqueId(field(fields, "licenseId", fail, path), fail, joinPath(path, "licenseId"));
  requireOpaqueId(field(fields, "activationId", fail, path), fail, joinPath(path, "activationId"));
  if (origin === "REQUEST_BOUND") {
    requireOpaqueId(field(fields, "requestId", fail, path), fail, joinPath(path, "requestId"), true);
    requireHash(field(fields, "requestHash", fail, path), fail, joinPath(path, "requestHash"));
  }
  requirePositiveCounter(field(fields, "controlRevision", fail, path), fail, joinPath(path, "controlRevision"));
  requireTextEnum(field(fields, "action", fail, path), ["SUSPEND", "UNSUSPEND", "REVOKE"], fail, joinPath(path, "action"), "CONTROL_ACTION_INVALID");
  requireTimestamp(field(fields, "effectiveAt", fail, path), fail, joinPath(path, "effectiveAt"));
  const reason = requireCounter(field(fields, "reasonCode", fail, path), fail, joinPath(path, "reasonCode"));
  if (reason < 1n || reason > 5n) reject(fail, "SCHEMA", "CONTROL_REASON_CODE_INVALID", joinPath(path, "reasonCode"));
  return result("offline-control", map);
}

const REACTIVATION_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "revokedLicenseId",
  "revokedActivationId",
  "finalRevokeTokenHash",
  "finalControlRevision",
  "incidentId",
  "incidentNonce",
  "requestId",
  "requestHash",
  "installationId",
  "deviceKeyId",
  "newLicenseId",
  "newActivationId",
  "maximumFeatures",
] as const;

export function validateReactivationAuthorizationPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"reactivation-authorization"> {
  const path = "reactivation-authorization";
  const fields = fieldsFor(map, "reactivation-authorization", fail);
  assertExactFields(fields, REACTIVATION_FIELDS, [], fail, path);
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  for (const name of ["revokedLicenseId", "revokedActivationId", "incidentId", "requestId", "installationId", "newLicenseId", "newActivationId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  for (const name of ["finalRevokeTokenHash", "requestHash", "deviceKeyId"] as const) {
    requireHash(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requirePositiveCounter(field(fields, "finalControlRevision", fail, path), fail, joinPath(path, "finalControlRevision"));
  requireNonce(field(fields, "incidentNonce", fail, path), fail, joinPath(path, "incidentNonce"));
  validateFeatureArray(field(fields, "maximumFeatures", fail, path), fail, joinPath(path, "maximumFeatures"));
  return result("reactivation-authorization", map);
}

const RECOVERY_FIXED_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "licenseId",
  "activationId",
  "installationId",
  "incidentId",
  "incidentNonce",
  "requestId",
  "requestHash",
  "expectedStateGeneration",
  "newStateGeneration",
  "entitlementTokenId",
  "entitlementTokenHash",
  "entitlementGeneration",
  "controlRevision",
  "allowedTransition",
  "reasonCode",
  "maximumFeatures",
] as const;

export function validateRecoveryPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"recovery"> {
  const path = "recovery";
  const fields = fieldsFor(map, "recovery", fail);
  const transition = requireTextEnum(
    field(fields, "allowedTransition", fail, path),
    ["CLEAR_TAMPER", "REPAIR_SECURE_STATE", "REBIND_DEVICE"],
    fail,
    joinPath(path, "allowedTransition"),
  );
  const rebindFields = ["oldDeviceKeyId", "newDeviceKeyId", "newAssurance"] as const;
  if (transition === "REBIND_DEVICE") {
    for (const name of rebindFields) {
      if (!fields.has(name)) reject(fail, "SCHEMA", "REBIND_FIELDS_REQUIRED", joinPath(path, name));
    }
  } else {
    for (const name of rebindFields) {
      if (fields.has(name)) reject(fail, "SCHEMA", "REBIND_FIELDS_FORBIDDEN", joinPath(path, name));
    }
  }
  assertExactFields(
    fields,
    [...RECOVERY_FIXED_FIELDS, ...(transition === "REBIND_DEVICE" ? rebindFields : [])],
    [],
    fail,
    path,
  );
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  for (const name of ["licenseId", "activationId", "installationId", "incidentId", "requestId", "entitlementTokenId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  for (const name of ["requestHash", "entitlementTokenHash"] as const) {
    requireHash(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requireNonce(field(fields, "incidentNonce", fail, path), fail, joinPath(path, "incidentNonce"));
  requireCounter(field(fields, "expectedStateGeneration", fail, path), fail, joinPath(path, "expectedStateGeneration"));
  requirePositiveCounter(field(fields, "newStateGeneration", fail, path), fail, joinPath(path, "newStateGeneration"));
  requirePositiveCounter(field(fields, "entitlementGeneration", fail, path), fail, joinPath(path, "entitlementGeneration"));
  requireCounter(field(fields, "controlRevision", fail, path), fail, joinPath(path, "controlRevision"));
  const reason = requireCounter(field(fields, "reasonCode", fail, path), fail, joinPath(path, "reasonCode"));
  if (reason < 1n || reason > 7n) reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", joinPath(path, "reasonCode"));
  validateFeatureArray(field(fields, "maximumFeatures", fail, path), fail, joinPath(path, "maximumFeatures"));
  if (transition === "REBIND_DEVICE") {
    requireHash(field(fields, "oldDeviceKeyId", fail, path), fail, joinPath(path, "oldDeviceKeyId"), true);
    requireHash(field(fields, "newDeviceKeyId", fail, path), fail, joinPath(path, "newDeviceKeyId"));
    requireTextEnum(field(fields, "newAssurance", fail, path), ["TPM_ATTESTED", "SOFTWARE_BOUND"], fail, joinPath(path, "newAssurance"));
  }
  return result("recovery", map);
}

const TIME_CORRECTION_FIELDS = [
  ...VENDOR_COMMON_FIELDS,
  "edition",
  "licenseId",
  "activationId",
  "installationId",
  "deviceKeyId",
  "incidentId",
  "incidentNonce",
  "requestId",
  "requestHash",
  "expectedStateGeneration",
  "newStateGeneration",
  "timeCorrectionRevision",
  "preIncidentClockHighWater",
  "correctedUtc",
  "reasonCode",
] as const;

export function validateTimeCorrectionPayload(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<"time-correction"> {
  const path = "time-correction";
  const fields = fieldsFor(map, "time-correction", fail);
  assertExactFields(fields, TIME_CORRECTION_FIELDS, [], fail, path);
  validateVendorCommon(fields, fail, path);
  requireEdition(field(fields, "edition", fail, path), fail, joinPath(path, "edition"));
  for (const name of ["licenseId", "activationId", "installationId", "incidentId", "requestId"] as const) {
    requireOpaqueId(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  for (const name of ["deviceKeyId", "requestHash"] as const) {
    requireHash(field(fields, name, fail, path), fail, joinPath(path, name));
  }
  requireNonce(field(fields, "incidentNonce", fail, path), fail, joinPath(path, "incidentNonce"));
  requireCounter(field(fields, "expectedStateGeneration", fail, path), fail, joinPath(path, "expectedStateGeneration"));
  requirePositiveCounter(field(fields, "newStateGeneration", fail, path), fail, joinPath(path, "newStateGeneration"));
  requirePositiveCounter(field(fields, "timeCorrectionRevision", fail, path), fail, joinPath(path, "timeCorrectionRevision"));
  requireTimestamp(field(fields, "preIncidentClockHighWater", fail, path), fail, joinPath(path, "preIncidentClockHighWater"));
  requireTimestamp(field(fields, "correctedUtc", fail, path), fail, joinPath(path, "correctedUtc"));
  const reason = requireCounter(field(fields, "reasonCode", fail, path), fail, joinPath(path, "reasonCode"));
  if (reason < 1n || reason > 2n) reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", joinPath(path, "reasonCode"));
  return result("time-correction", map);
}

export const SIGNED_PAYLOAD_VALIDATORS = Object.freeze({
  "activation-request": validateActivationRequestPayload,
  "lease-request": validateLeaseRequestPayload,
  "key-delegation": validateKeyDelegationPayload,
  "key-denylist": validateKeyDenylistPayload,
  entitlement: validateEntitlementPayload,
  lease: validateLeasePayload,
  "offline-control": validateOfflineControlPayload,
  "reactivation-authorization": validateReactivationAuthorizationPayload,
  recovery: validateRecoveryPayload,
  "time-correction": validateTimeCorrectionPayload,
});

export function validateSignedPayload<T extends SignedTokenType>(
  expectedType: T,
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedSignedPayload<T> {
  // The cast is limited to the closed dispatch table; each validator narrows
  // and returns the same literal key that selected it.
  return SIGNED_PAYLOAD_VALIDATORS[expectedType](map, fail) as ValidatedSignedPayload<T>;
}

// Compile-time guard: every frozen signed type has exactly one validator.
const _validatorCoverage: Readonly<Record<SignedTokenType, unknown>> = SIGNED_PAYLOAD_VALIDATORS;
void _validatorCoverage;
