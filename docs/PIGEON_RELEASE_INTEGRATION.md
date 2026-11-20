# Pigeon release integration — NO-GO

Contract commit: 45aca4f8db660426bf4531e2b1a8ec4358ef9bad (unchanged).
WHP #96 and Academy #220 now pin it. Academy reports genuine Drill 15 success
through AttemptLatch, checkpoint first and presentsEndingReport:true second;
graduation dismissal is presentation only. No new Bridge receipt or identity
message exists: owner binding, outbox and database receipts are WHP-only.
Origin, source, game ID, session and lifecycle validation are unchanged.

Fresh local SDK verification: npm run typecheck, npm test (47 passed),
npm run test:browser (build + 2 passed). Initial browser execution collided with
the concurrently running WHP fixture on port 4174; serial rerun passed.
Companion evidence: WHP 10 focused tests, PostgreSQL deferred commit rollback and
lost response retries; Academy 595 unit tests and 7 real-SDK browser tests,
including each graduation-step interruption. These separate fixtures do not
establish the entire real Academy/WHP combined failure matrix.

NO-GO: anonymous identity-merge concurrency and full concurrent valid-tab,
old-client and identity/browser matrix remain open in WHP. No exactly-once claim.
There is no automatic recovery before a validated terminal reaches WHP durable
storage, or when tab/storage/session/identity recovery prerequisites are lost.
See WHP docs/PIGEON_RELEASE_BLOCKERS.md and Academy RELEASE_QA.md for limits.

Required owner-authorized order: review SDK contract, supporting WHP first,
Academy last. No registry publication is needed for immutable Git pins. Rollback
Academy before WHP; retain receipt support for loaded clients/pending outboxes,
retain all durable rows and monotonic checkpoint reconciliation. An owner-controlled
pause/drain is required before incompatible host rollback. Physical Safari/Android
and exact-commit HTTPS integration acceptance remain manual gates.

All existing PRs remain drafts. No merge, deploy, publish or autoDeploy change.
