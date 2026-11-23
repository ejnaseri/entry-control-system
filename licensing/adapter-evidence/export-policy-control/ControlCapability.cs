namespace EntryControl.TestOnly.ExportPolicyControl;

// One purpose-specific build capability. Arguments, environment and older
// pilot/diagnostic/export-control symbols cannot enable this boundary.
// Enabled means the reviewed entry may perform its own full admission; it is
// neither owner approval nor evidence of a physical test/security acceptance.
internal static class ControlCapability
{
    internal const string Symbol = "TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5";
    internal static bool Enabled {
        get {
#if TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5
            return true;
#else
            return false;
#endif
        }
    }
}
