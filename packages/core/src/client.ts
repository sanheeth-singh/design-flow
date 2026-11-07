import { readFile } from "node:fs/promises";
import path from "node:path";
export interface Runtime {
  service: "design-flow-coordinator";
  version: 1;
  instance: string;
  url: string;
  token: string;
  pid: number;
}
export async function connection(
  stateDir = process.env.FLOW_STATE || path.resolve(".flow"),
): Promise<Runtime> {
  let m: Runtime;
  try {
    m = JSON.parse(await readFile(path.join(stateDir, "runtime.json"), "utf8"));
  } catch {
    throw new Error(
      "Coordinator unavailable: start npm start; runtime metadata is missing or invalid.",
    );
  }
  if (
    m.service !== "design-flow-coordinator" ||
    m.version !== 1 ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(m.url) ||
    !m.instance ||
    !m.token
  )
    throw new Error("Invalid coordinator runtime metadata.");
  try {
    const r = await fetch(m.url + "/health", {
      headers: { authorization: "Bearer " + m.token },
      signal: AbortSignal.timeout(2500),
    });
    const h = await r.json();
    if (!r.ok || h.service !== m.service || h.instance !== m.instance)
      throw Error();
  } catch {
    throw new Error(
      "Stale runtime metadata or coordinator down. Restart the expected service; do not remove an active lock.",
    );
  }
  return m;
}
export async function request(
  route: string,
  body?: unknown,
  client = "cli",
  stateDir?: string,
) {
  const m = await connection(stateDir);
  const r = await fetch(m.url + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: "Bearer " + m.token,
      "content-type": "application/json",
      "x-flow-client": client,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json();
  if (!r.ok) throw new Error(out.error || "Coordinator request failed");
  return out;
}
