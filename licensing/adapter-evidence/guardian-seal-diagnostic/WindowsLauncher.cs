using EntryControl.TestOnly.Runtime;
namespace EntryControl.TestOnly.Diagnostics;

// Windows SCM implementation. Deployment/custody/approval callbacks are required;
// there is no default, arbitrary service name, CLI route or automatic retry.
internal sealed class WindowsLauncher : ILauncherEnvironment
{
    private readonly Action verify, reserve, deploy;
    private readonly Action<string> journal;
    private readonly Func<bool> report;
    private bool started;
    public string DiagnosticCommand { get; }
    internal int ObservedProcessId { get; private set; }
    internal DateTimeOffset? ObservedProcessStartedUtc { get; private set; }
    internal WindowsLauncher(ServicePins pins, Action verify, Action reserve, Action deploy, Action<string> journal, Func<bool> report)
    {
        DiagnosticCommand=Launcher.BuildDiagnosticCommand(pins);
        this.verify=verify??throw new ArgumentNullException(nameof(verify));
        this.reserve=reserve??throw new ArgumentNullException(nameof(reserve));
        this.deploy=deploy??throw new ArgumentNullException(nameof(deploy));
        this.journal=journal??throw new ArgumentNullException(nameof(journal));
        this.report=report??throw new ArgumentNullException(nameof(report));
    }
    public void VerifyBindings()=>verify();
    public void ReserveNewAttempt()=>reserve();
    public void DeployNewProtectedDiagnostic()=>deploy();
    public void Journal(string phase)=>journal(phase);
    public bool ValidateDiagnosticReport()=>report();
    private static T WithService<T>(uint access,Func<IntPtr,T> work)
    {
        IntPtr manager=OpenSCManagerW(null,null,1);Program.Need(manager!=IntPtr.Zero,"DIAGNOSTIC_SCM_OPEN_REFUSED");
        try {
            IntPtr service=OpenServiceW(manager,Launcher.Service,access);Program.Need(service!=IntPtr.Zero,"DIAGNOSTIC_SERVICE_OPEN_REFUSED");
            try{return work(service);}finally{CloseServiceHandle(service);}
        }finally{CloseServiceHandle(manager);}
    }
    private static string ReadString(IntPtr pointer,IntPtr buffer,int size)
    {
        long offset=pointer.ToInt64()-buffer.ToInt64();
        Program.Need(pointer!=IntPtr.Zero && offset>=0 && offset<size && offset%2==0,"DIAGNOSTIC_CONFIG_POINTER_REFUSED");
        var text=new StringBuilder();
        for(int i=0;i<4096 && offset+i*2+2<=size;i++) {
            char c=(char)Marshal.ReadInt16(pointer,i*2);if(c==0)return text.ToString();text.Append(c);
        }
        throw new InvalidDataException("DIAGNOSTIC_CONFIG_STRING_REFUSED");
    }
    public ServiceSnapshot Snapshot()=>WithService(1|4,service=> {
        _=QueryServiceConfigW(service,IntPtr.Zero,0,out uint needed);
        Program.Need(needed>=Marshal.SizeOf<ServiceConfig>() && needed<=65536,"DIAGNOSTIC_CONFIG_SIZE_REFUSED");
        IntPtr buffer=Marshal.AllocHGlobal((int)needed);
        try {
            Program.Need(QueryServiceConfigW(service,buffer,needed,out _),"DIAGNOSTIC_CONFIG_QUERY_REFUSED");
            var config=Marshal.PtrToStructure<ServiceConfig>(buffer);
            Program.Need(config.Type==16 && config.Start==3 && config.ErrorControl==1,"DIAGNOSTIC_SERVICE_TYPE_REFUSED");
            string path=ReadString(config.Path,buffer,(int)needed),account=ReadString(config.Account,buffer,(int)needed);
            Program.Need(QueryServiceStatusEx(service,0,out var status,(uint)Marshal.SizeOf<ServiceStatus>(),out uint written) &&
                written==Marshal.SizeOf<ServiceStatus>() && status.Type==16,"DIAGNOSTIC_STATUS_QUERY_REFUSED");
            using var registry=Microsoft.Win32.RegistryKey.OpenBaseKey(Microsoft.Win32.RegistryHive.LocalMachine,Microsoft.Win32.RegistryView.Registry64);
            using var key=registry.OpenSubKey("SYSTEM\\CurrentControlSet\\Services\\"+Launcher.Service,false);
            Program.Need(key is not null,"DIAGNOSTIC_REGISTRY_REFUSED");
            // Conservative: even an empty configured recovery blob requires review.
            bool recoveryDisabled=key!.GetValue("FailureActions",null) is null &&
                Convert.ToInt32(key.GetValue("FailureActionsOnNonCrashFailures",0))==0;
            Program.Need(Convert.ToInt32(key.GetValue("ServiceSidType",0))==1,"DIAGNOSTIC_SERVICE_SID_TYPE_REFUSED");
            return new ServiceSnapshot(Launcher.Service,account,path,"Manual",status.State==1?"Stopped":"NotStopped",checked((int)status.Pid),recoveryDisabled);
        }finally{Marshal.FreeHGlobal(buffer);}
    });
    public void ChangePath(string path)
    {
        Program.Need(path==Launcher.OriginalPath || path==DiagnosticCommand,"DIAGNOSTIC_PATH_NOT_LISTED");
        Launcher.RequireStopped(Snapshot(),path==Launcher.OriginalPath?DiagnosticCommand:Launcher.OriginalPath);
        WithService(2,service=> {
            Program.Need(ChangeServiceConfigW(service,uint.MaxValue,uint.MaxValue,uint.MaxValue,path,null,IntPtr.Zero,null,null,null,null),"DIAGNOSTIC_PATH_CHANGE_REFUSED");return true;
        });
    }
    public void StartOnce()
    {
        Program.Need(!started,"DIAGNOSTIC_START_ALREADY_ATTEMPTED");started=true;
        Launcher.RequireStopped(Snapshot(),DiagnosticCommand);
        RuntimeCustody.VerifyServiceEnvironment();
        WithService(16,service=> {Program.Need(StartServiceW(service,0,IntPtr.Zero),"DIAGNOSTIC_START_REFUSED");return true;});
    }
    public ServiceSnapshot ObserveUntilStopped()
    {
        Program.Need(started,"DIAGNOSTIC_START_NOT_ATTEMPTED");
        var timer=Stopwatch.StartNew();
        do {
            var current=Snapshot();
            Program.Need(current.Name==Launcher.Service && current.Account=="NT SERVICE\\"+Launcher.Service &&
                current.Path==DiagnosticCommand && current.StartMode=="Manual" && current.RecoveryDisabled,
                "DIAGNOSTIC_OBSERVED_CONTEXT_CHANGED_RETAIN");
            if(current.State=="Stopped" && current.Pid==0)return current;
            if(current.Pid>0) {
                RecordObservedProcess(current.Pid,null);
                DateTimeOffset? observedStart=null;
                try {
                    using var process=Process.GetProcessById(current.Pid);
                    observedStart=new DateTimeOffset(process.StartTime.ToUniversalTime());
                }
                // A fast worker may stop between SCM observation and opening
                // its process. Never start it again merely to obtain a PID.
                catch(Exception error) when(error is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception) { }
                if(observedStart is not null)RecordObservedProcess(current.Pid,observedStart);
            }
            Thread.Sleep(250);
        }
        while(timer.ElapsedMilliseconds<45000);
        throw new InvalidDataException("DIAGNOSTIC_STILL_LIVE_RETAIN_NO_RESTORE");
    }
    private void RecordObservedProcess(int pid,DateTimeOffset? startedUtc)
    {
        Program.Need(pid>0 && (ObservedProcessId==0 || ObservedProcessId==pid) &&
            (startedUtc is null || startedUtc.Value.Offset==TimeSpan.Zero) &&
            (ObservedProcessStartedUtc is null || startedUtc is null || ObservedProcessStartedUtc==startedUtc),
            "DIAGNOSTIC_OBSERVED_PROCESS_CHANGED_RETAIN");
        ObservedProcessId=pid;
        if(startedUtc is not null)ObservedProcessStartedUtc=startedUtc;
    }
    // Pure constructor/boundary checks; never invokes SCM from self-test.
    internal static int SelfTest()
    {
        int count=0;
        void Reject(Action action){try{action();}catch(Exception error) when(error is ArgumentNullException or InvalidDataException){count++;return;}throw new Exception("CALLBACK_REFUSAL_MISSING");}
        void Check(bool condition){Program.Need(condition,"WINDOWS_LAUNCHER_TEST_FAILED");count++;}
        Action nothing=()=>{};Action<string> log=_=>{};Func<bool> result=()=>false;
        var pins=new ServicePins(new('a',64),new('b',64));
        Reject(()=>new WindowsLauncher(pins,null!,nothing,nothing,log,result));
        Reject(()=>new WindowsLauncher(pins,nothing,null!,nothing,log,result));
        Reject(()=>new WindowsLauncher(pins,nothing,nothing,null!,log,result));
        Reject(()=>new WindowsLauncher(pins,nothing,nothing,nothing,null!,result));
        Reject(()=>new WindowsLauncher(pins,nothing,nothing,nothing,log,null!));
        Reject(()=>new WindowsLauncher(null!,nothing,nothing,nothing,log,result));
        Reject(()=>new WindowsLauncher(pins with{ApprovalSha256="bad"},nothing,nothing,nothing,log,result));
        Reject(()=>new WindowsLauncher(pins with{PackageSha256="bad"},nothing,nothing,nothing,log,result));
        var instance=new WindowsLauncher(pins,nothing,nothing,nothing,log,result);
        Check(instance.DiagnosticCommand==Launcher.BuildDiagnosticCommand(pins));
        Reject(()=>instance.ChangePath("UNLISTED"));
        Reject(()=>instance.ChangePath(Launcher.BuildDiagnosticCommand(pins with{ApprovalSha256=new('c',64)})));
        Reject(()=>instance.ChangePath(Launcher.BuildDiagnosticCommand(pins with{PackageSha256=new('c',64)})));
        Reject(()=>instance.ObserveUntilStopped());
        Check(instance.ObservedProcessId==0 && instance.ObservedProcessStartedUtc is null);
        instance.RecordObservedProcess(123,null);
        Check(instance.ObservedProcessId==123 && instance.ObservedProcessStartedUtc is null);
        instance.RecordObservedProcess(123,DateTimeOffset.UnixEpoch);
        Check(instance.ObservedProcessStartedUtc==DateTimeOffset.UnixEpoch);
        instance.RecordObservedProcess(123,null);
        Check(instance.ObservedProcessStartedUtc==DateTimeOffset.UnixEpoch);
        Reject(()=>instance.RecordObservedProcess(124,null));
        Reject(()=>instance.RecordObservedProcess(123,DateTimeOffset.UnixEpoch.AddSeconds(1)));
        Reject(()=>instance.RecordObservedProcess(123,DateTimeOffset.UnixEpoch.ToOffset(TimeSpan.FromHours(1))));
        Reject(()=>instance.RecordObservedProcess(0,null));
        Check(instance.ObservedProcessId==123 && instance.ObservedProcessStartedUtc==DateTimeOffset.UnixEpoch);
        return count;
    }
    [StructLayout(LayoutKind.Sequential)]private struct ServiceConfig {internal uint Type,Start,ErrorControl;internal IntPtr Path,Group;internal uint Tag;internal IntPtr Dependencies,Account,DisplayName;}
    [StructLayout(LayoutKind.Sequential)]private struct ServiceStatus {internal uint Type,State,Accepted,Win32Exit,SpecificExit,Checkpoint,WaitHint,Pid,Flags;}
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr OpenSCManagerW(string? machine,string? database,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr OpenServiceW(IntPtr manager,string name,uint access);
    [DllImport("advapi32.dll")][return:MarshalAs(UnmanagedType.Bool)]private static extern bool CloseServiceHandle(IntPtr handle);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryServiceConfigW(IntPtr service,IntPtr config,uint size,out uint needed);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryServiceStatusEx(IntPtr service,uint level,out ServiceStatus status,uint size,out uint needed);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool ChangeServiceConfigW(IntPtr service,uint type,uint start,uint error,string path,string? group,IntPtr tag,string? dependencies,string? account,string? password,string? display);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool StartServiceW(IntPtr service,uint count,IntPtr args);
}
