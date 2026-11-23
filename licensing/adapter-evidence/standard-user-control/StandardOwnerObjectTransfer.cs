using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;

namespace EntryControl.TestOnly.StandardUserControl;

internal enum StandardOwnerTransferFile { Intent, StageSeed, Complete }
internal enum StandardOwnerTransferObjectKind { OwnerProcess, OwnerPrimaryToken, WorkerProcess,
    RemoteOwnerProcess, RemoteOwnerToken, ReturnedOwnerProcess, ReturnedOwnerToken, CurrentOwnerPrimaryToken }
internal enum StandardOwnerTransferDuplicateKind { OwnerProcessToWorker, OwnerTokenToWorker, OwnerProcessBack, OwnerTokenBack }
internal enum StandardOwnerTransferCompareKind { ReturnedProcess, ReturnedToken, CurrentPrimaryToken }
internal sealed record StandardOwnerTransferContext(int SchemaVersion, string Purpose, string Effects,
    StandardChannelContext Channel);
internal sealed record StandardOwnerTransferCapture(StandardChannelProcessObservation Owner,
    StandardPeerTokenStatistics OwnerBefore, StandardPeerTokenStatistics OwnerAfter,
    StandardChannelProcessObservation Worker, StandardPeerTokenStatistics WorkerBefore,
    StandardPeerTokenStatistics WorkerAfter, uint OwnerWait, uint WorkerWait);
internal sealed record StandardOwnerTransferCurrentPrimary(StandardChannelProcessObservation Owner,
    StandardPeerTokenStatistics Before, StandardPeerTokenStatistics After, uint OwnerWait);
internal sealed record StandardOwnerTransferHandleObservation(string TypeName, long Value,
    uint GrantedAccess, uint Flags);
internal sealed record StandardOwnerTransferLocalHandles(long OwnerProcess, long OwnerPrimaryToken, long WorkerProcess);
internal sealed record StandardOwnerTransferSeed(string ContextSha256, string IntentSha256,
    long RemoteOwnerProcess, long RemoteOwnerPrimaryToken, StandardPeerTokenStatistics ExpectedOwnerStatistics);
internal sealed record StandardOwnerTransferAck(string Schema, string ContextSha256,
    StandardCryptoStage Stage, string RunId, string Nonce64, uint WorkerProcessId,
    long WorkerCreationFileTimeUtc, long RemoteOwnerProcess, long RemoteOwnerPrimaryToken,
    string IntentSha256, string SeedSha256);
internal sealed record StandardOwnerTransferAckRead(uint ActualPeerProcessId, byte[] OriginalUtf8);
internal sealed record StandardOwnerTransferJournal(string Schema, StandardOwnerTransferContext Context,
    string ContextSha256, StandardOwnerTransferFile File, DateTimeOffset WrittenUtc, string? PreviousSha256,
    StandardOwnerTransferCapture? Originals, StandardOwnerTransferLocalHandles? SourceHandles,
    StandardOwnerTransferSeed? Seed, string? BootstrapAckOriginalBase64, string? BootstrapAckSha256,
    StandardPeerObjectObservation? ReturnedOwnerObjects, StandardOwnerTransferCurrentPrimary? CurrentPrimary);
internal sealed record StandardOwnerTransferReceipt(StandardOwnerTransferContext Context,
    string ContextSha256, StandardOwnerTransferFile File, string Sha256, int Length, DateTimeOffset WrittenUtc,
    uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc, bool CreateNew, bool Protected,
    bool OwnerOnlyWriter, bool WorkerReadable, bool DurablyFlushed, bool ExactReadback);
internal sealed record StandardOwnerTransferOriginal(StandardOwnerTransferJournal Record,
    string Sha256, StandardOwnerTransferReceipt Receipt);
internal sealed record StandardOwnerTransferSlotState(StandardOwnerTransferObjectKind Kind,
    uint HandleTableProcessId, long HandleTableCreationFileTimeUtc, long Value);
internal sealed record StandardOwnerTransferFailure(string Stage, string Category, int ManagedHResult,
    int? Win32Error, bool OriginalCaptureEntered, bool DuplicateCallEntered, bool SeedWriteEntered,
    bool BootstrapReadEntered, bool CompareCallEntered, bool CurrentPrimaryOpenEntered, bool DurableWriteEntered);
internal sealed record StandardOwnerTransferResult(string Outcome, string ContextSha256,
    IReadOnlyList<StandardOwnerTransferOriginal> Originals, IReadOnlyList<StandardOwnerTransferSlotState> Slots,
    StandardOwnerTransferFailure? Failure)
{
    // This entire component is an injected MODEL. Canonical claims, fake
    // receipts and a successful model sequence do not establish native facts.
    public bool NativeExecutionProven => false;
    public bool NativeTransferAccepted => false;
    public bool OwnerPrimaryAssociationEstablished => false;
    public bool WorkerStartupEstablished => false;
    public bool LoadedCodeEstablished => false;
    public bool BootstrapAuthorized => false;
    public bool GrantIssued => false;
    public bool Lic008Closed => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

// No SafeHandle, finalizer, close or adoption routine. The future native adapter
// must attach/root any actual holder BEFORE an API can populate this rooted
// output slot. A numeric value is meaningful only in the pinned handle table.
internal sealed class StandardOwnerTransferObjectSlot
{
    internal StandardOwnerTransferObjectKind Kind { get; }
    internal string ContextSha256 { get; }
    internal uint HandleTableProcessId { get; }
    internal long HandleTableCreationFileTimeUtc { get; }
    internal long Value;
    private object? nativeLifetime;
    internal StandardOwnerTransferObjectSlot(StandardOwnerTransferObjectKind kind, string contextHash,
        uint tablePid, long tableCreation)
    {
        StandardContract.Need(Enum.IsDefined(kind) && StandardNativeCryptoRules.Hex(contextHash, 64) && tablePid > 0 && tableCreation > 0,
            "STANDARD_TRANSFER_SLOT_BINDING_REFUSED");
        Kind = kind; ContextSha256 = contextHash; HandleTableProcessId = tablePid; HandleTableCreationFileTimeUtc = tableCreation;
    }
    internal void AttachLifetimeBeforeNativeCall(object lifetime)
    {
        StandardContract.Need(lifetime is not null && Interlocked.CompareExchange(ref nativeLifetime, lifetime, null) is null,
            "STANDARD_TRANSFER_LIFETIME_ALREADY_ATTACHED");
    }
}
internal sealed class StandardOwnerTransferSlots
{
    internal IReadOnlyList<StandardOwnerTransferObjectSlot> All { get; }
    internal StandardOwnerTransferObjectSlot this[StandardOwnerTransferObjectKind kind] =>
        All[(int)kind];
    internal StandardOwnerTransferSlots(StandardOwnerTransferContext context, string hash)
    {
        All = Array.AsReadOnly(Enum.GetValues<StandardOwnerTransferObjectKind>().Select(kind => {
            bool remote = kind is StandardOwnerTransferObjectKind.RemoteOwnerProcess or StandardOwnerTransferObjectKind.RemoteOwnerToken;
            var table = remote ? context.Channel.Worker : context.Channel.Controller;
            return new StandardOwnerTransferObjectSlot(kind, hash, table.ProcessId, table.CreationFileTimeUtc);
        }).ToArray());
    }
}

internal interface IStandardOwnerTransferGuard
{
    // Independently bind the ACTUAL NEW V2 plan+approval originals, declared
    // EffectsV2, source/host/boot/file custody and unused run/nonce. Existing V1
    // InputCodec cannot issue/admit V2. Never normalize effects or infer approval
    // from a caller's EffectsV2 string alongside old plan/approval hashes.
    // Also reject thread impersonation and return the actual current owner
    // primary token. Worker JSON and a matching TokenId/AuthId are insufficient.
    StandardToken CaptureOwnerAndVerifyV2Custody(StandardOwnerTransferContext context, string contextSha256, string stage);
}
internal interface IStandardOwnerTransferOriginalSink
{
    // Fixed typed roles only. Future adapter must own immutable protected files,
    // create-new/flush/readback them and independently collect their identities.
    // Only StageSeed is readable by this exact stage's worker; no worker writes.
    // This component provides NO native disk mapping or receipt authentication.
    StandardOwnerTransferReceipt WriteNew(StandardOwnerTransferContext context, StandardOwnerTransferFile file, byte[] original);
    byte[] Read(StandardOwnerTransferContext context, StandardOwnerTransferFile file);
}
internal interface IStandardOwnerObjectTransferApi
{
    // Capture actual owner PRIMARY association via OpenProcessToken on the
    // actual original owner process; root all three local holders in slots
    // before calls. Independently capture the original held worker process and
    // its full primary token/custody. No PID reopening or worker report can
    // supply these facts. WorkerProcess slot is the original held object (or a
    // separately verified retained narrow alias), with QLI|SYNC|DUP_HANDLE.
    StandardOwnerTransferCapture CaptureOriginals(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots);
    StandardOwnerTransferCapture RecheckOriginals(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots);
    StandardOwnerTransferHandleObservation DescribeLocal(StandardOwnerTransferObjectSlot slot);
    // Closed operations only: source/target/output slots are predetermined by
    // kind. Target-process DUP_HANDLE rights stay in OWNER custody. The worker
    // receives only process QLI|SYNC and token QUERY, noninheritable, options0.
    // Root output holders before DuplicateHandle; never use CLOSE_SOURCE.
    void Duplicate(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots,
        StandardOwnerTransferDuplicateKind kind, uint desiredAccess, bool inherit, uint options);
    // ActualPeerProcessId comes from OS pipe provenance bound to originalWorker,
    // not the ACK JSON. ACK contains bindings/raw remote values, no token facts.
    StandardOwnerTransferAckRead ReadBootstrapAck(StandardOwnerTransferContext context,
        StandardOwnerTransferSeed seed, string seedSha256, uint remainingMilliseconds);
    bool CompareObjectHandles(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots,
        StandardOwnerTransferCompareKind kind);
    StandardPeerObjectObservation ObserveReturnedOwnerObjects(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots);
    // Reopen CURRENT primary token on the actual original owner process into
    // the pre-rooted CurrentOwnerPrimaryToken slot, then capture stable stats.
    StandardOwnerTransferCurrentPrimary ReopenCurrentOwnerPrimary(StandardOwnerTransferContext context, StandardOwnerTransferSlots slots);
}

internal static class StandardOwnerObjectTransferRules
{
    internal const string Purpose = "TEST_ONLY_STANDARD_OWNER_OBJECT_TRANSFER_CONTEXT_V2";
    internal const string EffectsV2 = "FRESH_SERVICES_TWO_KEYS_OWNED_ACCOUNT_LOGON_READONLY_OWNER_OBJECT_TRANSFER_RETURN_DISABLED_RETAIN_V2";
    internal const string JournalSchema = "TEST_ONLY_STANDARD_OWNER_OBJECT_TRANSFER_JOURNAL_V2";
    internal const string AckSchema = "TEST_ONLY_STANDARD_OWNER_OBJECT_TRANSFER_BOOTSTRAP_ACK_V2";
    internal const uint WorkerProcessAccess = 0x101040, ProcessLoanAccess = 0x101000, TokenLoanAccess = 8;
    internal const int BudgetMilliseconds = 30000, MaximumOriginal = 65536, MaximumAck = 8192;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 16 };
    internal static byte[] Encode<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, Json);
    internal static void Context(StandardOwnerTransferContext? context, DateTimeOffset now)
    {
        StandardContract.Need(context is not null && context.SchemaVersion == 2 && context.Purpose == Purpose &&
            context.Effects == EffectsV2 && context.Effects != StandardInputCodec.Effects,
            "STANDARD_TRANSFER_NEW_V2_CONTEXT_REQUIRED"); StandardWorkerChannelRules.ValidateContext(context.Channel, now);
    }
    internal static StandardOwnerTransferCapture Freeze(StandardOwnerTransferCapture? value)
    {
        StandardContract.Need(value is not null, "STANDARD_TRANSFER_CAPTURE_MISSING");
        return value with { Owner = StandardWorkerChannelRules.Snapshot(value.Owner), Worker = StandardWorkerChannelRules.Snapshot(value.Worker) };
    }
    internal static StandardOwnerTransferCurrentPrimary Freeze(StandardOwnerTransferCurrentPrimary? value)
    {
        StandardContract.Need(value is not null, "STANDARD_TRANSFER_CURRENT_PRIMARY_CAPTURE_MISSING");
        return value with { Owner = StandardWorkerChannelRules.Snapshot(value.Owner) };
    }
    internal static void Stats(StandardPeerTokenStatistics? before, StandardPeerTokenStatistics? after, StandardToken token)
    {
        StandardContract.Need(before is not null && after is not null && before.TokenId != 0 && before.AuthenticationId != 0 &&
            before.ModifiedId != 0 && before.TokenType == 1 && before.GroupCount is > 0 and <= 1024 && before.PrivilegeCount <= 1024,
            "STANDARD_TRANSFER_PRIMARY_STATISTICS_REFUSED"); StandardPeerObjectRules.Stable(before, after, token);
    }
    internal static void Capture(StandardOwnerTransferContext context, StandardOwnerTransferCapture capture)
    {
        StandardWorkerChannelRules.Observation(context.Channel, context.Channel.Controller, capture.Owner, true);
        StandardWorkerChannelRules.Observation(context.Channel, context.Channel.Worker, capture.Worker, false);
        Stats(capture.OwnerBefore, capture.OwnerAfter, capture.Owner.Process.Token);
        Stats(capture.WorkerBefore, capture.WorkerAfter, capture.Worker.Process.Token);
        StandardContract.Need(capture.OwnerWait == 258 && capture.WorkerWait == 258, "STANDARD_TRANSFER_ORIGINAL_PROCESS_EXITED");
    }
    internal static void Handle(StandardOwnerTransferObjectSlot slot, StandardOwnerTransferHandleObservation? observed)
    {
        bool process = slot.Kind is StandardOwnerTransferObjectKind.OwnerProcess or StandardOwnerTransferObjectKind.WorkerProcess or StandardOwnerTransferObjectKind.ReturnedOwnerProcess;
        uint access = slot.Kind == StandardOwnerTransferObjectKind.WorkerProcess ? WorkerProcessAccess : process ? ProcessLoanAccess : TokenLoanAccess;
        StandardContract.Need(observed is not null && observed.Value == slot.Value && observed.Value > 0 && observed.Flags == 0 &&
            observed.TypeName == (process ? "Process" : "Token") && observed.GrantedAccess == access,
            "STANDARD_TRANSFER_LOCAL_OBJECT_PROFILE_REFUSED");
    }
    private static void Unique(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object) {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var item in value.EnumerateObject()) { StandardContract.Need(names.Add(item.Name), "STANDARD_TRANSFER_ACK_DUPLICATE_PROPERTY"); Unique(item.Value); }
        } else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) Unique(item);
    }
    internal static StandardOwnerTransferAck DecodeAck(byte[]? supplied)
    {
        StandardContract.Need(supplied is { Length: >= 2 and <= MaximumAck }, "STANDARD_TRANSFER_ACK_LENGTH_REFUSED");
        byte[] bytes = (byte[])supplied.Clone();
        try {
            _ = Utf8.GetString(bytes);
            StandardContract.Need(!(bytes.Length >= 3 && bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf), "STANDARD_TRANSFER_ACK_BOM_REFUSED");
            using var parsed = JsonDocument.Parse(bytes, new() { MaxDepth = 16 });
            StandardContract.Need(parsed.RootElement.ValueKind == JsonValueKind.Object, "STANDARD_TRANSFER_ACK_OBJECT_REQUIRED"); Unique(parsed.RootElement);
            var ack = JsonSerializer.Deserialize<StandardOwnerTransferAck>(bytes, Json);
            StandardContract.Need(ack is not null && bytes.AsSpan().SequenceEqual(Encode(ack)), "STANDARD_TRANSFER_ACK_NONCANONICAL_REFUSED"); return ack;
        } catch (JsonException) { throw new InvalidDataException("STANDARD_TRANSFER_ACK_JSON_REFUSED"); }
        catch (DecoderFallbackException) { throw new InvalidDataException("STANDARD_TRANSFER_ACK_UTF8_REFUSED"); }
    }
}

// Synchronous INJECTED model only. No native adapter, CLI, transfer adoption,
// grant, cancellation, close, kill, retry or cleanup exists. Future bounded
// callers must retain pending invocation+all holders after timeout, not dispose
// them or take a locking snapshot while an unknown operation is still pending.
internal sealed class StandardOwnerObjectTransfer
{
    private static readonly object registryGate = new();
    private static readonly HashSet<string> usedRuns = new(StringComparer.Ordinal), usedNonces = new(StringComparer.Ordinal), usedStages = new(StringComparer.Ordinal);
    private static readonly HashSet<StandardOwnerObjectTransfer> retained = new();
    private readonly StandardOwnerTransferContext context;
    private readonly IStandardOwnerTransferGuard guard;
    private readonly IStandardOwnerObjectTransferApi api;
    private readonly IStandardOwnerTransferOriginalSink sink;
    private readonly IStandardChannelClock clock;
    private readonly object sync = new();
    private readonly Dictionary<StandardOwnerTransferObjectKind, long> pinned = new();
    private readonly List<StandardOwnerTransferOriginal> originals = new();
    private readonly Dictionary<StandardOwnerTransferFile, byte[]> bytes = new();
    private readonly string contextHash;
    private readonly StandardOwnerTransferSlots slots;
    private StandardOwnerTransferCapture? source;
    private string? sourceHash;
    private DateTimeOffset? lastUtc;
    private long? started, lastMonotonic;
    private int state;
    private string stage = "ADMISSION";
    private bool captureEntered, duplicateEntered, seedWriteEntered, bootstrapEntered, compareEntered, currentEntered, writeEntered;
    internal StandardOwnerObjectTransfer(StandardOwnerTransferContext context, IStandardOwnerTransferGuard guard,
        IStandardOwnerObjectTransferApi api, IStandardOwnerTransferOriginalSink sink, IStandardChannelClock clock)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard)); this.api = api ?? throw new ArgumentNullException(nameof(api));
        this.sink = sink ?? throw new ArgumentNullException(nameof(sink)); this.clock = clock ?? throw new ArgumentNullException(nameof(clock));
        StandardContract.Need(context.Channel is not null && context.Channel.Controller is not null && context.Channel.Worker is not null,
            "STANDARD_TRANSFER_PROCESS_CONTEXT_MISSING");
        StandardOwnerObjectTransferRules.Context(context, clock.UtcNow);
        contextHash = StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(context)); slots = new(context, contextHash);
    }
    private void CheckSlots()
    {
        foreach (var slot in slots.All) {
            StandardContract.Need(slot.ContextSha256 == contextHash, "STANDARD_TRANSFER_SLOT_CONTEXT_CHANGED");
            if (pinned.TryGetValue(slot.Kind, out long value)) StandardContract.Need(slot.Value == value, "STANDARD_TRANSFER_PINNED_HANDLE_CHANGED");
        }
    }
    private void Pin(StandardOwnerTransferObjectKind kind)
    {
        var slot = slots[kind]; StandardContract.Need(slot.Value > 0 && !pinned.ContainsKey(kind) &&
            slots.All.Where(x => x.Kind != kind && x.HandleTableProcessId == slot.HandleTableProcessId && x.Value > 0).All(x => x.Value != slot.Value),
            "STANDARD_TRANSFER_OUTPUT_HANDLE_REFUSED"); pinned.Add(kind, slot.Value);
    }
    private void Gate(string value)
    {
        stage = value; StandardContract.Need(Volatile.Read(ref state) == 1, "STANDARD_TRANSFER_REENTERED_OR_POISONED");
        CheckSlots(); DateTimeOffset before = clock.UtcNow; long monotonicBefore = clock.MonotonicMilliseconds;
        StandardOwnerObjectTransferRules.Context(context, before); started ??= monotonicBefore;
        StandardContract.Need(monotonicBefore >= 0 && (lastUtc is null || before >= lastUtc) &&
            (lastMonotonic is null || monotonicBefore >= lastMonotonic) && monotonicBefore - started.Value < StandardOwnerObjectTransferRules.BudgetMilliseconds,
            "STANDARD_TRANSFER_CLOCK_OR_BUDGET_REFUSED");
        StandardWorkerChannelRules.OwnerToken(guard.CaptureOwnerAndVerifyV2Custody(context, contextHash, stage));
        StandardContract.Need(Volatile.Read(ref state) == 1, "STANDARD_TRANSFER_REENTERED_OR_POISONED");
        CheckSlots(); DateTimeOffset after = clock.UtcNow; long monotonicAfter = clock.MonotonicMilliseconds;
        StandardOwnerObjectTransferRules.Context(context, after);
        StandardContract.Need(after >= before && monotonicAfter >= monotonicBefore && monotonicAfter - started.Value < StandardOwnerObjectTransferRules.BudgetMilliseconds,
            "STANDARD_TRANSFER_CLOCK_OR_BUDGET_REFUSED");
        StandardContract.Need(Volatile.Read(ref state) == 1, "STANDARD_TRANSFER_REENTERED_OR_POISONED"); CheckSlots();
        lastUtc = after; lastMonotonic = monotonicAfter;
    }
    private void Call(string value, Action action)
    { Gate(value + ":BEFORE"); action(); Gate(value + ":AFTER"); }
    private void Fresh()
    {
        lock (registryGate) {
            string stageKey = context.Channel.Scope.Attempt + ":" + StandardWorkerChannelRules.StageName(context.Channel.Stage);
            StandardContract.Need(!usedRuns.Contains(context.Channel.RunId) && !usedNonces.Contains(context.Channel.Nonce64) && !usedStages.Contains(stageKey),
                "STANDARD_TRANSFER_RUN_NONCE_OR_STAGE_ALREADY_USED");
            usedRuns.Add(context.Channel.RunId); usedNonces.Add(context.Channel.Nonce64); usedStages.Add(stageKey);
        }
        // This registry is only in-process reservation, not durable cross-process
        // freshness or authority to resume. Guard originals+CreateNew are still
        // mandatory and no serialized record can restart a failed instance.
    }
    private void Describe(StandardOwnerTransferObjectKind kind)
    { Call("DESCRIBE_" + kind, () => StandardOwnerObjectTransferRules.Handle(slots[kind], api.DescribeLocal(slots[kind]))); }
    private void Originals()
    {
        StandardContract.Need(source is not null && sourceHash is not null, "STANDARD_TRANSFER_SOURCE_MISSING");
        StandardOwnerTransferCapture? captured = null;
        Call("RECHECK_ORIGINALS", () => captured = StandardOwnerObjectTransferRules.Freeze(api.RecheckOriginals(context, slots)));
        StandardOwnerObjectTransferRules.Capture(context, captured!);
        StandardContract.Need(StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(captured)) == sourceHash,
            "STANDARD_TRANSFER_ORIGINAL_ASSOCIATION_OR_WORKER_CHANGED");
        Describe(StandardOwnerTransferObjectKind.OwnerProcess); Describe(StandardOwnerTransferObjectKind.OwnerPrimaryToken); Describe(StandardOwnerTransferObjectKind.WorkerProcess);
    }
    private void VerifyOriginalBytes()
    {
        foreach (var original in originals) {
            byte[]? read = null; Call("READ_" + original.Record.File, () => {
                byte[] supplied = sink.Read(context, original.Record.File);
                StandardContract.Need(supplied is { Length: >= 2 and <= StandardOwnerObjectTransferRules.MaximumOriginal }, "STANDARD_TRANSFER_ORIGINAL_LENGTH_REFUSED"); read = (byte[])supplied.Clone();
            });
            StandardContract.Need(read is not null && read.AsSpan().SequenceEqual(bytes[original.Record.File]) &&
                StandardNativeCryptoRules.Hash(read) == original.Sha256, "STANDARD_TRANSFER_ORIGINAL_CHANGED");
        }
    }
    private StandardOwnerTransferOriginal Write(StandardOwnerTransferFile file, StandardOwnerTransferSeed? seed = null,
        byte[]? ack = null, StandardPeerObjectObservation? returned = null, StandardOwnerTransferCurrentPrimary? current = null)
    {
        Originals(); VerifyOriginalBytes(); Gate("WRITE_" + file + ":ADMISSION"); DateTimeOffset written = clock.UtcNow;
        StandardOwnerObjectTransferRules.Context(context, written);
        StandardContract.Need(lastUtc is null || written >= lastUtc, "STANDARD_TRANSFER_JOURNAL_CLOCK_ROLLBACK");
        var record = new StandardOwnerTransferJournal(StandardOwnerObjectTransferRules.JournalSchema, context, contextHash, file, written,
            originals.Count == 0 ? null : originals[^1].Sha256, file == StandardOwnerTransferFile.Intent ? source : null,
            file == StandardOwnerTransferFile.Intent ? new(slots[StandardOwnerTransferObjectKind.OwnerProcess].Value,
                slots[StandardOwnerTransferObjectKind.OwnerPrimaryToken].Value, slots[StandardOwnerTransferObjectKind.WorkerProcess].Value) : null,
            seed, ack is null ? null : Convert.ToBase64String(ack), ack is null ? null : StandardNativeCryptoRules.Hash(ack), returned, current);
        byte[] originalBytes = StandardOwnerObjectTransferRules.Encode(record);
        StandardContract.Need(originalBytes.Length is >= 2 and <= StandardOwnerObjectTransferRules.MaximumOriginal, "STANDARD_TRANSFER_JOURNAL_LENGTH_REFUSED");
        StandardOwnerTransferReceipt? receipt = null;
        Call("WRITE_" + file, () => {
            writeEntered = true; if (file == StandardOwnerTransferFile.StageSeed) seedWriteEntered = true;
            receipt = sink.WriteNew(context, file, (byte[])originalBytes.Clone());
        });
        var r = receipt; DateTimeOffset now = clock.UtcNow;
        StandardContract.Need(r is not null && r.Context == context && r.ContextSha256 == contextHash && r.File == file &&
            r.Sha256 == StandardNativeCryptoRules.Hash(originalBytes) && r.Length == originalBytes.Length &&
            r.WrittenUtc.Offset == TimeSpan.Zero && r.WrittenUtc >= written && r.WrittenUtc <= now && r.VolumeSerial != 0 && r.FileIndex != 0 &&
            r.CreationFileTimeUtc >= written.UtcDateTime.ToFileTimeUtc() && r.CreationFileTimeUtc <= r.WrittenUtc.UtcDateTime.ToFileTimeUtc() &&
            r.CreateNew && r.Protected && r.OwnerOnlyWriter && r.WorkerReadable == (file == StandardOwnerTransferFile.StageSeed) &&
            r.DurablyFlushed && r.ExactReadback && !originals.Any(x => x.Receipt.VolumeSerial == r.VolumeSerial && x.Receipt.FileIndex == r.FileIndex),
            "STANDARD_TRANSFER_DURABLE_RECEIPT_REFUSED");
        var original = new StandardOwnerTransferOriginal(record, r.Sha256, r); bytes.Add(file, originalBytes); originals.Add(original);
        VerifyOriginalBytes(); return original;
    }
    private void Duplicate(StandardOwnerTransferDuplicateKind kind)
    {
        Originals(); VerifyOriginalBytes();
        var output = kind switch {
            StandardOwnerTransferDuplicateKind.OwnerProcessToWorker => StandardOwnerTransferObjectKind.RemoteOwnerProcess,
            StandardOwnerTransferDuplicateKind.OwnerTokenToWorker => StandardOwnerTransferObjectKind.RemoteOwnerToken,
            StandardOwnerTransferDuplicateKind.OwnerProcessBack => StandardOwnerTransferObjectKind.ReturnedOwnerProcess,
            _ => StandardOwnerTransferObjectKind.ReturnedOwnerToken };
        uint access = output is StandardOwnerTransferObjectKind.RemoteOwnerProcess or StandardOwnerTransferObjectKind.ReturnedOwnerProcess ?
            StandardOwnerObjectTransferRules.ProcessLoanAccess : StandardOwnerObjectTransferRules.TokenLoanAccess;
        Call("DUPLICATE_" + kind, () => {
            StandardContract.Need(slots[output].Value == 0, "STANDARD_TRANSFER_OUTPUT_ALREADY_POPULATED"); duplicateEntered = true;
            api.Duplicate(context, slots, kind, access, false, 0); Pin(output);
        });
    }
    private void Compare(StandardOwnerTransferCompareKind kind)
    {
        Originals(); VerifyOriginalBytes(); Call("COMPARE_" + kind, () => {
            compareEntered = true; StandardContract.Need(api.CompareObjectHandles(context, slots, kind), "STANDARD_TRANSFER_OBJECT_COMPARISON_FAILED");
        });
    }
    private StandardOwnerTransferResult Result(string outcome, StandardOwnerTransferFailure? failure = null) =>
        new(outcome, contextHash, Array.AsReadOnly(originals.ToArray()), Array.AsReadOnly(slots.All.Select(x =>
            new StandardOwnerTransferSlotState(x.Kind, x.HandleTableProcessId, x.HandleTableCreationFileTimeUtc, x.Value)).ToArray()), failure);
    internal StandardOwnerTransferResult Execute()
    {
        int prior = Interlocked.CompareExchange(ref state, 1, 0);
        if (prior != 0) {
            if (prior == 1) Interlocked.Exchange(ref state, 3);
            throw new InvalidDataException("STANDARD_TRANSFER_INSTANCE_ALREADY_CONSUMED");
        }
        lock (sync) {
            lock (registryGate) retained.Add(this); // BEFORE any possible output.
            try {
                Gate("ADMISSION"); Fresh();
                Call("CAPTURE_ORIGINALS", () => {
                    StandardContract.Need(slots.All.All(x => x.Value == 0), "STANDARD_TRANSFER_PREPOPULATED_SLOT_REFUSED"); captureEntered = true;
                    source = StandardOwnerObjectTransferRules.Freeze(api.CaptureOriginals(context, slots));
                    Pin(StandardOwnerTransferObjectKind.OwnerProcess); Pin(StandardOwnerTransferObjectKind.OwnerPrimaryToken); Pin(StandardOwnerTransferObjectKind.WorkerProcess);
                });
                StandardOwnerObjectTransferRules.Capture(context, source!); sourceHash = StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(source));
                var intent = Write(StandardOwnerTransferFile.Intent);
                Duplicate(StandardOwnerTransferDuplicateKind.OwnerProcessToWorker); Duplicate(StandardOwnerTransferDuplicateKind.OwnerTokenToWorker);
                var seed = new StandardOwnerTransferSeed(contextHash, intent.Sha256, slots[StandardOwnerTransferObjectKind.RemoteOwnerProcess].Value,
                    slots[StandardOwnerTransferObjectKind.RemoteOwnerToken].Value, source!.OwnerBefore);
                var seedOriginal = Write(StandardOwnerTransferFile.StageSeed, seed);
                Originals(); VerifyOriginalBytes(); StandardOwnerTransferAckRead? read = null; byte[]? ackBytes = null;
                Call("BOOTSTRAP_ACK", () => {
                    bootstrapEntered = true; long remaining = StandardOwnerObjectTransferRules.BudgetMilliseconds - (clock.MonotonicMilliseconds - started!.Value);
                    StandardContract.Need(remaining is > 0 and <= StandardOwnerObjectTransferRules.BudgetMilliseconds, "STANDARD_TRANSFER_BOOTSTRAP_BUDGET_REFUSED");
                    read = api.ReadBootstrapAck(context, seed, seedOriginal.Sha256, (uint)remaining);
                    StandardContract.Need(read is not null && read.OriginalUtf8 is { Length: >= 2 and <= StandardOwnerObjectTransferRules.MaximumAck }, "STANDARD_TRANSFER_BOOTSTRAP_READ_REFUSED");
                    ackBytes = (byte[])read.OriginalUtf8.Clone();
                });
                var ack = StandardOwnerObjectTransferRules.DecodeAck(ackBytes);
                StandardContract.Need(read!.ActualPeerProcessId == context.Channel.Worker.ProcessId && ack == new StandardOwnerTransferAck(
                    StandardOwnerObjectTransferRules.AckSchema, contextHash, context.Channel.Stage, context.Channel.RunId, context.Channel.Nonce64,
                    context.Channel.Worker.ProcessId, context.Channel.Worker.CreationFileTimeUtc, seed.RemoteOwnerProcess, seed.RemoteOwnerPrimaryToken,
                    intent.Sha256, seedOriginal.Sha256), "STANDARD_TRANSFER_BOOTSTRAP_BINDING_REFUSED");
                Duplicate(StandardOwnerTransferDuplicateKind.OwnerProcessBack); Duplicate(StandardOwnerTransferDuplicateKind.OwnerTokenBack);
                Describe(StandardOwnerTransferObjectKind.ReturnedOwnerProcess); Describe(StandardOwnerTransferObjectKind.ReturnedOwnerToken);
                Compare(StandardOwnerTransferCompareKind.ReturnedProcess); Compare(StandardOwnerTransferCompareKind.ReturnedToken);
                StandardPeerObjectObservation? returned = null;
                Call("OBSERVE_RETURNED_OWNER", () => {
                    var supplied = api.ObserveReturnedOwnerObjects(context, slots);
                    StandardContract.Need(supplied is not null && supplied.Process is not null && supplied.Token is not null, "STANDARD_TRANSFER_RETURNED_OBSERVATION_MISSING");
                    returned = supplied with { Token = StandardWorkerChannelRules.Snapshot(source.Owner with { Process = source.Owner.Process with { Token = supplied.Token } }).Process.Token };
                });
                StandardContract.Need(returned!.Process == new StandardPeerProcess(source.Owner.Process.ProcessId, source.Owner.Process.CreationFileTimeUtc, source.Owner.Process.ImagePath) &&
                    returned.Statistics == source.OwnerBefore && returned.ProcessGrantedAccess == StandardOwnerObjectTransferRules.ProcessLoanAccess &&
                    returned.TokenGrantedAccess == StandardOwnerObjectTransferRules.TokenLoanAccess &&
                    StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(returned.Token)) == StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(source.Owner.Process.Token)),
                    "STANDARD_TRANSFER_RETURNED_OWNER_CHANGED");
                StandardOwnerObjectTransferRules.Stats(returned.Statistics, returned.Statistics, returned.Token); StandardWorkerChannelRules.OwnerToken(returned.Token);
                Originals(); VerifyOriginalBytes(); StandardOwnerTransferCurrentPrimary? current = null;
                Call("REOPEN_CURRENT_OWNER_PRIMARY", () => {
                    StandardContract.Need(slots[StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken].Value == 0, "STANDARD_TRANSFER_CURRENT_SLOT_ALREADY_POPULATED");
                    currentEntered = true; current = StandardOwnerObjectTransferRules.Freeze(api.ReopenCurrentOwnerPrimary(context, slots)); Pin(StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken);
                });
                Describe(StandardOwnerTransferObjectKind.CurrentOwnerPrimaryToken); Compare(StandardOwnerTransferCompareKind.CurrentPrimaryToken);
                StandardWorkerChannelRules.Observation(context.Channel, context.Channel.Controller, current!.Owner, true);
                StandardOwnerObjectTransferRules.Stats(current.Before, current.After, current.Owner.Process.Token);
                StandardContract.Need(current.Before == source.OwnerBefore && current.OwnerWait == 258 &&
                    StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(current.Owner)) == StandardNativeCryptoRules.Hash(StandardOwnerObjectTransferRules.Encode(source.Owner)),
                    "STANDARD_TRANSFER_CURRENT_OWNER_PRIMARY_CHANGED");
                _ = Write(StandardOwnerTransferFile.Complete, seed, ackBytes, returned, current);
                var completed = Result("MODEL_TRANSFER_CHAIN_RECORDED_RETAINED"); Gate("MODEL_COMPLETE_RETAINED");
                // Later GRANT must repeat actual CURRENT owner-primary
                // association; this moment's modeled check is not lasting proof.
                StandardContract.Need(Interlocked.CompareExchange(ref state, 2, 1) == 1,
                    "STANDARD_TRANSFER_COMPLETION_PUBLICATION_POISONED"); return completed;
            } catch (Exception error) {
                Interlocked.Exchange(ref state, 3);
                return Result("RETAINED_PARTIAL_OR_UNKNOWN", new(stage, error.GetType().Name, error.HResult,
                    error is Win32Exception win32 ? win32.NativeErrorCode : null, captureEntered, duplicateEntered, seedWriteEntered,
                    bootstrapEntered, compareEntered, currentEntered, writeEntered));
            }
        }
    }
}
