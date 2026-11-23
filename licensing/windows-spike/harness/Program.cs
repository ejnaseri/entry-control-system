using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace Ecs.Lic008;

internal sealed record Probe(string Id, string Status, string? Error = null, string? Stage = null);
internal sealed record Plan(string Action, string RunId);
internal sealed record OwnedKey(string Provider, string Name, string PublicHash);
internal sealed record KeyIntent(string Name, string Provider);
internal static class Program
{
    internal const string Guardian = "Ecs.Lic008.Spike.Guardian";
    internal const string App = "Ecs.Lic008.Spike.App";
    internal const string KeyPrefix = "Ecs.Lic008.TEST_ONLY.";
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ecs.Lic008.Spike");
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static string guardianSid = "";
    static string appSid = "";

    static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) return SelfTest();
        if (args.Length > 0 && args[0] == "--test-arguments") { Console.WriteLine(JsonSerializer.Serialize(args.Skip(1))); return 0; }
        if (args.Length != 2 || args[0] is not ("--service" or "--child") || args[1] is not ("guardian" or "app")) return 2;
        if (args[0] == "--child" && args[1] != "app") return 2;
        try
        {
            guardianSid = Sid(Guardian); appSid = Sid(App);
            var expected = args[1] == "guardian" ? guardianSid : appSid;
            if (!IdentityAllowed(WindowsIdentity.GetCurrent().User?.Value, expected)) return 3;
            if (args[0] == "--child")
            {
                Console.WriteLine(JsonSerializer.Serialize(Denials("child"), Json));
                return 0;
            }
            ServiceHost.Run(args[1] == "guardian" ? Guardian : App, () => Execute(args[1]));
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(Error(ex)); return 1; }
    }

    internal static bool IdentityAllowed(string? actual, string expected) => actual == expected && expected.StartsWith("S-1-5-80-", StringComparison.Ordinal);
    internal static bool IsDenied(int code) => unchecked((uint)code) is 0x80090010 or 0x80070005 or 5;
    internal static bool ValidPlan(Plan p) => p.Action is "create" or "verify" or "cleanup" && Guid.TryParseExact(p.RunId, "N", out _);
    internal static string Error(Exception ex) => ex.GetType().Name + ":0x" + unchecked((uint)ex.HResult).ToString("X8");
    static string Sid(string name) => ((SecurityIdentifier)new NTAccount("NT SERVICE", name).Translate(typeof(SecurityIdentifier))).Value;
    static string Hash(byte[] data) => Convert.ToHexStringLower(SHA256.HashData(data));
    static string Protected(string name) => Path.Combine(Root, "protected", name);
    static string Shared(string name) => Path.Combine(Root, "shared", name);
    static T Read<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path)) ?? throw new InvalidDataException();
    static void WriteNew(string path, object value)
    {
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        JsonSerializer.Serialize(stream, value, Json); stream.Flush(true);
    }
    static void BytesNew(string path, byte[] data)
    {
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        stream.Write(data); stream.Flush(true);
    }
    static void Test(List<Probe> results, string id, Action action)
    {
        try { action(); results.Add(new(id, "PASS")); }
        catch (Exception ex) { results.Add(new(id, "FAILED_OR_UNAVAILABLE", Error(ex), ex.Data["probeStage"] as string)); }
    }
    internal static T Stage<T>(string name, Func<T> action)
    {
        try { return action(); }
        catch (Exception ex) { if (!ex.Data.Contains("probeStage")) ex.Data["probeStage"] = name; throw; }
    }
    static void Stage(string name, Action action) => Stage(name, () => { action(); return true; });
    static void Require(bool condition) { if (!condition) throw new InvalidDataException(); }

    static void Execute(string role)
    {
        var p = Read<Plan>(Path.Combine(Root, "plan.json"));
        if (!ValidPlan(p)) throw new InvalidDataException();
        List<Probe> results = new();
        if (role == "guardian")
        {
            if (p.Action == "create")
            {
                Test(results, "guardian.protected-file-create", () =>
                {
                    byte[] canary = RandomNumberGenerator.GetBytes(32);
                    BytesNew(Protected("sentinel.bin"), canary);
                    WriteNew(Shared("sentinel-ready.json"), new { hash = Hash(canary) });
                });
                foreach (var provider in Providers) CreateKey(provider, p.RunId, results);
                Test(results, "guardian.dpapi-ng-create", () =>
                {
                    byte[] secret = RandomNumberGenerator.GetBytes(32);
                    try
                    {
                        byte[] blob = NativeProtection.Protect("SID=" + guardianSid, secret);
                        byte[] decoded = Stage("dpapi-roundtrip-unprotect", () => NativeProtection.Unprotect(blob));
                        try { Require(CryptographicOperations.FixedTimeEquals(secret, decoded)); }
                        finally { CryptographicOperations.ZeroMemory(decoded); }
                        Stage("dpapi-write-blob", () => BytesNew(Shared("dpapi.bin"), blob));
                        Stage("dpapi-write-hash", () => BytesNew(Protected("dpapi-hash.txt"), Encoding.ASCII.GetBytes(Hash(secret))));
                    }
                    finally { CryptographicOperations.ZeroMemory(secret); }
                });
            }
            else if (p.Action == "verify")
            {
                foreach (var provider in Providers) VerifyKey(provider, results);
                Test(results, "guardian.protected-file-reopen", () => Require(File.ReadAllBytes(Protected("sentinel.bin")).Length == 32));
                Test(results, "guardian.dpapi-ng-reopen", () =>
                {
                    var secret = NativeProtection.Unprotect(File.ReadAllBytes(Shared("dpapi.bin")));
                    try { Require(Hash(secret) == File.ReadAllText(Protected("dpapi-hash.txt"))); }
                    finally { CryptographicOperations.ZeroMemory(secret); }
                });
            }
            else
            {
                foreach (var provider in Providers) CleanupKey(provider, results);
            }
        }
        else
        {
            if (p.Action == "cleanup") throw new InvalidDataException();
            results.AddRange(Denials("app"));
            Test(results, "app.child-probe-execution", () =>
            {
                using var process = Process.Start(new ProcessStartInfo(Environment.ProcessPath!)
                {
                    ArgumentList = { "--child", "app" }, UseShellExecute = false,
                    RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true
                }) ?? throw new InvalidOperationException();
                var stdout = process.StandardOutput.ReadToEndAsync();
                var stderr = process.StandardError.ReadToEndAsync();
                if (!process.WaitForExit(30000)) { process.Kill(true); throw new TimeoutException(); }
                Require(process.ExitCode == 0);
                _ = stderr.GetAwaiter().GetResult();
                results.AddRange(JsonSerializer.Deserialize<List<Probe>>(stdout.GetAwaiter().GetResult()) ?? throw new InvalidDataException());
            });
        }
        WriteNew(Path.Combine(Root, role + "-reports", p.RunId + ".json"), new
        {
            schemaVersion = 1, checklistId = "LIC-6.2-008", scope = "TEST_HARNESS_PARTIAL_PHYSICAL_PROBES",
            role, action = p.Action, runId = p.RunId, runtime = Environment.Version.ToString(),
            serviceIdentityMatched = true, timeUtc = DateTime.UtcNow, results,
            notTested = new[] { "TPM_WRAPPING", "TPM_ATTESTATION", "TPM_NV", "ORDINARY_USER", "REPAIR_REINSTALL", "POWER_LOSS", "NATIVE_FILE_INTAKE", "PRODUCTION_STORE", "WINDOWS_10_TPM_LESS_MATRIX" }
        });
    }

    static readonly string[] Providers = { "software", "tpm" };
    static CngProvider Provider(string id) => id switch { "software" => CngProvider.MicrosoftSoftwareKeyStorageProvider, "tpm" => CngProvider.MicrosoftPlatformCryptoProvider, _ => throw new InvalidDataException() };
    static OwnedKey LoadKey(string id)
    {
        var owned = Read<OwnedKey>(Shared(id + "-key.json"));
        Require(owned.Provider == id && ValidKeyName(owned.Name, id) && owned.PublicHash.Length == 64);
        return owned;
    }
    internal static bool ValidKeyName(string name, string id) => id is "software" or "tpm" && name.StartsWith(KeyPrefix + id + ".", StringComparison.Ordinal) && Guid.TryParseExact(name[(KeyPrefix.Length + id.Length + 1)..], "N", out _);
    static CngKey Open(OwnedKey k) => CngKey.Open(k.Name, Provider(k.Provider), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
    static void CreateKey(string id, string run, List<Probe> results)
    {
        Test(results, "guardian." + id + ".create-p256", () =>
        {
            string name = KeyPrefix + id + "." + run;
            // Durable intent precedes key creation. Unfinished intents require manual reconciliation.
            Stage("write-key-intent", () => WriteNew(Protected(id + "-intent.json"), new KeyIntent(name, id)));
            var parameters = new CngKeyCreationParameters
            {
                Provider = Provider(id), KeyCreationOptions = CngKeyCreationOptions.MachineKey,
                ExportPolicy = CngExportPolicies.None, KeyUsage = CngKeyUsages.Signing
            };
            using var key = Stage("cng-create", () => CngKey.Create(CngAlgorithm.ECDsaP256, name, parameters));
            using var signer = new ECDsaCng(key);
            var owned = new OwnedKey(id, name, Stage("export-public-key", () => Hash(signer.ExportSubjectPublicKeyInfo())));
            Stage("write-key-ownership", () => WriteNew(Protected(id + "-owned.json"), owned));
            var acl = new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;" + guardianSid + ")");
            byte[] bytes = new byte[acl.BinaryLength]; acl.GetBinaryForm(bytes, 0);
            Stage("set-key-dacl", () => key.SetProperty(new CngProperty("Security Descr", bytes, (CngPropertyOptions)4)));
            Stage("verify-key-policy-signature-dacl", () => AssertKey(key, owned));
            Stage("publish-public-key-record", () => WriteNew(Shared(id + "-key.json"), owned));
        });
        VerifyKey(id, results);
    }
    static void AssertKey(CngKey key, OwnedKey owned)
    {
        Require(key.IsMachineKey && key.ExportPolicy == CngExportPolicies.None && key.Algorithm == CngAlgorithm.ECDsaP256);
        Require(key.KeyUsage == CngKeyUsages.Signing);
        using var signer = new ECDsaCng(key);
        Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash);
        var data = RandomNumberGenerator.GetBytes(32);
        var signature = signer.SignData(data, HashAlgorithmName.SHA256);
        Require(signer.VerifyData(data, signature, HashAlgorithmName.SHA256));
        var sd = new RawSecurityDescriptor(key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue() ?? throw new InvalidDataException(), 0);
        Require(sd.DiscretionaryAcl is not null && sd.DiscretionaryAcl.Count == 2);
        var allowed = new HashSet<string>();
        foreach (GenericAce ace in sd.DiscretionaryAcl!)
        {
            Require(ace is CommonAce { AceQualifier: AceQualifier.AccessAllowed });
            var common = (CommonAce)ace;
            Require(common.AccessMask != 0); allowed.Add(common.SecurityIdentifier.Value);
        }
        Require(allowed.SetEquals(new[] { "S-1-5-18", guardianSid }));
    }
    static void VerifyKey(string id, List<Probe> results)
    {
        Test(results, "guardian." + id + ".reopen-sign-policy-acl", () =>
        {
            var owned = LoadKey(id); using var key = Open(owned); AssertKey(key, owned);
        });
        Test(results, "guardian." + id + ".private-export-denied", () =>
        {
            using var key = Open(LoadKey(id));
            try
            {
                byte[] bytes = key.Export(CngKeyBlobFormat.EccPrivateBlob);
                CryptographicOperations.ZeroMemory(bytes);
            }
            catch (CryptographicException ex) when (IsDenied(ex.HResult) || unchecked((uint)ex.HResult) == 0x80090029) { return; }
            throw new InvalidDataException("Unexpected private export");
        });
    }
    static Probe Denied(string id, Action action)
    {
        try { action(); return new(id, "FAIL_ACCESS_GRANTED"); }
        catch (Exception ex) when (IsDenied(ex.HResult)) { return new(id, "PASS_ACCESS_DENIED", Error(ex)); }
        catch (Exception ex) { return new(id, "INCONCLUSIVE", Error(ex)); }
    }
    static List<Probe> Denials(string actor)
    {
        List<Probe> results = new();
        foreach (var provider in Providers)
        {
            OwnedKey key;
            try { key = LoadKey(provider); }
            catch (Exception ex) { results.Add(new(actor + "." + provider + ".key-denied", "NOT_TESTED_PREREQUISITE", Error(ex))); continue; }
            results.Add(Denied(actor + "." + provider + ".key-denied", () => { using var opened = Open(key); }));
        }
        if (File.Exists(Shared("sentinel-ready.json")))
        {
            results.Add(Denied(actor + ".protected-read-denied", () => File.ReadAllBytes(Protected("sentinel.bin"))));
            results.Add(Denied(actor + ".protected-write-denied", () =>
            {
                using var stream = new FileStream(Protected("sentinel.bin"), FileMode.Open, FileAccess.Write, FileShare.None);
                // Opening for write proves access; do not alter the canary.
            }));
        }
        else results.Add(new(actor + ".protected-file-denied", "NOT_TESTED_PREREQUISITE"));
        byte[] blob;
        try { blob = File.ReadAllBytes(Shared("dpapi.bin")); }
        catch (Exception ex) { results.Add(new(actor + ".dpapi-ng-denied", "NOT_TESTED_PREREQUISITE", Error(ex))); return results; }
        results.Add(Denied(actor + ".dpapi-ng-denied", () =>
        {
            byte[] secret = NativeProtection.Unprotect(blob); CryptographicOperations.ZeroMemory(secret);
        }));
        return results;
    }
    static void CleanupKey(string id, List<Probe> results)
    {
        Test(results, "guardian." + id + ".cleanup", () =>
        {
            var intentPath = Protected(id + "-intent.json");
            var ownedPath = Protected(id + "-owned.json");
            if (!File.Exists(intentPath)) return;
            var intent = Read<KeyIntent>(intentPath);
            Require(intent.Provider == id && ValidKeyName(intent.Name, id));
            CngKey opened;
            try { opened = CngKey.Open(intent.Name, Provider(id), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent); }
            catch (CryptographicException ex) when (unchecked((uint)ex.HResult) is 0x80090016 or 0x80090011) { return; }
            using var key = opened;
            if (!File.Exists(ownedPath)) throw new InvalidDataException("Incomplete ownership; retain for reconciliation");
            var owned = Read<OwnedKey>(ownedPath);
            Require(owned.Provider == id && owned.Name == intent.Name);
            using var signer = new ECDsaCng(key);
            Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash);
            key.Delete();
        });
    }
    static int SelfTest()
    {
        var run = Guid.NewGuid().ToString("N");
        var checks = new[] {
            ValidPlan(new("create", run)), ValidPlan(new("verify", run)), ValidPlan(new("cleanup", run)),
            !ValidPlan(new("restore", run)), !ValidPlan(new("create", "../x")),
            !IdentityAllowed("S-1-5-18", "S-1-5-80-1"), !IdentityAllowed(null, "S-1-5-80-1"),
            !IdentityAllowed("S-1-5-80-2", "S-1-5-80-1"), IdentityAllowed("S-1-5-80-1", "S-1-5-80-1"),
            IsDenied(unchecked((int)0x80090010)), IsDenied(unchecked((int)0x80070005)),
            !IsDenied(unchecked((int)0x80090016)), !IsDenied(unchecked((int)0x80090029)),
            ValidKeyName(KeyPrefix + "software." + run, "software"),
            !ValidKeyName("EntryControlSystem.License", "software"), !ValidKeyName(KeyPrefix + "tpm." + run, "software")
        };
        Console.WriteLine($"Pure guard tests: {checks.Count(x => x)}/{checks.Length}; no services or keys touched.");
        return checks.All(x => x) ? 0 : 1;
    }
}
