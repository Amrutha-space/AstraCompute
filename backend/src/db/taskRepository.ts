import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type {
  ComputeTask,
  ExecutionRecord,
  ExecutorType,
  SchedulerPolicy,
  SizeBucket,
  TaskResult,
  TaskState,
  TaskStatus
} from "@astra/core-engine";
import { schemaStatements } from "./schema.js";

export interface PersistedTaskState extends TaskState {
  updatedAt: string;
  attempt: number;
  originTaskId?: string;
  decisionReason?: string;
}

export interface DecisionTraceRecord {
  taskId: string;
  policyMode: SchedulerPolicy;
  recommendedExecutor: ExecutorType;
  heuristicExecutor: ExecutorType;
  decisionMode: "heuristic" | "adaptive";
  reason: string;
  sizeBucket: SizeBucket;
  cpuEstimateMs: number;
  gpuEstimateMs: number;
  selectedExecutor: ExecutorType;
  baselineExecutor: ExecutorType;
  baselineEstimateMs: number;
  projectedGainMs: number;
  decidedAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  queueWaitMs?: number;
  actualDurationMs?: number;
  status: TaskStatus;
}

export interface BenchmarkSnapshotRecord {
  id: number;
  name: string;
  policyMode: SchedulerPolicy;
  createdAt: string;
  summaryJson: string;
}

export interface PersistedUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
}

interface TaskRow {
  id: string;
  type: ComputeTask["type"];
  size: number;
  priority: number;
  payload_json: string;
  submitted_at: string;
  status: TaskStatus;
  executor: ExecutorType | null;
  result_json: string | null;
  error: string | null;
  updated_at: string;
  attempt: number;
  origin_task_id: string | null;
  decision_reason: string | null;
}

interface ExecutionRecordRow {
  task_id: string;
  executor: ExecutorType;
  time_ms: number;
  status: ExecutionRecord["status"];
  task_type: ComputeTask["type"];
  size: number;
  priority: number;
  started_at: string;
  completed_at: string;
  error: string | null;
}

interface DecisionTraceRow {
  task_id: string;
  policy_mode: SchedulerPolicy;
  recommended_executor: ExecutorType;
  heuristic_executor: ExecutorType;
  decision_mode: "heuristic" | "adaptive";
  reason: string;
  size_bucket: SizeBucket;
  cpu_estimate_ms: number;
  gpu_estimate_ms: number;
  selected_executor: ExecutorType;
  baseline_executor: ExecutorType;
  baseline_estimate_ms: number;
  projected_gain_ms: number;
  decided_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
  queue_wait_ms: number | null;
  actual_duration_ms: number | null;
  status: TaskStatus;
}

interface BenchmarkSnapshotRow {
  id: number;
  name: string;
  policy_mode: SchedulerPolicy;
  created_at: string;
  summary_json: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
}

export class TaskRepository {
  private readonly database: Database.Database;

  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.database = new Database(filePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
  }

  initialize(): void {
    for (const statement of schemaStatements) {
      this.database.exec(statement);
    }
    this.safeExec("ALTER TABLE decision_traces ADD COLUMN policy_mode TEXT NOT NULL DEFAULT 'balanced'");
    this.setDefaultSystemValue("scheduler_policy", "balanced");
    this.setDefaultSystemValue("policy_locked", "false");
    this.setDefaultSystemValue("policy_lock_reason", "");
  }

  loadSnapshot(): {
    tasks: PersistedTaskState[];
    records: ExecutionRecord[];
    traces: DecisionTraceRecord[];
    snapshots: BenchmarkSnapshotRecord[];
    queuePaused: boolean;
    activePolicy: SchedulerPolicy;
    policyLocked: boolean;
    policyLockReason?: string;
  } {
    const taskRows = this.database.prepare("SELECT * FROM tasks ORDER BY submitted_at DESC").all() as TaskRow[];
    const recordRows = this.database
      .prepare(
        "SELECT task_id, executor, time_ms, status, task_type, size, priority, started_at, completed_at, error FROM execution_records ORDER BY completed_at DESC"
      )
      .all() as ExecutionRecordRow[];
    const traceRows = this.database
      .prepare("SELECT * FROM decision_traces ORDER BY COALESCE(completed_at, decided_at) DESC")
      .all() as DecisionTraceRow[];
    const snapshotRows = this.database
      .prepare("SELECT * FROM benchmark_snapshots ORDER BY created_at DESC")
      .all() as BenchmarkSnapshotRow[];

    const policyLockReason = this.getSystemValue("policy_lock_reason");

    return {
      tasks: taskRows.map((row) => this.toTaskState(row)),
      records: recordRows.map((row) => this.toExecutionRecord(row)),
      traces: traceRows.map((row) => this.toDecisionTrace(row)),
      snapshots: snapshotRows.map((row) => this.toBenchmarkSnapshot(row)),
      queuePaused: this.getSystemFlag("queue_paused"),
      activePolicy: this.getSchedulerPolicy(),
      policyLocked: this.getSystemFlag("policy_locked"),
      policyLockReason: policyLockReason ? policyLockReason : undefined
    };
  }

  saveTask(state: PersistedTaskState): void {
    this.database
      .prepare(
        `
          INSERT INTO tasks (
            id, type, size, priority, payload_json, submitted_at, status, executor,
            result_json, error, updated_at, attempt, origin_task_id, decision_reason
          ) VALUES (
            @id, @type, @size, @priority, @payload_json, @submitted_at, @status, @executor,
            @result_json, @error, @updated_at, @attempt, @origin_task_id, @decision_reason
          )
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            size = excluded.size,
            priority = excluded.priority,
            payload_json = excluded.payload_json,
            submitted_at = excluded.submitted_at,
            status = excluded.status,
            executor = excluded.executor,
            result_json = excluded.result_json,
            error = excluded.error,
            updated_at = excluded.updated_at,
            attempt = excluded.attempt,
            origin_task_id = excluded.origin_task_id,
            decision_reason = excluded.decision_reason
        `
      )
      .run({
        id: state.task.id,
        type: state.task.type,
        size: state.task.size,
        priority: state.task.priority,
        payload_json: JSON.stringify(state.task.payload),
        submitted_at: state.task.submittedAt,
        status: state.status,
        executor: state.executor ?? null,
        result_json: state.result ? JSON.stringify(state.result) : null,
        error: state.error ?? null,
        updated_at: state.updatedAt,
        attempt: state.attempt,
        origin_task_id: state.originTaskId ?? null,
        decision_reason: state.decisionReason ?? null
      });
  }

  saveDecisionTrace(trace: DecisionTraceRecord): void {
    this.database
      .prepare(
        `
          INSERT INTO decision_traces (
            task_id, policy_mode, recommended_executor, heuristic_executor, decision_mode, reason, size_bucket,
            cpu_estimate_ms, gpu_estimate_ms, selected_executor, baseline_executor, baseline_estimate_ms,
            projected_gain_ms, decided_at, dispatched_at, completed_at, queue_wait_ms, actual_duration_ms, status
          ) VALUES (
            @taskId, @policyMode, @recommendedExecutor, @heuristicExecutor, @decisionMode, @reason, @sizeBucket,
            @cpuEstimateMs, @gpuEstimateMs, @selectedExecutor, @baselineExecutor, @baselineEstimateMs,
            @projectedGainMs, @decidedAt, @dispatchedAt, @completedAt, @queueWaitMs, @actualDurationMs, @status
          )
          ON CONFLICT(task_id) DO UPDATE SET
            policy_mode = excluded.policy_mode,
            recommended_executor = excluded.recommended_executor,
            heuristic_executor = excluded.heuristic_executor,
            decision_mode = excluded.decision_mode,
            reason = excluded.reason,
            size_bucket = excluded.size_bucket,
            cpu_estimate_ms = excluded.cpu_estimate_ms,
            gpu_estimate_ms = excluded.gpu_estimate_ms,
            selected_executor = excluded.selected_executor,
            baseline_executor = excluded.baseline_executor,
            baseline_estimate_ms = excluded.baseline_estimate_ms,
            projected_gain_ms = excluded.projected_gain_ms,
            decided_at = excluded.decided_at,
            dispatched_at = excluded.dispatched_at,
            completed_at = excluded.completed_at,
            queue_wait_ms = excluded.queue_wait_ms,
            actual_duration_ms = excluded.actual_duration_ms,
            status = excluded.status
        `
      )
      .run({
        taskId: trace.taskId,
        policyMode: trace.policyMode,
        recommendedExecutor: trace.recommendedExecutor,
        heuristicExecutor: trace.heuristicExecutor,
        decisionMode: trace.decisionMode,
        reason: trace.reason,
        sizeBucket: trace.sizeBucket,
        cpuEstimateMs: trace.cpuEstimateMs,
        gpuEstimateMs: trace.gpuEstimateMs,
        selectedExecutor: trace.selectedExecutor,
        baselineExecutor: trace.baselineExecutor,
        baselineEstimateMs: trace.baselineEstimateMs,
        projectedGainMs: trace.projectedGainMs,
        decidedAt: trace.decidedAt,
        dispatchedAt: trace.dispatchedAt ?? null,
        completedAt: trace.completedAt ?? null,
        queueWaitMs: trace.queueWaitMs ?? null,
        actualDurationMs: trace.actualDurationMs ?? null,
        status: trace.status
      });
  }

  createBenchmarkSnapshot(input: {
    name: string;
    policyMode: SchedulerPolicy;
    createdAt: string;
    summaryJson: string;
  }): BenchmarkSnapshotRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO benchmark_snapshots (name, policy_mode, created_at, summary_json)
          VALUES (@name, @policyMode, @createdAt, @summaryJson)
        `
      )
      .run(input);

    return {
      id: Number(result.lastInsertRowid),
      name: input.name,
      policyMode: input.policyMode,
      createdAt: input.createdAt,
      summaryJson: input.summaryJson
    };
  }

  appendExecutionRecord(record: ExecutionRecord): void {
    this.database
      .prepare(
        `
          INSERT INTO execution_records (
            task_id, executor, time_ms, status, task_type, size, priority, started_at, completed_at, error
          ) VALUES (
            @taskId, @executor, @timeMs, @status, @taskType, @size, @priority, @startedAt, @completedAt, @error
          )
        `
      )
      .run({
        ...record,
        error: record.error ?? null
      });
  }

  setQueuePaused(value: boolean): void {
    this.setSystemValue("queue_paused", value ? "true" : "false");
  }

  setSchedulerPolicy(policy: SchedulerPolicy): void {
    this.setSystemValue("scheduler_policy", policy);
  }

  setPolicyLock(locked: boolean, reason?: string): void {
    this.setSystemValue("policy_locked", locked ? "true" : "false");
    this.setSystemValue("policy_lock_reason", reason ?? "");
  }

  clearOperationalHistory(): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare("DELETE FROM tasks").run();
      this.database.prepare("DELETE FROM execution_records").run();
      this.database.prepare("DELETE FROM decision_traces").run();
      this.database.prepare("DELETE FROM benchmark_snapshots").run();
      this.setSystemValue("queue_paused", "false");
    });

    transaction();
  }

  createUser(user: PersistedUser): PersistedUser {
    this.database
      .prepare(
        `
          INSERT INTO users (id, name, email, password_hash, created_at)
          VALUES (@id, @name, @email, @passwordHash, @createdAt)
        `
      )
      .run(user);

    return user;
  }

  getUserByEmail(email: string): PersistedUser | undefined {
    const row = this.database.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    return row ? this.toUser(row) : undefined;
  }

  getUserById(id: string): PersistedUser | undefined {
    const row = this.database.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? this.toUser(row) : undefined;
  }

  saveSession(session: SessionRecord): void {
    this.database
      .prepare(
        `
          INSERT INTO auth_sessions (token_hash, user_id, created_at, last_seen_at)
          VALUES (@tokenHash, @userId, @createdAt, @lastSeenAt)
          ON CONFLICT(token_hash) DO UPDATE SET
            user_id = excluded.user_id,
            created_at = excluded.created_at,
            last_seen_at = excluded.last_seen_at
        `
      )
      .run(session);
  }

  getSessionByTokenHash(tokenHash: string): SessionRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM auth_sessions WHERE token_hash = ?")
      .get(tokenHash) as SessionRow | undefined;
    return row ? this.toSession(row) : undefined;
  }

  touchSession(tokenHash: string, lastSeenAt: string): void {
    this.database
      .prepare(
        `
          UPDATE auth_sessions
          SET last_seen_at = ?
          WHERE token_hash = ?
        `
      )
      .run(lastSeenAt, tokenHash);
  }

  deleteSession(tokenHash: string): void {
    this.database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
  }

  close(): void {
    this.database.close();
  }

  private setDefaultSystemValue(key: string, value: string): void {
    this.database
      .prepare(
        `
          INSERT INTO system_state (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO NOTHING
        `
      )
      .run(key, value);
  }

  private setSystemValue(key: string, value: string): void {
    this.database
      .prepare(
        `
          INSERT INTO system_state (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      )
      .run(key, value);
  }

  private getSystemFlag(key: string): boolean {
    return this.getSystemValue(key) === "true";
  }

  private getSchedulerPolicy(): SchedulerPolicy {
    const value = this.getSystemValue("scheduler_policy");
    if (value === "latency" || value === "throughput" || value === "cpu_preferred") {
      return value;
    }
    return "balanced";
  }

  private getSystemValue(key: string): string | undefined {
    const row = this.database.prepare("SELECT value FROM system_state WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  private safeExec(statement: string): void {
    try {
      this.database.exec(statement);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
        throw error;
      }
    }
  }

  private toTaskState(row: TaskRow): PersistedTaskState {
    const task: ComputeTask = {
      id: row.id,
      type: row.type,
      size: row.size,
      priority: row.priority,
      payload: JSON.parse(row.payload_json) as ComputeTask["payload"],
      submittedAt: row.submitted_at
    } as ComputeTask;

    return {
      task,
      status: row.status,
      executor: row.executor ?? undefined,
      result: row.result_json ? (JSON.parse(row.result_json) as TaskResult) : undefined,
      error: row.error ?? undefined,
      updatedAt: row.updated_at,
      attempt: row.attempt,
      originTaskId: row.origin_task_id ?? undefined,
      decisionReason: row.decision_reason ?? undefined
    };
  }

  private toExecutionRecord(row: ExecutionRecordRow): ExecutionRecord {
    return {
      taskId: row.task_id,
      executor: row.executor,
      timeMs: row.time_ms,
      status: row.status,
      taskType: row.task_type,
      size: row.size,
      priority: row.priority,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error ?? undefined
    };
  }

  private toDecisionTrace(row: DecisionTraceRow): DecisionTraceRecord {
    return {
      taskId: row.task_id,
      policyMode: row.policy_mode ?? "balanced",
      recommendedExecutor: row.recommended_executor,
      heuristicExecutor: row.heuristic_executor,
      decisionMode: row.decision_mode,
      reason: row.reason,
      sizeBucket: row.size_bucket,
      cpuEstimateMs: row.cpu_estimate_ms,
      gpuEstimateMs: row.gpu_estimate_ms,
      selectedExecutor: row.selected_executor,
      baselineExecutor: row.baseline_executor,
      baselineEstimateMs: row.baseline_estimate_ms,
      projectedGainMs: row.projected_gain_ms,
      decidedAt: row.decided_at,
      dispatchedAt: row.dispatched_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      queueWaitMs: row.queue_wait_ms ?? undefined,
      actualDurationMs: row.actual_duration_ms ?? undefined,
      status: row.status
    };
  }

  private toBenchmarkSnapshot(row: BenchmarkSnapshotRow): BenchmarkSnapshotRecord {
    return {
      id: row.id,
      name: row.name,
      policyMode: row.policy_mode,
      createdAt: row.created_at,
      summaryJson: row.summary_json
    };
  }

  private toUser(row: UserRow): PersistedUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at
    };
  }

  private toSession(row: SessionRow): SessionRecord {
    return {
      tokenHash: row.token_hash,
      userId: row.user_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at
    };
  }
}
