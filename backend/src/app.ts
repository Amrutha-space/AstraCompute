import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AppError } from "./errors.js";
import { createRouter } from "./routes.js";
import type { AuthService } from "./services/authService.js";
import type { TaskService } from "./services/taskService.js";

export function createApp(taskService: TaskService, authService: AuthService) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.frontendOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError(403, "Origin not allowed."));
      }
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", createRouter(taskService, authService));

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        message: "Invalid request payload.",
        issues: error.issues
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(500).json({ message });
  });

  return app;
}
