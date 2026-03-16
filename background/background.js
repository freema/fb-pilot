/**
 * FB Pilot — Background Service Worker
 * Handles daily counter persistence, midnight reset, badge updates,
 * activity log, and desktop notifications.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'fbPilotDaily';
  const LOG_KEY = 'fbPilotLog';
  const MAX_LOG_DAYS = 30;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function todayKey() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  async function getDailyData() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || { date: todayKey(), count: 0 };
  }

  async function setDailyData(data) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  async function resetIfNewDay() {
    const data = await getDailyData();
    const today = todayKey();
    if (data.date !== today) {
      const newData = { date: today, count: 0 };
      await setDailyData(newData);
      return newData;
    }
    return data;
  }

  async function incrementCounter() {
    const data = await resetIfNewDay();
    data.count++;
    await setDailyData(data);
    await updateBadge(data.count);
    await updateLog({ invites: 1 });
    return data.count;
  }

  async function updateBadge(count) {
    const text = count > 0 ? String(count) : '';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#1877F2' });
  }

  // ── Activity Log ─────────────────────────────────────────────────────────

  async function getLog() {
    const result = await chrome.storage.local.get(LOG_KEY);
    return result[LOG_KEY] || [];
  }

  async function updateLog(delta) {
    const log = await getLog();
    const today = todayKey();
    let entry = log.find((e) => e.date === today);
    if (!entry) {
      entry = { date: today, invites: 0, softLimits: 0, sessions: 0 };
      log.unshift(entry);
    }
    if (delta.invites) entry.invites += delta.invites;
    if (delta.softLimits) entry.softLimits += delta.softLimits;
    if (delta.sessions) entry.sessions += delta.sessions;

    // Keep only last MAX_LOG_DAYS entries
    while (log.length > MAX_LOG_DAYS) log.pop();

    await chrome.storage.local.set({ [LOG_KEY]: log });
    return log;
  }

  async function clearLog() {
    await chrome.storage.local.set({ [LOG_KEY]: [] });
  }

  // ── Notifications ────────────────────────────────────────────────────────

  async function areNotificationsEnabled() {
    const result = await chrome.storage.local.get('fbPilotSettings');
    const settings = result.fbPilotSettings || {};
    return settings.notifications !== false;
  }

  async function showNotification(title, message) {
    const enabled = await areNotificationsEnabled();
    if (!enabled) return;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
    });
  }

  // ── Startup ────────────────────────────────────────────────────────────────

  async function init() {
    const data = await resetIfNewDay();
    await updateBadge(data.count);
  }

  // Run on service worker start
  init();

  // ── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'incrementCounter':
        incrementCounter().then((count) => sendResponse({ count }));
        return true;
      case 'getDailyCount':
        resetIfNewDay().then((current) => sendResponse({ count: current.count }));
        return true;
      case 'getLog':
        getLog().then((log) => sendResponse({ log }));
        return true;
      case 'clearLog':
        clearLog().then(() => sendResponse({ ok: true }));
        return true;
      case 'logSession':
        updateLog({ sessions: 1 }).then(() => sendResponse({ ok: true }));
        return true;
      case 'logSoftLimit':
        updateLog({ softLimits: 1 })
          .then(() => showNotification('FB Pilot', msg.message || 'Soft limit detected'))
          .then(() => sendResponse({ ok: true }));
        return true;
      case 'notifyBatchDone':
        showNotification('FB Pilot', msg.message || 'Batch complete!')
          .then(() => sendResponse({ ok: true }));
        return true;
      default:
        // Let other listeners handle it
        return false;
    }
  });

  // ── Exports for testing ───────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      todayKey,
      getDailyData,
      setDailyData,
      resetIfNewDay,
      incrementCounter,
      updateBadge,
      getLog,
      updateLog,
      clearLog,
      areNotificationsEnabled,
      showNotification,
      STORAGE_KEY,
      LOG_KEY,
      MAX_LOG_DAYS,
    };
  }
})();
