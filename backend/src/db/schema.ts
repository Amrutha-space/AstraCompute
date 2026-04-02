export const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      priority INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      status TEXT NOT NULL,
      executor TEXT,
      result_json TEXT,
      error TEXT,
      updated_at TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      origin_task_id TEXT,
      decision_reason TEXT
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_submitted_at ON tasks(submitted_at DESC)",
  `
    CREATE TABLE IF NOT EXISTS execution_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      executor TEXT NOT NULL,
      time_ms REAL NOT NULL,
      status TEXT NOT NULL,
      task_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      priority INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      error TEXT
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_execution_records_completed_at ON execution_records(completed_at DESC)",
  `
    CREATE TABLE IF NOT EXISTS decision_traces (
      task_id TEXT PRIMARY KEY,
      policy_mode TEXT NOT NULL,
      recommended_executor TEXT NOT NULL,
      heuristic_executor TEXT NOT NULL,
      decision_mode TEXT NOT NULL,
      reason TEXT NOT NULL,
      size_bucket TEXT NOT NULL,
      cpu_estimate_ms REAL NOT NULL,
      gpu_estimate_ms REAL NOT NULL,
      selected_executor TEXT NOT NULL,
      baseline_executor TEXT NOT NULL,
      baseline_estimate_ms REAL NOT NULL,
      projected_gain_ms REAL NOT NULL,
      decided_at TEXT NOT NULL,
      dispatched_at TEXT,
      completed_at TEXT,
      queue_wait_ms REAL,
      actual_duration_ms REAL,
      status TEXT NOT NULL
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_decision_traces_completed_at ON decision_traces(completed_at DESC)",
  `
    CREATE TABLE IF NOT EXISTS benchmark_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      policy_mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      summary_json TEXT NOT NULL
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_created_at ON benchmark_snapshots(created_at DESC)",
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
  `
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)",
  `
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `
];
