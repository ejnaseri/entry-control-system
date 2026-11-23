import { LIMITS } from "../protocol";
import type {
  CarrierByType,
  CarrierType,
  CborMap,
  ProtocolRecord,
  SchemaFailureReporter,
  ValidatedCarrier,
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
  requireExactUnsigned,
  requireNonce,
  requireOpaqueId,
  requireTextLiteral,
  textMap,
  throwSchemaFailure,
} from "./common";

function carrierResult<T extends CarrierType>(
  carrierType: T,
  map: CborMap,
  variant: ValidatedCarrier<T>["variant"],
): ValidatedCarrier<T> {
  const decoded: ProtocolRecord = normalizeTextRecord(map);
  return Object.freeze({
    carrierType,
    decoded,
    carrier: decoded as unknown as CarrierByType[T],
    variant,
  });
}

export function validateLeaseChallengeCarrier(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedCarrier<"lease-challenge"> {
  const path = "lease-challenge";
  const fields = textMap(map, fail, path);
  assertExactFields(
    fields,
    ["schemaVersion", "carrierType", "requestNonce", "expiresInSeconds"],
    [],
    fail,
    path,
  );
  requireExactUnsigned(field(fields, "schemaVersion", fail, path), 1n, fail, joinPath(path, "schemaVersion"));
  requireTextLiteral(field(fields, "carrierType", fail, path), "lease-challenge", fail, joinPath(path, "carrierType"));
  requireNonce(field(fields, "requestNonce", fail, path), fail, joinPath(path, "requestNonce"));
  requireExactUnsigned(field(fields, "expiresInSeconds", fail, path), 300n, fail, joinPath(path, "expiresInSeconds"));
  return carrierResult("lease-challenge", map, "STANDARD");
}

export function validateTrustBundleCarrier(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedCarrier<"trust-bundle"> {
  const path = "trust-bundle";
  const fields = textMap(map, fail, path);
  assertExactFields(fields, ["schemaVersion", "carrierType", "delegations", "denylist"], [], fail, path);
  requireExactUnsigned(field(fields, "schemaVersion", fail, path), 1n, fail, joinPath(path, "schemaVersion"));
  requireTextLiteral(field(fields, "carrierType", fail, path), "trust-bundle", fail, joinPath(path, "carrierType"));
  const delegationsPath = joinPath(path, "delegations");
  const delegations = requireArray(field(fields, "delegations", fail, path), fail, delegationsPath);
  if (delegations.items.length < 1 || delegations.items.length > LIMITS.trustBundleMaximumDelegations) {
    reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", delegationsPath);
  }
  for (let index = 0; index < delegations.items.length; index += 1) {
    const item = delegations.items[index];
    if (item === undefined) throw new Error("Unreachable trust-bundle index.");
    requireBytes(item, 1, 8_192, fail, `${delegationsPath}[${index}]`);
  }
  requireBytes(field(fields, "denylist", fail, path), 1, 262_144, fail, joinPath(path, "denylist"));
  return carrierResult("trust-bundle", map, "STANDARD");
}

export function validateLeaseResponseCarrier(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedCarrier<"lease-response"> {
  const path = "lease-response";
  const fields = textMap(map, fail, path);
  const common = ["schemaVersion", "carrierType", "requestId"] as const;
  const embedded = ["lease", "offlineControl", "reactivationAuthorization", "trustBundle"] as const;
  assertExactFields(fields, common, embedded, fail, path);
  requireExactUnsigned(field(fields, "schemaVersion", fail, path), 1n, fail, joinPath(path, "schemaVersion"));
  requireTextLiteral(field(fields, "carrierType", fail, path), "lease-response", fail, joinPath(path, "carrierType"));
  requireOpaqueId(field(fields, "requestId", fail, path), fail, joinPath(path, "requestId"));

  const hasLease = fields.has("lease");
  const hasControl = fields.has("offlineControl");
  const hasReactivation = fields.has("reactivationAuthorization");
  let variant: "WITH_LEASE" | "CONTROL_ONLY" | "REACTIVATION_ONLY";
  if (hasLease) variant = "WITH_LEASE";
  else if (hasControl) variant = "CONTROL_ONLY";
  else if (hasReactivation) variant = "REACTIVATION_ONLY";
  else reject(fail, "SCHEMA", "MISSING_REQUIRED_FIELD", joinPath(path, "lease"));

  const lease = optionalField(fields, "lease");
  if (lease !== undefined) requireBytes(lease, 1, 16_384, fail, joinPath(path, "lease"), "WRONG_FIELD_TYPE", "EMPTY_OPTIONAL_FIELD");
  const control = optionalField(fields, "offlineControl");
  if (control !== undefined) requireBytes(control, 1, 8_192, fail, joinPath(path, "offlineControl"), "WRONG_FIELD_TYPE", "EMPTY_OPTIONAL_FIELD");
  const reactivation = optionalField(fields, "reactivationAuthorization");
  if (reactivation !== undefined) requireBytes(reactivation, 1, 16_384, fail, joinPath(path, "reactivationAuthorization"), "WRONG_FIELD_TYPE", "EMPTY_OPTIONAL_FIELD");
  const trust = optionalField(fields, "trustBundle");
  if (trust !== undefined) requireBytes(trust, 1, 491_520, fail, joinPath(path, "trustBundle"), "WRONG_FIELD_TYPE", "EMPTY_OPTIONAL_FIELD");

  return carrierResult("lease-response", map, variant);
}

export const CARRIER_VALIDATORS = Object.freeze({
  "lease-challenge": validateLeaseChallengeCarrier,
  "lease-response": validateLeaseResponseCarrier,
  "trust-bundle": validateTrustBundleCarrier,
});

export function validateCarrier<T extends CarrierType>(
  expectedType: T,
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedCarrier<T> {
  return CARRIER_VALIDATORS[expectedType](map, fail) as ValidatedCarrier<T>;
}

const _carrierCoverage: Readonly<Record<CarrierType, unknown>> = CARRIER_VALIDATORS;
void _carrierCoverage;
