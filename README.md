# Design Flow

**From Team Conversations to Verified Code.**

A reusable local workflow for an existing Switch-managed Codex agent and a human team in Discord to make real frontend changes together. The tool manages task records, isolated Git worktrees, immutable revisions, actual npm checks, feedback and local human review. It never merges, pushes or deploys your target.

## Start here

Use Node **22.17.0 or newer**, npm and Git. The dashboard uses Next.js App Router, React, strict TypeScript and Tailwind. Runtime services and CLI run compiled JavaScript.

```powershell
cd V3-Switch/design-flow
npm ci
npm run build
npm run demo:setup
```

Finish the independent demo repository setup and initial commit in [docs/setup.md](docs/setup.md), then run:

```powershell
npm start
```

Open http://127.0.0.1:3000. In a second terminal in `design-flow`:

```powershell
npm run --silent flow -- doctor
```

The coordinator must remain running. The CLI and Next.js server use its automatically generated local connection metadata. No chat API key or custom bot setup is needed. No live Discord connection indicator is fabricated.

- [Setup, Windows diagnostics and recovery](docs/setup.md)
- [Repeatable Discord-to-code demo](docs/demo.md)
- [Verification results and pending live acceptance](docs/verification.md)
- [Canonical agent instructions](AGENTS.md)
- [Implementation context](docs/project-context.md)

## Commands

All commands below are preceded by `npm run --silent flow --`.

| Command | Purpose |
| --- | --- |
| `doctor` | Inspect service, configured Git roots/base/scope and npm resolution |
| `task create --project <id> --input <json-file>` | Save a draft brief and measurable criteria |
| `task ready --task <id>` | Confirm the draft is ready |
| `workspace prepare --task <id>` | Create its branch/worktree outside the primary checkout |
| `workspace install --task <id> --authorize dependency-install` | Explicitly authorized `npm ci` in the task worktree |
| `revision capture --task <id> --summary "..."` | Validate scope and commit the task changes |
| `verify --task <id>` | Execute configured checks against the captured commit |
| `feedback add --task <id> --input <json-file>` | Save feedback against its current revision |
| `task criteria --task <id> --input <json-file>` | Replace criteria using `{ "criteria": ["..."] }`; invalidate readiness |
| `task block --task <id> --reason "..."` | Record a blocker |
| `task resume --task <id>` | Resume a blocked task after inspection |
| `task cancel --task <id> --reason "..."` | Cancel without deleting its evidence or checkout |
| `status --task <id>` | Read records and current review readiness |

Success is JSON on stdout; failures are nonzero with a diagnostic on stderr. The agent CLI has no approval, merge, integration or publication command. The local dashboard records human decisions. This is an operational boundary on a trusted local machine, not protection against a malicious same-account process.

## How it works

Discord → existing Switch-managed agent → short-lived flow CLI → single local coordinator → task state and target Git worktree. The dashboard reads and acts through the same coordinator. It has no direct Switch/Discord client.

The JSON store is versioned, schema-validated and serialized, with atomic replacement and an exclusive process lock. Records and task history commit together. Checks preserve actual exit codes, timestamps and bounded logs (last 200,000 characters). Runtime metadata/logs/state/worktrees/dependencies are excluded from source. Local metadata is created with restrictive POSIX modes; Windows uses the existing directory ACLs and must be checked by the operator.

`draft → ready → implementing → verifying → in_review → approved`, with `changes_requested`, `blocked` and `cancelled`. Approval does not mean merged. When current files, criteria, checks or evidence differ, readiness fails and old approvals remain visible as history. A moved base branch is surfaced for human revalidation. No automatic cleanup or Git integration occurs.

## Development

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests execute real Git worktrees, compiled HTTP/CLI processes and npm success/failure/timeout scripts in disposable fixtures. See the verification report for separate real Next.js-target evidence and the Windows/Switch checks still requiring your machine.
