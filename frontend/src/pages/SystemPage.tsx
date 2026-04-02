import type { ReactElement } from "react";
import type { DashboardPayload, HealthStatus } from "../types";
import { MobilePageTabs, PageHero, cardClasses } from "../components/ui";
import { navigateTo, type AppRoute } from "../lib/router";

export function SystemPage({
  dashboard,
  currentRoute,
  health,
  onSeed,
  onQueueToggle,
  queueActionBusy,
  resetBusy,
  onResetHistory
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
  health: HealthStatus | null;
  onSeed: () => Promise<void>;
  onQueueToggle: () => Promise<void>;
  queueActionBusy: boolean;
  resetBusy: boolean;
  onResetHistory: () => Promise<void>;
}): ReactElement {
  const checks = [
    {
      label: "Backend health",
      value: health?.ok ? "Connected" : "Waiting",
      detail: "The API must respond before any live dashboard features work."
    },
    {
      label: "Operator session",
      value: "Authenticated",
      detail: "You are inside the protected product shell, so auth is active."
    },
    {
      label: "Task activity",
      value: dashboard.summary.total > 0 ? `${dashboard.summary.total} tasks seen` : "No tasks yet",
      detail: "Submit or seed a task to validate scheduling, logging, and SSE updates."
    }
  ];

  const steps = [
    "Open the Jobs page and submit a small vector task. It should usually route to CPU.",
    "Seed the demo load to create a mix of CPU and GPU tasks automatically.",
    "Go to Overview or Policies and inspect a decision trace to confirm why a lane was chosen.",
    "Open Benchmarks and check that the charts and snapshot archive update after completions.",
    "Pause the queue, then resume it, to verify operator controls and live state refresh."
  ];

  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />
      <PageHero
        eyebrow="System Verification"
        title="Make it obvious how to prove the product is working."
        description="This page answers the missing product question directly: how to tell the scheduler, queue, metrics, and live UI are all functioning together."
        actions={
          <>
            <button
              type="button"
              onClick={() => void onSeed()}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-950 transition hover:brightness-110"
            >
              Run Demo Load
            </button>
            <button
              type="button"
              disabled={queueActionBusy}
              onClick={() => void onQueueToggle()}
              className="rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-200 transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dashboard.system.queuePaused ? "Resume Queue" : "Pause Queue"}
            </button>
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={`${cardClasses} p-5`}>
          <div className="mb-4">
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Readiness Checks</h2>
            <p className="mt-1 text-sm text-slate-400">A quick pass/fail style view for local validation.</p>
          </div>
          <div className="space-y-3">
            {checks.map((check) => (
              <div key={check.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-lg text-white">{check.label}</div>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                    {check.value}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{check.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6">
          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Workspace Reset</h2>
              <p className="mt-1 text-sm text-slate-400">
                Clear old tasks, benchmark snapshots, and CSV log history when you want a clean demo run.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/5 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-100">Safe Guard</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                This keeps your account and policy settings, but removes persisted task, metric, decision-trace, and snapshot history.
                It will refuse to run while workloads are still executing.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void onResetHistory()}
                className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetBusy ? "Clearing" : "Clear History"}
              </button>
              <span className="text-sm text-slate-400">
                Current persisted items: {dashboard.summary.total} tasks, {dashboard.explainability.snapshots.length} snapshots
              </span>
            </div>
          </section>

          <section className={`${cardClasses} p-5`}>
          <div className="mb-4">
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">How To Verify Locally</h2>
            <p className="mt-1 text-sm text-slate-400">Follow this once and you’ll know the app is actually working end to end.</p>
          </div>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">Step {index + 1}</div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigateTo("/jobs")}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Open Jobs
            </button>
            <button
              type="button"
              onClick={() => navigateTo("/benchmarks")}
              className="rounded-2xl border border-white/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-slate-200 transition hover:border-white/20"
            >
              Open Benchmarks
            </button>
          </div>
          </section>
        </section>
      </section>
    </>
  );
}
