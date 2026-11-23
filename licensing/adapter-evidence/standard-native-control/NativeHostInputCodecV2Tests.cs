using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostInputCodecV2Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Source = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_SOURCE_SET\"}");
    private static readonly byte[] Package = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_PACKAGE_MANIFEST\"}");

    private static NativeHostFilePinV2[] FakeInventory()
    {
        // Inert byte-pin fixture only. Exact leaf names require separate actual
        // file custody and cannot prove the installed runtime's current bytes.
        string[] names = Enumerable.Range(0, NativeHostInputCodecV2.FrameworkFileCount)
            .Select(NativeHostInputCodecV2.ExpectedRuntimeLeaf).ToArray();
        return names.Select((name, index) => new NativeHostFilePinV2(name, index + 1,
            NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(name)))).ToArray();
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("NATIVE_INPUT_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_INPUT_REFUSAL_MISSING_" + checks);
        }

        string sourceSha = NativeHostInputCodecV2.Hash(Source);
        NativeHostProfileV2 profile = NativeHostProfileV2.Create(Attempt, sourceSha);
        byte[] profileOriginal = profile.CanonicalBytes();
        NativeHostFilePinV2[] files = FakeInventory();
        Check(NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(string.Join("\n",
            files.Select(p => p.Name)))) ==
            "5a13c555d61d67fd42b9758e10e6cb55e26476f2477fa1d3a7d54064b9186c66");
        byte[] inventoryOriginal = NativeHostInputCodecV2.EncodeRuntimeInventory(profile, files);
        string inventorySha = NativeHostInputCodecV2.Hash(inventoryOriginal);
        byte[] config = Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson);
        var image = new NativeHostAssetPinV2(252928, new string('a', 64));
        var assembly = new NativeHostAssetPinV2(150000, new string('b', 64));
        var configPin = new NativeHostAssetPinV2(config.Length, NativeHostInputCodecV2.Hash(config));
        var hostfxr = new NativeHostAssetPinV2(400000, new string('c', 64));
        NativeHostPlanV2 MakePlan(NativeHostProfileV2 p, IReadOnlyList<NativeHostFilePinV2> list,
            NativeHostAssetPinV2? cfg = null, DateTimeOffset? issue = null,
            DateTimeOffset? expiry = null) => new(p, Attempt, issue ?? Issued,
                expiry ?? Issued.AddMinutes(90), new string('d', 64), new string('e', 64),
                NativeHostInputCodecV2.Hash(Package), inventorySha, image, assembly,
                cfg ?? configPin, hostfxr, list);
        NativeHostPlanV2 plan = MakePlan(profile, files);
        NativeHostApprovalV2 approval = new(plan, Issued.AddMinutes(1), Issued.AddMinutes(30));
        byte[] planOriginal = plan.CanonicalBytes();
        byte[] approvalOriginal = approval.CanonicalBytes();
        NativeHostBoundInputV2 Bind(byte[]? planBytes = null, byte[]? approvalBytes = null,
            byte[]? profileBytes = null, byte[]? sourceBytes = null,
            byte[]? packageBytes = null, byte[]? inventoryBytes = null,
            DateTimeOffset? now = null) => NativeHostInputCodecV2.Bind(
                planBytes ?? planOriginal, approvalBytes ?? approvalOriginal,
                profileBytes ?? profileOriginal, sourceBytes ?? Source,
                packageBytes ?? Package, inventoryBytes ?? inventoryOriginal,
                now ?? Issued.AddMinutes(5));

        Check(files.Length == NativeHostInputCodecV2.FrameworkFileCount);
        Check(inventoryOriginal.Length < NativeHostInputCodecV2.MaximumInventoryBytes);
        Check(planOriginal.Length < NativeHostInputCodecV2.MaximumPlanBytes);
        Check(approvalOriginal.Length < NativeHostInputCodecV2.MaximumApprovalBytes);
        Check(plan.CanonicalSha256 == NativeHostInputCodecV2.Hash(planOriginal));
        Check(approval.CanonicalSha256 == NativeHostInputCodecV2.Hash(approvalOriginal));
        Check(approval.PlanSha256 == plan.CanonicalSha256);
        Check(NativeHostInputCodecV2.ParsePlan(planOriginal, profile).CanonicalSha256 == plan.CanonicalSha256);
        Check(NativeHostInputCodecV2.ParseApproval(approvalOriginal, plan).CanonicalSha256 == approval.CanonicalSha256);
        Check(NativeHostInputCodecV2.ParseRuntimeInventory(inventoryOriginal, profile).SequenceEqual(files));
        var bound = Bind();
        Check(bound.PlanSha256 == plan.CanonicalSha256 && bound.ApprovalSha256 == approval.CanonicalSha256);
        Check(bound.Profile.CanonicalSha256 == profile.CanonicalSha256);
        Check(!bound.NativeAuthorized && !bound.GrantAuthorized && !bound.PhysicalW03Accepted &&
            !bound.SecurityAccepted && !bound.ProductionAccepted && !bound.Lic008Closed);

        using (var doc = JsonDocument.Parse(planOriginal)) {
            JsonElement r = doc.RootElement;
            Check(r.GetProperty("schema").GetString() == NativeHostInputCodecV2.PlanSchema);
            Check(r.GetProperty("profileId").GetString() == NativeHostProfileV2.ProfileId);
            Check(r.GetProperty("profileSha256").GetString() == profile.CanonicalSha256);
            Check(r.GetProperty("effects").GetString() == NativeHostProfileV2.Effects);
            Check(r.GetProperty("attempt").GetString() == Attempt);
            Check(r.GetProperty("ownerSid").GetString() == NativeHostProfileV2.OwnerSid);
            Check(r.GetProperty("sourceSetSha256").GetString() == sourceSha);
            Check(r.GetProperty("packageManifestSha256").GetString() == NativeHostInputCodecV2.Hash(Package));
            Check(r.GetProperty("runtimeInventorySha256").GetString() == inventorySha);
            Check(r.GetProperty("placement").GetProperty("image").GetString() == NativeHostProfileV2.Image);
            Check(r.GetProperty("placement").GetProperty("managedType").GetString() == NativeHostProfileV2.ManagedType);
            Check(r.GetProperty("placement").GetProperty("managedInvocationGrammar").GetString() ==
                "load_assembly_and_get_function_pointer;delegate_type_name=NULL;reserved=NULL;int(void*,int32_t)");
            Check(r.GetProperty("identity").GetProperty("accountOwnedSha256").GetString() == NativeHostProfileV2.AccountOwnedSha256);
            Check(r.GetProperty("identity").GetProperty("guardianServiceSid").GetString() == NativeHostProfileV2.GuardianSid);
            Check(r.GetProperty("roles").GetArrayLength() == 4);
            Check(r.GetProperty("namespaces").GetProperty("restrictedKey").GetString() == profile.KeyName(false));
            Check(r.GetProperty("namespaces").GetProperty("guardian-afterPipe").GetString() == profile.Endpoint(NativeHostStage.GuardianAfter));
            Check(r.GetProperty("namespaces").GetProperty("journalRecords").GetString() == profile.RecordNamespace("journal"));
            JsonElement commands = r.GetProperty("commandGrammar");
            Check(commands.GetProperty("owner").GetString() ==
                "<image> --owner --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64>");
            Check(commands.GetProperty("user").GetString() ==
                "<image> --user --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64> --run-id <lowerhex32> --nonce <lowerhex64>");
            Check(commands.GetProperty("service").GetString() ==
                "<image> --service --role (Setup|Guardian) --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64>");
            Check(r.GetProperty("assets").GetProperty("config").GetProperty("sha256").GetString() == configPin.Sha256);
            Check(r.GetProperty("frameworkInventory").GetProperty("files").GetArrayLength() == 189);
            Check(r.GetProperty("frameworkInventory").GetProperty("frameworkDepsSha256").GetString() ==
                files.Single(x => x.Name == "Microsoft.NETCore.App.deps.json").Sha256);
            Check(r.GetProperty("claims").EnumerateObject().All(p => p.Value.ValueKind == JsonValueKind.False));
            Check(!r.TryGetProperty("planSha256", out _));
        }
        using (var doc = JsonDocument.Parse(approvalOriginal)) {
            JsonElement r = doc.RootElement;
            Check(r.GetProperty("planSha256").GetString() == plan.CanonicalSha256);
            Check(r.GetProperty("profileSha256").GetString() == profile.CanonicalSha256);
            Check(r.GetProperty("sourceSetSha256").GetString() == sourceSha);
            Check(r.GetProperty("packageManifestSha256").GetString() == NativeHostInputCodecV2.Hash(Package));
            Check(r.GetProperty("runtimeInventorySha256").GetString() == inventorySha);
            Check(r.GetProperty("imageSha256").GetString() == image.Sha256);
            Check(r.GetProperty("configSha256").GetString() == configPin.Sha256);
            Check(r.GetProperty("hostfxrSha256").GetString() == hostfxr.Sha256);
            Check(r.GetProperty("claims").EnumerateObject().All(p => p.Value.ValueKind == JsonValueKind.False));
            Check(!r.TryGetProperty("approvalSha256", out _));
        }

        byte[] independentPlan = plan.CanonicalBytes(); independentPlan[0] ^= 0xff;
        byte[] independentApproval = approval.CanonicalBytes(); independentApproval[^1] ^= 0xff;
        Check(plan.CanonicalBytes().SequenceEqual(planOriginal));
        Check(approval.CanonicalBytes().SequenceEqual(approvalOriginal));
        byte[] planCaller = (byte[])planOriginal.Clone(), approvalCaller = (byte[])approvalOriginal.Clone();
        byte[] profileCaller = (byte[])profileOriginal.Clone(), sourceCaller = (byte[])Source.Clone();
        byte[] packageCaller = (byte[])Package.Clone(), inventoryCaller = (byte[])inventoryOriginal.Clone();
        NativeHostBoundInputV2 frozen = Bind(planCaller, approvalCaller, profileCaller,
            sourceCaller, packageCaller, inventoryCaller);
        planCaller[0] ^= 0xff; approvalCaller[0] ^= 0xff; profileCaller[0] ^= 0xff;
        sourceCaller[0] ^= 0xff; packageCaller[0] ^= 0xff; inventoryCaller[0] ^= 0xff;
        Check(frozen.Plan.CanonicalSha256 == plan.CanonicalSha256);
        Check(frozen.Approval.CanonicalSha256 == approval.CanonicalSha256);
        Check(frozen.Profile.CanonicalSha256 == profile.CanonicalSha256);
        files[0] = files[0] with { Sha256 = new string('0', 64) };
        Check(plan.FrameworkInventory[0].Sha256 != files[0].Sha256);
        bool readOnly = false;
        try { ((IList<NativeHostFilePinV2>)plan.FrameworkInventory)[0] = files[0]; }
        catch (NotSupportedException) { readOnly = true; }
        Check(readOnly);
        NativeHostFilePinV2[] changedList = FakeInventory();
        changedList[0] = changedList[0] with { Sha256 = new string('f', 64) };
        Refused(() => Bind(inventoryBytes: NativeHostInputCodecV2.EncodeRuntimeInventory(profile, changedList)));

        Refused(() => Bind(sourceBytes: Encoding.UTF8.GetBytes("{\"schema\":\"OTHER\"}")));
        Refused(() => Bind(packageBytes: Encoding.UTF8.GetBytes("{\"schema\":\"OTHER\"}")));
        Refused(() => Bind(profileBytes: NativeHostProfileV2.Create(Attempt, new string('1', 64)).CanonicalBytes()));
        Refused(() => Bind(now: Issued));
        Refused(() => Bind(now: approval.ExpiresUtc));
        Refused(() => Bind(now: Issued.AddMinutes(1).ToOffset(TimeSpan.FromHours(1))));
        Refused(() => MakePlan(profile, FakeInventory(), cfg: new NativeHostAssetPinV2(config.Length + 1, configPin.Sha256)));
        Refused(() => MakePlan(profile, FakeInventory(), cfg: new NativeHostAssetPinV2(config.Length, new string('0', 64))));
        Refused(() => MakePlan(profile, FakeInventory(), expiry: Issued.AddHours(3)));
        Refused(() => MakePlan(profile, FakeInventory(), issue: Issued.AddTicks(1)));
        Refused(() => MakePlan(NativeHostProfileV2.Create(new string('1', 32), sourceSha), FakeInventory()));
        Refused(() => new NativeHostApprovalV2(plan, Issued.AddSeconds(-1), Issued.AddMinutes(1)));
        Refused(() => new NativeHostApprovalV2(plan, Issued.AddMinutes(1), plan.ExpiresUtc.AddMinutes(1)));

        NativeHostFilePinV2[] badOrder = FakeInventory();
        (badOrder[0], badOrder[1]) = (badOrder[1], badOrder[0]);
        Refused(() => NativeHostInputCodecV2.EncodeRuntimeInventory(profile, badOrder));
        NativeHostFilePinV2[] badCount = FakeInventory()[..^1];
        Refused(() => NativeHostInputCodecV2.EncodeRuntimeInventory(profile, badCount));
        NativeHostFilePinV2[] badLeaf = FakeInventory();
        badLeaf[0] = badLeaf[0] with { Name = ".." };
        Refused(() => NativeHostInputCodecV2.EncodeRuntimeInventory(profile, badLeaf));
        NativeHostFilePinV2[] missingRequired = FakeInventory();
        int deps = Array.FindIndex(missingRequired, p => p.Name == "Microsoft.NETCore.App.deps.json");
        missingRequired[deps] = missingRequired[deps] with { Name = "Microsoft.NETCore.App.deps.jsox" };
        Refused(() => NativeHostInputCodecV2.EncodeRuntimeInventory(profile, missingRequired));
        NativeHostFilePinV2[] replacedLeaf = FakeInventory();
        replacedLeaf[1] = replacedLeaf[1] with { Name = "Microsoft.CSharp2.dll" };
        Refused(() => NativeHostInputCodecV2.EncodeRuntimeInventory(profile, replacedLeaf));

        string planText = Encoding.UTF8.GetString(planOriginal);
        string approvalText = Encoding.UTF8.GetString(approvalOriginal);
        string inventoryText = Encoding.UTF8.GetString(inventoryOriginal);
        void BadPlan(string changed) {
            Check(changed != planText);
            Refused(() => NativeHostInputCodecV2.ParsePlan(Encoding.UTF8.GetBytes(changed), profile));
        }
        void BadApproval(string changed) {
            Check(changed != approvalText);
            Refused(() => NativeHostInputCodecV2.ParseApproval(Encoding.UTF8.GetBytes(changed), plan));
        }
        BadPlan(planText.Replace(NativeHostInputCodecV2.PlanSchema,
            "TEST_ONLY_STANDARD_USER_PLAN_V1", StringComparison.Ordinal));
        BadPlan(planText.Replace(NativeHostProfileV2.ProfileId,
            "TEST_ONLY_STANDARD_USER_CONTROL_V1", StringComparison.Ordinal));
        BadPlan(planText.Replace(NativeHostProfileV2.Effects, "OLD_EFFECTS", StringComparison.Ordinal));
        BadPlan(planText.Replace("Ecs.Lic008.StandardNativeHostV1",
            "Ecs.Lic008.StandardUserControlV1", StringComparison.Ordinal));
        BadPlan(planText.Replace("StandardControlHost.exe", "dotnet.exe", StringComparison.Ordinal));
        string oldUserGrammar = "<image> --user --attempt <lowerhex32> --plan-sha256 <lowerhex64> --approval-sha256 <lowerhex64> --source-set-sha256 <lowerhex64>";
        string newUserGrammar = oldUserGrammar + " --run-id <lowerhex32> --nonce <lowerhex64>";
        string userProperty = "\"user\":" + JsonSerializer.Serialize(newUserGrammar);
        Check(planText.Contains(userProperty, StringComparison.Ordinal));
        string oldUserPlan = planText.Replace(userProperty,
            "\"user\":" + JsonSerializer.Serialize(oldUserGrammar), StringComparison.Ordinal);
        using (JsonDocument changed = JsonDocument.Parse(oldUserPlan)) {
            JsonElement changedGrammar = changed.RootElement.GetProperty("commandGrammar");
            Check(changedGrammar.GetProperty("user").GetString() == oldUserGrammar);
            Check(changedGrammar.GetProperty("setupStart").GetString() ==
                "<setupService> --stage setup --run-id <lowerhex32> --nonce <lowerhex64>");
            Check(changedGrammar.GetProperty("guardianBeforeStart").GetString() ==
                "<guardianService> --stage guardian-before --run-id <lowerhex32> --nonce <lowerhex64>");
            Check(changedGrammar.GetProperty("guardianAfterStart").GetString() ==
                "<guardianService> --stage guardian-after --run-id <lowerhex32> --nonce <lowerhex64>");
        }
        BadPlan(oldUserPlan);
        BadPlan(planText.Replace("\"nativeEntryProven\":false", "\"nativeEntryProven\":true", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"attempt\":\"", "\"attempt\":\"0\",\"attempt\":\"", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"assets\":{", "\"unknown\":1,\"assets\":{", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"sourceSetSha256\":\"", "\"sourceSetSha256\":\"\\u0030", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"purpose\":", "\"purpose\" :", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"schema\":\"" + NativeHostInputCodecV2.PlanSchema +
            "\",\"purpose\":\"" + NativeHostInputCodecV2.PlanPurpose + "\"",
            "\"purpose\":\"" + NativeHostInputCodecV2.PlanPurpose +
            "\",\"schema\":\"" + NativeHostInputCodecV2.PlanSchema + "\"", StringComparison.Ordinal));
        BadPlan(planText + " ");
        BadPlan(planText.Replace("\"owner\":", "\"Owner\":", StringComparison.Ordinal));
        BadPlan(planText.Replace("\"frameworkDepsSha256\":\"", "\"frameworkDepsSha256\":\"0", StringComparison.Ordinal));
        BadApproval(approvalText.Replace(NativeHostInputCodecV2.ApprovalSchema,
            "TEST_ONLY_STANDARD_USER_APPROVAL_V1", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"planSha256\":\"", "\"planSha256\":\"0", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"imageSha256\":\"", "\"imageSha256\":\"0", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"grantAuthorized\":false", "\"grantAuthorized\":true", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"attempt\":\"", "\"attempt\":\"x\",\"attempt\":\"", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"claims\":{", "\"extra\":1,\"claims\":{", StringComparison.Ordinal));
        BadApproval(approvalText.Replace("\"schema\":\"" + NativeHostInputCodecV2.ApprovalSchema +
            "\",\"purpose\":\"" + NativeHostInputCodecV2.ApprovalPurpose + "\"",
            "\"purpose\":\"" + NativeHostInputCodecV2.ApprovalPurpose +
            "\",\"schema\":\"" + NativeHostInputCodecV2.ApprovalSchema + "\"", StringComparison.Ordinal));
        BadApproval(approvalText + "\n");
        Refused(() => NativeHostInputCodecV2.ParseRuntimeInventory(
            Encoding.UTF8.GetBytes(inventoryText + " "), profile));
        Refused(() => NativeHostInputCodecV2.ParseRuntimeInventory(
            Encoding.UTF8.GetBytes(inventoryText.Replace("\"files\":[", "\"files\":[],\"files\":[", StringComparison.Ordinal)), profile));
        Refused(() => NativeHostInputCodecV2.ParsePlan(new byte[] { 0xef, 0xbb, 0xbf }.Concat(planOriginal).ToArray(), profile));
        Refused(() => NativeHostInputCodecV2.ParseApproval(new byte[] { 0xef, 0xbb, 0xbf }.Concat(approvalOriginal).ToArray(), plan));
        byte[] invalidUtf8 = (byte[])planOriginal.Clone(); invalidUtf8[10] = 0xc0;
        Refused(() => NativeHostInputCodecV2.ParsePlan(invalidUtf8, profile));
        Refused(() => NativeHostInputCodecV2.ParsePlan(new byte[NativeHostInputCodecV2.MaximumPlanBytes + 1], profile));
        Refused(() => NativeHostInputCodecV2.ParseApproval(Array.Empty<byte>(), plan));
        return checks;
    }
}
