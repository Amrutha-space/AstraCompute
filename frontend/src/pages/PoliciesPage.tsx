import type { ReactElement } from "react";
import { motion } from "framer-motion";
import type { DashboardPayload, SchedulerPolicy } from "../types";
import {
  EmptyState,
  MobilePageTabs,
  PageHero,
  cardClasses,
  formatExecutor,
  formatPolicy,
  policyDescription
} from "../components/ui";
import type { AppRoute } from "../lib/router";

export function PoliciesPage({
  dashboard,
  currentRoute,
  selectedTaskId,
  policyBusy,
  governanceBusy,
  onPolicyChange,
  onPolicyLockToggle,
  onSelectTask
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
  selectedTaskId: string | null;
  policyBusy: boolean;
  governanceBusy: boolean;
  onPolicyChange: (policy: SchedulerPolicy) => Promise<void>;
  onPolicyLockToggle: () => Promise<void>;
  onSelectTask: (taskId: string) => void;
}): ReactElement {
  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />
      <PageHero
        eyebrow="Routing Controls"
        title="Scheduling policy deserves its own operating surface."
        description="This page is for policy changes, executor capability review, and decision-stream inspection without mixing in job submission or benchmark archiving."
        actions={
          <button
            type="button"
            disabled={governanceBusy}
            onClick={() => void onPolicyLockToggle()}
            className="rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-200 transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dashboard.system.policyLocked ? "Unlock Policy" : "Lock Policy"}
          </button>
        }
      />

      <section className={`${cardClasses} p-5`}>
        <div className="mb-4">
          <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Policy Modes</h2>
          <p className="mt-1 text-sm text-slate-400">Choose the optimization goal the scheduler should prioritize.</p>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
            Active {formatPolicy(dashboard.system.activePolicy)}
          </span>
          {dashboard.system.policyLocked ? (
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-amber-100">
              {dashboard.system.policyLockReason ?? "Policy locked"}
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.system.availablePolicies.map((policy) => (
            <button
              key={policy}
              type="button"
              disabled={policyBusy || dashboard.system.policyLocked}
              onClick={() => void onPolicyChange(policy)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                dashboard.system.activePolicy === policy
                  ? "border-cyan-300/40 bg-cyan-400/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">{formatPolicy(policy)}</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{policyDescription(policy)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className={`${cardClasses} p-5`}>
          <div className="mb-4">
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Executor Capability</h2>
            <p className="mt-1 text-sm text-slate-400">Availability and lane capability details that influence operator decisions.</p>
          </div>
          <div className="grid gap-4">
            {dashboard.executors.map((executor) => (
              <div key={executor.executor} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-lg text-white">{executor.executor}</div>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                    {executor.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {executor.capabilities.map((capability) => (
                    <span key={capability} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${cardClasses} p-5`}>
          <div className="mb-4">
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Decision Stream</h2>
            <p className="mt-1 text-sm text-slate-400">Recent routing traces with policy, lane, and projected gain.</p>
          </div>
          <div className="space-y-3">
            {dashboard.explainability.recentDecisions.length === 0 ? (
              <EmptyState message="Decision traces will appear after the first submitted task." />
            ) : (
              dashboard.explainability.recentDecisions.map((trace, index) => (
                <motion.button
                  type="button"
                  key={trace.taskId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => onSelectTask(trace.taskId)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedTaskId === trace.taskId ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.28em] text-chrome-300">{trace.taskId}</p>
                      <p className="mt-1 text-sm text-white">
                        {formatExecutor(trace.selectedExecutor)} over {formatExecutor(trace.baselineExecutor)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                        {trace.decisionMode}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-200">
                        {formatPolicy(trace.policyMode)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    <span>{trace.sizeBucket}</span>
                    <span>gain {trace.projectedGainMs.toFixed(1)} ms</span>
                    <span>wait {trace.queueWaitMs?.toFixed(1) ?? "0.0"} ms</span>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </section>
      </section>
    </>
  );
}
