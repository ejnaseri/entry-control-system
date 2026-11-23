// TEST_ONLY_DO_NOT_TRUST: deterministic fixture signing only. RFC 6979 is used
// solely so committed golden vectors regenerate byte-for-byte. Production
// issuance must use approved HSM/KMS signing and must never import this module.

import { createHash, createHmac, createPublicKey, verify as verifySignature } from "node:crypto";

export const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
export const P256_HALF_ORDER = BigInt("0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8");
const FIELD = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
const CURVE_A = FIELD - 3n;
const CURVE_B = BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b");
const GENERATOR = {
  x: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  y: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
};
const SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d03010703420004", "hex");

export function sha256(input) {
  return createHash("sha256").update(input).digest();
}

function hmac(key, ...chunks) {
  const value = createHmac("sha256", key);
  for (const chunk of chunks) value.update(chunk);
  return value.digest();
}

function mod(value, modulus) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function inverse(value, modulus) {
  let low = mod(value, modulus);
  let high = modulus;
  let lm = 1n;
  let hm = 0n;
  while (low > 1n) {
    const ratio = high / low;
    [lm, hm] = [hm - lm * ratio, lm];
    [low, high] = [high - low * ratio, low];
  }
  return mod(lm, modulus);
}

function pointAdd(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x && mod(left.y + right.y, FIELD) === 0n) return null;
  const slope = left.x === right.x && left.y === right.y
    ? mod((3n * left.x * left.x + CURVE_A) * inverse(2n * left.y, FIELD), FIELD)
    : mod((right.y - left.y) * inverse(right.x - left.x, FIELD), FIELD);
  const x = mod(slope * slope - left.x - right.x, FIELD);
  return { x, y: mod(slope * (left.x - x) - left.y, FIELD) };
}

function scalarMultiply(scalar, point = GENERATOR) {
  let n = mod(scalar, P256_ORDER);
  let addend = point;
  let result = null;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    n >>= 1n;
  }
  return result;
}

function bigintTo32(value) {
  const output = Buffer.alloc(32);
  let remaining = value;
  for (let index = 31; index >= 0; index -= 1) {
    output[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return output;
}

function bytesToBigint(bytes) {
  return BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
}

export function deriveTestOnlyPrivateScalar(label) {
  const seed = sha256(Buffer.from(`ENTRY_CONTROL_SYSTEM:TEST_ONLY_DO_NOT_TRUST:GOLDEN_VECTOR_KEY:V1:${label}`, "ascii"));
  return (bytesToBigint(seed) % (P256_ORDER - 1n)) + 1n;
}

export function publicSpkiFromPrivateScalar(privateScalar) {
  const point = scalarMultiply(privateScalar);
  if (!point || mod(point.y * point.y - (point.x ** 3n + CURVE_A * point.x + CURVE_B), FIELD) !== 0n) {
    throw new Error("TEST_ONLY P-256 public point derivation failed.");
  }
  return Buffer.concat([SPKI_PREFIX, bigintTo32(point.x), bigintTo32(point.y)]);
}

function deterministicNonce(privateScalar, digest) {
  const x = bigintTo32(privateScalar);
  const h1 = bigintTo32(bytesToBigint(digest) % P256_ORDER);
  let v = Buffer.alloc(32, 0x01);
  let k = Buffer.alloc(32, 0x00);
  k = hmac(k, v, Buffer.from([0x00]), x, h1);
  v = hmac(k, v);
  k = hmac(k, v, Buffer.from([0x01]), x, h1);
  v = hmac(k, v);
  for (;;) {
    v = hmac(k, v);
    const candidate = bytesToBigint(v);
    if (candidate > 0n && candidate < P256_ORDER) return candidate;
    k = hmac(k, v, Buffer.from([0x00]));
    v = hmac(k, v);
  }
}

export function signEs256Rfc6979LowS(message, privateScalar) {
  const digest = sha256(message);
  let nonce = deterministicNonce(privateScalar, digest);
  for (;;) {
    const point = scalarMultiply(nonce);
    const r = mod(point.x, P256_ORDER);
    if (r !== 0n) {
      const z = bytesToBigint(digest);
      let s = mod(inverse(nonce, P256_ORDER) * (z + r * privateScalar), P256_ORDER);
      if (s !== 0n) {
        if (s > P256_HALF_ORDER) s = P256_ORDER - s;
        return Buffer.concat([bigintTo32(r), bigintTo32(s)]);
      }
    }
    nonce = mod(nonce + 1n, P256_ORDER - 1n) + 1n;
  }
}

export function signatureScalars(signature) {
  const bytes = Buffer.from(signature);
  if (bytes.length !== 64) return null;
  return { r: bytesToBigint(bytes.subarray(0, 32)), s: bytesToBigint(bytes.subarray(32)) };
}

export function verifyEs256(message, signature, spkiDer) {
  const key = createPublicKey({ key: Buffer.from(spkiDer), format: "der", type: "spki" });
  return verifySignature("sha256", message, { key, dsaEncoding: "ieee-p1363" }, signature);
}
