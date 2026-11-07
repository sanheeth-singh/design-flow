import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  BriefSchema,
  FeedbackSchema,
  type Task,
  type State,
  type Project,
  type Revision,
} from "../../../../packages/core/src/model.js";
import { Store } from "../storage/index.js";
import { loadProjects, hash, git } from "../config/index.js";
import {
  prepare,
  scope,
  dirty,
  matching,
  assertWorkspace,
} from "../workspaces/index.js";
import { execute, npmEntry } from "../verification/index.js";
export const now = () => new Date().toISOString();
function event(t: Task, action: string, detail?: string) {
  t.updatedAt = now();
  t.history.push({
    action,
    actor: "local caller (claimed)",
    at: now(),
    revision: t.revisions.at(-1)?.number,
    detail,
  });
}
export class Engine {
  busy = false;
  constructor(
    readonly store: Store,
    readonly config: string,
    readonly workRoot: string,
  ) {}
  projects() {
    return loadProjects(this.config);
  }
  task(s: State, id: string) {
    const t = s.tasks.find((t) => t.id === id);
    if (!t) throw new Error("Task not found");
    return t;
  }
  async project(t: Task) {
    const p = (await this.projects()).find((p) => p.id === t.projectId);
    if (!p) throw new Error("Project no longer configured");
    return p;
  }
  async readiness(t: Task, p: Project) {
    const reasons: string[] = [];
    const r = t.revisions.at(-1);
    if (!r)
      return {
        ready: false,
        reasons: ["No captured revision"],
        evidence: [] as string[],
        fingerprint: "",
      };
    if (r.criteriaVersion !== t.criteriaVersion)
      reasons.push("Acceptance criteria changed");
    if (r.configHash !== hash(p))
      reasons.push("Project configuration or checks changed");
    try {
      await matching(p, t, r.commit);
    } catch (e) {
      reasons.push((e as Error).message);
    }
    if (
      t.workspace &&
      (await git(
        p.repositoryPath,
        "rev-parse",
        "refs/heads/" + p.baseBranch + "^{commit}",
      )) !== t.workspace.baseCommit
    )
      reasons.push(
        "Base branch moved; human must revalidate before integration",
      );
    const evidence: string[] = [];
    for (const c of p.checks) {
      const runs = t.checks.filter(
        (c) =>
          c.revision === r.number &&
          c.commit === r.commit &&
          c.configHash === hash(p) &&
          c.criteriaVersion === t.criteriaVersion,
      );
      const run = runs.filter((x) => x.checkId === c.id).at(-1);
      if (run) evidence.push(run.id);
      if (c.required && (run?.outcome !== "passed" || run.exitCode !== 0))
        reasons.push(c.id + ": " + (run?.outcome || "not_run"));
    }
    if (["changes_requested", "blocked", "cancelled"].includes(t.status))
      reasons.push("Task is " + t.status);
    const fingerprint = hash({
      commit: r.commit,
      revision: r.number,
      criteriaVersion: t.criteriaVersion,
      configHash: hash(p),
      checks: evidence.map((id) => t.checks.find((c) => c.id === id)),
    });
    const approval = t.reviews.at(-1);
    if (
      t.status === "approved" &&
      approval?.evidenceFingerprint !== fingerprint
    )
      reasons.push("Approved evidence changed");
    return { ready: !reasons.length, reasons, evidence, fingerprint };
  }
  async comparison(taskId: string, revisionNumber: number) {
    const t = this.task(this.store.state, taskId);
    const p = await this.project(t);
    await assertWorkspace(p, t);
    const r = t.revisions.find((r) => r.number === revisionNumber);
    if (!r) throw new Error("Unknown revision");
    const from =
      t.revisions.find((x) => x.number === revisionNumber - 1)?.commit ||
      r.baseCommit;
    return {
      from,
      to: r.commit,
      diff: (
        await git(
          t.workspace!.path,
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--no-renames",
          from,
          r.commit,
          "--",
          ...r.changedFiles,
        )
      ).slice(0, 200000),
    };
  }
  async view(id?: string) {
    const projects = await this.projects();
    const result = [];
    for (const t of this.store.state.tasks.filter((t) => !id || t.id === id)) {
      const p = projects.find((p) => p.id === t.projectId);
      let readiness;
      try {
        readiness = p
          ? await this.readiness(t, p)
          : { ready: false, reasons: ["Project removed"], evidence: [] };
      } catch (e) {
        readiness = {
          ready: false,
          reasons: [(e as Error).message],
          evidence: [],
        };
      }
      const stale =
        ["approved", "in_review"].includes(t.status) && !readiness.ready;
      result.push({
        ...t,
        effectiveStatus: stale ? "stale_evidence" : t.status,
        readiness,
      });
    }
    if (id && !result.length) throw new Error("Task not found");
    return id
      ? result[0]
      : {
          projects,
          tasks: result,
          service: { connected: true, executionActive: this.busy },
        };
  }
  async doctor() {
    const projects = await this.projects();
    return {
      service: "connected",
      node: process.version,
      git: await git(process.cwd(), "--version"),
      npmEntry: npmEntry(),
      projects: await Promise.all(
        projects.map(async (p) => ({
          id: p.id,
          repositoryPath: p.repositoryPath,
          baseCommit: await git(
            p.repositoryPath,
            "rev-parse",
            "refs/heads/" + p.baseBranch + "^{commit}",
          ),
          scope: p.allowedPaths,
          configuration: "validated",
          capabilities: {
            worktreeWrite: "untested by doctor",
            dependencyInstall: "untested by doctor",
            checks: "untested by doctor",
            switch: "not inspected; external existing session",
          },
        })),
      ),
    };
  }
  async action(command: string, b: any, client: string) {
    if (this.busy)
      throw new Error(
        "Coordinator is executing an operation; retry after it finishes",
      );
    this.busy = true;
    try {
      return await this.perform(command, b, client);
    } finally {
      this.busy = false;
    }
  }
  async perform(command: string, b: any, client: string) {
    if (command === "verify" || command === "workspace.install") {
      return this.run(command, b);
    }
    return this.store.transaction(async (s) => {
      if (command === "task.create") {
        const input = BriefSchema.parse(b.input);
        const p = (await this.projects()).find((p) => p.id === b.projectId);
        if (!p) throw new Error("Unknown project");
        if (input.requestReference) {
          const old = s.tasks.find(
            (t) =>
              t.projectId === p.id &&
              t.input.requestReference === input.requestReference,
          );
          if (old) {
            if (hash(old.input) !== hash(input))
              throw new Error("Conflicting request reference");
            return old;
          }
        }
        const t: Task = {
          id: randomUUID(),
          projectId: p.id,
          input,
          criteriaVersion: 1,
          status: "draft",
          createdAt: now(),
          updatedAt: now(),
          revisions: [],
          checks: [],
          feedback: [],
          reviews: [],
          history: [],
        };
        event(t, "created");
        s.tasks.push(t);
        return t;
      }
      const t = this.task(s, z.string().uuid().parse(b.taskId));
      const p = await this.project(t);
      if (
        t.workspace &&
        [
          "revision.capture",
          "task.criteria",
          "task.resume",
          "feedback.add",
          "review.decide",
        ].includes(command) &&
        s.tasks.some(
          (x) =>
            x.id !== t.id &&
            [
              "implementing",
              "verifying",
              "changes_requested",
              "in_review",
            ].includes(x.status),
        )
      )
        throw new Error("Another task is active; finish or block it first");
      if (command === "task.ready") {
        if (t.status !== "draft")
          throw new Error("Only a draft can become ready");
        t.status = "ready";
        event(t, "ready");
      } else if (command === "task.criteria") {
        if (["verifying", "cancelled"].includes(t.status))
          throw new Error("Cannot change criteria in this state");
        const previousCriteria = [...t.input.criteria];
        t.input.criteria = BriefSchema.shape.criteria.parse(b.criteria);
        t.criteriaVersion++;
        t.status = t.workspace ? "implementing" : "draft";
        event(
          t,
          "criteria_changed",
          JSON.stringify({ previousCriteria, criteria: t.input.criteria }),
        );
      } else if (command === "task.cancel" || command === "task.block") {
        if (t.status === "cancelled") throw new Error("Task is cancelled");
        t.reason = z.string().min(1).parse(b.reason);
        t.status = command === "task.cancel" ? "cancelled" : "blocked";
        event(t, t.status, t.reason);
      } else if (command === "task.resume") {
        if (t.status !== "blocked")
          throw new Error("Only a blocked task can resume");
        t.status = t.workspace ? "implementing" : "ready";
        event(t, "resumed");
      } else if (command === "workspace.prepare") {
        if (t.workspace) throw new Error("Workspace already recorded");
        if (t.status !== "ready") throw new Error("Task must be ready");
        if (
          s.tasks.some(
            (x) =>
              x.id !== t.id &&
              [
                "implementing",
                "verifying",
                "changes_requested",
                "in_review",
              ].includes(x.status),
          )
        )
          throw new Error("Only one executing/review task is supported");
        t.workspace = await prepare(p, t, this.workRoot);
        t.status = "implementing";
        event(t, "workspace_prepared");
      } else if (command === "revision.capture") {
        if (
          ![
            "implementing",
            "changes_requested",
            "in_review",
            "approved",
          ].includes(t.status)
        )
          throw new Error("Task cannot capture a revision in this state");
        const summary = z.string().min(1).max(4000).parse(b.summary);
        const files = await scope(p, t);
        if (!files.length)
          throw new Error("No authorized changes against task base");
        const w = t.workspace!;
        if (t.revisions.length)
          await git(
            w.path,
            "merge-base",
            "--is-ancestor",
            t.revisions.at(-1)!.commit,
            "HEAD",
          );
        const changes = await dirty(w.path);
        if (changes.length) {
          await git(w.path, "add", "--", ...changes);
          await git(w.path, "commit", "-m", summary);
        }
        const commit = await git(w.path, "rev-parse", "HEAD");
        if (
          t.revisions.at(-1)?.commit === commit &&
          t.revisions.at(-1)?.criteriaVersion === t.criteriaVersion &&
          t.revisions.at(-1)?.configHash === hash(p)
        )
          throw new Error("No new revision content or criteria/configuration");
        const r: Revision = {
          number: t.revisions.length + 1,
          commit,
          baseCommit: w.baseCommit,
          changedFiles: files,
          criteria: [...t.input.criteria],
          projectSnapshot: structuredClone(p),
          criteriaVersion: t.criteriaVersion,
          configHash: hash(p),
          summary,
          createdAt: now(),
        };
        t.revisions.push(r);
        t.status = "implementing";
        event(t, "revision_captured");
      } else if (command === "feedback.add") {
        if (
          ["draft", "ready", "cancelled", "blocked", "verifying"].includes(
            t.status,
          )
        )
          throw new Error("Feedback requires an active revision");
        const f = FeedbackSchema.parse(b.input);
        if (f.revision !== t.revisions.at(-1)?.number)
          throw new Error("Feedback must reference the current revision");
        t.feedback.push({ ...f, at: now() });
        t.status = "changes_requested";
        event(t, "feedback_added", f.message);
      } else if (command === "review.decide") {
        if (client !== "dashboard")
          throw new Error(
            "Review is a local dashboard action; unavailable through the CLI",
          );
        if (!["in_review", "approved", "changes_requested"].includes(t.status))
          throw new Error("Task is not in review");
        const decision = z
          .enum(["approved", "changes_requested"])
          .parse(b.decision);
        const observations = z.string().min(1).max(10000).parse(b.observations);
        const authorLabel = z.string().min(1).max(100).parse(b.authorLabel);
        const revision = z.number().int().parse(b.revision);
        if (revision !== t.revisions.at(-1)?.number)
          throw new Error("Review revision is stale");
        const ready = await this.readiness(t, p);
        if (b.evidenceFingerprint !== ready.fingerprint)
          throw new Error(
            "Dashboard evidence changed; refresh and inspect the current revision before deciding",
          );
        if (decision === "approved" && !ready.ready)
          throw new Error("Review is stale: " + ready.reasons.join("; "));
        t.reviews.push({
          revision,
          criteriaVersion: t.criteriaVersion,
          configHash: hash(p),
          evidence: ready.evidence,
          evidenceFingerprint: ready.fingerprint,
          decision,
          observations,
          authorLabel,
          at: now(),
        });
        t.status = decision;
        if (decision === "changes_requested")
          t.feedback.push({
            revision,
            authorLabel,
            message: observations,
            at: now(),
          });
        event(t, "local_review_" + decision, observations);
      } else throw new Error("Unknown command");
      return t;
    });
  }
  async run(command: string, b: any) {
    const t = structuredClone(
      this.task(this.store.state, z.string().uuid().parse(b.taskId)),
    );
    const p = await this.project(t);
    if (
      this.store.state.tasks.some(
        (x) =>
          x.id !== t.id &&
          [
            "implementing",
            "verifying",
            "changes_requested",
            "in_review",
          ].includes(x.status),
      )
    )
      throw new Error("Another task is active");
    const w = await assertWorkspace(p, t);
    if (command === "workspace.install") {
      if (
        !["implementing", "changes_requested"].includes(t.status) ||
        b.authorized !== true
      )
        throw new Error(
          "Dependency installation requires explicit operator authorization in an implementing worktree",
        );
      const result = await execute(
        path.resolve(w.path, p.frontendRoot),
        ["ci", "--no-audit", "--no-fund"],
        300000,
      );
      return this.store.transaction((s) => {
        const target = this.task(s, t.id);
        event(target, "dependencies_install_" + result.outcome, result.log);
        if (result.outcome === "passed")
          target.workspace!.preparationState = "dependencies_installed";
        return result;
      });
    }
    const r = t.revisions.at(-1);
    if (!r || !["implementing", "in_review", "approved"].includes(t.status))
      throw new Error("Capture the current revision before verification");
    await matching(p, t, r.commit);
    if (hash(p) !== r.configHash || t.criteriaVersion !== r.criteriaVersion)
      throw new Error("Configuration/criteria changed; capture a new revision");
    await this.store.transaction((s) => {
      const task = this.task(s, t.id);
      task.status = "verifying";
      event(task, "verification_started");
    });
    try {
      for (const c of p.checks) {
        await matching(p, t, r.commit);
        const startedAt = now();
        let result;
        try {
          result = await execute(
            path.resolve(w.path, p.frontendRoot),
            ["run", c.script],
            c.timeoutMs,
          );
        } catch (e) {
          result = {
            outcome: "error" as const,
            exitCode: null,
            log: (e as Error).message,
          };
        }
        const id = randomUUID();
        const logReference = "logs/" + id + ".log";
        await mkdir(path.join(this.store.dir, "logs"), {
          recursive: true,
          mode: 0o700,
        });
        await writeFile(path.join(this.store.dir, logReference), result.log, {
          mode: 0o600,
        });
        await this.store.transaction((s) => {
          const task = this.task(s, t.id);
          task.checks.push({
            id,
            revision: r.number,
            commit: r.commit,
            configHash: hash(p),
            criteriaVersion: t.criteriaVersion,
            checkId: c.id,
            runner: "node " + npmEntry(),
            script: c.script,
            startedAt,
            endedAt: now(),
            ...result,
            logReference,
          });
          event(task, "check_" + result.outcome, c.id);
        });
      }
      const current = this.task(this.store.state, t.id);
      const ready = await this.readiness(current, await this.project(current));
      return await this.store.transaction((s) => {
        const task = this.task(s, t.id);
        task.status = ready.ready ? "in_review" : "implementing";
        event(task, "verification_finished", ready.reasons.join("; "));
        return { task, readiness: ready };
      });
    } catch (e) {
      await this.store.transaction((s) => {
        const task = this.task(s, t.id);
        task.status = "blocked";
        task.reason = "Verification interrupted: " + (e as Error).message;
        event(task, "verification_error", task.reason);
      });
      throw e;
    }
  }
}
