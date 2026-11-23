using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostReservationOriginalV3Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private const string RunId = "33333333333333333333333333333333";
    private const string Nonce = "4444444444444444444444444444444444444444444444444444444444444444";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);

    private sealed class Sink : INativeHostReservationSinkV3
    {
        internal readonly Dictionary<string, byte[]> Files = new(StringComparer.OrdinalIgnoreCase);
        internal Func<DateTimeOffset> Clock = null!;
        private int nextId = 100;
        public bool? Exists(string exactPath) => Files.ContainsKey(exactPath);
        public NativeHostReservationReceiptV3 CreateNew(NativeHostReservationSlotV3 slot,
            string exactPath, byte[] original)
        {
            if (!Files.TryAdd(exactPath, (byte[])original.Clone()))
                throw new InvalidDataException("FAKE_RESERVATION_ORIGINAL_COLLISION");
            DateTimeOffset now = Clock();
            int slash = exactPath.LastIndexOf('\\');
            return new NativeHostReservationReceiptV3(slot, exactPath,
                NativeHostInputCodecV2.Hash(original), original.Length,
                now, now.UtcDateTime.ToFileTimeUtc(),
                "0000000000000011", nextId++.ToString("x32"),
                exactPath[..slash], "0000000000000011",
                slot == NativeHostReservationSlotV3.StandardUserIntent ?
                    "00000000000000000000000000000008" :
                    "00000000000000000000000000000007",
                exactPath[(slash + 1)..],
                true, true, true, true, true, true, true);
        }
        public byte[] ReadOriginal(string exactPath)
        {
            if (!Files.TryGetValue(exactPath, out byte[]? original))
                throw new InvalidDataException("FAKE_RESERVATION_ORIGINAL_MISSING");
            return (byte[])original.Clone();
        }
    }

    private sealed class Guard : INativeHostReservationGuardV3
    {
        internal NativeHostReservationContextV3 Context = null!;
        public void Verify(NativeHostReservationContextV3 context, string point)
        {
            if (context != Context || string.IsNullOrEmpty(point))
                throw new InvalidDataException("FAKE_RESERVATION_ORIGINAL_GUARD");
        }
    }

    private sealed class World
    {
        internal readonly NativeHostBoundInputV2 Bound;
        internal readonly NativeHostPrefixSealV3 Seal;
        internal readonly NativeHostReservationContextV3 Context;
        internal readonly NativeHostUserIntentV3 Intent;
        internal readonly Sink Files = new();
        internal readonly Guard Custody = new();
        internal readonly NativeHostStageReservationV3 Stage;
        internal DateTimeOffset Now = Issued.AddMinutes(5);
        internal byte[] Reservation = Array.Empty<byte>();

        internal World(string attempt = Attempt)
        {
            (Bound, Seal) = NativeHostTranscriptPrefixV3Tests.ValidFixture(attempt);
            NativeHostPlanV2 plan = Bound.Plan;
            Context = new(plan.HostSha256, plan.BootSha256, NativeHostProfileV2.OwnerSid,
                101, Issued.AddMinutes(2).UtcDateTime.ToFileTimeUtc(), "000000001234abcd",
                NativeHostProfileV2.OwnerSid, 202,
                Issued.AddMinutes(3).UtcDateTime.ToFileTimeUtc(), "000000005678abcd");
            Files.Clock = () => Now;
            Custody.Context = Context;
            Stage = new(Bound, Seal, Context, Files, Custody, () => Now);
            Intent = NativeHostUserIntentV3.CreateOwner(Bound, Seal,
                NativeHostRole.Owner, RunId, Nonce);
        }

        internal void Generate()
        {
            string intentSha = Stage.WriteOwnerIntent(NativeHostRole.Owner,
                Intent.CanonicalBytes());
            _ = Stage.WriteLaunchReservation(NativeHostRole.Owner, intentSha,
                NativeHostStageReservationV3.UserCommand(Intent));
            Reservation = Stage.ReadOwnerOriginal(NativeHostRole.Owner,
                NativeHostReservationSlotV3.StandardUserLaunchReserved);
        }

        internal NativeHostReservationOriginalV3 Parse(byte[]? reservation = null,
            byte[]? intent = null, NativeHostReservationContextV3? context = null,
            DateTimeOffset? now = null, NativeHostRole author = NativeHostRole.Owner,
            NativeHostPrefixSealV3? seal = null) =>
            NativeHostReservationOriginalV3.ParseCanonical(
                reservation ?? Reservation, intent ?? Intent.CanonicalBytes(),
                Bound, seal ?? Seal, context ?? Context, author, now ?? Now);
    }

    private static byte[] ReplaceOne(byte[] source, string before, string after)
    {
        string text = Encoding.UTF8.GetString(source);
        int index = text.IndexOf(before, StringComparison.Ordinal);
        if (index < 0 || text.IndexOf(before, index + before.Length, StringComparison.Ordinal) >= 0)
            throw new InvalidOperationException("TEST_REPLACE_NOT_UNIQUE");
        return Encoding.UTF8.GetBytes(text[..index] + after + text[(index + before.Length)..]);
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("NATIVE_RESERVATION_ORIGINAL_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_RESERVATION_ORIGINAL_REFUSAL_MISSING_" + checks);
        }

        var world = new World();
        world.Generate();
        NativeHostReservationOriginalV3 parsed = world.Parse();
        Check(parsed.Attempt == Attempt && parsed.IntentSha256 == world.Intent.CanonicalSha256 &&
            parsed.CanonicalSha256 == NativeHostInputCodecV2.Hash(world.Reservation) &&
            parsed.ExactCommand == NativeHostStageReservationV3.UserCommand(world.Intent) &&
            parsed.WrittenUtc == world.Now);
        Check(parsed.CanonicalBytes().AsSpan().SequenceEqual(world.Reservation) &&
            !parsed.NativeEvidenceEstablished && !parsed.AccountActivationAuthorized &&
            !parsed.UserCreationAuthorized && !parsed.GrantAuthorized && !parsed.Lic008Closed);
        byte[] copy = parsed.CanonicalBytes(); copy[0] ^= 1;
        Check(parsed.CanonicalBytes()[0] != copy[0]);
        byte[] callerOwned = (byte[])world.Reservation.Clone();
        NativeHostReservationOriginalV3 isolated = world.Parse(reservation: callerOwned);
        callerOwned[0] ^= 1;
        Check(isolated.CanonicalBytes().AsSpan().SequenceEqual(world.Reservation));

        using JsonDocument doc = JsonDocument.Parse(world.Reservation);
        JsonElement json = doc.RootElement;
        Check(json.EnumerateObject().Count() == 32 &&
            json.GetProperty("intentSha256").GetString() == parsed.IntentSha256 &&
            json.GetProperty("previousSha256").GetString() == parsed.IntentSha256);

        string jsonText = Encoding.UTF8.GetString(world.Reservation);
        string schemaPart = "\"schema\":\"" + NativeHostStageReservationV3.ReservationSchema + "\"";
        string profilePart = "\"profileId\":\"" + NativeHostProfileV2.ProfileId + "\"";
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            schemaPart + "," + profilePart, profilePart + "," + schemaPart)));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes("{ " + jsonText[1..])));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes(jsonText[..^1] + ",\"extra\":1}")));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes(jsonText[..^1] + "," + schemaPart + "}")));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes(jsonText + "\n")));
        Refused(() => world.Parse(new byte[] { 0xef, 0xbb, 0xbf }.Concat(world.Reservation).ToArray()));
        Refused(() => world.Parse(new byte[] { 0xc3, 0x28 }));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes("[]")));
        Refused(() => world.Parse(Encoding.UTF8.GetBytes("{}")));
        Refused(() => world.Parse(new byte[NativeHostStageReservationV3.MaximumReservationBytes + 1]));
        Refused(() => NativeHostReservationOriginalV3.ParseCanonical(null,
            world.Intent.CanonicalBytes(), world.Bound, world.Seal, world.Context,
            NativeHostRole.Owner, world.Now));
        Refused(() => NativeHostReservationOriginalV3.ParseCanonical(world.Reservation,
            null, world.Bound, world.Seal, world.Context,
            NativeHostRole.Owner, world.Now));
        Refused(() => NativeHostReservationOriginalV3.ParseCanonical(world.Reservation,
            world.Intent.CanonicalBytes(), world.Bound, null, world.Context,
            NativeHostRole.Owner, world.Now));

        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"intentSha256\":\"" + world.Intent.CanonicalSha256 + "\"",
            "\"intentSha256\":\"" + new string('f', 64) + "\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"previousSha256\":\"" + world.Intent.CanonicalSha256 + "\"",
            "\"previousSha256\":\"" + new string('f', 64) + "\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"accountActivationAuthorized\":false", "\"accountActivationAuthorized\":true")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"nativeEvidenceEstablished\":false", "\"nativeEvidenceEstablished\":true")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"userCreationAuthorized\":false", "\"userCreationAuthorized\":true")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"grantAuthorized\":false", "\"grantAuthorized\":true")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"exactCommand\":" + json.GetProperty("exactCommand").GetRawText(),
            "\"exactCommand\":\"--user\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"runId\":\"" + RunId + "\"",
            "\"runId\":\"" + new string('f', 32) + "\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"nonce\":\"" + Nonce + "\"",
            "\"nonce\":\"" + new string('f', 64) + "\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"hostSha256\":\"" + world.Context.HostSha256 + "\"",
            "\"hostSha256\":\"" + new string('f', 64) + "\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"ownerProcessId\":101", "\"ownerProcessId\":102")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"workerPrimaryTokenId\":\"" + world.Context.WorkerPrimaryTokenId + "\"",
            "\"workerPrimaryTokenId\":\"00000000ffffffff\"")));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            "\"userSid\":\"" + world.Intent.UserSid + "\"",
            "\"userSid\":\"S-1-5-32-545\"")));

        var otherIntent = NativeHostUserIntentV3.CreateOwner(world.Bound,
            world.Seal, NativeHostRole.Owner, new string('a', 32), Nonce);
        Refused(() => world.Parse(intent: otherIntent.CanonicalBytes()));
        var oldIntent = NativeHostUserIntentV2.CreateOwner(world.Bound,
            NativeHostRole.Owner, RunId, Nonce);
        Refused(() => world.Parse(intent: oldIntent.CanonicalBytes()));
        var otherWorld = new World(new string('e', 32));
        Refused(() => NativeHostReservationOriginalV3.ParseCanonical(world.Reservation,
            world.Intent.CanonicalBytes(), otherWorld.Bound, otherWorld.Seal,
            otherWorld.Context,
            NativeHostRole.Owner, world.Now));
        Refused(() => world.Parse(seal: otherWorld.Seal));
        Refused(() => world.Parse(author: NativeHostRole.User));
        Refused(() => world.Parse(context: world.Context with { BootSha256 = new string('f', 64) }));
        Refused(() => world.Parse(context: world.Context with { OwnerSid = NativeHostProfileV2.UserSid }));
        Refused(() => world.Parse(context: world.Context with { WorkerProcessId = 101 }));
        Refused(() => world.Parse(context: world.Context with { WorkerCreationFileTimeUtc = long.MaxValue }));
        Refused(() => world.Parse(now: world.Now.AddSeconds(-1)));
        Refused(() => world.Parse(now: Issued.AddMinutes(61)));
        Refused(() => world.Parse(now: world.Now.ToOffset(TimeSpan.FromHours(1))));
        Refused(() => world.Parse(ReplaceOne(world.Reservation,
            json.GetProperty("writtenUtc").GetString()!, Issued.AddMinutes(61).ToString("O"))));

        return checks;
    }
}
