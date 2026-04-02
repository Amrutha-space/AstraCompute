import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DashboardPayload } from "../types";
import {
  ChartPanel,
  EmptyState,
  MetricCard,
  MobilePageTabs,
  PageHero,
  cardClasses,
  distributionColors,
  formatPolicy,
  tooltipStyle
} from "../components/ui";
import type { AppRoute } from "../lib/router";

export function BenchmarksPage({
  dashboard,
  currentRoute,
  snapshotName,
  snapshotBusy,
  onSnapshotNameChange,
  onCreateSnapshot
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
  snapshotName: string;
  snapshotBusy: boolean;
  onSnapshotNameChange: (value: string) => void;
  onCreateSnapshot: () => Promise<void>;
}): ReactElement {
  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />
      <PageHero
        eyebrow="Benchmark Intelligence"
        title="Keep performance analytics on their own page."
        description="Benchmarks, archive snapshots, and routing comparisons are separated from day-to-day workload controls so operators can focus on one job at a time."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <MetricCard
          label="Scheduler Win Rate"
          value={`${dashboard.explainability.benchmark.overview.winRatePct.toFixed(1)}%`}
          caption="Completed tasks whose actual duration beat the baseline estimate."
        />
        <MetricCard
          label="Average Speedup"
          value={`${dashboard.explainability.benchmark.overview.averageSpeedupPct.toFixed(1)}%`}
          caption="Estimated improvement versus the alternative executor."
        />
        <MetricCard
          label="Adaptive Share"
          value={`${dashboard.explainability.benchmark.overview.adaptiveSharePct.toFixed(1)}%`}
          caption="How often historical performance overrode the default heuristic."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <ChartPanel title="CPU vs GPU Performance" subtitle="Average runtime per executor">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dashboard.metrics.performance}>
              <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="executor" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="averageMs" radius={[10, 10, 0, 0]}>
                {dashboard.metrics.performance.map((entry) => (
                  <Cell key={entry.executor} fill={entry.executor === "CPU" ? "#42d7ff" : "#7cff9f"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Task Distribution" subtitle="Executor mix and queue pressure">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={dashboard.metrics.distribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                {dashboard.metrics.distribution.map((entry, index) => (
                  <Cell key={entry.name} fill={distributionColors[index % distributionColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <ChartPanel title="Policy Comparison" subtitle="Benchmark outcomes grouped by scheduling mode">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dashboard.explainability.benchmark.policyBreakdown}>
              <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="policyMode" stroke="#94a3b8" tickFormatter={(value) => value.replace("_", " ")} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="winRatePct" name="Win rate %" fill="#42d7ff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="averageSpeedupPct" name="Speedup %" fill="#7cff9f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Benchmark Bands" subtitle="Measured behavior by workload size bucket">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dashboard.explainability.benchmark.sizeBucketBreakdown}>
              <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
              <XAxis dataKey="sizeBucket" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="averageActualMs" name="Actual ms" fill="#42d7ff" radius={[8, 8, 0, 0]} />
              <Bar dataKey="averageProjectedGainMs" name="Projected gain ms" fill="#7cff9f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <section className={`${cardClasses} p-5`}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl tracking-[0.2em] text-chrome-300">Benchmark Archive</h2>
            <p className="mt-1 text-sm text-slate-400">Save a named snapshot so you can compare policy outcomes over time.</p>
          </div>
          <div className="flex gap-3">
            <input
              value={snapshotName}
              onChange={(event) => onSnapshotNameChange(event.target.value)}
              placeholder="Snapshot name"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm outline-none transition focus:border-chrome-400"
            />
            <button
              type="button"
              disabled={snapshotBusy}
              onClick={() => void onCreateSnapshot()}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 font-mono text-sm uppercase tracking-[0.24em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.explainability.snapshots.length === 0 ? (
            <EmptyState message="No benchmark snapshots saved yet." />
          ) : (
            dashboard.explainability.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.25em] text-chrome-300">{snapshot.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{new Date(snapshot.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-200">
                    {formatPolicy(snapshot.policyMode)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <SnapshotMetric label="Win" value={`${snapshot.summary.overview.winRatePct.toFixed(0)}%`} />
                  <SnapshotMetric label="Speedup" value={`${snapshot.summary.overview.averageSpeedupPct.toFixed(1)}%`} />
                  <SnapshotMetric label="Tasks" value={snapshot.summary.overview.completedTasks} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string | number }): ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm text-white">{value}</div>
    </div>
  );
}
