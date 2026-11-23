using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace Ecs.Lic008;

internal static class NativeProtection
{
    const uint Silent = 0x40;
    static void Check(int status) { if (status != 0) throw new CryptographicException(status); }
    public static byte[] Protect(string descriptor, byte[] secret)
    {
        IntPtr handle = IntPtr.Zero;
        Program.Stage("dpapi-create-descriptor", () => { Check(NCryptCreateProtectionDescriptor(descriptor, 0, out handle)); return true; });
        try
        {
            IntPtr output = IntPtr.Zero; int size = 0;
            Program.Stage("dpapi-protect-secret", () => { Check(NCryptProtectSecret(handle, Silent, secret, secret.Length, IntPtr.Zero, IntPtr.Zero, out output, out size)); return true; });
            return CopyAndFree(output, size);
        }
        finally { NCryptCloseProtectionDescriptor(handle); }
    }
    public static byte[] Unprotect(byte[] blob)
    {
        Check(NCryptUnprotectSecret(IntPtr.Zero, Silent, blob, blob.Length, IntPtr.Zero, IntPtr.Zero, out var output, out var size));
        return CopyAndFree(output, size);
    }
    static byte[] CopyAndFree(IntPtr output, int size)
    {
        try
        {
            if (size is < 1 or > 65536) throw new InvalidDataException();
            byte[] bytes = new byte[size]; Marshal.Copy(output, bytes, 0, size);
            return bytes;
        }
        finally
        {
            if (size is > 0 and <= 65536) Marshal.Copy(new byte[size], 0, output, size);
            LocalFree(output);
        }
    }
    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    static extern int NCryptCreateProtectionDescriptor(string descriptor, uint flags, out IntPtr handle);
    [DllImport("ncrypt.dll")]
    static extern int NCryptCloseProtectionDescriptor(IntPtr handle);
    [DllImport("ncrypt.dll")]
    static extern int NCryptProtectSecret(IntPtr handle, uint flags, byte[] data, int size, IntPtr allocator, IntPtr window, out IntPtr output, out int outputSize);
    [DllImport("ncrypt.dll")]
    static extern int NCryptUnprotectSecret(IntPtr descriptor, uint flags, byte[] data, int size, IntPtr allocator, IntPtr window, out IntPtr output, out int outputSize);
    [DllImport("kernel32.dll")]
    static extern IntPtr LocalFree(IntPtr memory);
}
