# LIC008 W03 native loader and profile descriptor

Started November11 Kabul. Baseline: `58659d8` (reviewed closed native host).
Status: `CLOSED_COMPONENT_BUILDS_INDEPENDENTLY_AUDITED_NO_PHYSICAL_ENTRY`.

[Native host foundation](LICENSING_LIC008_STANDARD_NATIVE_HOST.md) /
[W03 execution ledger](LICENSING_LIC008_COMPLETION_PLAN.md) /
[W03 control design](LICENSING_LIC008_STANDARD_USER_CONTROL.md).

This plan now tracks separately bounded components. The native loader
is a prospective adapter for one exact `hostfxr` path. The managed
`NativeHostProfileV2` is a canonical description of the new placement and
effect namespace; the input codec, stage store and candidate package binder
remain inert. None
grants authority to run a service, account,
loaded module or persisted-key probe. Existing V1 approvals, dotnet.exe image
pins and Owner-transfer code cannot be translated to this profile.

## Closed native loader

Five C/header files under `licensing/adapter-evidence/standard-native-loader/`
provide a finite one-use injected resolution sequence and a compile-only
Windows/hostfxr factory. The only executable CLI entry is exact `--self-test`.
Operational arguments return a refusal before constructing or calling the
native factory. The pure tests use injected callbacks; the native-compile
variant may exercise invalid-argument refusals that return before any native
load. The executable has no route to invoke the managed `Bootstrap` method.

The intended ordering is: authenticate the fresh V2 binding and actual
protected startup state; root a retained file/ancestor lease; load exact
`C:\Program Files\dotnet\host\fxr\10.0.11\hostfxr.dll` by absolute path and
explicit search flags; observe module path and the four exact export owners;
initialize from the pinned runtimeconfig with fresh status zero; obtain and
immediately copy the bounded runtime properties; start the runtime delegate;
resolve the fixed managed entry; retain the lease and entry capability without
invoking it. Any failure, pending callback, invalid host status or unknown
effect permanently closes that `loader_resolve` session. The raw factory
callbacks are compile-only and not independently one-shot; a future physical
adapter must prevent their direct use/retry after an uncertain call. The core
offers no unload, context-close, retry or automatic cleanup path.

The first fresh cold-cache compiler run is retained at
`out/lic008-standard-native-loader-v1-c4208a71580244b2bce2383fd7ecb26c`.
Its five-minute compiler deadline expired while Zig was still building pinned
MinGW sources. `compile.pending.json` records the unresolved PID; the child
later produced an EXE, but the builder had already exited and there is no
compile result, PE report, self-test or final manifest. That output is **failed
and incomplete**, not an adopted executable or evidence of a successful
loader build. No process was killed and no partials were removed. The reviewed
new builder raises only the cold-cache compile deadline to 30 minutes and
uses a fresh directory and source-set digest.

The current prescribed property shape has nine named fields and an exact
172-leaf managed TPA inventory under runtime `10.0.11`. Those values are
**candidate compatibility constraints**. Pure fake properties and installed
file presence cannot prove the values a real `hostfxr` instance will return.
No physical native/CLR initialization is authorized by this increment.
The hostfxr property pointers are borrowed; the implementation must copy them
before any external callback. Retained callback context, file leases and
possible pending operation lifetime remain obligations of the integrating
caller. A synchronous callback that never returns cannot be timed out by the
boundary clock checks in this component.

Real trusted adapters are absent. A future adapter must bind Owner and each
worker to the complete new plan/approval, current primary process/token
association, exact protected file identity/ACL/hash/ancestor custody, startup
environment, and bounded module provenance. It must observe the actual
`hostpolicy` identity after initialization and `coreclr`/`hostpolicy`/
`clrjit` after delegate startup, including post-callback custody checks.
These observations cannot establish all loaded modules, all executed code or
source equivalence; `LoadedModulesAttested` remains false.

## Retained closed build

A fresh source-set-pinned build completed from baseline `58659d8` in
`out/lic008-standard-native-loader-v1-337a6537942e4208b6efe311d4a7f0fd`.
The six-input source-set SHA256 is
`a1c01aec091cfd5b85ffd8457e5911271eb6918b3777ba5ab0a9a36f51376e4f`.
Three AMD64 native console variants were compiled with pinned Zig and two
installed hostfxr headers. The default and unrelated-defines variants each
passed **385** injected checks, while the compile-only Windows/hostfxr
variant passed **405** checks including 20 invalid-input checks that return
before native effects. Each variant refused **19** operational CLI shapes.
The three PE hashes/import lists, raw reports and tool verification before
and after the build are held in the [eight exact originals](../evidence/standard-native-loader-v1-20261111/README.md).
Independent artifact/archive audit PASS: 640 explicit checks, an independent
rehash of all 19,520 pinned Zig files, three PE import parses and exact
comparison of all eight archived originals (32,978 bytes).
No byte-reproducibility claim is made. The manifest explicitly records
`nativeEffects`, `managedEntryInvoked`, `scmPhysicalProven`,
`bootstrapAccepted`, `loadedModulesAttested`, `nativeCompatibilityProven`,
`securityAccepted`, `productionAccepted` and `lic008Closed` as false.

## Canonical profile descriptor

`NativeHostProfileV2` in
`licensing/adapter-evidence/standard-native-control/NativeHostProfile.cs`
binds the NativeHostV1 root, native image, managed assembly/config, exact
runtime/hostfxr paths, four roles and scratch locations, new Setup/Guardian
service names and offline service SIDs, owned disabled-account SID/record
hashes, key names, four stage endpoints, record namespaces and a distinct
V2 effect string including the required read-only Owner-object transfer.
Attempt and source-set identifiers are lowercase hex.
Canonical UTF-8 JSON bytes are regenerated exactly on parse; unknown,
duplicate, reordered, escaped, malformed or oversized representations fail.
Returned bytes are cloned. Independent source review has found no defect
within this **descriptor-only** scope; a warnings-as-errors pure build passed
144 meaningful tests. The changed profile source SHA256 is
`5f6a781ebc34a3797193339889458bd24f476001823bb9615f1f0ed3d5e4e576`;
test source SHA256 is
`a3c9aafc4350051e620e788a7ae33740378673f835b64c9afd45ae1b92f0cfc7`.
The fresh pure scratch output is retained at
`out/standard-native-profile-v2-pure-534c77381a4747ffa5a8ca8171639f9a`.
Earlier failed pure scratch fixtures remain retained separately; no physical
operation was involved.

The supplied source-set digest is a string input to this descriptor. Its
canonical digest is an identifier, not proof that a binary, runtime tree or
account/service matches it. The future complete V2 authorization must bind
that digest to exact source/artifact files, current protected identities and
durable stage consumption, with old/new profile mismatches rejected. The
existing channel validation still pins `dotnet.exe` and ControlV1 paths and
cannot be reused by changing one string.

## Closed V2 input codec

`NativeHostInputCodecV2` binds six supplied original byte streams: the profile,
source set, package manifest, runtime inventory, plan and approval. Its plan
requires the exact native-host profile/effects, attempt and Owner/host/boot/
account identifiers, fresh root and service/key/pipe/record namespaces, command
grammar, source/package/runtime digests, four asset lengths and SHA256 values,
the exact runtime configuration bytes, and an ordinal-sorted 189-file runtime
inventory with individual file pins. The approval repeats the critical scope
and binds the canonical plan hash. The parser rejects V1 shapes, malformed or
noncanonical UTF-8 JSON, duplicate/unmapped/reordered fields, and invalid UTC
windows. It clones caller-owned bytes before parsing and hashing.

Independent source review and a fresh warnings-as-errors pure run passed
**125** checks. The source and test SHA256 values are respectively
`91828b6d7862b7ce7616510ac937efd76ac54c9e23fac1373f4d073ffd0cb587`
and `f92e25cc1e455b7ee2b3fb4f00d9ecff0c5616d779606e34af18660f8890d1c6`.
The final pure output is retained in
`out/standard-native-input-v2-pure-19be2ab4122c4603baa957daa733eb77`.
The 189 installed .NET `10.0.11` runtime file names were compared by ordinal
index against the pinned list; their LF UTF-8 name-set SHA256 is
`5a13c555d61d67fd42b9758e10e6cb55e26476f2477fa1d3a7d54064b9186c66`.
This check covers the names and current installed bytes used for the candidate
inventory, not physical hostfxr loading or all loaded code.

The source-set and package streams are digest-bound, but their internal schema
and content are not independently validated here. Asset identity and protected
file custody remain supplied metadata. Approval is unsigned and inert. The
codec exposes no GRANT or physical authority, and all acceptance flags remain
false. Complete protected originals, live context/worker binding and durable
stage consumption are still required before any physical W03 entry.

## Closed V2 stage-store model

`NativeHostStageStoreV2` supplies a pure, injected 68-slot transcript under
one fixed NativeHostV1 attempt root. Eight exact input originals precede an
`AttemptConsumed` record; every subsequent slot has a fixed filename and an
exact predecessor. Setup's GRANT intent/result precedes both key journals.
The standard-user stage separates transfer intent, loans, seed, return and
completion before GRANT intent/result. Each stage orders report, ACK and held
exit, while account activation and return-to-disabled have distinct intent/
outcome markers. Owner and Setup have separate source-role write allowlists;
User and Guardian cannot write durable slots in this model. Failure, unknown
sink result, duplicate CreateNew, changed predecessor, invalid receipt,
reentry and run/nonce reuse poison the session. Two archived account originals
are imported byte-for-byte with their pinned hashes.

Independent source and pure-output review PASS; a fresh warnings-as-errors
.NET 10 run passed profile **144**, input codec **125** and store **1,011**
checks. The store source/test SHA256 values are
`799ca1c8bd2fdf50d63b4891de0b6009fbced8bd9657030d78ffa6b9243064ce`
and `d2d6781e8bf18ddea19caadccccc13f732210306eb9c78b83dc33b61c86e73a5`.
The reviewed scratch is retained at
`out/nativehost-stage-store-final-ce2b56ef27d24122af665f9ffcc391c1`.
This is a model of a proposed order, not a physical store. Sink receipts,
guard checks, ACL/protection, flush, process association, transfer, GRANT,
report, ACK and held exit are injected statements only. The eventual native
store must reserve a fresh protected root across processes, verify actual
file/ancestor identity and source role, and refuse any partial root; no
physical durability or W03 authority follows from this model.

## Retained combined V2 control build

The six frozen C# files and reviewed builder produced three warning-as-error
.NET 10 DLL variants in
`out/lic008-standard-native-control-v2-7d964d0588374195a1e87cb3a8b1a68c`.
The seven-input source-set SHA256 is
`1bc6d8d589221c1fc6e5bd19b6a5c2520565ac98bcf55d99e4c72b7455c51c2d`.
Each closed generated entry passed profile **144**, input **125** and store
**1,011** checks, then refused **19** operational CLI shapes. The third
variant only changes C# preprocessor symbols; it does not compile C or run
a native call. [Five byte-exact originals](../evidence/standard-native-control-v2-20261111/README.md)
retain the source set, manifest and pure reports. Independent artifact/archive
audit PASS: all seven source/snapshot originals, 375 installed pins (374
unique file paths),
63 terminal child records and five byte-exact originals (101,186 bytes) were
checked. The manifest pins the installed 167 reference, 15 compiler and 190
runtime files; all account,
service, key, native, bootstrap, process/token, loaded-code, security,
production and LIC008 flags remain false.

## Closed V2 candidate package binding

`NativeHostPackageBindingV2` checks a canonical candidate source set with seven
fixed role/path anchors and a separate canonical candidate package manifest.
Both schemas reject the archived test-only build/source-set shapes. It joins
the six original profile, source-set, manifest, runtime-inventory, plan and
approval streams to the actual injected bytes of the seven source anchors,
native image, managed assembly, exact runtime configuration, hostfxr and 189
ordered runtime leaves. Names, lengths and SHA256 pins are checked; the returned
candidate owns defensive copies. A 192 MiB aggregate input limit is checked
before cloning the bulk payloads, including when a caller supplies a custom
list with a misleading count.

Independent source/test review PASS for the frozen binder source SHA256
`4a962433bec1179238053b71f946949f7f0601d2dba25dfdf41224a77420fac0`
and test SHA256
`06cbb736a4fd31d9ab4acbda9b7b0a586c76ea9aaf4fbff204fd469662d97095`.
A fresh warning-as-error .NET 10 pure run passed **700** checks. The reviewed
nine-input builder source set is
`295e416c76b3cb114b37a3c6c76a58f946f1b9d674667b058eb53fbd41ee4249`;
three closed .NET variants in
`out/lic008-standard-native-package-binding-v2-882df20d6ebf4022bdfcf3ac03f31e0a`
each passed profile **144**, input **125**, store **1,011** and package **700**
pure checks, and refused **19** operational CLI shapes. The third variant
changes C# symbols only. [Five byte-exact original reports](../evidence/standard-native-package-binding-v2-20261111/README.md)
retain this build's source set, manifest and three pure results.

This is an unsigned, in-memory content candidate only. Seven anchors are not
a complete source/build graph or source-to-binary proof; the three named bin
leaves do not attest actual on-disk contents or the absence of extra files.
Coherent replacement of all unsigned inputs can form another candidate, so
neither Owner intent nor a physical authorization follows. Actual protected
file and ancestor custody, current host/boot/Owner/process-token association,
loaded-code identity, durable stage consumption and service/CLR operations
remain unproved. `RequirePhysicalAdmission` always refuses the current closed
approval; every physical, security, production and LIC008 flag remains false.

## Corrected V2 service nonce width

Cross-component review found that the plan's three service-start commands and
the native loader require a 64-character lowercase-hex nonce, while the
original stage-store model accepted only 32. `NativeHostStageStoreV2` now
requires 64 and its fixtures use 64. Added tests compare the actual canonical
plan grammar, cover all four stage fixtures and reject the old 32-character
shape. Independent review and a fresh warning-as-error .NET 10 run passed
profile **144**, input **125**, corrected store **1,020** and package **700**
pure checks. The corrected store source/test SHA256 values are
`10db02dc8aedaa8c2841622bb7d87f3353be214798713c018edc5198d31c3125`
and `c21f628ba8d7f9c383b376f7c6525ae7c8ad6238a77a6bc165473f5a5b139eb3`.

The fresh nine-input source set is
`0473a1c1fb42fc01ed0335a44b9ee02fe92df5546c3f167e3563191e5b9bd4cd`.
Three closed .NET variants in
`out/lic008-standard-native-package-binding-v2-7e6e79bdeb4b4f1284d291ecca5641ff`
each passed those four pure suites and refused **19** operational entries.
[Five corrected byte-exact originals](../evidence/standard-native-package-binding-v2-nonce64-20261111/README.md)
retain the source set, manifest and results. The earlier 1,011-check builds
and original reports remain historical evidence; they are superseded for
future service-start integration, not rewritten or erased.

At this historical nonce-width checkpoint, the loader still required both
fields for every role while the Owner/User command grammar carried neither.
The later role-shape correction below supersedes that mismatch; the nonce-width
build remains retained as its own exact evidence.

## Closed pre-CLR role shape alignment

The November 11 source correction makes the three entry shapes exact: Owner
uses ten argv elements and stage 0 with both complete fixed run/nonce buffers
zero; User uses fourteen argv elements with `--run-id <lowerhex32>` and
`--nonce <lowerhex64>` after the source-set hash; Setup and Guardian use twelve argv
elements and keep their invocation run/nonce buffers wholly zero. Service
StartService arguments carry separate run/nonce values. Guardian-after is
stage 4, reserving stage 3 for User. The native loader requires exact 32/64
hex values for User/Setup/Guardian and rejects Owner nonzero bytes, including
hidden tails. Native host parsing leaves the caller's output untouched on a
shape failure. The old User grammar is rejected without changing any of the
three service-start grammars.

Independent source review and fresh warning-as-error scratch tests passed
profile **144**, input codec **134**, stage store **1,020**, package binder
**700**, native host **2,564**, and native loader **629/649** injected checks.
The fresh closed .NET package build and its [five byte-exact originals](../evidence/standard-native-package-preclr-shape-20261111/README.md)
passed those four managed suites in each of three variants, with 19 refused
operational entries per variant. The reviewed nine-input package source-set
SHA256 is `6cdabca7ae1b71027268fc6fd236002158dd3e948b99867503f53c2ee638d67d`.
Its nine sources do not include the native host/loader source graphs; those
have separately pinned builds and evidence.

The fresh six-input [native-loader build](../evidence/standard-native-loader-preclr-shape-20261111/README.md)
retains eight exact originals and three AMD64 executable/import sets. Its
independently reconstructed source-set SHA256 is
`e65308c647b5990384c1597d8a4a80bdf9fd9655f846bb4eafd2aef12fe87eb3`.
The default/unrelated/native variants passed **629/629/649** injected checks
and each refused **20** operational CLI shapes. The Windows/hostfxr variant
compiled its adapter but no native loading or managed entry ran.

The separately pinned [native-host build](../evidence/standard-native-host-preclr-shape-20261111/README.md)
retains eight exact originals and three AMD64 executable/import sets. Its
reviewed six-input source-set SHA256 is
`f8d47f0bb55af83c06226d89df8f02c48d0c72c40d136d1f4a67361c82f84da0`.
All three variants passed **2,564** injected checks and each refused **16**
operational CLI shapes. The first five-minute cold-cache attempt remains
incomplete with a pending record and no manifest; the final build used a
reviewed thirty-minute compile deadline in a separate fresh directory.

These checks establish format consistency only. User argv values are still
untrusted caller-controlled correlation identifiers. No Owner-authored
protected `StandardUserIntent`, one-use held-process/token association, live
origin/ancestor custody, cross-process stage authority or physical admission
exists. `NativeHostPackageBindingV2.RequirePhysicalAdmission` still refuses.

## Closed User intent and held-child correlation

`NativeHostUserIntentV2` adds a canonical Owner-constructed **proposal** for
User stage 3. It reparses the supplied profile, plan and approval originals,
checks their chain and validity windows, and binds their hashes, exact image
hash, standard-user SID, run32 and nonce64. Original parsing requires exact
canonical bytes. The proposed stage-store reference points to the fixed
`StandardUserIntent` slot 41 and the intent digest; the current store retains
only a generic digest event marker. It does not persist or authenticate the
intent original or carry it between processes. The `Owner` parameter is a
caller assertion, not a checked OS token.

`NativeHostUserLaunchV2` compares the exact User invocation with that proposal
and with injected facts about the **original held child** and its primary
token. Those facts include the invocation recorded at child creation, image,
process ID and creation time, process/token object IDs, token IDs, SID, group,
elevation and integrity claims. Creation time must fall between approval issue
and the current UTC sample. Two stable captures, a nondecreasing valid clock
and an atomic one-use instance transition are required; mismatch, unknown
callback or reentry consumes that instance. A fresh instance can still match
the same injected claims, so this is not durable replay prevention or real
process/token admission. Every physical, bootstrap and GRANT flag stays false.

Independent source review and a fresh warning-as-error .NET 10 scratch run
passed **187** User intent tests alongside profile **144**, input **134**,
store **1,020** and package **700**. The new source and test SHA256 values are
`6503edc89fade5ba3f96e39a5fdfbb3b66e0460a45adaf6aed2bfe02067337f9`
and `e17fa72dcf0213ebdfbe7855ad6cd8db0117a449153194e28e1087a86c61b3e2`.
The fresh reviewed eleven-input package source-set SHA256 is
`3a6370d522b237154524811c5f0edc6258ad7b2f6027da8d98788b07670ded33`.
Three closed .NET variants in
`out/lic008-standard-native-package-binding-v2-95fd1c54d47840bdaa8e92f976c92204`
passed those five suites and each refused **20** operational commands, including
the complete User command. [Five exact raw originals](../evidence/standard-native-user-intent-v2-20261111/README.md)
retain the manifest, source set and reports. Independent artifact/archive
audit passed for all 11 inputs, 375 installed pins, 66 terminal children,
60 refusals and five byte-equal originals. This source set pins the managed
closed model and builder; native host/loader sources remain separate builds.

## Closed V2 input-origin lease model

`NativeHostOriginLeaseV2` models six fixed directories from `C:\` through
`ProgramData`, the NativeHostV1 root, `records/<attempt>` and `input`, then
the eight exact StageStore input originals. It clones the originals before
any backend call, reparses the profile/plan/approval and runtime inventory,
checks all eight byte hashes and refuses changed order or scope. The supplied
ACL digest pins are stable injected claims, not a trusted V2 descriptor
policy. The model does not include the native image, hostfxr or 189 runtime
leaves.

Each injected relative open names one fixed child under a held parent and
returns a parent handle/identity/leaf witness. Observations carry the complete
64-bit volume serial and 128-bit file identifier specified by
[FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info),
plus exact final path, creation time, attributes, link count, length and
descriptor bytes. It refuses truncation, aliasing, wrong parent/leaf, reparse,
path/ACL/content changes and unexpected times. Pre/post checks and a final
14-target sweep sample each input again. Entered unknown operations, callback
exceptions and reentry poison the attempt and retain partial handle slots;
`Evidence()` refuses while a callback is active. The sequence is **not an
atomic filesystem snapshot** and has no actual Win32 origin, protected ACL,
durable cross-process custody or physical authority.

Independent source review and fresh warning-as-error .NET 10 scratch tests
passed **82** origin checks alongside profile **144**, input **134**, store
**1,020**, package **700** and User intent **187**. The new source and test
SHA256 values are
`2b54f09e085ec09b30223608bea1b21e522d8c90532b815447cbd4fb091bd09e`
and `036503e18378359408092d5224807fe28f8a1b3261bd80acc18cbb5a8673564b`.
The reviewed thirteen-input package source-set SHA256 is
`f523cb773ce574b662aa9e501a5ba1d665873895cef6b10fc6fabbad377ba14b`.
Three closed .NET variants in
`out/lic008-standard-native-package-binding-v2-cbbfbad83a364ddbb75a33627d20d115`
passed all six suites and refused **20** operational commands each.
[Five exact raw originals](../evidence/standard-native-origin-lease-v2-20261111/README.md)
retain the manifest, source set and reports. Independent artifact/archive
audit passed for all 13 inputs, 375 installed pins, 66 terminal children,
60 refusals and five byte-equal originals. Every physical, effect,
bootstrap, GRANT, security, production and LIC008 flag stays false.

## Closed V3 User reservation proposal and compile-only Windows origin

`NativeHostStageReservationV3` is a separate two-original stage-3 overlay;
it does not alter the V2 store's 68-slot transcript. It checks canonical
`NativeHostUserIntentV2` bytes in an Owner-only fixed path, then builds a
fixed-name `StandardUserLaunchReserved` original intended to precede User
launch. The original binds the current plan/approval, host/boot, injected
Owner and worker process/token context, User SID/image, run32/nonce64 and
exact command. The injected sink must claim CreateNew, protected ACL, flush,
full 64-bit volume/128-bit file identity, held-parent relative open and exact
readback; the model rechecks both originals after reservation. Existing or
unknown paths, partial writes, changed bytes, cross-instance replay against
the same fake sink, reentry and approval expiry refuse and strand the attempt.
This does **not** establish OS-authenticated Owner authorship, native durable
storage, cross-process replay prevention, or a bridge to V2
`AccountActivationIntent`/`NativeHostUserLaunchV2`.

`NativeHostOriginWindowsV2` adds a **compile-only** read-only shape for the
existing 14-target lease. Under a native macro it opens each single child
relative to a held parent with `NtCreateFile`, samples the complete
`FILE_ID_INFO` identity, final path, metadata and raw descriptor, and reads
input bytes with a bound. It checks an observed parent directory/non-reparse
shape before reuse. No CLI can call it, and its guard and ACL policy are still
injected. The [Windows API contracts](https://learn.microsoft.com/windows/win32/api/winternl/nf-winternl-ntcreatefile)
describe relative opens; they do not establish a continuous protected lease
or crash durability for this unexecuted adapter.

Independent source review and a fresh warning-as-error .NET 10 build passed
**145** V3 reservation checks alongside profile **144**, input **134**, V2
store **1,020**, package **700**, User intent **187** and origin lease **82**
in each of three variants. All variants refused **20** operational commands;
only the native-macro variant compiled the Windows adapter. The reviewed
16-input source-set SHA256 is
`c8d754972a168b17b2404e4a7673e403009547cec6f109875a1c562bc6fdef98`.
[Five exact raw originals](../evidence/standard-native-stage-reservation-v3-origin-win-v2-20261118/README.md)
retain the final manifest, source set and reports. Independent artifact/archive
audit passed for all 16 inputs, 375 installed pins, 66 terminal children,
60 exact refusals and five byte-equal originals. Every physical, effect,
bootstrap, GRANT, security, production and LIC008 flag remains false.

## Closed V3 fresh-reader parser and compile-only protected sink

`NativeHostReservationOriginalV3` parses a supplied canonical User intent and
the exact 32-property `StandardUserLaunchReserved` original in a fresh
process. It rechecks the plan/approval, host/boot, injected Owner/worker
context, User image/SID, run32/nonce64, exact command, time window and false
authority flags. Noncanonical, reordered, duplicate and changed fields are
refused. The bytes and context are still supplied assertions; this is no
protected read or cross-process replay proof.

`NativeHostReservationWindowsV3` adds a separate **compile-only** sink. It
holds a fixed seven-directory chain through `stage` and `journal`, expects
those two directories and both files to have exact Owner+SYSTEM protected
DACLs, treats only a definite missing leaf as absent, and uses relative
`NtCreateFile(FILE_CREATE)` for a one-name write. A returned handle is rooted
before status inspection; the code samples full `FILE_ID_INFO`, writes,
flushes and rereads the same held file, and reparses reservation bytes against
the held intent. No CLI can construct or call this sink. Its ancestor ACL
policy and host/boot/worker guard remain external. The requested Owner/primary
group descriptor and pre-existing parent ACLs may fail on a real target and
require a reviewed placement and physical test; compilation proves neither
feasibility nor [directory-entry crash durability](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).

Independent source review and a fresh warning-as-error .NET 10 build passed
**41** parser checks alongside profile **144**, input **134**, V2 store
**1,020**, package **700**, User intent **187**, origin lease **82** and V3
reservation **145** in each of three variants. Each refused **20** operational
commands; only the native-macro variant compiled both Windows adapters. The
reviewed 19-input source-set SHA256 is
`f65f8eb8c645f7fce91c5b809068d3d2d171298f42c0e4b0ea5242621bd3e5d5`.
[Five exact raw originals](../evidence/standard-native-reservation-original-v3-windows-sink-20261118/README.md)
retain the final manifest, source set and reports. Independent artifact/archive
audit passed for all 19 inputs, 375 installed pins, 66 terminal children,
60 exact refusals and five byte-equal originals. No native sink, account,
service, CLR or persisted-key API was invoked; all physical, effect, GRANT,
security, production and LIC008 flags remain false.

## Closed V3 preactivation prefix and current-host ACL feasibility

`NativeHostTranscriptShapeV3` explicitly names 69 ordered store slots. A
separate injected `NativeHostPreactivationV3` model covers only slots 41–43:
canonical `StandardUserIntent`, canonical `StandardUserLaunchReserved`, then
an Owner-authored `AccountActivationIntent` proposal. It rejects aliased full
file IDs, noncanonical originals, wrong ACL assertions, out-of-order creation
and write times, changed final rereads and attempted reuse. In particular,
reservation and activation creation must follow each record's own canonical
write time as well as the predecessor. The model's backend supplies all file,
ACL, token and time observations. Slots 0–40 and 44–68 remain unimplemented
as a physical V3 transcript; V2 receipts do not become V3 predecessors. No
account API or User launch is reachable from this model.

Independent source review and a fresh warning-as-error .NET 10 build passed
**313** preactivation checks alongside profile **144**, input **134**, V2
store **1,020**, package **700**, User intent **187**, origin lease **82**, V3
reservation **145** and reservation parser **41** checks in each of three
variants. Each refused **20** operational commands. The reviewed 21-input
source-set SHA256 is
`052fdcc3fa0fe569d0eceaf920342dc301e2a96f6bccfcd5becf06e87103d6bf`.
[Five exact raw originals](../evidence/standard-native-preactivation-v3-20261118/README.md)
retain the final manifest, source set and reports. Independent artifact audit
passed for 21 live/snapshot inputs, 375 installed pins, 66 terminal children,
60 refusals and no pending child. All physical/effect/acceptance flags remain
false.

A separate [Owner/group ACL diagnostic](../evidence/standard-native-owner-group-probe-v1-20261118/README.md)
was prepared from independently reviewed fixed source and run **once** in a
fresh ignored `out/` attempt on this laptop. The terminal result was
`FEASIBILITY_OBSERVED`: a fixed 28-byte file was created relative to a held
parent with `NtCreateFile(FILE_CREATE)`, and its actual owner/group were the
current Owner SID ending `1001`. The requested and observed protected DACL
contained only Owner and SYSTEM full-access ACEs; full file IDs, content and
descriptor bytes matched independent read-only inspection. This demonstrates
that descriptor choice for one file on this token, not the real W03 stage/
journal ancestor policy, native sink execution, cross-process custody or
standard-user isolation. The account remains disabled. The probe contains no
account/service/key API, and its false effect flags are scoped source claims.
File flush/readback does not establish crash durability of a directory entry.

## Historical V7 prefix seal and typed slot-41 intent

`NativeHostTranscriptPrefixV3` adds a fresh injected reader for nine fixed
directory witnesses and all 41 originals in slots 0–40. It validates the
eight bound input originals, canonical V3 event records 8–39, exact
predecessor hashes, source-role declarations, stage run/nonce uniqueness,
full 64-bit volume and 128-bit file IDs, path/parent relationships, ACL pins,
causal creation/write times, and a final reread of all 50 targets. Slot 40 is
a typed canonical prefix-seal original. Its hash commits to all nine
directory witnesses and the receipts for slots 0–39 without a self-hash
cycle. The returned seal and all evidence facts are injected assertions;
event evidence digests remain unauthenticated statements.

`NativeHostUserIntentV3` is a separate typed Owner proposal. It requires the
verified seal object, uses a new schema, and adds exactly one chain field:
`previousSha256` equals the canonical SHA256 of slot 40. It refuses a V2
intent at the V3 path, wrong seal/scope, stale or reused run/nonce and
noncanonical JSON. The historical V2 intent is unchanged. At this V7
checkpoint, the V3 reservation writer, fresh parser, preactivation model and
Windows sink still consumed V2 intent bytes, so a continuous 0–43 chain was
not yet modeled. The attempt/input/ancestor ACL pins were supplied
correlation, not independent security policy; actual protected-root ACL
policy remained open.

Independent source review and a fresh warning-as-error .NET 10 build passed
**97** prefix and **76** typed-intent checks alongside profile **144**, input
**134**, V2 store **1,020**, package **700**, V2 User intent **187**, origin
lease **82**, V3 reservation **145**, reservation parser **41** and
preactivation **313** per variant. Each variant refused **20** operational
commands. The reviewed 25-input source-set SHA256 is
`1976014cf360aa9b3604e14fa9bcf30014c23a88d2b23e51f8d71df03ed9ac90`.
[Five exact raw originals](../evidence/standard-native-prefix-seal-v3-20261118/README.md)
retain the final manifest, source set and reports. No native, account,
service, key, CLR, protected-root or W03 effect ran; all authority and
acceptance flags remain false.

## Current V8 typed V3 chain through slot 43

The [V8 pure integration evidence](../evidence/standard-native-typed-chain-v3-20261118/README.md)
records the coordinated V3-only predecessor path. The fresh injected reader
checks nine directory witnesses and slots 0–40, including the canonical
slot-40 prefix seal. The typed slot-41 Owner intent binds that seal by
`previousSha256`; the slot-42 reservation writer and fresh parser consume
only that V3 intent; the slot-43 preactivation model verifies the same seal,
intent and reservation before proposing an activation-intent original. The
verified stage directory's path, 64-bit volume and full 128-bit file ID are
carried by the seal and bound to the intent parent; the journal parent is
bound to the seal's terminal parent. V2 intent has no V3 fallback. The
Windows reservation sink compiles behind its closed macro and checks the
held attempt, stage and journal directory identities, but no physical W03
route calls it.

The warning-as-error V8 pure build reports, in order, profile **144**,
input **134**, V2 store **1,020**, package **700**, historical V2 User intent
**187**, origin lease **82**, V3 reservation **157**, fresh reservation parser
**44**, preactivation **331**, prefix **106** and typed V3 User intent **76**
checks. Its reviewed source-set SHA256 is
`87ab17b4ab7dabdfa19c826970f8dcedc42fa45a845061a4284efff56102c921`.
This is an injected and compile-only model result. It establishes no native
Owner/worker/host/boot custody, actual slot-40 file or cross-process
continuity, protected W03 root placement, crash-durable directory entry,
standard-account denial, account activation, User creation or LIC008 closure.
All model authority and acceptance flags remain false. The V7 archive above
remains historical evidence of the earlier unconnected state.

## Current-host ProgramData sibling placement diagnostic

A separately reviewed, one-use
[ProgramData sibling diagnostic](../evidence/standard-native-programdata-placement-probe-v1-20261118/README.md)
ran once in a fresh GUID fixture, not the canonical W03 root. It opened the
existing `C:\` and `C:\ProgramData` chain, used held-parent relative
`NtCreateFile(FILE_CREATE)` for five new directories and two fixed files,
and inspected paths, complete file IDs, ACLs, attributes and same-handle file
bytes. The terminal result was `FEASIBILITY_OBSERVED`: the seven new objects
had exact protected Owner+SYSTEM DACLs, distinct full IDs and expected bytes.
The standard account was still disabled after the run; the W03 root remained
absent. The first two compile-only preparations were never invoked.

This shows directory/file placement feasibility in a **sibling fixture on
this host**. `C:\ProgramData` itself grants Users write rights, so the actual
W03 root/records/attempt ACL policy and ancestor provenance still need an
explicit versioned decision and live guard. The diagnostic does not call the
compile-only V3 sink; it does not prove that the sink's later read-only
parent handles can create a child, cross-process custody, crash durability,
standard-user denial, account/service/key effects or W03 acceptance. Its
false effect flags describe the bounded probe source. The physical fixture
and all partial/terminal records remain retained without retry or cleanup.

## Next execution gates

1. Review a fresh actual protected placement for the compile-only V3 sink,
   including stage/journal and ancestor ACLs, provenance and current
   host/boot/Owner/worker OS facts. Bind the reviewed candidate and the V8
   typed chain to live root/original/runtime custody. Implement physical
   originals and custody for modeled slots 0–43, then slots 44–68 and a
   held-child consumer so real
   account activation and User creation follow a durable reservation. Prove
   cross-process replay and partial-history refusal. The one-file and
   ProgramData sibling probes do not authorize the canonical placement; do
   not classify intent as a generic readable input slot.
2. Implement actual held-process/primary-token association and one-use Owner
   object transfer, protected startup/loaded-code/file custody, real
   ServiceMain and managed bootstrap, then full controller/collector.
3. Review a fresh complete physical kit and only then expose the local
   owner-entered CONFIRM path for W03. The disabled standard account remains
   unused for logon until that gate.

Physical W03, W04/W05 native cases, TPM/NV, independent Windows/hardware,
LIC008/Open003 and Security/production acceptance remain open.
