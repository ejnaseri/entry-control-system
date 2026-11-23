using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

// These are fixed slots under records/<attempt>. Neither a run nor a nonce
// selects a filesystem name. The order is a closed proposed W03 transcript;
// completing it is not evidence that any corresponding native effect happened.
internal enum NativeHostStoreFileV2 {
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
    StandardUserIntent, AccountActivationIntent, AccountActivated,
    StandardUserTransferIntent, StandardUserTransferLoans,
    StandardUserTransferSeed, StandardUserTransferReturned, StandardUserTransferComplete,
    StandardUserGrantIntent, StandardUserGrant, StandardUserReport, StandardUserAck,
    StandardUserHeldExit, AccountDisableIntent, AccountDisabled, StandardUserComplete,
    ServiceGuardianAfterStart, ServiceGuardianAfterAdmitted, GuardianAfterIntent,
    GuardianAfterGrantIntent, GuardianAfterGrant, GuardianAfterReport, GuardianAfterAck,
    GuardianAfterHeldExit, GuardianAfterComplete, ServiceGuardianAfterComplete,
    ControllerResult
}

internal sealed record NativeHostStoreScopeV2(string Attempt, string Root,
    string ProfileId, string ProfileSha256, string SourceSetSha256,
    string PlanSha256, string ApprovalSha256, string Effects,
    DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc);

// Every field below is a statement from the injected sink. A future native
// implementation must prove the actual identity, descriptor and flush itself.
internal sealed record NativeHostStoreReceiptV2(NativeHostStoreScopeV2 Scope,
    NativeHostStoreFileV2 File, string Path, string Sha256, int Length,
    DateTimeOffset WrittenUtc, uint VolumeSerial, ulong FileIndex,
    long CreationFileTimeUtc, bool CreateNew, bool ProtectedAcl,
    bool DurablyFlushed, bool ExactReadback);

internal sealed record NativeHostStoreAttemptV2(NativeHostStoreFileV2 File,
    string Path, string Sha256, int Length, bool WriteEntered,
    bool ReceiptAdmitted, bool ReadbackAdmitted);

internal sealed class NativeHostStoredOriginalV2
{
    private readonly byte[] original;
    internal NativeHostStoreFileV2 File { get; }
    internal NativeHostStoreReceiptV2 Receipt { get; }
    internal string Sha256 => Receipt.Sha256;
    internal byte[] OriginalBytes() => (byte[])original.Clone();
    internal NativeHostStoredOriginalV2(NativeHostStoreFileV2 file, byte[] original,
        NativeHostStoreReceiptV2 receipt)
    {
        File = file;
        this.original = (byte[])original.Clone();
        Receipt = receipt;
    }
}

internal interface INativeHostStoreSinkV2
{
    NativeHostStoreReceiptV2 CreateNew(string exactPath, byte[] original);
    byte[] ReadOriginal(string exactPath);
}

internal interface INativeHostStoreGuardV2
{
    void Verify(NativeHostStoreScopeV2 scope, NativeHostRole role, string point);
}

internal sealed class NativeHostStageStoreV2
{
    internal const string EventSchema = "TEST_ONLY_STANDARD_NATIVE_HOST_STAGE_RECORD_V2";
    internal const int MaximumEventBytes = 8192;
    private const int MaximumInputBytes = 4194304;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostStageStoreV2> Retained = new();
    private static readonly NativeHostStoreFileV2[] Ordered = Enum.GetValues<NativeHostStoreFileV2>();
    private readonly NativeHostBoundInputV2 bound;
    private readonly INativeHostStoreSinkV2 sink;
    private readonly INativeHostStoreGuardV2 guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly Dictionary<NativeHostStoreFileV2, NativeHostStoredOriginalV2> completed = new();
    private readonly Dictionary<NativeHostStoreFileV2, NativeHostStoreAttemptV2> attempts = new();
    private readonly Dictionary<NativeHostStage, (string Run, string Nonce)> runs = new();
    private readonly HashSet<string> usedRuns = new(StringComparer.Ordinal);
    private readonly HashSet<string> usedNonces = new(StringComparer.Ordinal);
    private DateTimeOffset? lastUtc;
    private int operation;
    private int faulted;
    private int completedCount;

    internal NativeHostStoreScopeV2 Scope { get; }
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;
    internal bool Faulted => Volatile.Read(ref faulted) != 0;
    internal int CompletedCount => Volatile.Read(ref completedCount);

    internal NativeHostStageStoreV2(NativeHostBoundInputV2 bound,
        INativeHostStoreSinkV2 sink, INativeHostStoreGuardV2 guard,
        Func<DateTimeOffset> utcNow)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.sink = sink ?? throw new ArgumentNullException(nameof(sink));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
        NativeHostProfileV2 profile = bound.Profile;
        NativeHostPlanV2 plan = bound.Plan;
        NativeHostApprovalV2 approval = bound.Approval;
        Need(profile is not null && plan is not null && approval is not null &&
            profile.Attempt == plan.Attempt && plan.ProfileSha256 == profile.CanonicalSha256 &&
            plan.SourceSetSha256 == profile.SourceSetSha256 &&
            approval.PlanSha256 == plan.CanonicalSha256 &&
            NativeHostProfileV2.ParseCanonical(profile.CanonicalBytes()).CanonicalSha256 == profile.CanonicalSha256 &&
            NativeHostInputCodecV2.ParsePlan(plan.CanonicalBytes(), profile).CanonicalSha256 == plan.CanonicalSha256 &&
            NativeHostInputCodecV2.ParseApproval(approval.CanonicalBytes(), plan).CanonicalSha256 == approval.CanonicalSha256,
            "NATIVE_STORE_BOUND_INPUT_REFUSED");
        DateTimeOffset issued = plan.IssuedUtc > approval.IssuedUtc ? plan.IssuedUtc : approval.IssuedUtc;
        DateTimeOffset expires = plan.ExpiresUtc < approval.ExpiresUtc ? plan.ExpiresUtc : approval.ExpiresUtc;
        Need(issued.Offset == TimeSpan.Zero && expires.Offset == TimeSpan.Zero &&
            expires > issued && expires - issued <= TimeSpan.FromHours(2),
            "NATIVE_STORE_WINDOW_REFUSED");
        Scope = new(profile.Attempt, profile.RecordRoot, NativeHostProfileV2.ProfileId,
            profile.CanonicalSha256, profile.SourceSetSha256, plan.CanonicalSha256,
            approval.CanonicalSha256, NativeHostProfileV2.Effects, issued, expires);
        Need(Ordered.Length == 68 && Ordered.Select((f, i) => (int)f == i).All(x => x),
            "NATIVE_STORE_ENUM_CHANGED");
    }

    internal static string Relative(NativeHostStoreFileV2 file) => file switch {
        NativeHostStoreFileV2.AttemptConsumed => @"journal\attempt-consumed.json",
        NativeHostStoreFileV2.Profile => @"input\profile.json",
        NativeHostStoreFileV2.SourceSet => @"input\source-set.json",
        NativeHostStoreFileV2.RuntimeInventory => @"input\runtime-inventory.json",
        NativeHostStoreFileV2.PackageManifest => @"input\package-manifest.json",
        NativeHostStoreFileV2.AccountOwned => @"input\account-owned.json",
        NativeHostStoreFileV2.AccountComplete => @"input\account-complete.json",
        NativeHostStoreFileV2.Plan => @"input\plan.json",
        NativeHostStoreFileV2.Approval => @"input\approval.json",
        NativeHostStoreFileV2.ServiceSetupIntent => @"journal\setup-service-intent.json",
        NativeHostStoreFileV2.ServiceSetupOwned => @"journal\setup-service-owned.json",
        NativeHostStoreFileV2.ServiceSetupComplete => @"journal\setup-service-complete.json",
        NativeHostStoreFileV2.ServiceGuardianIntent => @"journal\guardian-service-intent.json",
        NativeHostStoreFileV2.ServiceGuardianOwned => @"journal\guardian-service-owned.json",
        NativeHostStoreFileV2.ServiceGuardianComplete => @"journal\guardian-service-complete.json",
        NativeHostStoreFileV2.ServiceSetupStart => @"journal\setup-run-start.json",
        NativeHostStoreFileV2.ServiceSetupAdmitted => @"journal\setup-run-admitted.json",
        NativeHostStoreFileV2.SetupIntent => @"stage\setup-intent.json",
        NativeHostStoreFileV2.RestrictedKeyIntent => @"journal\restricted-key-intent.json",
        NativeHostStoreFileV2.RestrictedKeyOwned => @"journal\restricted-key-owned.json",
        NativeHostStoreFileV2.RestrictedKeyComplete => @"journal\restricted-key-complete.json",
        NativeHostStoreFileV2.AccessibleKeyIntent => @"journal\accessible-key-intent.json",
        NativeHostStoreFileV2.AccessibleKeyOwned => @"journal\accessible-key-owned.json",
        NativeHostStoreFileV2.AccessibleKeyComplete => @"journal\accessible-key-complete.json",
        NativeHostStoreFileV2.SetupGrantIntent => @"stage\setup-grant-intent.json",
        NativeHostStoreFileV2.SetupGrant => @"stage\setup-grant.json",
        NativeHostStoreFileV2.SetupReport => @"report\setup.json",
        NativeHostStoreFileV2.SetupAck => @"stage\setup-ack.json",
        NativeHostStoreFileV2.SetupHeldExit => @"stage\setup-held-exit.json",
        NativeHostStoreFileV2.SetupComplete => @"stage\setup-complete.json",
        NativeHostStoreFileV2.ServiceSetupRunComplete => @"journal\setup-run-complete.json",
        NativeHostStoreFileV2.ServiceGuardianBeforeStart => @"journal\guardian-before-run-start.json",
        NativeHostStoreFileV2.ServiceGuardianBeforeAdmitted => @"journal\guardian-before-run-admitted.json",
        NativeHostStoreFileV2.GuardianBeforeIntent => @"stage\guardian-before-intent.json",
        NativeHostStoreFileV2.GuardianBeforeGrantIntent => @"stage\guardian-before-grant-intent.json",
        NativeHostStoreFileV2.GuardianBeforeGrant => @"stage\guardian-before-grant.json",
        NativeHostStoreFileV2.GuardianBeforeReport => @"report\guardian-before.json",
        NativeHostStoreFileV2.GuardianBeforeAck => @"stage\guardian-before-ack.json",
        NativeHostStoreFileV2.GuardianBeforeHeldExit => @"stage\guardian-before-held-exit.json",
        NativeHostStoreFileV2.GuardianBeforeComplete => @"stage\guardian-before-complete.json",
        NativeHostStoreFileV2.ServiceGuardianBeforeComplete => @"journal\guardian-before-run-complete.json",
        NativeHostStoreFileV2.StandardUserIntent => @"stage\standard-user-intent.json",
        NativeHostStoreFileV2.AccountActivationIntent => @"journal\account-activation-intent.json",
        NativeHostStoreFileV2.AccountActivated => @"journal\account-activated.json",
        NativeHostStoreFileV2.StandardUserTransferIntent => @"stage\standard-user-transfer-intent.json",
        NativeHostStoreFileV2.StandardUserTransferLoans => @"stage\standard-user-transfer-loans.json",
        NativeHostStoreFileV2.StandardUserTransferSeed => @"stage\standard-user-transfer-seed.json",
        NativeHostStoreFileV2.StandardUserTransferReturned => @"stage\standard-user-transfer-returned.json",
        NativeHostStoreFileV2.StandardUserTransferComplete => @"stage\standard-user-transfer-complete.json",
        NativeHostStoreFileV2.StandardUserGrantIntent => @"stage\standard-user-grant-intent.json",
        NativeHostStoreFileV2.StandardUserGrant => @"stage\standard-user-grant.json",
        NativeHostStoreFileV2.StandardUserReport => @"report\standard-user.json",
        NativeHostStoreFileV2.StandardUserAck => @"stage\standard-user-ack.json",
        NativeHostStoreFileV2.StandardUserHeldExit => @"stage\standard-user-held-exit.json",
        NativeHostStoreFileV2.AccountDisableIntent => @"journal\account-disable-intent.json",
        NativeHostStoreFileV2.AccountDisabled => @"journal\account-disabled.json",
        NativeHostStoreFileV2.StandardUserComplete => @"stage\standard-user-complete.json",
        NativeHostStoreFileV2.ServiceGuardianAfterStart => @"journal\guardian-after-run-start.json",
        NativeHostStoreFileV2.ServiceGuardianAfterAdmitted => @"journal\guardian-after-run-admitted.json",
        NativeHostStoreFileV2.GuardianAfterIntent => @"stage\guardian-after-intent.json",
        NativeHostStoreFileV2.GuardianAfterGrantIntent => @"stage\guardian-after-grant-intent.json",
        NativeHostStoreFileV2.GuardianAfterGrant => @"stage\guardian-after-grant.json",
        NativeHostStoreFileV2.GuardianAfterReport => @"report\guardian-after.json",
        NativeHostStoreFileV2.GuardianAfterAck => @"stage\guardian-after-ack.json",
        NativeHostStoreFileV2.GuardianAfterHeldExit => @"stage\guardian-after-held-exit.json",
        NativeHostStoreFileV2.GuardianAfterComplete => @"stage\guardian-after-complete.json",
        NativeHostStoreFileV2.ServiceGuardianAfterComplete => @"journal\guardian-after-run-complete.json",
        NativeHostStoreFileV2.ControllerResult => @"report\controller-result.json",
        _ => throw new InvalidDataException("NATIVE_STORE_UNKNOWN_FILE")
    };

    internal string PathOf(NativeHostStoreFileV2 file) => Scope.Root + @"\" + Relative(file);
    internal static bool IsInput(NativeHostStoreFileV2 file) {
        _ = Relative(file);
        return file is NativeHostStoreFileV2.Profile or NativeHostStoreFileV2.SourceSet or
            NativeHostStoreFileV2.RuntimeInventory or NativeHostStoreFileV2.PackageManifest or
            NativeHostStoreFileV2.AccountOwned or NativeHostStoreFileV2.AccountComplete or
            NativeHostStoreFileV2.Plan or NativeHostStoreFileV2.Approval;
    }
    internal static bool CanWrite(NativeHostRole role, NativeHostStoreFileV2 file)
    {
        _ = Relative(file);
        return role switch {
            NativeHostRole.Owner => file is not (NativeHostStoreFileV2.RestrictedKeyIntent or
                NativeHostStoreFileV2.RestrictedKeyOwned or NativeHostStoreFileV2.RestrictedKeyComplete or
                NativeHostStoreFileV2.AccessibleKeyIntent or NativeHostStoreFileV2.AccessibleKeyOwned or
                NativeHostStoreFileV2.AccessibleKeyComplete),
            NativeHostRole.Setup => file is NativeHostStoreFileV2.RestrictedKeyIntent or
                NativeHostStoreFileV2.RestrictedKeyOwned or NativeHostStoreFileV2.RestrictedKeyComplete or
                NativeHostStoreFileV2.AccessibleKeyIntent or NativeHostStoreFileV2.AccessibleKeyOwned or
                NativeHostStoreFileV2.AccessibleKeyComplete,
            NativeHostRole.User or NativeHostRole.Guardian => false,
            _ => throw new InvalidDataException("NATIVE_STORE_UNKNOWN_ROLE")
        };
    }

    private static NativeHostStage? Stage(NativeHostStoreFileV2 file) => file switch {
        NativeHostStoreFileV2.ServiceSetupStart or NativeHostStoreFileV2.ServiceSetupAdmitted or
        NativeHostStoreFileV2.SetupIntent or NativeHostStoreFileV2.RestrictedKeyIntent or
        NativeHostStoreFileV2.RestrictedKeyOwned or NativeHostStoreFileV2.RestrictedKeyComplete or
        NativeHostStoreFileV2.AccessibleKeyIntent or NativeHostStoreFileV2.AccessibleKeyOwned or
        NativeHostStoreFileV2.AccessibleKeyComplete or NativeHostStoreFileV2.SetupGrantIntent or
        NativeHostStoreFileV2.SetupGrant or NativeHostStoreFileV2.SetupReport or
        NativeHostStoreFileV2.SetupAck or NativeHostStoreFileV2.SetupHeldExit or
        NativeHostStoreFileV2.SetupComplete or
        NativeHostStoreFileV2.ServiceSetupRunComplete => NativeHostStage.Setup,
        NativeHostStoreFileV2.ServiceGuardianBeforeStart or NativeHostStoreFileV2.ServiceGuardianBeforeAdmitted or
        NativeHostStoreFileV2.GuardianBeforeIntent or NativeHostStoreFileV2.GuardianBeforeGrantIntent or
        NativeHostStoreFileV2.GuardianBeforeGrant or NativeHostStoreFileV2.GuardianBeforeReport or
        NativeHostStoreFileV2.GuardianBeforeAck or NativeHostStoreFileV2.GuardianBeforeHeldExit or
        NativeHostStoreFileV2.GuardianBeforeComplete or
        NativeHostStoreFileV2.ServiceGuardianBeforeComplete => NativeHostStage.GuardianBefore,
        NativeHostStoreFileV2.StandardUserIntent or NativeHostStoreFileV2.AccountActivationIntent or
        NativeHostStoreFileV2.AccountActivated or NativeHostStoreFileV2.StandardUserTransferIntent or
        NativeHostStoreFileV2.StandardUserTransferLoans or NativeHostStoreFileV2.StandardUserTransferSeed or
        NativeHostStoreFileV2.StandardUserTransferReturned or NativeHostStoreFileV2.StandardUserTransferComplete or
        NativeHostStoreFileV2.StandardUserGrantIntent or NativeHostStoreFileV2.StandardUserGrant or
        NativeHostStoreFileV2.StandardUserReport or NativeHostStoreFileV2.StandardUserAck or
        NativeHostStoreFileV2.StandardUserHeldExit or NativeHostStoreFileV2.AccountDisableIntent or
        NativeHostStoreFileV2.AccountDisabled or
        NativeHostStoreFileV2.StandardUserComplete => NativeHostStage.StandardUser,
        NativeHostStoreFileV2.ServiceGuardianAfterStart or NativeHostStoreFileV2.ServiceGuardianAfterAdmitted or
        NativeHostStoreFileV2.GuardianAfterIntent or NativeHostStoreFileV2.GuardianAfterGrantIntent or
        NativeHostStoreFileV2.GuardianAfterGrant or NativeHostStoreFileV2.GuardianAfterReport or
        NativeHostStoreFileV2.GuardianAfterAck or NativeHostStoreFileV2.GuardianAfterHeldExit or
        NativeHostStoreFileV2.GuardianAfterComplete or
        NativeHostStoreFileV2.ServiceGuardianAfterComplete => NativeHostStage.GuardianAfter,
        _ => null
    };

    private static bool LowerHex(string? value, int length) => value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static void Need([DoesNotReturnIf(false)] bool condition, string code) {
        if (!condition) throw new InvalidDataException(code);
    }
    private DateTimeOffset Time()
    {
        DateTimeOffset now = utcNow();
        Need(now.Offset == TimeSpan.Zero && now >= Scope.IssuedUtc && now < Scope.ExpiresUtc &&
            (lastUtc is null || now >= lastUtc.Value), "NATIVE_STORE_CLOCK_REFUSED");
        lastUtc = now;
        return now;
    }
    private void Guard(NativeHostRole role, string point)
    {
        _ = Time();
        guard.Verify(Scope, role, point);
        Need(!Faulted, "NATIVE_STORE_REENTRY_POISONED");
        _ = Time();
    }
    private void Enter()
    {
        if (Interlocked.CompareExchange(ref operation, 1, 0) != 0) {
            Volatile.Write(ref faulted, 1);
            throw new InvalidDataException("NATIVE_STORE_REENTRY_REFUSED");
        }
        if (Faulted) {
            Volatile.Write(ref operation, 0);
            throw new InvalidDataException("NATIVE_STORE_CONSUMED");
        }
    }

    private byte[] InputBytes(NativeHostStoreFileV2 file, byte[]? supplied)
    {
        Need(supplied is { Length: >= 2 } && supplied.Length <= MaximumInputBytes,
            "NATIVE_STORE_INPUT_SIZE_REFUSED");
        byte[] raw = (byte[])supplied.Clone();
        string expected = file switch {
            NativeHostStoreFileV2.Profile => Scope.ProfileSha256,
            NativeHostStoreFileV2.SourceSet => Scope.SourceSetSha256,
            NativeHostStoreFileV2.RuntimeInventory => bound.Plan.RuntimeInventorySha256,
            NativeHostStoreFileV2.PackageManifest => bound.Plan.PackageManifestSha256,
            NativeHostStoreFileV2.AccountOwned => NativeHostProfileV2.AccountOwnedSha256,
            NativeHostStoreFileV2.AccountComplete => NativeHostProfileV2.AccountCompleteSha256,
            NativeHostStoreFileV2.Plan => Scope.PlanSha256,
            NativeHostStoreFileV2.Approval => Scope.ApprovalSha256,
            _ => throw new InvalidDataException("NATIVE_STORE_INPUT_SLOT_REFUSED")
        };
        Need(Hash(raw) == expected, "NATIVE_STORE_INPUT_HASH_REFUSED");
        if (file is NativeHostStoreFileV2.Profile or NativeHostStoreFileV2.Plan or NativeHostStoreFileV2.Approval) {
            byte[] pinned = file switch {
                NativeHostStoreFileV2.Profile => bound.Profile.CanonicalBytes(),
                NativeHostStoreFileV2.Plan => bound.Plan.CanonicalBytes(),
                _ => bound.Approval.CanonicalBytes()
            };
            Need(raw.AsSpan().SequenceEqual(pinned), "NATIVE_STORE_INPUT_ORIGINAL_REFUSED");
        } else if (file is not (NativeHostStoreFileV2.AccountOwned or NativeHostStoreFileV2.AccountComplete)) {
            // The historical account originals have fixed archived byte hashes
            // and their original escaping is not this writer's JSON encoding.
            // Preserve those exact originals; do not normalize or reserialize.
            RequireCanonicalJson(raw);
            if (file == NativeHostStoreFileV2.RuntimeInventory)
                Need(NativeHostInputCodecV2.ParseRuntimeInventory(raw, bound.Profile)
                    .SequenceEqual(bound.Plan.FrameworkInventory), "NATIVE_STORE_RUNTIME_INVENTORY_REFUSED");
        }
        return raw;
    }

    private static void RequireCanonicalJson(byte[] raw)
    {
        Need(raw.Length <= MaximumInputBytes && !(raw.Length >= 3 && raw[0] == 0xef &&
            raw[1] == 0xbb && raw[2] == 0xbf), "NATIVE_STORE_JSON_BOM_OR_SIZE_REFUSED");
        string decoded;
        try { decoded = StrictUtf8.GetString(raw); }
        catch (DecoderFallbackException e) { throw new InvalidDataException("NATIVE_STORE_UTF8_REFUSED", e); }
        Need(decoded.IndexOf('\uFEFF') < 0 && decoded.IndexOf('\0') < 0 &&
            StrictUtf8.GetBytes(decoded).AsSpan().SequenceEqual(raw), "NATIVE_STORE_UTF8_REFUSED");
        try {
            using JsonDocument doc = JsonDocument.Parse(raw, new JsonDocumentOptions {
                MaxDepth = 32, AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
            Need(doc.RootElement.ValueKind is JsonValueKind.Object or JsonValueKind.Array,
                "NATIVE_STORE_JSON_ROOT_REFUSED");
            using var buffer = new MemoryStream();
            int fields = 0;
            using (var writer = new Utf8JsonWriter(buffer)) WriteJson(writer, doc.RootElement, 0, ref fields);
            Need(raw.AsSpan().SequenceEqual(buffer.ToArray()), "NATIVE_STORE_JSON_CANONICAL_REFUSED");
        } catch (JsonException e) { throw new InvalidDataException("NATIVE_STORE_JSON_REFUSED", e); }
    }
    private static void WriteJson(Utf8JsonWriter writer, JsonElement value, int depth, ref int fields)
    {
        Need(depth <= 32, "NATIVE_STORE_JSON_DEPTH_REFUSED");
        switch (value.ValueKind) {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (JsonProperty p in value.EnumerateObject()) {
                    Need(p.Name.Length is >= 1 and <= 256 && ++fields <= 4096 && seen.Add(p.Name),
                        "NATIVE_STORE_JSON_PROPERTY_REFUSED");
                    writer.WritePropertyName(p.Name);
                    WriteJson(writer, p.Value, depth + 1, ref fields);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (JsonElement child in value.EnumerateArray()) WriteJson(writer, child, depth + 1, ref fields);
                writer.WriteEndArray();
                break;
            case JsonValueKind.String: writer.WriteStringValue(value.GetString()); break;
            case JsonValueKind.Number:
                if (value.TryGetInt64(out long integer)) writer.WriteNumberValue(integer);
                else if (value.TryGetDecimal(out decimal number)) writer.WriteNumberValue(number);
                else throw new InvalidDataException("NATIVE_STORE_JSON_NUMBER_REFUSED");
                break;
            case JsonValueKind.True: writer.WriteBooleanValue(true); break;
            case JsonValueKind.False: writer.WriteBooleanValue(false); break;
            case JsonValueKind.Null: writer.WriteNullValue(); break;
            default: throw new InvalidDataException("NATIVE_STORE_JSON_VALUE_REFUSED");
        }
    }

    private byte[] EventBytes(NativeHostStoreFileV2 file, string evidenceSha,
        string run, string nonce, string previousSha, DateTimeOffset writtenUtc)
    {
        Need(LowerHex(evidenceSha, 64), "NATIVE_STORE_EVIDENCE_HASH_REFUSED");
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer)) {
            w.WriteStartObject();
            w.WriteString("schema", EventSchema);
            w.WriteString("profileId", Scope.ProfileId);
            w.WriteString("effects", Scope.Effects);
            w.WriteString("attempt", Scope.Attempt);
            w.WriteString("slot", file.ToString());
            w.WriteString("path", PathOf(file));
            w.WriteString("profileSha256", Scope.ProfileSha256);
            w.WriteString("sourceSetSha256", Scope.SourceSetSha256);
            w.WriteString("planSha256", Scope.PlanSha256);
            w.WriteString("approvalSha256", Scope.ApprovalSha256);
            w.WriteString("run", run);
            w.WriteString("nonce", nonce);
            w.WriteString("previousSha256", previousSha);
            w.WriteString("evidenceSha256", evidenceSha);
            w.WriteString("writtenUtc", writtenUtc);
            w.WriteBoolean("nativeEvidenceEstablished", false);
            w.WriteBoolean("physicalDurabilityProven", false);
            w.WriteBoolean("grantAuthorized", false);
            w.WriteBoolean("lic008Closed", false);
            w.WriteEndObject();
        }
        byte[] raw = buffer.ToArray();
        Need(raw.Length is > 0 and <= MaximumEventBytes, "NATIVE_STORE_EVENT_SIZE_REFUSED");
        return raw;
    }

    private void BindRun(NativeHostStoreFileV2 file, string run, string nonce)
    {
        NativeHostStage? stage = Stage(file);
        if (stage is null) {
            Need(run.Length == 0 && nonce.Length == 0, "NATIVE_STORE_UNEXPECTED_RUN_REFUSED");
            return;
        }
        Need(LowerHex(run, 32) && LowerHex(nonce, 64), "NATIVE_STORE_RUN_NONCE_REFUSED");
        if (runs.TryGetValue(stage.Value, out var known)) {
            Need(known.Run == run && known.Nonce == nonce, "NATIVE_STORE_RUN_NONCE_CHANGED");
        } else {
            Need(!usedRuns.Contains(run) && !usedNonces.Contains(nonce), "NATIVE_STORE_RUN_NONCE_REUSE");
            runs.Add(stage.Value, (run, nonce));
            usedRuns.Add(run); usedNonces.Add(nonce);
        }
    }

    private void VerifyReceipt(NativeHostStoreFileV2 file, string path, byte[] raw,
        DateTimeOffset recordUtc, NativeHostStoreReceiptV2? receipt)
    {
        DateTimeOffset now = Time();
        Need(receipt is not null && receipt.Scope == Scope && receipt.File == file &&
            receipt.Path == path && receipt.Sha256 == Hash(raw) && receipt.Length == raw.Length &&
            receipt.WrittenUtc.Offset == TimeSpan.Zero && receipt.WrittenUtc >= recordUtc &&
            receipt.WrittenUtc <= now && receipt.VolumeSerial != 0 && receipt.FileIndex != 0 &&
            receipt.CreateNew && receipt.ProtectedAcl && receipt.DurablyFlushed && receipt.ExactReadback,
            "NATIVE_STORE_RECEIPT_REFUSED");
        DateTimeOffset creation;
        try { creation = new DateTimeOffset(DateTime.FromFileTimeUtc(receipt.CreationFileTimeUtc)); }
        catch (ArgumentOutOfRangeException e) { throw new InvalidDataException("NATIVE_STORE_CREATION_TIME_REFUSED", e); }
        Need(creation >= recordUtc && creation <= receipt.WrittenUtc &&
            !completed.Values.Any(x => x.Receipt.VolumeSerial == receipt.VolumeSerial &&
                x.Receipt.FileIndex == receipt.FileIndex), "NATIVE_STORE_FILE_IDENTITY_REFUSED");
    }

    private static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    // Input writes retain their exact supplied bytes. Event writes construct a
    // canonical, scope-bound marker containing only a digest of external facts.
    // That marker never verifies the facts and cannot serve as GRANT authority.
    internal NativeHostStoredOriginalV2 WriteNew(NativeHostRole role, NativeHostStoreFileV2 file,
        byte[]? inputOriginal, string evidenceSha256, string run, string nonce,
        string expectedPreviousSha256)
    {
        Enter();
        try {
            Need(CanWrite(role, file), "NATIVE_STORE_ROLE_REFUSED");
            Need(completed.Count < Ordered.Length && file == Ordered[completed.Count] &&
                !attempts.ContainsKey(file), "NATIVE_STORE_ORDER_OR_CONSUMPTION_REFUSED");
            Guard(role, "BEFORE_PREDECESSOR");
            string previousSha = "";
            if (completed.Count > 0) {
                NativeHostStoredOriginalV2 predecessor = completed[Ordered[completed.Count - 1]];
                previousSha = predecessor.Sha256;
                Guard(role, "BEFORE_PREDECESSOR_READ");
                byte[] observedPrevious = sink.ReadOriginal(PathOf(predecessor.File));
                Guard(role, "AFTER_PREDECESSOR_READ");
                Need(observedPrevious is not null &&
                    observedPrevious.AsSpan().SequenceEqual(predecessor.OriginalBytes()),
                    "NATIVE_STORE_PREDECESSOR_CHANGED");
            }
            Need(expectedPreviousSha256 == previousSha, "NATIVE_STORE_PREDECESSOR_HASH_REFUSED");
            BindRun(file, run, nonce);
            DateTimeOffset recordUtc = Time();
            byte[] raw;
            if (IsInput(file)) {
                Need(evidenceSha256.Length == 0, "NATIVE_STORE_INPUT_EVIDENCE_REFUSED");
                raw = InputBytes(file, inputOriginal);
            } else {
                Need(inputOriginal is null, "NATIVE_STORE_EVENT_INPUT_REFUSED");
                raw = EventBytes(file, evidenceSha256, run, nonce, previousSha, recordUtc);
            }
            string sha = Hash(raw), path = PathOf(file);
            attempts.Add(file, new(file, path, sha, raw.Length, false, false, false));
            lock (RetainedGate) Retained.Add(this); // before a possibly unknown backing effect
            Guard(role, "IMMEDIATELY_BEFORE_CREATE_NEW");
            attempts[file] = attempts[file] with { WriteEntered = true };
            NativeHostStoreReceiptV2 receipt = sink.CreateNew(path, (byte[])raw.Clone());
            Guard(role, "AFTER_CREATE_NEW");
            VerifyReceipt(file, path, raw, recordUtc, receipt);
            attempts[file] = attempts[file] with { ReceiptAdmitted = true };
            Guard(role, "BEFORE_READBACK");
            byte[] observed = sink.ReadOriginal(path);
            Guard(role, "AFTER_READBACK");
            Need(observed is not null && observed.AsSpan().SequenceEqual(raw),
                "NATIVE_STORE_READBACK_CHANGED");
            var stored = new NativeHostStoredOriginalV2(file, raw, receipt);
            completed.Add(file, stored);
            Volatile.Write(ref completedCount, completed.Count);
            attempts[file] = attempts[file] with { ReadbackAdmitted = true };
            return new NativeHostStoredOriginalV2(file, raw, receipt);
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally { Volatile.Write(ref operation, 0); }
    }

    internal byte[] ReadCompleted(NativeHostRole role, NativeHostStoreFileV2 file)
    {
        Enter();
        try {
            Need(CanRead(role, file), "NATIVE_STORE_READ_ROLE_REFUSED");
            Need(completed.TryGetValue(file, out NativeHostStoredOriginalV2? original),
                "NATIVE_STORE_READ_SLOT_REFUSED");
            Guard(role, "BEFORE_READ_COMPLETED");
            byte[] observed = sink.ReadOriginal(PathOf(file));
            Guard(role, "AFTER_READ_COMPLETED");
            Need(observed is not null && observed.AsSpan().SequenceEqual(original.OriginalBytes()),
                "NATIVE_STORE_COMPLETED_CHANGED");
            return (byte[])observed.Clone();
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally { Volatile.Write(ref operation, 0); }
    }

    private static bool CanRead(NativeHostRole role, NativeHostStoreFileV2 file)
    {
        _ = Relative(file);
        return role switch {
            NativeHostRole.Owner => true,
            NativeHostRole.Setup => IsInput(file) || CanWrite(role, file),
            NativeHostRole.User or NativeHostRole.Guardian => IsInput(file),
            _ => throw new InvalidDataException("NATIVE_STORE_UNKNOWN_ROLE")
        };
    }

    // Never inspect while an injected synchronous callback is still pending.
    // A caller imposing its own timeout must retain that entire operation.
    internal NativeHostStoreAttemptV2[] Evidence()
    {
        Need(Interlocked.CompareExchange(ref operation, 1, 0) == 0,
            "NATIVE_STORE_PENDING_EVIDENCE_REFUSED");
        try { return Ordered.Where(attempts.ContainsKey).Select(x => attempts[x]).ToArray(); }
        finally { Volatile.Write(ref operation, 0); }
    }
}
