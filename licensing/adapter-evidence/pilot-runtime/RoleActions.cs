namespace EntryControl.TestOnly.Runtime;
internal sealed record ExpectedFixtureHash(int SchemaVersion,string ExperimentId,string Label,string Sha256);
internal static class RoleActions
{
    internal static bool Supports(string role,string action)=>PlanAdmission.Actions.Contains(action) && PlanAdmission.Actor(action)==role;
    internal static string StageOf(string action)=>Array.IndexOf(PlanAdmission.Actions,action) switch {
        >=0 and <5=>"Prepare",>=5 and <8=>"VerifyFreshProcess",>=8 and <10=>"Finish",_=>throw new InvalidDataException("ACTION_NOT_IMPLEMENTED")};
    internal static string[] ResultIds(string action)=>action switch {
        "setup-create"=>new[]{"create-private-directories","restricted-create-owned","app-readable-create-owned","publish-public-control"},
        "guardian-prepare"=>new[]{"restricted-seal-stage","app-readable-seal-stage"},
        "setup-publish"=>new[]{"restricted-copy-publish","app-readable-copy-publish"},
        "app-prepare" or "app-fresh"=>new[]{"restricted-open","app-readable-open-decrypt","child-execution-report"},
        "child-prepare" or "child-fresh"=>new[]{"restricted-open","app-readable-open-decrypt"},
        "guardian-fresh"=>new[]{"restricted-reopen-mutations","app-readable-reopen-mutations"},
        "setup-finish"=>new[]{"verify-both-owned-keys","restricted-delete","app-readable-delete"},
        "guardian-absence"=>new[]{"restricted-absence-open","app-readable-absence-open"},
        _=>throw new InvalidDataException("ACTION_NOT_IMPLEMENTED")};
    // Not reachable from executable Main until controller/kit review is complete.
    internal static void Execute(string role,string action,string approvedPlanHash)
    {
        Program.Need(Supports(role,action),"ACTION_NOT_IMPLEMENTED");
        var admitted=PlanAdmission.Admit(role,action,approvedPlanHash);var p=admitted.Plan;var run=admitted.Run;
        var token=NativeTokens.Capture(role);string boot=NativeTokens.BootIdentity();
        Program.Need(boot==p.BootIdentity,"BOOT_CONTEXT_REFUSED");
        if(action=="setup-finish"){Finish(p,run,approvedPlanHash,token,boot);return;}
        var total=Stopwatch.StartNew();var results=new List<PilotResult>();bool unknown=false;
        void Step(string id,int budget,Action work) {
            if(unknown)return;var elapsed=Stopwatch.StartNew();
            try {NativeWorker.Run(()=>{work();return true;},budget);results.Add(new(id,"PASS","VERIFIED",action,null,elapsed.ElapsedMilliseconds));}
            catch(Exception ex){unknown=true;results.Add(new(id,"UNKNOWN","OPERATION_UNKNOWN",action,ex is CryptographicException?ex.HResult:null,elapsed.ElapsedMilliseconds));}
        }
        if(action=="setup-create") {
            Step("create-private-directories",5000,()=>{foreach(string d in new[]{"shared","protected","guardian-work"})SecureFiles.CreateDirectory(d,role,p.GuardianSid,p.AppSid);});
            foreach(string label in KeyOperations.Labels)Step(label+"-create-owned",10000,()=>{
                Write(p,"protected/"+label+"-intent.json",Program.Serialize(new KeyIntent(1,p.ExperimentId,label,KeyOperations.Name(p,label))),role);
                using var key=KeyOperations.Create(p,label);string hash=KeyOperations.VerifyNewlyPersisted(key,p,label);
                Write(p,"protected/"+label+"-owned.json",Program.Serialize(new KeyOwned(1,p.ExperimentId,label,KeyOperations.Name(p,label),hash)),role);
                KeyOperations.Owned(p,label);
            });
            Step("publish-public-control",5000,()=>Write(p,"shared/public-control.json",Program.Serialize(new PublicControl(1,p.ExperimentId,
                KeyOperations.Labels.Select(label=>KeyOperations.Owned(p,label)).ToArray())),role));
        } else if(action=="guardian-prepare") {
            foreach(string label in KeyOperations.Labels)Step(label+"-seal-stage",10000,()=>{
                var owned=OwnedPublic(p,label);using var key=KeyOperations.Open(p,label);KeyOperations.Verify(key,p,label,owned.PublicSha256);
                KeyOperations.ExportDenied(key);var fixture=KeyOperations.Seal(key,p,owned.PublicSha256);
                Write(p,"guardian-work/"+label+"-envelope.bin",fixture.Envelope,role);
                Write(p,"guardian-work/"+label+"-expected-hash.json",Program.Serialize(new ExpectedFixtureHash(1,p.ExperimentId,label,fixture.ExpectedHash)),role);
            });
        } else if(action=="setup-publish") {
            foreach(string label in KeyOperations.Labels)Step(label+"-copy-publish",10000,()=>{
                var owned=OwnedPublic(p,label);using var key=KeyOperations.Open(p,label);KeyOperations.Verify(key,p,label,owned.PublicSha256);
                string envelopeName=label+"-envelope.bin",hashName=label+"-expected-hash.json";
                byte[] envelope=Read(p,"guardian-work/"+envelopeName),hashBytes=Read(p,"guardian-work/"+hashName);
                var expected=Program.Parse<ExpectedFixtureHash>(hashBytes);
                Program.Need(expected.SchemaVersion==1 && expected.ExperimentId==p.ExperimentId && expected.Label==label && Program.Hex(expected.Sha256,64),"STAGING_CONTEXT_REFUSED");
                KeyOperations.OpenFixture(key,p,owned.PublicSha256,envelope,expected.Sha256);
                Write(p,"shared/"+envelopeName,envelope,role);Write(p,"shared/"+hashName,hashBytes,role);
                Program.Need(Read(p,"shared/"+envelopeName).SequenceEqual(envelope) && Read(p,"shared/"+hashName).SequenceEqual(hashBytes),"PUBLICATION_DIGEST_REFUSED");
            });
        } else if(action=="guardian-fresh") {
            foreach(string label in KeyOperations.Labels)Step(label+"-reopen-mutations",10000,()=>{
                var owned=OwnedPublic(p,label);using var key=KeyOperations.Open(p,label);KeyOperations.Verify(key,p,label,owned.PublicSha256);
                var envelope=Read(p,"shared/"+label+"-envelope.bin");var expected=Program.Parse<ExpectedFixtureHash>(Read(p,"shared/"+label+"-expected-hash.json"));
                ValidateFixtureHash(p,label,expected);KeyOperations.OpenFixture(key,p,owned.PublicSha256,envelope,expected.Sha256);
                KeyOperations.MutationMatrix(key,p,owned.PublicSha256,envelope,expected.Sha256);KeyOperations.ExportDenied(key);
            });
        } else if(action=="guardian-absence") {
            foreach(string label in KeyOperations.Labels) {
                if(unknown)break;var elapsed=Stopwatch.StartNew();
                try {int status=NativeWorker.Run(()=>{OwnedPublic(p,label);return KeyOperations.OpenStatus(p,label);},5000);
                    var probe=AbsenceResult(label,status,elapsed.ElapsedMilliseconds);results.Add(probe);unknown=probe.Status is "UNKNOWN" or "FAIL";
                } catch(Exception ex){unknown=true;results.Add(new(label+"-absence-open","UNKNOWN","OPERATION_UNKNOWN",action,ex is CryptographicException?ex.HResult:null,elapsed.ElapsedMilliseconds));}
            }
        } else {
            if(!unknown) {
                var elapsed=Stopwatch.StartNew();
                try {int status=NativeWorker.Run(()=>KeyOperations.OpenStatus(p,"restricted"),5000);
                    var probe=RestrictedResult(action,status,elapsed.ElapsedMilliseconds);results.Add(probe);
                    unknown=probe.Status is "UNKNOWN" or "FAIL";
                } catch(Exception ex){unknown=true;results.Add(new("restricted-open","UNKNOWN","OPERATION_UNKNOWN",action,ex is CryptographicException?ex.HResult:null,elapsed.ElapsedMilliseconds));}
            }
            Step("app-readable-open-decrypt",10000,()=>{
                // App/Child must never read protected ownership files or Guardian staging.
                var control=PublicOnly(p);var owned=control.Keys.Single(k=>k.Label=="app-readable");
                using var key=KeyOperations.Open(p,"app-readable");KeyOperations.Verify(key,p,"app-readable",owned.PublicSha256);
                var envelope=Read(p,"shared/app-readable-envelope.bin");
                var expected=Program.Parse<ExpectedFixtureHash>(Read(p,"shared/app-readable-expected-hash.json"));
                ValidateFixtureHash(p,"app-readable",expected);
                KeyOperations.OpenFixture(key,p,owned.PublicSha256,envelope,expected.Sha256);
            });
            if(role=="App")Step("child-execution-report",10000,()=>RunChild(p,approvedPlanHash,token,boot));
        }
        ReportEmitter.Write(p,run,admitted.PlanHash,token,boot,total.ElapsedMilliseconds,results.ToArray());
        Program.Need(!unknown,"ROLE_INCOMPLETE_RETAIN_STATE");
    }
    private static byte[] Read(PilotPlan p,string path)=>SecureFiles.Read(path,p.GuardianSid,p.AppSid,p);
    private static void Write(PilotPlan p,string path,byte[] bytes,string role)=>SecureFiles.Write(path,bytes,role,p.GuardianSid,p.AppSid,p);
    private static KeyOwned OwnedPublic(PilotPlan p,string label)
    {
        var owned=KeyOperations.Owned(p,label);var control=Program.Parse<PublicControl>(Read(p,"shared/public-control.json"));
        Program.Need(control.SchemaVersion==1 && control.ExperimentId==p.ExperimentId && control.Keys.Length==2 &&
            control.Keys.Select(k=>k.Label).SequenceEqual(KeyOperations.Labels) && control.Keys.Single(k=>k.Label==label)==owned,"PUBLIC_CONTROL_REFUSED");
        return owned;
    }
    internal static PilotResult RestrictedResult(string action,int status,long elapsed)
    {
        Program.Need(action is "app-prepare" or "child-prepare" or "app-fresh" or "child-fresh" && elapsed>=0,"PROBE_CONTEXT_REFUSED");
        // Observation only. Never promote BAD_KEYSET to proven denial/absence.
        return status==unchecked((int)0x80090016)?new("restricted-open","OBSERVED","RAW_BAD_KEYSET",action,status,elapsed):
            status==0?new("restricted-open","FAIL","RESTRICTED_OPEN_SUCCEEDED",action,0,elapsed):
            new("restricted-open","UNKNOWN","OPERATION_UNKNOWN",action,status,elapsed);
    }
    private static PublicControl PublicOnly(PilotPlan p)
    {
        var control=Program.Parse<PublicControl>(Read(p,"shared/public-control.json"));
        Program.Need(control.SchemaVersion==1 && control.ExperimentId==p.ExperimentId && control.Keys.Length==2 &&
            control.Keys.Select(k=>k.Label).SequenceEqual(KeyOperations.Labels) && control.Keys.All(k=>k.SchemaVersion==1 &&
                k.ExperimentId==p.ExperimentId && k.Name==KeyOperations.Name(p,k.Label) && Program.Hex(k.PublicSha256,64)),"PUBLIC_CONTROL_REFUSED");
        return control;
    }
    internal static ProcessStartInfo ChildStart(string planHash,string childAction="child-prepare")
    {
        Program.Need(Program.Hex(planHash,64),"CHILD_PLAN_HASH_REFUSED");
        Program.Need(childAction is "child-prepare" or "child-fresh","CHILD_ACTION_REFUSED");
        var start=new ProcessStartInfo {FileName=SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe"),
            WorkingDirectory=SecureFiles.PathOf("bin"),UseShellExecute=false,CreateNoWindow=true};
        foreach(string arg in new[]{"--child","Child",childAction,planHash})start.ArgumentList.Add(arg);
        SanitizeChildEnvironment(start);
        // No shell/runas/credentials/token replacement. The child uses the parent's
        // primary identity and independently rechecks token, package and plan.
        return start;
    }
    private static void SanitizeChildEnvironment(ProcessStartInfo start)
    {
        // Child-only copy: do not change the parent or system environment.
        foreach(string key in start.Environment.Keys.ToArray())if(new[]{"DOTNET_","COMPLUS_","CORECLR_","COR_"}.Any(prefix=>key.StartsWith(prefix,StringComparison.OrdinalIgnoreCase)))start.Environment.Remove(key);
    }
    private static void RunChild(PilotPlan p,string planHash,TokenSnapshot parent,string boot)
    {
        PlanAdmission.VerifyPackage(p);
        string childAction=p.Stage=="Prepare"?"child-prepare":"child-fresh";
        using var process=Process.Start(ChildStart(planHash,childAction))??throw new InvalidDataException("CHILD_START_FAILED");
        int pid=process.Id;
        // NativeWorker's deadline suppresses late results. Never Kill/StopService,
        // retry, elevate or release a still-running child on timeout.
        process.WaitForExit();Program.Need(process.ExitCode==0,"CHILD_EXIT_REFUSED");
        var run=p.Runs.Single(r=>r.Action==childAction);
        var bytes=Read(p,"app-reports/"+run.RunId+".json");var report=Program.Parse<PilotReport>(bytes);
        ValidateChild(p,planHash,parent,boot,pid,report);
    }
    internal static void ValidateChild(PilotPlan p,string planHash,TokenSnapshot parent,string boot,int pid,PilotReport r)
    {
        ReportEmitter.Encode(r);var run=p.Runs.Single(x=>x.Action==(p.Stage=="Prepare"?"child-prepare":"child-fresh"));
        Program.Need(r.Role=="Child" && r.Action==run.Action && r.Stage==p.Stage && r.RunId==run.RunId && r.ExperimentId==p.ExperimentId &&
            r.ProcessId==pid && r.ProcessId!=Environment.ProcessId && r.PlanSha256==planHash && r.BootIdentity==boot &&
            r.TokenUserSid==parent.User && r.TokenOwnerSid==parent.Owner && r.TokenType==parent.Type && r.Elevation==parent.Elevation &&
            r.ServiceSid==parent.Service && r.ServiceSidAttributes==parent.Attributes && r.ServiceSidGroupCount==parent.GroupCount && r.TokenRestricted==parent.Restricted && r.TokenQueryComplete==parent.QueryComplete && r.ArtifactIdentityMatched && r.WorkerEnded &&
            r.SourceManifestSha256==p.SourceManifestSha256 && r.ProvenanceSha256==p.ProvenanceSha256 && r.KitManifestSha256==p.KitManifestSha256 &&
            r.PackageManifestSha256==p.PackageManifestSha256 && r.DependencyInventorySha256==p.DependencyInventorySha256 &&
            r.HostBindingSha256==p.HostBindingSha256 && r.ProfileSha256==p.ProfileSha256 && r.Runtime=="10.0.11" && r.Architecture=="X64" &&
            r.ExecutorExeSha256==p.PackageFiles.Single(x=>x.Name=="EntryControl.AdapterPilot.exe").Sha256 &&
            r.LoadedAssemblySha256==p.PackageFiles.Single(x=>x.Name=="EntryControl.AdapterPilot.dll").Sha256 &&
            r.Results.Select(x=>x.Id).SequenceEqual(ResultIds(run.Action)) &&
            r.Results[0].Status=="OBSERVED" && r.Results[0].ReasonCode=="RAW_BAD_KEYSET" && r.Results[0].NativeStatus==unchecked((int)0x80090016) &&
            r.Results[1].Status=="PASS","CHILD_REPORT_CONTEXT_REFUSED");
    }
    private static void ValidateFixtureHash(PilotPlan p,string label,ExpectedFixtureHash expected)=>Program.Need(expected.SchemaVersion==1 &&
        expected.ExperimentId==p.ExperimentId && expected.Label==label && Program.Hex(expected.Sha256,64),"PUBLIC_FIXTURE_CONTEXT_REFUSED");
    internal static PilotResult AbsenceResult(string label,int status,long elapsed)
    {
        Program.Need(KeyOperations.Labels.Contains(label) && elapsed>=0,"ABSENCE_CONTEXT_REFUSED");
        return status==unchecked((int)0x80090016)?new(label+"-absence-open","OBSERVED","RAW_BAD_KEYSET","guardian-absence",status,elapsed):
            status==0?new(label+"-absence-open","FAIL","KEY_STILL_PRESENT","guardian-absence",0,elapsed):
            new(label+"-absence-open","UNKNOWN","OPERATION_UNKNOWN","guardian-absence",status,elapsed);
    }
    private static void Finish(PilotPlan p,Run run,string hash,TokenSnapshot token,string boot)
    {
        var clock=Stopwatch.StartNew();
        // Verify BOTH ownership chains/policies/retained fixtures before deleting either.
        NativeWorker.Run(()=>{foreach(string label in KeyOperations.Labels){var owned=OwnedPublic(p,label);
            using var key=KeyOperations.Open(p,label);KeyOperations.Verify(key,p,label,owned.PublicSha256);
            var expected=Program.Parse<ExpectedFixtureHash>(Read(p,"shared/"+label+"-expected-hash.json"));ValidateFixtureHash(p,label,expected);
            KeyOperations.OpenFixture(key,p,owned.PublicSha256,Read(p,"shared/"+label+"-envelope.bin"),expected.Sha256);}
            return true;},10000);
        // One newly created, verified report handle persists deletion intent and
        // each disposition. Never reopen/replace an old report or blindly resume.
        using var journal=SecureFiles.NewReport("setup-reports/"+run.RunId+".json","Setup",p);
        var disposition=DeleteSequence(label=>NativeWorker.Run(()=>{var owned=OwnedPublic(p,label);using var key=KeyOperations.Open(p,label);
            KeyOperations.Verify(key,p,label,owned.PublicSha256);key.Delete();return true;},10000),
            rows=>journal.Update(ReportEmitter.Build(p,run,hash,token,boot,clock.ElapsedMilliseconds,rows,false)));
        if(!disposition.Failed)journal.Update(ReportEmitter.Build(p,run,hash,token,boot,clock.ElapsedMilliseconds,disposition.Results,true));
        Program.Need(!disposition.Failed,"PARTIAL_DELETE_RETAIN_NO_RETRY");
    }
    // Caller must verify both chains before entry. Injected callbacks let the
    // real persistence-before-delete and stop-on-partial-failure ordering be
    // tested without opening files or deleting any key.
    internal static (bool Failed,PilotResult[] Results) DeleteSequence(Action<string> delete,Action<PilotResult[]> persist)
    {
        var results=new List<PilotResult>{new("verify-both-owned-keys","PASS","VERIFIED","setup-finish",null,0)};
        bool failed=false;
        foreach(string label in KeyOperations.Labels) {
            results.Add(new(label+"-delete","UNKNOWN","DELETE_STARTED","setup-finish",null,0));persist(results.ToArray());
            var step=Stopwatch.StartNew();
            try {delete(label);results[^1]=new(label+"-delete","PASS","VERIFIED","setup-finish",null,step.ElapsedMilliseconds);}
            catch(Exception ex){failed=true;results[^1]=new(label+"-delete","UNKNOWN","OPERATION_UNKNOWN","setup-finish",ex is CryptographicException?ex.HResult:null,step.ElapsedMilliseconds);}
            persist(results.ToArray());if(failed)break;
        }
        return(failed,results.ToArray());
    }
    internal static int SelfTest()
    {
        int count=0;void Check(bool ok){Program.Need(ok,"APP_CHILD_TEST_FAILED");count++;}
        void Reject(Action a){try{a();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("APP_CHILD_REFUSAL_MISSING");}
        string h=new('a',64),id=new('b',32),experiment=new('c',32),sid="S-1-5-80-1-2-3-4-5";
        var observed=RestrictedResult("child-prepare",unchecked((int)0x80090016),1);
        Check(observed.Status=="OBSERVED" && observed.ReasonCode=="RAW_BAD_KEYSET");
        Check(RestrictedResult("app-prepare",0,1).Status=="FAIL");
        foreach(int status in new[]{unchecked((int)0x80090010),unchecked((int)0x8009000b),-1,5})Check(RestrictedResult("app-prepare",status,1).Status=="UNKNOWN");
        Reject(()=>RestrictedResult("guardian-prepare",0,1));Reject(()=>RestrictedResult("app-prepare",0,-1));
        var start=ChildStart(h);Check(!start.UseShellExecute && start.CreateNoWindow && string.IsNullOrEmpty(start.UserName));
        Check(start.ArgumentList.SequenceEqual(new[]{"--child","Child","child-prepare",h}));
        Check(start.FileName==SecureFiles.PathOf("bin/EntryControl.AdapterPilot.exe") && start.WorkingDirectory==SecureFiles.PathOf("bin"));
        foreach(string key in new[]{"DOTNET_STARTUP_HOOKS","dotnet_root","COMPlus_Profiler","COR_ENABLE_PROFILING","CORECLR_PROFILER"})start.Environment[key]="INERT_CANARY";
        start.Environment["PILOT_INERT_CANARY"]="KEEP";SanitizeChildEnvironment(start);
        Check(!start.Environment.Keys.Any(key=>new[]{"DOTNET_","COMPLUS_","CORECLR_","COR_"}.Any(prefix=>key.StartsWith(prefix,StringComparison.OrdinalIgnoreCase))));
        Check(start.Environment["PILOT_INERT_CANARY"]=="KEEP");
        Reject(()=>ChildStart("bad hash"));
        var p=new PilotPlan(1,Program.Scope,"Prepare",experiment,"S-1-5-80-6-7-8-9-10",sid,h,h,h,h,h,h,h,h,"","",
            new[]{new PackageFile("EntryControl.AdapterPilot.exe",1,h),new PackageFile("EntryControl.AdapterPilot.dll",1,h)},
            new[]{new Run("child-prepare","Child",id)},Array.Empty<string>(),true,true);
        var token=new TokenSnapshot(sid,sid,1,0,sid,4,1,false,true);int pid=Environment.ProcessId+1;
        var r=new PilotReport(2,Program.Scope,"Prepare","child-prepare","Child",id,experiment,h,h,h,h,h,h,h,h,h,h,
            "10.0.11","FIXTURE","X64",pid,h,DateTimeOffset.UnixEpoch,1,sid,sid,1,0,sid,4,true,true,true,
            new[]{observed,new PilotResult("app-readable-open-decrypt","PASS","VERIFIED","child-prepare",null,1)},
            "NONE",false,false,false,new[]{"ALL_PHYSICAL_OPERATIONS"});
        void Accept(PilotReport report)=>ValidateChild(p,h,token,h,pid,report);
        Accept(r);count++;
        foreach(var changed in new[]{r with {ProcessId=Environment.ProcessId},r with {RunId=new('d',32)},
            r with {ExperimentId=new('d',32)},r with {PlanSha256=new('d',64)},r with {BootIdentity=new('d',64)},
            r with {TokenOwnerSid="S-1-5-18"},r with {TokenUserSid="S-1-5-18"},r with {Elevation=1},
            r with {ServiceSid="S-1-5-80-6-7-8-9-10"},r with {ServiceSidAttributes=16},r with {TokenType=2},
            r with {ServiceSidGroupCount=0},r with {TokenRestricted=true},r with {TokenQueryComplete=false},
            r with {ExecutorExeSha256=new('d',64)},r with {LoadedAssemblySha256=new('d',64)},
            r with {SourceManifestSha256=new('d',64)},r with {ProvenanceSha256=new('d',64)},r with {KitManifestSha256=new('d',64)},
            r with {PackageManifestSha256=new('d',64)},r with {DependencyInventorySha256=new('d',64)},
            r with {ProfileSha256=new('d',64)},r with {HostBindingSha256=new('d',64)},r with {Runtime="10.0.10"},
            r with {Architecture="X86"},r with {WorkerEnded=false},r with {Results=r.Results.Reverse().ToArray()},
            r with {Results=new[]{observed}},r with {Results=new[]{observed with {Status="PASS",ReasonCode="VERIFIED",NativeStatus=null},r.Results[1]}}})Reject(()=>Accept(changed));
        Reject(()=>Accept(r with {Results=new[]{observed with {ReasonCode="KEY_DENIED"},r.Results[1]}}));
        Reject(()=>Accept(r with {Results=new[]{observed with {NativeStatus=5},r.Results[1]}}));
        Check(Supports("App","app-prepare") && Supports("Child","child-prepare"));
        Check(!Supports("App","child-prepare") && !Supports("Child","app-prepare"));
        foreach(string action in PlanAdmission.Actions){Check(Supports(PlanAdmission.Actor(action),action));Check(ResultIds(action).Distinct().Count()==ResultIds(action).Length);}
        Check(StageOf("guardian-fresh")=="VerifyFreshProcess" && StageOf("setup-finish")=="Finish");Reject(()=>StageOf("unknown"));
        Check(ChildStart(h,"child-fresh").ArgumentList.SequenceEqual(new[]{"--child","Child","child-fresh",h}));Reject(()=>ChildStart(h,"child-unknown"));
        var fresh=p with {Stage="VerifyFreshProcess",Runs=new[]{new Run("child-fresh","Child",id)}};
        var freshReport=r with {Stage="VerifyFreshProcess",Action="child-fresh",Results=r.Results.Select(x=>x with {Stage="child-fresh"}).ToArray()};
        ValidateChild(fresh,h,token,h,pid,freshReport);count++;
        Reject(()=>ValidateChild(fresh,h,token,h,pid,r));Reject(()=>ValidateChild(p,h,token,h,pid,freshReport));
        foreach(string label in KeyOperations.Labels){Check(AbsenceResult(label,unchecked((int)0x80090016),1).Status=="OBSERVED");Check(AbsenceResult(label,0,1).Status=="FAIL");Check(AbsenceResult(label,5,1).Status=="UNKNOWN");}
        Reject(()=>AbsenceResult("not-owned",0,1));Reject(()=>AbsenceResult("restricted",0,-1));
        var log=new List<string>();
        var success=DeleteSequence(label=>log.Add("delete:"+label),rows=>log.Add(rows[^1].ReasonCode+":"+rows[^1].Id));
        Check(!success.Failed && success.Results.Length==3 && success.Results.All(x=>x.Status=="PASS"));
        Check(log.SequenceEqual(new[]{"DELETE_STARTED:restricted-delete","delete:restricted","VERIFIED:restricted-delete","DELETE_STARTED:app-readable-delete","delete:app-readable","VERIFIED:app-readable-delete"}));
        log.Clear();var partial=DeleteSequence(label=>{log.Add(label);throw new InvalidDataException("INERT_FAILURE");},_=>{});
        Check(partial.Failed && log.SequenceEqual(new[]{"restricted"}) && partial.Results[^1].Status=="UNKNOWN");
        log.Clear();Reject(()=>DeleteSequence(label=>log.Add(label),_=>throw new InvalidDataException("INERT_PERSIST_FAILURE")));Check(log.Count==0);
        log.Clear();int writes=0;Reject(()=>DeleteSequence(label=>log.Add(label),_=>{if(++writes==2)throw new InvalidDataException("INERT_PERSIST_FAILURE");}));Check(log.SequenceEqual(new[]{"restricted"}));
        return count;
    }
}
