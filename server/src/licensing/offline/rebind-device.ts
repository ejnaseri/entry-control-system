import { bytesEqual, immutableDataView } from "../core/v1/bytes";
import { assertSpkiMatchesKid, type LicenseCryptoV1 } from "../core/v1/crypto";
import { failLicenseCore } from "../core/v1/errors";
import type { DeviceBindingSnapshot } from "../core/v1/types";

/** Guardian-owned staged replacement key, NOT a browser/import claim. Reading
 * never rotates the effective key. The eventual store must coordinate the key
 * reference with complete-state CAS and retain it through unknown outcomes. */
export interface OfflineRebindDeviceProviderV1 {
  readStagedDevice(): DeviceBindingSnapshot;
}

export function snapshotRebindDeviceV1(provider: OfflineRebindDeviceProviderV1 | undefined,
  previous: DeviceBindingSnapshot, crypto: LicenseCryptoV1): DeviceBindingSnapshot {
  const deny = (): never => failLicenseCore("CLAIMS", "REBIND_DEVICE_UNAVAILABLE", "Staged replacement binding is unavailable or invalid.");
  let value: DeviceBindingSnapshot;
  try {
    if (!provider) return deny();
    value = provider.readStagedDevice();
    if (!value || Object.keys(value).some(k => !["installationId", "deviceKeyId", "devicePublicKey", "assurance"].includes(k)) ||
      !(value.installationId instanceof Uint8Array) || value.installationId.length !== 16 ||
      !(value.deviceKeyId instanceof Uint8Array) || value.deviceKeyId.length !== 32 ||
      !(value.devicePublicKey instanceof Uint8Array) || value.devicePublicKey.length !== 91 ||
      !["TPM_ATTESTED", "SOFTWARE_BOUND"].includes(value.assurance)) return deny();
    value = immutableDataView({ installationId: value.installationId, deviceKeyId: value.deviceKeyId,
      devicePublicKey: value.devicePublicKey, assurance: value.assurance });
  } catch { return deny(); }
  if (!bytesEqual(value.installationId, previous.installationId) || bytesEqual(value.deviceKeyId, previous.deviceKeyId)) return deny();
  assertSpkiMatchesKid(crypto, value.devicePublicKey!, value.deviceKeyId, { stage: "CLAIMS", code: "REBIND_DEVICE_UNAVAILABLE" });
  return value;
}
