namespace EntryControl.TestOnly.Runtime;
internal sealed record PackageFile(string Name,long Size,string Sha256);
internal sealed record Run(string Action,string Role,string RunId);
internal sealed record PilotPlan(int SchemaVersion,string Scope,string Stage,string ExperimentId,string GuardianSid,string AppSid,
    string HostBindingSha256,string SourceManifestSha256,string ProvenanceSha256,string KitManifestSha256,
    string PackageManifestSha256,string DependencyInventorySha256,string ProfileSha256,string BootIdentity,
    string PreviousCheckpointSha256,string PreviousEvidenceSha256,PackageFile[] PackageFiles,Run[] Runs,
    string[] PreviousRunIds,bool OwnerAuthorized,bool BuiltKitReviewed);
// Expected values supplied by a future reviewed controller entry, never derived
// from the plan being admitted. This is a correlation boundary, not a signed
// authorization ticket or evidence of independent review.
internal sealed record ControllerBinding(string Stage,string ExperimentId,string PlanSha256,string SuccessorPacketSha256,
    string HostBindingSha256,string BootIdentity,string SourceManifestSha256,string ProvenanceSha256,string KitManifestSha256,
    string PackageManifestSha256,string DependencyInventorySha256,string ProfileSha256,
    string PreviousCheckpointSha256,string PreviousEvidenceSha256);
internal sealed record ControllerInput(int SchemaVersion,string Scope,PilotPlan Plan,ControllerBinding Binding);
internal sealed record OwnerStageDecision(int SchemaVersion,string Scope,string DecisionId,string OwnerSid,string Decision,
    string ControllerInputSha256,string BindingSha256,string Stage,string ExperimentId,
    DateTimeOffset IssuedUtc,DateTimeOffset ExpiresUtc,bool SecurityAccepted=false,bool ProductionAccepted=false);
internal sealed record OwnerAdmissionInput(ControllerInput Input,OwnerStageDecision Decision);
// An exact owner-decision correlation, NOT signer authentication or an execution
// ticket. Construction is closed; the physical Main entry remains disabled.
internal sealed class OwnerAdmission
{
    internal const string Scope="TEST_ONLY_OWNER_STAGE_DECISION_V1";
    private readonly byte[] planBytes;
    private readonly ControllerBinding binding;
    private readonly OwnerStageDecision decision;
    private int phase; // 0 admitted, 1 bootstrap begun, 2 bootstrap read back, 3 stage begun
    private static readonly HashSet<string> Consumed=new(StringComparer.Ordinal);
    internal string DecisionSha256 {get;}
    internal OwnerStageDecision DecisionSnapshot=>decision;
    internal void VerifyLiveControllerOwner()=>NativeTokens.MatchControllerOwner(NativeTokens.Capture("Controller"),decision.OwnerSid);
    internal PilotPlan Snapshot=>Program.Parse<PilotPlan>((byte[])planBytes.Clone());
    private OwnerAdmission(PilotPlan plan,ControllerBinding expected,OwnerStageDecision owner,string hash)
    {planBytes=Program.Serialize(plan);binding=expected;decision=owner;DecisionSha256=hash;}
    internal static bool ValidOwnerSid(string sid)
    {
        var parts=sid.Split('-');return parts.Length==8 && sid.StartsWith("S-1-5-21-",StringComparison.Ordinal) &&
            parts.Skip(4).All(n=>uint.TryParse(n,System.Globalization.NumberStyles.None,System.Globalization.CultureInfo.InvariantCulture,out var u) &&
                u>0 && n==u.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }
    private static void Window(OwnerStageDecision d,DateTimeOffset now)
    {
        Program.Need(now.Offset==TimeSpan.Zero && d.IssuedUtc.Offset==TimeSpan.Zero && d.ExpiresUtc.Offset==TimeSpan.Zero &&
            d.IssuedUtc<=now && now<d.ExpiresUtc && d.ExpiresUtc-d.IssuedUtc<=TimeSpan.FromHours(24),"OWNER_DECISION_TIME_REFUSED");
    }
    internal static OwnerAdmission Validate(byte[] bytes,string expectedDecisionSha256,string expectedOwnerSid,DateTimeOffset now)
    {
        Program.Need(bytes.Length is >0 and <=2097152 && Program.Hex(expectedDecisionSha256,64) &&
            expectedOwnerSid is not null && ValidOwnerSid(expectedOwnerSid),"OWNER_INPUT_REFUSED");
        var input=Program.Parse<OwnerAdmissionInput>((byte[])bytes.Clone());
        Program.Need(input.Input is not null && input.Decision is not null,"OWNER_INPUT_NULL_REFUSED");
        var d=input.Decision!;var controller=input.Input!;
        Program.Need(Program.Hash(Program.Serialize(d))==expectedDecisionSha256 && d.SchemaVersion==1 && d.Scope==Scope &&
            Program.Hex(d.DecisionId,32) && d.OwnerSid==expectedOwnerSid && d.Decision=="APPROVE_TEST_STAGE" &&
            !d.SecurityAccepted && !d.ProductionAccepted,"OWNER_DECISION_REFUSED");
        Window(d,now);
        var plan=ControllerAdmission.ValidateExternal(Program.Serialize(controller),d.ControllerInputSha256);
        Program.Need(Program.Hash(Program.Serialize(controller.Binding))==d.BindingSha256 &&
            plan.Stage==d.Stage && plan.ExperimentId==d.ExperimentId && d.DecisionId!=plan.ExperimentId &&
            !plan.Runs.Any(r=>r.RunId==d.DecisionId) && !plan.PreviousRunIds.Contains(d.DecisionId),"OWNER_STAGE_BINDING_REFUSED");
        return new(plan,controller.Binding,d,expectedDecisionSha256);
    }
    // Consume before native access, even if it later fails. Process-local only;
    // restart/durable replay prevention still requires reviewed protected state.
    private void Reserve()=>Program.Need(Consumed.Add(decision.DecisionId),"OWNER_DECISION_ALREADY_CONSUMED_RETAIN");
    internal PilotPlan BeginBootstrap(DateTimeOffset now)
    {
        Window(decision,now);var plan=ControllerAdmission.Validate((byte[])planBytes.Clone(),binding);
        lock(Consumed){Program.Need(plan.Stage=="Prepare" && phase==0,"OWNER_BOOTSTRAP_PHASE_REFUSED");Reserve();phase=1;}
        return plan;
    }
    internal static void ValidateBootstrapServices(PilotPlan p,ServiceReceipt[] services)
    {
        Program.Need(services.Length==3 && services.Select(s=>s.Name).SequenceEqual(new[]{"Setup","Guardian","App"}.Select(r=>Program.Prefix+"."+r)) &&
            services.All(s=>s.State=="Stopped" && s.StartMode=="Manual" && s.ProcessId==0) &&
            services[1].Sid==p.GuardianSid && services[2].Sid==p.AppSid,"OWNER_BOOTSTRAP_READBACK_REFUSED");
    }
    internal void CompleteBootstrap(BootstrapAdmission.Completion? completion)
    {
        Program.Need(completion is not null,"OWNER_BOOTSTRAP_NATIVE_PROOF_REQUIRED");completion!.RequireBinding(this);
        lock(Consumed){Program.Need(phase==1,"OWNER_BOOTSTRAP_PHASE_REFUSED");phase=2;}
    }
    internal PilotPlan Consume(DateTimeOffset now)
    {
        Window(decision,now);var plan=ControllerAdmission.Validate((byte[])planBytes.Clone(),binding);
        lock(Consumed) {
            Program.Need(plan.Stage=="Prepare"?phase==2:phase==0,"OWNER_STAGE_PHASE_REFUSED");
            if(phase==0)Reserve();phase=3;
        }
        return plan;
    }
}
internal static class ControllerAdmission
{
    internal const string InputScope="TEST_ONLY_CONTROLLER_INPUT_V1";
    // The digest must arrive separately from these bytes. It binds the entire
    // input (including expected pins), but cannot authenticate who approved it.
    internal static PilotPlan ValidateExternal(byte[] bytes,string expectedInputSha256)
    {
        Program.Need(bytes.Length is >0 and <=2097152 && Program.Hex(expectedInputSha256,64),"CONTROLLER_INPUT_REFUSED");
        var snapshot=(byte[])bytes.Clone();
        Program.Need(Program.Hash(snapshot)==expectedInputSha256,"CONTROLLER_INPUT_HASH_REFUSED");
        var input=Program.Parse<ControllerInput>(snapshot);
        Program.Need(input.SchemaVersion==1 && input.Scope==InputScope && input.Plan is not null && input.Binding is not null,"CONTROLLER_INPUT_SCOPE_REFUSED");
        return Validate(Program.Serialize(input.Plan!),input.Binding!);
    }
    internal static PilotPlan Validate(byte[] input,ControllerBinding expected)
    {
        // Copy before parsing/hashing: callers cannot change the admitted bytes
        // via their original array after admission.
        Program.Need(input.Length is >0 and <=2097152,"CONTROLLER_PLAN_SIZE_REFUSED");
        byte[] bytes=(byte[])input.Clone();
        Program.Need(expected.SuccessorPacketSha256==Program.SuccessorPacketSha256 &&
            Program.Hex(expected.PlanSha256,64) && Program.Hash(bytes)==expected.PlanSha256,"CONTROLLER_BINDING_REFUSED");
        var p=Program.Parse<PilotPlan>(bytes);PlanAdmission.Validate(p);
        // Canonical form is required by the downstream controller/report hashes.
        Program.Need(bytes.SequenceEqual(Program.Serialize(p)),"CONTROLLER_CANONICAL_PLAN_REFUSED");
        Program.Need(p.Stage==expected.Stage && p.ExperimentId==expected.ExperimentId &&
            p.HostBindingSha256==expected.HostBindingSha256 && p.BootIdentity==expected.BootIdentity &&
            p.SourceManifestSha256==expected.SourceManifestSha256 && p.ProvenanceSha256==expected.ProvenanceSha256 &&
            p.KitManifestSha256==expected.KitManifestSha256 && p.PackageManifestSha256==expected.PackageManifestSha256 &&
            p.DependencyInventorySha256==expected.DependencyInventorySha256 && p.ProfileSha256==expected.ProfileSha256 &&
            p.PreviousCheckpointSha256==expected.PreviousCheckpointSha256 && p.PreviousEvidenceSha256==expected.PreviousEvidenceSha256,
            "CONTROLLER_CONTEXT_REFUSED");
        return p;
    }
    // Read-only protected intake for already provisioned stages. Prepare before
    // bootstrap needs a separately reviewed external-input lane, not this loader.
    // No service start, key operation, ACL change or checkpoint write occurs.
    internal static PilotPlan ReadProtected(ControllerBinding expected)
    {
        string file=PlanAdmission.PlanFile(expected.Stage);NativeTokens.Capture("Controller");
        string g=NativeTokens.Sid("Guardian"),a=NativeTokens.Sid("App");
        var p=Validate(SecureFiles.Read("plans/"+file,g,a),expected);
        Program.Need(p.GuardianSid==g && p.AppSid==a && NativeTokens.BootIdentity()==p.BootIdentity,"CONTROLLER_LIVE_CONTEXT_REFUSED");
        HostAdmission.Verify(p);PlanAdmission.VerifyPackage(p);return p;
    }
}
internal static class PlanAdmission
{
    internal static readonly string[] Actions={"setup-create","guardian-prepare","setup-publish","app-prepare","child-prepare",
        "guardian-fresh","app-fresh","child-fresh","setup-finish","guardian-absence"};
    internal static string Actor(string action)=>action.Split('-')[0] switch {"setup"=>"Setup","guardian"=>"Guardian","app"=>"App","child"=>"Child",_=>throw new InvalidDataException("ACTION_REFUSED")};
    internal static string PlanFile(string stage)=>stage switch {"Prepare"=>"prepare.json","VerifyFreshProcess"=>"fresh-process.json","Finish"=>"finish.json",_=>throw new InvalidDataException("STAGE_REFUSED")};
    internal static void Validate(PilotPlan p)
    {
        Program.Need(p.SchemaVersion==1 && p.Scope==Program.Scope && Program.Hex(p.ExperimentId,32) && p.OwnerAuthorized && p.BuiltKitReviewed,"PLAN_AUTHORITY_REFUSED");
        int start=p.Stage switch {"Prepare"=>0,"VerifyFreshProcess"=>5,"Finish"=>8,_=>throw new InvalidDataException("STAGE_REFUSED")};
        int count=start==0?5:start==5?3:2;
        Program.Need(p.Runs.Length==count && p.Runs.Select(r=>r.Action).SequenceEqual(Actions.Skip(start).Take(count)) &&
            p.Runs.All(r=>r.Role==Actor(r.Action) && Program.Hex(r.RunId,32) && r.RunId!=p.ExperimentId) &&
            p.Runs.Select(r=>r.RunId).Distinct(StringComparer.Ordinal).Count()==count,"RUNS_REFUSED");
        Program.Need(p.PreviousRunIds.Length==start && p.PreviousRunIds.All(r=>Program.Hex(r,32)) &&
            p.PreviousRunIds.Distinct(StringComparer.Ordinal).Count()==start && !p.Runs.Any(r=>p.PreviousRunIds.Contains(r.RunId)),"RUN_HISTORY_REFUSED");
        Program.Need(new[]{p.HostBindingSha256,p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,
            p.PackageManifestSha256,p.DependencyInventorySha256,p.ProfileSha256}.All(h=>Program.Hex(h,64)),"PIN_REFUSED");
        Program.Need(start==0 ? p.PreviousCheckpointSha256=="" && p.PreviousEvidenceSha256=="" :
            Program.Hex(p.PreviousCheckpointSha256,64) && Program.Hex(p.PreviousEvidenceSha256,64),"CHECKPOINT_REFUSED");
        Program.Need(p.GuardianSid!=p.AppSid && ValidSid(p.GuardianSid) && ValidSid(p.AppSid) &&
            Program.Hex(p.BootIdentity,64),"IDENTITY_CONTEXT_REFUSED");
        Program.Need(p.PackageFiles.Length is >0 and <=512 && p.PackageFiles.All(f=>ValidName(f.Name) && f.Size>0 && Program.Hex(f.Sha256,64)) &&
            p.PackageFiles.Select(f=>f.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count()==p.PackageFiles.Length,"PACKAGE_REFUSED");
        Program.Need(p.PackageFiles.Any(f=>f.Name=="EntryControl.AdapterPilot.exe") && p.PackageFiles.Any(f=>f.Name=="EntryControl.AdapterPilot.dll"),"ARTIFACT_MISSING");
        Program.Need(Program.Hash(Program.Serialize(p.PackageFiles.OrderBy(f=>f.Name,StringComparer.Ordinal).ToArray()))==p.DependencyInventorySha256,"DEPENDENCY_DIGEST_REFUSED");
    }
    internal static bool ValidName(string name)=>name==".version" || name.Length is >0 and <=128 &&
        name[0] is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9' &&
        name.All(c=>c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9' or '.' or '-' or '_') && !name.Contains("..") && !name.EndsWith('.') &&
        !new[]{"CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"}.Contains(name.Split('.')[0],StringComparer.OrdinalIgnoreCase);
    internal static bool ValidSid(string sid) {var parts=sid.Split('-');return parts.Length==9 && sid.StartsWith("S-1-5-80-",StringComparison.Ordinal) &&
        parts.Skip(4).All(n=>uint.TryParse(n,System.Globalization.NumberStyles.None,System.Globalization.CultureInfo.InvariantCulture,out var u) && n==u.ToString(System.Globalization.CultureInfo.InvariantCulture));}
    internal static (PilotPlan Plan,Run Run,string PlanHash) Admit(string role,string action,string approvedPlanHash)
    {
        Program.Need(Actions.Contains(action) && Actor(action)==role && Program.Hex(approvedPlanHash,64),"ENTRY_ARGUMENT_REFUSED");
        string stage=Array.IndexOf(Actions,action)<5?"Prepare":Array.IndexOf(Actions,action)<8?"VerifyFreshProcess":"Finish";
        string g=NativeTokens.Sid("Guardian"),p=NativeTokens.Sid("App");NativeTokens.Capture(role);
        var bytes=SecureFiles.Read("plans/"+PlanFile(stage),g,p);
        Program.Need(Program.Hash(bytes)==approvedPlanHash,"PLAN_HASH_REFUSED");var plan=Program.Parse<PilotPlan>(bytes);Validate(plan);
        Program.Need(plan.Stage==stage && plan.GuardianSid==g && plan.AppSid==p,"PLAN_ROLE_REFUSED");
        HostAdmission.Verify(plan);VerifyPackage(plan);return(plan,plan.Runs.Single(r=>r.Action==action),approvedPlanHash);
    }
    internal static void VerifyPackage(PilotPlan p)
    {
        var files=Directory.GetFileSystemEntries(SecureFiles.PathOf("bin"));
        Program.Need(files.Length==p.PackageFiles.Length && files.All(f=>p.PackageFiles.Any(e=>e.Name==Path.GetFileName(f))),"PACKAGE_EXTRA_REFUSED");
        Program.Need(Path.GetFullPath(Environment.ProcessPath!)==SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe") &&
            Path.GetFullPath(typeof(Program).Assembly.Location)==SecureFiles.PathOf("bin/EntryControl.AdapterPilot.dll"),"EXECUTOR_PATH_REFUSED");
        foreach(var f in p.PackageFiles){var bytes=SecureFiles.Read("bin/"+f.Name,p.GuardianSid,p.AppSid,p,int.MaxValue);
            Program.Need(bytes.LongLength==f.Size && Program.Hash(bytes)==f.Sha256,"PACKAGE_CHANGED_REFUSED");}
        Program.Need(Environment.Version.ToString()=="10.0.11" && RuntimeInformation.ProcessArchitecture==Architecture.X64,"RUNTIME_REFUSED");
    }
    internal static int SelfTest()
    {
        int count=0;
        void Refuse(Action a){try {a();}catch {count++;return;}throw new Exception("REFUSAL_MISSING");}
        foreach(var name in new[]{"../escape","sub/file","file:stream","file..dll","file.","CON.dll","nul","COM1.json","LPT9"}){Program.Need(!ValidName(name),"NAME_TEST_FAILED");count++;}
        Refuse(()=>Program.Parse<Run>(Encoding.UTF8.GetBytes("{\"action\":\"a\",\"action\":\"b\"}")));
        Refuse(()=>Program.Parse<Run>(Encoding.UTF8.GetBytes("{\"action\":\"a\",\"role\":\"App\",\"runId\":\"x\",\"exception\":\"CANARY\"}")));
        Program.Need(Actor("child-fresh")=="Child" && PlanFile("Finish")=="finish.json","FIXED_ROUTE_FAILED");count++;
        foreach(var dir in new[]{"","bin","plans","controller","shared","protected","guardian-work","setup-reports","guardian-reports","app-reports"}) {
            var r=SecureFiles.Rule(dir,"G","P",null,true);Program.Need(r.Directory && r.Aces.Select(a=>a.Sid).Distinct().Count()==r.Aces.Length,"DIR_RULE_FAILED");count++;
        }
        var protectedRule=SecureFiles.Rule("protected","G","P",null,true);
        Program.Need(protectedRule.Owner=="S-1-5-18" && protectedRule.Creator=="Setup" &&
            protectedRule.Aces.SequenceEqual(new[]{("S-1-5-18",0x1f01ff),("G",0x1200a9)}),"PRIVATE_RULE_FAILED");count++;
        Refuse(()=>SecureFiles.Rule("protected/extra.json","G","P"));
        Refuse(()=>SecureFiles.Rule("unknown","G","P",null,true));
        Refuse(()=>SecureFiles.PathOf("../escape"));
        Refuse(()=>SecureFiles.PathOf("file:stream"));
        var context=new EntryControl.TestOnly.FixtureContext(1,new byte[16],0,new byte[32],new byte[32],new byte[32]);
        var fixture=EntryControl.TestOnly.CandidateCodec.Encode(context,new byte[12],new byte[384],new byte[128],new byte[16]);
        var snapshot=EntryControl.TestOnly.CandidateCodec.SnapshotAndValidate(fixture,context);
        Program.Need(snapshot.SequenceEqual(fixture) && !ReferenceEquals(snapshot,fixture),"SNAPSHOT_FAILED");count++;
        foreach(int offset in new[]{0,8,10,12,13,14,30,38,70,102,134}) {
            var mutated=(byte[])fixture.Clone();mutated[offset]^=1;
            Refuse(()=>EntryControl.TestOnly.CandidateCodec.SnapshotAndValidate(mutated,context));
        }
        Refuse(()=>EntryControl.TestOnly.CandidateCodec.SnapshotAndValidate(fixture.Concat(new byte[]{0}).ToArray(),context));
        Refuse(()=>EntryControl.TestOnly.CandidateCodec.SnapshotAndValidate(fixture[..^1],context));
        // Managed worker only: no native work, key, token, file ACL or service call.
        Program.Need(NativeWorker.Run(()=>42,5000)==42,"WORKER_RETURN_FAILED");count++;
        Refuse(()=>NativeWorker.Run(()=>42,0));
        count+=ReportEmitter.SelfTest();
        count+=RoleActions.SelfTest();
        count+=StageController.SelfTest();
        count+=ControllerWindows.SelfTest();
        count+=ProcessObserver.SelfTest();
        count+=BootstrapAdmission.SelfTest();
        count+=KeyOperations.SelfTest();
        count+=ServiceHost.SelfTest();
        count+=OrderedActions.SelfTest();
        count+=HostAdmission.SelfTest();
        count+=NativeTokens.OwnerMatchSelfTest();count+=ServiceIdentityPolicy.SelfTest();count+=TokenRestrictionReader.SelfTest();
        count+=PhysicalEntry.SelfTest();
        count+=NativeTokens.ServiceSidSelfTest();
        var streamed=new byte[2097152];using(var stream=new MemoryStream(streamed)) {
            Program.Need(Program.ReadBoundedInput(stream).SequenceEqual(streamed),"INPUT_STREAM_BOUND_FAILED");count++;
        }
        Refuse(()=>Program.ReadBoundedInput(new MemoryStream()));
        Refuse(()=>Program.ReadBoundedInput(new MemoryStream(new byte[2097153])));
        Console.WriteLine(JsonSerializer.Serialize(new{scope="TEST_ONLY_PILOT_RUNTIME_PURE",cases=count,physicalTested=false,
            successorPacketSha256=Program.SuccessorPacketSha256,
            runtime=Environment.Version.ToString(),coreLibPath=typeof(object).Assembly.Location,
            loadedAssemblySha256=Program.Hash(File.ReadAllBytes(typeof(Program).Assembly.Location)),executorExeSha256=Program.Hash(File.ReadAllBytes(Environment.ProcessPath!)),securityAccepted=false,productionAccepted=false}));return 0;
    }
}

// Controller evidence core only. Receipts are independently collected by the
// future native controller, never synthesized from reports in a real admission.
internal sealed record ProcessReceipt(string Action,string RunId,int ProcessId,DateTimeOffset StartedUtc,DateTimeOffset EndedUtc);
internal sealed record ServiceReceipt(string Name,string Sid,string State,string StartMode,int ProcessId);
internal sealed record ReportEvidence(string RunId,string Sha256,byte[] Bytes);
internal sealed record StageCheckpoint(string Stage,string ExperimentId,string PlanSha256,string ContextSha256,string SharedSha256,
    string[] RunIds,string EvidenceSha256,string PreviousCheckpointSha256,DateTimeOffset LastEndedUtc,bool SecurityAccepted=false,bool ProductionAccepted=false);
internal static class StageController
{
    internal static PilotReport ValidateSingle(PilotPlan p,string planHash,Run run,ReportEvidence evidence,ProcessReceipt process,ServiceReceipt[] services,StageCheckpoint? previous)
    {
        PlanAdmission.Validate(p);Program.Need(planHash==Program.Hash(Program.Serialize(p)) && p.Runs.Contains(run) &&
            evidence.RunId==run.RunId && process.RunId==run.RunId && evidence.Bytes.Length is >0 and <=2097152 && Program.Hash(evidence.Bytes)==evidence.Sha256,"ACTION_REPORT_HASH_REFUSED");
        var r=Program.Parse<PilotReport>(evidence.Bytes);ReportEmitter.Encode(r);
        string user=run.Role=="Setup"?"S-1-5-18":run.Role=="Guardian"?p.GuardianSid:p.AppSid;
        Program.Need(r.Stage==p.Stage && r.Action==run.Action && r.Role==run.Role && r.RunId==run.RunId && r.ExperimentId==p.ExperimentId &&
            r.PlanSha256==planHash && r.BootIdentity==p.BootIdentity && r.SourceManifestSha256==p.SourceManifestSha256 && r.ProvenanceSha256==p.ProvenanceSha256 &&
            r.KitManifestSha256==p.KitManifestSha256 && r.PackageManifestSha256==p.PackageManifestSha256 && r.DependencyInventorySha256==p.DependencyInventorySha256 &&
            r.HostBindingSha256==p.HostBindingSha256 && r.ProfileSha256==p.ProfileSha256 && r.ExecutorExeSha256==p.PackageFiles.Single(f=>f.Name=="EntryControl.AdapterPilot.exe").Sha256 &&
            r.LoadedAssemblySha256==p.PackageFiles.Single(f=>f.Name=="EntryControl.AdapterPilot.dll").Sha256 && r.TokenUserSid==user && r.TokenOwnerSid==user &&
            r.TokenType==1 && r.Elevation is 0 or 1 && ServiceIdentityPolicy.Accept(r.Role,r.ServiceSid,r.TokenUserSid,r.TokenOwnerSid,r.TokenType,r.ServiceSidGroupCount,r.ServiceSidAttributes,r.TokenQueryComplete,false,r.TokenRestricted) &&
            r.ServiceSid==(run.Role=="Setup"?services.Single(s=>s.Name==Program.Prefix+".Setup").Sid:user) &&
            r.Runtime=="10.0.11" && r.Architecture=="X64" && r.ArtifactIdentityMatched && r.WorkerEnded &&
            r.Results.Select(x=>x.Id).SequenceEqual(RoleActions.ResultIds(run.Action)),"ACTION_REPORT_CONTEXT_REFUSED");
        Program.Need(process.Action==run.Action && process.ProcessId>0 && r.ProcessId==process.ProcessId && process.StartedUtc<=r.TimeUtc &&
            r.TimeUtc<=process.EndedUtc && process.StartedUtc<process.EndedUtc && (previous is null || previous.LastEndedUtc<=process.StartedUtc),"ACTION_PROCESS_CONTEXT_REFUSED");
        foreach(var result in r.Results)Program.Need(result.Id=="restricted-open" || run.Action=="guardian-absence"?
            result.Status=="OBSERVED" && result.ReasonCode=="RAW_BAD_KEYSET" && result.NativeStatus==unchecked((int)0x80090016):
            result.Status=="PASS" && result.ReasonCode=="VERIFIED" && result.NativeStatus is null,"ACTION_INCOMPLETE_RETAIN");
        return r;
    }
    internal static string[] ServiceActions(string stage)=>stage switch {
        "Prepare"=>new[]{"setup-create","guardian-prepare","setup-publish","app-prepare"},
        "VerifyFreshProcess"=>new[]{"guardian-fresh","app-fresh"},"Finish"=>new[]{"setup-finish","guardian-absence"},
        _=>throw new InvalidDataException("CONTROLLER_STAGE_REFUSED")};
    internal static string ContextHash(PilotPlan p)=>Program.Hash(Program.Serialize(new {p.ExperimentId,p.GuardianSid,p.AppSid,
        p.HostBindingSha256,p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,p.PackageManifestSha256,
        p.DependencyInventorySha256,p.ProfileSha256,p.BootIdentity}));
    internal static StageCheckpoint Validate(PilotPlan p,string approvedPlanHash,ReportEvidence[] evidence,ProcessReceipt[] receipts,
        ServiceReceipt[] services,string sharedHash,StageCheckpoint? previous)
    {
        PlanAdmission.Validate(p);Program.Need(approvedPlanHash==Program.Hash(Program.Serialize(p)) && Program.Hex(sharedHash,64),"CONTROLLER_PLAN_HASH_REFUSED");
        if(p.Stage=="Prepare")Program.Need(previous is null,"CONTROLLER_HISTORY_REFUSED");
        else {Program.Need(previous is not null,"CONTROLLER_HISTORY_MISSING");
            Program.Need(previous!.Stage==(p.Stage=="VerifyFreshProcess"?"Prepare":"VerifyFreshProcess") &&
                previous.ExperimentId==p.ExperimentId && previous.ContextSha256==ContextHash(p) && previous.SharedSha256==sharedHash &&
                previous.RunIds.SequenceEqual(p.PreviousRunIds) && previous.EvidenceSha256==p.PreviousEvidenceSha256 &&
                Program.Hash(Program.Serialize(previous))==p.PreviousCheckpointSha256 && !previous.SecurityAccepted && !previous.ProductionAccepted,"CONTROLLER_HISTORY_REFUSED");}
        Program.Need(services.Length==3 && services.Select(s=>s.Name).OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(
            new[]{Program.Prefix+".Setup",Program.Prefix+".Guardian",Program.Prefix+".App"}.OrderBy(x=>x,StringComparer.Ordinal)) &&
            services.All(s=>s.State=="Stopped" && s.StartMode=="Manual" && s.ProcessId==0 && PlanAdmission.ValidSid(s.Sid)) &&
            services.Select(s=>s.Sid).Distinct().Count()==3 && services.Single(s=>s.Name==Program.Prefix+".Guardian").Sid==p.GuardianSid &&
            services.Single(s=>s.Name==Program.Prefix+".App").Sid==p.AppSid,"CONTROLLER_SERVICE_RETENTION_REQUIRED");
        Program.Need(evidence.Length==p.Runs.Length && receipts.Length==p.Runs.Length &&
            evidence.Select(e=>e.RunId).SequenceEqual(p.Runs.Select(r=>r.RunId)) &&
            receipts.Select(e=>e.RunId).SequenceEqual(p.Runs.Select(r=>r.RunId)),"CONTROLLER_EXACT_REPORTS_REQUIRED");
        var reports=new List<PilotReport>();
        for(int i=0;i<p.Runs.Length;i++) {
            var run=p.Runs[i];var e=evidence[i];var proc=receipts[i];
            ValidateSingle(p,approvedPlanHash,run,e,proc,services,previous);
            Program.Need(e.Bytes.Length is >0 and <=2097152 && Program.Hash(e.Bytes)==e.Sha256 && Program.Hex(e.Sha256,64),"CONTROLLER_REPORT_HASH_REFUSED");
            var r=Program.Parse<PilotReport>(e.Bytes);ReportEmitter.Encode(r);
            string expectedUser=run.Role=="Setup"?"S-1-5-18":run.Role=="Guardian"?p.GuardianSid:p.AppSid;
            Program.Need(r.Stage==p.Stage && r.Action==run.Action && r.Role==run.Role && r.RunId==run.RunId && r.ExperimentId==p.ExperimentId &&
                r.PlanSha256==approvedPlanHash && r.BootIdentity==p.BootIdentity && r.SourceManifestSha256==p.SourceManifestSha256 &&
                r.ProvenanceSha256==p.ProvenanceSha256 && r.KitManifestSha256==p.KitManifestSha256 && r.PackageManifestSha256==p.PackageManifestSha256 &&
                r.DependencyInventorySha256==p.DependencyInventorySha256 && r.HostBindingSha256==p.HostBindingSha256 && r.ProfileSha256==p.ProfileSha256 &&
                r.ExecutorExeSha256==p.PackageFiles.Single(f=>f.Name=="EntryControl.AdapterPilot.exe").Sha256 &&
                r.LoadedAssemblySha256==p.PackageFiles.Single(f=>f.Name=="EntryControl.AdapterPilot.dll").Sha256 &&
                r.TokenUserSid==expectedUser && r.TokenOwnerSid==expectedUser && r.TokenType==1 && r.Elevation is 0 or 1 &&
                ServiceIdentityPolicy.Accept(r.Role,r.ServiceSid,r.TokenUserSid,r.TokenOwnerSid,r.TokenType,r.ServiceSidGroupCount,r.ServiceSidAttributes,r.TokenQueryComplete,false,r.TokenRestricted) &&
                (run.Role=="Setup"?r.ServiceSid==services.Single(s=>s.Name==Program.Prefix+".Setup").Sid:r.ServiceSid==expectedUser) &&
                r.Runtime=="10.0.11" && r.Architecture=="X64" && r.ArtifactIdentityMatched && r.WorkerEnded &&
                r.Results.Select(x=>x.Id).SequenceEqual(RoleActions.ResultIds(run.Action)),"CONTROLLER_REPORT_CONTEXT_REFUSED");
            Program.Need(proc.Action==run.Action && proc.ProcessId>0 && r.ProcessId==proc.ProcessId && proc.StartedUtc<=r.TimeUtc &&
                r.TimeUtc<=proc.EndedUtc && proc.StartedUtc<proc.EndedUtc && (previous is null || previous.LastEndedUtc<=proc.StartedUtc),"CONTROLLER_PROCESS_RECEIPT_REFUSED");
            foreach(var result in r.Results) {
                bool observation=result.Id=="restricted-open" || run.Action=="guardian-absence";
                Program.Need(observation ? result.Status=="OBSERVED" && result.ReasonCode=="RAW_BAD_KEYSET" && result.NativeStatus==unchecked((int)0x80090016) :
                    result.Status=="PASS" && result.ReasonCode=="VERIFIED" && result.NativeStatus is null,"CONTROLLER_INCOMPLETE_RETAIN");
            }
            reports.Add(r);
        }
        var serviceReceipts=receipts.Where(r=>!r.Action.StartsWith("child-",StringComparison.Ordinal)).ToArray();
        for(int i=1;i<serviceReceipts.Length;i++)Program.Need(serviceReceipts[i-1].EndedUtc<=serviceReceipts[i].StartedUtc,"CONTROLLER_ACTION_ORDER_REFUSED");
        if(p.Stage!="Finish") {
            var app=reports.Single(r=>r.Role=="App");var child=reports.Single(r=>r.Role=="Child");
            var appProc=receipts.Single(r=>r.Action==app.Action);var childProc=receipts.Single(r=>r.Action==child.Action);
            Program.Need(app.ProcessId!=child.ProcessId && app.TokenUserSid==child.TokenUserSid && app.TokenOwnerSid==child.TokenOwnerSid &&
                app.Elevation==child.Elevation && app.ServiceSid==child.ServiceSid && app.ServiceSidAttributes==child.ServiceSidAttributes && app.ServiceSidGroupCount==child.ServiceSidGroupCount && app.TokenRestricted==child.TokenRestricted && app.TokenQueryComplete==child.TokenQueryComplete &&
                appProc.StartedUtc<=childProc.StartedUtc && childProc.EndedUtc<=app.TimeUtc,"CONTROLLER_CHILD_CONTEXT_REFUSED");
        }
        // Finish's observed absence is accepted as a bounded consistency check
        // ONLY alongside the exact successful Setup delete report, never alone.
        string evidenceHash=Program.Hash(Program.Serialize(evidence.Select(e=>new{e.RunId,e.Sha256}).ToArray()));
        return new(p.Stage,p.ExperimentId,approvedPlanHash,ContextHash(p),sharedHash,p.PreviousRunIds.Concat(p.Runs.Select(r=>r.RunId)).ToArray(),evidenceHash,p.PreviousCheckpointSha256,receipts.Max(x=>x.EndedUtc));
    }
    internal static int SelfTest()
    {
        int count=0;string h=new('a',64),exp=new('b',32),g="S-1-5-80-1-2-3-4-5",app="S-1-5-80-6-7-8-9-10";
        void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("CONTROLLER_REFUSAL_MISSING");}
        var package=new[]{new PackageFile("EntryControl.AdapterPilot.dll",1,h),new PackageFile("EntryControl.AdapterPilot.exe",1,h)};
        var services=new[]{new ServiceReceipt(Program.Prefix+".Setup","S-1-5-80-11-12-13-14-15","Stopped","Manual",0),new ServiceReceipt(Program.Prefix+".Guardian",g,"Stopped","Manual",0),new ServiceReceipt(Program.Prefix+".App",app,"Stopped","Manual",0)};
        StageCheckpoint? previous=null;int id=1;DateTimeOffset start=DateTimeOffset.UnixEpoch;
        var ownerHistory=new List<OwnerJournal.PriorStage>();
        foreach(string stage in new[]{"Prepare","VerifyFreshProcess","Finish"}) {
            var runs=PlanAdmission.Actions.Where(a=>RoleActions.StageOf(a)==stage).Select(a=>new Run(a,PlanAdmission.Actor(a),(id++).ToString("x32"))).ToArray();
            var p=new PilotPlan(1,Program.Scope,stage,exp,g,app,h,h,h,h,h,Program.Hash(Program.Serialize(package)),h,h,
                previous is null?"":Program.Hash(Program.Serialize(previous)),previous?.EvidenceSha256??"",package,runs,previous?.RunIds??Array.Empty<string>(),true,true);
            string planHash=Program.Hash(Program.Serialize(p));var receipts=new List<ProcessReceipt>();var evidence=new List<ReportEvidence>();
            var binding=new ControllerBinding(p.Stage,p.ExperimentId,planHash,Program.SuccessorPacketSha256,
                p.HostBindingSha256,p.BootIdentity,p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,
                p.PackageManifestSha256,p.DependencyInventorySha256,p.ProfileSha256,p.PreviousCheckpointSha256,p.PreviousEvidenceSha256);
            var admissionBytes=Program.Serialize(p);var admitted=ControllerAdmission.Validate(admissionBytes,binding);
            var request=new ControllerInput(1,ControllerAdmission.InputScope,p,binding);
            var requestBytes=Program.Serialize(request);string requestHash=Program.Hash(requestBytes);
            var ownerNow=DateTimeOffset.UnixEpoch.AddHours(1);string ownerSid="S-1-5-21-1-2-3-1001";
            var decision=new OwnerStageDecision(1,OwnerAdmission.Scope,new string('c',31)+(stage=="Prepare"?"1":stage=="Finish"?"3":"2"),
                ownerSid,"APPROVE_TEST_STAGE",requestHash,Program.Hash(Program.Serialize(binding)),stage,exp,
                DateTimeOffset.UnixEpoch,DateTimeOffset.UnixEpoch.AddHours(2));
            byte[] OwnerBytes(OwnerStageDecision d)=>Program.Serialize(new OwnerAdmissionInput(request,d));
            string decisionHash=Program.Hash(Program.Serialize(decision));var ownerBytes=OwnerBytes(decision);
            var owner=OwnerAdmission.Validate(ownerBytes,decisionHash,ownerSid,ownerNow);
            Program.Need(Program.Hash(Program.Serialize(owner.Snapshot))==planHash,"OWNER_SNAPSHOT_FAILED");count++;
            var ownerContext=new OwnerContext(1,OwnerJournal.ContextScope,ownerSid,requestHash,Program.SuccessorPacketSha256,decisionHash,stage,exp);
            var contextBytes=Program.Serialize(ownerContext);string contextHash=Program.Hash(contextBytes);
            OwnerJournal.ValidateContext(owner,contextBytes,contextHash);count++;
            var selected=OwnerEntry.ValidateSelection(contextBytes,ownerBytes,ownerSid,contextHash,ownerNow,false,false);
            Program.Need(selected.DecisionSha256==owner.DecisionSha256 && OwnerEntry.Effects(stage).Length==3,"OWNER_SELECTION_FAILED");count++;
            foreach(string? badSid in new string?[]{null,"","S-1-5-18","S-1-5-21-9-8-7-1001",ownerSid+" "})
                Reject(()=>OwnerEntry.ValidateSelection(contextBytes,ownerBytes,badSid,contextHash,ownerNow,false,false));
            foreach(string? badHash in new string?[]{null,"",new string('f',64),contextHash.ToUpperInvariant(),contextHash+" "})
                Reject(()=>OwnerEntry.ValidateSelection(contextBytes,ownerBytes,ownerSid,badHash,ownerNow,false,false));
            Reject(()=>OwnerEntry.ValidateSelection(contextBytes,ownerBytes,ownerSid,contextHash,ownerNow,true,false));
            Reject(()=>OwnerEntry.ValidateSelection(contextBytes,ownerBytes,ownerSid,contextHash,ownerNow,false,true));
            Reject(()=>OwnerEntry.ValidateSelection(contextBytes,ownerBytes,ownerSid,contextHash,decision.ExpiresUtc,false,false));
            Reject(()=>OwnerEntry.ValidateSelection(Array.Empty<byte>(),ownerBytes,ownerSid,contextHash,ownerNow,false,false));
            Reject(()=>OwnerEntry.ValidateSelection(contextBytes,Array.Empty<byte>(),ownerSid,contextHash,ownerNow,false,false));
            Reject(()=>OwnerEntry.Run(contextBytes,ownerBytes,Array.Empty<PackageBytes>()));
            Reject(()=>OwnerEntry.Effects("Unknown"));
            Reject(()=>OwnerJournal.ValidateContext(owner,contextBytes,new string('f',64)));
            foreach(var badContext in new[]{ownerContext with {SchemaVersion=2},ownerContext with {Scope=Program.Scope},
                ownerContext with {ExpectedOwnerSid="S-1-5-21-1-2-3-1002"},ownerContext with {ControllerInputSha256=new string('f',64)},
                ownerContext with {SuccessorPacketSha256=new string('f',64)},ownerContext with {DecisionSha256=new string('f',64)},
                ownerContext with {Stage="Unknown"},ownerContext with {ExperimentId=new string('f',32)}}) {
                var badBytes=Program.Serialize(badContext);Reject(()=>OwnerJournal.ValidateContext(owner,badBytes,Program.Hash(badBytes)));
            }
            string challenge=OwnerJournal.Challenge(ownerContext,contextHash);
            OwnerJournal.RequireChallenge(challenge,challenge,false,false);count++;
            foreach(string? wrongResponse in new string?[]{null,"","yes",challenge.ToLowerInvariant(),challenge+" "})Reject(()=>OwnerJournal.RequireChallenge(wrongResponse,challenge,false,false));
            Reject(()=>OwnerJournal.RequireChallenge(challenge,challenge,true,false));Reject(()=>OwnerJournal.RequireChallenge(challenge,challenge,false,true));
            var reserved=OwnerJournal.Build(owner,contextHash,Program.Hash(Encoding.UTF8.GetBytes(challenge)),ownerNow);
            var reservedBytes=Program.Serialize(reserved);OwnerJournal.ValidateReadback(reservedBytes,reserved);count++;
            OwnerJournal.ValidatePrior(owner,ownerHistory.ToArray(),ownerNow);count++;
            Reject(()=>OwnerJournal.ValidatePrior(owner,ownerHistory.Concat(new[]{new OwnerJournal.PriorStage(admissionBytes,reservedBytes,Array.Empty<byte>(),Array.Empty<ReportEvidence>())}).ToArray(),ownerNow));
            if(ownerHistory.Count>0) {
                Reject(()=>OwnerJournal.ValidatePrior(owner,ownerHistory.Skip(1).ToArray(),ownerNow));
                void BadPrior(OwnerJournal.PriorStage bad) {
                    var rows=ownerHistory.ToArray();rows[0]=bad;Reject(()=>OwnerJournal.ValidatePrior(owner,rows,ownerNow));
                }
                var row=ownerHistory[0];var old=Program.Parse<OwnerConsumed>(row.Slot);
                foreach(var bad in new[]{old with {DecisionId=decision.DecisionId},old with {OwnerSid="S-1-5-21-9-8-7-1001"},
                    old with {State="COMPLETED"},old with {PlanSha256=h},old with {BindingSha256=h},old with {ControllerInputSha256=h},
                    old with {OwnerContextSha256=h},old with {ConfirmationSha256=h},old with {OwnerDecisionSha256=h},
                    old with {BootIdentity=new string('f',64)},old with {ReservedUtc=ownerNow.AddHours(1)},old with {SecurityAccepted=true}})
                    BadPrior(row with {Slot=Program.Serialize(bad)});
                var completed=Program.Parse<StageCheckpoint>(row.Checkpoint);
                foreach(var bad in new[]{completed with {Stage="Finish"},completed with {EvidenceSha256=h},
                    completed with {LastEndedUtc=ownerNow.AddHours(1)},completed with {RunIds=Array.Empty<string>()},completed with {ProductionAccepted=true}})
                    BadPrior(row with {Checkpoint=Program.Serialize(bad)});
                BadPrior(row with {Plan=row.Plan.Concat(new byte[]{32}).ToArray()});
                BadPrior(row with {Reports=row.Reports[..^1]});
                BadPrior(row with {Reports=row.Reports.Select((x,i)=>i==0?x with {Bytes=new byte[]{1}}:x).ToArray()});
                if(ownerHistory.Count==2) {
                    Reject(()=>OwnerJournal.ValidatePrior(owner,ownerHistory.AsEnumerable().Reverse().ToArray(),ownerNow));
                    var rows=ownerHistory.ToArray();var second=Program.Parse<OwnerConsumed>(rows[1].Slot);
                    rows[1]=rows[1] with {Slot=Program.Serialize(second with {DecisionId=old.DecisionId})};
                    Reject(()=>OwnerJournal.ValidatePrior(owner,rows,ownerNow));
                }
            }
            Reject(()=>OwnerJournal.Build(owner,contextHash,new string('a',64),decision.ExpiresUtc));
            Reject(()=>OwnerJournal.ValidateReadback(reservedBytes.Concat(new byte[]{32}).ToArray(),reserved));
            foreach(var badRecord in new[]{reserved with {State="COMPLETED"},reserved with {Scope=Program.Scope},reserved with {Stage="Unknown"},
                reserved with {OwnerSid="S-1-5-18"},reserved with {SecurityAccepted=true},reserved with {ProductionAccepted=true},
                reserved with {PlanSha256=new string('f',64)},reserved with {DecisionId=new string('f',32)}})
                Reject(()=>OwnerJournal.ValidateReadback(Program.Serialize(badRecord),reserved));
            using(var document=JsonDocument.Parse(reservedBytes)) {
                foreach(var member in document.RootElement.EnumerateObject()) {
                    var map=document.RootElement.EnumerateObject().Where(x=>x.Name!=member.Name).ToDictionary(x=>x.Name,x=>x.Value);
                    try {Program.Parse<OwnerConsumed>(Program.Serialize(map));throw new InvalidDataException("OWNER_REQUIRED_FIELD_ACCEPTED");}
                    catch(JsonException){count++;}
                }
            }
            var slot=OwnerJournal.FileOf(stage);var slotRule=SecureFiles.Rule(slot,g,app,p);
            Program.Need(slotRule.Owner=="S-1-5-32-544" && slotRule.Creator=="Controller" && !slotRule.Directory &&
                slotRule.Aces.SequenceEqual(new[]{("S-1-5-18",0x1f01ff),("S-1-5-32-544",0x1f01ff)}),"OWNER_SLOT_ACL_FAILED");count++;
            Reject(()=>OwnerJournal.FileOf("../escape"));Reject(()=>SecureFiles.Rule("controller/owner-other-consumed.json",g,app,p));
            // Managed restart/concurrency model only. Actual CreateNew and disk
            // replay/flush/ACL behavior remains native NOT_RUN.
            var model=new Dictionary<string,byte[]>(StringComparer.Ordinal);Program.Need(model.TryAdd(slot,reservedBytes),"OWNER_MODEL_RESERVE_FAILED");count++;
            var restarted=new Dictionary<string,byte[]>(model,StringComparer.Ordinal);
            Program.Need(!restarted.TryAdd(slot,Program.Serialize(reserved with {DecisionId=new string('f',32)})),"OWNER_MODEL_REPLAY_FAILED");count++;
            restarted[slot]=Array.Empty<byte>();Program.Need(!restarted.TryAdd(slot,reservedBytes),"OWNER_MODEL_PARTIAL_REPLAY_FAILED");count++;
            int winners=0;var concurrent=new System.Collections.Concurrent.ConcurrentDictionary<string,byte[]>();
            Parallel.For(0,8,_=>{if(concurrent.TryAdd(slot,reservedBytes))Interlocked.Increment(ref winners);});
            Program.Need(winners==1,"OWNER_MODEL_RACE_FAILED");count++;
            var mutatedOwnerPlan=owner.Snapshot;mutatedOwnerPlan.PackageFiles[0]=package[0] with {Size=5};
            Program.Need(Program.Hash(Program.Serialize(owner.Snapshot))==planHash,"OWNER_ALIAS_FAILED");count++;
            Reject(()=>OwnerAdmission.Validate(ownerBytes,new string('f',64),ownerSid,ownerNow));
            Reject(()=>OwnerAdmission.Validate(ownerBytes,decisionHash,"S-1-5-18",ownerNow));
            Reject(()=>OwnerAdmission.Validate(ownerBytes,decisionHash,"S-1-5-21-1-2-3-1002",ownerNow));
            foreach(var badDecision in new[]{decision with {SchemaVersion=2},decision with {Scope=Program.Scope},
                decision with {Decision="APPROVE_PRODUCTION"},decision with {DecisionId=exp},decision with {DecisionId=p.Runs[0].RunId},
                decision with {ControllerInputSha256=new string('f',64)},decision with {BindingSha256=new string('f',64)},
                decision with {Stage="Unknown"},decision with {ExperimentId=new string('f',32)},
                decision with {IssuedUtc=ownerNow.AddMinutes(1)},decision with {ExpiresUtc=ownerNow},
                decision with {ExpiresUtc=decision.IssuedUtc.AddHours(25)},decision with {IssuedUtc=decision.IssuedUtc.ToOffset(TimeSpan.FromHours(1))},
                decision with {SecurityAccepted=true},decision with {ProductionAccepted=true}})
                Reject(()=>OwnerAdmission.Validate(OwnerBytes(badDecision),Program.Hash(Program.Serialize(badDecision)),ownerSid,ownerNow));
            Reject(()=>owner.Consume(decision.ExpiresUtc));
            if(stage=="Prepare") {
                Reject(()=>owner.Consume(ownerNow));owner.BeginBootstrap(ownerNow);count++;
                Reject(()=>owner.BeginBootstrap(ownerNow));Reject(()=>owner.Consume(ownerNow));
                Reject(()=>OwnerAdmission.ValidateBootstrapServices(p,Array.Empty<ServiceReceipt>()));
                OwnerAdmission.ValidateBootstrapServices(p,services);count++;
                Reject(()=>owner.CompleteBootstrap(null));
            } else Reject(()=>owner.BeginBootstrap(ownerNow));
            if(stage!="Prepare") {Program.Need(Program.Hash(Program.Serialize(owner.Consume(ownerNow)))==planHash,"OWNER_CONSUME_FAILED");count++;}
            Reject(()=>owner.Consume(ownerNow));
            var replay=OwnerAdmission.Validate(ownerBytes,decisionHash,ownerSid,ownerNow);
            count+=OwnerReservation.SelfTest(owner,replay,reserved);
            Reject(()=>{if(stage=="Prepare")replay.BeginBootstrap(ownerNow);else replay.Consume(ownerNow);});
            Program.Need(Program.Hash(Program.Serialize(ControllerAdmission.ValidateExternal(requestBytes,requestHash)))==planHash,"EXTERNAL_INPUT_FAILED");count++;
            Reject(()=>ControllerAdmission.ValidateExternal(requestBytes,new string('f',64)));
            Reject(()=>ControllerAdmission.ValidateExternal(requestBytes,""));
            foreach(var wrongRequest in new[]{request with {SchemaVersion=2},request with {Scope=Program.Scope},
                request with {Binding=binding with {HostBindingSha256=new string('f',64)}},
                request with {Plan=p with {OwnerAuthorized=false}},request with {Plan=p with {BuiltKitReviewed=false}}}) {
                var altered=Program.Serialize(wrongRequest);
                Reject(()=>ControllerAdmission.ValidateExternal(altered,Program.Hash(altered)));
            }
            var nullPlan=Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"scope\":\"TEST_ONLY_CONTROLLER_INPUT_V1\",\"plan\":null,\"binding\":null}");
            Reject(()=>ControllerAdmission.ValidateExternal(nullPlan,Program.Hash(nullPlan)));
            var duplicate=Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"schemaVersion\":1}");
            Reject(()=>ControllerAdmission.ValidateExternal(duplicate,Program.Hash(duplicate)));
            var extra=requestBytes[..^1].Concat(Encoding.UTF8.GetBytes(",\"execute\":true}")).ToArray();
            try {ControllerAdmission.ValidateExternal(extra,Program.Hash(extra));throw new InvalidDataException("EXTRA_INPUT_ACCEPTED");}
            catch(JsonException){count++;}
            Program.Need(Program.Serialize(admitted).SequenceEqual(admissionBytes) && !ReferenceEquals(admitted.PackageFiles,p.PackageFiles),"CONTROLLER_SNAPSHOT_FAILED");count++;
            foreach(var wrong in new[]{binding with {Stage="Unknown"},binding with {ExperimentId=new string('f',32)},
                binding with {PlanSha256=new string('f',64)},binding with {SuccessorPacketSha256=""},
                binding with {HostBindingSha256=new string('f',64)},binding with {BootIdentity=new string('f',64)},
                binding with {SourceManifestSha256=new string('f',64)},binding with {ProvenanceSha256=new string('f',64)},
                binding with {KitManifestSha256=new string('f',64)},binding with {PackageManifestSha256=new string('f',64)},
                binding with {DependencyInventorySha256=new string('f',64)},binding with {ProfileSha256=new string('f',64)},
                binding with {PreviousCheckpointSha256=new string('f',64)},binding with {PreviousEvidenceSha256=new string('f',64)}})
                Reject(()=>ControllerAdmission.Validate(admissionBytes,wrong));
            var spaced=admissionBytes.Concat(new byte[]{32}).ToArray();
            Reject(()=>ControllerAdmission.Validate(spaced,binding with {PlanSha256=Program.Hash(spaced)}));
            foreach(var unauthorized in new[]{p with {OwnerAuthorized=false},p with {BuiltKitReviewed=false}}) {
                var changed=Program.Serialize(unauthorized);
                Reject(()=>ControllerAdmission.Validate(changed,binding with {PlanSha256=Program.Hash(changed)}));
            }
            Reject(()=>ControllerAdmission.Validate(Array.Empty<byte>(),binding));
            admissionBytes[0]=0;Program.Need(Program.Hash(Program.Serialize(admitted))==planHash,"CONTROLLER_INPUT_ALIAS_FAILED");count++;
            if(stage=="Prepare") {
                BootstrapAdmission.SuccessorContext(p,planHash,Program.SuccessorPacketSha256);count++;
                Reject(()=>BootstrapAdmission.SuccessorContext(p,new string('f',64),Program.SuccessorPacketSha256));
                Reject(()=>BootstrapAdmission.SuccessorContext(p,planHash,new string('f',64)));
                Reject(()=>BootstrapAdmission.SuccessorContext(p,planHash,""));
                var content=new byte[]{1};var entries=package.Select(f=>f with {Sha256=Program.Hash(content)}).ToArray();
                var copyPlan=p with {PackageFiles=entries,DependencyInventorySha256=Program.Hash(Program.Serialize(entries))};
                var input=entries.Select(f=>new PackageBytes(f.Name,(byte[])content.Clone())).ToArray();
                var snapshot=BootstrapAdmission.SnapshotPackage(copyPlan,input);input[0].Bytes[0]=2;
                Program.Need(snapshot[0].Bytes[0]==1 && !ReferenceEquals(input[0].Bytes,snapshot[0].Bytes),"PACKAGE_SNAPSHOT_FAILED");count++;
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,input));input[0].Bytes[0]=1;
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,input[..1]));
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,input.Concat(new[]{input[0]}).ToArray()));
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,input.Reverse().ToArray()));
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,new[]{input[0],input[0]}));
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,new[]{input[0] with {Name="../escape"},input[1]}));
                Reject(()=>BootstrapAdmission.SnapshotPackage(copyPlan,new[]{input[0] with {Bytes=Array.Empty<byte>()},input[1]}));
                foreach(string dir in BootstrapAdmission.PublicDirectories){Program.Need(SecureFiles.Rule(dir,g,app,directory:true).Creator=="Controller","PUBLIC_BOOTSTRAP_RULE_FAILED");count++;}
            } else Reject(()=>BootstrapAdmission.SuccessorContext(p,planHash,Program.SuccessorPacketSha256));
            for(int i=0;i<runs.Length;i++) {
                var run=runs[i];bool child=run.Role=="Child";var begin=start.AddSeconds(child?i*10-8:i*10);var end=begin.AddSeconds(child?3:run.Role=="App"?15:5);var time=end.AddSeconds(-1);
                int pid=1000+id+i;string user=run.Role=="Setup"?"S-1-5-18":run.Role=="Guardian"?g:app;
                var results=RoleActions.ResultIds(run.Action).Select(resultId=>resultId=="restricted-open"?
                    RoleActions.RestrictedResult(run.Action,unchecked((int)0x80090016),1):run.Action=="guardian-absence"?
                    RoleActions.AbsenceResult(resultId.StartsWith("restricted",StringComparison.Ordinal)?"restricted":"app-readable",unchecked((int)0x80090016),1):
                    new PilotResult(resultId,"PASS","VERIFIED",run.Action,null,1)).ToArray();
                var report=new PilotReport(2,Program.Scope,stage,run.Action,run.Role,run.RunId,exp,planHash,h,h,h,h,h,h,p.DependencyInventorySha256,h,h,
                    "10.0.11","FIXTURE","X64",pid,h,time,1,user,user,1,0,run.Role=="Setup"?"S-1-5-80-11-12-13-14-15":user,4,true,true,true,results,"NONE",false,false,false,new[]{"ALL_PHYSICAL_OPERATIONS"});
                var bytes=ReportEmitter.Encode(report);receipts.Add(new(run.Action,run.RunId,pid,begin,end));evidence.Add(new(run.RunId,Program.Hash(bytes),bytes));
            }
            var items=evidence.ToArray();var processes=receipts.ToArray();
            foreach(var item in p.Runs.Select((run,i)=>(run,i))){ValidateSingle(p,planHash,item.run,items[item.i],processes[item.i],services,previous);count++;}
            Reject(()=>ValidateSingle(p,planHash,p.Runs[0],items[0] with {RunId=new string('f',32)},processes[0],services,previous));
            Reject(()=>ValidateSingle(p,planHash,p.Runs[0],items[0],processes[0] with {ProcessId=1},services,previous));
            var observations=items.Select((e,i)=>{var r=Program.Parse<PilotReport>(e.Bytes);
                return new ProcessObservation(processes[i],r.Token(),
                    SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe"),r.Role=="Child"?processes.Single(x=>x.Action.StartsWith("app-",StringComparison.Ordinal)).ProcessId:4,h);}).ToArray();
            Program.Need(ProcessObserver.Validate(p,items,observations).SequenceEqual(processes),"OBSERVATION_CHAIN_FAILED");count++;
            void ObservationReject(Func<ProcessObservation,ProcessObservation> mutate) {
                var changed=(ProcessObservation[])observations.Clone();changed[0]=mutate(changed[0]);Reject(()=>ProcessObserver.Validate(p,items,changed));
            }
            Reject(()=>ProcessObserver.Validate(p,items,observations[..^1]));
            ObservationReject(o=>o with {Image="C:/other.exe"});ObservationReject(o=>o with {BootIdentity=new string('f',64)});
            ObservationReject(o=>o with {Token=o.Token with {Owner="OTHER"}});
            ObservationReject(o=>o with {Token=o.Token with {Type=2}});
            ObservationReject(o=>o with {Token=o.Token with {Attributes=16}});
            ObservationReject(o=>o with {Token=o.Token with {GroupCount=0}});
            ObservationReject(o=>o with {Token=o.Token with {Restricted=true}});
            ObservationReject(o=>o with {Token=o.Token with {QueryComplete=false}});
            ObservationReject(o=>o with {Token=o.Token with {Elevation=2}});
            ObservationReject(o=>o with {Receipt=o.Receipt with {ProcessId=o.Receipt.ProcessId+1}});
            ObservationReject(o=>o with {Receipt=o.Receipt with {StartedUtc=o.Receipt.EndedUtc}});
            ObservationReject(o=>o with {Receipt=o.Receipt with {RunId=new string('e',32)}});
            if(stage!="Finish") {
                int childIndex=Array.FindIndex(observations,o=>o.Receipt.Action.StartsWith("child-",StringComparison.Ordinal));
                var badChild=(ProcessObservation[])observations.Clone();badChild[childIndex]=badChild[childIndex] with {ParentPid=9999};
                Reject(()=>ProcessObserver.Validate(p,items,badChild));
                badChild=(ProcessObservation[])observations.Clone();badChild[childIndex]=badChild[childIndex] with {Token=badChild[childIndex].Token with {Elevation=1}};
                Reject(()=>ProcessObserver.Validate(p,items,badChild));
            }
            StageCheckpoint Accept(ReportEvidence[] e,ProcessReceipt[] proc,ServiceReceipt[] svc,PilotPlan? plan=null)=>Validate(plan??p,plan is null?planHash:Program.Hash(Program.Serialize(plan)),e,proc,svc,h,previous);
            var checkpoint=Accept(items,processes,services);count++;
            // New shape must pass both controller validators and independent observation matching.
            var absentItems=items.Select(e=>{
                var r=Program.Parse<PilotReport>(e.Bytes);
                if(r.Role!="Setup")r=r with {ServiceSidGroupCount=0,ServiceSidAttributes=0};
                var raw=ReportEmitter.Encode(r);return e with {Bytes=raw,Sha256=Program.Hash(raw)};
            }).ToArray();
            Accept(absentItems,processes,services);count++;
            var absentObservations=observations.Select((o,i)=>o with {Token=Program.Parse<PilotReport>(absentItems[i].Bytes).Token()}).ToArray();
            ProcessObserver.Validate(p,absentItems,absentObservations);count++;
            Reject(()=>ProcessObserver.Validate(p,absentItems,observations));
            foreach(var mutation in new Func<PilotReport,PilotReport>[] {
                r=>r with {ServiceSidGroupCount=2},r=>r with {TokenRestricted=true},
                r=>r with {TokenQueryComplete=false},r=>r with {SchemaVersion=1},
                r=>r with {ServiceSidAttributes=16},r=>r with {TokenUserSid="S-1-5-18-WRONG"}}) {
                var changed=(ReportEvidence[])absentItems.Clone();
                int index=Array.FindIndex(p.Runs,r=>r.Role=="Guardian");
                var raw=Program.Serialize(mutation(Program.Parse<PilotReport>(changed[index].Bytes)));
                changed[index]=changed[index] with {Bytes=raw,Sha256=Program.Hash(raw)};
                Reject(()=>Accept(changed,processes,services));
                Reject(()=>ValidateSingle(p,planHash,p.Runs[index],changed[index],processes[index],services,previous));
            }
            Reject(()=>Accept(items[..^1],processes,services));Reject(()=>Accept(items.Concat(new[]{items[0]}).ToArray(),processes,services));
            Reject(()=>Accept(items,processes[..^1],services));Reject(()=>Accept(items,processes,services[..^1]));
            Reject(()=>Accept(items,processes,new[]{services[0] with {State="Running",ProcessId=1},services[1],services[2]}));
            Reject(()=>Accept(items,processes,new[]{services[0] with {StartMode="Automatic"},services[1],services[2]}));
            Reject(()=>Accept(items,processes,new[]{services[0],services[0],services[2]}));
            Reject(()=>Accept(items,processes,new[]{services[0] with {Sid=g},services[1],services[2]}));
            Reject(()=>Accept(items.Select((e,i)=>i==0?e with {Sha256=h}:e).ToArray(),processes,services));
            Reject(()=>Accept(items,processes.Select((e,i)=>i==0?e with {ProcessId=e.ProcessId+999}:e).ToArray(),services));
            Reject(()=>Accept(items,processes.Select((e,i)=>i==0?e with {StartedUtc=e.EndedUtc}:e).ToArray(),services));
            var first=Program.Parse<PilotReport>(items[0].Bytes);
            foreach(var bad in new[]{first with {PlanSha256=new('c',64)},first with {TokenOwnerSid="S-1-5-32-544"},first with {BootIdentity=new('c',64)},first with {TimeUtc=DateTimeOffset.MinValue},first with {Results=first.Results.Select((x,i)=>i==0?x with {Status="UNKNOWN",ReasonCode="OPERATION_UNKNOWN"}:x).ToArray()}}) {
                var raw=Program.Serialize(bad);Reject(()=>Accept(items.Select((e,i)=>i==0?e with {Bytes=raw,Sha256=Program.Hash(raw)}:e).ToArray(),processes,services));
            }
            if(previous is not null){Reject(()=>Accept(items,processes,services,p with {PreviousEvidenceSha256=h}));
                Reject(()=>Accept(items,processes.Select((e,i)=>i==0?e with {StartedUtc=DateTimeOffset.UnixEpoch}:e).ToArray(),services));}
            // Managed historical fixtures only; never native reservation authority.
            ownerHistory.Add(new(Program.Serialize(p),Program.Serialize(reserved with {ReservedUtc=start}),Program.Serialize(checkpoint),items));
            previous=checkpoint;start=start.AddMinutes(5);
        }
        Program.Need(previous!.RunIds.Length==10 && ServiceActions("Prepare").Length==4 && ServiceActions("VerifyFreshProcess").Length==2,"CONTROLLER_SEQUENCE_TEST_FAILED");count++;
        Reject(()=>ServiceActions("Unknown"));return count;
    }
}
