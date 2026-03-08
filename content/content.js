/**
 * FB Pilot — Content Script
 * Automates clicking "Invite"/"Pozvat" buttons on Facebook page reaction lists.
 */
(function () {
  'use strict';

  // ── State machine ──────────────────────────────────────────────────────────
  const State = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    WAITING_FOR_SCROLL: 'WAITING_FOR_SCROLL',
    SOFT_LIMITED: 'SOFT_LIMITED',
    BATCH_DONE: 'BATCH_DONE',
  };

  // ── Default settings ───────────────────────────────────────────────────────
  // Detection modes: 'text' = text match only, 'aria' = aria-label only, 'both' = combined
  const DetectMode = {
    TEXT: 'text',
    ARIA: 'aria',
    BOTH: 'both',
  };

  // Single source of truth: shared/defaults.js (loaded before this script in manifest)
  const DEFAULT_SETTINGS = (typeof FB_PILOT_DEFAULTS !== 'undefined')
    ? { ...FB_PILOT_DEFAULTS } // browser: injected via manifest content_scripts
    : { ...require('../shared/defaults.js') }; // tests: Node.js require

  // ── Module state ───────────────────────────────────────────────────────────
  let state = State.IDLE;
  let settings = { ...DEFAULT_SETTINGS };
  let batchCount = 0;
  let softLimitStreak = 0;
  let abortController = null;
  let observer = null;
  let pendingNewNodes = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomDelay() {
    return (
      settings.delayMin +
      Math.random() * (settings.delayMax - settings.delayMin)
    );
  }

  /**
   * Dispatch a realistic sequence of mouse events on an element.
   */
  function humanClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const common = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };

    el.dispatchEvent(new MouseEvent('mouseover', common));
    el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...common, button: 0 }));
  }

  /**
   * Find visible <span>/<div> elements whose trimmed textContent matches inviteWord.
   */
  function findInviteTextNodes(inviteWord) {
    const word = inviteWord.toLowerCase();
    const candidates = document.querySelectorAll('span, div');
    const results = [];

    for (const el of candidates) {
      const text = el.textContent.trim().toLowerCase();
      if (text !== word) continue;
      // Prefer innermost match: skip if a child element has the same matching text
      const hasChildMatch = Array.from(el.querySelectorAll('span, div')).some(
        (child) => child.textContent.trim().toLowerCase() === word
      );
      if (hasChildMatch) continue;
      if (!isVisible(el)) continue;
      results.push(el);
    }
    return results;
  }

  /**
   * Find visible elements with aria-label matching inviteWord.
   * Returns the clickable elements directly (no need for getClickableTarget walk).
   */
  function findAriaLabelButtons(inviteWord) {
    const word = inviteWord.toLowerCase();
    const selectors = [
      `div[aria-label]`,
      `button[aria-label]`,
      `a[aria-label]`,
      `[role="button"][aria-label]`,
    ];
    const candidates = document.querySelectorAll(selectors.join(', '));
    const results = [];

    for (const el of candidates) {
      const label = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (label !== word && !label.startsWith(word)) continue;
      if (!isVisible(el)) continue;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      results.push(el);
    }
    return results;
  }

  /**
   * Find invite buttons using the configured detection mode.
   * Returns array of { element, source } where source is 'text' or 'aria'.
   */
  function findInviteButtons(inviteWord, detectMode) {
    const results = [];
    const seen = new Set();

    if (detectMode === DetectMode.TEXT || detectMode === DetectMode.BOTH) {
      for (const textNode of findInviteTextNodes(inviteWord)) {
        const target = getClickableTarget(textNode);
        if (target && !seen.has(target)) {
          seen.add(target);
          results.push({ element: target, textNode, source: 'text' });
        }
      }
    }

    if (detectMode === DetectMode.ARIA || detectMode === DetectMode.BOTH) {
      for (const el of findAriaLabelButtons(inviteWord)) {
        if (!seen.has(el)) {
          seen.add(el);
          results.push({ element: el, textNode: null, source: 'aria' });
        }
      }
    }

    return results;
  }

  /**
   * Check if an element is visible (has layout dimensions and is not hidden).
   */
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  /**
   * Walk up the DOM from a text node to find the nearest clickable element:
   * <button>, div[role="button"], or <a>.
   */
  function getClickableTarget(textNode) {
    let current = textNode;
    const maxDepth = 10;
    let depth = 0;

    while (current && current !== document.body && depth < maxDepth) {
      const tag = current.tagName ? current.tagName.toLowerCase() : '';
      const role = current.getAttribute ? current.getAttribute('role') : null;

      if (tag === 'button' || tag === 'a' || role === 'button') {
        if (current.disabled || current.getAttribute('aria-disabled') === 'true') {
          return null;
        }
        return current;
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  // ── MutationObserver ───────────────────────────────────────────────────────

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (state === State.WAITING_FOR_SCROLL) {
        pendingNewNodes = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ── Auto-scroll ──────────────────────────────────────────────────────────

  /**
   * Find the scrollable container for the Facebook reaction list.
   * Looks for a scrollable element inside a dialog/modal.
   */
  function findScrollContainer() {
    // Strategy 1: dialog with a scrollable child
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      const scrollables = dialog.querySelectorAll('div');
      for (const div of scrollables) {
        if (div.scrollHeight > div.clientHeight + 10) {
          const style = window.getComputedStyle(div);
          const overflow = style.overflowY;
          if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
            return div;
          }
        }
      }
    }
    // Strategy 2: any scrollable div that contains invite-word text
    const word = settings.inviteWord.toLowerCase();
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      if (div.scrollHeight > div.clientHeight + 10 &&
          div.textContent.toLowerCase().includes(word)) {
        const style = window.getComputedStyle(div);
        const overflow = style.overflowY;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
          return div;
        }
      }
    }
    return null;
  }

  /**
   * Auto-scroll the reaction list container down to load more items.
   * Returns true if new nodes appeared after scrolling.
   */
  async function autoScroll(signal, maxAttempts) {
    const attempts = maxAttempts || 3;
    for (let i = 0; i < attempts; i++) {
      if (signal.aborted) return false;
      const container = findScrollContainer();
      if (!container) return false;

      pendingNewNodes = false;
      const scrollBefore = container.scrollTop;
      container.scrollBy({ top: 400, behavior: 'smooth' });
      await sleep(800);

      // Check if scroll actually moved (not at bottom already)
      if (container.scrollTop === scrollBefore) return false;

      // Wait for MutationObserver to flag new nodes
      const gotNew = await waitForNewNodes(signal, 3000);
      if (gotNew) return true;
    }
    return false;
  }

  // ── Core click loop ────────────────────────────────────────────────────────

  async function runClickLoop(signal) {
    batchCount = 0;
    softLimitStreak = 0;
    setState(State.RUNNING);
    startObserver();

    while (!signal.aborted) {
      const buttons = findInviteButtons(settings.inviteWord, settings.detectMode);

      if (buttons.length === 0) {
        setState(State.WAITING_FOR_SCROLL);
        broadcastStatus();

        // Auto-scroll to load more reactions
        const gotNew = await autoScroll(signal, 3);
        if (signal.aborted) break;
        if (!gotNew) {
          setState(State.BATCH_DONE);
          break;
        }
        setState(State.RUNNING);
        broadcastStatus();
        continue;
      }

      for (const btn of buttons) {
        if (signal.aborted) break;
        if (batchCount >= settings.maxPerBatch) {
          setState(State.BATCH_DONE);
          broadcastStatus();
          return;
        }

        // Scroll button into view so humanClick dispatches at visible coordinates
        btn.element.scrollIntoView({ block: 'center', behavior: 'instant' });
        await sleep(150);

        // For soft limit detection: check text or aria-label before/after click
        const labelBefore = btn.textNode
          ? btn.textNode.textContent.trim()
          : (btn.element.getAttribute('aria-label') || '').trim();

        humanClick(btn.element);

        // Wait for Facebook to update the DOM after click
        await sleep(600);
        const labelAfter = btn.textNode
          ? btn.textNode.textContent.trim()
          : (btn.element.getAttribute('aria-label') || '').trim();

        if (labelAfter.toLowerCase() === labelBefore.toLowerCase()) {
          softLimitStreak++;
          if (softLimitStreak >= 5) {
            setState(State.SOFT_LIMITED);
            broadcastStatus();
            return;
          }
        } else {
          softLimitStreak = 0;
          batchCount++;
          notifyBackground('incrementCounter');
          broadcastStatus();
        }

        // Coffee break
        if (
          settings.coffeeBreakInterval > 0 &&
          batchCount > 0 &&
          batchCount % settings.coffeeBreakInterval === 0
        ) {
          await sleep(settings.coffeeBreakDuration);
        }

        if (signal.aborted) break;
        await sleep(randomDelay());
      }
    }

    if (state === State.RUNNING) {
      setState(State.IDLE);
    }
    broadcastStatus();
  }

  function waitForNewNodes(signal, timeout) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (signal.aborted || pendingNewNodes) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(pendingNewNodes);
        }
      }, 200);
      const timer = setTimeout(() => {
        clearInterval(interval);
        resolve(false);
      }, timeout);
    });
  }

  // ── State management ───────────────────────────────────────────────────────

  function setState(newState) {
    state = newState;
  }

  function broadcastStatus() {
    try {
      chrome.runtime.sendMessage({
        type: 'statusUpdate',
        payload: getStatus(),
      });
    } catch (_) {
      // popup may be closed
    }
  }

  function getStatus() {
    return {
      state,
      batchCount,
      softLimitStreak,
      settings,
    };
  }

  function notifyBackground(action, data) {
    try {
      chrome.runtime.sendMessage({ type: action, ...data });
    } catch (_) {
      // background may not be ready
    }
  }

  // ── Start / Stop ──────────────────────────────────────────────────────────

  function start() {
    if (state === State.RUNNING) return;
    abortController = new AbortController();
    runClickLoop(abortController.signal);
  }

  function stop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    stopObserver();
    setState(State.IDLE);
    batchCount = 0;
    broadcastStatus();
  }

  // ── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'start':
        if (msg.settings) {
          Object.assign(settings, msg.settings);
        }
        start();
        sendResponse({ ok: true });
        break;
      case 'stop':
        stop();
        sendResponse({ ok: true });
        break;
      case 'getStatus':
        sendResponse(getStatus());
        break;
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
    return true; // async sendResponse
  });

  // ── Exports for testing ───────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      humanClick,
      findInviteTextNodes,
      findAriaLabelButtons,
      findInviteButtons,
      findScrollContainer,
      getClickableTarget,
      isVisible,
      State,
      DetectMode,
      DEFAULT_SETTINGS,
      getStatus,
      setState,
      randomDelay,
      // expose state accessors for testing
      _getState: () => state,
      _setState: (s) => { state = s; },
      _setSettings: (s) => { settings = { ...settings, ...s }; },
      _resetBatch: () => { batchCount = 0; softLimitStreak = 0; },
    };
  }
})();
