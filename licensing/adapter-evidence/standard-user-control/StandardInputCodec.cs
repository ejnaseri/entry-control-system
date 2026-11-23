using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardPayloadPin(string Name, long Size, string Sha256);

// No plan/approval self-hash fields: hash each canonical original AFTER writing,
// then derive the complete execution scope. Serializing StandardCryptoScope
// directly as its own plan would introduce a circular PlanSha256 dependency.
internal sealed record StandardPlanCore(int SchemaVersion, string Purpose, string Attempt,
    DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc, string Root,
    string OwnerSid, string HostSha256, string BootSha256, string AccountName,
    string AccountSid, string AccountOwnedSha256, string AccountCompleteSha256,
    string SetupService, string SetupSid, string GuardianService, string GuardianSid,
    string KeyPrefix, string EffectProfile, string SourceSetSha256, string PackageSha256,
    string RuntimeSha256, string ImageSha256, IReadOnlyList<StandardPayloadPin>? Payload);

internal sealed record StandardApprovalCore(int SchemaVersion, string Purpose, string Attempt,
    string PlanSha256, DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc,
    string OwnerSid, string HostSha256, string BootSha256, string EffectProfile);

internal sealed record StandardBoundInput(StandardPlanCore Plan, StandardApprovalCore Approval,
    StandardCryptoScope Scope, string SourceSetSha256)
{
    // Parsing authenticates neither an owner nor a machine. Actual custody,
    // current owner/host/boot checks, one-use intent and local manual confirmation
    // remain separate obligations of the future controller.
    internal bool NativeAuthorized => false;
    internal string ConfirmationLine => "CONFIRM W03 " + Scope.Attempt + " " +
        Scope.PlanSha256 + " " + Scope.ApprovalSha256 + " " + StandardContract.UserSid;
}

internal static class StandardInputCodec
{
    internal const string PlanPurpose = "TEST_ONLY_STANDARD_USER_PLAN_V1";
    internal const string ApprovalPurpose = "TEST_ONLY_STANDARD_USER_APPROVAL_V1";
    internal const string Effects = "FRESH_SERVICES_TWO_KEYS_OWNED_ACCOUNT_LOGON_RETURN_DISABLED_RETAIN_V1";
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonSerializerOptions Json = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        MaxDepth = 8
    };

    internal static byte[] EncodePlan(StandardPlanCore plan) => JsonSerializer.SerializeToUtf8Bytes(plan, Json);
    internal static byte[] EncodeApproval(StandardApprovalCore approval) => JsonSerializer.SerializeToUtf8Bytes(approval, Json);

    private static void UniqueProperties(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object) {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject()) {
                StandardContract.Need(seen.Add(property.Name), "STANDARD_INPUT_DUPLICATE_PROPERTY");
                UniqueProperties(property.Value);
            }
        } else if (element.ValueKind == JsonValueKind.Array) {
            foreach (var item in element.EnumerateArray()) UniqueProperties(item);
        }
    }

    private static T Decode<T>(byte[]? supplied) where T : class
    {
        StandardContract.Need(supplied is not null && supplied.Length is >= 2 and <= 16384,
            "STANDARD_INPUT_LENGTH_REFUSED");
        // Own one bounded byte snapshot before parsing or comparing originals.
        byte[] bytes = (byte[])supplied.Clone();
        try {
            _ = Utf8.GetString(bytes); // Reject malformed UTF8 rather than replace it.
            StandardContract.Need(!(bytes.Length >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf),
                "STANDARD_INPUT_BOM_REFUSED");
            using var parsed = JsonDocument.Parse(bytes, new() {
                AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow, MaxDepth = 8 });
            StandardContract.Need(parsed.RootElement.ValueKind == JsonValueKind.Object, "STANDARD_INPUT_OBJECT_REQUIRED");
            UniqueProperties(parsed.RootElement);
            var value = JsonSerializer.Deserialize<T>(bytes, Json);
            StandardContract.Need(value is not null && bytes.AsSpan().SequenceEqual(JsonSerializer.SerializeToUtf8Bytes(value, Json)),
                "STANDARD_INPUT_NONCANONICAL_REFUSED");
            return value;
        } catch (JsonException) { throw new InvalidDataException("STANDARD_INPUT_JSON_REFUSED"); }
        catch (DecoderFallbackException) { throw new InvalidDataException("STANDARD_INPUT_UTF8_REFUSED"); }
    }

    private static bool Hash(string? value) => StandardLaunchPlan.LowerHex(value, 64);
    private static void Window(DateTimeOffset issued, DateTimeOffset expires, DateTimeOffset now)
    {
        StandardContract.Need(issued.Offset == TimeSpan.Zero && expires.Offset == TimeSpan.Zero &&
            now.Offset == TimeSpan.Zero && expires > issued && expires - issued <= TimeSpan.FromHours(2) &&
            now >= issued && now < expires, "STANDARD_INPUT_TIME_REFUSED");
    }

    internal static StandardBoundInput Bind(byte[] planOriginal, byte[] approvalOriginal, DateTimeOffset now)
    {
        // Clone inputs together so the derived hash and parsed object come from
        // the same originals even if the caller later changes its byte arrays.
        StandardContract.Need(planOriginal is not null && approvalOriginal is not null &&
            planOriginal.Length <= 16384 && approvalOriginal.Length <= 16384,
            "STANDARD_INPUT_LENGTH_REFUSED");
        byte[] planBytes = (byte[])planOriginal.Clone(), approvalBytes = (byte[])approvalOriginal.Clone();
        var plan = Decode<StandardPlanCore>(planBytes);
        var approval = Decode<StandardApprovalCore>(approvalBytes);
        Window(plan.IssuedUtc, plan.ExpiresUtc, now);
        Window(approval.IssuedUtc, approval.ExpiresUtc, now);
        StandardContract.Need(plan.SchemaVersion == 1 && plan.Purpose == PlanPurpose &&
            StandardLaunchPlan.LowerHex(plan.Attempt, 32) && plan.Root == StandardContract.Root &&
            plan.OwnerSid == StandardContract.OwnerSid && plan.AccountName == StandardContract.AccountName &&
            plan.AccountSid == StandardContract.UserSid && plan.AccountOwnedSha256 == StandardContract.AccountOwnedSha256 &&
            plan.AccountCompleteSha256 == StandardContract.AccountCompleteSha256 &&
            plan.SetupService == StandardContract.SetupService && plan.SetupSid == StandardCryptoComparison.SetupSid &&
            plan.GuardianService == StandardContract.GuardianService && plan.GuardianSid == StandardCryptoComparison.GuardianSid &&
            StandardCryptoComparison.DerivedServiceSid(plan.SetupService) == plan.SetupSid &&
            StandardCryptoComparison.DerivedServiceSid(plan.GuardianService) == plan.GuardianSid &&
            plan.KeyPrefix == StandardContract.KeyPrefix && plan.EffectProfile == Effects &&
            new[] { plan.HostSha256, plan.BootSha256, plan.SourceSetSha256, plan.PackageSha256,
                plan.RuntimeSha256, plan.ImageSha256 }.All(Hash), "STANDARD_INPUT_PLAN_BINDING_REFUSED");
        var payload = plan.Payload;
        StandardContract.Need(payload is not null && payload.Count == 2 &&
            payload[0] is not null && payload[1] is not null &&
            payload[0].Name == "StandardControl.dll" && payload[0].Size is > 0 and <= 4194304 && Hash(payload[0].Sha256) &&
            payload[1].Name == "StandardControl.runtimeconfig.json" && payload[1].Size is > 0 and <= 4096 && Hash(payload[1].Sha256),
            "STANDARD_INPUT_PAYLOAD_SET_REFUSED");
        string planHash = StandardNativeCryptoRules.Hash(planBytes), approvalHash = StandardNativeCryptoRules.Hash(approvalBytes);
        StandardContract.Need(approval.SchemaVersion == 1 && approval.Purpose == ApprovalPurpose &&
            approval.Attempt == plan.Attempt && approval.PlanSha256 == planHash &&
            approval.IssuedUtc >= plan.IssuedUtc && approval.ExpiresUtc <= plan.ExpiresUtc &&
            approval.OwnerSid == plan.OwnerSid && approval.HostSha256 == plan.HostSha256 &&
            approval.BootSha256 == plan.BootSha256 && approval.EffectProfile == Effects,
            "STANDARD_INPUT_APPROVAL_BINDING_REFUSED");
        var scope = new StandardCryptoScope(StandardCryptoComparison.Schema, plan.Root, plan.Attempt,
            approval.IssuedUtc, approval.ExpiresUtc, plan.AccountSid, plan.AccountOwnedSha256,
            plan.AccountCompleteSha256, plan.OwnerSid, planHash, approvalHash, plan.PackageSha256,
            plan.RuntimeSha256, plan.ImageSha256, payload[0].Sha256, plan.HostSha256, plan.BootSha256);
        return new(plan with { Payload = Array.AsReadOnly(payload.ToArray()) }, approval, scope, plan.SourceSetSha256);
    }
}
