using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

// Injected record store only. Native disk/SCM/account/token APIs are not called.
internal static class StandardServiceStoreJournalTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.OwnerSid, 1, 1, 2,
        "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    private static StandardServiceContext Context() => new(new(StandardCryptoComparison.Schema, StandardContract.Root,
        "9fd091050cb441b9bc191ba8f7706507", Start, Start.AddHours(2), StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
        H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8)), H(9), StandardInputCodec.Effects);
    private static StandardServiceJournalRecord Record(StandardServiceJournalFile file, StandardServiceContext c)
    {
        var (role, kind, stage) = file switch {
            StandardServiceJournalFile.SetupIntent => (StandardServiceRole.Setup, "INTENT", (StandardCryptoStage?)null),
            StandardServiceJournalFile.SetupOwned => (StandardServiceRole.Setup, "OWNED", null),
            StandardServiceJournalFile.SetupComplete => (StandardServiceRole.Setup, "COMPLETE", null),
            StandardServiceJournalFile.GuardianIntent => (StandardServiceRole.Guardian, "INTENT", null),
            StandardServiceJournalFile.GuardianOwned => (StandardServiceRole.Guardian, "OWNED", null),
            StandardServiceJournalFile.GuardianComplete => (StandardServiceRole.Guardian, "COMPLETE", null),
            StandardServiceJournalFile.SetupStart => (StandardServiceRole.Setup, "START", StandardCryptoStage.Setup),
            StandardServiceJournalFile.SetupAdmitted => (StandardServiceRole.Setup, "ADMITTED", StandardCryptoStage.Setup),
            StandardServiceJournalFile.SetupRunComplete => (StandardServiceRole.Setup, "RUN_COMPLETE", StandardCryptoStage.Setup),
            StandardServiceJournalFile.GuardianBeforeStart => (StandardServiceRole.Guardian, "START", StandardCryptoStage.GuardianBefore),
            StandardServiceJournalFile.GuardianBeforeAdmitted => (StandardServiceRole.Guardian, "ADMITTED", StandardCryptoStage.GuardianBefore),
            StandardServiceJournalFile.GuardianBeforeComplete => (StandardServiceRole.Guardian, "RUN_COMPLETE", StandardCryptoStage.GuardianBefore),
            StandardServiceJournalFile.GuardianAfterStart => (StandardServiceRole.Guardian, "START", StandardCryptoStage.GuardianAfter),
            StandardServiceJournalFile.GuardianAfterAdmitted => (StandardServiceRole.Guardian, "ADMITTED", StandardCryptoStage.GuardianAfter),
            StandardServiceJournalFile.GuardianAfterComplete => (StandardServiceRole.Guardian, "RUN_COMPLETE", StandardCryptoStage.GuardianAfter),
            _ => throw new InvalidDataException("SYNTHETIC_SERVICE_FILE_INVALID")
        };
        StandardChannelKeyPin Key(StandardCryptoArm arm, int n) => new(arm, StandardCryptoComparison.KeyName(c.Scope.Attempt, arm),
            H(n), H(n + 2), H(n + 4), StandardSyntheticEnvelopeCodec.PlaintextHash);
        StandardServiceRunContext? run = stage is null ? null : new(c, stage.Value, H(10 + (int)stage).Substring(32), H(20 + (int)stage),
            stage == StandardCryptoStage.Setup ? null : H(30), stage == StandardCryptoStage.Setup ? null :
            new(Key(StandardCryptoArm.Restricted, 40), Key(StandardCryptoArm.UserAccessible, 41)));
        var snapshot = kind == "INTENT" ? null : new StandardServiceSnapshot(StandardServiceRules.Recipe(c, role), 16,
            kind == "OWNED" ? 4u : 3u, 1, 1, 0, 0, false, false, 0,
            StandardNativeCryptoRules.Hash(StandardServiceRules.Descriptor(role)), new(1, 0, 0, 0));
        return new(StandardServiceRules.Schema, c, role, kind, Start.AddSeconds(5), kind == "INTENT" ? null : H(50),
            kind == "COMPLETE" ? H(51) : null, snapshot, run, null, null);
    }
    private sealed class Guard : IStandardServiceGuard {
        internal StandardToken Token = Owner(); internal Action<int>? On; internal int Calls;
        public StandardToken CaptureOwnerAndVerifyCustody(StandardServiceContext c, string stage) { On?.Invoke(++Calls); return Token; }
        public void VerifyBeforeStart(StandardServiceRunContext run) => throw new InvalidDataException("NO_NATIVE_START_GUARD");
        public void VerifyBeforeComplete(StandardServiceRunContext run) => throw new InvalidDataException("NO_NATIVE_COMPLETE_GUARD");
    }
    private sealed class Sink : IStandardDurableRecordSink {
        internal readonly Dictionary<StandardStoreFile, byte[]> Files = new(); internal int Writes, Reads;
        internal Func<StandardStoreReceipt, StandardStoreReceipt>? Change;
        internal bool FailAfterWrite, ChangedRead;
        internal Action? OnWrite;
        internal readonly StandardServiceContext Context;
        internal Sink(StandardServiceContext context) { Context = context; }
        public StandardStoreReceipt WriteNew(StandardStoreFile file, byte[] original) {
            Writes++; StandardContract.Need(!Files.ContainsKey(file), "FAKE_SERVICE_STORE_EXISTS");
            Files.Add(file, (byte[])original.Clone()); OnWrite?.Invoke();
            if (FailAfterWrite) throw new IOException("FAKE_SERVICE_STORE_POST_WRITE_UNKNOWN");
            var receipt = new StandardStoreReceipt(Context.Scope, file, StandardStoreRules.Hash(original), original.Length,
                Start.AddSeconds(10), 1, (ulong)(100 + (int)file), true, true, true, true) {
                    CreationFileTimeUtc = Start.AddSeconds(6).UtcDateTime.ToFileTimeUtc() };
            return Change?.Invoke(receipt) ?? receipt;
        }
        public byte[] Read(StandardStoreFile file) { Reads++; return ChangedRead ? Encoding.UTF8.GetBytes("{}") : (byte[])Files[file].Clone(); }
    }
    private sealed class Fixture {
        internal readonly StandardServiceContext Context = StandardServiceStoreJournalTests.Context();
        internal readonly Guard Guard = new(); internal readonly Sink Sink;
        internal DateTimeOffset Now = Start.AddSeconds(10);
        internal readonly StandardServiceStoreJournal Journal;
        internal Fixture() { Sink = new(Context); Journal = new(Context, Sink, Guard, () => Now); }
        internal byte[] Raw(StandardServiceJournalFile file) => JsonSerializer.SerializeToUtf8Bytes(Record(file, Context));
    }
    internal static int Run()
    {
        int count = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_SERVICE_STORE_TEST_FAILED_" + count); count++; }
        void Reject(Action operation) {
            try { operation(); } catch (Exception e) when (e is InvalidDataException or JsonException or IOException or ArgumentException) { count++; return; }
            throw new InvalidDataException("STANDARD_SERVICE_STORE_EXPECTED_REFUSAL_MISSING_" + count);
        }
        var all = Enum.GetValues<StandardServiceJournalFile>();
        Check(all.Length == 15 && all.Select(StandardServiceStoreJournal.Map).Distinct().Count() == 15);
        Check(all.All(x => StandardStoreRules.ServiceRecord(StandardServiceStoreJournal.Map(x))));
        Reject(() => StandardServiceStoreJournal.Map((StandardServiceJournalFile)(-1)));
        Reject(() => StandardServiceStoreJournal.Map((StandardServiceJournalFile)15));
        var success = new Fixture();
        foreach (var file in all) {
            byte[] raw = success.Raw(file); var receipt = success.Journal.WriteNew(file, raw);
            Check(receipt.Context == success.Context && receipt.File == file && receipt.Sha256 == StandardStoreRules.Hash(raw) &&
                receipt.Length == raw.Length && receipt.CreateNew && receipt.Protected && receipt.DurablyFlushed && receipt.ExactReadback);
            byte[] read = success.Journal.Read(file); Check(read.SequenceEqual(raw)); read[0] = 0; raw[0] = 0;
            Check(success.Journal.Read(file).SequenceEqual(success.Raw(file)));
            Reject(() => success.Journal.WriteNew(file, success.Raw(file)));
        }
        Check(success.Sink.Writes == 15 && success.Sink.Reads == 45 && !success.Journal.NativeEvidenceEstablished);
        Check(success.Journal.Evidence().All(x => x is { WriteEntered: true, ReceiptAdmitted: true, ReadbackAdmitted: true }));
        const StandardServiceJournalFile first = StandardServiceJournalFile.SetupIntent;
        const StandardServiceJournalFile next = StandardServiceJournalFile.GuardianIntent;
        foreach (Func<StandardServiceJournalRecord, StandardServiceJournalRecord> change in new Func<StandardServiceJournalRecord, StandardServiceJournalRecord>[] {
            r => r with { Schema = "UNKNOWN" }, r => r with { Context = r.Context with { SourceSetSha256 = H(99) } },
            r => r with { Context = r.Context with { Effects = "OLD_OR_UNKNOWN" } }, r => r with { Role = StandardServiceRole.Guardian },
            r => r with { Kind = "OWNED" }, r => r with { WrittenUtc = Start.AddTicks(-1) },
            r => r with { WrittenUtc = Start.AddHours(2) }, r => r with { WrittenUtc = Start.AddSeconds(11) },
            r => r with { WrittenUtc = Start.AddSeconds(5).ToOffset(TimeSpan.FromHours(1)) } }) {
            var f = new Fixture(); byte[] raw = JsonSerializer.SerializeToUtf8Bytes(change(Record(first, f.Context)));
            Reject(() => f.Journal.WriteNew(first, raw)); Check(f.Sink.Writes == 0);
        }
        foreach (Func<byte[], byte[]> change in new Func<byte[], byte[]>[] {
            b => b.Concat(new byte[] { 10 }).ToArray(), b => new byte[] { 0xef, 0xbb, 0xbf }.Concat(b).ToArray(),
            b => Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(b).Replace("\"Schema\":", "\"Other\":1,\"Schema\":")),
            b => Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(b).Replace("\"Schema\":", "\"Schema\":\"DUP\",\"Schema\":")),
            _ => Array.Empty<byte>(), _ => Encoding.UTF8.GetBytes("{}"), _ => Encoding.UTF8.GetBytes("[]") }) {
            var f = new Fixture(); Reject(() => f.Journal.WriteNew(first, change(f.Raw(first)))); Check(f.Sink.Writes == 0);
        }
        foreach (Func<StandardStoreReceipt, StandardStoreReceipt> change in new Func<StandardStoreReceipt, StandardStoreReceipt>[] {
            r => r with { Scope = r.Scope with { Attempt = new('f', 32) } }, r => r with { File = StandardStoreFile.Plan },
            r => r with { Sha256 = H(99) }, r => r with { Length = r.Length + 1 }, r => r with { VolumeSerial = 0 },
            r => r with { FileIndex = 0 }, r => r with { CreationFileTimeUtc = 0 },
            r => r with { CreationFileTimeUtc = Start.AddSeconds(4).UtcDateTime.ToFileTimeUtc() },
            r => r with { WrittenUtc = Start.AddSeconds(4) }, r => r with { WrittenUtc = Start.AddSeconds(11) },
            r => r with { CreateNew = false }, r => r with { Protected = false }, r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false } }) {
            var f = new Fixture(); f.Sink.Change = change;
            Reject(() => f.Journal.WriteNew(first, f.Raw(first)));
            Check(f.Sink.Writes == 1 && f.Sink.Reads == 0 && f.Journal.Evidence().Single() is { WriteEntered: true, ReceiptAdmitted: false });
            Reject(() => f.Journal.WriteNew(next, f.Raw(next))); Check(f.Sink.Writes == 1);
        }
        {
            var f = new Fixture(); f.Sink.FailAfterWrite = true; Reject(() => f.Journal.WriteNew(first, f.Raw(first)));
            Check(f.Sink.Files.Count == 1 && f.Journal.Evidence().Single() is { WriteEntered: true, ReceiptAdmitted: false });
            Reject(() => f.Journal.Read(first)); Reject(() => f.Journal.WriteNew(next, f.Raw(next)));
        }
        {
            var f = new Fixture(); f.Sink.ChangedRead = true; Reject(() => f.Journal.WriteNew(first, f.Raw(first)));
            Check(f.Journal.Evidence().Single() is { ReceiptAdmitted: true, ReadbackAdmitted: false });
        }
        {
            var f = new Fixture(); f.Journal.WriteNew(first, f.Raw(first));
            f.Sink.Change = r => r with { FileIndex = (ulong)(100 + (int)StandardServiceStoreJournal.Map(first)) };
            Reject(() => f.Journal.WriteNew(next, f.Raw(next))); Check(f.Journal.Read(first).SequenceEqual(f.Raw(first)));
        }
        for (int failAt = 1; failAt <= 4; failAt++) {
            int boundary = failAt; var f = new Fixture(); f.Guard.On = n => { if (n == boundary) throw new UnauthorizedAccessException("FAKE_CUSTODY_LOST"); };
            try { f.Journal.WriteNew(first, f.Raw(first)); throw new InvalidDataException("MISSING_CUSTODY_REFUSAL"); }
            catch (UnauthorizedAccessException) { count++; }
            Check(f.Sink.Writes == (boundary >= 3 ? 1 : 0)); Reject(() => f.Journal.WriteNew(next, f.Raw(next)));
        }
        {
            var f = new Fixture(); f.Guard.Token = Owner() with { User = StandardContract.UserSid };
            Reject(() => f.Journal.WriteNew(first, f.Raw(first))); Check(f.Sink.Writes == 0);
        }
        foreach (bool rollback in new[] { false, true }) {
            var f = new Fixture(); f.Guard.On = _ => f.Now = rollback ? Start.AddSeconds(9) : Start.AddHours(2);
            Reject(() => f.Journal.WriteNew(first, f.Raw(first))); Check(f.Sink.Writes == 0);
        }
        {
            var f = new Fixture(); int refused = 0;
            f.Guard.On = _ => { if (refused == 0) { refused++; Reject(() => f.Journal.WriteNew(first, f.Raw(first))); } };
            f.Journal.WriteNew(first, f.Raw(first)); Check(refused == 1 && f.Sink.Writes == 1);
        }
        {
            var f = new Fixture(); byte[] raw = f.Raw(first); f.Sink.OnWrite = () => raw[0] = 0;
            f.Journal.WriteNew(first, raw); Check(f.Journal.Read(first).SequenceEqual(f.Raw(first)));
        }
        return count;
    }
}
