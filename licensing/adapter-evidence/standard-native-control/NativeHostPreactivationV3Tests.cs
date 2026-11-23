using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostPreactivationV3Tests
{
    private const string RunId = "33333333333333333333333333333333";
    private const string Nonce = "4444444444444444444444444444444444444444444444444444444444444444";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);

    private sealed class ReservationSink : INativeHostReservationSinkV3
    {
        internal readonly Dictionary<string, byte[]> Files = new(StringComparer.OrdinalIgnoreCase);
        internal Func<DateTimeOffset> Clock = null!;
        internal string JournalParentId = null!;
        internal string StageParentId = null!;
        private int nextId = 100;
        public bool? Exists(string path) => Files.ContainsKey(path);
        public NativeHostReservationReceiptV3 CreateNew(NativeHostReservationSlotV3 slot,
            string path, byte[] original)
        {
            if (!Files.TryAdd(path, (byte[])original.Clone()))
                throw new InvalidDataException("FAKE_PREACTIVATION_RESERVATION_COLLISION");
            DateTimeOffset now = Clock();
            int slash = path.LastIndexOf('\\');
            string parentId = slot == NativeHostReservationSlotV3.StandardUserIntent ?
                StageParentId : JournalParentId;
            return new(slot, path, NativeHostInputCodecV2.Hash(original), original.Length,
                now, now.UtcDateTime.ToFileTimeUtc(), "0000000000000011",
                nextId++.ToString("x32"), path[..slash], "0000000000000011",
                parentId, path[(slash + 1)..],
                true, true, true, true, true, true, true);
        }
        public byte[] ReadOriginal(string path) => Files.TryGetValue(path, out byte[]? bytes) ?
            (byte[])bytes.Clone() : throw new InvalidDataException("FAKE_PREACTIVATION_MISSING");
    }

    private sealed class ReservationGuard : INativeHostReservationGuardV3
    {
        internal NativeHostReservationContextV3 Context = null!;
        public void Verify(NativeHostReservationContextV3 context, string point)
        {
            if (context != Context || point.Length == 0)
                throw new InvalidDataException("FAKE_PREACTIVATION_RESERVATION_GUARD");
        }
    }

    private sealed class Backend : INativeHostPreactivationBackendV3
    {
        internal readonly Dictionary<NativeHostStoreFileV3, NativeHostPreactivationObservedV3> Files = new();
        internal readonly List<string> Calls = new();
        internal Func<DateTimeOffset> Clock = null!;
        internal Func<NativeHostStoreFileV3, NativeHostPreactivationObservedV3?,
            NativeHostPreactivationObservedV3?> ChangeRead = (_, value) => value;
        internal Func<NativeHostPreactivationObservedV3,
            NativeHostPreactivationObservedV3> ChangeCreated = value => value;
        internal Action? AfterCreate = null;
        internal bool? ProbeOverride;
        internal bool UnknownProbe;
        internal bool ThrowAfterCreate;
        internal int Creates;
        internal string JournalParentId = null!;
        internal string StageParentId = null!;

        internal static byte[] Acl()
        {
            string sid = NativeHostProfileV2.OwnerSid;
            var descriptor = new RawSecurityDescriptor(
                "O:" + sid + "G:" + sid + "D:P(A;;FA;;;SY)(A;;FA;;;" + sid + ")");
            byte[] raw = new byte[descriptor.BinaryLength];
            descriptor.GetBinaryForm(raw, 0);
            return raw;
        }
        internal NativeHostPreactivationObservedV3 Make(NativeHostStoreFileV3 slot,
            string path, byte[] original)
        {
            DateTimeOffset now = Clock();
            int slash = path.LastIndexOf('\\');
            string parentId = slot == NativeHostStoreFileV3.StandardUserIntent ?
                StageParentId : JournalParentId;
            string fileId = slot switch {
                NativeHostStoreFileV3.StandardUserIntent => "00000000000000000000000000000101",
                NativeHostStoreFileV3.StandardUserLaunchReserved => "00000000000000000000000000000102",
                NativeHostStoreFileV3.AccountActivationIntent => "00000000000000000000000000000103",
                _ => throw new InvalidDataException("FAKE_PREACTIVATION_SLOT")
            };
            return new(slot, path, (byte[])original.Clone(),
                NativeHostInputCodecV2.Hash(original), original.Length,
                now, now.UtcDateTime.ToFileTimeUtc(), "0000000000000011",
                fileId, path[..slash], "0000000000000011", parentId,
                path[(slash + 1)..], Acl(), true, true, true, true, true, true, true);
        }
        private static NativeHostPreactivationObservedV3 Clone(NativeHostPreactivationObservedV3 value) =>
            value with { Original = (byte[])value.Original.Clone(),
                Descriptor = (byte[])value.Descriptor.Clone() };
        public NativeHostPreactivationObservedV3? ReadExisting(NativeHostStoreFileV3 slot,
            string path)
        {
            Calls.Add("READ_" + slot);
            NativeHostPreactivationObservedV3? found = Files.TryGetValue(slot, out var value) &&
                value.Path == path ? Clone(value) : null;
            return ChangeRead(slot, found);
        }
        public bool? Exists(string path)
        {
            Calls.Add("PROBE");
            if (UnknownProbe) return null;
            return ProbeOverride ?? Files.Values.Any(x => x.Path == path);
        }
        public NativeHostPreactivationObservedV3? CreateNew(NativeHostStoreFileV3 slot,
            string path, byte[] original)
        {
            Calls.Add("CREATE_" + slot);
            Creates++;
            if (Files.ContainsKey(slot) || Files.Values.Any(x => x.Path == path))
                throw new InvalidDataException("FAKE_PREACTIVATION_CREATE_COLLISION");
            NativeHostPreactivationObservedV3 saved = Make(slot, path, original);
            Files.Add(slot, saved);
            AfterCreate?.Invoke();
            if (ThrowAfterCreate)
                throw new InvalidDataException("FAKE_PREACTIVATION_UNKNOWN_AFTER_CREATE");
            return ChangeCreated(Clone(saved));
        }
    }

    private sealed class Guard : INativeHostPreactivationGuardV3
    {
        internal NativeHostBoundInputV2 Bound = null!;
        internal NativeHostReservationContextV3 Context = null!;
        internal Action<string>? OnVerify = null;
        public void Verify(NativeHostBoundInputV2 bound,
            NativeHostReservationContextV3 context, string point)
        {
            if (bound != Bound || context != Context || point.Length == 0)
                throw new InvalidDataException("FAKE_PREACTIVATION_GUARD");
            OnVerify?.Invoke(point);
        }
    }

    private sealed class World
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly NativeHostPrefixSealV3 Seal;
        internal readonly NativeHostReservationContextV3 Context;
        internal readonly NativeHostUserIntentV3 Intent;
        internal readonly Backend Store = new();
        internal readonly Guard Custody = new();
        internal DateTimeOffset Clock = Issued.AddMinutes(5);
        internal NativeHostPreactivationV3 Model;
        internal World()
        {
            (Bound, Seal) = NativeHostTranscriptPrefixV3Tests.ValidFixture();
            Context = new(Bound.Plan.HostSha256, Bound.Plan.BootSha256,
                NativeHostProfileV2.OwnerSid,
                101, Issued.AddMinutes(2).UtcDateTime.ToFileTimeUtc(), "000000001234abcd",
                NativeHostProfileV2.OwnerSid, 202,
                Issued.AddMinutes(3).UtcDateTime.ToFileTimeUtc(), "000000005678abcd");
            Intent = NativeHostUserIntentV3.CreateOwner(Bound, Seal,
                NativeHostRole.Owner, RunId, Nonce);
            var reservationSink = new ReservationSink {
                Clock = () => Clock, JournalParentId = Seal.LastParentFileId128,
                StageParentId = Seal.StageDirectoryFileId128
            };
            var reservationGuard = new ReservationGuard { Context = Context };
            var stage = new NativeHostStageReservationV3(Bound, Seal, Context,
                reservationSink, reservationGuard, () => Clock);
            string sha = stage.WriteOwnerIntent(NativeHostRole.Owner, Intent.CanonicalBytes());
            _ = stage.WriteLaunchReservation(NativeHostRole.Owner, sha,
                NativeHostStageReservationV3.UserCommand(Intent));
            Store.Clock = () => Clock;
            Store.JournalParentId = Seal.LastParentFileId128;
            Store.StageParentId = Seal.StageDirectoryFileId128;
            string terminalPath = PathOf(NativeHostStoreFileV3.ServiceGuardianBeforeComplete);
            int terminalSlash = terminalPath.LastIndexOf('\\');
            byte[] terminalOriginal = Seal.CanonicalBytes();
            Store.Files.Add(NativeHostStoreFileV3.ServiceGuardianBeforeComplete,
                new(NativeHostStoreFileV3.ServiceGuardianBeforeComplete,
                    terminalPath, terminalOriginal, Seal.CanonicalSha256,
                    terminalOriginal.Length, Seal.LastWrittenUtc,
                    Seal.LastCreationFileTimeUtc, Seal.VolumeSerial64,
                    Seal.LastFileId128, terminalPath[..terminalSlash],
                    Seal.VolumeSerial64, Seal.LastParentFileId128,
                    terminalPath[(terminalSlash + 1)..], Backend.Acl(),
                    true, true, true, true, true, true, true));
            Store.Files.Add(NativeHostStoreFileV3.StandardUserIntent,
                Store.Make(NativeHostStoreFileV3.StandardUserIntent,
                    PathOf(NativeHostStoreFileV3.StandardUserIntent),
                    stage.ReadOwnerOriginal(NativeHostRole.Owner,
                        NativeHostReservationSlotV3.StandardUserIntent)));
            Store.Files.Add(NativeHostStoreFileV3.StandardUserLaunchReserved,
                Store.Make(NativeHostStoreFileV3.StandardUserLaunchReserved,
                    PathOf(NativeHostStoreFileV3.StandardUserLaunchReserved),
                    stage.ReadOwnerOriginal(NativeHostRole.Owner,
                        NativeHostReservationSlotV3.StandardUserLaunchReserved)));
            Custody.Bound = Bound; Custody.Context = Context;
            Model = NewModel();
        }
        internal string PathOf(NativeHostStoreFileV3 slot) => Bound.Profile.RecordRoot +
            @"\" + NativeHostTranscriptShapeV3.Relative(slot);
        internal NativeHostPreactivationV3 NewModel() =>
            new(Bound, Seal, Context, Store, Custody, () => Clock);
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException("NATIVE_PREACTIVATION_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_PREACTIVATION_REFUSAL_MISSING_" + checks);
        }
        NativeHostTranscriptShapeV3.Validate();
        NativeHostStoreFileV3[] all = NativeHostTranscriptShapeV3.Ordered.ToArray();
        Check(all.Length == 69 && all.Select((x, i) => (int)x == i).All(x => x));
        Check(all[40] == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            all[41] == NativeHostStoreFileV3.StandardUserIntent &&
            all[42] == NativeHostStoreFileV3.StandardUserLaunchReserved &&
            all[43] == NativeHostStoreFileV3.AccountActivationIntent &&
            all[44] == NativeHostStoreFileV3.AccountActivated &&
            all[68] == NativeHostStoreFileV3.ControllerResult);
        NativeHostStoreFileV2[] prior = Enum.GetValues<NativeHostStoreFileV2>();
        foreach (NativeHostStoreFileV3 slot in all) {
            string path = NativeHostTranscriptShapeV3.Relative(slot);
            Check(path.Length > 0 && !path.Contains("..", StringComparison.Ordinal));
            if ((int)slot < 41 || (int)slot > 42) {
                NativeHostStoreFileV2 mapped = prior[(int)slot < 41 ? (int)slot : (int)slot - 1];
                Check(slot.ToString() == mapped.ToString() &&
                    path == NativeHostStageStoreV2.Relative(mapped));
            }
            bool generic = slot is >= NativeHostStoreFileV3.Profile and <= NativeHostStoreFileV3.Approval;
            Check(NativeHostTranscriptShapeV3.IsGenericInput(slot) == generic);
        }
        Check(NativeHostTranscriptShapeV3.Relative(NativeHostStoreFileV3.StandardUserIntent) ==
            @"stage\standard-user-intent-v3.json" &&
            NativeHostTranscriptShapeV3.Relative(NativeHostStoreFileV3.StandardUserLaunchReserved) ==
            @"journal\standard-user-launch-reserved-v3.json" &&
            NativeHostTranscriptShapeV3.Relative(NativeHostStoreFileV3.StandardUserIntent) !=
            NativeHostStageStoreV2.Relative(NativeHostStoreFileV2.StandardUserIntent));
        Check(all.Select(NativeHostTranscriptShapeV3.Relative)
            .Distinct(StringComparer.OrdinalIgnoreCase).Count() == 69);
        foreach (NativeHostStoreFileV3 slot in new[] {
            NativeHostStoreFileV3.StandardUserIntent,
            NativeHostStoreFileV3.StandardUserLaunchReserved,
            NativeHostStoreFileV3.AccountActivationIntent }) {
            Check(NativeHostTranscriptShapeV3.CanRead(NativeHostRole.Owner, slot) &&
                NativeHostTranscriptShapeV3.CanWrite(NativeHostRole.Owner, slot));
            foreach (NativeHostRole role in new[] {
                NativeHostRole.User, NativeHostRole.Guardian, NativeHostRole.Setup })
                Check(!NativeHostTranscriptShapeV3.CanRead(role, slot) &&
                    !NativeHostTranscriptShapeV3.CanWrite(role, slot));
        }
        Refused(() => NativeHostTranscriptShapeV3.Relative((NativeHostStoreFileV3)69));
        Refused(() => NativeHostTranscriptShapeV3.CanRead((NativeHostRole)99,
            NativeHostStoreFileV3.Profile));

        var world = new World();
        NativeHostPreactivationProposalV3 proposal = world.Model.Execute();
        Check(world.Model.ClosedProposalWritten && !world.Model.Faulted &&
            !world.Model.NativeEvidenceEstablished && !world.Model.PhysicalDurabilityProven &&
            !world.Model.AccountActivationAuthorized && !world.Model.UserCreationAuthorized &&
            !world.Model.GrantAuthorized && !world.Model.Lic008Closed);
        Check(!proposal.NativeEvidenceEstablished && !proposal.PhysicalDurabilityProven &&
            !proposal.AccountActivationAuthorized && !proposal.UserCreationAuthorized &&
            !proposal.GrantAuthorized && !proposal.Lic008Closed);
        Check(world.Store.Creates == 1 && world.Store.Files.Count == 4 &&
            world.Store.Calls.SequenceEqual(new[] {
                "READ_ServiceGuardianBeforeComplete", "READ_StandardUserIntent",
                "READ_StandardUserLaunchReserved", "PROBE",
                "CREATE_AccountActivationIntent", "READ_ServiceGuardianBeforeComplete",
                "READ_StandardUserIntent",
                "READ_StandardUserLaunchReserved", "READ_AccountActivationIntent"
            }));
        byte[] result = proposal.CanonicalBytes();
        Check(result.AsSpan().SequenceEqual(world.Store.Files[NativeHostStoreFileV3.AccountActivationIntent].Original) &&
            proposal.ActivationSha256 == NativeHostInputCodecV2.Hash(result));
        result[0] ^= 1;
        Check(proposal.CanonicalBytes()[0] != result[0]);
        using (JsonDocument document = JsonDocument.Parse(proposal.CanonicalBytes())) {
            JsonElement json = document.RootElement;
            Check(json.GetProperty("schema").GetString() == NativeHostPreactivationV3.ActivationSchema &&
                json.GetProperty("slot").GetString() == "AccountActivationIntent" &&
                json.GetProperty("path").GetString() == world.Model.ActivationPath);
            Check(json.GetProperty("intentSha256").GetString() == world.Intent.CanonicalSha256 &&
                json.GetProperty("reservationSha256").GetString() ==
                    world.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved].Sha256 &&
                json.GetProperty("previousSha256").GetString() ==
                    world.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved].Sha256);
            Check(json.GetProperty("exactCommand").GetString() ==
                NativeHostStageReservationV3.UserCommand(world.Intent) &&
                json.GetProperty("runId").GetString() == RunId &&
                json.GetProperty("nonce").GetString() == Nonce);
            Check(!json.GetProperty("nativeEvidenceEstablished").GetBoolean() &&
                !json.GetProperty("accountActivationAuthorized").GetBoolean() &&
                !json.GetProperty("userCreationAuthorized").GetBoolean() &&
                !json.GetProperty("grantAuthorized").GetBoolean());
        }
        Check(world.Model.Evidence() is { WriteEntered: true, ReceiptAdmitted: true,
            FinalReadbackAdmitted: true });
        Refused(() => world.Model.Execute());
        Check(world.Model.Faulted && world.Store.Creates == 1);
        var replay = world.NewModel();
        Refused(() => replay.Execute());
        Check(replay.Faulted && world.Store.Creates == 1);

        var missingPrefix = new World();
        missingPrefix.Store.Files.Remove(NativeHostStoreFileV3.ServiceGuardianBeforeComplete);
        Refused(() => missingPrefix.Model.Execute());
        Check(missingPrefix.Model.Faulted && missingPrefix.Store.Creates == 0);
        var changedPrefix = new World();
        changedPrefix.Store.Files[NativeHostStoreFileV3.ServiceGuardianBeforeComplete] =
            changedPrefix.Store.Files[NativeHostStoreFileV3.ServiceGuardianBeforeComplete]
            with { FileId128 = "00000000000000000000000000000999" };
        Refused(() => changedPrefix.Model.Execute());
        Check(changedPrefix.Model.Faulted && changedPrefix.Store.Creates == 0);
        var wrongSealWorld = new World();
        NativeHostPreactivationObservedV3 wrongSealTerminal =
            wrongSealWorld.Store.Files[NativeHostStoreFileV3.ServiceGuardianBeforeComplete]
            with { FileId128 = "00000000000000000000000000000999" };
        var wrongSeal = new NativeHostPrefixSealV3(wrongSealWorld.Bound,
            wrongSealTerminal, wrongSealWorld.Seal.CanonicalBytes(),
            wrongSealWorld.Seal.PrefixCommitmentSha256,
            wrongSealWorld.Seal.OriginalWrittenUtc,
            wrongSealWorld.Seal.AttemptRootFileId128,
            wrongSealWorld.Seal.SetupRunId, wrongSealWorld.Seal.SetupNonce64,
            wrongSealWorld.Seal.GuardianBeforeRunId,
            wrongSealWorld.Seal.GuardianBeforeNonce64,
            wrongSealWorld.Seal.StageDirectoryPath,
            wrongSealWorld.Seal.StageDirectoryVolumeSerial64,
            wrongSealWorld.Seal.StageDirectoryFileId128);
        var wrongSealModel = new NativeHostPreactivationV3(wrongSealWorld.Bound,
            wrongSeal, wrongSealWorld.Context, wrongSealWorld.Store,
            wrongSealWorld.Custody, () => wrongSealWorld.Clock);
        Refused(() => wrongSealModel.Execute());
        Check(wrongSealModel.Faulted && wrongSealWorld.Store.Creates == 0);
        var intentBeforePrefix = new World();
        intentBeforePrefix.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            intentBeforePrefix.Store.Files[NativeHostStoreFileV3.StandardUserIntent]
            with { CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc() };
        Refused(() => intentBeforePrefix.Model.Execute());
        Check(intentBeforePrefix.Model.Faulted && intentBeforePrefix.Store.Creates == 0);
        var wrongStageParent = new World();
        wrongStageParent.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            wrongStageParent.Store.Files[NativeHostStoreFileV3.StandardUserIntent] with {
                ParentFileId128 = "00000000000000000000000000000009"
            };
        Refused(() => wrongStageParent.Model.Execute());
        Check(wrongStageParent.Model.Faulted && wrongStageParent.Store.Creates == 0);
        var intentAliasesAttemptRoot = new World();
        intentAliasesAttemptRoot.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            intentAliasesAttemptRoot.Store.Files[NativeHostStoreFileV3.StandardUserIntent] with {
                FileId128 = intentAliasesAttemptRoot.Seal.AttemptRootFileId128
            };
        Refused(() => intentAliasesAttemptRoot.Model.Execute());
        Check(intentAliasesAttemptRoot.Model.Faulted &&
            intentAliasesAttemptRoot.Store.Creates == 0);
        var missingIntent = new World();
        missingIntent.Store.Files.Remove(NativeHostStoreFileV3.StandardUserIntent);
        Refused(() => missingIntent.Model.Execute());
        Check(missingIntent.Model.Faulted && missingIntent.Store.Creates == 0);
        var missingReservation = new World();
        missingReservation.Store.Files.Remove(NativeHostStoreFileV3.StandardUserLaunchReserved);
        Refused(() => missingReservation.Model.Execute());
        Check(missingReservation.Model.Faulted && missingReservation.Store.Creates == 0);
        var marker = new World();
        byte[] v2Marker = NativeHostUserIntentV2.CreateOwner(marker.Bound,
            NativeHostRole.Owner, RunId, Nonce).CanonicalBytes();
        marker.Store.Files[NativeHostStoreFileV3.StandardUserIntent] = marker.Store.Make(
            NativeHostStoreFileV3.StandardUserIntent, marker.PathOf(NativeHostStoreFileV3.StandardUserIntent),
            v2Marker);
        Refused(() => marker.Model.Execute());
        Check(marker.Model.Faulted && marker.Store.Creates == 0);
        var swapped = new World();
        swapped.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            swapped.Store.Files[NativeHostStoreFileV3.StandardUserIntent] with {
                Slot = NativeHostStoreFileV3.StandardUserLaunchReserved
            };
        Refused(() => swapped.Model.Execute());
        var wrongOrder = new World();
        var reservationFile = wrongOrder.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved];
        wrongOrder.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] = reservationFile with {
            WrittenUtc = Issued.AddMinutes(4),
            CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc()
        };
        Refused(() => wrongOrder.Model.Execute());
        Check(wrongOrder.Model.Faulted && wrongOrder.Store.Creates == 0);
        var earlyReservationCreation = new World();
        earlyReservationCreation.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
            earlyReservationCreation.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc()
            };
        Refused(() => earlyReservationCreation.Model.Execute());
        Check(earlyReservationCreation.Model.Faulted &&
            earlyReservationCreation.Store.Creates == 0);
        var reservationBeforeOwnOriginal = new World();
        reservationBeforeOwnOriginal.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            reservationBeforeOwnOriginal.Store.Files[NativeHostStoreFileV3.StandardUserIntent]
            with {
                WrittenUtc = Issued.AddMinutes(4),
                CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc()
            };
        reservationBeforeOwnOriginal.Store.Files[
            NativeHostStoreFileV3.StandardUserLaunchReserved] =
            reservationBeforeOwnOriginal.Store.Files[
                NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                CreationFileTimeUtc = Issued.AddMinutes(4).AddSeconds(30)
                    .UtcDateTime.ToFileTimeUtc()
            };
        Refused(() => reservationBeforeOwnOriginal.Model.Execute());
        Check(reservationBeforeOwnOriginal.Model.Faulted &&
            reservationBeforeOwnOriginal.Store.Creates == 0);
        var sameParent = new World();
        sameParent.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
            sameParent.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                ParentFileId128 = sameParent.Store.Files[
                    NativeHostStoreFileV3.StandardUserIntent].ParentFileId128
            };
        Refused(() => sameParent.Model.Execute());
        Check(sameParent.Model.Faulted && sameParent.Store.Creates == 0);
        var intentParentAliasesReservationFile = new World();
        intentParentAliasesReservationFile.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
            intentParentAliasesReservationFile.Store.Files[
                NativeHostStoreFileV3.StandardUserIntent] with {
                ParentFileId128 = intentParentAliasesReservationFile.Store.Files[
                    NativeHostStoreFileV3.StandardUserLaunchReserved].FileId128
            };
        Refused(() => intentParentAliasesReservationFile.Model.Execute());
        Check(intentParentAliasesReservationFile.Model.Faulted &&
            intentParentAliasesReservationFile.Store.Creates == 0);
        var reservationParentAliasesIntentFile = new World();
        reservationParentAliasesIntentFile.Store.Files[
            NativeHostStoreFileV3.StandardUserLaunchReserved] =
            reservationParentAliasesIntentFile.Store.Files[
                NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                ParentFileId128 = reservationParentAliasesIntentFile.Store.Files[
                    NativeHostStoreFileV3.StandardUserIntent].FileId128
            };
        Refused(() => reservationParentAliasesIntentFile.Model.Execute());
        Check(reservationParentAliasesIntentFile.Model.Faulted &&
            reservationParentAliasesIntentFile.Store.Creates == 0);
        var reservationAliasesAttemptRoot = new World();
        reservationAliasesAttemptRoot.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
            reservationAliasesAttemptRoot.Store.Files[
                NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                FileId128 = reservationAliasesAttemptRoot.Seal.AttemptRootFileId128
            };
        Refused(() => reservationAliasesAttemptRoot.Model.Execute());
        Check(reservationAliasesAttemptRoot.Model.Faulted &&
            reservationAliasesAttemptRoot.Store.Creates == 0);
        var otherVolume = new World();
        otherVolume.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
            otherVolume.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] with {
                VolumeSerial64 = "0000000000000033",
                ParentVolumeSerial64 = "0000000000000033"
            };
        Refused(() => otherVolume.Model.Execute());
        Check(otherVolume.Model.Faulted && otherVolume.Store.Creates == 0);

        Func<NativeHostPreactivationObservedV3, NativeHostPreactivationObservedV3>[] bad = {
            x => x with { VolumeSerial64 = "0000000000000033" },
            x => x with { FileId128 = "00000000000000000000000000000000" },
            x => x with { ParentFileId128 = x.FileId128 },
            x => x with { ParentPath = x.ParentPath + "x" },
            x => x with { ParentHeld = false },
            x => x with { RelativeOpen = false },
            x => x with { NoReparse = false },
            x => x with { CreateNew = false },
            x => x with { ProtectedAcl = false },
            x => x with { Flushed = false },
            x => x with { ExactReadback = false },
            x => x with { Descriptor = new byte[20] }
        };
        foreach (var change in bad) {
            var t = new World();
            t.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
                change(t.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved]);
            Refused(() => t.Model.Execute());
            Check(t.Model.Faulted && t.Store.Creates == 0);
        }
        var tamperedIntent = new World();
        byte[] changedIntent = (byte[])tamperedIntent.Intent.CanonicalBytes().Clone();
        changedIntent[0] ^= 1;
        tamperedIntent.Store.Files[NativeHostStoreFileV3.StandardUserIntent] = tamperedIntent.Store.Make(
            NativeHostStoreFileV3.StandardUserIntent,
            tamperedIntent.PathOf(NativeHostStoreFileV3.StandardUserIntent), changedIntent);
        Refused(() => tamperedIntent.Model.Execute());
        var tamperedReservation = new World();
        byte[] changedReservation = (byte[])tamperedReservation.Store.Files[
            NativeHostStoreFileV3.StandardUserLaunchReserved].Original.Clone();
        changedReservation[0] ^= 1;
        tamperedReservation.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved] =
            tamperedReservation.Store.Make(NativeHostStoreFileV3.StandardUserLaunchReserved,
                tamperedReservation.PathOf(NativeHostStoreFileV3.StandardUserLaunchReserved),
                changedReservation);
        Refused(() => tamperedReservation.Model.Execute());
        var existing = new World(); existing.Store.ProbeOverride = true;
        Refused(() => existing.Model.Execute());
        Check(existing.Model.Faulted && existing.Store.Creates == 0);
        var probeUnknown = new World(); probeUnknown.Store.UnknownProbe = true;
        Refused(() => probeUnknown.Model.Execute());
        Check(probeUnknown.Model.Faulted && probeUnknown.Store.Creates == 0);
        var expired = new World(); expired.Clock = Issued.AddMinutes(61);
        Refused(() => expired.Model.Execute());
        Check(expired.Model.Faulted && expired.Store.Calls.Count == 0);
        var wrongContext = new World();
        Refused(() => new NativeHostPreactivationV3(wrongContext.Bound,
            wrongContext.Seal,
            wrongContext.Context with { BootSha256 = new string('f', 64) },
            wrongContext.Store, wrongContext.Custody, () => wrongContext.Clock));

        var afterCreateUnknown = new World();
        afterCreateUnknown.Store.ThrowAfterCreate = true;
        Refused(() => afterCreateUnknown.Model.Execute());
        Check(afterCreateUnknown.Model.Faulted && afterCreateUnknown.Store.Creates == 1 &&
            afterCreateUnknown.Model.Evidence() is { WriteEntered: true, ReceiptAdmitted: false });
        afterCreateUnknown.Store.ThrowAfterCreate = false;
        var afterCreateReplay = afterCreateUnknown.NewModel();
        Refused(() => afterCreateReplay.Execute());
        Check(afterCreateReplay.Faulted && afterCreateUnknown.Store.Creates == 1);
        var badCreate = new World();
        badCreate.Store.ChangeCreated = x => x with { FileId128 =
            badCreate.Store.Files[NativeHostStoreFileV3.StandardUserLaunchReserved].FileId128 };
        Refused(() => badCreate.Model.Execute());
        Check(badCreate.Model.Faulted && badCreate.Store.Creates == 1 &&
            badCreate.Model.Evidence() is { WriteEntered: true, ReceiptAdmitted: false });
        var activationAliasesIntentParent = new World();
        activationAliasesIntentParent.Store.ChangeCreated = x => x with {
            FileId128 = activationAliasesIntentParent.Store.Files[
                NativeHostStoreFileV3.StandardUserIntent].ParentFileId128
        };
        Refused(() => activationAliasesIntentParent.Model.Execute());
        Check(activationAliasesIntentParent.Model.Faulted &&
            activationAliasesIntentParent.Store.Creates == 1 &&
            activationAliasesIntentParent.Model.Evidence() is {
                WriteEntered: true, ReceiptAdmitted: false });
        var activationAliasesJournalParent = new World();
        activationAliasesJournalParent.Store.ChangeCreated = x => x with {
            FileId128 = activationAliasesJournalParent.Store.Files[
                NativeHostStoreFileV3.StandardUserLaunchReserved].ParentFileId128
        };
        Refused(() => activationAliasesJournalParent.Model.Execute());
        Check(activationAliasesJournalParent.Model.Faulted &&
            activationAliasesJournalParent.Store.Creates == 1 &&
            activationAliasesJournalParent.Model.Evidence() is {
                WriteEntered: true, ReceiptAdmitted: false });
        var activationAliasesAttemptRoot = new World();
        activationAliasesAttemptRoot.Store.ChangeCreated = x => x with {
            FileId128 = activationAliasesAttemptRoot.Seal.AttemptRootFileId128
        };
        Refused(() => activationAliasesAttemptRoot.Model.Execute());
        Check(activationAliasesAttemptRoot.Model.Faulted &&
            activationAliasesAttemptRoot.Store.Creates == 1 &&
            activationAliasesAttemptRoot.Model.Evidence() is {
                WriteEntered: true, ReceiptAdmitted: false });
        var earlyActivationCreation = new World();
        earlyActivationCreation.Store.ChangeCreated = x => x with {
            CreationFileTimeUtc = Issued.AddMinutes(4).UtcDateTime.ToFileTimeUtc()
        };
        Refused(() => earlyActivationCreation.Model.Execute());
        Check(earlyActivationCreation.Model.Faulted &&
            earlyActivationCreation.Store.Creates == 1 &&
            earlyActivationCreation.Model.Evidence() is {
                WriteEntered: true, ReceiptAdmitted: false });
        var activationBeforeOwnOriginal = new World();
        activationBeforeOwnOriginal.Custody.OnVerify = point => {
            if (point == "AFTER_ACTIVATION_PROBE")
                activationBeforeOwnOriginal.Clock = Issued.AddMinutes(6);
        };
        activationBeforeOwnOriginal.Store.ChangeCreated = x => x with {
            CreationFileTimeUtc = Issued.AddMinutes(5).AddSeconds(30)
                .UtcDateTime.ToFileTimeUtc()
        };
        Refused(() => activationBeforeOwnOriginal.Model.Execute());
        Check(activationBeforeOwnOriginal.Model.Faulted &&
            activationBeforeOwnOriginal.Store.Creates == 1 &&
            activationBeforeOwnOriginal.Model.Evidence() is {
                WriteEntered: true, ReceiptAdmitted: false });
        var changedDuringCreate = new World();
        changedDuringCreate.Store.AfterCreate = () => {
            var original = changedDuringCreate.Store.Files[NativeHostStoreFileV3.StandardUserIntent];
            changedDuringCreate.Store.Files[NativeHostStoreFileV3.StandardUserIntent] =
                original with { FileId128 = "00000000000000000000000000000999" };
        };
        Refused(() => changedDuringCreate.Model.Execute());
        Check(changedDuringCreate.Model.Faulted && changedDuringCreate.Store.Creates == 1);
        var prefixChangedDuringCreate = new World();
        prefixChangedDuringCreate.Store.AfterCreate = () => {
            var original = prefixChangedDuringCreate.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete];
            prefixChangedDuringCreate.Store.Files[
                NativeHostStoreFileV3.ServiceGuardianBeforeComplete] =
                original with { FileId128 = "00000000000000000000000000000999" };
        };
        Refused(() => prefixChangedDuringCreate.Model.Execute());
        Check(prefixChangedDuringCreate.Model.Faulted &&
            prefixChangedDuringCreate.Store.Creates == 1);
        var reentry = new World();
        reentry.Custody.OnVerify = point => {
            if (point == "BEGIN") Refused(() => reentry.Model.Execute());
        };
        Refused(() => reentry.Model.Execute());
        Check(reentry.Model.Faulted && reentry.Store.Creates == 0);
        var pending = new World();
        pending.Custody.OnVerify = point => {
            if (point == "BEGIN") Refused(() => pending.Model.Evidence());
        };
        Refused(() => pending.Model.Execute());
        Check(pending.Model.Faulted && pending.Store.Creates == 0);
        return checks;
    }
}
