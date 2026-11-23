using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
#if COMPILE_ONLY_STANDARD_FILE_CUSTODY_NATIVE_V1
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
#endif

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardCustodyRuntimeFile(string Name, long Size, string Sha256);
internal sealed record StandardCustodyRuntime(string Purpose, IReadOnlyList<StandardCustodyRuntimeFile> Files);
internal sealed record StandardCustodyPackage(string Purpose, string SourceSetSha256, IReadOnlyList<StandardPayloadPin> Payload);
internal sealed record StandardCustodyObject(string FinalPath, uint Type, uint Attributes, uint Links,
    uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc, long Length);
internal sealed record StandardCustodyPin(string Path, bool Directory, StandardCustodyObject Origin,
    string DescriptorSha256, string? ContentSha256, long Length);
internal sealed record StandardCustodySnapshot(StandardCryptoScope Scope, string SourceSetSha256,
    IReadOnlyList<StandardCustodyPin> Pins)
{
    public bool LoadedModulesAttested => false;
    public bool ProcessBindingEstablished => false;
    public bool CompiledSourceEquivalenceEstablished => false;
    public bool PhysicalExecutionEnabled => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}
internal interface IStandardCustodyHandle : IDisposable
{
    StandardCustodyObject Inspect();
    byte[] Descriptor();
    byte[] Read(int maximum);
    IReadOnlyList<string> Children();
}
internal interface IStandardFileCustodyBackend
{
    void RequireNoImpersonation();
    IStandardCustodyHandle OpenVolumeRoot();
    IStandardCustodyHandle OpenChild(string allowedPath, IStandardCustodyHandle parent);
}

internal static class StandardFileCustodyRules
{
    internal const string Dotnet = @"C:\Program Files\dotnet\dotnet.exe";
    internal const string App = @"C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11";
    internal const string Fxr = @"C:\Program Files\dotnet\host\fxr\10.0.11";
    internal const string TrustedInstaller = "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464";
    internal const string PackagePurpose = "TEST_ONLY_STANDARD_FILE_CUSTODY_PACKAGE_V1";
    internal const string RuntimePurpose = "TEST_ONLY_STANDARD_FILE_CUSTODY_RUNTIME_V1";
    internal const string Package = StandardContract.Root + @"\input\package-manifest.json";
    internal const string SourceSet = StandardContract.Root + @"\input\source-set.json";
    internal const string RuntimeInventory = StandardContract.Root + @"\bin\runtime-inventory.json";
    internal const string Assembly = StandardContract.Root + @"\bin\StandardControl.dll";
    internal const string RuntimeConfig = StandardContract.Root + @"\bin\StandardControl.runtimeconfig.json";
    internal const int Maximum = 67108864;
    // Exact 189 App files + one hostfxr.dll, from the immutable construction
    // inventory. This is an allowed disk set, not a list of loaded modules.
    internal static IReadOnlyList<string> RuntimeNames { get; } = Array.AsReadOnly(new[] {
        "app/.version",
        "app/clretwrc.dll",
        "app/clrgc.dll",
        "app/clrgcexp.dll",
        "app/clrjit.dll",
        "app/coreclr.dll",
        "app/createdump.exe",
        "app/hostpolicy.dll",
        "app/Microsoft.CSharp.dll",
        "app/Microsoft.DiaSymReader.Native.amd64.dll",
        "app/Microsoft.NETCore.App.deps.json",
        "app/Microsoft.NETCore.App.runtimeconfig.json",
        "app/Microsoft.VisualBasic.Core.dll",
        "app/Microsoft.VisualBasic.dll",
        "app/Microsoft.Win32.Primitives.dll",
        "app/Microsoft.Win32.Registry.dll",
        "app/mscordaccore.dll",
        "app/mscordaccore_amd64_amd64_10.0.1126.37416.dll",
        "app/mscordbi.dll",
        "app/mscorlib.dll",
        "app/mscorrc.dll",
        "app/msquic.dll",
        "app/netstandard.dll",
        "app/System.AppContext.dll",
        "app/System.Buffers.dll",
        "app/System.Collections.Concurrent.dll",
        "app/System.Collections.dll",
        "app/System.Collections.Immutable.dll",
        "app/System.Collections.NonGeneric.dll",
        "app/System.Collections.Specialized.dll",
        "app/System.ComponentModel.Annotations.dll",
        "app/System.ComponentModel.DataAnnotations.dll",
        "app/System.ComponentModel.dll",
        "app/System.ComponentModel.EventBasedAsync.dll",
        "app/System.ComponentModel.Primitives.dll",
        "app/System.ComponentModel.TypeConverter.dll",
        "app/System.Configuration.dll",
        "app/System.Console.dll",
        "app/System.Core.dll",
        "app/System.Data.Common.dll",
        "app/System.Data.DataSetExtensions.dll",
        "app/System.Data.dll",
        "app/System.Diagnostics.Contracts.dll",
        "app/System.Diagnostics.Debug.dll",
        "app/System.Diagnostics.DiagnosticSource.dll",
        "app/System.Diagnostics.FileVersionInfo.dll",
        "app/System.Diagnostics.Process.dll",
        "app/System.Diagnostics.StackTrace.dll",
        "app/System.Diagnostics.TextWriterTraceListener.dll",
        "app/System.Diagnostics.Tools.dll",
        "app/System.Diagnostics.TraceSource.dll",
        "app/System.Diagnostics.Tracing.dll",
        "app/System.dll",
        "app/System.Drawing.dll",
        "app/System.Drawing.Primitives.dll",
        "app/System.Dynamic.Runtime.dll",
        "app/System.Formats.Asn1.dll",
        "app/System.Formats.Tar.dll",
        "app/System.Globalization.Calendars.dll",
        "app/System.Globalization.dll",
        "app/System.Globalization.Extensions.dll",
        "app/System.IO.Compression.Brotli.dll",
        "app/System.IO.Compression.dll",
        "app/System.IO.Compression.FileSystem.dll",
        "app/System.IO.Compression.Native.dll",
        "app/System.IO.Compression.ZipFile.dll",
        "app/System.IO.dll",
        "app/System.IO.FileSystem.AccessControl.dll",
        "app/System.IO.FileSystem.dll",
        "app/System.IO.FileSystem.DriveInfo.dll",
        "app/System.IO.FileSystem.Primitives.dll",
        "app/System.IO.FileSystem.Watcher.dll",
        "app/System.IO.IsolatedStorage.dll",
        "app/System.IO.MemoryMappedFiles.dll",
        "app/System.IO.Pipelines.dll",
        "app/System.IO.Pipes.AccessControl.dll",
        "app/System.IO.Pipes.dll",
        "app/System.IO.UnmanagedMemoryStream.dll",
        "app/System.Linq.AsyncEnumerable.dll",
        "app/System.Linq.dll",
        "app/System.Linq.Expressions.dll",
        "app/System.Linq.Parallel.dll",
        "app/System.Linq.Queryable.dll",
        "app/System.Memory.dll",
        "app/System.Net.dll",
        "app/System.Net.Http.dll",
        "app/System.Net.Http.Json.dll",
        "app/System.Net.HttpListener.dll",
        "app/System.Net.Mail.dll",
        "app/System.Net.NameResolution.dll",
        "app/System.Net.NetworkInformation.dll",
        "app/System.Net.Ping.dll",
        "app/System.Net.Primitives.dll",
        "app/System.Net.Quic.dll",
        "app/System.Net.Requests.dll",
        "app/System.Net.Security.dll",
        "app/System.Net.ServerSentEvents.dll",
        "app/System.Net.ServicePoint.dll",
        "app/System.Net.Sockets.dll",
        "app/System.Net.WebClient.dll",
        "app/System.Net.WebHeaderCollection.dll",
        "app/System.Net.WebProxy.dll",
        "app/System.Net.WebSockets.Client.dll",
        "app/System.Net.WebSockets.dll",
        "app/System.Numerics.dll",
        "app/System.Numerics.Vectors.dll",
        "app/System.ObjectModel.dll",
        "app/System.Private.CoreLib.dll",
        "app/System.Private.DataContractSerialization.dll",
        "app/System.Private.Uri.dll",
        "app/System.Private.Xml.dll",
        "app/System.Private.Xml.Linq.dll",
        "app/System.Reflection.DispatchProxy.dll",
        "app/System.Reflection.dll",
        "app/System.Reflection.Emit.dll",
        "app/System.Reflection.Emit.ILGeneration.dll",
        "app/System.Reflection.Emit.Lightweight.dll",
        "app/System.Reflection.Extensions.dll",
        "app/System.Reflection.Metadata.dll",
        "app/System.Reflection.Primitives.dll",
        "app/System.Reflection.TypeExtensions.dll",
        "app/System.Resources.Reader.dll",
        "app/System.Resources.ResourceManager.dll",
        "app/System.Resources.Writer.dll",
        "app/System.Runtime.CompilerServices.Unsafe.dll",
        "app/System.Runtime.CompilerServices.VisualC.dll",
        "app/System.Runtime.dll",
        "app/System.Runtime.Extensions.dll",
        "app/System.Runtime.Handles.dll",
        "app/System.Runtime.InteropServices.dll",
        "app/System.Runtime.InteropServices.JavaScript.dll",
        "app/System.Runtime.InteropServices.RuntimeInformation.dll",
        "app/System.Runtime.Intrinsics.dll",
        "app/System.Runtime.Loader.dll",
        "app/System.Runtime.Numerics.dll",
        "app/System.Runtime.Serialization.dll",
        "app/System.Runtime.Serialization.Formatters.dll",
        "app/System.Runtime.Serialization.Json.dll",
        "app/System.Runtime.Serialization.Primitives.dll",
        "app/System.Runtime.Serialization.Xml.dll",
        "app/System.Security.AccessControl.dll",
        "app/System.Security.Claims.dll",
        "app/System.Security.Cryptography.Algorithms.dll",
        "app/System.Security.Cryptography.Cng.dll",
        "app/System.Security.Cryptography.Csp.dll",
        "app/System.Security.Cryptography.dll",
        "app/System.Security.Cryptography.Encoding.dll",
        "app/System.Security.Cryptography.OpenSsl.dll",
        "app/System.Security.Cryptography.Primitives.dll",
        "app/System.Security.Cryptography.X509Certificates.dll",
        "app/System.Security.dll",
        "app/System.Security.Principal.dll",
        "app/System.Security.Principal.Windows.dll",
        "app/System.Security.SecureString.dll",
        "app/System.ServiceModel.Web.dll",
        "app/System.ServiceProcess.dll",
        "app/System.Text.Encoding.CodePages.dll",
        "app/System.Text.Encoding.dll",
        "app/System.Text.Encoding.Extensions.dll",
        "app/System.Text.Encodings.Web.dll",
        "app/System.Text.Json.dll",
        "app/System.Text.RegularExpressions.dll",
        "app/System.Threading.AccessControl.dll",
        "app/System.Threading.Channels.dll",
        "app/System.Threading.dll",
        "app/System.Threading.Overlapped.dll",
        "app/System.Threading.Tasks.Dataflow.dll",
        "app/System.Threading.Tasks.dll",
        "app/System.Threading.Tasks.Extensions.dll",
        "app/System.Threading.Tasks.Parallel.dll",
        "app/System.Threading.Thread.dll",
        "app/System.Threading.ThreadPool.dll",
        "app/System.Threading.Timer.dll",
        "app/System.Transactions.dll",
        "app/System.Transactions.Local.dll",
        "app/System.ValueTuple.dll",
        "app/System.Web.dll",
        "app/System.Web.HttpUtility.dll",
        "app/System.Windows.dll",
        "app/System.Xml.dll",
        "app/System.Xml.Linq.dll",
        "app/System.Xml.ReaderWriter.dll",
        "app/System.Xml.Serialization.dll",
        "app/System.Xml.XDocument.dll",
        "app/System.Xml.XmlDocument.dll",
        "app/System.Xml.XmlSerializer.dll",
        "app/System.Xml.XPath.dll",
        "app/System.Xml.XPath.XDocument.dll",
        "app/WindowsBase.dll",
        "fxr/hostfxr.dll"
    });
    internal static string RuntimePath(string name)
    {
        StandardContract.Need(RuntimeNames.Contains(name, StringComparer.Ordinal), "STANDARD_CUSTODY_RUNTIME_NAME_REFUSED");
        return (name.StartsWith("app/", StringComparison.Ordinal) ? App : Fxr) + "\\" + name[4..];
    }
    internal static string Parent(string path)
    {
        StandardContract.Need(path is not null && path.Length > 3 && path[1] == ':' && path[2] == '\\',
            "STANDARD_CUSTODY_PARENT_REFUSED");
        int split = path.LastIndexOf('\\'); return split == 2 ? path[..3] : path[..split];
    }
    internal static IReadOnlyList<string> LeafPaths { get; } = Array.AsReadOnly(new[] {
        Dotnet, Assembly, RuntimeConfig, Package, SourceSet, RuntimeInventory
    }.Concat(RuntimeNames.Select(RuntimePath)).ToArray());
    internal static IReadOnlyList<string> DirectoryPaths { get; } = Array.AsReadOnly(LeafPaths.SelectMany(path => {
        var items = new List<string>(); for (string cursor = Parent(path);; cursor = Parent(cursor)) {
            items.Add(cursor); if (cursor == @"C:\") break;
        } return items;
    }).Distinct(StringComparer.Ordinal).OrderBy(x => x.Length).ThenBy(x => x, StringComparer.Ordinal).ToArray());
    internal static bool SearchDirectory(string path) => path == App || path == Fxr || path == StandardContract.Root + @"\bin";
    internal static bool Allowed(string? path, bool directory) => path is not null &&
        (directory ? DirectoryPaths : LeafPaths).Contains(path, StringComparer.Ordinal);
    internal static IReadOnlyList<string> SearchChildren(string path)
    {
        StandardContract.Need(SearchDirectory(path), "STANDARD_CUSTODY_SEARCH_DIRECTORY_REFUSED");
        return Array.AsReadOnly(LeafPaths.Where(p => Parent(p) == path).Select(p => p[(path.Length + 1)..])
            .OrderBy(x => x, StringComparer.Ordinal).ToArray());
    }
    internal static string Hash(ReadOnlySpan<byte> bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    internal static bool Sha(string? value) => value is { Length: 64 } && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static readonly JsonSerializerOptions Json = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 8
    };
    internal static byte[] Encode(StandardCustodyPackage package) => JsonSerializer.SerializeToUtf8Bytes(package, Json);
    internal static byte[] Encode(StandardCustodyRuntime runtime) => JsonSerializer.SerializeToUtf8Bytes(runtime, Json);
    private static T Parse<T>(byte[] bytes) where T : class
    {
        StandardContract.Need(bytes is { Length: > 1 and <= 131072 }, "STANDARD_CUSTODY_ORIGINAL_SIZE_REFUSED");
        try {
            _ = new UTF8Encoding(false, true).GetString(bytes);
            using var doc = JsonDocument.Parse(bytes, new() { MaxDepth = 8 });
            void Unique(JsonElement element) {
                if (element.ValueKind == JsonValueKind.Object) {
                    var names = new HashSet<string>(StringComparer.Ordinal);
                    foreach (var p in element.EnumerateObject()) { StandardContract.Need(names.Add(p.Name), "STANDARD_CUSTODY_DUPLICATE_JSON"); Unique(p.Value); }
                } else if (element.ValueKind == JsonValueKind.Array) foreach (var v in element.EnumerateArray()) Unique(v);
            }
            Unique(doc.RootElement);
            var parsed = JsonSerializer.Deserialize<T>(bytes, Json);
            StandardContract.Need(parsed is not null && bytes.AsSpan().SequenceEqual(JsonSerializer.SerializeToUtf8Bytes(parsed, Json)),
                "STANDARD_CUSTODY_ORIGINAL_NONCANONICAL"); return parsed;
        } catch (JsonException) { throw new InvalidDataException("STANDARD_CUSTODY_ORIGINAL_JSON_REFUSED"); }
        catch (DecoderFallbackException) { throw new InvalidDataException("STANDARD_CUSTODY_ORIGINAL_UTF8_REFUSED"); }
    }
    internal static IReadOnlyDictionary<string, (long Size, string Hash)> Bind(StandardBoundInput input,
        byte[] package, byte[] runtime, byte[] sources, DateTimeOffset? now = null)
    {
        StandardContract.Need(input is not null && input.Plan is not null && input.Approval is not null && input.Scope is not null,
            "STANDARD_CUSTODY_BOUND_INPUT_MISSING");
        DateTimeOffset at = now ?? input.Scope.IssuedUtc;
        StandardStoreRules.Scope(input.Scope, at);
        var rebound = StandardInputCodec.Bind(StandardInputCodec.EncodePlan(input.Plan), StandardInputCodec.EncodeApproval(input.Approval), at);
        StandardContract.Need(rebound.Scope == input.Scope && rebound.SourceSetSha256 == input.SourceSetSha256,
            "STANDARD_CUSTODY_BOUND_INPUT_INCONSISTENT");
        input = rebound; // Own the codec's bounded payload snapshot.
        StandardContract.Need(
            Sha(input.SourceSetSha256) && input.Plan.SourceSetSha256 == input.SourceSetSha256 &&
            input.Plan.PackageSha256 == input.Scope.PackageSha256 && input.Plan.RuntimeSha256 == input.Scope.RuntimeSha256 &&
            input.Plan.ImageSha256 == input.Scope.ImageSha256 &&
            package is { Length: > 1 and <= 131072 } && runtime is { Length: > 1 and <= 131072 } &&
            sources is { Length: > 0 and <= 2097152 } && Hash(package) == input.Scope.PackageSha256 &&
            Hash(runtime) == input.Scope.RuntimeSha256 && Hash(sources) == input.SourceSetSha256,
            "STANDARD_CUSTODY_ORIGINAL_BINDING_REFUSED");
        var p = Parse<StandardCustodyPackage>(package); var r = Parse<StandardCustodyRuntime>(runtime);
        StandardContract.Need(p.Purpose == PackagePurpose && p.SourceSetSha256 == input.SourceSetSha256 &&
            p.Payload is { Count: 2 } && input.Plan.Payload is { Count: 2 } &&
            p.Payload[0] is not null && p.Payload[1] is not null &&
            p.Payload.SequenceEqual(input.Plan.Payload) && p.Payload[0].Name == "StandardControl.dll" &&
            p.Payload[0].Size is > 0 and <= 4194304 && p.Payload[0].Sha256 == input.Scope.AssemblySha256 &&
            p.Payload[1].Name == "StandardControl.runtimeconfig.json" && p.Payload[1].Size is > 0 and <= 4096 &&
            p.Payload.All(x => x is not null && Sha(x.Sha256)) &&
            r.Purpose == RuntimePurpose && r.Files is { Count: 190 }, "STANDARD_CUSTODY_INVENTORY_PROFILE_REFUSED");
        var result = new Dictionary<string, (long, string)>(StringComparer.Ordinal);
        for (int i = 0; i < RuntimeNames.Count; i++) {
            var file = r.Files[i];
            StandardContract.Need(file is not null && file.Name == RuntimeNames[i] && file.Size is > 0 and <= Maximum &&
                Sha(file.Sha256), "STANDARD_CUSTODY_EXACT_RUNTIME_SET_REFUSED");
            result.Add(RuntimePath(file.Name), (file.Size, file.Sha256));
        }
        // Image length is independently bounded/read from its held handle; its
        // approved hash is pinned. No compiler/tool/reference file is a runtime.
        result.Add(Dotnet, (-1, input.Scope.ImageSha256));
        result.Add(Assembly, (p.Payload[0].Size, p.Payload[0].Sha256));
        result.Add(RuntimeConfig, (p.Payload[1].Size, p.Payload[1].Sha256));
        result.Add(Package, (package.Length, Hash(package))); result.Add(RuntimeInventory, (runtime.Length, Hash(runtime)));
        result.Add(SourceSet, (sources.Length, Hash(sources)));
        return new System.Collections.ObjectModel.ReadOnlyDictionary<string, (long, string)>(result);
    }
    internal static void Object(StandardCustodyObject? value, string path, bool directory, DateTimeOffset now)
    {
        StandardContract.Need(Allowed(path, directory) && value is not null && value.Type == 1 &&
            value.FinalPath.Equals("\\\\?\\" + path, StringComparison.OrdinalIgnoreCase) &&
            (value.Attributes & 0x1400u) == 0 && ((value.Attributes & 16) != 0) == directory &&
            value.Links == 1 && value.VolumeSerial != 0 && value.FileIndex != 0 &&
            value.CreationFileTimeUtc > 0 && value.Length >= 0 && (directory || value.Length is > 0 and <= Maximum),
            "STANDARD_CUSTODY_OBJECT_REFUSED");
        DateTime created;
        try { created = DateTime.FromFileTimeUtc(value.CreationFileTimeUtc); }
        catch (ArgumentOutOfRangeException) { throw new InvalidDataException("STANDARD_CUSTODY_CREATION_REFUSED"); }
        StandardContract.Need(created <= now.UtcDateTime, "STANDARD_CUSTODY_FUTURE_CREATION_REFUSED");
    }
    internal static bool SameOrigin(StandardCustodyObject a, StandardCustodyObject b) =>
        a.FinalPath == b.FinalPath && a.Type == b.Type && a.Attributes == b.Attributes && a.Links == b.Links &&
        a.VolumeSerial == b.VolumeSerial && a.FileIndex == b.FileIndex && a.CreationFileTimeUtc == b.CreationFileTimeUtc && a.Length == b.Length;
    private static bool Trusted(string sid) => sid is StandardStoreRules.System or StandardStoreRules.Admin or TrustedInstaller;
    internal static void Descriptor(byte[]? bytes, bool directory, bool search)
    {
        StandardContract.Need(bytes is { Length: >= 20 and <= 65536 } && bytes[0] == 1 && bytes[1] == 0 &&
            (BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(2)) & 0x8004) == 0x8004 &&
            (BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(2)) & ~0x950f) == 0 &&
            BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(12)) == 0, "STANDARD_CUSTODY_DACL_HEADER_REFUSED");
        string SidAt(int offset, int limit, out int length) {
            StandardContract.Need(offset >= 20 && (offset & 3) == 0 && offset <= limit - 8 && limit <= bytes.Length &&
                bytes[offset] == 1 && bytes[offset + 1] is >= 1 and <= 15, "STANDARD_CUSTODY_SID_REFUSED");
            int count = bytes[offset + 1]; length = 8 + count * 4;
            StandardContract.Need(length <= limit - offset, "STANDARD_CUSTODY_SID_SIZE_REFUSED");
            ulong auth = 0; for (int i = 0; i < 6; i++) auth = (auth << 8) | bytes[offset + 2 + i];
            return "S-1-" + auth.ToString(CultureInfo.InvariantCulture) + "-" +
                string.Join("-", Enumerable.Range(0, count).Select(i => BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(offset + 8 + i * 4)).ToString(CultureInfo.InvariantCulture)));
        }
        int owner = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(4)), group = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(8)),
            acl = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(16));
        string ownerSid = SidAt(owner, bytes.Length, out int ownerLength), groupSid = SidAt(group, bytes.Length, out int groupLength);
        StandardContract.Need(Trusted(ownerSid) && Trusted(groupSid), "STANDARD_CUSTODY_UNTRUSTED_OWNER_GROUP");
        StandardContract.Need(acl >= 20 && (acl & 3) == 0 && acl <= bytes.Length - 8 && bytes[acl] is 2 or 4 &&
            bytes[acl + 1] == 0 && bytes[acl + 6] == 0 && bytes[acl + 7] == 0, "STANDARD_CUSTODY_ACL_REFUSED");
        int size = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 2)), countAces = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(acl + 4));
        StandardContract.Need(size >= 8 && size <= bytes.Length - acl && countAces <= 1024, "STANDARD_CUSTODY_ACL_SIZE_REFUSED");
        // Files/search directories refuse untrusted byte/add/delete/metadata/
        // DACL/owner rights. Upper ancestors may allow creation of a sibling,
        // which cannot replace a held child without delete/namespace authority.
        uint mutation = 0x500d0116u | (directory ? 0x40u : 0u);
        if (directory && !search) mutation &= ~4u; // AddSubdirectory only; keep WRITE_DATA/AddFile refused.
        int position = acl + 8;
        for (int i = 0; i < countAces; i++) {
            StandardContract.Need(position <= acl + size - 8 && bytes[position] is 0 or 1 &&
                (bytes[position + 1] & ~0x1f) == 0, "STANDARD_CUSTODY_UNKNOWN_ACE_REFUSED");
            int aceSize = BinaryPrimitives.ReadUInt16LittleEndian(bytes.AsSpan(position + 2));
            StandardContract.Need(aceSize >= 20 && aceSize <= acl + size - position, "STANDARD_CUSTODY_ACE_SIZE_REFUSED");
            string sid = SidAt(position + 8, position + aceSize, out int sidLength);
            StandardContract.Need(aceSize == sidLength + 8, "STANDARD_CUSTODY_ACE_SID_REFUSED");
            uint mask = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(position + 4));
            bool effectiveAllow = bytes[position] == 0 && (bytes[position + 1] & 8) == 0;
            StandardContract.Need(!effectiveAllow || Trusted(sid) || (mask & mutation) == 0,
                "STANDARD_CUSTODY_UNTRUSTED_MUTATING_ACE");
            position += aceSize;
        }
        StandardContract.Need(position == acl + size, "STANDARD_CUSTODY_ACL_TRAILING_REFUSED");
        bool[] used = new bool[bytes.Length]; Array.Fill(used, true, 0, 20);
        void Mark(int offset, int length) { for (int i = offset; i < offset + length; i++) {
            StandardContract.Need(!used[i], "STANDARD_CUSTODY_DESCRIPTOR_OVERLAP"); used[i] = true;
        } }
        Mark(owner, ownerLength); if (group != owner) Mark(group, groupLength);
        else StandardContract.Need(groupLength == ownerLength, "STANDARD_CUSTODY_SID_OVERLAP");
        Mark(acl, size); StandardContract.Need(used.All(x => x), "STANDARD_CUSTODY_DESCRIPTOR_TRAILING");
    }
}

// This is file custody only. It holds exact originals/dependency candidates and
// namespace ancestors, not proof those modules were loaded. The future native
// controller must bind process/image/loadpaths/environment, installed dependency
// resolution and the complete approved placement provenance separately.
internal sealed class StandardFileCustody : IDisposable
{
    private readonly StandardCryptoScope scope;
    private readonly string sourceSet;
    private readonly IStandardFileCustodyBackend backend;
    private readonly Action<string> guard;
    private readonly Func<DateTimeOffset> clock;
    private readonly object sync = new();
    private readonly Dictionary<string, IStandardCustodyHandle> handles = new(StringComparer.Ordinal);
    private readonly Dictionary<string, StandardCustodyPin> pins = new(StringComparer.Ordinal);
    private bool active, disposed;
    private StandardFileCustody(StandardCryptoScope scope, string sourceSet, IStandardFileCustodyBackend backend,
        Action<string> guard, Func<DateTimeOffset> clock) {
        this.scope = scope; this.sourceSet = sourceSet; this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard)); this.clock = clock ?? throw new ArgumentNullException(nameof(clock));
    }
    private void Gate(string stage) {
        StandardContract.Need(!disposed, "STANDARD_CUSTODY_DISPOSED"); StandardStoreRules.Scope(scope, clock()); backend.RequireNoImpersonation();
        guard(stage); StandardContract.Need(!disposed, "STANDARD_CUSTODY_DISPOSED_DURING_GUARD");
        StandardStoreRules.Scope(scope, clock()); backend.RequireNoImpersonation();
    }
    private T Perform<T>(Func<T> action) { lock (sync) {
        StandardContract.Need(!active && !disposed, "STANDARD_CUSTODY_REENTRY_OR_DISPOSED"); active = true;
        try { return action(); } finally { active = false; }
    } }
    private StandardCustodyPin Check(string path, bool directory, (long Size, string Hash)? expected) {
        Gate("BeforeHeldCheck"); var handle = handles[path]; var first = handle.Inspect();
        StandardFileCustodyRules.Object(first, path, directory, clock());
        byte[] descriptor = handle.Descriptor(); StandardFileCustodyRules.Descriptor(descriptor, directory, StandardFileCustodyRules.SearchDirectory(path));
        string? hash = null;
        if (!directory) {
            var pin = expected!.Value;
            StandardContract.Need(pin.Size == -1 || first.Length == pin.Size, "STANDARD_CUSTODY_LENGTH_REFUSED");
            byte[] bytes = handle.Read(StandardFileCustodyRules.Maximum);
            StandardContract.Need(bytes.Length == first.Length && StandardFileCustodyRules.Hash(bytes) == pin.Hash, "STANDARD_CUSTODY_CONTENT_REFUSED");
            hash = pin.Hash;
        } else if (StandardFileCustodyRules.SearchDirectory(path)) {
            var children = handle.Children();
            StandardContract.Need(children is not null && children.Count <= 256 &&
                children.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(StandardFileCustodyRules.SearchChildren(path)),
                "STANDARD_CUSTODY_SEARCH_SET_CHANGED");
        }
        var after = handle.Inspect(); StandardContract.Need(StandardFileCustodyRules.SameOrigin(first, after),
            "STANDARD_CUSTODY_OBJECT_CHANGED_DURING_READ"); Gate("AfterHeldCheck");
        return new(path, directory, first, StandardFileCustodyRules.Hash(descriptor), hash, first.Length);
    }
    internal static StandardFileCustody Acquire(StandardBoundInput input, byte[] packageOriginal, byte[] runtimeOriginal,
        byte[] sourceSetOriginal, IStandardFileCustodyBackend backend, Action<string> trustedGuard, Func<DateTimeOffset> utcNow)
    {
        StandardContract.Need(input is not null, "STANDARD_CUSTODY_INPUT_REQUIRED");
        // Snapshot all three originals before parsing or admitting supplied pins.
        StandardContract.Need(packageOriginal is { Length: > 1 and <= 131072 } && runtimeOriginal is { Length: > 1 and <= 131072 } &&
            sourceSetOriginal is { Length: > 0 and <= 2097152 },
            "STANDARD_CUSTODY_ORIGINALS_REQUIRED");
        byte[] p = (byte[])packageOriginal.Clone(), r = (byte[])runtimeOriginal.Clone(), s = (byte[])sourceSetOriginal.Clone();
        ArgumentNullException.ThrowIfNull(utcNow);
        var expected = StandardFileCustodyRules.Bind(input, p, r, s, utcNow());
        var lease = new StandardFileCustody(input.Scope, input.SourceSetSha256, backend, trustedGuard, utcNow);
        try { return lease.Perform(() => {
            lease.Gate("Acquire");
            foreach (string directory in StandardFileCustodyRules.DirectoryPaths) {
                lease.Gate("BeforeOpenDirectory");
                var handle = directory == @"C:\" ? backend.OpenVolumeRoot() : backend.OpenChild(directory, lease.handles[StandardFileCustodyRules.Parent(directory)]);
                lease.handles.Add(directory, handle); lease.pins.Add(directory, lease.Check(directory, true, null));
            }
            foreach (string path in StandardFileCustodyRules.LeafPaths) {
                lease.Gate("BeforeOpenFile"); lease.handles.Add(path, backend.OpenChild(path, lease.handles[StandardFileCustodyRules.Parent(path)]));
                lease.pins.Add(path, lease.Check(path, false, expected[path]));
            }
            StandardContract.Need(lease.pins.Values.Select(x => (x.Origin.VolumeSerial, x.Origin.FileIndex)).Distinct().Count() == lease.pins.Count,
                "STANDARD_CUSTODY_OBJECT_ALIAS_REFUSED");
            lease.VerifyCore(); return lease;
        }); } catch { lease.Dispose(); throw; }
    }
    private void VerifyCore() {
        Gate("Verify");
        foreach (var pin in pins.Values) {
            var fresh = Check(pin.Path, pin.Directory, pin.Directory ? null : (pin.Length, pin.ContentSha256!));
            StandardContract.Need(StandardFileCustodyRules.SameOrigin(pin.Origin, fresh.Origin) &&
                fresh.DescriptorSha256 == pin.DescriptorSha256, "STANDARD_CUSTODY_ORIGIN_OR_ACL_CHANGED");
        }
        Gate("AfterVerify");
    }
    internal void Verify() => Perform(() => { VerifyCore(); return true; });
    internal StandardCustodySnapshot Snapshot() => Perform(() => {
        VerifyCore(); return new StandardCustodySnapshot(scope, sourceSet, Array.AsReadOnly(pins.Values.ToArray()));
    });
    public void Dispose() { lock (sync) {
        StandardContract.Need(!active, "STANDARD_CUSTODY_REENTRANT_DISPOSE_REFUSED");
        if (disposed) return; disposed = true;
        foreach (var handle in handles.Values.Reverse()) handle.Dispose();
    } }
}

#if COMPILE_ONLY_STANDARD_FILE_CUSTODY_NATIVE_V1
// Read-only compile-only bindings. No mutation API, default entry or CLI exists.
// Unknown native/security/option behavior fails closed; physical compatibility
// and native race behavior have NOT been established by the pure tests.
internal sealed class StandardNativeFileCustodyBackend : IStandardFileCustodyBackend
{
    private readonly StandardCryptoScope scope; private readonly Action<string> guard; private readonly Func<DateTimeOffset> clock;
    internal StandardNativeFileCustodyBackend(StandardCryptoScope scope, Action<string> guard, Func<DateTimeOffset> clock) {
        this.scope = scope; this.guard = guard ?? throw new ArgumentNullException(nameof(guard)); this.clock = clock ?? throw new ArgumentNullException(nameof(clock)); Gate();
    }
    public void RequireNoImpersonation() {
        StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows), "STANDARD_CUSTODY_NATIVE_OS_REFUSED");
        bool opened = OpenThreadToken(GetCurrentThread(), 8, true, out var token); int error = Marshal.GetLastWin32Error();
        token?.Dispose(); StandardContract.Need(!opened && error == 1008, "STANDARD_CUSTODY_IMPERSONATION_OR_QUERY_REFUSED");
    }
    private void Gate() {
        StandardStoreRules.Scope(scope, clock()); RequireNoImpersonation(); guard("NativeFileCustody");
        StandardStoreRules.Scope(scope, clock()); RequireNoImpersonation();
        StandardContract.Need(RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
            RuntimeInformation.OSArchitecture == Architecture.X64 && Environment.Version.ToString() == "10.0.11", "STANDARD_CUSTODY_NATIVE_RUNTIME_REFUSED");
    }
    private sealed class Handle : IStandardCustodyHandle
    {
        internal readonly SafeFileHandle Native; internal readonly string Path; internal readonly StandardNativeFileCustodyBackend owner;
        internal Handle(SafeFileHandle native, string path, StandardNativeFileCustodyBackend owner) { Native = native; Path = path; this.owner = owner; }
        public StandardCustodyObject Inspect() {
            owner.Gate(); StandardContract.Need(GetFileInformationByHandle(Native, out var info), "STANDARD_CUSTODY_NATIVE_INFO_REFUSED");
            var path = new StringBuilder(32768); uint length = GetFinalPathNameByHandleW(Native, path, (uint)path.Capacity, 0);
            StandardContract.Need(length > 0 && length < path.Capacity, "STANDARD_CUSTODY_NATIVE_PATH_REFUSED");
            var result = new StandardCustodyObject(path.ToString(), GetFileType(Native), info.Attributes, info.Links, info.Volume,
                ((ulong)info.IndexHigh << 32) | info.IndexLow, info.Creation, checked((long)(((ulong)info.SizeHigh << 32) | info.SizeLow)));
            owner.Gate(); return result;
        }
        public byte[] Descriptor() {
            owner.Gate(); uint status = GetSecurityInfo(Native, 1, 7, out _, out _, out _, out _, out var pointer);
            try { StandardContract.Need(status == 0 && pointer != IntPtr.Zero, "STANDARD_CUSTODY_NATIVE_ACL_REFUSED");
                int length = checked((int)GetSecurityDescriptorLength(pointer)); StandardContract.Need(length is >= 20 and <= 65536, "STANDARD_CUSTODY_NATIVE_ACL_SIZE_REFUSED");
                byte[] bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, length); owner.Gate(); return bytes;
            } finally { if (pointer != IntPtr.Zero) LocalFree(pointer); }
        }
        public byte[] Read(int maximum) {
            owner.Gate(); StandardContract.Need(StandardFileCustodyRules.Allowed(Path, false) && maximum is > 0 and <= StandardFileCustodyRules.Maximum, "STANDARD_CUSTODY_NATIVE_READ_PATH_REFUSED");
            long size = RandomAccess.GetLength(Native); StandardContract.Need(size > 0 && size <= maximum, "STANDARD_CUSTODY_NATIVE_READ_SIZE_REFUSED");
            var bytes = new byte[checked((int)size)]; int offset = 0;
            while (offset < bytes.Length) { owner.Gate(); int count = RandomAccess.Read(Native, bytes.AsSpan(offset), offset);
                StandardContract.Need(count > 0, "STANDARD_CUSTODY_NATIVE_READ_SHORT"); offset += count; }
            StandardContract.Need(RandomAccess.GetLength(Native) == size, "STANDARD_CUSTODY_NATIVE_LENGTH_CHANGED"); owner.Gate(); return bytes;
        }
        public IReadOnlyList<string> Children() {
            owner.Gate(); StandardContract.Need(StandardFileCustodyRules.SearchDirectory(Path), "STANDARD_CUSTODY_NATIVE_ENUM_ROLE_REFUSED");
            var names = new List<string>(); byte[] bytes = new byte[65536]; var pin = GCHandle.Alloc(bytes, GCHandleType.Pinned);
            bool held = false;
            try { Native.DangerousAddRef(ref held); bool restart = true; int pages = 0;
                while (true) {
                    StandardContract.Need(++pages <= 256, "STANDARD_CUSTODY_NATIVE_ENUM_PAGE_LIMIT");
                    owner.Gate(); int status = NtQueryDirectoryFile(Native.DangerousGetHandle(), IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                        out var io, pin.AddrOfPinnedObject(), (uint)bytes.Length, 12, false, IntPtr.Zero, restart); restart = false;
                    if (status == unchecked((int)0x80000006)) break;
                    StandardContract.Need(status == 0 && io.Information.ToUInt64() is > 0 and <= 65536, "STANDARD_CUSTODY_NATIVE_ENUM_REFUSED");
                    int used = checked((int)io.Information.ToUInt64()), position = 0;
                    while (true) {
                        StandardContract.Need(position <= used - 12, "STANDARD_CUSTODY_NATIVE_ENUM_HEADER_REFUSED");
                        uint next = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(position));
                        int length = checked((int)BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(position + 8)));
                        StandardContract.Need(length > 0 && (length & 1) == 0 && length <= used - position - 12, "STANDARD_CUSTODY_NATIVE_ENUM_NAME_REFUSED");
                        string name = new UnicodeEncoding(false, false, true).GetString(bytes, position + 12, length);
                        if (name is not "." and not "..") {
                            StandardContract.Need(name.Length <= 256 && !name.Contains('\\') && !name.Contains('/') && !name.Contains(':') &&
                                !name.Contains('\0') && names.Count < 256, "STANDARD_CUSTODY_NATIVE_ENUM_ENTRY_REFUSED"); names.Add(name);
                        }
                        if (next == 0) break;
                        StandardContract.Need(next >= 12 + length && (next & 3) == 0 && next <= used - position - 12, "STANDARD_CUSTODY_NATIVE_ENUM_OFFSET_REFUSED");
                        position += checked((int)next);
                    }
                }
                owner.Gate(); return names.AsReadOnly();
            } finally { if (held) Native.DangerousRelease(); pin.Free(); }
        }
        public void Dispose() => Native.Dispose();
    }
    public IStandardCustodyHandle OpenVolumeRoot() {
        Gate(); var attrs = new Attributes { Length = Marshal.SizeOf<Attributes>() };
        var handle = CreateFileW(@"C:\", 0x1200a0, 1, ref attrs, 3, 0x02200000, IntPtr.Zero);
        StandardContract.Need(!handle.IsInvalid, "STANDARD_CUSTODY_NATIVE_VOLUME_REFUSED"); return Finish(handle, @"C:\", true);
    }
    private Handle Finish(SafeFileHandle handle, string path, bool directory) {
        var result = new Handle(handle, path, this);
        try { StandardFileCustodyRules.Object(result.Inspect(), path, directory, clock()); Gate(); return result; }
        catch { result.Dispose(); throw; }
    }
    public IStandardCustodyHandle OpenChild(string allowedPath, IStandardCustodyHandle suppliedParent) {
        Gate(); bool directory = StandardFileCustodyRules.Allowed(allowedPath, true);
        StandardContract.Need(directory || StandardFileCustodyRules.Allowed(allowedPath, false), "STANDARD_CUSTODY_NATIVE_ALLOWLIST_REFUSED");
        StandardContract.Need(suppliedParent is Handle, "STANDARD_CUSTODY_NATIVE_PARENT_TYPE_REFUSED"); var parent = (Handle)suppliedParent;
        StandardContract.Need(parent.owner == this && parent.Path == StandardFileCustodyRules.Parent(allowedPath), "STANDARD_CUSTODY_NATIVE_PARENT_BINDING_REFUSED");
        bool held = false; IntPtr name = IntPtr.Zero, text = IntPtr.Zero; SafeFileHandle? native = null;
        try {
            parent.Native.DangerousAddRef(ref held); StandardFileCustodyRules.Object(parent.Inspect(), parent.Path, true, clock());
            string leaf = allowedPath[(parent.Path.EndsWith('\\') ? parent.Path.Length : parent.Path.Length + 1)..];
            name = Marshal.StringToHGlobalUni(leaf); var unicode = new UnicodeName { Length = checked((ushort)(leaf.Length * 2)),
                MaximumLength = checked((ushort)((leaf.Length + 1) * 2)), Buffer = name };
            text = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeName>()); Marshal.StructureToPtr(unicode, text, false);
            var attrs = new ObjectAttributes { Length = Marshal.SizeOf<ObjectAttributes>(), Root = parent.Native.DangerousGetHandle(), Name = text, Flags = 0x40 };
            uint access = directory ? StandardFileCustodyRules.SearchDirectory(allowedPath) ? 0x1200a1u : 0x1200a0u : 0x80120080u;
            // Existing objects only. No FILE_DIRECTORY_FILE combination is
            // needed: reject a wrong object type on the returned same handle.
            Gate(); int status = NtCreateFile(out native, access, ref attrs, out var io, IntPtr.Zero, 0, 1, 1,
                0x00200020u | (directory ? 0u : 0x40u), IntPtr.Zero, 0);
            StandardContract.Need(status == 0 && !native.IsInvalid && io.Information.ToUInt64() == 1, "STANDARD_CUSTODY_NATIVE_OPEN_EXISTING_REFUSED");
            var result = Finish(native, allowedPath, directory); native = null; return result;
        } finally { native?.Dispose(); if (text != IntPtr.Zero) Marshal.FreeHGlobal(text); if (name != IntPtr.Zero) Marshal.FreeHGlobal(name);
            if (held) parent.Native.DangerousRelease(); }
    }
    [StructLayout(LayoutKind.Sequential)] private struct Attributes { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
    [StructLayout(LayoutKind.Sequential)] private struct UnicodeName { internal ushort Length, MaximumLength; internal IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)] private struct ObjectAttributes { internal int Length; internal IntPtr Root, Name; internal uint Flags; internal IntPtr Descriptor, Quality; }
    [StructLayout(LayoutKind.Sequential)] private struct IoStatus { internal IntPtr Status; internal UIntPtr Information; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)] private struct Info { internal uint Attributes; internal long Creation, Access, Write; internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [DllImport("ntdll.dll")] private static extern int NtCreateFile(out SafeFileHandle handle, uint access, ref ObjectAttributes attributes, out IoStatus io,
        IntPtr allocation, uint fileAttributes, uint share, uint disposition, uint options, IntPtr ea, uint eaLength);
    [DllImport("ntdll.dll")] private static extern int NtQueryDirectoryFile(IntPtr handle, IntPtr @event, IntPtr apc, IntPtr context,
        out IoStatus io, IntPtr buffer, uint length, uint informationClass, [MarshalAs(UnmanagedType.U1)] bool single,
        IntPtr name, [MarshalAs(UnmanagedType.U1)] bool restart);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, ref Attributes attrs, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll")] private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Info info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityInfo(SafeFileHandle handle, uint type, uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern IntPtr GetCurrentThread();
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenThreadToken(IntPtr thread, uint access,
        [MarshalAs(UnmanagedType.Bool)] bool openAsSelf, out SafeAccessTokenHandle token);
}
#endif
