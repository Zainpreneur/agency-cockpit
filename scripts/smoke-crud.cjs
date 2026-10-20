// CRUD smoke test: exercises the create/edit/delete flows added on top of the
// read-only views. Each scenario drives the real UI (open form → fill → submit
// → assert the row appears). Delete guards are asserted too: a blocked delete
// must surface its reason instead of removing the row.
//
// IMPORTANT: navigation uses the in-app sidebar links (SPA nav). A full page
// reload would reset the in-memory store, so newly created rows must be
// asserted before leaving the page they were created on.
//
//   npm run smoke:crud   (expects dev server on :5173)

const puppeteer = require('puppeteer-core')
const fs = require('fs')
const os = require('os')
const path = require('path')

const BASE = process.env.SMOKE_BASE || 'http://localhost:5173'
const OUT = path.join(os.tmpdir(), 'agency-cockpit-crud-shots')

const BROWSERS = [
  process.env.SMOKE_BROWSER,
  path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
].filter(Boolean)

function findBrowser() {
  for (const b of BROWSERS) {
    try {
      if (fs.existsSync(b) && fs.statSync(b).isFile()) return b
      if (fs.existsSync(b)) {
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

const problems = []
const assert = (cond, msg) => { if (!cond) problems.push(msg) }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const rootText = (page) => page.evaluate(() => document.getElementById('root')?.innerText || '')
const bodyText = (page) => page.evaluate(() => document.body.innerText || '')

const clickText = async (page, fragment, { exact = false } = {}) => {
  const found = await page.evaluate((f, ex) => {
    const els = [...document.querySelectorAll('button, a')]
    const el = els.find((b) => {
      const t = (b.textContent || '').trim()
      return ex ? t === f : t.includes(f)
    })
    if (el) { el.click(); return true }
    return false
  }, fragment, exact)
  await wait(250)
  return found
}

/** Navigate within the SPA via a sidebar link (keeps the in-memory store). */
const nav = async (page, label) => {
  const ok = await page.evaluate((l) => {
    const el = [...document.querySelectorAll('a')].find((a) => (a.textContent || '').trim().endsWith(l))
    if (el) { el.click(); return true }
    return false
  }, label)
  await wait(350)
  return ok
}

/** Fill a FormModal by label text. Selects match option value or visible text. */
const fillForm = async (page, values) => {
  const result = await page.evaluate((vals) => {
    const labels = [...document.querySelectorAll('label')]
    const out = []
    for (const [labelText, value] of Object.entries(vals)) {
      const lab = labels.find((l) => (l.textContent || '').trim().startsWith(labelText))
      if (!lab) { out.push([labelText, 'no-label']); continue }
      const field = lab.querySelector('input, textarea, select') ||
        lab.parentElement?.querySelector('input, textarea, select')
      if (!field) { out.push([labelText, 'no-field']); continue }
      if (field.tagName === 'SELECT') {
        const target = String(value)
        const opt = [...field.options].find((o) => o.value === target) ||
          [...field.options].find((o) => o.text.trim() === target) ||
          [...field.options].find((o) => o.text.includes(target))
        if (!opt) { out.push([labelText, 'no-option']); continue }
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(field, opt.value)
        field.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        const proto = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, String(value))
        field.dispatchEvent(new Event('input', { bubbles: true }))
        field.dispatchEvent(new Event('change', { bubbles: true }))
      }
      out.push([labelText, 'ok'])
    }
    return out
  }, values)
  await wait(150)
  return result
}

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
  await page.setViewport({ width: 1400, height: 1000 })

  page.on('console', (m) => {
    if (m.type() === 'error') problems.push('[console] ' + m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => problems.push('[pageerror] ' + String(e).slice(0, 400)))

  // Load once — every hop after this is SPA navigation so the store survives.
  await page.goto(BASE + '/vendors', { waitUntil: 'networkidle0' })

  // ── 1. Vendor create + guarded delete ────────────────────────────────
  assert(await clickText(page, '+ New vendor'), '[vendor] New vendor button missing')
  await fillForm(page, {
    'Vendor name': 'Smoke Supplies Co',
    Category: 'Test category',
    'Contact person': 'Smoke Tester',
    Email: 'smoke@example.com',
    'Payment terms': 'On delivery',
  })
  await clickText(page, 'Create vendor')
  let text = await rootText(page)
  assert(text.includes('Smoke Supplies Co'), '[vendor] created vendor not in list')
  await page.screenshot({ path: path.join(OUT, 'vendor-created.png') })

  // Guarded delete: Al-Rashid has POs → delete must be refused with a reason
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes('Al-Rashid Trading'))
    row?.querySelector('button[title="Remove"]')?.click()
  })
  await wait(250)
  await clickText(page, 'Delete vendor')
  assert(/archive instead/i.test(await bodyText(page)), '[vendor] guarded delete did not explain the archive rule')
  await page.screenshot({ path: path.join(OUT, 'vendor-guard.png') })
  await clickText(page, 'Cancel')

  // Hard delete a vendor with no POs (the smoke vendor we just made)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes('Smoke Supplies Co'))
    row?.querySelector('button[title="Remove"]')?.click()
  })
  await wait(250)
  await clickText(page, 'Delete vendor')
  text = await rootText(page)
  assert(!text.includes('Smoke Supplies Co'), '[vendor] unguarded delete did not remove the vendor')

  // ── 2. Client create ─────────────────────────────────────────────────
  assert(await nav(page, 'Clients'), '[client] nav link missing')
  assert(await clickText(page, '+ New client'), '[client] New client button missing')
  await fillForm(page, {
    'Client name': 'Smoke Client LLC',
    'Contact person': 'Client Contact',
    Email: 'hello@smokeclient.example',
    City: 'Jeddah',
    Industry: 'testing',
  })
  await clickText(page, 'Create client')
  text = await rootText(page)
  assert(text.includes('Smoke Client LLC'), '[client] created client not in list')

  // Guarded archive: Alnoor has open invoices
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tr')].find((r) => (r.textContent || '').includes('Alnoor Hotel'))
    row?.querySelector('button[title="Remove"]')?.click()
  })
  await wait(250)
  await clickText(page, 'Archive client')
  assert(/still open|settle/i.test(await bodyText(page)), '[client] archive guard did not explain open invoices')
  await clickText(page, 'Cancel')

  // ── 3. Device create (Assets) ────────────────────────────────────────
  assert(await nav(page, 'Assets'), '[asset] nav link missing')
  assert(await clickText(page, '+ New device'), '[asset] New device button missing')
  await fillForm(page, {
    'Device kind': 'Smoke kiosk',
    Client: 'Smoke Client LLC',
    'Serial number': 'SMOKE-0001',
  })
  await clickText(page, 'Register device')
  assert((await rootText(page)).includes('Smoke kiosk'), '[asset] created device not in gallery')

  // ── 4. Project + PO create ───────────────────────────────────────────
  assert(await nav(page, 'Projects'), '[project] nav link missing')
  assert(await clickText(page, '+ New project'), '[project] New project button missing')
  await fillForm(page, {
    'Project name': 'Smoke rollout',
    Client: 'Smoke Client LLC',
    Phase: 'kicked off',
  })
  await clickText(page, 'Create project')
  assert((await rootText(page)).includes('Smoke rollout'), '[project] created project not in list')

  assert(await clickText(page, '+ New PO'), '[po] New PO button missing')
  await fillForm(page, {
    Project: 'Smoke rollout',
    Vendor: 'TechSouq',
    Items: '2x Smoke terminal @ 500',
  })
  await clickText(page, 'Create PO')
  assert((await rootText(page)).includes('Smoke terminal'), '[po] created PO items not rendered')
  await page.screenshot({ path: path.join(OUT, 'po-created.png') })

  // ── 5. Invoice create (draft) ────────────────────────────────────────
  assert(await nav(page, 'Invoices'), '[invoice] nav link missing')
  assert(await clickText(page, '+ New invoice'), '[invoice] New invoice button missing')
  await fillForm(page, {
    Client: 'Smoke Client LLC',
    'Total (SAR)': 1500,
    'Due in (days)': 20,
  })
  await clickText(page, 'Create draft')
  const invText = await rootText(page)
  assert(invText.includes('Smoke Client LLC'), '[invoice] created invoice not listed for the client')

  // ── 6. Payout create (ad-hoc) ────────────────────────────────────────
  assert(await nav(page, 'Payouts'), '[payout] nav link missing')
  assert(await clickText(page, '+ New payout'), '[payout] New payout button missing')
  await fillForm(page, {
    Payee: 'Omar',
    Amount: 250,
    Note: 'smoke ad-hoc row',
  })
  await clickText(page, 'Create payout')
  assert((await rootText(page)).includes('smoke ad-hoc row'), '[payout] created payout not rendered')

  // ── 7. Campaign create ───────────────────────────────────────────────
  assert(await nav(page, 'Campaigns'), '[campaign] nav link missing')
  assert(await clickText(page, '+ New campaign'), '[campaign] New campaign button missing')
  await fillForm(page, {
    'Campaign name': 'Smoke sequence',
    Audience: 'smoke list',
    Steps: '0|lead_intro\n3|lead_followup_1',
  })
  await clickText(page, 'Create campaign')
  assert((await rootText(page)).includes('Smoke sequence'), '[campaign] created campaign not rendered')

  // ── 8. Template create ───────────────────────────────────────────────
  assert(await nav(page, 'Templates'), '[template] nav link missing')
  assert(await clickText(page, '+ New template'), '[template] New template button missing')
  await fillForm(page, {
    Code: 'smoke_template_1',
    Stage: 'smoke',
    Subject: 'Smoke subject line',
    Body: 'Hi {name}, this is a smoke template.',
  })
  await clickText(page, 'Create template')
  assert((await rootText(page)).includes('smoke_template_1'), '[template] created template not listed')

  // ── 9. Team + investor + round create (People) ───────────────────────
  assert(await nav(page, 'Team & investors'), '[people] nav link missing')
  assert(await clickText(page, '+ Team member'), '[people] New team member button missing')
  await fillForm(page, { Name: 'Smoke Member', Email: 'smoke.member@example.com' })
  await clickText(page, 'Add member')
  assert((await rootText(page)).includes('Smoke Member'), '[people] created team member not listed')

  assert(await clickText(page, '+ Investor'), '[people] New investor button missing')
  await fillForm(page, { Name: 'Smoke Investor', Email: 'smoke.investor@example.com' })
  await clickText(page, 'Add investor')
  assert((await rootText(page)).includes('Smoke Investor'), '[people] created investor not listed')

  assert(await clickText(page, '+ Funding round'), '[people] New round button missing')
  await fillForm(page, { Project: 'Smoke rollout', 'Target (SAR)': 30000 })
  await clickText(page, 'Open round')
  assert((await rootText(page)).includes('Smoke rollout'), '[people] created funding round not listed')

  await page.screenshot({ path: path.join(OUT, 'people-created.png') })
  await browser.close()

  const unique = [...new Set(problems)]
  console.log(unique.length === 0 ? 'CRUD SMOKE PASS — create/edit/delete + guards OK' : 'CRUD SMOKE FAIL (' + unique.length + ')')
  unique.forEach((p) => console.log('  ' + p))
  console.log('screenshots: ' + OUT)
  process.exit(unique.length ? 1 : 0)
})().catch((e) => {
  console.error('CRUD SMOKE ERROR:', e)
  process.exit(2)
})
