using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

// Versioned shape only. The first 41 names match V2, but no V2 receipt or
// process-local history is adopted as a V3 protected predecessor.
internal enum NativeHostStoreFileV3 {
    Profile, SourceSet, RuntimeInventory, PackageManifest, AccountOwned, AccountComplete, Plan, Approval,
    AttemptConsumed,
    ServiceSetupIntent, ServiceSetupOwned, ServiceSetupComplete,
    ServiceGuardianIntent, ServiceGuardianOwned, ServiceGuardianComplete,
    ServiceSetupStart, ServiceSetupAdmitted, SetupIntent, SetupGrantIntent, SetupGrant,
    RestrictedKeyIntent, RestrictedKeyOwned, RestrictedKeyComplete,
    AccessibleKeyIntent, AccessibleKeyOwned, AccessibleKeyComplete,
    SetupReport, SetupAck, SetupHeldExit, SetupComplete, ServiceSetupRunComplete,
    ServiceGuardianBeforeStart, ServiceGuardianBeforeAdmitted, GuardianBeforeIntent,
    GuardianBeforeGrantIntent, GuardianBeforeGrant, GuardianBeforeReport, GuardianBeforeAck,
    GuardianBeforeHeldExit, GuardianBeforeComplete, ServiceGuardianBeforeComplete,
    StandardUserIntent, StandardUserLaunchReserved, AccountActivationIntent, AccountActivated,
    StandardUserTransferIntent, StandardUserTransferLoans,
    StandardUserTransferSeed, StandardUserTransferReturned, StandardUserTransferComplete,
    StandardUserGrantIntent, StandardUserGrant, StandardUserReport, StandardUserAck,
    StandardUserHeldExit, AccountDisableIntent, AccountDisabled, StandardUserComplete,
    ServiceGuardianAfterStart, ServiceGuardianAfterAdmitted, GuardianAfterIntent,
    GuardianAfterGrantIntent, GuardianAfterGrant, GuardianAfterReport, GuardianAfterAck,
    GuardianAfterHeldExit, GuardianAfterComplete, ServiceGuardianAfterComplete,
    ControllerResult
}

internal static class NativeHostTranscriptShapeV3
{
    private static readonly NativeHostStoreFileV3[] OrderedFiles = Enum.GetValues<NativeHostStoreFileV3>();
    internal static IReadOnlyList<NativeHostStoreFileV3> Ordered => Array.AsReadOnly(OrderedFiles);
    internal static void Validate()
    {
        Need(OrderedFiles.Length == 69 && OrderedFiles.Select((x, i) => (int)x == i).All(x => x) &&
            (int)NativeHostStoreFileV3.ServiceGuardianBeforeComplete == 40 &&
            (int)NativeHostStoreFileV3.StandardUserIntent == 41 &&
            (int)NativeHostStoreFileV3.StandardUserLaunchReserved == 42 &&
            (int)NativeHostStoreFileV3.AccountActivationIntent == 43 &&
            (int)NativeHostStoreFileV3.ControllerResult == 68,
            "NATIVE_V3_TRANSCRIPT_ORDER_REFUSED");
        Need(OrderedFiles.Select(Relative).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 69,
            "NATIVE_V3_TRANSCRIPT_PATH_ALIAS_REFUSED");
    }
    private static void Need(bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    internal static string Relative(NativeHostStoreFileV3 slot)
    {
        if (slot == NativeHostStoreFileV3.StandardUserIntent)
            return NativeHostStageReservationV3.Relative(NativeHostReservationSlotV3.StandardUserIntent);
        if (slot == NativeHostStoreFileV3.StandardUserLaunchReserved)
            return NativeHostStageReservationV3.Relative(NativeHostReservationSlotV3.StandardUserLaunchReserved);
        string name = Enum.GetName(slot) ?? throw new InvalidDataException("NATIVE_V3_TRANSCRIPT_UNKNOWN_SLOT");
        // Names, not shifted numeric ordinals, bind the unchanged V2 paths.
        Need(Enum.TryParse(name, false, out NativeHostStoreFileV2 prior) &&
            Enum.GetName(prior) == name,
            "NATIVE_V3_TRANSCRIPT_PRIOR_NAME_REFUSED");
        return NativeHostStageStoreV2.Relative(prior);
    }
    internal static bool IsGenericInput(NativeHostStoreFileV3 slot)
    {
        _ = Relative(slot);
        return slot is >= NativeHostStoreFileV3.Profile and <= NativeHostStoreFileV3.Approval;
    }
    private static bool SetupKey(NativeHostStoreFileV3 slot) =>
        slot is >= NativeHostStoreFileV3.RestrictedKeyIntent and <= NativeHostStoreFileV3.AccessibleKeyComplete;
    internal static bool CanRead(NativeHostRole role, NativeHostStoreFileV3 slot)
    {
        _ = Relative(slot);
        return role switch {
            NativeHostRole.Owner => true,
            NativeHostRole.Setup => IsGenericInput(slot) || SetupKey(slot),
            NativeHostRole.User or NativeHostRole.Guardian => IsGenericInput(slot),
            _ => throw new InvalidDataException("NATIVE_V3_TRANSCRIPT_UNKNOWN_ROLE")
        };
    }
    internal static bool CanWrite(NativeHostRole role, NativeHostStoreFileV3 slot)
    {
        _ = Relative(slot);
        return role switch {
            NativeHostRole.Owner => !SetupKey(slot),
            NativeHostRole.Setup => SetupKey(slot),
            NativeHostRole.User or NativeHostRole.Guardian => false,
            _ => throw new InvalidDataException("NATIVE_V3_TRANSCRIPT_UNKNOWN_ROLE")
        };
    }
}

// Everything below is supplied by an injected backend. Even an exact match
// cannot establish actual protected file/ACL/token custody or persistence.
internal sealed record NativeHostPreactivationObservedV3(
    NativeHostStoreFileV3 Slot, string Path, byte[] Original, string Sha256,
    int Length, DateTimeOffset WrittenUtc, long CreationFileTimeUtc,
    string VolumeSerial64, string FileId128,
    string ParentPath, string ParentVolumeSerial64, string ParentFileId128,
    string LeafName, byte[] Descriptor,
    bool ParentHeld, bool RelativeOpen, bool NoReparse, bool CreateNew,
    bool ProtectedAcl, bool Flushed, bool ExactReadback);

internal interface INativeHostPreactivationBackendV3
{
    NativeHostPreactivationObservedV3? ReadExisting(NativeHostStoreFileV3 slot, string exactPath);
    bool? Exists(string exactPath);
    NativeHostPreactivationObservedV3? CreateNew(NativeHostStoreFileV3 slot,
        string exactPath, byte[] original);
}

internal interface INativeHostPreactivationGuardV3
{
    void Verify(NativeHostBoundInputV2 bound, NativeHostReservationContextV3 context,
        string point);
}

internal sealed record NativeHostPreactivationAttemptV3(
    string ActivationPath, string ActivationSha256, bool WriteEntered,
    bool ReceiptAdmitted, bool FinalReadbackAdmitted);

internal sealed class NativeHostPreactivationProposalV3
{
    private readonly byte[] original;
    internal string ActivationSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])original.Clone();
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;
    internal NativeHostPreactivationProposalV3(byte[] original)
    {
        this.original = (byte[])original.Clone();
        ActivationSha256 = NativeHostInputCodecV2.Hash(this.original);
    }
}

// A bounded stage-3 prefix model for slots 41-43 only. It does not implement
// the 0-40 V3 predecessor or slots 44-68, and never calls an account API.
internal sealed class NativeHostPreactivationV3
{
    internal const string ActivationSchema = "TEST_ONLY_STANDARD_NATIVE_HOST_ACCOUNT_ACTIVATION_INTENT_V3";
    internal const int MaximumActivationBytes = 4096;
    private const int FileAllAccess = 0x001f01ff;
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostPreactivationV3> Retained = new();
    private readonly NativeHostBoundInputV2 bound;
    private readonly NativeHostPrefixSealV3 seal;
    private readonly NativeHostReservationContextV3 context;
    private readonly INativeHostPreactivationBackendV3 backend;
    private readonly INativeHostPreactivationGuardV3 guard;
    private readonly Func<DateTimeOffset> utcNow;
    private DateTimeOffset? lastUtc;
    private int state; // 0 new, 1 active, 2 closed proposal, 3 faulted
    private NativeHostPreactivationAttemptV3? attempt;
    internal bool Faulted => Volatile.Read(ref state) == 3;
    internal bool ClosedProposalWritten => Volatile.Read(ref state) == 2;
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    internal NativeHostPreactivationV3(NativeHostBoundInputV2 bound,
        NativeHostPrefixSealV3 seal, NativeHostReservationContextV3 context,
        INativeHostPreactivationBackendV3 backend,
        INativeHostPreactivationGuardV3 guard, Func<DateTimeOffset> utcNow)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.seal = seal ?? throw new ArgumentNullException(nameof(seal));
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
        NativeHostTranscriptShapeV3.Validate();
        Need(bound.Profile is not null && bound.Plan is not null && bound.Approval is not null &&
            NativeHostProfileV2.ParseCanonical(bound.Profile.CanonicalBytes()).CanonicalSha256 ==
                bound.Profile.CanonicalSha256 &&
            NativeHostInputCodecV2.ParsePlan(bound.Plan.CanonicalBytes(), bound.Profile).CanonicalSha256 ==
                bound.Plan.CanonicalSha256 &&
            NativeHostInputCodecV2.ParseApproval(bound.Approval.CanonicalBytes(), bound.Plan).CanonicalSha256 ==
                bound.Approval.CanonicalSha256 &&
            context.HostSha256 == bound.Plan.HostSha256 &&
            context.BootSha256 == bound.Plan.BootSha256 &&
            context.OwnerSid == NativeHostProfileV2.OwnerSid &&
            context.WorkerSid == NativeHostProfileV2.OwnerSid &&
            context.OwnerProcessId != 0 && context.WorkerProcessId != 0 &&
            context.OwnerProcessId != context.WorkerProcessId &&
            seal.Attempt == bound.Profile.Attempt &&
            seal.ProfileSha256 == bound.Profile.CanonicalSha256 &&
            seal.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            seal.PlanSha256 == bound.Plan.CanonicalSha256 &&
            seal.ApprovalSha256 == bound.Approval.CanonicalSha256 &&
            seal.HostSha256 == bound.Plan.HostSha256 &&
            seal.BootSha256 == bound.Plan.BootSha256 &&
            seal.RecordRoot == bound.Profile.RecordRoot &&
            seal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            seal.TerminalPath == PathOf(NativeHostStoreFileV3.ServiceGuardianBeforeComplete) &&
            seal.StageDirectoryPath == bound.Profile.RecordRoot + @"\stage" &&
            seal.StageDirectoryVolumeSerial64 == seal.VolumeSerial64 &&
            LowerHex(seal.StageDirectoryFileId128, 32) &&
            DistinctIds(seal.AttemptRootFileId128, seal.StageDirectoryFileId128,
                seal.LastParentFileId128, seal.LastFileId128),
            "NATIVE_PREACTIVATION_BOUND_SCOPE_REFUSED");
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static bool DistinctIds(params string[] ids) =>
        new HashSet<string>(ids, StringComparer.Ordinal).Count == ids.Length;
    private string PathOf(NativeHostStoreFileV3 slot) =>
        bound.Profile.RecordRoot + @"\" + NativeHostTranscriptShapeV3.Relative(slot);
    internal string ActivationPath => PathOf(NativeHostStoreFileV3.AccountActivationIntent);
    private DateTimeOffset Time()
    {
        DateTimeOffset now = utcNow();
        Need(Volatile.Read(ref state) == 1 && now.Offset == TimeSpan.Zero &&
            now >= bound.Plan.IssuedUtc && now < bound.Plan.ExpiresUtc &&
            now >= bound.Approval.IssuedUtc && now < bound.Approval.ExpiresUtc &&
            (lastUtc is null || now >= lastUtc),
            "NATIVE_PREACTIVATION_WINDOW_REFUSED");
        lastUtc = now;
        return now;
    }
    private void Guard(string point)
    {
        _ = Time();
        guard.Verify(bound, context, point);
        _ = Time();
    }
    private static DateTimeOffset Creation(long fileTime)
    {
        try { return new DateTimeOffset(DateTime.FromFileTimeUtc(fileTime)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_PREACTIVATION_CREATION_TIME_REFUSED", e);
        }
    }
    private static void ValidateAcl(byte[] raw)
    {
        Need(raw is { Length: >= 20 and <= 65536 }, "NATIVE_PREACTIVATION_ACL_SIZE_REFUSED");
        RawSecurityDescriptor descriptor;
        try { descriptor = new RawSecurityDescriptor(raw, 0); }
        catch (Exception e) when (e is ArgumentException or IndexOutOfRangeException) {
            throw new InvalidDataException("NATIVE_PREACTIVATION_ACL_PARSE_REFUSED", e);
        }
        Need(descriptor.Owner?.Value == NativeHostProfileV2.OwnerSid &&
            descriptor.Group?.Value == NativeHostProfileV2.OwnerSid &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclPresent) &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) &&
            descriptor.SystemAcl is null && descriptor.DiscretionaryAcl is { Count: 2 },
            "NATIVE_PREACTIVATION_ACL_HEADER_REFUSED");
        var expected = new HashSet<string>(StringComparer.Ordinal) {
            NativeHostProfileV2.OwnerSid, NativeHostProfileV2.SystemSid
        };
        foreach (GenericAce ace in descriptor.DiscretionaryAcl) {
            Need(ace is CommonAce common && common.AceType == AceType.AccessAllowed &&
                common.AceFlags == AceFlags.None && common.AccessMask == FileAllAccess &&
                expected.Remove(common.SecurityIdentifier.Value),
                "NATIVE_PREACTIVATION_ACL_ACE_REFUSED");
        }
        Need(expected.Count == 0, "NATIVE_PREACTIVATION_ACL_MISSING_ACE");
    }

    private NativeHostPreactivationObservedV3 ValidateObservation(
        NativeHostPreactivationObservedV3? supplied,
        NativeHostStoreFileV3 slot, DateTimeOffset now)
    {
        Need(supplied is not null && supplied.Original is not null && supplied.Descriptor is not null,
            "NATIVE_PREACTIVATION_MISSING_OR_UNKNOWN_ORIGINAL");
        NativeHostPreactivationObservedV3 value = supplied with {
            Original = (byte[])supplied.Original.Clone(),
            Descriptor = (byte[])supplied.Descriptor.Clone()
        };
        string path = PathOf(slot);
        int slash = path.LastIndexOf('\\');
        int maximum = slot switch {
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete =>
                NativeHostPrefixSealOriginalV3.MaximumBytes,
            NativeHostStoreFileV3.StandardUserIntent => NativeHostUserIntentV3.MaximumBytes,
            NativeHostStoreFileV3.StandardUserLaunchReserved => NativeHostStageReservationV3.MaximumReservationBytes,
            NativeHostStoreFileV3.AccountActivationIntent => MaximumActivationBytes,
            _ => throw new InvalidDataException("NATIVE_PREACTIVATION_UNKNOWN_SLOT")
        };
        Need(value.Slot == slot && value.Path == path && slash > 0 &&
            value.Original.Length is > 0 && value.Original.Length <= maximum &&
            value.Length == value.Original.Length &&
            value.Sha256 == NativeHostInputCodecV2.Hash(value.Original) &&
            value.WrittenUtc.Offset == TimeSpan.Zero &&
            value.WrittenUtc >= bound.Approval.IssuedUtc && value.WrittenUtc <= now &&
            Creation(value.CreationFileTimeUtc) >= bound.Approval.IssuedUtc &&
            Creation(value.CreationFileTimeUtc) <= value.WrittenUtc &&
            LowerHex(value.VolumeSerial64, 16) && value.VolumeSerial64 != new string('0', 16) &&
            LowerHex(value.FileId128, 32) && value.FileId128 != new string('0', 32) &&
            LowerHex(value.ParentVolumeSerial64, 16) &&
            value.ParentVolumeSerial64 == value.VolumeSerial64 &&
            LowerHex(value.ParentFileId128, 32) &&
            value.ParentFileId128 != new string('0', 32) &&
            value.ParentFileId128 != value.FileId128 &&
            value.ParentPath == path[..slash] && value.LeafName == path[(slash + 1)..] &&
            value.ParentHeld && value.RelativeOpen && value.NoReparse &&
            value.CreateNew && value.ProtectedAcl && value.Flushed && value.ExactReadback,
            "NATIVE_PREACTIVATION_RECEIPT_REFUSED");
        ValidateAcl(value.Descriptor);
        return value;
    }

    private void ValidateSeal(NativeHostPreactivationObservedV3 terminal)
    {
        byte[] sealedOriginal = seal.CanonicalBytes();
        Need(terminal.Slot == seal.TerminalSlot && terminal.Path == seal.TerminalPath &&
            terminal.Original.AsSpan().SequenceEqual(sealedOriginal) &&
            terminal.Sha256 == seal.CanonicalSha256 &&
            seal.CanonicalSha256 == NativeHostInputCodecV2.Hash(sealedOriginal) &&
            terminal.VolumeSerial64 == seal.VolumeSerial64 &&
            terminal.FileId128 == seal.LastFileId128 &&
            terminal.ParentFileId128 == seal.LastParentFileId128 &&
            terminal.CreationFileTimeUtc == seal.LastCreationFileTimeUtc &&
            terminal.WrittenUtc == seal.LastWrittenUtc &&
            NativeHostInputCodecV2.Hash(terminal.Descriptor) == seal.LastDescriptorSha256 &&
            seal.OriginalWrittenUtc.Offset == TimeSpan.Zero &&
            seal.OriginalWrittenUtc <= terminal.WrittenUtc &&
            Creation(terminal.CreationFileTimeUtc) >= seal.OriginalWrittenUtc &&
            !seal.NativeEvidenceEstablished && !seal.PhysicalDurabilityProven &&
            !seal.HistoricalAuthorProven && !seal.CrossProcessCustodyProven &&
            !seal.AccountActivationAuthorized && !seal.UserCreationAuthorized &&
            !seal.GrantAuthorized && !seal.Lic008Closed,
            "NATIVE_PREACTIVATION_PREFIX_SEAL_REFUSED");
        try {
            using JsonDocument document = JsonDocument.Parse(sealedOriginal,
                new JsonDocumentOptions { MaxDepth = 4, AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object &&
                root.GetProperty("schema").GetString() == NativeHostPrefixSealOriginalV3.Schema &&
                root.GetProperty("slot").GetString() == seal.TerminalSlot.ToString() &&
                root.GetProperty("path").GetString() == seal.TerminalPath &&
                root.GetProperty("prefixCommitmentSha256").GetString() ==
                    seal.PrefixCommitmentSha256 &&
                root.GetProperty("writtenUtc").GetDateTimeOffset() == seal.OriginalWrittenUtc,
                "NATIVE_PREACTIVATION_PREFIX_ORIGINAL_REFUSED");
        } catch (Exception e) when (e is JsonException or InvalidOperationException or
            KeyNotFoundException or FormatException) {
            throw new InvalidDataException("NATIVE_PREACTIVATION_PREFIX_ORIGINAL_REFUSED", e);
        }
    }

    private static void Same(NativeHostPreactivationObservedV3 first,
        NativeHostPreactivationObservedV3 second)
    {
        Need(first.Slot == second.Slot && first.Path == second.Path &&
            first.Sha256 == second.Sha256 && first.Length == second.Length &&
            first.WrittenUtc == second.WrittenUtc &&
            first.CreationFileTimeUtc == second.CreationFileTimeUtc &&
            first.VolumeSerial64 == second.VolumeSerial64 &&
            first.FileId128 == second.FileId128 &&
            first.ParentPath == second.ParentPath &&
            first.ParentVolumeSerial64 == second.ParentVolumeSerial64 &&
            first.ParentFileId128 == second.ParentFileId128 &&
            first.LeafName == second.LeafName &&
            first.ParentHeld == second.ParentHeld &&
            first.RelativeOpen == second.RelativeOpen &&
            first.NoReparse == second.NoReparse &&
            first.CreateNew == second.CreateNew &&
            first.ProtectedAcl == second.ProtectedAcl &&
            first.Flushed == second.Flushed &&
            first.ExactReadback == second.ExactReadback &&
            first.Original.AsSpan().SequenceEqual(second.Original) &&
            first.Descriptor.AsSpan().SequenceEqual(second.Descriptor),
            "NATIVE_PREACTIVATION_FINAL_OBJECT_CHANGED");
    }

    private byte[] ActivationBytes(NativeHostUserIntentV3 intent,
        NativeHostReservationOriginalV3 reservation,
        NativeHostPreactivationObservedV3 intentFile,
        NativeHostPreactivationObservedV3 reservationFile, DateTimeOffset now)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer)) {
            w.WriteStartObject();
            w.WriteString("schema", ActivationSchema);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("effects", NativeHostProfileV2.Effects);
            w.WriteString("attempt", intent.Attempt);
            w.WriteString("slot", NativeHostStoreFileV3.AccountActivationIntent.ToString());
            w.WriteString("path", ActivationPath);
            w.WriteString("profileSha256", intent.ProfileSha256);
            w.WriteString("sourceSetSha256", intent.SourceSetSha256);
            w.WriteString("planSha256", intent.PlanSha256);
            w.WriteString("approvalSha256", intent.ApprovalSha256);
            w.WriteString("intentSha256", intent.CanonicalSha256);
            w.WriteString("reservationSha256", reservation.CanonicalSha256);
            w.WriteString("previousSha256", reservationFile.Sha256);
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
            w.WriteString("runId", intent.RunId);
            w.WriteString("nonce", intent.Nonce64);
            w.WriteString("exactCommand", reservation.ExactCommand);
            w.WriteString("intentVolumeSerial64", intentFile.VolumeSerial64);
            w.WriteString("intentFileId128", intentFile.FileId128);
            w.WriteString("reservationVolumeSerial64", reservationFile.VolumeSerial64);
            w.WriteString("reservationFileId128", reservationFile.FileId128);
            w.WriteString("reservationParentFileId128", reservationFile.ParentFileId128);
            w.WriteString("writtenUtc", now);
            w.WriteBoolean("nativeEvidenceEstablished", false);
            w.WriteBoolean("accountActivationAuthorized", false);
            w.WriteBoolean("userCreationAuthorized", false);
            w.WriteBoolean("grantAuthorized", false);
            w.WriteEndObject();
        }
        byte[] raw = buffer.ToArray();
        Need(raw.Length is > 0 and <= MaximumActivationBytes,
            "NATIVE_PREACTIVATION_ORIGINAL_SIZE_REFUSED");
        return raw;
    }

    private NativeHostPreactivationObservedV3 Read(NativeHostStoreFileV3 slot)
    {
        Guard("BEFORE_READ_" + slot);
        NativeHostPreactivationObservedV3? raw = backend.ReadExisting(slot, PathOf(slot));
        Guard("AFTER_READ_" + slot);
        return ValidateObservation(raw, slot, Time());
    }

    internal NativeHostPreactivationProposalV3 Execute()
    {
        if (Interlocked.CompareExchange(ref state, 1, 0) != 0) {
            Volatile.Write(ref state, 3);
            throw new InvalidDataException("NATIVE_PREACTIVATION_RETRY_OR_REENTRY_REFUSED");
        }
        lock (RetainedGate) Retained.Add(this);
        try {
            Guard("BEGIN");
            NativeHostPreactivationObservedV3 terminal =
                Read(NativeHostStoreFileV3.ServiceGuardianBeforeComplete);
            ValidateSeal(terminal);
            NativeHostPreactivationObservedV3 intentFile = Read(NativeHostStoreFileV3.StandardUserIntent);
            Need(intentFile.VolumeSerial64 == terminal.VolumeSerial64 &&
                intentFile.ParentVolumeSerial64 == seal.StageDirectoryVolumeSerial64 &&
                intentFile.ParentFileId128 == seal.StageDirectoryFileId128 &&
                DistinctIds(intentFile.FileId128, intentFile.ParentFileId128,
                    terminal.FileId128, terminal.ParentFileId128,
                    seal.AttemptRootFileId128) &&
                intentFile.WrittenUtc >= terminal.WrittenUtc &&
                Creation(intentFile.CreationFileTimeUtc) >= terminal.WrittenUtc,
                "NATIVE_PREACTIVATION_PREFIX_BEFORE_INTENT_REFUSED");
            NativeHostUserIntentV3 intent = NativeHostUserIntentV3.ParseOwnerOriginal(
                intentFile.Original, bound, seal, NativeHostRole.Owner);
            NativeHostPreactivationObservedV3 reservationFile =
                Read(NativeHostStoreFileV3.StandardUserLaunchReserved);
            NativeHostReservationOriginalV3 reservation = NativeHostReservationOriginalV3.ParseCanonical(
                reservationFile.Original, intentFile.Original, bound, seal, context,
                NativeHostRole.Owner, Time());
            Need(reservation.IntentSha256 == intent.CanonicalSha256 &&
                reservation.CanonicalSha256 == reservationFile.Sha256 &&
                intentFile.VolumeSerial64 == reservationFile.VolumeSerial64 &&
                reservationFile.VolumeSerial64 == terminal.VolumeSerial64 &&
                reservationFile.ParentFileId128 == terminal.ParentFileId128 &&
                DistinctIds(intentFile.FileId128, reservationFile.FileId128,
                    intentFile.ParentFileId128, reservationFile.ParentFileId128,
                    terminal.FileId128, seal.AttemptRootFileId128) &&
                intentFile.WrittenUtc <= reservation.WrittenUtc &&
                reservation.WrittenUtc <= reservationFile.WrittenUtc &&
                Creation(reservationFile.CreationFileTimeUtc) >= intentFile.WrittenUtc &&
                Creation(reservationFile.CreationFileTimeUtc) >= reservation.WrittenUtc,
                "NATIVE_PREACTIVATION_PAIR_REFUSED");
            Guard("BEFORE_ACTIVATION_PROBE");
            bool? exists = backend.Exists(ActivationPath);
            Guard("AFTER_ACTIVATION_PROBE");
            Need(exists == false, "NATIVE_PREACTIVATION_EXISTING_OR_UNKNOWN_ACTIVATION");
            DateTimeOffset activationWrittenUtc = Time();
            byte[] activation = ActivationBytes(intent, reservation, intentFile,
                reservationFile, activationWrittenUtc);
            string sha = NativeHostInputCodecV2.Hash(activation);
            attempt = new(ActivationPath, sha, false, false, false);
            Guard("IMMEDIATELY_BEFORE_ACTIVATION_CREATE");
            attempt = attempt with { WriteEntered = true };
            NativeHostPreactivationObservedV3? raw = backend.CreateNew(
                NativeHostStoreFileV3.AccountActivationIntent, ActivationPath,
                (byte[])activation.Clone());
            Guard("AFTER_ACTIVATION_CREATE");
            NativeHostPreactivationObservedV3 activationFile = ValidateObservation(raw,
                NativeHostStoreFileV3.AccountActivationIntent, Time());
            Need(activationFile.Original.AsSpan().SequenceEqual(activation) &&
                activationFile.Sha256 == sha &&
                activationFile.VolumeSerial64 == reservationFile.VolumeSerial64 &&
                DistinctIds(intentFile.FileId128, reservationFile.FileId128,
                    intentFile.ParentFileId128, reservationFile.ParentFileId128,
                    activationFile.FileId128, terminal.FileId128,
                    seal.AttemptRootFileId128) &&
                activationFile.ParentFileId128 == reservationFile.ParentFileId128 &&
                activationFile.WrittenUtc >= reservationFile.WrittenUtc &&
                Creation(activationFile.CreationFileTimeUtc) >= reservationFile.WrittenUtc &&
                Creation(activationFile.CreationFileTimeUtc) >= activationWrittenUtc,
                "NATIVE_PREACTIVATION_ACTIVATION_RECEIPT_REFUSED");
            attempt = attempt with { ReceiptAdmitted = true };
            Same(terminal, Read(NativeHostStoreFileV3.ServiceGuardianBeforeComplete));
            Same(intentFile, Read(NativeHostStoreFileV3.StandardUserIntent));
            Same(reservationFile, Read(NativeHostStoreFileV3.StandardUserLaunchReserved));
            Same(activationFile, Read(NativeHostStoreFileV3.AccountActivationIntent));
            attempt = attempt with { FinalReadbackAdmitted = true };
            Need(Interlocked.CompareExchange(ref state, 2, 1) == 1,
                "NATIVE_PREACTIVATION_REENTRY_POISONED");
            return new NativeHostPreactivationProposalV3(activation);
        } catch {
            Volatile.Write(ref state, 3);
            throw;
        }
    }

    internal NativeHostPreactivationAttemptV3? Evidence()
    {
        if (Volatile.Read(ref state) == 1) {
            Volatile.Write(ref state, 3);
            throw new InvalidDataException("NATIVE_PREACTIVATION_PENDING_EVIDENCE_REFUSED");
        }
        return attempt;
    }
}
