using System;
using System.Collections.Generic;
using System.Formats.Asn1;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Text;

namespace EntryControl.TestOnly.StandardUserControl;

// Public synthetic envelopes, managed descriptor parsing and fake handles only.
// No persisted CNG provider/key, account, logon, SCM or process launch is used.
internal static class StandardNativeCryptoTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static string H(int number) => number.ToString("x").PadLeft(64, '0');
    private static byte[] DataKey() => Enumerable.Range(1, 32).Select(i => (byte)i).ToArray();
    private static StandardCryptoScope Scope() => new(StandardCryptoComparison.Schema,
        StandardContract.Root, "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2),
        StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
        StandardContract.OwnerSid, H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8));
    private static byte[] Descriptor(string sddl)
    {
        var descriptor = new RawSecurityDescriptor(sddl);
        var bytes = new byte[descriptor.BinaryLength]; descriptor.GetBinaryForm(bytes, 0); return bytes;
    }
    private static string Dacl(StandardCryptoArm arm) => "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" +
        StandardCryptoComparison.GuardianSid + ")" + (arm == StandardCryptoArm.UserAccessible
            ? "(A;;GA;;;" + StandardContract.UserSid + ")" : "");
    private static byte[] PublicFixture()
    {
        // Public arithmetic fixture only: no private key is constructed or
        // supplied by this suite. An odd 3072-bit modulus permits public sealing.
        var rsa = new AsnWriter(AsnEncodingRules.DER);
        rsa.PushSequence(); rsa.WriteIntegerUnsigned(Enumerable.Repeat((byte)0xbb, 384).ToArray());
        rsa.WriteInteger(65537); rsa.PopSequence();
        var spki = new AsnWriter(AsnEncodingRules.DER);
        spki.PushSequence(); spki.PushSequence(); spki.WriteObjectIdentifier("1.2.840.113549.1.1.1");
        spki.WriteNull(); spki.PopSequence(); spki.WriteBitString(rsa.Encode()); spki.PopSequence(); return spki.Encode();
    }
    private static (StandardNativeKeyExpectation Expected, StandardNativeKeyReadback Key) Fixture(StandardCryptoArm arm)
    {
        var descriptor = StandardNativeCryptoRules.Descriptor(Descriptor(Dacl(arm)), arm);
        byte[] publicFixture = PublicFixture(); string publicHash = StandardNativeCryptoRules.Hash(publicFixture);
        var expected = new StandardNativeKeyExpectation(Scope(), arm, descriptor.Sha256, publicHash);
        var key = new StandardNativeKeyReadback(StandardCryptoComparison.KeyName(Scope().Attempt, arm),
            StandardCryptoComparison.Provider, "RSA", 3072, true, true, 1, 0, descriptor,
            Convert.ToBase64String(publicFixture), publicHash);
        return (expected, key);
    }
    private static StandardNativeEnvelope Envelope(StandardNativeKeyExpectation expected)
    {
        byte[] dataKey = DataKey(), nonce = Enumerable.Repeat((byte)0x5a, 12).ToArray();
        byte[] plain = Encoding.ASCII.GetBytes(StandardSyntheticEnvelopeCodec.Plaintext);
        try {
            byte[] ciphertext = new byte[plain.Length], tag = new byte[16];
            using var aes = new AesGcm(dataKey, 16);
            aes.Encrypt(nonce, plain, ciphertext, tag, StandardSyntheticEnvelopeCodec.Aad(expected));
            return StandardSyntheticEnvelopeCodec.Assemble(expected, nonce, new byte[384], ciphertext, tag);
        } finally { CryptographicOperations.ZeroMemory(dataKey); CryptographicOperations.ZeroMemory(plain); }
    }

    private sealed class FakeKey : IStandardNativeOpenedKey
    {
        internal StandardNativeKeyReadback Key;
        internal readonly List<string> Trace;
        internal Exception? InspectFailure;
        internal Exception? UnwrapFailure;
        internal byte[]? ReturnedDataKey;
        internal bool Disposed;
        internal FakeKey(StandardNativeKeyReadback key, List<string> trace) { Key = key; Trace = trace; }
        public StandardNativeKeyReadback Inspect() {
            Trace.Add("inspect"); if (InspectFailure is not null) throw InspectFailure; return Key;
        }
        public byte[] Unwrap(byte[] wrapped) {
            Trace.Add("unwrap"); StandardContract.Need(wrapped.Length == 384, "FAKE_WRAPPED_LENGTH");
            if (UnwrapFailure is not null) throw UnwrapFailure;
            return ReturnedDataKey = DataKey();
        }
        public void Dispose() { Trace.Add("dispose"); Disposed = true; }
    }

    internal static int Run()
    {
        int count = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_NATIVE_CRYPTO_TEST_FAILED_" + count); count++; }
        void Refused(Action action) {
            bool refused = false;
            try { action(); }
            catch (InvalidDataException) { refused = true; }
            catch (ArgumentException) { refused = true; }
            catch (FormatException) { refused = true; }
            catch (CryptographicException) { refused = true; }
            Check(refused);
        }
        foreach (var arm in new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }) {
            var (expected, key) = Fixture(arm);
            StandardNativeCryptoRules.Require(expected, Start); Check(true);
            StandardNativeCryptoRules.Require(expected, Start.AddHours(2).AddTicks(-1)); Check(true);
            StandardNativeCryptoRules.Readback(expected, key); Check(true);
            // Encryption uses only this public arithmetic fixture, public test
            // plaintext and ephemeral RNG/AES buffers. No stored key is opened.
            var sealedEnvelope = StandardSyntheticEnvelopeCodec.Seal(expected, key, Start);
            Check(sealedEnvelope.PlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash &&
                StandardSyntheticEnvelopeCodec.Decode(expected, sealedEnvelope).Wrapped.Length == 384);
            Refused(() => StandardNativeCryptoRules.Require(null, Start));
            foreach (var now in new[] { Start.AddTicks(-1), Start.AddHours(2), Start.ToOffset(TimeSpan.FromHours(1)) })
                Refused(() => StandardNativeCryptoRules.Require(expected, now));
            var changes = new Func<StandardCryptoScope, StandardCryptoScope>[] {
                s => s with { Schema = "TEST_ONLY_EXPORT_POLICY_CONTROL_V5" },
                s => s with { Root = s.Root + "Old" }, s => s with { Attempt = new('A', 32) },
                s => s with { Attempt = new('a', 31) }, s => s with { Attempt = s.Attempt + "\n" },
                s => s with { IssuedUtc = Start.ToOffset(TimeSpan.FromHours(1)) },
                s => s with { ExpiresUtc = s.IssuedUtc }, s => s with { ExpiresUtc = s.ExpiresUtc.AddTicks(1) },
                s => s with { AccountSid = StandardContract.OwnerSid }, s => s with { OwnerSid = StandardContract.UserSid },
                s => s with { AccountOwnedSha256 = s.AccountCompleteSha256 },
                s => s with { AccountCompleteSha256 = s.AccountOwnedSha256 },
                s => s with { PlanSha256 = "bad" }, s => s with { ApprovalSha256 = "bad" },
                s => s with { PackageSha256 = "bad" }, s => s with { RuntimeSha256 = "bad" },
                s => s with { ImageSha256 = "bad" }, s => s with { AssemblySha256 = "bad" },
                s => s with { HostSha256 = "bad" }, s => s with { BootSha256 = "bad" }
            };
            foreach (var change in changes) Refused(() => StandardNativeCryptoRules.Require(expected with { Scope = change(expected.Scope) }, Start));
            foreach (string? hash in new string?[] { null, "", new('A', 64), new('0', 63), new('0', 65), new string('0', 63) + "\n" }) {
                Refused(() => StandardNativeCryptoRules.Require(expected with { DescriptorSha256 = hash! }, Start));
                Refused(() => StandardNativeCryptoRules.Require(expected with { PublicSha256 = hash! }, Start));
            }
            Refused(() => StandardNativeCryptoRules.Require(expected with { Arm = (StandardCryptoArm)9 }, Start));
            var keyChanges = new Func<StandardNativeKeyReadback, StandardNativeKeyReadback>[] {
                k => k with { Name = k.Name + "old" }, k => k with { Provider = "Microsoft Platform Crypto Provider" },
                k => k with { Algorithm = "ECDSA" }, k => k with { Bits = 2048 }, k => k with { Machine = false },
                k => k with { Persisted = false }, k => k with { Usage = 0 }, k => k with { Usage = 3 },
                k => k with { ExportPolicy = 1 }, k => k with { ExportPolicy = 2 }, k => k with { ExportPolicy = 3 },
                k => k with { PublicSha256 = H(99) }, k => k with { PublicSpkiBase64 = k.PublicSpkiBase64 + "\n" },
                k => k with { PublicSpkiBase64 = Convert.ToBase64String(new byte[512]) },
                k => k with { Descriptor = k.Descriptor with { Owner = StandardContract.OwnerSid } },
                k => k with { Descriptor = k.Descriptor with { Group = StandardContract.UserSid } },
                k => k with { Descriptor = k.Descriptor with { Protected = false } },
                k => k with { Descriptor = k.Descriptor with { Sha256 = H(100) } },
                k => k with { Descriptor = k.Descriptor with { Aces = Array.Empty<StandardCryptoAce>() } },
                k => k with { Descriptor = k.Descriptor with { Aces = k.Descriptor.Aces.Select((a,i) => i == 0 ? a with { Allow = false } : a).ToArray() } },
                k => k with { Descriptor = k.Descriptor with { Aces = k.Descriptor.Aces.Select((a,i) => i == 0 ? a with { Callback = true } : a).ToArray() } },
                k => k with { Descriptor = k.Descriptor with { Aces = k.Descriptor.Aces.Select((a,i) => i == 0 ? a with { Flags = 16 } : a).ToArray() } },
                k => k with { Descriptor = k.Descriptor with { Aces = k.Descriptor.Aces.Select((a,i) => i == 0 ? a with { Mask = 1 } : a).ToArray() } },
                k => k with { Descriptor = k.Descriptor with { Aces = k.Descriptor.Aces.Select((a,i) => i == 0 ? a with { Sid = StandardContract.UserSid } : a).ToArray() } }
            };
            Refused(() => StandardNativeCryptoRules.Readback(expected, null));
            foreach (var change in keyChanges) Refused(() => StandardNativeCryptoRules.Readback(expected, change(key)));

            var envelope = Envelope(expected);
            var decoded = StandardSyntheticEnvelopeCodec.Decode(expected, envelope);
            Check(decoded.Nonce.Length == 12 && decoded.Wrapped.Length == 384 && decoded.Tag.Length == 16 &&
                decoded.Ciphertext.Length == Encoding.ASCII.GetByteCount(StandardSyntheticEnvelopeCodec.Plaintext));
            byte[] dataKey = DataKey();
            Check(StandardSyntheticEnvelopeCodec.OpenWithDataKey(expected, envelope, dataKey) == StandardSyntheticEnvelopeCodec.PlaintextHash);
            Check(dataKey.All(b => b == 0));
            var envelopeChanges = new Func<StandardNativeEnvelope, StandardNativeEnvelope>[] {
                e => e with { Attempt = new('a', 32) }, e => e with { Arm = (StandardCryptoArm)9 },
                e => e with { KeyName = e.KeyName + ".old" }, e => e with { PublicSha256 = H(999) },
                e => e with { Cipher = "AES-128-GCM" }, e => e with { KeyWrap = "RSA-PKCS1" },
                e => e with { PlaintextSha256 = H(1000) }, e => e with { Sha256 = H(1001) },
                e => e with { NonceBase64 = e.NonceBase64 + "\n" }, e => e with { WrappedKeyBase64 = "AA==" },
                e => e with { CiphertextBase64 = e.CiphertextBase64[..^4] }, e => e with { TagBase64 = new('A', 10000) },
                e => e with { NonceBase64 = new('!', 16) }
            };
            foreach (var change in envelopeChanges) Refused(() => StandardSyntheticEnvelopeCodec.Decode(expected, change(envelope)));
            Refused(() => StandardSyntheticEnvelopeCodec.Decode(expected, null));
            foreach (int length in new[] { 0, 1, 31, 33, 384 }) {
                byte[] wrongKey = Enumerable.Repeat((byte)7, length).ToArray();
                Refused(() => StandardSyntheticEnvelopeCodec.OpenWithDataKey(expected, envelope, wrongKey));
                Check(wrongKey.All(b => b == 0));
            }
            byte[] nonzeroWrong = Enumerable.Repeat((byte)7, 32).ToArray();
            Refused(() => StandardSyntheticEnvelopeCodec.OpenWithDataKey(expected, envelope, nonzeroWrong));
            Check(nonzeroWrong.All(b => b == 0));
            // Header context is deliberately unchanged here: only the bound
            // plan/runtime/account/etc AAD expectation changes. GCM must refuse
            // it and erase even a nonzero caller-owned key buffer on every path.
            var aadChanges = new Func<StandardNativeKeyExpectation, StandardNativeKeyExpectation>[] {
                x => x with { DescriptorSha256 = H(2000) },
                x => x with { Scope = x.Scope with { IssuedUtc = x.Scope.IssuedUtc.AddTicks(1) } },
                x => x with { Scope = x.Scope with { ExpiresUtc = x.Scope.ExpiresUtc.AddTicks(-1) } },
                x => x with { Scope = x.Scope with { AccountSid = StandardContract.OwnerSid } },
                x => x with { Scope = x.Scope with { OwnerSid = StandardContract.UserSid } },
                x => x with { Scope = x.Scope with { AccountOwnedSha256 = H(2001) } },
                x => x with { Scope = x.Scope with { AccountCompleteSha256 = H(2002) } },
                x => x with { Scope = x.Scope with { PlanSha256 = H(2003) } },
                x => x with { Scope = x.Scope with { ApprovalSha256 = H(2004) } },
                x => x with { Scope = x.Scope with { PackageSha256 = H(2005) } },
                x => x with { Scope = x.Scope with { RuntimeSha256 = H(2006) } },
                x => x with { Scope = x.Scope with { ImageSha256 = H(2007) } },
                x => x with { Scope = x.Scope with { AssemblySha256 = H(2008) } },
                x => x with { Scope = x.Scope with { HostSha256 = H(2009) } },
                x => x with { Scope = x.Scope with { BootSha256 = H(2010) } }
            };
            foreach (var change in aadChanges) {
                byte[] changedContextKey = DataKey();
                Refused(() => StandardSyntheticEnvelopeCodec.OpenWithDataKey(change(expected), envelope, changedContextKey));
                Check(changedContextKey.All(b => b == 0));
            }
            foreach (int field in new[] { 0, 1, 2, 3 }) {
                byte[] nonce = (byte[])decoded.Nonce.Clone(), wrapped = (byte[])decoded.Wrapped.Clone();
                byte[] ciphertext = (byte[])decoded.Ciphertext.Clone(), tag = (byte[])decoded.Tag.Clone();
                (field switch { 0 => nonce, 1 => wrapped, 2 => ciphertext, _ => tag })[0] ^= 1;
                var changed = StandardSyntheticEnvelopeCodec.Assemble(expected, nonce, wrapped, ciphertext, tag);
                Check(changed.Sha256 != envelope.Sha256);
                if (field != 1) Refused(() => StandardSyntheticEnvelopeCodec.OpenWithDataKey(expected, changed, DataKey()));
                // Wrapped bytes are integrity-bound in the envelope digest; a
                // replacement wrapper is authenticated by native OAEP unwrap.
            }
            foreach (int nonceSize in new[] { 0, 11, 13 })
                Refused(() => StandardSyntheticEnvelopeCodec.Assemble(expected, new byte[nonceSize], new byte[384], decoded.Ciphertext, new byte[16]));
            foreach (int wrapSize in new[] { 0, 383, 385 })
                Refused(() => StandardSyntheticEnvelopeCodec.Assemble(expected, new byte[12], new byte[wrapSize], decoded.Ciphertext, new byte[16]));
            foreach (int tagSize in new[] { 0, 15, 17 })
                Refused(() => StandardSyntheticEnvelopeCodec.Assemble(expected, new byte[12], new byte[384], decoded.Ciphertext, new byte[tagSize]));

            var trace = new List<string>(); var fake = new FakeKey(key, trace);
            var success = StandardNativeCryptoProbe.Run(expected, envelope, () => Start.AddMinutes(1),
                () => trace.Add("guard"), () => { trace.Add("open"); return fake; });
            Check(success.Operation.Status == "DECRYPTED" && success.Operation.OperationStage == "DECRYPT" && success.Operation.KeyOpened &&
                success.Operation.ManagedHResult is null && success.Operation.NativeStatus is null &&
                success.Operation.ObservedPlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash && success.Key == key);
            Check(trace.SequenceEqual(new[] { "guard", "guard", "open", "guard", "inspect", "guard", "unwrap", "guard", "guard", "dispose" }));
            Check(fake.Disposed && fake.ReturnedDataKey!.All(b => b == 0));
            foreach (int code in new[] { StandardCryptoComparison.BadKeyset, StandardCryptoComparison.NtePermission, unchecked((int)0x80090029), 5 }) {
                foreach (bool native in new[] { false, true }) {
                    Exception error = native ? new StandardNativeStatusException(code) : new CryptographicException(code);
                    foreach (string stage in new[] { "OPEN", "INSPECT", "DECRYPT" }) {
                        trace = new List<string>(); fake = new FakeKey(key, trace);
                        if (stage == "INSPECT") fake.InspectFailure = error;
                        if (stage == "DECRYPT") fake.UnwrapFailure = error;
                        var result = StandardNativeCryptoProbe.Run(expected, envelope, () => Start.AddMinutes(1), () => { },
                            () => stage == "OPEN" ? throw error : fake);
                        Check(result.Operation.Status == "FAILED" && result.Operation.OperationStage == stage &&
                            result.Operation.ManagedHResult == code && result.Operation.NativeStatus == (native ? code : null) &&
                            result.Operation.FailureCategory == "CRYPTOGRAPHIC" && result.Operation.ObservedPlaintextSha256 is null &&
                            result.Operation.KeyOpened == (stage != "OPEN"));
                        Check(fake.Disposed == (stage != "OPEN"));
                    }
                }
            }
            foreach (string stage in new[] { "OPEN", "INSPECT", "DECRYPT" }) {
                fake = new FakeKey(key, new()); var error = new UnauthorizedAccessException();
                if (stage == "INSPECT") fake.InspectFailure = error;
                if (stage == "DECRYPT") fake.UnwrapFailure = error;
                var result = StandardNativeCryptoProbe.Run(expected, envelope, () => Start.AddMinutes(1), () => { },
                    () => stage == "OPEN" ? throw error : fake);
                Check(result.Operation.FailureCategory == "UNAUTHORIZED_ACCESS" && result.Operation.ManagedHResult == error.HResult &&
                    result.Operation.NativeStatus is null && result.Operation.OperationStage == stage);
            }
            bool openCalled = false;
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start.AddHours(2), () => { }, () => {
                openCalled = true; return new FakeKey(key, new()); })); Check(!openCalled);
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start,
                () => throw new InvalidDataException("ROLE_REFUSED"), () => { openCalled = true; return new FakeKey(key, new()); })); Check(!openCalled);
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start,
                () => throw new CryptographicException(StandardCryptoComparison.BadKeyset),
                () => { openCalled = true; return new FakeKey(key, new()); })); Check(!openCalled);
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope with { Sha256 = H(9999) }, () => Start,
                () => { }, () => { openCalled = true; return new FakeKey(key, new()); })); Check(!openCalled);
            int guardCalls = 0; fake = new FakeKey(key, new());
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start, () => {
                if (++guardCalls == 4) throw new InvalidDataException("ROLE_LOST_BEFORE_UNWRAP"); }, () => fake));
            Check(fake.Disposed && !fake.Trace.Contains("unwrap"));
            guardCalls = 0; fake = new FakeKey(key, new());
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start, () => {
                if (++guardCalls == 5) throw new InvalidDataException("ROLE_LOST_AFTER_UNWRAP"); }, () => fake));
            Check(fake.Disposed && fake.Trace.Contains("unwrap") && fake.ReturnedDataKey is { Length: 32 } &&
                fake.ReturnedDataKey.All(b => b == 0));
            byte[] brokenTag = (byte[])decoded.Tag.Clone(); brokenTag[0] ^= 1;
            var badTagEnvelope = StandardSyntheticEnvelopeCodec.Assemble(expected,
                decoded.Nonce, decoded.Wrapped, decoded.Ciphertext, brokenTag);
            fake = new FakeKey(key, new());
            var tagFailure = StandardNativeCryptoProbe.Run(expected, badTagEnvelope, () => Start, () => { }, () => fake);
            Check(tagFailure.Operation.Status == "FAILED" && tagFailure.Operation.OperationStage == "DECRYPT" &&
                tagFailure.Operation.KeyOpened && tagFailure.Operation.FailureCategory == "CRYPTOGRAPHIC" &&
                tagFailure.Operation.ManagedHResult == new AuthenticationTagMismatchException().HResult &&
                tagFailure.Operation.NativeStatus is null && tagFailure.Operation.ObservedPlaintextSha256 is null && tagFailure.Key == key);
            Check(fake.Disposed && fake.ReturnedDataKey is { Length: 32 } && fake.ReturnedDataKey.All(b => b == 0));
            fake = new FakeKey(key with { ExportPolicy = 3 }, new());
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope, () => Start, () => { }, () => fake));
            Check(fake.Disposed && !fake.Trace.Contains("unwrap"));
            fake = new FakeKey(key, new()); int clockCalls = 0;
            Refused(() => StandardNativeCryptoProbe.Run(expected, envelope,
                () => ++clockCalls >= 8 ? Start.AddHours(2) : Start, () => { }, () => fake));
            Check(fake.Disposed && !fake.Trace.Contains("unwrap"));
        }

        string sy = StandardCryptoComparison.SystemSid, guardian = StandardCryptoComparison.GuardianSid;
        var sdChanges = new[] {
            "O:BAG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:BAD:P(A;;GA;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:SYD:(A;;GA;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:SYD:P(A;;GA;;;SY)",
            "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + guardian + ")(A;;GA;;;BA)",
            "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;SY)",
            "O:SYG:SYD:P(D;;GA;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:SYD:P(A;CI;GA;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:SYD:P(A;;GR;;;SY)(A;;GA;;;" + guardian + ")",
            "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + StandardContract.UserSid + ")",
            "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + guardian + ")S:(AU;SA;GA;;;WD)"
        };
        foreach (string sddl in sdChanges)
            Refused(() => StandardNativeCryptoRules.Descriptor(Descriptor(sddl), StandardCryptoArm.Restricted));
        Refused(() => StandardNativeCryptoRules.Descriptor(null, StandardCryptoArm.Restricted));
        foreach (int size in new[] { 0, 19, 20, 65537 })
            Refused(() => StandardNativeCryptoRules.Descriptor(new byte[size], StandardCryptoArm.Restricted));
        byte[] goodSd = Descriptor(Dacl(StandardCryptoArm.Restricted));
        Refused(() => StandardNativeCryptoRules.Descriptor(goodSd.Concat(new byte[] { 0 }).ToArray(), StandardCryptoArm.Restricted));
        Refused(() => StandardNativeCryptoRules.Descriptor(Descriptor(Dacl(StandardCryptoArm.UserAccessible)), StandardCryptoArm.Restricted));
        Refused(() => StandardNativeCryptoRules.Descriptor(goodSd, StandardCryptoArm.UserAccessible));
        Refused(() => StandardNativeCryptoRules.Descriptor(goodSd, (StandardCryptoArm)(-1)));
        var mapped = StandardNativeCryptoRules.Descriptor(Descriptor("O:SYG:SYD:P(A;;0xd01f01ff;;;" + sy + ")(A;;0xd01f01ff;;;" + guardian + ")"), StandardCryptoArm.Restricted);
        Check(mapped.Aces.Count == 2 && mapped.Aces.All(a => a.Mask == 0xd01f01ffu));
        return count;
    }
}
