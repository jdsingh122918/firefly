import { Page } from 'puppeteer'
import { UserRole } from '@prisma/client'
import { authenticateAs } from '../setup/auth'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

export async function navigateTo(page: Page, path: string, role?: UserRole): Promise<void> {
  if (role) {
    await authenticateAs(page, role)
  }
  
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
}

export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    await page.waitForSelector(selector, { timeout: 5000 })
    await page.type(selector, value, { delay: 50 })
  }
}

export async function fillInput(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 5000 })
  await page.click(selector, { clickCount: 3 }) // Select all existing text
  await page.type(selector, value, { delay: 50 })
}

export async function selectOption(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 5000 })
  await page.select(selector, value)
}

export async function waitForElement(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { timeout })
}

export async function waitForText(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    (text) => document.body.innerText.includes(text),
    { timeout },
    text
  )
}

export async function clickButton(page: Page, text: string, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const [button] = await (page as any).$x(`//button[contains(text(), '${text}')]`)
      if (button) {
        await (button as any).click()
        await (page as any).waitForTimeout(500) // Wait for action to complete
        return
      }
    } catch (error) {
      if (i === retries - 1) throw error
      await (page as any).waitForTimeout(1000)
    }
  }
  
  throw new Error(`Button with text "${text}" not found`)
}

export async function clickLink(page: Page, text: string): Promise<void> {
  const [link] = await (page as any).$x(`//a[contains(text(), '${text}')]`)
  if (!link) {
    throw new Error(`Link with text "${text}" not found`)
  }
  await (link as any).click()
  await (page as any).waitForTimeout(500)
}

export async function assertTextVisible(page: Page, text: string): Promise<void> {
  const content = await page.content()
  if (!content.includes(text)) {
    try {
      await page.screenshot({
        path: `results/screenshots/missing-text-${text.replace(/\s+/g, '-')}-${Date.now()}.png`,
        fullPage: true,
      })
    } catch {
      // Screenshot failed, continue
    }
    throw new Error(`Expected text "${text}" not found on page`)
  }
}

export async function assertElementVisible(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector)
  if (!element) {
    try {
      await page.screenshot({
        path: `results/screenshots/missing-element-${selector.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.png`,
        fullPage: true,
      })
    } catch {
      // Screenshot failed, continue
    }
    throw new Error(`Expected element "${selector}" not found on page`)
  }
}

export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  await waitForElement(page, selector)
  return await page.$eval(selector, el => el.textContent)
}

export async function getElementCount(page: Page, selector: string): Promise<number> {
  return await page.$$eval(selector, elements => elements.length)
}

export async function waitForNavigation(page: Page, timeout = 10000): Promise<void> {
  await page.waitForNavigation({ timeout, waitUntil: 'networkidle0' })
}

export async function takeScreenshotOnFailure(page: Page, testName: string): Promise<void> {
  try {
    await page.screenshot({
      path: `results/screenshots/failure-${testName}-${Date.now()}.png`,
      fullPage: true,
    })
  } catch {
    // Screenshot failed, continue
  }
}

