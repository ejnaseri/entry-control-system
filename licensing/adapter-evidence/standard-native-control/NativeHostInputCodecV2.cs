using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal sealed record NativeHostFilePinV2(string Name, long Size, string Sha256);
internal sealed record NativeHostAssetPinV2(long Size, string Sha256);

// These objects describe one proposed input scope. A matching digest is not
// an authorization to open a file, create a service, start CLR or use a key.
internal sealed class NativeHostPlanV2
{
    private readonly byte[] canonical;
    private readonly IReadOnlyList<NativeHostFilePinV2> inventory;
    internal string Attempt { get; }
    internal string ProfileSha256 { get; }
    internal DateTimeOffset IssuedUtc { get; }
    internal DateTimeOffset ExpiresUtc { get; }
    internal string HostSha256 { get; }
    internal string BootSha256 { get; }
    internal string SourceSetSha256 { get; }
    internal string PackageManifestSha256 { get; }
    internal string RuntimeInventorySha256 { get; }
    internal NativeHostAssetPinV2 Image { get; }
    internal NativeHostAssetPinV2 Assembly { get; }
    internal NativeHostAssetPinV2 Config { get; }
    internal NativeHostAssetPinV2 Hostfxr { get; }
    internal IReadOnlyList<NativeHostFilePinV2> FrameworkInventory => inventory;
    internal string CanonicalSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])canonical.Clone();

    internal NativeHostPlanV2(NativeHostProfileV2 profile, string attempt, DateTimeOffset issuedUtc,
        DateTimeOffset expiresUtc, string hostSha256, string bootSha256,
        string packageManifestSha256, string runtimeInventorySha256,
        NativeHostAssetPinV2 image, NativeHostAssetPinV2 assembly,
        NativeHostAssetPinV2 config, NativeHostAssetPinV2 hostfxr,
        IReadOnlyList<NativeHostFilePinV2> frameworkInventory)
    {
        NativeHostFilePinV2[] snapshot = frameworkInventory?.ToArray() ??
            throw new InvalidDataException("NATIVE_INPUT_INVENTORY_REQUIRED");
        NativeHostInputCodecV2.ValidatePlanArguments(profile, attempt, issuedUtc, expiresUtc,
            hostSha256, bootSha256, packageManifestSha256, runtimeInventorySha256,
            image, assembly, config, hostfxr, snapshot);
        Attempt = attempt;
        ProfileSha256 = profile.CanonicalSha256;
        IssuedUtc = issuedUtc;
        ExpiresUtc = expiresUtc;
        HostSha256 = hostSha256;
        BootSha256 = bootSha256;
        SourceSetSha256 = profile.SourceSetSha256;
        PackageManifestSha256 = packageManifestSha256;
        RuntimeInventorySha256 = runtimeInventorySha256;
        Image = image;
        Assembly = assembly;
        Config = config;
        Hostfxr = hostfxr;
        inventory = Array.AsReadOnly(snapshot);
        canonical = NativeHostInputCodecV2.WritePlan(this, profile);
        if (canonical.Length > NativeHostInputCodecV2.MaximumPlanBytes)
            throw new InvalidDataException("NATIVE_INPUT_PLAN_SIZE_REFUSED");
        CanonicalSha256 = NativeHostInputCodecV2.Hash(canonical);
    }
}

internal sealed class NativeHostApprovalV2
{
    private readonly byte[] canonical;
    internal DateTimeOffset IssuedUtc { get; }
    internal DateTimeOffset ExpiresUtc { get; }
    internal string PlanSha256 { get; }
    internal string CanonicalSha256 { get; }
    internal byte[] CanonicalBytes() => (byte[])canonical.Clone();

    internal NativeHostApprovalV2(NativeHostPlanV2 plan, DateTimeOffset issuedUtc,
        DateTimeOffset expiresUtc)
    {
        NativeHostInputCodecV2.ValidateApprovalWindow(plan, issuedUtc, expiresUtc);
        IssuedUtc = issuedUtc;
        ExpiresUtc = expiresUtc;
        PlanSha256 = plan.CanonicalSha256;
        canonical = NativeHostInputCodecV2.WriteApproval(this, plan);
        if (canonical.Length > NativeHostInputCodecV2.MaximumApprovalBytes)
            throw new InvalidDataException("NATIVE_INPUT_APPROVAL_SIZE_REFUSED");
        CanonicalSha256 = NativeHostInputCodecV2.Hash(canonical);
    }
}

internal sealed class NativeHostBoundInputV2
{
    internal NativeHostProfileV2 Profile { get; }
    internal NativeHostPlanV2 Plan { get; }
    internal NativeHostApprovalV2 Approval { get; }
    internal string PlanSha256 => Plan.CanonicalSha256;
    internal string ApprovalSha256 => Approval.CanonicalSha256;
    internal bool NativeAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool PhysicalW03Accepted => false;
    internal bool SecurityAccepted => false;
    internal bool ProductionAccepted => false;
    internal bool Lic008Closed => false;

    internal NativeHostBoundInputV2(NativeHostProfileV2 profile, NativeHostPlanV2 plan,
        NativeHostApprovalV2 approval)
    {
        Profile = profile;
        Plan = plan;
        Approval = approval;
    }
}

internal static class NativeHostInputCodecV2
{
    internal const string PlanSchema = "TEST_ONLY_STANDARD_NATIVE_HOST_PLAN_V2";
    internal const string ApprovalSchema = "TEST_ONLY_STANDARD_NATIVE_HOST_APPROVAL_V2";
    internal const string RuntimeInventorySchema = "TEST_ONLY_STANDARD_NATIVE_RUNTIME_INVENTORY_V2";
    internal const string PlanPurpose = "W03_STANDARD_NATIVE_HOST_CLOSED_INPUT_ONLY";
    internal const string ApprovalPurpose = "W03_STANDARD_NATIVE_HOST_CLOSED_APPROVAL_ONLY";
    internal const int MaximumPlanBytes = 131072;
    internal const int MaximumApprovalBytes = 8192;
    internal const int MaximumInventoryBytes = 65536;
    internal const int MaximumExternalBytes = 4194304;
    internal const int FrameworkFileCount = 189;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonDocumentOptions JsonOptions = new() {
        AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow, MaxDepth = 8
    };
    // Exact ordinal-sorted leaf set observed in the pinned installed 10.0.11
    // tree. Names alone do not establish byte or loaded-module custody.
    // UTF-8 of names joined by LF: SHA256
    // 5a13c555d61d67fd42b9758e10e6cb55e26476f2477fa1d3a7d54064b9186c66.
    private static readonly string[] ExactRuntimeLeaves = {
        ".version",
        "Microsoft.CSharp.dll",
        "Microsoft.DiaSymReader.Native.amd64.dll",
        "Microsoft.NETCore.App.deps.json",
        "Microsoft.NETCore.App.runtimeconfig.json",
        "Microsoft.VisualBasic.Core.dll",
        "Microsoft.VisualBasic.dll",
        "Microsoft.Win32.Primitives.dll",
        "Microsoft.Win32.Registry.dll",
        "System.AppContext.dll",
        "System.Buffers.dll",
        "System.Collections.Concurrent.dll",
        "System.Collections.Immutable.dll",
        "System.Collections.NonGeneric.dll",
        "System.Collections.Specialized.dll",
        "System.Collections.dll",
        "System.ComponentModel.Annotations.dll",
        "System.ComponentModel.DataAnnotations.dll",
        "System.ComponentModel.EventBasedAsync.dll",
        "System.ComponentModel.Primitives.dll",
        "System.ComponentModel.TypeConverter.dll",
        "System.ComponentModel.dll",
        "System.Configuration.dll",
        "System.Console.dll",
        "System.Core.dll",
        "System.Data.Common.dll",
        "System.Data.DataSetExtensions.dll",
        "System.Data.dll",
        "System.Diagnostics.Contracts.dll",
        "System.Diagnostics.Debug.dll",
        "System.Diagnostics.DiagnosticSource.dll",
        "System.Diagnostics.FileVersionInfo.dll",
        "System.Diagnostics.Process.dll",
        "System.Diagnostics.StackTrace.dll",
        "System.Diagnostics.TextWriterTraceListener.dll",
        "System.Diagnostics.Tools.dll",
        "System.Diagnostics.TraceSource.dll",
        "System.Diagnostics.Tracing.dll",
        "System.Drawing.Primitives.dll",
        "System.Drawing.dll",
        "System.Dynamic.Runtime.dll",
        "System.Formats.Asn1.dll",
        "System.Formats.Tar.dll",
        "System.Globalization.Calendars.dll",
        "System.Globalization.Extensions.dll",
        "System.Globalization.dll",
        "System.IO.Compression.Brotli.dll",
        "System.IO.Compression.FileSystem.dll",
        "System.IO.Compression.Native.dll",
        "System.IO.Compression.ZipFile.dll",
        "System.IO.Compression.dll",
        "System.IO.FileSystem.AccessControl.dll",
        "System.IO.FileSystem.DriveInfo.dll",
        "System.IO.FileSystem.Primitives.dll",
        "System.IO.FileSystem.Watcher.dll",
        "System.IO.FileSystem.dll",
        "System.IO.IsolatedStorage.dll",
        "System.IO.MemoryMappedFiles.dll",
        "System.IO.Pipelines.dll",
        "System.IO.Pipes.AccessControl.dll",
        "System.IO.Pipes.dll",
        "System.IO.UnmanagedMemoryStream.dll",
        "System.IO.dll",
        "System.Linq.AsyncEnumerable.dll",
        "System.Linq.Expressions.dll",
        "System.Linq.Parallel.dll",
        "System.Linq.Queryable.dll",
        "System.Linq.dll",
        "System.Memory.dll",
        "System.Net.Http.Json.dll",
        "System.Net.Http.dll",
        "System.Net.HttpListener.dll",
        "System.Net.Mail.dll",
        "System.Net.NameResolution.dll",
        "System.Net.NetworkInformation.dll",
        "System.Net.Ping.dll",
        "System.Net.Primitives.dll",
        "System.Net.Quic.dll",
        "System.Net.Requests.dll",
        "System.Net.Security.dll",
        "System.Net.ServerSentEvents.dll",
        "System.Net.ServicePoint.dll",
        "System.Net.Sockets.dll",
        "System.Net.WebClient.dll",
        "System.Net.WebHeaderCollection.dll",
        "System.Net.WebProxy.dll",
        "System.Net.WebSockets.Client.dll",
        "System.Net.WebSockets.dll",
        "System.Net.dll",
        "System.Numerics.Vectors.dll",
        "System.Numerics.dll",
        "System.ObjectModel.dll",
        "System.Private.CoreLib.dll",
        "System.Private.DataContractSerialization.dll",
        "System.Private.Uri.dll",
        "System.Private.Xml.Linq.dll",
        "System.Private.Xml.dll",
        "System.Reflection.DispatchProxy.dll",
        "System.Reflection.Emit.ILGeneration.dll",
        "System.Reflection.Emit.Lightweight.dll",
        "System.Reflection.Emit.dll",
        "System.Reflection.Extensions.dll",
        "System.Reflection.Metadata.dll",
        "System.Reflection.Primitives.dll",
        "System.Reflection.TypeExtensions.dll",
        "System.Reflection.dll",
        "System.Resources.Reader.dll",
        "System.Resources.ResourceManager.dll",
        "System.Resources.Writer.dll",
        "System.Runtime.CompilerServices.Unsafe.dll",
        "System.Runtime.CompilerServices.VisualC.dll",
        "System.Runtime.Extensions.dll",
        "System.Runtime.Handles.dll",
        "System.Runtime.InteropServices.JavaScript.dll",
        "System.Runtime.InteropServices.RuntimeInformation.dll",
        "System.Runtime.InteropServices.dll",
        "System.Runtime.Intrinsics.dll",
        "System.Runtime.Loader.dll",
        "System.Runtime.Numerics.dll",
        "System.Runtime.Serialization.Formatters.dll",
        "System.Runtime.Serialization.Json.dll",
        "System.Runtime.Serialization.Primitives.dll",
        "System.Runtime.Serialization.Xml.dll",
        "System.Runtime.Serialization.dll",
        "System.Runtime.dll",
        "System.Security.AccessControl.dll",
        "System.Security.Claims.dll",
        "System.Security.Cryptography.Algorithms.dll",
        "System.Security.Cryptography.Cng.dll",
        "System.Security.Cryptography.Csp.dll",
        "System.Security.Cryptography.Encoding.dll",
        "System.Security.Cryptography.OpenSsl.dll",
        "System.Security.Cryptography.Primitives.dll",
        "System.Security.Cryptography.X509Certificates.dll",
        "System.Security.Cryptography.dll",
        "System.Security.Principal.Windows.dll",
        "System.Security.Principal.dll",
        "System.Security.SecureString.dll",
        "System.Security.dll",
        "System.ServiceModel.Web.dll",
        "System.ServiceProcess.dll",
        "System.Text.Encoding.CodePages.dll",
        "System.Text.Encoding.Extensions.dll",
        "System.Text.Encoding.dll",
        "System.Text.Encodings.Web.dll",
        "System.Text.Json.dll",
        "System.Text.RegularExpressions.dll",
        "System.Threading.AccessControl.dll",
        "System.Threading.Channels.dll",
        "System.Threading.Overlapped.dll",
        "System.Threading.Tasks.Dataflow.dll",
        "System.Threading.Tasks.Extensions.dll",
        "System.Threading.Tasks.Parallel.dll",
        "System.Threading.Tasks.dll",
        "System.Threading.Thread.dll",
        "System.Threading.ThreadPool.dll",
        "System.Threading.Timer.dll",
        "System.Threading.dll",
        "System.Transactions.Local.dll",
        "System.Transactions.dll",
        "System.ValueTuple.dll",
        "System.Web.HttpUtility.dll",
        "System.Web.dll",
        "System.Windows.dll",
        "System.Xml.Linq.dll",
        "System.Xml.ReaderWriter.dll",
        "System.Xml.Serialization.dll",
        "System.Xml.XDocument.dll",
        "System.Xml.XPath.XDocument.dll",
        "System.Xml.XPath.dll",
        "System.Xml.XmlDocument.dll",
        "System.Xml.XmlSerializer.dll",
        "System.Xml.dll",
        "System.dll",
        "WindowsBase.dll",
        "clretwrc.dll",
        "clrgc.dll",
        "clrgcexp.dll",
        "clrjit.dll",
        "coreclr.dll",
        "createdump.exe",
        "hostpolicy.dll",
        "mscordaccore.dll",
        "mscordaccore_amd64_amd64_10.0.1126.37416.dll",
        "mscordbi.dll",
        "mscorlib.dll",
        "mscorrc.dll",
        "msquic.dll",
        "netstandard.dll",
    };

    internal static string ExpectedRuntimeLeaf(int index) => ExactRuntimeLeaves[index];

    internal static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }

    private static void ValidateWindow(DateTimeOffset issued, DateTimeOffset expires)
    {
        Need(issued.Offset == TimeSpan.Zero && expires.Offset == TimeSpan.Zero &&
            issued.UtcTicks % TimeSpan.TicksPerMillisecond == 0 &&
            expires.UtcTicks % TimeSpan.TicksPerMillisecond == 0 &&
            expires > issued && expires - issued <= TimeSpan.FromHours(2),
            "NATIVE_INPUT_TIME_REFUSED");
    }

    private static void ValidateAsset(NativeHostAssetPinV2? pin, long maximum)
    {
        Need(pin is not null && pin.Size is > 0 && pin.Size <= maximum &&
            LowerHex(pin.Sha256, 64), "NATIVE_INPUT_ASSET_REFUSED");
    }

    private static void ValidateInventory(IReadOnlyList<NativeHostFilePinV2>? inventory)
    {
        Need(inventory is not null && inventory.Count == FrameworkFileCount,
            "NATIVE_INPUT_INVENTORY_COUNT_REFUSED");
        string previous = "";
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (NativeHostFilePinV2? pin in inventory) {
            Need(pin is not null && pin.Name is { Length: >= 1 and <= 96 } &&
                pin.Name != "." && pin.Name != ".." &&
                (pin.Name == ".version" || pin.Name[0] != '.') &&
                pin.Name[^1] != '.' &&
                pin.Name.All(c => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or
                    >= '0' and <= '9' or '.' or '_' or '-') &&
                string.CompareOrdinal(previous, pin.Name) < 0 && seen.Add(pin.Name) &&
                pin.Size is > 0 and <= 67108864 && LowerHex(pin.Sha256, 64),
                "NATIVE_INPUT_INVENTORY_LEAF_REFUSED");
            previous = pin.Name;
        }
        for (int i = 0; i < FrameworkFileCount; i++)
            Need(inventory[i].Name == ExactRuntimeLeaves[i],
                "NATIVE_INPUT_INVENTORY_EXACT_NAMES_REFUSED");
    }

    internal static void ValidatePlanArguments(NativeHostProfileV2? profile, string? attempt,
        DateTimeOffset issuedUtc, DateTimeOffset expiresUtc, string? hostSha256,
        string? bootSha256, string? packageManifestSha256, string? runtimeInventorySha256,
        NativeHostAssetPinV2? image, NativeHostAssetPinV2? assembly,
        NativeHostAssetPinV2? config, NativeHostAssetPinV2? hostfxr,
        IReadOnlyList<NativeHostFilePinV2>? frameworkInventory)
    {
        Need(profile is not null && LowerHex(attempt, 32) && attempt == profile.Attempt &&
            LowerHex(profile.SourceSetSha256, 64) &&
            LowerHex(hostSha256, 64) && LowerHex(bootSha256, 64) &&
            LowerHex(packageManifestSha256, 64) && LowerHex(runtimeInventorySha256, 64),
            "NATIVE_INPUT_SCOPE_REFUSED");
        ValidateWindow(issuedUtc, expiresUtc);
        ValidateAsset(image, 16777216);
        ValidateAsset(assembly, 16777216);
        ValidateAsset(config, 4096);
        ValidateAsset(hostfxr, 16777216);
        byte[] exactConfig = Utf8.GetBytes(NativeHostProfileV2.ConfigJson);
        Need(config!.Size == exactConfig.Length && config.Sha256 == Hash(exactConfig),
            "NATIVE_INPUT_CONFIG_BYTES_REFUSED");
        ValidateInventory(frameworkInventory);
    }

    internal static void ValidateApprovalWindow(NativeHostPlanV2? plan, DateTimeOffset issued,
        DateTimeOffset expires)
    {
        Need(plan is not null, "NATIVE_INPUT_PLAN_REQUIRED");
        ValidateWindow(issued, expires);
        Need(issued >= plan.IssuedUtc && expires <= plan.ExpiresUtc,
            "NATIVE_INPUT_APPROVAL_WINDOW_REFUSED");
    }

    private static string Time(DateTimeOffset value) => value.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
        CultureInfo.InvariantCulture);

    private static DateTimeOffset ReadTime(JsonElement root, string name)
    {
        string? text = root.GetProperty(name).GetString();
        DateTimeOffset value = default;
        Need(text is not null && DateTimeOffset.TryParseExact(text,
            "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out value), "NATIVE_INPUT_TIME_TEXT_REFUSED");
        return value;
    }

    private static void WriteAsset(Utf8JsonWriter w, string name, string path,
        NativeHostAssetPinV2 pin)
    {
        w.WriteStartObject(name);
        w.WriteString("path", path);
        w.WriteNumber("size", pin.Size);
        w.WriteString("sha256", pin.Sha256);
        w.WriteEndObject();
    }

    private static NativeHostAssetPinV2 ReadAsset(JsonElement root, string name)
    {
        JsonElement asset = root.GetProperty("assets").GetProperty(name);
        return new(asset.GetProperty("size").GetInt64(), asset.GetProperty("sha256").GetString() ?? "");
    }

    private static void WriteInventoryFiles(Utf8JsonWriter w, IReadOnlyList<NativeHostFilePinV2> files)
    {
        w.WriteStartArray("files");
        foreach (NativeHostFilePinV2 pin in files) {
            w.WriteStartObject();
            w.WriteString("name", pin.Name);
            w.WriteNumber("size", pin.Size);
            w.WriteString("sha256", pin.Sha256);
            w.WriteEndObject();
        }
        w.WriteEndArray();
    }

    private static NativeHostFilePinV2[] ReadInventoryFiles(JsonElement array)
    {
        Need(array.ValueKind == JsonValueKind.Array && array.GetArrayLength() == FrameworkFileCount,
            "NATIVE_INPUT_INVENTORY_COUNT_REFUSED");
        return array.EnumerateArray().Select(p => new NativeHostFilePinV2(
            p.GetProperty("name").GetString() ?? "", p.GetProperty("size").GetInt64(),
            p.GetProperty("sha256").GetString() ?? "")).ToArray();
    }

    internal static byte[] EncodeRuntimeInventory(NativeHostProfileV2 profile,
        IReadOnlyList<NativeHostFilePinV2> files)
    {
        Need(profile is not null, "NATIVE_INPUT_PROFILE_REQUIRED");
        NativeHostFilePinV2[] snapshot = files?.ToArray() ??
            throw new InvalidDataException("NATIVE_INPUT_INVENTORY_REQUIRED");
        ValidateInventory(snapshot);
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream)) {
            w.WriteStartObject();
            w.WriteString("schema", RuntimeInventorySchema);
            w.WriteString("runtime", NativeHostProfileV2.Runtime);
            WriteInventoryFiles(w, snapshot);
            w.WriteEndObject();
        }
        byte[] result = stream.ToArray();
        Need(result.Length <= MaximumInventoryBytes, "NATIVE_INPUT_INVENTORY_SIZE_REFUSED");
        return result;
    }

    internal static IReadOnlyList<NativeHostFilePinV2> ParseRuntimeInventory(byte[] original,
        NativeHostProfileV2 profile)
    {
        Need(original is { Length: >= 2 } && original.Length <= MaximumInventoryBytes,
            "NATIVE_INPUT_INVENTORY_SIZE_REFUSED");
        byte[] owned = (byte[])original.Clone();
        using JsonDocument doc = ReadCanonicalDocument(owned, MaximumInventoryBytes);
        try {
            NativeHostFilePinV2[] files = ReadInventoryFiles(doc.RootElement.GetProperty("files"));
            byte[] expected = EncodeRuntimeInventory(profile, files);
            Need(owned.AsSpan().SequenceEqual(expected), "NATIVE_INPUT_INVENTORY_CANONICAL_REFUSED");
            return Array.AsReadOnly(files);
        } catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or FormatException) {
            throw new InvalidDataException("NATIVE_INPUT_INVENTORY_SHAPE_REFUSED", e);
        }
    }

    private static void WriteClaims(Utf8JsonWriter w)
    {
        w.WriteStartObject("claims");
        w.WriteBoolean("nativeEntryProven", false);
        w.WriteBoolean("grantAuthorized", false);
        w.WriteBoolean("physicalW03Accepted", false);
        w.WriteBoolean("securityAccepted", false);
        w.WriteBoolean("productionAccepted", false);
        w.WriteBoolean("lic008Closed", false);
        w.WriteEndObject();
    }

    internal static byte[] WritePlan(NativeHostPlanV2 p, NativeHostProfileV2 profile)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream)) {
            w.WriteStartObject();
            w.WriteString("schema", PlanSchema);
            w.WriteString("purpose", PlanPurpose);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("profileSha256", p.ProfileSha256);
            w.WriteString("effects", NativeHostProfileV2.Effects);
            w.WriteString("attempt", p.Attempt);
            w.WriteString("issuedUtc", Time(p.IssuedUtc));
            w.WriteString("expiresUtc", Time(p.ExpiresUtc));
            w.WriteString("ownerSid", NativeHostProfileV2.OwnerSid);
            w.WriteString("hostSha256", p.HostSha256);
            w.WriteString("bootSha256", p.BootSha256);
            w.WriteString("sourceSetSha256", p.SourceSetSha256);
            w.WriteString("packageManifestSha256", p.PackageManifestSha256);
            w.WriteString("runtimeInventorySha256", p.RuntimeInventorySha256);
            w.WriteStartObject("placement");
            w.WriteString("root", NativeHostProfileV2.Root);
            w.WriteString("bin", NativeHostProfileV2.Bin);
            w.WriteString("image", NativeHostProfileV2.Image);
            w.WriteString("assembly", NativeHostProfileV2.Assembly);
            w.WriteString("config", NativeHostProfileV2.Config);
            w.WriteString("runtime", NativeHostProfileV2.Runtime);
            w.WriteString("hostfxr", NativeHostProfileV2.Hostfxr);
            w.WriteString("frameworkDeps", NativeHostProfileV2.FrameworkDeps);
            w.WriteString("managedType", NativeHostProfileV2.ManagedType);
            w.WriteString("managedMethod", NativeHostProfileV2.ManagedMethod);
            w.WriteString("managedInvocationGrammar",
                "load_assembly_and_get_function_pointer;delegate_type_name=NULL;reserved=NULL;int(void*,int32_t)");
            w.WriteEndObject();
            w.WriteStartObject("identity");
            w.WriteString("account", NativeHostProfileV2.AccountName);
            w.WriteString("accountSid", NativeHostProfileV2.UserSid);
            w.WriteString("accountOwnedSha256", NativeHostProfileV2.AccountOwnedSha256);
            w.WriteString("accountCompleteSha256", NativeHostProfileV2.AccountCompleteSha256);
            w.WriteString("setupService", NativeHostProfileV2.SetupService);
            w.WriteString("setupServiceSid", NativeHostProfileV2.SetupSid);
            w.WriteString("guardianService", NativeHostProfileV2.GuardianService);
            w.WriteString("guardianServiceSid", NativeHostProfileV2.GuardianSid);
            w.WriteEndObject();
            w.WriteStartArray("roles");
            foreach (NativeHostRole role in new[] { NativeHostRole.Owner, NativeHostRole.User,
                NativeHostRole.Setup, NativeHostRole.Guardian }) {
                NativeHostRoleBinding binding = profile.Role(role);
                w.WriteStartObject();
                w.WriteString("role", binding.Name);
                w.WriteString("scratch", binding.Scratch);
                w.WriteString("principalSid", binding.PrincipalSid);
                w.WriteString("service", binding.ServiceName);
                w.WriteString("serviceSid", binding.ServiceSid);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            w.WriteStartObject("namespaces");
            w.WriteString("keyPrefix", NativeHostProfileV2.KeyPrefix);
            w.WriteString("restrictedKey", profile.KeyName(false));
            w.WriteString("userAccessibleKey", profile.KeyName(true));
            w.WriteString("pipePrefix", NativeHostProfileV2.PipePrefix);
            foreach (NativeHostStage stage in Enum.GetValues<NativeHostStage>())
                w.WriteString(profile.StageName(stage) + "Pipe", profile.Endpoint(stage));
            w.WriteString("recordRoot", profile.RecordRoot);
            foreach (string kind in new[] { "input", "stage", "journal", "report" })
                w.WriteString(kind + "Records", profile.RecordNamespace(kind));
            w.WriteEndObject();
            w.WriteStartObject("commandGrammar");
            w.WriteString("owner", "<image> --owner --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64>");
            w.WriteString("user", "<image> --user --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64> --run-id <lowerhex32> --nonce <lowerhex64>");
            w.WriteString("service", "<image> --service --role (Setup|Guardian) --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64>");
            w.WriteString("setupStart", "<setupService> --stage setup --run-id <lowerhex32> --nonce <lowerhex64>");
            w.WriteString("guardianBeforeStart", "<guardianService> --stage guardian-before --run-id <lowerhex32> --nonce <lowerhex64>");
            w.WriteString("guardianAfterStart", "<guardianService> --stage guardian-after --run-id <lowerhex32> --nonce <lowerhex64>");
            w.WriteEndObject();
            w.WriteStartObject("assets");
            WriteAsset(w, "image", NativeHostProfileV2.Image, p.Image);
            WriteAsset(w, "assembly", NativeHostProfileV2.Assembly, p.Assembly);
            WriteAsset(w, "config", NativeHostProfileV2.Config, p.Config);
            WriteAsset(w, "hostfxr", NativeHostProfileV2.Hostfxr, p.Hostfxr);
            w.WriteEndObject();
            w.WriteStartObject("frameworkInventory");
            w.WriteString("runtime", NativeHostProfileV2.Runtime);
            w.WriteString("frameworkDepsSha256", p.FrameworkInventory.First(x =>
                x.Name == "Microsoft.NETCore.App.deps.json").Sha256);
            WriteInventoryFiles(w, p.FrameworkInventory);
            w.WriteEndObject();
            WriteClaims(w);
            w.WriteEndObject();
        }
        return stream.ToArray();
    }

    internal static byte[] WriteApproval(NativeHostApprovalV2 a, NativeHostPlanV2 p)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream)) {
            w.WriteStartObject();
            w.WriteString("schema", ApprovalSchema);
            w.WriteString("purpose", ApprovalPurpose);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("profileSha256", p.ProfileSha256);
            w.WriteString("effects", NativeHostProfileV2.Effects);
            w.WriteString("attempt", p.Attempt);
            w.WriteString("planSha256", p.CanonicalSha256);
            w.WriteString("issuedUtc", Time(a.IssuedUtc));
            w.WriteString("expiresUtc", Time(a.ExpiresUtc));
            w.WriteString("ownerSid", NativeHostProfileV2.OwnerSid);
            w.WriteString("hostSha256", p.HostSha256);
            w.WriteString("bootSha256", p.BootSha256);
            w.WriteString("sourceSetSha256", p.SourceSetSha256);
            w.WriteString("packageManifestSha256", p.PackageManifestSha256);
            w.WriteString("runtimeInventorySha256", p.RuntimeInventorySha256);
            w.WriteString("imageSha256", p.Image.Sha256);
            w.WriteNumber("imageSize", p.Image.Size);
            w.WriteString("assemblySha256", p.Assembly.Sha256);
            w.WriteNumber("assemblySize", p.Assembly.Size);
            w.WriteString("configSha256", p.Config.Sha256);
            w.WriteNumber("configSize", p.Config.Size);
            w.WriteString("hostfxrSha256", p.Hostfxr.Sha256);
            w.WriteNumber("hostfxrSize", p.Hostfxr.Size);
            w.WriteString("frameworkDepsSha256", p.FrameworkInventory.First(x =>
                x.Name == "Microsoft.NETCore.App.deps.json").Sha256);
            WriteClaims(w);
            w.WriteEndObject();
        }
        return stream.ToArray();
    }

    private static void UniqueProperties(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object) {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (JsonProperty property in element.EnumerateObject()) {
                Need(names.Add(property.Name), "NATIVE_INPUT_DUPLICATE_REFUSED");
                UniqueProperties(property.Value);
            }
        } else if (element.ValueKind == JsonValueKind.Array) {
            foreach (JsonElement child in element.EnumerateArray()) UniqueProperties(child);
        }
    }

    private static JsonDocument ReadCanonicalDocument(byte[]? original, int maximum)
    {
        Need(original is { Length: >= 2 } && original.Length <= maximum,
            "NATIVE_INPUT_LENGTH_REFUSED");
        byte[] owned = (byte[])original.Clone();
        try {
            string decoded = Utf8.GetString(owned);
            Need(decoded.IndexOf('\uFEFF') < 0 && Utf8.GetBytes(decoded).AsSpan().SequenceEqual(owned),
                "NATIVE_INPUT_UTF8_REFUSED");
            JsonDocument doc = JsonDocument.Parse(owned, JsonOptions);
            try {
                Need(doc.RootElement.ValueKind == JsonValueKind.Object,
                    "NATIVE_INPUT_OBJECT_REFUSED");
                UniqueProperties(doc.RootElement);
                return doc;
            } catch { doc.Dispose(); throw; }
        } catch (DecoderFallbackException e) {
            throw new InvalidDataException("NATIVE_INPUT_UTF8_REFUSED", e);
        } catch (JsonException e) {
            throw new InvalidDataException("NATIVE_INPUT_JSON_REFUSED", e);
        }
    }

    internal static NativeHostPlanV2 ParsePlan(byte[] original, NativeHostProfileV2 profile)
    {
        Need(original is { Length: >= 2 } && original.Length <= MaximumPlanBytes,
            "NATIVE_INPUT_PLAN_SIZE_REFUSED");
        byte[] owned = (byte[])original.Clone();
        using JsonDocument doc = ReadCanonicalDocument(owned, MaximumPlanBytes);
        try {
            JsonElement r = doc.RootElement;
            NativeHostFilePinV2[] files = ReadInventoryFiles(r.GetProperty("frameworkInventory").GetProperty("files"));
            var plan = new NativeHostPlanV2(profile, r.GetProperty("attempt").GetString() ?? "",
                ReadTime(r, "issuedUtc"), ReadTime(r, "expiresUtc"),
                r.GetProperty("hostSha256").GetString() ?? "",
                r.GetProperty("bootSha256").GetString() ?? "",
                r.GetProperty("packageManifestSha256").GetString() ?? "",
                r.GetProperty("runtimeInventorySha256").GetString() ?? "",
                ReadAsset(r, "image"), ReadAsset(r, "assembly"),
                ReadAsset(r, "config"), ReadAsset(r, "hostfxr"), files);
            Need(owned.AsSpan().SequenceEqual(plan.CanonicalBytes()),
                "NATIVE_INPUT_PLAN_CANONICAL_REFUSED");
            return plan;
        } catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or FormatException or OverflowException) {
            throw new InvalidDataException("NATIVE_INPUT_PLAN_SHAPE_REFUSED", e);
        }
    }

    internal static NativeHostApprovalV2 ParseApproval(byte[] original, NativeHostPlanV2 plan)
    {
        Need(original is { Length: >= 2 } && original.Length <= MaximumApprovalBytes,
            "NATIVE_INPUT_APPROVAL_SIZE_REFUSED");
        byte[] owned = (byte[])original.Clone();
        using JsonDocument doc = ReadCanonicalDocument(owned, MaximumApprovalBytes);
        try {
            JsonElement r = doc.RootElement;
            var approval = new NativeHostApprovalV2(plan, ReadTime(r, "issuedUtc"),
                ReadTime(r, "expiresUtc"));
            Need(owned.AsSpan().SequenceEqual(approval.CanonicalBytes()),
                "NATIVE_INPUT_APPROVAL_CANONICAL_REFUSED");
            return approval;
        } catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or FormatException or OverflowException) {
            throw new InvalidDataException("NATIVE_INPUT_APPROVAL_SHAPE_REFUSED", e);
        }
    }

    internal static NativeHostBoundInputV2 Bind(byte[] planOriginal, byte[] approvalOriginal,
        byte[] profileOriginal, byte[] sourceSetOriginal, byte[] packageManifestOriginal,
        byte[] runtimeInventoryOriginal, DateTimeOffset nowUtc)
    {
        Need(planOriginal is { Length: >= 2 } && planOriginal.Length <= MaximumPlanBytes &&
            approvalOriginal is { Length: >= 2 } && approvalOriginal.Length <= MaximumApprovalBytes &&
            profileOriginal is { Length: >= 2 } && profileOriginal.Length <= NativeHostProfileV2.MaximumCanonicalBytes &&
            sourceSetOriginal is { Length: >= 2 } &&
            sourceSetOriginal.Length <= MaximumExternalBytes &&
            packageManifestOriginal is { Length: >= 2 } &&
            packageManifestOriginal.Length <= MaximumExternalBytes &&
            runtimeInventoryOriginal is { Length: >= 2 } &&
            runtimeInventoryOriginal.Length <= MaximumInventoryBytes,
            "NATIVE_INPUT_ORIGINAL_REQUIRED");
        // Own every supplied byte stream before hashing or parsing; the returned
        // objects retain no caller-owned arrays, lists or JsonElement lifetimes.
        byte[] planBytes = (byte[])planOriginal.Clone();
        byte[] approvalBytes = (byte[])approvalOriginal.Clone();
        byte[] profileBytes = (byte[])profileOriginal.Clone();
        byte[] sourceBytes = (byte[])sourceSetOriginal.Clone();
        byte[] packageBytes = (byte[])packageManifestOriginal.Clone();
        byte[] inventoryBytes = (byte[])runtimeInventoryOriginal.Clone();
        NativeHostProfileV2 profile = NativeHostProfileV2.ParseCanonical(profileBytes);
        NativeHostPlanV2 plan = ParsePlan(planBytes, profile);
        NativeHostApprovalV2 approval = ParseApproval(approvalBytes, plan);
        IReadOnlyList<NativeHostFilePinV2> inventory = ParseRuntimeInventory(inventoryBytes, profile);
        Need(plan.ProfileSha256 == Hash(profileBytes) &&
            plan.SourceSetSha256 == Hash(sourceBytes) &&
            plan.PackageManifestSha256 == Hash(packageBytes) &&
            plan.RuntimeInventorySha256 == Hash(inventoryBytes) &&
            inventory.SequenceEqual(plan.FrameworkInventory),
            "NATIVE_INPUT_ORIGINAL_BINDING_REFUSED");
        Need(nowUtc.Offset == TimeSpan.Zero && nowUtc >= approval.IssuedUtc &&
            nowUtc < approval.ExpiresUtc && nowUtc >= plan.IssuedUtc &&
            nowUtc < plan.ExpiresUtc, "NATIVE_INPUT_WINDOW_REFUSED");
        return new NativeHostBoundInputV2(profile, plan, approval);
    }
}
