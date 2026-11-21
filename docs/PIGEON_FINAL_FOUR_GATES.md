# Final four gates — local engineering GO (2026-11-21)

Existing drafts SDK #8 / WHP #96 / Academy #220 remain drafts. **Local ENGINEERING
GO for the documented bounded design**, not owner release approval. SDK runtime,
wire contract and reviewed pin `45aca4f8db660426bf4531e2b1a8ec4358ef9bad` are unchanged.
No SDK tests rerun: prior 47 unit + 2 browser passes remain authoritative.

| Gate | Result |
|---|---|
| Two simultaneous genuine production Drill 15 wins | PASS — distinct IDs, correct owner, two committed attempts, one chapter completion, no stored checkpoint/medal regression, cross-player delivery 409 |
| Pending identity reconciliation | PASS — pending, in-flight, committed/ack lost and acknowledged; authorized merge preserves committed achievements, old-owner payloads reject, outboxes remain quarantined |
| Actual WHP process restart | PASS — real SIGKILL/replacement PID, original tab and PostgreSQL intact, explicit Load recovery before commit/after commit/pending; original receipt, no duplicate attempts |
| WebKit 568×320 | PASS — isolated reproduction 2/10; bounded instant Load scroll fix 20/20; clean full-suite viewport-fit checks |

WHP full browser suite **380 pass, 28 classified skips, 0 fail, 42.6m**, once,
sequential with fresh disposable data. All eight new matrix tests, ten existing
production completion/recovery tests and the production owner/checkpoint test
pass. Skips remain 14 optional analytics + 14 unrelated game builds, zero required
Academy skips. PostgreSQL/Memory concurrency subset: 18 test/subtest passes across
three race-enabled repetitions. Go internal race suite: 12 packages pass (some
cached); WHP typecheck and production frontend/executable builds pass.

Academy focused final-bridge/recovery files: **13 pass, 43s**. Its runtime/tests
unchanged, so its complete browser suite was not rerun (prior **273 pass**).
Only production change is WHP's atomic Load scroll placement, not a protocol fix.
The optional `presentsEndingReport` remains presentation-only, never a persistence
acknowledgment. No origin/source/session/identity validation was weakened.

Authoritative exact commands, limitations, historical failures and skip list:
WHP `docs/pigeon-release-evidence/final-REGRESSIONS.md`. Exact database rows,
receipts, before/after identity snapshots, quarantined storage and process PIDs:
`gates-database-and-receipts.json`, database mapping `gates-disposable-databases.json`,
complete run `gates-whp-full.log`. These use actual production Academy/WHP builds,
real wall-clock pointer wins and disposable PostgreSQL 18.7, not fabricated events.

## Recovery limitations requiring owner acceptance

Terminal retry requires original intact same-tab/origin storage and valid original
identity. Server restart is covered; pre-capture interruption and tab/storage/session
loss are not. Verified merge preserves committed achievements but deliberately
quarantines old-owner pending terminals. They are never silently relabelled or
falsely acknowledged; an uncommitted terminal stays unsaved and future genuine
attempts use the verified owner/new ID. At-least-once transport with idempotent
effects, not exactly-once networking.

Checkpoints are best-effort: server outage at final checkpoint emission can leave
fourteen stored prerequisite records while the captured completion/score later
commits once. Stored medals do not regress. Completed-chapter Load deliberately
returns a fresh usable map, not the ceremony/completed pin. Explicit owner acceptance
of these boundaries remains separate. Physical devices, hosted CI and authorized
exact-commit HTTPS acceptance remain owner gates.

No remaining confirmed four-gate defect. No merge, deploy, publication, autoDeploy
change, production data, new PR, paid CI or new soak. Required authorized order is
immutable SDK → supporting WHP → Academy last; rollback Academy first and retain
host receipts/outboxes/data until owner-controlled pause/drain. Stop at this scope.
