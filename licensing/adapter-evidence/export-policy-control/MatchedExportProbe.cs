using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Security.Cryptography;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal enum ExportFormat { GenericPrivate, Pkcs8, OpaqueTransport }

// These are synthetic caller assertions, NOT authenticated native observations.
// A future physical collector must independently establish every field. Names,
// identity hashes and DACL hashes are never copied to an observation report.
internal sealed record KeySnapshot(
    string? Name,
    string? Provider,
    string? Algorithm,
    int KeyBits,
    bool MachineKey,
    bool Persisted,
    int Usage,
    int ExportPolicy,
    bool ProtectedDacl,
    string? DaclSha256,
    string? CreatedPublicIdentitySha256,
    string? ReopenedPublicIdentitySha256);

// ManagedHResult is exactly that: it is NOT an independently captured native
// NCrypt status, nor does it identify which native export sub-call failed.
internal sealed record ExportObservation(string Status, string? FailureKind, int? ManagedHResult);
internal sealed record PairObservation(
    string Format,
    ExportObservation Exportable,
    ExportObservation NonExportable,
    string Outcome);

// Interpretation only. A native evidence envelope must establish its own
// admission/identity/bindings; the synthetic ProbeReport is never relabelled.
internal sealed class ComparisonResult
{
    public string Outcome { get; }
    public string? RefusalReason { get; }
    public IReadOnlyList<PairObservation> Pairs { get; }
    internal ComparisonResult(string outcome, string? refusalReason, IEnumerable<PairObservation> pairs)
    {
        Outcome = outcome; RefusalReason = refusalReason;
        Pairs = Array.AsReadOnly(new List<PairObservation>(pairs).ToArray());
    }
}

internal sealed class ProbeReport
{
    public string Scope => "TEST_ONLY_EXPORT_POLICY_CONTROL_SYNTHETIC_V1";
    public bool Synthetic => true;
    public bool MetadataAuthenticated => false;
    public bool PhysicalExecutionEnabled => false;
    public bool PhysicalTested => false;
    public bool SecurityAccepted => false;
    public bool ProductionAccepted => false;
    public bool SealAuthorized => false;
    public string Outcome { get; }
    public string? RefusalReason { get; }
    public IReadOnlyList<PairObservation> Pairs { get; }

    internal ProbeReport(string outcome, string? refusalReason, List<PairObservation> pairs)
    {
        Outcome = outcome;
        RefusalReason = refusalReason;
        Pairs = new ReadOnlyCollection<PairObservation>(pairs.ToArray());
    }
}

internal static class MatchedExportProbe
{
    internal const string Provider = "Microsoft Software Key Storage Provider";
    internal const int Denied = unchecked((int)0x80090010);
    internal const int Unsupported = unchecked((int)0x80090029);
    private static readonly ExportFormat[] Formats = {
        ExportFormat.GenericPrivate, ExportFormat.Pkcs8, ExportFormat.OpaqueTransport
    };
    private static readonly ExportObservation NotRun = new("NOT_RUN", null, null);

    internal static ProbeReport Run(
        KeySnapshot? exportable,
        KeySnapshot? nonExportable,
        Func<ExportFormat, byte[]?>? exportableExport,
        Func<ExportFormat, byte[]?>? nonExportableExport)
    {
        var result = Evaluate(exportable, nonExportable, exportableExport, nonExportableExport);
        return new(result.Outcome, result.RefusalReason, new List<PairObservation>(result.Pairs));
    }

    internal static ComparisonResult Evaluate(
        KeySnapshot? exportable, KeySnapshot? nonExportable,
        Func<ExportFormat, byte[]?>? exportableExport,
        Func<ExportFormat, byte[]?>? nonExportableExport)
    {
        var pairs = new List<PairObservation>();
        if (exportableExport is null || nonExportableExport is null)
            return new("INPUT_REFUSED", "CALLBACK_MISSING", pairs);
        if (!Matched(exportable, nonExportable))
            return new("INPUT_REFUSED", "SNAPSHOT_MISMATCH", pairs);

        bool inconclusive = false;
        foreach (ExportFormat format in Formats) {
            // Every format has its own positive control. A different format's
            // success must never be borrowed as evidence of export support.
            ExportObservation positive = Observe(format, exportableExport, restricted: false);
            if (positive.Status == "UNKNOWN") {
                pairs.Add(new(FormatName(format), positive, NotRun, "UNKNOWN"));
                return new("UNKNOWN", null, pairs);
            }
            ExportObservation negative = Observe(format, nonExportableExport, restricted: true);
            if (negative.Status is "UNKNOWN" or "BOUNDARY_FAILURE") {
                pairs.Add(new(FormatName(format), positive, negative, negative.Status));
                return new(negative.Status, null, pairs);
            }
            string outcome = positive.Status == "EXPORTED"
                ? "POLICY_DIFFERENTIAL_OBSERVED" : "CONTROL_INCONCLUSIVE";
            inconclusive |= outcome == "CONTROL_INCONCLUSIVE";
            pairs.Add(new(FormatName(format), positive, negative, outcome));
        }
        return new(inconclusive ? "CONTROL_INCONCLUSIVE" : "POLICY_DIFFERENTIAL_OBSERVED", null, pairs);
    }

    private static bool Matched(KeySnapshot? positive, KeySnapshot? negative) =>
        Valid(positive, 3) && Valid(negative, 0) &&
        positive!.Name != negative!.Name &&
        positive.DaclSha256 == negative.DaclSha256 &&
        positive.CreatedPublicIdentitySha256 != negative.CreatedPublicIdentitySha256;

    private static bool Valid(KeySnapshot? key, int policy) =>
        key is not null && !string.IsNullOrWhiteSpace(key.Name) &&
        key.Provider == Provider && key.Algorithm == "RSA" && key.KeyBits == 3072 &&
        key.MachineKey && key.Persisted && key.Usage == 1 && key.ExportPolicy == policy &&
        key.ProtectedDacl && IsSha256(key.DaclSha256) &&
        IsSha256(key.CreatedPublicIdentitySha256) &&
        key.CreatedPublicIdentitySha256 == key.ReopenedPublicIdentitySha256;

    private static bool IsSha256(string? value)
    {
        if (value is null || value.Length != 64) return false;
        foreach (char c in value)
            if (!(c is >= '0' and <= '9' or >= 'a' and <= 'f')) return false;
        return true;
    }

    private static string FormatName(ExportFormat format) => format switch {
        ExportFormat.GenericPrivate => "generic-private",
        ExportFormat.Pkcs8 => "pkcs8-private",
        ExportFormat.OpaqueTransport => "opaque-transport",
        _ => throw new InvalidOperationException("EXPORT_FORMAT_REFUSED")
    };

    private static ExportObservation Observe(ExportFormat format, Func<ExportFormat, byte[]?> export, bool restricted)
    {
        byte[]? bytes = null;
        try {
            bytes = export(format);
            // Any normal return from the restricted export is a boundary
            // failure, even malformed empty/null output. Never reinterpret it
            // as a successful denial. Positive controls require actual bytes.
            if (restricted) return new("BOUNDARY_FAILURE", "EXPORT_RETURNED", null);
            return bytes is { Length: > 0 }
                ? new("EXPORTED", null, null)
                : new("UNKNOWN", "MALFORMED_EXPORT_OUTPUT", null);
        }
        catch (Exception error) {
            if (error is CryptographicException crypto && crypto.InnerException is null &&
                (crypto.HResult == Denied || crypto.HResult == Unsupported))
                return new("ERROR_OBSERVED", "CRYPTOGRAPHIC", crypto.HResult);
            bool wrapped = error.InnerException is not null;
            return new("UNKNOWN", wrapped ? "WRAPPED_EXCEPTION" :
                error is CryptographicException ? "UNEXPECTED_CRYPTOGRAPHIC" : "UNEXPECTED_EXCEPTION", error.HResult);
        }
        finally {
            if (bytes is not null) CryptographicOperations.ZeroMemory(bytes);
        }
    }
}
