import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
export function npmEntry() {
  const candidates = [
    process.env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      "node_modules/npm/bin/npm-cli.js",
    ),
    path.resolve(
      path.dirname(process.execPath),
      "../lib/node_modules/npm/bin/npm-cli.js",
    ),
  ];
  for (const c of candidates) {
    if (c && existsSync(c) && path.basename(realpathSync(c)) === "npm-cli.js")
      return realpathSync(c);
  }
  throw new Error(
    "npm JavaScript entry point unavailable. Start through npm start or supply a verified npm_execpath.",
  );
}
export function execute(
  cwd: string,
  args: string[],
  timeoutMs: number,
): Promise<{
  outcome: "passed" | "failed" | "timed_out" | "error";
  exitCode: number | null;
  log: string;
}> {
  return new Promise((resolve) => {
    let log = "",
      timed = false,
      finished = false;
    const child = spawn(process.execPath, [npmEntry(), ...args], {
      cwd,
      detached: process.platform !== "win32",
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        npm_config_update_notifier: "false",
      },
    });
    const append = (s: Buffer) => {
      log = (log + s.toString()).slice(-200000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    let killer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const k = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        });
        k.on("error", () => child.kill("SIGKILL"));
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const timer = setTimeout(() => {
      timed = true;
      stop();
      killer = setTimeout(
        () => finish(null, "process tree termination timed out"),
        5000,
      );
    }, timeoutMs);
    const finish = (code: number | null, error?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(killer);
      resolve({
        outcome: timed
          ? "timed_out"
          : error
            ? "error"
            : code === 0
              ? "passed"
              : "failed",
        exitCode: code,
        log: log + (error ? "\n" + error : ""),
      });
    };
    child.on("error", (e) => finish(null, e.message));
    child.on("close", (code) => finish(code));
  });
}
