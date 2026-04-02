import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import type { PersistedUser, TaskRepository } from "../db/taskRepository.js";
import { AppError } from "../errors.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const demoOperator = {
  name: "Astra Demo Operator",
  email: "demo@astracompute.local",
  password: "AstraDemo123!"
};

export class AuthService {
  constructor(private readonly repository: TaskRepository) {}

  initialize(): void {
    if (this.repository.getUserByEmail(demoOperator.email)) {
      return;
    }

    const createdAt = new Date().toISOString();
    this.repository.createUser({
      id: nanoid(),
      name: demoOperator.name,
      email: demoOperator.email,
      passwordHash: this.hashPassword(demoOperator.password),
      createdAt
    });
  }

  getDemoCredentials(): { name: string; email: string; password: string } {
    return { ...demoOperator };
  }

  signUp(input: SignUpInput): AuthSession {
    const normalizedEmail = normalizeEmail(input.email);
    if (this.repository.getUserByEmail(normalizedEmail)) {
      throw new AppError(409, "An account with that email already exists.");
    }

    const user = this.repository.createUser({
      id: nanoid(),
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: this.hashPassword(input.password),
      createdAt: new Date().toISOString()
    });

    return this.createSession(user);
  }

  logIn(input: LoginInput): AuthSession {
    const normalizedEmail = normalizeEmail(input.email);
    const user = this.repository.getUserByEmail(normalizedEmail);
    if (!user || !this.verifyPassword(input.password, user.passwordHash)) {
      throw new AppError(401, "Invalid email or password.");
    }

    return this.createSession(user);
  }

  getCurrentUser(token: string): AuthUser {
    return this.authenticate(token);
  }

  authenticate(token?: string): AuthUser {
    if (!token) {
      throw new AppError(401, "Authentication required.");
    }

    const tokenHash = hashToken(token);
    const session = this.repository.getSessionByTokenHash(tokenHash);
    if (!session) {
      throw new AppError(401, "Your session has expired. Please log in again.");
    }

    const user = this.repository.getUserById(session.userId);
    if (!user) {
      this.repository.deleteSession(tokenHash);
      throw new AppError(401, "Your account could not be found.");
    }

    this.repository.touchSession(tokenHash, new Date().toISOString());
    return toAuthUser(user);
  }

  logOut(token?: string): void {
    if (!token) {
      return;
    }

    this.repository.deleteSession(hashToken(token));
  }

  private createSession(user: PersistedUser): AuthSession {
    const token = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    this.repository.saveSession({
      tokenHash: hashToken(token),
      userId: user.id,
      createdAt: now,
      lastSeenAt: now
    });

    return {
      token,
      user: toAuthUser(user)
    };
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) {
      return false;
    }

    const actualBuffer = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(user: PersistedUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}
