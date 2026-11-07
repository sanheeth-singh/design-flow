import path from "node:path";
import { cp, access, writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const destination = path.resolve(process.argv[2] || "../demo-frontend");
try {
  try {
    await access(destination);
    throw new Error(
      "Destination exists; refusing overwrite. Choose a new demo path.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await cp(path.resolve("examples/demo-template"), destination, {
    recursive: true,
    filter: (p) =>
      !p.includes("node_modules") &&
      !p.includes(".next") &&
      !p.endsWith(".tsbuildinfo"),
  });
  await exec("git", ["init", "-b", "main", destination]);
  console.log(
    "Created independent frontend at " +
      destination +
      ". Run npm ci there, then git add and commit with your Git identity.",
  );
  const cfg = JSON.parse(
    await readFile("config/projects.example.json", "utf8"),
  );
  cfg.projects[0].repositoryPath = path
    .relative(path.resolve("config"), destination)
    .split(path.sep)
    .join("/");
  try {
    await writeFile(
      "config/projects.local.json",
      JSON.stringify(cfg, null, 2),
      { flag: "wx" },
    );
    console.log("Created local project configuration.");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    console.log(
      "Existing local configuration preserved; configure the demo path manually.",
    );
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
