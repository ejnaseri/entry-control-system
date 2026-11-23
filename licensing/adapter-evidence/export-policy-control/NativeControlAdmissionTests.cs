using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal static class NativeControlAdmissionTests
{
    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { ControlRules.Need(ok, "CONTROL_ADMISSION_TEST_FAILED"); cases++; }
        void Reject(Action action) {
            try { action(); } catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("CONTROL_ADMISSION_REFUSAL_MISSING");
        }
        var names = new[] { "ExportPolicyControl.exe", "ExportPolicyControl.dll", "ExportPolicyControl.runtimeconfig.json", "runtime-inventory.json" };
        var package = new ControlPackage(1, "TEST_ONLY_EXPORT_POLICY_PACKAGE_V5", names.Select(n => new ControlPackageFile(n, 10, new('a', 64))).ToArray());
        NativeControlAdmission.ValidatePackage(package); cases++;
        foreach (var bad in new[] { package with { SchemaVersion = 0 }, package with { Scope = "OTHER" },
            package with { Files = null! }, package with { Files = package.Files[..3] },
            package with { Files = package.Files.Reverse().ToArray() }, package with { Files = new[] { package.Files[0], package.Files[0], package.Files[2], package.Files[3] } } })
            Reject(() => NativeControlAdmission.ValidatePackage(bad));
        Reject(() => NativeControlAdmission.ValidatePackage(null!));
        foreach (var bad in new[] { package.Files[0] with { Size = 0 }, package.Files[0] with { Size = 33554433 },
            package.Files[0] with { Name = "../escape" }, package.Files[0] with { Sha256 = "bad" }, (ControlPackageFile)null! })
            Reject(() => NativeControlAdmission.ValidatePackage(package with { Files = new[] { bad }.Concat(package.Files.Skip(1)).ToArray() }));
        var files = new[] { "runtime/System.Private.CoreLib.dll", "runtime/coreclr.dll", "runtime/hostpolicy.dll", "fxr/hostfxr.dll" }
            .Select(n => new ControlRuntimeFile(n.Split('/')[0], n.Split('/')[1], 10, new('b', 64))).ToArray();
        var inventory = new ControlRuntimeInventory(1, "10.0.11", files);
        NativeControlAdmission.ValidateRuntime(inventory); cases++;
        foreach (var bad in new[] { inventory with { SchemaVersion = 2 }, inventory with { Runtime = "10.0.10" },
            inventory with { Files = null! }, inventory with { Files = files[..3] }, inventory with { Files = files.Append(files[0]).ToArray() } })
            Reject(() => NativeControlAdmission.ValidateRuntime(bad));
        Reject(() => NativeControlAdmission.ValidateRuntime(null!));
        foreach (var bad in new[] { files[0] with { Name = "../escape" }, files[0] with { Name = "bad:stream" }, files[0] with { Name = "" },
            files[0] with { Name = "missing.dll" }, files[0] with { Group = "other" }, files[0] with { Size = -1 },
            files[0] with { Size = 134217729 }, files[0] with { Sha256 = "bad" }, (ControlRuntimeFile)null! })
            Reject(() => NativeControlAdmission.ValidateRuntime(inventory with { Files = new[] { bad }.Concat(files.Skip(1)).ToArray() }));
        NativeControlAdmission.ValidateEnvironment(new[] { "PATH", "TEMP", "=C:" }); cases++;
        foreach (var name in new[] { "DOTNET_ROOT", "dotnet_startup_hooks", "COMPLUS_X", "CORECLR_X", "COR_X", "COREHOST_X", "APPDOMAIN_MANAGER_ASM",
            "appdomain_manager_type", "DEVPATH", "__COMPAT_LAYER", "", "A\0B", null! })
            Reject(() => NativeControlAdmission.ValidateEnvironment(new[] { name }));
        Reject(() => NativeControlAdmission.ValidateEnvironment(null!));
        Reject(() => NativeControlAdmission.ValidateEnvironment(Enumerable.Repeat("PATH", 1025)));

        var now = DateTimeOffset.UnixEpoch.AddHours(1);
        var plan = new ControlPlan(1, ControlRules.Scope, new('a', 32), "S-1-5-21-1-2-3-1001", new('a', 64), new('b', 64),
            new('c', 64), new('d', 64), new('e', 64), now.AddMinutes(-5), now.AddHours(1));
        var pins = new ControlPins(ControlRules.Hash(ControlRules.Serialize(plan)), new('f', 64), plan.PackageSha256);
        var session = new ControlSession(plan, pins, new(1, ControlRules.Scope, plan.AttemptId, pins.PlanSha256, pins.ApprovalSha256, pins.PackageSha256, now.AddMinutes(-1)));
        var token = new ControlTokenSnapshot(ControlRules.GuardianSid, ControlRules.GuardianSid, 1, 0, ControlRules.GuardianSid, 0, 0, false, true);
        var exported = new ExportObservation("EXPORTED", null, null);
        var error = new ExportObservation("ERROR_OBSERVED", "CRYPTOGRAPHIC", MatchedExportProbe.Unsupported);
        var rows = new[] { "generic-private", "pkcs8-private", "opaque-transport" }
            .Select(f => new PairObservation(f, exported, error, "POLICY_DIFFERENTIAL_OBSERVED")).ToArray();
        var report = new ControlNativeReport(1, NativeControlRuntime.ReportScope, "Guardian", plan.AttemptId, pins.PlanSha256,
            pins.ApprovalSha256, pins.PackageSha256, plan.AssemblySha256, plan.RuntimeInventorySha256, plan.HostSha256, plan.BootIdentity,
            token, 42, now.AddSeconds(-2), true, false, "POLICY_DIFFERENTIAL_OBSERVED", rows, null, "NONE", false, false);
        void Validate(ControlNativeReport value) => NativeControlRuntime.ValidateReport(value, ControlRole.Guardian, session, now, 42);
        Validate(report); cases++;
        Reject(() => NativeControlRuntime.ValidateReport(report, ControlRole.Guardian, session, plan.ExpiresUtc, 42));
        Reject(() => NativeControlRuntime.ValidateReport(report, ControlRole.Guardian, session, plan.ExpiresUtc.AddTicks(1), 42));
        foreach (var bad in new[] { report with { SchemaVersion = 2 }, report with { Scope = "SYNTHETIC" }, report with { Role = "Setup" },
            report with { AttemptId = new('b', 32) }, report with { PlanSha256 = new('0', 64) }, report with { ApprovalSha256 = new('0', 64) },
            report with { PackageSha256 = new('0', 64) }, report with { AssemblySha256 = new('0', 64) }, report with { RuntimeInventorySha256 = new('0', 64) },
            report with { HostSha256 = new('0', 64) }, report with { BootIdentity = new('0', 64) }, report with { Token = token with { User = "S-1-5-18" } },
            report with { ProcessId = 43 }, report with { ProcessStartedUtc = now.AddHours(-1) }, report with { ProcessStartedUtc = now.AddSeconds(1) },
            report with { WorkerEnded = false }, report with { DeadlineExceeded = true }, report with { RuntimeAuthority = "YES" },
            report with { SecurityAccepted = true }, report with { ProductionAccepted = true }, report with { Pairs = null! },
            report with { Pairs = rows[..2] }, report with { Pairs = Array.Empty<PairObservation>() }, report with { Pairs = rows.Reverse().ToArray() },
            report with { Outcome = "PASS" }, report with { Outcome = "CONTROL_INCONCLUSIVE" } }) Reject(() => Validate(bad));
        Reject(() => Validate(null!));
        var failed = report with { Outcome = "UNKNOWN", Pairs = Array.Empty<PairObservation>(), Failure = new("VALIDATION", 1), DeadlineExceeded = true };
        Validate(failed); cases++;
        Reject(() => Validate(failed with { Failure = new("SECRET_CANARY", 1) }));
        Reject(() => Validate(failed with { Pairs = rows }));
        var incomplete = rows.Select(r => r with { Exportable = error, Outcome = "CONTROL_INCONCLUSIVE" }).ToArray();
        Validate(report with { Outcome = "CONTROL_INCONCLUSIVE", Pairs = incomplete }); cases++;
        var notRun = new ExportObservation("NOT_RUN", null, null);
        var unknown = new ExportObservation("UNKNOWN", "WRAPPED_EXCEPTION", MatchedExportProbe.Unsupported);
        for (int stop = 0; stop < 3; stop++) {
            foreach (bool positive in new[] { true, false }) {
                var terminal = rows[stop] with { Exportable = positive ? unknown : exported,
                    NonExportable = positive ? notRun : unknown, Outcome = "UNKNOWN" };
                var prefix = rows.Take(stop).Append(terminal).ToArray();
                Validate(report with { Outcome = "UNKNOWN", Pairs = prefix }); cases++;
                Reject(() => Validate(report with { Outcome = "UNKNOWN", Pairs = prefix.Append(rows[2]).ToArray() }));
                Reject(() => Validate(report with { Outcome = "POLICY_DIFFERENTIAL_OBSERVED", Pairs = prefix }));
            }
            var boundary = rows.Take(stop).Append(rows[stop] with {
                NonExportable = new("BOUNDARY_FAILURE", "EXPORT_RETURNED", null), Outcome = "BOUNDARY_FAILURE" }).ToArray();
            Validate(report with { Outcome = "BOUNDARY_FAILURE", Pairs = boundary }); cases++;
        }
        foreach (var bad in new[] { exported with { FailureKind = "SECRET_CANARY" }, exported with { ManagedHResult = 1 },
            error with { ManagedHResult = 1 }, error with { FailureKind = null }, unknown with { ManagedHResult = null },
            unknown with { FailureKind = "UNEXPECTED_CRYPTOGRAPHIC" }, notRun, new ExportObservation("PASS", null, null) })
            Reject(() => Validate(report with { Pairs = new[] { rows[0] with { Exportable = bad } }.Concat(rows.Skip(1)).ToArray() }));
        Reject(() => Validate(report with { Pairs = new[] { rows[0] with { NonExportable = exported } }.Concat(rows.Skip(1)).ToArray() }));
        Reject(() => Validate(report with { Pairs = new PairObservation[] { null! } }));
        Reject(() => Validate(report with { Pairs = new[] { rows[0] with { Exportable = null! } } }));
        Reject(() => Validate(report with { Pairs = new[] { rows[0] with { NonExportable = null! } } }));
        var setupSid = NativeControlIdentity.DerivedServiceSid(ControlRole.Setup);
        var setup = report with { Role = "Setup", Outcome = "SETUP_COMPLETE", Pairs = Array.Empty<PairObservation>(),
            Token = new(ControlRules.SystemSid, ControlRules.SystemSid, 1, 1, setupSid, 14, 1, false, true) };
        NativeControlRuntime.ValidateReport(setup, ControlRole.Setup, session, now, 42); cases++;
        NativeControlRuntime.ValidateSetupPredecessor(ControlRules.Serialize(setup), session, now); cases++;
        foreach (var invalid in new[] { report, setup with { DeadlineExceeded = true },
            setup with { Outcome = "UNKNOWN", Failure = new("VALIDATION", 1) },
            setup with { WorkerEnded = false }, setup with { ApprovalSha256 = new('a', 64) } })
            Reject(() => NativeControlRuntime.ValidateSetupPredecessor(ControlRules.Serialize(invalid), session, now));
        Reject(() => NativeControlRuntime.ValidateReport(setup with { Pairs = rows }, ControlRole.Setup, session, now, 42));
        Check(NativeControlRuntime.PhysicalEnabled == ControlCapability.Enabled);
        // Inert builds reject valid-looking calls at the gate. Capable builds
        // use malformed pins only, so this self-test never enters native SCM.
        var dispatchPins = ControlCapability.Enabled ? pins with { PlanSha256 = "bad" } : pins;
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian, (ControlRole)99 })
            Reject(() => NativeControlRuntime.Dispatch(role, dispatchPins));
        Reject(() => NativeControlRuntime.Dispatch(ControlRole.Setup, null!));
        return cases;
    }
}
