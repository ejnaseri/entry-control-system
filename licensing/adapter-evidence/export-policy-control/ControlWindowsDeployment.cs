using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace EntryControl.TestOnly.ExportPolicyControl;

// Deployment plumbing only. There is deliberately no callable physical CLI,
// automatic retry, stop/kill/delete operation, or retained-key operation here.
// The owner callback must authenticate the separately approved account and pins.
internal sealed class NativeControlDeployment : IControlDeployment
{
    private readonly Action requireOwner;
    private string? owner;
    private ControlSession? session;
    private bool rootCreated, deployAttempted, registered, registrationAttempted, borrowed, restoreAttempted;
    private bool setupStarted, setupProcessExited, guardianStarted, guardianProcessExited;
    private ControlServiceSnapshot? original;
    private ControlServiceStatusObservation? lastSetupObservation, lastGuardianObservation;
    private ControlRunTrace? setupTrace, guardianTrace;
    private const string ImagePath = ControlRules.Root + @"\bin\ExportPolicyControl.exe";

    internal NativeControlDeployment(Action requireOwner)
    { this.requireOwner = requireOwner ?? throw new ArgumentNullException(nameof(requireOwner)); }

    // No guard/native query: these immutable values were already observed by
    // the admitted Run. Reading them cannot grant process completion or custody.
    public ControlServiceStatusObservation? ReadLastServiceObservation(ControlRole role) => role switch {
        ControlRole.Setup => lastSetupObservation, ControlRole.Guardian => lastGuardianObservation, _ => null
    };
    public ControlRunDiagnostic? ReadLastRunDiagnostic(ControlRole role) => role switch {
        ControlRole.Setup => setupTrace?.Snapshot(), ControlRole.Guardian => guardianTrace?.Snapshot(), _ => null
    };
    private void RememberServiceObservation(ControlRole role, ServiceStatus status)
        => RememberServiceObservation(role, new ControlServiceStatusObservation(status.State, status.Pid, status.Win32Exit, status.SpecificExit));
    private void RememberServiceObservation(ControlRole role, ControlServiceStatusObservation observed)
    {
        if (role == ControlRole.Setup) { lastSetupObservation = observed; setupTrace?.Observe(observed); }
        else if (role == ControlRole.Guardian) { lastGuardianObservation = observed; guardianTrace?.Observe(observed); }
    }

    private void Guard()
    {
        requireOwner(); // Must be first: fake refusal tests cannot reach Windows.
        NativeControlIdentity.RuntimeGuard();
        using var threadIdentity = WindowsIdentity.GetCurrent(true);
        ControlRules.Need(threadIdentity is null, "CONTROL_DEPLOYMENT_IMPERSONATION_REFUSED");
        using var identity = NativeControlIdentity.OpenOwnerForMembership();
        ControlRules.Need(identity.User is not null && new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator),
            "CONTROL_DEPLOYMENT_ADMIN_REQUIRED");
        ControlRules.Need(GetTokenInformation(identity.AccessToken, 8, out int type, 4, out int written) && written == 4 && type == 1,
            "CONTROL_DEPLOYMENT_PRIMARY_TOKEN_REQUIRED");
        ControlRules.Need(GetTokenInformation(identity.AccessToken, 20, out int elevation, 4, out written) && written == 4 && elevation == 1,
            "CONTROL_DEPLOYMENT_ELEVATION_REQUIRED");
        string current = identity.User.Value;
        ControlRules.Need(owner is null || owner == current, "CONTROL_DEPLOYMENT_ACCOUNT_CHANGED");
        owner ??= current;
        if (session is not null) {
            ControlRules.Need(session.Plan.OwnerSid == current, "CONTROL_DEPLOYMENT_OWNER_MISMATCH");
            ControlRules.ValidateSession(session, DateTimeOffset.UtcNow);
        }
        requireOwner();
    }

    public ControlServiceSnapshot ObserveGuardian() { Guard(); return Snapshot(ControlRole.Guardian).Snapshot; }

    public void RequireFreshSetup()
    {
        Guard();
        WithManager(1, manager => {
            IntPtr service = OpenServiceW(manager, ControlRules.SetupService, 1);
            int error = Marshal.GetLastWin32Error();
            if (service != IntPtr.Zero) { CloseServiceHandle(service); throw new InvalidDataException("CONTROL_SETUP_ALREADY_REGISTERED_RETAIN"); }
            ControlRules.Need(error == 1060, "CONTROL_SETUP_ABSENCE_UNPROVEN"); return true;
        });
        Guard();
    }

    public void Deploy(ControlDeploymentBundle bundle)
    {
        Guard(); ControlRules.Need(!deployAttempted, "CONTROL_DEPLOY_ALREADY_ATTEMPTED"); deployAttempted = true;
        ControlController.ValidateBundle(bundle);
        ControlRules.ValidateSession(bundle.Session, DateTimeOffset.UtcNow);
        ControlRules.Need(bundle.Session.Plan.OwnerSid == owner, "CONTROL_DEPLOYMENT_OWNER_MISMATCH");
        // Freeze the caller's mutable arrays before the first external write.
        byte[] manifestBytes = (byte[])bundle.PackageManifest.Clone();
        var files = bundle.PackageFiles.ToDictionary(x => x.Key, x => (byte[])x.Value.Clone(), StringComparer.Ordinal);
        session = bundle.Session;
        var frozen = new ControlDeploymentBundle(session, manifestBytes, files);
        ControlController.ValidateBundle(frozen); Guard();
        using var ancestors = PinAncestors(false, null);
        CreateDirectory(ControlRules.Root, ProtectedControlStore.RuleOf("", true));
        rootCreated = true; // Never cleared, including partial deployment failure.
        foreach (string folder in new[] { "bin", "journal", "reports" }) {
            Guard(); using var root = PinAncestors(true, null);
            CreateDirectory(ControlRules.Root + "\\" + folder, ProtectedControlStore.RuleOf(folder, true));
            root.Check();
        }
        WriteDeploymentFile("plan.json", ControlRules.Serialize(session.Plan));
        WriteDeploymentFile("reservation.json", ControlRules.Serialize(session.Reservation));
        WriteDeploymentFile("package-manifest.json", manifestBytes);
        foreach (var file in ControlRules.Parse<ControlPackage>(manifestBytes).Files)
            WriteDeploymentFile("bin/" + file.Name, files[file.Name]);
        var reader = new ProtectedControlStore(ControlRole.Setup, Guard);
        ControlRules.Need(reader.Read("plan.json").SequenceEqual(ControlRules.Serialize(session.Plan)) &&
            reader.Read("reservation.json").SequenceEqual(ControlRules.Serialize(session.Reservation)) &&
            reader.Read("package-manifest.json").SequenceEqual(manifestBytes), "CONTROL_DEPLOYMENT_READBACK_REFUSED");
        foreach (var pair in files)
            ControlRules.Need(reader.Read("bin/" + pair.Key).SequenceEqual(pair.Value), "CONTROL_DEPLOYMENT_READBACK_REFUSED");
        ancestors.Check(); Guard();
    }

    private void RequirePins(ControlPins pins)
    {
        Guard(); ControlRules.ValidatePins(pins);
        ControlRules.Need(rootCreated && session is not null && session.Pins == pins, "CONTROL_DEPLOYMENT_SESSION_REQUIRED");
    }

    public void RegisterSetup(ControlPins pins)
    {
        RequirePins(pins); ControlRules.Need(!registrationAttempted, "CONTROL_SETUP_REGISTER_ALREADY_ATTEMPTED");
        registrationAttempted = true; RequireFreshSetup();
        string command = ControlController.ServiceCommand(ControlRole.Setup, pins);
        WithManager(1 | 2, manager => {
            Guard();
            IntPtr service = CreateServiceW(manager, ControlRules.SetupService, ControlRules.SetupService,
                1 | 2 | 4, 16, 3, 1, command, null, IntPtr.Zero, null, "LocalSystem", null);
            ControlRules.Need(service != IntPtr.Zero, "CONTROL_SETUP_CREATE_FAILED_RETAIN");
            try {
                Guard(); uint sidType = 1;
                ControlRules.Need(ChangeServiceConfig2W(service, 5, ref sidType), "CONTROL_SETUP_SID_CONFIG_FAILED_RETAIN");
            }
            finally { CloseServiceHandle(service); }
            return true;
        });
        var observed = Snapshot(ControlRole.Setup).Snapshot;
        RequireSetup(observed, command); registered = true; Guard();
    }

    private static void RequireSetup(ControlServiceSnapshot state, string command) => ControlRules.Need(
        state.Name == ControlRules.SetupService && state.BinaryPath == command && state.Account == "LocalSystem" &&
        state.ServiceType == 16 && state.StartType == 3 && state.ErrorControl == 1 && state.SidType == 1 &&
        state.State == 1 && state.ProcessId == 0, "CONTROL_SETUP_CONFIG_REFUSED");

    public void BorrowGuardian(ControlServiceSnapshot expected, ControlPins pins)
    {
        RequirePins(pins); ControlRules.Need(!borrowed && setupStarted && setupProcessExited && registered, "CONTROL_BORROW_STATE_REFUSED");
        ControlController.RequireSameStopped(Snapshot(ControlRole.Guardian).Snapshot, expected, ControlController.OriginalBinary);
        original = expected;
        // Mark intent before the change. Any failure retains the new root and
        // configuration for explicit review; a second borrow is never attempted.
        borrowed = true;
        WithService(ControlRole.Guardian, 2, service => {
            Guard(); ControlRules.Need(ChangeServiceConfigW(service, uint.MaxValue, uint.MaxValue, uint.MaxValue,
                ControlController.ServiceCommand(ControlRole.Guardian, pins), null, IntPtr.Zero, null, null, null, null),
                "CONTROL_GUARDIAN_BORROW_FAILED_RETAIN"); return true;
        });
        ControlController.RequireSameStopped(Snapshot(ControlRole.Guardian).Snapshot, expected,
            ControlController.ServiceCommand(ControlRole.Guardian, pins)); Guard();
    }

    public void RestoreGuardian(ControlServiceSnapshot expected, ControlPins pins)
    {
        RequirePins(pins);
        ControlRules.Need(borrowed && !restoreAttempted && guardianStarted && guardianProcessExited && original == expected,
            "CONTROL_RESTORE_PROCESS_UNPROVEN_RETAIN");
        restoreAttempted = true;
        ControlController.RequireSameStopped(Snapshot(ControlRole.Guardian).Snapshot, expected,
            ControlController.ServiceCommand(ControlRole.Guardian, pins));
        WithService(ControlRole.Guardian, 2, service => {
            Guard(); ControlRules.Need(ChangeServiceConfigW(service, uint.MaxValue, uint.MaxValue, uint.MaxValue,
                ControlController.OriginalBinary, null, IntPtr.Zero, null, null, null, null),
                "CONTROL_GUARDIAN_RESTORE_FAILED_RETAIN"); return true;
        });
        ControlController.RequireSameStopped(Snapshot(ControlRole.Guardian).Snapshot, expected, ControlController.OriginalBinary);
        Guard();
    }

    public ControlServiceRun Run(ControlRole role, ControlPins pins)
    {
        // Only memory before the original guard. A diagnostic is never a reason
        // to query SCM again, retry a run, read a report or grant restoration.
        var trace = new ControlRunTrace();
        if (role == ControlRole.Setup) setupTrace ??= trace;
        else if (role == ControlRole.Guardian) guardianTrace ??= trace;
        try { return RunObserved(role, pins, trace); }
        catch (Exception error) { trace.Failed(error); throw; }
    }

    private ControlServiceRun RunObserved(ControlRole role, ControlPins pins, ControlRunTrace trace)
    {
        RequirePins(pins); ControlRules.Role(role);
        string command = ControlController.ServiceCommand(role, pins);
        trace.At(ControlRunStage.InitialSnapshot);
        var before = Snapshot(role).Snapshot;
        trace.At(ControlRunStage.StartConfiguration);
        if (role == ControlRole.Setup) {
            ControlRules.Need(registered && !setupStarted, "CONTROL_SETUP_START_ALREADY_ATTEMPTED");
            RequireSetup(before, command); setupStarted = true;
        }
        else {
            ControlRules.Need(borrowed && !guardianStarted && original is not null, "CONTROL_GUARDIAN_START_STATE_REFUSED");
            ControlController.RequireSameStopped(before, original!, command); guardianStarted = true;
        }
        int observedPid = 0; DateTimeOffset observedStart = default; SafeProcessHandle? process = null;
        void RecordProcess(uint nativePid)
        {
            trace.At(ControlRunStage.ProcessId);
            int pid = checked((int)nativePid);
            ControlRules.Need(pid > 0 && (observedPid == 0 || observedPid == pid), "CONTROL_SERVICE_PID_CHANGED_RETAIN");
            if (process is not null) return;
            // Pin the process promptly: repeated full custody hashing before
            // opening it could miss an otherwise valid short-lived worker.
            trace.At(ControlRunStage.ProcessOpen);
            process = OpenProcess(0x101000, false, nativePid);
            ControlRules.Need(!process.IsInvalid, "CONTROL_PROCESS_HANDLE_UNAVAILABLE_RETAIN");
            trace.Opened(); trace.At(ControlRunStage.ProcessImage);
            var image = new StringBuilder(32768); int capacity = image.Capacity;
            ControlRules.Need(QueryFullProcessImageNameW(process, 0, image, ref capacity) &&
                image.ToString().Equals(ImagePath, StringComparison.OrdinalIgnoreCase), "CONTROL_PROCESS_IMAGE_REFUSED_RETAIN");
            trace.At(ControlRunStage.ProcessTime);
            ControlRules.Need(GetProcessTimes(process, out long created, out _, out _, out _) && created > 0,
                "CONTROL_PROCESS_TIME_REFUSED_RETAIN");
            trace.At(ControlRunStage.ProcessStart);
            observedStart = new DateTimeOffset(DateTime.FromFileTimeUtc(created));
            ControlRules.Need(observedStart >= session!.Reservation.ReservedUtc && observedStart <= DateTimeOffset.UtcNow,
                "CONTROL_PROCESS_START_REFUSED_RETAIN");
            observedPid = pid;
            trace.AdmitProcess(observedPid, observedStart);
        }
        var timer = Stopwatch.StartNew();
        try {
            trace.At(ControlRunStage.StartService);
            WithService(role, 16 | 4, service => {
                trace.At(ControlRunStage.StartGuard); Guard();
                trace.At(ControlRunStage.StartService);
                ControlRules.Need(StartServiceW(service, 0, IntPtr.Zero), "CONTROL_SERVICE_START_FAILED_RETAIN");
                // Read-only observation immediately after the admitted start;
                // later full context checks still precede any restoration.
                trace.At(ControlRunStage.InitialStatus);
                ControlServiceStatusObservation ReadStartedStatus()
                {
                    ControlRules.Need(QueryServiceStatusEx(service, 0, out var status, (uint)Marshal.SizeOf<ServiceStatus>(), out _) &&
                        status.Type == 16 && status.State is >= 1 and <= 7, "CONTROL_STARTED_STATUS_REFUSED_RETAIN");
                    return new(status.State, status.Pid, status.Win32Exit, status.SpecificExit);
                }
                var initial = ObserveInitialStatus(ReadStartedStatus(), ReadStartedStatus,
                    status => RememberServiceObservation(role, status),
                    () => ControlRules.ValidateSession(session!, DateTimeOffset.UtcNow),
                    () => timer.ElapsedMilliseconds, () => Thread.Sleep(25));
                if (initial is not null && CanObserveProcess(initial.State, initial.ProcessId)) RecordProcess(initial.ProcessId);
                return true;
            });
            while (timer.ElapsedMilliseconds < 45000) {
                trace.At(ControlRunStage.ObservationGuard); Guard();
                trace.At(ControlRunStage.ObservationSnapshot); var observed = Snapshot(role, rememberRunStatus: true);
                trace.At(ControlRunStage.ObservationConfiguration);
                ControlRules.Need(observed.Snapshot == before with { State = observed.Snapshot.State, ProcessId = observed.Snapshot.ProcessId },
                    "CONTROL_RUNNING_SERVICE_CONFIG_CHANGED_RETAIN");
                if (CanObserveProcess(observed.Snapshot.State, observed.Snapshot.ProcessId)) RecordProcess(observed.Snapshot.ProcessId);
                if (observed.Snapshot.State == 1 && observed.Snapshot.ProcessId == 0) {
                    trace.At(ControlRunStage.StoppedProcess);
                    ControlRules.Need(process is not null && observedPid > 0, "CONTROL_PROCESS_NOT_OBSERVED_RETAIN");
                    trace.At(ControlRunStage.ProcessWait);
                    uint waitResult = WaitForSingleObject(process!, 0); trace.Waited(waitResult);
                    if (waitResult == 0) {
                        trace.At(ControlRunStage.FinalSnapshot);
                        var final = Snapshot(role, rememberRunStatus: true);
                        trace.At(ControlRunStage.FinalConfiguration);
                        ControlRules.Need(final.Snapshot == before, "CONTROL_STOPPED_SERVICE_CHANGED_RETAIN");
                        trace.At(ControlRunStage.CompletionGuard); Guard();
                        if (role == ControlRole.Guardian) guardianProcessExited = true;
                        else setupProcessExited = true;
                        byte[] report;
                        trace.At(ControlRunStage.ReportRead);
                        try {
                            report = new ProtectedControlStore(role, Guard).Read(role == ControlRole.Setup ? "reports/setup.json" : "reports/guardian.json");
                            trace.Read(report.Length);
                        }
                        catch (Exception error) when (error is IOException or InvalidDataException or UnauthorizedAccessException) {
                            trace.ReadFailed(error); report = Array.Empty<byte>();
                        }
                        // Completion proof is independent of report validity.
                        // Controller restores first, then validates the report.
                        trace.At(ControlRunStage.ReturnGuard); Guard();
                        trace.At(ControlRunStage.Complete);
                        return new(report, observedPid, observedStart, true, final.Win32Exit, final.ServiceExit);
                    }
                }
                Thread.Sleep(25);
            }
            trace.At(ControlRunStage.Timeout);
            throw new InvalidDataException("CONTROL_SERVICE_OR_PROCESS_STILL_UNRESOLVED_RETAIN");
        }
        finally { process?.Dispose(); }
    }

    public void WriteControllerResult(byte[] bytes)
    {
        Guard(); ControlRules.Need(rootCreated && session is not null && bytes is { Length: > 0 and <= 2097152 },
            "CONTROL_RESULT_ROOT_REQUIRED");
        var rule = new ControlStoreRule(ProtectedControlStore.AdminSid, false, new[] {
            new ControlStoreAce(ProtectedControlStore.SystemSid, ProtectedControlStore.Full),
            new ControlStoreAce(ProtectedControlStore.AdminSid, ProtectedControlStore.Full)
        });
        WriteNew("controller-result.json", bytes, rule); Guard();
    }

    private void WriteDeploymentFile(string relative, byte[] bytes)
    {
        ControlRules.Need(relative is "plan.json" or "reservation.json" or "package-manifest.json" ||
            relative is "bin/ExportPolicyControl.exe" or "bin/ExportPolicyControl.dll" or
                "bin/ExportPolicyControl.runtimeconfig.json" or "bin/runtime-inventory.json", "CONTROL_DEPLOYMENT_FILE_REFUSED");
        WriteNew(relative, bytes, ProtectedControlStore.RuleOf(relative));
    }

    private void WriteNew(string relative, byte[] input, ControlStoreRule rule)
    {
        Guard(); ControlRules.Need(rootCreated && input is { Length: > 0 and <= 33554432 }, "CONTROL_DEPLOYMENT_WRITE_REFUSED");
        byte[] bytes = (byte[])input.Clone(); string path = ControlRules.Root + "\\" + relative.Replace('/', '\\');
        using var parents = PinAncestors(true, relative.Contains('/') ? relative.Split('/')[0] : null);
        byte[] descriptor = ProtectedControlStore.Descriptor(rule); var pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
        SafeFileHandle handle;
        try {
            Guard(); var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = pin.AddrOfPinnedObject() };
            handle = CreateFileW(path, 0xc0020080, 0, ref attributes, 1, 0x00200000, IntPtr.Zero);
        }
        finally { pin.Free(); }
        using (handle) {
            ControlRules.Need(!handle.IsInvalid, "CONTROL_DEPLOYMENT_CREATE_NEW_REFUSED_RETAIN"); Check(handle, path, rule);
            using var stream = new FileStream(handle, FileAccess.ReadWrite);
            ControlRules.Need(stream.Length == 0, "CONTROL_DEPLOYMENT_NEW_FILE_NOT_EMPTY");
            stream.Write(bytes); stream.Flush(true); stream.Position = 0;
            byte[] readback = new byte[bytes.Length]; stream.ReadExactly(readback);
            ControlRules.Need(stream.Length == bytes.Length && readback.SequenceEqual(bytes), "CONTROL_DEPLOYMENT_WRITE_CHANGED_RETAIN");
            Check(handle, path, rule); parents.Check(); Guard();
        }
    }

    private void CreateDirectory(string path, ControlStoreRule rule)
    {
        byte[] descriptor = ProtectedControlStore.Descriptor(rule); var pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
        try {
            Guard(); var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>(), Descriptor = pin.AddrOfPinnedObject() };
            ControlRules.Need(CreateDirectoryW(path, ref attributes), "CONTROL_DIRECTORY_EXISTS_OR_REFUSED_RETAIN");
        }
        finally { pin.Free(); }
        using var handle = OpenDirectory(path); Check(handle, path, rule); Guard();
    }

    private sealed class Ancestors : IDisposable
    {
        internal readonly List<(SafeFileHandle Handle, string Path, ControlStoreRule? Rule)> Items = new();
        internal void Check() { foreach (var row in Items) NativeControlDeployment.Check(row.Handle, row.Path, row.Rule); }
        public void Dispose() { for (int i = Items.Count - 1; i >= 0; i--) Items[i].Handle.Dispose(); }
    }

    private static Ancestors PinAncestors(bool root, string? child)
    {
        ControlRules.Need(child is null or "bin" or "journal" or "reports", "CONTROL_PARENT_NOT_LISTED");
        var result = new Ancestors();
        try {
            void Pin(string path, ControlStoreRule? rule) {
                var handle = OpenDirectory(path); result.Items.Add((handle, path, rule)); Check(handle, path, rule);
            }
            Pin(@"C:\", null); Pin(@"C:\ProgramData", null);
            if (root) Pin(ControlRules.Root, ProtectedControlStore.RuleOf("", true));
            if (child is not null) { ControlRules.Need(root, "CONTROL_PARENT_ROOT_REQUIRED"); Pin(ControlRules.Root + "\\" + child, ProtectedControlStore.RuleOf(child, true)); }
            result.Check(); return result;
        }
        catch { result.Dispose(); throw; }
    }

    private static SafeFileHandle OpenDirectory(string path)
    {
        var attributes = new SecurityAttributes { Length = Marshal.SizeOf<SecurityAttributes>() };
        var handle = CreateFileW(path, 0x20080, 1, ref attributes, 3, 0x02200000, IntPtr.Zero);
        if (handle.IsInvalid) { handle.Dispose(); throw new InvalidDataException("CONTROL_DIRECTORY_OPEN_REFUSED"); }
        return handle;
    }

    private static void Check(SafeFileHandle handle, string path, ControlStoreRule? rule)
    {
        ControlRules.Need(GetFileType(handle) == 1, "CONTROL_HANDLE_TYPE_REFUSED");
        ControlRules.Need(GetFileInformationByHandle(handle, out var info), "CONTROL_HANDLE_INFORMATION_REFUSED");
        bool directory = rule?.Directory ?? true;
        ControlRules.Need((info.Attributes & 0x400) == 0 && ((info.Attributes & 0x10) != 0) == directory &&
            (directory || info.Links == 1), "CONTROL_HANDLE_REPARSE_OR_LINK_REFUSED");
        var text = new StringBuilder(32768); uint count = GetFinalPathNameByHandleW(handle, text, (uint)text.Capacity, 0);
        ControlRules.Need(count > 0 && count < text.Capacity && text.ToString().Equals("\\\\?\\" + path, StringComparison.OrdinalIgnoreCase),
            "CONTROL_HANDLE_FINAL_PATH_REFUSED");
        if (rule is null) return;
        uint status = GetSecurityInfo(handle, 1, 5, out _, out _, out _, out _, out var descriptor);
        try {
            ControlRules.Need(status == 0 && descriptor != IntPtr.Zero, "CONTROL_HANDLE_SECURITY_QUERY_REFUSED");
            uint length = GetSecurityDescriptorLength(descriptor);
            ControlRules.Need(length is >= 20 and <= 65536, "CONTROL_HANDLE_DESCRIPTOR_SIZE_REFUSED");
            byte[] bytes = new byte[length]; Marshal.Copy(descriptor, bytes, 0, bytes.Length);
            ProtectedControlStore.ValidateDescriptor(bytes, rule);
        }
        finally { if (descriptor != IntPtr.Zero) LocalFree(descriptor); }
    }

    private (ControlServiceSnapshot Snapshot, uint Win32Exit, uint ServiceExit) Snapshot(ControlRole role, bool rememberRunStatus = false)
    {
        Guard();
        return WithService(role, 1 | 4, service => {
            uint triggerCount = ReadTriggerCount(service);
            RequireNoTriggers(triggerCount);
            bool first = QueryServiceConfigW(service, IntPtr.Zero, 0, out uint size);
            ControlRules.Need(!first && Marshal.GetLastWin32Error() == 122 && size >= Marshal.SizeOf<ServiceConfig>() && size <= 65536,
                "CONTROL_SERVICE_CONFIG_SIZE_REFUSED");
            IntPtr buffer = Marshal.AllocHGlobal((int)size);
            try {
                ControlRules.Need(QueryServiceConfigW(service, buffer, size, out _), "CONTROL_SERVICE_CONFIG_QUERY_REFUSED");
                var config = Marshal.PtrToStructure<ServiceConfig>(buffer);
                string name = NativeControlIdentity.ServiceName(role);
                string binary = ReadString(config.Path, buffer, (int)size), account = ReadString(config.Account, buffer, (int)size);
                string group = config.Group == IntPtr.Zero ? "" : ReadString(config.Group, buffer, (int)size);
                string display = ReadString(config.Display, buffer, (int)size);
                string[] dependencies = ReadMultiString(config.Dependencies, buffer, (int)size);
                ControlRules.Need(QueryServiceStatusEx(service, 0, out var status, (uint)Marshal.SizeOf<ServiceStatus>(), out _) &&
                    status.Type == config.Type && status.State is >= 1 and <= 7,
                    "CONTROL_SERVICE_STATUS_REFUSED");
                if (rememberRunStatus) RememberServiceObservation(role, status);
                using var hive = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
                using var key = hive.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\" + name, false);
                ControlRules.Need(key is not null, "CONTROL_SERVICE_REGISTRY_REFUSED");
                ControlRules.Need(key.GetValueKind("ServiceSidType") == RegistryValueKind.DWord && key.GetValue("ServiceSidType") is int,
                    "CONTROL_SERVICE_SID_TYPE_REFUSED");
                uint sidType = checked((uint)(int)key.GetValue("ServiceSidType")!);
                ControlRules.Need(key.GetValue("FailureActions", null) is null &&
                    (key.GetValue("FailureActionsOnNonCrashFailures", 0) is int failureFlag && failureFlag == 0),
                    "CONTROL_SERVICE_AUTO_RECOVERY_REFUSED");
                var values = new List<object>();
                foreach (string valueName in key.GetValueNames().OrderBy(x => x, StringComparer.Ordinal)) {
                    if (valueName.Equals("ImagePath", StringComparison.OrdinalIgnoreCase)) continue;
                    var kind = key.GetValueKind(valueName);
                    object? value = key.GetValue(valueName, null, RegistryValueOptions.DoNotExpandEnvironmentNames);
                    ControlRules.Need((kind is RegistryValueKind.String or RegistryValueKind.ExpandString or RegistryValueKind.MultiString or
                        RegistryValueKind.Binary or RegistryValueKind.DWord or RegistryValueKind.QWord) && value is not null,
                        "CONTROL_SERVICE_REGISTRY_VALUE_REFUSED");
                    values.Add(new { name = valueName, kind = (int)kind, value });
                }
                string other = ControlRules.Hash(ControlRules.Serialize(new {
                    name, account, config.Start, config.Type, config.Error, config.Tag, group, display, dependencies, sidType, triggerCount, values
                }));
                Guard(); return (new ControlServiceSnapshot(name, binary, account, config.Start, config.Type, config.Error, sidType,
                    status.State, status.Pid, other), status.Win32Exit, status.SpecificExit);
            }
            finally { Marshal.FreeHGlobal(buffer); }
        });
    }

    internal static void RequireNoTriggers(uint count) =>
        ControlRules.Need(count == 0, "CONTROL_SERVICE_TRIGGER_START_REFUSED");

    // SCM does not guarantee PID validity during start/stop pending. This
    // one-shot worker never pauses; only RUNNING may establish its process pin.
    internal static bool CanObserveProcess(uint state, uint pid) => state == 4 && pid > 0;

    // Read-only startup sampling on the already admitted service handle. Full
    // custody hashing between START_PENDING and RUNNING can miss a short worker.
    // Pending PIDs never become process pins. This returns an observation only;
    // the original image/time admission, held-handle wait and full guards follow.
    internal static ControlServiceStatusObservation? ObserveInitialStatus(ControlServiceStatusObservation first,
        Func<ControlServiceStatusObservation> queryNext, Action<ControlServiceStatusObservation> remember,
        Action requireCurrentSession, Func<long> elapsedMilliseconds, Action wait)
    {
        var status = first;
        while (true) {
            ControlRules.Need(status is not null && status.State is >= 1 and <= 7, "CONTROL_STARTED_STATUS_REFUSED_RETAIN");
            remember(status);
            requireCurrentSession();
            if (elapsedMilliseconds() >= 45000) return null;
            if (status.State != 2) return status;
            wait();
            // Cheap in-memory session/expiry admission, not native/custody work.
            // A changed/expired session aborts before another query or process pin.
            requireCurrentSession();
            if (elapsedMilliseconds() >= 45000) return null;
            status = queryNext();
        }
    }

    private static uint ReadTriggerCount(IntPtr service)
    {
        // Demand-start alone does not exclude trigger-start. Query SCM rather
        // than assuming that absence of a root registry value means no triggers.
        bool first = QueryServiceConfig2W(service, 8, IntPtr.Zero, 0, out uint size);
        ControlRules.Need(!first && Marshal.GetLastWin32Error() == 122 &&
            size >= Marshal.SizeOf<ServiceTriggerInfo>() && size <= 8192, "CONTROL_SERVICE_TRIGGER_SIZE_REFUSED");
        IntPtr buffer = Marshal.AllocHGlobal((int)size);
        try {
            ControlRules.Need(QueryServiceConfig2W(service, 8, buffer, size, out _),
                "CONTROL_SERVICE_TRIGGER_QUERY_REFUSED");
            return Marshal.PtrToStructure<ServiceTriggerInfo>(buffer).Count;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static string ReadString(IntPtr pointer, IntPtr buffer, int size)
    {
        long offset = pointer.ToInt64() - buffer.ToInt64();
        ControlRules.Need(pointer != IntPtr.Zero && offset >= 0 && offset <= size - 2 && offset % 2 == 0, "CONTROL_CONFIG_POINTER_REFUSED");
        var text = new StringBuilder();
        for (int i = 0; i < 16384 && offset + i * 2 + 2 <= size; i++) {
            char c = (char)Marshal.ReadInt16(pointer, i * 2); if (c == 0) return text.ToString(); text.Append(c);
        }
        throw new InvalidDataException("CONTROL_CONFIG_STRING_REFUSED");
    }

    private static string[] ReadMultiString(IntPtr pointer, IntPtr buffer, int size)
    {
        if (pointer == IntPtr.Zero) return Array.Empty<string>();
        var result = new List<string>();
        for (int i = 0; i < 256; i++) {
            string value = ReadString(pointer, buffer, size);
            if (value.Length == 0) return result.ToArray(); result.Add(value); pointer += checked((value.Length + 1) * 2);
        }
        throw new InvalidDataException("CONTROL_CONFIG_DEPENDENCIES_REFUSED");
    }

    private static T WithManager<T>(uint access, Func<IntPtr, T> work)
    {
        IntPtr manager = OpenSCManagerW(null, null, access);
        ControlRules.Need(manager != IntPtr.Zero, "CONTROL_SCM_OPEN_REFUSED");
        try { return work(manager); } finally { CloseServiceHandle(manager); }
    }

    private static T WithService<T>(ControlRole role, uint access, Func<IntPtr, T> work) => WithManager(1, manager => {
        IntPtr service = OpenServiceW(manager, NativeControlIdentity.ServiceName(role), access);
        ControlRules.Need(service != IntPtr.Zero, "CONTROL_SERVICE_OPEN_REFUSED");
        try { return work(service); } finally { CloseServiceHandle(service); }
    });

    [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { internal int Length; internal IntPtr Descriptor; internal int Inherit; }
    [StructLayout(LayoutKind.Sequential, Pack = 4)] private struct FileInfo { internal uint Attributes; internal long Creation, Access, Write; internal uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [StructLayout(LayoutKind.Sequential)] private struct ServiceConfig { internal uint Type, Start, Error; internal IntPtr Path, Group; internal uint Tag; internal IntPtr Dependencies, Account, Display; }
    [StructLayout(LayoutKind.Sequential)] private struct ServiceStatus { internal uint Type, State, Accepted, Win32Exit, SpecificExit, Checkpoint, WaitHint, Pid, Flags; }
    [StructLayout(LayoutKind.Sequential)] private struct ServiceTriggerInfo { internal uint Count; internal IntPtr Triggers, Reserved; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern SafeFileHandle CreateFileW(string path, uint access, uint share, ref SecurityAttributes attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateDirectoryW(string path, ref SecurityAttributes attributes);
    [DllImport("kernel32.dll")] private static extern uint GetFileType(SafeFileHandle handle);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityInfo(SafeFileHandle handle, uint type, uint info, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")] private static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetTokenInformation(SafeAccessTokenHandle token, int infoClass, out int data, int capacity, out int written);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenSCManagerW(string? machine, string? database, uint access);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenServiceW(IntPtr manager, string name, uint access);
    [DllImport("advapi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseServiceHandle(IntPtr handle);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateServiceW(IntPtr manager, string name, string display, uint access, uint type, uint start, uint error, string path, string? group, IntPtr tag, string? dependencies, string account, string? password);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool ChangeServiceConfig2W(IntPtr service, uint level, ref uint value);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceConfigW(IntPtr service, IntPtr config, uint size, out uint needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true, ExactSpelling = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceConfig2W(IntPtr service, uint level, IntPtr buffer, uint size, out uint needed);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceStatusEx(IntPtr service, uint level, out ServiceStatus status, uint size, out uint needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool ChangeServiceConfigW(IntPtr service, uint type, uint start, uint error, string path, string? group, IntPtr tag, string? dependencies, string? account, string? password, string? display);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool StartServiceW(IntPtr service, uint count, IntPtr args);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern SafeProcessHandle OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryFullProcessImageNameW(SafeProcessHandle process, uint flags, StringBuilder image, ref int length);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetProcessTimes(SafeProcessHandle process, out long created, out long exited, out long kernel, out long user);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(SafeProcessHandle handle, uint milliseconds);
}
