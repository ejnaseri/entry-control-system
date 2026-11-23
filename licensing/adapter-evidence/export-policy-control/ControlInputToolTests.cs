using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.ExportPolicyControl;

// All fixtures are synthetic bytes and callbacks. No native identity, filesystem,
// registry, service or CNG method is invoked by this suite.
internal static class ControlInputToolTests
{
    private const string Sid = "S-1-5-21-1-2-3-1001";
    private const string Candidate = @"E:\EntryControlSystem\out\lic008-export-policy-v5-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static readonly string[] PriorCandidates = {
        @"E:\EntryControlSystem\out\lic008-export-policy-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        @"E:\EntryControlSystem\out\lic008-export-policy-v2-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        @"E:\EntryControlSystem\out\lic008-export-policy-v3-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        @"E:\EntryControlSystem\out\lic008-export-policy-v4-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    };
    private const string Output = @"E:\EntryControlSystem\out";
    private static readonly DateTimeOffset Now = new(2026, 10, 23, 0, 0, 0, TimeSpan.Zero);
    private static string H(char c) => new(c, 64);
    private static ControlPackage Package() => new(1, "TEST_ONLY_EXPORT_POLICY_PACKAGE_V5", new[] {
        new ControlPackageFile("ExportPolicyControl.exe", 10, H('1')),
        new ControlPackageFile("ExportPolicyControl.dll", 11, H('2')),
        new ControlPackageFile("ExportPolicyControl.runtimeconfig.json", 12, H('3')),
        new ControlPackageFile("runtime-inventory.json", 13, H('4'))
    });
    private static ControlServiceSnapshot Guardian() => new(ControlRules.GuardianService,
        ControlController.OriginalBinary, "NT SERVICE\\" + ControlRules.GuardianService, 3, 16, 1, 1, 1, 0, H('5'));

    internal static int Run()
    {
        int cases = 0;
        void Need(bool value) { if (!value) throw new InvalidDataException("INPUT_PURE_TEST_FAILED"); cases++; }
        void Refuses(Action work) {
            bool refused = false;
            try { work(); } catch (Exception e) when (e is InvalidDataException or ArgumentException or
                System.Text.Json.JsonException or KeyNotFoundException or InvalidOperationException) { refused = true; }
            Need(refused);
        }
        Need(!ControlCapability.Enabled && !ControlOwnerEntry.PhysicalEnabled && !NativeControlRuntime.PhysicalEnabled);
        var package = Package(); string packageHash = ControlRules.Hash(ControlRules.Serialize(package));
        string[] check = { "--check-only", Candidate, H('a'), packageHash, Sid };
        string[] prepare = { "--prepare", Candidate, H('a'), packageHash, Sid, Output };
        cases += DispatchTests(check, prepare);
        cases += FailureTests();
        var args = ControlInputTool.ParseArguments(prepare);
        Need(args.Prepare && args.OutputParent == Output && args.ExpectedOwnerSid == Sid && args.PackageSha256 == packageHash);
        Need(!ControlInputTool.ParseArguments(check).Prepare && ControlInputTool.ParseArguments(check).OutputParent is null);
        int invoked = 0;
        ControlInputTool.ParseThenInvoke(check, _ => invoked++); Need(invoked == 1);
        foreach (var input in new[] {
            Array.Empty<string>(), new[] { "--self-test" }, new[] { "--SELF-TEST" }, new[] { "--self-test", "unexpected" },
            new[] { "--check" }, new[] { "--prepare" }, new[] { "--control-controller" }, new[] { "--control-service" },
            new[] { "--run" }, check.Concat(new[] { "unexpected" }).ToArray(), prepare[..5],
            prepare.Concat(new[] { "unexpected" }).ToArray(), null!
        }) {
            Refuses(() => ControlInputTool.ParseThenInvoke(input, _ => invoked++)); Need(invoked == 1);
        }
        foreach (string path in new[] { "", "relative", @"e:\out\lic008-export-policy-v5-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            @"\\server\out\lic008-export-policy-v5-capable-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            Candidate + "\\", Candidate + ".", Candidate + ":data", Candidate.Replace("out", ".."),
            Candidate.Replace("capable", "inert"), Candidate[..^1], Candidate + "0", Candidate.Replace("aaaa", "AAAA") }.Concat(PriorCandidates)) {
            var bad = (string[])check.Clone(); bad[1] = path;
            Need(!ControlInputTool.ValidCandidatePath(path)); Refuses(() => ControlInputTool.ParseThenInvoke(bad, _ => invoked++));
            Need(invoked == 1);
        }
        foreach (string pin in new[] { "", "x", H('A'), H('g'), H('a')[1..], H('a') + "0" }) {
            foreach (int column in new[] { 2, 3 }) {
                var bad = (string[])check.Clone(); bad[column] = pin;
                Refuses(() => ControlInputTool.ParseThenInvoke(bad, _ => invoked++)); Need(invoked == 1);
            }
        }
        foreach (string sid in new[] { "", ControlRules.AdminSid, ControlRules.SystemSid, Sid + "-1", "S-1-5-21-1-2-3-01",
            "S-1-5-21-1-2-3-4294967296", "s-1-5-21-1-2-3-1001" }) {
            var bad = (string[])check.Clone(); bad[4] = sid;
            Refuses(() => ControlInputTool.ParseThenInvoke(bad, _ => invoked++)); Need(invoked == 1);
        }
        foreach (string parent in new[] { "", @"C:\", @"C:\Windows", @"C:\WINDOWS\Temp", @"E:\Windows\Temp",
            @"C:\ProgramData", @"D:\ProgramData\new", @"C:\Program Files\new", @"C:\Program Files (x86)\new",
            @"E:\out\..\bad", @"E:\out\bad.", @"E:\out\bad ", @"E:\out:ads", @"\\server\share", "E:\\" + new string('x', 151) }) {
            var bad = (string[])prepare.Clone(); bad[5] = parent;
            Need(!ControlInputTool.ValidOutputParent(parent)); Refuses(() => ControlInputTool.ParseThenInvoke(bad, _ => invoked++));
            Need(invoked == 1);
        }
        foreach (string parent in new[] { Output, @"C:\Users\Owner\Documents", @"D:\Review\Outputs", @"E:\WindowsData" })
            Need(ControlInputTool.ValidOutputParent(parent));

        var material = ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, H('c'), H('d'), Guardian(), Now);
        ControlInputTool.ValidateMaterial(material, Now); cases++;
        Need(material.Plan.Scope == "TEST_ONLY_EXPORT_POLICY_CONTROL_V5" &&
            material.Approval.Scope == "TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V5");
        cases += PriorMaterialRefusals(material);
        Need(material.Plan.ExpiresUtc == Now.AddHours(2) && material.Approval.ExpiresUtc == material.Plan.ExpiresUtc);
        Need(material.Plan.AssemblySha256 == package.Files[1].Sha256 && material.Plan.RuntimeInventorySha256 == package.Files[3].Sha256);
        Need(material.Plan.HostSha256 == H('c') && material.Plan.BootIdentity == H('d'));
        Need(material.Approval.Effects.SequenceEqual(ControlController.Effects));
        Need(ControlRules.Parse<ControlPlan>(ControlRules.Serialize(material.Plan)) == material.Plan);
        Need(ControlRules.Serialize(ControlRules.Parse<ControlOwnerApproval>(ControlRules.Serialize(material.Approval)))
            .SequenceEqual(ControlRules.Serialize(material.Approval)));
        Refuses(() => ControlRules.Parse<ControlPlan>(Encoding.UTF8.GetBytes(" " + Encoding.UTF8.GetString(ControlRules.Serialize(material.Plan)))));
        ControlInputTool.ValidateMaterial(material, Now.AddHours(2).AddTicks(-1)); cases++;
        foreach (var time in new[] { Now.AddTicks(-1), Now.AddHours(2), Now.AddHours(3), Now.ToOffset(TimeSpan.FromHours(1)) })
            Refuses(() => ControlInputTool.ValidateMaterial(material, time));
        foreach (var plan in new[] {
            material.Plan with { SchemaVersion = 2 }, material.Plan with { Scope = "wrong" },
            material.Plan with { AttemptId = new string('c', 32) }, material.Plan with { OwnerSid = "S-1-5-21-4-5-6-1001" },
            material.Plan with { PackageSha256 = H('f') }, material.Plan with { AssemblySha256 = H('f') },
            material.Plan with { RuntimeInventorySha256 = H('f') }, material.Plan with { HostSha256 = H('f') },
            material.Plan with { BootIdentity = H('f') }, material.Plan with { IssuedUtc = Now.AddMinutes(-1) },
            material.Plan with { ExpiresUtc = Now.AddHours(3) }
        }) Refuses(() => ControlInputTool.ValidateMaterial(material with { Plan = plan }, Now));
        foreach (var approval in new[] {
            material.Approval with { SchemaVersion = 2 }, material.Approval with { Scope = "wrong" },
            material.Approval with { AttemptId = new string('d', 32) }, material.Approval with { OwnerSid = "S-1-5-21-4-5-6-1001" },
            material.Approval with { PlanSha256 = H('e') }, material.Approval with { PackageSha256 = H('e') },
            material.Approval with { Guardian = Guardian() with { BinaryPath = "wrong" } },
            material.Approval with { Effects = Array.Empty<string>() }, material.Approval with { Effects = ControlController.Effects.Reverse().ToArray() },
            material.Approval with { IssuedUtc = Now.AddSeconds(-1) }, material.Approval with { ExpiresUtc = Now.AddHours(3) }
        }) Refuses(() => ControlInputTool.ValidateMaterial(material with { Approval = approval }, Now));
        foreach (var pins in new[] {
            material.Pins with { PlanSha256 = H('f') }, material.Pins with { ApprovalSha256 = H('f') },
            material.Pins with { PackageSha256 = H('f') }
        }) Refuses(() => ControlInputTool.ValidateMaterial(material with { Pins = pins }, Now));
        var extendedPlan = material.Plan with { ExpiresUtc = Now.AddHours(3) };
        string extendedPlanHash = ControlRules.Hash(ControlRules.Serialize(extendedPlan));
        var extendedApproval = material.Approval with { ExpiresUtc = extendedPlan.ExpiresUtc, PlanSha256 = extendedPlanHash };
        var extendedMaterial = new ControlInputMaterial(extendedPlan, extendedApproval,
            new(extendedPlanHash, ControlRules.Hash(ControlRules.Serialize(extendedApproval)), packageHash));
        Refuses(() => ControlInputTool.ValidateMaterial(extendedMaterial, Now));
        foreach (var guardian in new[] {
            Guardian() with { State = 4 }, Guardian() with { ProcessId = 12 }, Guardian() with { BinaryPath = "wrong" },
            Guardian() with { Account = "LocalSystem" }, Guardian() with { SidType = 0 }, Guardian() with { StartType = 2 },
            Guardian() with { OtherConfigurationSha256 = "" }
        }) Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, H('c'), H('d'), guardian, Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, H('f'), package, H('c'), H('d'), Guardian(), Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 31), Sid, packageHash, package, H('c'), H('d'), Guardian(), Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), "S-1-5-21-1-2-3-01", packageHash, package, H('c'), H('d'), Guardian(), Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, "bad", H('d'), Guardian(), Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, H('c'), "bad", Guardian(), Now));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, H('c'), H('d'), Guardian(), default));
        Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, packageHash, package, H('c'), H('d'), Guardian(), Now.ToOffset(TimeSpan.FromHours(1))));
        foreach (int version in new[] { 1, 2, 3, 4 }) {
            var priorPackage = package with { Scope = "TEST_ONLY_EXPORT_POLICY_PACKAGE_V" + version };
            string priorPackageHash = ControlRules.Hash(ControlRules.Serialize(priorPackage));
            Refuses(() => ControlInputTool.CreateMaterial(new string('b', 32), Sid, priorPackageHash, priorPackage,
                H('c'), H('d'), Guardian(), Now));
        }
        string directory = Output + "\\lic008-export-policy-v5-input-" + material.Plan.AttemptId;
        var descriptor = ControlInputTool.Describe(args, material, directory, Now);
        Need(descriptor.Scope == "TEST_ONLY_EXPORT_POLICY_PREPARED_INPUT_V5" && descriptor.PlanSha256 == material.Pins.PlanSha256 &&
            descriptor.ApprovalSha256 == material.Pins.ApprovalSha256 && descriptor.InputDirectory == directory &&
            descriptor.OwnerConfirmationRequired && !descriptor.PhysicalStageExecuted && !descriptor.SecurityAccepted && !descriptor.ProductionAccepted);
        Need(ControlRules.Serialize(ControlRules.Parse<ControlPreparedInput>(ControlRules.Serialize(descriptor))).SequenceEqual(ControlRules.Serialize(descriptor)));
        Refuses(() => ControlInputTool.Describe(args, material, directory + "0", Now));
        foreach (string prefix in new[] { "lic008-export-policy-input-", "lic008-export-policy-v2-input-", "lic008-export-policy-v3-input-", "lic008-export-policy-v4-input-" })
            Refuses(() => ControlInputTool.Describe(args, material, Output + "\\" + prefix + material.Plan.AttemptId, Now));
        Refuses(() => ControlInputTool.Describe(args with { Prepare = false }, material, directory, Now));
        Refuses(() => ControlInputTool.Describe(args with { ExpectedOwnerSid = "S-1-5-21-9-8-7-1001" }, material, directory, Now));
        Refuses(() => ControlInputTool.Describe(args with { PackageSha256 = H('f') }, material, directory, Now));
        Refuses(() => ControlInputTool.Describe(args with { OutputParent = @"C:\ProgramData" }, material, directory, Now));
        Refuses(() => ControlInputTool.Describe(args, material, directory, Now.AddHours(2)));

        Dictionary<string, object> Build() => new() {
            ["scope"] = "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V5", ["physicalExecutionEnabled"] = true,
            ["physicalTested"] = false, ["securityAccepted"] = false, ["productionAccepted"] = false,
            ["runtimeInventoryVerified"] = true, ["reviewedInertManifestSha256"] = H('a'),
            ["packageManifestSha256"] = packageHash, ["runtimeInventorySha256"] = package.Files[3].Sha256,
            ["variants"] = new[] {
                new { variant = "default", physicalExecutionEnabled = false, dllSha256 = H('1') },
                new { variant = "defines-still-inert", physicalExecutionEnabled = false, dllSha256 = H('1') },
                new { variant = "capable", physicalExecutionEnabled = true, dllSha256 = package.Files[1].Sha256 }
            }
        };
        byte[] build = ControlRules.Serialize(Build());
        ControlInputTool.ValidateBuildManifest(build, ControlRules.Hash(build), packageHash, package); cases++;
        Refuses(() => ControlInputTool.ValidateBuildManifest(build, H('f'), packageHash, package));
        Refuses(() => ControlInputTool.ValidateBuildManifest(build, ControlRules.Hash(build), H('f'), package));
        foreach (var mutation in new (string Name, object Value)[] {
            ("scope", "wrong"), ("scope", "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V1"),
            ("scope", "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V2"),
            ("scope", "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V3"),
            ("scope", "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V4"),
            ("physicalExecutionEnabled", false), ("physicalTested", true), ("securityAccepted", true),
            ("productionAccepted", true), ("runtimeInventoryVerified", false), ("reviewedInertManifestSha256", "bad"),
            ("packageManifestSha256", H('f')), ("runtimeInventorySha256", H('f')), ("variants", Array.Empty<object>())
        }) {
            var bad = Build(); bad[mutation.Name] = mutation.Value; byte[] bytes = ControlRules.Serialize(bad);
            Refuses(() => ControlInputTool.ValidateBuildManifest(bytes, ControlRules.Hash(bytes), packageHash, package));
        }
        // Recompute both pins: a prior package is refused for its purpose, even
        // when a V5 build manifest and its DLL/runtime bindings agree with it.
        foreach (int version in new[] { 1, 2, 3, 4 }) {
            var priorPackage = package with { Scope = "TEST_ONLY_EXPORT_POLICY_PACKAGE_V" + version };
            string priorPackageHash = ControlRules.Hash(ControlRules.Serialize(priorPackage));
            var priorPackageBuild = Build(); priorPackageBuild["packageManifestSha256"] = priorPackageHash;
            byte[] priorPackageBuildBytes = ControlRules.Serialize(priorPackageBuild);
            Refuses(() => ControlInputTool.ValidateBuildManifest(priorPackageBuildBytes,
                ControlRules.Hash(priorPackageBuildBytes), priorPackageHash, priorPackage));
        }
        foreach (var field in Build().Keys) {
            var bad = Build(); bad.Remove(field); byte[] bytes = ControlRules.Serialize(bad);
            Refuses(() => ControlInputTool.ValidateBuildManifest(bytes, ControlRules.Hash(bytes), packageHash, package));
        }
        for (int i = 0; i < 3; i++) {
            var rows = new[] {
                new { variant = "default", physicalExecutionEnabled = false, dllSha256 = H('1') },
                new { variant = "defines-still-inert", physicalExecutionEnabled = false, dllSha256 = H('1') },
                new { variant = "capable", physicalExecutionEnabled = true, dllSha256 = package.Files[1].Sha256 }
            };
            rows[i] = new { variant = rows[i].variant, physicalExecutionEnabled = !rows[i].physicalExecutionEnabled, dllSha256 = rows[i].dllSha256 };
            var bad = Build(); bad["variants"] = rows; byte[] bytes = ControlRules.Serialize(bad);
            Refuses(() => ControlInputTool.ValidateBuildManifest(bytes, ControlRules.Hash(bytes), packageHash, package));
        }
        return cases;
    }

    private static int PriorMaterialRefusals(ControlInputMaterial material)
    {
        int cases = 0;
        void Refuses(Action work) {
            bool refused = false;
            try { work(); } catch (InvalidDataException) { refused = true; }
            if (!refused) throw new InvalidDataException("INPUT_PRIOR_MATERIAL_ACCEPTED");
            cases++;
        }
        // Rebind every hash and predecessor field before checking purpose.
        // A mismatch must not be rejected merely because an old pin was left in
        // place; both mixed directions and a wholly prior approval are refused.
        ControlInputMaterial Rebind(ControlPlan plan, ControlOwnerApproval approval) {
            string planHash = ControlRules.Hash(ControlRules.Serialize(plan));
            approval = approval with { PlanSha256 = planHash };
            return new(plan, approval, new(planHash, ControlRules.Hash(ControlRules.Serialize(approval)), material.Pins.PackageSha256));
        }
        ControlSession Session(ControlInputMaterial input, string reservationScope) => new(input.Plan, input.Pins,
            new(1, reservationScope, input.Plan.AttemptId, input.Pins.PlanSha256,
                input.Pins.ApprovalSha256, input.Pins.PackageSha256, input.Plan.IssuedUtc));
        foreach (int planVersion in new[] { 1, 2, 3, 4, 5 })
        foreach (int approvalVersion in new[] { 1, 2, 3, 4, 5 }) {
            if (planVersion == 5 && approvalVersion == 5) continue;
            var prior = Rebind(material.Plan with { Scope = "TEST_ONLY_EXPORT_POLICY_CONTROL_V" + planVersion },
                material.Approval with { Scope = "TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V" + approvalVersion });
            Refuses(() => ControlInputTool.ValidateMaterial(prior, Now));
            Refuses(() => ControlController.ValidateApproval(prior.Approval,
                Session(prior, "TEST_ONLY_EXPORT_POLICY_CONTROL_V5"), Now));
        }
        foreach (int version in new[] { 1, 2, 3, 4 }) {
            var priorReservation = Session(material, "TEST_ONLY_EXPORT_POLICY_CONTROL_V" + version);
            Refuses(() => ControlRules.ValidateSession(priorReservation, Now));
            Refuses(() => ControlController.ValidateApproval(material.Approval, priorReservation, Now));
            string[] priorEffects = material.Approval.Effects.ToArray();
            priorEffects[0] = "Create isolated ExportPolicyControlV" + version + " root, protected inputs and one-attempt reservation";
            priorEffects[1] = version == 1
                ? "Register and start one new LocalSystem Setup service; create two new test-only RSA keys"
                : "Register and start new LocalSystem ExportPolicyControlV" + version + ".Setup; create two new ExportPolicyControlV" + version + ".TEST_ONLY RSA keys";
            // Root-only, key/service-only and complete historical effects are
            // separately refused after all dependent digests are rebound.
            foreach (int mutation in new[] { 0, 1, 2 }) {
                var effects = material.Approval.Effects.ToArray();
                if (mutation is 0 or 2) effects[0] = priorEffects[0];
                if (mutation is 1 or 2) effects[1] = priorEffects[1];
                var crossEffects = Rebind(material.Plan, material.Approval with { Effects = effects });
                Refuses(() => ControlInputTool.ValidateMaterial(crossEffects, Now));
                Refuses(() => ControlController.ValidateApproval(crossEffects.Approval,
                    Session(crossEffects, "TEST_ONLY_EXPORT_POLICY_CONTROL_V5"), Now));
            }
        }
        return cases;
    }

    private static int DispatchTests(string[] check, string[] prepare)
    {
        int cases = 0, pureCalls = 0, tokenCalls = 0, runCalls = 0;
        void Need(bool value) { if (!value) throw new InvalidDataException("INPUT_DISPATCH_TEST_FAILED"); cases++; }
        void Refuses(Action work) {
            bool refused = false;
            try { work(); } catch (InvalidDataException) { refused = true; }
            Need(refused);
        }
        ControlInputArguments? admitted = null;
        Action pure = () => pureCalls++;
        // This callback is deliberately a counter, never the native token test.
        Action token = () => tokenCalls++;
        Action<ControlInputArguments> run = input => { runCalls++; admitted = input; };
        ControlInputTool.Dispatch(new[] { "--self-test" }, pure, token, run);
        Need(pureCalls == 1 && tokenCalls == 0 && runCalls == 0 && admitted is null);
        ControlInputTool.Dispatch(new[] { "--token-self-test" }, pure, token, run);
        Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 0 && admitted is null);
        ControlInputTool.Dispatch(check, pure, token, run);
        Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 1 &&
            admitted == new ControlInputArguments(false, Candidate, H('a'), check[3], Sid, null));
        ControlInputTool.Dispatch(prepare, pure, token, run);
        Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 2 &&
            admitted == new ControlInputArguments(true, Candidate, H('a'), prepare[3], Sid, Output));
        var accepted = admitted;
        var badCheck = (string[])check.Clone(); badCheck[2] = "bad";
        var badPrepare = (string[])prepare.Clone(); badPrepare[5] = @"C:\ProgramData";
        foreach (var input in new[] {
            null!, Array.Empty<string>(), new[] { "--SELF-TEST" }, new[] { "--TOKEN-SELF-TEST" },
            new[] { "--self-test", "unexpected" }, new[] { "--token-self-test", "unexpected" },
            new[] { "--self-test", "--token-self-test" }, new[] { "--check" }, new[] { "--check-only" },
            new[] { "--prepare" }, new[] { "--control-controller" }, new[] { "--control-service" },
            new[] { "--run" }, check.Concat(new[] { "unexpected" }).ToArray(), prepare[..5],
            prepare.Concat(new[] { "unexpected" }).ToArray(), badCheck, badPrepare
        }) {
            Refuses(() => ControlInputTool.Dispatch(input, pure, token, run));
            Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 2 && admitted == accepted);
        }
        foreach (string prior in PriorCandidates)
        foreach (string[] route in new[] { check, prepare }) {
            var input = (string[])route.Clone(); input[1] = prior;
            Refuses(() => ControlInputTool.Dispatch(input, pure, token, run));
            Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 2 && admitted == accepted);
        }
        foreach (Action missingCallback in new Action[] {
            () => ControlInputTool.Dispatch(new[] { "--self-test" }, null!, token, run),
            () => ControlInputTool.Dispatch(new[] { "--token-self-test" }, pure, null!, run),
            () => ControlInputTool.Dispatch(check, pure, token, null!)
        }) {
            Refuses(missingCallback);
            Need(pureCalls == 1 && tokenCalls == 1 && runCalls == 2 && admitted == accepted);
        }
        // A selected callback failure must propagate unchanged, without invoking
        // another route or converting the failure into a successful dispatch.
        foreach (var input in new[] { new[] { "--self-test" }, new[] { "--token-self-test" }, check, prepare }) {
            var failure = new InvalidOperationException("INPUT_CALLBACK_STOP");
            int failedCalls = 0;
            Action fail = () => { failedCalls++; throw failure; };
            bool propagated = false;
            try { ControlInputTool.Dispatch(input, fail, fail, _ => fail()); }
            catch (Exception error) { propagated = ReferenceEquals(error, failure); }
            Need(propagated); Need(failedCalls == 1);
        }
        return cases;
    }

    private const string PrivateText = @"PRIVATE_CANARY_C:\Secret\owner-key.json_ACCOUNT_OWNER";
    private sealed class PrivateFailure : Exception
    {
        internal PrivateFailure(int result) : base(PrivateText) {
            HResult = result; Source = PrivateText; HelpLink = PrivateText; Data[PrivateText] = PrivateText;
        }
        public override string Message => throw new InvalidOperationException("INPUT_PRIVATE_MESSAGE_READ");
        public override string ToString() => throw new InvalidOperationException("INPUT_PRIVATE_TOSTRING_READ");
    }

    private static int FailureTests()
    {
        int cases = 0;
        void Need(bool value) { if (!value) throw new InvalidDataException("INPUT_FAILURE_TEST_FAILED"); cases++; }
        void Report(ControlInputStage stage, string wireStage, Exception error, string category, int result) {
            var report = ControlInputTool.DescribeFailure(stage, error);
            Need(report.SchemaVersion == 1 && report.Scope == "TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1" &&
                report.Stage == wireStage && report.Code == "INPUT_STAGE_FAILED_OR_REFUSED" &&
                report.Category == category && report.HResult == result);
            // The PowerShell boundary accepts this exact ordered six-field wire
            // contract. No exception text, paths, Data or extra fields may escape.
            string expected = "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1\",\"stage\":\"" +
                wireStage + "\",\"code\":\"INPUT_STAGE_FAILED_OR_REFUSED\",\"category\":\"" + category +
                "\",\"hResult\":" + result.ToString(CultureInfo.InvariantCulture) + "}";
            Need(Encoding.UTF8.GetString(ControlRules.Serialize(report)) == expected);
        }
        var stages = new (ControlInputStage Stage, string Wire)[] {
            (ControlInputStage.Arguments, "arguments"), (ControlInputStage.PureSelfTest, "pure-self-test"),
            (ControlInputStage.TokenSelfTestRuntime, "token-self-test-runtime"),
            (ControlInputStage.TokenSelfTestQueryOnly, "token-self-test-query-only"),
            (ControlInputStage.TokenSelfTestCorrected, "token-self-test-corrected"),
            (ControlInputStage.Capability, "capability"), (ControlInputStage.Runtime, "runtime"),
            (ControlInputStage.OwnerTokenOpen, "owner-token-open"), (ControlInputStage.OwnerTokenMembership, "owner-token-membership"),
            (ControlInputStage.OwnerTokenShape, "owner-token-shape"), (ControlInputStage.Environment, "environment"),
            (ControlInputStage.Candidate, "candidate"), (ControlInputStage.RuntimeInventory, "runtime-inventory"),
            (ControlInputStage.HostBinding, "host-binding"), (ControlInputStage.Guardian, "guardian"),
            (ControlInputStage.FreshSetup, "fresh-setup"), (ControlInputStage.TestRoot, "test-root"),
            (ControlInputStage.Preparation, "preparation"), (ControlInputStage.PreparationWrite, "preparation-write"),
            (ControlInputStage.PreparationReadback, "preparation-readback"), (ControlInputStage.Output, "output")
        };
        Need(stages.Select(row => row.Stage).SequenceEqual(Enum.GetValues<ControlInputStage>()) &&
            stages.Select(row => row.Wire).Distinct(StringComparer.Ordinal).Count() == stages.Length);
        var privateFailure = new PrivateFailure(-123456789);
        foreach (var row in stages) {
            Need(ControlInputTool.StageName(row.Stage) == row.Wire);
            Report(row.Stage, row.Wire, privateFailure, "EXCEPTION", privateFailure.HResult);
        }
        foreach (var invalid in new[] { (ControlInputStage)(-1), (ControlInputStage)int.MaxValue }) {
            Need(ControlInputTool.StageName(invalid) == "arguments");
            Report(invalid, "arguments", privateFailure, "EXCEPTION", privateFailure.HResult);
        }
        foreach (var fixture in new (Exception Error, string Category)[] {
            (new SecurityException(PrivateText), "SECURITY"), (new UnauthorizedAccessException(PrivateText), "ACCESS_DENIED"),
            (new InvalidDataException(PrivateText), "INVALID_DATA"), (new IOException(PrivateText), "IO"),
            (new ArgumentException(PrivateText), "ARGUMENT"), (new ArgumentNullException(PrivateText, PrivateText), "ARGUMENT"),
            (new JsonException(PrivateText), "JSON"), (new Win32Exception(5, PrivateText), "NATIVE"),
            (new InvalidOperationException(PrivateText), "STATE"), (new NotSupportedException(PrivateText), "UNSUPPORTED"),
            (new PlatformNotSupportedException(PrivateText), "UNSUPPORTED"), (new Exception(PrivateText), "EXCEPTION")
        }) Report(ControlInputStage.OwnerTokenMembership, "owner-token-membership", fixture.Error, fixture.Category, fixture.Error.HResult);

        var security = new SecurityException(PrivateText);
        foreach (Exception wrapped in new Exception[] {
            new TargetInvocationException(PrivateText, security), new TypeInitializationException(PrivateText, security),
            new AggregateException(PrivateText, security),
            new AggregateException(PrivateText, new TargetInvocationException(PrivateText, new TypeInitializationException(PrivateText, security)))
        }) Report(ControlInputStage.OwnerTokenMembership, "owner-token-membership", wrapped, "SECURITY", security.HResult);
        var multiple = new AggregateException(PrivateText, security, privateFailure);
        Report(ControlInputStage.Output, "output", multiple, "EXCEPTION", multiple.HResult);
        var state = new InvalidOperationException(PrivateText, security);
        Report(ControlInputStage.Preparation, "preparation", state, "STATE", state.HResult);
        var empty = new TargetInvocationException(PrivateText, null);
        Report(ControlInputStage.Output, "output", empty, "EXCEPTION", empty.HResult);
        Exception nested = security;
        for (int depth = 0; depth < 8; depth++) nested = new TargetInvocationException(PrivateText, nested);
        Report(ControlInputStage.Output, "output", nested, "SECURITY", security.HResult);
        nested = new TargetInvocationException(PrivateText, nested);
        Report(ControlInputStage.Output, "output", nested, "EXCEPTION", nested.HResult);
        foreach (int result in new[] { int.MinValue, int.MaxValue, 0, -1 })
            Report(ControlInputStage.Output, "output", new PrivateFailure(result), "EXCEPTION", result);
        return cases;
    }
}
