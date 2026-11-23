using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace EntryControl.TestOnly.StandardNativeHost;

// Fresh-reader canonical parser for the two-original V3 proposal. Supplied
// bytes and context are not trusted file, token, ACL, author or durability
// evidence. A native protected reader and verified receipts are separate.
internal sealed class NativeHostReservationOriginalV3
{
    private readonly byte[] original;

    internal string Attempt { get; }
    internal string IntentSha256 { get; }
    internal string CanonicalSha256 { get; }
    internal string ExactCommand { get; }
    internal DateTimeOffset WrittenUtc { get; }
    internal byte[] CanonicalBytes() => (byte[])original.Clone();
    internal bool NativeEvidenceEstablished => false;
    internal bool AccountActivationAuthorized => false;
    internal bool UserCreationAuthorized => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;

    private NativeHostReservationOriginalV3(byte[] original,
        NativeHostUserIntentV3 intent, DateTimeOffset writtenUtc)
    {
        this.original = original;
        Attempt = intent.Attempt;
        IntentSha256 = intent.CanonicalSha256;
        CanonicalSha256 = NativeHostInputCodecV2.Hash(original);
        ExactCommand = NativeHostStageReservationV3.UserCommand(intent);
        WrittenUtc = writtenUtc;
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }

    private static bool LowerHex(string? value, int length) =>
        value is not null && value.Length == length &&
        value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private static DateTimeOffset ContextCreation(long fileTime)
    {
        try { return new DateTimeOffset(DateTime.FromFileTimeUtc(fileTime)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_RESERVATION_ORIGINAL_CONTEXT_TIME_REFUSED", e);
        }
    }

    // This method may run in a fresh process, but its supplied bound input,
    // context and originals are still assertions. It cannot adopt a previous
    // process's reservation or issue an account/child-creation decision.
    internal static NativeHostReservationOriginalV3 ParseCanonical(
        byte[]? suppliedReservation, byte[]? suppliedIntent,
        NativeHostBoundInputV2? bound, NativeHostPrefixSealV3? seal,
        NativeHostReservationContextV3? context, NativeHostRole author,
        DateTimeOffset nowUtc)
    {
        Need(bound is not null && seal is not null && context is not null &&
            suppliedReservation is { Length: > 0 and <= NativeHostStageReservationV3.MaximumReservationBytes } &&
            suppliedIntent is { Length: > 0 and <= NativeHostUserIntentV3.MaximumBytes } &&
            author == NativeHostRole.Owner,
            "NATIVE_RESERVATION_ORIGINAL_INPUT_REFUSED");
        byte[] reservation = (byte[])suppliedReservation.Clone();
        byte[] intentBytes = (byte[])suppliedIntent.Clone();
        NativeHostUserIntentV3 intent = NativeHostUserIntentV3.ParseOwnerOriginal(
            intentBytes, bound, seal, author);
        Need(intent.PreviousSha256 == seal.CanonicalSha256,
            "NATIVE_RESERVATION_ORIGINAL_PREFIX_BINDING_REFUSED");
        Need(context.HostSha256 == bound.Plan.HostSha256 &&
            context.BootSha256 == bound.Plan.BootSha256 &&
            context.OwnerSid == NativeHostProfileV2.OwnerSid &&
            context.WorkerSid == NativeHostProfileV2.OwnerSid &&
            context.OwnerProcessId != 0 && context.WorkerProcessId != 0 &&
            context.OwnerProcessId != context.WorkerProcessId &&
            context.OwnerCreationFileTimeUtc > 0 &&
            context.WorkerCreationFileTimeUtc > 0 &&
            LowerHex(context.OwnerPrimaryTokenId, 16) &&
            LowerHex(context.WorkerPrimaryTokenId, 16),
            "NATIVE_RESERVATION_ORIGINAL_CONTEXT_REFUSED");
        Need(nowUtc.Offset == TimeSpan.Zero &&
            nowUtc >= bound.Plan.IssuedUtc && nowUtc < bound.Plan.ExpiresUtc &&
            nowUtc >= bound.Approval.IssuedUtc && nowUtc < bound.Approval.ExpiresUtc,
            "NATIVE_RESERVATION_ORIGINAL_WINDOW_REFUSED");

        DateTimeOffset written;
        try {
            using JsonDocument document = JsonDocument.Parse(reservation,
                new JsonDocumentOptions { MaxDepth = 4, AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow });
            JsonElement root = document.RootElement;
            Need(root.ValueKind == JsonValueKind.Object,
                "NATIVE_RESERVATION_ORIGINAL_OBJECT_REFUSED");
            written = root.GetProperty("writtenUtc").GetDateTimeOffset();
        } catch (Exception e) when (e is JsonException or InvalidOperationException or
            FormatException or KeyNotFoundException) {
            throw new InvalidDataException("NATIVE_RESERVATION_ORIGINAL_SHAPE_REFUSED", e);
        }
        Need(written.Offset == TimeSpan.Zero && written >= seal.LastWrittenUtc &&
            written >= bound.Plan.IssuedUtc &&
            written < bound.Plan.ExpiresUtc &&
            written >= bound.Approval.IssuedUtc && written < bound.Approval.ExpiresUtc &&
            written <= nowUtc &&
            ContextCreation(context.OwnerCreationFileTimeUtc) <= written &&
            ContextCreation(context.WorkerCreationFileTimeUtc) <= written,
            "NATIVE_RESERVATION_ORIGINAL_TIME_REFUSED");

        byte[] expected = Canonical(intent, context, written);
        Need(reservation.AsSpan().SequenceEqual(expected),
            "NATIVE_RESERVATION_ORIGINAL_CANONICAL_OR_BINDING_REFUSED");
        return new NativeHostReservationOriginalV3(reservation, intent, written);
    }

    private static byte[] Canonical(NativeHostUserIntentV3 intent,
        NativeHostReservationContextV3 context, DateTimeOffset written)
    {
        using var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer)) {
            w.WriteStartObject();
            w.WriteString("schema", NativeHostStageReservationV3.ReservationSchema);
            w.WriteString("profileId", NativeHostProfileV2.ProfileId);
            w.WriteString("effects", NativeHostProfileV2.Effects);
            w.WriteString("attempt", intent.Attempt);
            w.WriteString("profileSha256", intent.ProfileSha256);
            w.WriteString("sourceSetSha256", intent.SourceSetSha256);
            w.WriteString("planSha256", intent.PlanSha256);
            w.WriteString("approvalSha256", intent.ApprovalSha256);
            w.WriteString("intentSha256", intent.CanonicalSha256);
            w.WriteString("previousSha256", intent.CanonicalSha256);
            w.WriteString("hostSha256", context.HostSha256);
            w.WriteString("bootSha256", context.BootSha256);
            w.WriteString("ownerSid", context.OwnerSid);
            w.WriteNumber("ownerProcessId", context.OwnerProcessId);
            w.WriteNumber("ownerCreationFileTimeUtc", context.OwnerCreationFileTimeUtc);
            w.WriteString("ownerPrimaryTokenId", context.OwnerPrimaryTokenId);
            w.WriteString("workerSid", context.WorkerSid);
            w.WriteNumber("workerProcessId", context.WorkerProcessId);
            w.WriteNumber("workerCreationFileTimeUtc", context.WorkerCreationFileTimeUtc);
            w.WriteString("workerPrimaryTokenId", context.WorkerPrimaryTokenId);
            w.WriteString("userSid", intent.UserSid);
            w.WriteString("userImage", NativeHostProfileV2.Image);
            w.WriteString("userImageSha256", intent.ImageSha256);
            w.WriteNumber("stage", (int)intent.Stage);
            w.WriteString("runId", intent.RunId);
            w.WriteString("nonce", intent.Nonce64);
            w.WriteString("exactCommand", NativeHostStageReservationV3.UserCommand(intent));
            w.WriteString("writtenUtc", written);
            w.WriteBoolean("nativeEvidenceEstablished", false);
            w.WriteBoolean("accountActivationAuthorized", false);
            w.WriteBoolean("userCreationAuthorized", false);
            w.WriteBoolean("grantAuthorized", false);
            w.WriteEndObject();
        }
        return buffer.ToArray();
    }
}
