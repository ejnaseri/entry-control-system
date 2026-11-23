import { bytesEqual, compareBytes, copyBytes, immutableDataView } from "./bytes";
import { assertSpkiMatchesKid, isCanonicalP256Spki, type LicenseCryptoV1 } from "./crypto";
import { failLicenseCore } from "./errors";
import { ISSUER_POLICY_SECONDS } from "./protocol";
import type {
  DelegationTrustSnapshot,
  DeniedKeyEntry,
  DeniedKeyTrustSnapshot,
  DenylistTrustSnapshot,
  Environment,
  KeyDelegationPayload,
  KeyDenylistPayload,
  KeyId,
  RootAnchor,
  Sha256,
  SignedPayload,
  SignerPurpose,
  TrustSnapshot,
  TrustedKey,
  UtcSecond,
} from "./types";

export interface ResolvedSigningKeyV1 {
  readonly kid: Uint8Array;
  readonly spkiDer: Uint8Array;
  readonly purpose: SignerPurpose;
  readonly environment: Environment;
  readonly denied?: DeniedKeyTrustSnapshot;
  readonly delegation?: DelegationTrustSnapshot;
}

function asMutableBytes(value: Readonly<Uint8Array>): Uint8Array {
  return new Uint8Array(value);
}

function sameOptionalBytes(
  left: Readonly<Uint8Array> | undefined,
  right: Readonly<Uint8Array> | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return bytesEqual(asMutableBytes(left), asMutableBytes(right));
}

function allRegisteredKeys(trust: TrustSnapshot): readonly (RootAnchor | TrustedKey)[] {
  return [...trust.roots, ...trust.trustedKeys];
}

function sameDenied(
  left: DeniedKeyTrustSnapshot | undefined,
  right: DeniedKeyTrustSnapshot | undefined,
): boolean {
  return left === undefined || right === undefined
    ? left === right
    : bytesEqual(asMutableBytes(left.delegatedKeyId), asMutableBytes(right.delegatedKeyId)) &&
      left.effectiveAt === right.effectiveAt &&
      left.reasonCode === right.reasonCode;
}

function matchingDelegations(
  trust: TrustSnapshot,
  kid: Readonly<Uint8Array>,
): readonly DelegationTrustSnapshot[] {
  const collected: DelegationTrustSnapshot[] = [];
  const add = (candidate: DelegationTrustSnapshot | undefined): void => {
    if (!candidate || !bytesEqual(asMutableBytes(candidate.delegatedKeyId), asMutableBytes(kid))) return;
    if (!collected.some((item) => item === candidate)) collected.push(candidate);
  };
  for (const delegation of trust.delegations) add(delegation);
  return collected;
}

function denylistEntry(
  trust: TrustSnapshot,
  kid: Readonly<Uint8Array>,
): DeniedKeyTrustSnapshot | undefined {
  return trust.denylist?.deniedKeys.find((entry) =>
    bytesEqual(asMutableBytes(entry.delegatedKeyId), asMutableBytes(kid)),
  );
}

export function assertTrustSnapshotIntegrity(
  crypto: LicenseCryptoV1,
  trust: TrustSnapshot,
  expectedEnvironment: Environment,
): void {
  if (trust.environment !== expectedEnvironment) {
    failLicenseCore("TRUST", "SIGNING_KEY_ENVIRONMENT_MISMATCH", "Trust snapshot environment mismatch.");
  }
  if (trust.roots.some((root) => root.purpose !== "PROD_ROOT")) {
    failLicenseCore(
      "TRUST",
      "ROOT_ANCHOR_PURPOSE_INVALID",
      "Every dedicated Root anchor must have PROD_ROOT purpose.",
    );
  }
  if (trust.trustedKeys.some((key) => key.purpose === ("PROD_ROOT" as SignerPurpose))) {
    failLicenseCore(
      "TRUST",
      "ROOT_ANCHOR_LOCATION_INVALID",
      "Production roots must be injected only through the dedicated roots collection.",
    );
  }

  const registrations = allRegisteredKeys(trust);
  for (let index = 0; index < registrations.length; index += 1) {
    const current = registrations[index];
    if (!current) continue;
    const kid = asMutableBytes(current.kid);
    const spki = asMutableBytes(current.spkiDer);
    // An attacker-controlled registry value for a known kid is a trust
    // collision, not merely a bad signature.
    assertSpkiMatchesKid(crypto, spki, kid, { stage: "TRUST", code: "KEY_ID_COLLISION" });
    for (let otherIndex = index + 1; otherIndex < registrations.length; otherIndex += 1) {
      const other = registrations[otherIndex];
      if (!other || !bytesEqual(kid, asMutableBytes(other.kid))) continue;
      if (
        !bytesEqual(spki, asMutableBytes(other.spkiDer)) ||
        current.purpose !== other.purpose ||
        current.environment !== other.environment
      ) {
        failLicenseCore("TRUST", "KEY_ID_COLLISION", "One key id maps to multiple public keys.");
      }
    }
  }


  for (const delegation of trust.delegations) {
    const delegatedKid = asMutableBytes(delegation.delegatedKeyId);
    const delegatedSpki = asMutableBytes(delegation.spkiDer);
    assertSpkiMatchesKid(crypto, delegatedSpki, delegatedKid, {
      stage: "TRUST",
      code: "KEY_ID_COLLISION",
    });
    const roots = trust.roots.filter(
      (entry) =>
        entry.purpose === "PROD_ROOT" &&
        bytesEqual(asMutableBytes(entry.kid), asMutableBytes(delegation.rootKid)),
    );
    if (roots.length !== 1 || roots[0]?.environment !== delegation.environment) {
      failLicenseCore(
        "TRUST",
        "SIGNING_KEY_DELEGATION_MISSING",
        "Delegation does not bind one injected Root in the same environment.",
      );
    }
    const conflicting = matchingDelegations(trust, delegatedKid).find(
      (item) =>
        !bytesEqual(asMutableBytes(item.spkiDer), delegatedSpki) ||
        item.purpose !== delegation.purpose ||
        item.environment !== delegation.environment,
    );
    if (conflicting) {
      failLicenseCore("TRUST", "KEY_ID_COLLISION", "Delegated key metadata is ambiguous.");
    }
  }

  if (trust.denylist) {
    let previousKid: Uint8Array | undefined;
    for (const denied of trust.denylist.deniedKeys) {
      const deniedKid = asMutableBytes(denied.delegatedKeyId);
      if (deniedKid.byteLength !== 32 || (previousKid && compareBytes(previousKid, deniedKid) >= 0)) {
        failLicenseCore("TRUST", "DENYLIST_ENTRY_ORDER_INVALID", "Injected Denylist snapshot is not canonical.");
      }
      previousKid = deniedKid;
    }
  }
}

export function resolveSigningKey(
  crypto: LicenseCryptoV1,
  trust: TrustSnapshot,
  kid: Uint8Array,
  expectedEnvironment: Environment,
): ResolvedSigningKeyV1 {
  assertTrustSnapshotIntegrity(crypto, trust, expectedEnvironment);
  const matches = allRegisteredKeys(trust).filter((entry) =>
    bytesEqual(asMutableBytes(entry.kid), kid),
  );
  const delegations = matchingDelegations(trust, kid);
  if (matches.length === 0 && delegations.length === 0) {
    failLicenseCore("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is not present in injected trust.");
  }
  const first = matches[0];
  const delegation = delegations.reduce<DelegationTrustSnapshot | undefined>(
    (selected, item) =>
      selected === undefined || item.delegationSerial > selected.delegationSerial ? item : selected,
    undefined,
  );
  if (first && delegation) {
    if (
      !bytesEqual(asMutableBytes(first.spkiDer), asMutableBytes(delegation.spkiDer)) ||
      first.purpose !== delegation.purpose ||
      first.environment !== delegation.environment
    ) {
      failLicenseCore("TRUST", "KEY_ID_COLLISION", "Trusted-key and Delegation metadata disagree.");
    }
  }
  const selected = first ?? delegation;
  if (!selected) {
    failLicenseCore("SIGNATURE", "UNKNOWN_SIGNING_KEY", "Signing key is not present in injected trust.");
  }
  const selectedDenied = denylistEntry(trust, kid);
  return {
    kid: copyBytes(kid),
    spkiDer: copyBytes(asMutableBytes(selected.spkiDer)),
    purpose: selected.purpose,
    environment: selected.environment,
    ...(selectedDenied !== undefined ? { denied: selectedDenied } : {}),
    ...(delegation !== undefined ? { delegation } : {}),
  };
}

function vendorValidity(payload: SignedPayload):
  | Readonly<{ issuedAt: bigint; notBefore: bigint; notAfter: bigint }>
  | undefined {
  if (!("notBefore" in payload) || !("notAfter" in payload) || !("issuedAt" in payload)) return undefined;
  return { issuedAt: payload.issuedAt, notBefore: payload.notBefore, notAfter: payload.notAfter };
}

export function assertSigningTrust(
  key: ResolvedSigningKeyV1,
  expectedPurpose: SignerPurpose,
  expectedEnvironment: Environment,
  payload: SignedPayload,
  referenceTime?: UtcSecond,
): void {
  if (key.environment !== expectedEnvironment) {
    failLicenseCore(
      "TRUST",
      "SIGNING_KEY_ENVIRONMENT_MISMATCH",
      "Signing key environment does not match this installation.",
    );
  }
  if ("environment" in payload && payload.environment !== expectedEnvironment) {
    failLicenseCore(
      "TRUST",
      "SIGNING_KEY_ENVIRONMENT_MISMATCH",
      "Signed trust object targets another environment.",
    );
  }
  if (key.denied && (referenceTime === undefined || referenceTime >= key.denied.effectiveAt)) {
    failLicenseCore("TRUST", "SIGNING_KEY_DENIED", "Signing key is cumulatively denied.");
  }
  if (key.purpose !== expectedPurpose) {
    failLicenseCore(
      "TRUST",
      "WRONG_SIGNING_KEY_PURPOSE",
      "Signing key purpose cannot sign this object type.",
    );
  }

  if (!["PROD_ROOT", "INSTALLATION_DEVICE"].includes(expectedPurpose)) {
    const delegation = key.delegation;
    if (!delegation) {
      failLicenseCore(
        "TRUST",
        "SIGNING_KEY_DELEGATION_MISSING",
        "A subordinate Vendor signing key requires an accepted delegation.",
      );
    }
    if (
      delegation.environment !== expectedEnvironment ||
      delegation.purpose !== expectedPurpose ||
      !bytesEqual(asMutableBytes(delegation.delegatedKeyId), key.kid) ||
      !bytesEqual(asMutableBytes(delegation.spkiDer), key.spkiDer)
    ) {
      failLicenseCore(
        "TRUST",
        "WRONG_SIGNING_KEY_PURPOSE",
        "Accepted delegation does not bind this key, environment and purpose.",
      );
    }
    const validity = vendorValidity(payload);
    if (
      validity &&
      (validity.notBefore < delegation.notBefore ||
        validity.notAfter > delegation.notAfter ||
        validity.issuedAt < delegation.notBefore ||
        validity.issuedAt >= delegation.notAfter)
    ) {
      failLicenseCore(
        "TRUST",
        "TOKEN_OUTSIDE_DELEGATION_VALIDITY",
        "Token validity is outside its accepted delegation.",
      );
    }
    if (referenceTime !== undefined && referenceTime >= delegation.notAfter) {
      failLicenseCore(
        "TRUST",
        "SIGNING_KEY_DELEGATION_EXPIRED",
        "Accepted signing-key delegation has expired.",
      );
    }
  }
}

function cloneDenied(entry: DeniedKeyEntry | DeniedKeyTrustSnapshot): DeniedKeyTrustSnapshot {
  return Object.freeze({
    delegatedKeyId: copyBytes(asMutableBytes(entry.delegatedKeyId)),
    effectiveAt: entry.effectiveAt,
    reasonCode: entry.reasonCode,
  });
}

export function validateDelegationUpdateV1(input: Readonly<{
  crypto: LicenseCryptoV1;
  payload: KeyDelegationPayload;
  tokenHash: Sha256;
  rootKid: KeyId;
  current: readonly DelegationTrustSnapshot[];
}>): DelegationTrustSnapshot {
  const { crypto, payload } = input;
  if (!bytesEqual(asMutableBytes(payload.keyId), asMutableBytes(input.rootKid))) {
    failLicenseCore("TRUST", "KEY_ID_MISMATCH", "Verified Delegation signer does not match rootKid.");
  }
  const spkiDer = asMutableBytes(payload.delegatedPublicKey);
  if (!isCanonicalP256Spki(spkiDer)) {
    failLicenseCore("CLAIMS", "NON_CANONICAL_SPKI", "Delegated SPKI is not canonical P-256 DER.");
  }
  assertSpkiMatchesKid(crypto, spkiDer, asMutableBytes(payload.delegatedKeyId), {
    stage: "CLAIMS",
    code: "DELEGATED_KEY_ID_MISMATCH",
  });

  const envelopeStart = payload.issuedAt < payload.notBefore ? payload.issuedAt : payload.notBefore;
  if (payload.notAfter - envelopeStart > 158_112_000n) {
    failLicenseCore("CLAIMS", "DELEGATION_LIFETIME_TOO_LONG", "Delegation exceeds five years.");
  }

  const sameAuthority = input.current.filter(
    (item) =>
      bytesEqual(asMutableBytes(item.rootKid), asMutableBytes(input.rootKid)) &&
      item.environment === payload.environment,
  );
  const highest = sameAuthority.reduce<DelegationTrustSnapshot | undefined>(
    (found, item) => (!found || item.delegationSerial > found.delegationSerial ? item : found),
    undefined,
  );
  if (highest && payload.delegationSerial < highest.delegationSerial) {
    failLicenseCore("STATE", "DELEGATION_SERIAL_ROLLBACK", "Delegation serial is below high-water.");
  }
  if (highest && payload.delegationSerial === highest.delegationSerial) {
    if (!bytesEqual(asMutableBytes(highest.tokenHash), asMutableBytes(input.tokenHash))) {
      failLicenseCore(
        "STATE",
        "DELEGATION_SERIAL_COLLISION",
        "Delegation serial was reused for different bytes.",
      );
    }
    return immutableDataView(highest);
  }

  return immutableDataView({
    tokenId: copyBytes(asMutableBytes(payload.tokenId)),
    tokenHash: copyBytes(asMutableBytes(input.tokenHash)),
    rootKid: copyBytes(asMutableBytes(input.rootKid)),
    delegatedKeyId: copyBytes(asMutableBytes(payload.delegatedKeyId)),
    spkiDer: copyBytes(spkiDer),
    purpose: payload.purpose,
    environment: payload.environment,
    delegationSerial: payload.delegationSerial,
    issuedAt: payload.issuedAt,
    notBefore: payload.notBefore,
    notAfter: payload.notAfter,
    maxTokenLifetimeSeconds: payload.maxTokenLifetimeSeconds,
    ...(payload.purpose === "OFFLINE_ENTITLEMENT"
      ? { maxBusinessTermSeconds: payload.maxBusinessTermSeconds }
      : {}),
  });
}

function findDenied(
  entries: readonly DeniedKeyTrustSnapshot[],
  kid: Readonly<Uint8Array>,
): DeniedKeyTrustSnapshot | undefined {
  return entries.find((entry) => bytesEqual(asMutableBytes(entry.delegatedKeyId), asMutableBytes(kid)));
}

export function validateDenylistUpdateV1(input: Readonly<{
  payload: KeyDenylistPayload;
  tokenHash: Sha256;
  importedAt: UtcSecond;
  current?: DenylistTrustSnapshot;
}>): DenylistTrustSnapshot {
  const { payload, current } = input;
  const envelopeStart = payload.issuedAt < payload.notBefore ? payload.issuedAt : payload.notBefore;
  if (payload.notAfter - envelopeStart > ISSUER_POLICY_SECONDS.businessTermMaximum) {
    failLicenseCore("CLAIMS", "DENYLIST_LIFETIME_TOO_LONG", "Denylist import envelope is too long.");
  }
  if (input.importedAt >= payload.notAfter) {
    failLicenseCore("CLAIMS", "DENYLIST_IMPORT_EXPIRED", "A new Denylist cannot be imported after expiry.");
  }

  let previousKid: Uint8Array | undefined;
  for (const entry of payload.deniedKeys) {
    const currentKid = asMutableBytes(entry.delegatedKeyId);
    if (previousKid && compareBytes(previousKid, currentKid) >= 0) {
      failLicenseCore(
        "CLAIMS",
        "DENYLIST_ENTRY_ORDER_INVALID",
        "Denylist entries must be unique unsigned-byte order.",
      );
    }
    previousKid = currentKid;
  }

  if (current) {
    if (payload.denylistRevision < current.revision) {
      failLicenseCore("STATE", "DENYLIST_REVISION_ROLLBACK", "Denylist revision is below high-water.");
    }
    if (payload.denylistRevision === current.revision) {
      if (!bytesEqual(asMutableBytes(current.tokenHash), asMutableBytes(input.tokenHash))) {
        failLicenseCore(
          "STATE",
          "DENYLIST_REVISION_COLLISION",
          "Denylist revision was reused for different bytes.",
        );
      }
      return immutableDataView(current);
    }
    if (
      !("previousDenylistTokenId" in payload) ||
      !sameOptionalBytes(payload.previousDenylistTokenId, current.tokenId) ||
      !sameOptionalBytes(payload.previousDenylistHash, current.tokenHash)
    ) {
      failLicenseCore(
        "STATE",
        "DENYLIST_PREDECESSOR_MISMATCH",
        "Denylist predecessor does not bind the accepted revision.",
      );
    }
    for (const accepted of current.deniedKeys) {
      const replacement = findDenied(payload.deniedKeys, accepted.delegatedKeyId);
      if (!replacement) {
        failLicenseCore("STATE", "DENYLIST_NOT_CUMULATIVE", "Denylist removed an accepted denial.");
      }
      if (
        replacement.effectiveAt !== accepted.effectiveAt ||
        replacement.reasonCode !== accepted.reasonCode
      ) {
        failLicenseCore("STATE", "DENYLIST_ENTRY_CHANGED", "An accepted denial was changed.");
      }
    }
    if (payload.deniedKeys.length <= current.deniedKeys.length) {
      failLicenseCore(
        "STATE",
        "DENYLIST_NOT_CUMULATIVE",
        "A higher Denylist revision must be a strict cumulative superset.",
      );
    }
  } else if (payload.denylistRevision !== 1n) {
    failLicenseCore(
      "STATE",
      "DENYLIST_PREDECESSOR_MISMATCH",
      "The first accepted Denylist must be revision one.",
    );
  }

  return immutableDataView({
    revision: payload.denylistRevision,
    tokenId: copyBytes(asMutableBytes(payload.tokenId)),
    tokenHash: copyBytes(asMutableBytes(input.tokenHash)),
    deniedKeys: Object.freeze(payload.deniedKeys.map(cloneDenied)),
  });
}

/**
 * Fail closed when a loaded/persisted projection attempts to forget an
 * already accepted denial. Expiry of the importing envelope is deliberately
 * irrelevant: accepted denial facts are permanent in protocol v1.
 */
export function validateDenylistPersistenceV1(input: Readonly<{
  accepted: DenylistTrustSnapshot;
  persisted: DenylistTrustSnapshot;
}>): DenylistTrustSnapshot {
  if (
    input.persisted.revision < input.accepted.revision ||
    !bytesEqual(asMutableBytes(input.persisted.tokenId), asMutableBytes(input.accepted.tokenId)) ||
    !bytesEqual(asMutableBytes(input.persisted.tokenHash), asMutableBytes(input.accepted.tokenHash))
  ) {
    failLicenseCore(
      "STATE",
      "DENIAL_PERSISTENCE_VIOLATION",
      "Persisted Denylist high-water does not match the accepted snapshot.",
    );
  }
  for (const denied of input.accepted.deniedKeys) {
    const persisted = findDenied(input.persisted.deniedKeys, denied.delegatedKeyId);
    if (!persisted || !sameDenied(denied, persisted)) {
      failLicenseCore(
        "STATE",
        "DENIAL_PERSISTENCE_VIOLATION",
        "An accepted denied-key fact was removed or changed.",
      );
    }
  }
  return immutableDataView(input.persisted);
}
