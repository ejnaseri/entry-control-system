using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using Microsoft.Win32;

namespace Ecs.Lic008;

internal static class ProtectionDiagnostics
{
    public static List<Probe> Collect(string expectedSid)
    {
        var results = new List<Probe>();
        using var identity = WindowsIdentity.GetCurrent();
        Observe(results, "current-user", identity.User?.Value);
        Observe(results, "account", Safe(() => identity.Name));
        Observe(results, "authentication-type", identity.AuthenticationType);
        Observe(results, "impersonation-level", identity.ImpersonationLevel.ToString());
        Observe(results, "environment-user-profile", Environment.GetEnvironmentVariable("USERPROFILE"));
        Observe(results, "special-folder-user-profile", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
        results.Add(HkuProfile(expectedSid));
        results.Add(ProfileDirectory(identity, expectedSid));
        results.Add(ProfileType());
        results.Add(Protect("local-user", "LOCAL=user"));
        results.Add(Protect("guardian-sid", "SID=" + expectedSid));
        return results;
    }

    static string? Safe(Func<string?> action)
    {
        try { return action(); }
        catch { return null; }
    }

    static void Observe(List<Probe> results, string id, string? value) =>
        results.Add(new("guardian.dpapi-environment." + id, value is null or "" ? "ABSENT" : "OBSERVED", Stage: value));

    static Probe ProfileDirectory(WindowsIdentity identity, string expectedSid)
    {
        try
        {
            int length = 0;
            _ = GetUserProfileDirectory(identity.AccessToken.DangerousGetHandle(), null, ref length);
            if (length is < 2 or > 32768) throw new InvalidDataException();
            var buffer = new char[length];
            if (!GetUserProfileDirectory(identity.AccessToken.DangerousGetHandle(), buffer, ref length)) throw new Win32Exception();
            int terminator = Array.IndexOf(buffer, '\0');
            string path = new(buffer, 0, terminator >= 0 ? terminator : Math.Min(length, buffer.Length));
            return new("guardian.dpapi-environment.profile-directory", "OBSERVED", Stage: path);
        }
        catch (Exception ex)
        {
            return new("guardian.dpapi-environment.profile-directory", "UNAVAILABLE", Program.Error(ex), Stage: expectedSid);
        }
    }

    static Probe HkuProfile(string expectedSid)
    {
        try
        {
            using var profileKey = Registry.Users.OpenSubKey(expectedSid, false);
            return new("guardian.dpapi-environment.hku-service-sid-loaded", "OBSERVED", Stage: profileKey is null ? "false" : "true");
        }
        catch (Exception ex) { return new("guardian.dpapi-environment.hku-service-sid-loaded", "UNAVAILABLE", Program.Error(ex)); }
    }

    static Probe ProfileType()
    {
        try
        {
            if (!GetProfileType(out uint type)) throw new Win32Exception();
            return new("guardian.dpapi-environment.profile-type", "OBSERVED", Stage: "0x" + type.ToString("X8"));
        }
        catch (Exception ex) { return new("guardian.dpapi-environment.profile-type", "UNAVAILABLE", Program.Error(ex)); }
    }

    static Probe Protect(string id, string descriptor)
    {
        byte[] secret = RandomNumberGenerator.GetBytes(32);
        byte[]? blob = null;
        byte[]? decoded = null;
        try
        {
            blob = NativeProtection.Protect(descriptor, secret);
            decoded = NativeProtection.Unprotect(blob);
            if (!CryptographicOperations.FixedTimeEquals(secret, decoded)) throw new InvalidDataException();
            return new("guardian.dpapi-diagnostic." + id, "PASS_MEMORY_ROUNDTRIP");
        }
        catch (Exception ex) { return new("guardian.dpapi-diagnostic." + id, "FAILED_OR_UNAVAILABLE", Program.Error(ex), ex.Data["probeStage"] as string); }
        finally
        {
            CryptographicOperations.ZeroMemory(secret);
            if (blob is not null) CryptographicOperations.ZeroMemory(blob);
            if (decoded is not null) CryptographicOperations.ZeroMemory(decoded);
        }
    }

    [DllImport("userenv.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetUserProfileDirectory(IntPtr token, [Out] char[]? profileDirectory, ref int size);

    [DllImport("userenv.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetProfileType(out uint flags);
}
