using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostUserIntentV3Tests
{
    private static string FreshHex(int length, params string[] excluded)
    {
        foreach (char digit in "0123456789abcdef") {
            string candidate = new(digit, length);
            if (!excluded.Contains(candidate, StringComparer.Ordinal)) return candidate;
        }
        throw new InvalidDataException("NATIVE_USER_INTENT_V3_TEST_NO_FRESH_VALUE");
    }

    private static byte[] Replace(byte[] original, string oldValue, string newValue)
    {
        string text = Encoding.UTF8.GetString(original);
        if (!text.Contains(oldValue, StringComparison.Ordinal))
            throw new InvalidDataException("NATIVE_USER_INTENT_V3_TEST_REPLACEMENT_MISSING");
        return Encoding.UTF8.GetBytes(text.Replace(oldValue, newValue,
            StringComparison.Ordinal));
    }

    internal static int Run()
    {
        int checks = 0;
        void Check(bool okay) {
            if (!okay) throw new InvalidDataException(
                "NATIVE_USER_INTENT_V3_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException(
                "NATIVE_USER_INTENT_V3_REFUSAL_MISSING_" + checks);
        }

        (NativeHostBoundInputV2 bound, NativeHostPrefixSealV3 seal) =
            NativeHostTranscriptPrefixV3Tests.ValidFixture();
        string run = FreshHex(32, seal.SetupRunId, seal.GuardianBeforeRunId);
        string nonce = FreshHex(64, seal.SetupNonce64,
            seal.GuardianBeforeNonce64);
        NativeHostUserIntentV3 intent = NativeHostUserIntentV3.CreateOwner(
            bound, seal, NativeHostRole.Owner, run, nonce);
        byte[] original = intent.CanonicalBytes();
        string originalText = Encoding.UTF8.GetString(original);

        using (var document = JsonDocument.Parse(original)) {
            JsonElement root = document.RootElement;
            string[] expectedNames = {
                "schema", "profileId", "effects", "attempt", "profileSha256",
                "sourceSetSha256", "planSha256", "approvalSha256",
                "previousSha256", "hostSha256", "bootSha256", "imageSha256",
                "userSid", "stage", "runId", "nonce"
            };
            Check(root.EnumerateObject().Select(x => x.Name).SequenceEqual(expectedNames));
            Check(root.GetProperty("schema").GetString() == NativeHostUserIntentV3.Schema);
            Check(root.GetProperty("profileId").GetString() == NativeHostProfileV2.ProfileId);
            Check(root.GetProperty("effects").GetString() == NativeHostProfileV2.Effects);
            Check(root.GetProperty("attempt").GetString() == bound.Profile.Attempt);
            Check(root.GetProperty("profileSha256").GetString() == bound.Profile.CanonicalSha256);
            Check(root.GetProperty("sourceSetSha256").GetString() == bound.Profile.SourceSetSha256);
            Check(root.GetProperty("planSha256").GetString() == bound.Plan.CanonicalSha256);
            Check(root.GetProperty("approvalSha256").GetString() == bound.Approval.CanonicalSha256);
            Check(root.GetProperty("previousSha256").GetString() == seal.CanonicalSha256);
            Check(root.GetProperty("hostSha256").GetString() == bound.Plan.HostSha256);
            Check(root.GetProperty("bootSha256").GetString() == bound.Plan.BootSha256);
            Check(root.GetProperty("imageSha256").GetString() == bound.Plan.Image.Sha256);
            Check(root.GetProperty("userSid").GetString() == NativeHostProfileV2.UserSid);
            Check(root.GetProperty("stage").GetInt32() == 3);
            Check(root.GetProperty("runId").GetString() == run);
            Check(root.GetProperty("nonce").GetString() == nonce);
        }
        Check(intent.Attempt == bound.Profile.Attempt &&
            intent.PreviousSha256 == seal.CanonicalSha256 &&
            intent.CanonicalSha256 == NativeHostInputCodecV2.Hash(original));
        Check(original.Length is > 0 and <= NativeHostUserIntentV3.MaximumBytes);
        Check(NativeHostUserIntentV3.StoreSlot == NativeHostStoreFileV3.StandardUserIntent &&
            (int)NativeHostUserIntentV3.StoreSlot == 41 &&
            intent.StorePath == bound.Profile.RecordRoot + @"\stage\standard-user-intent-v3.json" &&
            intent.StorePath != bound.Profile.RecordRoot + @"\stage\standard-user-intent.json");
        Check(intent.Stage == NativeHostStage.StandardUser &&
            intent.RunId == run && intent.Nonce64 == nonce);
        Check(!intent.NativeEvidenceEstablished && !intent.PhysicalDurabilityProven &&
            !intent.AccountActivationAuthorized && !intent.UserCreationAuthorized &&
            !intent.GrantAuthorized && !intent.Lic008Closed);
        NativeHostUserIntentV3 parsed = NativeHostUserIntentV3.ParseOwnerOriginal(
            original, bound, seal, NativeHostRole.Owner);
        Check(parsed.CanonicalSha256 == intent.CanonicalSha256 &&
            parsed.CanonicalBytes().AsSpan().SequenceEqual(original));
        byte[] mutable = intent.CanonicalBytes(); mutable[0] ^= 1;
        Check(intent.CanonicalBytes().AsSpan().SequenceEqual(original));
        Check(seal.CanonicalSha256 == NativeHostInputCodecV2.Hash(seal.CanonicalBytes()) &&
            seal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete);

        // Both V2 original and generic V2 event marker are unsuitable V3 inputs.
        NativeHostUserIntentV2 v2 = NativeHostUserIntentV2.CreateOwner(
            bound, NativeHostRole.Owner, run, nonce);
        Check(v2.CanonicalBytes().Length <= NativeHostUserIntentV2.MaximumBytes &&
            NativeHostUserIntentV2.StoreSlot == NativeHostStoreFileV2.StandardUserIntent &&
            NativeHostStageStoreV2.Relative(NativeHostUserIntentV2.StoreSlot) ==
                @"stage\standard-user-intent.json" &&
            v2.CanonicalSha256 != intent.CanonicalSha256);
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            v2.CanonicalBytes(), bound, seal, NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV2.ParseOwnerOriginal(
            original, bound, NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            Encoding.UTF8.GetBytes("{\"schema\":\"TEST_ONLY_STANDARD_NATIVE_HOST_STAGE_RECORD_V2\"}"),
            bound, seal, NativeHostRole.Owner));

        Refused(() => NativeHostUserIntentV3.CreateOwner(
            null, seal, NativeHostRole.Owner, run, nonce));
        Refused(() => NativeHostUserIntentV3.CreateOwner(
            bound, null, NativeHostRole.Owner, run, nonce));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            original, bound, null, NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            original, null, seal, NativeHostRole.Owner));
        foreach (NativeHostRole role in new[] { NativeHostRole.User,
            NativeHostRole.Setup, NativeHostRole.Guardian, (NativeHostRole)99 }) {
            Refused(() => NativeHostUserIntentV3.CreateOwner(bound, seal, role,
                run, nonce));
            Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(original,
                bound, seal, role));
        }
        foreach (string bad in new[] { "", new string('a', 31),
            new string('a', 33), new string('A', 32), new string('g', 32),
            seal.SetupRunId, seal.GuardianBeforeRunId })
            Refused(() => NativeHostUserIntentV3.CreateOwner(bound, seal,
                NativeHostRole.Owner, bad, nonce));
        foreach (string bad in new[] { "", new string('b', 63),
            new string('b', 65), new string('B', 64), new string('g', 64),
            seal.SetupNonce64, seal.GuardianBeforeNonce64 })
            Refused(() => NativeHostUserIntentV3.CreateOwner(bound, seal,
                NativeHostRole.Owner, run, bad));

        string wrongSha = (seal.CanonicalSha256[0] == 'a' ? "b" : "a") +
            seal.CanonicalSha256[1..];
        var mutations = new List<byte[]> {
            Replace(original, "\"schema\":\"" + NativeHostUserIntentV3.Schema + "\"",
                "\"schema\":\"" + NativeHostUserIntentV2.Schema + "\""),
            Replace(original, "\"previousSha256\":\"" + seal.CanonicalSha256 + "\"",
                "\"previousSha256\":\"" + wrongSha + "\""),
            Replace(original, "\"stage\":3", "\"stage\":4"),
            Replace(original, "\"userSid\":\"" + NativeHostProfileV2.UserSid + "\"",
                "\"userSid\":\"" + NativeHostProfileV2.OwnerSid + "\""),
            Replace(original, "\"runId\":\"" + run + "\"",
                "\"runId\":\"" + seal.SetupRunId + "\""),
            Replace(original, "\"nonce\":\"" + nonce + "\"",
                "\"nonce\":\"" + seal.SetupNonce64 + "\""),
            Replace(original, "\"nonce\":\"" + nonce + "\"}",
                "\"nonce\":\"" + nonce + "\",\"extra\":true}"),
            Replace(original, "\"runId\":\"" + run + "\"",
                "\"runId\":\"" + run + "\",\"runId\":\"" + run + "\""),
            Replace(original, "\"stage\":3", "\"stage\":3 "),
            Encoding.UTF8.GetBytes(originalText + " "),
            Encoding.UTF8.GetBytes(originalText[..^1] + ",}"),
            Encoding.UTF8.GetBytes("\uFEFF" + originalText),
            Encoding.UTF8.GetBytes("null"),
            Encoding.UTF8.GetBytes("{")
        };
        string firstFields = "\"schema\":\"" + NativeHostUserIntentV3.Schema +
            "\",\"profileId\":\"" + NativeHostProfileV2.ProfileId + "\"";
        string swappedFields = "\"profileId\":\"" + NativeHostProfileV2.ProfileId +
            "\",\"schema\":\"" + NativeHostUserIntentV3.Schema + "\"";
        mutations.Add(Replace(original, firstFields, swappedFields));
        for (int mutation = 0; mutation < mutations.Count; mutation++) {
            byte[] changed = mutations[mutation];
            try {
                _ = NativeHostUserIntentV3.ParseOwnerOriginal(changed,
                    bound, seal, NativeHostRole.Owner);
            } catch (InvalidDataException) { checks++; continue; }
            throw new InvalidDataException(
                "NATIVE_USER_INTENT_V3_MUTATION_ACCEPTED_" + mutation);
        }
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            null, bound, seal, NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(
            new byte[NativeHostUserIntentV3.MaximumBytes + 1], bound, seal,
            NativeHostRole.Owner));

        (NativeHostBoundInputV2 otherBound, NativeHostPrefixSealV3 otherSeal) =
            NativeHostTranscriptPrefixV3Tests.ValidFixture(new string('f', 32));
        Check(otherBound.Profile.Attempt != bound.Profile.Attempt &&
            otherSeal.CanonicalSha256 != seal.CanonicalSha256);
        Refused(() => NativeHostUserIntentV3.CreateOwner(bound, otherSeal,
            NativeHostRole.Owner, run, nonce));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(original,
            bound, otherSeal, NativeHostRole.Owner));
        Refused(() => NativeHostUserIntentV3.ParseOwnerOriginal(original,
            otherBound, seal, NativeHostRole.Owner));
        return checks;
    }
}
