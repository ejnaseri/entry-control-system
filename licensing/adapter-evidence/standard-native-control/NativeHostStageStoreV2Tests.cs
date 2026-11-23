using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostStageStoreV2Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Now = Issued.AddMinutes(10);
    private static readonly byte[] Source = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_SOURCE_SET\"}");
    private static readonly byte[] Package = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_PACKAGE_MANIFEST\"}");
    // Byte-for-byte fixtures from the already archived disabled-account run;
    // no password, account mutation or filesystem read occurs in this test.
    private static readonly byte[] AccountOwned = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:36.1714952+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"createdDisabled\":true}}");
    private static readonly byte[] AccountComplete = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:37.4544800+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"enabled\":false,\"principalSource\":\"Local\",\"groupsComplete\":true,\"localGroupSids\":[\"S-1-5-32-545\"]}}");

    private sealed class FakeSink : INativeHostStoreSinkV2
    {
        internal readonly Dictionary<string, byte[]> Files = new(StringComparer.Ordinal);
        internal NativeHostStoreScopeV2 Scope = null!;
        internal Func<DateTimeOffset> Clock = null!;
        internal Func<NativeHostStoreReceiptV2, NativeHostStoreReceiptV2> ChangeReceipt = x => x;
        internal Func<string, byte[], byte[]> ChangeRead = (_, raw) => raw;
        internal Action? OnCreate;
        internal bool ThrowAfterCreate;
        internal int Creates, Reads;
        private ulong nextIndex = 100;
        public NativeHostStoreReceiptV2 CreateNew(string path, byte[] original)
        {
            Creates++;
            if (!Files.TryAdd(path, (byte[])original.Clone()))
                throw new InvalidDataException("FAKE_CREATE_NEW_COLLISION");
            OnCreate?.Invoke();
            if (ThrowAfterCreate) throw new InvalidDataException("FAKE_UNKNOWN_AFTER_CREATE");
            DateTimeOffset now = Clock();
            var receipt = new NativeHostStoreReceiptV2(Scope,
                Enum.GetValues<NativeHostStoreFileV2>().Single(f => Scope.Root + @"\" + NativeHostStageStoreV2.Relative(f) == path),
                path, NativeHostInputCodecV2.Hash(original), original.Length,
                now, 17, nextIndex++, now.UtcDateTime.ToFileTimeUtc(), true, true, true, true);
            return ChangeReceipt(receipt);
        }
        public byte[] ReadOriginal(string path)
        {
            Reads++;
            if (!Files.TryGetValue(path, out byte[]? raw)) throw new InvalidDataException("FAKE_FILE_MISSING");
            return ChangeRead(path, (byte[])raw.Clone());
        }
    }

    private sealed class FakeGuard : INativeHostStoreGuardV2
    {
        internal NativeHostStoreScopeV2 Scope = null!;
        internal Action<string>? OnVerify;
        internal int Calls;
        public void Verify(NativeHostStoreScopeV2 scope, NativeHostRole role, string point)
        {
            Calls++;
            if (scope != Scope || !Enum.IsDefined(role) || string.IsNullOrEmpty(point))
                throw new InvalidDataException("FAKE_GUARD_SCOPE_CHANGED");
            OnVerify?.Invoke(point);
        }
    }

    private sealed class World
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly byte[] SourceOriginal;
        internal readonly byte[] PackageOriginal;
        internal readonly byte[] Inventory;
        internal readonly FakeSink Sink = new();
        internal readonly FakeGuard Guard = new();
        internal readonly NativeHostStageStoreV2 Store;
        internal DateTimeOffset Clock = Now;
        internal World(byte[]? source = null, byte[]? package = null)
        {
            SourceOriginal = (byte[])(source ?? Source).Clone();
            PackageOriginal = (byte[])(package ?? Package).Clone();
            NativeHostFilePinV2[] files = Enumerable.Range(0, NativeHostInputCodecV2.FrameworkFileCount)
                .Select(i => NativeHostInputCodecV2.ExpectedRuntimeLeaf(i))
                .Select((name, i) => new NativeHostFilePinV2(name, i + 1,
                    NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(name)))).ToArray();
            var profile = NativeHostProfileV2.Create(Attempt, NativeHostInputCodecV2.Hash(SourceOriginal));
            Inventory = NativeHostInputCodecV2.EncodeRuntimeInventory(profile, files);
            byte[] config = Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson);
            var plan = new NativeHostPlanV2(profile, Attempt, Issued, Issued.AddMinutes(90),
                new string('d', 64), new string('e', 64),
                NativeHostInputCodecV2.Hash(PackageOriginal), NativeHostInputCodecV2.Hash(Inventory),
                new NativeHostAssetPinV2(252928, new string('a', 64)),
                new NativeHostAssetPinV2(150000, new string('b', 64)),
                new NativeHostAssetPinV2(config.Length, NativeHostInputCodecV2.Hash(config)),
                new NativeHostAssetPinV2(400000, new string('c', 64)), files);
            var approval = new NativeHostApprovalV2(plan, Issued.AddMinutes(1), Issued.AddMinutes(60));
            Bound = NativeHostInputCodecV2.Bind(plan.CanonicalBytes(), approval.CanonicalBytes(),
                profile.CanonicalBytes(), SourceOriginal, PackageOriginal, Inventory, Now);
            Sink.Clock = () => Clock;
            Store = new NativeHostStageStoreV2(Bound, Sink, Guard, () => Clock);
            Sink.Scope = Store.Scope;
            Guard.Scope = Store.Scope;
        }
        internal byte[]? Input(NativeHostStoreFileV2 file) => file switch {
            NativeHostStoreFileV2.Profile => Bound.Profile.CanonicalBytes(),
            NativeHostStoreFileV2.SourceSet => (byte[])SourceOriginal.Clone(),
            NativeHostStoreFileV2.RuntimeInventory => (byte[])Inventory.Clone(),
            NativeHostStoreFileV2.PackageManifest => (byte[])PackageOriginal.Clone(),
            NativeHostStoreFileV2.AccountOwned => (byte[])AccountOwned.Clone(),
            NativeHostStoreFileV2.AccountComplete => (byte[])AccountComplete.Clone(),
            NativeHostStoreFileV2.Plan => Bound.Plan.CanonicalBytes(),
            NativeHostStoreFileV2.Approval => Bound.Approval.CanonicalBytes(),
            _ => null
        };
        internal NativeHostStoredOriginalV2 Write(NativeHostStoreFileV2 file, string previous,
            NativeHostRole? role = null, string? run = null, string? nonce = null,
            string? evidence = null, byte[]? input = null)
        {
            NativeHostRole actualRole = role ?? (file is >= NativeHostStoreFileV2.RestrictedKeyIntent and
                <= NativeHostStoreFileV2.AccessibleKeyComplete ? NativeHostRole.Setup : NativeHostRole.Owner);
            return Store.WriteNew(actualRole, file, input ?? Input(file),
                evidence ?? EvidenceFor(file), run ?? RunFor(file), nonce ?? NonceFor(file), previous);
        }
        internal string AdvanceTo(NativeHostStoreFileV2 exclusive)
        {
            string previous = "";
            foreach (NativeHostStoreFileV2 file in Enum.GetValues<NativeHostStoreFileV2>()) {
                if (file == exclusive) break;
                previous = Write(file, previous).Sha256;
            }
            return previous;
        }
    }

    private static string EvidenceFor(NativeHostStoreFileV2 file) =>
        NativeHostStageStoreV2.IsInput(file) ? "" :
            NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(file.ToString()));
    private static string RunFor(NativeHostStoreFileV2 file) => file switch {
        >= NativeHostStoreFileV2.ServiceSetupStart and <= NativeHostStoreFileV2.ServiceSetupRunComplete => new string('1', 32),
        >= NativeHostStoreFileV2.ServiceGuardianBeforeStart and <= NativeHostStoreFileV2.ServiceGuardianBeforeComplete => new string('2', 32),
        >= NativeHostStoreFileV2.StandardUserIntent and <= NativeHostStoreFileV2.StandardUserComplete => new string('3', 32),
        >= NativeHostStoreFileV2.ServiceGuardianAfterStart and <= NativeHostStoreFileV2.ServiceGuardianAfterComplete => new string('4', 32),
        _ => ""
    };
    private static string NonceFor(NativeHostStoreFileV2 file) => RunFor(file) switch {
        { Length: 32 } run => new string((char)(run[0] + 4), 64),
        _ => ""
    };

    internal static int Run()
    {
        int checks = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("NATIVE_STAGE_STORE_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_STAGE_STORE_REFUSAL_MISSING_" + checks);
        }

        NativeHostStoreFileV2[] all = Enum.GetValues<NativeHostStoreFileV2>();
        Check(all.Length == 68 && all.Select((x, i) => (int)x == i).All(x => x));
        Check(all[0] == NativeHostStoreFileV2.Profile &&
            (int)NativeHostStoreFileV2.AttemptConsumed == (int)NativeHostStoreFileV2.Approval + 1 &&
            (int)NativeHostStoreFileV2.AttemptConsumed < (int)NativeHostStoreFileV2.ServiceSetupIntent &&
            Array.IndexOf(all, NativeHostStoreFileV2.AccountActivationIntent) <
                Array.IndexOf(all, NativeHostStoreFileV2.AccountActivated) &&
            Array.IndexOf(all, NativeHostStoreFileV2.AccountDisableIntent) <
                Array.IndexOf(all, NativeHostStoreFileV2.AccountDisabled));
        Check(NativeHostInputCodecV2.Hash(AccountOwned) == NativeHostProfileV2.AccountOwnedSha256 &&
            NativeHostInputCodecV2.Hash(AccountComplete) == NativeHostProfileV2.AccountCompleteSha256);
        Check((int)NativeHostStoreFileV2.SetupGrant < (int)NativeHostStoreFileV2.RestrictedKeyIntent &&
            (int)NativeHostStoreFileV2.SetupGrant < (int)NativeHostStoreFileV2.AccessibleKeyIntent &&
            (int)NativeHostStoreFileV2.StandardUserIntent < (int)NativeHostStoreFileV2.AccountActivationIntent &&
            (int)NativeHostStoreFileV2.StandardUserHeldExit < (int)NativeHostStoreFileV2.AccountDisableIntent &&
            (int)NativeHostStoreFileV2.AccountDisabled < (int)NativeHostStoreFileV2.StandardUserComplete);
        foreach (var (intent, grant, report, ack, exit, complete) in new[] {
            (NativeHostStoreFileV2.SetupGrantIntent, NativeHostStoreFileV2.SetupGrant,
                NativeHostStoreFileV2.SetupReport, NativeHostStoreFileV2.SetupAck,
                NativeHostStoreFileV2.SetupHeldExit, NativeHostStoreFileV2.SetupComplete),
            (NativeHostStoreFileV2.GuardianBeforeGrantIntent, NativeHostStoreFileV2.GuardianBeforeGrant,
                NativeHostStoreFileV2.GuardianBeforeReport, NativeHostStoreFileV2.GuardianBeforeAck,
                NativeHostStoreFileV2.GuardianBeforeHeldExit, NativeHostStoreFileV2.GuardianBeforeComplete),
            (NativeHostStoreFileV2.StandardUserGrantIntent, NativeHostStoreFileV2.StandardUserGrant,
                NativeHostStoreFileV2.StandardUserReport, NativeHostStoreFileV2.StandardUserAck,
                NativeHostStoreFileV2.StandardUserHeldExit, NativeHostStoreFileV2.StandardUserComplete),
            (NativeHostStoreFileV2.GuardianAfterGrantIntent, NativeHostStoreFileV2.GuardianAfterGrant,
                NativeHostStoreFileV2.GuardianAfterReport, NativeHostStoreFileV2.GuardianAfterAck,
                NativeHostStoreFileV2.GuardianAfterHeldExit, NativeHostStoreFileV2.GuardianAfterComplete)
        }) {
            Check((int)intent < (int)grant && (int)grant < (int)report &&
                (int)report < (int)ack && (int)ack < (int)exit && (int)exit < (int)complete);
        }
        Check((int)NativeHostStoreFileV2.StandardUserTransferIntent <
            (int)NativeHostStoreFileV2.StandardUserTransferLoans &&
            (int)NativeHostStoreFileV2.StandardUserTransferLoans <
            (int)NativeHostStoreFileV2.StandardUserTransferSeed &&
            (int)NativeHostStoreFileV2.StandardUserTransferSeed <
            (int)NativeHostStoreFileV2.StandardUserTransferReturned &&
            (int)NativeHostStoreFileV2.StandardUserTransferReturned <
            (int)NativeHostStoreFileV2.StandardUserTransferComplete &&
            (int)NativeHostStoreFileV2.StandardUserTransferComplete <
            (int)NativeHostStoreFileV2.StandardUserGrantIntent);
        var w = new World();
        using (JsonDocument planDoc = JsonDocument.Parse(w.Bound.Plan.CanonicalBytes())) {
            JsonElement grammar = planDoc.RootElement.GetProperty("commandGrammar");
            foreach (string name in new[] { "setupStart", "guardianBeforeStart", "guardianAfterStart" })
                Check(grammar.GetProperty(name).GetString()!.EndsWith(
                    "--run-id <lowerhex32> --nonce <lowerhex64>", StringComparison.Ordinal));
        }
        foreach (NativeHostStoreFileV2 file in new[] { NativeHostStoreFileV2.SetupIntent,
            NativeHostStoreFileV2.GuardianBeforeIntent, NativeHostStoreFileV2.StandardUserIntent,
            NativeHostStoreFileV2.GuardianAfterIntent })
            Check(RunFor(file).Length == 32 && NonceFor(file).Length == 64);
        Check(w.Store.Scope.Attempt == Attempt && w.Store.Scope.Root == w.Bound.Profile.RecordRoot);
        Check(w.Store.Scope.ProfileSha256 == w.Bound.Profile.CanonicalSha256 &&
            w.Store.Scope.SourceSetSha256 == w.Bound.Profile.SourceSetSha256 &&
            w.Store.Scope.PlanSha256 == w.Bound.PlanSha256 &&
            w.Store.Scope.ApprovalSha256 == w.Bound.ApprovalSha256);
        Check(w.Store.Scope.ProfileId == NativeHostProfileV2.ProfileId &&
            w.Store.Scope.Effects == NativeHostProfileV2.Effects);
        Check(!w.Store.NativeEvidenceEstablished && !w.Store.PhysicalDurabilityProven &&
            !w.Store.GrantAuthorized && !w.Store.Lic008Closed);
        string[] paths = all.Select(w.Store.PathOf).ToArray();
        Check(paths.Distinct(StringComparer.OrdinalIgnoreCase).Count() == all.Length);
        foreach (string path in paths) {
            Check(path.StartsWith(w.Store.Scope.Root + @"\", StringComparison.Ordinal) &&
                !path.Contains(new string('1', 32), StringComparison.Ordinal) &&
                !path.Contains(new string('5', 32), StringComparison.Ordinal));
        }
        Refused(() => NativeHostStageStoreV2.Relative((NativeHostStoreFileV2)(-1)));
        Refused(() => NativeHostStageStoreV2.Relative((NativeHostStoreFileV2)68));
        foreach (NativeHostStoreFileV2 file in all) {
            Check(!NativeHostStageStoreV2.CanWrite(NativeHostRole.User, file));
            Check(!NativeHostStageStoreV2.CanWrite(NativeHostRole.Guardian, file));
            bool setup = file is >= NativeHostStoreFileV2.RestrictedKeyIntent and
                <= NativeHostStoreFileV2.AccessibleKeyComplete;
            Check(NativeHostStageStoreV2.CanWrite(NativeHostRole.Setup, file) == setup);
            Check(NativeHostStageStoreV2.CanWrite(NativeHostRole.Owner, file) == !setup);
        }
        Refused(() => NativeHostStageStoreV2.CanWrite((NativeHostRole)99, NativeHostStoreFileV2.Profile));
        Refused(() => NativeHostStageStoreV2.CanWrite(NativeHostRole.Owner, (NativeHostStoreFileV2)99));

        string previous = "";
        foreach (NativeHostStoreFileV2 file in all) {
            NativeHostStoredOriginalV2 saved = w.Write(file, previous);
            byte[] original = saved.OriginalBytes();
            Check(saved.File == file && saved.Receipt.File == file && saved.Receipt.Scope == w.Store.Scope);
            Check(saved.Receipt.Path == w.Store.PathOf(file) && saved.Receipt.Sha256 == saved.Sha256 &&
                saved.Receipt.Length == original.Length && saved.Receipt.CreateNew &&
                saved.Receipt.ProtectedAcl && saved.Receipt.DurablyFlushed && saved.Receipt.ExactReadback);
            Check(w.Sink.Files[saved.Receipt.Path].AsSpan().SequenceEqual(original));
            Check(w.Store.ReadCompleted(NativeHostRole.Owner, file).AsSpan().SequenceEqual(original));
            if (!NativeHostStageStoreV2.IsInput(file)) {
                using JsonDocument doc = JsonDocument.Parse(original);
                JsonElement root = doc.RootElement;
                Check(root.GetProperty("schema").GetString() == NativeHostStageStoreV2.EventSchema &&
                    root.GetProperty("slot").GetString() == file.ToString() &&
                    root.GetProperty("profileSha256").GetString() == w.Store.Scope.ProfileSha256 &&
                    root.GetProperty("sourceSetSha256").GetString() == w.Store.Scope.SourceSetSha256 &&
                    root.GetProperty("planSha256").GetString() == w.Store.Scope.PlanSha256 &&
                    root.GetProperty("approvalSha256").GetString() == w.Store.Scope.ApprovalSha256);
                Check(root.GetProperty("run").GetString() == RunFor(file) &&
                    root.GetProperty("nonce").GetString() == NonceFor(file) &&
                    root.GetProperty("previousSha256").GetString() == previous &&
                    root.GetProperty("evidenceSha256").GetString() == EvidenceFor(file));
                Check(!root.GetProperty("nativeEvidenceEstablished").GetBoolean() &&
                    !root.GetProperty("physicalDurabilityProven").GetBoolean() &&
                    !root.GetProperty("grantAuthorized").GetBoolean() &&
                    !root.GetProperty("lic008Closed").GetBoolean());
            }
            original[0] ^= 1;
            Check(w.Store.ReadCompleted(NativeHostRole.Owner, file)[0] != original[0]);
            previous = saved.Sha256;
        }
        Check(w.Store.CompletedCount == all.Length && w.Sink.Creates == all.Length);
        Check(w.Store.Evidence().Length == all.Length && w.Store.Evidence().All(x =>
            x.WriteEntered && x.ReceiptAdmitted && x.ReadbackAdmitted));
        Check(!w.Store.Faulted && !w.Store.NativeEvidenceEstablished && !w.Store.GrantAuthorized);
        Refused(() => w.Write(NativeHostStoreFileV2.Profile, ""));
        Check(w.Store.Faulted && w.Sink.Creates == all.Length);

        // A missing or changed predecessor, role error, and wrong original
        // close a session before the next CreateNew effect.
        var early = new World();
        Refused(() => early.Write(NativeHostStoreFileV2.SourceSet, ""));
        Check(early.Store.Faulted && early.Sink.Creates == 0);
        var prematureConsumed = new World();
        Refused(() => prematureConsumed.Write(NativeHostStoreFileV2.AttemptConsumed, ""));
        Check(prematureConsumed.Store.Faulted && prematureConsumed.Sink.Creates == 0);
        var wrongRole = new World();
        Refused(() => wrongRole.Write(NativeHostStoreFileV2.Profile, "", NativeHostRole.Setup));
        Check(wrongRole.Store.Faulted && wrongRole.Sink.Creates == 0);
        var wrongOriginal = new World();
        Refused(() => wrongOriginal.Write(NativeHostStoreFileV2.Profile, "", input:
            Encoding.UTF8.GetBytes("{\"schema\":\"OLD_PROFILE\"}")));
        Check(wrongOriginal.Store.Faulted && wrongOriginal.Sink.Creates == 0);
        var wrongPredecessor = new World();
        string firstSha = wrongPredecessor.Write(NativeHostStoreFileV2.Profile, "").Sha256;
        Refused(() => wrongPredecessor.Write(NativeHostStoreFileV2.SourceSet, new string('a', 64)));
        Check(wrongPredecessor.Store.Faulted && wrongPredecessor.Sink.Creates == 1);
        var changedPredecessor = new World();
        firstSha = changedPredecessor.Write(NativeHostStoreFileV2.Profile, "").Sha256;
        changedPredecessor.Sink.Files[changedPredecessor.Store.PathOf(NativeHostStoreFileV2.Profile)][0] ^= 1;
        Refused(() => changedPredecessor.Write(NativeHostStoreFileV2.SourceSet, firstSha));
        Check(changedPredecessor.Store.Faulted && changedPredecessor.Sink.Creates == 1);

        foreach (byte[] bad in new[] {
            Encoding.UTF8.GetBytes("{\"x\":1,\"x\":2}"),
            Encoding.UTF8.GetBytes("{ \"schema\":\"TEST_SOURCE_SET\"}"),
            Encoding.UTF8.GetBytes("{\"schema\":\"TEST_SOURCE_SET\",}"),
            new byte[] { 0xef, 0xbb, 0xbf, 0x7b, 0x7d },
            new byte[] { 0x7b, 0xff, 0x7d }
        }) {
            // Even an exact digest from a bound plan does not admit malformed
            // or noncanonical external JSON into a protected input slot.
            var badInput = new World(source: bad);
            firstSha = badInput.AdvanceTo(NativeHostStoreFileV2.SourceSet);
            Refused(() => badInput.Write(NativeHostStoreFileV2.SourceSet, firstSha));
            Check(badInput.Store.Faulted && badInput.Sink.Creates == 1);
        }
        var wrongSourceHash = new World();
        firstSha = wrongSourceHash.AdvanceTo(NativeHostStoreFileV2.SourceSet);
        Refused(() => wrongSourceHash.Write(NativeHostStoreFileV2.SourceSet, firstSha,
            input: Encoding.UTF8.GetBytes("{}")));
        Check(wrongSourceHash.Store.Faulted && wrongSourceHash.Sink.Creates == 1);
        var changedAccountOriginal = new World();
        firstSha = changedAccountOriginal.AdvanceTo(NativeHostStoreFileV2.AccountOwned);
        byte[] changedAccount = (byte[])AccountOwned.Clone();
        changedAccount[^2] ^= 1;
        Refused(() => changedAccountOriginal.Write(NativeHostStoreFileV2.AccountOwned,
            firstSha, input: changedAccount));
        Check(changedAccountOriginal.Store.Faulted &&
            changedAccountOriginal.Sink.Creates == (int)NativeHostStoreFileV2.AccountOwned);

        // Receipt flags, typed binding, creation identity and time are injected
        // facts; any mismatch is rejected even after CreateNew has happened.
        Func<NativeHostStoreReceiptV2, NativeHostStoreReceiptV2>[] mutations = {
            r => r with { File = NativeHostStoreFileV2.Plan },
            r => r with { Path = r.Path + "x" },
            r => r with { Sha256 = new string('f', 64) },
            r => r with { Length = r.Length + 1 },
            r => r with { Scope = r.Scope with { PlanSha256 = new string('f', 64) } },
            r => r with { VolumeSerial = 0 },
            r => r with { FileIndex = 0 },
            r => r with { CreationFileTimeUtc = 0 },
            r => r with { WrittenUtc = Issued.AddMinutes(-1) },
            r => r with { CreateNew = false },
            r => r with { ProtectedAcl = false },
            r => r with { DurablyFlushed = false },
            r => r with { ExactReadback = false }
        };
        foreach (var mutation in mutations) {
            var badReceipt = new World();
            badReceipt.Sink.ChangeReceipt = mutation;
            Refused(() => badReceipt.Write(NativeHostStoreFileV2.Profile, ""));
            Check(badReceipt.Store.Faulted && badReceipt.Sink.Creates == 1 &&
                badReceipt.Store.Evidence().Single().WriteEntered &&
                !badReceipt.Store.Evidence().Single().ReadbackAdmitted);
            Refused(() => badReceipt.Write(NativeHostStoreFileV2.Profile, ""));
            Check(badReceipt.Sink.Creates == 1);
        }

        var changedReadback = new World();
        changedReadback.Sink.ChangeRead = (_, raw) => { raw[0] ^= 1; return raw; };
        Refused(() => changedReadback.Write(NativeHostStoreFileV2.Profile, ""));
        Check(changedReadback.Store.Faulted && changedReadback.Sink.Creates == 1 &&
            changedReadback.Store.Evidence().Single().ReceiptAdmitted &&
            !changedReadback.Store.Evidence().Single().ReadbackAdmitted);
        var unknown = new World();
        unknown.Sink.ThrowAfterCreate = true;
        Refused(() => unknown.Write(NativeHostStoreFileV2.Profile, ""));
        Check(unknown.Store.Faulted && unknown.Sink.Files.Count == 1 && unknown.Sink.Creates == 1 &&
            unknown.Store.Evidence().Single().WriteEntered);
        Refused(() => unknown.Write(NativeHostStoreFileV2.Profile, ""));
        Check(unknown.Sink.Creates == 1);

        var shared = new World();
        Check(shared.Write(NativeHostStoreFileV2.Profile, "").File ==
            NativeHostStoreFileV2.Profile);
        var second = new NativeHostStageStoreV2(shared.Bound, shared.Sink, shared.Guard,
            () => shared.Clock);
        Refused(() => second.WriteNew(NativeHostRole.Owner, NativeHostStoreFileV2.Profile,
            shared.Bound.Profile.CanonicalBytes(), "", "", "", ""));
        Check(second.Faulted && second.Evidence().Single().WriteEntered &&
            shared.Sink.Creates == 2 && shared.Sink.Files.Count == 1);
        Refused(() => second.WriteNew(NativeHostRole.Owner, NativeHostStoreFileV2.Profile,
            shared.Bound.Profile.CanonicalBytes(), "", "", "", ""));
        Check(shared.Sink.Creates == 2 && !shared.Store.Faulted);

        var postCreateGuard = new World();
        postCreateGuard.Guard.OnVerify = point => {
            if (point == "AFTER_CREATE_NEW") throw new InvalidDataException("FAKE_POST_CREATE_CUSTODY_LOST");
        };
        Refused(() => postCreateGuard.Write(NativeHostStoreFileV2.Profile, ""));
        Check(postCreateGuard.Store.Faulted && postCreateGuard.Sink.Files.Count == 1 &&
            postCreateGuard.Store.Evidence().Single().WriteEntered);

        var identityCollision = new World();
        firstSha = identityCollision.Write(NativeHostStoreFileV2.Profile, "").Sha256;
        identityCollision.Sink.ChangeReceipt = r => r with { FileIndex = 100 };
        Refused(() => identityCollision.Write(NativeHostStoreFileV2.SourceSet, firstSha));
        Check(identityCollision.Store.Faulted && identityCollision.Sink.Creates == 2 &&
            identityCollision.Store.CompletedCount == 1);

        var reentry = new World();
        bool nestedRefused = false;
        reentry.Sink.OnCreate = () => {
            try { reentry.Write(NativeHostStoreFileV2.Profile, ""); }
            catch (InvalidDataException) { nestedRefused = true; }
        };
        Refused(() => reentry.Write(NativeHostStoreFileV2.Profile, ""));
        Check(nestedRefused && reentry.Store.Faulted && reentry.Sink.Creates == 1 &&
            reentry.Store.Evidence().Single().WriteEntered);
        var pendingEvidence = new World();
        pendingEvidence.Sink.OnCreate = () => Refused(() => pendingEvidence.Store.Evidence());
        Check(pendingEvidence.Write(NativeHostStoreFileV2.Profile, "").File ==
            NativeHostStoreFileV2.Profile);
        Check(!pendingEvidence.Store.Faulted && pendingEvidence.Sink.Creates == 1);
        var clockRollback = new World();
        clockRollback.Guard.OnVerify = _ => clockRollback.Clock = Now.AddMinutes(-1);
        Refused(() => clockRollback.Write(NativeHostStoreFileV2.Profile, ""));
        Check(clockRollback.Store.Faulted && clockRollback.Sink.Creates == 0);
        var expired = new World { Clock = Issued.AddHours(2) };
        Refused(() => expired.Write(NativeHostStoreFileV2.Profile, ""));
        Check(expired.Store.Faulted && expired.Sink.Creates == 0);

        foreach (var (required, skippedTo) in new[] {
            (NativeHostStoreFileV2.AttemptConsumed, NativeHostStoreFileV2.ServiceSetupIntent),
            (NativeHostStoreFileV2.SetupGrant, NativeHostStoreFileV2.RestrictedKeyIntent),
            (NativeHostStoreFileV2.StandardUserTransferIntent, NativeHostStoreFileV2.StandardUserTransferSeed),
            (NativeHostStoreFileV2.StandardUserTransferReturned, NativeHostStoreFileV2.StandardUserTransferComplete),
            (NativeHostStoreFileV2.StandardUserGrantIntent, NativeHostStoreFileV2.StandardUserGrant),
            (NativeHostStoreFileV2.StandardUserReport, NativeHostStoreFileV2.StandardUserAck),
            (NativeHostStoreFileV2.StandardUserHeldExit, NativeHostStoreFileV2.AccountDisableIntent),
            (NativeHostStoreFileV2.AccountDisableIntent, NativeHostStoreFileV2.AccountDisabled)
        }) {
            var skip = new World();
            firstSha = skip.AdvanceTo(required);
            Refused(() => skip.Write(skippedTo, firstSha));
            Check(skip.Store.Faulted && skip.Sink.Creates == (int)required &&
                !skip.Store.Evidence().Any(x => x.File == skippedTo));
        }

        var runChanged = new World();
        firstSha = runChanged.AdvanceTo(NativeHostStoreFileV2.ServiceSetupAdmitted);
        Refused(() => runChanged.Write(NativeHostStoreFileV2.ServiceSetupAdmitted, firstSha,
            run: new string('9', 32)));
        Check(runChanged.Store.Faulted && runChanged.Sink.Creates == (int)NativeHostStoreFileV2.ServiceSetupAdmitted);
        var nonceChanged = new World();
        firstSha = nonceChanged.AdvanceTo(NativeHostStoreFileV2.ServiceSetupAdmitted);
        Refused(() => nonceChanged.Write(NativeHostStoreFileV2.ServiceSetupAdmitted, firstSha,
            nonce: new string('9', 64)));
        Check(nonceChanged.Store.Faulted && nonceChanged.Sink.Creates == (int)NativeHostStoreFileV2.ServiceSetupAdmitted);
        var shortNonce = new World();
        firstSha = shortNonce.AdvanceTo(NativeHostStoreFileV2.ServiceSetupStart);
        Refused(() => shortNonce.Write(NativeHostStoreFileV2.ServiceSetupStart, firstSha,
            nonce: new string('9', 32)));
        Check(shortNonce.Store.Faulted && shortNonce.Sink.Creates == (int)NativeHostStoreFileV2.ServiceSetupStart);
        var reusedRun = new World();
        firstSha = reusedRun.AdvanceTo(NativeHostStoreFileV2.ServiceGuardianBeforeStart);
        Refused(() => reusedRun.Write(NativeHostStoreFileV2.ServiceGuardianBeforeStart, firstSha,
            run: new string('1', 32)));
        Check(reusedRun.Store.Faulted && reusedRun.Sink.Creates == (int)NativeHostStoreFileV2.ServiceGuardianBeforeStart);
        var badEvidence = new World();
        firstSha = badEvidence.AdvanceTo(NativeHostStoreFileV2.ServiceSetupIntent);
        Refused(() => badEvidence.Write(NativeHostStoreFileV2.ServiceSetupIntent, firstSha,
            evidence: new string('F', 64)));
        Check(badEvidence.Store.Faulted && badEvidence.Sink.Creates == (int)NativeHostStoreFileV2.ServiceSetupIntent);
        var badSlotInput = new World();
        firstSha = badSlotInput.AdvanceTo(NativeHostStoreFileV2.ServiceSetupIntent);
        Refused(() => badSlotInput.Write(NativeHostStoreFileV2.ServiceSetupIntent, firstSha,
            input: Encoding.UTF8.GetBytes("{}")));
        Check(badSlotInput.Store.Faulted && badSlotInput.Sink.Creates == (int)NativeHostStoreFileV2.ServiceSetupIntent);

        return checks;
    }
}
