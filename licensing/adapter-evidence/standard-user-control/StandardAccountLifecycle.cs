using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardAccountContext(StandardCryptoScope Scope, string SourceSetSha256, string Effects);
// NetUserFlags uses NetAPI USER_INFO_23/1008 UF_* encoding, never SAMR
// UserAccountControl. A SAM backend must explicitly convert known bits and
// refuse unknown bits; disabled=2/normal=0x200 here are NOT SAM's 1/0x10.
internal sealed record StandardAccountSnapshot(string Name, string Sid, string PrincipalSource, bool Enabled,
    uint NetUserFlags, bool GroupsComplete, IReadOnlyList<string> LocalGroupSids);
internal sealed record StandardAccountRecord(string Schema, StandardAccountContext Context, string Kind,
    DateTimeOffset WrittenUtc, string? PreviousSha256, StandardAccountSnapshot Snapshot);
internal sealed record StandardAccountOriginal(StandardAccountRecord Record, StandardStoreFile File,
    string OriginalSha256, StandardStoreReceipt Receipt);
internal sealed record StandardAccountFailure(string Stage, string Category, int ManagedHResult,
    int? Win32Error, bool AccountMutationCallEntered, bool DurableWriteCallEntered,
    bool AccountStateMayHaveChanged, bool RecordEffectMayExist, bool HandleReleaseUnconfirmed);
internal sealed record StandardAccountResult(string Outcome, StandardAccountSnapshot? Observed,
    IReadOnlyList<StandardAccountOriginal> Originals, StandardAccountFailure? Failure)
{
    public bool NativeExecutionProven => false;
    public bool LogonProven => false;
    public bool SessionsEndedProven => false;
    public bool Lic008Closed => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

// No name-addressed mutation backend is supplied here. A native implementation
// must bind the actual owned local SID to an open SAM user object, retain that
// object through read/change/readback, and preserve all flags except DISABLE.
// Rechecking a name then NetUserSetInfo(name) does not establish that binding.
internal interface IStandardOwnedAccountLease : IDisposable
{
    StandardAccountSnapshot Inspect();
    // Internally validate full SID/name/local/groups and expected flags on the
    // bound SAM handle, run admission WITHOUT lease reentry, revalidate that
    // handle's state, change only DISABLE, and read back on that same handle.
    // NetUserFlags requires explicit UF_* conversion; SAM bits are different.
    void SetNetUserFlags(uint expectedFlags, uint newFlags, Action verifyOriginalsAndAdmission);
}
internal interface IStandardAccountBackend
{
    // Root native domain/user handles before any call can leave an unreturned
    // partial object. The lifecycle cannot retain an adapter-local lost handle.
    IStandardOwnedAccountLease OpenOwnedLocalSid(string exactSid, Action admission);
}
internal interface IStandardAccountGuard
{
    // Actual owner token, host/boot/source/runtime custody and live confirmation
    // are supplied by the future full controller, not a serialized account field.
    StandardToken CaptureOwnerAndVerifyCustody(StandardAccountContext context, string stage);
    // Must independently admit actual Guardian-before originals/key chain and
    // the durable fresh logon recipe/intent before making the account available.
    void VerifyBeforeActivation(StandardAccountContext context);
    // Must independently bind the exact owned credentialed child to its admitted
    // logon original and observe exit on its original held handle. Disabling an
    // account is not a logoff or proof that its sessions have ended.
    void VerifyBeforeReturnDisabled(StandardAccountContext context);
}

internal static class StandardAccountRules
{
    internal const string Schema = "TEST_ONLY_STANDARD_ACCOUNT_LIFECYCLE_RECORD_V1";
    internal const uint DisabledFlag = 2;
    internal static void Context(StandardAccountContext? c, DateTimeOffset now)
    {
        StandardContract.Need(c is not null && StandardNativeCryptoRules.Hex(c.SourceSetSha256, 64) &&
            c.Effects == StandardInputCodec.Effects, "STANDARD_ACCOUNT_CONTEXT_REFUSED");
        StandardStoreRules.Scope(c.Scope, now);
    }
    internal static StandardAccountSnapshot Snapshot(StandardAccountSnapshot? s, bool enabled, uint? baselineFlags = null)
    {
        StandardContract.Need(s is not null && s.LocalGroupSids is { Count: >= 0 and <= 1024 }, "STANDARD_ACCOUNT_GROUP_CAPTURE_REFUSED");
        s = s with { LocalGroupSids = Array.AsReadOnly(s.LocalGroupSids.ToArray()) };
        StandardContract.Need(s.Name == StandardContract.AccountName && s.Sid == StandardContract.UserSid &&
            s.PrincipalSource == "Local" && s.Enabled == enabled && s.GroupsComplete && s.LocalGroupSids is { Count: 1 } &&
            s.LocalGroupSids[0] == "S-1-5-32-545" && (s.NetUserFlags & DisabledFlag) == (enabled ? 0u : DisabledFlag) &&
            (s.NetUserFlags & 0x200) != 0 && (s.NetUserFlags & ~0x10203u) == 0 &&
            (baselineFlags is null || (s.NetUserFlags & ~DisabledFlag) == (baselineFlags.Value & ~DisabledFlag)),
            "STANDARD_ACCOUNT_SNAPSHOT_REFUSED");
        return s;
    }
    internal static StandardStoreFile File(string kind) => kind switch {
        "ACTIVATION_INTENT" => StandardStoreFile.AccountActivationIntent,
        "ACTIVATED" => StandardStoreFile.AccountActivated,
        "DISABLE_INTENT" => StandardStoreFile.AccountDisableIntent,
        "DISABLED" => StandardStoreFile.AccountDisabled,
        _ => throw new InvalidDataException("STANDARD_ACCOUNT_RECORD_KIND_REFUSED")
    };
}

// Single live instance only; there is no serialized resume/recovery authority.
// On partial/unknown failure the owned lease and evidence remain retained. No
// finally path enables/disables, resets a password, removes a profile/account,
// changes membership or terminates/logs off a process. ReturnDisabled is an
// explicit success-sequence operation with a separately verified exit guard.
internal sealed class StandardAccountLifecycle
{
    private static readonly object retainedGate = new();
    private static readonly HashSet<StandardAccountLifecycle> retained = new();
    private readonly StandardAccountContext context;
    private readonly IStandardDurableRecordSink store;
    private readonly IStandardAccountBackend backend;
    private readonly IStandardAccountGuard guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly List<StandardAccountOriginal> originals = new();
    private readonly Dictionary<StandardStoreFile, byte[]> bytes = new();
    private IStandardOwnedAccountLease? owned;
    private StandardAccountSnapshot? initial, observed;
    private DateTimeOffset? lastUtc;
    private int state;
    private string stage = "ADMISSION";
    private bool mutationEntered, writeEntered, releaseUnconfirmed;
    internal StandardAccountLifecycle(StandardAccountContext context, IStandardDurableRecordSink store,
        IStandardAccountBackend backend, IStandardAccountGuard guard, Func<DateTimeOffset> utcNow)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.store = store ?? throw new ArgumentNullException(nameof(store));
        this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
    }
    private void Gate()
    {
        DateTimeOffset before = utcNow(); StandardAccountRules.Context(context, before);
        StandardWorkerChannelRules.OwnerToken(guard.CaptureOwnerAndVerifyCustody(context, stage));
        DateTimeOffset after = utcNow(); StandardAccountRules.Context(context, after);
        StandardContract.Need(after >= before && (lastUtc is null || before >= lastUtc), "STANDARD_ACCOUNT_CLOCK_ROLLBACK");
        lastUtc = after;
    }
    private void OwnershipOriginals()
    {
        Gate(); byte[] suppliedOwned = store.Read(StandardStoreFile.AccountOwned);
        StandardContract.Need(suppliedOwned is { Length: > 0 and <= 16384 }, "STANDARD_ACCOUNT_OWNED_ORIGINAL_MISSING");
        byte[] copyOwned = (byte[])suppliedOwned.Clone(); Gate();
        byte[] suppliedComplete = store.Read(StandardStoreFile.AccountComplete);
        StandardContract.Need(suppliedComplete is { Length: > 0 and <= 16384 }, "STANDARD_ACCOUNT_COMPLETE_ORIGINAL_MISSING");
        byte[] copyComplete = (byte[])suppliedComplete.Clone();
        // These fixed original hashes bind the independently reviewed Nov2
        // ownership/completion records for disabled Local SID1023/Users545 only.
        // They are not a general "adopt account by matching display name" path.
        StandardContract.Need(StandardNativeCryptoRules.Hash(copyOwned) == context.Scope.AccountOwnedSha256 &&
            StandardNativeCryptoRules.Hash(copyComplete) == context.Scope.AccountCompleteSha256,
            "STANDARD_ACCOUNT_OWNERSHIP_ORIGINAL_CHANGED"); Gate();
    }
    private StandardAccountSnapshot Inspect(bool enabled)
    {
        Gate(); StandardContract.Need(owned is not null, "STANDARD_ACCOUNT_OWNED_LEASE_MISSING");
        StandardAccountSnapshot result = StandardAccountRules.Snapshot(owned.Inspect(), enabled, initial?.NetUserFlags);
        Gate(); observed = result; return result;
    }
    private void VerifyJournal()
    {
        foreach (var original in originals) {
            Gate(); byte[] supplied = store.Read(original.File);
            StandardContract.Need(supplied is not null && supplied.AsSpan().SequenceEqual(bytes[original.File]) &&
                StandardNativeCryptoRules.Hash(supplied) == original.OriginalSha256, "STANDARD_ACCOUNT_JOURNAL_CHANGED"); Gate();
        }
    }
    private StandardAccountOriginal Write(string kind, StandardAccountSnapshot snapshot)
    {
        Gate(); DateTimeOffset written = utcNow(); StandardAccountRules.Context(context, written);
        StandardContract.Need(lastUtc is null || written >= lastUtc, "STANDARD_ACCOUNT_JOURNAL_CLOCK_ROLLBACK");
        StandardContract.Need(originals.Count == 0 || written > originals[^1].Receipt.WrittenUtc,
            "STANDARD_ACCOUNT_JOURNAL_TIME_NOT_INCREASING");
        var record = new StandardAccountRecord(StandardAccountRules.Schema, context, kind, written,
            originals.Count == 0 ? null : originals[^1].OriginalSha256, snapshot);
        StandardStoreFile file = StandardAccountRules.File(kind); byte[] originalBytes = JsonSerializer.SerializeToUtf8Bytes(record);
        writeEntered = true; StandardStoreReceipt receipt = store.WriteNew(file, (byte[])originalBytes.Clone()); Gate();
        StandardKeyCreationRules.Receipt(new(context.Scope, context.SourceSetSha256), file, originalBytes, receipt, written, utcNow());
        StandardContract.Need(!originals.Any(x => x.Receipt.VolumeSerial == receipt.VolumeSerial && x.Receipt.FileIndex == receipt.FileIndex),
            "STANDARD_ACCOUNT_FILE_ID_REUSED");
        var value = new StandardAccountOriginal(record, file, receipt.Sha256, receipt);
        bytes.Add(file, originalBytes); originals.Add(value); VerifyJournal(); return value;
    }
    private void MutationEvidence(bool currentlyEnabled)
    {
        OwnershipOriginals(); VerifyJournal(); Gate();
        if (!currentlyEnabled) { guard.VerifyBeforeActivation(context); Gate(); }
        else { guard.VerifyBeforeReturnDisabled(context); Gate(); }
    }
    private void ImmediatelyBeforeMutation(bool currentlyEnabled)
    {
        MutationEvidence(currentlyEnabled); Inspect(currentlyEnabled); Gate();
    }
    private StandardAccountResult Result(string outcome, StandardAccountFailure? failure = null) =>
        new(outcome, observed, Array.AsReadOnly(originals.ToArray()), failure);
    private StandardAccountResult Failed(Exception error)
    {
        Interlocked.Exchange(ref state, 5);
        return Result("RETAINED_PARTIAL_OR_UNKNOWN", new(stage, error.GetType().Name, error.HResult,
            error is Win32Exception native ? native.NativeErrorCode : null, mutationEntered, writeEntered,
            mutationEntered, writeEntered, releaseUnconfirmed));
    }
    internal StandardAccountResult Activate()
    {
        StandardContract.Need(Interlocked.CompareExchange(ref state, 1, 0) == 0, "STANDARD_ACCOUNT_INSTANCE_ALREADY_CONSUMED");
        // Retain BEFORE opening: an adapter failure can leave an unreturned
        // native object; it is never safe to manufacture a no-effect receipt.
        lock (retainedGate) retained.Add(this);
        try {
            OwnershipOriginals(); stage = "PRE_ACTIVATION_EVIDENCE"; Gate(); guard.VerifyBeforeActivation(context); Gate();
            stage = "OPEN_OWNED_LOCAL_SID"; owned = backend.OpenOwnedLocalSid(StandardContract.UserSid, Gate);
            stage = "INITIAL_DISABLED_READBACK"; initial = Inspect(false);
            stage = "ACTIVATION_INTENT"; Write("ACTIVATION_INTENT", initial);
            stage = "ENABLE_OWNED_ACCOUNT"; ImmediatelyBeforeMutation(false); mutationEntered = true;
            owned.SetNetUserFlags(initial.NetUserFlags, initial.NetUserFlags & ~StandardAccountRules.DisabledFlag, () => MutationEvidence(false));
            stage = "ACTIVATED_READBACK"; var active = Inspect(true);
            stage = "ACTIVATED_ORIGINAL"; Write("ACTIVATED", active);
            var result = Result("OWNED_ACCOUNT_ACTIVATION_RECORDED");
            Interlocked.Exchange(ref state, 2); return result;
        } catch (Exception error) { return Failed(error); }
    }
    internal StandardAccountResult ReturnDisabled()
    {
        StandardContract.Need(Interlocked.CompareExchange(ref state, 3, 2) == 2, "STANDARD_ACCOUNT_RETURN_REQUIRES_LIVE_ACTIVATION");
        try {
            stage = "PRE_RETURN_HELD_EXIT_EVIDENCE"; OwnershipOriginals(); VerifyJournal();
            guard.VerifyBeforeReturnDisabled(context); Gate(); var active = Inspect(true);
            stage = "DISABLE_INTENT"; Write("DISABLE_INTENT", active);
            stage = "DISABLE_OWNED_ACCOUNT"; ImmediatelyBeforeMutation(true);
            // Recheck the independently held exit proof immediately before the
            // explicit declared return effect, not only before writing intent.
            guard.VerifyBeforeReturnDisabled(context); Gate(); mutationEntered = true;
            owned!.SetNetUserFlags(active.NetUserFlags, initial!.NetUserFlags, () => {
                MutationEvidence(true);
            });
            stage = "DISABLED_READBACK"; var disabled = Inspect(false);
            stage = "DISABLED_ORIGINAL"; Write("DISABLED", disabled);
            stage = "RELEASE_CONFIRMED_DISABLED_ACCOUNT_LEASE";
            try { owned.Dispose(); owned = null; } catch { releaseUnconfirmed = true; throw; }
            lock (retainedGate) retained.Remove(this);
            Interlocked.Exchange(ref state, 4); return Result("OWNED_ACCOUNT_RETURN_DISABLED_RECORDED");
        } catch (Exception error) { return Failed(error); }
    }
}
