import type { ReactElement } from "react";
import { motion } from "framer-motion";
import type { DashboardPayload, DecisionTrace } from "../types";
import {
  Badge,
  EmptyState,
  ExecutorMetric,
  InspectorStat,
  MobilePageTabs,
  PageHero,
  StatChip,
  cardClasses,
  formatExecutor,
  formatPolicy,
  formatTaskType
} from "../components/ui";
import type { AppRoute } from "../lib/router";

export function OverviewPage({
  dashboard,
  currentRoute,
  selectedDecision,
  selectedTaskId,
  onSelectTask
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
  selectedDecision: DecisionTrace | null;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}): ReactElement {
  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />
      <PageHero
        eyebrow="Mission Overview"
        title="Keep the surface minimal while the scheduler stays visible."
        description="This page is the high-level view only: current workload pressure, executor readiness, and one decision trace worth inspecting right now."
        actions={
          <>
            <StatChip label="Queued" value={dashboard.summary.queued} accent="cyan" />
            <StatChip label="Running" value={dashboard.summary.running} accent="green" />
            <StatChip label="Win Rate" value={`${dashboard.explainability.benchmark.overview.winRatePct.toFixed(0)}%`} accent="amber" />
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="grid gap-6">
          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">System Snapshot</h2>
              <p className="mt-1 text-sm text-slate-400">A compact status readout for operators landing on the product.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SnapshotTile label="Policy" value={formatPolicy(dashboard.system.activePolicy)} />
              <SnapshotTile label="Persistence" value={dashboard.system.persistence.toUpperCase()} />
              <SnapshotTile label="Completed" value={dashboard.summary.completed} />
              <SnapshotTile label="Failed / Canceled" value={`${dashboard.summary.failed} / ${dashboard.summary.canceled}`} />
            </div>
          </section>

          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Executor Readiness</h2>
              <p className="mt-1 text-sm text-slate-400">CPU and GPU lanes with current pressure, not the full policy editor.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard.executors.map((executor) => (
                <div key={executor.executor} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-display text-lg text-white">{executor.executor}</div>
                    <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                      {executor.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <ExecutorMetric label="Active" value={executor.activeTasks} />
                    <ExecutorMetric label="Max" value={executor.maxConcurrency} />
                    <ExecutorMetric label="Queued" value={executor.queuePressure} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6">
          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Decision Inspector</h2>
              <p className="mt-1 text-sm text-slate-400">One task trace at a time so the scheduler remains explainable without crowding the screen.</p>
            </div>

            {selectedDecision ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-chrome-300">{selectedDecision.taskId}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label={selectedDecision.decisionMode} />
                    <Badge label={formatPolicy(selectedDecision.policyMode)} />
                    <Badge label={`${selectedDecision.sizeBucket} workload`} />
                    <Badge label={`status ${selectedDecision.status}`} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{selectedDecision.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InspectorStat label="Chosen Lane" value={formatExecutor(selectedDecision.selectedExecutor)} />
                  <InspectorStat label="Baseline Lane" value={formatExecutor(selectedDecision.baselineExecutor)} />
                  <InspectorStat label="CPU Estimate" value={`${selectedDecision.cpuEstimateMs.toFixed(1)} ms`} />
                  <InspectorStat label="GPU Estimate" value={`${selectedDecision.gpuEstimateMs.toFixed(1)} ms`} />
                  <InspectorStat label="Projected Gain" value={`${selectedDecision.projectedGainMs.toFixed(1)} ms`} />
                  <InspectorStat label="Queue Wait" value={`${(selectedDecision.queueWaitMs ?? 0).toFixed(1)} ms`} />
                </div>
              </div>
            ) : (
              <EmptyState message="Submit or select a task from the Jobs page to inspect a routing decision." />
            )}
          </section>

          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Recent Workloads</h2>
              <p className="mt-1 text-sm text-slate-400">A short ledger of the most recent tasks for quick navigation.</p>
            </div>
            <div className="space-y-3">
              {dashboard.tasks.slice(0, 6).map((task, index) => (
                <motion.button
                  type="button"
                  key={task.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => onSelectTask(task.id)}
                  className={`w-full rounded-2xl border bg-black/20 p-4 text-left transition ${
                    selectedTaskId === task.id ? "border-cyan-300/40" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs uppercase tracking-[0.25em] text-chrome-300">{task.id}</div>
                      <div className="mt-1 text-sm text-white">{formatTaskType(task.type)}</div>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{formatExecutor(task.executor)}</span>
                    <span>size {task.size}</span>
                    <span>priority {task.priority}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        </section>
      </section>
    </>
  );
}

function SnapshotTile({ label, value }: { label: string; value: number | string }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className="mt-3 font-display text-2xl text-white">{value}</div>
    </div>
  );
}
