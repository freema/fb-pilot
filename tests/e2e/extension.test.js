/**
 * E2E tests — Chrome extension with Puppeteer
 *
 * These tests require Chrome to be installed.
 * Run with: npm run test:e2e
 */
const { launchBrowser, getExtensionId, openPopup, cleanStorage, closeBrowser } = require('./setup');

jest.setTimeout(30000);

let extensionId;

beforeAll(async () => {
  await launchBrowser();
  extensionId = await getExtensionId();
});

afterAll(async () => {
  await closeBrowser();
});

describe('Extension loading', () => {
  test('extension loads and has an ID', () => {
    expect(extensionId).toBeTruthy();
    expect(typeof extensionId).toBe('string');
    expect(extensionId.length).toBeGreaterThan(0);
  });

  test('extension ID is a 32-char alphanumeric string', () => {
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });
});

describe('Popup UI', () => {
  let page;

  beforeEach(async () => {
    page = await openPopup(extensionId);
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test('renders all core controls', async () => {
    const elements = await page.evaluate(() => ({
      startBtn: !!document.getElementById('start-stop-btn'),
      langSelect: !!document.getElementById('lang-select'),
      batchCount: !!document.getElementById('batch-count'),
      dailyCount: !!document.getElementById('daily-count'),
      settings: !!document.querySelector('.settings-panel'),
      statusDot: !!document.getElementById('status-indicator'),
      statusText: !!document.getElementById('status-text'),
    }));

    expect(elements.startBtn).toBe(true);
    expect(elements.langSelect).toBe(true);
    expect(elements.batchCount).toBe(true);
    expect(elements.dailyCount).toBe(true);
    expect(elements.settings).toBe(true);
    expect(elements.statusDot).toBe(true);
    expect(elements.statusText).toBe(true);
  });

  test('start button shows "Start" initially', async () => {
    const text = await page.$eval('#start-stop-btn', (el) => el.textContent);
    expect(text).toBe('Start');
  });

  test('status indicator has idle class initially', async () => {
    const classes = await page.$eval('#status-indicator', (el) => el.className);
    expect(classes).toContain('status-idle');
  });

  test('soft limit banner is hidden initially', async () => {
    const hidden = await page.$eval('#soft-limit-banner', (el) => el.classList.contains('hidden'));
    expect(hidden).toBe(true);
  });

  test('scroll prompt is hidden initially', async () => {
    const hidden = await page.$eval('#scroll-prompt', (el) => el.classList.contains('hidden'));
    expect(hidden).toBe(true);
  });

  test('batch count is 0 initially', async () => {
    const text = await page.$eval('#batch-count', (el) => el.textContent);
    expect(text).toBe('0');
  });

  test('language selector has EN and CZ options', async () => {
    const options = await page.$$eval('#lang-select option', (els) =>
      els.map((el) => el.value)
    );
    expect(options).toContain('en');
    expect(options).toContain('cz');
  });

  test('detect mode selector has all three options', async () => {
    const options = await page.$$eval('#detect-mode option', (els) =>
      els.map((el) => el.value)
    );
    expect(options).toEqual(['both', 'text', 'aria']);
  });

  test('changing language updates settings label', async () => {
    await page.select('#lang-select', 'cz');
    await page.waitForFunction(
      () => document.getElementById('settings-label').textContent !== 'Settings',
      { timeout: 2000 }
    );
    const text = await page.$eval('#settings-label', (el) => el.textContent);
    expect(text).toBe('Nastaven\u00ed');
  });

  test('changing language updates detect mode labels', async () => {
    await page.select('#lang-select', 'cz');
    await page.waitForFunction(
      () => document.getElementById('detect-opt-text').textContent !== 'Text only',
      { timeout: 2000 }
    );
    const text = await page.$eval('#detect-opt-text', (el) => el.textContent);
    expect(text).toBe('Pouze text');
  });

  test('settings have correct default values', async () => {
    const defaults = await page.evaluate(() => ({
      inviteWord: document.getElementById('invite-word').value,
      detectMode: document.getElementById('detect-mode').value,
      maxBatch: document.getElementById('max-batch').value,
      delayMin: document.getElementById('delay-min').value,
      delayMax: document.getElementById('delay-max').value,
      coffeeInterval: document.getElementById('coffee-interval').value,
      coffeeDuration: document.getElementById('coffee-duration').value,
    }));

    expect(defaults.inviteWord).toBe('Invite');
    expect(defaults.detectMode).toBe('both');
    expect(defaults.maxBatch).toBe('50');
    expect(defaults.delayMin).toBe('800');
    expect(defaults.delayMax).toBe('2500');
    expect(defaults.coffeeInterval).toBe('15');
    expect(defaults.coffeeDuration).toBe('5000');
  });

  test('settings persist across popup close/reopen', async () => {
    // Change settings
    await page.$eval('#max-batch', (el) => { el.value = '99'; });
    await page.$eval('#max-batch', (el) => el.dispatchEvent(new Event('change')));
    await page.select('#detect-mode', 'aria');
    await page.waitForFunction(
      () => true, // small yield for async storage write
      { timeout: 500 }
    );

    // Close and reopen
    await page.close();
    page = await openPopup(extensionId);

    const values = await page.evaluate(() => ({
      maxBatch: document.getElementById('max-batch').value,
      detectMode: document.getElementById('detect-mode').value,
    }));

    expect(values.maxBatch).toBe('99');
    expect(values.detectMode).toBe('aria');
  });

  test('no console errors on popup load', async () => {
    const errors = [];
    const newPage = await openPopup(extensionId);
    newPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Small wait for any async errors
    await newPage.waitForFunction(() => true, { timeout: 500 });
    await newPage.close();
    // Filter out known Chrome extension context errors
    const realErrors = errors.filter((e) => !e.includes('Extension context'));
    expect(realErrors).toHaveLength(0);
  });
});
