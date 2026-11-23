using System;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardLaunchProgram
{
    internal static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) {
            try {
                int identityCases = StandardIdentityTests.Run();
                int launchCases = StandardLaunchTests.Run();
                int credentialCases = StandardCredentialTests.Run();
                int cryptoComparisonCases = StandardCryptoComparisonTests.Run();
                int cryptoPrimitiveCases = StandardNativeCryptoTests.Run();
#if COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1
                StandardContract.Need(NativeStandardChild.BindingLayoutIsExpected(), "STANDARD_NATIVE_LAYOUT_REFUSED");
#endif
                Console.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_LAUNCH_PURE_V1",
                    identityCases, launchCases, credentialCases, cryptoComparisonCases, cryptoPrimitiveCases,
                    nativeLogonPerformed = false, accountChanged = false,
                    persistedCngProbePerformed = false, syntheticCryptoFixturePerformed = true,
                    standardUserLogonTested = false, cryptoRunnerImplemented = false,
                    securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch { Console.Error.WriteLine("STANDARD_LAUNCH_SELF_TEST_FAILED"); return 1; }
        }
        // This includes the compile-only variant. No launcher, worker, account
        // activation or crypto route is reachable under ANY definition.
        Console.Error.WriteLine("STANDARD_LAUNCH_ENTRY_CLOSED"); return 2;
    }
}
