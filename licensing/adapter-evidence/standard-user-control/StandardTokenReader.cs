using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardUserControl;

// Read-only codec. No account enable/logon, process creation/resume/termination,
// SCM, CNG, credential or protected-store operation is implemented here.
internal static class StandardTokenReader
{
    internal delegate bool Query(IntPtr buffer, int capacity, out int written);

    internal static int ReadScalar(int kind, Query query)
    {
        // winnt.h: 27 is TokenMandatoryPolicy, NOT TokenIsAppContainer(29).
        StandardContract.Need(kind is 8 or 18 or 20 or 29, "STANDARD_SCALAR_KIND_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteInt32(buffer, int.MinValue);
            bool success = query(buffer, 4, out int written);
            StandardContract.Need(success && written == 4, "STANDARD_SCALAR_READ_REFUSED");
            int value = Marshal.ReadInt32(buffer);
            bool valid = kind switch { 8 => value is 1 or 2, 18 => value is 1 or 2 or 3,
                _ => value is 0 or 1 };
            StandardContract.Need(valid, "STANDARD_SCALAR_VALUE_REFUSED");
            return value;
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    internal static bool ReadRestrictions(Query query)
    {
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteInt32(buffer, -1);
            bool success = query(buffer, 4, out int written);
            // Windows on this host has returned a one-byte HasRestrictions.
            // Accept only a complete byte or DWORD BOOL, never an unwritten 0.
            StandardContract.Need(success && written is 1 or 4, "STANDARD_RESTRICTION_READ_REFUSED");
            int value = written == 1 ? Marshal.ReadByte(buffer) : Marshal.ReadInt32(buffer);
            StandardContract.Need(value is 0 or 1, "STANDARD_RESTRICTION_VALUE_REFUSED");
            return value != 0;
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    internal static string SidInBuffer(IntPtr buffer, int size, IntPtr sid, int minimum)
    {
        StandardContract.Need(buffer != IntPtr.Zero && size >= 8 && minimum >= 0 && minimum <= size - 8,
            "STANDARD_SID_BUFFER_REFUSED");
        long relative;
        try { relative = checked(sid.ToInt64() - buffer.ToInt64()); }
        catch (OverflowException) { throw new InvalidDataException("STANDARD_SID_POINTER_REFUSED"); }
        StandardContract.Need(relative >= minimum && relative <= size - 8, "STANDARD_SID_POINTER_REFUSED");
        int offset = checked((int)relative);
        int count = Marshal.ReadByte(buffer, offset + 1);
        StandardContract.Need(Marshal.ReadByte(buffer, offset) == 1 && count <= 15 &&
            8 + count * 4 <= size - offset, "STANDARD_SID_BYTES_REFUSED");
        byte[] bytes = new byte[8 + count * 4];
        Marshal.Copy(sid, bytes, 0, bytes.Length);
        string value = new SecurityIdentifier(bytes, 0).Value;
        StandardContract.Need(StandardIdentity.CanonicalSid(value), "STANDARD_SID_CANONICAL_REFUSED");
        return value;
    }

    internal static IReadOnlyList<StandardGroup> GroupsInBuffer(IntPtr buffer, int size)
    {
        StandardContract.Need(buffer != IntPtr.Zero && IntPtr.Size == 8 && size >= 8,
            "STANDARD_GROUP_BUFFER_REFUSED");
        int count = Marshal.ReadInt32(buffer);
        const int header = 8, stride = 16;
        StandardContract.Need(count is >= 0 and <= 1024 && count <= (size - header) / stride,
            "STANDARD_GROUP_TABLE_REFUSED");
        int minimum = checked(header + count * stride);
        var groups = new List<StandardGroup>(count);
        for (int i = 0; i < count; i++) {
            int offset = header + i * stride;
            IntPtr sid = Marshal.ReadIntPtr(buffer, offset);
            uint attributes = unchecked((uint)Marshal.ReadInt32(buffer, offset + 8));
            groups.Add(new(SidInBuffer(buffer, size, sid, minimum), attributes));
        }
        return groups.AsReadOnly();
    }

    private static void RequireRuntime() => StandardContract.Need(
        RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
        RuntimeInformation.OSArchitecture == Architecture.X64 &&
        RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
        Environment.Version.ToString() == "10.0.11", "STANDARD_TOKEN_RUNTIME_REFUSED");

    private static void RejectThreadImpersonation()
    {
        using var thread = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(thread is null, "STANDARD_CAPTURE_IMPERSONATION_REFUSED");
    }

    private static T Info<T>(SafeAccessTokenHandle token, int kind, int minimum, Func<IntPtr, int, T> parse)
    {
        bool first = GetTokenInformation(token, kind, IntPtr.Zero, 0, out int required);
        int error = Marshal.GetLastWin32Error();
        StandardContract.Need(!first && error == 122 && required >= minimum && required <= 1048576,
            "STANDARD_TOKEN_SIZE_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(required);
        try {
            if (!GetTokenInformation(token, kind, buffer, required, out int written))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            StandardContract.Need(written >= minimum && written <= required, "STANDARD_TOKEN_LENGTH_REFUSED");
            return parse(buffer, written);
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    private static bool NativeQuery(SafeAccessTokenHandle token, int kind, IntPtr buffer, int capacity, out int written)
    {
        bool success = GetTokenInformation(token, kind, buffer, capacity, out written);
        if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
        return true;
    }

    internal static StandardProcessToken Capture(SafeProcessHandle process)
    {
        RequireRuntime(); RejectThreadImpersonation();
        StandardContract.Need(process is not null && !process.IsClosed && !process.IsInvalid,
            "STANDARD_PROCESS_HANDLE_REFUSED");
        uint pid = GetProcessId(process);
        StandardContract.Need(pid > 0, "STANDARD_PROCESS_ID_REFUSED");
        if (!GetProcessTimes(process, out long created, out _, out _, out _))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        StandardContract.Need(created > 0, "STANDARD_PROCESS_START_REFUSED");
        var image = new StringBuilder(32768); int capacity = image.Capacity;
        if (!QueryFullProcessImageNameW(process, 0, image, ref capacity))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        StandardContract.Need(capacity > 0 && capacity < image.Capacity && image.Length == capacity,
            "STANDARD_PROCESS_IMAGE_REFUSED");
        if (!OpenProcessToken(process, 8, out var token)) {
            int error = Marshal.GetLastWin32Error(); token?.Dispose(); throw new Win32Exception(error);
        }
        using (token) {
            string user = Info(token, 1, 16, (p, n) => SidInBuffer(p, n, Marshal.ReadIntPtr(p), 16));
            string owner = Info(token, 4, 8, (p, n) => SidInBuffer(p, n, Marshal.ReadIntPtr(p), 8));
            int Scalar(int kind) => ReadScalar(kind, (IntPtr p, int n, out int written) => NativeQuery(token, kind, p, n, out written));
            int type = Scalar(8), elevationType = Scalar(18), elevation = Scalar(20), appContainer = Scalar(29);
            bool restricted = ReadRestrictions((IntPtr p, int n, out int written) => NativeQuery(token, 21, p, n, out written));
            string integrity = Info(token, 25, 16, (p, n) => SidInBuffer(p, n, Marshal.ReadIntPtr(p), 16));
            var groups = Info(token, 2, 8, GroupsInBuffer);
            RejectThreadImpersonation();
            return new(pid, created, image.ToString(), new(user, owner, type, elevation, elevationType,
                integrity, restricted, appContainer != 0, true, groups));
        }
    }

    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(SafeProcessHandle process, uint access, out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token, int kind, IntPtr buffer, int capacity, out int written);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint GetProcessId(SafeProcessHandle process);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetProcessTimes(SafeProcessHandle process, out long created, out long exited, out long kernel, out long user);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryFullProcessImageNameW(SafeProcessHandle process, uint flags, StringBuilder image, ref int length);
}
