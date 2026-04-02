import type { ReactElement } from "react";
import { motion } from "framer-motion";
import type { DashboardPayload, TaskFormInput } from "../types";
import {
  EmptyState,
  MobilePageTabs,
  PageHero,
  cardClasses,
  formatExecutor,
  formatTaskType
} from "../components/ui";
import type { AppRoute } from "../lib/router";

export function JobsPage({
  dashboard,
  currentRoute,
  form,
  selectedTaskId,
  submitting,
  queueActionBusy,
  actionTaskId,
  error,
  onFormChange,
  onSubmit,
  onSeed,
  onQueueToggle,
  onSelectTask,
  onTaskAction
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
  form: TaskFormInput;
  selectedTaskId: string | null;
  submitting: boolean;
  queueActionBusy: boolean;
  actionTaskId: string | null;
  error: string | null;
  onFormChange: (patch: Partial<TaskFormInput>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSeed: () => Promise<void>;
  onQueueToggle: () => Promise<void>;
  onSelectTask: (taskId: string) => void;
  onTaskAction: (taskId: string, action: "cancel" | "retry") => Promise<void>;
}): ReactElement {
  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />
      <PageHero
        eyebrow="Workload Operations"
        title="Submit, queue, and inspect jobs without mixing in benchmark controls."
        description="The Jobs page is now purely about workload flow: create tasks, seed demo traffic, watch the queue, and act on individual task states."
        actions={
          <button
            type="button"
            disabled={queueActionBusy}
            onClick={() => void onQueueToggle()}
            className="rounded-full border border-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.26em] text-slate-200 transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dashboard.system.queuePaused ? "Resume Queue" : "Pause Queue"}
          </button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="grid gap-6">
          <section className={`${cardClasses} p-5`}>
            <div className="mb-5">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Dispatch Console</h2>
              <p className="mt-1 text-sm text-slate-400">Create a real workload and immediately see which lane it chooses.</p>
            </div>

            <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
              <label className="block">
                <span className="mb-2 block font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Task Type</span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm outline-none transition focus:border-chrome-400"
                  value={form.type}
                  onChange={(event) => onFormChange({ type: event.target.value as TaskFormInput["type"] })}
                >
                  <option value="vector_add">Vector Add</option>
                  <option value="matrix_multiply">Matrix Multiply</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Task Size</span>
                <input
                  type="number"
                  min={4}
                  max={65536}
                  className="w-full rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm outline-none transition focus:border-chrome-400"
                  value={form.size}
                  onChange={(event) => onFormChange({ size: Number(event.target.value) })}
                />
              </label>

              <label className="block">
                <span className="mb-2 block font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Priority</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.priority}
                  onChange={(event) => onFormChange({ priority: Number(event.target.value) })}
                  className="w-full accent-cyan-400"
                />
                <div className="mt-2 flex justify-between font-mono text-xs text-slate-500">
                  <span>1</span>
                  <span className="text-chrome-300">Current: {form.priority}</span>
                  <span>5</span>
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-3 font-mono text-sm uppercase tracking-[0.25em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Submit Task
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onSeed()}
                  className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.25em] text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Seed Demo Load
                </button>
              </div>
            </form>

            {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
          </section>

          <section className={`${cardClasses} p-5`}>
            <div className="mb-4">
              <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Adaptive Queue</h2>
              <p className="mt-1 text-sm text-slate-400">Waiting tasks and the reasons they were routed where they were.</p>
            </div>
            <div className="space-y-3">
              {dashboard.queue.length === 0 ? (
                <EmptyState
                  message={
                    dashboard.system.queuePaused
                      ? "Queue is paused. Resume dispatch to release waiting tasks."
                      : "Queue is clear. Submit or seed workloads to see decisions queue up."
                  }
                />
              ) : (
                dashboard.queue.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.3em] text-chrome-300">{task.id}</p>
                        <h3 className="mt-1 text-base text-white">{formatTaskType(task.type)}</h3>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
                        {task.executor.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>size {task.size}</span>
                      <span>priority {task.priority}</span>
                      <span>{task.sizeBucket}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{task.reason}</p>
                  </motion.div>
                ))
              )}
            </div>
          </section>
        </section>

        <section className={`${cardClasses} p-5`}>
          <div className="mb-4">
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Task Ledger</h2>
            <p className="mt-1 text-sm text-slate-400">Latest workloads across the whole system, with direct controls for retries and cancellations.</p>
          </div>
          <div className="space-y-3">
            {dashboard.tasks.length === 0 ? (
              <EmptyState message="No workloads yet. Submit a task or seed the demo load to populate the ledger." />
            ) : (
              dashboard.tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`rounded-2xl border bg-black/20 p-4 transition ${
                    selectedTaskId === task.id ? "border-cyan-300/40" : "border-white/10"
                  }`}
                >
                  <button type="button" onClick={() => onSelectTask(task.id)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.25em] text-chrome-300">{task.id}</p>
                        <p className="mt-1 text-sm text-white">{formatTaskType(task.type)}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
                        {task.status}
                      </span>
                    </div>
                  </button>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{formatExecutor(task.executor)}</span>
                    <span>{task.durationMs ? `${task.durationMs.toFixed(1)} ms` : `attempt ${task.attempt}`}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <span>priority {task.priority}</span>
                    <span>size {task.size}</span>
                    <span>updated {new Date(task.updatedAt).toLocaleTimeString()}</span>
                  </div>
                  {task.error ? <p className="mt-3 text-sm text-rose-200">{task.error}</p> : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={!task.canCancel || actionTaskId === task.id}
                      onClick={() => void onTaskAction(task.id, "cancel")}
                      className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!task.canRetry || actionTaskId === task.id}
                      onClick={() => void onTaskAction(task.id, "retry")}
                      className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Retry
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </section>
    </>
  );
}
