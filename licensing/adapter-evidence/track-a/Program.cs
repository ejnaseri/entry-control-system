using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Text;

namespace EntryControl.TestOnly;

internal static class Program
{
    private static readonly List<object> Results = new();
    private static string Hash(string path) => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path))).ToLowerInvariant();
    private static void Assert(bool value) { if (!value) throw new InvalidOperationException("TEST_FAILED"); }
    private static void Reject(Action action)
    {
        try { action(); } catch (FormatException) { return; } catch (ArgumentException) { return; }
        catch (InvalidOperationException) { return; }
        throw new Exception("REFUSAL_NOT_OBSERVED");
    }
    private static void Case(string id, Action test)
    {
        try { test(); Results.Add(new { id, status = "PASS", evidence = "PURE_TEST_ONLY" }); }
        catch { Results.Add(new { id, status = "FAIL", evidence = "PURE_TEST_ONLY" }); }
    }
    private static FixtureContext Context() => new(1, new byte[16], 1, new byte[32], new byte[32], new byte[32]);
    private static byte[] Envelope(FixtureContext c, int size = 1) => CandidateCodec.Encode(c, new byte[12], new byte[384], new byte[size], new byte[16]);
    private static void Tests()
    {
        var c = Context();
        Case("FEP-U01.min", () => Assert(CandidateCodec.SnapshotAndValidate(Envelope(c), c).Length == 551));
        Case("FEP-U01.max", () => Assert(CandidateCodec.SnapshotAndValidate(Envelope(c, CandidateCodec.MaxPayload), c).Length == CandidateCodec.MaxEnvelope));
        Case("FEP-U01.zero", () => Reject(() => Envelope(c, 0)));
        Case("FEP-U01.over", () => Reject(() => Envelope(c, CandidateCodec.MaxPayload + 1)));
        foreach (int length in new[] { 0, 7, 137, 533, 534, 550 })
            Case("FEP-U01.truncated." + length, () => Reject(() => CandidateCodec.SnapshotAndValidate(Envelope(c)[..length], c)));
        Case("FEP-U01.trailing", () => Reject(() => CandidateCodec.SnapshotAndValidate(Envelope(c).Concat(new byte[1]).ToArray(), c)));
        foreach (int offset in new[] { 0, 8, 10, 12, 13 })
            Case("FEP-U01.header." + offset, () => { var b = Envelope(c); b[offset] = 255; Reject(() => CandidateCodec.SnapshotAndValidate(b, c)); });
        Case("FEP-U01.length-overflow", () => { var b = Envelope(c); BinaryPrimitives.WriteUInt32BigEndian(b.AsSpan(134), uint.MaxValue); Reject(() => CandidateCodec.SnapshotAndValidate(b, c)); });
        Case("FEP-U01.counter-overflow", () => { var b = Envelope(c); BinaryPrimitives.WriteUInt64BigEndian(b.AsSpan(30), ulong.MaxValue); Reject(() => CandidateCodec.SnapshotAndValidate(b, c)); });
        var contexts = new[] { c with { Edition = 2 }, c with { Installation = Enumerable.Repeat((byte)1,16).ToArray() },
            c with { Generation = 2 }, c with { StateHash = Enumerable.Repeat((byte)1,32).ToArray() },
            c with { SpkiHash = Enumerable.Repeat((byte)1,32).ToArray() }, c with { ProfileHash = Enumerable.Repeat((byte)1,32).ToArray() } };
        for (int i = 0; i < contexts.Length; i++) { int n = i; Case("FEP-U02.context." + n, () => Reject(() => CandidateCodec.SnapshotAndValidate(Envelope(contexts[n]), c))); }
        Case("FEP-U02.snapshot", () => { var b = Envelope(c); var copy = CandidateCodec.SnapshotAndValidate(b,c); b[138]=99; Assert(copy[138]==0); });
        Case("FEP-U03.aad-size", () => Assert(CandidateCodec.Aad(Envelope(c)).Length == 554));
        // Independent contract fixture: literal field bytes, not codec constants,
        // header writers or decoder round trips. Different patterns expose shifts.
        var goldenContext = new FixtureContext(2, Enumerable.Range(0,16).Select(i => (byte)i).ToArray(),
            0x0102030405060708UL, Enumerable.Repeat((byte)0x11,32).ToArray(),
            Enumerable.Repeat((byte)0x22,32).ToArray(), Enumerable.Repeat((byte)0x33,32).ToArray());
        byte[] goldenHeader = Convert.FromHexString("4543535357303031000100010102" +
            "000102030405060708090A0B0C0D0E0F0102030405060708" +
            string.Concat(Enumerable.Repeat("11",32)) + string.Concat(Enumerable.Repeat("22",32)) +
            string.Concat(Enumerable.Repeat("33",32)) + "00000003" +
            string.Concat(Enumerable.Repeat("AA",12)) + string.Concat(Enumerable.Repeat("CC",384)));
        byte[] goldenEnvelope = CandidateCodec.Encode(goldenContext, Enumerable.Repeat((byte)0xAA,12).ToArray(),
            Enumerable.Repeat((byte)0xCC,384).ToArray(), new byte[] { 0xDE,0xAD,0xBE }, Enumerable.Repeat((byte)0xEE,16).ToArray());
        Case("FEP-U02.golden-envelope", () => Assert(goldenEnvelope.SequenceEqual(
            goldenHeader.Concat(Convert.FromHexString("DEADBE"+string.Concat(Enumerable.Repeat("EE",16)))).ToArray())));
        Case("FEP-U03.golden-aad", () => Assert(CandidateCodec.Aad(goldenEnvelope).SequenceEqual(
            Convert.FromHexString("454E5452595F434F4E54524F4C5F53595354454D").Concat(goldenHeader).ToArray())));
        Case("FEP-U03.memory-gcm-mutation", () =>
        {
            // Memory-only AES test, no RSA/KSP/private persisted key evidence.
            byte[] key = RandomNumberGenerator.GetBytes(32), nonce = RandomNumberGenerator.GetBytes(12);
            byte[] plain = RandomNumberGenerator.GetBytes(32), cipher = new byte[32], tag = new byte[16], opened = new byte[32];
            try
            {
                using var aes = new AesGcm(key,16); var fixture = CandidateCodec.Encode(c,nonce,new byte[384],cipher,tag);
                aes.Encrypt(nonce,plain,cipher,tag,CandidateCodec.Aad(fixture));
                var valid = CandidateCodec.Encode(c,nonce,new byte[384],cipher,tag);
                aes.Decrypt(nonce,cipher,tag,opened,CandidateCodec.Aad(valid)); Assert(plain.SequenceEqual(opened));
                foreach (int offset in new[] { 138,150,534,valid.Length-1 })
                {
                    var bad = (byte[])valid.Clone(); bad[offset] ^= 1;
                    bool refused = false;
                    try { aes.Decrypt(bad.AsSpan(138,12),bad.AsSpan(534,32),bad.AsSpan(566,16),opened,CandidateCodec.Aad(bad)); }
                    catch (CryptographicException) { refused = true; }
                    finally { CryptographicOperations.ZeroMemory(opened); }
                    Assert(refused);
                }
            }
            finally { CryptographicOperations.ZeroMemory(key); CryptographicOperations.ZeroMemory(plain); CryptographicOperations.ZeroMemory(opened); }
        });
        Case("FEP-U04.not-rollback-proof", () => Assert(CandidateCodec.SnapshotAndValidate(Envelope(c),c).Length == 551));
        Case("FEP-U05.unknown", () => Assert(FailureModel.Classify(Cause.Unknown,true,false)=="ADP-F06"));
        Case("FEP-U05.readiness", () => Assert(FailureModel.Classify(Cause.Unknown,true,true)=="ADP-F07"));
        Case("FEP-U05.absence", () => Assert(FailureModel.Classify(Cause.ProvenAbsence,true,false)=="ADP-F01"));
        Case("FEP-U05.no-retained-proof", () => Assert(FailureModel.Classify(Cause.ProvenAbsence,false,false)=="ADP-F06"));
        Case("FEP-U05.identity", () => Assert(FailureModel.Classify(Cause.IdentityMismatch,true,false)=="ADP-F02"));
        Case("FEP-U05.outage", () => Assert(FailureModel.Classify(Cause.ProvenProviderOutage,true,false)=="ADP-F03"));
        Case("FEP-U05.authority", () => Assert(FailureModel.Classify(Cause.AuthorityRefused,true,false)=="ADP-F04"));
        Case("FEP-U05.context", () => Assert(FailureModel.Classify(Cause.ContextRefused,true,false)=="ADP-F05"));
        Case("FEP-U05.primitive-not-durable", () => Assert(FailureModel.Classify(Cause.PrimitiveSuccess,true,false)=="ADP-F08"));
        Case("FEP-U06.late-worker", () => { var w=new SimulatedDeadline(); w.Start(); w.Expire(); Assert(!w.Cleared); Reject(w.Start); w.Complete(); Assert(w.Cleared && !w.Delivered && !w.Active); });
        Case("FEP-U06.expired-restart-refused", () => {
            var w=new SimulatedDeadline(); w.Start(); w.Expire(); w.Complete(); Reject(w.Start);
            Assert(!w.Active && w.Expired && w.Cleared && !w.Delivered);
        });
        Case("FEP-U06.completed-restart-refused", () => {
            var w=new SimulatedDeadline(); w.Start(); w.Complete(); Reject(w.Start);
            Assert(!w.Active && !w.Expired && w.Cleared && w.Delivered);
        });
        Case("FEP-U06.fresh-instance-after-expiry", () => {
            var old=new SimulatedDeadline(); old.Start(); old.Expire(); old.Complete();
            var fresh=new SimulatedDeadline(); fresh.Start(); Assert(fresh.Active && !fresh.Cleared && !fresh.Expired && !fresh.Delivered);
            fresh.Complete(); Assert(fresh.Cleared && fresh.Delivered && !fresh.Active && !fresh.Expired);
        });
        Case("FEP-U06.invalid-transitions-refused", () => {
            var w=new SimulatedDeadline(); Reject(w.Expire); Reject(w.Complete); w.Start(); Reject(w.Start);
            Assert(w.Active && !w.Cleared); w.Complete(); Reject(w.Expire); Reject(w.Complete);
            Assert(!w.Active && w.Cleared && w.Delivered);
        });
        foreach (var row in new[] {
            ("CONFLICT", "COMMIT_STATE_CONFLICT", "TRUSTED_RESPONSE_CONFLICT"),
            ("PENDING", "COMMIT_PENDING", "TRUSTED_RESPONSE_PENDING"),
            ("BAD_ACK", "COMMIT_ACKNOWLEDGEMENT_INVALID", "TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID"),
            ("THREW", "COMMIT_OUTCOME_UNKNOWN", "TRUSTED_RESPONSE_OUTCOME_UNKNOWN") })
            Case("FEP-U07." + row.Item1, () => { Assert(FailureModel.StoreError(false,row.Item1,true)==row.Item2); Assert(FailureModel.StoreError(true,row.Item1,true)==row.Item3); });
        Case("FEP-U07.confirm-exception", () => Assert(FailureModel.StoreError(false,"THREW",false)=="READ_ONLY_CONFIRMATION_UNAVAILABLE"));
        Case("FEP-U07.no-hybrid-confirm", () => Reject(() => FailureModel.StoreError(true,"THREW",false)));
        Case("FEP-U07.no-receipt", () => Reject(() => FailureModel.StoreError(false,"PRIMITIVE_SUCCESS",false)));
        string canary = "TRACK_A_SECRET_CANARY_63d9a7";
        string[] secrets = { canary, Convert.ToHexString(Encoding.UTF8.GetBytes(canary)), Convert.ToBase64String(Encoding.UTF8.GetBytes(canary)) };
        foreach (string secret in secrets)
        {
            // Deliberately hostile nested raw-input and provider failure fixtures.
            Case("FEP-U08.rejected-input." + Array.IndexOf(secrets,secret), () => {
                var text = DiagnosticModel.Capture(() => throw new FormatException(secret, new Exception(secret)));
                DiagnosticModel.Validate(text); Assert(!text.Contains(secret,StringComparison.Ordinal));
                Assert(text.Contains("INPUT_REFUSED",StringComparison.Ordinal));
            });
            Case("FEP-U08.provider-failure." + Array.IndexOf(secrets,secret), () => {
                var error = new Exception(secret, new Exception(secret));
                error.Data[secret] = new object[] { new { rawInput = secret }, secret };
                var text = DiagnosticModel.Capture(() => throw error);
                DiagnosticModel.Validate(text); Assert(!text.Contains(secret,StringComparison.Ordinal));
                Assert(text.Contains("ADP-F06",StringComparison.Ordinal));
            });
        }
        Case("FEP-U08.success-no-authority", () => DiagnosticModel.Validate(DiagnosticModel.Capture(() => {})));
        Case("FEP-U08.nested-property-refused", () => Reject(() => DiagnosticModel.Validate(
            DiagnosticModel.Emit(DiagnosticOutcome.UnknownFailure).Replace("\"code\":", "\""+canary+"\":\"secret\",\"code\":"))));
        Case("FEP-U08.nested-value-refused", () => Reject(() => DiagnosticModel.Validate(
            DiagnosticModel.Emit(DiagnosticOutcome.UnknownFailure).Replace("ADP-F06",canary))));
        Case("FEP-U08.duplicate-property-refused", () => Reject(() => DiagnosticModel.Validate(
            DiagnosticModel.Emit(DiagnosticOutcome.UnknownFailure).Replace("\"code\":", "\"code\":\"ADP-F06\",\"code\":"))));
        Case("FEP-U08.extra-array-entry-refused", () => Reject(() => DiagnosticModel.Validate(
            DiagnosticModel.Emit(DiagnosticOutcome.UnknownFailure).Replace("[{", "[{\"code\":\"ADP-F06\"},{"))));
        Case("FEP-U08.undefined-outcome-refused", () => Reject(() => DiagnosticModel.Emit((DiagnosticOutcome)999)));
    }
    internal static int Main(string[] args)
    {
        if (!args.SequenceEqual(new[] { "--self-test" })) { Console.Error.WriteLine("TRACK_A_SELF_TEST_ONLY"); return 2; }
        var watch = Stopwatch.StartNew(); Tests();
        var json = JsonSerializer.Serialize(new { schemaVersion=1,scope="TEST_ONLY_ADAPTER_TRACK_A_PURE",artifactVersion="0.1.2",
            loadedAssemblySha256=Hash(typeof(Program).Assembly.Location),executorExeSha256=Hash(Environment.ProcessPath!),
            runtime=Environment.Version.ToString(),architecture=RuntimeInformation.ProcessArchitecture.ToString(),
            osVersion=Environment.OSVersion.Version.ToString(),timeUtc=DateTime.UtcNow.ToString("O"),elapsedMs=watch.ElapsedMilliseconds,
            results=Results,durable=false,runtimeAuthority="NONE",nativeKspTested=false,physicalTested=false,securityAccepted=false,productionAccepted=false });
        Console.WriteLine(json);
        return json.Contains("\"status\":\"FAIL\"",StringComparison.Ordinal) ? 1 : 0;
    }
}
