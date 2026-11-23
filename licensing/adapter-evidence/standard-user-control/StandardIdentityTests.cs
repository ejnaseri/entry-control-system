using System;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardIdentityTests
{
    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_IDENTITY_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) {
            try { work(); } catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("STANDARD_EXPECTED_REFUSAL_MISSING_" + cases);
        }
        StandardToken Good() => new(StandardContract.UserSid, StandardContract.UserSid,
            1, 0, 1, StandardContract.MediumIntegrity, false, false, true,
            new[] { new StandardGroup(StandardContract.Interactive, 4), new StandardGroup(StandardContract.Users, 7) });
        StandardIdentity.Admit(Good()); Check(true);
        Reject(() => StandardIdentity.Admit(null));
        foreach (var bad in new[] {
            Good() with { User = StandardContract.OwnerSid }, Good() with { Owner = StandardContract.OwnerSid },
            Good() with { User = "S-1-5-18" }, Good() with { Owner = "S-1-5-32-545" },
            Good() with { User = StandardContract.UserSid + "\n" }, Good() with { QueryComplete = false },
            Good() with { Type = 0 }, Good() with { Type = 2 }, Good() with { Elevation = -1 },
            Good() with { Elevation = 1 }, Good() with { Elevation = 2 }, Good() with { ElevationType = 0 },
            Good() with { ElevationType = 2 }, Good() with { ElevationType = 3 },
            Good() with { IntegritySid = "S-1-16-4096" }, Good() with { IntegritySid = "S-1-16-8448" },
            Good() with { IntegritySid = "S-1-16-12288" }, Good() with { HasRestrictions = true },
            Good() with { AppContainer = true }, Good() with { Groups = null },
            Good() with { Groups = Array.Empty<StandardGroup>() },
            Good() with { Groups = new[] { new StandardGroup(StandardContract.Interactive, 4) } },
            Good() with { Groups = new[] { new StandardGroup(StandardContract.Users, 7) } },
            Good() with { Groups = new[] { new StandardGroup(StandardContract.Interactive, 4), new StandardGroup(StandardContract.Interactive, 4) } },
            Good() with { Groups = new[] { new StandardGroup(StandardContract.Interactive, 4), new StandardGroup(StandardContract.Users, 7), null! } },
            Good() with { Groups = Enumerable.Range(0, 1025).Select(i => new StandardGroup("S-1-5-" + i, 4)).ToArray() }
        }) Reject(() => StandardIdentity.Admit(bad));
        foreach (uint flags in new uint[] { 0, 4, 14, 16, 20, uint.MaxValue }) {
            var token = Good() with { Groups = Good().Groups!.Append(new(StandardContract.Administrators, flags)).ToArray() };
            Check(StandardIdentity.Refusal(token) == "STANDARD_TOKEN_ADMINISTRATORS_PRESENT");
            Reject(() => StandardIdentity.Admit(token));
        }
        foreach (uint interactive in new uint[] { 0, 2, 4, 7, 14, 16, 20, 30 })
        foreach (uint users in new uint[] { 0, 2, 4, 7, 14, 16, 20, 30 }) {
            var token = Good() with { Groups = new[] { new StandardGroup(StandardContract.Interactive, interactive), new StandardGroup(StandardContract.Users, users) } };
            bool wanted = (interactive & 4) != 0 && (interactive & 16) == 0 && (users & 4) != 0 && (users & 16) == 0;
            if (wanted) { StandardIdentity.Admit(token); cases++; }
            else Reject(() => StandardIdentity.Admit(token));
        }
        foreach (string sid in new[] { "S-1-5-18", StandardContract.UserSid, StandardContract.Interactive,
            "S-1-5-5-1234-5678", "S-1-16-8192", "S-1-281474976710655-4294967295" }) Check(StandardIdentity.CanonicalSid(sid));
        foreach (string? sid in new string?[] { null, "", "s-1-5-18", "S-01-5-18", "S-1-05-18", "S-1-5-018", "S-1-5--1",
            "S-1-5-18\n", "S-1-5-18 ", "S-1-5-4294967296", "S-1-281474976710656-1", "S-1-5", "S-1-5-+1" }) {
            Check(!StandardIdentity.CanonicalSid(sid));
            if (sid is not null) Reject(() => StandardIdentity.Admit(Good() with { Groups = Good().Groups!.Append(new(sid, 4)).ToArray() }));
        }
        foreach (int kind in new[] { 8, 18, 20, 29 }) {
            int[] valid = kind == 8 ? new[] { 1, 2 } : kind == 18 ? new[] { 1, 2, 3 } : new[] { 0, 1 };
            foreach (int value in valid) {
                int calls = 0;
                int result = StandardTokenReader.ReadScalar(kind, (IntPtr p, int size, out int written) => {
                    Check(p != IntPtr.Zero && size == 4 && Marshal.ReadInt32(p) == int.MinValue);
                    calls++; Marshal.WriteInt32(p, value); written = 4; return true;
                });
                Check(result == value && calls == 1);
            }
            foreach (bool success in new[] { false, true })
            foreach (int length in new[] { -1, 0, 1, 2, 3, 4, 5, int.MaxValue }) {
                if (success && length == 4) continue;
                Reject(() => StandardTokenReader.ReadScalar(kind, (IntPtr p, int size, out int written) => {
                    Marshal.WriteInt32(p, valid[0]); written = length; return success;
                }));
            }
            foreach (int value in new[] { int.MinValue, -1, 0, 1, 2, 3, 4, int.MaxValue }.Except(valid))
                Reject(() => StandardTokenReader.ReadScalar(kind, (IntPtr p, int size, out int written) => {
                    Marshal.WriteInt32(p, value); written = 4; return true;
                }));
            Reject(() => StandardTokenReader.ReadScalar(kind, (IntPtr p, int size, out int written) => { written = 4; return true; }));
        }
        foreach (int kind in new[] { -1, 0, 1, 21, 25, 27, 28, 30, int.MaxValue }) {
            bool called = false;
            Reject(() => StandardTokenReader.ReadScalar(kind, (IntPtr p, int size, out int written) => { called = true; written = 4; return true; }));
            Check(!called);
        }
        foreach (int length in new[] { 1, 4 })
        foreach (int value in new[] { 0, 1 }) {
            bool actual = StandardTokenReader.ReadRestrictions((IntPtr p, int size, out int written) => {
                if (length == 1) Marshal.WriteByte(p, (byte)value); else Marshal.WriteInt32(p, value);
                written = length; return true;
            });
            Check(actual == (value != 0));
        }
        foreach (bool success in new[] { false, true })
        foreach (int length in new[] { -1, 0, 1, 2, 3, 4, 5 }) {
            if (success && length is 1 or 4) continue;
            Reject(() => StandardTokenReader.ReadRestrictions((IntPtr p, int size, out int written) => { Marshal.WriteInt32(p, 0); written = length; return success; }));
        }
        foreach (int length in new[] { 1, 4 }) {
            foreach (int value in new[] { 2, 127, 255 }) Reject(() => StandardTokenReader.ReadRestrictions((IntPtr p, int size, out int written) => { Marshal.WriteInt32(p, value); written = length; return true; }));
            Reject(() => StandardTokenReader.ReadRestrictions((IntPtr p, int size, out int written) => { written = length; return true; }));
        }
        IntPtr memory = Marshal.AllocHGlobal(256);
        try {
            byte[] bytes = new byte[256]; Marshal.Copy(bytes, 0, memory, bytes.Length);
            var sid = new SecurityIdentifier(StandardContract.Interactive); var sidBytes = new byte[sid.BinaryLength]; sid.GetBinaryForm(sidBytes, 0);
            Marshal.Copy(sidBytes, 0, memory + 40, sidBytes.Length);
            Check(StandardTokenReader.SidInBuffer(memory, 256, memory + 40, 40) == StandardContract.Interactive);
            foreach (int offset in new[] { -1, 0, 8, 39, 249, 256, 1000 }) Reject(() => StandardTokenReader.SidInBuffer(memory, 256, memory + offset, 40));
            Reject(() => StandardTokenReader.SidInBuffer(memory, 256, memory + 40, 41));
            Reject(() => StandardTokenReader.SidInBuffer(memory, 44, memory + 40, 0));
            Reject(() => StandardTokenReader.SidInBuffer(memory, 48, memory + 40, 0));
            Marshal.WriteByte(memory, 40, 2); Reject(() => StandardTokenReader.SidInBuffer(memory, 256, memory + 40, 40)); Marshal.WriteByte(memory, 40, 1);
            Marshal.WriteByte(memory, 41, 16); Reject(() => StandardTokenReader.SidInBuffer(memory, 256, memory + 40, 40)); Marshal.WriteByte(memory, 41, 1);
            Marshal.WriteInt32(memory, 2); Marshal.WriteIntPtr(memory, 8, memory + 40); Marshal.WriteInt32(memory, 16, 4);
            var users = new SecurityIdentifier(StandardContract.Users); var usersBytes = new byte[users.BinaryLength]; users.GetBinaryForm(usersBytes, 0);
            Marshal.Copy(usersBytes, 0, memory + 64, usersBytes.Length); Marshal.WriteIntPtr(memory, 24, memory + 64); Marshal.WriteInt32(memory, 32, 7);
            var groups = StandardTokenReader.GroupsInBuffer(memory, 256);
            Check(groups.Count == 2 && groups[0] == new StandardGroup(StandardContract.Interactive, 4) && groups[1] == new StandardGroup(StandardContract.Users, 7));
            foreach (int count in new[] { -1, 16, 1025, int.MaxValue }) { Marshal.WriteInt32(memory, count); Reject(() => StandardTokenReader.GroupsInBuffer(memory, 256)); }
            Marshal.WriteInt32(memory, 2); Marshal.WriteIntPtr(memory, 24, memory + 24); Reject(() => StandardTokenReader.GroupsInBuffer(memory, 256));
            Reject(() => StandardTokenReader.GroupsInBuffer(memory, 7));
            Marshal.WriteInt32(memory, 0); Check(StandardTokenReader.GroupsInBuffer(memory, 8).Count == 0);
        } finally { Marshal.FreeHGlobal(memory); }
        Reject(() => StandardTokenReader.GroupsInBuffer(IntPtr.Zero, 256));
        Reject(() => StandardTokenReader.SidInBuffer(IntPtr.Zero, 256, IntPtr.Zero, 0));
        return cases;
    }
}
