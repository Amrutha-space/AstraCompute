import type { ReactElement, ReactNode } from "react";
import { motion } from "framer-motion";
import type { DashboardTask, SchedulerPolicy } from "../types";
import { navigateTo, type AppRoute } from "../lib/router";

export const cardClasses = "rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-panel";

export const tooltipStyle = {
  background: "#0d1322",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "18px"
};

export const distributionColors = ["#42d7ff", "#7cff9f", "#ffc65c", "#f87171"];

export function formatTaskType(type: DashboardTask["type"]): string {
  return type === "vector_add" ? "Vector Add" : "Matrix Multiply";
}

export function formatExecutor(executor: "cpu" | "gpu" | "pending" | "CPU" | "GPU"): string {
  return executor === "pending" ? "PENDING" : executor.toUpperCase();
}

export function formatPolicy(policy: SchedulerPolicy): string {
  return policy.replace("_", " ").toUpperCase();
}

export function policyDescription(policy: SchedulerPolicy): string {
  switch (policy) {
    case "latency":
      return "Always favor the lane with the lowest estimated completion time.";
    case "throughput":
      return "Bias toward GPU throughput unless CPU is clearly more efficient.";
    case "cpu_preferred":
      return "Keep work on CPU unless GPU has a strong projected win.";
    case "balanced":
    default:
      return "Mix heuristics and historical performance for an even-handed policy.";
  }
}

export function ProductShell({
  children,
  currentRoute,
  statusLabel,
  authenticated,
  accountLabel,
  onAccountClick,
  onSignOut
}: {
  children: ReactNode;
  currentRoute: AppRoute;
  statusLabel: string;
  authenticated: boolean;
  accountLabel: string;
  onAccountClick: () => void;
  onSignOut: () => void;
}): ReactElement {
  const navItems: Array<{ route: AppRoute; label: string }> = [
    { route: "/", label: "Home" },
    { route: "/overview", label: "Overview" },
    { route: "/jobs", label: "Jobs" },
    { route: "/benchmarks", label: "Benchmarks" },
    { route: "/policies", label: "Policies" },
    { route: "/system", label: "System" }
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-chrome-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(89,211,255,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,_rgba(86,255,173,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,_rgba(255,173,94,0.09),transparent_28%),linear-gradient(180deg,#050811_0%,#09101b_42%,#050912_100%)]" />
      <div className="absolute inset-0 bg-grid bg-[size:48px_48px] opacity-20" />
      <motion.div
        animate={{ x: [0, 22, -18, 0], y: [0, -14, 18, 0] }}
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="absolute left-[8%] top-28 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <motion.div
        animate={{ x: [0, -18, 12, 0], y: [0, 22, -12, 0] }}
        transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="absolute right-[10%] top-32 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className={`${cardClasses} sticky top-4 z-30 mb-6 px-4 py-4 sm:px-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <button type="button" onClick={() => navigateTo("/")} className="text-left">
              <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-chrome-300">AstraCompute</div>
              <div className="mt-2 font-display text-2xl tracking-[0.1em] text-white">Hybrid Scheduler</div>
            </button>

            <nav className="hidden flex-wrap items-center gap-2 lg:flex">
              {navItems.map((item) => (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  className={`rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.26em] transition ${
                    currentRoute === item.route
                      ? "border border-cyan-300/35 bg-cyan-400/12 text-cyan-100 shadow-[0_0_24px_rgba(66,215,255,0.12)]"
                      : "border border-white/10 bg-black/20 text-slate-300 hover:border-cyan-300/20 hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                {statusLabel}
              </div>
              <button
                type="button"
                onClick={onAccountClick}
                className="rounded-full border border-white/10 bg-black/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/5"
              >
                {accountLabel}
              </button>
              {authenticated ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-full border border-white/10 bg-black/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/5"
                >
                  Sign Out
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="space-y-6">{children}</main>

        <footer className="mt-10 overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-8 backdrop-blur-xl sm:px-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
          <div className="relative grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.34em] text-chrome-300">AstraCompute</div>
              <p className="mt-4 max-w-2xl font-display text-2xl leading-tight text-white sm:text-3xl">
                Adaptive compute orchestration for local Apple Silicon workflows.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                Route numerical workloads across CPU and GPU lanes, inspect benchmark outcomes, and move through a
                cleaner product surface built around distinct operating pages.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">Core Modes</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["CPU lane", "GPU lane", "Live stream", "SQLite state"].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">Flow</div>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-400">
                  <p>Start from Home, enter through Access, then move into the workspace pages.</p>
                  <p>Use System for verification and reset controls after testing.</p>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function MobilePageTabs({ currentRoute }: { currentRoute: AppRoute }): ReactElement {
  const tabs: Array<{ route: AppRoute; label: string }> = [
    { route: "/", label: "Home" },
    { route: "/overview", label: "Overview" },
    { route: "/jobs", label: "Jobs" },
    { route: "/benchmarks", label: "Benchmarks" },
    { route: "/policies", label: "Policies" },
    { route: "/system", label: "System" }
  ];

  return (
    <div className="lg:hidden">
      <div className={`${cardClasses} overflow-x-auto p-3`}>
        <div className="flex gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.route}
              type="button"
              onClick={() => navigateTo(tab.route)}
              className={`shrink-0 rounded-2xl px-4 py-3 font-mono text-xs uppercase tracking-[0.24em] transition ${
                currentRoute === tab.route ? "bg-cyan-400/15 text-cyan-100" : "bg-black/20 text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}): ReactElement {
  return (
    <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`${cardClasses} p-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-chrome-400/30 bg-chrome-500/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.35em] text-chrome-300">
            {eyebrow}
          </span>
          <h2 className="mt-4 font-display text-3xl tracking-[0.08em] text-white sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </motion.header>
  );
}

export function StatChip({
  label,
  value,
  accent
}: {
  label: string;
  value: number | string;
  accent: "cyan" | "green" | "amber";
}): ReactElement {
  const accentClass =
    accent === "cyan"
      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
      : accent === "green"
        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
        : "border-amber-300/20 bg-amber-400/10 text-amber-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${accentClass}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.3em]">{label}</div>
      <div className="mt-2 font-display text-xl">{value}</div>
    </div>
  );
}

export function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }): ReactElement {
  return (
    <section className={`${cardClasses} p-5`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className="mt-3 font-display text-3xl text-white">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{caption}</p>
    </section>
  );
}

export function ExecutorMetric({ label, value }: { label: string; value: number | string }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-white">{value}</div>
    </div>
  );
}

export function ChartPanel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={`${cardClasses} p-5`}>
      <div className="mb-4">
        <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function InspectorStat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-white">{value}</div>
    </div>
  );
}

export function Badge({ label }: { label: string }): ReactElement {
  return (
    <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
      {label}
    </span>
  );
}

export function EmptyState({ message }: { message: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function Toast({
  title,
  tone
}: {
  title: string;
  tone: "success" | "error" | "info";
}): ReactElement {
  const classes =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-50"
      : tone === "error"
        ? "border-rose-300/20 bg-rose-400/10 text-rose-50"
        : "border-cyan-300/20 bg-cyan-400/10 text-cyan-50";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className={`rounded-2xl border px-4 py-3 shadow-panel ${classes}`}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.24em]">{tone}</div>
      <div className="mt-2 text-sm">{title}</div>
    </motion.div>
  );
}
