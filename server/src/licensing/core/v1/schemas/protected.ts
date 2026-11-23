import { exactMediaType } from "../protocol";
import type { CborMap, CborValue, KeyId, SchemaFailureReporter, SignedTokenType } from "../types";
import { reject, throwSchemaFailure } from "./common";

export interface ValidatedProtectedHeaders<T extends SignedTokenType> {
  readonly tokenType: T;
  readonly algorithm: -7n;
  readonly mediaType: string;
  readonly kid: KeyId;
}

export function validateProtectedHeaders<T extends SignedTokenType>(
  expectedType: T,
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): ValidatedProtectedHeaders<T> {
  const headers = new Map<bigint, CborValue>();
  for (const entry of map.entries) {
    if (entry.key.kind !== "unsigned") {
      reject(fail, "COSE_PARSE", "UNKNOWN_PROTECTED_HEADER", "protected");
    }
    if (headers.has(entry.key.integer)) {
      reject(fail, "CBOR_PARSE", "DUPLICATE_MAP_KEY", "protected");
    }
    headers.set(entry.key.integer, entry.value);
  }
  for (const label of headers.keys()) {
    if (label !== 1n && label !== 3n && label !== 4n) {
      reject(fail, "COSE_PARSE", "UNKNOWN_PROTECTED_HEADER", `protected[${label}]`);
    }
  }
  for (const label of [1n, 3n, 4n]) {
    if (!headers.has(label)) reject(fail, "COSE_PARSE", "MISSING_PROTECTED_HEADER", `protected[${label}]`);
  }

  const algorithm = headers.get(1n);
  if (algorithm?.kind !== "negative" || algorithm.integer !== -7n) {
    reject(fail, "COSE_PARSE", "WRONG_ALGORITHM", "protected[1]");
  }
  const contentType = headers.get(3n);
  if (contentType?.kind !== "text") {
    reject(fail, "COSE_PARSE", "WRONG_HEADER_TYPE", "protected[3]");
  }
  const expectedMediaType = exactMediaType(expectedType);
  if (contentType.text !== expectedMediaType) {
    reject(fail, "DOMAIN", "MEDIA_TYPE_MISMATCH", "protected[3]");
  }
  const kid = headers.get(4n);
  if (kid?.kind !== "bytes") reject(fail, "COSE_PARSE", "WRONG_HEADER_TYPE", "protected[4]");
  if (kid.bytes.length !== 32) reject(fail, "COSE_PARSE", "WRONG_KEY_ID_LENGTH", "protected[4]");

  return Object.freeze({
    tokenType: expectedType,
    algorithm: -7n as const,
    mediaType: expectedMediaType,
    kid: kid.bytes.slice(),
  });
}

export function validateEmptyUnprotectedHeaders(
  map: CborMap,
  fail: SchemaFailureReporter = throwSchemaFailure,
): void {
  if (map.entries.length !== 0) {
    reject(fail, "COSE_PARSE", "UNPROTECTED_HEADER_NOT_EMPTY", "unprotected");
  }
}
