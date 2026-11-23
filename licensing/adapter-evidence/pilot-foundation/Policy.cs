using System;
using System.Linq;
using System.Globalization;
using System.Text.Json;
using System.Collections.Generic;

namespace EntryControl.TestOnly.Pilot;

internal enum Actor { Controller, Setup, Guardian, App, Child }
internal sealed record Ace(string Sid, uint Mask, byte Flags = 0);
internal sealed record FileRule(string Relative, Actor Creator, string Owner, Ace[] Aces);
internal sealed record DirectoryRule(string Relative, Actor Creator, string Owner, Ace[] Aces);
internal sealed record StageBinding(string Stage, string ExperimentId, string HostDigest,
    string SourceDigest, string PackageDigest, string KitDigest, string SpecDigest,
    string ProfileDigest, string PreviousCheckpointDigest, string PreviousEvidenceDigest,
    string[] RunIds);
internal sealed record PackageItem(string Name,long Size,string Digest,bool Plain=true);
internal sealed record ArtifactBinding(string ExeDigest,string AssemblyDigest,string PlanDigest,
    string ProvenanceDigest,string DependencyDigest);

// Injected observations only. No Windows token/ACL/file creation API is imported.
internal static class Policy
{
    internal const string SystemSid = "S-1-5-18", AdminSid = "S-1-5-32-544";
    internal const uint Full = 0x001F01FF, Modify = 0x001301BF, Read = 0x00120089;
    internal const uint DirectoryRead = 0x001200A9;
    internal static void ServiceIdentities(string guardian, string app)
    {
        static bool Valid(string sid) {
            if (sid is null) return false;
            var parts=sid.Split('-');
            return parts.Length==9 && parts[0]=="S" && parts[1]=="1" && parts[2]=="5" && parts[3]=="80" &&
                parts.Skip(4).All(p=>uint.TryParse(p,NumberStyles.None,CultureInfo.InvariantCulture,out var n) &&
                    p==n.ToString(CultureInfo.InvariantCulture));
        }
        if (!Valid(guardian) || !Valid(app) || guardian==app) throw new ArgumentException("SERVICE_IDENTITY_REFUSED");
    }
    internal static string Owner(Actor actor, string guardian, string app)
    {
        ServiceIdentities(guardian,app);
        return actor switch {
        Actor.Controller => AdminSid, Actor.Setup => SystemSid, Actor.Guardian => guardian,
        Actor.App or Actor.Child => app, _ => throw new ArgumentException("ROLE_REFUSED")
        };
    }
    internal static void Token(Actor actor, string observedOwner, string guardian, string app)
    {
        if (observedOwner != Owner(actor,guardian,app)) throw new ArgumentException("TOKEN_OWNER_REFUSED");
    }
    internal static FileRule[] Files(string guardian, string app)
    {
        ServiceIdentities(guardian,app);
        Ace[] Controller() => new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Full)};
        Ace[] Shared() => new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Read),new Ace(guardian,Read),new Ace(app,Read)};
        Ace[] Private() => new[] {new Ace(SystemSid,Full),new Ace(guardian,Read)};
        return new[] {
            new FileRule("controller/prepare-checkpoint.json",Actor.Controller,AdminSid,Controller()),
            new FileRule("protected/restricted-intent.json",Actor.Setup,SystemSid,Private()),
            new FileRule("protected/app-readable-intent.json",Actor.Setup,SystemSid,Private()),
            new FileRule("protected/restricted-owned.json",Actor.Setup,SystemSid,Private()),
            new FileRule("protected/app-readable-owned.json",Actor.Setup,SystemSid,Private()),
            new FileRule("shared/public-control.json",Actor.Setup,SystemSid,Shared()),
            new FileRule("shared/restricted-envelope.bin",Actor.Setup,SystemSid,Shared()),
            new FileRule("shared/app-readable-envelope.bin",Actor.Setup,SystemSid,Shared()),
            new FileRule("shared/restricted-expected-hash.json",Actor.Setup,SystemSid,Shared()),
            new FileRule("shared/app-readable-expected-hash.json",Actor.Setup,SystemSid,Shared()),
            new FileRule("guardian-work/restricted-envelope.bin",Actor.Guardian,guardian,new[] {new Ace(SystemSid,Full),new Ace(guardian,Modify)}),
            new FileRule("guardian-work/app-readable-envelope.bin",Actor.Guardian,guardian,new[] {new Ace(SystemSid,Full),new Ace(guardian,Modify)}),
            new FileRule("guardian-work/restricted-expected-hash.json",Actor.Guardian,guardian,new[] {new Ace(SystemSid,Full),new Ace(guardian,Modify)}),
            new FileRule("guardian-work/app-readable-expected-hash.json",Actor.Guardian,guardian,new[] {new Ace(SystemSid,Full),new Ace(guardian,Modify)}),
            new FileRule("setup-reports/00000000000000000000000000000001.json",Actor.Setup,SystemSid,new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Read)}),
            new FileRule("guardian-reports/00000000000000000000000000000002.json",Actor.Guardian,guardian,new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Read),new Ace(guardian,Modify)}),
            new FileRule("app-reports/00000000000000000000000000000003.json",Actor.App,app,new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Read),new Ace(app,Modify)}),
            new FileRule("app-reports/00000000000000000000000000000004.json",Actor.Child,app,new[] {new Ace(SystemSid,Full),new Ace(AdminSid,Read),new Ace(app,Modify)})
        };
    }
    internal static void File(FileRule expected, string owner, bool protectedDacl, Ace[] observed)
    {
        if (owner != expected.Owner || !protectedDacl || observed.Length != expected.Aces.Length ||
            observed.Select(a=>a.Sid).Distinct(StringComparer.Ordinal).Count()!=observed.Length ||
            observed.Any(a=>a.Flags!=0) || expected.Aces.Any(a=>!observed.Contains(a)))
            throw new ArgumentException("OWNER_DACL_REFUSED");
    }
    internal static DirectoryRule[] Directories(string guardian, string app)
    {
        ServiceIdentities(guardian,app);
        Ace[] Public()=>new[] {new Ace(SystemSid,Full,3),new Ace(AdminSid,Full,3),
            new Ace(guardian,DirectoryRead,3),new Ace(app,DirectoryRead,3)};
        return new[] {
            new DirectoryRule("",Actor.Controller,AdminSid,Public()),
            new DirectoryRule("bin",Actor.Controller,AdminSid,Public()),
            new DirectoryRule("plans",Actor.Controller,AdminSid,Public()),
            new DirectoryRule("controller",Actor.Controller,AdminSid,new[] {new Ace(SystemSid,Full,3),new Ace(AdminSid,Full,3)}),
            new DirectoryRule("shared",Actor.Setup,SystemSid,Public()),
            new DirectoryRule("protected",Actor.Setup,SystemSid,new[] {new Ace(SystemSid,Full,3),new Ace(guardian,DirectoryRead,3)}),
            new DirectoryRule("guardian-work",Actor.Setup,SystemSid,new[] {new Ace(SystemSid,Full,3),new Ace(guardian,Modify,3)}),
            new DirectoryRule("setup-reports",Actor.Controller,AdminSid,new[] {new Ace(SystemSid,Full,3),new Ace(AdminSid,DirectoryRead,3)}),
            new DirectoryRule("guardian-reports",Actor.Controller,AdminSid,new[] {new Ace(SystemSid,Full,3),new Ace(AdminSid,DirectoryRead,3),new Ace(guardian,Modify,3)}),
            new DirectoryRule("app-reports",Actor.Controller,AdminSid,new[] {new Ace(SystemSid,Full,3),new Ace(AdminSid,DirectoryRead,3),new Ace(app,Modify,3)})
        };
    }
    internal static void CreateDirectory(string guardian,string app,DirectoryRule observed,
        Actor creator,string tokenOwner,bool protectedDacl,bool exists,bool reparse)
    {
        var expected=Directories(guardian,app).SingleOrDefault(d=>d.Relative==observed.Relative);
        if(expected is null || creator!=expected.Creator || observed.Creator!=expected.Creator || exists || reparse)
            throw new ArgumentException("DIRECTORY_CREATION_REFUSED");
        Token(creator,tokenOwner,guardian,app);
        // Explicit directory inheritance flags differ from ordinary file flags.
        if(observed.Owner!=expected.Owner || !protectedDacl || observed.Aces.Length!=expected.Aces.Length ||
            observed.Aces.Select(a=>a.Sid).Distinct(StringComparer.Ordinal).Count()!=observed.Aces.Length ||
            expected.Aces.Any(a=>!observed.Aces.Contains(a))) throw new ArgumentException("DIRECTORY_DACL_REFUSED");
    }
    internal static void CreateFile(string guardian,string app,FileRule observed,Actor creator,
        string tokenOwner,bool protectedDacl,bool exists,bool reparse)
    {
        var expected=Files(guardian,app).SingleOrDefault(f=>f.Relative==observed.Relative);
        if(expected is null || creator!=expected.Creator || observed.Creator!=expected.Creator || exists || reparse)
            throw new ArgumentException("FILE_CREATION_REFUSED");
        Token(creator,tokenOwner,guardian,app);
        File(expected,observed.Owner,protectedDacl,observed.Aces);
    }
    internal static bool Hex(string? text,int length)=>text is not null && text.Length==length &&
        text.All(c=>"0123456789abcdef".Contains(c));
    internal static void Package(PackageItem[] expected,PackageItem[] observed)
    {
        static bool Valid(PackageItem f)=>f.Plain && f.Size>0 && Hex(f.Digest,64) &&
            f.Name.Length is >0 and <=128 && (f.Name==".version" ||
            f.Name[0] is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9') &&
            f.Name.All(c=>c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9' or '.' or '_' or '-') &&
            !f.Name.EndsWith('.') && !f.Name.Contains("..") &&
            !new[] {"CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
                "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"}.Contains(f.Name.Split('.')[0],StringComparer.OrdinalIgnoreCase);
        if(expected.Length==0 || expected.Length>512 || observed.Length!=expected.Length ||
            expected.Any(f=>!Valid(f)) || observed.Any(f=>!Valid(f)) ||
            expected.Select(f=>f.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count()!=expected.Length ||
            observed.Select(f=>f.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count()!=observed.Length ||
            expected.Any(f=>!observed.Contains(f))) throw new ArgumentException("PACKAGE_REFUSED");
    }
    internal static Actor ActionActor(string action)=>action switch {
        "setup-create" or "setup-publish" or "setup-finish"=>Actor.Setup,
        "guardian-prepare" or "guardian-fresh" or "guardian-absence"=>Actor.Guardian,
        "app-prepare" or "app-fresh"=>Actor.App,
        "child-prepare" or "child-fresh"=>Actor.Child,
        _=>throw new ArgumentException("ACTION_REFUSED")
    };
    // Candidate report schema only; not a physical emitter or signed attestation.
    internal static void Report(byte[] json,StageBinding stage,int index,ArtifactBinding artifact,
        string[] resultIds,string guardian,string app)
    {
        ServiceIdentities(guardian,app);
        var actions=StageActions(stage.Stage);
        if(index<0 || index>=actions.Length || stage.RunIds.Length!=actions.Length ||
            !Hex(stage.ExperimentId,32) || !Hex(stage.RunIds[index],32) ||
            resultIds.Length==0 || resultIds.Length>128 || resultIds.Distinct(StringComparer.Ordinal).Count()!=resultIds.Length ||
            resultIds.Any(id=>id.Length==0 || id.Length>80 || id.Any(c=>!(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '.' or '-'))) ||
            new[] {stage.HostDigest,stage.SourceDigest,stage.PackageDigest,stage.KitDigest,stage.SpecDigest,stage.ProfileDigest,
                artifact.ExeDigest,artifact.AssemblyDigest,artifact.PlanDigest,artifact.ProvenanceDigest,artifact.DependencyDigest}.Any(h=>!Hex(h,64)) ||
            json.Length==0 || json.Length>2*1024*1024) throw new ArgumentException("REPORT_BINDING_REFUSED");
        try {
            using var doc=JsonDocument.Parse(json,new JsonDocumentOptions {MaxDepth=8});var root=doc.RootElement;
            var role=ActionActor(actions[index]);
            var strings=new Dictionary<string,string> {
                ["scope"]="TEST_ONLY_PILOT_REPORT_MODEL",["stage"]=stage.Stage,["experimentId"]=stage.ExperimentId,
                ["runId"]=stage.RunIds[index],["action"]=actions[index],["role"]=role.ToString(),
                ["owner"]=Owner(role,guardian,app),["hostDigest"]=stage.HostDigest,["sourceDigest"]=stage.SourceDigest,
                ["packageDigest"]=stage.PackageDigest,["kitDigest"]=stage.KitDigest,["specDigest"]=stage.SpecDigest,
                ["profileDigest"]=stage.ProfileDigest,["exeDigest"]=artifact.ExeDigest,["assemblyDigest"]=artifact.AssemblyDigest,
                ["planDigest"]=artifact.PlanDigest,["provenanceDigest"]=artifact.ProvenanceDigest,["dependencyDigest"]=artifact.DependencyDigest,
                ["runtimeAuthority"]="NONE"};
            var fields=strings.Keys.Concat(new[] {"schemaVersion","workerEnded","durable","securityAccepted","productionAccepted","results"}).ToArray();
            Closed(root,fields);
            foreach(var pair in strings) if(root.GetProperty(pair.Key).ValueKind!=JsonValueKind.String || root.GetProperty(pair.Key).GetString()!=pair.Value)
                throw new ArgumentException("REPORT_CONTEXT_REFUSED");
            if(root.GetProperty("schemaVersion").GetRawText()!="1" || root.GetProperty("workerEnded").ValueKind!=JsonValueKind.True ||
                new[] {"durable","securityAccepted","productionAccepted"}.Any(k=>root.GetProperty(k).ValueKind!=JsonValueKind.False))
                throw new ArgumentException("REPORT_AUTHORITY_REFUSED");
            var results=root.GetProperty("results");
            if(results.ValueKind!=JsonValueKind.Array || results.GetArrayLength()!=resultIds.Length) throw new ArgumentException("REPORT_RESULTS_REFUSED");
            int n=0;foreach(var result in results.EnumerateArray()) {
                Closed(result,new[] {"id","status"});
                if(result.GetProperty("id").ValueKind!=JsonValueKind.String || result.GetProperty("id").GetString()!=resultIds[n++] ||
                    result.GetProperty("status").ValueKind!=JsonValueKind.String || result.GetProperty("status").GetString()!="PASS")
                    throw new ArgumentException("REPORT_RESULTS_REFUSED");
            }
        } catch(JsonException) {throw new ArgumentException("REPORT_JSON_REFUSED");}
    }
    private static void Closed(JsonElement value,string[] names)
    {
        if(value.ValueKind!=JsonValueKind.Object) throw new ArgumentException("CLOSED_SCHEMA_REFUSED");
        var properties=value.EnumerateObject().ToArray();
        if(properties.Length!=names.Length || properties.Select(p=>p.Name).Distinct(StringComparer.Ordinal).Count()!=names.Length ||
            properties.Any(p=>!names.Contains(p.Name,StringComparer.Ordinal))) throw new ArgumentException("CLOSED_SCHEMA_REFUSED");
    }
    internal static string[] StageActions(string stage)=>stage switch {
        "Prepare"=>Sequence.Actions.Take(5).ToArray(),
        "VerifyFreshProcess"=>Sequence.Actions.Skip(5).Take(3).ToArray(),
        "Finish"=>Sequence.Actions.Skip(8).Take(2).ToArray(),
        _=>throw new ArgumentException("STAGE_REFUSED")
    };
    // Pure admission fixture: expected pins must come from a separate trusted
    // approval in a future controller, never from this observed JSON itself.
    internal static void Plan(byte[] json,StageBinding expected,bool ownerAuthorized,
        bool ancestorsPlain,bool collisionAbsent,bool priorStageComplete)
    {
        if(json.Length==0 || json.Length>2*1024*1024 || !ownerAuthorized || !ancestorsPlain ||
            !collisionAbsent || !priorStageComplete) throw new ArgumentException("PLAN_ADMISSION_REFUSED");
        var actions=StageActions(expected.Stage);
        if(!Hex(expected.ExperimentId,32) || expected.RunIds.Length!=actions.Length ||
            expected.RunIds.Any(id=>!Hex(id,32) || id==expected.ExperimentId) ||
            expected.RunIds.Distinct(StringComparer.Ordinal).Count()!=actions.Length ||
            new[] {expected.HostDigest,expected.SourceDigest,expected.PackageDigest,expected.KitDigest,
                expected.SpecDigest,expected.ProfileDigest}.Any(h=>!Hex(h,64)) ||
            (expected.Stage=="Prepare" ? expected.PreviousCheckpointDigest!="" || expected.PreviousEvidenceDigest!="" :
                !Hex(expected.PreviousCheckpointDigest,64) || !Hex(expected.PreviousEvidenceDigest,64)))
            throw new ArgumentException("EXPECTED_BINDING_REFUSED");
        try {
            using var document=JsonDocument.Parse(json,new JsonDocumentOptions {MaxDepth=8});
            var root=document.RootElement;
            var fields=new[] {"schemaVersion","scope","stage","experimentId","hostDigest","sourceDigest",
                "packageDigest","kitDigest","specDigest","profileDigest","previousCheckpointDigest","previousEvidenceDigest","runs"};
            if(root.ValueKind!=JsonValueKind.Object) throw new ArgumentException("PLAN_SCHEMA_REFUSED");
            var properties=root.EnumerateObject().ToArray();
            if(properties.Length!=fields.Length || properties.Select(p=>p.Name).Distinct(StringComparer.Ordinal).Count()!=fields.Length ||
                properties.Any(p=>!fields.Contains(p.Name,StringComparer.Ordinal))) throw new ArgumentException("PLAN_SCHEMA_REFUSED");
            void Equal(string name,string value) {
                if(root.GetProperty(name).ValueKind!=JsonValueKind.String || root.GetProperty(name).GetString()!=value)
                    throw new ArgumentException("PLAN_BINDING_REFUSED");
            }
            if(root.GetProperty("schemaVersion").GetRawText()!="1") throw new ArgumentException("PLAN_SCHEMA_REFUSED");
            Equal("scope","TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1"); Equal("stage",expected.Stage);
            Equal("experimentId",expected.ExperimentId); Equal("hostDigest",expected.HostDigest);
            Equal("sourceDigest",expected.SourceDigest); Equal("packageDigest",expected.PackageDigest);
            Equal("kitDigest",expected.KitDigest); Equal("specDigest",expected.SpecDigest); Equal("profileDigest",expected.ProfileDigest);
            Equal("previousCheckpointDigest",expected.PreviousCheckpointDigest); Equal("previousEvidenceDigest",expected.PreviousEvidenceDigest);
            var runs=root.GetProperty("runs");
            if(runs.ValueKind!=JsonValueKind.Array || runs.GetArrayLength()!=actions.Length) throw new ArgumentException("PLAN_RUNS_REFUSED");
            int i=0;
            foreach(var run in runs.EnumerateArray()) {
                if(run.ValueKind!=JsonValueKind.Object) throw new ArgumentException("PLAN_RUNS_REFUSED");
                var props=run.EnumerateObject().ToArray();
                if(props.Length!=2 || props.Select(p=>p.Name).Distinct(StringComparer.Ordinal).Count()!=2 ||
                    props.Any(p=>p.Name!="action" && p.Name!="runId") ||
                    run.GetProperty("action").ValueKind!=JsonValueKind.String || run.GetProperty("action").GetString()!=actions[i] ||
                    run.GetProperty("runId").ValueKind!=JsonValueKind.String || run.GetProperty("runId").GetString()!=expected.RunIds[i])
                    throw new ArgumentException("PLAN_RUNS_REFUSED");
                i++;
            }
        } catch(JsonException) { throw new ArgumentException("PLAN_JSON_REFUSED"); }
    }
    internal static void Publish(string guardian, string app, FileRule staging, bool stagingProtected,
        FileRule destination, bool destinationProtected, string sourceDigest, string outputDigest, bool exists)
    {
        // Expected rules are reconstructed from independently supplied trusted
        // fixture identities, never from the observed owner or ACEs themselves.
        var rules=Files(guardian,app);
        var expectedSource=rules.SingleOrDefault(f=>f.Creator==Actor.Guardian &&
            f.Relative.StartsWith("guardian-work/",StringComparison.Ordinal) && f.Relative==staging.Relative);
        if (expectedSource is null) throw new ArgumentException("PUBLICATION_SOURCE_REFUSED");
        var expectedDestination=rules.Single(f=>f.Relative=="shared/"+expectedSource.Relative[14..]);
        if (staging.Creator!=expectedSource.Creator || destination.Creator!=expectedDestination.Creator ||
            destination.Relative!=expectedDestination.Relative ||
            exists || sourceDigest.Length!=64 || sourceDigest.Any(c=>!"0123456789abcdef".Contains(c)) ||
            outputDigest!=sourceDigest) throw new ArgumentException("PUBLICATION_REFUSED");
        File(expectedSource,staging.Owner,stagingProtected,staging.Aces);
        File(expectedDestination,destination.Owner,destinationProtected,destination.Aces);
    }
}

// Volatile fixture session, not a durable checkpoint/controller. Reserve IDs
// on admission; failed/uncertain observations block this instance permanently.
internal sealed class PilotSession
{
    private readonly string guardian,app;
    private readonly HashSet<string> used=new(StringComparer.Ordinal);
    private StageBinding? current;
    private ArtifactBinding? artifact;
    private ArtifactBinding? firstArtifact;
    private string[]? results;
    private StageBinding? first;
    private int stageIndex,actionIndex;
    private bool active,blocked;
    private string checkpoint="",evidence="";
    private static readonly string[] Stages={"Prepare","VerifyFreshProcess","Finish"};
    internal PilotSession(string g,string p){Policy.ServiceIdentities(g,p);guardian=g;app=p;}
    internal void Admit(byte[] json,StageBinding expected,ArtifactBinding bits,string[] resultIds,
        bool authorized,bool plain,bool absent, bool bootstrapComplete)
    {
        if(blocked || current is not null || stageIndex>=Stages.Length || expected.Stage!=Stages[stageIndex] || !bootstrapComplete)
            throw new ArgumentException("SESSION_STAGE_REFUSED");
        Policy.Plan(json,expected,authorized,plain,absent,true);
        if(expected.RunIds.Any(id=>used.Contains(id)) ||
            (first is not null && (expected.ExperimentId!=first.ExperimentId || expected.HostDigest!=first.HostDigest ||
                expected.SourceDigest!=first.SourceDigest || expected.PackageDigest!=first.PackageDigest || expected.KitDigest!=first.KitDigest ||
                expected.SpecDigest!=first.SpecDigest || expected.ProfileDigest!=first.ProfileDigest)) ||
            expected.PreviousCheckpointDigest!=checkpoint || expected.PreviousEvidenceDigest!=evidence ||
            (firstArtifact is not null && (bits.ExeDigest!=firstArtifact.ExeDigest || bits.AssemblyDigest!=firstArtifact.AssemblyDigest ||
                bits.ProvenanceDigest!=firstArtifact.ProvenanceDigest || bits.DependencyDigest!=firstArtifact.DependencyDigest)) ||
            new[] {bits.ExeDigest,bits.AssemblyDigest,bits.PlanDigest,bits.ProvenanceDigest,bits.DependencyDigest}.Any(h=>!Policy.Hex(h,64)) ||
            resultIds.Length==0) throw new ArgumentException("SESSION_BINDING_REFUSED");
        current=expected with {RunIds=expected.RunIds.ToArray()};first??=current;
        artifact=bits;firstArtifact??=bits;results=resultIds.ToArray();actionIndex=0;
        foreach(var id in current.RunIds) used.Add(id);
    }
    internal void Begin(string action,bool authorized)
    {
        if(blocked || active || current is null || !authorized || actionIndex>=current.RunIds.Length ||
            action!=Policy.StageActions(current.Stage)[actionIndex]) throw new ArgumentException("SESSION_ACTION_REFUSED");
        active=true;
    }
    internal void Observe(byte[] report,bool workerEnded)
    {
        if(blocked || !active || current is null) throw new ArgumentException("SESSION_OBSERVATION_REFUSED");
        if(!workerEnded){blocked=true;throw new ArgumentException("SESSION_WORKER_UNKNOWN");}
        try {Policy.Report(report,current,actionIndex,artifact!,results!,guardian,app);}
        catch(ArgumentException){blocked=true;throw;}
        active=false;actionIndex++;
    }
    internal void Close(string checkpointDigest,string evidenceDigest,bool stoppedManual)
    {
        if(!stoppedManual){blocked=true;throw new ArgumentException("SESSION_STOP_UNKNOWN");}
        if(blocked || active || current is null || actionIndex!=current.RunIds.Length || !stoppedManual ||
            !Policy.Hex(checkpointDigest,64) || !Policy.Hex(evidenceDigest,64)) throw new ArgumentException("SESSION_CLOSE_REFUSED");
        checkpoint=checkpointDigest;evidence=evidenceDigest;current=null;stageIndex++;
    }
    internal bool Complete=>stageIndex==3 && !blocked && !active && current is null;
}

// Separate owner authorization is represented by an injected flag, not obtained
// by this model. No retries or later action after uncertain completion.
internal sealed class Sequence
{
    internal static readonly string[] Actions = {"setup-create","guardian-prepare","setup-publish","app-prepare","child-prepare",
        "guardian-fresh","app-fresh","child-fresh","setup-finish","guardian-absence"};
    private int next; private bool active, blocked;
    internal void Start(string action, bool authorized)
    {
        if (!authorized || active || blocked || next>=Actions.Length || action!=Actions[next]) throw new ArgumentException("SEQUENCE_REFUSED");
        active=true;
    }
    internal void End(bool workerEnded, bool success)
    {
        if (!active) throw new ArgumentException("NO_ACTIVE_ACTION");
        if (blocked) { if (workerEnded) active=false; return; }
        if (!workerEnded || !success) { blocked=true; return; }
        active=false; next++;
    }
    internal bool Complete => next==Actions.Length && !active && !blocked;
}
