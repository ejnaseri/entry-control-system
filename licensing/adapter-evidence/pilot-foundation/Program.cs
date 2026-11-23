using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text;

namespace EntryControl.TestOnly.Pilot;
internal static class Program
{
    private static readonly List<object> Results = new();
    private static string Hash(string path)=>Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
    private static void Assert(bool b) { if(!b) throw new Exception("ASSERTION_FAILED"); }
    private static void Refuse(Action a) { try { a(); } catch(ArgumentException) { return; } throw new Exception("REFUSAL_MISSING"); }
    private static void Test(string id, Action a) { try { a(); Results.Add(new {id,status="PASS",evidence="SIMULATED_POLICY_ONLY"}); }
        catch { Results.Add(new {id,status="FAIL",evidence="SIMULATED_POLICY_ONLY"}); } }
    private static StageBinding Binding(string stage,int offset=0) {
        string h=new('a',64);
        return new(stage,new string('b',32),h,h,h,h,h,h,stage=="Prepare"?"":h,stage=="Prepare"?"":h,
            Policy.StageActions(stage).Select((_,i)=>(offset+i+1).ToString("x32")).ToArray());
    }
    private static byte[] PlanBytes(StageBinding b)=>JsonSerializer.SerializeToUtf8Bytes(new {
        schemaVersion=1,scope="TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1",stage=b.Stage,experimentId=b.ExperimentId,
        hostDigest=b.HostDigest,sourceDigest=b.SourceDigest,packageDigest=b.PackageDigest,kitDigest=b.KitDigest,
        specDigest=b.SpecDigest,profileDigest=b.ProfileDigest,previousCheckpointDigest=b.PreviousCheckpointDigest,
        previousEvidenceDigest=b.PreviousEvidenceDigest,runs=Policy.StageActions(b.Stage).Select((a,i)=>new {action=a,runId=b.RunIds[i]})});
    private static Dictionary<string,object> ReportData(StageBinding b,int i,ArtifactBinding a,string g,string p) {
        string action=Policy.StageActions(b.Stage)[i];var role=Policy.ActionActor(action);
        return new() {
            ["schemaVersion"]=1,["scope"]="TEST_ONLY_PILOT_REPORT_MODEL",["stage"]=b.Stage,["experimentId"]=b.ExperimentId,
            ["runId"]=b.RunIds[i],["action"]=action,["role"]=role.ToString(),["owner"]=Policy.Owner(role,g,p),
            ["hostDigest"]=b.HostDigest,["sourceDigest"]=b.SourceDigest,["packageDigest"]=b.PackageDigest,["kitDigest"]=b.KitDigest,
            ["specDigest"]=b.SpecDigest,["profileDigest"]=b.ProfileDigest,["exeDigest"]=a.ExeDigest,["assemblyDigest"]=a.AssemblyDigest,
            ["planDigest"]=a.PlanDigest,["provenanceDigest"]=a.ProvenanceDigest,["dependencyDigest"]=a.DependencyDigest,
            ["runtimeAuthority"]="NONE",["workerEnded"]=true,["durable"]=false,["securityAccepted"]=false,["productionAccepted"]=false,
            ["results"]=new[] {new {id="fixture.control",status="PASS"}}};
    }
    private static void AdmissionTests(string g,string p)
    {
        string h=new('a',64);var bits=new ArtifactBinding(h,h,h,h,h);var ids=new[] {"fixture.control"};
        var expected=new[] {new PackageItem("runner.exe",100,h),new PackageItem("runner.dll",200,h)};
        Test("package.valid",()=>Policy.Package(expected,expected.Reverse().ToArray()));
        Test("package.changed-digest",()=>Refuse(()=>Policy.Package(expected,new[] {expected[0] with {Digest=new string('b',64)},expected[1]})));
        Test("package.changed-size",()=>Refuse(()=>Policy.Package(expected,new[] {expected[0] with {Size=101},expected[1]})));
        Test("package.extra",()=>Refuse(()=>Policy.Package(expected,expected.Append(new PackageItem("foreign.dll",1,h)).ToArray())));
        Test("package.missing",()=>Refuse(()=>Policy.Package(expected,expected.Take(1).ToArray())));
        Test("package.nonplain",()=>Refuse(()=>Policy.Package(expected,new[] {expected[0] with {Plain=false},expected[1]})));
        Test("package.alias",()=>Refuse(()=>Policy.Package(expected,new[] {expected[0],expected[0] with {Name="RUNNER.EXE"}})));
        foreach(var name in new[] {"../runner.dll","sub/runner.dll","sub\\runner.dll","C:runner.dll","runner.dll:stream","CON.dll","LPT1","runner.","runner..dll"})
            Test("package.path-refuse."+name,()=>Refuse(()=>Policy.Package(new[] {new PackageItem(name,1,h)},new[] {new PackageItem(name,1,h)})));
        Test("package.expected-digest",()=>Refuse(()=>Policy.Package(new[] {expected[0] with {Digest="placeholder"}},new[] {expected[0] with {Digest="placeholder"}})));
        Test("package.expected-empty",()=>Refuse(()=>Policy.Package(Array.Empty<PackageItem>(),Array.Empty<PackageItem>())));
        var b=Binding("Prepare");
        void Check(Dictionary<string,object> data)=>Policy.Report(JsonSerializer.SerializeToUtf8Bytes(data),b,0,bits,ids,g,p);
        Test("report.valid",()=>Check(ReportData(b,0,bits,g,p)));
        foreach(var field in ReportData(b,0,bits,g,p).Keys) {
            Test("report.missing."+field,()=>{var d=ReportData(b,0,bits,g,p);d.Remove(field);Refuse(()=>Check(d));});
            Test("report.substitute."+field,()=>{var d=ReportData(b,0,bits,g,p);d[field]="foreign";Refuse(()=>Check(d));});
        }
        Test("report.extra-exception",()=>{var d=ReportData(b,0,bits,g,p);d["exception"]="CANARY_PRIVATE_PATH";Refuse(()=>Check(d));});
        foreach(var key in new[] {"durable","securityAccepted","productionAccepted"})
            Test("report.authority."+key,()=>{var d=ReportData(b,0,bits,g,p);d[key]=true;Refuse(()=>Check(d));});
        Test("report.worker-unknown",()=>{var d=ReportData(b,0,bits,g,p);d["workerEnded"]=false;Refuse(()=>Check(d));});
        Test("report.result-fail",()=>{var d=ReportData(b,0,bits,g,p);d["results"]=new[] {new {id="fixture.control",status="UNKNOWN"}};Refuse(()=>Check(d));});
        Test("report.result-duplicate",()=>{var d=ReportData(b,0,bits,g,p);d["results"]=new[] {new {id="fixture.control",status="PASS"},new {id="fixture.control",status="PASS"}};Refuse(()=>Check(d));});
        Test("report.result-id",()=>{var d=ReportData(b,0,bits,g,p);d["results"]=new[] {new {id="foreign",status="PASS"}};Refuse(()=>Check(d));});
        Test("report.result-extra",()=>{var d=ReportData(b,0,bits,g,p);d["results"]=new[] {new {id="fixture.control",status="PASS",error="CANARY_SECRET"}};Refuse(()=>Check(d));});
        Test("report.duplicate-root",()=>{string s=JsonSerializer.Serialize(ReportData(b,0,bits,g,p));Refuse(()=>Policy.Report(Encoding.UTF8.GetBytes("{\"schemaVersion\":1,"+s[1..]),b,0,bits,ids,g,p));});
        Test("report.malformed",()=>Refuse(()=>Policy.Report(Encoding.UTF8.GetBytes("{"),b,0,bits,ids,g,p)));
        Test("report.large",()=>Refuse(()=>Policy.Report(new byte[2*1024*1024+1],b,0,bits,ids,g,p)));
        void Admit(PilotSession s,StageBinding binding,ArtifactBinding? artifact=null,bool bootstrap=true)=>
            s.Admit(PlanBytes(binding),binding,artifact??bits,ids,true,true,true,bootstrap);
        void RunStage(PilotSession s,StageBinding binding) {
            for(int i=0;i<binding.RunIds.Length;i++){s.Begin(Policy.StageActions(binding.Stage)[i],true);
                s.Observe(JsonSerializer.SerializeToUtf8Bytes(ReportData(binding,i,bits,g,p)),true);}
            s.Close(h,h,true);
        }
        PilotSession Prepared(){var s=new PilotSession(g,p);Admit(s,b);RunStage(s,b);return s;}
        Test("session.all-three-stages",()=>{var s=Prepared();var f=Binding("VerifyFreshProcess",5);Admit(s,f);RunStage(s,f);
            var end=Binding("Finish",8);Admit(s,end);RunStage(s,end);Assert(s.Complete);Refuse(()=>Admit(s,end));});
        Test("session.reused-ids",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess"))));
        Test("session.skipped-stage",()=>Refuse(()=>Admit(Prepared(),Binding("Finish",8))));
        Test("session.checkpoint-substitute",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess",5) with {PreviousCheckpointDigest=new string('c',64)})));
        Test("session.evidence-substitute",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess",5) with {PreviousEvidenceDigest=new string('c',64)})));
        Test("session.experiment-substitute",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess",5) with {ExperimentId=new string('c',32)})));
        Test("session.host-substitute",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess",5) with {HostDigest=new string('c',64)})));
        Test("session.artifact-substitute",()=>Refuse(()=>Admit(Prepared(),Binding("VerifyFreshProcess",5),bits with {AssemblyDigest=new string('c',64)})));
        Test("session.bootstrap",()=>Refuse(()=>Admit(new PilotSession(g,p),b,bootstrap:false)));
        Test("session.no-early-close",()=>{var s=new PilotSession(g,p);Admit(s,b);Refuse(()=>s.Close(h,h,true));});
        Test("session.no-action-overlap",()=>{var s=new PilotSession(g,p);Admit(s,b);s.Begin("setup-create",true);Refuse(()=>s.Begin("setup-create",true));});
        Test("session.report-before-action",()=>{var s=new PilotSession(g,p);Admit(s,b);Refuse(()=>s.Observe(JsonSerializer.SerializeToUtf8Bytes(ReportData(b,0,bits,g,p)),true));});
        Test("session.unknown-permanent",()=>{var s=new PilotSession(g,p);Admit(s,b);s.Begin("setup-create",true);
            var bytes=JsonSerializer.SerializeToUtf8Bytes(ReportData(b,0,bits,g,p));Refuse(()=>s.Observe(bytes,false));Refuse(()=>s.Observe(bytes,true));Refuse(()=>s.Begin("setup-create",true));Assert(!s.Complete);});
        Test("session.invalid-report-permanent",()=>{var s=new PilotSession(g,p);Admit(s,b);s.Begin("setup-create",true);
            var d=ReportData(b,0,bits,g,p);d["owner"]=g;Refuse(()=>s.Observe(JsonSerializer.SerializeToUtf8Bytes(d),true));Refuse(()=>s.Begin("setup-create",true));});
        Test("session.stop-unknown-permanent",()=>{var s=new PilotSession(g,p);Admit(s,b);Refuse(()=>s.Close(h,h,false));Refuse(()=>s.Begin("setup-create",true));});
        Test("session.caller-array-mutation",()=>{var s=new PilotSession(g,p);var copy=Binding("Prepare");Admit(s,copy);
            copy.RunIds[0]=new string('c',32);s.Begin("setup-create",true);s.Observe(JsonSerializer.SerializeToUtf8Bytes(ReportData(b,0,bits,g,p)),true);});
    }
    internal static int Main(string[] args)
    {
        if(!args.SequenceEqual(new[]{"--self-test"})) { Console.Error.WriteLine("PHYSICAL_ACTION_NOT_IMPLEMENTED"); return 2; }
        // Explicit fixture SIDs; these are never treated as measured host identities.
        const string g="S-1-5-80-1-2-3-4-5", p="S-1-5-80-6-7-8-9-10";
        AdmissionTests(g,p);
        Test("sid.valid-boundaries",()=>Policy.ServiceIdentities("S-1-5-80-0-4294967295-0-1-2",p));
        var invalidSids=new[] {"S-1-5-80-", "S-1-5-80-1-2-3-4", "S-1-5-80-1-2-3-4-5-6",
            "S-1-5-80-01-2-3-4-5", "S-1-5-80-4294967296-2-3-4-5", "S-1-5-80-+1-2-3-4-5",
            "S-1-5-80- 1-2-3-4-5", "S-1-5-80-١-2-3-4-5", "s-1-5-80-1-2-3-4-5", "S-1-5-18"};
        for(int i=0;i<invalidSids.Length;i++) {var sid=invalidSids[i];
            Test("sid.guardian-refuse."+i,()=>Refuse(()=>Policy.ServiceIdentities(sid,p)));
            Test("sid.app-refuse."+i,()=>Refuse(()=>Policy.ServiceIdentities(g,sid)));
            Test("sid.token-refuse."+i,()=>Refuse(()=>Policy.Token(Actor.Guardian,sid,sid,p)));
        }
        Test("sid.distinct-required",()=>Refuse(()=>Policy.ServiceIdentities(g,g)));
        foreach(Actor actor in Enum.GetValues<Actor>()) {
            Test("owner.token."+actor,()=>Policy.Token(actor,Policy.Owner(actor,g,p),g,p));
            Test("owner.token-substitute."+actor,()=>Refuse(()=>Policy.Token(actor,"S-1-1-0",g,p)));
        }
        var files=Policy.Files(g,p);
        foreach(var rule in files) {
            void Create(FileRule r,Actor? creator=null,string? owner=null,bool prot=true,bool exists=false,bool reparse=false)=>
                Policy.CreateFile(g,p,r,creator??rule.Creator,owner??Policy.Owner(rule.Creator,g,p),prot,exists,reparse);
            Test("creation.file.valid."+rule.Relative,()=>Create(rule));
            Test("creation.file.exists."+rule.Relative,()=>Refuse(()=>Create(rule,exists:true)));
            Test("creation.file.reparse."+rule.Relative,()=>Refuse(()=>Create(rule,reparse:true)));
            Test("creation.file.token."+rule.Relative,()=>Refuse(()=>Create(rule,owner:"S-1-1-0")));
            Test("creation.file.creator."+rule.Relative,()=>Refuse(()=>Create(rule,creator:Actor.Child==rule.Creator?Actor.Setup:Actor.Child)));
            Test("creation.file.path."+rule.Relative,()=>Refuse(()=>Create(rule with {Relative="../foreign.json"})));
            Test("file.valid."+rule.Relative,()=>Policy.File(rule,rule.Owner,true,rule.Aces));
            Test("file.foreign-owner."+rule.Relative,()=>Refuse(()=>Policy.File(rule,"S-1-1-0",true,rule.Aces)));
            Test("file.unprotected."+rule.Relative,()=>Refuse(()=>Policy.File(rule,rule.Owner,false,rule.Aces)));
            Test("file.broader-rights."+rule.Relative,()=>{var bad=rule.Aces.Select(a=>a with {Mask=a.Mask|0x01000000}).ToArray();Refuse(()=>Policy.File(rule,rule.Owner,true,bad));});
            Test("file.extra-principal."+rule.Relative,()=>Refuse(()=>Policy.File(rule,rule.Owner,true,rule.Aces.Append(new Ace("S-1-1-0",Policy.Full)).ToArray())));
            Test("file.inherited-ace."+rule.Relative,()=>Refuse(()=>Policy.File(rule,rule.Owner,true,rule.Aces.Select(a=>a with {Flags=0x10}).ToArray())));
        }
        foreach(var directory in Policy.Directories(g,p)) {
            void Create(DirectoryRule d,Actor? creator=null,string? token=null,bool prot=true,bool exists=false,bool reparse=false)=>
                Policy.CreateDirectory(g,p,d,creator??directory.Creator,token??Policy.Owner(directory.Creator,g,p),prot,exists,reparse);
            Test("directory.valid."+directory.Relative,()=>Create(directory));
            Test("directory.exists."+directory.Relative,()=>Refuse(()=>Create(directory,exists:true)));
            Test("directory.reparse."+directory.Relative,()=>Refuse(()=>Create(directory,reparse:true)));
            Test("directory.token."+directory.Relative,()=>Refuse(()=>Create(directory,token:g)));
            Test("directory.creator."+directory.Relative,()=>Refuse(()=>Create(directory,creator:Actor.Guardian)));
            Test("directory.owner."+directory.Relative,()=>Refuse(()=>Create(directory with {Owner=g})));
            Test("directory.unprotected."+directory.Relative,()=>Refuse(()=>Create(directory,prot:false)));
            Test("directory.flags."+directory.Relative,()=>Refuse(()=>Create(directory with {Aces=directory.Aces.Select(a=>a with {Flags=0}).ToArray()})));
            Test("directory.broader."+directory.Relative,()=>Refuse(()=>Create(directory with {Aces=directory.Aces.Select(a=>a with {Mask=a.Mask|0x01000000}).ToArray()})));
            Test("directory.duplicate."+directory.Relative,()=>Refuse(()=>Create(directory with {Aces=directory.Aces.Append(directory.Aces[0]).ToArray()})));
            Test("directory.foreign."+directory.Relative,()=>Refuse(()=>Create(directory with {Aces=directory.Aces.Append(new Ace("S-1-1-0",Policy.Full,3)).ToArray()})));
            Test("directory.path."+directory.Relative,()=>Refuse(()=>Create(directory with {Relative="bin/../protected"})));
        }
        foreach(var stage in new[] {"Prepare","VerifyFreshProcess","Finish"}) {
            string hash=new('a',64);
            var binding=new StageBinding(stage,new string('b',32),hash,hash,hash,hash,hash,hash,
                stage=="Prepare"?"":hash,stage=="Prepare"?"":hash,
                Policy.StageActions(stage).Select((_,i)=>(i+1).ToString("x32")).ToArray());
            Dictionary<string,object> Input()=>new() {
                ["schemaVersion"]=1,["scope"]="TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1",["stage"]=stage,
                ["experimentId"]=binding.ExperimentId,["hostDigest"]=hash,["sourceDigest"]=hash,["packageDigest"]=hash,
                ["kitDigest"]=hash,["specDigest"]=hash,["profileDigest"]=hash,
                ["previousCheckpointDigest"]=binding.PreviousCheckpointDigest,["previousEvidenceDigest"]=binding.PreviousEvidenceDigest,
                ["runs"]=Policy.StageActions(stage).Select((a,i)=>new {action=a,runId=binding.RunIds[i]}).ToArray()};
            byte[] Bytes(Dictionary<string,object> input)=>JsonSerializer.SerializeToUtf8Bytes(input);
            void Admit(byte[] data,StageBinding? expected=null,bool auth=true,bool plain=true,bool absent=true,bool prior=true)=>
                Policy.Plan(data,expected??binding,auth,plain,absent,prior);
            Test("plan.valid."+stage,()=>Admit(Bytes(Input())));
            foreach(var field in Input().Keys.Where(k=>k!="runs")) {
                Test("plan.substitute."+stage+"."+field,()=>{var input=Input();input[field]="foreign";Refuse(()=>Admit(Bytes(input)));});
                Test("plan.missing."+stage+"."+field,()=>{var input=Input();input.Remove(field);Refuse(()=>Admit(Bytes(input)));});
            }
            Test("plan.extra."+stage,()=>{var input=Input();input["path"]="C:/foreign";Refuse(()=>Admit(Bytes(input)));});
            Test("plan.duplicate."+stage,()=>{var text=Encoding.UTF8.GetString(Bytes(Input()));Refuse(()=>Admit(Encoding.UTF8.GetBytes("{\"schemaVersion\":1,"+text[1..])));});
            Test("plan.malformed."+stage,()=>Refuse(()=>Admit(Encoding.UTF8.GetBytes("{"))));
            Test("plan.comments."+stage,()=>Refuse(()=>Admit(Encoding.UTF8.GetBytes("{/*comment*/}"))));
            Test("plan.too-large."+stage,()=>Refuse(()=>Admit(new byte[2*1024*1024+1])));
            Test("plan.no-authorization."+stage,()=>Refuse(()=>Admit(Bytes(Input()),auth:false)));
            Test("plan.reparse-ancestor."+stage,()=>Refuse(()=>Admit(Bytes(Input()),plain:false)));
            Test("plan.collision."+stage,()=>Refuse(()=>Admit(Bytes(Input()),absent:false)));
            Test("plan.prerequisite."+stage,()=>Refuse(()=>Admit(Bytes(Input()),prior:false)));
            Test("plan.expected-digest."+stage,()=>Refuse(()=>Admit(Bytes(Input()),binding with {KitDigest="placeholder"})));
            Test("plan.expected-stage."+stage,()=>Refuse(()=>Admit(Bytes(Input()),binding with {Stage="Foreign"})));
            Test("plan.expected-run-duplicate."+stage,()=>Refuse(()=>Admit(Bytes(Input()),binding with {RunIds=binding.RunIds.Select(_=>binding.RunIds[0]).ToArray()})));
            Test("plan.expected-run-collision."+stage,()=>Refuse(()=>Admit(Bytes(Input()),binding with {RunIds=binding.RunIds.Select(_=>binding.ExperimentId).ToArray()})));
            Test("plan.expected-id-case."+stage,()=>Refuse(()=>Admit(Bytes(Input()),binding with {ExperimentId=binding.ExperimentId.ToUpperInvariant()})));
            Test("plan.runs-empty."+stage,()=>{var input=Input();input["runs"]=Array.Empty<object>();Refuse(()=>Admit(Bytes(input)));});
            Test("plan.runs-order."+stage,()=>{var input=Input();input["runs"]=Policy.StageActions(stage).Reverse().Select((a,i)=>new {action=a,runId=binding.RunIds[i]}).ToArray();Refuse(()=>Admit(Bytes(input)));});
            Test("plan.run-id."+stage,()=>{var input=Input();input["runs"]=Policy.StageActions(stage).Select(a=>new {action=a,runId=new string('c',32)}).ToArray();Refuse(()=>Admit(Bytes(input)));});
            Test("plan.run-extra."+stage,()=>{var input=Input();input["runs"]=Policy.StageActions(stage).Select((a,i)=>new {action=a,runId=binding.RunIds[i],path="foreign"}).ToArray();Refuse(()=>Admit(Bytes(input)));});
            Test("plan.run-duplicate-property."+stage,()=>{var text=Encoding.UTF8.GetString(Bytes(Input())).Replace("\"action\":","\"action\":\"foreign\",\"action\":",StringComparison.Ordinal);Refuse(()=>Admit(Encoding.UTF8.GetBytes(text)));});
        }
        foreach(var source in files.Where(f=>f.Relative.StartsWith("guardian-work/",StringComparison.Ordinal))) {
            var dest=files.Single(f=>f.Relative=="shared/"+source.Relative[14..]); string digest=new('a',64);
            void Publish(FileRule s,FileRule d,bool sp=true,bool dp=true,string? hash=null,bool exists=false) =>
                Policy.Publish(g,p,s,sp,d,dp,digest,hash??digest,exists);
            Test("publish.copy."+source.Relative,()=>Publish(source,dest));
            Test("publish.changed."+source.Relative,()=>Refuse(()=>Publish(source,dest,hash:new string('b',64))));
            Test("publish.existing."+source.Relative,()=>Refuse(()=>Publish(source,dest,exists:true)));
            Test("publish.wrong-owner."+source.Relative,()=>Refuse(()=>Publish(source,dest with {Owner=g})));
            Test("publish.source-system-owner."+source.Relative,()=>Refuse(()=>Publish(source with {Owner=Policy.SystemSid},dest)));
            Test("publish.source-aces."+source.Relative,()=>Refuse(()=>Publish(source with {
                Aces=source.Aces.Select(a=>a with {Mask=a.Mask|0x01000000}).ToArray()},dest)));
            Test("publish.destination-aces."+source.Relative,()=>Refuse(()=>Publish(source,dest with {
                Aces=dest.Aces.Select(a=>a with {Mask=a.Mask|0x01000000}).ToArray()})));
            Test("publish.source-unprotected."+source.Relative,()=>Refuse(()=>Publish(source,dest,sp:false)));
            Test("publish.destination-unprotected."+source.Relative,()=>Refuse(()=>Publish(source,dest,dp:false)));
            Test("publish.source-creator."+source.Relative,()=>Refuse(()=>Publish(source with {Creator=Actor.Setup},dest)));
            Test("publish.destination-creator."+source.Relative,()=>Refuse(()=>Publish(source,dest with {Creator=Actor.Guardian})));
            Test("publish.unlisted-pair."+source.Relative,()=>Refuse(()=>Publish(source with {
                Relative="guardian-work/foreign.bin"},dest with {Relative="shared/foreign.bin"})));
            Test("publish.source-duplicate-ace."+source.Relative,()=>Refuse(()=>Publish(source with {
                Aces=source.Aces.Append(source.Aces[0]).ToArray()},dest)));
            Test("publish.destination-duplicate-ace."+source.Relative,()=>Refuse(()=>Publish(source,dest with {
                Aces=dest.Aces.Append(dest.Aces[0]).ToArray()})));
        }
        Test("sequence.full",()=>{var s=new Sequence();foreach(var action in Sequence.Actions){s.Start(action,true);s.End(true,true);}Assert(s.Complete);Refuse(()=>s.Start("setup-create",true));});
        Test("sequence.unauthorized",()=>{var s=new Sequence();Refuse(()=>s.Start("setup-create",false));Assert(!s.Complete);});
        Test("sequence.out-of-order",()=>Refuse(()=>new Sequence().Start("setup-publish",true)));
        Test("sequence.live-overlap",()=>{var s=new Sequence();s.Start("setup-create",true);Refuse(()=>s.Start("guardian-prepare",true));});
        Test("sequence.unknown-blocks",()=>{var s=new Sequence();s.Start("setup-create",true);s.End(false,false);Refuse(()=>s.Start("setup-create",true));s.End(true,true);Refuse(()=>s.Start("guardian-prepare",true));Assert(!s.Complete);});
        Test("sequence.failure-blocks",()=>{var s=new Sequence();s.Start("setup-create",true);s.End(true,false);Refuse(()=>s.Start("setup-create",true));});
        Test("sequence.no-worker",()=>Refuse(()=>new Sequence().End(true,true)));
        var report=JsonSerializer.Serialize(new {schemaVersion=1,scope="TEST_ONLY_PILOT_FOUNDATION_PURE",artifactVersion="0.1.3",
            loadedAssemblySha256=Hash(typeof(Program).Assembly.Location),executorExeSha256=Hash(Environment.ProcessPath!),
            runtime=Environment.Version.ToString(),architecture=RuntimeInformation.ProcessArchitecture.ToString(),timeUtc=DateTime.UtcNow.ToString("O"),
            results=Results,physicalImplemented=false,physicalTested=false,nativeKspTested=false,measuredTokenOwner=false,
            runtimeAuthority="NONE",durable=false,securityAccepted=false,productionAccepted=false});
        Console.WriteLine(report); return report.Contains("\"status\":\"FAIL\"",StringComparison.Ordinal)?1:0;
    }
}
