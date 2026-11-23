# V3 prepared input and interrupted console — 2026-10-28

[V3 contract and reviewed artifacts](../../plans/LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
· [Build/review evidence](../export-policy-control-v3-20261028/README.md)
· [Current handoff](../../../project/LICENSING_SESSION_HANDOFF.md)

Preparation checkpoint: elevated owner CheckOnly and separate Prepare passed for
V3 attempt `44d5ee6845b040ae894f2b1e6415bf2e`. The exact prepared inputs are archived
below. The owner closed the blank Execute console without entering CONFIRM.
No Execute result was emitted. Subsequent elevated collection found V3 Setup
absent, all eighteen inspected protected files absent, and the original Guardian
stopped. This is an interrupted, unconfirmed launcher, not a consumed physical
experiment or passing export-policy result. Its launcher and inputs remain retained
and are not reused. A subsequent fresh CheckOnly again admitted input preparation.
[The separately bound subsequent attempt](../export-policy-control-v3-run-20261028/README.md)
records the later live-confirmed physical result.
LIC008/Phase6.2 and Security/production acceptance remain open.

## Observed preparation

CheckOnly ran09:57:29.7778920–09:57:46.8712303UTC and returned
`READY_FOR_INPUT_PREPARATION`, with no owner input or physical stage issued by
that operation. It bound the reviewed V3 candidate/package, expected owner,
current host/boot and original Guardian snapshot. Guardian was observed at its
original path/virtual account, Stopped/Manual/PID0. This is the actual elevated
preflight capture, separate from the earlier advisory root/SCM observation.

Prepare ran09:58:35.9725797–09:59:06.1955309UTC and created three new local JSON
files. The plan/approval window is09:58:53.7356916–11:58:53.7356916UTC on October28
(14:28:53.7356916–16:28:53.7356916 Kabul). Preparation requires separate exact
hash/effect review and live owner confirmation; it does not execute or supply
confirmation. The window is an input binding, not permission to reuse or extend
an attempted/expired approval.
The subsequent bounded independent exact-input review passed. Both preparation
processes ended; that review does not establish an execution outcome.

The approval names only the new V3 root, new LocalSystem Setup and two new test
keys, temporary use of the existing Guardian against those controls, restoration
only after independent service/process termination, and retention of new state.
No cleanup, retry, seal or retained-key change is authorized by these files.
The scalar fix's ordinary-token evidence does not prove LocalSystem admission
or a paired export-policy result.

## Interrupted console and independent display probe

The visible elevated launcher PID2540 started at10:02:59UTC. Its exclusive start
marker contains10:03:04.5699619UTC; the757-byte transcript contains only the
PowerShell5.1.22000.2538 header, with no body/footer. The owner reported seeing a
blank blue window and closing it without entering CONFIRM. The process was absent
when inspected, with no Execute-result.json or live ExportPolicyControl process.
Those observations do not identify the exact startup instruction interrupted.
The transcript SHA256 is
`a57c995e41e541a10f874b49f65ed30aef04df844d46812218c8c059026c4779`;
the start-marker SHA256 is
`66a932f74905b9c48231b688c39044608910a62083bc66b9d2613a0e92f19a62`.

The separately elevated [collection](collection-index.json) ran10:11:42–49UTC.
All three service/process snapshots found the original Guardian Stopped/Manual/
PID0, V3 Setup absent, and no live control process. Its SCM queries returned1060
for V3 Setup. All fourteen fixed JSON and four package-file paths were absent.
No protected file was copied, and no key inventory was attempted. Absence of
these files alone is not proof of key absence or a general execution outcome.
The collector made no service, ACL or key changes.

A separate console-only probe at10:15:26–47UTC recorded direct file milestones
around Console.WriteLine, Write-Host, Start-Transcript and Stop-Transcript. Every
stage completed, and the owner confirmed visible text. It invoked no kit, input,
service or key operation. The earlier blank-window cause was not reproduced or
established. [Probe result](console-probe-result.json) records exact script and
stage-log hashes; original probe files remain in
`out/lic008-v3-console-probe-b9841d53ebe0489784a3330a5ce76d9d`.

## Exact custody and bindings

The seven JSON files are exact byte copies of their respective local records;
no archived JSON was reserialized or redacted.
Every copy's byte length and SHA256 match its source. Git attributes disable
newline conversion and whitespace checking for this archive. Records contain
owner SID, paths and host/boot metadata, with no private key material or credentials.
All prior evidence archives remain unchanged.

CheckOnly/Prepare captures came from
`out/lic008-export-policy-v3-owner-check-9b4bed4310af4e1aad6ed826dd184ef1`.
The three inputs came from
`out/lic008-export-policy-v3-input-44d5ee6845b040ae894f2b1e6415bf2e`.

| Binding | SHA256 |
| --- | --- |
| Reviewed kit `17ba89f4fc18449baa50c92abdc348ae` | `510bf819019a418f6bfecd41abfb4f362741393a218e1cd6a66eb31c2b5fca04` |
| Capable manifest `835d77e7113841a7bc5673cef2cd8eb6` | `b6f450fd5e6397d322f45fcc6df52322b28b8a376701b30ab9908f2f79b1156e` |
| Package manifest | `73ddc70b61171f2e348a39ba38b315691fd226298caacaf7b5f01495af129f1b` |
| Plan | `9d9ee84c6353b17e7276c22cef4f912f9beb51d1d6a800141ec4a08f7f4cf77e` |
| Approval | `b726802c91f5b0fd8a7897d8dbe74cefdc50c8323cc55bbfdc5f61f13cf054ce` |

| Archived original | SHA256 |
| --- | --- |
| [CheckOnly-result.json](CheckOnly-result.json) | `81a4eb02abedcb23b208b83fa70d88fcb28afda0eb52e40ac60dcbc593902fba` |
| [Prepare-result.json](Prepare-result.json) | `17a180204ebd76153d74a2e9ca0df169003b6622c71ed4c513a52cf2c9658e57` |
| [prepared-input.json](prepared-input.json) | `2c0dfea7f8c1ca2d5f57bc1db9243f643aa0de7291add1a673f04078c5017db5` |
| [plan.json](plan.json) | `9d9ee84c6353b17e7276c22cef4f912f9beb51d1d6a800141ec4a08f7f4cf77e` |
| [approval.json](approval.json) | `b726802c91f5b0fd8a7897d8dbe74cefdc50c8323cc55bbfdc5f61f13cf054ce` |
| [collection-index.json](collection-index.json) | `c8db3088defd6ee202dd05335989e4022c02d41c4436680ea8b1e0ceddd37266` |
| [console-probe-result.json](console-probe-result.json) | `50675d9c1686863d4789688ccf73b566a2a0b7f6a4503f88aa0f021e29f228c7` |

Preserve these bytes. Any execution capture, protected result or later collection
must be recorded separately and interpreted from its actual evidence. A wrapper
return, transcript, stopped status or diagnostic code alone is not physical
success, independent process-exit proof or acceptance.
