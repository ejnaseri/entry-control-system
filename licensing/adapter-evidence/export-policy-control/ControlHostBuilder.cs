using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.NET.HostModel.AppHost;

// Build-time helper only; never included in ExportPolicyControl.dll.
internal static class ControlHostBuilder
{
    public static void Main(string[] args)
    {
        if (!OperatingSystem.IsWindows() || RuntimeInformation.ProcessArchitecture != Architecture.X64 ||
            Environment.Version.ToString() != "10.0.11")
            throw new InvalidDataException("CONTROL_HOST_BUILD_RUNTIME_REFUSED");
        // This helper is not part of the product assembly. Its verification
        // form loads the DLL solely to use its real canonical parsers
        // and pure schema validators, never its entry point or native helpers.
        if (args.Length == 3) {
            VerifyPackage(args[0], args[1], args[2]);
            return;
        }
        if (args.Length != 2 || File.Exists(args[1]))
            throw new InvalidDataException("NEW_CONTROL_HOST_ONLY");
        HostWriter.CreateAppHost(args[0], args[1], "ExportPolicyControl.dll",
            dotNetSearchOptions: new HostWriter.DotNetSearchOptions {
                Location = HostWriter.DotNetSearchOptions.SearchLocation.Global
            });
    }

    private static void VerifyPackage(string assemblyPath, string manifestPath, string inventoryPath)
    {
        var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.GetFullPath(assemblyPath));
        const string prefix = "EntryControl.TestOnly.ExportPolicyControl.";
        const BindingFlags flags = BindingFlags.NonPublic | BindingFlags.Static;
        Type TypeOf(string name) => assembly.GetType(prefix + name, throwOnError: true)!;
        var rules = TypeOf("ControlRules");
        var admission = TypeOf("NativeControlAdmission");
        var parse = rules.GetMethod("Parse", flags) ?? throw new InvalidDataException("CONTROL_PARSER_MISSING");
        byte[] manifest = File.ReadAllBytes(manifestPath), inventory = File.ReadAllBytes(inventoryPath);
        object Parse(string name, byte[] bytes) => parse.MakeGenericMethod(TypeOf(name)).Invoke(null, new object[] { bytes })
            ?? throw new InvalidDataException("CONTROL_PARSER_RETURNED_NULL");
        void Validate(string name, object value) =>
            (admission.GetMethod(name, flags) ?? throw new InvalidDataException("CONTROL_VALIDATOR_MISSING"))
                .Invoke(null, new[] { value });
        Validate("ValidatePackage", Parse("ControlPackage", manifest));
        Validate("ValidateRuntime", Parse("ControlRuntimeInventory", inventory));
        bool capable = (bool)(TypeOf("ControlCapability").GetProperty("Enabled", flags)?.GetValue(null)
            ?? throw new InvalidDataException("CONTROL_CAPABILITY_MARKER_MISSING"));
        Console.WriteLine(JsonSerializer.Serialize(new {
            scope = "TEST_ONLY_EXPORT_POLICY_CONTROL_PACKAGE_VERIFIED_V5",
            manifestSha256 = Convert.ToHexString(SHA256.HashData(manifest)).ToLowerInvariant(),
            runtimeInventorySha256 = Convert.ToHexString(SHA256.HashData(inventory)).ToLowerInvariant(),
            canonicalPackageVerified = true,
            canonicalRuntimeInventoryVerified = true,
            physicalExecutionEnabled = capable,
            physicalTested = false,
            securityAccepted = false,
            productionAccepted = false
        }));
    }
}
