using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostStageReservationV3Tests
{
    private const string RunId = "33333333333333333333333333333333";
    private const string Nonce = "4444444444444444444444444444444444444444444444444444444444444444";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly Lazy<(NativeHostBoundInputV2 Bound, NativeHostPrefixSealV3 Seal)>
        ValidPrefix = new(() => NativeHostTranscriptPrefixV3Tests.ValidFixture());

    private sealed class Sink : INativeHostReservationSinkV3
    {
        internal readonly Dictionary<string, byte[]> Files = new(StringComparer.OrdinalIgnoreCase);
        internal Func<DateTimeOffset> Clock = null!;
        internal Func<NativeHostReservationReceiptV3, NativeHostReservationReceiptV3> ChangeReceipt = x => x;
        internal Func<string, byte[], byte[]> ChangeRead = (_, bytes) => bytes;
        internal Action<string>? OnProbe;
        internal Action? OnCreate;
        internal bool UnknownProbe;
        internal bool ThrowAfterCreate;
        internal int Creates;
        private int nextId = 100;

        public bool? Exists(string path)
        {
            OnProbe?.Invoke(path);
            return UnknownProbe ? null : Files.ContainsKey(path);
        }

        public NativeHostReservationReceiptV3 CreateNew(
            NativeHostReservationSlotV3 slot, string path, byte[] original)
        {
            Creates++;
            if (!Files.TryAdd(path, (byte[])original.Clone()))
                throw new InvalidDataException("FAKE_RESERVATION_CREATE_COLLISION");
            OnCreate?.Invoke();
            if (ThrowAfterCreate) throw new InvalidDataException("FAKE_RESERVATION_UNKNOWN_CREATE");
            DateTimeOffset now = Clock();
            int slash = path.LastIndexOf('\\');
            var receipt = new NativeHostReservationReceiptV3(slot, path,
                NativeHostInputCodecV2.Hash(original), original.Length,
                now, now.UtcDateTime.ToFileTimeUtc(),
                "0000000000000011", nextId++.ToString("x32"),
                path[..slash], "0000000000000011",
                slot == NativeHostReservationSlotV3.StandardUserIntent ?
                    "00000000000000000000000000000008" :
                    "00000000000000000000000000000007",
                path[(slash + 1)..], true, true, true, true, true, true, true);
            return ChangeReceipt(receipt);
        }

        public byte[] ReadOriginal(string path)
        {
            if (!Files.TryGetValue(path, out byte[]? raw))
                throw new InvalidDataException("FAKE_RESERVATION_MISSING");
            return ChangeRead(path, (byte[])raw.Clone());
        }
    }

    private sealed class Guard : INativeHostReservationGuardV3
    {
        internal NativeHostReservationContextV3 Context = null!;
        internal Action<string>? OnVerify;
        public void Verify(NativeHostReservationContextV3 context, string point)
        {
            if (context != Context || string.IsNullOrEmpty(point))
                throw new InvalidDataException("FAKE_RESERVATION_CONTEXT_CHANGED");
            OnVerify?.Invoke(point);
        }
    }

    private sealed class World
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly NativeHostPrefixSealV3 Seal;
        internal readonly NativeHostReservationContextV3 Context;
        internal readonly Sink Store = new();
        internal readonly Guard Custody = new();
        internal readonly NativeHostStageReservationV3 Reservation;
        internal DateTimeOffset Clock = Issued.AddMinutes(5);

        internal World()
        {
            (Bound, Seal) = ValidPrefix.Value;
            NativeHostPlanV2 plan = Bound.Plan;
            Context = new(plan.HostSha256, plan.BootSha256, NativeHostProfileV2.OwnerSid,
                101, Issued.AddMinutes(2).UtcDateTime.ToFileTimeUtc(), "000000001234abcd",
                NativeHostProfileV2.OwnerSid, 202,
                Issued.AddMinutes(3).UtcDateTime.ToFileTimeUtc(), "000000005678abcd");
            Store.Clock = () => Clock;
            Custody.Context = Context;
            Reservation = NewInstance();
        }

        internal NativeHostStageReservationV3 NewInstance() =>
            new(Bound, Seal, Context, Store, Custody, () => Clock);
        internal NativeHostUserIntentV3 Intent() =>
            NativeHostUserIntentV3.CreateOwner(Bound, Seal,
                NativeHostRole.Owner, RunId, Nonce);
        internal string WriteIntent() =>
            Reservation.WriteOwnerIntent(NativeHostRole.Owner, Intent().CanonicalBytes());
        internal string WriteReservation(string? digest = null, string? command = null) =>
            Reservation.WriteLaunchReservation(NativeHostRole.Owner,
                digest ?? Intent().CanonicalSha256,
                command ?? NativeHostStageReservationV3.UserCommand(Intent()));
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException("NATIVE_STAGE_RESERVATION_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_STAGE_RESERVATION_REFUSAL_MISSING_" + checks);
        }

        var w = new World();
        string intentPath = w.Reservation.PathOf(NativeHostReservationSlotV3.StandardUserIntent);
        string reservationPath = w.Reservation.PathOf(NativeHostReservationSlotV3.StandardUserLaunchReserved);
        Check(intentPath == w.Bound.Profile.RecordRoot + @"\stage\standard-user-intent-v3.json");
        Check(reservationPath == w.Bound.Profile.RecordRoot +
            @"\journal\standard-user-launch-reserved-v3.json");
        Check(intentPath != reservationPath &&
            NativeHostStageStoreV2.Relative(NativeHostStoreFileV2.StandardUserIntent) !=
                NativeHostStageReservationV3.Relative(NativeHostReservationSlotV3.StandardUserIntent));
        foreach (NativeHostReservationSlotV3 slot in Enum.GetValues<NativeHostReservationSlotV3>()) {
            Check(NativeHostStageReservationV3.CanRead(NativeHostRole.Owner, slot));
            foreach (NativeHostRole role in new[] {
                NativeHostRole.User, NativeHostRole.Guardian, NativeHostRole.Setup })
                Check(!NativeHostStageReservationV3.CanRead(role, slot));
        }
        Refused(() => NativeHostStageReservationV3.Relative((NativeHostReservationSlotV3)99));
        Refused(() => NativeHostStageReservationV3.CanRead((NativeHostRole)99,
            NativeHostReservationSlotV3.StandardUserIntent));
        Check(!w.Reservation.NativeEvidenceEstablished &&
            !w.Reservation.PhysicalDurabilityProven &&
            !w.Reservation.AccountActivationAuthorized &&
            !w.Reservation.UserCreationAuthorized && !w.Reservation.GrantAuthorized &&
            !w.Reservation.Lic008Closed && !w.Reservation.ClosedReservationComplete);

        string intentSha = w.WriteIntent();
        Check(intentSha == w.Intent().CanonicalSha256 &&
            w.Store.Files[intentPath].AsSpan().SequenceEqual(w.Intent().CanonicalBytes()));
        byte[] copy = w.Reservation.ReadOwnerOriginal(NativeHostRole.Owner,
            NativeHostReservationSlotV3.StandardUserIntent);
        copy[0] ^= 1;
        Check(w.Reservation.ReadOwnerOriginal(NativeHostRole.Owner,
            NativeHostReservationSlotV3.StandardUserIntent)[0] != copy[0]);
        Check(!w.Reservation.ClosedReservationComplete && w.Store.Creates == 1);
        string reservationSha = w.WriteReservation();
        Check(w.Reservation.ClosedReservationComplete && w.Store.Creates == 2 &&
            reservationSha == NativeHostInputCodecV2.Hash(w.Store.Files[reservationPath]));
        using (JsonDocument doc = JsonDocument.Parse(w.Reservation.ReadOwnerOriginal(
            NativeHostRole.Owner, NativeHostReservationSlotV3.StandardUserLaunchReserved))) {
            JsonElement root = doc.RootElement;
            Check(root.GetProperty("schema").GetString() == NativeHostStageReservationV3.ReservationSchema &&
                root.GetProperty("intentSha256").GetString() == intentSha &&
                root.GetProperty("previousSha256").GetString() == intentSha);
            Check(root.GetProperty("hostSha256").GetString() == w.Context.HostSha256 &&
                root.GetProperty("bootSha256").GetString() == w.Context.BootSha256 &&
                root.GetProperty("ownerSid").GetString() == NativeHostProfileV2.OwnerSid &&
                root.GetProperty("workerProcessId").GetUInt32() == w.Context.WorkerProcessId);
            Check(root.GetProperty("runId").GetString() == RunId &&
                root.GetProperty("nonce").GetString() == Nonce &&
                root.GetProperty("exactCommand").GetString() ==
                    NativeHostStageReservationV3.UserCommand(w.Intent()));
            Check(!root.GetProperty("accountActivationAuthorized").GetBoolean() &&
                !root.GetProperty("userCreationAuthorized").GetBoolean() &&
                !root.GetProperty("grantAuthorized").GetBoolean());
        }
        Check(w.Reservation.Evidence().Length == 2 &&
            w.Reservation.Evidence().All(x => x.WriteEntered && x.ReceiptAdmitted && x.ReadbackAdmitted));
        Check(!w.Reservation.NativeEvidenceEstablished &&
            !w.Reservation.PhysicalDurabilityProven &&
            !w.Reservation.AccountActivationAuthorized && !w.Reservation.UserCreationAuthorized);

        // A new object with the same injected backing store cannot replay or
        // adopt either the complete or an intent-only prior attempt.
        var replay = w.NewInstance();
        Refused(() => replay.WriteOwnerIntent(NativeHostRole.Owner, w.Intent().CanonicalBytes()));
        Check(replay.Faulted && w.Store.Creates == 2 && replay.Evidence().Length == 0);
        var intentOnly = new World();
        intentOnly.WriteIntent();
        var intentOnlyReplay = intentOnly.NewInstance();
        Refused(() => intentOnlyReplay.WriteOwnerIntent(NativeHostRole.Owner,
            intentOnly.Intent().CanonicalBytes()));
        Check(intentOnlyReplay.Faulted && intentOnly.Store.Creates == 1);

        var reserveFirst = new World();
        Refused(() => reserveFirst.WriteReservation());
        Check(reserveFirst.Reservation.Faulted && reserveFirst.Store.Creates == 0);
        var wrongRole = new World();
        Refused(() => wrongRole.Reservation.WriteOwnerIntent(NativeHostRole.User,
            wrongRole.Intent().CanonicalBytes()));
        Check(wrongRole.Reservation.Faulted && wrongRole.Store.Creates == 0);
        var wrongOriginal = new World();
        byte[] changed = wrongOriginal.Intent().CanonicalBytes(); changed[^2] ^= 1;
        Refused(() => wrongOriginal.Reservation.WriteOwnerIntent(NativeHostRole.Owner, changed));
        var v2Intent = new World();
        byte[] oldIntent = NativeHostUserIntentV2.CreateOwner(v2Intent.Bound,
            NativeHostRole.Owner, RunId, Nonce).CanonicalBytes();
        Refused(() => v2Intent.Reservation.WriteOwnerIntent(
            NativeHostRole.Owner, oldIntent));
        Check(v2Intent.Reservation.Faulted && v2Intent.Store.Creates == 0);
        Check(wrongOriginal.Reservation.Faulted && wrongOriginal.Store.Creates == 0);
        var duplicate = new World();
        duplicate.WriteIntent();
        Refused(() => duplicate.WriteIntent());
        Check(duplicate.Reservation.Faulted && duplicate.Store.Creates == 1);
        var wrongCommand = new World();
        wrongCommand.WriteIntent();
        Refused(() => wrongCommand.WriteReservation(command: "--user"));
        Check(wrongCommand.Reservation.Faulted && wrongCommand.Store.Creates == 1);
        var wrongDigest = new World();
        wrongDigest.WriteIntent();
        Refused(() => wrongDigest.WriteReservation(digest: new string('f', 64)));
        Check(wrongDigest.Reservation.Faulted && wrongDigest.Store.Creates == 1);
        var changedIntent = new World();
        changedIntent.WriteIntent();
        changedIntent.Store.Files[changedIntent.Reservation.PathOf(
            NativeHostReservationSlotV3.StandardUserIntent)][0] ^= 1;
        Refused(() => changedIntent.WriteReservation());
        Check(changedIntent.Reservation.Faulted && changedIntent.Store.Creates == 1);

        // Unknown probes and entered writes strand the whole attempt. A fresh
        // instance sees the physical name still occupied in the fake store.
        var unknownProbe = new World();
        unknownProbe.Store.UnknownProbe = true;
        Refused(() => unknownProbe.WriteIntent());
        Check(unknownProbe.Reservation.Faulted && unknownProbe.Store.Creates == 0);
        var partial = new World();
        partial.Store.ThrowAfterCreate = true;
        Refused(() => partial.WriteIntent());
        Check(partial.Reservation.Faulted && partial.Store.Creates == 1 &&
            partial.Reservation.Evidence().Single().WriteEntered &&
            !partial.Reservation.Evidence().Single().ReceiptAdmitted);
        partial.Store.ThrowAfterCreate = false;
        var partialReplay = partial.NewInstance();
        Refused(() => partialReplay.WriteOwnerIntent(NativeHostRole.Owner,
            partial.Intent().CanonicalBytes()));
        Check(partialReplay.Faulted && partial.Store.Creates == 1);
        var reservePartial = new World();
        reservePartial.WriteIntent();
        reservePartial.Store.ThrowAfterCreate = true;
        Refused(() => reservePartial.WriteReservation());
        Check(reservePartial.Reservation.Faulted && reservePartial.Store.Creates == 2 &&
            reservePartial.Reservation.Evidence()[1].WriteEntered &&
            !reservePartial.Reservation.Evidence()[1].ReceiptAdmitted);
        reservePartial.Store.ThrowAfterCreate = false;
        Refused(() => reservePartial.NewInstance().WriteOwnerIntent(NativeHostRole.Owner,
            reservePartial.Intent().CanonicalBytes()));
        Check(reservePartial.Store.Creates == 2);

        Func<NativeHostReservationReceiptV3, NativeHostReservationReceiptV3>[] badReceipts = {
            r => r with { Slot = NativeHostReservationSlotV3.StandardUserLaunchReserved },
            r => r with { Sha256 = new string('f', 64) },
            r => r with { VolumeSerial64 = "0000000000000000" },
            r => r with { FileId128 = "00000000000000000000000000000000" },
            r => r with { FileId128 = "0000000000000001" },
            r => r with { ParentVolumeSerial64 = "0000000000000033" },
            r => r with { ParentFileId128 = r.FileId128 },
            r => r with { ParentPath = r.ParentPath + "x" },
            r => r with { ParentFileId128 = "0000000000000000" },
            r => r with { LeafName = r.LeafName + "x" },
            r => r with { ParentHeld = false },
            r => r with { RelativeOpen = false },
            r => r with { NoReparse = false },
            r => r with { CreateNew = false },
            r => r with { ProtectedAcl = false },
            r => r with { Flushed = false },
            r => r with { ExactReadback = false }
        };
        foreach (var mutation in badReceipts) {
            var bad = new World();
            bad.Store.ChangeReceipt = mutation;
            Refused(() => bad.WriteIntent());
            Check(bad.Reservation.Faulted && bad.Store.Creates == 1 &&
                bad.Reservation.Evidence().Single().WriteEntered &&
                !bad.Reservation.Evidence().Single().ReceiptAdmitted);
        }
        var changedReadback = new World();
        changedReadback.Store.ChangeRead = (_, raw) => { raw[0] ^= 1; return raw; };
        Refused(() => changedReadback.WriteIntent());
        Check(changedReadback.Reservation.Faulted && changedReadback.Store.Creates == 1 &&
            changedReadback.Reservation.Evidence().Single().ReceiptAdmitted &&
            !changedReadback.Reservation.Evidence().Single().ReadbackAdmitted);
        var nullReceipt = new World();
        nullReceipt.Store.ChangeReceipt = _ => null!;
        Refused(() => nullReceipt.WriteIntent());
        Check(nullReceipt.Reservation.Faulted && nullReceipt.Store.Creates == 1);
        foreach (var mutation in badReceipts.Skip(1)) {
            var badReservation = new World();
            badReservation.WriteIntent();
            badReservation.Store.ChangeReceipt = mutation;
            Refused(() => badReservation.WriteReservation());
            Check(badReservation.Reservation.Faulted && badReservation.Store.Creates == 2 &&
                badReservation.Reservation.Evidence()[1].WriteEntered &&
                !badReservation.Reservation.Evidence()[1].ReceiptAdmitted);
        }
        var reservationReadback = new World();
        reservationReadback.WriteIntent();
        reservationReadback.Store.ChangeRead = (path, raw) => {
            if (path.EndsWith("standard-user-launch-reserved-v3.json", StringComparison.Ordinal))
                raw[0] ^= 1;
            return raw;
        };
        Refused(() => reservationReadback.WriteReservation());
        Check(reservationReadback.Reservation.Faulted && reservationReadback.Store.Creates == 2 &&
            !reservationReadback.Reservation.Evidence()[1].ReadbackAdmitted);
        var otherVolume = new World();
        otherVolume.WriteIntent();
        otherVolume.Store.ChangeReceipt = r => r with {
            VolumeSerial64 = "0000000000000033",
            ParentVolumeSerial64 = "0000000000000033"
        };
        Refused(() => otherVolume.WriteReservation());
        Check(otherVolume.Reservation.Faulted && otherVolume.Store.Creates == 2 &&
            !otherVolume.Reservation.Evidence()[1].ReceiptAdmitted);
        var prefixVolumeMismatch = new World();
        prefixVolumeMismatch.Store.ChangeReceipt = r => r with {
            VolumeSerial64 = "0000000000000033",
            ParentVolumeSerial64 = "0000000000000033"
        };
        Refused(() => prefixVolumeMismatch.WriteIntent());
        Check(prefixVolumeMismatch.Reservation.Faulted &&
            prefixVolumeMismatch.Store.Creates == 1 &&
            !prefixVolumeMismatch.Reservation.Evidence()[0].ReceiptAdmitted);
        var prefixFileAlias = new World();
        prefixFileAlias.Store.ChangeReceipt = r => r with {
            FileId128 = prefixFileAlias.Seal.LastFileId128
        };
        Refused(() => prefixFileAlias.WriteIntent());
        Check(prefixFileAlias.Reservation.Faulted &&
            prefixFileAlias.Store.Creates == 1 &&
            !prefixFileAlias.Reservation.Evidence()[0].ReceiptAdmitted);
        var wrongStageParent = new World();
        wrongStageParent.Store.ChangeReceipt = r => r with {
            ParentFileId128 = "00000000000000000000000000000009"
        };
        Refused(() => wrongStageParent.WriteIntent());
        Check(wrongStageParent.Reservation.Faulted &&
            wrongStageParent.Store.Creates == 1 &&
            !wrongStageParent.Reservation.Evidence()[0].ReceiptAdmitted);
        var wrongJournalParent = new World();
        wrongJournalParent.WriteIntent();
        wrongJournalParent.Store.ChangeReceipt = r => r with {
            ParentFileId128 = "00000000000000000000000000000008"
        };
        Refused(() => wrongJournalParent.WriteReservation());
        Check(wrongJournalParent.Reservation.Faulted &&
            wrongJournalParent.Store.Creates == 2 &&
            !wrongJournalParent.Reservation.Evidence()[1].ReceiptAdmitted);
        var changedDuringCreate = new World();
        changedDuringCreate.WriteIntent();
        changedDuringCreate.Store.OnCreate = () => {
            if (changedDuringCreate.Store.Creates == 2)
                changedDuringCreate.Store.Files[changedDuringCreate.Reservation.PathOf(
                    NativeHostReservationSlotV3.StandardUserIntent)][0] ^= 1;
        };
        Refused(() => changedDuringCreate.WriteReservation());
        Check(changedDuringCreate.Reservation.Faulted && changedDuringCreate.Store.Creates == 2 &&
            !changedDuringCreate.Reservation.ClosedReservationComplete);

        var late = new World(); late.Clock = Issued.AddMinutes(61);
        Refused(() => late.WriteIntent());
        Check(late.Reservation.Faulted && late.Store.Creates == 0);
        var movedBoot = new World();
        Refused(() => new NativeHostStageReservationV3(movedBoot.Bound,
            movedBoot.Seal,
            movedBoot.Context with { BootSha256 = new string('f', 64) },
            movedBoot.Store, movedBoot.Custody, () => movedBoot.Clock));
        var wrongOwner = new World();
        Refused(() => new NativeHostStageReservationV3(wrongOwner.Bound,
            wrongOwner.Seal,
            wrongOwner.Context with { OwnerSid = NativeHostProfileV2.UserSid },
            wrongOwner.Store, wrongOwner.Custody, () => wrongOwner.Clock));
        var futureOwner = new World();
        Refused(() => new NativeHostStageReservationV3(futureOwner.Bound,
            futureOwner.Seal,
            futureOwner.Context with {
                OwnerCreationFileTimeUtc = futureOwner.Clock.AddMinutes(1).UtcDateTime.ToFileTimeUtc()
            }, futureOwner.Store, futureOwner.Custody, () => futureOwner.Clock));
        var invalidFileTime = new World();
        Refused(() => new NativeHostStageReservationV3(invalidFileTime.Bound,
            invalidFileTime.Seal,
            invalidFileTime.Context with { WorkerCreationFileTimeUtc = long.MaxValue },
            invalidFileTime.Store, invalidFileTime.Custody, () => invalidFileTime.Clock));
        var mismatchedSeal = new World();
        NativeHostPrefixSealV3 foreignSeal =
            NativeHostTranscriptPrefixV3Tests.ValidFixture(new string('a', 32)).Seal;
        Refused(() => new NativeHostStageReservationV3(mismatchedSeal.Bound,
            foreignSeal, mismatchedSeal.Context, mismatchedSeal.Store,
            mismatchedSeal.Custody, () => mismatchedSeal.Clock));
        Check(mismatchedSeal.Store.Creates == 0);
        var rollback = new World();
        rollback.Clock = Issued.AddMinutes(4);
        Refused(() => rollback.WriteIntent());
        Check(rollback.Reservation.Faulted && rollback.Store.Creates == 0);
        var reentry = new World();
        reentry.Custody.OnVerify = point => {
            if (point == "BEFORE_INTENT_PARSE")
                Refused(() => reentry.Reservation.WriteOwnerIntent(
                    NativeHostRole.Owner, reentry.Intent().CanonicalBytes()));
        };
        Refused(() => reentry.WriteIntent());
        Check(reentry.Reservation.Faulted && reentry.Store.Creates == 0);
        var pending = new World();
        pending.Custody.OnVerify = point => {
            if (point == "BEFORE_INTENT_PARSE")
                Refused(() => pending.Reservation.Evidence());
        };
        Refused(() => pending.WriteIntent());
        Check(pending.Reservation.Faulted && pending.Store.Creates == 0);
        var probeReentry = new World();
        probeReentry.Store.OnProbe = _ =>
            Refused(() => probeReentry.Reservation.Evidence());
        Refused(() => probeReentry.WriteIntent());
        Check(probeReentry.Reservation.Faulted && probeReentry.Store.Creates == 0);

        return checks;
    }
}
