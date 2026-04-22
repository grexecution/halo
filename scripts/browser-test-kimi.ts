/**
 * Browser test: verify Kimi/z.ai shows in connectors, and is selectable in agents.
 * Run: npx tsx scripts/browser-test-kimi.ts
 */
/* eslint-disable no-console, @typescript-eslint/consistent-type-imports */

import { chromium } from 'playwright'
import * as http from 'http'

const BASE = 'http://localhost:3000'

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
  })
}

async function login(page: import('playwright').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  const hasForm = await page.locator('input[type="text"], input[name="username"]').count()
  if (hasForm > 0) {
    await page.fill('input[type="text"], input[name="username"]', 'admin')
    await page.fill('input[type="password"]', 'admin').catch(() => {})
    await page.click('button[type="submit"]').catch(() => {
      return page.click('button:has-text("Sign in")')
    })
    await page.waitForURL(/\/(chat|dashboard|agents|\/)/, { timeout: 5000 }).catch(() => {})
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()

  console.log('\n=== STEP 1: Check /api/models ===')
  const modelsRaw = await get(`${BASE}/api/models`)
  const modelsData = JSON.parse(modelsRaw) as {
    models: Array<{
      id: string
      name: string
      provider: string
      enabled: boolean
      isDiscovered?: boolean
    }>
  }
  console.log(
    'Models returned:',
    modelsData.models
      .map((m) => `${m.id} [${m.provider}] enabled=${m.enabled} discovered=${!!m.isDiscovered}`)
      .join('\n  '),
  )

  const kimiModel = modelsData.models.find(
    (m) =>
      m.provider === 'z.ai' ||
      m.name.toLowerCase().includes('kimi') ||
      m.name.toLowerCase().includes('glm'),
  )
  console.log(
    'Kimi/z.ai model found in /api/models:',
    kimiModel ? JSON.stringify(kimiModel) : '❌ NOT FOUND',
  )

  await login(page)

  console.log('\n=== STEP 2: Connectors page ===')
  await page.goto(`${BASE}/connectors`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: '/tmp/connectors.png' })
  const pageText = await page.locator('body').innerText()
  const hasKimi = /kimi|z\.ai|glm/i.test(pageText)
  console.log('Connectors page shows Kimi/z.ai:', hasKimi ? '✅ YES' : '❌ NO')
  console.log('Connector text excerpt:', pageText.slice(0, 500))

  console.log('\n=== STEP 3: Settings → Models tab ===')
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  // Find the Models tab
  const modelsTab = page.locator('button:has-text("Models"), [role=tab]:has-text("Models")').first()
  await modelsTab.click().catch(() => {})
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/settings-models.png' })
  const settingsText = await page.locator('body').innerText()
  const hasKimiInSettings = /kimi|z\.ai|glm/i.test(settingsText)
  console.log('Settings Models tab shows Kimi/z.ai:', hasKimiInSettings ? '✅ YES' : '❌ NO')

  console.log('\n=== STEP 4: Agents page — check model dropdown ===')
  await page.goto(`${BASE}/agents`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: '/tmp/agents-before.png' })

  // Click "New Agent" or edit first agent
  const newBtn = page
    .locator(
      'button:has-text("New Agent"), button:has-text("Add Agent"), button:has-text("Create")',
    )
    .first()
  const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]').first()

  if ((await newBtn.count()) > 0) {
    await newBtn.click()
  } else if ((await editBtn.count()) > 0) {
    await editBtn.click()
  }
  await page.waitForTimeout(700)
  await page.screenshot({ path: '/tmp/agents-dialog.png' })

  // Check what options are in the model select
  const options = await page.locator('select option').allTextContents()
  console.log('Model dropdown options:', options)
  const hasKimiInDropdown = options.some((o) => /kimi|z\.ai|glm/i.test(o))
  console.log('Kimi/z.ai in agents model dropdown:', hasKimiInDropdown ? '✅ YES' : '❌ NO')
  console.log(
    'Ollama in agents model dropdown:',
    options.some((o) => /ollama|llama/i.test(o)) ? '✅ YES' : '❌ NO',
  )

  console.log('\n=== STEP 5: Add Model dialog — check z.ai provider option ===')
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await page
    .locator('button:has-text("Models"), [role=tab]:has-text("Models")')
    .first()
    .click()
    .catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('button:has-text("Add Model")').first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/add-model-dialog.png' })

  const providerOptions = await page.locator('select option').allTextContents()
  console.log('Add Model provider options:', providerOptions)
  const hasZaiProvider = providerOptions.some((o) => /z\.ai/i.test(o))
  console.log('z.ai provider in Add Model dialog:', hasZaiProvider ? '✅ YES' : '❌ NO')

  console.log('\n=== SUMMARY ===')
  console.log(
    'Screenshots saved to /tmp/connectors.png, /tmp/settings-models.png, /tmp/agents-dialog.png, /tmp/add-model-dialog.png',
  )

  await page.waitForTimeout(2000)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
