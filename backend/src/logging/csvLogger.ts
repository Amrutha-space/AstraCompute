import { mkdir, stat, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionRecord } from "@astra/core-engine";

const HEADER = "task_id,executor,time_ms,status,task_type,size,priority,started_at,completed_at\n";

function toCsv(record: ExecutionRecord): string {
  return [
    record.taskId,
    record.executor,
    record.timeMs.toFixed(2),
    record.status,
    record.taskType,
    record.size,
    record.priority,
    record.startedAt,
    record.completedAt
  ].join(",") + "\n";
}

export class CsvLogger {
  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await stat(this.filePath);
    } catch {
      await writeFile(this.filePath, HEADER, "utf8");
    }
  }

  async append(record: ExecutionRecord): Promise<void> {
    await appendFile(this.filePath, toCsv(record), "utf8");
  }

  async reset(): Promise<void> {
    await writeFile(this.filePath, HEADER, "utf8");
  }
}
