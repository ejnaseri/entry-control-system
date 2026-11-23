const HEX_ALPHABET = "0123456789abcdef";

export function copyBytes(input: Uint8Array): Uint8Array {
  return new Uint8Array(input);
}

type ImmutableData =
  | null
  | undefined
  | string
  | number
  | bigint
  | boolean
  | Uint8Array
  | readonly ImmutableData[]
  | { readonly [key: string]: ImmutableData };

function cloneImmutableData(value: ImmutableData): ImmutableData {
  if (value instanceof Uint8Array) return copyBytes(value);
  if (Array.isArray(value)) return value.map((item) => cloneImmutableData(item));
  if (value !== null && typeof value === "object") {
    const output: Record<string, ImmutableData> = Object.create(null) as Record<string, ImmutableData>;
    for (const key of Object.keys(value)) {
      output[key] = cloneImmutableData((value as Readonly<Record<string, ImmutableData>>)[key]);
    }
    return output;
  }
  return value;
}

function immutableDataAccessor(value: ImmutableData): ImmutableData {
  if (value instanceof Uint8Array) return copyBytes(value);
  if (Array.isArray(value)) {
    const output: ImmutableData[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      Object.defineProperty(output, index, {
        configurable: false,
        enumerable: true,
        get: () => immutableDataAccessor(item),
      });
    }
    return Object.freeze(output);
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, ImmutableData> = Object.create(null) as Record<string, ImmutableData>;
    for (const key of Object.keys(value)) {
      const item = (value as Readonly<Record<string, ImmutableData>>)[key];
      Object.defineProperty(output, key, {
        configurable: false,
        enumerable: true,
        get: () => immutableDataAccessor(item),
      });
    }
    return Object.freeze(output);
  }
  return value;
}

/**
 * Return a recursively frozen data view whose byte-string properties are fresh
 * defensive copies on every read. JavaScript cannot freeze non-empty typed
 * arrays, so ordinary `Object.freeze()` is insufficient for security data.
 */
export function immutableDataView<T>(input: T): T {
  return immutableDataAccessor(cloneImmutableData(input as ImmutableData)) as T;
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += part.byteLength;
    if (!Number.isSafeInteger(length)) {
      throw new RangeError("Combined byte length exceeds the safe integer range.");
    }
  }

  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const sharedLength = Math.min(left.byteLength, right.byteLength);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.byteLength - right.byteLength;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;

  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export function bytesToHex(input: Uint8Array): string {
  let output = "";
  for (const byte of input) {
    output += HEX_ALPHABET[byte >>> 4] ?? "";
    output += HEX_ALPHABET[byte & 0x0f] ?? "";
  }
  return output;
}

export function bytesToUnsignedBigInt(input: Uint8Array): bigint {
  let value = 0n;
  for (const byte of input) value = (value << 8n) | BigInt(byte);
  return value;
}

export const equalBytes = bytesEqual;
export const unsignedBytesToBigInt = bytesToUnsignedBigInt;

export function unsignedBigIntToFixedBytes(value: bigint, width: number): Uint8Array {
  if (!Number.isSafeInteger(width) || width < 0) {
    throw new RangeError("Byte width must be a non-negative safe integer.");
  }
  if (value < 0n) throw new RangeError("Unsigned byte conversion cannot encode a negative value.");

  const maximumExclusive = 1n << (BigInt(width) * 8n);
  if (value >= maximumExclusive) {
    throw new RangeError("Unsigned value does not fit the requested byte width.");
  }

  const output = new Uint8Array(width);
  let remaining = value;
  for (let index = width - 1; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}
