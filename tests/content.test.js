/**
 * Unit tests for content/content.js
 */

let contentModule;
let messageListener; // captured before mocks are reset

beforeAll(() => {
  contentModule = require('../content/content.js');
  // Capture the message listener that content.js registered during load
  messageListener = global.__testHelpers.messageListeners[
    global.__testHelpers.messageListeners.length - 1
  ];
});

beforeEach(() => {
  document.body.innerHTML = '';
  global.__testHelpers.resetMocks();
  contentModule._setState(contentModule.State.IDLE);
  contentModule._setSettings(contentModule.DEFAULT_SETTINGS);
});

// ── Helper ────────────────────────────────────────────────────────────────────

function makeVisible(el) {
  Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 50, height: 20, right: 60, bottom: 30 });
}

function makeHidden(el) {
  Object.defineProperty(el, 'offsetParent', { get: () => null, configurable: true });
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });
}

// ── humanClick ────────────────────────────────────────────────────────────────

describe('humanClick', () => {
  test('dispatches 4 mouse events in correct order', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 50, top: 100, width: 100, height: 40 });

    const events = [];
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((type) => {
      el.addEventListener(type, (e) => events.push(e.type));
    });

    contentModule.humanClick(el);
    expect(events).toEqual(['mouseover', 'mousedown', 'mouseup', 'click']);
  });

  test('calculates center coordinates from getBoundingClientRect', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 100, top: 200, width: 80, height: 30 });

    let capturedX, capturedY;
    el.addEventListener('click', (e) => { capturedX = e.clientX; capturedY = e.clientY; });

    contentModule.humanClick(el);
    expect(capturedX).toBe(140); // 100 + 80/2
    expect(capturedY).toBe(215); // 200 + 30/2
  });

  test('all events have bubbles=true and cancelable=true', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    const props = [];
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((type) => {
      el.addEventListener(type, (e) => props.push({ bubbles: e.bubbles, cancelable: e.cancelable }));
    });

    contentModule.humanClick(el);
    props.forEach((p) => {
      expect(p.bubbles).toBe(true);
      expect(p.cancelable).toBe(true);
    });
  });

  test('mousedown, mouseup, click have button=0 (left click)', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    const buttons = [];
    ['mousedown', 'mouseup', 'click'].forEach((type) => {
      el.addEventListener(type, (e) => buttons.push(e.button));
    });

    contentModule.humanClick(el);
    expect(buttons).toEqual([0, 0, 0]);
  });

  test('works on div[role=button] elements', () => {
    const el = document.createElement('div');
    el.setAttribute('role', 'button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });

    let clicked = false;
    el.addEventListener('click', () => { clicked = true; });
    contentModule.humanClick(el);
    expect(clicked).toBe(true);
  });
});

// ── findInviteTextNodes ──────────────────────────────────────────────────────

describe('findInviteTextNodes', () => {
  test('finds visible matching leaf elements', () => {
    document.body.innerHTML = '<div><span>Invite</span><span>Invite</span><span>Other</span></div>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(2);
  });

  test('ignores hidden elements', () => {
    document.body.innerHTML = '<div><span>Invite</span><span>Invite</span></div>';
    const spans = document.querySelectorAll('span');
    makeVisible(spans[0]);
    makeHidden(spans[1]);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(1);
  });

  test('is case-insensitive', () => {
    document.body.innerHTML = '<span>invite</span><span>INVITE</span><span>Invite</span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(3);
  });

  test('matches trimmed text (ignores whitespace)', () => {
    document.body.innerHTML = '<span>  Invite  </span><span>\nInvite\n</span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(2);
  });

  test('skips containers with too many nested elements', () => {
    document.body.innerHTML = '<div>Invite<span>child</span></div><span>Invite</span>';
    document.querySelectorAll('span, div').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    // The <div> has textContent "Invitechild" which doesn't match "Invite"
    // Only the standalone <span>Invite</span> matches
    expect(nodes).toHaveLength(1);
  });

  test('returns empty array when no matches', () => {
    document.body.innerHTML = '<span>Like</span><span>Share</span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(0);
  });

  test('works with custom invite word (e.g. Pozvat)', () => {
    document.body.innerHTML = '<span>Pozvat</span><span>Invite</span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Pozvat');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].textContent).toBe('Pozvat');
  });

  test('does not match partial text', () => {
    document.body.innerHTML = '<span>Invite to like</span><span>Uninvite</span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(0);
  });
});

// ── findAriaLabelButtons ─────────────────────────────────────────────────────

describe('findAriaLabelButtons', () => {
  test('finds div with matching aria-label', () => {
    document.body.innerHTML = '<div aria-label="Invite" role="button">X</div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('finds button with matching aria-label', () => {
    document.body.innerHTML = '<button aria-label="Invite">Click</button>';
    document.querySelectorAll('button').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('finds anchor with matching aria-label', () => {
    document.body.innerHTML = '<a aria-label="Invite" href="#">Link</a>';
    document.querySelectorAll('a').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('is case-insensitive', () => {
    document.body.innerHTML = '<div aria-label="invite" role="button"></div><div aria-label="INVITE" role="button"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(2);
  });

  test('ignores hidden elements', () => {
    document.body.innerHTML = '<div aria-label="Invite" role="button"></div><div aria-label="Invite" role="button"></div>';
    const divs = document.querySelectorAll('div');
    makeVisible(divs[0]);
    makeHidden(divs[1]);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('ignores disabled elements', () => {
    document.body.innerHTML = '<button aria-label="Invite" disabled>X</button>';
    document.querySelectorAll('button').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(0);
  });

  test('ignores aria-disabled elements', () => {
    document.body.innerHTML = '<div aria-label="Invite" role="button" aria-disabled="true"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(0);
  });

  test('matches aria-label that starts with invite word', () => {
    document.body.innerHTML = '<div aria-label="Invite to like page" role="button"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('does not match aria-label that does not start with invite word', () => {
    document.body.innerHTML = '<div aria-label="Uninvite from page" role="button"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(0);
  });

  test('trims aria-label whitespace', () => {
    document.body.innerHTML = '<div aria-label="  Invite  " role="button"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(1);
  });

  test('returns empty when no aria-label matches', () => {
    document.body.innerHTML = '<div aria-label="Like" role="button"></div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findAriaLabelButtons('Invite');
    expect(results).toHaveLength(0);
  });
});

// ── findInviteButtons (combined detection) ───────────────────────────────────

describe('findInviteButtons', () => {
  test('mode=text: finds only text matches', () => {
    document.body.innerHTML = `
      <button><span>Invite</span></button>
      <div aria-label="Invite" role="button">X</div>
    `;
    document.querySelectorAll('span, div, button').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'text');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('text');
  });

  test('mode=aria: finds only aria-label matches', () => {
    document.body.innerHTML = `
      <button><span>Invite</span></button>
      <div aria-label="Invite" role="button">X</div>
    `;
    document.querySelectorAll('span, div, button').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'aria');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('aria');
  });

  test('mode=both: finds text and aria-label matches', () => {
    document.body.innerHTML = `
      <button><span>Invite</span></button>
      <div aria-label="Invite" role="button">other text</div>
    `;
    document.querySelectorAll('span, div, button').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'both');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.source).sort()).toEqual(['aria', 'text']);
  });

  test('mode=both: deduplicates when same element matches both', () => {
    // A button with aria-label AND text content "Invite"
    document.body.innerHTML = '<div aria-label="Invite" role="button"><span>Invite</span></div>';
    document.querySelectorAll('span, div').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'both');
    // The text match finds span → walks up to div[role=button]
    // The aria match finds the same div[role=button]
    // Should deduplicate to 1
    expect(results).toHaveLength(1);
  });

  test('text results have textNode reference', () => {
    document.body.innerHTML = '<button><span>Invite</span></button>';
    document.querySelectorAll('span, button').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'text');
    expect(results[0].textNode).not.toBeNull();
    expect(results[0].textNode.textContent.trim()).toBe('Invite');
  });

  test('aria results have textNode=null', () => {
    document.body.innerHTML = '<div aria-label="Invite" role="button">X</div>';
    document.querySelectorAll('div').forEach(makeVisible);

    const results = contentModule.findInviteButtons('Invite', 'aria');
    expect(results[0].textNode).toBeNull();
  });

  test('returns empty array when nothing matches in any mode', () => {
    document.body.innerHTML = '<span>Like</span><div aria-label="Share" role="button"></div>';
    document.querySelectorAll('span, div').forEach(makeVisible);

    expect(contentModule.findInviteButtons('Invite', 'text')).toHaveLength(0);
    expect(contentModule.findInviteButtons('Invite', 'aria')).toHaveLength(0);
    expect(contentModule.findInviteButtons('Invite', 'both')).toHaveLength(0);
  });
});

// ── getClickableTarget ──────────────────────────────────────────────────────

describe('getClickableTarget', () => {
  test('returns closest button', () => {
    document.body.innerHTML = '<button><span>Invite</span></button>';
    const span = document.querySelector('span');
    const result = contentModule.getClickableTarget(span);
    expect(result.tagName.toLowerCase()).toBe('button');
  });

  test('returns div with role=button', () => {
    document.body.innerHTML = '<div role="button"><span>Invite</span></div>';
    const span = document.querySelector('span');
    const result = contentModule.getClickableTarget(span);
    expect(result.getAttribute('role')).toBe('button');
  });

  test('returns anchor element', () => {
    document.body.innerHTML = '<a href="#"><span>Invite</span></a>';
    const span = document.querySelector('span');
    const result = contentModule.getClickableTarget(span);
    expect(result.tagName.toLowerCase()).toBe('a');
  });

  test('returns null for disabled buttons', () => {
    document.body.innerHTML = '<button disabled><span>Invite</span></button>';
    const span = document.querySelector('span');
    expect(contentModule.getClickableTarget(span)).toBeNull();
  });

  test('returns null for aria-disabled buttons', () => {
    document.body.innerHTML = '<div role="button" aria-disabled="true"><span>Invite</span></div>';
    const span = document.querySelector('span');
    expect(contentModule.getClickableTarget(span)).toBeNull();
  });

  test('returns null when no clickable parent exists', () => {
    document.body.innerHTML = '<div><p><span>Invite</span></p></div>';
    const span = document.querySelector('span');
    expect(contentModule.getClickableTarget(span)).toBeNull();
  });

  test('returns nearest clickable ancestor (not a further one)', () => {
    document.body.innerHTML = '<a href="#"><div role="button"><span>Invite</span></div></a>';
    const span = document.querySelector('span');
    const result = contentModule.getClickableTarget(span);
    expect(result.getAttribute('role')).toBe('button');
  });

  test('handles deeply nested elements (within maxDepth)', () => {
    document.body.innerHTML = '<button><div><div><div><span>Invite</span></div></div></div></button>';
    const span = document.querySelector('span');
    const result = contentModule.getClickableTarget(span);
    expect(result.tagName.toLowerCase()).toBe('button');
  });

  test('returns null when clickable parent is beyond maxDepth', () => {
    // Create 12 levels of nesting (maxDepth is 10)
    let html = '<button>';
    for (let i = 0; i < 12; i++) html += '<div>';
    html += '<span>Invite</span>';
    for (let i = 0; i < 12; i++) html += '</div>';
    html += '</button>';
    document.body.innerHTML = html;

    const span = document.querySelector('span');
    expect(contentModule.getClickableTarget(span)).toBeNull();
  });
});

// ── isVisible ────────────────────────────────────────────────────────────────

describe('isVisible', () => {
  test('returns true for visible element', () => {
    const el = document.createElement('span');
    document.body.appendChild(el);
    makeVisible(el);
    expect(contentModule.isVisible(el)).toBe(true);
  });

  test('returns false when offsetParent is null', () => {
    const el = document.createElement('span');
    document.body.appendChild(el);
    makeHidden(el);
    expect(contentModule.isVisible(el)).toBe(false);
  });

  test('returns false for display:none', () => {
    const el = document.createElement('span');
    el.style.display = 'none';
    document.body.appendChild(el);
    Object.defineProperty(el, 'offsetParent', { get: () => null, configurable: true });
    el.getBoundingClientRect = () => ({ width: 0, height: 0 });
    expect(contentModule.isVisible(el)).toBe(false);
  });

  test('returns false for zero dimensions', () => {
    const el = document.createElement('span');
    document.body.appendChild(el);
    Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true });
    el.getBoundingClientRect = () => ({ width: 0, height: 0 });
    expect(contentModule.isVisible(el)).toBe(false);
  });
});

// ── State machine ────────────────────────────────────────────────────────────

describe('State machine', () => {
  test('exports all states', () => {
    expect(contentModule.State).toEqual({
      IDLE: 'IDLE',
      RUNNING: 'RUNNING',
      WAITING_FOR_SCROLL: 'WAITING_FOR_SCROLL',
      SOFT_LIMITED: 'SOFT_LIMITED',
      BATCH_DONE: 'BATCH_DONE',
    });
  });

  test('initial state is IDLE', () => {
    expect(contentModule.getStatus().state).toBe('IDLE');
  });

  test('transitions through all states', () => {
    const states = ['RUNNING', 'WAITING_FOR_SCROLL', 'SOFT_LIMITED', 'BATCH_DONE', 'IDLE'];
    states.forEach((s) => {
      contentModule._setState(s);
      expect(contentModule._getState()).toBe(s);
    });
  });
});

// ── DetectMode ───────────────────────────────────────────────────────────────

describe('DetectMode', () => {
  test('exports all detect modes', () => {
    expect(contentModule.DetectMode).toEqual({
      TEXT: 'text',
      ARIA: 'aria',
      BOTH: 'both',
    });
  });

  test('DEFAULT_SETTINGS includes detectMode=both', () => {
    expect(contentModule.DEFAULT_SETTINGS.detectMode).toBe('both');
  });
});

// ── randomDelay ──────────────────────────────────────────────────────────────

describe('randomDelay', () => {
  test('returns value within configured range', () => {
    contentModule._setSettings({ delayMin: 500, delayMax: 1000 });

    for (let i = 0; i < 50; i++) {
      const delay = contentModule.randomDelay();
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });

  test('returns exact value when min=max', () => {
    contentModule._setSettings({ delayMin: 1000, delayMax: 1000 });
    expect(contentModule.randomDelay()).toBe(1000);
  });
});

// ── DEFAULT_SETTINGS ─────────────────────────────────────────────────────────

describe('DEFAULT_SETTINGS', () => {
  test('matches shared defaults (single source of truth)', () => {
    const shared = require('../shared/defaults.js');
    expect(contentModule.DEFAULT_SETTINGS).toEqual(shared);
  });
});

// ── getStatus ────────────────────────────────────────────────────────────────

describe('getStatus', () => {
  test('returns current state and settings', () => {
    const status = contentModule.getStatus();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('batchCount');
    expect(status).toHaveProperty('softLimitStreak');
    expect(status).toHaveProperty('settings');
  });

  test('reflects state changes', () => {
    contentModule._setState('RUNNING');
    expect(contentModule.getStatus().state).toBe('RUNNING');
    contentModule._setState('IDLE');
    expect(contentModule.getStatus().state).toBe('IDLE');
  });

  test('settings in status reflect _setSettings changes', () => {
    contentModule._setSettings({ maxPerBatch: 99 });
    expect(contentModule.getStatus().settings.maxPerBatch).toBe(99);
    contentModule._setSettings({ maxPerBatch: 50 }); // reset
  });
});

// ── Message listener ─────────────────────────────────────────────────────────

describe('Message listener', () => {
  test('message listener was captured during module load', () => {
    expect(messageListener).toBeDefined();
    expect(typeof messageListener).toBe('function');
  });

  test('getStatus returns current state', () => {
    contentModule._setState('IDLE');
    const sendResponse = jest.fn();
    messageListener({ type: 'getStatus' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ state: 'IDLE' }));
  });

  test('unknown message type returns error', () => {
    const sendResponse = jest.fn();
    messageListener({ type: 'unknownType' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'unknown message type' });
  });

  test('stop resets state to IDLE', () => {
    contentModule._setState('RUNNING');
    const sendResponse = jest.fn();
    messageListener({ type: 'stop' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    expect(contentModule._getState()).toBe('IDLE');
  });

  test('start with settings merges them before running', () => {
    const sendResponse = jest.fn();
    messageListener({ type: 'start', settings: { inviteWord: 'Pozvat' } }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    expect(contentModule.getStatus().settings.inviteWord).toBe('Pozvat');
    // Stop to clean up
    messageListener({ type: 'stop' }, {}, jest.fn());
    contentModule._setSettings(contentModule.DEFAULT_SETTINGS);
  });

  test('returns true for async sendResponse', () => {
    const sendResponse = jest.fn();
    const result = messageListener({ type: 'getStatus' }, {}, sendResponse);
    expect(result).toBe(true);
  });
});

// ── Facebook-specific DOM patterns ───────────────────────────────────────────

describe('Facebook DOM patterns', () => {
  test('nested spans: finds leaf text inside nested structure', () => {
    // FB often wraps text in multiple span layers
    document.body.innerHTML = '<div role="button"><span><span>Invite</span></span></div>';
    document.querySelectorAll('span, div').forEach(makeVisible);

    const textNodes = contentModule.findInviteTextNodes('Invite');
    // Only the inner leaf span matches (outer span has children)
    expect(textNodes).toHaveLength(1);
    expect(textNodes[0].textContent).toBe('Invite');

    // getClickableTarget walks up to div[role=button]
    const target = contentModule.getClickableTarget(textNodes[0]);
    expect(target).not.toBeNull();
    expect(target.getAttribute('role')).toBe('button');
  });

  test('aria-label on div with different inner text', () => {
    // FB A/B test: aria-label says "Invite" but inner text is different
    document.body.innerHTML = '<div role="button" aria-label="Invite"><span>Invite to like</span></div>';
    document.querySelectorAll('span, div').forEach(makeVisible);

    // Text match should NOT find it (partial match)
    const textNodes = contentModule.findInviteTextNodes('Invite');
    expect(textNodes).toHaveLength(0);

    // But aria-label DOES find it
    const ariaButtons = contentModule.findAriaLabelButtons('Invite');
    expect(ariaButtons).toHaveLength(1);

    // findInviteButtons in 'both' mode finds it via aria
    const buttons = contentModule.findInviteButtons('Invite', 'both');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].source).toBe('aria');
  });

  test('multiple invite buttons in a reaction list', () => {
    document.body.innerHTML = `
      <div class="reaction-list">
        <div role="button"><span>Invite</span></div>
        <div role="button"><span>Invited</span></div>
        <div role="button"><span>Invite</span></div>
        <div role="button" aria-label="Invite"><span>Send invite</span></div>
      </div>
    `;
    document.querySelectorAll('span, div').forEach(makeVisible);

    // Text match: 2 "Invite" buttons (not "Invited", not "Send invite")
    const textNodes = contentModule.findInviteTextNodes('Invite');
    expect(textNodes).toHaveLength(2);

    // Combined mode: 2 text + 1 aria = 3
    const buttons = contentModule.findInviteButtons('Invite', 'both');
    expect(buttons).toHaveLength(3);
  });

  test('non-span/div elements are not found by text search', () => {
    document.body.innerHTML = '<p>Invite</p><li>Invite</li>';
    document.querySelectorAll('p, li').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(0);
  });

  test('empty text nodes do not match', () => {
    document.body.innerHTML = '<span></span><span>  </span>';
    document.querySelectorAll('span').forEach(makeVisible);

    const nodes = contentModule.findInviteTextNodes('Invite');
    expect(nodes).toHaveLength(0);
  });
});
