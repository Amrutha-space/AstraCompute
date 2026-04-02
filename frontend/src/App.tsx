import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AccessPage } from "./pages/AccessPage";
import { BenchmarksPage } from "./pages/BenchmarksPage";
import { HomePage } from "./pages/HomePage";
import { JobsPage } from "./pages/JobsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { SystemPage } from "./pages/SystemPage";
import {
  ApiError,
  cancelTask,
  createBenchmarkSnapshot,
  createDashboardStream,
  fetchCurrentUser,
  fetchDashboard,
  fetchDecisionTrace,
  fetchDemoCredentials,
  fetchHealth,
  logIn,
  logOut,
  pauseQueue,
  resetOperationalHistory,
  resumeQueue,
  retryTask,
  seedTasks,
  setAuthToken,
  signUp,
  submitTask,
  updatePolicy,
  updatePolicyLock
} from "./lib/api";
import { navigateTo, normalizeRoute } from "./lib/router";
import { ProductShell, Toast } from "./components/ui";
import type { AuthUser, DashboardPayload, DecisionTrace, DemoCredentials, HealthStatus, SchedulerPolicy, TaskFormInput } from "./types";

const authTokenStorageKey = "astra_auth_token";
const protectedRoutes = new Set(["/overview", "/jobs", "/benchmarks", "/policies", "/system"]);

const initialPayload: DashboardPayload = {
  summary: {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
    total: 0,
    cpuAverageMs: 0,
    gpuAverageMs: 0
  },
  system: {
    queuePaused: false,
    persistence: "sqlite",
    activePolicy: "balanced",
    availablePolicies: ["balanced", "latency", "throughput", "cpu_preferred"],
    policyLocked: false
  },
  executors: [],
  tasks: [],
  queue: [],
  metrics: {
    performance: [],
    distribution: [],
    timeline: []
  },
  explainability: {
    recentDecisions: [],
    benchmark: {
      overview: {
        completedTasks: 0,
        winRatePct: 0,
        averageSpeedupPct: 0,
        adaptiveSharePct: 0,
        averageQueueWaitMs: 0
      },
      policyBreakdown: [],
      executorBreakdown: [],
      sizeBucketBreakdown: []
    },
    snapshots: []
  }
};

function loadStoredToken(): string | null {
  return window.localStorage.getItem(authTokenStorageKey);
}

export default function App() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname));
  const [token, setToken] = useState<string | null>(() => loadStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authBusy, setAuthBusy] = useState(true);
  const [authActionBusy, setAuthActionBusy] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPayload>(initialPayload);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<DecisionTrace | null>(null);
  const [demoCredentials, setDemoCredentials] = useState<DemoCredentials | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [form, setForm] = useState<TaskFormInput>({
    type: "vector_add",
    size: 1024,
    priority: 3
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [queueActionBusy, setQueueActionBusy] = useState(false);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; tone: "success" | "error" | "info"; title: string } | null>(null);

  function showNotice(tone: "success" | "error" | "info", title: string): void {
    setNotice({ id: Date.now(), tone, title });
  }

  useEffect(() => {
    const handleRouteChange = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      window.localStorage.setItem(authTokenStorageKey, token);
    } else {
      window.localStorage.removeItem(authTokenStorageKey);
    }
  }, [token]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice]);

  useEffect(() => {
    let mounted = true;

    void fetchHealth()
      .then((value) => {
        if (mounted) {
          setHealth(value);
        }
      })
      .catch(() => {
        if (mounted) {
          setHealth(null);
        }
      });

    void fetchDemoCredentials()
      .then((value) => {
        if (mounted) {
          setDemoCredentials(value);
        }
      })
      .catch(() => {
        if (mounted) {
          setDemoCredentials(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function bootstrapAuth(): Promise<void> {
      if (!token) {
        setUser(null);
        setAuthBusy(false);
        return;
      }

      setAuthBusy(true);
      try {
        const currentUser = await fetchCurrentUser();
        if (!canceled) {
          setUser(currentUser);
        }
      } catch (requestError) {
        if (!canceled) {
          setToken(null);
          setUser(null);
          setError(requestError instanceof Error ? requestError.message : "Session expired.");
        }
      } finally {
        if (!canceled) {
          setAuthBusy(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      canceled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!authBusy && !user && protectedRoutes.has(route)) {
      navigateTo("/access", true);
    }
  }, [authBusy, user, route]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let mounted = true;
    void fetchDashboard()
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setDashboard(payload);
        const firstTaskId = payload.tasks[0]?.id ?? payload.explainability.recentDecisions[0]?.taskId ?? null;
        setSelectedTaskId((previous) => previous ?? firstTaskId);
        setError(null);
      })
      .catch((requestError) => {
        if (!mounted) {
          return;
        }
        if (isUnauthorized(requestError)) {
          handleUnauthorized(requestError);
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard.");
      });

    const stream = createDashboardStream((payload) => {
      if (!mounted) {
        return;
      }
      setDashboard(payload);
      setError(null);
      setSelectedTaskId((previous) => previous ?? payload.tasks[0]?.id ?? payload.explainability.recentDecisions[0]?.taskId ?? null);
    });

    stream.onopen = () => {
      if (mounted) {
        setError((current) => (current === "Reconnecting live telemetry in the background." ? null : current));
      }
    };

    stream.onerror = () => {
      if (mounted && !document.hidden) {
        setError((current) => current ?? "Reconnecting live telemetry in the background.");
      }
    };

    return () => {
      mounted = false;
      stream.close();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedTaskId) {
      setSelectedDecision(null);
      return;
    }

    let canceled = false;
    void fetchDecisionTrace(selectedTaskId)
      .then((trace) => {
        if (!canceled) {
          setSelectedDecision(trace);
        }
      })
      .catch((requestError) => {
        if (canceled) {
          return;
        }
        if (isUnauthorized(requestError)) {
          handleUnauthorized(requestError);
          return;
        }
        setSelectedDecision(null);
      });

    return () => {
      canceled = true;
    };
  }, [selectedTaskId, user, dashboard.tasks]);

  async function handleLogin(input: { email: string; password: string }): Promise<void> {
    setAuthActionBusy(true);
    setError(null);
    try {
      const session = await logIn(input);
      setToken(session.token);
      setUser(session.user);
      showNotice("success", "Logged in.");
      navigateTo("/overview", true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to log in.");
    } finally {
      setAuthActionBusy(false);
    }
  }

  async function handleSignUp(input: { name: string; email: string; password: string }): Promise<void> {
    setAuthActionBusy(true);
    setError(null);
    try {
      const session = await signUp(input);
      setToken(session.token);
      setUser(session.user);
      showNotice("success", "Account created.");
      navigateTo("/overview", true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create account.");
    } finally {
      setAuthActionBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await logOut();
    } catch {
      // Clear local session even if logout request fails.
    } finally {
      setToken(null);
      setUser(null);
      setDashboard(initialPayload);
      setSelectedTaskId(null);
      setSelectedDecision(null);
      showNotice("info", "Signed out.");
      navigateTo("/", true);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await submitTask(form);
      showNotice("success", "Task submitted to the scheduler.");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to submit task.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSeed(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await seedTasks();
      showNotice("success", "Demo workload queued.");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to seed tasks.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTaskAction(taskId: string, action: "cancel" | "retry"): Promise<void> {
    setActionTaskId(taskId);
    setError(null);

    try {
      if (action === "cancel") {
        await cancelTask(taskId);
        showNotice("info", "Queued task canceled.");
      } else {
        await retryTask(taskId);
        showNotice("success", "Task re-queued for another run.");
      }
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : `Unable to ${action} task.`);
      }
    } finally {
      setActionTaskId(null);
    }
  }

  async function handleQueueToggle(): Promise<void> {
    setQueueActionBusy(true);
    setError(null);

    try {
      if (dashboard.system.queuePaused) {
        await resumeQueue();
        showNotice("success", "Dispatch queue resumed.");
      } else {
        await pauseQueue();
        showNotice("info", "Dispatch queue paused.");
      }
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to update queue state.");
      }
    } finally {
      setQueueActionBusy(false);
    }
  }

  async function handlePolicyChange(policy: SchedulerPolicy): Promise<void> {
    setPolicyBusy(true);
    setError(null);
    try {
      await updatePolicy(policy);
      showNotice("success", `Policy switched to ${policy.replace("_", " ")}.`);
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to update policy.");
      }
    } finally {
      setPolicyBusy(false);
    }
  }

  async function handlePolicyLockToggle(): Promise<void> {
    setGovernanceBusy(true);
    setError(null);
    try {
      await updatePolicyLock(
        !dashboard.system.policyLocked,
        dashboard.system.policyLocked ? undefined : "Workspace policy locked by operator."
      );
      showNotice("info", dashboard.system.policyLocked ? "Policy controls unlocked." : "Policy controls locked.");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to update policy lock.");
      }
    } finally {
      setGovernanceBusy(false);
    }
  }

  async function handleCreateSnapshot(): Promise<void> {
    setSnapshotBusy(true);
    setError(null);
    try {
      await createBenchmarkSnapshot(snapshotName || undefined);
      setSnapshotName("");
      showNotice("success", "Benchmark snapshot saved.");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to create benchmark snapshot.");
      }
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function handleResetHistory(): Promise<void> {
    setResetBusy(true);
    setError(null);
    try {
      await resetOperationalHistory();
      setSelectedTaskId(null);
      setSelectedDecision(null);
      setSnapshotName("");
      showNotice("success", "Workspace history cleared.");
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        handleUnauthorized(requestError);
      } else {
        const message = requestError instanceof Error ? requestError.message : "Unable to clear history.";
        setError(message);
        showNotice("error", message);
      }
    } finally {
      setResetBusy(false);
    }
  }

  function handleUnauthorized(requestError: unknown): void {
    const message = requestError instanceof Error ? requestError.message : "Session expired.";
    setToken(null);
    setUser(null);
    setError(message);
    showNotice("error", "Please log in again.");
    navigateTo("/access", true);
  }

  if (authBusy) {
    return (
      <div className="min-h-screen overflow-hidden bg-chrome-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(66,215,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(124,255,159,0.12),transparent_25%),linear-gradient(180deg,#04070e_0%,#0a1120_48%,#070b14_100%)]" />
        <div className="absolute inset-0 bg-grid bg-[size:48px_48px] opacity-20" />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4">
          <div className="rounded-[2rem] border border-white/10 bg-black/30 px-8 py-10 text-center backdrop-blur-xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-chrome-300">AstraCompute</div>
            <div className="mt-4 font-display text-4xl tracking-[0.08em] text-white">Checking Session</div>
            <div className="mt-3 text-sm text-slate-400">Loading account state and workspace data.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 w-full max-w-sm">
        <AnimatePresence>{notice ? <Toast key={notice.id} title={notice.title} tone={notice.tone} /> : null}</AnimatePresence>
      </div>

      <ProductShell
        currentRoute={route}
        statusLabel={health?.ok ? "Backend Online" : "Backend Connecting"}
        authenticated={Boolean(user)}
        accountLabel={user ? user.name : "Access Workspace"}
        onAccountClick={() => navigateTo("/access")}
        onSignOut={() => void handleSignOut()}
      >
        {route === "/" ? <HomePage dashboard={dashboard} currentRoute={route} /> : null}

        {route === "/access" ? (
          <AccessPage
            health={health}
            demoCredentials={demoCredentials}
            loading={authActionBusy}
            error={error}
            onLogin={handleLogin}
            onSignUp={handleSignUp}
          />
        ) : null}

        {route === "/overview" ? (
          <OverviewPage
            dashboard={dashboard}
            currentRoute={route}
            selectedDecision={selectedDecision}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
        ) : null}

        {route === "/jobs" ? (
          <JobsPage
            dashboard={dashboard}
            currentRoute={route}
            form={form}
            selectedTaskId={selectedTaskId}
            submitting={submitting}
            queueActionBusy={queueActionBusy}
            actionTaskId={actionTaskId}
            error={error}
            onFormChange={(patch) => setForm((previous) => ({ ...previous, ...patch }))}
            onSubmit={handleSubmit}
            onSeed={handleSeed}
            onQueueToggle={handleQueueToggle}
            onSelectTask={setSelectedTaskId}
            onTaskAction={handleTaskAction}
          />
        ) : null}

        {route === "/benchmarks" ? (
          <BenchmarksPage
            dashboard={dashboard}
            currentRoute={route}
            snapshotName={snapshotName}
            snapshotBusy={snapshotBusy}
            onSnapshotNameChange={setSnapshotName}
            onCreateSnapshot={handleCreateSnapshot}
          />
        ) : null}

        {route === "/policies" ? (
          <PoliciesPage
            dashboard={dashboard}
            currentRoute={route}
            selectedTaskId={selectedTaskId}
            policyBusy={policyBusy}
            governanceBusy={governanceBusy}
            onPolicyChange={handlePolicyChange}
            onPolicyLockToggle={handlePolicyLockToggle}
            onSelectTask={setSelectedTaskId}
          />
        ) : null}

        {route === "/system" ? (
          <SystemPage
            dashboard={dashboard}
            currentRoute={route}
            health={health}
            onSeed={handleSeed}
            onQueueToggle={handleQueueToggle}
            queueActionBusy={queueActionBusy}
            resetBusy={resetBusy}
            onResetHistory={handleResetHistory}
          />
        ) : null}
      </ProductShell>
    </>
  );
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
