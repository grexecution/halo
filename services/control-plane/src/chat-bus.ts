/**
 * chat-bus.ts — in-process event bus for cross-source chat messages.
 *
 * All messages (dashboard, Telegram, Discord) are pushed here.
 * SSE subscribers get a live stream of every message in a thread.
 * The bus is intentionally in-memory — it's a fanout transport, not a store.
 * Persistence is handled by Mastra memory (Postgres/LibSQL).
 */
import { EventEmitter } from 'node:events'

export type MessageSource = 'dashboard' | 'telegram' | 'discord' | 'system'

export interface ChatEvent {
  threadId: string
  role: 'user' | 'assistant'
  content: string
  source: MessageSource
  /** display name or chat handle, optional */
  senderName?: string
  timestamp: string
}

class ChatBus extends EventEmitter {
  /** Publish a message to the bus. */
  publish(event: ChatEvent): void {
    this.emit('message', event)
    this.emit(`thread:${event.threadId}`, event)
  }

  /** Subscribe to all messages. Returns an unsubscribe function. */
  subscribe(handler: (event: ChatEvent) => void): () => void {
    this.on('message', handler)
    return () => this.off('message', handler)
  }

  /** Subscribe to messages in a specific thread. Returns an unsubscribe function. */
  subscribeThread(threadId: string, handler: (event: ChatEvent) => void): () => void {
    const key = `thread:${threadId}`
    this.on(key, handler)
    return () => this.off(key, handler)
  }
}

// Singleton
export const chatBus = new ChatBus()
chatBus.setMaxListeners(200) // many SSE connections = many listeners
