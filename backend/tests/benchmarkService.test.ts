import { describe, expect, it } from "vitest";
import { BenchmarkService } from "../src/services/benchmarkService.js";
import type { DecisionTraceRecord } from "../src/db/taskRepository.js";

describe("BenchmarkService", () => {
  it("computes win rate and average speedup from completed traces", () => {
    const service = new BenchmarkService();
    const traces: DecisionTraceRecord[] = [
      {
        taskId: "task-a",
        policyMode: "latency",
        recommendedExecutor: "gpu",
        heuristicExecutor: "cpu",
        decisionMode: "adaptive",
        reason: "Adaptive routing selected GPU.",
        sizeBucket: "large",
        cpuEstimateMs: 120,
        gpuEstimateMs: 70,
        selectedExecutor: "gpu",
        baselineExecutor: "cpu",
        baselineEstimateMs: 120,
        projectedGainMs: 50,
        decidedAt: "2026-03-31T10:00:00.000Z",
        dispatchedAt: "2026-03-31T10:00:00.050Z",
        completedAt: "2026-03-31T10:00:00.130Z",
        queueWaitMs: 50,
        actualDurationMs: 80,
        status: "completed"
      },
      {
        taskId: "task-b",
        policyMode: "cpu_preferred",
        recommendedExecutor: "cpu",
        heuristicExecutor: "cpu",
        decisionMode: "heuristic",
        reason: "Heuristic routing selected CPU.",
        sizeBucket: "small",
        cpuEstimateMs: 12,
        gpuEstimateMs: 18,
        selectedExecutor: "cpu",
        baselineExecutor: "gpu",
        baselineEstimateMs: 18,
        projectedGainMs: 6,
        decidedAt: "2026-03-31T10:05:00.000Z",
        dispatchedAt: "2026-03-31T10:05:00.010Z",
        completedAt: "2026-03-31T10:05:00.030Z",
        queueWaitMs: 10,
        actualDurationMs: 14,
        status: "completed"
      }
    ];

    const summary = service.getSummary(traces);

    expect(summary.overview.completedTasks).toBe(2);
    expect(summary.overview.winRatePct).toBe(100);
    expect(summary.overview.averageSpeedupPct).toBeGreaterThan(0);
    expect(summary.executorBreakdown.find((entry) => entry.executor === "GPU")?.count).toBe(1);
    expect(summary.policyBreakdown.find((entry) => entry.policyMode === "latency")?.completedTasks).toBe(1);
    expect(summary.policyBreakdown.find((entry) => entry.policyMode === "cpu_preferred")?.completedTasks).toBe(1);
  });
});
