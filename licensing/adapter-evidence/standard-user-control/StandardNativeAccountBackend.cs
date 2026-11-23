using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
#if COMPILE_ONLY_STANDARD_ACCOUNT_NATIVE_V1
using Microsoft.Win32.SafeHandles;
using System.Security.Principal;
#endif

namespace EntryControl.TestOnly.StandardUserControl;

// Opaque SAM context handles, not SafeHandles. They have no finalizer. Each
// output slot is strongly rooted before the native call that can populate it.
internal sealed class StandardAccountSamHandle
{
    internal readonly string Kind;
    internal IntPtr Value;
    internal IntPtr PinnedValue;
    internal bool CloseEntered, Closed;
    internal StandardAccountSamHandle(string kind) { Kind = kind; }
}
internal sealed record StandardAccountNet23(string Name, string Sid, uint NetUserFlags);
internal sealed record StandardAccountNativeCall(string Stage, string Api, uint RawStatus);
internal sealed record StandardAccountNativeHandleState(string Kind, string ValueHex, bool CloseEntered, bool Closed);
internal sealed record StandardAccountNativeEvidence(string Stage, bool Faulted, bool Retained,
    bool MutationCallEntered, string? ManagedFailureCategory, int? ManagedFailureHResult,
    uint? FailureSamStatus, uint? FailureNetApiStatus,
    IReadOnlyList<StandardAccountNativeCall> Calls, IReadOnlyList<StandardAccountNativeHandleState> Handles);

internal sealed class StandardAccountNativeStatusException : Exception
{
    internal string Stage { get; }
    internal string Api { get; }
    internal uint RawStatus { get; }
    internal StandardAccountNativeStatusException(string stage, string api, uint status)
        : base("STANDARD_ACCOUNT_NATIVE_STATUS_" + stage + "_" + api + "_0x" + status.ToString("x8", CultureInfo.InvariantCulture))
    { Stage = stage; Api = api; RawStatus = status; }
}

// Injected implementations are test doubles unless separately admitted. Every
// method returns its original NTSTATUS/NET_API_STATUS, never an HRESULT mapping.
// These slots must not be replaced, closed or reopened behind the retained lease.
internal interface IStandardAccountNativeApi
{
    uint ConnectLocal(uint access, StandardAccountSamHandle output);
    uint OpenDomain(StandardAccountSamHandle server, string sid, uint access, StandardAccountSamHandle output);
    uint OpenUser(StandardAccountSamHandle domain, uint rid, uint access, StandardAccountSamHandle output);
    uint QueryName(StandardAccountSamHandle user, out string? name);
    uint QueryControl(StandardAccountSamHandle user, out uint control);
    uint DirectAliasMembership(StandardAccountSamHandle domain, string exactSid, out uint[]? aliases);
    uint NetUserInfo23(string exactName, out StandardAccountNet23? value);
    uint SetControl(StandardAccountSamHandle user, uint control);
    uint Close(StandardAccountSamHandle handle);
}

internal static class StandardAccountNativeLayout
{
    internal const string MachineDomainSid = "S-1-5-21-3058020570-171625005-1532683838";
    internal const string BuiltinDomainSid = "S-1-5-32";
    internal const uint Rid = 1023, ServerAccess = 0x21, MachineDomainAccess = 0x280,
        BuiltinDomainAccess = 0x80, UserAccess = 0x31;
    internal const int AccountNameInformation = 7, ControlInformation = 16, NetInfoLevel = 23;
    internal static byte[] ControlBytes(uint control)
    {
        _ = StandardAccountFlagCodec.DecodeSamMappedFlags(control);
        byte[] bytes = new byte[4]; BinaryPrimitives.WriteUInt32LittleEndian(bytes, control); return bytes;
    }
    internal static uint Control(byte[]? bytes)
    {
        StandardContract.Need(bytes is { Length: 4 }, "STANDARD_ACCOUNT_CONTROL_LAYOUT_REFUSED");
        uint control = BinaryPrimitives.ReadUInt32LittleEndian(bytes);
        _ = StandardAccountFlagCodec.DecodeSamMappedFlags(control); return control;
    }
    internal static int NameLength(byte[]? header)
    {
        StandardContract.Need(header is { Length: 16 }, "STANDARD_ACCOUNT_NAME_LAYOUT_REFUSED");
        int length = BinaryPrimitives.ReadUInt16LittleEndian(header), maximum = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(2));
        StandardContract.Need(length is > 0 and <= 512 && (length & 1) == 0 && maximum >= length &&
            maximum <= 4096 && (maximum & 1) == 0 && BinaryPrimitives.ReadUInt64LittleEndian(header.AsSpan(8)) != 0,
            "STANDARD_ACCOUNT_NAME_LENGTH_REFUSED"); return length;
    }
    internal static string Name(byte[]? bytes)
    {
        StandardContract.Need(bytes is { Length: > 0 and <= 512 } && (bytes.Length & 1) == 0,
            "STANDARD_ACCOUNT_NAME_BYTES_REFUSED");
        string name;
        try { name = new UnicodeEncoding(false, false, true).GetString(bytes); }
        catch (DecoderFallbackException) { throw new InvalidDataException("STANDARD_ACCOUNT_NAME_UTF16_REFUSED"); }
        StandardContract.Need(name == StandardContract.AccountName, "STANDARD_ACCOUNT_NATIVE_NAME_REFUSED"); return name;
    }
    internal static byte[] SidBytes(string sid)
    {
        StandardContract.Need(StandardIdentity.CanonicalSid(sid), "STANDARD_ACCOUNT_SID_LAYOUT_REFUSED");
        string[] parts = sid.Split('-'); byte[] bytes = new byte[8 + (parts.Length - 3) * 4];
        bytes[0] = 1; bytes[1] = checked((byte)(parts.Length - 3));
        ulong authority = ulong.Parse(parts[2], CultureInfo.InvariantCulture);
        for (int i = 0; i < 6; i++) bytes[7 - i] = (byte)(authority >> (i * 8));
        for (int i = 3; i < parts.Length; i++)
            BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(8 + (i - 3) * 4), uint.Parse(parts[i], CultureInfo.InvariantCulture));
        return bytes;
    }
    private static int Offset(byte[] bytes, ulong address, int header, ulong pointer, int length)
    {
        StandardContract.Need(address > 0 && length >= 0 && pointer >= address && pointer - address <= (ulong)bytes.Length,
            "STANDARD_ACCOUNT_NET_POINTER_REFUSED");
        ulong relative = pointer - address;
        StandardContract.Need(relative >= (ulong)header && relative <= (ulong)bytes.Length &&
            (ulong)length <= (ulong)bytes.Length - relative, "STANDARD_ACCOUNT_NET_POINTER_REFUSED");
        return checked((int)relative);
    }
    internal static StandardAccountNet23 Net23(byte[]? supplied, ulong originalAddress)
    {
        StandardContract.Need(supplied is { Length: >= 40 and <= 1048576 } && originalAddress > 0 &&
            originalAddress <= long.MaxValue && (originalAddress & 7) == 0, "STANDARD_ACCOUNT_NET23_LAYOUT_REFUSED");
        byte[] bytes = (byte[])supplied.Clone();
        int nameOffset = Offset(bytes, originalAddress, 40, BinaryPrimitives.ReadUInt64LittleEndian(bytes), 2);
        StandardContract.Need((nameOffset & 1) == 0, "STANDARD_ACCOUNT_NET_NAME_ALIGNMENT_REFUSED");
        int nameLength = -1;
        for (int i = 0; i <= 512 && i + 2 <= bytes.Length - nameOffset; i += 2) {
            if (bytes[nameOffset + i] == 0 && bytes[nameOffset + i + 1] == 0) { nameLength = i; break; }
        }
        StandardContract.Need(nameLength > 0, "STANDARD_ACCOUNT_NET_NAME_TERMINATOR_REFUSED");
        string name = Name(bytes.AsSpan(nameOffset, nameLength).ToArray());
        int sidOffset = Offset(bytes, originalAddress, 40, BinaryPrimitives.ReadUInt64LittleEndian(bytes.AsSpan(32)), 8);
        StandardContract.Need((sidOffset & 3) == 0 && bytes[sidOffset] == 1 && bytes[sidOffset + 1] is > 0 and <= 15,
            "STANDARD_ACCOUNT_NET_SID_LAYOUT_REFUSED");
        int count = bytes[sidOffset + 1], sidLength = 8 + count * 4;
        StandardContract.Need(sidLength <= bytes.Length - sidOffset, "STANDARD_ACCOUNT_NET_SID_TRUNCATED");
        ulong authority = 0; for (int i = 0; i < 6; i++) authority = (authority << 8) | bytes[sidOffset + 2 + i];
        var sid = new StringBuilder("S-1-" + authority.ToString(CultureInfo.InvariantCulture));
        for (int i = 0; i < count; i++) sid.Append('-').Append(BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(sidOffset + 8 + i * 4)).ToString(CultureInfo.InvariantCulture));
        StandardContract.Need(sid.ToString() == StandardContract.UserSid, "STANDARD_ACCOUNT_NET_SID_REFUSED");
        uint flags = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(24));
        _ = StandardAccountFlagCodec.EncodeNetObservation(flags);
        return new(name, sid.ToString(), flags);
    }
}

// This component has no entry point. Only the conditional factory supplies local
// native calls. A future controller still supplies live approval, host/source/
// runtime custody and the account ownership/intent originals through its guard.
internal sealed class StandardNativeAccountBackend : IStandardAccountBackend
{
    private readonly StandardAccountContext context;
    private readonly IStandardAccountGuard guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly IStandardAccountNativeApi api;
    private readonly object gate = new();
    private bool consumed;
    private Lease? lease;
    internal StandardNativeAccountBackend(StandardAccountContext context, IStandardAccountGuard guard,
        Func<DateTimeOffset> utcNow, IStandardAccountNativeApi api)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
        this.api = api ?? throw new ArgumentNullException(nameof(api));
    }
    public IStandardOwnedAccountLease OpenOwnedLocalSid(string exactSid, Action admission)
    {
        lock (gate) {
            StandardContract.Need(!consumed && exactSid == StandardContract.UserSid && admission is not null,
                "STANDARD_ACCOUNT_NATIVE_OPEN_REFUSED");
            consumed = true; lease = new(this); lease.Retain();
        }
        lease.Initialize(admission); return lease;
    }
    internal StandardAccountNativeEvidence? Evidence() { Lease? current; lock (gate) current = lease; return current?.Evidence(); }
    private void Guard(string stage, ref DateTimeOffset? last)
    {
        DateTimeOffset before = utcNow(); StandardAccountRules.Context(context, before);
        StandardWorkerChannelRules.OwnerToken(guard.CaptureOwnerAndVerifyCustody(context, stage));
        DateTimeOffset after = utcNow(); StandardAccountRules.Context(context, after);
        StandardContract.Need(after >= before && (last is null || before >= last), "STANDARD_ACCOUNT_NATIVE_CLOCK_ROLLBACK"); last = after;
    }
    private sealed class Lease : IStandardOwnedAccountLease
    {
        private static readonly object retainedGate = new();
        private static readonly HashSet<Lease> retained = new();
        private readonly StandardNativeAccountBackend owner;
        private readonly object sync = new();
        private readonly StandardAccountSamHandle server = new("SERVER"), machine = new("MACHINE_DOMAIN"),
            builtin = new("BUILTIN_DOMAIN"), user = new("USER");
        private readonly List<StandardAccountNativeCall> calls = new();
        private bool busy, initialized, disposed, faulted, retainedHere, mutationEntered;
        private string stage = "ADMISSION";
        private string? failureCategory;
        private int? failureHResult;
        private uint? failureSamStatus, failureNetApiStatus;
        private uint? baselineFlags;
        private DateTimeOffset? last;
        internal Lease(StandardNativeAccountBackend owner) { this.owner = owner; }
        internal void Retain() { lock (retainedGate) { retained.Add(this); retainedHere = true; } }
        private void Gate(string value) { stage = value; owner.Guard(stage, ref last); }
        private void Live(StandardAccountSamHandle handle)
        {
            StandardContract.Need(handle.Value != IntPtr.Zero && handle.PinnedValue == handle.Value && !handle.Closed && !handle.CloseEntered,
                "STANDARD_ACCOUNT_SAM_HANDLE_CHANGED");
        }
        private void Record(string value, string apiName, uint status)
        {
            StandardContract.Need(calls.Count < 2048, "STANDARD_ACCOUNT_NATIVE_TRACE_LIMIT"); calls.Add(new(value, apiName, status));
        }
        private void Call(string value, string apiName, Func<uint> operation, bool mutation = false)
        {
            Gate(value + ":BEFORE"); StandardContract.Need(calls.Count < 2048, "STANDARD_ACCOUNT_NATIVE_TRACE_LIMIT");
            if (mutation) mutationEntered = true;
            uint status = operation(); Record(value, apiName, status); Gate(value + ":AFTER");
            if (status != 0) throw new StandardAccountNativeStatusException(value, apiName, status);
        }
        private void Pin(StandardAccountSamHandle handle)
        {
            StandardContract.Need(handle.Value != IntPtr.Zero && new[] { server, machine, builtin, user }
                .Where(x => !ReferenceEquals(x, handle)).All(x => x.Value == IntPtr.Zero || x.Value != handle.Value),
                "STANDARD_ACCOUNT_SAM_OUTPUT_HANDLE_REFUSED"); handle.PinnedValue = handle.Value;
        }
        private T Perform<T>(Func<T> operation, bool initializing = false)
        {
            lock (sync) {
                StandardContract.Need(!busy && !disposed && !faulted && (initializing ? !initialized : initialized),
                    "STANDARD_ACCOUNT_NATIVE_LEASE_STATE_REFUSED");
                busy = true;
                try { return operation(); }
                catch (Exception error) {
                    faulted = true; failureCategory = error.GetType().Name; failureHResult = error.HResult;
                    if (error is StandardAccountNativeStatusException native) {
                        failureSamStatus = native.Api == "SAM" ? native.RawStatus : null;
                        failureNetApiStatus = native.Api == "NETAPI" ? native.RawStatus : null;
                        if (calls.Count < 2048 && !calls.Any(x => x.Stage == native.Stage && x.Api == native.Api && x.RawStatus == native.RawStatus))
                            Record(native.Stage, native.Api, native.RawStatus);
                    }
                    throw;
                } finally { busy = false; }
            }
        }
        internal void Initialize(Action admission) => Perform(() => {
            Gate("OPEN_ADMISSION:BEFORE"); admission(); Gate("OPEN_ADMISSION:AFTER");
            Call("CONNECT_LOCAL", "SAM", () => owner.api.ConnectLocal(StandardAccountNativeLayout.ServerAccess, server)); Pin(server);
            Live(server); Call("OPEN_MACHINE_DOMAIN", "SAM", () => owner.api.OpenDomain(server,
                StandardAccountNativeLayout.MachineDomainSid, StandardAccountNativeLayout.MachineDomainAccess, machine)); Pin(machine);
            Live(server); Call("OPEN_BUILTIN_DOMAIN", "SAM", () => owner.api.OpenDomain(server,
                StandardAccountNativeLayout.BuiltinDomainSid, StandardAccountNativeLayout.BuiltinDomainAccess, builtin)); Pin(builtin);
            Live(machine); Call("OPEN_USER_RID", "SAM", () => owner.api.OpenUser(machine,
                StandardAccountNativeLayout.Rid, StandardAccountNativeLayout.UserAccess, user)); Pin(user);
            var initial = Read(); StandardContract.Need(!initial.Snapshot.Enabled, "STANDARD_ACCOUNT_NATIVE_INITIAL_NOT_DISABLED");
            initialized = true; return 0;
        }, true);
        private string ReadName(string label)
        {
            Live(user); string? name = null; Call(label, "SAM", () => owner.api.QueryName(user, out name));
            StandardContract.Need(name == StandardContract.AccountName, "STANDARD_ACCOUNT_NATIVE_NAME_REFUSED"); return name;
        }
        private uint ReadControl(string label)
        {
            Live(user); uint control = 0; Call(label, "SAM", () => owner.api.QueryControl(user, out control));
            _ = StandardAccountFlagCodec.DecodeSamMappedFlags(control); return control;
        }
        private StandardAccountNet23 ReadNet(string label)
        {
            StandardAccountNet23? net = null; Call(label, "NETAPI", () => owner.api.NetUserInfo23(StandardContract.AccountName, out net));
            StandardContract.Need(net is not null && net.Name == StandardContract.AccountName && net.Sid == StandardContract.UserSid,
                "STANDARD_ACCOUNT_NET_IDENTITY_REFUSED"); _ = StandardAccountFlagCodec.EncodeNetObservation(net.NetUserFlags); return net;
        }
        private uint[] Aliases(StandardAccountSamHandle domain, string label)
        {
            Live(domain); uint[]? result = null;
            Call(label, "SAM", () => owner.api.DirectAliasMembership(domain, StandardContract.UserSid, out result));
            StandardContract.Need(result is { Length: <= 1024 } && result.All(x => x > 0) && result.Distinct().Count() == result.Length,
                "STANDARD_ACCOUNT_DIRECT_ALIAS_CAPTURE_REFUSED"); return (uint[])result.Clone();
        }
        private (StandardAccountSnapshot Snapshot, StandardAccountFlagPair Pair) Read()
        {
            _ = ReadName("QUERY_NAME_BEFORE"); uint control = ReadControl("QUERY_CONTROL_BEFORE");
            StandardAccountNet23 net = ReadNet("NET23_BEFORE"); StandardAccountFlagPair pair = StandardAccountFlagCodec.Pair(net.NetUserFlags, control);
            uint[] localAliases = Aliases(machine, "MACHINE_DIRECT_ALIASES"), builtinAliases = Aliases(builtin, "BUILTIN_DIRECT_ALIASES");
            StandardContract.Need(localAliases.Length == 0 && builtinAliases is { Length: 1 } && builtinAliases[0] == 545,
                "STANDARD_ACCOUNT_DIRECT_ALIAS_PROFILE_REFUSED");
            _ = ReadName("QUERY_NAME_AFTER"); uint afterControl = ReadControl("QUERY_CONTROL_AFTER");
            StandardAccountNet23 afterNet = ReadNet("NET23_AFTER");
            StandardContract.Need(afterControl == control && afterNet == net &&
                StandardAccountFlagCodec.Pair(afterNet.NetUserFlags, afterControl) == pair,
                "STANDARD_ACCOUNT_NATIVE_OBSERVATION_CHANGED");
            bool enabled = (net.NetUserFlags & StandardAccountFlagCodec.NetDisabled) == 0;
            // GroupsComplete means the complete DIRECT local-alias set from
            // both domains. No effective/transitive membership is asserted.
            // Actual standard-worker token admission independently excludes
            // Administrators, including filtered/indirect group membership.
            var snapshot = new StandardAccountSnapshot(StandardContract.AccountName, StandardContract.UserSid,
                "Local", enabled, net.NetUserFlags, true, Array.AsReadOnly(new[] { StandardContract.Users }));
            snapshot = StandardAccountRules.Snapshot(snapshot, enabled, baselineFlags);
            baselineFlags ??= snapshot.NetUserFlags; Gate("READ_COMPLETE"); return (snapshot, pair);
        }
        public StandardAccountSnapshot Inspect() => Perform(() => Read().Snapshot);
        public void SetNetUserFlags(uint expectedFlags, uint newFlags, Action verifyOriginalsAndAdmission) => Perform(() => {
            StandardContract.Need(verifyOriginalsAndAdmission is not null, "STANDARD_ACCOUNT_MUTATION_ADMISSION_MISSING");
            var before = Read(); StandardAccountFlagMutation mutation = StandardAccountFlagCodec.PlanDisabledOnly(before.Pair, expectedFlags, newFlags);
            Gate("MUTATION_ADMISSION:BEFORE"); verifyOriginalsAndAdmission(); Gate("MUTATION_ADMISSION:AFTER");
            var rechecked = Read(); StandardContract.Need(rechecked.Pair == before.Pair,
                "STANDARD_ACCOUNT_NATIVE_PRE_MUTATION_CHANGED");
            Live(user);
            // Read/validate/set/read on the same SAM object, NOT compare-and-
            // swap: another privileged actor can still change it between calls.
            Call("SET_CONTROL_DISABLED_ONLY", "SAM", () => owner.api.SetControl(user, mutation.TargetSamUserAccountControl), true);
            var after = Read(); _ = StandardAccountFlagCodec.VerifyReadback(mutation, after.Pair.NetUserFlags, after.Pair.SamUserAccountControl);
            Gate("MUTATION_READBACK_COMPLETE"); return 0;
        });
        private void CloseOne(StandardAccountSamHandle handle)
        {
            Live(handle); Gate("CLOSE_" + handle.Kind + ":BEFORE");
            StandardContract.Need(calls.Count < 2048, "STANDARD_ACCOUNT_NATIVE_TRACE_LIMIT"); handle.CloseEntered = true;
            uint status = owner.api.Close(handle); Record("CLOSE_" + handle.Kind, "SAM", status);
            if (status == 0) { handle.Closed = true; handle.Value = IntPtr.Zero; }
            Gate("CLOSE_" + handle.Kind + ":AFTER");
            if (status != 0) throw new StandardAccountNativeStatusException("CLOSE_" + handle.Kind, "SAM", status);
        }
        public void Dispose()
        {
            lock (sync) if (disposed && !busy) return;
            Perform(() => {
                var current = Read(); StandardContract.Need(!current.Snapshot.Enabled, "STANDARD_ACCOUNT_NATIVE_RELEASE_REQUIRES_DISABLED");
                CloseOne(user); CloseOne(builtin); CloseOne(machine); CloseOne(server); disposed = true;
                lock (retainedGate) { retained.Remove(this); retainedHere = false; } return 0;
            });
        }
        internal StandardAccountNativeEvidence Evidence()
        {
            lock (sync) return new(stage, faulted, retainedHere, mutationEntered, failureCategory, failureHResult,
                failureSamStatus, failureNetApiStatus,
                Array.AsReadOnly(calls.ToArray()), Array.AsReadOnly(new[] { server, machine, builtin, user }.Select(x =>
                    new StandardAccountNativeHandleState(x.Kind, unchecked((ulong)x.Value.ToInt64()).ToString("x16", CultureInfo.InvariantCulture), x.CloseEntered, x.Closed)).ToArray()));
        }
#if COMPILE_ONLY_STANDARD_ACCOUNT_NATIVE_V1
        internal void NativeBoundary(string value)
        {
            lock (sync) { StandardContract.Need(calls.Count < 2048, "STANDARD_ACCOUNT_NATIVE_TRACE_LIMIT"); Gate("NATIVE:" + value); }
        }
        internal void NativeStatus(string value, string apiName, uint status) { lock (sync) Record("NATIVE:" + value, apiName, status); }
#endif
    }

#if COMPILE_ONLY_STANDARD_ACCOUNT_NATIVE_V1
    // Construction does not call native APIs. There is no CLI that invokes it.
    // Local samlib exports are not the published Samr RPC ABI: compilation is
    // not proof of their compatibility on this host. Resolve/call failures are
    // retained failures; there is no fallback to a name-addressed writer.
    internal static StandardNativeAccountBackend CreateCompileOnly(StandardAccountContext context,
        IStandardAccountGuard guard, Func<DateTimeOffset> utcNow)
    {
        StandardNativeAccountBackend? backend = null;
        var native = new LocalSamApi(stage => {
            StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
                RuntimeInformation.OSArchitecture == Architecture.X64 && RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
                Environment.Version.ToString() == "10.0.11", "STANDARD_ACCOUNT_NATIVE_RUNTIME_REFUSED");
            RejectThreadImpersonation();
            backend!.lease!.NativeBoundary(stage);
            using var current = new SafeProcessHandle(GetCurrentProcess(), false);
            StandardWorkerChannelRules.OwnerToken(StandardTokenReader.Capture(current).Token);
            backend.lease.NativeBoundary("OWNER:" + stage);
            // The supplied custody callback runs after Capture, so Capture's
            // own no-impersonation checks do not close this last-callback gap.
            RejectThreadImpersonation();
        }, (stage, api, status) => backend!.lease!.NativeStatus(stage, api, status));
        backend = new(context, guard, utcNow, native); return backend;
    }
    private static void RejectThreadImpersonation()
    {
        using var thread = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(thread is null, "STANDARD_ACCOUNT_NATIVE_IMPERSONATION_REFUSED");
    }
    private sealed class LocalSamApi : IStandardAccountNativeApi
    {
        private sealed class Buffer { internal IntPtr Pointer; internal readonly bool Net; internal Buffer(bool net) { Net = net; } }
        // Live API instance is rooted by the retained lease before its calls.
        // An unparsed/failed-free buffer remains rooted; no finalizer frees it.
        private readonly List<Buffer> buffers = new();
        private readonly Action<string> gate;
        private readonly Action<string, string, uint> record;
        internal LocalSamApi(Action<string> gate, Action<string, string, uint> record) { this.gate = gate; this.record = record; }
        private Buffer NewBuffer(bool net) { StandardContract.Need(buffers.Count < 1024, "STANDARD_ACCOUNT_NATIVE_BUFFER_LIMIT"); var b = new Buffer(net); buffers.Add(b); return b; }
        private void Free(Buffer b, string stage)
        {
            StandardContract.Need(b.Pointer != IntPtr.Zero, "STANDARD_ACCOUNT_NATIVE_FREE_NULL"); gate(stage + ":BEFORE");
            uint status = b.Net ? NetApiBufferFree(b.Pointer) : SamFreeMemory(b.Pointer);
            record(stage, b.Net ? "NETAPI" : "SAM", status);
            if (status == 0) { b.Pointer = IntPtr.Zero; buffers.Remove(b); }
            gate(stage + ":AFTER"); if (status != 0) throw new StandardAccountNativeStatusException(stage, b.Net ? "NETAPI" : "SAM", status);
        }
        private byte[] ReadMemory(IntPtr pointer, int count)
        {
            StandardContract.Need(pointer.ToInt64() > 0 && count is > 0 and <= 1048576, "STANDARD_ACCOUNT_NATIVE_MEMORY_REFUSED");
            ulong address = checked((ulong)pointer.ToInt64()), end = checked(address + (uint)count), current = address;
            int pages = 0;
            while (current < end) {
                StandardContract.Need(++pages <= 256, "STANDARD_ACCOUNT_NATIVE_MEMORY_PAGE_LIMIT"); byte[] info = new byte[48];
                gate("VIRTUAL_QUERY:BEFORE"); nuint written = VirtualQuery(new IntPtr(checked((long)current)), info, (nuint)info.Length);
                int error = Marshal.GetLastWin32Error(); gate("VIRTUAL_QUERY:AFTER");
                if (written == 0) throw new Win32Exception(error);
                StandardContract.Need(written == 48, "STANDARD_ACCOUNT_NATIVE_MEMORY_QUERY_LAYOUT_REFUSED");
                ulong start = BinaryPrimitives.ReadUInt64LittleEndian(info), size = BinaryPrimitives.ReadUInt64LittleEndian(info.AsSpan(24));
                uint state = BinaryPrimitives.ReadUInt32LittleEndian(info.AsSpan(32)), protect = BinaryPrimitives.ReadUInt32LittleEndian(info.AsSpan(36));
                StandardContract.Need(start <= current && size > 0 && start <= ulong.MaxValue - size && start + size > current &&
                    state == 0x1000 && (protect & 0x100) == 0 && (protect & 0xff) is 2 or 4 or 8 or 0x20 or 0x40 or 0x80,
                    "STANDARD_ACCOUNT_NATIVE_MEMORY_ACCESS_REFUSED"); current = Math.Min(end, start + size);
            }
            byte[] bytes = new byte[count]; Marshal.Copy(pointer, bytes, 0, count); return bytes;
        }
        public uint ConnectLocal(uint access, StandardAccountSamHandle output)
        {
            StandardContract.Need(access == StandardAccountNativeLayout.ServerAccess && output.Value == IntPtr.Zero, "STANDARD_ACCOUNT_NATIVE_CONNECT_PROFILE_REFUSED");
            gate("SAM_CONNECT:BEFORE"); uint status = SamConnect(IntPtr.Zero, out output.Value, access, IntPtr.Zero);
            record("SAM_CONNECT", "SAM", status); gate("SAM_CONNECT:AFTER"); return status;
        }
        public uint OpenDomain(StandardAccountSamHandle server, string sid, uint access, StandardAccountSamHandle output)
        {
            StandardContract.Need(output.Value == IntPtr.Zero && ((sid == StandardAccountNativeLayout.MachineDomainSid && access == StandardAccountNativeLayout.MachineDomainAccess) ||
                (sid == StandardAccountNativeLayout.BuiltinDomainSid && access == StandardAccountNativeLayout.BuiltinDomainAccess)), "STANDARD_ACCOUNT_NATIVE_DOMAIN_PROFILE_REFUSED");
            byte[] bytes = StandardAccountNativeLayout.SidBytes(sid); gate("SAM_OPEN_DOMAIN:BEFORE");
            uint status = SamOpenDomain(server.Value, access, bytes, out output.Value);
            record("SAM_OPEN_DOMAIN", "SAM", status); gate("SAM_OPEN_DOMAIN:AFTER"); return status;
        }
        public uint OpenUser(StandardAccountSamHandle domain, uint rid, uint access, StandardAccountSamHandle output)
        {
            StandardContract.Need(rid == StandardAccountNativeLayout.Rid && access == StandardAccountNativeLayout.UserAccess && output.Value == IntPtr.Zero,
                "STANDARD_ACCOUNT_NATIVE_USER_PROFILE_REFUSED"); gate("SAM_OPEN_USER:BEFORE");
            uint status = SamOpenUser(domain.Value, access, rid, out output.Value);
            record("SAM_OPEN_USER", "SAM", status); gate("SAM_OPEN_USER:AFTER"); return status;
        }
        public uint QueryName(StandardAccountSamHandle user, out string? name)
        {
            name = null; Buffer b = NewBuffer(false); gate("SAM_QUERY_NAME:BEFORE");
            uint status = SamQueryInformationUser(user.Value, StandardAccountNativeLayout.AccountNameInformation, out b.Pointer);
            record("SAM_QUERY_NAME", "SAM", status); gate("SAM_QUERY_NAME:AFTER");
            if (status != 0) return status;
            byte[] header = ReadMemory(b.Pointer, 16); int length = StandardAccountNativeLayout.NameLength(header);
            IntPtr text = new(checked((long)BinaryPrimitives.ReadUInt64LittleEndian(header.AsSpan(8))));
            name = StandardAccountNativeLayout.Name(ReadMemory(text, length)); Free(b, "SAM_FREE_NAME"); return status;
        }
        public uint QueryControl(StandardAccountSamHandle user, out uint control)
        {
            control = 0; Buffer b = NewBuffer(false); gate("SAM_QUERY_CONTROL:BEFORE");
            uint status = SamQueryInformationUser(user.Value, StandardAccountNativeLayout.ControlInformation, out b.Pointer);
            record("SAM_QUERY_CONTROL", "SAM", status); gate("SAM_QUERY_CONTROL:AFTER");
            if (status != 0) return status;
            control = StandardAccountNativeLayout.Control(ReadMemory(b.Pointer, 4)); Free(b, "SAM_FREE_CONTROL"); return status;
        }
        public uint DirectAliasMembership(StandardAccountSamHandle domain, string exactSid, out uint[]? aliases)
        {
            aliases = null; StandardContract.Need(exactSid == StandardContract.UserSid, "STANDARD_ACCOUNT_NATIVE_ALIAS_SID_REFUSED");
            byte[] bytes = StandardAccountNativeLayout.SidBytes(exactSid); GCHandle pin = GCHandle.Alloc(bytes, GCHandleType.Pinned);
            try {
                Buffer b = NewBuffer(false); gate("SAM_DIRECT_ALIASES:BEFORE");
                uint status = SamGetAliasMembership(domain.Value, 1, new[] { pin.AddrOfPinnedObject() }, out uint count, out b.Pointer);
                record("SAM_DIRECT_ALIASES", "SAM", status); gate("SAM_DIRECT_ALIASES:AFTER"); if (status != 0) return status;
                StandardContract.Need(count <= 1024 && (count == 0 || b.Pointer != IntPtr.Zero), "STANDARD_ACCOUNT_NATIVE_ALIAS_COUNT_REFUSED");
                byte[] raw = count == 0 ? Array.Empty<byte>() : ReadMemory(b.Pointer, checked((int)count * 4));
                aliases = new uint[count]; for (int i = 0; i < aliases.Length; i++) aliases[i] = BinaryPrimitives.ReadUInt32LittleEndian(raw.AsSpan(i * 4));
                if (b.Pointer != IntPtr.Zero) Free(b, "SAM_FREE_ALIASES"); else buffers.Remove(b); return status;
            } finally { pin.Free(); }
        }
        public uint NetUserInfo23(string exactName, out StandardAccountNet23? value)
        {
            value = null; StandardContract.Need(exactName == StandardContract.AccountName, "STANDARD_ACCOUNT_NATIVE_NET_NAME_REFUSED");
            Buffer b = NewBuffer(true); gate("NET_USER_GET_INFO23:BEFORE");
            uint status = NetUserGetInfo(null, exactName, StandardAccountNativeLayout.NetInfoLevel, out b.Pointer);
            record("NET_USER_GET_INFO23", "NETAPI", status); gate("NET_USER_GET_INFO23:AFTER");
            if (status != 0) return status;
            StandardContract.Need(b.Pointer.ToInt64() > 0, "STANDARD_ACCOUNT_NATIVE_NET_NULL_BUFFER"); gate("NET_BUFFER_SIZE:BEFORE");
            uint sizeStatus = NetApiBufferSize(b.Pointer, out uint size);
            record("NET_BUFFER_SIZE", "NETAPI", sizeStatus); gate("NET_BUFFER_SIZE:AFTER");
            if (sizeStatus != 0) throw new StandardAccountNativeStatusException("NET_BUFFER_SIZE", "NETAPI", sizeStatus);
            StandardContract.Need(size is >= 40 and <= 1048576, "STANDARD_ACCOUNT_NATIVE_NET_BUFFER_SIZE_REFUSED");
            value = StandardAccountNativeLayout.Net23(ReadMemory(b.Pointer, (int)size), checked((ulong)b.Pointer.ToInt64()));
            Free(b, "NET_FREE_INFO23"); return status;
        }
        public uint SetControl(StandardAccountSamHandle user, uint control)
        {
            byte[] exact = StandardAccountNativeLayout.ControlBytes(control); uint value = BinaryPrimitives.ReadUInt32LittleEndian(exact);
            gate("SAM_SET_CONTROL:BEFORE"); uint status = SamSetInformationUser(user.Value, StandardAccountNativeLayout.ControlInformation, ref value);
            record("SAM_SET_CONTROL", "SAM", status); gate("SAM_SET_CONTROL:AFTER"); return status;
        }
        public uint Close(StandardAccountSamHandle handle)
        { gate("SAM_CLOSE:BEFORE"); uint status = SamCloseHandle(handle.Value); record("SAM_CLOSE", "SAM", status); gate("SAM_CLOSE:AFTER"); return status; }
    }
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamConnect(IntPtr serverName, out IntPtr server, uint access, IntPtr objectAttributes);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamOpenDomain(IntPtr server, uint access, [In] byte[] sid, out IntPtr domain);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamOpenUser(IntPtr domain, uint access, uint rid, out IntPtr user);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamQueryInformationUser(IntPtr user, int informationClass, out IntPtr buffer);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamGetAliasMembership(IntPtr domain, uint sidCount, [In] IntPtr[] sidArray, out uint count, out IntPtr aliases);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint SamSetInformationUser(IntPtr user, int informationClass, ref uint control);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)] private static extern uint SamCloseHandle(IntPtr handle);
    [DllImport("samlib.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)] private static extern uint SamFreeMemory(IntPtr buffer);
    [DllImport("netapi32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern uint NetUserGetInfo(string? server, string name, int level, out IntPtr buffer);
    [DllImport("netapi32.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)] private static extern uint NetApiBufferSize(IntPtr buffer, out uint size);
    [DllImport("netapi32.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)] private static extern uint NetApiBufferFree(IntPtr buffer);
    [DllImport("kernel32.dll", SetLastError = true, ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    private static extern nuint VirtualQuery(IntPtr address, [Out] byte[] information, nuint length);
    [DllImport("kernel32.dll", ExactSpelling = true)] [DefaultDllImportSearchPaths(DllImportSearchPath.System32)] private static extern IntPtr GetCurrentProcess();
#endif
}
