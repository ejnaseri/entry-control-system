namespace EntryControl.GoldenVectors;

// Independent, test-only validation of the three frozen non-authoritative
// carrier schemas.  Embedded objects retain their exact COSE bytes and are
// verified again through the .NET COSE consumer before a carrier is accepted.
internal static class CarrierVerifier
{
    private const string LeaseChallengeMediaType =
        "application/vnd.entry-control.lease-challenge+cbor;v=1";
    private const string LeaseResponseMediaType =
        "application/vnd.entry-control.lease-response+cbor;v=1";
    private const string TrustBundleMediaType =
        "application/vnd.entry-control.trust-bundle+cbor;v=1";

    internal static void Verify(
        string id,
        byte[] bytes,
        string carrierType,
        string variant,
        string mediaType,
        TestKeyRegistry keys,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, SignedPositive> signedByHash)
    {
        var expectedMediaType = carrierType switch
        {
            "lease-challenge" => LeaseChallengeMediaType,
            "lease-response" => LeaseResponseMediaType,
            "trust-bundle" => TrustBundleMediaType,
            _ => throw new VectorFailure("CARRIER_TYPE"),
        };
        var maximumBytes = carrierType switch
        {
            "lease-challenge" => 4_096,
            "lease-response" => 524_288,
            "trust-bundle" => 1_048_576,
            _ => throw new VectorFailure("CARRIER_TYPE"),
        };
        if (bytes.Length > maximumBytes)
        {
            throw new VectorFailure("OBJECT_TOO_LARGE", "PRE_DECODE");
        }

        if (!StringComparer.Ordinal.Equals(mediaType, expectedMediaType))
        {
            throw new VectorFailure("CARRIER_MEDIA_TYPE", "DOMAIN");
        }

        var map = StrictCborReader.Parse(bytes).RequireMap("CARRIER_SHAPE");
        RequireInteger(map, "schemaVersion", 1, "CARRIER_SCHEMA");
        RequireText(map, "carrierType", carrierType, "CARRIER_TYPE");

        switch (carrierType)
        {
            case "lease-challenge":
                VerifyLeaseChallenge(id, variant, map, signedById);
                break;
            case "trust-bundle":
                if (!StringComparer.Ordinal.Equals(id, "pos-carrier-trust-bundle") ||
                    !StringComparer.Ordinal.Equals(variant, "STANDARD"))
                {
                    throw new VectorFailure("CARRIER_VARIANT");
                }

                VerifyTrustBundle(map, keys, signedById, signedByHash);
                break;
            case "lease-response":
                VerifyLeaseResponse(id, variant, map, keys, signedById, signedByHash);
                break;
        }
    }

    private static void VerifyLeaseChallenge(
        string id,
        string variant,
        CborValue map,
        IReadOnlyDictionary<string, SignedPositive> signedById)
    {
        RequireExactFields(
            map,
            "CARRIER_CHALLENGE_FIELDS",
            "schemaVersion",
            "carrierType",
            "requestNonce",
            "expiresInSeconds");
        if (!StringComparer.Ordinal.Equals(id, "pos-carrier-lease-challenge") ||
            !StringComparer.Ordinal.Equals(variant, "STANDARD"))
        {
            throw new VectorFailure("CARRIER_VARIANT");
        }

        var nonce = RequireBytes(map, "requestNonce", 32, 32, "CARRIER_CHALLENGE_NONCE");
        RequireInteger(map, "expiresInSeconds", 300, "CARRIER_CHALLENGE_EXPIRY");
        var request = RequireSigned(signedById, "pos-lease-request-check-in");
        var requestNonce = RequireBytes(
            ExtractPayload(request.Bytes),
            "requestNonce",
            32,
            32,
            "CARRIER_CHALLENGE_LINK");
        if (!nonce.AsSpan().SequenceEqual(requestNonce))
        {
            throw new VectorFailure("CARRIER_CHALLENGE_LINK", "DOMAIN");
        }
    }

    private static void VerifyTrustBundle(
        CborValue map,
        TestKeyRegistry keys,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, SignedPositive> signedByHash)
    {
        RequireExactFields(
            map,
            "CARRIER_TRUST_FIELDS",
            "schemaVersion",
            "carrierType",
            "delegations",
            "denylist");
        var delegations = map.FindTextKey("delegations")?.RequireArray("CARRIER_TRUST_DELEGATIONS")
            ?? throw new VectorFailure("CARRIER_TRUST_DELEGATIONS");
        if (delegations.ArrayItems.Count is < 1 or > 64)
        {
            throw new VectorFailure("CARRIER_TRUST_DELEGATIONS");
        }

        var expectedIds = new HashSet<string>(
            [
                "pos-delegation-offline-control",
                "pos-delegation-offline-entitlement",
                "pos-delegation-online-lease",
                "pos-delegation-recovery",
            ],
            StringComparer.Ordinal);
        byte[]? previousDelegatedKeyId = null;
        foreach (var item in delegations.ArrayItems)
        {
            var bytes = item.RequireByteString("CARRIER_TRUST_DELEGATION_TYPE");
            if (bytes.Length is < 1 or > 8_192)
            {
                throw new VectorFailure("CARRIER_TRUST_DELEGATION_SIZE");
            }

            var embedded = VerifyEmbedded(bytes, "key-delegation", keys, signedByHash);
            if (!expectedIds.Remove(embedded.Id))
            {
                throw new VectorFailure("CARRIER_TRUST_DELEGATION_SET");
            }

            var delegatedKeyId = RequireBytes(
                ExtractPayload(bytes),
                "delegatedKeyId",
                32,
                32,
                "CARRIER_TRUST_DELEGATED_KID");
            if (previousDelegatedKeyId is not null &&
                CompareUnsigned(previousDelegatedKeyId, delegatedKeyId) >= 0)
            {
                throw new VectorFailure("CARRIER_TRUST_DELEGATION_ORDER");
            }

            previousDelegatedKeyId = delegatedKeyId;
        }

        if (expectedIds.Count != 0)
        {
            throw new VectorFailure("CARRIER_TRUST_DELEGATION_SET");
        }

        var denylistBytes = RequireBytes(map, "denylist", 1, 262_144, "CARRIER_TRUST_DENYLIST");
        var denylist = VerifyEmbedded(denylistBytes, "key-denylist", keys, signedByHash);
        if (!StringComparer.Ordinal.Equals(denylist.Id, "pos-denylist-revision-2"))
        {
            throw new VectorFailure("CARRIER_TRUST_DENYLIST");
        }

        _ = RequireSigned(signedById, denylist.Id);
    }

    private static void VerifyLeaseResponse(
        string id,
        string variant,
        CborValue map,
        TestKeyRegistry keys,
        IReadOnlyDictionary<string, SignedPositive> signedById,
        IReadOnlyDictionary<string, SignedPositive> signedByHash)
    {
        var expectedFields = id switch
        {
            "pos-carrier-lease-response-complete" => new[]
            {
                "schemaVersion", "carrierType", "requestId", "lease", "offlineControl",
                "reactivationAuthorization", "trustBundle",
            },
            "pos-carrier-lease-response-time-recovery" =>
                ["schemaVersion", "carrierType", "requestId", "lease"],
            "pos-carrier-lease-response-control-only" =>
                ["schemaVersion", "carrierType", "requestId", "offlineControl"],
            "pos-carrier-lease-response-reactivation-only" =>
                ["schemaVersion", "carrierType", "requestId", "reactivationAuthorization"],
            _ => throw new VectorFailure("CARRIER_VARIANT"),
        };
        RequireExactFields(map, "CARRIER_RESPONSE_FIELDS", expectedFields);
        var expectedVariant = id switch
        {
            "pos-carrier-lease-response-control-only" => "CONTROL_ONLY",
            "pos-carrier-lease-response-reactivation-only" => "REACTIVATION_ONLY",
            _ => "WITH_LEASE",
        };
        if (!StringComparer.Ordinal.Equals(variant, expectedVariant))
        {
            throw new VectorFailure("CARRIER_VARIANT");
        }

        var requestId = RequireBytes(map, "requestId", 16, 16, "CARRIER_RESPONSE_REQUEST_ID");
        var requestFixtureId = id == "pos-carrier-lease-response-time-recovery"
            ? "pos-lease-request-time-recovery"
            : "pos-lease-request-check-in";
        var expectedRequestId = RequireBytes(
            ExtractPayload(RequireSigned(signedById, requestFixtureId).Bytes),
            "requestId",
            16,
            16,
            "CARRIER_RESPONSE_REQUEST_LINK");
        if (!requestId.AsSpan().SequenceEqual(expectedRequestId))
        {
            throw new VectorFailure("CARRIER_RESPONSE_REQUEST_LINK", "DOMAIN");
        }

        if (map.FindTextKey("lease") is { } leaseValue)
        {
            var leaseBytes = RequireByteStringValue(leaseValue, 1, 16_384, "CARRIER_RESPONSE_LEASE");
            var lease = VerifyEmbedded(leaseBytes, "lease", keys, signedByHash);
            var expectedLeaseId = id == "pos-carrier-lease-response-time-recovery"
                ? "pos-lease-positive-control"
                : "pos-lease-initial-control";
            if (!StringComparer.Ordinal.Equals(lease.Id, expectedLeaseId))
            {
                throw new VectorFailure("CARRIER_RESPONSE_LEASE");
            }

            var leaseRequestId = RequireBytes(
                ExtractPayload(leaseBytes),
                "leaseRequestId",
                16,
                16,
                "CARRIER_RESPONSE_REQUEST_LINK");
            if (!requestId.AsSpan().SequenceEqual(leaseRequestId))
            {
                throw new VectorFailure("CARRIER_RESPONSE_REQUEST_LINK", "DOMAIN");
            }
        }

        if (map.FindTextKey("offlineControl") is { } controlValue)
        {
            var controlBytes = RequireByteStringValue(controlValue, 1, 8_192, "CARRIER_RESPONSE_CONTROL");
            var control = VerifyEmbedded(controlBytes, "offline-control", keys, signedByHash);
            if (!StringComparer.Ordinal.Equals(control.Id, "pos-control-vendor-suspend"))
            {
                throw new VectorFailure("CARRIER_RESPONSE_CONTROL");
            }
        }

        if (map.FindTextKey("reactivationAuthorization") is { } reactivationValue)
        {
            var reactivationBytes = RequireByteStringValue(
                reactivationValue,
                1,
                16_384,
                "CARRIER_RESPONSE_REACTIVATION");
            var reactivation = VerifyEmbedded(
                reactivationBytes,
                "reactivation-authorization",
                keys,
                signedByHash);
            if (!StringComparer.Ordinal.Equals(reactivation.Id, "pos-reactivation-authorization"))
            {
                throw new VectorFailure("CARRIER_RESPONSE_REACTIVATION");
            }
        }

        if (map.FindTextKey("trustBundle") is { } trustValue)
        {
            if (id == "pos-carrier-lease-response-time-recovery")
            {
                throw new VectorFailure("TIME_RECOVERY_TRUST_FORBIDDEN", "DOMAIN");
            }

            var trustBytes = RequireByteStringValue(trustValue, 1, 491_520, "CARRIER_RESPONSE_TRUST");
            var trustMap = StrictCborReader.Parse(trustBytes).RequireMap("CARRIER_RESPONSE_TRUST");
            RequireInteger(trustMap, "schemaVersion", 1, "CARRIER_RESPONSE_TRUST");
            RequireText(trustMap, "carrierType", "trust-bundle", "CARRIER_RESPONSE_TRUST");
            VerifyTrustBundle(trustMap, keys, signedById, signedByHash);
        }
    }

    private static SignedPositive VerifyEmbedded(
        byte[] bytes,
        string expectedType,
        TestKeyRegistry keys,
        IReadOnlyDictionary<string, SignedPositive> signedByHash)
    {
        var hash = CoseVerifier.HashHex(bytes);
        if (!signedByHash.TryGetValue(hash, out var signed) ||
            !StringComparer.Ordinal.Equals(signed.Expectation.ObjectType, expectedType) ||
            !signed.Bytes.AsSpan().SequenceEqual(bytes))
        {
            throw new VectorFailure("CARRIER_EMBEDDED_OBJECT");
        }

        _ = CoseVerifier.Verify(
            bytes,
            keys.ByKid,
            signed.Expectation,
            compareExpectedComponentHashes: true);
        return signed;
    }

    private static CborValue ExtractPayload(byte[] coseBytes)
    {
        var root = StrictCborReader.Parse(coseBytes, allowNull: true);
        if (root.Kind != CborKind.Tag || root.TagNumber != 18 || root.TaggedItem is null)
        {
            throw new VectorFailure("CARRIER_EMBEDDED_OBJECT");
        }

        var array = root.TaggedItem.RequireArray("CARRIER_EMBEDDED_OBJECT");
        if (array.ArrayItems.Count != 4)
        {
            throw new VectorFailure("CARRIER_EMBEDDED_OBJECT");
        }

        var payload = array.ArrayItems[2].RequireByteString("CARRIER_EMBEDDED_OBJECT");
        return StrictCborReader.Parse(payload).RequireMap("CARRIER_EMBEDDED_OBJECT");
    }

    private static SignedPositive RequireSigned(
        IReadOnlyDictionary<string, SignedPositive> signedById,
        string id) => signedById.TryGetValue(id, out var value)
        ? value
        : throw new VectorFailure("CARRIER_SIGNED_INDEX");

    private static void RequireExactFields(CborValue map, string code, params string[] expected)
    {
        var actual = new HashSet<string>(StringComparer.Ordinal);
        foreach (var pair in map.MapItems)
        {
            if (pair.Key.Kind != CborKind.TextString || !actual.Add(pair.Key.TextString))
            {
                throw new VectorFailure(code);
            }
        }

        if (actual.Count != expected.Length || expected.Any(field => !actual.Contains(field)))
        {
            throw new VectorFailure(code);
        }
    }

    private static byte[] RequireBytes(
        CborValue map,
        string field,
        int minimum,
        int maximum,
        string code)
    {
        var value = map.FindTextKey(field) ?? throw new VectorFailure(code);
        return RequireByteStringValue(value, minimum, maximum, code);
    }

    private static byte[] RequireByteStringValue(CborValue value, int minimum, int maximum, string code)
    {
        var bytes = value.RequireByteString(code);
        return bytes.Length >= minimum && bytes.Length <= maximum
            ? bytes
            : throw new VectorFailure(code);
    }

    private static void RequireText(CborValue map, string field, string expected, string code)
    {
        var actual = map.FindTextKey(field)?.RequireTextString(code) ?? throw new VectorFailure(code);
        if (!StringComparer.Ordinal.Equals(actual, expected))
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireInteger(CborValue map, string field, long expected, string code)
    {
        var actual = map.FindTextKey(field)?.RequireInteger(code) ?? throw new VectorFailure(code);
        if (actual != expected)
        {
            throw new VectorFailure(code);
        }
    }

    private static int CompareUnsigned(byte[] left, byte[] right)
    {
        var commonLength = Math.Min(left.Length, right.Length);
        for (var index = 0; index < commonLength; index++)
        {
            var comparison = left[index].CompareTo(right[index]);
            if (comparison != 0)
            {
                return comparison;
            }
        }

        return left.Length.CompareTo(right.Length);
    }
}
