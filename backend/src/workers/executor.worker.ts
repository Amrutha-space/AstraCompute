import { parentPort } from "node:worker_threads";
import {
  matrixMultiply,
  vectorAdd,
  type ComputeTask,
  type ExecutorType,
  type MatrixMultiplyPayload,
  type VectorAddPayload,
  type WorkerExecutionRequest,
  type WorkerExecutionResponse
} from "@astra/core-engine";

if (!parentPort) {
  throw new Error("Worker must be launched with a parent port.");
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function getSimulatedDuration(task: ComputeTask, executor: ExecutorType, actualComputeMs: number): number {
  const normalizedSize = Math.max(1, task.size);

  if (executor === "cpu") {
    const target = task.type === "vector_add" ? 6 + normalizedSize * 0.003 : 14 + normalizedSize * 0.02;
    return Math.max(actualComputeMs, target);
  }

  const gpuTarget = task.type === "vector_add" ? 9 + normalizedSize * 0.0012 : 12 + normalizedSize * 0.006;
  return Math.max(actualComputeMs * 0.8, gpuTarget);
}

async function executeTask(task: ComputeTask, executor: ExecutorType): Promise<WorkerExecutionResponse> {
  const startedAt = new Date().toISOString();
  const timerStart = performance.now();
  const output =
    task.type === "vector_add"
      ? vectorAdd(task.payload as VectorAddPayload)
      : matrixMultiply(task.payload as MatrixMultiplyPayload);
  const computeMs = performance.now() - timerStart;
  const simulatedDurationMs = getSimulatedDuration(task, executor, computeMs);
  const remainingDelay = Math.max(0, simulatedDurationMs - computeMs);

  if (remainingDelay > 0) {
    await sleep(remainingDelay);
  }

  const completedAt = new Date().toISOString();

  return {
    result: {
      taskId: task.id,
      executor,
      durationMs: Number(simulatedDurationMs.toFixed(2)),
      output,
      startedAt,
      completedAt
    }
  };
}

parentPort.on("message", async (message: WorkerExecutionRequest) => {
  try {
    const response = await executeTask(message.task, message.executor);
    parentPort?.postMessage(response);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Worker execution failed.";
    throw new Error(messageText);
  }
});
