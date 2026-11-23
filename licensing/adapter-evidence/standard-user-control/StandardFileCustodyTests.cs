using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardFileCustodyTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 20, 0, 0, TimeSpan.Zero);
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static byte[] Bytes(string text) => Encoding.UTF8.GetBytes(text);
    private sealed class Fixture
    {
        internal readonly byte[] Sources = Bytes("[{\"syntheticSourceOnly\":true}]");
        internal readonly Dictionary<string, byte[]> Content = new(StringComparer.Ordinal);
        internal readonly StandardCustodyRuntime Runtime;
        internal readonly StandardCustodyPackage Package;
        internal readonly byte[] RuntimeBytes, PackageBytes;
        internal readonly StandardBoundInput Input;
        internal Fixture()
        {
            foreach (string name in StandardFileCustodyRules.RuntimeNames) Content.Add(StandardFileCustodyRules.RuntimePath(name), Bytes("synthetic:" + name));
            Content.Add(StandardFileCustodyRules.Dotnet, Bytes("PUBLIC_SYNTHETIC_DOTNET_IMAGE"));
            Content.Add(StandardFileCustodyRules.Assembly, Bytes("PUBLIC_SYNTHETIC_MANAGED_PAYLOAD"));
            Content.Add(StandardFileCustodyRules.RuntimeConfig, Bytes("{\"synthetic\":true}"));
            Runtime = new(StandardFileCustodyRules.RuntimePurpose, StandardFileCustodyRules.RuntimeNames.Select(n => {
                byte[] bytes = Content[StandardFileCustodyRules.RuntimePath(n)]; return new StandardCustodyRuntimeFile(n, bytes.Length, StandardFileCustodyRules.Hash(bytes));
            }).ToArray());
            Package = new(StandardFileCustodyRules.PackagePurpose, StandardFileCustodyRules.Hash(Sources), new[] {
                new StandardPayloadPin("StandardControl.dll", Content[StandardFileCustodyRules.Assembly].Length, StandardFileCustodyRules.Hash(Content[StandardFileCustodyRules.Assembly])),
                new StandardPayloadPin("StandardControl.runtimeconfig.json", Content[StandardFileCustodyRules.RuntimeConfig].Length, StandardFileCustodyRules.Hash(Content[StandardFileCustodyRules.RuntimeConfig])) });
            RuntimeBytes = StandardFileCustodyRules.Encode(Runtime); PackageBytes = StandardFileCustodyRules.Encode(Package);
            Input = Rebind(PackageBytes, RuntimeBytes);
            Content.Add(StandardFileCustodyRules.Package, PackageBytes); Content.Add(StandardFileCustodyRules.RuntimeInventory, RuntimeBytes);
            Content.Add(StandardFileCustodyRules.SourceSet, Sources);
        }
        internal StandardBoundInput Rebind(byte[] package, byte[] runtime)
        {
            var p = new StandardPlanCore(1, StandardInputCodec.PlanPurpose, "0123456789abcdef0123456789abcdef", Start,
                Start.AddHours(2), StandardContract.Root, StandardContract.OwnerSid, H(1), H(2), StandardContract.AccountName,
                StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
                StandardContract.SetupService, StandardCryptoComparison.SetupSid, StandardContract.GuardianService,
                StandardCryptoComparison.GuardianSid, StandardContract.KeyPrefix, StandardInputCodec.Effects,
                StandardFileCustodyRules.Hash(Sources), StandardFileCustodyRules.Hash(package), StandardFileCustodyRules.Hash(runtime),
                StandardFileCustodyRules.Hash(Content[StandardFileCustodyRules.Dotnet]), Package.Payload);
            byte[] plan = StandardInputCodec.EncodePlan(p);
            var a = new StandardApprovalCore(1, StandardInputCodec.ApprovalPurpose, p.Attempt, StandardFileCustodyRules.Hash(plan),
                Start, Start.AddHours(2), StandardContract.OwnerSid, H(1), H(2), StandardInputCodec.Effects);
            return StandardInputCodec.Bind(plan, StandardInputCodec.EncodeApproval(a), Start.AddMinutes(1));
        }
    }
    private sealed class Data
    {
        internal StandardCustodyObject Info;
        internal byte[] Bytes, Descriptor;
        internal List<string> Children;
        internal bool ExistingWriter;
        internal Data(string path, bool directory, ulong id, byte[] bytes)
        {
            Info = new("\\\\?\\" + path, 1, directory ? 16u : 0u, 1, 7, id,
                Start.AddYears(-1).UtcDateTime.ToFileTimeUtc(), directory ? 0 : bytes.Length);
            Bytes = (byte[])bytes.Clone(); Descriptor = Acl(directory); Children = StandardFileCustodyRules.SearchDirectory(path)
                ? StandardFileCustodyRules.SearchChildren(path).ToList() : new();
        }
    }
    private static byte[] Acl(bool directory, string? owner = null, string? group = null,
        string? extraSid = null, uint extraMask = 0)
    {
        var aces = new List<StandardStoreAce> { new(StandardStoreRules.System, StandardStoreRules.Full), new(StandardStoreRules.Admin, StandardStoreRules.Full) };
        aces.Add(new(extraSid ?? StandardContract.UserSid, extraSid is null ? StandardStoreRules.ReadExecute : extraMask));
        return StandardStoreRules.Descriptor(new(owner ?? StandardStoreRules.Admin, group ?? StandardStoreRules.Admin, directory, aces));
    }
    private sealed class Backend : IStandardFileCustodyBackend
    {
        internal readonly Dictionary<string, Data> Data = new(StringComparer.Ordinal);
        internal readonly List<Handle> Leases = new();
        internal bool Impersonating;
        internal int Opens;
        internal Action<string>? On = null;
        internal Backend(Fixture fixture)
        {
            ulong index = 1;
            foreach (string path in StandardFileCustodyRules.DirectoryPaths) Data.Add(path, new(path, true, index++, Array.Empty<byte>()));
            foreach (string path in StandardFileCustodyRules.LeafPaths) Data.Add(path, new(path, false, index++, fixture.Content[path]));
        }
        public void RequireNoImpersonation() { StandardContract.Need(!Impersonating, "SYNTHETIC_IMPERSONATION"); }
        public IStandardCustodyHandle OpenVolumeRoot() => Open(@"C:\");
        public IStandardCustodyHandle OpenChild(string path, IStandardCustodyHandle parent) {
            StandardContract.Need(parent is Handle p && p.Path == StandardFileCustodyRules.Parent(path), "SYNTHETIC_PARENT_MISMATCH"); return Open(path);
        }
        private Handle Open(string path) { On?.Invoke("Open"); StandardContract.Need(!Data[path].ExistingWriter, "SYNTHETIC_WRITER_REFUSED");
            Opens++; var lease = new Handle(path, this); Leases.Add(lease); return lease; }
    }
    private sealed class Handle : IStandardCustodyHandle
    {
        internal readonly string Path; private readonly Backend backend;
        internal bool Disposed;
        internal Handle(string path, Backend backend) { Path = path; this.backend = backend; }
        private Data Value(string stage) { StandardContract.Need(!Disposed, "SYNTHETIC_CLOSED_HANDLE"); backend.On?.Invoke(stage); return backend.Data[Path]; }
        public StandardCustodyObject Inspect() => Value("Inspect").Info;
        public byte[] Descriptor() => (byte[])Value("Descriptor").Descriptor.Clone();
        public byte[] Read(int maximum) { var data = Value("Read"); StandardContract.Need(data.Bytes.Length <= maximum, "SYNTHETIC_READ_SIZE"); return (byte[])data.Bytes.Clone(); }
        public IReadOnlyList<string> Children() => Value("Children").Children.ToArray();
        public void Dispose() { Disposed = true; }
    }

    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_FILE_CUSTODY_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) { try { work(); } catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("STANDARD_FILE_CUSTODY_EXPECTED_REFUSAL_" + cases); }
        var f = new Fixture();
        StandardFileCustody Acquire(Backend b, Action<string>? guard = null, Func<DateTimeOffset>? clock = null) =>
            StandardFileCustody.Acquire(f.Input, f.PackageBytes, f.RuntimeBytes, f.Sources, b, guard ?? (_ => { }), clock ?? (() => Start.AddMinutes(1)));
        Check(StandardFileCustodyRules.RuntimeNames.Count == 190 && StandardFileCustodyRules.RuntimeNames.Distinct(StringComparer.OrdinalIgnoreCase).Count() == 190);
        Check(StandardFileCustodyRules.RuntimeNames.Count(n => n.StartsWith("app/", StringComparison.Ordinal)) == 189);
        Check(StandardFileCustodyRules.LeafPaths.Count == 196 && StandardFileCustodyRules.LeafPaths.Distinct(StringComparer.OrdinalIgnoreCase).Count() == 196);
        foreach (string name in StandardFileCustodyRules.RuntimeNames) {
            Check(StandardFileCustodyRules.Allowed(StandardFileCustodyRules.RuntimePath(name), false));
            Reject(() => StandardFileCustodyRules.RuntimePath(name + "old"));
        }
        foreach (string bad in new[] { @"C:\Temp\evil.dll", StandardFileCustodyRules.Assembly + ":evil", StandardFileCustodyRules.Dotnet.ToLowerInvariant(),
            StandardFileCustodyRules.App + @"\..\10.0.12\coreclr.dll", StandardFileCustodyRules.SourceSet + ".old" })
            Check(!StandardFileCustodyRules.Allowed(bad, false));
        var b = new Backend(f); using (var lease = Acquire(b)) {
            lease.Verify(); var snapshot = lease.Snapshot();
            Check(snapshot.Pins.Count == 196 + StandardFileCustodyRules.DirectoryPaths.Count && snapshot.Scope == f.Input.Scope && snapshot.SourceSetSha256 == f.Input.SourceSetSha256);
            Check(!snapshot.LoadedModulesAttested && !snapshot.ProcessBindingEstablished && !snapshot.CompiledSourceEquivalenceEstablished &&
                !snapshot.PhysicalExecutionEnabled && !snapshot.SecurityAccepted && !snapshot.ProductionAccepted);
            Check(b.Leases.All(h => !h.Disposed)); int opened = b.Opens; lease.Verify(); Check(b.Opens == opened);
        }
        Check(b.Leases.All(h => h.Disposed));
        foreach (string path in new[] { StandardFileCustodyRules.Dotnet, StandardFileCustodyRules.Assembly, StandardFileCustodyRules.SourceSet,
            StandardFileCustodyRules.App + @"\coreclr.dll" }) {
            foreach (var change in new Func<StandardCustodyObject, StandardCustodyObject>[] {
                x => x with { Type = 2 }, x => x with { Attributes = x.Attributes | 0x400 }, x => x with { Links = 2 },
                x => x with { FileIndex = 0 }, x => x with { VolumeSerial = 0 }, x => x with { CreationFileTimeUtc = long.MaxValue },
                x => x with { CreationFileTimeUtc = Start.AddYears(1).UtcDateTime.ToFileTimeUtc() }, x => x with { FinalPath = x.FinalPath + "old" },
                x => x with { Length = x.Length + 1 }
            }) { var bad = new Backend(f); bad.Data[path].Info = change(bad.Data[path].Info);
                Reject(() => Acquire(bad)); Check(bad.Leases.All(h => h.Disposed)); }
            var writer = new Backend(f); writer.Data[path].ExistingWriter = true; Reject(() => Acquire(writer)); Check(writer.Leases.All(h => h.Disposed));
            var changed = new Backend(f); changed.Data[path].Bytes[0] ^= 1; Reject(() => Acquire(changed));
        }
        foreach (string path in new[] { @"C:\", @"C:\Program Files", StandardFileCustodyRules.App, StandardContract.Root + @"\bin" }) {
            var bad = new Backend(f); bad.Data[path].Info = bad.Data[path].Info with { Attributes = 0x410 }; Reject(() => Acquire(bad));
        }
        foreach (string path in new[] { StandardFileCustodyRules.App, StandardFileCustodyRules.Fxr, StandardContract.Root + @"\bin" }) {
            var bad = new Backend(f); bad.Data[path].Children.Add("unlisted.dll"); Reject(() => Acquire(bad));
            bad = new Backend(f); bad.Data[path].Children.RemoveAt(0); Reject(() => Acquire(bad));
            bad = new Backend(f); bad.Data[path].Children.Add(bad.Data[path].Children[0]); Reject(() => Acquire(bad));
        }
        foreach (bool directory in new[] { false, true }) {
            StandardFileCustodyRules.Descriptor(Acl(directory), directory, directory); Check(true);
            StandardFileCustodyRules.Descriptor(Acl(directory, StandardFileCustodyRules.TrustedInstaller, StandardStoreRules.System), directory, directory); Check(true);
            Reject(() => StandardFileCustodyRules.Descriptor(Acl(directory, StandardContract.OwnerSid), directory, directory));
            Reject(() => StandardFileCustodyRules.Descriptor(Acl(directory, group: StandardContract.UserSid), directory, directory));
            foreach (uint mask in new uint[] { 2, 4, 16, 256, 65536, 262144, 524288, 0x10000000, 0x40000000 }) {
                byte[] acl = Acl(directory, extraSid: StandardContract.UserSid, extraMask: mask);
                Reject(() => StandardFileCustodyRules.Descriptor(acl, directory, directory));
                if (directory && mask == 4) { StandardFileCustodyRules.Descriptor(acl, true, false); Check(true); }
                int start = BinaryPrimitives.ReadInt32LittleEndian(acl.AsSpan(16)) + 8;
                // Locate last ACE, then inherited effective permission is still
                // effective; INHERIT_ONLY affects future children, not current.
                for (int n = 0; n < 2; n++) start += BinaryPrimitives.ReadUInt16LittleEndian(acl.AsSpan(start + 2));
                acl[start + 1] = 16; Reject(() => StandardFileCustodyRules.Descriptor(acl, directory, directory));
                acl[start + 1] = 8; StandardFileCustodyRules.Descriptor(acl, directory, directory); Check(true);
            }
            foreach (byte type in new byte[] { 2, 5, 9, 255 }) {
                byte[] acl = Acl(directory); int start = BinaryPrimitives.ReadInt32LittleEndian(acl.AsSpan(16)) + 8; acl[start] = type;
                Reject(() => StandardFileCustodyRules.Descriptor(acl, directory, directory));
            }
        }
        var permissive = new Backend(f); permissive.Data[StandardFileCustodyRules.App].Descriptor = Acl(true, extraSid: StandardContract.UserSid, extraMask: 4);
        Reject(() => Acquire(permissive));
        foreach (var change in new Func<StandardCustodyRuntime, StandardCustodyRuntime>[] {
            x => x with { Purpose = "OLD" }, x => x with { Files = x.Files.Take(189).ToArray() },
            x => x with { Files = x.Files.Reverse().ToArray() }, x => x with { Files = x.Files.Select((v,i) => i == 0 ? v with { Name = "app/evil.dll" } : v).ToArray() },
            x => x with { Files = x.Files.Select((v,i) => i == 0 ? v with { Size = 0 } : v).ToArray() },
            x => x with { Files = x.Files.Select((v,i) => i == 0 ? v with { Sha256 = "BAD" } : v).ToArray() }
        }) { byte[] raw = StandardFileCustodyRules.Encode(change(f.Runtime)); var input = f.Rebind(f.PackageBytes, raw);
            Reject(() => StandardFileCustodyRules.Bind(input, f.PackageBytes, raw, f.Sources)); }
        foreach (var change in new Func<StandardCustodyPackage, StandardCustodyPackage>[] {
            x => x with { Purpose = "OLD" }, x => x with { SourceSetSha256 = H(50) }, x => x with { Payload = x.Payload.Reverse().ToArray() },
            x => x with { Payload = x.Payload.Append(x.Payload[0]).ToArray() }
        }) { byte[] raw = StandardFileCustodyRules.Encode(change(f.Package)); var input = f.Rebind(raw, f.RuntimeBytes);
            Reject(() => StandardFileCustodyRules.Bind(input, raw, f.RuntimeBytes, f.Sources)); }
        Reject(() => StandardFileCustodyRules.Bind(f.Input, f.PackageBytes, f.RuntimeBytes, Bytes("other")));
        Reject(() => StandardFileCustodyRules.Bind(f.Input, f.PackageBytes.Concat(new byte[] { 32 }).ToArray(), f.RuntimeBytes, f.Sources));
        foreach (var badInput in new[] {
            f.Input with { Plan = f.Input.Plan with { Attempt = new('a', 32) } },
            f.Input with { Plan = f.Input.Plan with { OwnerSid = StandardContract.UserSid } },
            f.Input with { Plan = f.Input.Plan with { HostSha256 = H(88) } },
            f.Input with { Plan = f.Input.Plan with { SourceSetSha256 = H(89) } },
            f.Input with { Approval = f.Input.Approval with { Attempt = new('b', 32) } },
            f.Input with { Approval = f.Input.Approval with { PlanSha256 = H(90) } },
            f.Input with { Approval = f.Input.Approval with { OwnerSid = StandardContract.UserSid } },
            f.Input with { Scope = f.Input.Scope with { PlanSha256 = H(91) } },
            f.Input with { Scope = f.Input.Scope with { ApprovalSha256 = H(92) } },
            f.Input with { Scope = f.Input.Scope with { HostSha256 = H(93) } },
            f.Input with { SourceSetSha256 = H(94) },
            f.Input with { Scope = f.Input.Scope with { IssuedUtc = f.Input.Scope.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) } }
        }) {
            var unopened = new Backend(f);
            Reject(() => StandardFileCustody.Acquire(badInput, f.PackageBytes, f.RuntimeBytes, f.Sources, unopened,
                _ => { }, () => Start.AddMinutes(1))); Check(unopened.Opens == 0);
        }
        string runtimeText = Encoding.UTF8.GetString(f.RuntimeBytes);
        foreach (byte[] raw in new[] {
            Bytes(runtimeText.Replace("\"purpose\":", "\"purpose\":\"DUPLICATE\",\"purpose\":", StringComparison.Ordinal)),
            new byte[] { 0xef, 0xbb, 0xbf }.Concat(f.RuntimeBytes).ToArray(),
            f.RuntimeBytes.Concat(new byte[] { 32 }).ToArray()
        }) {
            var input = f.Rebind(f.PackageBytes, raw);
            Reject(() => StandardFileCustodyRules.Bind(input, f.PackageBytes, raw, f.Sources));
        }
        var payloadCopy = f.Input.Plan.Payload!.ToArray();
        var mutableInput = f.Input with { Plan = f.Input.Plan with { Payload = payloadCopy } };
        var snapshotBackend = new Backend(f);
        using (var independent = StandardFileCustody.Acquire(mutableInput, f.PackageBytes, f.RuntimeBytes, f.Sources,
            snapshotBackend, _ => { }, () => Start.AddMinutes(1))) {
            payloadCopy[0] = payloadCopy[0] with { Name = "CallerChanged.dll", Sha256 = H(95) };
            independent.Verify(); Check(true);
        }
        foreach (string path in new[] { StandardFileCustodyRules.Dotnet, StandardFileCustodyRules.Assembly, StandardFileCustodyRules.App }) {
            var modified = new Backend(f); using var lease = Acquire(modified);
            modified.Data[path].Info = modified.Data[path].Info with { FileIndex = 999999 }; Reject(lease.Verify);
        }
        var descriptorChanged = new Backend(f); using (var lease = Acquire(descriptorChanged)) {
            descriptorChanged.Data[StandardFileCustodyRules.Dotnet].Descriptor = Acl(false, StandardStoreRules.System, StandardStoreRules.System); Reject(lease.Verify);
        }
        var expired = new Backend(f); DateTimeOffset now = Start.AddMinutes(1); using (var lease = Acquire(expired, clock: () => now)) {
            now = Start.AddHours(2); Reject(lease.Verify);
        }
        var impersonated = new Backend(f) { Impersonating = true }; Reject(() => Acquire(impersonated)); Check(impersonated.Opens == 0);
        var inGuard = new Backend(f); Reject(() => Acquire(inGuard, _ => inGuard.Impersonating = true)); Check(inGuard.Opens == 0);
        foreach (bool dispose in new[] { false, true }) {
            bool armed = false; StandardFileCustody? current = null; var reentry = new Backend(f);
            void Guard(string stage) { if (armed && stage == "Verify") { if (dispose) current!.Dispose(); else current!.Snapshot(); } }
            using (current = Acquire(reentry, Guard)) { armed = true; Reject(current.Verify); armed = false; current.Verify(); Check(reentry.Leases.All(h => !h.Disposed)); }
        }
        var concurrently = new Backend(f); bool block = false;
        using (var entered = new ManualResetEventSlim()) using (var release = new ManualResetEventSlim()) using (var startDispose = new ManualResetEventSlim()) {
            void Guard(string stage) { if (block && stage == "Verify") { entered.Set(); StandardContract.Need(release.Wait(5000), "SYNTHETIC_RELEASE_TIMEOUT"); } }
            var current = Acquire(concurrently, Guard); block = true; var work = Task.Run(current.Verify); Check(entered.Wait(5000));
            var disposal = Task.Run(() => { startDispose.Set(); current.Dispose(); });
            try { Check(startDispose.Wait(5000)); Check(!disposal.Wait(50)); } finally { release.Set(); }
            Check(work.Wait(5000)); Check(disposal.Wait(5000)); Check(concurrently.Leases.All(h => h.Disposed)); Reject(current.Verify);
        }
        // Managed fixtures only: no native ACL/alias/race/writable-mapping,
        // module-loading, actual Windows inventory or physical W03 claim.
        return cases;
    }
}
