import { bytesEqual, immutableDataView } from "./bytes";
import { failLicenseCore, isLicenseCoreError } from "./errors";
import { sha256 } from "./crypto";
import { signedObjectContract } from "./protocol";
import { encodeDeterministicCborV1 } from "./strict-cbor";
import type { DeterministicCborValueV1 } from "./strict-cbor";
import { compareSemVer, parseCanonicalSemVer } from "./semver";
import { createLicenseVerifierV1 } from "./verifier";
import { prepareLicenseTrustUpdateV1 } from "./trust-update";
import { assertSigningTrust, resolveSigningKey } from "./trust";
import type { SignedVerificationContextV1 } from "./verifier";
import { projectLicenseStateV1 } from "./state-projection";
import { corroborateLicenseClockV1, licenseTimeRequestElapsedV1, observeLicenseClockV1 } from "./time";
import type { LicenseClockObservationV1 } from "./time";
import type {
  DeviceBindingSnapshot, EntitlementPayload, LicensingStateSnapshot,
  OutstandingRequestSnapshot, ParentEntitlementSnapshot,
} from "./types";
import type {
  LicenseControlFactV1, LicenseIncidentV1, LicenseModelStateV1, LicensePairV1,
  LicenseStateCommandV1, LicenseStateMachineConfigurationV1, LicenseStateMachineV1,
  LicenseStateTransitionV1, StateTokenTypeV1, StateTokenV1,
} from "./state-types";

const COUNTER_MAX = 9223372036854775807n;
const UTC_MAX = 253402300799n;
const zero = (length: number) => new Uint8Array(length);
const eq = (a: Readonly<Uint8Array>, b: Readonly<Uint8Array>) => bytesEqual(new Uint8Array(a), new Uint8Array(b));
function reject(code: string): never { return failLicenseCore("STATE", code, code); }
const start = (p: EntitlementPayload) => p.notBefore > p.termStartsAt ? p.notBefore : p.termStartsAt;
const head = (s: LicenseModelStateV1) => s.pending ?? s.current;

function counter(value: unknown): asserts value is bigint {
  if (typeof value !== "bigint" || value < 0n || value > COUNTER_MAX) reject("INVALID_STATE_COUNTER");
}
function utc(value: unknown): asserts value is bigint {
  if (typeof value !== "bigint" || value < 0n || value > UTC_MAX) reject("INVALID_TRUSTED_TIME");
}
function exactBytes(value: unknown, size: number): void {
  if (!(value instanceof Uint8Array) || value.length !== size) reject("INVALID_STATE_BINDING");
}
function incident(value: LicenseIncidentV1): void {
  exactBytes(value.id, 16);
  exactBytes(value.nonce, 32);
  if (typeof value.reason !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.reason)) reject("INVALID_INCIDENT");
}
function binding(value: DeviceBindingSnapshot): void {
  exactBytes(value.installationId, 16);
  exactBytes(value.deviceKeyId, 32);
  if (!["SOFTWARE_BOUND", "TPM_ATTESTED"].includes(value.assurance)) reject("INVALID_STATE_BINDING");
  if (value.bindingRecoveryTokenId) exactBytes(value.bindingRecoveryTokenId, 16);
}
function initialControl(): LicenseControlFactV1 {
  return { revision: 0n, state: "OPERATIONAL", effectiveAt: 0n, reasonCode: 0n, tokenId: zero(16), tokenHash: zero(32) };
}
function parent(pair: LicensePairV1): ParentEntitlementSnapshot {
  const p = pair.entitlement.payload;
  return { ...p, tokenHash: pair.entitlement.hash };
}
function lineage(p: { licenseId: Readonly<Uint8Array>; activationId: Readonly<Uint8Array> }, q: typeof p): boolean {
  return eq(p.licenseId, q.licenseId) && eq(p.activationId, q.activationId);
}
function revoked(s: LicenseModelStateV1, now: bigint): boolean {
  now = enablingTime(s, now);
  return s.controlHistory.some(c => c.state === "REVOKED" && c.effectiveAt <= now && (c.notBefore ?? 0n) <= now);
}
function enablingTime(s: LicenseModelStateV1, now: bigint): bigint {
  return s.clock || s.timeIncident ? s.clockHighWater : now;
}
function operationalTime(s: LicenseModelStateV1, now: bigint): bigint {
  if (!s.clock) return now;
  return s.observedUtc !== undefined && s.observedUtc > s.clockHighWater ? s.observedUtc : s.clockHighWater;
}
function snapshot(s: LicenseModelStateV1, now: bigint): LicensingStateSnapshot {
  return {
    stateGeneration: s.stateGeneration, entitlementGeneration: s.entitlementGeneration,
    leaseRevision: s.leaseRevision, controlRevision: s.control.revision,
    controlState: s.control.state, controlEffectiveAt: s.control.effectiveAt,
    controlReasonCode: s.control.reasonCode, timeCorrectionRevision: s.timeCorrectionRevision,
    clockHighWater: s.clockHighWater, terminallyRevoked: revoked(s, now),
    ...(s.incident ? { activeIncidentId: s.incident.id, activeIncidentNonce: s.incident.nonce } : {}),
    acceptedTokenIds: s.receipts.map(r => ({ tokenId: r.tokenId, tokenHash: r.hash })),
  };
}

/** Closed internal model encoding, not a new signed wire format or a secure store. */
function encodable(value: unknown): DeterministicCborValueV1 {
  if (value instanceof Uint8Array || typeof value === "string" || typeof value === "bigint" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(encodable);
  if (typeof value === "object" && value !== null) {
    return new Map(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encodable(v)]));
  }
  reject("INVALID_MODEL_ENCODING");
}

function preserveAuthorization(old: EntitlementPayload, next: EntitlementPayload, now: bigint): void {
  if (now >= old.graceUntil) return;
  // Half-open intervals really overlap; adjacency is admitted only by the lapsed exception.
  if (start(next) >= old.graceUntil || next.graceUntil < old.graceUntil || next.termEndsAt < old.termEndsAt ||
      next.notAfter < old.notAfter || compareSemVer(next.minimumProductVersion, old.minimumProductVersion) > 0 ||
      next.maximumMajorVersion < old.maximumMajorVersion || next.features.length < old.features.length ||
      old.features.some(f => !next.features.includes(f)) ||
      (old.mode === "HYBRID_LEASED" && next.mode === "HYBRID_LEASED" && next.offlineAllowanceSeconds < old.offlineAllowanceSeconds)) {
    reject("ENTITLEMENT_AUTHORIZATION_SHORTENED");
  }
}

function bindingForParent(s: LicenseModelStateV1, pair: LicensePairV1): DeviceBindingSnapshot {
  // A directly bound successor retires the override only for that successor until promotion.
  if (eq(pair.entitlement.payload.deviceKeyId, s.device.deviceKeyId)) {
    const { bindingRecoveryTokenId: _retired, ...direct } = s.device;
    return direct;
  }
  return s.device;
}

/**
 * Portable deterministic planner. Nothing here writes state, reads a clock, opens
 * a network/DB/device, or grants a runtime capability. Only states produced by
 * this factory are accepted; future secure-store rehydration needs its own gate.
 */
export function createLicenseStateMachineV1(configuration: LicenseStateMachineConfigurationV1): LicenseStateMachineV1 {
  return createMachine(configuration);
}
function createMachine(configuration: LicenseStateMachineConfigurationV1, seed?: LicenseModelStateV1): LicenseStateMachineV1 {
  const { crypto: injectedCrypto, ...injectedTrust } = configuration.verification;
  const config = { ...configuration, verification: { ...immutableDataView(injectedTrust), crypto: injectedCrypto },
    build: immutableDataView(configuration.build), device: immutableDataView(configuration.device) };
  binding(config.device);
  if (config.device.bindingRecoveryTokenId) reject("INITIAL_BINDING_OVERRIDE_FORBIDDEN");
  parseCanonicalSemVer(config.build.productVersion);
  if (!["FULL", "ATTENDANCE"].includes(config.build.edition)) reject("INVALID_BUILD_BINDING");
  for (const hash of [config.build.versionIdentitySha256, config.build.buildIdentitySha256, config.build.buildManifestSha256]) exactBytes(hash, 32);
  const verifier = createLicenseVerifierV1(config.verification);
  const crypto = config.verification.crypto;
  const issuedStates = new WeakSet<object>();
  if (seed) issuedStates.add(seed);
  function checkRetainedTrust(state: LicenseModelStateV1, now: bigint): void {
    if (!seed) return;
    const trust = { environment: config.verification.environment, roots: config.verification.roots ?? [],
      trustedKeys: config.verification.trustedKeys ?? [], delegations: config.verification.delegations ?? [],
      ...(config.verification.denylist ? { denylist: config.verification.denylist } : {}) };
    const tokens = [state.current?.entitlement, state.current?.lease, state.pending?.entitlement,
      state.pending?.lease, state.pendingCurrentLease];
    for (const token of tokens) if (token) {
      // Bytes/signature were authenticated before entering the factory-owned model.
      // Re-resolve authority without re-importing historical expiry/consumption claims.
      const key = resolveSigningKey(crypto, trust, new Uint8Array(token.payload.keyId), trust.environment);
      assertSigningTrust(key, token.type === "lease" ? "ONLINE_LEASE" : "OFFLINE_ENTITLEMENT",
        trust.environment, token.payload, enablingTime(state, now));
    }
  }
  function seal(data: Omit<LicenseModelStateV1, "stateHash">): LicenseModelStateV1 {
    const stateHash = sha256(crypto, encodeDeterministicCborV1(encodable(data)));
    const view = immutableDataView({ ...data, stateHash });
    issuedStates.add(view);
    return view;
  }
  function requireState(state: LicenseModelStateV1): void {
    if (!state || !issuedStates.has(state)) reject("UNTRUSTED_MODEL_STATE");
  }
  function initial(): LicenseModelStateV1 {
    return seal({
      modelVersion: 1n, stateGeneration: 0n, previousStateHash: zero(32),
      build: config.build, device: config.device, clockHighWater: 0n,
      highestProductVersion: config.build.productVersion,
      entitlementGeneration: 0n, leaseRevision: 0n, timeCorrectionRevision: 0n,
      control: initialControl(), controlHistory: [initialControl()], tombstones: [], receipts: [],
      consumedRequests: [], consumedRecoveries: [], consumedReactivations: [],
      tamperLatched: false, recoveryRequired: false, networkUnavailable: false,
    });
  }
  function verify<T extends StateTokenTypeV1>(type: T, encoded: Uint8Array, context: SignedVerificationContextV1): StateTokenV1<T> {
    const result = verifier.verifySignedObject({ expectedType: type, encoded, context });
    if (!result.ok) failLicenseCore(result.stage, result.errorCode, result.errorCode);
    return { type, encoded: result.value.encoded, payload: result.value.payload, hash: result.digests.inputSha256 };
  }
  function preflight<T extends StateTokenTypeV1>(s: LicenseModelStateV1, type: T, encoded: Uint8Array, now: bigint): StateTokenV1<T> {
    const token = verify(type, encoded, { trustedNow: now });
    const receipt = s.receipts.find(r => eq(r.tokenId, token.payload.tokenId));
    if (receipt && (!eq(receipt.hash, token.hash) || receipt.type !== type)) reject("TOKEN_ID_COLLISION");
    if (type === "recovery" && s.consumedRecoveries.some(id => eq(id, token.payload.tokenId))) reject("RECOVERY_TOKEN_REPLAYED");
    if (type === "reactivation-authorization" && s.consumedReactivations.some(id => eq(id, token.payload.tokenId))) reject("REACTIVATION_AUTHORIZATION_REPLAYED");
    if ("licenseId" in token.payload && s.tombstones.some(t => eq(t.licenseId, (token.payload as EntitlementPayload).licenseId) || eq(t.activationId, (token.payload as EntitlementPayload).activationId))) reject("TERMINAL_REVOCATION");
    return token;
  }
  function context(s: LicenseModelStateV1, now: bigint, request?: OutstandingRequestSnapshot, pair?: LicensePairV1, device = s.device): SignedVerificationContextV1 {
    return {
      trustedNow: now, build: s.build, device, previousDevice: s.device,
      state: snapshot(s, now), ...(pair ? { parent: parent(pair) } : {}),
      ...(request ? { request } : {}),
    };
  }
  function requestFresh(s: LicenseModelStateV1, r: OutstandingRequestSnapshot | undefined, timeWorkflow = false): asserts r is OutstandingRequestSnapshot {
    if (!r) reject("OUTSTANDING_REQUEST_REQUIRED");
    if (s.consumedRequests.some(c => eq(c.id, r.requestId) || eq(c.hash, r.requestHash))) reject("REQUEST_ALREADY_CONSUMED");
    if (r.challengeConsumed || r.payload.stateGeneration !== s.stateGeneration) reject("REQUEST_STATE_MISMATCH");
    if (!timeWorkflow && (r.requestPurpose === "TIME_RECOVERY" || r.requestPurpose === "TIME_CORRECT")) reject("TIME_WORKFLOW_NOT_IMPLEMENTED");
  }
  function receipt(s: LicenseModelStateV1, t: StateTokenV1<StateTokenTypeV1>, r?: OutstandingRequestSnapshot): LicenseModelStateV1 {
    return { ...s,
      receipts: [...s.receipts, { type: t.type, tokenId: t.payload.tokenId, hash: t.hash,
        ...("licenseId" in t.payload ? { licenseId: t.payload.licenseId, activationId: t.payload.activationId } : {}) }],
      consumedRequests: r ? [...s.consumedRequests, { id: r.requestId, hash: r.requestHash }] : s.consumedRequests,
    };
  }
  function retry(s: LicenseModelStateV1, t: StateTokenV1<StateTokenTypeV1>): boolean {
    return s.receipts.some(r => r.type === t.type && eq(r.tokenId, t.payload.tokenId) && eq(r.hash, t.hash));
  }
  function mature(s: LicenseModelStateV1, now: bigint): LicenseModelStateV1 {
    now = enablingTime(s, now);
    const p = head(s)?.entitlement.payload;
    if (!p) return s;
    const final = [...s.controlHistory].filter(c => c.state === "REVOKED" && c.effectiveAt <= now && (c.notBefore ?? 0n) <= now)
      .sort((a, b) => a.effectiveAt < b.effectiveAt ? -1 : a.effectiveAt > b.effectiveAt ? 1 : a.revision > b.revision ? -1 : 1)[0];
    if (!final || s.tombstones.some(t => lineage(t, p))) return s;
    const fact = { licenseId: p.licenseId, activationId: p.activationId,
      finalControlRevision: final.revision, finalRevokeTokenHash: final.tokenHash };
    const hash = sha256(crypto, encodeDeterministicCborV1(["ENTRY_CONTROL_SYSTEM:MODEL:TOMBSTONE:V1", encodable(fact)]));
    return { ...s, tombstones: [...s.tombstones, { ...fact, id: hash.slice(0, 16), hash }] };
  }
  function promote(s: LicenseModelStateV1, now: bigint): LicenseModelStateV1 {
    const operationalNow = operationalTime(s, now);
    now = enablingTime(s, now);
    const waiting = s.pendingCurrentLease;
    if (waiting && s.current && now >= waiting.payload.notBefore && operationalNow < waiting.payload.offlineUntil && operationalNow < waiting.payload.notAfter) {
      s = { ...s, current: { ...s.current, lease: waiting }, pendingCurrentLease: undefined };
    }
    const pending = s.pending;
    if (!pending || revoked(s, now)) return s;
    const p = pending.entitlement.payload;
    if (now < start(p) || operationalNow >= p.graceUntil) return s;
    if (!eq(p.deviceKeyId, s.device.deviceKeyId) || p.assurance !== s.device.assurance) return s;
    if (p.mode === "HYBRID_LEASED") {
      const l = pending.lease?.payload;
      if (!l || now < l.notBefore || operationalNow >= l.offlineUntil || operationalNow >= l.notAfter) return s;
      // Keep a still-valid older pair until this exact pair can provide at least its remaining authority.
      const old = s.current?.lease?.payload;
      if (old && s.current && now < s.current.entitlement.payload.graceUntil && now < old.offlineUntil &&
          (l.offlineUntil < old.offlineUntil || old.features.some(f => !l.features.includes(f)))) return s;
    }
    return { ...s, current: pending, pending: undefined, pendingCurrentLease: undefined, device: bindingForParent(s, pending) };
  }
  function corroborateImport(s: LicenseModelStateV1, signedUtc: bigint, observation?: LicenseClockObservationV1): LicenseModelStateV1 {
    if (!s.clock || s.timeIncident || !observation) return s;
    const confirmed = corroborateLicenseClockV1(s.clockHighWater, s.clock, observation, signedUtc);
    const observedUtc = operationalTime(s, s.clockHighWater);
    return { ...s, clockHighWater: confirmed.trustedUtc,
      observedUtc: observedUtc > confirmed.trustedUtc ? observedUtc : confirmed.trustedUtc,
      clock: { ...confirmed.anchor, observedUtc: s.clock.observedUtc ?? s.clock.trustedUtc,
        observedMonotonicMs: s.clock.observedMonotonicMs ?? s.clock.monotonicMs } };
  }
  function updateControl(s: LicenseModelStateV1, fact: LicenseControlFactV1): LicenseModelStateV1 {
    if (fact.revision < s.control.revision) reject("CONTROL_REVISION_ROLLBACK");
    if (fact.revision === s.control.revision) {
      if (fact.state !== s.control.state || fact.effectiveAt !== s.control.effectiveAt || fact.reasonCode !== s.control.reasonCode) reject("CONTROL_REVISION_COLLISION");
      return s;
    }
    if (s.controlHistory.some(c => c.state === "REVOKED") && fact.state === "OPERATIONAL") reject("TERMINAL_REVOCATION");
    return { ...s, control: fact, controlHistory: [...s.controlHistory, fact] };
  }
  function reactivationBase(s: LicenseModelStateV1, command: Extract<LicenseStateCommandV1, { kind: "REACTIVATE" }>, now: bigint): LicenseModelStateV1 {
    if (!command.authorization || !command.entitlement) reject("REACTIVATION_PAIR_INCOMPLETE");
    const a = preflight(s, "reactivation-authorization", command.authorization, now);
    const e = preflight(s, "entitlement", command.entitlement, now), p = a.payload, n = e.payload;
    // These artifacts are verified against the same prior snapshot, so also
    // reject collisions within this transaction before consuming either.
    if (eq(p.tokenId, n.tokenId)) reject("TOKEN_ID_COLLISION");
    if (!revoked(s, now) || !s.incident) reject("REVOKED_LINEAGE_MISMATCH");
    const tombstone = s.tombstones.find(t => eq(t.licenseId, p.revokedLicenseId) && eq(t.activationId, p.revokedActivationId));
    if (!tombstone || tombstone.finalControlRevision !== p.finalControlRevision || !eq(tombstone.finalRevokeTokenHash, p.finalRevokeTokenHash)) reject("REVOKED_LINEAGE_MISMATCH");
    if (enablingTime(s, now) < p.notBefore || enablingTime(s, now) < start(n) || now >= n.graceUntil) reject("REACTIVATION_NOT_YET_EFFECTIVE");
    if (!eq(p.incidentId, s.incident.id) || !eq(p.incidentNonce, s.incident.nonce)) reject("REACTIVATION_REQUEST_MISMATCH");
    if (n.generation !== 1n || !("reactivationAuthorizationId" in n) || !eq(n.reactivationAuthorizationId, p.tokenId) ||
        !eq(n.licenseId, p.newLicenseId) || !eq(n.activationId, p.newActivationId) || n.edition !== p.edition ||
        !eq(n.installationId, p.installationId) || !eq(n.deviceKeyId, p.deviceKeyId)) reject("REACTIVATION_PAIR_MISMATCH");
    if (n.features.some(f => !p.maximumFeatures.includes(f))) reject("REACTIVATION_FEATURES_WIDENED");
    requestFresh(s, command.request);
    const rp = command.request.payload;
    if (rp.tokenType !== "activation-request" || rp.requestPurpose !== "REACTIVATE" ||
        !eq(rp.revokedLineageTombstoneId, tombstone.id) || !eq(rp.revokedLineageTombstoneHash, tombstone.hash)) reject("REVOKED_LINEAGE_MISMATCH");
    verify("reactivation-authorization", command.authorization, context(s, now, command.request));
    verify("entitlement", command.entitlement, context(s, now, command.request));
    let next = receipt(receipt(s, a), e, command.request);
    next = { ...next, current: undefined, pending: { entitlement: e }, pendingCurrentLease: undefined, entitlementGeneration: 1n,
      leaseRevision: 0n, timeCorrectionRevision: 0n, control: initialControl(), controlHistory: [initialControl()],
      consumedReactivations: [...s.consumedReactivations, p.tokenId],
      incident: s.tamperLatched || s.recoveryRequired ? s.incident : undefined,
      device: bindingForParent(s, { entitlement: e }),
    };
    return next;
  }
  function reduce(s: LicenseModelStateV1, command: LicenseStateCommandV1, now: bigint): LicenseModelStateV1 {
    switch (command.kind) {
      case "OBSERVE_TIME":
      case "BEGIN_TIME_RECOVERY": {
        incident(command.incident);
        const observed = observeLicenseClockV1(s.clockHighWater, s.clock, command.observation, s.observedUtc ?? s.clockHighWater);
        if (command.kind === "OBSERVE_TIME" && s.timeIncident) return s;
        if (command.kind === "BEGIN_TIME_RECOVERY" || observed.issue || s.timeIncident) {
          // Only an explicit fresh incident can replace a lost-boot request scope.
          // Observations never clear an existing incident or poison its high-water.
          const opening = command.kind === "BEGIN_TIME_RECOVERY" || !s.timeIncident;
          if (opening && s.timeIncident && (eq(command.incident.id, s.timeIncident.id) || eq(command.incident.nonce, s.timeIncident.nonce))) reject("TIME_INCIDENT_MUST_BE_FRESH");
          let clock = s.clock;
          if (opening && (!clock || !eq(clock.bootId, command.observation.bootId))) {
            // The new boot proves no shutdown elapsed, but its incident-to-receipt
            // interval is measurable. Start a floor-only epoch without trusting
            // suspect wall UTC or inventing a signed Vendor observation.
            const anchored = corroborateLicenseClockV1(s.clockHighWater, clock, command.observation, s.clockHighWater);
            const { lastVendorUtc: _unsigned, ...epoch } = anchored.anchor;
            clock = { ...epoch, ...(s.clock?.lastVendorUtc !== undefined ? { lastVendorUtc: s.clock.lastVendorUtc } : {}) };
          }
          return { ...s, clock, observedUtc: s.observedUtc ?? s.clockHighWater, timeIncident: opening ? {
            id: command.incident.id, nonce: command.incident.nonce,
            bootId: command.observation.bootId, monotonicMs: command.observation.monotonicMs,
            preIncidentClockHighWater: s.clockHighWater,
            reason: observed.issue ?? command.incident.reason,
          } : s.timeIncident };
        }
        return { ...s, clock: observed.anchor, clockHighWater: observed.trustedUtc, observedUtc: observed.observedUtc };
      }
      case "APPLY_TIME_CORRECTION":
      case "RECOVER_ONLINE_TIME": {
        const online = command.kind === "RECOVER_ONLINE_TIME";
        if (!s.timeIncident || !s.current) reject("TIME_RECOVERY_INCIDENT_REQUIRED");
        requestFresh(s, command.request, true);
        if (command.request.requestPurpose !== (online ? "TIME_RECOVERY" : "TIME_CORRECT")) reject("TIME_REQUEST_PURPOSE_MISMATCH");
        const elapsed = licenseTimeRequestElapsedV1(s.timeIncident, command.evidence, command.observation, command.request.requestHash, online);
        const timeRequest = { ...command.request, sameBootElapsedSeconds: elapsed } as OutstandingRequestSnapshot;
        const ctx = { ...context(s, now, timeRequest, s.current, bindingForParent(s, s.current)), state: {
          ...snapshot(s, now), activeIncidentId: s.timeIncident.id, activeIncidentNonce: s.timeIncident.nonce,
          clockHighWater: s.timeIncident.preIncidentClockHighWater,
        } };
        if (!online) {
          const { request: _request, ...preflightContext } = ctx;
          verify("time-correction", command.encoded, preflightContext);
          const t = verify("time-correction", command.encoded, ctx), p = t.payload;
          if (!lineage(p, s.current.entitlement.payload)) reject("TIME_CORRECTION_INCIDENT_MISMATCH");
          if (p.correctedUtc < s.clockHighWater) reject("TIME_CORRECTION_BELOW_HIGH_WATER");
          const freshnessBase = p.issuedAt > p.correctedUtc ? p.issuedAt : p.correctedUtc;
          if (p.correctedUtc < p.notBefore || freshnessBase + elapsed >= p.notAfter) reject("TIME_CORRECTION_FRESHNESS_UNPROVEN");
          const next = receipt(s, t, command.request);
          const confirmed = corroborateLicenseClockV1(s.clockHighWater, s.clock, command.observation, p.correctedUtc);
          return { ...next, timeIncident: undefined, timeCorrectionRevision: p.timeCorrectionRevision,
            clockHighWater: confirmed.trustedUtc, observedUtc: confirmed.observedUtc, clock: confirmed.anchor };
        }
        // Verification uses the already-pinned trust and signed serverTime, not
        // the suspect wall clock. This command cannot transport trust updates.
        const rp = timeRequest.payload;
        if (rp.tokenType !== "lease-request" || rp.requestPurpose !== "TIME_RECOVERY" ||
            !eq(rp.incidentId, s.timeIncident.id) || !eq(rp.incidentNonce, s.timeIncident.nonce) ||
            rp.preIncidentClockHighWater !== s.timeIncident.preIncidentClockHighWater) reject("TIME_RECOVERY_INCIDENT_MISMATCH");
        const t = verify("lease", command.encoded, ctx), p = t.payload;
        verify("entitlement", s.current.entitlement.encoded, { trustedNow: p.serverTime, build: s.build });
        if (p.serverTime < start(s.current.entitlement.payload) || p.serverTime >= s.current.entitlement.payload.graceUntil) reject("TIME_RECOVERY_PARENT_NOT_EFFECTIVE");
        if (p.serverTime < s.clockHighWater) reject("TIME_RECOVERY_BELOW_HIGH_WATER");
        if (p.serverTime < p.notBefore) reject("TIME_RECOVERY_LEASE_NOT_EFFECTIVE");
        const next = updateControl(receipt(s, t, command.request), {
          revision: p.controlRevision, state: p.controlState, effectiveAt: p.controlEffectiveAt,
          notBefore: p.notBefore, reasonCode: p.controlReasonCode, tokenId: p.tokenId, tokenHash: t.hash,
        });
        const confirmed = corroborateLicenseClockV1(s.clockHighWater, s.clock, command.observation, p.serverTime);
        return { ...next, current: { ...s.current, lease: t }, pendingCurrentLease: undefined,
          leaseRevision: p.leaseRevision, networkUnavailable: false, timeIncident: undefined,
          clockHighWater: confirmed.trustedUtc, observedUtc: confirmed.observedUtc, clock: confirmed.anchor };
      }
      case "IMPORT_ENTITLEMENT": {
        const t = preflight(s, "entitlement", command.encoded, now), p = t.payload;
        if (retry(s, t)) return s;
        if (revoked(s, now)) reject("TERMINAL_REVOCATION");
        const prior = head(s)?.entitlement.payload;
        if ("reactivationAuthorizationId" in p) reject("REACTIVATION_PAIR_INCOMPLETE");
        if (prior) {
          if (p.generation <= s.entitlementGeneration) reject("ENTITLEMENT_GENERATION_ROLLBACK");
          if (p.generation !== s.entitlementGeneration + 1n || !("previousTokenId" in p) || !eq(p.previousTokenId, prior.tokenId)) reject("ENTITLEMENT_PREDECESSOR_MISMATCH");
          if (!lineage(p, prior) || p.mode !== prior.mode || p.edition !== prior.edition || !eq(p.customerId, prior.customerId)) reject("ENTITLEMENT_LINEAGE_MISMATCH");
        } else if (p.generation !== 1n) reject("ENTITLEMENT_PREDECESSOR_MISMATCH");
        requestFresh(s, command.request);
        verify("entitlement", command.encoded, context(s, now, command.request));
        const corroborated = corroborateImport(s, p.issuedAt, command.observation);
        // A provisional calendar lapse cannot waive an existing commercial
        // grant. Only fully verified signed/elapsed evidence can justify lapse.
        if (prior) preserveAuthorization(prior, p, enablingTime(corroborated, now));
        if (s.current) preserveAuthorization(s.current.entitlement.payload, p, enablingTime(corroborated, now));
        return promote({ ...receipt(corroborated, t, command.request), pending: { entitlement: t }, entitlementGeneration: p.generation }, now);
      }
      case "IMPORT_LEASE": {
        const t = preflight(s, "lease", command.encoded, now), p = t.payload;
        if (retry(s, t)) return s;
        if (revoked(s, now)) reject("TERMINAL_REVOCATION");
        const pending = s.pending && eq(s.pending.entitlement.payload.tokenId, command.parentTokenId);
        const pair = pending ? s.pending : s.current && eq(s.current.entitlement.payload.tokenId, command.parentTokenId) ? s.current : undefined;
        if (!pair) reject("LEASE_PARENT_MISMATCH");
        // Revision preflight must precede request state checks and has the exact frozen STATE diagnostics.
        verify("lease", command.encoded, context(s, now, undefined, pair, bindingForParent(s, pair)));
        requestFresh(s, command.request);
        verify("lease", command.encoded, context(s, now, command.request, pair, bindingForParent(s, pair)));
        let next = updateControl(s, { revision: p.controlRevision, state: p.controlState, effectiveAt: p.controlEffectiveAt,
          notBefore: p.notBefore, reasonCode: p.controlReasonCode, tokenId: p.tokenId, tokenHash: t.hash });
        next = { ...receipt(next, t, command.request), leaseRevision: p.leaseRevision, networkUnavailable: false,
          ...(pending ? { pending: { ...pair, lease: t } } : { pendingCurrentLease: t }) };
        return promote(corroborateImport(next, p.serverTime, command.observation), now);
      }
      case "IMPORT_LEASE_CONTROL": {
        if (command.lease.kind !== "IMPORT_LEASE" && command.lease.kind !== "RECOVER_ONLINE_TIME") reject("COMBINED_LEASE_COMMAND_INVALID");
        // Both reductions share the original generation. Neither intermediate
        // state is sealed, published or handed to an adapter. The outer transition
        // seals the complete outcome exactly once, after both checks succeed.
        const leased = reduce(s, command.lease, now);
        const controlNow = command.lease.kind === "RECOVER_ONLINE_TIME" ? operationalTime(leased, leased.clockHighWater) : now;
        const control = preflight(s, "offline-control", command.control, controlNow);
        const controlCommand = { kind: "IMPORT_CONTROL" as const, encoded: command.control,
          ...(command.controlRequest ? { request: command.controlRequest } : {}) };
        // The sequence is activation-global. An equal-revision Lease may only
        // echo the exact tuple established by Control; Control cannot reuse a
        // revision established by another token. No temporary state escapes.
        return control.payload.controlRevision > leased.control.revision
          ? reduce(leased, controlCommand, controlNow)
          : reduce(reduce(s, controlCommand, controlNow), command.lease, now);
      }
      case "IMPORT_CONTROL": {
        const t = preflight(s, "offline-control", command.encoded, now), p = t.payload;
        if (retry(s, t)) return s;
        const target = head(s)?.entitlement.payload;
        if (!target || !lineage(p, target)) reject("CONTROL_LINEAGE_MISMATCH");
        verify("offline-control", command.encoded, context(s, now));
        if (p.origin === "REQUEST_BOUND") {
          requestFresh(s, command.request);
          verify("offline-control", command.encoded, context(s, now, command.request));
        } else if (command.request) reject("CONTROL_REQUEST_MISMATCH");
        const fact: LicenseControlFactV1 = { revision: p.controlRevision, state: p.action === "REVOKE" ? "REVOKED" : p.action === "SUSPEND" ? "SUSPENDED" : "OPERATIONAL",
          effectiveAt: p.effectiveAt, notBefore: p.notBefore, reasonCode: p.reasonCode, tokenId: p.tokenId, tokenHash: t.hash };
        return receipt(updateControl(s, fact), t, command.request);
      }
      case "RECOVER": {
        const t = preflight(s, "recovery", command.encoded, now), p = t.payload;
        if (revoked(s, now)) reject("TERMINAL_REVOCATION");
        if (!s.incident || !s.current) reject("RECOVERY_INCIDENT_MISMATCH");
        if (enablingTime(s, now) < p.notBefore) reject("RECOVERY_NOT_YET_EFFECTIVE");
        requestFresh(s, command.request);
        const device = command.newDevice ?? s.device;
        binding(device);
        const recoveryContext = context(s, now, command.request, s.current, device);
        verify("recovery", command.encoded, { ...recoveryContext,
          state: { ...snapshot(s, now), entitlementGeneration: s.current.entitlement.payload.generation } });
        if (!eq(p.incidentId, s.incident.id) || !eq(p.incidentNonce, s.incident.nonce)) reject("RECOVERY_INCIDENT_MISMATCH");
        if (p.allowedTransition !== "REBIND_DEVICE" && command.newDevice) reject("RECOVERY_TRANSITION_MISMATCH");
        if (p.allowedTransition === "CLEAR_TAMPER" && !s.tamperLatched) reject("RECOVERY_TRANSITION_MISMATCH");
        if (p.allowedTransition === "REPAIR_SECURE_STATE" && !s.recoveryRequired) reject("RECOVERY_TRANSITION_MISMATCH");
        if (p.allowedTransition === "REBIND_DEVICE" && !command.newDevice) reject("RECOVERY_TRANSITION_MISMATCH");
        const next = receipt(s, t, command.request);
        return { ...next, consumedRecoveries: [...s.consumedRecoveries, p.tokenId],
          tamperLatched: p.allowedTransition === "CLEAR_TAMPER" ? false : s.tamperLatched,
          recoveryRequired: p.allowedTransition === "REPAIR_SECURE_STATE" || p.allowedTransition === "REBIND_DEVICE" ? false : s.recoveryRequired,
          // An independent remaining lock retains its incident for a separately scoped operation.
          incident: (p.allowedTransition !== "CLEAR_TAMPER" && s.tamperLatched) || (p.allowedTransition === "CLEAR_TAMPER" && s.recoveryRequired) ? s.incident : undefined,
          device: p.allowedTransition === "REBIND_DEVICE" ? { ...device, bindingRecoveryTokenId: p.tokenId } : s.device,
        };
      }
      case "REACTIVATE": {
        const next = reactivationBase(s, command, now), n = next.pending!.entitlement.payload;
        if (n.mode === "HYBRID_LEASED" && (!command.lease || !command.leaseRequest)) reject("REACTIVATION_PAIR_INCOMPLETE");
        if (n.mode === "OFFLINE_BOUND" && (command.lease || command.leaseRequest)) reject("REACTIVATION_PAIR_MISMATCH");
        if (command.controlRequest && !command.control) reject("REACTIVATION_CONTROL_MISMATCH");
        if (command.control && (n.mode !== "HYBRID_LEASED" || !command.lease || !command.leaseRequest)) reject("REACTIVATION_CONTROL_MISMATCH");
        if (n.mode === "HYBRID_LEASED" && command.lease && command.leaseRequest) {
          const leaseCommand = { kind: "IMPORT_LEASE" as const, encoded: command.lease,
            request: command.leaseRequest, parentTokenId: n.tokenId };
          let complete = reduce(next, leaseCommand, now);
          if (!complete.current || !eq(complete.current.entitlement.payload.tokenId, n.tokenId)) reject("REACTIVATION_PAIR_INCOMPLETE");
          if (command.control) {
            const controlCommand = { kind: "IMPORT_CONTROL" as const, encoded: command.control,
              ...(command.controlRequest ? { request: command.controlRequest } : {}) };
            const control = preflight(next, "offline-control", command.control, now);
            // Match the existing Lease+Control ordering rule: an equal Control
            // tuple establishes its fact first, so the Lease may only echo it.
            complete = control.payload.controlRevision > complete.control.revision
              ? reduce(complete, controlCommand, now)
              : reduce(reduce(next, controlCommand, now), leaseCommand, now);
          }
          return complete;
        }
        return promote(next, now);
      }
      case "REEVALUATE": return promote(s, now);
      case "NETWORK":
        if (typeof command.unavailable !== "boolean") reject("INVALID_NETWORK_OBSERVATION");
        return s.networkUnavailable === command.unavailable ? s : { ...s, networkUnavailable: command.unavailable };
      case "BEGIN_REACTIVATION":
        if (!revoked(s, now)) reject("REVOKED_LINEAGE_MISMATCH");
        incident(command.incident);
        if (s.incident) reject("INCIDENT_ALREADY_OPEN");
        return { ...s, incident: command.incident };
      case "INTEGRITY_INCIDENT": {
        incident(command.incident);
        if (s.incident && (!eq(s.incident.id, command.incident.id) || !eq(s.incident.nonce, command.incident.nonce))) reject("INCIDENT_ALREADY_OPEN");
        const evidence = command.evidence ?? [];
        const domains = new Set<string>();
        for (const e of evidence) {
          counter(e.observedGeneration); counter(e.protectedHighWater);
          if (!["TPM", "SEALED_PROGRAMDATA", "SEALED_REGISTRY"].includes(e.protectionDomain) || domains.has(e.protectionDomain)) reject("INVALID_ROLLBACK_EVIDENCE");
          domains.add(e.protectionDomain);
        }
        const corroborated = evidence.length >= 2 && evidence.every(e => e.observedGeneration < e.protectedHighWater) &&
          evidence.every(e => e.observedGeneration === evidence[0]?.observedGeneration);
        return { ...s, incident: command.incident, tamperLatched: s.tamperLatched || corroborated,
          recoveryRequired: s.recoveryRequired || !corroborated };
      }
      default: return reject("UNKNOWN_STATE_COMMAND");
    }
  }
  function transition(state: LicenseModelStateV1, command: LicenseStateCommandV1, trustedNow: bigint): LicenseStateTransitionV1 {
    try {
      requireState(state); utc(trustedNow);
      const timeWorkflow = ["OBSERVE_TIME", "BEGIN_TIME_RECOVERY", "APPLY_TIME_CORRECTION", "RECOVER_ONLINE_TIME"].includes(command.kind) ||
        (command.kind === "IMPORT_LEASE_CONTROL" && command.lease.kind === "RECOVER_ONLINE_TIME");
      if (timeWorkflow || state.timeIncident) trustedNow = state.clockHighWater;
      else if (state.clock) trustedNow = operationalTime(state, trustedNow);
      else if (trustedNow < state.clockHighWater) reject("TRUSTED_TIME_BELOW_HIGH_WATER");
      const bound = (bytes: unknown, type: StateTokenTypeV1) => {
        if (bytes instanceof Uint8Array && bytes.byteLength > signedObjectContract(type).maxEncodedBytes)
          failLicenseCore("PRE_DECODE", "OBJECT_TOO_LARGE", "State command exceeds the signed object byte limit.");
      };
      if (command.kind === "IMPORT_LEASE_CONTROL") {
        bound(command.lease.encoded, "lease"); bound(command.control, "offline-control");
      } else if (command.kind === "REACTIVATE") {
        bound(command.authorization, "reactivation-authorization");
        bound(command.entitlement, "entitlement"); bound(command.lease, "lease"); bound(command.control, "offline-control");
      } else if ("encoded" in command) {
        bound(command.encoded, command.kind === "APPLY_TIME_CORRECTION" ? "time-correction" : command.kind === "RECOVER_ONLINE_TIME" ? "lease" : command.kind === "IMPORT_ENTITLEMENT" ? "entitlement" : command.kind === "IMPORT_LEASE" ? "lease" : command.kind === "IMPORT_CONTROL" ? "offline-control" : "recovery");
      }
      const safeCommand = immutableDataView(command);
      if (safeCommand.kind === "IMPORT_LEASE_CONTROL") {
        const leaseHash = sha256(crypto, safeCommand.lease.encoded), controlHash = sha256(crypto, safeCommand.control);
        const leaseSeen = state.receipts.some(r => r.type === "lease" && eq(r.hash, leaseHash));
        const controlSeen = state.receipts.some(r => r.type === "offline-control" && eq(r.hash, controlHash));
        if (leaseSeen || controlSeen) {
          if (!leaseSeen || !controlSeen) reject("COMBINED_PARTIAL_RECEIPT");
          if (safeCommand.lease.kind === "RECOVER_ONLINE_TIME") reject("COMBINED_TIME_RECOVERY_REPLAYED");
          // Preserve the existing read-only receipt and retired/revoked-lineage
          // rules. Two receipts confirm facts only; they cannot reapply either half.
          const a = transition(state, safeCommand.lease, trustedNow);
          const b = transition(state, { kind: "IMPORT_CONTROL", encoded: safeCommand.control,
            ...(safeCommand.controlRequest ? { request: safeCommand.controlRequest } : {}) }, trustedNow);
          if (!a.ok) return a;
          if (!b.ok) return b;
          if (a.decision !== "IDEMPOTENT" || b.decision !== "IDEMPOTENT") reject("COMBINED_RECEIPT_INVALID");
          return a;
        }
      }
      // A byte-identical receipt is already authenticated. Retry is not fresh import,
      // and never revives its token or changes a pair/consumption after expiration.
      const retryBytes = "encoded" in safeCommand ? safeCommand.encoded : safeCommand.kind === "REACTIVATE" ? safeCommand.authorization : undefined;
      if (retryBytes instanceof Uint8Array) {
        const hash = sha256(crypto, retryBytes);
        const seen = state.receipts.find(r => eq(r.hash, hash));
        if (seen) {
          if (seen.type === "time-correction" && safeCommand.kind === "APPLY_TIME_CORRECTION") reject("TIME_CORRECTION_REPLAYED");
          if (seen.type === "recovery") reject("RECOVERY_TOKEN_REPLAYED");
          if (seen.type === "reactivation-authorization") reject("REACTIVATION_AUTHORIZATION_REPLAYED");
          const expected = safeCommand.kind === "IMPORT_ENTITLEMENT" ? "entitlement" : safeCommand.kind === "IMPORT_LEASE" ? "lease" : safeCommand.kind === "IMPORT_CONTROL" ? "offline-control" : undefined;
          if (expected === seen.type) {
            if (seen.licenseId && seen.activationId && state.tombstones.some(t => eq(t.licenseId, seen.licenseId!) || eq(t.activationId, seen.activationId!))) {
              const current = head(state)?.entitlement.payload;
              const finalRevoke = state.tombstones.some(t => eq(t.licenseId, seen.licenseId!) && eq(t.activationId, seen.activationId!) && eq(t.finalRevokeTokenHash, seen.hash));
              if (seen.type !== "offline-control" || !finalRevoke || !current || !eq(current.licenseId, seen.licenseId) || !eq(current.activationId, seen.activationId)) reject("TERMINAL_REVOCATION");
            }
            return Object.freeze({ ok: true, decision: "IDEMPOTENT", state,
              expectedPreviousGeneration: state.stateGeneration, get expectedPreviousHash() { return state.stateHash; },
              authoritativeStateChanged: false, requestConsumed: false, commitObligations: Object.freeze([]) });
          }
        }
      }
      let base = state;
      const importCommand = safeCommand.kind === "IMPORT_LEASE_CONTROL" ? safeCommand.lease : safeCommand;
      if (state.clock && !state.timeIncident && (importCommand.kind === "IMPORT_ENTITLEMENT" || importCommand.kind === "IMPORT_LEASE") && importCommand.observation) {
        const observed = observeLicenseClockV1(state.clockHighWater, state.clock, importCommand.observation, state.observedUtc ?? state.clockHighWater);
        if (observed.issue) reject("SIGNED_TIME_OBSERVATION_INVALID");
        base = { ...state, clock: observed.anchor, observedUtc: observed.observedUtc, clockHighWater: observed.trustedUtc };
        trustedNow = operationalTime(base, trustedNow);
      }
      let next = reduce(mature(base, trustedNow), safeCommand, trustedNow);
      if (timeWorkflow) trustedNow = operationalTime(next, next.clockHighWater);
      next = mature(next, trustedNow);
      if (timeWorkflow && !next.timeIncident) next = promote(next, trustedNow);
      if (next === state) return Object.freeze({ ok: true, decision: "IDEMPOTENT", state,
        expectedPreviousGeneration: state.stateGeneration, get expectedPreviousHash() { return state.stateHash; },
        authoritativeStateChanged: false, requestConsumed: false, commitObligations: Object.freeze([]) });
      if (state.stateGeneration === COUNTER_MAX) reject("STATE_GENERATION_EXHAUSTED");
      const { stateHash: _oldHash, ...data } = next;
      const sealed = seal({ ...data, stateGeneration: state.stateGeneration + 1n,
        previousStateHash: state.stateHash, clockHighWater: next.clock ? next.clockHighWater : trustedNow });
      return Object.freeze({ ok: true, decision: "PROPOSED", state: sealed,
        expectedPreviousGeneration: state.stateGeneration, get expectedPreviousHash() { return state.stateHash; },
        authoritativeStateChanged: false, requestConsumed: false,
        commitObligations: Object.freeze([
          "COMPARE_PREVIOUS_GENERATION_AND_HASH", "STAGE_COMPLETE_STATE_AND_JOURNAL",
          "FLUSH_AND_ATOMICALLY_REPLACE_COMPLETE_STATE", "SEAL_INDEPENDENT_ANCHORS",
          "RECONCILE_RESTRICTIVE_TRANSITION_BEFORE_REPORTING_EFFECTIVE",
        ]),
      });
    } catch (error) {
      return Object.freeze({ ok: false, stage: isLicenseCoreError(error) ? error.stage : "STATE",
        errorCode: isLicenseCoreError(error) ? error.code : "STATE_EVALUATION_FAILED",
        state, authoritativeStateChanged: false, requestConsumed: false });
    }
  }
  function checkedTransition(state: LicenseModelStateV1, command: LicenseStateCommandV1, now: bigint): LicenseStateTransitionV1 {
    const result = transition(state, command, now);
    if (!result.ok) return result;
    try { checkRetainedTrust(result.state, now); return result; }
    catch (error) { return Object.freeze({ ok: false, stage: isLicenseCoreError(error) ? error.stage : "STATE",
      errorCode: isLicenseCoreError(error) ? error.code : "TRUST_REVALIDATION_FAILED", state,
      authoritativeStateChanged: false, requestConsumed: false }); }
  }
  return Object.freeze({ initial, transition: checkedTransition, assertOwnsState: requireState,
    reactivationTarget: (state: LicenseModelStateV1, input: Readonly<{ authorization: Uint8Array; entitlement: Uint8Array; request: OutstandingRequestSnapshot }>, now: bigint) => {
      requireState(state); utc(now);
      if (!input || Object.keys(input).some(k => !["authorization", "entitlement", "request"].includes(k))) reject("REACTIVATION_TARGET_INPUT_INVALID");
      for (const [value, type] of [[input.authorization, "reactivation-authorization"], [input.entitlement, "entitlement"]] as const)
        if (!(value instanceof Uint8Array) || !value.length || value.length > signedObjectContract(type).maxEncodedBytes) reject("REACTIVATION_TARGET_BYTES_INVALID");
      if (state.timeIncident) reject("TIME_RECOVERY_REACTIVATION_TARGET_FORBIDDEN");
      if (state.clock) now = operationalTime(state, now);
      else if (now < state.clockHighWater) reject("TRUSTED_TIME_BELOW_HIGH_WATER");
      const next = reactivationBase(mature(state, now), { kind: "REACTIVATE", ...immutableDataView(input) }, now);
      if (!next.pending || next.pending.entitlement.payload.mode !== "HYBRID_LEASED") reject("HYBRID_MODE_REQUIRED");
      return immutableDataView(parent(next.pending));
    },
    stageTrust: (state: LicenseModelStateV1, encodedBundle: Uint8Array, trustedNow: bigint) => {
      requireState(state); utc(trustedNow);
      if (state.timeIncident) reject("TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN");
      if (trustedNow < state.clockHighWater) reject("TRUSTED_TIME_BELOW_HIGH_WATER");
      const trust = prepareLicenseTrustUpdateV1(config.verification, encodedBundle, enablingTime(state, trustedNow));
      return Object.freeze({ machine: createMachine({ ...config, verification: { ...trust, crypto } }, state), state, trust });
    }, timeCorrectionReceipt: (state: LicenseModelStateV1, encoded: Uint8Array) => {
    requireState(state);
    if (!(encoded instanceof Uint8Array) || encoded.length > signedObjectContract("time-correction").maxEncodedBytes)
      return "NOT_APPLIED" as const;
    const hash = sha256(crypto, encoded);
    return state.receipts.some(r => r.type === "time-correction" && eq(r.hash, hash)) ? "ALREADY_APPLIED" as const : "NOT_APPLIED" as const;
  }, project: (state: LicenseModelStateV1, now: bigint) => {
    requireState(state); utc(now);
    if (now < state.clockHighWater) reject("TRUSTED_TIME_BELOW_HIGH_WATER");
    checkRetainedTrust(state, now);
    return projectLicenseStateV1(state, operationalTime(state, now));
  } });
}
