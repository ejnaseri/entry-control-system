using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardServiceStoreAttempt(StandardServiceJournalFile File, string Sha256, int Length,
    bool WriteEntered, bool ReceiptAdmitted, bool ReadbackAdmitted);

// Concrete mapping to the protected store, not a disk backend or a physical
// service collector. The backing store still independently enforces its role,
// actual object identities, atomic creation, durable flush and live authority.
internal sealed class StandardServiceStoreJournal : IStandardServiceJournalSink
{
    private static readonly object retainedGate = new();
    private static readonly HashSet<StandardServiceStoreJournal> retained = new();
    private readonly StandardServiceContext context;
    private readonly IStandardDurableRecordSink store;
    private readonly IStandardServiceGuard guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly object gate = new();
    private readonly Dictionary<StandardServiceJournalFile, byte[]> originals = new();
    private readonly Dictionary<StandardServiceJournalFile, StandardServiceStoreAttempt> attempts = new();
    private readonly Dictionary<StandardServiceJournalFile, StandardServiceJournalReceipt> receipts = new();
    private bool busy, faulted;
    private DateTimeOffset? lastUtc;
    internal StandardServiceStoreJournal(StandardServiceContext context, IStandardDurableRecordSink store,
        IStandardServiceGuard guard, Func<DateTimeOffset> utcNow)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.store = store ?? throw new ArgumentNullException(nameof(store));
        this.guard = guard ?? throw new ArgumentNullException(nameof(guard));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
    }
    internal static StandardStoreFile Map(StandardServiceJournalFile file) => file switch {
        StandardServiceJournalFile.SetupIntent => StandardStoreFile.ServiceSetupIntent,
        StandardServiceJournalFile.SetupOwned => StandardStoreFile.ServiceSetupOwned,
        StandardServiceJournalFile.SetupComplete => StandardStoreFile.ServiceSetupComplete,
        StandardServiceJournalFile.GuardianIntent => StandardStoreFile.ServiceGuardianIntent,
        StandardServiceJournalFile.GuardianOwned => StandardStoreFile.ServiceGuardianOwned,
        StandardServiceJournalFile.GuardianComplete => StandardStoreFile.ServiceGuardianComplete,
        StandardServiceJournalFile.SetupStart => StandardStoreFile.ServiceSetupStart,
        StandardServiceJournalFile.SetupAdmitted => StandardStoreFile.ServiceSetupAdmitted,
        StandardServiceJournalFile.SetupRunComplete => StandardStoreFile.ServiceSetupRunComplete,
        StandardServiceJournalFile.GuardianBeforeStart => StandardStoreFile.ServiceGuardianBeforeStart,
        StandardServiceJournalFile.GuardianBeforeAdmitted => StandardStoreFile.ServiceGuardianBeforeAdmitted,
        StandardServiceJournalFile.GuardianBeforeComplete => StandardStoreFile.ServiceGuardianBeforeComplete,
        StandardServiceJournalFile.GuardianAfterStart => StandardStoreFile.ServiceGuardianAfterStart,
        StandardServiceJournalFile.GuardianAfterAdmitted => StandardStoreFile.ServiceGuardianAfterAdmitted,
        StandardServiceJournalFile.GuardianAfterComplete => StandardStoreFile.ServiceGuardianAfterComplete,
        _ => throw new InvalidDataException("STANDARD_SERVICE_STORE_FILE_REFUSED")
    };
    private void Time() {
        var now = utcNow(); StandardServiceRules.Context(context, now);
        StandardContract.Need(lastUtc is null || now >= lastUtc.Value, "STANDARD_SERVICE_STORE_CLOCK_ROLLBACK"); lastUtc = now;
    }
    private void Gate(string stage) {
        Time(); StandardWorkerChannelRules.OwnerToken(guard.CaptureOwnerAndVerifyCustody(context, stage)); Time();
    }
    private byte[] Canonical(StandardServiceJournalFile file, byte[]? supplied)
    {
        StandardContract.Need(supplied is { Length: > 0 } && supplied.Length <= StandardStoreRules.JsonMaximum,
            "STANDARD_SERVICE_STORE_ORIGINAL_SIZE_REFUSED");
        byte[] raw = (byte[])supplied.Clone(); StandardStoreRules.Content(Map(file), raw);
        var record = JsonSerializer.Deserialize<StandardServiceJournalRecord>(raw, new JsonSerializerOptions {
            MaxDepth = 32, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow });
        StandardContract.Need(record is not null && record.Schema == StandardServiceRules.Schema && record.Context == context &&
            record.WrittenUtc.Offset == TimeSpan.Zero && record.WrittenUtc >= context.Scope.IssuedUtc &&
            record.WrittenUtc < context.Scope.ExpiresUtc && record.WrittenUtc <= utcNow() &&
            StandardServiceRules.File(record.Role, record.Kind, record.Run?.Stage) == file,
            "STANDARD_SERVICE_STORE_RECORD_BINDING_REFUSED");
        if (record.Run is not null) StandardServiceRules.Run(record.Run, context);
        StandardContract.Need(raw.AsSpan().SequenceEqual(JsonSerializer.SerializeToUtf8Bytes(record)), "STANDARD_SERVICE_STORE_CANONICAL_REQUIRED");
        return raw;
    }
    public StandardServiceJournalReceipt WriteNew(StandardServiceJournalFile file, byte[] original)
    {
        lock (gate) {
            StandardContract.Need(!busy && !faulted && !attempts.ContainsKey(file), "STANDARD_SERVICE_STORE_WRITE_STATE_REFUSED"); busy = true;
            try {
                Gate("SERVICE_JOURNAL_BEFORE_WRITE"); byte[] raw = Canonical(file, original);
                string hash = StandardStoreRules.Hash(raw); originals.Add(file, raw);
                attempts.Add(file, new(file, hash, raw.Length, false, false, false));
                lock (retainedGate) retained.Add(this); // before any possible backing-store effect
                Gate("SERVICE_JOURNAL_IMMEDIATELY_BEFORE_WRITE");
                attempts[file] = attempts[file] with { WriteEntered = true };
                var receipt = store.WriteNew(Map(file), (byte[])raw.Clone()); Gate("SERVICE_JOURNAL_AFTER_WRITE");
                StandardContract.Need(receipt is not null && receipt.Scope == context.Scope && receipt.File == Map(file) &&
                    receipt.Sha256 == hash && receipt.Length == raw.Length && receipt.WrittenUtc.Offset == TimeSpan.Zero &&
                    receipt.WrittenUtc >= context.Scope.IssuedUtc && receipt.WrittenUtc < context.Scope.ExpiresUtc && receipt.WrittenUtc <= utcNow() &&
                    receipt.VolumeSerial != 0 && receipt.FileIndex != 0 && StandardStoreRules.CreatedInWindow(receipt.CreationFileTimeUtc, context.Scope, receipt.WrittenUtc) &&
                    receipt.CreateNew && receipt.Protected && receipt.DurablyFlushed && receipt.ExactReadback &&
                    !receipts.Values.Any(x => x.VolumeSerial == receipt.VolumeSerial && x.FileIndex == receipt.FileIndex),
                    "STANDARD_SERVICE_STORE_RECEIPT_REFUSED");
                var record = JsonSerializer.Deserialize<StandardServiceJournalRecord>(raw)!;
                StandardContract.Need(receipt.CreationFileTimeUtc >= record.WrittenUtc.UtcDateTime.ToFileTimeUtc() && receipt.WrittenUtc >= record.WrittenUtc,
                    "STANDARD_SERVICE_STORE_RECEIPT_PREDATES_RECORD");
                attempts[file] = attempts[file] with { ReceiptAdmitted = true };
                byte[] observed = store.Read(Map(file)); Gate("SERVICE_JOURNAL_AFTER_READBACK");
                StandardContract.Need(observed is not null && observed.AsSpan().SequenceEqual(raw), "STANDARD_SERVICE_STORE_READBACK_CHANGED");
                var result = new StandardServiceJournalReceipt(context, file, hash, receipt.Length, receipt.WrittenUtc,
                    receipt.VolumeSerial, receipt.FileIndex, receipt.CreationFileTimeUtc, true, true, true, true);
                receipts.Add(file, result); attempts[file] = attempts[file] with { ReadbackAdmitted = true }; return result;
            } catch { faulted = true; throw; }
            finally { busy = false; }
        }
    }
    public byte[] Read(StandardServiceJournalFile file)
    {
        lock (gate) {
            StandardContract.Need(!busy && receipts.ContainsKey(file), "STANDARD_SERVICE_STORE_READ_ORIGINAL_REQUIRED"); busy = true;
            try {
                // Read-only access to a previously completed original may remain
                // useful after a later write fails; it grants no new stage.
                Gate("SERVICE_JOURNAL_BEFORE_READ"); byte[] actual = store.Read(Map(file)); Gate("SERVICE_JOURNAL_AFTER_READ");
                StandardContract.Need(actual is not null && actual.AsSpan().SequenceEqual(originals[file]), "STANDARD_SERVICE_STORE_ORIGINAL_CHANGED");
                return (byte[])actual.Clone();
            } catch { faulted = true; throw; }
            finally { busy = false; }
        }
    }
    // Synchronous backing calls can hold this lock. A future bounded caller
    // must retain the entire pending operation and not call Evidence on timeout.
    internal StandardServiceStoreAttempt[] Evidence() { lock (gate) return attempts.Values.ToArray(); }
    internal bool NativeEvidenceEstablished => false;
}
