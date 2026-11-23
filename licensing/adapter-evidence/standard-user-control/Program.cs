using System;
using System.Diagnostics;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class Program
{
    internal static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) {
            try {
                int cases = StandardIdentityTests.Run();
                Console.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_IDENTITY_PURE_V1", cases,
                    accountChanged = false, standardUserLogonTested = false, cryptoRunnerImplemented = false,
                    securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch { Console.Error.WriteLine("STANDARD_IDENTITY_SELF_TEST_FAILED"); return 1; }
        }
#if READ_ONLY_STANDARD_TOKEN_DIAGNOSTIC_V1
        if (args.SequenceEqual(new[] { "--inspect-own-token" })) {
            try {
                using var process = Process.GetCurrentProcess();
                var observation = StandardTokenReader.Capture(process.SafeHandle);
                Console.WriteLine(JsonSerializer.Serialize(new {
                    scope = "TEST_ONLY_STANDARD_OWN_TOKEN_DIAGNOSTIC_V1", observation,
                    expectedAccountTokenRefusal = StandardIdentity.Refusal(observation.Token),
                    administratorsPresent = observation.Token.Groups!.Any(g => g.Sid == StandardContract.Administrators),
                    ownProcessOnly = true, accountChanged = false, standardUserLogonTested = false,
                    keysTested = false, securityAccepted = false, productionAccepted = false }));
                return 0;
            } catch (Exception error) {
                Console.Error.WriteLine(JsonSerializer.Serialize(new { scope = "TEST_ONLY_STANDARD_OWN_TOKEN_READ_FAILURE_V1",
                    category = error.GetType().Name, hResult = error.HResult, accountChanged = false }));
                return 1;
            }
        }
#endif
        // Even unrelated/older/future physical capability symbols cannot enable
        // account/logon/crypto work: no such entry or implementation exists yet.
        Console.Error.WriteLine("STANDARD_USER_CONTROL_ENTRY_CLOSED"); return 2;
    }
}
