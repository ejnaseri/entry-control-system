import { bytesEqual, immutableDataView } from "./bytes";
import { failLicenseCore } from "./errors";
import { assertTrustSnapshotIntegrity, validateDelegationUpdateV1, validateDenylistUpdateV1 } from "./trust";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "./verifier";
import type { TrustSnapshot } from "./types";

/** Pure Root-authorized update; all ordering and cumulative rules remain in core. */
export function prepareLicenseTrustUpdateV1(configuration: LicenseVerifierConfigurationV1, bundle: Uint8Array, reference: bigint): TrustSnapshot {
  const crypto = configuration.crypto;
  const base: TrustSnapshot = immutableDataView({ environment: configuration.environment, roots: configuration.roots ?? [],
    trustedKeys: configuration.trustedKeys ?? [], delegations: configuration.delegations ?? [],
    ...(configuration.denylist ? { denylist: configuration.denylist } : {}) });
  assertTrustSnapshotIntegrity(crypto, base, base.environment);
  const verifier = createLicenseVerifierV1({ ...base, crypto });
  const checked = verifier.verifyCarrier({ carrierType: "trust-bundle", encoded: bundle, trustedNow: reference });
  if (!checked.ok) failLicenseCore(checked.stage, checked.errorCode, checked.errorCode);
  const candidates = checked.value.carrier.delegations.map(encoded => {
    const r = verifier.verifySignedObject({ expectedType: "key-delegation", encoded: new Uint8Array(encoded), context: { workflow: "VENDOR_HTTPS_RESPONSE", trustedNow: reference } });
    if (!r.ok) failLicenseCore(r.stage, r.errorCode, r.errorCode);
    return r;
  }).sort((a,b) => a.value.payload.delegationSerial < b.value.payload.delegationSerial ? -1 : a.value.payload.delegationSerial > b.value.payload.delegationSerial ? 1 : 0);
  const delegations = [...base.delegations];
  for (const candidate of candidates) {
    const next = validateDelegationUpdateV1({ crypto, payload: candidate.value.payload,
      tokenHash: candidate.digests.inputSha256, rootKid: candidate.value.payload.keyId, current: delegations });
    if (!delegations.some(d => bytesEqual(d.tokenHash, next.tokenHash))) delegations.push(next);
  }
  const dl = verifier.verifySignedObject({ expectedType: "key-denylist", encoded: new Uint8Array(checked.value.carrier.denylist),
    context: { workflow: "VENDOR_HTTPS_RESPONSE", trustedNow: reference } });
  if (!dl.ok) failLicenseCore(dl.stage, dl.errorCode, dl.errorCode);
  const denylist = validateDenylistUpdateV1({ payload: dl.value.payload, tokenHash: dl.digests.inputSha256, importedAt: reference,
    ...(base.denylist ? { current: base.denylist } : {}) });
  const trust: TrustSnapshot = immutableDataView({ ...base, delegations, denylist });
  assertTrustSnapshotIntegrity(crypto, trust, base.environment);
  return trust;
}
