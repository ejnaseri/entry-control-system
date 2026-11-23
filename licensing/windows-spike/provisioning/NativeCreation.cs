using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;

namespace Ecs.Lic008;

internal static class NativeCreation
{
    static void Check(int result) { if (result != 0) throw new CryptographicException(result); }
    public static CngKey Create(string name, string guardianSid)
    {
        if (!Program.ValidKeyName(name, "software")) throw new InvalidDataException();
        SafeNCryptProviderHandle provider = Program.Stage("native-open-provider", () =>
        {
            Check(NCryptOpenStorageProvider(out var result, "Microsoft Software Key Storage Provider", 0));
            return result;
        });
        using (provider)
        {
            Program.Stage("provider-algorithm-support", () => { Check(NCryptIsAlgSupported(provider, "ECDSA_P256", 0)); return true; });
            SafeNCryptKeyHandle handle = Program.Stage("native-create-persisted-key", () =>
            {
                Check(NCryptCreatePersistedKey(provider, out var result, "ECDSA_P256", name, 0, 0x20));
                return result;
            });
            using (handle)
            {
                Set(handle, "Export Policy", BitConverter.GetBytes(0), 0, "native-set-export-policy");
                Set(handle, "Key Usage", BitConverter.GetBytes(2), 0, "native-set-signing-usage");
                var acl = new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;" + guardianSid + ")");
                var bytes = new byte[acl.BinaryLength]; acl.GetBinaryForm(bytes, 0);
                Set(handle, "Security Descr", bytes, 4, "native-set-dacl-before-finalize");
                Program.Stage("native-finalize-key", () => { Check(NCryptFinalizeKey(handle, 0x40)); return true; });
                return Program.Stage("managed-open-finalized-handle", () => CngKey.Open(handle, CngKeyHandleOpenOptions.None));
            }
        }
    }
    static void Set(SafeNCryptKeyHandle key, string property, byte[] bytes, int flags, string stage)
        => Program.Stage(stage, () => { Check(NCryptSetProperty(key, property, bytes, bytes.Length, flags)); return true; });
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
}
