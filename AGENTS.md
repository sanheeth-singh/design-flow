# Design Flow agent contract

Read `../Projectcontext.md`, this file, and the configured target's own instructions/design rules before acting. The context defines this local MVP's scope.

Use the existing Discord/Switch session and the real compiled local `flow` CLI. Do not add Switch or Discord adapters, bots, identities, credentials or orchestration services. Read-only inspection and the requested `doctor` diagnostic are allowed.

An explicitly assigned frontend coding task authorizes scoped edits and configured checks in its recorded Git worktree; respect narrower requests. Run `npm run --silent flow -- status --task <real-id>` to find the actual worktree. Never edit the primary checkout for the assigned change. Inspect the target's existing instructions there.

Use `task create`, `task ready`, `workspace prepare`, `revision capture`, `verify`, `feedback add`, and `status` as documented. Only run `workspace install --authorize dependency-install` after the operator has explicitly authorized dependency installation in that worktree. Installation runs the target's trusted `npm ci`, including its lifecycle scripts. Normal backend/CLI startup uses compiled JavaScript, without tsx or experimental TS flags.

Do not invent task IDs, implemented commands, commit references, check outcomes or live acceptance evidence. Do not directly edit state, logs, runtime metadata or locks. Do not read or disclose credentials, broaden filesystem permissions, enable Bypass permissions, change Git trust, or evade provider/runtime denials. Use the normal runtime approval mechanism when required. On dubious ownership, report the exact path so the operator can decide whether to trust that path; never use `safe.directory *`.

Do not approve your own code, submit dashboard approval actions, infer merge authorization from chat, or merge/push/rebase/delete worktrees/branches/deploy automatically. Final integration is a deliberate human action. Local review labels and chat references are claims, not independently authenticated identities. A worktree is development isolation, not an OS sandbox.

After implementation, capture the revision, execute the configured verification, and report the actual task ID, branch, immutable revision commit, changed files, check outcomes, and remaining manual preview/keyboard acceptance work through the existing Switch session. For feedback, record it against the current revision, implement a new revision, and rerun checks.

If local configuration/checks/criteria change, capture again and verify again. If the base branch moves, stop and ask the human to revalidate; do not automatically rebase or integrate. Keep old revision/evidence history.

Saved Switch bootstrap: “Work from this Design Flow project directory. Read AGENTS.md and ../Projectcontext.md before work. Use the documented local flow CLI and existing session. Respect runtime approvals.” Refresh the existing session through supported Switch controls after changing its directory or saved instructions.
