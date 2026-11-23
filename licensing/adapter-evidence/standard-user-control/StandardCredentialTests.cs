using System;
using System.IO;
using System.Linq;
using System.Security;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardCredentialTests
{
    private sealed class Failure : Exception
    {
        public override string Message => throw new InvalidOperationException("MESSAGE_MUST_NOT_BE_READ");
    }
    private sealed class Memory : IStandardCredentialMemory
    {
        internal int Allocations, Frees, Reads, SnapshotLength;
        internal bool SnapshotReadOnly, ReturnZero, FailAllocate, FailRead;
        internal int NulAt = -1;
        internal bool BadTerminator;
        internal short[] Cells = Array.Empty<short>();
        internal bool AllCellsZeroBeforeFree;
        internal Action? OnAllocate;
        public IntPtr Allocate(SecureString snapshot)
        {
            Allocations++; SnapshotLength = snapshot.Length; SnapshotReadOnly = snapshot.IsReadOnly(); OnAllocate?.Invoke();
            if (FailAllocate) throw new Failure();
            Cells = Enumerable.Repeat((short)65, SnapshotLength + 1).ToArray();
            Cells[SnapshotLength] = (short)(BadTerminator ? 65 : 0);
            if (NulAt >= 0 && NulAt < SnapshotLength) Cells[NulAt] = 0;
            return ReturnZero ? IntPtr.Zero : new IntPtr(16);
        }
        public short Read(IntPtr pointer, int byteOffset)
        {
            StandardContract.Need(pointer == new IntPtr(16) && byteOffset % 2 == 0, "CREDENTIAL_FIXTURE_POINTER");
            Reads++; if (FailRead) throw new Failure();
            return Cells[byteOffset / 2];
        }
        public void WriteZero(IntPtr pointer, int byteOffset) { StandardContract.Need(pointer == new IntPtr(16), "CREDENTIAL_FIXTURE_CLEAR"); Cells[byteOffset / 2] = 0; }
        public void ZeroFree(IntPtr pointer) { StandardContract.Need(pointer == new IntPtr(16), "CREDENTIAL_FIXTURE_FREE"); AllCellsZeroBeforeFree = Cells.All(c => c == 0); Frees++; }
    }

    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_CREDENTIAL_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) {
            try { work(); } catch (Exception error) when (error is InvalidDataException or Failure) { cases++; return; }
            throw new InvalidDataException("STANDARD_CREDENTIAL_EXPECTED_REFUSAL_" + cases);
        }
        SecureString Fixture(int count) { var value = new SecureString(); for (int i = 0; i < count; i++) value.AppendChar('A'); return value; }
        foreach (int length in new[] { 1, 2, 126, 127 }) {
            using var secret = Fixture(length); var memory = new Memory(); int called = 0;
            int value = StandardCredential.Use(secret, memory, pointer => { called++; Check(pointer == new IntPtr(16)); return 9; });
            Check(value == 9 && called == 1 && memory.Allocations == 1 && memory.Frees == 1 && memory.Reads == length + 1);
            Check(memory.SnapshotReadOnly && memory.SnapshotLength == length && secret.Length == length && memory.AllCellsZeroBeforeFree);
        }
        foreach (int length in new[] { 0, 128, 1024 }) {
            using var secret = Fixture(length); var memory = new Memory();
            Reject(() => StandardCredential.Use<int>(secret, memory, _ => throw new Failure()));
            Check(memory.Allocations == 0 && memory.Frees == 0);
        }
        var absent = new Memory(); Reject(() => StandardCredential.Use<int>(null!, absent, _ => 1)); Check(absent.Allocations == 0);
        foreach (int nul in new[] { 0, 1, 126 }) {
            using var secret = Fixture(127); var memory = new Memory { NulAt = nul }; int called = 0;
            Reject(() => StandardCredential.Use(secret, memory, _ => ++called));
            Check(called == 0 && memory.Frees == 1 && memory.AllCellsZeroBeforeFree);
        }
        using (var secret = Fixture(2)) {
            var memory = new Memory { BadTerminator = true }; int called = 0;
            Reject(() => StandardCredential.Use(secret, memory, _ => ++called)); Check(called == 0 && memory.Frees == 1 && memory.AllCellsZeroBeforeFree);
        }
        foreach (string failure in new[] { "Allocate", "Read", "Body" }) {
            using var secret = Fixture(2); var memory = new Memory { FailAllocate = failure == "Allocate", FailRead = failure == "Read" };
            Reject(() => StandardCredential.Use<int>(secret, memory, _ => throw new Failure()));
            Check(memory.Frees == (failure == "Allocate" ? 0 : 1));
            if (failure != "Allocate") Check(memory.AllCellsZeroBeforeFree);
        }
        using (var secret = Fixture(1)) {
            var memory = new Memory { ReturnZero = true };
            Reject(() => StandardCredential.Use(secret, memory, _ => 1)); Check(memory.Frees == 0);
        }
        using (var secret = Fixture(2)) {
            var memory = new Memory { OnAllocate = () => { secret.Clear(); secret.AppendChar('B'); } };
            Check(StandardCredential.Use(secret, memory, _ => 7) == 7);
            Check(secret.Length == 1 && memory.SnapshotLength == 2 && memory.SnapshotReadOnly && memory.Frees == 1);
        }
        return cases;
    }
}
