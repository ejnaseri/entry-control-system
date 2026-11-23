using System.Buffers.Binary;
using System.Text;

namespace EntryControl.GoldenVectors;

internal enum CborKind
{
    Unsigned,
    Negative,
    ByteString,
    TextString,
    Array,
    Map,
    Tag,
    Boolean,
    Null,
}

internal sealed class CborValue
{
    internal required CborKind Kind { get; init; }
    internal ulong UnsignedValue { get; init; }
    internal long NegativeValue { get; init; }
    internal byte[] ByteString { get; init; } = [];
    internal string TextString { get; init; } = string.Empty;
    internal IReadOnlyList<CborValue> ArrayItems { get; init; } = [];
    internal IReadOnlyList<KeyValuePair<CborValue, CborValue>> MapItems { get; init; } = [];
    internal ulong TagNumber { get; init; }
    internal CborValue? TaggedItem { get; init; }
    internal bool BooleanValue { get; init; }
    internal byte[] Encoded { get; set; } = [];

    internal CborValue RequireMap(string code) => Kind == CborKind.Map ? this : throw new VectorFailure(code);

    internal CborValue RequireArray(string code) => Kind == CborKind.Array ? this : throw new VectorFailure(code);

    internal byte[] RequireByteString(string code) => Kind == CborKind.ByteString ? ByteString : throw new VectorFailure(code);

    internal string RequireTextString(string code) => Kind == CborKind.TextString ? TextString : throw new VectorFailure(code);

    internal long RequireInteger(string code) => Kind switch
    {
        CborKind.Unsigned when UnsignedValue <= long.MaxValue => (long)UnsignedValue,
        CborKind.Negative => NegativeValue,
        _ => throw new VectorFailure(code),
    };

    internal CborValue? FindIntegerKey(long key)
    {
        foreach (var pair in MapItems)
        {
            if (pair.Key.Kind == CborKind.Unsigned && key >= 0 && pair.Key.UnsignedValue == (ulong)key)
            {
                return pair.Value;
            }

            if (pair.Key.Kind == CborKind.Negative && pair.Key.NegativeValue == key)
            {
                return pair.Value;
            }
        }

        return null;
    }

    internal CborValue? FindTextKey(string key)
    {
        foreach (var pair in MapItems)
        {
            if (pair.Key.Kind == CborKind.TextString && StringComparer.Ordinal.Equals(pair.Key.TextString, key))
            {
                return pair.Value;
            }
        }

        return null;
    }
}

internal sealed class StrictCborReader
{
    private const int MaximumDepth = 64;
    private const int MaximumContainerItems = 100_000;
    private const int MaximumByteLength = 16 * 1024 * 1024;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    private readonly byte[] data;
    private readonly bool allowNull;
    private int offset;
    private int totalItems;

    private StrictCborReader(byte[] data, bool allowNull)
    {
        this.data = data;
        this.allowNull = allowNull;
    }

    internal static CborValue Parse(byte[] data, bool allowNull = false)
    {
        ArgumentNullException.ThrowIfNull(data);
        var reader = new StrictCborReader(data, allowNull);
        var value = reader.ReadValue(0);
        if (reader.offset != data.Length)
        {
            throw new VectorFailure("CBOR_TRAILING_DATA");
        }

        return value;
    }

    private CborValue ReadValue(int depth)
    {
        if (depth > MaximumDepth)
        {
            throw new VectorFailure("CBOR_DEPTH_LIMIT");
        }

        totalItems++;
        if (totalItems > MaximumContainerItems)
        {
            throw new VectorFailure("CBOR_ITEM_LIMIT");
        }

        var start = offset;
        var initial = ReadByte();
        var major = (byte)(initial >> 5);
        var additional = (byte)(initial & 0x1f);

        CborValue value = major switch
        {
            0 => ReadUnsigned(additional),
            1 => ReadNegative(additional),
            2 => ReadByteString(additional),
            3 => ReadTextString(additional),
            4 => ReadArray(additional, depth),
            5 => ReadMap(additional, depth),
            6 => ReadTag(additional, depth),
            7 => ReadSimple(additional),
            _ => throw new VectorFailure("CBOR_INVALID_MAJOR_TYPE"),
        };

        value.Encoded = data.AsSpan(start, offset - start).ToArray();
        return value;
    }

    private CborValue ReadUnsigned(byte additional) => new()
    {
        Kind = CborKind.Unsigned,
        UnsignedValue = ReadArgument(additional),
    };

    private CborValue ReadNegative(byte additional)
    {
        var encoded = ReadArgument(additional);
        if (encoded > long.MaxValue)
        {
            throw new VectorFailure("CBOR_INTEGER_RANGE");
        }

        return new CborValue
        {
            Kind = CborKind.Negative,
            NegativeValue = -1L - (long)encoded,
        };
    }

    private CborValue ReadByteString(byte additional)
    {
        var length = ReadLength(additional);
        return new CborValue
        {
            Kind = CborKind.ByteString,
            ByteString = ReadBytes(length),
        };
    }

    private CborValue ReadTextString(byte additional)
    {
        var length = ReadLength(additional);
        var bytes = ReadBytes(length);
        try
        {
            return new CborValue
            {
                Kind = CborKind.TextString,
                TextString = StrictUtf8.GetString(bytes),
            };
        }
        catch (DecoderFallbackException)
        {
            throw new VectorFailure("CBOR_MALFORMED_UTF8");
        }
    }

    private CborValue ReadArray(byte additional, int depth)
    {
        var count = ReadContainerCount(additional);
        var items = new CborValue[count];
        for (var index = 0; index < count; index++)
        {
            items[index] = ReadValue(depth + 1);
        }

        return new CborValue
        {
            Kind = CborKind.Array,
            ArrayItems = items,
        };
    }

    private CborValue ReadMap(byte additional, int depth)
    {
        var count = ReadContainerCount(additional);
        var items = new KeyValuePair<CborValue, CborValue>[count];
        byte[]? previousKey = null;

        for (var index = 0; index < count; index++)
        {
            var key = ReadValue(depth + 1);
            if (key.Kind is not (CborKind.Unsigned or CborKind.Negative or CborKind.ByteString or CborKind.TextString))
            {
                throw new VectorFailure("CBOR_MAP_KEY_TYPE");
            }

            if (previousKey is not null)
            {
                var comparison = CompareDeterministicMapKeys(previousKey, key.Encoded);
                if (comparison == 0)
                {
                    throw new VectorFailure("CBOR_DUPLICATE_MAP_KEY");
                }

                if (comparison > 0)
                {
                    throw new VectorFailure("CBOR_MAP_KEY_ORDER");
                }
            }

            previousKey = key.Encoded;
            items[index] = new KeyValuePair<CborValue, CborValue>(key, ReadValue(depth + 1));
        }

        return new CborValue
        {
            Kind = CborKind.Map,
            MapItems = items,
        };
    }

    private CborValue ReadTag(byte additional, int depth)
    {
        var tag = ReadArgument(additional);
        return new CborValue
        {
            Kind = CborKind.Tag,
            TagNumber = tag,
            TaggedItem = ReadValue(depth + 1),
        };
    }

    private CborValue ReadSimple(byte additional)
    {
        return additional switch
        {
            20 => new CborValue { Kind = CborKind.Boolean, BooleanValue = false },
            21 => new CborValue { Kind = CborKind.Boolean, BooleanValue = true },
            22 when allowNull => new CborValue { Kind = CborKind.Null },
            22 => throw new VectorFailure("CBOR_NULL_FORBIDDEN"),
            23 => throw new VectorFailure("CBOR_SIMPLE_FORBIDDEN"),
            24 => throw new VectorFailure("CBOR_SIMPLE_FORBIDDEN"),
            25 or 26 or 27 => throw new VectorFailure("CBOR_FLOAT_FORBIDDEN"),
            31 => throw new VectorFailure("CBOR_INDEFINITE_LENGTH"),
            _ when additional < 20 => throw new VectorFailure("CBOR_SIMPLE_FORBIDDEN"),
            _ => throw new VectorFailure("CBOR_RESERVED_ADDITIONAL_INFO"),
        };
    }

    private ulong ReadArgument(byte additional)
    {
        if (additional < 24)
        {
            return additional;
        }

        return additional switch
        {
            24 => ReadArgument8(),
            25 => ReadArgument16(),
            26 => ReadArgument32(),
            27 => ReadArgument64(),
            31 => throw new VectorFailure("CBOR_INDEFINITE_LENGTH"),
            _ => throw new VectorFailure("CBOR_RESERVED_ADDITIONAL_INFO"),
        };
    }

    private ulong ReadArgument8()
    {
        var value = ReadByte();
        if (value < 24)
        {
            throw new VectorFailure("CBOR_NON_MINIMAL");
        }

        return value;
    }

    private ulong ReadArgument16()
    {
        var bytes = ReadSpan(sizeof(ushort));
        var value = BinaryPrimitives.ReadUInt16BigEndian(bytes);
        if (value <= byte.MaxValue)
        {
            throw new VectorFailure("CBOR_NON_MINIMAL");
        }

        return value;
    }

    private ulong ReadArgument32()
    {
        var bytes = ReadSpan(sizeof(uint));
        var value = BinaryPrimitives.ReadUInt32BigEndian(bytes);
        if (value <= ushort.MaxValue)
        {
            throw new VectorFailure("CBOR_NON_MINIMAL");
        }

        return value;
    }

    private ulong ReadArgument64()
    {
        var bytes = ReadSpan(sizeof(ulong));
        var value = BinaryPrimitives.ReadUInt64BigEndian(bytes);
        if (value <= uint.MaxValue)
        {
            throw new VectorFailure("CBOR_NON_MINIMAL");
        }

        return value;
    }

    private int ReadLength(byte additional)
    {
        var length = ReadArgument(additional);
        if (length > MaximumByteLength || length > int.MaxValue)
        {
            throw new VectorFailure("CBOR_LENGTH_LIMIT");
        }

        return (int)length;
    }

    private int ReadContainerCount(byte additional)
    {
        var count = ReadArgument(additional);
        if (count > MaximumContainerItems || count > int.MaxValue)
        {
            throw new VectorFailure("CBOR_ITEM_LIMIT");
        }

        return (int)count;
    }

    private byte ReadByte()
    {
        if (offset >= data.Length)
        {
            throw new VectorFailure("CBOR_TRUNCATED");
        }

        return data[offset++];
    }

    private byte[] ReadBytes(int length) => ReadSpan(length).ToArray();

    private ReadOnlySpan<byte> ReadSpan(int length)
    {
        if (length < 0 || offset > data.Length - length)
        {
            throw new VectorFailure("CBOR_TRUNCATED");
        }

        var result = data.AsSpan(offset, length);
        offset += length;
        return result;
    }

    private static int CompareDeterministicMapKeys(ReadOnlySpan<byte> left, ReadOnlySpan<byte> right)
    {
        return left.SequenceCompareTo(right);
    }
}

internal static class MinimalCborWriter
{
    private static readonly byte[] Signature1 = "Signature1"u8.ToArray();

    internal static byte[] BuildSigStructure(byte[] protectedHeaders, byte[] payload)
    {
        using var stream = new MemoryStream(1 + 1 + Signature1.Length + 9 + protectedHeaders.Length + 1 + 9 + payload.Length);
        stream.WriteByte(0x84);
        WriteTextString(stream, Signature1);
        WriteByteString(stream, protectedHeaders);
        stream.WriteByte(0x40);
        WriteByteString(stream, payload);
        return stream.ToArray();
    }

    private static void WriteTextString(Stream stream, ReadOnlySpan<byte> utf8)
    {
        WriteHead(stream, 3, (ulong)utf8.Length);
        stream.Write(utf8);
    }

    private static void WriteByteString(Stream stream, ReadOnlySpan<byte> bytes)
    {
        WriteHead(stream, 2, (ulong)bytes.Length);
        stream.Write(bytes);
    }

    private static void WriteHead(Stream stream, byte major, ulong argument)
    {
        if (argument < 24)
        {
            stream.WriteByte((byte)((major << 5) | (byte)argument));
            return;
        }

        Span<byte> buffer = stackalloc byte[8];
        if (argument <= byte.MaxValue)
        {
            stream.WriteByte((byte)((major << 5) | 24));
            stream.WriteByte((byte)argument);
        }
        else if (argument <= ushort.MaxValue)
        {
            stream.WriteByte((byte)((major << 5) | 25));
            BinaryPrimitives.WriteUInt16BigEndian(buffer, (ushort)argument);
            stream.Write(buffer[..2]);
        }
        else if (argument <= uint.MaxValue)
        {
            stream.WriteByte((byte)((major << 5) | 26));
            BinaryPrimitives.WriteUInt32BigEndian(buffer, (uint)argument);
            stream.Write(buffer[..4]);
        }
        else
        {
            stream.WriteByte((byte)((major << 5) | 27));
            BinaryPrimitives.WriteUInt64BigEndian(buffer, argument);
            stream.Write(buffer);
        }
    }
}
