import type { ReactElement } from "react";
import { motion } from "framer-motion";
import type { DashboardPayload } from "../types";
import { MobilePageTabs, cardClasses, formatPolicy } from "../components/ui";
import { navigateTo, type AppRoute } from "../lib/router";

export function HomePage({
  dashboard,
  currentRoute
}: {
  dashboard: DashboardPayload;
  currentRoute: AppRoute;
}): ReactElement {
  const highlights = [
    { label: "Queued", value: dashboard.summary.queued },
    { label: "Completed", value: dashboard.summary.completed },
    { label: "Policy", value: formatPolicy(dashboard.system.activePolicy) },
    { label: "Snapshots", value: dashboard.explainability.snapshots.length }
  ];

  return (
    <>
      <MobilePageTabs currentRoute={currentRoute} />

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className={`${cardClasses} overflow-hidden p-8 sm:p-10`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.32em] text-cyan-100">
              Intelligent CPU-GPU Hybrid Scheduler
            </div>
            <h1 className="mt-8 font-display text-5xl leading-[0.92] tracking-[0.05em] text-white sm:text-6xl lg:text-7xl">
              AstraCompute
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Built for Apple Silicon workloads that need more than a queue. Route compute across CPU and GPU lanes,
              compare outcomes, and steer the system from a cleaner multi-page control surface.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ActionButton label="Open Overview" route="/overview" accent="solid" />
              <ActionButton label="Launch Jobs" route="/jobs" accent="outlined" />
              <ActionButton label="View Benchmarks" route="/benchmarks" accent="outlined" />
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {highlights.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.05 }}
                className="rounded-full border border-white/10 bg-black/20 px-4 py-3"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-chrome-300">{item.label}</span>
                <span className="ml-3 text-sm text-white">{item.value}</span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`${cardClasses} relative overflow-hidden p-8`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(66,215,255,0.16),transparent_34%)]" />
          <div className="relative flex min-h-[520px] items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute h-80 w-80 rounded-full border border-cyan-300/15"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="absolute h-[24rem] w-[24rem] rounded-full border border-emerald-300/10"
            />
            <motion.div
              animate={{ scale: [1, 1.04, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 5.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="absolute h-40 w-40 rounded-full bg-gradient-to-br from-cyan-300/30 via-sky-400/10 to-emerald-300/25 blur-2xl"
            />

            <div className="relative z-10 grid w-full gap-4">
              <FeatureStrip
                title="Adaptive Routing"
                detail="Small vector work stays light on CPU, larger matrix jobs move toward the GPU lane."
              />
              <FeatureStrip
                title="Sectioned Flow"
                detail="Home, Overview, Jobs, Benchmarks, Policies, and System each hold one job instead of sharing one crowded canvas."
              />
              <FeatureStrip
                title="Motion Field"
                detail="Animated layers, responsive hover states, and deliberate spacing keep the entry feeling designed rather than templated."
              />
            </div>
          </div>
        </motion.section>
      </section>
    </>
  );
}

function ActionButton({
  label,
  route,
  accent
}: {
  label: string;
  route: AppRoute;
  accent: "solid" | "outlined";
}): ReactElement {
  return (
    <button
      type="button"
      onClick={() => navigateTo(route)}
      className={`rounded-full px-5 py-3 font-mono text-[11px] uppercase tracking-[0.28em] transition duration-200 hover:-translate-y-0.5 ${
        accent === "solid"
          ? "bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 shadow-[0_16px_40px_rgba(66,215,255,0.24)] hover:brightness-105"
          : "border border-white/10 bg-white/5 text-slate-100 hover:border-cyan-300/30 hover:bg-cyan-400/10"
      }`}
    >
      {label}
    </button>
  );
}

function FeatureStrip({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">{title}</div>
      <p className="mt-3 text-sm leading-7 text-slate-300">{detail}</p>
    </div>
  );
}
