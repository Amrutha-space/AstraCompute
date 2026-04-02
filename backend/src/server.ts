import { createApp } from "./app.js";
import { config } from "./config.js";
import { TaskRepository } from "./db/taskRepository.js";
import { CsvLogger } from "./logging/csvLogger.js";
import { AuthService } from "./services/authService.js";
import { TaskService } from "./services/taskService.js";

const logger = new CsvLogger(config.logFile);
const repository = new TaskRepository(config.dbFile);
const taskService = new TaskService(logger, repository);
const authService = new AuthService(repository);

async function start(): Promise<void> {
  await taskService.initialize();
  authService.initialize();
  const app = createApp(taskService, authService);
  const server = app.listen(config.port, () => {
    console.log(`AstraCompute backend listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await taskService.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void start().catch((error) => {
  console.error("Failed to start AstraCompute backend", error);
  process.exit(1);
});
