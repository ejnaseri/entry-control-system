using System;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyScalarRegression;

// Separate harness, deliberately absent from the application build source set.
// The only native target is GetCurrentProcess with TOKEN_QUERY. Reflection is
// limited to the reviewed private scalar reader, never an application entry.
internal static class ControlScalarRegression
{
    private const string BaselineSha256 = "add4b35d175e23bf37a420329db435bacce71a532c80fcd3e791bdaa72750b5f";
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private sealed record SizeProbe(bool Success, int LastError, int RequiredLength);
    private sealed record QueryResult(bool Attempted, int Capacity, bool? Success, int? LastError, int? Written, int? Scalar);
    private sealed record ScalarResult(bool Returned, int? Scalar, string Category, int? HResult);
    private sealed record Observation(int InformationClass, SizeProbe SizeProbe, QueryResult AllocatedQuery,
        QueryResult FixedFourQuery, ScalarResult BaselineScalar, ScalarResult CorrectedScalar);

    private sealed class Target : IDisposable
    {
        private readonly FileStream pin;
        private readonly AssemblyLoadContext context;
        internal readonly MethodInfo Scalar;

        internal Target(string path, string expectedHash, string name)
        {
            Require(Path.IsPathFullyQualified(path) && Path.GetFullPath(path) == path &&
                path.Length <= 240 && char.IsAsciiLetterUpper(path[0]) && path[1] == ':' && path[2] == '\\' &&
                !path[3..].Any(c => c < ' ' || c is ':' or '/' or '"') && Hex(expectedHash));
            for (string? cursor = path; cursor is not null; cursor = Path.GetDirectoryName(cursor))
                Require((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) == 0);
            pin = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            context = new AssemblyLoadContext(name, isCollectible: true);
            try {
                Require(pin.Length is > 0 and <= 33554432 &&
                    Convert.ToHexString(SHA256.HashData(pin)).ToLowerInvariant() == expectedHash);
                // Different load contexts prevent identical assembly names from
                // silently resolving both comparisons to the first loaded DLL.
                var assembly = context.LoadFromAssemblyPath(path);
                Require(Path.GetFullPath(assembly.Location) == path && AssemblyLoadContext.GetLoadContext(assembly) == context);
                var type = assembly.GetType("EntryControl.TestOnly.ExportPolicyControl.NativeControlIdentity", true)!;
                Require(type.TypeInitializer is null);
                Scalar = type.GetMethod("Scalar", BindingFlags.NonPublic | BindingFlags.Static,
                    null, new[] { typeof(SafeAccessTokenHandle), typeof(int) }, null)!;
                Require(Scalar is not null && Scalar.ReturnType == typeof(int));
            }
            catch { context.Unload(); pin.Dispose(); throw; }
        }

        public void Dispose() { context.Unload(); pin.Dispose(); }
    }

    private static int Main(string[] args)
    {
        string stage = "arguments";
        try {
            Require(args is { Length: 5 } && args[0] == "--own-token" && args[2] == BaselineSha256 &&
                Hex(args[4]) && args[4] != args[2] && args[1] != args[3]);
            stage = "runtime";
            Require(OperatingSystem.IsWindows() && RuntimeInformation.ProcessArchitecture == Architecture.X64 &&
                Environment.Version.ToString() == "10.0.11");
            stage = "pinned-scalar-methods";
            using var baseline = new Target(args[1], args[2], "reviewed-baseline");
            using var corrected = new Target(args[3], args[4], "reviewed-inert-correction");
            Require(baseline.Scalar.Module.Assembly != corrected.Scalar.Module.Assembly);
            stage = "open-own-token";
            bool opened = OpenProcessToken(GetCurrentProcess(), 8, out var token);
            int openError = Marshal.GetLastWin32Error();
            using (token) {
                Require(opened && !token.IsInvalid);
                stage = "query-own-token";
                var rows = new[] { Observe(token, 8, baseline.Scalar, corrected.Scalar),
                    Observe(token, 20, baseline.Scalar, corrected.Scalar) };
                bool ordinaryPrimary = rows[0].FixedFourQuery.Scalar == 1 && rows[1].FixedFourQuery.Scalar == 0;
                bool directReadsAgree = rows.All(row => row.FixedFourQuery.Success == true && row.FixedFourQuery.Written == 4 &&
                    row.AllocatedQuery.Success == true && row.AllocatedQuery.Written == 4 &&
                    row.AllocatedQuery.Scalar == row.FixedFourQuery.Scalar);
                bool baselineFailureReproduced = !rows[1].SizeProbe.Success && rows[1].SizeProbe.LastError == 24 &&
                    rows[1].SizeProbe.RequiredLength == 4 && !rows[1].BaselineScalar.Returned &&
                    rows[1].BaselineScalar.Category == "VALIDATION" && rows[1].BaselineScalar.HResult == unchecked((int)0x80131501);
                bool correctedMatchesDirect = rows.All(row => row.CorrectedScalar.Returned &&
                    row.CorrectedScalar.Scalar == row.FixedFourQuery.Scalar);
                bool baselineTypeUnchanged = rows[0].BaselineScalar.Returned &&
                    rows[0].BaselineScalar.Scalar == rows[0].FixedFourQuery.Scalar;
                bool passed = ordinaryPrimary && directReadsAgree && baselineFailureReproduced &&
                    correctedMatchesDirect && baselineTypeUnchanged;
                Console.WriteLine(JsonSerializer.Serialize(new {
                    schemaVersion = 1, scope = "TEST_ONLY_EXPORT_POLICY_SCALAR_REGRESSION_V1",
                    runtime = Environment.Version.ToString(), processId = Environment.ProcessId,
                    context = "OWN_CURRENT_PROCESS_TOKEN_ONLY", requestedTokenAccess = 8,
                    tokenOpenSucceeded = opened, tokenOpenLastError = openError,
                    baselineAssemblySha256 = args[2], correctedAssemblySha256 = args[4], isolatedLoadContexts = true,
                    observations = rows, ordinaryPrimary, directReadsAgree, baselineFailureReproduced,
                    correctedMatchesDirect, baselineTypeUnchanged, passed,
                    localSystemServiceContextReproduced = false, elevationRequested = false,
                    serviceChanged = false, keysReadOrChanged = false, retainedArtifactsChanged = false,
                    physicalStageExecuted = false, securityAccepted = false, productionAccepted = false
                }, Json));
                return passed ? 0 : 2;
            }
        }
        catch (Exception error) {
            Console.WriteLine(JsonSerializer.Serialize(new {
                schemaVersion = 1, scope = "TEST_ONLY_EXPORT_POLICY_SCALAR_REGRESSION_FAILURE_V1",
                stage, category = Category(error), hResult = error.HResult,
                physicalStageExecuted = false, securityAccepted = false, productionAccepted = false
            }, Json));
            return 1;
        }
    }

    private static Observation Observe(SafeAccessTokenHandle token, int kind, MethodInfo baseline, MethodInfo corrected)
    {
        Require(kind is 8 or 20);
        bool sized = GetTokenInformation(token, kind, IntPtr.Zero, 0, out int required);
        int sizeError = Marshal.GetLastWin32Error();
        var allocated = required is >= 1 and <= 1048576 ? Query(token, kind, required)
            : new QueryResult(false, required, null, null, null, null);
        return new(kind, new(sized, sizeError, required), allocated, Query(token, kind, 4),
            InvokeScalar(baseline, token, kind), InvokeScalar(corrected, token, kind));
    }

    private static ScalarResult InvokeScalar(MethodInfo method, SafeAccessTokenHandle token, int kind)
    {
        try { return new(true, (int)method.Invoke(null, new object[] { token, kind })!, "NONE", null); }
        catch (Exception error) {
            if (error is TargetInvocationException && error.InnerException is not null) error = error.InnerException;
            return new(false, null, Category(error), error.HResult);
        }
    }

    private static QueryResult Query(SafeAccessTokenHandle token, int kind, int capacity)
    {
        IntPtr buffer = Marshal.AllocHGlobal(capacity);
        try {
            Marshal.Copy(new byte[capacity], 0, buffer, capacity);
            bool ok = GetTokenInformation(token, kind, buffer, capacity, out int written);
            int error = Marshal.GetLastWin32Error();
            return new(true, capacity, ok, error, written,
                ok && written == 4 && capacity >= 4 ? Marshal.ReadInt32(buffer) : null);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static bool Hex(string? value) => value is { Length: 64 } && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static void Require([DoesNotReturnIf(false)] bool condition) { if (!condition) throw new InvalidDataException(); }
    private static string Category(Exception error) => error is InvalidDataException ? "VALIDATION" :
        error is UnauthorizedAccessException ? "ACCESS" : error is IOException ? "IO" : "OTHER";
    [DllImport("kernel32.dll", ExactSpelling = true)] private static extern IntPtr GetCurrentProcess();
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenProcessToken(IntPtr process, uint access, out SafeAccessTokenHandle token);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(SafeAccessTokenHandle token, int kind, IntPtr buffer, int capacity, out int written);
}
