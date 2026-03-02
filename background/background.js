/**
 * FB Pilot — Background Service Worker
 * Handles daily counter persistence, midnight reset, and badge updates.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'fbPilotDaily';

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
    return data.count;
  }

  async function updateBadge(count) {
    const text = count > 0 ? String(count) : '';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#1877F2' });
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
      STORAGE_KEY,
    };
  }
})();
