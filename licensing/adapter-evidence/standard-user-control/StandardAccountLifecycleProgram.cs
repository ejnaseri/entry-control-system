using System;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardAccountLifecycleProgram
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
                int workerChannelCases = StandardWorkerChannelTests.Run();
                int nativePipeCases = StandardNativeWorkerChannelTests.Run();
                int fileCustodyCases = StandardFileCustodyTests.Run();
                int accountLifecycleCases = StandardAccountLifecycleTests.Run();
#if COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1
                StandardContract.Need(NativeStandardChild.BindingLayoutIsExpected(), "STANDARD_NATIVE_LAYOUT_REFUSED");
#endif
                Console.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_ACCOUNT_LIFECYCLE_PURE_V1",
                    identityCases, launchCases, credentialCases, cryptoComparisonCases, cryptoPrimitiveCases,
                    inputCodecCases, protectedStoreCases, keyCreationCases, workerChannelCases, nativePipeCases, fileCustodyCases, accountLifecycleCases,
                    nativeLogonPerformed = false, accountChanged = false,
                    persistedCngProbePerformed = false, nativeStorePerformed = false, nativePipePerformed = false, nativeFileCustodyPerformed = false,
                    syntheticCryptoFixturePerformed = true, accountNativeBackendImplemented = false,
                    standardUserLogonTested = false, cryptoRunnerImplemented = false,
                    securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch (Exception error) {
                Console.Error.WriteLine("STANDARD_ACCOUNT_LIFECYCLE_SELF_TEST_FAILED:" + error.GetType().Name + ":" + error.Message);
                return 1;
            }
        }
        // Compile-only bindings have no operational entry point. All effects
        // exercised above belong to synthetic, injected backends.
        Console.Error.WriteLine("STANDARD_ACCOUNT_LIFECYCLE_ENTRY_CLOSED");
        return 2;
    }
}
