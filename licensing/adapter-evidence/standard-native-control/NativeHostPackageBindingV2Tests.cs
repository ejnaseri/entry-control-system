using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostPackageBindingV2Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly string[] Roles = {
        "native-host", "native-loader", "managed-bootstrap", "controller",
        "collector", "protected-store", "worker-channel"
    };
    private static readonly string[] Paths = {
        "licensing/adapter-evidence/standard-native-host/standard_host_core.c",
        "licensing/adapter-evidence/standard-native-loader/standard_loader_core.c",
        "licensing/adapter-evidence/standard-native-control/NativeEntryV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeControllerV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeCollectorV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeProtectedStoreV2.cs",
        "licensing/adapter-evidence/standard-native-control/NativeWorkerChannelV2.cs"
    };
    private static byte[] B(string s) => Encoding.UTF8.GetBytes(s);
    private static byte[] Copy(byte[] x) => (byte[])x.Clone();
    private static string S(byte[] x) => Encoding.UTF8.GetString(x);
    private static byte[] Changed(byte[] raw) { byte[] copy = Copy(raw); copy[^1] ^= 1; return copy; }

    private sealed class LyingList<T> : IReadOnlyList<T>
    {
        private readonly IReadOnlyList<T> values;
        internal LyingList(IReadOnlyList<T> values, int claimedCount) {
            this.values = values; Count = claimedCount;
        }
        public int Count { get; }
        public T this[int index] => values[index];
        public IEnumerator<T> GetEnumerator() => values.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    private sealed class World
    {
        internal readonly NativeHostSourceBytesV2[] Sources;
        internal readonly NativeHostRuntimeBytesV2[] Runtime;
        internal readonly byte[] SourceSet, Manifest, Inventory, Profile, Plan, Approval;
        internal readonly byte[] Image, Assembly, Config, Hostfxr;
        internal readonly NativeHostProfileV2 ProfileObject;
        internal readonly NativeHostFilePinV2[] RuntimePins;
        internal readonly NativeHostAssetPinV2 ImagePin, AssemblyPin, ConfigPin, HostfxrPin;

        internal World(int variant = 0)
        {
            // Synthetic bytes only. They are deliberately not a PE image,
            // managed Bootstrap assembly, installed hostfxr or runtime tree.
            Sources = Enumerable.Range(0, Roles.Length).Select(i => new NativeHostSourceBytesV2(
                Roles[i], Paths[i], B("synthetic-candidate-source:" + variant + ":" + i))).ToArray();
            NativeHostSourcePinV2[] sourcePins = Sources.Select(x => new NativeHostSourcePinV2(
                x.Role, x.Relative, x.Original.Length, NativeHostInputCodecV2.Hash(x.Original))).ToArray();
            SourceSet = NativeHostPackageBindingV2.EncodeSourceSet(sourcePins);
            ProfileObject = NativeHostProfileV2.Create(Attempt, NativeHostInputCodecV2.Hash(SourceSet));
            Profile = ProfileObject.CanonicalBytes();
            Image = B("synthetic-native-image:" + variant);
            Assembly = B("synthetic-managed-assembly:" + variant);
            Config = B(NativeHostProfileV2.ConfigJson);
            Hostfxr = B("synthetic-hostfxr:" + variant);
            ImagePin = Pin(Image); AssemblyPin = Pin(Assembly);
            ConfigPin = Pin(Config); HostfxrPin = Pin(Hostfxr);
            Runtime = Enumerable.Range(0, NativeHostInputCodecV2.FrameworkFileCount)
                .Select(i => new NativeHostRuntimeBytesV2(NativeHostInputCodecV2.ExpectedRuntimeLeaf(i),
                    B("synthetic-runtime:" + variant + ":" + i))).ToArray();
            RuntimePins = Runtime.Select(x => new NativeHostFilePinV2(x.Name,
                x.Original.Length, NativeHostInputCodecV2.Hash(x.Original))).ToArray();
            Inventory = NativeHostInputCodecV2.EncodeRuntimeInventory(ProfileObject, RuntimePins);
            Manifest = NativeHostPackageBindingV2.EncodeManifest(ProfileObject, SourceSet,
                ImagePin, AssemblyPin, ConfigPin, HostfxrPin, RuntimePins);
            Plan = MakePlan(Manifest).CanonicalBytes();
            Approval = MakeApproval(MakePlan(Manifest)).CanonicalBytes();
        }
        private static NativeHostAssetPinV2 Pin(byte[] raw) =>
            new(raw.Length, NativeHostInputCodecV2.Hash(raw));
        internal NativeHostPlanV2 MakePlan(byte[] manifest) => new(ProfileObject, Attempt,
            Issued, Issued.AddMinutes(90), new string('d', 64), new string('e', 64),
            NativeHostInputCodecV2.Hash(manifest), NativeHostInputCodecV2.Hash(Inventory),
            ImagePin, AssemblyPin, ConfigPin, HostfxrPin, RuntimePins);
        internal NativeHostApprovalV2 MakeApproval(NativeHostPlanV2 plan) =>
            new(plan, Issued.AddMinutes(1), Issued.AddMinutes(60));
        internal NativeHostPackageCandidateV2 Bind(byte[]? profile = null, byte[]? sourceSet = null,
            byte[]? manifest = null, byte[]? inventory = null, byte[]? plan = null,
            byte[]? approval = null, IReadOnlyList<NativeHostSourceBytesV2>? sources = null,
            byte[]? image = null, byte[]? assembly = null, byte[]? config = null,
            byte[]? hostfxr = null, IReadOnlyList<NativeHostRuntimeBytesV2>? runtime = null,
            DateTimeOffset? now = null) => NativeHostPackageBindingV2.BindCandidate(
                profile ?? Profile, sourceSet ?? SourceSet, manifest ?? Manifest,
                inventory ?? Inventory, plan ?? Plan, approval ?? Approval,
                sources ?? Sources, image ?? Image, assembly ?? Assembly,
                config ?? Config, hostfxr ?? Hostfxr, runtime ?? Runtime,
                now ?? Issued.AddMinutes(5));
        internal NativeHostPackageCandidateV2 BindManifest(byte[] changedManifest)
        {
            NativeHostPlanV2 plan = MakePlan(changedManifest);
            return Bind(manifest: changedManifest, plan: plan.CanonicalBytes(),
                approval: MakeApproval(plan).CanonicalBytes());
        }
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("NATIVE_PACKAGE_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_PACKAGE_REFUSAL_MISSING_" + checks);
        }

        var w = new World();
        NativeHostPackageCandidateV2 c = w.Bind();
        Check(c.ProfileSha256 == NativeHostInputCodecV2.Hash(w.Profile));
        Check(c.SourceSetSha256 == NativeHostInputCodecV2.Hash(w.SourceSet));
        Check(c.PackageManifestSha256 == NativeHostInputCodecV2.Hash(w.Manifest));
        Check(c.PlanSha256 == NativeHostInputCodecV2.Hash(w.Plan));
        Check(c.ApprovalSha256 == NativeHostInputCodecV2.Hash(w.Approval));
        Check(c.Bound.Approval.PlanSha256 == c.PlanSha256);
        Check(c.Sources.Count == 7 && c.Runtime.Count == 189);
        Check(c.Sources.Select(x => x.Role).SequenceEqual(Roles));
        Check(c.Sources.Select(x => x.Relative).SequenceEqual(Paths));
        Check(c.Runtime.Select(x => x.Name).SequenceEqual(w.Runtime.Select(x => x.Name)));
        Check(c.Original(0).SequenceEqual(w.Profile));
        Check(c.Original(1).SequenceEqual(w.SourceSet));
        Check(c.Original(2).SequenceEqual(w.Manifest));
        Check(c.Original(3).SequenceEqual(w.Inventory));
        Check(c.Original(4).SequenceEqual(w.Plan));
        Check(c.Original(5).SequenceEqual(w.Approval));
        for (int i = 0; i < 7; i++) Check(c.SourceOriginal(i).SequenceEqual(w.Sources[i].Original));
        foreach (NativeHostPackageAssetV2 a in Enum.GetValues<NativeHostPackageAssetV2>())
            Check(c.AssetOriginal(a).SequenceEqual(a switch {
                NativeHostPackageAssetV2.Image => w.Image,
                NativeHostPackageAssetV2.Assembly => w.Assembly,
                NativeHostPackageAssetV2.Config => w.Config,
                NativeHostPackageAssetV2.Hostfxr => w.Hostfxr,
                _ => throw new InvalidDataException("NATIVE_PACKAGE_TEST_ASSET")
            }));
        for (int i = 0; i < 189; i++) Check(c.RuntimeOriginal(i).SequenceEqual(w.Runtime[i].Original));
        Check(!c.PhysicalKitReady && !c.NativeAuthorized && !c.GrantAuthorized &&
            !c.PhysicalW03Accepted && !c.SecurityAccepted && !c.ProductionAccepted && !c.Lic008Closed);
        Refused(() => NativeHostPackageBindingV2.RequirePhysicalAdmission(c));
        Refused(() => NativeHostPackageBindingV2.RequirePhysicalAdmission(null!));

        using (JsonDocument doc = JsonDocument.Parse(w.SourceSet)) {
            JsonElement r = doc.RootElement;
            Check(r.GetProperty("schema").GetString() == NativeHostPackageBindingV2.SourceSetSchema);
            Check(r.GetProperty("purpose").GetString() == NativeHostPackageBindingV2.SourcePurpose);
            Check(r.GetProperty("sources").GetArrayLength() == 7);
            Check(r.GetProperty("claims").EnumerateObject().All(p => p.Value.ValueKind == JsonValueKind.False));
        }
        using (JsonDocument doc = JsonDocument.Parse(w.Manifest)) {
            JsonElement r = doc.RootElement;
            Check(r.GetProperty("schema").GetString() == NativeHostPackageBindingV2.ManifestSchema);
            Check(r.GetProperty("purpose").GetString() == NativeHostPackageBindingV2.ManifestPurpose);
            Check(r.GetProperty("profileSha256").GetString() == c.ProfileSha256);
            Check(r.GetProperty("sourceSetSha256").GetString() == c.SourceSetSha256);
            Check(r.GetProperty("binLeaves").EnumerateArray().Select(x => x.GetString()).SequenceEqual(
                new[] { "StandardControlHost.exe", "StandardControl.dll", "StandardControl.runtimeconfig.json" }));
            Check(r.GetProperty("runtimeInventory").GetProperty("files").GetArrayLength() == 189);
            Check(r.GetProperty("claims").EnumerateObject().All(p => p.Value.ValueKind == JsonValueKind.False));
            Check(!r.TryGetProperty("planSha256", out _)); // avoid plan/manifest digest cycle
        }

        // Return values are defensive copies and the candidate survives all
        // later changes to caller-owned original byte arrays and descriptors.
        for (int i = 0; i < 6; i++) {
            byte[] copy = c.Original(i); copy[0] ^= 1;
            Check(c.Original(i)[0] != copy[0]);
        }
        byte[] sourceCopy = c.SourceOriginal(0); sourceCopy[0] ^= 1;
        Check(c.SourceOriginal(0)[0] != sourceCopy[0]);
        byte[] assetCopy = c.AssetOriginal(NativeHostPackageAssetV2.Image); assetCopy[0] ^= 1;
        Check(c.AssetOriginal(NativeHostPackageAssetV2.Image)[0] != assetCopy[0]);
        byte[] runtimeCopy = c.RuntimeOriginal(0); runtimeCopy[0] ^= 1;
        Check(c.RuntimeOriginal(0)[0] != runtimeCopy[0]);
        byte[][] originalInputs = { Copy(w.Profile), Copy(w.SourceSet), Copy(w.Manifest),
            Copy(w.Inventory), Copy(w.Plan), Copy(w.Approval) };
        NativeHostSourceBytesV2[] inputSources = w.Sources.Select(x => x with { Original = Copy(x.Original) }).ToArray();
        NativeHostRuntimeBytesV2[] inputRuntime = w.Runtime.Select(x => x with { Original = Copy(x.Original) }).ToArray();
        byte[][] inputAssets = { Copy(w.Image), Copy(w.Assembly), Copy(w.Config), Copy(w.Hostfxr) };
        NativeHostPackageCandidateV2 frozen = w.Bind(originalInputs[0], originalInputs[1],
            originalInputs[2], originalInputs[3], originalInputs[4], originalInputs[5],
            inputSources, inputAssets[0], inputAssets[1], inputAssets[2], inputAssets[3], inputRuntime);
        foreach (byte[] raw in originalInputs) raw[0] ^= 1;
        foreach (NativeHostSourceBytesV2 x in inputSources) x.Original[0] ^= 1;
        foreach (NativeHostRuntimeBytesV2 x in inputRuntime) x.Original[0] ^= 1;
        foreach (byte[] raw in inputAssets) raw[0] ^= 1;
        for (int i = 0; i < 6; i++) Check(frozen.Original(i)[0] != originalInputs[i][0]);
        for (int i = 0; i < 7; i++) Check(frozen.SourceOriginal(i)[0] != inputSources[i].Original[0]);
        for (int i = 0; i < 189; i++) Check(frozen.RuntimeOriginal(i)[0] != inputRuntime[i].Original[0]);
        for (int i = 0; i < 4; i++) Check(frozen.AssetOriginal((NativeHostPackageAssetV2)i)[0] != inputAssets[i][0]);
        Check(frozen.ProfileSha256 == c.ProfileSha256 && frozen.PlanSha256 == c.PlanSha256);

        // Every original is part of one hash chain; a local byte substitution
        // fails even when all seven source roles and 189 runtime names remain.
        Refused(() => w.Bind(profile: Changed(w.Profile)));
        Refused(() => w.Bind(sourceSet: Changed(w.SourceSet)));
        Refused(() => w.Bind(manifest: Changed(w.Manifest)));
        Refused(() => w.Bind(inventory: Changed(w.Inventory)));
        Refused(() => w.Bind(plan: Changed(w.Plan)));
        Refused(() => w.Bind(approval: Changed(w.Approval)));
        Refused(() => w.Bind(image: Changed(w.Image)));
        Refused(() => w.Bind(assembly: Changed(w.Assembly)));
        Refused(() => w.Bind(config: Changed(w.Config)));
        Refused(() => w.Bind(hostfxr: Changed(w.Hostfxr)));
        for (int i = 0; i < 7; i++) {
            NativeHostSourceBytesV2[] changed = w.Sources.ToArray();
            changed[i] = changed[i] with { Original = Changed(changed[i].Original) };
            Refused(() => w.Bind(sources: changed));
        }
        for (int i = 0; i < 189; i++) {
            NativeHostRuntimeBytesV2[] changed = w.Runtime.ToArray();
            changed[i] = changed[i] with { Original = Changed(changed[i].Original) };
            Refused(() => w.Bind(runtime: changed));
        }

        // Source-set canonical/schema/shape checks, including the exact
        // archived test-only build schemas, do not merely compare SHA strings.
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B("{\"schema\":\"TEST_ONLY_STANDARD_NATIVE_LOADER_SOURCE_SET_V1\",\"inputs\":[]}")));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B("{\"schema\":\"TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_SOURCE_SET_V1\",\"inputs\":[]}")));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B("{\"schema\":\"TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_COMPONENT_BUILD_V1\",\"inputs\":[]}")));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B("\uFEFF" + S(w.SourceSet))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(new byte[] { 0xff, 0xfe, 0x7b }));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(" " + S(w.SourceSet))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet) + "\n")));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            "\"schema\":", "\"extra\":0,\"schema\":", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            "\"schema\":", "\"schema\":\"x\",\"schema\":", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            "\"purpose\":", "\"purpose\":\"x\",\"purpose\":", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            NativeHostPackageBindingV2.SourceSetSchema, "TEST_ONLY_STANDARD_NATIVE_LOADER_SOURCE_SET_V1", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            "native-host", "native-loader", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            Paths[0], "out/test-only.exe", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.ParseSourceSet(B(S(w.SourceSet).Replace(
            "\"sources\":[", "\"sources\":[],\"old\":[", StringComparison.Ordinal))));
        Refused(() => NativeHostPackageBindingV2.EncodeSourceSet(
            w.Sources.Take(6).Select(x => new NativeHostSourcePinV2(x.Role, x.Relative,
                x.Original.Length, NativeHostInputCodecV2.Hash(x.Original))).ToArray()));
        NativeHostSourcePinV2[] reversed = w.Sources.Select(x => new NativeHostSourcePinV2(x.Role,
            x.Relative, x.Original.Length, NativeHostInputCodecV2.Hash(x.Original))).Reverse().ToArray();
        Refused(() => NativeHostPackageBindingV2.EncodeSourceSet(reversed));
        NativeHostSourcePinV2[] duplicate = w.Sources.Select(x => new NativeHostSourcePinV2(x.Role,
            x.Relative, x.Original.Length, NativeHostInputCodecV2.Hash(x.Original))).ToArray();
        duplicate[1] = duplicate[0];
        Refused(() => NativeHostPackageBindingV2.EncodeSourceSet(duplicate));

        void BadManifest(byte[] raw) => Refused(() => w.BindManifest(raw));
        BadManifest(B(S(w.Manifest).Replace(NativeHostPackageBindingV2.ManifestSchema,
            "TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_COMPONENT_BUILD_V1", StringComparison.Ordinal)));
        BadManifest(B("\uFEFF" + S(w.Manifest)));
        BadManifest(B(" " + S(w.Manifest)));
        BadManifest(B(S(w.Manifest).Replace("\"schema\":", "\"extra\":0,\"schema\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"schema\":", "\"schema\":\"x\",\"schema\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"profileSha256\":", "\"profileSha256\":\"x\",\"profileSha256\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"attempt\":", "\"attempt\":\"x\",\"attempt\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"binLeaves\":[", "\"binLeaves\":[\"extra.exe\",", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("StandardControl.runtimeconfig.json\"]", "StandardControl.runtimeconfig.json\",\"StandardControl.deps.json\"]", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"files\":[", "\"files\":[],\"old\":[", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"claims\":", "\"claims\":{\"physicalKitReady\":true},\"oldClaims\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"runtime\":", "\"unexpected\":0,\"runtime\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"image\":", "\"image\":\"wrong\",\"oldImage\":", StringComparison.Ordinal)));
        BadManifest(B(S(w.Manifest).Replace("\"sourceSetSha256\":\"" + c.SourceSetSha256 + "\"",
            "\"sourceSetSha256\":\"" + new string('0', 64) + "\"", StringComparison.Ordinal)));

        NativeHostRuntimeBytesV2[] runtimeMissing = w.Runtime.Take(188).ToArray();
        Refused(() => w.Bind(runtime: runtimeMissing));
        NativeHostRuntimeBytesV2[] runtimeExtra = w.Runtime.Append(w.Runtime[0]).ToArray();
        Refused(() => w.Bind(runtime: runtimeExtra));
        NativeHostRuntimeBytesV2[] runtimeReordered = w.Runtime.ToArray();
        (runtimeReordered[0], runtimeReordered[1]) = (runtimeReordered[1], runtimeReordered[0]);
        Refused(() => w.Bind(runtime: runtimeReordered));
        NativeHostRuntimeBytesV2[] runtimeDuplicate = w.Runtime.ToArray(); runtimeDuplicate[1] = runtimeDuplicate[0];
        Refused(() => w.Bind(runtime: runtimeDuplicate));
        NativeHostSourceBytesV2[] sourceExtra = w.Sources.Append(w.Sources[0]).ToArray();
        Refused(() => w.Bind(sources: sourceExtra));
        NativeHostSourceBytesV2[] sourceReordered = w.Sources.Reverse().ToArray();
        Refused(() => w.Bind(sources: sourceReordered));
        Refused(() => w.Bind(sources: new LyingList<NativeHostSourceBytesV2>(sourceExtra, 7)));
        Refused(() => w.Bind(sources: new LyingList<NativeHostSourceBytesV2>(w.Sources.Take(6).ToArray(), 7)));
        Refused(() => w.Bind(runtime: new LyingList<NativeHostRuntimeBytesV2>(runtimeExtra, 189)));
        Refused(() => w.Bind(runtime: new LyingList<NativeHostRuntimeBytesV2>(runtimeMissing, 189)));

        // One shared input buffer makes this a cheap test of the 192 MiB
        // declared aggregate cap; the binder must refuse before cloning it
        // 189 times. All names, sizes and digest pins otherwise match.
        byte[] sharedLarge = new byte[2 * 1024 * 1024];
        string largeSha = NativeHostInputCodecV2.Hash(sharedLarge);
        NativeHostRuntimeBytesV2[] largeRuntime = w.Runtime.Select(x =>
            new NativeHostRuntimeBytesV2(x.Name, sharedLarge)).ToArray();
        NativeHostFilePinV2[] largePins = largeRuntime.Select(x => new NativeHostFilePinV2(
            x.Name, sharedLarge.Length, largeSha)).ToArray();
        byte[] largeInventory = NativeHostInputCodecV2.EncodeRuntimeInventory(w.ProfileObject, largePins);
        byte[] largeManifest = NativeHostPackageBindingV2.EncodeManifest(w.ProfileObject, w.SourceSet,
            w.ImagePin, w.AssemblyPin, w.ConfigPin, w.HostfxrPin, largePins);
        NativeHostPlanV2 largePlan = new(w.ProfileObject, Attempt, Issued,
            Issued.AddMinutes(90), new string('d', 64), new string('e', 64),
            NativeHostInputCodecV2.Hash(largeManifest), NativeHostInputCodecV2.Hash(largeInventory),
            w.ImagePin, w.AssemblyPin, w.ConfigPin, w.HostfxrPin, largePins);
        NativeHostApprovalV2 largeApproval = w.MakeApproval(largePlan);
        Refused(() => w.Bind(manifest: largeManifest, inventory: largeInventory,
            plan: largePlan.CanonicalBytes(), approval: largeApproval.CanonicalBytes(),
            runtime: largeRuntime));

        // An attacker can coherently replace all unsigned synthetic inputs.
        // Pure structural consistency still cannot authenticate Owner intent.
        var reissued = new World(1);
        NativeHostPackageCandidateV2 other = reissued.Bind();
        Check(other.SourceSetSha256 != c.SourceSetSha256 && other.PlanSha256 != c.PlanSha256);
        Check(!other.PhysicalKitReady && !other.NativeAuthorized && !other.GrantAuthorized);
        Refused(() => NativeHostPackageBindingV2.RequirePhysicalAdmission(other));
        Refused(() => w.Bind(now: Issued.AddMinutes(60)));
        Refused(() => w.Bind(now: Issued.AddMinutes(-1)));
        return checks;
    }
}
