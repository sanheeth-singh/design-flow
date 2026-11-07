import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { Store } from "../dist/apps/coordinator/src/storage/index.js";
import { Engine } from "../dist/apps/coordinator/src/tasks/index.js";
import { loadProjects } from "../dist/apps/coordinator/src/config/index.js";
import { request } from "../dist/packages/core/src/client.js";
const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const put = (p, v) =>
  writeFile(p, typeof v === "string" ? v : JSON.stringify(v));
async function fixture(checks) {
  const dir = await mkdtemp(path.join(tmpdir(), "design flow "));
  const repo = path.join(dir, "frontend");
  await mkdir(path.join(repo, "src"), { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.name", "Test Operator");
  git(repo, "config", "user.email", "test@example.invalid");
  await put(path.join(repo, "src/page.tsx"), 'export const title="Before";\n');
  await put(path.join(repo, ".gitignore"), "node_modules/\n.next/\n");
  await put(path.join(repo, "package.json"), {
    name: "fixture",
    dependencies: { next: "16.4.5", react: "19.3.1", tailwindcss: "4.3.5" },
    devDependencies: { typescript: "5.9.3" },
    scripts: {
      pass: 'node -e "console.log(123)"',
      fail: 'node -e "process.exit(7)"',
      timeout: 'node -e "setTimeout(()=>{},20000)"',
      mutate:
        "node -e \"require('fs').appendFileSync('src/page.tsx','changed')\"",
    },
  });
  git(repo, "add", ".");
  git(repo, "commit", "-m", "Initial frontend");
  const config = path.join(dir, "projects.json");
  const p = {
    id: "demo",
    name: "Fixture frontend",
    repositoryPath: "./frontend",
    frontendRoot: ".",
    baseBranch: "main",
    allowedPaths: ["src"],
    deniedPaths: [".git"],
    designRules: ["Preserve palette"],
    checks: checks || [
      {
        id: "pass",
        runner: "npm",
        script: "pass",
        required: true,
        timeoutMs: 10000,
      },
    ],
  };
  await put(config, { schemaVersion: 1, projects: [p] });
  const store = new Store(path.join(dir, "state"));
  await store.acquire();
  return {
    dir,
    repo,
    config,
    p,
    store,
    engine: new Engine(store, config, path.join(dir, "worktrees")),
  };
}
async function create(f, extra = {}) {
  return f.engine.action(
    "task.create",
    {
      projectId: "demo",
      input: {
        title: "Improve navigation",
        brief: "Make it usable",
        criteria: ["Fits at 375px"],
        ...extra,
      },
    },
    "cli",
  );
}
async function prepared(f) {
  const t = await create(f);
  await f.engine.action("task.ready", { taskId: t.id }, "cli");
  return f.engine.action("workspace.prepare", { taskId: t.id }, "cli");
}
async function captured(f) {
  const t = await prepared(f);
  await put(
    path.join(t.workspace.path, "src/page.tsx"),
    'export const title="After";\n',
  );
  await f.engine.action(
    "revision.capture",
    { taskId: t.id, summary: "Improve navigation" },
    "cli",
  );
  return f.store.state.tasks[0];
}
test("real two-revision workflow preserves primary checkout, evidence, feedback, decisions and restart", async () => {
  const f = await fixture();
  try {
    await put(path.join(f.repo, "src/page.tsx"), "owner uncommitted work\n");
    let t = await captured(f);
    assert.equal(
      await readFile(path.join(f.repo, "src/page.tsx"), "utf8"),
      "owner uncommitted work\n",
    );
    assert.equal(git(f.repo, "branch", "--show-current"), "main");
    await f.engine.action("verify", { taskId: t.id }, "cli");
    t = f.store.state.tasks[0];
    assert.equal(t.status, "in_review");
    assert.equal(t.checks[0].exitCode, 0);
    assert.equal(t.checks[0].outcome, "passed");
    assert.match(t.checks[0].log, /123/);
    await assert.rejects(
      f.engine.action(
        "review.decide",
        {
          taskId: t.id,
          decision: "approved",
          revision: 1,
          evidenceFingerprint: (await f.engine.view(t.id)).readiness
            .fingerprint,
          observations: "test observation",
          authorLabel: "test harness",
        },
        "cli",
      ),
      /dashboard/,
    );
    await f.engine.action(
      "review.decide",
      {
        taskId: t.id,
        decision: "approved",
        revision: 1,
        evidenceFingerprint: (await f.engine.view(t.id)).readiness.fingerprint,
        observations:
          "Harness exercises local decision endpoint; no human visual acceptance claimed",
        authorLabel: "test harness",
      },
      "dashboard",
    );
    assert.equal((await f.engine.view(t.id)).readiness.ready, true);
    await f.engine.action(
      "feedback.add",
      {
        taskId: t.id,
        input: {
          revision: 1,
          message: "Increase spacing",
          authorLabel: "fixture reviewer",
        },
      },
      "cli",
    );
    await put(
      path.join(t.workspace.path, "src/page.tsx"),
      'export const title="After with spacing";\n',
    );
    await f.engine.action(
      "revision.capture",
      { taskId: t.id, summary: "Increase spacing" },
      "cli",
    );
    assert.equal((await f.engine.view(t.id)).readiness.ready, false);
    await f.engine.action("verify", { taskId: t.id }, "cli");
    await f.engine.action(
      "review.decide",
      {
        taskId: t.id,
        decision: "approved",
        revision: 2,
        evidenceFingerprint: (await f.engine.view(t.id)).readiness.fingerprint,
        observations: "Harness records revision specific evidence only",
        authorLabel: "test harness",
      },
      "dashboard",
    );
    const saved = JSON.stringify(f.store.state);
    await f.store.close();
    const restored = new Store(f.store.dir);
    await restored.acquire();
    assert.deepEqual(restored.state, JSON.parse(saved));
    assert.equal(restored.state.tasks[0].revisions.length, 2);
    assert.equal(restored.state.tasks[0].feedback.length, 1);
    await restored.close();
  } finally {
    await f.store.close();
  }
});
test("request idempotency and conflicting reuse; no reference creates new tasks", async () => {
  const f = await fixture();
  try {
    const a = await create(f, { requestReference: "discord:123" });
    const b = await create(f, { requestReference: "discord:123" });
    assert.equal(a.id, b.id);
    await assert.rejects(
      create(f, { requestReference: "discord:123", title: "Different" }),
      /Conflicting/,
    );
    await create(f);
    await create(f);
    assert.equal(f.store.state.tasks.length, 3);
  } finally {
    await f.store.close();
  }
});
test("exclusive writer and corrupt store preservation", async () => {
  const f = await fixture();
  try {
    const second = new Store(f.store.dir);
    await assert.rejects(second.acquire(), /Writer lock/);
    await second.close();
    await assert.rejects(new Store(f.store.dir).acquire(), /Writer lock/);
  } finally {
    await f.store.close();
  }
  await put(path.join(f.store.dir, "state.json"), "broken bytes");
  await assert.rejects(new Store(f.store.dir).acquire(), /corrupt/);
  assert.equal(
    await readFile(path.join(f.store.dir, "state.json"), "utf8"),
    "broken bytes",
  );
});
test("two independent configurations, traversal and symlink rejection", async () => {
  const f = await fixture();
  try {
    const second = await fixture();
    await second.store.close();
    await put(f.config, {
      schemaVersion: 1,
      projects: [
        f.p,
        { ...second.p, id: "other", repositoryPath: second.repo },
      ],
    });
    assert.equal((await loadProjects(f.config)).length, 2);
    await put(f.config, {
      schemaVersion: 1,
      projects: [{ ...f.p, frontendRoot: "../outside" }],
    });
    await assert.rejects(loadProjects(f.config), /Unsafe/);
    await symlink(f.dir, path.join(f.repo, "escape"), "dir");
    await put(f.config, {
      schemaVersion: 1,
      projects: [{ ...f.p, allowedPaths: ["escape"] }],
    });
    await assert.rejects(loadProjects(f.config), /Symlink/);
    await put(f.config, {
      schemaVersion: 1,
      projects: [{ ...f.p, allowedPaths: [".github"] }],
    });
    await assert.rejects(loadProjects(f.config), /Protected/);
  } finally {
    await f.store.close();
  }
});
test("out-of-scope untracked, staged, deleted files and symlinks block capture", async () => {
  for (const kind of ["untracked", "staged", "deleted", "symlink"]) {
    const f = await fixture();
    try {
      const t = await prepared(f);
      await put(path.join(t.workspace.path, "src/page.tsx"), "changed");
      if (kind === "symlink")
        await symlink(f.dir, path.join(t.workspace.path, "src/escape"), "dir");
      else if (kind === "deleted") git(t.workspace.path, "rm", "package.json");
      else {
        await put(path.join(t.workspace.path, "secrets.txt"), "leave alone");
        if (kind === "staged") git(t.workspace.path, "add", "secrets.txt");
      }
      await assert.rejects(
        f.engine.action(
          "revision.capture",
          { taskId: t.id, summary: "No" },
          "cli",
        ),
        /Out-of-scope|Symlink/,
      );
      assert.equal(f.store.state.tasks[0].revisions.length, 0);
    } finally {
      await f.store.close();
    }
  }
});
test("failed and timed out actual npm scripts never become ready", async () => {
  const f = await fixture([
    {
      id: "fail",
      runner: "npm",
      script: "fail",
      required: true,
      timeoutMs: 5000,
    },
    {
      id: "timeout",
      runner: "npm",
      script: "timeout",
      required: true,
      timeoutMs: 200,
    },
  ]);
  try {
    const t = await captured(f);
    await f.engine.action("verify", { taskId: t.id }, "cli");
    const checks = f.store.state.tasks[0].checks;
    assert.equal(checks[0].outcome, "failed");
    assert.equal(checks[0].exitCode, 7);
    assert.equal(checks[1].outcome, "timed_out");
    assert.equal((await f.engine.view(t.id)).readiness.ready, false);
  } finally {
    await f.store.close();
  }
});
test("configuration, criteria, code, base and new evidence invalidate previous approval", async () => {
  for (const kind of [
    "configuration",
    "criteria",
    "code",
    "base",
    "evidence",
  ]) {
    const f = await fixture();
    try {
      const t = await captured(f);
      await f.engine.action("verify", { taskId: t.id }, "cli");
      await f.engine.action(
        "review.decide",
        {
          taskId: t.id,
          revision: 1,
          decision: "approved",
          evidenceFingerprint: (await f.engine.view(t.id)).readiness
            .fingerprint,
          observations: "harness only",
          authorLabel: "harness",
        },
        "dashboard",
      );
      if (kind === "configuration")
        await put(f.config, {
          schemaVersion: 1,
          projects: [{ ...f.p, designRules: ["Changed"] }],
        });
      if (kind === "criteria")
        await f.engine.action(
          "task.criteria",
          { taskId: t.id, criteria: ["New criterion"] },
          "cli",
        );
      if (kind === "code")
        await put(path.join(t.workspace.path, "src/page.tsx"), "dirty");
      if (kind === "base") {
        await put(path.join(f.repo, "src/page.tsx"), "new primary base");
        git(f.repo, "add", "src/page.tsx");
        git(f.repo, "commit", "-m", "Advance base");
      }
      if (kind === "evidence")
        await f.store.transaction((s) => {
          s.tasks[0].checks.push({
            ...s.tasks[0].checks[0],
            id: "failed-later-run",
            outcome: "failed",
            exitCode: 1,
          });
        });
      assert.equal((await f.engine.view(t.id)).readiness.ready, false, kind);
    } finally {
      await f.store.close();
    }
  }
});
test("a check which mutates source invalidates its evidence", async () => {
  const f = await fixture([
    {
      id: "mutate",
      runner: "npm",
      script: "mutate",
      required: true,
      timeoutMs: 10000,
    },
  ]);
  try {
    const t = await captured(f);
    await f.engine.action("verify", { taskId: t.id }, "cli");
    assert.equal((await f.engine.view(t.id)).readiness.ready, false);
  } finally {
    await f.store.close();
  }
});
test("single executing task and invalid transitions", async () => {
  const f = await fixture();
  try {
    await prepared(f);
    const second = await create(f);
    await assert.rejects(
      f.engine.action(
        "revision.capture",
        { taskId: second.id, summary: "no" },
        "cli",
      ),
      /state/,
    );
    await f.engine.action("task.ready", { taskId: second.id }, "cli");
    await assert.rejects(
      f.engine.action("workspace.prepare", { taskId: second.id }, "cli"),
      /Only one/,
    );
  } finally {
    await f.store.close();
  }
});
test("compiled service and CLI persist tasks while running, reject second writer, and detect stale metadata", async () => {
  const f = await fixture();
  await f.store.close();
  const stateDir = path.join(f.dir, "live-state");
  const env = {
    ...process.env,
    FLOW_CONFIG: f.config,
    FLOW_STATE: stateDir,
    FLOW_WORKTREES: path.join(f.dir, "live-worktrees"),
    FLOW_COORDINATOR_PORT: "14310",
  };
  const main = path.resolve("dist/apps/coordinator/src/main.js");
  let output = "";
  function launch() {
    const c = spawn(process.execPath, [main], {
      env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    c.stdout.on("data", (v) => (output += v));
    c.stderr.on("data", (v) => (output += v));

    return c;
  }
  async function ready() {
    for (let i = 0; i < 80; i++) {
      try {
        await request("/doctor", undefined, "cli", stateDir);
        return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(output);
  }
  async function stop(c) {
    if (c.exitCode !== null || c.signalCode !== null) return;

    const exited = new Promise((resolve) => {
      c.once("exit", resolve);
    });

    c.send("shutdown");

    await exited;
  }
  let c = launch();
  try {
    await ready();
    const input = path.join(f.dir, "request.json");
    await put(input, {
      title: "CLI real task",
      brief: "Persist through HTTP service",
      criteria: ["Exists after restart"],
    });
    const cli = spawn(
      process.execPath,
      [
        path.resolve("dist/packages/cli/src/main.js"),
        "task",
        "create",
        "--project",
        "demo",
        "--input",
        input,
      ],
      { env },
    );
    let stdout = "";
    cli.stdout.on("data", (v) => (stdout += v));
    assert.equal(await new Promise((r) => cli.once("exit", r)), 0);
    const t = JSON.parse(stdout);
    assert.ok(t.id);
    assert.equal(
      (await request("/tasks", undefined, "cli", stateDir)).tasks.length,
      1,
    );
    const metadata = JSON.parse(
      await readFile(path.join(stateDir, "runtime.json"), "utf8"),
    );
    assert.equal((await fetch(metadata.url + "/tasks")).status, 401);
    assert.ok(
      !JSON.stringify(
        await request("/tasks", undefined, "cli", stateDir),
      ).includes(metadata.token),
    );
    const second = launch();
    assert.equal(await new Promise((r) => second.once("exit", r)), 1);
    await stop(c);
    c = launch();
    await ready();
    assert.equal(
      (await request("/tasks", undefined, "cli", stateDir)).tasks[0].id,
      t.id,
    );
    await stop(c);
    await put(path.join(stateDir, "runtime.json"), metadata);
    await assert.rejects(
      request("/tasks", undefined, "cli", stateDir),
      /Stale/,
    );
  } finally {
    await stop(c);
  }
});

test("review rejects an old dashboard evidence set after checks rerun", async () => {
  const f = await fixture();
  try {
    const t = await captured(f);
    await f.engine.action("verify", { taskId: t.id }, "cli");
    const old = (await f.engine.view(t.id)).readiness.fingerprint;
    await f.engine.action("verify", { taskId: t.id }, "cli");
    await assert.rejects(
      f.engine.action(
        "review.decide",
        {
          taskId: t.id,
          revision: 1,
          decision: "approved",
          evidenceFingerprint: old,
          observations: "Old screen",
          authorLabel: "harness",
        },
        "dashboard",
      ),
      /evidence changed/,
    );
    const current = await f.engine.view(t.id);
    await f.engine.action(
      "review.decide",
      {
        taskId: t.id,
        revision: 1,
        decision: "approved",
        evidenceFingerprint: current.readiness.fingerprint,
        observations: "Harness fresh snapshot",
        authorLabel: "harness",
      },
      "dashboard",
    );
    assert.equal(f.store.state.tasks[0].status, "approved");
    assert.deepEqual(f.store.state.tasks[0].revisions[0].criteria, [
      "Fits at 375px",
    ]);
  } finally {
    await f.store.close();
  }
});

test("unknown and approval CLI commands fail without starting another writer", async () => {
  for (const command of ["approve", "merge", "task approve", "integrate"]) {
    const p = spawn(process.execPath, [
      path.resolve("dist/packages/cli/src/main.js"),
      ...command.split(" "),
    ]);
    let err = "";
    p.stderr.on("data", (s) => (err += s));
    assert.equal(await new Promise((r) => p.once("exit", r)), 1);
    assert.match(err, /Unknown command/);
  }
});

test("occupied coordinator port fails and releases only its own lock", async () => {
  const { createServer } = await import("node:net");
  const f = await fixture();
  await f.store.close();
  const blocker = createServer();
  await new Promise((r) => blocker.listen(0, "127.0.0.1", r));
  const dir = path.join(f.dir, "conflicted-state");
  try {
    const child = spawn(
      process.execPath,
      [path.resolve("dist/apps/coordinator/src/main.js")],
      {
        env: {
          ...process.env,
          FLOW_CONFIG: f.config,
          FLOW_STATE: dir,
          FLOW_COORDINATOR_PORT: String(blocker.address().port),
        },
      },
    );
    let err = "";
    child.stderr.on("data", (s) => (err += s));
    assert.equal(await new Promise((r) => child.once("exit", r)), 1);
    assert.match(err, /EADDRINUSE|address already in use/);
    await assert.rejects(
      readFile(path.join(dir, "writer.lock")),
      (e) => e.code === "ENOENT",
    );
  } finally {
    await new Promise((r) => blocker.close(r));
  }
});
