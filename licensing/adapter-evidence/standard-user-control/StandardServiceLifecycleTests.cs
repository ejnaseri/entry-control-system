using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EntryControl.TestOnly.StandardUserControl;

// Pure scripted adapters only. No SCM, service host, native process, token,
// logon, account or persisted-key API is called by this test suite.
internal static class StandardServiceLifecycleTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 4, 1, 0, 0, TimeSpan.Zero);
    private static string H(int n) => n.ToString("x").PadLeft(64, '0');
    private static StandardToken Owner() => new(StandardContract.OwnerSid, StandardContract.OwnerSid, 1, 1, 2,
        "S-1-16-12288", false, false, true, new[] {
            new StandardGroup(StandardContract.Administrators, 7), new StandardGroup(StandardContract.Interactive, 7) });
    private static StandardToken Worker(StandardCryptoStage stage) => stage == StandardCryptoStage.Setup ?
        new(StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] {
                new StandardGroup(StandardCryptoComparison.SetupSid, 7), new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) }) :
        new(StandardCryptoComparison.GuardianSid, StandardCryptoComparison.GuardianSid, 1, 1, 1,
            StandardCryptoComparison.SystemIntegritySid, false, false, true, new[] { new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) });
    private static StandardServiceContext Context() => new(new(StandardCryptoComparison.Schema, StandardContract.Root,
        "e819380f758e4888beea8534677ae6ff", Start, Start.AddHours(2), StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256, StandardContract.OwnerSid,
        H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8)), H(9), StandardInputCodec.Effects);
    private static StandardServiceRunContext Run(StandardServiceContext c, StandardCryptoStage stage) {
        StandardChannelKeyPin Key(StandardCryptoArm arm, int n) => new(arm, StandardCryptoComparison.KeyName(c.Scope.Attempt, arm),
            H(n), H(n + 2), H(n + 4), StandardSyntheticEnvelopeCodec.PlaintextHash);
        return new(c, stage, ((int)stage + 100).ToString("x").PadLeft(32, '0'), H(50 + (int)stage),
            stage == StandardCryptoStage.Setup ? null : H(60 + (int)stage), stage == StandardCryptoStage.Setup ? null :
            new(Key(StandardCryptoArm.Restricted, 20), Key(StandardCryptoArm.UserAccessible, 21)));
    }
    private sealed class Clock : IStandardChannelClock {
        internal DateTimeOffset Now = Start.AddSeconds(5); internal long Mono = 100;
        public DateTimeOffset UtcNow => Now;
        public long MonotonicMilliseconds => Mono;
        internal void Advance(long ms) { Mono += ms; Now = Now.AddMilliseconds(ms); }
    }
    private sealed class Held : IStandardCreatedServiceHandle {
        internal readonly StandardServiceHandleSlot Slot; internal int Disposals;
        internal Held(StandardServiceHandleSlot slot) { Slot = slot; }
        public void Dispose() { Disposals++; }
    }
    private sealed class ProcessLease : IStandardChannelProcessLease {
        internal readonly World World; internal readonly uint Pid; internal readonly long Creation;
        internal StandardCryptoStage Stage; internal bool Exited; internal uint Code;
        internal Func<StandardChannelProcessObservation, StandardChannelProcessObservation> Change = value => value;
        internal ProcessLease(World w, uint pid, StandardCryptoStage stage) { World = w; Pid = pid; Stage = stage; Creation = w.Clock.Now.UtcDateTime.ToFileTimeUtc(); }
        public uint ProcessId => Pid;
        public long CreationFileTimeUtc => Creation;
        public uint Wait(uint ms) { World.Hit("Process.Wait"); return Exited ? 0u : 258u; }
        public uint ExitCode() { World.Hit("Process.ExitCode"); return Code; }
        public StandardChannelProcessObservation Capture() {
            World.Hit("Process.Capture"); var scope = World.Context.Scope;
            return Change(new(new(Pid, Creation, StandardLaunchPlan.Image, Worker(Stage)), StandardLaunchPlan.Assembly,
                scope.ImageSha256, scope.AssemblySha256, scope.RuntimeSha256, scope.PackageSha256));
        }
    }
    private sealed class World : IStandardServiceApi, IStandardServiceJournalSink, IStandardServiceGuard {
        internal readonly StandardServiceContext Context;
        internal readonly Clock Clock = new();
        internal readonly List<string> Events = new();
        internal readonly Dictionary<StandardServiceRole, Held> Handles = new();
        internal readonly Dictionary<StandardServiceRole, StandardServiceSnapshot> Snapshots = new();
        internal readonly Dictionary<StandardServiceJournalFile, byte[]> Stored = new();
        internal readonly List<ProcessLease> Processes = new();
        internal readonly StandardServiceLifecycle Lifecycle;
        internal StandardToken OwnerToken = Owner();
        internal int FailAt = -1, Creates, Configures, Demands, Starts, Opens;
        internal int ProbeResult = 1060; internal bool UserPredecessor, Pending, StopImmediately, MissingOpener;
        internal long WaitAdvance = 25; internal ulong Index;
        internal Action<string>? At;
        internal Func<string, Exception?>? Fault;
        internal Func<StandardServiceJournalReceipt, StandardServiceJournalReceipt> ReceiptChange = value => value;
        internal Func<StandardServiceJournalFile, byte[], byte[]> ReadChange = (_, value) => value;
        internal Func<StandardServiceSnapshot, StandardServiceSnapshot> SnapshotChange = value => value;
        internal Func<ProcessLease, ProcessLease> ProcessChange = value => value;
        internal World(StandardServiceContext? context = null) {
            Context = context ?? StandardServiceLifecycleTests.Context();
            Lifecycle = new(Context, this, this, this, Clock, _ => { Hit("Wait"); Clock.Advance(WaitAdvance); });
        }
        internal void Hit(string name) {
            Events.Add(name); Clock.Advance(1); At?.Invoke(name);
            if (Events.Count - 1 == FailAt) throw new IOException("SYNTHETIC_SERVICE_BOUNDARY");
            var error = Fault?.Invoke(name); if (error is not null) throw error;
        }
        private void Held(StandardServiceHandleSlot slot) {
            StandardContract.Need(Handles.TryGetValue(slot.Recipe.Role, out var original) && ReferenceEquals(original, slot.Handle) &&
                ReferenceEquals(original.Slot, slot), "SYNTHETIC_REOPEN_OR_FOREIGN_HANDLE");
        }
        public StandardToken CaptureOwnerAndVerifyCustody(StandardServiceContext context, string stage) {
            Hit("Guard." + stage); StandardContract.Need(context == Context, "SYNTHETIC_CONTEXT"); return OwnerToken;
        }
        public void VerifyBeforeStart(StandardServiceRunContext run) {
            Hit("Guard.BeforeStart"); StandardContract.Need(run.Stage != StandardCryptoStage.GuardianAfter || UserPredecessor,
                "SYNTHETIC_ACTUAL_USER_PREDECESSOR_REQUIRED");
        }
        public void VerifyBeforeComplete(StandardServiceRunContext run) { Hit("Guard.BeforeComplete"); }
        public int ProbeName(StandardServiceContext context, StandardServiceRecipe recipe, Action admission) {
            Hit("Probe." + recipe.Role); admission(); return ProbeResult;
        }
        public void CreateDisabled(StandardServiceHandleSlot slot, Action verify, Action admission) {
            // Holder is attached before a potentially effectful simulated call.
            var handle = new Held(slot); slot.Attach(handle); Handles.Add(slot.Recipe.Role, handle);
            Hit("Create." + slot.Recipe.Role); verify(); admission(); Creates++;
            var descriptor = StandardServiceRules.Descriptor(StandardServiceRules.Descriptor(slot.Recipe.Role), slot.Recipe.Role);
            Snapshots.Add(slot.Recipe.Role, new(slot.Recipe, 16, 4, 1, 0, 0, 0, false, false, 0, descriptor, new(1, 0, 0, 0)));
        }
        public void ConfigureDisabled(StandardServiceHandleSlot slot, Action admission) {
            Held(slot); Hit("Configure." + slot.Recipe.Role); admission(); Configures++;
            Snapshots[slot.Recipe.Role] = Snapshots[slot.Recipe.Role] with { SidType = 1 };
        }
        public void EnableDemandStart(StandardServiceHandleSlot slot, Action admission) {
            Held(slot); Hit("Demand." + slot.Recipe.Role); admission();
            StandardContract.Need(Stored.ContainsKey(StandardServiceJournalFile.SetupOwned) && Stored.ContainsKey(StandardServiceJournalFile.GuardianOwned),
                "SYNTHETIC_BOTH_OWNED_BEFORE_DEMAND"); Demands++; Snapshots[slot.Recipe.Role] = Snapshots[slot.Recipe.Role] with { Start = 3 };
        }
        public StandardServiceSnapshot Inspect(StandardServiceHandleSlot slot, Action admission) {
            Held(slot); Hit("Inspect." + slot.Recipe.Role); admission(); return SnapshotChange(Snapshots[slot.Recipe.Role]);
        }
        public void Start(StandardServiceHandleSlot slot, StandardServiceRunContext run, Action verify, Action admission) {
            Held(slot); Hit("Start." + run.Stage); verify(); admission(); Starts++;
            var process = new ProcessLease(this, (uint)(500 + Processes.Count), run.Stage); Processes.Add(process);
            Snapshots[slot.Recipe.Role] = Snapshots[slot.Recipe.Role] with { Status = StopImmediately ? new(1, 0, 0, 0) : Pending ? new(2, process.Pid, 0, 0) : new(4, process.Pid, 0, 0) };
        }
        public StandardServiceStatus Status(StandardServiceHandleSlot slot, Action admission) {
            Held(slot); Hit("Status." + slot.Recipe.Role); admission(); return Snapshots[slot.Recipe.Role].Status;
        }
        public IStandardChannelProcessLease OpenRunning(StandardServiceHandleSlot slot, uint pid, long earliest, long latest, Action admission) {
            Held(slot); Hit("Open." + slot.Recipe.Role); admission(); Opens++;
            if (MissingOpener) throw new NotSupportedException("SYNTHETIC_NATIVE_OPENER_NOT_IMPLEMENTED");
            return ProcessChange(Processes.Single(p => p.Pid == pid));
        }
        public StandardServiceJournalReceipt WriteNew(StandardServiceJournalFile file, byte[] original) {
            Hit("Write." + file); StandardContract.Need(!Stored.ContainsKey(file), "SYNTHETIC_CREATE_NEW");
            Stored.Add(file, (byte[])original.Clone()); var record = JsonSerializer.Deserialize<StandardServiceJournalRecord>(original)!;
            return ReceiptChange(new(Context, file, StandardNativeCryptoRules.Hash(original), original.Length, Clock.Now,
                11, ++Index, record.WrittenUtc.UtcDateTime.ToFileTimeUtc(), true, true, true, true));
        }
        public byte[] Read(StandardServiceJournalFile file) { Hit("Read." + file); return ReadChange(file, (byte[])Stored[file].Clone()); }
        internal StandardServiceResult Register() => Lifecycle.RegisterPair();
        internal StandardServiceResult Admit(StandardCryptoStage stage) => Lifecycle.StartAndAdmit(Run(Context, stage));
        internal StandardServiceResult Complete(StandardCryptoStage stage) {
            var process = Processes.Single(p => p.Stage == stage); process.Exited = true;
            var role = StandardServiceRules.Role(stage); Snapshots[role] = Snapshots[role] with { Status = new(1, 0, 0, 0) };
            return Lifecycle.CompleteRun(stage);
        }
    }
    private sealed class Host : IStandardServiceHostBackend, IStandardServiceHostWork {
        internal readonly List<string> Events = new(); internal readonly List<(uint State, uint Accepted, uint Win32, uint Specific)> Statuses = new();
        internal Func<string, Exception?>? Fault;
        private void Hit(string name) { Events.Add(name); var error = Fault?.Invoke(name); if (error is not null) throw error; }
        public void RegisterHandler() => Hit("REGISTER");
        public void Status(uint state, uint accepted, uint win32, uint specific) { Hit("STATUS_" + state); Statuses.Add((state, accepted, win32, specific)); }
        public void VerifySelfAndArguments() => Hit("VERIFY");
        public void ReadOnlyBootstrap() => Hit("BOOTSTRAP_READONLY");
        public void RunGrantedChannel() => Hit("CHANNEL");
        public void JoinAllNativeAndTransport() => Hit("JOIN");
    }
    internal static int Run() {
        int count = 0;
        void Check(bool condition, string name) { count++; if (!condition) throw new InvalidDataException("STANDARD_SERVICE_TEST_" + name); }
        void Refuse(Action action, string name) { bool refused = false; try { action(); } catch (Exception e) when (e is InvalidDataException or ArgumentException) { refused = true; } Check(refused, name); }
        void Retained(StandardServiceResult result, string name) {
            Check(result.Outcome == "RETAINED_PARTIAL_OR_UNKNOWN" && result.Failure is not null, name + "_OUTCOME");
            Check(!result.StartupCodeAssociationEstablished && !result.GrantIssued && !result.NativeExecutionProven &&
                !result.SecurityAccepted && !result.ProductionAccepted && !result.Lic008Closed, name + "_NO_AUTHORITY");
        }
        void Register(World w) { var result = w.Register(); Check(result.Failure is null && result.Originals.Count == 6, "REGISTER"); }
        void AdmitComplete(World w, StandardCryptoStage stage) {
            var admitted = w.Admit(stage); Check(admitted.Outcome == "RUNNING_HELD_TOKEN_OBSERVED_AWAITING_BOOTSTRAP" && admitted.Failure is null &&
                admitted.RetainedProcess is not null && !admitted.StartupCodeAssociationEstablished && !admitted.GrantIssued, "ADMIT_" + stage);
            var completed = w.Complete(stage); Check(completed.Outcome == "SERVICE_REPORT_AND_HELD_EXIT_ADMITTED" && completed.Failure is null, "COMPLETE_" + stage);
        }

        var happy = new World(); Register(happy);
        Check(happy.Creates == 2 && happy.Configures == 2 && happy.Demands == 2 && happy.Starts == 0 && happy.Opens == 0, "REGISTER_COUNTS");
        Check(happy.Handles.Values.All(h => h.Disposals == 0), "ORIGINAL_HANDLES_RETAINED");
        var originals = happy.Register().Originals; // Sequential re-entry cannot create/adopt anything.
        Check(originals.Count == 6 && happy.Creates == 2, "REGISTER_CONSUMED");
        Check(happy.Events.IndexOf("Write.GuardianOwned") < happy.Events.IndexOf("Demand.Setup"), "BOTH_OWNED_BEFORE_ANY_DEMAND");
        Check(happy.Events.IndexOf("Write.GuardianComplete") > happy.Events.IndexOf("Write.SetupComplete"), "COMPLETE_PAIR_CHAIN");
        foreach (var original in originals) {
            Check(original.Sha256 == StandardNativeCryptoRules.Hash(happy.Stored[original.File]), "ORIGINAL_EXACT_HASH");
            Check(original.Record.Context == happy.Context && original.Record.Schema == StandardServiceRules.Schema, "ORIGINAL_SCOPE");
            if (original.Record.Kind != "INTENT") Check(original.Record.PreviousSha256 is not null, "CHAIN_PREVIOUS");
            if (original.Record.Kind == "OWNED") Check(original.Record.Snapshot!.Start == 4, "OWNED_DISABLED");
            if (original.Record.Kind == "COMPLETE") Check(original.Record.OtherOwnedSha256 is not null && original.Record.Snapshot!.Start == 3, "COMPLETE_BOTH_OWNED");
        }
        AdmitComplete(happy, StandardCryptoStage.Setup); AdmitComplete(happy, StandardCryptoStage.GuardianBefore);
        happy.UserPredecessor = true; AdmitComplete(happy, StandardCryptoStage.GuardianAfter);
        Check(happy.Starts == 3 && happy.Opens == 3 && happy.Processes.Select(p => p.Pid).Distinct().Count() == 3, "THREE_DISTINCT_RUNS_SAME_REGISTRATIONS");
        Check(happy.Stored.Count == 15 && happy.Handles.Count == 2 && happy.Handles.Values.All(h => h.Disposals == 0), "FULL_ORIGINALS_RETAINED");
        Retained(happy.Admit(StandardCryptoStage.Setup), "REPEATED_SETUP");
        Retained(happy.Lifecycle.CompleteRun(StandardCryptoStage.Setup), "REPEATED_COMPLETE");
        Check(happy.Starts == 3, "NO_START_RETRY");

        foreach (var role in Enum.GetValues<StandardServiceRole>()) {
            var recipe = StandardServiceRules.Recipe(happy.Context, role); byte[] descriptor = StandardServiceRules.Descriptor(role);
            Check(recipe.Name == (role == StandardServiceRole.Setup ? StandardContract.SetupService : StandardContract.GuardianService), "FIXED_NAME");
            Check(recipe.ServiceSid == StandardCryptoComparison.DerivedServiceSid(recipe.Name), "EXACT_DERIVED_SERVICE_SID");
            Check(recipe.Command.Contains(" exec --fx-version 10.0.11 ", StringComparison.Ordinal) && recipe.Command.Contains(happy.Context.SourceSetSha256, StringComparison.Ordinal), "FIXED_COMMAND");
            Check(recipe.Account == (role == StandardServiceRole.Setup ? "LocalSystem" : "NT SERVICE\\" + recipe.Name), "FIXED_ACCOUNT");
            Check(StandardNativeCryptoRules.Hex(StandardServiceRules.Descriptor(descriptor, role), 64), "EXACT_SD");
            foreach (string sddl in new[] { "O:BAG:BAD:(A;;FA;;;SY)(A;;FA;;;BA)", "O:SYG:SYD:P(A;;0x000f01ff;;;SY)(A;;0x000f01ff;;;BA)",
                "O:BAG:BAD:P(A;;0x000f01ff;;;SY)(A;;0x000f01ff;;;BA)(A;;GA;;;WD)", "O:BAG:BAD:P(A;;0x000f01ff;;;SY)(A;;0x000f01fe;;;BA)" }) {
                var raw = new RawSecurityDescriptor(sddl); var invalid = new byte[raw.BinaryLength]; raw.GetBinaryForm(invalid, 0);
                Refuse(() => StandardServiceRules.Descriptor(invalid, role), "SD_DRIFT");
            }
            Refuse(() => StandardServiceRules.Descriptor(descriptor.Concat(new byte[] { 0 }).ToArray(), role), "SD_TRAILING");
            Refuse(() => StandardServiceRules.Descriptor(new byte[19], role), "SD_SHORT");
            Refuse(() => StandardServiceRules.Descriptor(new byte[65537], role), "SD_LONG");
            var valid = happy.Snapshots[role] with { Status = new(1, 0, 0, 0) };
            foreach (var changed in new[] { valid with { Type = 32 }, valid with { Start = 2 }, valid with { Error = 0 }, valid with { SidType = 0 },
                valid with { Triggers = 1 }, valid with { FailureActions = 1 }, valid with { FailureOnNonCrash = true },
                valid with { DelayedAutoStart = true }, valid with { LaunchProtected = 1 }, valid with { DescriptorSha256 = "A".PadLeft(64, '0') },
                valid with { Recipe = valid.Recipe with { Account = "Administrator" } }, valid with { Recipe = valid.Recipe with { Command = valid.Recipe.Command + " " } },
                valid with { Status = new(1, 99, 0, 0) }, valid with { Status = new(4, 0, 0, 0) } })
                Refuse(() => StandardServiceRules.Snapshot(happy.Context, role, changed, 3, true), "SNAPSHOT_DRIFT");
        }
        Refuse(() => StandardServiceRules.Role(StandardCryptoStage.StandardUser), "USER_NOT_SERVICE");
        Refuse(() => StandardServiceRules.Recipe(happy.Context, (StandardServiceRole)999), "UNKNOWN_ROLE");
        Refuse(() => StandardServiceRules.File(StandardServiceRole.Guardian, "START", StandardCryptoStage.Setup), "CROSS_ROLE_JOURNAL");
        foreach (var stage in new[] { StandardCryptoStage.Setup, StandardCryptoStage.GuardianBefore, StandardCryptoStage.GuardianAfter }) {
            var run = Run(happy.Context, stage); var role = StandardServiceRules.Role(stage); var recipe = StandardServiceRules.Recipe(happy.Context, role);
            string[] args = { recipe.Name, StandardWorkerChannelRules.StageName(stage), run.RunId, happy.Context.Scope.Attempt };
            Check(StandardServiceRules.Invocation(happy.Context, role, args).Stage == stage, "EXACT_SERVICE_MAIN_ARGS");
            for (int i = 0; i < args.Length; i++) { var changed = (string[])args.Clone(); changed[i] += "x";
                Refuse(() => StandardServiceRules.Invocation(happy.Context, role, changed), "SERVICE_MAIN_ARG_DRIFT"); }
            Refuse(() => StandardServiceRules.Invocation(happy.Context, role, args.Concat(new[] { "extra" }).ToArray()), "SERVICE_MAIN_EXTRA");
        }
        var setupRun = Run(happy.Context, StandardCryptoStage.Setup);
        foreach (var invalid in new[] { setupRun with { RunId = "ABC" }, setupRun with { Nonce64 = H(1).ToUpperInvariant() + "0" },
            setupRun with { Context = happy.Context with { SourceSetSha256 = H(500) } }, setupRun with { PredecessorReportSha256 = H(100) },
            setupRun with { Keys = Run(happy.Context, StandardCryptoStage.GuardianBefore).Keys }, setupRun with { Stage = StandardCryptoStage.StandardUser } })
            Refuse(() => StandardServiceRules.Run(invalid, happy.Context), "RUN_BINDING");
        var guardianRun = Run(happy.Context, StandardCryptoStage.GuardianBefore);
        foreach (var invalid in new[] { guardianRun with { Keys = null }, guardianRun with { PredecessorReportSha256 = null },
            guardianRun with { Keys = guardianRun.Keys! with { Accessible = guardianRun.Keys.Restricted } },
            guardianRun with { Keys = guardianRun.Keys! with { Restricted = guardianRun.Keys.Restricted with { Name = "historical" } } },
            guardianRun with { Keys = guardianRun.Keys! with { Restricted = guardianRun.Keys.Restricted with { PlaintextSha256 = H(500) } } } })
            Refuse(() => StandardServiceRules.Run(invalid, happy.Context), "GUARDIAN_BINDING");
        foreach (int probe in new[] { 0, 5, 1072, 1073, 1078, -1 }) {
            var w = new World { ProbeResult = probe }; Retained(w.Register(), "ABSENCE_UNPROVEN");
            Check(w.Creates == 0 && w.Stored.Count == 0 && w.Handles.Count == 0, "NO_COLLISION_ADOPTION");
        }
        foreach (var bad in new[] { Context() with { SourceSetSha256 = "A".PadLeft(64, '0') }, Context() with { Effects = "only_services" },
            Context() with { Scope = Context().Scope with { OwnerSid = StandardContract.UserSid } },
            Context() with { Scope = Context().Scope with { ExpiresUtc = Start.AddSeconds(1) } } }) {
            var w = new World(bad); Retained(w.Register(), "CONTEXT"); Check(w.Creates == 0 && w.Stored.Count == 0, "NO_CONTEXT_EFFECT");
        }
        var badOwner = new World { OwnerToken = Owner() with { User = StandardContract.UserSid } };
        Retained(badOwner.Register(), "OWNER_IDENTITY"); Check(badOwner.Creates == 0, "NO_WRONG_OWNER_EFFECT");
        var receiptChanges = new Func<StandardServiceJournalReceipt, StandardServiceJournalReceipt>[] {
            r => r with { Context = r.Context with { SourceSetSha256 = H(555) } }, r => r with { File = StandardServiceJournalFile.GuardianOwned },
            r => r with { Sha256 = H(555) }, r => r with { Length = r.Length - 1 }, r => r with { WrittenUtc = r.WrittenUtc.AddHours(1) },
            r => r with { VolumeSerial = 0 }, r => r with { FileIndex = 0 }, r => r with { CreationFileTimeUtc = 0 },
            r => r with { CreateNew = false }, r => r with { Protected = false }, r => r with { DurablyFlushed = false }, r => r with { ExactReadback = false }
        };
        foreach (var change in receiptChanges) {
            var w = new World { ReceiptChange = change }; Retained(w.Register(), "BAD_INTENT_RECEIPT");
            Check(w.Creates == 0 && w.Stored.Count == 1 && w.Handles.Count == 0, "NO_CREATE_BEFORE_VALID_INTENT");
        }
        var corrupt = new World { ReadChange = (_, bytes) => bytes.Concat(new byte[] { 32 }).ToArray() };
        Retained(corrupt.Register(), "ORIGINAL_CORRUPTION"); Check(corrupt.Creates == 0, "ORIGINAL_BEFORE_CREATE");
        var reusedFile = new World { ReceiptChange = r => r with { FileIndex = 1 } };
        Retained(reusedFile.Register(), "FILE_ID_REUSE"); Check(reusedFile.Creates == 1 && reusedFile.Demands == 0, "REUSED_FILE_NO_ENABLE");

        // Throw at every adapter/guard boundary of a complete successful
        // registration. Each interrupted attempt remains single-use and keeps
        // all original holders without repair/adoption/disposal.
        var trace = new World(); Register(trace); int registrationBoundaries = trace.Events.Count;
        for (int i = 0; i < registrationBoundaries; i++) {
            var w = new World { FailAt = i }; var failed = w.Register(); Retained(failed, "REGISTER_BOUNDARY_" + i);
            Check(w.Handles.Values.All(h => h.Disposals == 0) && w.Creates <= 2 && w.Starts == 0, "REGISTER_RETAINS_" + i);
            int creates = w.Creates, demands = w.Demands; w.FailAt = -1; Retained(w.Register(), "REGISTER_SINGLE_USE_" + i);
            Check(w.Creates == creates && w.Demands == demands, "REGISTER_NO_RETRY_" + i);
        }
        foreach (string point in new[] { "Create.Setup", "Configure.Guardian", "Demand.Setup", "Inspect.Guardian", "Write.GuardianComplete" }) {
            var error = new StandardServiceNativeException("SyntheticSCM", 1072); var w = new World { Fault = name => name == point ? error : null };
            var failed = w.Register(); Retained(failed, "RAW_NATIVE_FAILURE");
            Check(failed.Failure!.Category == "WIN32" && failed.Failure.Win32Error == 1072 && failed.Failure.ManagedHResult == error.HResult &&
                failed.Failure.NativeApi == "SyntheticSCM", "NATIVE_RAW_IDENTITY");
        }
        // Coordinate a second caller while the first owns the admission gate.
        using (var entered = new ManualResetEventSlim()) using (var release = new ManualResetEventSlim()) {
            var w = new World(); int blocked = 0;
            w.At = name => { if (name == "Probe.Setup" && Interlocked.Exchange(ref blocked, 1) == 0) { entered.Set(); if (!release.Wait(5000)) throw new TimeoutException("SYNTHETIC_BARRIER"); } };
            var task = Task.Run(w.Register); Check(entered.Wait(5000), "CONCURRENT_FIRST_ENTERED");
            try { Refuse(() => w.Register(), "CONCURRENT_SECOND_REFUSED"); } finally { release.Set(); }
            Check(task.Wait(5000) && task.Result.Failure is null && w.Creates == 2, "CONCURRENT_ONE_REGISTRATION");
        }

        var order = new World(); Register(order); Retained(order.Admit(StandardCryptoStage.GuardianBefore), "SETUP_FIRST"); Check(order.Starts == 0, "NO_OUT_OF_ORDER_START");
        var after = new World(); Register(after); AdmitComplete(after, StandardCryptoStage.Setup); AdmitComplete(after, StandardCryptoStage.GuardianBefore);
        Retained(after.Admit(StandardCryptoStage.GuardianAfter), "ACTUAL_USER_PREDECESSOR_REQUIRED"); Check(after.Starts == 2, "USER_GUARD_BEFORE_START");
        foreach (bool duplicateNonce in new[] { false, true }) {
            var w = new World(); Register(w); AdmitComplete(w, StandardCryptoStage.Setup);
            var next = Run(w.Context, StandardCryptoStage.GuardianBefore); var previous = Run(w.Context, StandardCryptoStage.Setup);
            next = duplicateNonce ? next with { Nonce64 = previous.Nonce64 } : next with { RunId = previous.RunId };
            Retained(w.Lifecycle.StartAndAdmit(next), "RUN_NONCE_MUST_BE_DISTINCT"); Check(w.Starts == 1, "REUSE_NO_SECOND_START");
        }
        var utcRollback = new World(); bool rolledBack = false;
        utcRollback.At = name => { if (!rolledBack && name == "Guard.NAME_PROBE") { rolledBack = true; utcRollback.Clock.Now = utcRollback.Clock.Now.AddSeconds(-1); } };
        Retained(utcRollback.Register(), "UTC_CALLBACK_ROLLBACK"); Check(utcRollback.Creates == 0 && utcRollback.Stored.Count == 0, "UTC_ROLLBACK_NO_EFFECT");
        var custodyError = new UnauthorizedAccessException("SYNTHETIC_OWNER_CUSTODY_FAILURE");
        var custody = new World { Fault = name => name.StartsWith("Guard.", StringComparison.Ordinal) ? custodyError : null };
        var custodyResult = custody.Register(); Retained(custodyResult, "CUSTODY_RAW_FAILURE");
        Check(custodyResult.Failure!.Category == "UNAUTHORIZED_ACCESS" && custodyResult.Failure.ManagedHResult == custodyError.HResult,
            "CUSTODY_CATEGORY_AND_HRESULT_PRESERVED");
        var startTrace = new World(); Register(startTrace); int startOffset = startTrace.Events.Count; Check(startTrace.Admit(StandardCryptoStage.Setup).Failure is null, "START_TRACE");
        int startBoundaries = startTrace.Events.Count - startOffset;
        for (int i = 0; i < startBoundaries; i++) {
            var w = new World(); Register(w); w.FailAt = w.Events.Count + i; var failed = w.Admit(StandardCryptoStage.Setup);
            Retained(failed, "START_BOUNDARY_" + i); Check(w.Starts <= 1 && w.Handles.Values.All(h => h.Disposals == 0), "START_RETAIN_" + i);
            int starts = w.Starts; w.FailAt = -1; Retained(w.Admit(StandardCryptoStage.Setup), "START_NO_RETRY_" + i); Check(w.Starts == starts, "START_ONE_USE_" + i);
        }
        var noOpener = new World { MissingOpener = true }; Register(noOpener); var absentOpener = noOpener.Admit(StandardCryptoStage.Setup);
        Retained(absentOpener, "MISSING_NATIVE_PROCESS_OPENER"); Check(absentOpener.Failure!.Stage == "PROCESS_PIN" && absentOpener.RetainedProcess is null, "NO_FAKE_PROCESS_PROOF");
        var pending = new World { Pending = true, WaitAdvance = 45001 }; Register(pending); Retained(pending.Admit(StandardCryptoStage.Setup), "PENDING_DEADLINE");
        Check(pending.Opens == 0 && pending.Starts == 1, "PENDING_PID_NEVER_ADOPTED");
        var stopped = new World { StopImmediately = true }; Register(stopped); Retained(stopped.Admit(StandardCryptoStage.Setup), "STOPPED_NOT_RUNNING"); Check(stopped.Opens == 0, "NO_STOPPED_PID_ADOPTION");
        var rollback = new World { Pending = true, WaitAdvance = -100 }; Register(rollback); Retained(rollback.Admit(StandardCryptoStage.Setup), "MONOTONIC_ROLLBACK"); Check(rollback.Opens == 0, "NO_ROLLBACK_OPEN");
        var lateRunning = new World(); Register(lateRunning); bool queryAdvanced = false;
        lateRunning.At = name => { if (!queryAdvanced && name == "Status.Setup") { queryAdvanced = true; lateRunning.Clock.Advance(45001); } };
        Retained(lateRunning.Admit(StandardCryptoStage.Setup), "LATE_FINAL_RUNNING_QUERY"); Check(lateRunning.Opens == 0, "RUNNING_RETURN_AFTER_DEADLINE_NOT_ADMITTED");
        var finalAdmissionGate = new World(); Register(finalAdmissionGate); bool admittedRead = false; int admissionTail = 0;
        finalAdmissionGate.At = name => {
            if (name == "Read.SetupAdmitted") admittedRead = true;
            else if (admittedRead && name == "Guard.ADMITTED_WRITE" && ++admissionTail == 2) finalAdmissionGate.Clock.Advance(45001);
        };
        Retained(finalAdmissionGate.Admit(StandardCryptoStage.Setup), "FINAL_ADMISSION_CUSTODY_DEADLINE");
        Check(finalAdmissionGate.Stored.ContainsKey(StandardServiceJournalFile.SetupAdmitted), "LATE_DURABLE_ADMITTED_ORIGINAL_RETAINED_WITHOUT_SUCCESS");
        foreach (var change in new Func<StandardChannelProcessObservation, StandardChannelProcessObservation>[] {
            o => o with { Process = o.Process with { ProcessId = o.Process.ProcessId + 1 } },
            o => o with { Process = o.Process with { CreationFileTimeUtc = o.Process.CreationFileTimeUtc - 1 } },
            o => o with { Process = o.Process with { ImagePath = "elsewhere.exe" } }, o => o with { AssemblyPath = "elsewhere.dll" },
            o => o with { ImageSha256 = H(900) }, o => o with { AssemblySha256 = H(900) }, o => o with { RuntimeSha256 = H(900) }, o => o with { PackageSha256 = H(900) },
            o => o with { Process = o.Process with { Token = Owner() } } }) {
            var w = new World { ProcessChange = p => { p.Change = change; return p; } }; Register(w); var failed = w.Admit(StandardCryptoStage.Setup);
            Retained(failed, "ACTUAL_PROCESS_PIN_DRIFT"); Check(failed.RetainedProcess is not null && !w.Stored.ContainsKey(StandardServiceJournalFile.SetupAdmitted), "ACTUAL_HANDLE_RETAINED_NO_ADMITTED");
        }
        var pidReuse = new World(); Register(pidReuse); int statusQueries = 0;
        pidReuse.At = name => { if (name == "Status.Setup" && ++statusQueries == 2) pidReuse.Snapshots[StandardServiceRole.Setup] = pidReuse.Snapshots[StandardServiceRole.Setup] with { Status = new(4, 9999, 0, 0) }; };
        Retained(pidReuse.Admit(StandardCryptoStage.Setup), "SCM_PID_CHANGED"); Check(pidReuse.Opens == 1, "NO_PID_REOPEN_RETRY");
        var completes = new World(); Register(completes); Check(completes.Admit(StandardCryptoStage.Setup).Failure is null, "COMPLETION_SETUP");
        Retained(completes.Lifecycle.CompleteRun(StandardCryptoStage.Setup), "HELD_EXIT_REQUIRED"); Check(!completes.Stored.ContainsKey(StandardServiceJournalFile.SetupRunComplete), "NO_COMPLETION_FROM_ACK_OR_SCM");
        var badExit = new World(); Register(badExit); Check(badExit.Admit(StandardCryptoStage.Setup).Failure is null, "BAD_EXIT_SETUP"); badExit.Processes[0].Code = 99;
        Retained(badExit.Complete(StandardCryptoStage.Setup), "EXIT_CODE_REQUIRED");
        var noStopped = new World { WaitAdvance = 45001 }; Register(noStopped); Check(noStopped.Admit(StandardCryptoStage.Setup).Failure is null, "NO_STOPPED_SETUP"); noStopped.Processes[0].Exited = true;
        Retained(noStopped.Lifecycle.CompleteRun(StandardCryptoStage.Setup), "SCM_STOPPED_REQUIRED"); Check(!noStopped.Stored.ContainsKey(StandardServiceJournalFile.SetupRunComplete), "EXIT_ALONE_NO_COMPLETION");
        var lateStopped = new World(); Register(lateStopped); Check(lateStopped.Admit(StandardCryptoStage.Setup).Failure is null, "LATE_STOPPED_SETUP"); bool stopAdvanced = false;
        lateStopped.At = name => { if (!stopAdvanced && name == "Status.Setup") { stopAdvanced = true; lateStopped.Clock.Advance(45001); } };
        Retained(lateStopped.Complete(StandardCryptoStage.Setup), "LATE_FINAL_STOPPED_QUERY");
        Check(!lateStopped.Stored.ContainsKey(StandardServiceJournalFile.SetupRunComplete), "STOPPED_RETURN_AFTER_DEADLINE_NOT_COMPLETE");
        var exitDrift = new World(); Register(exitDrift); Check(exitDrift.Admit(StandardCryptoStage.Setup).Failure is null, "EXIT_DRIFT_SETUP");
        exitDrift.SnapshotChange = value => value with { Status = value.Status with { Win32Exit = 5 } };
        Retained(exitDrift.Complete(StandardCryptoStage.Setup), "FINAL_INSPECTED_EXIT_DRIFT");
        Check(!exitDrift.Stored.ContainsKey(StandardServiceJournalFile.SetupRunComplete), "NO_COMPLETION_WITH_FINAL_EXIT_DRIFT");
        var finalCompleteGate = new World(); Register(finalCompleteGate); Check(finalCompleteGate.Admit(StandardCryptoStage.Setup).Failure is null, "FINAL_COMPLETE_GATE_SETUP");
        bool completedRead = false; int completionTail = 0;
        finalCompleteGate.At = name => {
            if (name == "Read.SetupRunComplete") completedRead = true;
            else if (completedRead && name == "Guard.RUN_COMPLETE_WRITE" && ++completionTail == 2) finalCompleteGate.Clock.Advance(45001);
        };
        Retained(finalCompleteGate.Complete(StandardCryptoStage.Setup), "FINAL_COMPLETION_CUSTODY_DEADLINE");
        Check(finalCompleteGate.Stored.ContainsKey(StandardServiceJournalFile.SetupRunComplete), "LATE_DURABLE_COMPLETION_ORIGINAL_RETAINED_WITHOUT_SUCCESS");
        var completeTrace = new World(); Register(completeTrace); Check(completeTrace.Admit(StandardCryptoStage.Setup).Failure is null, "COMPLETE_TRACE_ADMIT");
        int completeOffset = completeTrace.Events.Count; Check(completeTrace.Complete(StandardCryptoStage.Setup).Failure is null, "COMPLETE_TRACE");
        int completeBoundaries = completeTrace.Events.Count - completeOffset;
        for (int i = 0; i < completeBoundaries; i++) {
            var w = new World(); Register(w); Check(w.Admit(StandardCryptoStage.Setup).Failure is null, "COMPLETE_BOUNDARY_ADMIT");
            w.FailAt = w.Events.Count + i; Retained(w.Complete(StandardCryptoStage.Setup), "COMPLETE_BOUNDARY_" + i);
            Check(w.Starts == 1 && w.Handles.Values.All(h => h.Disposals == 0), "COMPLETE_BOUNDARY_RETAIN");
            w.FailAt = -1; int stored = w.Stored.Count; Retained(w.Complete(StandardCryptoStage.Setup), "COMPLETE_BOUNDARY_NO_RETRY");
            Check(w.Stored.Count == stored, "NO_COMPLETION_RETRY_WRITE");
        }
        var host = new Host(); var hosted = StandardServiceHostProtocol.Run(host, host);
        Check(hosted.RunningPublished && hosted.BootstrapEntered && hosted.ChannelEntered && hosted.JoinReturned && hosted.StoppedPublished && hosted.FailureStage is null, "HOST_SEQUENCE_PASS");
        Check(host.Events.SequenceEqual(new[] { "REGISTER", "STATUS_2", "VERIFY", "STATUS_4", "BOOTSTRAP_READONLY", "CHANNEL", "JOIN", "STATUS_1" }), "HOST_RUNNING_BEFORE_BOOTSTRAP_CHANNEL");
        Check(host.Statuses.All(s => s.Accepted == 0), "HOST_NO_STOP_CONTROLS");
        foreach (string failure in new[] { "REGISTER", "STATUS_2", "VERIFY", "STATUS_4", "BOOTSTRAP_READONLY", "CHANNEL", "JOIN", "STATUS_1" }) {
            var h = new Host { Fault = name => name == failure ? new IOException("SYNTHETIC_HOST_FAILURE") : null };
            var result = StandardServiceHostProtocol.Run(h, h); Check(result.FailureStage is not null && result.FailureHResult is not null, "HOST_FAULT_RAW");
            Check(h.Statuses.All(s => s.Accepted == 0), "HOST_FAULT_CONTROLS_ZERO");
            if (failure is "REGISTER" or "JOIN") Check(!result.StoppedPublished, "HOST_NO_FALSE_STOPPED");
            if (failure is "REGISTER" or "STATUS_2" or "VERIFY" or "STATUS_4" or "BOOTSTRAP_READONLY") Check(!result.ChannelEntered, "NO_WORK_BEFORE_BOOTSTRAP");
            if (result.StoppedPublished) Check(h.Statuses.Last().Win32 == 1066 && h.Statuses.Last().Specific == 1, "HOST_FAILURE_STOPPED_STATUS");
        }
        var primary = new IOException("PRIMARY"); var dual = new Host { Fault = name => name == "BOOTSTRAP_READONLY" ? primary : name == "JOIN" ? new TimeoutException("SECONDARY") : null };
        var dualResult = StandardServiceHostProtocol.Run(dual, dual);
        Check(dualResult.FailureStage == "READ_ONLY_BOOTSTRAP" && dualResult.FailureHResult == primary.HResult && !dualResult.StoppedPublished, "HOST_PRIMARY_FAILURE_AND_UNRESOLVED_JOIN_RETAINED");
        return count;
    }
}
