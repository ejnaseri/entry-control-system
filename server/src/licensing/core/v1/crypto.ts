import { bytesEqual, bytesToHex, copyBytes } from "./bytes";
import { failLicenseCore } from "./errors";
import { LIMITS } from "./protocol";

/** Host-provided cryptography. The portable core never reads a keystore itself. */
export interface LicenseCryptoV1 {
  sha256(input: Uint8Array): Uint8Array;
  verifyEs256P1363(input: Readonly<{
    spkiDer: Uint8Array;
    signedBytes: Uint8Array;
    signature: Uint8Array;
  }>): boolean;
}

// RFC 5480 SubjectPublicKeyInfo with id-ecPublicKey + prime256v1 and an
// uncompressed SEC1 point. Exact DER is part of protocol v1.
const P256_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
  0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
  0x42, 0x00, 0x04,
]);

export function isCanonicalP256Spki(spkiDer: Uint8Array): boolean {
  return (
    spkiDer.byteLength === LIMITS.spkiDerBytes &&
    bytesEqual(spkiDer.subarray(0, P256_SPKI_PREFIX.byteLength), P256_SPKI_PREFIX)
  );
}

export function requireCanonicalP256Spki(
  spkiDer: Uint8Array,
  code = "NON_CANONICAL_SPKI",
): Uint8Array {
  if (!isCanonicalP256Spki(spkiDer)) {
    failLicenseCore("CLAIMS", code, "A canonical 91-byte P-256 SPKI is required.");
  }
  return copyBytes(spkiDer);
}

export function sha256(crypto: LicenseCryptoV1, input: Uint8Array): Uint8Array {
  const digest = crypto.sha256(copyBytes(input));
  if (!(digest instanceof Uint8Array) || digest.byteLength !== LIMITS.hashBytes) {
    throw new TypeError("License crypto adapter returned an invalid SHA-256 digest.");
  }
  return copyBytes(digest);
}

export function deriveKeyId(crypto: LicenseCryptoV1, spkiDer: Uint8Array): Uint8Array {
  requireCanonicalP256Spki(spkiDer);
  return sha256(crypto, spkiDer);
}

export function assertSpkiMatchesKid(
  crypto: LicenseCryptoV1,
  spkiDer: Uint8Array,
  expectedKid: Uint8Array,
  options: Readonly<{ stage?: "TRUST" | "CLAIMS"; code?: string }> = {},
): void {
  const stage = options.stage ?? "TRUST";
  const code = options.code ?? "KEY_ID_COLLISION";
  if (!isCanonicalP256Spki(spkiDer) || !bytesEqual(sha256(crypto, spkiDer), expectedKid)) {
    failLicenseCore(stage, code, "The key identifier does not match the canonical P-256 SPKI.");
  }
}

export function verifyEs256(
  crypto: LicenseCryptoV1,
  input: Readonly<{
    spkiDer: Uint8Array;
    signedBytes: Uint8Array;
    signature: Uint8Array;
    kid: Uint8Array;
  }>,
): void {
  let valid = false;
  try {
    valid = crypto.verifyEs256P1363({
      spkiDer: copyBytes(input.spkiDer),
      signedBytes: copyBytes(input.signedBytes),
      signature: copyBytes(input.signature),
    });
  } catch {
    // Host parsing/provider failures are indistinguishable from an invalid
    // hostile signature at this boundary.
    valid = false;
  }
  if (!valid) {
    failLicenseCore(
      "SIGNATURE",
      "SIGNATURE_INVALID",
      `ES256 verification failed for kid ${bytesToHex(input.kid)}.`,
    );
  }
}
