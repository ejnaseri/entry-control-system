using Microsoft.Win32.SafeHandles;
namespace EntryControl.TestOnly.Runtime;

internal enum CollisionState { Present, Absent, Unknown }
internal sealed record KeyCollision(string Label,int NativeStatus,CollisionState State);
internal sealed record BootstrapCollision(bool RootAbsent,bool ServicesAbsent,KeyCollision[] Keys);
internal sealed record PackageBytes(string Name,byte[] Bytes);
// Read-only preflight candidate, not bootstrap permission or a mutation route.
internal static class BootstrapAdmission
{
    internal static CollisionState RootState(bool opened,int error)=>opened?CollisionState.Present:
        error==2?CollisionState.Absent:CollisionState.Unknown;
    internal static CollisionState KeyState(int status)=>status==0?CollisionState.Present:CollisionState.Unknown;
    internal static void RequireClear(BootstrapCollision collision)
    {
        Program.Need(collision.RootAbsent && collision.ServicesAbsent && collision.Keys.Length==2 &&
            collision.Keys.Select(k=>k.Label).SequenceEqual(KeyOperations.Labels),"BOOTSTRAP_COLLISION_REFUSED");
        // No supported raw NCryptOpenKey result proves preexisting-name absence
        // in this approved context. In particular BAD_KEYSET must stay UNKNOWN.
        Program.Need(collision.Keys.All(k=>k.State==KeyState(k.NativeStatus) && k.State==CollisionState.Absent),
            "BOOTSTRAP_KEY_ABSENCE_UNRESOLVED");
    }
    internal static bool RootAbsent()
    {
        NativeTokens.Capture("Controller");string path=SecureFiles.PathOf("");SecureFiles.PlainAncestors(path);
        // OPEN_EXISTING + OPEN_REPARSE_POINT + BACKUP_SEMANTICS. A directory,
        // plain file or dangling reparse entry is a collision, not adoptable.
        using var handle=CreateFileW(path,0x80,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
        int error=Marshal.GetLastWin32Error();var state=RootState(!handle.IsInvalid,error);
        Program.Need(state!=CollisionState.Unknown,"ROOT_COLLISION_UNKNOWN");return state==CollisionState.Absent;
    }
    internal static BootstrapCollision ReadCollisions(PilotPlan plan,string approvedPlanHash)
    {
        NativeTokens.Capture("Controller");PlanAdmission.Validate(plan);
        Program.Need(plan.Stage=="Prepare" && Program.Hash(Program.Serialize(plan))==approvedPlanHash &&
            RuntimeInformation.ProcessArchitecture==Architecture.X64 && Environment.Version.ToString()=="10.0.11" &&
            NativeTokens.BootIdentity()==plan.BootIdentity,"BOOTSTRAP_PLAN_CONTEXT_REFUSED");
        Program.Need(RootAbsent(),"ROOT_ALREADY_PRESENT_RETAIN");
        foreach(string role in new[]{"Setup","Guardian","App"})Program.Need(ControllerWindows.RegistrationAbsent(role),"SERVICE_ALREADY_PRESENT_RETAIN");
        var keys=KeyOperations.Labels.Select(label=>{int status=KeyOperations.OpenStatus(plan,label);
            return new KeyCollision(label,status,KeyState(status));}).ToArray();
        return new(true,true,keys);
    }
    // This method deliberately cannot reach a create operation under current
    // contracts. Do not add an override for UNKNOWN or reinterpret denied access.
    internal static void Admit(PilotPlan plan,string approvedPlanHash)=>RequireClear(ReadCollisions(plan,approvedPlanHash));
    internal static void SuccessorContext(PilotPlan plan,string approvedPlanHash,string approvedPacketHash)
    {
        PlanAdmission.Validate(plan);
        Program.Need(plan.Stage=="Prepare" && Program.Hash(Program.Serialize(plan))==approvedPlanHash &&
            approvedPacketHash==Program.SuccessorPacketSha256,"SUCCESSOR_CONTEXT_REFUSED");
    }
    // Distinct successor contract: do not call/catch/override legacy RequireClear,
    // and do not make a negative key-open assertion. No mutation permission yet.
    internal static void AdmitSuccessor(PilotPlan plan,string approvedPlanHash,string approvedPacketHash)
    {
        SuccessorContext(plan,approvedPlanHash,approvedPacketHash);NativeTokens.Capture("Controller");
        HostAdmission.Verify(plan);
        Program.Need(RuntimeInformation.ProcessArchitecture==Architecture.X64 && Environment.Version.ToString()=="10.0.11" &&
            NativeTokens.BootIdentity()==plan.BootIdentity,"BOOTSTRAP_PLAN_CONTEXT_REFUSED");
        Program.Need(RootAbsent(),"ROOT_ALREADY_PRESENT_RETAIN");
        foreach(string role in new[]{"Setup","Guardian","App"})Program.Need(ControllerWindows.RegistrationAbsent(role),"SERVICE_ALREADY_PRESENT_RETAIN");
        // Exact-name collision is enforced later by Setup.Create without overwrite.
        // This read-only method does not create/copy/register/start anything.
    }
    internal static readonly string[] PublicDirectories={"","bin","plans","controller","setup-reports","guardian-reports","app-reports"};
    internal static PackageBytes[] SnapshotPackage(PilotPlan plan,PackageBytes[] input)
    {
        PlanAdmission.Validate(plan);
        Program.Need(input.Length==plan.PackageFiles.Length && input.Sum(f=>(long)f.Bytes.Length)<=536870912 &&
            input.Select(f=>f.Name).SequenceEqual(plan.PackageFiles.Select(f=>f.Name)),"BOOTSTRAP_PACKAGE_INVENTORY_REFUSED");
        var snapshot=input.Select(f=>new PackageBytes(f.Name,(byte[])f.Bytes.Clone())).ToArray();
        for(int i=0;i<snapshot.Length;i++)Program.Need(snapshot[i].Bytes.LongLength==plan.PackageFiles[i].Size &&
            Program.Hash(snapshot[i].Bytes)==plan.PackageFiles[i].Sha256,"BOOTSTRAP_PACKAGE_DIGEST_REFUSED");return snapshot;
    }
    internal sealed class Completion
    {
    private readonly OwnerAdmission owner;
    internal OwnerReservation Reservation {get;}
    private Completion(OwnerAdmission owner,OwnerReservation reservation)
    {this.owner=owner;Reservation=reservation;}
    internal void RequireBinding(OwnerAdmission input)
    {Program.Need(ReferenceEquals(owner,input),"BOOTSTRAP_PROVENANCE_OWNER_REFUSED");Reservation.RequireBinding(input);}
    internal static Completion CreatePublicAndRegister(ConfirmedOwnerStage confirmation,string approvedPlanHash,string approvedPacketHash,PackageBytes[] package)
    {
        Program.Need(OwnerJournal.CoordinatorReady,"OWNER_JOURNAL_COORDINATION_NOT_READY");
        var input=confirmation.Owner;
        // Freeze before checks/mutation; caller-owned arrays must not change the
        // admitted plan or package midway through publication.
        SuccessorContext(input.Snapshot,approvedPlanHash,approvedPacketHash);
        input.VerifyLiveControllerOwner();
        var plan=input.BeginBootstrap(DateTimeOffset.UtcNow);SuccessorContext(plan,approvedPlanHash,approvedPacketHash);
        var bytes=SnapshotPackage(plan,package);AdmitSuccessor(plan,approvedPlanHash,approvedPacketHash);
        // Exact-name derivation does not depend on an account already existing.
        // RegisterAllNew and role token checks still require actual post-create SIDs.
        Program.Need(NativeTokens.DerivedServiceSid("Guardian")==plan.GuardianSid && NativeTokens.DerivedServiceSid("App")==plan.AppSid,"BOOTSTRAP_SID_DERIVATION_REFUSED");
        foreach(string relative in new[]{"","controller"})SecureFiles.CreateDirectory(relative,"Controller",plan.GuardianSid,plan.AppSid);
        var reservation=OwnerReservation.Create(confirmation);
        reservation.VerifyLive(input);
        foreach(string relative in PublicDirectories.Where(x=>x!="" && x!="controller"))SecureFiles.CreateDirectory(relative,"Controller",plan.GuardianSid,plan.AppSid);
        foreach(var file in bytes) {
            string relative="bin/"+file.Name;SecureFiles.Write(relative,file.Bytes,"Controller",plan.GuardianSid,plan.AppSid,plan);
            Program.Need(SecureFiles.Read(relative,plan.GuardianSid,plan.AppSid,plan,int.MaxValue).SequenceEqual(file.Bytes),"BOOTSTRAP_COPY_READBACK_REFUSED");
        }
        var planBytes=Program.Serialize(plan);string planFile="plans/prepare.json";
        SecureFiles.Write(planFile,planBytes,"Controller",plan.GuardianSid,plan.AppSid);
        Program.Need(SecureFiles.Read(planFile,plan.GuardianSid,plan.AppSid).SequenceEqual(planBytes),"BOOTSTRAP_PLAN_READBACK_REFUSED");
        var admission=Program.Serialize(new{schemaVersion=1,plan.ExperimentId,planSha256=approvedPlanHash,
            successorPacketSha256=approvedPacketHash,ownerDecisionSha256=input.DecisionSha256,runtimeAuthority="NONE",securityAccepted=false,productionAccepted=false});
        SecureFiles.Write("controller/run-admission.json",admission,"Controller",plan.GuardianSid,plan.AppSid);
        Program.Need(SecureFiles.Read("controller/run-admission.json",plan.GuardianSid,plan.AppSid).SequenceEqual(admission),"BOOTSTRAP_ADMISSION_READBACK_REFUSED");
        // CreateService, never open-and-reconfigure/adopt an existing registration.
        // Any partial failure propagates; no directory/service/key rollback.
        reservation.VerifyLive(input);
        var services=ControllerWindows.RegisterAllNew(plan,approvedPlanHash,approvedPacketHash);
        OwnerAdmission.ValidateBootstrapServices(plan,services);
        reservation.VerifyLive(input);
        var completion=new Completion(input,reservation);input.CompleteBootstrap(completion);return completion;
    }
    }
    internal static int SelfTest()
    {
        int count=0;void Check(bool condition){Program.Need(condition,"BOOTSTRAP_RULE_FAILED");count++;}
        void Reject(Action action){try{action();}catch(InvalidDataException){count++;return;}throw new InvalidDataException("BOOTSTRAP_REFUSAL_MISSING");}
        Check(RootState(true,0)==CollisionState.Present);Check(RootState(false,2)==CollisionState.Absent);
        foreach(int error in new[]{0,3,5,32,1920})Check(RootState(false,error)==CollisionState.Unknown);
        Check(KeyState(0)==CollisionState.Present);
        foreach(int status in new[]{unchecked((int)0x80090016),unchecked((int)0x80090010),unchecked((int)0x8009000f),5,-1}) {
            Check(KeyState(status)==CollisionState.Unknown);
            var keys=KeyOperations.Labels.Select(label=>new KeyCollision(label,status,CollisionState.Unknown)).ToArray();
            Reject(()=>RequireClear(new(true,true,keys)));
            Reject(()=>RequireClear(new(true,true,keys.Select(k=>k with {State=CollisionState.Absent}).ToArray())));
        }
        var present=KeyOperations.Labels.Select(label=>new KeyCollision(label,0,CollisionState.Present)).ToArray();
        Reject(()=>RequireClear(new(true,true,present)));Reject(()=>RequireClear(new(false,true,present)));
        Reject(()=>RequireClear(new(true,false,present)));Reject(()=>RequireClear(new(true,true,present[..1])));
        Reject(()=>RequireClear(new(true,true,present.Reverse().ToArray())));return count;
    }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
}
