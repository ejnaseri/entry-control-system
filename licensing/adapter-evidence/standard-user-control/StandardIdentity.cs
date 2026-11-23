using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.StandardUserControl;

internal static class StandardContract
{
    internal const string UserSid = "S-1-5-21-3058020570-171625005-1532683838-1023";
    internal const string OwnerSid = "S-1-5-21-3058020570-171625005-1532683838-1001";
    internal const string AccountName = "EcsLic008W03V1";
    internal const string AccountOwnedSha256 = "7b18035b8faa2fdc21f43e5ef88a66fdbd872d3a9f070f2d9069f5f2675d2305";
    internal const string AccountCompleteSha256 = "4e4878a24f5b4d99a585aba865af730958286a9cf8e088e346c0b8b6e7d8ad6b";
    internal const string Root = @"C:\ProgramData\Ecs.Lic008.StandardUserControlV1";
    internal const string SetupService = "Ecs.Lic008.StandardUserControlV1.Setup";
    internal const string GuardianService = "Ecs.Lic008.StandardUserControlV1.Guardian";
    internal const string KeyPrefix = "Ecs.Lic008.StandardUserControlV1.TEST_ONLY.";
    internal const string Administrators = "S-1-5-32-544";
    internal const string Users = "S-1-5-32-545";
    internal const string Interactive = "S-1-5-4";
    internal const string MediumIntegrity = "S-1-16-8192";

    internal static void Need([DoesNotReturnIf(false)] bool ok, string code)
    {
        if (!ok) throw new InvalidDataException(code);
    }
}

internal sealed record StandardGroup(string Sid, uint Attributes);
internal sealed record StandardToken(string User, string Owner, int Type, int Elevation,
    int ElevationType, string IntegritySid, bool HasRestrictions, bool AppContainer,
    bool QueryComplete, IReadOnlyList<StandardGroup>? Groups);
internal sealed record StandardProcessToken(uint ProcessId, long CreationFileTimeUtc,
    string ImagePath, StandardToken Token);

// Token-shape admission only. A successful result does not establish image
// custody, suspended-launch admission, held-handle exit or a crypto comparison.
// Only an independently captured process token may supply runtime observations.
internal static class StandardIdentity
{
    internal static bool CanonicalSid(string? sid)
    {
        if (sid is null || sid.Length is < 7 or > 184 || !sid.StartsWith("S-1-", StringComparison.Ordinal)) return false;
        string[] parts = sid.Split('-');
        if (parts.Length is < 4 or > 18 || parts[0] != "S" || parts[1] != "1") return false;
        for (int i = 2; i < parts.Length; i++) {
            string part = parts[i];
            if (part.Length == 0 || (part.Length > 1 && part[0] == '0') ||
                part.Any(c => c is < '0' or > '9') ||
                !ulong.TryParse(part, NumberStyles.None, CultureInfo.InvariantCulture, out ulong number) ||
                number > (i == 2 ? 281474976710655UL : uint.MaxValue)) return false;
        }
        return true;
    }

    internal static string Refusal(StandardToken? token)
    {
        if (token is null || !token.QueryComplete) return "STANDARD_TOKEN_QUERY_INCOMPLETE";
        if (token.User != StandardContract.UserSid || token.Owner != StandardContract.UserSid)
            return "STANDARD_TOKEN_WRONG_ACCOUNT";
        if (token.Type != 1 || token.Elevation != 0 || token.ElevationType != 1 ||
            token.IntegritySid != StandardContract.MediumIntegrity || token.HasRestrictions || token.AppContainer)
            return "STANDARD_TOKEN_CLASS_REFUSED";
        if (token.Groups is null || token.Groups.Count is < 2 or > 1024)
            return "STANDARD_TOKEN_GROUPS_INCOMPLETE";
        var seen = new HashSet<string>(StringComparer.Ordinal);
        bool interactive = false, users = false;
        foreach (var group in token.Groups) {
            if (group is null || !CanonicalSid(group.Sid) || !seen.Add(group.Sid))
                return "STANDARD_TOKEN_GROUP_SHAPE_REFUSED";
            // Presence is disqualifying even with zero/deny-only attributes.
            // WindowsPrincipal.IsInRole alone would miss a filtered Admin SID.
            if (group.Sid == StandardContract.Administrators) return "STANDARD_TOKEN_ADMINISTRATORS_PRESENT";
            if (group.Sid is StandardContract.Interactive or StandardContract.Users) {
                if ((group.Attributes & 4) == 0 || (group.Attributes & 16) != 0)
                    return "STANDARD_TOKEN_REQUIRED_GROUP_REFUSED";
                if (group.Sid == StandardContract.Interactive) interactive = true;
                else users = true;
            }
        }
        return interactive && users ? "NONE" : "STANDARD_TOKEN_REQUIRED_GROUP_MISSING";
    }

    internal static void Admit(StandardToken? token)
    {
        string refusal = Refusal(token);
        StandardContract.Need(refusal == "NONE", refusal);
    }
}
