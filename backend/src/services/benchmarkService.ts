import type { DecisionTraceRecord } from "../db/taskRepository.js";

export interface BenchmarkSummary {
  overview: {
    completedTasks: number;
    winRatePct: number;
    averageSpeedupPct: number;
    adaptiveSharePct: number;
    averageQueueWaitMs: number;
  };
  policyBreakdown: Array<{
    policyMode: string;
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

function round(value: number): number {
  return Number(value.toFixed(2));
}

export class BenchmarkService {
  getSummary(traces: DecisionTraceRecord[]): BenchmarkSummary {
    const completed = traces.filter((trace) => typeof trace.actualDurationMs === "number" && trace.status === "completed");
    const adaptiveCount = traces.filter((trace) => trace.decisionMode === "adaptive").length;
    const averageQueueWaitMs =
      traces.length === 0
        ? 0
        : round(
            traces.reduce((sum, trace) => sum + (trace.queueWaitMs ?? 0), 0) /
              Math.max(1, traces.filter((trace) => typeof trace.queueWaitMs === "number").length)
          );

    const winRatePct =
      completed.length === 0
        ? 0
        : round(
            (completed.filter((trace) => (trace.actualDurationMs ?? Number.POSITIVE_INFINITY) <= trace.baselineEstimateMs).length /
              completed.length) *
              100
          );

    const averageSpeedupPct =
      completed.length === 0
        ? 0
        : round(
            completed.reduce((sum, trace) => {
              const actual = trace.actualDurationMs ?? trace.baselineEstimateMs;
              if (trace.baselineEstimateMs <= 0) {
                return sum;
              }
              return sum + ((trace.baselineEstimateMs - actual) / trace.baselineEstimateMs) * 100;
            }, 0) / completed.length
          );

    const executorBreakdown = (["cpu", "gpu"] as const).map((executor) => {
      const executorCompleted = completed.filter((trace) => trace.selectedExecutor === executor);
      const averageActualMs =
        executorCompleted.length === 0
          ? 0
          : round(executorCompleted.reduce((sum, trace) => sum + (trace.actualDurationMs ?? 0), 0) / executorCompleted.length);
      const averageEstimatedMs =
        executorCompleted.length === 0
          ? 0
          : round(
              executorCompleted.reduce((sum, trace) => {
                const estimate = executor === "cpu" ? trace.cpuEstimateMs : trace.gpuEstimateMs;
                return sum + estimate;
              }, 0) / executorCompleted.length
            );

      return {
        executor: executor.toUpperCase() as "CPU" | "GPU",
        averageActualMs,
        averageEstimatedMs,
        count: executorCompleted.length
      };
    });

    const policyBreakdown = ["balanced", "latency", "throughput", "cpu_preferred"].map((policyMode) => {
      const policyCompleted = completed.filter((trace) => trace.policyMode === policyMode);
      const winRate =
        policyCompleted.length === 0
          ? 0
          : round(
              (policyCompleted.filter((trace) => (trace.actualDurationMs ?? Number.POSITIVE_INFINITY) <= trace.baselineEstimateMs)
                .length /
                policyCompleted.length) *
                100
            );
      const averageSpeedup =
        policyCompleted.length === 0
          ? 0
          : round(
              policyCompleted.reduce((sum, trace) => {
                const actual = trace.actualDurationMs ?? trace.baselineEstimateMs;
                if (trace.baselineEstimateMs <= 0) {
                  return sum;
                }
                return sum + ((trace.baselineEstimateMs - actual) / trace.baselineEstimateMs) * 100;
              }, 0) / policyCompleted.length
            );

      return {
        policyMode,
        completedTasks: policyCompleted.length,
        winRatePct: winRate,
        averageSpeedupPct: averageSpeedup
      };
    });

    const sizeBucketBreakdown = ["small", "medium", "large"].map((sizeBucket) => {
      const bucketTraces = completed.filter((trace) => trace.sizeBucket === sizeBucket);
      return {
        sizeBucket,
        averageActualMs:
          bucketTraces.length === 0
            ? 0
            : round(bucketTraces.reduce((sum, trace) => sum + (trace.actualDurationMs ?? 0), 0) / bucketTraces.length),
        averageProjectedGainMs:
          bucketTraces.length === 0
            ? 0
            : round(bucketTraces.reduce((sum, trace) => sum + trace.projectedGainMs, 0) / bucketTraces.length),
        count: bucketTraces.length
      };
    });

    return {
      overview: {
        completedTasks: completed.length,
        winRatePct,
        averageSpeedupPct,
        adaptiveSharePct: traces.length === 0 ? 0 : round((adaptiveCount / traces.length) * 100),
        averageQueueWaitMs
      },
      policyBreakdown,
      executorBreakdown,
      sizeBucketBreakdown
    };
  }
}
