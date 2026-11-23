using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Linq;
using System.Threading;

namespace EntryControl.TestOnly.StandardNativeHost;

internal sealed record NativeHostFileIdInfoV2(ulong VolumeSerialNumber,
    string FileId128LowerHex);
internal sealed record NativeHostOriginOpenWitnessV2(ulong ParentHandleObjectId,
    NativeHostFileIdInfoV2 ParentId, string Leaf);
internal sealed record NativeHostOriginObservationV2(string FinalPath, uint Type,
    uint Attributes, uint LinkCount, NativeHostFileIdInfoV2 Id,
    long CreationFileTimeUtc, long Length, ulong HandleObjectId,
    NativeHostOriginOpenWitnessV2? OpenWitness);
internal sealed record NativeHostOriginInputV2(NativeHostStoreFileV2 File,
    byte[] Original);
internal sealed record NativeHostOriginAclPinV2(string Path, string DescriptorSha256);
internal sealed record NativeHostOriginTargetV2(string Path, string? ParentPath,
    string Leaf, bool Directory, NativeHostStoreFileV2? InputFile);
internal sealed record NativeHostOriginPinV2(NativeHostOriginTargetV2 Target,
    NativeHostOriginObservationV2 Origin, string DescriptorSha256,
    string? ContentSha256);
internal sealed record NativeHostOriginAttemptV2(NativeHostOriginTargetV2 Target,
    bool OpenEntered, bool HandleAttached, bool Inspected, bool Accepted);

// These handles and observations are injected assertions. The future native
// adapter must obtain and root actual handles before it can report a fact.
internal interface INativeHostOriginHandleV2 : IDisposable
{
    NativeHostOriginObservationV2 Inspect();
    byte[] Descriptor();
    byte[] ReadBounded(int maximum);
}

internal sealed class NativeHostOriginHandleSlotV2
{
    private INativeHostOriginHandleV2? handle;
    private readonly object gate = new();
    private readonly List<INativeHostOriginHandleV2> retained = new();
    internal NativeHostOriginTargetV2 Target { get; }
    internal INativeHostOriginHandleV2? Handle => Volatile.Read(ref handle);
    internal int RetainedCount { get { lock (gate) return retained.Count; } }
    internal NativeHostOriginHandleSlotV2(NativeHostOriginTargetV2 target) => Target = target;
    // A backend that obtains a native output must attach it to this already
    // rooted slot before any later validation or callback can throw.
    internal void Attach(INativeHostOriginHandleV2 supplied)
    {
        if (supplied is null) throw new InvalidDataException("NATIVE_ORIGIN_SLOT_NULL_HANDLE");
        lock (gate) {
            retained.Add(supplied); // quarantine even a second unknown output
            if (handle is not null)
                throw new InvalidDataException("NATIVE_ORIGIN_SLOT_ALREADY_ATTACHED");
            Volatile.Write(ref handle, supplied);
        }
    }
}

internal interface INativeHostOriginBackendV2
{
    void OpenVolumeRoot(NativeHostOriginHandleSlotV2 output);
    void OpenChild(INativeHostOriginHandleV2 heldParent, string exactLeaf,
        bool directory, NativeHostOriginHandleSlotV2 output);
}

internal interface INativeHostOriginGuardV2
{
    // Must eventually prove current Owner/token, host/boot, no impersonation,
    // approved protected root and scope. This pure callback proves none of it.
    void Verify(NativeHostBoundInputV2 bound, string point);
}

// A bounded sequence of injected samples, never an atomic filesystem
// snapshot. Even a completed model cannot prove continuous namespace custody.
internal sealed record NativeHostOriginSnapshotV2(string Attempt,
    string PlanSha256, string ApprovalSha256, string SourceSetSha256,
    IReadOnlyList<NativeHostOriginPinV2> Pins)
{
    internal bool FullNativeFileIdentityEstablished => false;
    internal bool ProtectedAclEstablished => false;
    internal bool OriginalBytesPhysicallyEstablished => false;
    internal bool CrossProcessCustodyEstablished => false;
    internal bool PhysicalAdmission => false;
    internal bool GrantAuthorized => false;
    internal bool Lic008Closed => false;
}

// A fixed, pure model of the V2 input-origin lease only. It covers six held
// directories and the eight StageStore input leaves. It does not create the
// root, touch Win32, admit runtime/hostfxr leaves or import cross-process state.
internal sealed class NativeHostOriginLeaseV2
{
    private const int MaximumInputBytes = 4194304;
    private static readonly NativeHostStoreFileV2[] InputOrder = {
        NativeHostStoreFileV2.Profile, NativeHostStoreFileV2.SourceSet,
        NativeHostStoreFileV2.RuntimeInventory, NativeHostStoreFileV2.PackageManifest,
        NativeHostStoreFileV2.AccountOwned, NativeHostStoreFileV2.AccountComplete,
        NativeHostStoreFileV2.Plan, NativeHostStoreFileV2.Approval
    };
    private static readonly object RetainedGate = new();
    private static readonly HashSet<NativeHostOriginLeaseV2> Retained = new();
    private readonly NativeHostBoundInputV2 bound;
    private readonly INativeHostOriginBackendV2 backend;
    private readonly INativeHostOriginGuardV2 guard;
    private readonly Func<DateTimeOffset> utcNow;
    private readonly NativeHostOriginTargetV2[] targets;
    private readonly Dictionary<NativeHostStoreFileV2, byte[]> originals;
    private readonly Dictionary<string, string> aclPins;
    private readonly Dictionary<string, NativeHostOriginHandleSlotV2> slots = new(StringComparer.Ordinal);
    private readonly Dictionary<string, NativeHostOriginPinV2> pins = new(StringComparer.Ordinal);
    private readonly Dictionary<string, byte[]> descriptorOriginals = new(StringComparer.Ordinal);
    private readonly List<NativeHostOriginAttemptV2> attempts = new();
    private readonly object evidenceGate = new();
    private DateTimeOffset? lastUtc;
    private int state; // 0 new, 1 entered, 2 completed, 3 faulted
    private int active;

    internal bool Faulted => Volatile.Read(ref state) == 3;
    internal bool Completed => Volatile.Read(ref state) == 2; // traversal only
    internal bool PhysicalAdmission => false;
    internal int RetainedHandleCount { get { lock (evidenceGate) {
        if (active != 0) {
            Volatile.Write(ref state, 3);
            throw new InvalidDataException("NATIVE_ORIGIN_PENDING_HANDLE_COUNT_REFUSED");
        }
        return slots.Values.Sum(s => s.RetainedCount);
    } } }
    internal IReadOnlyList<NativeHostOriginTargetV2> Targets => Array.AsReadOnly(targets);

    private NativeHostOriginLeaseV2(NativeHostBoundInputV2 bound,
        NativeHostOriginTargetV2[] targets,
        Dictionary<NativeHostStoreFileV2, byte[]> originals,
        Dictionary<string, string> aclPins,
        INativeHostOriginBackendV2 backend, INativeHostOriginGuardV2 guard,
        Func<DateTimeOffset> utcNow)
    {
        this.bound = bound;
        this.targets = targets;
        this.originals = originals;
        this.aclPins = aclPins;
        this.backend = backend;
        this.guard = guard;
        this.utcNow = utcNow;
    }

    private static void Need([DoesNotReturnIf(false)] bool condition, string code)
    {
        if (!condition) throw new InvalidDataException(code);
    }
    private static bool LowerHex(string? value, int length) => value is not null &&
        value.Length == length && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static string Hash(ReadOnlySpan<byte> bytes) => NativeHostInputCodecV2.Hash(bytes);

    private static NativeHostOriginTargetV2[] FixedTargets(NativeHostProfileV2 profile)
    {
        string volume = @"C:\";
        string programData = @"C:\ProgramData";
        string root = NativeHostProfileV2.Root;
        string records = root + @"\records";
        string attempt = profile.RecordRoot;
        string input = attempt + @"\input";
        Need(root == programData + @"\Ecs.Lic008.StandardNativeHostV1" &&
            attempt == records + @"\" + profile.Attempt,
            "NATIVE_ORIGIN_FIXED_ROOT_REFUSED");
        var result = new List<NativeHostOriginTargetV2> {
            new(volume, null, "", true, null),
            new(programData, volume, "ProgramData", true, null),
            new(root, programData, "Ecs.Lic008.StandardNativeHostV1", true, null),
            new(records, root, "records", true, null),
            new(attempt, records, profile.Attempt, true, null),
            new(input, attempt, "input", true, null)
        };
        Need(InputOrder.Select((file, index) => (int)file == index).All(x => x),
            "NATIVE_ORIGIN_INPUT_ENUM_CHANGED");
        foreach (NativeHostStoreFileV2 file in InputOrder) {
            string relative = NativeHostStageStoreV2.Relative(file);
            Need(relative.StartsWith(@"input\", StringComparison.Ordinal),
                "NATIVE_ORIGIN_INPUT_MAPPING_REFUSED");
            string leaf = relative[@"input\".Length..];
            Need(leaf.Length is > 0 and <= 96 && !leaf.Contains('\\') &&
                !leaf.Contains('/') && !leaf.Contains(':') && leaf != "." && leaf != "..",
                "NATIVE_ORIGIN_INPUT_LEAF_REFUSED");
            result.Add(new(input + @"\" + leaf, input, leaf, false, file));
        }
        Need(result.Count == 14,
            "NATIVE_ORIGIN_FIXED_GRAPH_REFUSED");
        return result.ToArray();
    }

    // All eight originals and descriptor pins are copied/checked before any
    // backend call. ACL hashes are injected stable pins, not V2 ACL policy or
    // proof that a protected DACL was actually installed.
    internal static NativeHostOriginLeaseV2 Begin(NativeHostBoundInputV2? bound,
        IReadOnlyList<NativeHostOriginInputV2>? inputs,
        IReadOnlyList<NativeHostOriginAclPinV2>? descriptorPins,
        INativeHostOriginBackendV2? backend,
        INativeHostOriginGuardV2? guard, Func<DateTimeOffset>? utcNow)
    {
        Need(bound is not null && bound.Profile is not null && bound.Plan is not null &&
            bound.Approval is not null && backend is not null && guard is not null &&
            utcNow is not null && inputs is { Count: 8 },
            "NATIVE_ORIGIN_BOUND_INPUT_REQUIRED");
        NativeHostOriginTargetV2[] targets = FixedTargets(bound.Profile);
        var originals = new Dictionary<NativeHostStoreFileV2, byte[]>();
        long total = 0;
        for (int index = 0; index < 8; index++) {
            NativeHostOriginInputV2? item = inputs[index];
            Need(item is not null && item.File == InputOrder[index] &&
                item.Original is { Length: > 0 and <= MaximumInputBytes },
                "NATIVE_ORIGIN_INPUT_ORDER_OR_SIZE_REFUSED");
            byte[] bytes = (byte[])item.Original.Clone();
            total = checked(total + bytes.Length);
            Need(total <= 8L * MaximumInputBytes,
                "NATIVE_ORIGIN_INPUT_AGGREGATE_REFUSED");
            originals.Add(item.File, bytes);
        }
        byte[] profile = originals[NativeHostStoreFileV2.Profile];
        byte[] source = originals[NativeHostStoreFileV2.SourceSet];
        byte[] inventory = originals[NativeHostStoreFileV2.RuntimeInventory];
        byte[] manifest = originals[NativeHostStoreFileV2.PackageManifest];
        byte[] plan = originals[NativeHostStoreFileV2.Plan];
        byte[] approval = originals[NativeHostStoreFileV2.Approval];
        NativeHostProfileV2 parsedProfile = NativeHostProfileV2.ParseCanonical(profile);
        NativeHostPlanV2 parsedPlan = NativeHostInputCodecV2.ParsePlan(plan, parsedProfile);
        NativeHostApprovalV2 parsedApproval = NativeHostInputCodecV2.ParseApproval(approval, parsedPlan);
        IReadOnlyList<NativeHostFilePinV2> parsedInventory =
            NativeHostInputCodecV2.ParseRuntimeInventory(inventory, parsedProfile);
        Need(parsedPlan.ProfileSha256 == Hash(profile) &&
            parsedPlan.SourceSetSha256 == Hash(source) &&
            parsedPlan.PackageManifestSha256 == Hash(manifest) &&
            parsedPlan.RuntimeInventorySha256 == Hash(inventory) &&
            parsedInventory.SequenceEqual(parsedPlan.FrameworkInventory),
            "NATIVE_ORIGIN_ORIGINAL_CHAIN_REFUSED");
        var rebound = new NativeHostBoundInputV2(parsedProfile, parsedPlan, parsedApproval);
        Need(rebound.Profile.CanonicalSha256 == bound.Profile.CanonicalSha256 &&
            rebound.Plan.CanonicalSha256 == bound.Plan.CanonicalSha256 &&
            rebound.Approval.CanonicalSha256 == bound.Approval.CanonicalSha256 &&
            rebound.Profile.Attempt == bound.Profile.Attempt &&
            rebound.Profile.SourceSetSha256 == bound.Profile.SourceSetSha256 &&
            rebound.Plan.ProfileSha256 == bound.Plan.ProfileSha256 &&
            rebound.Plan.PackageManifestSha256 == bound.Plan.PackageManifestSha256 &&
            rebound.Plan.RuntimeInventorySha256 == bound.Plan.RuntimeInventorySha256 &&
            rebound.Approval.PlanSha256 == bound.Approval.PlanSha256 &&
            Hash(originals[NativeHostStoreFileV2.AccountOwned]) == NativeHostProfileV2.AccountOwnedSha256 &&
            Hash(originals[NativeHostStoreFileV2.AccountComplete]) == NativeHostProfileV2.AccountCompleteSha256,
            "NATIVE_ORIGIN_EIGHT_ORIGINALS_REFUSED");
        Need(descriptorPins is { Count: 14 }, "NATIVE_ORIGIN_ACL_PINS_REQUIRED");
        var acl = new Dictionary<string, string>(StringComparer.Ordinal);
        for (int index = 0; index < targets.Length; index++) {
            NativeHostOriginAclPinV2? pin = descriptorPins[index];
            Need(pin is not null && pin.Path == targets[index].Path &&
                LowerHex(pin.DescriptorSha256, 64) &&
                acl.TryAdd(pin.Path, pin.DescriptorSha256),
                "NATIVE_ORIGIN_ACL_PIN_ORDER_REFUSED");
        }
        return new NativeHostOriginLeaseV2(rebound, targets, originals, acl,
            backend, guard, utcNow);
    }

    private DateTimeOffset Time()
    {
        DateTimeOffset now = utcNow();
        Need(Volatile.Read(ref state) == 1 && now.Offset == TimeSpan.Zero &&
            now >= bound.Plan.IssuedUtc && now < bound.Plan.ExpiresUtc &&
            now >= bound.Approval.IssuedUtc && now < bound.Approval.ExpiresUtc &&
            (lastUtc is null || now >= lastUtc.Value),
            "NATIVE_ORIGIN_WINDOW_OR_REENTRY_REFUSED");
        lastUtc = now;
        return now;
    }
    private void Guard(string point)
    {
        _ = Time();
        guard.Verify(bound, point);
        _ = Time();
    }
    private T Invoke<T>(string point, Func<T> call)
    {
        Guard("BEFORE_" + point);
        T result = call();
        Need(Volatile.Read(ref state) == 1,
            "NATIVE_ORIGIN_REENTRY_POISONED");
        Guard("AFTER_" + point);
        return result;
    }

    private static void ValidateIdentity(NativeHostFileIdInfoV2? id)
    {
        Need(id is not null && id.VolumeSerialNumber != 0 &&
            LowerHex(id.FileId128LowerHex, 32) &&
            id.FileId128LowerHex != new string('0', 32),
            "NATIVE_ORIGIN_FULL_FILE_ID_REFUSED");
    }
    private void ValidateObservation(NativeHostOriginTargetV2 target,
        NativeHostOriginObservationV2? value,
        NativeHostOriginObservationV2? parent)
    {
        Need(value is not null && value.FinalPath == @"\\?\" + target.Path &&
            value.Type == 1 && value.LinkCount == 1 &&
            (value.Attributes & 0x1400u) == 0 &&
            ((value.Attributes & 0x10u) != 0) == target.Directory &&
            value.HandleObjectId != 0 && value.Length >= 0,
            "NATIVE_ORIGIN_OBJECT_REFUSED");
        ValidateIdentity(value.Id);
        if (parent is null) {
            Need(target.ParentPath is null && value.OpenWitness is null,
                "NATIVE_ORIGIN_VOLUME_WITNESS_REFUSED");
        } else {
            Need(value.OpenWitness is not null &&
                value.OpenWitness.ParentHandleObjectId == parent.HandleObjectId &&
                value.OpenWitness.ParentId == parent.Id &&
                value.OpenWitness.Leaf == target.Leaf &&
                value.Id.VolumeSerialNumber == parent.Id.VolumeSerialNumber &&
                value.HandleObjectId != parent.HandleObjectId,
                "NATIVE_ORIGIN_RELATIVE_WITNESS_REFUSED");
        }
        DateTimeOffset created;
        try { created = new DateTimeOffset(DateTime.FromFileTimeUtc(value.CreationFileTimeUtc)); }
        catch (ArgumentOutOfRangeException e) {
            throw new InvalidDataException("NATIVE_ORIGIN_CREATION_TIME_REFUSED", e);
        }
        DateTimeOffset now = Time();
        Need(value.CreationFileTimeUtc > 0 && created <= now &&
            (target.Path is @"C:\" or @"C:\ProgramData" ||
                created >= bound.Approval.IssuedUtc),
            "NATIVE_ORIGIN_CREATION_WINDOW_REFUSED");
    }

    private NativeHostOriginPinV2 InspectTarget(NativeHostOriginTargetV2 target,
        INativeHostOriginHandleV2 handle,
        NativeHostOriginObservationV2? parent)
    {
        NativeHostOriginObservationV2 first = Invoke("INSPECT_" + target.Path,
            handle.Inspect);
        ValidateObservation(target, first, parent);
        byte[] descriptor = Invoke("DESCRIPTOR_" + target.Path,
            () => handle.Descriptor() is { } raw ? (byte[])raw.Clone() : Array.Empty<byte>());
        Need(descriptor is { Length: >= 20 and <= 65536 } &&
            Hash(descriptor) == aclPins[target.Path],
            "NATIVE_ORIGIN_ACL_DIGEST_REFUSED");
        string? contentSha = null;
        if (target.InputFile is NativeHostStoreFileV2 file) {
            byte[] expected = originals[file];
            Need(first.Length == expected.Length,
                "NATIVE_ORIGIN_INPUT_LENGTH_REFUSED");
            byte[] actual = Invoke("READ_" + target.Path,
                () => handle.ReadBounded(MaximumInputBytes) is { } raw ?
                    (byte[])raw.Clone() : Array.Empty<byte>());
            Need(actual is not null && actual.AsSpan().SequenceEqual(expected),
                "NATIVE_ORIGIN_INPUT_BYTES_REFUSED");
            contentSha = Hash(actual);
        }
        NativeHostOriginObservationV2 after = Invoke("REINSPECT_" + target.Path,
            handle.Inspect);
        Need(after == first, "NATIVE_ORIGIN_CHANGED_DURING_READ");
        byte[] afterDescriptor = Invoke("REDESCRIPTOR_" + target.Path,
            () => handle.Descriptor() is { } raw ? (byte[])raw.Clone() : Array.Empty<byte>());
        Need(afterDescriptor is not null && afterDescriptor.AsSpan().SequenceEqual(descriptor),
            "NATIVE_ORIGIN_ACL_CHANGED_DURING_READ");
        descriptorOriginals.Add(target.Path, descriptor);
        return new(target, first, Hash(descriptor), contentSha);
    }

    private void RecheckParent(NativeHostOriginTargetV2 target)
    {
        if (target.ParentPath is null) return;
        NativeHostOriginPinV2 pin = pins[target.ParentPath];
        INativeHostOriginHandleV2 handle = slots[target.ParentPath].Handle!;
        NativeHostOriginObservationV2 current = Invoke("PARENT_INSPECT_" + target.Path,
            handle.Inspect);
        Need(current == pin.Origin, "NATIVE_ORIGIN_PARENT_CHANGED");
        byte[] descriptor = Invoke("PARENT_DESCRIPTOR_" + target.Path,
            () => handle.Descriptor() is { } raw ? (byte[])raw.Clone() : Array.Empty<byte>());
        Need(descriptor.AsSpan().SequenceEqual(descriptorOriginals[target.ParentPath]) &&
            Hash(descriptor) == pin.DescriptorSha256,
            "NATIVE_ORIGIN_PARENT_ACL_CHANGED");
    }

    private void FinalSweep()
    {
        Guard("BEFORE_FINAL_SWEEP");
        foreach (NativeHostOriginTargetV2 target in targets) {
            INativeHostOriginHandleV2 handle = slots[target.Path].Handle!;
            NativeHostOriginPinV2 pinned = pins[target.Path];
            NativeHostOriginObservationV2 current = Invoke("FINAL_INSPECT_" + target.Path,
                handle.Inspect);
            Need(current == pinned.Origin, "NATIVE_ORIGIN_FINAL_OBJECT_CHANGED");
            byte[] descriptor = Invoke("FINAL_DESCRIPTOR_" + target.Path,
                () => handle.Descriptor() is { } raw ? (byte[])raw.Clone() : Array.Empty<byte>());
            Need(descriptor.AsSpan().SequenceEqual(descriptorOriginals[target.Path]) &&
                Hash(descriptor) == pinned.DescriptorSha256,
                "NATIVE_ORIGIN_FINAL_ACL_CHANGED");
            if (target.InputFile is NativeHostStoreFileV2 file) {
                byte[] currentBytes = Invoke("FINAL_READ_" + target.Path,
                    () => handle.ReadBounded(MaximumInputBytes) is { } raw ?
                        (byte[])raw.Clone() : Array.Empty<byte>());
                Need(currentBytes.AsSpan().SequenceEqual(originals[file]) &&
                    Hash(currentBytes) == pinned.ContentSha256,
                    "NATIVE_ORIGIN_FINAL_INPUT_CHANGED");
            }
            NativeHostOriginObservationV2 afterRead = Invoke("FINAL_REINSPECT_" + target.Path,
                handle.Inspect);
            Need(afterRead == pinned.Origin,
                "NATIVE_ORIGIN_FINAL_OBJECT_CHANGED_AFTER_READ");
            byte[] afterDescriptor = Invoke("FINAL_REDESCRIPTOR_" + target.Path,
                () => handle.Descriptor() is { } raw ? (byte[])raw.Clone() : Array.Empty<byte>());
            Need(afterDescriptor.AsSpan().SequenceEqual(descriptorOriginals[target.Path]),
                "NATIVE_ORIGIN_FINAL_ACL_CHANGED_AFTER_READ");
        }
        // Avoid an extra sweep-level guard. Invoke still calls the guard and
        // clock after its own sample, so this is not an atomic 14-object
        // custody claim; native code must recheck leases at each use boundary.
    }

    internal NativeHostOriginSnapshotV2 Acquire()
    {
        lock (evidenceGate) {
            if (Interlocked.CompareExchange(ref state, 1, 0) != 0) {
                Volatile.Write(ref state, 3);
                throw new InvalidDataException("NATIVE_ORIGIN_RETRY_OR_REENTRY_REFUSED");
            }
            active = 1;
        }
        lock (RetainedGate) Retained.Add(this);
        try {
            foreach (NativeHostOriginTargetV2 target in targets) {
                RecheckParent(target);
                var slot = new NativeHostOriginHandleSlotV2(target);
                slots.Add(target.Path, slot); // rooted before an unknown open
                int index = attempts.Count;
                attempts.Add(new(target, true, false, false, false));
                Guard("BEFORE_OPEN_" + target.Path);
                if (target.ParentPath is null)
                    backend.OpenVolumeRoot(slot);
                else backend.OpenChild(slots[target.ParentPath].Handle!,
                    target.Leaf, target.Directory, slot);
                Need(Volatile.Read(ref state) == 1 && slot.Handle is not null,
                    "NATIVE_ORIGIN_OPEN_UNKNOWN_OR_REENTRY");
                attempts[index] = attempts[index] with { HandleAttached = true };
                Guard("AFTER_OPEN_" + target.Path);
                RecheckParent(target);
                NativeHostOriginObservationV2? parent = target.ParentPath is null ? null :
                    pins[target.ParentPath].Origin;
                NativeHostOriginPinV2 pin = InspectTarget(target, slot.Handle, parent);
                attempts[index] = attempts[index] with { Inspected = true };
                Need(!pins.Values.Any(x => x.Origin.Id == pin.Origin.Id ||
                    x.Origin.HandleObjectId == pin.Origin.HandleObjectId),
                    "NATIVE_ORIGIN_OBJECT_ALIAS_REFUSED");
                pins.Add(target.Path, pin);
                attempts[index] = attempts[index] with { Accepted = true };
            }
            FinalSweep();
            var snapshot = new NativeHostOriginSnapshotV2(bound.Profile.Attempt,
                bound.PlanSha256, bound.ApprovalSha256, bound.Profile.SourceSetSha256,
                Array.AsReadOnly(targets.Select(t => pins[t.Path]).ToArray()));
            Need(Interlocked.CompareExchange(ref state, 2, 1) == 1,
                "NATIVE_ORIGIN_REENTRY_POISONED");
            return snapshot;
        } catch {
            Volatile.Write(ref state, 3);
            throw;
        } finally {
            lock (evidenceGate) active = 0;
        }
    }

    // Evidence is process-local only; no source/worker may use it as an origin
    // authority or restart token. Never inspect while a callback is pending.
    internal NativeHostOriginAttemptV2[] Evidence()
    {
        lock (evidenceGate) {
            if (active != 0 || Volatile.Read(ref state) == 1) {
                Volatile.Write(ref state, 3);
                throw new InvalidDataException("NATIVE_ORIGIN_PENDING_EVIDENCE_REFUSED");
            }
            return attempts.Select(a => a with {
                HandleAttached = slots.TryGetValue(a.Target.Path, out var slot) &&
                    slot.RetainedCount > 0
            }).ToArray();
        }
    }
}
