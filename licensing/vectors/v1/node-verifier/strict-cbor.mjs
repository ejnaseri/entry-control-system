// Independent RFC 8949 Core Deterministic CBOR reader for the Node consumer.

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

export class StrictCborError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "StrictCborError";
    this.code = code;
  }
}

function cborFail(code, message) {
  throw new StrictCborError(code, message);
}

function compareEncodedKeys(left, right) {
  return Buffer.compare(left, right);
}

class Reader {
  constructor(bytes, allowNull) {
    this.bytes = bytes;
    this.offset = 0;
    this.allowNull = allowNull;
    this.items = 0;
  }

  parse() {
    const value = this.value(0);
    if (this.offset !== this.bytes.length) cborFail("TRAILING_DATA", "Trailing bytes after CBOR root.");
    return value;
  }

  value(depth) {
    if (depth > 64) cborFail("CBOR_DEPTH_LIMIT", "CBOR depth exceeds 64.");
    this.items += 1;
    if (this.items > 100_000) cborFail("CBOR_ITEM_LIMIT", "CBOR item count exceeds 100000.");
    const start = this.offset;
    const initial = this.byte();
    const major = initial >> 5;
    const additional = initial & 31;
    let value;
    if (major === 0) value = { kind: "unsigned", integer: this.argument(additional) };
    else if (major === 1) value = { kind: "negative", integer: -1n - this.argument(additional) };
    else if (major === 2) value = { kind: "bytes", bytes: this.readBytes(this.length(additional)) };
    else if (major === 3) value = this.text(additional);
    else if (major === 4) value = this.array(additional, depth);
    else if (major === 5) value = this.map(additional, depth);
    else if (major === 6) value = { kind: "tag", tag: this.argument(additional), item: this.value(depth + 1) };
    else if (major === 7) value = this.simple(additional);
    else cborFail("CBOR_MALFORMED", "Unknown CBOR major type.");
    value.encoded = Buffer.from(this.bytes.subarray(start, this.offset));
    return value;
  }

  text(additional) {
    const bytes = this.readBytes(this.length(additional));
    try {
      return { kind: "text", text: strictUtf8.decode(bytes) };
    } catch {
      cborFail("MALFORMED_UTF8", "CBOR text is malformed UTF-8.");
    }
  }

  array(additional, depth) {
    const count = this.containerCount(additional);
    const items = [];
    for (let index = 0; index < count; index += 1) items.push(this.value(depth + 1));
    return { kind: "array", items };
  }

  map(additional, depth) {
    const count = this.containerCount(additional);
    const entries = [];
    let previous;
    for (let index = 0; index < count; index += 1) {
      const key = this.value(depth + 1);
      if (!["unsigned", "negative", "bytes", "text"].includes(key.kind)) cborFail("CBOR_MAP_KEY_TYPE", "Unsupported CBOR map key type.");
      if (previous) {
        const comparison = compareEncodedKeys(previous, key.encoded);
        if (comparison === 0) cborFail("DUPLICATE_MAP_KEY", "Duplicate CBOR map key.");
        if (comparison > 0) cborFail("NON_CANONICAL_CBOR", "CBOR map keys are out of raw-byte order.");
      }
      previous = key.encoded;
      entries.push({ key, value: this.value(depth + 1) });
    }
    return { kind: "map", entries };
  }

  simple(additional) {
    if (additional === 20) return { kind: "boolean", boolean: false };
    if (additional === 21) return { kind: "boolean", boolean: true };
    if (additional === 22) {
      if (!this.allowNull) cborFail("NULL_FIELD_FORBIDDEN", "CBOR null is forbidden.");
      return { kind: "null" };
    }
    if ([25, 26, 27].includes(additional)) cborFail("FLOAT_FORBIDDEN", "CBOR float is forbidden.");
    if (additional === 31) cborFail("INDEFINITE_LENGTH", "Indefinite CBOR is forbidden.");
    cborFail("CBOR_SIMPLE_FORBIDDEN", "CBOR simple value is forbidden.");
  }

  argument(additional) {
    if (additional < 24) return BigInt(additional);
    if (additional === 31) cborFail("INDEFINITE_LENGTH", "Indefinite CBOR is forbidden.");
    const widths = new Map([[24, 1], [25, 2], [26, 4], [27, 8]]);
    const width = widths.get(additional);
    if (!width) cborFail("CBOR_MALFORMED", "Reserved CBOR additional information.");
    let value = 0n;
    for (let index = 0; index < width; index += 1) value = (value << 8n) | BigInt(this.byte());
    const minimum = width === 1 ? 24n : width === 2 ? 256n : width === 4 ? 65536n : 4294967296n;
    if (value < minimum) cborFail("NON_CANONICAL_CBOR", "CBOR argument is not minimally encoded.");
    return value;
  }

  length(additional) {
    const value = this.argument(additional);
    if (value > 16_777_216n) cborFail("CBOR_LENGTH_LIMIT", "CBOR string exceeds reader bound.");
    return Number(value);
  }

  containerCount(additional) {
    const value = this.argument(additional);
    if (value > 100_000n) cborFail("CBOR_ITEM_LIMIT", "CBOR container exceeds reader bound.");
    return Number(value);
  }

  byte() {
    if (this.offset >= this.bytes.length) cborFail("CBOR_TRUNCATED", "Truncated CBOR.");
    return this.bytes[this.offset++];
  }

  readBytes(length) {
    if (length < 0 || this.offset > this.bytes.length - length) cborFail("CBOR_TRUNCATED", "Truncated CBOR string.");
    const output = Buffer.from(this.bytes.subarray(this.offset, this.offset + length));
    this.offset += length;
    return output;
  }
}

export function parseStrictCbor(input, options = {}) {
  return new Reader(Buffer.from(input), options.allowNull === true).parse();
}

export function integerValue(value, code) {
  if (!value || !["unsigned", "negative"].includes(value.kind)) cborFail(code, "CBOR integer required.");
  if (value.integer < BigInt(Number.MIN_SAFE_INTEGER) || value.integer > BigInt(Number.MAX_SAFE_INTEGER)) cborFail(code, "CBOR integer exceeds safe range.");
  return Number(value.integer);
}

export function textValue(value, code) {
  if (!value || value.kind !== "text") cborFail(code, "CBOR text required.");
  return value.text;
}

export function bytesValue(value, code) {
  if (!value || value.kind !== "bytes") cborFail(code, "CBOR byte string required.");
  return value.bytes;
}

export function findIntegerKey(map, key) {
  if (!map || map.kind !== "map") return undefined;
  return map.entries.find((entry) => ["unsigned", "negative"].includes(entry.key.kind) && entry.key.integer === BigInt(key))?.value;
}

export function findTextKey(map, key) {
  if (!map || map.kind !== "map") return undefined;
  return map.entries.find((entry) => entry.key.kind === "text" && entry.key.text === key)?.value;
}

export function textMapObject(map, code) {
  if (!map || map.kind !== "map") cborFail(code, "CBOR map required.");
  const output = {};
  for (const entry of map.entries) {
    if (entry.key.kind !== "text") cborFail(code, "Text map key required.");
    output[entry.key.text] = entry.value;
  }
  return output;
}

export function runIndependentCborOrderingSelfTest() {
  const valid = parseStrictCbor(Buffer.from("a21818006000", "hex"));
  if (valid.kind !== "map" || valid.entries.length !== 2) throw new Error("Independent CBOR raw-order self-test failed.");
  try {
    parseStrictCbor(Buffer.from("a26000181800", "hex"));
  } catch (error) {
    if (error instanceof StrictCborError && error.code === "NON_CANONICAL_CBOR") return;
    throw error;
  }
  throw new Error("Independent CBOR reader accepted legacy length-first map ordering.");
}
