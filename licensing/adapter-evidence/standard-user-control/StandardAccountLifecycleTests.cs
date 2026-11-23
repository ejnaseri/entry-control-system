using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardAccountLifecycleTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero);
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static StandardAccountContext Context() => new(new(StandardCryptoComparison.Schema, StandardContract.Root,
        "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2), StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
        H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8)), H(9), StandardInputCodec.Effects);
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.Administrators,
        1, 1, 2, "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    // Exact public ownership originals; no password/credential is present.
    private static byte[] Owned() => Encoding.UTF8.GetBytes("""{"schemaVersion":1,"scope":"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1","attemptId":"838384fa60a04a3385a8d83e18342cd7","planSha256":"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b","utc":"2026-11-02T13:11:36.1714952+00:00","payload":{"name":"EcsLic008W03V1","sid":"S-1-5-21-3058020570-171625005-1532683838-1023","createdDisabled":true}}""");
    private static byte[] Complete() => Encoding.UTF8.GetBytes("""{"schemaVersion":1,"scope":"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1","attemptId":"838384fa60a04a3385a8d83e18342cd7","planSha256":"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b","utc":"2026-11-02T13:11:37.4544800+00:00","payload":{"name":"EcsLic008W03V1","sid":"S-1-5-21-3058020570-171625005-1532683838-1023","enabled":false,"principalSource":"Local","groupsComplete":true,"localGroupSids":["S-1-5-32-545"]}}""");
    private static StandardAccountSnapshot Snapshot() => new(StandardContract.AccountName, StandardContract.UserSid,
        "Local", false, 0x203, true, new[] { "S-1-5-32-545" });

    private sealed class World : IStandardDurableRecordSink, IStandardAccountBackend, IStandardAccountGuard, IStandardOwnedAccountLease
    {
        internal readonly StandardAccountContext Context;
        internal readonly List<string> Events = new();
        internal readonly Dictionary<StandardStoreFile, byte[]> Files = new() {
            [StandardStoreFile.AccountOwned] = Owned(), [StandardStoreFile.AccountComplete] = Complete() };
        internal StandardAccountSnapshot Actual = Snapshot();
        internal bool Disposed, InsideMutation, ExitAdmitted = true;
        internal int EnabledCalls, DisabledCalls, OpenCalls, FailAt = -1;
        internal long Ticks;
        internal DateTimeOffset? FixedTime;
        internal Func<StandardToken> OwnerSupplier = Owner;
        internal Func<string, Exception?>? Fault;
        internal Action<string>? At;
        internal Func<StandardAccountSnapshot, StandardAccountSnapshot> ChangeSnapshot = x => x;
        internal Func<StandardStoreFile, byte[], byte[]> ChangeRead = (_, b) => b;
        internal Func<StandardStoreReceipt, StandardStoreReceipt> ChangeReceipt = x => x;
        internal World(StandardAccountContext? context = null) { Context = context ?? StandardAccountLifecycleTests.Context(); }
        internal DateTimeOffset Now() => FixedTime ?? Start.AddSeconds(10).AddTicks(++Ticks);
        internal void Hit(string point) {
            Events.Add(point); At?.Invoke(point);
            if (Events.Count - 1 == FailAt) throw new IOException("FAKE_ACCOUNT_BOUNDARY");
            Exception? error = Fault?.Invoke(point); if (error is not null) throw error;
        }
        internal StandardAccountLifecycle Lifecycle() => new(Context, this, this, this, Now);
        public StandardToken CaptureOwnerAndVerifyCustody(StandardAccountContext context, string stage) {
            Hit("guard:" + stage); return OwnerSupplier();
        }
        public void VerifyBeforeActivation(StandardAccountContext context) { Hit("pre-activation"); }
        public void VerifyBeforeReturnDisabled(StandardAccountContext context) {
            Hit("held-exit"); StandardContract.Need(ExitAdmitted, "FAKE_HELD_CHILD_EXIT_MISSING");
        }
        public IStandardOwnedAccountLease OpenOwnedLocalSid(string sid, Action admission) {
            admission(); Hit("open-owned"); StandardContract.Need(sid == StandardContract.UserSid, "FAKE_UNOWNED_SID"); OpenCalls++; return this;
        }
        public StandardAccountSnapshot Inspect() {
            Hit("inspect"); StandardContract.Need(!Disposed && !InsideMutation, "FAKE_CLOSED_OR_REENTERED_ACCOUNT"); return ChangeSnapshot(Actual);
        }
        public void SetNetUserFlags(uint expectedFlags, uint newFlags, Action admission) {
            InsideMutation = true;
            try { admission(); Hit("set-before"); }
            finally { InsideMutation = false; }
            StandardContract.Need(!Disposed && Actual.NetUserFlags == expectedFlags && (expectedFlags ^ newFlags) == 2,
                "FAKE_NOT_DISABLED_BIT_ONLY");
            bool enabled = (newFlags & 2) == 0;
            StandardContract.Need(Files.ContainsKey(enabled ? StandardStoreFile.AccountActivationIntent : StandardStoreFile.AccountDisableIntent),
                "FAKE_ACCOUNT_EFFECT_WITHOUT_INTENT");
            if (enabled) EnabledCalls++; else DisabledCalls++;
            Actual = Actual with { NetUserFlags = newFlags, Enabled = enabled }; Hit("set-after");
        }
        public void Dispose() { Hit("dispose"); Disposed = true; }
        public StandardStoreReceipt WriteNew(StandardStoreFile file, byte[] originalUtf8) {
            Hit("write:" + file); StandardContract.Need(Files.TryAdd(file, (byte[])originalUtf8.Clone()), "FAKE_CREATE_NEW_REFUSED");
            DateTimeOffset written = Now();
            return ChangeReceipt(new StandardStoreReceipt(Context.Scope, file, StandardNativeCryptoRules.Hash(originalUtf8), originalUtf8.Length,
                written, 42, (ulong)Files.Count, true, true, true, true) { CreationFileTimeUtc = written.UtcDateTime.ToFileTimeUtc() });
        }
        public byte[] Read(StandardStoreFile file) {
            Hit("read:" + file); return ChangeRead(file, (byte[])Files[file].Clone());
        }
    }

    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) { StandardContract.Need(condition, "STANDARD_ACCOUNT_TEST_FAILED_" + cases); cases++; }
        void Refused(Action action) { bool refused = false; try { action(); } catch (InvalidDataException) { refused = true; } Check(refused); }
        Check(StandardNativeCryptoRules.Hash(Owned()) == StandardContract.AccountOwnedSha256);
        Check(StandardNativeCryptoRules.Hash(Complete()) == StandardContract.AccountCompleteSha256);
        var baseline = new World(); var lifecycle = baseline.Lifecycle();
        Refused(() => lifecycle.ReturnDisabled()); Check(baseline.Events.Count == 0);
        var active = lifecycle.Activate();
        Check(active.Outcome == "OWNED_ACCOUNT_ACTIVATION_RECORDED" && active.Failure is null && active.Observed!.Enabled);
        Check(active.Originals.Count == 2 && baseline.EnabledCalls == 1 && baseline.DisabledCalls == 0 && !baseline.Disposed);
        Check(!active.NativeExecutionProven && !active.LogonProven && !active.SessionsEndedProven && !active.Lic008Closed && !active.SecurityAccepted && !active.ProductionAccepted);
        Refused(() => lifecycle.Activate());
        var completed = lifecycle.ReturnDisabled();
        Check(completed.Outcome == "OWNED_ACCOUNT_RETURN_DISABLED_RECORDED" && completed.Failure is null && !completed.Observed!.Enabled);
        Check(baseline.EnabledCalls == 1 && baseline.DisabledCalls == 1 && baseline.Disposed && completed.Originals.Count == 4);
        Check(completed.Originals.Select(x => x.Record.Kind).SequenceEqual(new[] { "ACTIVATION_INTENT", "ACTIVATED", "DISABLE_INTENT", "DISABLED" }));
        Check(completed.Originals[0].Record.PreviousSha256 is null);
        for (int i = 1; i < 4; i++) Check(completed.Originals[i].Record.PreviousSha256 == completed.Originals[i - 1].OriginalSha256);
        foreach (var original in completed.Originals) {
            Check(original.Record.Context == baseline.Context && original.Receipt.ExactReadback && original.Receipt.DurablyFlushed && original.Receipt.CreateNew);
            Check(StandardStoreRules.AccountRecord(original.File) && StandardStoreRules.CanWrite(StandardStoreRole.Owner, original.File));
            Check(!StandardStoreRules.CanRead(StandardStoreRole.Setup, original.File) && !StandardStoreRules.CanWrite(StandardStoreRole.Setup, original.File));
        }
        Refused(() => lifecycle.ReturnDisabled()); Refused(() => lifecycle.Activate());
        // Refuse every operation boundary from a successful complete trace.
        // Failures never synthesize a compensating disable or close the lease.
        for (int boundary = 0; boundary < baseline.Events.Count; boundary++) {
            var failed = new World { FailAt = boundary }; var current = failed.Lifecycle(); var result = current.Activate();
            if (result.Failure is null) result = current.ReturnDisabled();
            Check(result.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && result.Failure is not null);
            Check(failed.EnabledCalls <= 1 && failed.DisabledCalls <= 1);
            Check(!failed.Disposed);
            if (failed.DisabledCalls > 0) Check(failed.Files.ContainsKey(StandardStoreFile.AccountDisableIntent));
            if (failed.EnabledCalls > 0) Check(failed.Files.ContainsKey(StandardStoreFile.AccountActivationIntent));
            Refused(() => current.Activate()); Refused(() => current.ReturnDisabled());
        }
        foreach (var change in new Func<StandardAccountSnapshot, StandardAccountSnapshot>[] {
            s => s with { Name = "Other" }, s => s with { Sid = StandardContract.OwnerSid }, s => s with { PrincipalSource = "ActiveDirectory" },
            s => s with { Enabled = true }, s => s with { GroupsComplete = false }, s => s with { LocalGroupSids = Array.Empty<string>() },
            s => s with { LocalGroupSids = new[] { StandardContract.Administrators } },
            s => s with { LocalGroupSids = new[] { "S-1-5-32-545", "S-1-5-32-545" } },
            s => s with { NetUserFlags = 0x201 }, s => s with { NetUserFlags = 3 }, s => s with { NetUserFlags = 0x223 },
            s => s with { NetUserFlags = uint.MaxValue }
        }) {
            var wrong = new World { ChangeSnapshot = change }; var result = wrong.Lifecycle().Activate();
            Check(result.Failure is not null && wrong.EnabledCalls == 0 && wrong.DisabledCalls == 0 && !wrong.Disposed);
        }
        foreach (var token in new[] { Owner() with { User = StandardContract.UserSid }, Owner() with { Type = 2 },
            Owner() with { Elevation = 0 }, Owner() with { ElevationType = 3 }, Owner() with { IntegritySid = "S-1-16-8192" },
            Owner() with { HasRestrictions = true }, Owner() with { QueryComplete = false }, Owner() with { AppContainer = true },
            Owner() with { Groups = Array.Empty<StandardGroup>() } }) {
            var wrong = new World { OwnerSupplier = () => token }; Check(wrong.Lifecycle().Activate().Failure is not null && wrong.OpenCalls == 0);
        }
        foreach (var file in new[] { StandardStoreFile.AccountOwned, StandardStoreFile.AccountComplete }) {
            var changed = new World { ChangeRead = (f, bytes) => { if (f == file) bytes[^1] ^= 1; return bytes; } };
            Check(changed.Lifecycle().Activate().Failure is not null && changed.OpenCalls == 0 && changed.EnabledCalls == 0);
        }
        foreach (var change in new Func<StandardStoreReceipt, StandardStoreReceipt>[] {
            r => r with { Scope = r.Scope with { PlanSha256 = H(90) } }, r => r with { File = StandardStoreFile.ControllerResult },
            r => r with { Sha256 = H(91) }, r => r with { Length = r.Length + 1 }, r => r with { WrittenUtc = Start },
            r => r with { WrittenUtc = Start.AddHours(3) }, r => r with { VolumeSerial = 0 }, r => r with { FileIndex = 0 },
            r => r with { CreationFileTimeUtc = 0 }, r => r with { CreateNew = false }, r => r with { Protected = false },
            r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false }
        }) {
            var bad = new World { ChangeReceipt = change }; Check(bad.Lifecycle().Activate().Failure is not null && bad.EnabledCalls == 0);
        }
        var pre = new World { Fault = p => p == "pre-activation" ? new InvalidDataException() : null };
        Check(pre.Lifecycle().Activate().Failure!.Stage == "PRE_ACTIVATION_EVIDENCE" && pre.OpenCalls == 0);
        foreach (int rejectAt in new[] { 2, 3 }) {
            int evidenceChecks = 0;
            var lateEvidence = new World { Fault = p => p == "pre-activation" && ++evidenceChecks == rejectAt ? new InvalidDataException() : null };
            Check(lateEvidence.Lifecycle().Activate().Failure is not null && lateEvidence.EnabledCalls == 0 &&
                lateEvidence.Files.ContainsKey(StandardStoreFile.AccountActivationIntent));
        }
        string[] mutableGroups = { "S-1-5-32-545" };
        var frozenSnapshot = StandardAccountRules.Snapshot(Snapshot() with { LocalGroupSids = mutableGroups }, false);
        mutableGroups[0] = StandardContract.Administrators; Check(frozenSnapshot.LocalGroupSids[0] == "S-1-5-32-545");
        foreach (bool corruptOwned in new[] { false, true }) {
            var world = new World(); var current = world.Lifecycle(); Check(current.Activate().Failure is null);
            if (corruptOwned) world.Files[StandardStoreFile.AccountOwned][0] ^= 1;
            else world.Files[StandardStoreFile.AccountActivated][0] ^= 1;
            var result = current.ReturnDisabled(); Check(result.Failure is not null && world.DisabledCalls == 0 && !world.Disposed && world.Actual.Enabled);
        }
        var missingExit = new World(); var exitLifecycle = missingExit.Lifecycle(); Check(exitLifecycle.Activate().Failure is null);
        missingExit.ExitAdmitted = false;
        Check(exitLifecycle.ReturnDisabled().Failure!.Stage == "PRE_RETURN_HELD_EXIT_EVIDENCE" && missingExit.DisabledCalls == 0 && missingExit.Actual.Enabled);
        var unknown = new World { Fault = p => p == "set-after" ? new Win32Exception(121) : null }; var unknownLifecycle = unknown.Lifecycle();
        var unknownResult = unknownLifecycle.Activate();
        Check(unknownResult.Failure!.Win32Error == 121 && unknownResult.Failure.AccountStateMayHaveChanged && unknown.Actual.Enabled && unknown.DisabledCalls == 0 && !unknown.Disposed);
        Refused(() => unknownLifecycle.ReturnDisabled());
        foreach (bool duringReturn in new[] { false, true }) {
            var expiry = new World(); var current = expiry.Lifecycle(); if (duringReturn) Check(current.Activate().Failure is null);
            expiry.FixedTime = Start.AddHours(2);
            Check((duringReturn ? current.ReturnDisabled() : current.Activate()).Failure is not null && expiry.DisabledCalls == 0);
        }
        foreach (var context in new[] { Context() with { Effects = "ACCOUNT_PREPARATION_ONLY" }, Context() with { SourceSetSha256 = H(0).ToUpperInvariant() + "F" },
            Context() with { Scope = Context().Scope with { AccountSid = StandardContract.OwnerSid } },
            Context() with { Scope = Context().Scope with { AccountOwnedSha256 = H(88) } } }) {
            var wrong = new World(context); Check(wrong.Lifecycle().Activate().Failure is not null && wrong.OpenCalls == 0);
        }
        var changedFlags = new World(); var flagsLifecycle = changedFlags.Lifecycle(); Check(flagsLifecycle.Activate().Failure is null);
        changedFlags.Actual = changedFlags.Actual with { NetUserFlags = changedFlags.Actual.NetUserFlags | 0x10000 };
        Check(flagsLifecycle.ReturnDisabled().Failure is not null && changedFlags.DisabledCalls == 0);
        var reentrant = new World(); var reentrantLifecycle = reentrant.Lifecycle(); bool refusedReentry = false;
        reentrant.At = p => { if (p == "set-before") { try { reentrantLifecycle.ReturnDisabled(); } catch (InvalidDataException) { refusedReentry = true; } } };
        Check(reentrantLifecycle.Activate().Failure is null && refusedReentry && reentrant.EnabledCalls == 1);
        // One concurrent activation; the second caller cannot reuse the scope.
        var concurrent = new World(); var concurrentLifecycle = concurrent.Lifecycle();
        using (var entered = new ManualResetEventSlim(false)) using (var release = new ManualResetEventSlim(false)) {
            concurrent.At = p => { if (p == "pre-activation") { entered.Set(); StandardContract.Need(release.Wait(10000), "FAKE_ACCOUNT_RELEASE_TIMEOUT"); } };
            var first = Task.Run(() => concurrentLifecycle.Activate());
            bool observed = entered.Wait(10000);
            try { Refused(() => concurrentLifecycle.Activate()); } finally { release.Set(); }
            Check(first.Wait(10000) && observed && first.Result.Failure is null && concurrent.EnabledCalls == 1);
        }
        return cases;
    }
}
