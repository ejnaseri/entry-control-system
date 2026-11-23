#if COMPILE_ONLY_NATIVE_HOST_ORIGIN_WINDOWS_V2
using System;
using System.Buffers.Binary;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardNativeHost;

// Compile-only, read-only Windows shape for the injected origin lease. There is
// no CLI or physical admission route to this class. An external trusted guard
// must still establish the current Owner, host, boot and protected ACL policy.
// The sequential samples here cannot establish continuous namespace custody.
internal sealed class NativeHostOriginWindowsV2 : INativeHostOriginBackendV2
{
    private const uint ReadControl = 0x00020000;
    private const uint Synchronize = 0x00100000;
    private const uint ReadData = 0x00000001;
    private const uint Traverse = 0x00000020;
    private const uint ReadAttributes = 0x00000080;
    private const uint ShareRead = 0x00000001;
    private const uint FileOpen = 1;
    private const uint FileOpened = 1;
    private const uint OpenReparsePoint = 0x00200000;
    private const uint SynchronousIoNonalert = 0x00000020;
    private const uint BackupSemantics = 0x02000000;
    private const uint ObjCaseInsensitive = 0x00000040;
    private const int FileIdInfoClass = 18;
    private const uint ErrorNoToken = 1008;
    private const int MaximumInputBytes = 4194304;
    private readonly Action<string> trustedGuard;
    private long nextHandleId;

    internal NativeHostOriginWindowsV2(Action<string> trustedGuard) =>
        this.trustedGuard = trustedGuard ?? throw new ArgumentNullException(nameof(trustedGuard));

    private static void Need(bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }

    private void Gate(string point)
    {
        Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            RuntimeInformation.OSArchitecture == Architecture.X64,
            "NATIVE_ORIGIN_WINDOWS_PLATFORM_REFUSED");
        RequireNoImpersonation();
        trustedGuard(point);
        RequireNoImpersonation();
    }

    private static void RequireNoImpersonation()
    {
        bool opened = OpenThreadToken(GetCurrentThread(), 0x00000008, true,
            out SafeAccessTokenHandle token);
        int error = Marshal.GetLastWin32Error();
        if (opened) {
            token.Dispose();
            throw new InvalidDataException("NATIVE_ORIGIN_WINDOWS_IMPERSONATION_REFUSED");
        }
        token?.Dispose();
        Need(error == ErrorNoToken, "NATIVE_ORIGIN_WINDOWS_THREAD_TOKEN_UNKNOWN");
    }

    private ulong NextHandleId()
    {
        long value = Interlocked.Increment(ref nextHandleId);
        Need(value > 0, "NATIVE_ORIGIN_WINDOWS_HANDLE_ID_EXHAUSTED");
        // This is a process-local wrapper ordinal, not a kernel object ID.
        return checked((ulong)value);
    }

    private sealed class Handle : INativeHostOriginHandleV2
    {
        internal readonly SafeFileHandle Native;
        internal readonly string Path;
        internal readonly bool Directory;
        internal readonly NativeHostOriginWindowsV2 Owner;
        private readonly ulong handleId;
        private readonly NativeHostOriginOpenWitnessV2? witness;

        internal Handle(SafeFileHandle native, string path, bool directory,
            NativeHostOriginWindowsV2 owner, ulong handleId,
            NativeHostOriginOpenWitnessV2? witness)
        {
            Native = native;
            Path = path;
            Directory = directory;
            Owner = owner;
            this.handleId = handleId;
            this.witness = witness;
        }

        public NativeHostOriginObservationV2 Inspect()
        {
            Owner.Gate("INSPECT_" + Path);
            Need(!Native.IsInvalid && !Native.IsClosed,
                "NATIVE_ORIGIN_WINDOWS_CLOSED_HANDLE_REFUSED");
            Need(GetFileInformationByHandle(Native, out ByHandleInfo basic),
                "NATIVE_ORIGIN_WINDOWS_BASIC_INFO_REFUSED");
            Need(GetFileInformationByHandleEx(Native, FileIdInfoClass,
                out FileIdInfo full, (uint)Marshal.SizeOf<FileIdInfo>()),
                "NATIVE_ORIGIN_WINDOWS_FULL_ID_REFUSED");
            Span<byte> idBytes = stackalloc byte[16];
            BinaryPrimitives.WriteUInt64LittleEndian(idBytes[..8], full.FileId.Low);
            BinaryPrimitives.WriteUInt64LittleEndian(idBytes[8..], full.FileId.High);
            var id = new NativeHostFileIdInfoV2(full.VolumeSerialNumber,
                Convert.ToHexString(idBytes).ToLowerInvariant());
            var path = new StringBuilder(32768);
            uint length = GetFinalPathNameByHandleW(Native, path,
                (uint)path.Capacity, 0);
            Need(length > 0 && length < (uint)path.Capacity,
                "NATIVE_ORIGIN_WINDOWS_FINAL_PATH_REFUSED");
            uint type = GetFileType(Native);
            long size = checked((long)(((ulong)basic.SizeHigh << 32) |
                basic.SizeLow));
            var observation = new NativeHostOriginObservationV2(path.ToString(),
                type, basic.Attributes, basic.Links, id, basic.Creation,
                size, handleId, witness);
            Owner.Gate("AFTER_INSPECT_" + Path);
            return observation;
        }

        public byte[] Descriptor()
        {
            Owner.Gate("DESCRIPTOR_" + Path);
            uint status = GetSecurityInfo(Native, 1, 7, out _, out _, out _,
                out _, out IntPtr descriptor);
            try {
                Need(status == 0 && descriptor != IntPtr.Zero,
                    "NATIVE_ORIGIN_WINDOWS_DESCRIPTOR_REFUSED");
                int length = checked((int)GetSecurityDescriptorLength(descriptor));
                Need(length is >= 20 and <= 65536,
                    "NATIVE_ORIGIN_WINDOWS_DESCRIPTOR_LENGTH_REFUSED");
                byte[] bytes = new byte[length];
                Marshal.Copy(descriptor, bytes, 0, length);
                Owner.Gate("AFTER_DESCRIPTOR_" + Path);
                return bytes;
            } finally {
                if (descriptor != IntPtr.Zero) _ = LocalFree(descriptor);
            }
        }

        public byte[] ReadBounded(int maximum)
        {
            Owner.Gate("READ_" + Path);
            Need(!Directory && maximum is > 0 and <= MaximumInputBytes,
                "NATIVE_ORIGIN_WINDOWS_READ_SCOPE_REFUSED");
            long size = RandomAccess.GetLength(Native);
            Need(size > 0 && size <= maximum,
                "NATIVE_ORIGIN_WINDOWS_READ_LENGTH_REFUSED");
            byte[] bytes = new byte[checked((int)size)];
            int offset = 0;
            while (offset < bytes.Length) {
                Owner.Gate("READ_CHUNK_" + Path);
                int read = RandomAccess.Read(Native, bytes.AsSpan(offset), offset);
                Need(read > 0, "NATIVE_ORIGIN_WINDOWS_SHORT_READ_REFUSED");
                offset += read;
            }
            Need(RandomAccess.GetLength(Native) == size,
                "NATIVE_ORIGIN_WINDOWS_READ_LENGTH_CHANGED");
            Owner.Gate("AFTER_READ_" + Path);
            return bytes;
        }

        // The lease roots each wrapper, including failed and unknown opens.
        // A caller cannot use IDisposable to release a quarantined native handle.
        public void Dispose() { }
    }

    public void OpenVolumeRoot(NativeHostOriginHandleSlotV2 output)
    {
        ArgumentNullException.ThrowIfNull(output);
        Gate("BEFORE_VOLUME_OPEN");
        Need(output.Target.Path == @"C:\" && output.Target.ParentPath is null &&
            output.Target.Directory && output.Target.InputFile is null,
            "NATIVE_ORIGIN_WINDOWS_VOLUME_TARGET_REFUSED");
        ulong handleId = NextHandleId();
        var attributes = new SecurityAttributes {
            Length = Marshal.SizeOf<SecurityAttributes>()
        };
        SafeFileHandle native = CreateFileW(@"C:\", ReadControl |
            Synchronize | Traverse | ReadAttributes, ShareRead, ref attributes,
            3, BackupSemantics | OpenReparsePoint, IntPtr.Zero);
        if (native is not null)
            output.Attach(new Handle(native, @"C:\", true, this, handleId, null));
        Need(native is not null && !native.IsInvalid,
            "NATIVE_ORIGIN_WINDOWS_VOLUME_OPEN_REFUSED");
        Gate("AFTER_VOLUME_OPEN");
    }

    public void OpenChild(INativeHostOriginHandleV2 heldParent,
        string exactLeaf, bool directory, NativeHostOriginHandleSlotV2 output)
    {
        ArgumentNullException.ThrowIfNull(output);
        Gate("BEFORE_CHILD_OPEN");
        Need(heldParent is Handle, "NATIVE_ORIGIN_WINDOWS_PARENT_TYPE_REFUSED");
        Handle parent = (Handle)heldParent;
        Need(ReferenceEquals(parent.Owner, this) &&
            parent.Directory && !parent.Native.IsInvalid &&
            !parent.Native.IsClosed,
            "NATIVE_ORIGIN_WINDOWS_PARENT_REFUSED");
        Need(exactLeaf is { Length: > 0 and <= 96 } &&
            exactLeaf != "." && exactLeaf != ".." &&
            exactLeaf.IndexOfAny(new[] { '\\', '/', ':', '\0' }) < 0,
            "NATIVE_ORIGIN_WINDOWS_LEAF_REFUSED");
        string expectedPath = parent.Path.EndsWith('\\') ?
            parent.Path + exactLeaf : parent.Path + @"\" + exactLeaf;
        Need(output.Target.Path == expectedPath &&
            output.Target.ParentPath == parent.Path &&
            output.Target.Leaf == exactLeaf &&
            output.Target.Directory == directory,
            "NATIVE_ORIGIN_WINDOWS_CHILD_TARGET_REFUSED");
        ulong handleId = NextHandleId();
        bool held = false;
        IntPtr name = IntPtr.Zero;
        IntPtr nameStruct = IntPtr.Zero;
        try {
            parent.Native.DangerousAddRef(ref held);
            NativeHostOriginObservationV2 parentObservation = parent.Inspect();
            Need(parentObservation.FinalPath == @"\\?\" + parent.Path &&
                parentObservation.Type == 1 &&
                (parentObservation.Attributes & 0x10u) != 0 &&
                (parentObservation.Attributes & 0x1400u) == 0 &&
                parentObservation.Id.VolumeSerialNumber != 0 &&
                parentObservation.Id.FileId128LowerHex != new string('0', 32),
                "NATIVE_ORIGIN_WINDOWS_PARENT_OBSERVATION_REFUSED");
            var witness = new NativeHostOriginOpenWitnessV2(
                parentObservation.HandleObjectId, parentObservation.Id, exactLeaf);
            name = Marshal.StringToHGlobalUni(exactLeaf);
            var unicode = new UnicodeName {
                Length = checked((ushort)(exactLeaf.Length * 2)),
                MaximumLength = checked((ushort)((exactLeaf.Length + 1) * 2)),
                Buffer = name
            };
            nameStruct = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(unicode, nameStruct, false);
            var attributes = new ObjectAttributes {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.Native.DangerousGetHandle(),
                Name = nameStruct,
                Flags = ObjCaseInsensitive
            };
            uint access = ReadControl | Synchronize | ReadAttributes |
                (directory ? Traverse : ReadData);
            Gate("IMMEDIATELY_BEFORE_CHILD_OPEN");
            int status = NtCreateFile(out SafeFileHandle native, access,
                ref attributes, out IoStatus io, IntPtr.Zero, 0, ShareRead,
                FileOpen, OpenReparsePoint | SynchronousIoNonalert,
                IntPtr.Zero, 0);
            // Attach even an invalid native output before interpreting status.
            // The slot is already rooted by NativeHostOriginLeaseV2.Acquire.
            if (native is not null)
                output.Attach(new Handle(native, expectedPath, directory,
                    this, handleId, witness));
            Need(status == 0 && native is not null && !native.IsInvalid &&
                io.Information.ToUInt64() == FileOpened,
                "NATIVE_ORIGIN_WINDOWS_CHILD_OPEN_REFUSED");
            Gate("AFTER_CHILD_OPEN");
        } finally {
            if (nameStruct != IntPtr.Zero) Marshal.FreeHGlobal(nameStruct);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (held) parent.Native.DangerousRelease();
        }
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
        internal IntPtr Descriptor;
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
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenThreadToken(IntPtr thread, uint access,
        [MarshalAs(UnmanagedType.Bool)] bool openAsSelf,
        out SafeAccessTokenHandle token);
}
#endif
