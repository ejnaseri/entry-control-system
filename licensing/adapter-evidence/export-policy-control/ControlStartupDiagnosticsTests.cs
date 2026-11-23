using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Pure managed fixtures only. Wire expectations are deliberately independent of
// the codec's private tables. No token, SCM, registry, file or CNG operation runs.
internal static class ControlStartupDiagnosticsTests
{
    private const uint Prefix = 0xec100000, ServiceSpecificError = 1066;
    private const string Canary = "PRIVATE_DIAGNOSTIC_CANARY_C:\\secret\\key.bin";
    private static readonly string[] StageNames = {
        "ServiceArguments", "ServiceRunning", "ServiceIdentity", "RuntimeAdmission",
        "WorkerExecution", "WorkerCompletion", "ReportPublication", "IdentityRuntime",
        "IdentityImpersonation", "IdentityServiceSid", "IdentityOpenToken", "IdentityUser",
        "IdentityOwner", "IdentityType", "IdentityElevation", "IdentityRestriction",
        "IdentityGroups", "IdentityShape", "IdentityOwnerRule", "IdentityGroupRule",
        "AdmissionPins", "AdmissionPlanRead", "AdmissionPlanBinding", "AdmissionReservationRead",
        "AdmissionSession", "AdmissionProcess", "ContextSession", "ContextIdentity",
        "ContextBoot", "ContextHost", "EnvironmentProcess", "EnvironmentRegistry",
        "EnvironmentMachine", "EnvironmentService", "PackageRead", "PackageBinding",
        "PackagePaths", "PackageInventory", "PackageFiles", "PackagePlanBinding",
        "RuntimeInventory", "SetupPredecessor", "SetupConsumedWrite", "GuardianConsumedWrite"
    };
    private static readonly string[] CategoryNames = {
        "", "WRAPPED_EXCEPTION", "CRYPTOGRAPHIC", "VALIDATION", "ACCESS", "IO", "SECURITY", "OTHER"
    };
    private static readonly int?[] KnownHResults = {
        null, unchecked((int)0x80131501), unchecked((int)0x8013150a),
        unchecked((int)0x80070005), unchecked((int)0x80131620), unchecked((int)0x80131509),
        unchecked((int)0x80070057), unchecked((int)0x80070002), unchecked((int)0x80070003),
        unchecked((int)0x80131500), unchecked((int)0x80131505), unchecked((int)0x80131515),
        unchecked((int)0x80131622)
    };

    private sealed class HResultError : Exception
    {
        internal HResultError(int value, Exception? inner = null) : base(Canary, inner) { HResult = value; }
    }

    // Accessing any free-text/metadata surface fails immediately. The codec may
    // inspect only type, outer HRESULT and the presence of an inner exception.
    private sealed class PrivateError : Exception
    {
        internal int Reads;
        internal PrivateError(int value, Exception? inner = null) : base(Canary, inner) { HResult = value; }
        private T Refuse<T>() { Interlocked.Increment(ref Reads); throw new InvalidOperationException("CANARY_READ"); }
        public override string Message => Refuse<string>();
        public override string? StackTrace => Refuse<string?>();
        public override IDictionary Data => Refuse<IDictionary>();
        public override string ToString() => Refuse<string>();
    }

    private static uint Wire(int stage, int category, int index) =>
        Prefix | ((uint)stage << 12) | ((uint)category << 8) | (uint)index;

    internal static int Run()
    {
        int cases = 0;
        void Check(bool valid, string label)
        { ControlRules.Need(valid, "CONTROL_STARTUP_DIAGNOSTIC_TEST_FAILED:" + label); cases++; }
        void Refused<T>(Action action, string label) where T : Exception
        {
            bool refused = false;
            try { action(); } catch (T) { refused = true; }
            Check(refused, label);
        }
        bool Matches(ControlStartupDiagnostic? value, int stage, int category, int index) =>
            value is not null && value.Stage == StageNames[stage - 1] &&
            value.Category == CategoryNames[category] && value.ManagedHResult == KnownHResults[index] &&
            value.HResultListed == (index != 0) && value.EvidenceAuthority == "NONE";
        ControlStartupDiagnostic? Decoded(ControlStartupTrace trace) =>
            trace.FirstFailureCode is uint code ? ControlStartupDiagnostics.Decode(ServiceSpecificError, code) : null;

        Check(ControlStartupDiagnostics.ServiceSpecificError == ServiceSpecificError, "service-specific-status");
        Check(Enum.GetValues<ControlStartupStage>().Length == 44, "stage-count");
        for (int stage = 1; stage <= 44; stage++) {
            Check(Enum.IsDefined(typeof(ControlStartupStage), stage) &&
                ((ControlStartupStage)stage).ToString() == StageNames[stage - 1], "stable-stage-id");
            for (int index = 0; index <= 12; index++) {
                int hr = KnownHResults[index] ?? unchecked((int)0xa55a7301);
                uint code = ControlStartupDiagnostics.Encode((ControlStartupStage)stage, new HResultError(hr));
                Check(code == Wire(stage, 7, index), "exact-encode");
                Check(Matches(ControlStartupDiagnostics.Decode(ServiceSpecificError, code), stage, 7, index), "roundtrip");
            }
        }

        var categoryFixtures = new (Exception Error, int Category, int Index)[] {
            (new HResultError(unchecked((int)0x80131509), new PrivateError(1)), 1, 5),
            (new CryptographicException(unchecked((int)0x80070005)), 2, 3),
            (new InvalidDataException(Canary), 3, 1),
            (new UnauthorizedAccessException(Canary), 4, 3),
            (new IOException(Canary, unchecked((int)0x80131620)), 5, 4),
            (new SecurityException(Canary), 6, 2),
            (new InvalidOperationException(Canary), 7, 5),
            // An inner exception always selects WRAPPED_EXCEPTION, without
            // substituting the inner type or HRESULT for the outer failure.
            (new CryptographicException(Canary, new PrivateError(1)), 1, 1),
            (new InvalidDataException(Canary, new PrivateError(1)), 1, 1),
            (new IOException(Canary, new PrivateError(1)), 1, 4),
            (new SecurityException(Canary, new PrivateError(1)), 1, 2)
        };
        foreach (var fixture in categoryFixtures)
            for (int stage = 1; stage <= 44; stage++) {
                uint code = ControlStartupDiagnostics.Encode((ControlStartupStage)stage, fixture.Error);
                Check(code == Wire(stage, fixture.Category, fixture.Index) &&
                    Matches(ControlStartupDiagnostics.Decode(ServiceSpecificError, code), stage, fixture.Category, fixture.Index),
                    "category-and-outer-hresult-" + fixture.Error.GetType().Name + "-" + fixture.Category);
            }

        // Exhaust the entire 20-bit payload domain, including combinations of
        // several invalid fields. Count 256 stage partitions, not 1,048,576
        // individual values, in the public synthetic-case total.
        for (int stage = 0; stage < 256; stage++) {
            bool partitionMatches = true;
            for (int category = 0; category < 16; category++)
                for (int index = 0; index < 256; index++) {
                    var value = ControlStartupDiagnostics.Decode(ServiceSpecificError, Wire(stage, category, index));
                    bool valid = stage is >= 1 and <= 44 && category is >= 1 and <= 7 && index <= 12;
                    partitionMatches &= valid ? Matches(value, stage, category, index) : value is null;
                }
            Check(partitionMatches, "exhaustive-payload-partition");
        }
        for (uint marker = 0; marker < 4096; marker++) {
            uint code = (marker << 20) | 0x1301;
            Check((ControlStartupDiagnostics.Decode(ServiceSpecificError, code) is not null) == (marker == 0xec1),
                "marker-and-version");
        }
        // Every 16-bit Windows status is checked, plus high-bit/uint boundaries.
        for (uint block = 0; block < 64; block++) {
            bool statusesMatch = true;
            for (uint offset = 0; offset < 1024; offset++) {
                uint status = (block << 10) | offset;
                statusesMatch &= (ControlStartupDiagnostics.Decode(status, Wire(1, 3, 1)) is not null) ==
                    (status == ServiceSpecificError);
            }
            Check(statusesMatch, "win32-status-partition");
        }
        foreach (uint status in new uint[] { 65536, 65537, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff })
            Check(ControlStartupDiagnostics.Decode(status, Wire(44, 7, 12)) is null, "wide-win32-status");
        for (int bit = 0; bit < 32; bit++)
            Check(ControlStartupDiagnostics.Decode(ServiceSpecificError ^ (1u << bit), Wire(44, 7, 12)) is null,
                "single-bit-win32-status");

        var unknownHResults = new HashSet<int> { 0, 1, -1, int.MinValue, int.MaxValue,
            unchecked((int)0xa55a7301), unchecked((int)0x80090029), unchecked((int)0x00031501),
            unchecked((int)0x90131501), unchecked((int)0x80131502) };
        foreach (int? known in KnownHResults.Skip(1)) {
            unknownHResults.Add(unchecked(known!.Value - 1));
            unknownHResults.Add(unchecked(known.Value + 1));
        }
        foreach (int hr in unknownHResults.Where(hr => !KnownHResults.Contains(hr))) {
            uint code = ControlStartupDiagnostics.Encode(ControlStartupStage.SetupConsumedWrite, new HResultError(hr));
            Check(code == Wire(43, 7, 0) && Matches(ControlStartupDiagnostics.Decode(ServiceSpecificError, code), 43, 7, 0),
                "unknown-hresult-not-truncated");
        }

        var privateInner = new PrivateError(unchecked((int)0x80070005));
        var privateOuter = new PrivateError(unchecked((int)0x80131501), privateInner);
        uint privateCode = ControlStartupDiagnostics.Encode(ControlStartupStage.AdmissionPlanRead, privateOuter);
        Check(privateCode == Wire(22, 1, 1), "privacy-outer-code");
        string serialized = Encoding.UTF8.GetString(ControlRules.Serialize(ControlStartupDiagnostics.Decode(ServiceSpecificError, privateCode)));
        Check(serialized == "{\"stage\":\"AdmissionPlanRead\",\"category\":\"WRAPPED_EXCEPTION\",\"managedHResult\":-2146233087,\"hResultListed\":true,\"evidenceAuthority\":\"NONE\"}",
            "bounded-serialized-shape");
        Check(!serialized.Contains(Canary, StringComparison.Ordinal) && privateOuter.Reads == 0 && privateInner.Reads == 0,
            "private-surfaces-not-read");

        foreach (int stage in new[] { -1, int.MinValue, 0, 45, 255, 256, int.MaxValue }) {
            var trace = new ControlStartupTrace();
            bool called = false;
            Refused<InvalidDataException>(() => ControlStartupDiagnostics.Encode((ControlStartupStage)stage, privateOuter), "invalid-encode-stage");
            Refused<InvalidDataException>(() => trace.Record((ControlStartupStage)stage, privateOuter), "invalid-record-stage");
            Refused<InvalidDataException>(() => trace.At((ControlStartupStage)stage, () => { called = true; }), "invalid-action-stage");
            Refused<InvalidDataException>(() => trace.At((ControlStartupStage)stage, () => { called = true; return 1; }), "invalid-function-stage");
            Check(!called && trace.FirstFailureCode is null, "invalid-stage-no-execution-or-consumption");
        }
        var nullTrace = new ControlStartupTrace();
        Refused<ArgumentNullException>(() => ControlStartupDiagnostics.Encode(ControlStartupStage.ServiceArguments, null!), "null-error");
        Refused<ArgumentNullException>(() => nullTrace.Record(ControlStartupStage.ServiceArguments, null!), "null-record-error");
        Refused<ArgumentNullException>(() => nullTrace.At(ControlStartupStage.ServiceArguments, (Action)null!), "null-action");
        Refused<ArgumentNullException>(() => nullTrace.At(ControlStartupStage.ServiceArguments, (Func<int>)null!), "null-function");
        Check(nullTrace.FirstFailureCode is null, "null-input-no-consumption");

        var successful = new ControlStartupTrace();
        var expectedValue = new object();
        int calls = 0;
        successful.At(ControlStartupStage.ServiceRunning, () => { calls++; });
        object actualValue = successful.At(ControlStartupStage.ServiceIdentity, () => { calls++; return expectedValue; });
        Check(calls == 2 && ReferenceEquals(actualValue, expectedValue) && successful.FirstFailureCode is null, "success-not-consuming");
        Exception? caught = null;
        try {
            successful.At(ControlStartupStage.WorkerExecution, () =>
                successful.At(ControlStartupStage.PackageRead, (Action)(() => throw privateOuter)));
        }
        catch (Exception error) { caught = error; }
        Check(ReferenceEquals(caught, privateOuter), "nested-original-exception");
        Check(successful.FirstFailureCode == Wire(35, 1, 1), "nested-first-stage");
        successful.Record(ControlStartupStage.ReportPublication, new IOException(Canary));
        successful.At(ControlStartupStage.WorkerCompletion, () => { calls++; });
        Check(successful.FirstFailureCode == Wire(35, 1, 1) && calls == 3, "later-failure-and-success-preserve-first");

        var taskTrace = new ControlStartupTrace();
        var taskFailure = new PrivateError(unchecked((int)0x80070005));
        caught = null;
        try {
            taskTrace.At(ControlStartupStage.WorkerCompletion, () =>
                Task.Run(() => taskTrace.At(ControlStartupStage.IdentityOpenToken,
                    (Action)(() => throw taskFailure))).GetAwaiter().GetResult());
        }
        catch (Exception error) { caught = error; }
        Check(ReferenceEquals(caught, taskFailure) && taskTrace.FirstFailureCode == Wire(11, 7, 3), "task-preserves-inner-first-failure");
        Check(taskFailure.Reads == 0 && privateOuter.Reads == 0 && privateInner.Reads == 0, "trace-never-reads-private-surfaces");

        // Concurrent managed callers may race, but exactly one complete encoded
        // failure wins. Independent traces must never inherit that observation.
        var racingTrace = new ControlStartupTrace();
        var racers = Enumerable.Range(1, 44).Select(stage => Task.Run(() => {
            var failure = new HResultError(KnownHResults[stage % 12 + 1]!.Value);
            Exception? observed = null;
            try { racingTrace.At((ControlStartupStage)stage, (Action)(() => throw failure)); }
            catch (Exception error) { observed = error; }
            return ReferenceEquals(observed, failure);
        })).ToArray();
        Check(Task.WaitAll(racers, TimeSpan.FromSeconds(10)), "concurrent-managed-callers-complete");
        Check(racers.All(task => task.Result), "concurrent-original-exceptions");
        uint? winningCode = racingTrace.FirstFailureCode;
        Check(winningCode is uint winner && Enumerable.Range(1, 44).Any(stage => winner == Wire(stage, 7, stage % 12 + 1)),
            "atomic-complete-first-failure");
        for (int stage = 1; stage <= 44; stage++) racingTrace.Record((ControlStartupStage)stage, privateOuter);
        Check(racingTrace.FirstFailureCode == winningCode, "winner-not-replaced");
        var isolated = new ControlStartupTrace();
        Check(isolated.FirstFailureCode is null, "different-trace-empty");
        isolated.Record(ControlStartupStage.GuardianConsumedWrite, new HResultError(0));
        Check(isolated.FirstFailureCode == Wire(44, 7, 0) && racingTrace.FirstFailureCode == winningCode &&
            taskTrace.FirstFailureCode == Wire(11, 7, 3), "different-traces-isolated");

        int optionalCalls = 0;
        ControlStartupTrace.At(null, ControlStartupStage.ServiceRunning, () => { optionalCalls++; });
        Check(ControlStartupTrace.At(null, ControlStartupStage.ServiceRunning, () => { optionalCalls++; return 23; }) == 23 &&
            optionalCalls == 2, "optional-null-trace-success");
        caught = null;
        try { ControlStartupTrace.At(null, ControlStartupStage.ServiceRunning, (Action)(() => throw privateOuter)); }
        catch (Exception error) { caught = error; }
        Check(ReferenceEquals(caught, privateOuter) && privateOuter.Reads == 0, "optional-null-trace-preserves-exception");
        var optionalTrace = new ControlStartupTrace();
        caught = null;
        try { ControlStartupTrace.At(optionalTrace, ControlStartupStage.ServiceArguments, (Action)(() => throw privateOuter)); }
        catch (Exception error) { caught = error; }
        Check(ReferenceEquals(caught, privateOuter) && optionalTrace.FirstFailureCode == Wire(1, 1, 1), "optional-trace-action");
        var optionalFunctionTrace = new ControlStartupTrace();
        caught = null;
        try { ControlStartupTrace.At<int>(optionalFunctionTrace, ControlStartupStage.ContextHost, () => throw taskFailure); }
        catch (Exception error) { caught = error; }
        Check(ReferenceEquals(caught, taskFailure) && optionalFunctionTrace.FirstFailureCode == Wire(30, 7, 3), "optional-trace-function");

        // Exercise actual identity validation wiring using snapshots only. The
        // SID derivation is a managed hash, and Capture is never invoked here.
        var good = new ControlTokenSnapshot("S-1-5-18", "S-1-5-18", 1, 1,
            NativeControlIdentity.DerivedServiceSid(ControlRole.Setup), 4, 1, false, true);
        var goodTrace = new ControlStartupTrace();
        NativeControlIdentity.Validate(ControlRole.Setup, good, goodTrace);
        Check(goodTrace.FirstFailureCode is null, "identity-valid-no-diagnostic");
        foreach (var fixture in new (ControlTokenSnapshot? Token, int Stage)[] {
            (good with { Owner = "S-1-5-19" }, 19), (good with { User = "S-1-5-19" }, 19),
            (good with { Type = 2 }, 18), (good with { Attributes = 16 }, 20),
            (good with { QueryComplete = false }, 18), (good with { Restricted = true }, 18), (null, 18)
        }) {
            var identityTrace = new ControlStartupTrace();
            Refused<InvalidDataException>(() => NativeControlIdentity.Validate(ControlRole.Setup, fixture.Token, identityTrace),
                "identity-validation-refuses");
            Check(Matches(Decoded(identityTrace), fixture.Stage, 3, 1), "identity-actual-validation-stage");
        }

        // RunAttempt is the service's actual terminal sequencing seam. All
        // supplied callbacks here are managed fakes, with no native worker.
        var sequence = new List<string>();
        var failedAttemptTrace = new ControlStartupTrace();
        uint observedExit = uint.MaxValue, observedSpecificExit = uint.MaxValue;
        NativeControlService.RunAttempt(failedAttemptTrace,
            () => {
                sequence.Add("work");
                failedAttemptTrace.At(ControlStartupStage.IdentityOwnerRule, (Action)(() => throw privateOuter));
            },
            () => sequence.Add("join"),
            (exit, specificExit) => { sequence.Add("stopped"); observedExit = exit; observedSpecificExit = specificExit; });
        Check(sequence.SequenceEqual(new[] { "work", "join", "stopped" }), "failed-attempt-joins-before-stopped");
        Check(observedExit == ServiceSpecificError && observedSpecificExit == Wire(19, 1, 1) &&
            failedAttemptTrace.FirstFailureCode == observedSpecificExit, "failed-attempt-preserves-deep-stage");

        sequence.Clear();
        var cleanAttemptTrace = new ControlStartupTrace();
        NativeControlService.RunAttempt(cleanAttemptTrace,
            () => sequence.Add("work"), () => sequence.Add("join"),
            (exit, specificExit) => { sequence.Add("stopped"); observedExit = exit; observedSpecificExit = specificExit; });
        Check(sequence.SequenceEqual(new[] { "work", "join", "stopped" }) && observedExit == 0 &&
            observedSpecificExit == 0 && cleanAttemptTrace.FirstFailureCode is null, "successful-attempt-zero-and-join");

        var fallbackTrace = new ControlStartupTrace();
        NativeControlService.RunAttempt(fallbackTrace, () => throw taskFailure, () => { },
            (exit, specificExit) => { observedExit = exit; observedSpecificExit = specificExit; });
        Check(observedExit == ServiceSpecificError && observedSpecificExit == Wire(4, 7, 3), "untraced-work-fallback-stage");

        sequence.Clear();
        int stoppedCalls = 0;
        NativeControlService.RunAttempt(new ControlStartupTrace(), () => sequence.Add("work"),
            () => sequence.Add("join"), (exit, specificExit) => {
                sequence.Add("stopped"); stoppedCalls++; throw privateOuter;
            });
        Check(stoppedCalls == 1 && sequence.SequenceEqual(new[] { "work", "join", "stopped" }),
            "failed-status-sink-not-retried");
        foreach (bool workFails in new[] { false, true }) {
            sequence.Clear();
            stoppedCalls = 0;
            var joinFailure = new PrivateError(unchecked((int)0x80131505));
            var joinTrace = new ControlStartupTrace();
            caught = null;
            try {
                NativeControlService.RunAttempt(joinTrace,
                    () => {
                        sequence.Add("work");
                        if (workFails) joinTrace.At(ControlStartupStage.PackageFiles, (Action)(() => throw privateOuter));
                    },
                    () => { sequence.Add("join"); throw joinFailure; },
                    (exit, specificExit) => { sequence.Add("stopped"); stoppedCalls++; });
            }
            catch (Exception error) { caught = error; }
            Check(ReferenceEquals(caught, joinFailure) && joinFailure.Reads == 0 && stoppedCalls == 0 &&
                sequence.SequenceEqual(new[] { "work", "join" }), "failed-join-cannot-publish-stopped");
            Check(joinTrace.FirstFailureCode == (workFails ? Wire(39, 1, 1) : (uint?)null),
                "failed-join-does-not-replace-work-diagnostic");
        }
        Check(privateOuter.Reads == 0 && privateInner.Reads == 0 && taskFailure.Reads == 0, "final-canary-untouched");
        return cases;
    }
}
