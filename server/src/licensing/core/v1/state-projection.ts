import { bytesEqual, immutableDataView } from "./bytes";
import { compareSemVer, isProductVersionCompatible } from "./semver";
import type {
  LicenseControlFactV1,
  LicenseEffectiveStateV1,
  LicenseModelStateV1,
  LicensePairV1,
  LicenseStateProjectionV1,
} from "./state-types";
import type { Feature } from "./types";

const OPERATIONAL_STATES = new Set<LicenseEffectiveStateV1>([
  "POST_EXPIRY_GRACE",
  "OFFLINE_GRACE",
  "EXPIRING",
  "ACTIVE",
]);

function sameBytes(
  left: Readonly<Uint8Array>,
  right: Readonly<Uint8Array>,
): boolean {
  return bytesEqual(new Uint8Array(left), new Uint8Array(right));
}

function optionalBytesEqual(
  left: Readonly<Uint8Array> | undefined,
  right: Readonly<Uint8Array> | undefined,
): boolean {
  return left === undefined || right === undefined
    ? left === right
    : sameBytes(left, right);
}

function projection(
  state: LicenseModelStateV1,
  effectiveState: LicenseEffectiveStateV1,
  features: readonly Feature[] = [],
): LicenseStateProjectionV1 {
  const operational = OPERATIONAL_STATES.has(effectiveState);
  return immutableDataView({
    state: effectiveState,
    operational,
    stateGeneration: state.stateGeneration,
    runtimeAuthority: "NONE" as const,
    features: operational ? [...features] : [],
  });
}

function allControlFacts(state: LicenseModelStateV1): readonly LicenseControlFactV1[] {
  return [...state.controlHistory, state.control];
}

function controlFactIsEligible(
  fact: LicenseControlFactV1,
  trustedNow: bigint,
): boolean {
  return fact.effectiveAt <= trustedNow && (fact.notBefore ?? 0n) <= trustedNow;
}

function maturedControlState(
  state: LicenseModelStateV1,
  trustedNow: bigint,
): LicenseControlFactV1 | undefined {
  let selected: LicenseControlFactV1 | undefined;
  for (const candidate of allControlFacts(state)) {
    const eligibilityTime = candidate.state === "OPERATIONAL" && state.clock ? state.clockHighWater : trustedNow;
    if (!controlFactIsEligible(candidate, eligibilityTime)) continue;
    if (
      selected === undefined ||
      candidate.revision > selected.revision ||
      (candidate.revision === selected.revision && candidate.effectiveAt > selected.effectiveAt)
    ) {
      selected = candidate;
    }
  }
  return selected;
}

function hasMaturedTerminalRevoke(
  state: LicenseModelStateV1,
  trustedNow: bigint,
): boolean {
  return allControlFacts(state).some(
    (fact) => fact.state === "REVOKED" && controlFactIsEligible(fact, trustedNow),
  );
}

function currentLineageIsTombstoned(state: LicenseModelStateV1): boolean {
  const entitlement = state.current?.entitlement.payload;
  if (!entitlement) return false;
  return state.tombstones.some(
    (tombstone) =>
      sameBytes(tombstone.licenseId, entitlement.licenseId) &&
      sameBytes(tombstone.activationId, entitlement.activationId),
  );
}

function exactBuildBindingMatches(state: LicenseModelStateV1, pair: LicensePairV1): boolean {
  const entitlement = pair.entitlement.payload;
  if (entitlement.edition !== state.build.edition) return false;

  try {
    if (
      !isProductVersionCompatible(
        state.build.productVersion,
        entitlement.minimumProductVersion,
        entitlement.maximumMajorVersion,
      ) ||
      compareSemVer(state.build.productVersion, state.highestProductVersion) < 0
    ) {
      return false;
    }
  } catch {
    return false;
  }

  const lease = pair.lease?.payload;
  if (!lease) return true;
  return (
    lease.edition === state.build.edition &&
    sameBytes(lease.versionIdentitySha256, state.build.versionIdentitySha256) &&
    sameBytes(lease.buildIdentitySha256, state.build.buildIdentitySha256) &&
    sameBytes(lease.buildManifestSha256, state.build.buildManifestSha256)
  );
}

function localEntitlementBindingMatches(state: LicenseModelStateV1, pair: LicensePairV1): boolean {
  const entitlement = pair.entitlement.payload;
  if (!sameBytes(entitlement.installationId, state.device.installationId)) return false;

  // A sealed bindingRecoveryTokenId means a consumed Recovery token, rather
  // than the unchanged parent Entitlement, binds the current local key.
  if (state.device.bindingRecoveryTokenId !== undefined) return true;
  return (
    sameBytes(entitlement.deviceKeyId, state.device.deviceKeyId) &&
    entitlement.assurance === state.device.assurance
  );
}

function exactHybridPairMatches(state: LicenseModelStateV1, pair: LicensePairV1): boolean {
  const entitlement = pair.entitlement.payload;
  const lease = pair.lease?.payload;
  if (entitlement.mode !== "HYBRID_LEASED" || !lease || lease.mode !== "HYBRID_LEASED") {
    return false;
  }
  if (
    !sameBytes(lease.entitlementTokenId, entitlement.tokenId) ||
    lease.entitlementGeneration !== entitlement.generation ||
    !sameBytes(lease.licenseId, entitlement.licenseId) ||
    !sameBytes(lease.activationId, entitlement.activationId) ||
    !sameBytes(lease.installationId, entitlement.installationId) ||
    lease.edition !== entitlement.edition ||
    lease.features.some((feature) => !entitlement.features.includes(feature)) ||
    !sameBytes(lease.installationId, state.device.installationId) ||
    !sameBytes(lease.deviceKeyId, state.device.deviceKeyId) ||
    lease.assurance !== state.device.assurance ||
    !optionalBytesEqual(lease.bindingRecoveryTokenId, state.device.bindingRecoveryTokenId)
  ) {
    return false;
  }
  return localEntitlementBindingMatches(state, pair);
}

function effectiveFeatures(state: LicenseModelStateV1, pair: LicensePairV1): readonly Feature[] {
  const entitlementFeatures = pair.entitlement.payload.features;
  const leaseFeatures = pair.entitlement.payload.mode === "HYBRID_LEASED"
    ? pair.lease?.payload.features ?? []
    : entitlementFeatures;
  const physicallyPresent = new Set(state.build.physicallyPresentFeatures ?? []);
  const codeReady = new Set(state.build.codeReadyFeatures ?? []);
  const leaseAllowed = new Set(leaseFeatures);
  const external = state.build.externallyEnabledFeatures === undefined
    ? undefined
    : new Set(state.build.externallyEnabledFeatures);

  return entitlementFeatures.filter(
    (feature) =>
      leaseAllowed.has(feature) &&
      physicallyPresent.has(feature) &&
      codeReady.has(feature) &&
      (external === undefined || external.has(feature)),
  );
}

function minimum(values: readonly bigint[]): bigint {
  const first = values[0];
  if (first === undefined) throw new TypeError("minimum requires at least one value.");
  return values.slice(1).reduce((result, value) => (value < result ? value : result), first);
}

/**
 * Pure, non-authoritative projection of already authenticated model state.
 *
 * The state-machine factory is responsible for opaque state provenance and a
 * trusted UTC value before calling this helper. Pending candidates are never
 * consulted here and the result always carries runtimeAuthority=NONE.
 */
export function projectLicenseStateV1(
  state: LicenseModelStateV1,
  trustedNow: bigint,
): LicenseStateProjectionV1 {
  const enablingNow = state.clock ? state.clockHighWater : trustedNow;
  if (state.tamperLatched) return projection(state, "TAMPER_LOCKED");
  if (
    hasMaturedTerminalRevoke(state, enablingNow) ||
    currentLineageIsTombstoned(state)
  ) {
    return projection(state, "REVOKED_LOCKED");
  }

  const effectiveControl = maturedControlState(state, trustedNow);
  if (effectiveControl?.state === "SUSPENDED") {
    return projection(state, "SUSPENDED_LOCKED");
  }
  // Provisional calendar crossing can restrict but cannot create terminality.
  if (hasMaturedTerminalRevoke(state, trustedNow)) return projection(state, "RECOVERY_REQUIRED");
  if (state.recoveryRequired || state.timeIncident !== undefined || effectiveControl === undefined) {
    return projection(state, "RECOVERY_REQUIRED");
  }

  const pair = state.current;
  if (!pair) return projection(state, "UNLICENSED");
  if (!localEntitlementBindingMatches(state, pair)) {
    return projection(state, "RECOVERY_REQUIRED");
  }
  if (!exactBuildBindingMatches(state, pair)) {
    return projection(state, "INCOMPATIBLE_LOCKED");
  }

  const entitlement = pair.entitlement.payload;
  const effectiveStart = entitlement.notBefore > entitlement.termStartsAt
    ? entitlement.notBefore
    : entitlement.termStartsAt;
  if (enablingNow < effectiveStart) return projection(state, "UNLICENSED");
  if (trustedNow >= entitlement.graceUntil) {
    return projection(state, "EXPIRED_LOCKED");
  }

  if (entitlement.mode === "HYBRID_LEASED") {
    if (!exactHybridPairMatches(state, pair)) {
      return projection(state, "LEASE_EXPIRED_LOCKED");
    }
    const lease = pair.lease?.payload;
    if (!lease) return projection(state, "LEASE_EXPIRED_LOCKED");
    if (enablingNow < lease.notBefore) return projection(state, "LEASE_EXPIRED_LOCKED");
    const hybridEnd = minimum([
      lease.offlineUntil,
      lease.notAfter,
      entitlement.graceUntil,
    ]);
    if (trustedNow >= hybridEnd) return projection(state, "LEASE_EXPIRED_LOCKED");
  }

  const features = effectiveFeatures(state, pair);
  if (trustedNow >= entitlement.termEndsAt) {
    return projection(state, "POST_EXPIRY_GRACE", features);
  }
  if (entitlement.mode === "HYBRID_LEASED" && state.networkUnavailable) {
    return projection(state, "OFFLINE_GRACE", features);
  }
  if (trustedNow >= entitlement.warningStartsAt) {
    return projection(state, "EXPIRING", features);
  }
  return projection(state, "ACTIVE", features);
}
