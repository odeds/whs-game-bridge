# Draft-first agent workflow

## Audit and change

This repository has **no GitHub Actions workflows**, before or after this change. No CI, deployment, provisioning, or publishing automation was added. No local active Git hooks or agent PR-creation utility was found. Agent draft-first behavior was not previously specified at the root.

`AGENTS.md`, the explicit `CLAUDE.md` imports, and reusable `docs/AGENT_POLICY.md` now require draft PR creation, owner-controlled readiness/releases, targeted local checks, and safe parallel branches/worktrees. Existing project instructions and configuration are preserved.

| Event | Before | After |
| --- | --- | --- |
| Agent creates PR | No root draft requirement | Must use draft creation; never create ready then convert |
| Agent pushes more commits | No root status rule | Must preserve current draft/ready status |
| Draft opened / updated / reopened / converted back | No Actions workflows | No Actions workflows; zero hosted jobs |
| Ready transition / ready commits / human ready PR | No Actions workflows | Still no CI; do not mistake absence of checks for verification |
| Main push / manual deployment | No Actions workflows | No Actions workflows added |

Local validation: inspected current remote-main file inventory, checked Markdown/import targets and policy consistency, and ran `git diff --check`. There is no workflow for actionlint or event execution here; adding a hosted job solely for policy validation would defeat the task. Application/browser suites were not needed for instruction-only changes.

## Settings audit and limitations

GitHub reports main is **not protected**. Its one `base` ruleset is **disabled** and contains deletion/non-fast-forward rules only, with no required status checks. No environments, Actions checks, or external status providers were visible in the inspected records. No settings were changed. This policy does not create merge enforcement or production authorization that did not already exist.

External hosting/preview apps cannot be ruled out by the absence of check records. Owner review of GitHub Apps and hosting-provider settings remains necessary. No merge, deployment, readiness transition, workflow dispatch, or paid validation run was requested.

## Requirements for future CI

- Subscribe to `pull_request.types: [opened, reopened, synchronize, ready_for_review, converted_to_draft]`.
- Gate **every executable PR job**, including detectors, matrix jobs, reusable callers/callees, and aggregates, before allocating a runner: `github.event_name != 'pull_request' || github.event.pull_request.draft == false`.
- Combine that guard with existing conditions. For `always()` jobs use `always() && (draft guard)`. A step guard alone still spends runner minutes.
- Keep push checks main-only, preserve intentional manual authorization and trusted production triggers, and use PR-number-based concurrency to cancel superseded PR runs. Conversion to draft can request cancellation; already-spent minutes and historical ready-event reruns cannot be made free retroactively.
- Do not use commit-message skips or unsafe `pull_request_target` execution. Do not add hosted jobs solely to validate draft gating.
- Test draft open/update/reopen/conversion, ready transition/update/open, main push, manual safeguards, empty matrices, and `always()` locally. Check path-filtered and required-check behavior separately: ready events still respect paths, and unmatched required workflows can remain pending.

**Skipped is not tested.** Drafts cannot merge, but skipped jobs can satisfy status rules. After marking ready, the owner must wait for a new successful, non-skipped verification run at the current head/merge SHA, not a draft's skipped result. Preserve required-check names; prefer unfiltered aggregates over dynamic/path-filtered required contexts. Required PRs/checks/up-to-date rules need owner configuration; they do not by themselves distinguish skipped from executed. Race-free proof across readiness transitions on the same SHA requires an owner-controlled external merge gate/app or equivalent trusted merge process. This PR adds neither a service nor new CI and makes no hard merge-enforcement claim.

## Global installation

The reusable policy was installed on this machine at `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`, and `~/.pi/agent/AGENTS.md`. Those files were absent; existing model, hook, permission, and MCP configuration was left intact. Codex CLI is not available, so runtime loading was not exercised. Start a fresh session (or `/reload` in Pi) and inspect loaded sources. Managed-only settings, custom homes, context disabling, and overrides can affect loading.

To install on another machine, run from this repository root. This appends once and preserves existing instructions; review an existing policy block manually when updating it:

```bash
python3 - <<'PY'
import os
from pathlib import Path
policy = Path('docs/AGENT_POLICY.md').read_text()
marker = '## Draft-first agent workflow policy'
def active(directory, names):
    return next((directory / n for n in names if (directory / n).is_file()), directory / names[1])
codex = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))).expanduser()
claude = Path(os.environ.get('CLAUDE_CONFIG_DIR', str(Path.home() / '.claude'))).expanduser()
pi = Path(os.environ.get('PI_CODING_AGENT_DIR', str(Path.home() / '.pi/agent'))).expanduser()
targets = [active(codex, ['AGENTS.override.md', 'AGENTS.md']), claude / 'CLAUDE.md',
           active(pi, ['AGENTS.override.md', 'AGENTS.md', 'AGENTS.MD', 'CLAUDE.md', 'CLAUDE.MD'])]
for target in targets:
    old = target.read_text() if target.exists() else ''
    if marker not in old:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(old.rstrip() + ('\n\n' if old.strip() else '') + policy)
    print(target)
PY
```

Supported locations were checked against [Codex instructions](https://developers.openai.com/codex/guides/agents-md/), [Claude memory/imports](https://code.claude.com/docs/en/memory), and installed Pi `docs/configuration.md` / `docs/environment-variables.md`. Persistent instructions are workflow policy, not a tool-permission boundary. Repository instructions take effect after normal owner review/merge; this change remains a draft PR.
