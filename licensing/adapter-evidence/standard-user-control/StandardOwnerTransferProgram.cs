using System;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardOwnerTransferProgram
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
                int accountFlagCodecCases = StandardAccountFlagCodecTests.Run();
                int nativeAccountCases = StandardNativeAccountBackendTests.Run();
                int serviceLifecycleCases = StandardServiceLifecycleTests.Run();
                int peerObjectCases = StandardPeerObjectReaderTests.Run();
                int ownerTransferCases = StandardOwnerObjectTransferTests.Run();
                int serviceStoreJournalCases = StandardServiceStoreJournalTests.Run();
#if COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1
                StandardContract.Need(NativeStandardChild.BindingLayoutIsExpected(), "STANDARD_NATIVE_LAYOUT_REFUSED");
#endif
                Console.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_OWNER_TRANSFER_PURE_V1",
                    identityCases, launchCases, credentialCases, cryptoComparisonCases, cryptoPrimitiveCases,
                    inputCodecCases, protectedStoreCases, keyCreationCases, workerChannelCases, nativePipeCases, fileCustodyCases,
                    accountLifecycleCases, accountFlagCodecCases, nativeAccountCases, serviceLifecycleCases, peerObjectCases, ownerTransferCases, serviceStoreJournalCases,
                    nativeLogonPerformed = false, accountChanged = false,
                    persistedCngProbePerformed = false, nativeStorePerformed = false, nativePipePerformed = false, nativeFileCustodyPerformed = false,
                    nativeAccountPerformed = false, nativeServicePerformed = false, nativePeerObservationPerformed = false,
                    syntheticCryptoFixturePerformed = true, accountNativeBackendImplemented = true,
                    serviceLifecycleImplemented = true, peerObjectReaderImplemented = true,
                    ownerTransferModelImplemented = true, serviceStoreJournalImplemented = true, nativeOwnerTransferPerformed = false,
                    standardUserLogonTested = false, processTokenAssociationEstablished = false,
                    loadedCodeEstablished = false, bootstrapImplemented = false, cryptoRunnerImplemented = false,
                    nativeCompatibilityAccepted = false, securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch (Exception error) {
                Console.Error.WriteLine("STANDARD_OWNER_TRANSFER_SELF_TEST_FAILED:" + error.GetType().Name + ":" + error.Message);
                return 1;
            }
        }
        // Injected tests and compile-only bindings. No actual account, service,
        // peer-object, bootstrap, logon, store, persisted key or controller entry.
        Console.Error.WriteLine("STANDARD_OWNER_TRANSFER_ENTRY_CLOSED");
        return 2;
    }
}
