using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;

namespace EntryControl.TestOnly.StandardUserControl;

// A component contract, NOT an approval or a physical entry point. The future
// controller must establish protected package/runtime/input custody and account
// ownership/membership/activation before supplying an IStandardLaunchGuard.
internal sealed record StandardLaunchPlan(string Attempt, DateTimeOffset IssuedUtc,
    DateTimeOffset ExpiresUtc, string AccountSid, string AccountOwnedSha256,
    string AccountCompleteSha256)
{
    internal const string Image = @"C:\Program Files\dotnet\dotnet.exe";
    internal const string Assembly = StandardContract.Root + @"\bin\StandardControl.dll";
    internal const string WorkingDirectory = StandardContract.Root + @"\bin";
    internal const string Scratch = StandardContract.Root + @"\user-scratch";

    internal static bool LowerHex(string? value, int size) => value is not null &&
        value.Length == size && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    internal void Validate(DateTimeOffset now)
    {
        StandardContract.Need(LowerHex(Attempt, 32), "STANDARD_LAUNCH_ATTEMPT_REFUSED");
        StandardContract.Need(IssuedUtc.Offset == TimeSpan.Zero && ExpiresUtc.Offset == TimeSpan.Zero &&
            now.Offset == TimeSpan.Zero && ExpiresUtc > IssuedUtc &&
            ExpiresUtc - IssuedUtc <= TimeSpan.FromHours(2) && now >= IssuedUtc && now < ExpiresUtc,
            "STANDARD_LAUNCH_TIME_REFUSED");
        StandardContract.Need(AccountSid == StandardContract.UserSid &&
            AccountOwnedSha256 == StandardContract.AccountOwnedSha256 &&
            AccountCompleteSha256 == StandardContract.AccountCompleteSha256,
            "STANDARD_LAUNCH_PARENT_ACCOUNT_REFUSED");
    }

    internal string CommandLine()
    {
        StandardContract.Need(LowerHex(Attempt, 32), "STANDARD_LAUNCH_ATTEMPT_REFUSED");
        string value = "\"" + Image + "\" exec --fx-version 10.0.11 \"" + Assembly +
            "\" --standard-user-worker --attempt " + Attempt;
        StandardContract.Need(value.Length < 1024 && !value.Contains('\0'), "STANDARD_LAUNCH_COMMAND_REFUSED");
        return value;
    }

    internal static byte[] EnvironmentBlock()
    {
        // Construct from fixed values; never copy caller/user environment or a
        // profile. No inherited profiler/startup hooks, PATH lookup or credentials.
        var entries = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
            ["DOTNET_CLI_HOME"] = Scratch,
            ["DOTNET_EnableDiagnostics"] = "0",
            ["DOTNET_MULTILEVEL_LOOKUP"] = "0",
            ["DOTNET_ROOT"] = @"C:\Program Files\dotnet",
            ["DOTNET_SKIP_FIRST_TIME_EXPERIENCE"] = "1",
            ["SystemRoot"] = @"C:\Windows",
            ["TEMP"] = Scratch,
            ["TMP"] = Scratch,
            ["windir"] = @"C:\Windows"
        };
        return Encoding.Unicode.GetBytes(string.Join('\0', entries.Select(e => e.Key + "=" + e.Value)) + "\0\0");
    }
}

internal interface IStandardLaunchGuard
{
    // Must throw on expired input or lost package/account/environment custody.
    void Verify(string stage);
}

internal interface IStandardSuspendedProcess
{
    StandardLaunchPlan CreatingPlan { get; }
    uint ProcessId { get; }
    uint ThreadId { get; }
    StandardProcessToken Capture();
    uint ResumeOnce();
    uint Wait(uint milliseconds);
    uint ExitCode();
    void ReleaseAfterObservedExit();
}

internal sealed record StandardLaunchExit(uint ProcessId, long CreationFileTimeUtc,
    uint ExitCode, bool ExitObserved, bool TokenAdmitted, bool ResumeCountWasOne);

// One resume attempt. Missing admission/exit proof cannot be repaired by a report,
// STOPPED/PID0, reopening a PID or retrying ResumeThread. Failed sessions retain
// their original handles; read-only exit observation remains possible afterward.
internal sealed class StandardLaunchSession
{
    private readonly object gate = new();
    private readonly IStandardSuspendedProcess child;
    private readonly StandardLaunchPlan plan;
    private readonly IStandardLaunchGuard guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly long earliestCreation, latestCreation;
    private StandardProcessToken? admitted;
    private bool resumeWasOne;
    internal string State { get; private set; } = "CREATED_SUSPENDED_UNADMITTED";
    internal string? FailureCategory { get; private set; }
    internal int? FailureHResult { get; private set; }
    internal int? FailureNativeErrorCode { get; private set; }
    internal uint? ResumePreviousCount { get; private set; }
    internal uint? LastWaitResult { get; private set; }
    internal uint? ObservedExitCode { get; private set; }

    internal StandardLaunchSession(IStandardSuspendedProcess child, StandardLaunchPlan plan,
        IStandardLaunchGuard guard, Func<DateTimeOffset> utcNow, long earliestCreation, long latestCreation)
    {
        this.child = child; this.plan = plan; this.guard = guard; this.utcNow = utcNow;
        this.earliestCreation = earliestCreation; this.latestCreation = latestCreation;
    }

    private void Fail(Exception error)
    {
        State = "UNRESOLVED_RETAIN_HANDLES";
        if (FailureCategory is null) {
            FailureCategory = error.GetType().Name; FailureHResult = error.HResult;
            FailureNativeErrorCode = error is Win32Exception native ? native.NativeErrorCode : null;
        }
    }

    private void VerifyObservation(StandardProcessToken value)
    {
        StandardContract.Need(child.ProcessId > 0 && child.ThreadId > 0 && value is not null &&
            value.ProcessId == child.ProcessId && earliestCreation > 0 && latestCreation >= earliestCreation &&
            value.CreationFileTimeUtc >= earliestCreation && value.CreationFileTimeUtc <= latestCreation &&
            string.Equals(value.ImagePath, StandardLaunchPlan.Image, StringComparison.OrdinalIgnoreCase),
            "STANDARD_SUSPENDED_PROCESS_BINDING_REFUSED");
        StandardIdentity.Admit(value.Token);
    }

    internal void AdmitAndResume() { lock (gate) AdmitAndResumeCore(); }

    private void AdmitAndResumeCore()
    {
        StandardContract.Need(State == "CREATED_SUSPENDED_UNADMITTED", "STANDARD_LAUNCH_RESUME_STATE_REFUSED");
        // Mark before any callback: re-entry or exceptions cannot permit a retry.
        State = "ADMISSION_IN_PROGRESS";
        try {
            StandardContract.Need(plan == child.CreatingPlan, "STANDARD_CREATING_PLAN_CHANGED");
            plan.Validate(utcNow()); guard.Verify("BeforeSuspendedAdmission");
            var first = child.Capture(); VerifyObservation(first);
            guard.Verify("BeforeResume"); plan.Validate(utcNow());
            var second = child.Capture(); VerifyObservation(second);
            StandardContract.Need(first.ProcessId == second.ProcessId &&
                first.CreationFileTimeUtc == second.CreationFileTimeUtc &&
                first.ImagePath == second.ImagePath && first.Token.User == second.Token.User &&
                first.Token.Owner == second.Token.Owner && first.Token.Groups!.SequenceEqual(second.Token.Groups!),
                "STANDARD_SUSPENDED_OBSERVATION_CHANGED");
            admitted = second;
            // VerifyObservation/Admit cover all remaining token class fields on
            // each read, rather than trusting an earlier worker self-report.
            LastWaitResult = child.Wait(0);
            StandardContract.Need(LastWaitResult == 258, "STANDARD_PRE_RESUME_PROCESS_NOT_WAITING");
            guard.Verify("ImmediatelyBeforeResume"); plan.Validate(utcNow());
            State = "RESUME_ISSUED_NO_RETRY";
            uint previous = child.ResumeOnce();
            ResumePreviousCount = previous;
            StandardContract.Need(previous == 1, "STANDARD_RESUME_PREVIOUS_COUNT_REFUSED");
            resumeWasOne = true; State = "RUNNING_ADMITTED";
        } catch (Exception error) { Fail(error); throw; }
    }

    internal StandardLaunchExit? ObserveExit(uint milliseconds) { lock (gate) return ObserveExitCore(milliseconds); }

    private StandardLaunchExit? ObserveExitCore(uint milliseconds)
    {
        StandardContract.Need(milliseconds <= 30000 && State is not
            ("EXIT_OBSERVED_HANDLES_RELEASED" or "ADMISSION_IN_PROGRESS" or "RESUME_ISSUED_NO_RETRY"),
            "STANDARD_EXIT_OBSERVATION_STATE_REFUSED");
        try {
            uint wait = child.Wait(milliseconds);
            LastWaitResult = wait;
            if (wait == 258) { State = "UNRESOLVED_RETAIN_HANDLES"; return null; }
            StandardContract.Need(wait == 0, "STANDARD_EXIT_WAIT_REFUSED");
            uint exit = child.ExitCode();
            ObservedExitCode = exit;
            // Conservatively refuse STILL_ACTIVE even after a signalled wait.
            StandardContract.Need(exit != 259, "STANDARD_EXIT_CODE_UNRESOLVED");
            var value = new StandardLaunchExit(child.ProcessId, admitted?.CreationFileTimeUtc ?? 0,
                exit, true, admitted is not null, resumeWasOne);
            child.ReleaseAfterObservedExit();
            State = "EXIT_OBSERVED_HANDLES_RELEASED";
            return value;
        } catch (Exception error) { Fail(error); throw; }
    }
}
