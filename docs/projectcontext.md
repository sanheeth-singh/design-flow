# Design Flow — V3-Switch Project Context

Version: 1.0  
Date: 6 November 2026  
Status: Implementation specification; the V3 application has not been built or verified yet.

## 1. Purpose and governing decisions

Build Design Flow from scratch in a new V3-Switch project. Keep the product name **Design Flow** and tagline **From Team Conversations to Verified Code.**

Design Flow is a reusable, chat-driven frontend development workflow. Human teams and an existing Switch-managed Codex agent collaborate in Discord to request, implement, verify, review and revise real frontend changes. Design Flow supplies project configuration, task records, isolated Git workspaces, verification evidence and a local review dashboard.

The hackathon objective is: **“Build a workflow where an AI agent and the people in a team chat get a real task done together.”**

The deliverable is one working end-to-end MVP, implemented in one delivery phase. Internal development steps and tests are required, but the user must not be sent through another series of numbered migrations or separately approved development phases.

This document is the implementation contract. Do not silently add infrastructure, broaden scope, substitute another project, or claim completion based only on mocked tests.

## 2. What has already been demonstrated

The following evidence was reported by the user from the existing Windows setup:

- Discord is connected to Switch.
- The existing `design-flow-agent` receives tagged requests and replies in Discord.
- It received and recalled an untagged context token.
- It read the Design Flow project package metadata from its local execution environment.
- It ran the existing configuration doctor successfully with Node's native TypeScript transformation after the loader and Git ownership issues were addressed.
- The successful doctor returned exit code 0 and validated the configured Git base, frontend root and allowed paths.

This establishes conversation delivery, project reading and execution of that diagnostic. It does **not** establish writable worktree access, dependency installation, new CLI integration, frontend implementation, verification execution or V3 acceptance. Those must be demonstrated by the new implementation.

Reported environment:

| Item                    | Reported value                                       |
| ----------------------- | ---------------------------------------------------- |
| Operating system        | Windows; PowerShell and VS Code                      |
| Owner account           | `BUNNYME9/SANHEETH`                                  |
| Agent execution account | `BUNNYME9/CodexSandboxOffline` in the tested session |
| Node.js                 | 22.17.0                                              |
| Existing agent          | `design-flow-agent`, provider Codex                  |
| Switch Console          | 0.40.1                                               |
| Switch server           | 0.31.0                                               |
| Discord channel         | `design-flow-development`                            |
| Existing Switch room    | `025f41fe-d195-4672-8f91-7bdedd5e8a69`               |
| Existing room name      | `DesignFlow Room: design-flow-development`           |

The room information is reference context, not a V3 API connection requirement. Do not hardcode this user's identifiers or filesystem paths into reusable application code. The agent's actual directory and execution permissions must be checked when the new project is configured.

## 3. Clean-start policy

- Create a new V3 codebase. Do not copy the previous Design Builder Python/SQLite implementation, HTML/CSS generator, V2 direct Switch adapter or V2 application source into V3.
- The old projects and delivered ZIPs remain reference/checkpoint material. Do not delete or migrate them.
- No task-state migration, adapter migration, sender enrollment or API-key migration is required.
- Reuse the working Discord connection, existing room and existing Switch-managed agent where supported.
- A one-time update of the existing agent's project directory/instructions is legitimate setup. Do not promise that a clean rebuild eliminates the need to configure an existing external agent.
- Produce one canonical root `AGENTS.md` for the V3 project. If Switch requires a saved instruction field, use a short bootstrap pointing to that file rather than duplicating a long, divergent policy.
- Current governing instructions must permit requested diagnostics and configured checks. Do not recreate the old blanket prohibition on verification commands.

## 4. Product scope

### Required MVP capabilities

1. Configure an independent frontend Git repository, frontend root, base branch, allowed paths, design rules and required checks.
2. Create persistent tasks with a brief and measurable acceptance criteria through a local CLI and the dashboard.
3. Let the existing Switch-managed Codex agent invoke the same local CLI used by developers.
4. Prepare one task branch and Git worktree without changing the target's primary working tree.
5. Allow the agent to implement an explicitly assigned frontend change inside that worktree.
6. Capture numbered revisions with actual Git commit references, changed files and the task's criteria version.
7. Run actual configured checks and persist truthful outcomes, logs, timestamps and exit codes against the checked revision.
8. Record human feedback, preserve revision history and verify subsequent revisions again.
9. Display evidence and local review decisions in a Next.js dashboard.
10. Leave final Git integration as a deliberate human action outside the agent's automated workflow.
11. Supply a repeatable demo and an honest record of automated and live acceptance results.

### Explicitly excluded

- Direct Switch REST/WebSocket/SSE clients, operation discovery and gateway integration.
- Custom agent registration, registration keys, a second `design-flow-coordinator` identity, chat outboxes, event cursors and manual sender enrollment.
- A new Discord bot, direct Discord SDK integration or custom Discord slash commands.
- Application login, hosted multi-user accounts, OAuth or a production identity/authorization service.
- Automatic merge, push, pull request publication, deployment or publication of target previews.
- Multiple coding agents, concurrent executing tasks, autonomous background scheduling or complex orchestration.
- Automatic ingestion of every Discord message, attachment processing or complete chat mirroring.
- A generic HTML generator, standalone prototype generation, non-frontend repositories or multiple frontend frameworks for the MVP.
- A new database server, Redis, message broker, cloud backend or serverless deployment.
- Arbitrary commands taken from chat and automatic expansion of repository permissions.
- Theme redesign, image generation or other assets unrelated to the single demonstrated frontend task.

## 5. Architecture and ownership

| Component                      | Responsibility                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Discord                        | Human requests, discussion, feedback and agent summaries                                                 |
| Switch                         | Existing room routing, agent session management and supported runtime approval                           |
| Existing Codex agent           | Interpret the brief, invoke local workflow tools, edit the assigned worktree and report actual results   |
| Design Flow CLI                | Validated workflow commands with structured output; shared entry point for the agent and local developer |
| Local coordinator              | Own persistent writes, task transitions, workspace operations and verification execution                 |
| Next.js dashboard              | Read workflow records and expose bounded local task/review actions                                       |
| Configured frontend repository | The actual Next.js/React/TypeScript/Tailwind application receiving changes                               |
| Git worktree                   | Isolated task checkout and branch; not an operating-system sandbox                                       |

The communication path is:

**Human Discord request → existing Switch-managed Codex agent → local Design Flow CLI → local coordinator → task records and frontend worktree.**

The agent posts summaries back through its existing Switch tools. Design Flow does not post to Discord itself.

Retain one local coordinator and one local dashboard process. These are the application's existing architectural roles, not new external services. The CLI is short-lived and calls the coordinator; it must not become a second state writer.

## 6. Technology and runtime

Use Next.js App Router, React, strict TypeScript, Tailwind CSS, Node.js, npm workspaces, Git and the existing Switch/Codex installation. Zod may be used for input validation. Use Node's built-in test runner for focused core/service/CLI tests unless a concrete need justifies another test dependency.

Use compatible pinned package versions and commit the lockfile. Do not depend on `latest` at install time. The package versions chosen during implementation must be verified rather than inferred from this document.

**Local backend, CLI and launcher commands must run compiled JavaScript.** Compile their TypeScript with TypeScript before launch. Use Node-compatible imports and package exports; do not require `tsx`, a custom runtime loader or experimental TypeScript flags for the normal V3 workflow. Next.js retains its own standard build pipeline for the web application.

Reason: the existing agent session failed during `tsx` initialization at `os.userInfo()` with `uv_os_get_passwd ... ENOMEM`. Running the diagnostic directly with Node progressed successfully. The underlying OS/loader failure has not been diagnosed, so do not claim that RAM exhaustion or a global Node failure was proven.

Support the user's Node 22.17.0 baseline if compatible with selected dependencies. If a required dependency cannot support it, identify that before selecting it and explain the minimum requirement. Do not silently impose a reinstall.

All local services bind to loopback. Default dashboard port: 3000. Default coordinator port: 4310. Both are configurable.

## 7. Repository structure

```text
V3-Switch/
├── Projectcontext.md
└── design-flow/
    ├── AGENTS.md
    ├── README.md
    ├── package.json
    ├── package-lock.json
    ├── .env.example
    ├── .gitignore
    ├── apps/
    │   ├── web/
    │   │   └── src/
    │   │       ├── app/
    │   │       ├── features/
    │   │       └── components/
    │   └── coordinator/
    │       └── src/
    │           ├── config/
    │           ├── storage/
    │           ├── tasks/
    │           ├── workspaces/
    │           ├── verification/
    │           └── http/
    ├── packages/
    │   ├── core/src/
    │   └── cli/src/
    ├── scripts/
    ├── config/
    │   └── projects.example.json
    ├── requests/
    │   └── mobile-navigation.example.json
    ├── docs/
    │   ├── setup.md
    │   ├── demo.md
    │   └── verification.md
    └── tests/
```

Generated JavaScript, local configuration, runtime connection metadata, task state, logs, dependencies and worktrees are untracked. The managed frontend repository is separate from the Design Flow tool. A demo repository is a configured target, not a product dependency or a hardcoded ExchangeBook integration.

## 8. Configuration

Use one operator-owned project configuration file. Paths must be resolved predictably and documented: repository paths relative to the configuration file; frontend and allowed/denied paths relative to the target Git root.

The following illustrates the intended configuration shape; it is specification data, not a claim that a schema already exists:

```json
{
  "schemaVersion": 1,
  "projects": [
    {
      "id": "demo-frontend",
      "name": "Demo frontend",
      "repositoryPath": "../../demo-frontend",
      "frontendRoot": ".",
      "baseBranch": "main",
      "allowedPaths": ["src", "public"],
      "deniedPaths": [".git", ".github", ".env", "node_modules"],
      "designRules": [
        "Preserve the existing brand palette",
        "Support mobile layouts and keyboard navigation",
        "Use existing design tokens and components"
      ],
      "checks": [
        {
          "id": "typecheck",
          "runner": "npm",
          "script": "typecheck",
          "required": true,
          "timeoutMs": 120000
        },
        {
          "id": "lint",
          "runner": "npm",
          "script": "lint",
          "required": true,
          "timeoutMs": 120000
        },
        {
          "id": "build",
          "runner": "npm",
          "script": "build",
          "required": true,
          "timeoutMs": 300000
        }
      ]
    }
  ]
}
```

Do not require Switch room IDs, Discord guild/channel IDs, user mappings or chat credentials in this file. Optional source references may be attached to a task as provenance only.

Validate repository existence, Git root, committed base branch, frontend location, path traversal and symlink escapes. Protect environment files, Git metadata, workflow files and dependency/build directories. Allowed paths do not authorize editing the entire repository. Changes to checks or acceptance criteria invalidate the corresponding review readiness.

Checks invoke configured npm script names. Do not accept a shell command string from a task or Discord message. Resolve and test npm execution on Windows and Unix; a `.cmd` file must not be assumed to work through generic shell-free `execFile`. Prefer invoking the verified npm JavaScript entry point with Node when practical. Report unavailable runners instead of silently skipping checks.

## 9. Local service and persistence

The coordinator is the only persistent writer. Use a small versioned JSON state store with serialized transactions, temporary-file writes, atomic replacement, validation and exclusive writer locking. Task changes and their history entries commit together. Preserve corrupt state and report a useful error rather than resetting it.

The CLI calls the existing local HTTP service for mutations and queries. The Next.js server uses that same service. A process-lifetime token and service address are generated automatically and made available through local runtime metadata. No manual API-key provisioning is required. The CLI may read that metadata internally; it must never print the token. Keep the file untracked and restrict access using the platform's available permissions. Do not claim same-user local files provide independent human identity verification.

Startup must verify that the responding service is the expected coordinator. Handle stale runtime metadata, a coordinator that is down, conflicting ports and graceful shutdown explicitly. Never remove an active lock to make a second writer succeed. Do not start an implicit second coordinator for an ordinary CLI mutation.

The dashboard and CLI must operate while the coordinator is running. The agent must not edit state.json or lock files directly.

## 10. Task and revision model

Required records:

| Record       | Required information                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Project      | Repository/root/base, scope, design rules and checks                                                   |
| Task         | ID, project ID, title, brief, criteria, criteria version, status and timestamps                        |
| Workspace    | Task branch, worktree path, base commit and preparation state                                          |
| Revision     | Number, immutable commit, base commit, changed files, criteria version and summary                     |
| Check run    | Revision/commit, check ID, actual runner/script, start/end times, outcome, exit code and log reference |
| Feedback     | Task/revision, author label, requested change and timestamp                                            |
| Local review | Exact revision, criteria version, evidence references, decision and timestamp                          |
| History      | Attributed action, timestamp and task/revision references                                              |

Human/agent labels and Discord source references supplied through the agent are recorded as claims, not independently authenticated chat identities. Do not manufacture verified-human flags from CLI input.

Use a compact state machine:

**draft → ready → implementing → verifying → in_review → approved**

Feedback requesting changes moves a task to **changes_requested**, followed by implementation of a new numbered revision, verification and review again. **blocked** and **cancelled** preserve their reason and history. Do not expose arbitrary state assignment.

Do not mark a task integrated or merged merely because it is approved. Automatic integration is outside scope. Final application of the reviewed branch is performed by the human and described in the demo evidence.

Task creation may accept an optional request reference. Repeating the same explicit request reference with identical input should return the existing task; conflicting reuse must fail. Without a reference, a new create command is a new task. Do not rebuild a generic chat-event system for this feature.

## 11. Local CLI contract

Implement one npm entry point named `flow`. The following are proposed interfaces to implement and test, not commands that exist at the time this document is written:

| Invocation                                                               | Behavior                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `npm run --silent flow -- doctor`                                        | Report service, configuration, repository and tooling diagnostics |
| `npm run --silent flow -- task create --project <id> --input <file>`     | Validate a brief and persist a draft                              |
| `npm run --silent flow -- task ready --task <id>`                        | Confirm brief readiness through a valid transition                |
| `npm run --silent flow -- workspace prepare --task <id>`                 | Prepare the isolated task branch/worktree and report its state    |
| `npm run --silent flow -- revision capture --task <id> --summary <text>` | Check scope and capture a numbered revision of actual work        |
| `npm run --silent flow -- verify --task <id>`                            | Run configured checks for the captured current revision           |
| `npm run --silent flow -- feedback add --task <id> --input <file>`       | Record feedback with provenance and revision reference            |
| `npm run --silent flow -- status --task <id>`                            | Return task, workspace, revision, check and review information    |

Use structured JSON output on stdout for machine use and concise diagnostics on stderr. Failures return nonzero exit codes. Doctor must distinguish observations from untested capabilities. Unknown commands and invalid inputs fail clearly.

Do not add a CLI command that lets the agent approve, merge or mark its own work integrated. Local review decisions are made by the human in the dashboard. Do not claim this is an adversarial security boundary when the agent and human share the same trusted machine/account access.

## 12. Git workspaces and real implementation

One executing task at a time is sufficient. Support multiple configured projects without changing code, but demonstrate one target and one task first.

- Keep the target's base working tree and its existing uncommitted work intact.
- Create a dedicated task branch and worktree at a recorded base commit.
- Validate all paths, worktree containment, repository identity and allowed changed paths.
- Resolve changed/untracked files and symlinks deliberately; do not inspect only staged changes.
- Install target dependencies only as an explicit, documented workspace preparation action authorized by the operator. Do not silently install packages in the user's primary checkout or use a node_modules symlink as an assumed cross-platform solution.
- Run checks in the task worktree's configured frontend root.
- Capture only authorized task changes. If protected/out-of-scope files changed, block revision readiness and report them. Do not automatically stage the whole repository or discard files.
- Record immutable revision commits and reject verification/review evidence if the worktree no longer matches the revision. Worktree-local dependency/build outputs must be handled correctly as ignored artifacts.
- Do not automatically merge, push, rebase the base branch, delete a worktree, delete branches or clean a checkout.

The exact worktree layout is operator-configurable and outside the target's primary checkout. A worktree provides development isolation; it does not restrict the agent's overall OS access.

## 13. Verification and human review

Verification is a product feature, not a fabricated agent summary. Save the configured script, actual execution result, logs and checked commit. Outcomes must distinguish **passed**, **failed**, **timed_out**, **error**, **skipped** and **not_run**. Only exit code 0 from an actually executed required check can count as passed.

A task is review-ready only when the latest required checks match its latest immutable revision and the current configuration/criteria, and changed files remain within scope. A timeout must stop the check process appropriately on Windows as well as Unix; never report a timed-out command as passed because the launcher exited.

Automated lint/type/build checks do not prove responsive appearance or keyboard usability. The human reviews a local preview of the target and records those acceptance observations separately. Preview instructions can be shown, but a shareable hosted preview service is not required.

Feedback and revision history remain visible. New code, new criteria, changed checks or changed evidence invalidate previous review readiness/approval. Surface a changed base commit for human revalidation before final integration.

The human may approve or request changes in the local dashboard. Record the exact revision and evidence reviewed. This is a local operator decision; no independent authentication of a Discord approver or cryptographic human identity is claimed. The agent does not submit the approval action. The human performs final Git integration outside automated agent execution.

## 14. Dashboard

Build a small, useful local review interface:

1. Overview: configured projects, tasks and current task state.
2. Task details: brief, criteria, design rules, worktree/branch and source references.
3. Revision evidence: changed paths, commit references, check outcomes and readable logs.
4. Review: feedback history, revision-specific local approve/request-changes actions and stale-evidence notices.
5. Setup diagnostics: actual local service/project readiness, not a fake Discord connection indicator.

Keep the UI light-only, mobile-responsive, readable and restrained. Use centralized design tokens, accessible focus states, labeled forms, minimal icons and no emoji. Design Flow's tool UI is distinct from the configured frontend's branding; preserve that frontend's own design rules.

Do not add chat panels, room administration, social features, analytics or an elaborate dashboard before the core task loop works.

## 15. Agent instruction contract

The V3 root AGENTS.md must say, in clear terms:

- Use the existing Discord/Switch session and the real local flow CLI.
- Read Projectcontext.md and the configured project rules before work.
- Read-only inspection and the requested doctor diagnostic are allowed.
- An explicitly assigned coding task authorizes scoped edits and configured checks in its recorded worktree. Respect a narrower request.
- Do not invent task IDs, outcomes, revision commits or implemented CLI commands.
- Do not directly edit state or manipulate locks.
- Do not read/disclose credentials, broaden file permissions, enable Bypass permissions or evade provider/runtime denials.
- Use the normal runtime approval mechanism for operations that require it.
- Do not approve your own code, infer merge authorization from chat or perform automatic integration.
- Report the actual branch/revision, changed files, checks and remaining manual acceptance work to Discord.

Saved Switch instructions should point to this canonical contract. Refresh the session after a material instruction change using supported controls; never tell the agent to ignore a higher-priority runtime instruction.

## 16. Windows and agent-environment lessons

The implementation must address the actual observed environment rather than repeatedly changing architecture around an untested assumption.

1. The agent may run under a sandbox account different from the repository owner. Git can reject the repository as dubious ownership.
2. The user explicitly trusted the exact old demo repository via safe.directory, and the agent's approved configuration write succeeded. This trust is path-specific and does not automatically cover a new V3 target.
3. Diagnose ownership errors and show an exact-path trust instruction for the operator to approve. Never set safe.directory to `*`, trust arbitrary directories, change ownership or enable broad permission bypass automatically.
4. `tsx` startup failed in the managed session before application code. Compiled JavaScript is the standard V3 backend/CLI runtime strategy.
5. A doctor that succeeds in the owner's terminal has not proven it succeeds inside the Switch-managed agent. Test both execution paths.
6. Validate Windows executable resolution, path quoting, spaces, drive letters, process termination, runtime metadata permissions and Git worktree writes.
7. If a normal approval request is needed, show it accurately. Do not mislabel an approved retry as an unapproved sandbox bypass.
8. Avoid `os.userInfo()` and user-profile inference when an explicit project/state path is sufficient. Do not claim a particular system error's root cause without evidence.

## 17. One delivery phase and implementation order

Build the complete MVP in one implementation phase. The following is execution order, not a new gated phase roadmap:

1. Scaffold the clean workspace, compiled Node runtime, config validation and canonical instructions.
2. Implement the single-writer coordinator, automatic local service discovery, CLI and task dashboard.
3. Demonstrate an agent-created task appearing in the dashboard while the coordinator remains running.
4. Implement task worktrees and revision capture with scope checks.
5. Implement actual verification execution and logs.
6. Add feedback, revision comparison and revision-specific local review.
7. Exercise one real Discord-driven frontend task, a feedback-driven revision and human review.
8. Package the cloneable source, setup instructions, demo and actual verification evidence.

Do not add another integration service when a concrete local issue arises. Diagnose and fix the smallest demonstrated problem. Ask only for genuinely missing local access, paths or necessary decisions.

## 18. Acceptance criteria

### Automated acceptance

- Fresh install from the committed lockfile succeeds.
- Build/typecheck/lint and focused tests pass.
- Ordinary CLI/backend startup does not invoke tsx or require experimental TypeScript flags.
- Two different repository configurations load without application code changes.
- CLI task creation works while the dashboard/coordinator is running.
- Tasks, history and revisions survive restart; a second writer is rejected.
- Invalid configuration, path escapes, corrupt state and stale runtime metadata fail clearly without data loss.
- Repeated explicit request references do not duplicate a task; conflicting reuse fails.
- Worktree preparation preserves the primary checkout and enforces changed-file scope.
- Actual check failures/timeouts are persisted as failures/timeouts, never passes.
- Changed revision/criteria/checks/evidence invalidate review readiness and approval.
- No approval, merge or integration command is available to the agent's CLI.
- Secrets and local runtime metadata are absent from source archives and browser responses.

### Live acceptance on the user's Windows machine

1. Existing agent reads the new project and runs the new doctor.
2. Human submits a real frontend task through Discord.
3. Agent invokes the local CLI and reports a real saved task ID.
4. The same task appears in the running dashboard.
5. Agent implements the change in its recorded task worktree.
6. Required checks execute in that worktree and produce inspectable evidence.
7. Human inspects the local target preview and requests one concrete revision in Discord.
8. Agent records feedback, creates a new revision, reruns checks and reports it.
9. Human reviews and records approval for the current revision locally.
10. Human deliberately integrates the reviewed changes and demonstrates the resulting frontend.
11. Restart preserves the task, revision, feedback and verification history.

Passing mocked protocol tests is not a substitute for this acceptance. No direct protocol fixture is needed in the new architecture.

## 19. Demonstration scenario and submission

Use a small independent Next.js frontend. Recommended task: improve its mobile navigation while preserving the existing palette and adding keyboard accessibility. Human feedback can request a concrete spacing or accessible-label adjustment. Avoid inventing an unrelated large application to demonstrate the tool.

The submission must show:

- The original Discord request and agent interaction.
- The saved task and measurable criteria.
- Actual changes in the configured worktree.
- Real check results and their revision references.
- Human feedback and a subsequent revision.
- Local human review and deliberate final integration.
- The resulting usable frontend.

Provide a README, one setup guide, one demo guide, example project/task inputs and a verification report. Separate results observed in the build environment from results observed on the user's machine. Do not claim Windows, browser, accessibility or live Switch success when it was not exercised.

## 20. Completion and handoff

The coding deliverable is a clean V3 source project, not another patch chain. Keep this context file alongside it. A new user should configure a target repository, start Design Flow and use an existing Switch/Codex agent through the documented local CLI without setting up a new gateway, custom bot or API identity.

Completion means the required workflow is implemented, automated checks pass, and live acceptance is either demonstrated or clearly listed as pending with concrete next actions. Do not declare the hackathon project complete merely because scaffolding or unit tests pass.

**Immediate instruction for the implementation agent:** Read this entire file, inspect the available workspace, and build the defined MVP in one delivery phase. Preserve the scope and architecture above. Verify real behavior, report limitations honestly, and prioritize one complete human-and-agent frontend task over additional infrastructure.
