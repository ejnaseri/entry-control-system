using System;
using System.Buffers.Binary;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlTokenSnapshot(string User, string Owner, int Type,
    int Elevation, string ServiceSid, uint Attributes, int GroupCount,
    bool Restricted, bool QueryComplete);

// Native calls are not reachable from Program's closed production entry. The
// physical caller must admit its pinned deployment before invoking Capture.
internal static class NativeControlIdentity
{
    internal static string ServiceName(ControlRole role) => role switch {
        ControlRole.Setup => ControlRules.SetupService,
        ControlRole.Guardian => ControlRules.GuardianService,
        _ => throw new InvalidDataException("CONTROL_ROLE_REFUSED")
    };

    internal static string DerivedServiceSid(ControlRole role)
    {
        // This SHA1 is Windows service namespace derivation, not a trust hash.
        byte[] digest = SHA1.HashData(Encoding.Unicode.GetBytes(ServiceName(role).ToUpperInvariant()));
        return "S-1-5-80-" + string.Join("-", Enumerable.Range(0, 5).Select(i =>
            BinaryPrimitives.ReadUInt32LittleEndian(digest.AsSpan(i * 4, 4)).ToString(CultureInfo.InvariantCulture)));
    }

    internal static string RegisteredServiceSid(ControlRole role)
    {
        RuntimeGuard();
        string expected = DerivedServiceSid(role);
        ControlRules.Need(expected == (role == ControlRole.Setup ? ControlRules.SetupSid : ControlRules.GuardianSid),
            "CONTROL_DERIVED_SID_REFUSED");
        string actual = ((SecurityIdentifier)new NTAccount("NT SERVICE", ServiceName(role))
            .Translate(typeof(SecurityIdentifier))).Value;
        ControlRules.Need(actual == expected,
            "CONTROL_REGISTERED_SID_REFUSED");
        return actual;
    }

    internal static void RuntimeGuard() => ControlRules.Need(
        RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
        RuntimeInformation.OSArchitecture == Architecture.X64 &&
        RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
        Environment.Version.ToString() == "10.0.11", "CONTROL_NATIVE_RUNTIME_REFUSED");

    // WindowsPrincipal.IsInRole may duplicate a primary token before querying
    // group membership. Query alone is insufficient; this is not elevation or
    // impersonation, and callers still enforce their owner/primary-token rules.
    internal static WindowsIdentity OpenOwnerForMembership() =>
        WindowsIdentity.GetCurrent(TokenAccessLevels.Query | TokenAccessLevels.Duplicate);

    internal static string Boot()
    {
        RuntimeGuard();
        IntPtr buffer = Marshal.AllocHGlobal(48);
        try {
            int status = NtQuerySystemInformation(3, buffer, 48, out int written);
            ControlRules.Need(status == 0 && written is >= 8 and <= 48, "CONTROL_BOOT_QUERY_REFUSED");
            long value = Marshal.ReadInt64(buffer);
            return BootDigest(value);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static string BootDigest(long value)
    {
        ControlRules.Need(value > 0, "CONTROL_BOOT_TIME_REFUSED");
        byte[] bytes = new byte[8];
        BinaryPrimitives.WriteInt64LittleEndian(bytes, value);
        return ControlRules.Hash(bytes);
    }

    internal static void Validate(ControlRole role, ControlTokenSnapshot? token, ControlStartupTrace? trace = null)
    {
        string sid = DerivedServiceSid(role);
        ControlRules.Need(sid == (role == ControlRole.Setup ? ControlRules.SetupSid : ControlRules.GuardianSid), "CONTROL_DERIVED_SID_REFUSED");
        ControlStartupTrace.At(trace, ControlStartupStage.IdentityShape, () => ControlRules.Need(token is not null && token.QueryComplete && !token.Restricted &&
            token.Type == 1 && token.Elevation is 0 or 1 && token.ServiceSid == sid &&
            token.GroupCount is 0 or 1, "CONTROL_TOKEN_SHAPE_REFUSED"));
        string expectedUser = role == ControlRole.Setup ? "S-1-5-18" : sid;
        ControlStartupTrace.At(trace, ControlStartupStage.IdentityOwnerRule, () =>
            ControlRules.Need(token!.User == expectedUser && token.Owner == expectedUser, "CONTROL_TOKEN_OWNER_REFUSED"));
        // A virtual-account SID can be TokenUser without appearing in groups.
        // Do not manufacture enabled group flags for that valid primary token.
        bool groupOk = token!.GroupCount == 0
            ? role == ControlRole.Guardian && token.Attributes == 0
            : (token.Attributes & 4) != 0 && (token.Attributes & 16) == 0;
        ControlStartupTrace.At(trace, ControlStartupStage.IdentityGroupRule, () =>
            ControlRules.Need(groupOk, "CONTROL_TOKEN_SERVICE_GROUP_REFUSED"));
    }

    internal static ControlTokenSnapshot Capture(ControlRole role, ControlStartupTrace? trace = null)
    {
        ControlStartupTrace.At(trace, ControlStartupStage.IdentityRuntime, RuntimeGuard);
        ControlStartupTrace.At(trace, ControlStartupStage.IdentityImpersonation, RejectImpersonation);
        string service = ControlStartupTrace.At(trace, ControlStartupStage.IdentityServiceSid, () => RegisteredServiceSid(role));
        var token = ControlStartupTrace.At(trace, ControlStartupStage.IdentityOpenToken, () => {
            ControlRules.Need(OpenProcessToken(GetCurrentProcess(), 8, out var handle), "CONTROL_TOKEN_OPEN_REFUSED");
            return handle;
        });
        using (token) {
            string user = ControlStartupTrace.At(trace, ControlStartupStage.IdentityUser, () =>
                Info(token, 1, (p, n) => SidInBuffer(p, n, Marshal.ReadIntPtr(p))));
            string owner = ControlStartupTrace.At(trace, ControlStartupStage.IdentityOwner, () =>
                Info(token, 4, (p, n) => SidInBuffer(p, n, Marshal.ReadIntPtr(p))));
            int type = ControlStartupTrace.At(trace, ControlStartupStage.IdentityType, () => Scalar(token, 8));
            int elevation = ControlStartupTrace.At(trace, ControlStartupStage.IdentityElevation, () => Scalar(token, 20));
            bool restricted = ControlStartupTrace.At(trace, ControlStartupStage.IdentityRestriction, () =>
                ReadRestriction((IntPtr p, int size, out int written) => GetTokenInformation(token, 21, p, size, out written)));
            int matches = 0;
            uint attributes = ControlStartupTrace.At(trace, ControlStartupStage.IdentityGroups, () => Info(token, 2, (p, n) => {
                int count = Marshal.ReadInt32(p), offset = IntPtr.Size == 8 ? 8 : 4;
                int stride = Marshal.SizeOf<SidAndAttributes>();
                ControlRules.Need(n >= offset && count >= 0 && count <= (n - offset) / stride,
                    "CONTROL_TOKEN_GROUP_BOUNDS_REFUSED");
                uint found = 0;
                for (int index = 0; index < count; index++) {
                    var group = Marshal.PtrToStructure<SidAndAttributes>(p + offset + index * stride);
                    if (SidInBuffer(p, n, group.Sid) == service) {
                        matches++;
                        found = group.Attributes;
                    }
                }
                return found;
            }));
            var snapshot = new ControlTokenSnapshot(user, owner, type, elevation, service, attributes, matches, restricted, true);
            ControlStartupTrace.At(trace, ControlStartupStage.IdentityImpersonation, RejectImpersonation);
            Validate(role, snapshot, trace);
            return snapshot;
        }
    }

    private static void RejectImpersonation()
    {
        using var impersonating = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(impersonating is null, "CONTROL_IMPERSONATION_REFUSED");
    }

    private static T Info<T>(SafeAccessTokenHandle token, int infoClass, Func<IntPtr, int, T> parse)
    {
        bool first = GetTokenInformation(token, infoClass, IntPtr.Zero, 0, out int size);
        int error = Marshal.GetLastWin32Error();
        ControlRules.Need(!first && error == 122 && size is >= 4 and <= 1048576, "CONTROL_TOKEN_SIZE_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try {
            ControlRules.Need(GetTokenInformation(token, infoClass, buffer, size, out int written) &&
                written >= 4 && written <= size && (infoClass is not (1 or 4) || written >= IntPtr.Size),
                "CONTROL_TOKEN_QUERY_REFUSED");
            return parse(buffer, written);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static int Scalar(SafeAccessTokenHandle token, int infoClass) =>
        ReadScalar(infoClass, (IntPtr p, int capacity, out int written) =>
            GetTokenInformation(token, infoClass, p, capacity, out written));

    private delegate bool ScalarQuery(IntPtr buffer, int capacity, out int written);
    private static int ReadScalar(int infoClass, ScalarQuery query)
    {
        ControlRules.Need(infoClass is 8 or 20, "CONTROL_TOKEN_SCALAR_CLASS_REFUSED");
        // TokenType and TokenElevation have fixed four-byte representations.
        // Do not require a particular error from a zero-length sizing query.
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try {
            // An unwritten/partially written result must not become a valid
            // zero elevation or primary-token value through uninitialized data.
            Marshal.WriteInt32(buffer, -1);
            bool ok = query(buffer, 4, out int written);
            ControlRules.Need(ok && written == 4, "CONTROL_TOKEN_SCALAR_REFUSED");
            int value = Marshal.ReadInt32(buffer);
            ControlRules.Need(infoClass == 8 ? value is 1 or 2 : value is 0 or 1,
                "CONTROL_TOKEN_SCALAR_VALUE_REFUSED");
            return value;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static string SidInBuffer(IntPtr buffer, int size, IntPtr sid)
    {
        long relative = sid.ToInt64() - buffer.ToInt64();
        ControlRules.Need(relative >= 0 && relative <= size - 8, "CONTROL_TOKEN_SID_BOUNDS_REFUSED");
        int offset = checked((int)relative), count = Marshal.ReadByte(buffer, offset + 1);
        ControlRules.Need(Marshal.ReadByte(buffer, offset) == 1 && count <= 15 &&
            8 + count * 4 <= size - offset, "CONTROL_TOKEN_SID_SHAPE_REFUSED");
        byte[] bytes = new byte[8 + count * 4];
        Marshal.Copy(sid, bytes, 0, bytes.Length);
        return new SecurityIdentifier(bytes, 0).Value;
    }

    private delegate bool RestrictionQuery(IntPtr buffer, int capacity, out int written);
    private static bool ReadRestriction(RestrictionQuery query)
    {
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try {
            bool ok = query(buffer, 4, out int written);
            // This information class is one byte on the observed Windows host,
            // although its documented shape is DWORD. No default-false path.
            ControlRules.Need(ok && written is 1 or 4, "CONTROL_TOKEN_RESTRICTION_REFUSED");
            return written == 1 ? Marshal.ReadByte(buffer) != 0 : Marshal.ReadInt32(buffer) != 0;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    internal static int SelfTest()
    {
        int cases = 0;
        void Check(bool pass) { ControlRules.Need(pass, "CONTROL_IDENTITY_TEST_FAILED"); cases++; }
        void Reject(Action work) {
            try { work(); }
            catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("CONTROL_IDENTITY_REFUSAL_MISSING");
        }
        Check(DerivedServiceSid(ControlRole.Guardian) == ControlRules.GuardianSid);
        Check(DerivedServiceSid(ControlRole.Setup) != ControlRules.GuardianSid);
        Reject(() => ServiceName((ControlRole)999));
        Reject(() => DerivedServiceSid((ControlRole)(-1)));
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            string sid = DerivedServiceSid(role), expected = role == ControlRole.Setup ? "S-1-5-18" : sid;
            foreach (int count in new[] { -1, 0, 1, 2 })
            foreach (uint flags in new uint[] { 0, 4, 14, 16, 20 })
            foreach (bool rightUser in new[] { false, true })
            foreach (bool rightOwner in new[] { false, true })
            foreach (int type in new[] { 1, 2 }) {
                bool groupOk = count == 0 ? role == ControlRole.Guardian && flags == 0 : count == 1 && flags is 4 or 14;
                bool want = rightUser && rightOwner && type == 1 && groupOk;
                var token = new ControlTokenSnapshot(rightUser ? expected : "WRONG", rightOwner ? expected : "WRONG",
                    type, 1, sid, flags, count, false, true);
                if (want) { Validate(role, token); cases++; }
                else Reject(() => Validate(role, token));
            }
            var good = new ControlTokenSnapshot(expected, expected, 1, 1, sid, 4, 1, false, true);
            Validate(role, good with { Elevation = 0 }); cases++;
            foreach (var bad in new[] { good with { Restricted = true }, good with { QueryComplete = false },
                good with { ServiceSid = "S-1-5-18" }, good with { Elevation = -1 }, good with { Elevation = 2 } })
                Reject(() => Validate(role, bad));
            Reject(() => Validate(role, null));
        }
        foreach (int infoClass in new[] { 8, 20 }) {
            foreach (int value in infoClass == 8 ? new[] { 1, 2 } : new[] { 0, 1 }) {
                int calls = 0;
                int actual = ReadScalar(infoClass, (IntPtr p, int capacity, out int written) => {
                    ControlRules.Need(p != IntPtr.Zero && capacity == 4, "CONTROL_SCALAR_CAPACITY_FAILED");
                    calls++; Marshal.WriteInt32(p, value); written = 4; return true;
                });
                Check(actual == value && calls == 1);
            }
            foreach (bool success in new[] { false, true })
            foreach (int length in new[] { -1, 0, 1, 2, 3, 4, 5, int.MaxValue }) {
                if (success && length == 4) continue;
                int calls = 0;
                Reject(() => ReadScalar(infoClass, (IntPtr p, int capacity, out int written) => {
                    calls++; Marshal.WriteInt32(p, 1); written = length; return success;
                }));
                Check(calls == 1);
            }
            foreach (int value in new[] { int.MinValue, -1, int.MaxValue, 256, 65536, infoClass == 8 ? 0 : 2 })
                Reject(() => ReadScalar(infoClass, (IntPtr p, int capacity, out int written) => {
                    Marshal.WriteInt32(p, value); written = 4; return true;
                }));
            // Exercise every incomplete subset of the four output bytes even
            // when the provider claims success and the complete return length.
            for (int byteMask = 0; byteMask < 15; byteMask++)
                Reject(() => ReadScalar(infoClass, (IntPtr p, int capacity, out int written) => {
                    for (int index = 0; index < 4; index++)
                        if ((byteMask & (1 << index)) != 0)
                            Marshal.WriteByte(p, index, (byte)(index == 0 ? 1 : 0));
                    written = 4; return true;
                }));
        }
        foreach (int infoClass in new[] { -1, 0, 1, 2, 4, 7, 9, 19, 21, int.MaxValue }) {
            int calls = 0;
            Reject(() => ReadScalar(infoClass, (IntPtr p, int capacity, out int written) => {
                calls++; Marshal.WriteInt32(p, 1); written = 4; return true;
            }));
            Check(calls == 0);
        }
        foreach (int length in new[] { 1, 4 })
        foreach (uint value in new uint[] { 0, 1, 2, 128, 255 }) {
            Check(ReadRestriction((IntPtr p, int capacity, out int written) => {
                ControlRules.Need(capacity == 4, "CONTROL_RESTRICTION_CAPACITY_FAILED");
                Marshal.WriteInt32(p, unchecked((int)0xaaaaaaaa));
                if (length == 1) Marshal.WriteByte(p, (byte)value); else Marshal.WriteInt32(p, (int)value);
                written = length; return true;
            }) == (value != 0));
        }
        foreach (uint value in new uint[] { 256, 65536, 0x80000000 })
            Check(ReadRestriction((IntPtr p, int capacity, out int written) => {
                Marshal.WriteInt32(p, unchecked((int)value)); written = 4; return true;
            }));
        foreach (bool success in new[] { false, true })
        foreach (int length in new[] { -1, 0, 1, 2, 3, 4, 5, int.MaxValue }) {
            if (success && length is 1 or 4) continue;
            Reject(() => ReadRestriction((IntPtr p, int capacity, out int written) => {
                written = length; return success;
            }));
        }
        Check(BootDigest(1) == ControlRules.Hash(new byte[] { 1, 0, 0, 0, 0, 0, 0, 0 }));
        Reject(() => BootDigest(0)); Reject(() => BootDigest(-1));
        return cases;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SidAndAttributes { internal IntPtr Sid; internal uint Attributes; }
    [DllImport("kernel32.dll", ExactSpelling = true)] private static extern IntPtr GetCurrentProcess();
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(IntPtr process, uint access, out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token, int infoClass, IntPtr buffer, int size, out int written);
    [DllImport("ntdll.dll", ExactSpelling = true)]
    private static extern int NtQuerySystemInformation(int infoClass, IntPtr buffer, int length, out int written);
}
