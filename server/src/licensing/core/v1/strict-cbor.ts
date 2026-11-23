import {
  bytesToHex,
  compareBytes,
  concatBytes,
  copyBytes,
  unsignedBigIntToFixedBytes,
} from "./bytes";
import { failLicenseCore } from "./errors";

const UINT8_MAX = 0xffn;
const UINT16_MAX = 0xffffn;
const UINT32_MAX = 0xffffffffn;
const UINT64_MAX = 0xffffffffffffffffn;
const DEFAULT_MAXIMUM_DEPTH = 64;
const DEFAULT_MAXIMUM_NODES = 65_536;

const UTF8_DECODER = new TextDecoder("utf-8", {
  fatal: true,
  // Preserve an encoded U+FEFF instead of treating it as transport metadata.
  ignoreBOM: true,
});
const UTF8_ENCODER = new TextEncoder();

interface StrictCborNodeBaseV1 {
  readonly startOffset: number;
  readonly endOffset: number;
  /** Shared CborValue contract name for the exact encoded node bytes. */
  readonly encoded: Uint8Array;
  /** A private copy of the exact encoded bytes for this node. */
  readonly raw: Uint8Array;
}

export interface StrictCborUnsignedNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "unsigned";
  readonly integer: bigint;
}

export interface StrictCborNegativeNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "negative";
  readonly integer: bigint;
}

export interface StrictCborByteStringNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "bytes";
  /** A private copy of the byte-string content, without its CBOR head. */
  readonly bytes: Uint8Array;
}

export interface StrictCborTextStringNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "text";
  readonly text: string;
}

export interface StrictCborArrayNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "array";
  readonly items: readonly StrictCborNodeV1[];
}

export interface StrictCborMapEntryV1 {
  readonly key: StrictCborNodeV1;
  readonly value: StrictCborNodeV1;
  readonly startOffset: number;
  readonly endOffset: number;
  /** Exact key-and-value bytes in their source order. */
  readonly raw: Uint8Array;
}

export interface StrictCborMapNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "map";
  /** Entries remain ordered exactly as encoded; they are never object-coerced. */
  readonly entries: readonly StrictCborMapEntryV1[];
}

export interface StrictCborTagNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "tag";
  readonly tag: bigint;
  readonly item: StrictCborNodeV1;
}

export interface StrictCborBooleanNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "boolean";
  readonly boolean: boolean;
}

export interface StrictCborNullNodeV1 extends StrictCborNodeBaseV1 {
  readonly kind: "null";
}

export type StrictCborNodeV1 =
  | StrictCborUnsignedNodeV1
  | StrictCborNegativeNodeV1
  | StrictCborByteStringNodeV1
  | StrictCborTextStringNodeV1
  | StrictCborArrayNodeV1
  | StrictCborMapNodeV1
  | StrictCborTagNodeV1
  | StrictCborBooleanNodeV1
  | StrictCborNullNodeV1;

export interface StrictCborDecodeOptionsV1 {
  /** Only a tag directly wrapping the root item is preserved when enabled. */
  readonly allowRootTag?: boolean;
  /** Used solely so a surrounding closed format can classify a forbidden nil. */
  readonly allowNull?: boolean;
  readonly maximumDepth?: number;
  readonly maximumNodes?: number;
}

export interface DeterministicCborTagV1 {
  readonly kind: "tag";
  readonly tag: number | bigint;
  readonly value: DeterministicCborValueV1;
}

export type DeterministicCborValueV1 =
  | number
  | bigint
  | string
  | boolean
  | Uint8Array
  | readonly DeterministicCborValueV1[]
  | ReadonlyMap<DeterministicCborValueV1, DeterministicCborValueV1>
  | DeterministicCborTagV1;

interface DecodeStateV1 {
  readonly bytes: Uint8Array;
  readonly allowRootTag: boolean;
  readonly allowNull: boolean;
  readonly maximumDepth: number;
  readonly maximumNodes: number;
  offset: number;
  nodeCount: number;
}

function assertLimit(value: number, label: string, allowZero: boolean): void {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a ${allowZero ? "non-negative" : "positive"} safe integer.`);
  }
}

function rawSlice(state: DecodeStateV1, startOffset: number, endOffset: number): Uint8Array {
  return state.bytes.slice(startOffset, endOffset);
}

function nodeBytes(
  state: DecodeStateV1,
  startOffset: number,
  endOffset: number,
): Readonly<{ encoded: Uint8Array; raw: Uint8Array }> {
  const exact = rawSlice(state, startOffset, endOffset);
  return { encoded: exact, raw: exact };
}

function enterNode(state: DecodeStateV1, depth: number): void {
  if (depth > state.maximumDepth) {
    failLicenseCore(
      "CBOR_PARSE",
      "CBOR_LIMIT_EXCEEDED",
      `CBOR nesting exceeds the configured maximum depth of ${state.maximumDepth}.`,
    );
  }
  state.nodeCount += 1;
  if (state.nodeCount > state.maximumNodes) {
    failLicenseCore(
      "CBOR_PARSE",
      "CBOR_LIMIT_EXCEEDED",
      `CBOR node count exceeds the configured maximum of ${state.maximumNodes}.`,
    );
  }
}

function readUnsigned(state: DecodeStateV1, width: number): bigint {
  if (state.offset + width > state.bytes.byteLength) {
    failLicenseCore("CBOR_PARSE", "CBOR_TRUNCATED", "Truncated CBOR integer or length.");
  }

  let value = 0n;
  const endOffset = state.offset + width;
  while (state.offset < endOffset) {
    value = (value << 8n) | BigInt(state.bytes[state.offset] ?? 0);
    state.offset += 1;
  }
  return value;
}

function readArgument(state: DecodeStateV1, additionalInformation: number): bigint {
  if (additionalInformation < 24) return BigInt(additionalInformation);
  if (additionalInformation === 31) {
    failLicenseCore("CBOR_PARSE", "INDEFINITE_LENGTH", "Indefinite-length CBOR is forbidden.");
  }

  let width: number;
  let minimum: bigint;
  switch (additionalInformation) {
    case 24:
      width = 1;
      minimum = 24n;
      break;
    case 25:
      width = 2;
      minimum = 0x100n;
      break;
    case 26:
      width = 4;
      minimum = 0x10000n;
      break;
    case 27:
      width = 8;
      minimum = 0x100000000n;
      break;
    default:
      failLicenseCore(
        "CBOR_PARSE",
        "CBOR_MALFORMED",
        "Reserved CBOR additional-information value.",
      );
  }

  const value = readUnsigned(state, width);
  if (value < minimum) {
    failLicenseCore(
      "CBOR_PARSE",
      "NON_CANONICAL_CBOR",
      "CBOR integer, length, or tag is not minimally encoded.",
    );
  }
  return value;
}

function collectionLength(
  state: DecodeStateV1,
  argument: bigint,
  minimumBytesPerItem: number,
): number {
  const remainingBytes = state.bytes.byteLength - state.offset;
  if (argument > BigInt(Math.floor(remainingBytes / minimumBytesPerItem))) {
    failLicenseCore("CBOR_PARSE", "CBOR_TRUNCATED", "Truncated CBOR collection.");
  }
  if (argument > BigInt(Number.MAX_SAFE_INTEGER)) {
    failLicenseCore("CBOR_PARSE", "CBOR_LIMIT_EXCEEDED", "CBOR collection length is too large.");
  }
  return Number(argument);
}

function stringLength(state: DecodeStateV1, argument: bigint): number {
  const remainingBytes = state.bytes.byteLength - state.offset;
  if (argument > BigInt(remainingBytes)) {
    failLicenseCore("CBOR_PARSE", "CBOR_TRUNCATED", "Truncated CBOR string.");
  }
  return Number(argument);
}

function decodeText(content: Uint8Array): string {
  let value: string;
  try {
    value = UTF8_DECODER.decode(content);
  } catch {
    failLicenseCore("CBOR_PARSE", "MALFORMED_UTF8", "CBOR text is not valid UTF-8.");
  }
  if (value.normalize("NFC") !== value) {
    failLicenseCore("CBOR_PARSE", "NON_NFC_TEXT", "CBOR text is not NFC-normalized.");
  }
  return value;
}

function decodeSimple(
  state: DecodeStateV1,
  startOffset: number,
  additionalInformation: number,
): StrictCborBooleanNodeV1 | StrictCborNullNodeV1 {
  if (additionalInformation === 20 || additionalInformation === 21) {
    const node: StrictCborBooleanNodeV1 = {
      kind: "boolean",
      boolean: additionalInformation === 21,
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }
  if (additionalInformation === 22) {
    if (!state.allowNull) {
      failLicenseCore(
        "CBOR_PARSE",
        "NULL_FIELD_FORBIDDEN",
        "CBOR null is forbidden by the Licensing protocol profile.",
      );
    }
    const node: StrictCborNullNodeV1 = {
      kind: "null",
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }
  if (additionalInformation >= 25 && additionalInformation <= 27) {
    failLicenseCore("CBOR_PARSE", "FLOAT_FORBIDDEN", "Floating-point CBOR is forbidden.");
  }
  if (additionalInformation === 31) {
    failLicenseCore("CBOR_PARSE", "INDEFINITE_LENGTH", "Unexpected CBOR break byte.");
  }
  if (additionalInformation >= 28 && additionalInformation <= 30) {
    failLicenseCore(
      "CBOR_PARSE",
      "CBOR_MALFORMED",
      "Reserved CBOR additional-information value.",
    );
  }
  if (additionalInformation === 24) {
    const simpleValue = readUnsigned(state, 1);
    if (simpleValue < 32n) {
      failLicenseCore(
        "CBOR_PARSE",
        "NON_CANONICAL_CBOR",
        "CBOR simple value is not minimally encoded.",
      );
    }
  }
  failLicenseCore(
    "CBOR_PARSE",
    "CBOR_SIMPLE_FORBIDDEN",
    "Unsupported CBOR simple value is forbidden.",
  );
}

function decodeItem(state: DecodeStateV1, depth: number): StrictCborNodeV1 {
  enterNode(state, depth);
  if (state.offset >= state.bytes.byteLength) {
    failLicenseCore("CBOR_PARSE", "CBOR_TRUNCATED", "Truncated CBOR item.");
  }

  const startOffset = state.offset;
  const initialByte = state.bytes[state.offset] ?? 0;
  state.offset += 1;
  const majorType = initialByte >>> 5;
  const additionalInformation = initialByte & 0x1f;

  if (majorType === 7) {
    return decodeSimple(state, startOffset, additionalInformation);
  }

  const argument = readArgument(state, additionalInformation);

  if (majorType === 0 || majorType === 1) {
    const value = majorType === 0 ? argument : -1n - argument;
    const common = {
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    if (majorType === 0) {
      const node: StrictCborUnsignedNodeV1 = {
        kind: "unsigned",
        integer: value,
        ...common,
      };
      return Object.freeze(node);
    }
    const node: StrictCborNegativeNodeV1 = {
      kind: "negative",
      integer: value,
      ...common,
    };
    return Object.freeze(node);
  }

  if (majorType === 2 || majorType === 3) {
    const length = stringLength(state, argument);
    const contentStart = state.offset;
    state.offset += length;
    const content = state.bytes.subarray(contentStart, state.offset);
    if (majorType === 2) {
      const node: StrictCborByteStringNodeV1 = {
        kind: "bytes",
        bytes: copyBytes(content),
        startOffset,
        endOffset: state.offset,
        ...nodeBytes(state, startOffset, state.offset),
      };
      return Object.freeze(node);
    }
    const node: StrictCborTextStringNodeV1 = {
      kind: "text",
      text: decodeText(content),
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }

  if (majorType === 4) {
    const length = collectionLength(state, argument, 1);
    const items: StrictCborNodeV1[] = [];
    for (let index = 0; index < length; index += 1) {
      items.push(decodeItem(state, depth + 1));
    }
    const node: StrictCborArrayNodeV1 = {
      kind: "array",
      items: Object.freeze(items),
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }

  if (majorType === 5) {
    const length = collectionLength(state, argument, 2);
    const entries: StrictCborMapEntryV1[] = [];
    const seenKeyBytes = new Set<string>();
    let previousKeyRaw: Uint8Array | undefined;

    for (let index = 0; index < length; index += 1) {
      const key = decodeItem(state, depth + 1);
      const keyFingerprint = bytesToHex(key.raw);
      if (seenKeyBytes.has(keyFingerprint)) {
        failLicenseCore("CBOR_PARSE", "DUPLICATE_MAP_KEY", "Duplicate CBOR map key.");
      }
      seenKeyBytes.add(keyFingerprint);
      if (previousKeyRaw !== undefined && compareBytes(previousKeyRaw, key.raw) >= 0) {
        failLicenseCore(
          "CBOR_PARSE",
          "NON_CANONICAL_CBOR",
          "CBOR map keys are not in deterministic bytewise order.",
        );
      }
      previousKeyRaw = key.raw;

      const value = decodeItem(state, depth + 1);
      const entry: StrictCborMapEntryV1 = {
        key,
        value,
        startOffset: key.startOffset,
        endOffset: value.endOffset,
        raw: rawSlice(state, key.startOffset, value.endOffset),
      };
      entries.push(Object.freeze(entry));
    }

    const node: StrictCborMapNodeV1 = {
      kind: "map",
      entries: Object.freeze(entries),
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }

  if (majorType === 6) {
    if (!(state.allowRootTag && depth === 0)) {
      failLicenseCore(
        "CBOR_PARSE",
        "UNEXPECTED_CBOR_TAG",
        "CBOR tags are forbidden except for a permitted outer format tag.",
      );
    }
    const value = decodeItem(state, depth + 1);
    const node: StrictCborTagNodeV1 = {
      kind: "tag",
      tag: argument,
      item: value,
      startOffset,
      endOffset: state.offset,
      ...nodeBytes(state, startOffset, state.offset),
    };
    return Object.freeze(node);
  }

  failLicenseCore("CBOR_PARSE", "CBOR_MALFORMED", `Unsupported CBOR major type ${majorType}.`);
}

/**
 * Decode exactly one RFC 8949 Core Deterministic CBOR item under explicit
 * byte, depth, and node bounds. The input is copied before any AST is exposed.
 */
export function decodeStrictCborV1(
  input: Uint8Array,
  maximumBytes: number,
  options: StrictCborDecodeOptionsV1 = {},
): StrictCborNodeV1 {
  assertLimit(maximumBytes, "maximumBytes", true);
  if (input.byteLength > maximumBytes) {
    failLicenseCore(
      "PRE_DECODE",
      "OBJECT_TOO_LARGE",
      `CBOR input exceeds its ${maximumBytes}-byte limit.`,
    );
  }

  const maximumDepth = options.maximumDepth ?? DEFAULT_MAXIMUM_DEPTH;
  const maximumNodes = options.maximumNodes ?? Math.min(
    DEFAULT_MAXIMUM_NODES,
    Math.max(1, input.byteLength),
  );
  assertLimit(maximumDepth, "maximumDepth", true);
  assertLimit(maximumNodes, "maximumNodes", false);

  const state: DecodeStateV1 = {
    bytes: copyBytes(input),
    allowRootTag: options.allowRootTag === true,
    allowNull: options.allowNull === true,
    maximumDepth,
    maximumNodes,
    offset: 0,
    nodeCount: 0,
  };
  const decoded = decodeItem(state, 0);
  if (state.offset !== state.bytes.byteLength) {
    failLicenseCore("CBOR_PARSE", "TRAILING_DATA", "Trailing data follows the first CBOR item.");
  }
  return decoded;
}

function encodeHead(majorType: number, value: bigint): Uint8Array {
  if (value < 0n || value > UINT64_MAX) {
    failLicenseCore("CBOR_PARSE", "CBOR_INTEGER_RANGE", "CBOR head value is outside uint64.");
  }
  if (value < 24n) return new Uint8Array([(majorType << 5) | Number(value)]);
  if (value <= UINT8_MAX) {
    return concatBytes([
      new Uint8Array([(majorType << 5) | 24]),
      unsignedBigIntToFixedBytes(value, 1),
    ]);
  }
  if (value <= UINT16_MAX) {
    return concatBytes([
      new Uint8Array([(majorType << 5) | 25]),
      unsignedBigIntToFixedBytes(value, 2),
    ]);
  }
  if (value <= UINT32_MAX) {
    return concatBytes([
      new Uint8Array([(majorType << 5) | 26]),
      unsignedBigIntToFixedBytes(value, 4),
    ]);
  }
  return concatBytes([
    new Uint8Array([(majorType << 5) | 27]),
    unsignedBigIntToFixedBytes(value, 8),
  ]);
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isTagValue(value: object): value is DeterministicCborTagV1 {
  return "kind" in value && value.kind === "tag" && "tag" in value && "value" in value;
}

function encodeValue(value: DeterministicCborValueV1): Uint8Array {
  if (value instanceof Uint8Array) {
    return concatBytes([encodeHead(2, BigInt(value.byteLength)), value]);
  }
  if (typeof value === "string") {
    if (hasUnpairedSurrogate(value)) {
      failLicenseCore("CBOR_PARSE", "MALFORMED_UTF8", "Text contains an unpaired UTF-16 surrogate.");
    }
    if (value.normalize("NFC") !== value) {
      failLicenseCore("CBOR_PARSE", "NON_NFC_TEXT", "CBOR text is not NFC-normalized.");
    }
    const encoded = UTF8_ENCODER.encode(value);
    return concatBytes([encodeHead(3, BigInt(encoded.byteLength)), encoded]);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      failLicenseCore(
        "CBOR_PARSE",
        "FLOAT_FORBIDDEN",
        "Floating-point CBOR is forbidden.",
      );
    }
    if (!Number.isSafeInteger(value)) {
      failLicenseCore("CBOR_PARSE", "CBOR_INTEGER_RANGE", "CBOR integer is not safely representable.");
    }
    return encodeValue(BigInt(value));
  }
  if (typeof value === "bigint") {
    return value >= 0n ? encodeHead(0, value) : encodeHead(1, -1n - value);
  }
  if (typeof value === "boolean") return new Uint8Array([value ? 0xf5 : 0xf4]);
  if (Array.isArray(value)) {
    const encodedItems = value.map((item) => encodeValue(item));
    return concatBytes([encodeHead(4, BigInt(encodedItems.length)), ...encodedItems]);
  }
  if (value instanceof Map) {
    const encodedEntries = [...value.entries()].map(([key, item]) => ({
      key: encodeValue(key),
      value: encodeValue(item),
    }));
    encodedEntries.sort((left, right) => compareBytes(left.key, right.key));
    for (let index = 1; index < encodedEntries.length; index += 1) {
      const previous = encodedEntries[index - 1];
      const current = encodedEntries[index];
      if (previous !== undefined && current !== undefined && compareBytes(previous.key, current.key) === 0) {
        failLicenseCore("CBOR_PARSE", "DUPLICATE_MAP_KEY", "Duplicate deterministic CBOR map key.");
      }
    }
    return concatBytes([
      encodeHead(5, BigInt(encodedEntries.length)),
      ...encodedEntries.flatMap((entry) => [entry.key, entry.value]),
    ]);
  }
  if (typeof value === "object" && value !== null && isTagValue(value)) {
    if (
      typeof value.tag === "number" &&
      (!Number.isSafeInteger(value.tag) || value.tag < 0)
    ) {
      failLicenseCore("CBOR_PARSE", "CBOR_INTEGER_RANGE", "CBOR tag is outside uint64.");
    }
    const tag = typeof value.tag === "number" ? BigInt(value.tag) : value.tag;
    return concatBytes([encodeHead(6, tag), encodeValue(value.value)]);
  }
  if (value === null) {
    failLicenseCore(
      "CBOR_PARSE",
      "NULL_FIELD_FORBIDDEN",
      "CBOR null is forbidden by the Licensing protocol profile.",
    );
  }
  failLicenseCore("CBOR_PARSE", "CBOR_UNSUPPORTED_TYPE", "Unsupported deterministic CBOR value.");
}

/** Encode a value using the Licensing v1 deterministic CBOR subset. */
export function encodeDeterministicCborV1(value: DeterministicCborValueV1): Uint8Array {
  return encodeValue(value);
}
