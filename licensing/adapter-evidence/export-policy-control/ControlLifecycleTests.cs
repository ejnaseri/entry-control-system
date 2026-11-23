using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EntryControl.TestOnly.ExportPolicyControl;

// All stores, keys and execution contexts are managed fakes. No file, service,
// Windows token or cryptographic key is created by this test suite.
internal static class ControlLifecycleTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 21, 12, 0, 0, TimeSpan.Zero);
    private const string Canary = "PRIVATE-MATERIAL-OR-NATIVE-ERROR-MUST-NOT-APPEAR";

    internal static int Run()
    {
        int cases = 0;
        void Check(bool value) { ControlRules.Need(value, "CONTROL_LIFECYCLE_TEST_FAILED"); cases++; }
        void Reject(Action action) {
            try { action(); }
            catch (Exception error) when (error is InvalidDataException or IOException or JsonException or ArgumentException) {
                cases++; return;
            }
            throw new InvalidDataException("CONTROL_LIFECYCLE_REFUSAL_MISSING");
        }

        var good = new Fixture();
        ControlRules.ValidateSession(good.Session, Now); cases++;
        good.Lifecycle.Setup();
        Check(good.Keys.Live == 0 && good.Keys.Created.Count == 2 && good.Keys.ExportCalls == 0);
        Check(good.Log.SequenceEqual(new[] {
            "write:journal/setup-consumed.json",
            "write:journal/exportable-intent.json", "create:exportable", "finalize:exportable", "inspect:created:exportable", "dispose:created:exportable",
            "open-created:exportable", "inspect:reopened:exportable", "dispose:reopened:exportable", "write:journal/exportable-owned.json",
            "write:journal/nonexportable-intent.json", "create:nonexportable", "finalize:nonexportable", "inspect:created:nonexportable", "dispose:created:nonexportable",
            "open-created:nonexportable", "inspect:reopened:nonexportable", "dispose:reopened:nonexportable", "write:journal/nonexportable-owned.json",
            "write:journal/setup-complete.json"
        }));
        var complete = good.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json");
        Check(complete.ExportableOwnedSha256 == ControlRules.Hash(good.Store.Bytes["journal/exportable-owned.json"]));
        Check(complete.NonExportableOwnedSha256 == ControlRules.Hash(good.Store.Bytes["journal/nonexportable-owned.json"]));
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            string label = ControlRules.Arm(arm);
            Check(good.Store.ReadValue<ControlIntent>("journal/" + label + "-intent.json") == ControlRules.Intent(good.Session, arm));
            Check(good.Log.IndexOf("write:journal/" + label + "-intent.json") < good.Log.IndexOf("create:" + label));
            Check(good.Log.IndexOf("dispose:created:" + label) < good.Log.IndexOf("open-created:" + label));
            Check(good.Log.IndexOf("dispose:reopened:" + label) < good.Log.IndexOf("write:journal/" + label + "-owned.json"));
        }
        byte[] beforeConsumed = (byte[])good.Store.Bytes["journal/setup-consumed.json"].Clone();
        int beforeCreated = good.Keys.Created.Count;
        Reject(good.Lifecycle.Setup);
        Check(good.Keys.Created.Count == beforeCreated && good.Store.Bytes["journal/setup-consumed.json"].SequenceEqual(beforeConsumed));
        Check(!good.Store.Bytes.ContainsKey("journal/setup-recovery.json"));

        // The real initial-consumption boundaries report their stage without
        // proceeding to any fake key operation or changing the thrown error.
        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            var trace = new ControlStartupTrace(); var f = new Fixture(trace);
            string path = role == ControlRole.Setup ? "journal/setup-consumed.json" : "reports/guardian-consumed.json";
            f.Store.FailWrite = path;
            Reject(() => { if (role == ControlRole.Setup) f.Lifecycle.Setup(); else f.Lifecycle.Guardian(); });
            var diagnostic = ControlStartupDiagnostics.Decode(1066, trace.FirstFailureCode!.Value)!;
            Check(diagnostic.Stage == (role == ControlRole.Setup ? "SetupConsumedWrite" : "GuardianConsumedWrite"));
            Check(diagnostic.Category == "IO" && diagnostic.ManagedHResult == new IOException().HResult);
            Check(f.Keys.Created.Count == 0 && f.Keys.ExportCalls == 0 && f.Log.SequenceEqual(new[] { "write:" + path }));
            Check(f.Store.Bytes.Count == 0);
        }

        // Fail every create/finalize/inspect/open/ownership boundary on either
        // arm. Retain completed intent and recovery; never advance to the next.
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable })
        foreach (string point in new[] { "create", "finalize", "inspect:created", "open-created", "inspect:reopened", "write-owned" }) {
            var fixture = new Fixture(); string label = ControlRules.Arm(arm);
            if (point == "write-owned") fixture.Store.FailWrite = "journal/" + label + "-owned.json";
            else fixture.Keys.FailAt = point + ":" + label;
            Reject(fixture.Lifecycle.Setup);
            Check(fixture.Keys.Live == 0 && fixture.Keys.ExportCalls == 0);
            Check(fixture.Store.Bytes.ContainsKey("journal/setup-consumed.json") && fixture.Store.Bytes.ContainsKey("journal/" + label + "-intent.json"));
            Check(!fixture.Store.Bytes.ContainsKey("journal/" + label + "-owned.json") && !fixture.Store.Bytes.ContainsKey("journal/setup-complete.json"));
            var recovery = fixture.Store.ReadValue<ControlRecovery>("journal/setup-recovery.json");
            Check(recovery.Arm == label && recovery.OrphanPossible && !recovery.AutomaticCleanupAllowed &&
                recovery.AttemptId == fixture.Session.Plan.AttemptId && recovery.PlanSha256 == fixture.Session.Pins.PlanSha256);
            string phase = point == "write-owned" ? "write-owned" : point is "open-created" or "inspect:reopened" ? "reopen-and-verify" : "create-and-inspect";
            Check(recovery.Phase == phase && !Encoding.UTF8.GetString(ControlRules.Serialize(recovery)).Contains(Canary, StringComparison.Ordinal));
            if (arm == ControlArm.Exportable)
                Check(!fixture.Log.Any(row => row.Contains("nonexportable", StringComparison.Ordinal)));
            else Check(fixture.Store.Bytes.ContainsKey("journal/exportable-owned.json"));
        }
        foreach (string path in new[] { "journal/exportable-intent.json", "journal/nonexportable-intent.json", "journal/setup-complete.json" }) {
            var fixture = new Fixture(); fixture.Store.FailWrite = path;
            Reject(fixture.Lifecycle.Setup);
            Check(fixture.Keys.Live == 0 && !fixture.Store.Bytes.ContainsKey(path));
            if (path.Contains("exportable-intent", StringComparison.Ordinal) && !path.Contains("nonexportable", StringComparison.Ordinal))
                Check(fixture.Keys.Created.Count == 0);
            else if (path.Contains("nonexportable-intent", StringComparison.Ordinal)) Check(fixture.Keys.Created.Count == 1);
            else Check(fixture.Keys.Created.Count == 2);
            Check(fixture.Store.Bytes.ContainsKey("journal/setup-recovery.json"));
        }
        foreach (bool mutateDacl in new[] { false, true }) {
            var fixture = new Fixture();
            fixture.Keys.ChangeSnapshot = (stage, arm, snapshot) => stage == "reopened" && arm == ControlArm.Exportable
                ? mutateDacl ? snapshot with { DaclSha256 = new('f', 64) }
                    : snapshot with { CreatedPublicIdentitySha256 = new('f', 64), ReopenedPublicIdentitySha256 = new('f', 64) }
                : snapshot;
            Reject(fixture.Lifecycle.Setup);
            Check(!fixture.Store.Bytes.ContainsKey("journal/exportable-owned.json") && fixture.Keys.Created.Count == 1 && fixture.Keys.Live == 0);
        }
        foreach (bool sameIdentity in new[] { false, true }) {
            var fixture = new Fixture();
            fixture.Keys.ChangeSnapshot = (_, arm, snapshot) => arm == ControlArm.NonExportable
                ? sameIdentity ? snapshot with { CreatedPublicIdentitySha256 = new('c', 64), ReopenedPublicIdentitySha256 = new('c', 64) }
                    : snapshot with { DaclSha256 = new('f', 64) }
                : snapshot;
            Reject(fixture.Lifecycle.Setup);
            Check(!fixture.Store.Bytes.ContainsKey("journal/setup-complete.json") && fixture.Keys.Live == 0);
        }
        var recoveryUnavailable = new Fixture(); recoveryUnavailable.Keys.FailAt = "finalize:exportable";
        recoveryUnavailable.Store.FailWrite = "journal/setup-recovery.json";
        Reject(recoveryUnavailable.Lifecycle.Setup);
        Check(recoveryUnavailable.Store.Bytes.ContainsKey("journal/exportable-intent.json") &&
            !recoveryUnavailable.Store.Bytes.ContainsKey("journal/setup-recovery.json") && recoveryUnavailable.Keys.Created.Count == 1);

        var firstFailure = new ControlStartupTrace();
        var recoveryVerification = new Fixture(firstFailure) { FailVerifyAt = 4 };
        recoveryVerification.Keys.FailAt = "create:exportable";
        Reject(recoveryVerification.Lifecycle.Setup);
        var retainedFailure = ControlStartupDiagnostics.Decode(1066, firstFailure.FirstFailureCode!.Value)!;
        Check(recoveryVerification.VerificationFailureObserved);
        Check(retainedFailure.Stage == "WorkerExecution" && retainedFailure.Category == "IO" &&
            retainedFailure.ManagedHResult == new IOException().HResult);
        Check(!recoveryVerification.Store.Bytes.ContainsKey("journal/setup-recovery.json") &&
            recoveryVerification.Store.Bytes.ContainsKey("journal/exportable-intent.json"));
        Check(recoveryVerification.Keys.Created.Count == 0 && recoveryVerification.Keys.ExportCalls == 0);

        var guardian = Prepared();
        ComparisonResult result = guardian.Lifecycle.Guardian();
        Check(result.Outcome == "POLICY_DIFFERENTIAL_OBSERVED" && result.Pairs.Count == 3 && result.RefusalReason is null);
        Check(guardian.Keys.ExportCalls == 6 && guardian.Keys.Live == 0 && guardian.Keys.Buffers.Count == 3);
        Check(guardian.Keys.Buffers.All(bytes => bytes.All(value => value == 0)));
        string json = Encoding.UTF8.GetString(ControlRules.Serialize(result));
        Check(!json.Contains(Canary, StringComparison.Ordinal) && !json.Contains(KeyNames.Prefix, StringComparison.Ordinal) &&
            !json.Contains("daclSha256", StringComparison.OrdinalIgnoreCase) && !json.Contains(new string('c', 64), StringComparison.Ordinal));
        Check(guardian.Log.IndexOf("read:journal/nonexportable-owned.json") < guardian.Log.IndexOf("open:exportable") &&
            guardian.Log.IndexOf("inspect:guardian:nonexportable") < guardian.Log.IndexOf("export:exportable:GenericPrivate"));
        int beforeExports = guardian.Keys.ExportCalls, beforeOpens = guardian.Keys.OpenCalls;
        Reject(() => guardian.Lifecycle.Guardian());
        Check(guardian.Keys.ExportCalls == beforeExports && guardian.Keys.OpenCalls == beforeOpens);

        // Corrupt each member of the complete/intent/owned context chain. These
        // are all rejected before any key is opened, let alone exported.
        var mutations = new Action<Fixture>[] {
            f => f.Store.Bytes.Remove("journal/setup-consumed.json"),
            f => f.Store.Put("journal/setup-consumed.json", f.Store.ReadValue<ControlConsumed>("journal/setup-consumed.json") with { Role = "Guardian" }),
            f => f.Store.Put("journal/setup-consumed.json", f.Store.ReadValue<ControlConsumed>("journal/setup-consumed.json") with { ApprovalSha256 = new('a', 64) }),
            f => f.Store.Bytes.Remove("journal/setup-complete.json"),
            f => f.Store.Put("journal/setup-complete.json", f.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json") with { SchemaVersion = 2 }),
            f => f.Store.Put("journal/setup-complete.json", f.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json") with { AttemptId = new('f', 32) }),
            f => f.Store.Put("journal/setup-complete.json", f.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json") with { ExportableOwnedSha256 = new('f', 64) }),
            f => f.Store.Put("journal/setup-complete.json", f.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json") with { NonExportableOwnedSha256 = new('f', 64) }),
            f => f.Store.Put("journal/exportable-intent.json", f.Store.ReadValue<ControlIntent>("journal/exportable-intent.json") with { ExportPolicy = 0 }),
            f => f.Store.Put("journal/nonexportable-intent.json", f.Store.ReadValue<ControlIntent>("journal/nonexportable-intent.json") with { Name = "RETAINED_KEY" }),
            f => f.Store.Put("journal/exportable-owned.json", f.Store.ReadValue<ControlOwned>("journal/exportable-owned.json") with { PublicSha256 = new('f', 64) }),
            f => f.Store.Put("journal/nonexportable-owned.json", f.Store.ReadValue<ControlOwned>("journal/nonexportable-owned.json") with { DaclSha256 = new('f', 64) }),
            f => RebindOwned(f, ControlArm.NonExportable, owned => owned with { PublicSha256 = new('c', 64) }),
            f => RebindOwned(f, ControlArm.NonExportable, owned => owned with { DaclSha256 = new('f', 64) })
        };
        foreach (var change in mutations) {
            var fixture = Prepared(); change(fixture); Reject(() => fixture.Lifecycle.Guardian());
            Check(fixture.Keys.OpenCalls == 0 && fixture.Keys.ExportCalls == 0 && fixture.Keys.Live == 0 &&
                fixture.Store.Bytes.ContainsKey("reports/guardian-consumed.json"));
        }
        foreach (bool changeDacl in new[] { false, true }) {
            var fixture = Prepared();
            RebindOwned(fixture, ControlArm.Exportable, owned => changeDacl
                ? owned with { DaclSha256 = new('f', 64) } : owned with { PublicSha256 = new('f', 64) });
            if (changeDacl) RebindOwned(fixture, ControlArm.NonExportable, owned => owned with { DaclSha256 = new('f', 64) });
            Reject(() => fixture.Lifecycle.Guardian());
            Check(fixture.Keys.OpenCalls == 2 && fixture.Keys.ExportCalls == 0 && fixture.Keys.Live == 0);
        }
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable })
        foreach (string mismatch in new[] { "public", "dacl", "provider", "policy" }) {
            var fixture = Prepared();
            fixture.Keys.ChangeSnapshot = (stage, current, snapshot) => stage != "guardian" || current != arm ? snapshot : mismatch switch {
                "public" => snapshot with { CreatedPublicIdentitySha256 = new('f', 64), ReopenedPublicIdentitySha256 = new('f', 64) },
                "dacl" => snapshot with { DaclSha256 = new('f', 64) },
                "provider" => snapshot with { Provider = "OTHER" },
                _ => snapshot with { ExportPolicy = 7 }
            };
            Reject(() => fixture.Lifecycle.Guardian());
            Check(fixture.Keys.ExportCalls == 0 && fixture.Keys.Live == 0);
        }
        foreach (string point in new[] { "open:exportable", "open:nonexportable", "inspect:guardian:exportable", "inspect:guardian:nonexportable" }) {
            var fixture = Prepared(); fixture.Keys.FailAt = point;
            Reject(() => fixture.Lifecycle.Guardian());
            Check(fixture.Keys.ExportCalls == 0 && fixture.Keys.Live == 0);
        }
        foreach (bool returnedRestricted in new[] { false, true }) {
            var fixture = Prepared(); fixture.Keys.ReturnRestricted = returnedRestricted;
            fixture.Keys.UnexpectedExportError = !returnedRestricted;
            ComparisonResult failed = fixture.Lifecycle.Guardian();
            Check(failed.Outcome == (returnedRestricted ? "BOUNDARY_FAILURE" : "UNKNOWN") && failed.Pairs.Count == 1);
            Check(fixture.Keys.Live == 0 && fixture.Keys.Buffers.All(bytes => bytes.All(value => value == 0)));
            Check(!Encoding.UTF8.GetString(ControlRules.Serialize(failed)).Contains(Canary, StringComparison.Ordinal));
        }

        // Test each context verification seam independently. A transient failure
        // inside an export callback becomes UNKNOWN; no later export proceeds.
        var setupCount = new Fixture(); setupCount.Lifecycle.Setup();
        for (int fail = 1; fail <= setupCount.Verifies; fail++) {
            var fixture = new Fixture(); fixture.FailVerifyAt = fail;
            Reject(fixture.Lifecycle.Setup);
            Check(fixture.Keys.Live == 0 && fixture.Keys.ExportCalls == 0 && !fixture.Store.Bytes.ContainsKey("journal/setup-complete.json"));
        }
        var guardianCount = Prepared(); guardianCount.Lifecycle.Guardian();
        for (int fail = 1; fail <= guardianCount.Verifies; fail++) {
            var fixture = Prepared(); fixture.FailVerifyAt = fail;
            ComparisonResult? observed = null;
            try { observed = fixture.Lifecycle.Guardian(); }
            catch (InvalidDataException) { }
            Check(observed is null || observed.Outcome == "UNKNOWN");
            Check(fixture.Keys.Live == 0 && fixture.Keys.Buffers.All(bytes => bytes.All(value => value == 0)));
            Check(fixture.VerificationFailureObserved);
        }

        // Contract validation and canonical JSON must refuse mutations before
        // callers are allowed to schedule a native worker.
        ControlSession original = new Fixture().Session;
        foreach (ControlPlan changed in new[] {
            original.Plan with { SchemaVersion = 2 }, original.Plan with { Scope = "PRODUCTION" },
            original.Plan with { AttemptId = "" }, original.Plan with { AttemptId = new('A', 32) },
            original.Plan with { OwnerSid = "S-1-5-18" }, original.Plan with { OwnerSid = null! },
            original.Plan with { AssemblySha256 = "" }, original.Plan with { RuntimeInventorySha256 = "bad" },
            original.Plan with { HostSha256 = new('A', 64) }, original.Plan with { BootIdentity = "bad" },
            original.Plan with { PackageSha256 = new('f', 64) }, original.Plan with { IssuedUtc = default },
            original.Plan with { IssuedUtc = Now.AddSeconds(1) }, original.Plan with { ExpiresUtc = Now },
            original.Plan with { ExpiresUtc = original.Plan.IssuedUtc.AddHours(4).AddTicks(1) },
            original.Plan with { IssuedUtc = original.Plan.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) },
            original.Plan with { ExpiresUtc = original.Plan.ExpiresUtc.ToOffset(TimeSpan.FromHours(1)) }
        }) Reject(() => ControlRules.ValidateSession(RebindPlan(original, changed), Now));
        foreach (ControlPins changed in new[] {
            original.Pins with { PlanSha256 = new('f', 64) }, original.Pins with { PlanSha256 = "bad" },
            original.Pins with { ApprovalSha256 = "" }, original.Pins with { PackageSha256 = new('f', 64) }
        }) Reject(() => ControlRules.ValidateSession(original with { Pins = changed }, Now));
        foreach (ControlReservation changed in new[] {
            original.Reservation with { SchemaVersion = 2 }, original.Reservation with { Scope = "PRODUCTION" },
            original.Reservation with { AttemptId = new('f', 32) }, original.Reservation with { PlanSha256 = new('f', 64) },
            original.Reservation with { ApprovalSha256 = new('a', 64) }, original.Reservation with { PackageSha256 = new('f', 64) },
            original.Reservation with { ReservedUtc = original.Plan.IssuedUtc.AddTicks(-1) },
            original.Reservation with { ReservedUtc = Now.AddTicks(1) },
            original.Reservation with { ReservedUtc = original.Reservation.ReservedUtc.ToOffset(TimeSpan.FromHours(1)) }
        }) Reject(() => ControlRules.ValidateSession(original with { Reservation = changed }, Now));
        Reject(() => ControlRules.ValidateSession(original, Now.ToOffset(TimeSpan.FromHours(1))));
        Reject(() => ControlRules.ValidateSession(null!, Now));
        Reject(() => ControlRules.ValidateSession(original with { Plan = null! }, Now));
        Reject(() => ControlRules.ValidateSession(original with { Reservation = null! }, Now));
        Reject(() => ControlRules.ValidateSession(original with { Pins = null! }, Now));
        string planJson = Encoding.UTF8.GetString(ControlRules.Serialize(original.Plan));
        Check(ControlRules.Parse<ControlPlan>(Encoding.UTF8.GetBytes(planJson)) == original.Plan);
        foreach (string invalid in new[] {
            planJson.Insert(1, "\"unknown\":true,"), planJson.Insert(1, "\"schemaVersion\":1,"),
            planJson.Replace("\"schemaVersion\":1,", "", StringComparison.Ordinal),
            " " + planJson, planJson + "\n", "null", "{}", "[]"
        }) Reject(() => ControlRules.Parse<ControlPlan>(Encoding.UTF8.GetBytes(invalid)));
        Reject(() => ControlRules.Parse<ControlPlan>(Array.Empty<byte>()));
        Reject(() => ControlRules.Parse<ControlPlan>(new byte[2097153]));
        return cases;
    }

    private static ControlSession RebindPlan(ControlSession original, ControlPlan plan)
    {
        string hash = ControlRules.Hash(ControlRules.Serialize(plan));
        return original with { Plan = plan, Pins = original.Pins with { PlanSha256 = hash },
            Reservation = original.Reservation with { PlanSha256 = hash } };
    }
    private static Fixture Prepared()
    {
        var fixture = new Fixture(); fixture.Lifecycle.Setup();
        fixture.Log.Clear(); fixture.Verifies = 0;
        return fixture;
    }
    private static void RebindOwned(Fixture fixture, ControlArm arm, Func<ControlOwned, ControlOwned> change)
    {
        string file = "journal/" + ControlRules.Arm(arm) + "-owned.json";
        fixture.Store.Put(file, change(fixture.Store.ReadValue<ControlOwned>(file)));
        string hash = ControlRules.Hash(fixture.Store.Bytes[file]);
        var complete = fixture.Store.ReadValue<ControlSetupComplete>("journal/setup-complete.json");
        fixture.Store.Put("journal/setup-complete.json", arm == ControlArm.Exportable
            ? complete with { ExportableOwnedSha256 = hash } : complete with { NonExportableOwnedSha256 = hash });
    }

    private sealed class Fixture
    {
        internal readonly List<string> Log = new();
        internal readonly FakeStore Store;
        internal readonly FakeKeys Keys;
        internal readonly ControlSession Session;
        internal readonly ControlLifecycle Lifecycle;
        internal int Verifies, FailVerifyAt;
        internal bool VerificationFailureObserved;
        internal Fixture(ControlStartupTrace? trace = null)
        {
            var plan = new ControlPlan(1, ControlRules.Scope, new('a', 32), "S-1-5-21-1-2-3-1001",
                new('a', 64), new('b', 64), new('c', 64), new('d', 64), new('e', 64), Now.AddHours(-1), Now.AddHours(1));
            var pins = new ControlPins(ControlRules.Hash(ControlRules.Serialize(plan)), new('f', 64), plan.PackageSha256);
            var reservation = new ControlReservation(1, ControlRules.Scope, plan.AttemptId, pins.PlanSha256,
                pins.ApprovalSha256, pins.PackageSha256, Now.AddMinutes(-30));
            Session = new(plan, pins, reservation); Store = new(Log); Keys = new(Log);
            Lifecycle = new(Session, Store, Keys, () => {
                Verifies++;
                if (Verifies == FailVerifyAt) {
                    VerificationFailureObserved = true;
                    ControlStartupTrace.At(trace, ControlStartupStage.ContextSession, () => { throw new InvalidDataException(Canary); });
                }
                ControlRules.ValidateSession(Session, Now);
            }, trace);
        }
    }
    private sealed class FakeStore : IControlStore
    {
        private readonly List<string> log;
        internal readonly Dictionary<string, byte[]> Bytes = new(StringComparer.Ordinal);
        internal string? FailWrite;
        internal FakeStore(List<string> log) { this.log = log; }
        public byte[] Read(string relative)
        {
            log.Add("read:" + relative);
            if (!Bytes.TryGetValue(relative, out var bytes)) throw new IOException(Canary);
            return (byte[])bytes.Clone();
        }
        public void WriteNew(string relative, byte[] bytes)
        {
            log.Add("write:" + relative);
            if (FailWrite == relative || !Bytes.TryAdd(relative, (byte[])bytes.Clone())) throw new IOException(Canary);
        }
        internal T ReadValue<T>(string file) => ControlRules.Parse<T>(Bytes[file]);
        internal void Put<T>(string file, T value) => Bytes[file] = ControlRules.Serialize(value);
    }
    private sealed class FakeKeys : IControlKeys
    {
        private readonly List<string> log;
        internal readonly List<ControlArm> Created = new();
        internal readonly List<byte[]> Buffers = new();
        internal int Live, OpenCalls, ExportCalls;
        internal string? FailAt;
        internal bool ReturnRestricted, UnexpectedExportError;
        internal Func<string, ControlArm, KeySnapshot, KeySnapshot>? ChangeSnapshot;
        internal FakeKeys(List<string> log) { this.log = log; }
        private void At(string point) { log.Add(point); if (FailAt == point) throw new IOException(Canary); }
        public IControlKey Create(string attemptId, ControlArm arm)
        {
            At("create:" + ControlRules.Arm(arm)); Created.Add(arm);
            At("finalize:" + ControlRules.Arm(arm)); return new Key(this, attemptId, arm, "created");
        }
        public IControlKey OpenCreated(string attemptId, ControlArm arm)
        {
            ControlRules.Need(Live == 0, "FAKE_CREATION_HANDLE_STILL_LIVE");
            At("open-created:" + ControlRules.Arm(arm)); return new Key(this, attemptId, arm, "reopened");
        }
        public IControlKey Open(string attemptId, ControlArm arm)
        {
            OpenCalls++; At("open:" + ControlRules.Arm(arm)); return new Key(this, attemptId, arm, "guardian");
        }
        private sealed class Key : IControlKey
        {
            private readonly FakeKeys owner;
            private readonly string attempt, stage;
            private readonly ControlArm arm;
            private bool disposed;
            internal Key(FakeKeys owner, string attempt, ControlArm arm, string stage)
            { this.owner = owner; this.attempt = attempt; this.arm = arm; this.stage = stage; owner.Live++; }
            public KeySnapshot Inspect()
            {
                ControlRules.Need(!disposed, "FAKE_DISPOSED_KEY_REFUSED");
                owner.At("inspect:" + stage + ":" + ControlRules.Arm(arm));
                string identity = new(arm == ControlArm.Exportable ? 'c' : 'd', 64);
                var snapshot = new KeySnapshot(KeyNames.For(attempt, arm), MatchedExportProbe.Provider, "RSA", 3072,
                    true, true, 1, ControlRules.Policy(arm), true, new('e', 64), identity, identity);
                return owner.ChangeSnapshot?.Invoke(stage, arm, snapshot) ?? snapshot;
            }
            public byte[] Export(ExportFormat format)
            {
                ControlRules.Need(!disposed && stage == "guardian", "FAKE_EXPORT_CONTEXT_REFUSED");
                owner.ExportCalls++; owner.At("export:" + ControlRules.Arm(arm) + ":" + format);
                if (owner.UnexpectedExportError) throw new IOException(Canary);
                if (arm == ControlArm.NonExportable && !owner.ReturnRestricted)
                    throw new CryptographicException(MatchedExportProbe.Unsupported);
                byte[] bytes = Encoding.UTF8.GetBytes(Canary); owner.Buffers.Add(bytes); return bytes;
            }
            public void Dispose()
            {
                if (disposed) return;
                disposed = true; owner.Live--; owner.log.Add("dispose:" + stage + ":" + ControlRules.Arm(arm));
            }
        }
    }
}
