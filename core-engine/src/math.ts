import type { MatrixMultiplyPayload, VectorAddPayload } from "./types.js";

export function vectorAdd(payload: VectorAddPayload): number[] {
  const { a, b } = payload;
  if (a.length !== b.length) {
    throw new Error("Vector operands must have the same length.");
  }

  const output = new Array<number>(a.length);
  for (let index = 0; index < a.length; index += 1) {
    output[index] = a[index] + b[index];
  }

  return output;
}

export function matrixMultiply(payload: MatrixMultiplyPayload): number[][] {
  const { a, b } = payload;
  if (a.length === 0 || b.length === 0) {
    throw new Error("Matrices must be non-empty.");
  }

  const sharedDimension = a[0].length;
  if (sharedDimension !== b.length) {
    throw new Error("Matrix dimensions are incompatible for multiplication.");
  }

  for (const row of a) {
    if (row.length !== sharedDimension) {
      throw new Error("Matrix A contains inconsistent row lengths.");
    }
  }

  const columnCount = b[0].length;
  for (const row of b) {
    if (row.length !== columnCount) {
      throw new Error("Matrix B contains inconsistent row lengths.");
    }
  }

  const output = Array.from({ length: a.length }, () => Array<number>(columnCount).fill(0));
  for (let row = 0; row < a.length; row += 1) {
    for (let shared = 0; shared < sharedDimension; shared += 1) {
      const factor = a[row][shared];
      for (let column = 0; column < columnCount; column += 1) {
        output[row][column] += factor * b[shared][column];
      }
    }
  }

  return output;
}

