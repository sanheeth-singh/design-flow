import path from "node:path";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Store } from "./storage/index.js";
import { Engine } from "./tasks/index.js";
import { server } from "./http/index.js";
const dir = path.resolve(process.env.FLOW_STATE || ".flow");
const store = new Store(dir);
let http: ReturnType<typeof server> | undefined;
try {
  await store.acquire();
  const engine = new Engine(
    store,
    path.resolve(process.env.FLOW_CONFIG || "config/projects.local.json"),
    path.resolve(process.env.FLOW_WORKTREES || "../design-flow-worktrees"),
  );
  await engine.projects();
  await store.transaction((s) => {
    for (const t of s.tasks)
      if (t.status === "verifying") {
        t.status = "blocked";
        t.reason =
          "Coordinator stopped during verification; capture/reverify after inspection.";
        t.updatedAt = new Date().toISOString();
        t.history.push({
          action: "verification_interrupted",
          actor: "coordinator",
          at: t.updatedAt,
        });
      }
  });
  const token = randomBytes(32).toString("hex");
  const instance = randomUUID();
  http = server(engine, token, instance);
  const port = Number(process.env.FLOW_COORDINATOR_PORT || 4310);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid coordinator port");
  await new Promise<void>((resolve, reject) => {
    http!.once("error", reject);
    http!.listen(port, "127.0.0.1", resolve);
  });
  const metadata = {
    service: "design-flow-coordinator",
    version: 1,
    instance,
    url: "http://127.0.0.1:" + port,
    token,
    pid: process.pid,
  };
  await writeFile(path.join(dir, "runtime.json"), JSON.stringify(metadata), {
    mode: 0o600,
  });
  console.log("Design Flow coordinator listening on " + metadata.url);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    http!.close();
    while (engine.busy) await new Promise((r) => setTimeout(r, 100));
    http!.closeAllConnections();
    try {
      const m = JSON.parse(
        await readFile(path.join(dir, "runtime.json"), "utf8"),
      );
      if (m.instance === instance) await unlink(path.join(dir, "runtime.json"));
    } catch {}
    await store.close();
    process.exit(0);
  };
  process.on("message", (m) => {
    if (m === "shutdown") void close();
  });
  process.on("SIGTERM", () => void close());
  process.on("SIGINT", () => void close());
} catch (e) {
  http?.close();
  await store.close();
  console.error((e as Error).message);
  process.exitCode = 1;
}
