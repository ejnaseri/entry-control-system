using EntryControl.TestOnly.Runtime;
namespace EntryControl.TestOnly.Diagnostics;

// Separate per-format diagnostic; default builds remain inert.
internal sealed record Failure(string Kind, int HResult, int? NativeStatus, int WrapperDepth);
internal sealed record Observation(string Step, string Status, Failure? Failure);
internal static class Diagnostic
{
#if TEST_CAPABLE_DIAGNOSTIC
    internal static bool PhysicalEnabled => true;
#else
    internal static bool PhysicalEnabled => false;
#endif
    internal static readonly string[] Steps = {
        "read-intent", "read-owned", "validate-ownership", "read-public-control",
        "validate-public-control", "open-key", "verify-policy-public-identity",
        "private-export-generic", "private-export-pkcs8", "private-export-opaque",
        "seal-roundtrip-memory"
    };
    internal static Failure Describe(Exception error)
    {
        int depth = 0;
        // Never emit Message, StackTrace, Data, paths, key names or buffer contents.
        while (error is AggregateException aggregate && aggregate.InnerExceptions.Count == 1 && depth < 8)
        { error = aggregate.InnerExceptions[0]; depth++; }
        // Count unwrapped aggregates plus one when the resulting cryptographic
        // exception wraps an inner error, capped at eight. Preserve that outer
        // cryptographic HResult; never unwrap its inner error for classification.
        if (error is CryptographicException { InnerException: not null } && depth < 8) depth++;
        string kind = error switch {
            AggregateException => "AGGREGATE_UNRESOLVED",
            CryptographicException => "CRYPTOGRAPHIC",
            UnauthorizedAccessException => "ACCESS",
            InvalidDataException => "VALIDATION",
            IOException => "IO",
            _ => "OTHER"
        };
        return new(kind, error.HResult, error is CryptographicException ? error.HResult : null, depth);
    }
    internal static bool CanContinueExport(string? step, Failure? failure) =>
        (step is "private-export-generic" or "private-export-pkcs8" or "private-export-opaque") &&
        failure is { Kind: "CRYPTOGRAPHIC", HResult: unchecked((int)0x80090029),
            NativeStatus: unchecked((int)0x80090029), WrapperDepth: 0 };
    internal static Observation[] Sequence(Action<string> operation)
    {
        var rows = new List<Observation>();
        foreach (string step in Steps) {
            if (step == "seal-roundtrip-memory" && rows.Any(row => row.Status == "UNKNOWN")) break;
            try { operation(step); rows.Add(new(step, "PASS", null)); }
            catch (Exception error) {
                var failure = Describe(error); rows.Add(new(step, "UNKNOWN", failure));
                if (error is not CryptographicException { InnerException: null } ||
                    unchecked((uint)error.HResult) != 0x80090029 || !CanContinueExport(step, failure)) break;
            }
        }
        return rows.ToArray();
    }

    // Only a pinned capable deployment can reach this worker. This method
    // deliberately cannot stage/publish files, modify ACLs or create/delete keys.
    internal static Observation[] Probe(PilotPlan plan)
    {
        const string label = "restricted";
        KeyIntent? intent = null; KeyOwned? owned = null; PublicControl? control = null;
        CngKey? key = null;
        try {
            return Sequence(step => {
                switch (step) {
                    case "read-intent": intent = Program.Parse<KeyIntent>(SecureFiles.Read("protected/restricted-intent.json", plan.GuardianSid, plan.AppSid, plan)); break;
                    case "read-owned": owned = Program.Parse<KeyOwned>(SecureFiles.Read("protected/restricted-owned.json", plan.GuardianSid, plan.AppSid, plan)); break;
                    case "validate-ownership":
                        Program.Need(intent is not null && owned is not null && intent.SchemaVersion == 1 && owned.SchemaVersion == 1 &&
                            intent.ExperimentId == plan.ExperimentId && owned.ExperimentId == plan.ExperimentId &&
                            intent.Label == label && owned.Label == label && intent.Name == KeyOperations.Name(plan, label) &&
                            owned.Name == intent.Name && Program.Hex(owned.PublicSha256, 64), "OWNERSHIP_CHAIN_REFUSED"); break;
                    case "read-public-control": control = Program.Parse<PublicControl>(SecureFiles.Read("shared/public-control.json", plan.GuardianSid, plan.AppSid, plan)); break;
                    case "validate-public-control":
                        Program.Need(control is not null && control.SchemaVersion == 1 && control.ExperimentId == plan.ExperimentId &&
                            control.Keys.Length == 2 && control.Keys.Select(k => k.Label).SequenceEqual(KeyOperations.Labels) &&
                            control.Keys.Single(k => k.Label == label) == owned, "PUBLIC_CONTROL_REFUSED"); break;
                    case "open-key": key = KeyOperations.Open(plan, label); break;
                    case "verify-policy-public-identity": KeyOperations.Verify(key!, plan, label, owned!.PublicSha256); break;
                    case "private-export-generic":
                    case "private-export-pkcs8":
                    case "private-export-opaque": ExportProbe.Check(step, key!.Export); break;
                    case "seal-roundtrip-memory":
                        var fixture = KeyOperations.Seal(key!, plan, owned!.PublicSha256);
                        CryptographicOperations.ZeroMemory(fixture.Envelope); break;
                    default: throw new InvalidDataException("STEP_REFUSED");
                }
            });
        } finally { key?.Dispose(); }
    }
    internal static int SelfTest()
    {
        int count = 0;
        void Check(bool ok) { if (!ok) throw new InvalidDataException("DIAGNOSTIC_TEST_FAILED"); count++; }
        var visited = new List<string>(); var rows = Sequence(visited.Add);
        Check(visited.SequenceEqual(Steps)); Check(rows.Length == 11 && rows.All(r => r.Status == "PASS" && r.Failure is null));
        foreach (string failureStep in Steps) {
            visited.Clear(); rows = Sequence(step => { visited.Add(step); if (step == failureStep) throw new AggregateException(new CryptographicException(unchecked((int)0x80090016))); });
            Check(visited.SequenceEqual(Steps.Take(Array.IndexOf(Steps, failureStep) + 1)));
            Check(rows[^1].Step == failureStep && rows[^1].Status == "UNKNOWN");
            Check(rows[^1].Failure == new Failure("CRYPTOGRAPHIC", unchecked((int)0x80090016), unchecked((int)0x80090016), 1));
            Check(rows.Take(rows.Length - 1).All(r => r.Status == "PASS"));
        }
        // An unsupported prerequisite is still terminal; independent observation
        // starts only after all seven prerequisite checks have passed.
        foreach (string failureStep in Steps.Take(7)) {
            visited.Clear(); rows = Sequence(step => { visited.Add(step); if (step == failureStep) throw new CryptographicException(unchecked((int)0x80090029)); });
            int length = Array.IndexOf(Steps, failureStep) + 1;
            Check(visited.SequenceEqual(Steps.Take(length)));
            Check(rows.Length == length && rows[^1].Status == "UNKNOWN" &&
                rows[^1].Failure == new Failure("CRYPTOGRAPHIC", unchecked((int)0x80090029), unchecked((int)0x80090029), 0) &&
                rows.Take(length - 1).All(row => row.Status == "PASS" && row.Failure is null));
        }
        foreach (Exception error in new Exception[] { new UnauthorizedAccessException("SECRET_CANARY"), new InvalidDataException("SECRET_CANARY"), new IOException("SECRET_CANARY"), new Exception("SECRET_CANARY") }) {
            var failure = Describe(new AggregateException(new AggregateException(error)));
            Check(failure.WrapperDepth == 2 && failure.HResult == error.HResult && failure.NativeStatus is null);
            Check(!JsonSerializer.Serialize(failure).Contains("SECRET_CANARY"));
        }
        var multiple = Describe(new AggregateException(new Exception("SECRET_CANARY"), new CryptographicException(5)));
        Check(multiple.Kind == "AGGREGATE_UNRESOLVED" && multiple.NativeStatus is null);
        Exception deep = new CryptographicException(5);
        for (int i = 0; i < 20; i++) deep = new AggregateException(deep);
        Check(Describe(deep).WrapperDepth == 8 && Describe(deep).Kind == "AGGREGATE_UNRESOLVED");
        Check(!Program.TestCapable);
        Check(NativeDiagnostic.Root == "C:\\ProgramData\\Ecs.Lic008.GuardianSealDiagnosticV3");
        return count;
    }
    public static int Main(string[] args)
    {
        if(args.Length>0 && args[0].StartsWith("--prepare-diagnostic-input",StringComparison.Ordinal)) {
            try {
                // Inert/malformed requests fail before file or native context reads.
                Program.Need(PhysicalEnabled && args.Length==3 && args[0]=="--prepare-diagnostic-input" &&
                    Program.Hex(args[2],64),"DIAGNOSTIC_INPUT_REFUSED");
                byte[] bytes=SecureFiles.ReadExternal(args[1],32768);
                Program.Need(Program.Hash(bytes)==args[2],"PREPARATION_PACKAGE_REFUSED");
                var manifest=Program.Parse<DeploymentManifest>(bytes);
                Program.Need(bytes.SequenceEqual(Program.Serialize(manifest)) &&
                    WindowsIdentity.GetCurrent().User!.Value==Deployment.Owner,"PREPARATION_OWNER_REFUSED");
                string source=Path.Combine(Path.GetDirectoryName(Path.GetFullPath(args[1]))!,"package");
                Program.Need(Path.GetFullPath(Environment.ProcessPath!)==Path.Combine(source,"GuardianSealDiagnostic.exe") &&
                    Path.GetFullPath(typeof(Diagnostic).Assembly.Location)==Path.Combine(source,"GuardianSealDiagnostic.dll"),
                    "PREPARATION_PACKAGE_PATH_REFUSED");
                var now=DateTimeOffset.UtcNow;
                var approval=new DiagnosticApproval(4,Deployment.ApprovalScope,Deployment.Owner,NativeDiagnostic.Experiment,
                    NativeDiagnostic.PlanHash,args[2],NativeDiagnostic.Root,NativeDiagnostic.ReportSchemaVersion,
                    NativeTokens.BootIdentity(),Guid.NewGuid().ToString("N"),now,now.AddHours(4));
                Deployment.Validate(manifest,approval,args[2],now);
                foreach(var file in manifest.Files) {
                    byte[] data=SecureFiles.ReadExternal(Path.Combine(source,file.Name),33554432);
                    Program.Need(data.Length==file.Size && Program.Hash(data)==file.Sha256,"PREPARATION_FILE_REFUSED");
                }
                RuntimeCustody.VerifyControllerEnvironment();RuntimeCustody.VerifyServiceEnvironment();
                RuntimeCustody.Verify(SecureFiles.ReadExternal(Path.Combine(source,"runtime-inventory.json"),2097152));
                Console.WriteLine(Encoding.UTF8.GetString(Program.Serialize(approval)));return 0;
            } catch {
                Console.Error.WriteLine("DIAGNOSTIC_INPUT_REFUSED");return 2;
            }
        }
        if(args.SequenceEqual(new[]{"--diagnostic-context"})) {
            Console.WriteLine(JsonSerializer.Serialize(new {scope="TEST_ONLY_DIAGNOSTIC_CONTEXT",ownerSid=WindowsIdentity.GetCurrent().User!.Value,bootIdentity=NativeTokens.BootIdentity(),utc=DateTimeOffset.UtcNow,physicalExecuted=false}));return 0;
        }
        if(args.SequenceEqual(new[]{"--verify-local-runtime"})) {
            byte[] bytes=SecureFiles.ReadExternal(Path.Combine(AppContext.BaseDirectory,"runtime-inventory.json"),2097152);
            RuntimeCustody.Verify(bytes);
            Console.WriteLine(JsonSerializer.Serialize(new{scope="TEST_ONLY_RUNTIME_CUSTODY_READONLY",inventorySha256=Program.Hash(bytes),physicalExecutionEnabled=PhysicalEnabled,physicalStageExecuted=false}));return 0;
        }
        if (!args.SequenceEqual(new[] { "--self-test" })) {
            try {
                Program.Need(PhysicalEnabled,"DIAGNOSTIC_ENTRY_CLOSED");
                if(args.Length==5 && args[0]=="--diagnostic-controller") {
                    Program.Need(Program.Hex(args[3],64) && Program.Hex(args[4],64),"DIAGNOSTIC_PINS_REFUSED");
                    var manifest=SecureFiles.ReadExternal(args[1],32768);var approval=SecureFiles.ReadExternal(args[2],32768);
                    Program.Need(Program.Hash(manifest)==args[4],"DIAGNOSTIC_PACKAGE_HASH_REFUSED");
                    var deployment=Deployment.Confirm(Path.Combine(Path.GetDirectoryName(Path.GetFullPath(args[1]))!,"package"),manifest,approval,args[3]);
                    bool complete=deployment.Run();
                    Console.WriteLine(complete?"DIAGNOSTIC_COMPLETE_RESTORED":"DIAGNOSTIC_UNKNOWN_RESTORED");
                    Console.WriteLine(Path.Combine(NativeDiagnostic.Root,"reports","result.json"));return complete?0:3;
                }
                if(args.Length==5 && args[0]=="--diagnostic-service") {
                    var pins=Launcher.ParseServiceArguments(args);
                    Deployment.RunService(pins.ApprovalSha256,pins.PackageSha256);return 0;
                }
            } catch { /* No arbitrary exception or sensitive data on stdout. */ }
            Console.Error.WriteLine("DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED"); return 2;
        }
        Console.WriteLine(JsonSerializer.Serialize(new {
            scope = "TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_PURE_V1", cases = SelfTest() + ExportProbe.SelfTest() + Launcher.SelfTest() + NativeDiagnostic.SelfTest() + WindowsLauncher.SelfTest() + Deployment.SelfTest() + RuntimeCustody.SelfTest(),
            physicalExecutionEnabled = PhysicalEnabled, physicalTested = false,
            securityAccepted = false, productionAccepted = false
        }));
        return 0;
    }
}
