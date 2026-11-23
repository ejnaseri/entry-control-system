using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
#if COMPILE_ONLY_STANDARD_STORE_NATIVE_V1
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
#endif

namespace EntryControl.TestOnly.StandardUserControl;

internal enum StandardStoreRole { Owner, Setup, GuardianBefore, GuardianAfter, StandardUser }
internal enum StandardStoreDirectory { Root, Bin, Input, Envelopes, Journal, Reports, GuardianBefore, GuardianAfter }
internal enum StandardStoreFile { Plan, Approval, AccountOwned, AccountComplete, PackageManifest, RuntimeInventory,
    ControlAssembly, RuntimeConfig, RestrictedEnvelope, AccessibleEnvelope, RestrictedIntent, RestrictedOwned,
    RestrictedComplete, AccessibleIntent, AccessibleOwned, AccessibleComplete, SetupReport,
    GuardianBeforeReport, GuardianAfterReport, ControllerResult, StandardUserReport, SourceSet,
    AccountActivationIntent, AccountActivated, AccountDisableIntent, AccountDisabled,
    ServiceSetupIntent, ServiceSetupOwned, ServiceSetupComplete, ServiceGuardianIntent, ServiceGuardianOwned, ServiceGuardianComplete,
    ServiceSetupStart, ServiceSetupAdmitted, ServiceSetupRunComplete, ServiceGuardianBeforeStart, ServiceGuardianBeforeAdmitted,
    ServiceGuardianBeforeComplete, ServiceGuardianAfterStart, ServiceGuardianAfterAdmitted, ServiceGuardianAfterComplete }
internal sealed record StandardStoreReceipt(StandardCryptoScope Scope, StandardStoreFile File, string Sha256,
    int Length, DateTimeOffset WrittenUtc, uint VolumeSerial, ulong FileIndex,
    bool CreateNew, bool Protected, bool DurablyFlushed, bool ExactReadback)
{
    public long CreationFileTimeUtc { get; init; }
}
internal interface IStandardDurableRecordSink
{
    StandardStoreReceipt WriteNew(StandardStoreFile file, byte[] originalUtf8);
    byte[] Read(StandardStoreFile file);
}
internal sealed record StandardStoreAce(string Sid, uint Mask);
internal sealed record StandardStoreRule(string Owner, string Group, bool Directory,
    IReadOnlyList<StandardStoreAce> Aces);
internal sealed record StandardStoreObject(string FinalPath, uint Type, uint Attributes,
    uint Links, uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc, long Length, bool CreatedNew);
internal sealed record StandardStoreDirectoryOrigin(StandardCryptoScope Scope, StandardStoreDirectory Directory,
    uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc);
internal sealed record StandardStoreFileOrigin(StandardCryptoScope Scope, StandardStoreFile File,
    string Sha256, int Length, uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc);
internal sealed record StandardStoreProvenance(IReadOnlyList<StandardStoreDirectoryOrigin> Directories,
    IReadOnlyList<StandardStoreFileOrigin> Files);

// Synthetic tests inject this boundary. Only the separately gated native
// implementation below accesses disk. No worker boolean authenticates origins:
// the trusted guard must admit the supplied plan/provenance before every use.
internal interface IStandardStoreHandle : IDisposable
{
    StandardStoreObject Inspect();
    byte[] Descriptor();
    byte[] Read(int maximum);
    void Write(byte[] bytes);
    void FlushDurable();
}
internal interface IStandardStoreBackend
{
    IStandardStoreHandle OpenVolumeRoot();
    IStandardStoreHandle OpenProgramData(IStandardStoreHandle volume);
    IStandardStoreHandle OpenDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent);
    IStandardStoreHandle CreateDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent, byte[] descriptor);
    IStandardStoreHandle OpenFile(StandardStoreFile file, IStandardStoreHandle parent);
    IStandardStoreHandle CreateFile(StandardStoreFile file, IStandardStoreHandle parent, byte[] descriptor);
}

internal static class StandardStoreRules
{
    internal const string Admin = StandardContract.Administrators, System = "S-1-5-18";
    internal const uint Full = 0x1f01ff, ReadFile = 0x120089, ReadExecute = 0x1200a9, Traverse = 0x1200a0;
    internal const uint DirectoryOpenAccess = Traverse; // No enumeration is performed by a pin.
    internal const int JsonMaximum = 2097152, PackageMaximum = 33554432;
    internal static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static bool Hex(string? value, int count) => value is not null && value.Length == count &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    internal static void Scope(StandardCryptoScope? s, DateTimeOffset now)
    {
        StandardContract.Need(s is not null && s.Schema == StandardCryptoComparison.Schema &&
            s.Root == StandardContract.Root && Hex(s.Attempt, 32) && s.IssuedUtc.Offset == TimeSpan.Zero &&
            s.ExpiresUtc.Offset == TimeSpan.Zero && now.Offset == TimeSpan.Zero && s.ExpiresUtc > s.IssuedUtc &&
            s.ExpiresUtc - s.IssuedUtc <= TimeSpan.FromHours(2) && now >= s.IssuedUtc && now < s.ExpiresUtc &&
            s.AccountSid == StandardContract.UserSid && s.OwnerSid == StandardContract.OwnerSid &&
            s.AccountOwnedSha256 == StandardContract.AccountOwnedSha256 &&
            s.AccountCompleteSha256 == StandardContract.AccountCompleteSha256 &&
            new[] { s.PlanSha256, s.ApprovalSha256, s.PackageSha256, s.RuntimeSha256,
                s.ImageSha256, s.AssemblySha256, s.HostSha256, s.BootSha256 }.All(x => Hex(x, 64)),
            "STANDARD_STORE_SCOPE_REFUSED");
    }
    internal static void Role(StandardStoreRole role) => StandardContract.Need(Enum.IsDefined(role), "STANDARD_STORE_ROLE_REFUSED");
    internal static bool CreatedInWindow(long fileTime, StandardCryptoScope scope, DateTimeOffset now)
    {
        try { var value = new DateTimeOffset(DateTime.FromFileTimeUtc(fileTime));
            return fileTime > 0 && value >= scope.IssuedUtc && value < scope.ExpiresUtc && value <= now;
        } catch (ArgumentOutOfRangeException) { return false; }
    }
    internal static string Relative(StandardStoreDirectory directory) => directory switch {
        StandardStoreDirectory.Root => "", StandardStoreDirectory.Bin => "bin", StandardStoreDirectory.Input => "input",
        StandardStoreDirectory.Envelopes => "envelopes", StandardStoreDirectory.Journal => "journal",
        StandardStoreDirectory.Reports => "reports", StandardStoreDirectory.GuardianBefore => "reports/guardian-before",
        StandardStoreDirectory.GuardianAfter => "reports/guardian-after", _ => throw new InvalidDataException("STANDARD_STORE_DIRECTORY_REFUSED")
    };
    internal static StandardStoreDirectory Parent(StandardStoreDirectory directory) => directory switch {
        StandardStoreDirectory.Bin or StandardStoreDirectory.Input or StandardStoreDirectory.Envelopes or
        StandardStoreDirectory.Journal or StandardStoreDirectory.Reports => StandardStoreDirectory.Root,
        StandardStoreDirectory.GuardianBefore or StandardStoreDirectory.GuardianAfter => StandardStoreDirectory.Reports,
        _ => throw new InvalidDataException("STANDARD_STORE_DIRECTORY_PARENT_REFUSED")
    };
    internal static (StandardStoreDirectory Parent, string Leaf) Location(StandardStoreFile file) => file switch {
        StandardStoreFile.Plan => (StandardStoreDirectory.Input, "plan.json"),
        StandardStoreFile.Approval => (StandardStoreDirectory.Input, "approval.json"),
        StandardStoreFile.AccountOwned => (StandardStoreDirectory.Input, "account-owned.json"),
        StandardStoreFile.AccountComplete => (StandardStoreDirectory.Input, "account-complete.json"),
        StandardStoreFile.PackageManifest => (StandardStoreDirectory.Input, "package-manifest.json"),
        StandardStoreFile.RuntimeInventory => (StandardStoreDirectory.Bin, "runtime-inventory.json"),
        StandardStoreFile.ControlAssembly => (StandardStoreDirectory.Bin, "StandardControl.dll"),
        StandardStoreFile.RuntimeConfig => (StandardStoreDirectory.Bin, "StandardControl.runtimeconfig.json"),
        StandardStoreFile.RestrictedEnvelope => (StandardStoreDirectory.Envelopes, "restricted.json"),
        StandardStoreFile.AccessibleEnvelope => (StandardStoreDirectory.Envelopes, "user-accessible.json"),
        StandardStoreFile.RestrictedIntent => (StandardStoreDirectory.Journal, "restricted-intent.json"),
        StandardStoreFile.RestrictedOwned => (StandardStoreDirectory.Journal, "restricted-owned.json"),
        StandardStoreFile.RestrictedComplete => (StandardStoreDirectory.Journal, "restricted-complete.json"),
        StandardStoreFile.AccessibleIntent => (StandardStoreDirectory.Journal, "user-accessible-intent.json"),
        StandardStoreFile.AccessibleOwned => (StandardStoreDirectory.Journal, "user-accessible-owned.json"),
        StandardStoreFile.AccessibleComplete => (StandardStoreDirectory.Journal, "user-accessible-complete.json"),
        StandardStoreFile.SetupReport => (StandardStoreDirectory.Reports, "setup.json"),
        StandardStoreFile.GuardianBeforeReport => (StandardStoreDirectory.GuardianBefore, "report.json"),
        StandardStoreFile.GuardianAfterReport => (StandardStoreDirectory.GuardianAfter, "report.json"),
        StandardStoreFile.ControllerResult => (StandardStoreDirectory.Reports, "controller-result.json"),
        StandardStoreFile.StandardUserReport => (StandardStoreDirectory.Reports, "standard-user.json"),
        StandardStoreFile.SourceSet => (StandardStoreDirectory.Input, "source-set.json"),
        StandardStoreFile.AccountActivationIntent => (StandardStoreDirectory.Journal, "account-activation-intent.json"),
        StandardStoreFile.AccountActivated => (StandardStoreDirectory.Journal, "account-activated.json"),
        StandardStoreFile.AccountDisableIntent => (StandardStoreDirectory.Journal, "account-disable-intent.json"),
        StandardStoreFile.AccountDisabled => (StandardStoreDirectory.Journal, "account-disabled.json"),
        StandardStoreFile.ServiceSetupIntent => (StandardStoreDirectory.Journal, "setup-service-intent.json"),
        StandardStoreFile.ServiceSetupOwned => (StandardStoreDirectory.Journal, "setup-service-owned.json"),
        StandardStoreFile.ServiceSetupComplete => (StandardStoreDirectory.Journal, "setup-service-create-complete.json"),
        StandardStoreFile.ServiceGuardianIntent => (StandardStoreDirectory.Journal, "guardian-service-intent.json"),
        StandardStoreFile.ServiceGuardianOwned => (StandardStoreDirectory.Journal, "guardian-service-owned.json"),
        StandardStoreFile.ServiceGuardianComplete => (StandardStoreDirectory.Journal, "guardian-service-create-complete.json"),
        StandardStoreFile.ServiceSetupStart => (StandardStoreDirectory.Journal, "setup-service-run-start.json"),
        StandardStoreFile.ServiceSetupAdmitted => (StandardStoreDirectory.Journal, "setup-service-run-admitted.json"),
        StandardStoreFile.ServiceSetupRunComplete => (StandardStoreDirectory.Journal, "setup-service-run-complete.json"),
        StandardStoreFile.ServiceGuardianBeforeStart => (StandardStoreDirectory.Journal, "guardian-before-service-run-start.json"),
        StandardStoreFile.ServiceGuardianBeforeAdmitted => (StandardStoreDirectory.Journal, "guardian-before-service-run-admitted.json"),
        StandardStoreFile.ServiceGuardianBeforeComplete => (StandardStoreDirectory.Journal, "guardian-before-service-run-complete.json"),
        StandardStoreFile.ServiceGuardianAfterStart => (StandardStoreDirectory.Journal, "guardian-after-service-run-start.json"),
        StandardStoreFile.ServiceGuardianAfterAdmitted => (StandardStoreDirectory.Journal, "guardian-after-service-run-admitted.json"),
        StandardStoreFile.ServiceGuardianAfterComplete => (StandardStoreDirectory.Journal, "guardian-after-service-run-complete.json"),
        _ => throw new InvalidDataException("STANDARD_STORE_FILE_REFUSED")
    };
    internal static string PathOf(StandardStoreDirectory directory) => StandardContract.Root +
        (directory == StandardStoreDirectory.Root ? "" : "\\" + Relative(directory).Replace('/', '\\'));
    internal static string PathOf(StandardStoreFile file) { var location = Location(file); return PathOf(location.Parent) + "\\" + location.Leaf; }
    internal static bool CanWrite(StandardStoreRole role, StandardStoreFile file)
    {
        Role(role); var parent = Location(file).Parent;
        return role switch {
            StandardStoreRole.Owner => parent is StandardStoreDirectory.Input or StandardStoreDirectory.Bin ||
                file == StandardStoreFile.SetupReport || AccountRecord(file) || ServiceRecord(file) ||
                file is StandardStoreFile.ControllerResult or StandardStoreFile.GuardianBeforeReport or StandardStoreFile.GuardianAfterReport or StandardStoreFile.StandardUserReport,
            StandardStoreRole.Setup => parent == StandardStoreDirectory.Envelopes || KeyRecord(file),
            _ => false
        };
    }
    internal static bool AccountRecord(StandardStoreFile file) => file is StandardStoreFile.AccountActivationIntent or
        StandardStoreFile.AccountActivated or StandardStoreFile.AccountDisableIntent or StandardStoreFile.AccountDisabled;
    internal static bool KeyRecord(StandardStoreFile file) => file is StandardStoreFile.RestrictedIntent or StandardStoreFile.RestrictedOwned or
        StandardStoreFile.RestrictedComplete or StandardStoreFile.AccessibleIntent or StandardStoreFile.AccessibleOwned or StandardStoreFile.AccessibleComplete;
    internal static bool ServiceRecord(StandardStoreFile file) => file is StandardStoreFile.ServiceSetupIntent or StandardStoreFile.ServiceSetupOwned or
        StandardStoreFile.ServiceSetupComplete or StandardStoreFile.ServiceGuardianIntent or StandardStoreFile.ServiceGuardianOwned or StandardStoreFile.ServiceGuardianComplete or
        StandardStoreFile.ServiceSetupStart or StandardStoreFile.ServiceSetupAdmitted or StandardStoreFile.ServiceSetupRunComplete or StandardStoreFile.ServiceGuardianBeforeStart or
        StandardStoreFile.ServiceGuardianBeforeAdmitted or StandardStoreFile.ServiceGuardianBeforeComplete or StandardStoreFile.ServiceGuardianAfterStart or
        StandardStoreFile.ServiceGuardianAfterAdmitted or StandardStoreFile.ServiceGuardianAfterComplete;
    internal static bool CanRead(StandardStoreRole role, StandardStoreFile file)
    {
        Role(role); var parent = Location(file).Parent;
        return role == StandardStoreRole.Owner || parent is StandardStoreDirectory.Input or StandardStoreDirectory.Bin or StandardStoreDirectory.Envelopes ||
            CanWrite(role, file);
    }
    internal static bool CanPin(StandardStoreRole role, StandardStoreDirectory directory)
    {
        Role(role); _ = Relative(directory);
        return role is StandardStoreRole.Owner or StandardStoreRole.Setup ||
            directory is StandardStoreDirectory.Root or StandardStoreDirectory.Bin or StandardStoreDirectory.Input or StandardStoreDirectory.Envelopes;
    }
    internal static StandardStoreRule Rule(StandardStoreDirectory directory)
    {
        _ = Relative(directory);
        var aces = new List<StandardStoreAce> { new(System, Full), new(Admin, Full) };
        if (directory == StandardStoreDirectory.Root) {
            aces.Add(new(StandardCryptoComparison.GuardianSid, Traverse));
            if (directory == StandardStoreDirectory.Root) aces.Add(new(StandardContract.UserSid, Traverse));
        }
        if (directory is StandardStoreDirectory.Bin or StandardStoreDirectory.Input or StandardStoreDirectory.Envelopes) {
            aces.Add(new(StandardCryptoComparison.GuardianSid, ReadExecute)); aces.Add(new(StandardContract.UserSid, ReadExecute));
        }
        return new(Admin, Admin, true, aces.AsReadOnly());
    }
    internal static StandardStoreRule Rule(StandardStoreFile file)
    {
        var parent = Location(file).Parent;
        var aces = new List<StandardStoreAce> { new(System, Full), new(Admin, Full) };
        if (parent is StandardStoreDirectory.Input or StandardStoreDirectory.Bin or StandardStoreDirectory.Envelopes) {
            uint mask = file == StandardStoreFile.ControlAssembly ? ReadExecute : ReadFile;
            aces.Add(new(StandardCryptoComparison.GuardianSid, mask)); aces.Add(new(StandardContract.UserSid, mask));
        }
        return new(Admin, Admin, false, aces.AsReadOnly());
    }
    internal static int Maximum(StandardStoreFile file) { _ = Location(file); return file == StandardStoreFile.ControlAssembly ? PackageMaximum : JsonMaximum; }
    internal static void Content(StandardStoreFile file, byte[]? bytes)
    {
        StandardContract.Need(bytes is { Length: > 0 } && bytes.Length <= Maximum(file), "STANDARD_STORE_CONTENT_SIZE_REFUSED");
        if (file == StandardStoreFile.ControlAssembly) return;
        StandardContract.Need(!(bytes.Length >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf), "STANDARD_STORE_JSON_BOM_REFUSED");
        _ = new UTF8Encoding(false, true).GetString(bytes);
        var reader = new Utf8JsonReader(bytes, new JsonReaderOptions { MaxDepth = 32, CommentHandling = JsonCommentHandling.Disallow });
        var objects = new Stack<HashSet<string>>(); int fields = 0; bool root = false;
        while (reader.Read()) {
            if (!root) { StandardContract.Need(reader.TokenType == (file == StandardStoreFile.SourceSet ? JsonTokenType.StartArray : JsonTokenType.StartObject),
                "STANDARD_STORE_JSON_ROOT_REFUSED"); root = true; }
            if (reader.TokenType == JsonTokenType.StartObject) objects.Push(new(StringComparer.Ordinal));
            if (reader.TokenType == JsonTokenType.EndObject) { StandardContract.Need(objects.Count > 0, "STANDARD_STORE_JSON_OBJECT_REFUSED"); objects.Pop(); }
            if (reader.TokenType == JsonTokenType.PropertyName) {
                string? name = reader.GetString();
                StandardContract.Need(name is { Length: > 0 and <= 256 } && ++fields <= 4096 && objects.Count > 0 && objects.Peek().Add(name),
                    "STANDARD_STORE_JSON_DUPLICATE_OR_FIELD_REFUSED");
            }
            StandardContract.Need(reader.ValueSpan.Length <= 1048576, "STANDARD_STORE_JSON_TOKEN_REFUSED");
        }
        StandardContract.Need(root && objects.Count == 0 && reader.BytesConsumed == bytes.Length, "STANDARD_STORE_JSON_INCOMPLETE_REFUSED");
        if (file == StandardStoreFile.SourceSet) {
            // Preserve the existing build's exact original source-pin ARRAY.
            // Do not silently wrap/reserialize it into a different hash graph.
            using var original = JsonDocument.Parse(bytes);
            StandardContract.Need(original.RootElement.GetArrayLength() is >= 1 and <= 128 &&
                original.RootElement.EnumerateArray().All(x => x.ValueKind == JsonValueKind.Object), "STANDARD_STORE_SOURCE_ARRAY_REFUSED");
        }
        // Parsing never reserializes/canonicalizes originals. Schema-specific
        // typed/canonical plan approval remains a separate controller obligation.
    }

    private static byte[] Sid(string value)
    {
        StandardContract.Need(StandardIdentity.CanonicalSid(value), "STANDARD_STORE_SID_REFUSED");
        string[] parts = value.Split('-'); byte[] bytes = new byte[8 + (parts.Length - 3) * 4];
        bytes[0] = 1; bytes[1] = (byte)(parts.Length - 3); ulong authority = ulong.Parse(parts[2], CultureInfo.InvariantCulture);
        for (int i = 0; i < 6; i++) bytes[2 + i] = (byte)(authority >> (8 * (5 - i)));
        for (int i = 3; i < parts.Length; i++) BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(8 + (i - 3) * 4), uint.Parse(parts[i], CultureInfo.InvariantCulture));
        return bytes;
    }
    internal static byte[] Descriptor(StandardStoreRule rule)
    {
        StandardContract.Need(rule is not null && rule.Aces is { Count: >= 2 and <= 8 }, "STANDARD_STORE_RULE_REFUSED");
        byte[] owner = Sid(rule.Owner), group = Sid(rule.Group); byte[][] sids = rule.Aces.Select(a => Sid(a.Sid)).ToArray();
        int aclOffset = 20 + owner.Length + group.Length, aclLength = 8 + sids.Sum(s => s.Length + 8);
        var bytes = new byte[aclOffset + aclLength]; bytes[0] = 1;
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(2), 0x9004); // Self-relative/protected/DACL-present; no inheritance/SACL.
        BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(4), 20);
        BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(8), 20 + owner.Length);
        BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(16), aclOffset);
        owner.CopyTo(bytes, 20); group.CopyTo(bytes, 20 + owner.Length); bytes[aclOffset] = 2;
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(aclOffset + 2), checked((ushort)aclLength));
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(aclOffset + 4), checked((ushort)sids.Length));
        int position = aclOffset + 8;
        for (int i = 0; i < sids.Length; i++) {
            BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(position + 2), checked((ushort)(sids[i].Length + 8)));
            BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(position + 4), rule.Aces[i].Mask);
            sids[i].CopyTo(bytes, position + 8); position += sids[i].Length + 8;
        }
        return bytes;
    }
    internal static void ValidateDescriptor(byte[]? bytes, StandardStoreRule rule)
    {
        StandardContract.Need(bytes is { Length: >= 20 and <= 65536 } && bytes[0] == 1 && bytes[1] == 0 &&
            BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(2)) == 0x9004 &&
            BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(12)) == 0, "STANDARD_STORE_DESCRIPTOR_HEADER_REFUSED");
        int owner = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(4)), group = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(8)),
            acl = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(16));
        int SidLength(int offset, int limit) {
            StandardContract.Need(offset >= 20 && (offset & 3) == 0 && offset <= limit - 8 && limit <= bytes.Length &&
                bytes[offset] == 1 && bytes[offset + 1] is >= 1 and <= 15, "STANDARD_STORE_DESCRIPTOR_SID_REFUSED");
            int size = 8 + bytes[offset + 1] * 4;
            StandardContract.Need(size <= limit - offset, "STANDARD_STORE_DESCRIPTOR_SID_LENGTH_REFUSED"); return size;
        }
        int ownerLength = SidLength(owner, bytes.Length), groupLength = SidLength(group, bytes.Length);
        StandardContract.Need(bytes.AsSpan(owner, ownerLength).SequenceEqual(Sid(rule.Owner)) &&
            bytes.AsSpan(group, groupLength).SequenceEqual(Sid(rule.Group)), "STANDARD_STORE_DESCRIPTOR_OWNER_GROUP_REFUSED");
        StandardContract.Need(acl >= 20 && (acl & 3) == 0 && acl <= bytes.Length - 8 && bytes[acl] == 2 && bytes[acl + 1] == 0 &&
            bytes[acl + 6] == 0 && bytes[acl + 7] == 0, "STANDARD_STORE_DESCRIPTOR_ACL_REFUSED");
        int length = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 2)), count = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 4));
        StandardContract.Need(length >= 8 && length <= bytes.Length - acl && count == rule.Aces.Count,
            "STANDARD_STORE_DESCRIPTOR_ACL_LENGTH_REFUSED");
        var wanted = rule.Aces.Select(a => (Sid: Convert.ToHexString(Sid(a.Sid)), a.Mask)).ToHashSet();
        StandardContract.Need(wanted.Count == rule.Aces.Count, "STANDARD_STORE_DESCRIPTOR_EXPECTED_DUPLICATE_REFUSED");
        int cursor = acl + 8;
        for (int i = 0; i < count; i++) {
            StandardContract.Need(cursor <= acl + length - 8 && bytes[cursor] == 0 && bytes[cursor + 1] == 0, "STANDARD_STORE_DESCRIPTOR_ACE_TYPE_REFUSED");
            int size = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(cursor + 2));
            StandardContract.Need(size >= 20 && size <= acl + length - cursor, "STANDARD_STORE_DESCRIPTOR_ACE_SIZE_REFUSED");
            int sidLength = SidLength(cursor + 8, cursor + size);
            StandardContract.Need(size == 8 + sidLength && wanted.Remove((Convert.ToHexString(bytes.AsSpan(cursor + 8, sidLength)),
                BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(cursor + 4)))), "STANDARD_STORE_DESCRIPTOR_ACE_RIGHTS_REFUSED");
            cursor += size;
        }
        StandardContract.Need(cursor == acl + length && wanted.Count == 0, "STANDARD_STORE_DESCRIPTOR_ACL_TRAILING_REFUSED");
        bool[] occupied = new bool[bytes.Length]; Array.Fill(occupied, true, 0, 20);
        void Mark(int offset, int size) { for (int i = offset; i < offset + size; i++) {
            StandardContract.Need(!occupied[i], "STANDARD_STORE_DESCRIPTOR_OVERLAP_REFUSED"); occupied[i] = true; } }
        Mark(owner, ownerLength);
        if (owner != group) Mark(group, groupLength);
        else StandardContract.Need(ownerLength == groupLength, "STANDARD_STORE_DESCRIPTOR_OWNER_GROUP_OVERLAP_REFUSED");
        Mark(acl, length); StandardContract.Need(occupied.All(x => x), "STANDARD_STORE_DESCRIPTOR_TRAILING_REFUSED");
    }
    internal static void Object(StandardStoreObject? value, string path, bool directory)
    {
        StandardContract.Need(value is not null && value.Type == 1 &&
            string.Equals(value.FinalPath, "\\\\?\\" + path, StringComparison.OrdinalIgnoreCase) &&
            (value.Attributes & (0x400u | 0x1000u)) == 0 && ((value.Attributes & 0x10) != 0) == directory &&
            value.Links == 1 && value.VolumeSerial != 0 && value.FileIndex != 0 && value.CreationFileTimeUtc > 0 && value.Length >= 0,
            "STANDARD_STORE_OBJECT_REFUSED");
    }
}

// No deletion, replacement, permission repair, arbitrary path or adoption by
// name. Fresh creation returns concrete file IDs. A later process can reopen
// only exact origin pins admitted by its trusted guard; those serialized pins
// alone are NOT authority. Directory handles remain held for this store's life.
// All worker report originals are written by the OWNER COLLECTOR, never directly
// by Setup, a Guardian or the standard user. A future authenticated IPC/held-process
// collector must supply those bytes. This component implements neither that
// IPC nor a claim about a virtual account's unobserved TokenPrimaryGroup.
internal sealed class StandardProtectedStore : IStandardDurableRecordSink, IDisposable
{
    private readonly StandardCryptoScope scope;
    private readonly StandardStoreRole role;
    private readonly IStandardStoreBackend backend;
    private readonly Action<string> guard;
    private readonly Func<DateTimeOffset> clock;
    private readonly Dictionary<StandardStoreDirectory, IStandardStoreHandle> directories = new();
    private readonly Dictionary<StandardStoreDirectory, StandardStoreDirectoryOrigin> origins = new();
    private readonly Dictionary<StandardStoreFile, StandardStoreFileOrigin> files = new();
    private readonly Dictionary<StandardStoreFile, IStandardStoreHandle> readHandles = new();
    private readonly List<IStandardStoreHandle> ancestors = new();
    private readonly List<StandardStoreObject> ancestorOrigins = new();
    private readonly object operationGate = new();
    private bool operationActive;
    private bool disposed;
    private StandardProtectedStore(StandardCryptoScope scope, StandardStoreRole role, IStandardStoreBackend backend,
        Action<string> guard, Func<DateTimeOffset> clock)
    {
        this.scope = scope; this.role = role; this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard)); this.clock = clock ?? throw new ArgumentNullException(nameof(clock));
        StandardStoreRules.Role(role); Gate("Construct");
    }
    private void Gate(string stage) { StandardContract.Need(!disposed, "STANDARD_STORE_DISPOSED"); StandardStoreRules.Scope(scope, clock()); guard(stage);
        StandardContract.Need(!disposed, "STANDARD_STORE_DISPOSED_DURING_GUARD"); StandardStoreRules.Scope(scope, clock()); }
    private T Perform<T>(Func<T> work)
    {
        lock (operationGate) {
            StandardContract.Need(!operationActive && !disposed, "STANDARD_STORE_REENTRANT_OR_DISPOSED_OPERATION"); operationActive = true;
            try { return work(); } finally { operationActive = false; }
        }
    }
    private static bool Matches(StandardStoreObject info, uint volume, ulong index, long created) =>
        info.VolumeSerial == volume && info.FileIndex == index && info.CreationFileTimeUtc == created;
    private void Ancestors()
    {
        Gate("BeforeVolumePin"); ancestors.Add(backend.OpenVolumeRoot()); Gate("AfterVolumePin");
        StandardStoreRules.Object(ancestors[0].Inspect(), @"C:\", true);
        ancestorOrigins.Add(ancestors[0].Inspect());
        Gate("BeforeProgramDataPin"); ancestors.Add(backend.OpenProgramData(ancestors[0])); Gate("AfterProgramDataPin");
        StandardStoreRules.Object(ancestors[1].Inspect(), @"C:\ProgramData", true);
        ancestorOrigins.Add(ancestors[1].Inspect());
        StandardContract.Need(ancestors[0].Inspect().VolumeSerial == ancestors[1].Inspect().VolumeSerial, "STANDARD_STORE_ANCESTOR_VOLUME_REFUSED");
    }
    private void CheckPins()
    {
        StandardStoreRules.Object(ancestors[0].Inspect(), @"C:\", true);
        StandardStoreRules.Object(ancestors[1].Inspect(), @"C:\ProgramData", true);
        for (int i = 0; i < ancestors.Count; i++) StandardContract.Need(Matches(ancestors[i].Inspect(),
            ancestorOrigins[i].VolumeSerial, ancestorOrigins[i].FileIndex, ancestorOrigins[i].CreationFileTimeUtc), "STANDARD_STORE_ANCESTOR_ORIGIN_CHANGED");
        foreach (var pair in directories) {
            var info = pair.Value.Inspect(); var origin = origins[pair.Key];
            StandardStoreRules.Object(info, StandardStoreRules.PathOf(pair.Key), true);
            StandardStoreRules.ValidateDescriptor(pair.Value.Descriptor(), StandardStoreRules.Rule(pair.Key));
            StandardContract.Need(Matches(info, origin.VolumeSerial, origin.FileIndex, origin.CreationFileTimeUtc), "STANDARD_STORE_DIRECTORY_ORIGIN_CHANGED");
        }
    }
    private IStandardStoreHandle Parent(StandardStoreDirectory directory) => directory == StandardStoreDirectory.Root
        ? ancestors[1] : directories[StandardStoreRules.Parent(directory)];

    internal static StandardProtectedStore CreateFresh(StandardCryptoScope scope, IStandardStoreBackend backend,
        Action<string> guard, Func<DateTimeOffset> clock)
    {
        var store = new StandardProtectedStore(scope, StandardStoreRole.Owner, backend, guard, clock);
        try {
            store.Ancestors();
            foreach (var directory in Enum.GetValues<StandardStoreDirectory>()) {
                store.Gate("BeforeCreateDirectory");
                var handle = backend.CreateDirectory(directory, store.Parent(directory), StandardStoreRules.Descriptor(StandardStoreRules.Rule(directory)));
                store.directories.Add(directory, handle);
                var info = handle.Inspect(); StandardStoreRules.Object(info, StandardStoreRules.PathOf(directory), true);
                StandardStoreRules.ValidateDescriptor(handle.Descriptor(), StandardStoreRules.Rule(directory));
                StandardContract.Need(info.CreatedNew && info.VolumeSerial == store.ancestors[1].Inspect().VolumeSerial &&
                    StandardStoreRules.CreatedInWindow(info.CreationFileTimeUtc, scope, clock()),
                    "STANDARD_STORE_FRESH_DIRECTORY_ORIGIN_REFUSED");
                store.origins.Add(directory, new(scope, directory, info.VolumeSerial, info.FileIndex, info.CreationFileTimeUtc));
                store.CheckPins(); store.Gate("AfterCreateDirectory");
            }
            StandardContract.Need(store.origins.Values.Select(x => x.FileIndex).Distinct().Count() == store.origins.Count,
                "STANDARD_STORE_DIRECTORY_ORIGIN_REUSED");
            return store;
        } catch { store.Dispose(); throw; }
    }

    internal static StandardProtectedStore OpenOwned(StandardCryptoScope scope, StandardStoreRole role,
        IStandardStoreBackend backend, Action<string> guard, Func<DateTimeOffset> clock, StandardStoreProvenance provenance)
    {
        var store = new StandardProtectedStore(scope, role, backend, guard, clock);
        try {
            StandardContract.Need(provenance is not null && provenance.Directories is { Count: 8 } && provenance.Files is not null,
                "STANDARD_STORE_PROVENANCE_REQUIRED");
            store.Ancestors();
            foreach (var directory in Enum.GetValues<StandardStoreDirectory>()) {
                var pins = provenance.Directories.Where(x => x is not null && x.Directory == directory).ToArray();
                StandardContract.Need(pins.Length == 1 && pins[0].Scope == scope &&
                    StandardStoreRules.CreatedInWindow(pins[0].CreationFileTimeUtc, scope, clock()), "STANDARD_STORE_DIRECTORY_PROVENANCE_REFUSED");
                StandardStoreRules.Scope(pins[0].Scope, clock());
                store.origins.Add(directory, pins[0]);
                if (!StandardStoreRules.CanPin(role, directory)) continue;
                store.Gate("BeforeOpenOwnedDirectory");
                store.directories.Add(directory, backend.OpenDirectory(directory, store.Parent(directory)));
                store.CheckPins(); store.Gate("AfterOpenOwnedDirectory");
            }
            StandardContract.Need(store.origins.Values.Select(x => (x.VolumeSerial, x.FileIndex)).Distinct().Count() == 8,
                "STANDARD_STORE_DIRECTORY_ORIGIN_REUSED");
            foreach (var file in provenance.Files) {
                StandardContract.Need(file is not null && file.Scope == scope && file.Length > 0 && file.Length <= StandardStoreRules.Maximum(file.File) &&
                    file.Sha256 is { Length: 64 } && file.Sha256.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f') &&
                    file.VolumeSerial == store.origins[StandardStoreDirectory.Root].VolumeSerial && file.FileIndex != 0 &&
                    StandardStoreRules.CreatedInWindow(file.CreationFileTimeUtc, scope, clock()) &&
                    store.files.TryAdd(file.File, file), "STANDARD_STORE_FILE_PROVENANCE_REFUSED");
                StandardStoreRules.Scope(file.Scope, clock());
            }
            StandardContract.Need(store.files.Values.Select(x => (x.VolumeSerial, x.FileIndex)).Distinct().Count() == store.files.Count,
                "STANDARD_STORE_FILE_ORIGIN_REUSED");
            store.Gate("AfterOpenOwnedPlacement"); return store;
        } catch { store.Dispose(); throw; }
    }
    internal StandardStoreProvenance Provenance() => Perform(() => {
        Gate("ExportProvenance"); CheckPins(); return new StandardStoreProvenance(origins.Values.ToArray(), files.Values.ToArray()); });
    private StandardStoreObject CheckFile(IStandardStoreHandle handle, StandardStoreFile file, StandardStoreFileOrigin? origin)
    {
        var info = handle.Inspect(); StandardStoreRules.Object(info, StandardStoreRules.PathOf(file), false);
        StandardStoreRules.ValidateDescriptor(handle.Descriptor(), StandardStoreRules.Rule(file));
        StandardContract.Need(info.VolumeSerial == origins[StandardStoreDirectory.Root].VolumeSerial, "STANDARD_STORE_FILE_VOLUME_REFUSED");
        if (origin is not null) StandardContract.Need(Matches(info, origin.VolumeSerial, origin.FileIndex, origin.CreationFileTimeUtc) &&
            info.Length == origin.Length, "STANDARD_STORE_FILE_ORIGIN_CHANGED");
        return info;
    }
    public byte[] Read(StandardStoreFile file) => Perform(() => ReadCore(file));
    private byte[] ReadCore(StandardStoreFile file)
    {
        Gate("BeforeRead"); CheckPins(); StandardContract.Need(StandardStoreRules.CanRead(role, file) && files.TryGetValue(file, out _), "STANDARD_STORE_READ_PIN_OR_ROLE_REFUSED");
        var origin = files[file];
        bool added = !readHandles.TryGetValue(file, out var existing);
        var handle = existing ?? backend.OpenFile(file, directories[StandardStoreRules.Location(file).Parent]);
        try {
            Gate("AfterOpenRead"); CheckFile(handle, file, origin);
            byte[] bytes = handle.Read(StandardStoreRules.Maximum(file)); StandardStoreRules.Content(file, bytes);
            StandardContract.Need(bytes.Length == origin.Length && StandardStoreRules.Hash(bytes) == origin.Sha256, "STANDARD_STORE_READ_HASH_CHANGED");
            CheckFile(handle, file, origin); CheckPins(); Gate("AfterRead");
            if (added) { readHandles.Add(file, handle); added = false; }
            return (byte[])bytes.Clone();
        } finally { if (added) handle.Dispose(); }
    }
    public StandardStoreReceipt WriteNew(StandardStoreFile file, byte[] originalUtf8) => Perform(() => WriteCore(file, originalUtf8));
    private StandardStoreReceipt WriteCore(StandardStoreFile file, byte[] originalUtf8)
    {
        Gate("BeforeWrite"); CheckPins(); StandardContract.Need(StandardStoreRules.CanWrite(role, file) && !files.ContainsKey(file), "STANDARD_STORE_WRITE_ROLE_OR_REUSE_REFUSED");
        StandardStoreRules.Content(file, originalUtf8); byte[] bytes = (byte[])originalUtf8.Clone();
        Gate("ImmediatelyBeforeCreateFile");
        StandardStoreObject before;
        using (var handle = backend.CreateFile(file, directories[StandardStoreRules.Location(file).Parent], StandardStoreRules.Descriptor(StandardStoreRules.Rule(file)))) {
            Gate("AfterCreateFile"); before = CheckFile(handle, file, null);
            StandardContract.Need(before.CreatedNew && before.Length == 0 &&
                StandardStoreRules.CreatedInWindow(before.CreationFileTimeUtc, scope, clock()), "STANDARD_STORE_NEW_FILE_ORIGIN_REFUSED");
            handle.Write(bytes); Gate("AfterWriteBeforeFlush"); handle.FlushDurable(); Gate("AfterDurableFlush");
            byte[] readback = handle.Read(StandardStoreRules.Maximum(file));
            StandardContract.Need(readback.AsSpan().SequenceEqual(bytes), "STANDARD_STORE_WRITE_READBACK_REFUSED");
            var after = CheckFile(handle, file, null);
            StandardContract.Need(Matches(after, before.VolumeSerial, before.FileIndex, before.CreationFileTimeUtc) && after.Length == bytes.Length,
                "STANDARD_STORE_WRITTEN_FILE_CHANGED");
            CheckPins(); Gate("AfterWriteReadback");
        }
        // Reopen without writer sharing after closing the creation writer. Its
        // original ID/time/digest must survive this transition; no path adoption.
        var origin = new StandardStoreFileOrigin(scope, file, StandardStoreRules.Hash(bytes), bytes.Length,
            before.VolumeSerial, before.FileIndex, before.CreationFileTimeUtc);
        files.Add(file, origin);
        byte[] pinned = ReadCore(file);
        StandardContract.Need(pinned.AsSpan().SequenceEqual(bytes), "STANDARD_STORE_POST_CLOSE_READBACK_REFUSED");
        Gate("CompleteWriteReceipt");
        DateTimeOffset written = clock(); StandardStoreRules.Scope(scope, written);
        return new(scope, file, origin.Sha256, bytes.Length, written, before.VolumeSerial, before.FileIndex, true, true, true, true)
            { CreationFileTimeUtc = before.CreationFileTimeUtc };
    }
    public void Dispose()
    {
        lock (operationGate) {
            StandardContract.Need(!operationActive, "STANDARD_STORE_REENTRANT_DISPOSE_REFUSED");
            if (disposed) return; disposed = true;
            foreach (var handle in readHandles.Values.Reverse()) handle.Dispose();
            foreach (var handle in directories.Values.Reverse()) handle.Dispose();
            foreach (var handle in ancestors.AsEnumerable().Reverse()) handle.Dispose();
        }
    }
}

#if COMPILE_ONLY_STANDARD_STORE_NATIVE_V1
// No CLI calls this implementation. Fixed relative NtCreateFile(FILE_CREATE)
// creates a directory/file and returns the SAME handle with its atomic security
// descriptor; collisions never become OPEN_IF, overwrite, repair or retry.
internal sealed class StandardNativeStoreBackend : IStandardStoreBackend
{
    private readonly StandardCryptoScope scope; private readonly StandardStoreRole role;
    private readonly Action<string> guard; private readonly Func<DateTimeOffset> clock;
    internal StandardNativeStoreBackend(StandardCryptoScope scope, StandardStoreRole role, Action<string> guard, Func<DateTimeOffset> clock)
    {
        this.scope = scope; this.role = role; this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.clock = clock ?? throw new ArgumentNullException(nameof(clock)); StandardStoreRules.Role(role); Gate();
    }
    private void Gate()
    {
        StandardStoreRules.Scope(scope, clock()); guard("NativeStore"); StandardStoreRules.Scope(scope, clock());
        StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            RuntimeInformation.OSArchitecture == Architecture.X64 && Environment.Version.ToString() == "10.0.11", "STANDARD_NATIVE_STORE_RUNTIME_REFUSED");
    }
    private sealed class Handle : IStandardStoreHandle
    {
        internal readonly SafeFileHandle Native; internal readonly string Path; private readonly bool created;
        private readonly Action gate;
        internal Handle(SafeFileHandle handle, string path, bool created, Action gate) { Native = handle; Path = path; this.created = created; this.gate = gate; }
        public StandardStoreObject Inspect()
        {
            gate(); StandardContract.Need(GetFileInformationByHandle(Native, out var info), "STANDARD_NATIVE_STORE_INFO_REFUSED");
            var path = new StringBuilder(32768); uint count = GetFinalPathNameByHandleW(Native, path, (uint)path.Capacity, 0);
            StandardContract.Need(count > 0 && count < path.Capacity, "STANDARD_NATIVE_STORE_FINAL_PATH_REFUSED");
            var result = new StandardStoreObject(path.ToString(), GetFileType(Native), info.Attributes, info.Links, info.Volume,
                ((ulong)info.IndexHigh << 32) | info.IndexLow, info.Creation,
                checked((long)(((ulong)info.SizeHigh << 32) | info.SizeLow)), created); gate(); return result;
        }
        public byte[] Descriptor()
        {
            gate(); uint status = GetSecurityInfo(Native, 1, 7, out _, out _, out _, out _, out var pointer);
            try { StandardContract.Need(status == 0 && pointer != IntPtr.Zero, "STANDARD_NATIVE_STORE_SECURITY_REFUSED");
                int length = checked((int)GetSecurityDescriptorLength(pointer)); StandardContract.Need(length is >= 20 and <= 65536, "STANDARD_NATIVE_STORE_DESCRIPTOR_SIZE_REFUSED");
                var bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, length); gate(); return bytes;
            } finally { if (pointer != IntPtr.Zero) LocalFree(pointer); }
        }
        public byte[] Read(int maximum)
        {
            gate(); long size = RandomAccess.GetLength(Native); StandardContract.Need(size > 0 && size <= maximum, "STANDARD_NATIVE_STORE_READ_SIZE_REFUSED");
            byte[] bytes = new byte[checked((int)size)]; int position = 0;
            while (position < bytes.Length) { gate(); int count = RandomAccess.Read(Native, bytes.AsSpan(position), position);
                StandardContract.Need(count > 0, "STANDARD_NATIVE_STORE_READ_SHORT"); position += count; }
            StandardContract.Need(RandomAccess.GetLength(Native) == size, "STANDARD_NATIVE_STORE_READ_LENGTH_CHANGED"); gate(); return bytes;
        }
        public void Write(byte[] bytes) { gate(); StandardContract.Need(RandomAccess.GetLength(Native) == 0, "STANDARD_NATIVE_STORE_WRITE_NOT_EMPTY"); RandomAccess.Write(Native, bytes, 0); gate(); }
        public void FlushDurable() { gate(); RandomAccess.FlushToDisk(Native); gate(); }
        public void Dispose() => Native.Dispose();
    }
    public IStandardStoreHandle OpenVolumeRoot()
    {
        Gate(); var attributes = new Attributes { Length = Marshal.SizeOf<Attributes>() };
        var native = CreateFileW(@"C:\", StandardStoreRules.DirectoryOpenAccess, 1, ref attributes, 3, 0x02200000, IntPtr.Zero);
        StandardContract.Need(!native.IsInvalid, "STANDARD_NATIVE_STORE_VOLUME_OPEN_REFUSED");
        return Finish(native, @"C:\", true, false);
    }
    public IStandardStoreHandle OpenProgramData(IStandardStoreHandle volume) => Open(volume, @"C:\", "ProgramData", @"C:\ProgramData", true, null, false);
    public IStandardStoreHandle OpenDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent) =>
        Open(parent, directory == StandardStoreDirectory.Root ? @"C:\ProgramData" : StandardStoreRules.PathOf(StandardStoreRules.Parent(directory)),
            directory == StandardStoreDirectory.Root ? "Ecs.Lic008.StandardUserControlV1" : StandardStoreRules.Relative(directory).Split('/')[^1],
            StandardStoreRules.PathOf(directory), true, null, false);
    public IStandardStoreHandle CreateDirectory(StandardStoreDirectory directory, IStandardStoreHandle parent, byte[] descriptor)
    {
        Gate(); StandardContract.Need(role == StandardStoreRole.Owner, "STANDARD_NATIVE_STORE_DIRECTORY_ROLE_REFUSED");
        descriptor = (byte[])descriptor.Clone(); StandardStoreRules.ValidateDescriptor(descriptor, StandardStoreRules.Rule(directory));
        string leaf = directory == StandardStoreDirectory.Root ? "Ecs.Lic008.StandardUserControlV1" : StandardStoreRules.Relative(directory).Split('/')[^1];
        return Open(parent, directory == StandardStoreDirectory.Root ? @"C:\ProgramData" : StandardStoreRules.PathOf(StandardStoreRules.Parent(directory)),
            leaf, StandardStoreRules.PathOf(directory), true, descriptor, true);
    }
    public IStandardStoreHandle OpenFile(StandardStoreFile file, IStandardStoreHandle parent)
    {
        Gate(); StandardContract.Need(StandardStoreRules.CanRead(role, file), "STANDARD_NATIVE_STORE_READ_ROLE_REFUSED"); var location = StandardStoreRules.Location(file);
        return Open(parent, StandardStoreRules.PathOf(location.Parent), location.Leaf, StandardStoreRules.PathOf(file), false, null, false);
    }
    public IStandardStoreHandle CreateFile(StandardStoreFile file, IStandardStoreHandle parent, byte[] descriptor)
    {
        Gate(); StandardContract.Need(StandardStoreRules.CanWrite(role, file), "STANDARD_NATIVE_STORE_WRITE_ROLE_REFUSED"); var location = StandardStoreRules.Location(file);
        descriptor = (byte[])descriptor.Clone(); StandardStoreRules.ValidateDescriptor(descriptor, StandardStoreRules.Rule(file));
        return Open(parent, StandardStoreRules.PathOf(location.Parent), location.Leaf, StandardStoreRules.PathOf(file), false, descriptor, true);
    }
    private Handle Finish(SafeFileHandle native, string path, bool directory, bool created)
    {
        var result = new Handle(native, path, created, Gate);
        try { StandardStoreRules.Object(result.Inspect(), path, directory); Gate(); return result; }
        catch { result.Dispose(); throw; }
    }
    private IStandardStoreHandle Open(IStandardStoreHandle suppliedParent, string parentPath, string leaf,
        string path, bool directory, byte[]? descriptor, bool create)
    {
        Gate(); StandardContract.Need(suppliedParent is Handle, "STANDARD_NATIVE_STORE_FOREIGN_PARENT_REFUSED"); var parent = (Handle)suppliedParent;
        StandardContract.Need(parent.Path == parentPath && leaf.Length is > 0 and < 100 && !leaf.Contains('/') && !leaf.Contains('\\'), "STANDARD_NATIVE_STORE_PARENT_REFUSED");
        StandardStoreRules.Object(parent.Inspect(), parentPath, true);
        IntPtr name = IntPtr.Zero, unicode = IntPtr.Zero; GCHandle pin = default; bool parentReference = false;
        SafeFileHandle? native = null;
        try {
            parent.Native.DangerousAddRef(ref parentReference);
            name = Marshal.StringToHGlobalUni(leaf);
            var text = new UnicodeName { Length = checked((ushort)(leaf.Length * 2)), MaximumLength = checked((ushort)((leaf.Length + 1) * 2)), Buffer = name };
            unicode = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>()); Marshal.StructureToPtr(text, unicode, false);
            if (descriptor is not null) pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
            var attributes = new ObjectAttributes { Length = Marshal.SizeOf<ObjectAttributes>(), Root = parent.Native.DangerousGetHandle(), Name = unicode,
                Flags = 0x40, SecurityDescriptor = pin.IsAllocated ? pin.AddrOfPinnedObject() : IntPtr.Zero };
            uint access = directory ? StandardStoreRules.DirectoryOpenAccess : create ? 0xc0120080u : 0x80120080u;
            Gate(); int status = NtCreateFile(out native, access, ref attributes, out var io, IntPtr.Zero, 0,
                create && !directory ? 0u : 1u, create ? 2u : 1u, 0x00200020u | (directory ? 1u : 0x40u), IntPtr.Zero, 0);
            StandardContract.Need(status == 0 && !native.IsInvalid && io.Information.ToUInt64() == (create ? 2UL : 1UL), "STANDARD_NATIVE_STORE_ATOMIC_OPEN_CREATE_REFUSED_RETAIN");
            var result = Finish(native, path, directory, create); native = null; return result;
        } finally { native?.Dispose(); if (pin.IsAllocated) pin.Free(); if (unicode != IntPtr.Zero) Marshal.FreeHGlobal(unicode);
            if (name != IntPtr.Zero) Marshal.FreeHGlobal(name); if (parentReference) parent.Native.DangerousRelease(); }
    }
    [StructLayout(LayoutKind.Sequential)] private struct Attributes { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
    [StructLayout(LayoutKind.Sequential)] private struct UnicodeName { internal ushort Length, MaximumLength; internal IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)] private struct ObjectAttributes { internal int Length; internal IntPtr Root, Name; internal uint Flags; internal IntPtr SecurityDescriptor, SecurityQos; }
    [StructLayout(LayoutKind.Sequential)] private struct IoStatus { internal IntPtr Status; internal UIntPtr Information; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)] private struct FileInfo { internal uint Attributes; internal long Creation, Access, Write; internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [DllImport("ntdll.dll")] private static extern int NtCreateFile(out SafeFileHandle handle, uint access, ref ObjectAttributes attributes, out IoStatus io,
        IntPtr allocation, uint fileAttributes, uint share, uint disposition, uint options, IntPtr ea, uint eaLength);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, ref Attributes attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll")] private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityInfo(SafeFileHandle handle, uint type, uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}
#endif
