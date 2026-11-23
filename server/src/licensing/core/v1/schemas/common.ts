import { FEATURES, LIMITS, PRODUCT_ID, PROTOCOL_VERSION } from "../protocol";
import { immutableDataView } from "../bytes";
import { parseCanonicalSemVer, SemVerSyntaxError } from "../semver";
import type {
  CborArray,
  CborMap,
  CborValue,
  Edition,
  Feature,
  NormalizedCborValue,
  ProtocolRecord,
  SchemaFailureReporter,
  SignedTokenType,
  VerificationStage,
} from "../types";

export class SchemaValidationError extends Error {
  readonly stage: VerificationStage;
  readonly code: string;
  readonly path?: string;

  constructor(stage: VerificationStage, code: string, path?: string) {
    super(path === undefined ? `${stage}/${code}` : `${stage}/${code} at ${path}`);
    this.name = "SchemaValidationError";
    this.stage = stage;
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

export const throwSchemaFailure: SchemaFailureReporter = (stage, code, path): never => {
  throw new SchemaValidationError(stage, code, path);
};

export function reject(
  fail: SchemaFailureReporter,
  stage: VerificationStage,
  code: string,
  path: string,
): never {
  return fail(stage, code, path);
}

export function joinPath(parent: string, child: string): string {
  return parent.length === 0 ? child : `${parent}.${child}`;
}

export function requireMap(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): CborMap {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind !== "map") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  return value;
}

export function textMap(
  map: CborMap,
  fail: SchemaFailureReporter,
  path: string,
): ReadonlyMap<string, CborValue> {
  const output = new Map<string, CborValue>();
  for (const entry of map.entries) {
    if (entry.key.kind !== "text") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
    if (output.has(entry.key.text)) reject(fail, "CBOR_PARSE", "DUPLICATE_MAP_KEY", path);
    output.set(entry.key.text, entry.value);
  }
  return output;
}

export function assertExactFields(
  fields: ReadonlyMap<string, CborValue>,
  required: readonly string[],
  optional: readonly string[],
  fail: SchemaFailureReporter,
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const [name, value] of fields) {
    const fieldPath = joinPath(path, name);
    if (!allowed.has(name)) reject(fail, "SCHEMA", "UNKNOWN_FIELD", fieldPath);
    if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", fieldPath);
  }
  for (const name of required) {
    if (!fields.has(name)) reject(fail, "SCHEMA", "MISSING_REQUIRED_FIELD", joinPath(path, name));
  }
}

export function field(
  fields: ReadonlyMap<string, CborValue>,
  name: string,
  fail: SchemaFailureReporter,
  path: string,
): CborValue {
  const value = fields.get(name);
  if (value === undefined) reject(fail, "SCHEMA", "MISSING_REQUIRED_FIELD", joinPath(path, name));
  return value;
}

export function optionalField(
  fields: ReadonlyMap<string, CborValue>,
  name: string,
): CborValue | undefined {
  return fields.get(name);
}

export function requireText(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): string {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind !== "text") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  return value.text;
}

export function requireTextLiteral<T extends string>(
  value: CborValue,
  expected: T,
  fail: SchemaFailureReporter,
  path: string,
  code = "WRONG_FIELD_TYPE",
): T {
  if (requireText(value, fail, path) !== expected) reject(fail, "SCHEMA", code, path);
  return expected;
}

export function requireTextEnum<T extends string>(
  value: CborValue,
  allowed: readonly T[],
  fail: SchemaFailureReporter,
  path: string,
  code = "WRONG_FIELD_TYPE",
): T {
  const text = requireText(value, fail, path);
  if (!allowed.includes(text as T)) reject(fail, "SCHEMA", code, path);
  return text as T;
}

export function requireUnsigned(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
  code = "WRONG_FIELD_TYPE",
): bigint {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind !== "unsigned" || value.integer < 0n) reject(fail, "SCHEMA", code, path);
  return value.integer;
}

export function requireExactUnsigned(
  value: CborValue,
  expected: bigint,
  fail: SchemaFailureReporter,
  path: string,
  code = "WRONG_FIELD_TYPE",
): bigint {
  const actual = requireUnsigned(value, fail, path, code);
  if (actual !== expected) reject(fail, "SCHEMA", code, path);
  return actual;
}

export function requireCounter(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): bigint {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind === "negative") reject(fail, "SCHEMA", "COUNTER_OUT_OF_RANGE", path);
  if (value.kind !== "unsigned") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  const integer = value.integer;
  if (integer > LIMITS.counterMaximum) reject(fail, "SCHEMA", "COUNTER_OUT_OF_RANGE", path);
  return integer;
}

export function requirePositiveCounter(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): bigint {
  const integer = requireCounter(value, fail, path);
  if (integer === 0n) reject(fail, "SCHEMA", "COUNTER_OUT_OF_RANGE", path);
  return integer;
}

export function requireTimestamp(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): bigint {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind === "negative") reject(fail, "SCHEMA", "TIMESTAMP_OUT_OF_RANGE", path);
  if (value.kind !== "unsigned") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  const integer = value.integer;
  if (integer > LIMITS.timestampMaximum) reject(fail, "SCHEMA", "TIMESTAMP_OUT_OF_RANGE", path);
  return integer;
}

export function requireBytes(
  value: CborValue,
  minimum: number,
  maximum: number,
  fail: SchemaFailureReporter,
  path: string,
  lengthCode = "WRONG_FIELD_TYPE",
  emptyCode?: string,
): Uint8Array {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind !== "bytes") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  if (value.bytes.length === 0 && emptyCode !== undefined) reject(fail, "SCHEMA", emptyCode, path);
  if (value.bytes.length < minimum || value.bytes.length > maximum) {
    reject(fail, "SCHEMA", lengthCode, path);
  }
  return value.bytes;
}

export function requireOpaqueId(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
  optional = false,
): Uint8Array {
  return requireBytes(
    value,
    LIMITS.identifierBytes,
    LIMITS.identifierBytes,
    fail,
    path,
    "WRONG_ID_LENGTH",
    optional ? "EMPTY_OPTIONAL_FIELD" : undefined,
  );
}

export function requireHash(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
  optional = false,
): Uint8Array {
  return requireBytes(
    value,
    LIMITS.hashBytes,
    LIMITS.hashBytes,
    fail,
    path,
    "WRONG_HASH_LENGTH",
    optional ? "EMPTY_OPTIONAL_FIELD" : undefined,
  );
}

export function requireNonce(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): Uint8Array {
  return requireBytes(
    value,
    LIMITS.nonceBytes,
    LIMITS.nonceBytes,
    fail,
    path,
    "WRONG_NONCE_LENGTH",
  );
}

export function requireP256Spki(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): Uint8Array {
  // A one-byte-longer BER encoding of the same P-256 SPKI is structurally a
  // key candidate, but it is not canonical protocol DER. Let the CLAIMS
  // canonicality check distinguish it from a genuinely different curve
  // (the frozen P-384 negative is much larger).
  return requireBytes(
    value,
    LIMITS.spkiDerBytes,
    LIMITS.spkiDerBytes + 1,
    fail,
    path,
    "WRONG_KEY_CURVE",
  );
}

export function requireArray(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): CborArray {
  if (value.kind === "null") reject(fail, "SCHEMA", "NULL_FIELD_FORBIDDEN", path);
  if (value.kind !== "array") reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  return value;
}

function utf8ByteLength(input: string): number {
  let bytes = 0;
  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function requireDisplayText(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): string {
  const text = requireText(value, fail, path);
  if (text.length === 0) reject(fail, "SCHEMA", "EMPTY_OPTIONAL_FIELD", path);
  if (utf8ByteLength(text) > LIMITS.displayTextMaximumUtf8Bytes || text.normalize("NFC") !== text) {
    reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  }
  return text;
}

export function requireSemVerText(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): string {
  const text = requireText(value, fail, path);
  try {
    parseCanonicalSemVer(text);
  } catch (error) {
    if (error instanceof SemVerSyntaxError) reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
    throw error;
  }
  return text;
}

export function requireEdition(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): Edition {
  return requireTextEnum(value, ["FULL", "ATTENDANCE"], fail, path);
}

export function validateFeatureArray(
  value: CborValue,
  fail: SchemaFailureReporter,
  path: string,
): readonly Feature[] {
  const array = requireArray(value, fail, path);
  if (
    array.items.length < LIMITS.featureMinimumItems ||
    array.items.length > LIMITS.featureMaximumItems
  ) {
    reject(fail, "SCHEMA", "WRONG_FIELD_TYPE", path);
  }
  const allowed = FEATURES as readonly Feature[];
  const result: Feature[] = [];
  const seen = new Set<string>();
  let previous: string | undefined;
  for (let index = 0; index < array.items.length; index += 1) {
    const item = array.items[index];
    if (item === undefined) throw new Error("Unreachable feature index.");
    const itemPath = `${path}[${index}]`;
    const feature = requireTextEnum(item, allowed, fail, itemPath);
    if (seen.has(feature)) reject(fail, "SCHEMA", "DUPLICATE_SET_MEMBER", itemPath);
    if (previous !== undefined && previous >= feature) {
      reject(fail, "SCHEMA", "SET_NOT_CANONICAL", itemPath);
    }
    seen.add(feature);
    previous = feature;
    result.push(feature);
  }
  return Object.freeze(result);
}

export function validateControlSnapshot(
  fields: ReadonlyMap<string, CborValue>,
  fail: SchemaFailureReporter,
  path: string,
): void {
  const revision = requireCounter(field(fields, "controlRevision", fail, path), fail, joinPath(path, "controlRevision"));
  const state = requireTextEnum(
    field(fields, "controlState", fail, path),
    ["OPERATIONAL", "SUSPENDED", "REVOKED"],
    fail,
    joinPath(path, "controlState"),
  );
  if (revision === 0n && state !== "OPERATIONAL") {
    reject(fail, "SCHEMA", "INVALID_CONTROL_SNAPSHOT", joinPath(path, "controlState"));
  }
}

export function validateControlTuple(
  fields: ReadonlyMap<string, CborValue>,
  fail: SchemaFailureReporter,
  path: string,
  allowRevoked: boolean,
): void {
  const revisionPath = joinPath(path, "controlRevision");
  const statePath = joinPath(path, "controlState");
  const effectivePath = joinPath(path, "controlEffectiveAt");
  const reasonPath = joinPath(path, "controlReasonCode");
  const revision = requireCounter(field(fields, "controlRevision", fail, path), fail, revisionPath);
  const state = requireTextEnum(
    field(fields, "controlState", fail, path),
    ["OPERATIONAL", "SUSPENDED", "REVOKED"],
    fail,
    statePath,
  );
  const effectiveAt = requireTimestamp(field(fields, "controlEffectiveAt", fail, path), fail, effectivePath);
  const reason = requireCounter(field(fields, "controlReasonCode", fail, path), fail, reasonPath);
  if (!allowRevoked && state === "REVOKED") {
    reject(fail, "SCHEMA", "CONTROL_SIGNER_PURPOSE_VIOLATION", statePath);
  }
  if (revision === 0n) {
    if (state !== "OPERATIONAL" || effectiveAt !== 0n || reason !== 0n) {
      reject(fail, "SCHEMA", "INVALID_CONTROL_TUPLE", path);
    }
  } else if (reason < 1n || reason > 5n) {
    reject(fail, "SCHEMA", "INVALID_CONTROL_TUPLE", reasonPath);
  }
}

export function validateDomain(
  fields: ReadonlyMap<string, CborValue>,
  expectedType: SignedTokenType,
  fail: SchemaFailureReporter,
  path: string,
): void {
  const protocol = fields.get("protocolVersion");
  if (protocol === undefined || protocol.kind !== "unsigned" || protocol.integer !== BigInt(PROTOCOL_VERSION)) {
    reject(fail, "DOMAIN", "PROTOCOL_VERSION_MISMATCH", joinPath(path, "protocolVersion"));
  }
  const tokenType = fields.get("tokenType");
  if (tokenType === undefined || tokenType.kind !== "text" || tokenType.text !== expectedType) {
    reject(fail, "DOMAIN", "TOKEN_TYPE_MISMATCH", joinPath(path, "tokenType"));
  }
}

export function validateVendorCommon(
  fields: ReadonlyMap<string, CborValue>,
  fail: SchemaFailureReporter,
  path: string,
): void {
  requireOpaqueId(field(fields, "tokenId", fail, path), fail, joinPath(path, "tokenId"));
  requireHash(field(fields, "keyId", fail, path), fail, joinPath(path, "keyId"));
  requireTimestamp(field(fields, "issuedAt", fail, path), fail, joinPath(path, "issuedAt"));
  requireTimestamp(field(fields, "notBefore", fail, path), fail, joinPath(path, "notBefore"));
  requireTimestamp(field(fields, "notAfter", fail, path), fail, joinPath(path, "notAfter"));
  requireTextLiteral(field(fields, "productId", fail, path), PRODUCT_ID, fail, joinPath(path, "productId"));
}

function copyBytes(bytes: Uint8Array): Readonly<Uint8Array> {
  return bytes.slice();
}

export function normalizeValue(value: CborValue): NormalizedCborValue {
  switch (value.kind) {
    case "unsigned":
    case "negative":
      return value.integer;
    case "bytes":
      return copyBytes(value.bytes);
    case "text":
      return value.text;
    case "boolean":
      return value.boolean;
    case "array":
      return Object.freeze(value.items.map((item) => normalizeValue(item)));
    case "map":
      return normalizeTextRecord(value);
    case "null":
    case "tag":
      throw new Error(`Cannot normalize rejected CBOR ${value.kind} value.`);
  }
}

export function normalizeTextRecord(map: CborMap): ProtocolRecord {
  const output: Record<string, NormalizedCborValue> = Object.create(null) as Record<
    string,
    NormalizedCborValue
  >;
  for (const entry of map.entries) {
    if (entry.key.kind !== "text") throw new Error("Cannot normalize a non-text-keyed protocol map.");
    output[entry.key.text] = normalizeValue(entry.value);
  }
  return immutableDataView(output);
}
