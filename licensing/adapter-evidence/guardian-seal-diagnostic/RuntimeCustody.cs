using EntryControl.TestOnly.Runtime;
using Microsoft.Win32;
namespace EntryControl.TestOnly.Diagnostics;
internal sealed record RuntimeFile(string Group,string Name,int Size,string Sha256);
internal sealed record RuntimeInventory(int SchemaVersion,string Runtime,RuntimeFile[] Files);
internal sealed record LoadedRuntimeFile(string Name,string Path,int Size,string Sha256);
internal static class RuntimeCustody
{
    private static readonly string[] NativeNames={"hostfxr.dll","hostpolicy.dll","coreclr.dll"};
    private static readonly string[] RuntimePrefixes={"DOTNET_","COMPLUS_","CORECLR_","COR_","COREHOST_"};
    private static readonly string[] RuntimeNames={"APPDOMAIN_MANAGER_ASM","APPDOMAIN_MANAGER_TYPE","DEVPATH","__COMPAT_LAYER"};
    private static string GroupOf(string name)=>name.Equals("hostfxr.dll",StringComparison.OrdinalIgnoreCase)?"fxr":"runtime";
    internal static string DirectoryOf(string group)=>group switch {
        "runtime"=>"C:\\Program Files\\dotnet\\shared\\Microsoft.NETCore.App\\10.0.11",
        "fxr"=>"C:\\Program Files\\dotnet\\host\\fxr\\10.0.11",
        _=>throw new InvalidDataException("RUNTIME_GROUP_REFUSED")};
    internal static void Validate(RuntimeInventory inventory)
    {
        Program.Need(inventory.SchemaVersion==1 && inventory.Runtime=="10.0.11" && inventory.Files is not null &&
            inventory.Files.Length is >=4 and <=512,"RUNTIME_INVENTORY_REFUSED");
        var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var file in inventory.Files!) {
            DirectoryOf(file.Group);
            Program.Need(PlanAdmission.ValidName(file.Name) && file.Size>0 && file.Size<=134217728 &&
                Program.Hex(file.Sha256,64) && seen.Add(file.Group+"/"+file.Name),"RUNTIME_FILE_REFUSED");
        }
        foreach(string required in new[]{"runtime/System.Private.CoreLib.dll","runtime/coreclr.dll","runtime/hostpolicy.dll","fxr/hostfxr.dll"})
            Program.Need(seen.Contains(required),"RUNTIME_REQUIRED_FILE_MISSING");
    }
    internal static void Verify(byte[] bytes)
    {
        var inventory=Program.Parse<RuntimeInventory>(bytes);Validate(inventory);
        VerifyProcessEnvironment();
        Program.Need(Environment.Version.ToString()=="10.0.11" && RuntimeInformation.ProcessArchitecture==Architecture.X64 &&
            Path.GetFullPath(typeof(object).Assembly.Location)==Path.Combine(DirectoryOf("runtime"),"System.Private.CoreLib.dll"),"LOADED_RUNTIME_REFUSED");
        foreach(string group in new[]{"runtime","fxr"}) {
            string directory=DirectoryOf(group);SecureFiles.PlainAncestors(Path.Combine(directory,"probe"));
            var entries=Directory.GetFileSystemEntries(directory);
            var files=inventory.Files.Where(f=>f.Group==group).ToArray();
            Program.Need(entries.Length==files.Length && entries.All(e=>files.Any(f=>f.Name==Path.GetFileName(e))),"RUNTIME_EXTRA_FILE_REFUSED");
            foreach(var file in files) {
                var data=SecureFiles.ReadExternal(Path.Combine(directory,file.Name),134217728);
                Program.Need(data.Length==file.Size && Program.Hash(data)==file.Sha256,"RUNTIME_HASH_REFUSED");
            }
        }
        // This attests the paths/files backing the actual loaded native host
        // modules, not merely other files installed beside the intended runtime.
        // It is a managed, post-start check, not protection against an admin or
        // malicious native code that ran before managed admission.
        using var process=Process.GetCurrentProcess();
        var modules=process.Modules;
        Program.Need(modules.Count is >0 and <=1024,"LOADED_MODULE_COUNT_REFUSED");
        var observed=new List<LoadedRuntimeFile>();
        foreach(ProcessModule module in modules) {
            string name=module.ModuleName;
            if(!NativeNames.Contains(name,StringComparer.OrdinalIgnoreCase))continue;
            string path=module.FileName;
            Program.Need(Path.IsPathFullyQualified(path) &&
                Path.GetFullPath(path).Equals(Path.Combine(DirectoryOf(GroupOf(name)),name),StringComparison.OrdinalIgnoreCase),"LOADED_MODULE_PATH_REFUSED");
            byte[] data=SecureFiles.ReadExternal(path,134217728);
            observed.Add(new(name,path,data.Length,Program.Hash(data)));
        }
        ValidateLoadedFiles(inventory,observed.ToArray());
    }
    internal static void ValidateLoadedFiles(RuntimeInventory inventory,LoadedRuntimeFile[] observed)
    {
        Validate(inventory);
        Program.Need(observed is not null && observed.Length==NativeNames.Length,"LOADED_NATIVE_SET_REFUSED");
        var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var file in observed!) {
            Program.Need(file is not null && NativeNames.Contains(file.Name,StringComparer.OrdinalIgnoreCase) &&
                seen.Add(file.Name) && !string.IsNullOrEmpty(file.Path) && Path.IsPathFullyQualified(file.Path),"LOADED_NATIVE_FILE_REFUSED");
            var expected=inventory.Files.Single(f=>f.Group==GroupOf(file!.Name) && f.Name.Equals(file.Name,StringComparison.OrdinalIgnoreCase));
            Program.Need(Path.GetFullPath(file!.Path).Equals(Path.Combine(DirectoryOf(expected.Group),expected.Name),StringComparison.OrdinalIgnoreCase) &&
                file.Size==expected.Size && file.Sha256==expected.Sha256,"LOADED_NATIVE_BINDING_REFUSED");
        }
    }
    // The loading model is fixed global framework 10.0.11/x64. No runtime
    // overrides (even benign-looking/empty ones) are admitted for this diagnostic.
    // Read-only controller checks happen before reservation/SCM changes, and the
    // service checks its actual inherited process environment again before keys.
    internal static void VerifyControllerEnvironment(){VerifyProcessEnvironment();VerifyRegistryEnvironment();}
    internal static void VerifyServiceEnvironment(){VerifyProcessEnvironment();VerifyRegistryEnvironment();}
    internal static void ValidateEnvironment(KeyValuePair<string,string>[] variables)
    {
        Program.Need(variables is not null && variables.Length<=1024,"RUNTIME_ENV_COUNT_REFUSED");
        int total=0;var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach(var item in variables!) {
            string name=item.Key,value=item.Value;
            bool drive=name is not null && name.Length==3 && name[0]=='=' && char.IsAsciiLetter(name[1]) && name[2]==':';
            Program.Need(!string.IsNullOrEmpty(name) && name.Length<=32767 && name.IndexOf('\0')<0 &&
                (drive || !name.Contains('=')) && value is not null && value.Length<=32767 && value.IndexOf('\0')<0 &&
                names.Add(name),"RUNTIME_ENV_ENTRY_REFUSED");
            total=checked(total+name!.Length+value!.Length+2);
            Program.Need(total<=32767,"RUNTIME_ENV_SIZE_REFUSED");
            Program.Need(!RuntimePrefixes.Any(prefix=>name.StartsWith(prefix,StringComparison.OrdinalIgnoreCase)) &&
                !RuntimeNames.Contains(name,StringComparer.OrdinalIgnoreCase),"RUNTIME_ENV_OVERRIDE_REFUSED");
        }
    }
    internal static KeyValuePair<string,string>[] ParseServiceEnvironment(string[] entries)
    {
        Program.Need(entries is not null && entries.Length<=1024,"SERVICE_ENV_COUNT_REFUSED");
        var result=new List<KeyValuePair<string,string>>();
        foreach(string entry in entries!) {
            Program.Need(entry is not null && entry.Length<=32767,"SERVICE_ENV_ENTRY_REFUSED");
            int split=entry!.IndexOf('=');Program.Need(split>0,"SERVICE_ENV_ENTRY_REFUSED");
            result.Add(new(entry[..split],entry[(split+1)..]));
        }
        var variables=result.ToArray();ValidateEnvironment(variables);return variables;
    }
    private static void VerifyProcessEnvironment()
    {
        var variables=Environment.GetEnvironmentVariables();
        Program.Need(variables.Count<=1024,"RUNTIME_ENV_COUNT_REFUSED");
        var rows=new List<KeyValuePair<string,string>>();
        foreach(System.Collections.DictionaryEntry item in variables) {
            Program.Need(item.Key is string && item.Value is string,"RUNTIME_ENV_TYPE_REFUSED");
            rows.Add(new((string)item.Key,(string)item.Value!));
        }
        ValidateEnvironment(rows.ToArray());
    }
    private static void VerifyRegistryEnvironment()
    {
        Program.Need(OperatingSystem.IsWindows() && Environment.Is64BitProcess,"RUNTIME_ENV_PLATFORM_REFUSED");
        using var hive=RegistryKey.OpenBaseKey(RegistryHive.LocalMachine,RegistryView.Registry64);
        using var machine=hive.OpenSubKey("SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",false);
        Program.Need(machine is not null,"MACHINE_ENV_UNAVAILABLE");
        var names=machine!.GetValueNames();Program.Need(names.Length<=1024,"MACHINE_ENV_COUNT_REFUSED");
        var rows=new List<KeyValuePair<string,string>>();
        foreach(string name in names) {
            var kind=machine.GetValueKind(name);
            Program.Need(kind==RegistryValueKind.String || kind==RegistryValueKind.ExpandString,"MACHINE_ENV_KIND_REFUSED");
            object? value=machine.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames);
            Program.Need(value is string,"MACHINE_ENV_VALUE_REFUSED");rows.Add(new(name,(string)value!));
        }
        ValidateEnvironment(rows.ToArray());
        using var service=hive.OpenSubKey("SYSTEM\\CurrentControlSet\\Services\\"+Launcher.Service,false);
        Program.Need(service is not null,"SERVICE_ENV_UNAVAILABLE");
        var serviceNames=service!.GetValueNames();Program.Need(serviceNames.Length<=128,"SERVICE_ENV_VALUES_REFUSED");
        if(serviceNames.Contains("Environment",StringComparer.OrdinalIgnoreCase)) {
            Program.Need(service.GetValueKind("Environment")==RegistryValueKind.MultiString,"SERVICE_ENV_KIND_REFUSED");
            var value=service.GetValue("Environment",null,RegistryValueOptions.DoNotExpandEnvironmentNames);
            Program.Need(value is string[],"SERVICE_ENV_VALUE_REFUSED");ParseServiceEnvironment((string[])value!);
        }
    }
    internal static int SelfTest()
    {
        int count=0;
        var files=new[]{"runtime/System.Private.CoreLib.dll","runtime/coreclr.dll","runtime/hostpolicy.dll","fxr/hostfxr.dll"}.Select(n=>new RuntimeFile(n.Split('/')[0],n.Split('/')[1],10,new('a',64))).ToArray();
        var good=new RuntimeInventory(1,"10.0.11",files);Validate(good);count++;
        void Reject(RuntimeInventory x){try{Validate(x);}catch(InvalidDataException){count++;return;}throw new Exception("RUNTIME_REFUSAL_MISSING");}
        Reject(good with{SchemaVersion=2});Reject(good with{Runtime="10.0.12"});Reject(good with{Files=files[..3]});
        Reject(good with{Files=files.Concat(new[]{files[0]}).ToArray()});
        foreach(var bad in new[]{files[0] with{Group="other"},files[0] with{Name="../escape"},files[0] with{Size=0},files[0] with{Sha256="bad"},files[0] with{Name="missing.dll"}})
            Reject(good with{Files=new[]{bad}.Concat(files.Skip(1)).ToArray()});
        void Refuse(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new Exception("RUNTIME_BOUNDARY_REFUSAL_MISSING");}
        var loaded=NativeNames.Select(name=>new LoadedRuntimeFile(name,Path.Combine(DirectoryOf(GroupOf(name)),name),10,new('a',64))).ToArray();
        ValidateLoadedFiles(good,loaded);count++;
        ValidateLoadedFiles(good,loaded.Select(f=>f with{Name=f.Name.ToUpperInvariant(),Path=f.Path.ToUpperInvariant()}).ToArray());count++;
        Refuse(()=>ValidateLoadedFiles(good,null!));Refuse(()=>ValidateLoadedFiles(good,loaded[..2]));
        Refuse(()=>ValidateLoadedFiles(good,loaded.Concat(new[]{loaded[0]}).ToArray()));
        Refuse(()=>ValidateLoadedFiles(good,new[]{loaded[0],loaded[0],loaded[2]}));
        foreach(var bad in new[]{loaded[0] with{Name="other.dll"},loaded[0] with{Path="hostfxr.dll"},loaded[0] with{Path="C:\\other\\hostfxr.dll"},
            loaded[0] with{Path=Path.Combine(DirectoryOf("runtime"),"hostfxr.dll")},loaded[0] with{Path=loaded[0].Path.Replace("10.0.11","10.0.1")},
            loaded[0] with{Size=11},loaded[0] with{Sha256=new('b',64)},loaded[0] with{Path=""}})
            Refuse(()=>ValidateLoadedFiles(good,new[]{bad}.Concat(loaded.Skip(1)).ToArray()));
        Refuse(()=>ValidateLoadedFiles(good,new[]{(LoadedRuntimeFile)null!,loaded[1],loaded[2]}));
        KeyValuePair<string,string> Env(string name,string value="")=>new(name,value);
        ValidateEnvironment(Array.Empty<KeyValuePair<string,string>>());count++;
        ValidateEnvironment(new[]{Env("PATH","C:\\Windows"),Env("TEMP","C:\\Temp"),Env("=C:","C:\\Windows")});count++;
        foreach(string name in new[]{"DOTNET_STARTUP_HOOKS","dotnet_additional_deps","DOTNET_SHARED_STORE","DOTNET_ROOT_X64","DOTNET_ROLL_FORWARD",
            "COMPLUS_ReadyToRun","CORECLR_ENABLE_PROFILING","COR_PROFILER","COREHOST_TRACE","APPDOMAIN_MANAGER_ASM","appdomain_manager_type","DEVPATH","__COMPAT_LAYER"})
            Refuse(()=>ValidateEnvironment(new[]{Env(name)}));
        Refuse(()=>ValidateEnvironment(null!));Refuse(()=>ValidateEnvironment(Enumerable.Range(0,1025).Select(i=>Env("V"+i)).ToArray()));
        Refuse(()=>ValidateEnvironment(new[]{Env("PATH"),Env("path")}));Refuse(()=>ValidateEnvironment(new[]{Env("")}));
        Refuse(()=>ValidateEnvironment(new[]{Env("A=B")}));Refuse(()=>ValidateEnvironment(new[]{Env("A\0B")}));
        Refuse(()=>ValidateEnvironment(new[]{Env("A","B\0C")}));Refuse(()=>ValidateEnvironment(new[]{Env("A",null!)}));
        Refuse(()=>ValidateEnvironment(new[]{Env(null!)}));Refuse(()=>ValidateEnvironment(new[]{Env("A",new('x',32767))}));
        var parsed=ParseServiceEnvironment(new[]{"PATH=C:\\Windows","EXAMPLE=A=B","EMPTY="});
        Program.Need(parsed.Length==3 && parsed[1].Value=="A=B" && parsed[2].Value=="","SERVICE_ENV_TEST_FAILED");count++;
        foreach(string[] bad in new[]{new[]{"NO_SEPARATOR"},new[]{"=VALUE"},new[]{"PATH=A","path=B"},new[]{"dotnet_startup_hooks=hook.dll"},new[]{"VALUE=A\0B"},new[]{(string)null!}})
            Refuse(()=>ParseServiceEnvironment(bad));
        Refuse(()=>ParseServiceEnvironment(null!));Refuse(()=>ParseServiceEnvironment(Enumerable.Repeat("A=B",1025).ToArray()));
        return count;
    }
}
