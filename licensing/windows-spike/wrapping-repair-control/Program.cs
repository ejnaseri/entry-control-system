using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ecs.Lic008;

internal sealed record Probe(string Id, string Status, string? Error = null, string? Stage = null);
internal sealed record Plan(string Action, string RunId, string ExperimentId, string BinaryHash);
internal sealed record KeyRecord(string Label, string Name, string PublicHash);
internal sealed record KeyIntent(string Label, string Name);
internal sealed record ControlSet(string ExperimentId, KeyRecord Restricted, KeyRecord AppReadable);
internal sealed record Envelope(string Domain, string KeyLabel, string KeyId, string Aad, string WrappedKey,
    string Nonce, string Ciphertext, string Tag, string PlaintextHash);

internal static class Program
{
    internal const string ReportScope = "TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5";
    internal const string ProviderName = "Microsoft Software Key Storage Provider";
    internal const string Setup = "Ecs.Lic008.WrappingV5.Setup";
    internal const string Guardian = "Ecs.Lic008.WrappingV5.Guardian";
    internal const string App = "Ecs.Lic008.WrappingV5.App";
    internal const string KeyPrefix = "Ecs.Lic008.WrappingV5.TEST_ONLY.";
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ecs.Lic008.WrappingV5");
    internal static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static readonly JsonSerializerOptions StrictJson = new() { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow };
    static string guardianSid = "";
    static string appSid = "";
    static List<Probe>? stageResults;
    static string stageOwner = "";

    static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) return SelfTest();
        if (args.SequenceEqual(new[] { "--report-contract" }))
        {
            var plan = new Plan("verify", "11111111111111111111111111111111", "22222222222222222222222222222222", Hash(File.ReadAllBytes(Environment.ProcessPath!)));
            Console.WriteLine(JsonSerializer.Serialize(ServiceReport("guardian", plan, new()), Json));
            return 0;
        }
        if (args.Length != 2 || args[0] is not ("--service" or "--child") || args[1] is not ("setup" or "guardian" or "app")) return 2;
        if (args[0] == "--child" && args[1] != "app") return 2;
        try
        {
            guardianSid = ServiceSid(Guardian); appSid = ServiceSid(App);
            string expected = args[1] == "setup" ? "S-1-5-18" : args[1] == "guardian" ? guardianSid : appSid;
            if (args[1] == "setup")
            {
                var token = TokenEvidence.Capture(ServiceSid(Setup));
                if (!SetupAllowed(token.UserSid, token.ServiceGroupAttributes)) return 3;
            }
            else if (!IdentityAllowed(WindowsIdentity.GetCurrent().User?.Value, expected) || !TokenEvidence.Allowed(expected)) return 3;
            if (args[0] == "--child")
            {
                var results = ProbeApp("child");
                results.Add(new("child.token-identity", "PASS", Stage: expected));
                Console.WriteLine(JsonSerializer.Serialize(results, Json));
                return 0;
            }
            ServiceHost.Run(args[1] == "setup" ? Setup : args[1] == "guardian" ? Guardian : App, () => Execute(args[1]));
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(Error(ex)); return 1; }
    }

    internal static bool SetupAllowed(string? user, uint? attributes) => user == "S-1-5-18" && attributes is not null && (attributes.Value & 4) != 0 && (attributes.Value & 16) == 0;
    internal static bool IdentityAllowed(string? actual, string expected) => actual == expected && expected.StartsWith("S-1-5-80-", StringComparison.Ordinal);
    internal static bool ValidKeyName(string name, string label, string experimentId) =>
        label is "restricted" or "app-readable" && Guid.TryParseExact(experimentId, "N", out _) && name == KeyPrefix + label + "." + experimentId;
    internal static bool ValidPlan(Plan plan) => plan.Action is "create" or "verify" or "probe" or "cleanup" &&
        Guid.TryParseExact(plan.RunId, "N", out _) && Guid.TryParseExact(plan.ExperimentId, "N", out _) &&
        plan.RunId != plan.ExperimentId && plan.BinaryHash.Length == 64;
    internal static string Error(Exception ex) => ex.GetType().Name + ":0x" + unchecked((uint)ex.HResult).ToString("X8");
    internal static T Stage<T>(string name, Func<T> action)
    {
        try { T value = action(); stageResults?.Add(new(stageOwner + ".stage." + name, "PASS", Stage: name)); return value; }
        catch (Exception ex) { if (!ex.Data.Contains("probeStage")) ex.Data["probeStage"] = name; throw; }
    }

    static void Execute(string role)
    {
        var plan = Read<Plan>(Path.Combine(Root, "plan.json"));
        Require(ValidPlan(plan) && plan.BinaryHash == Hash(File.ReadAllBytes(Environment.ProcessPath!)));
        Require(role == "setup" ? plan.Action is "create" or "cleanup" : role == "guardian" ? plan.Action == "verify" : plan.Action == "probe");
        List<Probe> results = new();
        if (plan.Action == "create") Create(plan, results);
        else if (plan.Action == "verify") Verify(plan, results);
        else if (plan.Action == "probe")
        {
            results.AddRange(ProbeApp("app"));
            Test(results, "app.child-probe-execution", () =>
            {
                using var child = Process.Start(new ProcessStartInfo(Environment.ProcessPath!)
                {
                    ArgumentList = { "--child", "app" }, UseShellExecute = false, RedirectStandardOutput = true,
                    RedirectStandardError = true, CreateNoWindow = true
                }) ?? throw new InvalidOperationException();
                var stdout = child.StandardOutput.ReadToEndAsync(); var stderr = child.StandardError.ReadToEndAsync();
                if (!child.WaitForExit(30000)) { child.Kill(true); throw new TimeoutException(); }
                _ = stderr.GetAwaiter().GetResult(); Require(child.ExitCode == 0);
                results.AddRange(JsonSerializer.Deserialize<List<Probe>>(stdout.GetAwaiter().GetResult(), StrictJson) ?? throw new InvalidDataException());
            });
        }
        else Cleanup(plan, results);
        WriteNew(Path.Combine(Root, role + "-reports", plan.RunId + ".json"), ServiceReport(role, plan, results));
    }

    static object ServiceReport(string role, Plan plan, List<Probe> results) => new
        {
            schemaVersion = 1, checklistId = "LIC-6.2-008", scope = ReportScope,
            role, action = plan.Action, plan.RunId, plan.ExperimentId, runtime = Environment.Version.ToString(),
            serviceIdentityMatched = true, binarySha256 = Hash(File.ReadAllBytes(Environment.ProcessPath!)),
            osVersion = Environment.OSVersion.Version.ToString(), processId = Environment.ProcessId,
            timeUtc = DateTime.UtcNow, results,
            productionAccepted = false, securityAccepted = false,
            repairProofRequiresController = true,
            notTested = new[] { "ORDINARY_INTERACTIVE_USER", "NORMAL_REBOOT", "UPGRADE", "UNINSTALL_REINSTALL", "POWER_LOSS", "TPM_PATH", "WINDOWS_MATRIX", "PRODUCTION_STORE" }
        };

    static void Create(Plan plan, List<Probe> results)
    {
        CreateKey(plan, "restricted", false, results);
        CreateKey(plan, "app-readable", true, results);
        Test(results, "setup.publish-control-set", () =>
        {
            var restricted = Read<KeyRecord>(Protected("restricted-owned.json"));
            var readable = Read<KeyRecord>(Protected("app-readable-owned.json"));
            Require(restricted.PublicHash != readable.PublicHash);
            WriteNew(Shared("control-set.json"), new ControlSet(plan.ExperimentId, restricted, readable));
        });
    }

    static void CreateKey(Plan plan, string label, bool appReadable, List<Probe> results)
    {
        Test(results, "setup." + label + ".create-rsa-wrapping-key", () =>
        {
            string name = KeyPrefix + label + "." + plan.ExperimentId;
            WriteNew(Protected(label + "-intent.json"), new KeyIntent(label, name));
            using var key = WrappingNative.Create(name, label, plan.ExperimentId, guardianSid, appSid, appReadable);
            using var rsa = new RSACng(key);
            var record = new KeyRecord(label, name, Hash(rsa.ExportSubjectPublicKeyInfo()));
            AssertKey(key, record, appReadable);
            WriteNew(Protected(label + "-owned.json"), record);
            var envelope = Seal(rsa, record, label, plan.ExperimentId, value => WrappingNative.EncryptOaepSha256(key, value));
            WriteNew(Shared(label + "-envelope.json"), envelope);
            if (appReadable) WriteNew(Shared(label + "-hash.json"), new { envelope.PlaintextHash });
            else WriteNew(Protected(label + "-hash.json"), new { envelope.PlaintextHash });
        });
    }

    static void Verify(Plan plan, List<Probe> results)
    {
        foreach (string label in new[] { "restricted", "app-readable" })
        {
            Test(results, "guardian." + label + ".reopen-policy-decrypt", () =>
            {
                var record = LoadRecord(label, plan.ExperimentId); using var key = Open(record);
                AssertKey(key, record, label == "app-readable"); using var rsa = new RSACng(key);
                var envelope = Read<Envelope>(Shared(label + "-envelope.json")); OpenEnvelope(rsa, record, envelope, value => WrappingNative.DecryptOaepSha256(key, value));
            });
            Test(results, "guardian." + label + ".private-export-denied", () => AssertPrivateExportsDenied(Open(LoadRecord(label, plan.ExperimentId))));
        }
        Test(results, "guardian.envelope-negative-matrix", () =>
        {
            var restricted = LoadRecord("restricted", plan.ExperimentId);
            var readable = LoadRecord("app-readable", plan.ExperimentId);
            using var restrictedKey = Open(restricted); using var restrictedRsa = new RSACng(restrictedKey);
            using var readableKey = Open(readable); using var readableRsa = new RSACng(readableKey);
            var envelope = Read<Envelope>(Shared("restricted-envelope.json"));
            ExpectCryptoReject(() => OpenEnvelope(readableRsa, restricted, envelope, value => WrappingNative.DecryptOaepSha256(readableKey, value)));
            ExpectCryptoReject(() => OpenEnvelope(restrictedRsa, restricted, envelope with { WrappedKey = Corrupt(envelope.WrappedKey) }, value => WrappingNative.DecryptOaepSha256(restrictedKey, value)));
            ExpectCryptoReject(() => OpenEnvelope(restrictedRsa, restricted, envelope with { Nonce = Corrupt(envelope.Nonce) }, value => WrappingNative.DecryptOaepSha256(restrictedKey, value)));
            ExpectCryptoReject(() => OpenEnvelope(restrictedRsa, restricted, envelope with { Aad = Corrupt(envelope.Aad) }, value => WrappingNative.DecryptOaepSha256(restrictedKey, value)));
            ExpectCryptoReject(() => OpenEnvelope(restrictedRsa, restricted, envelope with { Ciphertext = Corrupt(envelope.Ciphertext) }, value => WrappingNative.DecryptOaepSha256(restrictedKey, value)));
            ExpectCryptoReject(() => OpenEnvelope(restrictedRsa, restricted, envelope with { Tag = Corrupt(envelope.Tag) }, value => WrappingNative.DecryptOaepSha256(restrictedKey, value)));
        });
    }

    static List<Probe> ProbeApp(string actor)
    {
        var plan = Read<Plan>(Path.Combine(Root, "plan.json")); Require(ValidPlan(plan) && plan.Action == "probe");
        var set = Read<ControlSet>(Shared("control-set.json")); Require(set.ExperimentId == plan.ExperimentId);
        List<Probe> results = new();
        int restricted = WrappingNative.OpenStatus(set.Restricted.Name);
        results.Add(new(actor + ".restricted.open", restricted == unchecked((int)0x80090016) ? "OBSERVED_BAD_KEYSET" : restricted is 5 or unchecked((int)0x80070005) ? "PASS_ACCESS_DENIED" : restricted == 0 ? "FAIL_ACCESS_GRANTED" : "INCONCLUSIVE", restricted == 0 ? null : NativeStatus(restricted)));
        Test(results, actor + ".app-readable.open-decrypt-control", () =>
        {
            using var key = Open(set.AppReadable); using var rsa = new RSACng(key);
            OpenEnvelope(rsa, set.AppReadable, Read<Envelope>(Shared("app-readable-envelope.json")), value => WrappingNative.DecryptOaepSha256(key, value));
        });
        return results;
    }

    static void Cleanup(Plan plan, List<Probe> results)
    {
        foreach (string label in new[] { "restricted", "app-readable" })
        {
            Test(results, "setup." + label + ".delete-owned-key", () =>
            {
                var intent = Read<KeyIntent>(Protected(label + "-intent.json"));
                var record = LoadRecord(label, plan.ExperimentId);
                Require(intent.Label == label && intent.Name == record.Name);
                using var key = Open(record); using var rsa = new RSACng(key);
                Require(Hash(rsa.ExportSubjectPublicKeyInfo()) == record.PublicHash); key.Delete();
                int status = WrappingNative.OpenStatus(record.Name); Require(status == unchecked((int)0x80090016));
            });
        }
    }

    static Envelope Seal(RSA rsa, KeyRecord record, string label, string experimentId, Func<byte[], byte[]>? wrap = null)
    {
        byte[] dataKey = RandomNumberGenerator.GetBytes(32), nonce = RandomNumberGenerator.GetBytes(12), plaintext = RandomNumberGenerator.GetBytes(64);
        byte[] ciphertext = new byte[plaintext.Length], tag = new byte[16];
        byte[] aad = Encoding.UTF8.GetBytes("ENTRY_CONTROL_SYSTEM:LIC008:WRAPPING_V1:" + label + ":" + experimentId + ":" + record.PublicHash);
        try
        {
            using (var aes = new AesGcm(dataKey, 16)) aes.Encrypt(nonce, plaintext, ciphertext, tag, aad);
            byte[] wrapped = wrap is null ? rsa.Encrypt(dataKey, RSAEncryptionPadding.OaepSHA256) : wrap(dataKey);
            return new("ENTRY_CONTROL_SYSTEM:LIC008:WRAPPING_V1", label, record.PublicHash,
                Convert.ToBase64String(aad), Convert.ToBase64String(wrapped), Convert.ToBase64String(nonce),
                Convert.ToBase64String(ciphertext), Convert.ToBase64String(tag), Hash(plaintext));
        }
        finally { CryptographicOperations.ZeroMemory(dataKey); CryptographicOperations.ZeroMemory(plaintext); }
    }

    static void OpenEnvelope(RSA rsa, KeyRecord record, Envelope envelope, Func<byte[], byte[]>? unwrap = null)
    {
        Require(envelope.Domain == "ENTRY_CONTROL_SYSTEM:LIC008:WRAPPING_V1" && envelope.KeyLabel == record.Label && envelope.KeyId == record.PublicHash);
        byte[] wrapped = Convert.FromBase64String(envelope.WrappedKey), nonce = Convert.FromBase64String(envelope.Nonce),
            ciphertext = Convert.FromBase64String(envelope.Ciphertext), tag = Convert.FromBase64String(envelope.Tag), aad = Convert.FromBase64String(envelope.Aad);
        Require(nonce.Length == 12 && tag.Length == 16 && ciphertext.Length == 64 && wrapped.Length == 384);
        byte[] dataKey = unwrap is null ? rsa.Decrypt(wrapped, RSAEncryptionPadding.OaepSHA256) : unwrap(wrapped), plaintext = new byte[ciphertext.Length];
        try
        {
            Require(dataKey.Length == 32); using (var aes = new AesGcm(dataKey, 16)) aes.Decrypt(nonce, ciphertext, tag, plaintext, aad);
            Require(Hash(plaintext) == envelope.PlaintextHash);
        }
        finally { CryptographicOperations.ZeroMemory(dataKey); CryptographicOperations.ZeroMemory(plaintext); }
    }

    static void AssertKey(CngKey key, KeyRecord record, bool appReadable)
    {
        Require(key.Provider?.Provider == ProviderName && key.Algorithm == CngAlgorithm.Rsa && key.KeySize == 3072 && key.IsMachineKey && key.ExportPolicy == CngExportPolicies.None && key.KeyUsage == CngKeyUsages.Decryption);
        using var rsa = new RSACng(key); Require(Hash(rsa.ExportSubjectPublicKeyInfo()) == record.PublicHash);
        var descriptor = new RawSecurityDescriptor(key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue() ?? throw new InvalidDataException(), 0);
        AssertDacl(descriptor, appReadable ? new[] { "S-1-5-18", guardianSid, appSid } : new[] { "S-1-5-18", guardianSid });
    }

    internal static void AssertDacl(RawSecurityDescriptor descriptor, string[] expected)
    {
        Require((descriptor.ControlFlags & ControlFlags.DiscretionaryAclProtected) != 0 && descriptor.DiscretionaryAcl is not null && descriptor.DiscretionaryAcl.Count == expected.Length);
        HashSet<string> actual = new(StringComparer.Ordinal);
        foreach (GenericAce ace in descriptor.DiscretionaryAcl!)
        {
            Require(ace is CommonAce { AceQualifier: AceQualifier.AccessAllowed, IsCallback: false, AceFlags: AceFlags.None });
            var common = (CommonAce)ace; Require(unchecked((uint)common.AccessMask) is 0x10000000u or 0xD01F01FFu); Require(actual.Add(common.SecurityIdentifier.Value));
        }
        Require(actual.SetEquals(expected));
    }

    static void AssertPrivateExportsDenied(CngKey key)
    {
        using (key)
        {
            foreach (var format in new[] { CngKeyBlobFormat.GenericPrivateBlob, CngKeyBlobFormat.Pkcs8PrivateBlob, CngKeyBlobFormat.OpaqueTransportBlob })
            {
                try { byte[] leaked = key.Export(format); CryptographicOperations.ZeroMemory(leaked); throw new InvalidDataException("Private export succeeded"); }
                catch (CryptographicException) { }
            }
        }
    }

    static KeyRecord LoadRecord(string label, string experimentId)
    {
        var record = Read<KeyRecord>(Protected(label + "-owned.json"));
        Require(record.Label == label && ValidKeyName(record.Name, label, experimentId) && record.PublicHash.Length == 64); return record;
    }
    static CngKey Open(KeyRecord record) => CngKey.Open(record.Name, CngProvider.MicrosoftSoftwareKeyStorageProvider, CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
    static string ServiceSid(string name) => ((SecurityIdentifier)new NTAccount("NT SERVICE", name).Translate(typeof(SecurityIdentifier))).Value;
    static string Protected(string name) => Path.Combine(Root, "protected", name);
    static string Shared(string name) => Path.Combine(Root, "shared", name);
    static string Hash(byte[] value) => Convert.ToHexStringLower(SHA256.HashData(value));
    static string NativeStatus(int status) => "NCryptStatus:0x" + unchecked((uint)status).ToString("X8");
    static void Require(bool condition) { if (!condition) throw new InvalidDataException(); }
    static T Read<T>(string path)
    {
        Plain(path); using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length is < 1 or > 262144) throw new InvalidDataException();
        return JsonSerializer.Deserialize<T>(stream, StrictJson) ?? throw new InvalidDataException();
    }
    static void WriteNew(string path, object value)
    {
        Plain(path); using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        JsonSerializer.Serialize(stream, value, Json); stream.Flush(true);
    }
    static void Plain(string path)
    {
        for (string? cursor = Path.GetFullPath(path); cursor is not null; cursor = Path.GetDirectoryName(cursor))
            if ((File.Exists(cursor) || Directory.Exists(cursor)) && (File.GetAttributes(cursor) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Linked path refused");
    }
    static void Test(List<Probe> results, string id, Action action)
    {
        stageResults = results; stageOwner = id;
        try { action(); results.Add(new(id, "PASS")); }
        catch (Exception ex) { results.Add(new(id, "FAILED_OR_UNAVAILABLE", Error(ex), ex.Data["probeStage"] as string)); }
        finally { stageResults = null; stageOwner = ""; }
    }

    static int SelfTest()
    {
        List<Action> tests = new(); string experiment = Guid.NewGuid().ToString("N"), run = Guid.NewGuid().ToString("N");
        tests.Add(() => Require(ValidPlan(new("create", run, experiment, new string('a', 64)))));
        tests.Add(() => Require(!ValidPlan(new("create", experiment, experiment, new string('a', 64)))));
        tests.Add(() => Require(ValidKeyName(KeyPrefix + "restricted." + experiment, "restricted", experiment)));
        tests.Add(() => Require(!ValidKeyName(KeyPrefix + "app-readable." + experiment, "restricted", experiment)));
        tests.Add(() => AssertDacl(new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)"), new[] { "S-1-5-18", "S-1-5-80-1" }));
        tests.Add(() => AssertDacl(new RawSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)(A;;GA;;;S-1-5-80-2)"), new[] { "S-1-5-18", "S-1-5-80-1", "S-1-5-80-2" }));
        tests.Add(() => { try { AssertDacl(new RawSecurityDescriptor("D:(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1)"), new[] { "S-1-5-18", "S-1-5-80-1" }); throw new Exception(); } catch (InvalidDataException) { } });
        tests.Add(() => Require(SetupAllowed("S-1-5-18", 4) && !SetupAllowed("S-1-5-18", 20)));
        tests.Add(() => Require(IdentityAllowed("S-1-5-80-1", "S-1-5-80-1") && !IdentityAllowed("S-1-5-18", "S-1-5-80-1")));
        tests.Add(PureEnvelopeRoundTrip);
        tests.Add(PureEnvelopeTamper);
        int passed = 0; foreach (var test in tests) { try { test(); passed++; } catch { } }
        Console.WriteLine($"Pure guards: {passed}/{tests.Count}"); return passed == tests.Count ? 0 : 1;
    }
    static void PureEnvelopeRoundTrip()
    {
        using RSA rsa = RSA.Create(3072); var record = new KeyRecord("restricted", "test", Hash(rsa.ExportSubjectPublicKeyInfo()));
        var envelope = Seal(rsa, record, "restricted", Guid.NewGuid().ToString("N")); OpenEnvelope(rsa, record, envelope);
    }
    static void PureEnvelopeTamper()
    {
        using RSA rsa = RSA.Create(3072); using RSA wrong = RSA.Create(3072);
        var record = new KeyRecord("restricted", "test", Hash(rsa.ExportSubjectPublicKeyInfo()));
        var envelope = Seal(rsa, record, "restricted", Guid.NewGuid().ToString("N"));
        ExpectCryptoReject(() => OpenEnvelope(wrong, record, envelope));
        ExpectCryptoReject(() => OpenEnvelope(rsa, record, envelope with { WrappedKey = Corrupt(envelope.WrappedKey) }));
        ExpectCryptoReject(() => OpenEnvelope(rsa, record, envelope with { Nonce = Corrupt(envelope.Nonce) }));
        ExpectCryptoReject(() => OpenEnvelope(rsa, record, envelope with { Aad = Corrupt(envelope.Aad) }));
        ExpectCryptoReject(() => OpenEnvelope(rsa, record, envelope with { Ciphertext = Corrupt(envelope.Ciphertext) }));
        ExpectCryptoReject(() => OpenEnvelope(rsa, record, envelope with { Tag = Corrupt(envelope.Tag) }));
    }
    static string Corrupt(string encoded) { byte[] value = Convert.FromBase64String(encoded); value[0] ^= 1; return Convert.ToBase64String(value); }
    static void ExpectCryptoReject(Action action) { try { action(); throw new InvalidDataException("Corruption accepted"); } catch (CryptographicException) { } }
}
