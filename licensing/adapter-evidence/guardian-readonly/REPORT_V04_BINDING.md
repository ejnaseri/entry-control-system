# Adopted report successor0.4 binding — 2026-10-16

Adoption documentation committed first as f673286. Implementation direction only;
physicalExecutionAuthorized/securityAccepted/productionAccepted remain false.

## Delivered

- Adopted implementation-packet-v04.json, raw SHA256
  c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b.
  Base0.3 and all drafts/reviews/adoption references retain their exact bytes.
- Program.SuccessorPacketSha256, compiled builder assertion and review-helper
  profile now bind0.4. Builder custody includes the seven additional protocol
  inputs. Historical v0.3 checker still verifies its preserved contract and
  recognizes the exact pinned successor, without claiming v0.3 authorizes v2.
- New check-license-report-successor.mjs verifies22 transitive artifacts, builder
  bindings, adopted/draft delta, inert guard and12 successor negative cases.
  It also runs preserved32 owner-successor and28 draft negatives. These checks
  are binding/structural evidence, not independent security review.
- TestCapable remains refused. Existing reason REPORT_V2_ADOPTION_PENDING is a
  legacy refusal label; scoped adoption exists, but built-kit/physical permission
  does not. No permission is inferred from that label or product adoption.

## Verification

New inert candidate: out/lic008-pilot-runtime-candidate-3c7e06d802184a9da29dc63fe8fdd3ee.
Self-contained provenance SHA256:
7c9a40a3600039161f91e592b70f10a39734e3999a4200aca3f802a595731ccf.
Complete builder exit0;1807 managed cases PASS and same suite rerun in app-local
package/extracted bound wrapper. Native/controller/apphost refusals PASS.

prepare-license-pilot-review.mjs completed read-only host inspection and produced
eight non-authorizing review files at out/lic008-prepare-review-0fdcb9ebc51b70c26eb4f4fabae2c075.
physicalExecutionAuthorized=false; approvalDecisionCreated=false. This is a tool
compatibility check, not a fresh Prepare request. Retained experiment is known to
exist and must not be treated as absent or ready merely because drafts exist.

The new checker initially assumed every builder hash was stored in protocolPins;
it was corrected to recognize the existing explicit CandidateCodec hash check.
No codec bytes or protection rule changed.

## Next boundary

Perform bounded source-to-built-kit review for this0.4 inert candidate. Separately
resolve how a future experiment can run without adopting/overwriting the retained
failed experiment. Keep original roots/keys/services and frozen reports intact.
No TestCapable enablement, current Prepare retry, cleanup or in-place replacement.
Actual Guardian with these bytes and Windows matrix remain unverified; accepted
full physical cases remain0/5. Existing authorization does not cover a new stage.
