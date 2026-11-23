using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.StandardUserControl;

// Synthetic fixtures only. No CNG, account, token, process, service or file API.
internal static class StandardCryptoComparisonTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 10, 0, 0, TimeSpan.Zero);
    private static string H(int number) => number.ToString("x").PadLeft(64, '0');
    private static StandardCryptoScope Scope() => new(StandardCryptoComparison.Schema,
        StandardContract.Root, "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2),
        StandardContract.UserSid, StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
        StandardContract.OwnerSid, H(1), H(2), H(3), H(4), H(5), H(6), H(7), H(8));

    private static StandardCryptoKey Key(StandardCryptoArm arm)
    {
        bool accessible = arm == StandardCryptoArm.UserAccessible;
        string publicHash = H(accessible ? 11 : 10);
        var aces = new List<StandardCryptoAce> {
            new(StandardCryptoComparison.SystemSid, 0x10000000u, 0, true, false),
            new(StandardCryptoComparison.GuardianSid, 0x10000000u, 0, true, false)
        };
        if (accessible) aces.Add(new(StandardContract.UserSid, 0x10000000u, 0, true, false));
        return new(arm, StandardCryptoComparison.KeyName(Scope().Attempt, arm), StandardCryptoComparison.Provider,
            "RSA", 3072, true, true, 1, 0, StandardCryptoComparison.SystemSid, StandardCryptoComparison.SystemSid,
            true, aces.ToArray(), H(accessible ? 13 : 12), publicHash,
            new("AES-256-GCM", "RSA-OAEP-SHA256", H(accessible ? 15 : 14), H(16), publicHash));
    }

    private static StandardToken UserToken() => new(StandardContract.UserSid, StandardContract.UserSid,
        1, 0, 1, StandardContract.MediumIntegrity, false, false, true,
        new[] { new StandardGroup(StandardContract.Interactive, 7), new StandardGroup(StandardContract.Users, 7) });
    private static StandardToken ServiceToken(bool setup) => new(
        setup ? StandardCryptoComparison.SystemSid : StandardCryptoComparison.GuardianSid,
        setup ? StandardCryptoComparison.SystemSid : StandardCryptoComparison.GuardianSid,
        1, 1, 1, StandardCryptoComparison.SystemIntegritySid, false, false, true,
        setup ? new[] { new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7), new StandardGroup(StandardCryptoComparison.SetupSid, 14) }
            : new[] { new StandardGroup(StandardCryptoComparison.ServiceLogonSid, 7) });

    private static StandardCryptoOperation Decrypt(StandardCryptoKey key, DateTimeOffset at) => new(key.Arm,
        key.Name, key.PublicSha256, key.Envelope!.EnvelopeSha256, at, "DECRYPTED", "DECRYPT", true,
        null, null, null, key.Envelope.SyntheticPlaintextSha256);
    private static StandardCryptoOperation Denied(StandardCryptoKey key, DateTimeOffset at) => new(key.Arm,
        key.Name, key.PublicSha256, key.Envelope!.EnvelopeSha256, at, "FAILED", "OPEN", false,
        "CRYPTOGRAPHIC", StandardCryptoComparison.BadKeyset, null, null);

    private static StandardCryptoCollectedStage Stage(StandardCryptoStage stage, int index)
    {
        var scope = Scope(); var restricted = Key(StandardCryptoArm.Restricted); var accessible = Key(StandardCryptoArm.UserAccessible);
        bool setup = stage == StandardCryptoStage.Setup, user = stage == StandardCryptoStage.StandardUser;
        DateTimeOffset started = Start.AddSeconds(10 + index * 30), completed = started.AddSeconds(10);
        long created = started.AddSeconds(-2).UtcDateTime.ToFileTimeUtc();
        uint pid = (uint)(400 + index);
        var report = new StandardCryptoReport(scope, stage, index.ToString("x").PadLeft(32, '0'), pid, created,
            started, completed, user ? null : restricted, accessible,
            setup ? null : user ? Denied(restricted, started.AddSeconds(6)) : Decrypt(restricted, started.AddSeconds(6)),
            setup ? null : Decrypt(accessible, started.AddSeconds(4)));
        var proof = new StandardCryptoProcessProof(scope, stage, pid, created,
            StandardCryptoComparison.ImagePath, scope.ImageSha256, scope.AssemblySha256,
            scope.PackageSha256, scope.RuntimeSha256, user ? UserToken() : ServiceToken(setup),
            started.AddSeconds(-1), completed.AddSeconds(1), true, true, true, true,
            user, user, true, 0, H(30 + index));
        return new(report, proof, H(30 + index), true, true);
    }

    private static StandardCryptoJournal Journal(StandardCryptoArm arm, int offset)
    {
        var scope = Scope(); var key = Key(arm);
        var intent = new StandardCryptoJournalRecord(scope, arm, "INTENT", key.Name,
            Start.AddSeconds(11 + offset), H(100 + offset), null, null, null, true, true, true);
        var owned = intent with { Kind = "OWNED", WrittenUtc = intent.WrittenUtc.AddSeconds(1),
            Sha256 = H(101 + offset), PreviousSha256 = intent.Sha256,
            PublicSha256 = key.PublicSha256, DescriptorSha256 = key.DescriptorSha256 };
        var complete = owned with { Kind = "COMPLETE", WrittenUtc = owned.WrittenUtc.AddSeconds(1),
            Sha256 = H(102 + offset), PreviousSha256 = owned.Sha256 };
        return new(arm, true, true, intent, owned, complete);
    }

    private static StandardCryptoEvidence Good() => new(Scope(), true, true,
        Journal(StandardCryptoArm.Restricted, 0), Journal(StandardCryptoArm.UserAccessible, 3),
        Stage(StandardCryptoStage.Setup, 0), Stage(StandardCryptoStage.GuardianBefore, 1),
        Stage(StandardCryptoStage.StandardUser, 2), Stage(StandardCryptoStage.GuardianAfter, 3));

    private static StandardCryptoEvidence ChangeStage(StandardCryptoEvidence e, int stage,
        Func<StandardCryptoCollectedStage, StandardCryptoCollectedStage> change) => stage switch {
            0 => e with { Setup = change(e.Setup!) }, 1 => e with { GuardianBefore = change(e.GuardianBefore!) },
            2 => e with { StandardUser = change(e.StandardUser!) }, 3 => e with { GuardianAfter = change(e.GuardianAfter!) },
            _ => throw new InvalidDataException("STANDARD_CRYPTO_TEST_STAGE_REFUSED")
        };

    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_CRYPTO_TEST_FAILED_" + cases); cases++; }
        StandardCryptoComparisonResult Evaluate(StandardCryptoEvidence? e) => StandardCryptoComparison.Evaluate(e);
        void Outcome(StandardCryptoEvidence? e, string wanted, string? reason = null) {
            var result = Evaluate(e);
            StandardContract.Need(result.Outcome == wanted && (reason is null || result.Reason == reason),
                "STANDARD_CRYPTO_EXPECTED_" + wanted + "_ACTUAL_" + result.Outcome + "_" + result.Reason + "_CASE_" + cases);
            Check(result.Outcome == wanted && (reason is null || result.Reason == reason));
            Check(result.RestrictedObservation == e?.StandardUser?.Report?.RestrictedOperation);
        }
        void Refused(StandardCryptoEvidence e) => Outcome(e, "INPUT_REFUSED");
        var good = Good();
        Outcome(good, "BOUNDED_BAD_KEYSET_OBSERVED");
        var baseline = Evaluate(good);
        Check(baseline.PureInterpretationOnly && !baseline.MetadataAuthenticated && !baseline.PhysicalExecutionEnabled &&
            !baseline.StandardUserLogonTested && !baseline.Lic008Closed && !baseline.SecurityAccepted && !baseline.ProductionAccepted);
        Check(StandardCryptoComparison.DerivedServiceSid(StandardContract.SetupService) == StandardCryptoComparison.SetupSid);
        Check(StandardCryptoComparison.DerivedServiceSid(StandardContract.GuardianService) == StandardCryptoComparison.GuardianSid);
        Check(StandardCryptoComparison.KeyName(Scope().Attempt, StandardCryptoArm.Restricted) !=
            StandardCryptoComparison.KeyName(Scope().Attempt, StandardCryptoArm.UserAccessible));
        foreach (string? attempt in new string?[] { null, "", new('0', 31), new('0', 33), new('A', 32), new('g', 32), new('\0', 32), new string('0', 31) + "\n" }) {
            bool refused = false;
            try { StandardCryptoComparison.KeyName(attempt!, StandardCryptoArm.Restricted); } catch (InvalidDataException) { refused = true; }
            Check(refused);
        }
        try { StandardCryptoComparison.KeyName(Scope().Attempt, (StandardCryptoArm)99); Check(false); }
        catch (InvalidDataException) { Check(true); }

        var s = Scope();
        var scopeChanges = new Func<StandardCryptoScope, StandardCryptoScope>[] {
            x => x with { Schema = "TEST_ONLY_EXPORT_POLICY_CONTROL_V5" }, x => x with { Root = StandardContract.Root + "Old" },
            x => x with { Attempt = new('a', 32) }, x => x with { Attempt = new('A', 32) },
            x => x with { Attempt = x.Attempt + "\n" }, x => x with { AccountSid = StandardContract.OwnerSid },
            x => x with { AccountOwnedSha256 = StandardContract.AccountCompleteSha256 },
            x => x with { AccountCompleteSha256 = StandardContract.AccountOwnedSha256 },
            x => x with { OwnerSid = StandardContract.UserSid }, x => x with { PlanSha256 = H(800) },
            x => x with { ApprovalSha256 = H(801) }, x => x with { PackageSha256 = H(802) },
            x => x with { RuntimeSha256 = H(803) }, x => x with { ImageSha256 = H(804) },
            x => x with { AssemblySha256 = H(805) }, x => x with { HostSha256 = H(806) }, x => x with { BootSha256 = H(807) },
            x => x with { IssuedUtc = x.IssuedUtc.AddTicks(1) }, x => x with { ExpiresUtc = x.ExpiresUtc.AddTicks(-1) },
            x => x with { IssuedUtc = Start.ToOffset(TimeSpan.FromHours(1)) }, x => x with { ExpiresUtc = Start },
            x => x with { ExpiresUtc = Start.AddHours(2).AddTicks(1) }
        };
        foreach (var change in scopeChanges) {
            Refused(good with { Scope = change(s) });
            for (int stage = 0; stage < 4; stage++) {
                Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { Scope = change(s) } }));
                Refused(ChangeStage(good, stage, c => c with { ProcessProof = c.ProcessProof! with { Scope = change(s) } }));
            }
        }
        foreach (string? hash in new string?[] { null, "", new('0', 63), new('0', 65), new('A', 64), new('g', 64), new string('0', 63) + "\n" }) {
            Refused(good with { Scope = s with { PlanSha256 = hash! } });
            Refused(good with { Scope = s with { ApprovalSha256 = hash! } });
            Refused(good with { Scope = s with { HostSha256 = hash! } });
        }
        Refused(good with { FreshRootAndServicesAbsentBeforeCreate = false });
        Refused(good with { PlacementOwnershipVerified = false });
        Outcome(null, "UNKNOWN", "REPORT_MISSING");
        Outcome(good with { Setup = null }, "UNKNOWN", "REPORT_MISSING");

        var reportChanges = new Func<StandardCryptoReport, StandardCryptoReport>[] {
            r => r with { Stage = (StandardCryptoStage)99 }, r => r with { RunId = "bad" },
            r => r with { ProcessId = 0 }, r => r with { ProcessId = r.ProcessId + 1 },
            r => r with { CreationFileTimeUtc = 0 }, r => r with { CreationFileTimeUtc = r.CreationFileTimeUtc + 1 },
            r => r with { StartedUtc = Start.AddTicks(-1) }, r => r with { CompletedUtc = Start.AddHours(2) },
            r => r with { CompletedUtc = r.StartedUtc }, r => r with { StartedUtc = r.StartedUtc.ToOffset(TimeSpan.FromHours(1)) }
        };
        var proofChanges = new Func<StandardCryptoProcessProof, StandardCryptoProcessProof>[] {
            p => p with { Stage = (StandardCryptoStage)99 }, p => p with { ProcessId = p.ProcessId + 1 },
            p => p with { CreationFileTimeUtc = p.CreationFileTimeUtc + 1 },
            p => p with { ImagePath = @"C:\Temp\dotnet.exe" }, p => p with { ImagePath = p.ImagePath + "\n" },
            p => p with { ImageSha256 = H(910) }, p => p with { AssemblySha256 = H(911) },
            p => p with { PackageSha256 = H(912) }, p => p with { RuntimeSha256 = H(913) },
            p => p with { CollectedReportSha256 = H(914) }, p => p with { ExitCode = 1 }, p => p with { ExitCode = 259 },
            p => p with { AdmittedUtc = Start.AddTicks(-1) }, p => p with { AdmittedUtc = p.ExitObservedUtc },
            p => p with { ExitObservedUtc = Start }, p => p with { ExitObservedUtc = Start.AddHours(2) },
            p => p with { CapturedToken = null }
        };
        var missingProofs = new Func<StandardCryptoProcessProof, StandardCryptoProcessProof>[] {
            p => p with { OriginalHandleHeldThroughExit = false }, p => p with { ImageAndLoadedCodeCustodyVerified = false },
            p => p with { TokenCapturedBeforeOperation = false }, p => p with { NoThreadImpersonation = false },
            p => p with { ExitObservedOnHeldHandle = false }
        };
        for (int stage = 0; stage < 4; stage++) {
            Outcome(ChangeStage(good, stage, c => c with { Report = null }), "UNKNOWN");
            Outcome(ChangeStage(good, stage, c => c with { ProcessProof = null }), "UNKNOWN");
            Outcome(ChangeStage(good, stage, c => c with { ProtectedOriginalCollected = false }), "UNKNOWN");
            Outcome(ChangeStage(good, stage, c => c with { OriginalReportBoundToProcess = false }), "UNKNOWN");
            foreach (var change in reportChanges) Refused(ChangeStage(good, stage, c => c with { Report = change(c.Report!) }));
            foreach (var change in proofChanges) Refused(ChangeStage(good, stage, c => c with { ProcessProof = change(c.ProcessProof!) }));
            foreach (var change in missingProofs) Outcome(ChangeStage(good, stage, c => c with { ProcessProof = change(c.ProcessProof!) }), "UNKNOWN");
            Refused(ChangeStage(good, stage, c => c with { OriginalReportSha256 = H(930) }));
            foreach (long created in new[] { long.MaxValue, Start.AddHours(-1).UtcDateTime.ToFileTimeUtc(), Start.AddSeconds(125).UtcDateTime.ToFileTimeUtc() })
                Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { CreationFileTimeUtc = created },
                    ProcessProof = c.ProcessProof! with { CreationFileTimeUtc = created } }));
        }
        foreach (var token in new[] {
            UserToken() with { User = StandardContract.OwnerSid }, UserToken() with { Owner = StandardContract.OwnerSid },
            UserToken() with { Type = 2 }, UserToken() with { Elevation = 1 }, UserToken() with { ElevationType = 3 },
            UserToken() with { IntegritySid = "S-1-16-12288" }, UserToken() with { HasRestrictions = true },
            UserToken() with { AppContainer = true }, UserToken() with { QueryComplete = false },
            UserToken() with { Groups = UserToken().Groups!.Append(new(StandardContract.Administrators, 16)).ToArray() },
            UserToken() with { Groups = new[] { new StandardGroup(StandardContract.Users, 7) } }
        }) Refused(ChangeStage(good, 2, c => c with { ProcessProof = c.ProcessProof! with { CapturedToken = token } }));
        Outcome(ChangeStage(good, 2, c => c with { ProcessProof = c.ProcessProof! with { SuspendedStandardProcessAdmittedBeforeResume = false } }), "UNKNOWN");
        Outcome(ChangeStage(good, 2, c => c with { ProcessProof = c.ProcessProof! with { StandardResumeCountWasOne = false } }), "UNKNOWN");
        for (int stage = 0; stage < 4; stage++) if (stage != 2) {
            foreach (var change in new Func<StandardToken, StandardToken>[] {
                t => t with { User = StandardContract.UserSid }, t => t with { Owner = StandardContract.OwnerSid },
                t => t with { Type = 2 }, t => t with { QueryComplete = false }, t => t with { HasRestrictions = true },
                t => t with { AppContainer = true }, t => t with { Groups = null },
                t => t with { Elevation = 0 }, t => t with { Elevation = 2 },
                t => t with { ElevationType = 0 }, t => t with { ElevationType = 2 }, t => t with { ElevationType = 3 },
                t => t with { IntegritySid = "S-1-16-4096" }, t => t with { IntegritySid = StandardContract.MediumIntegrity },
                t => t with { IntegritySid = "S-1-16-12288" }, t => t with { IntegritySid = StandardCryptoComparison.SystemIntegritySid + "\n" },
                t => t with { Groups = Array.Empty<StandardGroup>() },
                t => t with { Groups = t.Groups!.Where(g => g.Sid != StandardCryptoComparison.ServiceLogonSid).ToArray() },
                t => t with { Groups = t.Groups!.Select(g => g.Sid == StandardCryptoComparison.ServiceLogonSid ? g with { Attributes = 0 } : g).ToArray() },
                t => t with { Groups = t.Groups!.Select(g => g.Sid == StandardCryptoComparison.ServiceLogonSid ? g with { Attributes = 16 } : g).ToArray() },
                t => t with { Groups = t.Groups!.Append(new(StandardCryptoComparison.ServiceLogonSid, 7)).ToArray() },
                t => t with { Groups = t.Groups!.Append(new(StandardContract.Interactive, 7)).ToArray() },
                t => t with { Groups = t.Groups!.Append(new("S-1-5-2", 7)).ToArray() },
                t => t with { Groups = t.Groups!.Append(new("S-1-5-3", 7)).ToArray() },
                t => t with { Groups = t.Groups!.Append(null!).ToArray() },
                t => t with { Groups = new[] { new StandardGroup(t.User == StandardCryptoComparison.SystemSid
                    ? StandardCryptoComparison.SetupSid : StandardCryptoComparison.GuardianSid, 16) } }
            }) Refused(ChangeStage(good, stage, c => c with { ProcessProof = c.ProcessProof! with { CapturedToken = change(c.ProcessProof.CapturedToken!) } }));
        }
        // A virtual Guardian need not repeat its TokenUser in token groups.
        Outcome(ChangeStage(good, 1, c => c with { ProcessProof = c.ProcessProof! with {
            CapturedToken = ServiceToken(false) with { Groups = ServiceToken(false).Groups!.Append(new(StandardCryptoComparison.GuardianSid, 7)).ToArray() } } }), "BOUNDED_BAD_KEYSET_OBSERVED");

        // Every immutable key/profile/permission field is checked on creation
        // and on every reopened positive/control handle, not just on Setup.
        var keyChanges = new Func<StandardCryptoKey, StandardCryptoKey>[] {
            k => k with { Arm = (StandardCryptoArm)99 }, k => k with { Name = k.Name + "old" },
            k => k with { Provider = "Microsoft Platform Crypto Provider" }, k => k with { Algorithm = "ECDSA_P256" },
            k => k with { Bits = 2048 }, k => k with { Machine = false }, k => k with { Persisted = false },
            k => k with { Usage = 0 }, k => k with { Usage = 2 }, k => k with { ExportPolicy = 1 }, k => k with { ExportPolicy = 3 },
            k => k with { OwnerSid = StandardContract.OwnerSid }, k => k with { GroupSid = StandardContract.Users },
            k => k with { ProtectedDacl = false }, k => k with { Aces = null },
            k => k with { Aces = k.Aces!.Take(1).ToArray() }, k => k with { Aces = k.Aces!.Append(k.Aces![0]).ToArray() },
            k => k with { Aces = k.Aces!.Select((a, i) => i == 0 ? a with { Mask = 1 } : a).ToArray() },
            k => k with { Aces = k.Aces!.Select((a, i) => i == 0 ? a with { Flags = 16 } : a).ToArray() },
            k => k with { Aces = k.Aces!.Select((a, i) => i == 0 ? a with { Allow = false } : a).ToArray() },
            k => k with { Aces = k.Aces!.Select((a, i) => i == 0 ? a with { Callback = true } : a).ToArray() },
            k => k with { Aces = k.Aces!.Select((a, i) => i == 0 ? a with { Sid = StandardContract.OwnerSid } : a).ToArray() },
            k => k with { DescriptorSha256 = "bad" }, k => k with { PublicSha256 = H(999) }, k => k with { Envelope = null },
            k => k with { Envelope = k.Envelope! with { Cipher = "AES-128-CBC" } },
            k => k with { Envelope = k.Envelope! with { KeyWrap = "RSA-OAEP-SHA1" } },
            k => k with { Envelope = k.Envelope! with { KeyPublicSha256 = H(999) } },
            k => k with { Envelope = k.Envelope! with { EnvelopeSha256 = "bad" } },
            k => k with { Envelope = k.Envelope! with { SyntheticPlaintextSha256 = "bad" } }
        };
        foreach (var change in keyChanges) for (int stage = 0; stage < 4; stage++) {
            Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { AccessibleKey = change(c.Report.AccessibleKey!) } }));
            if (stage != 2) Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { RestrictedKey = change(c.Report.RestrictedKey!) } }));
        }
        foreach (StandardCryptoArm arm in Enum.GetValues<StandardCryptoArm>()) {
            var key = Key(arm);
            Check(StandardCryptoComparison.KeyValid(s, key, arm));
            Check(StandardCryptoComparison.KeyValid(s, key with { Aces = key.Aces!.Reverse().ToArray() }, arm));
            Check(StandardCryptoComparison.KeyValid(s, key with { Aces = key.Aces!.Select(a => a with { Mask = 0xd01f01ffu }).ToArray() }, arm));
            Check(!StandardCryptoComparison.KeyValid(s, key, arm == StandardCryptoArm.Restricted ? StandardCryptoArm.UserAccessible : StandardCryptoArm.Restricted));
        }
        Refused(ChangeStage(good, 0, c => c with { Report = c.Report! with {
            RestrictedKey = c.Report.AccessibleKey, AccessibleKey = c.Report.RestrictedKey } }));
        Refused(ChangeStage(good, 0, c => c with { Report = c.Report! with {
            RestrictedKey = c.Report.RestrictedKey! with { DescriptorSha256 = c.Report.AccessibleKey!.DescriptorSha256 } } }));
        Refused(ChangeStage(good, 0, c => c with { Report = c.Report! with {
            RestrictedKey = c.Report.RestrictedKey! with { PublicSha256 = c.Report.AccessibleKey!.PublicSha256,
                Envelope = c.Report.RestrictedKey.Envelope! with { KeyPublicSha256 = c.Report.AccessibleKey.PublicSha256 } } } }));

        StandardCryptoEvidence JournalChange(StandardCryptoEvidence e, bool accessible, Func<StandardCryptoJournal, StandardCryptoJournal> change) =>
            accessible ? e with { AccessibleJournal = change(e.AccessibleJournal!) } : e with { RestrictedJournal = change(e.RestrictedJournal!) };
        var journalChanges = new Func<StandardCryptoJournalRecord, StandardCryptoJournalRecord>[] {
            r => r with { Scope = r.Scope with { Attempt = new('a', 32) } }, r => r with { Arm = (StandardCryptoArm)99 },
            r => r with { Kind = "WRONG" }, r => r with { KeyName = r.KeyName + "old" },
            r => r with { WrittenUtc = Start }, r => r with { WrittenUtc = Start.AddHours(2) },
            r => r with { Sha256 = "bad" }, r => r with { PreviousSha256 = H(987) },
            r => r with { PublicSha256 = H(988) }, r => r with { DescriptorSha256 = H(989) },
            r => r with { Protected = false }, r => r with { DurablyFlushed = false }, r => r with { OriginalCollected = false }
        };
        foreach (bool accessible in new[] { false, true }) {
            Outcome(JournalChange(good, accessible, j => j with { Intent = null }), "UNKNOWN");
            Outcome(JournalChange(good, accessible, j => j with { Owned = null }), "UNKNOWN");
            Outcome(JournalChange(good, accessible, j => j with { Complete = null }), "UNKNOWN");
            Refused(JournalChange(good, accessible, j => j with { NameAbsentBeforeCreate = false }));
            Refused(JournalChange(good, accessible, j => j with { CreateMachineWithoutOverwrite = false }));
            Refused(JournalChange(good, accessible, j => j with { Arm = (StandardCryptoArm)99 }));
            foreach (var change in journalChanges) {
                Refused(JournalChange(good, accessible, j => j with { Intent = change(j.Intent!) }));
                Refused(JournalChange(good, accessible, j => j with { Owned = change(j.Owned!) }));
                Refused(JournalChange(good, accessible, j => j with { Complete = change(j.Complete!) }));
            }
            Refused(JournalChange(good, accessible, j => j with { Owned = j.Owned! with { WrittenUtc = j.Intent!.WrittenUtc } }));
            Refused(JournalChange(good, accessible, j => j with { Complete = j.Complete! with { WrittenUtc = j.Owned!.WrittenUtc } }));
        }
        Refused(good with { AccessibleJournal = good.RestrictedJournal });
        Refused(good with { RestrictedJournal = good.AccessibleJournal });

        StandardCryptoEvidence Restricted(StandardCryptoOperation operation, StandardCryptoKey? inspected = null) =>
            ChangeStage(good, 2, c => c with { Report = c.Report! with { RestrictedOperation = operation, RestrictedKey = inspected } });
        var raw = good.StandardUser!.Report!.RestrictedOperation!;
        var restrictedKey = Key(StandardCryptoArm.Restricted);
        foreach (string stage in new[] { "OPEN", "DECRYPT" }) {
            bool opened = stage == "DECRYPT";
            foreach (int hresult in new[] { StandardCryptoComparison.NtePermission, StandardCryptoComparison.Win32AccessDenied }) {
                var op = raw with { OperationStage = stage, KeyOpened = opened, ManagedHResult = hresult };
                Outcome(Restricted(op, opened ? restrictedKey : null), "BOUNDED_ACCESS_DENIED_OBSERVED");
                Outcome(Restricted(op with { NativeStatus = hresult }, opened ? restrictedKey : null), "BOUNDED_ACCESS_DENIED_OBSERVED");
            }
            Outcome(Restricted(raw with { OperationStage = stage, KeyOpened = opened }, opened ? restrictedKey : null), "BOUNDED_BAD_KEYSET_OBSERVED");
            Outcome(Restricted(raw with { OperationStage = stage, KeyOpened = opened, FailureCategory = "UNAUTHORIZED_ACCESS",
                ManagedHResult = StandardCryptoComparison.Win32AccessDenied }, opened ? restrictedKey : null), "BOUNDED_ACCESS_DENIED_OBSERVED");
        }
        foreach (var operation in new[] {
            raw with { ManagedHResult = unchecked((int)0x80090029) }, raw with { ManagedHResult = unchecked((int)0x8009000b) },
            raw with { ManagedHResult = -1 }, raw with { ManagedHResult = 0 }, raw with { ManagedHResult = int.MinValue },
            raw with { FailureCategory = "IO" }, raw with { FailureCategory = "EXCEPTION" },
            raw with { FailureCategory = "UNAUTHORIZED_ACCESS" }, raw with { NativeStatus = StandardCryptoComparison.NtePermission },
            raw with { ManagedHResult = null, NativeStatus = StandardCryptoComparison.NtePermission }
        }) Outcome(Restricted(operation), "RESTRICTED_OPERATION_UNCLASSIFIED");
        var openedOnly = raw with { Status = "OPENED_WITHOUT_DECRYPT", OperationStage = "OPEN", KeyOpened = true,
            FailureCategory = null, ManagedHResult = null, NativeStatus = null };
        Outcome(Restricted(openedOnly), "RESTRICTED_OPEN_SUCCEEDED_DECRYPT_NOT_TESTED");
        Refused(Restricted(openedOnly, restrictedKey));
        Outcome(Restricted(Decrypt(restrictedKey, raw.ObservedUtc), restrictedKey), "RESTRICTED_DECRYPT_SUCCEEDED");
        Outcome(Restricted(Decrypt(restrictedKey, raw.ObservedUtc) with { ObservedPlaintextSha256 = H(666) }, restrictedKey), "RESTRICTED_OPERATION_UNCLASSIFIED");
        Refused(Restricted(raw, restrictedKey));
        Outcome(Restricted(raw with { Status = "NOT_RUN", OperationStage = "NONE", FailureCategory = null,
            ManagedHResult = null }), "UNKNOWN", "RESTRICTED_OPERATION_NOT_RUN");
        foreach (int code in new[] { StandardCryptoComparison.BadKeyset, StandardCryptoComparison.NtePermission,
            StandardCryptoComparison.Win32AccessDenied, unchecked((int)0x80090029), -1 })
        foreach (string category in new[] { "CRYPTOGRAPHIC", "UNAUTHORIZED_ACCESS" }) {
            var inspectFailed = raw with { OperationStage = "INSPECT", KeyOpened = true,
                FailureCategory = category, ManagedHResult = code };
            Outcome(Restricted(inspectFailed), "RESTRICTED_OPERATION_UNCLASSIFIED", "RESTRICTED_INSPECTION_FAILED_AFTER_OPEN");
            Refused(Restricted(inspectFailed, restrictedKey));
            Refused(Restricted(inspectFailed with { KeyOpened = false }));
        }
        Refused(Restricted(raw with { OperationStage = "DECRYPT", KeyOpened = true }));

        var operationChanges = new Func<StandardCryptoOperation, StandardCryptoOperation>[] {
            o => o with { Arm = (StandardCryptoArm)99 }, o => o with { RequestedKeyName = o.RequestedKeyName + "old" },
            o => o with { RequestedPublicSha256 = H(990) }, o => o with { RequestedEnvelopeSha256 = H(991) },
            o => o with { Status = "DENIED" }, o => o with { OperationStage = "EXPORT" },
            o => o with { KeyOpened = !o.KeyOpened }, o => o with { ObservedUtc = Start },
            o => o with { ObservedUtc = Start.AddHours(2) }, o => o with { ObservedUtc = o.ObservedUtc.ToOffset(TimeSpan.FromHours(1)) }
        };
        foreach (var change in operationChanges) for (int stage = 1; stage < 4; stage++) {
            Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { RestrictedOperation = change(c.Report.RestrictedOperation!) } }));
            Refused(ChangeStage(good, stage, c => c with { Report = c.Report! with { AccessibleOperation = change(c.Report.AccessibleOperation!) } }));
        }
        Refused(Restricted(raw with { FailureCategory = "CryptographicException" }));
        Refused(Restricted(raw with { FailureCategory = null }));
        Refused(Restricted(raw with { ManagedHResult = null }));
        Refused(Restricted(raw with { ObservedPlaintextSha256 = H(16) }));
        Refused(Restricted(raw with { ObservedUtc = good.StandardUser.Report.AccessibleOperation!.ObservedUtc }));
        Refused(ChangeStage(good, 2, c => c with { Report = c.Report! with {
            AccessibleOperation = c.Report.RestrictedOperation, RestrictedOperation = c.Report.AccessibleOperation } }));
        Refused(ChangeStage(good, 0, c => c with { Report = c.Report! with { RestrictedOperation = raw } }));

        // Failure/NOT_RUN/open-only/wrong plaintext in any positive arm makes
        // this comparison inconclusive even if the restricted error looks ideal.
        for (int stage = 1; stage < 4; stage++) foreach (bool accessible in new[] { false, true }) {
            if (stage == 2 && !accessible) continue;
            StandardCryptoEvidence PositiveChange(Func<StandardCryptoOperation, StandardCryptoOperation> change,
                bool withoutInspection = false) =>
                ChangeStage(good, stage, c => c with { Report = accessible
                    ? c.Report! with { AccessibleOperation = change(c.Report.AccessibleOperation!),
                        AccessibleKey = withoutInspection ? null : c.Report.AccessibleKey }
                    : c.Report! with { RestrictedOperation = change(c.Report.RestrictedOperation!),
                        RestrictedKey = withoutInspection ? null : c.Report.RestrictedKey } });
            Outcome(PositiveChange(o => o with { ObservedPlaintextSha256 = H(777) }), "CONTROL_INCONCLUSIVE");
            Outcome(PositiveChange(o => o with { Status = "FAILED", FailureCategory = "CRYPTOGRAPHIC",
                ManagedHResult = StandardCryptoComparison.BadKeyset, ObservedPlaintextSha256 = null }), "CONTROL_INCONCLUSIVE");
            Outcome(PositiveChange(o => o with { Status = "OPENED_WITHOUT_DECRYPT", OperationStage = "OPEN",
                ObservedPlaintextSha256 = null }, true), "CONTROL_INCONCLUSIVE");
            Outcome(PositiveChange(o => o with { Status = "NOT_RUN", OperationStage = "NONE", KeyOpened = false,
                ObservedPlaintextSha256 = null }, true), "CONTROL_INCONCLUSIVE");
            Outcome(PositiveChange(o => o with { Status = "FAILED", OperationStage = "OPEN", KeyOpened = false,
                FailureCategory = "CRYPTOGRAPHIC", ManagedHResult = StandardCryptoComparison.BadKeyset,
                ObservedPlaintextSha256 = null }, true), "CONTROL_INCONCLUSIVE");
            Outcome(PositiveChange(o => o with { Status = "FAILED", OperationStage = "INSPECT", KeyOpened = true,
                FailureCategory = "UNAUTHORIZED_ACCESS", ManagedHResult = StandardCryptoComparison.Win32AccessDenied,
                ObservedPlaintextSha256 = null }, true), "CONTROL_INCONCLUSIVE");
            // Missing readback after a claimed completed inspection/decrypt is
            // inconsistent input, never a successful or denied control.
            Refused(PositiveChange(o => o, true));
            Refused(PositiveChange(o => o with { Status = "FAILED", FailureCategory = "CRYPTOGRAPHIC",
                ManagedHResult = StandardCryptoComparison.BadKeyset, ObservedPlaintextSha256 = null }, true));
            // A Setup copy cannot masquerade as fresh readback when no probe
            // inspection completed. These cover every positive/recheck arm.
            Refused(PositiveChange(o => o with { Status = "FAILED", OperationStage = "OPEN", KeyOpened = false,
                FailureCategory = "CRYPTOGRAPHIC", ManagedHResult = StandardCryptoComparison.BadKeyset,
                ObservedPlaintextSha256 = null }));
            Refused(PositiveChange(o => o with { Status = "FAILED", OperationStage = "INSPECT", KeyOpened = true,
                FailureCategory = "UNAUTHORIZED_ACCESS", ManagedHResult = StandardCryptoComparison.Win32AccessDenied,
                ObservedPlaintextSha256 = null }));
            Refused(PositiveChange(o => o with { Status = "NOT_RUN", OperationStage = "NONE", KeyOpened = false,
                ObservedPlaintextSha256 = null }));
            Refused(PositiveChange(o => o with { Status = "OPENED_WITHOUT_DECRYPT", OperationStage = "OPEN",
                ObservedPlaintextSha256 = null }));
        }

        // Reusing an original report, role run ID or held process cannot be
        // repaired by relabelling its stage; chronology also has its own gate.
        Refused(ChangeStage(good, 3, c => c with { Report = c.Report! with { RunId = good.GuardianBefore!.Report!.RunId } }));
        Refused(ChangeStage(good, 3, c => c with { OriginalReportSha256 = good.GuardianBefore!.OriginalReportSha256,
            ProcessProof = c.ProcessProof! with { CollectedReportSha256 = good.GuardianBefore.OriginalReportSha256 } }));
        Refused(good with { GuardianBefore = good.GuardianAfter, GuardianAfter = good.GuardianBefore });
        Refused(ChangeStage(good, 2, c => c with { ProcessProof = c.ProcessProof! with {
            AdmittedUtc = good.GuardianBefore!.ProcessProof!.ExitObservedUtc } }));
        Refused(ChangeStage(good, 1, c => c with { ProcessProof = c.ProcessProof! with {
            ExitObservedUtc = good.StandardUser!.Report!.StartedUtc } }));
        Check(Evaluate(good).RestrictedObservation!.ManagedHResult == unchecked((int)0x80090016));
        Check(Evaluate(good).RestrictedObservation!.NativeStatus is null);
        Check(Evaluate(good).Outcome != "ACCESS_DENIED" && Evaluate(good).Outcome != "MISSING_KEY_PROVED");
        return cases;
    }
}
