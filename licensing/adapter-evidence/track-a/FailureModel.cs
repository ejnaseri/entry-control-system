using System;

namespace EntryControl.TestOnly;

internal enum Cause { Unknown, ProvenAbsence, IdentityMismatch, ProvenProviderOutage, AuthorityRefused, ContextRefused, PrimitiveSuccess }
internal static class FailureModel
{
    internal static string Classify(Cause cause, bool retainedOwnership, bool readiness) => cause switch
    {
        Cause.ProvenAbsence when retainedOwnership => "ADP-F01",
        Cause.IdentityMismatch => "ADP-F02",
        Cause.ProvenProviderOutage => "ADP-F03",
        Cause.AuthorityRefused => "ADP-F04",
        Cause.ContextRefused => "ADP-F05",
        Cause.PrimitiveSuccess => "ADP-F08",
        _ => readiness ? "ADP-F07" : "ADP-F06"
    };
    internal static string StoreError(bool hybrid, string outcome, bool commitAttempted)
    {
        if (outcome == "THREW" && !commitAttempted && !hybrid) return "READ_ONLY_CONFIRMATION_UNAVAILABLE";
        if (hybrid && !commitAttempted) throw new ArgumentException("NO_HYBRID_CONFIRM_PATH");
        return (hybrid, outcome) switch
        {
            (false, "CONFLICT") => "COMMIT_STATE_CONFLICT", (true, "CONFLICT") => "TRUSTED_RESPONSE_CONFLICT",
            (false, "PENDING") => "COMMIT_PENDING", (true, "PENDING") => "TRUSTED_RESPONSE_PENDING",
            (false, "BAD_ACK") => "COMMIT_ACKNOWLEDGEMENT_INVALID", (true, "BAD_ACK") => "TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID",
            (false, "THREW") => "COMMIT_OUTCOME_UNKNOWN", (true, "THREW") => "TRUSTED_RESPONSE_OUTCOME_UNKNOWN",
            _ => throw new ArgumentException("NO_FABRICATED_RECEIPT")
        };
    }
}

// Deterministic single-use simulated worker: no actual thread/native cancellation claim.
internal sealed class SimulatedDeadline
{
    private bool started;
    internal bool Active { get; private set; }
    internal bool Expired { get; private set; }
    internal bool Cleared { get; private set; }
    internal bool Delivered { get; private set; }
    internal void Start()
    {
        if (started) throw new InvalidOperationException("RESTART_OR_OVERLAP_REFUSED");
        started = true; Active = true;
    }
    internal void Expire() { if (!Active) throw new InvalidOperationException(); Expired = true; }
    internal void Complete() { if (!Active) throw new InvalidOperationException(); Delivered = !Expired; Active = false; Cleared = true; }
}
