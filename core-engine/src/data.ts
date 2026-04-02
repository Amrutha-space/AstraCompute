import type { ComputeTask, MatrixMultiplyPayload, TaskType, VectorAddPayload } from "./types.js";

export function createVectorPayload(size: number): VectorAddPayload {
  const a = Array.from({ length: size }, (_, index) => (index % 97) + 1);
  const b = Array.from({ length: size }, (_, index) => ((index * 2) % 89) + 1);
  return { a, b };
}

export function createMatrixPayload(size: number): MatrixMultiplyPayload {
  const dimension = Math.max(2, Math.floor(Math.sqrt(size)));
  const a = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => ((row + column) % 11) + 1)
  );
  const b = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => ((row * 2 + column) % 13) + 1)
  );
  return { a, b };
}

export function createTask(input: {
  id: string;
  type: TaskType;
  size: number;
  priority: number;
}): ComputeTask {
  const payload = input.type === "vector_add" ? createVectorPayload(input.size) : createMatrixPayload(input.size);

  return {
    ...input,
    payload,
    submittedAt: new Date().toISOString()
  } as ComputeTask;
}

