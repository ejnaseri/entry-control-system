using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

namespace Ecs.Lic008;

internal static partial class Program
{
    internal static bool ValidUserSid(string sid) => System.Text.RegularExpressions.Regex.IsMatch(sid, @"^S-1-5-21-\d+-\d+-\d+-\d+$");
    internal static string ControlUserSid => Read<Plan>(Path.Combine(Root, "plan.json")).OrdinaryUserSid;
    internal static bool InteractiveAllowed(string actual, string expected, bool elevated, bool administrator, int integrity, uint? interactiveAttributes) =>
        ValidUserSid(expected) && actual == expected && !elevated && !administrator && integrity == 8192 &&
        interactiveAttributes is not null && (interactiveAttributes.Value & 4) != 0 && (interactiveAttributes.Value & 16) == 0;

    static int InteractiveProbe()
    {
        try
        {
            var plan = Read<Plan>(Path.Combine(Root, "plan.json"));
            Require(ValidPlan(plan) && plan.Action == "probe-user" && plan.BinaryHash == Hash(File.ReadAllBytes(Environment.ProcessPath!)));
            using var identity = WindowsIdentity.GetCurrent();
            string sid = identity.User?.Value ?? throw new InvalidDataException();
            bool administrator = new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
            bool elevated = TokenNumber(identity.AccessToken, 20) != 0;
            int elevationType = TokenNumber(identity.AccessToken, 18);
            int integrity = IntegrityLevel(identity.AccessToken);
            var interactive = TokenEvidence.Capture("S-1-5-4");
            Require(InteractiveAllowed(sid, plan.OrdinaryUserSid, elevated, administrator, integrity, interactive.ServiceGroupAttributes));
            var results = ProbeApp("interactive");
            results.Add(new("interactive.token-identity", "PASS", Stage: sid));
            bool passed = results.Any(p => p.Id == "interactive.restricted.open" && p.Status is "OBSERVED_BAD_KEYSET" or "PASS_ACCESS_DENIED") &&
                results.Any(p => p.Id == "interactive.app-readable.open-decrypt-control" && p.Status == "PASS");
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                schemaVersion = 1, scope = ReportScope, role = "interactive", action = plan.Action,
                plan.RunId, plan.ExperimentId, binarySha256 = plan.BinaryHash, userSid = sid, elevated, administrator,
                elevationType, integrity, interactiveGroupAttributes = interactive.ServiceGroupAttributes,
                accountClass = elevationType == 3 ? "FILTERED_ADMIN_INTERACTIVE_TOKEN" : "NON_ELEVATED_INTERACTIVE_TOKEN",
                timeUtc = DateTime.UtcNow, processId = Environment.ProcessId, results,
                securityAccepted = false, productionAccepted = false, matrixAccepted = false
            }, Json));
            return passed ? 0 : 4;
        }
        catch (Exception ex) { Console.Error.WriteLine(Error(ex)); return 1; }
    }

    static int TokenSelfTest()
    {
        using var identity = WindowsIdentity.GetCurrent();
        string sid = identity.User?.Value ?? throw new InvalidDataException();
        bool administrator = new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        bool elevated = TokenNumber(identity.AccessToken, 20) != 0;
        int integrity = IntegrityLevel(identity.AccessToken);
        uint? attributes = TokenEvidence.Capture("S-1-5-4").ServiceGroupAttributes;
        bool accepted = InteractiveAllowed(sid, sid, elevated, administrator, integrity, attributes);
        Console.WriteLine($"Token-only guard: accepted={accepted}; elevated={elevated}; administrator={administrator}; integrity={integrity}; interactiveAttributes={attributes}; elevationType={TokenNumber(identity.AccessToken, 18)}");
        return accepted ? 0 : 3;
    }

    static int TokenNumber(SafeAccessTokenHandle token, int kind)
    {
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try
        {
            if (!GetTokenInformation(token, kind, buffer, 4, out int size) || size != 4) throw new Win32Exception();
            return Marshal.ReadInt32(buffer);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    static int IntegrityLevel(SafeAccessTokenHandle token)
    {
        GetTokenInformation(token, 25, IntPtr.Zero, 0, out int size);
        if (size is < 16 or > 4096) throw new InvalidDataException();
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try
        {
            if (!GetTokenInformation(token, 25, buffer, size, out _)) throw new Win32Exception();
            string sid = new SecurityIdentifier(Marshal.ReadIntPtr(buffer)).Value;
            Require(sid.StartsWith("S-1-16-", StringComparison.Ordinal));
            return int.Parse(sid[7..], System.Globalization.CultureInfo.InvariantCulture);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetTokenInformation(SafeAccessTokenHandle token, int informationClass, IntPtr information, int length, out int needed);
}
