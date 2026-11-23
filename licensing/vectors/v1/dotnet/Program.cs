using System.Text.Encodings.Web;
using System.Text.Json;

namespace EntryControl.GoldenVectors;

internal static class Program
{
    private const string FrozenProtocolManifestSha256 =
        "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";

    private const string ReportKind = "ENTRY_CONTROL_GOLDEN_VECTORS_V1";
    private const string TestOnlyKeyDerivation =
        "ENTRY_CONTROL_SYSTEM:TEST_ONLY_DO_NOT_TRUST:GOLDEN_VECTOR_KEY:V1:<KEY_ID>";

    private static readonly IReadOnlyDictionary<string, string> BasePositiveByType =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["activation-request"] = "pos-activation-activate-tpm",
            ["lease-request"] = "pos-lease-request-check-in",
            ["key-delegation"] = "pos-delegation-offline-entitlement",
            ["key-denylist"] = "pos-denylist-revision-1",
            ["entitlement"] = "pos-entitlement-initial-offline",
            ["lease"] = "pos-lease-initial-control",
            ["offline-control"] = "pos-control-vendor-suspend",
            ["reactivation-authorization"] = "pos-reactivation-authorization",
            ["recovery"] = "pos-recovery-clear-tamper",
            ["time-correction"] = "pos-time-correction",
        };

    internal static int Main(string[] args)
    {
        try
        {
            var options = CliOptions.Parse(args);
            var result = Run(options.VectorsRoot);
            var reportBytes = BuildReport(result);

            if (options.ReportPath is null)
            {
                using var output = Console.OpenStandardOutput();
                output.Write(reportBytes);
            }
            else
            {
                PackagePath.WriteNewReport(options.VectorsRoot, options.ReportPath, reportBytes);
            }

            Console.Error.WriteLine(
                $"ok - .NET verified {result.PositiveCount} positive, {result.BinaryNegativeCount} binary negative, " +
                $"{result.CrossTypeExecutedCount} executed cross-type, and {result.MalformedDeferredCount} deferred malformed records");
            return 0;
        }
        catch (Exception exception) when (exception is VectorFailure or IOException or UnauthorizedAccessException)
        {
            var code = exception is VectorFailure failure ? failure.Code : "IO_FAILURE";
            Console.Error.WriteLine($"not ok - {code}: {exception.Message}");
            return 1;
        }
    }

    private static RunResult Run(string vectorsRoot)
    {
        RunCborOrderingSelfTest();
        var indexPath = PackagePath.Resolve(vectorsRoot, "vectors-index.json");
        var indexBytes = PackagePath.Read(indexPath, 4 * 1024 * 1024, "INDEX_READ");
        var indexSha256 = CoseVerifier.HashHex(indexBytes);
        using var indexDocument = JsonContract.ParseCanonicalAsciiJson(indexBytes, "INDEX_JSON");
        var index = indexDocument.RootElement;
        JsonContract.RequireExactProperties(
            index,
            "INDEX_CONTRACT",
            "schemaVersion",
            "protocolVersion",
            "reportKind",
            "nonProductionOnly",
            "protocolManifestSha256",
            "keyDerivation",
            "keys",
            "positive",
            "criticalNegative",
            "descriptorCorpora");

        if (JsonContract.Integer(index, "schemaVersion", "INDEX_SCHEMA_VERSION") != 1 ||
            JsonContract.Integer(index, "protocolVersion", "INDEX_PROTOCOL_VERSION") != 1 ||
            !StringComparer.Ordinal.Equals(JsonContract.String(index, "reportKind", "INDEX_REPORT_KIND"), ReportKind) ||
            !JsonContract.Boolean(index, "nonProductionOnly", "INDEX_TRUST_CLASS") ||
            !StringComparer.Ordinal.Equals(
                JsonContract.String(index, "keyDerivation", "INDEX_KEY_DERIVATION"),
                TestOnlyKeyDerivation))
        {
            throw new VectorFailure("INDEX_METADATA");
        }

        var protocolManifestSha256 = JsonContract.Sha256(
            index,
            "protocolManifestSha256",
            "INDEX_PROTOCOL_MANIFEST_HASH");
        if (!StringComparer.Ordinal.Equals(protocolManifestSha256, FrozenProtocolManifestSha256))
        {
            throw new VectorFailure("INDEX_PROTOCOL_MANIFEST_HASH");
        }

        ValidateIndexedPathInventory(index);
        var keys = LoadKeys(index, vectorsRoot);
        var executed = new List<ExecutedRecord>();
        var signedPositiveById = new Dictionary<string, SignedPositive>(StringComparer.Ordinal);
        var carrierPositives = new List<CarrierPositive>();
        var positiveIds = new HashSet<string>(StringComparer.Ordinal);
        var signedScenarioCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var carrierScenarioCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var signedPositiveCount = 0;
        var carrierPositiveCount = 0;
        string? previousPositiveId = null;

        foreach (var positive in JsonContract.Array(index, "positive", "INDEX_POSITIVE"))
        {
            var id = JsonContract.Id(positive, "id", "POSITIVE_ID");
            if (!positiveIds.Add(id))
            {
                throw new VectorFailure("POSITIVE_DUPLICATE_ID");
            }

            RequireAscending(previousPositiveId, id, "POSITIVE_ORDER");
            previousPositiveId = id;

            JsonContract.RequireExactProperties(
                positive,
                "POSITIVE_CONTRACT",
                "id",
                "kind",
                "tokenType",
                "carrierType",
                "variant",
                "mediaType",
                "path",
                "bytes",
                "sha256",
                "protectedSha256",
                "payloadSha256",
                "sigStructureSha256",
                "signatureSha256",
                "signerKeyId",
                "signerKeyIdHex",
                "expected");
            var kind = JsonContract.String(positive, "kind", "POSITIVE_KIND");
            var expected = ExpectedResult.Parse(positive, "POSITIVE_EXPECTED");
            if (expected is not { Decision: "ACCEPT", Stage: "COMPLETE", ErrorCode: "NONE" })
            {
                throw new VectorFailure("POSITIVE_EXPECTED");
            }

            var variant = JsonContract.String(positive, "variant", "POSITIVE_VARIANT");
            if (!StringComparer.Ordinal.Equals(variant, ExpectedVariant(id)))
            {
                throw new VectorFailure("POSITIVE_VARIANT");
            }

            var bytes = ReadIndexedBlob(
                vectorsRoot,
                positive,
                "POSITIVE",
                $"fixtures/positive/{id}.cbor");
            if (kind == "SIGNED_OBJECT")
            {
                signedPositiveCount++;
                RequireNull(positive, "carrierType", "POSITIVE_CARRIER_TYPE");
                var tokenType = JsonContract.String(positive, "tokenType", "POSITIVE_TOKEN_TYPE");
                var mediaType = JsonContract.String(positive, "mediaType", "POSITIVE_MEDIA_TYPE");
                if (!StringComparer.Ordinal.Equals(mediaType, ExactMediaType(tokenType)))
                {
                    throw new VectorFailure("POSITIVE_MEDIA_TYPE");
                }

                Increment(signedScenarioCounts, tokenType);
                var signed = ValidateSignedPositive(id, positive, bytes, keys, expected);
                if (!signedPositiveById.TryAdd(id, signed))
                {
                    throw new VectorFailure("POSITIVE_DUPLICATE_ID");
                }

                executed.Add(signed.Executed);
            }
            else if (kind == "CARRIER")
            {
                carrierPositiveCount++;
                RequireNull(positive, "tokenType", "POSITIVE_TOKEN_TYPE");
                var carrierType = JsonContract.String(positive, "carrierType", "POSITIVE_CARRIER_TYPE");
                var mediaType = JsonContract.String(positive, "mediaType", "POSITIVE_MEDIA_TYPE");
                Increment(carrierScenarioCounts, carrierType);
                RequireEmptyString(positive, "protectedSha256", "CARRIER_METADATA");
                RequireEmptyString(positive, "payloadSha256", "CARRIER_METADATA");
                RequireEmptyString(positive, "sigStructureSha256", "CARRIER_METADATA");
                RequireEmptyString(positive, "signatureSha256", "CARRIER_METADATA");
                RequireNull(positive, "signerKeyId", "CARRIER_METADATA");
                RequireEmptyString(positive, "signerKeyIdHex", "CARRIER_METADATA");
                carrierPositives.Add(new CarrierPositive(
                    id,
                    bytes,
                    carrierType,
                    variant,
                    mediaType,
                    expected));
            }
            else
            {
                throw new VectorFailure("POSITIVE_KIND");
            }
        }

        if (signedPositiveCount != 35 || carrierPositiveCount != 6 || positiveIds.Count != 41)
        {
            throw new VectorFailure("POSITIVE_SCENARIO_COUNT");
        }

        RequireExactCounts(
            signedScenarioCounts,
            new Dictionary<string, int>(StringComparer.Ordinal)
            {
                ["activation-request"] = 8,
                ["lease-request"] = 4,
                ["key-delegation"] = 4,
                ["key-denylist"] = 2,
                ["entitlement"] = 5,
                ["lease"] = 4,
                ["offline-control"] = 3,
                ["reactivation-authorization"] = 1,
                ["recovery"] = 3,
                ["time-correction"] = 1,
            },
            "SIGNED_SCENARIO_DISTRIBUTION");
        RequireExactCounts(
            carrierScenarioCounts,
            new Dictionary<string, int>(StringComparer.Ordinal)
            {
                ["lease-challenge"] = 1,
                ["lease-response"] = 4,
                ["trust-bundle"] = 1,
            },
            "CARRIER_SCENARIO_DISTRIBUTION");

        var signedPositiveByHash = new Dictionary<string, SignedPositive>(StringComparer.Ordinal);
        foreach (var signed in signedPositiveById.Values)
        {
            if (!signedPositiveByHash.TryAdd(signed.Executed.InputSha256, signed))
            {
                throw new VectorFailure("POSITIVE_DUPLICATE_HASH");
            }
        }

        foreach (var carrier in carrierPositives)
        {
            CarrierVerifier.Verify(
                carrier.Id,
                carrier.Bytes,
                carrier.CarrierType,
                carrier.Variant,
                carrier.MediaType,
                keys,
                signedPositiveById,
                signedPositiveByHash);
            executed.Add(ExecutedRecord.EmptyComponents(
                carrier.Id,
                carrier.Expected.Decision,
                carrier.Expected.Stage,
                carrier.Expected.ErrorCode,
                CoseVerifier.HashHex(carrier.Bytes)));
        }

        var negativeIds = new HashSet<string>(StringComparer.Ordinal);
        var negativeDescriptorTypePairs = new HashSet<string>(StringComparer.Ordinal);
        var binaryNegativeById = new Dictionary<string, BinaryNegativeMetadata>(StringComparer.Ordinal);
        var binaryNegativeCount = 0;
        string? previousNegativeId = null;
        foreach (var negative in JsonContract.Array(index, "criticalNegative", "INDEX_CRITICAL_NEGATIVE"))
        {
            binaryNegativeCount++;
            var id = JsonContract.Id(negative, "id", "NEGATIVE_ID");
            if (!negativeIds.Add(id) || positiveIds.Contains(id))
            {
                throw new VectorFailure("NEGATIVE_DUPLICATE_ID");
            }

            RequireAscending(previousNegativeId, id, "NEGATIVE_ORDER");
            previousNegativeId = id;
            JsonContract.RequireExactProperties(
                negative,
                "NEGATIVE_CONTRACT",
                "id",
                "sourceDescriptorId",
                "basePositiveId",
                "tokenType",
                "mediaType",
                "signerKeyId",
                "signerKeyIdHex",
                "path",
                "bytes",
                "sha256",
                "expected");
            var sourceDescriptorId = JsonContract.Id(
                negative,
                "sourceDescriptorId",
                "NEGATIVE_SOURCE_DESCRIPTOR");

            var expected = ExpectedResult.Parse(negative, "NEGATIVE_EXPECTED");
            if (expected.Decision != "REJECT")
            {
                throw new VectorFailure("NEGATIVE_EXPECTED");
            }

            var bytes = ReadIndexedBlob(
                vectorsRoot,
                negative,
                "NEGATIVE",
                $"fixtures/negative/{id}.cbor");
            var basePositiveId = JsonContract.Id(negative, "basePositiveId", "NEGATIVE_BASE_POSITIVE");
            if (!signedPositiveById.TryGetValue(basePositiveId, out var signedBase))
            {
                throw new VectorFailure("NEGATIVE_BASE_POSITIVE");
            }

            var signerKeyId = JsonContract.Id(negative, "signerKeyId", "NEGATIVE_SIGNER_KEY");
            var signerKeyIdHex = JsonContract.Sha256(negative, "signerKeyIdHex", "NEGATIVE_SIGNER_KID");
            if (!keys.ById.TryGetValue(signerKeyId, out var negativeKey) ||
                !StringComparer.Ordinal.Equals(negativeKey.KidHex, signerKeyIdHex))
            {
                throw new VectorFailure("NEGATIVE_SIGNER_KEY");
            }

            var objectType = JsonContract.String(negative, "tokenType", "NEGATIVE_TOKEN_TYPE");
            var mediaType = JsonContract.String(negative, "mediaType", "NEGATIVE_MEDIA_TYPE");
            if (!StringComparer.Ordinal.Equals(objectType, signedBase.Expectation.ObjectType) ||
                !StringComparer.Ordinal.Equals(mediaType, ExactMediaType(objectType)) ||
                !negativeDescriptorTypePairs.Add(sourceDescriptorId + "\0" + objectType))
            {
                throw new VectorFailure("NEGATIVE_SOURCE_DESCRIPTOR");
            }

            var negativeExpectation = signedBase.Expectation with
            {
                ObjectType = objectType,
                MediaType = mediaType,
                SignerKeyIdHex = signerKeyIdHex,
                RequiredPurpose = RequiredPurpose(objectType),
                ProtectedSha256 = string.Empty,
                PayloadSha256 = string.Empty,
                SigStructureSha256 = string.Empty,
                SignatureSha256 = string.Empty,
            };

            string actualErrorCode;
            var actualStage = string.Empty;
            try
            {
                _ = CoseVerifier.Verify(
                    bytes,
                    keys.ByKid,
                    negativeExpectation,
                    compareExpectedComponentHashes: false);
                actualErrorCode = "NEGATIVE_ACCEPTED";
                actualStage = "HARNESS";
            }
            catch (VectorFailure failure)
            {
                actualErrorCode = failure.Code;
                actualStage = failure.Stage;
            }

            if (!StringComparer.Ordinal.Equals(actualErrorCode, expected.ErrorCode) ||
                !StringComparer.Ordinal.Equals(actualStage, expected.Stage))
            {
                throw new VectorFailure($"NEGATIVE_VERDICT_MISMATCH:{id}:{actualStage}:{actualErrorCode}");
            }

            executed.Add(ExecutedRecord.EmptyComponents(
                id,
                expected.Decision,
                expected.Stage,
                expected.ErrorCode,
                CoseVerifier.HashHex(bytes)));
            var metadata = new BinaryNegativeMetadata(
                id,
                sourceDescriptorId,
                basePositiveId,
                objectType,
                mediaType,
                $"fixtures/negative/{id}.cbor",
                CoseVerifier.HashHex(bytes),
                expected);
            if (!binaryNegativeById.TryAdd(id, metadata))
            {
                throw new VectorFailure("NEGATIVE_DUPLICATE_ID");
            }
        }

        if (binaryNegativeCount != 42 || binaryNegativeById.Count != 42)
        {
            throw new VectorFailure("NEGATIVE_SCENARIO_COUNT");
        }

        var coverage = CoverageValidator.Validate(
            index,
            vectorsRoot,
            signedPositiveById,
            BasePositiveByType,
            binaryNegativeById);
        var executedCrossTypeCount = ExecuteCrossType(
            coverage.CrossTypeRecords,
            signedPositiveById,
            keys,
            executed);
        if (executed.Count != 173 || executedCrossTypeCount != 90 || coverage.MalformedDeferredCount != 702)
        {
            throw new VectorFailure("EXECUTED_SCENARIO_COUNT");
        }

        executed.Sort(static (left, right) => StringComparer.Ordinal.Compare(left.Id, right.Id));
        if (executed.Select(record => record.Id).Distinct(StringComparer.Ordinal).Count() != executed.Count)
        {
            throw new VectorFailure("EXECUTED_DUPLICATE_ID");
        }

        return new RunResult(
            protocolManifestSha256,
            indexSha256,
            signedPositiveCount + carrierPositiveCount,
            binaryNegativeCount,
            coverage.MalformedExpandedCount,
            coverage.CrossTypeCount,
            coverage.MalformedDeferredCount,
            executedCrossTypeCount,
            executed,
            coverage.MalformedExpandedSha256,
            coverage.CrossTypeSha256);
    }

    private static void ValidateIndexedPathInventory(JsonElement index)
    {
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(JsonElement entry, string field)
        {
            var path = JsonContract.RelativePath(entry, field, "PACKAGE_PATH_COLLISION");
            if (!paths.Add(path))
            {
                throw new VectorFailure("PACKAGE_PATH_COLLISION");
            }
        }

        foreach (var key in JsonContract.Array(index, "keys", "PACKAGE_PATH_COLLISION"))
        {
            Add(key, "spkiPath");
        }

        foreach (var positive in JsonContract.Array(index, "positive", "PACKAGE_PATH_COLLISION"))
        {
            Add(positive, "path");
        }

        foreach (var negative in JsonContract.Array(index, "criticalNegative", "PACKAGE_PATH_COLLISION"))
        {
            Add(negative, "path");
        }

        var corpora = JsonContract.Property(index, "descriptorCorpora", "PACKAGE_PATH_COLLISION");
        Add(corpora, "malformedPath");
        Add(corpora, "crossTypePath");
    }

    private static int ExecuteCrossType(
        IReadOnlyList<CrossTypeRecord> records,
        IReadOnlyDictionary<string, SignedPositive> signedPositiveById,
        TestKeyRegistry keys,
        ICollection<ExecutedRecord> executed)
    {
        var count = 0;
        foreach (var record in records)
        {
            if (!signedPositiveById.TryGetValue(record.BasePositiveId, out var source) ||
                !StringComparer.Ordinal.Equals(source.Expectation.ObjectType, record.SourceType) ||
                !StringComparer.Ordinal.Equals(source.Expectation.MediaType, record.SourceMediaType) ||
                !StringComparer.Ordinal.Equals(source.Executed.InputSha256, record.BaseCoseSha256) ||
                !StringComparer.Ordinal.Equals(record.TargetMediaType, ExactMediaType(record.TargetType)) ||
                record.Expected is not
                {
                    Decision: "REJECT",
                    Stage: "DOMAIN",
                    ErrorCode: "CROSS_TYPE_REJECTED",
                })
            {
                throw new VectorFailure($"CROSS_TYPE_EXECUTION_CONTRACT:{record.Id}");
            }

            var targetExpectation = source.Expectation with
            {
                ObjectType = record.TargetType,
                MediaType = record.TargetMediaType,
                RequiredPurpose = RequiredPurpose(record.TargetType),
                ProtectedSha256 = string.Empty,
                PayloadSha256 = string.Empty,
                SigStructureSha256 = string.Empty,
                SignatureSha256 = string.Empty,
            };

            string actualStage;
            string actualErrorCode;
            try
            {
                _ = CoseVerifier.Verify(
                    source.Bytes,
                    keys.ByKid,
                    targetExpectation,
                    compareExpectedComponentHashes: false,
                    crossType: true);
                actualStage = "HARNESS";
                actualErrorCode = "CROSS_TYPE_ACCEPTED";
            }
            catch (VectorFailure failure)
            {
                actualStage = failure.Stage;
                actualErrorCode = failure.Code;
            }

            if (!StringComparer.Ordinal.Equals(actualStage, record.Expected.Stage) ||
                !StringComparer.Ordinal.Equals(actualErrorCode, record.Expected.ErrorCode))
            {
                throw new VectorFailure(
                    $"CROSS_TYPE_VERDICT_MISMATCH:{record.Id}:{actualStage}:{actualErrorCode}");
            }

            executed.Add(ExecutedRecord.EmptyComponents(
                record.Id,
                record.Expected.Decision,
                record.Expected.Stage,
                record.Expected.ErrorCode,
                CoseVerifier.HashHex(source.Bytes)));
            count++;
        }

        return count;
    }

    private static string ExactMediaType(string tokenType)
    {
        _ = RequiredPurpose(tokenType);
        return $"application/vnd.entry-control.{tokenType}+cbor;v=1";
    }

    private static string ExpectedVariant(string id) => id switch
    {
        "pos-activation-activate-full" => "ACTIVATE_FULL_SOFTWARE_BOUND",
        "pos-activation-activate-tpm" => "ACTIVATE_TPM_ATTESTED",
        "pos-activation-control" => "CONTROL_NON_INITIAL",
        "pos-activation-reactivate" => "REACTIVATE",
        "pos-activation-rebind" => "REBIND_NEW_DEVICE_PROOF",
        "pos-activation-recover" => "RECOVER",
        "pos-activation-renew" => "RENEW_SOFTWARE_BOUND",
        "pos-activation-time-correct" => "TIME_CORRECT",
        "pos-carrier-lease-challenge" => "STANDARD",
        "pos-carrier-lease-response-complete" => "WITH_LEASE",
        "pos-carrier-lease-response-control-only" => "CONTROL_ONLY",
        "pos-carrier-lease-response-reactivation-only" => "REACTIVATION_ONLY",
        "pos-carrier-lease-response-time-recovery" => "WITH_LEASE",
        "pos-carrier-trust-bundle" => "STANDARD",
        "pos-control-request-unsuspend" => "REQUEST_BOUND_UNSUSPEND",
        "pos-control-vendor-revoke" => "VENDOR_INITIATED_REVOKE",
        "pos-control-vendor-suspend" => "VENDOR_INITIATED_SUSPEND",
        "pos-delegation-offline-control" => "OFFLINE_CONTROL",
        "pos-delegation-offline-entitlement" => "OFFLINE_ENTITLEMENT",
        "pos-delegation-online-lease" => "ONLINE_LEASE",
        "pos-delegation-recovery" => "RECOVERY",
        "pos-denylist-revision-1" => "REVISION_1",
        "pos-denylist-revision-2" => "REVISION_2_WITH_PREDECESSOR",
        "pos-entitlement-initial-full" => "GENERATION_1_FULL",
        "pos-entitlement-initial-hybrid" => "GENERATION_1_HYBRID",
        "pos-entitlement-initial-offline" => "GENERATION_1_OFFLINE",
        "pos-entitlement-reactivated" => "GENERATION_1_REACTIVATED",
        "pos-entitlement-renewal" => "GENERATION_2_RENEWAL",
        "pos-lease-full" => "ACTIVE_FULL",
        "pos-lease-initial-control" => "INITIAL_CONTROL_TUPLE",
        "pos-lease-positive-control" => "POSITIVE_SUSPENDED_CONTROL_TUPLE",
        "pos-lease-rebind-reference" => "ACTIVE_REBIND_REFERENCE",
        "pos-lease-request-check-in" => "CHECK_IN",
        "pos-lease-request-check-in-full" => "CHECK_IN_FULL",
        "pos-lease-request-check-in-rebind" => "CHECK_IN_WITH_REBIND_REFERENCE",
        "pos-lease-request-time-recovery" => "TIME_RECOVERY",
        "pos-reactivation-authorization" => "TERMINAL_LINEAGE_REPLACEMENT",
        "pos-recovery-clear-tamper" => "CLEAR_TAMPER",
        "pos-recovery-rebind-device" => "REBIND_DEVICE",
        "pos-recovery-repair-state" => "REPAIR_SECURE_STATE",
        "pos-time-correction" => "OFFLINE_TIME_CORRECTION",
        _ => throw new VectorFailure("POSITIVE_VARIANT"),
    };

    private static void RunCborOrderingSelfTest()
    {
        // Frozen v1 Core Deterministic ordering compares complete encoded key bytes.
        // 0x1818 (uint 24) therefore precedes 0x60 (empty tstr), despite being longer.
        _ = StrictCborReader.Parse(Convert.FromHexString("a21818006000"));
        try
        {
            _ = StrictCborReader.Parse(Convert.FromHexString("a26000181800"));
        }
        catch (VectorFailure failure) when (failure.Code == "CBOR_MAP_KEY_ORDER")
        {
            return;
        }

        throw new VectorFailure("CBOR_MAP_ORDER_SELF_TEST");
    }

    private static TestKeyRegistry LoadKeys(JsonElement index, string vectorsRoot)
    {
        var byId = new Dictionary<string, TestKey>(StringComparer.Ordinal);
        var byKid = new Dictionary<string, TestKey>(StringComparer.Ordinal);
        string? previousKeyId = null;

        foreach (var keyElement in JsonContract.Array(index, "keys", "INDEX_KEYS"))
        {
            JsonContract.RequireExactProperties(
                keyElement,
                "KEY_CONTRACT",
                "keyId",
                "purpose",
                "environment",
                "trustClass",
                "kidHex",
                "spkiPath",
                "spkiSha256");
            var keyId = JsonContract.Id(keyElement, "keyId", "KEY_ID");
            RequireAscending(previousKeyId, keyId, "KEY_ORDER");
            previousKeyId = keyId;
            var purpose = JsonContract.String(keyElement, "purpose", "KEY_PURPOSE");
            var environment = JsonContract.String(keyElement, "environment", "KEY_ENVIRONMENT");
            var trustClass = JsonContract.String(keyElement, "trustClass", "KEY_TRUST_CLASS");
            var kidHex = JsonContract.Sha256(keyElement, "kidHex", "KEY_KID");
            var spkiSha256 = JsonContract.Sha256(keyElement, "spkiSha256", "KEY_SPKI_HASH");
            var spkiPath = JsonContract.RelativePath(keyElement, "spkiPath", "KEY_SPKI_PATH");
            var expectedContract = ExpectedKeyContract(keyId);

            if (!StringComparer.Ordinal.Equals(purpose, expectedContract.Purpose) ||
                !StringComparer.Ordinal.Equals(environment, expectedContract.Environment) ||
                !StringComparer.Ordinal.Equals(trustClass, expectedContract.TrustClass) ||
                !StringComparer.Ordinal.Equals(
                    spkiPath,
                    $"keys/{keyId.ToLowerInvariant().Replace('_', '-')}.spki.der") ||
                !StringComparer.Ordinal.Equals(kidHex, spkiSha256))
            {
                throw new VectorFailure("KEY_TRUST_CLASS");
            }

            var der = PackagePath.Read(PackagePath.Resolve(vectorsRoot, spkiPath), 91, "KEY_SPKI_READ");
            if (der.Length != 91 || !StringComparer.Ordinal.Equals(CoseVerifier.HashHex(der), spkiSha256))
            {
                throw new VectorFailure("KEY_SPKI_HASH");
            }

            var key = new TestKey(keyId, purpose, environment, trustClass, kidHex, der);
            if (!byId.TryAdd(keyId, key) || !byKid.TryAdd(kidHex, key))
            {
                throw new VectorFailure("KEY_DUPLICATE");
            }
        }

        if (byId.Count != 18 || byKid.Count != 18)
        {
            throw new VectorFailure("KEY_COUNT");
        }

        return new TestKeyRegistry(byId, byKid);
    }

    private static (string Purpose, string Environment, string TrustClass) ExpectedKeyContract(
        string keyId) => keyId switch
    {
        "TEST_ONLY_INSTALLATION_DEVICE_PRIMARY" or
        "TEST_ONLY_INSTALLATION_DEVICE_REBIND" => ("INSTALLATION_DEVICE", "TEST", "TRUSTED"),
        "TEST_ONLY_INSTALLATION_DEVICE_WRONG_ENV" =>
            ("INSTALLATION_DEVICE", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_OFFLINE_CONTROL_DENIED" => ("OFFLINE_CONTROL", "TEST", "DENIED"),
        "TEST_ONLY_OFFLINE_CONTROL_PRIMARY" => ("OFFLINE_CONTROL", "TEST", "TRUSTED"),
        "TEST_ONLY_OFFLINE_CONTROL_WRONG_ENV" =>
            ("OFFLINE_CONTROL", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_OFFLINE_ENTITLEMENT_DENIED" => ("OFFLINE_ENTITLEMENT", "TEST", "DENIED"),
        "TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY" => ("OFFLINE_ENTITLEMENT", "TEST", "TRUSTED"),
        "TEST_ONLY_OFFLINE_ENTITLEMENT_WRONG_ENV" =>
            ("OFFLINE_ENTITLEMENT", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_ONLINE_LEASE_DENIED" => ("ONLINE_LEASE", "TEST", "DENIED"),
        "TEST_ONLY_ONLINE_LEASE_PRIMARY" => ("ONLINE_LEASE", "TEST", "TRUSTED"),
        "TEST_ONLY_ONLINE_LEASE_WRONG_ENV" =>
            ("ONLINE_LEASE", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_PROD_ROOT_PRIMARY" => ("PROD_ROOT", "TEST", "TRUSTED"),
        "TEST_ONLY_PROD_ROOT_WRONG_ENV" => ("PROD_ROOT", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_RECOVERY_DENIED" => ("RECOVERY", "TEST", "DENIED"),
        "TEST_ONLY_RECOVERY_PRIMARY" => ("RECOVERY", "TEST", "TRUSTED"),
        "TEST_ONLY_RECOVERY_WRONG_ENV" => ("RECOVERY", "DEVELOPMENT", "WRONG_ENVIRONMENT"),
        "TEST_ONLY_UNKNOWN_SIGNER" => ("UNKNOWN", "TEST", "UNKNOWN"),
        _ => throw new VectorFailure("KEY_ID"),
    };

    private static SignedPositive ValidateSignedPositive(
        string id,
        JsonElement positive,
        byte[] bytes,
        TestKeyRegistry keys,
        ExpectedResult expected)
    {
        var tokenType = JsonContract.String(positive, "tokenType", "POSITIVE_TOKEN_TYPE");
        var mediaType = JsonContract.String(positive, "mediaType", "POSITIVE_MEDIA_TYPE");
        var signerKeyId = JsonContract.Id(positive, "signerKeyId", "POSITIVE_SIGNER_KEY");
        var signerKeyIdHex = JsonContract.Sha256(positive, "signerKeyIdHex", "POSITIVE_SIGNER_KID");
        var protectedSha256 = JsonContract.Sha256(positive, "protectedSha256", "POSITIVE_PROTECTED_HASH");
        var payloadSha256 = JsonContract.Sha256(positive, "payloadSha256", "POSITIVE_PAYLOAD_HASH");
        var sigStructureSha256 = JsonContract.Sha256(
            positive,
            "sigStructureSha256",
            "POSITIVE_SIG_STRUCTURE_HASH");
        var signatureSha256 = JsonContract.Sha256(positive, "signatureSha256", "POSITIVE_SIGNATURE_HASH");

        if (!keys.ById.TryGetValue(signerKeyId, out var key) ||
            !StringComparer.Ordinal.Equals(key.KidHex, signerKeyIdHex))
        {
            throw new VectorFailure("POSITIVE_SIGNER_KEY");
        }

        var expectation = new SignedVectorExpectation(
            tokenType,
            mediaType,
            signerKeyIdHex,
            RequiredPurpose(tokenType),
            protectedSha256,
            payloadSha256,
            sigStructureSha256,
            signatureSha256);
        var components = CoseVerifier.Verify(bytes, keys.ByKid, expectation, compareExpectedComponentHashes: true);
        var executed = new ExecutedRecord(
            id,
            expected.Decision,
            expected.Stage,
            expected.ErrorCode,
            CoseVerifier.HashHex(bytes),
            components.ProtectedSha256,
            components.PayloadSha256,
            components.SigStructureSha256,
            components.SignerKeyIdHex);
        return new SignedPositive(id, bytes, expectation, executed);
    }

    private static string RequiredPurpose(string tokenType) => tokenType switch
    {
        "activation-request" or "lease-request" => "INSTALLATION_DEVICE",
        "key-delegation" or "key-denylist" => "PROD_ROOT",
        "entitlement" => "OFFLINE_ENTITLEMENT",
        "lease" => "ONLINE_LEASE",
        "offline-control" or "reactivation-authorization" => "OFFLINE_CONTROL",
        "recovery" or "time-correction" => "RECOVERY",
        _ => throw new VectorFailure("TOKEN_SIGNER_PURPOSE"),
    };

    private static byte[] ReadIndexedBlob(
        string vectorsRoot,
        JsonElement entry,
        string prefix,
        string expectedRelativePath)
    {
        var relativePath = JsonContract.RelativePath(entry, "path", $"{prefix}_PATH");
        if (!StringComparer.Ordinal.Equals(relativePath, expectedRelativePath))
        {
            throw new VectorFailure($"{prefix}_PATH");
        }

        var expectedLength = JsonContract.Integer(entry, "bytes", $"{prefix}_LENGTH");
        if (expectedLength < 1 || expectedLength > 16 * 1024 * 1024)
        {
            throw new VectorFailure($"{prefix}_LENGTH");
        }

        var bytes = PackagePath.Read(
            PackagePath.Resolve(vectorsRoot, relativePath),
            expectedLength,
            $"{prefix}_READ");
        if (bytes.Length != expectedLength ||
            !StringComparer.Ordinal.Equals(
                CoseVerifier.HashHex(bytes),
                JsonContract.Sha256(entry, "sha256", $"{prefix}_HASH")))
        {
            throw new VectorFailure($"{prefix}_HASH");
        }

        return bytes;
    }

    private static void RequireNull(JsonElement element, string name, string code)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Null)
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireEmptyString(JsonElement element, string name, string code)
    {
        if (!StringComparer.Ordinal.Equals(JsonContract.String(element, name, code), string.Empty))
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireAscending(string? previous, string current, string code)
    {
        if (previous is not null && StringComparer.Ordinal.Compare(previous, current) >= 0)
        {
            throw new VectorFailure(code);
        }
    }

    private static void Increment(IDictionary<string, int> counts, string key)
    {
        counts[key] = counts.TryGetValue(key, out var count) ? count + 1 : 1;
    }

    private static void RequireExactCounts(
        IReadOnlyDictionary<string, int> actual,
        IReadOnlyDictionary<string, int> expected,
        string code)
    {
        if (actual.Count != expected.Count ||
            expected.Any(pair => !actual.TryGetValue(pair.Key, out var count) || count != pair.Value))
        {
            throw new VectorFailure(code);
        }
    }

    private static byte[] BuildReport(RunResult result)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(
                   stream,
                   new JsonWriterOptions
                   {
                       Encoder = JavaScriptEncoder.Default,
                       Indented = false,
                       SkipValidation = false,
                   }))
        {
            writer.WriteStartObject();
            writer.WriteNumber("schemaVersion", 1);
            writer.WriteString("reportKind", ReportKind);
            writer.WriteString("protocolManifestSha256", result.ProtocolManifestSha256);
            writer.WriteString("indexSha256", result.IndexSha256);
            writer.WriteNumber("positiveCount", result.PositiveCount);
            writer.WriteNumber("binaryNegativeCount", result.BinaryNegativeCount);
            writer.WriteNumber("malformedExpandedCount", result.MalformedExpandedCount);
            writer.WriteNumber("crossTypeCount", result.CrossTypeCount);
            writer.WriteNumber("malformedDeferredCount", result.MalformedDeferredCount);
            writer.WriteNumber("executedCrossTypeCount", result.CrossTypeExecutedCount);
            writer.WriteStartArray("executed");
            foreach (var record in result.Executed)
            {
                writer.WriteStartObject();
                writer.WriteString("id", record.Id);
                writer.WriteString("decision", record.Decision);
                writer.WriteString("stage", record.Stage);
                writer.WriteString("errorCode", record.ErrorCode);
                writer.WriteString("inputSha256", record.InputSha256);
                writer.WriteString("protectedSha256", record.ProtectedSha256);
                writer.WriteString("payloadSha256", record.PayloadSha256);
                writer.WriteString("sigStructureSha256", record.SigStructureSha256);
                writer.WriteString("signerKeyIdHex", record.SignerKeyIdHex);
                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            writer.WriteStartObject("coverage");
            writer.WriteString("malformedExpandedSha256", result.MalformedExpandedSha256);
            writer.WriteString("crossTypeSha256", result.CrossTypeSha256);
            writer.WriteEndObject();
            writer.WriteEndObject();
            writer.Flush();
        }

        stream.WriteByte((byte)'\n');
        return stream.ToArray();
    }
}

internal sealed record CliOptions(string VectorsRoot, string? ReportPath)
{
    internal static CliOptions Parse(string[] args)
    {
        string? vectors = null;
        string? report = null;

        for (var index = 0; index < args.Length; index += 2)
        {
            if (index + 1 >= args.Length)
            {
                throw new VectorFailure("CLI_ARGUMENTS");
            }

            switch (args[index])
            {
                case "--vectors" when vectors is null:
                    vectors = args[index + 1];
                    break;
                case "--report" when report is null:
                    report = args[index + 1];
                    break;
                default:
                    throw new VectorFailure("CLI_ARGUMENTS");
            }
        }

        if (vectors is null || !Path.IsPathFullyQualified(vectors))
        {
            throw new VectorFailure("CLI_VECTORS_PATH");
        }

        PackagePath.ValidateCanonicalAbsolutePathSyntax(vectors, "CLI_VECTORS_PATH");
        var vectorsRoot = Path.GetFullPath(vectors);
        if (!Directory.Exists(vectorsRoot))
        {
            throw new VectorFailure("CLI_VECTORS_PATH");
        }

        PackagePath.RequireDirectoryChain(vectorsRoot, "CLI_VECTORS_PATH");

        if (report is not null && !Path.IsPathFullyQualified(report))
        {
            throw new VectorFailure("CLI_REPORT_PATH");
        }

        if (report is not null)
        {
            PackagePath.ValidateReportSyntax(report);
        }

        var reportPath = report is null ? null : Path.GetFullPath(report);
        if (reportPath is not null)
        {
            PackagePath.ValidateReportTarget(vectorsRoot, reportPath);
        }

        return new CliOptions(vectorsRoot, reportPath);
    }
}

internal static class PackagePath
{
    private static readonly HashSet<string> ReservedDeviceNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "COM1",
        "COM2",
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "LPT1",
        "LPT2",
        "LPT3",
        "LPT4",
        "LPT5",
        "LPT6",
        "LPT7",
        "LPT8",
        "LPT9",
    };

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    internal static string Resolve(string root, string relativePath)
    {
        if (Path.IsPathFullyQualified(relativePath))
        {
            throw new VectorFailure("PACKAGE_PATH");
        }

        var rootWithSeparator = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root)) + Path.DirectorySeparatorChar;
        var resolved = Path.GetFullPath(
            Path.Combine(rootWithSeparator, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!resolved.StartsWith(rootWithSeparator, PathComparison))
        {
            throw new VectorFailure("PACKAGE_PATH");
        }

        return resolved;
    }

    internal static string ResolveFrozenProtocolSource(
        string vectorsRoot,
        string exactRelativePath,
        string code)
    {
        var fileName = exactRelativePath switch
        {
            "../../protocol/v1/corpus/malformed-cases.json" => "malformed-cases.json",
            "../../protocol/v1/corpus/cross-type-cases.json" => "cross-type-cases.json",
            _ => throw new VectorFailure($"{code}_PATH"),
        };
        var corpusRoot = Path.GetFullPath(
            Path.Combine(vectorsRoot, "..", "..", "protocol", "v1", "corpus"));
        RequireDirectoryChain(corpusRoot, $"{code}_PATH");
        var resolved = Path.GetFullPath(Path.Combine(corpusRoot, fileName));
        var expected = Path.GetFullPath(
            Path.Combine(vectorsRoot, exactRelativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!StringComparerFromPath.Equals(resolved, expected))
        {
            throw new VectorFailure($"{code}_PATH");
        }

        return resolved;
    }

    internal static byte[] Read(string path, int maximumBytes, string code)
    {
        var fullPath = Path.GetFullPath(path);
        var parent = Path.GetDirectoryName(fullPath) ?? throw new VectorFailure(code);
        RequireDirectoryChain(parent, code);
        var attributes = File.GetAttributes(fullPath);
        if ((attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        {
            throw new VectorFailure(code);
        }

        using var stream = new FileStream(
            fullPath,
            new FileStreamOptions
            {
                Mode = FileMode.Open,
                Access = FileAccess.Read,
                Share = FileShare.Read,
                BufferSize = 4096,
                Options = FileOptions.SequentialScan,
            });
        if (stream.Length < 1 || stream.Length > maximumBytes || stream.Length > int.MaxValue)
        {
            throw new VectorFailure(code);
        }

        var bytes = new byte[(int)stream.Length];
        var offset = 0;
        while (offset < bytes.Length)
        {
            var read = stream.Read(bytes, offset, bytes.Length - offset);
            if (read == 0)
            {
                throw new VectorFailure(code);
            }

            offset += read;
        }

        if (stream.ReadByte() != -1 ||
            (File.GetAttributes(fullPath) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        {
            throw new VectorFailure(code);
        }

        return bytes;
    }

    internal static void RequireDirectoryChain(string path, string code)
    {
        DirectoryInfo? directory = new(Path.GetFullPath(path));
        while (directory is not null)
        {
            if (!directory.Exists ||
                (directory.Attributes & FileAttributes.Directory) == 0 ||
                (directory.Attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new VectorFailure(code);
            }

            directory = directory.Parent;
        }
    }

    internal static void ValidateReportSyntax(string reportPath)
    {
        ValidateCanonicalAbsolutePathSyntax(reportPath, "CLI_REPORT_PATH");
        var root = Path.GetPathRoot(reportPath)
            ?? throw new VectorFailure("CLI_REPORT_PATH");
        var pathTail = reportPath[root.Length..];
        var fileName = Path.GetFileName(reportPath);
        var firstDot = fileName.IndexOf('.');
        var deviceStem = firstDot < 0 ? fileName : fileName[..firstDot];
        if (fileName.Length == 0 ||
            pathTail.Contains(':') ||
            fileName.Contains('\\') ||
            fileName.Contains('/') ||
            fileName.EndsWith('.') ||
            fileName.EndsWith(' ') ||
            ReservedDeviceNames.Contains(deviceStem))
        {
            throw new VectorFailure("CLI_REPORT_PATH");
        }
    }

    internal static void ValidateCanonicalAbsolutePathSyntax(string candidate, string code)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var root = Path.GetPathRoot(candidate);
        if (root is null ||
            root.Length != 3 ||
            !char.IsAsciiLetter(root[0]) ||
            root[1] != ':' ||
            (root[2] != Path.DirectorySeparatorChar && root[2] != Path.AltDirectorySeparatorChar))
        {
            throw new VectorFailure(code);
        }
    }

    internal static void ValidateReportTarget(string vectorsRoot, string reportPath)
    {
        ValidateReportSyntax(reportPath);
        var fullReportPath = Path.GetFullPath(reportPath);
        var parent = Path.GetDirectoryName(fullReportPath)
            ?? throw new VectorFailure("CLI_REPORT_PATH");
        if (IsWithin(vectorsRoot, fullReportPath) ||
            File.Exists(fullReportPath) ||
            Directory.Exists(fullReportPath))
        {
            throw new VectorFailure("CLI_REPORT_PATH");
        }

        RequireDirectoryChain(parent, "CLI_REPORT_PATH");
    }

    internal static void WriteNewReport(string vectorsRoot, string reportPath, byte[] reportBytes)
    {
        ValidateReportTarget(vectorsRoot, reportPath);
        using var stream = new FileStream(
            reportPath,
            new FileStreamOptions
            {
                Mode = FileMode.CreateNew,
                Access = FileAccess.Write,
                Share = FileShare.None,
                BufferSize = 4096,
                Options = FileOptions.WriteThrough,
            });
        stream.Write(reportBytes);
        stream.Flush(flushToDisk: true);
        if (stream.Length != reportBytes.Length)
        {
            throw new VectorFailure("CLI_REPORT_PATH");
        }

        var attributes = File.GetAttributes(reportPath);
        if ((attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
        {
            throw new VectorFailure("CLI_REPORT_PATH");
        }
    }

    private static bool IsWithin(string root, string candidate)
    {
        var fullRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        var fullCandidate = Path.GetFullPath(candidate);
        return StringComparerFromPath.Equals(fullRoot, fullCandidate) ||
            fullCandidate.StartsWith(fullRoot + Path.DirectorySeparatorChar, PathComparison);
    }

    private static StringComparer StringComparerFromPath =>
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
}

internal sealed record ExpectedResult(string Decision, string Stage, string ErrorCode)
{
    internal static ExpectedResult Parse(JsonElement entry, string code)
    {
        var expected = JsonContract.Property(entry, "expected", code);
        JsonContract.RequireExactProperties(expected, code, "decision", "stage", "errorCode");
        return new ExpectedResult(
            JsonContract.String(expected, "decision", code),
            JsonContract.String(expected, "stage", code),
            JsonContract.String(expected, "errorCode", code));
    }
}

internal sealed record TestKey(
    string KeyId,
    string Purpose,
    string Environment,
    string TrustClass,
    string KidHex,
    byte[] Der);

internal sealed record TestKeyRegistry(
    IReadOnlyDictionary<string, TestKey> ById,
    IReadOnlyDictionary<string, TestKey> ByKid);

internal sealed record SignedPositive(
    string Id,
    byte[] Bytes,
    SignedVectorExpectation Expectation,
    ExecutedRecord Executed);

internal sealed record CarrierPositive(
    string Id,
    byte[] Bytes,
    string CarrierType,
    string Variant,
    string MediaType,
    ExpectedResult Expected);

internal sealed record ExecutedRecord(
    string Id,
    string Decision,
    string Stage,
    string ErrorCode,
    string InputSha256,
    string ProtectedSha256,
    string PayloadSha256,
    string SigStructureSha256,
    string SignerKeyIdHex)
{
    internal static ExecutedRecord EmptyComponents(
        string id,
        string decision,
        string stage,
        string errorCode,
        string inputSha256) => new(
            id,
            decision,
            stage,
            errorCode,
            inputSha256,
            string.Empty,
            string.Empty,
            string.Empty,
            string.Empty);
}

internal sealed record RunResult(
    string ProtocolManifestSha256,
    string IndexSha256,
    int PositiveCount,
    int BinaryNegativeCount,
    int MalformedExpandedCount,
    int CrossTypeCount,
    int MalformedDeferredCount,
    int CrossTypeExecutedCount,
    IReadOnlyList<ExecutedRecord> Executed,
    string MalformedExpandedSha256,
    string CrossTypeSha256);
