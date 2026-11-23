# V2 partial Prepare — 2026-10-17

Status: PARTIAL_FAILED_RETAIN. Never rerun Prepare or issue fresh permission to
reuse this namespace. No cleanup, binary replacement or service restart authorized.

Candidate4c7923163636489a86768c96c12165f8; experiment30173bfda30af041dcc879170579d658.
Evidence: owner-pasted Setup and Guardian JSON from attachment157f250d-69f3-4554-9972-d91db327197e.
Protected original file hashes have not yet been captured. These are supplied
reports, not independent security acceptance or completed physical cases.

Setup run968ca8f2ad4347c40b38a9339013fd8f, time2026-10-17T10:25:06Z:
all four results PASS: private directories, restricted key, app-readable key,
public control. Schema2, expected plan/package/assembly hashes, identity true,
artifactIdentityMatched=true, groupCount1, attributes14, unrestricted complete query.
Two owned test keys are therefore reported created and must be retained.

Guardian run348e5ea406acc37c1d00f75a54785489, time10:25:14Z:
serviceIdentityMatched=true, exact V2 Guardian user/owner SID, groupCount0,
attributes0, tokenRestricted=false, tokenQueryComplete=true. Earlier V1 identity
refusal is not reproduced here. restricted-seal-stage UNKNOWN/OPERATION_UNKNOWN
after40ms, nativeStatus=null, workerEnded=true. No second seal step reported.

artifactIdentityMatched=false is generated when any work result is UNKNOWN;
POST_OPERATION_CONTEXT was not tested. It does not prove binary tampering.
Task.Wait in NativeWorker can wrap the worker exception in AggregateException;
the reporting catch records HResult only for a directly caught CryptographicException.
Thus null nativeStatus does not exclude a cryptographic failure. Exact failing
suboperation is still unknown (ownership/control read, key open/verify/export
denial, in-memory seal/roundtrip, staging write/readback).

Read-only CIM: Setup Stopped/Manual exit0; Guardian Stopped/Manual exit1067;
App Stopped/Manual exit1077. Protected root read denied to the non-elevated agent;
denial is not absence. No live worker claimed from these stopped snapshots.

Next collect bounded existing report hashes and file ACL metadata read-only to
narrow the storage boundary. Never weaken ACLs or try the operation as SYSTEM
to bypass the failed Guardian context. If static evidence is insufficient,
prepare a separately reviewed diagnostic with explicit suboperation errors;
do not rerun the mutating seal stage. LIC008 and full pilot remain incomplete.
