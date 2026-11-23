namespace EntryControl.TestOnly.Runtime;
internal static class NativeWorker
{
    private static int active,blocked;
    internal static bool Ended=>Volatile.Read(ref active)==0;
    internal static T Run<T>(Func<T> work,int budgetMs)
    {
        Program.Need(budgetMs is 5000 or 10000 && Volatile.Read(ref blocked)==0 &&
            Interlocked.CompareExchange(ref active,1,0)==0,"WORKER_ADMISSION_REFUSED");
        try {
            var watch=Stopwatch.StartNew();var task=Task.Run(work);
            // No cancellation/StopService/kill. Task owns all native handles and
            // sensitive buffers; its own finally releases them when really done.
            bool ended;try {ended=task.Wait(budgetMs);}catch {Interlocked.Exchange(ref blocked,1);throw;}
            if(!ended || watch.ElapsedMilliseconds>=budgetMs) {
                Interlocked.Exchange(ref blocked,1);
                try {task.GetAwaiter().GetResult();}catch { }
                throw new InvalidDataException("WORKER_DEADLINE_UNKNOWN");
            }
            return task.GetAwaiter().GetResult();
        } finally {Volatile.Write(ref active,0);}
    }
}
