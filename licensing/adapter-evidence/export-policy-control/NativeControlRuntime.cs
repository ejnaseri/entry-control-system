using System;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlWorkerFailure(string Kind, int ManagedHResult);
internal sealed record ControlNativeReport(int SchemaVersion, string Scope, string Role,
    string AttemptId, string PlanSha256, string ApprovalSha256, string PackageSha256,
    string AssemblySha256, string RuntimeInventorySha256, string HostSha256, string BootIdentity,
    ControlTokenSnapshot Token, int ProcessId, DateTimeOffset ProcessStartedUtc,
    bool WorkerEnded, bool DeadlineExceeded, string Outcome, PairObservation[] Pairs,
    ControlWorkerFailure? Failure, string RuntimeAuthority, bool SecurityAccepted, bool ProductionAccepted);

internal static class NativeControlRuntime
{
    // Shared purpose-specific compile capability; every native action still
    // requires the independently pinned admission and one-attempt controller.
    internal static bool PhysicalEnabled => ControlCapability.Enabled;
    internal const string ReportScope = "TEST_ONLY_EXPORT_POLICY_NATIVE_EVIDENCE_V5";

    internal static void Dispatch(ControlRole role, ControlPins pins)
    {
        ControlRules.Need(PhysicalEnabled, "EXPORT_POLICY_PHYSICAL_ENTRY_CLOSED");
        ControlRules.ValidatePins(pins); ControlRules.Role(role);
        NativeControlService.Dispatch(role, trace => Execute(role, pins, trace));
    }
    private static void Execute(ControlRole role, ControlPins pins, ControlStartupTrace trace)
    {
        var admission = NativeControlAdmission.Admit(role, pins, trace);
        if (role == ControlRole.Guardian)
            trace.At(ControlStartupStage.SetupPredecessor, () =>
                ValidateSetupPredecessor(admission.Store.Read("reports/setup.json"), admission.Session, DateTimeOffset.UtcNow));
        void VerifyOperation() {
            NativeControlWorker.RequireOperationBudget(); admission.Verify();
            NativeControlWorker.RequireOperationBudget();
        }
        void Guard(ControlRole expected) {
            ControlRules.Need(role == expected, "CONTROL_OPERATION_ROLE_REFUSED"); VerifyOperation();
        }
        var keys = new NativeControlKeys(() => Guard(ControlRole.Setup), () => Guard(ControlRole.Guardian));
        var lifecycle = new ControlLifecycle(admission.Session, admission.Store, keys, VerifyOperation, trace);
        ComparisonResult? result = null; ControlWorkerFailure? failure = null;
        try {
            result = trace.At(ControlStartupStage.WorkerExecution, () => NativeControlWorker.Run<ComparisonResult?>(() =>
                trace.At<ComparisonResult?>(ControlStartupStage.WorkerExecution, () => {
                    if (role == ControlRole.Setup) { lifecycle.Setup(); return null; }
                    return lifecycle.Guardian();
                })));
        }
        catch (Exception error) { failure = new(ControlRules.FailureKind(error), error.HResult); }
        // NativeWorker does not return while native work is live, including on
        // timeout. A late result is discarded and cannot become completion.
        trace.At(ControlStartupStage.WorkerCompletion, () => ControlRules.Need(NativeControlWorker.Ended, "CONTROL_WORKER_STILL_LIVE"));
        // Evidence publication does NOT extend an expired or changed authority.
        // If this final admission fails, no result report is published: retain
        // existing consumed/intent/owned records and treat the run as unresolved.
        // The future controller must not infer success from a missing report.
        trace.At(ControlStartupStage.ReportPublication, () => {
            admission.VerifyPackage();
            var session = admission.Session;
            var report = new ControlNativeReport(1, ReportScope, ControlRules.Role(role), session.Plan.AttemptId,
                pins.PlanSha256, pins.ApprovalSha256, pins.PackageSha256, session.Plan.AssemblySha256,
                session.Plan.RuntimeInventorySha256, session.Plan.HostSha256, session.Plan.BootIdentity,
                admission.Token, Environment.ProcessId, admission.StartedUtc, true, NativeControlWorker.DeadlineExceeded,
                failure is not null ? "UNKNOWN" : role == ControlRole.Setup ? "SETUP_COMPLETE" : result!.Outcome,
                result?.Pairs.ToArray() ?? Array.Empty<PairObservation>(), failure, "NONE", false, false);
            ValidateReport(report, role, session, DateTimeOffset.UtcNow, Environment.ProcessId);
            admission.Store.WriteNew(role == ControlRole.Setup ? "reports/setup.json" : "reports/guardian.json", ControlRules.Serialize(report));
            // SCM completion is a transport status, not security acceptance. Unknown
            // and boundary failures with still-valid admission retain evidence but
            // must not report service success.
            ControlRules.Need(report.Outcome is "SETUP_COMPLETE" or "POLICY_DIFFERENTIAL_OBSERVED" or "CONTROL_INCONCLUSIVE",
                "CONTROL_EXPERIMENT_UNKNOWN_RETAIN");
        });
    }
    internal static void ValidateSetupPredecessor(byte[] bytes, ControlSession session, DateTimeOffset now)
    {
        var report = ControlRules.Parse<ControlNativeReport>(bytes);
        ValidateReport(report, ControlRole.Setup, session, now);
        ControlRules.Need(report.Outcome == "SETUP_COMPLETE" && report.Failure is null,
            "CONTROL_SUCCESSFUL_SETUP_REPORT_REQUIRED");
    }
    internal static void ValidateReport(ControlNativeReport report, ControlRole role, ControlSession session,
        DateTimeOffset now, int expectedPid = 0)
    {
        ControlRules.ValidateSession(session, now);
        var p = session.Plan; var pins = session.Pins;
        ControlRules.Need(report is not null && report.SchemaVersion == 1 && report.Scope == ReportScope && report.Role == ControlRules.Role(role) &&
            report.AttemptId == p.AttemptId && report.PlanSha256 == pins.PlanSha256 && report.ApprovalSha256 == pins.ApprovalSha256 &&
            report.PackageSha256 == pins.PackageSha256 && report.AssemblySha256 == p.AssemblySha256 &&
            report.RuntimeInventorySha256 == p.RuntimeInventorySha256 && report.HostSha256 == p.HostSha256 && report.BootIdentity == p.BootIdentity &&
            report.ProcessId > 0 && expectedPid >= 0 && (expectedPid == 0 || expectedPid == report.ProcessId) &&
            report.ProcessStartedUtc.Offset == TimeSpan.Zero && report.ProcessStartedUtc >= session.Reservation.ReservedUtc &&
            report.ProcessStartedUtc <= now && report.WorkerEnded && report.RuntimeAuthority == "NONE" &&
            !report.SecurityAccepted && !report.ProductionAccepted && report.Pairs is { Length: <= 3 }, "CONTROL_NATIVE_REPORT_BINDING_REFUSED");
        NativeControlIdentity.Validate(role, report.Token);
        if (report.Failure is not null) {
            ControlRules.Need(report.Outcome == "UNKNOWN" && report.Pairs.Length == 0 &&
                report.Failure.Kind is "WRAPPED_EXCEPTION" or "CRYPTOGRAPHIC" or "VALIDATION" or "ACCESS" or "IO" or "OTHER",
                "CONTROL_NATIVE_REPORT_FAILURE_REFUSED"); return;
        }
        ControlRules.Need(!report.DeadlineExceeded, "CONTROL_LATE_SUCCESS_REFUSED");
        if (role == ControlRole.Setup) {
            ControlRules.Need(report.Outcome == "SETUP_COMPLETE" && report.Pairs.Length == 0, "CONTROL_SETUP_REPORT_REFUSED"); return;
        }
        ValidatePairs(report.Outcome, report.Pairs);
    }
    internal static void ValidatePairs(string outcome, PairObservation[] pairs)
    {
        string[] formats = { "generic-private", "pkcs8-private", "opaque-transport" };
        ControlRules.Need(pairs is { Length: > 0 and <= 3 }, "CONTROL_NATIVE_PAIRS_REFUSED");
        bool inconclusive = false;
        for (int i = 0; i < pairs.Length; i++) {
            var pair = pairs[i]; ControlRules.Need(pair is not null && pair.Format == formats[i], "CONTROL_NATIVE_PAIR_ORDER_REFUSED");
            var positive = pair.Exportable; var negative = pair.NonExportable;
            ControlRules.Need(positive is not null && negative is not null, "CONTROL_NATIVE_OBSERVATION_MISSING");
            ValidateObservation(positive, false); ValidateObservation(negative, true);
            if (positive.Status == "UNKNOWN") {
                ControlRules.Need(negative.Status == "NOT_RUN" && pair.Outcome == "UNKNOWN" && i == pairs.Length - 1 && outcome == "UNKNOWN",
                    "CONTROL_NATIVE_UNKNOWN_CONTROL_REFUSED"); return;
            }
            ControlRules.Need(negative.Status != "NOT_RUN", "CONTROL_NATIVE_NEGATIVE_MISSING");
            if (negative.Status is "UNKNOWN" or "BOUNDARY_FAILURE") {
                ControlRules.Need(pair.Outcome == negative.Status && outcome == negative.Status && i == pairs.Length - 1,
                    "CONTROL_NATIVE_TERMINAL_CONTINUATION_REFUSED"); return;
            }
            string expected = positive.Status == "EXPORTED" ? "POLICY_DIFFERENTIAL_OBSERVED" : "CONTROL_INCONCLUSIVE";
            ControlRules.Need(pair.Outcome == expected, "CONTROL_NATIVE_PAIR_OUTCOME_REFUSED");
            inconclusive |= expected == "CONTROL_INCONCLUSIVE";
        }
        ControlRules.Need(pairs.Length == 3 && outcome == (inconclusive ? "CONTROL_INCONCLUSIVE" : "POLICY_DIFFERENTIAL_OBSERVED"),
            "CONTROL_NATIVE_MATRIX_INCOMPLETE");
    }
    private static void ValidateObservation(ExportObservation observation, bool negative)
    {
        bool valid = observation.Status switch {
            "EXPORTED" => !negative && observation.FailureKind is null && observation.ManagedHResult is null,
            "NOT_RUN" => negative && observation.FailureKind is null && observation.ManagedHResult is null,
            "BOUNDARY_FAILURE" => negative && observation.FailureKind == "EXPORT_RETURNED" && observation.ManagedHResult is null,
            "ERROR_OBSERVED" => observation.FailureKind == "CRYPTOGRAPHIC" &&
                observation.ManagedHResult is MatchedExportProbe.Denied or MatchedExportProbe.Unsupported,
            "UNKNOWN" => (!negative && observation.FailureKind == "MALFORMED_EXPORT_OUTPUT" && observation.ManagedHResult is null) ||
                (observation.ManagedHResult is not null && (observation.FailureKind is "WRAPPED_EXCEPTION" or "UNEXPECTED_EXCEPTION" ||
                    (observation.FailureKind == "UNEXPECTED_CRYPTOGRAPHIC" && observation.ManagedHResult is not MatchedExportProbe.Denied and not MatchedExportProbe.Unsupported))),
            _ => false
        };
        ControlRules.Need(valid, "CONTROL_NATIVE_OBSERVATION_REFUSED");
    }
}
