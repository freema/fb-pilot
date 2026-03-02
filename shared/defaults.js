/**
 * FB Pilot — Single source of truth for default settings.
 * Used by content script, popup, and tests.
 */
/* eslint-disable no-var */
var FB_PILOT_DEFAULTS = {
  maxPerBatch: 50,
  delayMin: 800,
  delayMax: 2500,
  coffeeBreakInterval: 15,
  coffeeBreakDuration: 5000,
  inviteWord: 'Invite',
  detectMode: 'both',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FB_PILOT_DEFAULTS;
}
