using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Text;

namespace EntryControl.TestOnly.StandardUserControl;

// Open/inspect/decrypt primitives ONLY. There is deliberately no create, delete,
// overwrite, permission setter, private-export, journal or CLI implementation.
// A future controller must establish fresh creation and the complete durable
// ownership chain before supplying these expected identities and role guard.
internal sealed record StandardNativeKeyExpectation(StandardCryptoScope Scope,
    StandardCryptoArm Arm, string DescriptorSha256, string PublicSha256);
internal sealed record StandardNativeDescriptor(string Owner, string Group,
    bool Protected, IReadOnlyList<StandardCryptoAce> Aces, string Sha256);
internal sealed record StandardNativeKeyReadback(string Name, string Provider,
    string Algorithm, int Bits, bool Machine, bool Persisted, int Usage,
    int ExportPolicy, StandardNativeDescriptor Descriptor, string PublicSpkiBase64,
    string PublicSha256);
internal sealed record StandardNativeEnvelope(string Attempt, StandardCryptoArm Arm,
    string KeyName, string PublicSha256, string Cipher, string KeyWrap,
    string NonceBase64, string WrappedKeyBase64, string CiphertextBase64,
    string TagBase64, string PlaintextSha256, string Sha256);
internal sealed record StandardNativeProbeResult(StandardNativeKeyReadback? Key,
    StandardCryptoOperation Operation);

internal static class StandardNativeCryptoRules
{
    internal static bool Hex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    internal static string Hash(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    internal static void Require(StandardNativeKeyExpectation? expected, DateTimeOffset now)
    {
        StandardContract.Need(expected is not null, "STANDARD_NATIVE_EXPECTATION_MISSING");
        var s = expected.Scope;
        StandardContract.Need(s is not null && s.Schema == StandardCryptoComparison.Schema &&
            s.Root == StandardContract.Root && Hex(s.Attempt, 32) &&
            s.IssuedUtc.Offset == TimeSpan.Zero && s.ExpiresUtc.Offset == TimeSpan.Zero &&
            now.Offset == TimeSpan.Zero && s.ExpiresUtc > s.IssuedUtc &&
            s.ExpiresUtc - s.IssuedUtc <= TimeSpan.FromHours(2) && now >= s.IssuedUtc && now < s.ExpiresUtc &&
            s.AccountSid == StandardContract.UserSid && s.OwnerSid == StandardContract.OwnerSid &&
            s.AccountOwnedSha256 == StandardContract.AccountOwnedSha256 &&
            s.AccountCompleteSha256 == StandardContract.AccountCompleteSha256 &&
            new[] { s.PlanSha256, s.ApprovalSha256, s.PackageSha256, s.RuntimeSha256,
                s.ImageSha256, s.AssemblySha256, s.HostSha256, s.BootSha256,
                expected.DescriptorSha256, expected.PublicSha256 }.All(x => Hex(x, 64)),
            "STANDARD_NATIVE_SCOPE_REFUSED");
        _ = StandardCryptoComparison.KeyName(s.Attempt, expected.Arm);
    }

    internal static void Gate(StandardNativeKeyExpectation expected, Func<DateTimeOffset> utcNow,
        Action requireRoleAndCustody)
    {
        Require(expected, utcNow());
        // A guard's Crypto/Unauthorized failure is a lost admission, never a
        // key-operation observation eligible for a no-access interpretation.
        try { requireRoleAndCustody(); }
        catch { throw new InvalidDataException("STANDARD_NATIVE_ROLE_OR_CUSTODY_GUARD_REFUSED"); }
        Require(expected, utcNow());
    }

    internal static StandardNativeDescriptor Descriptor(byte[]? supplied, StandardCryptoArm arm)
    {
        _ = StandardCryptoComparison.KeyName(new string('0', 32), arm);
        StandardContract.Need(supplied is not null && supplied.Length is >= 20 and <= 65536,
            "STANDARD_NATIVE_DESCRIPTOR_SIZE_REFUSED");
        byte[] bytes = (byte[])supplied.Clone();
        var descriptor = new RawSecurityDescriptor(bytes, 0);
        const ControlFlags required = ControlFlags.DiscretionaryAclPresent | ControlFlags.DiscretionaryAclProtected;
        const ControlFlags allowed = required | ControlFlags.SelfRelative;
        StandardContract.Need(descriptor.BinaryLength == bytes.Length &&
            (descriptor.ControlFlags & required) == required && (descriptor.ControlFlags & ~allowed) == 0 &&
            descriptor.Owner?.Value == StandardCryptoComparison.SystemSid &&
            descriptor.Group?.Value == StandardCryptoComparison.SystemSid && descriptor.SystemAcl is null &&
            descriptor.DiscretionaryAcl is not null &&
            descriptor.DiscretionaryAcl.Count == (arm == StandardCryptoArm.Restricted ? 2 : 3),
            "STANDARD_NATIVE_DESCRIPTOR_REFUSED");
        var wanted = new HashSet<string>(StringComparer.Ordinal) {
            StandardCryptoComparison.SystemSid, StandardCryptoComparison.GuardianSid };
        if (arm == StandardCryptoArm.UserAccessible) wanted.Add(StandardContract.UserSid);
        var aces = new List<StandardCryptoAce>();
        foreach (GenericAce raw in descriptor.DiscretionaryAcl) {
            StandardContract.Need(raw is CommonAce, "STANDARD_NATIVE_ACE_TYPE_REFUSED");
            var ace = (CommonAce)raw;
            uint mask = unchecked((uint)ace.AccessMask);
            StandardContract.Need(!ace.IsCallback && ace.AceQualifier == AceQualifier.AccessAllowed &&
                ace.AceFlags == AceFlags.None && mask is 0x10000000u or 0xd01f01ffu &&
                wanted.Remove(ace.SecurityIdentifier.Value), "STANDARD_NATIVE_ACE_REFUSED");
            aces.Add(new(ace.SecurityIdentifier.Value, mask, 0, true, false));
        }
        StandardContract.Need(wanted.Count == 0, "STANDARD_NATIVE_PRINCIPAL_MISSING");
        return new(descriptor.Owner.Value, descriptor.Group.Value, true, aces.AsReadOnly(), Hash(bytes));
    }

    internal static void Readback(StandardNativeKeyExpectation expected, StandardNativeKeyReadback? key)
    {
        StandardContract.Need(key is not null &&
            key.Name == StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm) &&
            key.Provider == StandardCryptoComparison.Provider && key.Algorithm == "RSA" &&
            key.Bits == 3072 && key.Machine && key.Persisted && key.Usage == 1 && key.ExportPolicy == 0 &&
            key.Descriptor is not null && key.Descriptor.Owner == StandardCryptoComparison.SystemSid &&
            key.Descriptor.Group == StandardCryptoComparison.SystemSid && key.Descriptor.Protected &&
            key.Descriptor.Sha256 == expected.DescriptorSha256 && key.PublicSha256 == expected.PublicSha256,
            "STANDARD_NATIVE_KEY_PROFILE_REFUSED");
        // Inspect returns the descriptor parser's result in the native backend;
        // revalidate even injected/readback objects rather than trusting a hash.
        var wanted = new HashSet<string>(StringComparer.Ordinal) {
            StandardCryptoComparison.SystemSid, StandardCryptoComparison.GuardianSid };
        if (expected.Arm == StandardCryptoArm.UserAccessible) wanted.Add(StandardContract.UserSid);
        StandardContract.Need(key.Descriptor.Aces is not null && key.Descriptor.Aces.Count == wanted.Count,
            "STANDARD_NATIVE_KEY_ACES_REFUSED");
        foreach (var ace in key.Descriptor.Aces)
            StandardContract.Need(ace is not null && ace.Allow && !ace.Callback && ace.Flags == 0 &&
                ace.Mask is 0x10000000u or 0xd01f01ffu && wanted.Remove(ace.Sid),
                "STANDARD_NATIVE_KEY_ACES_REFUSED");
        byte[] spki = StandardSyntheticEnvelopeCodec.Base64(key.PublicSpkiBase64, 1, 1024);
        StandardContract.Need(Hash(spki) == expected.PublicSha256, "STANDARD_NATIVE_PUBLIC_IDENTITY_REFUSED");
        using var rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(spki, out int consumed);
        StandardContract.Need(consumed == spki.Length && rsa.KeySize == 3072,
            "STANDARD_NATIVE_PUBLIC_PROFILE_REFUSED");
    }
}

// Fixed public synthetic plaintext only. No caller-supplied confidential input.
// The binary digest and GCM AAD bind the attempt/arm/key/public identity exactly.
internal static class StandardSyntheticEnvelopeCodec
{
    internal const string Plaintext = "LIC008 W03 TEST ONLY PUBLIC SYNTHETIC PAYLOAD V1\n";
    internal static string PlaintextHash => StandardNativeCryptoRules.Hash(Encoding.ASCII.GetBytes(Plaintext));
    internal static byte[] Base64(string? value, int min, int max)
    {
        StandardContract.Need(value is not null && value.Length >= ((min + 2) / 3) * 4 &&
            value.Length <= ((max + 2) / 3) * 4, "STANDARD_SYNTHETIC_BASE64_SIZE_REFUSED");
        byte[] bytes = Convert.FromBase64String(value);
        StandardContract.Need(bytes.Length >= min && bytes.Length <= max && Convert.ToBase64String(bytes) == value,
            "STANDARD_SYNTHETIC_BASE64_REFUSED");
        return bytes;
    }

    private static byte[] Frame(params string[] fields)
    {
        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream, Encoding.UTF8, true);
        foreach (string field in fields) {
            byte[] bytes = Encoding.UTF8.GetBytes(field);
            StandardContract.Need(bytes.Length <= 2048, "STANDARD_SYNTHETIC_FRAME_REFUSED");
            writer.Write(bytes.Length); writer.Write(bytes);
        }
        writer.Flush(); return stream.ToArray();
    }
    internal static byte[] Aad(StandardNativeKeyExpectation expected) => Frame(
        "TEST_ONLY_STANDARD_SYNTHETIC_ENVELOPE_V1", expected.Scope.Schema, expected.Scope.Root,
        expected.Scope.Attempt, expected.Arm == StandardCryptoArm.Restricted ? "restricted" : "user-accessible",
        StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm), expected.PublicSha256,
        "AES-256-GCM", "RSA-OAEP-SHA256", PlaintextHash, expected.DescriptorSha256,
        expected.Scope.IssuedUtc.ToString("O", CultureInfo.InvariantCulture),
        expected.Scope.ExpiresUtc.ToString("O", CultureInfo.InvariantCulture),
        expected.Scope.AccountSid, expected.Scope.OwnerSid, expected.Scope.AccountOwnedSha256,
        expected.Scope.AccountCompleteSha256, expected.Scope.PlanSha256, expected.Scope.ApprovalSha256,
        expected.Scope.PackageSha256, expected.Scope.RuntimeSha256, expected.Scope.ImageSha256,
        expected.Scope.AssemblySha256, expected.Scope.HostSha256, expected.Scope.BootSha256);
    private static string Digest(StandardNativeEnvelope e) => StandardNativeCryptoRules.Hash(Frame(
        "TEST_ONLY_STANDARD_SYNTHETIC_ENVELOPE_DIGEST_V1", e.Attempt,
        e.Arm == StandardCryptoArm.Restricted ? "restricted" : "user-accessible", e.KeyName,
        e.PublicSha256, e.Cipher, e.KeyWrap, e.NonceBase64, e.WrappedKeyBase64,
        e.CiphertextBase64, e.TagBase64, e.PlaintextSha256));

    internal static StandardNativeEnvelope Assemble(StandardNativeKeyExpectation expected,
        byte[] nonce, byte[] wrapped, byte[] ciphertext, byte[] tag)
    {
        StandardContract.Need(nonce is { Length: 12 } && wrapped is { Length: 384 } &&
            ciphertext is not null && ciphertext.Length == Encoding.ASCII.GetByteCount(Plaintext) && tag is { Length: 16 },
            "STANDARD_SYNTHETIC_LENGTH_REFUSED");
        var e = new StandardNativeEnvelope(expected.Scope.Attempt, expected.Arm,
            StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm), expected.PublicSha256,
            "AES-256-GCM", "RSA-OAEP-SHA256", Convert.ToBase64String(nonce), Convert.ToBase64String(wrapped),
            Convert.ToBase64String(ciphertext), Convert.ToBase64String(tag), PlaintextHash, "");
        return e with { Sha256 = Digest(e) };
    }

    internal static (byte[] Nonce, byte[] Wrapped, byte[] Ciphertext, byte[] Tag) Decode(
        StandardNativeKeyExpectation expected, StandardNativeEnvelope? e)
    {
        StandardContract.Need(e is not null && e.Attempt == expected.Scope.Attempt && e.Arm == expected.Arm &&
            e.KeyName == StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm) &&
            e.PublicSha256 == expected.PublicSha256 && e.Cipher == "AES-256-GCM" && e.KeyWrap == "RSA-OAEP-SHA256" &&
            e.PlaintextSha256 == PlaintextHash && StandardNativeCryptoRules.Hex(e.Sha256, 64),
            "STANDARD_SYNTHETIC_CONTEXT_REFUSED");
        int plainSize = Encoding.ASCII.GetByteCount(Plaintext);
        var decoded = (Base64(e.NonceBase64, 12, 12), Base64(e.WrappedKeyBase64, 384, 384),
            Base64(e.CiphertextBase64, plainSize, plainSize), Base64(e.TagBase64, 16, 16));
        StandardContract.Need(Digest(e) == e.Sha256, "STANDARD_SYNTHETIC_DIGEST_REFUSED");
        return decoded;
    }

    internal static StandardNativeEnvelope Seal(StandardNativeKeyExpectation expected,
        StandardNativeKeyReadback key, DateTimeOffset now)
    {
        StandardNativeCryptoRules.Require(expected, now);
        StandardNativeCryptoRules.Readback(expected, key);
        byte[] dataKey = RandomNumberGenerator.GetBytes(32), plain = Encoding.ASCII.GetBytes(Plaintext);
        try {
            byte[] nonce = RandomNumberGenerator.GetBytes(12), cipher = new byte[plain.Length], tag = new byte[16];
            using var rsa = RSA.Create();
            byte[] spki = Base64(key.PublicSpkiBase64, 1, 1024);
            rsa.ImportSubjectPublicKeyInfo(spki, out int consumed);
            StandardContract.Need(consumed == spki.Length, "STANDARD_SYNTHETIC_SPKI_TRAILING_REFUSED");
            byte[] wrapped = rsa.Encrypt(dataKey, RSAEncryptionPadding.OaepSHA256);
            using var aes = new AesGcm(dataKey, 16);
            aes.Encrypt(nonce, plain, cipher, tag, Aad(expected));
            return Assemble(expected, nonce, wrapped, cipher, tag);
        } finally { CryptographicOperations.ZeroMemory(dataKey); CryptographicOperations.ZeroMemory(plain); }
    }

    internal static string OpenWithDataKey(StandardNativeKeyExpectation expected,
        StandardNativeEnvelope envelope, byte[] dataKey)
    {
        byte[] plain = Array.Empty<byte>();
        try {
            var e = Decode(expected, envelope);
            StandardContract.Need(dataKey is { Length: 32 }, "STANDARD_SYNTHETIC_DATA_KEY_REFUSED");
            plain = new byte[e.Ciphertext.Length];
            using var aes = new AesGcm(dataKey, 16);
            aes.Decrypt(e.Nonce, e.Ciphertext, e.Tag, plain, Aad(expected));
            string hash = StandardNativeCryptoRules.Hash(plain);
            StandardContract.Need(hash == PlaintextHash && plain.AsSpan().SequenceEqual(Encoding.ASCII.GetBytes(Plaintext)),
                "STANDARD_SYNTHETIC_PLAINTEXT_REFUSED");
            return hash;
        } finally {
            if (dataKey is not null) CryptographicOperations.ZeroMemory(dataKey);
            CryptographicOperations.ZeroMemory(plain);
        }
    }
}

// Only the native implementation below may open a persisted CNG key. Pure tests
// inject synthetic handles. The caller must supply an independently implemented
// role/custody guard; a successful profile check is not process authentication.
internal interface IStandardNativeOpenedKey : IDisposable
{
    StandardNativeKeyReadback Inspect();
    byte[] Unwrap(byte[] wrapped);
}

internal sealed class StandardNativeStatusException : CryptographicException
{
    internal int NativeStatus { get; }
    internal StandardNativeStatusException(int status) : base(status) { NativeStatus = status; }
}

internal static class StandardNativeCryptoProbe
{
    internal static StandardNativeProbeResult Run(StandardNativeKeyExpectation expected,
        StandardNativeEnvelope envelope, Func<DateTimeOffset> utcNow, Action requireRoleAndCustody,
        Func<IStandardNativeOpenedKey> open)
    {
        ArgumentNullException.ThrowIfNull(utcNow);
        ArgumentNullException.ThrowIfNull(requireRoleAndCustody);
        ArgumentNullException.ThrowIfNull(open);
        void Gate() => StandardNativeCryptoRules.Gate(expected, utcNow, requireRoleAndCustody);
        Gate();
        var decoded = StandardSyntheticEnvelopeCodec.Decode(expected, envelope);
        Gate(); // Decode and role admission may take time; recheck before Open.
        string name = StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm);
        StandardNativeProbeResult Failure(string stage, bool opened, StandardNativeKeyReadback? key, Exception error)
        {
            DateTimeOffset observed = utcNow();
            StandardNativeCryptoRules.Require(expected, observed);
            return new(key, new(expected.Arm, name, expected.PublicSha256, envelope.Sha256, observed,
                "FAILED", stage, opened, error is UnauthorizedAccessException ? "UNAUTHORIZED_ACCESS" : "CRYPTOGRAPHIC",
                error.HResult, error is StandardNativeStatusException native ? native.NativeStatus : null, null));
        }
        IStandardNativeOpenedKey handle;
        try { handle = open() ?? throw new InvalidDataException("STANDARD_NATIVE_NULL_HANDLE_REFUSED"); }
        catch (CryptographicException error) { return Failure("OPEN", false, null, error); }
        catch (UnauthorizedAccessException error) { return Failure("OPEN", false, null, error); }
        using (handle) {
            Gate();
            StandardNativeKeyReadback key;
            try { key = handle.Inspect(); }
            catch (CryptographicException error) { return Failure("INSPECT", true, null, error); }
            catch (UnauthorizedAccessException error) { return Failure("INSPECT", true, null, error); }
            StandardNativeCryptoRules.Readback(expected, key);
            Gate();
            byte[]? dataKey = null;
            try {
                try { dataKey = handle.Unwrap(decoded.Wrapped); }
                catch (CryptographicException error) { return Failure("DECRYPT", true, key, error); }
                catch (UnauthorizedAccessException error) { return Failure("DECRYPT", true, key, error); }
                Gate();
                string hash;
                try { hash = StandardSyntheticEnvelopeCodec.OpenWithDataKey(expected, envelope, dataKey); }
                catch (CryptographicException error) { return Failure("DECRYPT", true, key, error); }
                Gate();
                DateTimeOffset observed = utcNow();
                StandardNativeCryptoRules.Require(expected, observed);
                return new(key, new(expected.Arm, name, expected.PublicSha256, envelope.Sha256, observed,
                    "DECRYPTED", "DECRYPT", true, null, null, null, hash));
            } finally { if (dataKey is not null) CryptographicOperations.ZeroMemory(dataKey); }
        }
    }
}

#if COMPILE_ONLY_STANDARD_CRYPTO_NATIVE_V1
// Compiles for review, never invoked by the closed builder or a CLI. There is
// no creation surface: existing keys must originate from a future separately
// reviewed create/intent/owned/completion protocol. Nothing here adopts a name.
internal static class StandardNativeCrypto
{
    internal static StandardNativeProbeResult Probe(StandardNativeKeyExpectation expected,
        StandardNativeEnvelope envelope, Func<DateTimeOffset> utcNow, Action requireRoleAndCustody)
    {
        void Gate() => StandardNativeCryptoRules.Gate(expected, utcNow, requireRoleAndCustody);
        return StandardNativeCryptoProbe.Run(expected, envelope, utcNow, requireRoleAndCustody, () => {
            StandardContract.Need(OperatingSystem.IsWindows() &&
                RuntimeInformation.OSArchitecture == Architecture.X64 &&
                RuntimeInformation.ProcessArchitecture == Architecture.X64 && Environment.Is64BitProcess &&
                Environment.Version == new Version(10, 0, 11), "STANDARD_NATIVE_RUNTIME_REFUSED");
            Gate();
            CngKey key = CngKey.Open(StandardCryptoComparison.KeyName(expected.Scope.Attempt, expected.Arm),
                new CngProvider(StandardCryptoComparison.Provider), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
            try { return new Opened(key, expected.Arm, Gate); } catch { key.Dispose(); throw; }
        });
    }

    private sealed class Opened : IStandardNativeOpenedKey
    {
        private readonly CngKey key;
        private readonly StandardCryptoArm arm;
        private readonly Action gate;
        private bool disposed;
        internal Opened(CngKey key, StandardCryptoArm arm, Action gate) { this.key = key; this.arm = arm; this.gate = gate; }
        public StandardNativeKeyReadback Inspect()
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            gate();
            var descriptor = StandardNativeCryptoRules.Descriptor(
                key.GetProperty("Security Descr", (CngPropertyOptions)7).GetValue(), arm);
            gate(); string name = key.KeyName!;
            gate(); string provider = key.Provider?.Provider!;
            gate(); string algorithm = key.Algorithm.Algorithm;
            gate(); int bits = key.KeySize;
            gate(); bool machine = key.IsMachineKey;
            gate(); bool persisted = !key.IsEphemeral;
            gate(); int usage = (int)key.KeyUsage;
            gate(); int policy = (int)key.ExportPolicy;
            gate();
            using var rsa = new RSACng(key);
            gate();
            byte[] spki = rsa.ExportSubjectPublicKeyInfo(); // Public material only.
            gate();
            return new(name, provider, algorithm, bits, machine, persisted, usage, policy,
                descriptor, Convert.ToBase64String(spki), StandardNativeCryptoRules.Hash(spki));
        }
        public byte[] Unwrap(byte[] wrapped)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            StandardContract.Need(wrapped is { Length: 384 }, "STANDARD_NATIVE_WRAPPED_KEY_REFUSED");
            var padding = new Padding { Algorithm = "SHA256", Label = IntPtr.Zero, Length = 0 };
            // One bounded output call, no resize/retry. Exact raw status remains
            // separate from managed HResult. Provider partial output is zeroed.
            byte[] output = new byte[384];
            try {
                gate();
                // CngKey.Handle returns a separately owned duplicate. It must
                // be released even when the guard or native decrypt fails.
                using var nativeKey = key.Handle;
                gate();
                int status = NCryptDecrypt(nativeKey, wrapped, wrapped.Length, ref padding,
                    output, output.Length, out int written, 0x44); // OAEP | SILENT.
                if (status != 0) throw new StandardNativeStatusException(status);
                StandardContract.Need(written == 32, "STANDARD_NATIVE_UNWRAPPED_SIZE_REFUSED");
                return output.AsSpan(0, 32).ToArray();
            } finally { CryptographicOperations.ZeroMemory(output); }
        }
        public void Dispose() { if (disposed) return; disposed = true; key.Dispose(); }
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Padding
    {
        [MarshalAs(UnmanagedType.LPWStr)] internal string Algorithm;
        internal IntPtr Label;
        internal int Length;
    }
    [DllImport("ncrypt.dll")]
    private static extern int NCryptDecrypt(Microsoft.Win32.SafeHandles.SafeNCryptKeyHandle key,
        byte[] input, int length, ref Padding padding, [Out] byte[] output,
        int outputSize, out int written, int flags);
}
#endif
