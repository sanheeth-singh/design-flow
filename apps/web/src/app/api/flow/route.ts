import { readFile } from "node:fs/promises";
import path from "node:path";
export const dynamic = "force-dynamic";
const dir = () =>
  process.env.FLOW_STATE || path.resolve(process.cwd(), "../../.flow");
async function call(route: string, body?: unknown) {
  const m = JSON.parse(
    await readFile(path.join(dir(), "runtime.json"), "utf8"),
  );
  if (
    m.service !== "design-flow-coordinator" ||
    m.version !== 1 ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(m.url)
  )
    throw new Error("Invalid local runtime metadata");
  const headers = {
    authorization: "Bearer " + m.token,
    "content-type": "application/json",
    "x-flow-client": "dashboard",
  };
  const h = await fetch(m.url + "/health", {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  const health = await h.json();
  if (!h.ok || health.instance !== m.instance || health.service !== m.service)
    throw new Error("Unexpected local service");
  const r = await fetch(m.url + route, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return Response.json(await r.json(), {
    status: r.status,
    headers: { "cache-control": "no-store" },
  });
}
export async function GET(req: Request) {
  try {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.get("host") || ""))
      return Response.json(
        { error: "Loopback host required" },
        { status: 403 },
      );
    const u = new URL(req.url);
    if (u.searchParams.has("revision")) {
      const task = u.searchParams.get("task") || "";
      const rev = u.searchParams.get("revision") || "";
      if (!/^[a-f0-9-]{36}$/.test(task) || !/^\d+$/.test(rev))
        throw new Error("Invalid revision reference");
      return await call("/comparison/" + task + "/" + rev);
    }
    if (u.searchParams.get("doctor") === "1") return await call("/doctor");
    return await call("/tasks");
  } catch {
    return Response.json(
      {
        error:
          "Coordinator unavailable. Start Design Flow from the project root and check its terminal.",
      },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (
      !origin ||
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host || "") ||
      new URL(origin).host !== host
    )
      return Response.json(
        { error: "Same-origin local dashboard required" },
        { status: 403 },
      );
    const b = await req.json();
    if (
      ![
        "task.create",
        "task.ready",
        "task.criteria",
        "task.block",
        "task.resume",
        "task.cancel",
        "feedback.add",
        "review.decide",
      ].includes(b.command)
    )
      return Response.json(
        { error: "Unsupported dashboard action" },
        { status: 400 },
      );
    return await call("/actions", b);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
