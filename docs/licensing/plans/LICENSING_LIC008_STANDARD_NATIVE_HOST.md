# LIC008 W03 native startup foundation

First built: 2026-11-03 UTC / November 4 Kabul. Latest closed build:
November 11 Kabul.
Status: `CLOSED_SOURCE_AND_ARTIFACT_REVIEW_PASS_NO_PHYSICAL_ENTRY`.

[Current closed components](LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md) /
[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

This is a new startup profile, not authorization to run a physical test. Existing
V1 dotnet image/command/payload pins and consumed approvals cannot authorize a
native host image or V2 Owner-object loans. No installed service, account, global
environment, security policy or retained object is changed by preparing it.

## Implemented foundation scope

Five C files implement a finite four-role parser, exact sorted UTF-16 environment
blocks and a one-use injected startup/service sequence. The Win32 compile-only
adapter supplies SetCurrentDirectoryW/GetCurrentDirectoryW,
SetDefaultDllDirectories and SetEnvironmentStringsW/GetEnvironmentStringsW.
The real native ServiceMain/dispatcher is absent; its dispatch function returns
MISSING_API. No hostfxr/CLR loader is implemented.

Exact `--self-test` reaches only portable fakes. All other CLI shapes return2
with STANDARD_NATIVE_HOST_ENTRY_CLOSED before a native API table is constructed,
including the native compile variant. CLI hashes/roles are shape data, not
approval, filesystem custody or a GRANT. Fake matching grants only test callback
ordering; bootstrap/loaded-code/security/production/LIC008 acceptance stays false.

The core snapshots invocation/start values and the callback table, detects
reentry through terminal compare-and-swap, checks clock rollback/deadlines at
callback boundaries and permanently closes a failed session. Source callback
arguments/outputs are synchronous borrows: even a PENDING return cannot retain
their pointers. Detached work must own copies in its retained context. Session
and context lifetime remain the integrating caller's responsibility. A blocked
synchronous callback has no timeout/cancellation guarantee from this component.

Pure tests cover malformed arguments/environment blocks, all role mismatches,
order/GRANT mismatches, callback failures/pending returns, input mutation,
reentry, rollback and expiry. At the November 4 baseline, independent source
review passed and 2,455 assertions were counted before execution. The
six-input builder pins the C/header/builder originals, compiler/tree/archive,
full PE imports and raw reports. Byte-for-byte compiler reproducibility is not
established.

The November 11 CLOSED source update makes the User invocation exactly 14
arguments: the existing source-set hash is followed by `--run-id` with 32
lowercase hexadecimal characters and `--nonce` with 64. Owner remains exactly
10 arguments, with both complete run/nonce buffers zero. Service remains
exactly 12 arguments; its invocation buffers are also wholly zero, while its
separate StartService fields carry the service run/nonce. Guardian-after is
stage 4; stage 3 belongs to User. These parser and injected-sequence checks
establish shape only. They do not establish protected StandardUserIntent,
one-use authority, or a physical W03 entry; every operational CLI remains
closed.

## Historical November 4 closed build and original evidence

The historical retained build is
`out/lic008-standard-native-host-v1-7689273d3ab44266a0b6c4986eb7ca4a`,
created `2026-11-03T21:19:44.3493392+00:00`, from baseline `ae7991f`.
The six-input source-set SHA256 is
`84b77e806d2e1ca75d3b8ea3c245a369903a9e4b1e033d914aabe57e5dbcb785`.
The raw build manifest SHA256 is
`b244ce8fdecfd789bd7d5b0705f88f45dcee7c720b897bdc988c3b36b613945e`.
[Eight byte-exact original reports](../evidence/standard-native-host-foundation-v1-20261103/README.md)
total 29,623 bytes.

| Build variant | Pure assertions | Closed operational entries | Native EXE SHA256 |
| --- | ---: | ---: | --- |
| default | 2,455 | 15 | `866636a3be0449c10f6c0a50be46fe77fed6304cd2603b184203295736f71291` |
| unrelated-defines | 2,455 | 15 | `bc93f2ed4b68ce7b7f0cfa4c0d58caf2eb90a050b63b246ff17c09306bcd53ad` |
| compile-only-native | 2,455 | 15 | `6f44d2240746edaf7cd13b6786f6612fe5a53a3b80ff8844d488216edbed9e85` |

The third PE imports the intended Win32 environment/cwd/DLL APIs, but its CLI
never calls them. All three emitted PEs also import Kernel32 and UCRT startup/
heap/locale/environment symbols; those native modules can execute before
`main`. The manifest reports no CLR or delay imports. These observations
support a bounded compiled-signature claim, not a protected launch or complete
startup dependency closure. The implementation has no real ServiceMain,
dispatcher or CLR loader. No native API path, managed bootstrap, service,
account or persisted-key effect was exercised.

The first fresh build failed after C compilation because the PowerShell
redirection helper emitted extra task results on an empty child-output pipe.
It executed no produced PE. The helper now discards those task results; the
before/after regression and failed build remain retained under `out/`.
The completed build used a fresh output GUID and fresh build-owned shared
compiler cache. No earlier output or failed cache was adopted.

## November 11 closed pre-CLR shape build and original evidence

The fresh retained build is
`out/lic008-standard-native-host-v1-827a95f604224da6a14f860c65948b33`,
from baseline `81d9f6412aebc2e2fdba2c373b1aad2e775d8ab7`. Its
independently reconstructed six-input source-set SHA256 is
`f8d47f0bb55af83c06226d89df8f02c48d0c72c40d136d1f4a67361c82f84da0`;
the raw manifest SHA256 is
`8a73aa2eb872c51687463583db5a7a77e05aebd3ff1a564b54ec1ac54aefe9e1`.
[Eight byte-exact original reports](../evidence/standard-native-host-preclr-shape-20261111/README.md)
total 31,515 bytes. The three warnings-as-errors variants each passed 2,564
injected checks and refused 16 operational CLI forms, including the complete
User invocation.

| Build variant | Injected checks | Closed operational entries | Native EXE SHA256 |
| --- | ---: | ---: | --- |
| default | 2,564 | 16 | `0ce042efa79745f8d9ee5261a3ff18a693f0af0535231c2560fb939a9abaa550` |
| unrelated-defines | 2,564 | 16 | `63932fbe6846e225b3f0a0d767f619d141d726429c94deb6d6515519c16dbb3b` |
| compile-only-native | 2,564 | 16 | `46bd4756220248cfd4d24148e3e8311a84e28d8f2178f053a798153d7b5e4158` |

The first fresh cold-cache attempt at
`out/lic008-standard-native-host-v1-c6b70953b383443d9467080cbbb2f381`
reached its former five-minute compiler deadline. Its child later ended
naturally and left a partial EXE, but the attempt has only a pending record and
no final manifest. It remains excluded and untouched. The builder then used a
30-minute bounded compile deadline and a separate fresh output for the passing
build. These are closed tests and PE/import evidence, not protected
StandardUserIntent, one-use authority, physical W03, or security/production
acceptance. No native environment, SCM, hostfxr/CLR, account or persisted-key
operation ran; the November 4 archive above remains historical.

## Why a native process entry

The existing W03 contract requires admitted startup/code custody and forbids
persisted-key work before GRANT. It does not require IPC before CLR startup.
A small native entry can establish a prescribed environment before loading CLR,
then enter an audited managed bootstrap that waits for mutual admission/GRANT.

The SDK apphost can embed a managed DLL and restrict runtime-root lookup, but
it does not independently establish a positive environment for a service.
[StartServiceW](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-startservicew)
has no environment-block argument. A managed-entry check cannot undo a startup
hook/profiler already consumed by CLR. Launching a separate apphost child from
ServiceMain would also require a new SCM-to-child identity/lifetime protocol.

The selected design therefore uses one native image for Owner, standard user,
Setup and Guardian. Setup/Guardian stay in the original SCM process. The new
profile must bind all changed images, paths, arguments and effects together;
changing a single expected image string in an old contract is insufficient.
The existing V2 transfer model still delegates to channel validation that pins
the old dotnet image and ControlV1 paths. It is not directly usable with this
new placement. The integration must explicitly version that complete validation
and prove old/new profile mismatch refusal; it must not weaken an old image/path
check or silently treat the existing V2 model as authorization for this host.

## Bounded startup and service ordering

Use a closed finite role grammar and a fresh fixed placement. The process must
have independently protected staging/file custody; native constants are not
proof of filesystem ownership or freshness. Role-specific scratch directories
must be protected and independently admitted before a physical launch.

For Owner/user, prepare the process-local environment and DLL/working-directory
policy before the future CLR loader. For Setup/Guardian, dispatch promptly in
the same process, register the handler, report START_PENDING and initialize in
ServiceMain before CLR. Microsoft documents the
[dispatcher timing and ServiceMain initialization](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-startservicectrldispatcherw).
RUNNING accepts no stop controls and means bootstrap-waiting only; it never
authorizes persisted-key work. After successful independent bootstrap and GRANT,
join all worker work before STOPPED. Failure/unknown work does not authorize
STOPPED, cancellation, service deletion, account changes or automatic cleanup.

The native adapter will call
[SetEnvironmentStringsW](https://learn.microsoft.com/en-us/windows/win32/api/processenv/nf-processenv-setenvironmentstringsw)
with an exact fixed role block and independently read back its complete contents.
This API affects the calling process. Inherited hooks/profiler/additional-deps,
PATH, profile values and hidden drive-current-directory entries are not copied.
Exact bounded validation must reject duplicate/unknown entries, malformed
termination and changed values. Process-local
[SetDefaultDllDirectories](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-setdefaultdlldirectories)
does not constrain a later explicit LoadLibraryEx override; the future loader
must separately use and verify its exact paths/search flags.
These policies are prospective. Initial native imports, TLS callbacks and any
CRT initialization have already run before this code; their admitted paths and
dependencies remain separate obligations of the complete protected profile.
Replacing the Win32 block does not itself purge an already initialized CRT
environment cache. The exact10.0.11 host
[pal::getenv implementation](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/native/corehost/hostmisc/pal.windows.cpp)
uses GetEnvironmentVariableW. Hostpolicy also admits
[configuration-supplied startup hooks](https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/native/corehost/hostpolicy/hostpolicy_context.cpp),
so environment replacement alone does not close runtime configuration or all
possible consumers. The later loader must verify exact consumer/init ordering
and refuse an already initialized CLR; this foundation makes no such claim.

## Loader and admission remain separate work

The future common loader must load the exact held hostfxr10.0.11 by absolute
path, not nethost discovery or highest-version lookup. Its dependency search,
runtimeconfig, runtime inventory, dependency/probing/resource paths and managed
entry must be closed by a new complete manifest. The Owner and every worker
need the same level of admission. Native module observations, actual runtime
properties and managed entry provenance have bounded meanings; they are not
attestation of all loaded modules, executed instructions or source equivalence.
Keep LoadedModulesAttested false.

The startup foundation is intentionally smaller than that loader. A pure
injected environment/service sequence cannot establish OS compatibility,
SCM registration, actual environment replacement, bootstrap authority or W03
isolation. No physical route may be exposed until the full V2 input/store/
consumption, process/primary-token transfer, loaded-code custody, account/crypto
controller and collector are implemented and independently reviewed.

The integration exit is a finite set of deliverables, not an assertion-count
target:

| Deliverable | Exit before physical W03 |
| --- | --- |
| Native startup foundation | Closed entry, injected environment/service-order tests, native signature compilation and exact binary/import custody |
| Actual common loader | Held exact hostfxr/runtime/configuration/managed-entry recipe; bounded provenance with explicit limits |
| V2 authorization | Complete new image/payload/command/effects plan and approval codec; old approvals refused |
| Actual process association | Retained Owner/worker process and current primary-token adapters, read-only loans, round-trip object proof and a final pre-GRANT recheck |
| Durable stage authority | Protected fresh transfer originals and consumed-stage records; partial/unknown outcomes cannot be resumed from a JSON claim |
| Full orchestration | Protected role scratch, fresh services/keys, owned-account activation, actual logon, four ordered stages and explicit guarded return to disabled |
| Independent collection | Original byte custody, actual held-process outcomes, positive and restricted crypto comparisons, preserved partial outcomes and bounded pending-call observation |
| Fresh physical kit | Complete independently reviewed binding chain, new one-use inputs and the existing local owner-entered CONFIRM flow |

The first row now has completed closed build evidence and an independent
artifact audit PASS (139,363 read-only checks). It does not establish a real ServiceMain or
environment operation. None of the later rows is completed. Record each
result in the completion ledger without treating source models as physical
test coverage.

## Portable compiler custody

No native C toolchain/Windows SDK was usable in the installed environment.
A workspace-only Zig0.17.1 archive was acquired from the
[official release index](https://ziglang.org/download/index.json), exact size
100,343,666 bytes and SHA256
`b03f477a1943673e02aca0f570e8030dffd536ce1f45cbc4d3326ec31159562e`.
The index/headers/archive/partials remain under the owned out/toolchains GUID
directory. Signature verification has not been performed; matching hashes are
integrity pins, not independent publisher authentication.

All20,792 ZIP entries were checked before extraction for canonical containment,
invalid/rooted paths, duplicate names and links/reparse attributes. The validated
uncompressed total is378,964,486 bytes:19,520 files and1,272 directories.
Original licenses remain with the tool
tree. Compiler caches and temporary paths are child-only workspace directories;
there is no system installation or PATH/global-environment change. A compile
probe produces an inert PE and does not execute it. Exact executable, tree,
headers, build inputs and resulting imports must be pinned by the completed
build evidence; compiler flags alone do not prove the emitted dependency set.

LIC008/Open003, physical W03 and security/production acceptance remain open.
