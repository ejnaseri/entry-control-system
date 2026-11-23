import {
  createHash,
  createPublicKey,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

import type { LicenseCryptoV1 } from "../core/v1/crypto";

function importP256Spki(spkiDer: Uint8Array): KeyObject {
  const key = createPublicKey({
    key: Buffer.from(spkiDer),
    format: "der",
    type: "spki",
  });
  if (key.asymmetricKeyType !== "ec") throw new TypeError("License key is not EC.");
  const details = key.asymmetricKeyDetails;
  if (details?.namedCurve !== "prime256v1") throw new TypeError("License key is not P-256.");
  return key;
}

/** Node/OpenSSL adapter; it contains no trust anchors or private material. */
export const nodeCryptoV1: LicenseCryptoV1 = Object.freeze({
  sha256(input: Uint8Array): Uint8Array {
    return new Uint8Array(createHash("sha256").update(input).digest());
  },

  verifyEs256P1363(input: Readonly<{
    spkiDer: Uint8Array;
    signedBytes: Uint8Array;
    signature: Uint8Array;
  }>): boolean {
    const { spkiDer, signedBytes, signature } = input;
    const key = importP256Spki(spkiDer);
    return nodeVerify(
      "sha256",
      signedBytes,
      { key, dsaEncoding: "ieee-p1363" },
      signature,
    );
  },
});
