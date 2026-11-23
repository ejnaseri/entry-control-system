using System;
using System.Buffers.Binary;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
#if COMPILE_ONLY_STANDARD_PEER_OBJECT_NATIVE_V1
using System.ComponentModel;
using System.Diagnostics;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
#endif

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardPeerTokenStatistics(ulong TokenId, ulong AuthenticationId,
    ulong ModifiedId, int TokenType, uint GroupCount, uint PrivilegeCount);
internal sealed record StandardPeerProcess(uint ProcessId, long CreationFileTimeUtc, string ImagePath);
internal sealed record StandardPeerObjectObservation(StandardPeerProcess Process, StandardToken Token,
    StandardPeerTokenStatistics Statistics, uint ProcessGrantedAccess, uint TokenGrantedAccess)
{
    // Reading two real kernel objects does not prove that this token is the
    // current primary token of this process. A future trusted owner's actual
    // OpenProcessToken + transfer round-trip association must establish that.
    public bool ProcessTokenAssociationEstablished => false;
    public bool LoadedCodeEstablished => false;
    public bool BootstrapAuthorized => false;
    public bool NativeExecutionAccepted => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

internal static class StandardPeerObjectRules
{
    internal const uint ProcessReadSynchronize = 0x00101000, TokenQuery = 8;
    internal const int StatisticsSize = 56, ObjectBasicSize = 56, ObjectMaximum = 65536;
    internal static void Handles(long process, long token) => StandardContract.Need(process > 0 && token > 0 && process != token,
        "STANDARD_PEER_REAL_DISTINCT_HANDLES_REQUIRED");
    internal static uint Basic(byte[]? bytes, string kind)
    {
        StandardContract.Need(bytes is { Length: ObjectBasicSize } && kind is "Process" or "Token", "STANDARD_PEER_OBJECT_BASIC_REFUSED");
        uint access = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(4));
        StandardContract.Need(access == (kind == "Process" ? ProcessReadSynchronize : TokenQuery), "STANDARD_PEER_OBJECT_RIGHTS_REFUSED");
        return access;
    }
    internal static void HandleFlags(uint flags) => StandardContract.Need(flags == 0, "STANDARD_PEER_INHERIT_OR_PROTECT_REFUSED");
    internal static string TypeName(IntPtr buffer, int written, string expected)
    {
        StandardContract.Need(IntPtr.Size == 8 && buffer != IntPtr.Zero && written is >= 16 and <= ObjectMaximum &&
            expected is "Process" or "Token", "STANDARD_PEER_OBJECT_TYPE_BUFFER_REFUSED");
        int length = unchecked((ushort)Marshal.ReadInt16(buffer)), maximum = unchecked((ushort)Marshal.ReadInt16(buffer, 2));
        IntPtr value = Marshal.ReadIntPtr(buffer, 8); long offset;
        try { offset = checked(value.ToInt64() - buffer.ToInt64()); }
        catch (OverflowException) { throw new InvalidDataException("STANDARD_PEER_OBJECT_TYPE_POINTER_REFUSED"); }
        StandardContract.Need(length == expected.Length * 2 && maximum >= length && maximum <= ObjectMaximum &&
            offset >= 16 && offset <= written - length && maximum <= written - offset,
            "STANDARD_PEER_OBJECT_TYPE_BOUNDS_REFUSED");
        byte[] bytes = new byte[length]; Marshal.Copy(value, bytes, 0, length);
        string name = new UnicodeEncoding(false, false, true).GetString(bytes);
        StandardContract.Need(name == expected, "STANDARD_PEER_OBJECT_TYPE_REFUSED"); return name;
    }
    internal static StandardPeerTokenStatistics Statistics(byte[]? bytes)
    {
        StandardContract.Need(bytes is { Length: StatisticsSize }, "STANDARD_PEER_STATISTICS_SIZE_REFUSED");
        ulong token = BinaryPrimitives.ReadUInt64LittleEndian(bytes), authentication = BinaryPrimitives.ReadUInt64LittleEndian(bytes.AsSpan(8)),
            modified = BinaryPrimitives.ReadUInt64LittleEndian(bytes.AsSpan(48));
        int type = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(24));
        uint groups = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(40)), privileges = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(44));
        StandardContract.Need(token != 0 && authentication != 0 && modified != 0 && type is 1 or 2 && groups <= 1024 && privileges <= 1024,
            "STANDARD_PEER_STATISTICS_VALUE_REFUSED");
        if (type == 2) StandardContract.Need(BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(28)) is >= 0 and <= 3,
            "STANDARD_PEER_IMPERSONATION_LEVEL_REFUSED");
        return new(token, authentication, modified, type, groups, privileges);
    }
    internal static void Stable(StandardPeerTokenStatistics before, StandardPeerTokenStatistics after, StandardToken actual)
    {
        StandardContract.Need(before is not null && after is not null && actual is not null && before == after &&
            before.TokenType == actual.Type && actual.Groups is not null && before.GroupCount == actual.Groups.Count,
            "STANDARD_PEER_TOKEN_CHANGED_OR_INCOMPLETE");
    }
}

#if COMPILE_ONLY_STANDARD_PEER_OBJECT_NATIVE_V1
// Read-only observations only. No transfer/adoption, handle ownership change,
// process opening, impersonation, grant, account/SCM/CNG effect or CLI is here.
internal static class StandardNativePeerObjectReader
{
    private static void Gate(StandardCryptoScope scope, StandardCryptoStage localStage, bool localOwner, Action custody)
    {
        StandardStoreRules.Scope(scope, DateTimeOffset.UtcNow);
        StandardContract.Need(OperatingSystem.IsWindows() && RuntimeInformation.OSArchitecture == Architecture.X64 &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 && Environment.Version.ToString() == "10.0.11",
            "STANDARD_PEER_RUNTIME_REFUSED");
        void Current() {
            using var thread = WindowsIdentity.GetCurrent(true);
            StandardContract.Need(thread is null, "STANDARD_PEER_IMPERSONATION_REFUSED");
            using var current = Process.GetCurrentProcess(); var token = StandardTokenReader.Capture(current.SafeHandle).Token;
            if (localOwner) StandardWorkerChannelRules.OwnerToken(token); else StandardWorkerChannelRules.WorkerToken(localStage, token);
        }
        Current(); custody(); StandardStoreRules.Scope(scope, DateTimeOffset.UtcNow); Current();
        StandardStoreRules.Scope(scope, DateTimeOffset.UtcNow);
    }
    private static void Nt(int status, string stage) {
        if (status != 0) throw new StandardPeerObjectNativeException(stage, status);
    }
    private static void Object(IntPtr handle, string expected)
    {
        if (!GetHandleInformation(handle, out uint flags)) throw new Win32Exception(Marshal.GetLastWin32Error());
        StandardPeerObjectRules.HandleFlags(flags);
        IntPtr basic = Marshal.AllocHGlobal(StandardPeerObjectRules.ObjectBasicSize);
        try {
            // No unwritten/default access bits can become successful evidence.
            Marshal.Copy(new byte[StandardPeerObjectRules.ObjectBasicSize], 0, basic, StandardPeerObjectRules.ObjectBasicSize);
            Nt(NtQueryObject(handle, 0, basic, StandardPeerObjectRules.ObjectBasicSize, out int written), "OBJECT_BASIC");
            StandardContract.Need(written == StandardPeerObjectRules.ObjectBasicSize, "STANDARD_PEER_OBJECT_BASIC_LENGTH_REFUSED");
            byte[] bytes = new byte[written]; Marshal.Copy(basic, bytes, 0, written); StandardPeerObjectRules.Basic(bytes, expected);
        } finally { Marshal.FreeHGlobal(basic); }
        int status = NtQueryObject(handle, 2, IntPtr.Zero, 0, out int required);
        if (status is not (unchecked((int)0xc0000004) or unchecked((int)0xc0000023)))
            throw new StandardPeerObjectNativeException("OBJECT_TYPE_SIZE", status);
        StandardContract.Need(required is >= 16 and <= StandardPeerObjectRules.ObjectMaximum, "STANDARD_PEER_OBJECT_TYPE_SIZE_REFUSED");
        IntPtr type = Marshal.AllocHGlobal(required);
        try {
            Marshal.Copy(new byte[required], 0, type, required);
            Nt(NtQueryObject(handle, 2, type, required, out int written), "OBJECT_TYPE");
            StandardContract.Need(written is >= 16 && written <= required, "STANDARD_PEER_OBJECT_TYPE_LENGTH_REFUSED");
            StandardPeerObjectRules.TypeName(type, written, expected);
        } finally { Marshal.FreeHGlobal(type); }
    }
    private static T Info<T>(SafeAccessTokenHandle token, int kind, int minimum, Func<IntPtr, int, T> parse)
    {
        bool first = GetTokenInformation(token, kind, IntPtr.Zero, 0, out int required); int error = Marshal.GetLastWin32Error();
        StandardContract.Need(!first && error == 122 && required >= minimum && required <= 1048576, "STANDARD_PEER_TOKEN_SIZE_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(required);
        try {
            Marshal.Copy(new byte[required], 0, buffer, required);
            if (!GetTokenInformation(token, kind, buffer, required, out int written)) throw new Win32Exception(Marshal.GetLastWin32Error());
            StandardContract.Need(written >= minimum && written <= required, "STANDARD_PEER_TOKEN_LENGTH_REFUSED"); return parse(buffer, written);
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    private static StandardPeerTokenStatistics Statistics(SafeAccessTokenHandle token) => Info(token, 10, 56, (buffer, written) => {
        StandardContract.Need(written == 56, "STANDARD_PEER_STATISTICS_NATIVE_LENGTH_REFUSED");
        byte[] bytes = new byte[56]; Marshal.Copy(buffer, bytes, 0, bytes.Length); return StandardPeerObjectRules.Statistics(bytes);
    });
    private static StandardToken Token(SafeAccessTokenHandle token)
    {
        int Scalar(int kind) => StandardTokenReader.ReadScalar(kind, (IntPtr p, int n, out int written) => {
            if (!GetTokenInformation(token, kind, p, n, out written)) throw new Win32Exception(Marshal.GetLastWin32Error()); return true;
        });
        string user = Info(token, 1, 16, (p, n) => StandardTokenReader.SidInBuffer(p, n, Marshal.ReadIntPtr(p), 16));
        string owner = Info(token, 4, 8, (p, n) => StandardTokenReader.SidInBuffer(p, n, Marshal.ReadIntPtr(p), 8));
        bool restrictions = StandardTokenReader.ReadRestrictions((IntPtr p, int n, out int written) => {
            if (!GetTokenInformation(token, 21, p, n, out written)) throw new Win32Exception(Marshal.GetLastWin32Error()); return true;
        });
        string integrity = Info(token, 25, 16, (p, n) => StandardTokenReader.SidInBuffer(p, n, Marshal.ReadIntPtr(p), 16));
        var groups = Info(token, 2, 8, StandardTokenReader.GroupsInBuffer);
        return new(user, owner, Scalar(8), Scalar(20), Scalar(18), integrity, restrictions, Scalar(29) != 0, true, groups);
    }
    private static StandardPeerProcess ProcessObservation(SafeProcessHandle process)
    {
        uint id = GetProcessId(process); if (id == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        if (!GetProcessTimes(process, out long created, out _, out _, out _)) throw new Win32Exception(Marshal.GetLastWin32Error());
        var image = new StringBuilder(32768); int capacity = image.Capacity;
        if (!QueryFullProcessImageNameW(process, 0, image, ref capacity)) throw new Win32Exception(Marshal.GetLastWin32Error());
        StandardContract.Need(created > 0 && capacity is > 0 and < 32768 && image.Length == capacity,
            "STANDARD_PEER_PROCESS_READBACK_REFUSED"); return new(id, created, image.ToString());
    }
    internal static StandardPeerObjectObservation ObserveBorrowedOwnerObjects(SafeProcessHandle process,
        SafeAccessTokenHandle token, StandardCryptoScope scope, StandardCryptoStage localStage, bool localOwner, Action verifyCustody)
    {
        ArgumentNullException.ThrowIfNull(verifyCustody); Gate(scope, localStage, localOwner, verifyCustody);
        StandardContract.Need(process is not null && token is not null && !process.IsClosed && !token.IsClosed,
            "STANDARD_PEER_HANDLES_CLOSED"); bool processHeld = false, tokenHeld = false;
        try {
            process.DangerousAddRef(ref processHeld); token.DangerousAddRef(ref tokenHeld);
            IntPtr rawProcess = process.DangerousGetHandle(), rawToken = token.DangerousGetHandle();
            StandardPeerObjectRules.Handles(rawProcess.ToInt64(), rawToken.ToInt64());
            Object(rawProcess, "Process"); Object(rawToken, "Token");
            uint wait = WaitForSingleObject(process, 0); if (wait == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
            StandardContract.Need(wait == 258, "STANDARD_PEER_OWNER_EXITED");
            var beforeProcess = ProcessObservation(process); var beforeToken = Statistics(token); var captured = Token(token); var afterToken = Statistics(token);
            StandardPeerObjectRules.Stable(beforeToken, afterToken, captured); StandardWorkerChannelRules.OwnerToken(captured);
            StandardContract.Need(beforeProcess.ImagePath == StandardLaunchPlan.Image &&
                StandardStoreRules.CreatedInWindow(beforeProcess.CreationFileTimeUtc, scope, DateTimeOffset.UtcNow), "STANDARD_PEER_OWNER_PROCESS_REFUSED");
            Gate(scope, localStage, localOwner, verifyCustody); Object(rawProcess, "Process"); Object(rawToken, "Token");
            StandardContract.Need(beforeProcess == ProcessObservation(process) && beforeToken == Statistics(token), "STANDARD_PEER_OBJECT_CHANGED");
            wait = WaitForSingleObject(process, 0); if (wait == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
            StandardContract.Need(wait == 258, "STANDARD_PEER_OWNER_EXITED");
            return new(beforeProcess, captured, beforeToken, StandardPeerObjectRules.ProcessReadSynchronize, StandardPeerObjectRules.TokenQuery);
        } finally {
            if (tokenHeld) token.DangerousRelease(); if (processHeld) process.DangerousRelease();
        }
    }
    [DllImport("ntdll.dll", ExactSpelling = true)] private static extern int NtQueryObject(IntPtr handle, int kind, IntPtr output, int capacity, out int written);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetHandleInformation(IntPtr handle, out uint flags);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token, int kind, IntPtr output, int capacity, out int written);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint GetProcessId(SafeProcessHandle process);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetProcessTimes(SafeProcessHandle process, out long created, out long exit, out long kernel, out long user);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool QueryFullProcessImageNameW(SafeProcessHandle process, uint flags, StringBuilder image, ref int capacity);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(SafeProcessHandle process, uint milliseconds);
}
internal sealed class StandardPeerObjectNativeException : Exception
{
    internal string NativeStage { get; }
    internal int NativeStatus { get; }
    internal StandardPeerObjectNativeException(string stage, int status) : base("STANDARD_PEER_NATIVE_READ_REFUSED") { NativeStage = stage; NativeStatus = status; }
}
#endif
