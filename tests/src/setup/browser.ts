import puppeteer, { Browser, Page } from 'puppeteer'

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    const headless = process.env.HEADLESS !== 'false'
    browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      defaultViewport: {
        width: 1280,
        height: 720,
      },
    })
  }
  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

export async function createPage(): Promise<Page> {
  const browserInstance = await getBrowser()
  const page = await browserInstance.newPage()
  
  // Set viewport
  await page.setViewport({
    width: 1280,
    height: 720,
  })
  
  return page
}

export async function takeScreenshot(page: Page, filename: string): Promise<void> {
  try {
    await page.screenshot({
      path: `results/screenshots/${filename}-${Date.now()}.png`,
      fullPage: true,
    })
  } catch (error) {
    console.error('Failed to take screenshot:', error)
  }
}

