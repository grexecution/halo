"use client"

import { useState } from "react"
import { CheckIcon, XIcon, Settings2, ChevronDownIcon } from "lucide-react"
import type { ToolCallMessagePartProps } from "@assistant-ui/react"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettingChange {
  key: string
  oldValue?: unknown
  newValue: unknown
  description?: string
}

interface SettingsChangeArgs {
  section?: string
  changes: SettingChange[]
  summary?: string
}

// ─── Diff Row ────────────────────────────────────────────────────────────────

function DiffRow({ change }: { change: SettingChange }) {
  const hasOld = change.oldValue !== undefined
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-800/60 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-medium text-gray-300 truncate">{change.key}</p>
        {change.description && (
          <p className="text-[11px] text-gray-500 mt-0.5">{change.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {hasOld && (
          <>
            <span className="text-[11px] font-mono bg-red-950/40 border border-red-900/40 text-red-400 rounded px-1.5 py-0.5 line-through">
              {String(change.oldValue)}
            </span>
            <span className="text-gray-600 text-xs">→</span>
          </>
        )}
        <span className="text-[11px] font-mono bg-green-950/40 border border-green-900/40 text-green-400 rounded px-1.5 py-0.5">
          {String(change.newValue)}
        </span>
      </div>
    </div>
  )
}

// ─── Main Card ───────────────────────────────────────────────────────────────

export function SettingsChangeCard({ args }: ToolCallMessagePartProps<SettingsChangeArgs>) {
  const [status, setStatus] = useState<"idle" | "applying" | "applied" | "dismissed">("idle")
  const [expanded, setExpanded] = useState(true)

  if (!args?.changes?.length) return null
  if (status === "dismissed") return null

  async function apply() {
    setStatus("applying")
    try {
      const updates: Record<string, unknown> = {}
      for (const c of args.changes) {
        updates[c.key] = c.newValue
      }
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: args.section, updates }),
      })
      setStatus("applied")
    } catch {
      setStatus("idle")
    }
  }

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border transition-all",
        status === "applied"
          ? "border-green-800/50 bg-green-950/20"
          : "border-blue-800/40 bg-blue-950/10",
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <Settings2 size={13} className="text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">
            {status === "applied" ? "Settings updated" : "Suggested settings change"}
          </p>
          {args.summary && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{args.summary}</p>
          )}
        </div>
        {status === "applied" ? (
          <CheckIcon size={13} className="text-green-400 shrink-0" />
        ) : (
          <ChevronDownIcon
            size={13}
            className={cn("text-gray-500 transition-transform shrink-0", expanded && "rotate-180")}
          />
        )}
      </button>

      {/* Diff table */}
      {expanded && status !== "applied" && (
        <div className="px-3.5 pb-2">
          {args.section && (
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 font-medium">
              {args.section}
            </p>
          )}
          <div>
            {args.changes.map((c, i) => (
              <DiffRow key={i} change={c} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void apply()}
              disabled={status === "applying"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
            >
              {status === "applying" ? (
                <>
                  <span className="animate-spin">⟳</span> Applying…
                </>
              ) : (
                <>
                  <CheckIcon size={11} /> Apply changes
                </>
              )}
            </button>
            <button
              onClick={() => setStatus("dismissed")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <XIcon size={11} /> Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
