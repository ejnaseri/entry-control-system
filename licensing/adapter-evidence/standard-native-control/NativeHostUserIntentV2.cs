using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

// This is an Owner-constructed, canonical *proposal* for stage 3. The stage
// store currently records its digest as an event marker; it does not persist
// this original, convey it across processes, or authenticate its author.
internal sealed class NativeHostUserIntentV2
{
    internal const string Schema = "TEST_ONLY_STANDARD_NATIVE_HOST_USER_INTENT_V2";
    internal const int MaximumBytes = 2048;
    internal const NativeHostStoreFileV2 StoreSlot = NativeHostStoreFileV2.StandardUserIntent;
    private readonly byte[] canonical;

    internal string Attempt { get; }
    internal string ProfileSha256 { get; }
    internal string SourceSetSha256 { get; }
    internal string PlanSha256 { get; }
    internal string ApprovalSha256 { get; }
    internal string HostSha256 { get; }
    internal string BootSha256 { get; }
    internal string ImageSha256 { get; }
    internal string UserSid { get; }
    internal string RunId { get; }
    internal string Nonce64 { get; }
    internal NativeHostStage Stage => NativeHostStage.StandardUser;
    internal string CanonicalSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])canonical.Clone();
    internal bool PhysicalAdmission => false;

    private NativeHostUserIntentV2(NativeHostBoundInputV2 bound, string runId, string nonce64)
    {
        Attempt = bound.Profile.Attempt;
        ProfileSha256 = bound.Profile.CanonicalSha256;
        SourceSetSha256 = bound.Profile.SourceSetSha256;
        PlanSha256 = bound.Plan.CanonicalSha256;
        ApprovalSha256 = bound.Approval.CanonicalSha256;
        HostSha256 = bound.Plan.HostSha256;
        BootSha256 = bound.Plan.BootSha256;
        ImageSha256 = bound.Plan.Image.Sha256;
        UserSid = bound.Profile.Role(NativeHostRole.User).PrincipalSid;
        RunId = runId;
        Nonce64 = nonce64;
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
        Need(canonical.Length is > 0 and <= MaximumBytes, "NATIVE_USER_INTENT_SIZE_REFUSED");
        CanonicalSha256 = NativeHostInputCodecV2.Hash(canonical);
    }

    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static void Need([DoesNotReturnIf(false)] bool okay, string code)
    {
        if (!okay) throw new InvalidDataException(code);
    }

    // `author` is a source-role assertion inside this pure model, not an OS
    // token check. An eventual controller must establish real Owner authority.
    internal static NativeHostUserIntentV2 CreateOwner(NativeHostBoundInputV2? bound,
        NativeHostRole author, string runId, string nonce64)
    {
        Need(author == NativeHostRole.Owner && bound is not null &&
            bound.Profile is not null && bound.Plan is not null && bound.Approval is not null,
            "NATIVE_USER_INTENT_OWNER_OR_SCOPE_REFUSED");
        Need(LowerHex(runId, 32) && LowerHex(nonce64, 64),
            "NATIVE_USER_INTENT_RUN_NONCE_REFUSED");

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
            plan.Attempt == profile.Attempt && plan.ProfileSha256 == profile.CanonicalSha256 &&
            plan.SourceSetSha256 == profile.SourceSetSha256 &&
            approval.PlanSha256 == plan.CanonicalSha256 &&
            profile.Role(NativeHostRole.User).PrincipalSid == NativeHostProfileV2.UserSid &&
            NativeHostProfileV2.Image == @"C:\ProgramData\Ecs.Lic008.StandardNativeHostV1\bin\StandardControlHost.exe" &&
            plan.Image.Size > 0 && LowerHex(plan.Image.Sha256, 64) &&
            plan.IssuedUtc.Offset == TimeSpan.Zero && approval.IssuedUtc.Offset == TimeSpan.Zero &&
            plan.ExpiresUtc.Offset == TimeSpan.Zero && approval.ExpiresUtc.Offset == TimeSpan.Zero &&
            approval.IssuedUtc >= plan.IssuedUtc && approval.ExpiresUtc <= plan.ExpiresUtc &&
            approval.IssuedUtc < approval.ExpiresUtc,
            "NATIVE_USER_INTENT_BOUND_INPUT_REFUSED");
        return new NativeHostUserIntentV2(bound, runId, nonce64);
    }

    internal static NativeHostUserIntentV2 ParseOwnerOriginal(byte[]? original,
        NativeHostBoundInputV2 bound, NativeHostRole author)
    {
        Need(original is { Length: >= 2 and <= MaximumBytes },
            "NATIVE_USER_INTENT_ORIGINAL_SIZE_REFUSED");
        byte[] owned = (byte[])original.Clone();
        try {
            using JsonDocument document = JsonDocument.Parse(owned, new JsonDocumentOptions {
                MaxDepth = 4, AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object,
                "NATIVE_USER_INTENT_ORIGINAL_OBJECT_REFUSED");
            string runId = root.GetProperty("runId").GetString() ?? "";
            string nonce64 = root.GetProperty("nonce").GetString() ?? "";
            NativeHostUserIntentV2 expected = CreateOwner(bound, author, runId, nonce64);
            Need(owned.AsSpan().SequenceEqual(expected.canonical),
                "NATIVE_USER_INTENT_ORIGINAL_CANONICAL_REFUSED");
            return expected;
        } catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException) {
            throw new InvalidDataException("NATIVE_USER_INTENT_ORIGINAL_SHAPE_REFUSED", e);
        }
    }

    internal NativeHostUserIntentStoreReferenceV2 ProposedStoreReference() => new(
        StoreSlot, Attempt, ProfileSha256, SourceSetSha256, PlanSha256,
        ApprovalSha256, CanonicalSha256);
}

// A matching marker is only a proposed digest binding to fixed slot 41. It
// cannot prove CreateNew/flush/readback, author, original bytes or transport.
internal sealed record NativeHostUserIntentStoreReferenceV2(NativeHostStoreFileV2 Slot,
    string Attempt, string ProfileSha256, string SourceSetSha256,
    string PlanSha256, string ApprovalSha256, string EvidenceSha256);

internal sealed record NativeHostUserInvocationV2(NativeHostRole Role, NativeHostStage Stage,
    string Attempt, string PlanSha256, string ApprovalSha256, string SourceSetSha256,
    string RunId, string Nonce64);

// All fields are injected assertions about the original retained child and
// its queried primary token. A matching set of assertions is not native proof.
internal sealed record NativeHostUserHeldFactsV2(
    ulong HeldProcessObjectId, uint ProcessId, long CreationFileTimeUtc,
    string ImagePath, string ImageSha256,
    NativeHostUserInvocationV2? OriginalCreationInvocation,
    bool? OriginalProcessHeld, bool? Live,
    ulong PrimaryTokenObjectId, string PrimaryTokenId, string PrimaryModifiedId,
    bool? PrimaryTokenAssociated, bool? QueryComplete, string UserSid, string TokenOwnerSid,
    int? TokenType, int? Elevation, int? ElevationType, int? IntegrityRid,
    bool? InteractiveEnabled, bool? UsersEnabled, bool? AdministratorsAbsent,
    bool? GroupsComplete, bool? NotRestricted, bool? AppContainerAbsent,
    bool? NoThreadImpersonation);

internal interface INativeHostUserLaunchFactsV2
{
    // Future adapter must independently inspect the ORIGINAL held process and
    // its actual primary token, retain both objects, and return no self-report.
    NativeHostUserHeldFactsV2? Capture();
}

internal sealed record NativeHostUserLaunchMatchV2(string IntentSha256,
    uint ProcessId, long CreationFileTimeUtc, ulong HeldProcessObjectId,
    ulong PrimaryTokenObjectId)
{
    internal bool ClosedCorrelationMatched => true;
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalAdmission => false;
    internal bool BootstrapAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;
}

// One process-local attempt only. Unknown, mismatch, callback exception,
// concurrent entry and success all consume the instance. This is no durable
// cross-process replay registry and never issues a startup or GRANT decision.
internal sealed class NativeHostUserLaunchV2
{
    private readonly NativeHostBoundInputV2 bound;
    private readonly NativeHostUserIntentV2 intent;
    private readonly INativeHostUserLaunchFactsV2 facts;
    private readonly Func<DateTimeOffset> nowUtc;
    private DateTimeOffset? lastUtc;
    private int state;
    internal bool Consumed => Volatile.Read(ref state) == 2;
    internal bool PhysicalAdmission => false;

    internal NativeHostUserLaunchV2(NativeHostBoundInputV2 bound,
        NativeHostUserIntentV2 intent, INativeHostUserLaunchFactsV2 facts,
        Func<DateTimeOffset> nowUtc)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.intent = intent ?? throw new ArgumentNullException(nameof(intent));
        this.facts = facts ?? throw new ArgumentNullException(nameof(facts));
        this.nowUtc = nowUtc ?? throw new ArgumentNullException(nameof(nowUtc));
    }

    private static void Need([DoesNotReturnIf(false)] bool okay, string code)
    {
        if (!okay) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private void Window()
    {
        DateTimeOffset now = nowUtc();
        Need(now.Offset == TimeSpan.Zero &&
            Volatile.Read(ref state) == 1 &&
            (lastUtc is null || now >= lastUtc.Value) &&
            now >= bound.Plan.IssuedUtc && now < bound.Plan.ExpiresUtc &&
            now >= bound.Approval.IssuedUtc && now < bound.Approval.ExpiresUtc,
            "NATIVE_USER_LAUNCH_WINDOW_REFUSED");
        lastUtc = now;
    }

    private void ValidateFacts(NativeHostUserHeldFactsV2? held,
        NativeHostUserInvocationV2 invocation)
    {
        DateTimeOffset created;
        try { created = new DateTimeOffset(DateTime.FromFileTimeUtc(held?.CreationFileTimeUtc ?? 0)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_USER_LAUNCH_CREATION_TIME_REFUSED", e);
        }
        Need(held is not null && held.HeldProcessObjectId != 0 && held.ProcessId != 0 &&
            held.CreationFileTimeUtc > 0 && held.ImagePath == NativeHostProfileV2.Image &&
            created >= bound.Approval.IssuedUtc && lastUtc is not null && created <= lastUtc.Value &&
            held.ImageSha256 == intent.ImageSha256 &&
            held.OriginalCreationInvocation == invocation &&
            held.OriginalProcessHeld == true &&
            held.Live == true && held.PrimaryTokenObjectId != 0 &&
            held.PrimaryTokenObjectId != held.HeldProcessObjectId &&
            LowerHex(held.PrimaryTokenId, 16) && LowerHex(held.PrimaryModifiedId, 16) &&
            held.PrimaryTokenAssociated == true && held.QueryComplete == true &&
            held.UserSid == intent.UserSid && held.TokenOwnerSid == intent.UserSid &&
            held.TokenType == 1 &&
            held.Elevation == 0 && held.ElevationType == 1 &&
            held.IntegrityRid == 8192 && held.InteractiveEnabled == true &&
            held.UsersEnabled == true &&
            held.AdministratorsAbsent == true && held.GroupsComplete == true &&
            held.NotRestricted == true && held.AppContainerAbsent == true &&
            held.NoThreadImpersonation == true,
            "NATIVE_USER_LAUNCH_HELD_FACTS_REFUSED");
    }

    internal NativeHostUserLaunchMatchV2 Consume(NativeHostUserInvocationV2? invocation,
        NativeHostUserIntentStoreReferenceV2? proposedStoreReference)
    {
        if (Interlocked.CompareExchange(ref state, 1, 0) != 0) {
            Volatile.Write(ref state, 2);
            throw new InvalidDataException("NATIVE_USER_LAUNCH_REUSE_OR_REENTRY_REFUSED");
        }
        try {
            NativeHostUserIntentV2 checkedIntent = NativeHostUserIntentV2.ParseOwnerOriginal(
                intent.CanonicalBytes(), bound, NativeHostRole.Owner);
            Need(checkedIntent.CanonicalSha256 == intent.CanonicalSha256,
                "NATIVE_USER_LAUNCH_INTENT_CHANGED");
            Need(proposedStoreReference is not null &&
                proposedStoreReference == intent.ProposedStoreReference() &&
                proposedStoreReference.Slot == NativeHostStoreFileV2.StandardUserIntent &&
                NativeHostStageStoreV2.Relative(proposedStoreReference.Slot) ==
                    @"stage\standard-user-intent.json",
                "NATIVE_USER_LAUNCH_STORE_MARKER_REFUSED");
            Need(invocation is not null && invocation.Role == NativeHostRole.User &&
                invocation.Stage == NativeHostStage.StandardUser &&
                invocation.Attempt == intent.Attempt &&
                invocation.PlanSha256 == intent.PlanSha256 &&
                invocation.ApprovalSha256 == intent.ApprovalSha256 &&
                invocation.SourceSetSha256 == intent.SourceSetSha256 &&
                invocation.RunId == intent.RunId && invocation.Nonce64 == intent.Nonce64 &&
                LowerHex(invocation.RunId, 32) && LowerHex(invocation.Nonce64, 64),
                "NATIVE_USER_LAUNCH_INVOCATION_REFUSED");
            Window();
            NativeHostUserHeldFactsV2? first = facts.Capture();
            Need(Volatile.Read(ref state) == 1,
                "NATIVE_USER_LAUNCH_REENTRY_POISONED");
            ValidateFacts(first, invocation);
            Window();
            NativeHostUserHeldFactsV2? second = facts.Capture();
            Need(Volatile.Read(ref state) == 1,
                "NATIVE_USER_LAUNCH_REENTRY_POISONED");
            ValidateFacts(second, invocation);
            Need(first == second, "NATIVE_USER_LAUNCH_HELD_FACTS_CHANGED");
            Window();
            Need(Volatile.Read(ref state) == 1,
                "NATIVE_USER_LAUNCH_REENTRY_POISONED");
            var match = new NativeHostUserLaunchMatchV2(intent.CanonicalSha256,
                first!.ProcessId, first.CreationFileTimeUtc,
                first.HeldProcessObjectId, first.PrimaryTokenObjectId);
            Need(Interlocked.CompareExchange(ref state, 2, 1) == 1,
                "NATIVE_USER_LAUNCH_REENTRY_POISONED");
            return match;
        } finally {
            Volatile.Write(ref state, 2);
        }
    }
}
