using Microsoft.Win32.SafeHandles;
namespace EntryControl.TestOnly.Runtime;
internal sealed record AccessRule(string Owner,string Creator,(string Sid,int Mask)[] Aces,bool Directory=false);
internal sealed record OwnerContext(
    [property:JsonRequired] int SchemaVersion,
    [property:JsonRequired] string Scope,
    [property:JsonRequired] string ExpectedOwnerSid,
    [property:JsonRequired] string ControllerInputSha256,
    [property:JsonRequired] string SuccessorPacketSha256,
    [property:JsonRequired] string DecisionSha256,
    [property:JsonRequired] string Stage,
    [property:JsonRequired] string ExperimentId);
internal sealed record OwnerConsumed(
    [property:JsonRequired] int SchemaVersion,
    [property:JsonRequired] string Scope,
    [property:JsonRequired] string Stage,
    [property:JsonRequired] string ExperimentId,
    [property:JsonRequired] string DecisionId,
    [property:JsonRequired] string OwnerSid,
    [property:JsonRequired] string OwnerContextSha256,
    [property:JsonRequired] string OwnerDecisionSha256,
    [property:JsonRequired] string ControllerInputSha256,
    [property:JsonRequired] string BindingSha256,
    [property:JsonRequired] string PlanSha256,
    [property:JsonRequired] string SuccessorPacketSha256,
    [property:JsonRequired] string HostBindingSha256,
    [property:JsonRequired] string BootIdentity,
    [property:JsonRequired] string SourceManifestSha256,
    [property:JsonRequired] string ProvenanceSha256,
    [property:JsonRequired] string KitManifestSha256,
    [property:JsonRequired] string PackageManifestSha256,
    [property:JsonRequired] string DependencyInventorySha256,
    [property:JsonRequired] string ProfileSha256,
    [property:JsonRequired] string PreviousCheckpointSha256,
    [property:JsonRequired] string PreviousEvidenceSha256,
    [property:JsonRequired] DateTimeOffset ReservedUtc,
    [property:JsonRequired] string State,
    [property:JsonRequired] string ConfirmationSha256,
    [property:JsonRequired] bool SecurityAccepted,
    [property:JsonRequired] bool ProductionAccepted);
internal static class OwnerJournal
{
    // Historical correlation only: these bytes never create a live execution proof.
    internal sealed record PriorStage(byte[] Plan,byte[] Slot,byte[] Checkpoint,ReportEvidence[] Reports);
    internal static string[] PriorStages(string stage)=>stage switch {
        "Prepare"=>Array.Empty<string>(),"VerifyFreshProcess"=>new[]{"Prepare"},
        "Finish"=>new[]{"Prepare","VerifyFreshProcess"},_=>throw new InvalidDataException("OWNER_HISTORY_STAGE_REFUSED")};
    internal static void ValidatePrior(OwnerAdmission owner,PriorStage[] history,DateTimeOffset now)
    {
        var current=owner.Snapshot;var decision=owner.DecisionSnapshot;var stages=PriorStages(current.Stage);
        Program.Need(history.Length==stages.Length && now.Offset==TimeSpan.Zero,"OWNER_HISTORY_COUNT_REFUSED");
        var ids=new HashSet<string>(StringComparer.Ordinal){decision.DecisionId};
        StageCheckpoint? previous=null;string previousHash="";
        for(int i=0;i<history.Length;i++) {
            var item=history[i];var p=Program.Parse<PilotPlan>(item.Plan);PlanAdmission.Validate(p);
            var r=Program.Parse<OwnerConsumed>(item.Slot);ValidateReadback(item.Slot,r);
            var c=Program.Parse<StageCheckpoint>(item.Checkpoint);
            Program.Need(item.Plan.SequenceEqual(Program.Serialize(p)) && item.Checkpoint.SequenceEqual(Program.Serialize(c)) &&
                p.Stage==stages[i] && p.ExperimentId==current.ExperimentId && StageController.ContextHash(p)==StageController.ContextHash(current) &&
                p.PackageFiles.SequenceEqual(current.PackageFiles),"OWNER_HISTORY_PLAN_REFUSED");
            var binding=new ControllerBinding(p.Stage,p.ExperimentId,Program.Hash(item.Plan),Program.SuccessorPacketSha256,
                p.HostBindingSha256,p.BootIdentity,p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,
                p.PackageManifestSha256,p.DependencyInventorySha256,p.ProfileSha256,p.PreviousCheckpointSha256,p.PreviousEvidenceSha256);
            Program.Need(r.Stage==p.Stage && r.ExperimentId==p.ExperimentId && r.OwnerSid==decision.OwnerSid &&
                Program.Hex(r.DecisionId,32) && ids.Add(r.DecisionId) && r.DecisionId!=p.ExperimentId &&
                !current.PreviousRunIds.Contains(r.DecisionId) && !current.Runs.Any(x=>x.RunId==r.DecisionId) &&
                r.PlanSha256==binding.PlanSha256 && r.SuccessorPacketSha256==binding.SuccessorPacketSha256 &&
                r.BindingSha256==Program.Hash(Program.Serialize(binding)) &&
                r.ControllerInputSha256==Program.Hash(Program.Serialize(new ControllerInput(1,ControllerAdmission.InputScope,p,binding))) &&
                r.HostBindingSha256==p.HostBindingSha256 && r.BootIdentity==p.BootIdentity && r.SourceManifestSha256==p.SourceManifestSha256 &&
                r.ProvenanceSha256==p.ProvenanceSha256 && r.KitManifestSha256==p.KitManifestSha256 && r.PackageManifestSha256==p.PackageManifestSha256 &&
                r.DependencyInventorySha256==p.DependencyInventorySha256 && r.ProfileSha256==p.ProfileSha256 &&
                r.PreviousCheckpointSha256==p.PreviousCheckpointSha256 && r.PreviousEvidenceSha256==p.PreviousEvidenceSha256 &&
                Program.Hex(r.OwnerContextSha256,64) && Program.Hex(r.OwnerDecisionSha256,64),"OWNER_HISTORY_SLOT_REFUSED");
            var context=new OwnerContext(1,ContextScope,r.OwnerSid,r.ControllerInputSha256,r.SuccessorPacketSha256,r.OwnerDecisionSha256,r.Stage,r.ExperimentId);
            Program.Need(r.OwnerContextSha256==Program.Hash(Program.Serialize(context)) &&
                r.ConfirmationSha256==Program.Hash(Encoding.UTF8.GetBytes(Challenge(context,r.OwnerContextSha256))),"OWNER_HISTORY_CONFIRMATION_REFUSED");
            Program.Need(p.PreviousCheckpointSha256==previousHash && p.PreviousEvidenceSha256==(previous?.EvidenceSha256??"") &&
                p.PreviousRunIds.SequenceEqual(previous?.RunIds??Array.Empty<string>()) &&
                c.Stage==p.Stage && c.ExperimentId==p.ExperimentId && c.PlanSha256==binding.PlanSha256 &&
                c.ContextSha256==StageController.ContextHash(p) && c.PreviousCheckpointSha256==previousHash &&
                c.RunIds is not null && c.RunIds.SequenceEqual(p.PreviousRunIds.Concat(p.Runs.Select(x=>x.RunId))) &&
                Program.Hex(c.SharedSha256,64) && (previous is null || c.SharedSha256==previous.SharedSha256) &&
                c.LastEndedUtc.Offset==TimeSpan.Zero && r.ReservedUtc<=c.LastEndedUtc && c.LastEndedUtc<=now &&
                (previous is null || previous.LastEndedUtc<=r.ReservedUtc) && !c.SecurityAccepted && !c.ProductionAccepted,
                "OWNER_HISTORY_COMPLETION_REFUSED");
            Program.Need(item.Reports.Length==p.Runs.Length && item.Reports.Select(x=>x.RunId).SequenceEqual(p.Runs.Select(x=>x.RunId)) &&
                item.Reports.All(x=>x.Bytes.Length is >0 and <=2097152 && Program.Hash(x.Bytes)==x.Sha256) &&
                c.EvidenceSha256==Program.Hash(Program.Serialize(item.Reports.Select(x=>new{x.RunId,x.Sha256}).ToArray())),"OWNER_HISTORY_EVIDENCE_REFUSED");
            previous=c;previousHash=Program.Hash(item.Checkpoint);
        }
        Program.Need(current.PreviousCheckpointSha256==previousHash && current.PreviousEvidenceSha256==(previous?.EvidenceSha256??"") &&
            current.PreviousRunIds.SequenceEqual(previous?.RunIds??Array.Empty<string>()),"OWNER_HISTORY_TIP_REFUSED");
    }
    internal static void ReadAndValidatePrior(OwnerAdmission owner,DateTimeOffset now)
    {
        var p=owner.Snapshot;
        var history=PriorStages(p.Stage).Select(stage=>{
            var planBytes=SecureFiles.Read("plans/"+PlanAdmission.PlanFile(stage),p.GuardianSid,p.AppSid);
            var prior=Program.Parse<PilotPlan>(planBytes);PlanAdmission.Validate(prior);
            return new PriorStage(planBytes,SecureFiles.Read(FileOf(stage),p.GuardianSid,p.AppSid),
                SecureFiles.Read(ControllerWindows.CheckpointFile(stage),p.GuardianSid,p.AppSid),ControllerWindows.ReadReports(prior));
        }).ToArray();
        ValidatePrior(owner,history,now);
    }
    internal const string ContextScope="TEST_ONLY_OWNER_CONFIRMATION_CONTEXT_V1";
    internal const string Scope="TEST_ONLY_OWNER_STAGE_CONSUMED_V1";
    internal static bool CoordinatorReady=>Program.TestCapable && !Program.ManagedDiagnostics;
    internal static IReadOnlyList<string> Slots {get;}=Array.AsReadOnly(new[]{
        "controller/owner-prepare-consumed.json","controller/owner-fresh-process-consumed.json","controller/owner-finish-consumed.json"});
    internal static string FileOf(string stage)=>stage switch {
        "Prepare"=>Slots[0],"VerifyFreshProcess"=>Slots[1],"Finish"=>Slots[2],_=>throw new InvalidDataException("OWNER_SLOT_REFUSED")};
    internal static string Challenge(OwnerContext c,string contextHash)=>
        "CONFIRM "+c.Stage+" "+c.ExperimentId+" "+c.ControllerInputSha256+" "+contextHash;
    internal static void RequireChallenge(string? response,string expected,bool redirectedInput,bool redirectedOutput)=>
        Program.Need(!redirectedInput && !redirectedOutput && response==expected,"OWNER_CONFIRMATION_REFUSED");
    internal static void VerifySourcePackage(PilotPlan p)
    {
        string directory=Path.GetDirectoryName(Environment.ProcessPath!)!;
        Program.Need(Path.GetFileName(Environment.ProcessPath)=="EntryControl.AdapterPilot.exe" &&
            Path.GetFullPath(typeof(Program).Assembly.Location)==Path.Combine(directory,"EntryControl.AdapterPilot.dll") &&
            Path.GetFullPath(typeof(object).Assembly.Location)==Path.Combine(directory,"System.Private.CoreLib.dll") &&
            Environment.Version.ToString()=="10.0.11" && RuntimeInformation.ProcessArchitecture==Architecture.X64,"OWNER_SOURCE_PACKAGE_CONTEXT_REFUSED");
        var files=Directory.GetFileSystemEntries(directory);
        Program.Need(files.Length==p.PackageFiles.Length && files.All(f=>p.PackageFiles.Any(e=>e.Name==Path.GetFileName(f))) &&
            p.PackageFiles.Sum(f=>f.Size)<=536870912,"OWNER_SOURCE_PACKAGE_INVENTORY_REFUSED");
        foreach(var row in p.PackageFiles) {
            string path=Path.Combine(directory,row.Name);SecureFiles.PlainAncestors(path);
            Program.Need((File.GetAttributes(path)&(FileAttributes.ReparsePoint|FileAttributes.Directory))==0,"OWNER_SOURCE_PACKAGE_KIND_REFUSED");
            using var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);
            Program.Need(stream.Length==row.Size,"OWNER_SOURCE_PACKAGE_SIZE_REFUSED");
            Program.Need(Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant()==row.Sha256,"OWNER_SOURCE_PACKAGE_HASH_REFUSED");
        }
    }
    internal static OwnerContext ValidateContext(OwnerAdmission owner,byte[] input,string expectedHash)
    {
        Program.Need(input.Length is >0 and <=2097152 && Program.Hex(expectedHash,64),"OWNER_CONTEXT_REFUSED");
        byte[] bytes=(byte[])input.Clone();
        Program.Need(Program.Hash(bytes)==expectedHash,"OWNER_CONTEXT_HASH_REFUSED");
        var c=Program.Parse<OwnerContext>(bytes);var p=owner.Snapshot;var d=owner.DecisionSnapshot;
        Program.Need(bytes.SequenceEqual(Program.Serialize(c)) && c.SchemaVersion==1 && c.Scope==ContextScope &&
            c.ExpectedOwnerSid==d.OwnerSid && c.ControllerInputSha256==d.ControllerInputSha256 &&
            c.SuccessorPacketSha256==Program.SuccessorPacketSha256 && c.DecisionSha256==owner.DecisionSha256 &&
            c.Stage==p.Stage && c.ExperimentId==p.ExperimentId,"OWNER_CONTEXT_BINDING_REFUSED");
        return c;
    }
    internal static OwnerConsumed Build(OwnerAdmission owner,string contextHash,string confirmationHash,DateTimeOffset now)
    {
        var p=owner.Snapshot;var d=owner.DecisionSnapshot;PlanAdmission.Validate(p);
        Program.Need(Program.Hex(contextHash,64) && Program.Hex(confirmationHash,64) && now.Offset==TimeSpan.Zero &&
            d.IssuedUtc.Offset==TimeSpan.Zero && d.ExpiresUtc.Offset==TimeSpan.Zero && d.IssuedUtc<=now && now<d.ExpiresUtc &&
            d.ExpiresUtc-d.IssuedUtc<=TimeSpan.FromHours(24),"OWNER_RESERVATION_TIME_REFUSED");
        return new(1,Scope,p.Stage,p.ExperimentId,d.DecisionId,d.OwnerSid,contextHash,owner.DecisionSha256,
            d.ControllerInputSha256,d.BindingSha256,Program.Hash(Program.Serialize(p)),Program.SuccessorPacketSha256,
            p.HostBindingSha256,p.BootIdentity,p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,
            p.PackageManifestSha256,p.DependencyInventorySha256,p.ProfileSha256,p.PreviousCheckpointSha256,
            p.PreviousEvidenceSha256,now,"RESERVED",confirmationHash,false,false);
    }
    internal static OwnerConsumed ValidateReadback(byte[] bytes,OwnerConsumed expected)
    {
        Program.Need(bytes.Length is >0 and <=2097152,"OWNER_RESERVATION_SIZE_REFUSED");
        var r=Program.Parse<OwnerConsumed>((byte[])bytes.Clone());
        Program.Need(r.SchemaVersion==1 && r.Scope==Scope && r.State=="RESERVED" && !r.SecurityAccepted && !r.ProductionAccepted &&
            r.ReservedUtc.Offset==TimeSpan.Zero && r.OwnerSid is not null && OwnerAdmission.ValidOwnerSid(r.OwnerSid) &&
            bytes.SequenceEqual(Program.Serialize(expected)) && r==expected,"OWNER_RESERVATION_READBACK_REFUSED");
        FileOf(r.Stage);return r;
    }
}
// Only direct successful console confirmation creates this proof. The future
// entry must obtain expectedHash from the separately owner-reviewed channel.
internal sealed class ConfirmedOwnerStage
{
    internal OwnerAdmission Owner {get;}
    internal string ContextHash {get;}
    internal string ConfirmationHash {get;}
    private bool reservationAttempted;
    internal void BeginReservation() {lock(this){Program.Need(!reservationAttempted,"OWNER_RESERVATION_ALREADY_ATTEMPTED_RETAIN");reservationAttempted=true;}}
    private ConfirmedOwnerStage(OwnerAdmission owner,string contextHash,string challengeHash)
    {Owner=owner;ContextHash=contextHash;ConfirmationHash=challengeHash;}
    internal static ConfirmedOwnerStage ConfirmLocal(OwnerAdmission owner,byte[] context,string expectedHash)
    {
        var c=OwnerJournal.ValidateContext(owner,context,expectedHash);var p=owner.Snapshot;
        void Live() {
            owner.VerifyLiveControllerOwner();HostAdmission.Verify(p);
            Program.Need(NativeTokens.BootIdentity()==p.BootIdentity,"OWNER_CONFIRMATION_BOOT_REFUSED");
            OwnerJournal.VerifySourcePackage(p);
            OwnerJournal.Build(owner,expectedHash,new string('a',64),DateTimeOffset.UtcNow);
        }
        Program.Need(!Console.IsInputRedirected && !Console.IsOutputRedirected,"OWNER_CONSOLE_REQUIRED");Live();
        string challenge=OwnerJournal.Challenge(c,expectedHash);
        Console.WriteLine(JsonSerializer.Serialize(new{scope=OwnerJournal.ContextScope,context=c,contextHash=expectedHash,
            planSha256=Program.Hash(Program.Serialize(p)),host=p.HostBindingSha256,boot=p.BootIdentity,
            source=p.SourceManifestSha256,package=p.PackageManifestSha256,kit=p.KitManifestSha256,
            stage=p.Stage,stageEffects=OwnerEntry.Effects(p.Stage),physicalExecutionEnabled=Program.TestCapable,
            securityAccepted=false,productionAccepted=false},Program.Json));
        Console.WriteLine(challenge);
        OwnerJournal.RequireChallenge(Console.ReadLine(),challenge,Console.IsInputRedirected,Console.IsOutputRedirected);Live();
        return new(owner,expectedHash,Program.Hash(Encoding.UTF8.GetBytes(challenge)));
    }
}
// A stored record or supplied DTO cannot manufacture this native readback proof.
// Coordinator handoff is same-object and single-attempt; physical routes stay closed.
internal sealed class OwnerReservation
{
    private readonly OwnerAdmission owner;
    private readonly OwnerConsumed record;
    private bool stageAttempted;
    internal string PlanSha256 {get;}
    internal string RecordSha256 {get;}
    internal string Stage {get;}
    private OwnerReservation(OwnerAdmission owner,OwnerConsumed record,byte[] bytes)
    {this.owner=owner;this.record=record;PlanSha256=record.PlanSha256;RecordSha256=Program.Hash(bytes);Stage=record.Stage;}
    internal void RequireBinding(OwnerAdmission input)
    {
        Program.Need(ReferenceEquals(owner,input) && PlanSha256==Program.Hash(Program.Serialize(input.Snapshot)) &&
            Stage==input.Snapshot.Stage && record.OwnerDecisionSha256==input.DecisionSha256,"OWNER_RESERVATION_HANDOFF_REFUSED");
    }
    internal void BeginStage(OwnerAdmission input)
    {
        lock(this) {RequireBinding(input);Program.Need(!stageAttempted,"OWNER_STAGE_ALREADY_ATTEMPTED_RETAIN");stageAttempted=true;}
    }
    internal void VerifyLive(OwnerAdmission input)
    {
        RequireBinding(input);var p=input.Snapshot;input.VerifyLiveControllerOwner();HostAdmission.Verify(p);
        Program.Need(NativeTokens.BootIdentity()==p.BootIdentity,"OWNER_RESERVATION_BOOT_REFUSED");
        OwnerJournal.VerifySourcePackage(p);
        OwnerJournal.Build(input,record.OwnerContextSha256,record.ConfirmationSha256,DateTimeOffset.UtcNow);
        var bytes=SecureFiles.Read(OwnerJournal.FileOf(Stage),p.GuardianSid,p.AppSid);
        OwnerJournal.ValidateReadback(bytes,record);
        Program.Need(Program.Hash(bytes)==RecordSha256,"OWNER_RESERVATION_CHANGED_RETAIN");
        OwnerJournal.ReadAndValidatePrior(input,DateTimeOffset.UtcNow);
    }
    internal static OwnerReservation Create(ConfirmedOwnerStage confirmation)
    {
        var owner=confirmation.Owner;var p=owner.Snapshot;owner.VerifyLiveControllerOwner();HostAdmission.Verify(p);
        Program.Need(NativeTokens.BootIdentity()==p.BootIdentity,"OWNER_RESERVATION_BOOT_REFUSED");
        OwnerJournal.VerifySourcePackage(p);
        OwnerJournal.ReadAndValidatePrior(owner,DateTimeOffset.UtcNow);
        var record=OwnerJournal.Build(owner,confirmation.ContextHash,confirmation.ConfirmationHash,DateTimeOffset.UtcNow);
        byte[] bytes=Program.Serialize(record);string slot=OwnerJournal.FileOf(p.Stage);
        // CREATE_NEW with zero sharing/protected descriptor, same-handle checks,
        // Flush(true), close, independent protected readback. Never retry/delete.
        confirmation.BeginReservation();var readback=SecureFiles.WriteOwnerSlotWithReadback(slot,bytes,p);
        OwnerJournal.ValidateReadback(readback,record);return new(owner,record,readback);
    }
    // Managed fixtures never escape this test method or enter any native method.
    internal static int SelfTest(OwnerAdmission owner,OwnerAdmission other,OwnerConsumed record)
    {
        int count=0;void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("RESERVATION_HANDOFF_REFUSAL_MISSING");}
        var proof=new OwnerReservation(owner,record,Program.Serialize(record));
        proof.RequireBinding(owner);count++;Reject(()=>proof.RequireBinding(other));
        Reject(()=>proof.BeginStage(other));proof.BeginStage(owner);count++;Reject(()=>proof.BeginStage(owner));
        var raced=new OwnerReservation(owner,record,Program.Serialize(record));int wins=0,refused=0;
        Parallel.For(0,8,_=>{try{raced.BeginStage(owner);Interlocked.Increment(ref wins);}catch(InvalidDataException){Interlocked.Increment(ref refused);}});
        Program.Need(wins==1 && refused==7,"RESERVATION_RACE_FAILED");count++;
        Reject(()=>new OwnerReservation(owner,record with {PlanSha256=new string('f',64)},Program.Serialize(record)).RequireBinding(owner));
        Reject(()=>new OwnerReservation(owner,record with {Stage="Unknown"},Program.Serialize(record)).RequireBinding(owner));
        Reject(()=>new OwnerReservation(owner,record with {OwnerDecisionSha256=new string('f',64)},Program.Serialize(record)).RequireBinding(owner));
        return count;
    }
}
internal static class SecureFiles
{
    private const int F=0x1f01ff,M=0x1301bf,R=0x120089,RD=0x1200a9;
    private const string S="S-1-5-18",A="S-1-5-32-544";
    internal static byte[] WriteOwnerSlotWithReadback(string slot,byte[] bytes,PilotPlan plan)
    {
        Program.Need(slot==OwnerJournal.FileOf(plan.Stage),"OWNER_SLOT_STAGE_REFUSED");
        string parentPath=PathOf("controller");PlainAncestors(parentPath);
        var parentRule=Rule("controller",plan.GuardianSid,plan.AppSid,directory:true);
        using var parent=Open(parentPath,0x20080,3,true);Check(parent,parentRule,parentPath);
        Write(slot,bytes,"Controller",plan.GuardianSid,plan.AppSid);Check(parent,parentRule,parentPath);
        var readback=Read(slot,plan.GuardianSid,plan.AppSid);Check(parent,parentRule,parentPath);return readback;
    }
    internal static string PathOf(string relative) {
        Program.Need(!relative.Contains('\\') && !relative.Contains(':') &&
            !relative.Split('/').Any(x=>x is "." or "..") && !relative.StartsWith('/'),"PATH_REFUSED");
        string root=Path.GetFullPath(Program.Root),path=Path.GetFullPath(Path.Combine(root,relative));
        Program.Need(path==root || path.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase),"PATH_ESCAPE");return path;
    }
    internal static void PlainAncestors(string path)
    {
        string? cursor=Path.GetDirectoryName(Path.GetFullPath(path));
        while(cursor is not null){var attr=File.GetAttributes(cursor);Program.Need((attr&FileAttributes.ReparsePoint)==0,"REPARSE_ANCESTOR");cursor=Path.GetDirectoryName(cursor);}
    }
    internal static AccessRule Rule(string relative,string g,string p,PilotPlan? plan=null,bool directory=false)
    {
        (string,int)[] Public(int gr)=>new[]{(S,F),(A,F),(g,gr),(p,gr)};
        if(directory)return relative switch {
            "" or "bin" or "plans"=>new(A,"Controller",Public(RD),true),
            "controller"=>new(A,"Controller",new[]{(S,F),(A,F)},true),
            "shared"=>new(S,"Setup",Public(RD),true),
            "protected"=>new(S,"Setup",new[]{(S,F),(g,RD)},true),
            "guardian-work"=>new(S,"Setup",new[]{(S,F),(g,M)},true),
            "setup-reports"=>new(A,"Controller",new[]{(S,F),(A,RD)},true),
            "guardian-reports"=>new(A,"Controller",new[]{(S,F),(A,RD),(g,M)},true),
            "app-reports"=>new(A,"Controller",new[]{(S,F),(A,RD),(p,M)},true),
            _=>throw new InvalidDataException("DIRECTORY_NOT_LISTED")};
        var parts=relative.Split('/');Program.Need(parts.Length==2,"FILE_NOT_LISTED");string folder=parts[0],name=parts[1];
        bool Envelope()=>new[]{"restricted-envelope.bin","app-readable-envelope.bin","restricted-expected-hash.json","app-readable-expected-hash.json"}.Contains(name);
        if(folder=="protected" && new[]{"restricted-intent.json","app-readable-intent.json","restricted-owned.json","app-readable-owned.json"}.Contains(name))return new(S,"Setup",new[]{(S,F),(g,R)});
        if(folder=="shared" && (name=="public-control.json" || Envelope()))return new(S,"Setup",new[]{(S,F),(A,R),(g,R),(p,R)});
        if(folder=="guardian-work" && Envelope())return new(g,"Guardian",new[]{(S,F),(g,M)});
        if(folder=="plans" && new[]{"prepare.json","fresh-process.json","finish.json"}.Contains(name))return new(A,"Controller",Public(R));
        if(folder=="controller" && (new[]{"run-admission.json","prepare-checkpoint.json","fresh-process-checkpoint.json","finish-checkpoint.json","final-summary.json"}.Contains(name) || OwnerJournal.Slots.Contains(relative)))return new(A,"Controller",new[]{(S,F),(A,F)});
        if(folder=="bin" && plan is not null && plan.PackageFiles.Any(f=>f.Name==name))return new(A,"Controller",Public(RD));
        if(plan is not null && name.EndsWith(".json",StringComparison.Ordinal)) {
            var run=plan.Runs.SingleOrDefault(r=>r.RunId+".json"==name);
            if(run is not null) {
                if(folder=="setup-reports" && run.Role=="Setup")return new(S,"Setup",new[]{(S,F),(A,R)});
                if(folder=="guardian-reports" && run.Role=="Guardian")return new(g,"Guardian",new[]{(S,F),(A,R),(g,M)});
                if(folder=="app-reports" && run.Role is "App" or "Child")return new(p,run.Role,new[]{(S,F),(A,R),(p,M)});
            }
        }
        throw new InvalidDataException("FILE_NOT_LISTED");
    }
    private static byte[] Descriptor(AccessRule r) {
        string flags=r.Directory?"OICI":"";string sddl="O:"+r.Owner+"D:P"+
            string.Concat(r.Aces.Select(a=>$"(A;{flags};0x{a.Mask:x};;;{a.Sid})"));
        var sd=new RawSecurityDescriptor(sddl);var bytes=new byte[sd.BinaryLength];sd.GetBinaryForm(bytes,0);return bytes;
    }
    private static void CheckPlainHandle(SafeFileHandle handle,bool directory,string expectedPath)
    {
        Program.Need(GetFileInformationByHandle(handle,out var info),"FILE_INFO_FAILED");
        Program.Need((info.Attributes&0x400)==0 && ((info.Attributes&0x10)!=0)==directory,"FILE_KIND_REFUSED");
        var final=new StringBuilder(32768);uint n=GetFinalPathNameByHandleW(handle,final,(uint)final.Capacity,0);
        Program.Need(n>0 && n<final.Capacity && final.ToString().Equals("\\\\?\\"+Path.GetFullPath(expectedPath),StringComparison.OrdinalIgnoreCase),"HANDLE_PATH_REFUSED");
    }
    // External bytes have no protected-store authority; owner context pins bind them later.
    internal static byte[] ReadExternal(string path,int maximum)
    {
        PhysicalEntry.LocalFile(path);Program.Need(maximum is >0 and <=536870912,"EXTERNAL_READ_BOUND_REFUSED");PlainAncestors(path);
        using var handle=Open(path,0x80000000,3,false);CheckPlainHandle(handle,false,path);
        using var stream=new FileStream(handle,FileAccess.Read);
        Program.Need(stream.Length is >0 && stream.Length<=maximum,"EXTERNAL_READ_SIZE_REFUSED");
        var bytes=new byte[checked((int)stream.Length)];stream.ReadExactly(bytes);
        Program.Need(stream.Length==bytes.LongLength,"EXTERNAL_READ_CHANGED");CheckPlainHandle(handle,false,path);return bytes;
    }
    internal static void Check(SafeFileHandle handle,AccessRule rule,string expectedPath)
    {
        CheckPlainHandle(handle,rule.Directory,expectedPath);
        uint status=GetSecurityInfo(handle,1,5,out _,out _,out _,out _,out var pointer);
        Program.Need(status==0 && pointer!=IntPtr.Zero,"SECURITY_QUERY_FAILED");
        try {
            int length=checked((int)GetSecurityDescriptorLength(pointer));Program.Need(length is >0 and <=65536,"DESCRIPTOR_SIZE_REFUSED");
            var bytes=new byte[length];Marshal.Copy(pointer,bytes,0,length);var sd=new RawSecurityDescriptor(bytes,0);
            Program.Need(sd.Owner?.Value==rule.Owner && sd.ControlFlags.HasFlag(ControlFlags.DiscretionaryAclProtected) &&
                sd.DiscretionaryAcl is not null && sd.DiscretionaryAcl.Count==rule.Aces.Length,"OWNER_DACL_REFUSED");
            var seen=new HashSet<string>(StringComparer.Ordinal);
            foreach(GenericAce raw in sd.DiscretionaryAcl!) {
                Program.Need(raw is CommonAce,"ACE_TYPE_REFUSED");var ace=(CommonAce)raw;
                Program.Need(!ace.IsCallback && ace.AceQualifier==AceQualifier.AccessAllowed &&
                    (byte)ace.AceFlags==(rule.Directory?3:0) && seen.Add(ace.SecurityIdentifier.Value) &&
                    rule.Aces.Contains((ace.SecurityIdentifier.Value,ace.AccessMask)),"ACE_RIGHTS_REFUSED");
            }
        } finally {LocalFree(pointer);}
    }
    internal static void CreateDirectory(string relative,string role,string g,string p)
    {
        var rule=Rule(relative,g,p,directory:true);Program.Need(rule.Creator==role,"CREATOR_REFUSED");NativeTokens.Capture(role);
        string path=PathOf(relative);PlainAncestors(path);var bytes=Descriptor(rule);var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try {var sa=new SecurityAttributes {Length=Marshal.SizeOf<SecurityAttributes>(),Descriptor=pin.AddrOfPinnedObject(),Inherit=0};
            Program.Need(CreateDirectoryW(path,ref sa),"DIRECTORY_CREATE_NEW_FAILED");}
        finally {pin.Free();}
        using var handle=Open(path,0x20080,3,true);Check(handle,rule,path);
    }
    internal static byte[] Read(string relative,string g,string p,PilotPlan? plan=null,int maximum=2097152)
    {
        var rule=Rule(relative,g,p,plan);string path=PathOf(relative);PlainAncestors(path);
        using var handle=Open(path,0x80000000|0x20000,3,false);Check(handle,rule,path);
        using var stream=new FileStream(handle,FileAccess.Read);Program.Need(stream.Length is >0 && stream.Length<=maximum,"FILE_SIZE_REFUSED");
        var bytes=new byte[checked((int)stream.Length)];stream.ReadExactly(bytes);Check(handle,rule,path);return bytes;
    }
    internal static void RequireNewReport(PilotPlan plan,Run run)
    {
        NativeTokens.Capture("Controller");string relative=ControllerWindows.ReportFile(run);
        Rule(relative,plan.GuardianSid,plan.AppSid,plan);string path=PathOf(relative);PlainAncestors(path);
        string folder=relative.Split('/')[0];var parentRule=Rule(folder,plan.GuardianSid,plan.AppSid,directory:true);
        using var parent=Open(PathOf(folder),0x20080,3,true);Check(parent,parentRule,PathOf(folder));
        var attributes=new SecurityAttributes {Length=Marshal.SizeOf<SecurityAttributes>()};
        using var probe=CreateFileW(path,0x80,7,ref attributes,3,0x02200000,IntPtr.Zero);int error=Marshal.GetLastWin32Error();
        Program.Need(probe.IsInvalid && error==2,"REPORT_ALREADY_PRESENT_OR_UNKNOWN");
        Check(parent,parentRule,PathOf(folder)); // absence is only preflight, not a lock
    }
    internal static void Write(string relative,byte[] bytes,string role,string g,string p,PilotPlan? plan=null)
    {
        var rule=Rule(relative,g,p,plan);Program.Need(rule.Creator==role && !rule.Directory,"CREATOR_REFUSED");NativeTokens.Capture(role);
        string path=PathOf(relative);PlainAncestors(path);Program.Need(bytes.Length is >0 and <=2097152 || relative.StartsWith("bin/",StringComparison.Ordinal),"WRITE_SIZE_REFUSED");
        var descriptor=Descriptor(rule);var pin=GCHandle.Alloc(descriptor,GCHandleType.Pinned);
        SafeFileHandle handle;
        try {var sa=new SecurityAttributes {Length=Marshal.SizeOf<SecurityAttributes>(),Descriptor=pin.AddrOfPinnedObject(),Inherit=0};
            handle=CreateFileW(path,0x40000000|0x20000|0x80,0,ref sa,1,0x00200000,IntPtr.Zero);}
        finally {pin.Free();}
        using(handle){Program.Need(!handle.IsInvalid,"FILE_CREATE_NEW_FAILED");Check(handle,rule,path);
            using var stream=new FileStream(handle,FileAccess.Write);stream.Write(bytes);stream.Flush(true);Check(handle,rule,path);}
    }
    internal sealed class ReportJournal : IDisposable
    {
        private readonly FileStream stream;private readonly AccessRule rule;private readonly string path;
        internal ReportJournal(SafeFileHandle handle,AccessRule rule,string path){this.rule=rule;this.path=path;stream=new FileStream(handle,FileAccess.Write);}
        internal void Update(byte[] bytes){Program.Need(NativeWorker.Ended && bytes.Length is >0 and <=2097152,"REPORT_PROGRESS_REFUSED");
            Check(stream.SafeFileHandle,rule,path);stream.Position=0;stream.Write(bytes);stream.SetLength(bytes.Length);stream.Flush(true);Check(stream.SafeFileHandle,rule,path);}
        public void Dispose()=>stream.Dispose();
    }
    internal static ReportJournal NewReport(string relative,string role,PilotPlan plan)
    {
        Program.Need(role=="Setup" && plan.Stage=="Finish" && relative=="setup-reports/"+plan.Runs.Single(r=>r.Action=="setup-finish").RunId+".json","REPORT_PROGRESS_PATH_REFUSED");
        var rule=Rule(relative,plan.GuardianSid,plan.AppSid,plan);NativeTokens.Capture(role);
        string path=PathOf(relative);PlainAncestors(path);var bytes=Descriptor(rule);var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);SafeFileHandle handle;
        try {var sa=new SecurityAttributes {Length=Marshal.SizeOf<SecurityAttributes>(),Descriptor=pin.AddrOfPinnedObject(),Inherit=0};
            handle=CreateFileW(path,0x40000000|0x20000|0x80,0,ref sa,1,0x00200000,IntPtr.Zero);}
        finally {pin.Free();}
        try {Program.Need(!handle.IsInvalid,"REPORT_CREATE_NEW_FAILED");Check(handle,rule,path);return new ReportJournal(handle,rule,path);}
        catch{handle.Dispose();throw;}
    }
    private static SafeFileHandle Open(string path,uint access,uint disposition,bool directory) {
        var sa=new SecurityAttributes {Length=Marshal.SizeOf<SecurityAttributes>()};
        var h=CreateFileW(path,access,1,ref sa,disposition,0x00200000|(directory?0x02000000u:0),IntPtr.Zero);
        if(h.IsInvalid){h.Dispose();throw new InvalidDataException("FILE_OPEN_REFUSED");}return h;
    }
    [StructLayout(LayoutKind.Sequential)]private struct SecurityAttributes {internal int Length;internal IntPtr Descriptor;internal int Inherit;}
    [StructLayout(LayoutKind.Sequential,Pack=4)]private struct FileInfo {internal uint Attributes;internal long Creation,Access,Write;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,ref SecurityAttributes attributes,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool CreateDirectoryW(string path,ref SecurityAttributes attributes);
    [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileInfo info);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern uint GetFinalPathNameByHandleW(SafeFileHandle file,StringBuilder path,uint size,uint flags);
    [DllImport("advapi32.dll")]private static extern uint GetSecurityInfo(SafeFileHandle handle,uint type,uint info,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
    [DllImport("advapi32.dll")]private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")]private static extern IntPtr LocalFree(IntPtr memory);
}
