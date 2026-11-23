using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

// A separate, closed V3 proposal. Its typed intent links the inert slot-40
// seal into slots 41-42. Neither this class nor its injected backend proves
// native identity, durable storage, account activation or process creation.
internal enum NativeHostReservationSlotV3 { StandardUserIntent, StandardUserLaunchReserved }

// The worker is an already-existing Owner-side controller, never the User child
// whose PID and creation time cannot be known before launch reservation.
internal sealed record NativeHostReservationContextV3(
    string HostSha256, string BootSha256, string OwnerSid,
    uint OwnerProcessId, long OwnerCreationFileTimeUtc, string OwnerPrimaryTokenId,
    string WorkerSid, uint WorkerProcessId, long WorkerCreationFileTimeUtc,
    string WorkerPrimaryTokenId);

internal sealed record NativeHostReservationReceiptV3(
    NativeHostReservationSlotV3 Slot, string Path, string Sha256, int Length,
    DateTimeOffset WrittenUtc, long CreationFileTimeUtc,
    string VolumeSerial64, string FileId128,
    string ParentPath, string ParentVolumeSerial64, string ParentFileId128,
    string LeafName, bool ParentHeld, bool RelativeOpen, bool NoReparse,
    bool CreateNew, bool ProtectedAcl, bool Flushed, bool ExactReadback);

internal sealed record NativeHostReservationAttemptV3(
    NativeHostReservationSlotV3 Slot, string Path, string Sha256,
    bool WriteEntered, bool ReceiptAdmitted, bool ReadbackAdmitted);

internal interface INativeHostReservationSinkV3
{
    // null means unknown and must strand this attempt. A present result is
    // always refused; this model cannot adopt a prior process's history.
    bool? Exists(string exactPath);
    NativeHostReservationReceiptV3 CreateNew(NativeHostReservationSlotV3 slot,
        string exactPath, byte[] original);
    byte[] ReadOriginal(string exactPath);
}

internal interface INativeHostReservationGuardV3
{
    // Injected callback only. A real adapter must independently establish the
    // current Owner token, held worker and protected path custody.
    void Verify(NativeHostReservationContextV3 context, string point);
}

internal sealed class NativeHostStageReservationV3
{
    internal const string ReservationSchema = "TEST_ONLY_STANDARD_NATIVE_HOST_USER_LAUNCH_RESERVED_V3";
    internal const int MaximumReservationBytes = 4096;
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostStageReservationV3> Retained = new();
    private readonly NativeHostBoundInputV2 bound;
    private readonly NativeHostPrefixSealV3 seal;
    private readonly NativeHostReservationContextV3 context;
    private readonly INativeHostReservationSinkV3 sink;
    private readonly INativeHostReservationGuardV3 guard;
    private readonly Func<DateTimeOffset> nowUtc;
    private readonly Dictionary<NativeHostReservationSlotV3, NativeHostReservationAttemptV3> attempts = new();
    private byte[]? intentOriginal;
    private byte[]? reservationOriginal;
    private NativeHostReservationReceiptV3? intentReceipt;
    private DateTimeOffset? lastUtc;
    private int operation;
    private int faulted;

    internal bool Faulted => Volatile.Read(ref faulted) != 0;
    internal bool ClosedReservationComplete => reservationOriginal is not null && !Faulted;
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    internal NativeHostStageReservationV3(NativeHostBoundInputV2 bound,
        NativeHostPrefixSealV3 seal, NativeHostReservationContextV3 context,
        INativeHostReservationSinkV3 sink,
        INativeHostReservationGuardV3 guard, Func<DateTimeOffset> nowUtc)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.seal = seal ?? throw new ArgumentNullException(nameof(seal));
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.sink = sink ?? throw new ArgumentNullException(nameof(sink));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.nowUtc = nowUtc ?? throw new ArgumentNullException(nameof(nowUtc));
        Need(bound.Profile is not null && bound.Plan is not null && bound.Approval is not null &&
            NativeHostProfileV2.ParseCanonical(bound.Profile.CanonicalBytes()).CanonicalSha256 ==
                bound.Profile.CanonicalSha256 &&
            NativeHostInputCodecV2.ParsePlan(bound.Plan.CanonicalBytes(), bound.Profile).CanonicalSha256 ==
                bound.Plan.CanonicalSha256 &&
            NativeHostInputCodecV2.ParseApproval(bound.Approval.CanonicalBytes(), bound.Plan).CanonicalSha256 ==
                bound.Approval.CanonicalSha256 &&
            bound.Plan.Attempt == bound.Profile.Attempt &&
            bound.Plan.ProfileSha256 == bound.Profile.CanonicalSha256 &&
            bound.Plan.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            bound.Approval.PlanSha256 == bound.Plan.CanonicalSha256 &&
            seal.Attempt == bound.Profile.Attempt &&
            seal.ProfileSha256 == bound.Profile.CanonicalSha256 &&
            seal.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            seal.PlanSha256 == bound.Plan.CanonicalSha256 &&
            seal.ApprovalSha256 == bound.Approval.CanonicalSha256 &&
            seal.HostSha256 == bound.Plan.HostSha256 &&
            seal.BootSha256 == bound.Plan.BootSha256 &&
            seal.RecordRoot == bound.Profile.RecordRoot &&
            seal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            seal.TerminalPath == bound.Profile.RecordRoot + @"\" +
                NativeHostTranscriptShapeV3.Relative(
                    NativeHostStoreFileV3.ServiceGuardianBeforeComplete) &&
            seal.StageDirectoryPath == bound.Profile.RecordRoot + @"\stage" &&
            seal.StageDirectoryVolumeSerial64 == seal.VolumeSerial64 &&
            LowerHex(seal.StageDirectoryFileId128, 32) &&
            seal.StageDirectoryFileId128 != seal.AttemptRootFileId128 &&
            seal.StageDirectoryFileId128 != seal.LastParentFileId128 &&
            seal.StageDirectoryFileId128 != seal.LastFileId128 &&
            seal.CanonicalSha256 == Hash(seal.CanonicalBytes()) &&
            LowerHex(seal.PrefixCommitmentSha256, 64) &&
            !seal.NativeEvidenceEstablished &&
            !seal.PhysicalDurabilityProven &&
            !seal.AccountActivationAuthorized &&
            !seal.UserCreationAuthorized &&
            !seal.GrantAuthorized && !seal.Lic008Closed &&
            context.HostSha256 == bound.Plan.HostSha256 &&
            context.BootSha256 == bound.Plan.BootSha256 &&
            context.OwnerSid == NativeHostProfileV2.OwnerSid &&
            context.WorkerSid == NativeHostProfileV2.OwnerSid &&
            context.OwnerProcessId != 0 && context.WorkerProcessId != 0 &&
            context.OwnerProcessId != context.WorkerProcessId &&
            context.OwnerCreationFileTimeUtc > 0 &&
            context.WorkerCreationFileTimeUtc > 0 &&
            LowerHex(context.OwnerPrimaryTokenId, 16) &&
            LowerHex(context.WorkerPrimaryTokenId, 16),
            "NATIVE_RESERVATION_SCOPE_REFUSED");
        DateTimeOffset observed = nowUtc();
        try {
            Need(observed.Offset == TimeSpan.Zero &&
                observed >= seal.LastWrittenUtc &&
                observed < bound.Approval.ExpiresUtc &&
                DateTime.FromFileTimeUtc(context.OwnerCreationFileTimeUtc) <= observed.UtcDateTime &&
                DateTime.FromFileTimeUtc(context.WorkerCreationFileTimeUtc) <= observed.UtcDateTime,
                "NATIVE_RESERVATION_CONTEXT_TIME_REFUSED");
        } catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_RESERVATION_CONTEXT_TIME_REFUSED", e);
        }
        lastUtc = observed;
    }

    internal string PathOf(NativeHostReservationSlotV3 slot) =>
        bound.Profile.RecordRoot + @"\" + Relative(slot);

    internal static string Relative(NativeHostReservationSlotV3 slot) => slot switch {
        NativeHostReservationSlotV3.StandardUserIntent => @"stage\standard-user-intent-v3.json",
        NativeHostReservationSlotV3.StandardUserLaunchReserved =>
            @"journal\standard-user-launch-reserved-v3.json",
        _ => throw new InvalidDataException("NATIVE_RESERVATION_UNKNOWN_SLOT")
    };

    internal static bool CanRead(NativeHostRole role, NativeHostReservationSlotV3 slot)
    {
        _ = Relative(slot);
        return role switch {
            NativeHostRole.Owner => true,
            NativeHostRole.User or NativeHostRole.Guardian or NativeHostRole.Setup => false,
            _ => throw new InvalidDataException("NATIVE_RESERVATION_UNKNOWN_ROLE")
        };
    }

    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    private static void Need([DoesNotReturnIf(false)] bool okay, string code) {
        if (!okay) throw new InvalidDataException(code);
    }

    private void Enter()
    {
        if (Interlocked.CompareExchange(ref operation, 1, 0) != 0) {
            Volatile.Write(ref faulted, 1);
            throw new InvalidDataException("NATIVE_RESERVATION_REENTRY_REFUSED");
        }
        if (Faulted) {
            Volatile.Write(ref operation, 0);
            throw new InvalidDataException("NATIVE_RESERVATION_CONSUMED");
        }
    }

    private DateTimeOffset Time()
    {
        DateTimeOffset now = nowUtc();
        Need(now.Offset == TimeSpan.Zero &&
            now >= bound.Plan.IssuedUtc && now < bound.Plan.ExpiresUtc &&
            now >= bound.Approval.IssuedUtc && now < bound.Approval.ExpiresUtc &&
            (lastUtc is null || now >= lastUtc), "NATIVE_RESERVATION_WINDOW_REFUSED");
        lastUtc = now;
        return now;
    }

    private void Guard(string point)
    {
        _ = Time();
        guard.Verify(context, point);
        Need(!Faulted, "NATIVE_RESERVATION_REENTRY_POISONED");
        _ = Time();
    }

    private void RequireAbsent(NativeHostReservationSlotV3 slot)
    {
        Guard("BEFORE_PROBE_" + slot);
        bool? exists = sink.Exists(PathOf(slot));
        Guard("AFTER_PROBE_" + slot);
        Need(exists == false, "NATIVE_RESERVATION_EXISTING_OR_UNKNOWN_HISTORY");
    }

    private NativeHostReservationReceiptV3 WriteAndRead(
        NativeHostReservationSlotV3 slot, byte[] raw)
    {
        string path = PathOf(slot);
        string sha = Hash(raw);
        DateTimeOffset recorded = Time();
        attempts.Add(slot, new(slot, path, sha, false, false, false));
        lock (RetainedGate) Retained.Add(this);
        Guard("IMMEDIATELY_BEFORE_CREATE_NEW_" + slot);
        attempts[slot] = attempts[slot] with { WriteEntered = true };
        NativeHostReservationReceiptV3? receipt = sink.CreateNew(slot, path, (byte[])raw.Clone());
        Guard("AFTER_CREATE_NEW_" + slot);
        Need(receipt is not null, "NATIVE_RESERVATION_UNKNOWN_RECEIPT");
        DateTimeOffset observed = Time();
        DateTimeOffset created;
        try { created = new DateTimeOffset(DateTime.FromFileTimeUtc(receipt.CreationFileTimeUtc)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_RESERVATION_CREATION_TIME_REFUSED", e);
        }
        Need(receipt.Slot == slot && receipt.Path == path &&
            receipt.Sha256 == sha && receipt.Length == raw.Length &&
            receipt.WrittenUtc.Offset == TimeSpan.Zero &&
            receipt.WrittenUtc >= recorded && receipt.WrittenUtc <= observed &&
            created >= recorded && created <= receipt.WrittenUtc &&
            LowerHex(receipt.VolumeSerial64, 16) &&
            LowerHex(receipt.FileId128, 32) &&
            LowerHex(receipt.ParentVolumeSerial64, 16) &&
            LowerHex(receipt.ParentFileId128, 32) &&
            receipt.VolumeSerial64 != new string('0', 16) &&
            receipt.FileId128 != new string('0', 32) &&
            receipt.ParentVolumeSerial64 != new string('0', 16) &&
            receipt.ParentFileId128 != new string('0', 32) &&
            receipt.VolumeSerial64 == receipt.ParentVolumeSerial64 &&
            receipt.FileId128 != receipt.ParentFileId128 &&
            receipt.ParentPath == path[..path.LastIndexOf('\\')] &&
            receipt.LeafName == path[(path.LastIndexOf('\\') + 1)..] &&
            receipt.ParentHeld && receipt.RelativeOpen && receipt.NoReparse &&
            receipt.CreateNew && receipt.ProtectedAcl && receipt.Flushed &&
            receipt.ExactReadback &&
            receipt.VolumeSerial64 == seal.VolumeSerial64 &&
            receipt.FileId128 != seal.LastFileId128 &&
            receipt.FileId128 != seal.LastParentFileId128 &&
            receipt.FileId128 != seal.AttemptRootFileId128 &&
            receipt.ParentFileId128 != seal.LastFileId128 &&
            receipt.ParentFileId128 != seal.AttemptRootFileId128 &&
            created >= seal.LastWrittenUtc &&
            (slot == NativeHostReservationSlotV3.StandardUserIntent ?
                receipt.ParentFileId128 == seal.StageDirectoryFileId128 :
                receipt.ParentFileId128 == seal.LastParentFileId128) &&
            (intentReceipt is null || (receipt.VolumeSerial64 == intentReceipt.VolumeSerial64 &&
                receipt.FileId128 != intentReceipt.FileId128 &&
                receipt.FileId128 != intentReceipt.ParentFileId128 &&
                receipt.ParentFileId128 != intentReceipt.FileId128 &&
                created >= intentReceipt.WrittenUtc)),
            "NATIVE_RESERVATION_RECEIPT_REFUSED");
        attempts[slot] = attempts[slot] with { ReceiptAdmitted = true };
        Guard("BEFORE_READBACK_" + slot);
        byte[] readback = sink.ReadOriginal(path);
        Guard("AFTER_READBACK_" + slot);
        Need(readback is not null && readback.AsSpan().SequenceEqual(raw),
            "NATIVE_RESERVATION_READBACK_REFUSED");
        attempts[slot] = attempts[slot] with { ReadbackAdmitted = true };
        return receipt;
    }

    internal string WriteOwnerIntent(NativeHostRole role, byte[]? suppliedOriginal)
    {
        Enter();
        try {
            Need(role == NativeHostRole.Owner && intentOriginal is null &&
                reservationOriginal is null, "NATIVE_RESERVATION_INTENT_ORDER_OR_ROLE_REFUSED");
            Guard("BEFORE_INTENT_PARSE");
            NativeHostUserIntentV3 intent = NativeHostUserIntentV3.ParseOwnerOriginal(
                suppliedOriginal, bound, seal, role);
            Need(intent.HostSha256 == context.HostSha256 &&
                intent.BootSha256 == context.BootSha256 &&
                intent.PreviousSha256 == seal.CanonicalSha256 &&
                Time() >= seal.LastWrittenUtc,
                "NATIVE_RESERVATION_INTENT_CONTEXT_REFUSED");
            RequireAbsent(NativeHostReservationSlotV3.StandardUserIntent);
            RequireAbsent(NativeHostReservationSlotV3.StandardUserLaunchReserved);
            byte[] raw = intent.CanonicalBytes();
            intentReceipt = WriteAndRead(NativeHostReservationSlotV3.StandardUserIntent, raw);
            intentOriginal = raw;
            return intent.CanonicalSha256;
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally { Volatile.Write(ref operation, 0); }
    }

    internal static string UserCommand(NativeHostUserIntentV3 intent) =>
        NativeHostProfileV2.Image + " --user --attempt " + intent.Attempt +
        " --plan-sha256 " + intent.PlanSha256 +
        " --approval-sha256 " + intent.ApprovalSha256 +
        " --source-set-sha256 " + intent.SourceSetSha256 +
        " --run-id " + intent.RunId + " --nonce " + intent.Nonce64;

    private byte[] ReservationBytes(NativeHostUserIntentV3 intent,
        string command, DateTimeOffset written)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer)) {
            w.WriteStartObject();
            w.WriteString("schema", ReservationSchema);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("effects", NativeHostProfileV2.Effects);
            w.WriteString("attempt", intent.Attempt);
            w.WriteString("profileSha256", intent.ProfileSha256);
            w.WriteString("sourceSetSha256", intent.SourceSetSha256);
            w.WriteString("planSha256", intent.PlanSha256);
            w.WriteString("approvalSha256", intent.ApprovalSha256);
            w.WriteString("intentSha256", intent.CanonicalSha256);
            w.WriteString("previousSha256", intentReceipt!.Sha256);
            w.WriteString("hostSha256", context.HostSha256);
            w.WriteString("bootSha256", context.BootSha256);
            w.WriteString("ownerSid", context.OwnerSid);
            w.WriteNumber("ownerProcessId", context.OwnerProcessId);
            w.WriteNumber("ownerCreationFileTimeUtc", context.OwnerCreationFileTimeUtc);
            w.WriteString("ownerPrimaryTokenId", context.OwnerPrimaryTokenId);
            w.WriteString("workerSid", context.WorkerSid);
            w.WriteNumber("workerProcessId", context.WorkerProcessId);
            w.WriteNumber("workerCreationFileTimeUtc", context.WorkerCreationFileTimeUtc);
            w.WriteString("workerPrimaryTokenId", context.WorkerPrimaryTokenId);
            w.WriteString("userSid", intent.UserSid);
            w.WriteString("userImage", NativeHostProfileV2.Image);
            w.WriteString("userImageSha256", intent.ImageSha256);
            w.WriteNumber("stage", (int)intent.Stage);
            w.WriteString("runId", intent.RunId);
            w.WriteString("nonce", intent.Nonce64);
            w.WriteString("exactCommand", command);
            w.WriteString("writtenUtc", written);
            w.WriteBoolean("nativeEvidenceEstablished", false);
            w.WriteBoolean("accountActivationAuthorized", false);
            w.WriteBoolean("userCreationAuthorized", false);
            w.WriteBoolean("grantAuthorized", false);
            w.WriteEndObject();
        }
        byte[] raw = buffer.ToArray();
        Need(raw.Length is > 0 and <= MaximumReservationBytes,
            "NATIVE_RESERVATION_ORIGINAL_SIZE_REFUSED");
        return raw;
    }

    internal string WriteLaunchReservation(NativeHostRole role,
        string expectedIntentSha256, string exactCommand)
    {
        Enter();
        try {
            Need(role == NativeHostRole.Owner && intentOriginal is not null &&
                intentReceipt is not null && reservationOriginal is null,
                "NATIVE_RESERVATION_ORDER_OR_ROLE_REFUSED");
            Guard("BEFORE_INTENT_REREAD");
            byte[] observedIntent = sink.ReadOriginal(PathOf(NativeHostReservationSlotV3.StandardUserIntent));
            Guard("AFTER_INTENT_REREAD");
            Need(observedIntent is not null &&
                observedIntent.AsSpan().SequenceEqual(intentOriginal),
                "NATIVE_RESERVATION_INTENT_CHANGED");
            NativeHostUserIntentV3 intent = NativeHostUserIntentV3.ParseOwnerOriginal(
                observedIntent, bound, seal, role);
            Need(expectedIntentSha256 == intent.CanonicalSha256 &&
                intentReceipt.Sha256 == intent.CanonicalSha256 &&
                exactCommand == UserCommand(intent) &&
                Time() >= intentReceipt.WrittenUtc,
                "NATIVE_RESERVATION_BINDING_REFUSED");
            RequireAbsent(NativeHostReservationSlotV3.StandardUserLaunchReserved);
            byte[] raw = ReservationBytes(intent, exactCommand, Time());
            _ = WriteAndRead(NativeHostReservationSlotV3.StandardUserLaunchReserved, raw);
            Guard("BEFORE_FINAL_INTENT_READ");
            byte[] finalIntent = sink.ReadOriginal(PathOf(NativeHostReservationSlotV3.StandardUserIntent));
            Guard("AFTER_FINAL_INTENT_READ");
            Need(finalIntent is not null && finalIntent.AsSpan().SequenceEqual(intentOriginal),
                "NATIVE_RESERVATION_FINAL_INTENT_CHANGED");
            Guard("BEFORE_FINAL_RESERVATION_READ");
            byte[] finalReservation = sink.ReadOriginal(
                PathOf(NativeHostReservationSlotV3.StandardUserLaunchReserved));
            Guard("AFTER_FINAL_RESERVATION_READ");
            Need(finalReservation is not null && finalReservation.AsSpan().SequenceEqual(raw),
                "NATIVE_RESERVATION_FINAL_RECORD_CHANGED");
            reservationOriginal = raw;
            return Hash(raw);
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally { Volatile.Write(ref operation, 0); }
    }

    internal byte[] ReadOwnerOriginal(NativeHostRole role, NativeHostReservationSlotV3 slot)
    {
        Enter();
        try {
            Need(CanRead(role, slot), "NATIVE_RESERVATION_READ_ROLE_REFUSED");
            byte[]? expected = slot switch {
                NativeHostReservationSlotV3.StandardUserIntent => intentOriginal,
                NativeHostReservationSlotV3.StandardUserLaunchReserved => reservationOriginal,
                _ => null
            };
            Need(expected is not null, "NATIVE_RESERVATION_READ_INCOMPLETE_REFUSED");
            Guard("BEFORE_COMPLETED_READ");
            byte[] observed = sink.ReadOriginal(PathOf(slot));
            Guard("AFTER_COMPLETED_READ");
            Need(observed is not null && observed.AsSpan().SequenceEqual(expected),
                "NATIVE_RESERVATION_COMPLETED_CHANGED");
            return (byte[])observed.Clone();
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally { Volatile.Write(ref operation, 0); }
    }

    internal NativeHostReservationAttemptV3[] Evidence()
    {
        if (Interlocked.CompareExchange(ref operation, 1, 0) != 0) {
            Volatile.Write(ref faulted, 1);
            throw new InvalidDataException("NATIVE_RESERVATION_PENDING_EVIDENCE_REFUSED");
        }
        try { return attempts.Values.OrderBy(x => x.Slot).ToArray(); }
        finally { Volatile.Write(ref operation, 0); }
    }
}
