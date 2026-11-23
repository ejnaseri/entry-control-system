using System;
using System.IO;
using System.Security;
using System.Security.Cryptography;
using System.Threading;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Stable wire identifiers. Additions require a codec/test review; never reuse IDs.
internal enum ControlStartupStage
{
    ServiceArguments = 1, ServiceRunning = 2, ServiceIdentity = 3, RuntimeAdmission = 4,
    WorkerExecution = 5, WorkerCompletion = 6, ReportPublication = 7, IdentityRuntime = 8,
    IdentityImpersonation = 9, IdentityServiceSid = 10, IdentityOpenToken = 11, IdentityUser = 12,
    IdentityOwner = 13, IdentityType = 14, IdentityElevation = 15, IdentityRestriction = 16,
    IdentityGroups = 17, IdentityShape = 18, IdentityOwnerRule = 19, IdentityGroupRule = 20,
    AdmissionPins = 21, AdmissionPlanRead = 22, AdmissionPlanBinding = 23, AdmissionReservationRead = 24,
    AdmissionSession = 25, AdmissionProcess = 26, ContextSession = 27, ContextIdentity = 28,
    ContextBoot = 29, ContextHost = 30, EnvironmentProcess = 31, EnvironmentRegistry = 32,
    EnvironmentMachine = 33, EnvironmentService = 34, PackageRead = 35, PackageBinding = 36,
    PackagePaths = 37, PackageInventory = 38, PackageFiles = 39, PackagePlanBinding = 40,
    RuntimeInventory = 41, SetupPredecessor = 42, SetupConsumedWrite = 43, GuardianConsumedWrite = 44
}

internal sealed record ControlStartupDiagnostic(string Stage, string Category,
    int? ManagedHResult, bool HResultListed, string EvidenceAuthority);

// One DWORD cannot contain an arbitrary HRESULT plus a stage and category.
// This version encodes an exact allowlisted HRESULT index, never low bits of
// an unknown value. Index zero explicitly means the HRESULT was not retained.
// SCM transport is an observation, never authenticated evidence or exit proof.
internal static class ControlStartupDiagnostics
{
    internal const uint ServiceSpecificError = 1066;
    private const uint Prefix = 0xec100000, PrefixMask = 0xfff00000;
    private static readonly string[] Categories = {
        "", "WRAPPED_EXCEPTION", "CRYPTOGRAPHIC", "VALIDATION", "ACCESS", "IO", "SECURITY", "OTHER"
    };
    private static readonly int?[] HResults = {
        null,
        unchecked((int)0x80131501), // InvalidDataException
        unchecked((int)0x8013150a), // SecurityException
        unchecked((int)0x80070005), // access denied
        unchecked((int)0x80131620), // IOException
        unchecked((int)0x80131509), // InvalidOperationException
        unchecked((int)0x80070057), // invalid argument
        unchecked((int)0x80070002), // file not found
        unchecked((int)0x80070003), // directory not found
        unchecked((int)0x80131500), // generic managed exception
        unchecked((int)0x80131505), // timeout
        unchecked((int)0x80131515), // not supported
        unchecked((int)0x80131622)  // disposed object
    };

    internal static uint Encode(ControlStartupStage stage, Exception error)
    {
        RequireStage(stage);
        ArgumentNullException.ThrowIfNull(error);
        uint category = error.InnerException is not null ? 1u : error switch {
            CryptographicException => 2u, InvalidDataException => 3u,
            UnauthorizedAccessException => 4u, IOException => 5u,
            SecurityException => 6u, _ => 7u
        };
        int index = Array.IndexOf(HResults, (int?)error.HResult);
        if (index < 0) index = 0;
        return Prefix | ((uint)stage << 12) | (category << 8) | (uint)index;
    }

    internal static ControlStartupDiagnostic? Decode(uint win32Exit, uint serviceExit)
    {
        if (win32Exit != ServiceSpecificError || (serviceExit & PrefixMask) != Prefix) return null;
        int stage = (int)((serviceExit >> 12) & 255), category = (int)((serviceExit >> 8) & 15);
        int index = (int)(serviceExit & 255);
        if (!Enum.IsDefined(typeof(ControlStartupStage), stage) || category == 0 ||
            category >= Categories.Length || index >= HResults.Length) return null;
        return new(((ControlStartupStage)stage).ToString(), Categories[category], HResults[index],
            index != 0, "NONE");
    }

    internal static void RequireStage(ControlStartupStage stage) =>
        ControlRules.Need(Enum.IsDefined(stage), "CONTROL_DIAGNOSTIC_STAGE_REFUSED");
}

// Explicit per-dispatch reference crosses both Task boundaries. Only the first
// failure is retained, so later report/status errors cannot replace the cause.
// No exception object, message, stack, data, path or key bytes are stored.
internal sealed class ControlStartupTrace
{
    private sealed record Failure(uint Code);
    private Failure? firstFailure;
    internal uint? FirstFailureCode => Volatile.Read(ref firstFailure)?.Code;

    internal void Record(ControlStartupStage stage, Exception error)
    {
        var failure = new Failure(ControlStartupDiagnostics.Encode(stage, error));
        Interlocked.CompareExchange(ref firstFailure, failure, null);
    }

    internal T At<T>(ControlStartupStage stage, Func<T> action)
    {
        ControlStartupDiagnostics.RequireStage(stage);
        ArgumentNullException.ThrowIfNull(action);
        try { return action(); }
        catch (Exception error) { Record(stage, error); throw; }
    }
    internal void At(ControlStartupStage stage, Action action)
    {
        ArgumentNullException.ThrowIfNull(action);
        At(stage, () => { action(); return true; });
    }

    // Existing non-service callers retain the same behavior without telemetry.
    internal static T At<T>(ControlStartupTrace? trace, ControlStartupStage stage, Func<T> action) =>
        trace is null ? action() : trace.At(stage, action);
    internal static void At(ControlStartupTrace? trace, ControlStartupStage stage, Action action)
    { if (trace is null) action(); else trace.At(stage, action); }
}
