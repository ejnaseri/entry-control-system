#if COMPILE_ONLY_NATIVE_HOST_RESERVATION_WINDOWS_V3
using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardNativeHost;

// Compile-only Windows sink for the two V3 originals. No CLI constructs this
// class. It does not admit an account, launch a child, or grant W03 authority.
// The independent guard still has to prove host/boot/worker context and the
// candidate package. The supplied V3 prefix seal is not a held slot-40 file
// witness in this sink; file flush is not a crash-durable namespace guarantee.
[SupportedOSPlatform("windows")]
internal sealed class NativeHostReservationWindowsV3 : INativeHostReservationSinkV3
{
    private const uint ReadControl = 0x00020000;
    private const uint Synchronize = 0x00100000;
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint Traverse = 0x00000020;
    private const uint ReadAttributes = 0x00000080;
    private const uint ShareRead = 0x00000001;
    private const uint FileOpen = 1;
    private const uint FileCreate = 2;
    private const ulong FileOpened = 1;
    private const ulong FileCreated = 2;
    private const uint OpenReparsePoint = 0x00200000;
    private const uint SynchronousIoNonalert = 0x00000020;
    private const uint NonDirectoryFile = 0x00000040;
    private const uint WriteThrough = 0x00000002;
    private const uint BackupSemantics = 0x02000000;
    private const uint ObjCaseInsensitive = 0x00000040;
    private const uint FileAttributeNormal = 0x00000080;
    private const uint FileAttributeArchive = 0x00000020;
    private const int FileIdInfoClass = 18;
    private const int StatusObjectNameNotFound = unchecked((int)0xC0000034);
    private const int ErrorNoToken = 1008;
    private const int FileAllAccess = 0x001f01ff;
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostReservationWindowsV3> Retained = new();

    private readonly NativeHostBoundInputV2 bound;
    private readonly NativeHostPrefixSealV3 prefixSeal;
    private readonly NativeHostReservationContextV3 context;
    private readonly Action<string> trustedGuard;
    private readonly string intentPath;
    private readonly string reservationPath;
    private readonly Dictionary<string, Held> directories = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Held> files = new(StringComparer.Ordinal);
    private readonly List<SafeFileHandle> quarantined = new();
    private int active;
    private int faulted;

    private sealed record Sample(string Path, uint Type, uint Attributes,
        uint Links, NativeHostFileIdInfoV2 Id, long CreationFileTimeUtc,
        long Length, byte[] Descriptor);
    private sealed record Held(SafeFileHandle Native, string Path, Sample Initial);

    internal bool Faulted => Volatile.Read(ref faulted) != 0;
    internal bool NativeEvidenceEstablished => false;
    internal bool PhysicalDurabilityProven => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool Lic008Closed => false;

    internal NativeHostReservationWindowsV3(NativeHostBoundInputV2 bound,
        NativeHostPrefixSealV3 prefixSeal, NativeHostReservationContextV3 context,
        Action<string> trustedGuard)
    {
        this.bound = bound ?? throw new ArgumentNullException(nameof(bound));
        this.prefixSeal = prefixSeal ?? throw new ArgumentNullException(nameof(prefixSeal));
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.trustedGuard = trustedGuard ?? throw new ArgumentNullException(nameof(trustedGuard));
        Need(bound.Profile is not null && bound.Plan is not null && bound.Approval is not null &&
            bound.Profile.RecordRoot == NativeHostProfileV2.Root + @"\records\" + bound.Profile.Attempt &&
            bound.Plan.Attempt == bound.Profile.Attempt &&
            bound.Plan.ProfileSha256 == bound.Profile.CanonicalSha256 &&
            bound.Approval.PlanSha256 == bound.Plan.CanonicalSha256 &&
            prefixSeal.Attempt == bound.Profile.Attempt &&
            prefixSeal.ProfileSha256 == bound.Profile.CanonicalSha256 &&
            prefixSeal.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            prefixSeal.PlanSha256 == bound.Plan.CanonicalSha256 &&
            prefixSeal.ApprovalSha256 == bound.Approval.CanonicalSha256 &&
            prefixSeal.HostSha256 == bound.Plan.HostSha256 &&
            prefixSeal.BootSha256 == bound.Plan.BootSha256 &&
            prefixSeal.RecordRoot == bound.Profile.RecordRoot &&
            prefixSeal.TerminalSlot == NativeHostStoreFileV3.ServiceGuardianBeforeComplete &&
            prefixSeal.TerminalPath == bound.Profile.RecordRoot + @"\" +
                NativeHostTranscriptShapeV3.Relative(
                    NativeHostStoreFileV3.ServiceGuardianBeforeComplete) &&
            prefixSeal.CanonicalSha256 ==
                NativeHostInputCodecV2.Hash(prefixSeal.CanonicalBytes()) &&
            context.HostSha256 == bound.Plan.HostSha256 &&
            context.BootSha256 == bound.Plan.BootSha256 &&
            context.OwnerSid == NativeHostProfileV2.OwnerSid &&
            context.WorkerSid == NativeHostProfileV2.OwnerSid,
            "NATIVE_RESERVATION_WINDOWS_SCOPE_REFUSED");
        intentPath = bound.Profile.RecordRoot + @"\" +
            NativeHostStageReservationV3.Relative(NativeHostReservationSlotV3.StandardUserIntent);
        reservationPath = bound.Profile.RecordRoot + @"\" +
            NativeHostStageReservationV3.Relative(NativeHostReservationSlotV3.StandardUserLaunchReserved);
        lock (RetainedGate) Retained.Add(this); // root even partially entered operations
    }

    private static void Need([DoesNotReturnIf(false)] bool okay, string code)
    {
        if (!okay) throw new InvalidDataException(code);
    }

    private T Operation<T>(Func<T> call)
    {
        if (Interlocked.CompareExchange(ref active, 1, 0) != 0) {
            Volatile.Write(ref faulted, 1);
            throw new InvalidDataException("NATIVE_RESERVATION_WINDOWS_REENTRY_REFUSED");
        }
        try {
            Need(!Faulted, "NATIVE_RESERVATION_WINDOWS_CONSUMED");
            return call();
        } catch {
            Volatile.Write(ref faulted, 1);
            throw;
        } finally {
            Volatile.Write(ref active, 0);
        }
    }

    private void Gate(string point)
    {
        Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            RuntimeInformation.OSArchitecture == Architecture.X64 && !Faulted,
            "NATIVE_RESERVATION_WINDOWS_PLATFORM_OR_STATE_REFUSED");
        RequireNoImpersonation();
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent()) {
            Need(identity.User?.Value == NativeHostProfileV2.OwnerSid,
                "NATIVE_RESERVATION_WINDOWS_OWNER_TOKEN_REFUSED");
        }
        trustedGuard(point);
        RequireNoImpersonation();
        Need(!Faulted, "NATIVE_RESERVATION_WINDOWS_REENTRY_POISONED");
    }

    private static void RequireNoImpersonation()
    {
        bool opened = OpenThreadToken(GetCurrentThread(), 0x00000008, true,
            out SafeAccessTokenHandle token);
        int error = Marshal.GetLastWin32Error();
        if (opened) {
            token.Dispose();
            throw new InvalidDataException("NATIVE_RESERVATION_WINDOWS_IMPERSONATION_REFUSED");
        }
        token?.Dispose();
        Need(error == ErrorNoToken, "NATIVE_RESERVATION_WINDOWS_THREAD_TOKEN_UNKNOWN");
    }

    private void Retain(SafeFileHandle? handle)
    {
        if (handle is not null) quarantined.Add(handle);
    }

    private static string ChildPath(string parent, string leaf) =>
        parent.EndsWith('\\') ? parent + leaf : parent + @"\" + leaf;

    private static void ExactLeaf(string leaf)
    {
        Need(leaf is { Length: > 0 and <= 96 } && leaf != "." && leaf != ".." &&
            leaf.IndexOfAny(new[] { '\\', '/', ':', '\0' }) < 0,
            "NATIVE_RESERVATION_WINDOWS_LEAF_REFUSED");
    }

    private static byte[] OwnerOnlyDescriptor()
    {
        string sid = NativeHostProfileV2.OwnerSid;
        var descriptor = new RawSecurityDescriptor(
            "O:" + sid + "G:" + sid + "D:P(A;;FA;;;SY)(A;;FA;;;" + sid + ")");
        byte[] raw = new byte[descriptor.BinaryLength];
        descriptor.GetBinaryForm(raw, 0);
        ValidateOwnerOnlyDescriptor(raw);
        return raw;
    }

    private static void ValidateOwnerOnlyDescriptor(byte[] raw)
    {
        Need(raw is { Length: >= 20 and <= 65536 },
            "NATIVE_RESERVATION_WINDOWS_ACL_SIZE_REFUSED");
        RawSecurityDescriptor descriptor;
        try { descriptor = new RawSecurityDescriptor(raw, 0); }
        catch (Exception e) when (e is ArgumentException or IndexOutOfRangeException) {
            throw new InvalidDataException("NATIVE_RESERVATION_WINDOWS_ACL_PARSE_REFUSED", e);
        }
        RawAcl? acl = descriptor.DiscretionaryAcl;
        Need(descriptor.Owner?.Value == NativeHostProfileV2.OwnerSid &&
            descriptor.Group?.Value == NativeHostProfileV2.OwnerSid &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclPresent) &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) &&
            descriptor.SystemAcl is null && acl is { Count: 2 },
            "NATIVE_RESERVATION_WINDOWS_ACL_HEADER_REFUSED");
        var expected = new HashSet<string>(StringComparer.Ordinal) {
            NativeHostProfileV2.OwnerSid, NativeHostProfileV2.SystemSid
        };
        foreach (GenericAce ace in acl) {
            Need(ace is CommonAce common && common.AceType == AceType.AccessAllowed &&
                common.AceFlags == AceFlags.None && common.AccessMask == FileAllAccess &&
                expected.Remove(common.SecurityIdentifier.Value),
                "NATIVE_RESERVATION_WINDOWS_ACL_ACE_REFUSED");
        }
        Need(expected.Count == 0, "NATIVE_RESERVATION_WINDOWS_ACL_MISSING_ACE");
    }

    private static byte[] Descriptor(SafeFileHandle native)
    {
        uint status = GetSecurityInfo(native, 1, 7, out _, out _, out _, out _,
            out IntPtr pointer);
        try {
            Need(status == 0 && pointer != IntPtr.Zero,
                "NATIVE_RESERVATION_WINDOWS_DESCRIPTOR_REFUSED");
            int length = checked((int)GetSecurityDescriptorLength(pointer));
            Need(length is >= 20 and <= 65536,
                "NATIVE_RESERVATION_WINDOWS_DESCRIPTOR_LENGTH_REFUSED");
            byte[] bytes = new byte[length];
            Marshal.Copy(pointer, bytes, 0, length);
            return bytes;
        } finally {
            if (pointer != IntPtr.Zero) _ = LocalFree(pointer);
        }
    }

    private Sample Inspect(SafeFileHandle native, string expectedPath,
        bool directory, bool ownerOnly)
    {
        Gate("BEFORE_INSPECT_" + expectedPath);
        Need(!native.IsInvalid && !native.IsClosed,
            "NATIVE_RESERVATION_WINDOWS_CLOSED_HANDLE_REFUSED");
        Need(GetFileInformationByHandle(native, out ByHandleInfo basic),
            "NATIVE_RESERVATION_WINDOWS_BASIC_INFORMATION_REFUSED");
        Need(GetFileInformationByHandleEx(native, FileIdInfoClass, out FileIdInfo full,
                (uint)Marshal.SizeOf<FileIdInfo>()),
            "NATIVE_RESERVATION_WINDOWS_INFORMATION_REFUSED");
        Span<byte> idBytes = stackalloc byte[16];
        BinaryPrimitives.WriteUInt64LittleEndian(idBytes[..8], full.FileId.Low);
        BinaryPrimitives.WriteUInt64LittleEndian(idBytes[8..], full.FileId.High);
        var id = new NativeHostFileIdInfoV2(full.VolumeSerialNumber,
            Convert.ToHexString(idBytes).ToLowerInvariant());
        var path = new StringBuilder(32768);
        uint length = GetFinalPathNameByHandleW(native, path, (uint)path.Capacity, 0);
        byte[] descriptor = Descriptor(native);
        Need(length > 0 && length < (uint)path.Capacity &&
            path.ToString() == @"\\?\" + expectedPath &&
            GetFileType(native) == 1 &&
            (basic.Attributes & 0x1400u) == 0 &&
            ((basic.Attributes & 0x10u) != 0) == directory &&
            basic.Links == 1 && id.VolumeSerialNumber != 0 &&
            id.FileId128LowerHex != new string('0', 32),
            "NATIVE_RESERVATION_WINDOWS_OBJECT_REFUSED");
        if (ownerOnly) ValidateOwnerOnlyDescriptor(descriptor);
        long size = checked((long)(((ulong)basic.SizeHigh << 32) | basic.SizeLow));
        var sample = new Sample(path.ToString(), 1, basic.Attributes, basic.Links,
            id, basic.Creation, size, descriptor);
        Gate("AFTER_INSPECT_" + expectedPath);
        return sample;
    }

    private static void SameSample(Sample first, Sample second)
    {
        Need(first.Path == second.Path && first.Type == second.Type &&
            first.Attributes == second.Attributes && first.Links == second.Links &&
            first.Id == second.Id && first.CreationFileTimeUtc == second.CreationFileTimeUtc &&
            first.Length == second.Length &&
            first.Descriptor.AsSpan().SequenceEqual(second.Descriptor),
            "NATIVE_RESERVATION_WINDOWS_OBJECT_CHANGED");
    }

    private static bool AllowedPostWriteAttributes(uint before, uint after)
    {
        uint changed = before ^ after;
        return (changed & ~(FileAttributeArchive | FileAttributeNormal)) == 0 &&
            ((before & FileAttributeArchive) == 0 ||
                (after & FileAttributeArchive) != 0) &&
            ((after & FileAttributeNormal) == 0 ||
                (before & FileAttributeNormal) != 0);
    }

    private Held OpenRoot()
    {
        Gate("BEFORE_VOLUME_OPEN");
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        SafeFileHandle native = CreateFileW(@"C:\", ReadControl | Synchronize |
            Traverse | ReadAttributes, ShareRead, ref attributes, 3,
            BackupSemantics | OpenReparsePoint, IntPtr.Zero);
        Retain(native); // before status, inspection or a callback
        Need(native is not null && !native.IsInvalid,
            "NATIVE_RESERVATION_WINDOWS_VOLUME_OPEN_REFUSED");
        Sample sample = Inspect(native, @"C:\", true, false);
        return new Held(native, @"C:\", sample);
    }

    private Held OpenDirectory(Held parent, string leaf, string expectedPath,
        bool ownerOnly)
    {
        ExactLeaf(leaf);
        Need(ChildPath(parent.Path, leaf) == expectedPath,
            "NATIVE_RESERVATION_WINDOWS_DIRECTORY_SCOPE_REFUSED");
        SameSample(parent.Initial, Inspect(parent.Native, parent.Path, true, false));
        bool held = false;
        IntPtr name = IntPtr.Zero;
        IntPtr unicode = IntPtr.Zero;
        try {
            parent.Native.DangerousAddRef(ref held);
            name = Marshal.StringToHGlobalUni(leaf);
            var text = new UnicodeName {
                Length = checked((ushort)(leaf.Length * 2)),
                MaximumLength = checked((ushort)((leaf.Length + 1) * 2)),
                Buffer = name
            };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(text, unicode, false);
            var attributes = new ObjectAttributes {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.Native.DangerousGetHandle(),
                Name = unicode,
                Flags = ObjCaseInsensitive
            };
            Gate("BEFORE_DIRECTORY_OPEN_" + expectedPath);
            int status = NtCreateFile(out SafeFileHandle native,
                ReadControl | Synchronize | Traverse | ReadAttributes,
                ref attributes, out IoStatus io, IntPtr.Zero, 0, ShareRead,
                FileOpen, OpenReparsePoint | SynchronousIoNonalert,
                IntPtr.Zero, 0);
            Retain(native);
            Need(status == 0 && native is not null && !native.IsInvalid &&
                io.Information.ToUInt64() == FileOpened,
                "NATIVE_RESERVATION_WINDOWS_DIRECTORY_OPEN_REFUSED");
            Sample sample = Inspect(native, expectedPath, true, ownerOnly);
            Need(sample.Id.VolumeSerialNumber == parent.Initial.Id.VolumeSerialNumber &&
                sample.Id != parent.Initial.Id,
                "NATIVE_RESERVATION_WINDOWS_DIRECTORY_PARENT_REFUSED");
            SameSample(parent.Initial, Inspect(parent.Native, parent.Path, true, false));
            return new Held(native, expectedPath, sample);
        } finally {
            if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (held) parent.Native.DangerousRelease();
        }
    }

    private void EnsureParents()
    {
        if (directories.Count != 0) {
            CheckPrefixParents();
            return;
        }
        Held volume = OpenRoot();
        directories.Add(volume.Path, volume);
        Held programData = OpenDirectory(volume, "ProgramData", @"C:\ProgramData", false);
        directories.Add(programData.Path, programData);
        Held root = OpenDirectory(programData, "Ecs.Lic008.StandardNativeHostV1",
            NativeHostProfileV2.Root, false);
        directories.Add(root.Path, root);
        Held records = OpenDirectory(root, "records", NativeHostProfileV2.Root + @"\records", false);
        directories.Add(records.Path, records);
        Held attempt = OpenDirectory(records, bound.Profile.Attempt, bound.Profile.RecordRoot, false);
        directories.Add(attempt.Path, attempt);
        Held stage = OpenDirectory(attempt, "stage", bound.Profile.RecordRoot + @"\stage", true);
        directories.Add(stage.Path, stage);
        Held journal = OpenDirectory(attempt, "journal", bound.Profile.RecordRoot + @"\journal", true);
        directories.Add(journal.Path, journal);
        Need(directories.Count == 7, "NATIVE_RESERVATION_WINDOWS_TREE_REFUSED");
        CheckPrefixParents();
    }

    // Before a create, the held objects must be the same V3 objects whose
    // full identities were committed by the typed slot-40 prefix seal.
    private void CheckPrefixParents()
    {
        Need(directories.Count == 7 &&
            directories.TryGetValue(bound.Profile.RecordRoot, out Held? attempt) &&
            directories.TryGetValue(prefixSeal.StageDirectoryPath, out Held? stage) &&
            directories.TryGetValue(bound.Profile.RecordRoot + @"\journal", out Held? journal) &&
            prefixSeal.StageDirectoryPath == bound.Profile.RecordRoot + @"\stage" &&
            attempt!.Initial.Id.VolumeSerialNumber.ToString("x16") ==
                prefixSeal.VolumeSerial64 &&
            attempt.Initial.Id.FileId128LowerHex == prefixSeal.AttemptRootFileId128 &&
            stage!.Path == prefixSeal.StageDirectoryPath &&
            stage.Initial.Id.VolumeSerialNumber.ToString("x16") ==
                prefixSeal.StageDirectoryVolumeSerial64 &&
            stage.Initial.Id.VolumeSerialNumber == attempt.Initial.Id.VolumeSerialNumber &&
            stage.Initial.Id.FileId128LowerHex == prefixSeal.StageDirectoryFileId128 &&
            journal!.Initial.Id.VolumeSerialNumber == attempt.Initial.Id.VolumeSerialNumber &&
            journal.Initial.Id.FileId128LowerHex == prefixSeal.LastParentFileId128 &&
            attempt.Initial.Id != stage.Initial.Id &&
            attempt.Initial.Id != journal.Initial.Id &&
            stage.Initial.Id != journal.Initial.Id,
            "NATIVE_RESERVATION_WINDOWS_PREFIX_PARENT_ID_REFUSED");
    }

    private void CheckParents()
    {
        Need(directories.Count == 7, "NATIVE_RESERVATION_WINDOWS_PARENT_TREE_INCOMPLETE");
        foreach (Held held in directories.Values)
            SameSample(held.Initial, Inspect(held.Native, held.Path, true,
                held.Path.EndsWith(@"\stage", StringComparison.Ordinal) ||
                held.Path.EndsWith(@"\journal", StringComparison.Ordinal)));
        CheckPrefixParents();
    }

    private (Held Parent, string Leaf) Location(string path)
    {
        Need(path == intentPath || path == reservationPath,
            "NATIVE_RESERVATION_WINDOWS_UNKNOWN_PATH");
        string parentPath = path[..path.LastIndexOf('\\')];
        string leaf = path[(path.LastIndexOf('\\') + 1)..];
        ExactLeaf(leaf);
        Need(directories.TryGetValue(parentPath, out Held? parent),
            "NATIVE_RESERVATION_WINDOWS_PARENT_MISSING");
        return (parent!, leaf);
    }

    private static byte[] ReadExact(SafeFileHandle native, int maximum)
    {
        long size = RandomAccess.GetLength(native);
        Need(size > 0 && size <= maximum,
            "NATIVE_RESERVATION_WINDOWS_READ_SIZE_REFUSED");
        byte[] bytes = new byte[checked((int)size)];
        int offset = 0;
        while (offset < bytes.Length) {
            int read = RandomAccess.Read(native, bytes.AsSpan(offset), offset);
            Need(read > 0, "NATIVE_RESERVATION_WINDOWS_READ_SHORT");
            offset += read;
        }
        Need(RandomAccess.GetLength(native) == size,
            "NATIVE_RESERVATION_WINDOWS_READ_LENGTH_CHANGED");
        return bytes;
    }

    public bool? Exists(string exactPath) => Operation(() => {
        EnsureParents();
        CheckParents();
        (Held parent, string leaf) = Location(exactPath);
        bool held = false;
        IntPtr name = IntPtr.Zero;
        IntPtr unicode = IntPtr.Zero;
        try {
            parent.Native.DangerousAddRef(ref held);
            name = Marshal.StringToHGlobalUni(leaf);
            var text = new UnicodeName {
                Length = checked((ushort)(leaf.Length * 2)),
                MaximumLength = checked((ushort)((leaf.Length + 1) * 2)),
                Buffer = name
            };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(text, unicode, false);
            var attributes = new ObjectAttributes {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.Native.DangerousGetHandle(), Name = unicode,
                Flags = ObjCaseInsensitive
            };
            Gate("BEFORE_EXISTENCE_PROBE_" + exactPath);
            int status = NtCreateFile(out SafeFileHandle native,
                ReadControl | Synchronize | ReadAttributes, ref attributes,
                out IoStatus io, IntPtr.Zero, 0, ShareRead, FileOpen,
                OpenReparsePoint | SynchronousIoNonalert, IntPtr.Zero, 0);
            Retain(native);
            if (status == 0 && native is not null && !native.IsInvalid &&
                io.Information.ToUInt64() == FileOpened) {
                Volatile.Write(ref faulted, 1);
                return true;
            }
            Need(status == StatusObjectNameNotFound &&
                (native is null || native.IsInvalid),
                "NATIVE_RESERVATION_WINDOWS_EXISTENCE_UNKNOWN");
            Gate("AFTER_ABSENT_PROBE_" + exactPath);
            CheckParents();
            return false;
        } finally {
            if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (held) parent.Native.DangerousRelease();
        }
    });

    public NativeHostReservationReceiptV3 CreateNew(NativeHostReservationSlotV3 slot,
        string exactPath, byte[] original) => Operation(() => {
        EnsureParents();
        CheckParents();
        string required = slot switch {
            NativeHostReservationSlotV3.StandardUserIntent => intentPath,
            NativeHostReservationSlotV3.StandardUserLaunchReserved => reservationPath,
            _ => throw new InvalidDataException("NATIVE_RESERVATION_WINDOWS_UNKNOWN_SLOT")
        };
        Need(exactPath == required && original is { Length: > 0 } &&
            original.Length <= (slot == NativeHostReservationSlotV3.StandardUserIntent ?
                NativeHostUserIntentV3.MaximumBytes : NativeHostStageReservationV3.MaximumReservationBytes) &&
            (slot == NativeHostReservationSlotV3.StandardUserIntent || files.ContainsKey(intentPath)),
            "NATIVE_RESERVATION_WINDOWS_CREATE_SCOPE_REFUSED");
        byte[] bytes = (byte[])original.Clone();
        if (slot == NativeHostReservationSlotV3.StandardUserIntent) {
            _ = NativeHostUserIntentV3.ParseOwnerOriginal(bytes, bound, prefixSeal,
                NativeHostRole.Owner);
        } else {
            Need(files.TryGetValue(intentPath, out Held? intentHeld),
                "NATIVE_RESERVATION_WINDOWS_INTENT_NOT_HELD");
            Sample beforeIntent = Inspect(intentHeld.Native, intentPath, false, true);
            SameSample(intentHeld.Initial, beforeIntent);
            Gate("BEFORE_INTENT_BINDING_READ");
            byte[] intentBytes = ReadExact(intentHeld.Native,
                NativeHostUserIntentV3.MaximumBytes);
            Gate("AFTER_INTENT_BINDING_READ");
            SameSample(beforeIntent, Inspect(intentHeld.Native, intentPath, false, true));
            _ = NativeHostReservationOriginalV3.ParseCanonical(bytes, intentBytes,
                bound, prefixSeal, context, NativeHostRole.Owner, DateTimeOffset.UtcNow);
        }
        (Held parent, string leaf) = Location(exactPath);
        byte[] descriptor = OwnerOnlyDescriptor();
        bool held = false;
        IntPtr name = IntPtr.Zero;
        IntPtr unicode = IntPtr.Zero;
        GCHandle pin = default;
        try {
            parent.Native.DangerousAddRef(ref held);
            name = Marshal.StringToHGlobalUni(leaf);
            var text = new UnicodeName {
                Length = checked((ushort)(leaf.Length * 2)),
                MaximumLength = checked((ushort)((leaf.Length + 1) * 2)),
                Buffer = name
            };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(text, unicode, false);
            pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
            var attributes = new ObjectAttributes {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.Native.DangerousGetHandle(), Name = unicode,
                Flags = ObjCaseInsensitive, SecurityDescriptor = pin.AddrOfPinnedObject()
            };
            Gate("BEFORE_CREATE_NEW_" + exactPath);
            int status = NtCreateFile(out SafeFileHandle native,
                GenericRead | GenericWrite | ReadControl | Synchronize | ReadAttributes,
                ref attributes, out IoStatus io, IntPtr.Zero, FileAttributeNormal,
                0, FileCreate,
                OpenReparsePoint | SynchronousIoNonalert | NonDirectoryFile | WriteThrough,
                IntPtr.Zero, 0);
            Retain(native); // even an invalid/unknown output is rooted first
            Need(status == 0 && native is not null && !native.IsInvalid &&
                io.Information.ToUInt64() == FileCreated,
                "NATIVE_RESERVATION_WINDOWS_CREATE_UNKNOWN_OR_COLLISION");
            Sample before = Inspect(native, exactPath, false, true);
            Need(before.Id.VolumeSerialNumber == parent.Initial.Id.VolumeSerialNumber &&
                before.Id != parent.Initial.Id && before.Length == 0,
                "NATIVE_RESERVATION_WINDOWS_CREATED_OBJECT_REFUSED");
            Gate("BEFORE_WRITE_" + exactPath);
            RandomAccess.Write(native, bytes, 0);
            Gate("BEFORE_FLUSH_" + exactPath);
            RandomAccess.FlushToDisk(native);
            Gate("AFTER_FLUSH_" + exactPath);
            Sample after = Inspect(native, exactPath, false, true);
            Need(after.Id == before.Id && after.Length == bytes.Length &&
                after.CreationFileTimeUtc == before.CreationFileTimeUtc &&
                AllowedPostWriteAttributes(before.Attributes, after.Attributes) &&
                after.Descriptor.AsSpan().SequenceEqual(before.Descriptor),
                "NATIVE_RESERVATION_WINDOWS_WRITTEN_OBJECT_CHANGED");
            byte[] readback = ReadExact(native, bytes.Length);
            Need(readback.AsSpan().SequenceEqual(bytes),
                "NATIVE_RESERVATION_WINDOWS_READBACK_CHANGED");
            CheckParents();
            DateTimeOffset written = DateTimeOffset.UtcNow;
            files.Add(exactPath, new Held(native, exactPath, after));
            return new NativeHostReservationReceiptV3(slot, exactPath,
                Convert.ToHexStringLower(SHA256.HashData(bytes)), bytes.Length,
                written, before.CreationFileTimeUtc,
                after.Id.VolumeSerialNumber.ToString("x16"), after.Id.FileId128LowerHex,
                parent.Path, parent.Initial.Id.VolumeSerialNumber.ToString("x16"),
                parent.Initial.Id.FileId128LowerHex, leaf,
                true, true, true, true, true, true, true);
        } finally {
            if (pin.IsAllocated) pin.Free();
            if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (held) parent.Native.DangerousRelease();
        }
    });

    public byte[] ReadOriginal(string exactPath) => Operation(() => {
        EnsureParents();
        CheckParents();
        _ = Location(exactPath);
        Need(files.TryGetValue(exactPath, out Held? held),
            "NATIVE_RESERVATION_WINDOWS_UNHELD_ORIGINAL_REFUSED");
        Sample before = Inspect(held.Native, held.Path, false, true);
        SameSample(held.Initial, before);
        int maximum = exactPath == intentPath ? NativeHostUserIntentV3.MaximumBytes :
            NativeHostStageReservationV3.MaximumReservationBytes;
        Gate("BEFORE_READ_ORIGINAL_" + exactPath);
        byte[] raw = ReadExact(held.Native, maximum);
        Gate("AFTER_READ_ORIGINAL_" + exactPath);
        SameSample(before, Inspect(held.Native, held.Path, false, true));
        CheckParents();
        return raw;
    });

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
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenThreadToken(IntPtr thread, uint access,
        [MarshalAs(UnmanagedType.Bool)] bool openAsSelf,
        out SafeAccessTokenHandle token);
}
#endif
