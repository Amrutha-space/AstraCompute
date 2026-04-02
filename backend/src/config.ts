import path from "node:path";

const rootDirectory = path.resolve(import.meta.dirname, "..", "..");
const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigins,
  logFile: process.env.LOG_FILE ?? path.join(rootDirectory, "logs", "logs.csv"),
  dbFile: process.env.DB_FILE ?? path.join(rootDirectory, "logs", "astra.db")
};

export const runtimePaths = {
  rootDirectory,
  logDirectory: path.dirname(config.logFile),
  dbDirectory: path.dirname(config.dbFile)
};
