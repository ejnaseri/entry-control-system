using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardOwnerObjectTransferTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero);
    private static int sequence = 10000;
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static StandardOwnerTransferContext Context(StandardCryptoStage stage = StandardCryptoStage.StandardUser)
    {
        int n = Interlocked.Increment(ref sequence); string attempt = n.ToString("x").PadLeft(32, '0');
        var scope = new StandardCryptoScope(StandardCryptoComparison.Schema, StandardContract.Root, attempt, Start, Start.AddHours(2),
            StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
            H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8));
        var owner = new StandardChannelProcessPin(100, Start.AddMilliseconds(100).UtcDateTime.ToFileTimeUtc(), StandardLaunchPlan.Image,
            StandardLaunchPlan.Assembly, scope.ImageSha256, scope.AssemblySha256, scope.RuntimeSha256, scope.PackageSha256);
        var worker = owner with { ProcessId = 200, CreationFileTimeUtc = Start.AddMilliseconds(200).UtcDateTime.ToFileTimeUtc() };
        StandardChannelPredecessor? predecessor = stage == StandardCryptoStage.Setup ? null : new(stage switch {
            StandardCryptoStage.GuardianBefore => StandardCryptoStage.Setup,
            StandardCryptoStage.StandardUser => StandardCryptoStage.GuardianBefore, _ => StandardCryptoStage.StandardUser },
            H(10), 300, Start.AddMilliseconds(50).UtcDateTime.ToFileTimeUtc());
        StandardChannelKeyPair? keys = stage == StandardCryptoStage.Setup ? null : new(
            new(StandardCryptoArm.Restricted, StandardCryptoComparison.KeyName(attempt, StandardCryptoArm.Restricted), H(11), H(12), H(13), StandardSyntheticEnvelopeCodec.PlaintextHash),
            new(StandardCryptoArm.UserAccessible, StandardCryptoComparison.KeyName(attempt, StandardCryptoArm.UserAccessible), H(14), H(15), H(16), StandardSyntheticEnvelopeCodec.PlaintextHash));
        return new(2, StandardOwnerObjectTransferRules.Purpose, StandardOwnerObjectTransferRules.EffectsV2,
            new(scope, H(20), stage, (n + 1000000).ToString("x").PadLeft(32, '0'), H(n + 2000000), owner, worker, predecessor, keys));
    }
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.Administrators, 1, 1, 2, "S-1-16-12288",
        false, false, true, new[] { new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    private static StandardToken Worker(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.StandardUser => new(StandardContract.UserSid, StandardContract.UserSid, 1, 0, 1, StandardContract.MediumIntegrity,
            false, false, true, new[] { new StandardGroup(StandardContract.Users, 7), new StandardGroup(StandardContract.Interactive, 7) }),
        StandardCryptoStage.Setup => new(StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] {
                new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7), new StandardGroup(StandardCryptoComparison.SetupSid, 7) }),
        _ => new(StandardCryptoComparison.GuardianSid, StandardCryptoComparison.GuardianSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] { new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) }) };
    private sealed class World : IStandardOwnerTransferGuard, IStandardOwnerObjectTransferApi, IStandardOwnerTransferOriginalSink, IStandardChannelClock
    {
        internal readonly StandardOwnerTransferContext Context;
        internal readonly List<string> Events = new(), Guards = new();
        internal readonly Dictionary<StandardOwnerTransferFile, byte[]> Files = new();
        internal readonly Dictionary<StandardOwnerTransferObjectKind, int> Objects = new();
        internal StandardOwnerTransferSlots? Slots;
        internal StandardOwnerObjectTransfer? Model;
        internal StandardOwnerTransferCapture? OriginalReturnedCapture;
        internal byte[]? LastAck, LastRead;
        internal int FailAt = -1, CurrentObject = 2, Duplicates, Compares, CurrentOpens;
        internal bool AuthorizedV2 = true;
        internal uint? ActualPeer;
        internal long Monotonic, UtcTicks;
        internal DateTimeOffset? FixedUtc;
        internal Action<string>? Before, After, AtGuard;
        internal Func<StandardOwnerTransferCapture, StandardOwnerTransferCapture> CaptureMutation = x => x, RecheckMutation = x => x;
        internal Func<StandardOwnerTransferCurrentPrimary, StandardOwnerTransferCurrentPrimary> CurrentMutation = x => x;
        internal Func<StandardPeerObjectObservation, StandardPeerObjectObservation> ReturnedMutation = x => x;
        internal Func<StandardOwnerTransferHandleObservation, StandardOwnerTransferObjectKind, StandardOwnerTransferHandleObservation> DescribeMutation = (x, _) => x;
        internal Func<StandardOwnerTransferAck, StandardOwnerTransferAck> AckMutation = x => x;
        internal Func<byte[], byte[]> AckBytesMutation = x => x;
        internal Func<StandardOwnerTransferReceipt, StandardOwnerTransferReceipt> ReceiptMutation = x => x;
        internal Func<StandardOwnerTransferFile, byte[], byte[]> ReadMutation = (_, x) => x;
        internal Func<StandardOwnerTransferCompareKind, bool>? CompareMutation;
        internal Action<StandardOwnerTransferDuplicateKind>? DuplicateMutation;
        internal World(StandardOwnerTransferContext? context = null) { Context = context ?? StandardOwnerObjectTransferTests.Context(); }
        public DateTimeOffset UtcNow => FixedUtc ?? Start.AddSeconds(2).AddTicks(++UtcTicks);
        public long MonotonicMilliseconds => ++Monotonic;
        private void Hit(string stage, Action? operation = null)
        {
            Before?.Invoke(stage); int index = Events.Count; Events.Add(stage); operation?.Invoke(); After?.Invoke(stage);
            // Failure AFTER an output or durable side effect represents a
            // partially successful call whose outputs must remain retained.
            if (index == FailAt) throw new IOException("FAKE_TRANSFER_PARTIAL_FAILURE");
        }
        internal StandardOwnerObjectTransfer NewModel() => Model = new(Context, this, this, this, this);
        public StandardToken CaptureOwnerAndVerifyV2Custody(StandardOwnerTransferContext context, string hash, string stage)
        {
            StandardContract.Need(AuthorizedV2 && context == Context && hash == StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(Context)),
                "FAKE_ACTUAL_NEW_V2_APPROVAL_CUSTODY_REQUIRED"); Guards.Add(stage); AtGuard?.Invoke(stage); return Owner();
        }
        private StandardChannelProcessObservation Observation(StandardChannelProcessPin pin, StandardToken token) =>
            new(new(pin.ProcessId, pin.CreationFileTimeUtc, pin.ImagePath, token), pin.AssemblyPath, pin.ImageSha256,
                pin.AssemblySha256, pin.RuntimeSha256, pin.PackageSha256);
        private StandardOwnerTransferCapture Capture()
        {
            var owner = Observation(Context.Channel.Controller, Owner()); var worker = Observation(Context.Channel.Worker, Worker(Context.Channel.Stage));
            var ownerStats = new StandardPeerTokenStatistics(101, 102, 103, 1, (uint)owner.Process.Token.Groups!.Count, 5);
            var workerStats = new StandardPeerTokenStatistics(201, 202, 203, 1, (uint)worker.Process.Token.Groups!.Count, 4);
            return new(owner, ownerStats, ownerStats, worker, workerStats, workerStats, 258, 258);
        }
        private void Fill(StandardOwnerTransferObjectKind kind, long value, int objectId)
        {
            var slot = Slots![kind]; StandardContract.Need(slot.Value == 0, "FAKE_TRANSFER_OUTPUT_NOT_EMPTY");
            slot.AttachLifetimeBeforeNativeCall(new object()); slot.Value = value; Objects.Add(kind, objectId);
        }
        public StandardOwnerTransferCapture CaptureOriginals(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots)
        {
            Slots = slots; Hit("capture", () => {
                Fill(StandardOwnerTransferObjectKind.OwnerProcess, 4, 1); Fill(StandardOwnerTransferObjectKind.OwnerPrimaryToken, 8, 2);
                Fill(StandardOwnerTransferObjectKind.WorkerProcess, 12, 3);
            }); OriginalReturnedCapture = CaptureMutation(Capture()); return OriginalReturnedCapture;
        }
        public StandardOwnerTransferCapture RecheckOriginals(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots)
        { StandardContract.Need(ReferenceEquals(slots, Slots), "FAKE_ORIGINAL_HOLDER_CHANGED"); Hit("recheck"); return RecheckMutation(Capture()); }
        public StandardOwnerTransferHandleObservation DescribeLocal(StandardOwnerTransferObjectSlot slot)
        {
            StandardContract.Need(slot.HandleTableProcessId == Context.Channel.Controller.ProcessId && ReferenceEquals(slot, Slots![slot.Kind]),
                "FAKE_REMOTE_HANDLE_LOCAL_ADOPTION"); Hit("describe:" + slot.Kind);
            bool process = Objects[slot.Kind] is 1 or 3;
            return DescribeMutation(new(process ? "Process" : "Token", slot.Value,
                Objects[slot.Kind] == 3 ? 0x101040u : process ? 0x101000u : 8u, 0), slot.Kind);
        }
        public void Duplicate(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots,
            StandardOwnerTransferDuplicateKind kind, uint access, bool inherit, uint options)
        {
            bool process = kind is StandardOwnerTransferDuplicateKind.OwnerProcessToWorker or StandardOwnerTransferDuplicateKind.OwnerProcessBack;
            StandardContract.Need(context == Context && ReferenceEquals(slots, Slots) && access == (process ? 0x101000u : 8u) && !inherit && options == 0 &&
                Files.ContainsKey(StandardOwnerTransferFile.Intent), "FAKE_TRANSFER_DUPLICATE_RECIPE_REFUSED");
            Hit("duplicate:" + kind, () => {
                Duplicates++;
                switch (kind) {
                    // Same numeric values as originalOwner are intentional:
                    // the two handle tables are different and explicitly bound.
                    case StandardOwnerTransferDuplicateKind.OwnerProcessToWorker: Fill(StandardOwnerTransferObjectKind.RemoteOwnerProcess, 4, 1); break;
                    case StandardOwnerTransferDuplicateKind.OwnerTokenToWorker: Fill(StandardOwnerTransferObjectKind.RemoteOwnerToken, 8, 2); break;
                    case StandardOwnerTransferDuplicateKind.OwnerProcessBack: Fill(StandardOwnerTransferObjectKind.ReturnedOwnerProcess, 16, Objects[StandardOwnerTransferObjectKind.RemoteOwnerProcess]); break;
                    case StandardOwnerTransferDuplicateKind.OwnerTokenBack: Fill(StandardOwnerTransferObjectKind.ReturnedOwnerToken, 20, Objects[StandardOwnerTransferObjectKind.RemoteOwnerToken]); break;
                    default: throw new InvalidDataException("FAKE_UNKNOWN_DUPLICATE_KIND");
                }
                DuplicateMutation?.Invoke(kind);
            });
        }
        public StandardOwnerTransferAckRead ReadBootstrapAck(StandardOwnerTransferContext context,
            StandardOwnerTransferSeed seed, string seedHash, uint remaining)
        {
            StandardContract.Need(remaining is > 0 and <= 30000 && Duplicates == 2 && Files.ContainsKey(StandardOwnerTransferFile.StageSeed),
                "FAKE_ACK_BEFORE_DURABLE_SEED"); Hit("ack");
            LastAck = AckBytesMutation(StandardOwnerObjectTransferRules.Encode(AckMutation(new(StandardOwnerObjectTransferRules.AckSchema,
                StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(context)), context.Channel.Stage, context.Channel.RunId, context.Channel.Nonce64,
                context.Channel.Worker.ProcessId, context.Channel.Worker.CreationFileTimeUtc, seed.RemoteOwnerProcess, seed.RemoteOwnerPrimaryToken,
                seed.IntentSha256, seedHash))));
            return new(ActualPeer ?? context.Channel.Worker.ProcessId, LastAck);
        }
        public bool CompareObjectHandles(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots, StandardOwnerTransferCompareKind kind)
        {
            Hit("compare:" + kind, () => Compares++);
            if (CompareMutation is not null) return CompareMutation(kind);
            return kind switch {
                StandardOwnerTransferCompareKind.ReturnedProcess => Objects[StandardOwnerTransferObjectKind.ReturnedOwnerProcess] == Objects[StandardOwnerTransferObjectKind.OwnerProcess],
                StandardOwnerTransferCompareKind.ReturnedToken => Objects[StandardOwnerTransferObjectKind.ReturnedOwnerToken] == Objects[StandardOwnerTransferObjectKind.OwnerPrimaryToken],
                StandardOwnerTransferCompareKind.CurrentPrimaryToken => Objects[StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken] == Objects[StandardOwnerTransferObjectKind.OwnerPrimaryToken],
                _ => false };
        }
        public StandardPeerObjectObservation ObserveReturnedOwnerObjects(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots)
        {
            Hit("observe-returned"); var captured = Capture();
            return ReturnedMutation(new(new(captured.Owner.Process.ProcessId, captured.Owner.Process.CreationFileTimeUtc, captured.Owner.Process.ImagePath),
                captured.Owner.Process.Token, captured.OwnerBefore, 0x101000, 8));
        }
        public StandardOwnerTransferCurrentPrimary ReopenCurrentOwnerPrimary(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots)
        {
            Hit("reopen-current", () => { CurrentOpens++; Fill(StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken, 24, CurrentObject); });
            var captured = Capture(); return CurrentMutation(new(captured.Owner, captured.OwnerBefore, captured.OwnerAfter, 258));
        }
        public StandardOwnerTransferReceipt WriteNew(StandardOwnerTransferContext context, StandardOwnerTransferFile file, byte[] original)
        {
            Hit("write:" + file, () => StandardContract.Need(Files.TryAdd(file, (byte[])original.Clone()), "FAKE_TRANSFER_CREATE_NEW_REFUSED"));
            DateTimeOffset written = UtcNow;
            return ReceiptMutation(new(context, StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(context)), file,
                StandardNativeCryptoRules.Hash(original), original.Length, written, 42, (ulong)Files.Count, written.UtcDateTime.ToFileTimeUtc(),
                true, true, true, file == StandardOwnerTransferFile.StageSeed, true, true));
        }
        public byte[] Read(StandardOwnerTransferContext context, StandardOwnerTransferFile file)
        {
            Hit("read:" + file); LastRead = ReadMutation(file, (byte[])Files[file].Clone()); return LastRead;
        }
    }
    private static bool Complete(StandardOwnerTransferResult result) => result.Outcome == "MODEL_TRANSFER_CHAIN_RECORDED_RETAINED" && result.Failure is null;
    private static bool Pending(StandardOwnerTransferResult result) => !result.NativeExecutionProven && !result.NativeTransferAccepted &&
        !result.OwnerPrimaryAssociationEstablished && !result.WorkerStartupEstablished && !result.LoadedCodeEstablished && !result.BootstrapAuthorized &&
        !result.GrantIssued && !result.Lic008Closed && !result.SecurityAccepted && !result.ProductionAccepted;
    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) { StandardContract.Need(condition, "STANDARD_OWNER_TRANSFER_TEST_FAILED_" + cases); cases++; }
        void Refused(Action operation) { bool refused = false; try { operation(); } catch (InvalidDataException) { refused = true; } Check(refused); }
        void Failed(World w, Action<StandardOwnerTransferResult>? inspect = null) {
            var model = w.NewModel(); var result = model.Execute(); Check(!Complete(result) && result.Failure is not null && Pending(result));
            inspect?.Invoke(result); int count = w.Events.Count; Refused(() => model.Execute()); Check(w.Events.Count == count);
        }
        Check(StandardOwnerObjectTransferRules.EffectsV2 != StandardInputCodec.Effects && StandardOwnerObjectTransferRules.EffectsV2.EndsWith("_V2", StringComparison.Ordinal));
        Check(StandardOwnerObjectTransferRules.ProcessLoanAccess == 0x101000 && StandardOwnerObjectTransferRules.TokenLoanAccess == 8 &&
            StandardOwnerObjectTransferRules.WorkerProcessAccess == 0x101040);
        var baseline = new World(); var baselineModel = baseline.NewModel(); var success = baselineModel.Execute();
        Check(Complete(success) && Pending(success) && success.Originals.Count == 3 && success.Slots.Count == 8);
        Check(baseline.Duplicates == 4 && baseline.Compares == 3 && baseline.CurrentOpens == 1);
        Check(success.Originals.Select(x => x.Record.File).SequenceEqual(new[] { StandardOwnerTransferFile.Intent, StandardOwnerTransferFile.StageSeed, StandardOwnerTransferFile.Complete }));
        Check(success.Originals[0].Record.PreviousSha256 is null && success.Originals[1].Record.PreviousSha256 == success.Originals[0].Sha256 &&
            success.Originals[2].Record.PreviousSha256 == success.Originals[1].Sha256);
        Check(success.Originals[0].Record.Originals is not null && success.Originals[0].Record.SourceHandles == new StandardOwnerTransferLocalHandles(4, 8, 12));
        Check(success.Originals[1].Record.Seed!.IntentSha256 == success.Originals[0].Sha256);
        Check(success.Originals[2].Record.BootstrapAckSha256 == StandardNativeCryptoRules.Hash(Convert.FromBase64String(success.Originals[2].Record.BootstrapAckOriginalBase64!)));
        Check(success.Originals[2].Record.ReturnedOwnerObjects is not null && success.Originals[2].Record.CurrentPrimary is not null);
        Check(success.Slots.Single(x => x.Kind == StandardOwnerTransferObjectKind.OwnerProcess).Value ==
            success.Slots.Single(x => x.Kind == StandardOwnerTransferObjectKind.RemoteOwnerProcess).Value);
        Check(success.Slots.Where(x => x.Kind is StandardOwnerTransferObjectKind.RemoteOwnerProcess or StandardOwnerTransferObjectKind.RemoteOwnerToken)
            .All(x => x.HandleTableProcessId == baseline.Context.Channel.Worker.ProcessId && x.HandleTableCreationFileTimeUtc == baseline.Context.Channel.Worker.CreationFileTimeUtc));
        Check(baseline.Events.IndexOf("write:Intent") < baseline.Events.IndexOf("duplicate:OwnerProcessToWorker") &&
            baseline.Events.IndexOf("duplicate:OwnerTokenToWorker") < baseline.Events.IndexOf("write:StageSeed") &&
            baseline.Events.IndexOf("write:StageSeed") < baseline.Events.IndexOf("ack") && baseline.Events.IndexOf("ack") < baseline.Events.IndexOf("duplicate:OwnerProcessBack") &&
            baseline.Events.IndexOf("compare:CurrentPrimaryToken") < baseline.Events.IndexOf("write:Complete"));
        Refused(() => baselineModel.Execute());
        foreach (var stage in new[] { StandardCryptoStage.Setup, StandardCryptoStage.GuardianBefore, StandardCryptoStage.GuardianAfter }) {
            var w = new World(Context(stage)); var result = w.NewModel().Execute(); Check(Complete(result) && Pending(result));
        }
        for (int failAt = 0; failAt < baseline.Events.Count; failAt++) {
            var w = new World { FailAt = failAt };
            Failed(w, result => {
                Check(result.Failure!.Category == nameof(IOException) && result.Slots.Count == 8 && w.Events.Count == failAt + 1);
                if (baseline.Events[failAt].StartsWith("duplicate:", StringComparison.Ordinal)) {
                    Check(result.Failure.DuplicateCallEntered && result.Slots.Count(x => x.Value > 0) >= 4);
                }
                if (baseline.Events[failAt] == "reopen-current") Check(result.Slots.Single(x => x.Kind == StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken).Value > 0);
                Check(!w.Events.Any(x => x.Contains("close", StringComparison.OrdinalIgnoreCase) || x.Contains("grant", StringComparison.OrdinalIgnoreCase)));
            });
        }
        // All distinct guard-before/after stages are exercised. Repeated original
        // readbacks are independently covered at every injected API boundary.
        foreach (string stage in baseline.Guards.Distinct(StringComparer.Ordinal)) {
            var w = new World(); w.AtGuard = current => { if (current == stage) throw new InvalidDataException("FAKE_TRANSFER_GUARD_LOST"); };
            Failed(w, result => Check(result.Failure!.Category == nameof(InvalidDataException)));
        }
        foreach (var kind in Enum.GetValues<StandardOwnerTransferCompareKind>()) {
            var w = new World { CompareMutation = actual => actual != kind };
            Failed(w, result => { Check(result.Failure!.CompareCallEntered); Check(!w.Files.ContainsKey(StandardOwnerTransferFile.Complete)); });
        }
        { var w = new World { CurrentObject = 999 }; Failed(w, r => Check(r.Failure!.CurrentPrimaryOpenEntered && w.CurrentOpens == 1)); }
        foreach (var target in new[] { StandardOwnerTransferDuplicateKind.OwnerProcessToWorker, StandardOwnerTransferDuplicateKind.OwnerTokenToWorker }) {
            var w = new World(); w.DuplicateMutation = kind => {
                if (kind == target) w.Objects[kind == StandardOwnerTransferDuplicateKind.OwnerProcessToWorker ?
                    StandardOwnerTransferObjectKind.RemoteOwnerProcess : StandardOwnerTransferObjectKind.RemoteOwnerToken] = 999;
            }; Failed(w, _ => Check(w.CurrentOpens == 0));
        }
        foreach (var kind in new[] { StandardOwnerTransferObjectKind.OwnerProcess, StandardOwnerTransferObjectKind.OwnerPrimaryToken,
            StandardOwnerTransferObjectKind.WorkerProcess, StandardOwnerTransferObjectKind.ReturnedOwnerProcess,
            StandardOwnerTransferObjectKind.ReturnedOwnerToken, StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken }) {
            foreach (int field in new[] { 0, 1, 2, 3 }) {
                var w = new World(); w.DescribeMutation = (value, actual) => actual != kind ? value : field switch {
                    0 => value with { GrantedAccess = value.GrantedAccess | 0x40 }, 1 => value with { Flags = 1 },
                    2 => value with { TypeName = value.TypeName == "Process" ? "Token" : "Process" }, _ => value with { Value = value.Value + 4 } };
                // WorkerProcess already needs DUP_HANDLE, so clear it instead.
                if (kind == StandardOwnerTransferObjectKind.WorkerProcess && field == 0)
                    w.DescribeMutation = (value, actual) => actual == kind ? value with { GrantedAccess = 0x101000 } : value;
                Failed(w);
            }
        }
        Func<StandardOwnerTransferCapture, StandardOwnerTransferCapture>[] badCaptures = {
            c => c with { OwnerWait = 0 }, c => c with { WorkerWait = 0 },
            c => c with { OwnerBefore = c.OwnerBefore with { TokenId = 0 } },
            c => c with { OwnerBefore = c.OwnerBefore with { AuthenticationId = 0 } },
            c => c with { OwnerBefore = c.OwnerBefore with { ModifiedId = 0 } },
            c => c with { OwnerBefore = c.OwnerBefore with { TokenType = 2 } },
            c => c with { OwnerBefore = c.OwnerBefore with { GroupCount = 0 } },
            c => c with { OwnerBefore = c.OwnerBefore with { PrivilegeCount = 1025 } },
            c => c with { OwnerAfter = c.OwnerAfter with { ModifiedId = 999 } },
            c => c with { WorkerAfter = c.WorkerAfter with { TokenId = 999 } },
            c => c with { Worker = c.Worker with { Process = c.Worker.Process with { ProcessId = 999 } } },
            c => c with { Worker = c.Worker with { Process = c.Worker.Process with { CreationFileTimeUtc = c.Worker.Process.CreationFileTimeUtc + 1 } } },
            c => c with { Worker = c.Worker with { RuntimeSha256 = H(999) } },
            c => c with { Owner = c.Owner with { AssemblySha256 = H(999) } },
            c => c with { Worker = c.Worker with { Process = c.Worker.Process with { Token = Owner() } } },
            c => c with { Owner = c.Owner with { Process = c.Owner.Process with { Token = c.Owner.Process.Token with { QueryComplete = false } } } }
        };
        foreach (var mutation in badCaptures) {
            var w = new World { CaptureMutation = mutation }; Failed(w, _ => Check(w.Duplicates == 0 && w.Files.Count == 0));
        }
        foreach (var mutation in badCaptures) {
            var w = new World { RecheckMutation = mutation }; Failed(w, _ => Check(w.Duplicates == 0));
        }
        Func<StandardOwnerTransferCurrentPrimary, StandardOwnerTransferCurrentPrimary>[] badCurrent = {
            c => c with { OwnerWait = 0 }, c => c with { Before = c.Before with { TokenId = 999 }, After = c.After with { TokenId = 999 } },
            c => c with { Before = c.Before with { ModifiedId = 999 }, After = c.After with { ModifiedId = 999 } },
            c => c with { After = c.After with { AuthenticationId = 999 } },
            c => c with { Owner = c.Owner with { Process = c.Owner.Process with { CreationFileTimeUtc = c.Owner.Process.CreationFileTimeUtc + 1 } } },
            c => c with { Owner = c.Owner with { Process = c.Owner.Process with { Token = c.Owner.Process.Token with { Owner = StandardContract.OwnerSid } } } }
        };
        foreach (var mutation in badCurrent) { var w = new World { CurrentMutation = mutation }; Failed(w, r => Check(r.Failure!.CurrentPrimaryOpenEntered)); }
        Func<StandardPeerObjectObservation, StandardPeerObjectObservation>[] badReturned = {
            r => r with { Process = r.Process with { ProcessId = 999 } }, r => r with { ProcessGrantedAccess = 0x101040 },
            r => r with { TokenGrantedAccess = 0x28 }, r => r with { Statistics = r.Statistics with { TokenId = 999 } },
            r => r with { Token = r.Token with { Owner = StandardContract.OwnerSid } }
        };
        foreach (var mutation in badReturned) { var w = new World { ReturnedMutation = mutation }; Failed(w, _ => Check(w.CurrentOpens == 0)); }
        Func<StandardOwnerTransferAck, StandardOwnerTransferAck>[] badAck = {
            a => a with { Schema = "V1" }, a => a with { ContextSha256 = H(999) }, a => a with { Stage = StandardCryptoStage.Setup },
            a => a with { RunId = "f".PadLeft(32, '0') }, a => a with { Nonce64 = H(999) }, a => a with { WorkerProcessId = 999 },
            a => a with { WorkerCreationFileTimeUtc = a.WorkerCreationFileTimeUtc + 1 }, a => a with { RemoteOwnerProcess = a.RemoteOwnerPrimaryToken },
            a => a with { RemoteOwnerPrimaryToken = a.RemoteOwnerProcess }, a => a with { IntentSha256 = H(999) }, a => a with { SeedSha256 = H(999) }
        };
        foreach (var mutation in badAck) { var w = new World { AckMutation = mutation }; Failed(w, r => Check(r.Failure!.BootstrapReadEntered && w.Duplicates == 2 && w.Compares == 0)); }
        { var w = new World { ActualPeer = 999 }; Failed(w, _ => Check(w.Duplicates == 2)); }
        Func<byte[], byte[]>[] malformedAck = {
            b => Encoding.UTF8.GetBytes(" " + Encoding.UTF8.GetString(b)),
            b => Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(b).Replace("{", "{\"schema\":\"duplicate\",", StringComparison.Ordinal)),
            b => Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(b)[..^1] + ",\"associationEstablished\":true}"),
            b => Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(b).Replace("\"schema\"", "\"Schema\"", StringComparison.Ordinal)),
            b => new byte[] { 0xff, 0xfe }, b => new byte[] { 0xef, 0xbb, 0xbf }.Concat(b).ToArray(),
            _ => Encoding.UTF8.GetBytes("[]"), _ => Encoding.UTF8.GetBytes("null"), _ => new byte[8193], _ => Array.Empty<byte>()
        };
        foreach (var mutation in malformedAck) { var w = new World { AckBytesMutation = mutation }; Failed(w, _ => Check(w.Duplicates == 2)); }
        Func<StandardOwnerTransferReceipt, StandardOwnerTransferReceipt>[] badReceipts = {
            r => r with { ContextSha256 = H(999) }, r => r with { Sha256 = H(999) }, r => r with { Length = r.Length + 1 },
            r => r with { File = (StandardOwnerTransferFile)99 }, r => r with { VolumeSerial = 0 }, r => r with { FileIndex = 0 },
            r => r with { WrittenUtc = Start.AddHours(3) }, r => r with { CreationFileTimeUtc = Start.UtcDateTime.ToFileTimeUtc() },
            r => r with { CreateNew = false }, r => r with { Protected = false }, r => r with { OwnerOnlyWriter = false },
            r => r with { WorkerReadable = !r.WorkerReadable }, r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false },
            r => r with { Context = r.Context with { Effects = StandardInputCodec.Effects } }
        };
        foreach (var file in Enum.GetValues<StandardOwnerTransferFile>()) foreach (var mutation in badReceipts) {
            var w = new World { ReceiptMutation = r => r.File == file ? mutation(r) : r };
            Failed(w, r => { Check(r.Failure!.DurableWriteEntered); Check(file != StandardOwnerTransferFile.Intent || w.Duplicates == 0); });
        }
        foreach (var file in new[] { StandardOwnerTransferFile.StageSeed, StandardOwnerTransferFile.Complete }) {
            var w = new World { ReceiptMutation = r => r.File == file ? r with { FileIndex = 1 } : r }; Failed(w);
        }
        foreach (var file in Enum.GetValues<StandardOwnerTransferFile>()) {
            var w = new World { ReadMutation = (actual, bytes) => { if (actual == file) bytes[0] ^= 1; return bytes; } }; Failed(w);
        }
        {
            var w = new World(); w.After = value => { if (value == "duplicate:OwnerProcessToWorker") w.Files[StandardOwnerTransferFile.Intent][0] ^= 1; };
            Failed(w, _ => Check(w.Duplicates == 1));
        }
        {
            var w = new World(); w.AtGuard = value => {
                if (value == "CAPTURE_ORIGINALS:AFTER") ((StandardGroup[])w.OriginalReturnedCapture!.Owner.Process.Token.Groups!)[0] = new("S-1-5-18", 7);
                if (value == "BOOTSTRAP_ACK:AFTER") w.LastAck![0] ^= 1;
                if (value.StartsWith("READ_", StringComparison.Ordinal) && value.EndsWith(":AFTER", StringComparison.Ordinal)) w.LastRead![0] ^= 1;
            };
            var result = w.NewModel().Execute(); Check(Complete(result));
            Check(result.Originals[0].Record.Originals!.Owner.Process.Token.Groups![0].Sid == StandardContract.Administrators);
            Check(StandardOwnerObjectTransferRules.DecodeAck(Convert.FromBase64String(result.Originals[2].Record.BootstrapAckOriginalBase64!)).Schema == StandardOwnerObjectTransferRules.AckSchema);
        }
        {
            var w = new World(); w.AtGuard = value => { if (value == "DUPLICATE_OwnerProcessToWorker:BEFORE") w.Slots![StandardOwnerTransferObjectKind.WorkerProcess].Value = 999; };
            Failed(w, _ => Check(w.Duplicates == 0));
        }
        {
            var w = new World(); w.AtGuard = value => { if (value == "DUPLICATE_OwnerProcessToWorker:AFTER") {
                try { w.Model!.Execute(); } catch (InvalidDataException) { } // Even a swallowed reentry poisons the live instance.
            } };
            Failed(w, r => Check(w.Duplicates == 1 && r.Slots.Single(x => x.Kind == StandardOwnerTransferObjectKind.RemoteOwnerProcess).Value > 0));
        }
        {
            var w = new World(); var model = w.NewModel(); using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            w.Before = value => { if (value == "duplicate:OwnerProcessToWorker") { entered.Set(); StandardContract.Need(release.Wait(5000), "FAKE_TRANSFER_WAIT_TIMEOUT"); } };
            Task<StandardOwnerTransferResult> pending = Task.Run(model.Execute); Check(entered.Wait(5000)); Refused(() => model.Execute()); release.Set();
            Check(pending.Wait(5000)); Check(!Complete(pending.Result) && Pending(pending.Result) && w.Duplicates == 1);
        }
        {
            var w = new World(); var model = w.NewModel(); using var entered = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
            w.AtGuard = value => { if (value == "MODEL_COMPLETE_RETAINED") { entered.Set(); StandardContract.Need(release.Wait(5000), "FAKE_TRANSFER_PUBLICATION_WAIT_TIMEOUT"); } };
            Task<StandardOwnerTransferResult> pending = Task.Run(model.Execute); Check(entered.Wait(5000)); Refused(() => model.Execute()); release.Set();
            Check(pending.Wait(5000)); Check(!Complete(pending.Result) && Pending(pending.Result) && pending.Result.Originals.Count == 3);
            Check(w.Duplicates == 4 && w.Compares == 3 && w.Files.ContainsKey(StandardOwnerTransferFile.Complete));
            Refused(() => model.Execute());
        }
        foreach (string boundary in new[] { "duplicate:OwnerProcessToWorker", "ack", "reopen-current" }) {
            var w = new World(); w.After = value => { if (value == boundary) w.FixedUtc = Start.AddHours(2); }; Failed(w);
            w = new World(); w.After = value => { if (value == boundary) w.Monotonic = 30001; }; Failed(w);
        }
        { var w = new World(); w.After = value => { if (value == "capture") w.Monotonic = -1; }; Failed(w); }
        { var w = new World(); w.After = value => { if (value == "capture") w.FixedUtc = Start.AddSeconds(1); }; Failed(w); }
        { var w = new World { AuthorizedV2 = false }; Failed(w, _ => Check(w.Events.Count == 0)); }
        var originalContext = baseline.Context;
        foreach (int reuse in new[] { 0, 1, 2 }) {
            var fresh = Context(); var duplicate = reuse switch {
                0 => fresh with { Channel = fresh.Channel with { RunId = originalContext.Channel.RunId } },
                1 => fresh with { Channel = fresh.Channel with { Nonce64 = originalContext.Channel.Nonce64 } },
                _ => originalContext with { Channel = originalContext.Channel with { RunId = fresh.Channel.RunId, Nonce64 = fresh.Channel.Nonce64 } } };
            var w = new World(duplicate); Failed(w, _ => Check(w.Events.Count == 0));
        }
        Func<StandardOwnerTransferContext, StandardOwnerTransferContext>[] badContexts = {
            c => c with { SchemaVersion = 1 }, c => c with { Purpose = "V1" }, c => c with { Effects = StandardInputCodec.Effects },
            c => c with { Effects = StandardOwnerObjectTransferRules.EffectsV2.ToLowerInvariant() },
            c => c with { Channel = c.Channel with { SourceSetSha256 = "bad" } },
            c => c with { Channel = c.Channel with { Stage = (StandardCryptoStage)99 } },
            c => c with { Channel = c.Channel with { RunId = "bad" } }, c => c with { Channel = c.Channel with { Nonce64 = H(1).ToUpperInvariant() + "a" } },
            c => c with { Channel = c.Channel with { Worker = c.Channel.Worker with { ProcessId = c.Channel.Controller.ProcessId } } },
            c => c with { Channel = c.Channel with { Worker = c.Channel.Worker with { CreationFileTimeUtc = Start.AddHours(3).UtcDateTime.ToFileTimeUtc() } } },
            c => c with { Channel = c.Channel with { Scope = c.Channel.Scope with { AccountSid = StandardContract.OwnerSid } } },
            c => c with { Channel = c.Channel with { Scope = c.Channel.Scope with { Root = StandardContract.Root + "x" } } }
        };
        foreach (var mutation in badContexts) { var w = new World(mutation(Context())); Refused(() => w.NewModel()); Check(w.Events.Count == 0); }
        foreach (DateTimeOffset utc in new[] { Start.AddTicks(-1), Start.AddHours(2), Start.ToOffset(TimeSpan.FromHours(1)) }) {
            var w = new World { FixedUtc = utc }; Refused(() => w.NewModel()); Check(w.Events.Count == 0);
        }
        {
            var slot = new StandardOwnerTransferObjectSlot(StandardOwnerTransferObjectKind.OwnerPrimaryToken, H(1), 100, 10);
            slot.AttachLifetimeBeforeNativeCall(new object()); Refused(() => slot.AttachLifetimeBeforeNativeCall(new object()));
            Refused(() => new StandardOwnerTransferObjectSlot((StandardOwnerTransferObjectKind)99, H(1), 100, 10));
            Refused(() => new StandardOwnerTransferObjectSlot(StandardOwnerTransferObjectKind.OwnerProcess, H(1), 0, 10));
        }
        return cases;
    }
}
