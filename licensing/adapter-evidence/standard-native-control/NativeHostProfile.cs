using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal enum NativeHostRole { Owner = 1, User = 2, Setup = 3, Guardian = 4 }
internal enum NativeHostStage { Setup = 1, GuardianBefore = 2, StandardUser = 3, GuardianAfter = 4 }

internal sealed record NativeHostRoleBinding(string Name, string Scratch, string PrincipalSid,
    string ServiceName, string ServiceSid);

// A frozen description of the proposed placement. Its bytes and digest are
// identifiers only: they do not admit a process, key, service, module or GRANT.
// The full V2 approval, actual file custody and token association are separate.
internal sealed class NativeHostProfileV2
{
    internal const string Schema = "TEST_ONLY_STANDARD_NATIVE_HOST_PROFILE_DESCRIPTOR_V2";
    internal const string ProfileId = "TEST_ONLY_STANDARD_NATIVE_HOST_PROFILE_V2";
    internal const string Effects = "FRESH_NATIVE_HOST_SERVICES_TWO_KEYS_OWNED_ACCOUNT_LOGON_READONLY_OWNER_OBJECT_TRANSFER_RETURN_DISABLED_RETAIN_V2";
    internal const string Root = @"C:\ProgramData\Ecs.Lic008.StandardNativeHostV1";
    internal const string Bin = Root + @"\bin";
    internal const string Image = Bin + @"\StandardControlHost.exe";
    internal const string Assembly = Bin + @"\StandardControl.dll";
    internal const string Config = Bin + @"\StandardControl.runtimeconfig.json";
    internal const string Runtime = @"C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11";
    internal const string Hostfxr = @"C:\Program Files\dotnet\host\fxr\10.0.11\hostfxr.dll";
    internal const string FrameworkDeps = Runtime + @"\Microsoft.NETCore.App.deps.json";
    internal const string ManagedType = "EntryControl.TestOnly.StandardNativeHost.NativeEntry, StandardControl";
    internal const string ManagedMethod = "Bootstrap";
    internal const string ConfigJson = "{\"runtimeOptions\":{\"tfm\":\"net10.0\",\"rollForward\":\"Disable\",\"framework\":{\"name\":\"Microsoft.NETCore.App\",\"version\":\"10.0.11\"}}}";

    internal const string AccountName = "EcsLic008W03V1";
    internal const string UserSid = "S-1-5-21-3058020570-171625005-1532683838-1023";
    internal const string OwnerSid = "S-1-5-21-3058020570-171625005-1532683838-1001";
    internal const string AccountOwnedSha256 = "7b18035b8faa2fdc21f43e5ef88a66fdbd872d3a9f070f2d9069f5f2675d2305";
    internal const string AccountCompleteSha256 = "4e4878a24f5b4d99a585aba865af730958286a9cf8e088e346c0b8b6e7d8ad6b";
    internal const string SetupService = "Ecs.Lic008.StandardNativeHostV1.Setup";
    internal const string GuardianService = "Ecs.Lic008.StandardNativeHostV1.Guardian";
    internal const string SetupSid = "S-1-5-80-713688157-2118060691-1762596744-1147334382-361936400";
    internal const string GuardianSid = "S-1-5-80-3366349895-3667009500-1538272007-2988576924-431824840";
    internal const string SystemSid = "S-1-5-18";
    internal const string KeyPrefix = "Ecs.Lic008.StandardNativeHostV1.TEST_ONLY.";
    internal const string PipePrefix = @"\\.\pipe\Ecs.Lic008.StandardNativeHostV1.";
    internal const string RecordPrefix = "Ecs.Lic008.StandardNativeHostV1.RECORD_V2.";
    internal const int MaximumCanonicalBytes = 8192;

    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    private readonly byte[] canonical;
    internal string Attempt { get; }
    internal string SourceSetSha256 { get; }
    internal string CanonicalSha256 { get; }

    private NativeHostProfileV2(string attempt, string sourceSetSha256)
    {
        Attempt = attempt;
        SourceSetSha256 = sourceSetSha256;
        canonical = WriteCanonical(this);
        if (canonical.Length > MaximumCanonicalBytes) throw new InvalidDataException("NATIVE_PROFILE_SIZE_REFUSED");
        CanonicalSha256 = Convert.ToHexStringLower(SHA256.HashData(canonical));
    }

    internal static NativeHostProfileV2 Create(string attempt, string sourceSetSha256)
    {
        if (!LowerHex(attempt, 32) || !LowerHex(sourceSetSha256, 64))
            throw new InvalidDataException("NATIVE_PROFILE_SCOPE_REFUSED");
        return new(attempt, sourceSetSha256);
    }

    internal byte[] CanonicalBytes() => (byte[])canonical.Clone();

    internal NativeHostRoleBinding Role(NativeHostRole role) => role switch {
        NativeHostRole.Owner => new("owner", Root + @"\scratch\owner", OwnerSid, "", ""),
        NativeHostRole.User => new("user", Root + @"\scratch\user", UserSid, "", ""),
        NativeHostRole.Setup => new("setup", Root + @"\scratch\setup", SystemSid, SetupService, SetupSid),
        NativeHostRole.Guardian => new("guardian", Root + @"\scratch\guardian", GuardianSid, GuardianService, GuardianSid),
        _ => throw new InvalidDataException("NATIVE_PROFILE_ROLE_REFUSED")
    };

    internal string KeyName(bool userAccessible) => KeyPrefix + Attempt + (userAccessible ? ".user-accessible" : ".restricted");

    internal string StageName(NativeHostStage stage) => stage switch {
        NativeHostStage.Setup => "setup",
        NativeHostStage.GuardianBefore => "guardian-before",
        NativeHostStage.StandardUser => "standard-user",
        NativeHostStage.GuardianAfter => "guardian-after",
        _ => throw new InvalidDataException("NATIVE_PROFILE_STAGE_REFUSED")
    };

    internal string Endpoint(NativeHostStage stage) => PipePrefix + Attempt + "." + StageName(stage);
    internal string RecordNamespace(string kind) => kind switch {
        "input" or "stage" or "journal" or "report" => RecordPrefix + Attempt + "." + kind + ".",
        _ => throw new InvalidDataException("NATIVE_PROFILE_RECORD_KIND_REFUSED")
    };
    internal string RecordRoot => Root + @"\records\" + Attempt;

    internal static string DerivedServiceSid(string name)
    {
        if (name != SetupService && name != GuardianService)
            throw new InvalidDataException("NATIVE_PROFILE_SERVICE_REFUSED");
        byte[] hash = SHA1.HashData(Encoding.Unicode.GetBytes(name.ToUpperInvariant()));
        return "S-1-5-80-" + string.Join("-", Enumerable.Range(0, 5).Select(i =>
            BinaryPrimitives.ReadUInt32LittleEndian(hash.AsSpan(i * 4, 4)).ToString(CultureInfo.InvariantCulture)));
    }

    internal static NativeHostProfileV2 ParseCanonical(ReadOnlySpan<byte> raw)
    {
        if (raw.Length is < 2 or > MaximumCanonicalBytes || raw[0] == 0xef)
            throw new InvalidDataException("NATIVE_PROFILE_BYTES_REFUSED");
        byte[] owned = raw.ToArray();
        string decoded;
        try { decoded = StrictUtf8.GetString(owned); }
        catch (DecoderFallbackException e) { throw new InvalidDataException("NATIVE_PROFILE_UTF8_REFUSED", e); }
        if (!StrictUtf8.GetBytes(decoded).AsSpan().SequenceEqual(raw) || decoded.IndexOf('\uFEFF') >= 0)
            throw new InvalidDataException("NATIVE_PROFILE_UTF8_REFUSED");
        try {
            using var doc = JsonDocument.Parse(owned, new JsonDocumentOptions { AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow, MaxDepth = 5 });
            if (doc.RootElement.ValueKind != JsonValueKind.Object) throw new InvalidDataException("NATIVE_PROFILE_SHAPE_REFUSED");
            CheckNoDuplicateProperties(doc.RootElement);
            string attempt = doc.RootElement.GetProperty("attempt").GetString() ?? "";
            string sourceSetSha256 = doc.RootElement.GetProperty("sourceSetSha256").GetString() ?? "";
            NativeHostProfileV2 expected = Create(attempt, sourceSetSha256);
            if (!raw.SequenceEqual(expected.canonical)) throw new InvalidDataException("NATIVE_PROFILE_CANONICAL_REFUSED");
            return expected;
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException) {
            throw new InvalidDataException("NATIVE_PROFILE_SHAPE_REFUSED", e);
        }
    }

    private static void CheckNoDuplicateProperties(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object) {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (JsonProperty p in element.EnumerateObject()) {
                if (!seen.Add(p.Name)) throw new InvalidDataException("NATIVE_PROFILE_DUPLICATE_REFUSED");
                CheckNoDuplicateProperties(p.Value);
            }
        } else if (element.ValueKind == JsonValueKind.Array) {
            foreach (JsonElement child in element.EnumerateArray()) CheckNoDuplicateProperties(child);
        }
    }

    private static bool LowerHex(string? value, int length) => value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static byte[] WriteCanonical(NativeHostProfileV2 p)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer)) {
            w.WriteStartObject();
            w.WriteString("schema", Schema);
            w.WriteString("profileId", ProfileId);
            w.WriteString("effects", Effects);
            w.WriteString("attempt", p.Attempt);
            w.WriteString("sourceSetSha256", p.SourceSetSha256);
            w.WriteStartObject("placement");
            w.WriteString("root", Root);
            w.WriteString("bin", Bin);
            w.WriteString("image", Image);
            w.WriteString("assembly", Assembly);
            w.WriteString("config", Config);
            w.WriteString("runtime", Runtime);
            w.WriteString("hostfxr", Hostfxr);
            w.WriteString("frameworkDeps", FrameworkDeps);
            w.WriteString("configUtf8Sha256", Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(ConfigJson))));
            w.WriteString("managedType", ManagedType);
            w.WriteString("managedMethod", ManagedMethod);
            w.WriteEndObject();
            w.WriteStartObject("identity");
            w.WriteString("account", AccountName);
            w.WriteString("ownerSid", OwnerSid);
            w.WriteString("userSid", UserSid);
            w.WriteString("ownedSha256", AccountOwnedSha256);
            w.WriteString("completeSha256", AccountCompleteSha256);
            w.WriteString("setupService", SetupService);
            w.WriteString("setupServiceSid", SetupSid);
            w.WriteString("guardianService", GuardianService);
            w.WriteString("guardianServiceSid", GuardianSid);
            w.WriteEndObject();
            w.WriteStartArray("roles");
            foreach (NativeHostRole role in new[] { NativeHostRole.Owner, NativeHostRole.User, NativeHostRole.Setup, NativeHostRole.Guardian }) {
                NativeHostRoleBinding binding = p.Role(role);
                w.WriteStartObject();
                w.WriteString("role", binding.Name);
                w.WriteString("scratch", binding.Scratch);
                w.WriteString("principalSid", binding.PrincipalSid);
                w.WriteString("service", binding.ServiceName);
                w.WriteString("serviceSid", binding.ServiceSid);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            w.WriteStartObject("keys");
            w.WriteString("prefix", KeyPrefix);
            w.WriteString("restricted", p.KeyName(false));
            w.WriteString("userAccessible", p.KeyName(true));
            w.WriteEndObject();
            w.WriteStartObject("endpoints");
            foreach (NativeHostStage stage in new[] { NativeHostStage.Setup, NativeHostStage.GuardianBefore,
                NativeHostStage.StandardUser, NativeHostStage.GuardianAfter }) w.WriteString(p.StageName(stage), p.Endpoint(stage));
            w.WriteEndObject();
            w.WriteStartObject("records");
            w.WriteString("root", p.RecordRoot);
            foreach (string kind in new[] { "input", "stage", "journal", "report" }) w.WriteString(kind, p.RecordNamespace(kind));
            w.WriteEndObject();
            w.WriteStartObject("claims");
            w.WriteBoolean("nativeEntryProven", false);
            w.WriteBoolean("actualBootstrapAccepted", false);
            w.WriteBoolean("ownerWorkerAssociationProven", false);
            w.WriteBoolean("loadedModulesAttested", false);
            w.WriteBoolean("physicalW03Accepted", false);
            w.WriteBoolean("securityAccepted", false);
            w.WriteBoolean("productionAccepted", false);
            w.WriteBoolean("lic008Closed", false);
            w.WriteEndObject();
            w.WriteEndObject();
        }
        return buffer.ToArray();
    }
}
