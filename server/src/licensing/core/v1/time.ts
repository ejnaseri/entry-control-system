import { bytesEqual, immutableDataView } from "./bytes";
import { failLicenseCore } from "./errors";
import { ISSUER_POLICY_SECONDS } from "./protocol";
import type { OpaqueId, Sha256 } from "./types";

export const LICENSE_CLOCK_TOLERANCE_SECONDS = ISSUER_POLICY_SECONDS.clockTolerance;
const UTC_MAX = 253402300799n;
const COUNTER_MAX = 9223372036854775807n;

/** Trusted adapter observations, not evidence acquired/authenticated by this module.
 * monotonicMs must include suspend/hibernate elapsed time. Boot identity changes
 * on reboot, not on service restart. No OS time, network or storage is read here. */
export interface LicenseClockObservationV1 {
  readonly wallUtc: bigint;
  readonly bootId: OpaqueId;
  readonly monotonicMs: bigint;
}
export interface LicenseClockAnchorV1 {
  readonly bootId: OpaqueId;
  readonly monotonicMs: bigint;
  readonly trustedUtc: bigint;
  /** Independent operational-calendar epoch; never a source for floor elapsed. */
  readonly observedUtc?: bigint;
  readonly observedMonotonicMs?: bigint;
  readonly lastMonotonicMs?: bigint;
  readonly floorRemainderMs?: bigint;
  readonly lastVendorUtc?: bigint;
}
export interface LicenseTimeIncidentV1 {
  readonly id: OpaqueId;
  readonly nonce: Sha256;
  readonly bootId: OpaqueId;
  readonly monotonicMs: bigint;
  readonly preIncidentClockHighWater: bigint;
  readonly reason: string;
}
/** The later request store must seal this with the exact outstanding request. */
export interface LicenseTimeRequestEvidenceV1 {
  readonly bootId: OpaqueId;
  readonly sentMonotonicMs: bigint;
  readonly requestHash: Sha256;
}
export function assertLicenseUtcV1(value: unknown): asserts value is bigint {
  if (typeof value !== "bigint" || value < 0n || value > UTC_MAX)
    failLicenseCore("STATE", "INVALID_TRUSTED_TIME", "UTC must be a bounded integer.");
}
function tick(value: unknown): asserts value is bigint {
  if (typeof value !== "bigint" || value < 0n || value > COUNTER_MAX)
    failLicenseCore("STATE", "INVALID_MONOTONIC_EVIDENCE", "Invalid monotonic milliseconds.");
}
function boot(value: unknown): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 16)
    failLicenseCore("STATE", "INVALID_BOOT_EVIDENCE", "Expected opaque boot identity.");
}
function remainder(anchor: LicenseClockAnchorV1): bigint {
  const value = anchor.floorRemainderMs ?? 0n;
  if (typeof value !== "bigint" || value < 0n || value >= 1000n)
    failLicenseCore("STATE", "INVALID_MONOTONIC_EVIDENCE", "Invalid floor fractional evidence.");
  return value;
}
export function assertLicenseClockObservationV1(value: LicenseClockObservationV1): void {
  assertLicenseUtcV1(value.wallUtc); boot(value.bootId); tick(value.monotonicMs);
}

export function observeLicenseClockV1(
  highWater: bigint, anchor: LicenseClockAnchorV1 | undefined, observation: LicenseClockObservationV1,
  observedHighWater: bigint = highWater,
): Readonly<{ trustedUtc: bigint; observedUtc: bigint; anchor: LicenseClockAnchorV1; issue?: "CLOCK_ROLLBACK" | "CLOCK_FORWARD_JUMP" | "MONOTONIC_EVIDENCE_LOST" }> {
  assertLicenseUtcV1(highWater); assertLicenseUtcV1(observedHighWater); assertLicenseClockObservationV1(observation);
  let floor = highWater;
  let lowerBound = observedHighWater > floor ? observedHighWater : floor;
  let comparable = false;
  let predictedUtc: bigint | undefined;
  let forwardReference: bigint | undefined;
  let carriedRemainder = 0n;
  let issue: "CLOCK_ROLLBACK" | "CLOCK_FORWARD_JUMP" | "MONOTONIC_EVIDENCE_LOST" | undefined;
  if (anchor) {
    boot(anchor.bootId); tick(anchor.monotonicMs); assertLicenseUtcV1(anchor.trustedUtc);
    const residual = remainder(anchor);
    tick(anchor.lastMonotonicMs ?? anchor.monotonicMs);
    const lastElapsed = (anchor.lastMonotonicMs ?? anchor.monotonicMs) - anchor.monotonicMs + residual;
    if (lastElapsed < 0n) failLicenseCore("STATE", "INVALID_MONOTONIC_EVIDENCE", "Invalid protected epoch.");
    if (anchor.lastVendorUtc !== undefined) {
      assertLicenseUtcV1(anchor.lastVendorUtc);
      if (anchor.lastVendorUtc > floor) floor = anchor.lastVendorUtc;
    }
    if (bytesEqual(anchor.bootId, observation.bootId)) {
      tick(anchor.lastMonotonicMs ?? anchor.monotonicMs);
      tick(anchor.observedMonotonicMs ?? anchor.monotonicMs);
      assertLicenseUtcV1(anchor.observedUtc ?? anchor.trustedUtc);
      if (observation.monotonicMs < (anchor.lastMonotonicMs ?? anchor.monotonicMs) ||
          observation.monotonicMs < anchor.monotonicMs ||
          observation.monotonicMs < (anchor.observedMonotonicMs ?? anchor.monotonicMs)) issue = "MONOTONIC_EVIDENCE_LOST";
      else {
        const predicted = anchor.trustedUtc + (observation.monotonicMs - anchor.monotonicMs + residual) / 1000n;
        predictedUtc = predicted;
        assertLicenseUtcV1(predicted);
        if (predicted > floor) floor = predicted;
        const observedPrediction = (anchor.observedUtc ?? anchor.trustedUtc) +
          (observation.monotonicMs - (anchor.observedMonotonicMs ?? anchor.monotonicMs)) / 1000n;
        assertLicenseUtcV1(observedPrediction);
        forwardReference = observedPrediction > floor ? observedPrediction : floor;
        if (observedPrediction > lowerBound) lowerBound = observedPrediction;
        comparable = true;
      }
    } else if (anchor.trustedUtc + lastElapsed / 1000n === floor) {
      carriedRemainder = lastElapsed % 1000n;
    }
  }
  if (floor > lowerBound) lowerBound = floor;
  if (!issue && observation.wallUtc + LICENSE_CLOCK_TOLERANCE_SECONDS < lowerBound) issue = "CLOCK_ROLLBACK";
  if (!issue && forwardReference !== undefined && observation.wallUtc > forwardReference + LICENSE_CLOCK_TOLERANCE_SECONDS) issue = "CLOCK_FORWARD_JUMP";
  // Calendar evidence controls finite expiry, never the irreversible correction
  // floor. In particular, unknown shutdown duration cannot become floor elapsed.
  const trustedUtc = issue ? highWater : floor;
  const observedUtc = issue ? observedHighWater : observation.wallUtc > lowerBound ? observation.wallUtc : lowerBound;
  const retained = !issue && comparable && anchor;
  return immutableDataView({ trustedUtc, observedUtc, anchor: {
    bootId: observation.bootId,
    monotonicMs: retained && predictedUtc === trustedUtc ? anchor.monotonicMs : observation.monotonicMs,
    trustedUtc: retained && predictedUtc === trustedUtc ? anchor.trustedUtc : trustedUtc,
    observedUtc: retained ? anchor.observedUtc ?? anchor.trustedUtc : observedUtc,
    observedMonotonicMs: retained ? anchor.observedMonotonicMs ?? anchor.monotonicMs : observation.monotonicMs,
    lastMonotonicMs: observation.monotonicMs,
    floorRemainderMs: retained && predictedUtc === trustedUtc ? remainder(anchor) : carriedRemainder,
    ...(anchor?.lastVendorUtc !== undefined ? { lastVendorUtc: anchor.lastVendorUtc } : {}),
  }, ...(issue ? { issue } : {}) });
}

/** Authenticated signed time at a trusted adapter receipt, not Windows UTC.
 * Preserve an older dominating floor epoch so repeated repairs cannot discard
 * fractional elapsed time. No full request RTT is added to a signed timestamp. */
export function corroborateLicenseClockV1(
  highWater: bigint, anchor: LicenseClockAnchorV1 | undefined,
  observation: LicenseClockObservationV1, signedUtc: bigint,
): Readonly<{ trustedUtc: bigint; observedUtc: bigint; anchor: LicenseClockAnchorV1 }> {
  assertLicenseUtcV1(highWater); assertLicenseUtcV1(signedUtc); assertLicenseClockObservationV1(observation);
  let floor = highWater;
  let retain = false;
  let carriedRemainder = 0n;
  if (anchor && bytesEqual(anchor.bootId, observation.bootId)) {
    tick(anchor.monotonicMs); tick(anchor.lastMonotonicMs ?? anchor.monotonicMs); assertLicenseUtcV1(anchor.trustedUtc);
    if (observation.monotonicMs < (anchor.lastMonotonicMs ?? anchor.monotonicMs) || observation.monotonicMs < anchor.monotonicMs)
      failLicenseCore("STATE", "INVALID_MONOTONIC_EVIDENCE", "Receipt precedes protected clock evidence.");
    const derived = anchor.trustedUtc + (observation.monotonicMs - anchor.monotonicMs + remainder(anchor)) / 1000n;
    assertLicenseUtcV1(derived);
    if (derived >= floor) { floor = derived; retain = true; }
  } else if (anchor) {
    tick(anchor.monotonicMs); tick(anchor.lastMonotonicMs ?? anchor.monotonicMs); assertLicenseUtcV1(anchor.trustedUtc);
    const elapsed = (anchor.lastMonotonicMs ?? anchor.monotonicMs) - anchor.monotonicMs + remainder(anchor);
    if (elapsed < 0n) failLicenseCore("STATE", "INVALID_MONOTONIC_EVIDENCE", "Invalid protected epoch.");
    if (anchor.trustedUtc + elapsed / 1000n === floor) carriedRemainder = elapsed % 1000n;
  }
  if (signedUtc > floor) { floor = signedUtc; retain = false; carriedRemainder = 0n; }
  const lastVendorUtc = anchor?.lastVendorUtc !== undefined && anchor.lastVendorUtc > signedUtc ? anchor.lastVendorUtc : signedUtc;
  return immutableDataView({ trustedUtc: floor, observedUtc: floor, anchor: {
    bootId: observation.bootId, trustedUtc: retain && anchor ? anchor.trustedUtc : floor,
    monotonicMs: retain && anchor ? anchor.monotonicMs : observation.monotonicMs,
    observedUtc: floor, observedMonotonicMs: observation.monotonicMs,
    lastMonotonicMs: observation.monotonicMs, lastVendorUtc,
    floorRemainderMs: retain && anchor ? remainder(anchor) : carriedRemainder,
  } });
}

export function licenseTimeRequestElapsedV1(
  incident: LicenseTimeIncidentV1, evidence: LicenseTimeRequestEvidenceV1 | undefined,
  observation: LicenseClockObservationV1, requestHash: Sha256, online: boolean,
): bigint {
  const code = online ? "TIME_RECOVERY_ROUND_TRIP_INVALID" : "TIME_CORRECTION_FRESHNESS_UNPROVEN";
  const reject = (): never => failLicenseCore("STATE", code, "Same-boot request freshness is unproven.");
  assertLicenseClockObservationV1(observation);
  if (!evidence) return reject();
  boot(evidence.bootId); tick(evidence.sentMonotonicMs);
  if (!bytesEqual(incident.bootId, observation.bootId) || !bytesEqual(evidence.bootId, observation.bootId) ||
      !bytesEqual(evidence.requestHash, requestHash) || evidence.sentMonotonicMs < incident.monotonicMs ||
      observation.monotonicMs < evidence.sentMonotonicMs) return reject();
  const ms = observation.monotonicMs - evidence.sentMonotonicMs;
  if (online && ms > 300000n) return reject();
  // Round up for freshness bounds; a fractional second cannot buy extra validity.
  return (ms + 999n) / 1000n;
}
