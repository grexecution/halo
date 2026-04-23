import Database from 'better-sqlite3'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIR = join(homedir(), '.open-greg')
const DB_PATH = join(DIR, 'app.db')

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  ensureDir()
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)
  migrateSchema(_db)
  migrateJson(_db)
  migrateJsonV2(_db)
  return _db
}

// Additive column migrations — safe to run on existing DBs
function migrateSchema(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(agents)').all() as { name: string }[]).map(
    (c) => c.name,
  )
  if (!cols.includes('fallback_models')) {
    db.exec("ALTER TABLE agents ADD COLUMN fallback_models TEXT NOT NULL DEFAULT '[]'")
  }

  // New tables added after initial schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      agent_id TEXT NOT NULL DEFAULT 'greg',
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL DEFAULT 'greg',
      chat_id TEXT,
      goal_id TEXT,
      trigger TEXT NOT NULL DEFAULT 'chat',
      status TEXT NOT NULL DEFAULT 'running',
      input TEXT NOT NULL DEFAULT '',
      output TEXT,
      tool_calls TEXT NOT NULL DEFAULT '[]',
      token_count INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);

    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'upload',
      source_url TEXT,
      content TEXT NOT NULL DEFAULT '',
      chunk_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      workspace_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS agents (
      handle TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      fallback_models TEXT NOT NULL DEFAULT '[]',
      system_prompt TEXT NOT NULL DEFAULT '',
      tools TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      description TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_fields (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      key_name TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      field_type TEXT NOT NULL DEFAULT 'text',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workspace_documents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Document',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_at TEXT
    );
    CREATE TABLE IF NOT EXISTS crons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      goal TEXT,
      command TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_run_at TEXT,
      last_run_status TEXT,
      next_run_at TEXT,
      run_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT,
      type TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      username TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT NOT NULL DEFAULT '',
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT NOT NULL DEFAULT '',
      session_secret TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tunnel (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      running INTEGER NOT NULL DEFAULT 0,
      url TEXT,
      pid INTEGER,
      started_at TEXT,
      mode TEXT NOT NULL DEFAULT 'quick'
    );
    CREATE TABLE IF NOT EXISTS hub_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plugin_credentials (
      plugin_id TEXT PRIMARY KEY,
      fields TEXT NOT NULL DEFAULT '{}',
      connected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- User-defined custom plugins (extends the built-in plugin catalog)
    CREATE TABLE IF NOT EXISTS custom_plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      docs_url TEXT NOT NULL DEFAULT '',
      usage_note TEXT NOT NULL DEFAULT '',
      fields_schema TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Installed MCP servers (references MCP_SERVERS catalog + custom entries)
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      catalog_id TEXT,
      name TEXT NOT NULL,
      package TEXT,
      url TEXT,
      transport TEXT NOT NULL DEFAULT 'stdio',
      env TEXT NOT NULL DEFAULT '{}',
      args TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'stopped',
      installed_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_started_at TEXT
    );

    -- User-created skills (extends the built-in DEFAULT_SKILLS catalog)
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'productivity',
      tags TEXT NOT NULL DEFAULT '[]',
      system_prompt TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '[]',
      example_trigger TEXT NOT NULL DEFAULT '',
      docs_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      agent_id TEXT NOT NULL DEFAULT 'greg',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
  `)
}

function tryReadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

interface MigrAgent {
  handle: string
  name: string
  model: string
  systemPrompt: string
  tools: { shell: boolean; browser: boolean; filesystem: boolean; gui: boolean }
}
interface MigrField {
  id: string
  key: string
  value: string
  type: string
}
interface MigrWorkspace {
  id: string
  name: string
  type: string
  description: string
  emoji: string
  fields: MigrField[]
  active: boolean
  createdAt: string
  updatedAt: string
}
interface MigrGoal {
  id: string
  title: string
  description?: string
  priority: number
  status: string
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}
interface MigrCron {
  id: string
  name: string
  schedule: string
  goal?: string
  command?: string
  active: boolean
  createdAt: string
  lastRunAt?: string
  lastRunStatus?: string
  nextRunAt?: string
  runCount: number
}
interface MigrMemory {
  id: string
  content: string
  source: string
  sourceId?: string
  type: string
  tags: string[]
  metadata: Record<string, string>
  createdAt: string
  updatedAt: string
}

function migrateJson(db: Database.Database) {
  const flag = join(DIR, 'app-migrated.flag')
  if (existsSync(flag)) return

  const agents = tryReadJson<MigrAgent[]>(join(DIR, 'agents.json'))
  if (Array.isArray(agents)) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO agents (handle, name, model, system_prompt, tools) VALUES (?, ?, ?, ?, ?)',
    )
    for (const a of agents)
      stmt.run(a.handle, a.name, a.model, a.systemPrompt ?? '', JSON.stringify(a.tools ?? {}))
  }

  const wsFile = tryReadJson<{ workspaces: MigrWorkspace[] }>(join(DIR, 'workspaces.json'))
  if (wsFile?.workspaces) {
    const wsStmt = db.prepare(
      'INSERT OR IGNORE INTO workspaces (id, name, type, description, emoji, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    const fldStmt = db.prepare(
      'INSERT OR IGNORE INTO workspace_fields (id, workspace_id, key_name, value, field_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const ws of wsFile.workspaces) {
      wsStmt.run(
        ws.id,
        ws.name,
        ws.type,
        ws.description ?? '',
        ws.emoji ?? '',
        ws.active ? 1 : 0,
        ws.createdAt,
        ws.updatedAt,
      )
      for (let i = 0; i < (ws.fields ?? []).length; i++) {
        const f = ws.fields[i]!
        fldStmt.run(f.id, ws.id, f.key, f.value ?? '', f.type ?? 'text', i)
      }
    }
  }

  const settings = tryReadJson<object>(join(DIR, 'settings.json'))
  if (settings) {
    db.prepare('INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)').run(
      JSON.stringify(settings),
    )
  }

  const goalsFile = tryReadJson<{ goals: MigrGoal[] }>(join(DIR, 'goals.json'))
  if (goalsFile?.goals) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO goals (id, title, description, priority, status, created_at, updated_at, last_run_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const g of goalsFile.goals)
      stmt.run(
        g.id,
        g.title,
        g.description ?? null,
        g.priority,
        g.status,
        g.createdAt,
        g.updatedAt,
        g.lastRunAt ?? null,
      )
  }

  const cronsFile = tryReadJson<{ jobs: MigrCron[] }>(join(DIR, 'crons.json'))
  if (cronsFile?.jobs) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO crons (id, name, schedule, goal, command, active, created_at, last_run_at, last_run_status, next_run_at, run_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const c of cronsFile.jobs)
      stmt.run(
        c.id,
        c.name,
        c.schedule,
        c.goal ?? null,
        c.command ?? null,
        c.active ? 1 : 0,
        c.createdAt,
        c.lastRunAt ?? null,
        c.lastRunStatus ?? null,
        c.nextRunAt ?? null,
        c.runCount,
      )
  }

  const memFile = tryReadJson<{ entries: MigrMemory[] }>(join(DIR, 'memories.json'))
  if (memFile?.entries) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const m of memFile.entries)
      stmt.run(
        m.id,
        m.content,
        m.source,
        m.sourceId ?? null,
        m.type,
        JSON.stringify(m.tags ?? []),
        JSON.stringify(m.metadata ?? {}),
        m.createdAt,
        m.updatedAt,
      )
  }

  writeFileSync(flag, new Date().toISOString(), 'utf-8')
}

function migrateJsonV2(db: Database.Database) {
  const flag = join(DIR, 'app-migrated-v2.flag')
  if (existsSync(flag)) return

  // auth.json → auth table
  interface MigrAuth {
    enabled?: boolean
    username?: string
    passwordHash?: string
    totpEnabled?: boolean
    totpSecret?: string
    sessionSecret?: string
  }
  const auth = tryReadJson<MigrAuth>(join(DIR, 'auth.json'))
  if (auth) {
    db.prepare(
      `INSERT OR IGNORE INTO auth (id, enabled, username, password_hash, totp_enabled, totp_secret, session_secret)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
    ).run(
      auth.enabled ? 1 : 0,
      auth.username ?? 'admin',
      auth.passwordHash ?? '',
      auth.totpEnabled ? 1 : 0,
      auth.totpSecret ?? '',
      auth.sessionSecret ?? '',
    )
  }

  // tunnel.json → tunnel table
  interface MigrTunnel {
    running?: boolean
    url?: string | null
    pid?: number | null
    startedAt?: string | null
    mode?: string
  }
  const tunnel = tryReadJson<MigrTunnel>(join(DIR, 'tunnel.json'))
  if (tunnel) {
    db.prepare(
      `INSERT OR IGNORE INTO tunnel (id, running, url, pid, started_at, mode)
       VALUES (1, ?, ?, ?, ?, ?)`,
    ).run(
      tunnel.running ? 1 : 0,
      tunnel.url ?? null,
      tunnel.pid ?? null,
      tunnel.startedAt ?? null,
      tunnel.mode ?? 'quick',
    )
  }

  // plugin-credentials.json → plugin_credentials table
  interface MigrPluginCred {
    pluginId: string
    fields: Record<string, string>
    connectedAt: string
  }
  const pluginCreds = tryReadJson<Record<string, MigrPluginCred>>(
    join(DIR, 'plugin-credentials.json'),
  )
  if (pluginCreds) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO plugin_credentials (plugin_id, fields, connected_at) VALUES (?, ?, ?)',
    )
    for (const entry of Object.values(pluginCreds)) {
      stmt.run(entry.pluginId, JSON.stringify(entry.fields ?? {}), entry.connectedAt)
    }
  }

  // instances.json → hub_instances table
  interface MigrInstance {
    id: string
    name: string
    url: string
    addedAt: string
  }
  const instances = tryReadJson<MigrInstance[]>(join(DIR, 'instances.json'))
  if (Array.isArray(instances)) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO hub_instances (id, name, url, added_at) VALUES (?, ?, ?, ?)',
    )
    for (const inst of instances) {
      stmt.run(inst.id, inst.name, inst.url, inst.addedAt)
    }
  }

  writeFileSync(flag, new Date().toISOString(), 'utf-8')
}
