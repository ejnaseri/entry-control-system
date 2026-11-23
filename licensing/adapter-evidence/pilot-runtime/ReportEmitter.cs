namespace EntryControl.TestOnly.Runtime;
internal sealed record PilotResult(string Id,string Status,string ReasonCode,string Stage,int? NativeStatus,long ElapsedMonotonicMs);
internal sealed record PilotReport(int SchemaVersion,string Scope,string Stage,string Action,string Role,string RunId,string ExperimentId,
    string PlanSha256,string SourceManifestSha256,string ProvenanceSha256,string KitManifestSha256,string PackageManifestSha256,
    string ExecutorExeSha256,string LoadedAssemblySha256,string DependencyInventorySha256,string HostBindingSha256,string ProfileSha256,
    string Runtime,string OsVersion,string Architecture,int ProcessId,string BootIdentity,DateTimeOffset TimeUtc,long ElapsedMonotonicMs,
    string TokenUserSid,string TokenOwnerSid,int TokenType,int Elevation,string ServiceSid,uint ServiceSidAttributes,
    bool ServiceIdentityMatched,bool ArtifactIdentityMatched,bool WorkerEnded,PilotResult[] Results,
    string RuntimeAuthority,bool Durable,bool SecurityAccepted,bool ProductionAccepted,string[] NotTested)
{
    [JsonRequired] public int ServiceSidGroupCount { get; init; } = 1;
    [JsonRequired] public bool TokenRestricted { get; init; }
    [JsonRequired] public bool TokenQueryComplete { get; init; } = true;
    internal TokenSnapshot Token()=>new(TokenUserSid,TokenOwnerSid,TokenType,Elevation,ServiceSid,ServiceSidAttributes,ServiceSidGroupCount,TokenRestricted,TokenQueryComplete);
}

internal static class ReportEmitter
{
    internal static readonly string[] Fields={"schemaVersion","scope","stage","action","role","runId","experimentId","planSha256",
        "sourceManifestSha256","provenanceSha256","kitManifestSha256","packageManifestSha256","executorExeSha256","loadedAssemblySha256",
        "dependencyInventorySha256","hostBindingSha256","profileSha256","runtime","osVersion","architecture","processId","bootIdentity",
        "timeUtc","elapsedMonotonicMs","tokenUserSid","tokenOwnerSid","tokenType","elevation","serviceSid","serviceSidAttributes",
        "serviceIdentityMatched","artifactIdentityMatched","workerEnded","results","runtimeAuthority","durable","securityAccepted","productionAccepted","notTested","serviceSidGroupCount","tokenRestricted","tokenQueryComplete"};
    internal static byte[] Encode(PilotReport r)
    {
        Program.Need(r.SchemaVersion==2 && r.Scope==Program.Scope && r.RuntimeAuthority=="NONE" && !r.Durable &&
            !r.SecurityAccepted && !r.ProductionAccepted && r.WorkerEnded && r.ServiceIdentityMatched &&
            (r.ArtifactIdentityMatched || (r.Action=="setup-finish" || r.Results.Any(x=>x.Status is "UNKNOWN" or "FAIL")) && r.NotTested.Contains("POST_OPERATION_CONTEXT")),"REPORT_AUTHORITY_REFUSED");
        Program.Need(PlanAdmission.Actions.Contains(r.Action) && PlanAdmission.Actor(r.Action)==r.Role &&
            Program.Hex(r.RunId,32) && Program.Hex(r.ExperimentId,32) && r.RunId!=r.ExperimentId &&
            r.Stage==RoleActions.StageOf(r.Action) && RoleActions.Supports(r.Role,r.Action),"REPORT_CONTEXT_REFUSED");
        Program.Need(new[]{r.PlanSha256,r.SourceManifestSha256,r.ProvenanceSha256,r.KitManifestSha256,r.PackageManifestSha256,
            r.ExecutorExeSha256,r.LoadedAssemblySha256,r.DependencyInventorySha256,r.HostBindingSha256,r.ProfileSha256,r.BootIdentity}.All(x=>Program.Hex(x,64)),"REPORT_HASH_REFUSED");
        Program.Need(r.ProcessId>0 && r.ElapsedMonotonicMs>=0 && r.Results.Length is >0 and <=32 &&
            r.Results.Select(x=>x.Id).Distinct(StringComparer.Ordinal).Count()==r.Results.Length,"REPORT_RESULTS_REFUSED");
        if(r.Action=="setup-finish" && r.ArtifactIdentityMatched)Program.Need(r.Results.Select(x=>x.Id).SequenceEqual(RoleActions.ResultIds(r.Action)) && r.Results.All(x=>x.Status=="PASS"),"DELETE_COMPLETION_REFUSED");
        foreach(var x in r.Results)Program.Need(RoleActions.ResultIds(r.Action).Contains(x.Id) && x.Stage==r.Action &&
            ValidResult(x,r.Action) &&
            x.ElapsedMonotonicMs>=0 && (x.Status!="PASS" || x.NativeStatus is null),"REPORT_RESULT_REFUSED");
        Program.Need(r.ServiceSidGroupCount is 0 or 1 && r.TokenQueryComplete && !r.TokenRestricted && (r.ServiceSidGroupCount!=0 || r.ServiceSidAttributes==0),"REPORT_TOKEN_EVIDENCE_REFUSED");
        var bytes=Program.Serialize(r);Program.Need(bytes.Length<=2097152,"REPORT_SIZE_REFUSED");
        using var doc=JsonDocument.Parse(bytes);Program.Need(doc.RootElement.EnumerateObject().Select(x=>x.Name).SequenceEqual(Fields),"REPORT_FIELDS_REFUSED");
        return bytes;
    }
    private static bool ValidResult(PilotResult x,string action)=>x.Status=="PASS" && x.ReasonCode=="VERIFIED" ||
        x.Status=="UNKNOWN" && (x.ReasonCode=="OPERATION_UNKNOWN" || action=="setup-finish" && x.Id is "restricted-delete" or "app-readable-delete" && x.ReasonCode=="DELETE_STARTED" && x.NativeStatus is null) ||
        action is "app-prepare" or "child-prepare" or "app-fresh" or "child-fresh" && x.Id=="restricted-open" &&
        (x.Status=="OBSERVED" && x.ReasonCode=="RAW_BAD_KEYSET" && x.NativeStatus==unchecked((int)0x80090016) ||
         x.Status=="FAIL" && x.ReasonCode=="RESTRICTED_OPEN_SUCCEEDED" && x.NativeStatus==0) ||
        action=="guardian-absence" && (x.Status=="OBSERVED" && x.ReasonCode=="RAW_BAD_KEYSET" && x.NativeStatus==unchecked((int)0x80090016) ||
            x.Status=="FAIL" && x.ReasonCode=="KEY_STILL_PRESENT" && x.NativeStatus==0);
    internal static int SelfTest()
    {
        // Explicit inert fixture; never emitted as physical evidence.
        string h=new('a',64);var result=new PilotResult("restricted-seal-stage","PASS","VERIFIED","guardian-prepare",null,1);
        var r=new PilotReport(2,Program.Scope,"Prepare","guardian-prepare","Guardian",new('b',32),new('c',32),
            h,h,h,h,h,h,h,h,h,h,"10.0.11","FIXTURE","X64",1,h,DateTimeOffset.UnixEpoch,1,
            "FIXTURE_USER","FIXTURE_OWNER",1,0,"FIXTURE_SERVICE",4,true,true,true,new[]{result},"NONE",false,false,false,new[]{"ALL_PHYSICAL_OPERATIONS"});
        int count=0;
        void Reject(PilotReport candidate){try{Encode(candidate);}catch(InvalidDataException){count++;return;}throw new InvalidDataException("REPORT_NEGATIVE_FAILED");}
        var bytes=Encode(r);using var doc=JsonDocument.Parse(bytes);
        Program.Need(doc.RootElement.EnumerateObject().Count()==42,"REPORT_SHAPE_TEST_FAILED");count++;
        Reject(r with {SchemaVersion=1});Reject(r with {ServiceSidGroupCount=-1});
        Reject(r with {ServiceSidGroupCount=2});Reject(r with {TokenRestricted=true});
        Reject(r with {TokenQueryComplete=false});Reject(r with {ServiceSidGroupCount=0});
        foreach(string field in new[]{"serviceSidGroupCount","tokenRestricted","tokenQueryComplete"}) {
            var node=System.Text.Json.Nodes.JsonNode.Parse(bytes)!.AsObject();node.Remove(field);
            try {Program.Parse<PilotReport>(Encoding.UTF8.GetBytes(node.ToJsonString()));throw new InvalidDataException("MISSING_TOKEN_FIELD_ACCEPTED");}
            catch(JsonException){count++;}
        }
        var absent=r with {ServiceSidGroupCount=0,ServiceSidAttributes=0};
        Program.Need(Program.Parse<PilotReport>(Encode(absent)).ServiceSidGroupCount==0,"TOKEN_ROUNDTRIP_FAILED");count++;
        Reject(r with {SecurityAccepted=true});Reject(r with {ProductionAccepted=true});Reject(r with {RuntimeAuthority="LICENSE"});
        Reject(r with {Durable=true});Reject(r with {WorkerEnded=false});Reject(r with {PlanSha256="wrong"});
        Reject(r with {Action="setup-finish",Role="Setup"});Reject(r with {Results=new[]{result,result}});
        Reject(r with {Results=new[]{result with {Id="privateKey"}}});Reject(r with {Results=new[]{result with {ReasonCode="CANARY_EXCEPTION"}}});
        Reject(r with {Results=new[]{result with {NativeStatus=123}}});Reject(r with {ArtifactIdentityMatched=false});
        var unknown=r with {ArtifactIdentityMatched=false,Results=new[]{result with {Status="UNKNOWN",ReasonCode="OPERATION_UNKNOWN",NativeStatus=unchecked((int)0x80090016)}},NotTested=new[]{"POST_OPERATION_CONTEXT"}};
        Encode(unknown);count++;
        foreach(var pair in new[]{("Setup","setup-create"),("Guardian","guardian-prepare"),("Setup","setup-publish")}) {
            Program.Need(RoleActions.Supports(pair.Item1,pair.Item2) && RoleActions.ResultIds(pair.Item2).Distinct().Count()==RoleActions.ResultIds(pair.Item2).Length,"ACTION_ROUTE_TEST_FAILED");count++;
        }
        foreach(var action in new[]{"app-fresh","child-fresh","guardian-fresh","setup-finish","guardian-absence"}) {
            Program.Need(RoleActions.Supports(PlanAdmission.Actor(action),action),"IMPLEMENTED_ROUTE_TEST_FAILED");count++;
        }
        Program.Need(!RoleActions.Supports("App","setup-create"),"CROSS_ROLE_TEST_FAILED");count++;
        RefuseUnsupported();count++;
        var finish=r with {Stage="Finish",Action="setup-finish",Role="Setup",ArtifactIdentityMatched=false,NotTested=new[]{"POST_OPERATION_CONTEXT"},
            Results=new[]{new PilotResult("verify-both-owned-keys","PASS","VERIFIED","setup-finish",null,1),
                new PilotResult("restricted-delete","UNKNOWN","DELETE_STARTED","setup-finish",null,0)}};
        Encode(finish);count++;
        Reject(finish with {ArtifactIdentityMatched=true});Reject(finish with {Stage="Prepare"});
        Reject(finish with {Results=new[]{finish.Results[0],finish.Results[1] with {NativeStatus=5}}});
        var final=finish with {ArtifactIdentityMatched=true,NotTested=Array.Empty<string>(),Results=RoleActions.ResultIds("setup-finish").Select(id=>new PilotResult(id,"PASS","VERIFIED","setup-finish",null,1)).ToArray()};
        Encode(final);count++;Reject(final with {Results=final.Results.Take(2).ToArray()});
        var absence=r with {Stage="Finish",Action="guardian-absence",Results=new[]{RoleActions.AbsenceResult("restricted",unchecked((int)0x80090016),1)}};
        Encode(absence);count++;Reject(absence with {Results=new[]{absence.Results[0] with {NativeStatus=5}}});
        return count;
    }
    private static void RefuseUnsupported()
    {
        try{RoleActions.Execute("Setup","setup-unknown",new string('a',64));}
        catch(InvalidDataException ex) when(ex.Message=="ACTION_NOT_IMPLEMENTED"){return;}
        throw new InvalidDataException("UNSUPPORTED_ACTION_DID_NOT_REFUSE");
    }
    internal static void Write(PilotPlan p,Run run,string planHash,TokenSnapshot token,string boot,long elapsed,PilotResult[] results)
    {
        var bytes=Build(p,run,planHash,token,boot,elapsed,results,true);
        string folder=run.Role=="Setup"?"setup-reports":run.Role=="Guardian"?"guardian-reports":"app-reports";
        SecureFiles.Write(folder+"/"+run.RunId+".json",bytes,run.Role,p.GuardianSid,p.AppSid,p);
    }
    internal static byte[] Build(PilotPlan p,Run run,string planHash,TokenSnapshot token,string boot,long elapsed,PilotResult[] results,bool verifyPost)
    {
        Program.Need(NativeWorker.Ended,"LIVE_WORKER_REPORT_REFUSED");
        bool unknown=results.Any(x=>x.Status is "UNKNOWN" or "FAIL");
        // A failed worker blocks normal work. Only its bounded evidence-writing
        // lane remains; never claim a post-operation context check was performed.
        if(!unknown && verifyPost)NativeWorker.Run(()=>{PlanAdmission.VerifyPackage(p);
            HostAdmission.Verify(p);
            Program.Need(NativeTokens.Capture(run.Role)==token && NativeTokens.BootIdentity()==boot && boot==p.BootIdentity,"FINAL_CONTEXT_REFUSED");return true;},5000);
        var report=new PilotReport(2,Program.Scope,p.Stage,run.Action,run.Role,run.RunId,p.ExperimentId,planHash,
            p.SourceManifestSha256,p.ProvenanceSha256,p.KitManifestSha256,p.PackageManifestSha256,
            Program.Hash(File.ReadAllBytes(Environment.ProcessPath!)),Program.Hash(File.ReadAllBytes(typeof(Program).Assembly.Location)),
            p.DependencyInventorySha256,p.HostBindingSha256,p.ProfileSha256,Environment.Version.ToString(),Environment.OSVersion.Version.ToString(),
            RuntimeInformation.ProcessArchitecture.ToString(),Environment.ProcessId,boot,DateTimeOffset.UtcNow,elapsed,
            token.User,token.Owner,token.Type,token.Elevation,token.Service,token.Attributes,true,!unknown && verifyPost,true,results,
            "NONE",false,false,false,new[]{"CURRENT_PILOT_PHYSICAL_CASES","ACTUAL_CHILD","FRESH_PROCESS","OWNED_CLEANUP",
                "WINDOWS_MATRIX","POWER_LOSS","TPM","PRODUCTION_STORE","BUILT_KIT_REVIEW","POST_OPERATION_CONTEXT"}.Where(x=>unknown || !verifyPost || x!="POST_OPERATION_CONTEXT").ToArray());
        report=report with {ServiceSidGroupCount=token.GroupCount,TokenRestricted=token.Restricted,TokenQueryComplete=token.QueryComplete};
        return Encode(report);
    }
}
