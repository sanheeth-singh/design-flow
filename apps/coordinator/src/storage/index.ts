import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  StateSchema,
  type State,
} from "../../../../packages/core/src/model.js";
export class Store {
  state: State = { schemaVersion: 1, tasks: [] };
  private tail: Promise<unknown> = Promise.resolve();
  private lockPath: string;
  private owner = randomUUID();
  constructor(readonly dir: string) {
    this.lockPath = path.join(dir, "writer.lock");
  }
  async acquire() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    let f;
    try {
      f = await open(this.lockPath, "wx", 0o600);
    } catch {
      throw new Error(
        "Writer lock exists. Another coordinator may be active. Use npm run recover only after shutdown or a confirmed crash.",
      );
    }
    try {
      await f.writeFile(
        JSON.stringify({ pid: process.pid, owner: this.owner }),
      );
    } finally {
      await f.close();
    }
    try {
      this.state = StateSchema.parse(
        JSON.parse(await readFile(path.join(this.dir, "state.json"), "utf8")),
      ) as State;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        await this.close();
        throw new Error(
          "State is corrupt or unsupported; preserved unchanged. Restore a known backup: " +
            String(e),
        );
      }
    }
  }
  async transaction<T>(action: (s: State) => Promise<T> | T): Promise<T> {
    const job = this.tail.then(async () => {
      const draft = structuredClone(this.state);
      const out = await action(draft);
      StateSchema.parse(draft);
      const temp = path.join(this.dir, "state." + randomUUID() + ".tmp");
      const f = await open(temp, "wx", 0o600);
      try {
        await f.writeFile(JSON.stringify(draft, null, 2));
        await f.sync();
      } finally {
        await f.close();
      }
      await rename(temp, path.join(this.dir, "state.json"));
      this.state = draft;
      return out;
    });
    this.tail = job.catch(() => {});
    return job;
  }
  async close() {
    await this.tail;
    try {
      const lock = JSON.parse(await readFile(this.lockPath, "utf8"));
      if (lock.owner === this.owner) await unlink(this.lockPath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}
