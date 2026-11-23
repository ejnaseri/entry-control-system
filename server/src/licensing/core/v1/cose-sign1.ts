import { copyBytes, unsignedBytesToBigInt } from "./bytes";
import { failLicenseCore } from "./errors";
import {
  decodeStrictCborV1,
  encodeDeterministicCborV1,
  type StrictCborMapNodeV1,
  type StrictCborNodeV1,
} from "./strict-cbor";

export const COSE_SIGN1_TAG_V1 = 18n;
export const COSE_ES256_ALGORITHM_V1 = -7n;
export const P256_ORDER_V1 =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
export const P256_HALF_ORDER_V1 =
  0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8n;

export interface CoseProtectedHeadersV1 {
  readonly algorithm: -7;
  readonly mediaType: string;
  /** A private copy of the exact 32-byte protected kid. */
  readonly kid: Uint8Array;
}

export interface CoseSignatureScalarsV1 {
  readonly r: bigint;
  readonly s: bigint;
}

export interface ParsedCoseSign1RawV1 {
  /** Exact complete tagged COSE_Sign1 bytes. */
  readonly complete: Uint8Array;
  /** Exact content of the protected-header bstr. */
  readonly protected: Uint8Array;
  /** Exact content of the embedded-payload bstr. */
  readonly payload: Uint8Array;
  /** Exact 64-byte IEEE P1363 R || S signature. */
  readonly signature: Uint8Array;
  /** Deterministic ["Signature1", protected, h'', payload] encoding. */
  readonly sigStructure: Uint8Array;
}

export interface ParsedCoseSign1V1 {
  readonly headers: CoseProtectedHeadersV1;
  readonly protectedMap: StrictCborMapNodeV1;
  readonly payload: StrictCborNodeV1;
  readonly signature: CoseSignatureScalarsV1;
  readonly raw: ParsedCoseSign1RawV1;
}

function requiredArrayItem(
  items: readonly StrictCborNodeV1[],
  index: number,
): StrictCborNodeV1 {
  const item = items[index];
  if (item === undefined) {
    failLicenseCore("COSE_PARSE", "INVALID_COSE_SHAPE", "COSE_Sign1 must contain exactly four items.");
  }
  return item;
}

function protectedHeaderValue(
  protectedMap: StrictCborMapNodeV1,
  label: bigint,
): StrictCborNodeV1 | undefined {
  for (const entry of protectedMap.entries) {
    if (entry.key.kind === "unsigned" && entry.key.integer === label) return entry.value;
  }
  return undefined;
}

function validateProtectedHeaderShape(protectedMap: StrictCborMapNodeV1): void {
  for (const label of [1n, 3n, 4n]) {
    if (protectedHeaderValue(protectedMap, label) === undefined) {
      failLicenseCore(
        "COSE_PARSE",
        "MISSING_PROTECTED_HEADER",
        "Protected COSE header is missing required label " + label.toString() + ".",
      );
    }
  }

  const hasUnknown = protectedMap.entries.some(
    (entry) =>
      entry.key.kind !== "unsigned" ||
      (entry.key.integer !== 1n && entry.key.integer !== 3n && entry.key.integer !== 4n),
  );
  if (hasUnknown || protectedMap.entries.length !== 3) {
    failLicenseCore(
      "COSE_PARSE",
      "UNKNOWN_PROTECTED_HEADER",
      "Protected COSE header must contain exactly labels 1, 3, and 4.",
    );
  }
}

function parseProtectedHeaders(
  protectedMap: StrictCborMapNodeV1,
  expectedMediaType: string,
): CoseProtectedHeadersV1 {
  validateProtectedHeaderShape(protectedMap);
  const algorithm = protectedHeaderValue(protectedMap, 1n);
  const mediaType = protectedHeaderValue(protectedMap, 3n);
  const kid = protectedHeaderValue(protectedMap, 4n);

  if (algorithm?.kind !== "negative" || algorithm.integer !== COSE_ES256_ALGORITHM_V1) {
    failLicenseCore("COSE_PARSE", "WRONG_ALGORITHM", "Protected alg must be ES256 (-7).");
  }
  if (mediaType?.kind !== "text") {
    failLicenseCore(
      "COSE_PARSE",
      "WRONG_HEADER_TYPE",
      "Protected content type must be a text string.",
    );
  }
  if (kid?.kind !== "bytes") {
    failLicenseCore("COSE_PARSE", "WRONG_HEADER_TYPE", "Protected kid must be a byte string.");
  }
  if (kid.bytes.byteLength !== 32) {
    failLicenseCore("COSE_PARSE", "WRONG_KEY_ID_LENGTH", "Protected kid must be exactly 32 bytes.");
  }
  if (mediaType.text !== expectedMediaType) {
    failLicenseCore(
      "DOMAIN",
      "MEDIA_TYPE_MISMATCH",
      "Protected media type does not match the selected signed-object contract.",
    );
  }

  return Object.freeze({
    algorithm: -7,
    mediaType: mediaType.text,
    kid: copyBytes(kid.bytes),
  });
}

function parseSignature(signatureNode: StrictCborNodeV1): {
  readonly raw: Uint8Array;
  readonly scalars: CoseSignatureScalarsV1;
} {
  if (signatureNode.kind !== "bytes" || signatureNode.bytes.byteLength !== 64) {
    failLicenseCore(
      "SIGNATURE",
      "INVALID_SIGNATURE_ENCODING",
      "ES256 signature must be a 64-byte IEEE P1363 byte string.",
    );
  }

  const raw = copyBytes(signatureNode.bytes);
  const r = unsignedBytesToBigInt(raw.subarray(0, 32));
  const s = unsignedBytesToBigInt(raw.subarray(32, 64));
  if (r <= 0n || r >= P256_ORDER_V1 || s <= 0n || s >= P256_ORDER_V1) {
    failLicenseCore(
      "SIGNATURE",
      "INVALID_ECDSA_SCALAR",
      "ES256 signature scalar is outside the P-256 range.",
    );
  }
  if (s > P256_HALF_ORDER_V1) {
    failLicenseCore(
      "SIGNATURE",
      "NON_CANONICAL_SIGNATURE",
      "High-S ES256 signatures are forbidden.",
    );
  }

  return Object.freeze({
    raw,
    scalars: Object.freeze({ r, s }),
  });
}

/**
 * Parse the exact Licensing v1 tagged COSE_Sign1 profile without performing
 * public-key lookup or cryptographic signature verification.
 */
export function parseCoseSign1V1(
  input: Uint8Array,
  expectedMediaType: string,
  maximumBytes: number,
): ParsedCoseSign1V1 {
  if (typeof expectedMediaType !== "string" || expectedMediaType.length === 0) {
    throw new TypeError("expectedMediaType must be a non-empty string.");
  }

  // COSE nil is retained only long enough to classify detached payloads.
  const outer = decodeStrictCborV1(input, maximumBytes, {
    allowRootTag: true,
    allowNull: true,
  });
  if (outer.kind !== "tag" || outer.tag !== COSE_SIGN1_TAG_V1) {
    failLicenseCore("COSE_PARSE", "WRONG_COSE_TAG", "COSE tag 18 is required.");
  }
  if (outer.item.kind !== "array" || outer.item.items.length !== 4) {
    failLicenseCore(
      "COSE_PARSE",
      "INVALID_COSE_SHAPE",
      "COSE_Sign1 must contain exactly four items.",
    );
  }

  const protectedNode = requiredArrayItem(outer.item.items, 0);
  const unprotectedNode = requiredArrayItem(outer.item.items, 1);
  const payloadNode = requiredArrayItem(outer.item.items, 2);
  const signatureNode = requiredArrayItem(outer.item.items, 3);

  if (protectedNode.kind !== "bytes") {
    failLicenseCore(
      "COSE_PARSE",
      "INVALID_PROTECTED_HEADER",
      "Protected COSE header must be a byte string.",
    );
  }
  if (unprotectedNode.kind !== "map" || unprotectedNode.entries.length !== 0) {
    failLicenseCore(
      "COSE_PARSE",
      "UNPROTECTED_HEADER_NOT_EMPTY",
      "Unprotected COSE headers must be an empty map.",
    );
  }
  if (payloadNode.kind === "null") {
    failLicenseCore(
      "COSE_PARSE",
      "DETACHED_PAYLOAD_FORBIDDEN",
      "Detached COSE payloads are forbidden.",
    );
  }
  if (payloadNode.kind !== "bytes") {
    failLicenseCore(
      "COSE_PARSE",
      "INVALID_COSE_PAYLOAD",
      "COSE payload must be an embedded byte string.",
    );
  }

  // Decode both embedded CBOR regions before evaluating their domain or
  // signature semantics, preserving the frozen validation order.
  const protectedDecoded = decodeStrictCborV1(
    protectedNode.bytes,
    protectedNode.bytes.byteLength,
  );
  // Preserve payload null nodes so the exact closed schema can report the
  // frozen SCHEMA/NULL_FIELD_FORBIDDEN classification. A standalone strict
  // decode still rejects null unless this explicit policy is selected.
  const payloadDecoded = decodeStrictCborV1(payloadNode.bytes, payloadNode.bytes.byteLength, {
    allowNull: true,
  });
  if (protectedDecoded.kind !== "map") {
    failLicenseCore(
      "COSE_PARSE",
      "INVALID_PROTECTED_HEADER",
      "Protected COSE bytes must encode a map.",
    );
  }

  const headers = parseProtectedHeaders(protectedDecoded, expectedMediaType);
  const parsedSignature = parseSignature(signatureNode);
  const protectedBytes = copyBytes(protectedNode.bytes);
  const payloadBytes = copyBytes(payloadNode.bytes);
  const sigStructure = encodeDeterministicCborV1([
    "Signature1",
    protectedBytes,
    new Uint8Array(0),
    payloadBytes,
  ]);

  const raw: ParsedCoseSign1RawV1 = Object.freeze({
    complete: copyBytes(outer.raw),
    protected: copyBytes(protectedBytes),
    payload: copyBytes(payloadBytes),
    signature: copyBytes(parsedSignature.raw),
    sigStructure: copyBytes(sigStructure),
  });

  return Object.freeze({
    headers,
    protectedMap: protectedDecoded,
    payload: payloadDecoded,
    signature: parsedSignature.scalars,
    raw,
  });
}
