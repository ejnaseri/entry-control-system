using System.Numerics;
using System.Security.Cryptography;

namespace EntryControl.GoldenVectors;

internal sealed class VectorFailure : Exception
{
    internal VectorFailure(string code, string stage = "HARNESS")
        : base(code)
    {
        Code = code;
        Stage = stage;
    }

    internal string Code { get; }
    internal string Stage { get; }
}

internal sealed record SignedVectorExpectation(
    string ObjectType,
    string MediaType,
    string SignerKeyIdHex,
    string RequiredPurpose,
    string ProtectedSha256,
    string PayloadSha256,
    string SigStructureSha256,
    string SignatureSha256);

internal sealed record VerificationComponents(
    string ProtectedSha256,
    string PayloadSha256,
    string SigStructureSha256,
    string SignerKeyIdHex);

internal static class CoseVerifier
{
    private static readonly byte[] P256SpkiPrefix = Convert.FromHexString(
        "3059301306072A8648CE3D020106082A8648CE3D03010703420004");

    private static readonly BigInteger P256Order = BigInteger.Parse(
        "00ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
        System.Globalization.NumberStyles.AllowHexSpecifier);

    private static readonly BigInteger P256HalfOrder = BigInteger.Parse(
        "7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8",
        System.Globalization.NumberStyles.AllowHexSpecifier);

    internal static VerificationComponents Verify(
        byte[] coseBytes,
        IReadOnlyDictionary<string, TestKey> keysByKid,
        SignedVectorExpectation expected,
        bool compareExpectedComponentHashes,
        bool crossType = false)
    {
        if (coseBytes.Length > MaximumEncodedBytes(expected.ObjectType))
        {
            throw new VectorFailure("OBJECT_TOO_LARGE", "PRE_DECODE");
        }

        CborValue root;
        try
        {
            root = StrictCborReader.Parse(coseBytes, allowNull: true);
        }
        catch (VectorFailure failure)
        {
            throw TranslateCborFailure(failure);
        }

        if (root.Kind != CborKind.Tag || root.TagNumber != 18 || root.TaggedItem is null)
        {
            throw new VectorFailure("WRONG_COSE_TAG", "COSE_PARSE");
        }

        CborValue cose;
        try
        {
            cose = root.TaggedItem.RequireArray("INVALID_COSE_SHAPE");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_COSE_SHAPE", "COSE_PARSE");
        }
        if (cose.ArrayItems.Count != 4)
        {
            throw new VectorFailure("INVALID_COSE_SHAPE", "COSE_PARSE");
        }

        byte[] protectedBytes;
        try
        {
            protectedBytes = cose.ArrayItems[0].RequireByteString("INVALID_PROTECTED_HEADER");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_PROTECTED_HEADER", "COSE_PARSE");
        }

        CborValue unprotected;
        try
        {
            unprotected = cose.ArrayItems[1].RequireMap("UNPROTECTED_HEADER_NOT_EMPTY");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("UNPROTECTED_HEADER_NOT_EMPTY", "COSE_PARSE");
        }
        if (unprotected.MapItems.Count != 0)
        {
            throw new VectorFailure("UNPROTECTED_HEADER_NOT_EMPTY", "COSE_PARSE");
        }

        if (cose.ArrayItems[2].Kind == CborKind.Null)
        {
            throw new VectorFailure("DETACHED_PAYLOAD_FORBIDDEN", "COSE_PARSE");
        }

        byte[] payload;
        try
        {
            payload = cose.ArrayItems[2].RequireByteString("INVALID_COSE_PAYLOAD");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_COSE_PAYLOAD", "COSE_PARSE");
        }

        byte[] signature;
        try
        {
            signature = cose.ArrayItems[3].RequireByteString("INVALID_SIGNATURE_ENCODING");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_SIGNATURE_ENCODING", "SIGNATURE");
        }

        if (signature.Length != 64)
        {
            throw new VectorFailure("INVALID_SIGNATURE_ENCODING", "SIGNATURE");
        }

        CborValue protectedMap;
        try
        {
            protectedMap = StrictCborReader.Parse(protectedBytes).RequireMap("INVALID_PROTECTED_HEADER");
        }
        catch (VectorFailure failure) when (IsCanonicalCborFailure(failure.Code))
        {
            throw TranslateCborFailure(failure);
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_PROTECTED_HEADER", "COSE_PARSE");
        }

        if (protectedMap.MapItems.Any(pair =>
                pair.Key.Kind != CborKind.Unsigned ||
                pair.Key.UnsignedValue is not (1UL or 3UL or 4UL)))
        {
            throw new VectorFailure("UNKNOWN_PROTECTED_HEADER", "COSE_PARSE");
        }

        if (protectedMap.MapItems.Count != 3 ||
            protectedMap.FindIntegerKey(1) is null ||
            protectedMap.FindIntegerKey(3) is null ||
            protectedMap.FindIntegerKey(4) is null)
        {
            throw new VectorFailure("MISSING_PROTECTED_HEADER", "COSE_PARSE");
        }

        long algorithm;
        try
        {
            algorithm = protectedMap.FindIntegerKey(1)!.RequireInteger("WRONG_HEADER_TYPE");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("WRONG_HEADER_TYPE", "COSE_PARSE");
        }

        if (algorithm != -7)
        {
            throw new VectorFailure("WRONG_ALGORITHM", "COSE_PARSE");
        }

        string mediaType;
        try
        {
            mediaType = protectedMap.FindIntegerKey(3)!.RequireTextString("WRONG_HEADER_TYPE");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("WRONG_HEADER_TYPE", "COSE_PARSE");
        }

        if (!StringComparer.Ordinal.Equals(mediaType, expected.MediaType))
        {
            throw new VectorFailure(crossType ? "CROSS_TYPE_REJECTED" : "MEDIA_TYPE_MISMATCH", "DOMAIN");
        }

        byte[] protectedKid;
        try
        {
            protectedKid = protectedMap.FindIntegerKey(4)!.RequireByteString("WRONG_HEADER_TYPE");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("WRONG_HEADER_TYPE", "COSE_PARSE");
        }

        if (protectedKid.Length != 32)
        {
            throw new VectorFailure("WRONG_KEY_ID_LENGTH", "COSE_PARSE");
        }

        var signerKeyIdHex = Convert.ToHexStringLower(protectedKid);
        if (!StringComparer.Ordinal.Equals(signerKeyIdHex, expected.SignerKeyIdHex))
        {
            throw new VectorFailure("INDEX_SIGNER_KID");
        }

        CborValue payloadMap;
        try
        {
            payloadMap = StrictCborReader.Parse(payload).RequireMap("INVALID_COSE_PAYLOAD");
        }
        catch (VectorFailure failure) when (IsCanonicalCborFailure(failure.Code))
        {
            throw TranslateCborFailure(failure);
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("INVALID_COSE_PAYLOAD", "COSE_PARSE");
        }

        long protocolVersion;
        try
        {
            protocolVersion = payloadMap.FindTextKey("protocolVersion")?.RequireInteger("PROTOCOL_VERSION_MISMATCH")
                ?? throw new VectorFailure("PROTOCOL_VERSION_MISMATCH");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("PROTOCOL_VERSION_MISMATCH", "DOMAIN");
        }

        if (protocolVersion != 1)
        {
            throw new VectorFailure("PROTOCOL_VERSION_MISMATCH", "DOMAIN");
        }

        string tokenType;
        try
        {
            tokenType = payloadMap.FindTextKey("tokenType")?.RequireTextString("TOKEN_TYPE_MISMATCH")
                ?? throw new VectorFailure("TOKEN_TYPE_MISMATCH");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("TOKEN_TYPE_MISMATCH", "DOMAIN");
        }

        if (!StringComparer.Ordinal.Equals(tokenType, expected.ObjectType))
        {
            throw new VectorFailure(crossType ? "CROSS_TYPE_REJECTED" : "TOKEN_TYPE_MISMATCH", "DOMAIN");
        }

        byte[] payloadKid;
        try
        {
            payloadKid = payloadMap.FindTextKey("keyId")?.RequireByteString("KEY_ID_MISMATCH")
                ?? throw new VectorFailure("KEY_ID_MISMATCH");
        }
        catch (VectorFailure)
        {
            throw new VectorFailure("KEY_ID_MISMATCH", "DOMAIN");
        }

        if (payloadKid.Length != 32)
        {
            throw new VectorFailure("KEY_ID_MISMATCH", "DOMAIN");
        }

        if (!CryptographicOperations.FixedTimeEquals(payloadKid, protectedKid))
        {
            throw new VectorFailure("KEY_ID_MISMATCH", "DOMAIN");
        }

        if (!keysByKid.TryGetValue(signerKeyIdHex, out var key))
        {
            throw new VectorFailure("UNKNOWN_SIGNING_KEY", "SIGNATURE");
        }

        ValidatePublicKey(key.Der, protectedKid);
        ValidateSignatureScalars(signature);

        var sigStructure = MinimalCborWriter.BuildSigStructure(protectedBytes, payload);
        var protectedSha256 = HashHex(protectedBytes);
        var payloadSha256 = HashHex(payload);
        var sigStructureSha256 = HashHex(sigStructure);
        var signatureSha256 = HashHex(signature);

        if (compareExpectedComponentHashes)
        {
            RequireHash(expected.ProtectedSha256, protectedSha256, "INDEX_PROTECTED_HASH");
            RequireHash(expected.PayloadSha256, payloadSha256, "INDEX_PAYLOAD_HASH");
            RequireHash(expected.SigStructureSha256, sigStructureSha256, "INDEX_SIG_STRUCTURE_HASH");
            RequireHash(expected.SignatureSha256, signatureSha256, "INDEX_SIGNATURE_HASH");
        }

        using var ecdsa = ECDsa.Create();
        try
        {
            ecdsa.ImportSubjectPublicKeyInfo(key.Der, out var bytesRead);
            if (bytesRead != key.Der.Length)
            {
                throw new VectorFailure("SPKI_DER");
            }
        }
        catch (CryptographicException)
        {
            throw new VectorFailure("SPKI_DER");
        }

        var digest = SHA256.HashData(sigStructure);
        if (!ecdsa.VerifyHash(digest, signature, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
        {
            throw new VectorFailure("SIGNATURE_INVALID", "SIGNATURE");
        }

        // Protocol v1 authenticates exact bytes before evaluating the trust
        // policy.  A corrupt signature must therefore win over environment,
        // purpose, or denylist failures.
        if (key.TrustClass == "UNKNOWN")
        {
            throw new VectorFailure("UNKNOWN_SIGNING_KEY", "SIGNATURE");
        }

        if (key.Environment != "TEST" || key.TrustClass == "WRONG_ENVIRONMENT")
        {
            throw new VectorFailure("SIGNING_KEY_ENVIRONMENT_MISMATCH", "TRUST");
        }

        if (key.TrustClass == "DENIED")
        {
            throw new VectorFailure("SIGNING_KEY_DENIED", "TRUST");
        }

        if (!StringComparer.Ordinal.Equals(key.Purpose, expected.RequiredPurpose))
        {
            throw new VectorFailure("WRONG_SIGNING_KEY_PURPOSE", "TRUST");
        }

        if (key.TrustClass != "TRUSTED")
        {
            throw new VectorFailure("UNKNOWN_SIGNING_KEY", "SIGNATURE");
        }

        return new VerificationComponents(
            protectedSha256,
            payloadSha256,
            sigStructureSha256,
            signerKeyIdHex);
    }

    private static void ValidatePublicKey(byte[] publicKeyDer, byte[] protectedKid)
    {
        if (publicKeyDer.Length != 91)
        {
            throw new VectorFailure("SPKI_LENGTH");
        }

        if (!publicKeyDer.AsSpan(0, P256SpkiPrefix.Length).SequenceEqual(P256SpkiPrefix))
        {
            throw new VectorFailure("SPKI_DER");
        }

        var calculatedKid = SHA256.HashData(publicKeyDer);
        if (!CryptographicOperations.FixedTimeEquals(calculatedKid, protectedKid))
        {
            throw new VectorFailure("SPKI_KID_MISMATCH");
        }
    }

    private static int MaximumEncodedBytes(string tokenType) => tokenType switch
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
        _ => throw new VectorFailure("TOKEN_TYPE_LIMIT"),
    };

    private static bool IsCanonicalCborFailure(string code) => code is
        "CBOR_TRAILING_DATA" or
        "CBOR_DUPLICATE_MAP_KEY" or
        "CBOR_MAP_KEY_ORDER" or
        "CBOR_NON_MINIMAL" or
        "CBOR_INDEFINITE_LENGTH" or
        "CBOR_MALFORMED_UTF8" or
        "CBOR_NULL_FORBIDDEN";

    private static VectorFailure TranslateCborFailure(VectorFailure failure) => failure.Code switch
    {
        "CBOR_TRAILING_DATA" => new VectorFailure("TRAILING_DATA", "CBOR_PARSE"),
        "CBOR_DUPLICATE_MAP_KEY" => new VectorFailure("DUPLICATE_MAP_KEY", "CBOR_PARSE"),
        "CBOR_MAP_KEY_ORDER" or "CBOR_NON_MINIMAL" => new VectorFailure("NON_CANONICAL_CBOR", "CBOR_PARSE"),
        "CBOR_INDEFINITE_LENGTH" => new VectorFailure("INDEFINITE_LENGTH", "CBOR_PARSE"),
        "CBOR_MALFORMED_UTF8" => new VectorFailure("MALFORMED_UTF8", "CBOR_PARSE"),
        "CBOR_NULL_FORBIDDEN" => new VectorFailure("NULL_FIELD_FORBIDDEN", "CBOR_PARSE"),
        _ => new VectorFailure("INVALID_COSE_SHAPE", "COSE_PARSE"),
    };

    private static void ValidateSignatureScalars(byte[] signature)
    {
        var r = new BigInteger(signature.AsSpan(0, 32), isUnsigned: true, isBigEndian: true);
        var s = new BigInteger(signature.AsSpan(32, 32), isUnsigned: true, isBigEndian: true);

        if (r <= BigInteger.Zero || r >= P256Order)
        {
            throw new VectorFailure("INVALID_ECDSA_SCALAR", "SIGNATURE");
        }

        if (s <= BigInteger.Zero || s >= P256Order)
        {
            throw new VectorFailure("INVALID_ECDSA_SCALAR", "SIGNATURE");
        }

        if (s > P256HalfOrder)
        {
            throw new VectorFailure("NON_CANONICAL_SIGNATURE", "SIGNATURE");
        }
    }

    private static void RequireHash(string expected, string actual, string code)
    {
        if (!StringComparer.Ordinal.Equals(expected, actual))
        {
            throw new VectorFailure(code);
        }
    }

    internal static string HashHex(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
}
