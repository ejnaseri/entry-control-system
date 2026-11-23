using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostUserIntentV2Tests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private const string Run = "11111111111111111111111111111111";
    private const string Nonce = "2222222222222222222222222222222222222222222222222222222222222222";
    private static readonly DateTimeOffset Issued = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Source = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_SOURCE_SET\"}");
    private static readonly byte[] Package = Encoding.UTF8.GetBytes("{\"schema\":\"TEST_PACKAGE_MANIFEST\"}");
    private static readonly NativeHostUserInvocationV2 CreationInvocation =
        Invocation(new Fixture().Intent());

    private sealed class Fixture
    {
        internal readonly NativeHostProfileV2 Profile;
        internal readonly NativeHostPlanV2 Plan;
        internal readonly NativeHostApprovalV2 Approval;
        internal readonly NativeHostBoundInputV2 Bound;
        internal DateTimeOffset Clock = Issued.AddMinutes(5);
        internal int Reads;
        internal Func<int, NativeHostUserHeldFactsV2?> OnRead = _ => GoodFacts();
        internal Fixture()
        {
            Profile = NativeHostProfileV2.Create(Attempt, NativeHostInputCodecV2.Hash(Source));
            NativeHostFilePinV2[] files = Enumerable.Range(0, NativeHostInputCodecV2.FrameworkFileCount)
                .Select(NativeHostInputCodecV2.ExpectedRuntimeLeaf)
                .Select((name, index) => new NativeHostFilePinV2(name, index + 1,
                    NativeHostInputCodecV2.Hash(Encoding.UTF8.GetBytes(name)))).ToArray();
            byte[] inventory = NativeHostInputCodecV2.EncodeRuntimeInventory(Profile, files);
            byte[] config = Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson);
            Plan = new NativeHostPlanV2(Profile, Attempt, Issued, Issued.AddMinutes(90),
                new string('a', 64), new string('b', 64),
                NativeHostInputCodecV2.Hash(Package), NativeHostInputCodecV2.Hash(inventory),
                new NativeHostAssetPinV2(252928, new string('c', 64)),
                new NativeHostAssetPinV2(150000, new string('d', 64)),
                new NativeHostAssetPinV2(config.Length, NativeHostInputCodecV2.Hash(config)),
                new NativeHostAssetPinV2(400000, new string('e', 64)), files);
            Approval = new NativeHostApprovalV2(Plan, Issued.AddMinutes(1), Issued.AddMinutes(30));
            Bound = NativeHostInputCodecV2.Bind(Plan.CanonicalBytes(), Approval.CanonicalBytes(),
                Profile.CanonicalBytes(), Source, Package, inventory, Clock);
        }
        internal NativeHostUserIntentV2 Intent(string run = Run, string nonce = Nonce) =>
            NativeHostUserIntentV2.CreateOwner(Bound, NativeHostRole.Owner, run, nonce);
        internal NativeHostUserLaunchV2 Launch(NativeHostUserIntentV2 intent) =>
            new(Bound, intent, new Reader(this), () => Clock);
        private sealed class Reader(Fixture owner) : INativeHostUserLaunchFactsV2
        {
            public NativeHostUserHeldFactsV2? Capture() => owner.OnRead(++owner.Reads);
        }
    }

    private static NativeHostUserHeldFactsV2 GoodFacts() => new(
        101, 1203, Issued.AddMinutes(2).UtcDateTime.ToFileTimeUtc(),
        NativeHostProfileV2.Image, new string('c', 64), CreationInvocation, true, true,
        202, "000000001234abcd", "000000005678abcd", true, true,
        NativeHostProfileV2.UserSid, NativeHostProfileV2.UserSid, 1, 0, 1, 8192,
        true, true, true, true, true, true, true);

    private static NativeHostUserInvocationV2 Invocation(NativeHostUserIntentV2 i) => new(
        NativeHostRole.User, NativeHostStage.StandardUser, i.Attempt,
        i.PlanSha256, i.ApprovalSha256, i.SourceSetSha256, i.RunId, i.Nonce64);

    internal static int RunTests()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException("NATIVE_USER_INTENT_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_USER_INTENT_REFUSAL_MISSING_" + checks);
        }

        var fixture = new Fixture();
        NativeHostUserIntentV2 intent = fixture.Intent();
        byte[] original = intent.CanonicalBytes();
        using (var document = JsonDocument.Parse(original)) {
            JsonElement root = document.RootElement;
            Check(root.GetProperty("schema").GetString() == NativeHostUserIntentV2.Schema);
            Check(root.GetProperty("profileId").GetString() == NativeHostProfileV2.ProfileId);
            Check(root.GetProperty("effects").GetString() == NativeHostProfileV2.Effects);
            Check(root.GetProperty("attempt").GetString() == Attempt);
            Check(root.GetProperty("profileSha256").GetString() == fixture.Profile.CanonicalSha256);
            Check(root.GetProperty("planSha256").GetString() == fixture.Plan.CanonicalSha256);
            Check(root.GetProperty("approvalSha256").GetString() == fixture.Approval.CanonicalSha256);
            Check(root.GetProperty("sourceSetSha256").GetString() == fixture.Profile.SourceSetSha256);
            Check(root.GetProperty("hostSha256").GetString() == fixture.Plan.HostSha256);
            Check(root.GetProperty("bootSha256").GetString() == fixture.Plan.BootSha256);
            Check(root.GetProperty("imageSha256").GetString() == fixture.Plan.Image.Sha256);
            Check(root.GetProperty("userSid").GetString() == NativeHostProfileV2.UserSid);
            Check(root.GetProperty("stage").GetInt32() == 3);
            Check(root.GetProperty("runId").GetString() == Run);
            Check(root.GetProperty("nonce").GetString() == Nonce);
        }
        Check(original.Length <= NativeHostUserIntentV2.MaximumBytes &&
            intent.CanonicalSha256 == NativeHostInputCodecV2.Hash(original));
        Check(NativeHostUserIntentV2.StoreSlot == NativeHostStoreFileV2.StandardUserIntent &&
            (int)NativeHostUserIntentV2.StoreSlot == 41 &&
            NativeHostStageStoreV2.Relative(NativeHostUserIntentV2.StoreSlot) ==
                @"stage\standard-user-intent.json");
        Check(!intent.PhysicalAdmission);
        Check(NativeHostUserIntentV2.ParseOwnerOriginal(original, fixture.Bound,
            NativeHostRole.Owner).CanonicalSha256 == intent.CanonicalSha256);
        var marker = intent.ProposedStoreReference();
        Check(marker.Slot == NativeHostStoreFileV2.StandardUserIntent &&
            marker.EvidenceSha256 == intent.CanonicalSha256);
        byte[] mutatedCopy = intent.CanonicalBytes(); mutatedCopy[0] ^= 1;
        Check(intent.CanonicalBytes().AsSpan().SequenceEqual(original));

        foreach (NativeHostRole role in new[] { NativeHostRole.User, NativeHostRole.Setup,
            NativeHostRole.Guardian, (NativeHostRole)99 })
            Refused(() => NativeHostUserIntentV2.CreateOwner(fixture.Bound, role, Run, Nonce));
        foreach (string bad in new[] { "", new string('1', 31), new string('1', 33),
            new string('A', 32), new string('g', 32) })
            Refused(() => fixture.Intent(bad));
        foreach (string bad in new[] { "", new string('2', 32), new string('2', 63),
            new string('2', 65), new string('A', 64) })
            Refused(() => fixture.Intent(Run, bad));

        byte[] WithExtra = Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original).Replace(
            "\"nonce\":\"" + Nonce + "\"}",
            "\"nonce\":\"" + Nonce + "\",\"unknown\":true}"));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(WithExtra, fixture.Bound,
            NativeHostRole.Owner));
        byte[] WithDuplicate = Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original).Replace(
            "\"runId\":\"" + Run + "\"",
            "\"runId\":\"" + Run + "\",\"runId\":\"" + Run + "\""));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(WithDuplicate, fixture.Bound,
            NativeHostRole.Owner));
        byte[] WithSpace = Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original) + " ");
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(WithSpace, fixture.Bound,
            NativeHostRole.Owner));
        byte[] WrongStage = Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original).Replace(
            "\"stage\":3", "\"stage\":4"));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(WrongStage, fixture.Bound,
            NativeHostRole.Owner));
        byte[] WrongImage = Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original).Replace(
            "\"imageSha256\":\"" + new string('c', 64) + "\"",
            "\"imageSha256\":\"" + new string('a', 64) + "\""));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(WrongImage, fixture.Bound,
            NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(null, fixture.Bound,
            NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(original, fixture.Bound,
            NativeHostRole.User));

        NativeHostProfileV2 otherProfile = NativeHostProfileV2.Create(
            "ffffffffffffffffffffffffffffffff", fixture.Profile.SourceSetSha256);
        Refused(() => NativeHostUserIntentV2.CreateOwner(
            new NativeHostBoundInputV2(otherProfile, fixture.Plan, fixture.Approval),
            NativeHostRole.Owner, Run, Nonce));
        var otherPlan = new NativeHostPlanV2(fixture.Profile, Attempt, Issued,
            Issued.AddMinutes(90), new string('f', 64), fixture.Plan.BootSha256,
            fixture.Plan.PackageManifestSha256, fixture.Plan.RuntimeInventorySha256,
            fixture.Plan.Image, fixture.Plan.Assembly, fixture.Plan.Config,
            fixture.Plan.Hostfxr, fixture.Plan.FrameworkInventory);
        var otherApproval = new NativeHostApprovalV2(otherPlan,
            Issued.AddMinutes(1), Issued.AddMinutes(30));
        Refused(() => NativeHostUserIntentV2.CreateOwner(
            new NativeHostBoundInputV2(fixture.Profile, fixture.Plan, otherApproval),
            NativeHostRole.Owner, Run, Nonce));
        Refused(() => NativeHostUserIntentV2.CreateOwner(
            new NativeHostBoundInputV2(fixture.Profile, otherPlan, fixture.Approval),
            NativeHostRole.Owner, Run, Nonce));

        {
            var f = new Fixture(); var i = f.Intent(); var launch = f.Launch(i);
            NativeHostUserLaunchMatchV2 match = launch.Consume(Invocation(i), i.ProposedStoreReference());
            Check(f.Reads == 2 && launch.Consumed && match.ClosedCorrelationMatched);
            Check(match.IntentSha256 == i.CanonicalSha256 && match.ProcessId == GoodFacts().ProcessId &&
                match.CreationFileTimeUtc == GoodFacts().CreationFileTimeUtc &&
                match.HeldProcessObjectId == GoodFacts().HeldProcessObjectId &&
                match.PrimaryTokenObjectId == GoodFacts().PrimaryTokenObjectId);
            Check(!match.NativeEvidenceEstablished && !match.PhysicalAdmission &&
                !match.BootstrapAuthorized && !match.GrantAuthorized && !match.Lic008Closed &&
                !launch.PhysicalAdmission);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(f.Reads == 2);
            // A fresh process-local model can match the same injected claims:
            // no durable cross-process replay authority has been implemented.
            NativeHostUserLaunchV2 secondInstance = f.Launch(i);
            NativeHostUserLaunchMatchV2 secondMatch = secondInstance.Consume(
                Invocation(i), i.ProposedStoreReference());
            Check(secondInstance.Consumed && f.Reads == 4 &&
                secondMatch.ClosedCorrelationMatched && !secondMatch.PhysicalAdmission &&
                !secondMatch.BootstrapAuthorized && !secondMatch.GrantAuthorized);
        }
        var invocationMutations = new Func<NativeHostUserInvocationV2, NativeHostUserInvocationV2>[] {
            x => x with { Role = NativeHostRole.Owner },
            x => x with { Role = (NativeHostRole)99 },
            x => x with { Stage = NativeHostStage.GuardianBefore },
            x => x with { Stage = (NativeHostStage)99 },
            x => x with { Attempt = new string('a', 32) },
            x => x with { PlanSha256 = new string('a', 64) },
            x => x with { ApprovalSha256 = new string('a', 64) },
            x => x with { SourceSetSha256 = new string('a', 64) },
            x => x with { RunId = new string('b', 32) },
            x => x with { RunId = new string('A', 32) },
            x => x with { Nonce64 = new string('b', 64) },
            x => x with { Nonce64 = new string('2', 32) }
        };
        foreach (var change in invocationMutations) {
            var f = new Fixture(); var i = f.Intent(); var launch = f.Launch(i);
            Refused(() => launch.Consume(change(Invocation(i)), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 0);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
        }
        var markerMutations = new Func<NativeHostUserIntentStoreReferenceV2,
            NativeHostUserIntentStoreReferenceV2>[] {
            x => x with { Slot = NativeHostStoreFileV2.AccountActivationIntent },
            x => x with { Attempt = new string('a', 32) },
            x => x with { ProfileSha256 = new string('a', 64) },
            x => x with { SourceSetSha256 = new string('a', 64) },
            x => x with { PlanSha256 = new string('a', 64) },
            x => x with { ApprovalSha256 = new string('a', 64) },
            x => x with { EvidenceSha256 = new string('a', 64) }
        };
        foreach (var change in markerMutations) {
            var f = new Fixture(); var i = f.Intent(); var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), change(i.ProposedStoreReference())));
            Check(launch.Consumed && f.Reads == 0);
        }
        {
            var f = new Fixture(); var i = f.Intent(); var launch = f.Launch(i);
            Refused(() => launch.Consume(null, i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 0);
        }
        {
            var f = new Fixture(); var i = f.Intent(); var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), null));
            Check(launch.Consumed && f.Reads == 0);
        }
        var factMutations = new Func<NativeHostUserHeldFactsV2, NativeHostUserHeldFactsV2>[] {
            x => x with { HeldProcessObjectId = 0 },
            x => x with { ProcessId = 0 },
            x => x with { CreationFileTimeUtc = 0 },
            x => x with { CreationFileTimeUtc = Issued.UtcDateTime.ToFileTimeUtc() },
            x => x with { CreationFileTimeUtc = Issued.AddMinutes(10).UtcDateTime.ToFileTimeUtc() },
            x => x with { ImagePath = NativeHostProfileV2.Config },
            x => x with { ImageSha256 = new string('a', 64) },
            x => x with { OriginalCreationInvocation = null },
            x => x with { OriginalCreationInvocation = x.OriginalCreationInvocation! with {
                RunId = new string('f', 32) } },
            x => x with { OriginalCreationInvocation = x.OriginalCreationInvocation! with {
                Attempt = new string('f', 32) } },
            x => x with { OriginalProcessHeld = null },
            x => x with { Live = false },
            x => x with { PrimaryTokenObjectId = 0 },
            x => x with { PrimaryTokenObjectId = x.HeldProcessObjectId },
            x => x with { PrimaryTokenId = "" },
            x => x with { PrimaryModifiedId = "FFFFFFFFFFFFFFFF" },
            x => x with { PrimaryTokenAssociated = null },
            x => x with { QueryComplete = false },
            x => x with { UserSid = NativeHostProfileV2.OwnerSid },
            x => x with { TokenOwnerSid = NativeHostProfileV2.OwnerSid },
            x => x with { TokenType = null },
            x => x with { Elevation = 1 },
            x => x with { ElevationType = 2 },
            x => x with { IntegrityRid = 12288 },
            x => x with { InteractiveEnabled = false },
            x => x with { UsersEnabled = false },
            x => x with { AdministratorsAbsent = null },
            x => x with { GroupsComplete = false },
            x => x with { NotRestricted = null },
            x => x with { AppContainerAbsent = null },
            x => x with { NoThreadImpersonation = false }
        };
        foreach (var change in factMutations) {
            var f = new Fixture(); var i = f.Intent();
            f.OnRead = _ => change(GoodFacts());
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 1);
        }
        {
            var f = new Fixture(); var i = f.Intent(); f.OnRead = _ => null;
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 1);
        }
        {
            var f = new Fixture(); var i = f.Intent();
            f.OnRead = read => read == 1 ? GoodFacts() : GoodFacts() with { ProcessId = 1204 };
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 2);
        }
        {
            var f = new Fixture(); var i = f.Intent();
            f.OnRead = _ => throw new InvalidDataException("FAKE_UNKNOWN_AFTER_CAPTURE");
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 1);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
        }
        foreach (DateTimeOffset bad in new[] { Issued,
            Issued.AddMinutes(30), Issued.AddMinutes(90),
            Issued.AddMinutes(5).ToOffset(TimeSpan.FromHours(1)) }) {
            var f = new Fixture(); var i = f.Intent(); f.Clock = bad;
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 0);
        }
        {
            var f = new Fixture(); var i = f.Intent();
            f.OnRead = read => {
                if (read == 1) f.Clock = Issued.AddMinutes(4);
                return GoodFacts();
            };
            var launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 1);
        }
        {
            var f = new Fixture(); var i = f.Intent();
            NativeHostUserLaunchV2? launch = null;
            f.OnRead = _ => {
                Refused(() => launch!.Consume(Invocation(i), i.ProposedStoreReference()));
                return GoodFacts();
            };
            launch = f.Launch(i);
            Refused(() => launch.Consume(Invocation(i), i.ProposedStoreReference()));
            Check(launch.Consumed && f.Reads == 1);
        }
        return checks;
    }

}
