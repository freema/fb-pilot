/**
 * FB Pilot — Popup Script
 * Controls the extension popup UI, settings persistence, and communication with content script.
 */
(function () {
  'use strict';

  // ── i18n — loaded from _locales JSON files ─────────────────────────────────
  const i18n = { en: {}, cz: {} };
  const SUPPORTED_LANGS = ['en', 'cz'];

  async function loadLocales() {
    for (const lang of SUPPORTED_LANGS) {
      try {
        const resp = await fetch(`../locales/${lang}/messages.json`);
        i18n[lang] = await resp.json();
      } catch (_) {
        // fallback: keep empty, applyLanguage will use 'en'
      }
    }
  }

  // ── DOM elements ───────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const langSelect = $('lang-select');
  const startStopBtn = $('start-stop-btn');
  const statusIndicator = $('status-indicator');
  const statusText = $('status-text');
  const batchCountEl = $('batch-count');
  const dailyCountEl = $('daily-count');
  const softLimitBanner = $('soft-limit-banner');
  const softLimitText = $('soft-limit-text');
  const scrollPrompt = $('scroll-prompt');
  const scrollText = $('scroll-text');
  const settingsLabel = $('settings-label');
  const batchLabel = $('batch-label');
  const dailyLabel = $('daily-label');

  // Settings inputs
  const inviteWordInput = $('invite-word');
  const detectModeSelect = $('detect-mode');
  const maxBatchInput = $('max-batch');
  const delayMinInput = $('delay-min');
  const delayMaxInput = $('delay-max');
  const coffeeIntervalInput = $('coffee-interval');
  const coffeeDurationInput = $('coffee-duration');

  // Label elements
  const labelInviteWord = $('label-invite-word');
  const labelDetectMode = $('label-detect-mode');
  const detectOptBoth = $('detect-opt-both');
  const detectOptText = $('detect-opt-text');
  const detectOptAria = $('detect-opt-aria');
  const labelMaxBatch = $('label-max-batch');
  const labelDelayMin = $('label-delay-min');
  const labelDelayMax = $('label-delay-max');
  const labelCoffeeInterval = $('label-coffee-interval');
  const labelCoffeeDuration = $('label-coffee-duration');

  let currentLang = 'en';
  let isRunning = false;
  let pollTimer = null;

  // ── Settings ───────────────────────────────────────────────────────────────

  // Single source of truth: shared/defaults.js (loaded before this script)
  const defaults = (typeof FB_PILOT_DEFAULTS !== 'undefined')
    ? FB_PILOT_DEFAULTS
    : require('../shared/defaults.js');

  function getSettingsFromUI() {
    return {
      inviteWord: inviteWordInput.value.trim() || defaults.inviteWord,
      detectMode: detectModeSelect.value || defaults.detectMode,
      maxPerBatch: parseInt(maxBatchInput.value, 10) || defaults.maxPerBatch,
      delayMin: parseInt(delayMinInput.value, 10) || defaults.delayMin,
      delayMax: parseInt(delayMaxInput.value, 10) || defaults.delayMax,
      coffeeBreakInterval: parseInt(coffeeIntervalInput.value, 10) || defaults.coffeeBreakInterval,
      coffeeBreakDuration: parseInt(coffeeDurationInput.value, 10) || defaults.coffeeBreakDuration,
    };
  }

  function applySettingsToUI(s) {
    inviteWordInput.value = s.inviteWord || defaults.inviteWord;
    detectModeSelect.value = s.detectMode || defaults.detectMode;
    maxBatchInput.value = s.maxPerBatch || defaults.maxPerBatch;
    delayMinInput.value = s.delayMin || defaults.delayMin;
    delayMaxInput.value = s.delayMax || defaults.delayMax;
    coffeeIntervalInput.value = s.coffeeBreakInterval || defaults.coffeeBreakInterval;
    coffeeDurationInput.value = s.coffeeBreakDuration || defaults.coffeeBreakDuration;
  }

  async function loadSettings() {
    // Apply defaults first, then override with saved settings
    applySettingsToUI(defaults);
    const result = await chrome.storage.local.get('fbPilotSettings');
    if (result.fbPilotSettings) {
      applySettingsToUI({ ...defaults, ...result.fbPilotSettings });
    }
    const langResult = await chrome.storage.local.get('fbPilotLang');
    if (langResult.fbPilotLang) {
      currentLang = langResult.fbPilotLang;
      langSelect.value = currentLang;
    }
  }

  async function saveSettings() {
    const settings = getSettingsFromUI();
    await chrome.storage.local.set({ fbPilotSettings: settings });
  }

  // ── i18n ───────────────────────────────────────────────────────────────────

  function applyLanguage(lang) {
    currentLang = lang;
    const t = i18n[lang] || i18n.en;

    startStopBtn.textContent = isRunning ? t.stop : t.start;
    batchLabel.textContent = t.batch;
    dailyLabel.textContent = t.today;
    settingsLabel.textContent = t.settings;
    softLimitText.textContent = t.softLimitBanner;
    scrollText.textContent = t.scrollPrompt;

    labelInviteWord.textContent = t.inviteWord;
    labelDetectMode.textContent = t.detectMode;
    detectOptBoth.textContent = t.detectBoth;
    detectOptText.textContent = t.detectText;
    detectOptAria.textContent = t.detectAria;
    labelMaxBatch.textContent = t.maxBatch;
    labelDelayMin.textContent = t.delayMin;
    labelDelayMax.textContent = t.delayMax;
    labelCoffeeInterval.textContent = t.coffeeInterval;
    labelCoffeeDuration.textContent = t.coffeeDuration;

    // Update status text based on current state
    updateStatusText(statusIndicator.className);

    chrome.storage.local.set({ fbPilotLang: lang });
  }

  function updateStatusText(className) {
    const t = i18n[currentLang] || i18n.en;
    if (className.includes('status-running')) {
      statusText.textContent = t.running;
    } else if (className.includes('status-waiting')) {
      statusText.textContent = t.waiting;
    } else if (className.includes('status-soft-limited')) {
      statusText.textContent = t.softLimited;
    } else if (className.includes('status-batch-done')) {
      statusText.textContent = t.batchDone;
    } else {
      statusText.textContent = t.idle;
    }
  }

  // ── UI updates ─────────────────────────────────────────────────────────────

  function updateUI(status) {
    const t = i18n[currentLang] || i18n.en;

    batchCountEl.textContent = status.batchCount || 0;

    // Status indicator
    statusIndicator.className = 'status-dot';
    softLimitBanner.classList.add('hidden');
    scrollPrompt.classList.add('hidden');

    switch (status.state) {
      case 'RUNNING':
        statusIndicator.classList.add('status-running');
        statusText.textContent = t.running;
        isRunning = true;
        startStopBtn.textContent = t.stop;
        startStopBtn.classList.add('active');
        break;
      case 'WAITING_FOR_SCROLL':
        statusIndicator.classList.add('status-waiting');
        statusText.textContent = t.waiting;
        scrollPrompt.classList.remove('hidden');
        isRunning = true;
        startStopBtn.textContent = t.stop;
        startStopBtn.classList.add('active');
        break;
      case 'SOFT_LIMITED':
        statusIndicator.classList.add('status-soft-limited');
        statusText.textContent = t.softLimited;
        softLimitBanner.classList.remove('hidden');
        isRunning = false;
        startStopBtn.textContent = t.start;
        startStopBtn.classList.remove('active');
        break;
      case 'BATCH_DONE':
        statusIndicator.classList.add('status-batch-done');
        statusText.textContent = t.batchDone;
        isRunning = false;
        startStopBtn.textContent = t.start;
        startStopBtn.classList.remove('active');
        break;
      default: // IDLE
        statusIndicator.classList.add('status-idle');
        statusText.textContent = t.idle;
        isRunning = false;
        startStopBtn.textContent = t.start;
        startStopBtn.classList.remove('active');
        break;
    }
  }

  // ── Communication ──────────────────────────────────────────────────────────

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendToContent(message) {
    const tab = await getActiveTab();
    if (!tab || !tab.id) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (_) {
      return null;
    }
  }

  async function pollStatus() {
    const response = await sendToContent({ type: 'getStatus' });
    if (response) {
      updateUI(response);
    }
    // Get daily count from background
    try {
      const bgResponse = await chrome.runtime.sendMessage({ type: 'getDailyCount' });
      if (bgResponse) {
        dailyCountEl.textContent = bgResponse.count || 0;
      }
    } catch (_) {
      // background not ready
    }
  }

  function startPolling() {
    pollStatus();
    pollTimer = setInterval(pollStatus, 1000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  startStopBtn.addEventListener('click', async () => {
    if (isRunning) {
      await sendToContent({ type: 'stop' });
      isRunning = false;
    } else {
      const settings = getSettingsFromUI();
      await chrome.storage.local.set({ fbPilotSettings: settings });
      await sendToContent({ type: 'start', settings });
      isRunning = true;
    }
    pollStatus();
  });

  langSelect.addEventListener('change', () => {
    applyLanguage(langSelect.value);
  });

  // Save settings on any input change
  const settingInputs = [inviteWordInput, detectModeSelect, maxBatchInput, delayMinInput, delayMaxInput, coffeeIntervalInput, coffeeDurationInput];
  settingInputs.forEach((input) => {
    input.addEventListener('change', saveSettings);
  });

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'statusUpdate' && msg.payload) {
      updateUI(msg.payload);
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  loadLocales().then(() => {
    return loadSettings();
  }).then(() => {
    applyLanguage(currentLang);
    startPolling();
  });

  // Clean up on close
  window.addEventListener('unload', stopPolling);

  // ── Exports for testing ───────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      i18n,
      loadLocales,
      getSettingsFromUI,
      applySettingsToUI,
      applyLanguage,
      updateUI,
      loadSettings,
      saveSettings,
    };
  }
})();
