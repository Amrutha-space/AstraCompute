import { describe, expect, it } from "vitest";
import { createSchedulerDecision } from "../src/scheduler.js";
import { createTask } from "../src/data.js";

describe("createSchedulerDecision", () => {
  it("routes small tasks to CPU before history exists", () => {
    const decision = createSchedulerDecision(
      createTask({ id: "t1", type: "vector_add", size: 128, priority: 1 }),
      { cpu: null, gpu: null }
    );

    expect(decision.executor).toBe("cpu");
  });

  it("routes large tasks to GPU before history exists", () => {
    const decision = createSchedulerDecision(
      createTask({ id: "t2", type: "matrix_multiply", size: 8192, priority: 1 }),
      { cpu: null, gpu: null }
    );

    expect(decision.executor).toBe("gpu");
  });

  it("uses historical data to override the default heuristic", () => {
    const decision = createSchedulerDecision(
      createTask({ id: "t3", type: "matrix_multiply", size: 8192, priority: 1 }),
      {
        cpu: { count: 8, averageMs: 80, minMs: 60, maxMs: 120 },
        gpu: { count: 8, averageMs: 120, minMs: 100, maxMs: 140 }
      }
    );

    expect(decision.executor).toBe("cpu");
    expect(decision.reason).toContain("balanced policy");
  });

  it("supports cpu preferred policy bias", () => {
    const decision = createSchedulerDecision(
      createTask({ id: "t4", type: "vector_add", size: 4096, priority: 1 }),
      {
        cpu: { count: 8, averageMs: 40, minMs: 35, maxMs: 50 },
        gpu: { count: 8, averageMs: 32, minMs: 28, maxMs: 36 }
      },
      "cpu_preferred"
    );

    expect(decision.executor).toBe("cpu");
    expect(decision.policyMode).toBe("cpu_preferred");
  });
});
