// Runtime smoke test: boots against a running dev server (npm run dev),
// loads every route, asserts key content, walks the proposal wizard to the
// configure step, opens the mark-paid cascade preview, and reports any
// console/page errors. Browser: first executable found below.
//
//   npm run smoke          (expects dev server on :5173)

const puppeteer = require('puppeteer-core')
const fs = require('fs')
const os = require('os')
const path = require('path')

const BASE = process.env.SMOKE_BASE || 'http://localhost:5173'
const OUT = path.join(os.tmpdir(), 'agency-cockpit-shots')

const BROWSERS = [
  process.env.SMOKE_BROWSER,
  path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
  'C:\\Program Files\\Google\\Chrome Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge Application\\msedge.exe',
].filter(Boolean)

function findBrowser() {
  for (const b of BROWSERS) {
    try {
      if (fs.existsSync(b) && fs.statSync(b).isFile()) return b
      if (fs.existsSync(b)) {
        // playwright root: descend to chrome.exe
        const stack = [b]
        while (stack.length) {
          const dir = stack.pop()
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name)
            if (e.isDirectory()) stack.push(p)
            else if (e.name === 'chrome.exe') return p
          }
        }
      }
    } catch {
      /* keep looking */
    }
  }
  return null
}

const routes = [
  { path: '/', name: 'today', mustInclude: ['Needs your reply', 'Send today', 'Blockers', 'This week'] },
  { path: '/sales/leads', name: 'leads', mustInclude: ['New', 'Negotiating'] },
  { path: '/sales/proposals/new', name: 'builder', mustInclude: ['For whom'] },
  { path: '/money/invoices', name: 'invoices', mustInclude: ['Invoice', 'Aging'] },
  { path: '/money/payouts', name: 'payouts', mustInclude: ['Blocked', 'Payable', 'guards'] },
  { path: '/comms/outbox', name: 'outbox', mustInclude: ['Today', 'Sent'] },
  { path: '/comms/templates', name: 'templates', mustInclude: ['proposal_send'] },
  { path: '/sales/campaigns', name: 'campaigns', mustInclude: ['Campaigns', 'lead_intro'] },
  { path: '/dashboard', name: 'dashboard', mustInclude: ['Money', 'Pipeline', 'Delivery', 'People', 'Risk radar', 'Growth', 'Weekly review'] },
  { path: '/clients', name: 'clients', mustInclude: ['Alnoor Hotel', 'Ocean Treats'] },
  { path: '/clients/1', name: 'client-detail', mustInclude: ['Alnoor Hotel', 'Purchase orders', 'Timeline', 'Deployments'] },
  { path: '/vendors', name: 'vendors', mustInclude: ['Al-Rashid Trading', 'Terms'] },
  { path: '/calendar', name: 'calendar', mustInclude: [new Date().toLocaleDateString('en-US', { month: 'long' }), 'Today'] },
  { path: '/assets', name: 'assets', mustInclude: ['Alnoor Hotel', 'warranty'] },
  { path: '/projects', name: 'projects', mustInclude: ['Purchase orders', 'Deployment targets'] },
  { path: '/people', name: 'people', mustInclude: ['flat fee per deliverable', 'Funding rounds'] },
  { path: '/settings', name: 'settings', mustInclude: ['Cadence', 'Deposit before procurement'] },
]

;(async () => {
  const executablePath = findBrowser()
  if (!executablePath) {
    console.error('No browser executable found (set SMOKE_BROWSER)')
    process.exit(2)
  }
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    timeout: 60000,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1360, height: 900 })

  const problems = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('[console] ' + m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => problems.push('[pageerror] ' + String(e).slice(0, 400)))

  for (const r of routes) {
    await page.goto(BASE + r.path, { waitUntil: 'networkidle0', timeout: 20000 })
    await new Promise((res) => setTimeout(res, 300))
    const text = await page.evaluate(() => document.getElementById('root')?.innerText || '')
    if (text.trim().length < 20) problems.push('[empty] ' + r.path)
    for (const need of r.mustInclude) {
      if (!text.includes(need)) problems.push('[missing] "' + need + '" not on ' + r.path)
    }
    await page.screenshot({ path: path.join(OUT, r.name + '.png') })
  }

  // Wizard: lead → template → configure step shows running total
  await page.goto(BASE + '/sales/proposals/new', { waitUntil: 'networkidle0' })
  const click = async (fragment) => {
    await page.evaluate((f) => {
      const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(f))
      el && el.click()
    }, fragment)
    await new Promise((r) => setTimeout(r, 200))
  }
  await click('Aqua Pets')
  await click('Continue')
  await click('Hotel Suite')
  await click('Continue')
  const wizardText = await page.evaluate(() => document.getElementById('root')?.innerText || '')
  if (!wizardText.includes('Running total')) problems.push('[wizard] configure step not reached')
  if (!wizardText.includes('POS terminals')) problems.push('[wizard] attributes not rendered')
  await page.screenshot({ path: path.join(OUT, 'builder-configure.png') })

  // Cascade preview modal on invoices
  await page.goto(BASE + '/money/invoices', { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Mark paid')
    el && el.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  const modalText = await page.evaluate(() => document.body.innerText)
  if (!modalText.includes('Cascade preview')) problems.push('[cascade] preview did not open')
  await page.screenshot({ path: path.join(OUT, 'cascade-modal.png') })

  await browser.close()

  const unique = [...new Set(problems)]
  console.log(unique.length === 0 ? 'SMOKE PASS — all routes, wizard, cascade OK' : 'SMOKE FAIL (' + unique.length + ')')
  unique.forEach((p) => console.log('  ' + p))
  console.log('screenshots: ' + OUT)
  process.exit(unique.length ? 1 : 0)
})().catch((e) => {
  console.error('SMOKE ERROR:', e)
  process.exit(2)
})
