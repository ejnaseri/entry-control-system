using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardNativeHost;

// A one-use feasibility diagnostic in ignored out/, never a W03 admission or
// protected-root runner. No caller-selected path, account, service or key API.
[SupportedOSPlatform("windows")]
internal static class NativeHostOwnerGroupProbeV1
{
    private const string OutRoot = @"E:\EntryControlSystem\out";
    private const string OwnerSid = "S-1-5-21-3058020570-171625005-1532683838-1001";
    private const string SystemSid = "S-1-5-18";
    private const string ChildLeaf = "owner-group-exact.bin";
    private const string SourceLeaf = "NativeHostOwnerGroupProbeV1.cs";
    private const string Schema = "TEST_ONLY_LIC008_OWNER_GROUP_FEASIBILITY_V1";
    private const uint ReadControl = 0x00020000;
    private const uint Synchronize = 0x00100000;
    private const uint Traverse = 0x00000020;
    private const uint ReadAttributes = 0x00000080;
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint FileAttributeNormal = 0x00000080;
    private const uint FileCreate = 2;
    private const uint ShareRead = 1;
    private const uint OpenReparsePoint = 0x00200000;
    private const uint SynchronousIoNonalert = 0x00000020;
    private const uint NonDirectoryFile = 0x00000040;
    private const uint WriteThrough = 0x00000002;
    private const uint BackupSemantics = 0x02000000;
    private const uint ObjCaseInsensitive = 0x00000040;
    private const int FileIdInfoClass = 18;
    private const int FileAllAccess = 0x001f01ff;
    private const int ErrorNoToken = 1008;
    private const int ErrorInsufficientBuffer = 122;
    private static readonly byte[] FixedContent = Encoding.ASCII.GetBytes(
        "LIC008_OWNER_GROUP_PROBE_V1\n");
    private static readonly List<SafeFileHandle> RetainedHandles = new();

    private sealed class Report
    {
        public string Schema { get; set; } = NativeHostOwnerGroupProbeV1.Schema;
        public string Status { get; set; } = "INCOMPLETE";
        public string SourceSha256 { get; set; } = "";
        public string AttemptDirectory { get; set; } = "";
        public string ProbeFile { get; set; } = "";
        public string TokenUserSid { get; set; } = "";
        public string TokenOwnerSid { get; set; } = "";
        public string TokenPrimaryGroupSid { get; set; } = "";
        public string RequestedSddl { get; set; } = "";
        public string? RequestedDescriptorSha256 { get; set; }
        public string? NtStatus { get; set; }
        public ulong? IoInformation { get; set; }
        public string? ParentFileId128 { get; set; }
        public string? ChildFileId128 { get; set; }
        public string? VolumeSerial64 { get; set; }
        public string? ObservedOwnerSid { get; set; }
        public string? ObservedGroupSid { get; set; }
        public string? ObservedDescriptorBase64 { get; set; }
        public string? ObservedDescriptorSha256 { get; set; }
        public string? ContentSha256 { get; set; }
        public string? ErrorCode { get; set; }
        public bool AccountChanged { get; set; }
        public bool ServiceChanged { get; set; }
        public bool KeyChanged { get; set; }
        public bool W03Admitted { get; set; }
        public bool Lic008Closed { get; set; }
    }

    private sealed record Identity(ulong VolumeSerial, string FileId128);

    internal static int Main(string[] args)
    {
        if (args.Length != 3 || args[0] != "--probe" ||
            args[1] != "--reviewed-source-sha256" ||
            !Regex.IsMatch(args[2], "\\A[0-9a-f]{64}\\z", RegexOptions.CultureInvariant)) {
            Console.Error.WriteLine("OWNER_GROUP_PROBE_V1_ENTRY_CLOSED");
            return 2;
        }
        string attempt = "";
        bool intentWritten = false;
        var report = new Report { SourceSha256 = args[2] };
        try {
            attempt = ExactAttemptDirectory();
            report.AttemptDirectory = attempt;
            report.ProbeFile = Path.Combine(attempt, ChildLeaf);
            string source = Path.Combine(attempt, SourceLeaf);
            FileInfo sourceInfo = new(source);
            Need(sourceInfo.Exists && sourceInfo.Length is > 0 and <= 1048576 &&
                (sourceInfo.Attributes & FileAttributes.ReparsePoint) == 0 &&
                Hash(File.ReadAllBytes(source)) == args[2],
                "OWNER_GROUP_PROBE_V1_SOURCE_CHANGED");
            SaveNew(Path.Combine(attempt, "probe-intent.json"), new {
                schema = Schema, status = "CONSUMED_BEFORE_NATIVE_CALL",
                sourceSha256 = args[2], attemptDirectory = attempt,
                exactChild = ChildLeaf, fixedContentSha256 = Hash(FixedContent),
                requestedSddl = Sddl(), utc = DateTimeOffset.UtcNow,
                noRetry = true, noDelete = true, w03Admission = false
            });
            intentWritten = true;
            Probe(attempt, report);
            report.Status = "FEASIBILITY_OBSERVED";
            SaveNew(Path.Combine(attempt, "probe-result.json"), report);
            Console.Out.WriteLine("OWNER_GROUP_PROBE_V1_FEASIBILITY_OBSERVED");
            return 0;
        } catch (Exception e) {
            report.Status = "REFUSED_OR_UNKNOWN";
            report.ErrorCode = e is InvalidDataException ? e.Message : e.GetType().Name;
            if (intentWritten) {
                try { SaveNew(Path.Combine(attempt, "probe-result.json"), report); }
                catch { /* Preserve intent and any partial file; no retry. */ }
            }
            Console.Error.WriteLine("OWNER_GROUP_PROBE_V1_REFUSED_OR_UNKNOWN");
            return 1;
        }
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }

    private static string Hash(byte[] raw) =>
        Convert.ToHexStringLower(SHA256.HashData(raw));

    private static void SaveNew(string path, object value)
    {
        byte[] raw = JsonSerializer.SerializeToUtf8Bytes(value, value.GetType());
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write,
            FileShare.Read, 4096, FileOptions.WriteThrough);
        stream.Write(raw);
        stream.Flush(true);
    }

    private static string ExactAttemptDirectory()
    {
        Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            RuntimeInformation.OSArchitecture == Architecture.X64,
            "OWNER_GROUP_PROBE_V1_PLATFORM_REFUSED");
        DirectoryInfo binary = new(Path.GetFullPath(AppContext.BaseDirectory));
        DirectoryInfo? release = binary.Parent;
        DirectoryInfo? bin = release?.Parent;
        DirectoryInfo? attempt = bin?.Parent;
        Need(binary.Name == "net10.0" && release?.Name == "Release" &&
            bin?.Name == "bin", "OWNER_GROUP_PROBE_V1_BINARY_LOCATION_REFUSED");
        Need(attempt is not null && attempt.Parent is not null &&
            attempt.Parent.FullName.Equals(OutRoot, StringComparison.OrdinalIgnoreCase) &&
            Regex.IsMatch(attempt.Name,
                "\\Alic008-owner-group-probe-v1-[0-9a-f]{32}\\z",
                RegexOptions.CultureInvariant),
            "OWNER_GROUP_PROBE_V1_ATTEMPT_LOCATION_REFUSED");
        for (DirectoryInfo? cursor = binary; cursor is not null; cursor = cursor.Parent) {
            Need((cursor.Attributes & FileAttributes.ReparsePoint) == 0,
                "OWNER_GROUP_PROBE_V1_REPARSE_REFUSED");
        }
        return attempt.FullName;
    }

    private static string Sddl() => "O:" + OwnerSid + "G:" + OwnerSid +
        "D:P(A;;FA;;;SY)(A;;FA;;;" + OwnerSid + ")";

    private static byte[] Descriptor()
    {
        RawSecurityDescriptor descriptor = new(Sddl());
        byte[] raw = new byte[descriptor.BinaryLength];
        descriptor.GetBinaryForm(raw, 0);
        ValidateDescriptor(raw);
        return raw;
    }

    private static (string Owner, string Group) ValidateDescriptor(byte[] raw)
    {
        Need(raw.Length is >= 20 and <= 65536,
            "OWNER_GROUP_PROBE_V1_DESCRIPTOR_LENGTH_REFUSED");
        RawSecurityDescriptor descriptor = new(raw, 0);
        RawAcl? acl = descriptor.DiscretionaryAcl;
        Need(descriptor.Owner?.Value == OwnerSid && descriptor.Group?.Value == OwnerSid &&
            descriptor.SystemAcl is null &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclPresent) &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) &&
            acl is { Count: 2 }, "OWNER_GROUP_PROBE_V1_DESCRIPTOR_HEADER_REFUSED");
        var expected = new HashSet<string>(StringComparer.Ordinal) { OwnerSid, SystemSid };
        foreach (GenericAce ace in acl) {
            Need(ace is CommonAce common && common.AceType == AceType.AccessAllowed &&
                common.AceFlags == AceFlags.None && common.AccessMask == FileAllAccess &&
                expected.Remove(common.SecurityIdentifier.Value),
                "OWNER_GROUP_PROBE_V1_DESCRIPTOR_ACE_REFUSED");
        }
        Need(expected.Count == 0, "OWNER_GROUP_PROBE_V1_DESCRIPTOR_MISSING_ACE");
        return (descriptor.Owner!.Value, descriptor.Group!.Value);
    }

    private static void NoImpersonation()
    {
        bool opened = OpenThreadToken(GetCurrentThread(), 0x00000008, true,
            out SafeAccessTokenHandle token);
        int error = Marshal.GetLastWin32Error();
        if (opened) {
            token.Dispose();
            throw new InvalidDataException("OWNER_GROUP_PROBE_V1_IMPERSONATION_REFUSED");
        }
        token?.Dispose();
        Need(error == ErrorNoToken, "OWNER_GROUP_PROBE_V1_THREAD_TOKEN_UNKNOWN");
    }

    private static string TokenSid(SafeAccessTokenHandle token, int informationClass)
    {
        bool first = GetTokenInformation(token, informationClass, IntPtr.Zero, 0,
            out uint length);
        int error = Marshal.GetLastWin32Error();
        Need(!first && error == ErrorInsufficientBuffer &&
            length >= IntPtr.Size && length <= 65536,
            "OWNER_GROUP_PROBE_V1_TOKEN_LENGTH_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(checked((int)length));
        try {
            Need(GetTokenInformation(token, informationClass, buffer, length,
                out uint written) && written >= IntPtr.Size && written <= length,
                "OWNER_GROUP_PROBE_V1_TOKEN_QUERY_REFUSED");
            IntPtr sid = Marshal.ReadIntPtr(buffer);
            Need(sid != IntPtr.Zero,
                "OWNER_GROUP_PROBE_V1_TOKEN_SID_REFUSED");
            return new SecurityIdentifier(sid).Value;
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    private static void Probe(string attempt, Report report)
    {
        NoImpersonation();
        Need(OpenProcessToken(GetCurrentProcess(), 0x00000008,
            out SafeAccessTokenHandle token) && token is not null && !token.IsInvalid,
            "OWNER_GROUP_PROBE_V1_TOKEN_OPEN_REFUSED");
        using (token) {
            report.TokenUserSid = TokenSid(token, 1);
            report.TokenOwnerSid = TokenSid(token, 4);
            report.TokenPrimaryGroupSid = TokenSid(token, 5);
        }
        Need(report.TokenUserSid == OwnerSid,
            "OWNER_GROUP_PROBE_V1_USER_SID_REFUSED");
        report.RequestedSddl = Sddl();
        byte[] descriptor = Descriptor();
        report.RequestedDescriptorSha256 = Hash(descriptor);
        NoImpersonation();
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        SafeFileHandle parent = CreateFileW(attempt,
            ReadControl | Synchronize | Traverse | ReadAttributes,
            ShareRead, ref attributes, 3, BackupSemantics | OpenReparsePoint,
            IntPtr.Zero);
        if (parent is not null) RetainedHandles.Add(parent);
        Need(parent is not null && !parent.IsInvalid,
            "OWNER_GROUP_PROBE_V1_PARENT_OPEN_REFUSED");
        Identity parentId = Inspect(parent, attempt, true);
        report.ParentFileId128 = parentId.FileId128;

        bool parentRef = false;
        IntPtr name = IntPtr.Zero;
        IntPtr unicode = IntPtr.Zero;
        GCHandle pin = default;
        try {
            parent.DangerousAddRef(ref parentRef);
            name = Marshal.StringToHGlobalUni(ChildLeaf);
            UnicodeName text = new() {
                Length = checked((ushort)(ChildLeaf.Length * 2)),
                MaximumLength = checked((ushort)((ChildLeaf.Length + 1) * 2)),
                Buffer = name
            };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(text, unicode, false);
            pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
            ObjectAttributes objectAttributes = new() {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.DangerousGetHandle(), Name = unicode,
                Flags = ObjCaseInsensitive, SecurityDescriptor = pin.AddrOfPinnedObject()
            };
            NoImpersonation();
            int status = NtCreateFile(out SafeFileHandle child,
                GenericRead | GenericWrite | ReadControl | Synchronize | ReadAttributes,
                ref objectAttributes, out IoStatus io, IntPtr.Zero,
                FileAttributeNormal, 0, FileCreate,
                OpenReparsePoint | SynchronousIoNonalert | NonDirectoryFile | WriteThrough,
                IntPtr.Zero, 0);
            if (child is not null) RetainedHandles.Add(child);
            report.NtStatus = "0x" + unchecked((uint)status).ToString("x8");
            report.IoInformation = io.Information.ToUInt64();
            Need(status == 0 && child is not null && !child.IsInvalid &&
                io.Information.ToUInt64() == 2,
                "OWNER_GROUP_PROBE_V1_NATIVE_CREATE_REFUSED_OR_UNKNOWN");
            Identity childId = Inspect(child, Path.Combine(attempt, ChildLeaf), false);
            Need(childId.VolumeSerial == parentId.VolumeSerial &&
                childId.FileId128 != parentId.FileId128,
                "OWNER_GROUP_PROBE_V1_FILE_ID_REFUSED");
            report.VolumeSerial64 = childId.VolumeSerial.ToString("x16");
            report.ChildFileId128 = childId.FileId128;
            byte[] observedDescriptor = GetDescriptor(child);
            report.ObservedDescriptorBase64 = Convert.ToBase64String(observedDescriptor);
            report.ObservedDescriptorSha256 = Hash(observedDescriptor);
            (report.ObservedOwnerSid, report.ObservedGroupSid) =
                ValidateDescriptor(observedDescriptor);
            Need(RandomAccess.GetLength(child) == 0,
                "OWNER_GROUP_PROBE_V1_NOT_NEW_EMPTY_FILE");
            RandomAccess.Write(child, FixedContent, 0);
            RandomAccess.FlushToDisk(child);
            byte[] observed = new byte[FixedContent.Length];
            int offset = 0;
            while (offset < observed.Length) {
                int count = RandomAccess.Read(child, observed.AsSpan(offset), offset);
                Need(count > 0, "OWNER_GROUP_PROBE_V1_SHORT_READ_REFUSED");
                offset += count;
            }
            Need(observed.AsSpan().SequenceEqual(FixedContent) &&
                RandomAccess.GetLength(child) == FixedContent.Length,
                "OWNER_GROUP_PROBE_V1_READBACK_REFUSED");
            report.ContentSha256 = Hash(observed);
            Need(Inspect(child, Path.Combine(attempt, ChildLeaf), false) == childId &&
                Inspect(parent, attempt, true) == parentId,
                "OWNER_GROUP_PROBE_V1_FINAL_ID_REFUSED");
            NoImpersonation();
        } finally {
            if (pin.IsAllocated) pin.Free();
            if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (parentRef) parent.DangerousRelease();
        }
    }

    private static Identity Inspect(SafeFileHandle handle, string expectedPath,
        bool directory)
    {
        Need(GetFileInformationByHandle(handle, out ByHandleInfo basic),
            "OWNER_GROUP_PROBE_V1_BASIC_METADATA_REFUSED");
        Need(GetFileInformationByHandleEx(handle, FileIdInfoClass, out FileIdInfo full,
                (uint)Marshal.SizeOf<FileIdInfo>()),
            "OWNER_GROUP_PROBE_V1_FULL_METADATA_REFUSED");
        StringBuilder path = new(32768);
        uint length = GetFinalPathNameByHandleW(handle, path, (uint)path.Capacity, 0);
        Need(length > 0 && length < (uint)path.Capacity &&
            path.ToString().Equals(@"\\?\" + expectedPath,
                StringComparison.OrdinalIgnoreCase) &&
            GetFileType(handle) == 1 && basic.Links == 1 &&
            (basic.Attributes & 0x1400u) == 0 &&
            ((basic.Attributes & 0x10u) != 0) == directory,
            "OWNER_GROUP_PROBE_V1_OBJECT_REFUSED");
        Span<byte> id = stackalloc byte[16];
        BinaryPrimitives.WriteUInt64LittleEndian(id[..8], full.FileId.Low);
        BinaryPrimitives.WriteUInt64LittleEndian(id[8..], full.FileId.High);
        string idHex = Convert.ToHexString(id).ToLowerInvariant();
        Need(full.VolumeSerialNumber != 0 && idHex != new string('0', 32),
            "OWNER_GROUP_PROBE_V1_FULL_ID_REFUSED");
        return new Identity(full.VolumeSerialNumber, idHex);
    }

    private static byte[] GetDescriptor(SafeFileHandle handle)
    {
        uint status = GetSecurityInfo(handle, 1, 7, out _, out _, out _, out _,
            out IntPtr pointer);
        try {
            Need(status == 0 && pointer != IntPtr.Zero,
                "OWNER_GROUP_PROBE_V1_SECURITY_QUERY_REFUSED");
            int length = checked((int)GetSecurityDescriptorLength(pointer));
            Need(length is >= 20 and <= 65536,
                "OWNER_GROUP_PROBE_V1_SECURITY_LENGTH_REFUSED");
            byte[] raw = new byte[length];
            Marshal.Copy(pointer, raw, 0, length);
            return raw;
        } finally { if (pointer != IntPtr.Zero) _ = LocalFree(pointer); }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes
    {
        internal int Length;
        internal IntPtr Descriptor;
        internal int Inherit;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeName
    {
        internal ushort Length;
        internal ushort MaximumLength;
        internal IntPtr Buffer;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ObjectAttributes
    {
        internal int Length;
        internal IntPtr Root;
        internal IntPtr Name;
        internal uint Flags;
        internal IntPtr SecurityDescriptor;
        internal IntPtr Quality;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoStatus
    {
        internal IntPtr Status;
        internal UIntPtr Information;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct ByHandleInfo
    {
        internal uint Attributes;
        internal long Creation;
        internal long Access;
        internal long Write;
        internal uint Volume;
        internal uint SizeHigh;
        internal uint SizeLow;
        internal uint Links;
        internal uint IndexHigh;
        internal uint IndexLow;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct FileId128
    {
        internal ulong Low;
        internal ulong High;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct FileIdInfo
    {
        internal ulong VolumeSerialNumber;
        internal FileId128 FileId;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string path, uint access,
        uint share, ref SecurityAttributes attributes, uint disposition,
        uint flags, IntPtr template);
    [DllImport("ntdll.dll")]
    private static extern int NtCreateFile(out SafeFileHandle handle, uint access,
        ref ObjectAttributes attributes, out IoStatus io, IntPtr allocation,
        uint fileAttributes, uint share, uint disposition, uint options,
        IntPtr ea, uint eaLength);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle,
        out ByHandleInfo info);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandleEx(SafeFileHandle handle,
        int informationClass, out FileIdInfo info, uint size);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle,
        StringBuilder path, uint capacity, uint flags);
    [DllImport("kernel32.dll")]
    private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityInfo(SafeFileHandle handle, uint type,
        uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl,
        out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentThread();
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenThreadToken(IntPtr thread, uint access,
        [MarshalAs(UnmanagedType.Bool)] bool openAsSelf,
        out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(IntPtr process, uint access,
        out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token,
        int informationClass, IntPtr buffer, uint length, out uint written);
}
