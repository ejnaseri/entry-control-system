using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

// This V3 original links stage 3 to the separately verified typed slot-40
// prefix seal. The seal and Owner role are model inputs, not native authority.
// The V2 intent and its historical store marker remain separate.
internal sealed class NativeHostUserIntentV3
{
    internal const string Schema = "TEST_ONLY_STANDARD_NATIVE_HOST_USER_INTENT_V3";
    internal const int MaximumBytes = 2048;
    internal const NativeHostStoreFileV3 StoreSlot = NativeHostStoreFileV3.StandardUserIntent;
    private readonly byte[] canonical;

    internal string Attempt { get; }
    internal string ProfileSha256 { get; }
    internal string SourceSetSha256 { get; }
    internal string PlanSha256 { get; }
    internal string ApprovalSha256 { get; }
    internal string PreviousSha256 { get; }
    internal string HostSha256 { get; }
    internal string BootSha256 { get; }
    internal string ImageSha256 { get; }
    internal string UserSid { get; }
    internal string RunId { get; }
    internal string Nonce64 { get; }
    internal string StorePath { get; }
    internal NativeHostStage Stage => NativeHostStage.StandardUser;
    internal string CanonicalSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])canonical.Clone();
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    private NativeHostUserIntentV3(NativeHostBoundInputV2 bound,
        NativeHostPrefixSealV3 seal, string runId, string nonce64)
    {
        Attempt = bound.Profile.Attempt;
        ProfileSha256 = bound.Profile.CanonicalSha256;
        SourceSetSha256 = bound.Profile.SourceSetSha256;
        PlanSha256 = bound.Plan.CanonicalSha256;
        ApprovalSha256 = bound.Approval.CanonicalSha256;
        PreviousSha256 = seal.CanonicalSha256;
        HostSha256 = bound.Plan.HostSha256;
        BootSha256 = bound.Plan.BootSha256;
        ImageSha256 = bound.Plan.Image.Sha256;
        UserSid = bound.Profile.Role(NativeHostRole.User).PrincipalSid;
        RunId = runId;
        Nonce64 = nonce64;
        StorePath = bound.Profile.RecordRoot + @"\" +
            NativeHostTranscriptShapeV3.Relative(StoreSlot);
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer)) {
            writer.WriteStartObject();
            writer.WriteString("schema", Schema);
            writer.WriteString("profileId", NativeHostProfileV2.ProfileId);
            writer.WriteString("effects", NativeHostProfileV2.Effects);
            writer.WriteString("attempt", Attempt);
            writer.WriteString("profileSha256", ProfileSha256);
            writer.WriteString("sourceSetSha256", SourceSetSha256);
            writer.WriteString("planSha256", PlanSha256);
            writer.WriteString("approvalSha256", ApprovalSha256);
            writer.WriteString("previousSha256", PreviousSha256);
            writer.WriteString("hostSha256", HostSha256);
            writer.WriteString("bootSha256", BootSha256);
            writer.WriteString("imageSha256", ImageSha256);
            writer.WriteString("userSid", UserSid);
            writer.WriteNumber("stage", (int)Stage);
            writer.WriteString("runId", RunId);
            writer.WriteString("nonce", Nonce64);
            writer.WriteEndObject();
        }
        canonical = buffer.ToArray();
        Need(canonical.Length is > 0 and <= MaximumBytes,
            "NATIVE_USER_INTENT_V3_SIZE_REFUSED");
        CanonicalSha256 = NativeHostInputCodecV2.Hash(canonical);
    }

    private static void Need([DoesNotReturnIf(false)] bool okay, string code)
    {
        if (!okay) throw new InvalidDataException(code);
    }

    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static DateTimeOffset Creation(long fileTime)
    {
        try { return new DateTimeOffset(DateTime.FromFileTimeUtc(fileTime)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_USER_INTENT_V3_SEAL_TIME_REFUSED", e);
        }
    }

    private static void ValidateBoundAndSeal(NativeHostBoundInputV2 bound,
        NativeHostPrefixSealV3 seal)
    {
        byte[] profileBytes = bound.Profile.CanonicalBytes();
        byte[] planBytes = bound.Plan.CanonicalBytes();
        byte[] approvalBytes = bound.Approval.CanonicalBytes();
        NativeHostProfileV2 profile = NativeHostProfileV2.ParseCanonical(profileBytes);
        NativeHostPlanV2 plan = NativeHostInputCodecV2.ParsePlan(planBytes, profile);
        NativeHostApprovalV2 approval = NativeHostInputCodecV2.ParseApproval(approvalBytes, plan);
        Need(bound.Profile.CanonicalSha256 == NativeHostInputCodecV2.Hash(profileBytes) &&
            bound.Plan.CanonicalSha256 == NativeHostInputCodecV2.Hash(planBytes) &&
            bound.Approval.CanonicalSha256 == NativeHostInputCodecV2.Hash(approvalBytes) &&
            profile.CanonicalSha256 == bound.Profile.CanonicalSha256 &&
            plan.CanonicalSha256 == bound.Plan.CanonicalSha256 &&
            approval.CanonicalSha256 == bound.Approval.CanonicalSha256 &&
            plan.Attempt == profile.Attempt &&
            plan.ProfileSha256 == profile.CanonicalSha256 &&
            plan.SourceSetSha256 == profile.SourceSetSha256 &&
            approval.PlanSha256 == plan.CanonicalSha256 &&
            profile.Role(NativeHostRole.User).PrincipalSid == NativeHostProfileV2.UserSid &&
            NativeHostProfileV2.Image ==
                @"C:\ProgramData\Ecs.Lic008.StandardNativeHostV1\bin\StandardControlHost.exe" &&
            plan.Image.Size > 0 && LowerHex(plan.Image.Sha256, 64) &&
            plan.IssuedUtc.Offset == TimeSpan.Zero &&
            approval.IssuedUtc.Offset == TimeSpan.Zero &&
            plan.ExpiresUtc.Offset == TimeSpan.Zero &&
            approval.ExpiresUtc.Offset == TimeSpan.Zero &&
            approval.IssuedUtc >= plan.IssuedUtc &&
            approval.ExpiresUtc <= plan.ExpiresUtc &&
            approval.IssuedUtc < approval.ExpiresUtc,
            "NATIVE_USER_INTENT_V3_BOUND_INPUT_REFUSED");

        byte[] sealOriginal = seal.CanonicalBytes();
        string terminalPath = profile.RecordRoot + @"\" +
            NativeHostTranscriptShapeV3.Relative(
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete);
        DateTimeOffset creation = Creation(seal.LastCreationFileTimeUtc);
        Need(sealOriginal.Length is > 0 and <= NativeHostStageStoreV2.MaximumEventBytes &&
            LowerHex(seal.CanonicalSha256, 64) &&
            seal.CanonicalSha256 == NativeHostInputCodecV2.Hash(sealOriginal) &&
            LowerHex(seal.PrefixCommitmentSha256, 64) &&
            seal.Attempt == profile.Attempt &&
            seal.ProfileSha256 == profile.CanonicalSha256 &&
            seal.SourceSetSha256 == profile.SourceSetSha256 &&
            seal.PlanSha256 == plan.CanonicalSha256 &&
            seal.ApprovalSha256 == approval.CanonicalSha256 &&
            seal.HostSha256 == plan.HostSha256 &&
            seal.BootSha256 == plan.BootSha256 &&
            seal.RecordRoot == profile.RecordRoot &&
            seal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            seal.TerminalPath == terminalPath &&
            LowerHex(seal.VolumeSerial64, 16) &&
            seal.VolumeSerial64 != new string('0', 16) &&
            LowerHex(seal.LastFileId128, 32) &&
            LowerHex(seal.LastParentFileId128, 32) &&
            LowerHex(seal.AttemptRootFileId128, 32) &&
            seal.LastFileId128 != new string('0', 32) &&
            seal.LastParentFileId128 != new string('0', 32) &&
            seal.AttemptRootFileId128 != new string('0', 32) &&
            seal.LastFileId128 != seal.LastParentFileId128 &&
            seal.LastFileId128 != seal.AttemptRootFileId128 &&
            seal.LastParentFileId128 != seal.AttemptRootFileId128 &&
            LowerHex(seal.LastDescriptorSha256, 64) &&
            seal.OriginalWrittenUtc.Offset == TimeSpan.Zero &&
            seal.LastWrittenUtc.Offset == TimeSpan.Zero &&
            seal.OriginalWrittenUtc >= approval.IssuedUtc &&
            seal.OriginalWrittenUtc < approval.ExpiresUtc &&
            seal.LastWrittenUtc >= seal.OriginalWrittenUtc &&
            seal.LastWrittenUtc < approval.ExpiresUtc &&
            creation >= seal.OriginalWrittenUtc &&
            creation <= seal.LastWrittenUtc &&
            LowerHex(seal.SetupRunId, 32) && LowerHex(seal.SetupNonce64, 64) &&
            LowerHex(seal.GuardianBeforeRunId, 32) &&
            LowerHex(seal.GuardianBeforeNonce64, 64) &&
            seal.SetupRunId != seal.GuardianBeforeRunId &&
            seal.SetupNonce64 != seal.GuardianBeforeNonce64 &&
            !seal.NativeEvidenceEstablished && !seal.PhysicalDurabilityProven &&
            !seal.HistoricalAuthorProven && !seal.CrossProcessCustodyProven &&
            !seal.AccountActivationAuthorized && !seal.UserCreationAuthorized &&
            !seal.GrantAuthorized && !seal.Lic008Closed,
            "NATIVE_USER_INTENT_V3_PREFIX_SEAL_REFUSED");
    }

    internal static NativeHostUserIntentV3 CreateOwner(NativeHostBoundInputV2? bound,
        NativeHostPrefixSealV3? seal, NativeHostRole author,
        string runId, string nonce64)
    {
        Need(author == NativeHostRole.Owner && bound is not null &&
            bound.Profile is not null && bound.Plan is not null &&
            bound.Approval is not null && seal is not null,
            "NATIVE_USER_INTENT_V3_OWNER_OR_SCOPE_REFUSED");
        ValidateBoundAndSeal(bound, seal);
        Need(LowerHex(runId, 32) && LowerHex(nonce64, 64) &&
            runId != seal.SetupRunId && runId != seal.GuardianBeforeRunId &&
            nonce64 != seal.SetupNonce64 &&
            nonce64 != seal.GuardianBeforeNonce64,
            "NATIVE_USER_INTENT_V3_RUN_NONCE_REFUSED");
        return new NativeHostUserIntentV3(bound, seal, runId, nonce64);
    }

    internal static NativeHostUserIntentV3 ParseOwnerOriginal(byte[]? original,
        NativeHostBoundInputV2? bound, NativeHostPrefixSealV3? seal,
        NativeHostRole author)
    {
        Need(original is { Length: >= 2 and <= MaximumBytes },
            "NATIVE_USER_INTENT_V3_ORIGINAL_SIZE_REFUSED");
        byte[] owned = (byte[])original.Clone();
        try {
            using JsonDocument document = JsonDocument.Parse(owned,
                new JsonDocumentOptions { MaxDepth = 4, AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object,
                "NATIVE_USER_INTENT_V3_ORIGINAL_OBJECT_REFUSED");
            string runId = root.GetProperty("runId").GetString() ?? "";
            string nonce64 = root.GetProperty("nonce").GetString() ?? "";
            NativeHostUserIntentV3 expected = CreateOwner(bound, seal, author,
                runId, nonce64);
            Need(owned.AsSpan().SequenceEqual(expected.canonical),
                "NATIVE_USER_INTENT_V3_ORIGINAL_CANONICAL_REFUSED");
            return expected;
        } catch (Exception e) when (e is JsonException or KeyNotFoundException or
            InvalidOperationException) {
            throw new InvalidDataException("NATIVE_USER_INTENT_V3_ORIGINAL_SHAPE_REFUSED", e);
        }
    }
}
