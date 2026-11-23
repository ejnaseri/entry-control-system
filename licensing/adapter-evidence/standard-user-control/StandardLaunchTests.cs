using System;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardLaunchTests
{
    private sealed class OpaqueFailure : Exception
    {
        public override string Message => throw new InvalidOperationException("MESSAGE_MUST_NOT_BE_READ");
    }
    private sealed class Guard : IStandardLaunchGuard
    {
        internal string? FailAt;
        internal Action<string>? OnStage;
        internal int Calls;
        public void Verify(string stage)
        {
            Calls++; OnStage?.Invoke(stage);
            if (stage == FailAt) throw new OpaqueFailure();
        }
    }
    private sealed class Child : IStandardSuspendedProcess
    {
        public StandardLaunchPlan CreatingPlan { get; set; } = Plan();
        public uint ProcessId { get; set; } = 400;
        public uint ThreadId { get; set; } = 401;
        internal StandardProcessToken Observation = Good();
        internal Func<int, StandardProcessToken>? CaptureOverride;
        internal string? FailAt;
        internal uint Previous = 1, WaitValue = 258, Code;
        internal int Captures, Resumes, Waits, ExitReads, Releases;
        private void MaybeFail(string stage) { if (FailAt == stage) throw new OpaqueFailure(); }
        public StandardProcessToken Capture() { Captures++; MaybeFail("Capture" + Captures); return CaptureOverride?.Invoke(Captures) ?? Observation; }
        public uint ResumeOnce() { Resumes++; MaybeFail("Resume"); return Previous; }
        public uint Wait(uint milliseconds) { Waits++; MaybeFail("Wait" + Waits); return WaitValue; }
        public uint ExitCode() { ExitReads++; MaybeFail("Exit"); return Code; }
        public void ReleaseAfterObservedExit() { Releases++; MaybeFail("Release"); }
    }
    private static readonly DateTimeOffset Start = new(2026, 11, 2, 14, 0, 0, TimeSpan.Zero);
    private static readonly long Created = Start.UtcDateTime.ToFileTimeUtc();
    private static StandardLaunchPlan Plan() => new("0123456789abcdef0123456789abcdef", Start,
        Start.AddHours(2), StandardContract.UserSid, StandardContract.AccountOwnedSha256,
        StandardContract.AccountCompleteSha256);
    private static StandardProcessToken Good() => new(400, Created, StandardLaunchPlan.Image,
        new(StandardContract.UserSid, StandardContract.UserSid, 1, 0, 1,
            StandardContract.MediumIntegrity, false, false, true,
            new[] { new StandardGroup(StandardContract.Interactive, 7), new StandardGroup(StandardContract.Users, 7) }));

    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_LAUNCH_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) {
            try { work(); } catch (Exception error) when (error is InvalidDataException or OpaqueFailure or Win32Exception) { cases++; return; }
            throw new InvalidDataException("STANDARD_LAUNCH_EXPECTED_REFUSAL_MISSING_" + cases);
        }
        StandardLaunchSession Session(Child c, Guard? g = null, StandardLaunchPlan? p = null,
            Func<DateTimeOffset>? clock = null, long? low = null, long? high = null) =>
            new(c, p ?? Plan(), g ?? new(), clock ?? (() => Start), low ?? Created, high ?? Created);

        Plan().Validate(Start); Check(true); Plan().Validate(Start.AddHours(2).AddTicks(-1)); Check(true);
        foreach (string? attempt in new string?[] { null, "", "0", new('0', 31), new('0', 33),
            new('A', 32), new('g', 32), "0123456789abcdef0123456789abcde\n", "--run", new('\0', 32) }) {
            Reject(() => (Plan() with { Attempt = attempt! }).Validate(Start));
            Reject(() => (Plan() with { Attempt = attempt! }).CommandLine());
        }
        foreach (var bad in new[] {
            Plan() with { IssuedUtc = Start.AddTicks(1) },
            Plan() with { ExpiresUtc = Start }, Plan() with { ExpiresUtc = Start.AddTicks(-1) },
            Plan() with { ExpiresUtc = Start.AddHours(2).AddTicks(1) },
            Plan() with { IssuedUtc = Start.ToOffset(TimeSpan.FromHours(1)) },
            Plan() with { ExpiresUtc = Start.AddHours(2).ToOffset(TimeSpan.FromHours(1)) },
            Plan() with { AccountSid = StandardContract.OwnerSid }, Plan() with { AccountSid = StandardContract.UserSid + "\n" },
            Plan() with { AccountOwnedSha256 = StandardContract.AccountCompleteSha256 },
            Plan() with { AccountCompleteSha256 = StandardContract.AccountOwnedSha256 },
            Plan() with { AccountOwnedSha256 = StandardContract.AccountOwnedSha256.ToUpperInvariant() }
        }) Reject(() => bad.Validate(Start));
        Reject(() => Plan().Validate(Start.AddTicks(-1)));
        Reject(() => Plan().Validate(Start.AddHours(2)));
        Reject(() => Plan().Validate(Start.ToOffset(TimeSpan.FromHours(1))));
        string command = Plan().CommandLine();
        Check(command == "\"C:\\Program Files\\dotnet\\dotnet.exe\" exec --fx-version 10.0.11 \"" +
            StandardContract.Root + "\\bin\\StandardControl.dll\" --standard-user-worker --attempt " + Plan().Attempt);
        Check(command.Length < 1024 && !command.Contains("password", StringComparison.OrdinalIgnoreCase));
        byte[] env = StandardLaunchPlan.EnvironmentBlock();
        string environment = Encoding.Unicode.GetString(env);
        Check(env.Length % 2 == 0 && environment.EndsWith("\0\0", StringComparison.Ordinal) && !environment.EndsWith("\0\0\0", StringComparison.Ordinal));
        var entries = environment[..^2].Split('\0');
        Check(entries.Length == 9);
        string[] names = entries.Select(e => e[..e.IndexOf('=')]).ToArray();
        Check(names.Distinct(StringComparer.OrdinalIgnoreCase).Count() == 9);
        Check(names.SequenceEqual(names.OrderBy(n => n, StringComparer.OrdinalIgnoreCase)));
        Check(entries.Contains("TEMP=" + StandardLaunchPlan.Scratch) && entries.Contains("TMP=" + StandardLaunchPlan.Scratch));
        Check(!names.Any(n => n is "PATH" or "USERPROFILE" or "APPDATA" or "COMPLUS_ProfAPI_ProfilerCompatibilitySetting"));
        Check(!names.Any(n => n.StartsWith("CORECLR_", StringComparison.OrdinalIgnoreCase) || n.StartsWith("COR_", StringComparison.OrdinalIgnoreCase)));

        var happy = new Child(); var guard = new Guard(); var session = Session(happy, guard);
        session.AdmitAndResume();
        Check(session.State == "RUNNING_ADMITTED" && happy.Resumes == 1 && happy.Captures == 2 && guard.Calls == 3);
        Check(session.ResumePreviousCount == 1 && session.LastWaitResult == 258);
        Reject(session.AdmitAndResume); Check(happy.Resumes == 1);
        happy.WaitValue = 0;
        var completed = session.ObserveExit(30000);
        Check(completed is { ProcessId: 400, CreationFileTimeUtc: var created, ExitCode: 0,
            ExitObserved: true, TokenAdmitted: true, ResumeCountWasOne: true } && created == Created);
        Check(session.State == "EXIT_OBSERVED_HANDLES_RELEASED" && happy.Releases == 1 && happy.ExitReads == 1);
        Reject(() => session.ObserveExit(0)); Reject(session.AdmitAndResume); Check(happy.Resumes == 1);

        foreach (var bad in new[] {
            Good() with { ProcessId = 0 }, Good() with { ProcessId = 401 },
            Good() with { CreationFileTimeUtc = Created - 1 }, Good() with { CreationFileTimeUtc = Created + 1 },
            Good() with { ImagePath = "dotnet.exe" }, Good() with { ImagePath = StandardLaunchPlan.Image + "\n" },
            Good() with { Token = Good().Token with { User = StandardContract.OwnerSid } },
            Good() with { Token = Good().Token with { ElevationType = 3 } },
            Good() with { Token = Good().Token with { HasRestrictions = true } },
            Good() with { Token = Good().Token with { Groups = Good().Token.Groups!.Append(new(StandardContract.Administrators, 16)).ToArray() } }
        }) {
            foreach (int at in new[] { 1, 2 }) {
                var child = new Child { CaptureOverride = n => n == at ? bad : Good() }; var s = Session(child);
                Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0 && s.State == "UNRESOLVED_RETAIN_HANDLES");
                Reject(s.AdmitAndResume); Check(child.Resumes == 0);
                child.WaitValue = 0; var exit = s.ObserveExit(0);
                Check(exit is { ExitObserved: true, ResumeCountWasOne: false } && child.Releases == 1);
            }
        }
        foreach (var bounds in new[] { (0L, Created), (Created + 1, Created), (Created + 1, Created + 2), (Created - 2, Created - 1) }) {
            var child = new Child(); var s = Session(child, low: bounds.Item1, high: bounds.Item2);
            Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0);
        }
        foreach (var substitute in new[] {
            Plan() with { Attempt = new('a', 32) }, Plan() with { IssuedUtc = Start.AddMinutes(-1) },
            Plan() with { ExpiresUtc = Start.AddMinutes(5) }, Plan() with { AccountSid = StandardContract.OwnerSid },
            Plan() with { AccountOwnedSha256 = new('0', 64) }, Plan() with { AccountCompleteSha256 = new('1', 64) }
        }) {
            var child = new Child(); var s = Session(child, p: substitute);
            Reject(s.AdmitAndResume); Check(child.Captures == 0 && child.Resumes == 0 && child.Releases == 0);
        }
        foreach (bool badPid in new[] { false, true }) {
            var child = new Child { ProcessId = badPid ? 0u : 400u, ThreadId = badPid ? 401u : 0u }; var s = Session(child);
            Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0);
        }
        foreach (string stage in new[] { "BeforeSuspendedAdmission", "BeforeResume", "ImmediatelyBeforeResume" }) {
            var child = new Child(); var g = new Guard { FailAt = stage }; var s = Session(child, g);
            Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0 && s.FailureCategory == nameof(OpaqueFailure));
            Reject(s.AdmitAndResume); Check(child.Resumes == 0);
        }
        foreach (string stage in new[] { "Capture1", "Capture2", "Wait1", "Resume" }) {
            var child = new Child { FailAt = stage }; var s = Session(child);
            Reject(s.AdmitAndResume); Check(child.Resumes == (stage == "Resume" ? 1 : 0) && child.Releases == 0);
            Check(s.FailureCategory == nameof(OpaqueFailure)); Reject(s.AdmitAndResume);
        }
        foreach (uint previous in new uint[] { 0, 2, 3, uint.MaxValue }) {
            var child = new Child { Previous = previous }; var s = Session(child);
            Reject(s.AdmitAndResume); Check(s.ResumePreviousCount == previous && child.Resumes == 1 && child.Releases == 0);
            Reject(s.AdmitAndResume); Check(child.Resumes == 1);
        }
        foreach (uint initialWait in new uint[] { 0, 128, uint.MaxValue }) {
            var child = new Child { WaitValue = initialWait }; var s = Session(child);
            Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0);
        }
        foreach (int expiryAt in new[] { 1, 2, 3 }) {
            var child = new Child(); int calls = 0;
            var s = Session(child, clock: () => ++calls == expiryAt ? Start.AddHours(2) : Start);
            Reject(s.AdmitAndResume); Check(child.Resumes == 0 && child.Releases == 0);
        }
        var advancedTime = Start;
        var expiryGuard = new Guard { OnStage = stage => {
            if (stage == "ImmediatelyBeforeResume") advancedTime = Start.AddHours(2);
        } };
        var expiryChild = new Child(); var expirySession = Session(expiryChild, expiryGuard, clock: () => advancedTime);
        Reject(expirySession.AdmitAndResume); Check(expiryChild.Resumes == 0 && expiryChild.Releases == 0);
        foreach (uint wait in new uint[] { 258, 128, uint.MaxValue }) {
            var child = new Child(); var s = Session(child); s.AdmitAndResume(); child.WaitValue = wait;
            if (wait == 258) Check(s.ObserveExit(30000) is null); else Reject(() => s.ObserveExit(0));
            Check(child.ExitReads == 0 && child.Releases == 0 && s.State == "UNRESOLVED_RETAIN_HANDLES");
            Reject(s.AdmitAndResume); child.WaitValue = 0; child.Code = 7;
            Check(s.ObserveExit(0) is { ExitCode: 7, ExitObserved: true } && child.Resumes == 1 && child.Releases == 1);
        }
        foreach (string failure in new[] { "Wait2", "Exit", "Release" }) {
            var child = new Child { FailAt = failure }; var s = Session(child); s.AdmitAndResume(); child.WaitValue = 0;
            Reject(() => s.ObserveExit(0)); Check(s.State == "UNRESOLVED_RETAIN_HANDLES" && s.FailureCategory == nameof(OpaqueFailure));
            Reject(s.AdmitAndResume); Check(child.Resumes == 1);
        }
        var active = new Child(); var activeSession = Session(active); activeSession.AdmitAndResume();
        active.WaitValue = 0; active.Code = 259;
        Reject(() => activeSession.ObserveExit(0)); Check(active.Releases == 0 && activeSession.ObservedExitCode == 259);
        Reject(() => activeSession.ObserveExit(30001)); Check(active.Releases == 0);
        var changed = new Child { CaptureOverride = n => n == 1 ? Good() : Good() with {
            Token = Good().Token with { Groups = Good().Token.Groups!.Reverse().ToArray() } } };
        var changedSession = Session(changed); Reject(changedSession.AdmitAndResume); Check(changed.Resumes == 0);
        var parallel = new Child(); var parallelSession = Session(parallel);
        int refusals = 0;
        Parallel.For(0, 16, _ => { try { parallelSession.AdmitAndResume(); }
            catch (InvalidDataException) { System.Threading.Interlocked.Increment(ref refusals); } });
        Check(parallel.Resumes == 1 && refusals == 15 && parallel.Captures == 2);
        foreach (string stage in new[] { "BeforeSuspendedAdmission", "BeforeResume", "ImmediatelyBeforeResume" }) {
            var child = new Child(); var g = new Guard(); var s = Session(child, g);
            int refused = 0;
            g.OnStage = current => {
                if (current != stage) return;
                try { s.ObserveExit(0); } catch (InvalidDataException) { refused++; }
                try { s.AdmitAndResume(); } catch (InvalidDataException) { refused++; }
            };
            s.AdmitAndResume(); Check(refused == 2 && child.Resumes == 1 && child.Releases == 0 && s.State == "RUNNING_ADMITTED");
        }
        return cases;
    }
}
