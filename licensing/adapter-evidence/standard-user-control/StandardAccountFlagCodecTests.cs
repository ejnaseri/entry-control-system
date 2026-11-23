using System;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardAccountFlagCodecTests
{
    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) { StandardContract.Need(condition, "STANDARD_ACCOUNT_FLAG_CODEC_TEST_FAILED_" + cases); cases++; }
        void Refused(Action action, string? category = null) {
            bool refused = false;
            try { action(); }
            catch (InvalidDataException ex) { refused = category is null || ex.Message == category; }
            Check(refused);
        }
        const uint script = 1, netDisabled = 2, netNormal = 0x200, netNever = 0x10000;
        const uint samDisabled = 1, samNormal = 0x10, samNever = 0x200;
        uint[] nets = Enumerable.Range(0, 8).Select(i => netNormal |
            ((i & 1) != 0 ? script : 0) | ((i & 2) != 0 ? netDisabled : 0) |
            ((i & 4) != 0 ? netNever : 0)).ToArray();
        uint[] sams = new uint[] { 0x10, 0x11, 0x210, 0x211 };
        Check(StandardAccountFlagCodec.NetObservationMask == 0x10203);
        Check(StandardAccountFlagCodec.NetMappedMask == 0x10202);
        Check(StandardAccountFlagCodec.SamObservationMask == 0x211);
        Check(StandardAccountFlagCodec.NetScript == script && StandardAccountFlagCodec.NetDisabled == netDisabled &&
            StandardAccountFlagCodec.NetNormal == netNormal && StandardAccountFlagCodec.NetDontExpirePassword == netNever);
        Check(StandardAccountFlagCodec.SamDisabled == samDisabled && StandardAccountFlagCodec.SamNormal == samNormal &&
            StandardAccountFlagCodec.SamDontExpirePassword == samNever);

        foreach (uint net in nets) {
            uint expectedSam = samNormal | ((net & netDisabled) != 0 ? samDisabled : 0) |
                ((net & netNever) != 0 ? samNever : 0);
            StandardAccountFlagEncoding encoding = StandardAccountFlagCodec.EncodeNetObservation(net);
            Check(encoding.SamUserAccountControl == expectedSam);
            Check(encoding.NetApiOnlyFlags == (net & script));
            Check(StandardAccountFlagCodec.RestoreEncodedNetObservation(encoding) == net);
            Check(StandardAccountFlagCodec.DecodeSamMappedFlags(expectedSam) == (net & ~script));
            Check(StandardAccountFlagCodec.EncodeMappedNetFlags(net & ~script) == expectedSam);
            StandardAccountFlagPair pair = StandardAccountFlagCodec.Pair(net, expectedSam);
            Check(pair.NetUserFlags == net && pair.SamUserAccountControl == expectedSam);
            StandardAccountFlagMutation mutation = StandardAccountFlagCodec.PlanDisabledOnly(pair, net, net ^ netDisabled);
            Check(mutation.Before == pair && mutation.TargetNetUserFlags == (net ^ netDisabled));
            Check(mutation.TargetSamUserAccountControl == (expectedSam ^ samDisabled));
            Check((mutation.TargetNetUserFlags & ~netDisabled) == (net & ~netDisabled));
            Check((mutation.TargetSamUserAccountControl & ~samDisabled) == (expectedSam & ~samDisabled));
            StandardAccountFlagPair readback = StandardAccountFlagCodec.VerifyReadback(mutation,
                net ^ netDisabled, expectedSam ^ samDisabled);
            Check(readback == new StandardAccountFlagPair(net ^ netDisabled, expectedSam ^ samDisabled));
            StandardAccountFlagMutation reverse = StandardAccountFlagCodec.PlanDisabledOnly(readback,
                readback.NetUserFlags, net);
            Check(StandardAccountFlagCodec.VerifyReadback(reverse, net, expectedSam) == pair);
            Check(pair.NetUserFlags == net && pair.SamUserAccountControl == expectedSam);

            Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net, net),
                "STANDARD_ACCOUNT_ONLY_DISABLED_CHANGE_ALLOWED");
            Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net ^ netDisabled, net),
                "STANDARD_ACCOUNT_EXPECTED_NET_FLAGS_CHANGED");
            foreach (uint changed in new uint[] { script, netNever, script | netDisabled, netNever | netDisabled,
                script | netNever | netDisabled })
                Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net, net ^ changed));
            Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net ^ script, net ^ netDisabled));
            Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net ^ netNever, net ^ netDisabled));
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation, net, expectedSam),
                "STANDARD_ACCOUNT_FLAG_READBACK_CHANGED");
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation, (net ^ netDisabled) ^ script,
                expectedSam ^ samDisabled), "STANDARD_ACCOUNT_FLAG_READBACK_CHANGED");
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation,
                (net ^ netDisabled) ^ netNever, (expectedSam ^ samDisabled) ^ samNever),
                "STANDARD_ACCOUNT_FLAG_READBACK_CHANGED");
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation with { TargetSamUserAccountControl = expectedSam },
                net ^ netDisabled, expectedSam ^ samDisabled), "STANDARD_ACCOUNT_FLAG_MUTATION_REFUSED");
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation with { Before = pair with {
                SamUserAccountControl = expectedSam ^ samDisabled } }, net ^ netDisabled, expectedSam ^ samDisabled));
            Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation with { TargetNetUserFlags = net },
                net ^ netDisabled, expectedSam ^ samDisabled));
            foreach (uint sam in sams) {
                if (sam == expectedSam) Check(StandardAccountFlagCodec.Pair(net, sam) == pair);
                else Refused(() => StandardAccountFlagCodec.Pair(net, sam), "STANDARD_ACCOUNT_FLAG_OBSERVATIONS_DISAGREE");
            }
            if ((net & script) != 0)
                Refused(() => StandardAccountFlagCodec.EncodeMappedNetFlags(net), "STANDARD_ACCOUNT_NET_SCRIPT_REQUIRES_SIDECAR");

            for (int bit = 0; bit < 32; bit++) {
                uint extra = 1u << bit;
                if ((extra & 0x10203) == 0) {
                    uint invalidNet = net | extra;
                    Refused(() => StandardAccountFlagCodec.EncodeNetObservation(invalidNet));
                    Refused(() => StandardAccountFlagCodec.Pair(invalidNet, expectedSam));
                    Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, invalidNet, net ^ netDisabled));
                    Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net, (net ^ netDisabled) | extra));
                    Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation, (net ^ netDisabled) | extra,
                        expectedSam ^ samDisabled));
                }
                if ((extra & 0x211) == 0) {
                    uint invalidSam = expectedSam | extra;
                    Refused(() => StandardAccountFlagCodec.DecodeSamMappedFlags(invalidSam));
                    Refused(() => StandardAccountFlagCodec.Pair(net, invalidSam));
                    Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair with { SamUserAccountControl = invalidSam },
                        net, net ^ netDisabled));
                    Refused(() => StandardAccountFlagCodec.RestoreEncodedNetObservation(encoding with {
                        SamUserAccountControl = invalidSam }));
                    Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation with {
                        TargetSamUserAccountControl = (expectedSam ^ samDisabled) | extra },
                        net ^ netDisabled, expectedSam ^ samDisabled));
                    Refused(() => StandardAccountFlagCodec.VerifyReadback(mutation, net ^ netDisabled,
                        (expectedSam ^ samDisabled) | extra));
                }
            }
            Refused(() => StandardAccountFlagCodec.EncodeNetObservation(net & ~netNormal));
            Refused(() => StandardAccountFlagCodec.Pair(net & ~netNormal, expectedSam));
            Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(pair, net, (net ^ netDisabled) & ~netNormal));
            Refused(() => StandardAccountFlagCodec.DecodeSamMappedFlags(expectedSam & ~samNormal));
            Refused(() => StandardAccountFlagCodec.Pair(net, expectedSam & ~samNormal));
        }

        foreach (uint sam in sams) {
            uint mapped = StandardAccountFlagCodec.DecodeSamMappedFlags(sam);
            Check((mapped & script) == 0);
            Check(StandardAccountFlagCodec.EncodeMappedNetFlags(mapped) == sam);
            var zero = new StandardAccountFlagEncoding(sam, 0);
            var one = new StandardAccountFlagEncoding(sam, script);
            Check(StandardAccountFlagCodec.RestoreEncodedNetObservation(zero) == mapped);
            Check(StandardAccountFlagCodec.RestoreEncodedNetObservation(one) == (mapped | script));
            Check(StandardAccountFlagCodec.EncodeNetObservation(mapped) == zero);
            Check(StandardAccountFlagCodec.EncodeNetObservation(mapped | script) == one);
            // The same SAM value has TWO possible SCRIPT sidecars. This is the
            // explicit counterexample to a raw-SAM/full-NetAPI bijection.
            Check(zero.SamUserAccountControl == one.SamUserAccountControl && zero.NetApiOnlyFlags != one.NetApiOnlyFlags);
            for (int bit = 1; bit < 32; bit++) {
                uint badSidecar = 1u << bit;
                Refused(() => StandardAccountFlagCodec.RestoreEncodedNetObservation(new(sam, badSidecar)),
                    "STANDARD_ACCOUNT_NET_SIDECAR_REFUSED");
            }
        }
        Refused(() => StandardAccountFlagCodec.RestoreEncodedNetObservation(null));
        Refused(() => StandardAccountFlagCodec.RestoreEncodedNetObservation(new(samNormal, uint.MaxValue)));
        Refused(() => StandardAccountFlagCodec.PlanDisabledOnly(null, 0x203, 0x201));
        Refused(() => StandardAccountFlagCodec.VerifyReadback(null, 0x201, 0x10));
        Refused(() => StandardAccountFlagCodec.VerifyReadback(new(null!, 0x201, 0x10), 0x201, 0x10));
        Refused(() => StandardAccountFlagCodec.EncodeNetObservation(uint.MaxValue));
        Refused(() => StandardAccountFlagCodec.DecodeSamMappedFlags(uint.MaxValue));
        // Lockout is not SCRIPT, and treating either entire integer word as the
        // other encoding must fail rather than accidentally toggle an attribute.
        Refused(() => StandardAccountFlagCodec.EncodeNetObservation(0x200 | 0x10));
        Refused(() => StandardAccountFlagCodec.DecodeSamMappedFlags(0x10 | 0x400));
        Refused(() => StandardAccountFlagCodec.EncodeNetObservation(0x11));
        Refused(() => StandardAccountFlagCodec.DecodeSamMappedFlags(0x203));
        Check(StandardAccountFlagCodec.EncodeNetObservation(0x201) == new StandardAccountFlagEncoding(0x10, 1));
        Check(StandardAccountFlagCodec.EncodeNetObservation(0x202) == new StandardAccountFlagEncoding(0x11, 0));
        return cases;
    }
}
