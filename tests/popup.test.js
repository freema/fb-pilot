/**
 * Unit tests for popup/popup.js
 */
const fs = require('fs');
const path = require('path');

// Load locale JSONs for mocking fetch
const enMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', 'en', 'messages.json'), 'utf-8'));
const czMessages = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_locales', 'cz', 'messages.json'), 'utf-8'));

let popupModule;

beforeEach(async () => {
  global.__testHelpers.clearStorage();
  global.__testHelpers.resetMocks();

  // Load the popup HTML into jsdom
  const html = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.html'), 'utf-8');
  document.documentElement.innerHTML = html;

  // Mock fetch for locale loading
  global.fetch = jest.fn((url) => {
    if (url.includes('/en/')) {
      return Promise.resolve({ json: () => Promise.resolve(enMessages) });
    }
    if (url.includes('/cz/')) {
      return Promise.resolve({ json: () => Promise.resolve(czMessages) });
    }
    return Promise.reject(new Error('Unknown locale'));
  });

  // Re-require popup.js to re-run IIFE with fresh DOM
  jest.resetModules();
  require('./setup');

  // Re-mock fetch after resetModules
  global.fetch = jest.fn((url) => {
    if (url.includes('/en/')) {
      return Promise.resolve({ json: () => Promise.resolve(enMessages) });
    }
    if (url.includes('/cz/')) {
      return Promise.resolve({ json: () => Promise.resolve(czMessages) });
    }
    return Promise.reject(new Error('Unknown locale'));
  });

  popupModule = require('../popup/popup.js');

  // Wait for async init (loadLocales + loadSettings)
  await popupModule.loadLocales();
});

describe('i18n', () => {
  test('has EN and CZ languages loaded from JSON', () => {
    expect(popupModule.i18n).toHaveProperty('en');
    expect(popupModule.i18n).toHaveProperty('cz');
  });

  test('EN has all required keys', () => {
    const keys = ['start', 'stop', 'idle', 'running', 'waiting', 'softLimited',
      'batchDone', 'batch', 'today', 'settings', 'detectMode', 'detectBoth',
      'detectText', 'detectAria'];
    keys.forEach((k) => {
      expect(popupModule.i18n.en).toHaveProperty(k);
    });
  });

  test('CZ has all required keys matching EN', () => {
    const keys = Object.keys(popupModule.i18n.en);
    keys.forEach((k) => {
      expect(popupModule.i18n.cz).toHaveProperty(k);
    });
  });

  test('CZ values are different from EN (actually translated)', () => {
    expect(popupModule.i18n.cz.start).not.toBe(popupModule.i18n.en.start);
    expect(popupModule.i18n.cz.settings).not.toBe(popupModule.i18n.en.settings);
    expect(popupModule.i18n.cz.idle).not.toBe(popupModule.i18n.en.idle);
  });

  test('applyLanguage changes UI strings to CZ', () => {
    popupModule.applyLanguage('cz');

    const settingsLabel = document.getElementById('settings-label');
    expect(settingsLabel.textContent).toBe(popupModule.i18n.cz.settings);

    const batchLabel = document.getElementById('batch-label');
    expect(batchLabel.textContent).toBe(popupModule.i18n.cz.batch);
  });

  test('applyLanguage changes UI strings to EN', () => {
    popupModule.applyLanguage('cz');
    popupModule.applyLanguage('en');

    const settingsLabel = document.getElementById('settings-label');
    expect(settingsLabel.textContent).toBe(popupModule.i18n.en.settings);
  });

  test('applyLanguage updates detect mode option labels', () => {
    popupModule.applyLanguage('cz');

    expect(document.getElementById('detect-opt-both').textContent).toBe(popupModule.i18n.cz.detectBoth);
    expect(document.getElementById('detect-opt-text').textContent).toBe(popupModule.i18n.cz.detectText);
    expect(document.getElementById('detect-opt-aria').textContent).toBe(popupModule.i18n.cz.detectAria);
  });

  test('applyLanguage persists language to storage', () => {
    popupModule.applyLanguage('cz');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ fbPilotLang: 'cz' });
  });
});

describe('Settings', () => {
  test('getSettingsFromUI reads all input values including detectMode', () => {
    document.getElementById('invite-word').value = 'Pozvat';
    document.getElementById('detect-mode').value = 'aria';
    document.getElementById('max-batch').value = '30';
    document.getElementById('delay-min').value = '1000';
    document.getElementById('delay-max').value = '3000';
    document.getElementById('coffee-interval').value = '10';
    document.getElementById('coffee-duration').value = '8000';

    const settings = popupModule.getSettingsFromUI();

    expect(settings.inviteWord).toBe('Pozvat');
    expect(settings.detectMode).toBe('aria');
    expect(settings.maxPerBatch).toBe(30);
    expect(settings.delayMin).toBe(1000);
    expect(settings.delayMax).toBe(3000);
    expect(settings.coffeeBreakInterval).toBe(10);
    expect(settings.coffeeBreakDuration).toBe(8000);
  });

  test('getSettingsFromUI defaults detectMode to both', () => {
    const settings = popupModule.getSettingsFromUI();
    expect(settings.detectMode).toBe('both');
  });

  test('applySettingsToUI sets all values including detectMode', () => {
    popupModule.applySettingsToUI({
      inviteWord: 'Pozvat',
      detectMode: 'text',
      maxPerBatch: 25,
      delayMin: 600,
      delayMax: 2000,
      coffeeBreakInterval: 20,
      coffeeBreakDuration: 10000,
    });

    expect(document.getElementById('invite-word').value).toBe('Pozvat');
    expect(document.getElementById('detect-mode').value).toBe('text');
    expect(document.getElementById('max-batch').value).toBe('25');
    expect(document.getElementById('delay-min').value).toBe('600');
    expect(document.getElementById('delay-max').value).toBe('2000');
    expect(document.getElementById('coffee-interval').value).toBe('20');
    expect(document.getElementById('coffee-duration').value).toBe('10000');
  });

  test('saveSettings persists to chrome.storage', async () => {
    document.getElementById('max-batch').value = '75';
    await popupModule.saveSettings();

    expect(chrome.storage.local.set).toHaveBeenCalled();
    const call = chrome.storage.local.set.mock.calls.at(-1)[0];
    expect(call.fbPilotSettings.maxPerBatch).toBe(75);
  });

  test('saveSettings includes detectMode', async () => {
    document.getElementById('detect-mode').value = 'aria';
    await popupModule.saveSettings();

    const call = chrome.storage.local.set.mock.calls.at(-1)[0];
    expect(call.fbPilotSettings.detectMode).toBe('aria');
  });

  test('applySettingsToUI handles missing detectMode gracefully', () => {
    popupModule.applySettingsToUI({
      inviteWord: 'Invite',
      maxPerBatch: 50,
      delayMin: 800,
      delayMax: 2500,
      coffeeBreakInterval: 15,
      coffeeBreakDuration: 5000,
    });

    // Should default to 'both'
    expect(document.getElementById('detect-mode').value).toBe('both');
  });
});

describe('updateUI', () => {
  test('updates batch counter display', () => {
    popupModule.updateUI({ state: 'RUNNING', batchCount: 12 });

    expect(document.getElementById('batch-count').textContent).toBe('12');
  });

  test('shows soft limit banner when SOFT_LIMITED', () => {
    popupModule.updateUI({ state: 'SOFT_LIMITED', batchCount: 5 });

    const banner = document.getElementById('soft-limit-banner');
    expect(banner.classList.contains('hidden')).toBe(false);
  });

  test('hides soft limit banner when RUNNING', () => {
    popupModule.updateUI({ state: 'RUNNING', batchCount: 0 });

    const banner = document.getElementById('soft-limit-banner');
    expect(banner.classList.contains('hidden')).toBe(true);
  });

  test('shows scroll prompt when WAITING_FOR_SCROLL', () => {
    popupModule.updateUI({ state: 'WAITING_FOR_SCROLL', batchCount: 3 });

    const prompt = document.getElementById('scroll-prompt');
    expect(prompt.classList.contains('hidden')).toBe(false);
  });

  test('hides scroll prompt when not WAITING_FOR_SCROLL', () => {
    popupModule.updateUI({ state: 'RUNNING', batchCount: 0 });

    const prompt = document.getElementById('scroll-prompt');
    expect(prompt.classList.contains('hidden')).toBe(true);
  });

  test('sets button to Stop when RUNNING', () => {
    popupModule.applyLanguage('en');
    popupModule.updateUI({ state: 'RUNNING', batchCount: 0 });

    const btn = document.getElementById('start-stop-btn');
    expect(btn.textContent).toBe('Stop');
    expect(btn.classList.contains('active')).toBe(true);
  });

  test('sets button to Start when IDLE', () => {
    popupModule.applyLanguage('en');
    popupModule.updateUI({ state: 'IDLE', batchCount: 0 });

    const btn = document.getElementById('start-stop-btn');
    expect(btn.textContent).toBe('Start');
    expect(btn.classList.contains('active')).toBe(false);
  });

  test('sets button to Stop when WAITING_FOR_SCROLL (still running)', () => {
    popupModule.applyLanguage('en');
    popupModule.updateUI({ state: 'WAITING_FOR_SCROLL', batchCount: 5 });

    const btn = document.getElementById('start-stop-btn');
    expect(btn.textContent).toBe('Stop');
    expect(btn.classList.contains('active')).toBe(true);
  });

  test('sets button to Start when BATCH_DONE', () => {
    popupModule.applyLanguage('en');
    popupModule.updateUI({ state: 'BATCH_DONE', batchCount: 50 });

    const btn = document.getElementById('start-stop-btn');
    expect(btn.textContent).toBe('Start');
    expect(btn.classList.contains('active')).toBe(false);
  });

  test('handles zero batchCount', () => {
    popupModule.updateUI({ state: 'IDLE', batchCount: 0 });
    expect(document.getElementById('batch-count').textContent).toBe('0');
  });

  test('handles missing batchCount', () => {
    popupModule.updateUI({ state: 'IDLE' });
    expect(document.getElementById('batch-count').textContent).toBe('0');
  });
});
