using System;
using System.Collections.Generic;
using System.Formats.Asn1;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

// Synthetic stores, tokens and backend handles only. The compile-only native
// backend is never constructed or called by these tests.
internal static class StandardKeyCreationTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero);
    private static string H(int number) => number.ToString("x").PadLeft(64, '0');
    private static StandardKeyCreationContext Context() => new(new(StandardCryptoComparison.Schema,
        StandardContract.Root, "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2),
        StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
        StandardContract.OwnerSid, H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8)), H(9));
    private static StandardToken Token() => new(StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid,
        1, 1, 1, StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] {
            new StandardGroup(StandardCryptoComparison.SetupSid, 7),
            new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7)
        });
    private static StandardNativeKeyReadback Key(StandardKeyCreationContext context, StandardCryptoArm arm)
    {
        var descriptor = new RawSecurityDescriptor("O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + StandardCryptoComparison.GuardianSid + ")" +
            (arm == StandardCryptoArm.UserAccessible ? "(A;;GA;;;" + StandardContract.UserSid + ")" : ""));
        var bytes = new byte[descriptor.BinaryLength]; descriptor.GetBinaryForm(bytes, 0);
        var rsa = new AsnWriter(AsnEncodingRules.DER); rsa.PushSequence();
        rsa.WriteIntegerUnsigned(Enumerable.Repeat(arm == StandardCryptoArm.Restricted ? (byte)0xbb : (byte)0xdd, 384).ToArray());
        rsa.WriteInteger(65537); rsa.PopSequence();
        var spki = new AsnWriter(AsnEncodingRules.DER); spki.PushSequence(); spki.PushSequence();
        spki.WriteObjectIdentifier("1.2.840.113549.1.1.1"); spki.WriteNull(); spki.PopSequence();
        spki.WriteBitString(rsa.Encode()); spki.PopSequence(); byte[] publicBytes = spki.Encode();
        return new(StandardKeyCreationRules.Name(context, arm), StandardCryptoComparison.Provider, "RSA", 3072,
            true, true, 1, 0, StandardNativeCryptoRules.Descriptor(bytes, arm),
            Convert.ToBase64String(publicBytes), StandardNativeCryptoRules.Hash(publicBytes));
    }
    private static string Arm(StandardCryptoArm arm) => arm == StandardCryptoArm.Restricted ? "R" : "A";

    private sealed class World : IStandardDurableRecordSink, IStandardKeyCreationBackend
    {
        internal readonly StandardKeyCreationContext Context;
        internal readonly List<string> Events = new();
        internal readonly Dictionary<StandardStoreFile, byte[]> Files = new();
        internal readonly Dictionary<StandardCryptoArm, StandardNativeKeyReadback> Keys = new();
        internal readonly List<Handle> Handles = new();
        internal readonly List<StandardCryptoArm> CreateCalls = new();
        internal int FailAt = -1;
        internal Exception Failure = new IOException("SYNTHETIC_BOUNDARY_FAULT");
        internal Func<string, Exception?>? Fault;
        internal Func<StandardToken> TokenSupplier = Token;
        internal Func<StandardStoreReceipt, StandardStoreReceipt> ReceiptChange = x => x;
        internal Func<StandardStoreFile, byte[], byte[]> ReadChange = (_, b) => b;
        internal Func<StandardCryptoArm, string, StandardNativeKeyReadback, StandardNativeKeyReadback> SnapshotChange = (_, _, s) => s;
        internal Func<StandardCryptoArm, StandardKeyNameObservation>? ProbeChange;
        private long ticks;
        internal World(StandardKeyCreationContext? context = null) { Context = context ?? StandardKeyCreationTests.Context(); }
        internal DateTimeOffset Now() => Start.AddTicks(++ticks);
        internal void Hit(string point) {
            Events.Add(point);
            if (Events.Count - 1 == FailAt) throw Failure;
            var fault = Fault?.Invoke(point); if (fault is not null) throw fault;
        }
        internal StandardToken Capture() { Hit("guard"); return TokenSupplier(); }
        internal StandardKeyCreationLifecycle Lifecycle() => new(Context, this, this, Now, Capture);
        public StandardStoreReceipt WriteNew(StandardStoreFile file, byte[] originalUtf8)
        {
            Hit("write:" + file);
            if (file is StandardStoreFile.RestrictedComplete or StandardStoreFile.AccessibleComplete)
                StandardContract.Need(Files.ContainsKey(StandardStoreFile.RestrictedOwned) && Files.ContainsKey(StandardStoreFile.AccessibleOwned),
                    "FAKE_COMPLETION_BEFORE_BOTH_OWNED");
            StandardContract.Need(Files.TryAdd(file, (byte[])originalUtf8.Clone()), "FAKE_CREATE_NEW_REFUSED");
            DateTimeOffset written = Now();
            return ReceiptChange(new StandardStoreReceipt(Context.Scope, file, StandardNativeCryptoRules.Hash(originalUtf8), originalUtf8.Length,
                written, 1234, (ulong)Files.Count, true, true, true, true) { CreationFileTimeUtc = written.UtcDateTime.ToFileTimeUtc() });
        }
        public byte[] Read(StandardStoreFile file) {
            Hit("read:" + file); return ReadChange(file, (byte[])Files[file].Clone());
        }
        public StandardKeyNameObservation ProbeName(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate) {
            gate(); Hit("probe:" + Arm(arm));
            return ProbeChange?.Invoke(arm) ?? (Keys.ContainsKey(arm)
                ? new(StandardKeyCreationRules.Name(context, arm), "OPENED_EXISTS", 0)
                : new(StandardKeyCreationRules.Name(context, arm), "NOT_OPENED_BAD_KEYSET", StandardCryptoComparison.BadKeyset));
        }
        public IStandardKeyCreationHandle CreateFresh(StandardKeyCreationContext context, StandardCryptoArm arm,
            Action verifyDurableIntent, Action gate)
        {
            gate(); verifyDurableIntent(); gate(); Hit("create:" + Arm(arm)); CreateCalls.Add(arm);
            StandardContract.Need(Files.ContainsKey(StandardKeyCreationRules.File(arm, "INTENT")), "FAKE_CREATE_WITHOUT_INTENT");
            if (!Keys.TryAdd(arm, Key(context, arm)))
                throw new StandardKeyCreationNativeException("CREATE_PERSISTED", unchecked((int)0x8009000f));
            Hit("finalize:" + Arm(arm));
            var handle = new Handle(this, arm, "created", gate); Handles.Add(handle); return handle;
        }
        public IStandardKeyCreationHandle ReopenCreated(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate)
        {
            gate(); Hit("reopen:" + Arm(arm));
            StandardContract.Need(Handles.Where(x => x.Arm == arm && x.Kind == "created").All(x => x.Disposed),
                "FAKE_REOPEN_BEFORE_CREATED_CLOSE");
            StandardContract.Need(Keys.ContainsKey(arm), "FAKE_REOPEN_MISSING");
            var handle = new Handle(this, arm, "reopened", gate); Handles.Add(handle); return handle;
        }
        internal sealed class Handle : IStandardKeyCreationHandle
        {
            private readonly World world; private readonly Action gate;
            internal readonly StandardCryptoArm Arm; internal readonly string Kind; internal bool Disposed;
            internal Handle(World world, StandardCryptoArm arm, string kind, Action gate) {
                this.world = world; Arm = arm; Kind = kind; this.gate = gate;
            }
            public StandardNativeKeyReadback Inspect() {
                gate(); world.Hit("inspect-" + Kind + ":" + StandardKeyCreationTests.Arm(Arm));
                return world.SnapshotChange(Arm, Kind, world.Keys[Arm]);
            }
            public void Dispose() { world.Hit("close-" + Kind + ":" + StandardKeyCreationTests.Arm(Arm)); Disposed = true; }
        }
    }

    internal static int Run()
    {
        int count = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_CREATE_TEST_FAILED_" + count); count++; }
        void Refused(Action action) {
            bool refused = false; try { action(); } catch (InvalidDataException) { refused = true; }
            Check(refused);
        }
        var goodWorld = new World(); var lifecycle = goodWorld.Lifecycle(); var good = lifecycle.Run();
        Check(good.Outcome == "CREATE_REOPEN_PROTOCOL_COMPLETE" && good.Failure is null && good.Originals.Count == 6);
        Check(!good.NativeExecutionProven && !good.Lic008Closed && !good.SecurityAccepted && !good.ProductionAccepted);
        Check(good.Restricted!.PublicSha256 != good.Accessible!.PublicSha256 &&
            good.Restricted.Descriptor.Sha256 != good.Accessible.Descriptor.Sha256);
        Check(goodWorld.Handles.Count == 4 && goodWorld.Handles.All(h => h.Disposed) && goodWorld.CreateCalls.Count == 2);
        Check(goodWorld.CreateCalls.SequenceEqual(new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }));
        Check(good.Originals.Select(x => x.File).SequenceEqual(new[] { StandardStoreFile.RestrictedIntent, StandardStoreFile.RestrictedOwned,
            StandardStoreFile.AccessibleIntent, StandardStoreFile.AccessibleOwned, StandardStoreFile.RestrictedComplete, StandardStoreFile.AccessibleComplete }));
        Check(good.Originals.Select(x => x.OriginalSha256).Distinct().Count() == 6);
        foreach (var original in good.Originals) {
            Check(original.Record.Context == goodWorld.Context && original.Record.Context.SourceSetSha256 == H(9) &&
                original.Record.Schema == StandardKeyCreationRules.Schema && original.Record.KeyName == StandardKeyCreationRules.Name(goodWorld.Context, original.Record.Arm));
            Check(StandardNativeCryptoRules.Hash(goodWorld.Files[original.File]) == original.OriginalSha256 &&
                goodWorld.Files[original.File].AsSpan().SequenceEqual(StandardKeyCreationRules.Bytes(original.Record)));
            var parsed = JsonSerializer.Deserialize<StandardKeyCreationRecord>(goodWorld.Files[original.File]); Check(parsed == original.Record);
            if (original.Record.Kind == "INTENT") Check(original.Record.PreviousSha256 is null && original.Record.PublicSha256 is null &&
                original.Record.DescriptorSha256 is null && original.Record.OtherOwnedSha256 is null);
            else {
                string previousKind = original.Record.Kind == "OWNED" ? "INTENT" : "OWNED";
                var previous = good.Originals.Single(x => x.Record.Arm == original.Record.Arm && x.Record.Kind == previousKind);
                Check(original.Record.PreviousSha256 == previous.OriginalSha256 && original.Record.WrittenUtc > previous.Receipt.WrittenUtc &&
                    original.Record.PublicSha256 == (original.Record.Arm == StandardCryptoArm.Restricted ? good.Restricted : good.Accessible)!.PublicSha256);
            }
            if (original.Record.Kind == "COMPLETE") {
                var otherOwned = good.Originals.Single(x => x.Record.Arm != original.Record.Arm && x.Record.Kind == "OWNED");
                Check(original.Record.OtherOwnedSha256 == otherOwned.OriginalSha256 && original.Record.WrittenUtc > otherOwned.Receipt.WrittenUtc);
            }
        }
        int eventCount = goodWorld.Events.Count;
        Refused(() => lifecycle.Run()); Check(goodWorld.Events.Count == eventCount);
        // Release two callers together, keep the winning run inside its first
        // guard, and require the loser to refuse before reaching any callback.
        // All journal/backend state remains synthetic and has one writer.
        using (var simultaneous = new Barrier(3))
        using (var admitted = new ManualResetEventSlim(false))
        using (var release = new ManualResetEventSlim(false))
        using (var refused = new ManualResetEventSlim(false)) {
            var concurrentWorld = new World { TokenSupplier = () => {
                admitted.Set(); StandardContract.Need(release.Wait(10000), "FAKE_CONCURRENT_GUARD_TIMEOUT"); return Token();
            } };
            var concurrentLifecycle = concurrentWorld.Lifecycle();
            StandardKeyCreationResult?[] results = new StandardKeyCreationResult?[2];
            Exception?[] errors = new Exception?[2];
            Task Caller(int slot) => Task.Run(() => {
                try {
                    StandardContract.Need(simultaneous.SignalAndWait(10000), "FAKE_CONCURRENT_START_TIMEOUT");
                    results[slot] = concurrentLifecycle.Run();
                } catch (Exception error) { errors[slot] = error; refused.Set(); }
            });
            Task first = Caller(0), second = Caller(1);
            bool entered = false, loserRefused = false, began;
            try {
                began = simultaneous.SignalAndWait(10000);
                entered = admitted.Wait(10000); loserRefused = refused.Wait(10000);
            } finally { release.Set(); }
            Check(Task.WaitAll(new[] { first, second }, 10000));
            Check(began && entered && loserRefused);
            Check(errors.Count(e => e is InvalidDataException) == 1 && errors.Count(e => e is null) == 1 &&
                results.Count(r => r?.Outcome == "CREATE_REOPEN_PROTOCOL_COMPLETE") == 1 && results.Count(r => r is null) == 1);
            Check(concurrentWorld.CreateCalls.Count == 2 && concurrentWorld.Files.Count == 6 &&
                concurrentWorld.Events.SequenceEqual(goodWorld.Events));
        }
        var repeat = goodWorld.Lifecycle().Run();
        Check(repeat.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && repeat.Failure!.Stage == "NAME_PROBE" &&
            !repeat.Failure.CreateCallEntered && !repeat.Failure.DurableWriteCallEntered && goodWorld.CreateCalls.Count == 2);

        // Inject at EVERY guarded/backend/store operation boundary in the
        // successful trace. Any remaining live handle or partial record/key is
        // retained; there is no retry, delete, repair or completion fabrication.
        for (int index = 0; index < eventCount; index++) {
            var world = new World { FailAt = index }; var result = world.Lifecycle().Run();
            Check(result.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && result.Failure is not null);
            Check(world.CreateCalls.Count <= 2 && world.CreateCalls.GroupBy(x => x).All(g => g.Count() == 1));
            Check(!world.Files.ContainsKey(StandardStoreFile.RestrictedComplete) ||
                (world.Files.ContainsKey(StandardStoreFile.RestrictedOwned) && world.Files.ContainsKey(StandardStoreFile.AccessibleOwned)));
            Check(!world.Files.ContainsKey(StandardStoreFile.AccessibleComplete) ||
                (world.Files.ContainsKey(StandardStoreFile.RestrictedOwned) && world.Files.ContainsKey(StandardStoreFile.AccessibleOwned)));
            Check(result.Failure!.PersistedKeyEffectMayExist == result.Failure.CreateCallEntered &&
                result.Failure.PersistedRecordEffectMayExist == result.Failure.DurableWriteCallEntered);
        }

        var tokenChanges = new Func<StandardToken, StandardToken>[] {
            t => t with { User = StandardContract.OwnerSid }, t => t with { Owner = StandardContract.OwnerSid },
            t => t with { Type = 2 }, t => t with { Elevation = 0 }, t => t with { ElevationType = 3 },
            t => t with { IntegritySid = StandardContract.MediumIntegrity }, t => t with { HasRestrictions = true },
            t => t with { AppContainer = true }, t => t with { QueryComplete = false }, t => t with { Groups = null },
            t => t with { Groups = t.Groups!.Skip(1).ToArray() }, t => t with { Groups = t.Groups!.Take(1).ToArray() },
            t => t with { Groups = t.Groups!.Concat(new[] { t.Groups![0] }).ToArray() },
            t => t with { Groups = t.Groups!.Concat(new[] { new StandardGroup(StandardContract.Interactive, 7) }).ToArray() },
            t => t with { Groups = t.Groups!.Concat(new[] { new StandardGroup("S-1-5-2", 7) }).ToArray() },
            t => t with { Groups = t.Groups!.Concat(new[] { new StandardGroup("S-1-5-3", 7) }).ToArray() },
            t => t with { Groups = t.Groups!.Select(g => g with { Attributes = 16 }).ToArray() },
            t => t with { Groups = t.Groups!.Select(g => g with { Attributes = 0 }).ToArray() },
            t => t with { Groups = t.Groups!.Concat(new[] { new StandardGroup("S-1-05-18", 7) }).ToArray() }
        };
        foreach (var change in tokenChanges) {
            var world = new World { TokenSupplier = () => change(Token()) }; var result = world.Lifecycle().Run();
            Check(result.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && result.Failure!.Stage == "ADMISSION");
            Check(world.Files.Count == 0 && world.Keys.Count == 0 && world.CreateCalls.Count == 0);
        }
        foreach (var error in new Exception[] { new CryptographicException(StandardCryptoComparison.BadKeyset), new UnauthorizedAccessException() }) {
            var world = new World { TokenSupplier = () => throw error }; var result = world.Lifecycle().Run();
            Check(result.Failure!.Category == "VALIDATION" && result.Failure.NativeStatus is null && world.CreateCalls.Count == 0);
        }
        foreach (string? hash in new string?[] { null, "", new('0', 63), new('0', 65), new('A', 64), new('g', 64), new string('0', 63) + "\n" }) {
            var world = new World(Context() with { SourceSetSha256 = hash! }); var result = world.Lifecycle().Run();
            Check(result.Failure!.Stage == "ADMISSION" && world.Files.Count == 0 && world.Keys.Count == 0);
        }
        var scopeChanges = new Func<StandardCryptoScope, StandardCryptoScope>[] {
            s => s with { Schema = "old" }, s => s with { Root = s.Root + "Old" }, s => s with { Attempt = new('A', 32) },
            s => s with { AccountSid = StandardContract.OwnerSid }, s => s with { OwnerSid = StandardContract.UserSid },
            s => s with { AccountOwnedSha256 = s.AccountCompleteSha256 }, s => s with { AccountCompleteSha256 = s.AccountOwnedSha256 },
            s => s with { ExpiresUtc = s.IssuedUtc }, s => s with { IssuedUtc = s.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) },
            s => s with { PlanSha256 = "bad" }, s => s with { ApprovalSha256 = "bad" },
            s => s with { PackageSha256 = "bad" }, s => s with { RuntimeSha256 = "bad" },
            s => s with { ImageSha256 = "bad" }, s => s with { AssemblySha256 = "bad" },
            s => s with { HostSha256 = "bad" }, s => s with { BootSha256 = "bad" }
        };
        foreach (var change in scopeChanges) {
            var c = Context(); var world = new World(c with { Scope = change(c.Scope) }); var result = world.Lifecycle().Run();
            Check(result.Failure!.Stage == "ADMISSION" && world.Files.Count == 0 && world.Keys.Count == 0);
        }
        foreach (var change in new Func<StandardStoreReceipt, StandardStoreReceipt>[] {
            r => r with { Scope = r.Scope with { PlanSha256 = H(900) } }, r => r with { File = StandardStoreFile.SetupReport },
            r => r with { Sha256 = H(901) }, r => r with { Length = r.Length + 1 },
            r => r with { WrittenUtc = Start.AddTicks(-1) }, r => r with { WrittenUtc = Start.AddHours(2) },
            r => r with { WrittenUtc = r.WrittenUtc.ToOffset(TimeSpan.FromHours(1)) },
            r => r with { VolumeSerial = 0 }, r => r with { FileIndex = 0 },
            r => r with { CreationFileTimeUtc = 0 }, r => r with { CreationFileTimeUtc = Start.AddHours(3).UtcDateTime.ToFileTimeUtc() },
            r => r with { CreateNew = false }, r => r with { Protected = false },
            r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false }
        }) {
            var world = new World { ReceiptChange = change }; var result = world.Lifecycle().Run();
            Check(result.Failure!.Stage == "INTENT_WRITE" && result.Failure.DurableWriteCallEntered && !result.Failure.CreateCallEntered && world.Keys.Count == 0);
            Check(world.Files.Count == 1 && result.Originals.Count == 0);
        }
        foreach (var file in new[] { StandardStoreFile.RestrictedIntent, StandardStoreFile.RestrictedOwned,
            StandardStoreFile.AccessibleIntent, StandardStoreFile.AccessibleOwned }) {
            var world = new World { ReadChange = (f, bytes) => { if (f == file) bytes[bytes.Length - 2] ^= 1; return bytes; } };
            var result = world.Lifecycle().Run(); Check(result.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && result.Failure!.Category == "VALIDATION");
            Check(!world.Files.ContainsKey(StandardStoreFile.RestrictedComplete) && !world.Files.ContainsKey(StandardStoreFile.AccessibleComplete));
        }
        foreach (var observation in new[] {
            new StandardKeyNameObservation(StandardKeyCreationRules.Name(Context(), StandardCryptoArm.Restricted), "OPENED_EXISTS", 0),
            new StandardKeyNameObservation(StandardKeyCreationRules.Name(Context(), StandardCryptoArm.Restricted), "NOT_OPENED_BAD_KEYSET", 5),
            new StandardKeyNameObservation(StandardKeyCreationRules.Name(Context(), StandardCryptoArm.Restricted) + ".old", "NOT_OPENED_BAD_KEYSET", StandardCryptoComparison.BadKeyset),
            new StandardKeyNameObservation(StandardKeyCreationRules.Name(Context(), StandardCryptoArm.Restricted), "NOT_FOUND", null)
        }) {
            var world = new World { ProbeChange = _ => observation }; var result = world.Lifecycle().Run();
            Check(result.Failure!.Stage == "NAME_PROBE" && world.Files.Count == 0 && world.Keys.Count == 0);
        }
        foreach (var arm in new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }) {
            foreach (string kind in new[] { "created", "reopened" }) {
                foreach (var mutate in new Func<StandardNativeKeyReadback, StandardNativeKeyReadback>[] {
                    s => s with { Name = s.Name + ".old" }, s => s with { Bits = 2048 }, s => s with { ExportPolicy = 3 },
                    s => s with { Usage = 3 }, s => s with { Machine = false }, s => s with { Persisted = false },
                    s => s with { Descriptor = s.Descriptor with { Owner = StandardContract.OwnerSid } },
                    s => s with { Descriptor = s.Descriptor with { Group = StandardContract.UserSid } },
                    s => s with { Descriptor = s.Descriptor with { Protected = false } },
                    s => s with { PublicSha256 = H(920) }
                }) {
                    var world = new World { SnapshotChange = (a, k, s) => a == arm && k == kind ? mutate(s) : s };
                    var result = world.Lifecycle().Run();
                    Check(result.Failure!.Stage == (kind == "created" ? "CREATED_INSPECT" : "REOPENED_INSPECT") && result.Failure.Category == "VALIDATION");
                    Check(!world.Files.ContainsKey(StandardKeyCreationRules.File(arm, "OWNED")) &&
                        !world.Files.ContainsKey(StandardStoreFile.RestrictedComplete) && world.Handles.All(h => h.Disposed));
                }
            }
            foreach (string kind in new[] { "created", "reopened" }) {
                var original = new StandardKeyCreationNativeException("SYNTHETIC_INSPECT_NATIVE", StandardCryptoComparison.BadKeyset);
                var world = new World { Fault = point => point == "inspect-" + kind + ":" + Arm(arm) ? original :
                    point == "close-" + kind + ":" + Arm(arm) ? new UnauthorizedAccessException() : null };
                var result = world.Lifecycle().Run();
                Check(result.Failure!.ManagedHResult == original.HResult && result.Failure.NativeStatus == original.NativeStatus &&
                    result.Failure.NativeStage == original.NativeStage && result.Failure.Category == "CRYPTOGRAPHIC" && result.Failure.HandleReleaseUnconfirmed);
            }
            foreach (string nativeStage in new[] { "CREATE_PERSISTED", "SET_LENGTH", "SET_POLICY", "SET_USAGE", "SET_SECURITY_DESCRIPTOR", "FINALIZE" }) {
                var error = new StandardKeyCreationNativeException(nativeStage, unchecked((int)0x80090029));
                var world = new World { Fault = point => point == "finalize:" + Arm(arm) ? error : null };
                var result = world.Lifecycle().Run();
                Check(result.Failure!.Stage == "CREATE" && result.Failure.ManagedHResult == error.HResult &&
                    result.Failure.NativeStatus == error.NativeStatus && result.Failure.NativeStage == nativeStage && result.Failure.PersistedKeyEffectMayExist);
                Check(world.Keys.ContainsKey(arm) && !world.Files.ContainsKey(StandardKeyCreationRules.File(arm, "OWNED")));
            }
        }
        // Immutable public identity mismatch can have an otherwise valid profile.
        var changedPublic = new World { SnapshotChange = (arm, kind, s) => kind == "reopened" ?
            s with { PublicSpkiBase64 = Key(Context(), arm == StandardCryptoArm.Restricted ? StandardCryptoArm.UserAccessible : StandardCryptoArm.Restricted).PublicSpkiBase64,
                PublicSha256 = Key(Context(), arm == StandardCryptoArm.Restricted ? StandardCryptoArm.UserAccessible : StandardCryptoArm.Restricted).PublicSha256 } : s };
        Check(changedPublic.Lifecycle().Run().Failure!.Stage == "REOPENED_INSPECT");
        var firstIntent = new World { Fault = p => p == "create:R" ? new IOException() : null };
        Check(firstIntent.Lifecycle().Run().Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && firstIntent.Files.Count == 1 && firstIntent.Keys.Count == 0);
        firstIntent.Fault = null; var resumed = firstIntent.Lifecycle().Run();
        Check(resumed.Failure!.Stage == "INTENT_WRITE" && firstIntent.Keys.Count == 0 && firstIntent.CreateCalls.Count == 0);
        Refused(() => StandardKeyCreationRules.File((StandardCryptoArm)9, "INTENT"));
        Refused(() => StandardKeyCreationRules.File(StandardCryptoArm.Restricted, "DELETE"));
        return count;
    }
}
