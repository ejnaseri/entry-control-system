using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

// Fixed retained experiment only. No role execution, create/delete/set-key,
// protected-file write, service registration/configuration or ACL mutation API.
internal static class GuardianReadOnly
{
    internal const string Service="Ecs.Lic008.EntryEvidenceV1.Guardian";
    internal const string Root=@"C:\ProgramData\Ecs.Lic008.EntryEvidenceV1";
    internal const string AssemblyPin="586aaeab6ac9b836658a2bc1a60f94a6435debcdb33ee92775cbe4c6f124f088";
    internal const string PlanPin="3f90f918746db64978a2cfcc1d030cb5dbad6cff225991f4a8b830c8e4fdbc1e";
    internal const string RetainedBoot="db258d9bc32ce3b87190e432f9fb25be5a5a600f19475c5b645789490b29fde2";
    internal const string DiagnosticBoot="c1e1b3806edf81fb24c02d4226be6b4ccc159651785f20332f40cf94553b3fc9";
    private static int stage;
    private static Assembly? original;
    private static readonly string[] Reasons={"TOKEN_OWNER_TYPE_REFUSED","SERVICE_IDENTITY_REFUSED","IMPERSONATION_REFUSED",
        "FILE_OPEN_REFUSED","OWNER_DACL_REFUSED","ACE_RIGHTS_REFUSED","SECURITY_QUERY_FAILED","HOST_BINDING_MISMATCH",
        "KEY_POLICY_REFUSED","KEY_DACL_REFUSED","KEY_ACE_REFUSED","PUBLIC_IDENTITY_REFUSED","OWNERSHIP_CHAIN_REFUSED",
        "BOOT_CONTEXT_REFUSED","FILE_KIND_REFUSED","HANDLE_PATH_REFUSED","REPARSE_ANCESTOR","RETAINED_HASH_REFUSED"};
    private static void Need(bool ok,string reason){if(!ok)throw new InvalidDataException(reason);}
    private static string Hash(byte[] bytes)=>Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    private static Type TypeOf(string name)=>original!.GetType("EntryControl.TestOnly.Runtime."+name,true)!;
    private static object? Call(string type,string method,params object?[] args)=>
        TypeOf(type).GetMethod(method,BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic)!.Invoke(null,args);
    private static object Property(object obj,string name)=>obj.GetType().GetProperty(name)!.GetValue(obj)!;
    private static void Step(int id,Action work){stage=id;work();}
    internal static int Failure(int phase,Exception error)
    {
        while(error is TargetInvocationException or AggregateException && error.InnerException is not null)error=error.InnerException;
        int code=Array.IndexOf(Reasons,error.Message)+1;
        if(code==0)code=error is UnauthorizedAccessException?90:error is CryptographicException?91:error is IOException?92:99;
        return phase*100+code; // no exception text, paths, payload or key bytes leave the probe
    }
    private static void Probe()
    {
        Step(1,()=>{
            Need(Environment.Version.ToString()=="10.0.11" && RuntimeInformation.ProcessArchitecture==Architecture.X64,"RUNTIME_REFUSED");
            string dll=Path.Combine(Root,"bin","EntryControl.AdapterPilot.dll");
            Need((File.GetAttributes(dll)&FileAttributes.ReparsePoint)==0 && Hash(File.ReadAllBytes(dll))==AssemblyPin,"RETAINED_HASH_REFUSED");
            original=Assembly.LoadFrom(dll);
        });
        string g="",a="";object? plan=null;
        Step(2,()=>{g=(string)Call("NativeTokens","Sid","Guardian")!;a=(string)Call("NativeTokens","Sid","App")!;Call("NativeTokens","Capture","Guardian");});
        Step(3,()=>{
            var bytes=(byte[])Call("SecureFiles","Read","plans/prepare.json",g,a,null,2097152)!;
            Need(Hash(bytes)==PlanPin,"RETAINED_HASH_REFUSED");
            plan=TypeOf("Program").GetMethod("Parse",BindingFlags.Static|BindingFlags.NonPublic)!.MakeGenericMethod(TypeOf("PilotPlan")).Invoke(null,new object[]{bytes})!;
            Call("PlanAdmission","Validate",plan);
        });
        Step(4,()=>{Call("HostAdmission","Verify",plan);
            // Separate read-only observation on a later, explicitly pinned boot.
            // This never admits or updates the retained Prepare plan.
            Need((string)Property(plan!,"BootIdentity")==RetainedBoot &&
                (string)Call("NativeTokens","BootIdentity")! == DiagnosticBoot,"BOOT_CONTEXT_REFUSED");});
        Step(5,()=>{
            var files=(Array)Property(plan!,"PackageFiles");
            var actual=Directory.GetFileSystemEntries(Path.Combine(Root,"bin"));
            Need(actual.Length==files.Length,"RETAINED_HASH_REFUSED");
            foreach(object file in files){string name=(string)Property(file,"Name");
                byte[] bytes=(byte[])Call("SecureFiles","Read","bin/"+name,g,a,plan,int.MaxValue)!;
                Need(bytes.LongLength==(long)Property(file,"Size") && Hash(bytes)==(string)Property(file,"Sha256"),"RETAINED_HASH_REFUSED");}
        });
        foreach(var pair in new[]{("restricted",6),("app-readable",8)}) {
            object? owned=null;
            Step(pair.Item2,()=>{owned=Call("KeyOperations","Owned",plan,pair.Item1);});
            Step(pair.Item2+1,()=>{
                using var key=(IDisposable)Call("KeyOperations","Open",plan,pair.Item1)!;
                Call("KeyOperations","Verify",key,plan,pair.Item1,Property(owned!,"PublicSha256"));
            });
        }
        Step(10,()=>{
            foreach(string folder in new[]{"guardian-work","guardian-reports"}) {
                object rule=Call("SecureFiles","Rule",folder,g,a,null,true)!;
                string full=Path.Combine(Root,folder);
                using var handle=(IDisposable)Call("SecureFiles","Open",full,(uint)0x20080,(uint)3,true)!;
                Call("SecureFiles","Check",handle,rule,full);
            }
        });
        // Does not reproduce original process-path admission, sealing/export or report writes.
    }
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate void ServiceMain(uint count,IntPtr args);
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate uint Handler(uint code,uint type,IntPtr data,IntPtr context);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct Entry {internal string? Name;internal ServiceMain? Main;}
    [StructLayout(LayoutKind.Sequential)]private struct Status {internal uint Type,State,Accepted,Win32,Specific,Checkpoint,WaitHint;}
    private static void RunService()
    {
        IntPtr statusHandle=IntPtr.Zero;Handler handler=(_,_,_,_)=>120;
        void Set(uint state,uint result){var s=new Status{Type=16,State=state,Win32=result==0?0u:1066u,Specific=result};Need(SetServiceStatus(statusHandle,ref s),"STATUS_FAILED");}
        ServiceMain main=(count,args)=>{
            statusHandle=RegisterServiceCtrlHandlerExW(Service,handler,IntPtr.Zero);if(statusHandle==IntPtr.Zero)return;
            uint result=0;stage=0;
            try{Need(count==1,"NO_START_ARGUMENTS_ALLOWED");Set(4,0);Probe();}
            catch(Exception ex){result=(uint)Failure(stage,ex);}
            finally{Set(1,result);}
        };
        Need(StartServiceCtrlDispatcherW(new[]{new Entry{Name=Service,Main=main},new Entry()}),"SERVICE_DISPATCH_FAILED");
        GC.KeepAlive(main);GC.KeepAlive(handler);
    }
    private static int Main(string[] args)
    {
        if(args.SequenceEqual(new[]{"--self-test"})) {
            int cases=0;
            for(int i=0;i<Reasons.Length;i++){Need(Failure(3,new TargetInvocationException(new InvalidDataException(Reasons[i])))==301+i,"TEST_FAILED");cases++;}
            foreach(var pair in new[]{((Exception)new UnauthorizedAccessException("secret"),90),((Exception)new CryptographicException("secret"),91),((Exception)new IOException("secret"),92),((Exception)new Exception("secret"),99)}){Need(Failure(10,pair.Item1)==1000+pair.Item2,"TEST_FAILED");cases++;}
            Console.WriteLine(JsonSerializer.Serialize(new{scope="TEST_ONLY_GUARDIAN_READONLY_DIAGNOSTIC",cases,physicalExecuted=false,stageMap=new[]{"1 assembly/runtime","2 token/SIDs","3 retained plan","4 host/boot","5 retained package","6 restricted ownership","7 restricted key open/policy","8 control ownership","9 control key open/policy","10 staging/report directory ACL"},reasons=Reasons}));return 0;
        }
        if(!args.SequenceEqual(new[]{"--service"})){Console.Error.WriteLine("DIAGNOSTIC_ARGUMENTS_REFUSED");return 2;}
        try{RunService();return 0;}catch{Console.Error.WriteLine("DIAGNOSTIC_SERVICE_REFUSED");return 2;}
    }
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern bool StartServiceCtrlDispatcherW([In]Entry[] entries);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr RegisterServiceCtrlHandlerExW(string name,Handler callback,IntPtr context);
    [DllImport("advapi32.dll",SetLastError=true)]private static extern bool SetServiceStatus(IntPtr handle,ref Status status);
}
