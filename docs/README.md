# Project documentation

Start here. Folder layout is organizational: moving a document does not change
its decisions, acceptance gates or historical evidence.

## Start and current work

- [Project checklist](project/PROJECT_CHECKLIST.md): project-wide progress.
- [Attendance checklist](project/ATTENDANCE_EDITION_CHECKLIST.md): Edition-specific work.
- [Licensing session handoff](project/LICENSING_SESSION_HANDOFF.md): current state,
  consumed experiments and safe next work; not a second design authority.
- [Licensing index](licensing/README.md): design, plans, reviews and evidence.

## Find a topic

| Area | Documents |
| --- | --- |
| Architecture/security | [Security design](architecture/security-design.md) |
| UI | [Unification plan](ui/EDITION_UI_UNIFICATION_PLAN.md), [primitive inventory](ui/EDITION_UI_PRIMITIVE_INVENTORY.md) |
| Features | [Attendance audit](features/attendance-audit.md), [Inbox](features/inbox.md) |
| Operations | [Packaging decisions](operations/PACKAGING_DECISIONS.md), [Windows matrix](operations/WINDOWS_SUPPORT_MATRIX.md), [K40 setup](operations/k40-setup.md), [backup/restore](operations/backup-restore.md) |
| Backend reference (kept beside source) | [Domain model](../server/docs/domain-model.md), [device API](../server/docs/devices-api.md), [Prisma guide](../server/PRISMA_GUIDE.md) |

## Layout and maintenance rules

```text
docs/
  README.md
  LICENSING_DESIGN.md       compatibility entry point only
  project/                 checklists and current handoff
  architecture/            cross-project design/security
  licensing/
    README.md
    design/                authoritative contracts and decisions
    plans/                 proposed and completed experiment plans
    reviews/               review findings and their exact reviewed scope
    experiments/           diagnostic methods, failures and outcomes
    evidence/              retained original report copies and hashes
  ui/                      shared visual system
  features/                feature behavior and audit notes
  operations/              install, compatibility, devices and recovery
```

1. Read the authoritative contract before implementing a plan. Plans and reviews
   never silently override the master design or close its checklist gates.
2. A plan must state PLANNING_ONLY, KIT_PREPARED, IN_PROGRESS, COMPLETED or BLOCKED,
   with evidence and limits. A completed simulation is not production acceptance.
3. Keep current work in the handoff and canonical checklist; link from indexes.
   Avoid introducing new copies of long status summaries. Existing mirrors are
   preserved in this layout migration; deduplication is a separate reviewed change.
4. Keep historical failures and consumed experiments. A completed test is not an
   obsolete contract. Evidence JSON bytes and frozen protocol/vector packages
   must not be rewritten during documentation cleanup.
5. Preserve existing filenames/IDs in this migration for searchable history.
   Update relative links and script consumers when a file moves. The one old-path
   design entry point supports the immutable protocol README; do not put content there.
6. Backend-local references and immutable licensing packages remain beside their
   code. This index links them; it does not duplicate them.

## Validation

Run `npm run test:docs-links` from the repository root. The read-only checker covers
local inline Markdown target existence in tracked/unignored Markdown, plus resolver
self-tests. It does not verify external URLs, heading anchors, reference-style
links or report authenticity. Changes to protocol-consumed documentation paths
also require `npm run test:license-protocol-v1` with the pinned Node runtime.

## Layout migration — 2026-10-06

Original root checklists/handoff moved to project; security to architecture;
Licensing design/reviews/plans/experiment descriptions to their corresponding
licensing folders; licensing-evidence to licensing/evidence; UI to ui; attendance
audit/Inbox to features; packaging/Windows/K40/backup to operations. No content
history was removed, crypto contract changed or acceptance gate closed.
The prior r82 hash-reconciliation and reinstall-planning work is preserved.
