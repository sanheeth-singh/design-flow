# One repeatable demo

Finish setup and leave `npm start` running. The included `demo-frontend` must have a clean committed baseline. It intentionally starts with simple desktop navigation that needs a mobile solution.

## Human request in the existing Discord channel

Tag the existing agent with the following request (replace the label/source reference as appropriate):

> Read the V3 contract. Create and implement the task in requests/mobile-navigation.example.json for demo-frontend using the real flow CLI. I authorize dependency installation with npm ci in this task's isolated worktree and the configured typecheck, lint and build scripts. Preserve the primary checkout. Report the saved task ID before implementation, then the actual branch/revision, changed files and results. Do not approve or integrate changes.

The agent runs these from the tool directory, substituting the returned task ID:

```powershell
npm run --silent flow -- task create --project demo-frontend --input requests/mobile-navigation.example.json
npm run --silent flow -- task ready --task <task-id>
npm run --silent flow -- workspace prepare --task <task-id>
npm run --silent flow -- workspace install --task <task-id> --authorize dependency-install
npm run --silent flow -- status --task <task-id>
```

The human confirms the same saved task appears in the running dashboard. The agent inspects the actual recorded path, implements the assigned navigation change only there, and then runs:

```powershell
npm run --silent flow -- revision capture --task <task-id> --summary "Improve mobile navigation"
npm run --silent flow -- verify --task <task-id>
npm run --silent flow -- status --task <task-id>
```

Use the configured scripts; do not invent passed results. Typecheck/lint/build must execute in that worktree. If generated config files change during the first Next.js build, they are outside `src`/`public` and capture/readiness must fail. Fix the baseline/configuration deliberately as the operator, or start a new task; never widen scope from chat or silently stage them.

## Human preview and feedback

In a separate owner terminal, change to the reported worktree's frontend root and run `npm run dev -- --port 3001`. Open http://127.0.0.1:3001. Do not run it on the dashboard's port. Next.js dev can rewrite generated type declarations; inspect `git status` afterward. Do not silently capture generated files. Prefer `npm exec -- next start --hostname 127.0.0.1 --port 3001` against the checked production build when inspecting an exact immutable revision.

Inspect at 375px and desktop widths, Tab/Shift+Tab, Escape, visible focus, expanded state, and the preserved palette. Send one concrete change in Discord, for example “Make every mobile navigation link target at least 44px tall.” The agent records the real feedback in a JSON file like requests/feedback.example.json with the current revision number, then:

```powershell
npm run --silent flow -- feedback add --task <task-id> --input <feedback-file>
```

The agent edits only the worktree, captures a second numbered revision with a clear summary, reruns verify and reports the actual commit/results. The human previews the new build again.

## Local human decision and final integration

Open the task's Review tab in the local dashboard. Read the criteria, revision comparison, logs, feedback and stale notices. Enter your label and concrete preview/keyboard observations. Approve the exact current revision only when evidence is current. A local label is a claim, not proof of Discord identity. The agent must not submit this action.

The human separately checks the target base and existing work, then chooses how to integrate the reviewed branch. For a clean unchanged `main`, the human may inspect and use `git merge --ff-only design-flow/<task-id>` from the primary repository after checking that the branch tip equals the approved commit. These are human instructions, not an automated CLI command. If the base advanced or the checkout is dirty, inspect first; Design Flow does not reset/rebase/merge it for you. The task stays approved, never falsely marked integrated.

Stop/restart Design Flow and demonstrate that the task, both revisions, feedback and logs remain. Keep the original Discord request, real CLI output, task view, check evidence, human observations and deliberately integrated result for the submission. Do not publish `.flow` or runtime metadata; select/redact evidence intentionally.

## Evidence checklist

Record each observation as actually passed, failed or pending: agent doctor under Windows managed account; Discord request; real saved ID visible on dashboard; worktree edits; required checks; human preview; Discord feedback; second revision/checks; local human approval; deliberate integration; restart history. Automated fixtures and scripted build-environment demonstrations do not substitute for this live walkthrough.
