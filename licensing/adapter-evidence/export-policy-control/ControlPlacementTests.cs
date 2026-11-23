using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Fixed V5 placement and cross-version admission tests. Every input is an
// in-memory fixture: no filesystem, SCM, token, process or CNG call is made.
internal static class ControlPlacementTests
{
    private const string Placement = "Ecs.Lic008.ExportPolicyControlV5";
    private const string Root = @"C:\ProgramData\Ecs.Lic008.ExportPolicyControlV5";
    private const string SetupSid = "S-1-5-80-2529379509-1660257719-1247876742-1299507549-2916452335";
    private const string Guardian = "Ecs.Lic008.EntryEvidenceV2.Guardian";
    private const string GuardianSid = "S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315";
    private const string OriginalGuardianBinary = "\"C:\\ProgramData\\Ecs.Lic008.EntryEvidenceV2\\bin\\EntryControl.AdapterPilot.exe\" --service Guardian";
    private const string PlanScope = "TEST_ONLY_EXPORT_POLICY_CONTROL_V5";
    private const string ApprovalScope = "TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V5";
    private const string PackageScope = "TEST_ONLY_EXPORT_POLICY_PACKAGE_V5";
    private const string NativeReportScope = "TEST_ONLY_EXPORT_POLICY_NATIVE_EVIDENCE_V5";
    private sealed record Prior(int Version, string SetupSid)
    {
        internal string Placement => "Ecs.Lic008.ExportPolicyControlV" + Version;
        internal string Root => @"C:\ProgramData\" + Placement;
        internal string PlanScope => "TEST_ONLY_EXPORT_POLICY_CONTROL_V" + Version;
        internal string ApprovalScope => "TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V" + Version;
        internal string PackageScope => "TEST_ONLY_EXPORT_POLICY_PACKAGE_V" + Version;
        internal string NativeReportScope => "TEST_ONLY_EXPORT_POLICY_NATIVE_EVIDENCE_V" + Version;
        internal string RootEffect => "Create isolated ExportPolicyControlV" + Version + " root, protected inputs and one-attempt reservation";
        internal string KeyEffect => Version == 1
            ? "Register and start one new LocalSystem Setup service; create two new test-only RSA keys"
            : "Register and start new LocalSystem ExportPolicyControlV" + Version + ".Setup; create two new ExportPolicyControlV" + Version + ".TEST_ONLY RSA keys";
    }
    private static readonly Prior[] Previous = {
        new(1, "S-1-5-80-3697491920-1001020110-868649658-835888766-2107162030"),
        new(2, "S-1-5-80-1349545842-880831857-2158974086-2597486822-1814426470"),
        new(3, "S-1-5-80-1089034463-1541443459-4272285516-2530654974-4160034000"),
        new(4, "S-1-5-80-223512861-2069854949-399502294-4005083310-3557816799")
    };

    private sealed class MemoryStore : IControlStore
    {
        internal readonly Dictionary<string, byte[]> Bytes = new(StringComparer.Ordinal);
        public byte[] Read(string relative) => (byte[])Bytes[relative].Clone();
        public void WriteNew(string relative, byte[] data)
        {
            if (!Bytes.TryAdd(relative, (byte[])data.Clone())) throw new InvalidDataException("PLACEMENT_DUPLICATE_WRITE");
        }
        internal void Put<T>(string relative, T value) => Bytes[relative] = ControlRules.Serialize(value);
    }

    private sealed class NeverKeys : IControlKeys
    {
        internal int Calls;
        private IControlKey Unexpected() { Calls++; throw new InvalidOperationException("PLACEMENT_KEY_REACHED"); }
        public IControlKey Create(string attemptId, ControlArm arm) => Unexpected();
        public IControlKey OpenCreated(string attemptId, ControlArm arm) => Unexpected();
        public IControlKey Open(string attemptId, ControlArm arm) => Unexpected();
    }

    private static MemoryStore Journal(ControlSession session, ControlArm changedArm, string changedRecord, int mutation,
        Prior? prior = null)
    {
        var store = new MemoryStore();
        store.Put("journal/setup-consumed.json", new ControlConsumed(1,
            changedRecord == "consumed" ? prior!.PlanScope : PlanScope, session.Plan.AttemptId,
            session.Pins.PlanSha256, session.Pins.ApprovalSha256, "Setup"));
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            var intent = ControlRules.Intent(session, arm);
            var oldIntent = intent with {
                Name = mutation is 0 or 2 ? (prior?.Placement ?? Placement) + ".TEST_ONLY." + session.Plan.AttemptId + "." + intent.Arm : intent.Name,
                Scope = mutation is 1 or 2 ? prior?.PlanScope ?? PlanScope : intent.Scope
            };
            store.Put("journal/" + intent.Arm + "-intent.json", arm == changedArm && changedRecord == "intent" ? oldIntent : intent);
            var owned = new ControlOwned(arm == changedArm && changedRecord == "owned" ? oldIntent : intent,
                new(arm == ControlArm.Exportable ? '1' : '2', 64), new('3', 64));
            store.Put("journal/" + intent.Arm + "-owned.json", owned);
        }
        // Rebind the completion hashes even for modified ownership records so
        // a stale byte digest cannot be the reason the old placement is refused.
        store.Put("journal/setup-complete.json", new ControlSetupComplete(1,
            changedRecord == "complete" ? prior!.PlanScope : PlanScope, session.Plan.AttemptId,
            session.Pins.PlanSha256, ControlRules.Hash(store.Bytes["journal/exportable-owned.json"]),
            ControlRules.Hash(store.Bytes["journal/nonexportable-owned.json"])));
        return store;
    }

    internal static int Run()
    {
        int cases = 0;
        void Check(bool valid, string label)
        { ControlRules.Need(valid, "CONTROL_PLACEMENT_TEST_FAILED:" + label); cases++; }
        void Reject(Action action, string label)
        {
            bool refused = false;
            try { action(); } catch (InvalidDataException) { refused = true; }
            Check(refused, label);
        }

        Check(ControlRules.Placement == Placement, "fixed-placement");
        Check(ControlRules.Root == Root && ProtectedControlStore.Root == Root, "one-fixed-protected-root");
        Check(ControlRules.SetupService == Placement + ".Setup" &&
            NativeControlIdentity.ServiceName(ControlRole.Setup) == Placement + ".Setup", "fixed-setup-service");
        Check(ControlRules.SetupSid == SetupSid && NativeControlIdentity.DerivedServiceSid(ControlRole.Setup) == SetupSid,
            "independently-pinned-setup-sid");
        Check(KeyNames.Prefix == Placement + ".TEST_ONLY.", "fixed-key-namespace");
        Check(ControlRules.Scope == PlanScope, "plan-and-reservation-scope");
        Check(ControlController.ApprovalScope == ApprovalScope, "approval-scope");
        Check(NativeControlRuntime.ReportScope == NativeReportScope, "native-report-scope");
        Check(ControlCapability.Symbol == "TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5", "purpose-specific-v5-capability");
#if TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5
        Check(ControlCapability.Enabled && ControlOwnerEntry.PhysicalEnabled && NativeControlRuntime.PhysicalEnabled,
            "v5-build-capability");
#else
        Check(!ControlCapability.Enabled && !ControlOwnerEntry.PhysicalEnabled && !NativeControlRuntime.PhysicalEnabled,
            "older-or-absent-capability-stays-inert");
#endif
        Check(ControlRules.GuardianService == Guardian && NativeControlIdentity.ServiceName(ControlRole.Guardian) == Guardian,
            "existing-guardian-service-preserved");
        Check(ControlRules.GuardianSid == GuardianSid && ProtectedControlStore.GuardianSid == GuardianSid &&
            NativeControlIdentity.DerivedServiceSid(ControlRole.Guardian) == GuardianSid, "existing-guardian-sid-preserved");
        Check(ControlController.OriginalBinary == OriginalGuardianBinary, "existing-guardian-original-binary-preserved");

        // Fixed store routes accept relative whitelisted names only. Neither
        // an old absolute pathname nor an old key/service name selects V1/V2/V3/V4.
        Check(ProtectedControlStore.Files.Count == 17, "fixed-store-file-count");
        foreach (string relative in ProtectedControlStore.Files) {
            Check(ProtectedControlStore.PathOf(relative) == Root + "\\" + relative.Replace('/', '\\'), "canonical-v5-path");
            foreach (var prior in Previous) {
                string oldPath = prior.Root + "\\" + relative.Replace('/', '\\');
                Reject(() => ProtectedControlStore.PathOf(oldPath), "old-absolute-store-path-refused");
                foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
                    Check(!ProtectedControlStore.CanRead(role, oldPath), "old-store-path-not-readable");
                    Check(!ProtectedControlStore.CanWrite(role, oldPath), "old-store-path-not-writable");
                }
            }
        }
        string attempt = new('a', 32);
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            string suffix = arm == ControlArm.Exportable ? "exportable" : "nonexportable";
            Check(KeyNames.For(attempt, arm) == Placement + ".TEST_ONLY." + attempt + "." + suffix, "canonical-v5-key-name");
            foreach (var prior in Previous)
                Reject(() => KeyNames.For(prior.Placement + ".TEST_ONLY." + attempt + "." + suffix, arm), "old-full-key-name-not-an-attempt");
        }

        var now = new DateTimeOffset(2026, 10, 27, 12, 0, 0, TimeSpan.Zero);
        var plan = new ControlPlan(1, PlanScope, attempt, "S-1-5-21-1-2-3-1001", new('a', 64), new('b', 64),
            new('c', 64), new('d', 64), new('e', 64), now.AddMinutes(-5), now.AddHours(1));
        string planHash = ControlRules.Hash(ControlRules.Serialize(plan));
        var original = new ControlServiceSnapshot(Guardian, OriginalGuardianBinary, "NT SERVICE\\" + Guardian,
            3, 16, 1, 1, 1, 0, new('f', 64));
        var approval = new ControlOwnerApproval(1, ApprovalScope, attempt, planHash, plan.PackageSha256,
            plan.OwnerSid, original, plan.IssuedUtc, plan.ExpiresUtc, ControlController.Effects.ToArray());
        var pins = new ControlPins(planHash, ControlRules.Hash(ControlRules.Serialize(approval)), plan.PackageSha256);
        var session = new ControlSession(plan, pins, new(1, PlanScope, attempt, pins.PlanSha256,
            pins.ApprovalSha256, pins.PackageSha256, now.AddMinutes(-1)));
        ControlRules.ValidateSession(session, now); cases++;
        ControlController.ValidateApproval(approval, session, now); cases++;
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            string suffix = arm == ControlArm.Exportable ? "exportable" : "nonexportable";
            var snapshot = new KeySnapshot(Placement + ".TEST_ONLY." + attempt + "." + suffix,
                MatchedExportProbe.Provider, "RSA", 3072, true, true, 1, arm == ControlArm.Exportable ? 3 : 0,
                true, new('1', 64), new('2', 64), new('2', 64));
            ControlRules.ValidateSnapshot(session, arm, snapshot); cases++;
            foreach (var prior in Previous)
                Reject(() => ControlRules.ValidateSnapshot(session, arm, snapshot with {
                    Name = prior.Placement + ".TEST_ONLY." + attempt + "." + suffix
                }), "old-full-key-snapshot-name-refused");
        }
        var baselineStore = Journal(session, ControlArm.Exportable, "none", 0);
        var baselineKeys = new NeverKeys();
        bool baselineReachedKeys = false;
        try { new ControlLifecycle(session, baselineStore, baselineKeys, () => ControlRules.ValidateSession(session, now)).Guardian(); }
        catch (InvalidOperationException) { baselineReachedKeys = true; }
        Check(baselineReachedKeys && baselineKeys.Calls == 1, "valid-journal-reaches-managed-key-sentinel");
        foreach (var prior in Previous)
        foreach (ControlArm arm in new[] { ControlArm.Exportable, ControlArm.NonExportable })
        foreach (string record in new[] { "intent", "owned" })
        foreach (int mutation in new[] { 0, 1, 2 }) {
            var store = Journal(session, arm, record, mutation, prior);
            var keys = new NeverKeys();
            var lifecycle = new ControlLifecycle(session, store, keys, () => ControlRules.ValidateSession(session, now));
            Reject(() => lifecycle.Guardian(), "old-intent-or-owned-record-refused");
            Check(keys.Calls == 0 && store.Bytes.ContainsKey("reports/guardian-consumed.json"),
                "old-journal-refused-before-any-key-operation");
        }
        foreach (var prior in Previous)
        foreach (string record in new[] { "consumed", "complete" }) {
            var store = Journal(session, ControlArm.Exportable, record, 0, prior);
            var keys = new NeverKeys();
            var lifecycle = new ControlLifecycle(session, store, keys, () => ControlRules.ValidateSession(session, now));
            Reject(() => lifecycle.Guardian(), "old-consumed-or-complete-scope-refused");
            Check(keys.Calls == 0 && store.Bytes.ContainsKey("reports/guardian-consumed.json"),
                "old-completion-chain-refused-before-any-key-operation");
        }
        Check(ControlController.Effects[0] == "Create isolated ExportPolicyControlV5 root, protected inputs and one-attempt reservation",
            "approval-explicitly-names-v5-placement");
        Check(ControlController.Effects[1] == "Register and start new LocalSystem ExportPolicyControlV5.Setup; create two new ExportPolicyControlV5.TEST_ONLY RSA keys",
            "approval-explicitly-names-v5-setup-and-keys");

        foreach (ControlRole role in new[] { ControlRole.Setup, ControlRole.Guardian }) {
            string command = ControlController.ServiceCommand(role, pins);
            Check(command == "\"" + Root + "\\bin\\ExportPolicyControl.exe\" --control-service " + ControlRules.Role(role) +
                " --plan-sha256 " + pins.PlanSha256 + " --approval-sha256 " + pins.ApprovalSha256 +
                " --package-sha256 " + pins.PackageSha256, "canonical-v5-service-command");
            foreach (var prior in Previous)
                Check(!command.Contains(prior.Root, StringComparison.Ordinal), "command-cannot-select-prior-root");
        }
        foreach (var prior in Previous)
        foreach (string oldTarget in new[] { prior.Placement + ".Setup", prior.Root, prior.Root + "\\bin\\ExportPolicyControl.exe" })
            Reject(() => ControlOwnerEntry.ParseService(new[] { "--control-service", oldTarget,
                "--plan-sha256", pins.PlanSha256, "--approval-sha256", pins.ApprovalSha256,
                "--package-sha256", pins.PackageSha256 }), "old-target-not-a-service-role");

        var setupToken = new ControlTokenSnapshot("S-1-5-18", "S-1-5-18", 1, 1, SetupSid, 4, 1, false, true);
        NativeControlIdentity.Validate(ControlRole.Setup, setupToken); cases++;
        foreach (var prior in Previous)
            Reject(() => NativeControlIdentity.Validate(ControlRole.Setup, setupToken with { ServiceSid = prior.SetupSid }),
                "old-setup-service-token-refused");

        // Rehash every changed plan and update every dependent pin. Refusal
        // therefore exercises semantic scope admission, not a stale digest.
        var oldSessionScopes = Previous.SelectMany(prior => new[] {
            (prior.PlanScope, PlanScope), (PlanScope, prior.PlanScope), (prior.PlanScope, prior.PlanScope)
        }).Concat(Previous.SelectMany(left => Previous.Where(right => right.Version != left.Version)
            .Select(right => (left.PlanScope, right.PlanScope))));
        foreach (var scopes in oldSessionScopes) {
            var changedPlan = plan with { Scope = scopes.Item1 };
            var changedPins = pins with { PlanSha256 = ControlRules.Hash(ControlRules.Serialize(changedPlan)) };
            var changedReservation = session.Reservation with { Scope = scopes.Item2, PlanSha256 = changedPins.PlanSha256 };
            var changed = new ControlSession(ControlRules.Parse<ControlPlan>(ControlRules.Serialize(changedPlan)), changedPins,
                ControlRules.Parse<ControlReservation>(ControlRules.Serialize(changedReservation)));
            Check(ControlRules.Hash(ControlRules.Serialize(changed.Plan)) == changed.Pins.PlanSha256 &&
                changed.Reservation.PlanSha256 == changed.Pins.PlanSha256, "cross-scope-session-pins-rebound");
            Reject(() => ControlRules.ValidateSession(changed, now), "prior-or-mixed-plan-reservation-scope-refused");
        }

        foreach (var prior in Previous) {
            string[] oldRootEffect = approval.Effects.ToArray(); oldRootEffect[0] = prior.RootEffect;
            string[] oldKeyEffect = approval.Effects.ToArray(); oldKeyEffect[1] = prior.KeyEffect;
            string[] oldEffects = oldRootEffect.ToArray(); oldEffects[1] = prior.KeyEffect;
            foreach (var changedApproval in new[] {
                approval with { Scope = prior.ApprovalScope }, approval with { Effects = oldRootEffect },
                approval with { Effects = oldKeyEffect }, approval with { Effects = oldEffects },
                approval with { Scope = prior.ApprovalScope, Effects = oldEffects }
            }) {
                byte[] canonical = ControlRules.Serialize(changedApproval);
                var changedPins = pins with { ApprovalSha256 = ControlRules.Hash(canonical) };
                var rebound = session with { Pins = changedPins,
                    Reservation = session.Reservation with { ApprovalSha256 = changedPins.ApprovalSha256 } };
                ControlRules.ValidateSession(rebound, now); cases++;
                Reject(() => ControlController.ValidateApproval(ControlRules.Parse<ControlOwnerApproval>(canonical), rebound, now),
                    "prior-approval-scope-or-effects-refused-after-rebinding");
            }
        }

        var package = new ControlPackage(1, PackageScope,
            new[] { "ExportPolicyControl.exe", "ExportPolicyControl.dll", "ExportPolicyControl.runtimeconfig.json", "runtime-inventory.json" }
                .Select(name => new ControlPackageFile(name, 10, new('a', 64))).ToArray());
        NativeControlAdmission.ValidatePackage(package); cases++;
        foreach (var prior in Previous) {
            var oldPackage = ControlRules.Parse<ControlPackage>(ControlRules.Serialize(package with { Scope = prior.PackageScope }));
            Reject(() => NativeControlAdmission.ValidatePackage(oldPackage), "prior-package-scope-refused");
        }

        var setupReport = new ControlNativeReport(1, NativeReportScope, "Setup", attempt, pins.PlanSha256,
            pins.ApprovalSha256, pins.PackageSha256, plan.AssemblySha256, plan.RuntimeInventorySha256, plan.HostSha256,
            plan.BootIdentity, setupToken, 42, now.AddSeconds(-10), true, false, "SETUP_COMPLETE",
            Array.Empty<PairObservation>(), null, "NONE", false, false);
        NativeControlRuntime.ValidateReport(setupReport, ControlRole.Setup, session, now, 42); cases++;
        NativeControlRuntime.ValidateSetupPredecessor(ControlRules.Serialize(setupReport), session, now); cases++;
        foreach (var prior in Previous) {
            byte[] oldReportBytes = ControlRules.Serialize(setupReport with { Scope = prior.NativeReportScope });
            Reject(() => NativeControlRuntime.ValidateReport(ControlRules.Parse<ControlNativeReport>(oldReportBytes),
                ControlRole.Setup, session, now, 42), "prior-native-report-scope-refused");
            Reject(() => NativeControlRuntime.ValidateSetupPredecessor(oldReportBytes, session, now), "prior-predecessor-evidence-refused");
        }
        return cases;
    }
}
