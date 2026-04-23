export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CUSTOM_PAGES_FILE = resolve(process.cwd(), 'app/custom/pages.json')

interface CustomPage {
  href: string
  label: string
  icon?: string
}

export async function GET() {
  try {
    if (!existsSync(CUSTOM_PAGES_FILE)) {
      return NextResponse.json({ pages: [] })
    }
    const pages = JSON.parse(readFileSync(CUSTOM_PAGES_FILE, 'utf-8')) as CustomPage[]
    return NextResponse.json({ pages })
  } catch {
    return NextResponse.json({ pages: [] })
  }
}
