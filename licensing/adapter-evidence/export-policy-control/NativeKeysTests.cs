using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal static class NativeKeysTests
{
    // No valid admission callback ever returns in this suite. Tests cannot
    // invoke NCrypt, open/create a real key, or enter a service/controller route.
    internal static int SelfTest()
    {
        int cases = 0;
        void Need(bool condition)
        {
            if (!condition) throw new InvalidDataException("CONTROL_NATIVE_PURE_ASSERTION");
            cases++;
        }
        void Reject(Action action)
        {
            try { action(); }
            catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("CONTROL_NATIVE_REFUSAL_MISSING");
        }
        void NullArgument(Action action)
        {
            try { action(); }
            catch (ArgumentNullException) { cases++; return; }
            throw new InvalidDataException("CONTROL_NATIVE_NULL_GUARD_ACCEPTED");
        }
        void InvalidDescriptor(byte[]? input)
        {
            try { NativeKeyRules.ValidateDacl(input); }
            catch (Exception error) when (error is InvalidDataException or ArgumentException) { cases++; return; }
            throw new InvalidDataException("CONTROL_NATIVE_DACL_REFUSAL_MISSING");
        }
        string attempt = new('a', 32);
        Need(KeyNames.For(attempt, ControlArm.Exportable) ==
            "Ecs.Lic008.ExportPolicyControlV5.TEST_ONLY." + attempt + ".exportable");
        Need(KeyNames.For(attempt, ControlArm.NonExportable) ==
            "Ecs.Lic008.ExportPolicyControlV5.TEST_ONLY." + attempt + ".nonexportable");
        Need(KeyNames.For(attempt, ControlArm.Exportable) != KeyNames.For(attempt, ControlArm.NonExportable));
        Need(KeyNames.For(new string('0', 32), ControlArm.Exportable) != KeyNames.For(attempt, ControlArm.Exportable));
        foreach (char valid in "0123456789abcdef")
            Need(KeyNames.For(new string(valid, 32), ControlArm.Exportable).Contains(new string(valid, 32), StringComparison.Ordinal));

        int setupCalls = 0, guardianCalls = 0;
        var keys = new NativeControlKeys(
            () => { setupCalls++; throw new AdmissionRefused("SETUP"); },
            () => { guardianCalls++; throw new AdmissionRefused("GUARDIAN"); });
        string?[] invalidAttempts = {
            null, "", " ", new string('a', 31), new string('a', 33), new string('A', 32),
            new string('g', 32), " " + new string('a', 31), new string('a', 31) + "\n",
            "../" + new string('a', 29), "..\\" + new string('a', 29),
            "Ecs.Lic008.EntryEvidenceV2", "Ecs.Lic008.GuardianSealDiagnosticV3",
            "Ecs.Lic008.ExportPolicyControlV1.TEST_ONLY." + attempt + ".exportable",
            "Ecs.Lic008.ExportPolicyControlV2.TEST_ONLY." + attempt + ".exportable",
            "Ecs.Lic008.ExportPolicyControlV3.TEST_ONLY." + attempt + ".exportable",
            "Ecs.Lic008.ExportPolicyControlV4.TEST_ONLY." + attempt + ".exportable"
        };
        foreach (string? invalid in invalidAttempts)
            foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
                Reject(() => KeyNames.For(invalid!, arm));
                Reject(() => keys.Create(invalid!, arm));
                Reject(() => keys.OpenCreated(invalid!, arm));
                Reject(() => keys.Open(invalid!, arm));
                Need(setupCalls == 0 && guardianCalls == 0);
            }
        foreach (int value in new[] { -1, -2, 2, 3, int.MinValue, int.MaxValue }) {
            var invalid = (ControlArm)value;
            Reject(() => KeyNames.For(attempt, invalid));
            Reject(() => NativeKeyRules.Policy(invalid));
            Reject(() => keys.Create(attempt, invalid));
            Reject(() => keys.OpenCreated(attempt, invalid));
            Reject(() => keys.Open(attempt, invalid));
            Need(setupCalls == 0 && guardianCalls == 0);
        }
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            int setupBefore = setupCalls, guardianBefore = guardianCalls;
            GuardRefused(() => keys.Create(attempt, arm), "SETUP");
            Need(setupCalls == setupBefore + 1 && guardianCalls == guardianBefore);
            GuardRefused(() => keys.OpenCreated(attempt, arm), "SETUP");
            Need(setupCalls == setupBefore + 2 && guardianCalls == guardianBefore);
            GuardRefused(() => keys.Open(attempt, arm), "GUARDIAN");
            Need(setupCalls == setupBefore + 2 && guardianCalls == guardianBefore + 1);
        }
        NullArgument(() => _ = new NativeControlKeys(null!, () => throw new AdmissionRefused("UNREACHABLE")));
        NullArgument(() => _ = new NativeControlKeys(() => throw new AdmissionRefused("UNREACHABLE"), null!));

        Need(NativeKeyRules.Policy(ControlArm.Exportable) == 3);
        Need(NativeKeyRules.Policy(ControlArm.NonExportable) == 0);
        NativeKeyRules.ValidateCreationFlags(32, 64); cases++;
        foreach (int create in new[] { 0, 64, 96, 128, 160, -1, int.MaxValue })
            Reject(() => NativeKeyRules.ValidateCreationFlags(create, 64));
        foreach (int finalize in new[] { 0, 4, 8, 32, 68, 72, 96, -1, int.MaxValue })
            Reject(() => NativeKeyRules.ValidateCreationFlags(32, finalize));
        Need(NativeKeyRules.BlobFormat(ExportFormat.GenericPrivate).Format == "PRIVATEBLOB");
        Need(NativeKeyRules.BlobFormat(ExportFormat.Pkcs8).Format == "PKCS8_PRIVATEKEY");
        Need(NativeKeyRules.BlobFormat(ExportFormat.OpaqueTransport).Format == "OpaqueTransport");
        foreach (int format in new[] { -1, 3, 4, int.MinValue, int.MaxValue })
            Reject(() => NativeKeyRules.BlobFormat((ExportFormat)format));

        byte[] initial = Descriptor(new RawSecurityDescriptor(NativeKeyRules.Dacl));
        string initialHash = NativeKeyRules.ValidateDacl(initial);
        Need(initialHash.Length == 64 && initialHash == initialHash.ToLowerInvariant());
        Need(initialHash == NativeKeyRules.ValidateDacl((byte[])initial.Clone()));
        var ownerVariant = new RawSecurityDescriptor(NativeKeyRules.Dacl) {
            Owner = new SecurityIdentifier("S-1-5-32-544"),
            Group = new SecurityIdentifier("S-1-5-32-545")
        };
        Need(initialHash == NativeKeyRules.ValidateDacl(Descriptor(ownerVariant)));
        Need(NativeKeyRules.ValidateDacl(Descriptor(new RawSecurityDescriptor(
            "D:P(A;;0xd01f01ff;;;SY)(A;;0xd01f01ff;;;" + NativeKeyRules.GuardianSid + ")"))).Length == 64);
        InvalidDescriptor(null);
        InvalidDescriptor(Array.Empty<byte>());
        InvalidDescriptor(new byte[1]);
        InvalidDescriptor(new byte[65537]);
        var trailing = new byte[initial.Length + 1];
        initial.CopyTo(trailing, 0);
        InvalidDescriptor(trailing);
        foreach (string sddl in new[] {
            "D:(A;;GA;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")",
            "D:P(A;;GA;;;SY)",
            "D:P(A;;GA;;;SY)(A;;GA;;;SY)",
            "D:P(A;;GA;;;SY)(A;;GA;;;BA)",
            "D:P(A;;GA;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")(A;;GR;;;BA)",
            "D:P(D;;GA;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")",
            "D:P(A;ID;GA;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")",
            "D:P(A;CI;GA;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")",
            "D:P(A;;GR;;;SY)(A;;GA;;;" + NativeKeyRules.GuardianSid + ")",
            "D:P(A;;GA;;;SY)(A;;0x10000001;;;" + NativeKeyRules.GuardianSid + ")"
        }) InvalidDescriptor(Descriptor(new RawSecurityDescriptor(sddl)));
        foreach (AceQualifier qualifier in new[] { AceQualifier.AccessDenied, AceQualifier.SystemAudit, AceQualifier.SystemAlarm })
            InvalidDescriptor(WithFirstAce(new CommonAce(AceFlags.None, qualifier, 0x10000000,
                new SecurityIdentifier(NativeKeyRules.SystemSid), false, null)));
        InvalidDescriptor(WithFirstAce(new CommonAce(AceFlags.None, AceQualifier.AccessAllowed, 0x10000000,
            new SecurityIdentifier(NativeKeyRules.SystemSid), true, new byte[] { 1, 2, 3, 4 })));
        InvalidDescriptor(WithFirstAce(new ObjectAce(AceFlags.None, AceQualifier.AccessAllowed, 0x10000000,
            new SecurityIdentifier(NativeKeyRules.SystemSid), ObjectAceFlags.None, Guid.Empty, Guid.Empty, false, null)));
        return cases;
    }

    private sealed class AdmissionRefused : Exception
    {
        internal AdmissionRefused(string role) : base(role) { }
    }

    private static void GuardRefused(Action action, string role)
    {
        try { action(); }
        catch (AdmissionRefused error) when (error.Message == role) { return; }
        throw new InvalidDataException("CONTROL_NATIVE_GUARD_MISSING");
    }

    private static byte[] WithFirstAce(GenericAce first)
    {
        var security = new RawSecurityDescriptor(NativeKeyRules.Dacl);
        var acl = new RawAcl(GenericAcl.AclRevisionDS, 2);
        acl.InsertAce(0, first);
        acl.InsertAce(1, security.DiscretionaryAcl![1]);
        security.DiscretionaryAcl = acl;
        return Descriptor(security);
    }

    private static byte[] Descriptor(RawSecurityDescriptor security)
    {
        var bytes = new byte[security.BinaryLength];
        security.GetBinaryForm(bytes, 0);
        return bytes;
    }
}
