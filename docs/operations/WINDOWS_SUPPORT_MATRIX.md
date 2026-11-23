# Windows v1 Support Matrix

Decision date: 2026-10-04

Status: `ACCEPTED_SCOPE`; CHG0059 broadens the technical compatibility target,
while implementation and physical acceptance remain open.

Applies to: both `FULL` and `ATTENDANCE` Editions, the offline installer,
Guardian/App/Setup services, private Node.js and PostgreSQL runtimes, Licensing
adapters, Backup/Restore and K40 integration.

This file is the authoritative platform-support matrix. Licensing details remain
authoritative in [LICENSING_DESIGN.md](../licensing/design/LICENSING_DESIGN.md), and packaging details
remain authoritative in [PACKAGING_DECISIONS.md](PACKAGING_DECISIONS.md). Neither
document may define a broader platform set than this matrix.

## 1. Supported v1 targets

Only 64-bit client Windows is in v1 scope. Vendor lifecycle dates do not block
Setup under the Product decision in CHG0059, but the exact build must still pass
the product's runtime, service, security, database and device tests:

| Target | Architecture | v1 status | Release condition |
| --- | --- | --- | --- |
| Windows 11 client editions capable of desktop/service installation | x64 | Technical target | Build 22000 or later; exact build must pass the matrix. Microsoft servicing status is recorded but is not an admission gate. |
| Windows 10 Home/Pro/Enterprise/Education/LTSC client editions capable of desktop/service installation | x64 | Technical target | Build 14393 (1607) or later; exact build must pass the matrix. Microsoft servicing status is recorded but is not an admission gate. |

“Technical target” is not a claim that Microsoft secures or supports an old OS.
It means the product accepts that Windows family/build only after this repository's
exact signed artifact passes its matrix. A runtime or K40 incompatibility blocks
that exact build even though its family is in scope. End-of-servicing is recorded
and warned about, but does not by itself cause Setup refusal.

The build floor is not a lifecycle-date policy. It is a hard dependency boundary:
the pinned .NET 10 line lists Windows 10 1607 as its oldest Windows 10 generation,
Node 24 targets Windows 10 or later, and the product is `win-x64`. Windows 10
1507/1511 therefore cannot honestly be promised by the current stack.

## 2. Explicitly unsupported in v1

| Target | v1 behavior | Reason |
| --- | --- | --- |
| Every 32-bit/x86 Windows installation | Setup refuses before mutation | The shipped artifact and all native services/runtimes are `win-x64`; v1 does not carry a second runtime, database, driver and security-test lifecycle. |
| Windows on Arm/Arm64 | Setup refuses before mutation | No Arm64 product/K40/Installer/LIC008 matrix is approved. Emulation is not support evidence. |
| Windows 10 builds before 14393 (before 1607) | Setup refuses before mutation | Below the pinned .NET/runtime compatibility floor; “all Windows 10” is not technically achievable with the selected stack. |
| Windows 7, 8 or 8.1 | Setup refuses before mutation | Unsupported by the pinned modern runtime and outside the security baseline. |
| Windows Server, Server Core and Nano Server | Setup refuses before mutation | The product is a Windows client installation and has no server-specific service, UI, driver or licensing acceptance. |
| Preview/Insider builds and S mode | Setup refuses before mutation | Preview state is not a stable compatibility target; S mode does not provide the required unrestricted desktop/service installation model. |

An unsupported platform is not “probably compatible.” It is outside customer
support even if a developer can start part of the application manually.

## 3. Installer preflight contract

The signed Setup must run a read-only platform preflight before it writes files,
creates directories/users/services/keys, initializes PostgreSQL, changes ACLs or
touches retained product state. The preflight must:

1. read the native OS version/build without compatibility-manifest virtualization;
2. identify edition/SKU, `ProductType=workstation`, OS architecture and process
   architecture independently;
3. accept only Windows 10 client build 14393+ or Windows 11 client build 22000+
   and an x64 process on an x64 OS; reject Server, x86, Arm64, Insider and S mode;
4. record OS version/build/UBR, edition/SKU, architecture and the matched matrix
   row in the install report and immutable build-support manifest;
5. show a clear, localized refusal containing the unsupported fact and supported
   targets, without leaking secrets or suggesting an unsafe bypass;
6. return a distinct non-zero code while leaving the machine unchanged;
7. treat an unknown/unreadable property as unsupported, never as a default match;
8. record vendor lifecycle/servicing state as informational evidence and show a
   security warning when known obsolete, without using lifecycle date alone as a
   refusal condition.

TPM availability is inventoried but is not itself an OS-support rejection. A
usable TPM selects the approved TPM adapter; a machine without one may proceed
only through the lower-assurance Software-CNG fallback after that fallback passes
every applicable row below. Lack of a compatible K40 driver blocks device-enabled
release acceptance; it must not silently disable physical access controls.

This preflight is a binding Phase 6.4/6.6 requirement and is **not implemented
yet**. The present LIC008 PowerShell guards are experiment safety checks, not the
customer Installer implementation.

## 4. Minimum clean-machine release matrix

Each row starts from a clean OS image patched to the latest update available for
that exact build, even when Microsoft no longer services the build.
Snapshot rollback may reset a disposable VM between cases, but snapshot/clone
behavior cannot prove hardware binding, TPM persistence or physical K40 behavior.

| ID | OS target | TPM path | Environment | Current status |
| --- | --- | --- | --- | --- |
| `WIN-V1-01` | Windows 11 x64 build 22000 development host | Software fallback | Current physical development computer; historical retained namespaces allowed, new harness namespace must be fresh | `NOT_RUN` |
| `WIN-V1-02` | A materially newer Windows 11 x64 build | TPM-backed and Software fallback | Independent physical computer or clean approved VM for non-hardware cases | `NOT_RUN` |
| `WIN-V1-03` | Windows 10 x64 build 14393/early supported floor | Software fallback | Clean independent machine or VM | `NOT_RUN` |
| `WIN-V1-04` | A later Windows 10 x64 build, including Home/Pro or Enterprise/LTSC | TPM-backed where available and Software fallback | Clean independent machine(s) | `NOT_RUN` |
| `WIN-V1-05` | Unsupported x86/Arm64/Server/pre-14393/Insider samples | N/A | Disposable machine/VM | `NOT_RUN`; must refuse before mutation |

At least two independent physical computers are required across the positive
rows; one development computer, multiple runs on it, or multiple VMs cloned from
one image are not independent evidence. The final matrix must include all of:

- install, first boot, service recovery and repeated reboot;
- offline activation/renewal/recovery/rebind/time-correction and Hybrid admission;
- Guardian/App/child/ordinary-user secret, file and key isolation;
- TPM and Software-CNG binding, copy/clone refusal and the documented assurance
  difference;
- update, failed update rollback, repair, downgrade refusal and retained-state
  continuity;
- uninstall/reinstall with the selected data-retention policy;
- backup, verification and authorized restore reconciliation;
- unexpected power/process interruption at defined persistence boundaries;
- FULL and ATTENDANCE artifact/feature isolation;
- K40 install, reconnect, reboot and attendance/event flow on every OS row claimed
  for device-enabled production use.

## 5. LIC008 consequence

EV0117 is valid negative/diagnostic evidence for one Windows 11 x64 build22000
host only. CHG0059 permits this host as the first technical-compatibility row;
it still cannot establish Windows 10, another Windows 11 release, TPM-less or
fleet compatibility.

Before implementing the production protected Store, the Product-selected
purpose-specific non-exportable Software-KSP wrapping-key direction must be
evaluated against this matrix, separate from the ECDSA signing key. Its first
RSA-OAEP-SHA256 candidate is defined in
[LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md](../licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md).
The adapter may be accepted only after it defines lifecycle behavior for
Install, reboot, Repair, Upgrade, retained-state recovery and Uninstall and then
passes the required Windows rows. Host-specific error-code interpretation cannot
be generalized without the same provider/API/key-policy controls.

EV0126 observes successful Software wrapping feasibility on the current Windows11
x64 build22000 host through the user transcript. It does not complete WIN-V1-01:
protected report hashes, interactive-user, reboot and required lifecycle cases
remain open. EV0130 completes V3/0.10.1 host-specific non-elevated filtered-admin
interactive contrast, not a separate standard account. EV0132 observes V4/0.11.0
normal restart success on the same host; protected report reconciliation remains
pending. EV0135 now completes V5/0.12.0 binary Repair simulation on the same host:
same key identity/envelope bytes preserved, App/child isolation held, owned cleanup
passed and missing-key repair refused without recreation. This is not actual
Installer Repair; protected original report hashes remain independently uncaptured.
productionRepairTested/security/production/matrix remain false. Never rerun V5.
No full matrix row is closed. CHG0068/EV0137 prepared the bounded V6 Upgrade kit;
CHG0069/EV0138 now records physical binary Upgrade simulation PASS on this same
Windows11 Pro21H2 x64 build22000 host. Same keys/envelope bytes and OLD files were
preserved without recreation; owned cleanup PASS and services Stopped/Manual on
bin-new. Original protected evidence digests remain independently uncaptured.
EV0139 later captures original-file hashes through separate operator read-only
verification: checkpoint and all11 evidence files match; this is not independent
Security review and does not close V4/V5 hash gaps. EV0140 is retained-data
Uninstall/Reinstall planning; EV0141 now builds V7 kit0.14.0 with pure17/17 and
inert guards PASS. EV0142 subsequently records physical V7 three-stage transcript
PASS on the same development host, including Guardian/App/actual-child controls
and owned cleanup. EV0143 reviews supplied summary and records matching operator
hashes for both checkpoints/all11 evidence files; original summary digest captured.
This is not independent Security or current DACL remeasurement. V7 consumed.
No full matrix row closes.
This is not actual Installer or interrupted-operation acceptance; the same
technical target boundaries and full clean-machine evidence requirements remain unchanged.
All full matrix rows above retain their status; no other build has been tested.

## 6. Change and evidence rules

- Adding an architecture, Windows family, Server class or lowering the Windows 10
  build floor is a Product scope change and Security/Release matrix expansion.
- Removing a target requires migration/support communication for installed
  customers; Setup must never strand retained data without a recovery path.
- Before every release, record Microsoft lifecycle as advisory evidence and
  record .NET/Node/PostgreSQL/K40 compatibility plus exact matrix artifacts as
  release gates. Product compatibility never implies Microsoft security support.
- A row remains `NOT_RUN` until its reports and hashes are recorded. Documentation
  acceptance does not mark implementation or physical testing complete.

## 7. Primary platform references

- [Microsoft: Windows 11 release information and current serviced builds](https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information)
- [Microsoft: install .NET on Windows and supported OS/architectures](https://learn.microsoft.com/en-us/dotnet/core/install/windows)
- [Node.js supported platforms](https://github.com/nodejs/node/blob/main/BUILDING.md#supported-platforms)
- [PostgreSQL Windows platform notes](https://wiki.postgresql.org/wiki/Windows)
- [Microsoft: Windows 10 Enterprise LTSC 2019 lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-enterprise-ltsc-2019)
- [Microsoft: Windows 10 Enterprise LTSC 2021 lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-enterprise-ltsc-2021)
- [Microsoft: Windows 10 Enterprise/Education lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-enterprise-and-education)
- [Microsoft: 32-bit and 64-bit Windows FAQ](https://support.microsoft.com/en-us/windows/32-bit-and-64-bit-windows-frequently-asked-questions-c6ca9541-8dce-4d48-0415-94a3faa2e13d)
- [Node.js 24 Windows release artifacts](https://nodejs.org/download/release/latest-v24.x/)
