using Microsoft.Win32.SafeHandles;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;

namespace Ecs.Lic008;

// Test-only A/B helper. Names are restricted to the fresh ACL-control namespace.
internal static class AclControlNative
{
    const int MachineKey = 0x20;
    const int Silent = 0x40;

    static void Check(int status) { if (status != 0) throw new CryptographicException(status); }

    internal static CngKey Create(string name, string experimentId, string label,
        string guardianSid, string appSid, bool appReadable)
    {
        if (!Program.ValidAclControlKeyName(name, experimentId, label) ||
            !guardianSid.StartsWith("S-1-5-80-", StringComparison.Ordinal) ||
            !appSid.StartsWith("S-1-5-80-", StringComparison.Ordinal) || guardianSid == appSid)
            throw new InvalidDataException();

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
                Check(NCryptCreatePersistedKey(provider, out var result, "ECDSA_P256", name, 0, MachineKey));
                return result;
            });
            using (handle)
            {
                Set(handle, "Export Policy", BitConverter.GetBytes(0), 0, "native-set-export-policy");
                Set(handle, "Key Usage", BitConverter.GetBytes(2), 0, "native-set-signing-usage");
                string sddl = "D:P(A;;GA;;;SY)(A;;GA;;;" + guardianSid + ")" +
                    (appReadable ? "(A;;GA;;;" + appSid + ")" : "");
                var acl = new RawSecurityDescriptor(sddl);
                var bytes = new byte[acl.BinaryLength];
                acl.GetBinaryForm(bytes, 0);
                Set(handle, "Security Descr", bytes, 4, "native-set-dacl-before-finalize");
                Program.Stage("native-finalize-key", () => { Check(NCryptFinalizeKey(handle, Silent)); return true; });
                return Program.Stage("managed-open-finalized-handle", () => CngKey.Open(handle, CngKeyHandleOpenOptions.None));
            }
        }
    }

    internal static NativeOpenResult Inspect(OwnedKey owned, string experimentId, string label)
    {
        if (owned.Provider != "software" || !Program.ValidAclControlKeyName(owned.Name, experimentId, label) || owned.PublicHash.Length != 64)
            throw new InvalidDataException();
        IntPtr provider = IntPtr.Zero;
        IntPtr key = IntPtr.Zero;
        try
        {
            int providerStatus = NCryptOpenStorageProviderRaw(out provider, "Microsoft Software Key Storage Provider", 0);
            if (providerStatus != 0) return new(providerStatus, null, null);
            int algorithmStatus = NCryptIsAlgSupportedRaw(provider, "ECDSA_P256", 0);
            if (algorithmStatus != 0) return new(providerStatus, algorithmStatus, null);
            int keyStatus = NCryptOpenKey(provider, out key, owned.Name, 0, MachineKey | Silent);
            return new(providerStatus, algorithmStatus, keyStatus);
        }
        finally
        {
            if (key != IntPtr.Zero) _ = NCryptFreeObject(key);
            if (provider != IntPtr.Zero) _ = NCryptFreeObject(provider);
        }
    }

    static void Set(SafeNCryptKeyHandle key, string property, byte[] bytes, int flags, string stage)
        => Program.Stage(stage, () => { Check(NCryptSetProperty(key, property, bytes, bytes.Length, flags)); return true; });

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle provider, string name, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptIsAlgSupported(SafeNCryptProviderHandle provider, string algorithm, int flags);
    [DllImport("ncrypt.dll", EntryPoint = "NCryptOpenStorageProvider", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenStorageProviderRaw(out IntPtr provider, string name, int flags);
    [DllImport("ncrypt.dll", EntryPoint = "NCryptIsAlgSupported", CharSet = CharSet.Unicode)]
    static extern int NCryptIsAlgSupportedRaw(IntPtr provider, string algorithm, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key, string algorithm, string name, int legacy, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptSetProperty(SafeNCryptKeyHandle key, string property, byte[] value, int length, int flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenKey(IntPtr provider, out IntPtr key, string name, uint legacyKeySpec, uint flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFreeObject(IntPtr handle);
}
