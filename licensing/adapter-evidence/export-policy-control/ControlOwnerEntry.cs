using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlOwnerArguments(string PlanPath, string ApprovalPath, ControlPins Pins, string ExpectedOwnerSid);

// Owner-entry path, not an approval issuer. Only the shared purpose-specific
// build capability opens the route; owner/custody/effects admission is separate.
internal static class ControlOwnerEntry
{
    private static int consumed;
    internal static bool PhysicalEnabled => ControlCapability.Enabled;
    internal static string Confirmation(ControlSession session) => "CONFIRM EXPORT-POLICY-CONTROL " +
        session.Plan.AttemptId + " " + session.Pins.PlanSha256 + " " + session.Pins.ApprovalSha256 + " " + session.Pins.PackageSha256;

    internal static ControlOwnerArguments Parse(string[] args)
    {
        ControlRules.Need(args is { Length: 7 } && args[0] == "--control-controller", "CONTROL_OWNER_ARGUMENTS_REFUSED");
        var pins = new ControlPins(args[3], args[4], args[5]); ControlRules.ValidatePins(pins);
        ControlRules.Need(ValidInputPath(args[1]) && ValidInputPath(args[2]) && args[1] != args[2] &&
            ValidOwnerSid(args[6]), "CONTROL_OWNER_ARGUMENTS_REFUSED");
        return new(args[1], args[2], pins, args[6]);
    }
    internal static bool ValidInputPath(string? path) => path is { Length: >= 4 and <= 240 } &&
        char.IsAsciiLetterUpper(path[0]) && path[1] == ':' && path[2] == '\\' &&
        !path[3..].Any(c => c < ' ' || c is ':' or '/' or '"' or '*' or '?' or '<' or '>' or '|') &&
        path[3..].Split('\\').All(p => p.Length > 0 && p is not "." and not ".." && !p.EndsWith(' ') && !p.EndsWith('.'));

    internal static bool ValidOwnerSid(string? sid)
    {
        if (sid is null || !sid.StartsWith("S-1-5-21-", StringComparison.Ordinal)) return false;
        string[] parts = sid[9..].Split('-');
        return parts.Length == 4 && parts.All(p => p.Length is > 0 and <= 10 && p.All(char.IsAsciiDigit) &&
            (p.Length == 1 || p[0] != '0') && uint.TryParse(p, out _));
    }
    internal static (ControlRole Role, ControlPins Pins) ParseService(string[] args)
    {
        ControlRules.Need(args is { Length: 8 } && args[0] == "--control-service" &&
            args[2] == "--plan-sha256" && args[4] == "--approval-sha256" && args[6] == "--package-sha256",
            "CONTROL_SERVICE_ARGUMENTS_REFUSED");
        ControlRole role = args[1] switch { "Setup" => ControlRole.Setup, "Guardian" => ControlRole.Guardian,
            _ => throw new InvalidDataException("CONTROL_SERVICE_ROLE_REFUSED") };
        var pins = new ControlPins(args[3], args[5], args[7]); ControlRules.ValidatePins(pins); return (role, pins);
    }
    internal static void Dispatch(string[] args)
    {
        ControlRules.Need(PhysicalEnabled && NativeControlRuntime.PhysicalEnabled, "CONTROL_OWNER_ENTRY_CLOSED");
        var input = Parse(args);
        ControlRules.Need(Interlocked.CompareExchange(ref consumed, 1, 0) == 0, "CONTROL_OWNER_PROCESS_CONSUMED");
        RequireOwner(input.ExpectedOwnerSid);
        ControlRules.Need(!Console.IsInputRedirected && !Console.IsOutputRedirected, "CONTROL_LIVE_CONSOLE_REQUIRED");
        byte[] planBytes = ReadInput(input.PlanPath, 2097152);
        byte[] approvalBytes = ReadInput(input.ApprovalPath, 2097152);
        ControlRules.Need(ControlRules.Hash(planBytes) == input.Pins.PlanSha256 &&
            ControlRules.Hash(approvalBytes) == input.Pins.ApprovalSha256, "CONTROL_REVIEWED_INPUT_PINS_REFUSED");
        var plan = ControlRules.Parse<ControlPlan>(planBytes);
        var approval = ControlRules.Parse<ControlOwnerApproval>(approvalBytes);
        ControlRules.Need(plan.OwnerSid == input.ExpectedOwnerSid, "CONTROL_OWNER_REQUEST_MISMATCH");
        var reservation = new ControlReservation(1, ControlRules.Scope, plan.AttemptId, input.Pins.PlanSha256,
            input.Pins.ApprovalSha256, input.Pins.PackageSha256, DateTimeOffset.UtcNow);
        var session = new ControlSession(plan, input.Pins, reservation);
        ControlController.ValidateApproval(approval, session, DateTimeOffset.UtcNow);

        string bin = Path.GetDirectoryName(typeof(Program).Assembly.Location)!;
        string manifestPath = Path.Combine(Path.GetDirectoryName(bin)!, "package-manifest.json");
        byte[] manifest = ReadInput(manifestPath, 2097152);
        var package = ControlRules.Parse<ControlPackage>(manifest); NativeControlAdmission.ValidatePackage(package);
        var files = package.Files.ToDictionary(f => f.Name, f => ReadInput(Path.Combine(bin, f.Name), 33554432), StringComparer.Ordinal);
        var bundle = new ControlDeploymentBundle(session, manifest, files);
        ControlController.ValidateBundle(bundle);
        void Verify() {
            RequireOwner(input.ExpectedOwnerSid);
            ControlController.ValidateApproval(approval, session, DateTimeOffset.UtcNow);
            ControlRules.Need(NativeControlIdentity.Boot() == plan.BootIdentity && NativeControlAdmission.HostHash() == plan.HostSha256,
                "CONTROL_OWNER_HOST_BOOT_CHANGED");
            NativeControlAdmission.VerifyEnvironment(ControlRole.Guardian);
            ControlRules.Need(Path.GetFullPath(Environment.ProcessPath!) == Path.Combine(bin, "ExportPolicyControl.exe") &&
                Path.GetFullPath(typeof(Program).Assembly.Location) == Path.Combine(bin, "ExportPolicyControl.dll"), "CONTROL_OWNER_EXECUTABLE_REFUSED");
            foreach (var file in package.Files)
                ControlRules.Need(ControlRules.Hash(ReadInput(Path.Combine(bin, file.Name), 33554432)) == file.Sha256,
                    "CONTROL_OWNER_PACKAGE_CHANGED");
            ControlRules.Need(ControlRules.Hash(ReadInput(manifestPath, 2097152)) == input.Pins.PackageSha256 &&
                Directory.GetFileSystemEntries(bin).Select(Path.GetFileName).OrderBy(x => x, StringComparer.Ordinal)
                    .SequenceEqual(package.Files.Select(f => f.Name).OrderBy(x => x, StringComparer.Ordinal)), "CONTROL_OWNER_PACKAGE_SET_CHANGED");
            NativeControlAdmission.VerifyRuntime(files["runtime-inventory.json"]);
            ControlRules.ValidateSession(session, DateTimeOffset.UtcNow);
        }
        Verify();
        Console.WriteLine("TEST ONLY. ONE ATTEMPT. Any failure retains state; never retry or edit expired inputs.");
        foreach (var effect in ControlController.Effects) Console.WriteLine(effect);
        Console.WriteLine(Confirmation(session));
        ControlRules.Need(Console.ReadLine() == Confirmation(session), "CONTROL_OWNER_CONFIRMATION_REFUSED");
        Verify();
        var native = new NativeControlDeployment(Verify);
        var result = new ControlController().Run(approval, bundle, native, Verify, () => DateTimeOffset.UtcNow);
        Console.WriteLine(Encoding.UTF8.GetString(ControlRules.Serialize(result)));
    }

    private static void RequireOwner(string expected)
    {
        ControlRules.Need(ValidOwnerSid(expected), "CONTROL_OWNER_SID_REFUSED");
        NativeControlIdentity.RuntimeGuard();
        using var thread = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(thread is null, "CONTROL_OWNER_IMPERSONATION_REFUSED");
        using var identity = WindowsIdentity.GetCurrent();
        ControlRules.Need(identity.User?.Value == expected && identity.Owner?.Value is not null &&
            (identity.Owner.Value == expected || identity.Owner.Value == ControlRules.AdminSid) &&
            new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator), "CONTROL_OWNER_TOKEN_REFUSED");
        using var token = identity.AccessToken;
        foreach (int kind in new[] { 8, 20 }) {
            ControlRules.Need(GetTokenInformation(token, kind, out int value, 4, out int written) &&
                written == 4 && value == 1, "CONTROL_OWNER_ELEVATED_PRIMARY_REQUIRED");
        }
    }
    private static byte[] ReadInput(string path, int maximum)
    {
        ControlRules.Need(ValidInputPath(path) && Path.GetFullPath(path) == path, "CONTROL_INPUT_PATH_REFUSED");
        for (string? cursor = path; cursor is not null; cursor = Path.GetDirectoryName(cursor))
            ControlRules.Need((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) == 0, "CONTROL_INPUT_REPARSE_REFUSED");
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        ControlRules.Need(GetFileInformationByHandle(stream.SafeFileHandle, out var info) && info.Links == 1 &&
            (info.Attributes & 0x410) == 0 && stream.Length is > 0 && stream.Length <= maximum, "CONTROL_INPUT_HANDLE_REFUSED");
        var finalPath = new StringBuilder(1024);
        uint length = GetFinalPathNameByHandleW(stream.SafeFileHandle, finalPath, finalPath.Capacity, 0);
        ControlRules.Need(length is > 0 and < 1024 && string.Equals(finalPath.ToString(), "\\\\?\\" + path, StringComparison.OrdinalIgnoreCase),
            "CONTROL_INPUT_FINAL_PATH_REFUSED");
        byte[] bytes = new byte[checked((int)stream.Length)]; stream.ReadExactly(bytes);
        ControlRules.Need(stream.Position == stream.Length, "CONTROL_INPUT_CHANGED"); return bytes;
    }
    [StructLayout(LayoutKind.Sequential)] private struct FileInfo
    { internal uint Attributes, CreatedLow, CreatedHigh, AccessedLow, AccessedHigh, WrittenLow, WrittenHigh,
        Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, int capacity, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle handle, int kind, out int value, int size, out int written);
}
