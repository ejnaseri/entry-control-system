using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostTranscriptPrefixV3Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private static readonly DateTimeOffset Issued =
        new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Source = Encoding.UTF8.GetBytes(
        "{\"schema\":\"TEST_SOURCE_SET\"}");
    private static readonly byte[] Package = Encoding.UTF8.GetBytes(
        "{\"schema\":\"TEST_PACKAGE_MANIFEST\"}");
    private static readonly byte[] AccountOwned = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:36.1714952+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"createdDisabled\":true}}");
    private static readonly byte[] AccountComplete = Encoding.UTF8.GetBytes(
        "{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1\",\"attemptId\":\"838384fa60a04a3385a8d83e18342cd7\",\"planSha256\":\"ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b\",\"utc\":\"2026-11-02T13:11:37.4544800+00:00\",\"payload\":{\"name\":\"EcsLic008W03V1\",\"sid\":\"S-1-5-21-3058020570-171625005-1532683838-1023\",\"enabled\":false,\"principalSource\":\"Local\",\"groupsComplete\":true,\"localGroupSids\":[\"S-1-5-32-545\"]}}");

    private sealed class Backend : INativeHostTranscriptPrefixBackendV3
    {
        internal readonly Dictionary<string, NativeHostPrefixDirectoryV3> Dirs =
            new(StringComparer.Ordinal);
        internal readonly Dictionary<NativeHostStoreFileV3,
            NativeHostPreactivationObservedV3> Files = new();
        internal readonly Dictionary<NativeHostStoreFileV3, int> ReadCounts = new();
        internal readonly List<string> Calls = new();
        internal Func<NativeHostStoreFileV3, int, NativeHostPreactivationObservedV3?,
            NativeHostPreactivationObservedV3?> ChangeRead = (_, _, value) => value;
        internal Func<string, NativeHostPrefixDirectoryV3?,
            NativeHostPrefixDirectoryV3?> ChangeDirectory = (_, value) => value;

        public NativeHostPrefixDirectoryV3? ReadDirectory(string exactPath)
        {
            Calls.Add("DIR_" + exactPath);
            NativeHostPrefixDirectoryV3? value = Dirs.TryGetValue(exactPath,
                out var found) ? found with {
                    Descriptor = (byte[])found.Descriptor.Clone()
                } : null;
            return ChangeDirectory(exactPath, value);
        }
        public NativeHostPreactivationObservedV3? ReadOriginal(
            NativeHostStoreFileV3 slot, string exactPath)
        {
            Calls.Add("FILE_" + slot);
            int count = ReadCounts.TryGetValue(slot, out int prior) ? prior + 1 : 1;
            ReadCounts[slot] = count;
            NativeHostPreactivationObservedV3? value = Files.TryGetValue(slot,
                out var found) && found.Path == exactPath ? found with {
                    Original = (byte[])found.Original.Clone(),
                    Descriptor = (byte[])found.Descriptor.Clone()
                } : null;
            return ChangeRead(slot, count, value);
        }
    }

    private sealed class Guard : INativeHostTranscriptPrefixGuardV3
    {
        internal NativeHostBoundInputV2 Bound = null!;
        internal Action<string>? OnVerify;
        public void Verify(NativeHostBoundInputV2 bound, string point)
        {
            if (bound != Bound || point.Length == 0)
                throw new InvalidDataException("FAKE_PREFIX_GUARD_REFUSED");
            OnVerify?.Invoke(point);
        }
    }

    private sealed class World
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly Backend Store = new();
        internal readonly Guard Custody = new();
        internal readonly NativeHostTranscriptPrefixV3 Model;
        internal readonly List<NativeHostPrefixAclPinV3> Pins = new();
        internal DateTimeOffset Clock = Issued.AddMinutes(5);
        internal readonly string[] DirectoryPaths;

        internal World(string attempt = Attempt)
        {
            NativeHostProfileV2 profile = NativeHostProfileV2.Create(
                attempt, NativeHostInputCodecV2.Hash(Source));
            NativeHostFilePinV2[] runtime = Enumerable.Range(0,
                    NativeHostInputCodecV2.FrameworkFileCount)
                .Select(NativeHostInputCodecV2.ExpectedRuntimeLeaf)
                .Select((name, index) => new NativeHostFilePinV2(name, index + 1,
                    NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(name)))).ToArray();
            byte[] inventory = NativeHostInputCodecV2.EncodeRuntimeInventory(profile, runtime);
            byte[] config = Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson);
            NativeHostPlanV2 plan = new(profile, attempt, Issued, Issued.AddMinutes(90),
                new string('a', 64), new string('b', 64),
                NativeHostInputCodecV2.Hash(Package), NativeHostInputCodecV2.Hash(inventory),
                new NativeHostAssetPinV2(252928, new string('c', 64)),
                new NativeHostAssetPinV2(150000, new string('d', 64)),
                new NativeHostAssetPinV2(config.Length, NativeHostInputCodecV2.Hash(config)),
                new NativeHostAssetPinV2(400000, new string('e', 64)), runtime);
            NativeHostApprovalV2 approval = new(plan, Issued.AddMinutes(1),
                Issued.AddMinutes(60));
            Bound = NativeHostInputCodecV2.Bind(plan.CanonicalBytes(),
                approval.CanonicalBytes(), profile.CanonicalBytes(), Source,
                Package, inventory, Clock);
            byte[] acl = OwnerAcl();
            DirectoryPaths = new[] {
                @"C:\", @"C:\ProgramData", NativeHostProfileV2.Root,
                NativeHostProfileV2.Root + @"\records", profile.RecordRoot,
                profile.RecordRoot + @"\input", profile.RecordRoot + @"\journal",
                profile.RecordRoot + @"\stage", profile.RecordRoot + @"\report"
            };
            for (int i = 0; i < DirectoryPaths.Length; i++) {
                string path = DirectoryPaths[i];
                string parent = i == 0 ? "" : i == 1 ? DirectoryPaths[0] :
                    i <= 5 ? DirectoryPaths[i - 1] : DirectoryPaths[4];
                string leaf = i == 0 ? "" : path[(path.LastIndexOf('\\') + 1)..];
                var dir = new NativeHostPrefixDirectoryV3(path, parent, leaf,
                    "0000000000000011", (i + 1).ToString("x32"),
                    i == 0 ? "" : "0000000000000011",
                    i == 0 ? "" : DirectoryId(parent),
                    Clock.UtcDateTime.ToFileTimeUtc(), (byte[])acl.Clone(),
                    true, i != 0, i != 0, true, true);
                Store.Dirs.Add(path, dir);
                Pins.Add(new(path, NativeHostInputCodecV2.Hash(acl)));
            }
            byte[][] originals = {
                profile.CanonicalBytes(), (byte[])Source.Clone(), inventory,
                (byte[])Package.Clone(), (byte[])AccountOwned.Clone(),
                (byte[])AccountComplete.Clone(), plan.CanonicalBytes(),
                approval.CanonicalBytes()
            };
            for (int i = 0; i < 8; i++)
                Store.Files.Add((NativeHostStoreFileV3)i,
                    Make((NativeHostStoreFileV3)i, originals[i], acl));
            string previous = Store.Files[NativeHostStoreFileV3.Approval].Sha256;
            for (int i = 8; i < 40; i++) {
                NativeHostStoreFileV3 slot = (NativeHostStoreFileV3)i;
                int stage = NativeHostPrefixEventCodecV3.Stage(slot);
                string run = stage == 0 ? "" : new string(stage == 1 ? '1' : '2', 32);
                string nonce = stage == 0 ? "" : new string(stage == 1 ? '5' : '6', 64);
                byte[] original = NativeHostPrefixEventCodecV3.Encode(Bound, slot,
                    previous, run, nonce,
                    NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(slot.ToString())),
                    Clock);
                var file = Make(slot, original, acl);
                Store.Files.Add(slot, file);
                previous = file.Sha256;
            }
            byte[] terminal = NativeHostPrefixSealOriginalV3.Encode(Bound,
                DirectoryPaths.Select(path => Store.Dirs[path]).ToArray(),
                Enumerable.Range(0, 40).Select(i => Store.Files[(NativeHostStoreFileV3)i])
                    .ToArray(), previous, new string('2', 32), new string('6', 64),
                NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes("slot40")), Clock);
            Store.Files.Add(NativeHostStoreFileV3.ServiceGuardianBeforeComplete,
                Make(NativeHostStoreFileV3.ServiceGuardianBeforeComplete, terminal, acl));
            for (int i = 0; i < 41; i++) {
                NativeHostPreactivationObservedV3 file = Store.Files[(NativeHostStoreFileV3)i];
                Pins.Add(new(file.Path, NativeHostInputCodecV2.Hash(file.Descriptor)));
            }
            Custody.Bound = Bound;
            Model = NewModel();
        }

        private string DirectoryId(string path) => Store.Dirs[path].FileId128;
        private static byte[] OwnerAcl()
        {
            string sid = NativeHostProfileV2.OwnerSid;
            var descriptor = new RawSecurityDescriptor(
                "O:" + sid + "G:" + sid + "D:P(A;;FA;;;SY)(A;;FA;;;" + sid + ")");
            byte[] raw = new byte[descriptor.BinaryLength];
            descriptor.GetBinaryForm(raw, 0);
            return raw;
        }
        private NativeHostPreactivationObservedV3 Make(NativeHostStoreFileV3 slot,
            byte[] original, byte[] acl)
        {
            string path = Bound.Profile.RecordRoot + @"\" +
                NativeHostTranscriptShapeV3.Relative(slot);
            int slash = path.LastIndexOf('\\');
            string parent = path[..slash];
            return new(slot, path, (byte[])original.Clone(),
                NativeHostInputCodecV2.Hash(original), original.Length, Clock,
                Clock.UtcDateTime.ToFileTimeUtc(), "0000000000000011",
                (100 + (int)slot).ToString("x32"), parent,
                "0000000000000011", DirectoryId(parent), path[(slash + 1)..],
                (byte[])acl.Clone(), true, true, true, true, true, true, true);
        }
        internal NativeHostTranscriptPrefixV3 NewModel() =>
            new(Bound, Pins, Store, Custody, () => Clock);
        internal void ChangeBytes(NativeHostStoreFileV3 slot, byte[] changed)
        {
            var file = Store.Files[slot];
            Store.Files[slot] = file with {
                Original = (byte[])changed.Clone(),
                Sha256 = NativeHostInputCodecV2.Hash(changed),
                Length = changed.Length
            };
        }
        internal void RebuildTerminal(DateTimeOffset originalWritten)
        {
            byte[] raw = NativeHostPrefixSealOriginalV3.Encode(Bound,
                DirectoryPaths.Select(path => Store.Dirs[path]).ToArray(),
                Enumerable.Range(0, 40).Select(i => Store.Files[
                    (NativeHostStoreFileV3)i]).ToArray(),
                Store.Files[NativeHostStoreFileV3.GuardianBeforeComplete].Sha256,
                new string('2', 32), new string('6', 64),
                NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes("slot40")),
                originalWritten);
            ChangeBytes(NativeHostStoreFileV3.ServiceGuardianBeforeComplete, raw);
        }
    }

    // Used by the separate V3 typed-intent tests. The seal is produced by a
    // complete fake-backed verification, never by constructing a hash alone.
    internal static (NativeHostBoundInputV2 Bound, NativeHostPrefixSealV3 Seal)
        ValidFixture(string attempt = Attempt)
    {
        var world = new World(attempt);
        return (world.Bound, world.Model.Verify());
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException("NATIVE_PREFIX_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_PREFIX_REFUSAL_MISSING_" + checks);
        }
        void RefusedCode(Action action, string code) {
            try { action(); }
            catch (InvalidDataException e) {
                if (e.Message != code)
                    throw new InvalidDataException("NATIVE_PREFIX_WRONG_REFUSAL_" +
                        checks + "_" + e.Message, e);
                checks++; return;
            }
            throw new InvalidDataException("NATIVE_PREFIX_REFUSAL_MISSING_" + checks);
        }
        var valid = new World();
        NativeHostPrefixSealV3 seal = valid.Model.Verify();
        Check(valid.Model.Completed && !valid.Model.Faulted &&
            valid.Store.Calls.Count == 100 &&
            valid.Store.Calls.Take(9).SequenceEqual(
                valid.DirectoryPaths.Select(x => "DIR_" + x)) &&
            valid.Store.Calls.Skip(9).Take(41).SequenceEqual(
                Enumerable.Range(0, 41).Select(i => "FILE_" + (NativeHostStoreFileV3)i)) &&
            valid.Store.Calls.Skip(50).SequenceEqual(valid.Store.Calls.Take(50)));
        Check(seal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            seal.TerminalPath == valid.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete].Path &&
            seal.CanonicalSha256 == NativeHostInputCodecV2.Hash(seal.CanonicalBytes()) &&
            seal.CanonicalBytes().AsSpan().SequenceEqual(valid.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete].Original));
        Check(seal.PrefixCommitmentSha256 == NativeHostPrefixSealOriginalV3.Commitment(
            valid.DirectoryPaths.Select(path => valid.Store.Dirs[path]).ToArray(),
            Enumerable.Range(0, 40).Select(i => valid.Store.Files[
                (NativeHostStoreFileV3)i]).ToArray()) &&
            seal.LastFileId128 == valid.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete].FileId128 &&
            seal.LastParentFileId128 == valid.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete].ParentFileId128 &&
            seal.AttemptRootFileId128 == valid.Store.Dirs[valid.DirectoryPaths[4]].FileId128);
        NativeHostPrefixDirectoryV3 stageWitness =
            valid.Store.Dirs[valid.DirectoryPaths[7]];
        Check(seal.StageDirectoryPath == stageWitness.Path &&
            seal.StageDirectoryVolumeSerial64 == stageWitness.VolumeSerial64 &&
            seal.StageDirectoryFileId128 == stageWitness.FileId128 &&
            seal.StageDirectoryPath == valid.Bound.Profile.RecordRoot + @"\stage" &&
            seal.StageDirectoryVolumeSerial64 == seal.VolumeSerial64 &&
            seal.StageDirectoryFileId128 != seal.AttemptRootFileId128 &&
            seal.StageDirectoryFileId128 != seal.LastParentFileId128 &&
            seal.StageDirectoryFileId128 != seal.LastFileId128);
        NativeHostPreactivationObservedV3 terminalWitness = valid.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete];
        NativeHostPrefixSealV3 ConstructWithStage(string path, string volume,
            string id) => new(valid.Bound, terminalWitness, seal.CanonicalBytes(),
                seal.PrefixCommitmentSha256, seal.OriginalWrittenUtc,
                seal.AttemptRootFileId128, seal.SetupRunId, seal.SetupNonce64,
                seal.GuardianBeforeRunId, seal.GuardianBeforeNonce64,
                path, volume, id);
        RefusedCode(() => ConstructWithStage(stageWitness.Path + "x",
            stageWitness.VolumeSerial64, stageWitness.FileId128),
            "NATIVE_PREFIX_STAGE_WITNESS_REFUSED");
        RefusedCode(() => ConstructWithStage(stageWitness.Path,
            "0000000000000033", stageWitness.FileId128),
            "NATIVE_PREFIX_STAGE_WITNESS_REFUSED");
        foreach (string alias in new[] { new string('0', 32),
            seal.AttemptRootFileId128, seal.LastParentFileId128,
            seal.LastFileId128 }) {
            RefusedCode(() => ConstructWithStage(stageWitness.Path,
                stageWitness.VolumeSerial64, alias),
                "NATIVE_PREFIX_STAGE_WITNESS_REFUSED");
        }
        var alternateStage = new World();
        string alternateStagePath = alternateStage.DirectoryPaths[7];
        string alternateStageId = new string('a', 32);
        alternateStage.Store.Dirs[alternateStagePath] =
            alternateStage.Store.Dirs[alternateStagePath] with {
                FileId128 = alternateStageId
            };
        foreach (NativeHostStoreFileV3 slot in alternateStage.Store.Files.Keys.ToArray()) {
            NativeHostPreactivationObservedV3 file = alternateStage.Store.Files[slot];
            if (file.ParentPath == alternateStagePath)
                alternateStage.Store.Files[slot] = file with {
                    ParentFileId128 = alternateStageId
                };
        }
        alternateStage.RebuildTerminal(Issued.AddMinutes(5));
        NativeHostPrefixSealV3 alternateSeal = alternateStage.Model.Verify();
        Check(alternateSeal.StageDirectoryFileId128 == alternateStageId &&
            alternateSeal.StageDirectoryFileId128 != seal.StageDirectoryFileId128 &&
            alternateSeal.PrefixCommitmentSha256 != seal.PrefixCommitmentSha256);
        Check(seal.Attempt == valid.Bound.Profile.Attempt &&
            seal.ProfileSha256 == valid.Bound.Profile.CanonicalSha256 &&
            seal.SourceSetSha256 == valid.Bound.Profile.SourceSetSha256 &&
            seal.PlanSha256 == valid.Bound.Plan.CanonicalSha256 &&
            seal.ApprovalSha256 == valid.Bound.Approval.CanonicalSha256 &&
            seal.HostSha256 == valid.Bound.Plan.HostSha256 &&
            seal.BootSha256 == valid.Bound.Plan.BootSha256 &&
            seal.RecordRoot == valid.Bound.Profile.RecordRoot);
        Check(!seal.NativeEvidenceEstablished && !seal.PhysicalDurabilityProven &&
            !seal.HistoricalAuthorProven && !seal.CrossProcessCustodyProven &&
            !seal.AccountActivationAuthorized && !seal.UserCreationAuthorized &&
            !seal.GrantAuthorized && !seal.Lic008Closed &&
            !valid.Model.NativeEvidenceEstablished &&
            !valid.Model.PhysicalDurabilityProven &&
            !valid.Model.AccountActivationAuthorized &&
            !valid.Model.UserCreationAuthorized &&
            !valid.Model.GrantAuthorized && !valid.Model.Lic008Closed);
        Check(seal.SetupRunId == new string('1', 32) &&
            seal.SetupNonce64 == new string('5', 64) &&
            seal.GuardianBeforeRunId == new string('2', 32) &&
            seal.GuardianBeforeNonce64 == new string('6', 64));
        byte[] altered = seal.CanonicalBytes(); altered[0] ^= 1;
        Check(!seal.CanonicalBytes().AsSpan().SequenceEqual(altered));
        using (JsonDocument doc = JsonDocument.Parse(seal.CanonicalBytes())) {
            JsonElement json = doc.RootElement;
            Check(json.GetProperty("schema").GetString() ==
                NativeHostPrefixSealOriginalV3.Schema &&
                json.GetProperty("predecessorCount").GetInt32() == 40 &&
                json.GetProperty("prefixCommitmentSha256").GetString() ==
                    seal.PrefixCommitmentSha256 &&
                json.GetProperty("previousSha256").GetString() ==
                    valid.Store.Files[NativeHostStoreFileV3.GuardianBeforeComplete].Sha256 &&
                !json.TryGetProperty("canonicalSha256", out _));
        }
        Refused(() => valid.Model.Verify());
        Check(valid.Model.Faulted);

        foreach (NativeHostStoreFileV3 slot in new[] {
            NativeHostStoreFileV3.Profile, NativeHostStoreFileV3.Approval,
            NativeHostStoreFileV3.AttemptConsumed,
            NativeHostStoreFileV3.RestrictedKeyIntent,
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete }) {
            var missing = new World(); missing.Store.Files.Remove(slot);
            Refused(() => missing.Model.Verify());
            Check(missing.Model.Faulted);
        }
        var missingParent = new World();
        missingParent.Store.Dirs.Remove(missingParent.DirectoryPaths[7]);
        Refused(() => missingParent.Model.Verify());
        var wrongSlot = new World();
        wrongSlot.Store.Files[NativeHostStoreFileV3.SetupIntent] =
            wrongSlot.Store.Files[NativeHostStoreFileV3.SetupIntent] with {
                Slot = NativeHostStoreFileV3.SetupGrantIntent
            };
        Refused(() => wrongSlot.Model.Verify());
        var v2Marker = new World();
        byte[] marker = v2Marker.Store.Files[NativeHostStoreFileV3.AttemptConsumed].Original;
        v2Marker.ChangeBytes(NativeHostStoreFileV3.AttemptConsumed,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(marker).Replace(
                NativeHostPrefixEventCodecV3.Schema,
                NativeHostStageStoreV2.EventSchema, StringComparison.Ordinal)));
        Refused(() => v2Marker.Model.Verify());
        var v2Terminal = new World();
        byte[] terminal = v2Terminal.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete].Original;
        v2Terminal.ChangeBytes(NativeHostStoreFileV3.ServiceGuardianBeforeComplete,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(terminal).Replace(
                NativeHostPrefixSealOriginalV3.Schema,
                NativeHostStageStoreV2.EventSchema, StringComparison.Ordinal)));
        Refused(() => v2Terminal.Model.Verify());
        var extraField = new World();
        byte[] slot9 = extraField.Store.Files[NativeHostStoreFileV3.ServiceSetupIntent].Original;
        extraField.ChangeBytes(NativeHostStoreFileV3.ServiceSetupIntent,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(slot9).Replace(
                "{\"schema\"", "{\"extra\":0,\"schema\"", StringComparison.Ordinal)));
        Refused(() => extraField.Model.Verify());
        var wrongPrevious = new World();
        byte[] slot10 = wrongPrevious.Store.Files[NativeHostStoreFileV3.ServiceSetupOwned].Original;
        wrongPrevious.ChangeBytes(NativeHostStoreFileV3.ServiceSetupOwned,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(slot10).Replace(
                "\"previousSha256\":\"" + wrongPrevious.Store.Files[
                    NativeHostStoreFileV3.ServiceSetupIntent].Sha256 + "\"",
                "\"previousSha256\":\"" + new string('f', 64) + "\"",
                StringComparison.Ordinal)));
        Refused(() => wrongPrevious.Model.Verify());
        var changedScope = new World();
        byte[] slot8 = changedScope.Store.Files[NativeHostStoreFileV3.AttemptConsumed].Original;
        changedScope.ChangeBytes(NativeHostStoreFileV3.AttemptConsumed,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(slot8).Replace(
                "\"hostSha256\":\"" + changedScope.Bound.Plan.HostSha256 + "\"",
                "\"hostSha256\":\"" + new string('f', 64) + "\"",
                StringComparison.Ordinal)));
        Refused(() => changedScope.Model.Verify());
        var wrongWriter = new World();
        byte[] key = wrongWriter.Store.Files[NativeHostStoreFileV3.RestrictedKeyIntent].Original;
        wrongWriter.ChangeBytes(NativeHostStoreFileV3.RestrictedKeyIntent,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(key).Replace(
                "\"writerRole\":\"Setup\"", "\"writerRole\":\"Owner\"",
                StringComparison.Ordinal)));
        Refused(() => wrongWriter.Model.Verify());
        var changedRun = new World();
        byte[] setup = changedRun.Store.Files[NativeHostStoreFileV3.ServiceSetupAdmitted].Original;
        changedRun.ChangeBytes(NativeHostStoreFileV3.ServiceSetupAdmitted,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(setup).Replace(
                "\"run\":\"" + new string('1', 32) + "\"",
                "\"run\":\"" + new string('3', 32) + "\"",
                StringComparison.Ordinal)));
        Refused(() => changedRun.Model.Verify());
        var reusedRun = new World();
        byte[] guardian = reusedRun.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeStart].Original;
        reusedRun.ChangeBytes(NativeHostStoreFileV3.ServiceGuardianBeforeStart,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(guardian)
                .Replace("\"run\":\"" + new string('2', 32) + "\"",
                    "\"run\":\"" + new string('1', 32) + "\"",
                    StringComparison.Ordinal)
                .Replace("\"nonce\":\"" + new string('6', 64) + "\"",
                    "\"nonce\":\"" + new string('5', 64) + "\"",
                    StringComparison.Ordinal)));
        Refused(() => reusedRun.Model.Verify());
        var wrongAcl = new World();
        wrongAcl.Store.Files[NativeHostStoreFileV3.SetupReport] =
            wrongAcl.Store.Files[NativeHostStoreFileV3.SetupReport] with {
                Descriptor = new byte[20]
            };
        Refused(() => wrongAcl.Model.Verify());
        var aliasedId = new World();
        aliasedId.Store.Files[NativeHostStoreFileV3.SetupReport] =
            aliasedId.Store.Files[NativeHostStoreFileV3.SetupReport] with {
                FileId128 = aliasedId.Store.Files[
                    NativeHostStoreFileV3.SetupAck].FileId128
            };
        Refused(() => aliasedId.Model.Verify());
        var parentAlias = new World();
        parentAlias.Store.Files[NativeHostStoreFileV3.Profile] =
            parentAlias.Store.Files[NativeHostStoreFileV3.Profile] with {
                FileId128 = parentAlias.Store.Dirs[parentAlias.DirectoryPaths[5]].FileId128
            };
        Refused(() => parentAlias.Model.Verify());
        var wrongParent = new World();
        wrongParent.Store.Files[NativeHostStoreFileV3.GuardianBeforeAck] =
            wrongParent.Store.Files[NativeHostStoreFileV3.GuardianBeforeAck] with {
                ParentFileId128 = new string('f', 32)
            };
        Refused(() => wrongParent.Model.Verify());
        var truncatedVolume = new World();
        truncatedVolume.Store.Files[NativeHostStoreFileV3.SetupAck] =
            truncatedVolume.Store.Files[NativeHostStoreFileV3.SetupAck] with {
                VolumeSerial64 = "11"
            };
        Refused(() => truncatedVolume.Model.Verify());
        var wrongDirectoryAcl = new World();
        wrongDirectoryAcl.Store.Dirs[wrongDirectoryAcl.DirectoryPaths[6]] =
            wrongDirectoryAcl.Store.Dirs[wrongDirectoryAcl.DirectoryPaths[6]] with {
                Descriptor = new byte[20]
            };
        Refused(() => wrongDirectoryAcl.Model.Verify());
        var wrongTime = new World(); wrongTime.Clock = Issued.AddMinutes(61);
        Refused(() => wrongTime.Model.Verify());
        var malformedTerminal = new World();
        byte[] terminalBytes = malformedTerminal.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete].Original;
        malformedTerminal.ChangeBytes(NativeHostStoreFileV3.ServiceGuardianBeforeComplete,
            Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(terminalBytes).Replace(
                "\"prefixCommitmentSha256\":\"" +
                    NativeHostPrefixSealOriginalV3.Commitment(
                        malformedTerminal.DirectoryPaths.Select(path =>
                            malformedTerminal.Store.Dirs[path]).ToArray(),
                        Enumerable.Range(0, 40)
                        .Select(i => malformedTerminal.Store.Files[(NativeHostStoreFileV3)i])
                        .ToArray()) + "\"",
                "\"prefixCommitmentSha256\":\"" + new string('f', 64) + "\"",
                StringComparison.Ordinal)));
        Refused(() => malformedTerminal.Model.Verify());
        var changedReceipt = new World();
        changedReceipt.Store.Files[NativeHostStoreFileV3.SetupReport] =
            changedReceipt.Store.Files[NativeHostStoreFileV3.SetupReport] with {
                FileId128 = new string('a', 32)
            };
        RefusedCode(() => changedReceipt.Model.Verify(),
            "NATIVE_PREFIX_SEAL_CANONICAL_OR_CHAIN_REFUSED");
        var changedAncestorId = new World();
        string nativeRoot = changedAncestorId.DirectoryPaths[2];
        string records = changedAncestorId.DirectoryPaths[3];
        changedAncestorId.Store.Dirs[nativeRoot] =
            changedAncestorId.Store.Dirs[nativeRoot] with {
                FileId128 = new string('a', 32)
            };
        changedAncestorId.Store.Dirs[records] =
            changedAncestorId.Store.Dirs[records] with {
                ParentFileId128 = new string('a', 32)
            };
        RefusedCode(() => changedAncestorId.Model.Verify(),
            "NATIVE_PREFIX_SEAL_CANONICAL_OR_CHAIN_REFUSED");
        var changedAncestorTime = new World();
        string volumeRoot = changedAncestorTime.DirectoryPaths[0];
        changedAncestorTime.Store.Dirs[volumeRoot] =
            changedAncestorTime.Store.Dirs[volumeRoot] with {
                CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc()
            };
        RefusedCode(() => changedAncestorTime.Model.Verify(),
            "NATIVE_PREFIX_SEAL_CANONICAL_OR_CHAIN_REFUSED");
        var changedAncestorAcl = new World();
        string aclRoot = changedAncestorAcl.DirectoryPaths[2];
        string owner = NativeHostProfileV2.OwnerSid;
        var unprotected = new RawSecurityDescriptor(
            "O:" + owner + "G:" + owner +
            "D:(A;;FA;;;SY)(A;;FA;;;" + owner + ")");
        byte[] changedAcl = new byte[unprotected.BinaryLength];
        unprotected.GetBinaryForm(changedAcl, 0);
        changedAncestorAcl.Store.Dirs[aclRoot] =
            changedAncestorAcl.Store.Dirs[aclRoot] with {
                Descriptor = changedAcl, ProtectedAcl = false
            };
        changedAncestorAcl.Pins[2] = changedAncestorAcl.Pins[2] with {
            DescriptorSha256 = NativeHostInputCodecV2.Hash(changedAcl)
        };
        RefusedCode(() => changedAncestorAcl.NewModel().Verify(),
            "NATIVE_PREFIX_SEAL_CANONICAL_OR_CHAIN_REFUSED");
        var earlyEvent = new World();
        NativeHostStoreFileV3 earlySlot = NativeHostStoreFileV3.ServiceSetupIntent;
        byte[] earlyBytes = NativeHostPrefixEventCodecV3.Encode(earlyEvent.Bound,
            earlySlot, earlyEvent.Store.Files[NativeHostStoreFileV3.AttemptConsumed].Sha256,
            "", "", NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(
                earlySlot.ToString())), Issued.AddMinutes(4));
        earlyEvent.ChangeBytes(earlySlot, earlyBytes);
        RefusedCode(() => earlyEvent.Model.Verify(),
            "NATIVE_PREFIX_EVENT_ORDER_REFUSED");
        DateTimeOffset halfMinute = Issued.AddMinutes(5).AddSeconds(30);
        var eventBeforePriorReceipt = new World();
        eventBeforePriorReceipt.Clock = Issued.AddMinutes(6);
        eventBeforePriorReceipt.Store.Files[NativeHostStoreFileV3.AttemptConsumed] =
            eventBeforePriorReceipt.Store.Files[
                NativeHostStoreFileV3.AttemptConsumed] with {
                WrittenUtc = halfMinute
            };
        for (int i = 9; i < 41; i++) {
            NativeHostStoreFileV3 slot = (NativeHostStoreFileV3)i;
            eventBeforePriorReceipt.Store.Files[slot] =
                eventBeforePriorReceipt.Store.Files[slot] with {
                    CreationFileTimeUtc = halfMinute.UtcDateTime.ToFileTimeUtc(),
                    WrittenUtc = halfMinute
                };
        }
        eventBeforePriorReceipt.RebuildTerminal(Issued.AddMinutes(5));
        RefusedCode(() => eventBeforePriorReceipt.Model.Verify(),
            "NATIVE_PREFIX_EVENT_ORDER_REFUSED");
        var sealBeforePriorReceipt = new World();
        sealBeforePriorReceipt.Clock = Issued.AddMinutes(6);
        sealBeforePriorReceipt.Store.Files[
            NativeHostStoreFileV3.GuardianBeforeComplete] =
            sealBeforePriorReceipt.Store.Files[
                NativeHostStoreFileV3.GuardianBeforeComplete] with {
                WrittenUtc = halfMinute
            };
        sealBeforePriorReceipt.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete] =
            sealBeforePriorReceipt.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete] with {
                CreationFileTimeUtc = halfMinute.UtcDateTime.ToFileTimeUtc(),
                WrittenUtc = halfMinute
            };
        sealBeforePriorReceipt.RebuildTerminal(Issued.AddMinutes(5));
        RefusedCode(() => sealBeforePriorReceipt.Model.Verify(),
            "NATIVE_PREFIX_SEAL_ORDER_REFUSED");
        var earlySealCreation = new World();
        earlySealCreation.Clock = Issued.AddMinutes(6);
        byte[] lateSeal = NativeHostPrefixSealOriginalV3.Encode(
            earlySealCreation.Bound,
            earlySealCreation.DirectoryPaths.Select(path =>
                earlySealCreation.Store.Dirs[path]).ToArray(),
            Enumerable.Range(0, 40).Select(i => earlySealCreation.Store.Files[
                (NativeHostStoreFileV3)i]).ToArray(),
            earlySealCreation.Store.Files[
                NativeHostStoreFileV3.GuardianBeforeComplete].Sha256,
            new string('2', 32), new string('6', 64),
            NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes("slot40")),
            earlySealCreation.Clock);
        var oldSealReceipt = earlySealCreation.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete];
        earlySealCreation.Store.Files[
            NativeHostStoreFileV3.ServiceGuardianBeforeComplete] =
            oldSealReceipt with {
                Original = lateSeal,
                Sha256 = NativeHostInputCodecV2.Hash(lateSeal),
                Length = lateSeal.Length,
                WrittenUtc = earlySealCreation.Clock,
                CreationFileTimeUtc = Issued.AddMinutes(5).AddSeconds(30)
                    .UtcDateTime.ToFileTimeUtc()
            };
        RefusedCode(() => earlySealCreation.Model.Verify(),
            "NATIVE_PREFIX_SEAL_ORDER_REFUSED");
        var changedInput = new World();
        changedInput.ChangeBytes(NativeHostStoreFileV3.AccountOwned,
            Encoding.UTF8.GetBytes("{}"));
        RefusedCode(() => changedInput.Model.Verify(),
            "NATIVE_PREFIX_EIGHT_ORIGINALS_REFUSED");
        var wrongPin = new World();
        wrongPin.Pins[9] = wrongPin.Pins[9] with {
            DescriptorSha256 = new string('f', 64)
        };
        RefusedCode(() => wrongPin.NewModel().Verify(),
            "NATIVE_PREFIX_ACL_PIN_REFUSED");
        var missingPin = new World(); missingPin.Pins.RemoveAt(49);
        RefusedCode(() => missingPin.NewModel(),
            "NATIVE_PREFIX_ACL_PINS_REFUSED");
        Func<NativeHostPreactivationObservedV3,
            NativeHostPreactivationObservedV3>[] badFileReceipts = {
            x => x with { Length = x.Length + 1 },
            x => x with { Sha256 = new string('f', 64) },
            x => x with { WrittenUtc = Issued.AddMinutes(61) },
            x => x with { ParentPath = x.ParentPath + "x" },
            x => x with { ParentVolumeSerial64 = "0000000000000033" },
            x => x with { LeafName = x.LeafName + "x" },
            x => x with { ParentHeld = false },
            x => x with { RelativeOpen = false },
            x => x with { NoReparse = false },
            x => x with { CreateNew = false },
            x => x with { ProtectedAcl = false },
            x => x with { Flushed = false },
            x => x with { ExactReadback = false },
            x => x with { FileId128 = new string('0', 32) }
        };
        foreach (var change in badFileReceipts) {
            var badFile = new World();
            badFile.Store.Files[NativeHostStoreFileV3.SetupReport] =
                change(badFile.Store.Files[NativeHostStoreFileV3.SetupReport]);
            Refused(() => badFile.Model.Verify());
            Check(badFile.Model.Faulted);
        }
        Func<NativeHostPrefixDirectoryV3,
            NativeHostPrefixDirectoryV3>[] badDirectoryReceipts = {
            x => x with { ParentHeld = false },
            x => x with { RelativeOpen = false },
            x => x with { NoReparse = false },
            x => x with { ParentFileId128 = new string('f', 32) },
            x => x with { VolumeSerial64 = "0000000000000033" },
            x => x with { FileId128 = new string('0', 32) },
            x => x with { ProtectedAcl = false }
        };
        foreach (var change in badDirectoryReceipts) {
            var badDirectory = new World();
            string path = badDirectory.DirectoryPaths[7];
            badDirectory.Store.Dirs[path] = change(badDirectory.Store.Dirs[path]);
            Refused(() => badDirectory.Model.Verify());
            Check(badDirectory.Model.Faulted);
        }
        var finalDirectoryMutation = new World();
        int directoryReads = 0;
        finalDirectoryMutation.Store.ChangeDirectory = (path, dir) => {
            if (path == finalDirectoryMutation.DirectoryPaths[8] &&
                ++directoryReads == 2 && dir is not null)
                return dir with { FileId128 = new string('a', 32) };
            return dir;
        };
        RefusedCode(() => finalDirectoryMutation.Model.Verify(),
            "NATIVE_PREFIX_FINAL_DIRECTORY_CHANGED");
        var finalStageMutation = new World();
        int stageReads = 0;
        finalStageMutation.Store.ChangeDirectory = (path, dir) => {
            if (path == finalStageMutation.DirectoryPaths[7] &&
                ++stageReads == 2 && dir is not null)
                return dir with { FileId128 = new string('a', 32) };
            return dir;
        };
        RefusedCode(() => finalStageMutation.Model.Verify(),
            "NATIVE_PREFIX_FINAL_DIRECTORY_CHANGED");
        var finalMutation = new World();
        finalMutation.Store.ChangeRead = (slot, count, file) =>
            slot == NativeHostStoreFileV3.ServiceSetupIntent && count == 2 &&
            file is not null ? file with {
                FileId128 = new string('a', 32)
            } : file;
        Refused(() => finalMutation.Model.Verify());
        var unknown = new World();
        unknown.Store.ChangeRead = (slot, _, file) =>
            slot == NativeHostStoreFileV3.GuardianBeforeReport ? null : file;
        Refused(() => unknown.Model.Verify());
        var reentry = new World();
        reentry.Custody.OnVerify = point => {
            if (point == "BEGIN") Refused(() => reentry.Model.Verify());
        };
        Refused(() => reentry.Model.Verify());
        Check(reentry.Model.Faulted);
        return checks;
    }
}
