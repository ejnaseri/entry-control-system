using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

internal static class NativeHostProfileTests
{
    private const string Attempt = "0123456789abcdef0123456789abcdef";
    private const string Source = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    internal static int Run()
    {
        int checks = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("NATIVE_PROFILE_TEST_FAILED_" + checks);
            checks++;
        }
        void Refused(Action action) {
            try { action(); }
            catch (InvalidDataException) { checks++; return; }
            throw new InvalidDataException("NATIVE_PROFILE_REFUSAL_MISSING_" + checks);
        }

        var p = NativeHostProfileV2.Create(Attempt, Source);
        byte[] original = p.CanonicalBytes();
        Check(original.Length > 1000 && original.Length <= NativeHostProfileV2.MaximumCanonicalBytes);
        Check(p.Attempt == Attempt && p.SourceSetSha256 == Source);
        Check(p.CanonicalSha256 == Convert.ToHexStringLower(SHA256.HashData(original)));
        Check(NativeHostProfileV2.ParseCanonical(original).CanonicalSha256 == p.CanonicalSha256);
        Check(NativeHostProfileV2.ParseCanonical(original).CanonicalBytes().SequenceEqual(original));

        using (var doc = JsonDocument.Parse(original)) {
            var r = doc.RootElement;
            Check(r.GetProperty("schema").GetString() == NativeHostProfileV2.Schema);
            Check(r.GetProperty("profileId").GetString() == NativeHostProfileV2.ProfileId);
            Check(r.GetProperty("effects").GetString() == NativeHostProfileV2.Effects);
            Check(r.GetProperty("sourceSetSha256").GetString() == Source);
            var pl = r.GetProperty("placement");
            Check(pl.GetProperty("root").GetString() == NativeHostProfileV2.Root);
            Check(pl.GetProperty("bin").GetString() == NativeHostProfileV2.Bin);
            Check(pl.GetProperty("image").GetString() == NativeHostProfileV2.Image);
            Check(pl.GetProperty("assembly").GetString() == NativeHostProfileV2.Assembly);
            Check(pl.GetProperty("config").GetString() == NativeHostProfileV2.Config);
            Check(pl.GetProperty("runtime").GetString() == NativeHostProfileV2.Runtime);
            Check(pl.GetProperty("hostfxr").GetString() == NativeHostProfileV2.Hostfxr);
            Check(pl.GetProperty("frameworkDeps").GetString() == NativeHostProfileV2.FrameworkDeps);
            Check(pl.GetProperty("configUtf8Sha256").GetString() ==
                Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(NativeHostProfileV2.ConfigJson))));
            Check(pl.GetProperty("managedType").GetString() == NativeHostProfileV2.ManagedType);
            Check(pl.GetProperty("managedMethod").GetString() == NativeHostProfileV2.ManagedMethod);
            var identity = r.GetProperty("identity");
            Check(identity.GetProperty("account").GetString() == NativeHostProfileV2.AccountName);
            Check(identity.GetProperty("ownerSid").GetString() == NativeHostProfileV2.OwnerSid);
            Check(identity.GetProperty("userSid").GetString() == NativeHostProfileV2.UserSid);
            Check(identity.GetProperty("ownedSha256").GetString() == NativeHostProfileV2.AccountOwnedSha256);
            Check(identity.GetProperty("completeSha256").GetString() == NativeHostProfileV2.AccountCompleteSha256);
            Check(identity.GetProperty("setupService").GetString() == NativeHostProfileV2.SetupService);
            Check(identity.GetProperty("setupServiceSid").GetString() == NativeHostProfileV2.SetupSid);
            Check(identity.GetProperty("guardianService").GetString() == NativeHostProfileV2.GuardianService);
            Check(identity.GetProperty("guardianServiceSid").GetString() == NativeHostProfileV2.GuardianSid);
            var roles = r.GetProperty("roles").EnumerateArray().ToArray();
            Check(roles.Length == 4);
            foreach (NativeHostRole role in new[] { NativeHostRole.Owner, NativeHostRole.User, NativeHostRole.Setup, NativeHostRole.Guardian }) {
                var b = p.Role(role);
                var item = roles[(int)role - 1];
                Check(item.GetProperty("role").GetString() == b.Name);
                Check(item.GetProperty("scratch").GetString() == b.Scratch);
                Check(item.GetProperty("principalSid").GetString() == b.PrincipalSid);
                Check(item.GetProperty("service").GetString() == b.ServiceName);
                Check(item.GetProperty("serviceSid").GetString() == b.ServiceSid);
            }
            var keys = r.GetProperty("keys");
            Check(keys.GetProperty("prefix").GetString() == NativeHostProfileV2.KeyPrefix);
            Check(keys.GetProperty("restricted").GetString() == p.KeyName(false));
            Check(keys.GetProperty("userAccessible").GetString() == p.KeyName(true));
            var endpoints = r.GetProperty("endpoints");
            foreach (NativeHostStage stage in Enum.GetValues<NativeHostStage>())
                Check(endpoints.GetProperty(p.StageName(stage)).GetString() == p.Endpoint(stage));
            var records = r.GetProperty("records");
            Check(records.GetProperty("root").GetString() == p.RecordRoot);
            foreach (string kind in new[] { "input", "stage", "journal", "report" })
                Check(records.GetProperty(kind).GetString() == p.RecordNamespace(kind));
            var claims = r.GetProperty("claims");
            Check(claims.EnumerateObject().Count() == 8);
            foreach (var claim in claims.EnumerateObject()) Check(claim.Value.ValueKind == JsonValueKind.False);
        }

        Check(NativeHostProfileV2.DerivedServiceSid(NativeHostProfileV2.SetupService) == NativeHostProfileV2.SetupSid);
        Check(NativeHostProfileV2.DerivedServiceSid(NativeHostProfileV2.GuardianService) == NativeHostProfileV2.GuardianSid);
        Check(p.Role(NativeHostRole.Setup).PrincipalSid == NativeHostProfileV2.SystemSid);
        Check(p.Role(NativeHostRole.Guardian).PrincipalSid == NativeHostProfileV2.GuardianSid);
        Check(p.KeyName(false) != p.KeyName(true));
        Check(p.Endpoint(NativeHostStage.Setup) != p.Endpoint(NativeHostStage.GuardianBefore));
        Check(p.RecordNamespace("input") != p.RecordNamespace("stage"));
        Check(!Encoding.UTF8.GetString(original).Contains("StandardUserControlV1", StringComparison.Ordinal));
        Check(!Encoding.UTF8.GetString(original).Contains("EntryEvidenceV2", StringComparison.Ordinal));

        byte[] copy = p.CanonicalBytes();
        copy[0] ^= 0xff;
        Check(p.CanonicalBytes().SequenceEqual(original));
        byte[] parsedCopy = NativeHostProfileV2.ParseCanonical(original).CanonicalBytes();
        parsedCopy[^1] ^= 0xff;
        Check(p.CanonicalBytes().SequenceEqual(original));
        var changedAttempt = NativeHostProfileV2.Create(new string('1', 32), Source);
        var changedSource = NativeHostProfileV2.Create(Attempt, new string('2', 64));
        Check(p.CanonicalSha256 != changedAttempt.CanonicalSha256);
        Check(p.CanonicalSha256 != changedSource.CanonicalSha256);
        Check(changedAttempt.KeyName(false) != p.KeyName(false));
        Check(changedSource.KeyName(false) == p.KeyName(false));
        Check(changedAttempt.Endpoint(NativeHostStage.StandardUser) != p.Endpoint(NativeHostStage.StandardUser));
        Check(changedSource.RecordRoot == p.RecordRoot);

        foreach (string bad in new[] { "", Attempt.ToUpperInvariant(), Attempt[..31], Attempt + "0", "0000000000000000000000000000000g", "../" + Attempt })
            Refused(() => NativeHostProfileV2.Create(bad, Source));
        foreach (string bad in new[] { "", Source.ToUpperInvariant(), Source[..63], Source + "0", new string('g', 64), new string('0', 63) + "\n" })
            Refused(() => NativeHostProfileV2.Create(Attempt, bad));
        foreach (int bad in new[] { 0, -1, 5, 99 }) Refused(() => p.Role((NativeHostRole)bad));
        foreach (int bad in new[] { 0, -1, 5, 99 }) Refused(() => p.Endpoint((NativeHostStage)bad));
        foreach (string bad in new[] { "", "Input", "stage/", "../journal", "records", "report\0" })
            Refused(() => p.RecordNamespace(bad));
        Refused(() => NativeHostProfileV2.DerivedServiceSid("Ecs.Lic008.StandardUserControlV1.Setup"));
        Refused(() => NativeHostProfileV2.DerivedServiceSid("Ecs.Lic008.StandardNativeHostV1.SetupX"));

        string canonicalText = Encoding.UTF8.GetString(original);
        var badText = new List<string> {
            "{}", "[]", "null", canonicalText + " ", " " + canonicalText, canonicalText + "{}",
            canonicalText.Replace("\"attempt\":\"" + Attempt + "\"", "\"attempt\":\"" + Attempt + "\",\"attempt\":\"" + Attempt + "\"", StringComparison.Ordinal),
            canonicalText.Replace("\"root\":\"", "\"root\":\"x\",\"root\":\"", StringComparison.Ordinal),
            canonicalText.Replace("\"claims\":{", "\"unmapped\":0,\"claims\":{", StringComparison.Ordinal),
            canonicalText.Replace("\"nativeEntryProven\":false", "\"nativeEntryProven\":true", StringComparison.Ordinal),
            canonicalText.Replace(NativeHostProfileV2.ProfileId, "TEST_ONLY_STANDARD_USER_CONTROL_V1", StringComparison.Ordinal),
            canonicalText.Replace("StandardControlHost.exe", "dotnet.exe", StringComparison.Ordinal),
            canonicalText.Replace(NativeHostProfileV2.SetupSid, NativeHostProfileV2.UserSid, StringComparison.Ordinal),
            canonicalText.Replace("\"owner\"", "\"OWNER\"", StringComparison.Ordinal),
            canonicalText.Replace("\"sourceSetSha256\":\"" + Source + "\"", "\"sourceSetSha256\":\"" + Source.ToUpperInvariant() + "\"", StringComparison.Ordinal),
            canonicalText.Replace("\"effects\":\"", "\"effects\":\"x", StringComparison.Ordinal),
            canonicalText.Replace("\"profileId\":", "\"profileID\":", StringComparison.Ordinal),
            canonicalText.Replace("\"records\":{", "\"records\":{\"nested\":{\"a\":{\"b\":{\"c\":{\"d\":{\"e\":1}}}}},", StringComparison.Ordinal),
            canonicalText.Replace("\"profileId\":", "\"profileId\":/*comment*/", StringComparison.Ordinal),
            canonicalText.Replace("\"claims\":{", "\"claims\":{\"x\":1,", StringComparison.Ordinal),
            canonicalText.Replace("\"attempt\":\"" + Attempt + "\"", "\"attempt\":\"\\u0030" + Attempt[1..] + "\"", StringComparison.Ordinal),
            canonicalText.Replace("\"schema\":", "\"schema\" :", StringComparison.Ordinal)
        };
        for (int i = 0; i < badText.Count; i++) {
            if (badText[i] == canonicalText) throw new InvalidDataException("NATIVE_PROFILE_TEST_MUTATION_MISSING_" + i);
            string bad = badText[i];
            Refused(() => NativeHostProfileV2.ParseCanonical(Encoding.UTF8.GetBytes(bad)));
        }
        Refused(() => NativeHostProfileV2.ParseCanonical(Array.Empty<byte>()));
        Refused(() => NativeHostProfileV2.ParseCanonical(new byte[NativeHostProfileV2.MaximumCanonicalBytes + 1]));
        Refused(() => NativeHostProfileV2.ParseCanonical(new byte[] { 0xef, 0xbb, 0xbf }.Concat(original).ToArray()));
        byte[] badUtf8 = (byte[])original.Clone(); badUtf8[12] = 0xc0;
        Refused(() => NativeHostProfileV2.ParseCanonical(badUtf8));
        byte[] badNul = (byte[])original.Clone(); badNul[12] = 0;
        Refused(() => NativeHostProfileV2.ParseCanonical(badNul));
        byte[] badControl = (byte[])original.Clone(); badControl[12] = 1;
        Refused(() => NativeHostProfileV2.ParseCanonical(badControl));
        return checks;
    }
}
