import bcrypt from 'bcryptjs'
import { getDb } from './app/lib/db.ts'

const hash = await bcrypt.hash('admin', 12)
const db = getDb()
db.prepare(`
  INSERT INTO auth (id, enabled, username, password_hash, totp_enabled, totp_secret, session_secret)
  VALUES (1, 1, 'admin', ?, 0, '', 'og-local-secret')
  ON CONFLICT(id) DO UPDATE SET
    enabled = 1,
    username = 'admin',
    password_hash = excluded.password_hash,
    totp_enabled = 0,
    totp_secret = '',
    session_secret = 'og-local-secret'
`).run(hash)

const row = db.prepare('SELECT enabled, username, password_hash FROM auth WHERE id=1').get() as Record<string, unknown>
console.log('Auth fixed:')
console.log('  enabled:', row.enabled)
console.log('  username: admin')
console.log('  password: admin')
console.log('  hash set:', String(row.password_hash).startsWith('$2'))
