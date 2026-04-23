/**
 * bundled-skills.ts
 *
 * Ships 4 built-in skills with Halo. On first boot (or if a skill is missing),
 * these are written to ~/.open-greg/skills/<name>/SKILL.md.
 *
 * User edits to a skill are preserved — we only write if the file does not exist.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { serialiseSkillMd } from './skill-store.js'

interface BundledSkill {
  name: string
  description: string
  requiresEnv?: string[]
  body: string
}

const BUNDLED: BundledSkill[] = [
  {
    name: 'github',
    description:
      'Access GitHub repos, issues, pull requests, and CI. Use when the user asks about GitHub, wants to open PRs, read issues, check CI status, or push code.',
    requiresEnv: ['GITHUB_TOKEN'],
    body: `
# GitHub

## Credentials needed
- \`GITHUB_TOKEN\` — Personal access token with \`repo\` scope.
  Create one at: https://github.com/settings/tokens/new?scopes=repo
  Tell the user: "Go to https://github.com/settings/tokens → Generate new token (classic) → tick 'repo' → copy the token"

## Workflow

### Listing repos / issues / PRs
Use \`shell_exec\` with the GitHub CLI (\`gh\`) if available, otherwise use \`curl\` with the GitHub REST API:
\`\`\`
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/OWNER/REPO/issues
\`\`\`

### Creating a PR
1. Ensure you're on a branch (not main)
2. \`gh pr create --title "..." --body "..."\` or via API
3. Always confirm with user before pushing to protected branches

### Checking CI
\`gh run list --repo OWNER/REPO\` or GitHub API \`/repos/OWNER/REPO/actions/runs\`

## Rules
- Never force-push to main
- Always confirm before merging or deleting branches
- If GITHUB_TOKEN is missing, ask the user to run: connect skill github GITHUB_TOKEN <token>
`.trim(),
  },
  {
    name: 'telegram-send',
    description:
      'Send Telegram messages to a chat or channel. Use when the user asks to send a Telegram message, notify via Telegram, or message someone on Telegram.',
    requiresEnv: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    body: `
# Telegram Send

## Credentials needed
- \`TELEGRAM_BOT_TOKEN\` — Get from @BotFather on Telegram (\`/newbot\`)
- \`TELEGRAM_CHAT_ID\` — The chat ID to send to. Get it by messaging @userinfobot

## Workflow

### Send a message
\`\`\`bash
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \\
  -d chat_id="$TELEGRAM_CHAT_ID" \\
  -d text="Your message here" \\
  -d parse_mode="Markdown"
\`\`\`

### Send with formatting
Use Markdown: *bold*, _italic_, \`code\`, [link text](url)

### Send a file
\`\`\`bash
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendDocument" \\
  -F chat_id="$TELEGRAM_CHAT_ID" \\
  -F document=@/path/to/file
\`\`\`

## Rules
- Always confirm before sending messages containing sensitive information
- Rate limit: 30 messages/second max per bot
`.trim(),
  },
  {
    name: 'browser-research',
    description:
      'Multi-step web research: search, extract, compare, summarise. Use when the user asks to research a topic, find information online, compare products/services, or gather data from websites.',
    body: `
# Browser Research

No credentials required.

## Workflow

### Single-page research
1. Use \`browser_navigate\` with the URL
2. Extract relevant sections from the response
3. Summarise key findings

### Multi-source research
1. Search for sources (use browser_navigate to a search engine or direct URLs)
2. Visit 2–4 sources
3. Cross-reference facts — flag any contradictions
4. Produce a structured summary with source citations

### Comparing options
1. Identify 3–5 candidates
2. Extract comparison criteria from user intent
3. Visit each candidate's page
4. Build a comparison table

## Rules
- Always cite sources with URLs
- Flag if a source seems out of date (check page date if available)
- Don't fabricate information — if a page doesn't have what you need, say so
- Respect robots.txt intent — don't scrape at high frequency
`.trim(),
  },
  {
    name: 'shell-safe',
    description:
      'Safe shell command execution with automatic danger-pattern checks. Use whenever executing shell commands, running scripts, managing files, or operating system processes.',
    body: `
# Shell Safe

No credentials required.

## Before running any shell command, check:

### Dangerous patterns — always confirm with user first
- \`rm -rf\` with wildcards or root paths
- \`dd\` writing to block devices
- \`curl | bash\` or \`wget | sh\` (pipe to shell)
- Commands writing to \`/etc\`, \`/boot\`, \`/sys\`, \`/proc\`
- \`chmod 777\` on sensitive files
- \`sudo\` commands (requires user approval per PERMISSIONS.md)
- Any command that modifies the database directly
- \`git push --force\` on main/master

### Safe patterns
- Prefer \`rm -i\` over \`rm -rf\` for interactive confirmation
- Use \`--dry-run\` flags when available (rsync, ansible, etc.)
- Redirect output to a file before piping to shell
- Use absolute paths where possible

## Workflow
1. State what the command does before running it
2. If the command is destructive or irreversible, confirm with user
3. Run the command
4. Report stdout/stderr and exit code
5. If it failed, diagnose before retrying

## Rules
- Never run a command you don't understand
- If a command will take >30s, warn the user first
- On error, show the actual error message — don't hide it
`.trim(),
  },
]

/**
 * Bootstrap bundled skills to disk.
 * Only writes files that don't already exist — preserves user edits.
 */
export function bootstrapBundledSkills(skillsDir: string): void {
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true, mode: 0o700 })
  }

  for (const skill of BUNDLED) {
    const skillDir = join(skillsDir, skill.name)
    const skillMdPath = join(skillDir, 'SKILL.md')

    // Never overwrite user edits
    if (existsSync(skillMdPath)) continue

    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })

    const content = serialiseSkillMd({
      name: skill.name,
      description: skill.description,
      requiresEnv: skill.requiresEnv ?? [],
      enabled: true,
      body: skill.body,
    })

    writeFileSync(skillMdPath, content, { encoding: 'utf-8', mode: 0o600 })
  }
}

export { BUNDLED }
