/**
 * Curated MCP server catalog.
 *
 * Each entry describes a well-known MCP server that can be installed and used
 * by the agent. The `package` field is the npm package name; the agent runtime
 * will run it via `npx -y <package> [args]`.
 *
 * Registries used for curation:
 *   - https://modelcontextprotocol.io/examples  (official reference servers)
 *   - https://github.com/modelcontextprotocol/servers  (official integrations)
 *   - https://github.com/wong2/awesome-mcp-servers  (community)
 *   - https://www.pulsemcp.com/servers  (daily-updated directory)
 *   - https://glama.ai/mcp/servers  (Glama registry)
 */

export type McpCategory =
  | 'filesystem'
  | 'browser'
  | 'database'
  | 'development'
  | 'communication'
  | 'productivity'
  | 'search'
  | 'ai'
  | 'media'
  | 'devops'
  | 'data'
  | 'security'

export type McpStatus = 'official' | 'verified' | 'community'

export type McpTransport = 'stdio' | 'sse' | 'http'

export interface McpEnvField {
  key: string
  label: string
  required: boolean
  description?: string
  placeholder?: string
}

export interface McpServer {
  id: string
  name: string
  description: string
  /** What tools it exposes (shown in the UI as chips) */
  tools: string[]
  category: McpCategory
  status: McpStatus
  transport: McpTransport
  /** npm package name — used to run via `npx -y <package>` */
  package?: string
  /** Extra positional args passed after the package name */
  args?: string[]
  /** Environment variables required or optional */
  env?: McpEnvField[]
  /** Remote SSE/HTTP endpoint (alternative to package-based stdio) */
  url?: string
  docsUrl: string
  githubUrl?: string
}

export const MCP_CATEGORY_LABELS: Record<McpCategory, string> = {
  filesystem: 'File System',
  browser: 'Browser & Web',
  database: 'Databases',
  development: 'Development',
  communication: 'Communication',
  productivity: 'Productivity',
  search: 'Search & Scraping',
  ai: 'AI & Memory',
  media: 'Media & Images',
  devops: 'DevOps & Cloud',
  data: 'Data & Analytics',
  security: 'Security',
}

// ── Official reference servers (by Anthropic / MCP team) ─────────────────────

export const MCP_SERVERS: McpServer[] = [
  // ── File System ─────────────────────────────────────────────────────────────
  {
    id: 'mcp_filesystem',
    name: 'Filesystem',
    description:
      'Secure file operations with configurable access controls. Read, write, move, search files and directories.',
    tools: ['read_file', 'write_file', 'list_directory', 'search_files', 'move_file'],
    category: 'filesystem',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-filesystem',
    args: ['/'],
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  {
    id: 'mcp_git',
    name: 'Git',
    description: 'Read, search and manipulate Git repositories. Stage, commit, diff, log, branch.',
    tools: ['git_log', 'git_diff', 'git_commit', 'git_status', 'git_branch'],
    category: 'development',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-git',
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
  },
  {
    id: 'mcp_memory',
    name: 'Memory (Knowledge Graph)',
    description:
      'Persistent memory across sessions via a local knowledge graph. Store and recall entities and relations.',
    tools: ['create_entities', 'create_relations', 'search_nodes', 'open_nodes', 'delete_entities'],
    category: 'ai',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-memory',
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
  },
  {
    id: 'mcp_fetch',
    name: 'Fetch',
    description: 'Fetch any URL and convert the content to markdown for efficient LLM consumption.',
    tools: ['fetch'],
    category: 'browser',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-fetch',
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
  },
  {
    id: 'mcp_sequential_thinking',
    name: 'Sequential Thinking',
    description:
      'Dynamic problem-solving through thought sequences. Lets the agent reason step by step and revise.',
    tools: ['sequentialthinking'],
    category: 'ai',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-sequential-thinking',
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
  },

  // ── Browser & Web ─────────────────────────────────────────────────────────
  {
    id: 'mcp_playwright',
    name: 'Playwright',
    description:
      'Full browser automation — navigate pages, click, fill forms, screenshot, scrape. Uses accessibility snapshots, no vision model needed.',
    tools: [
      'browser_navigate',
      'browser_click',
      'browser_type',
      'browser_screenshot',
      'browser_snapshot',
    ],
    category: 'browser',
    status: 'verified',
    transport: 'stdio',
    package: '@playwright/mcp',
    docsUrl: 'https://github.com/microsoft/playwright-mcp',
    githubUrl: 'https://github.com/microsoft/playwright-mcp',
  },
  {
    id: 'mcp_puppeteer',
    name: 'Puppeteer',
    description:
      'Browser automation with Puppeteer. Navigate, screenshot, click, evaluate JavaScript.',
    tools: ['puppeteer_navigate', 'puppeteer_screenshot', 'puppeteer_click', 'puppeteer_evaluate'],
    category: 'browser',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-puppeteer',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
  },
  {
    id: 'mcp_firecrawl',
    name: 'Firecrawl',
    description:
      'Powerful web scraping and crawling. Handles JS-rendered pages, PDFs, and structured extraction.',
    tools: ['firecrawl_scrape', 'firecrawl_crawl', 'firecrawl_search', 'firecrawl_extract'],
    category: 'search',
    status: 'verified',
    transport: 'stdio',
    package: 'firecrawl-mcp',
    env: [
      {
        key: 'FIRECRAWL_API_KEY',
        label: 'Firecrawl API Key',
        required: true,
        placeholder: 'fc-...',
      },
    ],
    docsUrl: 'https://docs.firecrawl.dev/mcp',
    githubUrl: 'https://github.com/mendableai/firecrawl-mcp-server',
  },
  {
    id: 'mcp_browserbase',
    name: 'Browserbase',
    description:
      'Cloud browser automation — navigate, extract data, fill forms in headless cloud browsers.',
    tools: ['browserbase_create_session', 'browserbase_navigate', 'browserbase_screenshot'],
    category: 'browser',
    status: 'verified',
    transport: 'stdio',
    package: '@browserbasehq/mcp',
    env: [
      { key: 'BROWSERBASE_API_KEY', label: 'Browserbase API Key', required: true },
      { key: 'BROWSERBASE_PROJECT_ID', label: 'Project ID', required: true },
    ],
    docsUrl: 'https://docs.browserbase.com/mcp',
    githubUrl: 'https://github.com/browserbase/mcp-server-browserbase',
  },

  // ── Databases ──────────────────────────────────────────────────────────────
  {
    id: 'mcp_postgres',
    name: 'PostgreSQL',
    description:
      'Read-only Postgres access. Run SQL queries and inspect schemas via natural language.',
    tools: ['query', 'list_tables', 'describe_table'],
    category: 'database',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-postgres',
    env: [
      {
        key: 'POSTGRES_URL',
        label: 'Connection URL',
        required: true,
        placeholder: 'postgresql://user:pass@localhost/db',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
  },
  {
    id: 'mcp_sqlite',
    name: 'SQLite',
    description:
      'Full read/write access to a local SQLite database. Query, insert, update, create tables.',
    tools: ['read_query', 'write_query', 'create_table', 'list_tables', 'describe_table'],
    category: 'database',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-sqlite',
    env: [
      {
        key: 'SQLITE_DB_PATH',
        label: 'Database Path',
        required: true,
        placeholder: '/path/to/db.sqlite',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
  },
  {
    id: 'mcp_supabase',
    name: 'Supabase',
    description:
      'Full Supabase platform access — database, auth, edge functions, storage, and realtime.',
    tools: ['execute_sql', 'list_tables', 'apply_migration', 'deploy_edge_function'],
    category: 'database',
    status: 'verified',
    transport: 'stdio',
    package: '@supabase/mcp-server-supabase',
    env: [{ key: 'SUPABASE_ACCESS_TOKEN', label: 'Access Token', required: true }],
    docsUrl: 'https://supabase.com/docs/guides/getting-started/mcp',
    githubUrl: 'https://github.com/supabase-community/supabase-mcp',
  },
  {
    id: 'mcp_redis',
    name: 'Redis',
    description:
      'Interact with Redis key-value stores. Get, set, del, expire, list, hash, pub/sub.',
    tools: ['set', 'get', 'delete', 'list', 'keys'],
    category: 'database',
    status: 'verified',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-redis',
    env: [
      {
        key: 'REDIS_URL',
        label: 'Redis URL',
        required: true,
        placeholder: 'redis://localhost:6379',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/redis',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/redis',
  },
  {
    id: 'mcp_mongodb',
    name: 'MongoDB',
    description:
      'Official MongoDB MCP. Natural language queries, collection operations, Atlas integration.',
    tools: ['find', 'insertOne', 'updateOne', 'deleteOne', 'aggregate', 'listCollections'],
    category: 'database',
    status: 'verified',
    transport: 'stdio',
    package: '@mongodb-js/mongodb-mcp-server',
    env: [
      {
        key: 'MONGODB_CONNECTION_STRING',
        label: 'Connection String',
        required: true,
        placeholder: 'mongodb+srv://...',
      },
    ],
    docsUrl: 'https://www.mongodb.com/docs/mongodb-mcp/',
    githubUrl: 'https://github.com/mongodb-js/mongodb-mcp-server',
  },

  // ── Development ────────────────────────────────────────────────────────────
  {
    id: 'mcp_github',
    name: 'GitHub',
    description:
      'Full GitHub API — repos, issues, PRs, code search, commits, releases. Official integration.',
    tools: [
      'search_repositories',
      'create_issue',
      'create_pull_request',
      'get_file_contents',
      'push_files',
    ],
    category: 'development',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-github',
    env: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'Personal Access Token',
        required: true,
        placeholder: 'ghp_...',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    id: 'mcp_gitlab',
    name: 'GitLab',
    description: 'GitLab API — repo management, issue tracking, merge requests, file operations.',
    tools: ['get_project', 'list_issues', 'create_merge_request', 'get_file', 'list_pipelines'],
    category: 'development',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-gitlab',
    env: [
      { key: 'GITLAB_PERSONAL_ACCESS_TOKEN', label: 'Personal Access Token', required: true },
      {
        key: 'GITLAB_API_URL',
        label: 'GitLab URL',
        required: false,
        placeholder: 'https://gitlab.com',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
  },
  {
    id: 'mcp_docker',
    name: 'Docker',
    description:
      'Manage Docker containers, images, volumes, networks. Run and stop containers via natural language.',
    tools: ['list_containers', 'run_container', 'stop_container', 'pull_image', 'exec_command'],
    category: 'devops',
    status: 'community',
    transport: 'stdio',
    package: 'mcp-server-docker',
    docsUrl: 'https://github.com/ckreiling/mcp-server-docker',
    githubUrl: 'https://github.com/ckreiling/mcp-server-docker',
  },
  {
    id: 'mcp_cloudflare',
    name: 'Cloudflare',
    description: 'Deploy and configure Cloudflare Workers, KV, R2, D1 via the developer platform.',
    tools: ['deploy_worker', 'list_workers', 'kv_get', 'kv_put', 'r2_upload'],
    category: 'devops',
    status: 'verified',
    transport: 'stdio',
    package: '@cloudflare/mcp-server-cloudflare',
    env: [{ key: 'CLOUDFLARE_API_TOKEN', label: 'API Token', required: true }],
    docsUrl: 'https://developers.cloudflare.com/mcp/',
    githubUrl: 'https://github.com/cloudflare/mcp-server-cloudflare',
  },
  {
    id: 'mcp_context7',
    name: 'Context7 Docs',
    description:
      'Up-to-date documentation for 9000+ libraries injected into context. Prevents hallucinated APIs.',
    tools: ['resolve-library-id', 'get-library-docs'],
    category: 'development',
    status: 'verified',
    transport: 'stdio',
    package: '@upstash/context7-mcp',
    docsUrl: 'https://context7.com',
    githubUrl: 'https://github.com/upstash/context7',
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id: 'mcp_slack',
    name: 'Slack',
    description:
      'Read messages, post to channels, manage Slack workspaces. Official Slack integration.',
    tools: [
      'slack_get_channels',
      'slack_post_message',
      'slack_reply_to_thread',
      'slack_list_users',
    ],
    category: 'communication',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-slack',
    env: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot Token', required: true, placeholder: 'xoxb-...' }],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
  },

  // ── Productivity ───────────────────────────────────────────────────────────
  {
    id: 'mcp_notion',
    name: 'Notion',
    description: 'Search, read and write Notion pages and databases. Official Notion integration.',
    tools: ['notion_search', 'notion_get_page', 'notion_create_page', 'notion_query_database'],
    category: 'productivity',
    status: 'verified',
    transport: 'stdio',
    package: '@notionhq/notion-mcp-server',
    env: [
      { key: 'NOTION_API_KEY', label: 'Integration Token', required: true, placeholder: 'ntn_...' },
    ],
    docsUrl: 'https://developers.notion.com/docs/mcp',
    githubUrl: 'https://github.com/makenotion/notion-mcp-server',
  },
  {
    id: 'mcp_google_drive',
    name: 'Google Drive',
    description: 'Search, read and export files from Google Drive. Supports Docs, Sheets, Slides.',
    tools: ['gdrive_list', 'gdrive_read', 'gdrive_search'],
    category: 'productivity',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-gdrive',
    env: [{ key: 'GDRIVE_CREDENTIALS_JSON', label: 'Credentials JSON path', required: true }],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive',
  },
  {
    id: 'mcp_zapier',
    name: 'Zapier',
    description:
      'Connect to 8000+ apps via Zapier. Trigger zaps and run automations from the agent.',
    tools: ['zapier_run_action', 'zapier_list_actions', 'zapier_search_actions'],
    category: 'productivity',
    status: 'verified',
    transport: 'sse',
    url: 'https://actions.zapier.com/mcp',
    env: [{ key: 'ZAPIER_API_KEY', label: 'Zapier API Key', required: true }],
    docsUrl: 'https://actions.zapier.com/docs/platform/mcp',
  },
  {
    id: 'mcp_n8n',
    name: 'n8n',
    description: 'Trigger and monitor n8n workflows. Manage executions and workflow automation.',
    tools: ['list_workflows', 'execute_workflow', 'get_execution'],
    category: 'productivity',
    status: 'community',
    transport: 'stdio',
    package: 'n8n-mcp',
    env: [
      {
        key: 'N8N_API_URL',
        label: 'n8n URL',
        required: true,
        placeholder: 'http://localhost:5678',
      },
      { key: 'N8N_API_KEY', label: 'API Key', required: true },
    ],
    docsUrl: 'https://docs.n8n.io/mcp/',
    githubUrl: 'https://github.com/leonardsellem/n8n-mcp-server',
  },

  // ── Search & Scraping ──────────────────────────────────────────────────────
  {
    id: 'mcp_brave_search',
    name: 'Brave Search',
    description: 'Web and local search via Brave Search API. Privacy-focused with no tracking.',
    tools: ['brave_web_search', 'brave_local_search'],
    category: 'search',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-brave-search',
    env: [{ key: 'BRAVE_API_KEY', label: 'Brave Search API Key', required: true }],
    docsUrl: 'https://brave.com/search/api/',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
  {
    id: 'mcp_tavily',
    name: 'Tavily Search',
    description:
      'AI-optimized search API. Returns clean, structured results ideal for RAG pipelines.',
    tools: ['tavily_search', 'tavily_extract'],
    category: 'search',
    status: 'verified',
    transport: 'stdio',
    package: 'tavily-mcp',
    env: [
      { key: 'TAVILY_API_KEY', label: 'Tavily API Key', required: true, placeholder: 'tvly-...' },
    ],
    docsUrl: 'https://docs.tavily.com/docs/mcp-server',
    githubUrl: 'https://github.com/tavily-ai/tavily-mcp',
  },
  {
    id: 'mcp_exa',
    name: 'Exa Search',
    description: 'Neural search optimized for AI. Search the web and get clean, LLM-ready results.',
    tools: ['web_search_exa', 'find_similar', 'get_contents'],
    category: 'search',
    status: 'verified',
    transport: 'stdio',
    package: 'exa-mcp-server',
    env: [{ key: 'EXA_API_KEY', label: 'Exa API Key', required: true }],
    docsUrl: 'https://docs.exa.ai/reference/mcp',
    githubUrl: 'https://github.com/exa-labs/exa-mcp-server',
  },

  // ── AI & Memory ────────────────────────────────────────────────────────────
  {
    id: 'mcp_mem0',
    name: 'Mem0 OpenMemory',
    description:
      'Persistent cross-session memory for agents. Store, search and recall memories semantically.',
    tools: ['add_memory', 'search_memory', 'list_memories', 'delete_memory'],
    category: 'ai',
    status: 'verified',
    transport: 'sse',
    url: 'http://localhost:8765/mcp/open-greg/sse/default',
    docsUrl: 'https://docs.mem0.ai/open-source/mcp',
    githubUrl: 'https://github.com/mem0ai/mem0',
  },

  // ── Data & Analytics ───────────────────────────────────────────────────────
  {
    id: 'mcp_duckdb',
    name: 'DuckDB',
    description:
      'Execute SQL on DuckDB — analyze CSVs, Parquet files and local data with blazing speed.',
    tools: ['query', 'describe', 'list_tables', 'import_csv'],
    category: 'data',
    status: 'community',
    transport: 'stdio',
    package: 'mcp-server-duckdb',
    env: [{ key: 'DUCKDB_PATH', label: 'Database Path', required: false, placeholder: ':memory:' }],
    docsUrl: 'https://duckdb.org',
    githubUrl: 'https://github.com/dpaquette/mcp-server-duckdb',
  },

  // ── Media & Images ─────────────────────────────────────────────────────────
  {
    id: 'mcp_everything',
    name: 'Everything (Reference)',
    description:
      'Reference test server exposing all MCP features — prompts, resources, tools. Good for debugging.',
    tools: ['echo', 'add', 'long_running_operation', 'sample_llm'],
    category: 'ai',
    status: 'official',
    transport: 'stdio',
    package: '@modelcontextprotocol/server-everything',
    docsUrl: 'https://modelcontextprotocol.io/examples',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
  },
]

export function getMcpsByCategory(): Map<McpCategory, McpServer[]> {
  const map = new Map<McpCategory, McpServer[]>()
  for (const s of MCP_SERVERS) {
    const list = map.get(s.category) ?? []
    list.push(s)
    map.set(s.category, list)
  }
  return map
}
