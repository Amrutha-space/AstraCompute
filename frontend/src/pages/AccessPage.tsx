import { useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import type { DemoCredentials, HealthStatus } from "../types";
import { cardClasses } from "../components/ui";

type AccessMode = "login" | "signup";

export function AccessPage({
  health,
  demoCredentials,
  loading,
  error,
  onLogin,
  onSignUp
}: {
  health: HealthStatus | null;
  demoCredentials: DemoCredentials | null;
  loading: boolean;
  error: string | null;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onSignUp: (input: { name: string; email: string; password: string }) => Promise<void>;
}): ReactElement {
  const [mode, setMode] = useState<AccessMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (mode === "login") {
      await onLogin({ email, password });
      return;
    }

    await onSignUp({ name, email, password });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`${cardClasses} overflow-hidden p-8 sm:p-10`}>
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.32em] text-cyan-100">
            Account Access
          </div>
          <h1 className="mt-8 font-display text-5xl leading-[0.96] tracking-[0.05em] text-white sm:text-6xl">
            Enter the AstraCompute workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Create an account for real-user testing, or use the seeded local demo account to move through the product
            without changing the backend setup.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <FeatureTile title="Real Accounts" detail="Use sign up for genuine user testing and repeat sessions." />
          <FeatureTile title="Local Demo" detail="Instant access remains available for reviewers who just need to explore." />
          <FeatureTile title="Protected Pages" detail="Overview, Jobs, Benchmarks, Policies, and System all require a real session." />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className={`${cardClasses} p-6 sm:p-8`}
      >
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/20 p-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full px-4 py-3 font-mono text-[11px] uppercase tracking-[0.24em] transition ${
              mode === "login" ? "bg-cyan-400/15 text-cyan-100" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full px-4 py-3 font-mono text-[11px] uppercase tracking-[0.24em] transition ${
              mode === "signup" ? "bg-cyan-400/15 text-cyan-100" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {mode === "signup" ? (
            <label className="block">
              <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-slate-400">Name</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-chrome-400"
                placeholder="Your display name"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-slate-400">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-chrome-400"
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-mono text-xs uppercase tracking-[0.28em] text-slate-400">Password</span>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-chrome-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-chrome-400"
              placeholder="At least 8 characters"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-3 font-mono text-sm uppercase tracking-[0.25em] text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Working" : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        {demoCredentials ? (
          <div className="mt-5 rounded-3xl border border-emerald-300/15 bg-emerald-400/8 p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-100">Demo Access</div>
            <p className="mt-3 text-sm leading-7 text-slate-200">
              {demoCredentials.email}
              <br />
              {demoCredentials.password}
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setEmail(demoCredentials.email);
                setPassword(demoCredentials.password);
              }}
              className="mt-4 rounded-full border border-emerald-200/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-50 transition hover:bg-emerald-400/10"
            >
              Use Demo Credentials
            </button>
          </div>
        ) : null}

        <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">Backend Status</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {health?.ok ? "Backend is reachable and ready for account-based testing." : "Waiting for backend connectivity."}
          </p>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
      </motion.section>
    </section>
  );
}

function FeatureTile({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-chrome-300">{title}</div>
      <p className="mt-3 text-sm leading-7 text-slate-300">{detail}</p>
    </div>
  );
}
