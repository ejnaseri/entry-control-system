using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

// Scripted in-memory byte streams and trusted-adapter fakes only. No pipe,
// process, token, account, service, filesystem or persisted-key API is invoked.
internal static class StandardWorkerChannelTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 20, 0, 0, TimeSpan.Zero);
    private static int attemptCounter;
    private static string H(int value) => value.ToString("x").PadLeft(64, '0');
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.OwnerSid, 1, 1, 2,
        "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    private static StandardToken Worker(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.StandardUser => new(StandardContract.UserSid, StandardContract.UserSid, 1, 0, 1,
            StandardContract.MediumIntegrity, false, false, true, new[] {
                new StandardGroup(StandardContract.Interactive, 7), new StandardGroup(StandardContract.Users, 7) }),
        StandardCryptoStage.Setup => new(StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] {
                new StandardGroup(StandardCryptoComparison.SetupSid, 7), new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) }),
        _ => new(StandardCryptoComparison.GuardianSid, StandardCryptoComparison.GuardianSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] { new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) })
    };
    private static StandardChannelContext Context(StandardCryptoStage stage)
    {
        int number = Interlocked.Increment(ref attemptCounter); string attempt = number.ToString("x").PadLeft(32, '0');
        var scope = new StandardCryptoScope(StandardCryptoComparison.Schema, StandardContract.Root, attempt, Start, Start.AddHours(2),
            StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
            StandardContract.OwnerSid, H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8));
        StandardChannelProcessPin Pin(uint pid, double seconds, bool worker) => new(pid, Start.AddSeconds(seconds).UtcDateTime.ToFileTimeUtc(),
            StandardLaunchPlan.Image, worker ? StandardLaunchPlan.Assembly : @"E:\EntryControlSystem\out\owner-kit\StandardControl.dll",
            scope.ImageSha256, scope.AssemblySha256, scope.RuntimeSha256, scope.PackageSha256);
        StandardChannelKeyPin Key(StandardCryptoArm arm) => new(arm, StandardCryptoComparison.KeyName(attempt, arm),
            H(arm == StandardCryptoArm.Restricted ? 10 : 11), H(arm == StandardCryptoArm.Restricted ? 12 : 13),
            H(arm == StandardCryptoArm.Restricted ? 14 : 15), StandardSyntheticEnvelopeCodec.PlaintextHash);
        var predecessor = stage == StandardCryptoStage.Setup ? null : new StandardChannelPredecessor(stage switch {
            StandardCryptoStage.GuardianBefore => StandardCryptoStage.Setup, StandardCryptoStage.StandardUser => StandardCryptoStage.GuardianBefore,
            _ => StandardCryptoStage.StandardUser }, H(16), 333, Start.AddMilliseconds(500).UtcDateTime.ToFileTimeUtc());
        return new(scope, H(17), stage, (number + 100000).ToString("x").PadLeft(32, '0'), H(number + 200000),
            Pin(111, 1, false), Pin(222, 2, true), predecessor,
            stage == StandardCryptoStage.Setup ? null : new(Key(StandardCryptoArm.Restricted), Key(StandardCryptoArm.UserAccessible)));
    }
    private static StandardCryptoReport Report(StandardChannelContext c)
    {
        StandardCryptoKey Key(StandardCryptoArm arm) {
            bool accessible = arm == StandardCryptoArm.UserAccessible; string publicHash = H(accessible ? 13 : 12);
            var aces = new List<StandardCryptoAce> { new(StandardCryptoComparison.SystemSid, 0x10000000u, 0, true, false),
                new(StandardCryptoComparison.GuardianSid, 0x10000000u, 0, true, false) };
            if (accessible) aces.Add(new(StandardContract.UserSid, 0x10000000u, 0, true, false));
            return new(arm, StandardCryptoComparison.KeyName(c.Scope.Attempt, arm), StandardCryptoComparison.Provider, "RSA", 3072,
                true, true, 1, 0, StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid, true,
                aces, H(accessible ? 11 : 10), publicHash,
                new("AES-256-GCM", "RSA-OAEP-SHA256", H(accessible ? 15 : 14), StandardSyntheticEnvelopeCodec.PlaintextHash, publicHash));
        }
        StandardCryptoOperation Decrypt(StandardCryptoKey key, int ms) => new(key.Arm, key.Name, key.PublicSha256,
            key.Envelope!.EnvelopeSha256, Start.AddSeconds(3).AddMilliseconds(ms), "DECRYPTED", "DECRYPT", true, null, null, null,
            StandardSyntheticEnvelopeCodec.PlaintextHash);
        var r = Key(StandardCryptoArm.Restricted); var a = Key(StandardCryptoArm.UserAccessible);
        bool setup = c.Stage == StandardCryptoStage.Setup, user = c.Stage == StandardCryptoStage.StandardUser;
        var denied = new StandardCryptoOperation(r.Arm, r.Name, r.PublicSha256, r.Envelope!.EnvelopeSha256,
            Start.AddSeconds(3).AddMilliseconds(400), "FAILED", "OPEN", false, "CRYPTOGRAPHIC", StandardCryptoComparison.BadKeyset, null, null);
        return new(c.Scope, c.Stage, c.RunId, c.Worker.ProcessId, c.Worker.CreationFileTimeUtc, Start.AddSeconds(3), Start.AddSeconds(4),
            user ? null : r, a, setup ? null : user ? denied : Decrypt(r, 400), setup ? null : Decrypt(a, 200));
    }
    private sealed class FakeClock : IStandardChannelClock
    {
        internal DateTimeOffset Utc = Start.AddSeconds(10); internal long Mono = 100; internal long Step;
        public DateTimeOffset UtcNow => Utc;
        public long MonotonicMilliseconds { get { long value = Mono; Mono += Step; return value; } }
    }
    private sealed class World : IStandardWorkerChannelTransport, IStandardChannelCustodyGuard,
        IStandardChannelReportGuard, IStandardChannelOriginalSink
    {
        internal readonly StandardChannelContext Context;
        internal readonly bool IsOwner;
        internal readonly FakeClock Clock = new();
        internal readonly List<string> Events = new();
        internal readonly List<byte> Inbound = new(), Outbound = new();
        internal readonly Lease Controller, Worker, Predecessor;
        internal StandardCryptoReport ExpectedReport;
        internal byte[]? Stored;
        internal bool AckEmitted, NeverExit;
        internal int ReadChunk = int.MaxValue, WriteChunk = int.MaxValue, ReadAt, FailAt = -1;
        internal int WorkCount, WriteCount, ReadCount;
        internal uint MaximumTimeout;
        private int outputParsed, outputLength = -1;
        private byte outputKind;
        internal uint? LocalOverride, PeerOverride;
        internal Func<StandardStoreReceipt, StandardStoreReceipt> ReceiptChange = r => r;
        internal Func<byte[], byte[]> OriginalChange = b => b;
        internal Func<string, Exception?>? Fault;
        internal Action<string>? At;
        internal int? BadReadCount, BadWriteCount;
        internal World(StandardCryptoStage stage, bool owner = true, StandardChannelContext? context = null)
        {
            Context = context ?? StandardWorkerChannelTests.Context(stage); IsOwner = owner; ExpectedReport = Report(Context);
            Controller = new(this, Context.Controller, Owner(), true);
            Worker = new(this, Context.Worker, StandardWorkerChannelTests.Worker(stage), false);
            var previous = Context.Predecessor;
            Predecessor = new(this, new(previous?.ProcessId ?? 333, previous?.CreationFileTimeUtc ?? Start.UtcDateTime.ToFileTimeUtc(),
                StandardLaunchPlan.Image, StandardLaunchPlan.Assembly, H(5), H(6), H(4), H(3)), Owner(), false) { Exited = true };
            RebuildInput();
        }
        internal void Hit(string point) {
            Events.Add(point); At?.Invoke(point);
            if (Events.Count - 1 == FailAt) throw new IOException("SYNTHETIC_CHANNEL_BOUNDARY_FAULT");
            var error = Fault?.Invoke(point); if (error is not null) throw error;
        }
        internal StandardStoreReceipt Receipt(byte[] original) => ReceiptChange(new StandardStoreReceipt(Context.Scope,
            StandardWorkerChannelRules.ReportFile(Context.Stage), StandardNativeCryptoRules.Hash(original), original.Length,
            Start.AddSeconds(5), 123, 456, true, true, true, true) { CreationFileTimeUtc = Start.AddSeconds(5).UtcDateTime.ToFileTimeUtc() });
        internal void RebuildInput() {
            Inbound.Clear(); ReadAt = 0;
            byte[] raw = StandardWorkerChannelCodec.Canonical(ExpectedReport);
            if (IsOwner) Inbound.AddRange(StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Report, raw));
            else {
                Inbound.AddRange(StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Grant, StandardWorkerChannelCodec.Canonical(Context)));
                var ack = new StandardChannelAck(StandardWorkerChannelRules.AckSchema,
                    StandardNativeCryptoRules.Hash(StandardWorkerChannelCodec.Canonical(Context)), StandardNativeCryptoRules.Hash(raw), Receipt(raw));
                Inbound.AddRange(StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Ack, StandardWorkerChannelCodec.Canonical(ack)));
            }
        }
        internal StandardWorkerChannel Channel() => new(Context, IsOwner, this, Controller, Worker, Clock, this);
        internal StandardChannelControllerResult RunOwner() => Channel().RunController(this, this,
            Context.Predecessor is null ? null : Predecessor);
        internal StandardChannelWorkerResult RunUser() => Channel().RunWorker((_, operationGate) => {
            Hit("work"); WorkCount++; operationGate(); return ExpectedReport;
        });
        public uint LocalProcessId => LocalOverride ?? (IsOwner ? Context.Controller.ProcessId : Context.Worker.ProcessId);
        public uint PeerProcessId() { Hit("pipe-peer"); return PeerOverride ?? (IsOwner ? Context.Worker.ProcessId : Context.Controller.ProcessId); }
        public int Read(byte[] buffer, int offset, int count, uint timeoutMilliseconds) {
            Hit("read"); ReadCount++; StandardContract.Need(timeoutMilliseconds is >= 1 and <= 30000 && count <= 65536, "FAKE_TIMEOUT_BOUND");
            MaximumTimeout = Math.Max(MaximumTimeout, timeoutMilliseconds);
            if (BadReadCount is { } invalid) return invalid;
            int read = Math.Min(count, Math.Min(ReadChunk, Inbound.Count - ReadAt));
            for (int i = 0; i < read; i++) buffer[offset + i] = Inbound[ReadAt++]; return read;
        }
        public int Write(byte[] buffer, int offset, int count, uint timeoutMilliseconds) {
            Hit("write"); WriteCount++; StandardContract.Need(timeoutMilliseconds is >= 1 and <= 30000 && count <= 65536, "FAKE_TIMEOUT_BOUND");
            MaximumTimeout = Math.Max(MaximumTimeout, timeoutMilliseconds);
            if (BadWriteCount is { } invalid) return invalid;
            int written = Math.Min(count, WriteChunk); Outbound.AddRange(buffer.AsSpan(offset, written).ToArray());
            while (outputParsed + StandardWorkerChannelRules.Header <= Outbound.Count) {
                if (outputLength < 0) {
                    outputLength = (Outbound[outputParsed + 12] << 24) | (Outbound[outputParsed + 13] << 16) |
                        (Outbound[outputParsed + 14] << 8) | Outbound[outputParsed + 15];
                    outputKind = Outbound[outputParsed + 10];
                }
                if (outputParsed + StandardWorkerChannelRules.Header + outputLength > Outbound.Count) break;
                if (outputKind == (byte)StandardWorkerChannelCodec.Kind.Ack) AckEmitted = true;
                outputParsed += StandardWorkerChannelRules.Header + outputLength; outputLength = -1;
            }
            return written;
        }
        public void Verify(StandardChannelContext context, string stage) { Hit("custody"); StandardContract.Need(context == Context, "FAKE_CONTEXT_DRIFT"); }
        public void VerifyBeforeGrant(StandardChannelContext context) { Hit("pre-grant-evidence"); StandardContract.Need(context == Context, "FAKE_PRE_GRANT_CONTEXT_DRIFT"); }
        public void Verify(StandardChannelContext context, StandardCryptoReport report, string hash) {
            Hit("report-guard"); StandardContract.Need(context == Context && hash == StandardNativeCryptoRules.Hash(StandardWorkerChannelCodec.Canonical(report)), "FAKE_REPORT_DRIFT");
        }
        public StandardStoreReceipt WriteNew(StandardCryptoStage stage, byte[] original) {
            Hit("store-write"); StandardContract.Need(Stored is null && stage == Context.Stage, "FAKE_ORIGINAL_CREATE_NEW_REFUSED");
            Stored = (byte[])original.Clone(); return Receipt(original);
        }
        public byte[] Read(StandardCryptoStage stage) { Hit("store-read"); return OriginalChange((byte[])Stored!.Clone()); }
        internal sealed class Lease : IStandardChannelProcessLease
        {
            private readonly World world; internal StandardChannelProcessPin Pin;
            internal StandardToken Token; internal bool Exited; internal uint Code; internal bool OwnerLease;
            internal Func<StandardChannelProcessObservation, StandardChannelProcessObservation>? Change;
            internal Lease(World world, StandardChannelProcessPin pin, StandardToken token, bool ownerLease) {
                this.world = world; Pin = pin; Token = token; OwnerLease = ownerLease;
            }
            public uint ProcessId => Pin.ProcessId;
            public long CreationFileTimeUtc => Pin.CreationFileTimeUtc;
            public StandardChannelProcessObservation Capture() {
                world.Hit(OwnerLease ? "capture-owner" : "capture-worker");
                var value = new StandardChannelProcessObservation(new(Pin.ProcessId, Pin.CreationFileTimeUtc, Pin.ImagePath, Token),
                    Pin.AssemblyPath, Pin.ImageSha256, Pin.AssemblySha256, Pin.RuntimeSha256, Pin.PackageSha256);
                return Change?.Invoke(value) ?? value;
            }
            public uint Wait(uint milliseconds) {
                world.Hit("wait:" + (OwnerLease ? "owner" : "worker"));
                if (Exited || (!OwnerLease && ReferenceEquals(this, world.Worker) && world.IsOwner && world.AckEmitted && !world.NeverExit)) return 0;
                if (milliseconds > 0) world.Clock.Mono += milliseconds;
                return 258;
            }
            public uint ExitCode() { world.Hit("exit-code"); return Code; }
        }
    }

    internal static int Run()
    {
        int count = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_WORKER_CHANNEL_TEST_FAILED_" + count); count++; }
        void Refused(Action action) { bool refused = false; try { action(); } catch (InvalidDataException) { refused = true; } Check(refused); }
        foreach (var stage in Enum.GetValues<StandardCryptoStage>()) {
            var world = new World(stage); var channel = world.Channel(); var result = channel.RunController(world, world, stage == StandardCryptoStage.Setup ? null : world.Predecessor);
            Check(result.Outcome == "REPORT_ACK_AND_HELD_EXIT_OBSERVED" && result.Failure is null && result.HeldExitObserved && result.ExitCode == 0 && result.AckWriteCompleted);
            Check(result.ReportSha256 == StandardNativeCryptoRules.Hash(world.Stored!) && result.Receipt!.File == StandardWorkerChannelRules.ReportFile(stage));
            Check(!result.NativeExecutionProven && !result.SecurityAccepted && !result.ProductionAccepted && !result.Lic008Closed);
            Check(world.MaximumTimeout == StandardWorkerChannelRules.BudgetMilliseconds);
            var adminOwner = new World(stage); adminOwner.Controller.Token = Owner() with { Owner = StandardContract.Administrators };
            Check(adminOwner.RunOwner().Outcome == "REPORT_ACK_AND_HELD_EXIT_OBSERVED");
            int oldWrites = world.WriteCount; var second = channel.RunController(world, world, stage == StandardCryptoStage.Setup ? null : world.Predecessor);
            Check(second.Failure is not null && world.WriteCount == oldWrites);
            var reused = world.Channel().RunController(world, world, stage == StandardCryptoStage.Setup ? null : world.Predecessor);
            Check(reused.Failure is not null && world.WriteCount == oldWrites);
            var worker = new World(stage, false); var user = worker.RunUser();
            Check(user.Outcome == "DURABLE_ACK_VALIDATED_EXIT_NOT_OBSERVED" && user.GrantConsumed && user.WorkEntered && user.AckValidated && user.Failure is null && worker.WorkCount == 1);
            Check(!user.HeldExitObserved && !user.NativeExecutionProven && !user.SecurityAccepted && !user.ProductionAccepted && !user.Lic008Closed);
            foreach (int chunk in new[] { 1, 7, 257 }) {
                var partialOwner = new World(stage) { ReadChunk = chunk, WriteChunk = chunk };
                Check(partialOwner.RunOwner().Outcome == "REPORT_ACK_AND_HELD_EXIT_OBSERVED");
                var partialWorker = new World(stage, false) { ReadChunk = chunk, WriteChunk = chunk };
                Check(partialWorker.RunUser().AckValidated);
            }
            // One fault at every operation boundary from a successful trace.
            // The two pure endpoints are scripted separately to make each
            // partial failure deterministic without a live IPC connection.
            foreach (bool owner in new[] { true, false }) {
                var baseline = new World(stage, owner); if (owner) _ = baseline.RunOwner(); else _ = baseline.RunUser();
                for (int fault = 0; fault < baseline.Events.Count; fault++) {
                    var failed = new World(stage, owner) { FailAt = fault };
                    if (owner) {
                        var failure = failed.RunOwner(); Check(failure.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && failure.Failure is not null);
                        Check(!failure.AckWriteCompleted || failed.Stored is not null);
                    } else {
                        var failure = failed.RunUser(); Check(!failure.AckValidated && failure.Failure is not null && failed.WorkCount <= 1);
                    }
                }
            }
            foreach (var wrong in new Func<StandardChannelProcessObservation, StandardChannelProcessObservation>[] {
                p => p with { Process = p.Process with { ProcessId = 999 } },
                p => p with { Process = p.Process with { CreationFileTimeUtc = p.Process.CreationFileTimeUtc + 1 } },
                p => p with { Process = p.Process with { ImagePath = @"C:\fake\dotnet.exe" } },
                p => p with { AssemblyPath = p.AssemblyPath + ".old" }, p => p with { ImageSha256 = H(900) },
                p => p with { AssemblySha256 = H(901) }, p => p with { RuntimeSha256 = H(902) }, p => p with { PackageSha256 = H(903) }
            }) {
                var failed = new World(stage); failed.Worker.Change = wrong;
                Check(failed.RunOwner().Failure is not null && failed.Outbound.Count == 0 && failed.Stored is null);
                var userWorld = new World(stage, false); userWorld.Controller.Change = wrong;
                Check(userWorld.RunUser().Failure is not null && userWorld.WorkCount == 0);
            }
            foreach (uint badPid in new uint[] { 0, 111, 999 }) {
                var failed = new World(stage) { PeerOverride = badPid }; Check(failed.RunOwner().Failure is not null && failed.Outbound.Count == 0);
            }
            var badLocal = new World(stage) { LocalOverride = 0 }; Check(badLocal.RunOwner().Failure is not null && badLocal.Outbound.Count == 0);
            foreach (var change in new Func<StandardStoreReceipt, StandardStoreReceipt>[] {
                r => r with { Scope = r.Scope with { PlanSha256 = H(950) } }, r => r with { File = StandardStoreFile.ControllerResult },
                r => r with { Sha256 = H(951) }, r => r with { Length = r.Length + 1 }, r => r with { WrittenUtc = Start },
                r => r with { WrittenUtc = Start.AddHours(3) }, r => r with { VolumeSerial = 0 }, r => r with { FileIndex = 0 },
                r => r with { CreationFileTimeUtc = 0 }, r => r with { CreationFileTimeUtc = Start.AddSeconds(9).UtcDateTime.ToFileTimeUtc() },
                r => r with { CreateNew = false }, r => r with { Protected = false }, r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false }
            }) {
                var failed = new World(stage) { ReceiptChange = change }; var failure = failed.RunOwner();
                Check(failure.Failure?.Stage == "REPORT_DURABLE" && !failed.AckEmitted && failed.Stored is not null);
                var userWorld = new World(stage, false) { ReceiptChange = change }; userWorld.RebuildInput();
                Check(!userWorld.RunUser().AckValidated && userWorld.WorkCount == 1);
            }
            var changedOriginal = new World(stage) { OriginalChange = b => { b[^1] ^= 1; return b; } };
            Check(changedOriginal.RunOwner().Failure?.Stage == "REPORT_DURABLE" && !changedOriginal.AckEmitted);
            var badPredecessor = new World(stage); badPredecessor.Predecessor.Exited = false;
            if (stage != StandardCryptoStage.Setup) Check(badPredecessor.RunOwner().Failure?.Stage == "PREDECESSOR_ADMISSION" && badPredecessor.Outbound.Count == 0);
            var neverExit = new World(stage) { NeverExit = true }; var noExit = neverExit.RunOwner();
            Check(noExit.AckWriteCompleted && !noExit.HeldExitObserved && noExit.Failure?.Stage == "HELD_EXIT_WAIT");
            var exitFailed = new World(stage); exitFailed.Worker.Code = 9; var badExit = exitFailed.RunOwner();
            Check(badExit.HeldExitObserved && badExit.ExitCode == 9 && badExit.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN");
            var exitGetter = new World(stage);
            // Predecessor has its own getter; fail only after the ACK has been
            // durably sent so the signalled CURRENT worker is the observation.
            exitGetter.Fault = point => point == "exit-code" && exitGetter.AckEmitted ? new IOException() : null;
            var getterFailure = exitGetter.RunOwner();
            Check(getterFailure.HeldExitObserved && getterFailure.ExitCode is null && getterFailure.AckWriteCompleted &&
                getterFailure.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN");
            var preGrant = new World(stage) { Fault = point => point == "pre-grant-evidence" ? new InvalidDataException() : null };
            Check(preGrant.RunOwner().Failure?.Stage == "PRE_GRANT_EVIDENCE" && preGrant.Outbound.Count == 0 && preGrant.Stored is null);
            var trailing = new World(stage); trailing.Inbound.Add(1); Check(trailing.RunOwner().Failure is not null && trailing.AckEmitted);
            var wrongLength = new World(stage); wrongLength.Inbound[15] ^= 0xff;
            Check(wrongLength.RunOwner().Failure is not null && !wrongLength.AckEmitted);
            var lostAck = new World(stage, false); lostAck.Inbound.RemoveRange(StandardWorkerChannelRules.Header + StandardWorkerChannelCodec.Canonical(lostAck.Context).Length,
                lostAck.Inbound.Count - StandardWorkerChannelRules.Header - StandardWorkerChannelCodec.Canonical(lostAck.Context).Length);
            var lost = lostAck.RunUser(); Check(lost.GrantConsumed && lost.WorkEntered && !lost.AckValidated && lost.Failure?.Stage == "ACK_READ");
            Action? retained = null; var operationWorld = new World(stage, false);
            var operationResult = operationWorld.Channel().RunWorker((c, gate) => { retained = gate; gate(); return Report(c); });
            Check(operationResult.AckValidated); Refused(() => retained!());
            var background = new World(stage, false); bool backgroundRefused = false;
            var backgroundResult = background.Channel().RunWorker((c, gate) => {
                Task.Run(() => { try { gate(); } catch (InvalidDataException) { backgroundRefused = true; } }).GetAwaiter().GetResult();
                return Report(c);
            }); Check(backgroundRefused && backgroundResult.AckValidated);
        }

        foreach (int headerOffset in new[] { 0, 7, 8, 9, 10, 11, 12 }) {
            byte[] frame = StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Report, Encoding.ASCII.GetBytes("{}"));
            frame[headerOffset] ^= 0xff; Refused(() => StandardWorkerChannelCodec.PayloadLength(frame.AsSpan(0, 16).ToArray(), StandardWorkerChannelCodec.Kind.Report));
        }
        foreach (int length in new[] { 0, 1, 65537, int.MaxValue }) {
            byte[] header = StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Report, Encoding.ASCII.GetBytes("{}"))[..16];
            BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(12), (uint)length);
            Refused(() => StandardWorkerChannelCodec.PayloadLength(header, StandardWorkerChannelCodec.Kind.Report));
        }
        byte[] maximumFrame = StandardWorkerChannelCodec.Frame(StandardWorkerChannelCodec.Kind.Report, new byte[65536]);
        Check(maximumFrame.Length == 65552 && StandardWorkerChannelCodec.PayloadLength(maximumFrame[..16], StandardWorkerChannelCodec.Kind.Report) == 65536);
        int maximumChunk = StandardWorkerChannelCodec.WriteChunkLength(maximumFrame.Length);
        Check(maximumChunk == 65536 && StandardWorkerChannelCodec.WriteChunkLength(maximumFrame.Length - maximumChunk) == 16);
        Refused(() => StandardWorkerChannelCodec.WriteChunkLength(0));
        Refused(() => StandardWorkerChannelCodec.WriteChunkLength(65553));
        foreach (byte[] invalid in new[] { Encoding.UTF8.GetBytes("{} "), Encoding.UTF8.GetBytes("{\"scope\":null,\"scope\":null}"),
            Encoding.UTF8.GetBytes("{\"unknown\":1}"), Encoding.UTF8.GetBytes("[]"), new byte[] { 0xff, 0xff }, new byte[] { 0xef, 0xbb, 0xbf, 123, 125 } })
            Refused(() => StandardWorkerChannelCodec.Parse<StandardChannelContext>(invalid));
        foreach (bool owner in new[] { true, false }) {
            foreach (int bad in new[] { -1, 0, int.MaxValue }) {
                var badRead = new World(StandardCryptoStage.Setup, owner) { BadReadCount = bad };
                Check(owner ? badRead.RunOwner().Failure is not null : badRead.RunUser().Failure is not null);
                var badWrite = new World(StandardCryptoStage.Setup, owner) { BadWriteCount = bad };
                Check(owner ? badWrite.RunOwner().Failure is not null : badWrite.RunUser().Failure is not null);
            }
            var expired = new World(StandardCryptoStage.Setup, owner); expired.Clock.Utc = Start.AddHours(2);
            Check(owner ? expired.RunOwner().Failure is not null : expired.RunUser().Failure is not null); Check(expired.WorkCount == 0 && expired.WriteCount == 0);
            var deadline = new World(StandardCryptoStage.Setup, owner); deadline.Clock.Step = 10000;
            Check(owner ? deadline.RunOwner().Failure is not null : deadline.RunUser().Failure is not null);
            var utcRollback = new World(StandardCryptoStage.Setup, owner); utcRollback.At = p => { if (p == "pipe-peer") utcRollback.Clock.Utc = Start.AddSeconds(9); };
            Check(owner ? utcRollback.RunOwner().Failure is not null : utcRollback.RunUser().Failure is not null);
            var monoRollback = new World(StandardCryptoStage.Setup, owner); monoRollback.At = p => { if (p == "pipe-peer") monoRollback.Clock.Mono--; };
            Check(owner ? monoRollback.RunOwner().Failure is not null : monoRollback.RunUser().Failure is not null);
            var midExpiry = new World(StandardCryptoStage.Setup, owner) { ReadChunk = 7, WriteChunk = 7 };
            midExpiry.At = p => { if (p is "read" or "write") midExpiry.Clock.Utc = Start.AddHours(2); };
            Check(owner ? midExpiry.RunOwner().Failure is not null : midExpiry.RunUser().Failure is not null);
        }
        var rawNative = new World(StandardCryptoStage.Setup) { Fault = p => p == "write" ? new Win32Exception(121) : null };
        var rawFailure = rawNative.RunOwner(); Check(rawFailure.Failure!.Category == "WIN32" && rawFailure.Failure.Win32Error == 121 && rawFailure.Failure.GrantMayHaveBeenSent);
        // Coordinated concurrent invocation admits one caller before any work.
        var concurrent = new World(StandardCryptoStage.Setup, false); var concurrentChannel = concurrent.Channel();
        using (var entered = new ManualResetEventSlim(false)) using (var release = new ManualResetEventSlim(false)) {
            var first = Task.Run(() => concurrentChannel.RunWorker((c, gate) => {
                entered.Set(); StandardContract.Need(release.Wait(10000), "FAKE_CHANNEL_CONCURRENT_TIMEOUT"); gate(); return Report(c);
            }));
            bool observed = entered.Wait(10000); StandardChannelWorkerResult second;
            try { second = concurrentChannel.RunWorker((c, gate) => { concurrent.WorkCount++; return Report(c); }); }
            finally { release.Set(); }
            Check(first.Wait(10000) && observed && first.Result.AckValidated && second.Failure is not null && concurrent.WorkCount == 0);
        }
        return count;
    }
}
