export const dynamic = 'force-dynamic'
import { CONTROL_PLANE_URL as CP } from '../../../lib/env'
import { proxyFetch } from '../../../lib/proxy'

export function GET() {
  return proxyFetch(`${CP}/api/update/check`, { cache: 'no-store' })
}
