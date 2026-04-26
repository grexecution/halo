export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { networkInterfaces } from 'node:os'

function getLocalIPs(): string[] {
  const nets = networkInterfaces()
  const ips: string[] = []
  for (const iface of Object.values(nets)) {
    if (!iface) continue
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

export function GET() {
  const ips = getLocalIPs()
  const port = process.env['PORT'] ?? '3000'
  return NextResponse.json({
    ips,
    port,
    urls: ips.map((ip) => `http://${ip}:${port}`),
  })
}
