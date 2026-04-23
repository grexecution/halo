import { describe, it, expect, beforeEach } from 'vitest'
import type { CanvasOperation } from '../src/canvas-manager.js'
import { CanvasManager, globalCanvasManager } from '../src/canvas-manager.js'

describe('CanvasManager', () => {
  let manager: CanvasManager

  beforeEach(() => {
    manager = new CanvasManager()
  })

  describe('createSession()', () => {
    it('creates a session with a unique ID', () => {
      const s1 = manager.createSession()
      const s2 = manager.createSession()
      expect(s1.id).toBeTruthy()
      expect(s2.id).toBeTruthy()
      expect(s1.id).not.toBe(s2.id)
    })

    it('starts with an empty operation log', () => {
      const session = manager.createSession()
      expect(session.operations).toHaveLength(0)
    })

    it('is retrievable via getSession()', () => {
      const session = manager.createSession()
      expect(manager.getSession(session.id)).toBe(session)
    })
  })

  describe('connectClient()', () => {
    it('returns a clientId and empty history for a new session', () => {
      const session = manager.createSession()
      const { clientId, history } = manager.connectClient(session.id, () => {})
      expect(clientId).toBeTruthy()
      expect(history).toHaveLength(0)
    })

    it('returns existing history so the client can replay state', () => {
      const session = manager.createSession()
      // Add an op before the second client connects
      manager.connectClient(session.id, () => {})
      manager.addOperation(session.id, 'client-a', 'stroke', { points: [] })
      const { history } = manager.connectClient(session.id, () => {})
      expect(history).toHaveLength(1)
      expect(history[0]?.type).toBe('stroke')
    })

    it('throws for unknown session ID', () => {
      expect(() => manager.connectClient('no-such-id', () => {})).toThrow('not found')
    })
  })

  describe('addOperation() + broadcast', () => {
    it('appends operation to history', () => {
      const session = manager.createSession()
      manager.connectClient(session.id, () => {})
      manager.addOperation(session.id, 'c1', 'rect', { x: 10, y: 20, w: 100, h: 50 })
      expect(manager.getHistory(session.id)).toHaveLength(1)
    })

    it('broadcasts to all connected clients', () => {
      const session = manager.createSession()
      const received: CanvasOperation[] = []
      manager.connectClient(session.id, (op) => received.push(op))
      manager.connectClient(session.id, (op) => received.push(op))

      manager.addOperation(session.id, 'c1', 'text', { content: 'hello' })
      // Both clients receive it
      expect(received).toHaveLength(2)
      expect(received[0]?.type).toBe('text')
    })

    it('does not crash when a client callback throws', () => {
      const session = manager.createSession()
      manager.connectClient(session.id, () => {
        throw new Error('client error')
      })
      // should not propagate
      expect(() => manager.addOperation(session.id, 'c1', 'clear', {})).not.toThrow()
    })

    it('returns the created operation with id and timestamp', () => {
      const session = manager.createSession()
      const op = manager.addOperation(session.id, 'c1', 'ellipse', { cx: 5, cy: 5, r: 10 })
      expect(op.id).toBeTruthy()
      expect(op.type).toBe('ellipse')
      expect(op.clientId).toBe('c1')
      expect(op.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('disconnectClient()', () => {
    it('removes the client so it no longer receives broadcasts', () => {
      const session = manager.createSession()
      const received: CanvasOperation[] = []
      const { clientId } = manager.connectClient(session.id, (op) => received.push(op))

      manager.disconnectClient(session.id, clientId)
      manager.addOperation(session.id, 'c2', 'stroke', { points: [] })

      expect(received).toHaveLength(0)
    })

    it('is a no-op for unknown session or client', () => {
      expect(() => manager.disconnectClient('no-session', 'no-client')).not.toThrow()
    })
  })

  describe('destroySession()', () => {
    it('removes session from list', () => {
      const session = manager.createSession()
      manager.destroySession(session.id)
      expect(manager.getSession(session.id)).toBeUndefined()
      expect(manager.listSessions()).toHaveLength(0)
    })

    it('is a no-op for unknown session', () => {
      expect(() => manager.destroySession('ghost')).not.toThrow()
    })
  })

  describe('listSessions()', () => {
    it('returns snapshots with correct counts', () => {
      const s1 = manager.createSession()
      const s2 = manager.createSession()
      manager.connectClient(s1.id, () => {})
      manager.connectClient(s1.id, () => {})
      manager.addOperation(s1.id, 'c1', 'stroke', {})

      const snapshots = manager.listSessions()
      expect(snapshots).toHaveLength(2)
      const snap1 = snapshots.find((s) => s.id === s1.id)!
      expect(snap1.clientCount).toBe(2)
      expect(snap1.operationCount).toBe(1)
      const snap2 = snapshots.find((s) => s.id === s2.id)!
      expect(snap2.clientCount).toBe(0)
      expect(snap2.operationCount).toBe(0)
    })
  })
})

describe('globalCanvasManager', () => {
  it('is exported as a singleton CanvasManager', () => {
    expect(globalCanvasManager).toBeInstanceOf(CanvasManager)
  })
})
