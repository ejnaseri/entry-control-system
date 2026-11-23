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

// A one-use C:\ProgramData sibling placement diagnostic, never the W03 root.
// No caller-selected protected path, account, service or key API.
[SupportedOSPlatform("windows")]
internal static class NativeHostProgramDataPlacementProbeV1
{
    private const string OutRoot = @"E:\EntryControlSystem\out";
    private const string ProgramDataPath = @"C:\ProgramData";
    private const string ProbeRootPrefix = "Ecs.Lic008.StandardNativeHostPlacementProbeV1.";
    private const string OwnerSid = "S-1-5-21-3058020570-171625005-1532683838-1001";
    private const string SystemSid = "S-1-5-18";
    private const string SourceLeaf = "NativeHostProgramDataPlacementProbeV1.cs";
    private const string Schema = "TEST_ONLY_LIC008_PROGRAMDATA_PLACEMENT_FEASIBILITY_V1";
    private const uint ReadControl = 0x00020000;
    private const uint Synchronize = 0x00100000;
    private const uint Traverse = 0x00000020;
    private const uint ReadAttributes = 0x00000080;
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint FileAttributeNormal = 0x00000080;
    private const uint FileAttributeArchive = 0x00000020;
    private const uint FileCreate = 2;
    private const uint FileOpen = 1;
    private const uint AddFile = 0x00000002;
    private const uint AddSubdirectory = 0x00000004;
    private const uint ShareRead = 1;
    private const uint DirectoryFile = 0x00000001;
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
    private static readonly byte[] StageContent = Encoding.ASCII.GetBytes(
        "LIC008_PROGRAMDATA_STAGE_V1\n");
    private static readonly byte[] JournalContent = Encoding.ASCII.GetBytes(
        "LIC008_PROGRAMDATA_JOURNAL_V1\n");
    private static readonly List<SafeFileHandle> RetainedHandles = new();

    private sealed class Report
    {
        public string Schema { get; set; } = NativeHostProgramDataPlacementProbeV1.Schema;
        public string Status { get; set; } = "INCOMPLETE";
        public string SourceSha256 { get; set; } = "";
        public string AttemptDirectory { get; set; } = "";
        public string ProbeRoot { get; set; } = "";
        public string TokenUserSid { get; set; } = "";
        public string TokenOwnerSid { get; set; } = "";
        public string TokenPrimaryGroupSid { get; set; } = "";
        public string RequestedSddl { get; set; } = "";
        public string? RequestedDescriptorSha256 { get; set; }
        public List<ObjectReport> Objects { get; set; } = new();
        public string? ErrorCode { get; set; }
        public bool AccountChanged { get; set; }
        public bool ServiceChanged { get; set; }
        public bool KeyChanged { get; set; }
        public bool ProtectedW03RootPlaced { get; set; }
        public bool DirectoryEntryCrashDurabilityProven { get; set; }
        public bool CrossProcessCustodyProven { get; set; }
        public bool StandardUserDenialProven { get; set; }
        public bool W03Admitted { get; set; }
        public bool Lic008Closed { get; set; }
    }

    private sealed record Held(SafeFileHandle Handle, ObjectReport Initial,
        bool ExactAcl);
    private sealed class ObjectReport
    {
        public string Label { get; set; } = "";
        public string Path { get; set; } = "";
        public string Kind { get; set; } = "";
        public string VolumeSerial64 { get; set; } = "";
        public string FileId128 { get; set; } = "";
        public uint Attributes { get; set; }
        public uint LinkCount { get; set; }
        public long CreationFileTimeUtc { get; set; }
        public long Length { get; set; }
        public string OwnerSid { get; set; } = "";
        public string GroupSid { get; set; } = "";
        public string DescriptorBase64 { get; set; } = "";
        public string DescriptorSha256 { get; set; } = "";
        public string? ContentSha256 { get; set; }
    }

    internal static int Main(string[] args)
    {
        if (args.Length != 3 || args[0] != "--probe" ||
            args[1] != "--reviewed-source-sha256" ||
            !Regex.IsMatch(args[2], "\\A[0-9a-f]{64}\\z", RegexOptions.CultureInvariant)) {
            Console.Error.WriteLine("PROGRAMDATA_PLACEMENT_PROBE_V1_ENTRY_CLOSED");
            return 2;
        }
        string attempt = "";
        bool intentWritten = false;
        var report = new Report { SourceSha256 = args[2] };
        try {
            attempt = ExactAttemptDirectory();
            report.AttemptDirectory = attempt;
            string guid = Path.GetFileName(attempt)[
                "lic008-programdata-placement-probe-v1-".Length..];
            report.ProbeRoot = Path.Combine(ProgramDataPath, ProbeRootPrefix + guid);
            string source = Path.Combine(attempt, SourceLeaf);
            FileInfo sourceInfo = new(source);
            Need(sourceInfo.Exists && sourceInfo.Length is > 0 and <= 1048576 &&
                (sourceInfo.Attributes & FileAttributes.ReparsePoint) == 0 &&
                Hash(File.ReadAllBytes(source)) == args[2],
                "PROGRAMDATA_PLACEMENT_PROBE_V1_SOURCE_CHANGED");
            SaveNew(Path.Combine(attempt, "probe-intent.json"), new {
                schema = Schema, status = "CONSUMED_BEFORE_NATIVE_CALL",
                sourceSha256 = args[2], attemptDirectory = attempt,
                probeRoot = report.ProbeRoot,
                stageLeaf = "stage-exact.bin", journalLeaf = "journal-exact.bin",
                stageContentSha256 = Hash(StageContent),
                journalContentSha256 = Hash(JournalContent),
                requestedSddl = Sddl(), utc = DateTimeOffset.UtcNow,
                noRetry = true, noDelete = true,
                protectedW03RootPlaced = false,
                directoryEntryCrashDurabilityProven = false,
                crossProcessCustodyProven = false,
                standardUserDenialProven = false,
                w03Admission = false
            });
            intentWritten = true;
            Probe(attempt, report);
            report.Status = "FEASIBILITY_OBSERVED";
            SaveNew(Path.Combine(attempt, "probe-result.json"), report);
            Console.Out.WriteLine("PROGRAMDATA_PLACEMENT_PROBE_V1_FEASIBILITY_OBSERVED");
            return 0;
        } catch (Exception e) {
            report.Status = "REFUSED_OR_UNKNOWN";
            report.ErrorCode = e is InvalidDataException ? e.Message : e.GetType().Name;
            if (intentWritten) {
                try { SaveNew(Path.Combine(attempt, "probe-result.json"), report); }
                catch { /* Preserve intent and any partial tree; no retry. */ }
            }
            Console.Error.WriteLine("PROGRAMDATA_PLACEMENT_PROBE_V1_REFUSED_OR_UNKNOWN");
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
            "PROGRAMDATA_PLACEMENT_PROBE_V1_PLATFORM_REFUSED");
        DirectoryInfo binary = new(Path.GetFullPath(AppContext.BaseDirectory));
        DirectoryInfo? release = binary.Parent;
        DirectoryInfo? bin = release?.Parent;
        DirectoryInfo? attempt = bin?.Parent;
        Need(binary.Name == "net10.0" && release?.Name == "Release" &&
            bin?.Name == "bin", "PROGRAMDATA_PLACEMENT_PROBE_V1_BINARY_LOCATION_REFUSED");
        Need(attempt is not null && attempt.Parent is not null &&
            attempt.Parent.FullName.Equals(OutRoot, StringComparison.OrdinalIgnoreCase) &&
            Regex.IsMatch(attempt.Name,
                "\\Alic008-programdata-placement-probe-v1-[0-9a-f]{32}\\z",
                RegexOptions.CultureInvariant),
            "PROGRAMDATA_PLACEMENT_PROBE_V1_ATTEMPT_LOCATION_REFUSED");
        for (DirectoryInfo? cursor = binary; cursor is not null; cursor = cursor.Parent) {
            Need((cursor.Attributes & FileAttributes.ReparsePoint) == 0,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_REPARSE_REFUSED");
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
            "PROGRAMDATA_PLACEMENT_PROBE_V1_DESCRIPTOR_LENGTH_REFUSED");
        RawSecurityDescriptor descriptor = new(raw, 0);
        RawAcl? acl = descriptor.DiscretionaryAcl;
        Need(descriptor.Owner?.Value == OwnerSid && descriptor.Group?.Value == OwnerSid &&
            descriptor.SystemAcl is null &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclPresent) &&
            descriptor.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) &&
            acl is { Count: 2 }, "PROGRAMDATA_PLACEMENT_PROBE_V1_DESCRIPTOR_HEADER_REFUSED");
        var expected = new HashSet<string>(StringComparer.Ordinal) { OwnerSid, SystemSid };
        foreach (GenericAce ace in acl) {
            Need(ace is CommonAce common && common.AceType == AceType.AccessAllowed &&
                common.AceFlags == AceFlags.None && common.AccessMask == FileAllAccess &&
                expected.Remove(common.SecurityIdentifier.Value),
                "PROGRAMDATA_PLACEMENT_PROBE_V1_DESCRIPTOR_ACE_REFUSED");
        }
        Need(expected.Count == 0, "PROGRAMDATA_PLACEMENT_PROBE_V1_DESCRIPTOR_MISSING_ACE");
        return (descriptor.Owner!.Value, descriptor.Group!.Value);
    }

    private static void NoImpersonation()
    {
        bool opened = OpenThreadToken(GetCurrentThread(), 0x00000008, true,
            out SafeAccessTokenHandle token);
        int error = Marshal.GetLastWin32Error();
        if (opened) {
            token.Dispose();
            throw new InvalidDataException("PROGRAMDATA_PLACEMENT_PROBE_V1_IMPERSONATION_REFUSED");
        }
        token?.Dispose();
        Need(error == ErrorNoToken, "PROGRAMDATA_PLACEMENT_PROBE_V1_THREAD_TOKEN_UNKNOWN");
    }

    private static string TokenSid(SafeAccessTokenHandle token, int informationClass)
    {
        bool first = GetTokenInformation(token, informationClass, IntPtr.Zero, 0,
            out uint length);
        int error = Marshal.GetLastWin32Error();
        Need(!first && error == ErrorInsufficientBuffer &&
            length >= IntPtr.Size && length <= 65536,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_TOKEN_LENGTH_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal(checked((int)length));
        try {
            Need(GetTokenInformation(token, informationClass, buffer, length,
                out uint written) && written >= IntPtr.Size && written <= length,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_TOKEN_QUERY_REFUSED");
            IntPtr sid = Marshal.ReadIntPtr(buffer);
            Need(sid != IntPtr.Zero,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_TOKEN_SID_REFUSED");
            return new SecurityIdentifier(sid).Value;
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    private static void StepIntent(string attempt, int step, string label,
        string path, string parent)
    {
        SaveNew(Path.Combine(attempt, $"probe-step-{step:D2}-intent.json"), new {
            schema = Schema, step, label, path, parent,
            operation = "NT_CREATE_FILE_FILE_CREATE", utc = DateTimeOffset.UtcNow,
            noRetry = true, noDelete = true
        });
    }

    private static SafeFileHandle Relative(SafeFileHandle parent, string leaf,
        string expectedPath, byte[]? descriptor, bool directory, bool create,
        string attempt, int step)
    {
        Need(leaf.Length is > 0 and <= 96 && leaf != "." && leaf != ".." &&
            leaf.IndexOfAny(new[] { '\\', '/', ':', '\0' }) < 0,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_LEAF_REFUSED");
        bool parentRef = false;
        IntPtr name = IntPtr.Zero;
        IntPtr unicode = IntPtr.Zero;
        GCHandle pin = default;
        try {
            parent.DangerousAddRef(ref parentRef);
            name = Marshal.StringToHGlobalUni(leaf);
            UnicodeName text = new() {
                Length = checked((ushort)(leaf.Length * 2)),
                MaximumLength = checked((ushort)((leaf.Length + 1) * 2)),
                Buffer = name
            };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>());
            Marshal.StructureToPtr(text, unicode, false);
            if (descriptor is not null) pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
            ObjectAttributes attributes = new() {
                Length = Marshal.SizeOf<ObjectAttributes>(),
                Root = parent.DangerousGetHandle(), Name = unicode,
                Flags = ObjCaseInsensitive,
                SecurityDescriptor = pin.IsAllocated ? pin.AddrOfPinnedObject() : IntPtr.Zero
            };
            if (create) StepIntent(attempt, step,
                directory ? "DIRECTORY" : "FILE", expectedPath,
                Path.GetDirectoryName(expectedPath)!);
            NoImpersonation();
            uint options = create
                ? (directory ? DirectoryFile | SynchronousIoNonalert | WriteThrough
                    : OpenReparsePoint | SynchronousIoNonalert | NonDirectoryFile | WriteThrough)
                : OpenReparsePoint | SynchronousIoNonalert;
            uint directoryAccess = ReadControl | Synchronize | Traverse |
                ReadAttributes | AddFile | AddSubdirectory;
            uint fileAccess = GenericRead | GenericWrite | ReadControl |
                Synchronize | ReadAttributes;
            uint access = create
                ? (directory ? directoryAccess : fileAccess)
                : ReadControl | Synchronize | Traverse | ReadAttributes |
                    AddSubdirectory;
            int status = NtCreateFile(out SafeFileHandle child, access,
                ref attributes, out IoStatus io, IntPtr.Zero,
                create && !directory ? FileAttributeNormal : 0,
                create && !directory ? 0 : ShareRead,
                create ? FileCreate : FileOpen, options, IntPtr.Zero, 0);
            if (child is not null) RetainedHandles.Add(child);
            if (create) SaveNew(Path.Combine(attempt, $"probe-step-{step:D2}-native.json"), new {
                schema = Schema, step, path = expectedPath,
                ntStatus = "0x" + unchecked((uint)status).ToString("x8"),
                ioInformation = io.Information.ToUInt64(),
                outputHandlePresent = child is not null,
                outputHandleValid = child is not null && !child.IsInvalid,
                utc = DateTimeOffset.UtcNow, noRetry = true
            });
            Need(status == 0 && child is not null && !child.IsInvalid &&
                io.Information.ToUInt64() == (create ? 2ul : 1ul),
                "PROGRAMDATA_PLACEMENT_PROBE_V1_NATIVE_OPEN_OR_CREATE_REFUSED");
            NoImpersonation();
            return child;
        } finally {
            if (pin.IsAllocated) pin.Free();
            if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (parentRef) parent.DangerousRelease();
        }
    }

    private static ObjectReport Inspect(SafeFileHandle handle, string label,
        string expectedPath, bool directory, bool exactAcl)
    {
        Need(GetFileInformationByHandle(handle, out ByHandleInfo basic),
            "PROGRAMDATA_PLACEMENT_PROBE_V1_BASIC_METADATA_REFUSED");
        Need(GetFileInformationByHandleEx(handle, FileIdInfoClass, out FileIdInfo full,
                (uint)Marshal.SizeOf<FileIdInfo>()),
            "PROGRAMDATA_PLACEMENT_PROBE_V1_FULL_METADATA_REFUSED");
        StringBuilder path = new(32768);
        uint length = GetFinalPathNameByHandleW(handle, path, (uint)path.Capacity, 0);
        Need(length > 0 && length < (uint)path.Capacity &&
            path.ToString().Equals(@"\\?\" + expectedPath,
                StringComparison.OrdinalIgnoreCase) &&
            GetFileType(handle) == 1 && basic.Links == 1 &&
            (basic.Attributes & 0x1400u) == 0 &&
            ((basic.Attributes & 0x10u) != 0) == directory,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_OBJECT_REFUSED");
        Span<byte> id = stackalloc byte[16];
        BinaryPrimitives.WriteUInt64LittleEndian(id[..8], full.FileId.Low);
        BinaryPrimitives.WriteUInt64LittleEndian(id[8..], full.FileId.High);
        string idHex = Convert.ToHexString(id).ToLowerInvariant();
        Need(full.VolumeSerialNumber != 0 && idHex != new string('0', 32),
            "PROGRAMDATA_PLACEMENT_PROBE_V1_FULL_ID_REFUSED");
        byte[] raw = GetDescriptor(handle);
        string owner;
        string group;
        if (exactAcl) (owner, group) = ValidateDescriptor(raw);
        else {
            RawSecurityDescriptor observed = new(raw, 0);
            Need(observed.Owner is not null && observed.Group is not null,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_ANCESTOR_DESCRIPTOR_REFUSED");
            owner = observed.Owner.Value;
            group = observed.Group.Value;
        }
        return new ObjectReport {
            Label = label, Path = expectedPath,
            Kind = directory ? "DIRECTORY" : "FILE",
            VolumeSerial64 = full.VolumeSerialNumber.ToString("x16"),
            FileId128 = idHex, Attributes = basic.Attributes,
            LinkCount = basic.Links, CreationFileTimeUtc = basic.Creation,
            Length = checked((long)(((ulong)basic.SizeHigh << 32) | basic.SizeLow)),
            OwnerSid = owner, GroupSid = group,
            DescriptorBase64 = Convert.ToBase64String(raw),
            DescriptorSha256 = Hash(raw)
        };
    }

    private static void SameIdentityAndAcl(ObjectReport before, ObjectReport after,
        bool afterFileWrite = false)
    {
        // A file write can set ARCHIVE and clear NORMAL; no other attribute
        // transition is admitted. Every sample separately rejects reparse/offline.
        bool archiveSet = afterFileWrite && before.Kind == "FILE" &&
            (before.Attributes & FileAttributeArchive) == 0 &&
            (after.Attributes & FileAttributeArchive) != 0 &&
            (after.Attributes & FileAttributeNormal) == 0 &&
            ((before.Attributes & FileAttributeNormal) == 0 ||
                before.Attributes == FileAttributeNormal) &&
            (before.Attributes & ~(FileAttributeArchive | FileAttributeNormal)) ==
                (after.Attributes & ~(FileAttributeArchive | FileAttributeNormal));
        Need(before.Path == after.Path && before.Kind == after.Kind &&
            before.VolumeSerial64 == after.VolumeSerial64 &&
            before.FileId128 == after.FileId128 &&
            (before.Attributes == after.Attributes || archiveSet) &&
            before.LinkCount == after.LinkCount &&
            before.CreationFileTimeUtc == after.CreationFileTimeUtc &&
            before.OwnerSid == after.OwnerSid && before.GroupSid == after.GroupSid &&
            before.DescriptorSha256 == after.DescriptorSha256,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_OBJECT_CHANGED");
    }

    private static void Probe(string attempt, Report report)
    {
        NoImpersonation();
        Need(OpenProcessToken(GetCurrentProcess(), 0x00000008,
            out SafeAccessTokenHandle token) && token is not null && !token.IsInvalid,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_TOKEN_OPEN_REFUSED");
        using (token) {
            report.TokenUserSid = TokenSid(token, 1);
            report.TokenOwnerSid = TokenSid(token, 4);
            report.TokenPrimaryGroupSid = TokenSid(token, 5);
        }
        Need(report.TokenUserSid == OwnerSid,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_USER_SID_REFUSED");
        report.RequestedSddl = Sddl();
        byte[] descriptor = Descriptor();
        report.RequestedDescriptorSha256 = Hash(descriptor);
        var held = new List<Held>();
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        NoImpersonation();
        SafeFileHandle volume = CreateFileW(@"C:\", ReadControl | Synchronize |
            Traverse | ReadAttributes, ShareRead, ref attributes, 3,
            BackupSemantics | OpenReparsePoint, IntPtr.Zero);
        if (volume is not null) RetainedHandles.Add(volume);
        Need(volume is not null && !volume.IsInvalid,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_VOLUME_OPEN_REFUSED");
        void Add(SafeFileHandle handle, string label, string path,
            bool directory, bool exactAcl, int step)
        {
            ObjectReport observed = Inspect(handle, label, path, directory, exactAcl);
            Need(report.Objects.Count == 0 ||
                observed.VolumeSerial64 == report.Objects[0].VolumeSerial64,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_VOLUME_CHANGED");
            Need(!report.Objects.Exists(x => x.FileId128 == observed.FileId128),
                "PROGRAMDATA_PLACEMENT_PROBE_V1_FILE_ID_ALIAS_REFUSED");
            report.Objects.Add(observed);
            held.Add(new Held(handle, observed, exactAcl));
            if (step != 0) SaveNew(Path.Combine(attempt,
                $"probe-step-{step:D2}-observed.json"), observed);
        }
        void CheckParent(SafeFileHandle handle, ObjectReport initial, bool exactAcl) =>
            SameIdentityAndAcl(initial, Inspect(handle, initial.Label,
                initial.Path, true, exactAcl));
        Add(volume, "volume", @"C:\", true, false, 0);
        CheckParent(volume, report.Objects[0], false);
        SafeFileHandle programData = Relative(volume, "ProgramData", ProgramDataPath,
            null, true, false, attempt, 0);
        Add(programData, "programData", ProgramDataPath, true, false, 0);
        string guid = Path.GetFileName(attempt)[
            "lic008-programdata-placement-probe-v1-".Length..];
        string rootPath = Path.Combine(ProgramDataPath, ProbeRootPrefix + guid);
        Need(rootPath == report.ProbeRoot &&
            rootPath != @"C:\ProgramData\Ecs.Lic008.StandardNativeHostV1",
            "PROGRAMDATA_PLACEMENT_PROBE_V1_ROOT_SCOPE_REFUSED");
        CheckParent(programData, report.Objects[1], false);
        SafeFileHandle root = Relative(programData, ProbeRootPrefix + guid,
            rootPath, descriptor, true, true, attempt, 1);
        Add(root, "probeRoot", rootPath, true, true, 1);
        string recordsPath = Path.Combine(rootPath, "records");
        CheckParent(root, report.Objects[2], true);
        SafeFileHandle records = Relative(root, "records", recordsPath,
            descriptor, true, true, attempt, 2);
        Add(records, "records", recordsPath, true, true, 2);
        string attemptPath = Path.Combine(recordsPath, guid);
        CheckParent(records, report.Objects[3], true);
        SafeFileHandle recordAttempt = Relative(records, guid, attemptPath,
            descriptor, true, true, attempt, 3);
        Add(recordAttempt, "recordAttempt", attemptPath, true, true, 3);
        string stagePath = Path.Combine(attemptPath, "stage");
        CheckParent(recordAttempt, report.Objects[4], true);
        SafeFileHandle stage = Relative(recordAttempt, "stage", stagePath,
            descriptor, true, true, attempt, 4);
        Add(stage, "stage", stagePath, true, true, 4);
        string journalPath = Path.Combine(attemptPath, "journal");
        CheckParent(recordAttempt, report.Objects[4], true);
        SafeFileHandle journal = Relative(recordAttempt, "journal", journalPath,
            descriptor, true, true, attempt, 5);
        Add(journal, "journal", journalPath, true, true, 5);
        CreateFixedChild(stage, stagePath, "stage-exact.bin", StageContent,
            descriptor, attempt, report, held, 6);
        CreateFixedChild(journal, journalPath, "journal-exact.bin", JournalContent,
            descriptor, attempt, report, held, 7);
        foreach (Held entry in held) {
            ObjectReport final = Inspect(entry.Handle, entry.Initial.Label,
                entry.Initial.Path, entry.Initial.Kind == "DIRECTORY", entry.ExactAcl);
            SameIdentityAndAcl(entry.Initial, final);
            if (entry.Initial.Kind == "FILE")
                Need(final.Length == entry.Initial.Length,
                    "PROGRAMDATA_PLACEMENT_PROBE_V1_FINAL_FILE_LENGTH_CHANGED");
        }
        Need(report.Objects.Count == 9,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_OBJECT_COUNT_REFUSED");
        NoImpersonation();
    }

    private static void CreateFixedChild(SafeFileHandle parent, string parentPath,
        string leaf, byte[] content, byte[] descriptor, string attempt,
        Report report, List<Held> held, int step)
    {
        string path = Path.Combine(parentPath, leaf);
        ObjectReport parentInitial = report.Objects[step - 1];
        SameIdentityAndAcl(parentInitial, Inspect(parent, parentInitial.Label,
            parentInitial.Path, true, true));
        SafeFileHandle child = Relative(parent, leaf, path, descriptor,
            false, true, attempt, step);
        ObjectReport before = Inspect(child, leaf, path, false, true);
        Need(before.VolumeSerial64 == report.Objects[0].VolumeSerial64 &&
            before.Length == 0 &&
            !report.Objects.Exists(x => x.FileId128 == before.FileId128),
            "PROGRAMDATA_PLACEMENT_PROBE_V1_NEW_FILE_REFUSED");
        RandomAccess.Write(child, content, 0);
        RandomAccess.FlushToDisk(child);
        byte[] readback = new byte[content.Length];
        int offset = 0;
        while (offset < readback.Length) {
            int count = RandomAccess.Read(child, readback.AsSpan(offset), offset);
            Need(count > 0, "PROGRAMDATA_PLACEMENT_PROBE_V1_SHORT_READ_REFUSED");
            offset += count;
        }
        Need(readback.AsSpan().SequenceEqual(content) &&
            RandomAccess.GetLength(child) == content.Length,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_READBACK_REFUSED");
        ObjectReport after = Inspect(child, leaf, path, false, true);
        SameIdentityAndAcl(before, after, afterFileWrite: true);
        Need(after.Length == content.Length,
            "PROGRAMDATA_PLACEMENT_PROBE_V1_FINAL_LENGTH_REFUSED");
        after.ContentSha256 = Hash(readback);
        report.Objects.Add(after);
        held.Add(new Held(child, after, true));
        SaveNew(Path.Combine(attempt, $"probe-step-{step:D2}-observed.json"), after);
    }

    private static byte[] GetDescriptor(SafeFileHandle handle)
    {
        uint status = GetSecurityInfo(handle, 1, 7, out _, out _, out _, out _,
            out IntPtr pointer);
        try {
            Need(status == 0 && pointer != IntPtr.Zero,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_SECURITY_QUERY_REFUSED");
            int length = checked((int)GetSecurityDescriptorLength(pointer));
            Need(length is >= 20 and <= 65536,
                "PROGRAMDATA_PLACEMENT_PROBE_V1_SECURITY_LENGTH_REFUSED");
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
