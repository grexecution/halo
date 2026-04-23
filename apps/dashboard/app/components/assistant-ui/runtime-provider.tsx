"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from "@assistant-ui/react"

// ─── SSE Model Adapter ───────────────────────────────────────────────────────
// Reads from /api/chats/[id]/messages SSE stream and yields content chunks.

function makeAdapter(sessionId: string | null, onSessionCreated: (id: string) => void): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
      // Extract the last user message text
      const lastMsg = messages.at(-1)
      if (!lastMsg || lastMsg.role !== "user") return

      const userText = lastMsg.content
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("")

      // Ensure there's an active session
      let chatId = sessionId
      if (!chatId) {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userText.slice(0, 60) }),
          signal: abortSignal,
        })
        if (!res.ok) throw new Error("Failed to create chat session")
        const data = (await res.json()) as { id: string }
        chatId = data.id
        onSessionCreated(chatId)
      }

      // Call the SSE streaming endpoint
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
        signal: abortSignal,
      })

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "Unknown error")
        throw new Error(`Chat request failed: ${err}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      let text = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6).trim()
            if (!raw) continue

            try {
              const evt = JSON.parse(raw) as {
                type: string
                text?: string
                name?: string
                args?: unknown
                message?: string
              }

              if (evt.type === "chunk" && evt.text) {
                text += evt.text
                yield { content: [{ type: "text" as const, text }] }
              } else if (evt.type === "tool") {
                const toolArgsJson = JSON.stringify(evt.args ?? {})
                yield {
                  content: [
                    { type: "text" as const, text },
                    {
                      type: "tool-call" as const,
                      toolCallId: `tool-${Date.now()}`,
                      toolName: String(evt.name ?? "tool"),
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      args: (evt.args ?? {}) as any,
                      argsText: toolArgsJson,
                    },
                  ],
                }
              } else if (evt.type === "error") {
                throw new Error(evt.message ?? "Agent error")
              }
            } catch {
              // skip malformed SSE events
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Final yield with complete text
      yield { content: [{ type: "text" as const, text }] }
    },
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface RuntimeProviderProps {
  children: ReactNode
  sessionId: string | null
  onSessionCreated: (id: string) => void
}

export function ChatRuntimeProvider({ children, sessionId, onSessionCreated }: RuntimeProviderProps) {
  const adapter = useMemo(
    () => makeAdapter(sessionId, onSessionCreated),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  )

  const runtime = useLocalRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}
