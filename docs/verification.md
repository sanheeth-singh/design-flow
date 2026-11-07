# Verification report

Observed 7 November 2026 (India time). This report separates build-environment observations from the live workflow still requiring the operator's machine.

## Build environment

Linux; Node 24.22.1; npm 11.9.0; Git 2.51.1. Pinned Next.js 16.4.5, React 19.3.1, Tailwind 4.3.5, TypeScript 5.9.3 and Zod 4.6.7 were resolved from npm. Next.js declares Node >=20.9.0, compatible with the user's 22.17.0 baseline. That baseline was not executed here.

| Check | Result |
| --- | --- |
| Clean `npm ci` from committed source lockfile | Passed |
| Compiled Node runtime and production Next.js build | Passed |
| Strict TypeScript checks | Passed |
| ESLint | Passed |
| Node test runner | 13 tests passed; no skips |
| Real independent Next.js target install/typecheck/lint/build | Passed |
| Two actual frontend revisions with checks in the task worktree | All six required checks passed, exit 0 |
| Production dashboard and target HTTP smoke checks | Passed |
| Browser visual/responsive/keyboard checks | Pending: browser executable unavailable; download failed |
| Windows and existing managed agent | Pending: not accessible here |

The test suite creates actual disposable Git repositories/worktrees and uses real npm subprocesses. It covers two-revision feedback/review persistence, primary dirty-checkout preservation, idempotency/conflicting references, single-writer rejection, corrupt-state preservation, two project configurations, traversal/symlink protection, staged/untracked/deleted scope failures, actual failed/timed-out scripts, stale code/criteria/configuration/base/evidence, check-induced source mutation, one executing task, compiled CLI/HTTP task creation while the service runs, service restart/discovery, stale metadata, outdated dashboard evidence rejection, unavailable approval/merge CLI commands, and occupied-port failure/lock release. Local review calls in those tests are explicitly harness calls, not human approvals.

The backend, CLI and launcher execute compiled JavaScript. No tsx dependency or experimental TypeScript runtime flags are present.

## Scripted real frontend task

The separate demo target was installed and built, its baseline committed, and a real task was created through the compiled CLI while the production dashboard and coordinator ran. The primary target was left on its original base. Navigation changes were made only in the recorded worktree, captured in immutable commits, and checked there. Scripted feedback then requested larger mobile targets; a second commit and all required checks followed. The task was left in review without a human approval or merge.

See [acceptance-evidence.json](acceptance-evidence.json) for actual task/commit references, timestamps, changed paths, six captured logs/outcomes and provenance. That file deliberately omits runtime credentials/discovery metadata. The generated target repository/worktrees and runtime state are not shipped as source; these references document observed execution, not objects in the tool's Git history.

HTTP smoke checks exercised production HTML, the same task via the dashboard's coordinator proxy, real Git revision diffs, same-origin task creation, cross-origin mutation rejection, absence of the service token in browser API responses, and target preview markup. HTTP success does not establish browser layout or keyboard behavior. Chromium installation returned truncated/invalid download content, so no browser screenshots or browser acceptance are claimed.

## Live acceptance still required

Follow [demo.md](demo.md) after [setup.md](setup.md):

1. Point the existing Switch-managed agent at V3 and run doctor in both the owner terminal and the actual managed session.
2. Submit the real brief in Discord. Confirm the agent's returned task ID is visible in the running dashboard.
3. Exercise worktree writes and explicitly authorized dependency installation under the Windows agent account. Inspect real typecheck/lint/build logs.
4. Inspect the target preview at mobile and desktop widths and with the keyboard. Send concrete feedback through Discord; capture and verify revision two.
5. Record your own observations and approve the exact current evidence in the local dashboard.
6. Deliberately integrate the reviewed commit yourself and demonstrate the resulting frontend. Restart the service and confirm preserved history.

Windows npm entry-point resolution, path spaces/drive letters, Git ownership/trust, worktree permissions, process-tree termination and ACL behavior are implemented but remain unverified on the actual machine. POSIX permission modes are not Windows authentication. Git worktree isolation is not an OS sandbox. Shared-machine local review does not independently prove Discord identity.

## Scope and known limits

One local writer and one executing task; no direct Discord/Switch adapter, custom bot, new API identity, background scheduler, hosted preview, agent approval command or automatic Git integration. Check logs retain the last 200,000 characters. The store uses atomic replacement and validates state; it is not a database with power-loss recovery guarantees. A crash between an external Git operation and the following state write can leave an unrecorded branch/worktree/commit; setup documents inspection and conservative recovery. Base movement blocks review for human revalidation; automatic rebasing is excluded. Backups and exact target Git objects remain the operator's responsibility.

The coding MVP and build-environment workflow are delivered. Full hackathon/live acceptance is pending the real Windows/Discord/human walkthrough above.
