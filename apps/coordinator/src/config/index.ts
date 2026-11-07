import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  ConfigSchema,
  type Project,
} from "../../../../packages/core/src/model.js";
const exec = promisify(execFile);
export const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const within = (root: string, p: string) => {
  const rel = path.relative(root, p);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
};
export async function git(cwd: string, ...args: string[]) {
  try {
    return (
      await exec("git", args, {
        cwd,
        maxBuffer: 8 * 1024 * 1024,
        encoding: "utf8",
      })
    ).stdout.trimEnd();
  } catch (e) {
    throw new Error("Git failed: " + (e as { stderr?: string }).stderr);
  }
}
export function relative(p: string) {
  if (
    path.isAbsolute(p) ||
    /^[a-zA-Z]:/.test(p) ||
    p.includes("\\") ||
    p.split("/").includes("..") ||
    p.startsWith("-")
  )
    throw new Error("Unsafe relative path: " + p);
  return p.replace(/\/$/, "");
}
export function protectedPath(p: string) {
  return p
    .toLowerCase()
    .split("/")
    .some(
      (s) =>
        [
          ".git",
          ".github",
          "node_modules",
          ".next",
          "dist",
          "build",
          "coverage",
        ].includes(s) ||
        s === ".env" ||
        s.startsWith(".env."),
    );
}
export async function noSymlinks(root: string, rel: string) {
  let current = root;
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error("Symlink paths are not permitted: " + rel);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") break;
      throw e;
    }
  }
}
export async function loadProjects(file: string) {
  const cfg = ConfigSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const ids = new Set<string>();
  const result: Project[] = [];
  for (const p of cfg.projects) {
    if (ids.has(p.id)) throw new Error("Duplicate project ID");
    ids.add(p.id);
    if (
      new Set(p.checks.map((c) => c.id)).size !== p.checks.length ||
      !p.checks.some((c) => c.required)
    )
      throw new Error("Checks need unique IDs and at least one required check");
    p.repositoryPath = await realpath(
      path.resolve(path.dirname(file), p.repositoryPath),
    );
    const root = await realpath(
      await git(p.repositoryPath, "rev-parse", "--show-toplevel"),
    );
    if (root !== p.repositoryPath)
      throw new Error("repositoryPath must be the Git root");
    relative(p.frontendRoot);
    await noSymlinks(root, p.frontendRoot);
    const front = await realpath(path.resolve(root, p.frontendRoot));
    if (!within(root, front))
      throw new Error("Frontend root escapes repository");
    await git(root, "check-ref-format", "--branch", p.baseBranch);
    await git(
      root,
      "rev-parse",
      "--verify",
      "refs/heads/" + p.baseBranch + "^{commit}",
    );
    for (const item of [...p.allowedPaths, ...p.deniedPaths]) {
      relative(item);
      if (!item || item === ".")
        throw new Error("Scope must name explicit subpaths");
      await noSymlinks(root, item);
    }
    if (p.allowedPaths.some(protectedPath))
      throw new Error("Protected allowed path");
    const pkg = JSON.parse(
      await readFile(path.join(front, "package.json"), "utf8"),
    );
    if (
      !pkg.dependencies?.next ||
      !pkg.dependencies?.react ||
      (!pkg.devDependencies?.typescript && !pkg.dependencies?.typescript) ||
      (!pkg.dependencies?.tailwindcss && !pkg.devDependencies?.tailwindcss)
    )
      throw new Error(
        "Target must declare Next.js, React, TypeScript and Tailwind",
      );
    for (const c of p.checks)
      if (typeof pkg.scripts?.[c.script] !== "string")
        throw new Error("Missing npm script: " + c.script);
    result.push(p);
  }
  return result;
}
export function permitted(p: Project, file: string) {
  relative(file);
  return (
    !protectedPath(file) &&
    p.allowedPaths.some((a) => file === a || file.startsWith(a + "/")) &&
    !p.deniedPaths.some((a) => file === a || file.startsWith(a + "/"))
  );
}
