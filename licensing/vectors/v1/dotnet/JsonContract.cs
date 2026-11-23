using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EntryControl.GoldenVectors;

internal static partial class JsonContract
{
    [GeneratedRegex("^[a-z0-9][a-z0-9./_-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex RelativePathPattern();

    [GeneratedRegex("^[0-9a-f]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256Pattern();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9_.:-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex IdPattern();

    internal static JsonDocument ParseCanonicalAsciiJson(byte[] bytes, string code)
    {
        if (bytes.Length == 0 || bytes[^1] != (byte)'\n' ||
            (bytes.Length > 1 && bytes[^2] == (byte)'\n') ||
            bytes.AsSpan().Contains((byte)'\r') ||
            bytes.AsSpan().Contains((byte)'\t') ||
            bytes.AsSpan().ContainsAnyExceptInRange((byte)0x0a, (byte)0x7e) ||
            bytes[0] != (byte)'{' ||
            HasTrailingLineWhitespace(bytes))
        {
            throw new VectorFailure(code);
        }

        try
        {
            var document = JsonDocument.Parse(
                bytes,
                new JsonDocumentOptions
                {
                    AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow,
                    MaxDepth = 64,
                });
            var itemCount = 0;
            ValidateNoDuplicateProperties(document.RootElement, ref itemCount);
            RequireCanonicalPrettyBytes(document.RootElement, bytes, code);
            return document;
        }
        catch (JsonException)
        {
            throw new VectorFailure(code);
        }
    }

    private static void RequireCanonicalPrettyBytes(JsonElement root, byte[] sourceBytes, string code)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(
                   stream,
                   new JsonWriterOptions
                   {
                       Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
                       Indented = true,
                       IndentCharacter = ' ',
                       IndentSize = 2,
                       NewLine = "\n",
                       SkipValidation = false,
                   }))
        {
            root.WriteTo(writer);
            writer.Flush();
        }

        stream.WriteByte((byte)'\n');
        if (!stream.GetBuffer().AsSpan(0, checked((int)stream.Length)).SequenceEqual(sourceBytes))
        {
            throw new VectorFailure(code);
        }
    }

    private static bool HasTrailingLineWhitespace(byte[] bytes)
    {
        for (var index = 0; index < bytes.Length; index++)
        {
            if (bytes[index] == (byte)'\n' &&
                index > 0 &&
                bytes[index - 1] == (byte)' ')
            {
                return true;
            }
        }

        return false;
    }

    private static void ValidateNoDuplicateProperties(JsonElement element, ref int itemCount)
    {
        itemCount++;
        if (itemCount > 1_000_000)
        {
            throw new VectorFailure("JSON_ITEM_LIMIT");
        }

        if (element.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            {
                if (!names.Add(property.Name))
                {
                    throw new VectorFailure("JSON_DUPLICATE_PROPERTY");
                }

                ValidateNoDuplicateProperties(property.Value, ref itemCount);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                ValidateNoDuplicateProperties(item, ref itemCount);
            }
        }
    }

    internal static JsonElement Property(JsonElement element, string name, string code)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value))
        {
            throw new VectorFailure(code);
        }

        return value;
    }

    internal static void RequireExactProperties(JsonElement element, string code, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new VectorFailure(code);
        }

        var properties = element.EnumerateObject().ToArray();
        if (properties.Length != names.Length)
        {
            throw new VectorFailure(code);
        }

        for (var index = 0; index < names.Length; index++)
        {
            if (!StringComparer.Ordinal.Equals(properties[index].Name, names[index]))
            {
                throw new VectorFailure(code);
            }
        }
    }

    internal static JsonElement PropertyAny(JsonElement element, string code, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value))
            {
                return value;
            }
        }

        throw new VectorFailure(code);
    }

    internal static string String(JsonElement element, string name, string code)
    {
        var value = Property(element, name, code);
        return value.ValueKind == JsonValueKind.String && value.GetString() is { } text
            ? text
            : throw new VectorFailure(code);
    }

    internal static string StringAny(JsonElement element, string code, params string[] names)
    {
        var value = PropertyAny(element, code, names);
        return value.ValueKind == JsonValueKind.String && value.GetString() is { } text
            ? text
            : throw new VectorFailure(code);
    }

    internal static int Integer(JsonElement element, string name, string code)
    {
        var value = Property(element, name, code);
        return value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)
            ? number
            : throw new VectorFailure(code);
    }

    internal static bool Boolean(JsonElement element, string name, string code)
    {
        var value = Property(element, name, code);
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => throw new VectorFailure(code),
        };
    }

    internal static JsonElement.ArrayEnumerator Array(JsonElement element, string name, string code)
    {
        var value = Property(element, name, code);
        return value.ValueKind == JsonValueKind.Array ? value.EnumerateArray() : throw new VectorFailure(code);
    }

    internal static JsonElement.ArrayEnumerator ArrayAny(JsonElement element, string code, params string[] names)
    {
        var value = PropertyAny(element, code, names);
        return value.ValueKind == JsonValueKind.Array ? value.EnumerateArray() : throw new VectorFailure(code);
    }

    internal static string Sha256(JsonElement element, string name, string code)
    {
        var value = String(element, name, code);
        return Sha256Pattern().IsMatch(value) ? value : throw new VectorFailure(code);
    }

    internal static string Id(JsonElement element, string name, string code)
    {
        var value = String(element, name, code);
        return IdPattern().IsMatch(value) ? value : throw new VectorFailure(code);
    }

    internal static string RelativePath(JsonElement element, string name, string code)
    {
        var value = String(element, name, code);
        if (!RelativePathPattern().IsMatch(value) ||
            value.StartsWith('/') ||
            value.Contains("//", StringComparison.Ordinal) ||
            value.Split('/').Any(part => part is "." or ".."))
        {
            throw new VectorFailure(code);
        }

        return value;
    }
}
