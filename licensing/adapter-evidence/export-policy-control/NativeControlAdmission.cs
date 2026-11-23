using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal sealed record ControlPackageFile(string Name, int Size, string Sha256);
internal sealed record ControlPackage(int SchemaVersion, string Scope, ControlPackageFile[] Files);
internal sealed record ControlRuntimeFile(string Group, string Name, int Size, string Sha256);
internal sealed record ControlRuntimeInventory(int SchemaVersion, string Runtime, ControlRuntimeFile[] Files);

// Service-side admission. The future launcher must independently pin these inputs
// after exact-package review; a protected file never supplies its own expected pin.
internal sealed class NativeControlAdmission
{
    internal ControlSession Session { get; }
    internal ProtectedControlStore Store { get; }
    internal ControlTokenSnapshot Token { get; }
    internal DateTimeOffset StartedUtc { get; }
    private readonly ControlRole role;
    private readonly ControlStartupTrace? trace;
    private NativeControlAdmission(ControlRole role, ControlSession session, ProtectedControlStore store,
        ControlTokenSnapshot token, DateTimeOffset startedUtc, ControlStartupTrace? trace)
    { this.role = role; Session = session; Store = store; Token = token; StartedUtc = startedUtc; this.trace = trace; }

    internal static NativeControlAdmission Admit(ControlRole role, ControlPins pins, ControlStartupTrace? trace = null)
    {
        ControlStartupTrace.At(trace, ControlStartupStage.AdmissionPins, () => {
            ControlRules.ValidatePins(pins); ControlRules.Role(role);
        });
        var token = NativeControlIdentity.Capture(role, trace);
        void Identity() => ControlStartupTrace.At(trace, ControlStartupStage.ContextIdentity, () =>
            ControlRules.Need(NativeControlIdentity.Capture(role, trace) == token, "CONTROL_IDENTITY_CHANGED"));
        var store = new ProtectedControlStore(role, Identity);
        byte[] planBytes = ControlStartupTrace.At(trace, ControlStartupStage.AdmissionPlanRead, () => store.Read("plan.json"));
        var plan = ControlStartupTrace.At(trace, ControlStartupStage.AdmissionPlanBinding, () => {
            ControlRules.Need(ControlRules.Hash(planBytes) == pins.PlanSha256, "CONTROL_PLAN_PIN_REFUSED");
            return ControlRules.Parse<ControlPlan>(planBytes);
        });
        var reservation = ControlStartupTrace.At(trace, ControlStartupStage.AdmissionReservationRead, () =>
            ControlRules.Parse<ControlReservation>(store.Read("reservation.json")));
        var session = new ControlSession(plan, pins, reservation);
        ControlStartupTrace.At(trace, ControlStartupStage.AdmissionSession, () => ControlRules.ValidateSession(session, DateTimeOffset.UtcNow));
        using var process = Process.GetCurrentProcess();
        var started = ControlStartupTrace.At(trace, ControlStartupStage.AdmissionProcess, () => {
            var value = new DateTimeOffset(process.StartTime.ToUniversalTime());
            ControlRules.Need(value >= session.Reservation.ReservedUtc && value <= DateTimeOffset.UtcNow,
                "CONTROL_PROCESS_RESERVATION_REFUSED"); return value;
        });
        var admission = new NativeControlAdmission(role, session, store, token, started, trace);
        admission.Verify(); admission.VerifyPackage(); return admission;
    }
    internal void Verify()
    {
        ControlStartupTrace.At(trace, ControlStartupStage.ContextSession, () => ControlRules.ValidateSession(Session, DateTimeOffset.UtcNow));
        ControlStartupTrace.At(trace, ControlStartupStage.ContextIdentity, () =>
            ControlRules.Need(NativeControlIdentity.Capture(role, trace) == Token, "CONTROL_EXECUTION_CONTEXT_CHANGED"));
        ControlStartupTrace.At(trace, ControlStartupStage.ContextBoot, () =>
            ControlRules.Need(NativeControlIdentity.Boot() == Session.Plan.BootIdentity, "CONTROL_EXECUTION_CONTEXT_CHANGED"));
        ControlStartupTrace.At(trace, ControlStartupStage.ContextHost, () =>
            ControlRules.Need(HostHash() == Session.Plan.HostSha256, "CONTROL_EXECUTION_CONTEXT_CHANGED"));
        VerifyEnvironment(role, trace);
        ControlStartupTrace.At(trace, ControlStartupStage.ContextSession, () => ControlRules.ValidateSession(Session, DateTimeOffset.UtcNow));
    }
    internal void VerifyPackage()
    {
        Verify(); byte[] bytes = ControlStartupTrace.At(trace, ControlStartupStage.PackageRead, () => Store.Read("package-manifest.json"));
        var package = ControlStartupTrace.At(trace, ControlStartupStage.PackageBinding, () => {
            ControlRules.Need(ControlRules.Hash(bytes) == Session.Pins.PackageSha256, "CONTROL_PACKAGE_PIN_REFUSED");
            var value = ControlRules.Parse<ControlPackage>(bytes); ValidatePackage(value); return value;
        });
        string bin = Path.Combine(ControlRules.Root, "bin");
        ControlStartupTrace.At(trace, ControlStartupStage.PackagePaths, () =>
            ControlRules.Need(Path.GetFullPath(Environment.ProcessPath!) == Path.Combine(bin, "ExportPolicyControl.exe") &&
                Path.GetFullPath(typeof(Program).Assembly.Location) == Path.Combine(bin, "ExportPolicyControl.dll"), "CONTROL_EXECUTABLE_PATH_REFUSED"));
        ControlStartupTrace.At(trace, ControlStartupStage.PackageInventory, () => {
            var entries = Directory.GetFileSystemEntries(bin);
            ControlRules.Need(entries.Length == package.Files.Length && entries.All(path =>
                package.Files.Any(file => file.Name == Path.GetFileName(path))), "CONTROL_PACKAGE_INVENTORY_REFUSED");
        });
        ControlStartupTrace.At(trace, ControlStartupStage.PackageFiles, () => {
            foreach (var file in package.Files) {
                byte[] data = Store.Read("bin/" + file.Name);
                ControlRules.Need(data.Length == file.Size && ControlRules.Hash(data) == file.Sha256, "CONTROL_PACKAGE_FILE_REFUSED");
            }
        });
        ControlStartupTrace.At(trace, ControlStartupStage.PackagePlanBinding, () => ControlRules.Need(package.Files.Single(f => f.Name == "ExportPolicyControl.dll").Sha256 == Session.Plan.AssemblySha256 &&
            package.Files.Single(f => f.Name == "runtime-inventory.json").Sha256 == Session.Plan.RuntimeInventorySha256,
            "CONTROL_PLAN_PACKAGE_BINDING_REFUSED"));
        ControlStartupTrace.At(trace, ControlStartupStage.RuntimeInventory, () => VerifyRuntime(Store.Read("bin/runtime-inventory.json")));
        Verify();
    }
    internal static void ValidatePackage(ControlPackage package)
    {
        string[] names = { "ExportPolicyControl.exe", "ExportPolicyControl.dll", "ExportPolicyControl.runtimeconfig.json", "runtime-inventory.json" };
        ControlRules.Need(package is not null && package.SchemaVersion == 1 && package.Scope == "TEST_ONLY_EXPORT_POLICY_PACKAGE_V5" &&
            package.Files is { Length: 4 } && package.Files.All(f => f is not null && f.Size is > 0 and <= 33554432 && ControlRules.Hex(f.Sha256, 64)) &&
            package.Files.Select(f => f.Name).SequenceEqual(names), "CONTROL_PACKAGE_SCHEMA_REFUSED");
    }
    internal static string RuntimeDirectory(string group) => group switch {
        "runtime" => @"C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11",
        "fxr" => @"C:\Program Files\dotnet\host\fxr\10.0.11",
        _ => throw new InvalidDataException("CONTROL_RUNTIME_GROUP_REFUSED")
    };
    internal static void ValidateRuntime(ControlRuntimeInventory inventory)
    {
        ControlRules.Need(inventory is not null && inventory.SchemaVersion == 1 && inventory.Runtime == "10.0.11" &&
            inventory.Files is { Length: >= 4 and <= 512 }, "CONTROL_RUNTIME_INVENTORY_REFUSED");
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in inventory.Files) {
            ControlRules.Need(file is not null && file.Group is "runtime" or "fxr" && file.Name is { Length: > 0 and <= 128 } &&
                (file.Name[0] != '.' || (file.Group == "runtime" && file.Name == ".version")) &&
                file.Name.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_') &&
                file.Size is > 0 and <= 134217728 && ControlRules.Hex(file.Sha256, 64) && seen.Add(file.Group + "/" + file.Name),
                "CONTROL_RUNTIME_FILE_REFUSED");
        }
        foreach (var required in new[] { "runtime/System.Private.CoreLib.dll", "runtime/coreclr.dll", "runtime/hostpolicy.dll", "fxr/hostfxr.dll" })
            ControlRules.Need(seen.Contains(required), "CONTROL_RUNTIME_REQUIRED_MISSING");
    }
    private static byte[] ReadRuntimeFile(ControlRuntimeFile file)
    {
        string path = Path.Combine(RuntimeDirectory(file.Group), file.Name);
        for (string? cursor = path; cursor is not null; cursor = Path.GetDirectoryName(cursor))
            ControlRules.Need((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) == 0, "CONTROL_RUNTIME_REPARSE_REFUSED");
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        ControlRules.Need(stream.Length == file.Size, "CONTROL_RUNTIME_SIZE_REFUSED");
        byte[] bytes = new byte[file.Size]; stream.ReadExactly(bytes);
        ControlRules.Need(ControlRules.Hash(bytes) == file.Sha256, "CONTROL_RUNTIME_HASH_REFUSED"); return bytes;
    }
    internal static void VerifyRuntime(byte[] bytes)
    {
        var inventory = ControlRules.Parse<ControlRuntimeInventory>(bytes); ValidateRuntime(inventory);
        NativeControlIdentity.RuntimeGuard();
        ControlRules.Need(Path.GetFullPath(typeof(object).Assembly.Location) == Path.Combine(RuntimeDirectory("runtime"), "System.Private.CoreLib.dll"),
            "CONTROL_LOADED_RUNTIME_REFUSED");
        foreach (string group in new[] { "runtime", "fxr" }) {
            var files = inventory.Files.Where(f => f.Group == group).ToArray();
            var entries = Directory.GetFileSystemEntries(RuntimeDirectory(group));
            ControlRules.Need(entries.Length == files.Length && entries.All(path => files.Any(f => f.Name == Path.GetFileName(path))),
                "CONTROL_RUNTIME_EXTRA_FILE_REFUSED");
            foreach (var file in files) ReadRuntimeFile(file);
        }
        var required = new[] { "hostfxr.dll", "hostpolicy.dll", "coreclr.dll" };
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using var process = Process.GetCurrentProcess();
        ControlRules.Need(process.Modules.Count is > 0 and <= 1024, "CONTROL_LOADED_MODULE_COUNT_REFUSED");
        foreach (ProcessModule module in process.Modules) {
            if (!required.Contains(module.ModuleName, StringComparer.OrdinalIgnoreCase)) continue;
            string group = module.ModuleName.Equals("hostfxr.dll", StringComparison.OrdinalIgnoreCase) ? "fxr" : "runtime";
            var file = inventory.Files.Single(f => f.Group == group && f.Name.Equals(module.ModuleName, StringComparison.OrdinalIgnoreCase));
            ControlRules.Need(seen.Add(module.ModuleName) && Path.GetFullPath(module.FileName).Equals(Path.Combine(RuntimeDirectory(group), file.Name),
                StringComparison.OrdinalIgnoreCase), "CONTROL_LOADED_MODULE_PATH_REFUSED"); ReadRuntimeFile(file);
        }
        ControlRules.Need(seen.Count == required.Length, "CONTROL_LOADED_NATIVE_SET_REFUSED");
    }
    internal static void ValidateEnvironment(IEnumerable<string> names)
    {
        var prefixes = new[] { "DOTNET_", "COMPLUS_", "CORECLR_", "COR_", "COREHOST_" };
        var exact = new[] { "APPDOMAIN_MANAGER_ASM", "APPDOMAIN_MANAGER_TYPE", "DEVPATH", "__COMPAT_LAYER" };
        ControlRules.Need(names is not null, "CONTROL_ENV_NAMES_REFUSED");
        int count = 0;
        foreach (var name in names) {
            ControlRules.Need(++count <= 1024 && !string.IsNullOrEmpty(name) && name.Length <= 32767 && !name.Contains('\0') &&
                !prefixes.Any(p => name.StartsWith(p, StringComparison.OrdinalIgnoreCase)) &&
                !exact.Contains(name, StringComparer.OrdinalIgnoreCase), "CONTROL_RUNTIME_ENV_REFUSED");
        }
    }
    internal static void VerifyEnvironment(ControlRole role, ControlStartupTrace? trace = null)
    {
        ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentProcess, () => ValidateEnvironment(Environment.GetEnvironmentVariables().Keys.Cast<string>()));
        using var hive = ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentRegistry, () => RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64));
        using var machine = ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentRegistry, () => hive.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", false));
        using var service = ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentRegistry, () => hive.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\" + NativeControlIdentity.ServiceName(role), false));
        ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentRegistry, () => ControlRules.Need(machine is not null && service is not null, "CONTROL_REGISTRY_ENV_REFUSED"));
        ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentMachine, () => ValidateEnvironment(machine!.GetValueNames()));
        ControlStartupTrace.At(trace, ControlStartupStage.EnvironmentService, () => {
            if (service!.GetValueNames().Contains("Environment", StringComparer.OrdinalIgnoreCase)) {
                ControlRules.Need(service.GetValueKind("Environment") == RegistryValueKind.MultiString &&
                    service.GetValue("Environment", null, RegistryValueOptions.DoNotExpandEnvironmentNames) is string[], "CONTROL_SERVICE_ENV_KIND_REFUSED");
                var entries = (string[])service.GetValue("Environment", null, RegistryValueOptions.DoNotExpandEnvironmentNames)!;
                ControlRules.Need(entries.All(s => s.IndexOf('=') > 0), "CONTROL_SERVICE_ENV_ENTRY_REFUSED");
                ValidateEnvironment(entries.Select(s => s[..s.IndexOf('=')]));
            }
        });
    }
    internal static string HostHash()
    {
        NativeControlIdentity.RuntimeGuard();
        var version = new OsVersion { Size = (uint)Marshal.SizeOf<OsVersion>(), ServicePack = "" };
        ControlRules.Need(RtlGetVersion(ref version) == 0 && version.Major == 10 && version.Minor == 0 &&
            version.Build >= 10240 && version.ProductType == 1, "CONTROL_OS_PROFILE_REFUSED");
        using var hive = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
        using var key = hive.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography", false);
        ControlRules.Need(key is not null && key.GetValueKind("MachineGuid") == RegistryValueKind.String, "CONTROL_HOST_ID_REFUSED");
        var text = key.GetValue("MachineGuid", null, RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
        ControlRules.Need(Guid.TryParseExact(text, "D", out var guid) && guid != Guid.Empty, "CONTROL_HOST_ID_REFUSED");
        return ControlRules.Hash(ControlRules.Serialize(new {
            machine = ControlRules.Hash(Encoding.UTF8.GetBytes(guid.ToString("D"))),
            major = version.Major, minor = version.Minor, build = version.Build, productType = version.ProductType,
            architecture = "X64", runtime = "10.0.11"
        }));
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct OsVersion
    {
        internal uint Size, Major, Minor, Build, Platform;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] internal string ServicePack;
        internal ushort ServicePackMajor, ServicePackMinor, Suite; internal byte ProductType, Reserved;
    }
    [DllImport("ntdll.dll", ExactSpelling = true)] private static extern int RtlGetVersion(ref OsVersion version);
}
