using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal static class NativeControlWorker
{
    internal const int BudgetMilliseconds = 30000;
    // 0 = never started, 1 = live, 2 = ended. One atomic transition both
    // consumes the process attempt and makes the live worker visible.
    private static int state, deadlineExceeded;
    private static long startedTimestamp;
    private static readonly ManualResetEventSlim completion = new(false);
    internal static bool Ended => Volatile.Read(ref state) != 1;
    internal static bool DeadlineExceeded => Volatile.Read(ref deadlineExceeded) != 0;

    internal static T Run<T>(Func<T> work, int budgetMs = BudgetMilliseconds)
    {
        ControlRules.Need(work is not null && budgetMs == BudgetMilliseconds &&
            Interlocked.CompareExchange(ref state, 1, 0) == 0, "CONTROL_WORKER_ADMISSION_REFUSED");
        try {
            Volatile.Write(ref startedTimestamp, Stopwatch.GetTimestamp());
            var timer = Stopwatch.StartNew();
            Task<T> task = Task.Run(work!);
            bool completed;
            try { completed = task.Wait(budgetMs); }
            catch (AggregateException) { completed = task.IsCompleted; }
            bool late = IsDeadlineExceeded(completed, timer.ElapsedMilliseconds, budgetMs);
            if (late) {
                Volatile.Write(ref deadlineExceeded, 1);
                // Neither cancel nor kill native work. All native handles and
                // secret buffers remain owned until the worker's finally ends.
                try { task.GetAwaiter().GetResult(); } catch { }
                throw new InvalidDataException("CONTROL_WORKER_DEADLINE_UNKNOWN");
            }
            return task.GetAwaiter().GetResult();
        }
        finally { Volatile.Write(ref state, 2); completion.Set(); }
    }

    internal static void Join()
    {
        if (!Ended) completion.Wait();
    }

    internal static void RequireOperationBudget()
    {
        long elapsed = (long)Stopwatch.GetElapsedTime(Volatile.Read(ref startedTimestamp)).TotalMilliseconds;
        if (elapsed >= BudgetMilliseconds) Volatile.Write(ref deadlineExceeded, 1);
        ControlRules.Need(OperationAllowed(Volatile.Read(ref state), DeadlineExceeded, elapsed),
            "CONTROL_WORKER_OPERATION_DEADLINE_REFUSED");
    }

    private static bool OperationAllowed(int currentState, bool late, long elapsed) =>
        currentState == 1 && !late && elapsed >= 0 && elapsed < BudgetMilliseconds;

    private static bool IsDeadlineExceeded(bool completed, long elapsedMs, int budgetMs) =>
        !completed || elapsedMs >= budgetMs;

    internal static int SelfTest()
    {
        int cases = 0;
        foreach (bool complete in new[] { false, true })
        foreach (long elapsed in new long[] { 0, 1, 29999, 30000, 30001, long.MaxValue }) {
            bool expected = !complete || elapsed >= BudgetMilliseconds;
            ControlRules.Need(IsDeadlineExceeded(complete, elapsed, BudgetMilliseconds) == expected,
                "CONTROL_WORKER_CLASSIFIER_FAILED");
            cases++;
        }
        foreach (int currentState in new[] { 0, 1, 2 })
        foreach (bool late in new[] { false, true })
        foreach (long elapsed in new long[] { -1, 0, 29999, 30000, long.MaxValue }) {
            bool expected = currentState == 1 && !late && elapsed is >= 0 and < BudgetMilliseconds;
            ControlRules.Need(OperationAllowed(currentState, late, elapsed) == expected,
                "CONTROL_WORKER_OPERATION_TEST_FAILED"); cases++;
        }
        // Never invoke Run here: doing so would consume the one-attempt gate.
        return cases;
    }
}

internal static class NativeControlService
{
    private static int dispatchConsumed;

    // Only the closed/pinned entry's caller may supply work, including its
    // deployment admission. SCM has no action arguments, retry, stop or cancel.
    internal static void Dispatch(ControlRole role, Action<ControlStartupTrace> work)
    {
        string service = NativeControlIdentity.ServiceName(role);
        ControlRules.Need(work is not null && Interlocked.CompareExchange(ref dispatchConsumed, 1, 0) == 0,
            "CONTROL_SERVICE_ADMISSION_REFUSED");
        NativeControlIdentity.RuntimeGuard();
        IntPtr statusHandle = IntPtr.Zero;
        ServiceControl control = (_, _, _, _) => 120;
        void Status(uint state, uint exit, uint specificExit = 0) {
            var status = new ServiceStatus { Type = 16, State = state, Win32Exit = exit, ServiceSpecificExit = specificExit };
            ControlRules.Need(SetServiceStatus(statusHandle, ref status), "CONTROL_SCM_STATUS_REFUSED");
        }
        ServiceMain main = (count, arguments) => {
            var trace = new ControlStartupTrace();
            statusHandle = RegisterServiceCtrlHandlerExW(service, control, IntPtr.Zero);
            if (statusHandle == IntPtr.Zero) return;
            RunAttempt(trace, () => {
                trace.At(ControlStartupStage.ServiceArguments, () => {
                    ControlRules.Need(count == 1 && arguments != IntPtr.Zero, "CONTROL_SCM_ARGUMENTS_REFUSED");
                    IntPtr namePointer = Marshal.ReadIntPtr(arguments);
                    ControlRules.Need(namePointer != IntPtr.Zero, "CONTROL_SCM_NAME_REFUSED");
                    // Read only the fixed known name length and terminator. No
                    // unbounded PtrToString read and no caller-selected service.
                    for (int index = 0; index <= service.Length; index++)
                        ControlRules.Need(Marshal.ReadInt16(namePointer, index * 2) ==
                            (index == service.Length ? 0 : service[index]), "CONTROL_SCM_NAME_REFUSED");
                });
                trace.At(ControlStartupStage.ServiceRunning, () => Status(4, 0));
                trace.At(ControlStartupStage.ServiceIdentity, () => NativeControlIdentity.Capture(role, trace));
                trace.At(ControlStartupStage.RuntimeAdmission, () => Task.Run(() => work!(trace)).GetAwaiter().GetResult());
                trace.At(ControlStartupStage.WorkerCompletion, () =>
                    ControlRules.Need(NativeControlWorker.Ended && !NativeControlWorker.DeadlineExceeded,
                        "CONTROL_WORKER_COMPLETION_REFUSED"));
            }, NativeControlWorker.Join, (exit, specificExit) => Status(1, exit, specificExit));
        };
        try {
            ControlRules.Need(StartServiceCtrlDispatcherW(new[] {
                new ServiceTableEntry { Name = service, Callback = main }, new ServiceTableEntry()
            }), "CONTROL_SCM_DISPATCH_REFUSED");
        }
        finally { GC.KeepAlive(main); GC.KeepAlive(control); }
    }

    // Shared sequencing with pure callback tests. No callback is retried; a
    // failed join cannot publish STOPPED, and sink failure cannot bypass join.
    internal static void RunAttempt(ControlStartupTrace trace, Action work, Action join,
        Action<uint, uint> stopped)
    {
        uint exit = 1067, specificExit = 0;
        try { work(); exit = 0; }
        catch (Exception error) {
            trace.Record(ControlStartupStage.RuntimeAdmission, error);
            exit = ControlStartupDiagnostics.ServiceSpecificError;
            specificExit = trace.FirstFailureCode!.Value;
        }
        finally {
            // Even if a bad callback returned early, do not announce a
            // stopped service while its native worker is still alive.
            join();
            try { stopped(exit, specificExit); } catch { }
        }
    }

    internal static bool ValidArguments(ControlRole role, string[]? arguments) =>
        arguments is { Length: 1 } && arguments[0] == NativeControlIdentity.ServiceName(role);

    internal static int SelfTest()
    {
        int cases = 0;
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            string expected = NativeControlIdentity.ServiceName(role);
            ControlRules.Need(ValidArguments(role, new[] { expected }), "CONTROL_SCM_PARSER_TEST_FAILED"); cases++;
            foreach (string[]? wrong in new string[]?[] { null, Array.Empty<string>(), new[] { "" },
                new[] { expected.ToLowerInvariant() }, new[] { expected + "\0" }, new[] { expected + "extra" },
                new[] { expected, "extra" }, new[] { "Ecs.Lic008.EntryEvidenceV1.Guardian" } }) {
                ControlRules.Need(!ValidArguments(role, wrong), "CONTROL_SCM_PARSER_REFUSAL_MISSING"); cases++;
            }
        }
        return cases;
    }

    [StructLayout(LayoutKind.Sequential)] private struct ServiceStatus
    {
        internal uint Type, State, ControlsAccepted, Win32Exit, ServiceSpecificExit, Checkpoint, WaitHint;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct ServiceTableEntry
    {
        [MarshalAs(UnmanagedType.LPWStr)] internal string? Name;
        internal ServiceMain? Callback;
    }
    [UnmanagedFunctionPointer(CallingConvention.Winapi)] private delegate void ServiceMain(uint count, IntPtr arguments);
    [UnmanagedFunctionPointer(CallingConvention.Winapi)] private delegate uint ServiceControl(uint code, uint eventType, IntPtr data, IntPtr context);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool StartServiceCtrlDispatcherW([In] ServiceTableEntry[] table);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
    private static extern IntPtr RegisterServiceCtrlHandlerExW(string serviceName, ServiceControl callback, IntPtr context);
    [DllImport("advapi32.dll", SetLastError = true, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetServiceStatus(IntPtr handle, ref ServiceStatus status);
}
