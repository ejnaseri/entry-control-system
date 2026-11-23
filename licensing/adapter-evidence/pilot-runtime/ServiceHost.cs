namespace EntryControl.TestOnly.Runtime;
internal static class ServiceHost
{
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate void Main(uint n,IntPtr args);
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate uint Control(uint code,uint type,IntPtr data,IntPtr context);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct Entry {internal string? Name;internal Main? Callback;}
    [StructLayout(LayoutKind.Sequential)]private struct Status {internal uint Type,State,Accepted,Win32Exit,SpecificExit,Checkpoint,WaitHint;}
    internal static void Run(string name,Action action)
        =>RunWithArguments(name,_=>action());
    internal static void ValidateStartArguments(string role,string[] args)
    {
        Program.Need(args.Length==3 && args[0]==ControllerWindows.ServiceName(role) &&
            RoleActions.Supports(role,args[1]) && role!="Child" && Program.Hex(args[2],64),"SERVICE_ACTION_ARGUMENTS_REFUSED");
    }
    internal static void RunRole(string role)=>RunWithArguments(ControllerWindows.ServiceName(role),args=>{
        ValidateStartArguments(role,args);RoleActions.Execute(role,args[1],args[2]);});
    internal static void DispatchChild(string[] args)
    {
        Program.Need(args.Length==4 && args[0]=="--child" && args[1]=="Child" &&
            RoleActions.Supports("Child",args[2]) && Program.Hex(args[3],64),"CHILD_DISPATCH_ARGUMENTS_REFUSED");
        RoleActions.Execute("Child",args[2],args[3]);
    }
    private static void RunWithArguments(string name,Action<string[]> action)
    {
        IntPtr handle=IntPtr.Zero;
        // No accepted stop/shutdown controls and no forced process exit while a
        // worker is live. Controller must retain unknown runs, not kill them.
        Control control=(_,_,_,_)=>120;
        void Set(uint state,uint exit){var status=new Status {Type=16,State=state,Accepted=0,Win32Exit=exit};
            Program.Need(SetServiceStatus(handle,ref status),"SERVICE_STATUS_REFUSED");}
        Main main=(n,args)=>{handle=RegisterServiceCtrlHandlerExW(name,control,IntPtr.Zero);if(handle==IntPtr.Zero)return;
            uint exit=0;try {Program.Need(n==3 && args!=IntPtr.Zero,"SERVICE_ACTION_COUNT_REFUSED");
                var values=new string[3];for(int i=0;i<3;i++) {
                    var pointer=Marshal.ReadIntPtr(args,i*IntPtr.Size);Program.Need(pointer!=IntPtr.Zero,"SERVICE_ACTION_POINTER_REFUSED");
                    var text=new StringBuilder();bool ended=false;
                    for(int j=0;j<=128;j++){char c=(char)Marshal.ReadInt16(pointer,j*2);if(c==0){ended=true;break;}text.Append(c);}
                    Program.Need(ended,"SERVICE_ACTION_SIZE_REFUSED");values[i]=text.ToString();
                }
                Set(4,0);action(values);
            }catch {exit=1067;}finally {Set(1,exit);}};
        Program.Need(StartServiceCtrlDispatcherW(new[]{new Entry{Name=name,Callback=main},new Entry()}),"SERVICE_DISPATCH_REFUSED");
        GC.KeepAlive(main);GC.KeepAlive(control);
    }
    internal static int SelfTest()
    {
        int count=0;void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("DISPATCH_REFUSAL_MISSING");}
        foreach(string action in PlanAdmission.Actions.Where(a=>!a.StartsWith("child-",StringComparison.Ordinal))) {
            string role=PlanAdmission.Actor(action);var args=new[]{ControllerWindows.ServiceName(role),action,new string('a',64)};
            ValidateStartArguments(role,args);count++;
            Reject(()=>ValidateStartArguments(role,args[..2]));Reject(()=>ValidateStartArguments(role,new[]{args[0],args[1],"bad"}));
            Reject(()=>ValidateStartArguments(role,new[]{"foreign",args[1],args[2]}));
        }
        Reject(()=>ValidateStartArguments("App",new[]{ControllerWindows.ServiceName("App"),"child-prepare",new string('a',64)}));return count;
    }
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool StartServiceCtrlDispatcherW([In]Entry[] entries);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr RegisterServiceCtrlHandlerExW(string name,Control callback,IntPtr context);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool SetServiceStatus(IntPtr handle,ref Status status);
}
