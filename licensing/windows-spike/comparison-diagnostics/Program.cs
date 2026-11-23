using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;
namespace Ecs.Lic008;

// Single retained test key only. No creation, property setting, signing, private
// export, deletion, file enumeration or production key operation.
internal static class Program
{
    const string Service = "Ecs.Lic008.ComparisonV1.Metadata";
    const string Root = @"C:\ProgramData\Ecs.Lic008.ComparisonV1";
    const string KeyName = "Ecs.Lic008.ComparisonV1.TEST_ONLY.software.0d26c5c6d100431b88f6bbf5ecb31956";
    record Owned(string Provider, string Name, string PublicHash);
    static void Require(bool value) { if (!value) throw new InvalidDataException(); }
    static void Plain(string path)
    {
        for (string? p = Path.GetFullPath(path); p != null; p = Path.GetDirectoryName(p))
            if ((File.Exists(p) || Directory.Exists(p)) && (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException();
    }
    static void Main(string[] args)
    {
        Require(args.Length == 0 && WindowsIdentity.GetCurrent().User?.Value == "S-1-5-18");
        ServiceHost.Run(Service, Inspect);
    }
    static void Inspect()
    {
        object result;
        try
        {
            var path = Path.Combine(Root, "protected", "software-owned.json"); Plain(path);
            using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            Require(input.Length is > 0 and < 4096);
            var owned = JsonSerializer.Deserialize<Owned>(input) ?? throw new InvalidDataException();
            Require(owned.Name == KeyName && owned.Provider == "software" && owned.PublicHash.Length == 64);
            using var key = CngKey.Open(KeyName, CngProvider.MicrosoftSoftwareKeyStorageProvider, CngKeyOpenOptions.MachineKey | CngKeyOpenOptions.Silent);
            using var publicKey = new ECDsaCng(key);
            Require(Convert.ToHexStringLower(SHA256.HashData(publicKey.ExportSubjectPublicKeyInfo())) == owned.PublicHash);
            var raw = key.GetProperty("Security Descr", (CngPropertyOptions)4).GetValue() ?? throw new InvalidDataException();
            var sd = new RawSecurityDescriptor(raw, 0);
            var aces = new List<object>();
            foreach (GenericAce ace in sd.DiscretionaryAcl ?? throw new InvalidDataException())
            {
                Require(ace is CommonAce);
                var common = (CommonAce)ace;
                aces.Add(new { sid = common.SecurityIdentifier.Value, mask = "0x" + unchecked((uint)common.AccessMask).ToString("X8"),
                    type = ace.AceType.ToString(), flags = ace.AceFlags.ToString(), callback = common.IsCallback });
            }
            var guardian = ((SecurityIdentifier)new NTAccount("NT SERVICE", "Ecs.Lic008.ComparisonV1.Guardian").Translate(typeof(SecurityIdentifier))).Value;
            result = new { status = "METADATA_READ", publicIdentityMatched = true, guardianSid = guardian,
                key.IsMachineKey, algorithm = key.Algorithm.Algorithm, exportPolicy = key.ExportPolicy.ToString(), usage = key.KeyUsage.ToString(),
                sddl = sd.GetSddlForm(AccessControlSections.Access), controlFlags = sd.ControlFlags.ToString(), aces };
        }
        catch (Exception ex) { result = new { status = "FAILED", error = ex.GetType().Name + ":0x" + unchecked((uint)ex.HResult).ToString("X8") }; }
        var report = Path.Combine(Root, "setup-reports", "metadata-" + Guid.NewGuid().ToString("N") + ".json"); Plain(report);
        using var output = new FileStream(report, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        JsonSerializer.Serialize(output, new { scope = "TEST_ONLY_OWNED_KEY_METADATA", keyName = KeyName, timeUtc = DateTime.UtcNow,
            binarySha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(Environment.ProcessPath!))), result }, new JsonSerializerOptions { WriteIndented = true });
        output.Flush(true);
    }
}
