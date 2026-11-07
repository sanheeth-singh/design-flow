"use client";
import { useEffect, useState, type FormEvent } from "react";
type Task = any;
type Project = any;
const short = (s: string) => s?.slice(0, 12) || "—";
export default function Dashboard() {
  const [data, setData] = useState<{
    tasks: Task[];
    projects: Project[];
  } | null>(null);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("evidence");
  async function load() {
    try {
      const r = await fetch("/api/flow", { cache: "no-store" });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      setData(v);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, []);
  async function act(body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/flow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      await load();
      if (body.command === "task.create") {
        setId(v.id);
        setCreating(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selected = data?.tasks.find((t) => t.id === id) || data?.tasks[0];
  const project = data?.projects.find((p) => p.id === selected?.projectId);
  const revision = selected?.revisions.at(-1);
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act({
      command: "task.create",
      projectId: f.get("project"),
      input: {
        title: f.get("title"),
        brief: f.get("brief"),
        criteria: String(f.get("criteria"))
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        authorLabel: "dashboard operator (claimed)",
      },
    });
  }
  function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act({
      command: "review.decide",
      taskId: selected.id,
      revision: revision.number,
      decision: f.get("decision"),
      evidenceFingerprint: selected.readiness.fingerprint,
      authorLabel: f.get("author"),
      observations: f.get("observations"),
    });
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          design<span>flow</span>
          <i />
        </a>
        <p className="tagline">
          From Team Conversations
          <br />
          to Verified Code.
        </p>
        <div className="workspace-label">LOCAL WORKSPACE</div>
        <button className="nav active" onClick={() => setCreating(false)}>
          Review workspace <span>{data?.tasks.length || 0}</span>
        </button>
        <button
          className="nav"
          onClick={async () => {
            try {
              const r = await fetch("/api/flow?doctor=1");
              const v = await r.json();
              if (!r.ok) throw Error(v.error);
              setDiagnostics(v);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Setup diagnostics
        </button>
        <div className="sidebar-bottom">
          <span className={"dot " + (data ? "online" : "")} />
          {data ? "Coordinator connected" : "Waiting for coordinator"}
          <small>Loopback service · Local decisions</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">DESIGN FLOW / REVIEW WORKSPACE</p>
            <h1>Conversations become progress.</h1>
            <p className="muted">
              Real changes. Visible evidence. Your final decision.
            </p>
          </div>
          <button className="primary" onClick={() => setCreating(!creating)}>
            Create task <span>+</span>
          </button>
        </header>
        {error && (
          <div role="alert" className="notice error">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {diagnostics && (
          <section className="panel">
            <div className="section-title">
              <h2>Observed setup diagnostics</h2>
              <button onClick={() => setDiagnostics(null)}>Close</button>
            </div>
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          </section>
        )}
        {creating && (
          <form className="panel create" onSubmit={create}>
            <h2>Create a frontend task</h2>
            <label>
              Project
              <select name="project" required>
                {data?.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Brief
              <textarea name="brief" required />
            </label>
            <label>
              Measurable acceptance criteria <small>One per line</small>
              <textarea name="criteria" required />
            </label>
            <button className="primary" disabled={busy}>
              Save draft
            </button>
          </form>
        )}
        <div className="metrics">
          <div>
            <span>Configured projects</span>
            <strong>{data?.projects.length || 0}</strong>
          </div>
          <div>
            <span>Tasks in workspace</span>
            <strong>{data?.tasks.length || 0}</strong>
          </div>
          <div>
            <span>Ready for a decision</span>
            <strong>
              {data?.tasks.filter(
                (t) => t.status === "in_review" && t.readiness.ready,
              ).length || 0}
            </strong>
          </div>
          <div>
            <span>Local approvals</span>
            <strong>
              {data?.tasks.filter(
                (t) => t.status === "approved" && t.readiness.ready,
              ).length || 0}
            </strong>
          </div>
        </div>
        <div className="content">
          <section className="task-list">
            <div className="section-title">
              <h2>Tasks</h2>
              <span className="muted">{data?.tasks.length || 0} total</span>
            </div>
            {!data?.tasks.length && (
              <div className="empty">
                Your first task starts with a brief.
                <p>Create one here or through the flow CLI.</p>
              </div>
            )}
            {data?.tasks.map((t) => (
              <button
                key={t.id}
                className={
                  "task-row " + (selected?.id === t.id ? "selected" : "")
                }
                onClick={() => {
                  setId(t.id);
                  setTab("evidence");
                }}
              >
                <span className={"badge " + t.effectiveStatus}>
                  {t.effectiveStatus.replaceAll("_", " ")}
                </span>
                <strong>{t.input.title}</strong>
                <span className="muted">
                  {t.projectId} ·{" "}
                  {t.revisions.length
                    ? `Revision ${t.revisions.length}`
                    : "Draft brief"}
                </span>
                <code>{short(t.id)}</code>
              </button>
            ))}
          </section>
          {selected ? (
            <section className="detail">
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">
                    {project?.name || selected.projectId}
                  </p>
                  <h2>{selected.input.title}</h2>
                </div>
                <span className={"badge " + selected.effectiveStatus}>
                  {selected.effectiveStatus.replaceAll("_", " ")}
                </span>
              </div>
              <p>{selected.input.brief}</p>
              <div className="criteria">
                <h3>
                  Acceptance criteria <small>v{selected.criteriaVersion}</small>
                </h3>
                <ol>
                  {selected.input.criteria.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ol>
              </div>
              {selected.status === "draft" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void act({ command: "task.ready", taskId: selected.id })
                  }
                >
                  Mark brief ready
                </button>
              )}
              {selected.reason && (
                <div className="notice">{selected.reason}</div>
              )}
              {selected.workspace && (
                <div className="workspace">
                  <span>Task worktree</span>
                  <code>{selected.workspace.path}</code>
                  <span>Branch</span>
                  <code>{selected.workspace.branch}</code>
                  <small>Final Git integration remains a human action.</small>
                </div>
              )}
              <div className="tabs" role="tablist" aria-label="Task details">
                {["evidence", "brief & rules", "history", "review"].map((t) => (
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "evidence" && (
                <div>
                  {selected.readiness.reasons.length > 0 && (
                    <div className="notice">
                      <strong>Review readiness</strong>
                      <ul>
                        {selected.readiness.reasons.map(
                          (r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                  {!revision && (
                    <p className="empty">
                      The agent’s captured revision and actual check results
                      will appear here.
                    </p>
                  )}
                  {selected.revisions
                    .slice()
                    .reverse()
                    .map((r: any) => (
                      <section className="revision" key={r.number}>
                        <div className="section-title">
                          <h3>Revision {r.number}</h3>
                          <code>{short(r.commit)}</code>
                        </div>
                        <p>{r.summary}</p>
                        <details
                          onToggle={async (e) => {
                            if (!e.currentTarget.open) return;
                            const key = selected.id + ":" + r.number;
                            if (diffs[key] !== undefined) return;
                            try {
                              const response = await fetch(
                                "/api/flow?task=" +
                                  selected.id +
                                  "&revision=" +
                                  r.number,
                              );
                              const v = await response.json();
                              if (!response.ok) throw Error(v.error);
                              setDiffs((old) => ({
                                ...old,
                                [key]:
                                  v.diff ||
                                  "(No code differences; criteria/configuration revision)",
                              }));
                            } catch (err) {
                              setError((err as Error).message);
                            }
                          }}
                        >
                          <summary>
                            Compare with{" "}
                            {r.number === 1
                              ? "task base"
                              : "revision " + (r.number - 1)}
                          </summary>
                          <pre>
                            {diffs[selected.id + ":" + r.number] ||
                              "Loading comparison…"}
                          </pre>
                        </details>
                        <small>
                          Criteria v{r.criteriaVersion} ·{" "}
                          {new Date(r.createdAt).toLocaleString()}
                        </small>
                        <details>
                          <summary>
                            {r.changedFiles.length} changed files
                          </summary>
                          <ul>
                            {r.changedFiles.map((f: string) => (
                              <li key={f}>
                                <code>{f}</code>
                              </li>
                            ))}
                          </ul>
                          <p>
                            Commit <code>{r.commit}</code>
                          </p>
                          <p>
                            Base <code>{r.baseCommit}</code>
                          </p>
                        </details>
                        {project?.checks.map((c: any) => {
                          const run = selected.checks
                            .filter(
                              (v: any) =>
                                v.revision === r.number && v.checkId === c.id,
                            )
                            .at(-1);
                          return (
                            <div key={c.id} className="check">
                              <div>
                                <strong>{c.id}</strong>
                                <small>
                                  npm run {c.script}
                                  {c.required ? " · required" : ""}
                                </small>
                              </div>
                              <span
                                className={
                                  "badge " + (run?.outcome || "not_run")
                                }
                              >
                                {run?.outcome || "not_run"}
                              </span>
                              {run && (
                                <details>
                                  <summary>
                                    Execution log · exit {run.exitCode ?? "—"}
                                  </summary>
                                  <p>
                                    {run.startedAt} → {run.endedAt}
                                  </p>
                                  <p>
                                    {run.runner} · {run.logReference}
                                  </p>
                                  <pre>{run.log || "(No output)"}</pre>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </section>
                    ))}
                </div>
              )}
              {tab === "brief & rules" && (
                <div className="rules">
                  <h3>Project design rules</h3>
                  <ul>
                    {project?.designRules.map((r: string) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <h3>Allowed paths</h3>
                  <code>{project?.allowedPaths.join(", ")}</code>
                  <h3>Source reference</h3>
                  <p>
                    {selected.input.sourceReference ||
                      "No source reference supplied"}
                  </p>
                  <small>
                    Author and chat references are claims, not authenticated
                    identities.
                  </small>
                  <h3>Update criteria</h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act({
                        command: "task.criteria",
                        taskId: selected.id,
                        criteria: String(f.get("criteria"))
                          .split("\n")
                          .filter(Boolean),
                      });
                    }}
                  >
                    <label>
                      Criteria
                      <textarea
                        name="criteria"
                        key={selected.id + selected.criteriaVersion}
                        defaultValue={selected.input.criteria.join("\n")}
                        required
                      />
                    </label>
                    <button disabled={busy || selected.status === "cancelled"}>
                      Save criteria and invalidate review
                    </button>
                  </form>
                </div>
              )}
              {tab === "history" && (
                <div>
                  {selected.history
                    .slice()
                    .reverse()
                    .map((h: any, i: number) => (
                      <div className="history" key={i}>
                        <strong>{h.action.replaceAll("_", " ")}</strong>
                        <small>
                          {new Date(h.at).toLocaleString()} · {h.actor}
                        </small>
                        {h.detail && <p>{h.detail}</p>}
                      </div>
                    ))}
                </div>
              )}
              {tab === "review" && (
                <div>
                  <h3>Local operator review</h3>
                  <p className="muted">
                    Inspect the target preview for responsive layout and
                    keyboard usability. Record your observations below. Checks
                    alone do not prove these criteria.
                  </p>
                  {revision ? (
                    <form onSubmit={review}>
                      <label>
                        Reviewer label
                        <input
                          name="author"
                          required
                          placeholder="Your name (local claim)"
                        />
                      </label>
                      <label>
                        Preview observations / requested changes
                        <textarea
                          name="observations"
                          required
                          placeholder="What did you inspect, and what did you observe?"
                        />
                      </label>
                      <label>
                        Decision
                        <select name="decision">
                          <option value="changes_requested">
                            Request changes
                          </option>
                          <option
                            value="approved"
                            disabled={!selected.readiness.ready}
                          >
                            Approve revision {revision.number}
                          </option>
                        </select>
                      </label>
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          ![
                            "in_review",
                            "approved",
                            "changes_requested",
                          ].includes(selected.status)
                        }
                      >
                        Record local decision
                      </button>
                    </form>
                  ) : (
                    <p>Capture and verify a revision first.</p>
                  )}
                  <h3>Feedback</h3>
                  {selected.feedback.map((f: any, i: number) => (
                    <blockquote key={i}>
                      <p>{f.message}</p>
                      <small>
                        {f.authorLabel} · Revision {f.revision} · {f.at}
                      </small>
                    </blockquote>
                  ))}
                  <h3>Review records</h3>
                  {selected.reviews.map((r: any, i: number) => (
                    <blockquote key={i}>
                      <strong>
                        {r.decision} · Revision {r.revision}
                      </strong>
                      <p>{r.observations}</p>
                      <small>
                        {r.authorLabel} · {r.at}
                      </small>
                    </blockquote>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="detail empty">
              <h2>A clear path from brief to review.</h2>
              <p>
                Connect an independent frontend repository, create a task, and
                let your existing agent work through the local CLI.
              </p>
              <p>No task results have been recorded yet.</p>
            </section>
          )}
        </div>
        <footer>
          DESIGN FLOW{" "}
          <span>Local workflow · Human review · Deliberate integration</span>
        </footer>
      </main>
    </div>
  );
}
