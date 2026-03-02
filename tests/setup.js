/**
 * Jest setup — Chrome Extension API mocks
 */

// ── chrome.storage.local mock ────────────────────────────────────────────────
const storageData = {};

const storageMock = {
  get: jest.fn((keys) => {
    return new Promise((resolve) => {
      if (typeof keys === 'string') {
        resolve({ [keys]: storageData[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach((k) => { result[k] = storageData[k]; });
        resolve(result);
      } else {
        resolve({ ...storageData });
      }
    });
  }),
  set: jest.fn((items) => {
    return new Promise((resolve) => {
      Object.assign(storageData, items);
      resolve();
    });
  }),
  remove: jest.fn((keys) => {
    return new Promise((resolve) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach((k) => delete storageData[k]);
      resolve();
    });
  }),
  clear: jest.fn(() => {
    return new Promise((resolve) => {
      Object.keys(storageData).forEach((k) => delete storageData[k]);
      resolve();
    });
  }),
};

// ── chrome.runtime mock ──────────────────────────────────────────────────────
const messageListeners = [];

const runtimeMock = {
  onMessage: {
    addListener: jest.fn((fn) => messageListeners.push(fn)),
    removeListener: jest.fn((fn) => {
      const idx = messageListeners.indexOf(fn);
      if (idx >= 0) messageListeners.splice(idx, 1);
    }),
  },
  sendMessage: jest.fn(() => Promise.resolve()),
};

// ── chrome.tabs mock ─────────────────────────────────────────────────────────
const tabsMock = {
  query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://www.facebook.com/' }])),
  sendMessage: jest.fn(() => Promise.resolve({ ok: true })),
};

// ── chrome.action mock ───────────────────────────────────────────────────────
const actionMock = {
  setBadgeText: jest.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: jest.fn(() => Promise.resolve()),
};

// ── Assemble global chrome object ────────────────────────────────────────────
global.chrome = {
  storage: {
    local: storageMock,
  },
  runtime: runtimeMock,
  tabs: tabsMock,
  action: actionMock,
};

// ── Test helpers ─────────────────────────────────────────────────────────────
global.__testHelpers = {
  storageData,
  messageListeners,
  clearStorage: () => {
    Object.keys(storageData).forEach((k) => delete storageData[k]);
  },
  resetMocks: () => {
    storageMock.get.mockClear();
    storageMock.set.mockClear();
    storageMock.remove.mockClear();
    storageMock.clear.mockClear();
    runtimeMock.sendMessage.mockClear();
    runtimeMock.onMessage.addListener.mockClear();
    tabsMock.query.mockClear();
    tabsMock.sendMessage.mockClear();
    actionMock.setBadgeText.mockClear();
    actionMock.setBadgeBackgroundColor.mockClear();
    messageListeners.length = 0;
  },
};
