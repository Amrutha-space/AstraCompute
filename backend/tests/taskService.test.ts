import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskRepository } from "../src/db/taskRepository.js";
import { CsvLogger } from "../src/logging/csvLogger.js";
import { TaskService } from "../src/services/taskService.js";

class InMemoryLogger extends CsvLogger {
  constructor() {
    super("/tmp/astra-test.csv");
  }

  override async initialize(): Promise<void> {}
  override async append(): Promise<void> {}
}

describe("TaskService", () => {
  let service: TaskService;
  let repository: TaskRepository;
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "astra-task-service-"));
    repository = new TaskRepository(path.join(tempDirectory, "astra.db"));
    service = new TaskService(new InMemoryLogger(), repository);
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it("sorts queued tasks by priority", () => {
    service.pauseQueue();
    for (let index = 0; index < 8; index += 1) {
      service.submitTask({ type: "vector_add", size: 256, priority: 1 });
    }
    service.submitTask({ type: "vector_add", size: 256, priority: 5 });
    const payload = service.toDashboardPayload();

    expect(payload.queue[0]?.priority).toBe(5);
  });

  it("returns dashboard metrics for seeded tasks", () => {
    service.pauseQueue();
    service.seedTasks();
    const payload = service.toDashboardPayload();

    expect(payload.summary.total).toBe(4);
    expect(payload.tasks.length).toBe(4);
    expect(payload.system.persistence).toBe("sqlite");
  });

  it("cancels queued tasks and exposes retry metadata", () => {
    service.pauseQueue();
    const state = service.submitTask({ type: "vector_add", size: 256, priority: 3 });
    const canceled = service.cancelTask(state.task.id);
    const retried = service.retryTask(state.task.id);

    expect(canceled.status).toBe("canceled");
    expect(retried.status).toBe("queued");
    expect(retried.originTaskId).toBe(state.task.id);
    expect(retried.attempt).toBe(2);
  });

  it("restores paused queue and queued tasks from SQLite", async () => {
    service.pauseQueue();
    service.setActivePolicy("throughput");
    const queued = service.submitTask({ type: "matrix_multiply", size: 4096, priority: 4 });
    await service.shutdown();

    repository = new TaskRepository(path.join(tempDirectory, "astra.db"));
    service = new TaskService(new InMemoryLogger(), repository);
    await service.initialize();

    const restored = service.getTaskState(queued.task.id);
    const payload = service.toDashboardPayload();

    expect(restored?.status).toBe("queued");
    expect(payload.system.queuePaused).toBe(true);
    expect(payload.system.activePolicy).toBe("throughput");
    expect(payload.queue.some((entry) => entry.id === queued.task.id)).toBe(true);
  });

  it("stores decision traces for submitted tasks", () => {
    service.pauseQueue();
    const submitted = service.submitTask({ type: "vector_add", size: 128, priority: 2 });

    const trace = service.getDecisionTrace(submitted.task.id);

    expect(trace).toBeDefined();
    expect(trace?.reason.length).toBeGreaterThan(0);
    expect(trace?.cpuEstimateMs).toBeGreaterThan(0);
    expect(trace?.status).toBe("queued");
  });

  it("updates and reports the active scheduler policy", () => {
    const updated = service.setActivePolicy("latency");
    const payload = service.toDashboardPayload();

    expect(updated.activePolicy).toBe("latency");
    expect(payload.system.activePolicy).toBe("latency");
  });

  it("locks policy changes and persists governance state", async () => {
    service.setPolicyLock(true, "Ops freeze");

    expect(() => service.setActivePolicy("throughput")).toThrowError(/Ops freeze/);
    expect(service.toDashboardPayload().system.policyLocked).toBe(true);

    await service.shutdown();

    repository = new TaskRepository(path.join(tempDirectory, "astra.db"));
    service = new TaskService(new InMemoryLogger(), repository);
    await service.initialize();

    expect(service.getGovernanceState().policyLocked).toBe(true);
    expect(service.getGovernanceState().policyLockReason).toBe("Ops freeze");
  });

  it("creates benchmark snapshots from current summary", () => {
    const snapshot = service.createBenchmarkSnapshot("Morning run");
    const payload = service.toDashboardPayload();

    expect(snapshot.name).toBe("Morning run");
    expect(payload.explainability.snapshots[0]?.name).toBe("Morning run");
  });

  it("clears persisted operational history without touching workspace policy", async () => {
    service.pauseQueue();
    service.setActivePolicy("throughput");
    service.submitTask({ type: "vector_add", size: 512, priority: 3 });
    service.createBenchmarkSnapshot("Before reset");

    const result = await service.resetOperationalHistory();
    const payload = service.toDashboardPayload();

    expect(result.cleared).toBe(true);
    expect(payload.summary.total).toBe(0);
    expect(payload.queue).toHaveLength(0);
    expect(payload.explainability.snapshots).toHaveLength(0);
    expect(payload.system.activePolicy).toBe("throughput");
    expect(payload.system.queuePaused).toBe(false);
  });
});
