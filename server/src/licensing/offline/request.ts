import { bytesEqual, bytesToHex, immutableDataView, unsignedBigIntToFixedBytes, unsignedBytesToBigInt } from "../core/v1/bytes";
import { P256_HALF_ORDER_V1, P256_ORDER_V1 } from "../core/v1/cose-sign1";
import { sha256 } from "../core/v1/crypto";
import { isLicenseCoreError } from "../core/v1/errors";
import { PRODUCT_ID, SECURITY_PROFILE, signedObjectContract } from "../core/v1/protocol";
import { encodeDeterministicCborV1 as encode, type DeterministicCborValueV1 } from "../core/v1/strict-cbor";
import { assertLicenseUtcV1, assertLicenseClockObservationV1, type LicenseClockObservationV1, type LicenseTimeRequestEvidenceV1 } from "../core/v1/time";
import type { LicenseModelStateV1, LicenseStateMachineV1 } from "../core/v1/state-types";
import { createLicenseVerifierV1, type LicenseVerifierConfigurationV1 } from "../core/v1/verifier";
import { snapshotRebindDeviceV1, type OfflineRebindDeviceProviderV1 } from "./rebind-device";

/** Guardian-owned adapters only. No Vendor signer, key export, path or browser payload. */
export interface OfflineInstallationRequestAdaptersV1 {
  randomBytes(length: 16 | 32): Uint8Array;
  signInstallation(input: Readonly<{ deviceKeyId: Uint8Array; sigStructure: Uint8Array }>): Promise<Uint8Array>;
  attestTpm?(contextHash: Uint8Array): Promise<Uint8Array>;
}

export interface OfflineRequestPlanV1 {
  readonly encoded: Uint8Array;
  readonly requestId: Uint8Array;
  readonly requestNonce: Uint8Array;
  readonly requestHash: Uint8Array;
  readonly expectedStateGeneration: bigint;
  readonly expectedStateHash: Uint8Array;
  readonly timeEvidence?: LicenseTimeRequestEvidenceV1;
  readonly durable: false;
  readonly runtimeAuthority: "NONE";
}

/** Future protected transaction: compare the exact License generation/hash,
 * reserve ID AND nonce without overwriting, flush request+journal/outbox before
 * acknowledgement. EXACT_RETRY means these exact bytes, never merely same ID.
 * This interface/test doubles do not implement Windows protection or durability. */
export interface OfflineRequestRegistrationV1 {
  register(plan: OfflineRequestPlanV1): Promise<Readonly<{
    decision: "REGISTERED" | "EXACT_RETRY";
    requestId: Uint8Array;
    requestHash: Uint8Array;
  }> | undefined>;
}

type Failure = Readonly<{ ok: false; stage: string; errorCode: string; durable: false; runtimeAuthority: "NONE" }>;
class RequestError extends Error { constructor(readonly code: string) { super(code); } }
const deny = (code: string): never => { throw new RequestError(code); };
function failure(error: unknown): Failure {
  return Object.freeze({ ok: false, stage: isLicenseCoreError(error) ? error.stage : "WORKFLOW",
    errorCode: error instanceof RequestError ? error.code : isLicenseCoreError(error) ? error.code : "REQUEST_PREPARATION_FAILED",
    durable: false, runtimeAuthority: "NONE" });
}
function exactBytes(value: unknown, length: number): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== length) return deny("REQUEST_ADAPTER_BYTES_INVALID");
  return new Uint8Array(value);
}

export type OfflineRequestInputV1 = Readonly<{ issuedAt: bigint; notAfter: bigint }> & (
  | Readonly<{ purpose: "ACTIVATE" | "RENEW" | "RECOVER" | "REBIND" | "TIME_CORRECT" | "REACTIVATE" }>
  | Readonly<{ purpose: "CONTROL"; action: "SUSPEND" | "UNSUSPEND" | "REVOKE"; effectiveAt: bigint; reasonCode: bigint }>
);

/** Portable ACTIVATE/RENEW/CONTROL/RECOVER/REBIND. All identity/counters come from a factory-owned
 * state. Preparing or exporting a request never advances License authority. */
export function createOfflineRequestWorkflowV1(configuration: Readonly<{
  machine: LicenseStateMachineV1;
  verification: LicenseVerifierConfigurationV1;
  installation: OfflineInstallationRequestAdaptersV1;
  registration: OfflineRequestRegistrationV1;
  rebind?: OfflineRebindDeviceProviderV1;
  /** Trusted Guardian clock source; never browser-supplied time evidence. */
  time?: Readonly<{ observe(): LicenseClockObservationV1 }>;
}>) {
  const { machine, installation, registration } = configuration;
  const crypto = configuration.verification.crypto;
  const verifier = createLicenseVerifierV1(configuration.verification);
  const plans = new WeakSet<object>();
  const contract = signedObjectContract("activation-request");
  return Object.freeze({
    async prepare(state: LicenseModelStateV1, input: OfflineRequestInputV1): Promise<Readonly<{ ok: true; plan: OfflineRequestPlanV1 }> | Failure> {
      try {
        machine.project(state, state.clockHighWater);
        if (!input || !["ACTIVATE", "RENEW", "CONTROL", "RECOVER", "REBIND", "TIME_CORRECT", "REACTIVATE"].includes(input.purpose)) return deny("REQUEST_PURPOSE_UNSUPPORTED");
        const allowed = input.purpose === "CONTROL" ? ["purpose", "issuedAt", "notAfter", "action", "effectiveAt", "reasonCode"] : ["purpose", "issuedAt", "notAfter"];
        if (Object.keys(input).some(k => !allowed.includes(k))) return deny("REQUEST_INPUT_FIELD_FORBIDDEN");
        const { purpose, issuedAt, notAfter } = input;
        let control: { controlAction: string; controlEffectiveAt: bigint; controlReasonCode: bigint } | undefined;
        if (input.purpose === "CONTROL") {
          if (!["SUSPEND", "UNSUSPEND", "REVOKE"].includes(input.action)) return deny("CONTROL_ACTION_INVALID");
          assertLicenseUtcV1(input.effectiveAt);
          if (typeof input.reasonCode !== "bigint" || input.reasonCode < 1n || input.reasonCode > 5n) return deny("CONTROL_REASON_INVALID");
          control = { controlAction: input.action, controlEffectiveAt: input.effectiveAt, controlReasonCode: input.reasonCode };
        }
        assertLicenseUtcV1(issuedAt); assertLicenseUtcV1(notAfter);
        if (issuedAt >= notAfter || notAfter - issuedAt > 2592000n) return deny("REQUEST_VALIDITY_INVALID");
        const parent = (state.pending ?? state.current)?.entitlement.payload;
        if (purpose === "ACTIVATE" && (parent || state.entitlementGeneration !== 0n || state.tombstones.length)) return deny("ACTIVATION_REQUIRES_EMPTY_LINEAGE");
        if (purpose === "RENEW" && !parent) return deny("RENEWAL_REQUIRES_LINEAGE");
        if (purpose === "CONTROL" && !parent) return deny("CONTROL_REQUIRES_LINEAGE");
        const recoveryParent = state.current?.entitlement;
        const tombstone = parent && state.tombstones.find(t => bytesEqual(t.licenseId, parent.licenseId) && bytesEqual(t.activationId, parent.activationId));
        if (purpose === "REACTIVATE" && (!tombstone || !state.incident)) return deny("REACTIVATION_INCIDENT_REQUIRED");
        let timeObservation: LicenseClockObservationV1 | undefined;
        if (purpose === "TIME_CORRECT") {
          if (!recoveryParent || !state.timeIncident) return deny("TIME_INCIDENT_REQUIRED");
          try {
            const o = configuration.time?.observe();
            if (!o) return deny("TIME_EVIDENCE_UNAVAILABLE");
            assertLicenseClockObservationV1(o);
            timeObservation = immutableDataView({ wallUtc: o.wallUtc, bootId: o.bootId, monotonicMs: o.monotonicMs });
          } catch { return deny("TIME_EVIDENCE_UNAVAILABLE"); }
          if (!bytesEqual(timeObservation.bootId, state.timeIncident.bootId) || timeObservation.monotonicMs < state.timeIncident.monotonicMs)
            return deny("TIME_EVIDENCE_REQUIRES_FRESH_INCIDENT");
        }
        if (purpose === "RECOVER" || purpose === "REBIND") {
          if (!recoveryParent || !state.incident || (!state.tamperLatched && !state.recoveryRequired)) return deny("RECOVERY_INCIDENT_REQUIRED");
          if (state.tombstones.some(t => bytesEqual(t.licenseId, recoveryParent.payload.licenseId) &&
            bytesEqual(t.activationId, recoveryParent.payload.activationId))) return deny("REACTIVATION_REQUIRED");
        }
        if (purpose === "RENEW" && parent && state.tombstones.some(t =>
          bytesEqual(t.licenseId, parent.licenseId) && bytesEqual(t.activationId, parent.activationId))) return deny("REACTIVATION_REQUIRED");
        // Copy entropy immediately; even a provider returning a reused buffer
        // cannot alias request ID and nonce across calls or asynchronous signing.
        const id = exactBytes(installation.randomBytes(16), 16);
        const nonce = exactBytes(installation.randomBytes(32), 32);
        if (state.consumedRequests.some(r => bytesEqual(r.id, id))) return deny("REQUEST_ID_ALREADY_CONSUMED");
        const d = purpose === "REBIND" ? snapshotRebindDeviceV1(configuration.rebind, state.device, crypto) : state.device, b = state.build;
        const publicKey = exactBytes(d.devicePublicKey, 91);
        const fields: Record<string, DeterministicCborValueV1> = {
          protocolVersion: 1n, tokenType: "activation-request", requestPurpose: purpose,
          requestId: id, requestNonce: nonce, keyId: d.deviceKeyId, issuedAt, notAfter,
          productId: PRODUCT_ID, edition: b.edition, installationId: d.installationId,
          devicePublicKey: publicKey, deviceKeyId: d.deviceKeyId,
          versionIdentitySha256: b.versionIdentitySha256, buildIdentitySha256: b.buildIdentitySha256,
          buildManifestSha256: b.buildManifestSha256, stateGeneration: state.stateGeneration,
          entitlementGeneration: state.entitlementGeneration, leaseRevision: state.leaseRevision,
          controlRevision: state.control.revision, controlState: state.control.state,
          timeCorrectionRevision: state.timeCorrectionRevision, bindingKind: d.assurance,
        };
        if (purpose === "RENEW" && parent) Object.assign(fields, {
          licenseId: parent.licenseId, activationId: parent.activationId, entitlementTokenId: parent.tokenId,
        });
        if (purpose === "CONTROL" && parent && control) Object.assign(fields, {
          licenseId: parent.licenseId, activationId: parent.activationId, ...control,
        });
        if ((purpose === "RECOVER" || purpose === "REBIND") && recoveryParent && state.incident) Object.assign(fields, {
          licenseId: recoveryParent.payload.licenseId, activationId: recoveryParent.payload.activationId,
          entitlementTokenId: recoveryParent.payload.tokenId, entitlementTokenHash: recoveryParent.hash,
          // Recovery targets current authority, not a higher pending successor.
          entitlementGeneration: recoveryParent.payload.generation,
          incidentId: state.incident.id, incidentNonce: state.incident.nonce, stateHash: state.stateHash,
        });
        if (purpose === "REBIND") fields["oldDeviceKeyId"] = state.device.deviceKeyId;
        if (purpose === "REACTIVATE" && tombstone && state.incident) Object.assign(fields, {
          revokedLicenseId: tombstone.licenseId, revokedActivationId: tombstone.activationId,
          finalRevokeTokenHash: tombstone.finalRevokeTokenHash, finalControlRevision: tombstone.finalControlRevision,
          revokedLineageTombstoneId: tombstone.id, revokedLineageTombstoneHash: tombstone.hash,
          incidentId: state.incident.id, incidentNonce: state.incident.nonce,
        });
        if (purpose === "TIME_CORRECT" && recoveryParent && state.timeIncident) Object.assign(fields, {
          licenseId: recoveryParent.payload.licenseId, activationId: recoveryParent.payload.activationId,
          incidentId: state.timeIncident.id, incidentNonce: state.timeIncident.nonce,
          preIncidentClockHighWater: state.timeIncident.preIncidentClockHighWater,
        });
        if (d.assurance === "TPM_ATTESTED") {
          if (!installation.attestTpm) return deny("TPM_ATTESTATION_UNAVAILABLE");
          const contextHash = sha256(crypto, encode([SECURITY_PROFILE.tpmEvidenceContext.domain,
            id, nonce, d.installationId, d.deviceKeyId, b.versionIdentitySha256, b.buildIdentitySha256, b.buildManifestSha256]));
          let evidence: Uint8Array;
          try { evidence = await installation.attestTpm(new Uint8Array(contextHash)); }
          catch { return deny("TPM_ATTESTATION_UNAVAILABLE"); }
          if (!(evidence instanceof Uint8Array) || !evidence.length || evidence.length > 65536) return deny("TPM_EVIDENCE_SIZE_INVALID");
          fields["tpmEvidence"] = new Map<string, DeterministicCborValueV1>([
            ["schemaVersion", 1n], ["format", "WINDOWS_CNG_TPM_KEY_ATTESTATION_V1"],
            ["contextHash", contextHash], ["evidence", new Uint8Array(evidence)],
          ]);
        }
        const payload = encode(new Map(Object.entries(fields)));
        const headers = encode(new Map<DeterministicCborValueV1, DeterministicCborValueV1>([
          [1n, -7n], [3n, contract.mediaType], [4n, d.deviceKeyId],
        ]));
        const structure = encode(["Signature1", headers, new Uint8Array(), payload]);
        let signature: Uint8Array;
        try { signature = exactBytes(await installation.signInstallation({ deviceKeyId: new Uint8Array(d.deviceKeyId), sigStructure: new Uint8Array(structure) }), 64); }
        catch { return deny("INSTALLATION_SIGNING_FAILED"); }
        const r = unsignedBytesToBigInt(signature.subarray(0, 32)), s = unsignedBytesToBigInt(signature.subarray(32));
        if (r === 0n || r >= P256_ORDER_V1 || s === 0n || s >= P256_ORDER_V1) return deny("INSTALLATION_SIGNATURE_INVALID");
        if (s > P256_HALF_ORDER_V1) signature.set(unsignedBigIntToFixedBytes(P256_ORDER_V1 - s, 32), 32);
        const encoded = encode({ kind: "tag", tag: 18n, value: [headers, new Map(), payload, signature] });
        const checked = verifier.verifySignedObject({ expectedType: "activation-request", encoded,
          context: { workflow: "ECSREQ_FILE", build: b, device: d, ...(purpose === "REBIND" ? { previousDevice: state.device } : {}) } });
        if (!checked.ok) return Object.freeze({ ok: false, stage: checked.stage, errorCode: checked.errorCode, durable: false, runtimeAuthority: "NONE" });
        const plan: OfflineRequestPlanV1 = immutableDataView({ encoded, requestId: id, requestNonce: nonce,
          requestHash: checked.digests.inputSha256, expectedStateGeneration: state.stateGeneration,
          expectedStateHash: state.stateHash, ...(timeObservation ? { timeEvidence: {
            bootId: timeObservation.bootId, sentMonotonicMs: timeObservation.monotonicMs, requestHash: checked.digests.inputSha256,
          } } : {}), durable: false, runtimeAuthority: "NONE" });
        plans.add(plan);
        return Object.freeze({ ok: true, plan });
      } catch (error) { return failure(error); }
    },
    async export(plan: OfflineRequestPlanV1): Promise<Readonly<{
      ok: true; filename: string; mediaType: string; bytes: Uint8Array;
      decision: "REGISTERED" | "EXACT_RETRY"; durable: false; runtimeAuthority: "NONE";
    }> | Failure> {
      try {
        if (!plans.has(plan)) return deny("UNTRUSTED_REQUEST_PLAN");
        let receipt: Awaited<ReturnType<OfflineRequestRegistrationV1["register"]>>;
        try { receipt = await registration.register(plan); }
        catch { return deny("REQUEST_REGISTRATION_UNAVAILABLE"); }
        if (!receipt) return deny("REQUEST_REGISTRATION_CONFLICT");
        if (!["REGISTERED", "EXACT_RETRY"].includes(receipt.decision) ||
          !bytesEqual(exactBytes(receipt.requestId, 16), plan.requestId) ||
          !bytesEqual(exactBytes(receipt.requestHash, 32), plan.requestHash)) return deny("REQUEST_REGISTRATION_RECEIPT_INVALID");
        return immutableDataView({ ok: true, filename: `Entry-Control-${bytesToHex(plan.requestId)}.ecsreq`,
          mediaType: contract.mediaType, bytes: plan.encoded, decision: receipt.decision,
          durable: false, runtimeAuthority: "NONE" });
      } catch (error) { return failure(error); }
    },
  });
}
