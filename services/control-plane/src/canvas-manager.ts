/**
 * F-212: Live Canvas render surface
 *
 * CanvasManager manages real-time collaborative canvas sessions.
 * Each session has:
 *   - A unique ID and list of connected clients
 *   - An ordered list of draw operations (the canonical state)
 *   - Broadcast: push an update to all connected clients
 *   - Persistence: snapshots stored in-memory (pluggable to Postgres)
 *
 * The canvas uses a simple append-only operation log (similar to CRDTs).
 * Clients replay the log to render the current state. This avoids conflict
 * resolution complexity while remaining correct for a single-user system.
 *
 * Wire protocol is intentionally transport-agnostic — the WebSocket layer
 * calls broadcast() and clients call addOperation(). No ws/socket.io dep here.
 */

import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationType =
  | 'stroke' // freehand path
  | 'rect' // rectangle
  | 'ellipse' // circle / ellipse
  | 'text' // text block
  | 'image' // embedded image (base64 or URL)
  | 'clear' // clear the entire canvas
  | 'undo' // undo last operation by a specific client

export interface CanvasOperation {
  id: string
  type: OperationType
  clientId: string
  timestamp: Date
  /** Serialized payload — coordinates, styles, content, etc. */
  data: Record<string, unknown>
}

export interface CanvasClient {
  id: string
  connectedAt: Date
  /** Called when the canvas broadcasts a new operation. */
  onOperation: (op: CanvasOperation) => void
}

export interface CanvasSession {
  id: string
  createdAt: Date
  clients: Map<string, CanvasClient>
  operations: CanvasOperation[]
}

export interface CanvasSessionSnapshot {
  id: string
  createdAt: Date
  clientCount: number
  operationCount: number
}

// ---------------------------------------------------------------------------
// CanvasManager
// ---------------------------------------------------------------------------

export class CanvasManager {
  private sessions = new Map<string, CanvasSession>()

  /** Create a new canvas session. */
  createSession(): CanvasSession {
    const session: CanvasSession = {
      id: randomUUID(),
      createdAt: new Date(),
      clients: new Map(),
      operations: [],
    }
    this.sessions.set(session.id, session)
    return session
  }

  /** Get an existing session. */
  getSession(sessionId: string): CanvasSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Connect a client to a session.
   * Returns the full operation history so the client can replay state.
   */
  connectClient(
    sessionId: string,
    onOperation: (op: CanvasOperation) => void,
  ): { clientId: string; history: CanvasOperation[] } {
    const session = this.requireSession(sessionId)
    const client: CanvasClient = {
      id: randomUUID(),
      connectedAt: new Date(),
      onOperation,
    }
    session.clients.set(client.id, client)
    return { clientId: client.id, history: [...session.operations] }
  }

  /** Disconnect a client from a session. */
  disconnectClient(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.clients.delete(clientId)
  }

  /**
   * Add an operation to the session and broadcast it to all other clients.
   */
  addOperation(
    sessionId: string,
    clientId: string,
    type: OperationType,
    data: Record<string, unknown>,
  ): CanvasOperation {
    const session = this.requireSession(sessionId)

    const op: CanvasOperation = {
      id: randomUUID(),
      type,
      clientId,
      timestamp: new Date(),
      data,
    }

    session.operations.push(op)
    this.broadcast(session, op)
    return op
  }

  /**
   * Broadcast an operation to all connected clients.
   */
  private broadcast(session: CanvasSession, op: CanvasOperation): void {
    for (const client of session.clients.values()) {
      try {
        client.onOperation(op)
      } catch {
        // ignore broken client callbacks — don't crash the session
      }
    }
  }

  /**
   * Get the full operation history for a session (for persistence/replay).
   */
  getHistory(sessionId: string): CanvasOperation[] {
    return [...this.requireSession(sessionId).operations]
  }

  /**
   * Destroy a session and disconnect all clients.
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.clients.clear()
    this.sessions.delete(sessionId)
  }

  /**
   * List snapshots of all active sessions.
   */
  listSessions(): CanvasSessionSnapshot[] {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      clientCount: s.clients.size,
      operationCount: s.operations.length,
    }))
  }

  private requireSession(sessionId: string): CanvasSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Canvas session not found: ${sessionId}`)
    return session
  }
}

/** Singleton canvas manager used by the control-plane. */
export const globalCanvasManager = new CanvasManager()
