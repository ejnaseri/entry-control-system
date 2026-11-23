using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.ComponentModel;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlInputArguments(bool Prepare, string CandidateDirectory, string BuildManifestSha256,
    string PackageSha256, string ExpectedOwnerSid, string? OutputParent);
internal sealed record ControlInputMaterial(ControlPlan Plan, ControlOwnerApproval Approval, ControlPins Pins);
internal sealed record ControlPreparedInput(int SchemaVersion, string Scope, string CandidateDirectory,
    string BuildManifestSha256, string PackageSha256, string ExpectedOwnerSid, string InputDirectory,
    string AttemptId, string PlanSha256, string ApprovalSha256, DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc,
    string[] Effects, bool OwnerConfirmationRequired, bool PhysicalStageExecuted, bool SecurityAccepted, bool ProductionAccepted);
internal enum ControlInputStage { Arguments, PureSelfTest, TokenSelfTestRuntime, TokenSelfTestQueryOnly,
    TokenSelfTestCorrected, Capability, Runtime, OwnerTokenOpen, OwnerTokenMembership, OwnerTokenShape,
    Environment, Candidate, RuntimeInventory, HostBinding, Guardian, FreshSetup, TestRoot,
    Preparation, PreparationWrite, PreparationReadback, Output }
internal sealed record ControlInputFailure(int SchemaVersion, string Scope, string Stage, string Code, string Category, int HResult);
internal sealed record ControlOwnerTokenTest(int SchemaVersion, string Scope, int Cases, string Runtime,
    bool QueryOnlyDuplicateAccessDenied, bool QueryOnlyMembershipSecurityException, int QueryOnlyHResult,
    bool CorrectedMembershipSucceeded, bool IsAdministrator, int Elevation, bool PrimaryToken,
    bool ImpersonationAbsent, bool OwnerInputIssued, bool PhysicalStageExecuted,
    bool SecurityAccepted, bool ProductionAccepted);

// Standalone owner-input preparation program. It is compiled without the product
// capability define and has no dispatch, service mutation, CNG or ACL-write path.
// Prepare writes only three new files under a fresh child of the selected output
// directory. These files are not execution authorization: the capable controller
// still requires separately reviewed hashes and live exact owner confirmation.
internal static class ControlInputTool
{
    private static ControlInputStage stage = ControlInputStage.Arguments;
    internal static int Main(string[] args)
    {
        stage = ControlInputStage.Arguments;
        try {
            Dispatch(args, () => {
                stage = ControlInputStage.PureSelfTest;
                int cases = ControlInputToolTests.Run();
                Console.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(new {
                    scope = "TEST_ONLY_EXPORT_POLICY_INPUT_TOOL_PURE_V1", cases,
                    physicalExecutionEnabled = false, physicalTested = false,
                    securityAccepted = false, productionAccepted = false
                })));
            }, () => Console.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(TokenSelfTest()))), Run);
            return 0;
        }
        catch (Exception error) {
            Console.Error.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(DescribeFailure(stage, error))));
            return 1;
        }
    }

    internal static void Dispatch(string[] args, Action pureTest, Action tokenTest, Action<ControlInputArguments> run)
    {
        ControlRules.Need(pureTest is not null && tokenTest is not null && run is not null, "INPUT_ACTION_REFUSED");
        if (args is { Length: 1 } && args[0] == "--self-test") { pureTest(); return; }
        if (args is { Length: 1 } && args[0] == "--token-self-test") { tokenTest(); return; }
        ParseThenInvoke(args, run);
    }

    internal static ControlInputFailure DescribeFailure(ControlInputStage failedStage, Exception error)
    {
        // Only fixed metadata is allowed across the process boundary. Never emit
        // exception.Message, ToString, paths, account names, stack or raw data.
        for (int depth = 0; depth < 8; depth++) {
            Exception? inner = error switch {
                TargetInvocationException or TypeInitializationException => error.InnerException,
                AggregateException aggregate when aggregate.InnerExceptions.Count == 1 => aggregate.InnerExceptions[0],
                _ => null
            };
            if (inner is null) break;
            error = inner;
        }
        string category = error switch {
            SecurityException => "SECURITY", UnauthorizedAccessException => "ACCESS_DENIED",
            InvalidDataException => "INVALID_DATA", IOException => "IO", ArgumentException => "ARGUMENT",
            JsonException => "JSON", Win32Exception => "NATIVE", InvalidOperationException => "STATE",
            NotSupportedException => "UNSUPPORTED", _ => "EXCEPTION"
        };
        return new(1, "TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1", StageName(failedStage),
            "INPUT_STAGE_FAILED_OR_REFUSED", category, error.HResult);
    }

    internal static string StageName(ControlInputStage value) => value switch {
        ControlInputStage.Arguments => "arguments", ControlInputStage.PureSelfTest => "pure-self-test",
        ControlInputStage.TokenSelfTestRuntime => "token-self-test-runtime",
        ControlInputStage.TokenSelfTestQueryOnly => "token-self-test-query-only",
        ControlInputStage.TokenSelfTestCorrected => "token-self-test-corrected",
        ControlInputStage.Capability => "capability", ControlInputStage.Runtime => "runtime",
        ControlInputStage.OwnerTokenOpen => "owner-token-open", ControlInputStage.OwnerTokenMembership => "owner-token-membership",
        ControlInputStage.OwnerTokenShape => "owner-token-shape", ControlInputStage.Environment => "environment",
        ControlInputStage.Candidate => "candidate", ControlInputStage.RuntimeInventory => "runtime-inventory",
        ControlInputStage.HostBinding => "host-binding", ControlInputStage.Guardian => "guardian",
        ControlInputStage.FreshSetup => "fresh-setup", ControlInputStage.TestRoot => "test-root",
        ControlInputStage.Preparation => "preparation", ControlInputStage.PreparationWrite => "preparation-write",
        ControlInputStage.PreparationReadback => "preparation-readback", ControlInputStage.Output => "output",
        _ => "arguments"
    };

    private static ControlOwnerTokenTest TokenSelfTest()
    {
        // Deliberately separate from the pure suite: only reads this process's
        // own primary token. Never queries SCM, touches keys or writes files.
        stage = ControlInputStage.TokenSelfTestRuntime;
        NativeControlIdentity.RuntimeGuard();
        using var before = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(before is null, "INPUT_IMPERSONATION_REFUSED");
        stage = ControlInputStage.TokenSelfTestQueryOnly;
        using var prior = WindowsIdentity.GetCurrent(TokenAccessLevels.Query);
        ControlRules.Need(GetTokenInformation(prior.AccessToken, 8, out int oldType, 4, out int written) &&
            written == 4 && oldType == 1, "INPUT_TOKEN_TEST_PRIMARY_REQUIRED");
        bool duplicated = DuplicateTokenEx(prior.AccessToken, 8, IntPtr.Zero, 2, 2, out var deniedToken);
        int duplicateError = Marshal.GetLastWin32Error();
        using (deniedToken) ControlRules.Need(!duplicated && duplicateError == 5, "INPUT_QUERY_ONLY_REPRODUCTION_FAILED");
        int oldHResult = 0; bool oldMembershipDenied = false;
        try { _ = new WindowsPrincipal(prior).IsInRole(WindowsBuiltInRole.Administrator); }
        catch (SecurityException error) { oldMembershipDenied = true; oldHResult = error.HResult; }
        ControlRules.Need(oldMembershipDenied, "INPUT_QUERY_ONLY_MEMBERSHIP_REPRODUCTION_FAILED");
        stage = ControlInputStage.TokenSelfTestCorrected;
        using var corrected = NativeControlIdentity.OpenOwnerForMembership();
        ControlRules.Need(GetTokenInformation(corrected.AccessToken, 8, out int type, 4, out written) &&
            written == 4 && type == 1, "INPUT_TOKEN_TEST_PRIMARY_REQUIRED");
        ControlRules.Need(GetTokenInformation(corrected.AccessToken, 20, out int elevation, 4, out written) &&
            written == 4 && elevation is 0 or 1, "INPUT_TOKEN_TEST_ELEVATION_QUERY_FAILED");
        bool admin = new WindowsPrincipal(corrected).IsInRole(WindowsBuiltInRole.Administrator);
        using var after = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(after is null, "INPUT_IMPERSONATION_REFUSED");
        return new(1, "TEST_ONLY_EXPORT_POLICY_OWNER_TOKEN_TEST_V1", 9, Environment.Version.ToString(),
            true, true, oldHResult, true, admin, elevation, true, true, false, false, false, false);
    }

    internal static void ParseThenInvoke(string[] args, Action<ControlInputArguments> action)
    { var input = ParseArguments(args); ControlRules.Need(action is not null, "INPUT_ACTION_REFUSED"); action(input); }

    internal static ControlInputArguments ParseArguments(string[] args)
    {
        ControlRules.Need(args is not null && ((args.Length == 5 && args[0] == "--check-only") ||
            (args.Length == 6 && args[0] == "--prepare")), "INPUT_ARGUMENTS_REFUSED");
        ControlRules.Need(ValidCandidatePath(args[1]) && ControlRules.Hex(args[2], 64) &&
            ControlRules.Hex(args[3], 64) && ControlOwnerEntry.ValidOwnerSid(args[4]), "INPUT_ARGUMENTS_REFUSED");
        bool prepare = args[0] == "--prepare";
        ControlRules.Need(!prepare || ValidOutputParent(args[5]), "INPUT_OUTPUT_PARENT_REFUSED");
        return new(prepare, args[1], args[2], args[3], args[4], prepare ? args[5] : null);
    }

    internal static bool ValidCandidatePath(string? value)
    {
        if (!ControlOwnerEntry.ValidInputPath(value)) return false;
        string path = value!;
        string name = path[(path.LastIndexOf('\\') + 1)..];
        const string prefix = "lic008-export-policy-v5-capable-";
        return name.StartsWith(prefix, StringComparison.Ordinal) && ControlRules.Hex(name[prefix.Length..], 32);
    }
    internal static bool ValidOutputParent(string? value)
    {
        if (!ControlOwnerEntry.ValidInputPath(value) || value!.Length > 150) return false;
        // Never permit preparation output inside operating-system or test roots.
        string[] denied = { @"\ProgramData", @"\Windows", @"\Program Files", @"\Program Files (x86)" };
        string tail = value[2..];
        return !denied.Any(p => tail.Equals(p, StringComparison.OrdinalIgnoreCase) ||
            tail.StartsWith(p + "\\", StringComparison.OrdinalIgnoreCase));
    }

    internal static void ValidateBuildManifest(byte[] bytes, string expectedBuild, string expectedPackage,
        ControlPackage package)
    {
        ControlRules.Need(ControlRules.Hex(expectedBuild, 64) && ControlRules.Hex(expectedPackage, 64) &&
            ControlRules.Hash(bytes) == expectedBuild, "INPUT_BUILD_PIN_REFUSED");
        NativeControlAdmission.ValidatePackage(package);
        using var document = JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 16 });
        var root = document.RootElement;
        ControlRules.Need(root.ValueKind == JsonValueKind.Object &&
            root.GetProperty("scope").GetString() == "TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V5" &&
            root.GetProperty("physicalExecutionEnabled").GetBoolean() &&
            !root.GetProperty("physicalTested").GetBoolean() && !root.GetProperty("securityAccepted").GetBoolean() &&
            !root.GetProperty("productionAccepted").GetBoolean() && root.GetProperty("runtimeInventoryVerified").GetBoolean() &&
            ControlRules.Hex(root.GetProperty("reviewedInertManifestSha256").GetString(), 64) &&
            root.GetProperty("packageManifestSha256").GetString() == expectedPackage &&
            root.GetProperty("runtimeInventorySha256").GetString() == package.Files.Single(f => f.Name == "runtime-inventory.json").Sha256,
            "INPUT_CAPABLE_BUILD_REFUSED");
        var variants = root.GetProperty("variants");
        ControlRules.Need(variants.ValueKind == JsonValueKind.Array && variants.GetArrayLength() == 3,
            "INPUT_BUILD_VARIANTS_REFUSED");
        string[] names = { "default", "defines-still-inert", "capable" };
        for (int i = 0; i < names.Length; i++) {
            var variant = variants[i];
            ControlRules.Need(variant.GetProperty("variant").GetString() == names[i] &&
                variant.GetProperty("physicalExecutionEnabled").GetBoolean() == (i == 2) &&
                ControlRules.Hex(variant.GetProperty("dllSha256").GetString(), 64), "INPUT_BUILD_VARIANT_REFUSED");
        }
        ControlRules.Need(variants[2].GetProperty("dllSha256").GetString() ==
            package.Files.Single(f => f.Name == "ExportPolicyControl.dll").Sha256, "INPUT_CAPABLE_DLL_REFUSED");
    }

    internal static ControlInputMaterial CreateMaterial(string attempt, string owner, string packageHash,
        ControlPackage package, string host, string boot, ControlServiceSnapshot guardian, DateTimeOffset now)
    {
        ControlRules.Need(ControlRules.Hex(attempt, 32) && ControlOwnerEntry.ValidOwnerSid(owner) &&
            ControlRules.Hex(packageHash, 64) && ControlRules.Hex(host, 64) && ControlRules.Hex(boot, 64) &&
            now != default && now.Offset == TimeSpan.Zero, "INPUT_MATERIAL_ARGUMENTS_REFUSED");
        NativeControlAdmission.ValidatePackage(package); ControlController.RequireOriginal(guardian);
        ControlRules.Need(ControlRules.Hash(ControlRules.Serialize(package)) == packageHash, "INPUT_MATERIAL_PACKAGE_PIN_REFUSED");
        var plan = new ControlPlan(1, ControlRules.Scope, attempt, owner,
            package.Files.Single(f => f.Name == "ExportPolicyControl.dll").Sha256, packageHash,
            package.Files.Single(f => f.Name == "runtime-inventory.json").Sha256,
            host, boot, now, now.AddHours(2));
        string planHash = ControlRules.Hash(ControlRules.Serialize(plan));
        var approval = new ControlOwnerApproval(1, ControlController.ApprovalScope, attempt, planHash,
            packageHash, owner, guardian, now, plan.ExpiresUtc, ControlController.Effects.ToArray());
        var pins = new ControlPins(planHash, ControlRules.Hash(ControlRules.Serialize(approval)), packageHash);
        var material = new ControlInputMaterial(plan, approval, pins); ValidateMaterial(material, now); return material;
    }

    internal static void ValidateMaterial(ControlInputMaterial material, DateTimeOffset now)
    {
        ControlRules.Need(material is not null && material.Plan is not null && material.Approval is not null,
            "INPUT_MATERIAL_REFUSED");
        var plan = material.Plan; var pins = material.Pins;
        var reservation = new ControlReservation(1, ControlRules.Scope, plan.AttemptId,
            pins.PlanSha256, pins.ApprovalSha256, pins.PackageSha256, plan.IssuedUtc);
        ControlController.ValidateApproval(material.Approval, new(plan, pins, reservation), now);
        ControlRules.Need(ControlOwnerEntry.ValidOwnerSid(plan.OwnerSid) &&
            plan.ExpiresUtc - plan.IssuedUtc == TimeSpan.FromHours(2), "INPUT_MATERIAL_WINDOW_REFUSED");
    }

    internal static ControlPreparedInput Describe(ControlInputArguments input, ControlInputMaterial material,
        string directory, DateTimeOffset now)
    {
        ValidateMaterial(material, now);
        ControlRules.Need(input.Prepare && input.OutputParent is not null && ValidOutputParent(input.OutputParent) &&
            directory == input.OutputParent + "\\lic008-export-policy-v5-input-" + material.Plan.AttemptId &&
            ControlOwnerEntry.ValidInputPath(directory) && input.ExpectedOwnerSid == material.Plan.OwnerSid &&
            input.PackageSha256 == material.Pins.PackageSha256, "INPUT_DESCRIPTOR_REFUSED");
        return new(1, "TEST_ONLY_EXPORT_POLICY_PREPARED_INPUT_V5", input.CandidateDirectory,
            input.BuildManifestSha256, input.PackageSha256, input.ExpectedOwnerSid, directory,
            material.Plan.AttemptId, material.Pins.PlanSha256, material.Pins.ApprovalSha256,
            material.Plan.IssuedUtc, material.Plan.ExpiresUtc, ControlController.Effects.ToArray(), true, false, false, false);
    }

    private sealed record Candidate(byte[] Manifest, ControlPackage Package, Dictionary<string, byte[]> Files);
    private static Candidate ReadCandidate(ControlInputArguments input)
    {
        ControlInputStage previousStage = stage;
        stage = ControlInputStage.Candidate;
        RequireOwner(input.ExpectedOwnerSid);
        using var candidateDirectories = PinDirectories(input.CandidateDirectory);
        byte[] manifest = ReadFile(input.CandidateDirectory + "\\package-manifest.json", 2097152);
        ControlRules.Need(ControlRules.Hash(manifest) == input.PackageSha256, "INPUT_PACKAGE_PIN_REFUSED");
        var package = ControlRules.Parse<ControlPackage>(manifest); NativeControlAdmission.ValidatePackage(package);
        ValidateBuildManifest(ReadFile(input.CandidateDirectory + "\\manifest.json", 2097152),
            input.BuildManifestSha256, input.PackageSha256, package);
        string packageDirectory = input.CandidateDirectory + "\\package";
        using var packageDirectories = PinDirectories(packageDirectory);
        ControlRules.Need(Directory.GetFileSystemEntries(packageDirectory).Select(Path.GetFileName)
            .OrderBy(n => n, StringComparer.Ordinal).SequenceEqual(package.Files.Select(f => f.Name)
            .OrderBy(n => n, StringComparer.Ordinal)), "INPUT_PACKAGE_SET_REFUSED");
        var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        foreach (var file in package.Files) {
            byte[] bytes = ReadFile(packageDirectory + "\\" + file.Name, 33554432);
            ControlRules.Need(bytes.Length == file.Size && ControlRules.Hash(bytes) == file.Sha256, "INPUT_PACKAGE_FILE_CHANGED");
            files.Add(file.Name, bytes);
        }
        stage = ControlInputStage.RuntimeInventory;
        NativeControlAdmission.VerifyRuntime(files["runtime-inventory.json"]);
        stage = ControlInputStage.Candidate;
        candidateDirectories.Check(); packageDirectories.Check(); RequireOwner(input.ExpectedOwnerSid);
        stage = previousStage;
        return new(manifest, package, files);
    }

    private static void Run(ControlInputArguments input)
    {
        stage = ControlInputStage.Capability;
        ControlRules.Need(!ControlCapability.Enabled && !ControlOwnerEntry.PhysicalEnabled &&
            !NativeControlRuntime.PhysicalEnabled, "INPUT_HELPER_CAPABILITY_REFUSED");
        RequireOwner(input.ExpectedOwnerSid);
        var candidate = ReadCandidate(input);
        stage = ControlInputStage.HostBinding;
        string host = NativeControlAdmission.HostHash(), boot = NativeControlIdentity.Boot();
        var deployment = new NativeControlDeployment(() => RequireOwner(input.ExpectedOwnerSid));
        stage = ControlInputStage.Guardian;
        var guardian = deployment.ObserveGuardian(); ControlController.RequireOriginal(guardian);
        void Preflight() {
            ControlInputStage previousStage = stage;
            RequireOwner(input.ExpectedOwnerSid);
            var fresh = ReadCandidate(input);
            stage = ControlInputStage.HostBinding;
            ControlRules.Need(fresh.Manifest.SequenceEqual(candidate.Manifest) &&
                NativeControlAdmission.HostHash() == host && NativeControlIdentity.Boot() == boot, "INPUT_CONTEXT_CHANGED");
            stage = ControlInputStage.Guardian;
            ControlController.RequireSameStopped(deployment.ObserveGuardian(), guardian, ControlController.OriginalBinary);
            stage = ControlInputStage.FreshSetup;
            deployment.RequireFreshSetup();
            stage = ControlInputStage.TestRoot;
            RequireTestRootAbsent(); RequireOwner(input.ExpectedOwnerSid);
            stage = previousStage;
        }
        Preflight();
        if (!input.Prepare) {
            stage = ControlInputStage.Output;
            Console.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(new {
                schemaVersion = 1, scope = "TEST_ONLY_EXPORT_POLICY_OWNER_PREFLIGHT_V5", status = "READY_FOR_INPUT_PREPARATION",
                candidateDirectory = input.CandidateDirectory, buildManifestSha256 = input.BuildManifestSha256,
                packageSha256 = input.PackageSha256, expectedOwnerSid = input.ExpectedOwnerSid,
                hostSha256 = host, bootIdentity = boot, guardian,
                approvalIssued = false, physicalStageExecuted = false, securityAccepted = false, productionAccepted = false
            }))); return;
        }
        stage = ControlInputStage.Preparation;
        using var parentDirectories = PinDirectories(input.OutputParent!);
        string attempt = Guid.NewGuid().ToString("N");
        var material = CreateMaterial(attempt, input.ExpectedOwnerSid, input.PackageSha256,
            candidate.Package, host, boot, guardian, DateTimeOffset.UtcNow);
        string directory = input.OutputParent + "\\lic008-export-policy-v5-input-" + attempt;
        var descriptor = Describe(input, material, directory, DateTimeOffset.UtcNow);
        Preflight(); parentDirectories.Check(); ValidateMaterial(material, DateTimeOffset.UtcNow);
        stage = ControlInputStage.PreparationWrite;
        ControlRules.Need(CreateDirectoryW(directory, IntPtr.Zero), "INPUT_NEW_DIRECTORY_REFUSED_RETAIN");
        // No catch cleanup: partial output is evidence, never silently reused.
        using var outputDirectories = PinDirectories(directory);
        foreach (var row in new[] {
            (Name: "plan.json", Bytes: ControlRules.Serialize(material.Plan)),
            (Name: "approval.json", Bytes: ControlRules.Serialize(material.Approval)),
            (Name: "prepared-input.json", Bytes: ControlRules.Serialize(descriptor))
        }) {
            Preflight(); ValidateMaterial(material, DateTimeOffset.UtcNow);
            stage = ControlInputStage.PreparationWrite;
            parentDirectories.Check(); outputDirectories.Check(); WriteNew(directory + "\\" + row.Name, row.Bytes);
            Preflight(); ValidateMaterial(material, DateTimeOffset.UtcNow);
            parentDirectories.Check(); outputDirectories.Check();
        }
        stage = ControlInputStage.PreparationReadback;
        ControlRules.Need(Directory.GetFileSystemEntries(directory).Select(Path.GetFileName)
            .OrderBy(n => n, StringComparer.Ordinal).SequenceEqual(new[] { "approval.json", "plan.json", "prepared-input.json" }),
            "INPUT_OUTPUT_SET_CHANGED_RETAIN");
        ControlRules.Need(ReadFile(directory + "\\plan.json", 2097152).SequenceEqual(ControlRules.Serialize(material.Plan)) &&
            ReadFile(directory + "\\approval.json", 2097152).SequenceEqual(ControlRules.Serialize(material.Approval)) &&
            ReadFile(directory + "\\prepared-input.json", 2097152).SequenceEqual(ControlRules.Serialize(descriptor)),
            "INPUT_FINAL_READBACK_CHANGED_RETAIN");
        Preflight(); ValidateMaterial(material, DateTimeOffset.UtcNow); outputDirectories.Check(); parentDirectories.Check();
        stage = ControlInputStage.Output;
        Console.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(descriptor)));
    }

    private static void RequireOwner(string expected)
    {
        ControlInputStage previousStage = stage;
        stage = ControlInputStage.Runtime;
        NativeControlIdentity.RuntimeGuard();
        stage = ControlInputStage.OwnerTokenOpen;
        ControlRules.Need(ControlOwnerEntry.ValidOwnerSid(expected), "INPUT_OWNER_SID_REFUSED");
        using var thread = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(thread is null, "INPUT_IMPERSONATION_REFUSED");
        using var identity = NativeControlIdentity.OpenOwnerForMembership();
        stage = ControlInputStage.OwnerTokenMembership;
        ControlRules.Need(identity.User?.Value == expected && (identity.Owner?.Value == expected ||
            identity.Owner?.Value == ControlRules.AdminSid) && new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator),
            "INPUT_OWNER_ELEVATION_REQUIRED");
        stage = ControlInputStage.OwnerTokenShape;
        foreach (int kind in new[] { 8, 20 })
            ControlRules.Need(GetTokenInformation(identity.AccessToken, kind, out int value, 4, out int written) &&
                written == 4 && value == 1, "INPUT_PRIMARY_ELEVATED_TOKEN_REQUIRED");
        stage = ControlInputStage.Environment;
        NativeControlAdmission.VerifyEnvironment(ControlRole.Guardian);
        stage = previousStage;
    }

    private static void RequireTestRootAbsent()
    {
        using var parent = PinDirectories(@"C:\ProgramData");
        uint attributes = GetFileAttributesW(ControlRules.Root); int error = Marshal.GetLastWin32Error();
        // Access denied and an inaccessible parent are not proof of absence.
        ControlRules.Need(attributes == uint.MaxValue && error == 2, "INPUT_TEST_ROOT_PRESENT_OR_ABSENCE_UNPROVEN");
        parent.Check();
    }

    private sealed class DirectoryPins : IDisposable
    {
        internal readonly List<(SafeFileHandle Handle, string Path)> Items = new();
        internal void Check() { foreach (var row in Items) CheckHandle(row.Handle, row.Path, true); }
        public void Dispose() { for (int i = Items.Count - 1; i >= 0; i--) Items[i].Handle.Dispose(); }
    }
    private static DirectoryPins PinDirectories(string path)
    {
        ControlRules.Need(ControlOwnerEntry.ValidInputPath(path) && Path.GetFullPath(path) == path, "INPUT_DIRECTORY_PATH_REFUSED");
        var parents = new Stack<string>();
        for (string? cursor = path; cursor is not null; cursor = Path.GetDirectoryName(cursor)) parents.Push(cursor);
        var pins = new DirectoryPins();
        try {
            foreach (string parent in parents) {
                var handle = CreateFileW(parent, 0x80, 3, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
                pins.Items.Add((handle, parent)); CheckHandle(handle, parent, true);
            }
            return pins;
        }
        catch { pins.Dispose(); throw; }
    }
    private static byte[] ReadFile(string path, int maximum)
    {
        ControlRules.Need(ControlOwnerEntry.ValidInputPath(path) && Path.GetFullPath(path) == path, "INPUT_FILE_PATH_REFUSED");
        using var parents = PinDirectories(Path.GetDirectoryName(path)!);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        CheckHandle(stream.SafeFileHandle, path, false);
        ControlRules.Need(stream.Length > 0 && stream.Length <= maximum, "INPUT_FILE_SIZE_REFUSED");
        byte[] bytes = new byte[checked((int)stream.Length)]; stream.ReadExactly(bytes);
        ControlRules.Need(stream.Position == stream.Length, "INPUT_FILE_CHANGED");
        CheckHandle(stream.SafeFileHandle, path, false); parents.Check(); return bytes;
    }
    private static void WriteNew(string path, byte[] bytes)
    {
        ControlRules.Need(ControlOwnerEntry.ValidInputPath(path) && Path.GetFullPath(path) == path &&
            bytes is { Length: > 0 and <= 2097152 }, "INPUT_WRITE_REFUSED");
        using var parents = PinDirectories(Path.GetDirectoryName(path)!);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.Read);
        CheckHandle(stream.SafeFileHandle, path, false);
        stream.Write(bytes); stream.Flush(true); stream.Position = 0;
        byte[] readback = new byte[bytes.Length]; stream.ReadExactly(readback);
        ControlRules.Need(stream.Length == bytes.Length && bytes.SequenceEqual(readback), "INPUT_WRITE_READBACK_REFUSED_RETAIN");
        CheckHandle(stream.SafeFileHandle, path, false); parents.Check();
    }
    private static void CheckHandle(SafeFileHandle handle, string path, bool directory)
    {
        ControlRules.Need(!handle.IsInvalid && GetFileType(handle) == 1 && GetFileInformationByHandle(handle, out var info) &&
            (info.Attributes & 0x400) == 0 && ((info.Attributes & 0x10) != 0) == directory &&
            (directory || info.Links == 1), "INPUT_HANDLE_REFUSED");
        var name = new StringBuilder(1024); uint length = GetFinalPathNameByHandleW(handle, name, 1024, 0);
        ControlRules.Need(length is > 0 and < 1024 && string.Equals(name.ToString(), "\\\\?\\" + path,
            StringComparison.OrdinalIgnoreCase), "INPUT_FINAL_PATH_REFUSED");
    }
    [StructLayout(LayoutKind.Sequential)] private struct FileInfo
    { internal uint Attributes, CreatedLow, CreatedHigh, AccessedLow, AccessedHigh, WrittenLow, WrittenHigh,
        Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, IntPtr attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateDirectoryW(string path, IntPtr attributes);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern uint GetFileAttributesW(string path);
    [DllImport("kernel32.dll")] private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle handle, int kind, out int value, int size, out int written);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DuplicateTokenEx(SafeAccessTokenHandle source, uint access, IntPtr attributes,
        int impersonationLevel, int tokenType, out SafeAccessTokenHandle duplicate);
}
