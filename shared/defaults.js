/**
 * FB Pilot — Single source of truth for default settings.
 * Used by content script, popup, and tests.
 */
/* eslint-disable no-var */
var FB_PILOT_DEFAULTS = {
  maxPerBatch: 50,
  delayMin: 1000,
  delayMax: 3000,
  coffeeBreakInterval: 15,
  coffeeBreakDuration: 5000,
  inviteWord: 'Pozvat',
  detectMode: 'both',
  notifications: true,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FB_PILOT_DEFAULTS;
}
