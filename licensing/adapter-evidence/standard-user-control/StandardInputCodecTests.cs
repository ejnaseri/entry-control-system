using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json.Nodes;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardInputCodecTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero);
    private static string H(int value) => value.ToString("x").PadLeft(64, '0');
    private static StandardPlanCore Plan() => new(1, StandardInputCodec.PlanPurpose,
        "0123456789abcdef0123456789abcdef", Start, Start.AddHours(2), StandardContract.Root,
        StandardContract.OwnerSid, H(1), H(2), StandardContract.AccountName, StandardContract.UserSid,
        StandardContract.AccountOwnedSha256, StandardContract.AccountCompleteSha256,
        StandardContract.SetupService, StandardCryptoComparison.SetupSid,
        StandardContract.GuardianService, StandardCryptoComparison.GuardianSid,
        StandardContract.KeyPrefix, StandardInputCodec.Effects, H(3), H(4), H(5), H(6),
        new[] { new StandardPayloadPin("StandardControl.dll", 12345, H(7)),
            new StandardPayloadPin("StandardControl.runtimeconfig.json", 135, H(8)) });
    private static StandardApprovalCore Approval(byte[] plan) => new(1, StandardInputCodec.ApprovalPurpose,
        Plan().Attempt, StandardNativeCryptoRules.Hash(plan), Start.AddMinutes(1), Start.AddHours(1),
        StandardContract.OwnerSid, H(1), H(2), StandardInputCodec.Effects);

    internal static int Run()
    {
        int cases = 0;
        void Check(bool ok) { StandardContract.Need(ok, "STANDARD_INPUT_TEST_FAILED_" + cases); cases++; }
        void Reject(Action work) {
            try { work(); } catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("STANDARD_INPUT_EXPECTED_REFUSAL_MISSING_" + cases);
        }
        var p = Plan(); byte[] pb = StandardInputCodec.EncodePlan(p);
        var a = Approval(pb); byte[] ab = StandardInputCodec.EncodeApproval(a);
        DateTimeOffset now = Start.AddMinutes(1);
        StandardBoundInput Bind(byte[]? plan = null, byte[]? approval = null, DateTimeOffset? at = null) =>
            StandardInputCodec.Bind(plan ?? pb, approval ?? ab, at ?? now);
        void BadPlan(StandardPlanCore plan) {
            byte[] bytes = StandardInputCodec.EncodePlan(plan);
            Reject(() => StandardInputCodec.Bind(bytes, StandardInputCodec.EncodeApproval(Approval(bytes)), now));
        }
        void RejectPlanBytes(byte[] bytes) => Reject(() => StandardInputCodec.Bind(bytes,
            StandardInputCodec.EncodeApproval(Approval(bytes)), now));
        var good = Bind();
        Check(good.Scope.PlanSha256 == StandardNativeCryptoRules.Hash(pb));
        Check(good.Scope.ApprovalSha256 == StandardNativeCryptoRules.Hash(ab));
        Check(good.Scope.AssemblySha256 == H(7) && good.Scope.PackageSha256 == H(4) && good.Scope.RuntimeSha256 == H(5));
        Check(good.Scope.IssuedUtc == a.IssuedUtc && good.Scope.ExpiresUtc == a.ExpiresUtc);
        Check(good.SourceSetSha256 == H(3) && !good.NativeAuthorized);
        Check(good.ConfirmationLine == "CONFIRM W03 " + p.Attempt + " " + good.Scope.PlanSha256 + " " +
            good.Scope.ApprovalSha256 + " " + StandardContract.UserSid);
        Check(Encoding.UTF8.GetString(pb).Contains("\"packageSha256\":", StringComparison.Ordinal));
        Check(!Encoding.UTF8.GetString(pb).Contains("\"planSha256\":", StringComparison.Ordinal) &&
            !Encoding.UTF8.GetString(pb).Contains("\"approvalSha256\":", StringComparison.Ordinal));
        Check(good.Plan.Payload is System.Collections.ObjectModel.ReadOnlyCollection<StandardPayloadPin>);
        byte[] callerPlan = (byte[])pb.Clone(), callerApproval = (byte[])ab.Clone();
        var independent = StandardInputCodec.Bind(callerPlan, callerApproval, now);
        Array.Clear(callerPlan); Array.Clear(callerApproval);
        Check(independent.Scope.PlanSha256 == good.Scope.PlanSha256 && independent.Scope.ApprovalSha256 == good.Scope.ApprovalSha256);
        Bind(at: a.ExpiresUtc.AddTicks(-1)); Check(true);
        foreach (var at in new[] { Start, now.AddTicks(-1), a.ExpiresUtc, a.ExpiresUtc.AddTicks(1), now.ToOffset(TimeSpan.FromHours(1)) })
            Reject(() => Bind(at: at));

        foreach (var bad in new[] {
            p with { SchemaVersion = 0 }, p with { SchemaVersion = 2 }, p with { Purpose = "TEST_ONLY_EXPORT_POLICY_CONTROL_V5" },
            p with { Attempt = new('A', 32) }, p with { Attempt = new('0', 31) }, p with { Attempt = p.Attempt + "\n" },
            p with { Root = StandardContract.Root + "\\.." }, p with { Root = StandardContract.Root + "\\" },
            p with { OwnerSid = StandardContract.UserSid }, p with { AccountName = "Owner" },
            p with { AccountSid = StandardContract.OwnerSid }, p with { AccountOwnedSha256 = p.AccountCompleteSha256 },
            p with { AccountCompleteSha256 = p.AccountOwnedSha256 }, p with { SetupService = p.GuardianService },
            p with { SetupSid = p.GuardianSid }, p with { GuardianService = p.SetupService }, p with { GuardianSid = p.SetupSid },
            p with { KeyPrefix = "Ecs.Lic008.ExportPolicyControlV5.TEST_ONLY." }, p with { EffectProfile = "REUSE_ACCOUNT_DELETE_KEYS" },
            p with { IssuedUtc = now.AddTicks(1) }, p with { ExpiresUtc = p.IssuedUtc },
            p with { ExpiresUtc = p.ExpiresUtc.AddTicks(1) }, p with { IssuedUtc = p.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) },
            p with { ExpiresUtc = p.ExpiresUtc.ToOffset(TimeSpan.FromHours(1)) }
        }) BadPlan(bad);
        foreach (string? bad in new string?[] { null, "", new('0', 63), new('0', 65), new('G', 64), H(1) + "\n" }) {
            BadPlan(p with { HostSha256 = bad! }); BadPlan(p with { BootSha256 = bad! });
            BadPlan(p with { SourceSetSha256 = bad! }); BadPlan(p with { PackageSha256 = bad! });
            BadPlan(p with { RuntimeSha256 = bad! }); BadPlan(p with { ImageSha256 = bad! });
        }
        foreach (var bad in new[] {
            a with { SchemaVersion = 0 }, a with { SchemaVersion = 2 }, a with { Purpose = StandardInputCodec.PlanPurpose },
            a with { Attempt = new('f', 32) }, a with { PlanSha256 = H(99) }, a with { OwnerSid = StandardContract.UserSid },
            a with { HostSha256 = H(9) }, a with { BootSha256 = H(9) }, a with { EffectProfile = "OTHER" },
            a with { IssuedUtc = Start.AddTicks(-1) }, a with { ExpiresUtc = p.ExpiresUtc.AddTicks(1) },
            a with { ExpiresUtc = a.IssuedUtc }, a with { IssuedUtc = now.AddTicks(1) },
            a with { IssuedUtc = a.IssuedUtc.ToOffset(TimeSpan.FromHours(1)) },
            a with { ExpiresUtc = a.ExpiresUtc.ToOffset(TimeSpan.FromHours(1)) }
        }) Reject(() => Bind(approval: StandardInputCodec.EncodeApproval(bad)));

        foreach (var payload in new System.Collections.Generic.IReadOnlyList<StandardPayloadPin>?[] {
            null, Array.Empty<StandardPayloadPin>(), p.Payload!.Take(1).ToArray(), p.Payload!.Concat(p.Payload!.Take(1)).ToArray(),
            p.Payload!.Reverse().ToArray(), new[] { p.Payload![0], p.Payload[0] }, new[] { p.Payload![0], null! }
        }) BadPlan(p with { Payload = payload });
        for (int which = 0; which < 2; which++) {
            foreach (var bad in new[] {
                p.Payload![which] with { Name = "../StandardControl.dll" }, p.Payload![which] with { Name = "StandardLaunch.dll" },
                p.Payload![which] with { Size = 0 }, p.Payload![which] with { Size = -1 },
                p.Payload![which] with { Size = which == 0 ? 4194305 : 4097 },
                p.Payload![which] with { Sha256 = "" }, p.Payload![which] with { Sha256 = H(1) + "\n" }
            }) { var pins = p.Payload!.ToArray(); pins[which] = bad; BadPlan(p with { Payload = pins }); }
        }

        foreach (bool planTarget in new[] { true, false }) {
            byte[] original = planTarget ? pb : ab;
            void RefuseBytes(byte[] bytes) {
                // Keep approval's hash current so decoder regressions cannot
                // hide behind a stale-plan-hash refusal later in Bind.
                if (planTarget) RejectPlanBytes(bytes); else Reject(() => Bind(approval: bytes));
            }
            foreach (var bytes in new[] {
                Array.Empty<byte>(), new byte[16385], Encoding.UTF8.GetBytes("null"), Encoding.UTF8.GetBytes("[]"),
                Encoding.UTF8.GetBytes("{}"), Encoding.UTF8.GetBytes("{"), original[..^1],
                original.Concat(new byte[] { 10 }).ToArray(), new byte[] { 32 }.Concat(original).ToArray(),
                new byte[] { 0xef, 0xbb, 0xbf }.Concat(original).ToArray(), original.Concat(new byte[] { 0 }).ToArray(),
                Encoding.UTF8.GetBytes(Encoding.UTF8.GetString(original).Replace("{", "{ ", StringComparison.Ordinal)),
                original[..^1].Concat(Encoding.UTF8.GetBytes(",\"unknown\":true}")).ToArray(),
                original[..^1].Concat(Encoding.UTF8.GetBytes(",\"purpose\":\"duplicate\"}")).ToArray(),
                original[..^1].Concat(Encoding.UTF8.GetBytes(",}")).ToArray(), new byte[] { 0xff, 0xfe, 0xfd }
            }) RefuseBytes(bytes);
            var node = JsonNode.Parse(original)!.AsObject();
            foreach (string key in node.Select(entry => entry.Key).ToArray()) {
                var missing = JsonNode.Parse(original)!.AsObject(); missing.Remove(key);
                RefuseBytes(Encoding.UTF8.GetBytes(missing.ToJsonString()));
                var wrongCase = JsonNode.Parse(original)!.AsObject(); var value = wrongCase[key]!.DeepClone(); wrongCase.Remove(key);
                wrongCase[char.ToUpperInvariant(key[0]) + key[1..]] = value;
                RefuseBytes(Encoding.UTF8.GetBytes(wrongCase.ToJsonString()));
            }
        }
        string planText = Encoding.UTF8.GetString(pb);
        string duplicatedNested = planText.Replace("\"name\":\"StandardControl.dll\"",
            "\"name\":\"StandardControl.dll\",\"name\":\"StandardControl.dll\"", StringComparison.Ordinal);
        RejectPlanBytes(Encoding.UTF8.GetBytes(duplicatedNested));
        string unknownNested = planText.Replace("\"name\":\"StandardControl.dll\"",
            "\"name\":\"StandardControl.dll\",\"extra\":1", StringComparison.Ordinal);
        RejectPlanBytes(Encoding.UTF8.GetBytes(unknownNested));
        string escapedDuplicate = planText[..^1] + ",\"purpo\\u0073e\":\"duplicate\"}";
        RejectPlanBytes(Encoding.UTF8.GetBytes(escapedDuplicate));
        foreach (bool planTarget in new[] { true, false }) {
            byte[] original = planTarget ? pb : ab;
            foreach (string key in JsonNode.Parse(original)!.AsObject().Select(x => x.Key).ToArray()) {
                var explicitNull = JsonNode.Parse(original)!.AsObject(); explicitNull[key] = null;
                byte[] changed = Encoding.UTF8.GetBytes(explicitNull.ToJsonString());
                if (planTarget) RejectPlanBytes(changed); else Reject(() => Bind(approval: changed));
            }
        }
        for (int which = 0; which < 2; which++) {
            foreach (string key in new[] { "name", "size", "sha256" }) {
                var missing = JsonNode.Parse(pb)!.AsObject(); missing["payload"]![which]!.AsObject().Remove(key);
                RejectPlanBytes(Encoding.UTF8.GetBytes(missing.ToJsonString()));
            }
        }
        // A semantically valid new plan cannot borrow the old approval.
        Reject(() => Bind(plan: StandardInputCodec.EncodePlan(p with { PackageSha256 = H(99) })));
        var callerPins = p.Payload!.ToArray();
        byte[] originalPins = StandardInputCodec.EncodePlan(p with { Payload = callerPins });
        var pinned = StandardInputCodec.Bind(originalPins, StandardInputCodec.EncodeApproval(Approval(originalPins)), now);
        callerPins[0] = callerPins[0] with { Sha256 = H(99) };
        Check(pinned.Plan.Payload![0].Sha256 == H(7) && pinned.Scope.AssemblySha256 == H(7));
        Reject(() => StandardInputCodec.Bind(null!, ab, now)); Reject(() => StandardInputCodec.Bind(pb, null!, now));
        return cases;
    }
}
