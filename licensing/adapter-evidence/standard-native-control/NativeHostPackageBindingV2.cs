using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal sealed record NativeHostSourcePinV2(string Role, string Relative, long Size, string Sha256);
internal sealed record NativeHostSourceBytesV2(string Role, string Relative, byte[] Original);
internal sealed record NativeHostRuntimeBytesV2(string Name, byte[] Original);

internal enum NativeHostPackageAssetV2 { Image, Assembly, Config, Hostfxr }

// An immutable statement about injected bytes. It is not a reviewed build,
// protected file custody, a signature, a loaded-module attestation, or an
// operational approval. In particular the current V2 approval is CLOSED_ONLY.
internal sealed class NativeHostPackageCandidateV2
{
    private readonly byte[][] originals;
    private readonly byte[][] sourceBytes;
    private readonly byte[][] assetBytes;
    private readonly byte[][] runtimeBytes;
    internal NativeHostBoundInputV2 Bound { get; }
    internal IReadOnlyList<NativeHostSourcePinV2> Sources { get; }
    internal IReadOnlyList<NativeHostFilePinV2> Runtime { get; }
    internal string ProfileSha256 => Bound.Profile.CanonicalSha256;
    internal string SourceSetSha256 => Bound.Profile.SourceSetSha256;
    internal string PackageManifestSha256 => Bound.Plan.PackageManifestSha256;
    internal string PlanSha256 => Bound.PlanSha256;
    internal string ApprovalSha256 => Bound.ApprovalSha256;
    internal bool PhysicalKitReady => false;
    internal bool NativeAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool PhysicalW03Accepted => false;
    internal bool SecurityAccepted => false;
    internal bool ProductionAccepted => false;
    internal bool Lic008Closed => false;

    internal NativeHostPackageCandidateV2(NativeHostBoundInputV2 bound,
        IReadOnlyList<NativeHostSourcePinV2> sources, IReadOnlyList<NativeHostFilePinV2> runtime,
        byte[][] originals, byte[][] sourceBytes, byte[][] assetBytes, byte[][] runtimeBytes)
    {
        Bound = bound;
        Sources = Array.AsReadOnly(sources.ToArray());
        Runtime = Array.AsReadOnly(runtime.ToArray());
        this.originals = originals.Select(x => (byte[])x.Clone()).ToArray();
        this.sourceBytes = sourceBytes.Select(x => (byte[])x.Clone()).ToArray();
        this.assetBytes = assetBytes.Select(x => (byte[])x.Clone()).ToArray();
        this.runtimeBytes = runtimeBytes.Select(x => (byte[])x.Clone()).ToArray();
    }

    // 0 profile, 1 source set, 2 manifest, 3 inventory, 4 plan, 5 approval.
    internal byte[] Original(int index) => (byte[])originals[index].Clone();
    internal byte[] SourceOriginal(int index) => (byte[])sourceBytes[index].Clone();
    internal byte[] AssetOriginal(NativeHostPackageAssetV2 asset) =>
        (byte[])assetBytes[(int)asset].Clone();
    internal byte[] RuntimeOriginal(int index) => (byte[])runtimeBytes[index].Clone();
}

internal static class NativeHostPackageBindingV2
{
    internal const string SourceSetSchema = "CANDIDATE_STANDARD_NATIVE_HOST_SOURCE_SET_V2";
    internal const string ManifestSchema = "CANDIDATE_STANDARD_NATIVE_HOST_PACKAGE_MANIFEST_V2";
    internal const string SourcePurpose = "W03_SEVEN_COMPONENT_ANCHORS_CONTENT_ONLY";
    internal const string ManifestPurpose = "W03_CLOSED_PACKAGE_CONTENT_ONLY";
    internal const int MaximumSourceSetBytes = 8192;
    internal const int MaximumManifestBytes = 65536;
    internal const long MaximumTotalOriginalBytes = 192L * 1024 * 1024;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonDocumentOptions JsonOptions = new() {
        AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow, MaxDepth = 8
    };
    private static readonly string[] Roles = {
        "native-host", "native-loader", "managed-bootstrap", "controller",
        "collector", "protected-store", "worker-channel"
    };
    // This is an exact seven-anchor candidate list, not a complete build
    // graph or source-to-binary proof. Additional physical inputs require a
    // separately reviewed contract, never an implicit wildcard here.
    private static readonly string[] SourcePaths = {
        "licensing/adapter-evidence/standard-native-host/standard_host_core.c",
        "licensing/adapter-evidence/standard-native-loader/standard_loader_core.c",
        "licensing/adapter-evidence/standard-native-control/NativeEntryV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeControllerV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeCollectorV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeProtectedStoreV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeWorkerChannelV2.cs"
    };

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value) => value is { Length: 64 } &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static byte[] CloneBounded(byte[]? bytes, int maximum, string code)
    {
        Need(bytes is { Length: >= 1 } && bytes.Length <= maximum, code);
        return (byte[])bytes!.Clone();
    }
    private static void Unique(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object) {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (JsonProperty p in element.EnumerateObject()) {
                Need(seen.Add(p.Name), "NATIVE_PACKAGE_DUPLICATE_REFUSED");
                Unique(p.Value);
            }
        } else if (element.ValueKind == JsonValueKind.Array) {
            foreach (JsonElement child in element.EnumerateArray()) Unique(child);
        }
    }
    private static JsonDocument Read(byte[] original, int maximum)
    {
        Need(original.Length is >= 2 && original.Length <= maximum, "NATIVE_PACKAGE_JSON_SIZE_REFUSED");
        try {
            string decoded = Utf8.GetString(original);
            Need(decoded.IndexOf('\uFEFF') < 0 && Utf8.GetBytes(decoded).AsSpan().SequenceEqual(original),
                "NATIVE_PACKAGE_UTF8_REFUSED");
            JsonDocument doc = JsonDocument.Parse(original, JsonOptions);
            try {
                Need(doc.RootElement.ValueKind == JsonValueKind.Object, "NATIVE_PACKAGE_OBJECT_REFUSED");
                Unique(doc.RootElement);
                return doc;
            } catch { doc.Dispose(); throw; }
        } catch (DecoderFallbackException e) {
            throw new InvalidDataException("NATIVE_PACKAGE_UTF8_REFUSED", e);
        } catch (JsonException e) {
            throw new InvalidDataException("NATIVE_PACKAGE_JSON_REFUSED", e);
        }
    }
    private static T Shape<T>(Func<T> read)
    {
        try { return read(); }
        catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or FormatException or OverflowException) {
            throw new InvalidDataException("NATIVE_PACKAGE_SHAPE_REFUSED", e);
        }
    }
    private static void ValidateSources(IReadOnlyList<NativeHostSourcePinV2>? pins)
    {
        Need(pins is not null && pins.Count == Roles.Length, "NATIVE_PACKAGE_SOURCE_COUNT_REFUSED");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Roles.Length; i++) {
            NativeHostSourcePinV2? p = pins[i];
            Need(p is not null && p.Role == Roles[i] && p.Relative == SourcePaths[i] &&
                p.Size is > 0 and <= 4194304 && LowerHex(p.Sha256) && seen.Add(p.Relative),
                "NATIVE_PACKAGE_SOURCE_PIN_REFUSED");
        }
    }
    private static void WriteClaims(Utf8JsonWriter writer)
    {
        writer.WriteStartObject("claims");
        writer.WriteBoolean("physicalKitReady", false);
        writer.WriteBoolean("nativeAuthorized", false);
        writer.WriteBoolean("grantAuthorized", false);
        writer.WriteBoolean("physicalW03Accepted", false);
        writer.WriteBoolean("securityAccepted", false);
        writer.WriteBoolean("productionAccepted", false);
        writer.WriteBoolean("lic008Closed", false);
        writer.WriteEndObject();
    }
    internal static byte[] EncodeSourceSet(IReadOnlyList<NativeHostSourcePinV2> pins)
    {
        NativeHostSourcePinV2[] snapshot = pins?.ToArray() ??
            throw new InvalidDataException("NATIVE_PACKAGE_SOURCE_COUNT_REFUSED");
        ValidateSources(snapshot);
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream)) {
            w.WriteStartObject();
            w.WriteString("schema", SourceSetSchema);
            w.WriteString("purpose", SourcePurpose);
            w.WriteStartArray("sources");
            foreach (NativeHostSourcePinV2 p in snapshot) {
                w.WriteStartObject();
                w.WriteString("role", p.Role);
                w.WriteString("relative", p.Relative);
                w.WriteNumber("size", p.Size);
                w.WriteString("sha256", p.Sha256);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            WriteClaims(w);
            w.WriteEndObject();
        }
        byte[] result = stream.ToArray();
        Need(result.Length <= MaximumSourceSetBytes, "NATIVE_PACKAGE_SOURCE_SIZE_REFUSED");
        return result;
    }
    internal static IReadOnlyList<NativeHostSourcePinV2> ParseSourceSet(byte[] original)
    {
        byte[] owned = CloneBounded(original, MaximumSourceSetBytes, "NATIVE_PACKAGE_SOURCE_REQUIRED");
        using JsonDocument doc = Read(owned, MaximumSourceSetBytes);
        return Shape(() => {
            JsonElement entries = doc.RootElement.GetProperty("sources");
            Need(entries.ValueKind == JsonValueKind.Array && entries.GetArrayLength() == Roles.Length,
                "NATIVE_PACKAGE_SOURCE_COUNT_REFUSED");
            NativeHostSourcePinV2[] pins = entries.EnumerateArray().Select(x => new NativeHostSourcePinV2(
                x.GetProperty("role").GetString() ?? "", x.GetProperty("relative").GetString() ?? "",
                x.GetProperty("size").GetInt64(), x.GetProperty("sha256").GetString() ?? "")).ToArray();
            Need(owned.AsSpan().SequenceEqual(EncodeSourceSet(pins)),
                "NATIVE_PACKAGE_SOURCE_CANONICAL_REFUSED");
            return Array.AsReadOnly(pins);
        });
    }
    private static void ValidateAsset(NativeHostAssetPinV2? pin, long maximum)
    {
        Need(pin is not null && pin.Size is > 0 && pin.Size <= maximum && LowerHex(pin.Sha256),
            "NATIVE_PACKAGE_ASSET_PIN_REFUSED");
    }
    private static void WriteAsset(Utf8JsonWriter w, string name, string path, NativeHostAssetPinV2 pin)
    {
        w.WriteStartObject(name);
        w.WriteString("path", path);
        w.WriteNumber("size", pin.Size);
        w.WriteString("sha256", pin.Sha256);
        w.WriteEndObject();
    }
    private static NativeHostAssetPinV2 ReadAsset(JsonElement root, string name) =>
        new(root.GetProperty("assets").GetProperty(name).GetProperty("size").GetInt64(),
            root.GetProperty("assets").GetProperty(name).GetProperty("sha256").GetString() ?? "");

    internal static byte[] EncodeManifest(NativeHostProfileV2 profile, byte[] sourceOriginal,
        NativeHostAssetPinV2 image, NativeHostAssetPinV2 assembly,
        NativeHostAssetPinV2 config, NativeHostAssetPinV2 hostfxr,
        IReadOnlyList<NativeHostFilePinV2> runtime)
    {
        Need(profile is not null, "NATIVE_PACKAGE_PROFILE_REQUIRED");
        NativeHostFilePinV2[] runtimeSnapshot = runtime?.ToArray() ??
            throw new InvalidDataException("NATIVE_PACKAGE_RUNTIME_COUNT_REFUSED");
        byte[] source = CloneBounded(sourceOriginal, MaximumSourceSetBytes, "NATIVE_PACKAGE_SOURCE_REQUIRED");
        ParseSourceSet(source);
        Need(profile.SourceSetSha256 == NativeHostInputCodecV2.Hash(source),
            "NATIVE_PACKAGE_SOURCE_PROFILE_REFUSED");
        ValidateAsset(image, 16777216); ValidateAsset(assembly, 16777216);
        ValidateAsset(config, 4096); ValidateAsset(hostfxr, 16777216);
        byte[] exactConfig = Utf8.GetBytes(NativeHostProfileV2.ConfigJson);
        Need(config.Size == exactConfig.Length && config.Sha256 == NativeHostInputCodecV2.Hash(exactConfig),
            "NATIVE_PACKAGE_CONFIG_REFUSED");
        // Reuse the V2 exact 189-leaf and size/hash-pin validation, but do not
        // treat its metadata as evidence of actual protected runtime files.
        NativeHostInputCodecV2.EncodeRuntimeInventory(profile, runtimeSnapshot);
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream)) {
            w.WriteStartObject();
            w.WriteString("schema", ManifestSchema);
            w.WriteString("purpose", ManifestPurpose);
            w.WriteString("attempt", profile.Attempt);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("profileSha256", profile.CanonicalSha256);
            w.WriteString("sourceSetSha256", profile.SourceSetSha256);
            w.WriteStartObject("assets");
            WriteAsset(w, "image", NativeHostProfileV2.Image, image);
            WriteAsset(w, "assembly", NativeHostProfileV2.Assembly, assembly);
            WriteAsset(w, "config", NativeHostProfileV2.Config, config);
            WriteAsset(w, "hostfxr", NativeHostProfileV2.Hostfxr, hostfxr);
            w.WriteEndObject();
            w.WriteStartArray("binLeaves");
            w.WriteStringValue("StandardControlHost.exe");
            w.WriteStringValue("StandardControl.dll");
            w.WriteStringValue("StandardControl.runtimeconfig.json");
            w.WriteEndArray();
            w.WriteStartObject("runtimeInventory");
            w.WriteString("runtime", NativeHostProfileV2.Runtime);
            w.WriteStartArray("files");
            foreach (NativeHostFilePinV2 p in runtimeSnapshot) {
                w.WriteStartObject();
                w.WriteString("name", p.Name);
                w.WriteNumber("size", p.Size);
                w.WriteString("sha256", p.Sha256);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            w.WriteEndObject();
            WriteClaims(w);
            w.WriteEndObject();
        }
        byte[] result = stream.ToArray();
        Need(result.Length <= MaximumManifestBytes, "NATIVE_PACKAGE_MANIFEST_SIZE_REFUSED");
        return result;
    }

    private sealed record Manifest(NativeHostAssetPinV2 Image, NativeHostAssetPinV2 Assembly,
        NativeHostAssetPinV2 Config, NativeHostAssetPinV2 Hostfxr,
        IReadOnlyList<NativeHostFilePinV2> Runtime);

    private static Manifest ParseManifest(byte[] original, NativeHostProfileV2 profile, byte[] sourceOriginal)
    {
        byte[] owned = CloneBounded(original, MaximumManifestBytes, "NATIVE_PACKAGE_MANIFEST_REQUIRED");
        using JsonDocument doc = Read(owned, MaximumManifestBytes);
        return Shape(() => {
            JsonElement r = doc.RootElement;
            JsonElement entries = r.GetProperty("runtimeInventory").GetProperty("files");
            Need(entries.ValueKind == JsonValueKind.Array &&
                entries.GetArrayLength() == NativeHostInputCodecV2.FrameworkFileCount,
                "NATIVE_PACKAGE_RUNTIME_COUNT_REFUSED");
            NativeHostFilePinV2[] runtime = entries.EnumerateArray().Select(x => new NativeHostFilePinV2(
                x.GetProperty("name").GetString() ?? "", x.GetProperty("size").GetInt64(),
                x.GetProperty("sha256").GetString() ?? "")).ToArray();
            var manifest = new Manifest(ReadAsset(r, "image"), ReadAsset(r, "assembly"),
                ReadAsset(r, "config"), ReadAsset(r, "hostfxr"), Array.AsReadOnly(runtime));
            Need(owned.AsSpan().SequenceEqual(EncodeManifest(profile, sourceOriginal,
                manifest.Image, manifest.Assembly, manifest.Config, manifest.Hostfxr, manifest.Runtime)),
                "NATIVE_PACKAGE_MANIFEST_CANONICAL_REFUSED");
            return manifest;
        });
    }

    private static void CheckBytes(byte[] original, long size, string sha, string code)
    {
        Need(original.LongLength == size && NativeHostInputCodecV2.Hash(original) == sha, code);
    }

    internal static NativeHostPackageCandidateV2 BindCandidate(
        byte[] profileOriginal, byte[] sourceSetOriginal, byte[] manifestOriginal,
        byte[] inventoryOriginal, byte[] planOriginal, byte[] approvalOriginal,
        IReadOnlyList<NativeHostSourceBytesV2> sourceOriginals,
        byte[] imageOriginal, byte[] assemblyOriginal, byte[] configOriginal, byte[] hostfxrOriginal,
        IReadOnlyList<NativeHostRuntimeBytesV2> runtimeOriginals, DateTimeOffset nowUtc)
    {
        byte[][] originals = {
            CloneBounded(profileOriginal, NativeHostProfileV2.MaximumCanonicalBytes, "NATIVE_PACKAGE_PROFILE_REQUIRED"),
            CloneBounded(sourceSetOriginal, MaximumSourceSetBytes, "NATIVE_PACKAGE_SOURCE_REQUIRED"),
            CloneBounded(manifestOriginal, MaximumManifestBytes, "NATIVE_PACKAGE_MANIFEST_REQUIRED"),
            CloneBounded(inventoryOriginal, NativeHostInputCodecV2.MaximumInventoryBytes, "NATIVE_PACKAGE_INVENTORY_REQUIRED"),
            CloneBounded(planOriginal, NativeHostInputCodecV2.MaximumPlanBytes, "NATIVE_PACKAGE_PLAN_REQUIRED"),
            CloneBounded(approvalOriginal, NativeHostInputCodecV2.MaximumApprovalBytes, "NATIVE_PACKAGE_APPROVAL_REQUIRED")
        };
        Need(sourceOriginals is not null && sourceOriginals.Count == Roles.Length,
            "NATIVE_PACKAGE_SOURCE_BYTES_COUNT_REFUSED");
        Need(runtimeOriginals is not null &&
            runtimeOriginals.Count == NativeHostInputCodecV2.FrameworkFileCount,
            "NATIVE_PACKAGE_RUNTIME_BYTES_COUNT_REFUSED");
        NativeHostSourceBytesV2[] sourceDescriptors = sourceOriginals.ToArray();
        NativeHostRuntimeBytesV2[] runtimeDescriptors = runtimeOriginals.ToArray();
        Need(sourceDescriptors.Length == Roles.Length,
            "NATIVE_PACKAGE_SOURCE_SNAPSHOT_COUNT_REFUSED");
        Need(runtimeDescriptors.Length == NativeHostInputCodecV2.FrameworkFileCount,
            "NATIVE_PACKAGE_RUNTIME_SNAPSHOT_COUNT_REFUSED");
        // Parse the small bounded originals before touching bulk payloads.
        IReadOnlyList<NativeHostSourcePinV2> pins = ParseSourceSet(originals[1]);
        NativeHostBoundInputV2 bound = NativeHostInputCodecV2.Bind(originals[4], originals[5],
            originals[0], originals[1], originals[2], originals[3], nowUtc);
        Manifest manifest = ParseManifest(originals[2], bound.Profile, originals[1]);
        Need(bound.Plan.ProfileSha256 == NativeHostInputCodecV2.Hash(originals[0]) &&
            bound.Profile.SourceSetSha256 == NativeHostInputCodecV2.Hash(originals[1]) &&
            bound.Plan.PackageManifestSha256 == NativeHostInputCodecV2.Hash(originals[2]) &&
            bound.Plan.RuntimeInventorySha256 == NativeHostInputCodecV2.Hash(originals[3]) &&
            bound.Approval.PlanSha256 == NativeHostInputCodecV2.Hash(originals[4]) &&
            bound.ApprovalSha256 == NativeHostInputCodecV2.Hash(originals[5]),
            "NATIVE_PACKAGE_CHAIN_REFUSED");
        Need(manifest.Image == bound.Plan.Image && manifest.Assembly == bound.Plan.Assembly &&
            manifest.Config == bound.Plan.Config && manifest.Hostfxr == bound.Plan.Hostfxr &&
            manifest.Runtime.SequenceEqual(bound.Plan.FrameworkInventory),
            "NATIVE_PACKAGE_MANIFEST_PLAN_REFUSED");
        byte[]?[] suppliedAssets = { imageOriginal, assemblyOriginal, configOriginal, hostfxrOriginal };
        NativeHostAssetPinV2[] assetPins = { manifest.Image, manifest.Assembly,
            manifest.Config, manifest.Hostfxr };
        long aggregate = originals.Sum(x => (long)x.Length);
        for (int i = 0; i < pins.Count; i++) {
            Need(sourceDescriptors[i] is not null && sourceDescriptors[i].Role == pins[i].Role &&
                sourceDescriptors[i].Relative == pins[i].Relative &&
                sourceDescriptors[i].Original is { Length: > 0 } &&
                sourceDescriptors[i].Original.LongLength == pins[i].Size,
                "NATIVE_PACKAGE_SOURCE_DESCRIPTOR_REFUSED");
            aggregate = checked(aggregate + pins[i].Size);
        }
        for (int i = 0; i < assetPins.Length; i++) {
            Need(suppliedAssets[i] is { Length: > 0 } &&
                suppliedAssets[i]!.LongLength == assetPins[i].Size,
                "NATIVE_PACKAGE_ASSET_SIZE_REFUSED");
            aggregate = checked(aggregate + assetPins[i].Size);
        }
        for (int i = 0; i < runtimeDescriptors.Length; i++) {
            Need(runtimeDescriptors[i] is not null && runtimeDescriptors[i].Name == manifest.Runtime[i].Name &&
                runtimeDescriptors[i].Original is { Length: > 0 } &&
                runtimeDescriptors[i].Original.LongLength == manifest.Runtime[i].Size,
                "NATIVE_PACKAGE_RUNTIME_DESCRIPTOR_REFUSED");
            aggregate = checked(aggregate + manifest.Runtime[i].Size);
        }
        Need(aggregate <= MaximumTotalOriginalBytes, "NATIVE_PACKAGE_AGGREGATE_SIZE_REFUSED");
        // Every bulk payload is cloned once after its declared name, size and
        // aggregate bound pass. Hashes always apply to these retained copies.
        byte[][] sources = sourceDescriptors.Select(x => (byte[])x.Original.Clone()).ToArray();
        byte[][] assets = suppliedAssets.Select(x => (byte[])x!.Clone()).ToArray();
        byte[][] runtimeBytes = runtimeDescriptors.Select(x => (byte[])x.Original.Clone()).ToArray();
        for (int i = 0; i < pins.Count; i++) {
            CheckBytes(sources[i], pins[i].Size, pins[i].Sha256,
                "NATIVE_PACKAGE_SOURCE_CONTENT_REFUSED");
        }
        for (int i = 0; i < assets.Length; i++)
            CheckBytes(assets[i], assetPins[i].Size, assetPins[i].Sha256,
                "NATIVE_PACKAGE_ASSET_CONTENT_REFUSED");
        for (int i = 0; i < runtimeBytes.Length; i++) {
            CheckBytes(runtimeBytes[i], manifest.Runtime[i].Size, manifest.Runtime[i].Sha256,
                "NATIVE_PACKAGE_RUNTIME_CONTENT_REFUSED");
        }
        return new NativeHostPackageCandidateV2(bound, pins, manifest.Runtime,
            originals, sources, assets, runtimeBytes);
    }

    internal static void RequirePhysicalAdmission(NativeHostPackageCandidateV2 candidate)
    {
        Need(candidate is not null, "NATIVE_PACKAGE_CANDIDATE_REQUIRED");
        // The only available approval is explicitly CLOSED_APPROVAL_ONLY and
        // no live protected file/process/token/SCM/CLR facts are accepted here.
        throw new InvalidDataException("NATIVE_PACKAGE_CLOSED_APPROVAL_PHYSICAL_ADMISSION_REFUSED");
    }
}
