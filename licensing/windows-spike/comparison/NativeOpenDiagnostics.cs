using System.Runtime.InteropServices;

namespace Ecs.Lic008;

// Exact-name, read-only native open diagnostics. Intentionally limited to
// provider open, algorithm query, key open and handle release.
internal sealed record NativeOpenResult(int ProviderOpen, int? AlgorithmSupport, int? KeyOpen);

internal static class NativeOpenDiagnostics
{
    const uint MachineKey = 0x20;
    const uint Silent = 0x40;

    internal static NativeOpenResult Inspect(OwnedKey owned)
    {
        if (owned.Provider != "software" || owned.Name != Program.RetainedKeyName || owned.PublicHash.Length != 64)
            throw new InvalidDataException("Exact retained Software key required");

        IntPtr provider = IntPtr.Zero;
        IntPtr key = IntPtr.Zero;
        try
        {
            int providerStatus = NCryptOpenStorageProvider(out provider, "Microsoft Software Key Storage Provider", 0);
            if (providerStatus != 0) return new(providerStatus, null, null);

            int algorithmStatus = NCryptIsAlgSupported(provider, "ECDSA_P256", 0);
            if (algorithmStatus != 0) return new(providerStatus, algorithmStatus, null);

            int keyStatus = NCryptOpenKey(provider, out key, owned.Name, 0, MachineKey | Silent);
            return new(providerStatus, algorithmStatus, keyStatus);
        }
        finally
        {
            if (key != IntPtr.Zero) _ = NCryptFreeObject(key);
            if (provider != IntPtr.Zero) _ = NCryptFreeObject(provider);
        }
    }

    internal static List<Probe> ToProbes(string actor, NativeOpenResult result)
    {
        if (actor is not ("guardian" or "app" or "child")) throw new InvalidDataException();
        var prefix = actor + ".software.native-";
        List<Probe> probes = new();
        probes.Add(Status(prefix + "open-provider", "open-provider", result.ProviderOpen, actor == "guardian"));
        if (result.AlgorithmSupport is null)
        {
            probes.Add(new(prefix + "algorithm-support", "NOT_TESTED_PREREQUISITE", Stage: "algorithm-support"));
            probes.Add(new(prefix + "open-key", "NOT_TESTED_PREREQUISITE", Stage: "open-key"));
            return probes;
        }
        probes.Add(Status(prefix + "algorithm-support", "algorithm-support", result.AlgorithmSupport.Value, actor == "guardian"));
        if (result.KeyOpen is null)
        {
            probes.Add(new(prefix + "open-key", "NOT_TESTED_PREREQUISITE", Stage: "open-key"));
            return probes;
        }
        if (result.KeyOpen.Value == 0)
            probes.Add(new(prefix + "open-key", actor == "guardian" ? "PASS" : "FAIL_ACCESS_GRANTED", Stage: "open-key"));
        else
            probes.Add(new(prefix + "open-key", actor == "guardian" ? "FAILED_POSITIVE_CONTROL" : "INCONCLUSIVE",
                NativeStatus(result.KeyOpen.Value), "open-key"));
        return probes;
    }

    static Probe Status(string id, string stage, int status, bool positiveControl) => status == 0
        ? new(id, "PASS", Stage: stage)
        : new(id, positiveControl ? "FAILED_POSITIVE_CONTROL" : "INCONCLUSIVE", NativeStatus(status), stage);

    static string NativeStatus(int status) => "NCryptStatus:0x" + unchecked((uint)status).ToString("X8");

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenStorageProvider(out IntPtr provider, string name, uint flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptIsAlgSupported(IntPtr provider, string algorithm, uint flags);
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptOpenKey(IntPtr provider, out IntPtr key, string name, uint legacyKeySpec, uint flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFreeObject(IntPtr handle);
}
