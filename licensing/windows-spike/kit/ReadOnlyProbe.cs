using System;
using System.Runtime.InteropServices;

// Intentionally imports only handle opening, algorithm query and handle release.
public static class EcsLic008ReadOnlyProbe
{
    public sealed class Result
    {
        public string Provider;
        public string KeyName;
        public string ProviderOpen;
        public string P256Support;
        public string ExactKeyOpen;
        public string Observation;
    }
    public static bool ValidName(string provider, string name)
    {
        if (provider != "software" && provider != "tpm") return false;
        string prefix = "Ecs.Lic008.TEST_ONLY." + provider + ".";
        Guid id;
        return name != null && name.StartsWith(prefix, StringComparison.Ordinal) &&
            Guid.TryParseExact(name.Substring(prefix.Length), "N", out id);
    }
    static string Code(int status) { return "0x" + unchecked((uint)status).ToString("X8"); }
    public static Result Inspect(string provider, string name)
    {
        if (!ValidName(provider, name)) throw new ArgumentException("Exact test key required.");
        Result result = new Result { Provider=provider, KeyName=name, P256Support="NOT_TESTED", ExactKeyOpen="NOT_TESTED", Observation="UNKNOWN" };
        IntPtr handle = IntPtr.Zero;
        int status = NCryptOpenStorageProvider(out handle, provider == "software" ? "Microsoft Software Key Storage Provider" : "Microsoft Platform Crypto Provider", 0);
        result.ProviderOpen = Code(status);
        if (status != 0) return result;
        try
        {
            result.P256Support = Code(NCryptIsAlgSupported(handle,"ECDSA_P256",0));
            IntPtr key = IntPtr.Zero;
            status = NCryptOpenKey(handle,out key,name,0,0x20 | 0x40); // Machine + Silent.
            result.ExactKeyOpen = Code(status);
            if (status == 0)
            {
                try { result.Observation = "OPENED_FOR_ADMINISTRATOR"; }
                finally { NCryptFreeObject(key); }
            }
            else if (unchecked((uint)status) == 0x80090016 || unchecked((uint)status) == 0x80090011)
                result.Observation = "NOT_FOUND_FOR_CALLER";
            else if (unchecked((uint)status) == 0x80090010 || unchecked((uint)status) == 0x80070005)
                result.Observation = "ACCESS_DENIED_EXISTENCE_UNKNOWN";
            return result;
        }
        finally { NCryptFreeObject(handle); }
    }
    [DllImport("ncrypt.dll", CharSet=CharSet.Unicode)]
    static extern int NCryptOpenStorageProvider(out IntPtr provider, string name, uint flags);
    [DllImport("ncrypt.dll", CharSet=CharSet.Unicode)]
    static extern int NCryptIsAlgSupported(IntPtr provider, string algorithm, uint flags);
    [DllImport("ncrypt.dll", CharSet=CharSet.Unicode)]
    static extern int NCryptOpenKey(IntPtr provider, out IntPtr key, string name, uint legacy, uint flags);
    [DllImport("ncrypt.dll")]
    static extern int NCryptFreeObject(IntPtr handle);
}
