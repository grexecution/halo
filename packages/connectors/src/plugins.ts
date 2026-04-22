export type ConnectionType = 'api_key' | 'oauth' | 'mcp_server' | 'credentials' | 'webhook'
export type PluginCategory =
  | 'workspace'
  | 'project_management'
  | 'communication'
  | 'crm'
  | 'development'
  | 'storage'
  | 'analytics'
  | 'email_marketing'
  | 'calendar'
  | 'finance'
  | 'seo'
  | 'hosting'
  | 'database'
  | 'ai'

export interface PluginField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'email' | 'select'
  required: boolean
  placeholder?: string
  options?: string[]
  helpUrl?: string
}

export interface Plugin {
  id: string
  name: string
  description: string
  category: PluginCategory
  logo?: string
  connectionType: ConnectionType
  mcpPackage?: string
  fields: PluginField[]
  setupUrl?: string
  docsUrl?: string
  status: 'official' | 'beta' | 'community' | 'planned'
  supportsMultiple?: boolean
}

export const ALL_PLUGINS: Plugin[] = [
  // ── Google Workspace ─────────────────────────────────────────────────────
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and manage emails. Label-based triggers for agent sessions.',
    category: 'workspace',
    connectionType: 'oauth',
    mcpPackage: '@googleworkspace/mcp',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    status: 'official',
    supportsMultiple: true,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Read and create calendar events, check availability.',
    category: 'calendar',
    connectionType: 'oauth',
    mcpPackage: '@googleworkspace/mcp',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    status: 'official',
    supportsMultiple: true,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'List, read, create, and upload files in Drive.',
    category: 'storage',
    connectionType: 'oauth',
    mcpPackage: '@googleworkspace/mcp',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    status: 'official',
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Create, read, and edit Google Docs documents.',
    category: 'workspace',
    connectionType: 'oauth',
    mcpPackage: '@googleworkspace/mcp',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    status: 'official',
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Read and write spreadsheet data, run formulas.',
    category: 'workspace',
    connectionType: 'oauth',
    mcpPackage: '@googleworkspace/mcp',
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    status: 'official',
  },

  // ── Microsoft 365 ─────────────────────────────────────────────────────────
  {
    id: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    description: 'Read, send, and manage Outlook emails and calendars.',
    category: 'workspace',
    connectionType: 'oauth',
    fields: [
      { key: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
      { key: 'client_id', label: 'App (Client) ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    status: 'community',
    supportsMultiple: true,
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Send messages, manage channels, read conversations.',
    category: 'communication',
    connectionType: 'oauth',
    fields: [
      { key: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
      { key: 'client_id', label: 'App (Client) ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    status: 'community',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Browse, read, and upload files on OneDrive.',
    category: 'storage',
    connectionType: 'oauth',
    fields: [
      { key: 'tenant_id', label: 'Azure Tenant ID', type: 'text', required: true },
      { key: 'client_id', label: 'App (Client) ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
    status: 'community',
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels, send messages, manage workspaces.',
    category: 'communication',
    connectionType: 'oauth',
    mcpPackage: '@slack/mcp-server',
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token (xoxb-...)',
        type: 'password',
        required: true,
        placeholder: 'xoxb-...',
      },
    ],
    setupUrl: 'https://api.slack.com/apps',
    docsUrl: 'https://slack.com/intl/en-gb/blog/news/mcp-real-time-search-api-now-available',
    status: 'official',
    supportsMultiple: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Send messages to Discord channels via bot or webhook.',
    category: 'communication',
    connectionType: 'api_key',
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', required: true },
      { key: 'webhook_url', label: 'Webhook URL (optional)', type: 'url', required: false },
    ],
    setupUrl: 'https://discord.com/developers/applications',
    status: 'community',
    supportsMultiple: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Built-in Telegram bot with voice, approvals, and inline keyboards.',
    category: 'communication',
    connectionType: 'api_key',
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: '123456:ABC-DEF...',
      },
      {
        key: 'allowed_chat_ids',
        label: 'Allowed Chat IDs (comma-separated)',
        type: 'text',
        required: false,
      },
    ],
    setupUrl: 'https://t.me/BotFather',
    status: 'official',
    supportsMultiple: true,
  },

  // ── Project Management ─────────────────────────────────────────────────────
  {
    id: 'github',
    name: 'GitHub',
    description: 'Manage issues, PRs, repos, code search, and deployments.',
    category: 'development',
    connectionType: 'api_key',
    mcpPackage: '@modelcontextprotocol/server-github',
    fields: [
      {
        key: 'personal_access_token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
      },
    ],
    setupUrl: 'https://github.com/settings/tokens',
    status: 'official',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Manage issues, merge requests, pipelines, and repositories.',
    category: 'development',
    connectionType: 'api_key',
    fields: [
      { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
      {
        key: 'base_url',
        label: 'GitLab URL',
        type: 'url',
        required: false,
        placeholder: 'https://gitlab.com',
      },
    ],
    setupUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    status: 'community',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Create, update, and query Linear issues and projects.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
    setupUrl: 'https://linear.app/settings/api',
    status: 'community',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and write Notion pages, databases, and blocks.',
    category: 'project_management',
    connectionType: 'api_key',
    mcpPackage: '@notion/mcp-server',
    fields: [
      { key: 'integration_token', label: 'Integration Token', type: 'password', required: true },
    ],
    setupUrl: 'https://www.notion.so/profile/integrations',
    status: 'official',
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Manage tasks, projects, and teams in Asana.',
    category: 'project_management',
    connectionType: 'oauth',
    mcpPackage: '@asana/mcp-server',
    fields: [
      {
        key: 'personal_access_token',
        label: 'Personal Access Token',
        type: 'password',
        required: true,
      },
    ],
    setupUrl: 'https://app.asana.com/0/my-apps',
    docsUrl: 'https://developers.asana.com/docs/using-asanas-mcp-server',
    status: 'official',
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Create and manage Jira issues, sprints, and boards.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [
      { key: 'email', label: 'Atlassian Email', type: 'email', required: true },
      { key: 'api_token', label: 'API Token', type: 'password', required: true },
      {
        key: 'base_url',
        label: 'Jira Cloud URL',
        type: 'url',
        required: true,
        placeholder: 'https://yourorg.atlassian.net',
      },
    ],
    setupUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    status: 'community',
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Manage Trello boards, lists, and cards.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'text', required: true },
      { key: 'token', label: 'Token', type: 'password', required: true },
    ],
    setupUrl: 'https://trello.com/power-ups/admin',
    status: 'community',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    description: 'Manage Monday.com boards, items, and automations.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
    setupUrl: 'https://auth.monday.com/users/sign_up_new#developer',
    status: 'community',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Full ClickUp integration: tasks, docs, chat, goals, and CRM.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'Personal API Token', type: 'password', required: true }],
    setupUrl: 'https://app.clickup.com/settings/apps',
    status: 'community',
    supportsMultiple: false,
  },
  {
    id: 'todoist',
    name: 'Todoist',
    description: 'Create and manage Todoist tasks and projects.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
    setupUrl: 'https://app.todoist.com/app/settings/integrations/developer',
    status: 'official',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Read and write Airtable bases, tables, and records.',
    category: 'project_management',
    connectionType: 'api_key',
    fields: [
      { key: 'api_key', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'base_id', label: 'Base ID (optional)', type: 'text', required: false },
    ],
    setupUrl: 'https://airtable.com/create/tokens',
    status: 'community',
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Manage contacts, companies, deals, and activities.',
    category: 'crm',
    connectionType: 'api_key',
    mcpPackage: '@hubspot/mcp-server',
    fields: [
      { key: 'access_token', label: 'Private App Access Token', type: 'password', required: true },
    ],
    setupUrl: 'https://app.hubspot.com/private-apps',
    docsUrl: 'https://developers.hubspot.com/mcp',
    status: 'official',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRUD on Salesforce objects, leads, opportunities, cases.',
    category: 'crm',
    connectionType: 'oauth',
    fields: [
      { key: 'client_id', label: 'Connected App Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
      { key: 'instance_url', label: 'Salesforce Instance URL', type: 'url', required: true },
    ],
    setupUrl: 'https://login.salesforce.com',
    status: 'official',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Manage Pipedrive deals, contacts, and activities.',
    category: 'crm',
    connectionType: 'api_key',
    fields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
    setupUrl: 'https://app.pipedrive.com/settings#api',
    status: 'community',
  },

  // ── Development & Hosting ─────────────────────────────────────────────────
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Manage deployments, env vars, domains, and project settings.',
    category: 'hosting',
    connectionType: 'api_key',
    mcpPackage: '@vercel/mcp-adapter',
    fields: [
      { key: 'token', label: 'API Token', type: 'password', required: true },
      { key: 'team_id', label: 'Team ID (optional)', type: 'text', required: false },
    ],
    setupUrl: 'https://vercel.com/account/tokens',
    status: 'official',
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Deploy, manage services, and check deployment logs.',
    category: 'hosting',
    connectionType: 'api_key',
    fields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
    setupUrl: 'https://railway.app/account/tokens',
    status: 'community',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'Manage DNS, Workers, Pages, R2 storage, and security rules.',
    category: 'hosting',
    connectionType: 'api_key',
    fields: [
      { key: 'api_token', label: 'API Token', type: 'password', required: true },
      { key: 'account_id', label: 'Account ID', type: 'text', required: true },
    ],
    setupUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    status: 'community',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Query databases, manage auth users, and trigger edge functions.',
    category: 'database',
    connectionType: 'api_key',
    mcpPackage: '@supabase/mcp-server-supabase',
    fields: [
      { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'project_ref', label: 'Project Ref', type: 'text', required: false },
    ],
    setupUrl: 'https://app.supabase.com/account/tokens',
    status: 'official',
  },
  {
    id: 'aws_s3',
    name: 'AWS S3',
    description: 'List, read, upload, and delete S3 objects.',
    category: 'storage',
    connectionType: 'credentials',
    fields: [
      { key: 'access_key_id', label: 'Access Key ID', type: 'text', required: true },
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
    ],
    setupUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
    status: 'community',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Query charges, customers, invoices, and subscriptions.',
    category: 'finance',
    connectionType: 'api_key',
    mcpPackage: '@stripe/mcp',
    fields: [
      {
        key: 'secret_key',
        label: 'Secret Key (sk_...)',
        type: 'password',
        required: true,
        placeholder: 'sk_live_...',
      },
    ],
    setupUrl: 'https://dashboard.stripe.com/apikeys',
    status: 'official',
  },

  // ── Storage ───────────────────────────────────────────────────────────────
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Browse, read, upload, and share Dropbox files.',
    category: 'storage',
    connectionType: 'oauth',
    fields: [{ key: 'access_token', label: 'Access Token', type: 'password', required: true }],
    setupUrl: 'https://www.dropbox.com/developers/apps',
    docsUrl: 'https://help.dropbox.com/integrations/connect-dropbox-mcp-server',
    status: 'official',
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Manage Box files, folders, and collaborations.',
    category: 'storage',
    connectionType: 'oauth',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://app.box.com/developers/console',
    status: 'community',
  },

  // ── Calendar ─────────────────────────────────────────────────────────────
  {
    id: 'apple_calendar',
    name: 'Apple Calendar',
    description: 'Read and create events via CalDAV protocol.',
    category: 'calendar',
    connectionType: 'credentials',
    fields: [
      {
        key: 'caldav_url',
        label: 'CalDAV URL',
        type: 'url',
        required: true,
        placeholder: 'https://caldav.icloud.com',
      },
      { key: 'username', label: 'Apple ID', type: 'email', required: true },
      { key: 'app_password', label: 'App-Specific Password', type: 'password', required: true },
    ],
    setupUrl: 'https://appleid.apple.com/account/manage',
    status: 'community',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Manage Calendly scheduling links and booked events.',
    category: 'calendar',
    connectionType: 'api_key',
    fields: [
      { key: 'api_token', label: 'Personal Access Token', type: 'password', required: true },
    ],
    setupUrl: 'https://calendly.com/integrations/api_webhooks',
    status: 'community',
  },

  // ── Email Marketing ───────────────────────────────────────────────────────
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Send transactional emails and manage marketing campaigns.',
    category: 'email_marketing',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
    setupUrl: 'https://app.sendgrid.com/settings/api_keys',
    status: 'community',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Manage email lists, campaigns, and automations.',
    category: 'email_marketing',
    connectionType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true },
      {
        key: 'server_prefix',
        label: 'Server Prefix',
        type: 'text',
        required: true,
        placeholder: 'us6',
      },
    ],
    setupUrl: 'https://admin.mailchimp.com/account/api/',
    status: 'community',
  },

  // ── Analytics & SEO ───────────────────────────────────────────────────────
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Query GA4 reports: traffic, conversions, events.',
    category: 'analytics',
    connectionType: 'oauth',
    fields: [
      { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true },
      {
        key: 'service_account_json',
        label: 'Service Account JSON',
        type: 'password',
        required: true,
      },
    ],
    setupUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    status: 'community',
  },
  {
    id: 'ahrefs',
    name: 'Ahrefs',
    description: 'Query backlinks, keywords, site explorer, and content audit.',
    category: 'seo',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
    setupUrl: 'https://app.ahrefs.com/api',
    status: 'community',
  },
  {
    id: 'semrush',
    name: 'Semrush',
    description: 'Query keyword rankings, domain analytics, and competitor data.',
    category: 'seo',
    connectionType: 'api_key',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
    setupUrl: 'https://www.semrush.com/api-analytics/',
    status: 'community',
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Query Mixpanel events, funnels, and user cohorts.',
    category: 'analytics',
    connectionType: 'api_key',
    fields: [
      {
        key: 'service_account_username',
        label: 'Service Account Username',
        type: 'text',
        required: true,
      },
      {
        key: 'service_account_secret',
        label: 'Service Account Secret',
        type: 'password',
        required: true,
      },
      { key: 'project_id', label: 'Project ID', type: 'text', required: true },
    ],
    setupUrl: 'https://mixpanel.com/settings/project/serviceaccounts',
    status: 'community',
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Query invoices, expenses, customers, and accounting data.',
    category: 'finance',
    connectionType: 'oauth',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    status: 'community',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Manage Xero invoices, bills, contacts, and bank feeds.',
    category: 'finance',
    connectionType: 'oauth',
    fields: [
      { key: 'client_id', label: 'OAuth 2.0 Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
    setupUrl: 'https://developer.xero.com/app/manage',
    status: 'community',
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Use Claude models as the primary or secondary LLM.',
    category: 'ai',
    connectionType: 'api_key',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: false,
        options: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-7'],
      },
    ],
    setupUrl: 'https://console.anthropic.com/settings/keys',
    status: 'official',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use GPT-4o and other OpenAI models as the LLM.',
    category: 'ai',
    connectionType: 'api_key',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: false,
        options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      },
    ],
    setupUrl: 'https://platform.openai.com/api-keys',
    status: 'official',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local LLM)',
    description: 'Run local LLMs via Ollama. No API key required.',
    category: 'ai',
    connectionType: 'credentials',
    fields: [
      {
        key: 'base_url',
        label: 'Ollama URL',
        type: 'url',
        required: false,
        placeholder: 'http://localhost:11434',
      },
      { key: 'model', label: 'Model name', type: 'text', required: false, placeholder: 'llama3.2' },
    ],
    setupUrl: 'https://ollama.com',
    status: 'official',
  },
]

export function getPluginsByCategory(): Map<PluginCategory, Plugin[]> {
  const map = new Map<PluginCategory, Plugin[]>()
  for (const p of ALL_PLUGINS) {
    const list = map.get(p.category) ?? []
    list.push(p)
    map.set(p.category, list)
  }
  return map
}

export function getPlugin(id: string): Plugin | undefined {
  return ALL_PLUGINS.find((p) => p.id === id)
}

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
  workspace: 'Google Workspace',
  project_management: 'Project Management',
  communication: 'Communication',
  crm: 'CRM & Sales',
  development: 'Development',
  storage: 'Storage',
  analytics: 'Analytics',
  email_marketing: 'Email Marketing',
  calendar: 'Calendar',
  finance: 'Finance',
  seo: 'SEO & Marketing',
  hosting: 'Hosting & Infrastructure',
  database: 'Database',
  ai: 'AI & LLM',
}
