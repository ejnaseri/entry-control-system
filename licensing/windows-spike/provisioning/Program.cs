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
internal sealed record Ready(string RunId, bool Key, bool Secret, bool File);
internal static class Program
{
    internal const string Guardian = "Ecs.Lic008.ProvisioningV1.Guardian";
    internal const string App = "Ecs.Lic008.ProvisioningV1.App";
    internal const string KeyPrefix = "Ecs.Lic008.ProvisioningV1.TEST_ONLY.";
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ecs.Lic008.ProvisioningV1");
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static string guardianSid = "";
    static string appSid = "";
    static List<Probe>? stageResults;
    static string stageOwner = "";

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
            if (!IdentityAllowed(WindowsIdentity.GetCurrent().User?.Value, expected) || !TokenEvidence.Allowed(expected)) return 3;
            if (args[0] == "--child")
            {
                var child = Denials("child");
                child.Add(new("child.token-identity", "PASS", Stage: expected));
                Console.WriteLine(JsonSerializer.Serialize(child, Json));
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
    static void Plain(string path)
    {
        for (string? cursor = Path.GetFullPath(path); cursor is not null; cursor = Path.GetDirectoryName(cursor))
            if ((File.Exists(cursor) || Directory.Exists(cursor)) && (File.GetAttributes(cursor) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("Linked path refused");
    }
    static T Read<T>(string path)
    {
        Plain(path);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length is < 1 or > 262144) throw new InvalidDataException();
        return JsonSerializer.Deserialize<T>(stream, new JsonSerializerOptions { UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow }) ?? throw new InvalidDataException();
    }
    static void WriteNew(string path, object value)
    {
        Plain(path);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        JsonSerializer.Serialize(stream, value, Json); stream.Flush(true);
    }
    static void BytesNew(string path, byte[] data)
    {
        Plain(path);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        stream.Write(data); stream.Flush(true);
    }
    static void Test(List<Probe> results, string id, Action action)
    {
        stageResults = results; stageOwner = id;
        try { action(); results.Add(new(id, "PASS")); }
        catch (Exception ex) { results.Add(new(id, "FAILED_OR_UNAVAILABLE", Error(ex), ex.Data["probeStage"] as string)); }
        finally { stageResults = null; stageOwner = ""; }
    }
    internal static T Stage<T>(string name, Func<T> action)
    {
        try { var result = action(); stageResults?.Add(new(stageOwner + ".stage." + name, "PASS", Stage: name)); return result; }
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
                Test(results, "guardian.protected-file-reopen", () =>
                {
                    using var expected = JsonDocument.Parse(File.ReadAllText(Shared("sentinel-ready.json")));
                    Require(Hash(File.ReadAllBytes(Protected("sentinel.bin"))) == expected.RootElement.GetProperty("hash").GetString());
                });
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
            if (p.Action != "cleanup")
            {
                bool Passed(string id) => results.Any(x => x.Id == id && x.Status == "PASS");
                WriteNew(Shared("ready-" + p.RunId + ".json"), new Ready(p.RunId,
                    Passed("guardian.software.reopen-sign-policy-acl") && Passed("guardian.software.private-export-denied"),
                    Passed(p.Action == "create" ? "guardian.dpapi-ng-create" : "guardian.dpapi-ng-reopen"),
                    Passed(p.Action == "create" ? "guardian.protected-file-create" : "guardian.protected-file-reopen")));
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
            schemaVersion = 2, checklistId = "LIC-6.2-008", scope = "TEST_ONLY_PROVISIONING_V1",
            role, action = p.Action, runId = p.RunId, runtime = Environment.Version.ToString(),
            serviceIdentityMatched = true, token = TokenEvidence.Capture(role == "guardian" ? guardianSid : appSid),
            binarySha256 = Hash(File.ReadAllBytes(Environment.ProcessPath!)),
            osVersion = Environment.OSVersion.Version.ToString(), processId = Environment.ProcessId, timeUtc = DateTime.UtcNow, results,
            notTested = new[] { "TPM_SIGNING", "NORMAL_REBOOT", "DOMAIN_INVENTORY_EXTERNAL", "TPM_WRAPPING", "TPM_ATTESTATION", "TPM_NV", "ORDINARY_USER", "REPAIR_REINSTALL", "POWER_LOSS", "NATIVE_FILE_INTAKE", "PRODUCTION_STORE", "WINDOWS_10_TPM_LESS_MATRIX" }
        });
    }

    static readonly string[] Providers = { "software" };
    static CngProvider Provider(string id) => id switch { "software" => CngProvider.MicrosoftSoftwareKeyStorageProvider, "tpm" => CngProvider.MicrosoftPlatformCryptoProvider, _ => throw new InvalidDataException() };
    static OwnedKey LoadKey(string id)
    {
        var owned = Read<OwnedKey>(Shared(id + "-key.json"));
        Require(owned.Provider == id && ValidKeyName(owned.Name, id) && owned.PublicHash.Length == 64);
        return owned;
    }
    internal static bool ValidKeyName(string name, string id) => id == "software" && name.StartsWith(KeyPrefix + id + ".", StringComparison.Ordinal) && Guid.TryParseExact(name[(KeyPrefix.Length + id.Length + 1)..], "N", out _);
    static CngKey Open(OwnedKey k) => CngKey.Open(k.Name, Provider(k.Provider), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
    static void CreateKey(string id, string run, List<Probe> results)
    {
        Test(results, "guardian." + id + ".create-p256", () =>
        {
            string name = KeyPrefix + id + "." + run;
            // Durable intent precedes key creation. Unfinished intents require manual reconciliation.
            Stage("write-key-intent", () => WriteNew(Protected(id + "-intent.json"), new KeyIntent(name, id)));
            using var key = NativeCreation.Create(name, guardianSid);
            using var signer = new ECDsaCng(key);
            var owned = new OwnedKey(id, name, Stage("export-public-key", () => Hash(signer.ExportSubjectPublicKeyInfo())));
            Stage("write-key-ownership", () => WriteNew(Protected(id + "-owned.json"), owned));
            Stage("verify-key-policy-signature-dacl", () => AssertKey(key, owned));
            Stage("publish-public-key-record", () => WriteNew(Shared(id + "-key.json"), owned));
        });
        VerifyKey(id, results);
    }
    static void AssertKey(CngKey key, OwnedKey owned)
    {
        Stage("check-machine-export-algorithm", () => Require(key.IsMachineKey && key.ExportPolicy == CngExportPolicies.None && key.Algorithm == CngAlgorithm.ECDsaP256));
        Stage("check-signing-usage", () => Require(key.KeyUsage == CngKeyUsages.Signing));
        using var signer = new ECDsaCng(key);
        Stage("compare-public-identity", () => Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash));
        var data = RandomNumberGenerator.GetBytes(32);
        var signature = Stage("sign-challenge", () => signer.SignData(data, HashAlgorithmName.SHA256));
        Stage("verify-signature", () => Require(signer.VerifyData(data, signature, HashAlgorithmName.SHA256)));
        var sd = Stage("read-key-dacl", () => new RawSecurityDescriptor(key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue() ?? throw new InvalidDataException(), 0));
        Stage("check-protected-dacl", () => Require((sd.ControlFlags & ControlFlags.DiscretionaryAclProtected) != 0 && sd.DiscretionaryAcl is not null && sd.DiscretionaryAcl.Count == 2));
        var allowed = new HashSet<string>();
        foreach (GenericAce ace in sd.DiscretionaryAcl!)
        {
            Require(ace is CommonAce { AceQualifier: AceQualifier.AccessAllowed });
            var common = (CommonAce)ace;
            Stage("check-ace-rights", () => Require(common.AccessMask == 0x10000000)); allowed.Add(common.SecurityIdentifier.Value);
        }
        Stage("check-allowed-principals", () => Require(allowed.SetEquals(new[] { "S-1-5-18", guardianSid })));
    }
    static void VerifyKey(string id, List<Probe> results)
    {
        Test(results, "guardian." + id + ".reopen-sign-policy-acl", () =>
        {
            var owned = Stage("load-public-record", () => LoadKey(id)); using var key = Stage("reopen-key", () => Open(owned)); AssertKey(key, owned);
        });
        if (!results.Any(x => x.Id == "guardian." + id + ".reopen-sign-policy-acl" && x.Status == "PASS"))
        {
            results.Add(new("guardian." + id + ".private-export-denied", "NOT_TESTED_PREREQUISITE")); return;
        }
        Test(results, "guardian." + id + ".private-export-denied", () =>
        {
            using var key = Stage("reopen-for-export", () => Open(LoadKey(id)));
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
        var plan = Read<Plan>(Path.Combine(Root, "plan.json"));
        Require(ValidPlan(plan) && plan.Action != "cleanup");
        var ready = Read<Ready>(Shared("ready-" + plan.RunId + ".json"));
        Require(ready.RunId == plan.RunId);
        foreach (var provider in Providers)
        {
            if (!ready.Key) { results.Add(new(actor + "." + provider + ".key-denied", "NOT_TESTED_PREREQUISITE")); continue; }
            OwnedKey key;
            try { key = LoadKey(provider); }
            catch (Exception ex) { results.Add(new(actor + "." + provider + ".key-denied", "NOT_TESTED_PREREQUISITE", Error(ex))); continue; }
            results.Add(Denied(actor + "." + provider + ".key-denied", () => { using var opened = Open(key); }));
        }
        if (ready.File)
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
        if (!ready.Secret) { results.Add(new(actor + ".dpapi-ng-denied", "NOT_TESTED_PREREQUISITE")); return results; }
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
        string probe = "guardian." + id + ".cleanup";
        try
        {
            var intentPath = Protected(id + "-intent.json");
            var ownedPath = Protected(id + "-owned.json");
            if (!File.Exists(intentPath)) { results.Add(new(probe, "NO_INTENT_RETAINED")); return; }
            var intent = Read<KeyIntent>(intentPath);
            Require(intent.Provider == id && ValidKeyName(intent.Name, id));
            using var key = CngKey.Open(intent.Name, Provider(id), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
            if (!File.Exists(ownedPath)) { results.Add(new(probe, "INCOMPLETE_OWNERSHIP")); return; }
            var owned = Read<OwnedKey>(ownedPath);
            Require(owned.Provider == id && owned.Name == intent.Name);
            using var signer = new ECDsaCng(key);
            Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash);
            key.Delete();
            try { using var unexpected = Open(owned); results.Add(new(probe, "FAIL_STILL_OPEN")); }
            catch (CryptographicException ex) when (unchecked((uint)ex.HResult) == 0x80090016) { results.Add(new(probe, "DELETED_AND_CONFIRMED")); }
        }
        catch (CryptographicException ex) when (unchecked((uint)ex.HResult) is 0x80090016 or 0x80090011)
        { results.Add(new(probe, "ABSENT_FOR_CALLER", Error(ex))); }
        catch (Exception ex) { results.Add(new(probe, "DENIED_OR_UNKNOWN", Error(ex))); }
    }
    static int SelfTest()
    {
        var run = Guid.NewGuid().ToString("N");
        var checks = new List<bool> {
            ValidPlan(new("create", run)), ValidPlan(new("verify", run)), ValidPlan(new("cleanup", run)),
            !ValidPlan(new("restore", run)), !ValidPlan(new("create", "../x")),
            !IdentityAllowed("S-1-5-18", "S-1-5-80-1"), !IdentityAllowed(null, "S-1-5-80-1"),
            !IdentityAllowed("S-1-5-80-2", "S-1-5-80-1"), IdentityAllowed("S-1-5-80-1", "S-1-5-80-1"),
            IsDenied(unchecked((int)0x80090010)), IsDenied(unchecked((int)0x80070005)),
            !IsDenied(unchecked((int)0x80090016)), !IsDenied(unchecked((int)0x80090029)),
            ValidKeyName(KeyPrefix + "software." + run, "software"),
            !ValidKeyName("EntryControlSystem.License", "software"), !ValidKeyName(KeyPrefix + "tpm." + run, "software"),
            !ValidKeyName("Ecs.Lic008.TEST_ONLY.software." + run, "software"),
            !ValidKeyName(KeyPrefix + "software." + run + ":alias", "software"),
            !ValidKeyName(KeyPrefix + "tpm." + run, "tpm"),
            !TokenEvidence.Accept(new(null, "S-1-5-80-1", false, null)),
            !TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 16)),
            !TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 0)),
            TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 4)),
            TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, null))
        };
        var report = new List<Probe>(); bool afterFailure = false;
        Test(report, "synthetic", () =>
        {
            Stage("before", () => true);
            Stage("outer", () => Stage<bool>("precise-failure", () => throw new CryptographicException(unchecked((int)0x80090010))));
            afterFailure = true;
        });
        checks.Add(!afterFailure && report.Count == 2 && report[0].Stage == "before" && report[0].Status == "PASS");
        checks.Add(report[1].Stage == "precise-failure" && report[1].Error == "CryptographicException:0x80090010");
        Test(report, "next", () => Stage("fresh", () => true));
        checks.Add(report[2].Id == "next.stage.fresh" && report[3].Id == "next" && report[3].Status == "PASS");
        checks.Add(!JsonSerializer.Serialize(Denied("missing", () => throw new FileNotFoundException("SECRET_CANARY"))).Contains("SECRET_CANARY"));
        checks.Add(Denied("missing", () => throw new FileNotFoundException()).Status == "INCONCLUSIVE");
        checks.Add(Denied("denied", () => throw new UnauthorizedAccessException()).Status == "PASS_ACCESS_DENIED");
        checks.Add(Denied("unexpected", () => { }).Status == "FAIL_ACCESS_GRANTED");
        Console.WriteLine($"Pure guard tests: {checks.Count(x => x)}/{checks.Count}; no services or keys touched.");
        return checks.All(x => x) ? 0 : 1;
    }
}
