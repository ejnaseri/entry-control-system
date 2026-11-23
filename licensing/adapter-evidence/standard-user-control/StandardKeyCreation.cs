using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.StandardUserControl;

internal sealed record StandardKeyCreationContext(StandardCryptoScope Scope, string SourceSetSha256);
internal sealed record StandardKeyCreationRecord(string Schema, StandardKeyCreationContext Context,
    StandardCryptoArm Arm, string Kind, string KeyName, DateTimeOffset WrittenUtc,
    string? PreviousSha256, string? PublicSha256, string? DescriptorSha256, string? OtherOwnedSha256);
internal sealed record StandardKeyNameObservation(string KeyName, string Outcome, int? NativeStatus);
internal sealed record StandardKeyCreatedOriginal(StandardKeyCreationRecord Record,
    StandardStoreFile File, string OriginalSha256, StandardStoreReceipt Receipt);
internal sealed record StandardKeyCreationFailure(StandardCryptoArm? Arm, string Stage,
    string Category, int ManagedHResult, int? NativeStatus, string? NativeStage, bool CreateCallEntered,
    bool DurableWriteCallEntered, bool PersistedKeyEffectMayExist, bool PersistedRecordEffectMayExist,
    bool HandleReleaseUnconfirmed);
internal sealed record StandardKeyCreationResult(string Outcome,
    StandardNativeKeyReadback? Restricted, StandardNativeKeyReadback? Accessible,
    IReadOnlyList<StandardKeyCreatedOriginal> Originals, StandardKeyCreationFailure? Failure)
{
    // A backend/store injection result is not an independent native collector.
    public bool NativeExecutionProven => false;
    public bool Lic008Closed => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

internal interface IStandardKeyCreationHandle : IDisposable
{
    StandardNativeKeyReadback Inspect();
}
internal interface IStandardKeyCreationBackend
{
    StandardKeyNameObservation ProbeName(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate);
    IStandardKeyCreationHandle CreateFresh(StandardKeyCreationContext context, StandardCryptoArm arm,
        Action verifyDurableIntent, Action gate);
    IStandardKeyCreationHandle ReopenCreated(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate);
}
internal sealed class StandardKeyCreationNativeException : CryptographicException
{
    internal int NativeStatus { get; }
    internal string NativeStage { get; }
    internal StandardKeyCreationNativeException(string stage, int status) : base(status) {
        NativeStage = stage; NativeStatus = status;
    }
}

internal static class StandardKeyCreationRules
{
    internal const string Schema = "TEST_ONLY_STANDARD_KEY_CREATION_RECORD_V1";
    internal static void Require(StandardKeyCreationContext? context, DateTimeOffset now)
    {
        StandardContract.Need(context is not null && StandardNativeCryptoRules.Hex(context.SourceSetSha256, 64),
            "STANDARD_CREATE_SOURCE_BINDING_REFUSED");
        // Shared scope/window validation; no fabricated pre-creation public or
        // descriptor identity is needed to admit this record context.
        StandardStoreRules.Scope(context.Scope, now);
    }

    internal static void SetupToken(StandardToken? token)
    {
        StandardContract.Need(token is not null && token.QueryComplete && token.Type == 1 &&
            token.User == StandardCryptoComparison.SystemSid && token.Owner == StandardCryptoComparison.SystemSid &&
            token.Elevation == 1 && token.ElevationType == 1 &&
            token.IntegritySid == StandardCryptoComparison.SystemIntegritySid &&
            !token.HasRestrictions && !token.AppContainer && token.Groups is { Count: >= 2 and <= 1024 },
            "STANDARD_CREATE_SETUP_TOKEN_REFUSED");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        bool setup = false, service = false;
        foreach (var group in token.Groups) {
            StandardContract.Need(group is not null && StandardIdentity.CanonicalSid(group.Sid) && seen.Add(group.Sid) &&
                group.Sid is not (StandardContract.Interactive or "S-1-5-2" or "S-1-5-3"),
                "STANDARD_CREATE_SETUP_GROUP_REFUSED");
            if (group.Sid == StandardCryptoComparison.SetupSid || group.Sid == StandardCryptoComparison.ServiceLogonSid) {
                StandardContract.Need((group.Attributes & 4) != 0 && (group.Attributes & 16) == 0,
                    "STANDARD_CREATE_SETUP_GROUP_DISABLED");
                if (group.Sid == StandardCryptoComparison.SetupSid) setup = true; else service = true;
            }
        }
        StandardContract.Need(setup && service &&
            StandardCryptoComparison.DerivedServiceSid(StandardContract.SetupService) == StandardCryptoComparison.SetupSid &&
            StandardCryptoComparison.DerivedServiceSid(StandardContract.GuardianService) == StandardCryptoComparison.GuardianSid,
            "STANDARD_CREATE_SETUP_SERVICE_MISSING");
    }

    internal static void Gate(StandardKeyCreationContext context, Func<DateTimeOffset> utcNow,
        Func<StandardToken> captureSetupRoleAndVerifyCustody)
    {
        Require(context, utcNow());
        StandardToken token;
        try { token = captureSetupRoleAndVerifyCustody(); }
        catch { throw new InvalidDataException("STANDARD_CREATE_ROLE_OR_CUSTODY_GUARD_REFUSED"); }
        SetupToken(token);
        Require(context, utcNow());
    }

    internal static string Name(StandardKeyCreationContext context, StandardCryptoArm arm) =>
        StandardCryptoComparison.KeyName(context.Scope.Attempt, arm);
    internal static StandardStoreFile File(StandardCryptoArm arm, string kind) => (arm, kind) switch {
        (StandardCryptoArm.Restricted, "INTENT") => StandardStoreFile.RestrictedIntent,
        (StandardCryptoArm.Restricted, "OWNED") => StandardStoreFile.RestrictedOwned,
        (StandardCryptoArm.Restricted, "COMPLETE") => StandardStoreFile.RestrictedComplete,
        (StandardCryptoArm.UserAccessible, "INTENT") => StandardStoreFile.AccessibleIntent,
        (StandardCryptoArm.UserAccessible, "OWNED") => StandardStoreFile.AccessibleOwned,
        (StandardCryptoArm.UserAccessible, "COMPLETE") => StandardStoreFile.AccessibleComplete,
        _ => throw new InvalidDataException("STANDARD_CREATE_JOURNAL_FILE_REFUSED")
    };
    internal static byte[] Bytes(StandardKeyCreationRecord record) => JsonSerializer.SerializeToUtf8Bytes(record);
    internal static void ValidateReadback(StandardKeyCreationContext context, StandardCryptoArm arm,
        StandardNativeKeyReadback? snapshot, StandardNativeKeyReadback? expected = null)
    {
        StandardContract.Need(snapshot is not null && snapshot.Descriptor is not null &&
            StandardNativeCryptoRules.Hex(snapshot.Descriptor.Sha256, 64) &&
            StandardNativeCryptoRules.Hex(snapshot.PublicSha256, 64), "STANDARD_CREATE_READBACK_MISSING");
        StandardNativeCryptoRules.Readback(new(context.Scope, arm,
            expected?.Descriptor.Sha256 ?? snapshot.Descriptor.Sha256,
            expected?.PublicSha256 ?? snapshot.PublicSha256), snapshot);
        StandardContract.Need(expected is null || snapshot.PublicSpkiBase64 == expected.PublicSpkiBase64,
            "STANDARD_CREATE_REOPEN_PUBLIC_BYTES_CHANGED");
    }

    internal static StandardStoreReceipt Receipt(StandardKeyCreationContext context, StandardStoreFile file,
        byte[] original, StandardStoreReceipt? receipt, DateTimeOffset recordUtc, DateTimeOffset now)
    {
        Require(context, now);
        StandardContract.Need(receipt is not null && receipt.Scope == context.Scope && receipt.File == file &&
            receipt.Sha256 == StandardNativeCryptoRules.Hash(original) && receipt.Length == original.Length &&
            receipt.WrittenUtc.Offset == TimeSpan.Zero && receipt.WrittenUtc >= recordUtc && receipt.WrittenUtc <= now &&
            receipt.WrittenUtc < context.Scope.ExpiresUtc && receipt.VolumeSerial != 0 && receipt.FileIndex != 0 &&
            receipt.CreationFileTimeUtc >= context.Scope.IssuedUtc.UtcDateTime.ToFileTimeUtc() &&
            receipt.CreationFileTimeUtc <= now.UtcDateTime.ToFileTimeUtc() &&
            receipt.CreateNew && receipt.Protected && receipt.DurablyFlushed && receipt.ExactReadback,
            "STANDARD_CREATE_DURABLE_RECEIPT_REFUSED");
        return receipt;
    }
}

// Store and token/custody suppliers are trusted, separately reviewed adapters.
// The source component verifies their exact typed evidence; it does not claim to
// implement secure placement, filesystem custody or independent token capture.
// One instance is single use. New instances cannot adopt durable earlier intent:
// the store must enforce CreateNew and exact original-file readback itself.
internal sealed class StandardKeyCreationLifecycle
{
    private readonly StandardKeyCreationContext context;
    private readonly IStandardDurableRecordSink store;
    private readonly IStandardKeyCreationBackend backend;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly Func<StandardToken> captureSetupRoleAndVerifyCustody;
    private int started;
    internal StandardKeyCreationLifecycle(StandardKeyCreationContext context, IStandardDurableRecordSink store,
        IStandardKeyCreationBackend backend, Func<DateTimeOffset> utcNow,
        Func<StandardToken> captureSetupRoleAndVerifyCustody)
    {
        this.context = context ?? throw new ArgumentNullException(nameof(context));
        this.store = store ?? throw new ArgumentNullException(nameof(store));
        this.backend = backend ?? throw new ArgumentNullException(nameof(backend));
        this.utcNow = utcNow ?? throw new ArgumentNullException(nameof(utcNow));
        this.captureSetupRoleAndVerifyCustody = captureSetupRoleAndVerifyCustody ?? throw new ArgumentNullException(nameof(captureSetupRoleAndVerifyCustody));
    }
    private void Gate() => StandardKeyCreationRules.Gate(context, utcNow, captureSetupRoleAndVerifyCustody);

    internal StandardKeyCreationResult Run()
    {
        StandardContract.Need(Interlocked.Exchange(ref started, 1) == 0, "STANDARD_CREATE_INSTANCE_ALREADY_CONSUMED");
        var originals = new List<StandardKeyCreatedOriginal>();
        var bytesByFile = new Dictionary<StandardStoreFile, byte[]>();
        var snapshots = new Dictionary<StandardCryptoArm, StandardNativeKeyReadback>();
        var owned = new Dictionary<StandardCryptoArm, StandardKeyCreatedOriginal>();
        StandardCryptoArm? activeArm = null; string stage = "ADMISSION";
        bool createEntered = false, writeEntered = false, releaseUnconfirmed = false;
        DateTimeOffset? lastDurableUtc = null;
        StandardKeyCreatedOriginal Write(StandardCryptoArm arm, string kind, StandardKeyCreatedOriginal? previous,
            StandardNativeKeyReadback? snapshot, string? otherOwned)
        {
            Gate();
            DateTimeOffset written = utcNow(); StandardKeyCreationRules.Require(context, written);
            StandardContract.Need(lastDurableUtc is null || written > lastDurableUtc,
                "STANDARD_CREATE_JOURNAL_TIME_NOT_INCREASING");
            var record = new StandardKeyCreationRecord(StandardKeyCreationRules.Schema, context, arm, kind,
                StandardKeyCreationRules.Name(context, arm), written, previous?.OriginalSha256,
                snapshot?.PublicSha256, snapshot?.Descriptor.Sha256, otherOwned);
            StandardStoreFile file = StandardKeyCreationRules.File(arm, kind);
            byte[] original = StandardKeyCreationRules.Bytes(record);
            writeEntered = true;
            StandardStoreReceipt receipt = store.WriteNew(file, (byte[])original.Clone());
            Gate();
            receipt = StandardKeyCreationRules.Receipt(context, file, original, receipt, written, utcNow());
            StandardContract.Need(!originals.Any(x => x.Receipt.VolumeSerial == receipt.VolumeSerial &&
                x.Receipt.FileIndex == receipt.FileIndex), "STANDARD_CREATE_JOURNAL_FILE_ID_REUSED");
            lastDurableUtc = receipt.WrittenUtc;
            var collected = new StandardKeyCreatedOriginal(record, file, receipt.Sha256, receipt);
            // Read the original again through the store before admitting any
            // key effect, not merely a hash declared by the write callback.
            bytesByFile.Add(file, original);
            VerifyOriginal(collected);
            originals.Add(collected); return collected;
        }
        void VerifyOriginal(StandardKeyCreatedOriginal original)
        {
            Gate();
            byte[] supplied = store.Read(original.File);
            StandardContract.Need(supplied is not null && supplied.Length == bytesByFile[original.File].Length,
                "STANDARD_CREATE_ORIGINAL_SIZE_REFUSED");
            byte[] copy = (byte[])supplied.Clone();
            StandardContract.Need(copy.AsSpan().SequenceEqual(bytesByFile[original.File]) &&
                StandardNativeCryptoRules.Hash(copy) == original.OriginalSha256,
                "STANDARD_CREATE_ORIGINAL_BYTES_CHANGED");
            Gate();
        }
        StandardNativeKeyReadback InspectAndClose(IStandardKeyCreationHandle? handle, StandardCryptoArm arm,
            string inspectStage, string closeStage, StandardNativeKeyReadback? expected)
        {
            StandardContract.Need(handle is not null, "STANDARD_CREATE_HANDLE_MISSING");
            Exception? originalFailure = null;
            try {
                stage = inspectStage; Gate();
                var snapshot = handle.Inspect();
                StandardKeyCreationRules.ValidateReadback(context, arm, snapshot, expected);
                return snapshot;
            }
            catch (Exception error) { originalFailure = error; throw; }
            finally {
                try { if (originalFailure is null) stage = closeStage; handle.Dispose(); }
                catch {
                    releaseUnconfirmed = true;
                    if (originalFailure is null) throw;
                    // An additional release failure must not replace the raw
                    // original inspect/validation failure. Retain unknown state.
                }
            }
        }
        try {
            Gate();
            // An unavailable NCrypt name probe alone is not authenticated
            // absence. Successful atomic MACHINE_KEY creation without overwrite
            // is additionally mandatory; a known-openable existing key refuses.
            foreach (var arm in new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }) {
                activeArm = arm; stage = "NAME_PROBE"; Gate();
                var observed = backend.ProbeName(context, arm, Gate);
                StandardContract.Need(observed is not null && observed.KeyName == StandardKeyCreationRules.Name(context, arm) &&
                    observed.Outcome == "NOT_OPENED_BAD_KEYSET" && observed.NativeStatus == StandardCryptoComparison.BadKeyset,
                    "STANDARD_CREATE_NAME_UNAVAILABLE_OR_EXISTING");
            }
            foreach (var arm in new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }) {
                activeArm = arm; stage = "INTENT_WRITE";
                var intent = Write(arm, "INTENT", null, null, null);
                stage = "CREATE"; Gate();
                createEntered = true; // Failure may still leave an unknown key.
                StandardNativeKeyReadback created = InspectAndClose(
                    backend.CreateFresh(context, arm, () => VerifyOriginal(intent), Gate), arm,
                    "CREATED_INSPECT", "CREATED_CLOSE", null);
                // The original created handle has been disposed before any
                // independent reopen is attempted. No retry is permitted.
                stage = "REOPEN"; Gate();
                StandardNativeKeyReadback reopened = InspectAndClose(
                    backend.ReopenCreated(context, arm, Gate), arm,
                    "REOPENED_INSPECT", "REOPENED_CLOSE", created);
                snapshots.Add(arm, reopened);
                stage = "OWNED_WRITE";
                owned.Add(arm, Write(arm, "OWNED", intent, reopened, null));
            }
            stage = "PAIR_VALIDATE"; activeArm = null;
            var restricted = snapshots[StandardCryptoArm.Restricted]; var accessible = snapshots[StandardCryptoArm.UserAccessible];
            StandardContract.Need(restricted.PublicSha256 != accessible.PublicSha256 &&
                restricted.Descriptor.Sha256 != accessible.Descriptor.Sha256,
                "STANDARD_CREATE_PAIR_IDENTITIES_NOT_DISTINCT");
            foreach (var arm in new[] { StandardCryptoArm.Restricted, StandardCryptoArm.UserAccessible }) {
                activeArm = arm; stage = "OWNED_PAIR_READBACK";
                VerifyOriginal(owned[StandardCryptoArm.Restricted]); VerifyOriginal(owned[StandardCryptoArm.UserAccessible]);
                stage = "COMPLETE_WRITE";
                var other = arm == StandardCryptoArm.Restricted ? StandardCryptoArm.UserAccessible : StandardCryptoArm.Restricted;
                Write(arm, "COMPLETE", owned[arm], snapshots[arm], owned[other].OriginalSha256);
            }
            Gate();
            return new("CREATE_REOPEN_PROTOCOL_COMPLETE", restricted, accessible, originals.AsReadOnly(), null);
        }
        catch (Exception error) {
            // No recovery write, retry, delete, adoption or repair. Preserve
            // original failure without another guard/store error replacing it.
            string category = error switch {
                CryptographicException => "CRYPTOGRAPHIC", UnauthorizedAccessException => "UNAUTHORIZED_ACCESS",
                InvalidDataException => "VALIDATION", IOException => "IO", _ => "UNKNOWN"
            };
            return new("RETAINED_PARTIAL_OR_UNKNOWN", snapshots.GetValueOrDefault(StandardCryptoArm.Restricted),
                snapshots.GetValueOrDefault(StandardCryptoArm.UserAccessible), originals.AsReadOnly(),
                new(activeArm, stage, category, error.HResult,
                    error is StandardKeyCreationNativeException creationNative ? creationNative.NativeStatus :
                        error is StandardNativeStatusException native ? native.NativeStatus : null,
                    error is StandardKeyCreationNativeException stagedNative ? stagedNative.NativeStage : null,
                    createEntered, writeEntered, createEntered, writeEntered, releaseUnconfirmed));
        }
    }
}

#if COMPILE_ONLY_STANDARD_KEY_CREATION_NATIVE_V1
// Compile-only fresh native backend. Only the lifecycle's separately reviewed
// SYSTEM service/custody gate and exact durable-intent verifier may authorize
// creation. This component has no placement, service, account or CLI surface.
internal sealed class StandardNativeKeyCreationBackend : IStandardKeyCreationBackend
{
    private static void NativeGate(StandardKeyCreationContext context, Action gate)
    {
        StandardContract.Need(OperatingSystem.IsWindows() && RuntimeInformation.OSArchitecture == Architecture.X64 &&
            RuntimeInformation.ProcessArchitecture == Architecture.X64 && Environment.Version == new Version(10, 0, 11),
            "STANDARD_CREATE_NATIVE_RUNTIME_REFUSED");
        StandardKeyCreationRules.Require(context, DateTimeOffset.UtcNow);
        ArgumentNullException.ThrowIfNull(gate); gate();
        StandardKeyCreationRules.Require(context, DateTimeOffset.UtcNow);
        _ = StandardKeyCreationRules.Name(context, StandardCryptoArm.Restricted);
    }
    public StandardKeyNameObservation ProbeName(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate)
    {
        string name = StandardKeyCreationRules.Name(context, arm);
        NativeGate(context, gate);
        SafeNCryptProviderHandle? provider = null; SafeNCryptKeyHandle? key = null;
        try {
            Check(NCryptOpenStorageProvider(out provider, StandardCryptoComparison.Provider, 0), "OPEN_PROVIDER");
            NativeGate(context, gate);
            int status = NCryptOpenKey(provider, out key, name, 0, 0x60); // MACHINE | SILENT.
            if (status == 0) return new(name, "OPENED_EXISTS", 0);
            if (status == StandardCryptoComparison.BadKeyset) return new(name, "NOT_OPENED_BAD_KEYSET", status);
            throw new StandardKeyCreationNativeException("NAME_PROBE_OPEN", status);
        }
        finally { key?.Dispose(); provider?.Dispose(); }
    }
    public IStandardKeyCreationHandle CreateFresh(StandardKeyCreationContext context, StandardCryptoArm arm,
        Action verifyDurableIntent, Action gate)
    {
        ArgumentNullException.ThrowIfNull(verifyDurableIntent);
        string name = StandardKeyCreationRules.Name(context, arm);
        NativeGate(context, gate);
        SafeNCryptProviderHandle? provider = null; SafeNCryptKeyHandle? handle = null;
        try {
            Check(NCryptOpenStorageProvider(out provider, StandardCryptoComparison.Provider, 0), "OPEN_PROVIDER");
            NativeGate(context, gate); Check(NCryptIsAlgSupported(provider, "RSA", 0), "IS_ALGORITHM_SUPPORTED");
            verifyDurableIntent(); NativeGate(context, gate);
            Check(NCryptCreatePersistedKey(provider, out handle, "RSA", name, 0, 0x20), "CREATE_PERSISTED"); // MACHINE only; no OVERWRITE.
            NativeGate(context, gate); Set(handle, "Length", BitConverter.GetBytes(3072), 0, "SET_LENGTH");
            NativeGate(context, gate); Set(handle, "Export Policy", BitConverter.GetBytes(0), 0, "SET_POLICY");
            NativeGate(context, gate); Set(handle, "Key Usage", BitConverter.GetBytes(1), 0, "SET_USAGE");
            string sddl = "O:SYG:SYD:P(A;;GA;;;SY)(A;;GA;;;" + StandardCryptoComparison.GuardianSid + ")" +
                (arm == StandardCryptoArm.UserAccessible ? "(A;;GA;;;" + StandardContract.UserSid + ")" : "");
            var descriptor = new RawSecurityDescriptor(sddl); byte[] bytes = new byte[descriptor.BinaryLength];
            descriptor.GetBinaryForm(bytes, 0); StandardNativeCryptoRules.Descriptor(bytes, arm);
            NativeGate(context, gate); Set(handle, "Security Descr", bytes, 7, "SET_SECURITY_DESCRIPTOR"); // OWNER | GROUP | DACL before finalize.
            NativeGate(context, gate); Check(NCryptFinalizeKey(handle, 0x40), "FINALIZE"); // SILENT.
            NativeGate(context, gate); CngKey key = CngKey.Open(handle, CngKeyHandleOpenOptions.None);
            try { return new Inspected(key, arm, () => NativeGate(context, gate)); } catch { key.Dispose(); throw; }
        }
        finally { handle?.Dispose(); provider?.Dispose(); }
    }
    public IStandardKeyCreationHandle ReopenCreated(StandardKeyCreationContext context, StandardCryptoArm arm, Action gate)
    {
        NativeGate(context, gate);
        CngKey key = CngKey.Open(StandardKeyCreationRules.Name(context, arm), new CngProvider(StandardCryptoComparison.Provider),
            CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
        try { return new Inspected(key, arm, () => NativeGate(context, gate)); } catch { key.Dispose(); throw; }
    }
    private sealed class Inspected : IStandardKeyCreationHandle
    {
        private readonly CngKey key; private readonly StandardCryptoArm arm; private readonly Action gate; private bool disposed;
        internal Inspected(CngKey key, StandardCryptoArm arm, Action gate) { this.key = key; this.arm = arm; this.gate = gate; }
        public StandardNativeKeyReadback Inspect()
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            gate(); var descriptor = StandardNativeCryptoRules.Descriptor(key.GetProperty("Security Descr", (CngPropertyOptions)7).GetValue(), arm);
            gate(); string name = key.KeyName!;
            gate(); string provider = key.Provider?.Provider!;
            gate(); string algorithm = key.Algorithm.Algorithm;
            gate(); int bits = key.KeySize;
            gate(); bool machine = key.IsMachineKey;
            gate(); bool persisted = !key.IsEphemeral;
            gate(); int usage = (int)key.KeyUsage;
            gate(); int policy = (int)key.ExportPolicy;
            gate(); using var rsa = new RSACng(key);
            gate(); byte[] spki = rsa.ExportSubjectPublicKeyInfo(); // Public only.
            gate(); return new(name, provider, algorithm, bits, machine, persisted, usage, policy,
                descriptor, Convert.ToBase64String(spki), StandardNativeCryptoRules.Hash(spki));
        }
        public void Dispose() { if (disposed) return; disposed = true; key.Dispose(); }
    }
    private static void Check(int status, string stage) { if (status != 0) throw new StandardKeyCreationNativeException(stage, status); }
    private static void Set(SafeNCryptKeyHandle key, string property, byte[] value, int flags, string stage) =>
        Check(NCryptSetProperty(key, property, value, value.Length, flags), stage);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenStorageProvider(out SafeNCryptProviderHandle provider, string name, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptOpenKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key, string name, int legacy, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptIsAlgSupported(SafeNCryptProviderHandle provider, string algorithm, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptCreatePersistedKey(SafeNCryptProviderHandle provider, out SafeNCryptKeyHandle key,
        string algorithm, string name, int legacy, int flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    private static extern int NCryptSetProperty(SafeNCryptKeyHandle key, string property, byte[] value, int length, int flags);
    [DllImport("ncrypt.dll")]
    private static extern int NCryptFinalizeKey(SafeNCryptKeyHandle key, int flags);
}
#endif
