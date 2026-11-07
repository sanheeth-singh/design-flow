import { readFile } from "node:fs/promises";
import { request } from "../../core/src/client.js";
const args = process.argv.slice(2);
const flags: Record<string, string> = {};
const words: string[] = [];
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (
        flags[key] !== undefined ||
        !args[i + 1] ||
        args[i + 1].startsWith("--")
      )
        throw new Error("Invalid or repeated option " + args[i]);
      flags[key] = args[++i];
    } else words.push(args[i]);
  }
  const cmd = words.join(" ");
  const contract: Record<string, string[]> = {
    doctor: [],
    status: ["task"],
    "task create": ["project", "input"],
    "task ready": ["task"],
    "task criteria": ["task", "input"],
    "task block": ["task", "reason"],
    "task resume": ["task"],
    "task cancel": ["task", "reason"],
    "workspace prepare": ["task"],
    "workspace install": ["task", "authorize"],
    "revision capture": ["task", "summary"],
    verify: ["task"],
    "feedback add": ["task", "input"],
  };
  if (!Object.hasOwn(contract, cmd))
    throw new Error(
      "Unknown command. Use doctor, task create/ready/criteria/block/resume/cancel, workspace prepare/install, revision capture, verify, feedback add, status. Review is dashboard-only.",
    );
  for (const key of Object.keys(flags))
    if (!contract[cmd].includes(key))
      throw new Error("Unknown option --" + key);
  for (const key of contract[cmd])
    if (!flags[key]) throw new Error("Missing --" + key);
  let out;
  if (cmd === "doctor") out = await request("/doctor");
  else if (cmd === "status")
    out = await request("/tasks/" + encodeURIComponent(flags.task));
  else {
    const input = flags.input
      ? JSON.parse(await readFile(flags.input, "utf8"))
      : undefined;
    if (cmd === "workspace install" && flags.authorize !== "dependency-install")
      throw new Error(
        "Explicit authorization requires --authorize dependency-install",
      );
    out = await request("/actions", {
      command: cmd.replace(" ", "."),
      taskId: flags.task,
      projectId: flags.project,
      input,
      criteria: cmd === "task criteria" ? input?.criteria : undefined,
      summary: flags.summary,
      reason: flags.reason,
      authorized: flags.authorize === "dependency-install",
    });
  }
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
