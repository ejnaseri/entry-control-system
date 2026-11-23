using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace Ecs.Lic008;

internal sealed record Probe(string Id, string Status, string? Error = null, string? Stage = null);
internal sealed record Plan(string Action, string RunId, string BinaryHash, string OwnerSid);
internal sealed record IdentityEvidence(string? UserSid, string ExpectedServiceSid, uint? ServiceSidAttributes);

internal static class Program
{
    internal const string Owner = "Ecs.Lic008.ProfileV1.Owner";
    internal const string Peer = "Ecs.Lic008.ProfileV1.Peer";
    internal const string LocalServiceSid = "S-1-5-19";
    static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Ecs.Lic008.ProfileV1");
    static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    static int Main(string[] args)
    {
        if (args.SequenceEqual(new[] { "--self-test" })) return SelfTest();
        if (args.Length != 2 || args[0] != "--service" || args[1] is not ("owner" or "peer")) return 2;
        try
        {
            string serviceName = args[1] == "owner" ? Owner : Peer;
            string serviceSid = Sid(serviceName);
            var token = Capture(serviceSid);
            if (!IdentityAllowed(token.UserSid, token.ExpectedServiceSid, token.ServiceSidAttributes)) return 3;
            ServiceHost.Run(serviceName, () => Execute(args[1], serviceSid, token));
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(Error(ex)); return 1; }
    }

    static void Execute(string role, string serviceSid, IdentityEvidence token)
    {
        var plan = Read<Plan>(Path.Combine(Root, "plan.json"));
        Require(ValidPlan(plan) && plan.BinaryHash == Hash(File.ReadAllBytes(Environment.ProcessPath!)));
        Require(plan.OwnerSid == Sid(Owner));
        Require((role == "owner" && plan.Action is "protect" or "verify") || (role == "peer" && plan.Action == "probe"));
        var results = new List<Probe>();
        ObserveProfile(results, role);
        if (plan.Action == "protect") Protect(results, plan.OwnerSid);
        else if (plan.Action == "verify") Verify(results);
        else ProbePeer(results);
        WriteNew(Path.Combine(Root, role + "-reports", plan.RunId + ".json"), new
        {
            schemaVersion = 1, checklistId = "LIC-6.2-008", scope = "TEST_ONLY_PROFILE_BACKED_CONTROL_V1",
            role, action = plan.Action, runId = plan.RunId, serviceSid, token,
            binarySha256 = Hash(File.ReadAllBytes(Environment.ProcessPath!)),
            osVersion = Environment.OSVersion.Version.ToString(), timeUtc = DateTime.UtcNow, results,
            productionAccepted = false,
            notTested = new[] { "PRODUCTION_GUARDIAN_IDENTITY", "DEDICATED_LOCAL_ACCOUNT", "DOMAIN_GMSA", "LOCAL_MACHINE", "TPM", "REBOOT", "REPAIR_REINSTALL", "WINDOWS_MATRIX" }
        });
    }

    static void Protect(List<Probe> results, string ownerSid)
    {
        ProtectOne(results, "local-user", "LOCAL=user", "local-user.bin", "local-user.sha256");
        ProtectOne(results, "exact-service-sid", "SID=" + ownerSid, "exact-service-sid.bin", "exact-service-sid.sha256");
    }

    static void ProtectOne(List<Probe> results, string id, string descriptor, string blobName, string hashName)
    {
        byte[] secret = RandomNumberGenerator.GetBytes(32);
        byte[]? blob = null;
        byte[]? decoded = null;
        try
        {
            blob = NativeProtection.Protect(descriptor, secret);
            decoded = NativeProtection.Unprotect(blob);
            Require(CryptographicOperations.FixedTimeEquals(secret, decoded));
            BytesNew(Path.Combine(Root, "shared", blobName), blob);
            BytesNew(Path.Combine(Root, "owner-protected", hashName), Encoding.ASCII.GetBytes(Hash(secret)));
            results.Add(new("owner.protection." + id, "PASS_MEMORY_AND_PERSISTED_TEST_BLOB"));
        }
        catch (Exception ex) { results.Add(new("owner.protection." + id, "FAILED_OR_UNAVAILABLE", Error(ex), ex.Data["probeStage"] as string)); }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            if (blob is not null) CryptographicOperations.ZeroMemory(blob);
            if (decoded is not null) CryptographicOperations.ZeroMemory(decoded);
        }
    }

    static void Verify(List<Probe> results)
    {
        VerifyOne(results, "local-user", "local-user.bin", "local-user.sha256");
        VerifyOne(results, "exact-service-sid", "exact-service-sid.bin", "exact-service-sid.sha256");
    }

    static void VerifyOne(List<Probe> results, string id, string blobName, string hashName)
    {
        byte[]? blob = null;
        byte[]? secret = null;
        try
        {
            blob = File.ReadAllBytes(Path.Combine(Root, "shared", blobName));
            secret = NativeProtection.Unprotect(blob);
            Require(Hash(secret) == File.ReadAllText(Path.Combine(Root, "owner-protected", hashName)));
            results.Add(new("owner.restart." + id, "PASS"));
        }
        catch (Exception ex) { results.Add(new("owner.restart." + id, "FAILED_OR_UNAVAILABLE", Error(ex), ex.Data["probeStage"] as string)); }
        finally
        {
            if (blob is not null) CryptographicOperations.ZeroMemory(blob);
            if (secret is not null) CryptographicOperations.ZeroMemory(secret);
        }
    }

    static void ProbePeer(List<Probe> results)
    {
        results.Add(PeerOpen("local-user", "local-user.bin", expectOpen: true));
        results.Add(PeerOpen("exact-service-sid", "exact-service-sid.bin", expectOpen: false));
    }

    static Probe PeerOpen(string id, string blobName, bool expectOpen)
    {
        byte[]? blob = null;
        byte[]? secret = null;
        bool blobRead = false;
        try
        {
            blob = File.ReadAllBytes(Path.Combine(Root, "shared", blobName));
            blobRead = true;
            secret = NativeProtection.Unprotect(blob);
            return new("peer.protection." + id, expectOpen ? "PASS_SHARED_ACCOUNT_CONTROL_OPENED" : "FAIL_EXACT_SID_OPENED");
        }
        catch (Exception ex)
        {
            string status = PeerOutcome(expectOpen, blobRead);
            return new("peer.protection." + id, status, Error(ex), ex.Data["probeStage"] as string);
        }
        finally
        {
            if (blob is not null) CryptographicOperations.ZeroMemory(blob);
            if (secret is not null) CryptographicOperations.ZeroMemory(secret);
        }
    }

    static void ObserveProfile(List<Probe> results, string role)
    {
        string prefix = role + ".profile.";
        results.Add(new(prefix + "environment", "OBSERVED", Stage: Environment.GetEnvironmentVariable("USERPROFILE")));
        results.Add(new(prefix + "special-folder", "OBSERVED", Stage: Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)));
        try
        {
            using var hive = Registry.Users.OpenSubKey(LocalServiceSid, false);
            results.Add(new(prefix + "hku-local-service", "OBSERVED", Stage: hive is null ? "false" : "true"));
        }
        catch (Exception ex) { results.Add(new(prefix + "hku-local-service", "UNAVAILABLE", Error(ex))); }
    }

    internal static bool ValidPlan(Plan plan) =>
        plan.Action is "protect" or "probe" or "verify" && Guid.TryParseExact(plan.RunId, "N", out _) &&
        plan.BinaryHash.Length == 64 && plan.BinaryHash.All(Uri.IsHexDigit) &&
        plan.OwnerSid.StartsWith("S-1-5-80-", StringComparison.Ordinal);

    internal static bool IdentityAllowed(string? userSid, string expectedServiceSid, uint? attributes) =>
        userSid == LocalServiceSid && expectedServiceSid.StartsWith("S-1-5-80-", StringComparison.Ordinal) &&
        attributes is not null && (attributes.Value & 4) != 0 && (attributes.Value & 16) == 0;

    static IdentityEvidence Capture(string expectedServiceSid)
    {
        using var identity = WindowsIdentity.GetCurrent();
        GetTokenInformation(identity.AccessToken, 2, IntPtr.Zero, 0, out int length);
        if (length is < 4 or > 1048576) throw new InvalidDataException();
        IntPtr buffer = Marshal.AllocHGlobal(length);
        try
        {
            if (!GetTokenInformation(identity.AccessToken, 2, buffer, length, out _)) throw new Win32Exception();
            int count = Marshal.ReadInt32(buffer), offset = IntPtr.Size == 8 ? 8 : 4, stride = Marshal.SizeOf<SidAndAttributes>();
            if (count < 0 || count > (length - offset) / stride) throw new InvalidDataException();
            uint? attrs = null;
            for (int i = 0; i < count; i++)
            {
                var entry = Marshal.PtrToStructure<SidAndAttributes>(buffer + offset + i * stride);
                if (new SecurityIdentifier(entry.Sid).Value == expectedServiceSid) attrs = entry.Attributes;
            }
            return new(identity.User?.Value, expectedServiceSid, attrs);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    static string Sid(string serviceName) => ((SecurityIdentifier)new NTAccount("NT SERVICE", serviceName).Translate(typeof(SecurityIdentifier))).Value;
    static string Hash(byte[] data) => Convert.ToHexStringLower(SHA256.HashData(data));
    static string Error(Exception ex) => ex.GetType().Name + ":0x" + unchecked((uint)ex.HResult).ToString("X8");
    static void Require(bool value) { if (!value) throw new InvalidDataException(); }
    internal static T Stage<T>(string name, Func<T> action)
    {
        try { return action(); }
        catch (Exception ex) { if (!ex.Data.Contains("probeStage")) ex.Data["probeStage"] = name; throw; }
    }
    static T Read<T>(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length is < 1 or > 65536) throw new InvalidDataException();
        return JsonSerializer.Deserialize<T>(stream, new JsonSerializerOptions { UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow }) ?? throw new InvalidDataException();
    }
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

    static int SelfTest()
    {
        string run = Guid.NewGuid().ToString("N"), hash = new('a', 64), sid = "S-1-5-80-1";
        var checks = new[]
        {
            ValidPlan(new("protect", run, hash, sid)), ValidPlan(new("probe", run, hash, sid)), ValidPlan(new("verify", run, hash, sid)),
            !ValidPlan(new("delete", run, hash, sid)), !ValidPlan(new("protect", "../x", hash, sid)),
            !ValidPlan(new("protect", run, "abc", sid)), !ValidPlan(new("protect", run, hash, LocalServiceSid)),
            IdentityAllowed(LocalServiceSid, sid, 4), !IdentityAllowed("S-1-5-18", sid, 4),
            !IdentityAllowed(LocalServiceSid, sid, null), !IdentityAllowed(LocalServiceSid, sid, 16),
            !IdentityAllowed(LocalServiceSid, LocalServiceSid, 4),
            PeerOutcome(false, true) == "OBSERVED_EXACT_SID_REFUSAL",
            PeerOutcome(false, false) == "FAILED_BLOB_PREREQUISITE"
        };
        Console.WriteLine($"Pure profile-control guards: {checks.Count(x => x)}/{checks.Length}; no service, profile or DPAPI operation.");
        return checks.All(x => x) ? 0 : 1;
    }

    internal static string PeerOutcome(bool expectOpen, bool blobRead) =>
        expectOpen ? "FAILED_SHARED_ACCOUNT_CONTROL" : blobRead ? "OBSERVED_EXACT_SID_REFUSAL" : "FAILED_BLOB_PREREQUISITE";

    [StructLayout(LayoutKind.Sequential)] struct SidAndAttributes { public IntPtr Sid; public uint Attributes; }
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetTokenInformation(SafeAccessTokenHandle token, int informationClass, IntPtr information, int length, out int needed);
}
