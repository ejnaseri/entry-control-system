// TEST_ONLY_DO_NOT_TRUST: dependency-free RFC 8949 Core Deterministic CBOR
// support for the Licensing golden-vector package. Production code must not
// import anything below licensing/vectors/.

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export class CborError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CborError";
    this.code = code;
  }
}

export class CborTag {
  constructor(tag, value) {
    this.tag = tag;
    this.value = value;
  }
}

function fail(code, message) {
  throw new CborError(code, message);
}

function compareBytes(left, right) {
  return Buffer.compare(left, right);
}

function unsignedBytes(value, width) {
  let remaining = BigInt(value);
  const output = Buffer.alloc(width);
  for (let index = width - 1; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}

function encodeHead(major, input) {
  const value = BigInt(input);
  if (value < 0n) fail("CBOR_INVALID_VALUE", "CBOR head value cannot be negative.");
  if (value < 24n) return Buffer.from([(major << 5) | Number(value)]);
  if (value <= 0xffn) return Buffer.concat([Buffer.from([(major << 5) | 24]), unsignedBytes(value, 1)]);
  if (value <= 0xffffn) return Buffer.concat([Buffer.from([(major << 5) | 25]), unsignedBytes(value, 2)]);
  if (value <= 0xffffffffn) return Buffer.concat([Buffer.from([(major << 5) | 26]), unsignedBytes(value, 4)]);
  if (value <= 0xffffffffffffffffn) {
    return Buffer.concat([Buffer.from([(major << 5) | 27]), unsignedBytes(value, 8)]);
  }
  fail("CBOR_INTEGER_RANGE", "CBOR integer exceeds uint64.");
}

function mapEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.entries(value);
  fail("CBOR_UNSUPPORTED_TYPE", "Only plain objects and Map instances encode as CBOR maps.");
}

export function encodeCanonical(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const bytes = Buffer.from(value);
    return Buffer.concat([encodeHead(2, bytes.length), bytes]);
  }
  if (typeof value === "string") {
    const bytes = Buffer.from(utf8Encoder.encode(value));
    return Buffer.concat([encodeHead(3, bytes.length), bytes]);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("CBOR_INTEGER_RANGE", "CBOR numbers must be safe integers.");
    return encodeCanonical(BigInt(value));
  }
  if (typeof value === "bigint") {
    return value >= 0n ? encodeHead(0, value) : encodeHead(1, -1n - value);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([encodeHead(4, value.length), ...value.map(encodeCanonical)]);
  }
  if (value instanceof CborTag) {
    return Buffer.concat([encodeHead(6, value.tag), encodeCanonical(value.value)]);
  }
  if (value === false) return Buffer.from([0xf4]);
  if (value === true) return Buffer.from([0xf5]);
  if (value === null) return Buffer.from([0xf6]);
  if (value && (value instanceof Map || Object.getPrototypeOf(value) === Object.prototype)) {
    const encoded = mapEntries(value).map(([key, item]) => ({
      key: encodeCanonical(key),
      value: encodeCanonical(item),
    }));
    encoded.sort((left, right) => compareBytes(left.key, right.key));
    for (let index = 1; index < encoded.length; index += 1) {
      if (Buffer.compare(encoded[index - 1].key, encoded[index].key) === 0) {
        fail("DUPLICATE_MAP_KEY", "Duplicate CBOR map key.");
      }
    }
    return Buffer.concat([
      encodeHead(5, encoded.length),
      ...encoded.flatMap((entry) => [entry.key, entry.value]),
    ]);
  }
  fail("CBOR_UNSUPPORTED_TYPE", `Unsupported CBOR value type: ${typeof value}.`);
}

function semanticKey(value) {
  if (Buffer.isBuffer(value)) return `b:${value.toString("hex")}`;
  if (typeof value === "bigint") return `i:${value}`;
  if (typeof value === "string") return `s:${value}`;
  return `x:${encodeCanonical(value).toString("hex")}`;
}

function decodeUnsigned(bytes, state, width) {
  if (state.offset + width > bytes.length) fail("CBOR_TRUNCATED", "Truncated CBOR integer/length.");
  let value = 0n;
  for (let index = 0; index < width; index += 1) value = (value << 8n) | BigInt(bytes[state.offset++]);
  return value;
}

function readArgument(bytes, state, additional) {
  if (additional < 24) return BigInt(additional);
  if (additional === 31) fail("INDEFINITE_LENGTH", "Indefinite-length CBOR is forbidden.");
  const widths = new Map([[24, 1], [25, 2], [26, 4], [27, 8]]);
  const width = widths.get(additional);
  if (!width) fail("CBOR_MALFORMED", "Reserved CBOR additional-information value.");
  const value = decodeUnsigned(bytes, state, width);
  const minimum = width === 1 ? 24n : width === 2 ? 256n : width === 4 ? 65536n : 4294967296n;
  if (value < minimum) fail("NON_CANONICAL_CBOR", "CBOR integer/length is not minimally encoded.");
  return value;
}

function asLength(value) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("CBOR_LENGTH_RANGE", "CBOR length is too large.");
  return Number(value);
}

function decodeItem(bytes, state) {
  if (state.offset >= bytes.length) fail("CBOR_TRUNCATED", "Truncated CBOR item.");
  const start = state.offset;
  const initial = bytes[state.offset++];
  const major = initial >> 5;
  const additional = initial & 31;

  if (major === 7) {
    if (additional === 20) return { value: false, raw: bytes.subarray(start, state.offset) };
    if (additional === 21) return { value: true, raw: bytes.subarray(start, state.offset) };
    if (additional === 22) {
      if (!state.allowNull) fail("NULL_FIELD_FORBIDDEN", "CBOR null is forbidden by the protocol profile.");
      return { value: null, raw: bytes.subarray(start, state.offset) };
    }
    if ([25, 26, 27].includes(additional)) fail("FLOAT_FORBIDDEN", "Floating-point CBOR is forbidden.");
    if (additional === 31) fail("INDEFINITE_LENGTH", "Break outside an indefinite item.");
    fail("CBOR_SIMPLE_FORBIDDEN", "Unsupported CBOR simple value.");
  }

  const argument = readArgument(bytes, state, additional);
  if (major === 0 || major === 1) {
    const integer = major === 0 ? argument : -1n - argument;
    const value = integer >= BigInt(Number.MIN_SAFE_INTEGER) && integer <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(integer)
      : integer;
    return { value, raw: bytes.subarray(start, state.offset) };
  }
  if (major === 2 || major === 3) {
    const length = asLength(argument);
    if (state.offset + length > bytes.length) fail("CBOR_TRUNCATED", "Truncated CBOR string.");
    const content = bytes.subarray(state.offset, state.offset + length);
    state.offset += length;
    if (major === 2) return { value: Buffer.from(content), raw: bytes.subarray(start, state.offset) };
    try {
      return { value: utf8Decoder.decode(content), raw: bytes.subarray(start, state.offset) };
    } catch {
      fail("MALFORMED_UTF8", "CBOR text is not valid UTF-8.");
    }
  }
  if (major === 4) {
    const length = asLength(argument);
    const value = [];
    for (let index = 0; index < length; index += 1) value.push(decodeItem(bytes, state).value);
    return { value, raw: bytes.subarray(start, state.offset) };
  }
  if (major === 5) {
    const length = asLength(argument);
    const value = new Map();
    const seen = new Set();
    let previousKeyRaw;
    for (let index = 0; index < length; index += 1) {
      const key = decodeItem(bytes, state);
      if (previousKeyRaw && compareBytes(previousKeyRaw, key.raw) >= 0) {
        const code = Buffer.compare(previousKeyRaw, key.raw) === 0 ? "DUPLICATE_MAP_KEY" : "NON_CANONICAL_CBOR";
        fail(code, "CBOR map keys are duplicated or out of deterministic order.");
      }
      previousKeyRaw = Buffer.from(key.raw);
      const fingerprint = semanticKey(key.value);
      if (seen.has(fingerprint)) fail("DUPLICATE_MAP_KEY", "Duplicate semantic CBOR map key.");
      seen.add(fingerprint);
      value.set(key.value, decodeItem(bytes, state).value);
    }
    return { value, raw: bytes.subarray(start, state.offset) };
  }
  if (major === 6) {
    const nested = decodeItem(bytes, state);
    return { value: new CborTag(argument <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(argument) : argument, nested.value), raw: bytes.subarray(start, state.offset) };
  }
  fail("CBOR_MALFORMED", `Unsupported CBOR major type ${major}.`);
}

export function decodeCanonical(input, options = {}) {
  const bytes = Buffer.from(input);
  const state = { offset: 0, allowNull: options.allowNull === true };
  const decoded = decodeItem(bytes, state);
  if (state.offset !== bytes.length) fail("TRAILING_DATA", "Trailing bytes after the first CBOR item.");
  const canonical = encodeCanonical(decoded.value);
  if (!canonical.equals(bytes)) fail("NON_CANONICAL_CBOR", "CBOR bytes are not Core Deterministic Encoding.");
  return decoded.value;
}

export function mapToObject(map) {
  if (!(map instanceof Map)) fail("PAYLOAD_MAP_REQUIRED", "Expected a CBOR map.");
  const output = {};
  for (const [key, value] of map) {
    if (typeof key !== "string") fail("PAYLOAD_MAP_REQUIRED", "Expected text map keys.");
    output[key] = value;
  }
  return output;
}
