// Compiled for binding/layout review only. There is deliberately no reachable
// CLI/controller route to this class. A future physical package requires a new
// complete controller, protected effect contract, review and owner CONFIRM.
#if COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardNativeCreation(bool CallSucceeded, int? Win32Error,
    NativeStandardChild? RetainedChild, long EarliestCreation, long LatestCreation,
    bool NativeCallReturned, string? FailureCategory, int? FailureHResult)
{
    internal StandardLaunchSession Session()
    {
        StandardContract.Need(CallSucceeded && NativeCallReturned && FailureCategory is null &&
            EarliestCreation > 0 && LatestCreation >= EarliestCreation &&
            RetainedChild is not null && RetainedChild.ValidCreation,
            "STANDARD_NATIVE_CREATION_UNRESOLVED");
        return RetainedChild.Session(EarliestCreation, LatestCreation);
    }
}

// Strong-rooted BEFORE the native call. No finalizer/IDisposable kills or closes
// an unresolved child's handles. A failed create with unexpected returned raw
// handles is also retained. Exit observation is the only automatic release path.
internal sealed class NativeStandardChild : IStandardSuspendedProcess
{
    private static readonly object Gate = new();
    private static readonly List<NativeStandardChild> Retained = new();
    private static readonly HashSet<string> Attempts = new(StringComparer.Ordinal);
    private readonly object childGate = new();
    private IntPtr process, thread;
    private ProcessInformation information;
    public StandardLaunchPlan CreatingPlan { get; }
    private readonly IStandardLaunchGuard creatingGuard;
    private int resumeIssued, sessionIssued;
    private bool exitSignalled;
    public uint ProcessId { get; private set; }
    public uint ThreadId { get; private set; }
    private bool ValidProcess => process != IntPtr.Zero && process != new IntPtr(-1) && ProcessId > 0;
    internal bool ValidCreation => ValidProcess &&
        thread != IntPtr.Zero && thread != new IntPtr(-1) && ProcessId > 0 && ThreadId > 0;
    private const uint CreationFlags = 0x00000004 | 0x00000400 | 0x08000000;

    private NativeStandardChild(StandardLaunchPlan plan, IStandardLaunchGuard guard)
    { CreatingPlan = plan; creatingGuard = guard; }

    internal StandardLaunchSession Session(long earliest, long latest)
    {
        lock (childGate) {
            StandardContract.Need(ValidCreation && !exitSignalled && Interlocked.Exchange(ref sessionIssued, 1) == 0,
                "STANDARD_NATIVE_SESSION_ALREADY_ISSUED");
            return new(this, CreatingPlan, creatingGuard, () => DateTimeOffset.UtcNow, earliest, latest);
        }
    }

    internal static bool BindingLayoutIsExpected() => IntPtr.Size == 8 &&
        Marshal.SizeOf<StartupInfo>() == 104 && Marshal.SizeOf<ProcessInformation>() == 24 &&
        Marshal.OffsetOf<StartupInfo>(nameof(StartupInfo.StandardInput)).ToInt32() == 80 &&
        Marshal.OffsetOf<StartupInfo>(nameof(StartupInfo.Desktop)).ToInt32() == 16 &&
        Marshal.OffsetOf<ProcessInformation>(nameof(ProcessInformation.ProcessId)).ToInt32() == 16 &&
        CreationFlags == 0x08000404;

    private static void RequireOwner()
    {
        StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
            RuntimeInformation.OSArchitecture == Architecture.X64 &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            Environment.Version.ToString() == "10.0.11" && BindingLayoutIsExpected(),
            "STANDARD_LAUNCH_RUNTIME_REFUSED");
        using var identity = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(identity is null, "STANDARD_LAUNCH_IMPERSONATION_REFUSED");
        using var current = Process.GetCurrentProcess();
        var owner = StandardTokenReader.Capture(current.SafeHandle).Token;
        StandardContract.Need(owner.QueryComplete && owner.User == StandardContract.OwnerSid &&
            owner.Type == 1 && owner.Elevation == 1 && owner.ElevationType == 2 &&
            owner.IntegritySid == "S-1-16-12288" && !owner.HasRestrictions && !owner.AppContainer &&
            owner.Groups is not null && owner.Groups.Count is >= 2 and <= 1024 &&
            owner.Groups.Count == new HashSet<string>(System.Linq.Enumerable.Select(owner.Groups, g => g.Sid), StringComparer.Ordinal).Count &&
            System.Linq.Enumerable.Any(owner.Groups, g => g.Sid == StandardContract.Administrators &&
                (g.Attributes & 4) != 0 && (g.Attributes & 16) == 0) &&
            System.Linq.Enumerable.Any(owner.Groups, g => g.Sid == StandardContract.Interactive &&
                (g.Attributes & 4) != 0 && (g.Attributes & 16) == 0),
            "STANDARD_LAUNCH_OWNER_REFUSED");
    }

    internal static StandardNativeCreation Create(StandardLaunchPlan plan,
        IStandardLaunchGuard guard, SecureString password)
    {
        RequireOwner(); plan.Validate(DateTimeOffset.UtcNow);
        guard.Verify("BeforeCredentialedCreate"); plan.Validate(DateTimeOffset.UtcNow);
        string command = plan.CommandLine(); byte[] environment = StandardLaunchPlan.EnvironmentBlock();
        var child = new NativeStandardChild(plan, guard);
        // Neither a failed password nor an ambiguous return permits automatic
        // retry with the same in-process attempt. Durable intent is a separate
        // mandatory controller guard obligation, not supplied by this hash set.
        lock (Gate) {
            StandardContract.Need(Attempts.Add(plan.Attempt), "STANDARD_NATIVE_ATTEMPT_CONSUMED");
            Retained.Add(child);
        }
        GCHandle env = default;
        bool callAttempted = false, nativeReturned = false, nativeSucceeded = false;
        int? nativeError = null;
        long earliest = 0;
        try {
            return StandardCredential.Use(password, new StandardCredentialMemory(), secret => {
                env = GCHandle.Alloc(environment, GCHandleType.Pinned);
                var startup = new StartupInfo { Size = 104 };
                guard.Verify("ImmediatelyBeforeCredentialedCreate"); plan.Validate(DateTimeOffset.UtcNow);
                earliest = DateTime.UtcNow.ToFileTimeUtc();
                callAttempted = true;
                nativeSucceeded = CreateProcessWithLogonW(StandardContract.AccountName, ".", secret,
                    0, StandardLaunchPlan.Image, new StringBuilder(command, 1024), CreationFlags,
                    env.AddrOfPinnedObject(), StandardLaunchPlan.WorkingDirectory, ref startup, out child.information);
                nativeError = nativeSucceeded ? null : Marshal.GetLastWin32Error();
                nativeReturned = true;
                child.AttachReturnedHandles();
                long latest = DateTime.UtcNow.ToFileTimeUtc();
                if (!nativeSucceeded && child.process == IntPtr.Zero && child.thread == IntPtr.Zero) {
                    lock (Gate) Retained.Remove(child);
                    return new StandardNativeCreation(false, nativeError, null, earliest, latest, true, null, null);
                }
                return new StandardNativeCreation(nativeSucceeded, nativeError, child, earliest, latest, true, null, null);
            });
        } catch (Exception error) {
            // If the P/Invoke was entered, even a marshalling/runtime exception is
            // unresolved. Keep the rooted lease; never claim no child was made.
            if (!callAttempted) { lock (Gate) Retained.Remove(child); throw; }
            child.AttachReturnedHandles();
            lock (Gate) { if (!Retained.Contains(child)) Retained.Add(child); }
            return new(nativeSucceeded, nativeError ?? (error is Win32Exception native ? native.NativeErrorCode : null),
                child, earliest, 0, nativeReturned, error.GetType().Name, error.HResult);
        } finally {
            if (env.IsAllocated) env.Free();
        }
    }

    private void AttachReturnedHandles()
    {
        process = information.Process; thread = information.Thread;
        ProcessId = information.ProcessId; ThreadId = information.ThreadId;
    }

    public StandardProcessToken Capture()
    {
        lock (childGate) return CaptureCore();
    }
    private StandardProcessToken CaptureCore()
    {
        StandardContract.Need(ValidProcess, "STANDARD_NATIVE_PROCESS_HANDLE_REFUSED");
        // Non-owning alias only; disposal cannot release the retained OS handle.
        using var alias = new SafeProcessHandle(process, false);
        return StandardTokenReader.Capture(alias);
    }

    public uint ResumeOnce()
    {
        lock (childGate) return ResumeOnceCore();
    }
    private uint ResumeOnceCore()
    {
        StandardContract.Need(ValidCreation, "STANDARD_NATIVE_RESUME_HANDLE_REFUSED");
        StandardContract.Need(Interlocked.Exchange(ref resumeIssued, 1) == 0, "STANDARD_NATIVE_RESUME_RETRY_REFUSED");
        uint previous = ResumeThread(thread);
        if (previous == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
        return previous;
    }

    public uint Wait(uint milliseconds)
    {
        lock (childGate) return WaitCore(milliseconds);
    }
    private uint WaitCore(uint milliseconds)
    {
        StandardContract.Need(ValidProcess && milliseconds <= 30000, "STANDARD_NATIVE_WAIT_REFUSED");
        uint result = WaitForSingleObject(process, milliseconds);
        if (result == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
        if (result == 0) exitSignalled = true;
        return result;
    }

    public uint ExitCode()
    {
        lock (childGate) return ExitCodeCore();
    }
    private uint ExitCodeCore()
    {
        StandardContract.Need(ValidProcess && exitSignalled, "STANDARD_NATIVE_EXIT_NOT_OBSERVED");
        if (!GetExitCodeProcess(process, out uint code)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return code;
    }

    public void ReleaseAfterObservedExit()
    {
        lock (childGate) ReleaseAfterObservedExitCore();
    }
    private void ReleaseAfterObservedExitCore()
    {
        StandardContract.Need(exitSignalled, "STANDARD_NATIVE_RELEASE_WITHOUT_EXIT_REFUSED");
        if (thread != IntPtr.Zero) {
            if (!CloseHandle(thread)) throw new Win32Exception(Marshal.GetLastWin32Error());
            thread = IntPtr.Zero;
        }
        if (process != IntPtr.Zero) {
            if (!CloseHandle(process)) throw new Win32Exception(Marshal.GetLastWin32Error());
            process = IntPtr.Zero;
        }
        lock (Gate) Retained.Remove(this);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        internal uint Size;
        internal string? Reserved, Desktop, Title;
        internal uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags;
        internal ushort ShowWindow, ReservedSize;
        internal IntPtr ReservedBytes, StandardInput, StandardOutput, StandardError;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        internal IntPtr Process, Thread;
        internal uint ProcessId, ThreadId;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessWithLogonW(string user, string domain, IntPtr password,
        uint logonFlags, string application, StringBuilder command, uint creationFlags,
        IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation information);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(IntPtr process, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);
}
#endif
