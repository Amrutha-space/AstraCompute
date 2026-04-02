import { getSizeBucket, type ExecutionRecord, type ExecutorType, type HistoricalMetrics, type RuntimeStats, type SizeBucket, type TaskType } from "@astra/core-engine";

interface MutableStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

function toRuntimeStats(stats: MutableStats | undefined): RuntimeStats | null {
  if (!stats) {
    return null;
  }

  return {
    count: stats.count,
    averageMs: stats.totalMs / stats.count,
    minMs: stats.minMs,
    maxMs: stats.maxMs
  };
}

export class MetricsStore {
  private readonly historical = new Map<string, MutableStats>();
  private readonly totals = {
    cpuTasks: 0,
    gpuTasks: 0,
    completed: 0,
    failed: 0
  };
  private readonly recent: ExecutionRecord[] = [];

  record(record: ExecutionRecord): void {
    const key = this.buildKey(record.taskType, getSizeBucket(record.size), record.executor);
    const stats = this.historical.get(key) ?? {
      count: 0,
      totalMs: 0,
      minMs: Number.POSITIVE_INFINITY,
      maxMs: 0
    };

    stats.count += 1;
    stats.totalMs += record.timeMs;
    stats.minMs = Math.min(stats.minMs, record.timeMs);
    stats.maxMs = Math.max(stats.maxMs, record.timeMs);
    this.historical.set(key, stats);

    if (record.executor === "cpu") {
      this.totals.cpuTasks += 1;
    } else {
      this.totals.gpuTasks += 1;
    }

    if (record.status === "completed") {
      this.totals.completed += 1;
    } else {
      this.totals.failed += 1;
    }

    this.recent.unshift(record);
    if (this.recent.length > 50) {
      this.recent.pop();
    }
  }

  restore(records: ExecutionRecord[]): void {
    for (const record of records) {
      this.record(record);
    }
  }

  getHistoricalMetrics(taskType: TaskType, size: number): HistoricalMetrics {
    const bucket = getSizeBucket(size);
    return {
      cpu: this.getStats(taskType, bucket, "cpu"),
      gpu: this.getStats(taskType, bucket, "gpu")
    };
  }

  getExecutorSummary(executor: ExecutorType): RuntimeStats | null {
    const records = Array.from(this.historical.entries())
      .filter(([key]) => key.endsWith(`:${executor}`))
      .map(([, value]) => value);

    if (records.length === 0) {
      return null;
    }

    const aggregate = records.reduce(
      (accumulator, entry) => {
        accumulator.count += entry.count;
        accumulator.totalMs += entry.totalMs;
        accumulator.minMs = Math.min(accumulator.minMs, entry.minMs);
        accumulator.maxMs = Math.max(accumulator.maxMs, entry.maxMs);
        return accumulator;
      },
      {
        count: 0,
        totalMs: 0,
        minMs: Number.POSITIVE_INFINITY,
        maxMs: 0
      }
    );

    return {
      count: aggregate.count,
      averageMs: aggregate.totalMs / aggregate.count,
      minMs: aggregate.minMs,
      maxMs: aggregate.maxMs
    };
  }

  getRecentRecords(): ExecutionRecord[] {
    return [...this.recent];
  }

  getTotals(): { cpuTasks: number; gpuTasks: number; completed: number; failed: number } {
    return { ...this.totals };
  }

  reset(): void {
    this.historical.clear();
    this.totals.cpuTasks = 0;
    this.totals.gpuTasks = 0;
    this.totals.completed = 0;
    this.totals.failed = 0;
    this.recent.splice(0, this.recent.length);
  }

  private getStats(taskType: TaskType, bucket: SizeBucket, executor: ExecutorType): RuntimeStats | null {
    return toRuntimeStats(this.historical.get(this.buildKey(taskType, bucket, executor)));
  }

  private buildKey(taskType: TaskType, bucket: SizeBucket, executor: ExecutorType): string {
    return `${taskType}:${bucket}:${executor}`;
  }
}
