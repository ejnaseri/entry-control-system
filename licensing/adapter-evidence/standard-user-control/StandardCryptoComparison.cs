using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace EntryControl.TestOnly.StandardUserControl;

// Pure interpretation of caller-supplied evidence, NOT a native collector,
// authenticated report, live approval or authority to create/open a key. Every
// custody, token, handle and durable-record assertion below must eventually be
// supplied by a separately reviewed controller/collector, never by its worker.
internal enum StandardCryptoArm { Restricted, UserAccessible }
internal enum StandardCryptoStage { Setup, GuardianBefore, StandardUser, GuardianAfter }

internal sealed record StandardCryptoScope(string Schema, string Root, string Attempt,
    DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc, string AccountSid,
    string AccountOwnedSha256, string AccountCompleteSha256, string OwnerSid,
    string PlanSha256, string ApprovalSha256, string PackageSha256, string RuntimeSha256,
    string ImageSha256, string AssemblySha256, string HostSha256, string BootSha256);

internal sealed record StandardCryptoAce(string Sid, uint Mask, byte Flags,
    bool Allow, bool Callback);
internal sealed record StandardCryptoEnvelope(string Cipher, string KeyWrap,
    string EnvelopeSha256, string SyntheticPlaintextSha256, string KeyPublicSha256);
internal sealed record StandardCryptoKey(StandardCryptoArm Arm, string Name,
    string Provider, string Algorithm, int Bits, bool Machine, bool Persisted,
    int Usage, int ExportPolicy, string OwnerSid, string GroupSid,
    bool ProtectedDacl, IReadOnlyList<StandardCryptoAce>? Aces,
    string DescriptorSha256, string PublicSha256, StandardCryptoEnvelope? Envelope);

// These are hashes of separately collected original records, NOT hashes a
// worker declares about itself. An owned acknowledgement is insufficient alone:
// the exact preceding intent and following completion must also be available.
internal sealed record StandardCryptoJournalRecord(StandardCryptoScope Scope,
    StandardCryptoArm Arm, string Kind, string KeyName, DateTimeOffset WrittenUtc,
    string Sha256, string? PreviousSha256, string? PublicSha256,
    string? DescriptorSha256, bool Protected, bool DurablyFlushed, bool OriginalCollected);
internal sealed record StandardCryptoJournal(StandardCryptoArm Arm,
    bool NameAbsentBeforeCreate, bool CreateMachineWithoutOverwrite,
    StandardCryptoJournalRecord? Intent, StandardCryptoJournalRecord? Owned,
    StandardCryptoJournalRecord? Complete);

// Requested key/public/envelope identities identify the requested operation;
// they do not assert that a user denied at Open read key metadata. ManagedHResult
// and independently captured NativeStatus remain separate, unmodified fields.
internal sealed record StandardCryptoOperation(StandardCryptoArm Arm,
    string RequestedKeyName, string RequestedPublicSha256, string RequestedEnvelopeSha256,
    DateTimeOffset ObservedUtc, string Status, string OperationStage, bool KeyOpened, string? FailureCategory,
    int? ManagedHResult, int? NativeStatus, string? ObservedPlaintextSha256);
internal sealed record StandardCryptoReport(StandardCryptoScope Scope,
    StandardCryptoStage Stage, string RunId, uint ProcessId, long CreationFileTimeUtc,
    DateTimeOffset StartedUtc, DateTimeOffset CompletedUtc,
    StandardCryptoKey? RestrictedKey, StandardCryptoKey? AccessibleKey,
    StandardCryptoOperation? RestrictedOperation, StandardCryptoOperation? AccessibleOperation);

// A worker JSON cannot populate this proof. Capture/hold the original process
// handle, independently pin the executable AND loaded managed assembly/runtime,
// capture the token before the operation gate and observe exit on that handle.
// PID0/STOPPED, a worker exit field or reopening the PID supplies none of this.
internal sealed record StandardCryptoProcessProof(StandardCryptoScope Scope,
    StandardCryptoStage Stage, uint ProcessId, long CreationFileTimeUtc,
    string ImagePath, string ImageSha256, string AssemblySha256,
    string PackageSha256, string RuntimeSha256, StandardToken? CapturedToken,
    DateTimeOffset AdmittedUtc, DateTimeOffset ExitObservedUtc,
    bool OriginalHandleHeldThroughExit, bool ImageAndLoadedCodeCustodyVerified,
    bool TokenCapturedBeforeOperation, bool NoThreadImpersonation,
    bool SuspendedStandardProcessAdmittedBeforeResume, bool StandardResumeCountWasOne,
    bool ExitObservedOnHeldHandle, uint ExitCode, string CollectedReportSha256);
internal sealed record StandardCryptoCollectedStage(StandardCryptoReport? Report,
    StandardCryptoProcessProof? ProcessProof, string OriginalReportSha256,
    bool ProtectedOriginalCollected, bool OriginalReportBoundToProcess);
internal sealed record StandardCryptoEvidence(StandardCryptoScope Scope,
    bool FreshRootAndServicesAbsentBeforeCreate, bool PlacementOwnershipVerified,
    StandardCryptoJournal? RestrictedJournal, StandardCryptoJournal? AccessibleJournal,
    StandardCryptoCollectedStage? Setup, StandardCryptoCollectedStage? GuardianBefore,
    StandardCryptoCollectedStage? StandardUser, StandardCryptoCollectedStage? GuardianAfter);

internal sealed record StandardCryptoComparisonResult(string Outcome, string Reason,
    StandardCryptoOperation? RestrictedObservation)
{
    public bool PureInterpretationOnly => true;
    public bool MetadataAuthenticated => false;
    public bool PhysicalExecutionEnabled => false;
    public bool StandardUserLogonTested => false;
    public bool Lic008Closed => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
}

internal static class StandardCryptoComparison
{
    internal const string Schema = "TEST_ONLY_STANDARD_USER_CRYPTO_COMPARISON_V1";
    internal const string Provider = "Microsoft Software Key Storage Provider";
    internal const string ImagePath = @"C:\Program Files\dotnet\dotnet.exe";
    internal const string SystemSid = "S-1-5-18";
    internal const string ServiceLogonSid = "S-1-5-6";
    internal const string SystemIntegritySid = "S-1-16-16384";
    internal const string SetupSid = "S-1-5-80-1058531584-1075974375-3592222494-1863664446-53048254";
    internal const string GuardianSid = "S-1-5-80-1211139072-2691444499-3204521434-3582678154-1420186092";
    internal const int BadKeyset = unchecked((int)0x80090016);
    internal const int NtePermission = unchecked((int)0x80090010);
    internal const int Win32AccessDenied = unchecked((int)0x80070005);

    private static bool Hex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static bool Hash(string? value) => Hex(value, 64);
    private static bool Utc(DateTimeOffset value) => value.Offset == TimeSpan.Zero;

    internal static string DerivedServiceSid(string serviceName)
    {
        // Windows service-namespace derivation only; not a trust hash or a lookup.
        byte[] hash = SHA1.HashData(Encoding.Unicode.GetBytes(serviceName.ToUpperInvariant()));
        return "S-1-5-80-" + string.Join("-", Enumerable.Range(0, 5).Select(i =>
            BinaryPrimitives.ReadUInt32LittleEndian(hash.AsSpan(i * 4, 4)).ToString(CultureInfo.InvariantCulture)));
    }

    internal static string KeyName(string attempt, StandardCryptoArm arm)
    {
        StandardContract.Need(Hex(attempt, 32), "STANDARD_CRYPTO_ATTEMPT_REFUSED");
        return StandardContract.KeyPrefix + attempt + "." + (arm switch {
            StandardCryptoArm.Restricted => "restricted",
            StandardCryptoArm.UserAccessible => "user-accessible",
            _ => throw new System.IO.InvalidDataException("STANDARD_CRYPTO_ARM_REFUSED")
        });
    }

    private static bool ScopeValid(StandardCryptoScope? s) => s is not null &&
        s.Schema == Schema && s.Root == StandardContract.Root && Hex(s.Attempt, 32) &&
        Utc(s.IssuedUtc) && Utc(s.ExpiresUtc) && s.ExpiresUtc > s.IssuedUtc &&
        s.ExpiresUtc - s.IssuedUtc <= TimeSpan.FromHours(2) &&
        s.AccountSid == StandardContract.UserSid && s.OwnerSid == StandardContract.OwnerSid &&
        s.AccountOwnedSha256 == StandardContract.AccountOwnedSha256 &&
        s.AccountCompleteSha256 == StandardContract.AccountCompleteSha256 &&
        new[] { s.PlanSha256, s.ApprovalSha256, s.PackageSha256, s.RuntimeSha256,
            s.ImageSha256, s.AssemblySha256, s.HostSha256, s.BootSha256 }.All(Hash) &&
        DerivedServiceSid(StandardContract.SetupService) == SetupSid &&
        DerivedServiceSid(StandardContract.GuardianService) == GuardianSid;

    private static bool InWindow(StandardCryptoScope s, DateTimeOffset time) =>
        Utc(time) && time >= s.IssuedUtc && time < s.ExpiresUtc;

    internal static bool KeyValid(StandardCryptoScope scope, StandardCryptoKey? key, StandardCryptoArm arm)
    {
        if (!ScopeValid(scope) || key is null || key.Arm != arm ||
            key.Name != KeyName(scope.Attempt, arm) || key.Provider != Provider ||
            key.Algorithm != "RSA" || key.Bits != 3072 || !key.Machine || !key.Persisted ||
            key.Usage != 1 || key.ExportPolicy != 0 || key.OwnerSid != SystemSid ||
            key.GroupSid != SystemSid || !key.ProtectedDacl || !Hash(key.DescriptorSha256) ||
            !Hash(key.PublicSha256) || key.Aces is null ||
            key.Aces.Count != (arm == StandardCryptoArm.Restricted ? 2 : 3)) return false;
        var expected = new HashSet<string>(StringComparer.Ordinal) { SystemSid, GuardianSid };
        if (arm == StandardCryptoArm.UserAccessible) expected.Add(StandardContract.UserSid);
        foreach (var ace in key.Aces) {
            // GA or its provider-mapped representation. This accessible control
            // grants broad user access; it is NOT a decrypt-only policy claim.
            if (ace is null || !ace.Allow || ace.Callback || ace.Flags != 0 ||
                ace.Mask is not (0x10000000u or 0xd01f01ffu) || !expected.Remove(ace.Sid)) return false;
        }
        var envelope = key.Envelope;
        return expected.Count == 0 && envelope is not null && envelope.Cipher == "AES-256-GCM" &&
            envelope.KeyWrap == "RSA-OAEP-SHA256" && Hash(envelope.EnvelopeSha256) &&
            Hash(envelope.SyntheticPlaintextSha256) && envelope.KeyPublicSha256 == key.PublicSha256;
    }

    private static bool SameKey(StandardCryptoKey left, StandardCryptoKey right) =>
        left.Name == right.Name && left.PublicSha256 == right.PublicSha256 &&
        left.DescriptorSha256 == right.DescriptorSha256 && left.Envelope == right.Envelope;

    private static string JournalRefusal(StandardCryptoScope scope, StandardCryptoJournal? journal,
        StandardCryptoKey key, StandardCryptoArm arm, DateTimeOffset setupStart, DateTimeOffset setupEnd)
    {
        if (journal?.Intent is null || journal.Owned is null || journal.Complete is null)
            return "JOURNAL_CHAIN_MISSING";
        if (journal.Arm != arm || !journal.NameAbsentBeforeCreate || !journal.CreateMachineWithoutOverwrite)
            return "JOURNAL_FRESH_CREATION_REFUSED";
        var entries = new[] { journal.Intent, journal.Owned, journal.Complete };
        var kinds = new[] { "INTENT", "OWNED", "COMPLETE" };
        for (int i = 0; i < entries.Length; i++) {
            var row = entries[i];
            if (!ScopeValid(row.Scope) || row.Scope != scope || row.Arm != arm || row.Kind != kinds[i] || row.KeyName != key.Name ||
                !Hash(row.Sha256) || !row.Protected || !row.DurablyFlushed || !row.OriginalCollected ||
                !InWindow(scope, row.WrittenUtc) || row.WrittenUtc < setupStart || row.WrittenUtc > setupEnd ||
                row.PreviousSha256 != (i == 0 ? null : entries[i - 1].Sha256) ||
                (i > 0 && row.WrittenUtc <= entries[i - 1].WrittenUtc) ||
                (i == 0 ? row.PublicSha256 is not null || row.DescriptorSha256 is not null :
                    row.PublicSha256 != key.PublicSha256 || row.DescriptorSha256 != key.DescriptorSha256))
                return "JOURNAL_CHAIN_BINDING_REFUSED";
        }
        return entries.Select(r => r.Sha256).Distinct(StringComparer.Ordinal).Count() == 3
            ? "NONE" : "JOURNAL_RECORD_REUSE_REFUSED";
    }

    private static bool ServiceTokenValid(StandardToken? token, StandardCryptoStage stage)
    {
        string user = stage == StandardCryptoStage.Setup ? SystemSid : GuardianSid;
        string service = stage == StandardCryptoStage.Setup ? SetupSid : GuardianSid;
        // These are prospective W03 requirements, NOT assertions that the V5
        // archive captured integrity, elevation type or complete groups. V5
        // captured primary/elevation1, but its groupCount describes only its
        // matching service SID, not the total token group count. A fresh native
        // collector must observe this entire stricter service class itself.
        if (token is null || !token.QueryComplete || token.Type != 1 || token.Elevation != 1 ||
            token.ElevationType != 1 || token.IntegritySid != SystemIntegritySid ||
            token.HasRestrictions || token.AppContainer || token.User != user || token.Owner != user ||
            token.Groups is null || token.Groups.Count is < 1 or > 1024) return false;
        var seen = new HashSet<string>(StringComparer.Ordinal);
        int serviceCount = 0;
        bool serviceLogon = false;
        foreach (var group in token.Groups) {
            if (group is null || !StandardIdentity.CanonicalSid(group.Sid) || !seen.Add(group.Sid)) return false;
            if (group.Sid is StandardContract.Interactive or "S-1-5-2" or "S-1-5-3") return false;
            if (group.Sid == ServiceLogonSid) {
                if ((group.Attributes & 4) == 0 || (group.Attributes & 16) != 0) return false;
                serviceLogon = true;
            }
            if (group.Sid == service) {
                if ((group.Attributes & 4) == 0 || (group.Attributes & 16) != 0) return false;
                serviceCount++;
            }
        }
        // A virtual Guardian SID may be TokenUser without also being a group.
        return serviceLogon && (stage == StandardCryptoStage.Setup ? serviceCount == 1 : serviceCount is 0 or 1);
    }

    private static string StageRefusal(StandardCryptoScope scope, StandardCryptoCollectedStage? collected,
        StandardCryptoStage stage)
    {
        if (collected?.Report is null) return "REPORT_MISSING";
        var r = collected.Report;
        if (!ScopeValid(r.Scope) || r.Scope != scope || r.Stage != stage || !Hex(r.RunId, 32) || r.ProcessId == 0 ||
            r.CreationFileTimeUtc <= 0 || !InWindow(scope, r.StartedUtc) || !InWindow(scope, r.CompletedUtc) ||
            r.CompletedUtc <= r.StartedUtc || !Hash(collected.OriginalReportSha256))
            return "REPORT_BINDING_REFUSED";
        if (collected.ProcessProof is null || !collected.ProtectedOriginalCollected ||
            !collected.OriginalReportBoundToProcess) return "INDEPENDENT_PROCESS_OR_ORIGINAL_PROOF_MISSING";
        var p = collected.ProcessProof;
        if (!p.OriginalHandleHeldThroughExit || !p.ImageAndLoadedCodeCustodyVerified ||
            !p.TokenCapturedBeforeOperation || !p.NoThreadImpersonation || !p.ExitObservedOnHeldHandle)
            return "INDEPENDENT_PROCESS_OR_ORIGINAL_PROOF_MISSING";
        if (!ScopeValid(p.Scope) || p.Scope != scope || p.Stage != stage || p.ProcessId != r.ProcessId ||
            p.CreationFileTimeUtc != r.CreationFileTimeUtc || p.ImagePath != ImagePath ||
            p.ImageSha256 != scope.ImageSha256 || p.AssemblySha256 != scope.AssemblySha256 ||
            p.PackageSha256 != scope.PackageSha256 || p.RuntimeSha256 != scope.RuntimeSha256 ||
            p.CollectedReportSha256 != collected.OriginalReportSha256 || p.ExitCode != 0 ||
            !InWindow(scope, p.AdmittedUtc) || !InWindow(scope, p.ExitObservedUtc) ||
            p.AdmittedUtc > r.StartedUtc || p.ExitObservedUtc < r.CompletedUtc)
            return "INDEPENDENT_PROCESS_BINDING_REFUSED";
        // Avoid throwing on a malformed/unrepresentable FILETIME supplied by a
        // parser. The comparison reports refusal and preserves the raw operation.
        DateTimeOffset created;
        try { created = new DateTimeOffset(DateTime.FromFileTimeUtc(p.CreationFileTimeUtc)); }
        catch (ArgumentOutOfRangeException) { return "PROCESS_CREATION_TIME_REFUSED"; }
        if (!InWindow(scope, created) || created > p.AdmittedUtc) return "PROCESS_CREATION_TIME_REFUSED";
        if (stage == StandardCryptoStage.StandardUser) {
            if (!p.SuspendedStandardProcessAdmittedBeforeResume || !p.StandardResumeCountWasOne)
                return "SUSPENDED_STANDARD_ADMISSION_PROOF_MISSING";
            if (StandardIdentity.Refusal(p.CapturedToken) != "NONE") return "STANDARD_ACCOUNT_TOKEN_REFUSED";
        } else if (!ServiceTokenValid(p.CapturedToken, stage)) return "SERVICE_TOKEN_REFUSED";
        return "NONE";
    }

    private static bool OperationBound(StandardCryptoOperation? operation, StandardCryptoKey key) =>
        operation is not null && operation.Arm == key.Arm && operation.RequestedKeyName == key.Name &&
        operation.RequestedPublicSha256 == key.PublicSha256 &&
        operation.RequestedEnvelopeSha256 == key.Envelope!.EnvelopeSha256;

    private static bool OperationShape(StandardCryptoOperation operation)
    {
        bool noError = operation.FailureCategory is null && operation.ManagedHResult is null && operation.NativeStatus is null;
        return operation.Status switch {
            "DECRYPTED" => operation.OperationStage == "DECRYPT" && operation.KeyOpened && noError && Hash(operation.ObservedPlaintextSha256),
            "OPENED_WITHOUT_DECRYPT" => operation.OperationStage == "OPEN" && operation.KeyOpened && noError && operation.ObservedPlaintextSha256 is null,
            "FAILED" => operation.OperationStage is "OPEN" or "INSPECT" or "DECRYPT" &&
                operation.KeyOpened == (operation.OperationStage != "OPEN") &&
                operation.FailureCategory is { Length: > 0 and <= 64 } category &&
                category.All(c => c is >= 'A' and <= 'Z' or '_') &&
                (operation.ManagedHResult is not null || operation.NativeStatus is not null) && operation.ObservedPlaintextSha256 is null,
            "NOT_RUN" => operation.OperationStage == "NONE" && !operation.KeyOpened && noError && operation.ObservedPlaintextSha256 is null,
            _ => false
        };
    }

    private static bool Decrypted(StandardCryptoOperation operation, StandardCryptoKey key) =>
        operation.Status == "DECRYPTED" &&
        operation.ObservedPlaintextSha256 == key.Envelope!.SyntheticPlaintextSha256;

    private static string InspectionRefusal(StandardCryptoScope scope, StandardCryptoKey? observed,
        StandardCryptoKey expected, StandardCryptoOperation operation)
    {
        // Metadata is the result of THIS probe's completed inspection, never a
        // copy of Setup's expectations. Open failure/NOT_RUN establishes none;
        // an INSPECT failure has an opened handle but no admitted inspection.
        // Open-only success likewise proves only Open, not a completed inspect
        // or decrypt. DECRYPT is gated by a fully validated actual readback.
        bool inspected = operation.OperationStage == "DECRYPT";
        if (!inspected) return observed is null ? "NONE" : "UNESTABLISHED_KEY_INSPECTION_REFUSED";
        if (observed is null) return "COMPLETED_KEY_INSPECTION_MISSING";
        return KeyValid(scope, observed, expected.Arm) && SameKey(expected, observed)
            ? "NONE" : "REOPENED_KEY_PROFILE_REFUSED";
    }

    private static bool Missing(string reason) => reason is "REPORT_MISSING" or
        "INDEPENDENT_PROCESS_OR_ORIGINAL_PROOF_MISSING" or "SUSPENDED_STANDARD_ADMISSION_PROOF_MISSING" or "JOURNAL_CHAIN_MISSING";

    internal static StandardCryptoComparisonResult Evaluate(StandardCryptoEvidence? evidence)
    {
        StandardCryptoOperation? raw = evidence?.StandardUser?.Report?.RestrictedOperation;
        StandardCryptoComparisonResult Refuse(string reason) => new(Missing(reason) ? "UNKNOWN" : "INPUT_REFUSED", reason, raw);
        if (evidence is null) return Refuse("REPORT_MISSING");
        var scope = evidence.Scope;
        if (!ScopeValid(scope)) return Refuse("SCOPE_REFUSED");
        if (!evidence.FreshRootAndServicesAbsentBeforeCreate || !evidence.PlacementOwnershipVerified)
            return Refuse("FRESH_PLACEMENT_PROOF_REFUSED");
        var stages = new[] { evidence.Setup, evidence.GuardianBefore, evidence.StandardUser, evidence.GuardianAfter };
        var roles = new[] { StandardCryptoStage.Setup, StandardCryptoStage.GuardianBefore,
            StandardCryptoStage.StandardUser, StandardCryptoStage.GuardianAfter };
        for (int i = 0; i < stages.Length; i++) {
            string refusal = StageRefusal(scope, stages[i], roles[i]);
            if (refusal != "NONE") return Refuse(refusal);
        }
        var reports = stages.Select(s => s!.Report!).ToArray();
        var proofs = stages.Select(s => s!.ProcessProof!).ToArray();
        if (reports.Select(r => r.RunId).Distinct(StringComparer.Ordinal).Count() != 4 ||
            stages.Select(s => s!.OriginalReportSha256).Distinct(StringComparer.Ordinal).Count() != 4 ||
            proofs.Select(p => (p.ProcessId, p.CreationFileTimeUtc)).Distinct().Count() != 4)
            return Refuse("STAGE_PROCESS_OR_REPORT_REUSED");
        for (int i = 1; i < reports.Length; i++)
            if (reports[i].StartedUtc <= proofs[i - 1].ExitObservedUtc ||
                proofs[i].AdmittedUtc <= proofs[i - 1].ExitObservedUtc)
                return Refuse("STAGE_ORDER_REFUSED");
        var restricted = reports[0].RestrictedKey;
        var accessible = reports[0].AccessibleKey;
        if (!KeyValid(scope, restricted, StandardCryptoArm.Restricted) ||
            !KeyValid(scope, accessible, StandardCryptoArm.UserAccessible)) return Refuse("SETUP_KEY_PROFILE_REFUSED");
        if (restricted!.PublicSha256 == accessible!.PublicSha256 || restricted.DescriptorSha256 == accessible.DescriptorSha256 ||
            restricted.Envelope!.EnvelopeSha256 == accessible.Envelope!.EnvelopeSha256 ||
            restricted.Envelope.SyntheticPlaintextSha256 != accessible.Envelope.SyntheticPlaintextSha256)
            return Refuse("KEY_PAIR_DISTINCTION_REFUSED");
        string journalFailure = JournalRefusal(scope, evidence.RestrictedJournal, restricted, StandardCryptoArm.Restricted,
            reports[0].StartedUtc, reports[0].CompletedUtc);
        if (journalFailure != "NONE") return Refuse(journalFailure);
        journalFailure = JournalRefusal(scope, evidence.AccessibleJournal, accessible, StandardCryptoArm.UserAccessible,
            reports[0].StartedUtc, reports[0].CompletedUtc);
        if (journalFailure != "NONE") return Refuse(journalFailure);
        var recordHashes = new[] { evidence.RestrictedJournal!, evidence.AccessibleJournal! }
            .SelectMany(j => new[] { j.Intent!.Sha256, j.Owned!.Sha256, j.Complete!.Sha256 });
        if (recordHashes.Distinct(StringComparer.Ordinal).Count() != 6) return Refuse("JOURNAL_RECORD_REUSE_REFUSED");
        if (reports[0].RestrictedOperation is not null || reports[0].AccessibleOperation is not null)
            return Refuse("SETUP_OPERATION_REFUSED");
        for (int i = 1; i < reports.Length; i++) {
            var report = reports[i];
            bool user = i == 2;
            if (!OperationBound(report.RestrictedOperation, restricted) || !OperationBound(report.AccessibleOperation, accessible))
                return Refuse("OPERATION_BINDING_REFUSED");
            if (!OperationShape(report.RestrictedOperation!) || !OperationShape(report.AccessibleOperation!))
                return Refuse("OPERATION_SHAPE_REFUSED");
            string inspection = InspectionRefusal(scope, report.RestrictedKey, restricted, report.RestrictedOperation!);
            if (inspection != "NONE") return Refuse(inspection);
            inspection = InspectionRefusal(scope, report.AccessibleKey, accessible, report.AccessibleOperation!);
            if (inspection != "NONE") return Refuse(inspection);
            if (!InWindow(scope, report.RestrictedOperation!.ObservedUtc) ||
                !InWindow(scope, report.AccessibleOperation!.ObservedUtc) ||
                report.RestrictedOperation.ObservedUtc <= report.StartedUtc ||
                report.RestrictedOperation.ObservedUtc >= report.CompletedUtc ||
                report.AccessibleOperation.ObservedUtc <= report.StartedUtc ||
                report.AccessibleOperation.ObservedUtc >= report.CompletedUtc ||
                (user && report.AccessibleOperation.ObservedUtc >= report.RestrictedOperation.ObservedUtc))
                return Refuse("OPERATION_ORDER_REFUSED");
        }
        if (!Decrypted(reports[1].RestrictedOperation!, restricted) || !Decrypted(reports[1].AccessibleOperation!, accessible))
            return new("CONTROL_INCONCLUSIVE", "GUARDIAN_BEFORE_POSITIVE_CONTROL_FAILED", raw);
        if (!Decrypted(reports[2].AccessibleOperation!, accessible))
            return new("CONTROL_INCONCLUSIVE", "STANDARD_ACCESSIBLE_POSITIVE_CONTROL_FAILED", raw);
        if (!Decrypted(reports[3].RestrictedOperation!, restricted) || !Decrypted(reports[3].AccessibleOperation!, accessible))
            return new("CONTROL_INCONCLUSIVE", "GUARDIAN_AFTER_RECHECK_FAILED", raw);
        // All results remain observations. Even a successful restricted decrypt
        // is not evidence of a private-key export, and an open success alone is
        // not evidence that decryption was attempted or succeeded.
        if (raw!.Status == "DECRYPTED") return Decrypted(raw, restricted)
            ? new("RESTRICTED_DECRYPT_SUCCEEDED", "RESTRICTED_DECRYPT_OBSERVED", raw)
            : new("RESTRICTED_OPERATION_UNCLASSIFIED", "RESTRICTED_PLAINTEXT_MISMATCH", raw);
        if (raw.Status == "OPENED_WITHOUT_DECRYPT")
            return new("RESTRICTED_OPEN_SUCCEEDED_DECRYPT_NOT_TESTED", "RESTRICTED_OPEN_OBSERVED", raw);
        if (raw.Status == "NOT_RUN") return new("UNKNOWN", "RESTRICTED_OPERATION_NOT_RUN", raw);
        if (raw.Status == "FAILED" && raw.OperationStage == "INSPECT")
            return new("RESTRICTED_OPERATION_UNCLASSIFIED", "RESTRICTED_INSPECTION_FAILED_AFTER_OPEN", raw);
        bool matchingCodes = raw.NativeStatus is null || raw.NativeStatus == raw.ManagedHResult;
        if (raw.Status == "FAILED" && matchingCodes) {
            if (raw.FailureCategory == "CRYPTOGRAPHIC" && raw.ManagedHResult == BadKeyset)
                return new("BOUNDED_BAD_KEYSET_OBSERVED", "RAW_BAD_KEYSET_WITH_SURROUNDING_POSITIVE_CONTROLS", raw);
            if ((raw.FailureCategory == "CRYPTOGRAPHIC" && raw.ManagedHResult is NtePermission or Win32AccessDenied) ||
                (raw.FailureCategory == "UNAUTHORIZED_ACCESS" && raw.ManagedHResult == Win32AccessDenied))
                return new("BOUNDED_ACCESS_DENIED_OBSERVED", "RAW_ACCESS_DENIED_AT_IDENTIFIED_OPERATION_STAGE", raw);
        }
        return new("RESTRICTED_OPERATION_UNCLASSIFIED", "RAW_FAILURE_NOT_AN_ADMITTED_NO_ACCESS_RESULT", raw);
    }
}
