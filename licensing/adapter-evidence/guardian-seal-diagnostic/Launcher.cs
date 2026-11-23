namespace EntryControl.TestOnly.Diagnostics;

// Testable controller protocol. The native entry remains compile-gated and
// requires reviewed pins plus live owner confirmation before any mutation.
internal sealed record ServiceSnapshot(string Name, string Account, string Path,
    string StartMode, string State, int Pid, bool RecoveryDisabled);
internal sealed record ServicePins(string ApprovalSha256, string PackageSha256);
internal interface ILauncherEnvironment
{
    string DiagnosticCommand { get; }
    void VerifyBindings();
    ServiceSnapshot Snapshot();
    void ReserveNewAttempt();
    void DeployNewProtectedDiagnostic();
    void Journal(string phase);
    void ChangePath(string path);
    void StartOnce();
    ServiceSnapshot ObserveUntilStopped();
    bool ValidateDiagnosticReport();
}
internal static class Launcher
{
    internal const string Service = "Ecs.Lic008.EntryEvidenceV2.Guardian";
    internal const string OriginalPath = "\"C:\\ProgramData\\Ecs.Lic008.EntryEvidenceV2\\bin\\EntryControl.AdapterPilot.exe\" --service Guardian";
    // A separate destination, never the retained V2 bin/work/report directories.
    private const string DiagnosticExecutable = "\"" + NativeDiagnostic.Root + "\\GuardianSealDiagnostic.exe\"";
    internal static void ValidatePins(ServicePins pins)
    {
        if (pins is null || !EntryControl.TestOnly.Runtime.Program.Hex(pins.ApprovalSha256,64) ||
            !EntryControl.TestOnly.Runtime.Program.Hex(pins.PackageSha256,64))
            throw new InvalidDataException("DIAGNOSTIC_SERVICE_PINS_REFUSED");
    }
    internal static string BuildDiagnosticCommand(ServicePins pins)
    {
        ValidatePins(pins);
        return DiagnosticExecutable + " --diagnostic-service --approval-sha256 " + pins.ApprovalSha256 +
            " --package-sha256 " + pins.PackageSha256;
    }
    internal static ServicePins ParseServiceArguments(string[] args)
    {
        if (args is null || args.Length != 5 || args[0] != "--diagnostic-service" ||
            args[1] != "--approval-sha256" || args[3] != "--package-sha256")
            throw new InvalidDataException("DIAGNOSTIC_SERVICE_ARGUMENTS_REFUSED");
        var pins = new ServicePins(args[2],args[4]); ValidatePins(pins); return pins;
    }
    internal static ServicePins ParseDiagnosticCommand(string command)
    {
        string prefix = DiagnosticExecutable + " ";
        if (command is null || !command.StartsWith(prefix,StringComparison.Ordinal))
            throw new InvalidDataException("DIAGNOSTIC_SERVICE_COMMAND_REFUSED");
        var pins = ParseServiceArguments(command[prefix.Length..].Split(' ',StringSplitOptions.None));
        if (BuildDiagnosticCommand(pins) != command)throw new InvalidDataException("DIAGNOSTIC_SERVICE_COMMAND_REFUSED");
        return pins;
    }
    internal static void RequirePins(ServicePins actual, ServicePins expected)
    {
        ValidatePins(actual); ValidatePins(expected);
        if (actual != expected)throw new InvalidDataException("DIAGNOSTIC_SERVICE_PINS_MISMATCH");
    }
    internal static void RequireStopped(ServiceSnapshot value, string path)
    {
        if (value.Name != Service || value.Account != "NT SERVICE\\" + Service || value.Path != path ||
            value.StartMode != "Manual" || value.State != "Stopped" || value.Pid != 0 || !value.RecoveryDisabled)
            throw new InvalidDataException("DIAGNOSTIC_SERVICE_CONTEXT_REFUSED");
    }
    // No catch/finally rollback: ambiguous/live state is retained for review.
    // A stopped worker with a bad report may be safely restored, but never accepted.
    internal static bool Run(ILauncherEnvironment environment)
    {
        string diagnosticCommand = environment.DiagnosticCommand;
        _ = ParseDiagnosticCommand(diagnosticCommand);
        environment.VerifyBindings();
        RequireStopped(environment.Snapshot(), OriginalPath);
        environment.ReserveNewAttempt(); // exclusive CREATE_NEW before any effect
        environment.DeployNewProtectedDiagnostic();
        environment.Journal("DEPLOYED");
        environment.VerifyBindings();
        RequireStopped(environment.Snapshot(), OriginalPath);
        environment.ChangePath(diagnosticCommand);
        RequireStopped(environment.Snapshot(), diagnosticCommand);
        environment.Journal("CONFIGURED");
        environment.StartOnce();
        RequireStopped(environment.ObserveUntilStopped(), diagnosticCommand);
        environment.Journal("WORKER_ENDED");
        // Recheck immediately before restore. Never overwrite an unrelated change.
        RequireStopped(environment.Snapshot(), diagnosticCommand);
        environment.ChangePath(OriginalPath);
        RequireStopped(environment.Snapshot(), OriginalPath);
        environment.Journal("RESTORED");
        return environment.ValidateDiagnosticReport();
    }

    private sealed class Fake : ILauncherEnvironment
    {
        internal readonly List<string> Calls = new();
        internal int FailAt = -1;
        internal bool Live, ReportValid = true, Reserved, DriftAfterObserve;
        public string DiagnosticCommand { get; set; } = BuildDiagnosticCommand(new(new('a',64),new('b',64)));
        internal ServiceSnapshot Current = new(Service, "NT SERVICE\\" + Service, OriginalPath, "Manual", "Stopped", 0, true);
        private void Call(string name) { Calls.Add(name); if (Calls.Count == FailAt) throw new IOException("INERT_FAILURE"); }
        public void VerifyBindings() => Call("pins");
        public ServiceSnapshot Snapshot() { Call("snapshot"); return Current; }
        public void ReserveNewAttempt() { Call("reserve"); if (Reserved) throw new InvalidDataException("ATTEMPT_EXISTS"); Reserved = true; }
        public void DeployNewProtectedDiagnostic() => Call("deploy");
        public void Journal(string phase) => Call("journal:" + phase);
        public void ChangePath(string path) { Call(path == OriginalPath ? "restore" : "configure"); Current = Current with { Path = path }; }
        public void StartOnce() => Call("start");
        public ServiceSnapshot ObserveUntilStopped() { Call("observe"); var result = Current; if (DriftAfterObserve) Current = Current with { Path = "foreign-change" }; return Live ? result with { State = "Running", Pid = 123 } : result; }
        public bool ValidateDiagnosticReport() { Call("report"); return ReportValid; }
    }
    internal static int SelfTest()
    {
        int count = 0;
        void Check(bool value) { if (!value) throw new InvalidDataException("LAUNCHER_TEST_FAILED"); count++; }
        void Reject(Action action) { try { action(); } catch (Exception error) when (error is IOException or InvalidDataException) { count++; return; } throw new Exception("REFUSAL_MISSING"); }
        var happy = new Fake(); Check(Run(happy));
        Check(happy.Calls.SequenceEqual(new[] { "pins", "snapshot", "reserve", "deploy", "journal:DEPLOYED", "pins", "snapshot", "configure", "snapshot", "journal:CONFIGURED", "start", "observe", "journal:WORKER_ENDED", "snapshot", "restore", "snapshot", "journal:RESTORED", "report" }));
        for (int i = 1; i <= happy.Calls.Count; i++) {
            var failed = new Fake { FailAt = i };
            Reject(() => Run(failed));
            Check(failed.Calls.SequenceEqual(happy.Calls.Take(i)));
        }
        var live = new Fake { Live = true }; Reject(() => Run(live));
        Check(!live.Calls.Contains("restore") && !live.Calls.Contains("report"));
        var badReport = new Fake { ReportValid = false }; Check(!Run(badReport)); Check(badReport.Current.Path == OriginalPath);
        happy.Calls.Clear(); Reject(() => Run(happy)); Check(happy.Calls.SequenceEqual(new[] { "pins", "snapshot", "reserve" }));
        var drift = new Fake { DriftAfterObserve = true }; Reject(() => Run(drift)); Check(!drift.Calls.Contains("restore"));
        var baseline = new Fake().Current;
        foreach (var changed in new[] { baseline with { Name = "other" }, baseline with { Account = "LocalSystem" },
            baseline with { Path = "other" }, baseline with { StartMode = "Auto" }, baseline with { State = "Running" },
            baseline with { Pid = 1 }, baseline with { RecoveryDisabled = false } }) {
            var bad = new Fake { Current = changed }; Reject(() => Run(bad)); Check(bad.Calls.Count == 2);
        }
        var pins = new ServicePins(new('a',64),new('b',64));
        var args = new[] {"--diagnostic-service","--approval-sha256",pins.ApprovalSha256,"--package-sha256",pins.PackageSha256};
        Check(ParseServiceArguments(args) == pins);
        Check(ParseDiagnosticCommand(BuildDiagnosticCommand(pins)) == pins);
        Check(BuildDiagnosticCommand(pins).StartsWith("\"C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV3\\GuardianSealDiagnostic.exe\" ",StringComparison.Ordinal));
        RequirePins(ParseServiceArguments(args),pins);count++;
        foreach (var invalid in new[] {Array.Empty<string>(),args[..4],args.Concat(new[]{"extra"}).ToArray(),
            new[]{"--diagnostic-service",pins.ApprovalSha256,pins.PackageSha256},
            new[]{"--diagnostic-service","--package-sha256",pins.ApprovalSha256,"--approval-sha256",pins.PackageSha256},
            new[]{"--diagnostic-service","--approval-sha256",pins.ApprovalSha256,"--approval-sha256",pins.PackageSha256}})
            Reject(()=>ParseServiceArguments(invalid));
        foreach (string invalid in new[]{"",new string('a',63),new string('a',65),new string('A',64),new string('g',64),
            "--approval-sha256","C:\\untrusted\\approval.json",pins.ApprovalSha256+"\"",pins.ApprovalSha256+" "}) {
            Reject(()=>BuildDiagnosticCommand(pins with{ApprovalSha256=invalid}));
            Reject(()=>BuildDiagnosticCommand(pins with{PackageSha256=invalid}));
            var invalidArgs=(string[])args.Clone();invalidArgs[2]=invalid;Reject(()=>ParseServiceArguments(invalidArgs));
            invalidArgs=(string[])args.Clone();invalidArgs[4]=invalid;Reject(()=>ParseServiceArguments(invalidArgs));
        }
        Reject(()=>RequirePins(pins with{ApprovalSha256=pins.PackageSha256,PackageSha256=pins.ApprovalSha256},pins));
        Reject(()=>RequirePins(pins with{ApprovalSha256=new('c',64)},pins));
        Reject(()=>RequirePins(pins with{PackageSha256=new('c',64)},pins));
        foreach (string invalid in new[]{BuildDiagnosticCommand(pins)+" extra",BuildDiagnosticCommand(pins)+" ",
            " "+BuildDiagnosticCommand(pins),BuildDiagnosticCommand(pins).Replace(" --approval-sha256 ","  --approval-sha256 "),
            BuildDiagnosticCommand(pins).Replace("GuardianSealDiagnostic.exe","Other.exe"),
            BuildDiagnosticCommand(pins).Replace(NativeDiagnostic.Root,"C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV1"),
            BuildDiagnosticCommand(pins).Replace(NativeDiagnostic.Root,"C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV2"),
            BuildDiagnosticCommand(pins).Replace(" --diagnostic-service "," --controller ")}) {
            Reject(()=>ParseDiagnosticCommand(invalid));
            var bad=new Fake{DiagnosticCommand=invalid};Reject(()=>Run(bad));Check(bad.Calls.Count==0);
        }
        return count;
    }
}
