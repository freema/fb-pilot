/**
 * E2E test setup — Puppeteer with Chrome extension loaded
 */
const path = require('path');
const puppeteer = require('puppeteer');

const EXTENSION_PATH = path.resolve(__dirname, '..', '..');

let browser;

async function launchBrowser() {
  browser = await puppeteer.launch({
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=400,600',
    ],
    timeout: 30000,
  });
  return browser;
}

async function getExtensionId() {
  // Wait for the service worker target to appear (more reliable than timeout)
  const workerTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('background'),
    { timeout: 15000 }
  );

  if (workerTarget) {
    const match = workerTarget.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match) return match[1];
  }

  return null;
}

async function openPopup(extensionId) {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.waitForSelector('.container');
  // Wait for async init (locale loading + settings)
  await page.waitForFunction(() => {
    const btn = document.getElementById('start-stop-btn');
    return btn && btn.textContent.trim().length > 0;
  }, { timeout: 3000 });
  return page;
}

async function cleanStorage(page) {
  await page.evaluate(() => chrome.storage.local.clear());
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = {
  launchBrowser,
  getExtensionId,
  openPopup,
  cleanStorage,
  closeBrowser,
  EXTENSION_PATH,
};
