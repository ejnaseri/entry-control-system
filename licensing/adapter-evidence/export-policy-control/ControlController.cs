using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlServiceSnapshot(string Name, string BinaryPath, string Account,
    uint StartType, uint ServiceType, uint ErrorControl, uint SidType, uint State, uint ProcessId,
    string OtherConfigurationSha256);
internal sealed record ControlServiceRun(byte[] Report, int ProcessId, DateTimeOffset StartedUtc,
    bool ProcessExited, uint Win32Exit, uint ServiceExit);
// Cached SCM status is transport metadata only. In particular, its PID is not
// a pinned process handle and STOPPED does not prove that a process has exited.
internal sealed record ControlServiceStatusObservation(uint State, uint ProcessId, uint Win32Exit, uint ServiceExit);
internal sealed record ControlServiceTransportObservation(uint State, uint ProcessId, uint Win32Exit, uint ServiceExit,
    ControlStartupDiagnostic? StartupDiagnostic, string EvidenceAuthority);
internal sealed record ControlDeploymentBundle(ControlSession Session, byte[] PackageManifest,
    IReadOnlyDictionary<string, byte[]> PackageFiles);
internal sealed record ControlOwnerApproval(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string PackageSha256, string OwnerSid, ControlServiceSnapshot Guardian,
    DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc, string[] Effects);
internal sealed record ControlControllerResult(int SchemaVersion, string Scope, string AttemptId,
    string PlanSha256, string ApprovalSha256, string PackageSha256, string Phase, string Outcome,
    bool GuardianBorrowAttempted, bool GuardianRestored, string? SetupReportSha256, string? GuardianReportSha256,
    ControlWorkerFailure? Failure, ControlServiceTransportObservation? SetupTransport,
    ControlServiceTransportObservation? GuardianTransport, ControlControllerDiagnostic Diagnostic,
    ControlRunDiagnostic? SetupRunDiagnostic, ControlRunDiagnostic? GuardianRunDiagnostic,
    bool SecurityAccepted, bool ProductionAccepted);

internal interface IControlDeployment
{
    ControlServiceSnapshot ObserveGuardian();
    void RequireFreshSetup();
    void Deploy(ControlDeploymentBundle bundle);
    void RegisterSetup(ControlPins pins);
    ControlServiceRun Run(ControlRole role, ControlPins pins);
    void BorrowGuardian(ControlServiceSnapshot original, ControlPins pins);
    void RestoreGuardian(ControlServiceSnapshot original, ControlPins pins);
    void WriteControllerResult(byte[] bytes);
    // Memory-only optional diagnostic seam. Never query SCM or invoke another
    // operation here, including after a failed Run or lost process observation.
    ControlServiceStatusObservation? ReadLastServiceObservation(ControlRole role) => null;
    ControlRunDiagnostic? ReadLastRunDiagnostic(ControlRole role) => null;
}

// This protocol has no retry or automatic rollback. Its native entry stays closed
// until exact source/package/owner-entry review. Tests supply only fake deployment.
internal sealed class ControlController
{
    internal const string OriginalBinary = "\"C:\\ProgramData\\Ecs.Lic008.EntryEvidenceV2\\bin\\EntryControl.AdapterPilot.exe\" --service Guardian";
    internal const string ApprovalScope = "TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V5";
    internal static readonly IReadOnlyList<string> Effects = Array.AsReadOnly(new[] {
        "Create isolated ExportPolicyControlV5 root, protected inputs and one-attempt reservation",
        "Register and start new LocalSystem ExportPolicyControlV5.Setup; create two new ExportPolicyControlV5.TEST_ONLY RSA keys",
        "Temporarily reconfigure and start existing EntryEvidenceV2 Guardian against only the new controls",
        "Restore original Guardian path only after independently confirmed service and process termination",
        "Retain test keys, Setup registration and evidence; no cleanup, retry, seal or retained-key change"
    });
    private int consumed;

    internal static string ServiceCommand(ControlRole role, ControlPins pins)
    {
        ControlRules.ValidatePins(pins);
        return "\"" + ControlRules.Root + "\\bin\\ExportPolicyControl.exe\" --control-service " + ControlRules.Role(role) +
            " --plan-sha256 " + pins.PlanSha256 + " --approval-sha256 " + pins.ApprovalSha256 +
            " --package-sha256 " + pins.PackageSha256;
    }

    internal static void RequireOriginal(ControlServiceSnapshot state)
    {
        ControlRules.Need(state is not null && state.Name == ControlRules.GuardianService &&
            state.BinaryPath == OriginalBinary && state.Account == "NT SERVICE\\" + ControlRules.GuardianService &&
            state.StartType == 3 && state.ServiceType == 16 && state.ErrorControl == 1 && state.SidType == 1 &&
            state.State == 1 && state.ProcessId == 0 && ControlRules.Hex(state.OtherConfigurationSha256, 64),
            "CONTROL_ORIGINAL_GUARDIAN_REFUSED");
    }
    internal static void RequireSameStopped(ControlServiceSnapshot actual, ControlServiceSnapshot original, string path)
    {
        RequireOriginal(original);
        ControlRules.Need(actual == original with { BinaryPath = path }, "CONTROL_GUARDIAN_CHANGED_RETAIN");
    }
    internal static void ValidateApproval(ControlOwnerApproval approval, ControlSession session, DateTimeOffset now)
    {
        ControlRules.ValidateSession(session, now);
        ControlRules.Need(approval is not null && approval.SchemaVersion == 1 && approval.Scope == ApprovalScope &&
            approval.AttemptId == session.Plan.AttemptId && approval.PlanSha256 == session.Pins.PlanSha256 &&
            approval.PackageSha256 == session.Pins.PackageSha256 && approval.OwnerSid == session.Plan.OwnerSid &&
            approval.IssuedUtc == session.Plan.IssuedUtc && approval.ExpiresUtc == session.Plan.ExpiresUtc &&
            approval.IssuedUtc.Offset == TimeSpan.Zero && approval.ExpiresUtc.Offset == TimeSpan.Zero &&
            approval.Effects is not null && approval.Effects.SequenceEqual(Effects) &&
            ControlRules.Hash(ControlRules.Serialize(approval)) == session.Pins.ApprovalSha256,
            "CONTROL_OWNER_APPROVAL_REFUSED");
        RequireOriginal(approval.Guardian);
    }
    internal static void ValidateBundle(ControlDeploymentBundle bundle)
    {
        ControlRules.Need(bundle is not null && bundle.Session is not null && bundle.PackageFiles is not null &&
            bundle.PackageManifest is { Length: > 0 }, "CONTROL_DEPLOYMENT_BUNDLE_REFUSED");
        ControlRules.ValidatePins(bundle.Session.Pins);
        ControlRules.Need(ControlRules.Hash(bundle.PackageManifest) == bundle.Session.Pins.PackageSha256,
            "CONTROL_DEPLOYMENT_MANIFEST_PIN_REFUSED");
        var package = ControlRules.Parse<ControlPackage>(bundle.PackageManifest);
        NativeControlAdmission.ValidatePackage(package);
        ControlRules.Need(bundle.PackageFiles.Count == package.Files.Length, "CONTROL_DEPLOYMENT_EXTRA_FILE_REFUSED");
        foreach (var file in package.Files) {
            ControlRules.Need(bundle.PackageFiles.TryGetValue(file.Name, out var bytes) && bytes is not null &&
                bytes.Length == file.Size && ControlRules.Hash(bytes) == file.Sha256, "CONTROL_DEPLOYMENT_FILE_PIN_REFUSED");
        }
        ControlRules.Need(package.Files.Single(f => f.Name == "ExportPolicyControl.dll").Sha256 == bundle.Session.Plan.AssemblySha256 &&
            package.Files.Single(f => f.Name == "runtime-inventory.json").Sha256 == bundle.Session.Plan.RuntimeInventorySha256,
            "CONTROL_DEPLOYMENT_PLAN_PIN_REFUSED");
        NativeControlAdmission.ValidateRuntime(ControlRules.Parse<ControlRuntimeInventory>(bundle.PackageFiles["runtime-inventory.json"]));
    }

    internal ControlControllerResult Run(ControlOwnerApproval approval, ControlDeploymentBundle bundle,
        IControlDeployment deployment, Action verifyOwnerAndCustody, Func<DateTimeOffset> clock)
    {
        ControlRules.Need(deployment is not null && verifyOwnerAndCustody is not null && clock is not null &&
            Interlocked.CompareExchange(ref consumed, 1, 0) == 0, "CONTROL_CONTROLLER_ALREADY_ATTEMPTED");
        ValidateBundle(bundle);
        var session = bundle.Session; var pins = session.Pins;
        void Verify() { ValidateApproval(approval, session, clock()); verifyOwnerAndCustody(); ValidateApproval(approval, session, clock()); }
        Verify(); RequireSameStopped(deployment.ObserveGuardian(), approval.Guardian, OriginalBinary);
        deployment.RequireFreshSetup();
        string phase = "deploy", outcome = "UNKNOWN";
        string? setupHash = null, guardianHash = null;
        ControlServiceTransportObservation? setupTransport = null, guardianTransport = null;
        ControlRunDiagnostic? setupDiagnostic = null, guardianDiagnostic = null;
        ControlControllerStage diagnosticStage = ControlControllerStage.DeployGuard;
        bool borrowed = false, restored = false, resultWriteAttempted = false;
        ControlServiceRun RunAndObserve(ControlRole role) {
            try { return deployment.Run(role, pins); }
            finally {
                // Capture even when Run refuses a missing PID or report. This
                // best-effort cache read cannot replace the original exception,
                // authorize restoration or change any completion requirement.
                try {
                    var observed = deployment.ReadLastServiceObservation(role);
                    if (observed is not null && observed.State is >= 1 and <= 7) {
                        var diagnostic = observed.State == 1 && observed.ProcessId == 0
                            ? ControlStartupDiagnostics.Decode(observed.Win32Exit, observed.ServiceExit) : null;
                        var transport = new ControlServiceTransportObservation(observed.State, observed.ProcessId,
                            observed.Win32Exit, observed.ServiceExit, diagnostic, "NONE");
                        if (role == ControlRole.Setup) setupTransport = transport;
                        else guardianTransport = transport;
                    }
                }
                catch { /* Diagnostic unavailability cannot change execution. */ }
                try {
                    var diagnostic = ControlRunDiagnostics.Sanitize(deployment.ReadLastRunDiagnostic(role));
                    if (role == ControlRole.Setup) setupDiagnostic = diagnostic;
                    else guardianDiagnostic = diagnostic;
                }
                catch { /* Cache only; preserve the original outcome/exception. */ }
            }
        }
        ControlControllerResult Result(ControlWorkerFailure? failure) => new(3, "TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3",
            session.Plan.AttemptId, pins.PlanSha256, pins.ApprovalSha256, pins.PackageSha256, phase, outcome,
            borrowed, restored, setupHash, guardianHash, failure, setupTransport, guardianTransport,
            new(ControlRunDiagnostics.Name(diagnosticStage), "NONE"), setupDiagnostic, guardianDiagnostic, false, false);
        try {
            Verify(); diagnosticStage = ControlControllerStage.Deploy;
            deployment.Deploy(bundle); // exclusive new root is the durable attempt consumption
            phase = "register-setup"; diagnosticStage = ControlControllerStage.RegisterGuard; Verify();
            diagnosticStage = ControlControllerStage.Register; deployment.RegisterSetup(pins);
            phase = "run-setup"; diagnosticStage = ControlControllerStage.SetupRunGuard; Verify();
            diagnosticStage = ControlControllerStage.SetupRun; var setup = RunAndObserve(ControlRole.Setup);
            VerifyRun(setup, ControlRole.Setup, session, clock(), stage => diagnosticStage = stage);
            diagnosticStage = ControlControllerStage.SetupPredecessor;
            NativeControlRuntime.ValidateSetupPredecessor(setup.Report, session, clock());
            setupHash = ControlRules.Hash(setup.Report);
            phase = "borrow-guardian"; diagnosticStage = ControlControllerStage.BorrowGuard; Verify();
            diagnosticStage = ControlControllerStage.BorrowObservation;
            RequireSameStopped(deployment.ObserveGuardian(), approval.Guardian, OriginalBinary);
            borrowed = true; // Intent precedes a possible partial native change.
            diagnosticStage = ControlControllerStage.Borrow; deployment.BorrowGuardian(approval.Guardian, pins);
            diagnosticStage = ControlControllerStage.BorrowVerification;
            RequireSameStopped(deployment.ObserveGuardian(), approval.Guardian, ServiceCommand(ControlRole.Guardian, pins));
            phase = "run-guardian"; diagnosticStage = ControlControllerStage.GuardianRunGuard; Verify();
            diagnosticStage = ControlControllerStage.GuardianRun; var guardian = RunAndObserve(ControlRole.Guardian);
            // Restoration requires independent process completion, not a report's
            // self-claimed workerEnded. Missing/untrusted report never grants this.
            diagnosticStage = ControlControllerStage.GuardianProcessProof;
            ControlRules.Need(guardian is not null && guardian.ProcessExited && guardian.ProcessId > 0,
                "CONTROL_GUARDIAN_PROCESS_UNRESOLVED_RETAIN");
            phase = "restore-guardian"; diagnosticStage = ControlControllerStage.RestoreGuard; Verify();
            diagnosticStage = ControlControllerStage.RestoreObservation;
            RequireSameStopped(deployment.ObserveGuardian(), approval.Guardian, ServiceCommand(ControlRole.Guardian, pins));
            diagnosticStage = ControlControllerStage.Restore; deployment.RestoreGuardian(approval.Guardian, pins);
            diagnosticStage = ControlControllerStage.RestoreVerification;
            RequireSameStopped(deployment.ObserveGuardian(), approval.Guardian, OriginalBinary); restored = true;
            phase = "validate-guardian-report";
            VerifyRun(guardian, ControlRole.Guardian, session, clock(), stage => diagnosticStage = stage);
            diagnosticStage = ControlControllerStage.GuardianResultParse;
            var report = ControlRules.Parse<ControlNativeReport>(guardian.Report);
            guardianHash = ControlRules.Hash(guardian.Report); outcome = report.Outcome;
            phase = "complete"; diagnosticStage = ControlControllerStage.CompleteGuard; Verify();
            diagnosticStage = ControlControllerStage.Complete; var result = Result(null);
            resultWriteAttempted = true;
            deployment.WriteControllerResult(ControlRules.Serialize(result)); return result;
        }
        catch (Exception error) {
            outcome = "UNKNOWN";
            // Native backend may write only inside the exact root it created in
            // this process. Publication can itself refuse after expiry/drift.
            try {
                if (!resultWriteAttempted) {
                    Verify(); resultWriteAttempted = true;
                    deployment.WriteControllerResult(ControlRules.Serialize(Result(new(ControlRules.FailureKind(error), error.HResult))));
                }
            }
            catch { }
            throw;
        }
    }
    private static void VerifyRun(ControlServiceRun run, ControlRole role, ControlSession session, DateTimeOffset now,
        Action<ControlControllerStage> mark)
    {
        bool setup = role == ControlRole.Setup;
        mark(setup ? ControlControllerStage.SetupProcessProof : ControlControllerStage.GuardianReportProcessProof);
        ControlRules.Need(run is not null && run.ProcessExited && run.ProcessId > 0 &&
            run.StartedUtc.Offset == TimeSpan.Zero && run.StartedUtc >= session.Reservation.ReservedUtc && run.StartedUtc <= now,
            "CONTROL_PROCESS_OBSERVATION_REFUSED");
        mark(setup ? ControlControllerStage.SetupReportParse : ControlControllerStage.GuardianReportParse);
        var report = ControlRules.Parse<ControlNativeReport>(run.Report);
        mark(setup ? ControlControllerStage.SetupReportValidation : ControlControllerStage.GuardianReportValidation);
        NativeControlRuntime.ValidateReport(report, role, session, now, run.ProcessId);
        mark(setup ? ControlControllerStage.SetupProcessStart : ControlControllerStage.GuardianProcessStart);
        ControlRules.Need(report.ProcessStartedUtc == run.StartedUtc, "CONTROL_PROCESS_REPORT_START_REFUSED");
        mark(setup ? ControlControllerStage.SetupServiceExit : ControlControllerStage.GuardianServiceExit);
        if (role == ControlRole.Setup || report.Outcome is "POLICY_DIFFERENTIAL_OBSERVED" or "CONTROL_INCONCLUSIVE")
            ControlRules.Need(run.Win32Exit == 0 && run.ServiceExit == 0, "CONTROL_SERVICE_COMPLETION_REFUSED");
        else ControlRules.Need(run.Win32Exit != 0, "CONTROL_UNKNOWN_SERVICE_SUCCESS_REFUSED");
    }
}
