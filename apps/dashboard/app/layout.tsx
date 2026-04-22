import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from './components/AppShell'

export const metadata: Metadata = {
  title: 'open-greg',
  description: 'Self-hosted autonomous AI agent platform',
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
