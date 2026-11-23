using System;
using System.Collections.Generic;
using System.Linq;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Orchestration used by the actual service worker and by fake-backend tests.
// No retry, delete, overwrite, rollback, retained-pilot action, or seal exists.
internal sealed class ControlLifecycle
{
    private readonly ControlSession session;
    private readonly IControlStore store;
    private readonly IControlKeys keys;
    private readonly Action verify;
    private readonly ControlStartupTrace? trace;
    internal ControlLifecycle(ControlSession session, IControlStore store, IControlKeys keys, Action verify,
        ControlStartupTrace? trace = null)
    {
        this.session = session ?? throw new ArgumentNullException(nameof(session));
        this.store = store ?? throw new ArgumentNullException(nameof(store));
        this.keys = keys ?? throw new ArgumentNullException(nameof(keys));
        this.verify = verify ?? throw new ArgumentNullException(nameof(verify));
        this.trace = trace;
    }
    private ControlConsumed Consumed(ControlRole role) => new(1, ControlRules.Scope, session.Plan.AttemptId,
        session.Pins.PlanSha256, session.Pins.ApprovalSha256, ControlRules.Role(role));
    private void Write<T>(string path, T value) { verify(); store.WriteNew(path, ControlRules.Serialize(value)); }
    private T Read<T>(string path) { verify(); return ControlRules.Parse<T>(store.Read(path)); }
    internal void Setup()
    {
        // Refusal here never reaches creation or overwrites an earlier attempt.
        ControlStartupTrace.At(trace, ControlStartupStage.SetupConsumedWrite, () =>
            Write("journal/setup-consumed.json", Consumed(ControlRole.Setup)));
        ControlArm arm = ControlArm.Exportable; string phase = "write-intent";
        var owned = new List<ControlOwned>();
        try {
            foreach (var current in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
                arm = current; var intent = ControlRules.Intent(session, arm);
                phase = "write-intent"; Write("journal/" + intent.Arm + "-intent.json", intent);
                phase = "create-and-inspect"; verify(); KeySnapshot created;
                using (var key = keys.Create(session.Plan.AttemptId, arm)) {
                    created = key.Inspect(); ControlRules.ValidateSnapshot(session, arm, created);
                }
                // Original creation handle is CLOSED before independent reopening.
                phase = "reopen-and-verify"; verify(); KeySnapshot reopened;
                using (var key = keys.OpenCreated(session.Plan.AttemptId, arm)) {
                    reopened = key.Inspect(); ControlRules.ValidateSnapshot(session, arm, reopened);
                }
                ControlRules.Need(created == reopened, "CONTROL_CREATED_REOPENED_MISMATCH");
                var record = new ControlOwned(intent, reopened.ReopenedPublicIdentitySha256!, reopened.DaclSha256!);
                phase = "write-owned"; Write("journal/" + intent.Arm + "-owned.json", record); owned.Add(record);
            }
            ControlRules.Need(owned[0].PublicSha256 != owned[1].PublicSha256 && owned[0].DaclSha256 == owned[1].DaclSha256,
                "CONTROL_PAIR_IDENTITY_OR_DACL_REFUSED");
            phase = "write-complete";
            Write("journal/setup-complete.json", new ControlSetupComplete(1, ControlRules.Scope, session.Plan.AttemptId,
                session.Pins.PlanSha256, ControlRules.Hash(ControlRules.Serialize(owned[0])), ControlRules.Hash(ControlRules.Serialize(owned[1]))));
        }
        catch (Exception error) {
            // Record before recovery invokes admission again. A failed recovery
            // verification must not replace the original key/worker failure.
            trace?.Record(ControlStartupStage.WorkerExecution, error);
            // If journalling also fails, leave the durable intent as an unresolved
            // orphan marker. Never infer ownership or delete from the name alone.
            try { Write("journal/setup-recovery.json", new ControlRecovery(1, ControlRules.Scope, session.Plan.AttemptId,
                session.Pins.PlanSha256, ControlRules.Arm(arm), phase, ControlRules.FailureKind(error), error.HResult, true, false)); }
            catch { }
            throw;
        }
    }
    internal ComparisonResult Guardian()
    {
        ControlStartupTrace.At(trace, ControlStartupStage.GuardianConsumedWrite, () =>
            Write("reports/guardian-consumed.json", Consumed(ControlRole.Guardian)));
        ControlRules.Need(Read<ControlConsumed>("journal/setup-consumed.json") == Consumed(ControlRole.Setup), "CONTROL_SETUP_CONTEXT_REFUSED");
        var complete = Read<ControlSetupComplete>("journal/setup-complete.json");
        ControlRules.Need(complete.SchemaVersion == 1 && complete.Scope == ControlRules.Scope &&
            complete.AttemptId == session.Plan.AttemptId && complete.PlanSha256 == session.Pins.PlanSha256,
            "CONTROL_SETUP_COMPLETE_REFUSED");
        var owned = new List<ControlOwned>();
        foreach (var arm in new[] { ControlArm.Exportable, ControlArm.NonExportable }) {
            var expected = ControlRules.Intent(session, arm);
            ControlRules.Need(Read<ControlIntent>("journal/" + expected.Arm + "-intent.json") == expected, "CONTROL_INTENT_REFUSED");
            var record = Read<ControlOwned>("journal/" + expected.Arm + "-owned.json");
            string hash = arm == ControlArm.Exportable ? complete.ExportableOwnedSha256 : complete.NonExportableOwnedSha256;
            ControlRules.Need(record.Intent == expected && ControlRules.Hex(record.PublicSha256, 64) &&
                ControlRules.Hex(record.DaclSha256, 64) && ControlRules.Hash(ControlRules.Serialize(record)) == hash, "CONTROL_OWNED_REFUSED");
            owned.Add(record);
        }
        ControlRules.Need(owned[0].PublicSha256 != owned[1].PublicSha256 && owned[0].DaclSha256 == owned[1].DaclSha256,
            "CONTROL_OWNED_PAIR_REFUSED");
        verify(); using var positive = keys.Open(session.Plan.AttemptId, ControlArm.Exportable);
        verify(); using var negative = keys.Open(session.Plan.AttemptId, ControlArm.NonExportable);
        var p = VerifyOpened(positive, ControlArm.Exportable, owned[0]);
        var n = VerifyOpened(negative, ControlArm.NonExportable, owned[1]);
        // Shared pure interpretation, NOT a relabelled synthetic ProbeReport.
        var result = MatchedExportProbe.Evaluate(p, n,
            format => { verify(); return positive.Export(format); },
            format => { verify(); return negative.Export(format); });
        verify(); return result;
    }
    private KeySnapshot VerifyOpened(IControlKey key, ControlArm arm, ControlOwned owned)
    {
        verify(); var snapshot = key.Inspect(); ControlRules.ValidateSnapshot(session, arm, snapshot);
        ControlRules.Need(snapshot.ReopenedPublicIdentitySha256 == owned.PublicSha256 && snapshot.DaclSha256 == owned.DaclSha256,
            "CONTROL_GUARDIAN_IDENTITY_REFUSED");
        return snapshot;
    }
}
