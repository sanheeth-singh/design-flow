import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { StateSchema } from "../packages/core/src/model.js";
const dir = path.resolve(process.env.FLOW_STATE || ".flow");
try {
  const lock = JSON.parse(
    await readFile(path.join(dir, "writer.lock"), "utf8"),
  );
  if (
    !Number.isInteger(lock.pid) ||
    lock.pid <= 0 ||
    typeof lock.owner !== "string"
  )
    throw new Error("Invalid lock; inspect manually");
  let active = true;
  try {
    process.kill(lock.pid, 0);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ESRCH") active = false;
  }
  if (active)
    throw new Error(
      "Lock PID is active or cannot be inspected. Refusing recovery.",
    );
  try {
    StateSchema.parse(
      JSON.parse(await readFile(path.join(dir, "state.json"), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "State is invalid; preserve it and restore a known backup before recovery.",
      );
  }
  if (
    (await readFile(path.join(dir, "writer.lock"), "utf8")) !==
    JSON.stringify(lock)
  )
    throw new Error("Lock changed during recovery");
  await unlink(path.join(dir, "writer.lock"));
  try {
    await unlink(path.join(dir, "runtime.json"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  console.log(
    "Confirmed inactive writer lock removed. State and worktrees preserved.",
  );
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
