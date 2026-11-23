using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
#if COMPILE_ONLY_STANDARD_WORKER_CHANNEL_NATIVE_V1
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
#endif

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardPipeRules
{
    // FILE_CREATE_PIPE_INSTANCE aliases FILE_APPEND_DATA (bit4). The worker
    // gets individual data/attribute/control/synchronize rights, never GW/GA.
    internal const uint ClientAccess = 0x00120183;
    internal const uint ServerOpenMode = 0x40080003; // overlapped, first instance, duplex.
    internal const uint ServerPipeMode = 0x00000008; // local-only byte stream; core frames bytes.
    internal const uint ClientFlags = 0x40110000; // overlapped, SQOS-present, identification only.
    internal static string WorkerSid(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.Setup => StandardCryptoComparison.SystemSid,
        StandardCryptoStage.GuardianBefore or StandardCryptoStage.GuardianAfter => StandardCryptoComparison.GuardianSid,
        StandardCryptoStage.StandardUser => StandardContract.UserSid,
        _ => throw new InvalidDataException("STANDARD_PIPE_STAGE_REFUSED")
    };
    internal static string Name(StandardCryptoScope scope, StandardCryptoStage stage, DateTimeOffset now)
    {
        StandardStoreRules.Scope(scope, now); _ = WorkerSid(stage);
        return StandardWorkerChannelRules.Endpoint(scope, stage);
    }
    internal static StandardStoreRule Rule(StandardCryptoStage stage)
    {
        var aces = new List<StandardStoreAce> {
            new(StandardCryptoComparison.SystemSid, stage == StandardCryptoStage.Setup ? ClientAccess : StandardStoreRules.Full),
            new(StandardContract.OwnerSid, StandardStoreRules.Full)
        };
        string worker = WorkerSid(stage);
        if (worker != StandardCryptoComparison.SystemSid) aces.Add(new(worker, ClientAccess));
        return new(StandardContract.OwnerSid, StandardContract.Administrators, false, aces.AsReadOnly());
    }
    internal static void Buffer(byte[]? buffer, int offset, int count, uint timeout)
    {
        StandardContract.Need(buffer is not null && offset >= 0 && count is > 0 and <= 65536 &&
            offset <= buffer.Length && count <= buffer.Length - offset && timeout is > 0 and <= 30000,
            "STANDARD_PIPE_IO_ARGUMENT_REFUSED");
    }
}

internal sealed record StandardPipeCompletion(bool StartCallReturned, bool OperationCompleted,
    bool OperationCanceled, bool CancellationCompleted, bool ReleaseAllowed, string? OperationFailureType, int? OperationHResult,
    string? CancellationFailureType, int? CancellationHResult);

// A timeout is a bounded wait result, never proof that native I/O ended.
// Keep this lease AND its transport strongly rooted until both I/O and every
// cancellation callback have reached terminal completion. No automatic retry.
internal sealed class StandardPipeIoLease : IDisposable
{
    private readonly CancellationTokenSource cancellation = new();
    private readonly object bufferLifetime;
    private Task<int>? operation;
    private Task? cancelRequest;
    private int started, waited, cancelEntered;
    private bool disposed;
    internal StandardPipeIoLease(object bufferLifetime) => this.bufferLifetime = bufferLifetime ?? throw new ArgumentNullException(nameof(bufferLifetime));
    internal void Start(Func<CancellationToken, Task<int>> start)
    {
        StandardContract.Need(!disposed && Interlocked.Exchange(ref started, 1) == 0, "STANDARD_PIPE_IO_START_REUSED");
        operation = start(cancellation.Token) ?? throw new InvalidDataException("STANDARD_PIPE_IO_TASK_MISSING_RETAIN");
    }
    internal bool ReleaseAllowed => started == 0 || (operation is { IsCompleted: true } &&
        (cancelEntered == 0 || cancelRequest is { IsCompleted: true }));
    internal int Wait(uint milliseconds)
    {
        StandardContract.Need(!disposed && operation is not null && milliseconds is > 0 and <= 30000 &&
            Interlocked.Exchange(ref waited, 1) == 0,
            "STANDARD_PIPE_IO_WAIT_REFUSED");
        if (operation.IsCompleted) return operation.GetAwaiter().GetResult();
        using var timerCancellation = new CancellationTokenSource();
        Task delay = Task.Delay(TimeSpan.FromMilliseconds(milliseconds), timerCancellation.Token);
        Task winner;
        try { winner = Task.WhenAny(operation, delay).GetAwaiter().GetResult(); }
        finally { timerCancellation.Cancel(); }
        if (winner != operation) {
            Volatile.Write(ref cancelEntered, 1);
            cancelRequest = cancellation.CancelAsync();
            throw new TimeoutException("STANDARD_PIPE_IO_TIMEOUT_RETAIN_UNTIL_OBSERVED_COMPLETION");
        }
        // The selected operation is terminal; this GetResult cannot become an
        // unbounded wait for cancellation completion.
        return operation.GetAwaiter().GetResult();
    }
    internal StandardPipeCompletion Observe()
    {
        Exception? failed = operation is { IsFaulted: true } ? operation.Exception!.InnerException : null;
        Exception? cancelFailed = cancelRequest is { IsFaulted: true } ? cancelRequest.Exception!.InnerException : null;
        return new(operation is not null, operation?.IsCompleted == true, operation?.IsCanceled == true,
            cancelEntered == 0 || cancelRequest is { IsCompleted: true },
            ReleaseAllowed, failed?.GetType().Name, failed?.HResult, cancelFailed?.GetType().Name, cancelFailed?.HResult);
    }
    public void Dispose()
    {
        StandardContract.Need(ReleaseAllowed, "STANDARD_PIPE_IO_UNRESOLVED_RELEASE_REFUSED");
        if (disposed) return; disposed = true; cancellation.Dispose(); GC.KeepAlive(bufferLifetime);
    }
}

#if COMPILE_ONLY_STANDARD_WORKER_CHANNEL_NATIVE_V1
// No CLI reaches this adapter. It supplies raw local peer PIDs and byte I/O,
// not identity admission or crypto authority. The separately reviewed channel
// must match those PIDs to held original process/token/code-custody leases.
// No impersonation, reconnect, additional pipe instance or implicit retry.
internal sealed class StandardNativeWorkerChannel : IStandardWorkerChannelTransport, IDisposable
{
    private readonly StandardCryptoScope scope;
    private readonly StandardCryptoStage stage;
    private readonly bool server;
    private readonly PipeStream pipe;
    private readonly Action<string> custodyGuard;
    private readonly object operationGate = new();
    private static readonly object retainedGate = new();
    private static readonly HashSet<StandardNativeWorkerChannel> retained = new();
    private StandardPipeIoLease? pending;
    private bool active, disposed, poisoned, acceptEntered;
    private StandardNativeWorkerChannel(StandardCryptoScope scope, StandardCryptoStage stage, bool server,
        PipeStream pipe, Action<string> custodyGuard)
    {
        this.scope = scope; this.stage = stage; this.server = server; this.pipe = pipe;
        this.custodyGuard = custodyGuard;
    }
    private static void Require(StandardCryptoScope scope, StandardCryptoStage stage, bool server, Action<string> guard)
    {
        ArgumentNullException.ThrowIfNull(guard);
        StandardStoreRules.Scope(scope, DateTimeOffset.UtcNow); _ = StandardPipeRules.WorkerSid(stage);
        StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 && RuntimeInformation.OSArchitecture == Architecture.X64 &&
            Environment.Version.ToString() == "10.0.11", "STANDARD_PIPE_RUNTIME_REFUSED");
        using var impersonation = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(impersonation is null, "STANDARD_PIPE_IMPERSONATION_REFUSED");
        using var process = Process.GetCurrentProcess();
        var token = StandardTokenReader.Capture(process.SafeHandle).Token;
        if (server) StandardWorkerChannelRules.OwnerToken(token);
        else StandardWorkerChannelRules.WorkerToken(stage, token);
        guard("NativePipe"); StandardStoreRules.Scope(scope, DateTimeOffset.UtcNow);
    }
    private void Gate() => Require(scope, stage, server, custodyGuard);
    private T Perform<T>(Func<T> work)
    {
        lock (operationGate) {
            StandardContract.Need(!active && !disposed && !poisoned, "STANDARD_PIPE_REENTRY_DISPOSED_OR_CONSUMED"); active = true;
            try { Gate(); var result = work(); Gate(); return result; }
            catch { poisoned = true; throw; }
            finally { active = false; }
        }
    }
    internal static StandardNativeWorkerChannel Listen(StandardCryptoScope scope, StandardCryptoStage stage, Action<string> guard)
    {
        Require(scope, stage, true, guard);
        byte[] descriptor = StandardStoreRules.Descriptor(StandardPipeRules.Rule(stage));
        GCHandle pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned); SafePipeHandle? native = null; PipeStream? managed = null;
        try {
            var security = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = pin.AddrOfPinnedObject() };
            native = CreateNamedPipeW(StandardPipeRules.Name(scope, stage, DateTimeOffset.UtcNow), StandardPipeRules.ServerOpenMode,
                StandardPipeRules.ServerPipeMode, 1, 65536, 65536, 30000, ref security);
            if (native.IsInvalid) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            managed = new NamedPipeServerStream(PipeDirection.InOut, true, false, native); native = null;
            var result = new StandardNativeWorkerChannel(scope, stage, true, managed, guard);
            result.CheckDescriptor(); result.Gate(); managed = null; return result;
        } finally { managed?.Dispose(); native?.Dispose(); pin.Free(); }
    }
    // The controller must have created the one server before starting/resuming
    // a worker. Busy/missing/refused endpoints are failures, never WaitNamedPipe.
    internal static StandardNativeWorkerChannel Connect(StandardCryptoScope scope, StandardCryptoStage stage, Action<string> guard)
    {
        Require(scope, stage, false, guard);
        var security = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        SafePipeHandle? native = null; PipeStream? managed = null;
        try {
            native = CreateFileW(StandardPipeRules.Name(scope, stage, DateTimeOffset.UtcNow), StandardPipeRules.ClientAccess,
                0, ref security, 3, StandardPipeRules.ClientFlags, IntPtr.Zero);
            if (native.IsInvalid) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            managed = new NamedPipeClientStream(PipeDirection.InOut, true, true, native); native = null;
            var result = new StandardNativeWorkerChannel(scope, stage, false, managed, guard);
            result.CheckDescriptor(); result.Gate(); managed = null; return result;
        } finally { managed?.Dispose(); native?.Dispose(); }
    }
    internal void AcceptOnce(uint timeoutMilliseconds) => Perform(() => {
        StandardContract.Need(server && !acceptEntered && timeoutMilliseconds is > 0 and <= 30000,
            "STANDARD_PIPE_ACCEPT_REFUSED"); acceptEntered = true;
        CompleteIo(async token => { await ((NamedPipeServerStream)pipe).WaitForConnectionAsync(token).ConfigureAwait(false); return 1; }, pipe, timeoutMilliseconds);
        CheckDescriptor(); return true;
    });
    private int CompleteIo(Func<CancellationToken, Task<int>> start, object lifetime, uint timeoutMilliseconds)
    {
        StandardContract.Need(pending is null, "STANDARD_PIPE_IO_ALREADY_PENDING");
        pending = new StandardPipeIoLease(lifetime);
        lock (retainedGate) retained.Add(this); // Before starting any native I/O.
        try { pending.Start(start); return pending.Wait(timeoutMilliseconds); }
        finally {
            if (pending.ReleaseAllowed) {
                pending.Dispose(); pending = null; lock (retainedGate) retained.Remove(this);
            }
        }
    }
    // Read-only observation remains possible after expiry/failure. It grants no
    // protocol retry, reconnect or process/key action.
    internal StandardPipeCompletion? ObservePendingCompletion()
    {
        lock (operationGate) {
            StandardContract.Need(!active, "STANDARD_PIPE_REENTRANT_OBSERVE_REFUSED"); return pending?.Observe();
        }
    }
    private void CheckDescriptor()
    {
        uint status = GetSecurityInfo(pipe.SafePipeHandle, 1, 7, out _, out _, out _, out _, out var descriptor);
        try {
            if (status != 0) throw new System.ComponentModel.Win32Exception(checked((int)status));
            StandardContract.Need(descriptor != IntPtr.Zero, "STANDARD_PIPE_DESCRIPTOR_MISSING");
            int length = checked((int)GetSecurityDescriptorLength(descriptor));
            StandardContract.Need(length is >= 20 and <= 65536, "STANDARD_PIPE_DESCRIPTOR_LENGTH_REFUSED");
            var bytes = new byte[length]; Marshal.Copy(descriptor, bytes, 0, length);
            StandardStoreRules.ValidateDescriptor(bytes, StandardPipeRules.Rule(stage));
        } finally { if (descriptor != IntPtr.Zero) LocalFree(descriptor); }
    }
    public uint LocalProcessId => Perform(() => checked((uint)Environment.ProcessId));
    public uint PeerProcessId() => Perform(() => {
        StandardContract.Need(pipe.IsConnected, "STANDARD_PIPE_NOT_CONNECTED"); CheckDescriptor();
        uint pid;
        bool ok = server ? GetNamedPipeClientProcessId(pipe.SafePipeHandle, out pid) : GetNamedPipeServerProcessId(pipe.SafePipeHandle, out pid);
        if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        StandardContract.Need(pid > 0 && pid != Environment.ProcessId, "STANDARD_PIPE_PEER_PID_REFUSED"); return pid;
    });
    public int Read(byte[] buffer, int offset, int count, uint timeoutMilliseconds) => Perform(() => {
        StandardPipeRules.Buffer(buffer, offset, count, timeoutMilliseconds);
        return CompleteIo(token => pipe.ReadAsync(buffer.AsMemory(offset, count), token).AsTask(), buffer, timeoutMilliseconds);
    });
    public int Write(byte[] buffer, int offset, int count, uint timeoutMilliseconds) => Perform(() => {
        StandardPipeRules.Buffer(buffer, offset, count, timeoutMilliseconds);
        byte[] snapshot = buffer.AsSpan(offset, count).ToArray();
        return CompleteIo(async token => { await pipe.WriteAsync(snapshot, token).ConfigureAwait(false); return count; }, snapshot, timeoutMilliseconds);
    });
    public void Dispose()
    {
        lock (operationGate) {
            StandardContract.Need(!active, "STANDARD_PIPE_REENTRANT_DISPOSE_REFUSED");
            StandardContract.Need(pending is null || pending.ReleaseAllowed, "STANDARD_PIPE_UNRESOLVED_IO_RETAIN_DISPOSE_REFUSED");
            if (disposed) return; disposed = true; pending?.Dispose(); pending = null; pipe.Dispose();
            lock (retainedGate) retained.Remove(this);
        }
    }
    [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafePipeHandle CreateNamedPipeW(string name, uint mode, uint pipeMode, uint instances, uint output, uint input, uint timeout, ref SecurityAttributes security);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafePipeHandle CreateFileW(string name, uint access, uint share, ref SecurityAttributes security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe, out uint pid);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityInfo(SafePipeHandle handle, uint type, uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}
#endif
