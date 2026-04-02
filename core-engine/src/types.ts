export type TaskType = "vector_add" | "matrix_multiply";
export type ExecutorType = "cpu" | "gpu";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type SchedulerPolicy = "balanced" | "latency" | "throughput" | "cpu_preferred";

export interface BaseTask<TPayload> {
  id: string;
  type: TaskType;
  size: number;
  priority: number;
  payload: TPayload;
  submittedAt: string;
}

export interface VectorAddPayload {
  a: number[];
  b: number[];
}

export interface MatrixMultiplyPayload {
  a: number[][];
  b: number[][];
}

export type TaskPayload = VectorAddPayload | MatrixMultiplyPayload;

export type ComputeTask =
  | BaseTask<VectorAddPayload>
  | BaseTask<MatrixMultiplyPayload>;

export interface ExecutionRecord {
  taskId: string;
  executor: ExecutorType;
  timeMs: number;
  status: Extract<TaskStatus, "completed" | "failed">;
  taskType: TaskType;
  size: number;
  priority: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface TaskResult {
  taskId: string;
  executor: ExecutorType;
  durationMs: number;
  output: number[] | number[][];
  startedAt: string;
  completedAt: string;
}

export interface TaskState {
  task: ComputeTask;
  status: TaskStatus;
  executor?: ExecutorType;
  result?: TaskResult;
  error?: string;
}

export interface SchedulerDecision {
  executor: ExecutorType;
  heuristicExecutor: ExecutorType;
  decisionMode: "heuristic" | "adaptive";
  policyMode: SchedulerPolicy;
  reason: string;
  cpuEstimateMs: number;
  gpuEstimateMs: number;
  sizeBucket: SizeBucket;
}

export type SizeBucket = "small" | "medium" | "large";

export interface RuntimeStats {
  count: number;
  averageMs: number;
  minMs: number;
  maxMs: number;
}

export interface HistoricalMetrics {
  cpu: RuntimeStats | null;
  gpu: RuntimeStats | null;
}

export interface WorkerExecutionRequest {
  task: ComputeTask;
  executor: ExecutorType;
}

export interface WorkerExecutionResponse {
  result: TaskResult;
}
