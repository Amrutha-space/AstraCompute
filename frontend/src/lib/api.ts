import type {
  AuthSession,
  AuthUser,
  BenchmarkSnapshot,
  BenchmarkSummary,
  DashboardPayload,
  DecisionTrace,
  DemoCredentials,
  ExecutorCapability,
  HealthStatus,
  SchedulerPolicy,
  TaskFormInput
} from "../types";

function resolveApiBase(): string {
  const configuredBase = import.meta.env.VITE_API_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  return "/api";
}

const apiBase = resolveApiBase();

let authToken: string | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ message: "Request failed." }))) as { message?: string };
    throw new ApiError(payload.message ?? "Request failed.", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers
  });

  return handleResponse<T>(response);
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${apiBase}/health`);
  return handleResponse<HealthStatus>(response);
}

export async function fetchDemoCredentials(): Promise<DemoCredentials> {
  const response = await fetch(`${apiBase}/auth/demo`);
  return handleResponse<DemoCredentials>(response);
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function logIn(input: { email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export async function logOut(): Promise<void> {
  await request<void>("/auth/logout", {
    method: "POST"
  });
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  return request<DashboardPayload>("/dashboard");
}

export async function submitTask(input: TaskFormInput): Promise<void> {
  await request<void>("/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function seedTasks(): Promise<void> {
  await request<void>("/tasks/seed", {
    method: "POST"
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  await request<void>(`/tasks/${taskId}/cancel`, {
    method: "POST"
  });
}

export async function retryTask(taskId: string): Promise<void> {
  await request<void>(`/tasks/${taskId}/retry`, {
    method: "POST"
  });
}

export async function pauseQueue(): Promise<void> {
  await request<void>("/queue/pause", {
    method: "POST"
  });
}

export async function resumeQueue(): Promise<void> {
  await request<void>("/queue/resume", {
    method: "POST"
  });
}

export async function resetOperationalHistory(): Promise<void> {
  await request<void>("/system/reset-history", {
    method: "POST"
  });
}

export async function fetchBenchmarks(): Promise<BenchmarkSummary> {
  return request<BenchmarkSummary>("/benchmarks");
}

export async function fetchDecisionTrace(taskId: string): Promise<DecisionTrace> {
  return request<DecisionTrace>(`/tasks/${taskId}/decision`);
}

export async function updatePolicy(policy: SchedulerPolicy): Promise<void> {
  await request<void>("/policy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ policy })
  });
}

export async function updatePolicyLock(locked: boolean, reason?: string): Promise<void> {
  await request<void>("/policy/lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ locked, reason })
  });
}

export async function createBenchmarkSnapshot(name?: string): Promise<BenchmarkSnapshot> {
  return request<BenchmarkSnapshot>("/benchmarks/snapshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(name ? { name } : {})
  });
}

export async function fetchExecutors(): Promise<ExecutorCapability[]> {
  return request<ExecutorCapability[]>("/executors");
}

export function createDashboardStream(onMessage: (payload: DashboardPayload) => void): EventSource {
  const streamUrl = `${apiBase}/stream`;
  const url = streamUrl.startsWith("http")
    ? new URL(streamUrl)
    : new URL(streamUrl, window.location.origin);
  if (authToken) {
    url.searchParams.set("token", authToken);
  }

  const stream = new EventSource(url.toString());
  stream.onmessage = () => {
    return;
  };
  [
    "snapshot",
    "task_submitted",
    "task_running",
    "task_completed",
    "task_failed",
    "task_canceled",
    "task_retried",
    "queue_paused",
    "queue_resumed",
    "policy_updated",
    "policy_lock_updated",
    "benchmark_snapshot_created",
    "history_cleared"
  ].forEach((eventName) => {
    stream.addEventListener(eventName, (event) => {
      const message = JSON.parse((event as MessageEvent<string>).data) as { payload: DashboardPayload };
      onMessage(message.payload);
    });
  });
  return stream;
}
