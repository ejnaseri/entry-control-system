using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal interface IControlKey : IDisposable
{
    KeySnapshot Inspect();
    byte[] Export(ExportFormat format);
}

internal interface IControlKeys
{
    IControlKey Create(string attemptId, ControlArm arm);
    IControlKey OpenCreated(string attemptId, ControlArm arm);
    IControlKey Open(string attemptId, ControlArm arm);
}

internal static class KeyNames
{
    internal const string Prefix = ControlRules.Placement + ".TEST_ONLY.";

    internal static string For(string attemptId, ControlArm arm)
    {
        if (attemptId is null || attemptId.Length != 32)
            throw new InvalidDataException("CONTROL_KEY_ATTEMPT_REFUSED");
        foreach (char value in attemptId)
            if (!(value is >= '0' and <= '9' or >= 'a' and <= 'f'))
                throw new InvalidDataException("CONTROL_KEY_ATTEMPT_REFUSED");
        return Prefix + attemptId + "." + (arm switch {
            ControlArm.Exportable => "exportable",
            ControlArm.NonExportable => "nonexportable",
            _ => throw new InvalidDataException("CONTROL_KEY_ARM_REFUSED")
        });
    }
}

// Pure rules shared with the readback checks. None of these methods accesses a
// provider, service, persisted key, or private key material.
internal static class NativeKeyRules
{
    internal const string GuardianSid = "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315";
    internal const string SystemSid = "S-1-5-18";
    internal const int CreateFlags = 0x20; // MACHINE_KEY only; never OVERWRITE.
    internal const int FinalizeFlags = 0x40; // SILENT.
    internal const string Dacl = "D:P(A;;GA;;;SY)(A;;GA;;;" + GuardianSid + ")";

    internal static int Policy(ControlArm arm) => arm switch {
        ControlArm.Exportable => 3, // AllowExport | AllowPlaintextExport.
        ControlArm.NonExportable => 0,
        _ => throw new InvalidDataException("CONTROL_KEY_ARM_REFUSED")
    };

    internal static CngKeyBlobFormat BlobFormat(ExportFormat format) => format switch {
        ExportFormat.GenericPrivate => CngKeyBlobFormat.GenericPrivateBlob,
        ExportFormat.Pkcs8 => CngKeyBlobFormat.Pkcs8PrivateBlob,
        ExportFormat.OpaqueTransport => CngKeyBlobFormat.OpaqueTransportBlob,
        _ => throw new InvalidDataException("CONTROL_KEY_FORMAT_REFUSED")
    };

    internal static void ValidateCreationFlags(int create, int finalize)
    {
        if (create != CreateFlags || finalize != FinalizeFlags)
            throw new InvalidDataException("CONTROL_KEY_FLAGS_REFUSED");
    }

    internal static string ValidateDacl(byte[]? descriptor)
    {
        if (descriptor is null || descriptor.Length == 0 || descriptor.Length > 65536)
            throw new InvalidDataException("CONTROL_KEY_DACL_REFUSED");
        var security = new RawSecurityDescriptor(descriptor, 0);
        const ControlFlags required = ControlFlags.DiscretionaryAclPresent | ControlFlags.DiscretionaryAclProtected;
        if (security.BinaryLength != descriptor.Length || (security.ControlFlags & required) != required ||
            security.DiscretionaryAcl is not { Count: 2 } acl)
            throw new InvalidDataException("CONTROL_KEY_DACL_REFUSED");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (GenericAce raw in acl) {
            if (raw is not CommonAce ace || ace.IsCallback ||
                ace.AceQualifier != AceQualifier.AccessAllowed || ace.AceFlags != AceFlags.None ||
                (ace.SecurityIdentifier.Value != SystemSid && ace.SecurityIdentifier.Value != GuardianSid) ||
                !seen.Add(ace.SecurityIdentifier.Value) ||
                unchecked((uint)ace.AccessMask) is not (0x10000000u or 0xd01f01ffu))
                throw new InvalidDataException("CONTROL_KEY_ACE_REFUSED");
        }
        // Match the actual ACL, not owner/group metadata that is outside the
        // permission contract. A different ordering/mask representation remains
        // conservatively a different digest even if rights are equivalent.
        var bytes = new byte[acl.BinaryLength];
        acl.GetBinaryForm(bytes, 0);
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}

// This backend has no Delete operation, overwrite flag, retained-key name, CLI,
// or permission-changing operation for an existing key. Partial creation is
// retained for review. Service admission supplies authenticated role guards;
// pure tests use guards that throw before any native call.
internal sealed class NativeControlKeys : IControlKeys
{
    private readonly Action requireSetup;
    private readonly Action requireGuardian;

    internal NativeControlKeys(Action requireSetup, Action requireGuardian)
    {
        this.requireSetup = requireSetup ?? throw new ArgumentNullException(nameof(requireSetup));
        this.requireGuardian = requireGuardian ?? throw new ArgumentNullException(nameof(requireGuardian));
    }

    public IControlKey Create(string attemptId, ControlArm arm)
    {
        string name = KeyNames.For(attemptId, arm);
        int policy = NativeKeyRules.Policy(arm);
        NativeKeyRules.ValidateCreationFlags(NativeKeyRules.CreateFlags, NativeKeyRules.FinalizeFlags);
        requireSetup();
        SafeNCryptProviderHandle? provider = null;
        SafeNCryptKeyHandle? handle = null;
        try {
            Check(NCryptOpenStorageProvider(out provider, MatchedExportProbe.Provider, 0));
            requireSetup();
            Check(NCryptIsAlgSupported(provider, "RSA", 0));
            requireSetup();
            Check(NCryptCreatePersistedKey(provider, out handle, "RSA", name, 0, NativeKeyRules.CreateFlags));
            requireSetup();
            Set(handle, "Length", BitConverter.GetBytes(3072), 0);
            requireSetup();
            Set(handle, "Export Policy", BitConverter.GetBytes(policy), 0);
            requireSetup();
            Set(handle, "Key Usage", BitConverter.GetBytes(1), 0);
            var descriptor = new RawSecurityDescriptor(NativeKeyRules.Dacl);
            var bytes = new byte[descriptor.BinaryLength];
            descriptor.GetBinaryForm(bytes, 0);
            NativeKeyRules.ValidateDacl(bytes);
            requireSetup();
            Set(handle, "Security Descr", bytes, 4);
            requireSetup();
            Check(NCryptFinalizeKey(handle, NativeKeyRules.FinalizeFlags));
            // CngKey.Open duplicates the safe handle. The raw handle/provider
            // are always released, including finalize/readback failure paths.
            return Wrap(CngKey.Open(handle, CngKeyHandleOpenOptions.None), name, policy, requireSetup, false);
        }
        finally {
            handle?.Dispose();
            provider?.Dispose();
        }
    }

    public IControlKey OpenCreated(string attemptId, ControlArm arm) => OpenFor(attemptId, arm, requireSetup, false);
    public IControlKey Open(string attemptId, ControlArm arm) => OpenFor(attemptId, arm, requireGuardian, true);

    private static IControlKey OpenFor(string attemptId, ControlArm arm, Action requireRole, bool allowExport)
    {
        string name = KeyNames.For(attemptId, arm);
        int policy = NativeKeyRules.Policy(arm);
        requireRole();
        return Wrap(CngKey.Open(name, new CngProvider(MatchedExportProbe.Provider),
            CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent), name, policy, requireRole, allowExport);
    }

    private static IControlKey Wrap(CngKey key, string name, int policy, Action requireRole, bool allowExport)
    {
        try { return new NativeControlKey(key, name, policy, requireRole, allowExport); }
        catch { key.Dispose(); throw; }
    }

    private sealed class NativeControlKey : IControlKey
    {
        private readonly CngKey key;
        private readonly string name;
        private readonly int policy;
        private readonly Action requireRole;
        private readonly bool allowExport;
        private readonly string publicIdentity;
        private bool disposed;

        internal NativeControlKey(CngKey key, string name, int policy, Action requireRole, bool allowExport)
        {
            this.key = key;
            this.name = name;
            this.policy = policy;
            this.requireRole = requireRole;
            this.allowExport = allowExport;
            publicIdentity = ReadSnapshot().ReopenedPublicIdentitySha256!;
        }

        public KeySnapshot Inspect()
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            KeySnapshot snapshot = ReadSnapshot();
            if (snapshot.ReopenedPublicIdentitySha256 != publicIdentity)
                throw new InvalidDataException("CONTROL_KEY_PUBLIC_IDENTITY_CHANGED");
            return snapshot;
        }

        private KeySnapshot ReadSnapshot()
        {
            requireRole();
            if (key.Provider?.Provider != MatchedExportProbe.Provider || key.KeyName != name ||
                key.IsEphemeral || !key.IsMachineKey || key.Algorithm.Algorithm != "RSA" ||
                key.KeySize != 3072 || (int)key.KeyUsage != 1 || (int)key.ExportPolicy != policy)
                throw new InvalidDataException("CONTROL_KEY_METADATA_REFUSED");
            string dacl = NativeKeyRules.ValidateDacl(key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue());
            using var rsa = new RSACng(key);
            string identity = Convert.ToHexString(SHA256.HashData(rsa.ExportSubjectPublicKeyInfo())).ToLowerInvariant();
            // Both fields describe THIS inspected handle. The orchestrator
            // compares the persisted reopen against the recorded creation hash;
            // these equal fields alone do not establish that chain of custody.
            return new(name, MatchedExportProbe.Provider, "RSA", 3072, true, true,
                1, policy, true, dacl, identity, identity);
        }

        public byte[] Export(ExportFormat format)
        {
            CngKeyBlobFormat mapped = NativeKeyRules.BlobFormat(format);
            ObjectDisposedException.ThrowIf(disposed, this);
            if (!allowExport) throw new InvalidDataException("CONTROL_SETUP_EXPORT_REFUSED");
            Inspect(); // Reauthenticate Guardian and read back the exact policy.
            requireRole(); // No new private export after a slow metadata check.
            // The caller is MatchedExportProbe, whose finally block zeros every
            // returned private buffer. Never persist, log, or include it in a report.
            return key.Export(mapped);
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            key.Dispose();
        }
    }

    private static void Check(int status)
    {
        if (status != 0) throw new CryptographicException(status);
    }

    private static void Set(SafeNCryptKeyHandle key, string property, byte[] value, int flags) =>
        Check(NCryptSetProperty(key, property, value, value.Length, flags));

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle handle, string name, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptIsAlgSupported(SafeNCryptProviderHandle provider, string algorithm, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key,
        string algorithm, string name, int legacy, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptSetProperty(SafeNCryptKeyHandle key, string property, byte[] value, int length, int flags);
    [DllImport("ncrypt.dll")]
    private static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key, int flags);
}
