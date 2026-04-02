export type SchedulerPolicy = "balanced" | "latency" | "throughput" | "cpu_preferred";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface DemoCredentials {
  name: string;
  email: string;
  password: string;
}

export interface HealthStatus {
  ok: boolean;
  service: string;
  authRequired: boolean;
  demoAccountAvailable: boolean;
  timestamp: string;
}

export interface DashboardSummary {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  canceled: number;
  total: number;
  cpuAverageMs: number;
  gpuAverageMs: number;
}

export interface DashboardSystemState {
  queuePaused: boolean;
  persistence: "sqlite";
  activePolicy: SchedulerPolicy;
  availablePolicies: SchedulerPolicy[];
  policyLocked: boolean;
  policyLockReason?: string;
}

export interface ExecutorCapability {
  executor: "CPU" | "GPU";
  status: "ready" | "busy";
  activeTasks: number;
  maxConcurrency: number;
  queuePressure: number;
  capabilities: string[];
}

export interface DashboardTask {
  id: string;
  type: "vector_add" | "matrix_multiply";
  size: number;
  priority: number;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  executor: "cpu" | "gpu" | "pending";
  durationMs: number | null;
  submittedAt: string;
  updatedAt: string;
  attempt: number;
  originTaskId?: string;
  error?: string;
  canCancel: boolean;
  canRetry: boolean;
}

export interface QueueTask {
  id: string;
  priority: number;
  type: "vector_add" | "matrix_multiply";
  size: number;
  executor: "cpu" | "gpu";
  reason: string;
  sizeBucket: string;
}

export interface DashboardMetrics {
  performance: Array<{ executor: string; averageMs: number; count: number }>;
  distribution: Array<{ name: string; value: number }>;
  timeline: Array<{ taskId: string; executor: "cpu" | "gpu"; durationMs: number; status: string; completedAt: string }>;
}

export interface DecisionTrace {
  taskId: string;
  policyMode: SchedulerPolicy;
  selectedExecutor: "cpu" | "gpu";
  baselineExecutor: "cpu" | "gpu";
  decisionMode: "heuristic" | "adaptive";
  sizeBucket: "small" | "medium" | "large";
  reason: string;
  cpuEstimateMs: number;
  gpuEstimateMs: number;
  projectedGainMs: number;
  queueWaitMs: number | null;
  actualDurationMs: number | null;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
}

export interface BenchmarkSummary {
  overview: {
    completedTasks: number;
    winRatePct: number;
    averageSpeedupPct: number;
    adaptiveSharePct: number;
    averageQueueWaitMs: number;
  };
  policyBreakdown: Array<{
    policyMode: SchedulerPolicy;
    completedTasks: number;
    winRatePct: number;
    averageSpeedupPct: number;
  }>;
  executorBreakdown: Array<{
    executor: "CPU" | "GPU";
    averageActualMs: number;
    averageEstimatedMs: number;
    count: number;
  }>;
  sizeBucketBreakdown: Array<{
    sizeBucket: string;
    averageActualMs: number;
    averageProjectedGainMs: number;
    count: number;
  }>;
}

export interface BenchmarkSnapshot {
  id: number;
  name: string;
  policyMode: SchedulerPolicy;
  createdAt: string;
  summary: BenchmarkSummary;
}

export interface DashboardPayload {
  summary: DashboardSummary;
  system: DashboardSystemState;
  executors: ExecutorCapability[];
  tasks: DashboardTask[];
  queue: QueueTask[];
  metrics: DashboardMetrics;
  explainability: {
    recentDecisions: DecisionTrace[];
    benchmark: BenchmarkSummary;
    snapshots: BenchmarkSnapshot[];
  };
}

export interface TaskFormInput {
  type: "vector_add" | "matrix_multiply";
  size: number;
  priority: number;
}
