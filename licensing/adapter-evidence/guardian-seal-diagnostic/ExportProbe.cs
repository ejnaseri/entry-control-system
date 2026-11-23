namespace EntryControl.TestOnly.Diagnostics;

// Diagnostic-only split of the three private-export observations.
internal static class ExportProbe
{
    internal static void Check(string? step, Func<CngKeyBlobFormat, byte[]> export)
    {
        CngKeyBlobFormat format = step switch {
            "private-export-generic" => CngKeyBlobFormat.GenericPrivateBlob,
            "private-export-pkcs8" => CngKeyBlobFormat.Pkcs8PrivateBlob,
            "private-export-opaque" => CngKeyBlobFormat.OpaqueTransportBlob,
            _ => throw new InvalidDataException("EXPORT_STEP_REFUSED")
        };
        byte[]? bytes = null;
        try { bytes = export(format); }
        catch (CryptographicException error) when (error.InnerException is null && unchecked((uint)error.HResult) == 0x80090010) { return; }
        finally { if (bytes is not null) CryptographicOperations.ZeroMemory(bytes); }
        throw new InvalidDataException("PRIVATE_EXPORT_SUCCEEDED");
    }

    private sealed class WrappedCryptographicException : CryptographicException
    {
        internal WrappedCryptographicException(int status, string message, Exception inner) : base(message, inner) => HResult = status;
    }

    internal static int SelfTest()
    {
        int count = 0;
        void Assert(bool value) { if (!value) throw new InvalidDataException("EXPORT_PROBE_TEST_FAILED"); count++; }
        Exception Capture(Action operation)
        {
            try { operation(); }
            catch (Exception error) { return error; }
            throw new InvalidDataException("EXPORT_PROBE_REFUSAL_MISSING");
        }
        const int denied = unchecked((int)0x80090010), unsupported = unchecked((int)0x80090029);
        const string canary = "SECRET_CANARY";
        string[] steps = { "private-export-generic", "private-export-pkcs8", "private-export-opaque" };
        CngKeyBlobFormat[] formats = {
            CngKeyBlobFormat.GenericPrivateBlob, CngKeyBlobFormat.Pkcs8PrivateBlob, CngKeyBlobFormat.OpaqueTransportBlob
        };
        Assert(Diagnostic.Steps.SequenceEqual(new[] {
            "read-intent", "read-owned", "validate-ownership", "read-public-control",
            "validate-public-control", "open-key", "verify-policy-public-identity",
            "private-export-generic", "private-export-pkcs8", "private-export-opaque", "seal-roundtrip-memory"
        }));
        var deniedFormats = new List<CngKeyBlobFormat>();
        for (int i = 0; i < steps.Length; i++) {
            int calls = 0; CngKeyBlobFormat? observed = null;
            Check(steps[i], format => {
                calls++; observed = format; deniedFormats.Add(format); throw new CryptographicException(denied);
            });
            Assert(calls == 1);
            Assert(observed == formats[i]);
        }
        Assert(deniedFormats.SequenceEqual(formats));

        // Every supported/unsupported combination observes all three exports in
        // order, but only three denied exports permit the seal step.
        for (int unsupportedMask = 0; unsupportedMask < 8; unsupportedMask++) {
            var visited = new List<string>(); var exported = new List<CngKeyBlobFormat>();
            Observation[] rows = Diagnostic.Sequence(step => {
                visited.Add(step);
                int index = Array.IndexOf(steps, step);
                if (index < 0) return;
                Check(step, format => {
                    exported.Add(format);
                    throw new CryptographicException((unsupportedMask & (1 << index)) == 0 ? denied : unsupported);
                });
            });
            int length = unsupportedMask == 0 ? 11 : 10;
            Assert(visited.SequenceEqual(Diagnostic.Steps.Take(length)));
            Assert(exported.SequenceEqual(formats));
            Assert(rows.Length == length && rows.Take(7).All(row => row.Status == "PASS" && row.Failure is null));
            for (int i = 0; i < steps.Length; i++) {
                bool unknown = (unsupportedMask & (1 << i)) != 0;
                Assert(rows[7 + i].Step == steps[i] && rows[7 + i].Status == (unknown ? "UNKNOWN" : "PASS") &&
                    rows[7 + i].Failure == (unknown ? new Failure("CRYPTOGRAPHIC", unsupported, unsupported, 0) : null));
            }
            Assert(unsupportedMask == 0
                ? rows[^1].Step == "seal-roundtrip-memory" && rows[^1].Status == "PASS" && rows[^1].Failure is null
                : !visited.Contains("seal-roundtrip-memory") && !rows.Any(row => row.Step == "seal-roundtrip-memory"));
        }

        var wrappedUnsupported = new WrappedCryptographicException(unsupported, canary, new CryptographicException(denied));
        var wrappedDenied = new WrappedCryptographicException(denied, canary, new CryptographicException(unsupported));
        foreach (var wrapped in new[] { wrappedUnsupported, wrappedDenied }) {
            wrapped.Data[canary] = canary;
            var described = Diagnostic.Describe(wrapped);
            var aggregate = Diagnostic.Describe(new AggregateException(canary, wrapped));
            Assert(described == new Failure("CRYPTOGRAPHIC", wrapped.HResult, wrapped.HResult, 1));
            Assert(aggregate == new Failure("CRYPTOGRAPHIC", wrapped.HResult, wrapped.HResult, 2));
            Assert(!Diagnostic.CanContinueExport(steps[0], described) && !Diagnostic.CanContinueExport(steps[0], aggregate));
            string json = JsonSerializer.Serialize(new[] { described, aggregate });
            Assert(!json.Contains(canary) && !json.Contains("\"Message\"") && !json.Contains("\"StackTrace\"") && !json.Contains("\"Data\""));
            Exception deep = wrapped;
            for (int i = 0; i < 7; i++) deep = new AggregateException(deep);
            Assert(Diagnostic.Describe(deep) == new Failure("CRYPTOGRAPHIC", wrapped.HResult, wrapped.HResult, 8));
            Assert(Diagnostic.Describe(new AggregateException(deep)) == new Failure("CRYPTOGRAPHIC", wrapped.HResult, wrapped.HResult, 8));
        }

        Exception[] rejected = {
            new CryptographicException(unchecked((int)0x80090016)),
            new CryptographicException(canary, new CryptographicException(denied)),
            new AggregateException(canary, new CryptographicException(denied)),
            new System.Reflection.TargetInvocationException(canary, new CryptographicException(denied)),
            new CryptographicException(canary, new CryptographicException(unsupported)),
            new AggregateException(canary, new CryptographicException(unsupported)),
            new System.Reflection.TargetInvocationException(canary, new CryptographicException(unsupported)),
            wrappedUnsupported,
            wrappedDenied,
            new AggregateException(canary, wrappedUnsupported),
            new AggregateException(canary, wrappedDenied),
            new UnauthorizedAccessException(canary),
            new NotSupportedException(canary),
            new IOException(canary),
            new InvalidOperationException(canary)
        };
        foreach (Exception expected in rejected) {
            expected.Data[canary] = canary;
            for (int i = 0; i < steps.Length; i++) {
                int calls = 0; CngKeyBlobFormat? observed = null;
                Exception actual = Capture(() => Check(steps[i], format => {
                    calls++; observed = format; throw expected;
                }));
                Assert(ReferenceEquals(actual, expected));
                Assert(calls == 1 && observed == formats[i]);

                var visited = new List<string>(); var exported = new List<CngKeyBlobFormat>();
                Observation[] rows = Diagnostic.Sequence(step => {
                    visited.Add(step);
                    if (Array.IndexOf(steps, step) < 0) return;
                    Check(step, format => {
                        exported.Add(format);
                        if (step == steps[i]) throw expected;
                        throw new CryptographicException(denied);
                    });
                });
                Assert(visited.SequenceEqual(Diagnostic.Steps.Take(8 + i)));
                Assert(exported.SequenceEqual(formats.Take(i + 1)));
                Assert(rows.Length == 8 + i && rows[^1].Step == steps[i] && rows[^1].Status == "UNKNOWN" &&
                    rows.Take(rows.Length - 1).All(row => row.Status == "PASS" && row.Failure is null));
                Assert(rows[^1].Failure == Diagnostic.Describe(expected));
                string json = JsonSerializer.Serialize(rows);
                Assert(!visited.Contains("seal-roundtrip-memory") && !json.Contains(canary) &&
                    !json.Contains("\"Message\"") && !json.Contains("\"StackTrace\"") && !json.Contains("\"Data\""));
            }
            // Earlier unsupported observations never make a later failure
            // eligible for continuation or permit a seal operation.
            for (int failedIndex = 1; failedIndex < steps.Length; failedIndex++) {
                for (int unknownIndex = 0; unknownIndex < failedIndex; unknownIndex++) {
                    var visited = new List<string>(); var exported = new List<CngKeyBlobFormat>();
                    Observation[] rows = Diagnostic.Sequence(step => {
                        visited.Add(step);
                        int index = Array.IndexOf(steps, step);
                        if (index < 0) return;
                        Check(step, format => {
                            exported.Add(format);
                            if (index == failedIndex) throw expected;
                            throw new CryptographicException(index == unknownIndex ? unsupported : denied);
                        });
                    });
                    Assert(visited.SequenceEqual(Diagnostic.Steps.Take(8 + failedIndex)) &&
                        exported.SequenceEqual(formats.Take(failedIndex + 1)));
                    Assert(rows.Length == 8 + failedIndex && rows[7 + unknownIndex].Status == "UNKNOWN" &&
                        rows[7 + unknownIndex].Failure == new Failure("CRYPTOGRAPHIC", unsupported, unsupported, 0) &&
                        rows.Take(rows.Length - 1).Where((_, index) => index != 7 + unknownIndex)
                            .All(row => row.Status == "PASS" && row.Failure is null));
                    Assert(rows[^1].Step == steps[failedIndex] && rows[^1].Status == "UNKNOWN" &&
                        rows[^1].Failure == Diagnostic.Describe(expected));
                    Assert(!visited.Contains("seal-roundtrip-memory") && !JsonSerializer.Serialize(rows).Contains(canary));
                }
            }
        }

        for (int i = 0; i < steps.Length; i++) {
            foreach (byte[] bytes in new[] { Array.Empty<byte>(), Encoding.UTF8.GetBytes(canary) }) {
                int calls = 0; CngKeyBlobFormat? observed = null;
                Exception actual = Capture(() => Check(steps[i], format => {
                    calls++; observed = format; return bytes;
                }));
                Assert(calls == 1 && observed == formats[i]);
                Assert(actual is InvalidDataException && actual.Message == "PRIVATE_EXPORT_SUCCEEDED");
                Assert(bytes.All(value => value == 0));

                // Refill the same buffer so the Sequence path also proves erasure.
                if (bytes.Length > 0) Encoding.UTF8.GetBytes(canary).CopyTo(bytes, 0);
                var visited = new List<string>(); var exported = new List<CngKeyBlobFormat>();
                Observation[] rows = Diagnostic.Sequence(step => {
                    visited.Add(step);
                    if (Array.IndexOf(steps, step) < 0) return;
                    Check(step, format => {
                        exported.Add(format);
                        if (step == steps[i]) return bytes;
                        throw new CryptographicException(denied);
                    });
                });
                Assert(visited.SequenceEqual(Diagnostic.Steps.Take(8 + i)) && exported.SequenceEqual(formats.Take(i + 1)));
                Assert(rows[^1].Step == steps[i] && rows[^1].Status == "UNKNOWN" &&
                    rows[^1].Failure == Diagnostic.Describe(actual) && rows.Take(rows.Length - 1).All(row => row.Status == "PASS"));
                Assert(bytes.All(value => value == 0) && !visited.Contains("seal-roundtrip-memory") &&
                    !JsonSerializer.Serialize(rows).Contains(canary));
                if (i > 0) {
                    if (bytes.Length > 0) Encoding.UTF8.GetBytes(canary).CopyTo(bytes, 0);
                    visited.Clear(); exported.Clear();
                    rows = Diagnostic.Sequence(step => {
                        visited.Add(step);
                        if (Array.IndexOf(steps, step) < 0) return;
                        Check(step, format => {
                            exported.Add(format);
                            if (step == steps[i]) return bytes;
                            throw new CryptographicException(step == steps[0] ? unsupported : denied);
                        });
                    });
                    Assert(visited.SequenceEqual(Diagnostic.Steps.Take(8 + i)) && exported.SequenceEqual(formats.Take(i + 1)));
                    Assert(rows.Length == 8 + i && rows[7].Status == "UNKNOWN" &&
                        rows[7].Failure == new Failure("CRYPTOGRAPHIC", unsupported, unsupported, 0) &&
                        rows[^1].Step == steps[i] && rows[^1].Status == "UNKNOWN" && rows[^1].Failure == Diagnostic.Describe(actual));
                    Assert(bytes.All(value => value == 0) && !visited.Contains("seal-roundtrip-memory") &&
                        !JsonSerializer.Serialize(rows).Contains(canary));
                }
            }
        }

        foreach (string? step in new string?[] {
            null, "", "private-export-denied", "private-export-generic ", "PRIVATE-EXPORT-GENERIC", "seal-roundtrip-memory"
        }) {
            int calls = 0;
            Exception actual = Capture(() => Check(step, _ => { calls++; return Array.Empty<byte>(); }));
            Assert(actual is InvalidDataException && actual.Message == "EXPORT_STEP_REFUSED");
            Assert(calls == 0);
        }
        var allVisited = new List<string>(); var allExported = new List<CngKeyBlobFormat>();
        Observation[] passing = Diagnostic.Sequence(step => {
            allVisited.Add(step);
            if (Array.IndexOf(steps, step) >= 0)
                Check(step, format => { allExported.Add(format); throw new CryptographicException(denied); });
        });
        Assert(allVisited.SequenceEqual(Diagnostic.Steps) && allExported.SequenceEqual(formats));
        Assert(passing.Length == 11 && passing.All(row => row.Status == "PASS" && row.Failure is null));
        return count;
    }
}
