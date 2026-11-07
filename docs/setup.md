# Setup

## Requirements and paths

Node 22.17.0 is the supported baseline. Next.js 16.4.5 declares Node >=20.9.0; no Node upgrade is required for that baseline. Versions are pinned and lockfiles are included. This delivery was executed on Linux with Node 24.22.1; the baseline and Windows runtime still need live validation.

Extract the whole `V3-Switch` folder somewhere new. Preserve existing V2 projects. Use the `design-flow` directory as the existing agent's new project directory only after preparing this project. Services bind to 127.0.0.1.

```powershell
cd D:/your-folder/V3-Switch/design-flow
npm ci
npm run build
```

## Choose the frontend

Either configure your own separate committed Next.js/React/TypeScript/Tailwind repository or create the included independent example. No existing frontend is overwritten.

```powershell
npm run demo:setup
cd ../demo-frontend
npm ci
npm run build
npm run typecheck
npm run lint
git status
```

The initial build settles Next.js-generated TypeScript config/declarations before the base commit. Inspect the files and use your existing Git identity; if Git asks for one, set your own identity in this demo repository. Then, only in this newly created demo:

```powershell
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.mjs postcss.config.mjs eslint.config.mjs .gitignore src
git commit -m "Initialize independent demo frontend"
cd ../design-flow
```

`demo:setup` creates `config/projects.local.json` only if absent. It refuses an existing target directory. An optional destination is accepted: `npm run demo:setup -- "D:/Frontend Projects/my-demo"`. This copies source and initializes Git; it does not install dependencies or commit on your behalf.

For another frontend, copy `config/projects.example.json` to `config/projects.local.json`, then edit it. `repositoryPath` is relative to the config file, so `../../demo-frontend` points to the sibling of `design-flow`. `frontendRoot`, `allowedPaths` and `deniedPaths` are relative to the target Git root. Use forward slashes in JSON or escape Windows backslashes. Existing committed local `baseBranch` is required. Scripts must exist in the target package.json; targets must declare the selected frontend stack. Configure specific editable subdirectories, never `.`. Environment/Git/workflow/dependency/build directories stay protected. Symlink paths in scope and changed files are refused.

The package scripts are operator-owned trusted configuration. Chat inputs select neither shell commands nor new permissions. Only named configured npm scripts execute; lifecycle scripts in an explicitly authorized `npm ci` remain the target's responsibility.

## Start and inspect

```powershell
npm start
```

Keep the terminal open. Open http://127.0.0.1:3000. In a second terminal at `design-flow`, run `npm run --silent flow -- doctor`. Doctor reports what it observed and explicitly leaves actual worktree writes/check execution and the external Switch session unproven. The first real task proves those capabilities.

For development, start `npm run coordinator` in one terminal after compilation, and `npm run dev --workspace @flow/web` in another. Do not also run `npm start` then. Default root `.flow` is resolved automatically by the web server; a custom state directory should be absolute and identical in both terminals.

Optional settings in PowerShell before launch:

```powershell
$env:FLOW_CONFIG = "D:/Frontend Projects/config/projects.local.json"
$env:FLOW_STATE = "D:/Frontend Projects/flow-state"
$env:FLOW_WORKTREES = "D:/Frontend Projects/flow-worktrees"
$env:FLOW_COORDINATOR_PORT = "4310"
$env:FLOW_DASHBOARD_PORT = "3000"
```

`.env.example` documents the variables; it is not automatically loaded. Relative environment paths resolve from the command's current directory; use absolute paths for custom settings. All CLI invocations must use the same `FLOW_STATE` as the launcher. Worktrees must live outside the target's primary checkout. On Windows, inspect the state directory ACL; POSIX mode arguments do not establish independent Windows identities. Do not broaden permissions or expose runtime metadata.

The launcher starts exactly one coordinator and one production Next.js dashboard; regular CLI commands never start a service. The service token is generated for the process lifetime, stays out of browser responses and CLI output, and is read by local clients from untracked runtime metadata. Same-account local access does not authenticate a human reviewer independently.

## Point the existing agent at V3

Use supported Switch controls to update the existing agent's working directory to this `design-flow` directory. Set the short bootstrap from the bottom of AGENTS.md as its saved instructions; retain the canonical file rather than copying all instructions into Switch. Refresh the session through supported controls. Keep Bypass permissions off. No room ID, new registration or Discord bot is required.

Ask the existing agent in Discord: “Read AGENTS.md and ../Projectcontext.md, then run `npm run --silent flow -- doctor` and report the actual output. Do not implement a task yet.” Test this inside the managed agent as well as your owner terminal.

If Git reports dubious ownership for the new exact target, inspect the error. If you trust that specific repository, authorize the exact-path `git config --global --add safe.directory "D:/exact/new/target"` in the affected execution context through normal supported approval. Never use `*`, change ownership, or assume the old V2 trust applies. Any additional path must be diagnosed from its own error.

## Shutdown and recovery

Use Ctrl+C in the launcher terminal and allow any active check to finish. The launcher requests graceful coordinator shutdown over local child-process IPC; it does not remove a writer lock itself. Standalone coordinator SIGINT/SIGTERM handlers also shut down gracefully on supported systems.

A conflicting port or active writer lock is an error, not a reason to start another coordinator. Change ports only deliberately and restart. Runtime discovery checks the expected service and random instance, so a stale file or unrelated listening process fails clearly.

After a confirmed crash, run `npm run recover` from the same directory/state environment. It refuses an active or uninspectable PID, validates any existing state, rereads the lock to detect changes, and removes only a confirmed inactive writer's lock and discovery metadata. PID reuse can require manual inspection; never remove an active lock. Corrupt state is preserved and startup stops; restore a known good backup while the service is stopped. Back up the whole state directory with its logs and keep the target repository/worktrees containing referenced commits.

A crash during worktree creation or commit can leave Git work already performed before the record transaction was saved. Inspect `git worktree list`, branch and checkout contents before retrying. Nothing automatically deletes, resets or reuses such a directory. A restart with a task left `verifying` records an interrupted blocker; inspect, resume, and verify again. The dashboard derives readiness from current evidence instead of treating interrupted work as passed.

If the base moves, the dashboard blocks approval and reports it. This MVP does not automatically rebase or remap an old task base. The human reviews the changed base and can start a fresh task from it; preserve the original history. Final integration always requires separate human Git action.
