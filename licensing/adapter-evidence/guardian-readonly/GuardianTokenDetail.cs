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
    internal const string DiagnosticBoot="b8086f476aeb3be728d83e4921f2011f43b5e87451bb7cf73b03a40184443504";
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
    // Observation only: never invokes the original admission or key helpers.
    private static uint tokenObservation;
    internal static uint Encode(bool user,bool owner,bool primary,bool present,bool enabled,bool deny,bool duplicate)=>
        20000u+(user?0u:1u)+(owner?0u:2u)+(primary?0u:4u)+(present?0u:8u)+
        (enabled?0u:16u)+(deny?32u:0u)+(duplicate?64u:0u);
    private static void Probe()
    {
        Step(1,()=>{
            Need(Environment.Version.ToString()=="10.0.11" && RuntimeInformation.ProcessArchitecture==Architecture.X64,"RUNTIME_REFUSED");
            string dll=Path.Combine(Root,"bin","EntryControl.AdapterPilot.dll");
            Need((File.GetAttributes(dll)&FileAttributes.ReparsePoint)==0 && Hash(File.ReadAllBytes(dll))==AssemblyPin,"RETAINED_HASH_REFUSED");
            original=Assembly.LoadFrom(dll);
            Need((string)Call("NativeTokens","BootIdentity")! == DiagnosticBoot,"BOOT_CONTEXT_REFUSED");
        });
        Step(2,()=>{
            using(var imp=System.Security.Principal.WindowsIdentity.GetCurrent(true))Need(imp is null,"IMPERSONATION_REFUSED");
            string sid=(string)Call("NativeTokens","Sid","Guardian")!;
            using var identity=System.Security.Principal.WindowsIdentity.GetCurrent();
            T Info<T>(int cls,Func<IntPtr,int,T> parse) {
                _=GetTokenInformation(identity.AccessToken,cls,IntPtr.Zero,0,out int n);
                Need(n>=4 && n<=1048576,"TOKEN_LENGTH_REFUSED");
                IntPtr p=Marshal.AllocHGlobal(n);
                try {Need(GetTokenInformation(identity.AccessToken,cls,p,n,out int written) && written<=n,"TOKEN_QUERY_REFUSED");return parse(p,written);}
                finally {Marshal.FreeHGlobal(p);}
            }
            string owner=Info(4,(p,n)=>{Need(n>=IntPtr.Size,"TOKEN_LENGTH_REFUSED");return new System.Security.Principal.SecurityIdentifier(Marshal.ReadIntPtr(p)).Value;});
            int type=Info(8,(p,n)=>{Need(n>=4,"TOKEN_LENGTH_REFUSED");return Marshal.ReadInt32(p);});
            int matches=0;uint attributes=0;
            Info(2,(p,n)=>{
                Need(n>=4,"TOKEN_LENGTH_REFUSED");
                int count=Marshal.ReadInt32(p),offset=IntPtr.Size==8?8:4,stride=Marshal.SizeOf<TokenGroup>();
                Need(n>=offset && count>=0 && count<=(n-offset)/stride,"GROUP_COUNT_REFUSED");
                for(int i=0;i<count;i++){
                    var group=Marshal.PtrToStructure<TokenGroup>(p+offset+i*stride);
                    if(new System.Security.Principal.SecurityIdentifier(group.Sid).Value==sid){matches++;attributes=group.Attributes;}
                }
                return 0;
            });
            tokenObservation=Encode(identity.User?.Value==sid,owner==sid,type==1,matches>0,
                (attributes&4)!=0,(attributes&16)!=0,matches>1);
        });
    }
    [StructLayout(LayoutKind.Sequential)]private struct TokenGroup {internal IntPtr Sid;internal uint Attributes;}
    [DllImport("advapi32.dll",SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(Microsoft.Win32.SafeHandles.SafeAccessTokenHandle token,int cls,IntPtr buffer,int size,out int needed);
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
            try{Need(count==1,"NO_START_ARGUMENTS_ALLOWED");Set(4,0);Probe();result=tokenObservation;}
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
            for(uint mask=0;mask<128;mask++){Need(Encode((mask&1)==0,(mask&2)==0,(mask&4)==0,(mask&8)==0,(mask&16)==0,(mask&32)!=0,(mask&64)!=0)==20000+mask,"ENCODING_TEST_FAILED");cases++;}
            for(int i=0;i<Reasons.Length;i++){Need(Failure(3,new TargetInvocationException(new InvalidDataException(Reasons[i])))==301+i,"TEST_FAILED");cases++;}
            foreach(var pair in new[]{((Exception)new UnauthorizedAccessException("secret"),90),((Exception)new CryptographicException("secret"),91),((Exception)new IOException("secret"),92),((Exception)new Exception("secret"),99)}){Need(Failure(10,pair.Item1)==1000+pair.Item2,"TEST_FAILED");cases++;}
            Console.WriteLine(JsonSerializer.Serialize(new{scope="TEST_ONLY_GUARDIAN_TOKEN_DETAIL",cases,physicalExecuted=false,stageMap=new[]{"1 assembly/runtime/boot","2 read-only token metadata; 20000+bitmask observation, NOT acceptance"},reasons=Reasons}));return 0;
        }
        if(!args.SequenceEqual(new[]{"--service"})){Console.Error.WriteLine("DIAGNOSTIC_ARGUMENTS_REFUSED");return 2;}
        try{RunService();return 0;}catch{Console.Error.WriteLine("DIAGNOSTIC_SERVICE_REFUSED");return 2;}
    }
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern bool StartServiceCtrlDispatcherW([In]Entry[] entries);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr RegisterServiceCtrlHandlerExW(string name,Handler callback,IntPtr context);
    [DllImport("advapi32.dll",SetLastError=true)]private static extern bool SetServiceStatus(IntPtr handle,ref Status status);
}
