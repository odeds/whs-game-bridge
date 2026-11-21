# Pigeon release verification

**Current: [final four gates — local ENGINEERING GO](PIGEON_FINAL_FOUR_GATES.md),
2026-11-21.** SDK runtime/contract unchanged; tests deliberately not rerun. The
following earlier report is preserved verbatim as dated historical evidence.

## Pigeon continuation verification — 2026-11-20

**NO-GO for the combined release.** Tested SDK runtime: `45aca4f` (PR #8).

Passed locally: `npm run typecheck`, `npm test` (47 tests / 3 files),
`npm run build`, `npm run test:browser` (2 tests). No SDK lint script exists.
The optional `presentsEndingReport` boolean remains presentation-only, not a
persistence acknowledgment. No new recovery wire protocol was added.

WHP PR #96 runtime `72def679e5a204b3d6e0f61ec5ad337c9b4135c3` adds atomic
Academy checkpoint reconciliation with real disposable PostgreSQL 18 evidence.
Its 6 custom-ending Chromium tests passed against its actual old SDK pin
`1bff976bf55355e907c4dcaf72c3685137e3a989`. This demonstrates the old runtime's
extra-field compatibility, **not joint adoption of this SDK commit**.

Academy PR #220 runtime `5f7be6d8` remains unchanged: 595 unit tests / 31 files,
typecheck, lint and production build passed. Graduation completion remains delayed
until dismissal. WHP terminal recovery remains memory-only; per-attempt fallback
and lost acknowledgments remain unresolved. Do not publish this SDK as proof of
durable completion or exactly-once delivery. Every-step graduation interruption,
pre/post-commit failure injection, reload recovery, full joint regressions and
physical-device/live-WHP acceptance are still required.

No schema migration in this SDK or checkpoint-only host change. Required future
sequence: verify the recovery contract, host/server implementation, then Academy
adoption, before any separately owner-authorized release. Rolling back the host's
checkpoint reconciliation reintroduces overwrite risk; preserve all stored data.
No merge, ready-for-review change, deployment, publication or paid CI dispatch.
