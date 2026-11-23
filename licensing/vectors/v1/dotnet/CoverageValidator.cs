using System.Text.Json;

namespace EntryControl.GoldenVectors;

internal sealed record BinaryNegativeMetadata(
    string Id,
    string SourceDescriptorId,
    string BasePositiveId,
    string TokenType,
    string MediaType,
    string Path,
    string Sha256,
    ExpectedResult Expected);

internal sealed record CrossTypeRecord(
    string Id,
    string SourceType,
    string TargetType,
    string BasePositiveId,
    string BaseCoseSha256,
    string SourceMediaType,
    string TargetMediaType,
    ExpectedResult Expected);

internal sealed record CoverageResult(
    int MalformedExpandedCount,
    int MalformedDeferredCount,
    int CrossTypeCount,
    string MalformedExpandedSha256,
    string CrossTypeSha256,
    IReadOnlyList<CrossTypeRecord> CrossTypeRecords);

internal static class CoverageValidator
{
    private const string MalformedCoveragePath = "coverage/malformed-expanded.json";
    private const string MalformedSourcePath = "../../protocol/v1/corpus/malformed-cases.json";
    private const string MalformedSourceSha256 =
        "44a656845d37efa1d27b610c4c25505ec8460a2f9f87de113fd59dcad8216051";
    private const string CrossTypeCoveragePath = "coverage/cross-type.json";
    private const string CrossTypeSourcePath = "../../protocol/v1/corpus/cross-type-cases.json";
    private const string CrossTypeSourceSha256 =
        "dd87178a80b96eda5d10f74da9f2d7005b08793e1d33baee44289c4a71c83890";

    private static readonly string[] SignedTypes =
    [
        "activation-request",
        "lease-request",
        "key-delegation",
        "key-denylist",
        "entitlement",
        "lease",
        "offline-control",
        "reactivation-authorization",
        "recovery",
        "time-correction",
    ];

    internal static CoverageResult Validate(
        JsonElement index,
        string vectorsRoot,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, string> basePositiveByType,
        IReadOnlyDictionary<string, BinaryNegativeMetadata> binaryNegativeById)
    {
        var descriptorCorpora = JsonContract.Property(index, "descriptorCorpora", "INDEX_DESCRIPTOR_CORPORA");
        JsonContract.RequireExactProperties(
            descriptorCorpora,
            "INDEX_DESCRIPTOR_CORPORA",
            "malformedPath",
            "malformedSha256",
            "malformedExpandedCount",
            "crossTypePath",
            "crossTypeSha256",
            "crossTypeCount");

        var malformedPath = JsonContract.RelativePath(
            descriptorCorpora,
            "malformedPath",
            "MALFORMED_COVERAGE_PATH");
        var malformedSha256 = JsonContract.Sha256(
            descriptorCorpora,
            "malformedSha256",
            "MALFORMED_COVERAGE_HASH");
        var malformedExpectedCount = JsonContract.Integer(
            descriptorCorpora,
            "malformedExpandedCount",
            "MALFORMED_COVERAGE_COUNT");
        var crossTypePath = JsonContract.RelativePath(
            descriptorCorpora,
            "crossTypePath",
            "CROSS_TYPE_COVERAGE_PATH");
        var crossTypeSha256 = JsonContract.Sha256(
            descriptorCorpora,
            "crossTypeSha256",
            "CROSS_TYPE_COVERAGE_HASH");
        var crossTypeExpectedCount = JsonContract.Integer(
            descriptorCorpora,
            "crossTypeCount",
            "CROSS_TYPE_COVERAGE_COUNT");

        if (!StringComparer.Ordinal.Equals(malformedPath, MalformedCoveragePath) ||
            !StringComparer.Ordinal.Equals(crossTypePath, CrossTypeCoveragePath) ||
            malformedExpectedCount != 744 ||
            crossTypeExpectedCount != 90)
        {
            throw new VectorFailure("COVERAGE_INDEX_CONTRACT");
        }

        var malformedBytes = PackagePath.Read(
            PackagePath.Resolve(vectorsRoot, malformedPath),
            16 * 1024 * 1024,
            "MALFORMED_COVERAGE_READ");
        var crossTypeBytes = PackagePath.Read(
            PackagePath.Resolve(vectorsRoot, crossTypePath),
            4 * 1024 * 1024,
            "CROSS_TYPE_COVERAGE_READ");
        if (!StringComparer.Ordinal.Equals(CoseVerifier.HashHex(malformedBytes), malformedSha256) ||
            !StringComparer.Ordinal.Equals(CoseVerifier.HashHex(crossTypeBytes), crossTypeSha256))
        {
            throw new VectorFailure("COVERAGE_HASH");
        }

        using var malformedDocument = JsonContract.ParseCanonicalAsciiJson(
            malformedBytes,
            "MALFORMED_COVERAGE_JSON");
        using var crossTypeDocument = JsonContract.ParseCanonicalAsciiJson(
            crossTypeBytes,
            "CROSS_TYPE_COVERAGE_JSON");
        using var malformedSourceDocument = ReadFrozenSource(
            vectorsRoot,
            MalformedSourcePath,
            MalformedSourceSha256,
            4 * 1024 * 1024,
            "MALFORMED_SOURCE");
        using var crossTypeSourceDocument = ReadFrozenSource(
            vectorsRoot,
            CrossTypeSourcePath,
            CrossTypeSourceSha256,
            2 * 1024 * 1024,
            "CROSS_TYPE_SOURCE");

        var malformedDeferredCount = ValidateMalformed(
            malformedDocument.RootElement,
            malformedSourceDocument.RootElement,
            signedById,
            basePositiveByType,
            binaryNegativeById);
        var crossTypeRecords = ValidateCrossType(
            crossTypeDocument.RootElement,
            crossTypeSourceDocument.RootElement,
            signedById,
            basePositiveByType);

        return new CoverageResult(
            744,
            malformedDeferredCount,
            90,
            malformedSha256,
            crossTypeSha256,
            crossTypeRecords);
    }

    private static JsonDocument ReadFrozenSource(
        string vectorsRoot,
        string expectedRelativePath,
        string expectedSha256,
        int maximumBytes,
        string code)
    {
        var sourcePath = PackagePath.ResolveFrozenProtocolSource(vectorsRoot, expectedRelativePath, code);
        var sourceBytes = PackagePath.Read(sourcePath, maximumBytes, $"{code}_READ");
        if (!StringComparer.Ordinal.Equals(CoseVerifier.HashHex(sourceBytes), expectedSha256))
        {
            throw new VectorFailure($"{code}_HASH");
        }

        return JsonContract.ParseCanonicalAsciiJson(sourceBytes, $"{code}_JSON");
    }

    private static int ValidateMalformed(
        JsonElement coverage,
        JsonElement source,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, string> basePositiveByType,
        IReadOnlyDictionary<string, BinaryNegativeMetadata> binaryNegativeById)
    {
        JsonContract.RequireExactProperties(
            coverage,
            "MALFORMED_COVERAGE_ENVELOPE",
            "schemaVersion",
            "protocolVersion",
            "coverageKind",
            "nonProductionOnly",
            "sourcePath",
            "sourceSha256",
            "sourceDescriptorCount",
            "expectedRecordCount",
            "records");
        RequireCoverageEnvelope(
            coverage,
            "MALFORMED_EXPANDED",
            MalformedSourcePath,
            MalformedSourceSha256,
            744,
            "MALFORMED_COVERAGE_ENVELOPE");
        if (JsonContract.Integer(
                coverage,
                "sourceDescriptorCount",
                "MALFORMED_COVERAGE_ENVELOPE") != 224)
        {
            throw new VectorFailure("MALFORMED_COVERAGE_ENVELOPE");
        }

        JsonContract.RequireExactProperties(
            source,
            "MALFORMED_SOURCE_ENVELOPE",
            "schemaVersion",
            "corpusKind",
            "protocolVersion",
            "signedTypes",
            "expectedCaseCount",
            "cases");
        RequireSourceEnvelope(
            source,
            "descriptor-based-negative-corpus",
            224,
            "expectedCaseCount",
            "MALFORMED_SOURCE_ENVELOPE");
        RequireSignedTypes(source, includeMaximumCoseBytes: true, "MALFORMED_SOURCE_ENVELOPE");

        var sourceCases = JsonContract.Array(source, "cases", "MALFORMED_SOURCE_CASES").ToArray();
        var records = JsonContract.Array(coverage, "records", "MALFORMED_COVERAGE_RECORDS").ToArray();
        if (sourceCases.Length != 224 || records.Length != 744)
        {
            throw new VectorFailure("MALFORMED_COVERAGE_COUNT");
        }

        var recordIndex = 0;
        var descriptorIds = new HashSet<string>(StringComparer.Ordinal);
        var descriptorTypePairs = new HashSet<string>(StringComparer.Ordinal);
        var usedBinaryIds = new HashSet<string>(StringComparer.Ordinal);
        var binaryCount = 0;
        var deferredCount = 0;

        foreach (var descriptor in sourceCases)
        {
            JsonContract.RequireExactProperties(
                descriptor,
                "MALFORMED_SOURCE_DESCRIPTOR",
                "id",
                "types",
                "category",
                "mutation",
                "expected");
            var descriptorId = JsonContract.Id(descriptor, "id", "MALFORMED_SOURCE_DESCRIPTOR");
            if (!descriptorIds.Add(descriptorId) ||
                string.IsNullOrEmpty(JsonContract.String(descriptor, "category", "MALFORMED_SOURCE_DESCRIPTOR")))
            {
                throw new VectorFailure("MALFORMED_SOURCE_DESCRIPTOR");
            }

            var mutation = JsonContract.Property(descriptor, "mutation", "MALFORMED_SOURCE_DESCRIPTOR");
            var expected = JsonContract.Property(descriptor, "expected", "MALFORMED_SOURCE_DESCRIPTOR");
            ValidateExpectedReject(expected, "MALFORMED_SOURCE_EXPECTED");
            var descriptorTypes = JsonContract.Array(descriptor, "types", "MALFORMED_SOURCE_TYPES").ToArray();
            if (descriptorTypes.Length == 0)
            {
                throw new VectorFailure("MALFORMED_SOURCE_TYPES");
            }

            var previousTypePosition = -1;
            var localTypes = new HashSet<string>(StringComparer.Ordinal);
            foreach (var typeElement in descriptorTypes)
            {
                if (typeElement.ValueKind != JsonValueKind.String || typeElement.GetString() is not { } tokenType)
                {
                    throw new VectorFailure("MALFORMED_SOURCE_TYPES");
                }

                var typePosition = SignedTypePosition(tokenType, "MALFORMED_SOURCE_TYPES");
                if (!localTypes.Add(tokenType) || typePosition <= previousTypePosition)
                {
                    throw new VectorFailure("MALFORMED_SOURCE_TYPES");
                }

                previousTypePosition = typePosition;
                if (recordIndex >= records.Length)
                {
                    throw new VectorFailure("MALFORMED_COVERAGE_COUNT");
                }

                var record = records[recordIndex++];
                JsonContract.RequireExactProperties(
                    record,
                    "MALFORMED_COVERAGE_RECORD",
                    "id",
                    "descriptorId",
                    "tokenType",
                    "basePositiveId",
                    "baseCosePath",
                    "baseCoseSha256",
                    "mutation",
                    "expected",
                    "coverageStatus",
                    "binaryExecution",
                    "binaryNegativeId");

                var expectedRecordId = $"{descriptorId}::{tokenType}";
                if (!StringComparer.Ordinal.Equals(
                        JsonContract.Id(record, "id", "MALFORMED_COVERAGE_RECORD"),
                        expectedRecordId) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.Id(record, "descriptorId", "MALFORMED_COVERAGE_RECORD"),
                        descriptorId) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "tokenType", "MALFORMED_COVERAGE_RECORD"),
                        tokenType) ||
                    !descriptorTypePairs.Add(descriptorId + "\0" + tokenType))
                {
                    throw new VectorFailure("MALFORMED_COVERAGE_TRACEABILITY");
                }

                var basePositive = RequireBasePositive(
                    record,
                    tokenType,
                    signedById,
                    basePositiveByType,
                    "MALFORMED_COVERAGE_BASE");
                if (!JsonDeepExact(
                        JsonContract.Property(record, "mutation", "MALFORMED_COVERAGE_RECORD"),
                        mutation) ||
                    !JsonDeepExact(
                        JsonContract.Property(record, "expected", "MALFORMED_COVERAGE_RECORD"),
                        expected) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "coverageStatus", "MALFORMED_COVERAGE_RECORD"),
                        "FROZEN"))
                {
                    throw new VectorFailure("MALFORMED_COVERAGE_TRACEABILITY");
                }

                var execution = JsonContract.String(
                    record,
                    "binaryExecution",
                    "MALFORMED_COVERAGE_EXECUTION");
                var binaryIdElement = JsonContract.Property(
                    record,
                    "binaryNegativeId",
                    "MALFORMED_COVERAGE_EXECUTION");
                if (execution == "BINARY_FIXTURE")
                {
                    if (binaryIdElement.ValueKind != JsonValueKind.String ||
                        binaryIdElement.GetString() is not { } binaryId ||
                        !binaryNegativeById.TryGetValue(binaryId, out var binary) ||
                        !usedBinaryIds.Add(binaryId))
                    {
                        throw new VectorFailure("MALFORMED_COVERAGE_BINARY_LINK");
                    }

                    ValidateBinaryLink(binary, descriptorId, tokenType, basePositive, expected);
                    binaryCount++;
                }
                else if (execution == "DEFERRED_TO_LIC_6_2_003")
                {
                    if (binaryIdElement.ValueKind != JsonValueKind.Null)
                    {
                        throw new VectorFailure("MALFORMED_COVERAGE_DEFERRED_LINK");
                    }

                    deferredCount++;
                }
                else
                {
                    throw new VectorFailure("MALFORMED_COVERAGE_EXECUTION");
                }
            }
        }

        if (recordIndex != records.Length ||
            descriptorIds.Count != 224 ||
            descriptorTypePairs.Count != 744 ||
            binaryCount != 42 ||
            deferredCount != 702 ||
            usedBinaryIds.Count != binaryNegativeById.Count ||
            binaryNegativeById.Keys.Any(id => !usedBinaryIds.Contains(id)))
        {
            throw new VectorFailure("MALFORMED_COVERAGE_TRACEABILITY");
        }

        return deferredCount;
    }

    private static IReadOnlyList<CrossTypeRecord> ValidateCrossType(
        JsonElement coverage,
        JsonElement source,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, string> basePositiveByType)
    {
        JsonContract.RequireExactProperties(
            coverage,
            "CROSS_TYPE_COVERAGE_ENVELOPE",
            "schemaVersion",
            "protocolVersion",
            "coverageKind",
            "nonProductionOnly",
            "sourcePath",
            "sourceSha256",
            "expectedRecordCount",
            "records");
        RequireCoverageEnvelope(
            coverage,
            "CROSS_TYPE",
            CrossTypeSourcePath,
            CrossTypeSourceSha256,
            90,
            "CROSS_TYPE_COVERAGE_ENVELOPE");

        JsonContract.RequireExactProperties(
            source,
            "CROSS_TYPE_SOURCE_ENVELOPE",
            "schemaVersion",
            "corpusKind",
            "protocolVersion",
            "signedTypeCount",
            "expectedOrderedPairCount",
            "signedTypes",
            "cases");
        if (JsonContract.Integer(source, "schemaVersion", "CROSS_TYPE_SOURCE_ENVELOPE") != 1 ||
            JsonContract.Integer(source, "protocolVersion", "CROSS_TYPE_SOURCE_ENVELOPE") != 1 ||
            JsonContract.Integer(source, "signedTypeCount", "CROSS_TYPE_SOURCE_ENVELOPE") != 10 ||
            JsonContract.Integer(source, "expectedOrderedPairCount", "CROSS_TYPE_SOURCE_ENVELOPE") != 90 ||
            !StringComparer.Ordinal.Equals(
                JsonContract.String(source, "corpusKind", "CROSS_TYPE_SOURCE_ENVELOPE"),
                "ordered-cross-type-negative-corpus"))
        {
            throw new VectorFailure("CROSS_TYPE_SOURCE_ENVELOPE");
        }

        RequireSignedTypes(source, includeMaximumCoseBytes: false, "CROSS_TYPE_SOURCE_ENVELOPE");
        var sourceCases = JsonContract.Array(source, "cases", "CROSS_TYPE_SOURCE_CASES").ToArray();
        var records = JsonContract.Array(coverage, "records", "CROSS_TYPE_COVERAGE_RECORDS").ToArray();
        if (sourceCases.Length != 90 || records.Length != 90)
        {
            throw new VectorFailure("CROSS_TYPE_COVERAGE_COUNT");
        }

        var output = new List<CrossTypeRecord>(90);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var pairs = new HashSet<string>(StringComparer.Ordinal);
        var caseIndex = 0;
        foreach (var expectedSourceType in SignedTypes)
        {
            foreach (var expectedTargetType in SignedTypes)
            {
                if (expectedSourceType == expectedTargetType)
                {
                    continue;
                }

                var descriptor = sourceCases[caseIndex];
                var record = records[caseIndex];
                caseIndex++;
                JsonContract.RequireExactProperties(
                    descriptor,
                    "CROSS_TYPE_SOURCE_CASE",
                    "id",
                    "sourceType",
                    "sourceMediaType",
                    "targetType",
                    "targetMediaType",
                    "mutation",
                    "expected");
                JsonContract.RequireExactProperties(
                    record,
                    "CROSS_TYPE_COVERAGE_RECORD",
                    "id",
                    "sourceType",
                    "targetType",
                    "basePositiveId",
                    "baseCosePath",
                    "baseCoseSha256",
                    "sourceMediaType",
                    "targetMediaType",
                    "mutation",
                    "expected",
                    "coverageStatus");

                var id = JsonContract.Id(descriptor, "id", "CROSS_TYPE_SOURCE_CASE");
                var sourceType = JsonContract.String(descriptor, "sourceType", "CROSS_TYPE_SOURCE_CASE");
                var targetType = JsonContract.String(descriptor, "targetType", "CROSS_TYPE_SOURCE_CASE");
                var sourceMediaType = JsonContract.String(
                    descriptor,
                    "sourceMediaType",
                    "CROSS_TYPE_SOURCE_CASE");
                var targetMediaType = JsonContract.String(
                    descriptor,
                    "targetMediaType",
                    "CROSS_TYPE_SOURCE_CASE");
                var expected = JsonContract.Property(descriptor, "expected", "CROSS_TYPE_SOURCE_CASE");
                ValidateExpectedReject(expected, "CROSS_TYPE_SOURCE_EXPECTED");

                if (!StringComparer.Ordinal.Equals(sourceType, expectedSourceType) ||
                    !StringComparer.Ordinal.Equals(targetType, expectedTargetType) ||
                    !StringComparer.Ordinal.Equals(sourceMediaType, ExactMediaType(sourceType)) ||
                    !StringComparer.Ordinal.Equals(targetMediaType, ExactMediaType(targetType)) ||
                    !ids.Add(id) ||
                    !pairs.Add(sourceType + "\0" + targetType) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.Id(record, "id", "CROSS_TYPE_COVERAGE_RECORD"),
                        id) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "sourceType", "CROSS_TYPE_COVERAGE_RECORD"),
                        sourceType) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "targetType", "CROSS_TYPE_COVERAGE_RECORD"),
                        targetType) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "sourceMediaType", "CROSS_TYPE_COVERAGE_RECORD"),
                        sourceMediaType) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "targetMediaType", "CROSS_TYPE_COVERAGE_RECORD"),
                        targetMediaType) ||
                    !JsonDeepExact(
                        JsonContract.Property(record, "mutation", "CROSS_TYPE_COVERAGE_RECORD"),
                        JsonContract.Property(descriptor, "mutation", "CROSS_TYPE_SOURCE_CASE")) ||
                    !JsonDeepExact(
                        JsonContract.Property(record, "expected", "CROSS_TYPE_COVERAGE_RECORD"),
                        expected) ||
                    !StringComparer.Ordinal.Equals(
                        JsonContract.String(record, "coverageStatus", "CROSS_TYPE_COVERAGE_RECORD"),
                        "FROZEN"))
                {
                    throw new VectorFailure("CROSS_TYPE_COVERAGE_TRACEABILITY");
                }

                var basePositive = RequireBasePositive(
                    record,
                    sourceType,
                    signedById,
                    basePositiveByType,
                    "CROSS_TYPE_COVERAGE_BASE");
                output.Add(new CrossTypeRecord(
                    id,
                    sourceType,
                    targetType,
                    basePositive.Id,
                    basePositive.Executed.InputSha256,
                    sourceMediaType,
                    targetMediaType,
                    new ExpectedResult(
                        "REJECT",
                        JsonContract.String(expected, "stage", "CROSS_TYPE_SOURCE_EXPECTED"),
                        JsonContract.String(expected, "errorCode", "CROSS_TYPE_SOURCE_EXPECTED"))));
            }
        }

        if (caseIndex != 90 || output.Count != 90 || ids.Count != 90 || pairs.Count != 90)
        {
            throw new VectorFailure("CROSS_TYPE_COVERAGE_MATRIX");
        }

        return output;
    }

    private static void RequireCoverageEnvelope(
        JsonElement coverage,
        string expectedKind,
        string expectedSourcePath,
        string expectedSourceSha256,
        int expectedCount,
        string code)
    {
        if (JsonContract.Integer(coverage, "schemaVersion", code) != 1 ||
            JsonContract.Integer(coverage, "protocolVersion", code) != 1 ||
            !JsonContract.Boolean(coverage, "nonProductionOnly", code) ||
            !StringComparer.Ordinal.Equals(JsonContract.String(coverage, "coverageKind", code), expectedKind) ||
            !StringComparer.Ordinal.Equals(JsonContract.String(coverage, "sourcePath", code), expectedSourcePath) ||
            !StringComparer.Ordinal.Equals(JsonContract.Sha256(coverage, "sourceSha256", code), expectedSourceSha256) ||
            JsonContract.Integer(coverage, "expectedRecordCount", code) != expectedCount)
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireSourceEnvelope(
        JsonElement source,
        string expectedKind,
        int expectedCount,
        string countField,
        string code)
    {
        if (JsonContract.Integer(source, "schemaVersion", code) != 1 ||
            JsonContract.Integer(source, "protocolVersion", code) != 1 ||
            JsonContract.Integer(source, countField, code) != expectedCount ||
            !StringComparer.Ordinal.Equals(JsonContract.String(source, "corpusKind", code), expectedKind))
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireSignedTypes(
        JsonElement source,
        bool includeMaximumCoseBytes,
        string code)
    {
        var types = JsonContract.Array(source, "signedTypes", code).ToArray();
        if (types.Length != SignedTypes.Length)
        {
            throw new VectorFailure(code);
        }

        for (var index = 0; index < types.Length; index++)
        {
            var entry = types[index];
            if (includeMaximumCoseBytes)
            {
                JsonContract.RequireExactProperties(entry, code, "name", "mediaType", "maximumCoseBytes");
            }
            else
            {
                JsonContract.RequireExactProperties(entry, code, "name", "mediaType");
            }

            var tokenType = SignedTypes[index];
            if (!StringComparer.Ordinal.Equals(JsonContract.String(entry, "name", code), tokenType) ||
                !StringComparer.Ordinal.Equals(
                    JsonContract.String(entry, "mediaType", code),
                    ExactMediaType(tokenType)) ||
                (includeMaximumCoseBytes &&
                    JsonContract.Integer(entry, "maximumCoseBytes", code) != MaximumCoseBytes(tokenType)))
            {
                throw new VectorFailure(code);
            }
        }
    }

    private static SignedPositive RequireBasePositive(
        JsonElement record,
        string tokenType,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, string> basePositiveByType,
        string code)
    {
        if (!basePositiveByType.TryGetValue(tokenType, out var expectedBaseId) ||
            !signedById.TryGetValue(expectedBaseId, out var basePositive) ||
            !StringComparer.Ordinal.Equals(JsonContract.Id(record, "basePositiveId", code), expectedBaseId) ||
            !StringComparer.Ordinal.Equals(basePositive.Expectation.ObjectType, tokenType) ||
            !StringComparer.Ordinal.Equals(
                JsonContract.RelativePath(record, "baseCosePath", code),
                $"fixtures/positive/{expectedBaseId}.cbor") ||
            !StringComparer.Ordinal.Equals(
                JsonContract.Sha256(record, "baseCoseSha256", code),
                basePositive.Executed.InputSha256))
        {
            throw new VectorFailure(code);
        }

        return basePositive;
    }

    private static void ValidateBinaryLink(
        BinaryNegativeMetadata binary,
        string descriptorId,
        string tokenType,
        SignedPositive basePositive,
        JsonElement sourceExpected)
    {
        if (!StringComparer.Ordinal.Equals(binary.SourceDescriptorId, descriptorId) ||
            !StringComparer.Ordinal.Equals(binary.TokenType, tokenType) ||
            !StringComparer.Ordinal.Equals(binary.BasePositiveId, basePositive.Id) ||
            !StringComparer.Ordinal.Equals(binary.MediaType, basePositive.Expectation.MediaType) ||
            !StringComparer.Ordinal.Equals(binary.Path, $"fixtures/negative/{binary.Id}.cbor") ||
            !StringComparer.Ordinal.Equals(binary.Expected.Decision, "REJECT") ||
            !StringComparer.Ordinal.Equals(
                binary.Expected.Stage,
                JsonContract.String(sourceExpected, "stage", "MALFORMED_SOURCE_EXPECTED")) ||
            !StringComparer.Ordinal.Equals(
                binary.Expected.ErrorCode,
                JsonContract.String(sourceExpected, "errorCode", "MALFORMED_SOURCE_EXPECTED")) ||
            binary.Sha256.Length != 64)
        {
            throw new VectorFailure("MALFORMED_COVERAGE_BINARY_LINK");
        }
    }

    private static void ValidateExpectedReject(JsonElement expected, string code)
    {
        JsonContract.RequireExactProperties(
            expected,
            code,
            "decision",
            "stage",
            "errorCode",
            "authoritativeStateChanged",
            "requestConsumed");
        if (!StringComparer.Ordinal.Equals(JsonContract.String(expected, "decision", code), "REJECT") ||
            string.IsNullOrEmpty(JsonContract.String(expected, "stage", code)) ||
            string.IsNullOrEmpty(JsonContract.String(expected, "errorCode", code)) ||
            JsonContract.Boolean(expected, "authoritativeStateChanged", code) ||
            JsonContract.Boolean(expected, "requestConsumed", code))
        {
            throw new VectorFailure(code);
        }
    }

    private static int SignedTypePosition(string tokenType, string code)
    {
        var position = Array.IndexOf(SignedTypes, tokenType);
        return position >= 0 ? position : throw new VectorFailure(code);
    }

    private static string ExactMediaType(string tokenType)
    {
        _ = SignedTypePosition(tokenType, "CROSS_TYPE_MEDIA_TYPE");
        return $"application/vnd.entry-control.{tokenType}+cbor;v=1";
    }

    private static int MaximumCoseBytes(string tokenType) => tokenType switch
    {
        "activation-request" => 131_072,
        "lease-request" => 8_192,
        "key-delegation" => 8_192,
        "key-denylist" => 262_144,
        "entitlement" => 16_384,
        "lease" => 16_384,
        "offline-control" => 8_192,
        "reactivation-authorization" => 16_384,
        "recovery" => 16_384,
        "time-correction" => 8_192,
        _ => throw new VectorFailure("SIGNED_TYPE_LIMIT"),
    };

    private static bool JsonDeepExact(JsonElement left, JsonElement right)
    {
        if (left.ValueKind != right.ValueKind)
        {
            return false;
        }

        switch (left.ValueKind)
        {
            case JsonValueKind.Object:
            {
                var leftProperties = left.EnumerateObject().ToArray();
                var rightProperties = right.EnumerateObject().ToArray();
                if (leftProperties.Length != rightProperties.Length)
                {
                    return false;
                }

                for (var index = 0; index < leftProperties.Length; index++)
                {
                    if (!StringComparer.Ordinal.Equals(leftProperties[index].Name, rightProperties[index].Name) ||
                        !JsonDeepExact(leftProperties[index].Value, rightProperties[index].Value))
                    {
                        return false;
                    }
                }

                return true;
            }
            case JsonValueKind.Array:
            {
                var leftItems = left.EnumerateArray().ToArray();
                var rightItems = right.EnumerateArray().ToArray();
                if (leftItems.Length != rightItems.Length)
                {
                    return false;
                }

                for (var index = 0; index < leftItems.Length; index++)
                {
                    if (!JsonDeepExact(leftItems[index], rightItems[index]))
                    {
                        return false;
                    }
                }

                return true;
            }
            case JsonValueKind.String:
                return StringComparer.Ordinal.Equals(left.GetString(), right.GetString());
            case JsonValueKind.Number:
                return StringComparer.Ordinal.Equals(left.GetRawText(), right.GetRawText());
            case JsonValueKind.True:
            case JsonValueKind.False:
            case JsonValueKind.Null:
                return true;
            default:
                return false;
        }
    }
}
