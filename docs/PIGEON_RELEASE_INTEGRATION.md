# Pigeon engineering integration

**Current: [final four gates — local ENGINEERING GO](PIGEON_FINAL_FOUR_GATES.md).**
The dated NO-GO assessment below is retained as historical evidence, not the
current disposition. SDK runtime/contract unchanged; no SDK tests rerun.

## Historical integration assessment — NO-GO

Reviewed runtime contract `45aca4f8db660426bf4531e2b1a8ec4358ef9bad` is unchanged
and pinned by both WHP #96 and Academy #220. The optional validated boolean
`presentsEndingReport` retains presentation; it is not a durable receipt.
Academy reports genuine success before the five-step graduation is dismissed.
Identity/outbox/commit receipts stay entirely in WHP, not Bridge. Origin, source,
session, game identity and lifecycle validation remain unchanged.

Fresh SDK checks: typecheck, build, **47 unit tests and 2 browser tests pass**.
The previous supported SDK `1bff976bf55355e907c4dcaf72c3685137e3a989` was rebuilt
and served to the new WHP integration fixtures: **6 pass** (normal/held reports,
failure, replay and phone presentation). This is not every old shipped game.

New combined evidence uses actual production Academy inside WHP's actual game
player and PostgreSQL 18.7, not two independent fixtures. Three genuine Drill 15
runs pass: normal completion, aborted request and lost response after commit.
All five graduation steps remain interactive; same-tab reload recovery produces
matching attempt receipts and one attempt/chapter completion. Real valid tabs
preserve independent checkpoint improvements. WHP's minimal source-write/identity-
merge correction passes 50 race-enabled PostgreSQL/MemoryStore repetitions.
Exact records/messages/IDs: WHP docs/pigeon-release-evidence/final-*.

Still NO-GO: the entire requested production matrix is not closed (simultaneous
completions, pending identity changes, process restart, successful production replay,
and reload at each graduation step). Full regression results and all skips are in
WHP docs/pigeon-release-evidence/final-REGRESSIONS.md. No missing test is claimed as
a confirmed new production defect or waived into a pass.

Supported recovery requires original same-tab/origin storage and valid player
session plus explicit Load. Pre-host-capture interruption, tab/storage/session loss
and identity replacement have no automatic terminal recovery guarantee. Quarantine
identity conflicts; never relabel terminals or infer victory from fifteen checkpoints.
At-least-once transport with idempotent effects, never exactly-once network delivery.

Owner-authorized order (NOT executed): immutable SDK contract → supporting WHP →
Academy last. Rollback Academy first; keep WHP receipts/outboxes/monotonic saves for
loaded clients and pending intents until an owner-controlled pause/drain permits
rollback. Physical devices, hosted CI and authorized exact-commit HTTPS acceptance
remain separate. No registry publication is required for these Git pins.

All three PRs remain drafts. No merge, deploy, publish or autoDeploy change.
