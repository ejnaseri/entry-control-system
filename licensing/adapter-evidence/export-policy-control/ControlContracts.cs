using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Diagnostics.CodeAnalysis;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal enum ControlRole { Setup, Guardian }
internal enum ControlArm { Exportable, NonExportable }
internal sealed record ControlPins(string PlanSha256, string ApprovalSha256, string PackageSha256);
internal sealed record ControlPlan(int SchemaVersion, string Scope, string AttemptId, string OwnerSid,
    string AssemblySha256, string PackageSha256, string RuntimeInventorySha256,
    string HostSha256, string BootIdentity, DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc);
internal sealed record ControlReservation(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string ApprovalSha256, string PackageSha256, DateTimeOffset ReservedUtc);
internal sealed record ControlSession(ControlPlan Plan, ControlPins Pins, ControlReservation Reservation);
internal sealed record ControlConsumed(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string ApprovalSha256, string Role);
internal sealed record ControlIntent(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string Arm, string Name, int ExportPolicy);
internal sealed record ControlOwned(ControlIntent Intent, string PublicSha256, string DaclSha256);
internal sealed record ControlSetupComplete(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string ExportableOwnedSha256, string NonExportableOwnedSha256);
internal sealed record ControlRecovery(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string Arm, string Phase, string FailureKind, int ManagedHResult,
    bool OrphanPossible, bool AutomaticCleanupAllowed);

internal static class ControlRules
{
    internal const string Placement = "Ecs.Lic008.ExportPolicyControlV5";
    internal const string Root = @"C:\ProgramData\" + Placement;
    internal const string SetupService = Placement + ".Setup";
    internal const string SetupSid = "S-1-5-80-2529379509-1660257719-1247876742-1299507549-2916452335";
    internal const string GuardianService = "Ecs.Lic008.EntryEvidenceV2.Guardian";
    internal const string GuardianSid = "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315";
    internal const string SystemSid = "S-1-5-18", AdminSid = "S-1-5-32-544";
    internal const string Scope = "TEST_ONLY_EXPORT_POLICY_CONTROL_V5";
    internal static readonly JsonSerializerOptions Json = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        MaxDepth = 16
    };
    internal static void Need([DoesNotReturnIf(false)] bool valid, string reason)
    { if (!valid) throw new InvalidDataException(reason); }
    internal static bool Hex(string? value, int length) => value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    internal static string Hash(byte[] value) => Convert.ToHexString(SHA256.HashData(value)).ToLowerInvariant();
    internal static byte[] Serialize<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, Json);
    internal static T Parse<T>(byte[] bytes)
    {
        Need(bytes is { Length: > 0 and <= 2097152 }, "CONTROL_JSON_SIZE_REFUSED");
        // Canonical reserialization rejects unknown, duplicate, omitted and reordered properties.
        var value = JsonSerializer.Deserialize<T>(bytes, Json);
        Need(value is not null && bytes.SequenceEqual(Serialize(value)), "CONTROL_JSON_CANONICAL_REFUSED");
        return value;
    }
    internal static string Arm(ControlArm arm) => arm switch {
        ControlArm.Exportable => "exportable", ControlArm.NonExportable => "nonexportable",
        _ => throw new InvalidDataException("CONTROL_ARM_REFUSED")
    };
    internal static int Policy(ControlArm arm) => arm switch {
        ControlArm.Exportable => 3, ControlArm.NonExportable => 0,
        _ => throw new InvalidDataException("CONTROL_ARM_REFUSED")
    };
    internal static string Role(ControlRole role) => role switch {
        ControlRole.Setup => "Setup", ControlRole.Guardian => "Guardian",
        _ => throw new InvalidDataException("CONTROL_ROLE_REFUSED")
    };
    internal static void ValidatePins(ControlPins pins) => Need(pins is not null &&
        Hex(pins.PlanSha256, 64) && Hex(pins.ApprovalSha256, 64) && Hex(pins.PackageSha256, 64), "CONTROL_PINS_REFUSED");
    internal static void ValidateSession(ControlSession session, DateTimeOffset now)
    {
        Need(session is not null && session.Plan is not null && session.Reservation is not null, "CONTROL_SESSION_REFUSED");
        ValidatePins(session.Pins);
        var p = session.Plan; var r = session.Reservation;
        Need(p.SchemaVersion == 1 && p.Scope == Scope && Hex(p.AttemptId, 32) &&
            p.OwnerSid is not null && System.Text.RegularExpressions.Regex.IsMatch(p.OwnerSid,
                @"\AS-1-5-21-[0-9]+-[0-9]+-[0-9]+-[0-9]+\z") &&
            Hex(p.AssemblySha256, 64) && Hex(p.RuntimeInventorySha256, 64) &&
            Hex(p.HostSha256, 64) && Hex(p.BootIdentity, 64) && p.PackageSha256 == session.Pins.PackageSha256 &&
            Hash(Serialize(p)) == session.Pins.PlanSha256 &&
            p.IssuedUtc != default && p.IssuedUtc.Offset == TimeSpan.Zero && p.ExpiresUtc.Offset == TimeSpan.Zero &&
            now.Offset == TimeSpan.Zero && p.IssuedUtc <= now && now < p.ExpiresUtc &&
            p.ExpiresUtc > p.IssuedUtc && p.ExpiresUtc - p.IssuedUtc <= TimeSpan.FromHours(4), "CONTROL_PLAN_REFUSED");
        Need(r.SchemaVersion == 1 && r.Scope == Scope && r.AttemptId == p.AttemptId &&
            r.PlanSha256 == session.Pins.PlanSha256 && r.ApprovalSha256 == session.Pins.ApprovalSha256 &&
            r.PackageSha256 == session.Pins.PackageSha256 && r.ReservedUtc.Offset == TimeSpan.Zero &&
            r.ReservedUtc >= p.IssuedUtc && r.ReservedUtc <= now, "CONTROL_RESERVATION_REFUSED");
    }
    internal static ControlIntent Intent(ControlSession s, ControlArm arm) => new(1, Scope,
        s.Plan.AttemptId, s.Pins.PlanSha256, Arm(arm), KeyNames.For(s.Plan.AttemptId, arm), Policy(arm));
    internal static void ValidateSnapshot(ControlSession session, ControlArm arm, KeySnapshot snapshot)
    {
        Need(snapshot is not null && snapshot.Name == KeyNames.For(session.Plan.AttemptId, arm) &&
            snapshot.Provider == MatchedExportProbe.Provider && snapshot.Algorithm == "RSA" && snapshot.KeyBits == 3072 &&
            snapshot.MachineKey && snapshot.Persisted && snapshot.Usage == 1 && snapshot.ExportPolicy == Policy(arm) &&
            snapshot.ProtectedDacl && Hex(snapshot.DaclSha256, 64) && Hex(snapshot.CreatedPublicIdentitySha256, 64) &&
            snapshot.CreatedPublicIdentitySha256 == snapshot.ReopenedPublicIdentitySha256, "CONTROL_KEY_SNAPSHOT_REFUSED");
    }
    internal static string FailureKind(Exception error) => error.InnerException is not null ? "WRAPPED_EXCEPTION" :
        error is CryptographicException ? "CRYPTOGRAPHIC" : error is InvalidDataException ? "VALIDATION" :
        error is UnauthorizedAccessException ? "ACCESS" : error is IOException ? "IO" : "OTHER";
}
