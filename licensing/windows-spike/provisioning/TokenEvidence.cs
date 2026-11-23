using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

namespace Ecs.Lic008;

internal sealed record IdentityEvidence(string? UserSid, string ExpectedSid, bool PrimaryIdentityMatched, uint? ServiceGroupAttributes);
internal static class TokenEvidence
{
    public static IdentityEvidence Capture(string expected)
    {
        using var identity = WindowsIdentity.GetCurrent();
        GetTokenInformation(identity.AccessToken, 2, IntPtr.Zero, 0, out int length);
        if (length is < 4 or > 1048576) throw new InvalidDataException();
        IntPtr buffer = Marshal.AllocHGlobal(length);
        try
        {
            if (!GetTokenInformation(identity.AccessToken, 2, buffer, length, out _)) throw new System.ComponentModel.Win32Exception();
            int count = Marshal.ReadInt32(buffer), offset = IntPtr.Size == 8 ? 8 : 4;
            int stride = Marshal.SizeOf<SidAndAttributes>();
            if (count < 0 || count > (length - offset) / stride) throw new InvalidDataException();
            uint? attrs = null;
            for (int i = 0; i < count; i++)
            {
                var entry = Marshal.PtrToStructure<SidAndAttributes>(buffer + offset + i * stride);
                if (new SecurityIdentifier(entry.Sid).Value == expected) attrs = entry.Attributes;
            }
            return new(identity.User?.Value, expected, Program.IdentityAllowed(identity.User?.Value, expected), attrs);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    internal static bool Accept(IdentityEvidence evidence) => evidence.PrimaryIdentityMatched &&
        (evidence.ServiceGroupAttributes is null || ((evidence.ServiceGroupAttributes.Value & 4) != 0 && (evidence.ServiceGroupAttributes.Value & 16) == 0));
    public static bool Allowed(string expected) => Accept(Capture(expected));
    [StructLayout(LayoutKind.Sequential)]
    struct SidAndAttributes { public IntPtr Sid; public uint Attributes; }
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetTokenInformation(SafeAccessTokenHandle token, int informationClass, IntPtr information, int length, out int needed);
}
