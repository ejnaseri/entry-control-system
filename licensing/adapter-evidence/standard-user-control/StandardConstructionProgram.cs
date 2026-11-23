using System;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardConstructionProgram
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
                int inputCodecCases = StandardInputCodecTests.Run();
                int protectedStoreCases = StandardProtectedStoreTests.Run();
                int keyCreationCases = StandardKeyCreationTests.Run();
#if COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1
                StandardContract.Need(NativeStandardChild.BindingLayoutIsExpected(), "STANDARD_NATIVE_LAYOUT_REFUSED");
#endif
                Console.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_CONSTRUCTION_PURE_V1",
                    identityCases, launchCases, credentialCases, cryptoComparisonCases, cryptoPrimitiveCases,
                    inputCodecCases, protectedStoreCases, keyCreationCases,
                    nativeLogonPerformed = false, accountChanged = false,
                    persistedCngProbePerformed = false, nativeStorePerformed = false,
                    syntheticCryptoFixturePerformed = true,
                    standardUserLogonTested = false, cryptoRunnerImplemented = false,
                    securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch (Exception error) {
                Console.Error.WriteLine("STANDARD_CONSTRUCTION_SELF_TEST_FAILED:" + error.GetType().Name + ":" + error.Message);
                return 1;
            }
        }
        // Compile-only bindings have no operational entry point. All effects
        // exercised above belong to synthetic, injected backends.
        Console.Error.WriteLine("STANDARD_CONSTRUCTION_ENTRY_CLOSED");
        return 2;
    }
}
