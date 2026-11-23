using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardProtectedStoreTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 10, 0, 0, TimeSpan.Zero);
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static StandardCryptoScope Scope() => new(StandardCryptoComparison.Schema, StandardContract.Root,
        "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2), StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
        H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8));
    private static readonly byte[] Json = Encoding.UTF8.GetBytes("{\"scope\":\"SYNTHETIC_ONLY\",\"value\":1}");
    private static readonly byte[] SourceJson = Encoding.UTF8.GetBytes("[{\"relative\":\"PUBLIC_SYNTHETIC_SOURCE.cs\",\"sha256\":\"" + new string('a', 64) + "\"}]");
    private sealed class Data
    {
        internal StandardStoreObject Info;
        internal byte[] Descriptor, Bytes = Array.Empty<byte>();
        internal bool Writer, Flushed;
        internal Data(string path, bool directory, ulong id, byte[] descriptor) {
            Info = new("\\\\?\\" + path, 1, directory ? 16u : 0u, 1, 1, id, Start.AddSeconds(1).UtcDateTime.ToFileTimeUtc(), 0, true);
            Descriptor = descriptor;
        }
    }
    private sealed class Handle : IStandardStoreHandle
    {
        private readonly Data data; private readonly Backend backend; private readonly bool writer;
        internal bool Disposed;
        internal Handle(Data data, Backend backend, bool writer = false) { this.data = data; this.backend = backend; this.writer = writer; }
        private void Before(string stage) { StandardContract.Need(!Disposed, "FAKE_CLOSED_HANDLE"); backend.On?.Invoke(stage); }
        public StandardStoreObject Inspect() { Before("Inspect"); return data.Info with { Length = data.Bytes.Length }; }
        public byte[] Descriptor() { Before("Descriptor"); return (byte[])data.Descriptor.Clone(); }
        public byte[] Read(int max) { Before("Read"); StandardContract.Need(data.Bytes.Length <= max, "FAKE_READ_TOO_LARGE"); return (byte[])data.Bytes.Clone(); }
        public void Write(byte[] bytes) { Before("Write"); StandardContract.Need(writer, "FAKE_READ_ONLY_WRITE"); data.Bytes = (byte[])bytes.Clone(); }
        public void FlushDurable() { Before("Flush"); data.Flushed = true; }
        public void Dispose() { if (Disposed) return; Disposed = true; if (writer) data.Writer = false; }
    }
    private sealed class Backend : IStandardStoreBackend
    {
        internal readonly Dictionary<StandardStoreDirectory, Data> Directories = new();
        internal readonly Dictionary<StandardStoreFile, Data> Files = new();
        internal readonly List<Handle> Leases = new();
        internal Action<string>? On = null;
        internal Func<StandardStoreDirectory, StandardStoreObject, StandardStoreObject>? DirectoryMutation;
        internal Func<StandardStoreFile, StandardStoreObject, StandardStoreObject>? FileMutation;
        internal int FileCreates, DirectoryCreates, FileOpens;
        private readonly Data volume = new(@"C:\", true, 1, Array.Empty<byte>()), programData = new(@"C:\ProgramData", true, 2, Array.Empty<byte>());
        private Handle Lease(Data data, bool writer = false) { var lease = new Handle(data, this, writer); Leases.Add(lease); return lease; }
        public IStandardStoreHandle OpenVolumeRoot() { On?.Invoke("OpenVolume"); return Lease(volume); }
        public IStandardStoreHandle OpenProgramData(IStandardStoreHandle parent) { On?.Invoke("OpenProgramData"); return Lease(programData); }
        public IStandardStoreHandle OpenDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent) { On?.Invoke("OpenDirectory"); return Lease(Directories[directory]); }
        public IStandardStoreHandle CreateDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent, byte[] descriptor)
        {
            On?.Invoke("CreateDirectory"); DirectoryCreates++;
            StandardContract.Need(!Directories.ContainsKey(directory), "FAKE_DIRECTORY_EXISTS_NO_ADOPTION");
            var data = new Data(StandardStoreRules.PathOf(directory), true, (ulong)(10 + (int)directory), (byte[])descriptor.Clone());
            if (DirectoryMutation is not null) data.Info = DirectoryMutation(directory, data.Info);
            Directories.Add(directory, data); return Lease(data);
        }
        public IStandardStoreHandle OpenFile(StandardStoreFile file, IStandardStoreHandle parent)
        {
            On?.Invoke("OpenFile"); FileOpens++; var data = Files[file];
            StandardContract.Need(!data.Writer, "FAKE_EXISTING_WRITER_REFUSED"); return Lease(data);
        }
        public IStandardStoreHandle CreateFile(StandardStoreFile file, IStandardStoreHandle parent, byte[] descriptor)
        {
            On?.Invoke("CreateFile"); FileCreates++; StandardContract.Need(!Files.ContainsKey(file), "FAKE_FILE_EXISTS_NO_OVERWRITE");
            var data = new Data(StandardStoreRules.PathOf(file), false, (ulong)(100 + (int)file), (byte[])descriptor.Clone()) { Writer = true };
            if (FileMutation is not null) data.Info = FileMutation(file, data.Info);
            Files.Add(file, data); return Lease(data, true);
        }
    }

    internal static int Run()
    {
        int cases = 0;
        void Check(bool good) { StandardContract.Need(good, "STANDARD_STORE_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) {
            try { work(); } catch (Exception error) when (error is InvalidDataException or JsonException or DecoderFallbackException or ArgumentException) { cases++; return; }
            throw new InvalidDataException("STANDARD_STORE_EXPECTED_REFUSAL_MISSING_" + cases);
        }
        StandardProtectedStore Fresh(Backend backend, Action<string>? guard = null, Func<DateTimeOffset>? clock = null) =>
            StandardProtectedStore.CreateFresh(Scope(), backend, guard ?? (_ => { }), clock ?? (() => Start.AddSeconds(10)));
        StandardProtectedStore Open(Backend backend, StandardStoreRole role, StandardStoreProvenance provenance,
            Action<string>? guard = null) => StandardProtectedStore.OpenOwned(Scope(), role, backend,
                guard ?? (_ => { }), () => Start.AddSeconds(10), provenance);

        Check(Enum.GetValues<StandardStoreDirectory>().Length == 8 && Enum.GetValues<StandardStoreFile>().Length == 41);
        Check(Enum.GetValues<StandardStoreFile>().Select(StandardStoreRules.PathOf).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 41);
        Check((int)StandardStoreFile.SourceSet == 21 && (int)StandardStoreFile.AccountActivationIntent == 22 &&
            (int)StandardStoreFile.AccountDisabled == 25 && (int)StandardStoreFile.ServiceSetupIntent == 26 &&
            (int)StandardStoreFile.ServiceGuardianAfterComplete == 40);
        foreach (var directory in Enum.GetValues<StandardStoreDirectory>()) {
            string path = StandardStoreRules.PathOf(directory);
            Check(path.StartsWith(StandardContract.Root, StringComparison.Ordinal) && !path.Contains("..") && path.IndexOf(':', 2) < 0);
            var rule = StandardStoreRules.Rule(directory); byte[] descriptor = StandardStoreRules.Descriptor(rule);
            StandardStoreRules.ValidateDescriptor(descriptor, rule); Check(true);
            StandardStoreRules.ValidateDescriptor(StandardStoreRules.Descriptor(rule with { Aces = rule.Aces.Reverse().ToArray() }), rule); Check(true);
            Check(rule.Owner == StandardContract.Administrators && rule.Group == StandardContract.Administrators);
            foreach (var ace in rule.Aces.Where(a => a.Sid == StandardContract.UserSid)) Check(ace.Mask is StandardStoreRules.Traverse or StandardStoreRules.ReadExecute);
            for (int i = 0; i < descriptor.Length; i++) { var bad = (byte[])descriptor.Clone(); bad[i] ^= 1; Reject(() => StandardStoreRules.ValidateDescriptor(bad, rule)); }
            Reject(() => StandardStoreRules.ValidateDescriptor(descriptor.Concat(new byte[] { 0 }).ToArray(), rule));
        }
        foreach (var file in Enum.GetValues<StandardStoreFile>()) {
            var rule = StandardStoreRules.Rule(file); byte[] descriptor = StandardStoreRules.Descriptor(rule);
            StandardStoreRules.ValidateDescriptor(descriptor, rule); Check(true);
            for (int i = 0; i < descriptor.Length; i++) { var bad = (byte[])descriptor.Clone(); bad[i] ^= 1; Reject(() => StandardStoreRules.ValidateDescriptor(bad, rule)); }
            Check(!StandardStoreRules.CanWrite(StandardStoreRole.StandardUser, file));
            Check(!StandardStoreRules.CanWrite(StandardStoreRole.GuardianBefore, file));
            Check(!StandardStoreRules.CanWrite(StandardStoreRole.GuardianAfter, file));
            foreach (var ace in rule.Aces.Where(a => a.Sid == StandardContract.UserSid)) Check(ace.Mask is StandardStoreRules.ReadFile or StandardStoreRules.ReadExecute);
            Reject(() => StandardStoreRules.ValidateDescriptor(StandardStoreRules.Descriptor(rule with { Owner = StandardContract.UserSid }), rule));
            Reject(() => StandardStoreRules.ValidateDescriptor(StandardStoreRules.Descriptor(rule with { Group = StandardContract.UserSid }), rule));
        }
        Reject(() => StandardStoreRules.Location((StandardStoreFile)99)); Reject(() => StandardStoreRules.Relative((StandardStoreDirectory)99));
        Reject(() => StandardStoreRules.CanWrite((StandardStoreRole)99, StandardStoreFile.Plan));
        Reject(() => StandardStoreRules.Parent(StandardStoreDirectory.Root));
        foreach (long fileTime in new[] { 0L, -1L, long.MaxValue, Start.AddTicks(-1).UtcDateTime.ToFileTimeUtc(),
            Start.AddHours(2).UtcDateTime.ToFileTimeUtc(), Start.AddSeconds(11).UtcDateTime.ToFileTimeUtc() })
            Check(!StandardStoreRules.CreatedInWindow(fileTime, Scope(), Start.AddSeconds(10)));
        Check(StandardStoreRules.CreatedInWindow(Start.UtcDateTime.ToFileTimeUtc(), Scope(), Start.AddSeconds(10)));
        foreach (var directory in Enum.GetValues<StandardStoreDirectory>())
            Check(StandardStoreRules.CanPin(StandardStoreRole.StandardUser, directory) ==
                (directory is StandardStoreDirectory.Root or StandardStoreDirectory.Bin or StandardStoreDirectory.Input or StandardStoreDirectory.Envelopes));
        foreach (var directory in Enum.GetValues<StandardStoreDirectory>())
        foreach (var role in new[] { StandardStoreRole.StandardUser, StandardStoreRole.GuardianBefore, StandardStoreRole.GuardianAfter })
            if (StandardStoreRules.CanPin(role, directory)) {
                string sid = role == StandardStoreRole.StandardUser ? StandardContract.UserSid : StandardCryptoComparison.GuardianSid;
                var ace = StandardStoreRules.Rule(directory).Aces.Single(a => a.Sid == sid);
                Check((ace.Mask & StandardStoreRules.DirectoryOpenAccess) == StandardStoreRules.DirectoryOpenAccess);
                Check((StandardStoreRules.DirectoryOpenAccess & 1) == 0); // No ungranted list-directory request.
            }
        foreach (var file in Enum.GetValues<StandardStoreFile>().Where(f => f != StandardStoreFile.ControlAssembly)) {
            StandardStoreRules.Content(file, file == StandardStoreFile.SourceSet ? SourceJson : Json); Check(true);
            foreach (string bad in new[] { "", "[]", "null", "1", "{", "{}{}", "{\"a\":1,\"a\":2}",
                "{\"a\":1,\"\\u0061\":2}", "{\"a\":{\"b\":1,\"b\":2}}", "{\"a\":1,}", "{/*hi*/}", "{\"\":1}" })
                Reject(() => StandardStoreRules.Content(file, Encoding.UTF8.GetBytes(bad)));
            Reject(() => StandardStoreRules.Content(file, new byte[] { 0xef, 0xbb, 0xbf, 123, 125 }));
            Reject(() => StandardStoreRules.Content(file, new byte[] { 123, 34, 120, 34, 58, 34, 0xc0, 0x80, 34, 125 }));
        }
        StandardStoreRules.Content(StandardStoreFile.Plan, Encoding.UTF8.GetBytes("{\"a\":{\"x\":1},\"b\":{\"x\":2}}")); Check(true);
        StandardStoreRules.Content(StandardStoreFile.ControlAssembly, new byte[] { 0, 1, 2 }); Check(true);
        Reject(() => StandardStoreRules.Content(StandardStoreFile.ControlAssembly, Array.Empty<byte>()));
        Reject(() => StandardStoreRules.Content(StandardStoreFile.Plan, new byte[StandardStoreRules.JsonMaximum + 1]));
        var b = new Backend();
        using (var owner = Fresh(b)) {
            Check(b.Directories.Count == 8 && b.DirectoryCreates == 8);
            var receipt = owner.WriteNew(StandardStoreFile.Plan, Json);
            Check(receipt.Scope == Scope() && receipt.File == StandardStoreFile.Plan && receipt.Sha256 == StandardStoreRules.Hash(Json) &&
                receipt.Length == Json.Length && receipt.CreateNew && receipt.Protected && receipt.DurablyFlushed && receipt.ExactReadback &&
                receipt.VolumeSerial == 1 && receipt.FileIndex > 0 && receipt.CreationFileTimeUtc > 0 && b.Files[StandardStoreFile.Plan].Flushed);
            Check(JsonSerializer.Deserialize<StandardStoreReceipt>(JsonSerializer.Serialize(receipt))?.CreationFileTimeUtc == receipt.CreationFileTimeUtc);
            Check(owner.Read(StandardStoreFile.Plan).SequenceEqual(Json));
            int opens = b.FileOpens; Check(owner.Read(StandardStoreFile.Plan).SequenceEqual(Json) && b.FileOpens == opens);
            Reject(() => owner.WriteNew(StandardStoreFile.Plan, Json)); Check(b.FileCreates == 1);
            Reject(() => owner.WriteNew(StandardStoreFile.RestrictedIntent, Json)); Check(b.FileCreates == 1);
            byte[] supplied = (byte[])Json.Clone(); owner.WriteNew(StandardStoreFile.Approval, supplied); supplied[0] = 0;
            Check(owner.Read(StandardStoreFile.Approval).SequenceEqual(Json));
            owner.WriteNew(StandardStoreFile.SourceSet, SourceJson);
            var provenance = owner.Provenance();
            using (var setup = Open(b, StandardStoreRole.Setup, provenance)) {
                foreach (var file in new[] { StandardStoreFile.RestrictedIntent, StandardStoreFile.RestrictedOwned, StandardStoreFile.RestrictedComplete,
                    StandardStoreFile.AccessibleIntent, StandardStoreFile.AccessibleOwned, StandardStoreFile.AccessibleComplete,
                    StandardStoreFile.RestrictedEnvelope, StandardStoreFile.AccessibleEnvelope }) {
                    var written = setup.WriteNew(file, Json); Check(written.File == file && written.ExactReadback && setup.Read(file).SequenceEqual(Json));
                }
                Reject(() => setup.WriteNew(StandardStoreFile.ControllerResult, Json));
                Reject(() => setup.WriteNew(StandardStoreFile.SetupReport, Json));
                foreach (var accountFile in new[] { StandardStoreFile.AccountActivationIntent, StandardStoreFile.AccountActivated,
                    StandardStoreFile.AccountDisableIntent, StandardStoreFile.AccountDisabled }) {
                    Reject(() => setup.WriteNew(accountFile, Json)); Reject(() => setup.Read(accountFile));
                }
                Check(setup.Read(StandardStoreFile.SourceSet).SequenceEqual(SourceJson));
                Check(setup.Read(StandardStoreFile.Plan).SequenceEqual(Json));
            }
            using (var user = Open(b, StandardStoreRole.StandardUser, owner.Provenance())) {
                Check(user.Read(StandardStoreFile.Plan).SequenceEqual(Json)); Reject(() => user.WriteNew(StandardStoreFile.GuardianBeforeReport, Json));
                Reject(() => user.Read(StandardStoreFile.RestrictedIntent));
            }
            using (var guardian = Open(b, StandardStoreRole.GuardianBefore, owner.Provenance())) {
                Reject(() => guardian.WriteNew(StandardStoreFile.GuardianBeforeReport, Json)); Reject(() => guardian.Read(StandardStoreFile.GuardianBeforeReport));
                Reject(() => guardian.WriteNew(StandardStoreFile.GuardianAfterReport, Json)); Reject(() => guardian.Read(StandardStoreFile.RestrictedIntent));
            }
            using (var guardian = Open(b, StandardStoreRole.GuardianAfter, owner.Provenance())) {
                Reject(() => guardian.WriteNew(StandardStoreFile.GuardianAfterReport, Json));
            }
            owner.WriteNew(StandardStoreFile.GuardianBeforeReport, Json); owner.WriteNew(StandardStoreFile.GuardianAfterReport, Json);
            owner.WriteNew(StandardStoreFile.StandardUserReport, Json); owner.WriteNew(StandardStoreFile.SetupReport, Json);
            foreach (var accountFile in new[] { StandardStoreFile.AccountActivationIntent, StandardStoreFile.AccountActivated,
                StandardStoreFile.AccountDisableIntent, StandardStoreFile.AccountDisabled }) {
                owner.WriteNew(accountFile, Json); Check(owner.Read(accountFile).SequenceEqual(Json));
            }
            foreach (var file in Enum.GetValues<StandardStoreFile>().Where(StandardStoreRules.ServiceRecord)) {
                Check(StandardStoreRules.Location(file).Parent == StandardStoreDirectory.Journal &&
                    !StandardStoreRules.KeyRecord(file) && StandardStoreRules.CanWrite(StandardStoreRole.Owner, file));
                var serviceReceipt = owner.WriteNew(file, Json);
                Check(serviceReceipt.File == file && serviceReceipt.DurablyFlushed && serviceReceipt.ExactReadback &&
                    serviceReceipt.CreateNew && serviceReceipt.Protected && owner.Read(file).SequenceEqual(Json));
                Reject(() => owner.WriteNew(file, Json));
            }
            foreach (var role in new[] { StandardStoreRole.Setup, StandardStoreRole.StandardUser,
                StandardStoreRole.GuardianBefore, StandardStoreRole.GuardianAfter }) {
                using var observer = Open(b, role, owner.Provenance());
                foreach (var file in Enum.GetValues<StandardStoreFile>().Where(StandardStoreRules.ServiceRecord)) {
                    Reject(() => observer.WriteNew(file, Json)); Reject(() => observer.Read(file));
                }
            }
            Check(owner.Read(StandardStoreFile.GuardianBeforeReport).SequenceEqual(Json));
            Check(owner.Read(StandardStoreFile.GuardianAfterReport).SequenceEqual(Json));
            Check(owner.Read(StandardStoreFile.StandardUserReport).SequenceEqual(Json));
            Check(owner.Read(StandardStoreFile.SetupReport).SequenceEqual(Json));
            var origin = provenance.Directories[0];
            Reject(() => Open(b, StandardStoreRole.Owner, provenance with { Directories = Array.Empty<StandardStoreDirectoryOrigin>() }));
            foreach (var changed in new[] { origin with { Scope = Scope() with { Attempt = new('a', 32) } },
                origin with { FileIndex = 999 }, origin with { VolumeSerial = 9 }, origin with { CreationFileTimeUtc = origin.CreationFileTimeUtc + 1 } })
                Reject(() => Open(b, StandardStoreRole.Owner, provenance with { Directories = provenance.Directories.Select(x => x.Directory == changed.Directory ? changed : x).ToArray() }));
            var pin = provenance.Files[0];
            foreach (var changed in new[] { pin with { Sha256 = "bad" }, pin with { Length = 0 }, pin with { FileIndex = 0 },
                pin with { VolumeSerial = 8 }, pin with { Scope = Scope() with { HostSha256 = H(88) } } })
                Reject(() => Open(b, StandardStoreRole.Owner, provenance with { Files = new[] { changed } }));
            using var hashMismatch = Open(b, StandardStoreRole.Owner, provenance with { Files = new[] { pin with { Sha256 = H(123) } } });
            Reject(() => hashMismatch.Read(pin.File));
            b.Files[StandardStoreFile.Plan].Bytes = Encoding.UTF8.GetBytes("{\"changed\":true}"); Reject(() => owner.Read(StandardStoreFile.Plan));
        }
        Check(b.Leases.All(x => x.Disposed));
        Reject(() => Fresh(b)); Check(b.DirectoryCreates == 9 && b.Directories.Count == 8); // no adoption/rollback

        var objectChanges = new Func<StandardStoreObject, StandardStoreObject>[] {
            o => o with { FinalPath = o.FinalPath + "old" }, o => o with { Type = 2 }, o => o with { Attributes = o.Attributes | 0x400 },
            o => o with { Attributes = o.Attributes | 0x1000 }, o => o with { Links = 2 }, o => o with { Links = 0 },
            o => o with { VolumeSerial = 0 }, o => o with { FileIndex = 0 }, o => o with { CreationFileTimeUtc = 0 },
            o => o with { CreatedNew = false }
        };
        foreach (var change in objectChanges) {
            var bad = new Backend { DirectoryMutation = (_, o) => change(o) }; Reject(() => Fresh(bad)); Check(bad.Directories.Count == 1);
            var badFile = new Backend { FileMutation = (_, o) => change(o) }; using var store = Fresh(badFile);
            Reject(() => store.WriteNew(StandardStoreFile.Plan, Json)); Check(badFile.Files.Count == 1);
        }
        foreach (string failAt in new[] { "BeforeCreateDirectory", "AfterCreateDirectory", "ImmediatelyBeforeCreateFile", "AfterCreateFile",
            "AfterWriteBeforeFlush", "AfterDurableFlush", "AfterWriteReadback", "CompleteWriteReceipt" }) {
            var failed = new Backend(); bool armed = !failAt.Contains("File") && failAt.Contains("Directory");
            void Guard(string stage) { if (armed && stage == failAt) throw new InvalidDataException("FAKE_GUARD_LOST"); }
            if (armed) Reject(() => Fresh(failed, Guard));
            else { using var store = Fresh(failed, Guard); armed = true; Reject(() => store.WriteNew(StandardStoreFile.Plan, Json)); }
            Check(failed.Files.Count <= 1 && failed.Directories.Count <= 8);
        }
        var expiry = new Backend(); DateTimeOffset now = Start.AddSeconds(10); using (var store = Fresh(expiry, _ => { }, () => now)) {
            now = Start.AddHours(2); Reject(() => store.WriteNew(StandardStoreFile.Plan, Json)); Check(expiry.FileCreates == 0);
        }
        var writer = new Backend(); using (var owner = Fresh(writer)) {
            owner.WriteNew(StandardStoreFile.Plan, Json); var provenance = owner.Provenance(); writer.Files[StandardStoreFile.Plan].Writer = true;
            using var other = Open(writer, StandardStoreRole.Setup, provenance); Reject(() => other.Read(StandardStoreFile.Plan));
        }
        var acl = new Backend(); using (var owner = Fresh(acl)) {
            owner.WriteNew(StandardStoreFile.Plan, Json); acl.Files[StandardStoreFile.Plan].Descriptor[2] ^= 0x10;
            Reject(() => owner.Read(StandardStoreFile.Plan));
        }
        var race = new Backend(); using (var owner = Fresh(race)) {
            owner.WriteNew(StandardStoreFile.Plan, Json); race.Directories[StandardStoreDirectory.Input].Info =
                race.Directories[StandardStoreDirectory.Input].Info with { FileIndex = 999 };
            Reject(() => owner.Read(StandardStoreFile.Plan));
        }
        foreach (bool dispose in new[] { false, true }) {
            var reentry = new Backend(); bool armed = false; StandardProtectedStore? current = null;
            void Guard(string stage) { if (armed && stage == "ImmediatelyBeforeCreateFile") {
                if (dispose) current!.Dispose(); else current!.Read(StandardStoreFile.Plan);
            } }
            using (current = Fresh(reentry, Guard)) {
                armed = true; Reject(() => current.WriteNew(StandardStoreFile.Plan, Json)); Check(reentry.FileCreates == 0);
                armed = false; Check(current.Provenance().Directories.Count == 8);
            }
            var readReentry = new Backend(); armed = false;
            void ReadGuard(string stage) { if (armed && stage == "BeforeRead") {
                if (dispose) current!.Dispose(); else current!.WriteNew(StandardStoreFile.Approval, Json);
            } }
            using (current = Fresh(readReentry, ReadGuard)) {
                current.WriteNew(StandardStoreFile.Plan, Json); armed = true; Reject(() => current.Read(StandardStoreFile.Plan));
                Check(readReentry.FileCreates == 1); armed = false; Check(current.Read(StandardStoreFile.Plan).SequenceEqual(Json));
            }
        }
        // Concurrent Dispose waits for the operation; same-thread callback
        // Dispose/reentry above is refused instead of exploiting Monitor's
        // reentrant lock. All of this is managed fake-handle testing only.
        var concurrent = new Backend(); bool block = false;
        using (var entered = new ManualResetEventSlim()) using (var release = new ManualResetEventSlim())
        using (var disposalStarted = new ManualResetEventSlim()) {
            void Guard(string stage) { if (block && stage == "ImmediatelyBeforeCreateFile") {
                entered.Set(); StandardContract.Need(release.Wait(5000), "FAKE_RELEASE_TIMEOUT");
            } }
            var current = Fresh(concurrent, Guard); block = true;
            var writerTask = Task.Run(() => current.WriteNew(StandardStoreFile.Plan, Json));
            Check(entered.Wait(5000));
            var disposer = Task.Run(() => { disposalStarted.Set(); current.Dispose(); });
            try { Check(disposalStarted.Wait(5000)); Check(!disposer.Wait(50)); }
            finally { release.Set(); }
            Check(writerTask.Wait(5000) && writerTask.Result.ExactReadback); Check(disposer.Wait(5000));
            Check(concurrent.Leases.All(x => x.Disposed)); Reject(() => current.Read(StandardStoreFile.Plan));
        }
        // These are managed evidence/descriptor/sharing fakes, NOT native race,
        // filesystem durability, Windows permission or physical W03 assertions.
        return cases;
    }
}
