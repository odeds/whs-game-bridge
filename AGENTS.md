# Agent instructions

Read `README.md` and `docs/AGENT_POLICY.md` before changing this repository.

- Create every new PR as a draft (`gh pr create --draft`). Never mark it ready automatically; pushes must not change its status.
- Do not merge, deploy, publish, or enable auto-merge without explicit owner approval.
- Run relevant local, targeted checks before requesting review. Use separate branches/worktrees and never discard work on another branch/worktree.
- No GitHub Actions workflows currently exist. Future workflows must follow the job-level draft guards in `docs/DRAFT_FIRST_CI.md`; do not add hosted jobs just to validate this policy.
