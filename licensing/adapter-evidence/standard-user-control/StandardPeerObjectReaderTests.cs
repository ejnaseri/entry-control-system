using System;
using System.Buffers.Binary;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace EntryControl.TestOnly.StandardUserControl;

// Synthetic byte buffers only: no OS handle is opened, queried, transferred or
// adopted. A successful object read still must not imply process/token binding.
internal static class StandardPeerObjectReaderTests
{
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.OwnerSid, 1, 1, 2,
        "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 4), new StandardGroup(StandardContract.Interactive, 4) });
    private static byte[] Statistics()
    {
        byte[] bytes = new byte[56];
        BinaryPrimitives.WriteUInt64LittleEndian(bytes, 17);
        BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(8), 23);
        BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(24), 1);
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(40), 2);
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(44), 3);
        BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(48), 31); return bytes;
    }
    internal static int Run()
    {
        int count = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_PEER_TEST_FAILED_" + count); count++; }
        void Reject<T>(Action action) where T : Exception {
            try { action(); } catch (T) { count++; return; }
            throw new InvalidDataException("STANDARD_PEER_EXPECTED_REFUSAL_MISSING_" + count);
        }
        StandardPeerObjectRules.Handles(4, 8); Check(true);
        foreach (long bad in new long[] { long.MinValue, -6, -4, -2, -1, 0 }) {
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Handles(bad, 8));
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Handles(4, bad));
        }
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Handles(4, 4));
        foreach (string kind in new[] { "Process", "Token" }) {
            uint exact = kind == "Process" ? StandardPeerObjectRules.ProcessReadSynchronize : StandardPeerObjectRules.TokenQuery;
            byte[] bytes = new byte[56]; BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4), exact);
            Check(StandardPeerObjectRules.Basic(bytes, kind) == exact);
            // Both missing and added access rights must be refused, including
            // duplication, VM access and token impersonation/assignment rights.
            for (int bit = 0; bit < 32; bit++) {
                uint changed = exact ^ (1u << bit); BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4), changed);
                Reject<InvalidDataException>(() => StandardPeerObjectRules.Basic(bytes, kind));
            }
            foreach (int length in new[] { 0, 4, 8, 55, 57, 64 })
                Reject<InvalidDataException>(() => StandardPeerObjectRules.Basic(new byte[length], kind));
        }
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Basic(null, "Process"));
        foreach (string kind in new[] { "process", "Thread", "", "Token " })
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Basic(new byte[56], kind));
        StandardPeerObjectRules.HandleFlags(0); Check(true);
        foreach (uint flags in new uint[] { 1, 2, 3, 4, 0x80000000, uint.MaxValue })
            Reject<InvalidDataException>(() => StandardPeerObjectRules.HandleFlags(flags));

        var expected = new StandardPeerTokenStatistics(17, 23, 31, 1, 2, 3);
        Check(StandardPeerObjectRules.Statistics(Statistics()) == expected);
        foreach (int length in new[] { 0, 24, 48, 55, 57, 64 })
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(new byte[length]));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(null));
        foreach (int offset in new[] { 0, 8, 48 }) {
            byte[] bytes = Statistics(); BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(offset), 0);
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(bytes));
        }
        foreach (int type in new[] { int.MinValue, -1, 0, 3, int.MaxValue }) {
            byte[] bytes = Statistics(); BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(24), type);
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(bytes));
        }
        foreach (int offset in new[] { 40, 44 }) {
            byte[] bytes = Statistics(); BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(offset), 1024);
            StandardPeerObjectRules.Statistics(bytes); Check(true);
            foreach (uint tooMany in new uint[] { 1025, uint.MaxValue }) {
                BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(offset), tooMany);
                Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(bytes));
            }
        }
        for (int level = -1; level <= 4; level++) {
            byte[] bytes = Statistics(); BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(24), 2);
            BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(28), level);
            if (level is >= 0 and <= 3) { Check(StandardPeerObjectRules.Statistics(bytes).TokenType == 2); }
            else Reject<InvalidDataException>(() => StandardPeerObjectRules.Statistics(bytes));
        }
        StandardPeerObjectRules.Stable(expected, expected, Owner()); Check(true);
        foreach (var changed in new[] { expected with { TokenId = 18 }, expected with { AuthenticationId = 24 },
            expected with { ModifiedId = 32 }, expected with { TokenType = 2 }, expected with { GroupCount = 3 },
            expected with { PrivilegeCount = 4 } })
            Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(expected, changed, Owner()));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(expected, expected, Owner() with { Type = 2 }));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(expected, expected, Owner() with { Groups = Array.Empty<StandardGroup>() }));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(null!, expected, Owner()));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(expected, null!, Owner()));
        Reject<InvalidDataException>(() => StandardPeerObjectRules.Stable(expected, expected, null!));

        IntPtr buffer = Marshal.AllocHGlobal(128);
        try {
            void Fill(string name) {
                Marshal.Copy(new byte[128], 0, buffer, 128); byte[] bytes = Encoding.Unicode.GetBytes(name);
                Marshal.WriteInt16(buffer, (short)bytes.Length); Marshal.WriteInt16(buffer, 2, (short)(bytes.Length + 2));
                Marshal.WriteIntPtr(buffer, 8, IntPtr.Add(buffer, 32)); Marshal.Copy(bytes, 0, IntPtr.Add(buffer, 32), bytes.Length);
            }
            foreach (string name in new[] { "Process", "Token" }) {
                Fill(name); Check(StandardPeerObjectRules.TypeName(buffer, 128, name) == name);
                foreach (int written in new[] { -1, 0, 15, 32 + name.Length * 2 - 1, 65537, int.MaxValue })
                    Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, written, name));
                Fill(name); Marshal.WriteInt16(buffer, 1);
                Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
                Fill(name); Marshal.WriteInt16(buffer, 2, 0);
                Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
                Fill(name); Marshal.WriteInt16(buffer, 2, 126);
                Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
                foreach (long offset in new long[] { -1, 0, 8, 15, 127, 128, 129 }) {
                    Fill(name); Marshal.WriteIntPtr(buffer, 8, new IntPtr(buffer.ToInt64() + offset));
                    Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
                }
                Fill(name.ToLowerInvariant());
                Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
                Fill(name); Marshal.WriteInt16(IntPtr.Add(buffer, 32), unchecked((short)0xd800));
                Reject<DecoderFallbackException>(() => StandardPeerObjectRules.TypeName(buffer, 128, name));
            }
            foreach (string kind in new[] { "process", "", "Thread", "Token " })
                Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(buffer, 128, kind));
            Reject<InvalidDataException>(() => StandardPeerObjectRules.TypeName(IntPtr.Zero, 128, "Token"));
        } finally { Marshal.FreeHGlobal(buffer); }
        var observed = new StandardPeerObjectObservation(new(7, 42, StandardLaunchPlan.Image), Owner(), expected,
            StandardPeerObjectRules.ProcessReadSynchronize, StandardPeerObjectRules.TokenQuery);
        Check(!observed.ProcessTokenAssociationEstablished && !observed.LoadedCodeEstablished && !observed.BootstrapAuthorized &&
            !observed.NativeExecutionAccepted && !observed.SecurityAccepted && !observed.ProductionAccepted);
        return count;
    }
}
