import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskRepository } from "../src/db/taskRepository.js";
import { AuthService } from "../src/services/authService.js";

describe("AuthService", () => {
  let repository: TaskRepository;
  let authService: AuthService;
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "astra-auth-service-"));
    repository = new TaskRepository(path.join(tempDirectory, "astra.db"));
    repository.initialize();
    authService = new AuthService(repository);
    authService.initialize();
  });

  afterEach(async () => {
    repository.close();
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it("creates accounts and resolves the current user from a session token", () => {
    const session = authService.signUp({
      name: "Operator One",
      email: "operator@example.com",
      password: "Sup3rSecure!"
    });

    const currentUser = authService.getCurrentUser(session.token);

    expect(session.user.email).toBe("operator@example.com");
    expect(currentUser.name).toBe("Operator One");
  });

  it("logs into the seeded demo account", () => {
    const demo = authService.getDemoCredentials();
    const session = authService.logIn({
      email: demo.email,
      password: demo.password
    });

    expect(session.user.email).toBe(demo.email);
  });

  it("invalidates a session on logout", () => {
    const session = authService.signUp({
      name: "Operator Two",
      email: "two@example.com",
      password: "Sup3rSecure!"
    });

    authService.logOut(session.token);

    expect(() => authService.getCurrentUser(session.token)).toThrowError(/expired/i);
  });
});
