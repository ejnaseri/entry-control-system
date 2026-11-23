using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

// No pipe endpoint or native adapter is constructed. These tests exercise the
// permission/frame boundary and injected asynchronous completion lifetimes.
internal static class StandardNativeWorkerChannelTests
{
    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_PIPE_TEST_FAILED_" + cases); cases++; }
        void Reject<T>(Action action) where T : Exception {
            try { action(); } catch (T) { cases++; return; }
            throw new InvalidDataException("STANDARD_PIPE_EXPECTED_REFUSAL_MISSING_" + cases);
        }
        foreach (var stage in Enum.GetValues<StandardCryptoStage>()) {
            var rule = StandardPipeRules.Rule(stage);
            byte[] bytes = StandardStoreRules.Descriptor(rule);
            StandardStoreRules.ValidateDescriptor(bytes, rule); Check(true);
            string worker = StandardPipeRules.WorkerSid(stage);
            var workerAce = rule.Aces.Single(a => a.Sid == worker);
            Check(workerAce.Mask == StandardPipeRules.ClientAccess && (workerAce.Mask & 4) == 0);
            Check((workerAce.Mask & (0xf0000000u | 0xd0000u)) == 0);
            Check(rule.Owner == StandardContract.OwnerSid && rule.Group == StandardContract.Administrators && !rule.Directory);
            Check(rule.Aces.Single(a => a.Sid == StandardContract.OwnerSid).Mask == StandardStoreRules.Full);
            Check(rule.Aces.Count == (stage == StandardCryptoStage.Setup ? 2 : 3));
        }
        Check(StandardPipeRules.ServerOpenMode == 0x40080003 && StandardPipeRules.ServerPipeMode == 8);
        Check(StandardPipeRules.ClientFlags == 0x40110000);
        Reject<InvalidDataException>(() => StandardPipeRules.WorkerSid((StandardCryptoStage)99));
        Reject<InvalidDataException>(() => StandardPipeRules.Rule((StandardCryptoStage)(-1)));
        StandardPipeRules.Buffer(new byte[65536], 0, 65536, 30000); Check(true);
        StandardPipeRules.Buffer(new byte[3], 2, 1, 1); Check(true);
        foreach (int count in new[] { int.MinValue, -1, 0, 65537, int.MaxValue })
            Reject<InvalidDataException>(() => StandardPipeRules.Buffer(new byte[65536], 0, count, 1));
        foreach (int offset in new[] { int.MinValue, -1, 2, int.MaxValue })
            Reject<InvalidDataException>(() => StandardPipeRules.Buffer(new byte[2], offset, 1, 1));
        foreach (uint timeout in new uint[] { 0, 30001, uint.MaxValue })
            Reject<InvalidDataException>(() => StandardPipeRules.Buffer(new byte[2], 0, 1, timeout));
        Reject<InvalidDataException>(() => StandardPipeRules.Buffer(null, 0, 1, 1));

        using (var lease = new StandardPipeIoLease(new byte[1])) {
            Check(lease.ReleaseAllowed && !lease.Observe().StartCallReturned);
            Reject<InvalidDataException>(() => lease.Wait(1));
            lease.Start(_ => Task.FromResult(17)); Check(lease.Wait(1) == 17);
            Check(lease.Observe() is { OperationCompleted: true, OperationCanceled: false, ReleaseAllowed: true });
            Reject<InvalidDataException>(() => lease.Start(_ => Task.FromResult(99)));
            Reject<InvalidDataException>(() => lease.Wait(1));
        }
        using (var lease = new StandardPipeIoLease(new object())) {
            var failure = new IOException("PUBLIC_SYNTHETIC_IO_FAULT");
            lease.Start(_ => Task.FromException<int>(failure));
            Reject<IOException>(() => lease.Wait(1));
            Check(lease.Observe() is { OperationFailureType: "IOException", ReleaseAllowed: true } &&
                lease.Observe().OperationHResult == failure.HResult);
        }
        using (var lease = new StandardPipeIoLease(new object())) {
            lease.Start(_ => Task.FromCanceled<int>(new CancellationToken(true)));
            Reject<OperationCanceledException>(() => lease.Wait(1));
            Check(lease.Observe() is { OperationCompleted: true, OperationCanceled: true, ReleaseAllowed: true });
        }
        // Cancellation requests do not complete the injected I/O. The lease
        // refuses release until the same original Task reaches completion.
        var incomplete = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        var retained = new StandardPipeIoLease(new byte[5]);
        retained.Start(_ => incomplete.Task);
        Reject<TimeoutException>(() => retained.Wait(1));
        Check(retained.Observe() is { OperationCompleted: false, ReleaseAllowed: false });
        Reject<InvalidDataException>(() => retained.Dispose());
        incomplete.SetResult(5);
        Check(SpinWait.SpinUntil(() => retained.ReleaseAllowed, 5000));
        Check(retained.Observe().OperationCompleted); retained.Dispose();
        Reject<InvalidDataException>(() => retained.Start(_ => Task.FromResult(1)));

        // Even after I/O completes, a still-running cancellation callback may
        // reference its native lease. It must also finish before disposal.
        using (var callbackEntered = new ManualResetEventSlim())
        using (var releaseCallback = new ManualResetEventSlim()) {
            var operation = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
            var lease = new StandardPipeIoLease(new byte[1]);
            CancellationTokenRegistration registration = default;
            lease.Start(token => {
                registration = token.Register(() => { callbackEntered.Set(); releaseCallback.Wait(5000); });
                return operation.Task;
            });
            try {
                Reject<TimeoutException>(() => lease.Wait(1)); Check(callbackEntered.Wait(5000));
                operation.SetResult(1);
                Check(lease.Observe() is { OperationCompleted: true, CancellationCompleted: false, ReleaseAllowed: false });
                Reject<InvalidDataException>(() => lease.Dispose());
            } finally { releaseCallback.Set(); }
            Check(SpinWait.SpinUntil(() => lease.ReleaseAllowed, 5000)); registration.Dispose(); lease.Dispose();
        }
        // A callback failure is recorded separately; it neither rewrites the
        // timed-out protocol outcome nor prevents observing terminal release.
        {
            var operation = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
            var lease = new StandardPipeIoLease(new byte[1]);
            CancellationTokenRegistration registration = default;
            lease.Start(token => {
                registration = token.Register(() => throw new InvalidOperationException("PUBLIC_CALLBACK_FAULT"));
                return operation.Task;
            });
            Reject<TimeoutException>(() => lease.Wait(1)); operation.SetResult(1);
            Check(SpinWait.SpinUntil(() => lease.ReleaseAllowed, 5000));
            Check(lease.Observe() is { CancellationFailureType: "AggregateException", ReleaseAllowed: true });
            registration.Dispose(); lease.Dispose();
        }
        {
            var unknown = new StandardPipeIoLease(new byte[1]);
            Reject<IOException>(() => unknown.Start(_ => throw new IOException("PUBLIC_START_UNKNOWN")));
            Check(unknown.Observe() is { StartCallReturned: false, ReleaseAllowed: false });
            Reject<InvalidDataException>(() => unknown.Dispose());
        }
        return cases;
    }
}
