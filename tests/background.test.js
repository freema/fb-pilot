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
