using Microsoft.Win32.SafeHandles;
namespace EntryControl.TestOnly.Runtime;

// Candidate readback/persistence interfaces. Main deliberately cannot call them.
// A stopped snapshot does not prove lifetime/token identity of an earlier process.
internal static class ControllerWindows
{
    private sealed class ScHandle : SafeHandleZeroOrMinusOneIsInvalid
    {
        private ScHandle():base(true){}
        protected override bool ReleaseHandle()=>CloseServiceHandle(handle);
    }
    [StructLayout(LayoutKind.Sequential)]private struct Status
    {internal uint Type,State,Controls,Win32Exit,ServiceExit,Checkpoint,WaitHint,Pid,Flags;}
    [StructLayout(LayoutKind.Sequential)]private struct Config
    {internal uint Type,Start,Error;internal IntPtr Binary,Group;internal uint Tag;internal IntPtr Dependencies,Account,Display;}
    internal static string ServiceName(string role)
    {Program.Need(new[]{"Setup","Guardian","App"}.Contains(role),"SERVICE_ROLE_REFUSED");return Program.Prefix+"."+role;}
    internal static string CheckpointFile(string stage)=>stage switch {
        "Prepare"=>"controller/prepare-checkpoint.json",
        "VerifyFreshProcess"=>"controller/fresh-process-checkpoint.json",
        "Finish"=>"controller/finish-checkpoint.json",_=>throw new InvalidDataException("CHECKPOINT_STAGE_REFUSED")};
    internal static string ReportFile(Run run)
    {
        Program.Need(PlanAdmission.Actions.Contains(run.Action) && run.Role==PlanAdmission.Actor(run.Action) && Program.Hex(run.RunId,32),"REPORT_ROUTE_REFUSED");
        return (run.Role switch {"Setup"=>"setup-reports","Guardian"=>"guardian-reports",_=>"app-reports"})+"/"+run.RunId+".json";
    }
    // Only ERROR_SERVICE_DOES_NOT_EXIST proves missing registration. All other
    // SCM errors (including denied access) are UNKNOWN/refused, never absence.
    internal static bool MissingRegistration(int error)
    {Program.Need(error==1060,"SERVICE_COLLISION_UNKNOWN");return true;}
    internal static bool RegistrationAbsent(string role)
    {
        NativeTokens.Capture("Controller");string name=ServiceName(role);
        using var scm=OpenSCManagerW(null,null,1);Program.Need(!scm.IsInvalid,"SCM_QUERY_REFUSED");
        using var service=OpenServiceW(scm,name,5);int error=Marshal.GetLastWin32Error();
        if(!service.IsInvalid)return false;return MissingRegistration(error);
    }
    internal static void RetainedConfig(string role,uint type,uint start,string binary,string account,string dependencies)
    {
        string name=ServiceName(role);
        Program.Need(type==0x10 && start==3 &&
            binary=="\""+SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe")+"\" --service "+role &&
            account==(role=="Setup"?"LocalSystem":"NT SERVICE\\"+name) && dependencies=="","SERVICE_CONFIG_REFUSED");
    }
    internal static string ServiceBinary(string role)=>"\""+SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe")+"\" --service "+ServiceName(role).Split('.').Last();
    internal static string ServiceAccount(string role)=>role=="Setup"?"LocalSystem":"NT SERVICE\\"+ServiceName(role);
    internal static void ExtraConfig(uint sidType,uint actions,uint failureFlag,uint delayed,uint triggers)
    {Program.Need(sidType==1 && actions==0 && failureFlag==0 && delayed==0 && triggers==0,"SERVICE_AUTOMATION_OR_SID_REFUSED");}
    private static void ReadExtraConfig(ScHandle service)
    {
        uint Field(int level,int offset) {
            _=QueryServiceConfig2W(service,level,IntPtr.Zero,0,out int size);int error=Marshal.GetLastWin32Error();
            Program.Need(error==122 && size>=offset+4 && size<=8192,"SERVICE_EXTRA_SIZE_REFUSED");var buffer=Marshal.AllocHGlobal(size);
            try {Program.Need(QueryServiceConfig2W(service,level,buffer,size,out _),"SERVICE_EXTRA_QUERY_REFUSED");
                if(level==2)Program.Need(Marshal.ReadIntPtr(buffer,IntPtr.Size==8?8:4)==IntPtr.Zero &&
                    Marshal.ReadIntPtr(buffer,IntPtr.Size==8?16:8)==IntPtr.Zero,"SERVICE_RECOVERY_COMMAND_REFUSED");
                return unchecked((uint)Marshal.ReadInt32(buffer,offset));}finally{Marshal.FreeHGlobal(buffer);}
        }
        // Failure-actions count is after reset period + two string pointers.
        ExtraConfig(Field(5,0),Field(2,IntPtr.Size==8?24:12),Field(4,0),Field(3,0),Field(8,0));
    }
    internal static ServiceReceipt[] RegisterAllNew(PilotPlan plan,string approvedPlanHash,string approvedPacketHash)
    {
        BootstrapAdmission.SuccessorContext(plan,approvedPlanHash,approvedPacketHash);NativeTokens.Capture("Controller");
        using var scm=OpenSCManagerW(null,null,3);Program.Need(!scm.IsInvalid,"SCM_CREATE_REFUSED");
        foreach(string role in new[]{"Setup","Guardian","App"}) {
            Program.Need(RegistrationAbsent(role),"SERVICE_COLLISION_RETAIN");string name=ServiceName(role);
            using var service=CreateServiceW(scm,name,name,7,16,3,1,ServiceBinary(role),null,IntPtr.Zero,null,role=="Setup"?null:ServiceAccount(role),null);
            Program.Need(!service.IsInvalid,"SERVICE_CREATE_NEW_FAILED_RETAIN");
            uint unrestricted=1;Program.Need(ChangeServiceConfig2W(service,5,ref unrestricted),"NEW_SERVICE_SID_CONFIG_FAILED_RETAIN");
            ReadExtraConfig(service);ReadService(role);
        }
        var receipts=new[]{"Setup","Guardian","App"}.Select(ReadService).ToArray();
        Program.Need(receipts.Single(s=>s.Name==ServiceName("Guardian")).Sid==plan.GuardianSid &&
            receipts.Single(s=>s.Name==ServiceName("App")).Sid==plan.AppSid,"REGISTERED_SID_MISMATCH_RETAIN");return receipts;
    }
    internal static ServiceReceipt ReadService(string role)
    {
        NativeTokens.Capture("Controller");string name=ServiceName(role);
        using var scm=OpenSCManagerW(null,null,1);Program.Need(!scm.IsInvalid,"SCM_QUERY_REFUSED");
        using var service=OpenServiceW(scm,name,5);Program.Need(!service.IsInvalid,"SERVICE_QUERY_REFUSED");
        Program.Need(QueryServiceStatusEx(service,0,out var before,Marshal.SizeOf<Status>(),out _) &&
            before.Type==0x10 && before.State==1 && before.Pid==0,"SERVICE_NOT_STOPPED");
        _=QueryServiceConfigW(service,IntPtr.Zero,0,out int size);int error=Marshal.GetLastWin32Error();
        Program.Need(error==122 && size>=Marshal.SizeOf<Config>() && size<=65536,"SERVICE_CONFIG_SIZE_REFUSED");
        var buffer=Marshal.AllocHGlobal(size);
        try {
            Program.Need(QueryServiceConfigW(service,buffer,size,out _),"SERVICE_CONFIG_QUERY_REFUSED");
            var config=Marshal.PtrToStructure<Config>(buffer);
            Program.Need(config.Error==1,"SERVICE_ERROR_CONTROL_REFUSED");
            string TextAt(IntPtr pointer) {
                long offset=pointer.ToInt64()-buffer.ToInt64();
                Program.Need(offset>=Marshal.SizeOf<Config>() && offset<size && offset%2==0,"SERVICE_CONFIG_POINTER_REFUSED");
                int chars=(size-(int)offset)/2;var text=new StringBuilder();
                for(int i=0;i<chars;i++){char c=(char)Marshal.ReadInt16(pointer,i*2);if(c==0)return text.ToString();text.Append(c);}
                throw new InvalidDataException("SERVICE_CONFIG_STRING_REFUSED");
            }
            RetainedConfig(role,config.Type,config.Start,TextAt(config.Binary),TextAt(config.Account),TextAt(config.Dependencies));
        } finally {Marshal.FreeHGlobal(buffer);}
        ReadExtraConfig(service);
        string sid=NativeTokens.Sid(role);Program.Need(PlanAdmission.ValidSid(sid),"SERVICE_SID_REFUSED");
        Program.Need(QueryServiceStatusEx(service,0,out var after,Marshal.SizeOf<Status>(),out _) &&
            after.Type==before.Type && after.State==1 && after.Pid==0,"SERVICE_STATE_CHANGED");
        return new(name,sid,"Stopped","Manual",0);
    }
    internal static int RunningPid(string role)
    {
        NativeTokens.Capture("Controller");string name=ServiceName(role);
        using var scm=OpenSCManagerW(null,null,1);Program.Need(!scm.IsInvalid,"SCM_QUERY_REFUSED");
        using var service=OpenServiceW(scm,name,4);Program.Need(!service.IsInvalid,"SERVICE_QUERY_REFUSED");
        Program.Need(QueryServiceStatusEx(service,0,out var status,Marshal.SizeOf<Status>(),out _) &&
            status.Type==16 && status.State==4 && status.Pid is >0 and <=int.MaxValue,"SERVICE_LIVE_PID_UNKNOWN");return (int)status.Pid;
    }
    private static readonly object LaunchGate=new();
    private static readonly HashSet<string> ConsumedRuns=new(StringComparer.Ordinal);
    private static readonly List<ProcessObserver> RetainedObservers=new();
    private static bool launchBlocked;
    private static Run? activeLaunch;
    internal static void LaunchState(uint type,uint state,uint pid)
    {Program.Need(type==16 && (state==2 || state==4 && pid is >0 and <=int.MaxValue),"SERVICE_CAPTURE_STATE_UNKNOWN");}
    internal static ProcessObserver StartAndObserve(PilotPlan plan,Run run,string approvedPlanHash,string approvedPacketHash)
    {
        PlanAdmission.Validate(plan);Program.Need(plan.Runs.Contains(run) && run.Role is "Setup" or "Guardian" or "App" &&
            approvedPlanHash==Program.Hash(Program.Serialize(plan)) && approvedPacketHash==Program.SuccessorPacketSha256,"LAUNCH_CONTEXT_REFUSED");
        NativeTokens.Capture("Controller");
        var bytes=SecureFiles.Read("plans/"+PlanAdmission.PlanFile(plan.Stage),plan.GuardianSid,plan.AppSid);
        HostAdmission.Verify(plan);
        Program.Need(Program.Hash(bytes)==approvedPlanHash,"LAUNCH_PLAN_CHANGED");
        foreach(var expected in plan.Runs.Where(r=>r==run || run.Role=="App" && r.Role=="Child"))SecureFiles.RequireNewReport(plan,expected);
        lock(LaunchGate) {
            Program.Need(!launchBlocked && activeLaunch is null && RetainedObservers.All(o=>o.HasExited) && ConsumedRuns.Add(run.RunId),"LAUNCH_RETRY_OR_BLOCKED");
            activeLaunch=run;
            try {
                ReadService(run.Role);
                using var scm=OpenSCManagerW(null,null,1);Program.Need(!scm.IsInvalid,"SCM_START_REFUSED");
                using var service=OpenServiceW(scm,ServiceName(run.Role),0x15);Program.Need(!service.IsInvalid,"SERVICE_START_HANDLE_REFUSED");
                var boundary=DateTimeOffset.UtcNow;var clock=Stopwatch.StartNew();
                Program.Need(StartServiceW(service,2,new[]{run.Action,approvedPlanHash}),"SERVICE_START_FAILED_RETAIN");
                for(;;) {
                    Program.Need(clock.ElapsedMilliseconds<5000,"SERVICE_CAPTURE_DEADLINE_UNKNOWN");
                    Program.Need(QueryServiceStatusEx(service,0,out var status,Marshal.SizeOf<Status>(),out _),"SERVICE_CAPTURE_QUERY_UNKNOWN");
                    LaunchState(status.Type,status.State,status.Pid);
                    if(status.State==4) {
                        var observer=ProcessObserver.ObserveService(plan,run.Action,boundary);
                        RetainedObservers.Add(observer);Program.Need(clock.ElapsedMilliseconds<5000,"SERVICE_CAPTURE_LATE_UNKNOWN");return observer;
                    }
                    Thread.Sleep(5); // read-only polling, never another StartService
                }
            } catch {launchBlocked=true;throw;}
        }
    }
    internal static void RetainObserver(ProcessObserver observer){lock(LaunchGate)RetainedObservers.Add(observer);}
    internal static void BlockLaunches(){lock(LaunchGate)launchBlocked=true;}
    internal static void CompleteObservedAction(PilotPlan plan,Run run,string planHash,ProcessObserver[] observers)
    {
        lock(LaunchGate) {
            try {
                Program.Need(!launchBlocked && activeLaunch==run,"LAUNCH_COMPLETION_CONTEXT_REFUSED");
                var expected=plan.Runs.Where(r=>r==run || run.Role=="App" && r.Role=="Child").ToArray();
                Program.Need(observers.Length==expected.Length && observers.All(o=>RetainedObservers.Contains(o)),"LAUNCH_OBSERVERS_REFUSED");
                var services=new[]{"Setup","Guardian","App"}.Select(ReadService).ToArray();
                for(int i=0;i<expected.Length;i++) {
                    var observation=observers[i].Complete();var bytes=SecureFiles.Read(ReportFile(expected[i]),plan.GuardianSid,plan.AppSid,plan);
                    var report=StageController.ValidateSingle(plan,planHash,expected[i],new(expected[i].RunId,Program.Hash(bytes),bytes),observation.Receipt,services,null);
                    Program.Need(observation.Token==report.Token(),"LAUNCH_TOKEN_RECEIPT_REFUSED");
                }
                if(run.Role=="App") {
                    var app=observers[0].Complete();var child=observers[1].Complete();
                    Program.Need(child.ParentPid==app.Receipt.ProcessId && child.Token==app.Token && app.Receipt.StartedUtc<=child.Receipt.StartedUtc &&
                        child.Receipt.EndedUtc<=app.Receipt.EndedUtc,"LAUNCH_CHILD_CONTEXT_REFUSED");
                }
                activeLaunch=null;
            }catch{launchBlocked=true;throw;}
        }
    }
    internal static string RunOrderedStage(OwnerAdmission input,OwnerReservation reservation,string planHash,string packetHash)
    {
        Program.Need(OwnerJournal.CoordinatorReady,"OWNER_JOURNAL_COORDINATION_NOT_READY");
        Program.Need(Program.Hash(Program.Serialize(input.Snapshot))==planHash && packetHash==Program.SuccessorPacketSha256,"STAGE_DISPATCH_CONTEXT_REFUSED");
        reservation.BeginStage(input);reservation.VerifyLive(input);
        input.VerifyLiveControllerOwner();
        var plan=input.Consume(DateTimeOffset.UtcNow);
        Program.Need(Program.Hash(Program.Serialize(plan))==planHash && packetHash==Program.SuccessorPacketSha256,"STAGE_DISPATCH_CONTEXT_REFUSED");
        NativeTokens.Capture("Controller");
        foreach(var run in plan.Runs)SecureFiles.RequireNewReport(plan,run);
        HostAdmission.Verify(plan);
        StageCheckpoint? previous=plan.Stage=="Prepare"?null:ReadPrevious(plan);
        if(previous is not null)Program.Need(previous.Stage==(plan.Stage=="Finish"?"VerifyFreshProcess":"Prepare") && previous.ExperimentId==plan.ExperimentId &&
            previous.ContextSha256==StageController.ContextHash(plan) && previous.RunIds.SequenceEqual(plan.PreviousRunIds) &&
            previous.EvidenceSha256==plan.PreviousEvidenceSha256 && previous.SharedSha256==ReadSharedHash(plan) &&
            !previous.SecurityAccepted && !previous.ProductionAccepted && previous.LastEndedUtc<=DateTimeOffset.UtcNow,"STAGE_PRIOR_CONTEXT_REFUSED");
        var order=new OrderedActions(plan.Stage);var observers=new List<ProcessObserver>();
        try {
            foreach(string action in StageController.ServiceActions(plan.Stage)) {
                reservation.VerifyLive(input);
                order.Begin(action);var run=plan.Runs.Single(r=>r.Action==action);
                var app=StartAndObserve(plan,run,planHash,packetHash);observers.Add(app);
                ProcessObserver? child=null;var clock=Stopwatch.StartNew();
                while(!app.HasExited || child is not null && !child.HasExited) {
                    Program.Need(clock.ElapsedMilliseconds<10000,"ACTION_OBSERVATION_DEADLINE_UNKNOWN");
                    if(run.Role=="App" && child is null && !app.HasExited) {
                        child=app.TryDiscoverChild(plan);
                        if(child is not null){RetainObserver(child);observers.Add(child);}
                    }
                    Thread.Sleep(5);
                }
                Program.Need(clock.ElapsedMilliseconds<10000,"ACTION_OBSERVATION_LATE_UNKNOWN");
                Program.Need(run.Role!="App" || child is not null,"CHILD_MISSED_RETAIN");
                CompleteObservedAction(plan,run,planHash,child is null?new[]{app}:new[]{app,child});
                Program.Need(clock.ElapsedMilliseconds<10000,"ACTION_VALIDATION_LATE_UNKNOWN");order.Complete(action);
            }
            order.RequireComplete();var services=new[]{"Setup","Guardian","App"}.Select(ReadService).ToArray();
            return PersistValidated(plan,planHash,ReadReports(plan),observers.ToArray(),services,ReadSharedHash(plan),previous);
        } catch {order.Block();BlockLaunches();throw;}
        // Observer handles remain strongly retained, even on unknown/deadline.
        // No Kill/StopService/automatic retry/next stage or late checkpoint.
    }
    internal static ReportEvidence[] ReadReports(PilotPlan plan)
    {
        NativeTokens.Capture("Controller");PlanAdmission.Validate(plan);
        return plan.Runs.Select(run=>{var bytes=SecureFiles.Read(ReportFile(run),plan.GuardianSid,plan.AppSid,plan);
            return new ReportEvidence(run.RunId,Program.Hash(bytes),bytes);}).ToArray();
    }
    internal static readonly string[] SharedNames={"app-readable-envelope.bin","app-readable-expected-hash.json","public-control.json","restricted-envelope.bin","restricted-expected-hash.json"};
    internal static string SharedDigest(PackageFile[] files)
    {
        Program.Need(files.Length==SharedNames.Length && files.Select(f=>f.Name).SequenceEqual(SharedNames) &&
            files.All(f=>f.Size is >0 and <=2097152 && Program.Hex(f.Sha256,64)),"SHARED_INVENTORY_REFUSED");
        return Program.Hash(Program.Serialize(files));
    }
    internal static string ReadSharedHash(PilotPlan plan)
    {
        NativeTokens.Capture("Controller");PlanAdmission.Validate(plan);
        return SharedDigest(SharedNames.Select(name=>{var bytes=SecureFiles.Read("shared/"+name,plan.GuardianSid,plan.AppSid);
            return new PackageFile(name,bytes.LongLength,Program.Hash(bytes));}).ToArray());
    }
    internal static StageCheckpoint ReadPrevious(PilotPlan plan)
    {
        NativeTokens.Capture("Controller");PlanAdmission.Validate(plan);
        string stage=plan.Stage switch {"VerifyFreshProcess"=>"Prepare","Finish"=>"VerifyFreshProcess",_=>throw new InvalidDataException("PREVIOUS_STAGE_REFUSED")};
        var bytes=SecureFiles.Read(CheckpointFile(stage),plan.GuardianSid,plan.AppSid);
        Program.Need(Program.Hash(bytes)==plan.PreviousCheckpointSha256,"CHECKPOINT_FILE_CHANGED");
        var checkpoint=Program.Parse<StageCheckpoint>(bytes);
        Program.Need(bytes.SequenceEqual(Program.Serialize(checkpoint)),"CHECKPOINT_CANONICAL_REFUSED");return checkpoint;
    }
    internal static string PersistValidated(PilotPlan plan,string approvedHash,ReportEvidence[] reports,
        ProcessObserver[] processObservers,ServiceReceipt[] measuredServices,string sharedHash,StageCheckpoint? previous)
    {
        NativeTokens.Capture("Controller");
        // Fresh independent reads are mandatory before persisting. Process
        // observations are produced by the retained-handle observer, not reports.
        var actualReports=ReadReports(plan);
        Program.Need(actualReports.Length==reports.Length && actualReports.Zip(reports).All(pair=>
            pair.First.RunId==pair.Second.RunId && pair.First.Sha256==pair.Second.Sha256 &&
            pair.First.Bytes.SequenceEqual(pair.Second.Bytes)),"REPORTS_CHANGED_BEFORE_CHECKPOINT");
        var actualServices=new[]{"Setup","Guardian","App"}.Select(ReadService).ToArray();
        Program.Need(actualServices.Length==measuredServices.Length && actualServices.All(s=>measuredServices.Count(m=>m==s)==1),"SERVICES_CHANGED_BEFORE_CHECKPOINT");
        Program.Need(ReadSharedHash(plan)==sharedHash,"SHARED_CHANGED_BEFORE_CHECKPOINT");
        if(plan.Stage!="Prepare")Program.Need(previous is not null &&
            Program.Serialize(ReadPrevious(plan)).SequenceEqual(Program.Serialize(previous)),"PREVIOUS_CHANGED_BEFORE_CHECKPOINT");
        // Production-shaped persistence cannot accept manufactured observation
        // DTOs: each receipt must come from a privately constructed live handle.
        var measuredProcesses=ProcessObserver.Validate(plan,actualReports,processObservers.Select(o=>o.Complete()).ToArray());
        var checkpoint=StageController.Validate(plan,approvedHash,reports,measuredProcesses,measuredServices,sharedHash,previous);
        var bytes=Program.Serialize(checkpoint);string file=CheckpointFile(plan.Stage);
        // CreateNew + protected Admin-owner descriptor + flush + same-rule readback.
        // Partial write/crash is retained: no replace, retry, adoption or recovery.
        SecureFiles.Write(file,bytes,"Controller",plan.GuardianSid,plan.AppSid);
        var readback=SecureFiles.Read(file,plan.GuardianSid,plan.AppSid);
        Program.Need(readback.SequenceEqual(bytes),"CHECKPOINT_READBACK_REFUSED");return Program.Hash(readback);
    }
    internal static int SelfTest()
    {
        int count=0;void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("WINDOWS_RULE_REFUSAL_MISSING");}
        Program.Need(MissingRegistration(1060),"SERVICE_ABSENCE_RULE_FAILED");count++;
        foreach(int error in new[]{0,5,1072,1722,6})Reject(()=>MissingRegistration(error));
        foreach(string role in new[]{"Setup","Guardian","App"}) {
            string binary="\""+SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe")+"\" --service "+role;
            string account=role=="Setup"?"LocalSystem":"NT SERVICE\\"+ServiceName(role);
            RetainedConfig(role,16,3,binary,account,"");count++;
            Program.Need(ServiceBinary(role)==binary && ServiceAccount(role)==account,"SERVICE_REGISTRATION_TEMPLATE_FAILED");count++;
            Reject(()=>RetainedConfig(role,32,3,binary,account,""));Reject(()=>RetainedConfig(role,16,2,binary,account,""));
            Reject(()=>RetainedConfig(role,16,3,binary+" extra",account,""));Reject(()=>RetainedConfig(role,16,3,binary,"Other",""));
            Reject(()=>RetainedConfig(role,16,3,binary,account,"dependency"));
        }
        foreach(string stage in new[]{"Prepare","VerifyFreshProcess","Finish"}){
            var rule=SecureFiles.Rule(CheckpointFile(stage),"G","P");Program.Need(rule.Creator=="Controller" && rule.Owner=="S-1-5-32-544","CHECKPOINT_RULE_FAILED");count++;}
        foreach(string action in PlanAdmission.Actions){var run=new Run(action,PlanAdmission.Actor(action),new string('a',32));
            Program.Need(ReportFile(run).EndsWith("/"+run.RunId+".json",StringComparison.Ordinal),"REPORT_RULE_FAILED");count++;}
        Reject(()=>ServiceName("Child"));Reject(()=>CheckpointFile("Repair"));
        Reject(()=>ReportFile(new("setup-create","App",new string('a',32))));
        Reject(()=>ReportFile(new("app-prepare","App","../escape")));
        var shared=SharedNames.Select(name=>new PackageFile(name,1,new string('a',64))).ToArray();
        Program.Need(Program.Hex(SharedDigest(shared),64),"SHARED_DIGEST_FAILED");count++;
        Reject(()=>SharedDigest(shared[..^1]));Reject(()=>SharedDigest(shared.Reverse().ToArray()));
        Reject(()=>SharedDigest(shared.Select((f,i)=>i==0?f with {Size=0}:f).ToArray()));
        Reject(()=>SharedDigest(shared.Select((f,i)=>i==0?f with {Sha256="bad"}:f).ToArray()));
        ExtraConfig(1,0,0,0,0);count++;
        LaunchState(16,2,0);count++;LaunchState(16,4,10);count++;
        Reject(()=>LaunchState(16,1,0));Reject(()=>LaunchState(16,4,0));Reject(()=>LaunchState(32,4,10));
        Reject(()=>LaunchState(16,7,10));
        Reject(()=>ExtraConfig(0,0,0,0,0));Reject(()=>ExtraConfig(3,0,0,0,0));Reject(()=>ExtraConfig(1,1,0,0,0));
        Reject(()=>ExtraConfig(1,0,1,0,0));Reject(()=>ExtraConfig(1,0,0,1,0));Reject(()=>ExtraConfig(1,0,0,0,1));return count;
    }
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern ScHandle OpenSCManagerW(string? machine,string? database,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern ScHandle OpenServiceW(ScHandle manager,string name,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool StartServiceW(ScHandle service,int count,[In,MarshalAs(UnmanagedType.LPArray,ArraySubType=UnmanagedType.LPWStr,SizeParamIndex=1)]string[] args);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern ScHandle CreateServiceW(ScHandle manager,string name,string display,uint access,uint type,uint start,uint error,string binary,string? group,IntPtr tag,string? dependencies,string? account,string? password);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool ChangeServiceConfig2W(ScHandle service,int level,ref uint value);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryServiceConfig2W(ScHandle service,int level,IntPtr buffer,int size,out int needed);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryServiceStatusEx(ScHandle service,int level,out Status status,int size,out int needed);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool QueryServiceConfigW(ScHandle service,IntPtr config,int size,out int needed);
    [DllImport("advapi32.dll")][return:MarshalAs(UnmanagedType.Bool)]private static extern bool CloseServiceHandle(IntPtr handle);
}

// Managed sequencing core. Native caller advances only after real completion,
// stopped service receipts and each role's full report/identity validation.
internal sealed class OrderedActions
{
    private readonly string[] actions;private int index;private bool active,blocked;
    internal OrderedActions(string stage){actions=StageController.ServiceActions(stage);}
    internal void Begin(string action){Program.Need(!blocked && !active && index<actions.Length && actions[index]==action,"ACTION_ORDER_REFUSED");active=true;}
    internal void Complete(string action){Program.Need(!blocked && active && actions[index]==action,"ACTION_COMPLETION_REFUSED");active=false;index++;}
    internal void Block(){blocked=true;}
    internal void RequireComplete(){Program.Need(!blocked && !active && index==actions.Length,"STAGE_INCOMPLETE");}
    internal static int SelfTest()
    {
        int count=0;void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("ORDER_REFUSAL_MISSING");}
        foreach(string stage in new[]{"Prepare","VerifyFreshProcess","Finish"}) {
            var order=new OrderedActions(stage);var actions=StageController.ServiceActions(stage);
            Reject(order.RequireComplete);Reject(()=>order.Complete(actions[0]));Reject(()=>order.Begin(actions[^1]));
            order.Begin(actions[0]);Reject(()=>order.Begin(actions[0]));Reject(order.RequireComplete);order.Complete(actions[0]);
            foreach(string action in actions.Skip(1)){order.Begin(action);order.Complete(action);}
            order.RequireComplete();count++;Reject(()=>order.Begin(actions[0]));
            var failed=new OrderedActions(stage);failed.Begin(actions[0]);failed.Block();
            Reject(()=>failed.Complete(actions[0]));Reject(()=>failed.Begin(actions[0]));Reject(failed.RequireComplete);
        }
        return count;
    }
}
