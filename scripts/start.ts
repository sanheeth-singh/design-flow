import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { connection } from "../packages/core/src/client.js";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const env = {
  ...process.env,
  FLOW_STATE: path.resolve(process.env.FLOW_STATE || path.join(root, ".flow")),
  FLOW_CONFIG: path.resolve(
    process.env.FLOW_CONFIG || path.join(root, "config/projects.local.json"),
  ),
};
const coordinator = spawn(
  process.execPath,
  [path.join(root, "dist/apps/coordinator/src/main.js")],
  { cwd: root, env, stdio: ["inherit", "inherit", "inherit", "ipc"] },
);
let web: ReturnType<typeof spawn> | undefined;
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  web?.kill("SIGTERM");
  if (coordinator.connected) coordinator.send("shutdown");
  else coordinator.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
coordinator.on("exit", (code) => {
  if (!stopping) {
    stop();
    process.exitCode = code || 1;
  }
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (coordinator.exitCode !== null)
      throw new Error("Coordinator failed to start");
    try {
      const m = await connection(env.FLOW_STATE);
      if (m.pid === coordinator.pid) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error("Coordinator startup timed out");
  const port = process.env.FLOW_DASHBOARD_PORT || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("Invalid dashboard port");
  const require = createRequire(import.meta.url);
  web = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      path.join(root, "apps/web"),
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  web.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
  stop();
}
