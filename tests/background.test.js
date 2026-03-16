/**
 * Unit tests for background/background.js
 */

let bgModule;

beforeAll(() => {
  bgModule = require('../background/background.js');
});

beforeEach(() => {
  global.__testHelpers.clearStorage();
  global.__testHelpers.resetMocks();
});

describe('todayKey', () => {
  test('returns YYYY-MM-DD format', () => {
    const key = bgModule.todayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('matches current date', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(bgModule.todayKey()).toBe(expected);
  });
});

describe('Daily counter', () => {
  test('incrementCounter increases count', async () => {
    const count = await bgModule.incrementCounter();
    expect(count).toBe(1);

    const count2 = await bgModule.incrementCounter();
    expect(count2).toBe(2);
  });

  test('getDailyData returns default when no data', async () => {
    const data = await bgModule.getDailyData();
    expect(data.count).toBe(0);
    expect(data.date).toBe(bgModule.todayKey());
  });

  test('setDailyData persists data', async () => {
    const testData = { date: '2025-01-01', count: 42 };
    await bgModule.setDailyData(testData);
    const data = await bgModule.getDailyData();
    expect(data.count).toBe(42);
    expect(data.date).toBe('2025-01-01');
  });
});

describe('Midnight reset', () => {
  test('resets count when date changes', async () => {
    // Set yesterday's data
    await bgModule.setDailyData({ date: '2020-01-01', count: 100 });

    const data = await bgModule.resetIfNewDay();
    expect(data.count).toBe(0);
    expect(data.date).toBe(bgModule.todayKey());
  });

  test('preserves count when same day', async () => {
    await bgModule.setDailyData({ date: bgModule.todayKey(), count: 25 });

    const data = await bgModule.resetIfNewDay();
    expect(data.count).toBe(25);
  });
});

describe('Badge updates', () => {
  test('updateBadge sets text and color', async () => {
    await bgModule.updateBadge(42);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '42' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#1877F2' });
  });

  test('updateBadge clears text for zero count', async () => {
    await bgModule.updateBadge(0);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  test('incrementCounter updates badge', async () => {
    await bgModule.incrementCounter();

    expect(chrome.action.setBadgeText).toHaveBeenCalled();
    const lastCall = chrome.action.setBadgeText.mock.calls.at(-1);
    expect(lastCall[0].text).toBe('1');
  });
});

// ── Activity Log ──────────────────────────────────────────────────────────────

describe('Activity log', () => {
  test('getLog returns empty array when no data', async () => {
    const log = await bgModule.getLog();
    expect(log).toEqual([]);
  });

  test('updateLog creates entry for today', async () => {
    const log = await bgModule.updateLog({ invites: 5 });
    expect(log).toHaveLength(1);
    expect(log[0].date).toBe(bgModule.todayKey());
    expect(log[0].invites).toBe(5);
  });

  test('updateLog accumulates invites on same day', async () => {
    await bgModule.updateLog({ invites: 3 });
    const log = await bgModule.updateLog({ invites: 2 });
    expect(log).toHaveLength(1);
    expect(log[0].invites).toBe(5);
  });

  test('updateLog tracks softLimits', async () => {
    await bgModule.updateLog({ softLimits: 1 });
    const log = await bgModule.updateLog({ softLimits: 1 });
    expect(log[0].softLimits).toBe(2);
  });

  test('updateLog tracks sessions', async () => {
    await bgModule.updateLog({ sessions: 1 });
    const log = await bgModule.updateLog({ sessions: 1 });
    expect(log[0].sessions).toBe(2);
  });

  test('incrementCounter also updates log', async () => {
    await bgModule.incrementCounter();
    await bgModule.incrementCounter();
    const log = await bgModule.getLog();
    expect(log[0].invites).toBe(2);
  });

  test('clearLog empties the log', async () => {
    await bgModule.updateLog({ invites: 10 });
    await bgModule.clearLog();
    const log = await bgModule.getLog();
    expect(log).toEqual([]);
  });

  test('updateLog limits entries to MAX_LOG_DAYS', async () => {
    // Manually create more than MAX_LOG_DAYS entries
    const entries = [];
    for (let i = 0; i < bgModule.MAX_LOG_DAYS + 5; i++) {
      entries.push({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, invites: i, softLimits: 0, sessions: 0 });
    }
    await chrome.storage.local.set({ [bgModule.LOG_KEY]: entries });

    // Adding a new entry should trim to MAX_LOG_DAYS
    const log = await bgModule.updateLog({ invites: 1 });
    expect(log.length).toBeLessThanOrEqual(bgModule.MAX_LOG_DAYS);
  });

  test('exports LOG_KEY and MAX_LOG_DAYS constants', () => {
    expect(bgModule.LOG_KEY).toBe('fbPilotLog');
    expect(bgModule.MAX_LOG_DAYS).toBe(30);
  });
});

// ── Notifications ─────────────────────────────────────────────────────────────

describe('Notifications', () => {
  test('areNotificationsEnabled returns true by default', async () => {
    const enabled = await bgModule.areNotificationsEnabled();
    expect(enabled).toBe(true);
  });

  test('areNotificationsEnabled returns false when disabled', async () => {
    await chrome.storage.local.set({ fbPilotSettings: { notifications: false } });
    const enabled = await bgModule.areNotificationsEnabled();
    expect(enabled).toBe(false);
  });

  test('showNotification creates notification when enabled', async () => {
    await bgModule.showNotification('Test Title', 'Test Message');
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'basic',
        title: 'Test Title',
        message: 'Test Message',
      })
    );
  });

  test('showNotification does not create notification when disabled', async () => {
    await chrome.storage.local.set({ fbPilotSettings: { notifications: false } });
    await bgModule.showNotification('Title', 'Message');
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});
