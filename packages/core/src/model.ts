import { z } from "zod";
export const CheckSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    runner: z.literal("npm"),
    script: z.string().regex(/^[a-zA-Z0-9:_-]+$/),
    required: z.boolean(),
    timeoutMs: z.number().int().min(20).max(900000),
  })
  .strict();
export const ProjectSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    name: z.string().min(1),
    repositoryPath: z.string().min(1),
    frontendRoot: z.string().min(1),
    baseBranch: z.string().min(1),
    allowedPaths: z.array(z.string().min(1)).min(1),
    deniedPaths: z.array(z.string()).default([]),
    designRules: z.array(z.string()),
    checks: z.array(CheckSchema).min(1),
  })
  .strict();
export const ConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    projects: z.array(ProjectSchema).min(1),
  })
  .strict();
export const BriefSchema = z
  .object({
    title: z.string().min(1).max(160),
    brief: z.string().min(1).max(20000),
    criteria: z.array(z.string().min(1).max(2000)).min(1).max(30),
    requestReference: z.string().min(1).max(500).optional(),
    sourceReference: z.string().max(1000).optional(),
    authorLabel: z.string().min(1).max(100).default("local operator (claimed)"),
  })
  .strict();
export const FeedbackSchema = z
  .object({
    revision: z.number().int().positive(),
    authorLabel: z.string().min(1).max(100),
    message: z.string().min(1).max(10000),
    sourceReference: z.string().max(1000).optional(),
  })
  .strict();
export type Project = z.infer<typeof ProjectSchema>;
export type Brief = z.infer<typeof BriefSchema>;
export type Status =
  | "draft"
  | "ready"
  | "implementing"
  | "verifying"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "blocked"
  | "cancelled";
export interface Revision {
  criteria: string[];
  projectSnapshot: Project;
  number: number;
  commit: string;
  baseCommit: string;
  changedFiles: string[];
  criteriaVersion: number;
  configHash: string;
  summary: string;
  createdAt: string;
}
export interface CheckRun {
  id: string;
  revision: number;
  commit: string;
  configHash: string;
  criteriaVersion: number;
  checkId: string;
  runner: string;
  script: string;
  startedAt: string;
  endedAt: string;
  outcome: "passed" | "failed" | "timed_out" | "error" | "skipped" | "not_run";
  exitCode: number | null;
  logReference: string;
  log: string;
}
export interface Task {
  id: string;
  projectId: string;
  input: Brief;
  criteriaVersion: number;
  status: Status;
  createdAt: string;
  updatedAt: string;
  reason?: string;
  workspace?: {
    branch: string;
    path: string;
    baseCommit: string;
    repositoryPath: string;
    preparationState: "prepared" | "dependencies_installed";
  };
  revisions: Revision[];
  checks: CheckRun[];
  feedback: Array<z.infer<typeof FeedbackSchema> & { at: string }>;
  reviews: Array<{
    revision: number;
    criteriaVersion: number;
    configHash: string;
    evidence: string[];
    evidenceFingerprint: string;
    decision: "approved" | "changes_requested";
    observations: string;
    authorLabel: string;
    at: string;
  }>;
  history: Array<{
    action: string;
    actor: string;
    at: string;
    revision?: number;
    detail?: string;
  }>;
}
export interface State {
  schemaVersion: 1;
  tasks: Task[];
}
export const StateSchema = z
  .object({
    schemaVersion: z.literal(1),
    tasks: z.array(
      z.object({
        id: z.string(),
        projectId: z.string(),
        input: BriefSchema,
        criteriaVersion: z.number().int().positive(),
        status: z.enum([
          "draft",
          "ready",
          "implementing",
          "verifying",
          "in_review",
          "approved",
          "changes_requested",
          "blocked",
          "cancelled",
        ]),
        createdAt: z.string(),
        updatedAt: z.string(),
        revisions: z.array(
          z.object({
            number: z.number(),
            commit: z.string(),
            baseCommit: z.string(),
            changedFiles: z.array(z.string()),
            criteria: z.array(z.string()),
            projectSnapshot: ProjectSchema,
            criteriaVersion: z.number(),
            configHash: z.string(),
            summary: z.string(),
            createdAt: z.string(),
          }),
        ),
        checks: z.array(
          z.object({
            id: z.string(),
            revision: z.number(),
            commit: z.string(),
            configHash: z.string(),
            criteriaVersion: z.number(),
            checkId: z.string(),
            runner: z.string(),
            script: z.string(),
            startedAt: z.string(),
            endedAt: z.string(),
            outcome: z.enum([
              "passed",
              "failed",
              "timed_out",
              "error",
              "skipped",
              "not_run",
            ]),
            exitCode: z.number().nullable(),
            logReference: z.string(),
            log: z.string(),
          }),
        ),
        feedback: z.array(FeedbackSchema.extend({ at: z.string() })),
        reviews: z.array(
          z.object({
            revision: z.number(),
            criteriaVersion: z.number(),
            configHash: z.string(),
            evidence: z.array(z.string()),
            evidenceFingerprint: z.string(),
            decision: z.enum(["approved", "changes_requested"]),
            observations: z.string(),
            authorLabel: z.string(),
            at: z.string(),
          }),
        ),
        history: z.array(
          z.object({
            action: z.string(),
            actor: z.string(),
            at: z.string(),
            revision: z.number().optional(),
            detail: z.string().optional(),
          }),
        ),
        workspace: z
          .object({
            branch: z.string(),
            path: z.string(),
            baseCommit: z.string(),
            repositoryPath: z.string(),
            preparationState: z.enum(["prepared", "dependencies_installed"]),
          })
          .optional(),
        reason: z.string().optional(),
      }),
    ),
  })
  .strict();
