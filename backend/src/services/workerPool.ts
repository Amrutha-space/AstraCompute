import os from "node:os";
import { Worker } from "node:worker_threads";
import type { ComputeTask, ExecutorType, TaskResult, WorkerExecutionResponse } from "@astra/core-engine";

interface QueueItem {
  task: ComputeTask;
  resolve: (result: TaskResult) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
}

export class WorkerPool {
  private readonly slots: WorkerSlot[];
  private readonly queue: QueueItem[] = [];

  constructor(
    private readonly executor: ExecutorType,
    size = executor === "cpu" ? Math.max(2, os.availableParallelism() - 1) : 2
  ) {
    const isTypeScriptRuntime = import.meta.url.endsWith(".ts");
    const workerUrl = isTypeScriptRuntime
      ? new URL("../workers/tsx-worker-bootstrap.mjs", import.meta.url)
      : new URL("../workers/executor.worker.js", import.meta.url);
    this.slots = Array.from({ length: size }, () => ({
      worker: new Worker(workerUrl, {
        execArgv: isTypeScriptRuntime ? [] : process.execArgv,
        workerData: isTypeScriptRuntime
          ? {
              workerModuleUrl: new URL("../workers/executor.worker.ts", import.meta.url).href
            }
          : undefined
      }),
      busy: false
    }));
  }

  execute(task: ComputeTask): Promise<TaskResult> {
    return new Promise<TaskResult>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(this.slots.map(({ worker }) => worker.terminate()));
  }

  private processQueue(): void {
    const slot = this.slots.find((entry) => !entry.busy);
    const queuedItem = this.queue.shift();

    if (!slot || !queuedItem) {
      if (queuedItem) {
        this.queue.unshift(queuedItem);
      }
      return;
    }

    slot.busy = true;
    const { worker } = slot;

    const cleanup = () => {
      worker.removeAllListeners("message");
      worker.removeAllListeners("error");
      slot.busy = false;
      this.processQueue();
    };

    worker.once("message", (message: WorkerExecutionResponse) => {
      cleanup();
      queuedItem.resolve(message.result);
    });

    worker.once("error", (error) => {
      cleanup();
      queuedItem.reject(error);
    });

    worker.postMessage({
      task: queuedItem.task,
      executor: this.executor
    });
  }
}
