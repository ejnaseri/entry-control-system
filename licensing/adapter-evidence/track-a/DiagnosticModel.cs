using System;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly;

internal enum DiagnosticOutcome { PrimitiveSuccess, RejectedInput, UnknownFailure }

// Candidate-only allowlisted DTO. Never serialize the supplied input, Exception,
// Message, Data, InnerException, stack trace or provider metadata.
internal static class DiagnosticModel
{
    internal static string Capture(Action operation)
    {
        DiagnosticOutcome outcome;
        try { operation(); outcome = DiagnosticOutcome.PrimitiveSuccess; }
        catch (FormatException) { outcome = DiagnosticOutcome.RejectedInput; }
        catch { outcome = DiagnosticOutcome.UnknownFailure; }
        return Emit(outcome);
    }

    internal static string Emit(DiagnosticOutcome outcome)
    {
        string code = outcome switch {
            DiagnosticOutcome.PrimitiveSuccess => "ADP-F08",
            DiagnosticOutcome.RejectedInput => "INPUT_REFUSED",
            DiagnosticOutcome.UnknownFailure => "ADP-F06",
            _ => throw new ArgumentException("OUTCOME_REFUSED")
        };
        return JsonSerializer.Serialize(new {
            scope = "TEST_ONLY_DIAGNOSTIC_MODEL", runtimeAuthority = "NONE",
            durable = false, diagnostic = new { events = new[] { new { code } } }
        });
    }

    // Recursive closed-schema check, including property names and array entries.
    // This validates this candidate DTO only; it is not deployed C_AUDIT.
    internal static void Validate(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Exact(root, "scope", "runtimeAuthority", "durable", "diagnostic");
        if (root.GetProperty("scope").GetString() != "TEST_ONLY_DIAGNOSTIC_MODEL" ||
            root.GetProperty("runtimeAuthority").GetString() != "NONE" ||
            root.GetProperty("durable").ValueKind != JsonValueKind.False)
            throw new FormatException("DIAGNOSTIC_REFUSED");
        var diagnostic = root.GetProperty("diagnostic"); Exact(diagnostic, "events");
        var events = diagnostic.GetProperty("events");
        if (events.ValueKind != JsonValueKind.Array || events.GetArrayLength() != 1)
            throw new FormatException("DIAGNOSTIC_REFUSED");
        foreach (var entry in events.EnumerateArray())
        {
            Exact(entry, "code");
            if (entry.GetProperty("code").GetString() is not ("ADP-F08" or "INPUT_REFUSED" or "ADP-F06"))
                throw new FormatException("DIAGNOSTIC_REFUSED");
        }
    }
    private static void Exact(JsonElement value, params string[] names)
    {
        if (value.ValueKind != JsonValueKind.Object) throw new FormatException("DIAGNOSTIC_REFUSED");
        var actual = value.EnumerateObject().Select(p => p.Name).ToArray();
        if (actual.Length != names.Length || actual.Distinct(StringComparer.Ordinal).Count() != actual.Length ||
            actual.Any(n => !names.Contains(n, StringComparer.Ordinal)))
            throw new FormatException("DIAGNOSTIC_REFUSED");
    }
}
