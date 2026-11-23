using System;

namespace EntryControl.TestOnly.StandardUserControl;

// Pure representations, not evidence that either API was called. The original
// NetAPI-only SCRIPT bit is retained separately; a SAM observation cannot supply
// it. No type here authenticates a SID, object handle, freshness or permission.
internal sealed record StandardAccountFlagEncoding(uint SamUserAccountControl, uint NetApiOnlyFlags);
internal sealed record StandardAccountFlagPair(uint NetUserFlags, uint SamUserAccountControl);
internal sealed record StandardAccountFlagMutation(StandardAccountFlagPair Before,
    uint TargetNetUserFlags, uint TargetSamUserAccountControl);

// This is the closed W03 subset, not a general account-control translator.
// Official MS-SAMR definitions and mapping, verified 2026-11-04:
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-samr/10bf6c8e-34af-4cf9-8dff-6b6330922863
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-samr/b10cfda1-f24f-441b-8f43-80cb93e786ec
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-samr/8a193181-a7a2-49df-a8b1-f689aaa6987c
// UF_SCRIPT has no USER_ACCOUNT counterpart. In particular, SAM's
// USER_ACCOUNT_AUTO_LOCKED(0x400) maps to UF_LOCKOUT(0x10), not UF_SCRIPT(1).
// Both lockout flags and every other flag outside this subset are refused.
// USER_INFO_1008 documents SCRIPT as required for NetUserSetInfo. That API's
// mutation contract is not a reason to synthesize SCRIPT from a SAM read, and
// this codec supplies no NetUserSetInfo mutation or native backend.
internal static class StandardAccountFlagCodec
{
    internal const uint NetScript = 0x00000001;
    internal const uint NetDisabled = 0x00000002;
    internal const uint NetNormal = 0x00000200;
    internal const uint NetDontExpirePassword = 0x00010000;
    internal const uint NetMappedMask = NetDisabled | NetNormal | NetDontExpirePassword;
    internal const uint NetObservationMask = NetMappedMask | NetScript;

    internal const uint SamDisabled = 0x00000001;
    internal const uint SamNormal = 0x00000010;
    internal const uint SamDontExpirePassword = 0x00000200;
    internal const uint SamObservationMask = SamDisabled | SamNormal | SamDontExpirePassword;

    private static void NetObservation(uint value)
    {
        StandardContract.Need((value & NetNormal) != 0 && (value & ~NetObservationMask) == 0,
            "STANDARD_ACCOUNT_NET_FLAGS_REFUSED");
    }

    private static void SamObservation(uint value)
    {
        StandardContract.Need((value & SamNormal) != 0 && (value & ~SamObservationMask) == 0,
            "STANDARD_ACCOUNT_SAM_FLAGS_REFUSED");
    }

    // Strict numeric conversion of only the mutually represented bits. SCRIPT
    // is deliberately refused rather than dropped. This returns no observation.
    internal static uint EncodeMappedNetFlags(uint mappedNetFlags)
    {
        NetObservation(mappedNetFlags);
        StandardContract.Need((mappedNetFlags & NetScript) == 0,
            "STANDARD_ACCOUNT_NET_SCRIPT_REQUIRES_SIDECAR");
        uint sam = SamNormal;
        if ((mappedNetFlags & NetDisabled) != 0) sam |= SamDisabled;
        if ((mappedNetFlags & NetDontExpirePassword) != 0) sam |= SamDontExpirePassword;
        return sam;
    }

    // The returned mapped bits do NOT contain a freshly observed SCRIPT value.
    // They must not be presented as a complete NetAPI account snapshot.
    internal static uint DecodeSamMappedFlags(uint observedSamUserAccountControl)
    {
        SamObservation(observedSamUserAccountControl);
        uint net = NetNormal;
        if ((observedSamUserAccountControl & SamDisabled) != 0) net |= NetDisabled;
        if ((observedSamUserAccountControl & SamDontExpirePassword) != 0) net |= NetDontExpirePassword;
        return net;
    }

    internal static StandardAccountFlagEncoding EncodeNetObservation(uint observedNetUserFlags)
    {
        NetObservation(observedNetUserFlags);
        return new(EncodeMappedNetFlags(observedNetUserFlags & ~NetScript), observedNetUserFlags & NetScript);
    }

    // Inverse of a structured encoding only. The caller must retain the actual
    // NetAPI observation and must not label a reconstructed value a fresh read.
    internal static uint RestoreEncodedNetObservation(StandardAccountFlagEncoding? encoding)
    {
        StandardContract.Need(encoding is not null && (encoding.NetApiOnlyFlags & ~NetScript) == 0,
            "STANDARD_ACCOUNT_NET_SIDECAR_REFUSED");
        return DecodeSamMappedFlags(encoding.SamUserAccountControl) | encoding.NetApiOnlyFlags;
    }

    // A future retained-SAM backend must supply separate real observations:
    // NetAPI USER_INFO_23 must return the exact owned SID/name and SAM must read
    // the retained user object. Agreement here alone proves neither association
    // nor stability between calls. Revalidate both around the actual mutation.
    internal static StandardAccountFlagPair Pair(uint observedNetUserFlags, uint observedSamUserAccountControl)
    {
        StandardAccountFlagEncoding encoded = EncodeNetObservation(observedNetUserFlags);
        SamObservation(observedSamUserAccountControl);
        StandardContract.Need(encoded.SamUserAccountControl == observedSamUserAccountControl,
            "STANDARD_ACCOUNT_FLAG_OBSERVATIONS_DISAGREE");
        return new(observedNetUserFlags, observedSamUserAccountControl);
    }

    // A mutation control word is distinct from an observation. Only a genuine
    // enable/disable transition is admitted; no no-op, sidecar change, unknown
    // bit removal or unrelated attribute change is silently normalized.
    internal static StandardAccountFlagMutation PlanDisabledOnly(StandardAccountFlagPair? observed,
        uint expectedNetUserFlags, uint newNetUserFlags)
    {
        StandardContract.Need(observed is not null, "STANDARD_ACCOUNT_FLAG_PAIR_MISSING");
        StandardAccountFlagPair before = Pair(observed.NetUserFlags, observed.SamUserAccountControl);
        NetObservation(expectedNetUserFlags); NetObservation(newNetUserFlags);
        StandardContract.Need(before.NetUserFlags == expectedNetUserFlags,
            "STANDARD_ACCOUNT_EXPECTED_NET_FLAGS_CHANGED");
        StandardContract.Need((expectedNetUserFlags ^ newNetUserFlags) == NetDisabled,
            "STANDARD_ACCOUNT_ONLY_DISABLED_CHANGE_ALLOWED");
        uint targetSam = before.SamUserAccountControl ^ SamDisabled;
        StandardContract.Need(EncodeNetObservation(newNetUserFlags).SamUserAccountControl == targetSam,
            "STANDARD_ACCOUNT_DISABLED_MAPPING_REFUSED");
        return new(before, newNetUserFlags, targetSam);
    }

    internal static StandardAccountFlagPair VerifyReadback(StandardAccountFlagMutation? mutation,
        uint observedNetUserFlags, uint observedSamUserAccountControl)
    {
        StandardContract.Need(mutation is not null, "STANDARD_ACCOUNT_FLAG_MUTATION_MISSING");
        StandardAccountFlagMutation canonical = PlanDisabledOnly(mutation.Before,
            mutation.Before?.NetUserFlags ?? 0, mutation.TargetNetUserFlags);
        StandardContract.Need(canonical == mutation, "STANDARD_ACCOUNT_FLAG_MUTATION_REFUSED");
        StandardAccountFlagPair after = Pair(observedNetUserFlags, observedSamUserAccountControl);
        StandardContract.Need(after.NetUserFlags == mutation.TargetNetUserFlags &&
            after.SamUserAccountControl == mutation.TargetSamUserAccountControl,
            "STANDARD_ACCOUNT_FLAG_READBACK_CHANGED");
        return after;
    }
}
