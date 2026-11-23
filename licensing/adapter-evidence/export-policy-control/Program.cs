using System;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;
using System.IO;

namespace EntryControl.TestOnly.ExportPolicyControl;

internal enum ControlEntryRoute { Service, Controller }

// Default and older capability builds stay inert. The purpose-specific capable
// build still requires strict route grammar before any native entry is reached.
internal static class Program
{
    internal static bool IsSelfTest(string[]? args) =>
        args is { Length: 1 } && args[0] == "--self-test";

    // Pure route/argument validation: no file, token, SCM or CNG access. Both
    // capable-build self-tests and the actual entry exercise this same parser.
    internal static ControlEntryRoute ParseControlRoute(string[] args)
    {
        if (args is { Length: > 0 } && args[0] == "--control-service") {
            ControlOwnerEntry.ParseService(args); return ControlEntryRoute.Service;
        }
        if (args is { Length: > 0 } && args[0] == "--control-controller") {
            ControlOwnerEntry.Parse(args); return ControlEntryRoute.Controller;
        }
        throw new InvalidDataException("CONTROL_ENTRY_ARGUMENTS_REFUSED");
    }

    internal static int Main(string[] args)
    {
        if (!IsSelfTest(args)) {
            // The default gate closes before parsing. Only the exact reviewed
            // capability build can proceed, and malformed routes fail purely.
            if (NativeControlRuntime.PhysicalEnabled && ControlOwnerEntry.PhysicalEnabled) {
                try {
                    var route = ParseControlRoute(args);
                    if (route == ControlEntryRoute.Service) {
                        var input = ControlOwnerEntry.ParseService(args);
                        NativeControlRuntime.Dispatch(input.Role, input.Pins); return 0;
                    }
                    if (route == ControlEntryRoute.Controller) {
                        ControlOwnerEntry.Dispatch(args); return 0;
                    }
                }
                catch { Console.Error.WriteLine("EXPORT_POLICY_CONTROL_FAILED_OR_REFUSED_RETAIN"); return 1; }
            }
            Console.Error.WriteLine("EXPORT_POLICY_CONTROL_ENTRY_CLOSED");
            return 2;
        }
        try {
            var components = new Dictionary<string, int>();
            void Check(string name, Func<int> run) {
                try { components.Add(name, run()); }
                catch { Console.Error.WriteLine("EXPORT_POLICY_TEST_COMPONENT_FAILED:" + name); throw; }
            }
            Check("comparison", PureTests.Run);
            Check("keys", NativeKeysTests.SelfTest);
            Check("store", ControlStoreTests.Run);
            Check("identity", NativeControlIdentity.SelfTest);
            Check("service", NativeControlService.SelfTest);
            Check("worker", NativeControlWorker.SelfTest);
            Check("lifecycle", ControlLifecycleTests.Run);
            Check("admission", NativeControlAdmissionTests.Run);
            Check("controller", ControlControllerTests.Run);
            Check("startupDiagnostics", ControlStartupDiagnosticsTests.Run);
            Check("placement", ControlPlacementTests.Run);
            int cases = components.Values.Sum();
            Console.WriteLine(JsonSerializer.Serialize(new {
                scope = "TEST_ONLY_EXPORT_POLICY_CONTROL_PURE_V1",
                cases, components,
                physicalExecutionEnabled = ControlCapability.Enabled,
                capability = ControlCapability.Enabled ? ControlCapability.Symbol : "NONE",
                physicalTested = false,
                securityAccepted = false,
                productionAccepted = false
            }));
            return 0;
        }
        catch {
            Console.Error.WriteLine("EXPORT_POLICY_CONTROL_SELF_TEST_FAILED");
            return 1;
        }
    }
}
