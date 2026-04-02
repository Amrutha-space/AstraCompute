import type {
  ComputeTask,
  HistoricalMetrics,
  RuntimeStats,
  SchedulerDecision,
  SchedulerPolicy,
  SizeBucket,
  TaskType
} from "./types.js";

const CPU_BASE_COST: Record<TaskType, number> = {
  vector_add: 4,
  matrix_multiply: 12
};

const GPU_BASE_COST: Record<TaskType, number> = {
  vector_add: 10,
  matrix_multiply: 16
};

const CPU_SCALE: Record<TaskType, number> = {
  vector_add: 0.004,
  matrix_multiply: 0.03
};

const GPU_SCALE: Record<TaskType, number> = {
  vector_add: 0.0015,
  matrix_multiply: 0.008
};

export function getSizeBucket(size: number): SizeBucket {
  if (size < 512) {
    return "small";
  }
  if (size < 4096) {
    return "medium";
  }
  return "large";
}

function estimateFromHistory(stats: RuntimeStats | null, fallbackMs: number): number {
  return stats?.averageMs ?? fallbackMs;
}

export function createSchedulerDecision(
  task: ComputeTask,
  historicalMetrics: HistoricalMetrics,
  policy: SchedulerPolicy = "balanced"
): SchedulerDecision {
  const sizeBucket = getSizeBucket(task.size);
  const cpuEstimateMs = estimateFromHistory(
    historicalMetrics.cpu,
    CPU_BASE_COST[task.type] + task.size * CPU_SCALE[task.type]
  );
  const gpuEstimateMs = estimateFromHistory(
    historicalMetrics.gpu,
    GPU_BASE_COST[task.type] + task.size * GPU_SCALE[task.type]
  );

  const heuristicExecutor = task.size < 2048 ? "cpu" : "gpu";
  const adaptiveExecutor = cpuEstimateMs <= gpuEstimateMs ? "cpu" : "gpu";
  const policyExecutor = selectExecutorForPolicy(
    policy,
    heuristicExecutor,
    adaptiveExecutor,
    cpuEstimateMs,
    gpuEstimateMs,
    Boolean(historicalMetrics.cpu || historicalMetrics.gpu)
  );
  const decisionMode = policyExecutor === heuristicExecutor ? "heuristic" : "adaptive";
  const reason = createReason(policyExecutor, heuristicExecutor, sizeBucket, task.type, cpuEstimateMs, gpuEstimateMs, policy);

  return {
    executor: policyExecutor,
    heuristicExecutor,
    decisionMode,
    policyMode: policy,
    reason,
    cpuEstimateMs,
    gpuEstimateMs,
    sizeBucket
  };
}

function selectExecutorForPolicy(
  policy: SchedulerPolicy,
  heuristicExecutor: "cpu" | "gpu",
  adaptiveExecutor: "cpu" | "gpu",
  cpuEstimateMs: number,
  gpuEstimateMs: number,
  hasHistory: boolean
): "cpu" | "gpu" {
  switch (policy) {
    case "latency":
      return adaptiveExecutor;
    case "throughput":
      return gpuEstimateMs <= cpuEstimateMs * 1.15 ? "gpu" : "cpu";
    case "cpu_preferred":
      return gpuEstimateMs < cpuEstimateMs * 0.7 ? "gpu" : "cpu";
    case "balanced":
    default:
      return hasHistory ? adaptiveExecutor : heuristicExecutor;
  }
}

function createReason(
  executor: "cpu" | "gpu",
  heuristicExecutor: "cpu" | "gpu",
  sizeBucket: SizeBucket,
  taskType: TaskType,
  cpuEstimateMs: number,
  gpuEstimateMs: number,
  policy: SchedulerPolicy
): string {
  if (executor === heuristicExecutor && policy === "balanced") {
    return `Heuristic routing selected ${executor.toUpperCase()} for a ${sizeBucket} ${taskType} workload.`;
  }

  return `${policy.replace("_", " ")} policy selected ${executor.toUpperCase()} (${cpuEstimateMs.toFixed(1)}ms CPU vs ${gpuEstimateMs.toFixed(1)}ms GPU).`;
}
