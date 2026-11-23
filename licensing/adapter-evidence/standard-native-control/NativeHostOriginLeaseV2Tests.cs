using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostOriginLeaseV2Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Source = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_SOURCE_SET\"}");
    private static readonly byte[] Package = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_PACKAGE_MANIFEST\"}");
    private static readonly byte[] AccountOwned = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:36.1714952+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"createdDisabled\":true}}");
    private static readonly byte[] AccountComplete = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:37.4544800+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"enabled\":false,\"principalSource\":\"Local\",\"groupsComplete\":true,\"localGroupSids\":[\"S-1-5-32-545\"]}}");

    private sealed class FakeHandle : INativeHostOriginHandleV2
    {
        internal readonly NativeHostOriginTargetV2 Target;
        internal readonly NativeHostOriginObservationV2 Baseline;
        internal readonly byte[] Dacl;
        internal readonly byte[] Content;
        internal readonly FakeBackend Owner;
        internal int InspectCalls, DescriptorCalls, ReadCalls, Disposes;
        internal FakeHandle(NativeHostOriginTargetV2 target,
            NativeHostOriginObservationV2 baseline, byte[] dacl, byte[] content,
            FakeBackend owner)
        {
            Target = target; Baseline = baseline; Dacl = dacl; Content = content; Owner = owner;
        }
        public NativeHostOriginObservationV2 Inspect()
        {
            InspectCalls++;
            return Owner.ChangeInspect(this, Baseline);
        }
        public byte[] Descriptor()
        {
            DescriptorCalls++;
            return Owner.ChangeDescriptor(this, (byte[])Dacl.Clone());
        }
        public byte[] ReadBounded(int maximum)
        {
            ReadCalls++;
            if (Content.Length > maximum) throw new InvalidDataException("FAKE_READ_LIMIT");
            return Owner.ChangeRead(this, (byte[])Content.Clone());
        }
        public void Dispose() => Disposes++;
    }

    private sealed class FakeBackend : INativeHostOriginBackendV2
    {
        internal readonly Dictionary<string, NativeHostOriginTargetV2> Targets;
        internal readonly Dictionary<string, byte[]> Contents;
        internal readonly List<FakeHandle> Opened = new();
        internal Func<FakeHandle, NativeHostOriginObservationV2,
            NativeHostOriginObservationV2> ChangeInspect = (_, value) => value;
        internal Func<FakeHandle, byte[], byte[]> ChangeDescriptor = (_, value) => value;
        internal Func<FakeHandle, byte[], byte[]> ChangeRead = (_, value) => value;
        internal Func<NativeHostOriginOpenWitnessV2?, NativeHostOriginOpenWitnessV2?> ChangeWitness = value => value;
        internal string? ThrowAfterAttachPath;
        internal string? DuplicateAtPath;
        internal Action<string>? AfterAttach;
        internal int Opens;
        internal FakeBackend(IReadOnlyList<NativeHostOriginTargetV2> targets,
            Dictionary<string, byte[]> contents)
        {
            Targets = targets.ToDictionary(x => x.Path, StringComparer.Ordinal);
            Contents = contents;
        }
        private void Open(string path, INativeHostOriginHandleV2? parent,
            string leaf, NativeHostOriginHandleSlotV2 output)
        {
            Opens++;
            if (!Targets.TryGetValue(path, out NativeHostOriginTargetV2? target))
                throw new InvalidDataException("FAKE_UNKNOWN_TARGET");
            NativeHostOriginObservationV2? parentOrigin = (parent as FakeHandle)?.Baseline;
            var witness = parentOrigin is null ? null :
                new NativeHostOriginOpenWitnessV2(parentOrigin.HandleObjectId,
                    parentOrigin.Id, leaf);
            witness = ChangeWitness(witness);
            int index = Targets.Values.ToList().FindIndex(x => x.Path == path);
            var id = new NativeHostFileIdInfoV2(0x1234567800000099UL,
                (index + 1).ToString("x32"));
            long creation = (index < 2 ? Issued.AddYears(-1) : Issued.AddMinutes(2))
                .UtcDateTime.ToFileTimeUtc();
            byte[] bytes = Contents.TryGetValue(path, out byte[]? original) ?
                (byte[])original.Clone() : Array.Empty<byte>();
            var observation = new NativeHostOriginObservationV2(@"\\?\" + path,
                1, target.Directory ? 0x10u : 0u, 1, id, creation,
                bytes.Length, (ulong)(index + 1), witness);
            var handle = new FakeHandle(target, observation, Acl(path), bytes, this);
            Opened.Add(handle);
            output.Attach(handle);
            if (path == DuplicateAtPath) {
                var second = new FakeHandle(target, observation, Acl(path), bytes, this);
                Opened.Add(second);
                output.Attach(second);
            }
            AfterAttach?.Invoke(path);
            if (path == ThrowAfterAttachPath)
                throw new InvalidDataException("FAKE_UNKNOWN_AFTER_OPEN");
        }
        public void OpenVolumeRoot(NativeHostOriginHandleSlotV2 output) =>
            Open(@"C:\", null, "", output);
        public void OpenChild(INativeHostOriginHandleV2 heldParent, string exactLeaf,
            bool directory, NativeHostOriginHandleSlotV2 output)
        {
            if (heldParent is not FakeHandle parent ||
                exactLeaf is "" or "." or ".." || exactLeaf.Contains('\\') ||
                exactLeaf.Contains('/') || exactLeaf.Contains(':'))
                throw new InvalidDataException("FAKE_RELATIVE_OPEN_REFUSED");
            string path = parent.Target.Path + (parent.Target.Path.EndsWith('\\') ? "" : @"\") + exactLeaf;
            if (!Targets.TryGetValue(path, out NativeHostOriginTargetV2? target) ||
                target.Directory != directory || target.ParentPath != parent.Target.Path ||
                output.Target.Path != path)
                throw new InvalidDataException("FAKE_PARENT_OR_LEAF_REFUSED");
            Open(path, heldParent, exactLeaf, output);
        }
    }

    private sealed class FakeGuard : INativeHostOriginGuardV2
    {
        internal NativeHostBoundInputV2 Bound = null!;
        internal Action<string>? OnVerify;
        internal int Calls;
        public void Verify(NativeHostBoundInputV2 bound, string point)
        {
            Calls++;
            if (bound.Profile.Attempt != Bound.Profile.Attempt ||
                bound.Profile.CanonicalSha256 != Bound.Profile.CanonicalSha256 ||
                bound.PlanSha256 != Bound.PlanSha256 ||
                bound.ApprovalSha256 != Bound.ApprovalSha256 ||
                string.IsNullOrEmpty(point))
                throw new InvalidDataException("FAKE_GUARD_SCOPE_REFUSED");
            OnVerify?.Invoke(point);
        }
    }

    private sealed class Fixture
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly NativeHostOriginInputV2[] Inputs;
        internal readonly NativeHostOriginAclPinV2[] Acls;
        internal readonly FakeBackend Backend;
        internal readonly FakeGuard Guard = new();
        internal DateTimeOffset Clock = Issued.AddMinutes(5);
        internal Fixture()
        {
            byte[] inventory;
            var profile = NativeHostProfileV2.Create(Attempt, NativeHostInputCodecV2.Hash(Source));
            NativeHostFilePinV2[] files = Enumerable.Range(0, NativeHostInputCodecV2.FrameworkFileCount)
                .Select(NativeHostInputCodecV2.ExpectedRuntimeLeaf)
                .Select((name, index) => new NativeHostFilePinV2(name, index + 1,
                    NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(name)))).ToArray();
            inventory = NativeHostInputCodecV2.EncodeRuntimeInventory(profile, files);
            byte[] config = Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson);
            var plan = new NativeHostPlanV2(profile, Attempt, Issued, Issued.AddMinutes(90),
                new string('a', 64), new string('b', 64),
                NativeHostInputCodecV2.Hash(Package), NativeHostInputCodecV2.Hash(inventory),
                new NativeHostAssetPinV2(252928, new string('c', 64)),
                new NativeHostAssetPinV2(150000, new string('d', 64)),
                new NativeHostAssetPinV2(config.Length, NativeHostInputCodecV2.Hash(config)),
                new NativeHostAssetPinV2(400000, new string('e', 64)), files);
            var approval = new NativeHostApprovalV2(plan,
                Issued.AddMinutes(1), Issued.AddMinutes(30));
            Bound = NativeHostInputCodecV2.Bind(plan.CanonicalBytes(), approval.CanonicalBytes(),
                profile.CanonicalBytes(), Source, Package, inventory, Clock);
            byte[][] bytes = { profile.CanonicalBytes(), (byte[])Source.Clone(), inventory,
                (byte[])Package.Clone(), (byte[])AccountOwned.Clone(),
                (byte[])AccountComplete.Clone(), plan.CanonicalBytes(), approval.CanonicalBytes() };
            Inputs = bytes.Select((original, index) =>
                new NativeHostOriginInputV2((NativeHostStoreFileV2)index, original)).ToArray();
            string root = NativeHostProfileV2.Root;
            string records = root + @"\records";
            string attempt = profile.RecordRoot;
            string input = attempt + @"\input";
            var targets = new List<NativeHostOriginTargetV2> {
                new(@"C:\", null, "", true, null),
                new(@"C:\ProgramData", @"C:\", "ProgramData", true, null),
                new(root, @"C:\ProgramData", "Ecs.Lic008.StandardNativeHostV1", true, null),
                new(records, root, "records", true, null),
                new(attempt, records, Attempt, true, null),
                new(input, attempt, "input", true, null)
            };
            foreach (NativeHostOriginInputV2 item in Inputs) {
                string relative = NativeHostStageStoreV2.Relative(item.File);
                string leaf = relative[@"input\".Length..];
                targets.Add(new(input + @"\" + leaf, input, leaf, false, item.File));
            }
            Acls = targets.Select(x => new NativeHostOriginAclPinV2(x.Path,
                NativeHostInputCodecV2.Hash(Acl(x.Path)))).ToArray();
            var contents = targets.Where(x => x.InputFile.HasValue).ToDictionary(x => x.Path,
                x => (byte[])Inputs[(int)x.InputFile!.Value].Original.Clone(), StringComparer.Ordinal);
            Backend = new FakeBackend(targets, contents);
            Guard.Bound = Bound;
        }
        internal NativeHostOriginLeaseV2 Begin(NativeHostBoundInputV2? bound = null,
            IReadOnlyList<NativeHostOriginInputV2>? inputs = null,
            IReadOnlyList<NativeHostOriginAclPinV2>? acls = null) =>
            NativeHostOriginLeaseV2.Begin(bound ?? Bound, inputs ?? Inputs, acls ?? Acls,
                Backend, Guard, () => Clock);
    }

    private static byte[] Acl(string path) =>
        Encoding.UTF8.GetBytes("TEST_ONLY_UNTRUSTED_ACL_DIGEST:" + path);

    internal static int Run()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException("NATIVE_ORIGIN_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_ORIGIN_REFUSAL_MISSING_" + checks);
        }

        Check(NativeHostInputCodecV2.Hash(AccountOwned) == NativeHostProfileV2.AccountOwnedSha256);
        Check(NativeHostInputCodecV2.Hash(AccountComplete) == NativeHostProfileV2.AccountCompleteSha256);
        {
            var f = new Fixture(); var pristine = f.Begin();
            Check(pristine.Evidence().Length == 0 && pristine.RetainedHandleCount == 0 &&
                !pristine.Completed && !pristine.Faulted);
        }
        {
            var f = new Fixture(); NativeHostOriginLeaseV2 lease = f.Begin();
            byte[] before = (byte[])f.Inputs[0].Original.Clone();
            f.Inputs[0].Original[0] ^= 1; // Begin owned a complete pre-callback snapshot.
            NativeHostOriginSnapshotV2 snapshot = lease.Acquire();
            Check(lease.Completed && !lease.Faulted && f.Backend.Opens == 14 &&
                lease.RetainedHandleCount == 14 && snapshot.Pins.Count == 14);
            Check(snapshot.Attempt == Attempt && snapshot.PlanSha256 == f.Bound.PlanSha256 &&
                snapshot.ApprovalSha256 == f.Bound.ApprovalSha256 &&
                snapshot.SourceSetSha256 == f.Bound.Profile.SourceSetSha256);
            Check(snapshot.Pins.Take(6).All(x => x.Target.Directory) &&
                snapshot.Pins.Skip(6).Select(x => x.Target.InputFile!.Value)
                    .SequenceEqual(Enum.GetValues<NativeHostStoreFileV2>().Take(8)));
            Check(snapshot.Pins.Select(x => x.Origin.Id).Distinct().Count() == 14 &&
                snapshot.Pins.All(x => x.Origin.Id.VolumeSerialNumber == 0x1234567800000099UL));
            Check(snapshot.Pins[6].ContentSha256 == NativeHostInputCodecV2.Hash(before) &&
                snapshot.Pins[6].Origin.FinalPath == @"\\?\" +
                    NativeHostProfileV2.Create(Attempt, f.Bound.Profile.SourceSetSha256).RecordRoot +
                    @"\input\profile.json");
            Check(f.Backend.Opened.All(x => x.Disposes == 0) &&
                lease.Evidence().Length == 14 && lease.Evidence().All(x => x.Accepted));
            Check(!snapshot.FullNativeFileIdentityEstablished &&
                !snapshot.ProtectedAclEstablished &&
                !snapshot.OriginalBytesPhysicallyEstablished &&
                !snapshot.CrossProcessCustodyEstablished &&
                !snapshot.PhysicalAdmission && !snapshot.GrantAuthorized &&
                !snapshot.Lic008Closed && !lease.PhysicalAdmission);
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 14 &&
                f.Backend.Opened.All(x => x.Disposes == 0));
        }
        foreach (int index in new[] { 1, 2, 3, 4, 5, 6, 7 }) {
            var f = new Fixture();
            f.Inputs[index].Original[0] ^= 1;
            Refused(() => f.Begin());
            Check(f.Backend.Opens == 0);
        }
        {
            var f = new Fixture();
            NativeHostOriginInputV2[] swapped = (NativeHostOriginInputV2[])f.Inputs.Clone();
            (swapped[2], swapped[3]) = (swapped[3], swapped[2]);
            Refused(() => f.Begin(inputs: swapped));
            Check(f.Backend.Opens == 0);
        }
        {
            var f = new Fixture();
            NativeHostOriginInputV2[] swapped = (NativeHostOriginInputV2[])f.Inputs.Clone();
            (swapped[4], swapped[5]) = (swapped[5], swapped[4]);
            Refused(() => f.Begin(inputs: swapped));
        }
        {
            var f = new Fixture();
            var forged = new NativeHostBoundInputV2(NativeHostProfileV2.Create(
                "ffffffffffffffffffffffffffffffff", f.Bound.Profile.SourceSetSha256),
                f.Bound.Plan, f.Bound.Approval);
            Refused(() => f.Begin(bound: forged));
            Check(f.Backend.Opens == 0);
        }
        {
            var f = new Fixture();
            f.Acls[3] = f.Acls[3] with { DescriptorSha256 = new string('a', 64) };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 4 &&
                f.Backend.Opened.All(x => x.Disposes == 0));
        }
        var originChanges = new Func<NativeHostOriginObservationV2,
            NativeHostOriginObservationV2>[] {
            x => x with { Id = x.Id with { VolumeSerialNumber = 0x8765432100000099UL } },
            x => x with { Id = x.Id with { FileId128LowerHex =
                "ffffffffffffffff" + x.Id.FileId128LowerHex[16..] } },
            x => x with { FinalPath = @"\\?\C:\Other" },
            x => x with { Attributes = x.Attributes | 0x400u },
            x => x with { LinkCount = 2 },
            x => x with { CreationFileTimeUtc = Issued.AddMinutes(20).UtcDateTime.ToFileTimeUtc() }
        };
        foreach (var change in originChanges) {
            var f = new Fixture();
            f.Backend.ChangeInspect = (handle, value) =>
                handle.Target.Path == @"C:\" && handle.InspectCalls == 2 ? change(value) : value;
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 1 &&
                f.Backend.Opened.All(x => x.Disposes == 0));
            Refused(() => lease.Acquire());
        }
        {
            var f = new Fixture();
            f.Backend.ChangeInspect = (handle, value) =>
                handle.Target.Path == @"C:\ProgramData" && handle.InspectCalls == 3 ?
                    value with { Id = value.Id with { FileId128LowerHex = new string('a', 32) } } : value;
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 2);
        }
        foreach (bool wrongParent in new[] { true, false }) {
            var f = new Fixture();
            f.Backend.ChangeWitness = value => value is null ? null : wrongParent ?
                value with { ParentId = value.ParentId with {
                    FileId128LowerHex = new string('b', 32) } } :
                value with { Leaf = "wrong" };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 2);
        }
        {
            var f = new Fixture();
            f.Backend.ChangeRead = (handle, bytes) => {
                if (handle.Target.InputFile == NativeHostStoreFileV2.Profile) bytes[0] ^= 1;
                return bytes;
            };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 7 &&
                f.Backend.Opened.All(x => x.Disposes == 0));
        }
        {
            var f = new Fixture();
            f.Backend.ChangeDescriptor = (handle, bytes) => {
                if (handle.Target.Path == @"C:\" && handle.DescriptorCalls == 2) bytes[0] ^= 1;
                return bytes;
            };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 1);
        }
        {
            var f = new Fixture();
            string profilePath = f.Backend.Targets.Values.Single(x =>
                x.InputFile == NativeHostStoreFileV2.Profile).Path;
            byte[] sharedDescriptor = Acl(profilePath);
            f.Backend.ChangeDescriptor = (handle, bytes) =>
                handle.Target.Path == profilePath ? sharedDescriptor : bytes;
            f.Backend.ChangeRead = (handle, bytes) => {
                if (handle.Target.Path == profilePath && handle.ReadCalls == 1)
                    sharedDescriptor[0] ^= 1;
                return bytes;
            };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 7);
        }
        {
            var f = new Fixture();
            string profilePath = f.Backend.Targets.Values.Single(x =>
                x.InputFile == NativeHostStoreFileV2.Profile).Path;
            f.Backend.ChangeRead = (handle, bytes) => {
                if (handle.Target.Path == profilePath && handle.ReadCalls == 2)
                    bytes[0] ^= 1; // earlier leaf changes only at final sweep
                return bytes;
            };
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 14);
        }
        {
            var f = new Fixture();
            string approvalPath = f.Backend.Targets.Values.Single(x =>
                x.InputFile == NativeHostStoreFileV2.Approval).Path;
            bool changed = false;
            f.Backend.ChangeRead = (handle, bytes) => {
                if (handle.Target.Path == approvalPath && handle.ReadCalls == 2)
                    changed = true; // mutate metadata during last final read
                return bytes;
            };
            f.Backend.ChangeInspect = (handle, value) =>
                changed && handle.Target.Path == approvalPath ?
                    value with { Attributes = value.Attributes | 0x400u } : value;
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 14);
        }
        {
            var f = new Fixture();
            f.Backend.ThrowAfterAttachPath = @"C:\ProgramData";
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 2 &&
                lease.Evidence().Last().OpenEntered &&
                lease.Evidence().Last().HandleAttached &&
                !lease.Evidence().Last().Accepted &&
                f.Backend.Opened.All(x => x.Disposes == 0));
            Refused(() => lease.Acquire());
        }
        {
            var f = new Fixture();
            f.Backend.DuplicateAtPath = @"C:\";
            var lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 2 &&
                f.Backend.Opened.Count == 2 && f.Backend.Opened.All(x => x.Disposes == 0));
        }
        {
            var f = new Fixture(); NativeHostOriginLeaseV2? lease = null;
            f.Guard.OnVerify = point => {
                if (point == @"AFTER_OPEN_C:\")
                    Refused(() => lease!.Acquire());
            };
            lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 1 &&
                f.Backend.Opened.All(x => x.Disposes == 0));
        }
        {
            var f = new Fixture(); NativeHostOriginLeaseV2? lease = null;
            f.Backend.AfterAttach = path => {
                if (path == @"C:\") Refused(() => _ = lease!.RetainedHandleCount);
            };
            lease = f.Begin();
            Refused(() => lease.Acquire());
            Check(lease.Faulted && lease.RetainedHandleCount == 1 &&
                lease.Evidence().Last().HandleAttached);
        }
        {
            var f = new Fixture(); NativeHostOriginLeaseV2 lease = f.Begin();
            using var entered = new ManualResetEventSlim();
            using var release = new ManualResetEventSlim();
            f.Backend.AfterAttach = path => {
                if (path == @"C:\") { entered.Set(); release.Wait(); }
            };
            Task<NativeHostOriginSnapshotV2> task = Task.Run(lease.Acquire);
            Check(entered.Wait(5000));
            Refused(() => lease.Evidence());
            release.Set();
            Refused(() => task.GetAwaiter().GetResult());
            Check(lease.Faulted && lease.RetainedHandleCount == 1 &&
                lease.Evidence().Last().HandleAttached);
        }
        return checks;
    }
}
