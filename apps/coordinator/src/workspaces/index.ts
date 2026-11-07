import path from "node:path";
import { mkdir, realpath, access } from "node:fs/promises";
import type { Project, Task } from "../../../../packages/core/src/model.js";
import { git, within, noSymlinks, permitted } from "../config/index.js";
export async function prepare(p: Project, t: Task, workRoot: string) {
  await mkdir(workRoot, { recursive: true });
  const parent = await realpath(workRoot);
  if (within(p.repositoryPath, parent))
    throw new Error("Worktrees must be outside the primary repository");
  const target = path.join(parent, t.id);
  try {
    await access(target);
    throw new Error(
      "Workspace already exists. Inspect it before retrying; no automatic deletion.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const baseCommit = await git(
    p.repositoryPath,
    "rev-parse",
    "refs/heads/" + p.baseBranch + "^{commit}",
  );
  const branch = "design-flow/" + t.id;
  await git(
    p.repositoryPath,
    "worktree",
    "add",
    "-b",
    branch,
    target,
    baseCommit,
  );
  return {
    branch,
    path: target,
    baseCommit,
    repositoryPath: p.repositoryPath,
    preparationState: "prepared" as const,
  };
}
export async function assertWorkspace(p: Project, t: Task) {
  if (!t.workspace) throw new Error("Task workspace is not prepared");
  const w = t.workspace;
  await noSymlinks(path.dirname(w.path), path.basename(w.path));
  if (p.repositoryPath !== w.repositoryPath)
    throw new Error("Configured repository identity changed");
  if (
    (await realpath(await git(w.path, "rev-parse", "--show-toplevel"))) !==
    (await realpath(w.path))
  )
    throw new Error("Workspace Git root changed");
  if ((await git(w.path, "branch", "--show-current")) !== w.branch)
    throw new Error("Workspace branch changed");
  if (
    (await realpath(
      await git(
        w.path,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ),
    )) !==
    (await realpath(
      await git(
        p.repositoryPath,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ),
    ))
  )
    throw new Error("Workspace repository changed");
  await git(w.path, "merge-base", "--is-ancestor", w.baseCommit, "HEAD");
  return w;
}
const split = (s: string) => s.split("\0").filter(Boolean);
export async function dirty(root: string) {
  return [
    ...new Set([
      ...split(
        await git(
          root,
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          "HEAD",
          "--",
        ),
      ),
      ...split(
        await git(root, "ls-files", "--others", "--exclude-standard", "-z"),
      ),
    ]),
  ];
}
export async function scope(p: Project, t: Task) {
  const w = await assertWorkspace(p, t);
  const all = [
    ...new Set([
      ...(await dirty(w.path)),
      ...split(
        await git(
          w.path,
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          w.baseCommit,
          "HEAD",
          "--",
        ),
      ),
    ]),
  ];
  for (const f of all) {
    if (!permitted(p, f)) throw new Error("Out-of-scope change: " + f);
    await noSymlinks(w.path, f);
  }
  return all;
}
export async function matching(p: Project, t: Task, commit: string) {
  const w = await assertWorkspace(p, t);
  await scope(p, t);
  if (
    (await git(w.path, "rev-parse", "HEAD")) !== commit ||
    (await dirty(w.path)).length
  )
    throw new Error(
      "Worktree no longer matches the captured revision. Capture a new revision.",
    );
}
