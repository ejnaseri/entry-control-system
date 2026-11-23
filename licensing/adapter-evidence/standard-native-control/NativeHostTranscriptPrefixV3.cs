using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

internal sealed record NativeHostPrefixDirectoryV3(
    string Path, string ParentPath, string LeafName,
    string VolumeSerial64, string FileId128,
    string ParentVolumeSerial64, string ParentFileId128,
    long CreationFileTimeUtc, byte[] Descriptor,
    bool Directory, bool ParentHeld, bool RelativeOpen,
    bool NoReparse, bool ProtectedAcl);

internal sealed record NativeHostPrefixAclPinV3(string Path, string DescriptorSha256);

internal interface INativeHostTranscriptPrefixBackendV3
{
    // Injected observations only. A future native backend must root real
    // handles and independently prove every relative open and author action.
    NativeHostPrefixDirectoryV3? ReadDirectory(string exactPath);
    NativeHostPreactivationObservedV3? ReadOriginal(
        NativeHostStoreFileV3 slot, string exactPath);
}

internal interface INativeHostTranscriptPrefixGuardV3
{
    void Verify(NativeHostBoundInputV2 bound, string point);
}

// A typed handoff for closed models only. Its internal constructor and all
// backing observations are injectable, so possession proves no native fact.
internal sealed class NativeHostPrefixSealV3
{
    private readonly byte[] original;
    internal string Attempt { get; }
    internal string ProfileSha256 { get; }
    internal string SourceSetSha256 { get; }
    internal string PlanSha256 { get; }
    internal string ApprovalSha256 { get; }
    internal string HostSha256 { get; }
    internal string BootSha256 { get; }
    internal string RecordRoot { get; }
    internal NativeHostStoreFileV3 TerminalSlot =>
        NativeHostStoreFileV3.ServiceGuardianBeforeComplete;
    internal string TerminalPath { get; }
    internal string CanonicalSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])original.Clone();
    internal string PrefixCommitmentSha256 { get; }
    internal string LastFileId128 { get; }
    internal string LastParentFileId128 { get; }
    internal string VolumeSerial64 { get; }
    internal string AttemptRootFileId128 { get; }
    internal string StageDirectoryPath { get; }
    internal string StageDirectoryVolumeSerial64 { get; }
    internal string StageDirectoryFileId128 { get; }
    internal DateTimeOffset LastWrittenUtc { get; }
    internal DateTimeOffset OriginalWrittenUtc { get; }
    internal long LastCreationFileTimeUtc { get; }
    internal string LastDescriptorSha256 { get; }
    internal string SetupRunId { get; }
    internal string SetupNonce64 { get; }
    internal string GuardianBeforeRunId { get; }
    internal string GuardianBeforeNonce64 { get; }
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool HistoricalAuthorProven => false;
    internal bool CrossProcessCustodyProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    internal NativeHostPrefixSealV3(NativeHostBoundInputV2 bound,
        NativeHostPreactivationObservedV3 terminal, byte[] exactOriginal,
        string commitment, DateTimeOffset originalWritten,
        string rootId, string setupRun, string setupNonce,
        string guardianRun, string guardianNonce,
        string stageDirectoryPath, string stageDirectoryVolumeSerial64,
        string stageDirectoryFileId128)
    {
        if (stageDirectoryPath != bound.Profile.RecordRoot + @"\stage" ||
            stageDirectoryVolumeSerial64 is null ||
            stageDirectoryVolumeSerial64.Length != 16 ||
            !stageDirectoryVolumeSerial64.All(c =>
                c is >= '0' and <= '9' or >= 'a' and <= 'f') ||
            stageDirectoryVolumeSerial64 == new string('0', 16) ||
            stageDirectoryVolumeSerial64 != terminal.VolumeSerial64 ||
            stageDirectoryFileId128 is null ||
            stageDirectoryFileId128.Length != 32 ||
            !stageDirectoryFileId128.All(c =>
                c is >= '0' and <= '9' or >= 'a' and <= 'f') ||
            stageDirectoryFileId128 == new string('0', 32) ||
            stageDirectoryFileId128 == rootId ||
            stageDirectoryFileId128 == terminal.ParentFileId128 ||
            stageDirectoryFileId128 == terminal.FileId128)
            throw new InvalidDataException("NATIVE_PREFIX_STAGE_WITNESS_REFUSED");
        original = (byte[])exactOriginal.Clone();
        Attempt = bound.Profile.Attempt;
        ProfileSha256 = bound.Profile.CanonicalSha256;
        SourceSetSha256 = bound.Profile.SourceSetSha256;
        PlanSha256 = bound.Plan.CanonicalSha256;
        ApprovalSha256 = bound.Approval.CanonicalSha256;
        HostSha256 = bound.Plan.HostSha256;
        BootSha256 = bound.Plan.BootSha256;
        RecordRoot = bound.Profile.RecordRoot;
        TerminalPath = terminal.Path;
        CanonicalSha256 = NativeHostInputCodecV2.Hash(original);
        PrefixCommitmentSha256 = commitment;
        LastFileId128 = terminal.FileId128;
        LastParentFileId128 = terminal.ParentFileId128;
        VolumeSerial64 = terminal.VolumeSerial64;
        AttemptRootFileId128 = rootId;
        StageDirectoryPath = stageDirectoryPath;
        StageDirectoryVolumeSerial64 = stageDirectoryVolumeSerial64;
        StageDirectoryFileId128 = stageDirectoryFileId128;
        LastWrittenUtc = terminal.WrittenUtc;
        OriginalWrittenUtc = originalWritten;
        LastCreationFileTimeUtc = terminal.CreationFileTimeUtc;
        LastDescriptorSha256 = NativeHostInputCodecV2.Hash(terminal.Descriptor);
        SetupRunId = setupRun;
        SetupNonce64 = setupNonce;
        GuardianBeforeRunId = guardianRun;
        GuardianBeforeNonce64 = guardianNonce;
    }
}

// A new canonical event version. The evidence digest remains an untrusted
// statement; no event proves a service, key, grant, report or held exit.
internal sealed record NativeHostPrefixEventV3(
    NativeHostStoreFileV3 Slot, string RunId, string Nonce64,
    string EvidenceSha256, DateTimeOffset WrittenUtc);

internal static class NativeHostPrefixEventCodecV3
{
    internal const string Schema = "TEST_ONLY_STANDARD_NATIVE_HOST_STAGE_RECORD_V3";
    internal const int MaximumBytes = 8192;

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) =>
        value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    internal static NativeHostRole Writer(NativeHostStoreFileV3 slot)
    {
        Need(slot is >= NativeHostStoreFileV3.AttemptConsumed and <=
            NativeHostStoreFileV3.GuardianBeforeComplete,
            "NATIVE_PREFIX_EVENT_SLOT_REFUSED");
        return slot is >= NativeHostStoreFileV3.RestrictedKeyIntent and <=
            NativeHostStoreFileV3.AccessibleKeyComplete ? NativeHostRole.Setup : NativeHostRole.Owner;
    }

    internal static int Stage(NativeHostStoreFileV3 slot)
    {
        _ = Writer(slot);
        if (slot <= NativeHostStoreFileV3.ServiceGuardianComplete) return 0;
        if (slot <= NativeHostStoreFileV3.ServiceSetupRunComplete) return 1;
        return 2;
    }

    internal static byte[] Encode(NativeHostBoundInputV2 bound,
        NativeHostStoreFileV3 slot, string previousSha256, string runId,
        string nonce64, string evidenceSha256, DateTimeOffset writtenUtc)
    {
        NativeHostRole writer = Writer(slot);
        int stage = Stage(slot);
        Need(LowerHex(previousSha256, 64) && LowerHex(evidenceSha256, 64) &&
            writtenUtc.Offset == TimeSpan.Zero &&
            (stage == 0 ? runId.Length == 0 && nonce64.Length == 0 :
                LowerHex(runId, 32) && LowerHex(nonce64, 64)),
            "NATIVE_PREFIX_EVENT_FIELDS_REFUSED");
        string path = bound.Profile.RecordRoot + @"\" +
            NativeHostTranscriptShapeV3.Relative(slot);
        using var buffer = new MemoryStream();
        using (var json = new Utf8JsonWriter(buffer)) {
            json.WriteStartObject();
            json.WriteString("schema", Schema);
            json.WriteString("profileId", NativeHostProfileV2.ProfileId);
            json.WriteString("effects", NativeHostProfileV2.Effects);
            json.WriteString("attempt", bound.Profile.Attempt);
            json.WriteString("slot", slot.ToString());
            json.WriteString("path", path);
            json.WriteString("profileSha256", bound.Profile.CanonicalSha256);
            json.WriteString("sourceSetSha256", bound.Profile.SourceSetSha256);
            json.WriteString("planSha256", bound.Plan.CanonicalSha256);
            json.WriteString("approvalSha256", bound.Approval.CanonicalSha256);
            json.WriteString("hostSha256", bound.Plan.HostSha256);
            json.WriteString("bootSha256", bound.Plan.BootSha256);
            json.WriteString("writerRole", writer.ToString());
            json.WriteString("writerSid", bound.Profile.Role(writer).PrincipalSid);
            json.WriteString("run", runId);
            json.WriteString("nonce", nonce64);
            json.WriteString("previousSha256", previousSha256);
            json.WriteString("evidenceSha256", evidenceSha256);
            json.WriteString("writtenUtc", writtenUtc);
            json.WriteBoolean("nativeEvidenceEstablished", false);
            json.WriteBoolean("physicalDurabilityProven", false);
            json.WriteBoolean("grantAuthorized", false);
            json.WriteBoolean("lic008Closed", false);
            json.WriteEndObject();
        }
        byte[] original = buffer.ToArray();
        Need(original.Length is > 0 and <= MaximumBytes,
            "NATIVE_PREFIX_EVENT_SIZE_REFUSED");
        return original;
    }

    internal static NativeHostPrefixEventV3 ParseCanonical(byte[]? supplied,
        NativeHostBoundInputV2 bound, NativeHostStoreFileV3 slot,
        string previousSha256, DateTimeOffset now)
    {
        Need(supplied is { Length: > 0 and <= MaximumBytes },
            "NATIVE_PREFIX_EVENT_ORIGINAL_REFUSED");
        byte[] raw = (byte[])supplied.Clone();
        string run, nonce, evidence;
        DateTimeOffset written;
        try {
            using JsonDocument document = JsonDocument.Parse(raw,
                new JsonDocumentOptions { MaxDepth = 4, AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object,
                "NATIVE_PREFIX_EVENT_OBJECT_REFUSED");
            run = root.GetProperty("run").GetString() ?? "";
            nonce = root.GetProperty("nonce").GetString() ?? "";
            evidence = root.GetProperty("evidenceSha256").GetString() ?? "";
            written = root.GetProperty("writtenUtc").GetDateTimeOffset();
        } catch (Exception e) when (e is JsonException or InvalidOperationException or
            KeyNotFoundException or FormatException) {
            throw new InvalidDataException("NATIVE_PREFIX_EVENT_PARSE_REFUSED", e);
        }
        Need(written.Offset == TimeSpan.Zero &&
            written >= bound.Approval.IssuedUtc && written <= now &&
            written < bound.Approval.ExpiresUtc && written < bound.Plan.ExpiresUtc,
            "NATIVE_PREFIX_EVENT_TIME_REFUSED");
        byte[] canonical = Encode(bound, slot, previousSha256,
            run, nonce, evidence, written);
        Need(raw.AsSpan().SequenceEqual(canonical),
            "NATIVE_PREFIX_EVENT_CANONICAL_OR_CHAIN_REFUSED");
        return new(slot, run, nonce, evidence, written);
    }
}

// Slot 40 seals the first 40 checked originals and their exact supplied
// receipt identities. Its canonical bytes never include their own SHA.
internal sealed record NativeHostPrefixSealOriginalV3(
    string PrefixCommitmentSha256, string EvidenceSha256, DateTimeOffset WrittenUtc)
{
    internal const string Schema = "TEST_ONLY_STANDARD_NATIVE_HOST_PREFIX_SEAL_V3";
    internal const int MaximumBytes = 4096;

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) =>
        value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    internal static string Commitment(
        IReadOnlyList<NativeHostPrefixDirectoryV3> directories,
        IReadOnlyList<NativeHostPreactivationObservedV3> files)
    {
        Need(directories.Count == 9 && files.Count == 40,
            "NATIVE_PREFIX_SEAL_PREDECESSORS_REQUIRED");
        using var buffer = new MemoryStream();
        using (var json = new Utf8JsonWriter(buffer)) {
            json.WriteStartObject();
            json.WriteString("schema", "TEST_ONLY_STANDARD_NATIVE_HOST_PREFIX_MANIFEST_V3");
            json.WriteStartArray("directories");
            for (int i = 0; i < 9; i++) {
                NativeHostPrefixDirectoryV3 dir = directories[i];
                Need(LowerHex(dir.VolumeSerial64, 16) &&
                    LowerHex(dir.FileId128, 32) &&
                    (i == 0 ? dir.ParentVolumeSerial64.Length == 0 &&
                        dir.ParentFileId128.Length == 0 :
                        LowerHex(dir.ParentVolumeSerial64, 16) &&
                        LowerHex(dir.ParentFileId128, 32)),
                    "NATIVE_PREFIX_SEAL_DIRECTORY_SHAPE_REFUSED");
                json.WriteStartObject();
                json.WriteNumber("ordinal", i);
                json.WriteString("path", dir.Path);
                json.WriteString("parentPath", dir.ParentPath);
                json.WriteString("leafName", dir.LeafName);
                json.WriteString("volumeSerial64", dir.VolumeSerial64);
                json.WriteString("fileId128", dir.FileId128);
                json.WriteString("parentVolumeSerial64", dir.ParentVolumeSerial64);
                json.WriteString("parentFileId128", dir.ParentFileId128);
                json.WriteNumber("creationFileTimeUtc", dir.CreationFileTimeUtc);
                json.WriteString("descriptorSha256",
                    NativeHostInputCodecV2.Hash(dir.Descriptor));
                json.WriteBoolean("directory", dir.Directory);
                json.WriteBoolean("parentHeld", dir.ParentHeld);
                json.WriteBoolean("relativeOpen", dir.RelativeOpen);
                json.WriteBoolean("noReparse", dir.NoReparse);
                json.WriteBoolean("protectedAcl", dir.ProtectedAcl);
                json.WriteEndObject();
            }
            json.WriteEndArray();
            json.WriteStartArray("originals");
            for (int i = 0; i < 40; i++) {
                NativeHostPreactivationObservedV3 file = files[i];
                Need(file.Slot == (NativeHostStoreFileV3)i &&
                    LowerHex(file.Sha256, 64) &&
                    LowerHex(file.VolumeSerial64, 16) &&
                    LowerHex(file.FileId128, 32) &&
                    LowerHex(file.ParentVolumeSerial64, 16) &&
                    LowerHex(file.ParentFileId128, 32),
                    "NATIVE_PREFIX_SEAL_PREDECESSOR_SHAPE_REFUSED");
                json.WriteStartObject();
                json.WriteNumber("ordinal", i);
                json.WriteString("slot", file.Slot.ToString());
                json.WriteString("path", file.Path);
                json.WriteString("sha256", file.Sha256);
                json.WriteNumber("length", file.Length);
                json.WriteString("writtenUtc", file.WrittenUtc);
                json.WriteNumber("creationFileTimeUtc", file.CreationFileTimeUtc);
                json.WriteString("volumeSerial64", file.VolumeSerial64);
                json.WriteString("fileId128", file.FileId128);
                json.WriteString("parentPath", file.ParentPath);
                json.WriteString("parentVolumeSerial64", file.ParentVolumeSerial64);
                json.WriteString("parentFileId128", file.ParentFileId128);
                json.WriteString("descriptorSha256",
                    NativeHostInputCodecV2.Hash(file.Descriptor));
                json.WriteEndObject();
            }
            json.WriteEndArray();
            json.WriteEndObject();
        }
        return NativeHostInputCodecV2.Hash(buffer.ToArray());
    }

    internal static byte[] Encode(NativeHostBoundInputV2 bound,
        IReadOnlyList<NativeHostPrefixDirectoryV3> directories,
        IReadOnlyList<NativeHostPreactivationObservedV3> predecessors,
        string previousSha256, string guardianRun, string guardianNonce,
        string evidenceSha256, DateTimeOffset writtenUtc)
    {
        Need(predecessors.Count == 40 &&
            previousSha256 == predecessors[39].Sha256 &&
            LowerHex(previousSha256, 64) && LowerHex(evidenceSha256, 64) &&
            LowerHex(guardianRun, 32) && LowerHex(guardianNonce, 64) &&
            writtenUtc.Offset == TimeSpan.Zero,
            "NATIVE_PREFIX_SEAL_FIELDS_REFUSED");
        string path = bound.Profile.RecordRoot + @"\" +
            NativeHostTranscriptShapeV3.Relative(
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete);
        string commitment = Commitment(directories, predecessors);
        using var buffer = new MemoryStream();
        using (var json = new Utf8JsonWriter(buffer)) {
            json.WriteStartObject();
            json.WriteString("schema", Schema);
            json.WriteString("profileId", NativeHostProfileV2.ProfileId);
            json.WriteString("effects", NativeHostProfileV2.Effects);
            json.WriteString("attempt", bound.Profile.Attempt);
            json.WriteString("slot", NativeHostStoreFileV3.ServiceGuardianBeforeComplete.ToString());
            json.WriteString("path", path);
            json.WriteString("profileSha256", bound.Profile.CanonicalSha256);
            json.WriteString("sourceSetSha256", bound.Profile.SourceSetSha256);
            json.WriteString("planSha256", bound.Plan.CanonicalSha256);
            json.WriteString("approvalSha256", bound.Approval.CanonicalSha256);
            json.WriteString("hostSha256", bound.Plan.HostSha256);
            json.WriteString("bootSha256", bound.Plan.BootSha256);
            json.WriteString("writerRole", NativeHostRole.Owner.ToString());
            json.WriteString("writerSid", NativeHostProfileV2.OwnerSid);
            json.WriteNumber("predecessorCount", 40);
            json.WriteString("prefixCommitmentSha256", commitment);
            json.WriteString("run", guardianRun);
            json.WriteString("nonce", guardianNonce);
            json.WriteString("previousSha256", previousSha256);
            json.WriteString("evidenceSha256", evidenceSha256);
            json.WriteString("writtenUtc", writtenUtc);
            json.WriteBoolean("nativeEvidenceEstablished", false);
            json.WriteBoolean("physicalDurabilityProven", false);
            json.WriteBoolean("grantAuthorized", false);
            json.WriteBoolean("lic008Closed", false);
            json.WriteEndObject();
        }
        byte[] raw = buffer.ToArray();
        Need(raw.Length is > 0 and <= MaximumBytes,
            "NATIVE_PREFIX_SEAL_SIZE_REFUSED");
        return raw;
    }

    internal static NativeHostPrefixSealOriginalV3 ParseCanonical(byte[]? supplied,
        NativeHostBoundInputV2 bound,
        IReadOnlyList<NativeHostPrefixDirectoryV3> directories,
        IReadOnlyList<NativeHostPreactivationObservedV3> predecessors,
        string previousSha256, string guardianRun, string guardianNonce,
        DateTimeOffset now)
    {
        Need(supplied is { Length: > 0 and <= MaximumBytes },
            "NATIVE_PREFIX_SEAL_ORIGINAL_REFUSED");
        byte[] raw = (byte[])supplied.Clone();
        string evidence;
        DateTimeOffset written;
        try {
            using JsonDocument document = JsonDocument.Parse(raw,
                new JsonDocumentOptions { MaxDepth = 4, AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object,
                "NATIVE_PREFIX_SEAL_OBJECT_REFUSED");
            evidence = root.GetProperty("evidenceSha256").GetString() ?? "";
            written = root.GetProperty("writtenUtc").GetDateTimeOffset();
        } catch (Exception e) when (e is JsonException or InvalidOperationException or
            KeyNotFoundException or FormatException) {
            throw new InvalidDataException("NATIVE_PREFIX_SEAL_PARSE_REFUSED", e);
        }
        Need(written.Offset == TimeSpan.Zero &&
            written >= bound.Approval.IssuedUtc && written <= now &&
            written < bound.Approval.ExpiresUtc && written < bound.Plan.ExpiresUtc,
            "NATIVE_PREFIX_SEAL_TIME_REFUSED");
        byte[] expected = Encode(bound, directories, predecessors, previousSha256,
            guardianRun, guardianNonce, evidence, written);
        Need(raw.AsSpan().SequenceEqual(expected),
            "NATIVE_PREFIX_SEAL_CANONICAL_OR_CHAIN_REFUSED");
        return new(Commitment(directories, predecessors), evidence, written);
    }
}

// A fresh, pure read of slots 0-40. Every observation is injected; this is not
// a native protected placement, proof of historical authorship, or authority.
// Attempt/input/ancestor ACL pins are correlation inputs. Exact two-ACE
// Owner+SYSTEM policy is enforced only for stage/journal/report and event files;
// the unresolved real-root and ancestor ACL policy stays outside this model.
internal sealed class NativeHostTranscriptPrefixV3
{
    private const int MaximumInputBytes = 4194304;
    private const int FileAllAccess = 0x001f01ff;
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostTranscriptPrefixV3> Retained = new();
    private readonly NativeHostBoundInputV2 bound;
    private readonly INativeHostTranscriptPrefixBackendV3 backend;
    private readonly INativeHostTranscriptPrefixGuardV3 guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly string[] directories;
    private readonly Dictionary<string, string> expectedAcl = new(StringComparer.Ordinal);
    private DateTimeOffset? lastUtc;
    private int state; // 0 new, 1 active, 2 complete, 3 faulted

    internal bool Faulted => Volatile.Read(ref state) == 3;
    internal bool Completed => Volatile.Read(ref state) == 2;
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    internal NativeHostTranscriptPrefixV3(NativeHostBoundInputV2 bound,
        IReadOnlyList<NativeHostPrefixAclPinV3> aclPins,
        INativeHostTranscriptPrefixBackendV3 backend,
        INativeHostTranscriptPrefixGuardV3 guard, Func<DateTimeOffset> utcNow)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
        NativeHostTranscriptShapeV3.Validate();
        Need(bound.Profile is not null && bound.Plan is not null && bound.Approval is not null &&
            NativeHostProfileV2.ParseCanonical(bound.Profile.CanonicalBytes()).CanonicalSha256 ==
                bound.Profile.CanonicalSha256 &&
            NativeHostInputCodecV2.ParsePlan(bound.Plan.CanonicalBytes(), bound.Profile)
                .CanonicalSha256 == bound.Plan.CanonicalSha256 &&
            NativeHostInputCodecV2.ParseApproval(bound.Approval.CanonicalBytes(), bound.Plan)
                .CanonicalSha256 == bound.Approval.CanonicalSha256,
            "NATIVE_PREFIX_BOUND_INPUT_REFUSED");
        directories = FixedDirectories(bound.Profile);
        Need(aclPins is { Count: 50 }, "NATIVE_PREFIX_ACL_PINS_REFUSED");
        var expectedPaths = directories.Concat(Enumerable.Range(0, 41).Select(i =>
            PathOf((NativeHostStoreFileV3)i))).ToArray();
        for (int i = 0; i < expectedPaths.Length; i++) {
            NativeHostPrefixAclPinV3? pin = aclPins[i];
            Need(pin is not null && pin.Path == expectedPaths[i] &&
                LowerHex(pin.DescriptorSha256, 64) &&
                expectedAcl.TryAdd(pin.Path, pin.DescriptorSha256),
                "NATIVE_PREFIX_ACL_PIN_ORDER_REFUSED");
        }
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static DateTimeOffset Creation(long fileTime)
    {
        try { return new DateTimeOffset(DateTime.FromFileTimeUtc(fileTime)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_PREFIX_CREATION_TIME_REFUSED", e);
        }
    }
    private static string[] FixedDirectories(NativeHostProfileV2 profile)
    {
        string root = NativeHostProfileV2.Root;
        string attempt = profile.RecordRoot;
        Need(root == @"C:\ProgramData\Ecs.Lic008.StandardNativeHostV1" &&
            attempt == root + @"\records\" + profile.Attempt,
            "NATIVE_PREFIX_FIXED_ROOT_REFUSED");
        return new[] { @"C:\", @"C:\ProgramData", root, root + @"\records", attempt,
            attempt + @"\input", attempt + @"\journal", attempt + @"\stage",
            attempt + @"\report" };
    }
    private string PathOf(NativeHostStoreFileV3 slot) =>
        bound.Profile.RecordRoot + @"\" + NativeHostTranscriptShapeV3.Relative(slot);
    private DateTimeOffset Time()
    {
        DateTimeOffset now = utcNow();
        Need(Volatile.Read(ref state) == 1 && now.Offset == TimeSpan.Zero &&
            now >= bound.Plan.IssuedUtc && now < bound.Plan.ExpiresUtc &&
            now >= bound.Approval.IssuedUtc && now < bound.Approval.ExpiresUtc &&
            (lastUtc is null || now >= lastUtc),
            "NATIVE_PREFIX_WINDOW_OR_REENTRY_REFUSED");
        lastUtc = now;
        return now;
    }
    private void Guard(string point)
    {
        _ = Time();
        guard.Verify(bound, point);
        _ = Time();
    }
    // Ancestor, attempt-root and input pins correlate injected observations;
    // their broader DACLs are not an admitted W03 security policy. Exact
    // two-ACE policy applies only to journal/stage/report and event files.
    // No ACL result from this pure reader establishes physical authority.
    private RawSecurityDescriptor Descriptor(string path, byte[] raw,
        bool requireProtected, bool exactOwnerOnly)
    {
        Need(raw is { Length: >= 20 and <= 65536 } &&
            expectedAcl.TryGetValue(path, out string? sha) &&
            NativeHostInputCodecV2.Hash(raw) == sha,
            "NATIVE_PREFIX_ACL_PIN_REFUSED");
        RawSecurityDescriptor descriptor;
        try { descriptor = new RawSecurityDescriptor(raw, 0); }
        catch (Exception e) when (e is ArgumentException or IndexOutOfRangeException) {
            throw new InvalidDataException("NATIVE_PREFIX_ACL_PARSE_REFUSED", e);
        }
        Need(descriptor.Owner is not null &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclPresent) &&
            descriptor.DiscretionaryAcl is not null &&
            (!requireProtected || descriptor.ControlFlags.HasFlag(
                ControlFlags.DiscretionaryAclProtected)),
            "NATIVE_PREFIX_ACL_HEADER_REFUSED");
        if (requireProtected) {
            Need(descriptor.Owner.Value == NativeHostProfileV2.OwnerSid &&
                descriptor.Group?.Value == NativeHostProfileV2.OwnerSid &&
                descriptor.SystemAcl is null,
                "NATIVE_PREFIX_ACL_OWNER_REFUSED");
            var trustees = new HashSet<string>(StringComparer.Ordinal) {
                NativeHostProfileV2.OwnerSid, NativeHostProfileV2.SystemSid
            };
            foreach (GenericAce ace in descriptor.DiscretionaryAcl) {
                if (ace is not CommonAce common)
                    throw new InvalidDataException("NATIVE_PREFIX_ACL_ACE_REFUSED");
                Need(common.AceType == AceType.AccessAllowed &&
                    common.AceFlags == AceFlags.None,
                    "NATIVE_PREFIX_ACL_ACE_REFUSED");
                if (common.AccessMask == FileAllAccess)
                    trustees.Remove(common.SecurityIdentifier.Value);
            }
            Need(trustees.Count == 0 &&
                (!exactOwnerOnly || descriptor.DiscretionaryAcl.Count == 2),
                "NATIVE_PREFIX_ACL_TRUSTEES_REFUSED");
        }
        return descriptor;
    }

    private NativeHostPrefixDirectoryV3 ReadDirectory(string path,
        string expectedParent, string leaf,
        IReadOnlyDictionary<string, NativeHostPrefixDirectoryV3> prior,
        HashSet<string> ids)
    {
        Guard("BEFORE_DIR_" + path);
        NativeHostPrefixDirectoryV3? raw = backend.ReadDirectory(path);
        Guard("AFTER_DIR_" + path);
        Need(raw is not null && raw.Descriptor is not null,
            "NATIVE_PREFIX_DIRECTORY_MISSING_OR_UNKNOWN");
        NativeHostPrefixDirectoryV3 value = raw with {
            Descriptor = (byte[])raw.Descriptor.Clone()
        };
        bool isRoot = path == @"C:\";
        bool protectedPart = path == directories[4] || path == directories[5] ||
            path == directories[6] || path == directories[7] || path == directories[8];
        bool exactOwnerOnly = path == directories[6] || path == directories[7] ||
            path == directories[8];
        Need(value.Path == path && value.ParentPath == expectedParent &&
            value.LeafName == leaf && value.Directory && value.NoReparse &&
            value.ParentHeld == !isRoot && value.RelativeOpen == !isRoot &&
            (!protectedPart || value.ProtectedAcl) &&
            LowerHex(value.VolumeSerial64, 16) &&
            value.VolumeSerial64 != new string('0', 16) &&
            LowerHex(value.FileId128, 32) &&
            value.FileId128 != new string('0', 32) && ids.Add(value.FileId128) &&
            Creation(value.CreationFileTimeUtc) <= Time(),
            "NATIVE_PREFIX_DIRECTORY_RECEIPT_REFUSED");
        if (!isRoot) {
            Need(prior.TryGetValue(expectedParent, out var parent) &&
                value.VolumeSerial64 == parent.VolumeSerial64 &&
                value.ParentVolumeSerial64 == parent.VolumeSerial64 &&
                value.ParentFileId128 == parent.FileId128 &&
                Creation(value.CreationFileTimeUtc) >=
                    Creation(parent.CreationFileTimeUtc),
                "NATIVE_PREFIX_DIRECTORY_PARENT_REFUSED");
        } else {
            Need(value.ParentVolumeSerial64.Length == 0 &&
                value.ParentFileId128.Length == 0,
                "NATIVE_PREFIX_VOLUME_ROOT_PARENT_REFUSED");
        }
        if (protectedPart)
            Need(Creation(value.CreationFileTimeUtc) >= bound.Approval.IssuedUtc,
                "NATIVE_PREFIX_DIRECTORY_CREATION_REFUSED");
        RawSecurityDescriptor descriptor = Descriptor(path, value.Descriptor,
            protectedPart, exactOwnerOnly);
        Need(value.ProtectedAcl == descriptor.ControlFlags.HasFlag(
            ControlFlags.DiscretionaryAclProtected),
            "NATIVE_PREFIX_DIRECTORY_ACL_FLAG_REFUSED");
        return value;
    }

    private NativeHostPreactivationObservedV3 ReadFile(NativeHostStoreFileV3 slot,
        IReadOnlyDictionary<string, NativeHostPrefixDirectoryV3> dirs,
        HashSet<string> ids)
    {
        string path = PathOf(slot);
        Guard("BEFORE_FILE_" + slot);
        NativeHostPreactivationObservedV3? raw = backend.ReadOriginal(slot, path);
        Guard("AFTER_FILE_" + slot);
        Need(raw is not null && raw.Original is not null && raw.Descriptor is not null,
            "NATIVE_PREFIX_FILE_MISSING_OR_UNKNOWN");
        NativeHostPreactivationObservedV3 value = raw with {
            Original = (byte[])raw.Original.Clone(),
            Descriptor = (byte[])raw.Descriptor.Clone()
        };
        int slash = path.LastIndexOf('\\');
        int maximum = (int)slot < 8 ? MaximumInputBytes :
            NativeHostPrefixEventCodecV3.MaximumBytes;
        Need(slash > 0 && dirs.TryGetValue(path[..slash], out var parent) &&
            value.Slot == slot && value.Path == path &&
            value.Original.Length is > 0 && value.Original.Length <= maximum &&
            value.Sha256 == NativeHostInputCodecV2.Hash(value.Original) &&
            value.Length == value.Original.Length &&
            value.WrittenUtc.Offset == TimeSpan.Zero &&
            value.WrittenUtc >= bound.Approval.IssuedUtc &&
            value.WrittenUtc <= Time() &&
            Creation(value.CreationFileTimeUtc) >= bound.Approval.IssuedUtc &&
            Creation(value.CreationFileTimeUtc) <= value.WrittenUtc &&
            Creation(value.CreationFileTimeUtc) >=
                Creation(parent.CreationFileTimeUtc) &&
            LowerHex(value.VolumeSerial64, 16) &&
            value.VolumeSerial64 == parent.VolumeSerial64 &&
            LowerHex(value.FileId128, 32) &&
            value.FileId128 != new string('0', 32) && ids.Add(value.FileId128) &&
            value.ParentPath == parent.Path &&
            value.ParentVolumeSerial64 == parent.VolumeSerial64 &&
            value.ParentFileId128 == parent.FileId128 &&
            value.LeafName == path[(slash + 1)..] &&
            value.ParentHeld && value.RelativeOpen && value.NoReparse &&
            value.CreateNew && value.ProtectedAcl && value.Flushed &&
            value.ExactReadback,
            "NATIVE_PREFIX_FILE_RECEIPT_REFUSED");
        _ = Descriptor(path, value.Descriptor, true, (int)slot >= 8);
        return value;
    }

    private void CheckInputs(IReadOnlyList<NativeHostPreactivationObservedV3> files)
    {
        Need(files.Count >= 8 &&
            files[0].Original.AsSpan().SequenceEqual(bound.Profile.CanonicalBytes()) &&
            files[6].Original.AsSpan().SequenceEqual(bound.Plan.CanonicalBytes()) &&
            files[7].Original.AsSpan().SequenceEqual(bound.Approval.CanonicalBytes()) &&
            files[4].Sha256 == NativeHostProfileV2.AccountOwnedSha256 &&
            files[5].Sha256 == NativeHostProfileV2.AccountCompleteSha256,
            "NATIVE_PREFIX_EIGHT_ORIGINALS_REFUSED");
        NativeHostBoundInputV2 rebound = NativeHostInputCodecV2.Bind(
            files[6].Original, files[7].Original, files[0].Original,
            files[1].Original, files[3].Original, files[2].Original, Time());
        Need(rebound.Profile.CanonicalSha256 == bound.Profile.CanonicalSha256 &&
            rebound.Plan.CanonicalSha256 == bound.Plan.CanonicalSha256 &&
            rebound.Approval.CanonicalSha256 == bound.Approval.CanonicalSha256 &&
            rebound.Profile.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            rebound.Plan.PackageManifestSha256 == bound.Plan.PackageManifestSha256 &&
            rebound.Plan.RuntimeInventorySha256 == bound.Plan.RuntimeInventorySha256,
            "NATIVE_PREFIX_REBOUND_INPUT_REFUSED");
    }

    private static void Same(NativeHostPrefixDirectoryV3 a, NativeHostPrefixDirectoryV3 b)
    {
        Need(a.Path == b.Path && a.ParentPath == b.ParentPath &&
            a.LeafName == b.LeafName && a.VolumeSerial64 == b.VolumeSerial64 &&
            a.FileId128 == b.FileId128 &&
            a.ParentVolumeSerial64 == b.ParentVolumeSerial64 &&
            a.ParentFileId128 == b.ParentFileId128 &&
            a.CreationFileTimeUtc == b.CreationFileTimeUtc &&
            a.Directory == b.Directory && a.ParentHeld == b.ParentHeld &&
            a.RelativeOpen == b.RelativeOpen && a.NoReparse == b.NoReparse &&
            a.ProtectedAcl == b.ProtectedAcl &&
            a.Descriptor.AsSpan().SequenceEqual(b.Descriptor),
            "NATIVE_PREFIX_FINAL_DIRECTORY_CHANGED");
    }
    private static void Same(NativeHostPreactivationObservedV3 a,
        NativeHostPreactivationObservedV3 b)
    {
        Need(a.Slot == b.Slot && a.Path == b.Path &&
            a.Sha256 == b.Sha256 && a.Length == b.Length &&
            a.WrittenUtc == b.WrittenUtc &&
            a.CreationFileTimeUtc == b.CreationFileTimeUtc &&
            a.VolumeSerial64 == b.VolumeSerial64 && a.FileId128 == b.FileId128 &&
            a.ParentPath == b.ParentPath &&
            a.ParentVolumeSerial64 == b.ParentVolumeSerial64 &&
            a.ParentFileId128 == b.ParentFileId128 &&
            a.LeafName == b.LeafName && a.ParentHeld == b.ParentHeld &&
            a.RelativeOpen == b.RelativeOpen && a.NoReparse == b.NoReparse &&
            a.CreateNew == b.CreateNew && a.ProtectedAcl == b.ProtectedAcl &&
            a.Flushed == b.Flushed && a.ExactReadback == b.ExactReadback &&
            a.Original.AsSpan().SequenceEqual(b.Original) &&
            a.Descriptor.AsSpan().SequenceEqual(b.Descriptor),
            "NATIVE_PREFIX_FINAL_FILE_CHANGED");
    }

    internal NativeHostPrefixSealV3 Verify()
    {
        if (Interlocked.CompareExchange(ref state, 1, 0) != 0) {
            Volatile.Write(ref state, 3);
            throw new InvalidDataException("NATIVE_PREFIX_RETRY_OR_REENTRY_REFUSED");
        }
        lock (RetainedGate) Retained.Add(this);
        try {
            Guard("BEGIN");
            var dirs = new Dictionary<string, NativeHostPrefixDirectoryV3>(StringComparer.Ordinal);
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (string path in directories) {
                string parent = path == @"C:\" ? "" :
                    path == @"C:\ProgramData" ? @"C:\" :
                    path[..path.LastIndexOf('\\')];
                string leaf = path == @"C:\" ? "" :
                    path[(path.LastIndexOf('\\') + 1)..];
                dirs.Add(path, ReadDirectory(path, parent, leaf, dirs, ids));
            }
            var files = new List<NativeHostPreactivationObservedV3>(41);
            for (int i = 0; i < 41; i++) {
                NativeHostStoreFileV3 slot = (NativeHostStoreFileV3)i;
                files.Add(ReadFile(slot, dirs, ids));
                if (i == 7) CheckInputs(files);
            }
            for (int i = 1; i < files.Count; i++)
                Need(Creation(files[i].CreationFileTimeUtc) >=
                    files[i - 1].WrittenUtc,
                    "NATIVE_PREFIX_FILE_ORDER_REFUSED");
            string previous = files[7].Sha256;
            DateTimeOffset written = files[7].WrittenUtc;
            string setupRun = "", setupNonce = "", guardianRun = "", guardianNonce = "";
            for (int i = 8; i < 40; i++) {
                NativeHostPreactivationObservedV3 file = files[i];
                NativeHostPrefixEventV3 record = NativeHostPrefixEventCodecV3.ParseCanonical(
                    file.Original, bound, file.Slot, previous, Time());
                Need(record.WrittenUtc >= written &&
                    record.WrittenUtc >= files[i - 1].WrittenUtc &&
                    record.WrittenUtc <= file.WrittenUtc &&
                    Creation(file.CreationFileTimeUtc) >= record.WrittenUtc,
                    "NATIVE_PREFIX_EVENT_ORDER_REFUSED");
                int stage = NativeHostPrefixEventCodecV3.Stage(file.Slot);
                if (stage == 1) {
                    if (setupRun.Length == 0) {
                        setupRun = record.RunId; setupNonce = record.Nonce64;
                    }
                    Need(record.RunId == setupRun && record.Nonce64 == setupNonce,
                        "NATIVE_PREFIX_SETUP_RUN_CHANGED");
                } else if (stage == 2) {
                    if (guardianRun.Length == 0) {
                        guardianRun = record.RunId; guardianNonce = record.Nonce64;
                    }
                    Need(record.RunId == guardianRun && record.Nonce64 == guardianNonce &&
                        record.RunId != setupRun && record.Nonce64 != setupNonce,
                        "NATIVE_PREFIX_GUARDIAN_RUN_REUSED_OR_CHANGED");
                }
                previous = file.Sha256;
                written = record.WrittenUtc;
            }
            NativeHostPreactivationObservedV3 terminal = files[40];
            NativeHostPrefixSealOriginalV3 terminalOriginal =
                NativeHostPrefixSealOriginalV3.ParseCanonical(
                    terminal.Original, bound,
                    directories.Select(path => dirs[path]).ToArray(),
                    files.Take(40).ToArray(),
                    previous, guardianRun, guardianNonce, Time());
            Need(terminalOriginal.WrittenUtc >= written &&
                terminalOriginal.WrittenUtc >= files[39].WrittenUtc &&
                terminalOriginal.WrittenUtc <= terminal.WrittenUtc &&
                Creation(terminal.CreationFileTimeUtc) >= terminalOriginal.WrittenUtc,
                "NATIVE_PREFIX_SEAL_ORDER_REFUSED");
            // Reread all ancestors and all 41 originals after parsing. This
            // remains a sequence of samples, never an atomic snapshot.
            foreach (string path in directories) {
                Guard("BEFORE_FINAL_DIR_" + path);
                NativeHostPrefixDirectoryV3? observed = backend.ReadDirectory(path);
                Guard("AFTER_FINAL_DIR_" + path);
                Need(observed is not null && observed.Descriptor is not null,
                    "NATIVE_PREFIX_FINAL_DIRECTORY_MISSING");
                Same(dirs[path], observed);
            }
            foreach (NativeHostPreactivationObservedV3 file in files) {
                Guard("BEFORE_FINAL_FILE_" + file.Slot);
                NativeHostPreactivationObservedV3? observed = backend.ReadOriginal(
                    file.Slot, file.Path);
                Guard("AFTER_FINAL_FILE_" + file.Slot);
                Need(observed is not null && observed.Original is not null &&
                    observed.Descriptor is not null,
                    "NATIVE_PREFIX_FINAL_FILE_MISSING");
                Same(file, observed);
            }
            NativeHostPrefixDirectoryV3 stageWitness = dirs[directories[7]];
            Need(stageWitness.Path == bound.Profile.RecordRoot + @"\stage" &&
                stageWitness.ParentPath == bound.Profile.RecordRoot &&
                stageWitness.ParentFileId128 == dirs[directories[4]].FileId128 &&
                stageWitness.VolumeSerial64 == terminal.VolumeSerial64 &&
                stageWitness.FileId128 != terminal.ParentFileId128 &&
                stageWitness.FileId128 != terminal.FileId128,
                "NATIVE_PREFIX_STAGE_WITNESS_REFUSED");
            Need(Interlocked.CompareExchange(ref state, 2, 1) == 1,
                "NATIVE_PREFIX_REENTRY_POISONED");
            return new NativeHostPrefixSealV3(bound, terminal, terminal.Original,
                terminalOriginal.PrefixCommitmentSha256,
                terminalOriginal.WrittenUtc, dirs[directories[4]].FileId128,
                setupRun, setupNonce, guardianRun, guardianNonce,
                stageWitness.Path, stageWitness.VolumeSerial64,
                stageWitness.FileId128);
        } catch {
            Volatile.Write(ref state, 3);
            throw;
        }
    }
}
