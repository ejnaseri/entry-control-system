using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardChannelProcessPin(uint ProcessId, long CreationFileTimeUtc,
    string ImagePath, string AssemblyPath, string ImageSha256, string AssemblySha256,
    string RuntimeSha256, string PackageSha256);
internal sealed record StandardChannelKeyPin(StandardCryptoArm Arm, string Name,
    string DescriptorSha256, string PublicSha256, string EnvelopeSha256, string PlaintextSha256);
internal sealed record StandardChannelKeyPair(StandardChannelKeyPin Restricted, StandardChannelKeyPin Accessible);
internal sealed record StandardChannelPredecessor(StandardCryptoStage Stage, string ReportSha256,
    uint ProcessId, long CreationFileTimeUtc);
internal sealed record StandardChannelContext(StandardCryptoScope Scope, string SourceSetSha256,
    StandardCryptoStage Stage, string RunId, string Nonce64, StandardChannelProcessPin Controller,
    StandardChannelProcessPin Worker, StandardChannelPredecessor? Predecessor, StandardChannelKeyPair? Keys);
internal sealed record StandardChannelProcessObservation(StandardProcessToken Process,
    string AssemblyPath, string ImageSha256, string AssemblySha256, string RuntimeSha256, string PackageSha256);

// Trusted native adapters, NOT report fields or worker-declared booleans. A
// capture's hashes alone do not prove loaded code: the custody guard must bind
// the actual admitted startup/loaded assembly/runtime to its held file leases.
internal interface IStandardWorkerChannelTransport
{
    uint LocalProcessId { get; }
    uint PeerProcessId();
    int Read(byte[] buffer, int offset, int count, uint timeoutMilliseconds);
    int Write(byte[] buffer, int offset, int count, uint timeoutMilliseconds);
}
internal interface IStandardChannelProcessLease
{
    uint ProcessId { get; }
    long CreationFileTimeUtc { get; }
    StandardChannelProcessObservation Capture();
    uint Wait(uint milliseconds);
    uint ExitCode();
}
internal interface IStandardChannelClock
{
    DateTimeOffset UtcNow { get; }
    long MonotonicMilliseconds { get; }
}
internal interface IStandardChannelCustodyGuard
{
    // Validate the complete immutable context against actual startup/loaded-code
    // custody, source-set originals and currently admitted scope. During WORK
    // this also revalidates the admitted predecessor/key/envelope bindings.
    void Verify(StandardChannelContext context, string stage);
}
internal interface IStandardChannelReportGuard
{
    // Before any GRANT: independently admit the actual predecessor original,
    // journals and key/envelope pins (or the keyless fresh Setup recipe).
    void VerifyBeforeGrant(StandardChannelContext context);
    // Independently verify predecessor originals, key journals and code/report
    // custody. Canonical parsing below is only shape/binding admission.
    void Verify(StandardChannelContext context, StandardCryptoReport report, string originalSha256);
}
internal interface IStandardChannelOriginalSink
{
    StandardStoreReceipt WriteNew(StandardCryptoStage stage, byte[] originalUtf8);
    byte[] Read(StandardCryptoStage stage);
}
internal sealed class StandardChannelStoreOriginalSink : IStandardChannelOriginalSink
{
    private readonly IStandardDurableRecordSink store;
    internal StandardChannelStoreOriginalSink(IStandardDurableRecordSink store) {
        this.store = store ?? throw new ArgumentNullException(nameof(store));
    }
    public StandardStoreReceipt WriteNew(StandardCryptoStage stage, byte[] bytes) => store.WriteNew(StandardWorkerChannelRules.ReportFile(stage), bytes);
    public byte[] Read(StandardCryptoStage stage) => store.Read(StandardWorkerChannelRules.ReportFile(stage));
}

internal sealed record StandardChannelAck(string Schema, string ContextSha256, string ReportSha256,
    StandardStoreReceipt Receipt);
internal sealed record StandardChannelFailure(string Stage, string Category, int ManagedHResult,
    int? Win32Error, bool GrantMayHaveBeenSent, bool ReportMayHaveBeenSent, bool AckMayHaveBeenSent);
internal sealed record StandardChannelControllerResult(string Outcome, string? ReportSha256,
    StandardStoreReceipt? Receipt, StandardCryptoReport? Report, bool AckWriteCompleted,
    bool HeldExitObserved, uint? ExitCode, StandardChannelFailure? Failure)
{
    public bool NativeExecutionProven => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
    public bool Lic008Closed => false;
}
internal sealed record StandardChannelWorkerResult(string Outcome, string? ReportSha256,
    StandardStoreReceipt? Receipt, bool GrantConsumed, bool WorkEntered, bool AckValidated,
    StandardChannelFailure? Failure)
{
    // The current worker cannot observe its own future process exit.
    public bool HeldExitObserved => false;
    public bool NativeExecutionProven => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
    public bool Lic008Closed => false;
}

internal static class StandardWorkerChannelRules
{
    internal const int MaximumPayload = 65536, Header = 16, BudgetMilliseconds = 30000;
    internal const string AckSchema = "TEST_ONLY_STANDARD_CHANNEL_DURABLE_ACK_V1";
    internal static string StageName(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.Setup => "setup", StandardCryptoStage.GuardianBefore => "guardian-before",
        StandardCryptoStage.StandardUser => "standard-user", StandardCryptoStage.GuardianAfter => "guardian-after",
        _ => throw new InvalidDataException("STANDARD_CHANNEL_STAGE_REFUSED")
    };
    internal static string WorkerSid(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.Setup => StandardCryptoComparison.SystemSid,
        StandardCryptoStage.GuardianBefore or StandardCryptoStage.GuardianAfter => StandardCryptoComparison.GuardianSid,
        StandardCryptoStage.StandardUser => StandardContract.UserSid,
        _ => throw new InvalidDataException("STANDARD_CHANNEL_STAGE_REFUSED")
    };
    internal static string Endpoint(StandardCryptoScope scope, StandardCryptoStage stage) {
        StandardContract.Need(scope is not null && StandardNativeCryptoRules.Hex(scope.Attempt, 32), "STANDARD_CHANNEL_ENDPOINT_REFUSED");
        return @"\\.\pipe\Ecs.Lic008.StandardUserControlV1." + scope.Attempt + "." + StageName(stage);
    }
    internal static StandardStoreFile ReportFile(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.Setup => StandardStoreFile.SetupReport,
        StandardCryptoStage.GuardianBefore => StandardStoreFile.GuardianBeforeReport,
        StandardCryptoStage.StandardUser => StandardStoreFile.StandardUserReport,
        StandardCryptoStage.GuardianAfter => StandardStoreFile.GuardianAfterReport,
        _ => throw new InvalidDataException("STANDARD_CHANNEL_STAGE_REFUSED")
    };
    private static bool Hash(string? value) => StandardNativeCryptoRules.Hex(value, 64);
    private static void Groups(StandardToken token, bool owner, string? ownService)
    {
        StandardContract.Need(token.Groups is not null && token.Groups.Count >= (owner ? 2 : 1) && token.Groups.Count <= 1024,
            "STANDARD_CHANNEL_GROUPS_INCOMPLETE");
        var seen = new HashSet<string>(StringComparer.Ordinal); bool required = false, own = ownService is null;
        foreach (var group in token.Groups) {
            StandardContract.Need(group is not null && StandardIdentity.CanonicalSid(group.Sid) && seen.Add(group.Sid), "STANDARD_CHANNEL_GROUP_REFUSED");
            if (!owner) StandardContract.Need(group.Sid is not (StandardContract.Interactive or "S-1-5-2" or "S-1-5-3"), "STANDARD_CHANNEL_SERVICE_LOGON_REFUSED");
            if (group.Sid == (owner ? StandardContract.Interactive : StandardCryptoComparison.ServiceLogonSid)) {
                StandardContract.Need((group.Attributes & 4) != 0 && (group.Attributes & 16) == 0, "STANDARD_CHANNEL_GROUP_DISABLED"); required = true;
            }
            if (group.Sid == (owner ? StandardContract.Administrators : ownService)) {
                StandardContract.Need((group.Attributes & 4) != 0 && (group.Attributes & 16) == 0, "STANDARD_CHANNEL_OWN_GROUP_DISABLED"); own = true;
            }
        }
        StandardContract.Need(required && own, "STANDARD_CHANNEL_REQUIRED_GROUP_MISSING");
    }
    internal static void OwnerToken(StandardToken? token)
    {
        StandardContract.Need(token is not null && token.QueryComplete && token.User == StandardContract.OwnerSid &&
            token.Owner is StandardContract.OwnerSid or StandardContract.Administrators && token.Type == 1 && token.Elevation == 1 && token.ElevationType == 2 &&
            token.IntegritySid == "S-1-16-12288" && !token.HasRestrictions && !token.AppContainer, "STANDARD_CHANNEL_OWNER_REFUSED");
        Groups(token, true, StandardContract.Administrators);
    }
    internal static void WorkerToken(StandardCryptoStage stage, StandardToken? token)
    {
        _ = StageName(stage);
        if (stage == StandardCryptoStage.StandardUser) { StandardIdentity.Admit(token); return; }
        if (stage == StandardCryptoStage.Setup) { StandardKeyCreationRules.SetupToken(token); return; }
        StandardContract.Need(token is not null && token.QueryComplete && token.User == StandardCryptoComparison.GuardianSid &&
            token.Owner == StandardCryptoComparison.GuardianSid && token.Type == 1 && token.Elevation == 1 && token.ElevationType == 1 &&
            token.IntegritySid == StandardCryptoComparison.SystemIntegritySid && !token.HasRestrictions && !token.AppContainer,
            "STANDARD_CHANNEL_GUARDIAN_REFUSED");
        // A virtual account's own SID need not appear again among its groups.
        Groups(token, false, null);
        foreach (var group in token.Groups!) if (group.Sid == StandardCryptoComparison.GuardianSid)
            StandardContract.Need((group.Attributes & 4) != 0 && (group.Attributes & 16) == 0, "STANDARD_CHANNEL_GUARDIAN_GROUP_DISABLED");
    }
    private static void Pin(StandardChannelProcessPin? pin, StandardCryptoScope scope, bool worker, DateTimeOffset now)
    {
        StandardContract.Need(pin is not null && pin.ProcessId > 0 && pin.CreationFileTimeUtc > 0 &&
            pin.ImagePath == StandardLaunchPlan.Image && pin.AssemblyPath is { Length: > 0 and <= 1024 } &&
            !pin.AssemblyPath.Contains('\0') && Path.IsPathFullyQualified(pin.AssemblyPath) &&
            Path.GetFullPath(pin.AssemblyPath) == pin.AssemblyPath && (!worker || pin.AssemblyPath == StandardLaunchPlan.Assembly) &&
            pin.ImageSha256 == scope.ImageSha256 && pin.AssemblySha256 == scope.AssemblySha256 &&
            pin.RuntimeSha256 == scope.RuntimeSha256 && pin.PackageSha256 == scope.PackageSha256,
            "STANDARD_CHANNEL_PROCESS_PIN_REFUSED");
        DateTimeOffset created;
        try { created = new(DateTime.FromFileTimeUtc(pin.CreationFileTimeUtc)); }
        catch (ArgumentOutOfRangeException) { throw new InvalidDataException("STANDARD_CHANNEL_PROCESS_TIME_REFUSED"); }
        StandardContract.Need(created >= scope.IssuedUtc && created <= now, "STANDARD_CHANNEL_PROCESS_TIME_REFUSED");
    }
    private static void Key(StandardChannelContext c, StandardChannelKeyPin? key, StandardCryptoArm arm)
    {
        StandardContract.Need(key is not null && key.Arm == arm && key.Name == StandardCryptoComparison.KeyName(c.Scope.Attempt, arm) &&
            Hash(key.DescriptorSha256) && Hash(key.PublicSha256) && Hash(key.EnvelopeSha256) &&
            key.PlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash, "STANDARD_CHANNEL_KEY_PIN_REFUSED");
    }
    internal static void ValidateContext(StandardChannelContext? c, DateTimeOffset utcNow)
    {
        StandardContract.Need(c is not null, "STANDARD_CHANNEL_CONTEXT_MISSING");
        StandardStoreRules.Scope(c.Scope, utcNow); _ = StageName(c.Stage);
        StandardContract.Need(Hash(c.SourceSetSha256) && StandardNativeCryptoRules.Hex(c.RunId, 32) && Hash(c.Nonce64),
            "STANDARD_CHANNEL_CONTEXT_BINDING_REFUSED");
        Pin(c.Controller, c.Scope, false, utcNow); Pin(c.Worker, c.Scope, true, utcNow);
        StandardContract.Need(c.Controller.ProcessId != c.Worker.ProcessId, "STANDARD_CHANNEL_PEERS_NOT_DISTINCT");
        if (c.Stage == StandardCryptoStage.Setup) {
            StandardContract.Need(c.Predecessor is null && c.Keys is null, "STANDARD_CHANNEL_SETUP_UNKNOWN_KEYS_REQUIRED"); return;
        }
        var p = c.Predecessor;
        StandardCryptoStage previous = c.Stage switch { StandardCryptoStage.GuardianBefore => StandardCryptoStage.Setup,
            StandardCryptoStage.StandardUser => StandardCryptoStage.GuardianBefore, _ => StandardCryptoStage.StandardUser };
        StandardContract.Need(p is not null && p.Stage == previous && Hash(p.ReportSha256) && p.ProcessId > 0 &&
            p.ProcessId != c.Worker.ProcessId && p.ProcessId != c.Controller.ProcessId && p.CreationFileTimeUtc > 0 &&
            p.CreationFileTimeUtc >= c.Scope.IssuedUtc.UtcDateTime.ToFileTimeUtc() &&
            p.CreationFileTimeUtc < c.Worker.CreationFileTimeUtc && c.Keys is not null, "STANDARD_CHANNEL_PREDECESSOR_REFUSED");
        Key(c, c.Keys.Restricted, StandardCryptoArm.Restricted); Key(c, c.Keys.Accessible, StandardCryptoArm.UserAccessible);
        StandardContract.Need(c.Keys.Restricted.PublicSha256 != c.Keys.Accessible.PublicSha256 &&
            c.Keys.Restricted.DescriptorSha256 != c.Keys.Accessible.DescriptorSha256 &&
            c.Keys.Restricted.EnvelopeSha256 != c.Keys.Accessible.EnvelopeSha256, "STANDARD_CHANNEL_KEYS_NOT_DISTINCT");
    }
    internal static void Observation(StandardChannelContext c, StandardChannelProcessPin pin,
        StandardChannelProcessObservation? observed, bool owner)
    {
        StandardContract.Need(observed is not null && observed.Process is not null && observed.Process.ProcessId == pin.ProcessId &&
            observed.Process.CreationFileTimeUtc == pin.CreationFileTimeUtc && observed.Process.ImagePath == pin.ImagePath &&
            observed.AssemblyPath == pin.AssemblyPath && observed.ImageSha256 == pin.ImageSha256 &&
            observed.AssemblySha256 == pin.AssemblySha256 && observed.RuntimeSha256 == pin.RuntimeSha256 &&
            observed.PackageSha256 == pin.PackageSha256, "STANDARD_CHANNEL_PEER_OBSERVATION_REFUSED");
        if (owner) OwnerToken(observed.Process.Token); else WorkerToken(c.Stage, observed.Process.Token);
    }
    internal static StandardChannelProcessObservation Snapshot(StandardChannelProcessObservation? observed)
    {
        StandardContract.Need(observed is not null && observed.Process is not null && observed.Process.Token is not null,
            "STANDARD_CHANNEL_OBSERVATION_MISSING");
        var token = observed.Process.Token;
        StandardContract.Need(token.Groups is null || token.Groups.Count <= 1024, "STANDARD_CHANNEL_GROUPS_INCOMPLETE");
        return observed with { Process = observed.Process with { Token = token with {
            Groups = token.Groups is null ? null : Array.AsReadOnly(token.Groups.ToArray()) } } };
    }
    internal static StandardCryptoReport FreezeReport(StandardCryptoReport report)
    {
        StandardCryptoKey? Freeze(StandardCryptoKey? key) => key is null ? null : key with {
            Aces = key.Aces is null ? null : Array.AsReadOnly(key.Aces.ToArray()) };
        return report with { RestrictedKey = Freeze(report.RestrictedKey), AccessibleKey = Freeze(report.AccessibleKey) };
    }
    internal static void Report(StandardChannelContext c, StandardCryptoReport? r, DateTimeOffset now)
    {
        StandardContract.Need(r is not null && r.Scope == c.Scope && r.Stage == c.Stage && r.RunId == c.RunId &&
            r.ProcessId == c.Worker.ProcessId && r.CreationFileTimeUtc == c.Worker.CreationFileTimeUtc &&
            r.StartedUtc.Offset == TimeSpan.Zero && r.CompletedUtc.Offset == TimeSpan.Zero &&
            r.StartedUtc >= c.Scope.IssuedUtc && r.StartedUtc.UtcDateTime.ToFileTimeUtc() >= c.Worker.CreationFileTimeUtc &&
            r.CompletedUtc > r.StartedUtc && r.CompletedUtc < c.Scope.ExpiresUtc && r.CompletedUtc <= now,
            "STANDARD_CHANNEL_REPORT_BINDING_REFUSED");
        if (c.Stage == StandardCryptoStage.Setup) {
            StandardContract.Need(StandardCryptoComparison.KeyValid(c.Scope, r.RestrictedKey, StandardCryptoArm.Restricted) &&
                StandardCryptoComparison.KeyValid(c.Scope, r.AccessibleKey, StandardCryptoArm.UserAccessible) &&
                r.RestrictedKey!.PublicSha256 != r.AccessibleKey!.PublicSha256 &&
                r.RestrictedKey.DescriptorSha256 != r.AccessibleKey.DescriptorSha256 &&
                r.RestrictedKey.Envelope!.EnvelopeSha256 != r.AccessibleKey.Envelope!.EnvelopeSha256 &&
                r.RestrictedKey.Envelope.SyntheticPlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash &&
                r.AccessibleKey.Envelope.SyntheticPlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash &&
                r.RestrictedOperation is null && r.AccessibleOperation is null, "STANDARD_CHANNEL_SETUP_REPORT_PROFILE_REFUSED");
            return;
        }
        // An OPEN/INSPECT failure supplies no fabricated inspection. The full
        // comparison later determines inconclusive/unclassified observations.
        foreach (var (arm, key, operation, pin) in new[] {
            (StandardCryptoArm.Restricted, r.RestrictedKey, r.RestrictedOperation, c.Keys!.Restricted),
            (StandardCryptoArm.UserAccessible, r.AccessibleKey, r.AccessibleOperation, c.Keys!.Accessible) }) {
            StandardContract.Need(operation is not null && operation.Arm == arm && operation.RequestedKeyName == pin.Name &&
                operation.RequestedPublicSha256 == pin.PublicSha256 && operation.RequestedEnvelopeSha256 == pin.EnvelopeSha256 &&
                operation.ObservedUtc.Offset == TimeSpan.Zero && operation.ObservedUtc > r.StartedUtc && operation.ObservedUtc < r.CompletedUtc,
                "STANDARD_CHANNEL_OPERATION_BINDING_REFUSED");
            if (key is not null) StandardContract.Need(StandardCryptoComparison.KeyValid(c.Scope, key, arm) &&
                key.PublicSha256 == pin.PublicSha256 && key.DescriptorSha256 == pin.DescriptorSha256 &&
                key.Envelope!.EnvelopeSha256 == pin.EnvelopeSha256 && key.Envelope.SyntheticPlaintextSha256 == pin.PlaintextSha256,
                "STANDARD_CHANNEL_REOPENED_KEY_REFUSED");
            StandardContract.Need(operation.OperationStage == "DECRYPT" ? key is not null : key is null,
                "STANDARD_CHANNEL_OPERATION_INSPECTION_REFUSED");
            bool noError = operation.FailureCategory is null && operation.ManagedHResult is null && operation.NativeStatus is null;
            bool shape = operation.Status switch {
                "DECRYPTED" => operation.OperationStage == "DECRYPT" && operation.KeyOpened && noError && Hash(operation.ObservedPlaintextSha256),
                "OPENED_WITHOUT_DECRYPT" => operation.OperationStage == "OPEN" && operation.KeyOpened && noError && operation.ObservedPlaintextSha256 is null,
                "FAILED" => operation.OperationStage is "OPEN" or "INSPECT" or "DECRYPT" &&
                    operation.KeyOpened == (operation.OperationStage != "OPEN") &&
                    operation.FailureCategory is "CRYPTOGRAPHIC" or "UNAUTHORIZED_ACCESS" && operation.ManagedHResult is not null && operation.ObservedPlaintextSha256 is null,
                "NOT_RUN" => operation.OperationStage == "NONE" && !operation.KeyOpened && noError && operation.ObservedPlaintextSha256 is null,
                _ => false
            };
            StandardContract.Need(shape, "STANDARD_CHANNEL_OPERATION_SHAPE_REFUSED");
        }
    }
    internal static StandardStoreReceipt Receipt(StandardChannelContext c, StandardStoreReceipt? receipt,
        byte[] original, DateTimeOffset now)
    {
        ValidateContext(c, now);
        var report = StandardWorkerChannelCodec.Parse<StandardCryptoReport>(original);
        StandardContract.Need(receipt is not null && receipt.Scope == c.Scope && receipt.File == ReportFile(c.Stage) &&
            receipt.Sha256 == StandardNativeCryptoRules.Hash(original) && receipt.Length == original.Length &&
            receipt.WrittenUtc.Offset == TimeSpan.Zero && receipt.WrittenUtc >= report.CompletedUtc && receipt.WrittenUtc <= now &&
            receipt.WrittenUtc < c.Scope.ExpiresUtc && receipt.VolumeSerial != 0 && receipt.FileIndex != 0 &&
            receipt.CreationFileTimeUtc >= report.CompletedUtc.UtcDateTime.ToFileTimeUtc() &&
            receipt.CreationFileTimeUtc <= receipt.WrittenUtc.UtcDateTime.ToFileTimeUtc() && receipt.CreateNew && receipt.Protected &&
            receipt.DurablyFlushed && receipt.ExactReadback, "STANDARD_CHANNEL_DURABLE_RECEIPT_REFUSED");
        return receipt;
    }
}

internal static class StandardWorkerChannelCodec
{
    internal enum Kind : byte { Grant = 1, Report = 2, Ack = 3 }
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("ECW03CH1");
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 16 };
    internal static byte[] Canonical<T>(T value) {
        byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        StandardContract.Need(bytes.Length is >= 2 and <= StandardWorkerChannelRules.MaximumPayload, "STANDARD_CHANNEL_PAYLOAD_LENGTH_REFUSED"); return bytes;
    }
    private static void Unique(JsonElement value) {
        if (value.ValueKind == JsonValueKind.Object) {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var p in value.EnumerateObject()) { StandardContract.Need(seen.Add(p.Name), "STANDARD_CHANNEL_DUPLICATE_PROPERTY"); Unique(p.Value); }
        } else if (value.ValueKind == JsonValueKind.Array) foreach (var child in value.EnumerateArray()) Unique(child);
    }
    internal static T Parse<T>(byte[]? supplied) where T : class
    {
        StandardContract.Need(supplied is { Length: >= 2 and <= StandardWorkerChannelRules.MaximumPayload }, "STANDARD_CHANNEL_PAYLOAD_LENGTH_REFUSED");
        byte[] bytes = (byte[])supplied.Clone();
        try {
            _ = Utf8.GetString(bytes);
            StandardContract.Need(!(bytes.Length >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf), "STANDARD_CHANNEL_BOM_REFUSED");
            using var doc = JsonDocument.Parse(bytes, new() { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow, MaxDepth = 16 });
            StandardContract.Need(doc.RootElement.ValueKind == JsonValueKind.Object, "STANDARD_CHANNEL_JSON_OBJECT_REQUIRED"); Unique(doc.RootElement);
            var parsed = JsonSerializer.Deserialize<T>(bytes, Json);
            StandardContract.Need(parsed is not null && bytes.AsSpan().SequenceEqual(Canonical(parsed)), "STANDARD_CHANNEL_NONCANONICAL_REFUSED"); return parsed;
        } catch (JsonException) { throw new InvalidDataException("STANDARD_CHANNEL_JSON_REFUSED"); }
        catch (DecoderFallbackException) { throw new InvalidDataException("STANDARD_CHANNEL_UTF8_REFUSED"); }
    }
    internal static byte[] Frame(Kind kind, byte[] payload)
    {
        StandardContract.Need(Enum.IsDefined(kind) && payload is { Length: >= 2 and <= StandardWorkerChannelRules.MaximumPayload }, "STANDARD_CHANNEL_FRAME_REFUSED");
        byte[] frame = new byte[StandardWorkerChannelRules.Header + payload.Length]; Magic.CopyTo(frame, 0);
        BinaryPrimitives.WriteUInt16BigEndian(frame.AsSpan(8), 1); frame[10] = (byte)kind;
        BinaryPrimitives.WriteUInt32BigEndian(frame.AsSpan(12), (uint)payload.Length); payload.CopyTo(frame, StandardWorkerChannelRules.Header); return frame;
    }
    internal static int PayloadLength(byte[] header, Kind expected)
    {
        StandardContract.Need(header is { Length: StandardWorkerChannelRules.Header } && header.AsSpan(0, 8).SequenceEqual(Magic) &&
            BinaryPrimitives.ReadUInt16BigEndian(header.AsSpan(8)) == 1 && header[10] == (byte)expected && header[11] == 0,
            "STANDARD_CHANNEL_FRAME_HEADER_REFUSED");
        uint length = BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(12));
        StandardContract.Need(length is >= 2 and <= StandardWorkerChannelRules.MaximumPayload, "STANDARD_CHANNEL_FRAME_LENGTH_REFUSED"); return (int)length;
    }
    internal static int WriteChunkLength(int remaining) {
        StandardContract.Need(remaining is > 0 and <= StandardWorkerChannelRules.MaximumPayload + StandardWorkerChannelRules.Header,
            "STANDARD_CHANNEL_WRITE_CHUNK_REFUSED");
        return Math.Min(remaining, StandardWorkerChannelRules.MaximumPayload);
    }
}

// Both endpoints consume this process-local gate; a future controller also
// needs a protected durable stage-consumed original before invoking a session.
// No serialized PID or worker assertion can replace the original held leases.
internal sealed class StandardWorkerChannel
{
    private static readonly object RegistryGate = new();
    private static readonly HashSet<string> Consumed = new(StringComparer.Ordinal);
    private readonly StandardChannelContext context;
    private readonly byte[] contextBytes;
    private readonly string contextHash;
    private readonly bool owner;
    private readonly IStandardWorkerChannelTransport transport;
    private readonly IStandardChannelProcessLease controller, worker;
    private readonly IStandardChannelClock clock;
    private readonly IStandardChannelCustodyGuard custody;
    private long start, lastMonotonic;
    private DateTimeOffset? lastUtc;
    private int started;
    private bool grantMaySent, reportMaySent, ackMaySent;
    private string stage = "ADMISSION";
    internal StandardWorkerChannel(StandardChannelContext context, bool owner,
        IStandardWorkerChannelTransport transport, IStandardChannelProcessLease controller,
        IStandardChannelProcessLease worker, IStandardChannelClock clock, IStandardChannelCustodyGuard custody)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context)); this.owner = owner;
        this.transport = transport ?? throw new ArgumentNullException(nameof(transport));
        this.controller = controller ?? throw new ArgumentNullException(nameof(controller)); this.worker = worker ?? throw new ArgumentNullException(nameof(worker));
        this.clock = clock ?? throw new ArgumentNullException(nameof(clock)); this.custody = custody ?? throw new ArgumentNullException(nameof(custody));
        contextBytes = StandardWorkerChannelCodec.Canonical(context); contextHash = StandardNativeCryptoRules.Hash(contextBytes);
    }
    private void Begin(bool mustBeOwner)
    {
        StandardContract.Need(Interlocked.Exchange(ref started, 1) == 0, "STANDARD_CHANNEL_INSTANCE_CONSUMED");
        StandardContract.Need(owner == mustBeOwner, "STANDARD_CHANNEL_ENDPOINT_ROLE_REFUSED");
        start = clock.MonotonicMilliseconds; lastMonotonic = start;
        StandardContract.Need(start >= 0, "STANDARD_CHANNEL_MONOTONIC_START_REFUSED");
        StandardWorkerChannelRules.ValidateContext(context, UtcNow());
        string reservation = context.Scope.Attempt + ":" + context.RunId + ":" + (owner ? "owner" : "worker");
        lock (RegistryGate) StandardContract.Need(Consumed.Add(reservation), "STANDARD_CHANNEL_RUN_ALREADY_CONSUMED");
        FullGate(); FullGate();
    }
    private uint Remaining()
    {
        long now = clock.MonotonicMilliseconds;
        StandardContract.Need(now >= start && now >= lastMonotonic && now - start < StandardWorkerChannelRules.BudgetMilliseconds,
            "STANDARD_CHANNEL_MONOTONIC_DEADLINE_REFUSED");
        lastMonotonic = now; return (uint)(StandardWorkerChannelRules.BudgetMilliseconds - (now - start));
    }
    private DateTimeOffset UtcNow()
    {
        DateTimeOffset now = clock.UtcNow;
        StandardContract.Need(now.Offset == TimeSpan.Zero && (lastUtc is null || now >= lastUtc), "STANDARD_CHANNEL_UTC_ROLLBACK_REFUSED");
        lastUtc = now; return now;
    }
    private void ScopeGate()
    {
        _ = Remaining(); StandardWorkerChannelRules.ValidateContext(context, UtcNow());
        try { custody.Verify(context, stage); }
        catch { throw new InvalidDataException("STANDARD_CHANNEL_CUSTODY_REFUSED"); }
        StandardWorkerChannelRules.ValidateContext(context, UtcNow()); _ = Remaining();
        StandardContract.Need(controller.ProcessId == context.Controller.ProcessId && controller.CreationFileTimeUtc == context.Controller.CreationFileTimeUtc &&
            worker.ProcessId == context.Worker.ProcessId && worker.CreationFileTimeUtc == context.Worker.CreationFileTimeUtc,
            "STANDARD_CHANNEL_HELD_LEASE_CHANGED");
    }
    private void FullGate()
    {
        ScopeGate();
        StandardContract.Need(transport.LocalProcessId == (owner ? context.Controller.ProcessId : context.Worker.ProcessId) &&
            transport.PeerProcessId() == (owner ? context.Worker.ProcessId : context.Controller.ProcessId), "STANDARD_CHANNEL_OS_PIPE_PEER_REFUSED");
        StandardWorkerChannelRules.Observation(context, context.Controller, StandardWorkerChannelRules.Snapshot(controller.Capture()), true);
        StandardWorkerChannelRules.Observation(context, context.Worker, StandardWorkerChannelRules.Snapshot(worker.Capture()), false);
        StandardContract.Need(controller.Wait(0) == 258 && worker.Wait(0) == 258, "STANDARD_CHANNEL_PEER_NOT_LIVE");
        ScopeGate();
    }
    private byte[] Read(StandardWorkerChannelCodec.Kind kind)
    {
        byte[] header = new byte[StandardWorkerChannelRules.Header]; ReadExact(header);
        byte[] payload = new byte[StandardWorkerChannelCodec.PayloadLength(header, kind)]; ReadExact(payload); return payload;
    }
    private void ReadExact(byte[] bytes)
    {
        for (int at = 0; at < bytes.Length;) {
            FullGate(); int read = transport.Read(bytes, at, bytes.Length - at, Remaining());
            StandardContract.Need(read > 0 && read <= bytes.Length - at, "STANDARD_CHANNEL_PARTIAL_READ_CLOSED_OR_INVALID"); at += read; FullGate();
        }
    }
    private void Write(StandardWorkerChannelCodec.Kind kind, byte[] payload)
    {
        byte[] bytes = StandardWorkerChannelCodec.Frame(kind, payload);
        for (int at = 0; at < bytes.Length;) {
            FullGate(); int requested = StandardWorkerChannelCodec.WriteChunkLength(bytes.Length - at);
            int written = transport.Write(bytes, at, requested, Remaining());
            StandardContract.Need(written > 0 && written <= requested, "STANDARD_CHANNEL_PARTIAL_WRITE_CLOSED_OR_INVALID"); at += written;
            // A worker may consume the final ACK byte and exit immediately.
            // Do not require a live token/pipe after that successful write;
            // the controller must now use the original process handle's wait.
            if (owner && kind == StandardWorkerChannelCodec.Kind.Ack && at == bytes.Length) ScopeGate(); else FullGate();
        }
    }
    private StandardChannelFailure Failure(Exception error) => new(stage,
        error switch { InvalidDataException => "VALIDATION", UnauthorizedAccessException => "UNAUTHORIZED_ACCESS",
            Win32Exception => "WIN32", IOException => "IO", _ => "UNKNOWN" }, error.HResult,
        error is Win32Exception native ? native.NativeErrorCode : null, grantMaySent, reportMaySent, ackMaySent);
    private void Original(IStandardChannelOriginalSink sink, byte[] raw, string hash)
    {
        ScopeGate(); byte[] read = sink.Read(context.Stage);
        StandardContract.Need(read is not null && read.Length == raw.Length && read.AsSpan().SequenceEqual(raw) &&
            StandardNativeCryptoRules.Hash(read) == hash, "STANDARD_CHANNEL_ORIGINAL_CHANGED"); ScopeGate();
    }
    internal StandardChannelControllerResult RunController(IStandardChannelOriginalSink sink,
        IStandardChannelReportGuard reportGuard, IStandardChannelProcessLease? predecessor)
    {
        string? hash = null; StandardStoreReceipt? receipt = null; StandardCryptoReport? report = null;
        bool ackWritten = false, exitObserved = false; uint? code = null;
        try {
            ArgumentNullException.ThrowIfNull(sink); ArgumentNullException.ThrowIfNull(reportGuard); Begin(true);
            stage = "PREDECESSOR_ADMISSION";
            if (context.Predecessor is { } expected) {
                StandardContract.Need(predecessor is not null && predecessor.ProcessId == expected.ProcessId &&
                    predecessor.CreationFileTimeUtc == expected.CreationFileTimeUtc && predecessor.Wait(0) == 0 && predecessor.ExitCode() == 0,
                    "STANDARD_CHANNEL_PREDECESSOR_EXIT_NOT_HELD");
            } else StandardContract.Need(predecessor is null, "STANDARD_CHANNEL_SETUP_PREDECESSOR_REFUSED");
            FullGate(); stage = "PRE_GRANT_EVIDENCE"; reportGuard.VerifyBeforeGrant(context); FullGate();
            stage = "GRANT_WRITE"; grantMaySent = true; Write(StandardWorkerChannelCodec.Kind.Grant, contextBytes);
            stage = "REPORT_READ"; byte[] raw = Read(StandardWorkerChannelCodec.Kind.Report);
            report = StandardWorkerChannelRules.FreezeReport(StandardWorkerChannelCodec.Parse<StandardCryptoReport>(raw)); StandardWorkerChannelRules.Report(context, report, UtcNow());
            hash = StandardNativeCryptoRules.Hash(raw); FullGate(); reportGuard.Verify(context, report, hash); FullGate();
            stage = "REPORT_DURABLE";
            receipt = sink.WriteNew(context.Stage, (byte[])raw.Clone()); ScopeGate();
            receipt = StandardWorkerChannelRules.Receipt(context, receipt, raw, UtcNow()); Original(sink, raw, hash);
            stage = "ACK_WRITE";
            var ack = new StandardChannelAck(StandardWorkerChannelRules.AckSchema, contextHash, hash, receipt);
            ackMaySent = true; Write(StandardWorkerChannelCodec.Kind.Ack, StandardWorkerChannelCodec.Canonical(ack)); ackWritten = true;
            stage = "HELD_EXIT_WAIT";
            while (true) {
                ScopeGate(); uint observed = worker.Wait(Math.Min(1000u, Remaining()));
                if (observed == 258) continue;
                StandardContract.Need(observed == 0, "STANDARD_CHANNEL_HELD_WAIT_REFUSED");
                exitObserved = true; code = worker.ExitCode();
                StandardContract.Need(code == 0, "STANDARD_CHANNEL_WORKER_EXIT_FAILED"); break;
            }
            // A report/ACK cannot prove exit; a stopped PID cannot substitute
            // for the wait above. After exit the pipe may legitimately be broken.
            // Require EOF, refusing any buffered second/report/trailing frame.
            ScopeGate(); byte[] tail = new byte[1]; int remaining = transport.Read(tail, 0, 1, Remaining());
            StandardContract.Need(remaining == 0, "STANDARD_CHANNEL_TRAILING_FRAME_REFUSED");
            Original(sink, raw, hash); reportGuard.Verify(context, report, hash); ScopeGate(); stage = "COMPLETE";
            return new("REPORT_ACK_AND_HELD_EXIT_OBSERVED", hash, receipt, report, ackWritten, exitObserved, code, null);
        } catch (Exception error) { return new("RETAINED_PARTIAL_OR_UNKNOWN", hash, receipt, report, ackWritten, exitObserved, code, Failure(error)); }
    }
    internal StandardChannelWorkerResult RunWorker(Func<StandardChannelContext, Action, StandardCryptoReport> work)
    {
        bool granted = false, entered = false, ackValidated = false; string? hash = null; StandardStoreReceipt? receipt = null;
        try {
            ArgumentNullException.ThrowIfNull(work); Begin(false); stage = "GRANT_READ";
            byte[] grant = Read(StandardWorkerChannelCodec.Kind.Grant);
            var parsed = StandardWorkerChannelCodec.Parse<StandardChannelContext>(grant);
            StandardContract.Need(grant.AsSpan().SequenceEqual(contextBytes) && parsed == context, "STANDARD_CHANNEL_GRANT_CONTEXT_CHANGED");
            FullGate(); stage = "GRANT_CONSUMED"; granted = true;
            // The actual backend must invoke this grant-bound gate immediately
            // before each native key operation. It cannot be retained for later
            // or used to authorize a background operation after this call ends.
            stage = "WORK"; entered = true; int operationActive = 1, operationThread = Environment.CurrentManagedThreadId;
            void OperationGate() {
                StandardContract.Need(Volatile.Read(ref operationActive) == 1 && Environment.CurrentManagedThreadId == operationThread,
                    "STANDARD_CHANNEL_OPERATION_OUTSIDE_GRANT"); FullGate();
            }
            StandardCryptoReport result;
            try { result = work(context, OperationGate); }
            finally { Volatile.Write(ref operationActive, 0); }
            FullGate();
            StandardWorkerChannelRules.Report(context, result, UtcNow()); byte[] raw = StandardWorkerChannelCodec.Canonical(result);
            // Reparse the private snapshot before exposing any bytes to a sink.
            var snapshot = StandardWorkerChannelCodec.Parse<StandardCryptoReport>(raw); StandardWorkerChannelRules.Report(context, snapshot, UtcNow());
            hash = StandardNativeCryptoRules.Hash(raw); stage = "REPORT_WRITE"; reportMaySent = true; Write(StandardWorkerChannelCodec.Kind.Report, raw);
            stage = "ACK_READ"; var ack = StandardWorkerChannelCodec.Parse<StandardChannelAck>(Read(StandardWorkerChannelCodec.Kind.Ack));
            StandardContract.Need(ack.Schema == StandardWorkerChannelRules.AckSchema && ack.ContextSha256 == contextHash && ack.ReportSha256 == hash,
                "STANDARD_CHANNEL_ACK_BINDING_REFUSED");
            receipt = StandardWorkerChannelRules.Receipt(context, ack.Receipt, raw, UtcNow()); FullGate(); ackValidated = true;
            stage = "COMPLETE"; return new("DURABLE_ACK_VALIDATED_EXIT_NOT_OBSERVED", hash, receipt, granted, entered, ackValidated, null);
        } catch (Exception error) { return new("RETAINED_PARTIAL_OR_UNKNOWN", hash, receipt, granted, entered, ackValidated, Failure(error)); }
    }
}
