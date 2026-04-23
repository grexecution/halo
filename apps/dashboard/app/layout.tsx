import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from './components/AppShell'

export const metadata: Metadata = {
  title: 'Halo',
  description: 'Self-hosted autonomous AI agent platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Halo',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-900 text-gray-100" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
