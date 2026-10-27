## Draft-first agent workflow policy

- Always create new pull requests as **drafts**, in every repository and with every coding agent. With GitHub CLI, use `gh pr create --draft` (and the intended base branch).
- Never automatically mark a PR ready for review. Only the owner decides when to click **Ready for review**. Subsequent agent pushes must not change the PR's draft/ready status.
- Never merge, deploy, publish, or enable auto-merge without explicit owner approval. A request to implement a change or open a PR is not approval to release it.
- Perform relevant local checks before asking for review. Prefer targeted tests before expensive full suites; report commands, results, omitted checks, and remaining risks honestly.
- Use separate branches or worktrees for parallel tasks. Inspect existing changes first; never perform destructive Git operations on other worktrees or branches, discard someone else's work, or force-push over it.
- If a tool cannot create a draft PR directly, use a supported alternative (such as `gh pr create --draft` or the GitHub API's draft option), or report the limitation. Never create a normal PR and convert it afterward.
- Keep automatic draft-PR Actions jobs runner-free: include `ready_for_review` and `synchronize` in PR activities and gate **every** executable job before runner allocation, including detectors, matrices, reusable calls, and `always()` aggregates. A standard guard is `github.event_name != 'pull_request' || github.event.pull_request.draft == false`; combine it with existing conditions, never replace production authorization with it.
- Preserve main-branch CI, intentional manual workflows, trusted deployment triggers, path filters, check names, and concurrency safeguards. Do not use commit-message skips or unsafe `pull_request_target` execution as substitutes. Do not dispatch/rerun paid CI merely to test gating.

Persistent instructions guide agent behavior; they are not an access-control boundary. Merge protection, deployment permissions, and external-app settings remain separate owner-controlled safeguards.
