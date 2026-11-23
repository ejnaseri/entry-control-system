using System;
using System.Runtime.InteropServices;
using System.Security;

namespace EntryControl.TestOnly.StandardUserControl;

internal interface IStandardCredentialMemory
{
    IntPtr Allocate(SecureString readOnlySnapshot);
    short Read(IntPtr pointer, int byteOffset);
    void WriteZero(IntPtr pointer, int byteOffset);
    void ZeroFree(IntPtr pointer);
}

internal sealed class StandardCredentialMemory : IStandardCredentialMemory
{
    public IntPtr Allocate(SecureString readOnlySnapshot) => Marshal.SecureStringToBSTR(readOnlySnapshot);
    public short Read(IntPtr pointer, int byteOffset) => Marshal.ReadInt16(pointer, byteOffset);
    public void WriteZero(IntPtr pointer, int byteOffset) => Marshal.WriteInt16(pointer, byteOffset, 0);
    public void ZeroFree(IntPtr pointer) => Marshal.ZeroFreeBSTR(pointer);
}

internal static class StandardCredential
{
    // No managed password string. Snapshot prevents concurrent caller mutation
    // from changing length/bytes between validation and credentialed creation.
    internal static T Use<T>(SecureString password, IStandardCredentialMemory memory, Func<IntPtr, T> work)
    {
        StandardContract.Need(password is not null, "STANDARD_CREDENTIAL_REQUIRED");
        using var snapshot = password.Copy();
        snapshot.MakeReadOnly();
        StandardContract.Need(snapshot.Length is >= 1 and <= 127, "STANDARD_CREDENTIAL_LENGTH_REFUSED");
        IntPtr pointer = IntPtr.Zero;
        try {
            pointer = memory.Allocate(snapshot);
            StandardContract.Need(pointer != IntPtr.Zero, "STANDARD_CREDENTIAL_ALLOCATION_REFUSED");
            for (int i = 0; i < snapshot.Length; i++)
                StandardContract.Need(memory.Read(pointer, i * 2) != 0, "STANDARD_CREDENTIAL_NUL_REFUSED");
            StandardContract.Need(memory.Read(pointer, snapshot.Length * 2) == 0, "STANDARD_CREDENTIAL_TERMINATOR_REFUSED");
            return work(pointer);
        } finally {
            if (pointer != IntPtr.Zero) {
                // Clear the entire known allocation, including a rejected NUL
                // suffix. Null-terminated wcslen-based cleanup is insufficient.
                try { for (int i = 0; i <= snapshot.Length; i++) memory.WriteZero(pointer, i * 2); }
                finally { memory.ZeroFree(pointer); }
            }
        }
    }
}
