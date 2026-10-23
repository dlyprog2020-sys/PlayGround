import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}

const captureDir = resolve(output)
mkdirSync(captureDir, { recursive: true })

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
let chromium
try {
  const require = createRequire(join(runtime, 'package.json'))
  ;({ chromium } = require('playwright'))
} catch (error) {
  console.error(`Unable to load Playwright from ${runtime}: ${error.message}`)
  process.exit(1)
}

let launchOptions = { channel: 'chromium', headless: true }
const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    launchOptions = { ...launchOptions, ...config.browser?.launchOptions }
  } catch (error) {
    console.error(`Unable to read ${configPath}: ${error.message}`)
  }
}
if (process.platform === 'linux' && !process.env.DISPLAY) {
  try {
    process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
  } catch {
    launchOptions.headless = true
  }
}

const transient = (error, code = 75) => {
  if (!error.exitCode) error.exitCode = code
  return error
}

const step = async (name, run) => {
  const start = Date.now()
  try {
    return await run()
  } finally {
    console.log(`[capture] ${name}: ${((Date.now() - start) / 1000).toFixed(2)}s`)
  }
}

const isTransientStatus = (status) =>
  status === 404 || status === 408 || status === 429 || status >= 500

function pngDimensions(file) {
  const bytes = readFileSync(file)
  const signature = bytes.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a' || bytes.length < 24) return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length }
}

async function main() {
  let browser
  try {
    browser = await step('launch browser', () =>
      chromium.launch({ ...launchOptions, timeout: 30000 }).catch((error) => {
        throw transient(error)
      }),
    )

    const views = [
      ['desktop', 1440, 900],
      ['mobile', 390, 844],
    ]

    for (const [name, width, height] of views) {
      await step(`capture ${name} (${width}x${height})`, async () => {
        const page = await browser
          .newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
          .catch((error) => {
            throw transient(error)
          })
        page.setDefaultTimeout(45000)

        const pageErrors = []
        page.on('pageerror', (error) => pageErrors.push(error.message))

        try {
          let response
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
              response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
            } catch (error) {
              if (attempt === 3) throw transient(error)
              await sleep(3000)
              continue
            }
            if (response?.ok()) break
            const status = response?.status()
            if (attempt === 3 || !isTransientStatus(status)) {
              throw Object.assign(new Error(`HTTP ${status} loading ${url}`), {
                exitCode: isTransientStatus(status) ? 75 : 1,
              })
            }
            await sleep(3000)
          }

          await page.locator('body').waitFor({ state: 'visible', timeout: 15000 })
          const readySelector = process.env.CAPTURE_READY_SELECTOR
          if (readySelector) {
            await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 30000 })
          }
          await page
            .waitForFunction(
              () => window.__VOLTRA_READY__ === true || Boolean(document.querySelector('canvas')),
              undefined,
              { timeout: 30000 },
            )
            .catch((error) => {
              throw Object.assign(new Error(`Rendered content did not become ready: ${error.message}`), {
                exitCode: 1,
              })
            })
          await page.evaluate(() => document.fonts?.ready)
          await page.waitForTimeout(3200)
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.waitForTimeout(200)

          if (pageErrors.length) {
            throw Object.assign(new Error(`Page errors: ${pageErrors.join(' | ')}`), { exitCode: 1 })
          }

          const file = join(captureDir, `final-${name}.png`)
          await page.screenshot({ path: file, timeout: 30000 }).catch((error) => {
            throw transient(error)
          })

          const image = pngDimensions(file)
          if (!image || image.bytes < 25 * 1024) {
            throw Object.assign(new Error(`Screenshot is missing or too small: ${file}`), { exitCode: 1 })
          }
          if (image.width !== width || image.height !== height) {
            throw Object.assign(
              new Error(`Unexpected screenshot size ${image.width}x${image.height}, expected ${width}x${height}`),
              { exitCode: 1 },
            )
          }
          console.log(`[capture] ${file} (${image.width}x${image.height}, ${statSync(file).size} bytes)`)
        } finally {
          await page.close().catch(() => {})
        }
      })
    }
  } finally {
    await browser?.close().catch((error) => {
      console.error(`Unable to close browser: ${error.message}`)
      if (!process.exitCode) process.exitCode = 75
    })
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = error.exitCode || 1
})
