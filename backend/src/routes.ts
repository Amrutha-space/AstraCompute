import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AuthService } from "./services/authService.js";
import type { TaskService } from "./services/taskService.js";

const taskSchema = z.object({
  type: z.enum(["vector_add", "matrix_multiply"]),
  size: z.number().int().min(4).max(65536),
  priority: z.number().int().min(1).max(5),
  payload: z.any().optional()
});

const policySchema = z.object({
  policy: z.enum(["balanced", "latency", "throughput", "cpu_preferred"])
});

const policyLockSchema = z.object({
  locked: z.boolean(),
  reason: z.string().max(160).optional()
});

const snapshotSchema = z.object({
  name: z.string().min(1).max(120).optional()
});

const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export function createRouter(taskService: TaskService, authService: AuthService): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "astra-compute-backend",
      authRequired: true,
      demoAccountAvailable: true,
      timestamp: new Date().toISOString()
    });
  });

  router.get("/auth/demo", (_request, response) => {
    response.json(authService.getDemoCredentials());
  });

  router.post("/auth/signup", (request, response, next) => {
    try {
      const parsed = signUpSchema.parse(request.body);
      response.status(201).json(authService.signUp(parsed));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", (request, response, next) => {
    try {
      const parsed = loginSchema.parse(request.body);
      response.json(authService.logIn(parsed));
    } catch (error) {
      next(error);
    }
  });

  router.use((request: Request, _response: Response, next: NextFunction) => {
    try {
      const token = getTokenFromRequest(request);
      responseUser(request, authService.authenticate(token));
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/auth/me", (request, response) => {
    response.json(request.authUser);
  });

  router.post("/auth/logout", (request, response) => {
    authService.logOut(getTokenFromRequest(request));
    response.status(204).end();
  });

  router.post("/tasks", (request, response, next) => {
    try {
      const parsed = taskSchema.parse(request.body);
      const state = taskService.submitTask(parsed);
      response.status(202).json(state);
    } catch (error) {
      next(error);
    }
  });

  router.post("/tasks/seed", (_request, response) => {
    const seeded = taskService.seedTasks();
    response.status(202).json(seeded);
  });

  router.post("/tasks/:taskId/cancel", (request, response, next) => {
    try {
      response.json(taskService.cancelTask(request.params.taskId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/tasks/:taskId/retry", (request, response, next) => {
    try {
      response.status(202).json(taskService.retryTask(request.params.taskId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/queue/pause", (_request, response) => {
    response.json(taskService.pauseQueue());
  });

  router.post("/queue/resume", (_request, response) => {
    response.json(taskService.resumeQueue());
  });

  router.post("/system/reset-history", async (_request, response, next) => {
    try {
      response.json(await taskService.resetOperationalHistory());
    } catch (error) {
      next(error);
    }
  });

  router.get("/benchmarks", (_request, response) => {
    response.json(taskService.getBenchmarkSummary());
  });

  router.get("/benchmarks/snapshots", (_request, response) => {
    response.json(taskService.listBenchmarkSnapshots());
  });

  router.post("/benchmarks/snapshots", (request, response, next) => {
    try {
      const parsed = snapshotSchema.parse(request.body ?? {});
      response.status(201).json(taskService.createBenchmarkSnapshot(parsed.name));
    } catch (error) {
      next(error);
    }
  });

  router.get("/executors", (_request, response) => {
    response.json(taskService.toDashboardPayload().executors);
  });

  router.get("/policy", (_request, response) => {
    response.json({ activePolicy: taskService.getActivePolicy() });
  });

  router.post("/policy", (request, response, next) => {
    try {
      const parsed = policySchema.parse(request.body);
      response.json(taskService.setActivePolicy(parsed.policy));
    } catch (error) {
      next(error);
    }
  });

  router.get("/policy/governance", (_request, response) => {
    response.json(taskService.getGovernanceState());
  });

  router.post("/policy/lock", (request, response, next) => {
    try {
      const parsed = policyLockSchema.parse(request.body);
      response.json(taskService.setPolicyLock(parsed.locked, parsed.reason));
    } catch (error) {
      next(error);
    }
  });

  router.get("/tasks", (_request, response) => {
    response.json(taskService.listTaskStates());
  });

  router.get("/tasks/:taskId/decision", (request, response) => {
    const trace = taskService.getDecisionTrace(request.params.taskId);
    if (!trace) {
      response.status(404).json({ message: "Decision trace not found." });
      return;
    }

    response.json(trace);
  });

  router.get("/tasks/:taskId", (request, response) => {
    const task = taskService.getTaskState(request.params.taskId);
    if (!task) {
      response.status(404).json({ message: "Task not found." });
      return;
    }

    response.json(task);
  });

  router.get("/metrics", (_request, response) => {
    response.json(taskService.getMetrics());
  });

  router.get("/dashboard", (_request, response) => {
    response.json(taskService.toDashboardPayload());
  });

  router.get("/stream", (request, response) => {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const sendUpdate = (event: { event: string; payload: unknown; emittedAt: string }) => {
      response.write(`event: ${event.event}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    sendUpdate({
      event: "snapshot",
      payload: taskService.toDashboardPayload(),
      emittedAt: new Date().toISOString()
    });

    taskService.events.on("update", sendUpdate);

    request.on("close", () => {
      taskService.events.off("update", sendUpdate);
      response.end();
    });
  });

  return router;
}

function getTokenFromRequest(request: Request): string | undefined {
  const authorization = request.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const token = request.query.token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

function responseUser(request: Request, user: ReturnType<AuthService["authenticate"]>): void {
  request.authUser = user;
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: ReturnType<AuthService["authenticate"]>;
  }
}
