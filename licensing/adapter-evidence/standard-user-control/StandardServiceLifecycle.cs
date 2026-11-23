using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

internal enum StandardServiceRole { Setup, Guardian }
internal enum StandardServiceJournalFile { SetupIntent, SetupOwned, SetupComplete, GuardianIntent, GuardianOwned, GuardianComplete,
    SetupStart, SetupAdmitted, SetupRunComplete, GuardianBeforeStart, GuardianBeforeAdmitted, GuardianBeforeComplete,
    GuardianAfterStart, GuardianAfterAdmitted, GuardianAfterComplete }
internal sealed record StandardServiceContext(StandardCryptoScope Scope, string SourceSetSha256, string Effects);
internal sealed record StandardServiceRecipe(StandardServiceRole Role, string Name, string Account, string Command, string ServiceSid);
internal sealed record StandardServiceStatus(uint State, uint ProcessId, uint Win32Exit, uint ServiceExit);
internal sealed record StandardServiceSnapshot(StandardServiceRecipe Recipe, uint Type, uint Start, uint Error,
    uint SidType, uint Triggers, uint FailureActions, bool FailureOnNonCrash, bool DelayedAutoStart, uint LaunchProtected,
    string DescriptorSha256, StandardServiceStatus Status);
internal sealed record StandardServiceRunContext(StandardServiceContext Context, StandardCryptoStage Stage,
    string RunId, string Nonce64, string? PredecessorReportSha256, StandardChannelKeyPair? Keys);
internal sealed record StandardServiceInvocation(StandardServiceRole Role, StandardCryptoStage Stage, string RunId, string Attempt);
internal sealed record StandardServiceJournalRecord(string Schema, StandardServiceContext Context, StandardServiceRole Role,
    string Kind, DateTimeOffset WrittenUtc, string? PreviousSha256, string? OtherOwnedSha256,
    StandardServiceSnapshot? Snapshot, StandardServiceRunContext? Run, uint? ProcessId, long? CreationFileTimeUtc);
internal sealed record StandardServiceJournalReceipt(StandardServiceContext Context, StandardServiceJournalFile File,
    string Sha256, int Length, DateTimeOffset WrittenUtc, uint VolumeSerial, ulong FileIndex, long CreationFileTimeUtc,
    bool CreateNew, bool Protected, bool DurablyFlushed, bool ExactReadback);
internal sealed record StandardServiceOriginal(StandardServiceJournalRecord Record, StandardServiceJournalFile File,
    string Sha256, StandardServiceJournalReceipt Receipt);
internal sealed record StandardServiceFailure(string Stage, string Category, int ManagedHResult, int? Win32Error,
    string? NativeApi, bool CreateCallEntered, bool ConfigurationCallEntered, bool StartCallEntered, bool WriteCallEntered);
internal sealed record StandardServiceResult(string Outcome, IReadOnlyList<StandardServiceOriginal> Originals,
    IStandardChannelProcessLease? RetainedProcess, StandardServiceFailure? Failure)
{
    public bool StartupCodeAssociationEstablished => false;
    public bool GrantIssued => false;
    public bool NativeExecutionProven => false;
    public bool Lic008Closed => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

internal interface IStandardServiceJournalSink
{
    // Future concrete adapter must use fixed protected CreateNew files, durable
    // same-handle flush/readback and original object identities. No sink exists
    // in this component; typed receipts are not independent native collection.
    StandardServiceJournalReceipt WriteNew(StandardServiceJournalFile file, byte[] original);
    byte[] Read(StandardServiceJournalFile file);
}
internal interface IStandardCreatedServiceHandle : IDisposable { }
internal sealed class StandardServiceHandleSlot
{
    private IStandardCreatedServiceHandle? handle;
    internal StandardServiceContext Context { get; }
    internal StandardServiceRecipe Recipe { get; }
    internal StandardServiceHandleSlot(StandardServiceContext context, StandardServiceRecipe recipe) { Context = context; Recipe = recipe; }
    internal IStandardCreatedServiceHandle Handle => handle ?? throw new InvalidDataException("STANDARD_SERVICE_HANDLE_UNATTACHED");
    // The native adapter attaches its holder BEFORE entering CreateServiceW.
    internal void Attach(IStandardCreatedServiceHandle value) {
        StandardContract.Need(Interlocked.CompareExchange(ref handle, value, null) is null, "STANDARD_SERVICE_HANDLE_ALREADY_ATTACHED");
    }
}
internal interface IStandardServiceProcessOpener
{
    // Must root native handles before any open/query can throw. This method is
    // scoped only to the RUNNING PID chosen on the original SCM service handle.
    // Opening an image/token does not establish actual loaded-module custody.
    IStandardChannelProcessLease OpenRunning(uint processId, long earliestCreation, long latestCreation, Action admission);
}
internal interface IStandardServiceApi
{
    int ProbeName(StandardServiceContext context, StandardServiceRecipe recipe, Action admission);
    void CreateDisabled(StandardServiceHandleSlot slot, Action verifyDurableIntent, Action admission);
    void ConfigureDisabled(StandardServiceHandleSlot slot, Action admission);
    void EnableDemandStart(StandardServiceHandleSlot slot, Action admission);
    StandardServiceSnapshot Inspect(StandardServiceHandleSlot slot, Action admission);
    void Start(StandardServiceHandleSlot slot, StandardServiceRunContext run, Action verifyStartOriginal, Action admission);
    StandardServiceStatus Status(StandardServiceHandleSlot slot, Action admission);
    IStandardChannelProcessLease OpenRunning(StandardServiceHandleSlot slot, uint processId,
        long earliestCreation, long latestCreation, Action admission);
}
internal interface IStandardServiceGuard
{
    StandardToken CaptureOwnerAndVerifyCustody(StandardServiceContext context, string stage);
    // Before START, independently bind actual predecessor originals/key chain,
    // fresh stopped service ownership, stage order and complete declared effects.
    void VerifyBeforeStart(StandardServiceRunContext run);
    // Actual owner-collected report/ACK, bootstrap association and held code
    // custody are required, not a worker field or this component's observation.
    void VerifyBeforeComplete(StandardServiceRunContext run);
}
internal sealed class StandardServiceNativeException : Win32Exception
{
    internal string Api { get; }
    internal StandardServiceNativeException(string api, int error) : base(error) { Api = api; }
}

internal static class StandardServiceRules
{
    internal const string Schema = "TEST_ONLY_STANDARD_FRESH_SERVICE_JOURNAL_V1";
    internal const int ObservationBudgetMilliseconds = 45000;
    internal static void Context(StandardServiceContext? c, DateTimeOffset now) {
        StandardContract.Need(c is not null && StandardNativeCryptoRules.Hex(c.SourceSetSha256, 64) &&
            c.Effects == StandardInputCodec.Effects, "STANDARD_SERVICE_CONTEXT_REFUSED"); StandardStoreRules.Scope(c.Scope, now);
    }
    internal static StandardServiceRole Role(StandardCryptoStage stage) => stage switch {
        StandardCryptoStage.Setup => StandardServiceRole.Setup,
        StandardCryptoStage.GuardianBefore or StandardCryptoStage.GuardianAfter => StandardServiceRole.Guardian,
        _ => throw new InvalidDataException("STANDARD_SERVICE_STAGE_REFUSED")
    };
    internal static StandardServiceRecipe Recipe(StandardServiceContext c, StandardServiceRole role) {
        StandardContract.Need(Enum.IsDefined(role), "STANDARD_SERVICE_ROLE_REFUSED");
        string name = role == StandardServiceRole.Setup ? StandardContract.SetupService : StandardContract.GuardianService;
        string sid = role == StandardServiceRole.Setup ? StandardCryptoComparison.SetupSid : StandardCryptoComparison.GuardianSid;
        StandardContract.Need(StandardCryptoComparison.DerivedServiceSid(name) == sid, "STANDARD_SERVICE_SID_DERIVATION_REFUSED");
        string command = "\"" + StandardLaunchPlan.Image + "\" exec --fx-version 10.0.11 \"" + StandardLaunchPlan.Assembly +
            "\" --standard-service " + (role == StandardServiceRole.Setup ? "Setup" : "Guardian") + " --attempt " + c.Scope.Attempt +
            " --plan-sha256 " + c.Scope.PlanSha256 + " --approval-sha256 " + c.Scope.ApprovalSha256 + " --source-set-sha256 " + c.SourceSetSha256;
        return new(role, name, role == StandardServiceRole.Setup ? "LocalSystem" : "NT SERVICE\\" + name, command, sid);
    }
    internal static byte[] Descriptor(StandardServiceRole role) {
        StandardContract.Need(Enum.IsDefined(role), "STANDARD_SERVICE_ROLE_REFUSED");
        var sd = new RawSecurityDescriptor("O:BAG:BAD:P(A;;0x000f01ff;;;SY)(A;;0x000f01ff;;;BA)" +
            (role == StandardServiceRole.Guardian ? "(A;;0x00020005;;;" + StandardCryptoComparison.GuardianSid + ")" : ""));
        var bytes = new byte[sd.BinaryLength]; sd.GetBinaryForm(bytes, 0); return bytes;
    }
    internal static string Descriptor(byte[]? supplied, StandardServiceRole role) {
        StandardContract.Need(Enum.IsDefined(role), "STANDARD_SERVICE_ROLE_REFUSED");
        StandardContract.Need(supplied is { Length: >= 20 and <= 65536 }, "STANDARD_SERVICE_DESCRIPTOR_SIZE_REFUSED");
        var bytes = (byte[])supplied.Clone(); var sd = new RawSecurityDescriptor(bytes, 0);
        const ControlFlags needed = ControlFlags.DiscretionaryAclPresent | ControlFlags.DiscretionaryAclProtected;
        StandardContract.Need(sd.BinaryLength == bytes.Length && (sd.ControlFlags & needed) == needed &&
            (sd.ControlFlags & ~(needed | ControlFlags.SelfRelative)) == 0 && sd.SystemAcl is null &&
            sd.Owner?.Value == StandardContract.Administrators && sd.Group?.Value == StandardContract.Administrators &&
            sd.DiscretionaryAcl is not null && sd.DiscretionaryAcl.Count == (role == StandardServiceRole.Setup ? 2 : 3),
            "STANDARD_SERVICE_DESCRIPTOR_REFUSED");
        var wanted = new Dictionary<string, uint>(StringComparer.Ordinal) { [StandardCryptoComparison.SystemSid] = 0xf01ff, [StandardContract.Administrators] = 0xf01ff };
        if (role == StandardServiceRole.Guardian) wanted.Add(StandardCryptoComparison.GuardianSid, 0x20005);
        foreach (GenericAce raw in sd.DiscretionaryAcl) {
            StandardContract.Need(raw is CommonAce, "STANDARD_SERVICE_ACE_REFUSED"); var ace = (CommonAce)raw;
            StandardContract.Need(!ace.IsCallback && ace.AceFlags == AceFlags.None && ace.AceQualifier == AceQualifier.AccessAllowed &&
                wanted.Remove(ace.SecurityIdentifier.Value, out uint mask) && unchecked((uint)ace.AccessMask) == mask,
                "STANDARD_SERVICE_ACE_REFUSED");
        }
        StandardContract.Need(wanted.Count == 0, "STANDARD_SERVICE_PRINCIPAL_MISSING"); return StandardNativeCryptoRules.Hash(bytes);
    }
    internal static void Snapshot(StandardServiceContext c, StandardServiceRole role, StandardServiceSnapshot? s,
        uint start, bool stopped, string? descriptor = null) {
        StandardContract.Need(s is not null && s.Recipe == Recipe(c, role) && s.Type == 16 && s.Start == start && s.Error == 1 && s.SidType == 1 &&
            s.Triggers == 0 && s.FailureActions == 0 && !s.FailureOnNonCrash && !s.DelayedAutoStart && s.LaunchProtected == 0 &&
            StandardNativeCryptoRules.Hex(s.DescriptorSha256, 64) && (descriptor is null || s.DescriptorSha256 == descriptor) &&
            s.Status is not null && s.Status.State is >= 1 and <= 7 &&
            (!stopped || s.Status.State == 1 && s.Status.ProcessId == 0), "STANDARD_SERVICE_PROFILE_REFUSED");
    }
    internal static void Run(StandardServiceRunContext? r, StandardServiceContext c) {
        StandardContract.Need(r is not null && r.Context == c && StandardNativeCryptoRules.Hex(r.RunId, 32) &&
            StandardNativeCryptoRules.Hex(r.Nonce64, 64), "STANDARD_SERVICE_RUN_BINDING_REFUSED"); _ = Role(r.Stage);
        if (r.Stage == StandardCryptoStage.Setup) StandardContract.Need(r.PredecessorReportSha256 is null && r.Keys is null, "STANDARD_SERVICE_SETUP_KEYS_MUST_BE_UNKNOWN");
        else {
            StandardContract.Need(StandardNativeCryptoRules.Hex(r.PredecessorReportSha256, 64) && r.Keys is not null, "STANDARD_SERVICE_PREDECESSOR_MISSING");
            foreach (var (key, arm) in new[] { (r.Keys.Restricted, StandardCryptoArm.Restricted), (r.Keys.Accessible, StandardCryptoArm.UserAccessible) })
                StandardContract.Need(key is not null && key.Arm == arm && key.Name == StandardCryptoComparison.KeyName(c.Scope.Attempt, arm) &&
                    StandardNativeCryptoRules.Hex(key.PublicSha256, 64) && StandardNativeCryptoRules.Hex(key.DescriptorSha256, 64) &&
                    StandardNativeCryptoRules.Hex(key.EnvelopeSha256, 64) && key.PlaintextSha256 == StandardSyntheticEnvelopeCodec.PlaintextHash,
                    "STANDARD_SERVICE_KEY_BINDING_REFUSED");
            StandardContract.Need(r.Keys.Restricted.PublicSha256 != r.Keys.Accessible.PublicSha256 &&
                r.Keys.Restricted.DescriptorSha256 != r.Keys.Accessible.DescriptorSha256 &&
                r.Keys.Restricted.EnvelopeSha256 != r.Keys.Accessible.EnvelopeSha256, "STANDARD_SERVICE_KEYS_NOT_DISTINCT");
        }
    }
    internal static StandardServiceInvocation Invocation(StandardServiceContext c, StandardServiceRole role, IReadOnlyList<string>? args) {
        var recipe = Recipe(c, role);
        StandardContract.Need(args is { Count: 4 } && args[0] == recipe.Name && StandardNativeCryptoRules.Hex(args[2], 32) &&
            args[3] == c.Scope.Attempt, "STANDARD_SERVICE_MAIN_ARGUMENTS_REFUSED");
        StandardCryptoStage stage = args[1] switch { "setup" => StandardCryptoStage.Setup, "guardian-before" => StandardCryptoStage.GuardianBefore,
            "guardian-after" => StandardCryptoStage.GuardianAfter, _ => throw new InvalidDataException("STANDARD_SERVICE_MAIN_STAGE_REFUSED") };
        StandardContract.Need(Role(stage) == role, "STANDARD_SERVICE_MAIN_ROLE_REFUSED"); return new(role, stage, args[2], args[3]);
    }
    internal static StandardServiceJournalFile File(StandardServiceRole role, string kind, StandardCryptoStage? stage = null) => (role, kind, stage) switch {
        (StandardServiceRole.Setup, "INTENT", null) => StandardServiceJournalFile.SetupIntent,
        (StandardServiceRole.Setup, "OWNED", null) => StandardServiceJournalFile.SetupOwned,
        (StandardServiceRole.Setup, "COMPLETE", null) => StandardServiceJournalFile.SetupComplete,
        (StandardServiceRole.Guardian, "INTENT", null) => StandardServiceJournalFile.GuardianIntent,
        (StandardServiceRole.Guardian, "OWNED", null) => StandardServiceJournalFile.GuardianOwned,
        (StandardServiceRole.Guardian, "COMPLETE", null) => StandardServiceJournalFile.GuardianComplete,
        (StandardServiceRole.Setup, "START", StandardCryptoStage.Setup) => StandardServiceJournalFile.SetupStart,
        (StandardServiceRole.Setup, "ADMITTED", StandardCryptoStage.Setup) => StandardServiceJournalFile.SetupAdmitted,
        (StandardServiceRole.Setup, "RUN_COMPLETE", StandardCryptoStage.Setup) => StandardServiceJournalFile.SetupRunComplete,
        (StandardServiceRole.Guardian, "START", StandardCryptoStage.GuardianBefore) => StandardServiceJournalFile.GuardianBeforeStart,
        (StandardServiceRole.Guardian, "ADMITTED", StandardCryptoStage.GuardianBefore) => StandardServiceJournalFile.GuardianBeforeAdmitted,
        (StandardServiceRole.Guardian, "RUN_COMPLETE", StandardCryptoStage.GuardianBefore) => StandardServiceJournalFile.GuardianBeforeComplete,
        (StandardServiceRole.Guardian, "START", StandardCryptoStage.GuardianAfter) => StandardServiceJournalFile.GuardianAfterStart,
        (StandardServiceRole.Guardian, "ADMITTED", StandardCryptoStage.GuardianAfter) => StandardServiceJournalFile.GuardianAfterAdmitted,
        (StandardServiceRole.Guardian, "RUN_COMPLETE", StandardCryptoStage.GuardianAfter) => StandardServiceJournalFile.GuardianAfterComplete,
        _ => throw new InvalidDataException("STANDARD_SERVICE_JOURNAL_FILE_REFUSED")
    };
}

// Single-controller lifetime ownership. No API reopens an owned service by name.
// These roots intentionally retain unknown/partial handles, including failed
// CreateService calls whose native holder was attached before entering Windows.
internal sealed class StandardServiceLifecycle
{
    private static readonly object RetentionGate = new();
    private static readonly List<object> Retained = new();
    private readonly StandardServiceContext context;
    private readonly IStandardServiceApi api;
    private readonly IStandardServiceJournalSink store;
    private readonly IStandardServiceGuard guard;
    private readonly IStandardChannelClock clock;
    private readonly Action<uint> wait;
    private readonly Dictionary<StandardServiceRole, StandardServiceHandleSlot> services = new();
    private readonly Dictionary<StandardServiceRole, StandardServiceOriginal> owned = new(), complete = new();
    private readonly Dictionary<StandardServiceJournalFile, byte[]> bytes = new();
    private readonly List<StandardServiceOriginal> originals = new();
    private readonly Dictionary<StandardCryptoStage, Running> runs = new();
    private readonly HashSet<string> runIds = new(StringComparer.Ordinal);
    private readonly HashSet<string> nonces = new(StringComparer.Ordinal);
    private DateTimeOffset? lastUtc;
    private int registered, active;
    private bool registrationComplete, faulted, createEntered, configureEntered, startEntered, writeEntered;
    private string stage = "ADMISSION";
    private sealed class Running {
        internal readonly StandardServiceRunContext Run;
        internal IStandardChannelProcessLease? Process;
        internal StandardServiceOriginal? Admitted;
        internal bool Completed, CompletionAttempted;
        internal Running(StandardServiceRunContext run) { Run = run; }
    }
    internal StandardServiceLifecycle(StandardServiceContext context, IStandardServiceApi api, IStandardServiceJournalSink store,
        IStandardServiceGuard guard, IStandardChannelClock clock, Action<uint> wait) {
        this.context = context ?? throw new ArgumentNullException(nameof(context)); this.api = api ?? throw new ArgumentNullException(nameof(api));
        this.store = store ?? throw new ArgumentNullException(nameof(store)); this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.clock = clock ?? throw new ArgumentNullException(nameof(clock)); this.wait = wait ?? throw new ArgumentNullException(nameof(wait));
    }
    private void VerifyUtc() {
        DateTimeOffset now = clock.UtcNow; StandardServiceRules.Context(context, now);
        StandardContract.Need(lastUtc is null || now >= lastUtc.Value, "STANDARD_SERVICE_UTC_ROLLBACK_REFUSED"); lastUtc = now;
    }
    private void Gate() {
        VerifyUtc(); var owner = guard.CaptureOwnerAndVerifyCustody(context, stage);
        StandardWorkerChannelRules.OwnerToken(owner); VerifyUtc();
    }
    private void Read(StandardServiceOriginal original) {
        Gate(); var actual = store.Read(original.File);
        StandardContract.Need(actual is not null && actual.AsSpan().SequenceEqual(bytes[original.File]) &&
            StandardNativeCryptoRules.Hash(actual) == original.Sha256, "STANDARD_SERVICE_ORIGINAL_CHANGED"); Gate();
    }
    private StandardServiceOriginal Write(StandardServiceRole role, string kind, StandardServiceOriginal? previous,
        string? other, StandardServiceSnapshot? snapshot, StandardServiceRunContext? run = null, IStandardChannelProcessLease? process = null) {
        Gate(); DateTimeOffset written = clock.UtcNow; StandardServiceRules.Context(context, written);
        StandardContract.Need(previous is null || written > previous.Receipt.WrittenUtc, "STANDARD_SERVICE_RECORD_TIME_REFUSED");
        var record = new StandardServiceJournalRecord(StandardServiceRules.Schema, context, role, kind, written,
            previous?.Sha256, other, snapshot, run, process?.ProcessId, process?.CreationFileTimeUtc);
        byte[] raw = JsonSerializer.SerializeToUtf8Bytes(record); var file = StandardServiceRules.File(role, kind, run?.Stage);
        writeEntered = true; var receipt = store.WriteNew(file, (byte[])raw.Clone()); Gate();
        StandardContract.Need(receipt is not null && receipt.Context == context && receipt.File == file &&
            receipt.Sha256 == StandardNativeCryptoRules.Hash(raw) && receipt.Length == raw.Length && receipt.WrittenUtc.Offset == TimeSpan.Zero &&
            receipt.WrittenUtc >= written && receipt.WrittenUtc <= clock.UtcNow && receipt.VolumeSerial != 0 && receipt.FileIndex != 0 &&
            receipt.CreationFileTimeUtc >= written.UtcDateTime.ToFileTimeUtc() && receipt.CreationFileTimeUtc <= receipt.WrittenUtc.UtcDateTime.ToFileTimeUtc() &&
            receipt.CreateNew && receipt.Protected && receipt.DurablyFlushed && receipt.ExactReadback &&
            !originals.Any(x => x.Receipt.VolumeSerial == receipt.VolumeSerial && x.Receipt.FileIndex == receipt.FileIndex),
            "STANDARD_SERVICE_RECEIPT_REFUSED");
        var original = new StandardServiceOriginal(record, file, receipt.Sha256, receipt); bytes.Add(file, raw); Read(original); originals.Add(original); return original;
    }
    private StandardServiceResult Result(string outcome, Exception? error = null, IStandardChannelProcessLease? process = null) => new(outcome,
        Array.AsReadOnly(originals.ToArray()), process, error is null ? null : new(stage,
            error switch { StandardServiceNativeException => "WIN32", Win32Exception => "WIN32", InvalidDataException => "VALIDATION",
                UnauthorizedAccessException => "UNAUTHORIZED_ACCESS", IOException => "IO", TimeoutException => "TIMEOUT", _ => "UNKNOWN" },
            error.HResult, error is Win32Exception native ? native.NativeErrorCode : null,
            error is StandardServiceNativeException named ? named.Api : null, createEntered, configureEntered, startEntered, writeEntered));
    private void Enter() => StandardContract.Need(Interlocked.Exchange(ref active, 1) == 0, "STANDARD_SERVICE_CONCURRENT_ENTRY_REFUSED");
    internal StandardServiceResult RegisterPair() {
        Enter();
        try {
            StandardContract.Need(Interlocked.Exchange(ref registered, 1) == 0, "STANDARD_SERVICE_REGISTRATION_CONSUMED"); Gate();
            foreach (var role in Enum.GetValues<StandardServiceRole>()) {
                stage = "NAME_PROBE"; Gate(); StandardContract.Need(api.ProbeName(context, StandardServiceRules.Recipe(context, role), Gate) == 1060,
                    "STANDARD_SERVICE_EXISTING_OR_ABSENCE_UNKNOWN");
            }
            foreach (var role in Enum.GetValues<StandardServiceRole>()) {
                stage = "CREATE_INTENT"; var intent = Write(role, "INTENT", null, null, null);
                var slot = new StandardServiceHandleSlot(context, StandardServiceRules.Recipe(context, role)); services.Add(role, slot);
                lock (RetentionGate) Retained.Add(slot);
                stage = "CREATE_DISABLED"; Gate(); createEntered = true; api.CreateDisabled(slot, () => Read(intent), Gate);
                stage = "CONFIGURE_DISABLED"; Gate(); configureEntered = true; api.ConfigureDisabled(slot, Gate);
                var snapshot = api.Inspect(slot, Gate); StandardServiceRules.Snapshot(context, role, snapshot, 4, true);
                stage = "OWNED_WRITE"; owned.Add(role, Write(role, "OWNED", intent, null, snapshot));
            }
            foreach (var role in Enum.GetValues<StandardServiceRole>()) {
                Read(owned[StandardServiceRole.Setup]); Read(owned[StandardServiceRole.Guardian]);
                stage = "ENABLE_DEMAND"; Gate(); configureEntered = true; api.EnableDemandStart(services[role], Gate);
                var snapshot = api.Inspect(services[role], Gate);
                StandardServiceRules.Snapshot(context, role, snapshot, 3, true, owned[role].Record.Snapshot!.DescriptorSha256);
                var other = role == StandardServiceRole.Setup ? StandardServiceRole.Guardian : StandardServiceRole.Setup;
                stage = "COMPLETE_WRITE"; complete.Add(role, Write(role, "COMPLETE", owned[role], owned[other].Sha256, snapshot));
            }
            Gate(); registrationComplete = true; return Result("FRESH_PAIR_REGISTERED_STOPPED_DEMAND");
        } catch (Exception error) { return Result("RETAINED_PARTIAL_OR_UNKNOWN", error); }
        finally { Volatile.Write(ref active, 0); }
    }
    private void Budget(long started, ref long last) {
        long now = clock.MonotonicMilliseconds;
        StandardContract.Need(started >= 0 && now >= last && now >= started && now - started < StandardServiceRules.ObservationBudgetMilliseconds,
            "STANDARD_SERVICE_OBSERVATION_DEADLINE"); last = now; VerifyUtc();
    }
    internal StandardServiceResult StartAndAdmit(StandardServiceRunContext run) {
        Enter(); Running? running = null;
        try {
            stage = "START_ADMISSION"; StandardContract.Need(!faulted, "STANDARD_SERVICE_FAULT_RETAINED_NO_FURTHER_EFFECTS"); Gate(); StandardServiceRules.Run(run, context);
            StandardContract.Need(registrationComplete && !runs.ContainsKey(run.Stage) && runIds.Add(run.RunId) && nonces.Add(run.Nonce64),
                "STANDARD_SERVICE_RUN_CONSUMED_OR_UNREGISTERED");
            running = new(run); runs.Add(run.Stage, running); lock (RetentionGate) Retained.Add(running);
            StandardContract.Need(run.Stage == StandardCryptoStage.Setup ? runs.Count == 1 :
                runs.TryGetValue(StandardCryptoStage.Setup, out var setup) && setup.Completed &&
                (run.Stage == StandardCryptoStage.GuardianBefore || runs.TryGetValue(StandardCryptoStage.GuardianBefore, out var before) && before.Completed),
                "STANDARD_SERVICE_STAGE_ORDER_REFUSED");
            guard.VerifyBeforeStart(run); Gate(); var role = StandardServiceRules.Role(run.Stage); var slot = services[role]; Read(complete[role]);
            var beforeStart = api.Inspect(slot, Gate); StandardServiceRules.Snapshot(context, role, beforeStart, 3, true, complete[role].Record.Snapshot!.DescriptorSha256);
            stage = "START_INTENT"; var intent = Write(role, "START", complete[role], null, beforeStart, run);
            stage = "START_SERVICE"; Gate(); long earliest = clock.UtcNow.UtcDateTime.ToFileTimeUtc(); startEntered = true;
            api.Start(slot, run, () => Read(intent), Gate);
            long started = clock.MonotonicMilliseconds, last = started; StandardServiceStatus status;
            while (true) {
                stage = "RUNNING_OBSERVATION"; Budget(started, ref last); status = api.Status(slot, Gate); Budget(started, ref last);
                StandardContract.Need(status is not null && status.State is >= 1 and <= 7, "STANDARD_SERVICE_STATUS_REFUSED");
                if (status.State == 4 && status.ProcessId > 0) break;
                StandardContract.Need(status.State == 2, "STANDARD_SERVICE_RUNNING_PROCESS_NOT_OBSERVED"); wait(25);
            }
            stage = "PROCESS_PIN"; Gate(); long latest = clock.UtcNow.UtcDateTime.ToFileTimeUtc();
            running.Process = api.OpenRunning(slot, status.ProcessId, earliest, latest, Gate);
            Budget(started, ref last);
            var process = running.Process;
            StandardContract.Need(process is not null && process.ProcessId == status.ProcessId && process.CreationFileTimeUtc >= earliest &&
                process.CreationFileTimeUtc <= latest && process.Wait(0) == 258, "STANDARD_SERVICE_PROCESS_HANDLE_REFUSED");
            var observed = StandardWorkerChannelRules.Snapshot(process.Capture());
            Budget(started, ref last);
            StandardContract.Need(observed.Process.ProcessId == process.ProcessId && observed.Process.CreationFileTimeUtc == process.CreationFileTimeUtc &&
                observed.Process.ImagePath == StandardLaunchPlan.Image && observed.AssemblyPath == StandardLaunchPlan.Assembly &&
                observed.ImageSha256 == context.Scope.ImageSha256 && observed.AssemblySha256 == context.Scope.AssemblySha256 &&
                observed.PackageSha256 == context.Scope.PackageSha256 && observed.RuntimeSha256 == context.Scope.RuntimeSha256,
                "STANDARD_SERVICE_PROCESS_OBSERVATION_REFUSED");
            StandardWorkerChannelRules.WorkerToken(run.Stage, observed.Process.Token); Gate();
            var afterPin = api.Status(slot, Gate); Budget(started, ref last);
            StandardContract.Need(afterPin.State == 4 && afterPin.ProcessId == process.ProcessId, "STANDARD_SERVICE_PID_CHANGED_AFTER_PIN");
            var admittedSnapshot = api.Inspect(slot, Gate); StandardServiceRules.Snapshot(context, role, admittedSnapshot, 3, false, complete[role].Record.Snapshot!.DescriptorSha256);
            StandardContract.Need(admittedSnapshot.Status.State == 4 && admittedSnapshot.Status.ProcessId == process.ProcessId,
                "STANDARD_SERVICE_RUNNING_CONFIG_CHANGED");
            Budget(started, ref last);
            stage = "ADMITTED_WRITE"; running.Admitted = Write(role, "ADMITTED", intent, null, admittedSnapshot, run, process);
            Gate(); Budget(started, ref last); return Result("RUNNING_HELD_TOKEN_OBSERVED_AWAITING_BOOTSTRAP", process: process);
        } catch (Exception error) { faulted = true; return Result("RETAINED_PARTIAL_OR_UNKNOWN", error, running?.Process); }
        finally { Volatile.Write(ref active, 0); }
    }
    internal StandardServiceResult CompleteRun(StandardCryptoStage runStage) {
        Enter(); Running? running = null;
        try {
            stage = "RUN_COMPLETE_ADMISSION"; StandardContract.Need(!faulted, "STANDARD_SERVICE_FAULT_RETAINED_NO_FURTHER_EFFECTS"); Gate();
            StandardContract.Need(runs.TryGetValue(runStage, out running) && running.Process is not null && running.Admitted is not null &&
                !running.CompletionAttempted, "STANDARD_SERVICE_COMPLETION_STATE_REFUSED"); running.CompletionAttempted = true;
            guard.VerifyBeforeComplete(running.Run); Gate();
            StandardContract.Need(running.Process.Wait(0) == 0, "STANDARD_SERVICE_HELD_PROCESS_NOT_EXITED");
            stage = "PROCESS_EXIT_CODE"; StandardContract.Need(running.Process.ExitCode() == 0, "STANDARD_SERVICE_PROCESS_EXIT_FAILED");
            var role = StandardServiceRules.Role(runStage); var slot = services[role]; long began = clock.MonotonicMilliseconds, last = began;
            while (true) {
                stage = "STOPPED_OBSERVATION"; Budget(began, ref last); var status = api.Status(slot, Gate); Budget(began, ref last);
                if (status.State == 1 && status.ProcessId == 0) {
                    StandardContract.Need(status.Win32Exit == 0 && status.ServiceExit == 0, "STANDARD_SERVICE_TRANSPORT_EXIT_FAILED"); break;
                }
                StandardContract.Need(status.State is 3 or 4, "STANDARD_SERVICE_STOPPED_STATE_REFUSED"); wait(25);
            }
            var snapshot = api.Inspect(slot, Gate); StandardServiceRules.Snapshot(context, role, snapshot, 3, true, complete[role].Record.Snapshot!.DescriptorSha256);
            StandardContract.Need(snapshot.Status.Win32Exit == 0 && snapshot.Status.ServiceExit == 0, "STANDARD_SERVICE_FINAL_EXIT_DRIFT");
            Budget(began, ref last);
            Read(running.Admitted); stage = "RUN_COMPLETE_WRITE"; Write(role, "RUN_COMPLETE", running.Admitted, null, snapshot, running.Run, running.Process);
            Gate(); Budget(began, ref last); running.Completed = true; return Result("SERVICE_REPORT_AND_HELD_EXIT_ADMITTED", process: running.Process);
        } catch (Exception error) { faulted = true; return Result("RETAINED_PARTIAL_OR_UNKNOWN", error, running?.Process); }
        finally { Volatile.Write(ref active, 0); }
    }
}

internal interface IStandardServiceHostBackend
{
    void RegisterHandler();
    void Status(uint state, uint acceptedControls, uint win32Exit, uint serviceExit);
}
internal interface IStandardServiceHostWork
{
    void VerifySelfAndArguments();
    void ReadOnlyBootstrap();
    void RunGrantedChannel();
    void JoinAllNativeAndTransport();
}
internal sealed record StandardServiceHostResult(bool RunningPublished, bool BootstrapEntered, bool ChannelEntered,
    bool JoinReturned, bool StoppedPublished, string? FailureStage, int? FailureHResult);
internal static class StandardServiceHostProtocol
{
    // No CNG or grant authority in this host. Bootstrap may only authenticate
    // peers and build the context. RunGrantedChannel must use the existing
    // one-use worker channel; native effects occur only in its WORK callback.
    internal static StandardServiceHostResult Run(IStandardServiceHostBackend host, IStandardServiceHostWork work) {
        bool registered = false, running = false, bootstrap = false, channel = false, joined = false, stopped = false;
        string current = "REGISTER", failureStage = ""; Exception? original = null;
        try {
            host.RegisterHandler(); registered = true; current = "SELF_ADMISSION"; host.Status(2, 0, 0, 0); work.VerifySelfAndArguments();
            current = "RUNNING_WAITING_BOOTSTRAP"; host.Status(4, 0, 0, 0); running = true;
            current = "READ_ONLY_BOOTSTRAP"; bootstrap = true; work.ReadOnlyBootstrap();
            current = "GRANTED_CHANNEL"; channel = true; work.RunGrantedChannel();
        } catch (Exception error) { original = error; failureStage = current; }
        try { work.JoinAllNativeAndTransport(); joined = true; }
        catch (Exception error) { if (original is null) { original = error; failureStage = "JOIN_RETAINED_WORK"; } }
        if (registered && joined) try { host.Status(1, 0, original is null ? 0u : 1066u, original is null ? 0u : 1u); stopped = true; }
        catch (Exception error) { if (original is null) { original = error; failureStage = "STOPPED_PUBLICATION"; } }
        return new(running, bootstrap, channel, joined, stopped, original is null ? null : failureStage, original?.HResult);
    }
}

#if COMPILE_ONLY_STANDARD_SERVICE_NATIVE_V1
// Native API compatibility is UNVERIFIED. No native entry/CLI calls this code.
// Pending synchronous SCM RPCs cannot be safely cancelled. Bound the caller's
// wait, retain the complete call/handle/input graph, poison further operations,
// and keep any late completion retained without renewed authority. This slice
// does not expose a pending-call observation/adoption or release API.
internal sealed class StandardNativeServiceApi : IStandardServiceApi
{
    private static readonly object PendingGate = new();
    private static readonly List<object> Pending = new();
    private readonly IStandardServiceGuard guard;
    private readonly IStandardServiceProcessOpener opener;
    private int unresolved;
    private sealed class Call<T> { internal Task<T>? Task; internal object Inputs; internal Call(object inputs) { Inputs = inputs; } }
    private sealed class Handle : IStandardCreatedServiceHandle
    {
        internal readonly StandardServiceContext Context; internal readonly StandardServiceRecipe Recipe;
        internal IntPtr Raw;
        internal Handle(StandardServiceHandleSlot slot) { Context = slot.Context; Recipe = slot.Recipe; }
        public void Dispose() => throw new InvalidOperationException("STANDARD_SCM_CREATED_HANDLE_RELEASE_NOT_IMPLEMENTED_RETAINED");
    }
    internal StandardNativeServiceApi(IStandardServiceGuard guard, IStandardServiceProcessOpener opener) {
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard)); this.opener = opener ?? throw new ArgumentNullException(nameof(opener));
    }
    private void Gate(StandardServiceContext c, string api, Action admission) {
        StandardContract.Need(Volatile.Read(ref unresolved) == 0, "STANDARD_SCM_PENDING_RPC_RETAINED");
        StandardServiceRules.Context(c, DateTimeOffset.UtcNow);
        StandardContract.Need(OperatingSystem.IsWindows() && RuntimeInformation.OSArchitecture == Architecture.X64 &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 && Environment.Version == new Version(10, 0, 11), "STANDARD_SCM_RUNTIME_REFUSED");
        using var impersonation = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(impersonation is null, "STANDARD_SCM_IMPERSONATION_REFUSED");
        using var process = Process.GetCurrentProcess(); StandardWorkerChannelRules.OwnerToken(StandardTokenReader.Capture(process.SafeHandle).Token);
        StandardWorkerChannelRules.OwnerToken(guard.CaptureOwnerAndVerifyCustody(c, api)); admission();
        StandardServiceRules.Context(c, DateTimeOffset.UtcNow);
        // Trusted callbacks may themselves impersonate. Re-observe the actual
        // calling thread and process after the LAST callback, immediately
        // before returning to the native boundary; a claimed token is not proof.
        using var finalImpersonation = WindowsIdentity.GetCurrent(true);
        StandardContract.Need(finalImpersonation is null, "STANDARD_SCM_POST_CALLBACK_IMPERSONATION_REFUSED");
        StandardWorkerChannelRules.OwnerToken(StandardTokenReader.Capture(process.SafeHandle).Token);
        StandardServiceRules.Context(c, DateTimeOffset.UtcNow);
    }
    private T Invoke<T>(StandardServiceContext c, string label, object inputs, Action admission, Func<T> action) {
        Gate(c, label, admission); var call = new Call<T>(inputs); lock (PendingGate) Pending.Add(call);
        call.Task = Task.Run(() => { Gate(c, label, admission); return action(); });
        bool done; try { done = call.Task.Wait(5000); } catch (AggregateException) { done = call.Task.IsCompleted; }
        if (!done) { Volatile.Write(ref unresolved, 1); throw new TimeoutException("STANDARD_SCM_RPC_TIMEOUT_RETAIN_INPUTS_HANDLES_AND_TASK"); }
        // IsCompleted was observed. Never wait indefinitely for a late result.
        return call.Task.GetAwaiter().GetResult();
    }
    private static Handle Native(StandardServiceHandleSlot slot) {
        StandardContract.Need(slot.Handle is Handle h && h.Context == slot.Context && h.Recipe == slot.Recipe && h.Raw != IntPtr.Zero,
            "STANDARD_SCM_ORIGINAL_CREATED_HANDLE_REQUIRED"); return (Handle)slot.Handle;
    }
    private static void Check(bool ok, string api) { int error = Marshal.GetLastWin32Error(); if (!ok) throw new StandardServiceNativeException(api, error); }
    private static void Size(bool first, int error, string api, uint needed, int minimum) {
        if (!first && error != 122) throw new StandardServiceNativeException(api, error);
        StandardContract.Need(!first && needed >= minimum && needed <= 65536, "STANDARD_SCM_BUFFER_SIZE_REFUSED");
    }
    private static IntPtr Manager(uint access) { IntPtr value = OpenSCManagerW(null, null, access); Check(value != IntPtr.Zero, "OpenSCManagerW"); return value; }
    public int ProbeName(StandardServiceContext c, StandardServiceRecipe recipe, Action admission) => Invoke(c, "ProbeName", recipe, admission, () => {
        StandardContract.Need(recipe == StandardServiceRules.Recipe(c, recipe.Role), "STANDARD_SCM_RECIPE_REFUSED"); IntPtr manager = Manager(1), service = IntPtr.Zero;
        try { Gate(c, "OpenServiceW.AbsenceOnly", admission); service = OpenServiceW(manager, recipe.Name, 5); int error = Marshal.GetLastWin32Error();
            if (service != IntPtr.Zero) return 0; if (error == 1060) return error; throw new StandardServiceNativeException("OpenServiceW.AbsenceOnly", error);
        } finally { if (service != IntPtr.Zero) CloseServiceHandle(service); CloseServiceHandle(manager); }
    });
    public void CreateDisabled(StandardServiceHandleSlot slot, Action verifyDurableIntent, Action admission) {
        var holder = new Handle(slot); slot.Attach(holder); // Rooted BEFORE Task/native call.
        _ = Invoke(slot.Context, "CreateServiceW", slot, admission, () => {
            IntPtr manager = Manager(3);
            try {
                verifyDurableIntent(); Gate(slot.Context, "CreateServiceW", admission);
                holder.Raw = CreateServiceW(manager, slot.Recipe.Name, slot.Recipe.Name, 0x000e0017, 16, 4, 1,
                    slot.Recipe.Command, null, IntPtr.Zero, null, slot.Recipe.Account, null);
                Check(holder.Raw != IntPtr.Zero, "CreateServiceW"); return true;
            } finally { CloseServiceHandle(manager); }
        });
    }
    public void ConfigureDisabled(StandardServiceHandleSlot slot, Action admission) => _ = Invoke(slot.Context, "ConfigureDisabled", slot, admission, () => {
        var native = Native(slot); Gate(slot.Context, "SetServiceObjectSecurity", admission);
        byte[] descriptor = StandardServiceRules.Descriptor(slot.Recipe.Role);
        Check(SetServiceObjectSecurity(native.Raw, 0x80000007, descriptor), "SetServiceObjectSecurity");
        Gate(slot.Context, "ChangeServiceConfig2W.SidType", admission); uint sid = 1;
        Check(ChangeServiceConfig2W(native.Raw, 5, ref sid), "ChangeServiceConfig2W.SidType"); return true;
    });
    public void EnableDemandStart(StandardServiceHandleSlot slot, Action admission) => _ = Invoke(slot.Context, "EnableDemandStart", slot, admission, () => {
        var native = Native(slot); Gate(slot.Context, "ChangeServiceConfigW.StartOnly", admission);
        Check(ChangeServiceConfigW(native.Raw, uint.MaxValue, 3, uint.MaxValue, null, null, IntPtr.Zero, null, null, null, null),
            "ChangeServiceConfigW.StartOnly"); return true;
    });
    public void Start(StandardServiceHandleSlot slot, StandardServiceRunContext run, Action verifyStartOriginal, Action admission) => _ = Invoke(slot.Context, "StartServiceW", (slot, run), admission, () => {
        StandardServiceRules.Run(run, slot.Context); StandardContract.Need(StandardServiceRules.Role(run.Stage) == slot.Recipe.Role, "STANDARD_SCM_START_ROLE_REFUSED");
        string[] args = { StandardWorkerChannelRules.StageName(run.Stage), run.RunId, run.Context.Scope.Attempt };
        verifyStartOriginal(); Gate(slot.Context, "StartServiceW", admission); Check(StartServiceW(Native(slot).Raw, 3, args), "StartServiceW"); return true;
    });
    private StandardServiceStatus QueryStatus(StandardServiceHandleSlot slot, Action admission) {
        Gate(slot.Context, "QueryServiceStatusEx", admission);
        Check(QueryServiceStatusEx(Native(slot).Raw, 0, out var status, (uint)Marshal.SizeOf<ServiceStatus>(), out uint needed), "QueryServiceStatusEx");
        StandardContract.Need(needed <= 8192 && status.Type == 16 && status.State is >= 1 and <= 7, "STANDARD_SCM_STATUS_SHAPE_REFUSED");
        return new(status.State, status.Pid, status.Win32Exit, status.SpecificExit);
    }
    public StandardServiceStatus Status(StandardServiceHandleSlot slot, Action admission) => Invoke(slot.Context, "QueryServiceStatusEx", slot, admission, () => QueryStatus(slot, admission));
    private T Config2<T>(StandardServiceHandleSlot slot, uint level, int minimum, Action admission, Func<IntPtr, int, T> read) {
        Gate(slot.Context, "QueryServiceConfig2W.Size", admission); bool first = QueryServiceConfig2W(Native(slot).Raw, level, IntPtr.Zero, 0, out uint needed);
        int error = Marshal.GetLastWin32Error(); Size(first, error, "QueryServiceConfig2W.Size", needed, minimum);
        IntPtr buffer = Marshal.AllocHGlobal((int)needed);
        try { Gate(slot.Context, "QueryServiceConfig2W.Data", admission); Check(QueryServiceConfig2W(Native(slot).Raw, level, buffer, needed, out _), "QueryServiceConfig2W.Data"); return read(buffer, (int)needed); }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    private static string String(IntPtr pointer, IntPtr buffer, int length, bool optional = false) {
        if (optional && pointer == IntPtr.Zero) return "";
        long offset = pointer.ToInt64() - buffer.ToInt64(); StandardContract.Need(pointer != IntPtr.Zero && offset >= 0 && offset % 2 == 0 && offset <= length - 2,
            "STANDARD_SCM_STRING_POINTER_REFUSED"); var value = new StringBuilder();
        for (int i = 0; i <= 4096 && offset + (long)i * 2 + 2 <= length; i++) { char c = (char)Marshal.ReadInt16(pointer, i * 2); if (c == '\0') return value.ToString(); value.Append(c); }
        throw new InvalidDataException("STANDARD_SCM_STRING_LENGTH_REFUSED");
    }
    public StandardServiceSnapshot Inspect(StandardServiceHandleSlot slot, Action admission) => Invoke<StandardServiceSnapshot>(slot.Context, "InspectOriginalService", slot, admission, () => {
        var native = Native(slot); Gate(slot.Context, "QueryServiceConfigW.Size", admission); bool first = QueryServiceConfigW(native.Raw, IntPtr.Zero, 0, out uint needed);
        int error = Marshal.GetLastWin32Error(); Size(first, error, "QueryServiceConfigW.Size", needed, Marshal.SizeOf<ServiceConfig>());
        IntPtr buffer = Marshal.AllocHGlobal((int)needed);
        ServiceConfig config; StandardServiceRecipe observed;
        try {
            Gate(slot.Context, "QueryServiceConfigW.Data", admission); Check(QueryServiceConfigW(native.Raw, buffer, needed, out _), "QueryServiceConfigW.Data");
            config = Marshal.PtrToStructure<ServiceConfig>(buffer);
            StandardContract.Need(String(config.Group, buffer, (int)needed, true) == "" && config.Tag == 0 &&
                String(config.Dependencies, buffer, (int)needed, true) == "" && String(config.Display, buffer, (int)needed) == slot.Recipe.Name,
                "STANDARD_SCM_EXTRA_START_CONFIGURATION_REFUSED");
            observed = slot.Recipe with { Command = String(config.Path, buffer, (int)needed), Account = String(config.Account, buffer, (int)needed) };
        } finally { Marshal.FreeHGlobal(buffer); }
        uint sid = Config2(slot, 5, 4, admission, (p, _) => unchecked((uint)Marshal.ReadInt32(p)));
        uint triggers = Config2(slot, 8, Marshal.SizeOf<TriggerInfo>(), admission, (p, _) => Marshal.PtrToStructure<TriggerInfo>(p).Count);
        uint failures = Config2(slot, 2, Marshal.SizeOf<FailureActions>(), admission, (p, _) => {
            var f = Marshal.PtrToStructure<FailureActions>(p); StandardContract.Need(f.Reboot == IntPtr.Zero && f.Command == IntPtr.Zero, "STANDARD_SCM_RECOVERY_COMMAND_REFUSED"); return f.Count;
        });
        bool nonCrash = Config2(slot, 4, 4, admission, (p, _) => Marshal.ReadInt32(p) != 0);
        bool delayed = Config2(slot, 3, 4, admission, (p, _) => Marshal.ReadInt32(p) != 0);
        uint launch = Config2(slot, 12, 4, admission, (p, _) => unchecked((uint)Marshal.ReadInt32(p)));
        Gate(slot.Context, "QueryServiceObjectSecurity.Size", admission); first = QueryServiceObjectSecurity(native.Raw, 7, null, 0, out needed); error = Marshal.GetLastWin32Error();
        Size(first, error, "QueryServiceObjectSecurity.Size", needed, 20); byte[] descriptor = new byte[needed];
        Gate(slot.Context, "QueryServiceObjectSecurity.Data", admission); Check(QueryServiceObjectSecurity(native.Raw, 7, descriptor, needed, out _), "QueryServiceObjectSecurity.Data");
        return new(observed, config.Type, config.Start, config.Error, sid, triggers, failures, nonCrash, delayed, launch,
            StandardServiceRules.Descriptor(descriptor, slot.Recipe.Role), QueryStatus(slot, admission));
    });
    public IStandardChannelProcessLease OpenRunning(StandardServiceHandleSlot slot, uint pid, long earliest, long latest, Action admission) {
        Gate(slot.Context, "OpenObservedRunningProcess", admission);
        var before = Status(slot, admission); StandardContract.Need(before.State == 4 && before.ProcessId == pid && pid > 0, "STANDARD_SCM_RUNNING_PID_REQUIRED");
        // No default/fabricated opener. Root integration must implement actual
        // held native process ownership separately; an observation-only reader
        // cannot satisfy this API or establish code/bootstrap association.
        return opener.OpenRunning(pid, earliest, latest, () => Gate(slot.Context, "OpenObservedRunningProcess", admission));
    }
    [StructLayout(LayoutKind.Sequential)] private struct ServiceConfig { internal uint Type, Start, Error; internal IntPtr Path, Group; internal uint Tag; internal IntPtr Dependencies, Account, Display; }
    [StructLayout(LayoutKind.Sequential)] private struct ServiceStatus { internal uint Type, State, Accepted, Win32Exit, SpecificExit, Checkpoint, WaitHint, Pid, Flags; }
    [StructLayout(LayoutKind.Sequential)] private struct TriggerInfo { internal uint Count; internal IntPtr Triggers, Reserved; }
    [StructLayout(LayoutKind.Sequential)] private struct FailureActions { internal uint Reset; internal IntPtr Reboot, Command; internal uint Count; internal IntPtr Actions; }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenSCManagerW(string? machine, string? database, uint access);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenServiceW(IntPtr manager, string name, uint access);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseServiceHandle(IntPtr value);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateServiceW(IntPtr manager, string name, string display, uint access, uint type, uint start, uint error,
        string command, string? group, IntPtr tag, string? dependencies, string account, string? password);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetServiceObjectSecurity(IntPtr service, uint information, byte[] descriptor);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceObjectSecurity(IntPtr service, uint information, [Out] byte[]? descriptor, uint length, out uint needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool ChangeServiceConfig2W(IntPtr service, uint level, ref uint value);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool ChangeServiceConfigW(IntPtr service, uint type, uint start, uint error,
        string? command, string? group, IntPtr tag, string? dependencies, string? account, string? password, string? display);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool StartServiceW(IntPtr service, uint count,
        [In, MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPWStr, SizeParamIndex = 1)] string[] arguments);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceStatusEx(IntPtr service, uint level, out ServiceStatus status, uint length, out uint needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceConfigW(IntPtr service, IntPtr config, uint length, out uint needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceConfig2W(IntPtr service, uint level, IntPtr buffer, uint length, out uint needed);
}
#endif
