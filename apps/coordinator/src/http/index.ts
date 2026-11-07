import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Engine } from "../tasks/index.js";
export function server(engine: Engine, token: string, instance: string) {
  return createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    const send = (code: number, v: unknown) => {
      res.statusCode = code;
      res.end(JSON.stringify(v));
    };
    const auth = req.headers.authorization || "";
    const expected = "Bearer " + token;
    if (
      auth.length !== expected.length ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    )
      return send(401, { error: "Unauthorized local client" });
    if (req.headers.origin)
      return send(403, { error: "Direct browser requests are not supported" });
    try {
      if (req.method === "GET" && req.url === "/health")
        return send(200, {
          service: "design-flow-coordinator",
          version: 1,
          instance,
        });
      if (req.method === "GET" && req.url === "/doctor")
        return send(200, await engine.doctor());
      if (req.method === "GET" && req.url === "/tasks")
        return send(200, await engine.view());
      if (req.method === "GET" && req.url?.startsWith("/comparison/")) {
        const parts = req.url.split("/");
        return send(200, await engine.comparison(parts[2], Number(parts[3])));
      }
      if (req.method === "GET" && req.url?.startsWith("/tasks/"))
        return send(
          200,
          await engine.view(decodeURIComponent(req.url.slice(7))),
        );
      if (req.method === "POST" && req.url === "/actions") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 1000000) throw new Error("Request too large");
        }
        const body = JSON.parse(raw);
        return send(
          200,
          await engine.action(
            body.command,
            body,
            req.headers["x-flow-client"] === "dashboard" ? "dashboard" : "cli",
          ),
        );
      }
      send(404, { error: "Unknown endpoint" });
    } catch (e) {
      send(400, { error: (e as Error).message });
    }
  });
}
