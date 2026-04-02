import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import {
  createSchedulerDecision,
  createTask,
  type ComputeTask,
  type ExecutionRecord,
  type ExecutorType,
  type MatrixMultiplyPayload,
  type SchedulerDecision,
  type SchedulerPolicy,
  type TaskResult,
  type TaskStatus,
  type TaskType,
  type VectorAddPayload
} from "@astra/core-engine";
import type {
  BenchmarkSnapshotRecord,
  DecisionTraceRecord,
  PersistedTaskState,
  TaskRepository
} from "../db/taskRepository.js";
import { AppError } from "../errors.js";
import { CsvLogger } from "../logging/csvLogger.js";
import { BenchmarkService, type BenchmarkSummary } from "./benchmarkService.js";
import { MetricsStore } from "./metricsStore.js";
import { WorkerPool } from "./workerPool.js";

export interface TaskSubmissionInput {
  type: TaskType;
  size: number;
  priority: number;
  payload?: VectorAddPayload | MatrixMultiplyPayload;
}

type QueueEntry = {
  task: ComputeTask;
  decision: SchedulerDecision;
};

type GovernanceState = {
  policyLocked: boolean;
  policyLockReason?: string;
};

type SavedBenchmarkSnapshot = {
  id: number;
  name: string;
  policyMode: SchedulerPolicy;
  createdAt: string;
  summary: BenchmarkSummary;
};

export class TaskService {
  readonly events = new EventEmitter();
  private readonly tasks = new Map<string, PersistedTaskState>();
  private readonly decisionTraces = new Map<string, DecisionTraceRecord>();
  private readonly queue: QueueEntry[] = [];
  private readonly metrics = new MetricsStore();
  private readonly benchmarkService = new BenchmarkService();
  private readonly benchmarkSnapshots: SavedBenchmarkSnapshot[] = [];
  private cpuPool: WorkerPool | null = null;
  private gpuPool: WorkerPool | null = null;
  private queuePaused = false;
  private activePolicy: SchedulerPolicy = "balanced";
  private governance: GovernanceState = {
    policyLocked: false
  };
  private inFlight = {
    cpu: 0,
    gpu: 0
  };

  constructor(
    private readonly logger: CsvLogger,
    private readonly repository: TaskRepository
  ) {}

  async initialize(): Promise<void> {
    await this.logger.initialize();
    this.repository.initialize();
    const snapshot = this.repository.loadSnapshot();
    this.metrics.restore(snapshot.records.reverse());
    this.queuePaused = snapshot.queuePaused;
    this.activePolicy = snapshot.activePolicy;
    this.governance = {
      policyLocked: snapshot.policyLocked,
      policyLockReason: snapshot.policyLockReason
    };

    for (const trace of snapshot.traces) {
      this.decisionTraces.set(trace.taskId, trace);
    }

    for (const record of snapshot.snapshots) {
      this.benchmarkSnapshots.push(this.toSavedSnapshot(record));
    }

    for (const state of snapshot.tasks.reverse()) {
      const restored = this.restoreState(state);
      this.tasks.set(restored.task.id, restored);
      if (restored.status === "queued") {
        this.queueExistingTask(restored);
      }
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.cpuPool?.destroy(), this.gpuPool?.destroy()]);
    this.repository.close();
  }

  submitTask(input: TaskSubmissionInput): PersistedTaskState {
    return this.createAndQueueTask(input);
  }

  seedTasks(): PersistedTaskState[] {
    const presets: TaskSubmissionInput[] = [
      { type: "vector_add", size: 256, priority: 2 },
      { type: "vector_add", size: 2048, priority: 1 },
      { type: "matrix_multiply", size: 4096, priority: 3 },
      { type: "matrix_multiply", size: 16384, priority: 2 }
    ];

    return presets.map((task) => this.submitTask(task));
  }

  cancelTask(taskId: string): PersistedTaskState {
    const state = this.tasks.get(taskId);
    if (!state) {
      throw new AppError(404, "Task not found.");
    }
    if (state.status !== "queued") {
      throw new AppError(409, "Only queued tasks can be canceled.");
    }

    const queueIndex = this.queue.findIndex((entry) => entry.task.id === taskId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    state.status = "canceled";
    state.executor = undefined;
    state.error = "Canceled before execution.";
    state.updatedAt = new Date().toISOString();
    this.repository.saveTask(state);
    this.updateDecisionTrace(taskId, {
      status: "canceled",
      completedAt: state.updatedAt,
      actualDurationMs: 0,
      queueWaitMs: this.getQueueWaitMs(state.task.submittedAt, state.updatedAt)
    });
    this.emitUpdate("task_canceled", this.toDashboardPayload());
    return state;
  }

  retryTask(taskId: string): PersistedTaskState {
    const state = this.tasks.get(taskId);
    if (!state) {
      throw new AppError(404, "Task not found.");
    }
    if (state.status === "queued" || state.status === "running") {
      throw new AppError(409, "Only completed, failed, or canceled tasks can be retried.");
    }

    return this.createAndQueueTask(
      {
        type: state.task.type,
        size: state.task.size,
        priority: state.task.priority,
        payload: state.task.payload
      },
      {
        attempt: state.attempt + 1,
        originTaskId: state.originTaskId ?? state.task.id
      },
      "task_retried"
    );
  }

  pauseQueue(): { queuePaused: boolean } {
    this.queuePaused = true;
    this.repository.setQueuePaused(true);
    this.emitUpdate("queue_paused", this.toDashboardPayload());
    return { queuePaused: true };
  }

  resumeQueue(): { queuePaused: boolean } {
    this.queuePaused = false;
    this.repository.setQueuePaused(false);
    this.emitUpdate("queue_resumed", this.toDashboardPayload());
    this.tryDispatch();
    return { queuePaused: false };
  }

  setActivePolicy(policy: SchedulerPolicy): { activePolicy: SchedulerPolicy } {
    if (this.governance.policyLocked) {
      throw new AppError(423, this.governance.policyLockReason ?? "Scheduler policy is locked.");
    }

    this.activePolicy = policy;
    this.repository.setSchedulerPolicy(policy);

    for (const entry of this.queue) {
      entry.decision = createSchedulerDecision(
        entry.task,
        this.metrics.getHistoricalMetrics(entry.task.type, entry.task.size),
        policy
      );
      this.updateDecisionTrace(entry.task.id, this.decisionPatch(entry.decision));
    }

    this.sortQueue();
    this.emitUpdate("policy_updated", this.toDashboardPayload());
    this.tryDispatch();
    return { activePolicy: policy };
  }

  setPolicyLock(locked: boolean, reason?: string): GovernanceState {
    this.governance = {
      policyLocked: locked,
      policyLockReason: locked ? reason || "Policy changes are locked for this workspace." : undefined
    };
    this.repository.setPolicyLock(this.governance.policyLocked, this.governance.policyLockReason);
    this.emitUpdate("policy_lock_updated", this.toDashboardPayload());
    return { ...this.governance };
  }

  getActivePolicy(): SchedulerPolicy {
    return this.activePolicy;
  }

  getGovernanceState(): GovernanceState {
    return { ...this.governance };
  }

  createBenchmarkSnapshot(name?: string): SavedBenchmarkSnapshot {
    const createdAt = new Date().toISOString();
    const summary = this.getBenchmarkSummary();
    const record = this.repository.createBenchmarkSnapshot({
      name: name?.trim() || `Snapshot ${new Date(createdAt).toLocaleString()}`,
      policyMode: this.activePolicy,
      createdAt,
      summaryJson: JSON.stringify(summary)
    });
    const snapshot = this.toSavedSnapshot(record);
    this.benchmarkSnapshots.unshift(snapshot);
    this.emitUpdate("benchmark_snapshot_created", this.toDashboardPayload());
    return snapshot;
  }

  listBenchmarkSnapshots(): SavedBenchmarkSnapshot[] {
    return [...this.benchmarkSnapshots];
  }

  async resetOperationalHistory(): Promise<{ cleared: true }> {
    if (this.inFlight.cpu > 0 || this.inFlight.gpu > 0) {
      throw new AppError(409, "Wait for running tasks to finish before clearing history.");
    }

    this.queue.splice(0, this.queue.length);
    this.tasks.clear();
    this.decisionTraces.clear();
    this.benchmarkSnapshots.splice(0, this.benchmarkSnapshots.length);
    this.metrics.reset();
    this.queuePaused = false;
    this.repository.clearOperationalHistory();
    await this.logger.reset();
    this.emitUpdate("history_cleared", this.toDashboardPayload());
    return { cleared: true };
  }

  listTaskStates(): PersistedTaskState[] {
    return [...this.tasks.values()].sort(
      (left, right) => Date.parse(right.task.submittedAt) - Date.parse(left.task.submittedAt)
    );
  }

  getTaskState(taskId: string): PersistedTaskState | undefined {
    return this.tasks.get(taskId);
  }

  getDecisionTrace(taskId: string): DecisionTraceRecord | undefined {
    return this.decisionTraces.get(taskId);
  }

  getBenchmarkSummary(): BenchmarkSummary {
    return this.benchmarkService.getSummary(this.getDecisionTraces());
  }

  getMetrics(): ReturnType<TaskService["toDashboardPayload"]>["metrics"] {
    return this.toDashboardPayload().metrics;
  }

  toDashboardPayload(): {
    summary: {
      queued: number;
      running: number;
      completed: number;
      failed: number;
      canceled: number;
      total: number;
      cpuAverageMs: number;
      gpuAverageMs: number;
    };
    system: {
      queuePaused: boolean;
      persistence: "sqlite";
      activePolicy: SchedulerPolicy;
      availablePolicies: SchedulerPolicy[];
      policyLocked: boolean;
      policyLockReason?: string;
    };
    executors: Array<{
      executor: "CPU" | "GPU";
      status: "ready" | "busy";
      activeTasks: number;
      maxConcurrency: number;
      queuePressure: number;
      capabilities: string[];
    }>;
    tasks: Array<{
      id: string;
      type: TaskType;
      size: number;
      priority: number;
      status: TaskStatus;
      executor: ExecutorType | "pending";
      durationMs: number | null;
      submittedAt: string;
      updatedAt: string;
      attempt: number;
      originTaskId?: string;
      error?: string;
      canCancel: boolean;
      canRetry: boolean;
    }>;
    queue: Array<{
      id: string;
      priority: number;
      type: TaskType;
      size: number;
      executor: ExecutorType;
      reason: string;
      sizeBucket: string;
    }>;
    metrics: {
      performance: Array<{ executor: string; averageMs: number; count: number }>;
      distribution: Array<{ name: string; value: number }>;
      timeline: Array<{ taskId: string; executor: ExecutorType; durationMs: number; status: string; completedAt: string }>;
    };
    explainability: {
      recentDecisions: Array<{
        taskId: string;
        policyMode: SchedulerPolicy;
        selectedExecutor: ExecutorType;
        baselineExecutor: ExecutorType;
        decisionMode: "heuristic" | "adaptive";
        sizeBucket: string;
        reason: string;
        cpuEstimateMs: number;
        gpuEstimateMs: number;
        projectedGainMs: number;
        queueWaitMs: number | null;
        actualDurationMs: number | null;
        status: TaskStatus;
      }>;
      benchmark: BenchmarkSummary;
      snapshots: SavedBenchmarkSnapshot[];
    };
  } {
    const taskStates = this.listTaskStates();
    const totals = this.metrics.getTotals();
    const cpuSummary = this.metrics.getExecutorSummary("cpu");
    const gpuSummary = this.metrics.getExecutorSummary("gpu");
    const traces = this.getDecisionTraces();

    return {
      summary: {
        queued: taskStates.filter((task) => task.status === "queued").length,
        running: taskStates.filter((task) => task.status === "running").length,
        completed: taskStates.filter((task) => task.status === "completed").length,
        failed: taskStates.filter((task) => task.status === "failed").length,
        canceled: taskStates.filter((task) => task.status === "canceled").length,
        total: taskStates.length,
        cpuAverageMs: Number((cpuSummary?.averageMs ?? 0).toFixed(2)),
        gpuAverageMs: Number((gpuSummary?.averageMs ?? 0).toFixed(2))
      },
      system: {
        queuePaused: this.queuePaused,
        persistence: "sqlite",
        activePolicy: this.activePolicy,
        availablePolicies: ["balanced", "latency", "throughput", "cpu_preferred"],
        policyLocked: this.governance.policyLocked,
        policyLockReason: this.governance.policyLockReason
      },
      executors: [
        {
          executor: "CPU",
          status: this.inFlight.cpu >= 4 ? "busy" : "ready",
          activeTasks: this.inFlight.cpu,
          maxConcurrency: 4,
          queuePressure: this.queue.filter((entry) => entry.decision.executor === "cpu").length,
          capabilities: ["parallel workers", "low-latency dispatch", "deterministic kernels"]
        },
        {
          executor: "GPU",
          status: this.inFlight.gpu >= 2 ? "busy" : "ready",
          activeTasks: this.inFlight.gpu,
          maxConcurrency: 2,
          queuePressure: this.queue.filter((entry) => entry.decision.executor === "gpu").length,
          capabilities: ["simulated accelerator", "high-throughput batches", "future Metal-ready abstraction"]
        }
      ],
      tasks: taskStates.map((state) => ({
        id: state.task.id,
        type: state.task.type,
        size: state.task.size,
        priority: state.task.priority,
        status: state.status,
        executor: state.executor ?? "pending",
        durationMs: state.result?.durationMs ?? null,
        submittedAt: state.task.submittedAt,
        updatedAt: state.updatedAt,
        attempt: state.attempt,
        originTaskId: state.originTaskId,
        error: state.error,
        canCancel: state.status === "queued",
        canRetry: state.status === "completed" || state.status === "failed" || state.status === "canceled"
      })),
      queue: this.queue.map(({ task, decision }) => ({
        id: task.id,
        priority: task.priority,
        type: task.type,
        size: task.size,
        executor: decision.executor,
        reason: decision.reason,
        sizeBucket: decision.sizeBucket
      })),
      metrics: {
        performance: [
          {
            executor: "CPU",
            averageMs: Number((cpuSummary?.averageMs ?? 0).toFixed(2)),
            count: cpuSummary?.count ?? 0
          },
          {
            executor: "GPU",
            averageMs: Number((gpuSummary?.averageMs ?? 0).toFixed(2)),
            count: gpuSummary?.count ?? 0
          }
        ],
        distribution: [
          { name: "CPU", value: totals.cpuTasks },
          { name: "GPU", value: totals.gpuTasks },
          { name: "Queued", value: taskStates.filter((task) => task.status === "queued").length },
          { name: "Running", value: taskStates.filter((task) => task.status === "running").length }
        ],
        timeline: this.metrics.getRecentRecords().slice(0, 10).reverse().map((record) => ({
          taskId: record.taskId,
          executor: record.executor,
          durationMs: Number(record.timeMs.toFixed(2)),
          status: record.status,
          completedAt: record.completedAt
        }))
      },
      explainability: {
        recentDecisions: traces.slice(0, 6).map((trace) => ({
          taskId: trace.taskId,
          policyMode: trace.policyMode,
          selectedExecutor: trace.selectedExecutor,
          baselineExecutor: trace.baselineExecutor,
          decisionMode: trace.decisionMode,
          sizeBucket: trace.sizeBucket,
          reason: trace.reason,
          cpuEstimateMs: Number(trace.cpuEstimateMs.toFixed(2)),
          gpuEstimateMs: Number(trace.gpuEstimateMs.toFixed(2)),
          projectedGainMs: Number(trace.projectedGainMs.toFixed(2)),
          queueWaitMs: trace.queueWaitMs == null ? null : Number(trace.queueWaitMs.toFixed(2)),
          actualDurationMs: trace.actualDurationMs == null ? null : Number(trace.actualDurationMs.toFixed(2)),
          status: trace.status
        })),
        benchmark: this.getBenchmarkSummary(),
        snapshots: this.listBenchmarkSnapshots()
      }
    };
  }

  private createAndQueueTask(
    input: TaskSubmissionInput,
    metadata?: {
      attempt?: number;
      originTaskId?: string;
    },
    eventName = "task_submitted"
  ): PersistedTaskState {
    const task = input.payload
      ? ({
          id: nanoid(),
          type: input.type,
          size: input.size,
          priority: input.priority,
          payload: input.payload,
          submittedAt: new Date().toISOString()
        } as ComputeTask)
      : createTask({
          id: nanoid(),
          type: input.type,
          size: input.size,
          priority: input.priority
        });

    const decision = createSchedulerDecision(
      task,
      this.metrics.getHistoricalMetrics(task.type, task.size),
      this.activePolicy
    );
    const state: PersistedTaskState = {
      task,
      status: "queued",
      updatedAt: new Date().toISOString(),
      attempt: metadata?.attempt ?? 1,
      originTaskId: metadata?.originTaskId,
      decisionReason: decision.reason
    };

    this.tasks.set(task.id, state);
    this.queue.push({ task, decision });
    this.sortQueue();
    this.repository.saveTask(state);
    this.saveDecisionTrace(task, decision, state.status);
    this.emitUpdate(eventName, this.toDashboardPayload());
    this.tryDispatch();
    return state;
  }

  private tryDispatch(): void {
    if (this.queuePaused) {
      return;
    }

    let progress = true;
    while (progress) {
      progress = false;
      for (let index = 0; index < this.queue.length; index += 1) {
        const entry = this.queue[index];
        const executor = entry.decision.executor;
        if (this.canDispatch(executor)) {
          this.queue.splice(index, 1);
          this.dispatch(entry);
          progress = true;
          break;
        }
      }
    }
  }

  private canDispatch(executor: ExecutorType): boolean {
    return executor === "cpu" ? this.inFlight.cpu < 4 : this.inFlight.gpu < 2;
  }

  private dispatch(entry: QueueEntry): void {
    const state = this.tasks.get(entry.task.id);
    if (!state) {
      return;
    }

    const dispatchedAt = new Date().toISOString();
    state.status = "running";
    state.executor = entry.decision.executor;
    state.decisionReason = entry.decision.reason;
    state.updatedAt = dispatchedAt;
    this.repository.saveTask(state);
    this.updateDecisionTrace(entry.task.id, {
      status: "running",
      dispatchedAt,
      queueWaitMs: this.getQueueWaitMs(state.task.submittedAt, dispatchedAt)
    });

    this.inFlight[entry.decision.executor] += 1;
    this.emitUpdate("task_running", this.toDashboardPayload());

    const pool = this.getWorkerPool(entry.decision.executor);
    void pool
      .execute(entry.task)
      .then(async (result) => {
        await this.handleResult(entry.task, result);
      })
      .catch(async (error: Error) => {
        await this.handleFailure(entry.task, entry.decision.executor, error);
      })
      .finally(() => {
        this.inFlight[entry.decision.executor] -= 1;
        this.tryDispatch();
      });
  }

  private async handleResult(task: ComputeTask, result: TaskResult): Promise<void> {
    const state = this.tasks.get(task.id);
    if (!state) {
      return;
    }

    state.status = "completed";
    state.executor = result.executor;
    state.result = result;
    state.error = undefined;
    state.updatedAt = result.completedAt;

    const record: ExecutionRecord = {
      taskId: task.id,
      executor: result.executor,
      timeMs: result.durationMs,
      status: "completed",
      taskType: task.type,
      size: task.size,
      priority: task.priority,
      startedAt: result.startedAt,
      completedAt: result.completedAt
    };

    this.metrics.record(record);
    this.repository.saveTask(state);
    this.repository.appendExecutionRecord(record);
    this.updateDecisionTrace(task.id, {
      status: "completed",
      completedAt: result.completedAt,
      actualDurationMs: result.durationMs
    });
    await this.logger.append(record);
    this.emitUpdate("task_completed", this.toDashboardPayload());
  }

  private async handleFailure(task: ComputeTask, executor: ExecutorType, error: Error): Promise<void> {
    const state = this.tasks.get(task.id);
    if (!state) {
      return;
    }

    state.status = "failed";
    state.executor = executor;
    state.error = error.message;
    state.updatedAt = new Date().toISOString();

    const record: ExecutionRecord = {
      taskId: task.id,
      executor,
      timeMs: 0,
      status: "failed",
      taskType: task.type,
      size: task.size,
      priority: task.priority,
      startedAt: state.updatedAt,
      completedAt: state.updatedAt,
      error: error.message
    };

    this.metrics.record(record);
    this.repository.saveTask(state);
    this.repository.appendExecutionRecord(record);
    this.updateDecisionTrace(task.id, {
      status: "failed",
      completedAt: state.updatedAt,
      actualDurationMs: 0
    });
    await this.logger.append(record);
    this.emitUpdate("task_failed", this.toDashboardPayload());
  }

  private sortQueue(): void {
    this.queue.sort((left, right) => {
      if (left.task.priority !== right.task.priority) {
        return right.task.priority - left.task.priority;
      }
      return Date.parse(left.task.submittedAt) - Date.parse(right.task.submittedAt);
    });
  }

  private emitUpdate(event: string, payload: ReturnType<TaskService["toDashboardPayload"]>): void {
    this.events.emit("update", {
      event,
      payload,
      emittedAt: new Date().toISOString()
    });
  }

  private restoreState(state: PersistedTaskState): PersistedTaskState {
    if (state.status !== "running") {
      return state;
    }

    const restored: PersistedTaskState = {
      ...state,
      status: "queued",
      executor: undefined,
      result: undefined,
      error: "Recovered after service restart.",
      updatedAt: new Date().toISOString()
    };
    this.repository.saveTask(restored);
    this.updateDecisionTrace(restored.task.id, {
      status: "queued",
      dispatchedAt: undefined,
      completedAt: undefined,
      actualDurationMs: undefined
    });
    return restored;
  }

  private queueExistingTask(state: PersistedTaskState): void {
    const decision = createSchedulerDecision(
      state.task,
      this.metrics.getHistoricalMetrics(state.task.type, state.task.size),
      this.activePolicy
    );
    state.decisionReason = decision.reason;
    state.updatedAt = new Date().toISOString();
    this.repository.saveTask(state);
    this.ensureDecisionTrace(state.task, decision, state.status);
    this.queue.push({ task: state.task, decision });
    this.sortQueue();
  }

  private ensureDecisionTrace(task: ComputeTask, decision: SchedulerDecision, status: TaskStatus): void {
    if (this.decisionTraces.has(task.id)) {
      return;
    }

    this.saveDecisionTrace(task, decision, status);
  }

  private saveDecisionTrace(task: ComputeTask, decision: SchedulerDecision, status: TaskStatus): void {
    const baselineExecutor = decision.executor === "cpu" ? "gpu" : "cpu";
    const baselineEstimateMs = baselineExecutor === "cpu" ? decision.cpuEstimateMs : decision.gpuEstimateMs;
    const chosenEstimateMs = decision.executor === "cpu" ? decision.cpuEstimateMs : decision.gpuEstimateMs;

    const trace: DecisionTraceRecord = {
      taskId: task.id,
      policyMode: decision.policyMode,
      recommendedExecutor: decision.executor,
      heuristicExecutor: decision.heuristicExecutor,
      decisionMode: decision.decisionMode,
      reason: decision.reason,
      sizeBucket: decision.sizeBucket,
      cpuEstimateMs: decision.cpuEstimateMs,
      gpuEstimateMs: decision.gpuEstimateMs,
      selectedExecutor: decision.executor,
      baselineExecutor,
      baselineEstimateMs,
      projectedGainMs: Math.max(0, baselineEstimateMs - chosenEstimateMs),
      decidedAt: task.submittedAt,
      status
    };

    this.decisionTraces.set(task.id, trace);
    this.repository.saveDecisionTrace(trace);
  }

  private updateDecisionTrace(taskId: string, updates: Partial<DecisionTraceRecord>): void {
    const existing = this.decisionTraces.get(taskId);
    if (!existing) {
      return;
    }

    const updated: DecisionTraceRecord = {
      ...existing,
      ...updates
    };
    this.decisionTraces.set(taskId, updated);
    this.repository.saveDecisionTrace(updated);
  }

  private decisionPatch(decision: SchedulerDecision): Partial<DecisionTraceRecord> {
    const baselineExecutor = decision.executor === "cpu" ? "gpu" : "cpu";
    const baselineEstimateMs = baselineExecutor === "cpu" ? decision.cpuEstimateMs : decision.gpuEstimateMs;
    const chosenEstimateMs = decision.executor === "cpu" ? decision.cpuEstimateMs : decision.gpuEstimateMs;
    return {
      policyMode: decision.policyMode,
      recommendedExecutor: decision.executor,
      heuristicExecutor: decision.heuristicExecutor,
      decisionMode: decision.decisionMode,
      reason: decision.reason,
      sizeBucket: decision.sizeBucket,
      cpuEstimateMs: decision.cpuEstimateMs,
      gpuEstimateMs: decision.gpuEstimateMs,
      selectedExecutor: decision.executor,
      baselineExecutor,
      baselineEstimateMs,
      projectedGainMs: Math.max(0, baselineEstimateMs - chosenEstimateMs)
    };
  }

  private toSavedSnapshot(record: BenchmarkSnapshotRecord): SavedBenchmarkSnapshot {
    return {
      id: record.id,
      name: record.name,
      policyMode: record.policyMode,
      createdAt: record.createdAt,
      summary: JSON.parse(record.summaryJson) as BenchmarkSummary
    };
  }

  private getQueueWaitMs(from: string, to: string): number {
    return Math.max(0, Date.parse(to) - Date.parse(from));
  }

  private getDecisionTraces(): DecisionTraceRecord[] {
    return [...this.decisionTraces.values()].sort((left, right) => {
      const leftTimestamp = left.completedAt ?? left.dispatchedAt ?? left.decidedAt;
      const rightTimestamp = right.completedAt ?? right.dispatchedAt ?? right.decidedAt;
      return Date.parse(rightTimestamp) - Date.parse(leftTimestamp);
    });
  }

  private getWorkerPool(executor: ExecutorType): WorkerPool {
    if (executor === "cpu") {
      this.cpuPool ??= new WorkerPool("cpu");
      return this.cpuPool;
    }

    this.gpuPool ??= new WorkerPool("gpu");
    return this.gpuPool;
  }
}
