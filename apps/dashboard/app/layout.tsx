import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from './components/Sidebar'

export const metadata: Metadata = {
  title: 'open-greg',
  description: 'Self-hosted autonomous AI agent platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-900 text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  )
}
