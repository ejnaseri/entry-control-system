using System;
using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace EntryControl.TestOnly;

// Candidate framing only. No CNG, keys, service identity or License State authority.
internal sealed record FixtureContext(byte Edition, byte[] Installation, ulong Generation,
    byte[] StateHash, byte[] SpkiHash, byte[] ProfileHash);

internal static class CandidateCodec
{
    internal const int Header = 534, MaxPayload = 1048576, MaxEnvelope = 1049126;
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("ECSSW001");
    private static readonly byte[] Domain = Encoding.ASCII.GetBytes("ENTRY_CONTROL_SYSTEM");
    internal static void ValidateContext(FixtureContext c)
    {
        if (c.Edition is not (1 or 2) || c.Installation.Length != 16 || c.Generation > long.MaxValue ||
            c.StateHash.Length != 32 || c.SpkiHash.Length != 32 || c.ProfileHash.Length != 32)
            throw new FormatException("CONTEXT_REFUSED");
    }
    internal static byte[] Encode(FixtureContext c, byte[] nonce, byte[] wrapped, byte[] ciphertext, byte[] tag)
    {
        ValidateContext(c);
        if (nonce.Length != 12 || wrapped.Length != 384 || tag.Length != 16 ||
            ciphertext.Length is < 1 or > MaxPayload) throw new FormatException("LENGTH_REFUSED");
        var output = new byte[Header + ciphertext.Length + 16];
        Magic.CopyTo(output, 0);
        BinaryPrimitives.WriteUInt16BigEndian(output.AsSpan(8), 1);
        BinaryPrimitives.WriteUInt16BigEndian(output.AsSpan(10), 1);
        output[12] = 1; output[13] = c.Edition;
        c.Installation.CopyTo(output, 14);
        BinaryPrimitives.WriteUInt64BigEndian(output.AsSpan(30), c.Generation);
        c.StateHash.CopyTo(output, 38); c.SpkiHash.CopyTo(output, 70); c.ProfileHash.CopyTo(output, 102);
        BinaryPrimitives.WriteUInt32BigEndian(output.AsSpan(134), (uint)ciphertext.Length);
        nonce.CopyTo(output, 138); wrapped.CopyTo(output, 150);
        ciphertext.CopyTo(output, Header); tag.CopyTo(output, Header + ciphertext.Length);
        return output;
    }
    internal static byte[] SnapshotAndValidate(byte[] supplied, FixtureContext expected)
    {
        // Bound before snapshot allocation. No awaits or native calls in this codec.
        if (supplied.Length < Header + 17 || supplied.Length > MaxEnvelope) throw new FormatException("SIZE_REFUSED");
        var input = (byte[])supplied.Clone();
        ValidateContext(expected);
        if (!input.AsSpan(0, 8).SequenceEqual(Magic) || BinaryPrimitives.ReadUInt16BigEndian(input.AsSpan(8)) != 1 ||
            BinaryPrimitives.ReadUInt16BigEndian(input.AsSpan(10)) != 1 || input[12] != 1 || input[13] is not (1 or 2))
            throw new FormatException("HEADER_REFUSED");
        uint size = BinaryPrimitives.ReadUInt32BigEndian(input.AsSpan(134));
        ulong generation = BinaryPrimitives.ReadUInt64BigEndian(input.AsSpan(30));
        if (size is < 1 or > MaxPayload || input.Length != Header + (long)size + 16 || generation > long.MaxValue)
            throw new FormatException("LENGTH_REFUSED");
        if (input[13] != expected.Edition || generation != expected.Generation ||
            !CryptographicOperations.FixedTimeEquals(input.AsSpan(14, 16), expected.Installation) ||
            !CryptographicOperations.FixedTimeEquals(input.AsSpan(38, 32), expected.StateHash) ||
            !CryptographicOperations.FixedTimeEquals(input.AsSpan(70, 32), expected.SpkiHash) ||
            !CryptographicOperations.FixedTimeEquals(input.AsSpan(102, 32), expected.ProfileHash))
            throw new FormatException("EXPECTED_CONTEXT_REFUSED");
        return input;
    }
    internal static byte[] Aad(byte[] validated)
    {
        if (validated.Length < Header) throw new FormatException("HEADER_REFUSED");
        var aad = new byte[Domain.Length + Header];
        Domain.CopyTo(aad, 0); validated.AsSpan(0, Header).CopyTo(aad.AsSpan(Domain.Length));
        return aad;
    }
}
