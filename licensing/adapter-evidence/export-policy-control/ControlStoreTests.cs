using System;
using System.Buffers.Binary;
using System.IO;
using System.Linq;

namespace EntryControl.TestOnly.ExportPolicyControl;

// No filesystem, identity guard, P/Invoke, SecurityIdentifier or SDDL conversion
// is used here. Only managed path/role tables and binary descriptors are tested.
internal static class ControlStoreTests
{
    internal static int Run()
    {
        int cases = 0;
        void Check(bool condition) {
            if (!condition) throw new InvalidDataException("CONTROL_STORE_TEST_FAILED");
            cases++;
        }
        void Reject(Action action) {
            try { action(); }
            catch (InvalidDataException) { cases++; return; }
            throw new InvalidDataException("CONTROL_STORE_REFUSAL_MISSING");
        }
        foreach (string file in ProtectedControlStore.Files) {
            Check(ProtectedControlStore.PathOf(file) == ProtectedControlStore.Root + "\\" + file.Replace('/', '\\'));
            Check(ProtectedControlStore.CanRead(ControlRole.Setup, file) == !file.StartsWith("reports/guardian", StringComparison.Ordinal));
            Check(ProtectedControlStore.CanRead(ControlRole.Guardian, file) == (file != "journal/setup-recovery.json"));
            Check(ProtectedControlStore.CanWrite(ControlRole.Setup, file) == (file.StartsWith("journal/", StringComparison.Ordinal) || file == "reports/setup.json"));
            Check(ProtectedControlStore.CanWrite(ControlRole.Guardian, file) == file.StartsWith("reports/guardian", StringComparison.Ordinal));
            Check(!ProtectedControlStore.CanRead((ControlRole)999, file));
            Check(!ProtectedControlStore.CanWrite((ControlRole)999, file));
        }
        foreach (string? path in new string?[] {
            null, "", ".", "..", "../plan.json", "journal/../plan.json", "journal//setup-consumed.json", "./plan.json",
            "plan.json/", " plan.json", "plan.json ", "plan.json.", "PLAN.JSON", "plan.json:other", "/plan.json",
            @"C:\ProgramData\Ecs.Lic008.ExportPolicyControlV1\plan.json", @"journal\setup-consumed.json",
            "journal/guardian-consumed.json", "reports/other.json", "bin/other.dll", "plan.json\0", "plan.json\n"
        }) {
            Reject(() => ProtectedControlStore.PathOf(path!));
            Check(!ProtectedControlStore.CanRead(ControlRole.Setup, path!));
            Check(!ProtectedControlStore.CanRead(ControlRole.Guardian, path!));
            Check(!ProtectedControlStore.CanWrite(ControlRole.Setup, path!));
            Check(!ProtectedControlStore.CanWrite(ControlRole.Guardian, path!));
        }
        Reject(() => new ProtectedControlStore((ControlRole)999, () => { }));
        Reject(() => new ProtectedControlStore(ControlRole.Setup, null!));
        foreach (string binary in new[] { "bin/ExportPolicyControl.exe", "bin/ExportPolicyControl.dll" }) {
            var rule = ProtectedControlStore.RuleOf(binary);
            Check(rule.Aces.Single(x => x.Sid == ProtectedControlStore.GuardianSid).Mask == ProtectedControlStore.ReadDirectory);
        }
        foreach (string json in new[] { "plan.json", "reservation.json", "package-manifest.json", "bin/ExportPolicyControl.runtimeconfig.json", "bin/runtime-inventory.json" }) {
            var rule = ProtectedControlStore.RuleOf(json);
            Check(rule.Aces.Single(x => x.Sid == ProtectedControlStore.GuardianSid).Mask == ProtectedControlStore.ReadFile);
        }
        foreach (string directory in new[] { "", "bin", "journal", "reports" }) {
            var rule = ProtectedControlStore.RuleOf(directory, true);
            Check(rule.Owner == ProtectedControlStore.AdminSid && rule.Directory);
            DescriptorChecks(rule);
        }
        foreach (string file in ProtectedControlStore.Files) DescriptorChecks(ProtectedControlStore.RuleOf(file));
        foreach (string invalidDirectory in new[] { ".", "..", "other", "journal/child", "plan.json", "BIN" })
            Reject(() => ProtectedControlStore.RuleOf(invalidDirectory, true));
        return cases;

        void DescriptorChecks(ControlStoreRule rule)
        {
            byte[] original = ProtectedControlStore.Descriptor(rule);
            ProtectedControlStore.ValidateDescriptor(original, rule); cases++;
            int owner = BinaryPrimitives.ReadInt32LittleEndian(original.AsSpan(4, 4));
            int acl = BinaryPrimitives.ReadInt32LittleEndian(original.AsSpan(16, 4));
            int first = acl + 8;
            void Mutate(Action<byte[]> change) {
                byte[] bytes = (byte[])original.Clone();
                change(bytes);
                Reject(() => ProtectedControlStore.ValidateDescriptor(bytes, rule));
            }
            Reject(() => ProtectedControlStore.ValidateDescriptor(null!, rule));
            Reject(() => ProtectedControlStore.ValidateDescriptor(Array.Empty<byte>(), rule));
            Reject(() => ProtectedControlStore.ValidateDescriptor(original[..19], rule));
            Reject(() => ProtectedControlStore.ValidateDescriptor(original[..^1], rule));
            Reject(() => ProtectedControlStore.ValidateDescriptor(new byte[65537], rule));
            Mutate(x => x[0] = 2);
            Mutate(x => x[1] = 1);
            Mutate(x => x[3] &= 0xef); // unprotected
            Mutate(x => x[3] &= 0x7f); // absolute rather than self-relative
            Mutate(x => x[2] &= 0xfb); // missing DACL
            Mutate(x => x[2] |= 8); // defaulted DACL
            Mutate(x => x[3] |= 4); // inherited DACL
            Mutate(x => x[3] |= 1); // auto-inheritance requested
            Mutate(x => BinaryPrimitives.WriteInt32LittleEndian(x.AsSpan(4, 4), 0));
            Mutate(x => BinaryPrimitives.WriteInt32LittleEndian(x.AsSpan(4, 4), 21));
            Mutate(x => BinaryPrimitives.WriteInt32LittleEndian(x.AsSpan(4, 4), int.MaxValue));
            Mutate(x => BinaryPrimitives.WriteInt32LittleEndian(x.AsSpan(16, 4), 0));
            Mutate(x => BinaryPrimitives.WriteInt32LittleEndian(x.AsSpan(16, 4), int.MaxValue));
            Mutate(x => x[owner] = 2);
            Mutate(x => x[owner + 1] = 0);
            Mutate(x => x[owner + 1] = 255);
            Mutate(x => x[owner + 8] ^= 1);
            Mutate(x => x[acl] = 4);
            Mutate(x => x[acl + 1] = 1);
            Mutate(x => x[acl + 6] = 1);
            Mutate(x => x[acl + 7] = 1);
            Mutate(x => BinaryPrimitives.WriteUInt16LittleEndian(x.AsSpan(acl + 2, 2), ushort.MaxValue));
            Mutate(x => BinaryPrimitives.WriteUInt16LittleEndian(x.AsSpan(acl + 4, 2), 0));
            Mutate(x => BinaryPrimitives.WriteUInt16LittleEndian(x.AsSpan(acl + 4, 2), 4));
            Mutate(x => x[first] = 1); // deny ACE
            Mutate(x => x[first] = 9); // callback ACE
            Mutate(x => x[first + 1] |= 0x10); // inherited ACE
            Mutate(x => x[first + 1] ^= 1); // incorrect propagation flags
            Mutate(x => BinaryPrimitives.WriteUInt16LittleEndian(x.AsSpan(first + 2, 2), 0));
            Mutate(x => BinaryPrimitives.WriteUInt16LittleEndian(x.AsSpan(first + 2, 2), ushort.MaxValue));
            Mutate(x => x[first + 4] ^= 1);
            Mutate(x => x[first + 8] = 2);
            Mutate(x => x[first + 9] = 0);
            Mutate(x => x[first + 16] ^= 1);
            var extraAce = rule with { Aces = rule.Aces.Append(new ControlStoreAce("S-1-1-0", ProtectedControlStore.Full)).ToArray() };
            Reject(() => ProtectedControlStore.ValidateDescriptor(ProtectedControlStore.Descriptor(extraAce), rule));
            var duplicate = rule with { Aces = new[] { rule.Aces[0], rule.Aces[0], rule.Aces[2] } };
            Reject(() => ProtectedControlStore.ValidateDescriptor(ProtectedControlStore.Descriptor(duplicate), rule));
            var changedOwner = rule with { Owner = rule.Owner == ProtectedControlStore.SystemSid ? ProtectedControlStore.AdminSid : ProtectedControlStore.SystemSid };
            Reject(() => ProtectedControlStore.ValidateDescriptor(ProtectedControlStore.Descriptor(changedOwner), rule));
            var reversed = rule with { Aces = rule.Aces.Reverse().ToArray() };
            ProtectedControlStore.ValidateDescriptor(ProtectedControlStore.Descriptor(reversed), rule); cases++;
            Check(ProtectedControlStore.Descriptor(rule).SequenceEqual(original));
        }
    }
}
