using Microsoft.Win32.SafeHandles;
using EntryControl.TestOnly.Runtime;
using AccessRule = EntryControl.TestOnly.Runtime.AccessRule;
namespace EntryControl.TestOnly.Diagnostics;

internal sealed record DiagnosticFile(string Name, int Size, string Sha256);
internal sealed record DeploymentManifest(int SchemaVersion, string Scope, DiagnosticFile[] Files);
internal sealed record DiagnosticApproval(int SchemaVersion, string Scope, string OwnerSid,
    string ExperimentId, string PlanSha256, string PackageSha256, string DiagnosticRoot, int ReportSchemaVersion,
    string BootIdentity, string AttemptId,
    DateTimeOffset IssuedUtc, DateTimeOffset ExpiresUtc);
internal sealed record DiagnosticAttempt(int SchemaVersion,string Scope,string ApprovalSha256,string PackageSha256,string AttemptId,string BootIdentity,DateTimeOffset ReservedUtc);

// Native deployment plumbing; CLI admission remains compile-gated by default.
internal sealed class Deployment
{
    internal const string Owner = "S-1-5-21-3058020570-171625005-1532683838-1001";
    internal const string ApprovalScope = "TEST_ONLY_GUARDIAN_SEAL_APPROVAL_V4";
    internal const string PackageScope = "TEST_ONLY_GUARDIAN_SEAL_PACKAGE_V2";
    private static readonly string[] ConsumedAttemptIds = {
        "ae144443de634367b40496e90192f3eb", "a288f62ae7284f979490d225303d7f16"
    };
    private const string S = "S-1-5-18", A = "S-1-5-32-544";
    private const int Full=0x1f01ff,Read=0x120089,ReadExecute=0x1200a9,Modify=0x1301bf;
    private static readonly string[] Names = {"GuardianSealDiagnostic.exe","GuardianSealDiagnostic.dll","GuardianSealDiagnostic.runtimeconfig.json","runtime-inventory.json"};
    private readonly string source;
    private readonly byte[] manifestBytes,approvalBytes;
    private readonly string approvalHash;
    private readonly DeploymentManifest manifest;
    private readonly DiagnosticApproval approval;
    private bool reserved, deployed;
    private DiagnosticAttempt? attempt;
    private WindowsLauncher? launcher;
    private Deployment(string source,byte[] manifestBytes,byte[] approvalBytes,string approvalHash)
    {
        this.source=Path.GetFullPath(source);this.manifestBytes=(byte[])manifestBytes.Clone();this.approvalBytes=(byte[])approvalBytes.Clone();this.approvalHash=approvalHash;
        manifest=Program.Parse<DeploymentManifest>(this.manifestBytes);approval=Program.Parse<DiagnosticApproval>(this.approvalBytes);
    }
    internal static void Validate(DeploymentManifest m,DiagnosticApproval a,string packageHash,DateTimeOffset now)
    {
        Program.Need(m.SchemaVersion==1 && m.Scope==PackageScope && m.Files is not null && m.Files.Length==Names.Length &&
            m.Files.Select(f=>f.Name).SequenceEqual(Names) && m.Files.All(f=>f.Size>0 && f.Size<=33554432 && Program.Hex(f.Sha256,64)),"DEPLOYMENT_MANIFEST_REFUSED");
        Program.Need(a is not null && a.SchemaVersion==4 && a.Scope==ApprovalScope && a.OwnerSid==Owner && a.ExperimentId==NativeDiagnostic.Experiment &&
            a.PlanSha256==NativeDiagnostic.PlanHash && Program.Hex(packageHash,64) && a.PackageSha256==packageHash &&
            string.Equals(a.DiagnosticRoot,NativeDiagnostic.Root,StringComparison.Ordinal) && a.ReportSchemaVersion==NativeDiagnostic.ReportSchemaVersion &&
            Program.Hex(a.BootIdentity,64) && Program.Hex(a.AttemptId,32) && a.AttemptId!=a.ExperimentId && !ConsumedAttemptIds.Contains(a.AttemptId) &&
            now.Offset==TimeSpan.Zero && a.IssuedUtc.Offset==TimeSpan.Zero && a.ExpiresUtc.Offset==TimeSpan.Zero &&
            a.IssuedUtc<=now && now<a.ExpiresUtc && a.ExpiresUtc-a.IssuedUtc<=TimeSpan.FromHours(4),"DEPLOYMENT_APPROVAL_REFUSED");
    }
    internal static string Challenge(string approvalHash,string packageHash) => "CONFIRM GUARDIAN-DIAGNOSTIC "+approvalHash+" "+packageHash;
    // expectedApprovalHash must come from a separately reviewed channel, not the
    // supplied approval file. Only a fresh, non-redirected local confirmation
    // creates an instance. Main permits this only in an explicitly capable build.
    internal static Deployment Confirm(string source,byte[] manifestBytes,byte[] approvalBytes,string expectedApprovalHash)
    {
        Program.Need(Program.Hex(expectedApprovalHash,64) && Program.Hash(approvalBytes)==expectedApprovalHash,"DEPLOYMENT_APPROVAL_HASH_REFUSED");
        var instance=new Deployment(source,manifestBytes,approvalBytes,expectedApprovalHash);
        instance.VerifyInputs();
        Program.Need(!Console.IsInputRedirected && !Console.IsOutputRedirected,"DEPLOYMENT_CONSOLE_REQUIRED");
        Console.WriteLine("TEST ONLY: create new isolated V3 diagnostic directory "+NativeDiagnostic.Root+"; preserve V1/V2 diagnostic folders; temporarily change and start V2 Guardian; restore only after confirmed stop. Only unsupported export observations may continue; UNKNOWN never authorizes seal. No Prepare, key creation/deletion or ACL changes to retained V2.");
        string challenge=Challenge(expectedApprovalHash,Program.Hash(instance.manifestBytes));Console.WriteLine(challenge);
        Program.Need(Console.ReadLine()==challenge,"DEPLOYMENT_CONFIRMATION_REFUSED");
        instance.VerifyInputs();return instance;
    }
    private void VerifyInputs()
    {
        NativeTokens.MatchControllerOwner(NativeTokens.Capture("Controller"),Owner);
        RuntimeCustody.VerifyControllerEnvironment();RuntimeCustody.VerifyServiceEnvironment();
        Program.Need(Path.GetFullPath(Environment.ProcessPath!)==Path.Combine(source,Names[0]) &&
            Path.GetFullPath(typeof(Deployment).Assembly.Location)==Path.Combine(source,Names[1]),"CONTROLLER_PACKAGE_PATH_REFUSED");
        Validate(manifest,approval,Program.Hash(manifestBytes),DateTimeOffset.UtcNow);
        Program.Need(manifestBytes.SequenceEqual(Program.Serialize(manifest)) && approvalBytes.SequenceEqual(Program.Serialize(approval)) &&
            Program.Hash(approvalBytes)==approvalHash && NativeTokens.BootIdentity()==approval.BootIdentity,"DEPLOYMENT_CONTEXT_REFUSED");
        foreach(var file in manifest.Files) {
            byte[] bytes=SecureFiles.ReadExternal(Path.Combine(source,file.Name),33554432);
            Program.Need(bytes.Length==file.Size && Program.Hash(bytes)==file.Sha256,"DEPLOYMENT_SOURCE_HASH_REFUSED");
        }
        RuntimeCustody.Verify(SecureFiles.ReadExternal(Path.Combine(source,"runtime-inventory.json"),2097152));
        var g=NativeTokens.Sid("Guardian");var p=NativeTokens.Sid("App");
        Program.Need(Program.Hash(SecureFiles.Read("plans/prepare.json",g,p))==NativeDiagnostic.PlanHash,"DEPLOYMENT_ORIGINAL_PLAN_REFUSED");
        // Admin-side evidence binding; Guardian does not read Setup's report.
        foreach(var row in new[]{
            ("setup-reports/968ca8f2ad4347c40b38a9339013fd8f.json","29cf987145b78d0306b39414ba2d0e39ac230c171a283a9e158ed3d529d4e015"),
            ("guardian-reports/348e5ea406acc37c1d00f75a54785489.json","5aeb6a7a0a2a73c54997ed8d3cab3ebf6bf2daebb319c61295723e99a4619bc0")}) {
            var plan=Program.Parse<PilotPlan>(SecureFiles.Read("plans/prepare.json",g,p));
            Program.Need(Program.Hash(SecureFiles.Read(row.Item1,g,p,plan))==row.Item2,"DEPLOYMENT_RETAINED_REPORT_REFUSED");
        }
        if(deployed)VerifyInstalled();
    }
    private static AccessRule RootRule()=>new(A,"Controller",new[]{(S,Full),(A,Full),(NativeDiagnostic.Guardian,ReadExecute)},true);
    private static AccessRule ReportsRule()=>new(A,"Controller",new[]{(S,Full),(A,Full),(NativeDiagnostic.Guardian,Modify)},true);
    private static AccessRule FileRule()=>new(A,"Controller",new[]{(S,Full),(A,Full),(NativeDiagnostic.Guardian,ReadExecute)});
    private static AccessRule JournalRule()=>new(A,"Controller",new[]{(S,Full),(A,Full)});
    private static byte[] Descriptor(AccessRule r)
    {
        string flags=r.Directory?"OICI":"";
        var sd=new RawSecurityDescriptor("O:"+r.Owner+"D:P"+string.Concat(r.Aces.Select(a=>$"(A;{flags};0x{a.Mask:x};;;{a.Sid})")));
        var bytes=new byte[sd.BinaryLength];sd.GetBinaryForm(bytes,0);return bytes;
    }
    private static SafeFileHandle Open(string path,bool directory)
    {
        SecureFiles.PlainAncestors(path);
        var sa=new SecurityAttributes{Length=Marshal.SizeOf<SecurityAttributes>()};
        var h=CreateFileW(path,directory?0x20080u:0x80020000u,1,ref sa,3,directory?0x02200000u:0x00200000u,IntPtr.Zero);
        if(h.IsInvalid){h.Dispose();throw new InvalidDataException("DEPLOYMENT_OPEN_REFUSED");}return h;
    }
    private static void CreateDirectory(string path,AccessRule rule)
    {
        SecureFiles.PlainAncestors(path);var bytes=Descriptor(rule);var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try {var sa=new SecurityAttributes{Length=Marshal.SizeOf<SecurityAttributes>(),Descriptor=pin.AddrOfPinnedObject()};
            Program.Need(CreateDirectoryW(path,ref sa),"DEPLOYMENT_DIRECTORY_EXISTS_OR_REFUSED");}
        finally{pin.Free();}
        using var handle=Open(path,true);SecureFiles.Check(handle,rule,path);
    }
    private static void WriteNew(string name,byte[] bytes,AccessRule rule)
    {
        Program.Need(Names.Contains(name) || new[]{"attempt.json","approval.json","package.json","DEPLOYED.json","CONFIGURED.json","WORKER_ENDED.json","RESTORED.json"}.Contains(name),"DEPLOYMENT_FILE_NOT_LISTED");
        string path=Path.Combine(NativeDiagnostic.Root,name);
        using var root=Open(NativeDiagnostic.Root,true);SecureFiles.Check(root,RootRule(),NativeDiagnostic.Root);
        var descriptor=Descriptor(rule);var pin=GCHandle.Alloc(descriptor,GCHandleType.Pinned);SafeFileHandle handle;
        try {var sa=new SecurityAttributes{Length=Marshal.SizeOf<SecurityAttributes>(),Descriptor=pin.AddrOfPinnedObject()};
            handle=CreateFileW(path,0x40020080,0,ref sa,1,0x00200000,IntPtr.Zero);}
        finally{pin.Free();}
        using(handle){Program.Need(!handle.IsInvalid,"DEPLOYMENT_CREATE_NEW_REFUSED");SecureFiles.Check(handle,rule,path);
            using var stream=new FileStream(handle,FileAccess.Write);stream.Write(bytes);stream.Flush(true);SecureFiles.Check(handle,rule,path);}
        SecureFiles.Check(root,RootRule(),NativeDiagnostic.Root);
    }
    private static byte[] ReadFile(string path,AccessRule rule,int maximum)
    {
        using var handle=Open(path,false);SecureFiles.Check(handle,rule,path);
        using var stream=new FileStream(handle,FileAccess.Read);Program.Need(stream.Length>0 && stream.Length<=maximum,"DEPLOYMENT_READ_SIZE_REFUSED");
        var bytes=new byte[(int)stream.Length];stream.ReadExactly(bytes);SecureFiles.Check(handle,rule,path);return bytes;
    }
    private void Reserve()
    {
        Program.Need(!reserved,"DEPLOYMENT_ATTEMPT_REUSED");reserved=true;
        // Root CREATE_NEW is the durable one-attempt reservation. Never remove it
        // automatically, even when writing the reservation journal fails.
        CreateDirectory(NativeDiagnostic.Root,RootRule());
        attempt=new(1,"TEST_ONLY_DIAGNOSTIC_ATTEMPT",approvalHash,Program.Hash(manifestBytes),approval.AttemptId,approval.BootIdentity,DateTimeOffset.UtcNow);
        // Guardian reads this protected correlation record, but cannot modify it.
        WriteNew("attempt.json",Program.Serialize(attempt),FileRule());
    }
    private void Deploy()
    {
        Program.Need(reserved && !deployed,"DEPLOYMENT_STATE_REFUSED");
        foreach(var file in manifest.Files){var bytes=SecureFiles.ReadExternal(Path.Combine(source,file.Name),33554432);
            Program.Need(bytes.Length==file.Size && Program.Hash(bytes)==file.Sha256,"DEPLOYMENT_COPY_HASH_REFUSED");WriteNew(file.Name,bytes,FileRule());}
        WriteNew("package.json",manifestBytes,FileRule());WriteNew("approval.json",approvalBytes,FileRule());
        CreateDirectory(Path.Combine(NativeDiagnostic.Root,"reports"),ReportsRule());
        deployed=true;VerifyInstalled();
    }
    private void VerifyInstalled()
    {
        using var root=Open(NativeDiagnostic.Root,true);SecureFiles.Check(root,RootRule(),NativeDiagnostic.Root);
        foreach(var file in manifest.Files){var bytes=ReadFile(Path.Combine(NativeDiagnostic.Root,file.Name),FileRule(),33554432);
            Program.Need(bytes.Length==file.Size && Program.Hash(bytes)==file.Sha256,"DEPLOYMENT_INSTALLED_HASH_REFUSED");}
        Program.Need(ReadFile(Path.Combine(NativeDiagnostic.Root,"package.json"),FileRule(),32768).SequenceEqual(manifestBytes) &&
            ReadFile(Path.Combine(NativeDiagnostic.Root,"approval.json"),FileRule(),32768).SequenceEqual(approvalBytes),"DEPLOYMENT_RECORD_CHANGED");
        Program.Need(attempt is not null && ReadFile(Path.Combine(NativeDiagnostic.Root,"attempt.json"),FileRule(),32768).SequenceEqual(Program.Serialize(attempt)),"DEPLOYMENT_ATTEMPT_CHANGED");
    }
    private bool ReadReport()
    {
        VerifyInstalled();
        string directory=Path.Combine(NativeDiagnostic.Root,"reports");
        using var parent=Open(directory,true);SecureFiles.Check(parent,ReportsRule(),directory);
        var rule=new AccessRule(NativeDiagnostic.Guardian,"Guardian",new[]{(S,Full),(A,Read),(NativeDiagnostic.Guardian,Modify)});
        var bytes=ReadFile(Path.Combine(directory,"result.json"),rule,32768);
        var result=Program.Parse<DiagnosticReport>(bytes);
        Program.Need(bytes.SequenceEqual(Program.Serialize(result)),"DEPLOYMENT_REPORT_NONCANONICAL");
        NativeDiagnostic.ValidateReport(result,manifest.Files.Single(f=>f.Name=="GuardianSealDiagnostic.dll").Sha256,approval.BootIdentity,
            new ReportBinding(approvalHash,Program.Hash(manifestBytes),approval.AttemptId,attempt!.ReservedUtc),DateTimeOffset.UtcNow,launcher?.ObservedProcessId??0);
        if(launcher?.ObservedProcessStartedUtc is not null)Program.Need(result.ProcessStartedUtc==launcher.ObservedProcessStartedUtc,"DIAGNOSTIC_OBSERVED_START_MISMATCH");
        Console.WriteLine(Encoding.UTF8.GetString(bytes));
        return NativeDiagnostic.CompletedProbe(result);
    }
    // Service-side admission uses separately pinned approval/package hashes.
    // Never manufacture these pins from the untrusted files being checked.
    internal static void RunService(string expectedApprovalHash,string expectedPackageHash)
    {
        Program.Need(Program.Hex(expectedApprovalHash,64) && Program.Hex(expectedPackageHash,64),"SERVICE_DEPLOYMENT_PINS_REFUSED");
        byte[] approved=Array.Empty<byte>(),package=Array.Empty<byte>();
        DiagnosticApproval? a=null;DeploymentManifest? m=null;
        ReportBinding? binding=null;
        void Verify() {
            NativeTokens.Capture("Guardian");
            RuntimeCustody.VerifyControllerEnvironment();RuntimeCustody.VerifyServiceEnvironment();
            using var root=Open(NativeDiagnostic.Root,true);SecureFiles.Check(root,RootRule(),NativeDiagnostic.Root);
            var readApproval=ReadFile(Path.Combine(NativeDiagnostic.Root,"approval.json"),FileRule(),32768);
            var readPackage=ReadFile(Path.Combine(NativeDiagnostic.Root,"package.json"),FileRule(),32768);
            Program.Need(Program.Hash(readApproval)==expectedApprovalHash && Program.Hash(readPackage)==expectedPackageHash,"SERVICE_DEPLOYMENT_HASH_REFUSED");
            var approval=Program.Parse<DiagnosticApproval>(readApproval);var manifest=Program.Parse<DeploymentManifest>(readPackage);
            Validate(manifest,approval,expectedPackageHash,DateTimeOffset.UtcNow);
            Program.Need(readApproval.SequenceEqual(Program.Serialize(approval)) && readPackage.SequenceEqual(Program.Serialize(manifest)) &&
                NativeTokens.BootIdentity()==approval.BootIdentity,"SERVICE_DEPLOYMENT_CONTEXT_REFUSED");
            Program.Need(Path.GetFullPath(Environment.ProcessPath!)==Path.Combine(NativeDiagnostic.Root,Names[0]) &&
                Path.GetFullPath(typeof(Deployment).Assembly.Location)==Path.Combine(NativeDiagnostic.Root,Names[1]),"SERVICE_EXECUTOR_PATH_REFUSED");
            foreach(var file in manifest.Files){var bytes=ReadFile(Path.Combine(NativeDiagnostic.Root,file.Name),FileRule(),33554432);
                Program.Need(bytes.Length==file.Size && Program.Hash(bytes)==file.Sha256,"SERVICE_INSTALLED_HASH_REFUSED");}
            RuntimeCustody.Verify(ReadFile(Path.Combine(NativeDiagnostic.Root,"runtime-inventory.json"),FileRule(),2097152));
            var attemptBytes=ReadFile(Path.Combine(NativeDiagnostic.Root,"attempt.json"),FileRule(),32768);
            var attempt=Program.Parse<DiagnosticAttempt>(attemptBytes);
            Program.Need(attemptBytes.SequenceEqual(Program.Serialize(attempt)) && attempt.SchemaVersion==1 && attempt.Scope=="TEST_ONLY_DIAGNOSTIC_ATTEMPT" &&
                attempt.ApprovalSha256==expectedApprovalHash && attempt.PackageSha256==expectedPackageHash && attempt.AttemptId==approval.AttemptId &&
                attempt.BootIdentity==approval.BootIdentity && attempt.ReservedUtc.Offset==TimeSpan.Zero && attempt.ReservedUtc>=approval.IssuedUtc &&
                attempt.ReservedUtc<approval.ExpiresUtc && attempt.ReservedUtc<=DateTimeOffset.UtcNow,"SERVICE_ATTEMPT_REFUSED");
            var reportBinding=new ReportBinding(expectedApprovalHash,expectedPackageHash,approval.AttemptId,attempt.ReservedUtc);
            if(binding is not null)Program.Need(binding==reportBinding,"SERVICE_ATTEMPT_CHANGED");binding=reportBinding;
            if(a is not null)Program.Need(approved.SequenceEqual(readApproval) && package.SequenceEqual(readPackage),"SERVICE_BINDING_CHANGED");
            a=approval;m=manifest;approved=readApproval;package=readPackage;
        }
        // The SCM callback performs the heavyweight admission after RUNNING is
        // reported; there is no probe/key operation before admission succeeds.
        NativeDiagnostic.DispatchBound(()=>{Verify();return (m!.Files.Single(f=>f.Name==Names[1]).Sha256,a!.BootIdentity,binding!);},Verify);
    }
    internal bool Run(){launcher=new WindowsLauncher(new ServicePins(approvalHash,Program.Hash(manifestBytes)),VerifyInputs,Reserve,Deploy,
        phase=>{Program.Need(new[]{"DEPLOYED","CONFIGURED","WORKER_ENDED","RESTORED"}.Contains(phase),"DEPLOYMENT_PHASE_REFUSED");
            WriteNew(phase+".json",Program.Serialize(new{phase,approvalHash,attemptId=approval.AttemptId,observedPid=launcher?.ObservedProcessId??0,utc=DateTimeOffset.UtcNow}),JournalRule());},ReadReport);
        return Launcher.Run(launcher);}

    internal static int SelfTest()
    {
        int count=0;var now=DateTimeOffset.UnixEpoch;string hash=new('a',64);
        var m=new DeploymentManifest(1,PackageScope,Names.Select(n=>new DiagnosticFile(n,10,hash)).ToArray());
        var a=new DiagnosticApproval(4,ApprovalScope,Owner,NativeDiagnostic.Experiment,NativeDiagnostic.PlanHash,hash,
            NativeDiagnostic.Root,NativeDiagnostic.ReportSchemaVersion,new('b',64),new('d',32),now,now.AddHours(1));
        void Check(bool ok){Program.Need(ok,"DEPLOYMENT_TEST_FAILED");count++;}
        void Reject(DeploymentManifest manifest,DiagnosticApproval approval){try{Validate(manifest,approval,hash,now);}catch(InvalidDataException){count++;return;}throw new Exception("DEPLOYMENT_REFUSAL_MISSING");}
        Validate(m,a,hash,now);count++;
        foreach(var bad in new[]{a with{SchemaVersion=1},a with{Scope="other"},a with{OwnerSid=S},a with{ExperimentId=new('c',32)},a with{PlanSha256=new('c',64)},a with{PackageSha256=new('c',64)},a with{BootIdentity=""},a with{IssuedUtc=now.AddSeconds(1)},a with{ExpiresUtc=now},a with{ExpiresUtc=now.AddHours(5)},a with{AttemptId=""},a with{AttemptId=NativeDiagnostic.Experiment}})Reject(m,bad);
        // Every refusal changes just one binding from a valid successor approval.
        foreach(var bad in new[]{a with{SchemaVersion=2},a with{SchemaVersion=3},
            a with{Scope="TEST_ONLY_GUARDIAN_SEAL_APPROVAL_V1"},a with{Scope="TEST_ONLY_GUARDIAN_SEAL_APPROVAL_V2"},a with{Scope="TEST_ONLY_GUARDIAN_SEAL_APPROVAL_V3"},
            a with{DiagnosticRoot="C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV1"},
            a with{DiagnosticRoot="C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV2"},
            a with{DiagnosticRoot="C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV4"},
            a with{DiagnosticRoot=NativeDiagnostic.Root.ToLowerInvariant()},
            a with{DiagnosticRoot=NativeDiagnostic.Root+"\\"},
            a with{DiagnosticRoot=NativeDiagnostic.Root+"\\..\\Ecs.Lic008.GuardianSealDiagnosticV3"},
            a with{DiagnosticRoot=NativeDiagnostic.Root.Replace('\\','/')},
            a with{DiagnosticRoot=""},a with{DiagnosticRoot=null!},
            a with{ReportSchemaVersion=0},a with{ReportSchemaVersion=1},a with{ReportSchemaVersion=2},a with{ReportSchemaVersion=3},a with{ReportSchemaVersion=5},
            a with{AttemptId="ae144443de634367b40496e90192f3eb"},a with{AttemptId="a288f62ae7284f979490d225303d7f16"}})Reject(m,bad);
        Reject(m,null!);
        Check(NativeDiagnostic.Root=="C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV3" && NativeDiagnostic.ReportSchemaVersion==4);
        var serialized=Program.Serialize(a);var roundTrip=Program.Parse<DiagnosticApproval>(serialized);
        Validate(m,roundTrip,hash,now);
        Check(roundTrip==a && Program.Serialize(roundTrip).SequenceEqual(serialized));
        Reject(m with{SchemaVersion=2},a);Reject(m with{Scope="other"},a);Reject(m with{Files=m.Files.Reverse().ToArray()},a);Reject(m with{Files=m.Files[..2]},a);
        foreach(var file in new[]{m.Files[0] with{Name="../escape"},m.Files[0] with{Size=0},m.Files[0] with{Size=33554433},m.Files[0] with{Sha256="bad"}})Reject(m with{Files=new[]{file}.Concat(m.Files.Skip(1)).ToArray()},a);
        Check(RootRule().Aces.Single(x=>x.Sid==NativeDiagnostic.Guardian).Mask==ReadExecute);
        Check(!JournalRule().Aces.Any(x=>x.Sid==NativeDiagnostic.Guardian));
        Check(Challenge(hash,hash)=="CONFIRM GUARDIAN-DIAGNOSTIC "+hash+" "+hash);
        return count;
    }
    [StructLayout(LayoutKind.Sequential)]private struct SecurityAttributes{internal int Length;internal IntPtr Descriptor;internal int Inherit;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,ref SecurityAttributes attributes,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool CreateDirectoryW(string path,ref SecurityAttributes attributes);
}
