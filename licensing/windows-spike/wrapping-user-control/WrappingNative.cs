using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;

namespace Ecs.Lic008;

internal static class WrappingNative
{
    const int MachineKey = 0x20;
    const int NCRYPT_SILENT_FLAG = 0x40;
    const int NCRYPT_PAD_OAEP_FLAG = 0x4;

    static void Check(int status)
    {
        if (status != 0) throw new CryptographicException(status);
    }

    internal static CngKey Create(string name, string label, string experimentId,
        string guardianSid, string appSid, bool appReadable)
    {
        if (!Program.ValidKeyName(name, label, experimentId) ||
            !guardianSid.StartsWith("S-1-5-80-", StringComparison.Ordinal) ||
            !appSid.StartsWith("S-1-5-80-", StringComparison.Ordinal) || guardianSid == appSid)
            throw new InvalidDataException("Invalid creation boundary");

        SafeNCryptProviderHandle provider = Program.Stage("open-software-ksp", () =>
        {
            Check(NCryptOpenStorageProvider(out var result, Program.ProviderName, 0));
            return result;
        });
        using (provider)
        {
            Program.Stage("check-rsa-support", () => { Check(NCryptIsAlgSupported(provider, "RSA", 0)); return true; });
            SafeNCryptKeyHandle handle = Program.Stage("create-rsa-machine-key", () =>
            {
                Check(NCryptCreatePersistedKey(provider, out var result, "RSA", name, 0, MachineKey));
                return result;
            });
            using (handle)
            {
                Set(handle, "Length", BitConverter.GetBytes(3072), 0, "set-rsa-3072");
                Set(handle, "Export Policy", BitConverter.GetBytes(0), 0, "set-export-policy-zero");
                Set(handle, "Key Usage", BitConverter.GetBytes(1), 0, "set-decryption-only-usage");
                string sddl = "D:P(A;;GA;;;SY)(A;;GA;;;" + guardianSid + ")" +
                    (appReadable ? "(A;;GA;;;" + appSid + ")(A;;GA;;;" + Program.ControlUserSid + ")" : "");
                var descriptor = new RawSecurityDescriptor(sddl);
                var bytes = new byte[descriptor.BinaryLength];
                descriptor.GetBinaryForm(bytes, 0);
                Set(handle, "Security Descr", bytes, 4, "set-protected-dacl");
                Program.Stage("finalize-key", () => { Check(NCryptFinalizeKey(handle, NCRYPT_SILENT_FLAG)); return true; });
                return Program.Stage("open-finalized-handle", () => CngKey.Open(handle, CngKeyHandleOpenOptions.None));
            }
        }
    }

    internal static int OpenStatus(string name)
    {
        IntPtr provider = IntPtr.Zero;
        IntPtr key = IntPtr.Zero;
        try
        {
            int status = NCryptOpenStorageProviderRaw(out provider, Program.ProviderName, 0);
            if (status != 0) return status;
            return NCryptOpenKey(provider, out key, name, 0, MachineKey | NCRYPT_SILENT_FLAG);
        }
        finally
        {
            if (key != IntPtr.Zero) _ = NCryptFreeObject(key);
            if (provider != IntPtr.Zero) _ = NCryptFreeObject(provider);
        }
    }

    internal static byte[] EncryptOaepSha256(CngKey key, byte[] plaintext)
    {
        var padding = new BcryptOaepPaddingInfo { Algorithm = "SHA256" };
        int flags = NCRYPT_PAD_OAEP_FLAG | NCRYPT_SILENT_FLAG;
        Check(NCryptEncrypt(key.Handle, plaintext, plaintext.Length, ref padding, null, 0, out int needed, flags));
        byte[] output = new byte[needed];
        Check(NCryptEncrypt(key.Handle, plaintext, plaintext.Length, ref padding, output, output.Length, out int written, flags));
        if (written != output.Length) throw new CryptographicException("Unexpected wrapped-key length");
        return output;
    }

    internal static byte[] DecryptOaepSha256(CngKey key, byte[] ciphertext)
    {
        var padding = new BcryptOaepPaddingInfo { Algorithm = "SHA256" };
        int flags = NCRYPT_PAD_OAEP_FLAG | NCRYPT_SILENT_FLAG;
        Check(NCryptDecrypt(key.Handle, ciphertext, ciphertext.Length, ref padding, null, 0, out int needed, flags));
        byte[] output = new byte[needed];
        try
        {
            Check(NCryptDecrypt(key.Handle, ciphertext, ciphertext.Length, ref padding, output, output.Length, out int written, flags));
            if (written != output.Length) throw new CryptographicException("Unexpected data-key length");
            return output;
        }
        catch { CryptographicOperations.ZeroMemory(output); throw; }
    }

    static void Set(SafeNCryptKeyHandle key, string property, byte[] value, int flags, string stage)
        => Program.Stage(stage, () => { Check(NCryptSetProperty(key, property, value, value.Length, flags)); return true; });

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct BcryptOaepPaddingInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string Algorithm;
        public IntPtr Label;
        public int LabelLength;
    }

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle provider, string name, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptIsAlgSupported(SafeNCryptProviderHandle provider, string algorithm, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key, string algorithm, string name, int legacy, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptSetProperty(SafeNCryptKeyHandle key, string property, byte[] value, int length, int flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key, int flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptEncrypt(SafeNCryptKeyHandle key, byte[] input, int inputLength,
        ref BcryptOaepPaddingInfo padding, [Out] byte[]? output, int outputLength, out int resultLength, int flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptDecrypt(SafeNCryptKeyHandle key, byte[] input, int inputLength,
        ref BcryptOaepPaddingInfo padding, [Out] byte[]? output, int outputLength, out int resultLength, int flags);
    [DllImport("ncrypt.dll", EntryPoint = "NCryptOpenStorageProvider", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenStorageProviderRaw(out IntPtr provider, string name, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenKey(IntPtr provider, out IntPtr key, string name, uint legacy, uint flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFreeObject(IntPtr handle);
}
