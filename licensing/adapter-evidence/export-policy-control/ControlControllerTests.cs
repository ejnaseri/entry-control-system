using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Canonical records and managed deployment fakes only. No file, service, token,
// native worker or key is opened by this suite. In capable builds, dispatch
// checks always use malformed arguments that fail before token/native access.
internal static class ControlControllerTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
    private const string Canary = "CONTROLLER-CALLBACK-PRIVATE-ERROR-MUST-NOT-APPEAR";
    private static readonly string[] HappySteps = {
        "observe:1", "fresh", "deploy", "register", "run:Setup", "observe:2", "borrow",
        "observe:3", "run:Guardian", "observe:4", "restore", "observe:5", "write"
    };

    internal static int Run()
    {
        int cases = 0;
        void Check(bool value, string label = "assertion") {
            ControlRules.Need(value, "CONTROL_CONTROLLER_TEST_FAILED:" + label); cases++;
        }
        Exception Reject(Action action, string? reason = null) {
            try { action(); }
            catch (Exception error) when (error is InvalidDataException or IOException or JsonException or ArgumentException) {
                ControlRules.Need(reason is null || error.Message == reason, "CONTROL_CONTROLLER_WRONG_REFUSAL:" + reason);
                cases++; return error;
            }
            throw new InvalidDataException("CONTROL_CONTROLLER_REFUSAL_MISSING:" + reason);
        }
        void Private(ControlControllerResult result) {
            Check(!result.SecurityAccepted && !result.ProductionAccepted);
            string json = Encoding.UTF8.GetString(ControlRules.Serialize(result));
            Check(!json.Contains(Canary, StringComparison.Ordinal) && !json.Contains("StackTrace", StringComparison.Ordinal) &&
                !json.Contains("Message", StringComparison.Ordinal) && !json.Contains("PASS", StringComparison.Ordinal));
        }

        var good = new Fixture();
        ControlController.ValidateBundle(good.Bundle); cases++;
        ControlController.ValidateApproval(good.Approval, good.Session, Now); cases++;
        var controller = new ControlController();
        var complete = good.Run(controller);
        Check(good.Deployment.Steps.SequenceEqual(HappySteps));
        Check(good.VerifyCalls == 8 && good.Deployment.Current == good.Approval.Guardian);
        Check(complete.SchemaVersion == 3 && complete.Scope == "TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3" &&
            complete.AttemptId == good.Session.Plan.AttemptId && complete.PlanSha256 == good.Session.Pins.PlanSha256 &&
            complete.ApprovalSha256 == good.Session.Pins.ApprovalSha256 && complete.PackageSha256 == good.Session.Pins.PackageSha256);
        Check(complete.Phase == "complete" && complete.Outcome == "POLICY_DIFFERENTIAL_OBSERVED" &&
            complete.GuardianBorrowAttempted && complete.GuardianRestored && complete.Failure is null);
        Check(complete.SetupReportSha256 == ControlRules.Hash(good.Deployment.Setup.Report) &&
            complete.GuardianReportSha256 == ControlRules.Hash(good.Deployment.Guardian.Report));
        Check(good.Deployment.Results.Count == 1 && good.Deployment.Results[0] == complete);
        Check(good.Deployment.Pins.All(p => p == good.Session.Pins) && good.Deployment.Deployed == good.Bundle);
        Private(complete);
        int usedSteps = good.Deployment.Steps.Count, usedVerify = good.VerifyCalls;
        Reject(() => good.Run(controller), "CONTROL_CONTROLLER_ALREADY_ATTEMPTED");
        Check(good.Deployment.Steps.Count == usedSteps && good.VerifyCalls == usedVerify);

        // Every deployment callback can fail. Only failure publication is
        // allowed afterward; the failed callback itself is never retried.
        foreach (string point in HappySteps) {
            var f = new Fixture(); var oneAttempt = new ControlController();
            f.Deployment.FailAt = point;
            Exception error = Reject(() => f.Run(oneAttempt));
            Check(ReferenceEquals(error, f.Deployment.Failure), point);
            int index = Array.IndexOf(HappySteps, point);
            var expected = HappySteps.Take(index + 1).ToList();
            if (index >= 2 && point != "write") expected.Add("write");
            Check(f.Deployment.Steps.SequenceEqual(expected), point);
            Check(f.Deployment.Steps.Count(s => s == "borrow") <= 1 && f.Deployment.Steps.Count(s => s == "restore") <= 1);
            if (point == "write") Check(f.Deployment.Results.Count == 0 && f.Deployment.Steps.Count(s => s == "write") == 1);
            else if (index >= 2) {
                var failed = f.Deployment.Results.Single();
                Check(failed.Outcome == "UNKNOWN" && failed.Failure?.Kind == "IO" && failed.Failure.ManagedHResult == error.HResult);
                Check(failed.GuardianBorrowAttempted == (index >= 6) && failed.GuardianRestored == (index > 11));
                Private(failed);
            }
            else Check(f.Deployment.Results.Count == 0);
            int count = f.Deployment.Steps.Count;
            Reject(() => f.Run(oneAttempt), "CONTROL_CONTROLLER_ALREADY_ATTEMPTED");
            Check(f.Deployment.Steps.Count == count);
        }
        var partialBorrow = new Fixture();
        partialBorrow.Deployment.FailAfterBorrow = true;
        Check(ReferenceEquals(Reject(() => partialBorrow.Run()), partialBorrow.Deployment.Failure));
        Check(partialBorrow.Deployment.Current.BinaryPath == ControlController.ServiceCommand(ControlRole.Guardian, partialBorrow.Session.Pins));
        Check(partialBorrow.Deployment.Steps.SequenceEqual(HappySteps.Take(7).Append("write")));
        var partialResult = partialBorrow.Deployment.Results.Single();
        Check(partialResult.GuardianBorrowAttempted && !partialResult.GuardianRestored && partialResult.Outcome == "UNKNOWN");
        Private(partialResult);

        // Owner/custody verification precedes every mutation and publication.
        int[] verifyPrefix = { 0, 2, 3, 4, 5, 8, 9, 12 };
        for (int stop = 1; stop <= verifyPrefix.Length; stop++) {
            var f = new Fixture { FailVerifyAt = stop };
            var error = Reject(() => f.Run());
            Check(ReferenceEquals(error, f.VerifyFailure));
            var expected = HappySteps.Take(verifyPrefix[stop - 1]).ToList();
            if (stop > 1) expected.Add("write");
            Check(f.Deployment.Steps.SequenceEqual(expected), "verify:" + stop);
            Check(f.VerifyCalls == (stop == 1 ? 1 : stop + 1));
        }
        var deniedPublication = new Fixture { FailVerifyFrom = 6 };
        Reject(() => deniedPublication.Run());
        Check(deniedPublication.Deployment.Steps.SequenceEqual(HappySteps.Take(8)) && deniedPublication.Deployment.Results.Count == 0);
        Check(deniedPublication.Deployment.Current.BinaryPath == ControlController.ServiceCommand(ControlRole.Guardian, deniedPublication.Session.Pins));

        // Report bytes never establish process termination. A malformed or
        // missing Setup report blocks borrowing; a stopped Guardian is restored
        // before its report is evaluated, even when those bytes are missing.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            foreach (byte[] bytes in new[] { Array.Empty<byte>(), Encoding.UTF8.GetBytes("{"), Encoding.UTF8.GetBytes("null") }) {
                var f = new Fixture();
                f.Deployment.SetRun(role, f.Deployment.GetRun(role) with { Report = bytes });
                Reject(() => f.Run());
                Check(f.Deployment.Steps.Contains("borrow") == (role == ControlRole.Guardian));
                Check(f.Deployment.Steps.Contains("restore") == (role == ControlRole.Guardian));
                var failed = f.Deployment.Results.Single();
                Check(failed.GuardianRestored == (role == ControlRole.Guardian) && failed.GuardianReportSha256 is null && failed.Outcome == "UNKNOWN");
            }
        }
        foreach (bool hasReport in new[] { false, true }) {
            var f = new Fixture();
            f.Deployment.Guardian = f.Deployment.Guardian with {
                ProcessExited = false, Report = hasReport ? f.Deployment.Guardian.Report : Array.Empty<byte>()
            };
            Reject(() => f.Run(), "CONTROL_GUARDIAN_PROCESS_UNRESOLVED_RETAIN");
            Check(!f.Deployment.Steps.Contains("restore") && f.Deployment.Results.Single().GuardianBorrowAttempted &&
                !f.Deployment.Results.Single().GuardianRestored);
        }
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            var baseline = new Fixture().Deployment.GetRun(role);
            foreach (var bad in new[] {
                baseline with { ProcessExited = false }, baseline with { ProcessId = 0 }, baseline with { ProcessId = -1 },
                baseline with { ProcessId = baseline.ProcessId + 1 }, baseline with { StartedUtc = Now.AddMinutes(-10) },
                baseline with { StartedUtc = Now.AddTicks(1) }, baseline with { StartedUtc = baseline.StartedUtc.AddTicks(1) },
                baseline with { StartedUtc = baseline.StartedUtc.ToOffset(TimeSpan.FromHours(1)) },
                baseline with { Win32Exit = 1 }, baseline with { ServiceExit = 1 }, (ControlServiceRun)null!
            }) {
                var f = new Fixture(); f.Deployment.SetRun(role, bad);
                Reject(() => f.Run());
                bool restore = role == ControlRole.Guardian && bad is not null && bad.ProcessExited && bad.ProcessId > 0;
                Check(f.Deployment.Steps.Contains("borrow") == (role == ControlRole.Guardian));
                Check(f.Deployment.Steps.Contains("restore") == restore);
                Check(f.Deployment.Results.Single().GuardianRestored == restore);
            }
        }

        // Exercise binding failures through the controller, so valid-looking
        // evidence cannot skip Setup or authorize a live-process restoration.
        Func<ControlNativeReport, ControlNativeReport>[] corruptReport = {
            r => r with { SchemaVersion = 2 }, r => r with { Scope = ControlRules.Scope },
            r => r with { Role = r.Role == "Setup" ? "Guardian" : "Setup" }, r => r with { AttemptId = new('b', 32) },
            r => r with { PlanSha256 = new('0', 64) }, r => r with { ApprovalSha256 = new('0', 64) },
            r => r with { PackageSha256 = new('0', 64) }, r => r with { AssemblySha256 = new('0', 64) },
            r => r with { RuntimeInventorySha256 = new('0', 64) }, r => r with { HostSha256 = new('0', 64) },
            r => r with { BootIdentity = new('0', 64) }, r => r with { ProcessId = r.ProcessId + 1 },
            r => r with { ProcessStartedUtc = r.ProcessStartedUtc.AddTicks(1) },
            r => r with { ProcessStartedUtc = Now.AddMinutes(-10) }, r => r with { ProcessStartedUtc = Now.AddTicks(1) },
            r => r with { ProcessStartedUtc = r.ProcessStartedUtc.ToOffset(TimeSpan.FromHours(1)) },
            r => r with { WorkerEnded = false }, r => r with { DeadlineExceeded = true },
            r => r with { RuntimeAuthority = "ALLOWED" }, r => r with { SecurityAccepted = true },
            r => r with { ProductionAccepted = true }, r => r with { Token = r.Token with { QueryComplete = false } },
            r => r with { Outcome = "PASS" }, r => r with { Pairs = null! }
        };
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian })
        foreach (var corrupt in corruptReport) {
            var f = new Fixture(); f.Deployment.SetReport(role, corrupt(f.Report(role)));
            Reject(() => f.Run());
            Check(f.Deployment.Steps.Contains("borrow") == (role == ControlRole.Guardian));
            Check(f.Deployment.Steps.Contains("restore") == (role == ControlRole.Guardian));
            Check(f.Deployment.Results.Single().Outcome == "UNKNOWN");
        }
        var unsuccessfulSetup = new Fixture();
        unsuccessfulSetup.Deployment.SetReport(ControlRole.Setup, unsuccessfulSetup.Report(ControlRole.Setup) with {
            Outcome = "UNKNOWN", Failure = new("VALIDATION", 1)
        });
        Reject(() => unsuccessfulSetup.Run(), "CONTROL_SUCCESSFUL_SETUP_REPORT_REQUIRED");
        Check(!unsuccessfulSetup.Deployment.Steps.Contains("borrow"));
        var shortMatrix = new Fixture();
        shortMatrix.Deployment.SetReport(ControlRole.Guardian, shortMatrix.Report(ControlRole.Guardian) with {
            Pairs = shortMatrix.Report(ControlRole.Guardian).Pairs[..2]
        });
        Reject(() => shortMatrix.Run(), "CONTROL_NATIVE_MATRIX_INCOMPLETE");
        Check(shortMatrix.Deployment.Results.Single().GuardianRestored);

        // Honest inconclusive, unknown and boundary observations keep their
        // outcome and remain non-acceptance evidence after confirmed restoration.
        foreach (string outcome in new[] { "CONTROL_INCONCLUSIVE", "UNKNOWN", "BOUNDARY_FAILURE" }) {
            var f = new Fixture(); var report = f.Report(ControlRole.Guardian);
            PairObservation[] rows = outcome == "CONTROL_INCONCLUSIVE"
                ? report.Pairs.Select(p => p with { Exportable = new("ERROR_OBSERVED", "CRYPTOGRAPHIC", MatchedExportProbe.Unsupported), Outcome = outcome }).ToArray()
                : new[] { report.Pairs[0] with {
                    NonExportable = outcome == "UNKNOWN" ? new("UNKNOWN", "UNEXPECTED_EXCEPTION", 1) : new("BOUNDARY_FAILURE", "EXPORT_RETURNED", null),
                    Outcome = outcome
                } };
            f.Deployment.SetReport(ControlRole.Guardian, report with { Outcome = outcome, Pairs = rows });
            if (outcome != "CONTROL_INCONCLUSIVE") f.Deployment.Guardian = f.Deployment.Guardian with { Win32Exit = 1066, ServiceExit = 1 };
            var result = f.Run();
            Check(result.Outcome == outcome && result.GuardianRestored && result.Failure is null);
            Private(result);
            if (outcome != "CONTROL_INCONCLUSIVE") {
                f = new Fixture(); report = f.Report(ControlRole.Guardian);
                f.Deployment.SetReport(ControlRole.Guardian, report with { Outcome = outcome, Pairs = rows });
                Reject(() => f.Run(), "CONTROL_UNKNOWN_SERVICE_SUCCESS_REFUSED");
                Check(f.Deployment.Results.Single().GuardianRestored);
            }
        }

        // No partial configuration match authorizes borrowing or restoration.
        Func<ControlServiceSnapshot, ControlServiceSnapshot>[] drift = {
            s => s with { Name = "OtherService" }, s => s with { BinaryPath = "other.exe" },
            s => s with { Account = "LocalSystem" }, s => s with { StartType = 2 }, s => s with { ServiceType = 32 },
            s => s with { ErrorControl = 0 }, s => s with { SidType = 0 }, s => s with { State = 4 },
            s => s with { ProcessId = 42 }, s => s with { OtherConfigurationSha256 = new('f', 64) }
        };
        foreach (int observation in new[] { 1, 2, 3, 4, 5 })
        foreach (var change in drift) {
            var f = new Fixture();
            f.Deployment.ChangeObservation = (index, snapshot) => index == observation ? change(snapshot) : snapshot;
            Reject(() => f.Run(), "CONTROL_GUARDIAN_CHANGED_RETAIN");
            Check(f.Deployment.Steps.Contains("borrow") == (observation >= 3));
            Check(f.Deployment.Steps.Contains("run:Guardian") == (observation >= 4));
            Check(f.Deployment.Steps.Contains("restore") == (observation == 5));
            if (observation != 1) Check(!f.Deployment.Results.Single().GuardianRestored);
        }

        // Expiry before, during and after the owner callback is rechecked. An
        // expired session cannot publish new authority or restore Guardian.
        foreach (DateTimeOffset expired in new[] { good.Session.Plan.ExpiresUtc, good.Session.Plan.ExpiresUtc.AddTicks(1), Now.AddHours(-1) }) {
            var f = new Fixture { CurrentTime = expired };
            Reject(() => f.Run(), "CONTROL_PLAN_REFUSED");
            Check(f.Deployment.Steps.Count == 0 && f.VerifyCalls == 0);
        }
        var expiresInCallback = new Fixture();
        expiresInCallback.OnVerify = () => expiresInCallback.CurrentTime = expiresInCallback.Session.Plan.ExpiresUtc;
        Reject(() => expiresInCallback.Run(), "CONTROL_PLAN_REFUSED");
        Check(expiresInCallback.VerifyCalls == 1 && expiresInCallback.Deployment.Steps.Count == 0);
        foreach (string point in new[] { "run:Setup", "run:Guardian", "restore" }) {
            var f = new Fixture();
            f.Deployment.OnStep = step => { if (step == point) f.CurrentTime = f.Session.Plan.ExpiresUtc; };
            Reject(() => f.Run(), "CONTROL_PLAN_REFUSED");
            Check(f.Deployment.Steps.Contains("borrow") == (point != "run:Setup"));
            Check(f.Deployment.Steps.Contains("restore") == (point == "restore"));
            Check(f.Deployment.Results.Count == 0);
        }

        // Canonical approval hash and the semantic effects/identity/pin bindings
        // are separate requirements; rehashing altered approval is insufficient.
        Func<ControlOwnerApproval, ControlOwnerApproval>[] corruptApproval = {
            a => a with { SchemaVersion = 2 }, a => a with { Scope = "OTHER" }, a => a with { AttemptId = new('b', 32) },
            a => a with { PlanSha256 = new('0', 64) }, a => a with { PackageSha256 = new('0', 64) },
            a => a with { OwnerSid = "S-1-5-21-1-2-3-1002" }, a => a with { IssuedUtc = a.IssuedUtc.AddTicks(1) },
            a => a with { ExpiresUtc = a.ExpiresUtc.AddTicks(1) }, a => a with { IssuedUtc = a.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) },
            a => a with { ExpiresUtc = a.ExpiresUtc.ToOffset(TimeSpan.FromHours(1)) }, a => a with { Effects = null! },
            a => a with { Effects = Array.Empty<string>() }, a => a with { Effects = a.Effects.Reverse().ToArray() },
            a => a with { Effects = a.Effects.Append("Additional permission").ToArray() },
            a => a with { Effects = a.Effects.Select((e, i) => i == 0 ? e + " " : e).ToArray() },
            a => a with { Guardian = a.Guardian with { Account = "LocalSystem" } }, a => a with { Guardian = null! }
        };
        foreach (var corrupt in corruptApproval) {
            var f = new Fixture(); var bad = corrupt(f.Approval);
            Reject(() => ControlController.ValidateApproval(bad, f.Session, Now));
            var repinned = WithApprovalPin(f.Session, ControlRules.Hash(ControlRules.Serialize(bad)));
            Reject(() => ControlController.ValidateApproval(bad, repinned, Now));
        }
        Reject(() => ControlController.ValidateApproval(null!, good.Session, Now));
        Reject(() => ControlController.ValidateApproval(good.Approval, WithApprovalPin(good.Session, new('0', 64)), Now), "CONTROL_OWNER_APPROVAL_REFUSED");
        foreach (var bad in new[] {
            good.Session with { Pins = good.Session.Pins with { PlanSha256 = new('0', 64) } },
            good.Session with { Pins = good.Session.Pins with { PackageSha256 = new('0', 64) } },
            good.Session with { Reservation = good.Session.Reservation with { AttemptId = new('b', 32) } },
            good.Session with { Reservation = good.Session.Reservation with { ApprovalSha256 = new('0', 64) } },
            good.Session with { Reservation = good.Session.Reservation with { ReservedUtc = Now.AddTicks(1) } }
        }) Reject(() => ControlController.ValidateApproval(good.Approval, bad, Now));
        foreach (var invalid in drift.Take(drift.Length - 1))
            Reject(() => ControlController.RequireOriginal(invalid(good.Approval.Guardian)), "CONTROL_ORIGINAL_GUARDIAN_REFUSED");
        Reject(() => ControlController.RequireOriginal(good.Approval.Guardian with { OtherConfigurationSha256 = "bad" }));
        Reject(() => ControlController.RequireOriginal(null!));

        // Manifest, file set, bytes and plan pins must all agree before any
        // deployment callback. Runtime .version is permitted in runtime only.
        foreach (string name in good.Bundle.PackageFiles.Keys) {
            var changed = CopyFiles(good.Bundle);
            changed[name] = changed[name].Select((b, i) => i == 0 ? (byte)(b ^ 1) : b).ToArray();
            Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = changed }), "CONTROL_DEPLOYMENT_FILE_PIN_REFUSED");
            changed = CopyFiles(good.Bundle); changed[name] = changed[name][..^1];
            Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = changed }), "CONTROL_DEPLOYMENT_FILE_PIN_REFUSED");
            changed = CopyFiles(good.Bundle); changed.Remove(name);
            Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = changed }), "CONTROL_DEPLOYMENT_EXTRA_FILE_REFUSED");
            changed = CopyFiles(good.Bundle); changed[name] = null!;
            Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = changed }), "CONTROL_DEPLOYMENT_FILE_PIN_REFUSED");
        }
        var extra = CopyFiles(good.Bundle); extra.Add("extra.dll", new byte[] { 1 });
        Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = extra }), "CONTROL_DEPLOYMENT_EXTRA_FILE_REFUSED");
        var recased = CopyFiles(good.Bundle); recased.Add("exportpolicycontrol.exe", recased["ExportPolicyControl.exe"]); recased.Remove("ExportPolicyControl.exe");
        Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = recased }), "CONTROL_DEPLOYMENT_FILE_PIN_REFUSED");
        Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageManifest = good.Bundle.PackageManifest.Append((byte)' ').ToArray() }), "CONTROL_DEPLOYMENT_MANIFEST_PIN_REFUSED");
        Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageManifest = Array.Empty<byte>() }));
        Reject(() => ControlController.ValidateBundle(good.Bundle with { PackageFiles = null! }));
        Reject(() => ControlController.ValidateBundle(good.Bundle with { Session = null! }));
        Reject(() => ControlController.ValidateBundle(null!));
        foreach (ControlPlan plan in new[] {
            good.Session.Plan with { AssemblySha256 = new('0', 64) }, good.Session.Plan with { RuntimeInventorySha256 = new('0', 64) }
        }) Reject(() => ControlController.ValidateBundle(good.Bundle with { Session = good.Session with { Plan = plan } }), "CONTROL_DEPLOYMENT_PLAN_PIN_REFUSED");
        var badBundle = new Fixture(); var retry = new ControlController();
        Reject(() => retry.Run(badBundle.Approval, badBundle.Bundle with { PackageFiles = extra }, badBundle.Deployment, badBundle.Verify, () => Now));
        Check(badBundle.Deployment.Steps.Count == 0 && badBundle.VerifyCalls == 0);
        Reject(() => badBundle.Run(retry), "CONTROL_CONTROLLER_ALREADY_ATTEMPTED");

        var runtime = Runtime();
        Check(runtime.Files.Any(f => f.Group == "runtime" && f.Name == ".version"));
        NativeControlAdmission.ValidateRuntime(runtime); cases++;
        foreach (var bad in new[] {
            runtime.Files[^1] with { Group = "fxr" }, runtime.Files[^1] with { Name = ".Version" },
            runtime.Files[^1] with { Name = ".version.bak" }, runtime.Files[^1] with { Name = ".." },
            runtime.Files[^1] with { Name = ".hidden" }, runtime.Files[^1] with { Name = ".version/child" },
            runtime.Files[^1] with { Name = ".version:stream" }
        }) {
            var f = new Fixture(runtime with { Files = runtime.Files[..^1].Append(bad).ToArray() });
            Reject(() => ControlController.ValidateBundle(f.Bundle), "CONTROL_RUNTIME_FILE_REFUSED");
            Reject(() => f.Run(), "CONTROL_RUNTIME_FILE_REFUSED");
            Check(f.Deployment.Steps.Count == 0 && f.VerifyCalls == 0);
        }

        // Exact owner/service grammars and route selection are pure. Native
        // entries below use valid-looking arguments only when the gate is shut.
        string[] owner = { "--control-controller", @"C:\Owner Review\plan.json", @"C:\Owner Review\approval.json",
            good.Session.Pins.PlanSha256, good.Session.Pins.ApprovalSha256, good.Session.Pins.PackageSha256, good.Session.Plan.OwnerSid };
        var parsed = ControlOwnerEntry.Parse(owner);
        Check(parsed.PlanPath == owner[1] && parsed.ApprovalPath == owner[2] && parsed.Pins == good.Session.Pins && parsed.ExpectedOwnerSid == owner[6]);
        Check(Program.ParseControlRoute(owner) == ControlEntryRoute.Controller);
        Reject(() => ControlOwnerEntry.Parse(null!));
        Reject(() => ControlOwnerEntry.Parse(Array.Empty<string>()));
        Reject(() => ControlOwnerEntry.Parse(owner[..^1]));
        Reject(() => ControlOwnerEntry.Parse(owner.Append("extra").ToArray()));
        for (int i = 0; i < owner.Length; i++) {
            var bad = (string[])owner.Clone(); bad[i] = null!;
            Reject(() => ControlOwnerEntry.Parse(bad));
            bad = (string[])owner.Clone(); bad[i] = " " + bad[i];
            Reject(() => ControlOwnerEntry.Parse(bad));
        }
        var samePaths = (string[])owner.Clone(); samePaths[2] = samePaths[1];
        Reject(() => ControlOwnerEntry.Parse(samePaths));
        foreach (string? path in new string?[] { null, "", @"C:\", @"c:\plan.json", "C:/plan.json", @"\\host\share\plan.json",
            @"C:\one\..\plan.json", @"C:\one\.\plan.json", @"C:\one\\plan.json", @"C:\one\", @"C:\one.\plan.json",
            @"C:\one \plan.json", @"C:\plan.json.", @"C:\plan.json ", @"C:\plan.json:stream", @"C:\*.json", @"C:\?.json",
            "C:\\a\".json", "C:\\a\t.json", "C:\\a\n.json", "C:\\a\0.json", "C:\\" + new string('a', 238) }) {
            Check(!ControlOwnerEntry.ValidInputPath(path));
            var bad = (string[])owner.Clone(); bad[1] = path!; Reject(() => ControlOwnerEntry.Parse(bad));
        }
        foreach (string path in new[] { @"C:\a", @"E:\Review Kit\plan-1.json", "Z:\\" + new string('a', 237) })
            Check(ControlOwnerEntry.ValidInputPath(path));
        foreach (string? sid in new string?[] { null, "", ControlRules.SystemSid, ControlRules.GuardianSid, "s-1-5-21-1-2-3-4",
            "S-1-5-21-1-2-3", "S-1-5-21-1-2-3-4-5", "S-1-5-21-01-2-3-4", "S-1-5-21-1-2-3-4294967296",
            "S-1-5-21-1-2-3-12345678901", "S-1-5-21-1-2-3-+1", "S-1-5-21-1-2-3--1", "S-1-5-21-1-2-3-4 ", "S-1-5-21-1-2-3-" })
            Check(!ControlOwnerEntry.ValidOwnerSid(sid));
        Check(ControlOwnerEntry.ValidOwnerSid("S-1-5-21-0-4294967295-3-4"));
        Check(ControlOwnerEntry.Confirmation(good.Session) == "CONFIRM EXPORT-POLICY-CONTROL " + good.Session.Plan.AttemptId + " " +
            good.Session.Pins.PlanSha256 + " " + good.Session.Pins.ApprovalSha256 + " " + good.Session.Pins.PackageSha256);
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            string[] args = { "--control-service", ControlRules.Role(role), "--plan-sha256", good.Session.Pins.PlanSha256,
                "--approval-sha256", good.Session.Pins.ApprovalSha256, "--package-sha256", good.Session.Pins.PackageSha256 };
            var service = ControlOwnerEntry.ParseService(args);
            Check(service.Role == role && service.Pins == good.Session.Pins);
            Check(Program.ParseControlRoute(args) == ControlEntryRoute.Service);
            Check(ControlController.ServiceCommand(role, good.Session.Pins) == "\"" + ControlRules.Root + "\\bin\\ExportPolicyControl.exe\" " + string.Join(" ", args));
            Reject(() => ControlOwnerEntry.ParseService(args[..^1]));
            Reject(() => ControlOwnerEntry.ParseService(args.Append("extra").ToArray()));
            for (int i = 0; i < args.Length; i++) {
                var bad = (string[])args.Clone(); bad[i] = null!; Reject(() => ControlOwnerEntry.ParseService(bad));
                bad = (string[])args.Clone(); bad[i] += " "; Reject(() => ControlOwnerEntry.ParseService(bad));
            }
            var lowercase = (string[])args.Clone(); lowercase[1] = lowercase[1].ToLowerInvariant();
            Reject(() => ControlOwnerEntry.ParseService(lowercase));
        }
        Reject(() => ControlOwnerEntry.ParseService(null!));
        Reject(() => ControlController.ServiceCommand((ControlRole)99, good.Session.Pins));
        Reject(() => ControlController.ServiceCommand(ControlRole.Setup, good.Session.Pins with { ApprovalSha256 = new('A', 64) }));
        Check(ControlOwnerEntry.PhysicalEnabled == ControlCapability.Enabled);
        string[] malformedOwner = owner[..^1];
        foreach (string[] args in new[] {
            ControlCapability.Enabled ? malformedOwner : owner,
            ControlCapability.Enabled ? malformedOwner : owner, Array.Empty<string>(), (string[])null! })
            Reject(() => ControlOwnerEntry.Dispatch(args), ControlCapability.Enabled ?
                "CONTROL_OWNER_ARGUMENTS_REFUSED" : "CONTROL_OWNER_ENTRY_CLOSED");
        foreach (string[] args in new[] {
            (string[])null!, Array.Empty<string>(), new[] { "--self-test" }, new[] { "--unknown" },
            new[] { "--control-controller" }, new[] { "--control-service" }, owner.Append("extra").ToArray(),
            new[] { "--control-service", "Setup", "--plan-sha256", "bad", "--approval-sha256", good.Session.Pins.ApprovalSha256,
                "--package-sha256", good.Session.Pins.PackageSha256 }
        }) Reject(() => Program.ParseControlRoute(args));
        Check(ControlCapability.Symbol == "TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5");
        Check(ControlOwnerEntry.PhysicalEnabled == NativeControlRuntime.PhysicalEnabled);

        // Native deployment public methods must invoke the supplied guard before
        // token, SCM or filesystem work. The callback always throws in this test.
        Reject(() => new NativeControlDeployment(null!));
        int guardCalls = 0;
        var guardFailure = new IOException(Canary);
        var guarded = new NativeControlDeployment(() => { guardCalls++; throw guardFailure; });
        Action[] refusedMethods = {
            () => guarded.ObserveGuardian(), () => guarded.RequireFreshSetup(), () => guarded.Deploy(good.Bundle),
            () => guarded.RegisterSetup(good.Session.Pins), () => guarded.Run(ControlRole.Setup, good.Session.Pins),
            () => guarded.Run(ControlRole.Guardian, good.Session.Pins),
            () => guarded.BorrowGuardian(good.Approval.Guardian, good.Session.Pins),
            () => guarded.RestoreGuardian(good.Approval.Guardian, good.Session.Pins),
            () => guarded.WriteControllerResult(ControlRules.Serialize(complete))
        };
        foreach (var method in refusedMethods) {
            int before = guardCalls;
            Check(ReferenceEquals(Reject(method), guardFailure));
            Check(guardCalls == before + 1);
        }
        NativeControlDeployment.RequireNoTriggers(0); cases++;
        Reject(() => NativeControlDeployment.RequireNoTriggers(1));
        Reject(() => NativeControlDeployment.RequireNoTriggers(uint.MaxValue));
        foreach (uint state in new uint[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, uint.MaxValue })
        foreach (uint pid in new uint[] { 0, 42 })
            Check(NativeControlDeployment.CanObserveProcess(state, pid) == (state == 4 && pid == 42));
        cases += ObservationTests();
        cases += RunDiagnosticTests();
        cases += InitialStatusTests();
        return cases;
    }

    private static int InitialStatusTests()
    {
        int cases = 0;
        void Check(bool value) { ControlRules.Need(value, "CONTROL_INITIAL_STATUS_TEST_FAILED"); cases++; }
        Exception Refused(Action action) {
            try { action(); }
            catch (Exception error) when (error is InvalidDataException or IOException) { cases++; return error; }
            throw new InvalidDataException("CONTROL_INITIAL_STATUS_REFUSAL_MISSING");
        }
        ControlServiceStatusObservation S(uint state, uint pid = 0) => new(state, pid, 0, 0);
        var pending = S(2, 10372); var running = S(4, 42);
        var sequences = new[] {
            new[] { running }, new[] { pending, running }, new[] { pending, S(2, 999), running },
            new[] { pending, S(1) }, new[] { pending, S(3, 42) }, new[] { pending, S(5, 42) },
            new[] { pending, S(6, 42) }, new[] { pending, S(7, 42) },
            new[] { S(4) }, new[] { S(1) }, new[] { S(3, 42) }, new[] { S(5, 42) },
            new[] { S(6, 42) }, new[] { S(7, 42) }
        };
        foreach (var sequence in sequences) {
            int queries = 0, waits = 0, sessions = 0; long elapsed = 0;
            var remembered = new List<ControlServiceStatusObservation>();
            var result = NativeControlDeployment.ObserveInitialStatus(sequence[0], () => sequence[++queries],
                remembered.Add, () => sessions++, () => elapsed, () => { waits++; elapsed += 25; });
            Check(result == sequence[^1]);
            Check(queries == sequence.Length - 1 && waits == queries && elapsed == 25 * waits);
            Check(remembered.SequenceEqual(sequence));
            Check(sessions == 2 * queries + 1);
        }
        var events = new List<string>();
        var observed = NativeControlDeployment.ObserveInitialStatus(pending,
            () => { events.Add("query"); return running; },
            status => events.Add("remember:" + status.State + ":" + status.ProcessId),
            () => events.Add("session"), () => 0, () => events.Add("wait"));
        Check(observed == running && events.SequenceEqual(new[] {
            "remember:2:10372", "session", "wait", "session", "query", "remember:4:42", "session" }));
        // Every malformed sample is rejected before it can enter the cache.
        foreach (var invalid in new[] { S(0), S(8), S(uint.MaxValue), null! }) {
            int queried = 0; var remembered = new List<ControlServiceStatusObservation>();
            Refused(() => NativeControlDeployment.ObserveInitialStatus(pending, () => { queried++; return invalid; },
                remembered.Add, () => { }, () => 0, () => { }));
            Check(queried == 1 && remembered.SequenceEqual(new[] { pending }));
        }
        // Expiry before any repeat read, after sleeping, or after a RUNNING read
        // always propagates the original refusal; no observation is returned.
        foreach (int failAt in new[] { 1, 2, 3 }) {
            int sessions = 0, queries = 0, waits = 0;
            var error = new InvalidDataException("INITIAL_SESSION_EXPIRED");
            var caught = Refused(() => NativeControlDeployment.ObserveInitialStatus(pending,
                () => { queries++; return running; }, _ => { },
                () => { if (++sessions == failAt) throw error; }, () => 0, () => waits++));
            Check(ReferenceEquals(caught, error) && sessions == failAt && queries == (failAt == 3 ? 1 : 0) && waits == (failAt > 1 ? 1 : 0));
        }
        foreach (long start in new[] { 45000L, 45001L, long.MaxValue }) {
            int queries = 0, waits = 0;
            var result = NativeControlDeployment.ObserveInitialStatus(pending, () => { queries++; return running; },
                _ => { }, () => { }, () => start, () => waits++);
            Check(result is null && queries == 0 && waits == 0);
        }
        long clock = 44990; int reads = 0;
        var timedOut = NativeControlDeployment.ObserveInitialStatus(pending, () => { reads++; return running; },
            _ => { }, () => { }, () => clock, () => clock += 25);
        Check(timedOut is null && reads == 0 && clock == 45015);
        clock = 0;
        timedOut = NativeControlDeployment.ObserveInitialStatus(pending, () => { clock = 45000; return running; },
            _ => { }, () => { }, () => clock, () => { });
        Check(timedOut is null);
        foreach (bool failRead in new[] { true, false }) {
            var error = new IOException(Canary);
            var caught = Refused(() => NativeControlDeployment.ObserveInitialStatus(pending,
                () => failRead ? throw error : running, _ => { }, () => { }, () => 0,
                () => { if (!failRead) throw error; }));
            Check(ReferenceEquals(caught, error));
        }
        return cases;
    }

    private static int ObservationTests()
    {
        int cases = 0;
        void Check(bool value) { ControlRules.Need(value, "CONTROL_TRANSPORT_TEST_FAILED"); cases++; }
        Exception Reject(Action action) {
            try { action(); }
            catch (Exception error) when (error is InvalidDataException or IOException) { cases++; return error; }
            throw new InvalidDataException("CONTROL_TRANSPORT_REFUSAL_MISSING");
        }
        ControlServiceTransportObservation? Transport(ControlControllerResult result, ControlRole role) =>
            role == ControlRole.Setup ? result.SetupTransport : result.GuardianTransport;
        uint code = ControlStartupDiagnostics.Encode(ControlStartupStage.IdentityOwnerRule, new InvalidDataException(Canary));
        uint unlisted = ControlStartupDiagnostics.Encode(ControlStartupStage.IdentityOwnerRule, new IOException(Canary, int.MinValue));
        int guardCalls = 0;
        var native = new NativeControlDeployment(() => { guardCalls++; throw new IOException(Canary); });
        Check(native.ReadLastServiceObservation(ControlRole.Setup) is null &&
            native.ReadLastServiceObservation(ControlRole.Guardian) is null && native.ReadLastServiceObservation((ControlRole)99) is null);
        Check(guardCalls == 0);

        // An absent/malformed worker report still refuses. The transport retains
        // known, unlisted or foreign status codes without granting them authority.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian })
        foreach (var exits in new (uint Win32, uint Specific)[] { (1066, code), (1066, unlisted), (1066, 0), (1066, uint.MaxValue), (1067, code) }) {
            var f = new Fixture();
            f.Deployment.SetRun(role, f.Deployment.GetRun(role) with { Report = Array.Empty<byte>(), Win32Exit = exits.Win32, ServiceExit = exits.Specific });
            f.Deployment.SetObservation(role, new(1, 0, exits.Win32, exits.Specific));
            Reject(() => f.Run());
            var result = f.Deployment.Results.Single(); var observation = Transport(result, role);
            Check(result.Outcome == "UNKNOWN" && !result.SecurityAccepted && !result.ProductionAccepted);
            Check(observation is not null && observation.State == 1 && observation.ProcessId == 0 &&
                observation.Win32Exit == exits.Win32 && observation.ServiceExit == exits.Specific && observation.EvidenceAuthority == "NONE");
            if (exits.Win32 == 1066 && exits.Specific == code)
                Check(observation!.StartupDiagnostic is { Stage: "IdentityOwnerRule", Category: "VALIDATION",
                    ManagedHResult: -2146233087, HResultListed: true, EvidenceAuthority: "NONE" });
            else if (exits.Win32 == 1066 && exits.Specific == unlisted)
                Check(observation!.StartupDiagnostic is { Stage: "IdentityOwnerRule", Category: "IO",
                    ManagedHResult: null, HResultListed: false, EvidenceAuthority: "NONE" });
            else Check(observation!.StartupDiagnostic is null);
            Check(f.Deployment.Steps.Contains("restore") == (role == ControlRole.Guardian) &&
                result.GuardianRestored == (role == ControlRole.Guardian));
            Check(!Encoding.UTF8.GetString(ControlRules.Serialize(result)).Contains(Canary, StringComparison.Ordinal));
        }

        // A stopped status, even with zero exits or a valid decoded diagnostic,
        // cannot replace a missing PID/handle or prove a live process has ended.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian })
        foreach (bool diagnostic in new[] { false, true })
        foreach (var process in new[] { (Pid: 0, Exited: true), (Pid: 0, Exited: false), (Pid: 42, Exited: false) }) {
            var f = new Fixture();
            f.Deployment.SetRun(role, f.Deployment.GetRun(role) with { ProcessId = process.Pid, ProcessExited = process.Exited });
            f.Deployment.SetObservation(role, new(1, 0, diagnostic ? 1066u : 0u, diagnostic ? code : 0u));
            Reject(() => f.Run());
            var result = f.Deployment.Results.Single();
            Check(!f.Deployment.Steps.Contains("restore") && !result.GuardianRestored && result.Outcome == "UNKNOWN");
            Check(result.GuardianBorrowAttempted == (role == ControlRole.Guardian) &&
                !result.SecurityAccepted && !result.ProductionAccepted);
            Check((Transport(result, role)?.StartupDiagnostic is not null) == diagnostic);
        }

        // Preserve an already observed status when Run throws before process
        // admission. Pending/running/inconsistent states never decode a failure.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian })
        foreach (var observed in new ControlServiceStatusObservation[] {
            new(1, 0, 1066, code), new(2, 0, 1066, code), new(4, 42, 1066, code),
            new(1, 42, 1066, code), new(0, 0, 1066, code), new(uint.MaxValue, 0, 1066, code)
        }) {
            var f = new Fixture(); f.Deployment.FailAt = "run:" + ControlRules.Role(role);
            f.Deployment.SetObservation(role, observed);
            Check(ReferenceEquals(Reject(() => f.Run()), f.Deployment.Failure));
            var result = f.Deployment.Results.Single(); var observation = Transport(result, role);
            Check(result.Phase == (role == ControlRole.Setup ? "run-setup" : "run-guardian") && result.Outcome == "UNKNOWN");
            Check(!f.Deployment.Steps.Contains("restore") && !result.GuardianRestored &&
                result.GuardianBorrowAttempted == (role == ControlRole.Guardian));
            Check((observation is not null) == (observed.State is >= 1 and <= 7));
            Check((observation?.StartupDiagnostic is not null) == (observed.State == 1 && observed.ProcessId == 0));
            Check(f.Deployment.ObservationReads == (role == ControlRole.Setup ? 1 : 2));
        }

        // Diagnostic access failure must neither hide the original run failure
        // nor suppress a still-authorized controller result. It cannot retry Run.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            var f = new Fixture();
            f.Deployment.FailAt = "run:" + ControlRules.Role(role); f.Deployment.FailObservationRead = true;
            Check(ReferenceEquals(Reject(() => f.Run()), f.Deployment.Failure));
            var result = f.Deployment.Results.Single();
            Check(result.SetupTransport is null && result.GuardianTransport is null && result.Outcome == "UNKNOWN");
            Check(!f.Deployment.Steps.Contains("restore") && f.Deployment.Steps.Count(s => s == f.Deployment.FailAt) == 1);
        }
        var noObservation = new Fixture(); noObservation.Deployment.FailObservationRead = true;
        var successful = noObservation.Run();
        Check(successful.Outcome == "POLICY_DIFFERENTIAL_OBSERVED" && successful.GuardianRestored &&
            successful.SetupTransport is null && successful.GuardianTransport is null);
        Check(noObservation.Deployment.Steps.SequenceEqual(HappySteps));
        return cases;
    }

    private static int RunDiagnosticTests()
    {
        int cases = 0;
        void Check(bool value, string label) {
            ControlRules.Need(value, "CONTROL_RUN_DIAGNOSTIC_TEST_FAILED:" + label); cases++;
        }
        Exception Reject(Action action) {
            try { action(); }
            catch (Exception error) when (error is InvalidDataException or IOException or JsonException or ArgumentException) {
                cases++; return error;
            }
            throw new InvalidDataException("CONTROL_RUN_DIAGNOSTIC_REFUSAL_MISSING");
        }
        ControlRunDiagnostic? Diagnostic(ControlControllerResult result, ControlRole role) =>
            role == ControlRole.Setup ? result.SetupRunDiagnostic : result.GuardianRunDiagnostic;
        void Private(ControlControllerResult result) {
            string json = Encoding.UTF8.GetString(ControlRules.Serialize(result));
            Check(!json.Contains(Canary, StringComparison.Ordinal) && !json.Contains("message", StringComparison.OrdinalIgnoreCase) &&
                !json.Contains("stack", StringComparison.OrdinalIgnoreCase) && !json.Contains("C:\\", StringComparison.Ordinal) &&
                !result.SecurityAccepted && !result.ProductionAccepted && result.Diagnostic.EvidenceAuthority == "NONE", "private-result");
        }

        // A short worker can be observed only while pending and after it stops.
        // This records the observation gap; it does not infer a process identity.
        var pending = new ControlServiceStatusObservation(2, 41, 0, 0);
        var stopped = new ControlServiceStatusObservation(1, 0, 0, 0);
        var missed = new ControlRunTrace();
        var initial = missed.Snapshot();
        Check(initial.Stage == "Admission" && initial.FirstStatus is null && initial.LastStatus is null &&
            initial.ReportReadStatus == "NOT_ATTEMPTED" && initial.Failure is null &&
            ControlRunDiagnostics.Sanitize(initial) == initial, "initial-trace");
        missed.At(ControlRunStage.InitialStatus); missed.Observe(pending);
        missed.At(ControlRunStage.StoppedProcess); missed.Observe(stopped);
        var secret = new ThrowingMessageException(unchecked((int)0x81234567));
        missed.Failed(secret); missed.At(ControlRunStage.Complete); missed.Failed(new IOException(Canary));
        var gap = missed.Snapshot();
        Check(gap.Stage == "StoppedProcess" && gap.FirstStatus == pending && gap.LastStatus == stopped &&
            !gap.RunningObserved && !gap.ProcessHandleOpened && gap.ProcessId == 0 && gap.ProcessStartedUtc is null &&
            !gap.ProcessIdentityValidated && gap.WaitResult is null && !gap.ProcessExitObserved, "pending-stopped-gap");
        Check(gap.Failure is { Kind: "OTHER", ManagedHResult: unchecked((int)0x81234567) } &&
            secret.MessageReads == 0 && ControlRunDiagnostics.Sanitize(gap) == gap, "first-failure-no-message");

        // A held, admitted process and an observed wait remain merely diagnostics.
        var trace = new ControlRunTrace(); trace.Observe(pending);
        trace.Observe(new(4, 41, 0, 0)); trace.At(ControlRunStage.ProcessOpen); trace.Opened();
        var opened = trace.Snapshot();
        Check(opened.ProcessHandleOpened && !opened.ProcessIdentityValidated && opened.ProcessId == 0 &&
            ControlRunDiagnostics.Sanitize(opened) == opened, "handle-before-identity");
        trace.AdmitProcess(41, Now.AddSeconds(-20)); trace.At(ControlRunStage.ProcessWait); trace.Waited(258);
        var waiting = trace.Snapshot();
        Check(waiting.WaitResult == 258 && !waiting.ProcessExitObserved &&
            ControlRunDiagnostics.Sanitize(waiting) == waiting, "wait-timeout-not-exit");
        trace.Waited(uint.MaxValue);
        Check(!trace.Snapshot().ProcessExitObserved && trace.Snapshot().WaitResult == uint.MaxValue, "failed-wait-not-exit");
        trace.Observe(stopped); trace.Waited(0); trace.At(ControlRunStage.ReportRead); trace.Read(321);
        trace.At(ControlRunStage.Complete); var completed = trace.Snapshot();
        Check(completed.FirstStatus == pending && completed.LastStatus == stopped && completed.RunningObserved &&
            completed.ProcessHandleOpened && completed.ProcessIdentityValidated && completed.ProcessId == 41 &&
            completed.ProcessStartedUtc == Now.AddSeconds(-20) && completed.WaitResult == 0 && completed.ProcessExitObserved &&
            completed.ReportReadStatus == "READ" && completed.ReportByteLength == 321 && completed.Failure is null &&
            completed.EvidenceAuthority == "NONE" && ControlRunDiagnostics.Sanitize(completed) == completed, "complete-observations");
        var empty = new ControlRunTrace(); empty.At(ControlRunStage.ReportRead); empty.Read(0);
        Check(empty.Snapshot().ReportReadStatus == "EMPTY" && ControlRunDiagnostics.Sanitize(empty.Snapshot()) is not null,
            "empty-not-absent");

        // The swallowed store-read refusal and a later run failure retain their
        // own category/HResult. Neither reads arbitrary exception text.
        var read = new ControlRunTrace(); read.At(ControlRunStage.ReportRead); read.ReadFailed(secret);
        read.ReadFailed(new IOException(Canary)); read.At(ControlRunStage.ReturnGuard);
        read.Failed(new UnauthorizedAccessException(Canary)); var refusedRead = read.Snapshot();
        Check(refusedRead.Stage == "ReturnGuard" && refusedRead.ReportReadStatus == "REFUSED" &&
            refusedRead.ReportReadFailure is { Kind: "OTHER", ManagedHResult: unchecked((int)0x81234567) } &&
            refusedRead.Failure?.Kind == "ACCESS" && refusedRead.ReportByteLength == 0 && secret.MessageReads == 0 &&
            ControlRunDiagnostics.Sanitize(refusedRead) == refusedRead, "independent-read-failure");
        Check(ControlRunDiagnostics.Name((ControlRunStage)int.MaxValue) == "Unknown" &&
            ControlRunDiagnostics.Name((ControlControllerStage)(-1)) == "Unknown", "unknown-stage-closed");

        // Reject metadata that could otherwise carry text or imply inconsistent
        // observations. No rejected cache value may change the happy-path calls.
        ControlRunDiagnostic[] malformed = {
            completed with { Stage = Canary }, completed with { Stage = "22" }, completed with { Stage = "complete" },
            completed with { Stage = " Complete" }, completed with { Stage = "Complete, Admission" },
            completed with { EvidenceAuthority = "ALLOWED" }, completed with { FirstStatus = new(0, 0, 0, 0) },
            completed with { LastStatus = new(8, 0, 0, 0) }, completed with { FirstStatus = null }, completed with { LastStatus = null },
            completed with { ProcessId = -1 }, completed with { ProcessStartedUtc = null },
            completed with { ProcessStartedUtc = default(DateTimeOffset) },
            completed with { ProcessStartedUtc = Now.ToOffset(TimeSpan.FromHours(1)) },
            completed with { ProcessIdentityValidated = false }, completed with { ProcessHandleOpened = false },
            completed with { WaitResult = 258 }, completed with { ReportReadStatus = Canary },
            completed with { ReportByteLength = -1 }, completed with { ReportByteLength = 2097153 },
            completed with { ReportReadStatus = "NOT_ATTEMPTED" }, completed with { ReportReadStatus = "EMPTY" },
            completed with { ReportReadStatus = "REFUSED", ReportByteLength = 0 },
            completed with { ReportReadFailure = new("IO", 1) }, completed with { Failure = new(Canary, 1) },
            refusedRead with { ReportReadFailure = new(Canary, 1) },
            initial with { WaitResult = 0 }, initial with { ProcessExitObserved = true }
        };
        foreach (var bad in malformed) {
            Check(ControlRunDiagnostics.Sanitize(bad) is null, "malformed-cache");
            var f = new Fixture(); f.Deployment.SetRunDiagnostic(ControlRole.Setup, bad);
            var result = f.Run();
            Check(result.SetupRunDiagnostic is null && result.Outcome == "POLICY_DIFFERENTIAL_OBSERVED" &&
                result.GuardianRestored && f.Deployment.Steps.SequenceEqual(HappySteps) && f.VerifyCalls == 8,
                "malformed-cache-no-authority");
            Private(result);
        }

        // Useful distinctions in the controller's unchanged acceptance pipeline.
        var stages = new (ControlRole Role, string Stage, bool Restored, Action<Fixture> Change)[] {
            (ControlRole.Setup, "SetupProcessProof", false, f => f.Deployment.Setup = f.Deployment.Setup with { ProcessId = 0 }),
            (ControlRole.Setup, "SetupProcessProof", false, f => f.Deployment.Setup = f.Deployment.Setup with { ProcessExited = false }),
            (ControlRole.Setup, "SetupReportParse", false, f => f.Deployment.Setup = f.Deployment.Setup with { Report = Array.Empty<byte>() }),
            (ControlRole.Setup, "SetupReportParse", false, f => f.Deployment.Setup = f.Deployment.Setup with { Report = Encoding.UTF8.GetBytes("{") }),
            (ControlRole.Setup, "SetupReportValidation", false, f => f.Deployment.SetReport(ControlRole.Setup, f.Report(ControlRole.Setup) with { Scope = Canary })),
            (ControlRole.Setup, "SetupProcessStart", false, f => f.Deployment.Setup = f.Deployment.Setup with { StartedUtc = f.Deployment.Setup.StartedUtc.AddTicks(1) }),
            (ControlRole.Setup, "SetupServiceExit", false, f => f.Deployment.Setup = f.Deployment.Setup with { ServiceExit = 1 }),
            (ControlRole.Setup, "SetupPredecessor", false, f => f.Deployment.SetReport(ControlRole.Setup, f.Report(ControlRole.Setup) with { Outcome = "UNKNOWN", Failure = new("IO", 1) })),
            (ControlRole.Guardian, "GuardianProcessProof", false, f => f.Deployment.Guardian = f.Deployment.Guardian with { ProcessExited = false }),
            (ControlRole.Guardian, "GuardianProcessProof", false, f => f.Deployment.Guardian = f.Deployment.Guardian with { ProcessId = 0 }),
            (ControlRole.Guardian, "GuardianReportProcessProof", true, f => f.Deployment.Guardian = f.Deployment.Guardian with { StartedUtc = Now.AddMinutes(-10) }),
            (ControlRole.Guardian, "GuardianReportParse", true, f => f.Deployment.Guardian = f.Deployment.Guardian with { Report = Array.Empty<byte>() }),
            (ControlRole.Guardian, "GuardianReportParse", true, f => f.Deployment.Guardian = f.Deployment.Guardian with { Report = Encoding.UTF8.GetBytes("null") }),
            (ControlRole.Guardian, "GuardianReportValidation", true, f => f.Deployment.SetReport(ControlRole.Guardian, f.Report(ControlRole.Guardian) with { Scope = Canary })),
            (ControlRole.Guardian, "GuardianProcessStart", true, f => f.Deployment.Guardian = f.Deployment.Guardian with { StartedUtc = f.Deployment.Guardian.StartedUtc.AddTicks(1) }),
            (ControlRole.Guardian, "GuardianServiceExit", true, f => f.Deployment.Guardian = f.Deployment.Guardian with { Win32Exit = 1067 })
        };
        foreach (var scenario in stages) {
            var f = new Fixture(); scenario.Change(f);
            // Deliberately claim successful observations even for missing proof.
            f.Deployment.SetRunDiagnostic(scenario.Role, completed);
            f.Deployment.SetObservation(scenario.Role, stopped);
            Reject(() => f.Run()); var result = f.Deployment.Results.Single();
            Check(result.Diagnostic.Stage == scenario.Stage && result.Diagnostic.EvidenceAuthority == "NONE", scenario.Stage);
            Check(result.Outcome == "UNKNOWN" && result.GuardianBorrowAttempted == (scenario.Role == ControlRole.Guardian) &&
                result.GuardianRestored == scenario.Restored && f.Deployment.Steps.Contains("restore") == scenario.Restored &&
                result.GuardianReportSha256 is null && (scenario.Role != ControlRole.Setup || result.SetupReportSha256 is null),
                "stage-retains-gates");
            Check(Diagnostic(result, scenario.Role) == completed && f.Deployment.RunDiagnosticReads ==
                (scenario.Role == ControlRole.Setup ? 1 : 2), "diagnostic-only-cache");
            Private(result);
        }

        // A store-read failure remains visible beside the later parse refusal;
        // Guardian restoration still depends only on the existing proven run.
        foreach (var refusal in new (Exception Error, string Kind)[] {
            (new IOException(Canary), "IO"), (new InvalidDataException(Canary), "VALIDATION"),
            (new UnauthorizedAccessException(Canary), "ACCESS")
        }) {
            var readTrace = new ControlRunTrace(); readTrace.At(ControlRunStage.ReportRead); readTrace.ReadFailed(refusal.Error);
            readTrace.At(ControlRunStage.Complete); var readDiagnostic = readTrace.Snapshot();
            Check(readDiagnostic.Failure is null && readDiagnostic.ReportReadFailure?.Kind == refusal.Kind &&
                readDiagnostic.ReportReadFailure.ManagedHResult == refusal.Error.HResult, "caught-read-refusal");
            foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
                var f = new Fixture(); f.Deployment.SetRun(role, f.Deployment.GetRun(role) with { Report = Array.Empty<byte>() });
                f.Deployment.SetRunDiagnostic(role, readDiagnostic);
                Reject(() => f.Run()); var result = f.Deployment.Results.Single();
                Check(result.Diagnostic.Stage == (role == ControlRole.Setup ? "SetupReportParse" : "GuardianReportParse") &&
                    Diagnostic(result, role)?.ReportReadFailure == readDiagnostic.ReportReadFailure &&
                    result.Failure?.Kind == "VALIDATION", "read-then-parse");
                Check(result.GuardianRestored == (role == ControlRole.Guardian) && result.Outcome == "UNKNOWN", "read-restore-gate");
                Private(result);
            }
        }

        // Cache errors cannot mask the original run failure, retry Run or grant
        // restoration. Failure publication itself can also refuse independently.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian })
        foreach (bool denyPublication in new[] { false, true }) {
            var f = new Fixture(); f.Deployment.FailAt = "run:" + ControlRules.Role(role);
            f.Deployment.FailRunDiagnosticRead = true;
            if (denyPublication) f.Deployment.OnStep = step => { if (step == "write") throw new InvalidDataException(Canary); };
            Check(ReferenceEquals(Reject(() => f.Run()), f.Deployment.Failure), "original-run-error");
            Check(!f.Deployment.Steps.Contains("restore") && f.Deployment.Steps.Count(s => s == f.Deployment.FailAt) == 1 &&
                f.Deployment.Steps.Count(s => s == "write") == 1, "no-retry-on-cache-error");
            if (denyPublication) Check(f.Deployment.Results.Count == 0, "publication-refused");
            else {
                var result = f.Deployment.Results.Single();
                Check(result.Diagnostic.Stage == (role == ControlRole.Setup ? "SetupRun" : "GuardianRun") &&
                    result.SetupRunDiagnostic is null && result.GuardianRunDiagnostic is null && result.Outcome == "UNKNOWN",
                    "run-cache-unavailable");
                Private(result);
            }
        }
        var unavailable = new Fixture(); unavailable.Deployment.FailRunDiagnosticRead = true;
        var success = unavailable.Run();
        Check(success.Diagnostic is { Stage: "Complete", EvidenceAuthority: "NONE" } && success.SetupRunDiagnostic is null &&
            success.GuardianRunDiagnostic is null && unavailable.Deployment.Steps.SequenceEqual(HappySteps) &&
            unavailable.VerifyCalls == 8, "success-without-telemetry");

        int guards = 0; var nativeFailure = new IOException(Canary);
        var native = new NativeControlDeployment(() => { guards++; throw nativeFailure; });
        Check(native.ReadLastRunDiagnostic(ControlRole.Setup) is null && native.ReadLastRunDiagnostic(ControlRole.Guardian) is null &&
            native.ReadLastRunDiagnostic((ControlRole)99) is null && guards == 0, "native-cache-is-memory-only");
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            int before = guards;
            Check(ReferenceEquals(Reject(() => native.Run(role, new Fixture().Session.Pins)), nativeFailure),
                "native-admission-original-error");
            Check(guards == before + 1, "native-admission-guard-once");
            var admission = native.ReadLastRunDiagnostic(role);
            Check(admission is { Stage: "Admission", EvidenceAuthority: "NONE", FirstStatus: null, LastStatus: null,
                RunningObserved: false, ProcessHandleOpened: false, ProcessId: 0, ProcessStartedUtc: null,
                ProcessIdentityValidated: false, WaitResult: null, ProcessExitObserved: false,
                ReportReadStatus: "NOT_ATTEMPTED", ReportByteLength: 0, ReportReadFailure: null } &&
                admission.Failure?.Kind == "IO" && admission.Failure.ManagedHResult == nativeFailure.HResult &&
                ControlRunDiagnostics.Sanitize(admission) == admission && guards == before + 1,
                "native-admission-cache-no-extra-guard");
        }

        // Closed serialized result and observation fields contain no exception
        // object, report body, path or implicit acceptance signal.
        var jsonFixture = new Fixture(); jsonFixture.Deployment.SetRunDiagnostic(ControlRole.Setup, completed);
        var jsonResult = jsonFixture.Run();
        using var jsonDocument = JsonDocument.Parse(ControlRules.Serialize(jsonResult));
        var root = jsonDocument.RootElement;
        Check(root.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal).SequenceEqual(new[] {
            "schemaVersion", "scope", "attemptId", "planSha256", "approvalSha256", "packageSha256", "phase", "outcome",
            "guardianBorrowAttempted", "guardianRestored", "setupReportSha256", "guardianReportSha256", "failure",
            "setupTransport", "guardianTransport", "diagnostic", "setupRunDiagnostic", "guardianRunDiagnostic",
            "securityAccepted", "productionAccepted"
        }.Order(StringComparer.Ordinal)), "closed-result-fields");
        Check(root.GetProperty("diagnostic").EnumerateObject().Select(p => p.Name).SequenceEqual(new[] { "stage", "evidenceAuthority" }),
            "closed-controller-diagnostic-fields");
        Check(root.GetProperty("setupRunDiagnostic").EnumerateObject().Select(p => p.Name).SequenceEqual(new[] {
            "stage", "firstStatus", "lastStatus", "runningObserved", "processHandleOpened", "processId", "processStartedUtc",
            "processIdentityValidated", "waitResult", "processExitObserved", "reportReadStatus", "reportByteLength",
            "reportReadFailure", "failure", "evidenceAuthority"
        }), "closed-run-diagnostic-fields");
        Check(root.GetProperty("setupRunDiagnostic").GetProperty("firstStatus").EnumerateObject().Select(p => p.Name)
            .SequenceEqual(new[] { "state", "processId", "win32Exit", "serviceExit" }), "closed-status-fields");
        Private(jsonResult);
        return cases;
    }

    private sealed class ThrowingMessageException : Exception
    {
        internal int MessageReads;
        internal ThrowingMessageException(int hresult) { HResult = hresult; }
        public override string Message { get { MessageReads++; throw new InvalidOperationException(Canary); } }
    }

    private static ControlSession WithApprovalPin(ControlSession session, string approvalHash) => session with {
        Pins = session.Pins with { ApprovalSha256 = approvalHash },
        Reservation = session.Reservation with { ApprovalSha256 = approvalHash }
    };

    private static Dictionary<string, byte[]> CopyFiles(ControlDeploymentBundle bundle) =>
        bundle.PackageFiles.ToDictionary(p => p.Key, p => p.Value, StringComparer.Ordinal);

    private static ControlRuntimeInventory Runtime() => new(1, "10.0.11", new[] {
        new ControlRuntimeFile("runtime", "System.Private.CoreLib.dll", 1, new('a', 64)),
        new ControlRuntimeFile("runtime", "coreclr.dll", 1, new('b', 64)),
        new ControlRuntimeFile("runtime", "hostpolicy.dll", 1, new('c', 64)),
        new ControlRuntimeFile("fxr", "hostfxr.dll", 1, new('d', 64)),
        new ControlRuntimeFile("runtime", ".version", 1, new('e', 64))
    });

    private sealed class Fixture
    {
        internal readonly ControlSession Session;
        internal readonly ControlOwnerApproval Approval;
        internal readonly ControlDeploymentBundle Bundle;
        internal readonly FakeDeployment Deployment;
        internal DateTimeOffset CurrentTime = Now;
        internal int VerifyCalls, FailVerifyAt, FailVerifyFrom;
        internal Action? OnVerify;
        internal readonly IOException VerifyFailure = new(Canary);

        internal Fixture(ControlRuntimeInventory? runtime = null)
        {
            var files = new Dictionary<string, byte[]>(StringComparer.Ordinal) {
                ["ExportPolicyControl.exe"] = Encoding.UTF8.GetBytes("synthetic-host-bytes"),
                ["ExportPolicyControl.dll"] = Encoding.UTF8.GetBytes("synthetic-assembly-bytes"),
                ["ExportPolicyControl.runtimeconfig.json"] = Encoding.UTF8.GetBytes("synthetic-runtime-config"),
                ["runtime-inventory.json"] = ControlRules.Serialize(runtime ?? Runtime())
            };
            var package = new ControlPackage(1, "TEST_ONLY_EXPORT_POLICY_PACKAGE_V5", files.Select(f =>
                new ControlPackageFile(f.Key, f.Value.Length, ControlRules.Hash(f.Value))).ToArray());
            byte[] manifest = ControlRules.Serialize(package);
            var plan = new ControlPlan(1, ControlRules.Scope, new('a', 32), "S-1-5-21-1-2-3-1001",
                ControlRules.Hash(files["ExportPolicyControl.dll"]), ControlRules.Hash(manifest),
                ControlRules.Hash(files["runtime-inventory.json"]), new('c', 64), new('d', 64), Now.AddMinutes(-5), Now.AddHours(1));
            string planHash = ControlRules.Hash(ControlRules.Serialize(plan));
            var original = new ControlServiceSnapshot(ControlRules.GuardianService, ControlController.OriginalBinary,
                "NT SERVICE\\" + ControlRules.GuardianService, 3, 16, 1, 1, 1, 0, new('e', 64));
            Approval = new(1, ControlController.ApprovalScope, plan.AttemptId, planHash, plan.PackageSha256,
                plan.OwnerSid, original, plan.IssuedUtc, plan.ExpiresUtc, ControlController.Effects.ToArray());
            var pins = new ControlPins(planHash, ControlRules.Hash(ControlRules.Serialize(Approval)), plan.PackageSha256);
            Session = new(plan, pins, new(1, ControlRules.Scope, plan.AttemptId, planHash, pins.ApprovalSha256,
                pins.PackageSha256, Now.AddMinutes(-1)));
            Bundle = new(Session, manifest, files);
            Deployment = new(original, RunFor(ControlRole.Setup), RunFor(ControlRole.Guardian));
        }

        internal ControlNativeReport Report(ControlRole role) => ControlRules.Parse<ControlNativeReport>(Deployment.GetRun(role).Report);

        private ControlServiceRun RunFor(ControlRole role)
        {
            bool setup = role == ControlRole.Setup;
            var token = setup
                ? new ControlTokenSnapshot(ControlRules.SystemSid, ControlRules.SystemSid, 1, 1,
                    NativeControlIdentity.DerivedServiceSid(ControlRole.Setup), 14, 1, false, true)
                : new(ControlRules.GuardianSid, ControlRules.GuardianSid, 1, 0, ControlRules.GuardianSid, 0, 0, false, true);
            var pairs = setup ? Array.Empty<PairObservation>() : new[] { "generic-private", "pkcs8-private", "opaque-transport" }
                .Select(format => new PairObservation(format, new("EXPORTED", null, null),
                    new("ERROR_OBSERVED", "CRYPTOGRAPHIC", MatchedExportProbe.Denied), "POLICY_DIFFERENTIAL_OBSERVED")).ToArray();
            int pid = setup ? 41 : 42;
            DateTimeOffset started = Now.AddSeconds(setup ? -20 : -10);
            var p = Session.Plan; var pins = Session.Pins;
            var report = new ControlNativeReport(1, NativeControlRuntime.ReportScope, ControlRules.Role(role), p.AttemptId,
                pins.PlanSha256, pins.ApprovalSha256, pins.PackageSha256, p.AssemblySha256, p.RuntimeInventorySha256,
                p.HostSha256, p.BootIdentity, token, pid, started, true, false,
                setup ? "SETUP_COMPLETE" : "POLICY_DIFFERENTIAL_OBSERVED", pairs, null, "NONE", false, false);
            return new(ControlRules.Serialize(report), pid, started, true, 0, 0);
        }

        internal void Verify()
        {
            VerifyCalls++;
            if (VerifyCalls == FailVerifyAt || (FailVerifyFrom != 0 && VerifyCalls >= FailVerifyFrom)) throw VerifyFailure;
            OnVerify?.Invoke();
        }

        internal ControlControllerResult Run(ControlController? controller = null) =>
            (controller ?? new ControlController()).Run(Approval, Bundle, Deployment, Verify, () => CurrentTime);
    }

    private sealed class FakeDeployment : IControlDeployment
    {
        internal readonly List<string> Steps = new();
        internal readonly List<ControlPins> Pins = new();
        internal readonly List<ControlControllerResult> Results = new();
        internal readonly IOException Failure = new(Canary);
        internal ControlServiceSnapshot Current;
        internal ControlServiceRun Setup, Guardian;
        internal ControlDeploymentBundle? Deployed;
        internal string? FailAt;
        internal bool FailAfterBorrow;
        internal bool FailObservationRead;
        internal int ObservationReads;
        private ControlServiceStatusObservation? setupObservation, guardianObservation;
        internal bool FailRunDiagnosticRead;
        internal int RunDiagnosticReads;
        private ControlRunDiagnostic? setupRunDiagnostic, guardianRunDiagnostic;
        internal Action<string>? OnStep;
        internal Func<int, ControlServiceSnapshot, ControlServiceSnapshot>? ChangeObservation;
        private int observations;

        internal FakeDeployment(ControlServiceSnapshot original, ControlServiceRun setup, ControlServiceRun guardian)
        { Current = original; Setup = setup; Guardian = guardian; }

        private void Step(string name)
        {
            Steps.Add(name); OnStep?.Invoke(name);
            if (FailAt == name) throw Failure;
        }
        internal ControlServiceRun GetRun(ControlRole role) => role == ControlRole.Setup ? Setup : Guardian;
        internal void SetRun(ControlRole role, ControlServiceRun run) { if (role == ControlRole.Setup) Setup = run; else Guardian = run; }
        internal void SetReport(ControlRole role, ControlNativeReport report) => SetRun(role, GetRun(role) with { Report = ControlRules.Serialize(report) });
        internal void SetObservation(ControlRole role, ControlServiceStatusObservation observation)
        { if (role == ControlRole.Setup) setupObservation = observation; else guardianObservation = observation; }
        internal void SetRunDiagnostic(ControlRole role, ControlRunDiagnostic diagnostic)
        { if (role == ControlRole.Setup) setupRunDiagnostic = diagnostic; else guardianRunDiagnostic = diagnostic; }
        public ControlRunDiagnostic? ReadLastRunDiagnostic(ControlRole role)
        {
            RunDiagnosticReads++;
            if (FailRunDiagnosticRead) throw new IOException(Canary);
            return role == ControlRole.Setup ? setupRunDiagnostic : guardianRunDiagnostic;
        }
        public ControlServiceStatusObservation? ReadLastServiceObservation(ControlRole role)
        {
            ObservationReads++;
            if (FailObservationRead) throw new IOException(Canary);
            return role == ControlRole.Setup ? setupObservation : guardianObservation;
        }
        public ControlServiceSnapshot ObserveGuardian()
        {
            observations++; Step("observe:" + observations);
            Current = ChangeObservation?.Invoke(observations, Current) ?? Current; return Current;
        }
        public void RequireFreshSetup() => Step("fresh");
        public void Deploy(ControlDeploymentBundle bundle) { Step("deploy"); Deployed = bundle; }
        public void RegisterSetup(ControlPins pins) { Step("register"); Pins.Add(pins); }
        public ControlServiceRun Run(ControlRole role, ControlPins pins) { Step("run:" + ControlRules.Role(role)); Pins.Add(pins); return GetRun(role); }
        public void BorrowGuardian(ControlServiceSnapshot original, ControlPins pins)
        {
            Step("borrow"); Pins.Add(pins);
            Current = original with { BinaryPath = ControlController.ServiceCommand(ControlRole.Guardian, pins) };
            if (FailAfterBorrow) throw Failure;
        }
        public void RestoreGuardian(ControlServiceSnapshot original, ControlPins pins)
        { Step("restore"); Pins.Add(pins); Current = original; }
        public void WriteControllerResult(byte[] bytes) { Step("write"); Results.Add(ControlRules.Parse<ControlControllerResult>(bytes)); }
    }
}
