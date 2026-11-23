using System;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Closed, memory-only observations. None of these values is completion,
// restoration or report-acceptance authority, including a signaled wait result.
internal enum ControlRunStage {
    Unknown, Admission, InitialSnapshot, StartConfiguration, StartGuard, StartService,
    InitialStatus, ObservationGuard, ObservationSnapshot, ObservationConfiguration,
    ProcessId, ProcessOpen, ProcessImage, ProcessTime, ProcessStart, StoppedProcess,
    ProcessWait, FinalSnapshot, FinalConfiguration, CompletionGuard, ReportRead,
    ReturnGuard, Complete, Timeout
}
internal enum ControlControllerStage {
    Unknown, DeployGuard, Deploy, RegisterGuard, Register, SetupRunGuard, SetupRun,
    SetupProcessProof, SetupReportParse, SetupReportValidation, SetupProcessStart,
    SetupServiceExit, SetupPredecessor, BorrowGuard, BorrowObservation, Borrow,
    BorrowVerification, GuardianRunGuard, GuardianRun, GuardianProcessProof,
    RestoreGuard, RestoreObservation, Restore, RestoreVerification,
    GuardianReportProcessProof, GuardianReportParse, GuardianReportValidation,
    GuardianProcessStart, GuardianServiceExit, GuardianResultParse, CompleteGuard, Complete
}
internal sealed record ControlControllerDiagnostic(string Stage, string EvidenceAuthority);
internal sealed record ControlRunDiagnostic(string Stage,
    ControlServiceStatusObservation? FirstStatus, ControlServiceStatusObservation? LastStatus,
    bool RunningObserved, bool ProcessHandleOpened, int ProcessId, DateTimeOffset? ProcessStartedUtc,
    bool ProcessIdentityValidated, uint? WaitResult, bool ProcessExitObserved,
    string ReportReadStatus, int ReportByteLength, ControlWorkerFailure? ReportReadFailure,
    ControlWorkerFailure? Failure, string EvidenceAuthority);

internal static class ControlRunDiagnostics
{
    internal static string Name(ControlRunStage stage) => Enum.IsDefined(stage) ? stage.ToString() : "Unknown";
    internal static string Name(ControlControllerStage stage) => Enum.IsDefined(stage) ? stage.ToString() : "Unknown";
    private static bool Status(ControlServiceStatusObservation? status) => status is null || status.State is >= 1 and <= 7;
    private static bool Failure(ControlWorkerFailure? failure) => failure is null || failure.Kind is
        "WRAPPED_EXCEPTION" or "CRYPTOGRAPHIC" or "VALIDATION" or "ACCESS" or "IO" or "OTHER";

    // A backend may omit diagnostics or return malformed data. Drop those data;
    // never let a diagnostic read/validation failure change execution authority.
    internal static ControlRunDiagnostic? Sanitize(ControlRunDiagnostic? value)
    {
        if (value is null || !Enum.TryParse<ControlRunStage>(value.Stage, out var stage) ||
            Name(stage) != value.Stage || value.EvidenceAuthority != "NONE" ||
            !Status(value.FirstStatus) || !Status(value.LastStatus) ||
            (value.FirstStatus is null) != (value.LastStatus is null) ||
            value.ProcessId < 0 || value.ProcessStartedUtc is { } time &&
                (time == default || time.Offset != TimeSpan.Zero) ||
            (value.ProcessId == 0) != (value.ProcessStartedUtc is null) ||
            value.ProcessIdentityValidated != (value.ProcessId > 0) ||
            value.ProcessIdentityValidated && !value.ProcessHandleOpened ||
            value.ProcessExitObserved && (!value.ProcessIdentityValidated || value.WaitResult != 0) ||
            value.WaitResult is not null && !value.ProcessIdentityValidated ||
            !Failure(value.Failure) || !Failure(value.ReportReadFailure)) return null;
        bool report = value.ReportReadStatus switch {
            "NOT_ATTEMPTED" => value.ReportByteLength == 0 && value.ReportReadFailure is null,
            "READ" => value.ReportByteLength is > 0 and <= 2097152 && value.ReportReadFailure is null,
            "EMPTY" => value.ReportByteLength == 0 && value.ReportReadFailure is null,
            "REFUSED" => value.ReportByteLength == 0 && value.ReportReadFailure is not null,
            _ => false
        };
        return report ? value : null;
    }
}

internal sealed class ControlRunTrace
{
    private ControlRunStage stage = ControlRunStage.Admission;
    private ControlServiceStatusObservation? first, last;
    private bool running, opened, identity, exited;
    private int pid, length;
    private DateTimeOffset? started;
    private uint? wait;
    private string read = "NOT_ATTEMPTED";
    private ControlWorkerFailure? readFailure, failure;

    internal void At(ControlRunStage value) { if (failure is null) stage = value; }
    internal void Observe(ControlServiceStatusObservation value)
    { first ??= value; last = value; running |= value.State == 4 && value.ProcessId > 0; }
    internal void Opened() => opened = true;
    internal void AdmitProcess(int processId, DateTimeOffset processStarted)
    { pid = processId; started = processStarted; identity = true; }
    internal void Waited(uint result) { wait = result; exited |= result == 0; }
    internal void Read(int byteLength) { length = byteLength; read = byteLength == 0 ? "EMPTY" : "READ"; }
    internal void ReadFailed(Exception error)
    {
        read = "REFUSED"; length = 0;
        readFailure ??= new(ControlRules.FailureKind(error), error.HResult);
    }
    internal void Failed(Exception error)
    { failure ??= new(ControlRules.FailureKind(error), error.HResult); }
    internal ControlRunDiagnostic Snapshot() => new(ControlRunDiagnostics.Name(stage), first, last,
        running, opened, pid, started, identity, wait, exited, read, length, readFailure, failure, "NONE");
}
