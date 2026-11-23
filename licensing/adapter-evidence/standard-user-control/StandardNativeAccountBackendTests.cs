using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardNativeAccountBackendTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero);
    private static string H(int value) => value.ToString("x").PadLeft(64, '0');
    private static StandardAccountContext Context() => new(new(StandardCryptoComparison.Schema, StandardContract.Root,
        "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2), StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
        H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8)), H(9), StandardInputCodec.Effects);
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.Administrators,
        1, 1, 2, "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    private sealed class World : IStandardAccountNativeApi, IStandardAccountGuard
    {
        internal readonly StandardAccountContext Context;
        internal readonly List<string> Events = new(), Guards = new();
        internal readonly Dictionary<string, StandardAccountSamHandle> Handles = new();
        internal StandardNativeAccountBackend? Instance;
        internal StandardToken Token = Owner();
        internal uint NetFlags = 0x203, SamFlags = 0x11;
        internal string SamName = StandardContract.AccountName, NetName = StandardContract.AccountName, NetSid = StandardContract.UserSid;
        internal uint[]? MachineAliases = Array.Empty<uint>(), BuiltinAliases = new uint[] { 545 };
        internal long Ticks;
        internal DateTimeOffset? FixedTime;
        internal int FailAt = -1, EnabledCalls, DisabledCalls;
        internal uint FailureStatus = 0xc0000022;
        internal bool ApplyFailedSet, WrongHandle, ZeroHandle, NetNull;
        internal Action<string>? BeforeApi, AfterApi, AtGuard;
        internal World(StandardAccountContext? context = null) { Context = context ?? StandardNativeAccountBackendTests.Context(); }
        internal DateTimeOffset Now() => FixedTime ?? Start.AddSeconds(10).AddTicks(Interlocked.Increment(ref Ticks));
        internal StandardNativeAccountBackend Backend() => Instance = new(Context, this, Now, this);
        private uint Hit(string stage, Action? effect = null)
        {
            BeforeApi?.Invoke(stage); int index = Events.Count; Events.Add(stage);
            uint status = index == FailAt ? FailureStatus : 0;
            if (status == 0 || ApplyFailedSet) effect?.Invoke(); AfterApi?.Invoke(stage); return status;
        }
        private void Bound(StandardAccountSamHandle handle, string kind)
        {
            StandardContract.Need(Handles.TryGetValue(kind, out var original) && ReferenceEquals(original, handle) &&
                handle.Value != IntPtr.Zero && !handle.Closed, "FAKE_SAM_HANDLE_NOT_ORIGINAL");
        }
        private uint Open(string stage, StandardAccountSamHandle output, long value)
        {
            Handles.Add(output.Kind, output); uint status = Hit(stage);
            // A failing call can still leave an output that must remain rooted.
            output.Value = ZeroHandle ? IntPtr.Zero : new IntPtr(WrongHandle ? 100 : value); return status;
        }
        public uint ConnectLocal(uint access, StandardAccountSamHandle output)
        {
            StandardContract.Need(access == 0x21 && output.Kind == "SERVER", "FAKE_SERVER_PROFILE"); return Open("connect", output, 100);
        }
        public uint OpenDomain(StandardAccountSamHandle server, string sid, uint access, StandardAccountSamHandle output)
        {
            Bound(server, "SERVER"); bool machine = sid == StandardAccountNativeLayout.MachineDomainSid;
            StandardContract.Need((machine && access == 0x280 && output.Kind == "MACHINE_DOMAIN") ||
                (sid == "S-1-5-32" && access == 0x80 && output.Kind == "BUILTIN_DOMAIN"), "FAKE_DOMAIN_PROFILE");
            return Open(machine ? "open-machine" : "open-builtin", output, machine ? 101 : 102);
        }
        public uint OpenUser(StandardAccountSamHandle domain, uint rid, uint access, StandardAccountSamHandle output)
        {
            Bound(domain, "MACHINE_DOMAIN"); StandardContract.Need(rid == 1023 && access == 0x31 && output.Kind == "USER", "FAKE_USER_PROFILE");
            return Open("open-user", output, 103);
        }
        public uint QueryName(StandardAccountSamHandle user, out string? name)
        { Bound(user, "USER"); uint status = Hit("name"); name = SamName; return status; }
        public uint QueryControl(StandardAccountSamHandle user, out uint control)
        { Bound(user, "USER"); uint status = Hit("control"); control = SamFlags; return status; }
        public uint DirectAliasMembership(StandardAccountSamHandle domain, string sid, out uint[]? aliases)
        {
            bool machine = domain.Kind == "MACHINE_DOMAIN"; Bound(domain, machine ? "MACHINE_DOMAIN" : "BUILTIN_DOMAIN");
            StandardContract.Need(sid == StandardContract.UserSid, "FAKE_ALIAS_SID"); uint status = Hit(machine ? "aliases-machine" : "aliases-builtin");
            aliases = machine ? MachineAliases : BuiltinAliases; return status;
        }
        public uint NetUserInfo23(string name, out StandardAccountNet23? value)
        {
            StandardContract.Need(name == StandardContract.AccountName, "FAKE_NET_NAME"); uint status = Hit("net23");
            value = NetNull ? null : new(NetName, NetSid, NetFlags); return status;
        }
        public uint SetControl(StandardAccountSamHandle user, uint control)
        {
            Bound(user, "USER"); StandardContract.Need((control ^ SamFlags) == 1, "FAKE_ONLY_DISABLE_CONTROL");
            return Hit("set", () => {
                SamFlags = control; NetFlags ^= 2; if ((control & 1) == 0) EnabledCalls++; else DisabledCalls++;
            });
        }
        public uint Close(StandardAccountSamHandle handle) { Bound(handle, handle.Kind); return Hit("close-" + handle.Kind); }
        public StandardToken CaptureOwnerAndVerifyCustody(StandardAccountContext context, string stage)
        { StandardContract.Need(context == Context, "FAKE_ACCOUNT_CONTEXT_CHANGED"); Guards.Add(stage); AtGuard?.Invoke(stage); return Token; }
        public void VerifyBeforeActivation(StandardAccountContext context) => throw new InvalidOperationException("BACKEND_MUST_NOT_SUBSTITUTE_LIFECYCLE_ACTIVATION_GUARD");
        public void VerifyBeforeReturnDisabled(StandardAccountContext context) => throw new InvalidOperationException("BACKEND_MUST_NOT_SUBSTITUTE_LIFECYCLE_EXIT_GUARD");
    }
    private static byte[] NetBytes(uint flags = 0x203)
    {
        byte[] name = Encoding.Unicode.GetBytes(StandardContract.AccountName + "\0"), sid = StandardAccountNativeLayout.SidBytes(StandardContract.UserSid);
        int sidOffset = (40 + name.Length + 3) & ~3; byte[] bytes = new byte[sidOffset + sid.Length];
        BinaryPrimitives.WriteUInt64LittleEndian(bytes, 0x1000 + 40);
        BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(32), (ulong)(0x1000 + sidOffset));
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(24), flags); name.CopyTo(bytes, 40); sid.CopyTo(bytes, sidOffset); return bytes;
    }
    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) { StandardContract.Need(condition, "STANDARD_NATIVE_ACCOUNT_TEST_FAILED_" + cases); cases++; }
        void Refused(Action operation, string? category = null) {
            bool refused = false; try { operation(); } catch (InvalidDataException error) { refused = category is null || error.Message == category; } Check(refused);
        }
        void NativeRefused(Action operation, uint status, string api) {
            bool refused = false; try { operation(); } catch (StandardAccountNativeStatusException error) {
                refused = error.RawStatus == status && error.Api == api && error.HResult != unchecked((int)status);
            } Check(refused);
        }
        Check(StandardAccountNativeLayout.MachineDomainSid + "-1023" == StandardContract.UserSid);
        Check(StandardAccountNativeLayout.ServerAccess == 0x21 && StandardAccountNativeLayout.MachineDomainAccess == 0x280 &&
            StandardAccountNativeLayout.BuiltinDomainAccess == 0x80 && StandardAccountNativeLayout.UserAccess == 0x31);
        Check(StandardAccountNativeLayout.AccountNameInformation == 7 && StandardAccountNativeLayout.ControlInformation == 16 && StandardAccountNativeLayout.NetInfoLevel == 23);
        foreach (uint flags in new uint[] { 0x202, 0x203, 0x10202, 0x10203 }) {
            var w = new World { NetFlags = flags, SamFlags = StandardAccountFlagCodec.EncodeNetObservation(flags).SamUserAccountControl };
            var backend = w.Backend(); Check(backend.Evidence() is null); int admissions = 0;
            var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => admissions++);
            Check(admissions == 1 && w.Handles.Count == 4 && backend.Evidence()!.Retained);
            Check(lease.Inspect().NetUserFlags == flags && !lease.Inspect().Enabled);
            lease.SetNetUserFlags(flags, flags & ~2u, () => admissions++);
            Check(w.EnabledCalls == 1 && w.DisabledCalls == 0 && lease.Inspect().Enabled && admissions == 2);
            Check(lease.Inspect().NetUserFlags == (flags & ~2u));
            lease.SetNetUserFlags(flags & ~2u, flags, () => admissions++);
            Check(w.DisabledCalls == 1 && lease.Inspect().NetUserFlags == flags && admissions == 3);
            lease.Dispose(); var evidence = backend.Evidence()!;
            Check(!evidence.Faulted && !evidence.Retained && evidence.MutationCallEntered && evidence.ManagedFailureHResult is null);
            Check(evidence.Handles.All(x => x.Closed && x.CloseEntered && x.ValueHex == "0000000000000000"));
            Check(w.Events.TakeLast(4).SequenceEqual(new[] { "close-USER", "close-BUILTIN_DOMAIN", "close-MACHINE_DOMAIN", "close-SERVER" }));
            Check(evidence.Calls.All(x => x.RawStatus == 0) && w.Events.Count == evidence.Calls.Count);
            int count = w.Events.Count; lease.Dispose(); Check(count == w.Events.Count);
            Refused(() => lease.Inspect()); Refused(() => lease.SetNetUserFlags(flags, flags & ~2u, () => { }));
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { })); Check(w.Events.Count == count);
        }
        // Every native-API boundary in the success sequence can fail, including
        // a setter that changed the account before returning a failure status.
        var sequence = new World(); var sequenceBackend = sequence.Backend(); var sequenceLease = sequenceBackend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
        sequenceLease.SetNetUserFlags(0x203, 0x201, () => { }); sequenceLease.SetNetUserFlags(0x201, 0x203, () => { }); sequenceLease.Dispose();
        for (int failAt = 0; failAt < sequence.Events.Count; failAt++) {
            uint raw = sequence.Events[failAt] == "net23" ? 2221u : 0xc0000022u;
            var w = new World { FailAt = failAt, FailureStatus = raw, ApplyFailedSet = true }; var backend = w.Backend();
            IStandardOwnedAccountLease? lease = null;
            NativeRefused(() => {
                lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
                lease.SetNetUserFlags(0x203, 0x201, () => { }); lease.SetNetUserFlags(0x201, 0x203, () => { }); lease.Dispose();
            }, raw, sequence.Events[failAt] == "net23" ? "NETAPI" : "SAM");
            var evidence = backend.Evidence()!;
            Check(evidence.Faulted && evidence.Retained && evidence.ManagedFailureCategory == nameof(StandardAccountNativeStatusException));
            Check(evidence.ManagedFailureHResult.HasValue && evidence.Calls[^1].RawStatus == raw);
            Check(sequence.Events[failAt] == "net23" ? evidence.FailureNetApiStatus == raw && evidence.FailureSamStatus is null :
                evidence.FailureSamStatus == raw && evidence.FailureNetApiStatus is null);
            Check(w.Events.Count == failAt + 1 && evidence.Handles.Count == 4);
            if (failAt < 4) Check(evidence.Handles.Count(x => x.ValueHex != "0000000000000000") == failAt + 1);
            int count = w.Events.Count; if (lease is not null) { Refused(() => lease.Inspect()); Refused(() => lease.Dispose()); }
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { })); Check(w.Events.Count == count);
        }
        // Losing admission before OR after any boundary must stop the sequence.
        // Returned statuses and populated/closed output slots remain observable;
        // no guard failure authorizes an automatic disable or cleanup attempt.
        for (int failAt = 0; failAt < sequence.Guards.Count; failAt++) {
            var w = new World(); var backend = w.Backend();
            w.AtGuard = _ => { if (w.Guards.Count - 1 == failAt) throw new InvalidDataException("FAKE_NATIVE_ACCOUNT_GUARD_LOST"); };
            IStandardOwnedAccountLease? lease = null;
            Refused(() => {
                lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
                lease.SetNetUserFlags(0x203, 0x201, () => { }); lease.SetNetUserFlags(0x201, 0x203, () => { }); lease.Dispose();
            }, "FAKE_NATIVE_ACCOUNT_GUARD_LOST");
            var evidence = backend.Evidence()!;
            Check(evidence.Retained && evidence.Faulted && evidence.ManagedFailureCategory == nameof(InvalidDataException));
            Check(evidence.FailureSamStatus is null && evidence.FailureNetApiStatus is null && evidence.Calls.All(x => x.RawStatus == 0));
            Check(w.Guards.Count == failAt + 1 && evidence.Calls.Count == w.Events.Count);
            int count = w.Events.Count;
            if (lease is not null) { Refused(() => lease.Inspect()); Refused(() => lease.Dispose()); }
            Check(w.Events.Count == count);
        }
        foreach (uint raw in new uint[] { 1, 0x105, 0x80000005, 0xc0000008, uint.MaxValue }) {
            var w = new World { FailAt = 0, FailureStatus = raw }; var backend = w.Backend();
            NativeRefused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { }), raw, "SAM");
            Check(backend.Evidence()!.FailureSamStatus == raw && w.Events.Count == 1);
        }
        Action<World>[] badProfiles = {
            w => w.SamName = StandardContract.AccountName.ToUpperInvariant(), w => w.SamName += " ",
            w => w.NetName += "x", w => w.NetSid = StandardContract.OwnerSid, w => w.NetNull = true,
            w => w.SamFlags = 0x411, w => w.NetFlags |= 0x10, w => w.SamFlags ^= 1,
            w => { w.SamFlags &= ~1u; w.NetFlags &= ~2u; }, w => w.MachineAliases = new uint[] { 1001 },
            w => w.BuiltinAliases = Array.Empty<uint>(), w => w.BuiltinAliases = new uint[] { 544 },
            w => w.BuiltinAliases = new uint[] { 545, 544 }, w => w.BuiltinAliases = new uint[] { 545, 545 },
            w => w.MachineAliases = null, w => w.BuiltinAliases = null,
            w => w.BuiltinAliases = new uint[] { 0 }, w => w.BuiltinAliases = new uint[1025],
            w => w.WrongHandle = true, w => w.ZeroHandle = true
        };
        foreach (var corrupt in badProfiles) {
            var w = new World(); corrupt(w); var backend = w.Backend();
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { }));
            Check(w.EnabledCalls == 0 && !w.Events.Any(x => x.StartsWith("close-", StringComparison.Ordinal)) && backend.Evidence()!.Retained);
        }
        Func<StandardToken, StandardToken>[] badOwners = {
            t => t with { User = StandardContract.UserSid }, t => t with { Owner = StandardContract.UserSid },
            t => t with { Type = 2 }, t => t with { Elevation = 0 }, t => t with { ElevationType = 3 },
            t => t with { IntegritySid = StandardContract.MediumIntegrity }, t => t with { HasRestrictions = true },
            t => t with { AppContainer = true }, t => t with { QueryComplete = false }, t => t with { Groups = Array.Empty<StandardGroup>() }
        };
        foreach (var corrupt in badOwners) {
            var w = new World { Token = corrupt(Owner()) }; var backend = w.Backend();
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { })); Check(w.Events.Count == 0 && backend.Evidence()!.Retained);
        }
        foreach (DateTimeOffset time in new[] { Start.AddTicks(-1), Start.AddHours(2), Start.AddHours(3), Start.ToOffset(TimeSpan.FromHours(1)) }) {
            var w = new World { FixedTime = time }; var backend = w.Backend();
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { })); Check(w.Events.Count == 0);
        }
        {
            var w = new World(); var backend = w.Backend(); Refused(() => backend.OpenOwnedLocalSid(StandardContract.OwnerSid, () => { }));
            Check(backend.Evidence() is null && w.Events.Count == 0);
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid, null!)); Check(backend.Evidence() is null);
        }
        foreach (uint target in new uint[] { 0x203, 0x200, 0x10201, 0x201 | 0x10, 0x1 }) {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            Refused(() => lease.SetNetUserFlags(0x203, target, () => { })); Check(w.EnabledCalls == 0 && backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            Refused(() => lease.SetNetUserFlags(0x202, 0x200, () => { })); Check(w.EnabledCalls == 0);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            Refused(() => lease.SetNetUserFlags(0x203, 0x201, () => { w.NetFlags ^= 1; })); Check(w.EnabledCalls == 0);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            w.AfterApi = stage => { if (stage == "set") w.NetFlags ^= 1; };
            Refused(() => lease.SetNetUserFlags(0x203, 0x201, () => { }));
            Check(w.EnabledCalls == 1 && backend.Evidence()!.MutationCallEntered && backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            w.Handles["USER"].Value = new IntPtr(999); int count = w.Events.Count;
            Refused(() => lease.Inspect()); Check(w.Events.Count == count && backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend();
            Refused(() => backend.OpenOwnedLocalSid(StandardContract.UserSid,
                () => backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { })));
            Check(w.Events.Count == 0 && backend.Evidence()!.Faulted);
        }
        foreach (bool dispose in new[] { false, true }) {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { }); int count = w.Events.Count;
            w.AtGuard = stage => { if (stage == "QUERY_NAME_BEFORE:BEFORE") { if (dispose) lease.Dispose(); else lease.Inspect(); } };
            Refused(() => lease.Inspect()); Check(w.Events.Count == count && backend.Evidence()!.Faulted && backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            Refused(() => lease.SetNetUserFlags(0x203, 0x201, () => lease.Dispose())); Check(w.EnabledCalls == 0);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            lease.SetNetUserFlags(0x203, 0x201, () => { }); Refused(() => lease.Dispose());
            Check(!w.Events.Any(x => x.StartsWith("close-", StringComparison.Ordinal)) && backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            w.AtGuard = stage => { if (stage == "QUERY_CONTROL_BEFORE:AFTER") w.FixedTime = Start.AddSeconds(1); };
            Refused(() => lease.Inspect()); Check(backend.Evidence()!.Retained);
        }
        {
            var w = new World(); var backend = w.Backend(); var lease = backend.OpenOwnedLocalSid(StandardContract.UserSid, () => { });
            using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            int paused = 0;
            w.BeforeApi = stage => { if (stage == "name" && Interlocked.CompareExchange(ref paused, 1, 0) == 0) {
                entered.Set(); StandardContract.Need(release.Wait(5000), "FAKE_ACCOUNT_SERIALIZATION_TIMEOUT");
            } };
            Task inspect = Task.Run(() => lease.Inspect()); Check(entered.Wait(5000));
            Task dispose = Task.Run(() => lease.Dispose()); Check(!dispose.Wait(30)); release.Set();
            Check(Task.WaitAll(new[] { inspect, dispose }, 5000)); Check(backend.Evidence()!.Handles.All(x => x.Closed));
        }

        // Managed buffer/layout checks only. The native SAM/NetAPI methods and
        // native factory are never invoked, including in compile-only variants.
        byte[] original = NetBytes(); StandardAccountNet23 parsed = StandardAccountNativeLayout.Net23(original, 0x1000);
        Check(parsed == new StandardAccountNet23(StandardContract.AccountName, StandardContract.UserSid, 0x203));
        original[24] = 0; Check(parsed.NetUserFlags == 0x203);
        foreach (uint flags in new uint[] { 0x200, 0x201, 0x202, 0x203, 0x10200, 0x10201, 0x10202, 0x10203 })
            Check(StandardAccountNativeLayout.Net23(NetBytes(flags), 0x1000).NetUserFlags == flags);
        foreach (uint flags in new uint[] { 0x10, 0x11, 0x210, 0x211 }) {
            byte[] control = StandardAccountNativeLayout.ControlBytes(flags); Check(control.Length == 4 && control[0] == (byte)flags && control[1] == (byte)(flags >> 8));
            Check(StandardAccountNativeLayout.Control(control) == flags);
        }
        foreach (int length in new[] { 0, 1, 2, 3, 5, 16 }) Refused(() => StandardAccountNativeLayout.Control(new byte[length]));
        Refused(() => StandardAccountNativeLayout.Control(null)); Refused(() => StandardAccountNativeLayout.ControlBytes(0x411));
        byte[] header = new byte[16]; BinaryPrimitives.WriteUInt16LittleEndian(header, 28); BinaryPrimitives.WriteUInt16LittleEndian(header.AsSpan(2), 30);
        BinaryPrimitives.WriteUInt64LittleEndian(header.AsSpan(8), 0x2000); Check(StandardAccountNativeLayout.NameLength(header) == 28);
        foreach (int length in new[] { 0, 1, 27, 513, 514, 65535 }) {
            byte[] invalid = (byte[])header.Clone(); BinaryPrimitives.WriteUInt16LittleEndian(invalid, checked((ushort)length));
            Refused(() => StandardAccountNativeLayout.NameLength(invalid));
        }
        foreach (int maximum in new[] { 0, 27, 29, 4097, 65535 }) {
            byte[] invalid = (byte[])header.Clone(); BinaryPrimitives.WriteUInt16LittleEndian(invalid.AsSpan(2), checked((ushort)maximum));
            Refused(() => StandardAccountNativeLayout.NameLength(invalid));
        }
        { byte[] invalid = (byte[])header.Clone(); Array.Clear(invalid, 8, 8); Refused(() => StandardAccountNativeLayout.NameLength(invalid)); }
        Refused(() => StandardAccountNativeLayout.NameLength(new byte[15])); Refused(() => StandardAccountNativeLayout.NameLength(null));
        Check(StandardAccountNativeLayout.Name(Encoding.Unicode.GetBytes(StandardContract.AccountName)) == StandardContract.AccountName);
        Refused(() => StandardAccountNativeLayout.Name(new byte[] { 0, 0xd8 })); Refused(() => StandardAccountNativeLayout.Name(Encoding.Unicode.GetBytes(StandardContract.AccountName + "\0")));
        Check(StandardAccountNativeLayout.SidBytes(StandardContract.UserSid).Length == 28);
        Check(StandardAccountNativeLayout.SidBytes(StandardAccountNativeLayout.MachineDomainSid).Length == 24);
        Check(StandardAccountNativeLayout.SidBytes("S-1-5-32").SequenceEqual(new byte[] { 1, 1, 0, 0, 0, 0, 0, 5, 32, 0, 0, 0 }));
        foreach (string bad in new[] { "S-1-05-32", "S-1-5-032", "S-2-5-32", "S-1-281474976710656-1", "S-1-5-4294967296" })
            Refused(() => StandardAccountNativeLayout.SidBytes(bad));
        foreach (int pointerOffset in new[] { 0, 32 }) foreach (ulong pointer in new ulong[] { 0, 1, 0x1000, 0x1027, 0x1001, 0x1000 + 1048576, ulong.MaxValue }) {
            byte[] invalid = NetBytes(); BinaryPrimitives.WriteUInt64LittleEndian(invalid.AsSpan(pointerOffset), pointer);
            Refused(() => StandardAccountNativeLayout.Net23(invalid, 0x1000));
        }
        foreach (ulong address in new ulong[] { 0, 1, 0x1001, ulong.MaxValue }) Refused(() => StandardAccountNativeLayout.Net23(NetBytes(), address));
        foreach (int length in new[] { 0, 1, 39, 40, 41, 1048577 }) Refused(() => StandardAccountNativeLayout.Net23(new byte[length], 0x1000));
        Refused(() => StandardAccountNativeLayout.Net23(null, 0x1000));
        for (int bit = 0; bit < 32; bit++) if (((1u << bit) & 0x10203) == 0)
            Refused(() => StandardAccountNativeLayout.Net23(NetBytes(0x203 | (1u << bit)), 0x1000));
        {
            byte[] invalid = NetBytes(); int sidOffset = (int)(BinaryPrimitives.ReadUInt64LittleEndian(invalid.AsSpan(32)) - 0x1000);
            invalid[sidOffset + 1] = 15; Refused(() => StandardAccountNativeLayout.Net23(invalid, 0x1000));
            invalid = NetBytes(); invalid[sidOffset] = 2; Refused(() => StandardAccountNativeLayout.Net23(invalid, 0x1000));
            invalid = NetBytes(); invalid[^1] ^= 1; Refused(() => StandardAccountNativeLayout.Net23(invalid, 0x1000));
        }
        return cases;
    }
}
