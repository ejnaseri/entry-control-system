using Microsoft.Win32.SafeHandles;
using EntryControl.TestOnly.Runtime;
using AccessRule = EntryControl.TestOnly.Runtime.AccessRule;
namespace EntryControl.TestOnly.Diagnostics;

internal sealed record DiagnosticReport(int SchemaVersion, string Scope, string ExperimentId,
    string PlanSha256, string AssemblySha256, string BootIdentity,
    string ApprovalSha256, string PackageSha256, string AttemptId,
    int ProcessId, DateTimeOffset ProcessStartedUtc,
    bool WorkerEnded, bool DeadlineExceeded, Observation[] Results, Failure? WorkerFailure,
    bool SecurityAccepted, bool ProductionAccepted);

// The controller and service independently construct this from the separately
// pinned approval/package plus the protected, one-attempt reservation. None of
// these expected values are derived from the diagnostic report itself.
internal sealed record ReportBinding(string ApprovalSha256, string PackageSha256,
    string AttemptId, DateTimeOffset AttemptReservedUtc);

// Native components stay unreachable in the default inert build. A capable
// service entry still requires the separately pinned deployment admission.
internal static class NativeDiagnostic
{
    internal const string Root = "C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV3";
    internal const int ReportSchemaVersion = 4;
    internal const string Guardian = "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315";
    internal const string Experiment = "30173bfda30af041dcc879170579d658";
    internal const string PlanHash = "5f1a449b81d80da5c741f99e0274c2553b177df9795706cc91df71894acdfd4e";
    internal const string Scope = "TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V4";
    private const string SystemSid = "S-1-5-18", AdminSid = "S-1-5-32-544";
    private const int Full = 0x1f01ff, Read = 0x120089, ReadExecute = 0x1200a9, Modify = 0x1301bf;

    private static void ValidateBinding(ReportBinding binding, DateTimeOffset notAfter)
    {
        Program.Need(binding is not null && Program.Hex(binding.ApprovalSha256,64) && Program.Hex(binding.PackageSha256,64) &&
            Program.Hex(binding.AttemptId,32) && binding.AttemptReservedUtc != default &&
            binding.AttemptReservedUtc.Offset == TimeSpan.Zero && notAfter.Offset == TimeSpan.Zero &&
            binding.AttemptReservedUtc <= notAfter, "DIAGNOSTIC_EXPECTED_BINDING_REFUSED");
    }
    private static bool ValidFailure(Failure? failure) => failure is not null &&
        failure.WrapperDepth is >= 0 and <= 8 && (failure.Kind switch {
            "CRYPTOGRAPHIC" => failure.NativeStatus == failure.HResult,
            "AGGREGATE_UNRESOLVED" or "ACCESS" or "VALIDATION" or "IO" or "OTHER" => failure.NativeStatus is null,
            _ => false
        });
    private static bool ContinuingExportFailure(int index,Failure? failure) =>
        index is >= 7 and <= 9 && failure is not null && failure.Kind=="CRYPTOGRAPHIC" &&
        failure.WrapperDepth==0 && unchecked((uint)failure.HResult)==0x80090029 &&
        failure.NativeStatus==failure.HResult;
    internal static void ValidateReport(DiagnosticReport report, string assembly, string boot,
        ReportBinding binding, DateTimeOffset notAfter, int observedProcessId = 0)
    {
        ValidateBinding(binding,notAfter);
        Program.Need(report is not null && report.SchemaVersion == ReportSchemaVersion && report.Scope == Scope && report.ExperimentId == Experiment &&
            report.PlanSha256 == PlanHash && Program.Hex(assembly,64) && report.AssemblySha256 == assembly &&
            Program.Hex(boot,64) && report.BootIdentity == boot &&
            report.ApprovalSha256 == binding.ApprovalSha256 && report.PackageSha256 == binding.PackageSha256 &&
            report.AttemptId == binding.AttemptId && report.ProcessId > 0 && observedProcessId >= 0 &&
            (observedProcessId == 0 || report.ProcessId == observedProcessId) &&
            report.ProcessStartedUtc.Offset == TimeSpan.Zero && report.ProcessStartedUtc >= binding.AttemptReservedUtc &&
            report.ProcessStartedUtc <= notAfter && report.WorkerEnded &&
            !report.SecurityAccepted && !report.ProductionAccepted && report.Results is not null &&
            (report.WorkerFailure is null || ValidFailure(report.WorkerFailure)) &&
            report.Results.Length <= Diagnostic.Steps.Length, "DIAGNOSTIC_REPORT_BINDING_REFUSED");
        var results = report!.Results!;
        bool anyUnknown=false;
        for (int i = 0; i < results.Length; i++) {
            var row = results[i];
            Program.Need(row is not null && row.Step == Diagnostic.Steps[i] &&
                ((row.Status == "PASS" && row.Failure is null) ||
                 (row.Status == "UNKNOWN" && ValidFailure(row.Failure) &&
                  (i == results.Length - 1 || ContinuingExportFailure(i,row.Failure)))), "DIAGNOSTIC_REPORT_ORDER_REFUSED");
            // Unsupported export observations never authorize seal/roundtrip.
            Program.Need(i!=10 || !anyUnknown,"DIAGNOSTIC_SEAL_AFTER_UNKNOWN_REFUSED");
            anyUnknown |= row!.Status=="UNKNOWN";
        }
        bool terminalFailure=results.Length>0 && results[^1].Status=="UNKNOWN" &&
            !ContinuingExportFailure(results.Length-1,results[^1].Failure);
        bool exportsObserved=results.Length==10 && anyUnknown;
        Program.Need(report.WorkerFailure is not null || report.DeadlineExceeded ||
            results.Length == Diagnostic.Steps.Length || exportsObserved || terminalFailure, "DIAGNOSTIC_REPORT_INCOMPLETE");
    }
    internal static bool CompletedProbe(DiagnosticReport r) => r is not null && r.SchemaVersion == ReportSchemaVersion &&
        r.Scope == Scope && r.WorkerEnded && !r.DeadlineExceeded && r.WorkerFailure is null &&
        r.Results is not null && r.Results.Length == Diagnostic.Steps.Length &&
        r.Results.Zip(Diagnostic.Steps,(row,step) => row is not null && row.Step == step &&
            row.Status == "PASS" && row.Failure is null).All(valid => valid);

    // Caller must verify the diagnostic deployment, runtime and approval first.
    // No PlanAdmission.Admit/RunRole: those routes would run the original Prepare.
    internal static DiagnosticReport Collect(string expectedAssembly, string expectedBoot, ReportBinding binding)
    {
        ValidateBinding(binding,DateTimeOffset.UtcNow);
        Program.Need(Program.Hex(expectedAssembly,64) && Program.Hex(expectedBoot,64), "DIAGNOSTIC_INPUT_REFUSED");
        DateTimeOffset startedUtc;
        using(var process = Process.GetCurrentProcess()) startedUtc = new DateTimeOffset(process.StartTime.ToUniversalTime());
        Program.Need(startedUtc >= binding.AttemptReservedUtc && startedUtc <= DateTimeOffset.UtcNow,
            "DIAGNOSTIC_PROCESS_ATTEMPT_REFUSED");
        Program.Need(Program.Hash(File.ReadAllBytes(typeof(NativeDiagnostic).Assembly.Location)) == expectedAssembly, "DIAGNOSTIC_ASSEMBLY_REFUSED");
        var token = NativeTokens.Capture("Guardian");
        Program.Need(token.Service == Guardian && NativeTokens.BootIdentity() == expectedBoot, "DIAGNOSTIC_CONTEXT_REFUSED");
        var planBytes = SecureFiles.Read("plans/prepare.json", Guardian, NativeTokens.Sid("App"));
        Program.Need(Program.Hash(planBytes) == PlanHash, "DIAGNOSTIC_PLAN_REFUSED");
        var plan = Program.Parse<PilotPlan>(planBytes); PlanAdmission.Validate(plan);
        Program.Need(plan.ExperimentId == Experiment && plan.Stage == "Prepare" && plan.GuardianSid == Guardian, "DIAGNOSTIC_PLAN_CONTEXT_REFUSED");
        HostAdmission.Verify(plan);
        // Original package verification without asserting that this separate
        // diagnostic executable is the original pilot executable.
        var files = Directory.GetFileSystemEntries(SecureFiles.PathOf("bin"));
        Program.Need(files.Length == plan.PackageFiles.Length && files.All(f => plan.PackageFiles.Any(p => p.Name == Path.GetFileName(f))), "DIAGNOSTIC_ORIGINAL_INVENTORY_REFUSED");
        foreach (var file in plan.PackageFiles) {
            var bytes = SecureFiles.Read("bin/" + file.Name, plan.GuardianSid, plan.AppSid, plan, 536870912);
            Program.Need(bytes.LongLength == file.Size && Program.Hash(bytes) == file.Sha256, "DIAGNOSTIC_ORIGINAL_HASH_REFUSED");
        }
        Program.Need(Environment.Version.ToString() == "10.0.11" && RuntimeInformation.ProcessArchitecture == Architecture.X64, "DIAGNOSTIC_RUNTIME_REFUSED");
        Observation[] rows = Array.Empty<Observation>(); Failure? failure = null;
        var timer = Stopwatch.StartNew();
        try { rows = NativeWorker.Run(() => Diagnostic.Probe(plan), 10000); }
        catch (Exception error) { failure = Diagnostic.Describe(error); }
        // NativeWorker never releases the caller while native work remains live.
        Program.Need(NativeWorker.Ended, "DIAGNOSTIC_WORKER_LIVE");
        bool late = timer.ElapsedMilliseconds >= 10000;
        Program.Need(NativeTokens.Capture("Guardian") == token && NativeTokens.BootIdentity() == expectedBoot, "DIAGNOSTIC_POST_CONTEXT_REFUSED");
        var report = new DiagnosticReport(ReportSchemaVersion, Scope, Experiment, PlanHash, expectedAssembly, expectedBoot,
            binding.ApprovalSha256,binding.PackageSha256,binding.AttemptId,
            Environment.ProcessId, startedUtc, true, late, rows, failure, false, false);
        ValidateReport(report, expectedAssembly, expectedBoot, binding, DateTimeOffset.UtcNow, Environment.ProcessId); return report;
    }

    private static AccessRule DirectoryRule(bool reports) => new(AdminSid, "Controller",
        new[] { (SystemSid, Full), (AdminSid, Full), (Guardian, reports ? Modify : ReadExecute) }, true);
    private static AccessRule ReportRule() => new(Guardian, "Guardian", new[] { (SystemSid, Full), (AdminSid, Read), (Guardian, Modify) });
    private static SafeFileHandle OpenDirectory(string path)
    {
        SecureFiles.PlainAncestors(path);
        var sa = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        var handle = CreateFileW(path, 0x20080, 3, ref sa, 3, 0x02200000, IntPtr.Zero);
        if (handle.IsInvalid) { handle.Dispose(); throw new InvalidDataException("DIAGNOSTIC_DIRECTORY_REFUSED"); }
        return handle;
    }
    internal static void WriteReport(DiagnosticReport report, string assembly, string boot, ReportBinding binding)
    {
        ValidateReport(report, assembly, boot, binding, DateTimeOffset.UtcNow, Environment.ProcessId); NativeTokens.Capture("Guardian");
        using var root = OpenDirectory(Root); SecureFiles.Check(root, DirectoryRule(false), Root);
        string directory = Path.Combine(Root, "reports"), path = Path.Combine(directory, "result.json");
        using var parent = OpenDirectory(directory); SecureFiles.Check(parent, DirectoryRule(true), directory);
        var rule = ReportRule();
        var sd = new RawSecurityDescriptor("O:" + Guardian + "D:P" + string.Concat(rule.Aces.Select(a => $"(A;;0x{a.Mask:x};;;{a.Sid})")));
        byte[] descriptor = new byte[sd.BinaryLength]; sd.GetBinaryForm(descriptor,0);
        var pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned); SafeFileHandle handle;
        try {
            var sa = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = pin.AddrOfPinnedObject() };
            handle = CreateFileW(path, 0x40020080, 0, ref sa, 1, 0x00200000, IntPtr.Zero);
        } finally { pin.Free(); }
        using (handle) {
            Program.Need(!handle.IsInvalid, "DIAGNOSTIC_REPORT_EXISTS_OR_REFUSED");
            SecureFiles.Check(handle, rule, path);
            byte[] bytes = Program.Serialize(report); Program.Need(bytes.Length <= 32768, "DIAGNOSTIC_REPORT_SIZE_REFUSED");
            using var stream = new FileStream(handle, FileAccess.Write);
            stream.Write(bytes); stream.Flush(true); SecureFiles.Check(handle,rule,path);
        }
        SecureFiles.Check(parent,DirectoryRule(true),directory); SecureFiles.Check(root,DirectoryRule(false),Root);
    }

    // Own SCM dispatcher: accepts only the service name and no action parameters.
    // Diagnostic completion is not security acceptance or a Prepare checkpoint.
    internal static void DispatchBound(Func<(string Assembly, string Boot, ReportBinding Report)> admitDeployment, Action verifyDeployment)
    {
        IntPtr statusHandle = IntPtr.Zero;
        Control control = (_,_,_,_) => 120;
        void Status(uint state, uint exit) {
            var status = new ServiceStatus { Type=16, State=state, Win32Exit=exit };
            Program.Need(SetServiceStatus(statusHandle,ref status), "DIAGNOSTIC_SCM_STATUS_REFUSED");
        }
        ServiceMain main = (count,args) => {
            statusHandle=RegisterServiceCtrlHandlerExW(Launcher.Service,control,IntPtr.Zero);
            if(statusHandle==IntPtr.Zero)return;
            uint exit=1067;
            try {
                Program.Need(count==1 && args!=IntPtr.Zero,"DIAGNOSTIC_SCM_ARGS_REFUSED");
                var pointer=Marshal.ReadIntPtr(args); Program.Need(pointer!=IntPtr.Zero,"DIAGNOSTIC_SCM_NAME_REFUSED");
                var expected=Launcher.Service;
                for(int i=0;i<=expected.Length;i++) Program.Need(Marshal.ReadInt16(pointer,i*2)==(i==expected.Length?0:expected[i]),"DIAGNOSTIC_SCM_NAME_REFUSED");
                Status(4,0); var binding=admitDeployment();
                var report=Collect(binding.Assembly,binding.Boot,binding.Report); verifyDeployment(); WriteReport(report,binding.Assembly,binding.Boot,binding.Report);
                if(CompletedProbe(report))exit=0;
            } catch { /* Never emit arbitrary exception text or retry. */ }
            finally { Status(1,exit); }
        };
        Program.Need(StartServiceCtrlDispatcherW(new[] {new ServiceEntry { Name=Launcher.Service, Callback=main },new ServiceEntry()}),"DIAGNOSTIC_SCM_DISPATCH_REFUSED");
        GC.KeepAlive(main); GC.KeepAlive(control);
    }
    internal static int SelfTest()
    {
        int count=0; string hash=new('a',64),boot=new('b',64);
        var reserved=DateTimeOffset.UnixEpoch;
        var now=reserved.AddSeconds(5);
        var binding=new ReportBinding(new('c',64),new('d',64),new('e',32),reserved);
        void Check(bool ok){Program.Need(ok,"NATIVE_DIAGNOSTIC_TEST_FAILED");count++;}
        void Reject(DiagnosticReport value){try{ValidateReport(value,hash,boot,binding,now);}catch(InvalidDataException){count++;return;}throw new Exception("REPORT_REFUSAL_MISSING");}
        void RejectExpected(DiagnosticReport value,ReportBinding expected,DateTimeOffset until,int pid=0){try{ValidateReport(value,hash,boot,expected,until,pid);}catch(InvalidDataException){count++;return;}throw new Exception("EXPECTED_REPORT_REFUSAL_MISSING");}
        var good=new DiagnosticReport(ReportSchemaVersion,Scope,Experiment,PlanHash,hash,boot,binding.ApprovalSha256,binding.PackageSha256,binding.AttemptId,
            1,reserved.AddSeconds(1),true,false,Diagnostic.Sequence(_=>{}),null,false,false);
        ValidateReport(good,hash,boot,binding,now);Check(good.Results.Length==11 && CompletedProbe(good));
        foreach(var bad in new[]{good with{SchemaVersion=1},good with{SchemaVersion=2},good with{SchemaVersion=3},
            good with{Scope="TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V1"},good with{Scope="TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V2"},
            good with{Scope="TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V3"},
            good with{ExperimentId=new('f',32)},good with{PlanSha256=new('f',64)},good with{AssemblySha256=new('f',64)},good with{BootIdentity=new('f',64)},
            good with{ApprovalSha256=new('f',64)},good with{PackageSha256=new('f',64)},good with{AttemptId=new('f',32)},
            good with{ApprovalSha256=null!},good with{PackageSha256=null!},good with{AttemptId=null!},
            good with{ProcessId=0},good with{ProcessStartedUtc=default},good with{ProcessStartedUtc=reserved.AddTicks(-1)},
            good with{ProcessStartedUtc=now.AddTicks(1)},good with{ProcessStartedUtc=good.ProcessStartedUtc.ToOffset(TimeSpan.FromHours(1))},
            good with{WorkerEnded=false},good with{SecurityAccepted=true},good with{ProductionAccepted=true},
            good with{Results=good.Results.Reverse().ToArray()},good with{Results=good.Results[..2]},
            good with{Results=good.Results[..10]},good with{Results=Array.Empty<Observation>()},good with{Results=null!}})Reject(bad);
        Reject(null!);
        Observation[] ReplaceRow(int index,Observation row) => good.Results.Select((value,i)=>i==index?row:value).ToArray();
        var malformedFailure=new Failure("UNRECOGNIZED",0,null,0);
        foreach(var row in new Observation[]{null!,new(null!,"PASS",null),new(Diagnostic.Steps[7],null!,null),
            new(Diagnostic.Steps[7],"FAIL",null),new(Diagnostic.Steps[7],"PASS",Diagnostic.Describe(new IOException()))})
            Reject(good with{Results=ReplaceRow(7,row)});
        Reject(good with{Results=good.Results[..7].Append(new Observation(Diagnostic.Steps[7],"UNKNOWN",null)).ToArray()});
        foreach(var failure in new[]{malformedFailure,malformedFailure with{Kind=null!},
            new Failure("IO",0,null,-1),new Failure("IO",0,null,9),new Failure("IO",0,0,0),
            new Failure("CRYPTOGRAPHIC",1,null,0),new Failure("CRYPTOGRAPHIC",1,2,0)})
            Reject(good with{Results=good.Results[..7].Append(new Observation(Diagnostic.Steps[7],"UNKNOWN",failure)).ToArray()});
        Reject(good with{WorkerFailure=malformedFailure});
        // V4 keeps three distinct export observations; V2's grouped row cannot be
        // re-labelled as a current report, nor can an export be moved or omitted.
        Reject(good with{Results=good.Results[..7].Concat(new[]{new Observation("private-export-denied","PASS",null),good.Results[10]}).ToArray()});
        Reject(good with{Results=good.Results.Select((row,i)=>i==7?good.Results[8]:i==8?good.Results[7]:row).ToArray()});
        Reject(good with{Results=ReplaceRow(8,good.Results[7])});
        foreach(var (step,index) in new[]{("private-export-generic",7),("private-export-pkcs8",8),("private-export-opaque",9)}) {
            Check(good.Results[index].Step==step && good.Results[10].Step=="seal-roundtrip-memory");
            Reject(good with{Results=good.Results.Where((_,i)=>i!=index).ToArray()});
        }
        const int unsupported=unchecked((int)0x80090029);
        var unsupportedFailure=new Failure("CRYPTOGRAPHIC",unsupported,unsupported,0);
        Observation UnknownAt(int index,Failure failure)=>new(Diagnostic.Steps[index],"UNKNOWN",failure);
        void AcceptUnknown(Observation[] rows) {
            var value=good with{Results=rows};ValidateReport(value,hash,boot,binding,now);
            Check(!CompletedProbe(value));
        }
        // All seven combinations of independent unsupported exports must survive
        // serialization, retain UNKNOWN, and stop before the seal row.
        for(int mask=1;mask<8;mask++) {
            var rows=good.Results[..10].Select((row,index)=>
                index>=7 && (mask&(1<<(index-7)))!=0?UnknownAt(index,unsupportedFailure):row).ToArray();
            AcceptUnknown(rows);
            var matrix=good with{Results=rows};
            var matrixBytes=Program.Serialize(matrix);
            var restored=Program.Parse<DiagnosticReport>(matrixBytes);
            ValidateReport(restored,hash,boot,binding,now);
            Check(restored.Results.SequenceEqual(rows) && Program.Serialize(restored).SequenceEqual(matrixBytes) && !CompletedProbe(restored));
            Reject(matrix with{Results=rows.Append(good.Results[10]).ToArray()});
            Reject(matrix with{Results=rows.Append(UnknownAt(10,Diagnostic.Describe(new IOException()))).ToArray()});
            Reject(matrix with{Results=rows.Append(good.Results[10]).ToArray(),DeadlineExceeded=true});
            Reject(matrix with{Results=rows.Append(good.Results[10]).ToArray(),WorkerFailure=Diagnostic.Describe(new Exception())});
            Reject(matrix with{Results=rows.Reverse().ToArray()});
            Reject(matrix with{Results=rows.Select((row,index)=>index==8?rows[7]:row).ToArray()});
        }
        // Direct unsupported is nonterminal only within the export observations.
        for(int index=0;index<7;index++) {
            var terminal=good.Results[..index].Append(UnknownAt(index,unsupportedFailure)).ToArray();
            AcceptUnknown(terminal);
            Reject(good with{Results=terminal.Append(good.Results[index+1]).ToArray()});
        }
        for(int index=7;index<9;index++) {
            var premature=good with{Results=good.Results[..index].Append(UnknownAt(index,unsupportedFailure)).ToArray()};
            Reject(premature);
            var interrupted=premature with{WorkerFailure=Diagnostic.Describe(new Exception())};
            ValidateReport(interrupted,hash,boot,binding,now);Check(!CompletedProbe(interrupted));
            interrupted=premature with{DeadlineExceeded=true};
            ValidateReport(interrupted,hash,boot,binding,now);Check(!CompletedProbe(interrupted));
        }
        // An earlier unsupported row followed by PASS is still incomplete until
        // opaque has been observed, unless a worker/deadline interruption exists.
        var shortMatrix=good with{Results=good.Results[..9].Select((row,index)=>index==7?UnknownAt(index,unsupportedFailure):row).ToArray()};
        Reject(shortMatrix);
        var shortInterrupted=shortMatrix with{WorkerFailure=Diagnostic.Describe(new Exception())};
        ValidateReport(shortInterrupted,hash,boot,binding,now);Check(!CompletedProbe(shortInterrupted));
        shortInterrupted=shortMatrix with{DeadlineExceeded=true};
        ValidateReport(shortInterrupted,hash,boot,binding,now);Check(!CompletedProbe(shortInterrupted));
        var terminalFailures=new[]{
            new Failure("CRYPTOGRAPHIC",unchecked((int)0x80090016),unchecked((int)0x80090016),0),
            unsupportedFailure with{WrapperDepth=1},
            new Failure("AGGREGATE_UNRESOLVED",unsupported,null,0),
            Diagnostic.Describe(new UnauthorizedAccessException()),Diagnostic.Describe(new IOException()),
            Diagnostic.Describe(new InvalidDataException()),Diagnostic.Describe(new Exception())
        };
        foreach(var failure in terminalFailures) {
            for(int index=7;index<10;index++) {
                var terminal=good.Results[..index].Append(UnknownAt(index,failure)).ToArray();
                AcceptUnknown(terminal);
                Reject(good with{Results=terminal.Append(good.Results[index+1]).ToArray()});
                if(index>7) {
                    terminal[7]=UnknownAt(7,unsupportedFailure);
                    AcceptUnknown(terminal);
                    Reject(good with{Results=terminal.Append(good.Results[index+1]).ToArray()});
                }
            }
        }
        // Structurally malformed unsupported metadata is rejected even at the
        // end of the export matrix and when a worker interruption is supplied.
        foreach(var failure in new[]{unsupportedFailure with{NativeStatus=null},unsupportedFailure with{NativeStatus=0},
            unsupportedFailure with{WrapperDepth=-1},unsupportedFailure with{WrapperDepth=9},
            unsupportedFailure with{Kind="IO"},unsupportedFailure with{Kind=null!}}) {
            var malformed=good with{Results=good.Results[..9].Append(UnknownAt(9,failure)).ToArray()};
            Reject(malformed);Reject(malformed with{WorkerFailure=Diagnostic.Describe(new Exception())});
        }
        foreach(var bad in new[]{binding with{ApprovalSha256=""},binding with{PackageSha256=""},binding with{AttemptId=""},
            binding with{ApprovalSha256=new('A',64)},binding with{PackageSha256=new('D',64)},binding with{AttemptId=new('E',32)},
            binding with{AttemptReservedUtc=default},binding with{AttemptReservedUtc=now.AddTicks(1)},
            binding with{AttemptReservedUtc=reserved.ToOffset(TimeSpan.FromHours(1))}})RejectExpected(good,bad,now);
        RejectExpected(good,binding,now.ToOffset(TimeSpan.FromHours(1)));
        RejectExpected(good,binding,reserved.AddTicks(-1));
        RejectExpected(good,binding,now,-1);RejectExpected(good,binding,now,2);
        // A fast service may stop before SCM sampling observes a PID; zero means
        // no independent PID observation, never an invented correlation. The
        // unique attempt + protected report + start window remain mandatory.
        ValidateReport(good,hash,boot,binding,now,0);count++;
        ValidateReport(good,hash,boot,binding,now,1);count++;
        ValidateReport(good with{ProcessStartedUtc=reserved},hash,boot,binding,now);count++;
        ValidateReport(good with{ProcessStartedUtc=now},hash,boot,binding,now);count++;
        var serialized=Program.Serialize(good);
        var roundTrip=Program.Parse<DiagnosticReport>(serialized);
        ValidateReport(roundTrip,hash,boot,binding,now,1);
        Check(Program.Serialize(roundTrip).SequenceEqual(serialized) && roundTrip.Results.SequenceEqual(good.Results) &&
            roundTrip.SchemaVersion==ReportSchemaVersion && roundTrip.Scope==Scope && CompletedProbe(roundTrip));
        RejectExpected(roundTrip,binding with{ApprovalSha256=new('f',64)},now);
        RejectExpected(roundTrip,binding with{PackageSha256=new('f',64)},now);
        RejectExpected(roundTrip,binding with{AttemptId=new('f',32)},now);
        RejectExpected(roundTrip,binding with{AttemptReservedUtc=good.ProcessStartedUtc.AddTicks(1)},now);
        RejectExpected(roundTrip,binding,now,2);
        var late=good with{DeadlineExceeded=true};ValidateReport(late,hash,boot,binding,now);Check(!CompletedProbe(late));
        var failed=good with{Results=Diagnostic.Sequence(_=>throw new IOException("SECRET"))};ValidateReport(failed,hash,boot,binding,now);Check(!CompletedProbe(failed));
        var worker=good with{Results=Array.Empty<Observation>(),WorkerFailure=Diagnostic.Describe(new Exception())};ValidateReport(worker,hash,boot,binding,now);Check(!CompletedProbe(worker));
        Check(DirectoryRule(false).Aces.Single(a=>a.Sid==Guardian).Mask==ReadExecute);
        Check(DirectoryRule(true).Aces.Single(a=>a.Sid==Guardian).Mask==Modify);
        Check(ReportRule().Owner==Guardian && ReportRule().Aces.Single(a=>a.Sid==AdminSid).Mask==Read);
        return count;
    }
    [StructLayout(LayoutKind.Sequential)]private struct SecurityAttributes {internal int Length;internal IntPtr Descriptor;internal int Inherit;}
    [StructLayout(LayoutKind.Sequential)]private struct ServiceStatus {internal uint Type,State,Accepted,Win32Exit,SpecificExit,Checkpoint,WaitHint;}
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate void ServiceMain(uint count,IntPtr args);
    [UnmanagedFunctionPointer(CallingConvention.Winapi)]private delegate uint Control(uint code,uint type,IntPtr data,IntPtr context);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]private struct ServiceEntry {internal string? Name;internal ServiceMain? Callback;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,ref SecurityAttributes attributes,uint disposition,uint flags,IntPtr template);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool StartServiceCtrlDispatcherW([In] ServiceEntry[] entries);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr RegisterServiceCtrlHandlerExW(string name,Control callback,IntPtr context);
    [DllImport("advapi32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]private static extern bool SetServiceStatus(IntPtr handle,ref ServiceStatus status);
}
