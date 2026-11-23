global using System;
global using System.IO;
global using System.Linq;
global using System.Collections.Generic;
global using System.Diagnostics;
global using System.Runtime.InteropServices;
global using System.Security.Cryptography;
global using System.Security.Principal;
global using System.Security.AccessControl;
global using System.Text;
global using System.Text.Json;
global using System.Text.Json.Serialization;
global using System.Threading;
global using System.Threading.Tasks;
using EntryControl.TestOnly;

namespace EntryControl.TestOnly.Runtime;
internal static class Program
{
    // Build-time capability only; never an owner decision or environment override.
#if TEST_CAPABLE_PILOT
    internal static bool TestCapable=>true;
#else
    internal static bool TestCapable=>false;
#endif
    internal static bool ManagedDiagnostics { get; private set; }
    internal const string Root="C:/ProgramData/Ecs.Lic008.EntryEvidenceV2";
    internal const string Prefix="Ecs.Lic008.EntryEvidenceV2";
    internal const string Provider="Microsoft Software Key Storage Provider";
    internal const string Scope="TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1";
    internal const string SuccessorPacketSha256="8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30";
    internal static readonly JsonSerializerOptions Json=new() {PropertyNamingPolicy=JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling=JsonUnmappedMemberHandling.Disallow};
    internal static void Need(bool valid,string reason){if(!valid)throw new InvalidDataException(reason);}
    internal static string Hash(byte[] b)=>Convert.ToHexString(SHA256.HashData(b)).ToLowerInvariant();
    internal static bool Hex(string? s,int n)=>s is not null && s.Length==n && s.All(c=>"0123456789abcdef".Contains(c));
    internal static byte[] Serialize<T>(T value)=>JsonSerializer.SerializeToUtf8Bytes(value,Json);
    internal static T Parse<T>(byte[] bytes) {
        Need(bytes.Length is >0 and <=2097152,"JSON_SIZE_REFUSED");
        using var doc=JsonDocument.Parse(bytes,new JsonDocumentOptions {MaxDepth=12});
        void Unique(JsonElement e) {if(e.ValueKind==JsonValueKind.Object){var p=e.EnumerateObject().ToArray();
            Need(p.Select(x=>x.Name).Distinct(StringComparer.Ordinal).Count()==p.Length,"DUPLICATE_PROPERTY");foreach(var x in p)Unique(x.Value);}
            else if(e.ValueKind==JsonValueKind.Array)foreach(var x in e.EnumerateArray())Unique(x);}
        Unique(doc.RootElement);return JsonSerializer.Deserialize<T>(bytes,Json)??throw new InvalidDataException("NULL_JSON");
    }
    internal static int Main(string[] args)
    {
        try {
            if(args.SequenceEqual(new[]{"--self-test"})) {
                ManagedDiagnostics=true;
                try{return PlanAdmission.SelfTest();}finally{ManagedDiagnostics=false;}
            }
            if(args.SequenceEqual(new[]{"--inspect-capability"})) {
                Console.WriteLine(JsonSerializer.Serialize(new{scope="TEST_ONLY_PILOT_BUILD_CAPABILITY_V1",
                    physicalEntryEnabled=TestCapable,executionAuthorized=false,physicalTested=false,
                    securityAccepted=false,productionAccepted=false,
                    executorExeSha256=Hash(File.ReadAllBytes(Environment.ProcessPath!)),
                    loadedAssemblySha256=Hash(File.ReadAllBytes(typeof(Program).Assembly.Location))},Json));return 0;
            }
            if(args.Length==3 && args[0]=="--validate-owner-input") {
                Need(Hex(args[1],64) && OwnerAdmission.ValidOwnerSid(args[2]),"OWNER_ENTRY_REFUSED");
                var bytes=ReadBoundedInput(Console.OpenStandardInput());
                var owner=OwnerAdmission.Validate(bytes,args[1],args[2],DateTimeOffset.UtcNow);var plan=owner.Snapshot;
                Console.WriteLine(JsonSerializer.Serialize(new{scope=OwnerAdmission.Scope,ownerDecisionSha256=owner.DecisionSha256,
                    planSha256=Hash(Serialize(plan)),stage=plan.Stage,ownerRecordMatched=true,ownerIdentityAuthenticated=false,
                    readOnly=true,liveContextValidated=false,executionAuthorized=false,physicalEntryEnabled=false,
                    ownerApproved=false,physicalTested=false,securityAccepted=false,productionAccepted=false,
                    executorExeSha256=Hash(File.ReadAllBytes(Environment.ProcessPath!)),loadedAssemblySha256=Hash(File.ReadAllBytes(typeof(Program).Assembly.Location))},Json));return 0;
            }
            if(args.Length==2 && args[0]=="--validate-controller-input") {
                // Pure input validation plus self-artifact hashing only; no
                // protected filesystem, token, service or key APIs.
                Need(Hex(args[1],64),"CONTROLLER_INPUT_PIN_REFUSED");
                var bytes=ReadBoundedInput(Console.OpenStandardInput());
                var plan=ControllerAdmission.ValidateExternal(bytes,args[1]);
                Console.WriteLine(JsonSerializer.Serialize(new{scope=ControllerAdmission.InputScope,
                    inputSha256=Hash(bytes),planSha256=Hash(Serialize(plan)),stage=plan.Stage,
                    readOnly=true,inputValidated=true,liveContextValidated=false,executionAuthorized=false,
                    physicalEntryEnabled=false,ownerApproved=false,physicalTested=false,securityAccepted=false,productionAccepted=false,
                    executorExeSha256=Hash(File.ReadAllBytes(Environment.ProcessPath!)),loadedAssemblySha256=Hash(File.ReadAllBytes(typeof(Program).Assembly.Location))},Json));return 0;
            }
            if(args.SequenceEqual(new[]{"--inspect-host"})) {
                var host=HostAdmission.Capture();Console.WriteLine(JsonSerializer.Serialize(new{scope=HostAdmission.Scope,host,
                    hostBindingSha256=HostAdmission.Digest(host),bootIdentity=NativeTokens.BootIdentity(),
                    executorExeSha256=Hash(File.ReadAllBytes(Environment.ProcessPath!)),loadedAssemblySha256=Hash(File.ReadAllBytes(typeof(Program).Assembly.Location)),
                    readOnly=true,ownerApproved=false,physicalTested=false,securityAccepted=false,productionAccepted=false},Json));return 0;
            }
            // Activation remains closed until exact source/kit review and permission.
            if(!OwnerJournal.CoordinatorReady){Console.Error.WriteLine("PHYSICAL_CONTROLLER_NOT_READY");return 2;}
            return PhysicalEntry.Dispatch(args);
        } catch {Console.Error.WriteLine("PILOT_FAILED_OR_REFUSED");return 2;}
    }
    internal static byte[] ReadBoundedInput(Stream stream)
    {
        using var output=new MemoryStream();byte[] buffer=new byte[8192];int read;
        while((read=stream.Read(buffer,0,buffer.Length))!=0) {
            Need(output.Length+read<=2097152,"CONTROLLER_INPUT_SIZE_REFUSED");output.Write(buffer,0,read);
        }
        Need(output.Length>0,"CONTROLLER_INPUT_EMPTY_REFUSED");return output.ToArray();
    }
}

internal sealed record PhysicalCommand(string Kind,string Target,string ContextPath,string InputPath);
internal static class PhysicalEntry
{
    internal static string LocalFile(string path)
    {
        Program.Need(path.Length is >3 and <260 && char.IsAsciiLetter(path[0]) && path[1]==':' && path[2]=='\\' &&
            !path[3..].Contains(':') && !path.Contains('/') && !path.Any(char.IsControl) && !path.Contains('"') &&
            Path.GetFullPath(path)==path,"EXTERNAL_LOCAL_PATH_REFUSED");
        foreach(string part in path[3..].Split('\\'))Program.Need(part.Length>0 && part is not "." and not ".." &&
            !part.EndsWith('.') && !part.EndsWith(' ') && part.IndexOfAny(Path.GetInvalidFileNameChars())<0 &&
            !new[]{"CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"}.Contains(part.Split('.')[0].TrimEnd().ToUpperInvariant()),"EXTERNAL_COMPONENT_REFUSED");
        return path;
    }
    internal static PhysicalCommand ParseArguments(string[] args)
    {
        if(args.Length==2 && args[0]=="--service" && new[]{"Setup","Guardian","App"}.Contains(args[1]))return new("service",args[1],"","");
        if(args.Length==4 && args[0]=="--child" && args[1]=="Child" && RoleActions.Supports("Child",args[2]) && Program.Hex(args[3],64))return new("child",args[2],"","");
        if(args.Length==4 && args[0]=="--controller" && new[]{"Prepare","VerifyFreshProcess","Finish"}.Contains(args[1])) {
            var c=LocalFile(args[2]);var i=LocalFile(args[3]);
            Program.Need(!c.Equals(i,StringComparison.OrdinalIgnoreCase),"EXTERNAL_INPUT_ALIAS_REFUSED");return new("controller",args[1],c,i);
        }
        throw new InvalidDataException("PHYSICAL_ARGUMENTS_REFUSED");
    }
    internal static int Dispatch(string[] args)
    {
        Program.Need(OwnerJournal.CoordinatorReady,"PHYSICAL_CONTROLLER_NOT_READY");var command=ParseArguments(args);
        if(command.Kind=="service"){ServiceHost.RunRole(command.Target);return 0;}
        if(command.Kind=="child"){ServiceHost.DispatchChild(args);return 0;}
        Program.Need(!Console.IsInputRedirected && !Console.IsOutputRedirected,"OWNER_CONSOLE_REQUIRED");
        var context=SecureFiles.ReadExternal(command.ContextPath,2097152);var input=SecureFiles.ReadExternal(command.InputPath,2097152);
        var c=Program.Parse<OwnerContext>(context);var p=Program.Parse<OwnerAdmissionInput>(input).Input.Plan;PlanAdmission.Validate(p);
        Program.Need(c.Stage==command.Target && p.Stage==command.Target,"EXTERNAL_STAGE_REFUSED");
        PackageBytes[] package=Array.Empty<PackageBytes>();
        if(command.Target=="Prepare") {
            OwnerJournal.VerifySourcePackage(p);
            Program.Need(p.PackageFiles.Sum(f=>f.Size)<=536870912,"EXTERNAL_PACKAGE_SIZE_REFUSED");
            string directory=Path.GetDirectoryName(Environment.ProcessPath!)!;
            package=p.PackageFiles.Select(f=>new PackageBytes(f.Name,SecureFiles.ReadExternal(Path.Combine(directory,f.Name),checked((int)f.Size)))).ToArray();
            package=BootstrapAdmission.SnapshotPackage(p,package);
        }
        string checkpoint=OwnerEntry.Run(context,input,package);
        Console.WriteLine(JsonSerializer.Serialize(new{stage=command.Target,checkpointSha256=checkpoint,securityAccepted=false,productionAccepted=false},Program.Json));return 0;
    }
    internal static int SelfTest()
    {
        int count=0;void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("PHYSICAL_SHAPE_REFUSAL_MISSING");}
        Program.Need(Program.ManagedDiagnostics && !OwnerJournal.CoordinatorReady,"SELF_TEST_NATIVE_GATE_FAILED");count++;
        foreach(string role in new[]{"Setup","Guardian","App"}){Program.Need(ParseArguments(new[]{"--service",role}).Target==role,"SERVICE_SHAPE_FAILED");count++;}
        foreach(string stage in new[]{"Prepare","VerifyFreshProcess","Finish"}) {
            var args=new[]{"--controller",stage,@"E:\review folder\context.json",@"E:\review folder\input.json"};
            Program.Need(ParseArguments(args).Target==stage,"CONTROLLER_SHAPE_FAILED");count++;
            Reject(()=>ParseArguments(args[..3]));Reject(()=>ParseArguments(args.Concat(new[]{"extra"}).ToArray()));Reject(()=>Dispatch(args));
        }
        foreach(string action in new[]{"child-prepare","child-fresh"}){Program.Need(ParseArguments(new[]{"--child","Child",action,new string('a',64)}).Kind=="child","CHILD_SHAPE_FAILED");count++;}
        foreach(string path in new[]{"relative.json",@"C:relative.json",@"\\server\share\file",@"\\?\C:\file",@"C:\folder\..\file",@"C:\folder\file:stream",@"C:\folder\NUL.txt",@"C:\folder\file.",@"C:\folder\file ",@"C:\folder\\file","C:\\folder\\file\n","C:\\folder\\file\"",@"C:\folder\*.json"})Reject(()=>LocalFile(path));
        foreach(var args in new[]{new[]{"--service","Child"},new[]{"--service","Setup","extra"},new[]{"--child","App","child-prepare",new string('a',64)},new[]{"--child","Child","setup-create",new string('a',64)},new[]{"--controller","Finish",@"C:\same.json",@"C:\same.json"},new[]{"--controller","Unknown",@"C:\context.json",@"C:\input.json"}})Reject(()=>ParseArguments(args));
        return count;
    }
}

// Internal composition only. Main/wrapper cannot dispatch here before review.
internal static class OwnerEntry
{
    internal static string[] Effects(string stage)=>stage switch {
        "Prepare"=>new[]{"Create test root and protected owner reservation","Copy reviewed package and register three test services","Run Prepare actions including creation of two test keys"},
        "VerifyFreshProcess"=>new[]{"Retain and verify completed Prepare evidence","Create a new protected owner reservation and stage plan","Run fresh Guardian/App/child checks; retain test state"},
        "Finish"=>new[]{"Retain and verify both completed predecessor stages","Create a new protected owner reservation and stage plan","Run owned test-key deletion and bounded absence checks; retain evidence"},
        _=>throw new InvalidDataException("OWNER_ENTRY_STAGE_REFUSED")};
    // Correlation only; a successful selection is not live confirmation authority.
    internal static OwnerAdmission ValidateSelection(byte[] context,byte[] input,string? selectedSid,string? selectedHash,
        DateTimeOffset now,bool redirectedInput,bool redirectedOutput)
    {
        Program.Need(!redirectedInput && !redirectedOutput && selectedSid is not null &&
            OwnerAdmission.ValidOwnerSid(selectedSid) && Program.Hex(selectedHash,64),"OWNER_REVIEWED_SELECTION_REQUIRED");
        Program.Need(context.Length is >0 and <=2097152 && input.Length is >0 and <=2097152,"OWNER_ENTRY_SIZE_REFUSED");
        var contextBytes=(byte[])context.Clone();var inputBytes=(byte[])input.Clone();
        Program.Need(Program.Hash(contextBytes)==selectedHash,"OWNER_REVIEWED_CONTEXT_HASH_REFUSED");
        var c=Program.Parse<OwnerContext>(contextBytes);
        Program.Need(c.ExpectedOwnerSid==selectedSid,"OWNER_REVIEWED_ACCOUNT_REFUSED");
        var owner=OwnerAdmission.Validate(inputBytes,c.DecisionSha256,selectedSid!,now);
        OwnerJournal.ValidateContext(owner,contextBytes,selectedHash!);return owner;
    }
    private static void RetainedPreflight(OwnerAdmission owner)
    {
        var p=owner.Snapshot;owner.VerifyLiveControllerOwner();HostAdmission.Verify(p);
        Program.Need(NativeTokens.BootIdentity()==p.BootIdentity,"OWNER_ENTRY_BOOT_REFUSED");
        OwnerJournal.VerifySourcePackage(p);OwnerJournal.ReadAndValidatePrior(owner,DateTimeOffset.UtcNow);
        OwnerAdmission.ValidateBootstrapServices(p,new[]{"Setup","Guardian","App"}.Select(ControllerWindows.ReadService).ToArray());
        var files=Directory.GetFileSystemEntries(SecureFiles.PathOf("bin"));
        Program.Need(files.Length==p.PackageFiles.Length && files.All(f=>p.PackageFiles.Any(x=>x.Name==Path.GetFileName(f))),"OWNER_RETAINED_PACKAGE_INVENTORY_REFUSED");
        foreach(var f in p.PackageFiles) {
            var bytes=SecureFiles.Read("bin/"+f.Name,p.GuardianSid,p.AppSid,p,int.MaxValue);
            Program.Need(bytes.LongLength==f.Size && Program.Hash(bytes)==f.Sha256,"OWNER_RETAINED_PACKAGE_REFUSED");
        }
        Program.Need(ControllerWindows.ReadPrevious(p).SharedSha256==ControllerWindows.ReadSharedHash(p),"OWNER_ENTRY_SHARED_CHANGED");
    }
    internal static string Run(byte[] context,byte[] input,PackageBytes[] package)
    {
        Program.Need(OwnerJournal.CoordinatorReady,"OWNER_ENTRY_NOT_READY");
        Program.Need(!Console.IsInputRedirected && !Console.IsOutputRedirected,"OWNER_CONSOLE_REQUIRED");
        Program.Need(context.Length is >0 and <=2097152 && input.Length is >0 and <=2097152,"OWNER_ENTRY_SIZE_REFUSED");
        byte[] contextBytes=(byte[])context.Clone(),inputBytes=(byte[])input.Clone();
        // No default values or expected pins taken from request/CLI/environment.
        // Operator must use their separately reviewed approval/configuration record.
        Console.WriteLine("Use your separately reviewed approval record. Enter the expected owner account SID:");
        string? sid=Console.ReadLine();
        Console.WriteLine("Enter its reviewed owner-context SHA256, not a value copied from the untrusted request:");
        string? hash=Console.ReadLine();
        var owner=ValidateSelection(contextBytes,inputBytes,sid,hash,DateTimeOffset.UtcNow,Console.IsInputRedirected,Console.IsOutputRedirected);
        var p=owner.Snapshot;string planHash=Program.Hash(Program.Serialize(p));
        PackageBytes[] frozen=Array.Empty<PackageBytes>();
        if(p.Stage=="Prepare") {
            frozen=BootstrapAdmission.SnapshotPackage(p,package);
            BootstrapAdmission.AdmitSuccessor(p,planHash,Program.SuccessorPacketSha256);
        } else {Program.Need(package.Length==0,"OWNER_UNEXPECTED_COPY_INPUT");RetainedPreflight(owner);}
        var confirmation=ConfirmedOwnerStage.ConfirmLocal(owner,contextBytes,hash!);
        OwnerReservation reservation;
        if(p.Stage=="Prepare")reservation=BootstrapAdmission.Completion.CreatePublicAndRegister(confirmation,planHash,Program.SuccessorPacketSha256,frozen).Reservation;
        else {
            RetainedPreflight(owner);reservation=OwnerReservation.Create(confirmation);reservation.VerifyLive(owner);
            string file="plans/"+PlanAdmission.PlanFile(p.Stage);var bytes=Program.Serialize(p);
            SecureFiles.Write(file,bytes,"Controller",p.GuardianSid,p.AppSid);
            Program.Need(SecureFiles.Read(file,p.GuardianSid,p.AppSid).SequenceEqual(bytes),"OWNER_STAGE_PLAN_READBACK_REFUSED");
        }
        return ControllerWindows.RunOrderedStage(owner,reservation,planHash,Program.SuccessorPacketSha256);
    }
}
