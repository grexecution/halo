'use client'

import { useEffect, useState } from 'react'

interface CredentialStatus {
  key: string
  set: boolean
}

interface Skill {
  name: string
  description: string
  version: string
  requiresEnv: string[]
  enabled: boolean
  credentialStatus: CredentialStatus[]
  body?: string
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Skill | null>(null)
  const [connectingSkill, setConnectingSkill] = useState<string | null>(null)
  const [credKey, setCredKey] = useState('')
  const [credValue, setCredValue] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newSkill, setNewSkill] = useState({
    name: '',
    description: '',
    body: '',
    requiresEnv: '',
  })
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

  async function fetchSkills() {
    try {
      const res = await fetch('/api/skills')
      if (res.ok) {
        const data = (await res.json()) as { skills: Skill[] }
        setSkills(data.skills)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSkills()
  }, [])

  async function openDetail(skill: Skill) {
    const res = await fetch(`/api/skills/${skill.name}`)
    if (res.ok) {
      const data = (await res.json()) as Skill
      setSelected(data)
    } else {
      setSelected(skill)
    }
  }

  async function toggleSkill(skill: Skill) {
    await fetch(`/api/skills/${skill.name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !skill.enabled }),
    })
    void fetchSkills()
  }

  async function deleteSkill(name: string) {
    if (!confirm(`Delete skill "${name}"? This cannot be undone.`)) return
    await fetch(`/api/skills/${name}`, { method: 'DELETE' })
    if (selected?.name === name) setSelected(null)
    void fetchSkills()
  }

  async function saveCredential(skillName: string) {
    if (!credKey || !credValue) return
    setCredSaving(true)
    setCredError(null)
    try {
      const res = await fetch(`/api/skills/${skillName}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envKey: credKey, value: credValue }),
      })
      if (res.ok) {
        setConnectingSkill(null)
        setCredKey('')
        setCredValue('')
        void fetchSkills()
        // Refresh detail if open
        if (selected?.name === skillName) {
          const det = await fetch(`/api/skills/${skillName}`)
          if (det.ok) setSelected((await det.json()) as Skill)
        }
      } else {
        const err = (await res.json()) as { error?: string }
        setCredError(err.error ?? 'Failed to save')
      }
    } catch (e) {
      setCredError(String(e))
    } finally {
      setCredSaving(false)
    }
  }

  async function createSkill() {
    setCreateError(null)
    if (!newSkill.name || !newSkill.description || !newSkill.body) {
      setCreateError('Name, description, and body are required')
      return
    }
    setCreateLoading(true)
    try {
      const res = await fetch(`/api/skills/${newSkill.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newSkill.description,
          body: newSkill.body,
          requiresEnv: newSkill.requiresEnv
            ? newSkill.requiresEnv
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        }),
      })
      if (res.ok) {
        setCreating(false)
        setNewSkill({ name: '', description: '', body: '', requiresEnv: '' })
        void fetchSkills()
      } else {
        const err = (await res.json()) as { error?: string }
        setCreateError(err.error ?? 'Failed to create')
      }
    } catch (e) {
      setCreateError(String(e))
    } finally {
      setCreateLoading(false)
    }
  }

  const allConnected = (s: Skill) => s.credentialStatus.every((c) => c.set)
  const missingCreds = (s: Skill) => s.credentialStatus.filter((c) => !c.set)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading skills…
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left: skill list */}
      <div className="flex w-80 flex-shrink-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Skills</h1>
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto">
          {skills.length === 0 && (
            <p className="text-sm text-muted-foreground">No skills loaded yet.</p>
          )}
          {skills.map((s) => (
            <button
              key={s.name}
              onClick={() => void openDetail(s)}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                selected?.name === s.name ? 'border-primary bg-accent' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                <div className="flex items-center gap-1.5">
                  {/* Credential indicator */}
                  {s.requiresEnv.length > 0 && (
                    <span
                      className={`h-2 w-2 rounded-full ${allConnected(s) ? 'bg-green-500' : 'bg-amber-500'}`}
                      title={
                        allConnected(s)
                          ? 'All credentials connected'
                          : `Missing: ${missingCreds(s)
                              .map((c) => c.key)
                              .join(', ')}`
                      }
                    />
                  )}
                  {/* Enabled toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleSkill(s)
                    }}
                    className={`text-xs ${s.enabled ? 'text-green-600' : 'text-muted-foreground'}`}
                  >
                    {s.enabled ? 'on' : 'off'}
                  </button>
                </div>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail or create panel */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
        {creating ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New skill</h2>
              <button
                onClick={() => {
                  setCreating(false)
                  setCreateError(null)
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name (kebab-case)
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="my-skill"
                  value={newSkill.name}
                  onChange={(e) => setNewSkill((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description (1–2 sentences: what it does + when to use it)
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Use this skill when…"
                  value={newSkill.description}
                  onChange={(e) => setNewSkill((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Required credentials (comma-separated env vars, e.g. GITHUB_TOKEN)
                </label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="API_KEY, SECRET_TOKEN"
                  value={newSkill.requiresEnv}
                  onChange={(e) => setNewSkill((p) => ({ ...p, requiresEnv: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Body (markdown — workflow steps, rules, examples)
                </label>
                <textarea
                  className="h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder="## Workflow&#10;1. Do this&#10;2. Then that&#10;&#10;## Rules&#10;- Never..."
                  value={newSkill.body}
                  onChange={(e) => setNewSkill((p) => ({ ...p, body: e.target.value }))}
                />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <button
                onClick={() => void createSkill()}
                disabled={createLoading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createLoading ? 'Creating…' : 'Create skill'}
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggleSkill(selected)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    selected.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {selected.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => void deleteSkill(selected.name)}
                  className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Credentials section */}
            {selected.requiresEnv.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-semibold">Credentials</h3>
                <div className="flex flex-col gap-2">
                  {selected.credentialStatus.map((c) => (
                    <div key={c.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${c.set ? 'bg-green-500' : 'bg-amber-500'}`}
                        />
                        <code className="text-sm">{c.key}</code>
                        <span className="text-xs text-muted-foreground">
                          {c.set ? 'Connected' : 'Not set'}
                        </span>
                      </div>
                      {!c.set && (
                        <button
                          onClick={() => {
                            setConnectingSkill(selected.name)
                            setCredKey(c.key)
                          }}
                          className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Inline credential form */}
                {connectingSkill === selected.name && (
                  <div className="mt-3 rounded-md border border-dashed border-border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Enter the value for <code className="font-mono">{credKey}</code>
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm"
                        placeholder="Paste your key here…"
                        value={credValue}
                        onChange={(e) => setCredValue(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => void saveCredential(selected.name)}
                        disabled={credSaving || !credValue}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {credSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setConnectingSkill(null)
                          setCredValue('')
                          setCredError(null)
                        }}
                        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                    {credError && <p className="mt-1.5 text-xs text-destructive">{credError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Skill body */}
            {selected.body && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Instructions</h3>
                <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed">
                  {selected.body}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a skill to view details, or create a new one.
          </div>
        )}
      </div>
    </div>
  )
}
