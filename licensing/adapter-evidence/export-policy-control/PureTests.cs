using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal static class PureTests
{
    private const string Canary = "PRIVATE_BYTES_NAME_EXCEPTION_CANARY";
    private const int Denied = MatchedExportProbe.Denied;
    private const int Unsupported = MatchedExportProbe.Unsupported;
    private static readonly ExportFormat[] Formats = {
        ExportFormat.GenericPrivate, ExportFormat.Pkcs8, ExportFormat.OpaqueTransport
    };
    private static readonly string[] FormatNames = { "generic-private", "pkcs8-private", "opaque-transport" };

    private sealed class WrappedCrypto : CryptographicException
    {
        internal WrappedCrypto(int status) : base(Canary, new CryptographicException(status)) => HResult = status;
    }

    private static KeySnapshot Snapshot(bool positive) => new(
        Canary + (positive ? "-positive" : "-negative"), MatchedExportProbe.Provider,
        "RSA", 3072, true, true, 1, positive ? 3 : 0, true,
        new string('d', 64), new string(positive ? 'a' : 'b', 64), new string(positive ? 'a' : 'b', 64));

    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) { if (!condition) throw new InvalidOperationException("PURE_ASSERTION_FAILED"); cases++; }
        KeySnapshot positive = Snapshot(true), negative = Snapshot(false);
        void Private(ProbeReport report)
        {
            string json = JsonSerializer.Serialize(report);
            Check(!json.Contains(Canary) && !json.Contains(Convert.ToBase64String(Encoding.UTF8.GetBytes(Canary))) &&
                !json.Contains(positive.DaclSha256!) && !json.Contains(positive.CreatedPublicIdentitySha256!) &&
                !json.Contains(negative.CreatedPublicIdentitySha256!));
            Check(!json.Contains("StackTrace") && !json.Contains("Message") && !json.Contains("\"Data\"") &&
                !json.Contains("NativeStatus") && !json.Contains("PASS"));
            Check(report.Synthetic && !report.MetadataAuthenticated && !report.PhysicalExecutionEnabled &&
                !report.PhysicalTested && !report.SecurityAccepted && !report.ProductionAccepted && !report.SealAuthorized);
            Check(report.Scope == "TEST_ONLY_EXPORT_POLICY_CONTROL_SYNTHETIC_V1");
        }

        // Route checks never execute an external/native action.
        Check(Program.IsSelfTest(new[] { "--self-test" }));
        foreach (string[]? args in new string[]?[] {
            null, Array.Empty<string>(), new[] { "--run" }, new[] { "--service", "Guardian" },
            new[] { "--prepare" }, new[] { "--controller" }, new[] { "--diagnostic-service" },
            new[] { "--self-test", "--run" }, new[] { " --self-test" }, new[] { "--SELF-TEST" },
            new[] { "--self-test " }, new[] { "--prepare-diagnostic-input", Canary, Canary }
        }) Check(!Program.IsSelfTest(args));

        // Every individual admission field must fail before either callback.
        var invalid = new List<KeySnapshot?> {
            null, positive with { Name = null }, positive with { Name = "" }, positive with { Name = " " },
            positive with { Provider = null }, positive with { Provider = "Other KSP" },
            positive with { Provider = MatchedExportProbe.Provider.ToLowerInvariant() },
            positive with { Algorithm = "ECDSA" }, positive with { Algorithm = "rsa" },
            positive with { KeyBits = 2048 }, positive with { KeyBits = 4096 },
            positive with { MachineKey = false }, positive with { Persisted = false },
            positive with { Usage = 0 }, positive with { Usage = 2 }, positive with { Usage = 3 },
            positive with { ExportPolicy = 0 }, positive with { ExportPolicy = 1 },
            positive with { ExportPolicy = 2 }, positive with { ExportPolicy = 7 },
            positive with { ProtectedDacl = false }, positive with { DaclSha256 = null },
            positive with { DaclSha256 = "" }, positive with { DaclSha256 = new string('D', 64) },
            positive with { DaclSha256 = new string('d', 63) }, positive with { DaclSha256 = new string('g', 64) },
            positive with { CreatedPublicIdentitySha256 = null },
            positive with { CreatedPublicIdentitySha256 = "", ReopenedPublicIdentitySha256 = "" },
            positive with { CreatedPublicIdentitySha256 = new string('g', 64), ReopenedPublicIdentitySha256 = new string('g', 64) },
            positive with { ReopenedPublicIdentitySha256 = null },
            positive with { ReopenedPublicIdentitySha256 = new string('c', 64) },
            positive with { Name = negative.Name }, positive with { DaclSha256 = new string('c', 64) },
            positive with { CreatedPublicIdentitySha256 = negative.CreatedPublicIdentitySha256,
                ReopenedPublicIdentitySha256 = negative.ReopenedPublicIdentitySha256 }
        };
        foreach (KeySnapshot? bad in invalid) {
            int calls = 0;
            byte[] Callback(ExportFormat _) { calls++; return Encoding.UTF8.GetBytes(Canary); }
            ProbeReport report = MatchedExportProbe.Run(bad, negative, Callback, Callback);
            Check(report.Outcome == "INPUT_REFUSED" && report.RefusalReason == "SNAPSHOT_MISMATCH");
            Check(report.Pairs.Count == 0 && calls == 0);
            Private(report);
        }
        // Mirror common invalid fields into the non-exportable snapshot too.
        foreach (KeySnapshot? bad in invalid.Take(31)) {
            KeySnapshot? mirrored = bad is null ? null : bad with {
                Name = bad.Name is null ? null : bad.Name.Replace("positive", "negative"),
                ExportPolicy = 0,
                CreatedPublicIdentitySha256 = bad.CreatedPublicIdentitySha256 == positive.CreatedPublicIdentitySha256
                    ? negative.CreatedPublicIdentitySha256 : bad.CreatedPublicIdentitySha256,
                ReopenedPublicIdentitySha256 = bad.ReopenedPublicIdentitySha256 == positive.ReopenedPublicIdentitySha256
                    ? negative.ReopenedPublicIdentitySha256 : bad.ReopenedPublicIdentitySha256
            };
            // Policy mutations were positive-specific; cover them separately below.
            if (bad is not null && bad.ExportPolicy != 3) continue;
            int calls = 0;
            ProbeReport report = MatchedExportProbe.Run(positive, mirrored, _ => { calls++; return null; }, _ => { calls++; return null; });
            Check(report.Outcome == "INPUT_REFUSED" && report.Pairs.Count == 0 && calls == 0);
            Private(report);
        }
        foreach (KeySnapshot bad in new[] {
            negative with { Name = positive.Name },
            negative with { DaclSha256 = new string('c', 64) },
            negative with { CreatedPublicIdentitySha256 = positive.CreatedPublicIdentitySha256,
                ReopenedPublicIdentitySha256 = positive.ReopenedPublicIdentitySha256 }
        }) {
            int calls = 0;
            ProbeReport report = MatchedExportProbe.Run(positive, bad,
                _ => { calls++; return null; }, _ => { calls++; return null; });
            Check(report.Outcome == "INPUT_REFUSED" && report.Pairs.Count == 0 && calls == 0);
            Private(report);
        }
        int swappedCalls = 0;
        Check(MatchedExportProbe.Run(negative, positive, _ => { swappedCalls++; return null; },
            _ => { swappedCalls++; return null; }).Outcome == "INPUT_REFUSED" && swappedCalls == 0);
        foreach (int policy in new[] { -1, 1, 2, 3, 4, 7 }) {
            int calls = 0;
            ProbeReport report = MatchedExportProbe.Run(positive, negative with { ExportPolicy = policy },
                _ => { calls++; return null; }, _ => { calls++; return null; });
            Check(report.Outcome == "INPUT_REFUSED" && calls == 0);
        }
        foreach (bool missingPositive in new[] { false, true }) {
            int calls = 0;
            Func<ExportFormat, byte[]?> callback = _ => { calls++; return null; };
            ProbeReport report = MatchedExportProbe.Run(positive, negative,
                missingPositive ? null : callback, missingPositive ? callback : null);
            Check(report.Outcome == "INPUT_REFUSED" && report.RefusalReason == "CALLBACK_MISSING" && calls == 0);
            Private(report);
        }
        Check(MatchedExportProbe.Run(positive, negative, null, null).Outcome == "INPUT_REFUSED");

        // 6 independent per-format pairs, across all three formats (216
        // combinations): exportable success/10/29 by restricted 10/29.
        for (int matrix = 0; matrix < 216; matrix++) {
            int value = matrix;
            var controls = new int[3]; var negatives = new int[3];
            for (int i = 0; i < 3; i++) { controls[i] = value % 3; value /= 3; negatives[i] = value % 2; value /= 2; }
            var order = new List<string>(); var buffers = new List<byte[]>();
            ProbeReport report = MatchedExportProbe.Run(positive, negative,
                format => {
                    int i = Array.IndexOf(Formats, format); order.Add("positive:" + i);
                    if (controls[i] != 0) throw new CryptographicException(controls[i] == 1 ? Denied : Unsupported);
                    byte[] bytes = Encoding.UTF8.GetBytes(Canary); buffers.Add(bytes); return bytes;
                },
                format => {
                    int i = Array.IndexOf(Formats, format); order.Add("negative:" + i);
                    Check(buffers.All(bytes => bytes.All(b => b == 0))); // erased BEFORE next callback
                    throw new CryptographicException(negatives[i] == 0 ? Denied : Unsupported);
                });
            Check(order.SequenceEqual(new[] { "positive:0", "negative:0", "positive:1", "negative:1", "positive:2", "negative:2" }));
            Check(report.Pairs.Count == 3 && report.RefusalReason is null);
            Check(report.Outcome == (controls.All(c => c == 0) ? "POLICY_DIFFERENTIAL_OBSERVED" : "CONTROL_INCONCLUSIVE"));
            for (int i = 0; i < 3; i++) {
                PairObservation pair = report.Pairs[i];
                Check(pair.Format == FormatNames[i]);
                Check(pair.Exportable.Status == (controls[i] == 0 ? "EXPORTED" : "ERROR_OBSERVED"));
                Check(pair.Exportable.ManagedHResult == (controls[i] == 0 ? null : controls[i] == 1 ? Denied : Unsupported));
                Check(pair.NonExportable.Status == "ERROR_OBSERVED" && pair.NonExportable.FailureKind == "CRYPTOGRAPHIC" &&
                    pair.NonExportable.ManagedHResult == (negatives[i] == 0 ? Denied : Unsupported));
                Check(pair.Outcome == (controls[i] == 0 ? "POLICY_DIFFERENTIAL_OBSERVED" : "CONTROL_INCONCLUSIVE"));
            }
            Check(buffers.All(bytes => bytes.All(b => b == 0)));
            Private(report);
        }

        // Every unexpected/wrapped error stops at its exact position; earlier
        // unsupported controls do not grant later continuation or any seal.
        Exception[] failures = {
            new CryptographicException(unchecked((int)0x80090016)),
            new CryptographicException(Canary), new WrappedCrypto(Denied), new WrappedCrypto(Unsupported),
            new AggregateException(Canary, new CryptographicException(Denied)),
            new AggregateException(Canary, new CryptographicException(Unsupported)),
            new System.Reflection.TargetInvocationException(Canary, new CryptographicException(Denied)),
            new System.Reflection.TargetInvocationException(Canary, new CryptographicException(Unsupported)),
            new InvalidOperationException(Canary), new NotSupportedException(Canary), new UnauthorizedAccessException(Canary)
        };
        foreach (Exception error in failures) {
            error.Data[Canary] = Canary;
            for (int stop = 0; stop < 6; stop++) {
                foreach (bool earlierUnsupported in new[] { false, true }) {
                    int calls = 0; var order = new List<string>(); var buffers = new List<byte[]>();
                    byte[]? Callback(ExportFormat format, bool restricted)
                    {
                        int index = Array.IndexOf(Formats, format) * 2 + (restricted ? 1 : 0);
                        order.Add((restricted ? "negative:" : "positive:") + Array.IndexOf(Formats, format)); calls++;
                        if (index == stop) throw error;
                        if (restricted || earlierUnsupported) throw new CryptographicException(earlierUnsupported ? Unsupported : Denied);
                        byte[] bytes = Encoding.UTF8.GetBytes(Canary); buffers.Add(bytes); return bytes;
                    }
                    ProbeReport report = MatchedExportProbe.Run(positive, negative,
                        format => Callback(format, false), format => Callback(format, true));
                    Check(calls == stop + 1 && report.Pairs.Count == stop / 2 + 1 && report.Outcome == "UNKNOWN");
                    Check(order.SequenceEqual(new[] { "positive:0", "negative:0", "positive:1", "negative:1", "positive:2", "negative:2" }.Take(stop + 1)));
                    PairObservation last = report.Pairs[^1];
                    ExportObservation failed = stop % 2 == 0 ? last.Exportable : last.NonExportable;
                    Check(last.Outcome == "UNKNOWN" && failed.Status == "UNKNOWN" && failed.ManagedHResult == error.HResult);
                    Check(failed.FailureKind == (error.InnerException is not null ? "WRAPPED_EXCEPTION" :
                        error is CryptographicException ? "UNEXPECTED_CRYPTOGRAPHIC" : "UNEXPECTED_EXCEPTION"));
                    if (stop % 2 == 0) Check(last.NonExportable.Status == "NOT_RUN");
                    Check(buffers.All(bytes => bytes.All(b => b == 0)));
                    Private(report);
                }
            }
        }

        // Positive null/empty results are not format-support proof. Negative
        // null/empty/nonempty results all stop as boundary failures; returned
        // nonempty buffers are erased without serializing their bytes/length.
        foreach (bool restricted in new[] { false, true }) {
            for (int formatIndex = 0; formatIndex < 3; formatIndex++) {
                for (int payload = 0; payload < (restricted ? 3 : 2); payload++) {
                    foreach (bool earlierUnsupported in new[] { false, true }) {
                        int stop = formatIndex * 2 + (restricted ? 1 : 0), calls = 0;
                        byte[]? returned = payload == 0 ? null : payload == 1 ? Array.Empty<byte>() : Encoding.UTF8.GetBytes(Canary);
                        var buffers = new List<byte[]>();
                        byte[]? Callback(ExportFormat format, bool negativeRole)
                        {
                            int index = Array.IndexOf(Formats, format) * 2 + (negativeRole ? 1 : 0); calls++;
                            if (index == stop) return returned;
                            if (negativeRole || earlierUnsupported) throw new CryptographicException(earlierUnsupported ? Unsupported : Denied);
                            byte[] bytes = Encoding.UTF8.GetBytes(Canary); buffers.Add(bytes); return bytes;
                        }
                        ProbeReport report = MatchedExportProbe.Run(positive, negative,
                            format => Callback(format, false), format => Callback(format, true));
                        Check(calls == stop + 1 && report.Pairs.Count == formatIndex + 1);
                        Check(report.Outcome == (restricted ? "BOUNDARY_FAILURE" : "UNKNOWN"));
                        ExportObservation observed = restricted ? report.Pairs[^1].NonExportable : report.Pairs[^1].Exportable;
                        Check(observed.Status == report.Outcome && observed.ManagedHResult is null &&
                            observed.FailureKind == (restricted ? "EXPORT_RETURNED" : "MALFORMED_EXPORT_OUTPUT"));
                        Check(returned is null || returned.All(b => b == 0));
                        Check(buffers.All(bytes => bytes.All(b => b == 0)));
                        if (!restricted) Check(report.Pairs[^1].NonExportable.Status == "NOT_RUN");
                        Private(report);
                    }
                }
            }
        }

        // Returned observations cannot be used to mutate completed evidence.
        ProbeReport immutable = MatchedExportProbe.Run(positive, negative,
            _ => new byte[] { 1 }, _ => throw new CryptographicException(Denied));
        Check(immutable.Pairs is System.Collections.ObjectModel.ReadOnlyCollection<PairObservation>);
        bool mutationRefused = false;
        try { ((IList<PairObservation>)immutable.Pairs).Clear(); }
        catch (NotSupportedException) { mutationRefused = true; }
        Check(mutationRefused && immutable.Pairs.Count == 3);
        Private(immutable);
        return cases;
    }
}
