using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal interface IControlStore
{
    byte[] Read(string relative);
    void WriteNew(string relative, byte[] data);
}

internal sealed record ControlStoreAce(string Sid, int Mask);
internal sealed record ControlStoreRule(string Owner, bool Directory, ControlStoreAce[] Aces);

// This worker store cannot deploy directories, relax permissions, replace files,
// or delete anything. A separately reviewed deployment must create the exact
// directory ACLs first. No path, descriptor or role supplied by a report grants
// authority: all of them are selected from this fixed contract.
internal sealed class ProtectedControlStore : IControlStore
{
    internal const string Root = ControlRules.Root;
    internal const string SystemSid = "S-1-5-18";
    internal const string AdminSid = "S-1-5-32-544";
    internal const string GuardianSid = "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315";
    internal const int Full = 0x1f01ff, Modify = 0x1301bf, ReadFile = 0x120089, ReadDirectory = 0x1200a9;
    private const int JsonMaximum = 2097152, PackageMaximum = 33554432;
    private const uint OpenExisting = 3, CreateNew = 1, ReadControl = 0x20000, ReadAttributes = 0x80;
    private const uint GenericRead = 0x80000000, GenericWrite = 0x40000000;
    private const uint OpenReparsePoint = 0x00200000, BackupSemantics = 0x02000000;
    private readonly ControlRole role;
    private readonly Action requireIdentity;

    internal static IReadOnlyList<string> Files { get; } = Array.AsReadOnly(new[] {
        "plan.json", "reservation.json", "package-manifest.json",
        "bin/ExportPolicyControl.exe", "bin/ExportPolicyControl.dll",
        "bin/ExportPolicyControl.runtimeconfig.json", "bin/runtime-inventory.json",
        "journal/setup-consumed.json", "journal/exportable-intent.json", "journal/nonexportable-intent.json",
        "journal/exportable-owned.json", "journal/nonexportable-owned.json",
        "journal/setup-complete.json", "journal/setup-recovery.json",
        "reports/setup.json", "reports/guardian-consumed.json", "reports/guardian.json"
    });

    internal ProtectedControlStore(ControlRole role, Action requireIdentity)
    {
        Need(role is ControlRole.Setup or ControlRole.Guardian, "STORE_ROLE_REFUSED");
        this.role = role;
        this.requireIdentity = requireIdentity ?? throw new InvalidDataException("STORE_IDENTITY_GUARD_REQUIRED");
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }

    internal static string PathOf(string relative)
    {
        Need(relative is not null && Files.Contains(relative, StringComparer.Ordinal), "STORE_PATH_REFUSED");
        return Root + "\\" + relative.Replace('/', '\\');
    }

    internal static bool CanRead(ControlRole role, string relative)
    {
        if (!Files.Contains(relative, StringComparer.Ordinal)) return false;
        return role switch {
            ControlRole.Setup => relative is not "reports/guardian-consumed.json" and not "reports/guardian.json",
            ControlRole.Guardian => relative != "journal/setup-recovery.json",
            _ => false
        };
    }

    internal static bool CanWrite(ControlRole role, string relative)
    {
        if (!Files.Contains(relative, StringComparer.Ordinal)) return false;
        return role switch {
            ControlRole.Setup => relative.StartsWith("journal/", StringComparison.Ordinal) || relative == "reports/setup.json",
            ControlRole.Guardian => relative is "reports/guardian-consumed.json" or "reports/guardian.json",
            _ => false
        };
    }

    internal static ControlStoreRule RuleOf(string relative, bool directory = false)
    {
        ControlStoreAce[] Aces(int admin, int guardian) => new[] {
            new ControlStoreAce(SystemSid, Full), new ControlStoreAce(AdminSid, admin), new ControlStoreAce(GuardianSid, guardian)
        };
        if (directory) {
            Need(relative is "" or "bin" or "journal" or "reports", "STORE_DIRECTORY_REFUSED");
            return new(AdminSid, true, Aces(Full, relative == "reports" ? Modify : ReadDirectory));
        }
        PathOf(relative);
        if (relative.StartsWith("journal/", StringComparison.Ordinal) || relative == "reports/setup.json")
            return new(SystemSid, false, Aces(ReadFile, ReadFile));
        if (relative is "reports/guardian-consumed.json" or "reports/guardian.json")
            return new(GuardianSid, false, Aces(ReadFile, Modify));
        if (relative is "bin/ExportPolicyControl.exe" or "bin/ExportPolicyControl.dll")
            return new(AdminSid, false, Aces(Full, ReadDirectory)); // RX: service image loading requires FILE_EXECUTE
        return new(AdminSid, false, Aces(Full, ReadFile));
    }

    private static int Maximum(string relative) => relative.StartsWith("bin/", StringComparison.Ordinal)
        ? PackageMaximum : JsonMaximum;

    public byte[] Read(string relative)
    {
        requireIdentity();
        Need(CanRead(role, relative), "STORE_READ_ROLE_REFUSED");
        string path = PathOf(relative);
        var rule = RuleOf(relative);
        using var pins = PinParents(relative);
        requireIdentity();
        using var handle = Open(path, GenericRead | ReadControl, false);
        CheckHandle(handle, rule, path);
        using var stream = new FileStream(handle, FileAccess.Read);
        Need(stream.Length > 0 && stream.Length <= Maximum(relative), "STORE_READ_SIZE_REFUSED");
        byte[] bytes = new byte[checked((int)stream.Length)];
        stream.ReadExactly(bytes);
        Need(stream.Length == bytes.LongLength && stream.Position == bytes.LongLength, "STORE_READ_CHANGED");
        CheckHandle(handle, rule, path);
        pins.Check();
        requireIdentity();
        return bytes;
    }

    public void WriteNew(string relative, byte[] data)
    {
        requireIdentity();
        Need(CanWrite(role, relative), "STORE_WRITE_ROLE_REFUSED");
        Need(data is { Length: > 0 } && data.Length <= JsonMaximum, "STORE_WRITE_SIZE_REFUSED");
        byte[] bytes = (byte[])data.Clone();
        string path = PathOf(relative);
        var rule = RuleOf(relative);
        using var pins = PinParents(relative);
        byte[] descriptor = Descriptor(rule);
        var pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
        SafeFileHandle handle;
        try {
            requireIdentity();
            var attributes = new SecurityAttributes {
                Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = pin.AddrOfPinnedObject(), Inherit = 0
            };
            // No sharing and CREATE_NEW. A partial failure intentionally leaves
            // the new file behind for explicit review, never an overwrite/retry.
            handle = CreateFileW(path, GenericRead | GenericWrite | ReadControl | ReadAttributes,
                0, ref attributes, CreateNew, OpenReparsePoint, IntPtr.Zero);
        }
        finally { pin.Free(); }
        using (handle) {
            Need(!handle.IsInvalid, "STORE_CREATE_NEW_REFUSED_RETAIN");
            CheckHandle(handle, rule, path);
            using var stream = new FileStream(handle, FileAccess.ReadWrite);
            Need(stream.Length == 0, "STORE_NEW_FILE_NOT_EMPTY_RETAIN");
            stream.Write(bytes);
            stream.Flush(true);
            CheckHandle(handle, rule, path);
            Need(stream.Length == bytes.LongLength, "STORE_WRITE_LENGTH_REFUSED_RETAIN");
            stream.Position = 0;
            byte[] readback = new byte[bytes.Length];
            stream.ReadExactly(readback);
            Need(readback.AsSpan().SequenceEqual(bytes), "STORE_WRITE_READBACK_REFUSED_RETAIN");
            CheckHandle(handle, rule, path);
            pins.Check();
            requireIdentity();
        }
    }

    // Managed SID/ACL encoding avoids SDDL parsing, which can call Win32 even
    // during nominally pure tests. Security checks use bytes from the SAME file
    // handle, not a second path-based Get-Acl lookup vulnerable to replacement.
    private static byte[] SidBytes(string sid)
    {
        string[] parts = sid.Split('-');
        Need(parts.Length is >= 4 and <= 18 && parts[0] == "S" && parts[1] == "1" &&
            ulong.TryParse(parts[2], out _), "STORE_SID_REFUSED");
        ulong authority = ulong.Parse(parts[2]);
        Need(authority <= 0xffffffffffff, "STORE_SID_AUTHORITY_REFUSED");
        byte[] bytes = new byte[8 + 4 * (parts.Length - 3)];
        bytes[0] = 1;
        bytes[1] = checked((byte)(parts.Length - 3));
        for (int i = 0; i < 6; i++) bytes[2 + i] = (byte)(authority >> (8 * (5 - i)));
        for (int i = 3; i < parts.Length; i++) {
            Need(uint.TryParse(parts[i], out uint value), "STORE_SID_PART_REFUSED");
            BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(8 + 4 * (i - 3), 4), value);
        }
        return bytes;
    }

    internal static byte[] Descriptor(ControlStoreRule rule)
    {
        byte[] owner = SidBytes(rule.Owner);
        byte[][] sids = rule.Aces.Select(x => SidBytes(x.Sid)).ToArray();
        int aclLength = checked(8 + sids.Sum(x => x.Length + 8));
        Need(rule.Aces.Length is > 0 and <= 16 && aclLength <= ushort.MaxValue, "STORE_ACL_SIZE_REFUSED");
        int aclOffset = 20 + owner.Length;
        byte[] result = new byte[aclOffset + aclLength];
        result[0] = 1;
        BinaryPrimitives.WriteUInt16LittleEndian(result.AsSpan(2, 2), 0x9004); // self-relative, protected, DACL present
        BinaryPrimitives.WriteInt32LittleEndian(result.AsSpan(4, 4), 20);
        BinaryPrimitives.WriteInt32LittleEndian(result.AsSpan(16, 4), aclOffset);
        owner.CopyTo(result, 20);
        result[aclOffset] = 2;
        BinaryPrimitives.WriteUInt16LittleEndian(result.AsSpan(aclOffset + 2, 2), checked((ushort)aclLength));
        BinaryPrimitives.WriteUInt16LittleEndian(result.AsSpan(aclOffset + 4, 2), checked((ushort)sids.Length));
        int cursor = aclOffset + 8;
        for (int i = 0; i < sids.Length; i++) {
            result[cursor] = 0; // ACCESS_ALLOWED_ACE_TYPE, never object/callback/deny
            result[cursor + 1] = rule.Directory ? (byte)3 : (byte)0;
            BinaryPrimitives.WriteUInt16LittleEndian(result.AsSpan(cursor + 2, 2), checked((ushort)(8 + sids[i].Length)));
            BinaryPrimitives.WriteInt32LittleEndian(result.AsSpan(cursor + 4, 4), rule.Aces[i].Mask);
            sids[i].CopyTo(result, cursor + 8);
            cursor += 8 + sids[i].Length;
        }
        return result;
    }

    private static string ReadSid(byte[] bytes, int offset, int limit, out int length)
    {
        Need(offset >= 20 && offset <= limit - 8 && limit <= bytes.Length && bytes[offset] == 1 &&
            bytes[offset + 1] is > 0 and <= 15, "STORE_DESCRIPTOR_SID_REFUSED");
        int count = bytes[offset + 1];
        length = 8 + count * 4;
        Need(length <= limit - offset, "STORE_DESCRIPTOR_SID_SIZE_REFUSED");
        ulong authority = 0;
        for (int i = 0; i < 6; i++) authority = (authority << 8) | bytes[offset + 2 + i];
        var text = new StringBuilder("S-1-");
        text.Append(authority.ToString(System.Globalization.CultureInfo.InvariantCulture));
        for (int i = 0; i < count; i++) {
            text.Append('-');
            text.Append(BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(offset + 8 + i * 4, 4))
                .ToString(System.Globalization.CultureInfo.InvariantCulture));
        }
        return text.ToString();
    }

    internal static void ValidateDescriptor(byte[] bytes, ControlStoreRule rule)
    {
        Need(bytes is { Length: >= 20 and <= 65536 } && bytes[0] == 1 && bytes[1] == 0,
            "STORE_DESCRIPTOR_HEADER_REFUSED");
        ushort control = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(2, 2));
        Need((control & 0x9004) == 0x9004 && (control & 0x0508) == 0, "STORE_PROTECTED_DACL_REFUSED");
        int owner = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(4, 4));
        int acl = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(16, 4));
        Need(owner >= 20 && (owner & 3) == 0 && acl >= 20 && (acl & 3) == 0 && acl <= bytes.Length - 8,
            "STORE_DESCRIPTOR_OFFSETS_REFUSED");
        string ownerSid = ReadSid(bytes, owner, bytes.Length, out int ownerLength);
        Need(ownerSid == rule.Owner, "STORE_OWNER_REFUSED");
        int aclLength = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 2, 2));
        int count = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 4, 2));
        Need(bytes[acl] == 2 && bytes[acl + 1] == 0 && bytes[acl + 6] == 0 && bytes[acl + 7] == 0 &&
            aclLength >= 8 && aclLength <= bytes.Length - acl && count == rule.Aces.Length &&
            (owner + ownerLength <= acl || owner >= acl + aclLength), "STORE_ACL_HEADER_REFUSED");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        int cursor = acl + 8;
        int end = acl + aclLength;
        for (int i = 0; i < count; i++) {
            Need(cursor <= end - 8, "STORE_ACE_HEADER_REFUSED");
            int size = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(cursor + 2, 2));
            Need(bytes[cursor] == 0 && bytes[cursor + 1] == (rule.Directory ? 3 : 0) &&
                size >= 20 && size <= end - cursor, "STORE_ACE_KIND_REFUSED");
            int mask = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(cursor + 4, 4));
            string sid = ReadSid(bytes, cursor + 8, cursor + size, out int sidLength);
            Need(size == sidLength + 8 && seen.Add(sid) && rule.Aces.Any(x => x.Sid == sid && x.Mask == mask),
                "STORE_ACE_RIGHTS_REFUSED");
            cursor += size;
        }
        Need(cursor == end, "STORE_ACL_TRAILING_BYTES_REFUSED");
    }

    private sealed class ParentPins : IDisposable
    {
        internal readonly List<(SafeFileHandle Handle, string Path, ControlStoreRule? Rule)> Items = new();
        internal void Check()
        {
            foreach (var item in Items) {
                if (item.Rule is null) CheckPlainHandle(item.Handle, true, item.Path);
                else CheckHandle(item.Handle, item.Rule, item.Path);
            }
        }
        public void Dispose()
        {
            for (int i = Items.Count - 1; i >= 0; i--) Items[i].Handle.Dispose();
        }
    }

    private static ParentPins PinParents(string relative)
    {
        PathOf(relative);
        var pins = new ParentPins();
        try {
            void Pin(string path, ControlStoreRule? rule) {
                var handle = Open(path, ReadControl | ReadAttributes, true);
                pins.Items.Add((handle, path, rule));
                if (rule is null) CheckPlainHandle(handle, true, path);
                else CheckHandle(handle, rule, path);
            }
            Pin(@"C:\", null);
            Pin(@"C:\ProgramData", null);
            Pin(Root, RuleOf("", true));
            if (relative.Contains('/')) {
                string folder = relative.Split('/')[0];
                Pin(Root + "\\" + folder, RuleOf(folder, true));
            }
            pins.Check();
            return pins;
        }
        catch { pins.Dispose(); throw; }
    }

    private static SafeFileHandle Open(string path, uint access, bool directory)
    {
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        // FILE_SHARE_READ only prevents ancestor replacement and rejects an
        // already-open writer; no FOLLOW_REPARSE_POINT fallback is available.
        var handle = CreateFileW(path, access, 1, ref attributes, OpenExisting,
            OpenReparsePoint | (directory ? BackupSemantics : 0), IntPtr.Zero);
        if (handle.IsInvalid) { handle.Dispose(); throw new InvalidDataException("STORE_OPEN_REFUSED"); }
        return handle;
    }

    private static void CheckPlainHandle(SafeFileHandle handle, bool directory, string expectedPath)
    {
        Need(GetFileType(handle) == 1, "STORE_HANDLE_TYPE_REFUSED");
        Need(GetFileInformationByHandle(handle, out var info), "STORE_HANDLE_INFO_REFUSED");
        Need((info.Attributes & 0x400) == 0 && ((info.Attributes & 0x10) != 0) == directory &&
            (directory || info.Links == 1), "STORE_HANDLE_KIND_LINKS_REFUSED");
        var text = new StringBuilder(32768);
        uint count = GetFinalPathNameByHandleW(handle, text, (uint)text.Capacity, 0);
        Need(count > 0 && count < text.Capacity && text.ToString().Equals("\\\\?\\" + expectedPath, StringComparison.OrdinalIgnoreCase),
            "STORE_HANDLE_PATH_REFUSED");
    }

    private static void CheckHandle(SafeFileHandle handle, ControlStoreRule rule, string expectedPath)
    {
        CheckPlainHandle(handle, rule.Directory, expectedPath);
        uint status = GetSecurityInfo(handle, 1, 5, out _, out _, out _, out _, out var pointer);
        try {
            Need(status == 0 && pointer != IntPtr.Zero, "STORE_SECURITY_QUERY_REFUSED");
            int length = checked((int)GetSecurityDescriptorLength(pointer));
            Need(length is >= 20 and <= 65536, "STORE_DESCRIPTOR_LENGTH_REFUSED");
            byte[] bytes = new byte[length];
            Marshal.Copy(pointer, bytes, 0, length);
            ValidateDescriptor(bytes, rule);
        }
        finally { if (pointer != IntPtr.Zero) LocalFree(pointer); }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct FileInfo {
        internal uint Attributes;
        internal long Creation, Access, Write;
        internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, ref SecurityAttributes attributes,
        uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityInfo(SafeFileHandle handle, uint type, uint info, out IntPtr owner,
        out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);
}
