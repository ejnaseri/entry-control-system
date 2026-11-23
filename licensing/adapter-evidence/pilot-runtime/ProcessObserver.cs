using Microsoft.Win32.SafeHandles;
namespace EntryControl.TestOnly.Runtime;

internal sealed record ProcessObservation(ProcessReceipt Receipt,TokenSnapshot Token,string Image,int ParentPid,string BootIdentity);
// Read-only candidate; no dispatch from Main, no privilege enabling, no launch.
internal sealed class ProcessObserver : IDisposable
{
    private readonly SafeProcessHandle handle;
    private readonly Run run;
    private readonly TokenSnapshot token;
    private readonly string image,boot;
    private readonly int pid,parent;
    private readonly DateTimeOffset started;
    private ProcessObserver(SafeProcessHandle handle,Run run,TokenSnapshot token,string image,string boot,int pid,int parent,DateTimeOffset started)
    {this.handle=handle;this.run=run;this.token=token;this.image=image;this.boot=boot;this.pid=pid;this.parent=parent;this.started=started;}
    internal static void Live(uint wait)=>Program.Need(wait==258,"PROCESS_NOT_OBSERVED_LIVE");
    internal static DateTimeOffset Time(long value)
    {Program.Need(value>0 && value<=DateTimeOffset.MaxValue.ToFileTime(),"PROCESS_TIME_REFUSED");return DateTimeOffset.FromFileTime(value);}
    private static DateTimeOffset Creation(SafeProcessHandle handle)
    {Program.Need(GetProcessTimes(handle,out long creation,out _,out _,out _),"PROCESS_TIME_QUERY_REFUSED");return Time(creation);}
    private static ProcessObserver Attach(PilotPlan plan,Run run,int pid,int expectedParent,DateTimeOffset notBefore)
    {
        NativeTokens.Capture("Controller");PlanAdmission.Validate(plan);
        Program.Need(plan.Runs.Contains(run) && pid>0 && notBefore.Offset==TimeSpan.Zero,"PROCESS_RUN_REFUSED");
        var handle=OpenProcess(0x100400,false,(uint)pid); // SYNCHRONIZE + QUERY_INFORMATION only
        try {
            Program.Need(!handle.IsInvalid && GetProcessId(handle)==(uint)pid,"PROCESS_OPEN_REFUSED");
            Live(WaitForSingleObject(handle,0));var started=Creation(handle);Program.Need(started>=notBefore,"PROCESS_OLD_RUN_REFUSED");
            var path=new StringBuilder(32768);uint size=(uint)path.Capacity;
            Program.Need(QueryFullProcessImageNameW(handle,0,path,ref size) && size>0 && size<path.Capacity,"PROCESS_IMAGE_QUERY_REFUSED");
            string image=path.ToString();Program.Need(image==SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe"),"PROCESS_IMAGE_REFUSED");
            Program.Need(NtQueryInformationProcess(handle,0,out var basic,Marshal.SizeOf<Basic>(),out int written)==0 &&
                written==Marshal.SizeOf<Basic>() && basic.Pid.ToInt64()==pid,"PROCESS_PARENT_QUERY_REFUSED");
            long parent=basic.Parent.ToInt64();Program.Need(parent>=0 && parent<=int.MaxValue &&
                (run.Role=="Child"?parent==expectedParent && parent!=pid:expectedParent==0),"PROCESS_PARENT_REFUSED");
            string sid=NativeTokens.Sid(run.Role=="Child"?"App":run.Role);
            Program.Need(run.Role=="Setup" || sid==(run.Role=="Guardian"?plan.GuardianSid:plan.AppSid),"PROCESS_SERVICE_SID_REFUSED");
            var token=NativeTokens.CaptureProcess(handle,run.Role,sid);string boot=NativeTokens.BootIdentity();
            Program.Need(boot==plan.BootIdentity && Creation(handle)==started,"PROCESS_CONTEXT_CHANGED");
            Live(WaitForSingleObject(handle,0));
            return new(handle,run,token,image,boot,pid,(int)parent,started);
        } catch {handle.Dispose();throw;}
    }
    internal static ProcessObserver ObserveService(PilotPlan plan,string action,DateTimeOffset launchBoundary)
    {
        var run=plan.Runs.Single(r=>r.Action==action);Program.Need(run.Role is "Setup" or "Guardian" or "App","SERVICE_OBSERVER_ROLE_REFUSED");
        int pid=ControllerWindows.RunningPid(run.Role);
        var observer=Attach(plan,run,pid,0,launchBoundary);
        try {Program.Need(ControllerWindows.RunningPid(run.Role)==pid,"SERVICE_PROCESS_CHANGED");return observer;}
        catch {observer.handle.Dispose();throw;}
    }
    // Snapshot is a candidate discovery source, never a report-supplied PID.
    // Missing/extra/short-lived child is UNKNOWN; do not reconstruct it afterward.
    internal ProcessObserver DiscoverChild(PilotPlan plan)
        =>TryDiscoverChild(plan)??throw new InvalidDataException("CHILD_NOT_CAPTURED");
    internal bool HasExited {
        get {uint state=WaitForSingleObject(handle,0);Program.Need(state is 0 or 258,"PROCESS_WAIT_UNKNOWN");return state==0;}
    }
    internal ProcessObserver? TryDiscoverChild(PilotPlan plan)
    {
        Program.Need(run.Role=="App" && plan.Runs.Contains(run),"CHILD_OBSERVER_PARENT_REFUSED");Live(WaitForSingleObject(handle,0));
        var childRun=plan.Runs.Single(r=>r.Role=="Child");
        var candidates=Children(pid);
        if(candidates.Length==0){Live(WaitForSingleObject(handle,0));return null;}
        int childPid=SelectChild(pid,candidates);
        var child=Attach(plan,childRun,childPid,pid,started);
        try {
            Live(WaitForSingleObject(handle,0));Program.Need(child.token==token && child.started>=started,"CHILD_OBSERVER_CONTEXT_REFUSED");
            return child;
        } catch {child.handle.Dispose();throw;}
    }
    internal static int SelectChild(int parent,int[] candidates)
    {Program.Need(parent>0 && candidates.Length==1 && candidates[0]>0 && candidates[0]!=parent,"CHILD_DISCOVERY_UNKNOWN");return candidates[0];}
    private static int[] Children(int pid)
    {
        using var snapshot=CreateToolhelp32Snapshot(2,0);Program.Need(!snapshot.IsInvalid,"PROCESS_SNAPSHOT_REFUSED");
        var row=new ProcessEntry {Size=(uint)Marshal.SizeOf<ProcessEntry>()};var children=new List<int>();int count=0;
        Program.Need(Process32FirstW(snapshot,ref row),"PROCESS_SNAPSHOT_FIRST_REFUSED");
        do {Program.Need(++count<=65536,"PROCESS_SNAPSHOT_SIZE_REFUSED");
            if(row.Parent==(uint)pid){Program.Need(row.Pid is >0 and <=int.MaxValue,"CHILD_PID_REFUSED");children.Add((int)row.Pid);}
            row.Size=(uint)Marshal.SizeOf<ProcessEntry>();
        } while(Process32NextW(snapshot,ref row));
        Program.Need(Marshal.GetLastWin32Error()==18,"PROCESS_SNAPSHOT_INCOMPLETE");return children.ToArray();
    }
    internal ProcessObservation Complete()
    {
        NativeTokens.Capture("Controller");Program.Need(NativeTokens.BootIdentity()==boot,"PROCESS_BOOT_CHANGED");
        Program.Need(WaitForSingleObject(handle,0)==0,"PROCESS_STILL_RUNNING_OR_UNKNOWN");
        Program.Need(GetProcessTimes(handle,out long creation,out long exit,out _,out _) && Time(creation)==started &&
            GetExitCodeProcess(handle,out uint code) && code==0,"PROCESS_COMPLETION_REFUSED");
        var ended=Time(exit);Program.Need(ended>started,"PROCESS_LIFETIME_REFUSED");
        return new(new(run.Action,run.RunId,pid,started,ended),token,image,parent,boot);
    }
    public void Dispose()
    {
        if(handle.IsClosed)return;
        Program.Need(WaitForSingleObject(handle,0)==0,"LIVE_PROCESS_OBSERVER_MUST_BE_RETAINED");handle.Dispose();
    }
    internal static ProcessReceipt[] Validate(PilotPlan plan,ReportEvidence[] evidence,ProcessObservation[] observations)
    {
        PlanAdmission.Validate(plan);
        Program.Need(observations.Length==plan.Runs.Length && evidence.Length==plan.Runs.Length,"OBSERVATION_COUNT_REFUSED");
        for(int i=0;i<plan.Runs.Length;i++) {
            var run=plan.Runs[i];var o=observations[i];var r=Program.Parse<PilotReport>(evidence[i].Bytes);
            string expected=run.Role=="Setup"?"S-1-5-18":run.Role=="Guardian"?plan.GuardianSid:plan.AppSid;
            Program.Need(evidence[i].RunId==run.RunId && Program.Hash(evidence[i].Bytes)==evidence[i].Sha256 &&
                o.Receipt.Action==run.Action && o.Receipt.RunId==run.RunId && o.Receipt.ProcessId==r.ProcessId && r.RunId==run.RunId &&
                o.Receipt.ProcessId>0 && o.Receipt.StartedUtc<o.Receipt.EndedUtc &&
                o.Receipt.StartedUtc<=r.TimeUtc && r.TimeUtc<=o.Receipt.EndedUtc &&
                o.Image==SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe") && o.BootIdentity==plan.BootIdentity &&
                o.Token.User==expected && o.Token.Owner==expected && o.Token.Type==1 && o.Token.Elevation is 0 or 1 &&
                PlanAdmission.ValidSid(o.Token.Service) && (run.Role=="Setup" || o.Token.Service==expected) &&
                ServiceIdentityPolicy.Accept(run.Role,o.Token.Service,o.Token.User,o.Token.Owner,o.Token.Type,o.Token.GroupCount,o.Token.Attributes,o.Token.QueryComplete,false,o.Token.Restricted) &&
                o.Token==r.Token(),"OBSERVATION_REPORT_REFUSED");
            if(run.Role=="Child") {
                var app=observations.Single(x=>x.Receipt.Action.StartsWith("app-",StringComparison.Ordinal));
                Program.Need(o.ParentPid==app.Receipt.ProcessId && o.Receipt.ProcessId!=app.Receipt.ProcessId && o.Token==app.Token &&
                    app.Receipt.StartedUtc<=o.Receipt.StartedUtc && o.Receipt.EndedUtc<=app.Receipt.EndedUtc,"OBSERVATION_CHILD_REFUSED");
            }
        }
        return observations.Select(o=>o.Receipt).ToArray();
    }
    internal static int SelfTest()
    {
        int count=0;void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("OBSERVER_REFUSAL_MISSING");}
        Live(258);count++;foreach(uint state in new uint[]{0,128,uint.MaxValue})Reject(()=>Live(state));
        Program.Need(Time(DateTimeOffset.UnixEpoch.ToFileTime())==DateTimeOffset.UnixEpoch,"OBSERVER_TIME_FAILED");count++;
        Reject(()=>Time(0));Reject(()=>Time(-1));Reject(()=>Time(long.MaxValue));
        Program.Need(SelectChild(10,new[]{11})==11,"OBSERVER_CHILD_SELECTION_FAILED");count++;
        Reject(()=>SelectChild(10,Array.Empty<int>()));Reject(()=>SelectChild(10,new[]{11,12}));
        Reject(()=>SelectChild(10,new[]{10}));Reject(()=>SelectChild(10,new[]{0}));Reject(()=>SelectChild(0,new[]{11}));return count;
    }
    [StructLayout(LayoutKind.Sequential)]private struct Basic {internal IntPtr Reserved,Peb,Reserved2,Reserved3,Pid,Parent;}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct ProcessEntry
    {internal uint Size,Usage,Pid;internal UIntPtr Heap;internal uint Module,Threads,Parent;internal int Priority;internal uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]internal string? Exe;}
    private sealed class SnapshotHandle:SafeHandleZeroOrMinusOneIsInvalid
    {private SnapshotHandle():base(true){}protected override bool ReleaseHandle()=>CloseHandle(handle);}
    [DllImport("kernel32.dll",SetLastError=true)]private static extern SafeProcessHandle OpenProcess(uint rights,[MarshalAs(UnmanagedType.Bool)]bool inherit,uint pid);
    [DllImport("kernel32.dll")]private static extern uint GetProcessId(SafeProcessHandle handle);
    [DllImport("kernel32.dll",SetLastError=true)]private static extern uint WaitForSingleObject(SafeProcessHandle handle,uint milliseconds);
    [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool GetProcessTimes(SafeProcessHandle handle,out long creation,out long exit,out long kernel,out long user);
    [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool GetExitCodeProcess(SafeProcessHandle handle,out uint exit);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryFullProcessImageNameW(SafeProcessHandle handle,uint flags,StringBuilder name,ref uint size);
    [DllImport("ntdll.dll")]private static extern int NtQueryInformationProcess(SafeProcessHandle handle,int cls,out Basic info,int size,out int written);
    [DllImport("kernel32.dll",SetLastError=true)]private static extern SnapshotHandle CreateToolhelp32Snapshot(uint flags,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool Process32FirstW(SnapshotHandle handle,ref ProcessEntry entry);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool Process32NextW(SnapshotHandle handle,ref ProcessEntry entry);
    [DllImport("kernel32.dll")][return:MarshalAs(UnmanagedType.Bool)]private static extern bool CloseHandle(IntPtr handle);
}
