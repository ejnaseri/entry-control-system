using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace Ecs.Lic008;

internal sealed record Probe(string Id, string Status, string? Error = null, string? Stage = null);
internal sealed record Plan(string Action, string RunId, string BinaryHash = "", bool KeyExperimentAccepted = false,
    string ExperimentId = "", bool AclBehaviorAccepted = false);
internal sealed record OwnedKey(string Provider, string Name, string PublicHash);
internal sealed record KeyIntent(string Name, string Provider);
internal sealed record AclControlSet(string ExperimentId, OwnedKey Restricted, OwnedKey AppReadable);
internal sealed record Ready(string RunId, bool Key, bool Secret, bool File);
internal static class Program
{
    internal const string Setup = "Ecs.Lic008.ComparisonV1.Setup";
    internal const string Guardian = "Ecs.Lic008.ComparisonV1.Guardian";
    internal const string App = "Ecs.Lic008.ComparisonV1.App";
    internal const string KeyPrefix = "Ecs.Lic008.ComparisonV1.TEST_ONLY.";
    internal const string RetainedKeyName = KeyPrefix + "software.0d26c5c6d100431b88f6bbf5ecb31956";
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ecs.Lic008.ComparisonV1");
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static string guardianSid = "";
    static string appSid = "";
    static List<Probe>? stageResults;
    static string stageOwner = "";

    static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) return SelfTest();
        if (args.Length > 0 && args[0] == "--test-arguments") { Console.WriteLine(JsonSerializer.Serialize(args.Skip(1))); return 0; }
        if (args.Length != 2 || args[0] is not ("--service" or "--child") || args[1] is not ("guardian" or "app" or "setup")) return 2;
        if (args[0] == "--child" && args[1] != "app") return 2;
        try
        {
            guardianSid = Sid(Guardian); appSid = Sid(App);
            var expected = args[1] == "guardian" ? guardianSid : args[1] == "setup" ? "S-1-5-18" : appSid;
            if (args[1] == "setup")
            {
                var setupToken = TokenEvidence.Capture(Sid(Setup));
                if (!SetupAllowed(setupToken.UserSid, setupToken.ServiceGroupAttributes)) return 3;
            }
            else if (!IdentityAllowed(WindowsIdentity.GetCurrent().User?.Value, expected) || !TokenEvidence.Allowed(expected)) return 3;
            if (args[0] == "--child")
            {
                var child = ChildProbes();
                child.Add(new("child.token-identity", "PASS", Stage: expected));
                Console.WriteLine(JsonSerializer.Serialize(child, Json));
                return 0;
            }
            ServiceHost.Run(args[1] == "guardian" ? Guardian : args[1] == "setup" ? Setup : App, () => Execute(args[1]));
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(Error(ex)); return 1; }
    }

    internal static bool IdentityAllowed(string? actual, string expected) => actual == expected && expected.StartsWith("S-1-5-80-", StringComparison.Ordinal);
    internal static bool IsDenied(int code) => unchecked((uint)code) is 0x80090010 or 0x80070005 or 5;
    internal static bool SetupAllowed(string? user, uint? attributes) => user == "S-1-5-18" && attributes is not null && (attributes.Value & 4) != 0 && (attributes.Value & 16) == 0;
    internal static bool ValidPlan(Plan p)
    {
        bool run = Guid.TryParseExact(p.RunId, "N", out _);
        if (p.Action is "acl-create" or "acl-probe" or "acl-cleanup")
            return run && Guid.TryParseExact(p.ExperimentId, "N", out _) && p.ExperimentId != p.RunId && !p.KeyExperimentAccepted && !p.AclBehaviorAccepted;
        return p.Action is "create" or "handoff" or "verify" or "cleanup" or "protect" or "verify-protect" or "diagnose-open" or "diagnose-protection" &&
            run && p.ExperimentId.Length == 0 && (p.Action is not ("protect" or "verify-protect") || p.KeyExperimentAccepted) &&
            (!p.AclBehaviorAccepted || p.Action is "verify" or "protect" or "verify-protect") &&
            (p.Action != "diagnose-protection" || (!p.KeyExperimentAccepted && !p.AclBehaviorAccepted));
    }
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
        if (!ValidPlan(p) || p.BinaryHash != Hash(File.ReadAllBytes(Environment.ProcessPath!))) throw new InvalidDataException();
        Require(role == "setup" ? p.Action is "create" or "acl-create" : p.Action is not ("create" or "acl-create"));
        Require(p.Action != "diagnose-protection" || role == "guardian");
        List<Probe> results = new();
        if (role is "guardian" or "setup")
        {
            if (p.Action == "acl-create")
            {
                CreateAclControls(p.ExperimentId, results);
            }
            else if (p.Action == "create")
            {
                Test(results, "guardian.protected-file-create", () =>
                {
                    byte[] canary = RandomNumberGenerator.GetBytes(32);
                    BytesNew(Protected("sentinel.bin"), canary);
                    WriteNew(Shared("sentinel-ready.json"), new { hash = Hash(canary) });
                });
                foreach (var provider in Providers) CreateKey(provider, p.RunId, results);
            }
            else if (p.Action == "handoff")
            {
                Test(results, "guardian.software.retained-handoff", () =>
                {
                    var owned = Read<OwnedKey>(Protected("software-owned.json"));
                    var intent = Read<KeyIntent>(Protected("software-intent.json"));
                    Require(owned.Provider == "software" && intent.Provider == "software" && owned.Name == intent.Name &&
                        owned.Name == RetainedKeyName);
                    using var key = Open(owned);
                    AssertKey(key, owned);
                    WriteNew(Shared("software-key.json"), owned);
                });
            }
            else if (p.Action == "protect")
            {
                Test(results, "guardian.dpapi-ng-create", () =>
                {
                    byte[] secret = RandomNumberGenerator.GetBytes(32);
                    try
                    {
                        byte[] blob = NativeProtection.Protect("LOCAL=user", secret);
                        byte[] decoded = Stage("dpapi-roundtrip-unprotect", () => NativeProtection.Unprotect(blob));
                        try { Require(CryptographicOperations.FixedTimeEquals(secret, decoded)); }
                        finally { CryptographicOperations.ZeroMemory(decoded); }
                        Stage("dpapi-write-blob", () => BytesNew(Shared("dpapi.bin"), blob));
                        Stage("dpapi-write-hash", () => BytesNew(Protected("dpapi-hash.txt"), Encoding.ASCII.GetBytes(Hash(secret))));
                    }
                    finally { CryptographicOperations.ZeroMemory(secret); }
                });
            }
            else if (p.Action is "verify" or "verify-protect")
            {
                foreach (var provider in Providers) VerifyKey(provider, results);
                Test(results, "guardian.protected-file-reopen", () =>
                {
                    using var expected = JsonDocument.Parse(File.ReadAllText(Shared("sentinel-ready.json")));
                    Require(Hash(File.ReadAllBytes(Protected("sentinel.bin"))) == expected.RootElement.GetProperty("hash").GetString());
                });
                if (p.Action == "verify-protect") Test(results, "guardian.dpapi-ng-reopen", () =>
                {
                    var secret = NativeProtection.Unprotect(File.ReadAllBytes(Shared("dpapi.bin")));
                    try { Require(Hash(secret) == File.ReadAllText(Protected("dpapi-hash.txt"))); }
                    finally { CryptographicOperations.ZeroMemory(secret); }
                });
            }
            else if (p.Action == "diagnose-open")
            {
                Test(results, "guardian.software.retained-records", () =>
                {
                    var intent = Read<KeyIntent>(Protected("software-intent.json"));
                    var owned = Read<OwnedKey>(Protected("software-owned.json"));
                    var published = LoadKey("software");
                    Require(intent.Provider == "software" && intent.Name == RetainedKeyName &&
                        owned.Provider == "software" && owned.Name == RetainedKeyName && owned.PublicHash == published.PublicHash);
                });
                VerifyKey("software", results);
                results.AddRange(NativeOpenProbes("guardian"));
            }
            else if (p.Action == "diagnose-protection")
            {
                results.AddRange(ProtectionDiagnostics.Collect(guardianSid));
            }
            else if (p.Action == "acl-probe")
            {
                results.AddRange(AclControlProbes("guardian", p.ExperimentId));
            }
            else if (p.Action == "acl-cleanup")
            {
                CleanupAclControl(p.ExperimentId, "restricted", results);
                CleanupAclControl(p.ExperimentId, "app-readable", results);
            }
            else
            {
                foreach (var provider in Providers) CleanupKey(provider, results);
            }
            if (role == "guardian" && p.Action is not ("cleanup" or "diagnose-open" or "diagnose-protection" or "acl-probe" or "acl-cleanup"))
            {
                bool Passed(string id) => results.Any(x => x.Id == id && x.Status == "PASS");
                WriteNew(Shared("ready-" + p.RunId + ".json"), new Ready(p.RunId,
                    Passed("guardian.software.reopen-sign-policy-acl") && Passed("guardian.software.private-export-denied"),
                    Passed(p.Action == "protect" ? "guardian.dpapi-ng-create" : "guardian.dpapi-ng-reopen"),
                    Passed(p.Action == "create" ? "guardian.protected-file-create" : "guardian.protected-file-reopen")));
            }
        }
        else
        {
            if (p.Action is "cleanup" or "acl-cleanup") throw new InvalidDataException();
            results.AddRange(p.Action == "diagnose-open" ? NativeOpenProbes("app") :
                p.Action == "acl-probe" ? AclControlProbes("app", p.ExperimentId) : Denials("app"));
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
            schemaVersion = 2, checklistId = "LIC-6.2-008", scope = "TEST_ONLY_COMPARISON_V1",
            role, action = p.Action, runId = p.RunId, runtime = Environment.Version.ToString(),
            aclBehaviorAccepted = p.AclBehaviorAccepted,
            serviceIdentityMatched = true, token = TokenEvidence.Capture(role == "guardian" ? guardianSid : role == "setup" ? Sid(Setup) : appSid),
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
    internal static bool ValidAclControlKeyName(string name, string experimentId, string label) =>
        label is ("restricted" or "app-readable") && Guid.TryParseExact(experimentId, "N", out _) &&
        name == KeyPrefix + "acl-" + label + "." + experimentId;
    static CngKey Open(OwnedKey k) => CngKey.Open(k.Name, Provider(k.Provider), CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
    static void CreateKey(string id, string run, List<Probe> results)
    {
        Test(results, "setup." + id + ".create-p256", () =>
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
    static string AclRecord(string experimentId, string label, string kind) =>
        "acl-" + experimentId + "-" + label + "-" + kind + ".json";
    static string AclName(string experimentId, string label) => KeyPrefix + "acl-" + label + "." + experimentId;
    static void CreateAclControls(string experimentId, List<Probe> results)
    {
        CreateAclControl(experimentId, "restricted", false, results);
        CreateAclControl(experimentId, "app-readable", true, results);
        Test(results, "setup.acl.publish-controls", () =>
        {
            var restricted = Read<OwnedKey>(Protected(AclRecord(experimentId, "restricted", "owned")));
            var readable = Read<OwnedKey>(Protected(AclRecord(experimentId, "app-readable", "owned")));
            Require(ValidAclControlKeyName(restricted.Name, experimentId, "restricted") &&
                ValidAclControlKeyName(readable.Name, experimentId, "app-readable"));
            WriteNew(Shared("acl-control-" + experimentId + ".json"), new AclControlSet(experimentId, restricted, readable));
        });
    }
    static void CreateAclControl(string experimentId, string label, bool appReadable, List<Probe> results)
    {
        Test(results, "setup.acl." + label + ".create-p256", () =>
        {
            string name = AclName(experimentId, label);
            Stage("write-key-intent", () => WriteNew(Protected(AclRecord(experimentId, label, "intent")), new KeyIntent(name, "software")));
            using var key = AclControlNative.Create(name, experimentId, label, guardianSid, appSid, appReadable);
            using var signer = new ECDsaCng(key);
            var owned = new OwnedKey("software", name, Stage("export-public-key", () => Hash(signer.ExportSubjectPublicKeyInfo())));
            Stage("write-key-ownership", () => WriteNew(Protected(AclRecord(experimentId, label, "owned")), owned));
            Stage("verify-key-policy-signature-dacl", () => AssertControlKey(key, owned, appReadable));
        });
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
        Stage("check-protected-dacl", () => AssertDacl(sd, guardianSid, key.Provider?.Provider ?? throw new InvalidDataException()));
    }
    static void AssertControlKey(CngKey key, OwnedKey owned, bool appReadable)
    {
        Stage("check-machine-export-algorithm", () => Require(key.IsMachineKey && key.ExportPolicy == CngExportPolicies.None && key.Algorithm == CngAlgorithm.ECDsaP256));
        Stage("check-signing-usage", () => Require(key.KeyUsage == CngKeyUsages.Signing));
        using var signer = new ECDsaCng(key);
        Stage("compare-public-identity", () => Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash));
        var data = RandomNumberGenerator.GetBytes(32);
        var signature = Stage("sign-challenge", () => signer.SignData(data, HashAlgorithmName.SHA256));
        Stage("verify-signature", () => Require(signer.VerifyData(data, signature, HashAlgorithmName.SHA256)));
        var sd = Stage("read-key-dacl", () => new RawSecurityDescriptor(key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue() ?? throw new InvalidDataException(), 0));
        Stage("check-protected-dacl", () => AssertDaclSet(sd,
            appReadable ? new[] { "S-1-5-18", guardianSid, appSid } : new[] { "S-1-5-18", guardianSid },
            key.Provider?.Provider ?? throw new InvalidDataException()));
    }
    internal static void AssertDacl(RawSecurityDescriptor sd, string expectedGuardian, string provider)
        => AssertDaclSet(sd, new[] { "S-1-5-18", expectedGuardian }, provider);
    internal static void AssertDaclSet(RawSecurityDescriptor sd, string[] expectedPrincipals, string provider)
    {
        Require(provider == CngProvider.MicrosoftSoftwareKeyStorageProvider.Provider);
        Require(expectedPrincipals.Length is 2 or 3 && expectedPrincipals.Distinct(StringComparer.Ordinal).Count() == expectedPrincipals.Length &&
            expectedPrincipals[0] == "S-1-5-18" && expectedPrincipals.Skip(1).All(x => x.StartsWith("S-1-5-80-", StringComparison.Ordinal)));
        Require((sd.ControlFlags & ControlFlags.DiscretionaryAclProtected) != 0 && sd.DiscretionaryAcl is not null && sd.DiscretionaryAcl.Count == expectedPrincipals.Length);
        var allowed = new HashSet<string>();
        foreach (GenericAce ace in sd.DiscretionaryAcl!)
        {
            Require(ace is CommonAce { AceQualifier: AceQualifier.AccessAllowed, IsCallback: false, AceFlags: AceFlags.None });
            var common = (CommonAce)ace;
            // Exact supported representations only: requested GA and the Software
            // KSP representation observed on the retained key (EV0101).
            // Do not accept arbitrary extra bits merely because GA is present.
            Stage("check-ace-rights", () => Require(unchecked((uint)common.AccessMask) is 0x10000000u or 0xD01F01FFu));
            Require(allowed.Add(common.SecurityIdentifier.Value));
        }
        Stage("check-allowed-principals", () => Require(allowed.SetEquals(expectedPrincipals)));
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
    static Probe KeyIsolation(string id, bool aclBehaviorAccepted, Action action)
    {
        try { action(); return new(id, "FAIL_ACCESS_GRANTED"); }
        catch (Exception ex) when (IsDenied(ex.HResult)) { return new(id, "PASS_ACCESS_DENIED", Error(ex)); }
        catch (CryptographicException ex) when (unchecked((uint)ex.HResult) == 0x80090016)
        {
            return new(id, aclBehaviorAccepted ? "PASS_KEY_NOT_DISCLOSED" : "INCONCLUSIVE", Error(ex));
        }
        catch (Exception ex) { return new(id, "INCONCLUSIVE", Error(ex)); }
    }
    static List<Probe> NativeOpenProbes(string actor)
    {
        List<Probe> results = new();
        OwnedKey owned;
        try
        {
            owned = LoadKey("software");
            results.Add(new(actor + ".software.load-public-record", "PASS", Stage: "load-public-record"));
        }
        catch (Exception ex)
        {
            results.Add(new(actor + ".software.load-public-record", actor == "guardian" ? "FAILED_POSITIVE_CONTROL" : "INCONCLUSIVE", Error(ex), "load-public-record"));
            foreach (var stage in new[] { "open-provider", "algorithm-support", "open-key" })
                results.Add(new(actor + ".software.native-" + stage, "NOT_TESTED_PREREQUISITE", Stage: stage));
            return results;
        }
        try { results.AddRange(NativeOpenDiagnostics.ToProbes(actor, NativeOpenDiagnostics.Inspect(owned))); }
        catch (Exception ex)
        {
            results.Add(new(actor + ".software.native-diagnostic", actor == "guardian" ? "FAILED_POSITIVE_CONTROL" : "INCONCLUSIVE", Error(ex), "pre-native-validation"));
        }
        return results;
    }
    static AclControlSet LoadAclControls(string experimentId)
    {
        var set = Read<AclControlSet>(Shared("acl-control-" + experimentId + ".json"));
        Require(set.ExperimentId == experimentId &&
            ValidAclControlKeyName(set.Restricted.Name, experimentId, "restricted") && set.Restricted.Provider == "software" && set.Restricted.PublicHash.Length == 64 &&
            ValidAclControlKeyName(set.AppReadable.Name, experimentId, "app-readable") && set.AppReadable.Provider == "software" && set.AppReadable.PublicHash.Length == 64 &&
            set.Restricted.PublicHash != set.AppReadable.PublicHash);
        return set;
    }
    static List<Probe> AclControlProbes(string actor, string experimentId)
    {
        List<Probe> results = new();
        AclControlSet set;
        try
        {
            set = LoadAclControls(experimentId);
            results.Add(new(actor + ".acl.load-control-record", "PASS", Stage: "load-control-record"));
        }
        catch (Exception ex)
        {
            results.Add(new(actor + ".acl.load-control-record", "FAILED_CONTROL", Error(ex), "load-control-record"));
            return results;
        }
        AddAclOpen(results, actor, experimentId, "restricted", set.Restricted);
        AddAclOpen(results, actor, experimentId, "app-readable", set.AppReadable);
        return results;
    }
    static void AddAclOpen(List<Probe> results, string actor, string experimentId, string label, OwnedKey owned)
    {
        NativeOpenResult native;
        try { native = AclControlNative.Inspect(owned, experimentId, label); }
        catch (Exception ex) { results.Add(new(actor + ".acl." + label + ".diagnostic", "FAILED_CONTROL", Error(ex), "pre-native-validation")); return; }
        string prefix = actor + ".acl." + label + ".";
        results.Add(new(prefix + "open-provider", native.ProviderOpen == 0 ? "PASS" : "FAILED_CONTROL",
            native.ProviderOpen == 0 ? null : NativeStatus(native.ProviderOpen), Stage: "open-provider"));
        if (native.AlgorithmSupport is null) { results.Add(new(prefix + "algorithm-support", "NOT_TESTED_PREREQUISITE")); results.Add(new(prefix + "open-key", "NOT_TESTED_PREREQUISITE")); return; }
        results.Add(new(prefix + "algorithm-support", native.AlgorithmSupport == 0 ? "PASS" : "FAILED_CONTROL",
            native.AlgorithmSupport == 0 ? null : NativeStatus(native.AlgorithmSupport.Value), Stage: "algorithm-support"));
        if (native.KeyOpen is null) { results.Add(new(prefix + "open-key", "NOT_TESTED_PREREQUISITE", Stage: "open-key")); return; }
        int status = native.KeyOpen.Value;
        string outcome = AclKeyOutcome(actor, label, status);
        results.Add(new(prefix + "open-key", outcome, status == 0 ? null : NativeStatus(status), "open-key"));
    }
    internal static string AclKeyOutcome(string actor, string label, int status)
    {
        if (actor is not ("guardian" or "app" or "child") || label is not ("restricted" or "app-readable")) throw new InvalidDataException();
        return actor == "guardian" || label == "app-readable"
            ? status == 0 ? "PASS" : "FAILED_CONTROL"
            : status == unchecked((int)0x80090016) ? "OBSERVED_BAD_KEYSET" : status == 0 ? "FAIL_RESTRICTED_OPENED" : "INCONCLUSIVE";
    }
    static string NativeStatus(int status) => "NCryptStatus:0x" + unchecked((uint)status).ToString("X8");
    static List<Probe> ChildProbes()
    {
        var plan = Read<Plan>(Path.Combine(Root, "plan.json"));
        Require(ValidPlan(plan) && plan.Action != "cleanup" && plan.BinaryHash == Hash(File.ReadAllBytes(Environment.ProcessPath!)));
        return plan.Action == "diagnose-open" ? NativeOpenProbes("child") :
            plan.Action == "acl-probe" ? AclControlProbes("child", plan.ExperimentId) : Denials("child");
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
            results.Add(KeyIsolation(actor + "." + provider + ".key-denied", plan.AclBehaviorAccepted,
                () => { using var opened = Open(key); }));
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
    static void CleanupAclControl(string experimentId, string label, List<Probe> results)
    {
        string probe = "guardian.acl." + label + ".cleanup";
        try
        {
            var intent = Read<KeyIntent>(Protected(AclRecord(experimentId, label, "intent")));
            var owned = Read<OwnedKey>(Protected(AclRecord(experimentId, label, "owned")));
            var published = LoadAclControls(experimentId);
            var expected = label == "restricted" ? published.Restricted : published.AppReadable;
            Require(intent.Provider == "software" && intent.Name == owned.Name && owned == expected &&
                ValidAclControlKeyName(owned.Name, experimentId, label));
            using var key = Open(owned);
            using var signer = new ECDsaCng(key);
            Require(Hash(signer.ExportSubjectPublicKeyInfo()) == owned.PublicHash);
            key.Delete();
            try { using var unexpected = Open(owned); results.Add(new(probe, "FAIL_STILL_OPEN")); }
            catch (CryptographicException ex) when (unchecked((uint)ex.HResult) == 0x80090016) { results.Add(new(probe, "DELETED_AND_CONFIRMED")); }
        }
        catch (Exception ex) { results.Add(new(probe, "RETAINED_OR_UNKNOWN", Error(ex))); }
    }
    static int SelfTest()
    {
        var run = Guid.NewGuid().ToString("N");
        var experiment = Guid.NewGuid().ToString("N");
        var checks = new List<bool> {
            ValidPlan(new("create", run)), ValidPlan(new("verify", run)), ValidPlan(new("cleanup", run)), ValidPlan(new("diagnose-open", run)),
            ValidPlan(new("diagnose-protection", run)), !ValidPlan(new("diagnose-protection", run, KeyExperimentAccepted: true)),
            !ValidPlan(new("diagnose-protection", run, AclBehaviorAccepted: true)),
            ValidPlan(new("acl-create", run, ExperimentId: experiment)), ValidPlan(new("acl-probe", run, ExperimentId: experiment)), ValidPlan(new("acl-cleanup", run, ExperimentId: experiment)),
            !ValidPlan(new("acl-probe", run)), !ValidPlan(new("acl-probe", run, ExperimentId: run)), !ValidPlan(new("verify", run, ExperimentId: experiment)),
            ValidPlan(new("verify", run, AclBehaviorAccepted: true)),
            ValidPlan(new("protect", run, KeyExperimentAccepted: true, AclBehaviorAccepted: true)),
            !ValidPlan(new("handoff", run, AclBehaviorAccepted: true)),
            !ValidPlan(new("acl-probe", run, ExperimentId: experiment, AclBehaviorAccepted: true)),
            !ValidPlan(new("restore", run)), !ValidPlan(new("create", "../x")),
            !IdentityAllowed("S-1-5-18", "S-1-5-80-1"), !IdentityAllowed(null, "S-1-5-80-1"),
            !IdentityAllowed("S-1-5-80-2", "S-1-5-80-1"), IdentityAllowed("S-1-5-80-1", "S-1-5-80-1"),
            IsDenied(unchecked((int)0x80090010)), IsDenied(unchecked((int)0x80070005)),
            !IsDenied(unchecked((int)0x80090016)), !IsDenied(unchecked((int)0x80090029)),
            ValidKeyName(KeyPrefix + "software." + run, "software"),
            !ValidKeyName("EntryControlSystem.License", "software"), !ValidKeyName(KeyPrefix + "tpm." + run, "software"),
            !ValidKeyName("Ecs.Lic008.TEST_ONLY.software." + run, "software"),
            !ValidKeyName("Ecs.Lic008.ProvisioningV1.TEST_ONLY.software." + run, "software"),
            ValidAclControlKeyName(AclName(experiment, "restricted"), experiment, "restricted"),
            ValidAclControlKeyName(AclName(experiment, "app-readable"), experiment, "app-readable"),
            !ValidAclControlKeyName(RetainedKeyName, experiment, "restricted"),
            !ValidAclControlKeyName(AclName(experiment, "restricted"), experiment, "app-readable"),
            SetupAllowed("S-1-5-18", 4), !SetupAllowed("S-1-5-18", null),
            !SetupAllowed("S-1-5-18", 16), !SetupAllowed("S-1-5-80-1", 4),
            !ValidPlan(new("protect",run)), ValidPlan(new("protect",run,"",true)),
            !ValidKeyName(KeyPrefix + "software." + run + ":alias", "software"),
            !ValidKeyName(KeyPrefix + "tpm." + run, "tpm"),
            !TokenEvidence.Accept(new(null, "S-1-5-80-1", false, null)),
            !TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 16)),
            !TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 0)),
            TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, 4)),
            TokenEvidence.Accept(new("S-1-5-80-1", "S-1-5-80-1", true, null)),
            AclKeyOutcome("guardian", "restricted", 0) == "PASS",
            AclKeyOutcome("app", "restricted", unchecked((int)0x80090016)) == "OBSERVED_BAD_KEYSET",
            AclKeyOutcome("child", "restricted", 0) == "FAIL_RESTRICTED_OPENED",
            AclKeyOutcome("app", "app-readable", 0) == "PASS",
            AclKeyOutcome("child", "app-readable", unchecked((int)0x80090016)) == "FAILED_CONTROL"
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
        checks.Add(KeyIsolation("legacy", false, () => throw new CryptographicException(unchecked((int)0x80090016))).Status == "INCONCLUSIVE");
        checks.Add(KeyIsolation("accepted", true, () => throw new CryptographicException(unchecked((int)0x80090016))).Status == "PASS_KEY_NOT_DISCLOSED");
        checks.Add(KeyIsolation("denied", true, () => throw new UnauthorizedAccessException()).Status == "PASS_ACCESS_DENIED");
        checks.Add(KeyIsolation("opened", true, () => { }).Status == "FAIL_ACCESS_GRANTED");
        var nativeBadKeyset = NativeOpenDiagnostics.ToProbes("app", new(0, 0, unchecked((int)0x80090016)));
        checks.Add(nativeBadKeyset.Count == 3 && nativeBadKeyset[2].Status == "INCONCLUSIVE" && nativeBadKeyset[2].Error == "NCryptStatus:0x80090016");
        var nativeGuardian = NativeOpenDiagnostics.ToProbes("guardian", new(0, 0, 0));
        checks.Add(nativeGuardian.All(x => x.Status == "PASS"));
        var nativeAppOpened = NativeOpenDiagnostics.ToProbes("app", new(0, 0, 0));
        checks.Add(nativeAppOpened[2].Status == "FAIL_ACCESS_GRANTED");
        var nativeProviderFailure = NativeOpenDiagnostics.ToProbes("child", new(unchecked((int)0x80090030), null, null));
        checks.Add(nativeProviderFailure[0].Status == "INCONCLUSIVE" && nativeProviderFailure.Skip(1).All(x => x.Status == "NOT_TESTED_PREREQUISITE"));
        bool AclAccepts(string sddl, string provider = "Microsoft Software Key Storage Provider")
        {
            try { AssertDacl(new RawSecurityDescriptor(sddl), "S-1-5-80-1", provider); return true; }
            catch (InvalidDataException) { return false; }
        }
        foreach (var mask in new[] { "GA", "0xd01f01ff" })
            checks.Add(AclAccepts($"D:P(A;;{mask};;;SY)(A;;{mask};;;S-1-5-80-1)"));
        try { AssertDaclSet(new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)(A;;GA;;;S-1-5-80-2)"),
            new[] { "S-1-5-18", "S-1-5-80-1", "S-1-5-80-2" }, CngProvider.MicrosoftSoftwareKeyStorageProvider.Provider); checks.Add(true); }
        catch (InvalidDataException) { checks.Add(false); }
        foreach (var sddl in new[] {
            "D:(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;;GR;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;;0xf01f01ff;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;;GA;;;SY)(A;;GA;;;WD)",
            "D:P(A;;GA;;;SY)(A;;GA;;;SY)",
            "D:P(D;;GA;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;ID;GA;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;OI;GA;;;SY)(A;;GA;;;S-1-5-80-1)",
            "D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)(A;;GR;;;WD)",
            "D:P(A;;GA;;;SY)" }) checks.Add(!AclAccepts(sddl));
        checks.Add(!AclAccepts("D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)", "Microsoft Platform Crypto Provider"));
        var callbackSd = new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)");
        callbackSd.DiscretionaryAcl![0] = new CommonAce(AceFlags.None, AceQualifier.AccessAllowed, 0x10000000, new SecurityIdentifier("S-1-5-18"), true, null);
        try { AssertDacl(callbackSd, "S-1-5-80-1", CngProvider.MicrosoftSoftwareKeyStorageProvider.Provider); checks.Add(false); }
        catch (InvalidDataException) { checks.Add(true); }
        Console.WriteLine($"Pure guard tests: {checks.Count(x => x)}/{checks.Count}; no services or keys touched.");
        return checks.All(x => x) ? 0 : 1;
    }
}
